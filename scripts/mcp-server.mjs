#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {
  buildPayload,
  deleteUserThemePreset,
  encodeSvg,
  isPayloadStale,
  loadMergedThemes,
  resolveLocalAssetPath,
  saveUserThemePreset,
} from '../lib/builder.mjs';
import {
  applyOverridesLive,
  discoverAntigravityPages,
  openThemeModalLive,
  removeThemeLive,
  verifyCdpLive,
} from '../lib/cdp.mjs';
import { stopExternalDaemon, ThemeDaemon } from '../lib/daemon-core.mjs';
import {
  ensureDataDirs,
  parseCliArgs,
  readJsonSafe,
  resolvePluginPaths,
  writeJsonAtomic,
} from '../lib/paths.mjs';

const SERVER_INFO = {
  name: 'theme-studio',
  version: '2.0.0',
};

const SUPPORTED_PROTOCOLS = new Set(['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']);
const APP_URI = 'ui://theme-studio/app.html';

const cli = parseCliArgs(process.argv.slice(2));
const paths = resolvePluginPaths({ rootDir: cli.rootDir, dataDir: cli.dataDir });
ensureDataDirs(paths);

const daemon = new ThemeDaemon(paths, {
  embedded: true,
  managePid: false,
  logToStdout: false,
});

function debugLog(msg) {
  daemon.log(`[mcp] ${msg}`);
  if (process.env.AGY_MCP_DEBUG === '1') {
    process.stderr.write(`[theme-studio-mcp] ${msg}\n`);
  }
}

const MAX_INLINE_PREVIEW_BYTES = 460 * 1024; // Keeps open_studio CallToolResult safely well under 1 MiB
const MAX_SMALL_RASTER_PREVIEW_BYTES = 36 * 1024;
const previewUriCache = new Map();

function getAssetSearchDirs() {
  return [paths.userThemesDir, paths.builtinThemesDir];
}

function readPreviewUri(assetValue, { allowSmallRaster = false } = {}) {
  if (typeof assetValue !== 'string') return '';
  const trimmed = assetValue.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/svg+xml')) {
    return trimmed.length <= 28 * 1024 ? trimmed : '';
  }
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('__AGY_MEDIA__/')
  ) {
    return '';
  }

  const located = resolveLocalAssetPath(trimmed, getAssetSearchDirs());
  if (!located) return '';
  const { fullPath } = located;
  const ext = path.extname(fullPath).toLowerCase();

  try {
    const stat = fs.statSync(fullPath);
    const cacheKey = `${fullPath}:${stat.mtimeMs}:${stat.size}`;
    if (previewUriCache.has(cacheKey)) {
      return previewUriCache.get(cacheKey);
    }

    let uri = '';
    if (ext === '.svg') {
      uri = encodeSvg(fullPath);
    } else if (
      allowSmallRaster &&
      (ext === '.webp' || ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif') &&
      stat.size <= MAX_SMALL_RASTER_PREVIEW_BYTES
    ) {
      const mime =
        ext === '.webp'
          ? 'image/webp'
          : ext === '.png'
            ? 'image/png'
            : ext === '.gif'
              ? 'image/gif'
              : 'image/jpeg';
      uri = `data:${mime};base64,${fs.readFileSync(fullPath).toString('base64')}`;
    }

    if (previewUriCache.size > 800) previewUriCache.clear();
    previewUriCache.set(cacheKey, uri);
    return uri;
  } catch {
    return '';
  }
}

function detectMediaType(theme) {
  const wp = String(theme.wallpaper || '').trim();
  if (!wp) return 'css-gradient';
  if (/\.(mp4|webm)(\?.*)?$/i.test(wp) || wp.startsWith('data:video/')) return 'video';
  if (/\.gif(\?.*)?$/i.test(wp) || wp.startsWith('data:image/gif')) return 'animated-gif';
  if (/\.svg(\?.*)?$/i.test(wp) || wp.startsWith('data:image/svg+xml')) return 'svg-art';
  return 'image';
}

function summarizePresets({ includePreviews = false } = {}) {
  const { merged, sources } = loadMergedThemes(paths);
  let usedPreviewBytes = 0;

  return Object.entries(merged).map(([name, cfg]) => {
    const mediaType = detectMediaType(cfg);
    const hasWallpaperArt = Boolean(String(cfg.wallpaper || '').trim());
    const hasOrnament = Boolean(String(cfg.sticker || '').trim() || String(cfg.cornerSvg || '').trim());
    const hasAvatars = Boolean(String(cfg.userAvatar || '').trim() || String(cfg.agentAvatar || '').trim());

    const item = {
      name,
      source: sources[name] || 'builtin',
      concept: cfg.concept || '',
      primary: cfg.primary || '#a78bfa',
      secondary: cfg.secondary || '#38bdf8',
      overlayRgb: cfg.overlayRgb || '16, 13, 23',
      textColor: cfg.textColor || (cfg.isLight ? '#1e293b' : '#f8fafc'),
      surfaceBg: cfg.surfaceBg || '',
      pureBg: cfg.pureBg || '',
      isLight: Boolean(cfg.isLight),
      mediaType,
      wallpaper: cfg.wallpaper || '',
      defaultDimming: Number.isFinite(cfg.defaultDimming) ? cfg.defaultDimming : 69,
      isOrnament: Boolean(cfg.isOrnament),
      hasWallpaperArt,
      hasOrnament,
      hasAvatars,
      hasMascot: Boolean(cfg.composerOnlyMascot || cfg.sticker),
      unifiedGlass: Boolean(cfg.unifiedGlass),
    };

    if (includePreviews) {
      if (mediaType === 'svg-art') {
        const wpUri = readPreviewUri(cfg.wallpaper);
        if (wpUri && usedPreviewBytes + wpUri.length <= MAX_INLINE_PREVIEW_BYTES) {
          item.wallpaperPreview = wpUri;
          usedPreviewBytes += wpUri.length;
        }
      } else {
        // For flagship video/raster themes, include tiny SVG ornament/corner previews directly on first paint
        const stUri = readPreviewUri(cfg.sticker);
        if (stUri && usedPreviewBytes + stUri.length <= MAX_INLINE_PREVIEW_BYTES) {
          item.stickerPreview = stUri;
          usedPreviewBytes += stUri.length;
        }
        const cnUri = readPreviewUri(cfg.cornerSvg);
        if (cnUri && usedPreviewBytes + cnUri.length <= MAX_INLINE_PREVIEW_BYTES) {
          item.cornerPreview = cnUri;
          usedPreviewBytes += cnUri.length;
        }
      }
    }

    return item;
  });
}

function collectPresetAssets({ names = null, kinds = null } = {}) {
  const { merged } = loadMergedThemes(paths);
  const nameFilter = Array.isArray(names) && names.length > 0 ? new Set(names) : null;
  const activeKinds =
    Array.isArray(kinds) && kinds.length > 0
      ? new Set(kinds)
      : new Set(['sticker', 'cornerSvg', 'userAvatar', 'agentAvatar']);

  const assets = {};
  for (const [name, cfg] of Object.entries(merged)) {
    if (nameFilter && !nameFilter.has(name)) continue;
    const entry = {};
    if (activeKinds.has('wallpaper')) {
      const uri = readPreviewUri(cfg.wallpaper);
      if (uri) entry.wallpaper = uri;
    }
    if (activeKinds.has('sticker')) {
      const uri = readPreviewUri(cfg.sticker, { allowSmallRaster: true });
      if (uri) entry.sticker = uri;
    }
    if (activeKinds.has('cornerSvg')) {
      const uri = readPreviewUri(cfg.cornerSvg);
      if (uri) entry.cornerSvg = uri;
    }
    if (activeKinds.has('userAvatar')) {
      const uri = readPreviewUri(cfg.userAvatar, { allowSmallRaster: true });
      if (uri) entry.userAvatar = uri;
    }
    if (activeKinds.has('agentAvatar')) {
      const uri = readPreviewUri(cfg.agentAvatar, { allowSmallRaster: true });
      if (uri) entry.agentAvatar = uri;
    }
    if (Object.keys(entry).length > 0) {
      assets[name] = entry;
    }
  }
  return assets;
}

function getSetupHint() {
  if (process.platform === 'win32') {
    return {
      platform: 'win32',
      summary:
        'Antigravity v2.33.0+ requires --remote-debugging-port=0 for live shell theming. Run the Windows On-Demand launcher installer, then fully quit Antigravity (System Tray -> Quit) and reopen.',
      command: `powershell -ExecutionPolicy Bypass -File "${path.join(paths.pluginRoot, 'scripts', 'install-win.ps1')}" -DataDir "${paths.dataDir}"`,
    };
  }
  return {
    platform: process.platform,
    summary:
      'Start Antigravity with --remote-debugging-port=0 and install the background daemon (or run it on-demand).',
    command: `bash "${path.join(paths.pluginRoot, 'scripts', 'install-unix.sh')}"`,
  };
}

async function collectStudioState({ includeVerify = false, includePreviews = false } = {}) {
  const config = readJsonSafe(paths.configFile, {});
  const presets = summarizePresets({ includePreviews });
  const cdp = await discoverAntigravityPages();
  const payloadExists = fs.existsSync(paths.payloadFile);
  const payloadSizeKB = payloadExists
    ? Number((fs.statSync(paths.payloadFile).size / 1024).toFixed(1))
    : 0;
  const payloadStale = isPayloadStale(paths);
  const verify = includeVerify && cdp.cdpAvailable ? await verifyCdpLive() : null;

  const defaultTheme = presets[0]?.name || 'Sakura Midnight';
  const effectiveConfig = {
    themeName: config.themeName || defaultTheme,
    bubbleName: config.bubbleName || config.themeName || defaultTheme,
    inputStyle: config.inputStyle || 'sync',
    dimming: Number.isFinite(config.dimming) ? config.dimming : (presets.find((p) => p.name === (config.themeName || defaultTheme))?.defaultDimming ?? 34),
    wpEnabled: config.wpEnabled !== undefined ? Boolean(config.wpEnabled) : true,
    glassBlur: Number.isFinite(config.glassBlur) ? config.glassBlur : 3,
    workspaceMode: config.workspaceMode || 'balanced',
    chatOpacity: Number.isFinite(config.chatOpacity) ? config.chatOpacity : 0,
    accentOverride: config.accentOverride || '',
    reducedMotion: Boolean(config.reducedMotion),
    zenMode: Boolean(config.zenMode),
    focusVignette: config.focusVignette !== undefined ? Boolean(config.focusVignette) : true,
    avatarSize: Number.isFinite(config.avatarSize) ? config.avatarSize : 32,
    avatarRadius: Number.isFinite(config.avatarRadius) ? config.avatarRadius : 50,
  };

  return {
    plugin: SERVER_INFO,
    config: effectiveConfig,
    rawConfig: config,
    presets,
    payload: {
      exists: payloadExists,
      stale: payloadStale,
      sizeKB: payloadSizeKB,
      path: paths.payloadFile,
    },
    cdp: {
      available: cdp.cdpAvailable,
      port: cdp.port,
      portFile: cdp.portFile,
      pageCount: cdp.pages.length,
      reason: cdp.reason,
    },
    daemon: daemon.getStatus(),
    setupHint: cdp.cdpAvailable ? null : getSetupHint(),
    verify,
    paths: {
      pluginRoot: paths.pluginRoot,
      dataDir: paths.dataDir,
      configFile: paths.configFile,
      userThemesFile: paths.userThemesFile,
      logFile: paths.logFile,
    },
  };
}

function readStudioHtml() {
  const overridePath = process.env.THEME_STUDIO_APP_HTML;
  const target = overridePath ? path.resolve(overridePath) : paths.studioHtmlFile;
  if (!fs.existsSync(target)) {
    throw new Error(`Theme Studio UI asset missing at ${target}`);
  }
  return fs.readFileSync(target, 'utf8');
}

const TOOLS = [
  {
    name: 'open_studio',
    title: 'Theme Studio',
    description:
      'Open the interactive Theme Studio UI showing presets, live glass/wallpaper controls, CDP status, and diagnostics.',
    inputSchema: {
      type: 'object',
      properties: {
        includeVerify: {
          type: 'boolean',
          description: 'Run live CDP DOM inspection when opening the Studio.',
        },
      },
      additionalProperties: false,
    },
    _meta: {
      ui: { resourceUri: APP_URI },
      'com.google.antigravity/ui': {
        entrypoints: [
          { type: 'aux_pane', title: 'Theme Studio' },
          { type: 'global', title: 'Theme Studio' },
        ],
      },
    },
  },
  {
    name: 'app_studio_state',
    title: 'Refresh Studio State',
    description: 'Internal app-only tool to refresh live Theme Studio state.',
    inputSchema: {
      type: 'object',
      properties: {
        includeVerify: { type: 'boolean' },
        includePreviews: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    _meta: {
      ui: { visibility: ['app'] },
    },
  },
  {
    name: 'app_preset_assets',
    title: 'Load Preset Visual Assets',
    description:
      'Internal app-only tool returning compact SVG data-URI previews (ornaments, corners, user/agent avatars, or wallpapers) for Theme Studio cards.',
    inputSchema: {
      type: 'object',
      properties: {
        names: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional subset of preset names.',
        },
        kinds: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['wallpaper', 'sticker', 'cornerSvg', 'userAvatar', 'agentAvatar'],
          },
          description: 'Optional asset kinds to include.',
        },
      },
      additionalProperties: false,
    },
    _meta: {
      ui: { visibility: ['app'] },
    },
  },
  {
    name: 'theme_status',
    title: 'Get Theme Status',
    description:
      'Check active theme configuration, CDP port connectivity, embedded/standalone daemon status, payload state, and installed presets.',
    inputSchema: {
      type: 'object',
      properties: {
        includeVerify: {
          type: 'boolean',
          description: 'Also run live CDP DOM verification if CDP is reachable.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'theme_list_presets',
    title: 'List Theme Presets',
    description:
      'List all built-in and user custom theme presets with palette swatches, light/dark mode, and media type.',
    inputSchema: {
      type: 'object',
      properties: {
        includeDefinitions: {
          type: 'boolean',
          description: 'Include full raw preset JSON objects (excluding inlined binary data URIs).',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'theme_apply',
    title: 'Apply Theme or Settings',
    description:
      'Switch the active theme preset and/or update live visual settings (workspaceMode, dimming, glassBlur, accentOverride, wpEnabled, focusVignette, zenMode, reducedMotion, inputStyle, chatOpacity, bubbleName). Persists to theme_config.json and hot-applies via CDP.',
    inputSchema: {
      type: 'object',
      properties: {
        themeName: { type: 'string', description: 'Preset name to activate.' },
        bubbleName: { type: 'string', description: 'Optional separate preset name for user chat bubbles.' },
        inputStyle: {
          type: 'string',
          enum: ['sync', 'double_gold', 'glass', 'minimal'],
          description: 'Composer frame style.',
        },
        workspaceMode: {
          type: 'string',
          enum: ['focus', 'balanced', 'immersive'],
          description: 'Adaptive workspace readability/glass mode.',
        },
        dimming: { type: 'integer', minimum: 0, maximum: 95, description: 'Wallpaper scrim darkness %.' },
        glassBlur: { type: 'integer', minimum: 0, maximum: 16, description: 'Pre-baked offscreen glass blur radius in px.' },
        chatOpacity: { type: 'integer', minimum: 0, maximum: 100, description: 'Optional card opacity override (0 = mode default).' },
        accentOverride: {
          type: 'string',
          enum: ['', 'sakura', 'rose', 'lavender'],
          description: 'Accent color override (empty string = theme default).',
        },
        wpEnabled: { type: 'boolean', description: 'Enable or disable background wallpaper/video.' },
        focusVignette: { type: 'boolean', description: 'Enable soft radial Focus Vignette behind conversation.' },
        zenMode: { type: 'boolean', description: 'Toggle Zen high-dimming distraction-free mode.' },
        reducedMotion: { type: 'boolean', description: 'Disable mascot/petal/video animations.' },
        avatarSize: { type: 'integer', minimum: 20, maximum: 64 },
        avatarRadius: { type: 'integer', minimum: 0, maximum: 50 },
        openModal: { type: 'boolean', description: 'Also open the in-shell Custom Theme modal if CDP is active.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'theme_create_preset',
    title: 'Create or Update Custom Theme Preset',
    description:
      'Validate and save a custom theme preset into persistent PLUGIN_DATA/themes/themes.json, optionally stage local asset files (wallpaper, sticker, cornerSvg, userAvatar, agentAvatar), rebuild dist/theme_payload.js, and hot-reload live Antigravity windows.',
    inputSchema: {
      type: 'object',
      required: ['name', 'preset'],
      properties: {
        name: { type: 'string', description: 'Display name of the theme preset.' },
        preset: {
          type: 'object',
          description: 'Theme preset JSON matching references/theme-schema.md.',
        },
        stageAssets: {
          type: 'object',
          description:
            'Optional map of asset keys (wallpaper, sticker, cornerSvg, userAvatar, agentAvatar) to local file paths to copy into PLUGIN_DATA/themes/assets/.',
          properties: {
            wallpaper: { type: 'string' },
            sticker: { type: 'string' },
            cornerSvg: { type: 'string' },
            userAvatar: { type: 'string' },
            agentAvatar: { type: 'string' },
          },
          additionalProperties: false,
        },
        activate: {
          type: 'boolean',
          description: 'Immediately activate this preset after compiling (default: true).',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'theme_delete_preset',
    title: 'Delete Custom Theme Preset',
    description:
      'Remove a user-created theme preset from PLUGIN_DATA/themes/themes.json (built-in presets remain untouched) and rebuild the runtime payload.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', description: 'Name of the custom preset to delete.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'theme_build_payload',
    title: 'Rebuild Theme Payload',
    description:
      'Compile built-in and custom presets with engine/core.js into PLUGIN_DATA/dist/theme_payload.js, syntax-check it, and hot-reload attached CDP targets.',
    inputSchema: {
      type: 'object',
      properties: {
        maxDim: {
          type: 'integer',
          minimum: 512,
          maximum: 4096,
          description: 'Maximum raster dimension in px (default 2560).',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'theme_verify_cdp',
    title: 'Verify Live CDP Theme',
    description:
      'Run non-destructive live CDP inspection on open Antigravity windows to verify #antigravity-custom-theme-active, Zero Live Blur compliance, pre-baked glass, split-browser hole cutout, and focus vignette pointer-events.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'theme_reset',
    title: 'Remove Live Theme / Reset Config',
    description:
      'Immediately strip custom theme styles and DOM layers from open Antigravity CDP windows (window.__ANTIGRAVITY_REMOVE_CUSTOM_THEME__()), and optionally reset persisted theme_config.json.',
    inputSchema: {
      type: 'object',
      properties: {
        resetConfig: {
          type: 'boolean',
          description: 'Also reset theme_config.json to empty defaults.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'theme_daemon_control',
    title: 'Control Theme Daemon',
    description:
      'Inspect, start, stop, restart, reinject, or trigger the in-shell settings modal via the CDP theme daemon.',
    inputSchema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'start', 'stop', 'restart', 'reinject', 'open_modal'],
          description: 'Daemon lifecycle or live control action.',
        },
      },
      additionalProperties: false,
    },
  },
];

async function handleToolCall(name, args = {}) {
  switch (name) {
    case 'open_studio':
    case 'app_studio_state': {
      const includePreviews = name === 'open_studio' ? true : args.includePreviews !== false;
      const state = await collectStudioState({
        includeVerify: Boolean(args.includeVerify),
        includePreviews,
      });
      const text = [
        `Theme Studio ready — active preset: "${state.config.themeName}" (${state.config.workspaceMode} mode, dimming ${state.config.dimming}%).`,
        `Presets (${state.presets.length}): ${state.presets.map((p) => `${p.name} [${p.source}]`).join(', ')}.`,
        state.cdp.available
          ? `CDP connected on port ${state.cdp.port} (${state.cdp.pageCount} page(s), daemon attached: ${state.daemon.attachedPageCount}).`
          : `CDP inactive (${state.cdp.reason}). ${state.setupHint?.summary || ''}`,
      ].join('\n');
      return {
        content: [{ type: 'text', text }],
        structuredContent: state,
      };
    }

    case 'app_preset_assets': {
      const assets = collectPresetAssets({ names: args.names, kinds: args.kinds });
      const count = Object.keys(assets).length;
      return {
        content: [{ type: 'text', text: `Loaded visual preview assets for ${count} preset(s).` }],
        structuredContent: { count, assets },
      };
    }

    case 'theme_status': {
      const state = await collectStudioState({ includeVerify: Boolean(args.includeVerify) });
      const lines = [
        `Active Theme: ${state.config.themeName} (mode=${state.config.workspaceMode}, dimming=${state.config.dimming}%, blur=${state.config.glassBlur}px)`,
        `Presets (${state.presets.length}): ${state.presets.map((p) => `${p.name} (${p.source}, ${p.mediaType})`).join(', ')}`,
        `Payload: ${state.payload.exists ? `${state.payload.sizeKB} KB${state.payload.stale ? ' [stale]' : ' [fresh]'}` : 'not built'} (${state.payload.path})`,
        `CDP: ${state.cdp.available ? `available on 127.0.0.1:${state.cdp.port} (${state.cdp.pageCount} page(s))` : `unavailable — ${state.cdp.reason}`}`,
        `Daemon: ${state.daemon.running ? `running (${state.daemon.mode}, attached=${state.daemon.attachedPageCount}, media=${state.daemon.mediaBaseUrl || 'off'})` : 'stopped'}${state.daemon.externalDaemonPid ? ` (external PID ${state.daemon.externalDaemonPid})` : ''}`,
      ];
      if (state.setupHint) {
        lines.push(`Setup hint: ${state.setupHint.command}`);
      }
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        structuredContent: state,
      };
    }

    case 'theme_list_presets': {
      const presets = summarizePresets();
      const { merged } = loadMergedThemes(paths);
      const data = {
        count: presets.length,
        presets,
        ...(args.includeDefinitions ? { definitions: merged } : {}),
      };
      const lines = presets.map(
        (p) => `- ${p.name} [${p.source}] (${p.isLight ? 'Light' : 'Dark'}, ${p.mediaType}, ${p.primary}/${p.secondary}) — ${p.concept}`
      );
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        structuredContent: data,
      };
    }

    case 'theme_apply': {
      const { merged } = loadMergedThemes(paths);
      const allowedKeys = [
        'themeName',
        'bubbleName',
        'inputStyle',
        'workspaceMode',
        'dimming',
        'glassBlur',
        'chatOpacity',
        'accentOverride',
        'wpEnabled',
        'focusVignette',
        'zenMode',
        'reducedMotion',
        'avatarSize',
        'avatarRadius',
      ];

      const patch = {};
      for (const key of allowedKeys) {
        if (args[key] !== undefined) patch[key] = args[key];
      }

      if (patch.themeName && !Object.prototype.hasOwnProperty.call(merged, patch.themeName)) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Unknown theme preset "${patch.themeName}". Available presets: ${Object.keys(merged).join(', ')}.`,
            },
          ],
        };
      }
      if (patch.bubbleName && !Object.prototype.hasOwnProperty.call(merged, patch.bubbleName)) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Unknown bubble preset "${patch.bubbleName}". Available presets: ${Object.keys(merged).join(', ')}.`,
            },
          ],
        };
      }

      if (isPayloadStale(paths)) {
        buildPayload(paths);
      }

      const saved = daemon.saveConfig(patch);
      let liveResult = { cdpAvailable: false, appliedCount: 0, totalPages: 0 };

      if (daemon.sessions.size > 0) {
        const res = await daemon.applyConfigLive(patch);
        liveResult = { cdpAvailable: true, appliedCount: res.sessionCount, totalPages: res.sessionCount };
      } else {
        liveResult = await applyOverridesLive(patch);
      }

      if (args.openModal) {
        await openThemeModalLive();
      }

      const state = await collectStudioState();
      const summary = liveResult.cdpAvailable && liveResult.appliedCount > 0
        ? `Saved config and live-applied changes to ${liveResult.appliedCount}/${liveResult.totalPages} Antigravity page(s).`
        : `Saved config to ${paths.configFile}. Live CDP update skipped (${liveResult.reason || 'no themed page attached yet'}).`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: {
          saved,
          live: liveResult,
          state,
        },
      };
    }

    case 'theme_create_preset': {
      const savedPreset = saveUserThemePreset(paths, args.name, args.preset, {
        stageAssetFiles: args.stageAssets || {},
      });
      const build = buildPayload(paths);
      const shouldActivate = args.activate !== false;
      let live = { cdpAvailable: false, appliedCount: 0, totalPages: 0 };

      if (shouldActivate) {
        daemon.saveConfig({ themeName: savedPreset.name, bubbleName: savedPreset.name });
      }
      if (daemon.sessions.size > 0) {
        await daemon.reinjectAll();
        if (shouldActivate) {
          const res = await daemon.applyConfigLive({
            themeName: savedPreset.name,
            bubbleName: savedPreset.name,
          });
          live = { cdpAvailable: true, appliedCount: res.sessionCount, totalPages: res.sessionCount };
        }
      } else if (shouldActivate) {
        live = await applyOverridesLive({ themeName: savedPreset.name, bubbleName: savedPreset.name });
      }

      const state = await collectStudioState();
      return {
        content: [
          {
            type: 'text',
            text: `Saved preset "${savedPreset.name}" and compiled payload (${build.sizeKB} KB, ${build.themeCount} themes).${shouldActivate ? ` Activated "${savedPreset.name}".` : ''}${savedPreset.warnings.length ? ` Warnings: ${savedPreset.warnings.join('; ')}` : ''}`,
          },
        ],
        structuredContent: {
          preset: savedPreset,
          build,
          live,
          state,
        },
      };
    }

    case 'theme_delete_preset': {
      const result = deleteUserThemePreset(paths, args.name);
      if (!result.deleted) {
        return {
          isError: true,
          content: [{ type: 'text', text: result.reason }],
        };
      }
      const build = buildPayload(paths);
      if (daemon.sessions.size > 0) {
        await daemon.reinjectAll();
      }
      const state = await collectStudioState();
      return {
        content: [
          {
            type: 'text',
            text: `Deleted custom preset "${args.name}" and rebuilt payload (${build.sizeKB} KB, ${build.themeCount} themes).`,
          },
        ],
        structuredContent: { result, build, state },
      };
    }

    case 'theme_build_payload': {
      const build = buildPayload(paths, { maxDim: args.maxDim });
      let reloadedSessions = 0;
      if (daemon.sessions.size > 0) {
        reloadedSessions = await daemon.reinjectAll();
      }
      const state = await collectStudioState();
      return {
        content: [
          {
            type: 'text',
            text: `Compiled ${build.outPath} (${build.sizeKB} KB, ${build.themeCount} themes: ${build.themes.join(', ')}). Hot-reloaded ${reloadedSessions} active session(s).`,
          },
        ],
        structuredContent: { build, reloadedSessions, state },
      };
    }

    case 'theme_verify_cdp': {
      const report = await verifyCdpLive();
      const text = report.passed
        ? `PASS: ${report.themedCount}/${report.totalPages} Antigravity page(s) themed with zero live blur on port ${report.port}.`
        : `FAIL: ${report.failures.join(' | ')}`;
      return {
        content: [{ type: 'text', text }],
        structuredContent: report,
      };
    }

    case 'theme_reset': {
      const live = await removeThemeLive();
      if (args.resetConfig) {
        writeJsonAtomic(paths.configFile, {});
      }
      const state = await collectStudioState();
      const text = live.cdpAvailable
        ? `Removed live custom theme from ${live.clearedCount}/${live.totalPages} page(s).${args.resetConfig ? ' Reset theme_config.json.' : ''}`
        : `CDP unavailable (${live.reason}).${args.resetConfig ? ' Reset theme_config.json.' : ''}`;
      return {
        content: [{ type: 'text', text }],
        structuredContent: { live, resetConfig: Boolean(args.resetConfig), state },
      };
    }

    case 'theme_daemon_control': {
      const action = args.action;
      if (action === 'status') {
        const status = daemon.getStatus();
        return {
          content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
          structuredContent: status,
        };
      }
      if (action === 'start') {
        const started = await daemon.start();
        const status = daemon.getStatus();
        return {
          content: [{ type: 'text', text: `Embedded theme daemon running (attached=${status.attachedPageCount}, media=${status.mediaBaseUrl || 'off'}).` }],
          structuredContent: { started, status },
        };
      }
      if (action === 'stop') {
        daemon.stop('mcp-stop');
        const ext = stopExternalDaemon(paths);
        return {
          content: [{ type: 'text', text: `Stopped embedded daemon${ext.stopped ? ` and external daemon PID ${ext.pid}` : ''}.` }],
          structuredContent: { stoppedEmbedded: true, stoppedExternal: ext },
        };
      }
      if (action === 'restart') {
        daemon.stop('mcp-restart');
        const started = await daemon.start();
        return {
          content: [{ type: 'text', text: `Restarted embedded daemon (media=${started.mediaBaseUrl || 'off'}).` }],
          structuredContent: { started, status: daemon.getStatus() },
        };
      }
      if (action === 'reinject') {
        if (isPayloadStale(paths)) buildPayload(paths);
        await daemon.scanPages();
        const count = await daemon.reinjectAll();
        return {
          content: [{ type: 'text', text: `Reinjected theme payload on ${count} attached page(s).` }],
          structuredContent: { reinjected: count, status: daemon.getStatus() },
        };
      }
      if (action === 'open_modal') {
        const res = await openThemeModalLive();
        return {
          content: [
            {
              type: 'text',
              text: res.cdpAvailable
                ? `Opened in-shell Custom Theme modal on ${res.openedCount}/${res.totalPages} page(s).`
                : `CDP unavailable (${res.reason}).`,
            },
          ],
          structuredContent: res,
        };
      }
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown action: ${action}` }],
      };
    }

    default:
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      };
  }
}

function sendResponse(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function sendResult(id, result) {
  sendResponse({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  sendResponse({ jsonrpc: '2.0', id, error });
}

async function handleRequest(msg) {
  if (!msg || typeof msg !== 'object') return;
  const { id, method, params } = msg;

  // Notifications have no id
  if (id === undefined || id === null) {
    if (method === 'notifications/initialized') {
      debugLog('Client initialized.');
    }
    return;
  }

  try {
    switch (method) {
      case 'initialize': {
        const requested = params?.protocolVersion;
        const protocolVersion = SUPPORTED_PROTOCOLS.has(requested) ? requested : '2025-06-18';
        sendResult(id, {
          protocolVersion,
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
          },
          serverInfo: SERVER_INFO,
        });
        return;
      }

      case 'ping': {
        sendResult(id, {});
        return;
      }

      case 'tools/list': {
        sendResult(id, { tools: TOOLS });
        return;
      }

      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        if (!toolName || typeof toolName !== 'string') {
          sendError(id, -32602, 'Missing required tool name.');
          return;
        }
        const result = await handleToolCall(toolName, toolArgs);
        sendResult(id, result);
        return;
      }

      case 'resources/list': {
        sendResult(id, {
          resources: [
            {
              uri: APP_URI,
              name: 'Theme Studio App',
              description: 'Interactive Theme Studio dashboard for managing glassmorphic presets and CDP diagnostics.',
              mimeType: 'text/html;profile=mcp-app',
              _meta: {
                ui: {
                  prefersBorder: false,
                },
              },
            },
          ],
        });
        return;
      }

      case 'resources/read': {
        const uri = params?.uri;
        if (uri !== APP_URI) {
          sendError(id, -32002, `Resource not found: ${uri}`);
          return;
        }
        const html = readStudioHtml();
        sendResult(id, {
          contents: [
            {
              uri: APP_URI,
              mimeType: 'text/html;profile=mcp-app',
              text: html,
              _meta: {
                ui: {
                  prefersBorder: false,
                },
              },
            },
          ],
        });
        return;
      }

      default:
        sendError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    debugLog(`Error handling ${method}: ${err?.stack || err?.message || err}`);
    if (method === 'tools/call') {
      sendResult(id, {
        isError: true,
        content: [{ type: 'text', text: err?.message || String(err) }],
      });
    } else {
      sendError(id, -32603, err?.message || 'Internal error');
    }
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    sendError(null, -32700, `Parse error: ${err.message}`);
    return;
  }
  handleRequest(parsed);
});

let shuttingDown = false;
function gracefulExit(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  daemon.stop(reason);
  process.exit(0);
}

rl.on('close', () => gracefulExit('stdin-closed'));
process.on('SIGINT', () => gracefulExit('SIGINT'));
process.on('SIGTERM', () => gracefulExit('SIGTERM'));

if (!cli.noDaemon) {
  daemon.start().catch((err) => debugLog(`Embedded daemon failed to start: ${err.message}`));
}
