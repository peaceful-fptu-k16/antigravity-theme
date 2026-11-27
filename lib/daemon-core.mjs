import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { buildPayload, isPayloadStale } from './builder.mjs';
import { fetchJson, filterAntigravityPages } from './cdp.mjs';
import {
  ensureDataDirs,
  getPortInfo,
  isPidAlive,
  readActiveDaemonPid,
  readJsonSafe,
  resolvePortFile,
  writeJsonAtomic,
} from './paths.mjs';

const MEDIA_MIME = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

export function createMediaServer(assetDirs, logger = () => {}) {
  const resolvedDirs = assetDirs.filter(Boolean).map((d) => path.resolve(d));

  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      if (!req.url || (req.method !== 'GET' && req.method !== 'HEAD')) {
        res.writeHead(405);
        res.end();
        return;
      }

      const cleanUrl = req.url.split('?')[0];
      if (!cleanUrl.startsWith('/assets/')) {
        res.writeHead(404);
        res.end();
        return;
      }

      let rel;
      try {
        rel = decodeURIComponent(cleanUrl.slice('/assets/'.length));
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }

      let fullPath = null;
      let stat = null;
      for (const dir of resolvedDirs) {
        const candidate = path.resolve(dir, rel);
        if (!candidate.startsWith(dir + path.sep)) continue;
        try {
          const st = fs.statSync(candidate);
          if (st.isFile()) {
            fullPath = candidate;
            stat = st;
            break;
          }
        } catch {
          // Try next asset root
        }
      }

      if (!fullPath || !stat) {
        res.writeHead(404);
        res.end();
        return;
      }

      const ext = path.extname(fullPath).toLowerCase();
      const mime = MEDIA_MIME[ext] || 'application/octet-stream';
      const total = stat.size;
      const commonHeaders = {
        'Content-Type': mime,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      };

      const rangeHeader = req.headers.range;
      if (rangeHeader && /^bytes=/i.test(rangeHeader)) {
        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/i);
        const start = match && match[1] ? Number.parseInt(match[1], 10) : 0;
        const end = match && match[2] ? Math.min(total - 1, Number.parseInt(match[2], 10)) : total - 1;
        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) {
          res.writeHead(416, { ...commonHeaders, 'Content-Range': `bytes */${total}` });
          res.end();
          return;
        }
        res.writeHead(206, {
          ...commonHeaders,
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Content-Length': end - start + 1,
        });
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        const stream = fs.createReadStream(fullPath, { start, end });
        stream.on('error', () => {
          try {
            res.destroy();
          } catch {
            // ignore
          }
        });
        stream.pipe(res);
        return;
      }

      res.writeHead(200, { ...commonHeaders, 'Content-Length': total });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const stream = fs.createReadStream(fullPath);
      stream.on('error', () => {
        try {
          res.destroy();
        } catch {
          // ignore
        }
      });
      stream.pipe(res);
    });

    srv.on('error', (err) => {
      logger(`Media server failed to start: ${err.message}`);
      resolve({ server: null, baseUrl: '' });
    });

    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const baseUrl = addr && typeof addr === 'object' ? `http://127.0.0.1:${addr.port}` : '';
      if (baseUrl) logger(`Local media server listening at ${baseUrl}`);
      resolve({ server: srv, baseUrl });
    });
  });
}

export class ThemeDaemon {
  constructor(paths, options = {}) {
    this.paths = paths;
    this.embedded = Boolean(options.embedded);
    this.exitOnClose = Boolean(options.exitOnClose);
    this.managePid = options.managePid !== undefined ? Boolean(options.managePid) : !this.embedded;
    this.logToStdout = Boolean(options.logToStdout);
    this.startupGraceMs = Math.max(5000, Number(options.startupGraceMs || process.env.AGY_STARTUP_GRACE_MS || 60000));
    this.maxMissedScans = Math.max(2, Number(options.maxMissedScans || process.env.AGY_EXIT_MISSED_SCANS || 5));
    this.onShutdown = typeof options.onShutdown === 'function' ? options.onShutdown : null;

    this.startedAt = Date.now();
    this.everConnectedToCdp = false;
    this.missedCdpScans = 0;
    this.running = false;
    this.isScanning = false;
    this.lastPort = null;
    this.mediaServer = null;
    this.mediaBaseUrl = '';
    this.sessions = new Map();
    this.pollTimer = null;
    this.watcher = null;
    this.reloadTimer = null;
    this.missingPayloadLogged = false;
    this.yieldedToExternalPid = null;
  }

  log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try {
      fs.mkdirSync(path.dirname(this.paths.logFile), { recursive: true });
      if (fs.existsSync(this.paths.logFile) && fs.statSync(this.paths.logFile).size > 512 * 1024) {
        fs.writeFileSync(this.paths.logFile, '');
      }
      fs.appendFileSync(this.paths.logFile, line);
    } catch {
      // ignore log errors
    }
    if (this.logToStdout) {
      process.stdout.write(line);
    }
  }

  readConfig() {
    return readJsonSafe(this.paths.configFile, {});
  }

  saveConfig(next) {
    try {
      const merged = { ...this.readConfig(), ...(next || {}) };
      writeJsonAtomic(this.paths.configFile, merged);
      return merged;
    } catch (err) {
      this.log(`Failed saving theme_config.json: ${err.message}`);
      return null;
    }
  }

  acquirePidLock() {
    if (!this.managePid) return true;
    const existingPid = readActiveDaemonPid(this.paths);
    if (existingPid && existingPid !== process.pid) {
      this.log(`Another daemon instance is already running (PID ${existingPid}).`);
      return false;
    }
    ensureDataDirs(this.paths);
    fs.writeFileSync(this.paths.pidFile, String(process.pid), 'utf8');
    return true;
  }

  removePidLock() {
    if (!this.managePid) return;
    try {
      if (fs.existsSync(this.paths.pidFile)) {
        const pid = Number.parseInt(fs.readFileSync(this.paths.pidFile, 'utf8').trim(), 10);
        if (pid === process.pid) {
          fs.unlinkSync(this.paths.pidFile);
        }
      }
    } catch {
      // ignore
    }
  }

  buildInjectedSource() {
    if (!fs.existsSync(this.paths.payloadFile)) {
      if (!this.missingPayloadLogged) {
        this.log(`Payload not built yet (${this.paths.payloadFile}).`);
        this.missingPayloadLogged = true;
      }
      return null;
    }
    this.missingPayloadLogged = false;
    const cfgJson = JSON.stringify(this.readConfig());
    const mediaBaseJson = JSON.stringify(this.mediaBaseUrl || '');
    const payloadCode = fs.readFileSync(this.paths.payloadFile, 'utf8');
    return `window.__AGY_INITIAL_CONFIG__ = ${cfgJson};\nwindow.__AGY_MEDIA_BASE__ = ${mediaBaseJson};\n${payloadCode}`;
  }

  createSession(target) {
    if (typeof globalThis.WebSocket !== 'function') {
      throw new Error('Node.js >= 22 with built-in WebSocket is required.');
    }
    const ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);
    let nextId = 1;
    const pending = new Map();
    const session = { id: target.id, ws, target, preloadScriptId: null };
    this.sessions.set(target.id, session);

    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        if (ws.readyState !== 1) {
          reject(new Error('WebSocket is not open'));
          return;
        }
        const id = nextId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });

    session.send = send;

    const syncPreloadScript = async (src) => {
      try {
        if (session.preloadScriptId) {
          await send('Page.removeScriptToEvaluateOnNewDocument', {
            identifier: session.preloadScriptId,
          }).catch(() => {});
          session.preloadScriptId = null;
        }
        const res = await send('Page.addScriptToEvaluateOnNewDocument', { source: src });
        if (res && res.identifier) {
          session.preloadScriptId = res.identifier;
        }
      } catch {
        // ignore
      }
    };

    session.reinject = async () => {
      const src = this.buildInjectedSource();
      if (!src) return;
      await syncPreloadScript(src);
      try {
        await send('Runtime.evaluate', { expression: src, awaitPromise: false });
      } catch {
        // ignore
      }
    };

    session.applyLive = async (overrides) => {
      const expr = `window.__ANTIGRAVITY_APPLY_CUSTOM_THEME__ && window.__ANTIGRAVITY_APPLY_CUSTOM_THEME__(${JSON.stringify(overrides || {})});`;
      try {
        await send('Runtime.evaluate', { expression: expr, awaitPromise: false });
      } catch {
        // ignore
      }
    };

    ws.addEventListener('message', async (event) => {
      let msg;
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message || 'CDP error'));
        else p.resolve(msg.result);
        return;
      }

      if (msg.method === 'Runtime.bindingCalled' && msg.params && msg.params.name === 'agySaveThemeConfig') {
        try {
          const payload = JSON.parse(msg.params.payload || '{}');
          this.saveConfig(payload);
          for (const other of this.sessions.values()) {
            if (other.id !== target.id) {
              other.applyLive(payload);
            }
          }
        } catch (err) {
          this.log(`Config binding error: ${err.message}`);
        }
        return;
      }

      if (msg.method === 'Page.frameNavigated' && msg.params && msg.params.frame && !msg.params.frame.parentId) {
        await session.reinject();
      }
    });

    ws.addEventListener('open', async () => {
      try {
        await send('Page.enable');
        await send('Runtime.enable');
        try {
          await send('Runtime.addBinding', { name: 'agySaveThemeConfig' });
        } catch {
          // binding may already exist
        }
        const src = this.buildInjectedSource();
        if (src) {
          await syncPreloadScript(src);
          await send('Runtime.evaluate', { expression: src, awaitPromise: false });
        }
        this.log(`Attached target ${target.id} (${target.url})`);
      } catch (err) {
        this.log(`Attach error for ${target.id}: ${err.message}`);
      }
    });

    const cleanup = () => {
      for (const p of pending.values()) {
        p.reject(new Error('WebSocket closed'));
      }
      pending.clear();
      this.sessions.delete(target.id);
    };

    ws.addEventListener('close', cleanup);
    ws.addEventListener('error', cleanup);
  }

  handleCdpUnavailable() {
    if (!this.exitOnClose) return;
    if (this.everConnectedToCdp) {
      this.missedCdpScans += 1;
      if (this.missedCdpScans >= this.maxMissedScans) {
        this.log(`Antigravity CDP unreachable for ${this.missedCdpScans} consecutive checks; exiting (--exit-on-close).`);
        this.stop('antigravity-closed');
      }
    } else if (Date.now() - this.startedAt >= this.startupGraceMs) {
      this.log(`Antigravity CDP did not become available within ${Math.round(this.startupGraceMs / 1000)}s; exiting.`);
      this.stop('startup-timeout');
    }
  }

  async scanPages() {
    if (!this.running || this.isScanning) return;
    this.isScanning = true;
    try {
      // In embedded MCP mode, yield cleanly if a standalone daemon owns the PID lock
      if (this.embedded) {
        const externalPid = readActiveDaemonPid(this.paths);
        if (externalPid && externalPid !== process.pid) {
          if (this.yieldedToExternalPid !== externalPid) {
            this.yieldedToExternalPid = externalPid;
            this.log(`Standalone daemon (PID ${externalPid}) detected; yielding CDP attachment.`);
            this.closeAllSessions();
          }
          return;
        }
        this.yieldedToExternalPid = null;
      }

      const info = getPortInfo();
      if (!info) {
        this.handleCdpUnavailable();
        return;
      }

      if (this.lastPort !== null && this.lastPort !== info.port) {
        this.closeAllSessions();
      }
      this.lastPort = info.port;

      let targets;
      try {
        targets = await fetchJson(`http://127.0.0.1:${info.port}/json`);
      } catch {
        this.handleCdpUnavailable();
        return;
      }

      const pages = filterAntigravityPages(targets);
      this.everConnectedToCdp = true;
      this.missedCdpScans = 0;

      const liveIds = new Set(pages.map((p) => p.id));
      for (const [id, session] of this.sessions.entries()) {
        if (!liveIds.has(id)) {
          try {
            session.ws.close();
          } catch {
            // ignore
          }
          this.sessions.delete(id);
        }
      }

      for (const page of pages) {
        if (!this.sessions.has(page.id)) {
          this.createSession(page);
        }
      }
    } finally {
      this.isScanning = false;
    }
  }

  closeAllSessions() {
    for (const s of this.sessions.values()) {
      try {
        s.ws.close();
      } catch {
        // ignore
      }
    }
    this.sessions.clear();
  }

  async reinjectAll() {
    const tasks = [];
    for (const s of this.sessions.values()) {
      tasks.push(s.reinject());
    }
    await Promise.allSettled(tasks);
    return tasks.length;
  }

  async applyConfigLive(patch) {
    const saved = this.saveConfig(patch);
    const tasks = [];
    for (const s of this.sessions.values()) {
      tasks.push(s.applyLive(patch));
    }
    await Promise.allSettled(tasks);
    return { saved, sessionCount: tasks.length };
  }

  watchPayload() {
    try {
      ensureDataDirs(this.paths);
      this.watcher = fs.watch(this.paths.distDir, (_eventType, filename) => {
        if (filename && filename !== 'theme_payload.js') return;
        clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(() => {
          this.log('Detected dist/theme_payload.js update; hot-reloading attached pages.');
          this.reinjectAll();
        }, 250);
      });
    } catch (err) {
      this.log(`fs.watch skipped: ${err.message}`);
    }
  }

  scheduleNextPoll() {
    if (!this.running) return;
    const delayMs = this.embedded && this.sessions.size === 0 ? 5000 : 1500;
    this.pollTimer = setTimeout(async () => {
      await this.scanPages();
      this.scheduleNextPoll();
    }, delayMs);
    if (typeof this.pollTimer.unref === 'function' && this.embedded) {
      this.pollTimer.unref();
    }
  }

  async start() {
    if (this.running) return { started: true, alreadyRunning: true, mediaBaseUrl: this.mediaBaseUrl };
    ensureDataDirs(this.paths);

    if (!this.acquirePidLock()) {
      return { started: false, reason: 'already-running' };
    }

    if (isPayloadStale(this.paths)) {
      try {
        const built = buildPayload(this.paths);
        this.log(`Auto-built payload (${built.sizeKB} KB, ${built.themeCount} themes).`);
      } catch (err) {
        this.log(`Auto-build failed: ${err.message}`);
      }
    }

    this.running = true;
    this.startedAt = Date.now();
    this.log(
      `Theme daemon started (PID ${process.pid}, mode=${this.embedded ? 'embedded-mcp' : 'standalone'}, exitOnClose=${this.exitOnClose}, portFile=${resolvePortFile()}).`
    );

    const media = await createMediaServer([this.paths.userAssetsDir, this.paths.builtinAssetsDir], (m) =>
      this.log(m)
    );
    this.mediaServer = media.server;
    this.mediaBaseUrl = media.baseUrl;

    this.watchPayload();
    await this.scanPages();
    this.scheduleNextPoll();

    return { started: true, pid: process.pid, mediaBaseUrl: this.mediaBaseUrl };
  }

  stop(signal = 'manual') {
    if (!this.running && !this.mediaServer) return;
    this.running = false;
    this.log(`Shutting down (${signal}).`);
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
    if (this.watcher) {
      try {
        this.watcher.close();
      } catch {
        // ignore
      }
      this.watcher = null;
    }
    if (this.mediaServer) {
      try {
        this.mediaServer.close();
      } catch {
        // ignore
      }
      this.mediaServer = null;
      this.mediaBaseUrl = '';
    }
    this.closeAllSessions();
    this.removePidLock();
    if (this.onShutdown) {
      this.onShutdown(signal);
    }
  }

  getStatus() {
    const externalPid = readActiveDaemonPid(this.paths);
    return {
      running: this.running,
      mode: this.embedded ? 'embedded-mcp' : 'standalone',
      pid: this.running ? process.pid : null,
      externalDaemonPid: externalPid && externalPid !== process.pid ? externalPid : null,
      yieldedToExternalPid: this.yieldedToExternalPid,
      mediaBaseUrl: this.mediaBaseUrl || null,
      attachedPageCount: this.sessions.size,
      attachedPages: Array.from(this.sessions.values()).map((s) => ({
        id: s.id,
        title: s.target.title || '',
        url: s.target.url || '',
      })),
      lastCdpPort: this.lastPort,
    };
  }
}

export function stopExternalDaemon(paths) {
  const pid = readActiveDaemonPid(paths);
  if (!pid) return { stopped: false, pid: null };
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // ignore
  }
  try {
    if (fs.existsSync(paths.pidFile)) fs.unlinkSync(paths.pidFile);
  } catch {
    // ignore
  }
  return { stopped: true, pid };
}
