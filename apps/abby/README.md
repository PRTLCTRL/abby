# Abby - Newborn Baby Coach

AI-powered phone assistant for new parents using Twilio + OpenAI Realtime API.

## Quick Start

Run everything with one command from Abby's directory:

\`\`\`bash
cd apps/abby
npm run all
\`\`\`

This starts:
- Abby server (port 3002)
- Huckleberry microservice (port 3003)
- Ngrok tunnel

Then call **+1 (917) 905-1534** and say things like:
- "Baby just napped for 2 hours"
- "Changed a wet diaper"
- "Fed 4 ounces"

Abby will automatically log everything to Huckleberry!

## Available Scripts

| Script | What it does |
|--------|-------------|
| \`npm run all\` | **Run everything** (Abby + Huckleberry + ngrok) |
| \`npm run all:dev\` | Run Abby + Huckleberry (no ngrok) |
| \`npm start\` | Run Abby only |
| \`npm run huckleberry\` | Run Huckleberry microservice only |
| \`npm run ngrok\` | Run ngrok tunnel only |

## Architecture

\`\`\`
apps/abby/
├── src/
│   ├── server.js          # Twilio WebSocket + HTTP
│   ├── agent.js           # Abby's brain (instructions, tools)
├── .env                    # Credentials
└── package.json
\`\`\`

See \`apps/ARCHITECTURE.md\` for full system architecture.
