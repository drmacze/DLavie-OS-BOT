# DLavie OS Bot Guardrails

Dokumen ini adalah aturan kerja aman untuk menjaga DLavie OS Bot tetap stabil saat diperbaiki oleh manusia, Replit Agent, atau AI lain.

## Prinsip utama

DLavie OS Bot adalah **WhatsApp Multi-Device Bot Control Platform**, bukan project kosong. Jangan membuat ulang struktur project kecuali owner secara eksplisit meminta rebuild total.

## Source of truth fitur

Fitur yang sudah ada harus diperbaiki di file/plugin existing. Jangan membuat command baru dengan nama sama.

Gunakan Plugin ID sebagai identitas fitur:

| Command | Plugin ID | Catatan |
|---|---|---|
| `!fix` | `PLG-FIX-27478353` | Jangan membuat `commands/fix.js` baru jika plugin fix existing ada di registry/runtime. |
| `!menu` | `PLG-MENU-18AF3EEA` | Perbaiki template/menu existing, jangan membuat menu baru dari nol. |
| `!update` | `PLG-UPDATE-C6B2D6D8` | Smart git update harus patch plugin existing. |
| `!listcmd` | `PLG-LISTCMD-19DAAF57` | Harus menampilkan sumber command yang benar. |
| `!reload` | `PLG-RELOAD-180EACBA` | Hot reload harus menjaga registry dan command cache. |

## Larangan penting

Jangan lakukan ini tanpa konfirmasi owner:

- Membuat command/plugin baru dengan nama yang sudah ada.
- Menimpa `src/commandLoader.js` secara total.
- Menghapus folder/plugin registry tanpa backup.
- Menghapus `auth_info_baileys` kecuali owner meminta pairing ulang.
- Commit file `.env`, session, API key, token, atau QR/session data.
- `git push --force` ke `main`.
- Mengubah prefix atau owner config tanpa perintah jelas.

## Protokol perbaikan fitur

Saat memperbaiki fitur:

1. Identifikasi command dan Plugin ID.
2. Cari file existing yang memuat command/plugin tersebut.
3. Patch file existing, bukan membuat file baru.
4. Jalankan safety check:

```bash
npm run safety:check
```

5. Jalankan validasi runtime manual di WhatsApp:

```text
!listcmd
!menu
!status
!errorlog
```

6. Jika ada perubahan besar, buat branch baru dan PR, jangan langsung ubah `main`.

## Protokol Git aman

Sebelum refactor:

```bash
git status
git switch -c safe-cleanup/<nama-tugas>
```

Setelah patch:

```bash
npm run safety:check
git add -A
git commit -m "safe cleanup: <ringkasan>"
git push origin safe-cleanup/<nama-tugas>
```

## Arsitektur yang harus dijaga

- `index.js` melakukan boot engine, API, dashboard, dan WhatsApp connector.
- `src/core/engine.js` adalah orchestrator subsystem.
- `src/bot.js` menjaga koneksi WhatsApp/Baileys.
- `src/commandLoader.js` menjalankan command WhatsApp.
- `src/plugins/pluginManager.js` mengelola marketplace/registry plugin.
- `src/selfRepair/*` menangani deterministic repair dan AI fallback.
- `web/server.js` adalah dashboard web.
- `src/api/server.js` adalah REST API/WebSocket.

## Definisi rapih untuk project ini

Rapih bukan berarti membuat ulang. Rapih berarti:

- Tidak ada command duplikat.
- Command loader stabil dan predictable.
- Plugin ID terdokumentasi.
- Safety check tersedia.
- Secrets tidak ikut repo.
- Perubahan dibuat kecil dan mudah rollback.
- Fitur existing tetap dipertahankan.
