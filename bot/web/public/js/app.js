/**
 * DLavie OS — Web App JS v3.0
 * Modern • Dark/Light Mode • Premium UI
 */

'use strict';

// ─── Theme Manager ───────────────────────────────────────
const Theme = {
  KEY: 'dlv_theme',

  get() { return localStorage.getItem(this.KEY) || 'dark'; },

  set(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.KEY, theme);
    this._updateToggleIcons(theme);
  },

  toggle() {
    const current = this.get();
    this.set(current === 'dark' ? 'light' : 'dark');
  },

  init() {
    const saved = this.get();
    document.documentElement.setAttribute('data-theme', saved);
    this._updateToggleIcons(saved);
  },

  _updateToggleIcons(theme) {
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
      btn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    });
  },
};

// ─── API Client ───────────────────────────────────────────
const API = {
  base: window.location.origin,

  async request(method, path, body = null, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('dlv_token');
    if (auth && token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(this.base + path, options);
    const data = await res.json().catch(() => ({ error: 'Invalid response' }));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  get:    (path, auth)       => API.request('GET',    path, null, auth),
  post:   (path, body, auth) => API.request('POST',   path, body, auth),
  put:    (path, body, auth) => API.request('PUT',    path, body, auth),
  patch:  (path, body, auth) => API.request('PATCH',  path, body, auth),
  delete: (path, auth)       => API.request('DELETE', path, null, auth),
};

// ─── Auth helpers ────────────────────────────────────────
const Auth = {
  save(token, user) {
    localStorage.setItem('dlv_token', token);
    localStorage.setItem('dlv_user',  JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('dlv_token');
    localStorage.removeItem('dlv_user');
  },
  get token()    { return localStorage.getItem('dlv_token'); },
  get user()     { const u = localStorage.getItem('dlv_user'); return u ? JSON.parse(u) : null; },
  get loggedIn() { return !!this.token; },
  guardDashboard() {
    if (!this.loggedIn) { window.location.href = '/login'; return false; }
    return true;
  },
  guardPublic() {
    if (this.loggedIn) { window.location.href = '/dashboard'; return false; }
    return true;
  },
};

// ─── Toast ───────────────────────────────────────────────
function toast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span style="flex-shrink:0">${icons[type] || '💬'}</span><span style="flex:1">${message}</span><button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:1rem;padding:0;margin-left:6px;flex-shrink:0">×</button>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'all 0.2s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateX(110%)';
    setTimeout(() => el.remove(), 200);
  }, duration);
}

// ─── Loading state ───────────────────────────────────────
function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.origText || btn.innerHTML;
    btn.disabled = false;
  }
}

// ─── Format ──────────────────────────────────────────────
function fmtNumber(n) { return Number(n || 0).toLocaleString('id-ID'); }
function fmtDate(ts)  { return new Date(ts).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }); }
function fmtTime(ts)  { return new Date(ts).toLocaleString('id-ID'); }
function fmtRupiah(n) {
  if (n === 0) return 'Gratis';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}
function fmtBytes(b) {
  if (!b) return '0B';
  if (b < 1024) return b + 'B';
  if (b < 1048576) return (b/1024).toFixed(1) + 'KB';
  return (b/1048576).toFixed(1) + 'MB';
}
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h/24)} hari lalu`;
}

// ─── Countdown ───────────────────────────────────────────
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

// ─── Copy ────────────────────────────────────────────────
async function copyText(text, label = 'Teks') {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} disalin!`, 'success', 2000);
  } catch (_) {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed'; el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    el.remove();
    toast(`${label} disalin!`, 'success', 2000);
  }
}

// ─── Helpers ─────────────────────────────────────────────
function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(text ?? '');
}

function setSidebarActive(page) {
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  const target = document.querySelector(`.sidebar-item[data-page="${page}"]`);
  if (target) target.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.opacity = '0';
    setTimeout(() => { modal.style.display = 'none'; modal.style.opacity = ''; }, 150);
  }
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'flex';
}

function logout() { Auth.clear(); window.location.href = '/'; }
function showConnectGuide() {
  toast('Kirim `!connect generate` ke DLavie OS Bot untuk token koneksi.', 'info', 5000);
}
function relayCmd(botId, cmd) {
  toast(`Relay "${cmd}" → ${botId}. Gunakan !relay di bot untuk kontrol penuh.`, 'info', 4000);
}

// ─── Popup system ────────────────────────────────────────
async function checkPopup() {
  try {
    const data = await API.get('/api/public/popup', false);
    if (!data?.active) return;
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay active';
    overlay.innerHTML = `
      <div class="popup-card">
        <button class="popup-close" onclick="this.closest('.popup-overlay').remove()">✕</button>
        <div style="font-size:2rem;margin-bottom:14px">${data.icon || '📢'}</div>
        <h3 style="margin-bottom:8px">${data.title || 'Pengumuman'}</h3>
        <p style="font-size:0.875rem;margin-bottom:20px">${data.message || ''}</p>
        ${data.buttonText ? `<button class="btn btn-primary" onclick="this.closest('.popup-overlay').remove()">${data.buttonText}</button>` : ''}
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  } catch (_) {}
}

// ─── Page: Login ─────────────────────────────────────────
async function initLogin() {
  if (!Auth.guardPublic()) return;
  const form  = document.getElementById('login-form');
  const btn   = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) return toast('Isi email dan password', 'warning');
    setLoading(btn, true);
    if (errEl) errEl.textContent = '';
    try {
      const data = await API.post('/api/auth/login', { email, password }, false);
      Auth.save(data.token, data.user);
      toast('Login berhasil!', 'success', 1500);
      setTimeout(() => window.location.href = '/dashboard', 800);
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
      else toast(err.message, 'error');
    } finally { setLoading(btn, false); }
  });
}

// ─── Page: Register ──────────────────────────────────────
async function initRegister() {
  if (!Auth.guardPublic()) return;
  const form  = document.getElementById('register-form');
  const btn   = document.getElementById('register-btn');
  const errEl = document.getElementById('register-error');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name     = form.fullname.value.trim();
    const email    = form.email.value.trim();
    const password = form.password.value;
    const confirm  = form.confirm.value;
    if (!name || !email || !password) return toast('Lengkapi semua field', 'warning');
    if (password !== confirm) return toast('Password tidak cocok', 'error');
    if (password.length < 8)  return toast('Password minimal 8 karakter', 'warning');
    setLoading(btn, true);
    if (errEl) errEl.textContent = '';
    try {
      const data = await API.post('/api/auth/register', { name, email, password }, false);
      Auth.save(data.token, data.user);
      toast('Akun berhasil dibuat! 🎉', 'success', 2000);
      setTimeout(() => window.location.href = '/dashboard', 1000);
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
      else toast(err.message, 'error');
    } finally { setLoading(btn, false); }
  });
}

// ─── Page: Dashboard ─────────────────────────────────────
async function initDashboard() {
  if (!Auth.guardDashboard()) return;
  const user = Auth.user;
  setEl('user-name', user?.name || 'User');
  setEl('user-email', user?.email || '');
  setEl('user-plan-badge', (user?.plan || 'free').toUpperCase());

  // Update sidebar user info
  setEl('sidebar-user-name', user?.name || 'User');
  setEl('sidebar-user-plan', (user?.plan || 'free').toUpperCase());
  const avatarEl = document.getElementById('sidebar-avatar');
  if (avatarEl && user?.name) avatarEl.textContent = user.name.charAt(0).toUpperCase();

  try {
    const data = await API.get('/api/dashboard');
    const { stats, bots } = data;
    setEl('stat-tokens', fmtNumber(stats.tokenBalance));
    setEl('stat-bots', stats.totalBots);
    setEl('stat-active', stats.activeBots);
    setEl('stat-commands', fmtNumber(stats.commandsToday || 0));

    const botsEl = document.getElementById('recent-bots');
    if (botsEl) {
      if (!bots?.length) {
        botsEl.innerHTML = `<div class="empty-state">
          <div class="icon">🤖</div>
          <p style="font-weight:600;margin-bottom:6px">Belum ada bot terhubung</p>
          <p style="font-size:0.8rem">Klik <strong>Get Bot Code</strong> → kirim ke DLavie OS Bot → <code>!connect generate</code></p>
        </div>`;
      } else {
        botsEl.innerHTML = bots.map(b => `
          <div class="bot-card">
            <div class="bot-avatar">🤖</div>
            <div class="bot-info">
              <div class="flex items-center gap-8 flex-wrap">
                <strong style="font-size:0.9rem">${b.botNumber || '-'}</strong>
                <span class="badge ${b.status==='active'?'badge-success':'badge-error'}">
                  <span class="dot dot-${b.status==='active'?'success':'error'} dot-pulse"></span>
                  ${b.status}
                </span>
                <span class="badge badge-neutral">${(b.plan||'free').toUpperCase()}</span>
              </div>
              <div class="bot-id mt-4">${b.botId}</div>
              <div class="small dimmed mt-4">${timeAgo(b.connectedAt)} • ${timeAgo(b.lastPing || b.connectedAt)} terakhir ping</div>
            </div>
            <div class="bot-actions">
              <button class="btn btn-sm btn-secondary" onclick="relayCmd('${b.botId}','status')">Status</button>
            </div>
          </div>`).join('');
      }
    }
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Page: Bots ──────────────────────────────────────────
async function initBots() {
  if (!Auth.guardDashboard()) return;
  try {
    const data = await API.get('/api/bots');
    renderBots(data.bots);
  } catch (err) { toast(err.message, 'error'); }
}

function renderBots(bots) {
  const el = document.getElementById('bots-list');
  if (!el) return;
  if (!bots?.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">🤖</div><p>Belum ada bot terhubung.</p><button class="btn btn-primary mt-16" onclick="showConnectGuide()">Hubungkan Bot Pertama</button></div>`;
    return;
  }
  el.innerHTML = bots.map(b => `
    <div class="bot-card">
      <div class="bot-avatar">🤖</div>
      <div class="bot-info">
        <div class="flex items-center gap-8 flex-wrap">
          <strong>${b.botNumber}</strong>
          <span class="badge ${b.status==='active'?'badge-success':'badge-error'}">
            <span class="dot dot-${b.status==='active'?'success':'error'}"></span>${b.status}
          </span>
          <span class="badge badge-neutral">${(b.plan||'free').toUpperCase()}</span>
        </div>
        <div class="bot-id">${b.botId}</div>
        <div class="small dimmed mt-4">${timeAgo(b.connectedAt)}</div>
      </div>
      <div class="bot-actions">
        <button class="btn btn-sm btn-secondary" onclick="copyText('${b.botId}','Bot ID')">Copy ID</button>
        <button class="btn btn-sm btn-danger"    onclick="disconnectBot('${b.botId}')">Lepas</button>
      </div>
    </div>`).join('');
}

async function disconnectBot(botId) {
  if (!confirm(`Yakin ingin melepas bot ${botId}?`)) return;
  try {
    await API.delete(`/api/bots/${botId}`);
    toast('Bot berhasil dilepas', 'success');
    initBots();
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Page: Token ─────────────────────────────────────────
async function initTokens() {
  if (!Auth.guardDashboard()) return;
  try {
    const data = await API.get('/api/tokens');
    setEl('token-balance', fmtNumber(data.balance));
    setEl('token-plan', (data.plan||'free').toUpperCase());

    const qrisEl = document.getElementById('qris-image');
    if (qrisEl && data.qrisImage) { qrisEl.src = data.qrisImage; qrisEl.style.display = 'block'; }

    const pkgsEl = document.getElementById('token-packages');
    if (pkgsEl && data.packages) {
      pkgsEl.innerHTML = data.packages.map(pkg => `
        <div class="card card-glow" style="text-align:center;cursor:pointer" onclick="topupPackage('${pkg.id}')">
          <div style="font-size:1.5rem;font-weight:900;color:var(--primary-l);letter-spacing:-0.03em">${fmtNumber(pkg.tokens)}</div>
          <div class="small dimmed mt-4">Token</div>
          <div style="font-size:1.1rem;font-weight:800;margin:10px 0">${fmtRupiah(pkg.priceIdr)}</div>
          <div class="small dimmed mb-12">${(pkg.tokens/pkg.priceIdr).toFixed(0)} token/IDR</div>
          <button class="btn btn-primary btn-full btn-sm">Pilih</button>
        </div>`).join('');
    }
  } catch (err) { toast(err.message, 'error'); }
}

async function topupPackage(packageId) {
  try {
    const data = await API.post('/api/tokens/topup', { packageId });
    showTopupModal(data);
  } catch (err) { toast(err.message, 'error'); }
}

async function requestTopup(packageId, amount, tokens) {
  try {
    const data = await API.post('/api/tokens/topup', { packageId });
    showTopupModal(data);
  } catch (err) { toast(err.message, 'error'); }
}

function showTopupModal(data) {
  if (data.tokens) setEl('modal-tokens', `🪙 ${fmtNumber(data.tokens)} Token`);
  if (data.priceIdr) setEl('modal-amount', `Rp ${fmtNumber(data.priceIdr)}`);
  if (data.strukId) setEl('modal-struk-id', data.strukId);
  const oldId = document.getElementById('topup-id');
  if (oldId && data.strukId) oldId.textContent = data.strukId;
  openModal('topup-modal');
}

// ─── Page: Bot Code ──────────────────────────────────────
let codeCountdownInterval = null;

async function generateBotCode() {
  const btn     = document.getElementById('gen-code-btn');
  const codeEl  = document.getElementById('bot-code-value');
  const section = document.getElementById('code-section');
  setLoading(btn, true);
  try {
    const data = await API.post('/api/bot/code');
    if (codeEl)  codeEl.textContent = data.code;
    if (section) section.style.display = 'block';
    if (codeCountdownInterval) clearInterval(codeCountdownInterval);
    codeCountdownInterval = startCountdown('code-timer', data.expiresAt);
    const hint = document.getElementById('code-hint');
    if (hint) hint.textContent = data.code;
    toast('Kode berhasil dibuat! Berlaku 10 menit.', 'success');
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(btn, false); }
}

// ─── Page: Settings ──────────────────────────────────────
async function initSettings() {
  if (!Auth.guardDashboard()) return;
  const user = Auth.user;
  const nameInput  = document.getElementById('settings-name');
  const emailInput = document.getElementById('settings-email');
  if (nameInput  && user) nameInput.value  = user.name  || '';
  if (emailInput && user) emailInput.value = user.email || '';

  document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('settings-save-btn');
    setLoading(btn, true);
    try {
      const name            = document.getElementById('settings-name')?.value.trim();
      const currentPassword = document.getElementById('settings-current-pass')?.value;
      const newPassword     = document.getElementById('settings-new-pass')?.value;
      const payload = { name };
      if (currentPassword && newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword     = newPassword;
      }
      const data = await API.put('/api/auth/profile', payload);
      const updated = { ...Auth.user, name: data.user.name };
      localStorage.setItem('dlv_user', JSON.stringify(updated));
      toast('Profil berhasil diperbarui!', 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { setLoading(btn, false); }
  });
}

// ─── Page: Pricing ───────────────────────────────────────
async function initPricing() {
  try {
    const data = await API.get('/api/pricing', false);
    window.__pricingData = data;
    const grid = document.getElementById('pricing-grid');
    if (!grid) return;
    const order = ['free','starter','pro','enterprise'];
    const featured = 'pro';
    grid.innerHTML = order.map(key => {
      const plan = data.plans[key];
      if (!plan) return '';
      const price       = plan.priceIdr === 0 ? 'Gratis' : `Rp ${fmtNumber(plan.priceIdr)}`;
      const period      = plan.priceIdr === 0 ? '' : '<span>/bulan</span>';
      const tokensText  = plan.tokens === -1 ? 'Unlimited' : fmtNumber(plan.tokens);
      const isFeatured  = key === featured;
      const isFree      = plan.priceIdr === 0 || key === 'free';
      let ctaHtml = '';
      if (isFree) {
        ctaHtml = `<div class="pricing-cta mt-24"><div class="btn btn-secondary btn-full btn-lg" style="opacity:0.4;cursor:default;pointer-events:none">✓ Plan Default</div></div>`;
      } else if (Auth.loggedIn) {
        ctaHtml = `<div class="pricing-cta mt-24"><button class="btn ${isFeatured?'btn-primary':'btn-secondary'} btn-full btn-lg" onclick="upgradePlan('${key}')">Pilih ${plan.name}</button></div>`;
      } else {
        ctaHtml = `<div class="pricing-cta mt-24"><button class="btn ${isFeatured?'btn-primary':'btn-secondary'} btn-full btn-lg" onclick="window.location.href='/register'">Daftar & Pilih ${plan.name}</button></div>`;
      }
      return `<div class="pricing-card ${isFeatured?'featured':''}">
        <div class="pricing-name">${plan.name}</div>
        <div class="pricing-price">${price}${period}</div>
        <div class="small dimmed">🪙 ${tokensText} Token/bln &nbsp;•&nbsp; 🤖 ${plan.maxBots===-1?'∞':plan.maxBots} Bot</div>
        <hr class="divider mt-14 mb-14">
        <ul class="pricing-features">${plan.features.map(f=>`<li${f.includes('NO Queue')?' class="no-queue"':''}>${f}</li>`).join('')}</ul>
        ${ctaHtml}
      </div>`;
    }).join('');
  } catch (err) { console.error('Pricing:', err); }
}

function upgradePlan(plan) {
  if (!Auth.loggedIn) { window.location.href = '/register'; return; }
  const p = window.__pricingData?.plans?.[plan];
  if (!p) { toast('Data plan tidak tersedia', 'error'); return; }
  const params = new URLSearchParams({ type:'plan', plan, amount: p.priceIdr, tokens: p.tokens });
  window.location.href = `/payment?${params.toString()}`;
}

// ─── Mobile sidebar ──────────────────────────────────────
function toggleMobileSidebar() {
  const sidebar  = document.querySelector('.sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  if (!sidebar) return;
  const isOpen = sidebar.classList.toggle('mobile-open');
  if (overlay) overlay.classList.toggle('active', isOpen);
}

// ─── Auto-init ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Theme.init();

  // Attach theme toggles
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => Theme.toggle());
  });

  // Mobile sidebar overlay
  document.getElementById('sidebar-overlay')?.addEventListener('click', toggleMobileSidebar);

  // Set user info in navbar
  const user = Auth.user;
  if (user) {
    setEl('nav-user-name', user.name);
    document.getElementById('nav-logout')?.style && (document.getElementById('nav-logout').style.display = 'inline-flex');
    document.getElementById('nav-login')?.style  && (document.getElementById('nav-login').style.display  = 'none');
  }

  // Check popup on non-auth pages
  const path = window.location.pathname;
  if (!['/login','/register'].includes(path)) {
    setTimeout(checkPopup, 800);
  }

  // Route-based init
  if (path === '/login')     initLogin();
  if (path === '/register')  initRegister();
  if (path === '/dashboard') initDashboard();
  if (path === '/bots')      initBots();
  if (path === '/tokens')    initTokens();
  if (path === '/settings')  initSettings();
  if (path === '/pricing')   initPricing();
});
