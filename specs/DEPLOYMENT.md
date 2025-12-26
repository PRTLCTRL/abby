# Abby - Deployment Guide

## Overview

This guide covers deploying Abby to production so it runs 24/7 without requiring ngrok or a local machine.

## Deployment Options

### Option 1: Railway (Recommended for Beginners)

**Pros**: Simple, automatic deployments from Git, built-in domain

**Cons**: Paid service (free tier available)

**Steps**:

1. **Sign up at Railway**: https://railway.app/

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Authorize Railway to access your repo
   - Select `PRTLCTRL/abby`

3. **Configure Service**:
   ```
   Name: abby-server
   Root Directory: /apps/abby
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

4. **Add Environment Variables**:
   - Go to Variables tab
   - Add each variable from your `.env`:
     - `OPENAI_API_KEY`
     - `HUCKLE_USER_ID`
     - `HUCKLE_PW`
     - `PORT=3002`

5. **Deploy**:
   - Railway auto-deploys on push to main branch
   - Get your Railway URL: `https://abby-server-production.up.railway.app`

6. **Update Twilio**:
   - Go to Twilio Console → Your Number
   - Set webhook: `https://your-railway-url/incoming-call`

### Option 2: Fly.io (Cost-Effective)

**Pros**: Generous free tier, good performance, global deployment

**Cons**: Requires CLI familiarity

**Steps**:

1. **Install Fly CLI**:
   ```bash
   # macOS/Linux
   curl -L https://fly.io/install.sh | sh

   # Windows
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```

2. **Login**:
   ```bash
   fly auth login
   ```

3. **Create Fly App**:
   ```bash
   cd apps/abby
   fly launch
   ```

   Answer prompts:
   - App name: `abby-server` (or auto-generate)
   - Region: Choose closest to you
   - Postgres: No
   - Redis: No

4. **Create `Dockerfile`** in `apps/abby/`:
   ```dockerfile
   FROM node:18-alpine

   # Install Python for MCP server
   RUN apk add --no-cache python3 py3-pip

   WORKDIR /app

   # Copy package files
   COPY package*.json ./

   # Install Node dependencies
   RUN npm ci --only=production

   # Copy application code
   COPY . .

   # Install Python dependencies
   RUN pip3 install mcp requests python-dotenv

   # Build TypeScript
   RUN npm run build

   # Expose port
   EXPOSE 3002

   # Start server
   CMD ["npm", "start"]
   ```

5. **Set Secrets**:
   ```bash
   fly secrets set OPENAI_API_KEY=sk-proj-...
   fly secrets set HUCKLE_USER_ID=your-email@example.com
   fly secrets set HUCKLE_PW=your-password
   ```

6. **Deploy**:
   ```bash
   fly deploy
   ```

7. **Get URL**:
   ```bash
   fly status
   # URL: https://abby-server.fly.dev
   ```

8. **Update Twilio**: Set webhook to Fly.io URL

### Option 3: AWS Lambda (Advanced)

**Pros**: Pay-per-use, highly scalable

**Cons**: More complex setup, WebSocket requires API Gateway

**Note**: Lambda is more complex for real-time WebSocket applications. Consider using AWS ECS (Elastic Container Service) instead for simpler deployment.

**Steps** (ECS approach):

1. Containerize with Docker (see Dockerfile from Fly.io option)
2. Push to Amazon ECR (Elastic Container Registry)
3. Create ECS Service with Fargate
4. Configure Application Load Balancer
5. Set environment variables in ECS Task Definition
6. Update Twilio webhook to ALB URL

Detailed AWS guide: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/getting-started.html

### Option 4: Google Cloud Run

**Pros**: Automatic scaling, pay-per-use, simple container deployment

**Cons**: Requires GCP account

**Steps**:

1. **Install Google Cloud CLI**:
   ```bash
   # See: https://cloud.google.com/sdk/docs/install
   ```

2. **Login and Set Project**:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Build and Deploy**:
   ```bash
   cd apps/abby
   gcloud run deploy abby-server \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

4. **Set Environment Variables**:
   ```bash
   gcloud run services update abby-server \
     --set-env-vars OPENAI_API_KEY=sk-proj-... \
     --set-env-vars HUCKLE_USER_ID=email@example.com \
     --set-env-vars HUCKLE_PW=password
   ```

5. **Update Twilio**: Use Cloud Run URL

## Environment Variable Management

### Development
- Use `.env` files (gitignored)
- Never commit secrets

### Production
Use platform-specific secret managers:

**Railway**:
- Variables tab in dashboard

**Fly.io**:
```bash
fly secrets set KEY=value
```

**AWS**:
- Use AWS Secrets Manager
- Reference in ECS Task Definition

**Google Cloud**:
```bash
gcloud run services update abby-server --set-env-vars KEY=value
```

**Best Practice**: Use secret managers (AWS Secrets Manager, Google Secret Manager, HashiCorp Vault)

## Required Environment Variables

All platforms need these:

```env
OPENAI_API_KEY=sk-proj-xxx
HUCKLE_USER_ID=your-email@example.com
HUCKLE_PW=your-password
PORT=3002
```

Optional (for reference):
```env
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
```

## Post-Deployment Checklist

- [ ] Service is running and healthy
- [ ] Health check passes: `curl https://your-url/health`
- [ ] Twilio webhook updated to production URL
- [ ] Test call successfully connects
- [ ] Abby greets caller
- [ ] Activity logging works (check Huckleberry app)
- [ ] Logs are accessible (platform logging dashboard)
- [ ] Set up monitoring/alerts
- [ ] Document production URL in team docs

## Monitoring & Logging

### Railway
- Built-in logging dashboard
- Metrics: CPU, memory, network
- Set up email alerts for downtime

### Fly.io
```bash
# View logs
fly logs

# Monitor status
fly status

# Scale instances
fly scale count 2
```

### AWS ECS
- CloudWatch Logs for application logs
- CloudWatch Metrics for resource usage
- Set up CloudWatch Alarms for errors/downtime

### Google Cloud Run
```bash
# View logs
gcloud logging read "resource.type=cloud_run_revision"

# Monitor
gcloud run services describe abby-server
```

## Scaling Considerations

### Current Limitations
- **Single concurrent call**: One WebSocket connection at a time
- **No session management**: Stateful WebSocket connections
- **MCP subprocess**: One per server instance

### To Support Multiple Concurrent Calls

1. **Session Management**:
   - Implement session store (Redis)
   - Track active calls by `streamSid` or `callSid`
   - Create new OpenAI WebSocket per call

2. **Architecture Changes**:
   ```typescript
   // Current: Single WebSocket
   let openaiWs = null;

   // Multi-call: Map of WebSockets
   const sessions = new Map<string, {
     openaiWs: WebSocket,
     twilioWs: WebSocket,
     phoneNumber: string
   }>();
   ```

3. **MCP Server**:
   - Option A: Shared MCP server (single subprocess)
   - Option B: MCP server pool
   - Option C: Deploy MCP as separate service with HTTP API

4. **Horizontal Scaling**:
   - Load balancer (if MCP is shared service)
   - Sticky sessions (if MCP is per-instance subprocess)

## Troubleshooting Production Issues

### Health Check Fails

**Check**:
1. Service is running
2. Port is correct (3002 or environment `PORT`)
3. Firewall allows traffic

**Debug**:
```bash
# Railway
railway logs

# Fly.io
fly logs

# Check health endpoint
curl https://your-url/health
```

### Twilio Can't Reach Webhook

**Common Issues**:
1. URL is HTTP instead of HTTPS (must be HTTPS)
2. URL has typo
3. Service is down
4. Firewall blocks Twilio IPs

**Test**:
```bash
curl -X POST https://your-url/incoming-call \
  -d "CallSid=test" \
  -d "From=+1234567890"
```

### MCP Server Fails to Start

**Check**:
1. Python is available in container
2. Python dependencies installed (`mcp`, `requests`, `python-dotenv`)
3. Huckleberry credentials correct
4. `specs/huckleberry_api/` is included in deployment

**Fix**:
- Add Python to Dockerfile
- Add pip install step
- Verify deployment includes all files (not just `apps/abby/`)

### OpenAI Connection Issues

**Check**:
1. API key is valid
2. API key has credits
3. Realtime API access enabled
4. Network allows outbound WebSocket connections

**Monitor**:
- Check OpenAI usage dashboard
- Look for 401/403 errors in logs

## Cost Estimates

### Railway
- Free tier: $5 credit/month
- Paid: ~$5-20/month for hobby use

### Fly.io
- Free tier: 3 shared VMs
- Paid: ~$2-10/month for light use

### AWS ECS (Fargate)
- ~$15-30/month for 24/7 operation
- Pay-per-hour pricing

### Google Cloud Run
- Free tier: 2 million requests/month
- ~$5-15/month for hobby use

### Additional Costs
- **Twilio**: ~$1/month for phone number + $0.0085/min for calls
- **OpenAI**: Realtime API pricing per minute of audio

## Security Hardening

### Production Best Practices

1. **API Keys**:
   - Use secret managers (not environment variables)
   - Rotate keys regularly
   - Use separate keys for prod/dev

2. **Network Security**:
   - Firewall: Allow only Twilio IPs for webhooks
   - Use HTTPS only
   - Enable rate limiting

3. **Logging**:
   - Don't log sensitive data (API keys, passwords, phone numbers)
   - Sanitize logs before external storage
   - Enable audit logs

4. **Error Handling**:
   - Don't expose internal errors to callers
   - Return generic error messages
   - Log detailed errors internally

5. **Dependencies**:
   - Regularly update npm/pip packages
   - Monitor for security vulnerabilities
   - Use `npm audit` and `pip check`

## Continuous Deployment

### GitHub Actions (Example)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Deploy
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

Or use platform-specific deployment:
- **Railway**: Automatic on git push
- **Fly.io**: `fly deploy` in CI
- **AWS**: CodePipeline
- **GCP**: Cloud Build

## Backup & Disaster Recovery

### Data to Backup
- **Call logs**: `data/logs/*.jsonl` (if using local storage)
- **Environment config**: Document all environment variables
- **Code**: GitHub repo (already backed up)

### Recommendations
1. **Use cloud storage** for logs (S3, GCS, etc.)
2. **Document secrets** securely (password manager, secret manager)
3. **Tag releases** in Git for rollback capability
4. **Monitor uptime** (UptimeRobot, Pingdom, etc.)

## Next Steps After Deployment

1. **Test thoroughly**: Make multiple test calls
2. **Monitor for a week**: Check logs daily for errors
3. **Set up alerts**: Email/SMS for downtime
4. **Document for team**: Share production URL and credentials
5. **Plan scaling**: If usage grows, implement multi-call support
6. **Consider backups**: Set up automated backups for logs

## Getting Help

- **Platform docs**:
  - Railway: https://docs.railway.app/
  - Fly.io: https://fly.io/docs/
  - AWS: https://docs.aws.amazon.com/
  - GCP: https://cloud.google.com/docs/

- **GitHub Issues**: https://github.com/PRTLCTRL/abby/issues

- **Check logs first**: Most issues show up in platform logs

---

**Recommended Starting Point**: Railway or Fly.io for simplicity and cost-effectiveness.
