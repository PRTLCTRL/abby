# Abby - System Architecture

## Overview

Abby is an AI-powered newborn baby coach accessible via phone that automatically logs baby activities to Huckleberry. The system combines Twilio's phone service, OpenAI's Realtime API for conversational AI, and a custom MCP (Model Context Protocol) server to interact with Huckleberry's API.

## High-Level Architecture

```
┌─────────────────┐
│  Parent's Phone │
└────────┬────────┘
         │ (Call)
         ▼
┌─────────────────┐
│  Twilio Service │
└────────┬────────┘
         │ (WebSocket - Media Stream)
         ▼
┌─────────────────────────────────────────┐
│         Abby Server (Node/TS)           │
│  ┌───────────────────────────────────┐  │
│  │  Express HTTP Server (Port 3002)  │  │
│  │  - /incoming-call webhook         │  │
│  │  - /health endpoint               │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  WebSocket Server                 │  │
│  │  - Twilio Media Stream handler    │  │
│  │  - OpenAI Realtime API client     │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  MCP Client                       │  │
│  │  - Connects to Huckleberry server │  │
│  └──────────────┬────────────────────┘  │
└─────────────────┼───────────────────────┘
                  │ (stdio - MCP protocol)
                  ▼
┌─────────────────────────────────────────┐
│  Huckleberry MCP Server (Python)        │
│  - Spawned as subprocess by Abby        │
│  - Provides MCP tools:                  │
│    • log_sleep                          │
│    • log_feeding                        │
│    • log_diaper                         │
│    • log_activity                       │
│    • log_growth                         │
│  └──────────────┬──────────────────────┘
                  │ (HTTP API calls)
                  ▼
          ┌─────────────────┐
          │  Huckleberry    │
          │  REST API       │
          └─────────────────┘
```

## Component Details

### 1. Abby Server (apps/abby/)

**Technology**: Node.js + TypeScript + Express + WebSocket

**Port**: 3002

**Key Files**:
- `src/server.ts` - Main server, handles Twilio webhooks and WebSocket streams
- `src/agent.ts` - Agent configuration, instructions, tools, and MCP client
- `src/mcp/huckleberry_server.py` - MCP server for Huckleberry integration

**Responsibilities**:
1. **HTTP Endpoints**:
   - `POST /incoming-call` - Twilio webhook for incoming calls
   - `GET /health` - Health check endpoint

2. **WebSocket Handling**:
   - Receives audio from Twilio Media Stream (G.711 μ-law format)
   - Forwards audio to OpenAI Realtime API
   - Receives AI responses and sends back to Twilio

3. **OpenAI Integration**:
   - Maintains WebSocket connection to OpenAI Realtime API
   - Configures session with Abby's personality and tools
   - Handles function calls from AI (logSleep, logFeeding, etc.)

4. **MCP Client**:
   - Spawns Python MCP server as subprocess
   - Communicates via stdio using MCP protocol
   - Forwards function calls to Huckleberry tools

5. **Local Logging**:
   - Saves general parent updates to `data/logs/{phoneNumber}.jsonl`

### 2. Huckleberry MCP Server

**Technology**: Python + MCP SDK

**Location**: `apps/abby/src/mcp/huckleberry_server.py`

**Communication**: stdio (spawned by Node.js MCP client)

**Responsibilities**:
1. Initialize Huckleberry API client with credentials
2. Provide MCP tools for baby activity tracking
3. Execute tool calls and return results to Abby
4. Handle authentication and API communication with Huckleberry

**Available Tools**:
- `log_sleep(duration_minutes, notes)` - Log completed sleep sessions
- `log_feeding(amount_oz, feeding_type, notes)` - Log feeding sessions
- `log_diaper(diaper_type, notes)` - Log diaper changes (pee/poo/both/dry)
- `log_activity(activity, notes)` - Log general activities (burp, bath, etc.)
- `log_growth(weight_lbs, height_in, head_in)` - Log growth measurements

### 3. Huckleberry API Module

**Technology**: Python

**Location**: `specs/huckleberry_api/`

**Key Files**:
- `api.py` - Main API client with authentication and endpoints
- `types.py` - Type definitions for API responses
- `const.py` - Constants (API base URL, etc.)

**Responsibilities**:
1. Authenticate with Huckleberry (email/password)
2. Manage session tokens
3. Provide methods for:
   - Getting children list
   - Starting/completing sleep sessions
   - Starting/completing feeding sessions
   - Logging diaper changes
   - Logging growth measurements

## Data Flow

### Example: Logging a Sleep Session

```
1. Parent calls Twilio number and says:
   "Baby just napped for 2 hours"

2. Twilio → Abby Server (WebSocket):
   Audio stream (G.711 μ-law)

3. Abby Server → OpenAI Realtime API:
   Audio buffer append

4. OpenAI Realtime API → Abby Server:
   Transcription: "Baby just napped for 2 hours"
   Function call: logSleep(duration_minutes=120)

5. Abby Server → Huckleberry MCP Server:
   MCP tool call: log_sleep(duration_minutes=120)

6. Huckleberry MCP Server → Huckleberry API:
   start_sleep(child_uid)
   complete_sleep(child_uid)

7. Huckleberry API → Huckleberry Backend:
   HTTP POST requests to log the sleep session

8. Response bubbles back through the chain:
   Huckleberry → MCP Server → Abby → OpenAI → Twilio → Parent
   Abby says: "Got it! I've logged that for you."
```

## Technology Stack

### Backend (Abby Server)
- **Runtime**: Node.js
- **Language**: TypeScript
- **Web Framework**: Express
- **WebSocket**: ws library
- **MCP Client**: @modelcontextprotocol/sdk
- **Twilio SDK**: twilio
- **Build Tool**: tsx (for development), tsc (for production)

### MCP Server
- **Language**: Python 3.x
- **MCP Framework**: mcp server SDK
- **API Client**: Custom Huckleberry API module
- **Environment**: dotenv for configuration

### External Services
- **Twilio**: Phone service and Media Streams
- **OpenAI**: Realtime API (gpt-4o-realtime-preview)
- **Huckleberry**: Baby tracking backend API
- **ngrok**: Tunneling service for local development

## Communication Protocols

### 1. Twilio ↔ Abby
- **Protocol**: WebSocket (Twilio Media Streams)
- **Format**: JSON messages with base64-encoded audio
- **Audio Format**: G.711 μ-law (8kHz, 8-bit)

### 2. Abby ↔ OpenAI
- **Protocol**: WebSocket
- **Format**: JSON messages (OpenAI Realtime API protocol)
- **Audio Format**: G.711 μ-law (matches Twilio)

### 3. Abby ↔ Huckleberry MCP Server
- **Protocol**: MCP (Model Context Protocol)
- **Transport**: stdio (standard input/output)
- **Format**: JSON-RPC 2.0

### 4. Huckleberry MCP ↔ Huckleberry API
- **Protocol**: HTTP/HTTPS
- **Format**: JSON
- **Authentication**: Bearer token (obtained via email/password)

## Environment Configuration

See `SETUP.md` for detailed environment variables and setup instructions.

## Security Considerations

1. **API Keys**: All sensitive credentials stored in `.env` files (gitignored)
2. **HTTPS**: ngrok provides HTTPS tunnel for Twilio webhooks
3. **Authentication**: Huckleberry credentials stored securely, tokens refreshed as needed
4. **Validation**: Input validation on all tool parameters
5. **Error Handling**: Graceful degradation if Huckleberry service unavailable

## Scalability Notes

**Current Limitations**:
- Single concurrent call supported (one WebSocket connection at a time)
- MCP server spawned per Abby instance
- Local file logging (not distributed)

**Future Improvements**:
- Support multiple concurrent calls with session management
- Deploy Huckleberry MCP as standalone service
- Use database instead of file-based logging
- Deploy to cloud (AWS Lambda, Cloudflare Workers, etc.)

## Deployment Architecture

### Development (Current)
```
Local Machine:
  - Abby Server (localhost:3002)
  - Huckleberry MCP (subprocess)

ngrok:
  - Public HTTPS URL → localhost:3002

Twilio:
  - Phone number configured with ngrok URL
```

### Production (Proposed)
```
Cloud Platform (e.g., AWS, GCP):
  - Abby Server (containerized)
  - Huckleberry MCP (separate service or subprocess)
  - Load balancer for scaling

Twilio:
  - Phone number configured with cloud URL
```

## Error Handling Strategy

1. **MCP Connection Failure**: Server continues, logs warning, parent interactions work but Huckleberry logging disabled
2. **Huckleberry API Error**: MCP returns error message, Abby informs parent gracefully
3. **OpenAI Connection Loss**: WebSocket reconnection logic (needs implementation)
4. **Twilio Stream Interruption**: Clean up resources, log call details

## Monitoring & Logging

**Current Implementation**:
- Console logs for all major events
- Parent updates saved to `data/logs/{phoneNumber}.jsonl`
- MCP server logs to stderr

**Production Needs**:
- Structured logging (JSON format)
- Log aggregation (e.g., CloudWatch, Datadog)
- Error tracking (e.g., Sentry)
- Performance monitoring
- Call analytics
