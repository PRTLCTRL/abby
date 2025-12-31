---
description: Load comprehensive Abby project overview and architecture
---

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

### Microservices Architecture (Cloud Run)

```
Phone Call (Twilio)
    ↓
Abby Service (Node.js) - Cloud Run
    ↓ HTTP
Huckleberry Service (Python FastAPI) - Cloud Run
    ↓
Huckleberry API Backend
```

**Architecture Change (Dec 2024)**:
- **Before**: Monolithic container (Node.js + Python + MCP via stdio)
- **After**: Microservices (HTTP communication between services)
- **Why**: Fixed MCP timeout issues, better scalability, easier debugging

### Service 1: Abby Service
**Deployed**: https://abby-service-1060085564812.us-central1.run.app
**Location**: `apps/abby/`
**Technology**: Node.js + TypeScript + Express + WebSocket
**Container**: Node.js 20 (slim)

**Responsibilities**:
1. Handle incoming phone calls via Twilio webhook (`POST /incoming-call`)
2. Manage WebSocket connection to Twilio Media Streams (audio in/out)
3. Connect to OpenAI Realtime API for conversational AI
4. Handle AI function calls and route to Huckleberry service via HTTP
5. Save general parent updates to ephemeral logs

**Key Files**:
- `src/server.ts` - HTTP server, WebSocket handler, Twilio integration
- `src/agent.ts` - AI agent config, instructions, tools, HTTP client
- `src/prompts.ts` - Modular prompt system
- `Dockerfile` - Container definition (Node.js only, no Python)

**Environment Variables**:
- `OPENAI_API_KEY` - OpenAI API key (from Secret Manager)
- `HUCKLEBERRY_SERVICE_URL` - Huckleberry service URL (defaults to deployed URL)
- `PORT` - Server port (default: 8080 in Cloud Run)
- `NODE_ENV` - Environment (production)

### Service 2: Huckleberry Service
**Deployed**: https://huckleberry-service-x3fjlzopga-uc.a.run.app
**Location**: `apps/huckleberry-service/`
**Technology**: Python 3.11 + FastAPI
**Container**: Python 3.11 (slim)

**Responsibilities**:
1. Authenticate with Huckleberry API
2. Provide REST endpoints for baby activity tracking
3. Manage child profile (Valya)

**API Endpoints**:
- `POST /log-sleep` - Log completed sleep sessions
- `POST /log-feeding` - Log feeding sessions
- `POST /log-diaper` - Log diaper changes (pee/poo/both/dry)
- `POST /log-activity` - Log general activities (burp, bath, tummy time)
- `GET /health` - Health check

**Environment Variables**:
- `HUCKLE_USER_ID` - Huckleberry email (from Secret Manager)
- `HUCKLE_PW` - Huckleberry password (from Secret Manager)
- `PORT` - Server port (default: 8080)

### Service 3: Reddit Service (Future)
**Status**: Code ready, not yet deployed
**Location**: `apps/reddit-service/`
**Technology**: Python 3.11 + FastAPI + PRAW

**Purpose**: Fetch parenting tips from Reddit subreddits (read-only)

## How It Works: Data Flow Example

**Example**: Parent says "Baby just napped for 2 hours"

1. **Twilio** receives call → forwards to Abby webhook → establishes Media Stream WebSocket
2. **Abby Service** receives audio → forwards to OpenAI Realtime API
3. **OpenAI** transcribes and understands → calls function `logSleep(duration_minutes=120)`
4. **Abby** receives function call → makes HTTP POST to Huckleberry service
5. **Huckleberry Service** executes → calls `huckleberry_api.start_sleep()` and `complete_sleep()`
6. **Huckleberry API** makes HTTP requests to Huckleberry backend
7. **Response** returns via HTTP → Abby responds: "Got it! I've logged that for you."

## Cloud Run Deployment

### Production Services

| Service | URL | Status | Scaling |
|---------|-----|--------|---------|
| Abby | https://abby-service-1060085564812.us-central1.run.app | ✅ Live | 0-5 instances |
| Huckleberry | https://huckleberry-service-x3fjlzopga-uc.a.run.app | ✅ Live | 0-3 instances |
| Reddit | Not deployed | ⏳ Awaiting credentials | - |

### GCP Project Details
- **Project**: `abby-baby-coach`
- **Region**: `us-central1` (Iowa)
- **Artifact Registry**: `abby-repo`
- **Service Accounts**:
  - `abby-deployer` - For GitHub Actions CI/CD
  - `abby-runtime` - Runtime service account for Cloud Run

### Secret Manager
Secrets stored in GCP Secret Manager:
- `OPENAI_API_KEY` - OpenAI API key
- `HUCKLE_USER_ID` - Huckleberry email
- `HUCKLE_PW` - Huckleberry password
- `REDDIT_CLIENT_ID` - Reddit API client ID (future)
- `REDDIT_CLIENT_SECRET` - Reddit API secret (future)

### Viewing Logs

**View recent logs for a service**:
```bash
# Abby service logs
gcloud run services logs read abby-service --region us-central1 --limit 50

# Huckleberry service logs
gcloud run services logs read huckleberry-service --region us-central1 --limit 50

# Filter logs
gcloud run services logs read abby-service --region us-central1 --limit 100 | grep ERROR

# Real-time logs (tail)
gcloud run services logs tail abby-service --region us-central1
```

**View logs in Cloud Console**:
https://console.cloud.google.com/run?project=abby-baby-coach

**View logs for specific revision**:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=abby-service AND resource.labels.revision_name=abby-service-00006-wjf" --limit=50 --project=abby-baby-coach
```

### Viewing Deployments

**List service revisions**:
```bash
# List all revisions for Abby
gcloud run revisions list --service=abby-service --region=us-central1

# List all revisions for Huckleberry
gcloud run revisions list --service=huckleberry-service --region=us-central1
```

**View current deployment**:
```bash
# Describe Abby service
gcloud run services describe abby-service --region=us-central1

# Get service URL
gcloud run services describe abby-service --region=us-central1 --format="get(status.url)"

# View current traffic split
gcloud run services describe abby-service --region=us-central1 --format="get(status.traffic)"
```

**View recent builds**:
```bash
# List Cloud Build history
gcloud builds list --limit=10

# View specific build
gcloud builds describe BUILD_ID

# View build logs
gcloud builds log BUILD_ID
```

### Deploying Updates

**Manual deployment**:
```bash
# Build container
gcloud builds submit --config=cloudbuild.yaml .

# Deploy to Cloud Run
gcloud run deploy abby-service \
  --image us-central1-docker.pkg.dev/abby-baby-coach/abby-repo/abby-service:latest \
  --region us-central1
```

**Automated deployment (GitHub Actions)**:
- Push to `main` branch
- GitHub Actions automatically builds and deploys
- Workflow: `.github/workflows/deploy-abby.yml`

### Testing Deployment

```bash
# Test Abby health
curl https://abby-service-1060085564812.us-central1.run.app/health

# Test Huckleberry health
curl https://huckleberry-service-x3fjlzopga-uc.a.run.app/health

# Test incoming call endpoint
curl -X POST https://abby-service-1060085564812.us-central1.run.app/incoming-call \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123&From=+15555551234&To=+15555556789&CallStatus=ringing"

# Test Huckleberry logging
curl -X POST https://huckleberry-service-x3fjlzopga-uc.a.run.app/log-sleep \
  -H "Content-Type: application/json" \
  -d '{"duration_minutes": 60, "notes": "Test sleep"}'
```

### Monitoring

**Cloud Run Metrics**:
https://console.cloud.google.com/run/detail/us-central1/abby-service/metrics?project=abby-baby-coach

**Key Metrics**:
- Request count
- Request latency
- Container instance count
- Error rate
- Memory usage
- CPU utilization

**Alerts** (to be configured):
- Error rate > 5%
- Response time > 5s
- Service down

## Technology Stack

### Abby Service (Node.js)
- **express** - HTTP server
- **ws** - WebSocket client/server
- **twilio** - Twilio SDK
- **openai** - OpenAI SDK
- **dotenv** - Environment config
- **tsx** - TypeScript execution
- **typescript** - TypeScript compiler

### Huckleberry Service (Python)
- **fastapi** - Web framework
- **uvicorn** - ASGI server
- **pydantic** - Data validation
- **requests** - HTTP client (used by Huckleberry API)

### External Services
- **Twilio** - Phone service + Media Streams
- **OpenAI Realtime API** - Conversational AI (gpt-4o-realtime-preview)
- **Huckleberry** - Baby tracking backend
- **Google Cloud Run** - Serverless container platform
- **Google Secret Manager** - Credentials storage

## Local Development

### Development (Local + ngrok)
```bash
cd apps/abby

# Option 1: Everything together
npm run start:with-ngrok

# Option 2: Separately
npm start        # Terminal 1
npm run ngrok    # Terminal 2
```

### Testing Locally
```bash
cd apps/abby
npm start

# Health check
curl http://localhost:3002/health

# Test with ngrok URL
# Update Twilio webhook to ngrok URL
```

### Configure Twilio
1. Get ngrok URL from terminal (e.g., `https://abc123.ngrok.io`)
2. Go to Twilio Console → Your Number
3. Set webhook: `https://abc123.ngrok.io/incoming-call` (POST)

**Production**: Update to `https://abby-service-1060085564812.us-central1.run.app/incoming-call`

## Project Structure

```
abby/
├── apps/
│   ├── abby/                        # Abby Service (Node.js)
│   │   ├── src/
│   │   │   ├── server.ts            # Express + WebSocket + Twilio
│   │   │   ├── agent.ts             # OpenAI agent + HTTP client
│   │   │   └── prompts.ts           # Modular prompts
│   │   ├── Dockerfile               # Node.js 20 container
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── huckleberry-service/         # Huckleberry Service (Python)
│   │   ├── main.py                  # FastAPI app
│   │   ├── Dockerfile               # Python 3.11 container
│   │   └── requirements.txt
│   │
│   └── reddit-service/              # Reddit Service (Python) - Future
│       ├── main.py                  # FastAPI app
│       ├── Dockerfile
│       ├── requirements.txt
│       └── REDDIT_SETUP.md
│
├── specs/                           # Documentation + Huckleberry API
│   ├── ARCHITECTURE.md
│   ├── SETUP.md
│   └── huckleberry_api/             # Huckleberry Python API
│       ├── __init__.py
│       ├── api.py
│       ├── types.py
│       └── const.py
│
├── .github/workflows/
│   └── deploy-abby.yml              # GitHub Actions CI/CD
│
├── cloudbuild.yaml                  # Abby build config
├── cloudbuild-huckleberry.yaml      # Huckleberry build config
├── cloudbuild-reddit.yaml           # Reddit build config
├── .gitignore
└── README.md
```

## Adding New Features

### To Add a New Tool/Function

1. **Add tool definition** in `apps/abby/src/agent.ts` → `TOOLS` array:
   ```typescript
   {
     name: 'myNewTool',
     description: 'What it does',
     parameters: { /* JSON schema */ }
   }
   ```

2. **Add handler** in `apps/abby/src/agent.ts` → `handleFunctionCall()`:
   ```typescript
   case 'myNewTool':
     const result = await callHuckleberryService('/my-endpoint', {
       param: args.param
     });
     return { success: true, message: result.message };
   ```

3. **Add endpoint to Huckleberry service** in `apps/huckleberry-service/main.py`:
   ```python
   @app.post("/my-endpoint")
   async def my_endpoint(request: MyRequest):
       # Implementation
       return {"success": True, "message": "Done"}
   ```

4. **Deploy both services** to update production

### To Modify Abby's Behavior

Edit `apps/abby/src/agent.ts` or `apps/abby/src/prompts.ts`:
- **Personality**: Prompts in `buildFullSessionInstructions()`
- **Voice**: `SESSION_CONFIG.voice` (alloy, echo, fable, onyx, nova, shimmer)
- **Response settings**: `SESSION_CONFIG` (VAD threshold, silence duration, etc.)

## Troubleshooting

### Service Won't Start
```bash
# Check logs
gcloud run services logs read SERVICE_NAME --region us-central1 --limit 50

# Check service health
curl https://SERVICE_URL/health

# View container startup logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=SERVICE_NAME" --limit=30
```

### HTTP 422 Errors (Validation)
- Check request body matches expected schema
- View Huckleberry logs for detailed error messages
- Common issue: Missing required fields in API calls

### MCP References (Deprecated)
- Old MCP code is commented out but not deleted
- All stdio communication replaced with HTTP
- `initializeMCP()` and `shutdownMCP()` are now no-ops

## Quick Reference Commands

```bash
# View live logs
gcloud run services logs tail abby-service --region us-central1

# Test services
curl https://abby-service-1060085564812.us-central1.run.app/health
curl https://huckleberry-service-x3fjlzopga-uc.a.run.app/health

# Deploy manually
gcloud builds submit --config=cloudbuild.yaml .
gcloud run deploy abby-service --image IMAGE_URL --region us-central1

# List deployments
gcloud run revisions list --service=abby-service --region=us-central1

# View secrets
gcloud secrets list --project=abby-baby-coach

# View Cloud Run services
gcloud run services list --region=us-central1
```

---

**Use this overview to quickly understand the entire Abby system and help add new features!**
