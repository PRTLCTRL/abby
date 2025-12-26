/**
 * Abby Agent - Core baby coach logic
 *
 * Defines Abby's instructions, tools, and session configuration
 * for OpenAI Realtime API integration.
 *
 * Uses MCP to communicate with Huckleberry Python service.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MCP Client for Huckleberry
let mcpClient: Client | null = null;
let mcpTransport: StdioClientTransport | null = null;

/**
 * Initialize MCP client connection to Huckleberry Python server
 */
export async function initializeMCP() {
  if (mcpClient) {
    console.log('🍓 MCP client already initialized');
    return mcpClient;
  }

  const mcpServerPath = path.resolve(__dirname, './mcp/huckleberry_server.py');

  console.log('🍓 Starting Huckleberry MCP server...');
  console.log(`   Path: ${mcpServerPath}`);

  // Create transport (this spawns the Python MCP server)
  mcpTransport = new StdioClientTransport({
    command: 'python',
    args: [mcpServerPath]
  });

  // Create client
  mcpClient = new Client({
    name: 'abby-client',
    version: '1.0.0'
  }, {
    capabilities: {
      tools: {}
    }
  });

  // Connect
  await mcpClient.connect(mcpTransport);

  console.log('✅ MCP client connected to Huckleberry server');

  // List available tools
  const tools = await mcpClient.listTools();
  console.log(`🛠️  Available MCP tools: ${tools.tools.map(t => t.name).join(', ')}`);

  return mcpClient;
}

/**
 * Modular prompt system for different conversation scenarios
 */
const PROMPTS = {
  // Core personality - always included
  core: `You are Abby, a warm and knowledgeable friend who helps with newborn care. You're speaking with the parent of Valya over the phone.

Be concise - this is a phone call. Keep responses short unless explaining something complex.
Talk like a supportive friend, not a customer service bot.`,

  // Conversation style guidelines
  style: `CONVERSATION STYLE:
- Use recent activity context to start natural conversations
- Don't repeatedly ask "How can I help?" or "What would you like to know?"
- Be comfortable with pauses - you don't need to fill every silence
- Differentiate between tasks (logging data) and conversations (discussing concerns)
- Never repeat the same question twice in a row`,

  // Greeting scenario
  greeting: `GREETING:
When the call connects, greet warmly and naturally using available context:
- If you have recent activity data: "Hi! I see Valya [mention something from recent data]. How's everything going?"
- If you have last conversation context: "Hi! Last time we talked about [topic]. How's that going?"
- If no context: "Hi! How are things with Valya today?"

Keep it brief and natural - you're checking in, not interviewing.`,

  // Activity logging scenario
  activity_logging: `ACTIVITY LOGGING:
When parent mentions activities, log them automatically and acknowledge briefly:
- Sleep: "Just put her down" or "She slept 2 hours" → use logSleep → say "Got it!"
- Feeding: "Fed 4 ounces" or "Just finished nursing" → use logFeeding → say "Logged it"
- Diaper: "Changed a wet diaper" or "dirty diaper" → use logDiaper → say "Noted"
- Burp/Activity: "She burped" → use logActivity → say "Got it"

After logging, continue the conversation naturally. Don't prompt for more unless relevant.

For milestones or concerns (not activity tracking), use recordUpdate.`,

  // Discussion and advice scenario
  discussion: `GIVING ADVICE:
- Answer questions thoughtfully with evidence-based information
- When parent seems worried, offer reassurance first, then practical advice
- When parent shares good news, celebrate with them
- Keep responses conversational and concise
- Share relevant patterns or insights from their data when applicable`,

  // Medical disclaimer - ONLY for serious situations
  medical_disclaimer: `MEDICAL SITUATIONS:
ONLY mention consulting a pediatrician if:
- Parent describes symptoms that could indicate illness (fever, difficulty breathing, unusual lethargy)
- Parent asks about medications or medical treatments
- Situation seems urgent or concerning (dehydration, injury, etc.)

For normal parenting questions (sleep schedules, feeding amounts, developmental milestones, fussiness, etc.),
DO NOT add a medical disclaimer. These are routine topics that don't require a doctor visit.

When you DO need to mention a doctor: Keep it brief and natural:
- "That sounds like something worth mentioning to your pediatrician"
- "If this continues, check in with your doctor"

DO NOT say generic phrases like "it's always best to consult your healthcare provider" for normal questions.`,

  // Using context data
  using_context: `USING CONTEXT DATA:
You have access to:
- Recent activity (last 24 hours of sleep, feeding, diapers)
- Patterns detected (typical schedules, intervals)
- Last conversation summary (if available)

Use this naturally:
- "I see she's been sleeping well - 3 good naps today"
- "Looks like she's eating every 3 hours pretty consistently"
- "Her pattern is usually a nap around this time"

Don't just recite data - weave it into the conversation naturally.`,

  // Conversation flow
  flow: `CONVERSATION FLOW:
- Casual update → Brief acknowledgment: "Got it", "Nice", "Okay"
- Question → Thoughtful, helpful answer
- Concern → Reassurance + practical advice
- Good news → Celebrate!
- Natural pause → Allow silence or say something brief like "Sounds good"
- End of topic → Don't force continuation, let parent drive`
};

/**
 * Build instructions based on scenario
 * Default includes all prompts for comprehensive context
 */
function buildInstructions(scenario: 'full' | 'greeting' | 'discussion' | 'logging' = 'full'): string {
  const base = [PROMPTS.core, PROMPTS.style];

  if (scenario === 'full') {
    // Include everything for session initialization
    return [
      ...base,
      PROMPTS.greeting,
      PROMPTS.activity_logging,
      PROMPTS.discussion,
      PROMPTS.using_context,
      PROMPTS.flow,
      PROMPTS.medical_disclaimer
    ].join('\n\n');
  }

  // Scenario-specific (for future use if we want to inject different prompts mid-conversation)
  const scenarioPrompts = {
    greeting: [PROMPTS.greeting, PROMPTS.using_context],
    discussion: [PROMPTS.discussion, PROMPTS.using_context, PROMPTS.medical_disclaimer],
    logging: [PROMPTS.activity_logging]
  };

  return [...base, ...scenarioPrompts[scenario], PROMPTS.flow].join('\n\n');
}

/**
 * Main instructions (exported for session config)
 */
export const AGENT_INSTRUCTIONS = buildInstructions('full');

/**
 * Session configuration for OpenAI Realtime API
 */
export const SESSION_CONFIG = {
  modalities: ['text', 'audio'],
  instructions: AGENT_INSTRUCTIONS,
  voice: 'alloy',
  input_audio_format: 'g711_ulaw',
  output_audio_format: 'g711_ulaw',
  input_audio_transcription: {
    model: 'whisper-1'
  },
  turn_detection: {
    type: 'server_vad',
    threshold: 0.4,
    prefix_padding_ms: 300,
    silence_duration_ms: 800
  },
  tool_choice: 'auto'
};

/**
 * Tool definitions for OpenAI Realtime API
 */
export const TOOLS = [
  {
    name: 'logSleep',
    description: 'Log a completed sleep session for the baby. Use when parent mentions baby napped or slept.',
    parameters: {
      type: 'object',
      properties: {
        duration_minutes: {
          type: 'number',
          description: 'Duration of sleep in minutes'
        },
        notes: {
          type: 'string',
          description: 'Optional notes about sleep quality or conditions'
        }
      },
      required: ['duration_minutes']
    }
  },
  {
    name: 'logFeeding',
    description: 'Log a feeding session for the baby. Use when parent mentions feeding, nursing, or bottle.',
    parameters: {
      type: 'object',
      properties: {
        amount_oz: {
          type: 'number',
          description: 'Amount in ounces (optional for breastfeeding)'
        },
        notes: {
          type: 'string',
          description: 'Optional notes about feeding (e.g., breast, bottle, formula)'
        }
      }
    }
  },
  {
    name: 'logDiaper',
    description: 'Log a diaper change. Use when parent mentions diaper change, wet diaper, or dirty diaper.',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['pee', 'poo', 'both', 'dry'],
          description: 'Type of diaper change: pee (wet), poo (dirty), both, or dry'
        },
        notes: {
          type: 'string',
          description: 'Optional notes'
        }
      },
      required: ['mode']
    }
  },
  {
    name: 'logActivity',
    description: 'Log a general activity like burping, tummy time, bath, etc.',
    parameters: {
      type: 'object',
      properties: {
        activity: {
          type: 'string',
          description: 'Activity type (burp, bath, tummy_time, etc.)'
        },
        notes: {
          type: 'string',
          description: 'Activity details or notes'
        }
      },
      required: ['activity']
    }
  },
  {
    name: 'recordUpdate',
    description: 'Record a general update, milestone, or concern shared by the parent (not activity tracking)',
    parameters: {
      type: 'object',
      properties: {
        update: {
          type: 'string',
          description: 'The update or information shared'
        },
        category: {
          type: 'string',
          enum: ['development', 'milestone', 'concern', 'general'],
          description: 'Category of update'
        }
      },
      required: ['update', 'category']
    }
  }
];

/**
 * Handle function calls from OpenAI using MCP
 */
export async function handleFunctionCall(
  functionName: string,
  args: any,
  phoneNumber: string | null = null,
  saveUpdateFn: ((phone: string, update: string, category: string) => void) | null = null
): Promise<{ success: boolean; message: string }> {
  console.log(`📞 Function call: ${functionName}`, args);

  // Ensure MCP client is initialized
  if (!mcpClient) {
    try {
      await initializeMCP();
    } catch (error) {
      console.error('❌ Failed to initialize MCP client:', error);
      return {
        success: false,
        message: 'Failed to connect to baby tracking service'
      };
    }
  }

  try {
    switch (functionName) {
      case 'logSleep':
        console.log('🍓 Calling MCP tool: log_sleep');
        const sleepResult = await mcpClient.callTool({
          name: 'log_sleep',
          arguments: {
            duration_minutes: args.duration_minutes,
            notes: args.notes || ''
          }
        });

        return {
          success: !sleepResult.isError,
          message: sleepResult.content?.[0]?.text || 'Sleep logged'
        };

      case 'logFeeding':
        console.log('🍓 Calling MCP tool: log_feeding');
        const feedResult = await mcpClient.callTool({
          name: 'log_feeding',
          arguments: {
            amount_oz: args.amount_oz || 0,
            notes: args.notes || ''
          }
        });

        return {
          success: !feedResult.isError,
          message: feedResult.content?.[0]?.text || 'Feeding logged'
        };

      case 'logDiaper':
        console.log('🍓 Calling MCP tool: log_diaper');
        const diaperResult = await mcpClient.callTool({
          name: 'log_diaper',
          arguments: {
            diaper_type: args.mode,
            notes: args.notes || ''
          }
        });

        return {
          success: !diaperResult.isError,
          message: diaperResult.content?.[0]?.text || 'Diaper change logged'
        };

      case 'logActivity':
        console.log('🍓 Calling MCP tool: log_activity');
        const activityResult = await mcpClient.callTool({
          name: 'log_activity',
          arguments: {
            activity: args.activity,
            notes: args.notes || ''
          }
        });

        return {
          success: !activityResult.isError,
          message: activityResult.content?.[0]?.text || 'Activity logged'
        };

      case 'recordUpdate':
        // Save to local log file (not MCP)
        if (phoneNumber && saveUpdateFn) {
          saveUpdateFn(phoneNumber, args.update, args.category);
        }
        return {
          success: true,
          message: 'Update recorded successfully'
        };

      case 'get_recent_activity':
        console.log('🍓 Calling MCP tool: get_recent_activity');
        const activitySummary = await mcpClient.callTool({
          name: 'get_recent_activity',
          arguments: {
            hours: args.hours || 24
          }
        });

        return {
          success: !activitySummary.isError,
          message: activitySummary.content?.[0]?.text || 'Activity summary retrieved'
        };

      default:
        console.warn(`Unknown function: ${functionName}`);
        return {
          success: false,
          message: `Unknown function: ${functionName}`
        };
    }
  } catch (error) {
    console.error(`❌ MCP call failed for ${functionName}:`, error);
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Get session configuration with tools
 */
export function getSessionConfig() {
  return {
    ...SESSION_CONFIG,
    tools: TOOLS.map(tool => ({
      type: 'function',
      ...tool
    }))
  };
}

/**
 * Cleanup MCP client on shutdown
 */
export async function shutdownMCP() {
  if (mcpClient) {
    console.log('🍓 Shutting down MCP client...');
    await mcpClient.close();
    mcpClient = null;
    mcpTransport = null;
  }
}
