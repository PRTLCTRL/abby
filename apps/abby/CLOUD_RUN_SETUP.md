# Google Cloud Run Deployment Setup Guide

This guide walks you through deploying Abby to Google Cloud Run with automated CI/CD via GitHub Actions.

## Prerequisites

- Google Cloud account with billing enabled
- gcloud CLI installed: https://cloud.google.com/sdk/docs/install
- GitHub repository with push access
- Your Huckleberry credentials (email and password)
- Your OpenAI API key

## Step 1: GCP Project Setup

Run these commands in your terminal:

```bash
# Set variables (customize as needed)
export PROJECT_ID="abby-baby-coach"
export REGION="us-central1"
export SERVICE_NAME="abby-service"

# Create new GCP project
gcloud projects create ${PROJECT_ID} --name="Abby Baby Coach"

# Set as current project
gcloud config set project ${PROJECT_ID}

# Link billing account (required - do this via console first)
# Visit: https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}
# Then come back and continue...

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com

echo "✅ Project setup complete!"
```

## Step 2: Create Artifact Registry Repository

```bash
# Create Docker repository for container images
gcloud artifacts repositories create abby-repo \
  --repository-format=docker \
  --location=${REGION} \
  --description="Abby container images"

echo "✅ Artifact Registry created!"
```

## Step 3: Create Service Accounts

### 3.1 GitHub Actions Deployer Service Account

```bash
# Create service account for GitHub Actions
gcloud iam service-accounts create abby-deployer \
  --display-name="Abby GitHub Actions Deployer"

export DEPLOYER_SA="abby-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant necessary permissions
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${DEPLOYER_SA}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${DEPLOYER_SA}" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${DEPLOYER_SA}" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${DEPLOYER_SA}" \
  --role="roles/secretmanager.secretAccessor"

# Create and download key for GitHub Actions
gcloud iam service-accounts keys create abby-deployer-key.json \
  --iam-account=${DEPLOYER_SA}

echo "✅ Deployer service account created!"
echo "📋 Save the contents of abby-deployer-key.json - you'll need it for GitHub Secrets"
```

### 3.2 Cloud Run Runtime Service Account

```bash
# Create service account for Cloud Run runtime
gcloud iam service-accounts create abby-runtime \
  --display-name="Abby Cloud Run Runtime"

export RUNTIME_SA="abby-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant Firestore access (needed for Huckleberry API)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/datastore.user"

echo "✅ Runtime service account created!"
```

## Step 4: Setup Secret Manager

```bash
# Create secrets (replace with your actual values)
echo -n "YOUR_OPENAI_API_KEY_HERE" | gcloud secrets create OPENAI_API_KEY \
  --data-file=- \
  --replication-policy="automatic"

echo -n "your-huckleberry-email@example.com" | gcloud secrets create HUCKLE_USER_ID \
  --data-file=- \
  --replication-policy="automatic"

echo -n "your-huckleberry-password" | gcloud secrets create HUCKLE_PW \
  --data-file=- \
  --replication-policy="automatic"

# Grant Cloud Run service access to secrets
for secret in OPENAI_API_KEY HUCKLE_USER_ID HUCKLE_PW; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor"
done

echo "✅ Secrets created and configured!"
```

## Step 5: Configure GitHub Repository

### 5.1 Add Repository Secrets

Go to your GitHub repository:
1. Settings → Secrets and variables → Actions → New repository secret

Add these **3 secrets**:

| Secret Name | Value | Where to Find |
|------------|-------|---------------|
| `GCP_PROJECT_ID` | `abby-baby-coach` (or your PROJECT_ID) | From Step 1 |
| `GCP_SA_KEY` | Contents of `abby-deployer-key.json` | From Step 3.1 (entire JSON) |
| `GCP_REGION` | `us-central1` | From Step 1 |

### 5.2 Verify GitHub Actions Workflow

The workflow file `.github/workflows/deploy-abby.yml` should already exist in your repo (created by Claude).

It will automatically trigger on:
- Push to `main` branch
- Changes to `apps/abby/**` or `specs/**` directories

## Step 6: Deploy!

### Option A: Trigger via Git Push (Recommended)

```bash
# Commit and push the deployment files
git add .
git commit -m "Add Cloud Run deployment configuration

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin main
```

Then:
1. Go to GitHub → Actions tab
2. Watch the "Deploy Abby to Cloud Run" workflow
3. Wait for build and deployment to complete (~5-10 minutes)

### Option B: Manual Deployment (Testing)

If you want to test locally first:

```bash
# Build Docker image locally
docker build -t abby-test -f apps/abby/Dockerfile .

# Run locally to test
docker run -p 8080:8080 \
  -e OPENAI_API_KEY="your-key" \
  -e HUCKLE_USER_ID="your-email" \
  -e HUCKLE_PW="your-password" \
  abby-test

# Test health endpoint
curl http://localhost:8080/health
```

## Step 7: Get Your Cloud Run URL

After deployment completes:

```bash
# Get the deployed service URL
gcloud run services describe ${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --format 'value(status.url)'

# Example output: https://abby-service-abc123-uc.a.run.app
```

Save this URL - you'll need it for Twilio configuration.

## Step 8: Configure Twilio Webhook

1. Log into Twilio Console: https://console.twilio.com/
2. Navigate to: **Phone Numbers → Manage → Active numbers**
3. Click your Abby phone number
4. Under "Voice Configuration":
   - **A Call Comes In**: Webhook
   - **URL**: `https://abby-service-xxxxx-uc.a.run.app/incoming-call` (your Cloud Run URL)
   - **HTTP**: POST
5. Click **Save configuration**

## Step 9: Test Your Deployment

### 9.1 Health Check

```bash
# Replace with your actual service URL
curl https://abby-service-xxxxx-uc.a.run.app/health

# Expected response:
# {"status":"healthy","service":"abby","port":8080}
```

### 9.2 Test Phone Call

1. Call your Twilio number
2. Verify Abby answers and greets you
3. Try logging an activity: "Baby just slept for 2 hours"
4. Check Huckleberry app to verify it was logged

### 9.3 Check Logs

```bash
# Stream Cloud Run logs
gcloud run services logs tail ${SERVICE_NAME} --region ${REGION}

# Look for:
# - "🍓 MCP client connected to Huckleberry server"
# - "📞 Stream started"
# - "✅ Logged sleep"
```

### 9.4 Test Dashboard API

```bash
# Replace with your phone number and service URL
curl https://abby-service-xxxxx-uc.a.run.app/api/conversations/+1234567890
```

## Monitoring & Maintenance

### View Logs

```bash
# Real-time logs
gcloud run services logs tail ${SERVICE_NAME} --region ${REGION}

# Error logs only
gcloud run services logs read ${SERVICE_NAME} \
  --region ${REGION} \
  --filter="severity>=ERROR" \
  --limit 50
```

### View Metrics

Visit: https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}/metrics?project=${PROJECT_ID}

### Update Secrets

```bash
# Update a secret (e.g., if you change your OpenAI key)
echo -n "NEW_API_KEY" | gcloud secrets versions add OPENAI_API_KEY --data-file=-

# Cloud Run will automatically use the latest version on next cold start
```

### Rollback Deployment

```bash
# List revisions
gcloud run revisions list --service ${SERVICE_NAME} --region ${REGION}

# Rollback to previous revision
gcloud run services update-traffic ${SERVICE_NAME} \
  --region ${REGION} \
  --to-revisions PREVIOUS_REVISION_NAME=100
```

## Cost Management

### Estimated Monthly Costs

Based on 50 calls/month, 5 min average:
- **Cloud Run**: $5-10/month (mostly idle)
- **Secret Manager**: $0.30/month
- **Artifact Registry**: $0.10/month
- **Total**: ~$5-15/month

### Set Budget Alert

```bash
# Get your billing account ID first
gcloud billing accounts list

# Create budget alert (replace BILLING_ACCOUNT_ID)
gcloud billing budgets create \
  --billing-account BILLING_ACCOUNT_ID \
  --display-name "Abby Monthly Budget" \
  --budget-amount 20 \
  --threshold-rule percent=80 \
  --threshold-rule percent=100
```

## Troubleshooting

### Build Fails

```bash
# Check build logs
gcloud builds list --limit 5
gcloud builds log BUILD_ID
```

### Service Won't Start

```bash
# Check service logs
gcloud run services logs read ${SERVICE_NAME} --limit 100

# Common issues:
# - Missing environment variables (check secrets)
# - Python subprocess fails (check PATH)
# - Port mismatch (should be 8080)
```

### MCP Connection Fails

```bash
# Check for "MCP client connected" in logs
gcloud run services logs read ${SERVICE_NAME} --limit 100 | grep MCP

# If missing:
# - Verify Python is installed in container
# - Check specs/huckleberry_api is in container
# - Verify HUCKLE_USER_ID and HUCKLE_PW secrets
```

### Twilio Timeout

- Increase timeout: `--timeout 600` in workflow
- Consider setting min-instances=1 to avoid cold starts:

```bash
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --min-instances 1
```

## Advanced Configuration

### Increase Memory/CPU

If you experience performance issues:

```bash
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --memory 2Gi \
  --cpu 2
```

### Enable Container Insights

```bash
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --cpu-boost \
  --cpu-throttling
```

### Custom Domain

1. Verify domain ownership in GCP
2. Map domain to Cloud Run service:

```bash
gcloud run domain-mappings create \
  --service ${SERVICE_NAME} \
  --domain abby.yourdomain.com \
  --region ${REGION}
```

## Cleanup (If Needed)

To completely remove the deployment:

```bash
# Delete Cloud Run service
gcloud run services delete ${SERVICE_NAME} --region ${REGION}

# Delete Artifact Registry repository
gcloud artifacts repositories delete abby-repo --location ${REGION}

# Delete secrets
gcloud secrets delete OPENAI_API_KEY
gcloud secrets delete HUCKLE_USER_ID
gcloud secrets delete HUCKLE_PW

# Delete service accounts
gcloud iam service-accounts delete ${DEPLOYER_SA}
gcloud iam service-accounts delete ${RUNTIME_SA}

# Delete project (WARNING: irreversible!)
gcloud projects delete ${PROJECT_ID}
```

## Next Steps

- Set up monitoring alerts for 5xx errors
- Configure uptime checks
- Add custom domain
- Implement conversation backups to Cloud Storage
- Set up Cloud Scheduler for periodic health checks

## Support

- Cloud Run docs: https://cloud.google.com/run/docs
- GitHub Actions logs: Check the Actions tab in your repository
- Twilio status: https://status.twilio.com/

---

**Deployed!** Your Abby baby coach is now running on Google Cloud Run! 🎉
