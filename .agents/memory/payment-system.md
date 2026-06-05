---
name: Payment System Flow
description: QRIS topup + plan upgrade payment flow with owner WhatsApp approval
---

## Payment Flow
1. User: POST `/api/payment/initiate` `{type:'token'|'plan', packageId, amount, tokens}`
2. Server: creates `payId = PAY_YYYYMMDD_XXXXXXXX`, stores in `tmp/payments.json`, returns QRIS image + 5-min `expiresAt`
3. Frontend: shows QRIS + countdown timer (5 min) + "Sudah Bayar" button
4. User: POST `/api/payment/proof` `{payId, buyerName, proofImage (base64)}`
5. Server: updates status → `proof_submitted`, sends WA message to owner `62882007437216` with approve/reject instructions
6. Owner: sends `!approve PAYID [token_amount]` or `!approve plan PAYID PLAN_NAME` or `!reject PAYID [reason]`
7. Bot (`commands/approve.js`): updates `tmp/web_users.json` tokens or plan, updates payment status

## Payment Status Flow
`pending_proof` → `proof_submitted` → `approved` | `rejected` | `expired` | `cancelled`

## File Storage
`tmp/payments.json` — array of payment objects
`tmp/web_users.json` — user tokens/plan updated on approval

**Why:** Owner notification via WA bot (not email) since owner is always on WhatsApp. Proof is base64 image stored in payments.json temporarily.
