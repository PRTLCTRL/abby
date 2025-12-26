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
import { getSessionConfig, handleFunctionCall, initializeMCP, shutdownMCP } from './agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT: number = Number(process.env.PORT) || 3002;

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
            break;

          case 'response.audio_transcript.delta':
            // Skip streaming deltas to avoid duplicate logs
            break;

          case 'response.audio_transcript.done':
            console.log(`🤖 ABBY: "${event.transcript}"`);
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

  twilioWs.on('close', () => {
    console.log('🔌 Twilio Media Stream disconnected');
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
