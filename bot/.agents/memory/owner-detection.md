---
name: Owner detection architecture
description: How DLavie OS detects the owner across WA commands and web dashboard.
---

## WA Bot (Commands)
All commands must use `src/utils/ownerUtils.js`:
- `isOwnerMsg(msg, config.ownerNumber)` — checks a Baileys message object
- `isOwnerById(userId, ownerNumber)` — checks a pre-extracted digit string
- `extractSenderNumber(msg)` — extracts clean digits from any JID format

**Pattern in commands:**
```js
const { isOwnerMsg } = require('../src/utils/ownerUtils');
function isOwner(msg, config) { return isOwnerMsg(msg, config.ownerNumber); }
```

## Web Dashboard (web/server.js)
- `AUTO_OWNER_EMAILS = ['dev@dlavie.com']` — auto-elevated on every register/login
- Auto-owner gets: `role='owner'`, `plan='enterprise'`, `tokens=999999`
- Role included in JWT payload so frontend can check without DB call

## Owner bypass in commands
- `!login` — owner gets bypass message, no code needed
- `commandLoader.js` — owner bypasses login gate automatically
- `emitOwnEvents: false` in Baileys — fromMe is never true in practice; do NOT rely on `msg.key.fromMe` for owner detection

## OWNER_NUMBER env var format
Stored as Replit Secret. Acceptable formats: `628XXXXXXXXXX`, `08XXXXXXXXXX`, `+628XXXXXXXXXX` — normalizeNumber() handles all variants.
