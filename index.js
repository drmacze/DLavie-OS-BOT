require('dotenv').config();
const { connectToWhatsApp } = require('./src/bot');
const log = require('./src/logger');

process.on('uncaughtException', (err) => {
  log.error('uncaughtException:', err.message);
  log.error(err.stack ?? '');
});

process.on('unhandledRejection', (reason) => {
  log.error('unhandledRejection:', reason?.message ?? reason);
});

log.info('=== DLavie OS Bot v2.0.0 ===');
connectToWhatsApp().catch((err) => {
  log.error('Fatal startup error:', err.message);
  process.exit(1);
});
