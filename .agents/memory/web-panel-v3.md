---
name: Web Panel v3.0 Features
description: Popup system, maintenance mode, file manager, WS terminal, SSH, owner guard, admin panel, Vercel export
---

## New Features (v3.0)

### Popup System
- `GET /api/popup` — public, returns active popup (if any)
- `POST /api/admin/popup` / `DELETE /api/admin/popup` — owner only
- Bot commands: `!popup set Title | Desc`, `!popup on/off`, `!popup type`, `!popup clear`
- Frontend: `checkPopup()` in app.js fetches on every page, shows modal overlay; dismissed per-session via sessionStorage

### Maintenance Mode
- `GET /api/maintenance` — public
- `POST /api/admin/maintenance` — owner only, body: `{ target: 'bot'|'panel', active, description, scheduledAt }`
- Bot commands: `!maintenance bot|panel on/off [desc]`, `!maintenance panel schedule DD/MM/YYYY HH:mm [desc]`
- Panel maintenance: Express middleware blocks all HTML pages, owner can bypass with `?token=JWT` in URL
- `/maintenance` page shown to blocked users

### File Manager
- `GET /api/files/list?path=` `GET /api/files/read?path=`
- `POST /api/files/write` `POST /api/files/mkdir` `POST /api/files/upload` (base64)
- `DELETE /api/files/delete?path=` `PUT /api/files/rename` `GET /api/files/download?path=&token=`
- `safePath()` prevents path traversal — all paths confined to PROJECT_ROOT
- node_modules, .git, .cache are hidden from listing

### WebSocket Terminal
- `/ws/terminal?token=JWT` — spawns `/bin/bash` in PROJECT_ROOT
- Messages: `{type:'input',data}`, `{type:'resize',cols,rows}`, `{type:'output',data}`, `{type:'exit',code}`
- Client: xterm.js v5.3.0 from CDN, FitAddon, WebLinksAddon
- Auto-reconnect in 5s on close

### SSH / Remote
- `/ws/ssh?token=JWT` — forwards SSH via `spawn('ssh')` or `spawn('sshpass')` if available
- SSH credentials NOT persisted server-side; client persists saved sessions in localStorage only
- Pterodactyl: frontend calls Pterodactyl client API directly (CORS must be enabled on the panel)

### Owner Guard
- `isOwnerUser(userId)`: checks `user.role === 'owner'` OR webAuth session linked to OWNER_NUM
- First registered user auto-gets `role: 'owner'`
- `requireOwner` middleware for all `/api/admin/*` routes
- `/api/auth/me` and `/api/dashboard` both return `isOwner: bool`
- Frontend: `checkOwnerFeatures()` in app.js shows `.owner-only` elements, adds 👑 badge

### Admin Panel (`/admin`)
- Stats: users, bots, payments, revenue
- Popup management UI (set title/desc/type/active)
- Maintenance controls for bot + panel with schedule
- User table with edit (plan/tokens/role)
- All payments overview
- All bots overview

### WebSocket Architecture
- Single `WebSocketServer` attached to `http.createServer(app)`
- Routes by `req.url` pathname: `/ws/terminal`, `/ws/ssh`, `/ws` (legacy keepalive)
- Auth via `?token=JWT` query param on ws connection

### Vercel Export
- Script: `node scripts/create-vercel-export.js` → `tmp/dlavie-panel-vercel.zip`
- Uses `archiver` package; includes Vercel-adapted `api/index.js` (no ws/file manager/ssh)
- Storage in `/tmp/dlavie-data/` (ephemeral on Vercel — note limitation)

**Why:** Popup/maintenance need bot↔web coordination. File manager + terminal needed for pro users managing their own bot files. Owner guard prevents unauthorized access to admin features.
