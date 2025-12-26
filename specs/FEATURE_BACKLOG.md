# Abby - Feature Backlog

> **Living document of planned features and enhancements**
>
> Each feature includes detailed specs, implementation approach, and complexity estimates to guide future development.

---

## Table of Contents

1. [Pattern Recognition System](#1-pattern-recognition-system)
2. [Proactive Insights Engine](#2-proactive-insights-engine)
3. [Historical Trends Analysis](#3-historical-trends-analysis)
4. [Predictive Modeling](#4-predictive-modeling)
5. [Reddit Community Integration](#5-reddit-community-integration)
6. [Conversation Memory & Learning](#6-conversation-memory--learning)
7. [Multi-Child Support](#7-multi-child-support)
8. [SMS/Text Interface](#8-smstext-interface)
9. [Web Dashboard](#9-web-dashboard)
10. [Voice Biometrics](#10-voice-biometrics)

---

## 1. Pattern Recognition System

**Status**: 📋 Planned
**Complexity**: 🔴 Large
**Priority**: High
**Dependencies**: Local database, data collection pipeline

### Overview

Analyze Valya's activities over time to identify patterns in sleep, feeding, and behavior. Recognize correlations between activities (e.g., "fussy 2 hours after feeding" or "sleeps longer after afternoon feeds").

### User Stories

- **As a parent**, I want Abby to recognize when Valya typically gets fussy, so I can prepare in advance
- **As a parent**, I want to know if Valya's sleep patterns are changing, so I can adjust our routine
- **As a parent**, I want Abby to notice correlations I might miss, so I can better understand my baby's needs

### Technical Approach

#### Data Requirements

**New Database Schema**:
```sql
-- Store all activities with normalized timestamps
CREATE TABLE activities (
  id UUID PRIMARY KEY,
  child_uid VARCHAR NOT NULL,
  activity_type VARCHAR NOT NULL, -- 'sleep', 'feed', 'diaper', 'mood'
  start_timestamp INTEGER NOT NULL,
  end_timestamp INTEGER,
  duration INTEGER,
  metadata JSONB, -- Additional details (amount, type, notes)
  created_at TIMESTAMP DEFAULT NOW()
);

-- Store identified patterns
CREATE TABLE patterns (
  id UUID PRIMARY KEY,
  child_uid VARCHAR NOT NULL,
  pattern_type VARCHAR NOT NULL, -- 'sleep_schedule', 'feed_interval', 'behavior'
  description TEXT,
  confidence_score FLOAT, -- 0-1
  data JSONB, -- Pattern details (times, frequencies, etc.)
  first_detected TIMESTAMP,
  last_updated TIMESTAMP
);

-- Store pattern occurrences for validation
CREATE TABLE pattern_occurrences (
  id UUID PRIMARY KEY,
  pattern_id UUID REFERENCES patterns(id),
  occurred_at TIMESTAMP,
  matched BOOLEAN, -- Did pattern actually occur?
  notes TEXT
);
```

#### Implementation Steps

**Phase 1: Data Collection (2-3 weeks)**
1. Set up PostgreSQL or SQLite database
2. Create data sync pipeline: Huckleberry → local DB
3. Run hourly/daily sync to populate historical data
4. Store all activities with normalized timestamps

**Phase 2: Pattern Detection Algorithms (3-4 weeks)**

1. **Sleep Patterns**:
   ```python
   # Example: Detect typical nap times
   def detect_sleep_patterns(child_uid, days=14):
       activities = get_sleep_activities(child_uid, days)

       # Cluster nap start times
       nap_times = [a.start_time.hour + a.start_time.minute/60
                    for a in activities]

       # Use DBSCAN or K-means clustering
       clusters = cluster_times(nap_times, epsilon=1.5)  # 1.5 hour tolerance

       patterns = []
       for cluster in clusters:
           if len(cluster) >= days * 0.4:  # Occurs 40%+ of days
               avg_time = mean(cluster)
               patterns.append({
                   'type': 'regular_nap',
                   'time': avg_time,
                   'confidence': len(cluster) / days,
                   'description': f'Usually naps around {format_time(avg_time)}'
               })

       return patterns
   ```

2. **Feeding Intervals**:
   ```python
   def detect_feeding_intervals(child_uid, days=7):
       feeds = get_feed_activities(child_uid, days)

       # Calculate intervals between feeds
       intervals = []
       for i in range(len(feeds) - 1):
           interval = (feeds[i+1].start - feeds[i].start).total_seconds() / 3600
           intervals.append(interval)

       # Find modal interval (most common)
       modal_interval = mode(intervals, bandwidth=0.5)  # 30-min bins

       return {
           'type': 'feed_interval',
           'interval_hours': modal_interval,
           'confidence': calculate_confidence(intervals, modal_interval),
           'description': f'Usually feeds every {modal_interval:.1f} hours'
       }
   ```

3. **Behavioral Correlations**:
   ```python
   def detect_behavior_correlations(child_uid, days=14):
       # Example: Fussy times related to feeding
       fussy_logs = get_mood_logs(child_uid, mood='fussy', days=days)
       feeds = get_feed_activities(child_uid, days=days)

       correlations = []
       for fussy in fussy_logs:
           # Find nearest feed before this fussy period
           recent_feeds = [f for f in feeds if f.start < fussy.timestamp]
           if recent_feeds:
               last_feed = max(recent_feeds, key=lambda f: f.start)
               time_since_feed = (fussy.timestamp - last_feed.start).total_seconds() / 3600

               correlations.append(time_since_feed)

       if correlations:
           avg_time = mean(correlations)
           if std_dev(correlations) < 0.75:  # Consistent pattern
               return {
                   'type': 'fussy_after_feed',
                   'interval_hours': avg_time,
                   'confidence': 1 - (std_dev(correlations) / avg_time),
                   'description': f'Often fussy {avg_time:.1f} hours after feeding'
               }
   ```

**Phase 3: Pattern Storage & Retrieval (1 week)**
1. Save detected patterns to database
2. Track pattern accuracy over time
3. Update confidence scores as new data comes in
4. Expire stale patterns (>30 days without occurrence)

**Phase 4: Integration with Abby (1 week)**
1. Add patterns to call context (like current activity context)
2. Update Abby's instructions to mention patterns
3. Create MCP tool: `get_patterns(child_uid)` → returns active patterns
4. Include patterns in conversation context

#### Example Integration

```typescript
// In server.ts - extend context loading
const patternsResult = await handleFunctionCall(
  'get_patterns',
  { child_uid: child_uid },
  phoneNumber,
  saveParentUpdate
);

// Inject patterns into conversation
openaiWs.send(JSON.stringify({
  type: 'conversation.item.create',
  item: {
    type: 'message',
    role: 'system',
    content: [{
      type: 'input_text',
      text: `Recognized patterns for Valya:
${patternsResult.message}

Use these patterns to provide personalized insights and predictions.`
    }]
  }
}));
```

### Challenges

1. **Cold start problem**: Need 1-2 weeks of data before patterns emerge
2. **Babies change**: Patterns shift as baby grows (must detect pattern drift)
3. **False positives**: Random coincidences might look like patterns
4. **Statistical significance**: Need enough data points for confidence

### Success Metrics

- Pattern detection accuracy: >70% of predicted patterns actually occur
- User validation: Parents confirm patterns are meaningful
- Actionable insights: Patterns lead to helpful recommendations

---

## 2. Proactive Insights Engine

**Status**: 📋 Planned
**Complexity**: 🟡 Medium
**Priority**: High
**Dependencies**: Pattern Recognition System, Local Database

### Overview

Generate proactive insights based on current data vs. patterns/historical trends. Abby notices anomalies, changes, and interesting observations without being asked.

### User Stories

- **As a parent**, I want Abby to tell me if today is unusual (e.g., "baby is sleeping less than usual"), so I can adjust
- **As a parent**, I want Abby to celebrate positive changes (e.g., "sleeping through the night more often!"), so I feel encouraged
- **As a parent**, I want Abby to flag potential concerns early (e.g., "hasn't eaten in 4 hours, unusual for this time"), so I can address issues

### Technical Approach

#### Insight Types

1. **Anomaly Detection**:
   - "Today Valya has slept 2 hours less than her usual daily average"
   - "She's had 3 dirty diapers in the last 2 hours, more than typical"
   - "It's been 5 hours since last feeding - longer than usual"

2. **Positive Trends**:
   - "Great news! Valya has been sleeping 30 minutes longer per nap this week"
   - "She's going 4 hours between feeds consistently - up from 3 hours last week"
   - "Fewer nighttime wake-ups this week compared to last"

3. **Milestone Recognition**:
   - "First time sleeping through the night!"
   - "Longest nap ever recorded: 3.5 hours"
   - "One week of consistent 7pm bedtime"

4. **Gentle Reminders**:
   - "Based on her usual pattern, Valya typically eats around now"
   - "She usually naps in the next hour or so"
   - "Due for a diaper change soon based on today's schedule"

#### Implementation

**Insight Generation Service** (Python):
```python
class InsightEngine:
    def __init__(self, db, pattern_detector):
        self.db = db
        self.patterns = pattern_detector

    def generate_insights(self, child_uid, hours=24):
        insights = []

        # Get current state
        recent = self.get_recent_activity(child_uid, hours)
        patterns = self.patterns.get_active_patterns(child_uid)
        historical = self.get_historical_averages(child_uid, days=14)

        # Anomaly detection
        insights.extend(self.detect_anomalies(recent, historical))

        # Positive trends
        insights.extend(self.detect_positive_trends(recent, historical))

        # Milestones
        insights.extend(self.detect_milestones(recent))

        # Proactive reminders
        insights.extend(self.generate_reminders(recent, patterns))

        # Rank by importance
        insights.sort(key=lambda x: x['priority'], reverse=True)

        return insights[:5]  # Top 5 most important

    def detect_anomalies(self, recent, historical):
        insights = []

        # Sleep anomaly
        recent_sleep = sum(s['duration'] for s in recent['sleep'])
        avg_sleep = historical['avg_daily_sleep']

        if recent_sleep < avg_sleep * 0.7:  # 30% less sleep
            insights.append({
                'type': 'anomaly',
                'category': 'sleep',
                'priority': 8,
                'message': f'Valya has slept {recent_sleep//60} minutes today, '
                          f'about {int((1 - recent_sleep/avg_sleep)*100)}% less than her usual '
                          f'{avg_sleep//60} minutes. She might be extra tired.'
            })

        # Feeding anomaly
        last_feed = recent['feeds'][-1] if recent['feeds'] else None
        if last_feed:
            hours_since = (datetime.now() - last_feed['time']).total_seconds() / 3600
            avg_interval = historical['avg_feed_interval']

            if hours_since > avg_interval * 1.5:  # 50% longer than usual
                insights.append({
                    'type': 'anomaly',
                    'category': 'feeding',
                    'priority': 9,
                    'message': f'It has been {hours_since:.1f} hours since Valya last ate, '
                              f'longer than her usual {avg_interval:.1f} hour interval.'
                })

        return insights

    def detect_positive_trends(self, recent, historical):
        insights = []

        # Compare this week to last week
        this_week = self.get_week_stats(recent, offset=0)
        last_week = self.get_week_stats(historical, offset=7)

        # Sleep improvement
        if this_week['avg_sleep_per_session'] > last_week['avg_sleep_per_session'] * 1.1:
            improvement = this_week['avg_sleep_per_session'] - last_week['avg_sleep_per_session']
            insights.append({
                'type': 'positive_trend',
                'category': 'sleep',
                'priority': 6,
                'message': f'Great news! Valya is sleeping {improvement//60} minutes longer '
                          f'per nap this week compared to last week!'
            })

        return insights
```

**Add MCP Tool**:
```python
# In huckleberry_server.py
Tool(
    name="get_insights",
    description=f"Get proactive insights about {child_name}'s patterns and behaviors",
    inputSchema={
        "type": "object",
        "properties": {
            "hours": {
                "type": "number",
                "description": "Hours to analyze (default: 24)",
                "default": 24
            }
        }
    }
)
```

**Integrate into Conversations**:
```typescript
// Load insights alongside context
const insightsResult = await handleFunctionCall('get_insights', { hours: 24 });

// Abby can mention insights naturally:
// "Hi! Before we chat, I noticed Valya has been sleeping longer naps this week - that's wonderful!"
// "Just so you know, it's been about 4 hours since her last feeding, which is a bit longer than usual."
```

### Challenges

1. **Avoiding alarm**: Don't scare parents with false concerns
2. **Relevance**: Only show insights that are actionable or interesting
3. **Timing**: When to surface insights (call start? during conversation? only if asked?)
4. **Noise**: Too many insights → information overload

### Success Metrics

- Parents find insights helpful (survey/feedback)
- Insights lead to action (e.g., prompted a feeding)
- Low false alarm rate (<10% of anomaly alerts are false)

---

## 3. Historical Trends Analysis

**Status**: 📋 Planned
**Complexity**: 🟡 Medium
**Priority**: Medium
**Dependencies**: Local Database, Time-series analysis library

### Overview

Compare current behavior to historical data (week over week, month over month). Visualize trends and answer questions like "how is this week compared to last week?"

### User Stories

- **As a parent**, I want to compare this week's sleep to last week, so I can see if we're improving
- **As a parent**, I want to see feeding trends over time, so I can track growth phases
- **As a parent**, I want to know if this month has been different from last month

### Technical Approach

#### Time Windows for Comparison

- **Day vs. Day**: Today vs. yesterday
- **Week vs. Week**: This week vs. last week
- **Month vs. Month**: This month vs. last month
- **Age-based**: First month vs. second month, etc.

#### Metrics to Track

**Sleep**:
- Total sleep per day/week/month
- Average nap duration
- Longest sleep session
- Number of night wakings
- Bedtime consistency

**Feeding**:
- Feeds per day/week
- Average interval between feeds
- Total volume (if bottle feeding)
- Feeding duration (if breastfeeding)

**Diapers**:
- Total changes per day/week
- Wet vs. dirty ratio
- Unusual patterns (many in short time)

#### Implementation

**Trend Analysis Service**:
```python
class TrendAnalyzer:
    def compare_periods(self, child_uid, period_type='week'):
        """Compare current period to previous period."""

        if period_type == 'week':
            current = self.get_stats(child_uid, days=7, offset=0)
            previous = self.get_stats(child_uid, days=7, offset=7)
        elif period_type == 'month':
            current = self.get_stats(child_uid, days=30, offset=0)
            previous = self.get_stats(child_uid, days=30, offset=30)

        comparison = {
            'sleep': self._compare_metric(current['sleep'], previous['sleep']),
            'feeding': self._compare_metric(current['feeding'], previous['feeding']),
            'diapers': self._compare_metric(current['diapers'], previous['diapers'])
        }

        return self._format_comparison(comparison, period_type)

    def _compare_metric(self, current, previous):
        """Calculate percentage change and trend direction."""
        change = ((current - previous) / previous) * 100 if previous else 0

        return {
            'current': current,
            'previous': previous,
            'change_percent': change,
            'trend': 'up' if change > 5 else 'down' if change < -5 else 'stable'
        }

    def _format_comparison(self, comparison, period_type):
        """Format comparison into readable summary."""
        summary = f"Comparison: This {period_type} vs. last {period_type}\n\n"

        # Sleep
        sleep = comparison['sleep']
        summary += f"💤 Sleep: {sleep['current']:.0f} min/day "
        if sleep['trend'] == 'up':
            summary += f"(↑ {abs(sleep['change_percent']):.0f}% more)\n"
        elif sleep['trend'] == 'down':
            summary += f"(↓ {abs(sleep['change_percent']):.0f}% less)\n"
        else:
            summary += "(→ similar)\n"

        # Similar for feeding and diapers...

        return summary
```

**Answer Historical Questions**:
```python
# Example queries parents might ask:
def answer_trend_question(question, child_uid):
    """Use NLP to answer trend questions."""

    question_lower = question.lower()

    if 'last week' in question_lower or 'this week' in question_lower:
        return TrendAnalyzer().compare_periods(child_uid, 'week')

    if 'improving' in question_lower or 'getting better' in question_lower:
        trends = TrendAnalyzer().get_trends(child_uid, days=14)
        positive = [t for t in trends if t['trend'] == 'up' and t['category'] == 'sleep']
        return format_positive_trends(positive)

    if 'month' in question_lower:
        return TrendAnalyzer().compare_periods(child_uid, 'month')
```

### Challenges

1. **Newborns change fast**: Weekly comparisons might not be meaningful for young babies
2. **Growth spurts**: Temporary changes shouldn't be interpreted as long-term trends
3. **Data completeness**: Missing data can skew comparisons

### Success Metrics

- Parents can easily understand trends
- Trend data helps inform decisions
- Questions about "how are we doing" are answered satisfactorily

---

## 4. Predictive Modeling

**Status**: 📋 Planned
**Complexity**: 🔴 Large
**Priority**: Medium
**Dependencies**: Pattern Recognition, Machine Learning library (scikit-learn or TensorFlow)

### Overview

Use historical data and patterns to predict upcoming needs: "Baby will likely be hungry in 30 minutes" or "Based on today's naps, bedtime should be around 7:30pm."

### User Stories

- **As a parent**, I want to know when Valya will likely need to eat next, so I can plan my activities
- **As a parent**, I want a bedtime prediction based on today's naps, so I can time our routine
- **As a parent**, I want to anticipate fussy periods, so I can prepare

### Technical Approach

#### Prediction Types

1. **Next Feeding Time**:
   - Input: Last 5 feeding times, time of day, nap status
   - Output: Predicted time window for next feed

2. **Next Nap Time**:
   - Input: Last wake time, previous nap lengths today, time of day
   - Output: Predicted nap window

3. **Bedtime Prediction**:
   - Input: Today's nap schedule, total sleep today, typical bedtime
   - Output: Recommended bedtime for tonight

4. **Mood/Behavior Prediction**:
   - Input: Time since feed, time since nap, time of day
   - Output: Likelihood of fussiness (low/medium/high)

#### Implementation

**Simple Model (Time-Series Forecasting)**:
```python
from sklearn.ensemble import RandomForestRegressor
import numpy as np

class FeedPredictor:
    def __init__(self):
        self.model = RandomForestRegressor(n_estimators=100)

    def train(self, child_uid, days=30):
        """Train model on historical feeding data."""

        # Get historical feeds
        feeds = get_feed_activities(child_uid, days=days)

        # Create features
        X, y = [], []
        for i in range(len(feeds) - 1):
            features = self._extract_features(feeds[:i+1])
            target = (feeds[i+1].start - feeds[i].start).total_seconds() / 3600  # Hours until next feed

            X.append(features)
            y.append(target)

        # Train
        self.model.fit(np.array(X), np.array(y))

    def _extract_features(self, feed_history):
        """Extract features from feeding history."""
        last_feed = feed_history[-1]

        return [
            last_feed.start.hour,  # Time of day
            last_feed.start.weekday(),  # Day of week
            len(feed_history),  # Feed number today
            self._time_since_last_sleep(last_feed.start),  # Hours since last nap
            self._avg_recent_intervals(feed_history, window=3),  # Recent interval trend
        ]

    def predict_next_feed(self, child_uid):
        """Predict when next feeding will occur."""
        recent_feeds = get_recent_feeds(child_uid, hours=24)

        if not recent_feeds:
            return None

        features = self._extract_features(recent_feeds)
        hours_until_next = self.model.predict([features])[0]

        last_feed_time = recent_feeds[-1].start
        predicted_time = last_feed_time + timedelta(hours=hours_until_next)

        # Add confidence interval
        confidence = self._calculate_confidence(recent_feeds)

        return {
            'predicted_time': predicted_time,
            'hours_from_now': (predicted_time - datetime.now()).total_seconds() / 3600,
            'confidence': confidence,
            'message': f"Valya will likely need to eat around {predicted_time.strftime('%I:%M %p')} "
                      f"({hours_until_next:.1f} hours from last feed)"
        }
```

**Bedtime Optimizer**:
```python
def predict_optimal_bedtime(child_uid):
    """Predict best bedtime based on today's naps."""

    today_sleep = get_sleep_activities(child_uid, hours=24)
    total_daytime_sleep = sum(s.duration for s in today_sleep if is_daytime(s))

    # Rule-based heuristic
    # Target: 14-17 hours total sleep for newborns
    # If slept a lot during day, later bedtime
    # If slept less during day, earlier bedtime

    typical_bedtime = get_typical_bedtime(child_uid)  # From patterns

    if total_daytime_sleep > avg_daytime_sleep * 1.2:
        # Slept more → push bedtime later
        adjustment = 30  # minutes
    elif total_daytime_sleep < avg_daytime_sleep * 0.8:
        # Slept less → earlier bedtime
        adjustment = -30
    else:
        adjustment = 0

    recommended_bedtime = typical_bedtime + timedelta(minutes=adjustment)

    return {
        'recommended_time': recommended_bedtime,
        'reason': f'Based on {total_daytime_sleep//60} minutes of daytime sleep',
        'message': f"Tonight, try bedtime around {recommended_bedtime.strftime('%I:%M %p')}"
    }
```

#### Integration Example

```typescript
// When parent asks about next feeding
if (userQuestion.includes('when') && userQuestion.includes('eat')) {
  const prediction = await handleFunctionCall('predict_next_feed', {});
  // Abby responds: "Based on her pattern, she'll probably be hungry around 3:30pm, about 2 hours from now."
}
```

### Challenges

1. **Babies are unpredictable**: Even good models will have low accuracy (60-70%)
2. **Overfitting**: Small dataset → model might memorize rather than generalize
3. **Managing expectations**: Parents might over-rely on predictions
4. **Model drift**: Baby's needs change quickly, model must adapt

### Success Metrics

- Prediction accuracy: >60% within ±30 minute window
- Parents find predictions useful even if not always accurate
- Confidence scores are well-calibrated

---

## 5. Reddit Community Integration

**Status**: 📋 Planned
**Complexity**: 🟡 Medium
**Priority**: Medium
**Dependencies**: Reddit API, Vector database (for semantic search), OpenAI embeddings

### Overview

Monitor relevant parenting subreddits to collect helpful tips, common issues, and community wisdom. Use this knowledge to enhance Abby's responses with real parent experiences and crowd-sourced advice.

### Target Subreddits

**Primary** (high signal, active communities):
- r/NewParents
- r/beyondthebump
- r/Parenting
- r/daddit
- r/Mommit
- r/sleeptrain
- r/breastfeeding
- r/FormulaFeeders

**Secondary** (more specific topics):
- r/workingmoms
- r/NICU
- r/Prematurebaby
- r/BabyBumps (pregnancy → transition to parenting)
- r/ScienceBasedParenting

### User Stories

- **As a parent**, I want Abby to share tips from other parents when relevant, so I can learn from the community
- **As a parent**, I want to know if my situation is common (e.g., "other parents have dealt with this"), so I feel less alone
- **As a parent**, I want Abby to surface highly-upvoted advice from Reddit, so I get crowd-validated wisdom

### Technical Approach

#### Architecture

```
Reddit API → Data Pipeline → Processing → Vector DB → Abby
```

**Components**:
1. **Reddit Scraper**: Fetch posts and comments periodically
2. **Content Processor**: Filter, clean, and extract insights
3. **Vector Database**: Store embeddings for semantic search
4. **Retrieval System**: Find relevant tips based on conversation context

#### Implementation

**Phase 1: Reddit Data Collection**

```python
import praw  # Python Reddit API Wrapper
from datetime import datetime, timedelta

class RedditScraper:
    def __init__(self, client_id, client_secret, user_agent):
        self.reddit = praw.Reddit(
            client_id=client_id,
            client_secret=client_secret,
            user_agent=user_agent
        )

        self.target_subreddits = [
            'NewParents', 'beyondthebump', 'Parenting',
            'daddit', 'Mommit', 'sleeptrain',
            'breastfeeding', 'FormulaFeeders'
        ]

    def fetch_recent_posts(self, hours=24, min_upvotes=10):
        """Fetch high-quality posts from last 24 hours."""

        posts = []
        since = datetime.now() - timedelta(hours=hours)

        for subreddit_name in self.target_subreddits:
            subreddit = self.reddit.subreddit(subreddit_name)

            # Fetch hot and top posts
            for post in subreddit.hot(limit=50):
                if post.created_utc < since.timestamp():
                    continue

                if post.score >= min_upvotes:
                    posts.append({
                        'id': post.id,
                        'subreddit': subreddit_name,
                        'title': post.title,
                        'body': post.selftext,
                        'url': post.url,
                        'score': post.score,
                        'num_comments': post.num_comments,
                        'created': datetime.fromtimestamp(post.created_utc),
                        'flair': post.link_flair_text,
                        'top_comments': self._get_top_comments(post, limit=5)
                    })

        return posts

    def _get_top_comments(self, post, limit=5):
        """Get top comments from a post."""
        post.comment_sort = 'top'
        comments = []

        for comment in post.comments[:limit]:
            if hasattr(comment, 'body') and comment.score >= 5:
                comments.append({
                    'body': comment.body,
                    'score': comment.score,
                    'author': str(comment.author)
                })

        return comments
```

**Phase 2: Content Processing & Filtering**

```python
from openai import OpenAI

class ContentProcessor:
    def __init__(self, openai_client):
        self.client = openai_client

    def process_post(self, post):
        """Extract insights and categorize post."""

        # Use GPT to analyze and extract key points
        prompt = f"""
        Analyze this Reddit post from r/{post['subreddit']} and extract:
        1. Main topic (sleep, feeding, behavior, health, development)
        2. Key advice or insights (if any)
        3. Whether this is a common concern or unique situation
        4. Sentiment (positive, negative, neutral, question)

        Post Title: {post['title']}
        Post Body: {post['body'][:500]}
        Top Comments: {post['top_comments'][:3]}

        Format response as JSON.
        """

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        analysis = json.loads(response.choices[0].message.content)

        return {
            **post,
            'topic': analysis.get('topic'),
            'insights': analysis.get('insights', []),
            'is_common': analysis.get('is_common'),
            'sentiment': analysis.get('sentiment')
        }

    def extract_tips(self, posts):
        """Extract actionable tips from high-quality posts."""

        tips = []

        for post in posts:
            if post['score'] >= 50 or post['num_comments'] >= 20:
                # High engagement = valuable content

                processed = self.process_post(post)

                if processed['insights']:
                    tips.append({
                        'source': f"r/{post['subreddit']}",
                        'topic': processed['topic'],
                        'tip': processed['insights'],
                        'upvotes': post['score'],
                        'url': f"https://reddit.com{post['id']}",
                        'date': post['created']
                    })

        return tips
```

**Phase 3: Vector Database for Semantic Search**

```python
from pinecone import Pinecone
import openai

class RedditKnowledgeBase:
    def __init__(self, pinecone_api_key, openai_client):
        self.pc = Pinecone(api_key=pinecone_api_key)
        self.index = self.pc.Index("reddit-parenting-tips")
        self.openai_client = openai_client

    def add_tips(self, tips):
        """Add tips to vector database with embeddings."""

        for tip in tips:
            # Create embedding
            text = f"{tip['topic']}: {tip['tip']}"

            embedding = self.openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=text
            ).data[0].embedding

            # Store in Pinecone
            self.index.upsert(vectors=[{
                'id': f"reddit_{tip['source']}_{tip['date'].timestamp()}",
                'values': embedding,
                'metadata': {
                    'text': text,
                    'source': tip['source'],
                    'topic': tip['topic'],
                    'upvotes': tip['upvotes'],
                    'url': tip['url'],
                    'date': str(tip['date'])
                }
            }])

    def search(self, query, top_k=3):
        """Search for relevant tips based on query."""

        # Create query embedding
        query_embedding = self.openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=query
        ).data[0].embedding

        # Search Pinecone
        results = self.index.query(
            vector=query_embedding,
            top_k=top_k,
            include_metadata=True
        )

        # Format results
        tips = []
        for match in results.matches:
            if match.score > 0.75:  # Relevance threshold
                tips.append({
                    'text': match.metadata['text'],
                    'source': match.metadata['source'],
                    'upvotes': match.metadata['upvotes'],
                    'url': match.metadata['url'],
                    'relevance': match.score
                })

        return tips
```

**Phase 4: Integration with Abby**

```python
# Add MCP tool for Reddit tips
Tool(
    name="search_reddit_tips",
    description="Search Reddit parenting communities for tips and advice related to a topic",
    inputSchema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "What to search for (e.g., 'baby wont sleep at night')"
            },
            "max_results": {
                "type": "number",
                "description": "Maximum tips to return (default: 3)",
                "default": 3
            }
        },
        "required": ["query"]
    }
)

@server.call_tool()
async def call_tool(name: str, arguments: Any):
    # ... existing handlers ...

    elif name == "search_reddit_tips":
        query = arguments.get("query")
        max_results = arguments.get("max_results", 3)

        kb = RedditKnowledgeBase(pinecone_key, openai_client)
        tips = kb.search(query, top_k=max_results)

        if tips:
            result = "Here's what other parents on Reddit have found helpful:\n\n"
            for i, tip in enumerate(tips, 1):
                result += f"{i}. {tip['text']}\n"
                result += f"   ({tip['upvotes']} upvotes on {tip['source']})\n\n"

            return [TextContent(type="text", text=result)]
        else:
            return [TextContent(type="text", text="No relevant tips found.")]
```

**Abby's Instructions Update**:
```typescript
// In agent.ts
export const AGENT_INSTRUCTIONS = `...

When appropriate, you can search Reddit parenting communities for tips using the search_reddit_tips tool.
Use this when:
- Parent asks about a common issue
- You want to share what other parents have experienced
- Validating that a concern is common

Always cite the source (e.g., "Parents on r/NewParents recommend...")
`;
```

#### Example Conversation

```
Parent: "Valya won't sleep unless I'm holding her. Is this normal?"

Abby: "This is very common! Let me see what other parents have shared about this..."

[Calls search_reddit_tips("baby only sleeps when held")]

Abby: "Yes, this is completely normal and very common! Here's what other parents on Reddit have found helpful:

1. The 'put down drowsy but awake' method - wait until baby is drowsy but not fully asleep before putting them down (245 upvotes on r/NewParents)

2. Start with contact naps during the day and gradually transition to bassinet at night (189 upvotes on r/beyondthebump)

3. Use a heating pad to warm the bassinet before putting baby down, then remove it - the warmth helps with the transition (312 upvotes on r/sleeptrain)

This phase is temporary, and many parents go through it. You're not alone!"
```

#### Data Pipeline Schedule

```python
# Cron job or scheduled task
def daily_reddit_sync():
    """Run daily to fetch and index new Reddit content."""

    scraper = RedditScraper(client_id, client_secret, user_agent)
    processor = ContentProcessor(openai_client)
    kb = RedditKnowledgeBase(pinecone_key, openai_client)

    # Fetch last 24 hours
    posts = scraper.fetch_recent_posts(hours=24, min_upvotes=10)

    # Process and extract tips
    tips = processor.extract_tips(posts)

    # Add to vector database
    kb.add_tips(tips)

    logger.info(f"Indexed {len(tips)} new tips from Reddit")

# Run daily at 2am
schedule.every().day.at("02:00").do(daily_reddit_sync)
```

### Database Schema

```sql
CREATE TABLE reddit_posts (
  id VARCHAR PRIMARY KEY,
  subreddit VARCHAR NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  score INTEGER,
  num_comments INTEGER,
  created_at TIMESTAMP,
  topic VARCHAR,
  sentiment VARCHAR,
  processed_at TIMESTAMP,
  embedding_id VARCHAR -- Reference to vector DB
);

CREATE TABLE reddit_tips (
  id UUID PRIMARY KEY,
  post_id VARCHAR REFERENCES reddit_posts(id),
  tip_text TEXT NOT NULL,
  topic VARCHAR,
  upvotes INTEGER,
  source_url TEXT,
  created_at TIMESTAMP,
  last_used TIMESTAMP -- Track which tips are used most
);
```

### API Requirements

**Reddit API**:
- Create app at: https://www.reddit.com/prefs/apps
- Get `client_id` and `client_secret`
- Free tier: 60 requests/minute

**Pinecone** (Vector Database):
- Sign up: https://www.pinecone.io/
- Free tier: 1M vectors
- ~$70/month for production scale

**OpenAI Embeddings**:
- `text-embedding-3-small`: $0.02 per 1M tokens
- Cheap and effective for this use case

### Challenges

1. **Content quality**: Reddit varies; need good filtering
2. **Misinformation**: Must validate medical advice (maybe flag for "consult pediatrician")
3. **Privacy**: Never share user's specific data with Reddit integration
4. **Rate limits**: Reddit API is rate-limited
5. **Storage costs**: Vector databases can get expensive

### Success Metrics

- Tips are relevant (>80% of retrieved tips match query intent)
- Parents find Reddit tips helpful (feedback)
- No medical misinformation shared
- Diverse sources (tips from multiple subreddits)

### Safety Considerations

**Content Filtering**:
```python
def is_safe_tip(tip):
    """Filter out potentially harmful content."""

    unsafe_keywords = [
        'essential oils', 'ignore doctor', 'dont vaccinate',
        'co-sleeping', 'rice cereal in bottle'  # Controversial/unsafe practices
    ]

    tip_lower = tip.lower()

    if any(keyword in tip_lower for keyword in unsafe_keywords):
        return False

    # Use OpenAI moderation API
    response = openai_client.moderations.create(input=tip)
    if response.results[0].flagged:
        return False

    return True
```

**Medical Disclaimer**:
```typescript
// When sharing Reddit tips
const disclaimer = "These are suggestions from other parents. Always consult your pediatrician for medical concerns."
```

---

## 6. Conversation Memory & Learning

**Status**: 📋 Planned
**Complexity**: 🔴 Large
**Priority**: High
**Dependencies**: Database, Conversation history storage

### Overview

Store conversation history and learn from parent interactions. Remember preferences, past concerns, and conversations to provide continuity across calls.

### User Stories

- **As a parent**, I want Abby to remember what we talked about last time, so I don't have to repeat myself
- **As a parent**, I want Abby to remember my preferences (e.g., I prefer breastfeeding advice), so responses are more relevant
- **As a parent**, I want Abby to recall past concerns (e.g., we were worried about X last week), so we can track progress

### Technical Approach

**Conversation Storage**:
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  phone_number VARCHAR NOT NULL,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_seconds INTEGER,
  transcript TEXT, -- Full conversation transcript
  summary TEXT, -- AI-generated summary
  topics TEXT[], -- Array of topics discussed
  concerns TEXT[], -- Any concerns raised
  preferences_learned JSONB -- Extracted preferences
);

CREATE TABLE conversation_memories (
  id UUID PRIMARY KEY,
  phone_number VARCHAR NOT NULL,
  memory_type VARCHAR, -- 'preference', 'concern', 'fact'
  content TEXT,
  confidence FLOAT,
  source_conversation_id UUID REFERENCES conversations(id),
  created_at TIMESTAMP,
  last_referenced TIMESTAMP
);
```

**Implementation**: Extract key information from conversations using GPT, store as structured memories, and inject relevant memories into future conversations.

---

## 7. Multi-Child Support

**Status**: 📋 Planned
**Complexity**: 🟡 Medium
**Priority**: Low
**Dependencies**: Database schema updates, child selection logic

### Overview

Support multiple children per account. Automatically detect which child is being discussed or ask for clarification.

### Implementation

- Add `child_selector` function to let parents specify which child
- Update all MCP tools to accept `child_uid` parameter
- Store preferences per child
- "Tell me about Sarah" vs "Tell me about David"

---

## 8. SMS/Text Interface

**Status**: 📋 Planned
**Complexity**: 🟡 Medium
**Priority**: Medium
**Dependencies**: Twilio SMS API

### Overview

Interact with Abby via text message instead of phone calls. Quick questions, status updates, and reminders.

### Use Cases

- "How long since Valya last ate?" → "2.5 hours ago"
- "Log feeding 4oz" → "Logged ✓"
- Daily summary text at 8pm with today's stats

---

## 9. Web Dashboard

**Status**: 📋 Planned
**Complexity**: 🔴 Large
**Priority**: Low
**Dependencies**: Web framework (Next.js/React), Authentication

### Overview

Web interface to view insights, trends, conversation history, and configure Abby's settings.

### Features

- Visualizations of sleep/feed/diaper trends
- Calendar view of activities
- Conversation history playback
- Settings (Abby's personality, notification preferences)
- Pattern viewer

---

## 10. Voice Biometrics

**Status**: 📋 Planned
**Complexity**: 🔴 Large
**Priority**: Low
**Dependencies**: Voice recognition ML model

### Overview

Distinguish between different caregivers (mom, dad, grandparent) based on voice. Personalize responses and track who logged what activity.

### Implementation

- Train voice embeddings for each caregiver
- OpenAI Realtime API might add this feature natively
- Alternatively, use speaker diarization model

---

## Implementation Priority Roadmap

### Phase 1 (Now - 3 months)
1. ✅ Recent activity context (DONE)
2. 🔄 Pattern Recognition System
3. 🔄 Proactive Insights Engine

### Phase 2 (3-6 months)
4. Historical Trends Analysis
5. Reddit Community Integration
6. Conversation Memory & Learning

### Phase 3 (6-12 months)
7. Predictive Modeling
8. SMS/Text Interface
9. Multi-Child Support

### Phase 4 (Future)
10. Web Dashboard
11. Voice Biometrics

---

## Contributing to This Backlog

To propose a new feature:
1. Create a new section with the feature name
2. Include: Overview, User Stories, Technical Approach, Challenges
3. Estimate complexity (Small 🟢 / Medium 🟡 / Large 🔴)
4. List dependencies

---

**Last Updated**: 2024-12-25
**Maintained By**: Arsal (with Claude's help!)
