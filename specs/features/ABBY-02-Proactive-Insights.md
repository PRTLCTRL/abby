# ABBY-02: Proactive Insights Engine

**Status**: 📋 Planned
**Complexity**: 🟡 Medium
**Priority**: High
**Dependencies**: ABBY-01 (Pattern Recognition), Local Database
**Estimated Timeline**: 3-4 weeks

---

## Overview

Generate proactive insights based on current data vs. patterns/historical trends. Abby notices anomalies, changes, and interesting observations without being asked.

## Insight Types

1. **Anomaly Detection**: "Today Valya has slept 2 hours less than her usual daily average"
2. **Positive Trends**: "Great news! Valya has been sleeping 30 minutes longer per nap this week"
3. **Milestone Recognition**: "First time sleeping through the night!"
4. **Gentle Reminders**: "Based on her usual pattern, Valya typically eats around now"

## Implementation

```python
class InsightEngine:
    def generate_insights(self, child_uid, hours=24):
        insights = []

        recent = self.get_recent_activity(child_uid, hours)
        historical = self.get_historical_averages(child_uid, days=14)

        insights.extend(self.detect_anomalies(recent, historical))
        insights.extend(self.detect_positive_trends(recent, historical))
        insights.extend(self.detect_milestones(recent))

        return insights[:5]  # Top 5 by priority
```

## Success Metrics

- Parents find insights helpful (survey/feedback)
- Insights lead to action
- Low false alarm rate (<10%)

---

**Related Features**: ABBY-01 (Pattern Recognition), ABBY-03 (Historical Trends)
