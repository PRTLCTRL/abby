/**
 * Abby Agent - Core baby coach logic
 *
 * Defines Abby's instructions, tools, and session configuration
 * for OpenAI Realtime API integration.
 *
 * Uses MCP to communicate with Huckleberry Python service.
 */

import { buildFullSessionInstructions } from './prompts.js';

// Huckleberry service HTTP client
const HUCKLEBERRY_SERVICE_URL = process.env.HUCKLEBERRY_SERVICE_URL ||  'https://huckleberry-service-x3fjlzopga-uc.a.run.app';

console.log(`🍓 Huckleberry service: ${HUCKLEBERRY_SERVICE_URL}`);

/**
 * Call Huckleberry service via HTTP
 */
async function callHuckleberryService(endpoint: string, data: any): Promise<any> {
  const url = `${HUCKLEBERRY_SERVICE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ Failed to call ${endpoint}:`, error);
    throw error;
  }
}

// Deprecated MCP functions (no longer used)
export async function initializeMCP() {
  console.log('⚠️  MCP is deprecated, using HTTP service instead');
  return null;
}

/**
 * Main instructions (exported for session config)
 *
 * Instructions are built from modular prompt functions defined in prompts.ts
 * following Uncle Bob clean code naming conventions.
 */
export const AGENT_INSTRUCTIONS = buildFullSessionInstructions();

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

  try {
    switch (functionName) {
      case 'logSleep':
        console.log('🍓 Logging sleep via HTTP');
        const sleepResult = await callHuckleberryService('/log-sleep', {
          duration_minutes: args.duration_minutes,
          notes: args.notes || ''
        });
        return {
          success: true,
          message: sleepResult.message || 'Sleep logged successfully'
        };

      case 'logFeeding':
        console.log('🍓 Logging feeding via HTTP');
        const feedingResult = await callHuckleberryService('/log-feeding', {
          amount_oz: args.amount_oz,
          feeding_type: args.feeding_type || 'bottle',
          notes: args.notes || ''
        });
        return {
          success: true,
          message: feedingResult.message || 'Feeding logged successfully'
        };

      case 'logDiaper':
        console.log('🍓 Logging diaper via HTTP');
        const diaperResult = await callHuckleberryService('/log-diaper', {
          diaper_type: args.mode,
          notes: args.notes || ''
        });
        return {
          success: true,
          message: diaperResult.message || 'Diaper logged successfully'
        };

      case 'logActivity':
        console.log('🍓 Logging activity via HTTP');
        const activityResult = await callHuckleberryService('/log-activity', {
          activity: args.activity,
          notes: args.notes || ''
        });
        return {
          success: true,
          message: activityResult.message || 'Activity logged successfully'
        };

      case 'getRecentActivity':
        console.log('🍓 Getting recent activity via HTTP');
        try {
          const recentResult = await fetch(`${HUCKLEBERRY_SERVICE_URL}/recent-activity?hours=${args.hours || 24}`);
          const data = await recentResult.json();
          return {
            success: true,
            message: data.message || 'Retrieved recent activity'
          };
        } catch (error) {
          console.error('❌ Failed to get recent activity:', error);
          return {
            success: false,
            message: 'Could not retrieve recent activity'
          };
        }

      case 'recordUpdate':
        console.log('💬 Recording parent update');
        if (saveUpdateFn && phoneNumber) {
          saveUpdateFn(phoneNumber, args.update, args.category);
          return {
            success: true,
            message: 'Update recorded'
          };
        }
        return {
          success: false,
          message: 'Could not record update'
        };

      default:
        return {
          success: false,
          message: `Unknown function: ${functionName}`
        };
    }
  } catch (error: any) {
    console.error(`❌ Function call failed: ${functionName}`,error);
    return {
      success: false,
      message: error.message || 'Failed to complete action'
    };
  }
}

// OLD MCP CODE BELOW - DEPRECATED
/*
async function handleFunctionCallOldMCP(
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
 * Cleanup (no-op for HTTP client)
 */
export async function shutdownMCP() {
  console.log('⚠️  MCP shutdown called (no-op for HTTP service)');
  // No cleanup needed for HTTP client
}
