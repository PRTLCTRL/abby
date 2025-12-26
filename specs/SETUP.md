# Abby - Setup Guide

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   ```bash
   node --version  # Should be v18+
   ```

2. **Python** (3.10 or higher)
   ```bash
   python --version  # Should be 3.10+
   ```

3. **npm** (comes with Node.js)
   ```bash
   npm --version
   ```

4. **pip** (comes with Python)
   ```bash
   pip --version
   ```

5. **ngrok** (for local development)
   - Download from: https://ngrok.com/download
   - Or install via package manager:
     ```bash
     # macOS
     brew install ngrok

     # Windows
     choco install ngrok
     ```

### Required Accounts & API Keys

1. **OpenAI Account**
   - Sign up at https://platform.openai.com/
   - Create API key at https://platform.openai.com/api-keys
   - Ensure you have access to GPT-4 Realtime API
   - Add credits to your account

2. **Twilio Account**
   - Sign up at https://www.twilio.com/
   - Purchase a phone number with voice capabilities
   - Get your Account SID and Auth Token from Console

3. **Huckleberry Account**
   - Sign up at https://huckleberrycare.com/
   - Note your email and password (will be used for API auth)
   - Ensure you have at least one child profile created

4. **ngrok Account** (optional but recommended)
   - Sign up at https://dashboard.ngrok.com/
   - Get your auth token
   - Configure: `ngrok config add-authtoken <your-token>`

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/PRTLCTRL/abby.git
cd abby
```

### 2. Install Node Dependencies

```bash
cd apps/abby
npm install
```

### 3. Install Python Dependencies

```bash
# Install MCP Python SDK
pip install mcp

# Install requests (used by Huckleberry API)
pip install requests python-dotenv
```

### 4. Environment Configuration

#### Create Abby Environment File

Create `apps/abby/.env`:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...your-key-here

# Twilio Configuration (not needed for MCP, but keep for reference)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token

# Huckleberry Credentials
HUCKLE_USER_ID=your-email@example.com
HUCKLE_PW=your-password

# Server Configuration
PORT=3002
```

#### Important Notes:
- **NEVER commit `.env` files** - they contain sensitive credentials
- Use `.env.example` as a template
- For production, use secure secret management (see Deployment section)

## Running Abby

### Development Mode (Recommended)

From the `apps/abby` directory:

```bash
# Option 1: Run everything together (Abby + ngrok)
npm run start:with-ngrok

# Option 2: Run components separately
# Terminal 1 - Start Abby server
npm start

# Terminal 2 - Start ngrok tunnel
npm run ngrok
```

### What Happens:
1. Abby server starts on `http://localhost:3002`
2. Huckleberry MCP server spawns as subprocess
3. ngrok creates public HTTPS URL (e.g., `https://abc123.ngrok.io`)

### Configure Twilio Webhook

1. Copy your ngrok URL from terminal output
2. Go to Twilio Console → Phone Numbers → Your Number
3. Under "Voice & Fax", configure:
   - **A CALL COMES IN**: Webhook
   - **URL**: `https://your-ngrok-url.ngrok.io/incoming-call`
   - **HTTP**: POST
4. Save configuration

## Testing

### 1. Health Check

```bash
curl http://localhost:3002/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "abby",
  "port": 3002
}
```

### 2. Test MCP Connection

```bash
cd apps/abby
npm test
```

This runs `src/test-mcp.ts` which:
- Connects to Huckleberry MCP server
- Lists available tools
- Tests logging a sleep session

### 3. Make a Test Call

1. Call your Twilio phone number
2. Wait for Abby's greeting: "Hi! This is Abby..."
3. Try saying:
   - "Baby just napped for 2 hours"
   - "Fed 4 ounces"
   - "Changed a wet diaper"
4. Check Huckleberry app to verify activities were logged

## Project Structure

```
abby/
├── apps/
│   └── abby/                    # Main application
│       ├── src/
│       │   ├── server.ts        # Express + WebSocket server
│       │   ├── agent.ts         # AI agent configuration
│       │   ├── test-mcp.ts      # MCP testing script
│       │   └── mcp/
│       │       └── huckleberry_server.py  # MCP server
│       ├── data/                # Local data storage
│       │   └── logs/            # Call logs by phone number
│       ├── .env                 # Environment config (DO NOT COMMIT)
│       ├── .env.example         # Template for .env
│       ├── package.json         # Node dependencies
│       └── tsconfig.json        # TypeScript config
│
├── specs/                       # Documentation & APIs
│   ├── ARCHITECTURE.md          # System architecture
│   ├── SETUP.md                 # This file
│   ├── DEPLOYMENT.md            # Deployment guide (TODO)
│   └── huckleberry_api/         # Huckleberry API client
│       ├── api.py               # Main API client
│       ├── types.py             # Type definitions
│       └── const.py             # Constants
│
├── .gitignore                   # Git ignore rules
└── README.md                    # Project overview
```

## Troubleshooting

### MCP Server Fails to Start

**Error**: "Failed to initialize MCP"

**Solutions**:
1. Check Python is in PATH:
   ```bash
   which python  # or: where python (Windows)
   ```

2. Verify Huckleberry credentials in `.env`

3. Check Huckleberry API is accessible:
   ```bash
   cd apps/abby
   npm test
   ```

### ngrok Tunnel Issues

**Error**: "ERR_NGROK_108: You must sign up"

**Solution**:
```bash
ngrok config add-authtoken <your-token>
```

**Error**: Twilio can't reach webhook

**Solution**:
1. Check ngrok is running and shows "Session Status: online"
2. Copy HTTPS URL (not HTTP)
3. Ensure URL in Twilio matches ngrok output exactly

### OpenAI Connection Issues

**Error**: "401 Unauthorized"

**Solution**:
1. Verify `OPENAI_API_KEY` in `.env`
2. Check API key is valid at https://platform.openai.com/api-keys
3. Ensure you have credits in your OpenAI account

**Error**: "Model not available"

**Solution**:
- Realtime API is in preview - you may need to request access
- Check you're on a plan with Realtime API access

### Huckleberry Login Fails

**Error**: "Authentication failed"

**Solutions**:
1. Verify email/password in `.env`
2. Try logging into Huckleberry app manually to confirm credentials
3. Check for special characters in password (may need escaping)

### No Audio on Call

**Checklist**:
1. Twilio webhook correctly configured
2. ngrok tunnel active
3. OpenAI WebSocket connected (check logs)
4. Audio format matches: G.711 μ-law

## Development Workflow

### Making Changes

1. **Edit Agent Instructions**:
   - Modify `src/agent.ts` → `AGENT_INSTRUCTIONS`
   - Restart server: `npm start`

2. **Add New Tools**:
   - Add to `src/agent.ts` → `TOOLS` array
   - Add handler in `handleFunctionCall()`
   - Add MCP tool in `src/mcp/huckleberry_server.py`

3. **Modify Huckleberry API**:
   - Edit `specs/huckleberry_api/api.py`
   - No restart needed (Python subprocess reloads)

### Hot Reload

Use `npm run dev` for auto-restart on file changes:
```bash
npm run dev
```

### Logs

**Abby Server Logs**: stdout (terminal running `npm start`)

**MCP Server Logs**: stderr (shown in same terminal, prefixed with `[Huckleberry MCP]`)

**Call Logs**: `apps/abby/data/logs/{phoneNumber}.jsonl`

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `OPENAI_API_KEY` | Yes | OpenAI API key | `sk-proj-...` |
| `HUCKLE_USER_ID` | Yes | Huckleberry email | `user@example.com` |
| `HUCKLE_PW` | Yes | Huckleberry password | `your-password` |
| `PORT` | No | Server port (default: 3002) | `3002` |
| `TWILIO_ACCOUNT_SID` | No | Twilio Account SID (reference only) | `ACxxxx` |
| `TWILIO_AUTH_TOKEN` | No | Twilio Auth Token (reference only) | `xxx` |

## Security Best Practices

1. **Never commit secrets**:
   - Always use `.env` files
   - Keep `.env` in `.gitignore`
   - Use `.env.example` for templates

2. **Production secrets**:
   - Use environment variables (not `.env` files)
   - Use secret managers (AWS Secrets Manager, etc.)
   - Rotate keys regularly

3. **ngrok security**:
   - Use ngrok auth token
   - Consider ngrok static domain for production-like testing
   - Don't expose ngrok URLs publicly

4. **API rate limits**:
   - Monitor OpenAI usage
   - Huckleberry API has no published rate limits (use responsibly)
   - Implement retry logic with backoff

## Next Steps

1. **Test the system**: Make test calls and verify Huckleberry logging
2. **Customize Abby**: Edit agent instructions for your needs
3. **Read ARCHITECTURE.md**: Understand how components interact
4. **Plan deployment**: See DEPLOYMENT.md (coming soon)

## Getting Help

- **GitHub Issues**: https://github.com/PRTLCTRL/abby/issues
- **Logs**: Check console output for detailed error messages
- **Test MCP**: Run `npm test` to isolate MCP issues
- **Health Check**: Use `/health` endpoint to verify server status

## Deployment Preview

For production deployment (detailed guide coming in DEPLOYMENT.md):

1. **Cloud options**: AWS Lambda, Google Cloud Run, Fly.io, Railway
2. **Secret management**: Use cloud provider's secret manager
3. **Ngrok replacement**: Use cloud provider's public URL
4. **Monitoring**: Set up logging and error tracking
5. **Scaling**: Consider load balancing for multiple calls

See `specs/DEPLOYMENT.md` for detailed deployment instructions (TODO).
