# DLavie OS Bot

WhatsApp Multi-Device Bot dengan sistem **Pairing Code Only** (tanpa QR).

## Keunggulan
- Struktur modular → mudah tambah fitur
- Deploy mudah di Replit & VPS
- Pakai .env untuk konfigurasi

## Cara Menambah Fitur Baru

Cukup buat file baru di folder `commands/`. Contoh sudah ada di `commands/ping.js`.

## Deploy ke Replit
1. Buat Repl dari GitHub repo ini
2. Tambah Environment Variables:
   - BOT_NUMBER=6285725483343
   - OWNER_NUMBER=62882007437216
   - BOT_NAME=DLavie OS
3. Run