/**
 * DLavie OS — Environment Tool Kit
 * Shared capabilities available to connected bot clients.
 * Each function is safe and stateless — call from any bot process.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Lazy-loaded heavy deps — only import when actually called
function _sharp() { return require('sharp'); }
function _ffmpeg() { return require('fluent-ffmpeg'); }
function _jimp() { return require('jimp'); }
function _axios() { return require('axios'); }
function _cheerio() { return require('cheerio'); }
function _fileType() { return require('file-type'); }
function _tesseract() { return require('tesseract.js'); }
function _qrCode() { return require('qrcode'); }
function _translate() { return require('@vitalets/google-translate-api'); }
function _phoneUtil() { return require('libphonenumber-js'); }

const TMP_DIR = path.join(__dirname, '..', '..', 'tmp', 'tools');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ─── 1. Health & Availability ───

function getEnvStatus() {
  return {
    node: process.version,
    platform: os.platform(),
    arch: os.arch(),
    tools: {
      sharp: safeCheck(() => require.resolve('sharp'), false),
      ffmpeg: safeCheck(() => require('child_process').execSync('ffmpeg -version', { encoding: 'utf8', timeout: 2000 }), false),
      jimp: safeCheck(() => require.resolve('jimp'), false),
      tesseract: safeCheck(() => require.resolve('tesseract.js'), false),
      axios: safeCheck(() => require.resolve('axios'), false),
      cheerio: safeCheck(() => require.resolve('cheerio'), false),
      fileType: safeCheck(() => require.resolve('file-type'), false),
      qrcode: safeCheck(() => require.resolve('qrcode'), false),
      translate: safeCheck(() => require.resolve('@vitalets/google-translate-api'), false),
      phoneUtil: safeCheck(() => require.resolve('libphonenumber-js'), false),
    }
  };
}

function safeCheck(fn, fallback) {
  try { fn(); return true; } catch { return fallback; }
}

// ─── 2. Media Processing ───

async function imageToSticker(buffer, options = {}) {
  const sharp = _sharp();
  const { crop = true, pack = 'DLavie', author = 'Bot' } = options;

  let pipeline = sharp(buffer, { animated: false });
  if (crop) {
    pipeline = pipeline.resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  } else {
    const meta = await sharp(buffer).metadata();
    const scale = Math.min(512 / (meta.width || 1), 512 / (meta.height || 1), 1);
    pipeline = pipeline.resize(
      Math.round((meta.width || 512) * scale),
      Math.round((meta.height || 512) * scale),
      { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }
    );
  }

  const webpBuffer = await pipeline.webp({ quality: 80, lossless: false }).toBuffer();
  return { buffer: webpBuffer, mimetype: 'image/webp' };
}

async function stickerToImage(buffer) {
  const sharp = _sharp();
  const pngBuffer = await sharp(buffer).png().toBuffer();
  return { buffer: pngBuffer, mimetype: 'image/png' };
}

async function videoToAnimatedSticker(inputPath, options = {}) {
  const ffmpeg = _ffmpeg();
  const { fps = 10, duration = 6 } = options;
  const outputPath = inputPath.replace(/\.[^.]+$/, '_sticker.webp');

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-vf', `fps=${fps},scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer`,
        '-loop', '0', '-an', '-vsync', '0', '-t', String(duration)
      ])
      .toFormat('webp')
      .save(outputPath)
      .on('end', () => {
        const buf = fs.readFileSync(outputPath);
        fs.unlinkSync(outputPath);
        resolve({ buffer: buf, mimetype: 'image/webp' });
      })
      .on('error', (err) => reject(err));
  });
}

async function resizeImage(buffer, width, height) {
  const sharp = _sharp();
  const resized = await sharp(buffer).resize(width, height, { fit: 'inside', withoutEnlargement: false }).toBuffer();
  return { buffer: resized };
}

async function imageToCircle(buffer) {
  const sharp = _sharp();
  const { width, height } = await sharp(buffer).metadata();
  const size = Math.min(width, height);
  const circled = await sharp(buffer)
    .resize(size, size, { fit: 'cover' })
    .composite([{
      input: Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`),
      blend: 'dest-in'
    }])
    .png().toBuffer();
  return { buffer: circled };
}

async function applyImageFilter(buffer, filter) {
  const Jimp = _jimp();
  const image = await Jimp.read(buffer);
  switch (filter) {
    case 'blur': image.blur(5); break;
    case 'greyscale': image.greyscale(); break;
    case 'sepia': image.sepia(); break;
    case 'invert': image.invert(); break;
    case 'brightness': image.brightness(0.3); break;
    case 'contrast': image.contrast(0.5); break;
    case 'flip': image.flip(true, false); break;
    case 'flop': image.flip(false, true); break;
    case 'rotate': image.rotate(90); break;
    case 'pixelate': image.pixelate(10); break;
    default: break;
  }
  const result = await image.getBufferAsync(Jimp.MIME_PNG);
  return { buffer: result };
}

async function memeOverlay(buffer, topText, bottomText) {
  const Jimp = _jimp();
  const image = await Jimp.read(buffer);
  const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
  const w = image.getWidth(), h = image.getHeight();
  image.print(font, 0, 20, { text: topText.toUpperCase(), alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, w, h);
  image.print(font, 0, h - 90, { text: bottomText.toUpperCase(), alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, w, h);
  const result = await image.getBufferAsync(Jimp.MIME_PNG);
  return { buffer: result };
}

async function videoToAudio(inputPath, format = 'mp3') {
  const ffmpeg = _ffmpeg();
  const outputPath = inputPath.replace(/\.[^.]+$/, `.${format}`);
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath).toFormat(format).save(outputPath)
      .on('end', () => { const buf = fs.readFileSync(outputPath); fs.unlinkSync(outputPath); resolve({ buffer: buf, mimetype: `audio/${format}` }); })
      .on('error', (err) => reject(err));
  });
}

async function videoToGif(inputPath) {
  const ffmpeg = _ffmpeg();
  const outputPath = inputPath.replace(/\.[^.]+$/, '.gif');
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(['-vf', 'fps=10,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse', '-loop', '0'])
      .toFormat('gif').save(outputPath)
      .on('end', () => { const buf = fs.readFileSync(outputPath); fs.unlinkSync(outputPath); resolve({ buffer: buf, mimetype: 'image/gif' }); })
      .on('error', (err) => reject(err));
  });
}

async function ocrImage(buffer, lang = 'eng') {
  const tesseract = _tesseract();
  const { createWorker } = tesseract;
  const worker = await createWorker();
  await worker.load();
  await worker.loadLanguage(lang);
  await worker.initialize(lang);
  const { data } = await worker.recognize(buffer);
  await worker.terminate();
  return { text: data.text, confidence: data.confidence };
}

async function detectMimeType(buffer) {
  const { fileTypeFromBuffer } = _fileType();
  const ft = await fileTypeFromBuffer(buffer);
  return ft || { mime: 'application/octet-stream', ext: 'bin' };
}

// ─── 3. Network & Download ───

async function downloadUrl(url, options = {}) {
  const axios = _axios();
  const { responseType = 'arraybuffer', timeout = 30000, headers = {} } = options;
  const resp = await axios.get(url, { responseType, timeout, headers, maxContentLength: 50 * 1024 * 1024 });
  return { buffer: Buffer.from(resp.data), contentType: resp.headers['content-type'] };
}

async function scrapeHtml(url, selector, options = {}) {
  const axios = _axios();
  const cheerio = _cheerio();
  const { timeout = 15000, attr = 'text' } = options;
  const resp = await axios.get(url, { timeout, headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(resp.data);
  const results = [];
  $(selector).each((_, el) => {
    results.push(attr === 'text' ? $(el).text().trim() : $(el).attr(attr));
  });
  return { results, count: results.length };
}

async function translateText(text, targetLang = 'id') {
  const { translate } = _translate();
  const result = await translate(text, { to: targetLang });
  return { text: result.text, from: result.from?.language?.iso || 'auto' };
}

// ─── 4. Utility ───

async function generateQRCode(text, options = {}) {
  const QRCode = _qrCode();
  const { width = 500, dark = '#000000', light = '#ffffff' } = options;
  const buffer = await QRCode.toBuffer(text, { width, color: { dark, light }, margin: 2, errorCorrectionLevel: 'H' });
  return { buffer, mimetype: 'image/png' };
}

function parsePhoneNumber(phone, country = 'ID') {
  const { parsePhoneNumber: parse } = _phoneUtil();
  try {
    const parsed = parse(phone, country);
    return {
      valid: parsed.isValid(),
      possible: parsed.isPossible(),
      country: parsed.country,
      countryCallingCode: parsed.countryCallingCode,
      nationalNumber: parsed.nationalNumber,
      format: parsed.formatInternational(),
      formatE164: parsed.format('E.164'),
      type: parsed.getType(),
    };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

function tmpFile(ext = 'tmp') {
  return path.join(TMP_DIR, `dlv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
}

function cleanTmp() {
  try {
    const files = fs.readdirSync(TMP_DIR);
    const now = Date.now();
    for (const f of files) {
      const fp = path.join(TMP_DIR, f);
      if (now - fs.statSync(fp).mtimeMs > 3600000) fs.unlinkSync(fp);
    }
  } catch (_) {}
}

setInterval(cleanTmp, 1800000);

module.exports = {
  getEnvStatus,

  // Media
  imageToSticker,
  stickerToImage,
  videoToAnimatedSticker,
  resizeImage,
  imageToCircle,
  applyImageFilter,
  memeOverlay,
  videoToAudio,
  videoToGif,
  ocrImage,
  detectMimeType,

  // Network
  downloadUrl,
  scrapeHtml,
  translateText,

  // Utility
  generateQRCode,
  parsePhoneNumber,
  sanitizeFilename,
  tmpFile,
  cleanTmp,
  TMP_DIR,
};
