/**
 * DLavie OS — Web App JS
 * Handles auth, API calls, UI interactions
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

    const res = await fetch(this.base + path, options);
    const data = await res.json().catch(() => ({ error: 'Invalid response' }));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  get:    (path, auth)       => API.request('GET',    path, null, auth),
  post:   (path, body, auth) => API.request('POST',   path, body, auth),
  put:    (path, body, auth) => API.request('PUT',    path, body, auth),
  delete: (path, auth)       => API.request('DELETE', path, null, auth),
};

// ─── Auth helpers ───
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

// ─── Toast ───
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
  el.innerHTML = `<span>${icons[type] || '💬'}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideIn 0.25s ease reverse';
    setTimeout(() => el.remove(), 250);
  }, duration);
}

// ─── Loading state ───
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

// ─── Format numbers ───
function fmtNumber(n) { return Number(n || 0).toLocaleString('id-ID'); }
function fmtDate(ts)   { return new Date(ts).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }); }
function fmtTime(ts)   { return new Date(ts).toLocaleString('id-ID'); }
function fmtRupiah(n)  {
  if (n === 0) return 'Gratis';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

// ─── Countdown timer ───
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

// ─── Copy to clipboard ───
async function copyText(text, label = 'Teks') {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} disalin!`, 'success', 2000);
  } catch (_) {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    el.remove();
    toast(`${label} disalin!`, 'success', 2000);
  }
}

// ─── Page: Login ───
async function initLogin() {
  if (!Auth.guardPublic()) return;

  const form    = document.getElementById('login-form');
  const btn     = document.getElementById('login-btn');
  const errEl   = document.getElementById('login-error');

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
      toast('Login berhasil! Mengalihkan...', 'success', 1500);
      setTimeout(() => window.location.href = '/dashboard', 1500);
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
      else toast(err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

// ─── Page: Register ───
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
    } finally {
      setLoading(btn, false);
    }
  });
}

// ─── Page: Dashboard ───
async function initDashboard() {
  if (!Auth.guardDashboard()) return;

  // Set user info di sidebar
  const user = Auth.user;
  setEl('user-name', user?.name || 'User');
  setEl('user-email', user?.email || '');
  setEl('user-plan-badge', (user?.plan || 'free').toUpperCase());

  try {
    const data = await API.get('/api/dashboard');
    const { stats, bots, user: u } = data;

    setEl('stat-tokens', fmtNumber(stats.tokenBalance));
    setEl('stat-bots', stats.totalBots);
    setEl('stat-active', stats.activeBots);
    setEl('stat-commands', fmtNumber(stats.commandsToday));

    // Bot list
    const botsEl = document.getElementById('recent-bots');
    if (botsEl) {
      if (!bots.length) {
        botsEl.innerHTML = '<div class="empty-state"><div class="icon">🤖</div><p>Belum ada bot terhubung.<br>Gunakan <code>!connect</code> di WhatsApp untuk menghubungkan bot.</p></div>';
      } else {
        botsEl.innerHTML = bots.map(b => `
          <div class="bot-card">
            <div class="bot-avatar">🤖</div>
            <div class="bot-info">
              <div class="flex items-center gap-8">
                <strong>${b.botNumber}</strong>
                <span class="badge ${b.status==='active'?'badge-success':'badge-error'}">
                  <span class="dot dot-${b.status==='active'?'success':'error'}"></span>
                  ${b.status}
                </span>
              </div>
              <div class="bot-id">${b.botId}</div>
            </div>
            <div class="bot-actions">
              <button class="btn btn-sm btn-secondary" onclick="relayCmd('${b.botId}','status')">Status</button>
            </div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ─── Page: Bots ───
async function initBots() {
  if (!Auth.guardDashboard()) return;
  setSidebarActive('bots');

  try {
    const data = await API.get('/api/bots');
    renderBots(data.bots);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderBots(bots) {
  const el = document.getElementById('bots-list');
  if (!el) return;
  if (!bots.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="icon">🤖</div>
        <p>Belum ada bot terhubung.</p>
        <button class="btn btn-primary mt-16" onclick="showConnectGuide()">Hubungkan Bot Pertamamu</button>
      </div>`;
    return;
  }
  el.innerHTML = bots.map(b => `
    <div class="bot-card">
      <div class="bot-avatar">🤖</div>
      <div class="bot-info">
        <div class="flex items-center gap-8">
          <strong>${b.botNumber}</strong>
          <span class="badge ${b.status==='active'?'badge-success':'badge-error'}">
            <span class="dot dot-${b.status==='active'?'success':'error'}"></span>
            ${b.status}
          </span>
          <span class="badge badge-primary">${(b.plan||'free').toUpperCase()}</span>
        </div>
        <div class="bot-id mono">${b.botId}</div>
        <div class="small dimmed mt-8">Terhubung: ${fmtTime(b.connectedAt)}</div>
      </div>
      <div class="bot-actions">
        <button class="btn btn-sm btn-secondary" onclick="copyText('${b.botId}','Bot ID')">Copy ID</button>
        <button class="btn btn-sm btn-danger"    onclick="disconnectBot('${b.botId}')">Lepas</button>
      </div>
    </div>
  `).join('');
}

async function disconnectBot(botId) {
  if (!confirm(`Yakin ingin melepas bot ${botId}?`)) return;
  try {
    await API.delete(`/api/bots/${botId}`);
    toast('Bot berhasil dilepas', 'success');
    initBots();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ─── Page: Token ───
async function initTokens() {
  if (!Auth.guardDashboard()) return;
  setSidebarActive('tokens');

  try {
    const data = await API.get('/api/tokens');
    setEl('token-balance', fmtNumber(data.balance));
    setEl('token-plan', (data.plan||'free').toUpperCase());

    const qrisEl = document.getElementById('qris-image');
    if (qrisEl && data.qrisImage) {
      qrisEl.src = data.qrisImage;
      qrisEl.style.display = 'block';
    }

    // Render packages
    const pkgsEl = document.getElementById('token-packages');
    if (pkgsEl && data.packages) {
      pkgsEl.innerHTML = data.packages.map(pkg => `
        <div class="card" style="text-align:center;">
          <div style="font-size:1.8rem;font-weight:900;color:var(--primary-l)">${fmtNumber(pkg.tokens)}</div>
          <div class="dimmed small">Token</div>
          <div style="font-size:1.3rem;font-weight:800;margin:12px 0">${fmtRupiah(pkg.priceIdr)}</div>
          <button class="btn btn-primary btn-full" onclick="requestTopup('${pkg.id}',${pkg.priceIdr},${pkg.tokens})">Topup</button>
        </div>
      `).join('');
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function requestTopup(packageId, amount, tokens) {
  try {
    const data = await API.post('/api/tokens/topup', { packageId, amount });
    toast(`Topup request dibuat! ID: ${data.reqId}`, 'success', 6000);

    if (data.qrisImage) {
      document.getElementById('qris-image')?.setAttribute('src', data.qrisImage);
    }

    const modal = document.getElementById('topup-modal');
    if (modal) {
      setEl('topup-amount', fmtRupiah(amount));
      setEl('topup-tokens', fmtNumber(tokens));
      setEl('topup-id', data.reqId);
      modal.style.display = 'flex';
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ─── Page: Bot Code (di dashboard) ───
let codeCountdownInterval = null;

async function generateBotCode() {
  const btn    = document.getElementById('gen-code-btn');
  const codeEl = document.getElementById('bot-code-value');
  const timerEl= document.getElementById('code-timer');
  const section= document.getElementById('code-section');

  setLoading(btn, true);
  try {
    const data = await API.post('/api/bot/code');
    if (codeEl) codeEl.textContent = data.code;
    if (section) section.style.display = 'block';

    if (codeCountdownInterval) clearInterval(codeCountdownInterval);
    if (timerEl) {
      codeCountdownInterval = startCountdown('code-timer', data.expiresAt);
    }

    toast('Kode berhasil dibuat! Berlaku 10 menit.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

// ─── Page: Settings ───
async function initSettings() {
  if (!Auth.guardDashboard()) return;
  setSidebarActive('settings');

  const user = Auth.user;
  const nameInput  = document.getElementById('settings-name');
  const emailInput = document.getElementById('settings-email');
  if (nameInput  && user) nameInput.value  = user.name || '';
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
      // Update local storage
      const updated = { ...Auth.user, name: data.user.name };
      localStorage.setItem('dlv_user', JSON.stringify(updated));
      toast('Profil berhasil diperbarui!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

// ─── Page: Pricing ───
async function initPricing() {
  try {
    const data = await API.get('/api/pricing', false);
    const grid = document.getElementById('pricing-grid');
    if (!grid) return;

    const order = ['free', 'starter', 'pro', 'enterprise'];
    const featured = 'pro';

    grid.innerHTML = order.map(key => {
      const plan = data.plans[key];
      if (!plan) return '';
      const price = plan.priceIdr === 0 ? 'Gratis' : `Rp ${fmtNumber(plan.priceIdr)}`;
      const period = plan.priceIdr === 0 ? '' : '<span>/bulan</span>';
      const tokensText = plan.tokens === -1 ? 'Unlimited' : fmtNumber(plan.tokens);
      const isFeatured = key === featured;

      return `
        <div class="pricing-card ${isFeatured ? 'featured' : ''}">
          <div class="pricing-name">${plan.name}</div>
          <div class="pricing-price">${price}${period}</div>
          <div class="small dimmed">🪙 ${tokensText} Token/bulan • 🤖 ${plan.maxBots === -1 ? 'Unlimited' : plan.maxBots} Bot</div>
          <hr class="divider mt-16 mb-16">
          <ul class="pricing-features">
            ${plan.features.map(f => `<li${f.includes('NO Queue') ? ' class="no-queue"' : ''}>${f}</li>`).join('')}
          </ul>
          <div class="pricing-cta mt-24">
            <button class="btn ${isFeatured ? 'btn-primary' : 'btn-secondary'} btn-full btn-lg"
              onclick="${Auth.loggedIn ? `upgradePlan('${key}')` : "window.location.href='/register'"}">
              ${plan.priceIdr === 0 ? 'Mulai Gratis' : `Pilih ${plan.name}`}
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Pricing load error:', err);
  }
}

function upgradePlan(plan) {
  if (!Auth.loggedIn) { window.location.href = '/register'; return; }
  toast(`Menghubungi admin untuk upgrade ke ${plan}. Hubungi owner di WhatsApp.`, 'info', 5000);
}

// ─── Helpers ───
function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setSidebarActive(page) {
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  const target = document.querySelector(`.sidebar-item[data-page="${page}"]`);
  if (target) target.classList.add('active');
}

function logout() {
  Auth.clear();
  window.location.href = '/';
}

function showConnectGuide() {
  toast('Kirim `!connect generate` ke bot DLavie OS untuk mendapatkan token koneksi.', 'info', 6000);
}

function relayCmd(botId, cmd) {
  toast(`Relay "${cmd}" ke ${botId}. Gunakan !relay di bot untuk kontrol lebih lanjut.`, 'info', 4000);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'none';
}

// ─── Auto-init berdasarkan halaman ───
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;

  // Set user info di navbar jika ada
  const user = Auth.user;
  if (user) {
    setEl('nav-user-name', user.name);
    const logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    const loginBtn  = document.getElementById('nav-login');
    if (loginBtn) loginBtn.style.display = 'none';
  }

  if (path === '/login')     initLogin();
  if (path === '/register')  initRegister();
  if (path === '/dashboard') initDashboard();
  if (path === '/bots')      initBots();
  if (path === '/tokens')    initTokens();
  if (path === '/settings')  initSettings();
  if (path === '/pricing')   initPricing();
});
