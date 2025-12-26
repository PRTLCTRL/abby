# Prime - Abby Project Overview

This skill provides a comprehensive overview of the Abby project architecture, helping Claude understand the entire system to assist with adding new features.

## What is Abby?

Abby is an AI-powered newborn baby coach accessible via phone that:
- Answers questions about newborn care (feeding, sleeping, development)
- Listens to parent updates about baby activities
- Automatically logs activities to the Huckleberry baby tracking app
- Provides emotional support and evidence-based advice to new parents

**Baby's Name**: Valya

## System Architecture Overview

### Three-Tier Architecture

```
Phone Call (Twilio)
    ↓
Abby Server (Node.js/TypeScript)
    ↓
Huckleberry MCP Server (Python)
    ↓
Huckleberry API Backend
```

### Component 1: Abby Server
**Location**: `apps/abby/`
**Technology**: Node.js + TypeScript + Express + WebSocket
**Port**: 3002

**Responsibilities**:
1. Handle incoming phone calls via Twilio webhook (`POST /incoming-call`)
2. Manage WebSocket connection to Twilio Media Streams (audio in/out)
3. Connect to OpenAI Realtime API for conversational AI
4. Spawn and communicate with Huckleberry MCP server
5. Handle AI function calls and route them to appropriate services
6. Save general parent updates to local log files

**Key Files**:
- `src/server.ts` - HTTP server, WebSocket handler, Twilio integration
- `src/agent.ts` - AI agent config, instructions, tools, MCP client
- `src/test-mcp.ts` - Testing script for MCP connection

### Component 2: Huckleberry MCP Server
**Location**: `apps/abby/src/mcp/huckleberry_server.py`
**Technology**: Python + MCP SDK
**Communication**: stdio (spawned as subprocess by Node.js)

**Responsibilities**:
1. Provide MCP tools for baby activity tracking
2. Authenticate with Huckleberry API
3. Execute tool calls from Abby and return results
4. Manage child profile (currently: Valya)

**Available MCP Tools**:
- `log_sleep(duration_minutes, notes)` - Log completed sleep sessions
- `log_feeding(amount_oz, feeding_type, notes)` - Log feeding sessions
- `log_diaper(diaper_type, notes)` - Log diaper changes (pee/poo/both/dry)
- `log_activity(activity, notes)` - Log general activities (burp, bath, tummy time)
- `log_growth(weight_lbs, height_in, head_in)` - Log growth measurements

### Component 3: Huckleberry API Module
**Location**: `specs/huckleberry_api/`
**Technology**: Python
**Files**: `api.py`, `types.py`, `const.py`

**Responsibilities**:
- Authenticate with Huckleberry backend (email/password)
- Provide Python interface for Huckleberry REST API
- Handle token management and API requests

## How It Works: Data Flow Example

**Example**: Parent says "Baby just napped for 2 hours"

1. **Twilio** receives call → forwards to webhook → establishes Media Stream WebSocket
2. **Abby Server** receives audio → forwards to OpenAI Realtime API
3. **OpenAI** transcribes and understands → calls function `logSleep(duration_minutes=120)`
4. **Abby** receives function call → forwards to MCP client
5. **MCP Client** calls `log_sleep` tool on Huckleberry MCP server (via stdio)
6. **Huckleberry MCP Server** executes tool → calls `huckleberry_api.start_sleep()` and `complete_sleep()`
7. **Huckleberry API** makes HTTP requests to Huckleberry backend
8. **Response** bubbles back through chain → Abby responds: "Got it! I've logged that for you."

## Technology Stack

### Abby Server (Node.js)
- **express** - HTTP server
- **ws** - WebSocket client/server
- **twilio** - Twilio SDK
- **@modelcontextprotocol/sdk** - MCP client
- **dotenv** - Environment config
- **tsx** - TypeScript execution (dev)
- **typescript** - TypeScript compiler

### Huckleberry MCP (Python)
- **mcp** - MCP server SDK
- **requests** - HTTP client (used by Huckleberry API)
- **python-dotenv** - Environment config

### External Services
- **Twilio** - Phone service + Media Streams
- **OpenAI Realtime API** - Conversational AI (gpt-4o-realtime-preview)
- **Huckleberry** - Baby tracking backend
- **ngrok** - Local tunneling (development only)

## Environment Configuration

### Required Environment Variables (apps/abby/.env)
```env
# OpenAI
OPENAI_API_KEY=sk-proj-...

# Huckleberry
HUCKLE_USER_ID=email@example.com
HUCKLE_PW=password

# Optional
PORT=3002  # Default: 3002
```

### Files to NEVER Commit
- `apps/abby/.env` - Contains secrets
- `dev.vars` - Contains secrets (root level)
- Both are in `.gitignore`

## How to Run

### Development (Local + ngrok)
```bash
cd apps/abby

# Option 1: Everything together
npm run start:with-ngrok

# Option 2: Separately
npm start        # Terminal 1
npm run ngrok    # Terminal 2
```

### Testing
```bash
cd apps/abby
npm test         # Test MCP connection
curl http://localhost:3002/health  # Health check
```

### Configure Twilio
1. Get ngrok URL from terminal (e.g., `https://abc123.ngrok.io`)
2. Go to Twilio Console → Your Number
3. Set webhook: `https://abc123.ngrok.io/incoming-call` (POST)

## Project Structure

```
abby/
├── apps/abby/                   # Main application
│   ├── src/
│   │   ├── server.ts            # Express + WebSocket + Twilio
│   │   ├── agent.ts             # OpenAI agent + MCP client
│   │   ├── test-mcp.ts          # MCP testing
│   │   └── mcp/
│   │       └── huckleberry_server.py  # MCP server
│   ├── data/logs/               # Call logs (gitignored)
│   ├── .env                     # Secrets (gitignored)
│   ├── package.json
│   └── tsconfig.json
│
├── specs/                       # Documentation
│   ├── ARCHITECTURE.md          # Detailed architecture
│   ├── SETUP.md                 # Setup guide
│   └── huckleberry_api/         # Huckleberry Python API
│       ├── api.py
│       ├── types.py
│       └── const.py
│
├── .claude/skills/              # Claude skills
│   └── prime.md                 # This file
│
├── .gitignore
└── README.md
```

## Abby's Personality & Instructions

Abby is configured in `src/agent.ts` → `AGENT_INSTRUCTIONS`:
- Warm, friendly, and encouraging
- Evidence-based newborn care advice
- Concise (it's a phone call)
- Automatically logs activities when mentioned
- Reminds parents to consult pediatrician for medical concerns
- Greets caller immediately: "Hi! This is Abby, your newborn baby coach..."

## Adding New Features

### To Add a New Tool/Function

1. **Add tool definition** in `src/agent.ts` → `TOOLS` array:
   ```typescript
   {
     name: 'myNewTool',
     description: 'What it does',
     parameters: { /* JSON schema */ }
   }
   ```

2. **Add handler** in `src/agent.ts` → `handleFunctionCall()`:
   ```typescript
   case 'myNewTool':
     // Handle the function call
   ```

3. **If calling Huckleberry**, add MCP tool in `src/mcp/huckleberry_server.py`:
   - Add to `list_tools()` decorator
   - Add handler in `call_tool()` decorator

4. **If new Huckleberry API needed**, update `specs/huckleberry_api/api.py`

### To Modify Abby's Behavior

Edit `src/agent.ts`:
- **Personality**: `AGENT_INSTRUCTIONS` string
- **Voice**: `SESSION_CONFIG.voice` (alloy, echo, fable, onyx, nova, shimmer)
- **Response settings**: `SESSION_CONFIG` (VAD threshold, silence duration, etc.)

### To Add Logging/Tracking

Options:
1. **Local file logs**: Use `saveParentUpdate()` in `server.ts`
2. **Huckleberry tracking**: Add MCP tool (for baby activities)
3. **Database**: Implement new storage layer (future)

## Common Development Tasks

### Restart After Code Changes
```bash
# Ctrl+C to stop
npm start  # Restart
```

### View Logs
- **Server logs**: Terminal running `npm start`
- **MCP logs**: stderr (same terminal)
- **Call logs**: `apps/abby/data/logs/{phoneNumber}.jsonl`

### Debug MCP Connection
```bash
npm test  # Runs test-mcp.ts
```

### Update Dependencies
```bash
npm install <package>      # Node.js
pip install <package>      # Python
```

## Deployment Considerations

**Current**: Development only (localhost + ngrok)

**Production TODO**:
1. Deploy to cloud (AWS Lambda, Railway, Fly.io, Google Cloud Run)
2. Replace ngrok with cloud URL
3. Use secret manager for environment variables (not .env files)
4. Set up monitoring and logging
5. Implement session management for multiple concurrent calls
6. Consider deploying Huckleberry MCP as separate service

## Key Insights for Claude

When helping with Abby:

1. **Architecture is modular**: Abby server → MCP → Huckleberry API
2. **Two languages**: TypeScript (Abby) + Python (MCP + Huckleberry API)
3. **MCP is the bridge**: Node.js ↔ Python communication via stdio
4. **OpenAI function calling**: AI decides when to call tools based on conversation
5. **Real-time audio**: G.711 μ-law format, no transcription latency
6. **Baby name is Valya**: Hard-coded in Huckleberry MCP (first child in account)

## Documentation Files

For deeper understanding, read:
- `specs/ARCHITECTURE.md` - Complete technical architecture
- `specs/SETUP.md` - Detailed setup and troubleshooting
- `apps/abby/README.md` - Quick start guide
- GitHub: https://github.com/PRTLCTRL/abby

## Quick Reference Commands

```bash
# Start everything
cd apps/abby && npm run start:with-ngrok

# Start server only
cd apps/abby && npm start

# Test MCP
cd apps/abby && npm test

# Health check
curl http://localhost:3002/health

# View logs
tail -f apps/abby/data/logs/*.jsonl
```

---

**Use this overview to quickly understand the entire Abby system and help add new features!**
