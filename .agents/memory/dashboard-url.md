---
name: Dashboard URL Resolution
description: How bot messages include the correct web dashboard URL across environments
---

## getDashUrl() Priority Order
1. `process.env.DASHBOARD_URL` — explicit override
2. `process.env.REPLIT_DEV_DOMAIN` → `https://${domain}` — Replit dev environment
3. `cfg.web?.dashboardUrl` or `cfg.website?.dashboardUrl` — config file
4. `'https://dlavie-os.replit.app'` — hardcoded fallback

## Usage
Both `commands/connect.js` and `web/server.js` define and use `getDashUrl()`.
Bot messages always include the dashboard URL for UX (e.g. "Lihat di: {url}/bots").

**Why:** Replit changes the preview domain between sessions; hardcoding breaks across deployments.
