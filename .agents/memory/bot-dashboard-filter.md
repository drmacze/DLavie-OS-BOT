---
name: Bot Dashboard Filter Bug Fix
description: Critical fix — bot connections use two different userId formats that were being compared incorrectly
---

## The Bug
`commands/connect.js` stored `ownerUserId: waPhoneDigits` (e.g. `62882007437216`).
`web/server.js` `/api/bots` filtered by `c.ownerUserId === req.user.userId` where `req.user.userId` = `usr_abc123` (JWT web ID).
These NEVER match → bots never appeared in web dashboard.

## The Fix
1. In `generate`: look up `webAuth.getSession(userId)?.webUserId` (the `usr_xxx` format) and store as `ownerWebUserId` in the `_pending` entry.
2. In `verify`: copy `ownerWebUserId: pending.ownerWebUserId` into the `botEntry`.
3. In `web/server.js`: filter by `c.ownerWebUserId === req.user.userId || c.ownerUserId === req.user.userId` (OR for backward compat).

**Why:** webAuth.getSession(waUserId) returns `{ webUserId: 'usr_xxx', email, plan, ... }` — this is the bridge between WA identity and web identity.

**How to apply:** Any future feature that reads bot connections from web context must filter by `ownerWebUserId` (not `ownerUserId`). The `ownerUserId` field is kept for backward compat and WA-to-WA lookups.
