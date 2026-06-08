---
name: WA Business JID device suffix fix
description: WhatsApp Business multi-device sends JID with :N suffix that breaks digitsOnly() owner matching.
---

## The Problem
WhatsApp Business on iOS (and other multi-device setups) sends JIDs like:
- `628XXXXXXXX:0@s.whatsapp.net` (private DM)
- `628XXXXXXXX:2@s.whatsapp.net` (device variant)

Using `digitsOnly()` directly on this gives `628XXXXXXXX0` — the `:0` suffix becomes a leading/trailing digit, breaking exact comparison with OWNER_NUMBER.

## The Fix
`src/utils/ownerUtils.js` — shared module, use EVERYWHERE:
```js
function parseJid(jid) {
  return String(jid || '')
    .replace(/:\d+@/, '@')  // strip :0, :1 BEFORE @
    .replace(/@[^@]+$/, '') // strip @s.whatsapp.net
    .replace(/\D/g, '');    // digits only
}
```

**Why:** The `:N` is a Baileys multi-device device ID, not part of the phone number.

**How to apply:** Every command must use `extractSenderNumber(msg)` from ownerUtils instead of manual JID parsing. Never call `digitsOnly(msg.key.participant || msg.key.remoteJid)` directly.

## Also fixed
- `normalizeNumber()` handles leading-0 Indonesian numbers: `08XX` → `628XX`
- Owner comparison uses trailing-match: `sender.endsWith(owner) || owner.endsWith(sender)`
- `src/utils/ownerUtils.js` is the single source of truth for all JID/owner logic
