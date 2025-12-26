# ABBY-01: Pattern Recognition System

**Status**: 📋 Planned
**Complexity**: 🔴 Large
**Priority**: High
**Dependencies**: Local database, data collection pipeline
**Estimated Timeline**: 6-8 weeks

---

## Overview

Analyze Valya's activities over time to identify patterns in sleep, feeding, and behavior. Recognize correlations between activities (e.g., "fussy 2 hours after feeding" or "sleeps longer after afternoon feeds").

## User Stories

- **As a parent**, I want Abby to recognize when Valya typically gets fussy, so I can prepare in advance
- **As a parent**, I want to know if Valya's sleep patterns are changing, so I can adjust our routine
- **As a parent**, I want Abby to notice correlations I might miss, so I can better understand my baby's needs

## Technical Approach

### Data Requirements

**Database Schema**:
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

### Implementation Phases

**Phase 1: Data Collection** (2-3 weeks)
1. Set up PostgreSQL or SQLite database
2. Create data sync pipeline: Huckleberry → local DB
3. Run hourly/daily sync to populate historical data
4. Store all activities with normalized timestamps

**Phase 2: Pattern Detection Algorithms** (3-4 weeks)

**Sleep Patterns**:
```python
def detect_sleep_patterns(child_uid, days=14):
    """Detect typical nap times using clustering."""
    activities = get_sleep_activities(child_uid, days)

    # Cluster nap start times
    nap_times = [a.start_time.hour + a.start_time.minute/60
                 for a in activities]

    # Use DBSCAN clustering
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

**Feeding Intervals**:
```python
def detect_feeding_intervals(child_uid, days=7):
    """Find modal feeding interval."""
    feeds = get_feed_activities(child_uid, days)

    # Calculate intervals between feeds
    intervals = []
    for i in range(len(feeds) - 1):
        interval = (feeds[i+1].start - feeds[i].start).total_seconds() / 3600
        intervals.append(interval)

    # Find modal interval
    modal_interval = mode(intervals, bandwidth=0.5)

    return {
        'type': 'feed_interval',
        'interval_hours': modal_interval,
        'confidence': calculate_confidence(intervals, modal_interval),
        'description': f'Usually feeds every {modal_interval:.1f} hours'
    }
```

**Behavioral Correlations**:
```python
def detect_behavior_correlations(child_uid, days=14):
    """Find correlations between fussy times and feeding."""
    fussy_logs = get_mood_logs(child_uid, mood='fussy', days=days)
    feeds = get_feed_activities(child_uid, days=days)

    correlations = []
    for fussy in fussy_logs:
        recent_feeds = [f for f in feeds if f.start < fussy.timestamp]
        if recent_feeds:
            last_feed = max(recent_feeds, key=lambda f: f.start)
            time_since_feed = (fussy.timestamp - last_feed.start).total_seconds() / 3600
            correlations.append(time_since_feed)

    if correlations and std_dev(correlations) < 0.75:
        avg_time = mean(correlations)
        return {
            'type': 'fussy_after_feed',
            'interval_hours': avg_time,
            'confidence': 1 - (std_dev(correlations) / avg_time),
            'description': f'Often fussy {avg_time:.1f} hours after feeding'
        }
```

**Phase 3: Integration** (1 week)
- Create MCP tool: `get_patterns(child_uid)`
- Include patterns in call context
- Update Abby's instructions to reference patterns

### Success Metrics

- Pattern detection accuracy: >70% of predicted patterns actually occur
- User validation: Parents confirm patterns are meaningful
- Actionable insights: Patterns lead to helpful recommendations

### Challenges

1. **Cold start problem**: Need 1-2 weeks of data before patterns emerge
2. **Babies change**: Patterns shift as baby grows (must detect pattern drift)
3. **False positives**: Random coincidences might look like patterns
4. **Statistical significance**: Need enough data points for confidence

---

**Related Features**: ABBY-02 (Proactive Insights), ABBY-04 (Predictive Modeling)
