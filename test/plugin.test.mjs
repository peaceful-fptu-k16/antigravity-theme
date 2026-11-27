import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildPayload,
  deleteUserThemePreset,
  loadBuiltinThemes,
  loadMergedThemes,
  saveUserThemePreset,
  validateThemePreset,
} from '../lib/builder.mjs';
import { createMediaServer } from '../lib/daemon-core.mjs';
import { resolvePluginPaths } from '../lib/paths.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_ROOT = path.resolve(__dirname, '..');

function makeTempDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'theme-studio-test-'));
}

function sampleCustomPreset() {
  return {
    concept: 'Emerald Kyoto Night • Test Preset',
    primary: '#34d399',
    secondary: '#38bdf8',
    glow: 'rgba(52, 211, 153, 0.25)',
    secondaryGlow: 'rgba(56, 189, 248, 0.20)',
    bg: 'linear-gradient(135deg, rgba(16, 48, 40, 0.94) 0%, rgba(10, 28, 26, 0.96) 100%)',
    frameBg: 'linear-gradient(135deg, rgba(52, 211, 153, 0.7) 0%, rgba(56, 189, 248, 0.5) 100%)',
    textColor: '#ecfdf5',
    borderColor: 'rgba(52, 211, 153, 0.28)',
    innerBorder: '1px solid rgba(236, 253, 245, 0.12)',
    clearBackdrop: true,
    overlayRgb: '8, 22, 20',
    pureBg: 'radial-gradient(circle at 70% 25%, rgba(52, 211, 153, 0.20) 0%, transparent 55%), linear-gradient(160deg, #061412 0%, #040b0a 100%)',
    wallpaper: '',
    sidebarBg: 'rgba(8, 22, 20, 0.72)',
    sidebarHoverBg: 'rgba(52, 211, 153, 0.14)',
    aiCardBg: 'rgba(9, 24, 22, 0.92)',
    aiCardBorder: 'rgba(52, 211, 153, 0.20)',
    headerBg: 'rgba(8, 22, 20, 0.72)',
    headerBorder: 'rgba(52, 211, 153, 0.14)',
    unifiedGlass: true,
    btnBg: 'rgba(16, 48, 40, 0.72)',
    inputGlassBg: 'rgba(10, 28, 26, 0.84)',
    inputCardBg: 'linear-gradient(145deg, rgba(12, 34, 30, 0.94) 0%, rgba(8, 22, 20, 0.98) 100%)',
    modalBg: 'rgba(8, 20, 18, 0.97)',
    modalHeaderBg: 'rgba(12, 34, 30, 0.92)',
    cardBg: 'rgba(10, 28, 26, 0.88)',
    cardSelectedBg: 'rgba(20, 62, 52, 0.78)',
  };
}

test('manifest, mcp_config, and bundled assets exist and are valid', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'plugin.json'), 'utf8'));
  assert.equal(manifest.name, 'theme-studio');
  assert.equal(manifest.displayName, 'Theme Studio');
  assert.ok(fs.existsSync(path.join(PLUGIN_ROOT, manifest.logo)));
  assert.ok(Array.isArray(manifest.suggestedPrompts) && manifest.suggestedPrompts.length === 3);

  const mcpCfg = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'mcp_config.json'), 'utf8'));
  assert.ok(mcpCfg.mcpServers?.studio);
  assert.equal(mcpCfg.mcpServers.studio.command, 'node');

  const studioHtml = path.join(PLUGIN_ROOT, 'assets', 'studio-app.html');
  assert.ok(fs.existsSync(studioHtml));
  assert.ok(fs.statSync(studioHtml).size > 5000);
});

test('all built-in presets pass strict schema validation and include dark + light collections', () => {
  const paths = resolvePluginPaths({ rootDir: PLUGIN_ROOT });
  const builtins = loadBuiltinThemes(paths);
  const entries = Object.entries(builtins);
  assert.ok(entries.length >= 60, `Expected >= 60 built-in presets, got ${entries.length}`);

  let darkCount = 0;
  let lightCount = 0;
  for (const [name, cfg] of entries) {
    const check = validateThemePreset(name, cfg);
    assert.equal(check.valid, true, `Preset "${name}" failed schema: ${check.errors.join('; ')}`);
    assert.equal(check.warnings.length, 0, `Preset "${name}" emitted warnings: ${check.warnings.join('; ')}`);
    if (cfg.isLight) lightCount += 1;
    else darkCount += 1;
  }
  assert.ok(darkCount >= 45, `Expected >= 45 dark presets, got ${darkCount}`);
  assert.ok(lightCount >= 10, `Expected >= 10 light presets, got ${lightCount}`);
});

test('builder compiles built-in + custom themes into PLUGIN_DATA without mutating PLUGIN_ROOT', () => {
  const dataDir = makeTempDataDir();
  try {
    const paths = resolvePluginPaths({ rootDir: PLUGIN_ROOT, dataDir });
    const builtinCount = Object.keys(loadBuiltinThemes(paths)).length;

    const built1 = buildPayload(paths);
    assert.ok(fs.existsSync(built1.outPath));
    assert.equal(built1.builtinCount, builtinCount);
    assert.equal(built1.customCount, 0);
    assert.ok(built1.themes.includes('Sakura Midnight'));
    assert.ok(built1.themes.includes('Catppuccin Mocha'));
    assert.ok(built1.themes.includes('Tokyo Night Storm'));
    assert.ok(built1.themes.includes('Dracula Official'));
    assert.ok(built1.themes.includes('Catppuccin Latte'));
    assert.ok(built1.sizeKB < 2048, `Payload should stay compact (< 2MB), got ${built1.sizeKB} KB`);

    // Add custom preset + stage SVG corner asset
    const svgSrc = path.join(PLUGIN_ROOT, 'themes', 'assets', 'sakura_corner.svg');
    const saved = saveUserThemePreset(paths, 'Kyoto Emerald', sampleCustomPreset(), {
      stageAssetFiles: { cornerSvg: svgSrc },
    });
    assert.equal(saved.preset.cornerSvg, 'assets/kyoto_emerald_cornersvg.svg');
    assert.ok(fs.existsSync(path.join(paths.userAssetsDir, 'kyoto_emerald_cornersvg.svg')));

    const built2 = buildPayload(paths);
    assert.equal(built2.themeCount, builtinCount + 1);
    assert.equal(built2.customCount, 1);
    assert.ok(built2.themes.includes('Kyoto Emerald'));

    const payloadSrc = fs.readFileSync(built2.outPath, 'utf8');
    assert.ok(payloadSrc.includes('__AGY_MEDIA__/assets/magical_sakura_4k.mp4'));
    assert.ok(payloadSrc.includes('Kyoto Emerald'));

    const deleted = deleteUserThemePreset(paths, 'Kyoto Emerald');
    assert.equal(deleted.deleted, true);
    const { merged } = loadMergedThemes(paths);
    assert.equal(Object.prototype.hasOwnProperty.call(merged, 'Kyoto Emerald'), false);

    // Invalid preset fails validation
    const invalid = validateThemePreset('Broken', { primary: '#fff' });
    assert.equal(invalid.valid, false);
    assert.ok(invalid.errors.length > 0);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('local HTTP media server supports 206 Range streaming, user override priority, and blocks path traversal', async () => {
  const dataDir = makeTempDataDir();
  try {
    const paths = resolvePluginPaths({ rootDir: PLUGIN_ROOT, dataDir });
    fs.mkdirSync(paths.userAssetsDir, { recursive: true });
    fs.writeFileSync(path.join(paths.userAssetsDir, 'custom.svg'), '<svg>user</svg>', 'utf8');

    const { server, baseUrl } = await createMediaServer([paths.userAssetsDir, paths.builtinAssetsDir]);
    assert.ok(server && baseUrl.startsWith('http://127.0.0.1:'));

    try {
      const userRes = await fetch(`${baseUrl}/assets/custom.svg`);
      assert.equal(userRes.status, 200);
      assert.equal(await userRes.text(), '<svg>user</svg>');

      const rangeRes = await fetch(`${baseUrl}/assets/magical_sakura_4k.mp4`, {
        headers: { Range: 'bytes=0-15' },
      });
      assert.equal(rangeRes.status, 206);
      assert.equal(rangeRes.headers.get('content-type'), 'video/mp4');
      assert.match(rangeRes.headers.get('content-range') || '', /^bytes 0-15\/\d+$/);
      const buf = new Uint8Array(await rangeRes.arrayBuffer());
      assert.equal(buf.length, 16);

      const traversalStatus = await new Promise((resolve, reject) => {
        const u = new URL(baseUrl);
        http
          .get({ host: u.hostname, port: u.port, path: '/assets/%2e%2e/themes.json' }, (res) => {
            res.resume();
            resolve(res.statusCode);
          })
          .on('error', reject);
      });
      assert.equal(traversalStatus, 404);
    } finally {
      await new Promise((r) => server.close(r));
    }
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('MCP stdio server handles initialize, tools/list, resources/read, and preset lifecycle end-to-end', async () => {
  const dataDir = makeTempDataDir();
  const builtinCount = Object.keys(loadBuiltinThemes(resolvePluginPaths({ rootDir: PLUGIN_ROOT }))).length;

  const child = spawn(
    process.execPath,
    [path.join(PLUGIN_ROOT, 'scripts', 'mcp-server.mjs'), '--data-dir', dataDir, '--no-daemon'],
    {
      env: { ...process.env, PLUGIN_ROOT, PLUGIN_DATA: dataDir },
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );

  const rl = readline.createInterface({ input: child.stdout });
  const pending = new Map();
  rl.on('line', (line) => {
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg);
    }
  });

  let nextId = 1;
  function rpc(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`RPC timeout for ${method}`)), 8000);
      pending.set(id, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
      });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  try {
    const init = await rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    });
    assert.equal(init.result.serverInfo.name, 'theme-studio');

    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    const toolsRes = await rpc('tools/list');
    const toolNames = toolsRes.result.tools.map((t) => t.name);
    assert.ok(toolNames.includes('open_studio'));
    assert.ok(toolNames.includes('theme_apply'));
    assert.ok(toolNames.includes('theme_create_preset'));
    assert.ok(toolNames.includes('theme_verify_cdp'));

    const htmlRes = await rpc('resources/read', { uri: 'ui://theme-studio/app.html' });
    assert.equal(htmlRes.result.contents[0].mimeType, 'text/html;profile=mcp-app');
    assert.ok(htmlRes.result.contents[0].text.includes('preset-search'));

    const listRes = await rpc('tools/call', { name: 'theme_list_presets', arguments: {} });
    assert.equal(listRes.result.structuredContent.count, builtinCount);

    const createRes = await rpc('tools/call', {
      name: 'theme_create_preset',
      arguments: { name: 'Kyoto Emerald', preset: sampleCustomPreset(), activate: true },
    });
    assert.ok(!createRes.result.isError);
    assert.equal(createRes.result.structuredContent.state.config.themeName, 'Kyoto Emerald');

    const applyRes = await rpc('tools/call', {
      name: 'theme_apply',
      arguments: { themeName: 'Catppuccin Mocha', workspaceMode: 'focus', dimming: 50 },
    });
    assert.ok(!applyRes.result.isError);
    assert.equal(applyRes.result.structuredContent.state.config.themeName, 'Catppuccin Mocha');
    assert.equal(applyRes.result.structuredContent.state.config.workspaceMode, 'focus');

    const delRes = await rpc('tools/call', {
      name: 'theme_delete_preset',
      arguments: { name: 'Kyoto Emerald' },
    });
    assert.ok(!delRes.result.isError);
    assert.equal(delRes.result.structuredContent.build.themeCount, builtinCount);
  } finally {
    child.stdin.end();
    await new Promise((r) => child.once('exit', r));
    rl.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
