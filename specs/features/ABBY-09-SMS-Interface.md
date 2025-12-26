# ABBY-09: SMS/Text Interface

**Status**: 📋 Planned
**Complexity**: 🟡 Medium
**Priority**: Medium
**Dependencies**: Twilio SMS API
**Estimated Timeline**: 1-2 weeks

---

## Overview

Interact with Abby via text message instead of phone calls. Quick questions, status updates, and reminders.

## Use Cases

- "How long since Valya last ate?" → "2.5 hours ago"
- "Log feeding 4oz" → "Logged ✓"
- Daily summary text at 8pm with today's stats

## Implementation

```python
from twilio.rest import Client

@app.route('/sms', methods=['POST'])
def handle_sms():
    message = request.form['Body']
    from_number = request.form['From']

    # Parse intent
    if 'log' in message.lower():
        # Handle activity logging
        pass
    elif 'when' in message.lower() or 'how long' in message.lower():
        # Handle question
        pass

    # Respond via SMS
    response = MessagingResponse()
    response.message(reply_text)
    return str(response)
```

---

**Related Features**: ABBY-10 (Web Dashboard)
