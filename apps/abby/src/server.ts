/**
 * Abby Server - Twilio WebSocket Handler
 *
 * Handles Twilio Media Streams and connects to OpenAI Realtime API
 * Agent logic is in agent.js for clean separation of concerns
 */

import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import twilio from 'twilio';
import { WebSocket as OpenAIWebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Request, Response } from 'express';
import OpenAI from 'openai';
import { getSessionConfig, handleFunctionCall, initializeMCP, shutdownMCP } from './agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT: number = Number(process.env.PORT) || 3002;

// OpenAI client for conversation summarization
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Save parent update to log file
 */
function saveParentUpdate(phoneNumber: string, update: string, category: string = 'general'): void {
  const logsDir = path.join(__dirname, '..', 'data', 'logs');

  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const sanitizedNumber = phoneNumber.replace(/[^0-9]/g, '');
  const logFile = path.join(logsDir, `${sanitizedNumber}.jsonl`);

  const logEntry = {
    timestamp: new Date().toISOString(),
    phone: phoneNumber,
    category,
    update
  };

  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  console.log(`📝 Update saved for ${phoneNumber}: ${category}`);
}

/**
 * Summarize conversation using GPT-4o-mini and save to JSONL
 */
async function summarizeAndSaveConversation(
  transcript: Array<{speaker: string; text: string; timestamp: Date}>,
  phoneNumber: string,
  callDuration: number
): Promise<void> {
  if (transcript.length === 0) {
    console.log('⚠️  No conversation to summarize (empty transcript)');
    return;
  }

  try {
    console.log('🧠 Summarizing conversation with GPT-4o-mini...');

    // Format transcript for GPT
    const formattedTranscript = transcript
      .map(m => `${m.speaker.toUpperCase()}: ${m.text}`)
      .join('\n');

    // Ask GPT to summarize
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Summarize this conversation between a parent and Abby (baby coach):

${formattedTranscript}

Extract and return as JSON:
{
  "summary": "2-3 sentence summary of the conversation",
  "key_topics": ["topic1", "topic2"],
  "concerns_raised": ["concern1", "concern2"],
  "action_items": ["item1", "item2"],
  "sentiment": "worried|positive|neutral"
}

Only include concerns and action items if they were actually mentioned.`
      }],
      response_format: { type: 'json_object' }
    });

    const summary = JSON.parse(response.choices[0].message.content || '{}');

    // Save to JSONL
    const conversationsDir = path.join(__dirname, '..', 'data', 'conversations');
    if (!fs.existsSync(conversationsDir)) {
      fs.mkdirSync(conversationsDir, { recursive: true });
    }

    const sanitizedNumber = phoneNumber.replace(/[^0-9]/g, '');
    const conversationFile = path.join(conversationsDir, `${sanitizedNumber}.jsonl`);

    const conversationEntry = {
      timestamp: new Date().toISOString(),
      phone: phoneNumber,
      duration_seconds: callDuration,
      ...summary
    };

    fs.appendFileSync(conversationFile, JSON.stringify(conversationEntry) + '\n');
    console.log(`✅ Conversation summary saved for ${phoneNumber}`);
    console.log(`   Topics: ${summary.key_topics?.join(', ') || 'none'}`);
    console.log(`   Sentiment: ${summary.sentiment || 'unknown'}`);
  } catch (error) {
    console.error('❌ Failed to summarize conversation:', error);
  }
}

/**
 * Load last conversation summary (if within 48 hours)
 */
function getLastConversation(phoneNumber: string): any | null {
  try {
    const conversationsDir = path.join(__dirname, '..', 'data', 'conversations');
    const sanitizedNumber = phoneNumber.replace(/[^0-9]/g, '');
    const conversationFile = path.join(conversationsDir, `${sanitizedNumber}.jsonl`);

    if (!fs.existsSync(conversationFile)) {
      return null;
    }

    // Read all lines and get the last one
    const lines = fs.readFileSync(conversationFile, 'utf-8').trim().split('\n');
    if (lines.length === 0) {
      return null;
    }

    const lastLine = lines[lines.length - 1];
    const lastConvo = JSON.parse(lastLine);

    // Calculate hours since last conversation
    const lastTimestamp = new Date(lastConvo.timestamp);
    const hoursSince = (Date.now() - lastTimestamp.getTime()) / 1000 / 3600;

    // Only return if within 48 hours
    if (hoursSince > 48) {
      console.log(`⏰ Last conversation was ${hoursSince.toFixed(1)}h ago (too old)`);
      return null;
    }

    return {
      ...lastConvo,
      hours_since: hoursSince
    };
  } catch (error) {
    console.error('❌ Failed to load last conversation:', error);
    return null;
  }
}

/**
 * Twilio webhook - Incoming call handler
 */
app.post('/incoming-call', (req: Request, res: Response) => {
  const { CallSid, From } = req.body;
  console.log(`📞 Incoming call from ${From} (${CallSid})`);

  const twiml = new twilio.twiml.VoiceResponse();

  // Connect directly to OpenAI - let Abby handle the greeting
  const connect = twiml.connect();
  connect.stream({
    url: `wss://${req.headers.host}/media-stream`
  });

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'abby',
    port: PORT
  });
});

/**
 * Dashboard API: Get all conversations for a phone number
 */
app.get('/api/conversations/:phoneNumber', (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.params;
    const sanitizedNumber = phoneNumber.replace(/[^0-9]/g, '');
    const conversationFile = path.join(__dirname, '..', 'data', 'conversations', `${sanitizedNumber}.jsonl`);

    if (!fs.existsSync(conversationFile)) {
      return res.json({ success: true, data: [] });
    }

    const lines = fs.readFileSync(conversationFile, 'utf-8').trim().split('\n');
    const conversations = lines
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .reverse(); // Most recent first

    res.json({ success: true, data: conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch conversations' });
  }
});

/**
 * Dashboard API: Get parent updates/logs
 */
app.get('/api/logs/:phoneNumber', (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.params;
    const sanitizedNumber = phoneNumber.replace(/[^0-9]/g, '');
    const logFile = path.join(__dirname, '..', 'data', 'logs', `${sanitizedNumber}.jsonl`);

    if (!fs.existsSync(logFile)) {
      return res.json({ success: true, data: [] });
    }

    const lines = fs.readFileSync(logFile, 'utf-8').trim().split('\n');
    const logs = lines
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .reverse(); // Most recent first

    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch logs' });
  }
});

/**
 * Dashboard API: Get conversation statistics
 */
app.get('/api/stats/:phoneNumber', (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.params;
    const sanitizedNumber = phoneNumber.replace(/[^0-9]/g, '');
    const conversationFile = path.join(__dirname, '..', 'data', 'conversations', `${sanitizedNumber}.jsonl`);

    if (!fs.existsSync(conversationFile)) {
      return res.json({
        success: true,
        data: {
          total_conversations: 0,
          total_duration: 0,
          topics: {},
          sentiments: {},
          recent_concerns: []
        }
      });
    }

    const lines = fs.readFileSync(conversationFile, 'utf-8').trim().split('\n');
    const conversations = lines.filter(line => line.trim()).map(line => JSON.parse(line));

    const stats = {
      total_conversations: conversations.length,
      total_duration: conversations.reduce((sum, c) => sum + (c.duration_seconds || 0), 0),
      topics: {} as Record<string, number>,
      sentiments: {} as Record<string, number>,
      recent_concerns: [] as string[]
    };

    conversations.forEach(convo => {
      // Count topics
      (convo.key_topics || []).forEach((topic: string) => {
        stats.topics[topic] = (stats.topics[topic] || 0) + 1;
      });

      // Count sentiments
      if (convo.sentiment) {
        stats.sentiments[convo.sentiment] = (stats.sentiments[convo.sentiment] || 0) + 1;
      }

      // Collect recent concerns
      (convo.concerns_raised || []).forEach((concern: string) => {
        if (!stats.recent_concerns.includes(concern)) {
          stats.recent_concerns.push(concern);
        }
      });
    });

    // Limit recent concerns to last 10
    stats.recent_concerns = stats.recent_concerns.slice(0, 10);

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
});

/**
 * Create HTTP server and WebSocket server
 */
const server = app.listen(PORT, async () => {
  console.log('\n👶 Abby - Newborn Baby Coach');
  console.log(`🟢 Server running on port ${PORT}\n`);
  console.log(`Webhook: https://your-ngrok-url/incoming-call`);
  console.log(`Stream:  wss://your-ngrok-url/media-stream\n`);

  // Initialize MCP client
  try {
    await initializeMCP();
  } catch (error) {
    console.error('❌ Failed to initialize MCP:', error);
    console.log('⚠️  Server will continue but Huckleberry logging may not work');
  }
});

const wss = new WebSocketServer({ server, path: '/media-stream' });

/**
 * Handle Twilio Media Stream WebSocket connections
 */
wss.on('connection', (twilioWs) => {
  console.log('🔌 Twilio Media Stream connected');

  let openaiWs = null;
  let streamSid = null;
  let callSid = null;
  let phoneNumber = null;
  let conversationTranscript: Array<{speaker: string; text: string; timestamp: Date}> = [];
  let callStartTime: Date | null = null;

  // Connect to OpenAI Realtime API
  function connectToOpenAI() {
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';

    openaiWs = new OpenAIWebSocket(url, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    openaiWs.on('open', () => {
      console.log('✅ Connected to OpenAI Realtime API');

      // Configure the session with agent settings
      const sessionConfig = getSessionConfig();
      openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: sessionConfig
      }));
    });

    // Handle messages from OpenAI
    openaiWs.on('message', async (data) => {
      try {
        const event = JSON.parse(data.toString());

        switch (event.type) {
          case 'session.created':
            console.log('📡 OpenAI session created');
            break;

          case 'session.updated':
            console.log('✏️  OpenAI session updated');

            // Fetch recent baby activity context from Huckleberry
            try {
              console.log('📊 Fetching recent activity context...');
              const contextResult = await handleFunctionCall(
                'get_recent_activity',
                { hours: 24 },
                phoneNumber,
                saveParentUpdate
              );

              if (contextResult.success && contextResult.message) {
                // Inject context into the conversation as a system message
                openaiWs.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'message',
                    role: 'system',
                    content: [
                      {
                        type: 'input_text',
                        text: `Context about the baby's recent activity:\n${contextResult.message}\n\nUse this information to provide personalized responses and insights during the conversation.`
                      }
                    ]
                  }
                }));
                console.log('✅ Context loaded into conversation');
              }
            } catch (error) {
              console.warn('⚠️  Failed to load recent activity context:', error);
              // Continue without context - not critical
            }

            // Load last conversation context (if within 48 hours)
            try {
              const lastConvo = getLastConversation(phoneNumber);

              if (lastConvo) {
                console.log(`💬 Loading last conversation context (${lastConvo.hours_since.toFixed(1)}h ago)`);

                const contextText = [
                  `Last conversation (${lastConvo.hours_since.toFixed(0)} hours ago):`,
                  lastConvo.summary,
                  '',
                  `Topics discussed: ${lastConvo.key_topics?.join(', ') || 'none'}`,
                  lastConvo.concerns_raised?.length > 0 ? `Concerns raised: ${lastConvo.concerns_raised.join(', ')}` : '',
                  lastConvo.action_items?.length > 0 ? `Follow up on: ${lastConvo.action_items.join(', ')}` : '',
                  '',
                  'Reference this naturally in your greeting if relevant.'
                ].filter(line => line !== '').join('\n');

                openaiWs.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'message',
                    role: 'system',
                    content: [{
                      type: 'input_text',
                      text: contextText
                    }]
                  }
                }));

                console.log('✅ Last conversation context loaded');
              } else {
                console.log('ℹ️  No recent conversation found (or >48h old)');
              }
            } catch (error) {
              console.warn('⚠️  Failed to load last conversation context:', error);
              // Continue without context - not critical
            }

            // Request initial greeting from Abby (now that context is loaded)
            openaiWs.send(JSON.stringify({
              type: 'response.create'
            }));
            console.log('🎤 Requested initial greeting');
            break;

          case 'response.audio.delta':
            // Send audio back to Twilio
            if (twilioWs.readyState === 1 && streamSid) {
              twilioWs.send(JSON.stringify({
                event: 'media',
                streamSid,
                media: {
                  payload: event.delta
                }
              }));
            }
            break;

          case 'response.function_call_arguments.done':
            // Handle function calls via agent
            const result = await handleFunctionCall(
              event.name,
              JSON.parse(event.arguments),
              phoneNumber,
              saveParentUpdate
            );

            // Send function result back to OpenAI
            openaiWs.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: event.call_id,
                output: JSON.stringify(result)
              }
            }));

            // Request a new response to continue the conversation
            openaiWs.send(JSON.stringify({
              type: 'response.create'
            }));
            break;

          case 'conversation.item.input_audio_transcription.completed':
            console.log(`👤 USER: "${event.transcript}"`);
            conversationTranscript.push({
              speaker: 'user',
              text: event.transcript,
              timestamp: new Date()
            });
            break;

          case 'response.audio_transcript.delta':
            // Skip streaming deltas to avoid duplicate logs
            break;

          case 'response.audio_transcript.done':
            console.log(`🤖 ABBY: "${event.transcript}"`);
            conversationTranscript.push({
              speaker: 'abby',
              text: event.transcript,
              timestamp: new Date()
            });
            break;

          case 'input_audio_buffer.speech_started':
            console.log('🎤 [User started speaking]');
            break;

          case 'input_audio_buffer.speech_stopped':
            console.log('🤐 [User stopped speaking]');
            break;

          case 'response.output_item.interrupted':
            console.log('⚠️  [Abby interrupted - listening to user]');
            break;

          case 'conversation.item.truncated':
            console.log('✂️  [Response truncated due to interruption]');
            break;

          case 'response.done':
            console.log('✅ [Response completed]');
            break;

          case 'error':
            console.error('❌ OpenAI error:', event.error);
            break;
        }
      } catch (error) {
        console.error('Error processing OpenAI message:', error);
      }
    });

    openaiWs.on('error', (error) => {
      console.error('OpenAI WebSocket error:', error);
    });

    openaiWs.on('close', () => {
      console.log('🔌 Disconnected from OpenAI Realtime API');
    });
  }

  // Handle messages from Twilio
  twilioWs.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.event) {
        case 'start':
          streamSid = data.start.streamSid;
          callSid = data.start.callSid;
          phoneNumber = data.start.customParameters?.From || 'unknown';
          callStartTime = new Date();
          console.log(`📞 Stream started: ${streamSid}`);
          console.log(`   Call SID: ${callSid}`);
          console.log(`   From: ${phoneNumber}`);
          connectToOpenAI();
          break;

        case 'media':
          // Forward audio to OpenAI
          if (openaiWs && openaiWs.readyState === 1) {
            openaiWs.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: data.media.payload
            }));
          }
          break;

        case 'stop':
          console.log('📞 Stream ended');
          if (openaiWs) {
            openaiWs.close();
          }
          break;
      }
    } catch (error) {
      console.error('Error processing Twilio message:', error);
    }
  });

  twilioWs.on('close', async () => {
    console.log('🔌 Twilio Media Stream disconnected');

    // Summarize and save conversation
    if (conversationTranscript.length > 0 && phoneNumber && callStartTime) {
      const callDuration = Math.floor((Date.now() - callStartTime.getTime()) / 1000);
      await summarizeAndSaveConversation(conversationTranscript, phoneNumber, callDuration);
    }

    if (openaiWs) {
      openaiWs.close();
    }
  });

  twilioWs.on('error', (error) => {
    console.error('Twilio WebSocket error:', error);
  });
});

console.log('🎧 Waiting for calls...\n');

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await shutdownMCP();
  server.close(() => {
    console.log('👋 Server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  await shutdownMCP();
  server.close(() => {
    console.log('👋 Server stopped');
    process.exit(0);
  });
});
