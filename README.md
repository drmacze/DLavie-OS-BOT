# DLavie OS Bot

WhatsApp Multi-Device Bot dengan **Pairing Code Only** (tanpa QR Code) dan sistem **DLavie Auto-Fix**.

## Cara Deploy ke Replit

### 1. Import ke Replit
1. Buka Replit.
2. Klik **+ Create Repl**.
3. Pilih **Import from GitHub**.
4. Masukkan repo: `https://github.com/drmacze/DLavie-OS-BOT`.
5. Klik **Import**.

### 2. Tambah Environment Variables / Secrets
Tambahkan minimal:

| Key | Contoh Value |
|---|---|
| `BOT_NUMBER` | `6285725483343` |
| `OWNER_NUMBER` | `62882007437216` |
| `BOT_NAME` | `DLavie OS` |

Untuk DLavie Auto-Fix dan fallback AI opsional:

| Key | Fungsi |
|---|---|
| `DLAVIE_STARTUP_REPAIR` | `true` agar auto-fix deterministic jalan saat startup |
| `DLAVIE_AI_AUTOFIX` | `true` untuk mengaktifkan fallback AI otomatis |
| `DLAVIE_AUTOFIX_INSTALL_MISSING` | `true` untuk mengizinkan install dependency allowlist otomatis |
| `DLAVIE_AI_ORDER` | Urutan provider, contoh `gemini,chatgpt,grok` |
| `GEMINI_API_KEY` | API key Gemini |
| `OPENAI_API_KEY` atau `CHATGPT_API_KEY` | API key ChatGPT/OpenAI |
| `GROK_API_KEY` atau `XAI_API_KEY` | API key Grok/xAI |

> Jangan commit API key ke GitHub. Simpan API key di Replit Secrets.

### 3. Jalankan Bot
```bash
npm install
npm start
```

Pairing code akan muncul di console. Copy kode tersebut lalu pairing di WhatsApp HP kamu.

---

## DLavie Auto-Fix

Sistem ini memiliki dua lapisan:

### 1. Deterministic Auto-Fix tanpa AI dan tanpa API key

Auto-fix ini bisa berjalan tanpa API key karena memakai rule/pola error yang sudah ditentukan.

Yang bisa diperbaiki/dikenali:

- Membuat folder penting jika hilang: `commands`, `logs`, `tmp`, `src`.
- Memperbaiki `package.json` dasar jika rusak atau kurang script.
- Menambahkan script `doctor` dan `autofix` ke `package.json`.
- Mengenali error missing module.
- Mengenali error folder command hilang.
- Mengenali error session WhatsApp logout/network/session corrupt ringan.
- Mengenali error permission dan port dipakai.
- Membuat laporan ke `logs/dlavie-autofix-report.json` saat mode apply.

Batas jujurnya: **non-AI auto-fix tidak aman untuk menebak patch bug logika kompleks**. Kalau error-nya syntax atau logic bug yang perlu memahami project, sistem akan memberi rekomendasi atau meneruskan ke AI fallback.

### 2. Fallback AI opsional

Fallback AI bisa memakai:

- Gemini: `GEMINI_API_KEY`
- ChatGPT/OpenAI: `OPENAI_API_KEY` atau `CHATGPT_API_KEY`
- Grok/xAI: `GROK_API_KEY` atau `XAI_API_KEY`

Aktifkan otomatis dengan:

```env
DLAVIE_AI_AUTOFIX=true
DLAVIE_AI_ORDER=gemini,chatgpt,grok
```

Jika Gemini gagal, sistem mencoba ChatGPT. Jika ChatGPT gagal, sistem mencoba Grok.

---

## Command WhatsApp Owner

| Command | Fungsi |
|---|---|
| `!fix help` | Lihat bantuan Auto-Fix |
| `!fix check` | Cek masalah tanpa mengubah file |
| `!fix apply` | Perbaiki masalah deterministik yang aman |
| `!fix install <module>` | Install dependency yang ada di allowlist |
| `!fix ai <error/log>` | Minta analisis fallback AI |
| `!fix full <error/log>` | Jalankan deterministic fix + fallback AI |

Contoh:

```text
!fix check
!fix apply
!fix ai Error: Cannot find module 'dotenv'
!fix full SyntaxError: Unexpected token
```

---

## Command Terminal / Replit Shell

```bash
npm run doctor
npm run autofix
node scripts/dlavie-autofix.js --apply
node scripts/dlavie-autofix.js --ai "paste error di sini"
```

Untuk membaca error dari pipe:

```bash
node index.js 2>&1 | node scripts/dlavie-autofix.js --ai
```

---

## Menambah Fitur Baru

Buat file baru di folder `commands/`.

Contoh:

```js
// commands/menu.js
module.exports = {
  name: 'menu',
  execute: async (sock, msg, args, config) => {
    await sock.sendMessage(msg.key.remoteJid, { text: 'Menu coming soon...' });
  }
};
```

Command loader membaca command `.js` di folder `commands/`. Jika command error saat dieksekusi, DLavie Auto-Fix akan menangkap error agar bot tidak langsung crash.
