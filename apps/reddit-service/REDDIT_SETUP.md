# Reddit API Setup Instructions

The Reddit service requires Reddit API credentials to fetch posts.

## Step 1: Create a Reddit App

1. Go to https://www.reddit.com/prefs/apps
2. Click "create app" or "create another app"
3. Fill in the form:
   - **name**: Abby Baby Coach
   - **App type**: Select "script"
   - **description**: Read-only app for fetching parenting tips
   - **about url**: (leave blank)
   - **redirect uri**: http://localhost (not used, but required)
4. Click "create app"

## Step 2: Get Your Credentials

After creating the app, you'll see:
- **client_id**: The string under "personal use script" (e.g., `dj2...`)
- **client_secret**: The "secret" field (e.g., `xQ1...`)

## Step 3: Add to Secret Manager

```bash
# Add Reddit client ID
echo -n "YOUR_CLIENT_ID" | gcloud secrets create REDDIT_CLIENT_ID \
  --data-file=- \
  --project=abby-baby-coach

# Add Reddit client secret
echo -n "YOUR_CLIENT_SECRET" | gcloud secrets create REDDIT_CLIENT_SECRET \
  --data-file=- \
  --project=abby-baby-coach

# Add user agent (optional, has default)
echo -n "AbbyBabyCoach/1.0 by /u/YOUR_REDDIT_USERNAME" | gcloud secrets create REDDIT_USER_AGENT \
  --data-file=- \
  --project=abby-baby-coach

# Grant access to runtime service account
for SECRET in REDDIT_CLIENT_ID REDDIT_CLIENT_SECRET REDDIT_USER_AGENT; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:abby-runtime@abby-baby-coach.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

## Step 4: Deploy

The service will be deployed automatically via `cloudbuild-reddit.yaml`.

## Subreddits Monitored

The service fetches tips from these parenting subreddits:

**Newborn-Specific:**
- r/NewParents - Newborn-specific advice
- r/beyondthebump - Postpartum and early parenting

**General Parenting:**
- r/Parenting - General parenting advice
- r/ScienceBasedParenting - Evidence-based advice
- r/daddit - Dad community
- r/Mommit - Mom community

**Topic-Specific:**
- r/sleeptrain - Sleep training tips
- r/breastfeeding - Breastfeeding advice
- r/FormulaFeeders - Formula feeding tips
- r/workingmoms - Working parent advice

## API Endpoints

Once deployed:

- `GET /health` - Health check
- `GET /recent-tips?category=sleep&limit=20` - Get recent tips
- `GET /random-tip?category=feeding` - Get random tip
- `GET /search-tips?query=sleep` - Search tips
- `GET /categories` - Get tip categories with counts
- `POST /refresh-cache` - Manually refresh cache

## Categories

Tips are automatically categorized:
- **sleep** - Sleep, naps, bedtime
- **feeding** - Breastfeeding, formula, bottles
- **development** - Milestones, growth
- **general** - Everything else

## Cache

- Tips are cached for **6 hours** to reduce API calls
- Cache refreshes automatically when stale
- Manual refresh available via `/refresh-cache` endpoint
