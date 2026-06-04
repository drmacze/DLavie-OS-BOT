const TAG = '[DLAVIE]';

const logger = {
  info:    (...a) => console.log(`${TAG}[INFO]`, ...a),
  warn:    (...a) => console.warn(`${TAG}[WARN]`, ...a),
  error:   (...a) => console.error(`${TAG}[ERROR]`, ...a),
  success: (...a) => console.log(`${TAG}[OK]`, ...a),
  debug:   (...a) => { if (process.env.DEBUG) console.log(`${TAG}[DEBUG]`, ...a); },
};

module.exports = logger;
