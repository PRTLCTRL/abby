# ABBY-08: Multi-Child Support

**Status**: 📋 Planned
**Complexity**: 🟡 Medium
**Priority**: Low
**Dependencies**: Database schema updates
**Estimated Timeline**: 2-3 weeks

---

## Overview

Support multiple children per account. Automatically detect which child is being discussed or ask for clarification.

## User Stories

- **As a parent with multiple children**, I want to track each child separately
- **As a parent**, I want Abby to know which child I'm talking about based on context

## Implementation

- Add `child_selector` function
- Update all MCP tools to accept `child_uid`
- Store preferences per child
- "Tell me about Sarah" vs "Tell me about David"

---

**Related Features**: ABBY-06 (Agent Monitor), ABBY-07 (Conversation Memory)
