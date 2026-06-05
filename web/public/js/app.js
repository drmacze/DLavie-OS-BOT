/**
 * DLavie OS — Web App JS v2.1
 * FIX: Bot display now works (ownerWebUserId fix)
 * NEW: QRIS payment + 5-min timer + proof upload
 * NEW: Bot customization
 * NEW: Pricing fix (free = no payment)
 */
'use strict';

// ─── API Client ───
const API = {
  base: window.location.origin,
  async request(method, path, body = null, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('dlv_token');
    if (auth && token) headers['Authorization'] = `Bearer ${token}`;
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    const res  = await fetch(this.base + path, options);
    const data = await res.json().catch(() => ({ error: 'Invalid response' }));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },
  get:    (p, auth=true)      => API.request('GET',    p, null, auth),
  post:   (p, b, auth=true)   => API.request('POST',   p, b, auth),
  put:    (p, b, auth=true)   => API.request('PUT',    p, b, auth),
  delete: (p, auth=true)      => API.request('DELETE', p, null, auth),
};

// ─── Auth helpers ───
const Auth = {
  save(token, user) { localStorage.setItem('dlv_token', token); localStorage.setItem('dlv_user', JSON.stringify(user)); },
  clear() { localStorage.removeItem('dlv_token'); localStorage.removeItem('dlv_user'); },
  get token()    { return localStorage.getItem('dlv_token'); },
  get user()     { const u = localStorage.getItem('dlv_user'); return u ? JSON.parse(u) : null; },
  get loggedIn() { return !!this.token; },
  guardDashboard() { if (!this.loggedIn) { window.location.href = '/login'; return false; } return true; },
  guardPublic()    { if (this.loggedIn)  { window.location.href = '/dashboard'; return false; } return true; },
};

// ─── Toast ───
function toast(message, type = 'info', duration = 4000) {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; c.className = 'toast-container'; document.body.appendChild(c); }
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type] || '💬'}</span><span>${message}</span>`;
  c.appendChild(el);
  setTimeout(() => { el.style.animation = 'slideIn 0.25s ease reverse'; setTimeout(() => el.remove(), 250); }, duration);
}

// ─── Loading ───
function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) { btn.dataset.origText = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true; }
  else { btn.innerHTML = btn.dataset.origText || btn.innerHTML; btn.disabled = false; }
}

// ─── Helpers ───
function fmtNumber(n) { return Number(n || 0).toLocaleString('id-ID'); }
function fmtDate(ts)  { return new Date(ts).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }); }
function fmtTime(ts)  { return new Date(ts).toLocaleString('id-ID'); }
function fmtRupiah(n) { return n === 0 ? 'Gratis' : 'Rp ' + Number(n).toLocaleString('id-ID'); }
function setEl(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function setSidebarActive(page) {
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.sidebar-item[data-page="${page}"]`)?.classList.add('active');
}
function closeModal(id) { const m = document.getElementById(id); if (m) m.style.display = 'none'; }
function logout() { Auth.clear(); window.location.href = '/'; }

async function copyText(text, label = 'Teks') {
  try { await navigator.clipboard.writeText(text); }
  catch (_) { const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); el.remove(); }
  toast(`${label} disalin!`, 'success', 2000);
}

function startCountdown(elementId, expiresAt) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const update = () => {
    const remaining = Math.max(0, expiresAt - Date.now());
    const min = Math.floor(remaining / 60000);
    const sec = Math.floor((remaining % 60000) / 1000);
    el.textContent = `${min}:${sec.toString().padStart(2,'0')}`;
    if (remaining <= 0) { el.textContent = 'Kadaluarsa'; el.style.color = 'var(--error)'; }
  };
  update();
  return setInterval(update, 1000);
}

// ─── Page: Login ───
function initLogin() {
  if (!Auth.guardPublic()) return;
  const form  = document.getElementById('login-form');
  const btn   = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim(), password = form.password.value;
    if (!email || !password) return toast('Isi email dan password', 'warning');
    setLoading(btn, true);
    if (errEl) errEl.textContent = '';
    try {
      const data = await API.post('/api/auth/login', { email, password }, false);
      Auth.save(data.token, data.user);
      toast('Login berhasil!', 'success', 1500);
      setTimeout(() => window.location.href = '/dashboard', 1500);
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
      else toast(err.message, 'error');
    } finally { setLoading(btn, false); }
  });
}

// ─── Page: Register ───
function initRegister() {
  if (!Auth.guardPublic()) return;
  const form  = document.getElementById('register-form');
  const btn   = document.getElementById('register-btn');
  const errEl = document.getElementById('register-error');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.fullname.value.trim(), email = form.email.value.trim(), password = form.password.value, confirm = form.confirm.value;
    if (!name || !email || !password) return toast('Lengkapi semua field', 'warning');
    if (password !== confirm) return toast('Password tidak cocok', 'error');
    if (password.length < 8) return toast('Password minimal 8 karakter', 'warning');
    setLoading(btn, true);
    if (errEl) errEl.textContent = '';
    try {
      const data = await API.post('/api/auth/register', { name, email, password }, false);
      Auth.save(data.token, data.user);
      toast('Akun berhasil dibuat! 🎉', 'success', 2000);
      setTimeout(() => window.location.href = '/dashboard', 2000);
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
      else toast(err.message, 'error');
    } finally { setLoading(btn, false); }
  });
}

// ─── Page: Dashboard ───
async function initDashboard() {
  if (!Auth.guardDashboard()) return;
  const user = Auth.user;
  setEl('user-name', user?.name || 'User');
  setEl('user-email', user?.email || '');
  setEl('user-plan-badge', (user?.plan || 'free').toUpperCase());
  try {
    const data = await API.get('/api/dashboard');
    const { stats, bots } = data;
    setEl('stat-tokens', fmtNumber(stats.tokenBalance));
    setEl('stat-bots',   stats.totalBots);
    setEl('stat-active', stats.activeBots);
    setEl('stat-commands', fmtNumber(stats.commandsToday));

    const botsEl = document.getElementById('recent-bots');
    if (botsEl) {
      if (!bots.length) {
        botsEl.innerHTML = '<div class="empty-state"><div class="icon">🤖</div><p>Belum ada bot terhubung.<br>Gunakan <code>!connect generate</code> di WhatsApp untuk menghubungkan bot.</p></div>';
      } else {
        botsEl.innerHTML = bots.map(b => `
          <div class="bot-card">
            <div class="bot-avatar">🤖</div>
            <div class="bot-info">
              <div class="flex items-center gap-8">
                <strong>+${b.botNumber}</strong>
                <span class="badge ${b.status==='active'?'badge-success':'badge-error'}">
                  <span class="dot dot-${b.status==='active'?'success':'error'}"></span>${b.status}
                </span>
              </div>
              <div class="bot-id mono small">${b.botId}</div>
            </div>
            <div class="bot-actions">
              <a href="/bots" class="btn btn-sm btn-secondary">Kelola</a>
            </div>
          </div>`).join('');
      }
    }
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Page: Bots ───
async function initBots() {
  if (!Auth.guardDashboard()) return;
  setSidebarActive('bots');
  try {
    const data = await API.get('/api/bots');
    renderBots(data.bots);
  } catch (err) { toast(err.message, 'error'); }
}

function renderBots(bots) {
  const el = document.getElementById('bots-list');
  if (!el) return;
  if (!bots || !bots.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="icon" style="font-size:2.5rem">🤖</div>
        <p style="margin-top:12px;font-size:0.95rem">Belum ada bot yang terhubung.</p>
        <p style="font-size:0.8rem;color:var(--text-3);margin-top:4px">Ikuti panduan di atas untuk menghubungkan bot pertamamu.</p>
      </div>`;
    return;
  }
  el.innerHTML = bots.map(b => {
    const isActive = b.status === 'active';
    const plan = (b.plan || 'free').toLowerCase();
    const planColor = { free: 'badge-secondary', starter: 'badge-primary', pro: 'badge-accent', enterprise: 'badge-warning' }[plan] || 'badge-secondary';
    return `
      <div class="bot-card" id="bot-${b.botId}">
        <div class="bot-avatar" style="font-size:1.8rem">🤖</div>
        <div class="bot-info" style="flex:1">
          <div class="flex items-center gap-8 flex-wrap">
            <strong>+${b.botNumber}</strong>
            <span class="badge ${isActive?'badge-success':'badge-error'}">
              <span class="dot dot-${isActive?'success':'error'}"></span>${isActive?'Online':'Offline'}
            </span>
            <span class="badge ${planColor}">${plan.toUpperCase()}</span>
          </div>
          <div class="mono small mt-4" style="color:var(--text-3)">${b.botId}</div>
          <div class="small dimmed mt-4">Terhubung: ${fmtTime(b.connectedAt)} · Cmd hari ini: ${b.stats?.commandsToday||0}</div>
        </div>
        <div class="bot-actions flex gap-8 flex-wrap">
          <button class="btn btn-sm btn-secondary" onclick="copyText('${b.botId}','Bot ID')" title="Copy ID">📋 ID</button>
          <button class="btn btn-sm btn-secondary" onclick="openBotSettings('${b.botId}')" title="Pengaturan">⚙️ Settings</button>
          <button class="btn btn-sm btn-ghost" onclick="relayBotCmd('${b.botId}','status')" title="Status">📊</button>
          <button class="btn btn-sm btn-ghost" onclick="relayBotCmd('${b.botId}','restart')" title="Restart">🔄</button>
          <button class="btn btn-sm btn-danger" onclick="disconnectBot('${b.botId}')" title="Lepas">✖ Lepas</button>
        </div>
      </div>`;
  }).join('');
}

async function disconnectBot(botId) {
  if (!confirm(`Yakin ingin melepas bot ${botId}?\nBot tidak bisa dikontrol lagi setelah ini.`)) return;
  try {
    await API.delete(`/api/bots/${botId}`);
    toast('Bot berhasil dilepas', 'success');
    initBots();
  } catch (err) { toast(err.message, 'error'); }
}

async function relayBotCmd(botId, cmd) {
  try {
    await API.post(`/api/bots/${botId}/relay`, { command: cmd });
    toast(`Command "${cmd}" dikirim ke bot ${botId}`, 'success');
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Bot Settings Modal ───
let currentBotId = null;
async function openBotSettings(botId) {
  currentBotId = botId;
  const modal = document.getElementById('bot-settings-modal');
  if (!modal) return;

  try {
    const data = await API.get(`/api/bots/${botId}/settings`);
    const s = data.settings || {};
    modal.querySelector('#bs-name')?.setAttribute('value', s.name || '');
    modal.querySelector('#bs-prefix')?.setAttribute('value', s.prefix || '!');
    modal.querySelector('#bs-bio')?.setAttribute('value', s.bio || '');
    modal.querySelector('#bs-language')?.setAttribute('value', s.language || 'id');
    modal.querySelector('#bs-timezone')?.setAttribute('value', s.timezone || 'Asia/Jakarta');
    modal.querySelector('#bs-menu-title')?.setAttribute('value', s.menuTitle || '');
    modal.querySelector('#bs-welcome')?.setAttribute('value', s.welcomeMsg || '');
    // Set form field values
    for (const [id, val] of Object.entries({
      'bs-name': s.name||'', 'bs-prefix': s.prefix||'!', 'bs-bio': s.bio||'',
      'bs-language': s.language||'id', 'bs-timezone': s.timezone||'Asia/Jakarta',
      'bs-menu-title': s.menuTitle||'', 'bs-welcome': s.welcomeMsg||''
    })) {
      const el = modal.querySelector(`#${id}`);
      if (el) el.value = val;
    }
    modal.querySelector('#bs-bot-id-display').textContent = botId;
    modal.style.display = 'flex';
  } catch (err) { toast(err.message, 'error'); }
}

async function saveBotSettings() {
  if (!currentBotId) return;
  const modal = document.getElementById('bot-settings-modal');
  const btn   = document.getElementById('bs-save-btn');
  setLoading(btn, true);
  try {
    const payload = {
      name:      modal.querySelector('#bs-name')?.value.trim(),
      prefix:    modal.querySelector('#bs-prefix')?.value.trim() || '!',
      bio:       modal.querySelector('#bs-bio')?.value.trim(),
      language:  modal.querySelector('#bs-language')?.value,
      timezone:  modal.querySelector('#bs-timezone')?.value,
      menuTitle: modal.querySelector('#bs-menu-title')?.value.trim(),
      welcomeMsg: modal.querySelector('#bs-welcome')?.value.trim(),
    };
    await API.put(`/api/bots/${currentBotId}/settings`, payload);
    toast('Pengaturan bot disimpan!', 'success');
    closeModal('bot-settings-modal');
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(btn, false); }
}

// ─── Page: Tokens ───
let paymentState = { payId: null, expiresAt: null, countdown: null, amount: 0, tokens: 0 };

async function initTokens() {
  if (!Auth.guardDashboard()) return;
  setSidebarActive('tokens');
  try {
    const data = await API.get('/api/tokens');
    setEl('token-balance', fmtNumber(data.balance));
    setEl('token-plan', (data.plan||'free').toUpperCase());

    const qrisEl = document.getElementById('qris-img-static');
    if (qrisEl && data.qrisImage) { qrisEl.src = data.qrisImage; qrisEl.style.display = 'block'; const ph = document.getElementById('qris-placeholder'); if (ph) ph.style.display = 'none'; }

    const pkgsEl = document.getElementById('token-packages');
    if (pkgsEl && data.packages) {
      pkgsEl.innerHTML = data.packages.map(pkg => `
        <div class="card" style="text-align:center;cursor:pointer" onclick="initiatePayment('token','${pkg.id}',${pkg.priceIdr},${pkg.tokens},'${pkg.label}')">
          <div style="font-size:1.8rem;font-weight:900;color:var(--primary-l)">${fmtNumber(pkg.tokens)}</div>
          <div class="dimmed small">Token</div>
          ${pkg.bonus ? `<div style="font-size:0.75rem;color:var(--success);margin-top:2px">${pkg.bonus}</div>` : ''}
          <div style="font-size:1.3rem;font-weight:800;margin:12px 0">${fmtRupiah(pkg.priceIdr)}</div>
          <button class="btn btn-primary btn-full">Topup</button>
        </div>`).join('');
    }

    // Load payment history
    const histData = await API.get('/api/payment/list');
    renderPaymentHistory(histData.payments);
  } catch (err) { toast(err.message, 'error'); }
}

function renderPaymentHistory(payments) {
  const el = document.getElementById('payment-history');
  if (!el) return;
  if (!payments || !payments.length) { el.innerHTML = '<p class="dimmed small text-center">Belum ada riwayat pembayaran.</p>'; return; }
  const statusColor = { approved: 'badge-success', rejected: 'badge-error', pending_proof: 'badge-warning', proof_submitted: 'badge-primary', expired: 'badge-secondary', cancelled: 'badge-secondary' };
  const statusLabel = { approved: '✅ Approved', rejected: '❌ Ditolak', pending_proof: '⏳ Menunggu Bukti', proof_submitted: '📋 Diproses', expired: '⌛ Expired', cancelled: '✖ Dibatalkan' };
  el.innerHTML = payments.map(p => `
    <div class="flex items-center justify-between" style="padding:10px 0;border-bottom:1px solid var(--border-dim)">
      <div>
        <div class="small mono" style="color:var(--primary-l)">${p.payId}</div>
        <div class="small dimmed">${fmtDate(p.createdAt)} · ${fmtRupiah(p.amount)} · ${fmtNumber(p.tokens)} token</div>
      </div>
      <span class="badge ${statusColor[p.status]||'badge-secondary'}">${statusLabel[p.status]||p.status}</span>
    </div>`).join('');
}

async function initiatePayment(type, packageId, amount, tokens, label) {
  try {
    const data = await API.post('/api/payment/initiate', { type, packageId, amount, tokens });
    paymentState = { payId: data.payId, expiresAt: data.expiresAt, amount, tokens };

    // Show QRIS payment modal
    const modal = document.getElementById('qris-payment-modal');
    if (!modal) { toast(`Payment dibuat: ${data.payId}`, 'info', 6000); return; }

    setEl('qris-pay-label', label || `${fmtNumber(tokens)} Token`);
    setEl('qris-pay-amount', fmtRupiah(amount));
    setEl('qris-pay-id', data.payId);
    setEl('qris-owner-wa', data.ownerWa || '');

    const qrisImg = document.getElementById('qris-modal-img');
    const qrisPh  = document.getElementById('qris-modal-placeholder');
    if (qrisImg && data.qrisImage) { qrisImg.src = data.qrisImage; qrisImg.style.display = 'block'; if (qrisPh) qrisPh.style.display = 'none'; }

    if (paymentState.countdown) clearInterval(paymentState.countdown);
    paymentState.countdown = startCountdown('qris-timer', data.expiresAt);

    // Show payment form, hide proof form initially
    const payStep = document.getElementById('qris-step-pay');
    const proofStep = document.getElementById('qris-step-proof');
    const successStep = document.getElementById('qris-step-success');
    if (payStep)  payStep.style.display  = 'block';
    if (proofStep) proofStep.style.display = 'none';
    if (successStep) successStep.style.display = 'none';

    modal.style.display = 'flex';

    if (data.existing) toast('Melanjutkan payment yang belum selesai.', 'info');
  } catch (err) { toast(err.message, 'error'); }
}

function showProofForm() {
  document.getElementById('qris-step-pay').style.display = 'none';
  document.getElementById('qris-step-proof').style.display = 'block';
}

// Proof image preview
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('proof-image-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Gambar maksimal 5MB', 'warning'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = document.getElementById('proof-preview');
      if (preview) { preview.src = ev.target.result; preview.style.display = 'block'; }
      paymentState.proofBase64 = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
});

async function submitProof() {
  if (!paymentState.payId) { toast('Tidak ada payment aktif.', 'error'); return; }
  const buyerName = document.getElementById('proof-buyer-name')?.value.trim();
  if (!buyerName) { toast('Masukkan nama pembayar!', 'warning'); return; }

  const btn = document.getElementById('submit-proof-btn');
  setLoading(btn, true);
  try {
    await API.post('/api/payment/proof', {
      payId: paymentState.payId,
      buyerName,
      proofImage: paymentState.proofBase64 || null,
    });

    if (paymentState.countdown) clearInterval(paymentState.countdown);
    document.getElementById('qris-step-proof').style.display = 'none';
    document.getElementById('qris-step-success').style.display = 'block';
    setEl('success-pay-id', paymentState.payId);

    toast('Bukti pembayaran terkirim! Admin akan memproses segera.', 'success', 6000);

    // Refresh payment history
    const histData = await API.get('/api/payment/list');
    renderPaymentHistory(histData.payments);
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(btn, false); }
}

async function cancelPayment() {
  if (!paymentState.payId || !confirm('Batalkan payment ini?')) return;
  try {
    await API.delete(`/api/payment/${paymentState.payId}`);
    if (paymentState.countdown) clearInterval(paymentState.countdown);
    closeModal('qris-payment-modal');
    toast('Payment dibatalkan.', 'info');
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Bot Code (di dashboard) ───
let codeCountdownInterval = null;
async function generateBotCode() {
  const btn    = document.getElementById('gen-code-btn');
  const codeEl = document.getElementById('bot-code-value');
  const section= document.getElementById('code-section');
  setLoading(btn, true);
  try {
    const data = await API.post('/api/bot/code');
    if (codeEl) codeEl.textContent = data.code;
    if (section) section.style.display = 'block';
    if (codeCountdownInterval) clearInterval(codeCountdownInterval);
    codeCountdownInterval = startCountdown('code-timer', data.expiresAt);
    toast('Kode berhasil dibuat! Berlaku 10 menit.', 'success');
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(btn, false); }
}

// ─── Page: Settings ───
async function initSettings() {
  if (!Auth.guardDashboard()) return;
  setSidebarActive('settings');
  const user = Auth.user;
  const nameEl  = document.getElementById('settings-name');
  const emailEl = document.getElementById('settings-email');
  const keyEl   = document.getElementById('settings-access-key');
  if (nameEl && user)  nameEl.value  = user.name  || '';
  if (emailEl && user) emailEl.value = user.email || '';
  if (keyEl && user)   keyEl.value   = user.accessKey || '(belum ada)';

  document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('settings-save-btn');
    setLoading(btn, true);
    try {
      const name = document.getElementById('settings-name')?.value.trim();
      const currentPassword = document.getElementById('settings-current-pass')?.value;
      const newPassword     = document.getElementById('settings-new-pass')?.value;
      const payload = { name };
      if (currentPassword && newPassword) { payload.currentPassword = currentPassword; payload.newPassword = newPassword; }
      const data = await API.put('/api/auth/profile', payload);
      const updated = { ...Auth.user, name: data.user.name };
      localStorage.setItem('dlv_user', JSON.stringify(updated));
      toast('Profil berhasil diperbarui!', 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { setLoading(btn, false); }
  });

  // Load fresh user data for access key
  try {
    const data = await API.get('/api/auth/me');
    if (keyEl && data.user.accessKey) keyEl.value = data.user.accessKey;
  } catch(_){}
}

// ─── Page: Pricing ───
async function initPricing() {
  try {
    const data  = await API.get('/api/pricing', false);
    const grid  = document.getElementById('pricing-grid');
    if (!grid) return;
    const order    = ['free', 'starter', 'pro', 'enterprise'];
    const featured = 'pro';
    const userPlan = Auth.user?.plan || null;

    grid.innerHTML = order.map(key => {
      const plan = data.plans[key];
      if (!plan) return '';
      const price      = plan.priceIdr === 0 ? 'Gratis' : `Rp ${fmtNumber(plan.priceIdr)}`;
      const period     = plan.priceIdr === 0 ? '' : '<span style="font-size:0.9rem;opacity:0.6">/bulan</span>';
      const tokensText = plan.tokens === -1 ? 'Unlimited' : fmtNumber(plan.tokens);
      const isFeatured = key === featured;
      const isCurrent  = userPlan === key;

      let ctaHtml = '';
      if (isCurrent) {
        ctaHtml = `<button class="btn btn-secondary btn-full btn-lg" disabled>✅ Plan Aktif</button>`;
      } else if (plan.priceIdr === 0) {
        // Free plan — langsung daftar, no payment
        if (Auth.loggedIn) {
          ctaHtml = `<button class="btn btn-secondary btn-full btn-lg" onclick="window.location.href='/dashboard'">Ke Dashboard</button>`;
        } else {
          ctaHtml = `<button class="btn btn-secondary btn-full btn-lg" onclick="window.location.href='/register'">Mulai Gratis</button>`;
        }
      } else {
        // Paid plan — trigger QRIS payment
        if (Auth.loggedIn) {
          ctaHtml = `<button class="btn ${isFeatured ? 'btn-primary' : 'btn-secondary'} btn-full btn-lg" onclick="initiatePlanPayment('${key}',${plan.priceIdr})">Pilih ${plan.name}</button>`;
        } else {
          ctaHtml = `<button class="btn ${isFeatured ? 'btn-primary' : 'btn-secondary'} btn-full btn-lg" onclick="window.location.href='/register'">Mulai Sekarang</button>`;
        }
      }

      return `
        <div class="pricing-card ${isFeatured ? 'featured' : ''} ${isCurrent ? 'current-plan' : ''}">
          ${isCurrent ? '<div class="plan-current-badge">Plan Kamu</div>' : ''}
          <div class="pricing-name">${plan.name}</div>
          <div class="pricing-price">${price}${period}</div>
          <div class="small dimmed">🪙 ${tokensText} Token/bulan • 🤖 ${plan.maxBots === -1 ? 'Unlimited' : plan.maxBots} Bot</div>
          <hr class="divider mt-16 mb-16">
          <ul class="pricing-features">
            ${plan.features.map(f => `<li${f.includes('NO Queue') ? ' class="no-queue"' : ''}>${f}</li>`).join('')}
          </ul>
          <div class="pricing-cta mt-24">${ctaHtml}</div>
        </div>`;
    }).join('');
  } catch (err) { console.error('Pricing load error:', err); }
}

async function initiatePlanPayment(planName, amount) {
  if (!Auth.loggedIn) { window.location.href = '/register'; return; }
  // Redirect to tokens page with plan payment
  window.location.href = '/tokens?plan=' + planName;
}

// Handle plan payment from URL param on tokens page
function checkPlanPaymentParam() {
  const urlParams = new URLSearchParams(window.location.search);
  const plan = urlParams.get('plan');
  if (plan) {
    const planMeta = { starter: { price: 29000, tokens: 25000, label: 'Plan Starter' }, pro: { price: 79000, tokens: 100000, label: 'Plan Pro' }, enterprise: { price: 199000, tokens: 500000, label: 'Plan Enterprise' } };
    const meta = planMeta[plan];
    if (meta) {
      setTimeout(() => initiatePayment('plan', null, meta.price, meta.tokens, meta.label), 500);
    }
  }
}

function showConnectGuide() {
  toast('Ikuti panduan di bagian atas halaman untuk menghubungkan bot.', 'info', 5000);
}

// ─── Auto-init ───
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  const user = Auth.user;

  if (user) {
    setEl('nav-user-name', user.name);
    const logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    const loginBtn = document.getElementById('nav-login');
    if (loginBtn) loginBtn.style.display = 'none';
  }

  if (path === '/login')      initLogin();
  if (path === '/register')   initRegister();
  if (path === '/dashboard')  initDashboard();
  if (path === '/bots')       initBots();
  if (path === '/tokens')     { initTokens(); checkPlanPaymentParam(); }
  if (path === '/settings')   initSettings();
  if (path === '/pricing')    initPricing();
});

// ══════════════════════════════════════════════
// POPUP SYSTEM
// ══════════════════════════════════════════════

async function checkPopup() {
  try {
    const popup = await API.get('/api/popup', false);
    if (!popup.active || !popup.title) return;

    // Don't show popup on login/register/landing
    const path = window.location.pathname;
    if (['/login', '/register', '/'].includes(path)) return;

    // Don't show if dismissed this session
    const dismissKey = `dlv_popup_${popup.updatedAt || popup.createdAt}`;
    if (sessionStorage.getItem(dismissKey)) return;

    showPopupModal(popup, dismissKey);
  } catch(_) {}
}

function showPopupModal(popup, dismissKey) {
  // Create overlay
  const typeColors = {
    info:    { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.3)',  icon: 'ℹ️', header: '#93c5fd' },
    success: { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.3)',  icon: '✅', header: '#6ee7b7' },
    warning: { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.3)',  icon: '⚠️', header: '#fcd34d' },
    error:   { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)',   icon: '🔴', header: '#fca5a5' },
  };
  const c = typeColors[popup.type || 'info'] || typeColors.info;

  const overlay = document.createElement('div');
  overlay.id = 'popup-overlay';
  overlay.style.cssText = `position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease`;

  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid ${c.border};border-radius:20px;max-width:520px;width:100%;padding:0;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);animation:slideUp 0.25s ease">
      <div style="background:${c.bg};border-bottom:1px solid ${c.border};padding:24px 28px;display:flex;align-items:center;gap:14px">
        <span style="font-size:2rem">${c.icon}</span>
        <div style="flex:1">
          <div style="font-size:1.1rem;font-weight:800;color:${c.header}">${popup.title}</div>
        </div>
        <button onclick="dismissPopup('${dismissKey}')" style="background:none;border:none;color:var(--text-2);cursor:pointer;font-size:1.2rem;padding:4px;border-radius:6px">✕</button>
      </div>
      <div style="padding:24px 28px">
        <p style="color:var(--text-2);line-height:1.7;font-size:0.95rem">${popup.description || ''}</p>
        <button onclick="dismissPopup('${dismissKey}')" class="btn btn-primary" style="margin-top:20px;width:100%">OK, Mengerti</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) dismissPopup(dismissKey); });
}

function dismissPopup(dismissKey) {
  const overlay = document.getElementById('popup-overlay');
  if (overlay) overlay.remove();
  if (dismissKey) sessionStorage.setItem(dismissKey, '1');
}


// ══════════════════════════════════════════════
// OWNER FEATURES — Show/hide owner-only elements
// ══════════════════════════════════════════════

async function checkOwnerFeatures() {
  try {
    const me = await API.get('/api/auth/me');
    if (!me.user?.isOwner) return;

    // Show owner-only sidebar items
    document.querySelectorAll('.owner-only').forEach(el => el.style.display = '');

    // Add owner badge to navbar
    const navbar = document.querySelector('.navbar-actions');
    if (navbar && !document.getElementById('owner-badge')) {
      const badge = document.createElement('span');
      badge.id = 'owner-badge';
      badge.className = 'badge';
      badge.style.cssText = 'background:rgba(239,68,68,0.12);color:#f87171;border-color:rgba(239,68,68,0.3);font-size:0.7rem;padding:3px 9px';
      badge.textContent = '👑 OWNER';
      navbar.insertBefore(badge, navbar.firstChild);
    }

    // Update localStorage user with isOwner flag
    const stored = Auth.user;
    if (stored && !stored.isOwner) {
      Auth.save(Auth.token, { ...stored, isOwner: true });
    }
  } catch(_) {}
}


// ══════════════════════════════════════════════
// PAGE: Admin
// ══════════════════════════════════════════════

async function initAdmin() {
  if (!Auth.guardDashboard()) return;
  // Admin page handles its own init inline
}


// ══════════════════════════════════════════════
// AUTO-INIT — extended for new pages
// ══════════════════════════════════════════════

// Extend the existing DOMContentLoaded handler to cover new routes
(function() {
  const origHandler = document.addEventListener;
  // We override by adding another listener
  window.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // Check popup and owner features on ALL dashboard pages
    if (['/dashboard','/bots','/tokens','/settings','/pricing','/admin','/terminal','/files','/ssh'].includes(path)) {
      if (Auth.loggedIn) {
        checkOwnerFeatures();
        checkPopup();
      }
    }

    // New pages init
    if (path === '/admin') {
      // admin.html handles its own init inline
    }
  }, { once: false });
})();
