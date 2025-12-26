# ABBY-12: Last Conversation Context

**Status**: 📋 Planned
**Complexity**: 🟡 Medium
**Priority**: High
**Dependencies**: Database, Conversation storage
**Estimated Timeline**: 1-2 weeks

---

## Overview

Remember the last conversation and use it as context for the next call. When you call Abby again, she remembers what you talked about last time and can reference it naturally.

This is a **quick-win subset** of ABBY-07 (Conversation Memory) focused specifically on the immediate previous conversation.

## User Stories

- **As a parent**, I want Abby to remember what we discussed last time, so I don't have to repeat myself
- **As a parent**, I want Abby to follow up on concerns I mentioned previously, so we can track progress
- **As a parent**, I want continuity between calls, so conversations feel connected

## Example Flow

**Call 1** (Dec 25, 3:00 PM):
```
You: "Valya has been really fussy in the evenings"
Abby: "That's common. Let's see if we can identify any patterns..."
[Discussion about evening fussiness]
```

**Call 2** (Dec 26, 10:00 AM):
```
Abby: "Hi! Last time we talked about evening fussiness. How did last night go?"
You: "Much better actually, she seemed calmer"
Abby: "That's great to hear! What changed?"
```

## Implementation

### Phase 1: Store Last Conversation (1 week)

**Database**:
```sql
-- Add to existing schema
CREATE TABLE conversation_summaries (
  id UUID PRIMARY KEY,
  phone_number VARCHAR NOT NULL,
  conversation_id UUID REFERENCES conversations(id),
  call_timestamp TIMESTAMP NOT NULL,
  duration_seconds INTEGER,
  summary TEXT, -- AI-generated summary
  key_topics TEXT[], -- ['sleep', 'feeding', 'fussy']
  concerns_raised TEXT[], -- Specific concerns mentioned
  action_items TEXT[], -- Things to follow up on
  sentiment VARCHAR, -- 'worried', 'positive', 'neutral'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_conversation_phone_time
ON conversation_summaries(phone_number, call_timestamp DESC);
```

**After each call ends**:
```typescript
// In server.ts - when call ends
async function summarizeConversation(transcript, phoneNumber) {
  const summary = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Summarize this conversation between a parent and Abby (baby coach):

Transcript:
${transcript}

Extract:
1. Brief summary (2-3 sentences)
2. Key topics discussed
3. Any concerns raised
4. Action items or things to follow up on
5. Overall sentiment

Format as JSON.`
    }]
  });

  const data = JSON.parse(summary.choices[0].message.content);

  // Store in database
  await db.conversation_summaries.insert({
    phone_number: phoneNumber,
    call_timestamp: new Date(),
    summary: data.summary,
    key_topics: data.topics,
    concerns_raised: data.concerns,
    action_items: data.action_items,
    sentiment: data.sentiment
  });
}
```

### Phase 2: Load Last Conversation Context (3 days)

**When call starts** (in server.ts - session.updated):
```typescript
// Fetch last conversation
async function getLastConversationContext(phoneNumber) {
  const lastConvo = await db.conversation_summaries
    .where({ phone_number: phoneNumber })
    .orderBy('call_timestamp', 'desc')
    .first();

  if (!lastConvo) return null;

  const timeSince = (Date.now() - lastConvo.call_timestamp) / 1000 / 3600; // hours

  if (timeSince > 48) return null; // Too old, don't reference

  return {
    summary: lastConvo.summary,
    topics: lastConvo.key_topics,
    concerns: lastConvo.concerns_raised,
    action_items: lastConvo.action_items,
    hours_since: timeSince
  };
}

// In session.updated handler, add:
const lastConvo = await getLastConversationContext(phoneNumber);

if (lastConvo) {
  openaiWs.send(JSON.stringify({
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'system',
      content: [{
        type: 'input_text',
        text: `Last conversation (${lastConvo.hours_since.toFixed(0)} hours ago):
${lastConvo.summary}

Topics discussed: ${lastConvo.topics.join(', ')}
${lastConvo.concerns.length > 0 ? `Concerns raised: ${lastConvo.concerns.join(', ')}` : ''}
${lastConvo.action_items.length > 0 ? `Follow up on: ${lastConvo.action_items.join(', ')}` : ''}

Reference this naturally in your greeting if relevant.`
      }]
    }
  }));
}
```

### Phase 3: Natural References (2 days)

**Update agent instructions**:
```typescript
export const AGENT_INSTRUCTIONS = `...

USING LAST CONVERSATION CONTEXT:
If you have context from the last conversation:
- Reference it naturally in your greeting: "Last time we talked about [topic]. How's that going?"
- Follow up on concerns: "You mentioned [concern] before. Has that improved?"
- Check on action items: "Did you try [suggestion] we discussed?"
- Don't force it - only mention if relevant and recent (<48 hours)

...`;
```

## Technical Details

### Conversation End Detection

Currently calls end when user hangs up. We need to capture the transcript:

```typescript
// In server.ts
const conversationTranscript = [];

// Store user messages
case 'conversation.item.input_audio_transcription.completed':
  conversationTranscript.push({
    speaker: 'user',
    text: event.transcript,
    timestamp: new Date()
  });
  break;

// Store Abby's responses
case 'response.audio_transcript.done':
  conversationTranscript.push({
    speaker: 'abby',
    text: event.transcript,
    timestamp: new Date()
  });
  break;

// When call ends
twilioWs.on('close', async () => {
  console.log('🔌 Twilio Media Stream disconnected');

  // Summarize and store conversation
  if (conversationTranscript.length > 0) {
    await summarizeConversation(conversationTranscript, phoneNumber);
  }
});
```

### Handling Edge Cases

1. **No previous conversation**: Simple greeting without reference
2. **Very old conversation** (>48 hours): Don't reference, too stale
3. **Multiple calls same day**: Reference the most recent one
4. **Different topics**: Only reference if current call topic matches

## Success Metrics

- **Continuity**: Parents notice Abby remembers past conversations
- **Relevance**: Context references are appropriate and helpful
- **Accuracy**: Summaries capture key points correctly (>90%)
- **Engagement**: Conversations feel more connected

## Example Scenarios

### Scenario 1: Follow-up on Concern
**Day 1**: "She's not sleeping well at night"
**Day 2**: "Hi! Last time you mentioned nighttime sleep was tough. How did last night go?"

### Scenario 2: Check on Progress
**Day 1**: "Trying to get her on a schedule"
**Day 2**: "Hi! How's the schedule going since we talked?"

### Scenario 3: Continuity
**Day 1**: Long discussion about feeding challenges
**Day 2**: "Hi! How's feeding been since yesterday?"

### Scenario 4: Old Conversation (Don't Reference)
**Week 1**: Discussed sleep
**Week 3**: "Hi! How are things with Valya today?" (Too old to reference)

## Quick Implementation Checklist

- [ ] Add conversation_summaries table to database
- [ ] Store transcript during calls (append to array)
- [ ] On call end, summarize with GPT and store
- [ ] On call start, fetch last conversation if <48hrs old
- [ ] Inject last conversation context as system message
- [ ] Update agent instructions to reference context naturally
- [ ] Test with multiple consecutive calls

## Cost Estimate

- **GPT-4o-mini** for summarization: ~$0.001 per call
- **Storage**: Negligible (text summaries are small)
- **Total**: <$1/month for typical usage (30 calls)

---

## Relationship to Other Features

- **Subset of ABBY-07** (Conversation Memory) - focused on immediate previous call
- **Feeds into ABBY-06** (Agent Monitor) - summaries displayed in dashboard
- **Enhances current feature** - Recent activity context (already implemented)

**Why separate from ABBY-07?**
- Quick win (1-2 weeks vs 4-6 weeks)
- Immediate value (most useful context is the last call)
- Simpler implementation (no long-term memory complexity)
- Can evolve into ABBY-07 later

---

**Related Features**: ABBY-06 (Agent Monitor), ABBY-07 (Conversation Memory)
**Created**: Dec 25, 2024
**Requested By**: User (Arsal)
