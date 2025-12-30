"""
Reddit Parenting Tips Service - REST API for fetching parenting tips

Fetches posts from parenting subreddits and provides them to Abby.
Read-only, no posting or commenting.
"""

import os
import random
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
import praw
from datetime import datetime, timedelta
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Reddit Parenting Tips Service", version="1.0.0")

# Parenting subreddits to monitor (North America + worldwide)
SUBREDDITS = [
    "NewParents",       # Newborn-specific advice
    "Parenting",        # General parenting
    "beyondthebump",    # Postpartum and early parenting
    "ScienceBasedParenting",  # Evidence-based advice
    "sleeptrain",       # Sleep training tips
    "daddit",           # Dad community
    "Mommit",           # Mom community
    "breastfeeding",    # Breastfeeding advice
    "FormulaFeeders",   # Formula feeding
    "workingmoms",      # Working parent tips
]

# Reddit API client
reddit: Optional[praw.Reddit] = None

# Cache for tips
tips_cache = {
    "tips": [],
    "last_updated": None,
    "cache_duration_hours": 6
}


def init_reddit():
    """Initialize Reddit API client."""
    global reddit

    client_id = os.getenv("REDDIT_CLIENT_ID")
    client_secret = os.getenv("REDDIT_CLIENT_SECRET")
    user_agent = os.getenv("REDDIT_USER_AGENT", "AbbyBabyCoach/1.0")

    if not client_id or not client_secret:
        raise ValueError("Missing REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET")

    logger.info(f"Initializing Reddit API client (user agent: {user_agent})")

    reddit = praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent
    )

    logger.info("✅ Reddit API initialized (read-only mode)")


@app.on_event("startup")
async def startup_event():
    """Initialize Reddit on startup."""
    try:
        init_reddit()
        logger.info("Reddit service started successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Reddit: {e}")
        # Don't exit - let health check fail instead


@app.get("/health")
async def health():
    """Health check endpoint."""
    if reddit is None:
        raise HTTPException(status_code=503, detail="Reddit API not initialized")
    return {
        "status": "healthy",
        "subreddits": len(SUBREDDITS),
        "cached_tips": len(tips_cache["tips"])
    }


class RedditTip(BaseModel):
    title: str
    subreddit: str
    url: str
    score: int
    num_comments: int
    created_utc: int
    selftext: Optional[str] = None
    category: str  # "sleep", "feeding", "development", "general"


def categorize_post(title: str, selftext: str, subreddit: str) -> str:
    """Categorize post based on content."""
    content = (title + " " + (selftext or "")).lower()

    if subreddit.lower() in ["sleeptrain"] or any(word in content for word in ["sleep", "nap", "bedtime", "wake"]):
        return "sleep"
    elif subreddit.lower() in ["breastfeeding", "formulafeeders"] or any(word in content for word in ["feed", "bottle", "breast", "formula", "milk"]):
        return "feeding"
    elif any(word in content for word in ["milestone", "development", "crawl", "walk", "talk", "growth"]):
        return "development"
    else:
        return "general"


def fetch_tips_from_reddit(time_filter="week", limit=50) -> List[RedditTip]:
    """Fetch tips from all subreddits."""
    if not reddit:
        raise HTTPException(status_code=503, detail="Reddit not initialized")

    all_tips = []

    for subreddit_name in SUBREDDITS:
        try:
            logger.info(f"Fetching from r/{subreddit_name}")
            subreddit = reddit.subreddit(subreddit_name)

            # Fetch top posts from the past week
            for post in subreddit.top(time_filter=time_filter, limit=limit // len(SUBREDDITS)):
                # Filter for quality (min score and comments)
                if post.score >= 10 and post.num_comments >= 3:
                    tip = RedditTip(
                        title=post.title,
                        subreddit=subreddit_name,
                        url=f"https://reddit.com{post.permalink}",
                        score=post.score,
                        num_comments=post.num_comments,
                        created_utc=int(post.created_utc),
                        selftext=post.selftext[:500] if post.selftext else None,  # Limit length
                        category=categorize_post(post.title, post.selftext or "", subreddit_name)
                    )
                    all_tips.append(tip)

        except Exception as e:
            logger.error(f"Error fetching from r/{subreddit_name}: {e}")
            continue

    # Sort by score (popularity)
    all_tips.sort(key=lambda x: x.score, reverse=True)

    logger.info(f"Fetched {len(all_tips)} tips from Reddit")
    return all_tips


def update_cache_if_needed():
    """Update cache if it's stale."""
    now = datetime.now()
    cache_age = tips_cache.get("last_updated")

    if cache_age is None or (now - cache_age) > timedelta(hours=tips_cache["cache_duration_hours"]):
        logger.info("Cache is stale, refreshing...")
        tips_cache["tips"] = fetch_tips_from_reddit()
        tips_cache["last_updated"] = now
    else:
        logger.info(f"Using cached tips ({len(tips_cache['tips'])} tips)")


@app.get("/recent-tips", response_model=List[RedditTip])
async def get_recent_tips(
    category: Optional[str] = Query(None, description="Filter by category: sleep, feeding, development, general"),
    limit: int = Query(20, ge=1, le=100, description="Number of tips to return")
):
    """Get recent parenting tips from Reddit."""
    update_cache_if_needed()

    tips = tips_cache["tips"]

    # Filter by category if specified
    if category:
        tips = [tip for tip in tips if tip.category == category]

    return tips[:limit]


@app.get("/random-tip", response_model=RedditTip)
async def get_random_tip(
    category: Optional[str] = Query(None, description="Filter by category")
):
    """Get a random parenting tip."""
    update_cache_if_needed()

    tips = tips_cache["tips"]

    if not tips:
        raise HTTPException(status_code=404, detail="No tips available")

    # Filter by category if specified
    if category:
        filtered_tips = [tip for tip in tips if tip.category == category]
        if not filtered_tips:
            raise HTTPException(status_code=404, detail=f"No tips found for category: {category}")
        tips = filtered_tips

    return random.choice(tips)


@app.get("/search-tips", response_model=List[RedditTip])
async def search_tips(
    query: str = Query(..., min_length=3, description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Number of results")
):
    """Search tips by keyword."""
    update_cache_if_needed()

    query_lower = query.lower()
    matching_tips = [
        tip for tip in tips_cache["tips"]
        if query_lower in tip.title.lower() or (tip.selftext and query_lower in tip.selftext.lower())
    ]

    return matching_tips[:limit]


@app.get("/categories")
async def get_categories():
    """Get available categories with counts."""
    update_cache_if_needed()

    categories = {}
    for tip in tips_cache["tips"]:
        categories[tip.category] = categories.get(tip.category, 0) + 1

    return {
        "categories": categories,
        "total_tips": len(tips_cache["tips"])
    }


@app.post("/refresh-cache")
async def refresh_cache():
    """Manually refresh the tips cache."""
    logger.info("Manual cache refresh requested")
    tips_cache["tips"] = fetch_tips_from_reddit()
    tips_cache["last_updated"] = datetime.now()

    return {
        "success": True,
        "tips_count": len(tips_cache["tips"]),
        "timestamp": tips_cache["last_updated"].isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8082))
    uvicorn.run(app, host="0.0.0.0", port=port)
