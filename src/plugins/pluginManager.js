/**
 * DLavie OS - Plugin Manager
 * Marketplace, install, version control, and sandbox mode.
 */

const config = require('../config');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const semver = require('semver');
const NodeCache = require('node-cache');

const PLUGINS_DIR = path.join(__dirname, '..', '..', 'plugins');
const INSTALLED_FILE = path.join(PLUGINS_DIR, '.installed.json');

class PluginManager {
  constructor() {
    this.installed = new Map();
    this.registry = new Map();
    this.cache = new NodeCache({ stdTTL: 3600 });
    this.healthScores = new Map();
  }

  async init() {
    await fs.ensureDir(PLUGINS_DIR);
    await this.loadInstalled();
    console.log('[DLAVIE][PLUGIN] Initialized');
  }

  async loadInstalled() {
    if (await fs.pathExists(INSTALLED_FILE)) {
      try {
        const data = await fs.readJson(INSTALLED_FILE);
        for (const [id, info] of Object.entries(data)) {
          this.installed.set(id, info);
        }
      } catch (err) {
        console.warn('[DLAVIE][PLUGIN] Failed to load installed plugins:', err.message);
      }
    }
  }

  async saveInstalled() {
    const data = Object.fromEntries(this.installed);
    await fs.writeJson(INSTALLED_FILE, data, { spaces: 2 });
  }

  async fetchRegistry() {
    try {
      const cached = this.cache.get('registry');
      if (cached) return cached;

      const response = await axios.get(config.plugin.registryUrl, { timeout: 10000 });
      const registry = response.data || { plugins: [] };
      this.cache.set('registry', registry);
      return registry;
    } catch (err) {
      console.warn('[DLAVIE][PLUGIN] Failed to fetch registry:', err.message);
      return { plugins: [] };
    }
  }

  async search(query) {
    const registry = await this.fetchRegistry();
    if (!query) return registry.plugins || [];
    return (registry.plugins || []).filter(p =>
      (p.name || '').toLowerCase().includes(query.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(query.toLowerCase()) ||
      (p.tags || []).some(t => t.toLowerCase().includes(query.toLowerCase()))
    );
  }

  async install(pluginId, version = 'latest') {
    try {
      const registry = await this.fetchRegistry();
      const plugin = (registry.plugins || []).find(p => p.id === pluginId || p.name === pluginId);
      if (!plugin) return { success: false, error: 'Plugin not found in registry' };

      const targetVersion = version === 'latest' ? plugin.version : version;
      if (!semver.valid(targetVersion)) {
        return { success: false, error: 'Invalid version specified' };
      }

      const installDir = path.join(PLUGINS_DIR, plugin.id);
      await fs.ensureDir(installDir);

      // Download plugin (simplified - would download from plugin.url)
      const info = {
        id: plugin.id,
        name: plugin.name,
        version: targetVersion,
        installedAt: Date.now(),
        path: installDir,
        dependencies: plugin.dependencies || [],
        healthScore: 100,
        enabled: true,
        sandboxed: config.plugin.sandboxEnabled
      };

      this.installed.set(plugin.id, info);
      await this.saveInstalled();
      this.healthScores.set(plugin.id, 100);

      return { success: true, plugin: info };
    } catch (err) {
      console.error('[DLAVIE][PLUGIN] Install error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async uninstall(pluginId) {
    const info = this.installed.get(pluginId);
    if (!info) return { success: false, error: 'Plugin not installed' };

    try {
      await fs.remove(info.path);
      this.installed.delete(pluginId);
      this.healthScores.delete(pluginId);
      await this.saveInstalled();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async update(pluginId) {
    const info = this.installed.get(pluginId);
    if (!info) return { success: false, error: 'Plugin not installed' };

    const registry = await this.fetchRegistry();
    const plugin = (registry.plugins || []).find(p => p.id === pluginId);
    if (!plugin) return { success: false, error: 'Plugin not found in registry' };

    if (semver.gte(info.version, plugin.version)) {
      return { success: true, updated: false, message: 'Already at latest version' };
    }

    // Re-install with new version
    const result = await this.install(pluginId, plugin.version);
    if (result.success) {
      result.updated = true;
      result.oldVersion = info.version;
      result.newVersion = plugin.version;
    }
    return result;
  }

  async checkUpdates() {
    const registry = await this.fetchRegistry();
    const updates = [];
    for (const [id, info] of this.installed) {
      const plugin = (registry.plugins || []).find(p => p.id === id);
      if (plugin && semver.lt(info.version, plugin.version)) {
        updates.push({ id, current: info.version, latest: plugin.version });
      }
    }
    return updates;
  }

  async autoUpdate() {
    if (!config.plugin.autoUpdate) return { skipped: true, reason: 'Auto update disabled' };
    const updates = await this.checkUpdates();
    const results = [];
    for (const update of updates) {
      const result = await this.update(update.id);
      results.push({ id: update.id, ...result });
    }
    return { updated: results.filter(r => r.updated).length, total: results.length, results };
  }

  async getInstalled() {
    return Array.from(this.installed.values());
  }

  async getPluginHealth(pluginId) {
    const info = this.installed.get(pluginId);
    if (!info) return null;
    const health = this.healthScores.get(pluginId) || 100;
    return { id: pluginId, healthScore: health, enabled: info.enabled, version: info.version };
  }

  async getAllHealth() {
    const results = [];
    for (const [id, info] of this.installed) {
      results.push({
        id,
        name: info.name,
        healthScore: this.healthScores.get(id) || 100,
        enabled: info.enabled,
        version: info.version
      });
    }
    return results;
  }

  async getStatus() {
    return {
      active: true,
      installed: this.installed.size,
      averageHealth: this.calculateAverageHealth()
    };
  }

  calculateAverageHealth() {
    if (this.healthScores.size === 0) return 0;
    const scores = Array.from(this.healthScores.values());
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  shutdown() {
    this.saveInstalled().catch(() => {});
  }
}

module.exports = { PluginManager };
