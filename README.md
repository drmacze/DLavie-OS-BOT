# DLavie OS Bot

WhatsApp Multi-Device Bot dengan **Pairing Code Only** (tanpa QR Code).

## Cara Deploy ke Replit (Paling Mudah)

### Langkah 1: Import ke Replit
1. Buka [replit.com](https://replit.com)
2. Klik **+ Create Repl**
3. Pilih **Import from GitHub**
4. Masukkan link repo ini: `https://github.com/drmacze/DLavie-OS-BOT`
5. Klik **Import**

### Langkah 2: Tambah Environment Variables (WAJIB)
Di Replit, klik tab **Secrets** (atau Environment Variables), lalu tambahkan:

| Key            | Value              |
|----------------|--------------------|
| `BOT_NUMBER`   | `6285725483343`    |
| `OWNER_NUMBER` | `62882007437216`   |
| `BOT_NAME`     | `DLavie OS`        |

### Langkah 3: Jalankan Bot
Klik tombol **Run** di atas.

Pairing code akan muncul di console. Copy kode tersebut lalu pairing di WhatsApp HP kamu.

---

## Menambah Fitur Baru

Sangat mudah! Tinggal buat file baru di folder `commands/`

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

Bot akan otomatis mendeteksi command baru tanpa perlu restart konfigurasi.