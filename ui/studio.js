import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
} from '@modelcontextprotocol/ext-apps';

const app = new App({ name: 'Theme Studio', version: '2.0.0' }, {});

let currentState = null;
let hostCapabilities = {};
let busy = false;
let sliderTimer = null;
let toastTimer = null;
let searchQuery = '';
let activeFilter = 'all'; // all | dark | light | art | avatars | custom
let assetsHydrationInFlight = false;
let assetsHydratedOnce = false;

// In-memory preview asset cache keyed by preset display name:
// { wallpaper?: string, sticker?: string, cornerSvg?: string, userAvatar?: string, agentAvatar?: string }
const previewCache = new Map();

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function applyHostContext(ctx) {
  if (!ctx) return;
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
}

function ingestState(nextState, { invalidateAssetCache = false } = {}) {
  if (!nextState) return;
  if (invalidateAssetCache) {
    previewCache.clear();
    assetsHydratedOnce = false;
  }

  for (const p of nextState.presets || []) {
    const existing = previewCache.get(p.name) || {};
    if (p.wallpaperPreview) existing.wallpaper = p.wallpaperPreview;
    if (p.stickerPreview) existing.sticker = p.stickerPreview;
    if (p.cornerPreview) existing.cornerSvg = p.cornerPreview;
    if (p.userAvatarPreview) existing.userAvatar = p.userAvatarPreview;
    if (p.agentAvatarPreview) existing.agentAvatar = p.agentAvatarPreview;
    if (Object.keys(existing).length > 0) {
      previewCache.set(p.name, existing);
    }
  }

  currentState = nextState;
}

async function hydratePresetAssets(force = false) {
  if (!currentState || assetsHydrationInFlight) return;
  const presets = currentState.presets || [];
  if (presets.length === 0) return;

  const missingWpNames = presets
    .filter((p) => p.mediaType === 'svg-art' && !previewCache.get(p.name)?.wallpaper)
    .map((p) => p.name);
  const needsDecorationHydration =
    force ||
    !assetsHydratedOnce ||
    presets.some((p) => {
      const c = previewCache.get(p.name);
      return (p.hasOrnament && !c?.sticker && !c?.cornerSvg) || (p.hasAvatars && !c?.userAvatar && !c?.agentAvatar);
    });

  if (!needsDecorationHydration && missingWpNames.length === 0) return;

  assetsHydrationInFlight = true;
  try {
    if (needsDecorationHydration) {
      const res = await app.callServerTool({
        name: 'app_preset_assets',
        arguments: { kinds: ['sticker', 'cornerSvg', 'userAvatar', 'agentAvatar'] },
      });
      const assetMap = res?.structuredContent?.assets;
      if (assetMap && typeof assetMap === 'object') {
        for (const [name, entry] of Object.entries(assetMap)) {
          previewCache.set(name, { ...(previewCache.get(name) || {}), ...entry });
        }
        assetsHydratedOnce = true;
      }
    }

    if (missingWpNames.length > 0) {
      const res = await app.callServerTool({
        name: 'app_preset_assets',
        arguments: { names: missingWpNames, kinds: ['wallpaper'] },
      });
      const wpMap = res?.structuredContent?.assets;
      if (wpMap && typeof wpMap === 'object') {
        for (const [name, entry] of Object.entries(wpMap)) {
          previewCache.set(name, { ...(previewCache.get(name) || {}), ...entry });
        }
      }
    }

    updatePresetGridOnly();
  } catch {
    // Non-fatal: cards already display wallpaper previews & palette swatches
  } finally {
    assetsHydrationInFlight = false;
  }
}

async function callTool(name, args = {}) {
  busy = true;
  render();
  try {
    const result = await app.callServerTool({ name, arguments: args });
    if (result?.isError) {
      const errMsg = result.content?.[0]?.text || 'Tool call failed';
      showToast(errMsg);
      return result;
    }
    const sc = result?.structuredContent;
    const mutatePresets = name === 'theme_create_preset' || name === 'theme_delete_preset';
    if (sc?.state) {
      ingestState(sc.state, { invalidateAssetCache: mutatePresets });
    } else if (sc?.presets && sc?.config) {
      ingestState(sc, { invalidateAssetCache: false });
    } else if (name === 'theme_verify_cdp' && sc) {
      if (currentState) currentState = { ...currentState, verify: sc };
    }
    if (mutatePresets) {
      hydratePresetAssets(true);
    }
    return result;
  } catch (err) {
    showToast(err?.message || String(err));
    return null;
  } finally {
    busy = false;
    render();
  }
}

async function refreshState(includeVerify = false) {
  const includePreviews = !currentState;
  await callTool('app_studio_state', { includeVerify, includePreviews });
  hydratePresetAssets(false);
}

function schedulePatch(patch, toastLabel) {
  if (currentState?.config) {
    currentState = {
      ...currentState,
      config: { ...currentState.config, ...patch },
    };
  }
  clearTimeout(sliderTimer);
  sliderTimer = setTimeout(async () => {
    await callTool('theme_apply', patch);
    if (toastLabel) showToast(toastLabel);
  }, 180);
}

function filterPresets(presets) {
  const q = searchQuery.trim().toLowerCase();
  return (presets || []).filter((p) => {
    if (activeFilter === 'dark' && p.isLight) return false;
    if (activeFilter === 'light' && !p.isLight) return false;
    if (activeFilter === 'art' && !p.hasWallpaperArt && p.mediaType === 'css-gradient') return false;
    if (activeFilter === 'avatars' && !p.hasAvatars) return false;
    if (activeFilter === 'custom' && p.source === 'builtin') return false;
    if (!q) return true;
    const searchable = [
      p.name,
      p.concept || '',
      p.mediaType || '',
      p.isLight ? 'light' : 'dark',
      p.hasWallpaperArt ? 'wallpaper art' : 'glass gradient',
      p.hasOrnament ? 'ornament sticker' : '',
      p.hasAvatars ? 'avatars' : '',
      p.source || '',
    ]
      .join(' ')
      .toLowerCase();
    return searchable.includes(q);
  });
}

function mediaBadgeLabel(p) {
  if (p.mediaType === 'video') return '4K Live';
  if (p.mediaType === 'animated-gif') return 'Animated';
  if (p.mediaType === 'svg-art') return 'Wallpaper Art';
  if (p.mediaType === 'image') return '2K Art';
  return 'Pure Glass';
}

function renderPresetGridHtml(presets, cfg) {
  const filtered = filterPresets(presets);
  if (filtered.length === 0) {
    return `<div class="empty-state">No presets match "${esc(searchQuery)}" in this category.</div>`;
  }
  return filtered
    .map((p) => {
      const isActive = cfg.themeName === p.name;
      const cached = previewCache.get(p.name) || {};
      const wpUri = cached.wallpaper || p.wallpaperPreview || '';
      const stickerUri = cached.sticker || p.stickerPreview || '';
      const cornerUri = cached.cornerSvg || p.cornerPreview || '';
      const userAvUri = cached.userAvatar || p.userAvatarPreview || '';
      const agentAvUri = cached.agentAvatar || p.agentAvatarPreview || '';

      const fallbackBg =
        p.pureBg ||
        `linear-gradient(135deg, rgb(${esc(p.overlayRgb)}) 0%, ${esc(p.primary)}55 58%, ${esc(p.secondary)}66 100%)`;

      const badges = [
        `<span class="fbadge ${p.hasWallpaperArt ? 'art' : 'glass'}">${esc(mediaBadgeLabel(p))}</span>`,
        p.hasOrnament
          ? `<span class="fbadge ornament">${p.isOrnament ? 'Ornament' : 'Mascot'}</span>`
          : '',
        p.hasAvatars ? `<span class="fbadge avatars">Avatars</span>` : '',
        `<span class="fbadge ${p.isLight ? 'light' : 'dark'}">${p.isLight ? 'Light' : 'Dark'}</span>`,
      ]
        .filter(Boolean)
        .join('');

      return `
        <div class="preset-card ${isActive ? 'active' : ''} ${p.isLight ? 'is-light' : 'is-dark'}">
          <div class="card-preview" style="background:${esc(fallbackBg)}">
            ${wpUri ? `<img class="preview-wp" src="${esc(wpUri)}" alt="" loading="lazy" decoding="async" />` : ''}
            <div class="preview-scrim ${p.isLight ? 'light' : 'dark'}"></div>
            ${cornerUri ? `<img class="preview-corner" src="${esc(cornerUri)}" alt="" loading="lazy" decoding="async" />` : ''}
            ${
              stickerUri
                ? `<img class="preview-sticker ${p.isOrnament ? 'ornament' : 'mascot'}" src="${esc(stickerUri)}" alt="" loading="lazy" decoding="async" />`
                : ''
            }
            <div class="preview-top-right">
              ${isActive ? `<span class="tag active-tag">Active</span>` : ''}
            </div>
            <div class="preview-footer">
              <div class="swatch-dots">
                <span class="swatch-dot" style="background:rgb(${esc(p.overlayRgb)})" title="Base rgb(${esc(p.overlayRgb)})"></span>
                <span class="swatch-dot" style="background:${esc(p.primary)}" title="Primary ${esc(p.primary)}"></span>
                <span class="swatch-dot" style="background:${esc(p.secondary)}" title="Secondary ${esc(p.secondary)}"></span>
                <span class="swatch-dot" style="background:${esc(p.textColor || '#f8fafc')}" title="Text ${esc(p.textColor || '')}"></span>
              </div>
              ${
                userAvUri || agentAvUri
                  ? `<div class="avatar-pair">
                      ${userAvUri ? `<img class="avatar-badge" style="border-color:${esc(p.primary)}" src="${esc(userAvUri)}" alt="" title="User Avatar" loading="lazy" decoding="async" />` : ''}
                      ${agentAvUri ? `<img class="avatar-badge" style="border-color:${esc(p.secondary)}" src="${esc(agentAvUri)}" alt="" title="Agent Avatar" loading="lazy" decoding="async" />` : ''}
                    </div>`
                  : ''
              }
            </div>
          </div>
          <div class="preset-body">
            <div class="preset-title">
              <span class="preset-name" title="${esc(p.name)}">${esc(p.name)}</span>
              ${p.source !== 'builtin' ? `<span class="source-pill">${esc(p.source)}</span>` : ''}
            </div>
            <div class="preset-concept">${esc(p.concept)}</div>
            <div class="feature-badges">${badges}</div>
            <div class="preset-actions">
              <button class="btn ${isActive ? 'primary' : ''}" data-action="apply-preset" data-preset="${esc(p.name)}" ${busy ? 'disabled' : ''}>
                ${isActive ? 'Active' : 'Apply'}
              </button>
              ${
                p.source !== 'builtin'
                  ? `<button class="btn danger" data-action="delete-preset" data-preset="${esc(p.name)}" ${busy ? 'disabled' : ''}>Delete</button>`
                  : ''
              }
            </div>
          </div>
        </div>`;
    })
    .join('');
}

function updatePresetGridOnly() {
  if (!currentState) return;
  const grid = document.getElementById('preset-grid');
  const countLabel = document.getElementById('preset-count-label');
  const presets = currentState.presets || [];
  const filtered = filterPresets(presets);
  if (countLabel) {
    countLabel.textContent = `Showing ${filtered.length} of ${presets.length} presets`;
  }
  if (grid) {
    grid.innerHTML = renderPresetGridHtml(presets, currentState.config || {});
    bindPresetCardActions(grid);
  }
}

function render() {
  const root = document.getElementById('app');
  if (!root) return;

  if (!currentState) {
    root.innerHTML = `
      <div class="studio">
        <div class="header">
          <div class="brand">
            <div class="brand-mark">✦</div>
            <div>
              <h1>Theme Studio</h1>
              <p>Loading presets and CDP runtime state…</p>
            </div>
          </div>
        </div>
      </div>`;
    return;
  }

  const st = currentState;
  const cfg = st.config || {};
  const presets = st.presets || [];
  const activePreset = presets.find((p) => p.name === cfg.themeName);
  const filtered = filterPresets(presets);
  const darkCount = presets.filter((p) => !p.isLight).length;
  const lightCount = presets.filter((p) => p.isLight).length;
  const artCount = presets.filter((p) => p.hasWallpaperArt || p.mediaType !== 'css-gradient').length;
  const avatarCount = presets.filter((p) => p.hasAvatars).length;
  const customCount = presets.filter((p) => p.source !== 'builtin').length;

  const cdpOk = Boolean(st.cdp?.available);
  const daemonOk = Boolean(st.daemon?.running);
  const canMessage = Boolean(hostCapabilities?.message);

  const brandBg = activePreset
    ? `linear-gradient(135deg, ${esc(activePreset.primary)} 0%, ${esc(activePreset.secondary)} 100%)`
    : 'linear-gradient(135deg, #f472b6 0%, #c084fc 55%, #38bdf8 100%)';

  const setupBanner = !cdpOk && st.setupHint
    ? `
      <div class="banner">
        <div class="banner-title">Live shell theming needs CDP (--remote-debugging-port=0)</div>
        <div class="muted">${esc(st.setupHint.summary)}</div>
        <code>${esc(st.setupHint.command)}</code>
      </div>`
    : '';

  const verifySummary = st.verify
    ? JSON.stringify(
        {
          passed: st.verify.passed,
          port: st.verify.port,
          themedCount: st.verify.themedCount,
          totalPages: st.verify.totalPages,
          failures: st.verify.failures,
          pages: (st.verify.pages || []).map((pg) => ({
            title: pg.title,
            themeActive: pg.themeActive,
            activeTheme: pg.activeTheme,
            hasLiveBlurRule: pg.hasLiveBlurRule,
            prebakedGlassPresent: pg.prebakedGlassPresent,
            shellHoleActive: pg.shellHoleActive,
            focusVignette: pg.focusVignette,
          })),
        },
        null,
        2
      )
    : `Payload: ${st.payload?.exists ? `${st.payload.sizeKB} KB` : 'not built'} (${st.payload?.stale ? 'stale' : 'fresh'})\nData dir: ${st.paths?.dataDir || ''}\nMedia server: ${st.daemon?.mediaBaseUrl || 'inactive'}\nClick "Verify CDP" to inspect live DOM & Zero-Live-Blur compliance.`;

  root.innerHTML = `
    <div class="studio">
      <div class="header">
        <div class="brand">
          <div class="brand-mark" style="background:${brandBg}">✦</div>
          <div>
            <h1>Theme Studio</h1>
            <p>Active: <strong>${esc(cfg.themeName)}</strong> · ${presets.length} Presets · Zero Live Blur</p>
          </div>
        </div>
        <div class="status-pills">
          <span class="pill ${cdpOk ? 'ok' : 'warn'}">
            <span class="dot"></span>
            ${cdpOk ? `CDP :${esc(st.cdp.port)} (${esc(st.daemon?.attachedPageCount ?? 0)} attached)` : 'CDP Inactive'}
          </span>
          <span class="pill ${daemonOk ? 'ok' : 'warn'}">
            <span class="dot"></span>
            ${daemonOk ? 'Daemon Live' : 'Daemon Stopped'}
          </span>
        </div>
      </div>

      <div class="toolbar">
        <button class="btn" data-action="refresh" ${busy ? 'disabled' : ''}>Refresh</button>
        <button class="btn" data-action="rebuild" ${busy ? 'disabled' : ''}>Rebuild Payload</button>
        <button class="btn" data-action="verify" ${busy ? 'disabled' : ''}>Verify CDP</button>
        ${cdpOk ? `<button class="btn" data-action="open-modal" ${busy ? 'disabled' : ''}>Open Shell Modal</button>` : ''}
        ${canMessage ? `<button class="btn primary" data-action="ask-design" ${busy ? 'disabled' : ''}>Design Custom Theme with Agent</button>` : ''}
        <button class="btn danger" data-action="reset-live" ${busy ? 'disabled' : ''}>Strip Live Theme</button>
      </div>

      ${setupBanner}

      <div class="section">
        <div class="section-head">
          <h2>Theme Gallery (${presets.length})</h2>
          <span id="preset-count-label" class="muted">Showing ${filtered.length} of ${presets.length} presets</span>
        </div>
        <div class="filter-bar">
          <input id="preset-search" class="search-input" type="search" placeholder="Search Catppuccin, Tokyo Night, Dracula, Nord, SynthWave, Light…" value="${esc(searchQuery)}" />
          <div class="filter-tabs">
            ${[
              ['all', `All (${presets.length})`],
              ['dark', `Dark (${darkCount})`],
              ['light', `Light (${lightCount})`],
              ['art', `Wallpaper Art (${artCount})`],
              ['avatars', `Avatars (${avatarCount})`],
              ['custom', `Custom (${customCount})`],
            ]
              .map(
                ([key, label]) =>
                  `<button data-filter="${key}" class="${activeFilter === key ? 'selected' : ''}">${label}</button>`
              )
              .join('')}
          </div>
        </div>
        <div id="preset-grid" class="preset-grid">${renderPresetGridHtml(presets, cfg)}</div>
      </div>

      <div class="section">
        <div class="section-head">
          <h2>Live Glass &amp; Readability Controls</h2>
          <span class="muted">Saved eagerly to theme_config.json</span>
        </div>
        <div class="controls-grid">
          <div class="control-group">
            <div class="control-label"><span>Workspace Mode</span><span>${esc(cfg.workspaceMode)}</span></div>
            <div class="segmented">
              ${['focus', 'balanced', 'immersive']
                .map(
                  (m) =>
                    `<button data-action="set-mode" data-val="${m}" class="${cfg.workspaceMode === m ? 'selected' : ''}" ${busy ? 'disabled' : ''}>${m[0].toUpperCase() + m.slice(1)}</button>`
                )
                .join('')}
            </div>
          </div>

          <div class="control-group">
            <div class="control-label"><span>Accent Override</span><span>${esc(cfg.accentOverride || 'Default')}</span></div>
            <div class="chip-row">
              ${[
                ['', 'Default'],
                ['sakura', 'Sakura'],
                ['rose', 'Rose'],
                ['lavender', 'Lavender'],
              ]
                .map(
                  ([val, label]) =>
                    `<button data-action="set-accent" data-val="${val}" class="${(cfg.accentOverride || '') === val ? 'selected' : ''}" ${busy ? 'disabled' : ''}>${label}</button>`
                )
                .join('')}
            </div>
          </div>

          <div class="control-group">
            <div class="control-label"><span>Wallpaper Dimming</span><span id="dimming-val">${esc(cfg.dimming)}%</span></div>
            <input id="dimming-slider" type="range" min="0" max="95" value="${esc(cfg.dimming)}" />
          </div>

          <div class="control-group">
            <div class="control-label"><span>Pre-baked Glass Blur</span><span id="blur-val">${esc(cfg.glassBlur)}px</span></div>
            <input id="blur-slider" type="range" min="0" max="12" value="${esc(cfg.glassBlur)}" />
          </div>

          <div class="control-group">
            <div class="control-label"><span>Composer Frame Style</span></div>
            <select id="input-style-select">
              ${[
                ['sync', 'Synced Ornament Frame'],
                ['double_gold', 'Amber Gold Double Border'],
                ['glass', 'Translucent Crystal Glass'],
                ['minimal', 'Minimal Clean'],
              ]
                .map(
                  ([val, label]) =>
                    `<option value="${val}" ${cfg.inputStyle === val ? 'selected' : ''}>${label}</option>`
                )
                .join('')}
            </select>
          </div>

          <div class="control-group">
            <div class="control-label"><span>Card Opacity Override</span><span id="opacity-val">${cfg.chatOpacity ? esc(cfg.chatOpacity) + '%' : 'Mode default'}</span></div>
            <input id="opacity-slider" type="range" min="0" max="100" value="${esc(cfg.chatOpacity || 0)}" />
          </div>
        </div>

        <div class="toggles">
          ${[
            ['wpEnabled', 'Wallpaper / Live Video'],
            ['focusVignette', 'Focus Vignette'],
            ['zenMode', 'Zen Mode (Ctrl+Shift+Z)'],
            ['reducedMotion', 'Reduced Motion'],
          ]
            .map(
              ([key, label]) => `
            <label class="toggle-item">
              <span>${label}</span>
              <input type="checkbox" data-toggle="${key}" ${cfg[key] ? 'checked' : ''} />
            </label>`
            )
            .join('')}
        </div>
      </div>

      <div class="section">
        <div class="section-head">
          <h2>Diagnostics &amp; CDP Verification</h2>
          <span class="muted">Zero Live Blur · Split-Browser Safe</span>
        </div>
        <div class="diag-box">${esc(verifySummary)}</div>
      </div>
    </div>
    <div id="toast" class="toast"></div>
  `;

  bindEvents(root);
}

function bindPresetCardActions(container) {
  container.querySelectorAll('[data-action="apply-preset"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const preset = btn.dataset.preset;
      await callTool('theme_apply', { themeName: preset, bubbleName: preset });
      showToast(`Activated ${preset}`);
    });
  });

  container.querySelectorAll('[data-action="delete-preset"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const preset = btn.dataset.preset;
      await callTool('theme_delete_preset', { name: preset });
      showToast(`Deleted ${preset}`);
    });
  });
}

function bindEvents(root) {
  const searchInput = root.querySelector('#preset-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      updatePresetGridOnly();
    });
  }

  root.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      root.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('selected', b === btn));
      updatePresetGridOnly();
    });
  });

  bindPresetCardActions(root);

  root.querySelectorAll('[data-action]').forEach((btn) => {
    const action = btn.dataset.action;
    if (action === 'apply-preset' || action === 'delete-preset') return;
    btn.addEventListener('click', async () => {
      if (action === 'refresh') {
        await refreshState(false);
        showToast('Refreshed state');
      } else if (action === 'rebuild') {
        await callTool('theme_build_payload', {});
        showToast('Rebuilt theme payload');
      } else if (action === 'verify') {
        const res = await callTool('theme_verify_cdp', {});
        showToast(res?.structuredContent?.passed ? 'CDP verification passed' : 'Check diagnostics output');
      } else if (action === 'open-modal') {
        await callTool('theme_daemon_control', { action: 'open_modal' });
        showToast('Triggered in-shell modal');
      } else if (action === 'reset-live') {
        await callTool('theme_reset', { resetConfig: false });
        showToast('Stripped live custom theme');
      } else if (action === 'ask-design') {
        await app.sendMessage({
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Use /theme-studio to help me design and create a custom glassmorphic theme preset. Ask me for my desired aesthetic vibe or wallpaper image.',
            },
          ],
        });
        showToast('Sent request to conversation');
      } else if (action === 'set-mode') {
        await callTool('theme_apply', { workspaceMode: btn.dataset.val });
        showToast(`Mode: ${btn.dataset.val}`);
      } else if (action === 'set-accent') {
        await callTool('theme_apply', { accentOverride: btn.dataset.val });
        showToast('Accent updated');
      }
    });
  });

  const dimSlider = root.querySelector('#dimming-slider');
  const dimVal = root.querySelector('#dimming-val');
  if (dimSlider) {
    dimSlider.addEventListener('input', () => {
      const v = Number.parseInt(dimSlider.value, 10);
      if (dimVal) dimVal.textContent = `${v}%`;
      schedulePatch({ dimming: v }, `Dimming ${v}%`);
    });
  }

  const blurSlider = root.querySelector('#blur-slider');
  const blurVal = root.querySelector('#blur-val');
  if (blurSlider) {
    blurSlider.addEventListener('input', () => {
      const v = Number.parseInt(blurSlider.value, 10);
      if (blurVal) blurVal.textContent = `${v}px`;
      schedulePatch({ glassBlur: v }, `Glass blur ${v}px`);
    });
  }

  const opacitySlider = root.querySelector('#opacity-slider');
  const opacityVal = root.querySelector('#opacity-val');
  if (opacitySlider) {
    opacitySlider.addEventListener('input', () => {
      const v = Number.parseInt(opacitySlider.value, 10);
      if (opacityVal) opacityVal.textContent = v ? `${v}%` : 'Mode default';
      schedulePatch({ chatOpacity: v }, 'Updated card opacity');
    });
  }

  const styleSelect = root.querySelector('#input-style-select');
  if (styleSelect) {
    styleSelect.addEventListener('change', async () => {
      await callTool('theme_apply', { inputStyle: styleSelect.value });
      showToast(`Frame style: ${styleSelect.value}`);
    });
  }

  root.querySelectorAll('[data-toggle]').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      const key = checkbox.dataset.toggle;
      await callTool('theme_apply', { [key]: checkbox.checked });
      showToast(`Updated ${key}`);
    });
  });
}

// Register handlers BEFORE connect() per MCP Apps lifecycle
app.ontoolinput = () => {
  render();
};

app.ontoolresult = (result) => {
  const sc = result?.structuredContent;
  if (sc?.presets && sc?.config) {
    ingestState(sc);
  } else if (sc?.state) {
    ingestState(sc.state);
  }
  render();
  hydratePresetAssets(false);
};

app.onhostcontextchanged = (ctx) => {
  applyHostContext(ctx);
};

async function init() {
  render();
  await app.connect();
  hostCapabilities = app.getHostCapabilities() || {};
  applyHostContext(app.getHostContext());
  if (!currentState) {
    await refreshState(false);
  } else {
    hydratePresetAssets(false);
  }
}

init().catch((err) => {
  const root = document.getElementById('app');
  if (root) {
    root.innerHTML = `<div class="studio"><div class="banner"><div class="banner-title">Failed to initialize Theme Studio</div><div>${esc(err?.message || err)}</div></div></div>`;
  }
});
