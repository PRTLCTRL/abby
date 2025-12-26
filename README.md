# Abby - AI Newborn Baby Coach

> *An AI-powered phone assistant that learns from your interactions with your baby and helps you track the beautiful chaos of new parenthood.*

## The Story

Becoming a new parent to **Valya** was overwhelming. Between feedings, diaper changes, sleep tracking, and a million questions ("Is this normal?" "Should I be worried?" "When did they last eat?"), I needed help.

I wanted an AI companion that could:
- **Listen** to my updates throughout the day via simple phone calls
- **Learn** from my interactions and experiences with my baby
- **Track** important activities automatically (feeding, sleep, diapers)
- **Support** me with evidence-based advice and reassurance
- **Remember** everything so I don't have to

So I built **Abby** - a warm, knowledgeable AI baby coach you can call anytime, just like talking to a friend who happens to have perfect memory and unlimited patience.

## What Abby Does

Call Abby's phone number and say things like:
- *"Baby just napped for 2 hours"* → Automatically logged to Huckleberry
- *"Fed 4 ounces"* → Tracked
- *"Changed a wet diaper"* → Recorded
- *"Is it normal for a newborn to sneeze so much?"* → Answers with evidence-based advice
- *"I'm worried about..."* → Provides reassurance and guidance

Abby uses conversational AI to understand natural speech, automatically logs activities to your baby tracking app, and provides support exactly when you need it - hands-free, while you're holding your little one.

## How It Works

```
You call Abby's number
        ↓
Twilio receives the call
        ↓
Abby (OpenAI Realtime API) listens and responds
        ↓
Automatically logs activities to Huckleberry
        ↓
You get back to being a parent
```

### Architecture

Abby is built with three main components:

1. **Abby Server** (Node.js/TypeScript)
   - Handles phone calls via Twilio
   - Uses OpenAI Realtime API for natural conversation
   - Processes what you say and decides what to track

2. **Huckleberry MCP Server** (Python)
   - Communicates with Huckleberry baby tracking app
   - Logs sleep, feeding, diapers, and activities
   - Spawned automatically by Abby

3. **Twilio + OpenAI**
   - Twilio: Provides the phone number and audio streaming
   - OpenAI: Powers Abby's conversational understanding and voice

For detailed technical documentation, see [`specs/ARCHITECTURE.md`](specs/ARCHITECTURE.md).

## Quick Start

### Prerequisites

You'll need:
- **Node.js** (v18+) and **Python** (3.10+)
- **ngrok** (for local development) - [Download here](https://ngrok.com/download)
- **API Keys** (see below)

### Required API Keys

1. **OpenAI API Key**
   - Sign up: https://platform.openai.com/
   - Create key: https://platform.openai.com/api-keys
   - Format: `sk-proj-xxxxxxxxxxxxx`
   - Cost: ~$0.06/min for Realtime API

2. **Twilio Account**
   - Sign up: https://www.twilio.com/
   - Buy a phone number (~$1/month)
   - Get Account SID: `ACxxxxxxxxxxxxxxxx`
   - Get Auth Token from Twilio Console
   - Cost: ~$1/month for number + $0.0085/min for calls

3. **Huckleberry Credentials**
   - Your existing Huckleberry account email and password
   - Sign up at https://huckleberrycare.com/ if needed
   - Free tier available

4. **ngrok** (optional)
   - Free account: https://dashboard.ngrok.com/
   - Auth token from dashboard
   - Static domain: $8/month (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/PRTLCTRL/abby.git
cd abby

# Install dependencies
cd apps/abby
npm install
pip install mcp requests python-dotenv

# Configure environment
cp .env.example .env
# Edit .env with your API keys (see below)
```

### Environment Configuration

Create `apps/abby/.env`:

```env
# OpenAI - Required
OPENAI_API_KEY=sk-proj-your-openai-key-here

# Huckleberry - Required
HUCKLE_USER_ID=your-email@example.com
HUCKLE_PW=your-huckleberry-password

# Twilio - Reference only (configured in Twilio Console)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token

# Optional
PORT=3002
```

**Important**: Never commit your `.env` file! It's already in `.gitignore`.

### Running Abby

```bash
# From apps/abby directory

# Option 1: Run everything together (recommended)
npm run start:with-ngrok

# Option 2: Run separately
# Terminal 1
npm start

# Terminal 2
npm run ngrok
```

This will:
1. Start Abby server on `http://localhost:3002`
2. Spawn Huckleberry MCP server automatically
3. Create ngrok tunnel with public URL (e.g., `https://abc123.ngrok.io`)

### Configure Twilio

1. Copy your ngrok URL from terminal output
2. Go to [Twilio Console](https://console.twilio.com/) → Phone Numbers → Your Number
3. Under "Voice & Fax" → "A CALL COMES IN":
   - Select "Webhook"
   - Enter: `https://your-ngrok-url.ngrok.io/incoming-call`
   - Method: `POST`
4. Save

### Make Your First Call! 📞

Call your Twilio number and you'll hear:

> *"Hi! This is Abby, your newborn baby coach. I'm here to help answer questions about your little one. How can I help you today?"*

Try saying:
- "Baby just finished eating"
- "Took a 2 hour nap"
- "Changed a wet diaper"
- "Is it normal for newborns to have hiccups?"

Check your Huckleberry app - activities should be logged automatically!

## Project Structure

```
abby/
├── apps/
│   └── abby/                    # Main application
│       ├── src/
│       │   ├── server.ts        # Twilio + WebSocket handling
│       │   ├── agent.ts         # Abby's personality & tools
│       │   └── mcp/
│       │       └── huckleberry_server.py  # MCP server for Huckleberry
│       ├── .env                 # Your API keys (DO NOT COMMIT)
│       └── package.json
│
├── specs/                       # Documentation
│   ├── ARCHITECTURE.md          # Detailed technical architecture
│   ├── SETUP.md                 # Complete setup guide
│   ├── DEPLOYMENT.md            # Production deployment options
│   └── huckleberry_api/         # Huckleberry API Python client
│
├── .claude/
│   └── skills/
│       └── prime.md             # /prime skill for Claude Code
│
└── README.md                    # You are here!
```

## Documentation

- **[ARCHITECTURE.md](specs/ARCHITECTURE.md)** - Complete technical architecture and data flow
- **[SETUP.md](specs/SETUP.md)** - Detailed setup, troubleshooting, and development guide
- **[DEPLOYMENT.md](specs/DEPLOYMENT.md)** - Production deployment options (Railway, Fly.io, etc.)
- **[/prime skill](.claude/skills/prime.md)** - Claude Code skill for project context

## Customizing Abby

### Change Abby's Personality

Edit `apps/abby/src/agent.ts` → `AGENT_INSTRUCTIONS`:

```typescript
export const AGENT_INSTRUCTIONS = `You are Abby, a warm and knowledgeable...`;
```

### Change Abby's Voice

Edit `apps/abby/src/agent.ts` → `SESSION_CONFIG.voice`:

```typescript
voice: 'alloy'  // Options: alloy, echo, fable, onyx, nova, shimmer
```

### Add New Tracking Features

1. Add tool definition in `src/agent.ts` → `TOOLS`
2. Add handler in `src/agent.ts` → `handleFunctionCall()`
3. If logging to Huckleberry, add MCP tool in `src/mcp/huckleberry_server.py`

See [ARCHITECTURE.md](specs/ARCHITECTURE.md) for detailed instructions.

## Testing

```bash
# Test MCP connection
cd apps/abby
npm test

# Check server health
curl http://localhost:3002/health

# View logs
tail -f data/logs/*.jsonl
```

## Deployment

Currently runs locally with ngrok. For 24/7 production deployment:

**Recommended Options:**
- **Fly.io** - Free tier, simple deployment ([Guide](specs/DEPLOYMENT.md#option-2-flyio-cost-effective))
- **Railway** - ~$5/month, auto-deploys from Git ([Guide](specs/DEPLOYMENT.md#option-1-railway-recommended-for-beginners))

See [DEPLOYMENT.md](specs/DEPLOYMENT.md) for complete deployment guides.

## Costs

### Development (using ngrok)
- OpenAI Realtime API: ~$0.06/minute of call time
- Twilio: ~$1/month for number + $0.0085/min
- ngrok: Free (or $8/month for static domain)
- Huckleberry: Free tier available
- **Total**: ~$1-5/month for light testing

### Production (deployed to cloud)
- Everything above, plus:
- Hosting (Railway/Fly.io): ~$5-10/month
- **Total**: ~$6-15/month for personal use

## Troubleshooting

### "Failed to initialize MCP"
- Check Python is installed and in PATH: `python --version`
- Verify Huckleberry credentials in `.env`
- Run `npm test` to test MCP connection

### Twilio can't reach webhook
- Ensure ngrok is running and shows "Session Status: online"
- Copy the HTTPS URL (not HTTP)
- Verify URL in Twilio exactly matches ngrok output

### No audio on call
- Check OpenAI API key is valid
- Verify you have credits in OpenAI account
- Check terminal logs for WebSocket connection

For more troubleshooting, see [SETUP.md](specs/SETUP.md#troubleshooting).

## Technology Stack

- **Backend**: Node.js + TypeScript + Express
- **AI**: OpenAI Realtime API (GPT-4o)
- **Telephony**: Twilio (Voice + Media Streams)
- **Baby Tracking**: Huckleberry API
- **Communication**: MCP (Model Context Protocol) for Node.js ↔ Python
- **Development**: ngrok for tunneling

## Roadmap

Future enhancements planned:
- [ ] Local database for learning from interactions
- [ ] Pattern recognition (sleep schedules, feeding patterns)
- [ ] Proactive insights ("Baby seems fussy around this time daily")
- [ ] Multi-baby support
- [ ] SMS interface alongside phone calls
- [ ] Web dashboard for visualizing data
- [ ] Voice biometrics (distinguish between parents)

## The Vision

Abby started as a simple tracking assistant, but the goal is to create an AI that truly **learns** from your unique parenting journey:

- Recognizes your baby's patterns
- Adapts advice to your parenting style
- Remembers conversations and builds context over time
- Provides personalized insights based on your specific situation
- Becomes more helpful the more you use it

Every conversation with Abby is a step toward that future.

## Contributing

This is a personal project built for my daughter Valya, but if you're building something similar or have ideas, feel free to:
- Open issues for bugs or questions
- Fork and adapt for your own use
- Share your experiences and improvements

## License

MIT - See LICENSE file

## Acknowledgments

Built with love for **Valya** 👶

Powered by:
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [Twilio Voice](https://www.twilio.com/voice)
- [Huckleberry](https://huckleberrycare.com/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

---

**Questions?** Open an issue or check the [documentation](specs/).

**Ready to deploy?** See [DEPLOYMENT.md](specs/DEPLOYMENT.md).

**Want to customize Abby?** See [ARCHITECTURE.md](specs/ARCHITECTURE.md).
