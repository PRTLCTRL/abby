# ABBY-11: Voice Biometrics

**Status**: 📋 Planned
**Complexity**: 🔴 Large
**Priority**: Low
**Dependencies**: Voice recognition ML model
**Estimated Timeline**: 6-8 weeks

---

## Overview

Distinguish between different caregivers (mom, dad, grandparent) based on voice. Personalize responses and track who logged what activity.

## Implementation

- Train voice embeddings for each caregiver
- OpenAI Realtime API might add this natively
- Alternatively, use speaker diarization model
- Associate activities with specific caregivers

---

**Related Features**: ABBY-08 (Multi-Child Support), ABBY-07 (Conversation Memory)
