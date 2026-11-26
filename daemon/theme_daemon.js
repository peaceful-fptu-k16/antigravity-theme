#!/usr/bin/env node
'use strict';

/**
 * Antigravity Custom Theme Daemon (Windows / macOS / Linux)
 * Connects to Antigravity CDP (DevToolsActivePort), injects dist/theme_payload.js,
 * persists user theme preferences in theme_config.json, and hot-reloads on rebuild.
 */

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

if (typeof globalThis.WebSocket !== 'function') {
    console.error('[theme-daemon] Node.js >= 22 with built-in WebSocket is required.');
    process.exit(1);
}

const ROOT_DIR = path.resolve(__dirname, '..');
const PID_FILE = path.join(ROOT_DIR, 'daemon.pid');
const CONFIG_FILE = process.env.AGY_CONFIG_PATH || path.join(ROOT_DIR, 'theme_config.json');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ASSETS_DIR = path.join(ROOT_DIR, 'themes', 'assets');
const PAYLOAD_PATH = path.join(DIST_DIR, 'theme_payload.js');
const LOG_FILE = path.join(ROOT_DIR, 'daemon.log');
const DEFAULT_CONFIG = {};

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

let mediaServer = null;
let mediaBaseUrl = '';

function startMediaServer() {
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
            } catch (_) {
                res.writeHead(400);
                res.end();
                return;
            }
            const fullPath = path.resolve(ASSETS_DIR, rel);
            if (!fullPath.startsWith(ASSETS_DIR + path.sep) || !fs.existsSync(fullPath)) {
                res.writeHead(404);
                res.end();
                return;
            }
            let stat;
            try {
                stat = fs.statSync(fullPath);
                if (!stat.isFile()) {
                    res.writeHead(404);
                    res.end();
                    return;
                }
            } catch (_) {
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
                const start = match && match[1] ? parseInt(match[1], 10) : 0;
                const end = match && match[2] ? Math.min(total - 1, parseInt(match[2], 10)) : total - 1;
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
                stream.on('error', () => { try { res.destroy(); } catch (_) {} });
                stream.pipe(res);
                return;
            }

            res.writeHead(200, { ...commonHeaders, 'Content-Length': total });
            if (req.method === 'HEAD') {
                res.end();
                return;
            }
            const stream = fs.createReadStream(fullPath);
            stream.on('error', () => { try { res.destroy(); } catch (_) {} });
            stream.pipe(res);
        });

        srv.on('error', (err) => {
            log(`Media server failed to start: ${err.message}`);
            resolve('');
        });
        srv.listen(0, '127.0.0.1', () => {
            const addr = srv.address();
            if (addr && typeof addr === 'object') {
                mediaServer = srv;
                mediaBaseUrl = `http://127.0.0.1:${addr.port}`;
                log(`Local media server listening at ${mediaBaseUrl}`);
            }
            resolve(mediaBaseUrl);
        });
    });
}

const EXIT_ON_CLOSE = process.argv.includes('--exit-on-close') || process.env.AGY_EXIT_ON_CLOSE === '1';
const STARTUP_GRACE_MS = Math.max(5000, parseInt(process.env.AGY_STARTUP_GRACE_MS || '60000', 10) || 60000);
const MAX_MISSED_SCANS = Math.max(2, parseInt(process.env.AGY_EXIT_MISSED_SCANS || '5', 10) || 5);
const STARTED_AT = Date.now();
let everConnectedToCdp = false;
let missedCdpScans = 0;

function resolvePortFile() {
    if (process.env.AGY_PORT_FILE) {
        return process.env.AGY_PORT_FILE;
    }

    const home = os.homedir();
    let candidates;
    if (process.platform === 'win32') {
        const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
        candidates = [
            path.join(appData, 'antigravity', 'DevToolsActivePort'),
            path.join(appData, 'Antigravity', 'DevToolsActivePort'),
        ];
    } else if (process.platform === 'darwin') {
        const appSupport = path.join(home, 'Library', 'Application Support');
        candidates = [
            path.join(appSupport, 'antigravity', 'DevToolsActivePort'),
            path.join(appSupport, 'Antigravity', 'DevToolsActivePort'),
        ];
    } else {
        const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
        candidates = [
            path.join(xdgConfig, 'antigravity', 'DevToolsActivePort'),
            path.join(xdgConfig, 'Antigravity', 'DevToolsActivePort'),
        ];
    }

    return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try {
        if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 512 * 1024) {
            fs.writeFileSync(LOG_FILE, '');
        }
        fs.appendFileSync(LOG_FILE, line);
    } catch (_) {}
    if (process.stdout.isTTY || process.env.AGY_DAEMON_STDOUT === '1') {
        process.stdout.write(line);
    }
}

function isPidAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (_) {
        return false;
    }
}

function acquirePidLock() {
    if (fs.existsSync(PID_FILE)) {
        const existingPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
        if (existingPid && existingPid !== process.pid && isPidAlive(existingPid)) {
            log(`Another daemon instance is already running (PID ${existingPid}). Exiting.`);
            process.exit(0);
        }
    }
    fs.writeFileSync(PID_FILE, String(process.pid), 'utf8');
}

function removePidLock() {
    try {
        if (fs.existsSync(PID_FILE)) {
            const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
            if (pid === process.pid) {
                fs.unlinkSync(PID_FILE);
            }
        }
    } catch (_) {}
}

function readConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            if (parsed && typeof parsed === 'object') {
                return { ...DEFAULT_CONFIG, ...parsed };
            }
        }
    } catch (err) {
        log(`Failed reading theme_config.json: ${err.message}`);
    }
    return { ...DEFAULT_CONFIG };
}

function saveConfig(next) {
    try {
        const merged = { ...readConfig(), ...next };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
        return merged;
    } catch (err) {
        log(`Failed saving theme_config.json: ${err.message}`);
        return null;
    }
}

let missingPayloadLogged = false;
function buildInjectedSource() {
    if (!fs.existsSync(PAYLOAD_PATH)) {
        if (!missingPayloadLogged) {
            log(`Payload not built yet (${PAYLOAD_PATH}). Run: python scripts/build_payload.py`);
            missingPayloadLogged = true;
        }
        return null;
    }
    missingPayloadLogged = false;

    const cfgJson = JSON.stringify(readConfig());
    const mediaBaseJson = JSON.stringify(mediaBaseUrl || '');
    const payloadCode = fs.readFileSync(PAYLOAD_PATH, 'utf8');
    return `window.__AGY_INITIAL_CONFIG__ = ${cfgJson};\nwindow.__AGY_MEDIA_BASE__ = ${mediaBaseJson};\n${payloadCode}`;
}

function getPortInfo() {
    const portFile = resolvePortFile();
    if (!fs.existsSync(portFile)) return null;
    const lines = fs
        .readFileSync(portFile, 'utf8')
        .trim()
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    const port = parseInt(lines[0], 10);
    if (!Number.isFinite(port) || port <= 0) return null;
    return { port, token: lines[1] || '' };
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, { timeout: 2000 }, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (err) {
                    reject(err);
                }
            });
        });
        req.on('timeout', () => req.destroy(new Error('HTTP timeout')));
        req.on('error', reject);
    });
}

const sessions = new Map();
let lastPort = null;
let reloadTimer = null;

function createSession(target) {
    const ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);
    let nextId = 1;
    const pending = new Map();
    const session = { id: target.id, ws, target };
    sessions.set(target.id, session);

    function send(method, params = {}) {
        return new Promise((resolve, reject) => {
            if (ws.readyState !== 1) {
                reject(new Error('WebSocket is not open'));
                return;
            }
            const id = nextId++;
            pending.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    session.preloadScriptId = null;

    async function syncPreloadScript(src) {
        try {
            if (session.preloadScriptId) {
                await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: session.preloadScriptId }).catch(() => {});
                session.preloadScriptId = null;
            }
            const res = await send('Page.addScriptToEvaluateOnNewDocument', { source: src });
            if (res && res.identifier) {
                session.preloadScriptId = res.identifier;
            }
        } catch (_) {}
    }

    session.reinject = async () => {
        const src = buildInjectedSource();
        if (!src) return;
        await syncPreloadScript(src);
        try {
            await send('Runtime.evaluate', { expression: src, awaitPromise: false });
        } catch (_) {}
    };

    ws.addEventListener('message', async (event) => {
        let msg;
        try {
            msg = JSON.parse(String(event.data));
        } catch (_) {
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
                saveConfig(payload);
                for (const other of sessions.values()) {
                    if (other.id !== target.id) {
                        other.reinject();
                    }
                }
            } catch (err) {
                log(`Config binding error: ${err.message}`);
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
            } catch (_) {}

            const src = buildInjectedSource();
            if (src) {
                await syncPreloadScript(src);
                await send('Runtime.evaluate', { expression: src, awaitPromise: false });
            }
            log(`Attached target ${target.id} (${target.url})`);
        } catch (err) {
            log(`Attach error for ${target.id}: ${err.message}`);
        }
    });

    const cleanup = () => {
        for (const p of pending.values()) {
            p.reject(new Error('WebSocket closed'));
        }
        pending.clear();
        sessions.delete(target.id);
    };
    ws.addEventListener('close', cleanup);
    ws.addEventListener('error', cleanup);
}

function handleCdpUnavailable() {
    if (!EXIT_ON_CLOSE) return;
    if (everConnectedToCdp) {
        missedCdpScans += 1;
        if (missedCdpScans >= MAX_MISSED_SCANS) {
            log(`Antigravity CDP unreachable for ${missedCdpScans} consecutive checks; exiting (--exit-on-close).`);
            shutdown('antigravity-closed');
        }
    } else if (Date.now() - STARTED_AT >= STARTUP_GRACE_MS) {
        log(`Antigravity CDP did not become available within ${Math.round(STARTUP_GRACE_MS / 1000)}s; exiting (--exit-on-close).`);
        shutdown('startup-timeout');
    }
}

let isScanning = false;
async function scanPages() {
    if (isScanning) return;
    isScanning = true;
    try {
    const info = getPortInfo();
    if (!info) {
        handleCdpUnavailable();
        return;
    }

    if (lastPort !== null && lastPort !== info.port) {
        for (const s of sessions.values()) {
            try {
                s.ws.close();
            } catch (_) {}
        }
        sessions.clear();
    }
    lastPort = info.port;

    let targets;
    try {
        targets = await fetchJson(`http://127.0.0.1:${info.port}/json`);
    } catch (_) {
        handleCdpUnavailable();
        return;
    }
    if (!Array.isArray(targets)) {
        handleCdpUnavailable();
        return;
    }

    everConnectedToCdp = true;
    missedCdpScans = 0;

    const pages = targets.filter((t) => {
        if (!t || t.type !== 'page' || !t.webSocketDebuggerUrl) return false;
        const url = String(t.url || '');
        if (url.startsWith('devtools://') || url.startsWith('chrome-extension://')) return false;
        return url.includes('127.0.0.1') || url.includes('workbench') || url.includes('launchpad');
    });

    const liveIds = new Set(pages.map((p) => p.id));
    for (const [id, session] of sessions.entries()) {
        if (!liveIds.has(id)) {
            try {
                session.ws.close();
            } catch (_) {}
            sessions.delete(id);
        }
    }

    for (const page of pages) {
        if (!sessions.has(page.id)) {
            createSession(page);
        }
    }
    } finally {
        isScanning = false;
    }
}

function watchPayload() {
    try {
        if (!fs.existsSync(DIST_DIR)) {
            fs.mkdirSync(DIST_DIR, { recursive: true });
        }
        fs.watch(DIST_DIR, (_eventType, filename) => {
            if (filename && filename !== 'theme_payload.js') return;
            clearTimeout(reloadTimer);
            reloadTimer = setTimeout(() => {
                log('Detected dist/theme_payload.js update; hot-reloading attached pages.');
                for (const s of sessions.values()) {
                    s.reinject();
                }
            }, 250);
        });
    } catch (err) {
        log(`fs.watch skipped: ${err.message}`);
    }
}

function shutdown(signal) {
    log(`Shutting down on ${signal}.`);
    if (mediaServer) {
        try {
            mediaServer.close();
        } catch (_) {}
        mediaServer = null;
    }
    for (const s of sessions.values()) {
        try {
            s.ws.close();
        } catch (_) {}
    }
    sessions.clear();
    removePidLock();
    process.exit(0);
}

acquirePidLock();
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', removePidLock);

log(`Theme daemon started (PID ${process.pid}, platform=${process.platform}, exitOnClose=${EXIT_ON_CLOSE}, portFile=${resolvePortFile()}).`);
startMediaServer().then(() => {
    watchPayload();
    scanPages();
    setInterval(scanPages, 1500);
});
