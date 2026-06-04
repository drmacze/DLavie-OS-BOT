const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('./config');
const { loadCommands, handleMessage } = require('./commandLoader');
const log = require('./logger');

const silentLogger = pino({ level: 'silent' });
let retryCount = 0;

function getRetryDelay() {
  const delay = Math.min(
    config.reconnect.initialDelay * Math.pow(config.reconnect.multiplier, retryCount),
    config.reconnect.maxDelay
  );
  return delay;
}

async function connectToWhatsApp() {
  log.info(`Memulai koneksi... (percobaan ke-${retryCount + 1})`);

  const { state, saveCreds } = await useMultiFileAuthState(config.session.dir);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  log.info(`Menggunakan WhatsApp Web v${version.join('.')} — isLatest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    logger: silentLogger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
    },
    browser: Browsers.ubuntu('Chrome'),
    printQRInTerminal: false,
    keepAliveIntervalMs: 15000,
    connectTimeoutMs: 30000,
    defaultQueryTimeoutMs: 60000,
    retryRequestDelayMs: 2000,
    maxMsgRetryCount: 5,
    fireInitQueries: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    getMessage: async () => undefined,
  });

  const commands = loadCommands();
  log.info(`${commands.size} command(s) dimuat.`);

  let pairingCodeSent = false;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (connection === 'connecting') {
      log.info('Menghubungkan ke WhatsApp...');

      if (!sock.authState.creds.registered && !pairingCodeSent) {
        pairingCodeSent = true;
        setTimeout(async () => {
          try {
            const rawNum = config.botNumber.replace(/[^0-9]/g, '');
            const code = await sock.requestPairingCode(rawNum);
            if (!code) throw new Error('Kode kosong diterima dari server');
            const fmt = code.match(/.{1,4}/g)?.join('-') ?? code;
            log.success('\n╔══════════════════════════════╗');
            log.success(`║  🔑 PAIRING CODE : ${fmt}  ║`);
            log.success('╚══════════════════════════════╝');
            log.info('Cara pairing: WhatsApp/WA Business → ⋮ Menu → Perangkat Tertaut → Tautkan Perangkat → Tautkan dengan nomor telepon → masukkan kode di atas.');
          } catch (err) {
            log.error('Gagal request pairing code:', err.message);
            pairingCodeSent = false;
          }
        }, 500);
      }
    }

    if (connection === 'open') {
      retryCount = 0;
      log.success(`✅ Bot "${config.botName}" berhasil terkoneksi!`);
      log.info(`Nomor bot  : ${config.botNumber}`);
      log.info(`Nomor owner: ${config.ownerNumber}`);
      log.info(`Prefix     : ${config.prefix}`);
    }

    if (connection === 'close') {
      pairingCodeSent = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      const reason = getDisconnectReason(code);
      log.warn(`Koneksi ditutup — kode: ${code ?? 'unknown'} (${reason})`);

      if (code === DisconnectReason.loggedOut) {
        log.error('Sesi logout! Hapus folder auth_info_baileys lalu restart bot.');
        return;
      }

      if (code === DisconnectReason.badSession) {
        log.error('Sesi rusak! Menghapus sesi lama dan reconnect...');
        try {
          const fs = require('fs');
          fs.rmSync(config.session.dir, { recursive: true, force: true });
        } catch (_) {}
        retryCount = 0;
      }

      retryCount++;
      const delay = getRetryDelay();
      log.info(`Reconnect dalam ${delay / 1000}s... (attempt #${retryCount})`);
      setTimeout(() => connectToWhatsApp().catch(log.error), delay);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    try {
      await handleMessage(sock, m, commands, config);
    } catch (err) {
      log.error('Error saat memproses pesan:', err.message);
    }
  });

  sock.ev.on('connection.update', (update) => {
    if (update.receivedPendingNotifications) {
      log.info('Notifikasi pending selesai dimuat.');
    }
  });

  return sock;
}

function getDisconnectReason(code) {
  const map = {
    [DisconnectReason.connectionClosed]:    'Connection closed',
    [DisconnectReason.connectionLost]:      'Connection lost',
    [DisconnectReason.connectionReplaced]:  'Connection replaced by another session',
    [DisconnectReason.loggedOut]:           'Logged out',
    [DisconnectReason.badSession]:          'Bad/corrupted session',
    [DisconnectReason.restartRequired]:     'Restart required',
    [DisconnectReason.timedOut]:            'Timed out',
    405:                                    'Method not allowed (rate limit / invalid number)',
    428:                                    'Connection closed by server',
  };
  return map[code] ?? 'Unknown reason';
}

module.exports = { connectToWhatsApp };
