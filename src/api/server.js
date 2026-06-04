/**
 * DLavie OS - API Server
 * REST API + WebSocket for website integration.
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { getEngine } = require('../core/engine');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({ origin: config.api.corsOrigins }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Auth middleware
function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const decoded = jwt.verify(token, config.api.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (token) {
    try {
      req.user = jwt.verify(token, config.api.jwtSecret);
    } catch (err) {
      // ignore invalid token on optional auth
    }
  }
  next();
}

// Routes

// Health check
app.get('/api/health', optionalAuth, async (req, res) => {
  try {
    const engine = getEngine();
    const status = await engine.getStatus();
    res.json({
      status: 'ok',
      version: '2.0.0',
      uptime: process.uptime(),
      engine: engine.isRunning,
      ...status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Engine status
app.get('/api/status', authenticate, async (req, res) => {
  try {
    const engine = getEngine();
    const status = await engine.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Multi-bot
app.get('/api/bots', authenticate, async (req, res) => {
  try {
    const engine = getEngine();
    const multiBot = engine.getSystem('multiBot');
    if (!multiBot) return res.status(503).json({ error: 'Multi-bot system not available' });
    const bots = await multiBot.getAllBots();
    res.json({ bots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bots/:token', authenticate, async (req, res) => {
  try {
    const engine = getEngine();
    const multiBot = engine.getSystem('multiBot');
    if (!multiBot) return res.status(503).json({ error: 'Multi-bot system not available' });
    const bot = await multiBot.getBotStatus(req.params.token);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    res.json({ bot });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bots/:token/relay', authenticate, async (req, res) => {
  try {
    const engine = getEngine();
    const multiBot = engine.getSystem('multiBot');
    if (!multiBot) return res.status(503).json({ error: 'Multi-bot system not available' });
    const result = await multiBot.relayCommand(req.params.token, req.body.command, req.body.args);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Token system
app.get('/api/tokens/:userId', authenticate, async (req, res) => {
  try {
    const engine = getEngine();
    const tokenEngine = engine.getSystem('token');
    if (!tokenEngine) return res.status(503).json({ error: 'Token system not available' });
    const balance = tokenEngine.getBalance(req.params.userId);
    const warning = tokenEngine.getLowTokenWarning(req.params.userId);
    res.json({ balance, warning });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tokens/:userId/history', authenticate, async (req, res) => {
  try {
    const engine = getEngine();
    const tokenEngine = engine.getSystem('token');
    if (!tokenEngine) return res.status(503).json({ error: 'Token system not available' });
    const history = tokenEngine.getHistory(req.params.userId, parseInt(req.query.limit) || 50);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tokens/:userId/heatmap', authenticate, async (req, res) => {
  try {
    const engine = getEngine();
    const tokenEngine = engine.getSystem('token');
    if (!tokenEngine) return res.status(503).json({ error: 'Token system not available' });
    const heatmap = tokenEngine.getHeatmap(req.params.userId);
    res.json({ heatmap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Monitoring
app.get('/api/monitoring/health', authenticate, async (req, res) => {
  try {
    const engine = getEngine();
    const health = engine.getSystem('health');
    if (!health) return res.status(503).json({ error: 'Health monitor not available' });
    const report = await health.getHealthReport();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/monitoring/errors', authenticate, async (req, res) => {
  try {
    const engine = getEngine();
    const errors = engine.getSystem('errors');
    if (!errors) return res.status(503).json({ error: 'Error aggregator not available' });
    const summary = await errors.getErrorSummary();
    res.json({ errors: summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Plugins
app.get('/api/plugins', authenticate, async (req, res) => {
  try {
    const engine = getEngine();
    const plugins = engine.getSystem('plugins');
    if (!plugins) return res.status(503).json({ error: 'Plugin manager not available' });
    const installed = await plugins.getInstalled();
    res.json({ plugins: installed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/plugins/search', authenticate, async (req, res) => {
  try {
    const engine = getEngine();
    const plugins = engine.getSystem('plugins');
    if (!plugins) return res.status(503).json({ error: 'Plugin manager not available' });
    const results = await plugins.search(req.query.q);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Audit
app.get('/api/audit', authenticate, async (req, res) => {
  try {
    const engine = getEngine();
    const audit = engine.getSystem('audit');
    if (!audit) return res.status(503).json({ error: 'Audit logger not available' });
    const logs = await audit.query({
      userId: req.query.userId,
      action: req.query.action,
      severity: req.query.severity,
      limit: parseInt(req.query.limit) || 50
    });
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auth
app.post('/api/auth/login', async (req, res) => {
  try {
    const { userId, password } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // In production, this would check against Supabase or a password hash
    const token = jwt.sign({ userId, role: 'USER' }, config.api.jwtSecret, { expiresIn: config.api.jwtExpiry });
    res.json({ token, expiresIn: config.api.jwtExpiry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[DLAVIE][API] Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// WebSocket
const wss = new WebSocket.Server({ server, path: '/ws' });

const clients = new Map();

wss.on('connection', (ws, req) => {
  const clientId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  clients.set(clientId, { ws, subscribed: [] });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.subscribe) {
        const client = clients.get(clientId);
        if (client) client.subscribed.push(data.subscribe);
        ws.send(JSON.stringify({ event: 'subscribed', channel: data.subscribe }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ error: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
  });

  ws.send(JSON.stringify({ event: 'connected', clientId }));
});

// Broadcast to all subscribed clients
function broadcast(channel, data) {
  const msg = JSON.stringify({ event: channel, data, timestamp: Date.now() });
  for (const [id, client] of clients) {
    if (client.subscribed.includes(channel) || client.subscribed.includes('*')) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(msg);
      }
    }
  }
}

// Start server
const PORT = config.api.port;
const HOST = config.api.host;

server.listen(PORT, HOST, () => {
  console.log(`[DLAVIE][API] Server running on http://${HOST}:${PORT}`);
  console.log(`[DLAVIE][WS] WebSocket available on ws://${HOST}:${PORT}/ws`);
});

module.exports = { app, server, wss, broadcast };
