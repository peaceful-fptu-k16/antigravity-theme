(() => {
  const THEMES = /*__THEMES_PLACEHOLDER__*/{};
  const THEME_KEYS = Object.keys(THEMES);
  const DEFAULT_THEME_KEY = THEME_KEYS[0] || 'Default';

  const STORAGE_THEME = 'agy_theme_v3';
  const STORAGE_BUBBLE = 'agy_bubble_v3';
  const STORAGE_INPUT = 'agy_input_v3';
  const STORAGE_DIMMING = 'agy_dimming_v3';
  const STORAGE_WP_ENABLED = 'agy_wp_enabled_v3';
  const STORAGE_CUSTOM_WP = 'agy_custom_wp_v3';
  const STORAGE_USER_AVATAR = 'agy_user_avatar_v3';
  const STORAGE_AGENT_AVATAR = 'agy_agent_avatar_v3';
  const STORAGE_GLASS_BLUR = 'agy_glass_blur_v3';
  const STORAGE_AVATAR_SIZE = 'agy_avatar_size_v3';
  const STORAGE_AVATAR_RADIUS = 'agy_avatar_radius_v3';
  const STORAGE_MODE = 'agy_mode_v3';
  const STORAGE_CHAT_OPACITY = 'agy_chat_opacity_v3';
  const STORAGE_ACCENT = 'agy_accent_v3';
  const STORAGE_REDUCED_MOTION = 'agy_reduced_motion_v3';
  const STORAGE_ZEN = 'agy_zen_v3';
  const STORAGE_FOCUS_VIGNETTE = 'agy_focus_vignette_v3';

  const ACCENT_PRESETS = {
    '': { label: 'Theme Default', primary: null, glow: null },
    'sakura': { label: 'Sakura', primary: '#E88BB9', glow: 'rgba(232, 139, 185, 0.24)' },
    'rose': { label: 'Rose', primary: '#FB7185', glow: 'rgba(251, 113, 133, 0.24)' },
    'lavender': { label: 'Lavender', primary: '#C084FC', glow: 'rgba(192, 132, 252, 0.24)' }
  };

  const MODE_PRESETS = {
    'focus': { label: 'Focus', desc: 'Deep focus · high contrast', defaultDim: 76, defaultCardAlpha: 0.97, minSidebarAlpha: 0.88 },
    'balanced': { label: 'Balanced', desc: 'Crisp reading · sakura depth', defaultDim: 34, defaultCardAlpha: 0.95, minSidebarAlpha: 0.72 },
    'immersive': { label: 'Immersive', desc: 'Vivid scenery · airy glass', defaultDim: 26, defaultCardAlpha: 0.86, minSidebarAlpha: 0.44 }
  };

  function withRgbaAlpha(colorStr, targetAlpha) {
    if (!colorStr || typeof colorStr !== 'string') return colorStr;
    const m = colorStr.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i);
    if (!m) return colorStr;
    const clamped = Math.max(0.05, Math.min(0.99, targetAlpha));
    return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${clamped.toFixed(2)})`;
  }

  const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  const INPUT_STYLES = {
    'sync': {
      label: 'Synced Ornament Frame',
      desc: 'Follows the active theme borders & decorative SVG ornament'
    },
    'double_gold': {
      label: 'Amber Gold Double Border',
      desc: 'Warm metallic double border with corner filigree'
    },
    'glass': {
      label: 'Translucent Crystal Glass',
      desc: 'Lets more of your background artwork shine through'
    },
    'minimal': {
      label: 'Minimal Clean',
      desc: 'Sleek subtle border without top decorative stickers'
    }
  };

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeCssUrl(url) {
    return String(url || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, '%27');
  }

  function parseFiniteInt(val, fallback) {
    if (val === undefined || val === null || val === '') return fallback;
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function getState() {
    const init = window.__AGY_INITIAL_CONFIG__ || {};
    const rawTheme = localStorage.getItem(STORAGE_THEME) || init.themeName || DEFAULT_THEME_KEY;
    const themeName = THEMES[rawTheme] ? rawTheme : DEFAULT_THEME_KEY;
    const rawBubble = localStorage.getItem(STORAGE_BUBBLE) || init.bubbleName || themeName;
    const bubbleName = THEMES[rawBubble] ? rawBubble : themeName;
    const inputStyle = localStorage.getItem(STORAGE_INPUT) || init.inputStyle || 'sync';
    const activeThemeDef = THEMES[themeName] || {};
    const defaultDim = Number.isFinite(activeThemeDef.defaultDimming) ? activeThemeDef.defaultDimming : 69;
    const defaultBlur = parseFiniteInt(String(activeThemeDef.headerBlur || '').replace(/[^\d]/g, ''), 3);
    const dimming = parseFiniteInt(localStorage.getItem(STORAGE_DIMMING) ?? init.dimming, defaultDim);
    const wpEnabled = localStorage.getItem(STORAGE_WP_ENABLED) !== null
      ? localStorage.getItem(STORAGE_WP_ENABLED) !== 'false'
      : (init.wpEnabled !== undefined ? init.wpEnabled : true);
    const customWp = localStorage.getItem(STORAGE_CUSTOM_WP) || init.customWp || '';
    const userAvatar = localStorage.getItem(STORAGE_USER_AVATAR) ?? init.userAvatar ?? '';
    const agentAvatar = localStorage.getItem(STORAGE_AGENT_AVATAR) ?? init.agentAvatar ?? '';
    const glassBlur = parseFiniteInt(localStorage.getItem(STORAGE_GLASS_BLUR) ?? init.glassBlur, defaultBlur);
    const avatarSize = parseFiniteInt(localStorage.getItem(STORAGE_AVATAR_SIZE) ?? init.avatarSize, 32);
    const avatarRadius = parseFiniteInt(localStorage.getItem(STORAGE_AVATAR_RADIUS) ?? init.avatarRadius, 50);
    const rawMode = localStorage.getItem(STORAGE_MODE) || init.workspaceMode || 'balanced';
    const workspaceMode = MODE_PRESETS[rawMode] ? rawMode : 'balanced';
    const chatOpacity = parseFiniteInt(localStorage.getItem(STORAGE_CHAT_OPACITY) ?? init.chatOpacity, 0);
    const rawAccent = localStorage.getItem(STORAGE_ACCENT) ?? init.accentOverride ?? '';
    const accentOverride = Object.prototype.hasOwnProperty.call(ACCENT_PRESETS, rawAccent) ? rawAccent : '';
    const reducedMotion = localStorage.getItem(STORAGE_REDUCED_MOTION) !== null
      ? localStorage.getItem(STORAGE_REDUCED_MOTION) === 'true'
      : Boolean(init.reducedMotion);
    const zenMode = localStorage.getItem(STORAGE_ZEN) !== null
      ? localStorage.getItem(STORAGE_ZEN) === 'true'
      : Boolean(init.zenMode);
    const focusVignette = localStorage.getItem(STORAGE_FOCUS_VIGNETTE) !== null
      ? localStorage.getItem(STORAGE_FOCUS_VIGNETTE) !== 'false'
      : (init.focusVignette !== undefined ? Boolean(init.focusVignette) : true);
    return { themeName, bubbleName, inputStyle, dimming, wpEnabled, customWp, userAvatar, agentAvatar, glassBlur, avatarSize, avatarRadius, workspaceMode, chatOpacity, accentOverride, reducedMotion, zenMode, focusVignette };
  }

  function isVideoMediaUrl(url) {
    return typeof url === 'string' && (/^data:video\//i.test(url) || /\.(mp4|webm)(\?.*)?$/i.test(url));
  }

  function getVideoBlobUrl(url) {
    if (!url) return url;
    if (url.startsWith('__AGY_MEDIA__/')) {
      const base = window.__AGY_MEDIA_BASE__ || '';
      return base ? `${base}/${url.slice('__AGY_MEDIA__/'.length)}` : url;
    }
    if (!url.startsWith('data:video/')) return url;
    window.__AGY_VIDEO_BLOB_CACHE__ = window.__AGY_VIDEO_BLOB_CACHE__ || {};
    const key = `${url.slice(0, 64)}|${url.length}`;
    if (window.__AGY_VIDEO_BLOB_CACHE__[key]) return window.__AGY_VIDEO_BLOB_CACHE__[key];
    try {
      const comma = url.indexOf(',');
      const header = url.slice(5, comma);
      const mime = header.split(';')[0] || 'video/mp4';
      const bin = atob(url.slice(comma + 1));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
      window.__AGY_VIDEO_BLOB_CACHE__[key] = blobUrl;
      return blobUrl;
    } catch (_) {
      return url;
    }
  }

  function bakeGlassFromSource(sourceEl, natW, natH, key, overlayRgb, overlayAlpha, tintBg, blurStr) {
    try {
      const w = 640;
      const h = Math.max(180, Math.round((natH || 1440) * (w / (natW || 2560))));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const pxMatch = String(blurStr !== undefined ? blurStr : '3px').match(/(\d+(?:\.\d+)?)/);
      const scaledBlur = Math.max(0, Math.min(16, Math.round((pxMatch ? parseFloat(pxMatch[1]) : 3) * 0.75)));
      ctx.filter = scaledBlur > 0 ? `blur(${scaledBlur}px)` : 'none';
      ctx.drawImage(sourceEl, -12, -12, w + 24, h + 24);
      ctx.filter = 'none';
      ctx.fillStyle = `rgba(${overlayRgb}, ${overlayAlpha})`;
      ctx.fillRect(0, 0, w, h);
      if (tintBg) {
        ctx.fillStyle = tintBg;
        ctx.fillRect(0, 0, w, h);
      }
      const baked = canvas.toDataURL('image/webp', 0.85);
      window.__AGY_BLUR_CACHE__ = window.__AGY_BLUR_CACHE__ || {};
      window.__AGY_BLUR_CACHE__[key] = baked;
      if (window.__AGY_LAST_GLASS__ && window.__AGY_LAST_GLASS__.key === key) {
        window.__AGY_LAST_GLASS__.url = baked;
        const curShell = document.querySelector('.agy-shell');
        if (curShell) curShell.style.setProperty('--agy-l-glass-bg', 'url("' + baked + '")');
      }
    } catch (e) {}
  }

  function cleanupVideoWallpaper() {
    if (window.__AGY_VIDEO_XFADE_RAF__) {
      cancelAnimationFrame(window.__AGY_VIDEO_XFADE_RAF__);
      window.__AGY_VIDEO_XFADE_RAF__ = 0;
    }
    if (window.__AGY_VIDEO_XFADE_TIMER__) {
      clearTimeout(window.__AGY_VIDEO_XFADE_TIMER__);
      window.__AGY_VIDEO_XFADE_TIMER__ = 0;
    }
    window.__AGY_VIDEO_LOOP_STATE__ = null;
    ['agy-bg-video', 'agy-bg-video-b', 'agy-bg-scrim'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }

  function cleanupFocusVignette() {
    const el = document.getElementById('agy-focus-vignette');
    if (el) el.remove();
    const shell = document.querySelector('.agy-shell');
    if (shell) {
      delete shell.dataset.agyContext;
      delete shell.dataset.agyMode;
      delete shell.dataset.agyFocusVignette;
    }
  }

  function syncFocusVignette(stOverride) {
    const shell = document.querySelector('.agy-shell');
    if (!shell) return;
    const st = stOverride || getState();
    const mainTheme = THEMES[st.themeName] || THEMES[DEFAULT_THEME_KEY] || {};
    const enabled = Boolean(st.focusVignette && st.wpEnabled && !mainTheme.isLight);

    const hasTerminal = Boolean(shell.querySelector('[data-testid="bottom-terminal-panel"], .xterm'));
    const hasSidePanel = shell.dataset.agySideGlass === '1' || Boolean(shell.querySelector('[data-side-panel-body="true"] > *'));
    const hasConversation = Boolean(shell.querySelector('[data-testid="agent-response"], [data-testid="user-message"], [data-step-list="true"]'));

    const context = (hasTerminal || hasSidePanel)
      ? 'technical'
      : (hasConversation ? 'conversation' : 'welcome');

    shell.dataset.agyContext = context;
    shell.dataset.agyMode = st.workspaceMode || 'balanced';
    shell.dataset.agyFocusVignette = enabled ? 'on' : 'off';

    let vignette = document.getElementById('agy-focus-vignette');
    if (!enabled) {
      if (vignette) vignette.remove();
      return;
    }

    const scrim = document.getElementById('agy-bg-scrim');
    const anchorAfter = scrim && scrim.parentNode === shell ? scrim.nextSibling : shell.firstChild;
    if (!vignette || vignette.parentNode !== shell) {
      if (vignette) vignette.remove();
      vignette = document.createElement('span');
      vignette.id = 'agy-focus-vignette';
      vignette.setAttribute('aria-hidden', 'true');
      if (anchorAfter && anchorAfter.parentNode === shell) {
        shell.insertBefore(vignette, anchorAfter);
      } else {
        shell.insertBefore(vignette, shell.firstChild);
      }
    }
  }

  function syncVideoWallpaper(cfg) {
    window.__AGY_VIDEO_WP_CFG__ = cfg || null;
    const shell = document.querySelector('.agy-shell');
    if (!cfg || !cfg.enabled || !cfg.wpUrl || !isVideoMediaUrl(cfg.wpUrl)) {
      cleanupVideoWallpaper();
      return;
    }
    if (!shell) return;

    const blobSrc = getVideoBlobUrl(cfg.wpUrl);

    function ensureVideoEl(id, insertBeforeNode) {
      let el = document.getElementById(id);
      if (!el || el.parentNode !== shell) {
        if (el) el.remove();
        el = document.createElement('video');
        el.id = id;
        el.crossOrigin = 'anonymous';
        el.autoplay = false;
        el.loop = false;
        el.muted = true;
        el.playsInline = true;
        el.preload = 'auto';
        el.setAttribute('crossorigin', 'anonymous');
        el.setAttribute('muted', '');
        el.setAttribute('playsinline', '');
        el.setAttribute('aria-hidden', 'true');
        if (insertBeforeNode && insertBeforeNode.parentNode === shell) {
          shell.insertBefore(el, insertBeforeNode);
        } else {
          shell.insertBefore(el, shell.firstChild);
        }
      }
      el.style.objectPosition = cfg.bgPosition || 'center center';
      return el;
    }

    const vidA = ensureVideoEl('agy-bg-video', shell.firstChild);
    const vidB = ensureVideoEl('agy-bg-video-b', vidA.nextSibling);

    let scrim = document.getElementById('agy-bg-scrim');
    if (!scrim || scrim.parentNode !== shell) {
      if (scrim) scrim.remove();
      scrim = document.createElement('span');
      scrim.id = 'agy-bg-scrim';
      scrim.setAttribute('aria-hidden', 'true');
      if (vidB.nextSibling) shell.insertBefore(scrim, vidB.nextSibling);
      else shell.appendChild(scrim);
    }
    scrim.style.backgroundImage = cfg.scrimCss || 'none';

    const shouldPause = Boolean(cfg.reducedMotion || document.hidden);
    const safePlay = (el) => {
      if (!el) return;
      if (Boolean((window.__AGY_VIDEO_WP_CFG__ && window.__AGY_VIDEO_WP_CFG__.reducedMotion) || document.hidden)) return;
      el.muted = true;
      if (!el.paused) return;
      try {
        const pr = el.play();
        if (pr && typeof pr.catch === 'function') pr.catch(() => {});
      } catch (_) {}
    };

    const srcChanged = vidA.dataset.srcKey !== cfg.srcKey || vidB.dataset.srcKey !== cfg.srcKey;
    if (srcChanged) {
      if (window.__AGY_VIDEO_XFADE_TIMER__) {
        clearTimeout(window.__AGY_VIDEO_XFADE_TIMER__);
        window.__AGY_VIDEO_XFADE_TIMER__ = 0;
      }
      vidA.dataset.srcKey = cfg.srcKey;
      vidB.dataset.srcKey = cfg.srcKey;
      vidA.style.transition = 'none';
      vidB.style.transition = 'none';
      vidA.style.opacity = '1';
      vidB.style.opacity = '0';
      vidA.style.zIndex = '0';
      vidB.style.zIndex = '0';
      vidA.src = blobSrc;
      vidB.src = blobSrc;
      vidA.addEventListener('canplay', () => safePlay(vidA), { once: true });
      vidA.load();
      vidB.load();
      window.__AGY_VIDEO_LOOP_STATE__ = {
        active: 'A',
        fading: false,
        srcKey: cfg.srcKey
      };
    }

    if (!window.__AGY_VIDEO_LOOP_STATE__) {
      window.__AGY_VIDEO_LOOP_STATE__ = { active: 'A', fading: false, srcKey: cfg.srcKey };
      vidA.style.opacity = '1';
      vidB.style.opacity = '0';
    }

    const stLoop = window.__AGY_VIDEO_LOOP_STATE__;
    const activeVid = stLoop.active === 'A' ? vidA : vidB;
    const standbyVid = stLoop.active === 'A' ? vidB : vidA;

    if (shouldPause) {
      try { vidA.pause(); } catch (_) {}
      try { vidB.pause(); } catch (_) {}
      if (window.__AGY_VIDEO_XFADE_RAF__) {
        cancelAnimationFrame(window.__AGY_VIDEO_XFADE_RAF__);
        window.__AGY_VIDEO_XFADE_RAF__ = 0;
      }
    } else {
      safePlay(activeVid);
      if (!window.__AGY_VIDEO_XFADE_RAF__) {
        const monitorLoop = () => {
          window.__AGY_VIDEO_XFADE_RAF__ = 0;
          const liveCfg = window.__AGY_VIDEO_WP_CFG__;
          const curState = window.__AGY_VIDEO_LOOP_STATE__;
          const a = document.getElementById('agy-bg-video');
          const b = document.getElementById('agy-bg-video-b');
          if (!liveCfg || !liveCfg.enabled || liveCfg.reducedMotion || document.hidden || !curState || !a || !b) {
            return;
          }
          const cur = curState.active === 'A' ? a : b;
          const nxt = curState.active === 'A' ? b : a;
          const dur = cur.duration;

          if (!curState.fading && Number.isFinite(dur) && dur > 1.2) {
            // Smooth GPU crossfade over last 1.05s (clamped to 24% of short clips) so looping never jumps or stutters
            const fadeSec = Math.min(1.05, Math.max(0.45, dur * 0.24));
            const remaining = dur - cur.currentTime;
            if (remaining <= fadeSec + 0.06 || cur.ended) {
              curState.fading = true;
              const fadeMs = Math.round(fadeSec * 1000);
              try {
                if (nxt.currentTime > 0.05) nxt.currentTime = 0;
              } catch (_) {}
              nxt.style.transition = 'none';
              cur.style.transition = 'none';
              nxt.style.opacity = '0';
              cur.style.opacity = '1';
              // Place incoming video slightly above outgoing (both remain beneath scrim & UI layers)
              cur.style.setProperty('z-index', '0', 'important');
              nxt.style.setProperty('z-index', '0', 'important');
              if (nxt.parentNode === cur.parentNode && nxt.nextSibling !== cur.nextSibling) {
                const sc = document.getElementById('agy-bg-scrim');
                if (sc && sc.parentNode === cur.parentNode) {
                  cur.parentNode.insertBefore(nxt, sc);
                }
              }
              safePlay(nxt);
              requestAnimationFrame(() => {
                nxt.style.transition = `opacity ${fadeMs}ms linear`;
                nxt.style.opacity = '1';
              });
              if (window.__AGY_VIDEO_XFADE_TIMER__) clearTimeout(window.__AGY_VIDEO_XFADE_TIMER__);
              window.__AGY_VIDEO_XFADE_TIMER__ = setTimeout(() => {
                window.__AGY_VIDEO_XFADE_TIMER__ = 0;
                cur.style.transition = 'none';
                cur.style.opacity = '0';
                try {
                  cur.pause();
                  cur.currentTime = 0;
                } catch (_) {}
                curState.active = curState.active === 'A' ? 'B' : 'A';
                curState.fading = false;
              }, fadeMs + 60);
            }
          } else if (cur.ended && !curState.fading) {
            try { cur.currentTime = 0; } catch (_) {}
            safePlay(cur);
          }
          window.__AGY_VIDEO_XFADE_RAF__ = requestAnimationFrame(monitorLoop);
        };
        window.__AGY_VIDEO_XFADE_RAF__ = requestAnimationFrame(monitorLoop);
      }
    }

    if (cfg.useUnifiedGlass) {
      const glassKey = `${cfg.srcKey}|${cfg.overlayRgb}|${cfg.overlayAlpha.toFixed(3)}|${cfg.tintBg}|${cfg.blurStr}`;
      window.__AGY_BLUR_CACHE__ = window.__AGY_BLUR_CACHE__ || {};
      const cached = window.__AGY_BLUR_CACHE__[glassKey];
      if (cached) {
        window.__AGY_LAST_GLASS__ = { key: glassKey, url: cached };
        shell.style.setProperty('--agy-l-glass-bg', 'url("' + cached + '")');
      } else {
        window.__AGY_LAST_GLASS__ = { key: glassKey, url: null };
        const doBake = () => {
          if (activeVid.videoWidth > 0 && activeVid.videoHeight > 0) {
            bakeGlassFromSource(activeVid, activeVid.videoWidth, activeVid.videoHeight, glassKey, cfg.overlayRgb, cfg.overlayAlpha, cfg.tintBg, cfg.blurStr);
          }
        };
        if (activeVid.readyState >= 2) doBake();
        else activeVid.addEventListener('loadeddata', doBake, { once: true });
      }
    }
  }

  // Downscale custom wallpaper uploads to max 2560px WebP (preserving animated GIFs & MP4/WebM untouched)
  function compressWallpaperFile(file, callback) {
    const reader = new FileReader();
    reader.onload = () => {
      const rawUrl = String(reader.result || '');
      if (file && (/gif|video/i.test(file.type || '') || /\.(gif|mp4|webm)$/i.test(file.name || ''))) {
        callback(rawUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 2560;
          const natW = img.naturalWidth || 1920;
          const natH = img.naturalHeight || 1080;
          const longest = Math.max(natW, natH);
          const scale = longest > maxDim ? maxDim / longest : 1;
          const w = Math.max(1, Math.round(natW * scale));
          const h = Math.max(1, Math.round(natH * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            callback(rawUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          const out = canvas.toDataURL('image/webp', 0.86);
          if (out && out.startsWith('data:image/webp') && (scale < 1 || out.length < rawUrl.length)) {
            callback(out);
          } else {
            callback(rawUrl);
          }
        } catch (e) {
          callback(rawUrl);
        }
      };
      img.onerror = () => callback(rawUrl);
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  }

  // Downscale user/agent avatar uploads to 192x192 WebP once so theme_config.json stays tiny
  function compressAvatarFile(file, callback) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const size = 192;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          const natW = img.naturalWidth || size;
          const natH = img.naturalHeight || size;
          const side = Math.min(natW, natH);
          const sx = Math.max(0, Math.floor((natW - side) / 2));
          const sy = Math.max(0, Math.floor((natH - side) / 2));
          ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
          const out = canvas.toDataURL('image/webp', 0.88);
          callback(out && out.startsWith('data:image/webp') ? out : canvas.toDataURL('image/png'));
        } catch (e) {
          callback(String(reader.result || ''));
        }
      };
      img.onerror = () => callback(String(reader.result || ''));
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  }

  // Pre-bake L-shaped header/sidebar glass blur once per theme/dimming change to avoid per-frame GPU backdrop readback
  function syncPrebakedGlass(wpUrl, overlayRgb, overlayAlpha, tintBg, blurStr) {
    const shell = document.querySelector('.agy-shell');
    if (!wpUrl) {
      window.__AGY_LAST_GLASS__ = null;
      if (shell) shell.style.removeProperty('--agy-l-glass-bg');
      return;
    }
    const key = `${wpUrl.slice(0, 64)}|${wpUrl.length}|${overlayRgb}|${overlayAlpha.toFixed(3)}|${tintBg}|${blurStr}`;
    window.__AGY_BLUR_CACHE__ = window.__AGY_BLUR_CACHE__ || {};
    const cached = window.__AGY_BLUR_CACHE__[key];
    if (cached) {
      window.__AGY_LAST_GLASS__ = { key, url: cached };
      if (shell) shell.style.setProperty('--agy-l-glass-bg', 'url("' + cached + '")');
      return;
    }
    window.__AGY_LAST_GLASS__ = { key, url: null };
    const img = new Image();
    img.onload = () => {
      try {
        const w = 640;
        const h = Math.max(180, Math.round((img.naturalHeight || 1440) * (w / (img.naturalWidth || 2560))));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const pxMatch = String(blurStr !== undefined ? blurStr : '3px').match(/(\d+(?:\.\d+)?)/);
        const scaledBlur = Math.max(0, Math.min(16, Math.round((pxMatch ? parseFloat(pxMatch[1]) : 3) * 0.75)));
        ctx.filter = scaledBlur > 0 ? `blur(${scaledBlur}px)` : 'none';
        ctx.drawImage(img, -12, -12, w + 24, h + 24);
        ctx.filter = 'none';
        ctx.fillStyle = `rgba(${overlayRgb}, ${overlayAlpha})`;
        ctx.fillRect(0, 0, w, h);
        if (tintBg) {
          ctx.fillStyle = tintBg;
          ctx.fillRect(0, 0, w, h);
        }
        const baked = canvas.toDataURL('image/webp', 0.85);
        window.__AGY_BLUR_CACHE__[key] = baked;
        if (window.__AGY_LAST_GLASS__ && window.__AGY_LAST_GLASS__.key === key) {
          window.__AGY_LAST_GLASS__.url = baked;
          const curShell = document.querySelector('.agy-shell');
          if (curShell) curShell.style.setProperty('--agy-l-glass-bg', 'url("' + baked + '")');
        }
      } catch (e) {}
    };
    img.src = wpUrl;
  }

  function applyTheme(overrides = {}) {
    const st = { ...getState(), ...overrides };
    try {
      localStorage.setItem(STORAGE_THEME, st.themeName);
      localStorage.setItem(STORAGE_BUBBLE, st.bubbleName);
      localStorage.setItem(STORAGE_INPUT, st.inputStyle);
      localStorage.setItem(STORAGE_DIMMING, String(st.dimming));
      localStorage.setItem(STORAGE_WP_ENABLED, String(st.wpEnabled));
      if (overrides.customWp !== undefined) {
        localStorage.setItem(STORAGE_CUSTOM_WP, overrides.customWp);
      }
      if (overrides.userAvatar !== undefined) {
        localStorage.setItem(STORAGE_USER_AVATAR, overrides.userAvatar);
      }
      if (overrides.agentAvatar !== undefined) {
        localStorage.setItem(STORAGE_AGENT_AVATAR, overrides.agentAvatar);
      }
      if (overrides.glassBlur !== undefined) {
        localStorage.setItem(STORAGE_GLASS_BLUR, String(overrides.glassBlur));
      }
      if (overrides.avatarSize !== undefined) {
        localStorage.setItem(STORAGE_AVATAR_SIZE, String(overrides.avatarSize));
      }
      if (overrides.avatarRadius !== undefined) {
        localStorage.setItem(STORAGE_AVATAR_RADIUS, String(overrides.avatarRadius));
      }
      if (overrides.workspaceMode !== undefined) {
        localStorage.setItem(STORAGE_MODE, String(overrides.workspaceMode));
      }
      if (overrides.chatOpacity !== undefined) {
        localStorage.setItem(STORAGE_CHAT_OPACITY, String(overrides.chatOpacity));
      }
      if (overrides.accentOverride !== undefined) {
        localStorage.setItem(STORAGE_ACCENT, String(overrides.accentOverride));
      }
      if (overrides.reducedMotion !== undefined) {
        localStorage.setItem(STORAGE_REDUCED_MOTION, String(Boolean(overrides.reducedMotion)));
      }
      if (overrides.zenMode !== undefined) {
        localStorage.setItem(STORAGE_ZEN, String(Boolean(overrides.zenMode)));
      }
      if (overrides.focusVignette !== undefined) {
        localStorage.setItem(STORAGE_FOCUS_VIGNETTE, String(Boolean(overrides.focusVignette)));
      }
    } catch (e) {}

    if (window.agySaveThemeConfig) {
      try {
        window.agySaveThemeConfig(JSON.stringify(st));
      } catch (e) {}
    }

    const mainTheme = THEMES[st.themeName] || THEMES[DEFAULT_THEME_KEY];
    const bubbleTheme = THEMES[st.bubbleName] || mainTheme;
    const wpUrl = st.customWp || mainTheme.wallpaper || '';

    const accentCfg = ACCENT_PRESETS[st.accentOverride] || ACCENT_PRESETS[''];
    const effPrimary = accentCfg.primary || mainTheme.primary;
    const effGlow = accentCfg.glow || mainTheme.glow;
    const modeCfg = MODE_PRESETS[st.workspaceMode] || MODE_PRESETS.balanced;
    const effDimming = st.zenMode ? Math.max(st.dimming, 80) : st.dimming;
    const isReducedMotion = Boolean(st.reducedMotion) || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    const oldLegacy = document.getElementById('antigravity-ho-ly-chibi-theme');
    if (oldLegacy) oldLegacy.remove();

    const styleRoot = document.head || document.documentElement;
    if (!styleRoot) return;
    let styleEl = document.getElementById('antigravity-custom-theme-active');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'antigravity-custom-theme-active';
      styleRoot.appendChild(styleEl);
    }

    const overlayAlpha = mainTheme.clearBackdrop
      ? Math.min(0.88, Math.max(0.0, ((effDimming - 10) / 82) * 0.72))
      : Math.min(0.92, Math.max(0.12, (effDimming / 100) * 0.78));
    const overlayRgb = mainTheme.overlayRgb || '10, 7, 6';
    const vignetteRgb = mainTheme.focusVignetteRgb || overlayRgb;
    const bgPosition = mainTheme.bgPosition || 'center center';
    const secondaryGlowStop = mainTheme.secondaryGlow
      ? `, radial-gradient(circle at 22% 72%, ${mainTheme.secondaryGlow} 0%, transparent 55%)`
      : '';

    const isVideoWp = isVideoMediaUrl(wpUrl);
    let bgLayers = '';
    let videoScrimCss = '';
    if (wpUrl) {
      if (mainTheme.clearBackdrop) {
        const centerAlpha = Math.min(0.92, overlayAlpha + (mainTheme.isLight ? 0 : 0.08));
        const edgeAlpha = Math.max(0.06, overlayAlpha - (mainTheme.isLight ? 0 : 0.08));
        videoScrimCss = mainTheme.isLight
          ? `linear-gradient(180deg, rgba(${overlayRgb}, ${overlayAlpha}) 0%, rgba(${overlayRgb}, ${overlayAlpha}) 100%)`
          : `radial-gradient(ellipse 76% 72% at 52% 48%, rgba(${overlayRgb}, ${centerAlpha.toFixed(3)}) 0%, rgba(${overlayRgb}, ${edgeAlpha.toFixed(3)}) 100%)`;
        bgLayers = isVideoWp ? videoScrimCss : `${videoScrimCss}, url("${wpUrl}")`;
      } else {
        videoScrimCss = `radial-gradient(circle at 75% 40%, ${effGlow} 0%, transparent 65%)${secondaryGlowStop}, linear-gradient(180deg, rgba(${overlayRgb}, ${overlayAlpha * 0.85}) 0%, rgba(${overlayRgb}, ${overlayAlpha}) 100%)`;
        bgLayers = isVideoWp ? videoScrimCss : `${videoScrimCss}, url("${wpUrl}")`;
      }
    } else {
      bgLayers = mainTheme.pureBg || `radial-gradient(circle at 75% 30%, ${effGlow} 0%, transparent 60%), linear-gradient(160deg, rgba(${overlayRgb}, 0.96) 0%, #070910 100%)`;
    }

    const vignetteTransition = isReducedMotion ? 'none' : 'opacity 300ms cubic-bezier(0.22, 1, 0.36, 1)';
    const wpCss = st.wpEnabled ? `
      .agy-shell {
        background-image: ${bgLayers} !important;
        background-size: cover !important;
        background-position: ${bgPosition} !important;
        background-repeat: no-repeat !important;
        image-rendering: auto !important;
      }
      #agy-bg-video,
      #agy-bg-video-b,
      #agy-bg-scrim,
      #agy-focus-vignette {
        display: block !important;
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        z-index: 0 !important;
        pointer-events: none !important;
        clip-path: var(--agy-hole-clip, none) !important;
      }
      #agy-focus-vignette {
        opacity: 0;
        background-image:
          radial-gradient(ellipse 70% 82% at 54% 48%, rgba(${vignetteRgb}, 0.56) 0%, rgba(${vignetteRgb}, 0.34) 46%, rgba(${vignetteRgb}, 0.08) 78%, transparent 100%),
          linear-gradient(180deg, rgba(${vignetteRgb}, 0.14) 0%, rgba(${vignetteRgb}, 0.22) 100%);
        transition: ${vignetteTransition};
        will-change: opacity;
      }
      .agy-shell[data-agy-focus-vignette="off"] #agy-focus-vignette {
        opacity: 0 !important;
      }
      .agy-shell[data-agy-focus-vignette="on"][data-agy-context="welcome"] #agy-focus-vignette {
        opacity: 0;
      }
      .agy-shell[data-agy-focus-vignette="on"][data-agy-context="welcome"][data-agy-mode="focus"] #agy-focus-vignette {
        opacity: 0.38;
      }
      .agy-shell[data-agy-focus-vignette="on"][data-agy-context="conversation"] #agy-focus-vignette {
        opacity: 0.86;
      }
      .agy-shell[data-agy-focus-vignette="on"][data-agy-context="conversation"][data-agy-mode="immersive"] #agy-focus-vignette {
        opacity: 0.34;
      }
      .agy-shell[data-agy-focus-vignette="on"][data-agy-context="conversation"][data-agy-mode="focus"] #agy-focus-vignette {
        opacity: 1;
      }
      .agy-shell[data-agy-focus-vignette="on"][data-agy-context="technical"] #agy-focus-vignette {
        background-image:
          radial-gradient(ellipse 85% 88% at 56% 52%, rgba(${vignetteRgb}, 0.74) 0%, rgba(${vignetteRgb}, 0.52) 60%, rgba(${vignetteRgb}, 0.28) 100%);
        opacity: 1;
      }
      .agy-shell[data-agy-focus-vignette="on"][data-agy-context="technical"][data-agy-mode="immersive"] #agy-focus-vignette {
        opacity: 0.72;
      }
      #agy-bg-video,
      #agy-bg-video-b {
        object-fit: cover !important;
        object-position: ${bgPosition} !important;
        will-change: opacity;
      }
      /* Keep transparent scrollers on GPU composited-scrolling layers */
      .agy-shell .overflow-y-auto {
        will-change: scroll-position;
      }
      .agy-sheet,
      .agy-inset-shell,
      .browser-hole-opaque,
      [data-main-content-body="true"],
      [data-side-panel-body="true"],
      [class*="agy-inset-shell"],
      [class*="--shell-canvas"],
      .agy-shell div.absolute.bottom-0.pointer-events-none,
      .agy-shell [class*="z-50"] .pointer-events-none.right-full,
      .agy-shell .bg-background:not(.settings-modal-container):not(.settings-modal-container *):not(#agy-custom-theme-modal-backdrop *) {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
      }
      /* Browser split-pane hole cutout: keep wallpaper & L-glass visible outside [data-browser-hole] without covering live BrowserView */
      ${isVideoWp ? '' : `
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"]::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background-image: ${bgLayers};
        background-size: cover;
        background-position: ${bgPosition};
        background-repeat: no-repeat;
        clip-path: var(--agy-hole-clip, none);
        will-change: transform;
      }
      `}
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] > :not([data-has-browser-hole="true"]):not([data-browser-hole]:not([data-browser-hole="false"])):not(.settings-modal-container),
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] .browser-hole-opaque:not([data-has-browser-hole="true"]),
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] [data-pane-id]:not([data-has-browser-hole="true"]),
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] [data-tiling-pane]:not([data-has-browser-hole="true"]),
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] [data-main-content-header]:not([data-has-browser-hole="true"]),
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] [data-side-panel-strip]:not([data-has-browser-hole="true"]) {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
      }
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] :is([data-main-content-body], [data-side-panel-body]):not([data-has-browser-hole="true"]) {
        box-shadow: none !important;
      }
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] [data-split-sash] {
        background: ${mainTheme.borderColor || 'rgba(56, 189, 248, 0.14)'} !important;
        background-image: none !important;
      }
    ` : `
      .agy-shell {
        background: #111113 !important;
      }
    `;

    const defaultCornerSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Cpath d='M2 20 L2 6 Q2 2 6 2 L20 2' stroke='%23fbbf24' stroke-width='1.5' fill='none' opacity='0.65'/%3E%3Ccircle cx='6' cy='6' r='2' fill='%23fbbf24' opacity='0.75'/%3E%3C/svg%3E";
    const cornerFiligreeUrl = bubbleTheme.cornerSvg || defaultCornerSvg;

    const useLivingComposerMascot = Boolean(bubbleTheme.composerOnlyMascot && bubbleTheme.sticker && st.inputStyle !== 'minimal');

    const bubbleStickerCss = (bubbleTheme.sticker && !bubbleTheme.composerOnlyMascot) ? (bubbleTheme.isOrnament ? `
      .group\\/user-input-step {
        padding-top: 18px !important;
      }
      .agy-user-bubble-frame::before {
        content: "";
        position: absolute;
        top: ${bubbleTheme.stickerTop}px;
        right: ${bubbleTheme.stickerRight}px;
        width: ${bubbleTheme.stickerW}px;
        height: ${bubbleTheme.stickerH}px;
        background-image: url("${bubbleTheme.sticker}");
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        z-index: 25;
        pointer-events: none;
        transition: transform 0.2s ease;
      }
    ` : `
      .group\\/user-input-step {
        padding-top: ${Math.max(36, Math.abs(bubbleTheme.stickerTop) + 8)}px !important;
      }
      .agy-user-bubble-frame::before {
        content: "";
        position: absolute;
        top: ${bubbleTheme.stickerTop}px;
        right: ${bubbleTheme.stickerRight}px;
        width: ${bubbleTheme.stickerW}px;
        height: ${bubbleTheme.stickerH}px;
        background-image: url("${bubbleTheme.sticker}");
        background-size: contain;
        background-position: bottom center;
        background-repeat: no-repeat;
        z-index: 25;
        pointer-events: none;
        transition: transform 0.2s ease;
      }
    `) : `
      .agy-user-bubble-frame::before { display: none !important; }
    `;

    const showInputSticker = st.inputStyle !== 'minimal' && bubbleTheme.sticker && !useLivingComposerMascot;
    const mascotTop = bubbleTheme.stickerTop || -58;
    const mascotW = bubbleTheme.stickerW || 74;
    const mascotH = bubbleTheme.stickerH || 70;
    const ledgeOverlap = Math.max(0, mascotH + mascotTop);
    const inputStickerCss = useLivingComposerMascot ? `
      .surface-composer {
        margin-top: 40px !important;
        overflow: visible !important;
      }
      .surface-composer::before,
      .surface-composer::after { display: none !important; }
      #agy-living-mascot {
        position: absolute;
        top: ${mascotTop}px;
        left: 0;
        width: ${mascotW}px;
        height: ${mascotH}px;
        z-index: 35;
        cursor: grab;
        user-select: none;
        touch-action: none;
        will-change: transform;
        transform: translate3d(var(--agy-mx, 0px), 0px, 0px);
      }
      #agy-living-mascot[data-dragging="1"] {
        cursor: grabbing;
      }
      #agy-living-mascot[data-phase="ducking"],
      #agy-living-mascot[data-phase="scurry"],
      #agy-living-mascot[data-phase="peeking"] {
        clip-path: inset(-40px -24px ${ledgeOverlap}px -24px);
        pointer-events: none;
      }
      #agy-living-mascot[data-phase="ducking"] .agy-mascot-bubble,
      #agy-living-mascot[data-phase="scurry"] .agy-mascot-bubble {
        opacity: 0 !important;
      }
      #agy-living-mascot .agy-mascot-stage {
        width: 100%;
        height: 100%;
        transform-origin: 50% 86%;
        will-change: transform, opacity;
        transform: translate3d(0, 0, 0);
        opacity: 1;
        transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease;
      }
      #agy-living-mascot[data-phase="ducking"] .agy-mascot-stage {
        transition: transform 250ms cubic-bezier(0.55, 0, 1, 0.45), opacity 180ms ease;
        transform: translate3d(0, 64px, 0) scale(0.95, 0.94);
      }
      #agy-living-mascot[data-phase="scurry"] .agy-mascot-stage {
        transition: none;
        transform: translate3d(0, 66px, 0) scale(0.94, 0.94);
        opacity: 0;
      }
      #agy-living-mascot[data-phase="peeking"] .agy-mascot-stage {
        transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 120ms ease;
        transform: translate3d(0, 24px, 0) scale(0.99, 1.01);
        opacity: 1;
      }
      #agy-living-mascot .agy-mascot-sprite {
        width: 100%;
        height: 100%;
        background-image: url("${safeCssUrl(bubbleTheme.sticker)}");
        background-size: contain;
        background-position: bottom center;
        background-repeat: no-repeat;
        filter: drop-shadow(0 5px 12px rgba(10, 6, 16, 0.55));
        transform-origin: 50% 86%;
        transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), filter 200ms ease;
        ${isReducedMotion ? '' : 'animation: agyMascotBreathe 4.4s ease-in-out infinite;'}
      }
      #agy-living-mascot:hover .agy-mascot-sprite {
        transform: scale(1.03, 0.985);
        filter: drop-shadow(0 6px 14px ${effGlow});
      }
      #agy-living-mascot[data-dragging="1"] .agy-mascot-sprite {
        animation: none !important;
        transform: scale(1.035, 0.975) rotate(var(--agy-tilt, 0deg));
        filter: drop-shadow(0 8px 16px ${effGlow});
      }
      #agy-living-mascot[data-state="listening"] .agy-mascot-sprite {
        ${isReducedMotion ? '' : 'animation: agyMascotListen 1.8s ease-in-out infinite;'}
        filter: drop-shadow(0 5px 14px ${effGlow});
      }
      #agy-living-mascot[data-state="thinking"] .agy-mascot-sprite {
        ${isReducedMotion ? '' : 'animation: agyMascotThink 2.0s ease-in-out infinite;'}
        filter: drop-shadow(0 4px 14px ${effGlow});
      }
      #agy-living-mascot[data-state="popup"] .agy-mascot-sprite {
        ${isReducedMotion ? '' : 'animation: agyMascotPopUp 380ms cubic-bezier(0.34, 1.56, 0.64, 1);'}
      }
      #agy-living-mascot[data-state="success"] .agy-mascot-sprite,
      #agy-living-mascot[data-state="happy"] .agy-mascot-sprite {
        ${isReducedMotion ? '' : 'animation: agyMascotJoy 560ms cubic-bezier(0.34, 1.56, 0.64, 1);'}
        filter: drop-shadow(0 6px 16px ${effGlow});
      }
      #agy-living-mascot .agy-mascot-bubble {
        position: absolute;
        top: -12px;
        left: 50%;
        transform: translateX(-50%) translateY(4px) scale(0.85);
        padding: 1px 7px;
        border-radius: 9999px;
        font-size: 10px;
        line-height: 15px;
        letter-spacing: 0.4px;
        font-weight: 700;
        white-space: nowrap;
        color: #F9EAF3;
        background: rgba(32, 21, 37, 0.94);
        border: 1px solid ${effPrimary};
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.42);
        pointer-events: none;
        opacity: 0;
        transition: opacity 180ms ease, transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      #agy-living-mascot .agy-mascot-bubble[data-show="1"],
      #agy-living-mascot[data-state="thinking"] .agy-mascot-bubble {
        opacity: 1;
        transform: translateX(-50%) translateY(0px) scale(1);
      }
      .agy-sakura-petal {
        position: absolute;
        width: 10px;
        height: 8px;
        border-radius: 70% 30% 70% 30%;
        background: radial-gradient(circle at 30% 30%, #ffffff 0%, #fbcfe8 55%, ${effPrimary} 100%);
        pointer-events: none;
        z-index: 36;
        opacity: 0;
        animation: agyPetalFloat 1.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      @keyframes agyMascotBreathe {
        0%, 100% { transform: scale(1, 1); }
        50% { transform: scale(1.022, 0.975); }
      }
      @keyframes agyMascotListen {
        0%, 100% { transform: rotate(-1.8deg); }
        50% { transform: rotate(1.8deg); }
      }
      @keyframes agyMascotThink {
        0%, 100% { transform: rotate(-2.8deg) scale(1.01, 0.99); }
        50% { transform: rotate(2.8deg) scale(0.99, 1.01); }
      }
      @keyframes agyMascotPopUp {
        0% { transform: translateY(18px) scale(0.96, 1.04); }
        55% { transform: translateY(-2px) scale(0.97, 1.05); }
        80% { transform: translateY(0) scale(1.03, 0.96); }
        100% { transform: translateY(0) scale(1, 1); }
      }
      @keyframes agyMascotJoy {
        0% { transform: scale(1, 1); }
        25% { transform: scale(1.07, 0.91); }
        58% { transform: translateY(-2px) scale(0.95, 1.07); }
        82% { transform: scale(1.02, 0.98); }
        100% { transform: scale(1, 1); }
      }
      @keyframes agyPetalFloat {
        0% { opacity: 0; transform: translate(0, 0) rotate(0deg) scale(0.6); }
        20% { opacity: 0.92; }
        100% { opacity: 0; transform: translate(var(--dx, -24px), var(--dy, -46px)) rotate(var(--rot, 140deg)) scale(1.05); }
      }
    ` : (showInputSticker ? (bubbleTheme.isOrnament ? `
      .surface-composer {
        margin-top: 16px !important;
        overflow: visible !important;
      }
      .surface-composer::before {
        content: "";
        position: absolute;
        top: ${bubbleTheme.stickerTop}px;
        right: 16px;
        width: ${bubbleTheme.stickerW + 8}px;
        height: ${bubbleTheme.stickerH + 2}px;
        background-image: url("${bubbleTheme.sticker}");
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        z-index: 30;
        pointer-events: none;
      }
      .surface-composer::after {
        content: "";
        position: absolute;
        bottom: 3px;
        left: 4px;
        width: 16px;
        height: 16px;
        background-image: url("${cornerFiligreeUrl}");
        background-size: contain;
        background-repeat: no-repeat;
        transform: rotate(180deg);
        z-index: 25;
        pointer-events: none;
        opacity: 0.78;
      }
    ` : `
      .surface-composer {
        margin-top: 28px !important;
        overflow: visible !important;
      }
      .surface-composer::before {
        content: "";
        position: absolute;
        top: ${bubbleTheme.stickerTop - 4}px;
        right: 16px;
        width: ${bubbleTheme.stickerW + 6}px;
        height: ${bubbleTheme.stickerH + 6}px;
        background-image: url("${bubbleTheme.sticker}");
        background-size: contain;
        background-position: bottom center;
        background-repeat: no-repeat;
        z-index: 30;
        pointer-events: none;
      }
      .surface-composer::after { display: none !important; }
    `) : `
      .surface-composer::before,
      .surface-composer::after { display: none !important; }
    `);

    const inputCardBg =
      st.inputStyle === 'glass'
        ? (bubbleTheme.inputGlassBg || 'rgba(20, 15, 13, 0.52)')
        : st.inputStyle === 'double_gold'
        ? 'linear-gradient(145deg, rgba(44, 28, 20, 0.90) 0%, rgba(24, 15, 12, 0.92) 100%)'
        : (bubbleTheme.inputCardBg || 'rgba(28, 19, 16, 0.88)');

    const inputOuterBorder =
      st.inputStyle === 'double_gold'
        ? 'linear-gradient(135deg, #f59e0b 0%, rgba(217, 119, 6, 0.35) 50%, #fbbf24 100%)'
        : bubbleTheme.frameBg;

    const rawSidebarBg = mainTheme.sidebarBg || 'rgba(14, 10, 8, 0.68)';
    const effSidebarAlpha = st.workspaceMode === 'focus'
      ? Math.max(0.86, parseFloat((rawSidebarBg.match(/,\s*([\d.]+)\s*\)/) || [])[1] || '0.72'))
      : st.workspaceMode === 'immersive'
      ? Math.min(0.45, parseFloat((rawSidebarBg.match(/,\s*([\d.]+)\s*\)/) || [])[1] || '0.45'))
      : parseFloat((rawSidebarBg.match(/,\s*([\d.]+)\s*\)/) || [])[1] || '0.72');
    const sidebarBg = withRgbaAlpha(rawSidebarBg, effSidebarAlpha);
    const effHeaderBg = mainTheme.headerBg ? withRgbaAlpha(mainTheme.headerBg, effSidebarAlpha) : '';
    const rawAiCardBg = mainTheme.aiCardBg || '';
    const targetCardAlpha = st.chatOpacity >= 70 && st.chatOpacity <= 98
      ? (st.chatOpacity / 100)
      : (st.workspaceMode === 'focus' ? 0.96 : st.workspaceMode === 'immersive' ? 0.82 : parseFloat((rawAiCardBg.match(/,\s*([\d.]+)\s*\)/) || [])[1] || String(modeCfg.defaultCardAlpha)));
    const effAiCardBg = rawAiCardBg ? withRgbaAlpha(rawAiCardBg, targetCardAlpha) : '';
    const sidebarHoverBg = mainTheme.sidebarHoverBg || 'rgba(255, 255, 255, 0.08)';
    const sidebarActiveBg = mainTheme.sidebarActiveBg || sidebarHoverBg;
    const btnBg = mainTheme.btnBg || 'rgba(48, 30, 22, 0.62)';
    const modalBg = mainTheme.modalBg || 'rgba(14, 12, 12, 0.96)';
    const innerBubbleBorder = bubbleTheme.isScroll
      ? '2px solid #78350f'
      : (bubbleTheme.innerBorder || '1px solid rgba(255, 255, 255, 0.06)');

    const isLight = Boolean(mainTheme.isLight);
    const uiInk = mainTheme.uiTextColor || (isLight ? '#0f172a' : 'rgba(248, 250, 252, 0.96)');
    const uiSecondaryInk = mainTheme.uiSecondaryColor || (isLight ? '#334155' : '#C4B6C8');
    const uiMutedInk = mainTheme.uiMutedColor || (isLight ? '#334155' : 'rgba(241, 245, 249, 0.92)');
    const uiShadow = isLight ? 'none' : '0 1px 4px rgba(0, 0, 0, 0.92), 0 0 8px rgba(0, 0, 0, 0.68)';
    const pillBg = mainTheme.pillBg || (isLight ? 'rgba(255, 255, 255, 0.78)' : 'rgba(6, 11, 24, 0.78)');
    const pillHoverBg = mainTheme.pillHoverBg || (isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(10, 18, 38, 0.92)');
    const pillText = mainTheme.pillTextColor || (isLight ? '#0f172a' : '#f8fafc');
    const pillBorder = mainTheme.pillBorder || (isLight ? 'rgba(15, 23, 42, 0.16)' : 'rgba(255, 255, 255, 0.16)');
    const preCodeBg = isLight ? `rgba(${overlayRgb}, 0.72)` : (mainTheme.codeBg || `rgba(${overlayRgb}, 0.56)`);

    const tokBg = mainTheme.overlayRgb ? `rgb(${mainTheme.overlayRgb})` : '#100D17';
    const tokSurface = mainTheme.surfaceBg || '#201525';
    const tokSurfaceRaised = mainTheme.surfaceRaisedBg || '#2B1C30';
    const tokCode = mainTheme.codeBg || '#17111F';
    const tokCodeHeader = mainTheme.codeHeaderBg || 'rgba(32, 21, 37, 0.92)';
    const tokTerminal = mainTheme.terminalBg || '#120E1B';
    const tokTerminalFg = mainTheme.terminalFg || '#EAE2F0';
    const tokTerminalCursor = mainTheme.terminalCursor || effPrimary;
    const tokTerminalSel = mainTheme.terminalSelection || 'rgba(232, 139, 185, 0.28)';
    const tokSuccess = mainTheme.successColor || '#86D9B5';
    const tokWarning = mainTheme.warningColor || '#F2C879';
    const tokError = mainTheme.errorColor || '#F08D9D';
    const tokInfo = mainTheme.infoColor || '#91C6F5';
    const tokPopupBg = mainTheme.popupBg || modalBg;
    const tokPopupBorder = mainTheme.popupBorder || mainTheme.borderColor || 'rgba(232, 139, 185, 0.24)';
    const tokDiffAddedBg = mainTheme.diffAddedBg || 'rgba(134, 217, 181, 0.12)';
    const tokDiffAddedTextBg = mainTheme.diffAddedTextBg || 'rgba(134, 217, 181, 0.24)';
    const tokDiffRemovedBg = mainTheme.diffRemovedBg || 'rgba(240, 141, 157, 0.13)';
    const tokDiffRemovedTextBg = mainTheme.diffRemovedTextBg || 'rgba(240, 141, 157, 0.25)';
    const tokDiffModifiedBg = mainTheme.diffModifiedBg || 'rgba(242, 200, 121, 0.12)';

    const designTokensCss = `
      :root {
        --sakura-bg: ${tokBg};
        --sakura-surface: ${tokSurface};
        --sakura-surface-raised: ${tokSurfaceRaised};
        --sakura-code: ${tokCode};
        --sakura-terminal: ${tokTerminal};
        --sakura-terminal-fg: ${tokTerminalFg};
        --sakura-terminal-selection: ${tokTerminalSel};
        --sakura-accent: ${effPrimary};
        --sakura-accent-soft: ${effGlow};
        --sakura-text: ${uiInk};
        --sakura-text-secondary: ${uiSecondaryInk};
        --sakura-text-muted: ${uiMutedInk};
        --sakura-success: ${tokSuccess};
        --sakura-warning: ${tokWarning};
        --sakura-error: ${tokError};
        --sakura-info: ${tokInfo};
        --sakura-radius-sm: 8px;
        --sakura-radius-md: 12px;
        --sakura-radius-lg: 18px;
        --sakura-font-ui: "Inter", "Geist", system-ui, -apple-system, "Segoe UI", sans-serif;
        --sakura-font-mono: "JetBrains Mono", "Cascadia Code", "Fira Code", "Consolas", ui-monospace, SFMono-Regular, Menlo, monospace;
        --sakura-transition-fast: ${isReducedMotion ? '0ms' : '160ms ease'};
        --sakura-transition-base: ${isReducedMotion ? '0ms' : '280ms cubic-bezier(0.22, 1, 0.36, 1)'};
      }
      ${(!isLight && mainTheme.refinedSurfaceTokens) ? `
      :root {
        --rt-color-dark: ${tokSurface};
        --rt-color-white: ${uiInk};
        --rt-color-success: ${tokSuccess};
        --rt-color-warning: ${tokWarning};
        --rt-color-error: ${tokError};
        --rt-color-info: ${tokInfo};
      }
      body[data-agy-theme].dark,
      .agy-shell {
        --card: ${tokSurface};
        --color-card: ${tokSurface};
        --card-border: ${tokPopupBorder};
        --color-card-border: ${tokPopupBorder};
        --glass: ${tokPopupBg};
        --glass-border: ${tokPopupBorder};
        --glass-highlight: rgba(249, 234, 243, 0.06);
        --border: rgba(232, 139, 185, 0.14);
        --color-border: rgba(232, 139, 185, 0.14);
        --muted: rgba(43, 28, 48, 0.56);
        --color-muted: rgba(43, 28, 48, 0.56);
        --muted-foreground: ${uiMutedInk};
        --color-muted-foreground: ${uiMutedInk};
        --secondary: rgba(232, 139, 185, 0.12);
        --color-secondary: rgba(232, 139, 185, 0.12);
        --secondary-foreground: ${uiSecondaryInk};
        --color-secondary-foreground: ${uiSecondaryInk};
        --onyx-well: ${tokTerminal};
        --onyx-key: ${tokSurfaceRaised};
        --onyx-frame: rgba(23, 16, 30, 0.96);
        --onyx-raised: ${tokSurface};
        --onyx-selected: ${tokSurfaceRaised};
        --scrim: rgba(12, 9, 24, 0.68);
        --success: ${tokSuccess};
        --color-success: ${tokSuccess};
        --warning: ${tokWarning};
        --color-warning: ${tokWarning};
        --error: ${tokError};
        --color-error: ${tokError};
        --link: ${effPrimary};
        --color-link: ${effPrimary};
        --focus-ring-color: rgba(232, 139, 185, 0.45);
        --nux-focus-ring: rgba(232, 139, 185, 0.60);
        --focus-ring-offset-color: ${tokBg};
        --editor-font-family: var(--sakura-font-mono);
        --editor-line-number-foreground: ${uiMutedInk};
        --color-editorLineNumber-foreground: ${uiMutedInk};
        --editor-selection-background: ${tokTerminalSel};
        --color-selection-background: ${tokTerminalSel};
        --editor-diff-inserted-line-background: ${tokDiffAddedBg};
        --color-diffEditor-insertedLineBackground: ${tokDiffAddedBg};
        --editor-diff-inserted-text-background: ${tokDiffAddedTextBg};
        --color-diffEditor-insertedTextBackground: ${tokDiffAddedTextBg};
        --editor-diff-removed-line-background: ${tokDiffRemovedBg};
        --color-diffEditor-removedLineBackground: ${tokDiffRemovedBg};
        --editor-diff-removed-text-background: ${tokDiffRemovedTextBg};
        --color-diffEditor-removedTextBackground: ${tokDiffRemovedTextBg};
        --syntax-inserted: ${tokSuccess};
        --syntax-deleted: ${tokError};
      }
      ` : ''}
    `;

    const effectiveUserAvatar = st.userAvatar === 'none' ? '' : (st.userAvatar || mainTheme.userAvatar || '');
    const effectiveAgentAvatar = st.agentAvatar === 'none' ? '' : (st.agentAvatar || mainTheme.agentAvatar || '');
    const avSize = Math.min(52, Math.max(22, Number(st.avatarSize) || 32));
    const avAgentSize = Math.max(22, avSize - 2);
    const avRadius = Math.min(50, Math.max(0, Number.isFinite(Number(st.avatarRadius)) ? Number(st.avatarRadius) : 50));

    const avatarCss = `
      ${effectiveUserAvatar ? `
      .agy-shell [data-testid="user-message"] {
        position: relative !important;
        padding-right: ${avSize + 10}px !important;
      }
      .agy-shell [data-testid="user-message"]::after {
        content: "";
        position: absolute;
        right: 0;
        bottom: 6px;
        width: ${avSize}px;
        height: ${avSize}px;
        border-radius: ${avRadius}%;
        background-image: url("${effectiveUserAvatar}");
        background-size: cover;
        background-position: center;
        border: 1.5px solid ${mainTheme.primary};
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4), 0 0 8px ${mainTheme.glow};
        pointer-events: none;
      }
      ` : ''}
      ${effectiveAgentAvatar ? `
      .agy-shell [data-testid="agent-response"] {
        position: relative !important;
        padding-left: ${avAgentSize + 22}px !important;
        min-height: ${avAgentSize + 20}px !important;
      }
      .agy-shell [data-testid="agent-response"]::before {
        content: "";
        position: absolute;
        top: 12px;
        left: 12px;
        width: ${avAgentSize}px;
        height: ${avAgentSize}px;
        border-radius: ${avRadius}%;
        background-image: url("${effectiveAgentAvatar}");
        background-size: cover;
        background-position: center;
        border: 1.5px solid ${mainTheme.secondary || mainTheme.primary};
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4), 0 0 8px ${mainTheme.secondaryGlow || mainTheme.glow};
        pointer-events: none;
      }
      ` : ''}
    `;

    const sidebarEnhanceCss = (mainTheme.sidebarEnhanceText || isLight) ? `
      .agy-shell .bg-sidebar a,
      .agy-shell .bg-sidebar span,
      .agy-shell .bg-sidebar button {
        color: ${isLight ? uiInk : 'inherit'};
        text-shadow: ${isLight ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.88)'};
      }
      .agy-shell .bg-sidebar .text-muted-foreground,
      .agy-shell .bg-sidebar .text-secondary-foreground {
        color: ${uiMutedInk} !important;
      }
    ` : '';

    const aiCardCss = effAiCardBg ? `
      /* Translucent reading card for AI responses (zero live backdrop-filter for max 120fps scroll) */
      .agy-shell {
        font-family: var(--sakura-font-ui);
      }
      .agy-shell code,
      .agy-shell pre {
        font-family: var(--sakura-font-mono);
      }
      .agy-shell [data-testid="agent-response"] {
        background: ${effAiCardBg} !important;
        ${isLight ? `color: ${uiInk} !important;` : (mainTheme.uiTextColor ? `color: ${uiInk};` : '')}
        backdrop-filter: none !important;
        border: 1px solid ${mainTheme.aiCardBorder || (isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.1)')} !important;
        border-radius: 14px !important;
        padding: 24px 26px !important;
        box-shadow: ${isLight ? '0 4px 14px rgba(15, 23, 42, 0.08)' : '0 8px 26px rgba(6, 4, 12, 0.40)'} !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }
      @media (max-width: 767px) {
        .agy-shell [data-testid="agent-response"] {
          padding: 16px 18px !important;
        }
      }
      /* Scoped long-form conversation typography & spacing (preserves sidebar/buttons/inputs) */
      .agy-shell [data-testid="agent-response"] [data-markdown-root] {
        font-family: var(--sakura-font-ui);
        font-size: 14.5px;
        line-height: 1.68;
        letter-spacing: -0.004em;
        row-gap: 0px !important;
        ${isLight ? '' : `color: ${uiInk};`}
      }
      .agy-shell [data-testid="agent-response"] [data-markdown-root] > :first-child {
        margin-top: 0 !important;
      }
      .agy-shell [data-testid="agent-response"] [data-markdown-root] > :last-child {
        margin-bottom: 0 !important;
      }
      .agy-shell [data-testid="agent-response"] [data-markdown-root] p {
        margin-top: 0 !important;
        margin-bottom: 14px !important;
        line-height: 1.68;
      }
      .agy-shell [data-testid="agent-response"] [data-markdown-root] p:last-child {
        margin-bottom: 0 !important;
      }
      .agy-shell [data-testid="agent-response"] [data-markdown-root] h1 {
        font-size: 1.38em;
        font-weight: 700;
        letter-spacing: -0.022em;
        line-height: 1.3;
        margin-top: 26px !important;
        margin-bottom: 12px !important;
      }
      .agy-shell [data-testid="agent-response"] [data-markdown-root] h2 {
        font-size: 1.2em;
        font-weight: 650;
        letter-spacing: -0.018em;
        line-height: 1.35;
        margin-top: 24px !important;
        margin-bottom: 10px !important;
        padding-bottom: 6px;
        border-bottom: 1px solid ${isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(232, 139, 185, 0.15)'};
      }
      .agy-shell [data-testid="agent-response"] [data-markdown-root] h3 {
        font-size: 1.06em;
        font-weight: 620;
        letter-spacing: -0.01em;
        line-height: 1.4;
        margin-top: 20px !important;
        margin-bottom: 8px !important;
      }
      .agy-shell [data-testid="agent-response"] [data-markdown-root] h4 {
        font-size: 0.98em;
        font-weight: 600;
        line-height: 1.45;
        margin-top: 16px !important;
        margin-bottom: 6px !important;
        ${isLight ? '' : `color: ${uiSecondaryInk};`}
      }
      .agy-shell [data-testid="agent-response"] [data-markdown-root] :is(ul, ol) {
        margin-top: 6px !important;
        margin-bottom: 14px !important;
        padding-inline-start: 1.5em !important;
      }
      .agy-shell [data-testid="agent-response"] [data-markdown-root] li {
        margin-bottom: 6px !important;
        line-height: 1.66;
      }
      .agy-shell [data-testid="agent-response"] [data-markdown-root] li:last-child {
        margin-bottom: 0 !important;
      }
      .agy-shell [data-testid="agent-response"] [data-markdown-root] li > :is(ul, ol) {
        margin-top: 6px !important;
        margin-bottom: 4px !important;
      }
      .agy-shell [data-testid="agent-response"] [data-markdown-root] li::marker {
        color: ${effPrimary};
      }
      .agy-shell [data-testid="agent-response"] [data-markdown-root] blockquote {
        margin: 14px 0 !important;
        padding: 8px 14px !important;
        border-inline-start: 3px solid ${effPrimary};
        background: ${isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(43, 28, 48, 0.45)'};
        border-radius: 0 8px 8px 0;
        color: ${isLight ? uiMutedInk : uiSecondaryInk};
      }
      .agy-shell [data-testid="agent-response"] [data-markdown-root] hr {
        margin: 22px 0 !important;
        border-color: ${isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(232, 139, 185, 0.16)'};
      }
      .agy-shell [data-testid="agent-response"] [data-step-list="true"] {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .agy-shell [data-testid="agent-response"] :is([data-testid="worked-for-collapsible"], [data-testid="tool-group-collapsible"]) {
        font-size: 13px;
        color: ${isLight ? uiMutedInk : uiMutedInk};
        border-radius: var(--sakura-radius-sm);
        transition: background-color var(--sakura-transition-fast), color var(--sakura-transition-fast);
      }
      ${(!isLight && mainTheme.inlineCodeBg) ? `
      .agy-shell [data-testid="agent-response"] :not(pre) > code {
        background: ${mainTheme.inlineCodeBg} !important;
        color: ${mainTheme.inlineCodeColor || '#F9C6E0'} !important;
        border: 1px solid ${mainTheme.aiCardBorder || 'rgba(232, 139, 185, 0.22)'} !important;
        border-radius: 6px !important;
        padding: 1.5px 6px !important;
        font-size: 0.875em !important;
      }
      ` : ''}
      .agy-shell [data-testid="agent-response"] [data-markdown-root] a {
        color: ${effPrimary};
        text-underline-offset: 3px;
      }
      .agy-shell [data-testid="agent-response"] [data-markdown-root] a:focus-visible {
        outline: 2px solid ${effPrimary};
        outline-offset: 2px;
        border-radius: 3px;
      }
      .agy-shell [data-testid="agent-response"] .md-table-bleed,
      .agy-shell [data-testid="agent-response"] .md-table-host {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        margin-inline: 0 !important;
        margin-top: 16px !important;
        margin-bottom: 16px !important;
        left: auto !important;
        right: auto !important;
        transform: none !important;
        box-sizing: border-box !important;
      }
      .agy-shell [data-testid="agent-response"] .md-table-scroll,
      .agy-shell [data-testid="agent-response"] :has(> table):not(.md-table-frame) {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        padding-bottom: 2px !important;
        box-sizing: border-box !important;
        /* Keep standard scrollbar-width: auto so Chromium does not disable ::-webkit-scrollbar */
        scrollbar-width: auto !important;
        scrollbar-color: auto !important;
      }
      .agy-shell [data-testid="agent-response"] .md-table-frame {
        /* .md-table-frame sits INSIDE .md-table-scroll; forcing width:100% + overflow:hidden hid overflow from .md-table-scroll */
        width: fit-content !important;
        min-width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        transform: none !important;
        box-sizing: border-box !important;
        border-color: ${isLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(232, 139, 185, 0.18)'} !important;
        border-radius: var(--sakura-radius-md) !important;
      }
      .agy-shell [data-testid="agent-response"] :is(.md-math-display, .katex-display) {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        padding-bottom: 4px !important;
        box-sizing: border-box !important;
        scrollbar-width: auto !important;
        scrollbar-color: auto !important;
      }
      .agy-shell [data-testid="agent-response"] :not(.md-math-display):not(.katex-display) > .katex {
        display: inline-block !important;
        max-width: 100% !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        vertical-align: middle !important;
        box-sizing: border-box !important;
        scrollbar-width: auto !important;
        scrollbar-color: auto !important;
      }
      .agy-shell [data-testid="agent-response"] :is(.md-table-scroll, :has(> table):not(.md-table-frame), .md-math-display, .katex-display, :not(.md-math-display):not(.katex-display) > .katex)::-webkit-scrollbar {
        height: 8px !important;
        display: block !important;
      }
      .agy-shell [data-testid="agent-response"] :is(.md-table-scroll, :has(> table):not(.md-table-frame), .md-math-display, .katex-display, :not(.md-math-display):not(.katex-display) > .katex)::-webkit-scrollbar-track {
        background: ${isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.06)'} !important;
        border-radius: 9999px !important;
      }
      .agy-shell [data-testid="agent-response"] :is(.md-table-scroll, :has(> table):not(.md-table-frame), .md-math-display, .katex-display, :not(.md-math-display):not(.katex-display) > .katex)::-webkit-scrollbar-thumb {
        background: ${isLight ? 'rgba(15, 23, 42, 0.34)' : 'rgba(232, 139, 185, 0.38)'} !important;
        border-radius: 9999px !important;
      }
      .agy-shell [data-testid="agent-response"] :is(.md-table-scroll, :has(> table):not(.md-table-frame), .md-math-display, .katex-display, :not(.md-math-display):not(.katex-display) > .katex)::-webkit-scrollbar-thumb:hover {
        background: ${isLight ? 'rgba(15, 23, 42, 0.54)' : 'rgba(232, 139, 185, 0.58)'} !important;
      }
      .agy-shell [data-testid="agent-response"] table {
        width: 100% !important;
        min-width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        table-layout: auto !important;
        box-sizing: border-box !important;
      }
      .agy-shell [data-testid="agent-response"] :is(th, td) {
        max-width: none !important;
        white-space: normal !important;
        word-break: normal !important;
        overflow-wrap: break-word !important;
        padding: 9px 13px !important;
        border-color: ${isLight ? 'rgba(38, 28, 31, 0.14)' : 'rgba(232, 139, 185, 0.14)'} !important;
      }
      ${!isLight ? `
      .agy-shell [data-testid="agent-response"] thead th {
        background: rgba(43, 28, 48, 0.72) !important;
        color: ${uiInk};
        font-weight: 600;
      }
      ` : ''}
      .agy-shell [data-testid="agent-response"] :is(td, th) .inline-pill-wrap {
        min-width: 0 !important;
      }
      ${isLight ? `
      .agy-shell [data-main-content-body="true"],
      .agy-shell [data-testid="agent-response"] :is(p, li, span, code, h1, h2, h3, h4, strong, td, th, blockquote) {
        color: ${uiInk};
      }
      .agy-shell [data-testid="agent-response"] a {
        color: ${mainTheme.primary} !important;
      }
      .agy-shell [data-testid="agent-response"] :not(pre) > code {
        background: rgba(38, 28, 31, 0.08) !important;
        border: 1px solid rgba(38, 28, 31, 0.10) !important;
        border-radius: 5px !important;
        padding: 1px 5px !important;
      }
      .agy-shell [data-testid="agent-response"] pre {
        background: rgba(246, 241, 244, 0.92) !important;
        border: 1px solid ${mainTheme.aiCardBorder || 'rgba(15, 23, 42, 0.14)'} !important;
        border-radius: 10px !important;
      }
      .agy-shell [data-testid="agent-response"] :is(th, td) {
        border-color: rgba(38, 28, 31, 0.14) !important;
      }
      .agy-shell [data-testid="agent-response"] thead th {
        background: rgba(38, 28, 31, 0.05) !important;
      }
      .agy-shell [data-main-content-body="true"] button:not(.agy-user-bubble *),
      .agy-shell [data-main-content-body="true"] .text-muted-foreground,
      .agy-shell [data-main-content-body="true"] .text-secondary-foreground {
        color: ${uiMutedInk} !important;
      }
      .agy-shell .surface-composer-card,
      .agy-shell .surface-composer-card :is(button, [role="button"], textarea, [contenteditable="true"], [role="textbox"], svg) {
        color: ${uiInk} !important;
      }
      .agy-shell .surface-composer-card :is(button, [role="button"]):hover {
        background: rgba(38, 28, 31, 0.07) !important;
      }
      .agy-shell .surface-composer-card ::placeholder,
      .agy-shell .surface-composer-card .text-muted-foreground {
        color: ${uiMutedInk} !important;
      }
      .agy-shell .surface-opaque.bg-sidebar,
      .agy-shell .surface-opaque.border-menu-border,
      .agy-shell .surface-opaque.bg-sidebar :is(button, a, span, [role="menuitem"]),
      .agy-shell .surface-opaque.border-menu-border :is(button, a, span, [role="menuitem"]) {
        color: ${uiInk} !important;
      }
      ` : ''}
      .agy-shell [data-main-content-body="true"] h1,
      .agy-shell [data-main-content-body="true"] h2 {
        text-shadow: ${isLight ? 'none' : '0 2px 10px rgba(0, 0, 0, 0.85)'};
      }
    ` : '';

    const devComponentsCss = (!isLight && (mainTheme.codeBg || mainTheme.refinedSurfaceTokens)) ? `
      /* 3.1 Code Blocks (single clean plum card, crisp header, horizontal scroll for long lines) */
      .agy-shell [data-testid="agent-response"] pre:has(> div) {
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        margin: 16px 0 !important;
        border-radius: 0 !important;
      }
      .agy-shell [data-testid="agent-response"] pre > div {
        background: ${tokCode} !important;
        border: 1px solid rgba(232, 139, 185, 0.22) !important;
        border-radius: var(--sakura-radius-md) !important;
        overflow: hidden !important;
        margin: 0 !important;
        box-shadow: 0 4px 16px rgba(8, 5, 14, 0.42), inset 0 1px 0 rgba(249, 234, 243, 0.05) !important;
        transition: border-color var(--sakura-transition-fast) !important;
      }
      .agy-shell [data-testid="agent-response"] pre > div:hover,
      .agy-shell [data-testid="agent-response"] pre > div:focus-within {
        border-color: rgba(232, 139, 185, 0.38) !important;
      }
      .agy-shell [data-testid="agent-response"] pre > div > div:first-child:has(button) {
        background: ${tokCodeHeader} !important;
        border-bottom: 1px solid rgba(232, 139, 185, 0.14) !important;
        padding: 6px 14px !important;
        min-height: 34px !important;
      }
      .agy-shell [data-testid="agent-response"] pre > div > div:first-child:has(button) > div:first-child {
        font-family: var(--sakura-font-mono);
        font-size: 11.5px !important;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: ${uiMutedInk} !important;
      }
      .agy-shell [data-testid="agent-response"] pre > div > div:first-child button {
        padding: 4px 6px !important;
        border-radius: 6px !important;
        color: ${uiSecondaryInk} !important;
        transition: background-color var(--sakura-transition-fast), color var(--sakura-transition-fast) !important;
      }
      .agy-shell [data-testid="agent-response"] pre > div > div:first-child button:hover {
        background: rgba(232, 139, 185, 0.16) !important;
        color: ${uiInk} !important;
      }
      .agy-shell [data-testid="agent-response"] pre > div > div:first-child button:focus-visible {
        outline: 2px solid ${effPrimary} !important;
        outline-offset: 1px !important;
      }
      .agy-shell [data-testid="agent-response"] pre > div > div:last-child {
        padding: 16px !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        scrollbar-width: auto !important;
        scrollbar-color: auto !important;
      }
      .agy-shell [data-testid="agent-response"] pre > div > div:last-child::-webkit-scrollbar {
        height: 8px !important;
        display: block !important;
      }
      .agy-shell [data-testid="agent-response"] pre > div > div:last-child::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.04) !important;
        border-radius: 9999px !important;
      }
      .agy-shell [data-testid="agent-response"] pre > div > div:last-child::-webkit-scrollbar-thumb {
        background: rgba(232, 139, 185, 0.34) !important;
        border-radius: 9999px !important;
      }
      .agy-shell [data-testid="agent-response"] pre > div > div:last-child::-webkit-scrollbar-thumb:hover {
        background: rgba(232, 139, 185, 0.56) !important;
      }
      .agy-shell [data-testid="agent-response"] pre .code-block {
        width: max-content;
        min-width: 100%;
        font-family: var(--sakura-font-mono) !important;
        font-size: 13px !important;
        line-height: 1.62 !important;
      }
      .agy-shell [data-testid="agent-response"] pre .code-block .line-content {
        white-space: pre !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
      }
      .agy-shell [data-testid="agent-response"] pre:not(:has(> div)) {
        background: ${tokCode} !important;
        border: 1px solid rgba(232, 139, 185, 0.22) !important;
        border-radius: var(--sakura-radius-md) !important;
        padding: 16px !important;
        overflow-x: auto !important;
        margin: 16px 0 !important;
      }

      ${mainTheme.refinedSurfaceTokens ? `
      /* 3.2 Terminal */
      .agy-shell [data-testid="bottom-terminal-panel"],
      .agy-shell [data-testid="bottom-terminal-panel"] .xterm,
      .agy-shell [data-testid="bottom-terminal-panel"] .xterm-viewport,
      .agy-shell [data-testid="bottom-terminal-panel"] .xterm-screen,
      .agy-shell .xterm-viewport {
        background-color: ${tokTerminal} !important;
        color: ${tokTerminalFg};
        font-family: var(--sakura-font-mono);
      }
      .agy-shell [data-testid="bottom-terminal-panel"] {
        border-top: 1px solid rgba(232, 139, 185, 0.22) !important;
      }
      .agy-shell .xterm .xterm-selection div {
        background-color: ${tokTerminalSel} !important;
      }
      .agy-shell .xterm .xterm-cursor-layer .xterm-cursor-bar,
      .agy-shell .xterm .xterm-cursor-layer .xterm-cursor-block {
        background-color: ${tokTerminalCursor};
      }
      .agy-shell .xterm-viewport::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .agy-shell .xterm-viewport::-webkit-scrollbar-thumb {
        background: rgba(232, 139, 185, 0.28);
        border-radius: 9999px;
      }

      /* 3.3 Diff Review (restrained semantic green/coral/amber; never replaced by pink) */
      .agy-shell [data-side-panel-body="true"] .code-block,
      .agy-shell .monaco-diff-editor {
        background-color: ${tokCode};
        border-radius: var(--sakura-radius-sm);
      }
      .agy-shell .monaco-diff-editor .line-insert,
      .agy-shell .monaco-diff-editor .char-insert,
      .agy-shell [data-diff-line="added"] {
        background-color: ${tokDiffAddedBg};
      }
      .agy-shell .monaco-diff-editor .line-delete,
      .agy-shell .monaco-diff-editor .char-delete,
      .agy-shell [data-diff-line="removed"] {
        background-color: ${tokDiffRemovedBg};
      }
      .agy-shell [data-diff-line="modified"] {
        background-color: ${tokDiffModifiedBg};
      }

      /* 3.4 Shared Elevated Surface System for Popups, Menus, Command Palette, Dialogs & Tooltips */
      .agy-shell .surface-opaque,
      .agy-shell .surface-opaque.bg-sidebar,
      .agy-shell .surface-opaque.border-menu-border,
      .agy-shell .agy-fastpick.surface-glass,
      .agy-shell .quick-input-widget.surface-glass,
      .agy-shell .agy-dialog:not([class*="rounded-none"]),
      .agy-shell .compact-tooltip,
      .agy-shell .toast-root,
      [data-radix-popper-content-wrapper] > :is([role="menu"], [role="listbox"], [data-radix-menu-content]),
      [role="menu"],
      [role="listbox"],
      [role="dialog"]:not(#agy-custom-theme-modal-dialog),
      [role="alertdialog"],
      [role="tooltip"],
      .reactTooltipComponenttooltip.reactTooltipComponentdark {
        background: ${tokPopupBg} !important;
        background-color: ${tokPopupBg} !important;
        color: ${uiInk} !important;
        border: 1px solid ${tokPopupBorder} !important;
        border-radius: var(--sakura-radius-md) !important;
        box-shadow: 0 16px 42px rgba(6, 4, 12, 0.72), inset 0 1px 0 rgba(249, 234, 243, 0.06) !important;
        backdrop-filter: none !important;
      }
      .agy-shell .compact-tooltip,
      [role="tooltip"],
      .reactTooltipComponenttooltip.reactTooltipComponentdark {
        border-radius: var(--sakura-radius-sm) !important;
      }
      [data-radix-popper-content-wrapper] :is([role="menuitem"], [role="option"], [data-highlighted="true"]),
      [role="menu"] :is([role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]),
      [role="listbox"] [role="option"] {
        border-radius: 7px;
        transition: background-color var(--sakura-transition-fast), color var(--sakura-transition-fast);
      }
      [data-radix-popper-content-wrapper] :is([role="menuitem"], [role="option"]):is(:hover, [data-highlighted], [aria-selected="true"]),
      [role="menu"] [role="menuitem"]:is(:hover, [data-highlighted], [aria-selected="true"]),
      [role="listbox"] [role="option"]:is(:hover, [data-highlighted], [aria-selected="true"]) {
        background-color: rgba(232, 139, 185, 0.16) !important;
        color: ${uiInk} !important;
      }

      /* Keyboard Focus Visibility */
      .agy-shell :is(button, a, input, select, textarea, [role="button"], [role="menuitem"], [role="option"], [tabindex]):focus-visible,
      #agy-custom-theme-modal-dialog :is(button, input, textarea, [tabindex]):focus-visible {
        outline: 2px solid ${effPrimary} !important;
        outline-offset: 2px !important;
      }
      ` : ''}

      @media (prefers-reduced-motion: reduce) {
        #agy-focus-vignette,
        #agy-living-mascot .agy-mascot-stage,
        #agy-living-mascot .agy-mascot-sprite,
        .agy-sakura-petal,
        .surface-composer {
          animation: none !important;
          transition: none !important;
        }
      }
    ` : '';

    const useUnifiedGlass = Boolean(st.wpEnabled && wpUrl && mainTheme.unifiedGlass);
    if (useUnifiedGlass && typeof syncShellMetrics === 'function') {
      syncShellMetrics();
    }
    const effectiveBlur = Number.isFinite(st.glassBlur) ? `${st.glassBlur}px` : (mainTheme.headerBlur || '3px');
    if (isVideoWp && st.wpEnabled) {
      syncVideoWallpaper({
        enabled: true,
        wpUrl,
        srcKey: `${window.__AGY_MEDIA_BASE__ || ''}|${wpUrl.slice(0, 64)}|${wpUrl.length}`,
        bgPosition,
        scrimCss: videoScrimCss,
        overlayRgb,
        overlayAlpha,
        tintBg: effHeaderBg || mainTheme.headerBg || '',
        blurStr: effectiveBlur,
        useUnifiedGlass,
        reducedMotion: isReducedMotion
      });
    } else {
      syncVideoWallpaper(null);
      if (useUnifiedGlass) {
        syncPrebakedGlass(wpUrl, overlayRgb, overlayAlpha, effHeaderBg || mainTheme.headerBg || '', effectiveBlur);
      } else {
        syncPrebakedGlass(null);
      }
    }

    const sidePanelCss = st.wpEnabled ? `
      /* Frosted pre-baked glass + dark/light reading scrim for right-side Artifact / Text / Diff split panels */
      ${useUnifiedGlass ? `
      .agy-shell[data-agy-side-glass="1"]::before {
        clip-path: polygon(
          evenodd,
          0 0,
          100% 0,
          100% var(--agy-hdr-h, 75px),
          var(--agy-sidebar-w, 256px) var(--agy-hdr-h, 75px),
          var(--agy-sidebar-w, 256px) 100%,
          0 100%,
          0 0,
          var(--agy-side-l, 100%) var(--agy-side-t, 75px),
          var(--agy-side-r, 100%) var(--agy-side-t, 75px),
          var(--agy-side-r, 100%) var(--agy-side-b, 100%),
          var(--agy-side-l, 100%) var(--agy-side-b, 100%),
          var(--agy-side-l, 100%) var(--agy-side-t, 75px)
        ) !important;
      }
      ` : ''}
      body:not([data-has-browser-hole="true"]) .agy-shell [data-side-panel-body="true"]:not([data-has-browser-hole="true"]):not(:has([data-browser-hole]:not([data-browser-hole="false"]))) {
        background: ${mainTheme.aiCardBg || `rgba(${overlayRgb}, 0.72)`} !important;
        ${isLight ? `color: ${uiInk} !important;` : ''}
        backdrop-filter: none !important;
        border-left: 1px solid ${mainTheme.aiCardBorder || (isLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.14)')} !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
      }
      body:not([data-has-browser-hole="true"]) .agy-shell [data-side-panel-body="true"]:not([data-has-browser-hole="true"]):not(:has([data-browser-hole]:not([data-browser-hole="false"]))) pre {
        background: ${preCodeBg} !important;
        border: 1px solid ${mainTheme.aiCardBorder || (isLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.14)')} !important;
        border-radius: 10px !important;
      }
      .agy-shell [data-side-panel-body="true"] :is(h1, h2, h3, h4) {
        ${isLight ? `color: ${uiInk} !important;` : ''}
        text-shadow: ${isLight ? 'none' : '0 1px 6px rgba(0, 0, 0, 0.85)'};
      }
    ` : '';

    const headerCss = mainTheme.headerBg ? `
      /* Frosted top titlebar & seamless L-shaped unified glass (zero live backdrop-filter) */
      ${useUnifiedGlass ? `
      .agy-shell {
        position: relative !important;
      }
      .agy-shell > div:first-of-type {
        position: relative !important;
        z-index: 3 !important;
      }
      .agy-shell > div:not(:first-of-type) {
        position: relative !important;
        z-index: 2 !important;
      }
      .agy-shell::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 1;
        pointer-events: none;
        background-color: ${mainTheme.headerBg};
        background-image: var(--agy-l-glass-bg, none);
        background-size: cover;
        background-position: ${bgPosition};
        background-repeat: no-repeat;
        backdrop-filter: none !important;
        will-change: transform;
        clip-path: polygon(
          0 0,
          100% 0,
          100% var(--agy-hdr-h, 75px),
          var(--agy-sidebar-w, 256px) var(--agy-hdr-h, 75px),
          var(--agy-sidebar-w, 256px) 100%,
          0 100%
        );
      }
      .agy-shell [class*="@container/titlebar"] {
        background: transparent !important;
        backdrop-filter: none !important;
        border-bottom: 1px solid ${mainTheme.headerBorder || 'rgba(56, 189, 248, 0.10)'} !important;
      }
      ` : `
      .agy-shell [class*="@container/titlebar"] {
        background: ${mainTheme.headerBg} !important;
        backdrop-filter: none !important;
        border-bottom: 1px solid ${mainTheme.headerBorder || 'rgba(56, 189, 248, 0.15)'} !important;
      }
      `}
      .agy-shell [class*="@container/titlebar"] [data-testid="breadcrumb-segment"],
      .agy-shell [class*="@container/titlebar"] [data-testid="pane-titlebar-toolbar"] button,
      .agy-shell [class*="@container/titlebar"] [data-testid="pane-titlebar-toolbar"] span {
        color: ${uiInk} !important;
        text-shadow: ${uiShadow};
      }
      .agy-shell [class*="@container/titlebar"] [data-testid="pane-titlebar-toolbar"] button.border {
        background: ${isLight ? 'rgba(255, 255, 255, 0.56)' : 'rgba(6, 11, 24, 0.36)'} !important;
        border-color: ${pillBorder} !important;
      }
    ` : '';

    const sidebarOuterCss = useUnifiedGlass ? `
      .agy-shell aside,
      .agy-shell [data-sidebar="true"],
      .agy-shell .bg-sidebar:not(.surface-opaque) {
        background: transparent !important;
        backdrop-filter: none !important;
      }
    ` : `
      .agy-shell aside,
      .agy-shell [data-sidebar="true"],
      .agy-shell .bg-sidebar:not(.surface-opaque) {
        background: ${sidebarBg} !important;
        backdrop-filter: none !important;
      }
    `;

    styleEl.textContent = `
      ${designTokensCss}
      ${wpCss}

      /* Translucent themed glass sidebar (unified via ::before when unifiedGlass is active) */
      ${sidebarOuterCss}
      .agy-shell .bg-sidebar:not(.surface-opaque) .bg-sidebar:not(.surface-opaque),
      .agy-shell [data-sidebar="true"] .bg-sidebar:not(.surface-opaque),
      .agy-shell .bg-sidebar:not(.surface-opaque) [class*="group/headerbtn"],
      .agy-shell .bg-sidebar:not(.surface-opaque) [class*="group/section-header"] {
        background: transparent !important;
        backdrop-filter: none !important;
      }
      /* Keep floating menubar dropdowns & opaque popovers readable (never inherit transparent sidebar bg) */
      .agy-shell .surface-opaque.bg-sidebar,
      .agy-shell .surface-opaque.border-menu-border {
        background: ${modalBg} !important;
        border-color: ${mainTheme.borderColor} !important;
        box-shadow: 0 12px 32px rgba(0, 0, 0, ${isLight ? '0.18' : '0.65'}) !important;
        backdrop-filter: none !important;
      }
      /* Preserve virtual list positioning; hide sticky headers only while scrolled */
      .agy-shell .bg-sidebar .agy-scrolled > .w-full.relative > .bg-sidebar[style*="position: sticky"] {
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.14s ease !important;
      }
      .agy-shell .bg-sidebar [class*="group/headerbtn"]:hover,
      .agy-shell .bg-sidebar a:hover {
        background: ${sidebarHoverBg} !important;
        transition: background-color 180ms ease !important;
      }
      /* Sidebar visual separation & active conversation highlight */
      .agy-shell [data-testid="sidebar-split"] > :first-child {
        border-right: 1px solid ${mainTheme.headerBorder || 'rgba(255, 255, 255, 0.08)'} !important;
      }
      .agy-shell .bg-sidebar :is(a[aria-current="page"], a[data-active="true"], button[data-active="true"], a[class*="bg-sidebar-accent"], a[class*="bg-accent"]) {
        background: ${sidebarActiveBg} !important;
        box-shadow: inset 2.5px 0 0 ${effPrimary} !important;
        color: ${uiInk} !important;
      }
      ${st.zenMode ? `
      .agy-shell [data-testid="sidebar-split"] > :first-child {
        display: none !important;
      }
      ` : ''}
      ${sidebarEnhanceCss}
      ${aiCardCss}
      ${devComponentsCss}
      ${sidePanelCss}
      ${avatarCss}
      ${headerCss}

      /* "+ New Conversation" button glow */
      .agy-button-custom.border.border-border {
        background: ${btnBg} !important;
        border-color: ${mainTheme.borderColor} !important;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3) !important;
      }

      /* User Chat Bubble Double-Border Frame & Ornament */
      .agy-user-bubble-frame {
        background: ${bubbleTheme.frameBg} !important;
        border-radius: ${bubbleTheme.isScroll ? '6px' : '14px'} !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.42), 0 0 10px ${effGlow} !important;
        position: relative !important;
        overflow: visible !important;
        padding: 1.2px !important;
      }

      .agy-user-bubble-frame::after {
        content: "";
        position: absolute;
        top: 3px;
        left: 3px;
        width: ${bubbleTheme.isOrnament ? '16px' : '14px'};
        height: ${bubbleTheme.isOrnament ? '16px' : '14px'};
        background-image: url("${cornerFiligreeUrl}");
        background-size: contain;
        background-repeat: no-repeat;
        pointer-events: none;
        opacity: ${bubbleTheme.isOrnament ? '0.85' : '0.65'};
      }

      .agy-user-bubble {
        background: ${bubbleTheme.bg} !important;
        border-radius: ${bubbleTheme.isScroll ? '5px' : '13px'} !important;
        padding: 8px 16px !important;
        color: ${bubbleTheme.textColor} !important;
        border: ${innerBubbleBorder} !important;
        overflow: visible !important;
        font-weight: 450 !important;
      }

      .agy-user-bubble * {
        color: ${bubbleTheme.textColor} !important;
      }

      /* Double-Border Input Composer — Hero interactive anchor with calm focus glow */
      .surface-composer {
        background: ${inputOuterBorder} !important;
        border-radius: 16px !important;
        padding: 1.2px !important;
        box-shadow: 0 8px 26px rgba(0, 0, 0, 0.52), 0 0 12px ${effGlow} !important;
        position: relative !important;
        transition: box-shadow 200ms ease, transform 200ms ease !important;
      }
      .surface-composer:focus-within {
        box-shadow: 0 0 0 1px ${effPrimary}, 0 10px 30px rgba(0, 0, 0, 0.58), 0 0 22px ${effGlow} !important;
      }

      .surface-composer-card {
        background: ${inputCardBg} !important;
        backdrop-filter: none !important;
        border-radius: 14.8px !important;
        border: ${bubbleTheme.innerBorder || '1px solid rgba(255, 255, 255, 0.07)'} !important;
      }

      /* High-contrast pill badges for top composer bar (adaptive light/dark theme) */
      .surface-composer [data-testid="project-selector-trigger"],
      .surface-composer [data-testid="branch-pill-trigger"],
      .surface-composer [aria-label="Select Environment"],
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] button,
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] [role="button"] {
        background: ${pillBg} !important;
        color: ${pillText} !important;
        border: 1px solid ${pillBorder} !important;
        border-radius: 9999px !important;
        font-weight: 500 !important;
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.25) !important;
        margin: 1px 2px !important;
        transition: background-color 0.15s ease, border-color 0.15s ease !important;
      }
      .surface-composer [data-testid="branch-pill-trigger"],
      .surface-composer [aria-label="Select Environment"],
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] button:not([data-testid="project-selector-trigger"]),
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] [role="button"]:not([data-testid="project-selector-trigger"]) {
        padding-left: 8px !important;
        padding-right: 7px !important;
        gap: 4px !important;
      }
      .surface-composer [data-testid="project-selector-trigger"]:hover,
      .surface-composer [data-testid="branch-pill-trigger"]:hover,
      .surface-composer [aria-label="Select Environment"]:hover,
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] button:hover,
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] [role="button"]:hover {
        background: ${pillHoverBg} !important;
        border-color: ${mainTheme.borderColor} !important;
        color: ${pillText} !important;
      }
      .surface-composer [data-testid="project-selector-trigger"] *,
      .surface-composer [data-testid="branch-pill-trigger"] *,
      .surface-composer [aria-label="Select Environment"] *,
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] button *,
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] [role="button"] * {
        color: ${pillText} !important;
      }
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] .ml-auto > * {
        background: ${pillBg} !important;
        color: ${pillText} !important;
        border-radius: 9999px !important;
        padding: 2px 8px !important;
      }

      ${bubbleStickerCss}
      ${inputStickerCss}

      @media (max-width: 640px) {
        .agy-user-bubble-frame::before,
        .surface-composer::before {
          transform: scale(0.78);
          transform-origin: bottom right;
        }
      }

      .settings-modal-container {
        background: ${modalBg} !important;
        border: 1px solid ${mainTheme.borderColor} !important;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.75), 0 0 24px ${mainTheme.glow} !important;
        backdrop-filter: none !important;
      }

      #agy-custom-theme-modal-dialog {
        background: ${modalBg} !important;
        border-color: ${mainTheme.borderColor} !important;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.9), 0 0 32px ${mainTheme.glow} !important;
      }
      #agy-custom-theme-modal-header {
        background: ${mainTheme.modalHeaderBg || 'rgba(22, 16, 14, 0.85)'} !important;
      }
      #agy-custom-theme-badge {
        color: ${mainTheme.primary} !important;
        border-color: ${mainTheme.borderColor} !important;
        background: ${mainTheme.glow} !important;
      }
      #agy-custom-theme-sidebar-btn svg,
      #agy-custom-theme-titlebar-btn svg {
        color: ${effPrimary} !important;
      }
    `;

    syncTitleBarOverlay(st);
    scheduleTitleBarSync(st);
    syncFocusVignette(st);
    if (typeof syncLivingMascot === 'function') {
      syncLivingMascot(st);
    }
  }

  function syncTitleBarOverlay(stOverride) {
    const st = stOverride || getState();
    const activeTh = THEMES[st.themeName] || THEMES[DEFAULT_THEME_KEY] || {};
    if (window.electronNative && typeof window.electronNative.setTitleBarOverlay === 'function') {
      try {
        window.electronNative.setTitleBarOverlay({
          color: st.wpEnabled ? '#00000000' : '#111114',
          symbolColor: (st.wpEnabled && activeTh.isLight) ? '#0f172a' : '#f8fafc'
        });
      } catch (e) {}
    }
  }

  function clearTitleBarTimers() {
    if (Array.isArray(window.__AGY_TBO_TIMERS__)) {
      window.__AGY_TBO_TIMERS__.forEach(id => clearTimeout(id));
    }
    window.__AGY_TBO_TIMERS__ = [];
  }

  function scheduleTitleBarSync(stOverride) {
    clearTitleBarTimers();
    const st = stOverride || getState();
    syncTitleBarOverlay(st);
    [300, 900, 2000, 4000, 7000].forEach(ms => {
      window.__AGY_TBO_TIMERS__.push(setTimeout(() => syncTitleBarOverlay(), ms));
    });
  }

  function removeCustomTheme() {
    clearTitleBarTimers();
    if (window.__AGY_TICK_RAF__) {
      cancelAnimationFrame(window.__AGY_TICK_RAF__);
      window.__AGY_TICK_RAF__ = 0;
    }
    if (window.__AGY_MODAL_OBSERVER__) {
      try { window.__AGY_MODAL_OBSERVER__.disconnect(); } catch (e) {}
      window.__AGY_MODAL_OBSERVER__ = null;
    }
    if (window.__AGY_SHELL_RO__) {
      try { window.__AGY_SHELL_RO__.disconnect(); } catch (e) {}
      window.__AGY_SHELL_RO__ = null;
    }
    if (window.__AGY_SCROLL_AC__) {
      try { window.__AGY_SCROLL_AC__.abort(); } catch (e) {}
      window.__AGY_SCROLL_AC__ = null;
    }
    window.__AGY_LAST_GLASS__ = null;
    window.__AGY_HOLE_EL__ = null;
    window.__AGY_SIDE_EL__ = null;
    window.__AGY_SIDEBAR_PANE_EL__ = null;
    const styleEl = document.getElementById('antigravity-custom-theme-active');
    if (styleEl) styleEl.remove();
    const navBtn = document.getElementById('agy-custom-theme-sidebar-btn');
    if (navBtn) navBtn.remove();
    const titleBtn = document.getElementById('agy-custom-theme-titlebar-btn');
    if (titleBtn) titleBtn.remove();
    const settingsBtn = document.getElementById('agy-custom-theme-settings-btn');
    if (settingsBtn) settingsBtn.remove();
    cleanupLivingMascot();
    cleanupVideoWallpaper();
    cleanupFocusVignette();
    window.__AGY_VIDEO_WP_CFG__ = null;
    document.querySelectorAll('.agy-sakura-petal').forEach(p => p.remove());
    const modal = document.getElementById('agy-custom-theme-modal-backdrop');
    if (modal) modal.remove();
    document.querySelectorAll('[data-agy-scroll-bound]').forEach(el => {
      delete el.dataset.agyScrollBound;
      el.classList.remove('agy-scrolled');
    });
    const shell = document.querySelector('.agy-shell');
    if (shell) {
      delete shell.dataset.agyHoleActive;
      delete shell.dataset.agySideGlass;
      delete shell.dataset.agyTboMounted;
      ['--agy-hole-clip', '--agy-l-glass-bg', '--agy-sidebar-w', '--agy-hdr-h', '--agy-side-l', '--agy-side-t', '--agy-side-r', '--agy-side-b'].forEach(prop => {
        shell.style.removeProperty(prop);
      });
    }
    if (window.electronNative && typeof window.electronNative.setTitleBarOverlay === 'function') {
      try {
        window.electronNative.setTitleBarOverlay({ color: '#111114', symbolColor: '#f8fafc' });
      } catch (e) {}
    }
  }

  window.__ANTIGRAVITY_APPLY_CUSTOM_THEME__ = applyTheme;
  window.__ANTIGRAVITY_REMOVE_CUSTOM_THEME__ = removeCustomTheme;
  window.__ANTIGRAVITY_OPEN_THEME_MODAL__ = openCustomThemeModal;

  function openCustomThemeModal() {
    const stInit = getState();
    const initTheme = THEMES[stInit.themeName] || THEMES[DEFAULT_THEME_KEY] || {};
    const modalLight = Boolean(initTheme.isLight);
    let backdrop = document.getElementById('agy-custom-theme-modal-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'agy-custom-theme-modal-backdrop';
      backdrop.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(10px);
      `;

      backdrop.innerHTML = `
        <div id="agy-custom-theme-modal-dialog" style="background: rgba(16, 12, 11, 0.97); border: 1.2px solid rgba(212, 148, 106, 0.35); border-radius: 18px; width: 100%; max-width: 900px; height: 86vh; max-height: 860px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 64px rgba(0, 0, 0, 0.9), 0 0 32px rgba(224, 142, 85, 0.25); font-family: system-ui, -apple-system, sans-serif;">
          <div id="agy-custom-theme-modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 18px 26px; border-bottom: 1px solid ${modalLight ? 'rgba(15, 23, 42, 0.10)' : 'rgba(255, 255, 255, 0.08)'}; background: rgba(22, 16, 14, 0.85);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span id="agy-theme-modal-title" style="font-size: 17px; font-weight: 600; color: ${modalLight ? '#0f172a' : '#f4f4f5'}; letter-spacing: -0.2px;">Custom Theme Studio</span>
              <span id="agy-custom-theme-badge" style="font-size: 11.5px; padding: 2.5px 9px; border-radius: 9999px; background: rgba(224, 142, 85, 0.2); color: #e08e55; font-weight: 500; border: 1px solid rgba(224, 142, 85, 0.3);">${THEME_KEYS.length} Preset${THEME_KEYS.length > 1 ? 's' : ''}</span>
            </div>
            <button id="agy-theme-modal-close-btn" type="button" style="background: ${modalLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.06)'}; border: 1px solid ${modalLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.1)'}; color: ${modalLight ? '#334155' : '#d4d4d8'}; cursor: pointer; width: 30px; height: 30px; border-radius: 8px; font-size: 15px; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;">✕</button>
          </div>
          <div id="agy-theme-modal-body" style="flex: 1; overflow-y: auto; height: 100%;"></div>
        </div>
      `;

      document.body.appendChild(backdrop);

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.style.display = 'none';
      });
      backdrop.querySelector('#agy-theme-modal-close-btn').addEventListener('click', () => {
        backdrop.style.display = 'none';
      });
      const keyOpts = window.__AGY_SCROLL_AC__ ? { signal: window.__AGY_SCROLL_AC__.signal } : undefined;
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && backdrop.style.display !== 'none') {
          backdrop.style.display = 'none';
        }
      }, keyOpts);
    }

    backdrop.style.display = 'flex';
    const body = backdrop.querySelector('#agy-theme-modal-body');
    renderThemePanels(body);
  }

  function renderThemePanels(container) {
    const st = getState();
    const mainTheme = THEMES[st.themeName] || THEMES[DEFAULT_THEME_KEY];
    const effUserAv = st.userAvatar === 'none' ? '' : (st.userAvatar || mainTheme.userAvatar || '');
    const effAgentAv = st.agentAvatar === 'none' ? '' : (st.agentAvatar || mainTheme.agentAvatar || '');
    const isLightModal = Boolean(mainTheme.isLight);
    const mText = isLightModal ? '#0f172a' : '#f4f4f5';
    const mHeading = isLightModal ? '#0f172a' : '#ffffff';
    const mLabel = isLightModal ? '#334155' : '#d4d4d8';
    const mMuted = isLightModal ? '#475569' : '#a1a1aa';
    const mDivider = isLightModal ? 'rgba(15, 23, 42, 0.10)' : 'rgba(255, 255, 255, 0.08)';
    const mBorder = isLightModal ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.12)';
    const mBtnBg = isLightModal ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.08)';
    const mCardBg = mainTheme.cardBg || (isLightModal ? 'rgba(255, 255, 255, 0.84)' : 'rgba(14, 12, 12, 0.78)');
    const mCardSelBg = mainTheme.cardSelectedBg || (isLightModal ? 'rgba(226, 232, 240, 0.90)' : 'rgba(42, 34, 30, 0.68)');
    const mCardSelBorder = isLightModal ? `1.5px solid ${mainTheme.primary}` : '1.5px solid #f4f4f5';
    const mInputBg = isLightModal ? 'rgba(15, 23, 42, 0.05)' : 'rgba(0, 0, 0, 0.35)';
    const modalTitleEl = document.getElementById('agy-theme-modal-title');
    if (modalTitleEl) modalTitleEl.style.color = mText;
    const modalHeaderEl = document.getElementById('agy-custom-theme-modal-header');
    if (modalHeaderEl) modalHeaderEl.style.borderBottomColor = mDivider;
    const modalCloseEl = document.getElementById('agy-theme-modal-close-btn');
    if (modalCloseEl) {
      modalCloseEl.style.background = mBtnBg;
      modalCloseEl.style.borderColor = mBorder;
      modalCloseEl.style.color = mLabel;
    }

    container.innerHTML = `
      <div id="agy-theme-scroll-container" style="padding: 24px 32px 48px 32px; max-width: 860px; margin: 0 auto; overflow-y: auto; height: 100%; color: ${mText};">
        <div style="border: 1px solid ${mainTheme.borderColor}; background: ${mCardBg}; border-radius: 12px; padding: 14px 20px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="font-size: 14.5px; font-weight: 600; color: ${mText}; margin-bottom: 2px;">Workspace Mode & Atmosphere</div>
              <div style="font-size: 12px; color: ${mMuted};">Switch instantly between coding focus and scenic sakura depth (Zen shortcut: Ctrl+Shift+Z).</div>
            </div>
            <div style="display: inline-flex; padding: 3px; border-radius: 9px; background: ${mInputBg}; border: 1px solid ${mBorder}; gap: 3px;">
              ${Object.entries(MODE_PRESETS).map(([key, item]) => {
                const active = st.workspaceMode === key;
                return `<button class="agy-mode-btn" data-mode="${key}" type="button" style="padding: 4px 11px; border-radius: 7px; font-size: 12px; font-weight: ${active ? '600' : '500'}; border: none; cursor: pointer; background: ${active ? (ACCENT_PRESETS[st.accentOverride]?.primary || mainTheme.primary) : 'transparent'}; color: ${active ? '#100D17' : mLabel}; transition: all 160ms ease;">${escapeHtml(item.label)}</button>`;
              }).join('')}
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; padding-top: 8px; border-top: 1px solid ${mDivider};">
            <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: ${mMuted};">
                Chat Opacity
                <input id="agy-chat-opacity-slider" type="range" min="70" max="98" value="${st.chatOpacity >= 70 ? st.chatOpacity : Math.round((MODE_PRESETS[st.workspaceMode]?.defaultCardAlpha || 0.92) * 100)}" style="width: 92px; cursor: pointer; accent-color: ${mainTheme.primary}; height: 5px;" />
                <span id="agy-chat-opacity-val" style="min-width: 34px; text-align: right;">${st.chatOpacity >= 70 ? st.chatOpacity : Math.round((MODE_PRESETS[st.workspaceMode]?.defaultCardAlpha || 0.92) * 100)}%</span>
              </label>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: ${mMuted};">
                <span>Accent</span>
                ${Object.entries(ACCENT_PRESETS).map(([key, item]) => {
                  const active = st.accentOverride === key;
                  const swatch = item.primary || mainTheme.primary;
                  return `<button class="agy-accent-btn" data-accent="${key}" type="button" title="${escapeHtml(item.label)}" style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 9999px; font-size: 11.5px; cursor: pointer; background: ${active ? mCardSelBg : 'transparent'}; border: 1px solid ${active ? swatch : mBorder}; color: ${active ? mText : mMuted};"><span style="width: 8px; height: 8px; border-radius: 50%; background: ${swatch}; display: inline-block;"></span>${escapeHtml(key ? item.label : 'Auto')}</button>`;
                }).join('')}
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <label style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: ${mLabel}; cursor: pointer;" title="Dim wallpaper gently behind active conversations & terminal">
                <input id="agy-focus-vignette-toggle" type="checkbox" ${st.focusVignette ? 'checked' : ''} style="accent-color: ${mainTheme.primary}; cursor: pointer;" />
                Focus Vignette
              </label>
              <label style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: ${mLabel}; cursor: pointer;">
                <input id="agy-zen-toggle" type="checkbox" ${st.zenMode ? 'checked' : ''} style="accent-color: ${mainTheme.primary}; cursor: pointer;" />
                Zen Mode
              </label>
              <label style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: ${mLabel}; cursor: pointer;">
                <input id="agy-reduced-motion-toggle" type="checkbox" ${st.reducedMotion ? 'checked' : ''} style="accent-color: ${mainTheme.primary}; cursor: pointer;" />
                Reduced Motion
              </label>
            </div>
          </div>
        </div>

        <div style="border: 1px solid ${mainTheme.borderColor}; background: ${mCardBg}; border-radius: 12px; padding: 16px 20px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="font-size: 14.5px; font-weight: 600; color: ${mText}; margin-bottom: 2px;">Wallpaper, Pre-Baked Blur & Config</div>
              <div style="font-size: 12.5px; color: ${mMuted};">Balance artwork clarity, 120fps pre-baked frosted glass blur, or share config JSON.</div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: ${mLabel}; cursor: pointer;">
                <input id="agy-wp-toggle" type="checkbox" ${st.wpEnabled ? 'checked' : ''} style="accent-color: ${mainTheme.primary}; cursor: pointer;" />
                Backdrop
              </label>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: ${mMuted};">
                Dim
                <input id="agy-dim-slider" type="range" min="15" max="92" value="${st.dimming}" style="width: 96px; cursor: pointer; accent-color: ${isLightModal ? mainTheme.primary : '#ffffff'}; height: 5px;" />
                <span id="agy-dim-val" style="min-width: 32px; text-align: right;">${st.dimming}%</span>
              </label>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: ${mMuted};">
                Blur
                <input id="agy-blur-slider" type="range" min="0" max="16" value="${st.glassBlur}" style="width: 78px; cursor: pointer; accent-color: ${mainTheme.primary}; height: 5px;" />
                <span id="agy-blur-val" style="min-width: 30px; text-align: right;">${st.glassBlur}px</span>
              </label>
              <label style="padding: 5px 10px; border-radius: 8px; background: ${mBtnBg}; border: 1px solid ${mainTheme.borderColor}; color: ${mText}; font-size: 12px; cursor: pointer; white-space: nowrap;">
                Custom Media
                <input id="agy-wp-upload" type="file" accept="image/*,video/mp4,video/webm" style="display: none;" />
              </label>
              <button id="agy-export-btn" type="button" style="padding: 5px 10px; border-radius: 8px; background: ${mBtnBg}; border: 1px solid ${mBorder}; color: ${mText}; font-size: 12px; cursor: pointer; white-space: nowrap;">
                Export JSON
              </button>
              <button id="agy-import-toggle" type="button" style="padding: 5px 10px; border-radius: 8px; background: ${mBtnBg}; border: 1px solid ${mBorder}; color: ${mText}; font-size: 12px; cursor: pointer; white-space: nowrap;">
                Import JSON
              </button>
              <button id="agy-reset-btn" type="button" style="padding: 5px 10px; border-radius: 8px; background: rgba(239, 68, 68, 0.14); border: 1px solid rgba(239, 68, 68, 0.35); color: ${isLightModal ? '#b91c1c' : '#fca5a5'}; font-size: 12px; cursor: pointer; white-space: nowrap;">
                Reset
              </button>
            </div>
          </div>
          <div id="agy-import-box" style="display: none; flex-direction: column; gap: 8px; padding-top: 8px; border-top: 1px solid ${mDivider};">
            <textarea id="agy-import-text" rows="3" placeholder='Paste exported theme config JSON here (e.g. {"themeName":"WLOP Cosmic","dimming":45,...})' style="width: 100%; box-sizing: border-box; background: ${mInputBg}; color: ${mText}; border: 1px solid ${mainTheme.borderColor}; border-radius: 8px; padding: 8px 10px; font-family: monospace; font-size: 12px; resize: vertical;"></textarea>
            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
              <span id="agy-import-msg" style="font-size: 12px; color: ${isLightModal ? '#b91c1c' : '#fca5a5'};"></span>
              <button id="agy-import-apply" type="button" style="padding: 5px 12px; border-radius: 7px; background: ${mainTheme.primary}; color: #090d16; font-weight: 600; font-size: 12px; border: none; cursor: pointer;">Apply JSON</button>
            </div>
          </div>
        </div>

        <div style="border: 1px solid ${mainTheme.borderColor}; background: ${mCardBg}; border-radius: 12px; padding: 14px 20px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="font-size: 14px; font-weight: 600; color: ${mText}; margin-bottom: 2px;">Chat Avatars (User & AI Agent)</div>
              <div style="font-size: 12px; color: ${mMuted};">Profile badges rendered beside chat messages (auto-compressed WebP).</div>
            </div>
            <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div id="agy-user-av-preview" style="width: 30px; height: 30px; border-radius: ${st.avatarRadius}%; border: 1.5px solid ${mainTheme.primary}; background: ${mBtnBg} ${effUserAv ? `url('${safeCssUrl(effUserAv)}') center/cover no-repeat` : ''}; display: flex; align-items: center; justify-content: center; font-size: 11px; color: ${mMuted};">${effUserAv ? '' : 'U'}</div>
                <label style="padding: 4px 10px; border-radius: 7px; background: ${mBtnBg}; border: 1px solid ${mainTheme.borderColor}; color: ${mText}; font-size: 12px; cursor: pointer; white-space: nowrap;">
                  User
                  <input id="agy-user-av-upload" type="file" accept="image/*" style="display: none;" />
                </label>
                <button id="agy-user-av-clear" type="button" style="padding: 4px 8px; border-radius: 7px; background: transparent; border: 1px solid ${mBorder}; color: ${mMuted}; font-size: 11.5px; cursor: pointer;">Off</button>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div id="agy-agent-av-preview" style="width: 30px; height: 30px; border-radius: ${st.avatarRadius}%; border: 1.5px solid ${mainTheme.secondary || mainTheme.primary}; background: ${mBtnBg} ${effAgentAv ? `url('${safeCssUrl(effAgentAv)}') center/cover no-repeat` : ''}; display: flex; align-items: center; justify-content: center; font-size: 11px; color: ${mMuted};">${effAgentAv ? '' : 'AI'}</div>
                <label style="padding: 4px 10px; border-radius: 7px; background: ${mBtnBg}; border: 1px solid ${mainTheme.borderColor}; color: ${mText}; font-size: 12px; cursor: pointer; white-space: nowrap;">
                  Agent
                  <input id="agy-agent-av-upload" type="file" accept="image/*" style="display: none;" />
                </label>
                <button id="agy-agent-av-clear" type="button" style="padding: 4px 8px; border-radius: 7px; background: transparent; border: 1px solid ${mBorder}; color: ${mMuted}; font-size: 11.5px; cursor: pointer;">Off</button>
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap; padding-top: 6px; border-top: 1px solid ${mDivider};">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: ${mMuted};">
              Size
              <input id="agy-av-size" type="range" min="22" max="52" value="${st.avatarSize}" style="width: 100px; cursor: pointer; accent-color: ${mainTheme.primary}; height: 5px;" />
              <span id="agy-av-size-val" style="min-width: 34px;">${st.avatarSize}px</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: ${mMuted};">
              Corner Radius
              <input id="agy-av-rad" type="range" min="0" max="50" value="${st.avatarRadius}" style="width: 100px; cursor: pointer; accent-color: ${mainTheme.primary}; height: 5px;" />
              <span id="agy-av-rad-val" style="min-width: 34px;">${st.avatarRadius}%</span>
            </label>
          </div>
        </div>

        <div style="margin-bottom: 28px;">
          <div style="font-size: 15px; font-weight: 600; color: ${mHeading}; margin-bottom: 4px;">User Chat Bubble</div>
          <div style="font-size: 12.5px; color: ${mMuted}; margin-bottom: 14px;">Mix and match bubble frame & ornament independently from the active wallpaper.</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            ${THEME_KEYS.map(name => {
              const th = THEMES[name];
              const safeName = escapeHtml(name);
              const isSelected = name === st.bubbleName;
              const stickerTop = th.isOrnament ? Math.round((th.stickerTop || 0) * 0.85) : Math.round((th.stickerTop || 0) * 0.74);
              const stickerW = Math.round((th.stickerW || 0) * 0.78);
              const stickerH = th.isOrnament ? Math.round((th.stickerH || 0) * 0.8) : Math.round((th.stickerH || 0) * 0.78);
              return `
                <div class="agy-bubble-card" tabindex="0" role="button" aria-pressed="${isSelected}" data-name="${safeName}" style="position: relative; border-radius: 12px; border: ${isSelected ? mCardSelBorder : '1px solid ' + mBorder}; background: ${isSelected ? mCardSelBg : mCardBg}; padding: 24px 18px 14px 18px; cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; min-height: 112px; transition: border-color 0.15s ease, background-color 0.15s ease;">
                  <div style="display: flex; justify-content: center; align-items: center; width: 100%; margin-top: 6px; margin-bottom: 10px;">
                    <div style="position: relative; width: 192px; height: 46px; padding: 1.2px; border-radius: ${th.isScroll ? '6px' : '12px'}; background: ${th.frameBg}; box-shadow: 0 4px 14px rgba(0,0,0,0.45), 0 0 10px ${th.glow};">
                      <div style="position: relative; width: 100%; height: 100%; background: ${th.bg}; border: ${th.innerBorder || '1px solid ' + th.borderColor}; border-radius: ${th.isScroll ? '4px' : '11px'}; display: flex; align-items: center; padding: 0 16px;">
                        ${th.sticker ? `<div style="position: absolute; top: ${stickerTop}px; right: 8px; width: ${stickerW}px; height: ${stickerH}px; background-image: url('${safeCssUrl(th.sticker)}'); background-size: contain; background-position: ${th.isOrnament ? 'center' : 'bottom center'}; background-repeat: no-repeat; pointer-events: none;"></div>` : ''}
                        <span style="font-size: 13.5px; font-weight: 500; color: ${th.textColor};">Hello ✨</span>
                      </div>
                    </div>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13.5px; font-weight: 500; color: ${mText};">${safeName}</span>
                    <div class="agy-card-check-slot">${isSelected ? CHECK_SVG : ''}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div style="margin-bottom: 28px;">
          <div style="font-size: 15px; font-weight: 600; color: ${mHeading}; margin-bottom: 4px;">Composer Style</div>
          <div style="font-size: 12.5px; color: ${mMuted}; margin-bottom: 14px;">Customize the chat input frame without affecting keyboard shortcuts or attachments.</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            ${Object.entries(INPUT_STYLES).map(([key, item]) => {
              const isSelected = key === st.inputStyle;
              const activeBubbleTh = THEMES[st.bubbleName] || mainTheme;
              const previewStickerStyle = activeBubbleTh.isOrnament
                ? 'top: -12px; right: 10px; width: 72px; height: 22px; background-position: center;'
                : 'top: -22px; right: 10px; width: 32px; height: 28px; background-position: bottom center;';
              const previewInnerBg = key === 'glass'
                ? (activeBubbleTh.inputGlassBg || 'rgba(20, 15, 13, 0.45)')
                : (activeBubbleTh.inputCardBg || 'rgba(26, 18, 15, 0.92)');
              return `
                <div class="agy-input-card" tabindex="0" role="button" aria-pressed="${isSelected}" data-style="${key}" style="border-radius: 12px; border: ${isSelected ? mCardSelBorder : '1px solid ' + mBorder}; background: ${isSelected ? mCardSelBg : mCardBg}; padding: 16px 18px; cursor: pointer; display: flex; flex-direction: column; gap: 12px; transition: border-color 0.15s ease, background-color 0.15s ease;">
                  <div class="agy-input-preview-outer" style="position: relative; margin-top: 8px; padding: 1.5px; border-radius: 10px; background: ${key === 'double_gold' ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : activeBubbleTh.frameBg};">
                    <div class="agy-input-preview-sticker" style="position: absolute; ${previewStickerStyle} background-image: url('${safeCssUrl(activeBubbleTh.sticker || '')}'); background-size: contain; background-repeat: no-repeat; display: ${key !== 'minimal' && activeBubbleTh.sticker ? 'block' : 'none'}; pointer-events: none;"></div>
                    <div class="agy-input-preview-inner" style="background: ${previewInnerBg}; border-radius: 9px; padding: 8px 12px; font-size: 12px; color: #a1a1aa; display: flex; justify-content: space-between; align-items: center;">
                      <span>Ask anything, @ to mention...</span>
                      <span class="agy-input-preview-turbo" style="color: ${activeBubbleTh.primary}; font-size: 11px;">Send →</span>
                    </div>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <div style="font-size: 13.5px; font-weight: 500; color: ${mText};">${escapeHtml(item.label)}</div>
                      <div style="font-size: 11.5px; color: ${mMuted};">${escapeHtml(item.desc)}</div>
                    </div>
                    <div class="agy-card-check-slot">${isSelected ? CHECK_SVG : ''}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div>
          <div style="font-size: 15px; font-weight: 600; color: ${mHeading}; margin-bottom: 4px;">Theme Presets (${THEME_KEYS.length})</div>
          <div style="font-size: 12.5px; color: ${mMuted}; margin-bottom: 14px;">Complete backdrop, palette, unified L-glass, and matching ornaments.</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            ${THEME_KEYS.map(name => {
              const th = THEMES[name];
              const safeName = escapeHtml(name);
              const isSelected = name === st.themeName;
              const isVidThumb = isVideoMediaUrl(th.wallpaper || '');
              const thumbBg = (th.wallpaper && !isVidThumb)
                ? `linear-gradient(180deg, rgba(0,0,0,0.15), rgba(14,12,12,0.85)), url('${safeCssUrl(th.wallpaper)}')`
                : (th.pureBg || th.bg);
              const thumbOrnamentStyle = th.isOrnament
                ? 'right: 10px; bottom: 8px; width: 76px; height: 24px; background-position: center;'
                : 'right: 12px; bottom: 4px; width: 42px; height: 38px; background-position: bottom center;';
              return `
                <div class="agy-preset-card" tabindex="0" role="button" aria-pressed="${isSelected}" data-name="${safeName}" style="border-radius: 12px; border: ${isSelected ? mCardSelBorder : '1px solid ' + mBorder}; background: ${mCardBg}; overflow: hidden; cursor: pointer; display: flex; flex-direction: column; transition: border-color 0.15s ease;">
                  <div style="height: 68px; width: 100%; background-image: ${thumbBg}; background-size: cover; background-position: ${th.bgPosition || 'center'}; position: relative; display: flex; align-items: flex-end; padding: 8px 14px; overflow: hidden;">
                    ${isVidThumb ? `<video src="${safeCssUrl(getVideoBlobUrl(th.wallpaper))}" autoplay loop muted playsinline style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none;"></video><div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(16,13,23,0.12), rgba(16,13,23,0.72)); pointer-events: none;"></div>` : ''}
                    ${th.sticker ? `<div style="position: absolute; ${thumbOrnamentStyle} background-image: url('${safeCssUrl(th.sticker)}'); background-size: contain; background-repeat: no-repeat; pointer-events: none; z-index: 2;"></div>` : ''}
                    <span style="position: relative; z-index: 2; font-size: 13.5px; font-weight: 600; color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.75);">${safeName}</span>
                  </div>
                  <div style="padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; color: ${mMuted};">${escapeHtml(th.concept || '')}</span>
                    <div class="agy-card-check-slot">${isSelected ? CHECK_SVG : ''}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    function updateInputPreviews(bName) {
      const activeTh = THEMES[bName] || THEMES[DEFAULT_THEME_KEY];
      container.querySelectorAll('.agy-input-card').forEach(card => {
        const key = card.dataset.style;
        const outer = card.querySelector('.agy-input-preview-outer');
        if (outer) {
          outer.style.background = key === 'double_gold'
            ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
            : activeTh.frameBg;
        }
        const inner = card.querySelector('.agy-input-preview-inner');
        if (inner) {
          inner.style.background = key === 'glass'
            ? (activeTh.inputGlassBg || 'rgba(20, 15, 13, 0.45)')
            : (activeTh.inputCardBg || 'rgba(26, 18, 15, 0.92)');
        }
        const sticker = card.querySelector('.agy-input-preview-sticker');
        if (sticker) {
          if (key !== 'minimal' && activeTh.sticker) {
            sticker.style.display = 'block';
            sticker.style.backgroundImage = `url('${activeTh.sticker}')`;
            if (activeTh.isOrnament) {
              sticker.style.top = '-12px';
              sticker.style.width = '72px';
              sticker.style.height = '22px';
              sticker.style.backgroundPosition = 'center';
            } else {
              sticker.style.top = '-22px';
              sticker.style.width = '32px';
              sticker.style.height = '28px';
              sticker.style.backgroundPosition = 'bottom center';
            }
          } else {
            sticker.style.display = 'none';
          }
        }
        const turbo = card.querySelector('.agy-input-preview-turbo');
        if (turbo) {
          turbo.style.color = activeTh.primary;
        }
      });
    }

    const slider = container.querySelector('#agy-dim-slider');
    const valLabel = container.querySelector('#agy-dim-val');
    slider.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      valLabel.textContent = v + '%';
      applyTheme({ dimming: v });
    });

    container.querySelectorAll('.agy-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modeKey = btn.dataset.mode;
        const mCfg = MODE_PRESETS[modeKey] || MODE_PRESETS.balanced;
        applyTheme({
          workspaceMode: modeKey,
          dimming: mCfg.defaultDim,
          chatOpacity: Math.round(mCfg.defaultCardAlpha * 100)
        });
        renderThemePanels(container);
      });
    });

    const chatOpacitySlider = container.querySelector('#agy-chat-opacity-slider');
    const chatOpacityVal = container.querySelector('#agy-chat-opacity-val');
    if (chatOpacitySlider) {
      chatOpacitySlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        if (chatOpacityVal) chatOpacityVal.textContent = v + '%';
        applyTheme({ chatOpacity: v });
      });
    }

    container.querySelectorAll('.agy-accent-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const accentKey = btn.dataset.accent || '';
        applyTheme({ accentOverride: accentKey });
        renderThemePanels(container);
      });
    });

    const focusVignetteToggle = container.querySelector('#agy-focus-vignette-toggle');
    if (focusVignetteToggle) {
      focusVignetteToggle.addEventListener('change', (e) => {
        applyTheme({ focusVignette: e.target.checked });
      });
    }

    const zenToggle = container.querySelector('#agy-zen-toggle');
    if (zenToggle) {
      zenToggle.addEventListener('change', (e) => {
        applyTheme({ zenMode: e.target.checked });
        syncShellMetrics();
      });
    }

    const reducedMotionToggle = container.querySelector('#agy-reduced-motion-toggle');
    if (reducedMotionToggle) {
      reducedMotionToggle.addEventListener('change', (e) => {
        applyTheme({ reducedMotion: e.target.checked });
      });
    }

    const wpToggle = container.querySelector('#agy-wp-toggle');
    wpToggle.addEventListener('change', (e) => {
      applyTheme({ wpEnabled: e.target.checked });
    });

    const wpUpload = container.querySelector('#agy-wp-upload');
    wpUpload.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      compressWallpaperFile(file, (dataUrl) => {
        applyTheme({ customWp: dataUrl, wpEnabled: true });
        const toggle = container.querySelector('#agy-wp-toggle');
        if (toggle) toggle.checked = true;
      });
    });

    const userAvUpload = container.querySelector('#agy-user-av-upload');
    const userAvPreview = container.querySelector('#agy-user-av-preview');
    const userAvClear = container.querySelector('#agy-user-av-clear');
    const agentAvUpload = container.querySelector('#agy-agent-av-upload');
    const agentAvPreview = container.querySelector('#agy-agent-av-preview');
    const agentAvClear = container.querySelector('#agy-agent-av-clear');

    function syncAvPreview(el, url, fallbackText) {
      if (!el) return;
      if (url) {
        el.style.backgroundImage = `url("${url}")`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.textContent = '';
      } else {
        el.style.backgroundImage = 'none';
        el.textContent = fallbackText;
      }
    }

    if (userAvUpload) {
      userAvUpload.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        compressAvatarFile(file, (dataUrl) => {
          applyTheme({ userAvatar: dataUrl });
          syncAvPreview(userAvPreview, dataUrl, 'U');
        });
      });
    }
    if (userAvClear) {
      userAvClear.addEventListener('click', () => {
        applyTheme({ userAvatar: 'none' });
        syncAvPreview(userAvPreview, '', 'U');
      });
    }
    if (agentAvUpload) {
      agentAvUpload.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        compressAvatarFile(file, (dataUrl) => {
          applyTheme({ agentAvatar: dataUrl });
          syncAvPreview(agentAvPreview, dataUrl, 'AI');
        });
      });
    }
    if (agentAvClear) {
      agentAvClear.addEventListener('click', () => {
        applyTheme({ agentAvatar: 'none' });
        syncAvPreview(agentAvPreview, '', 'AI');
      });
    }

    const blurSlider = container.querySelector('#agy-blur-slider');
    const blurLabel = container.querySelector('#agy-blur-val');
    if (blurSlider) {
      blurSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        if (blurLabel) blurLabel.textContent = v + 'px';
        applyTheme({ glassBlur: v });
      });
    }

    const avSizeSlider = container.querySelector('#agy-av-size');
    const avSizeVal = container.querySelector('#agy-av-size-val');
    if (avSizeSlider) {
      avSizeSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        if (avSizeVal) avSizeVal.textContent = v + 'px';
        applyTheme({ avatarSize: v });
      });
    }

    const avRadSlider = container.querySelector('#agy-av-rad');
    const avRadVal = container.querySelector('#agy-av-rad-val');
    if (avRadSlider) {
      avRadSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        if (avRadVal) avRadVal.textContent = v + '%';
        if (userAvPreview) userAvPreview.style.borderRadius = v + '%';
        if (agentAvPreview) agentAvPreview.style.borderRadius = v + '%';
        applyTheme({ avatarRadius: v });
      });
    }

    const exportBtn = container.querySelector('#agy-export-btn');
    const importToggle = container.querySelector('#agy-import-toggle');
    const importBox = container.querySelector('#agy-import-box');
    const importText = container.querySelector('#agy-import-text');
    const importApply = container.querySelector('#agy-import-apply');
    const importMsg = container.querySelector('#agy-import-msg');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const json = JSON.stringify(getState(), null, 2);
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(json).then(() => {
            exportBtn.textContent = 'Copied ✓';
            setTimeout(() => { exportBtn.textContent = 'Export JSON'; }, 1500);
          }).catch(() => {
            if (importBox && importText) {
              importBox.style.display = 'flex';
              importText.value = json;
              importText.select();
            }
          });
        } else if (importBox && importText) {
          importBox.style.display = 'flex';
          importText.value = json;
          importText.select();
        }
      });
    }
    if (importToggle && importBox) {
      importToggle.addEventListener('click', () => {
        importBox.style.display = importBox.style.display === 'none' ? 'flex' : 'none';
        if (importMsg) importMsg.textContent = '';
      });
    }
    if (importApply && importText) {
      importApply.addEventListener('click', () => {
        try {
          const parsed = JSON.parse(importText.value.trim());
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Config must be a JSON object');
          }
          const allowed = {};
          const keys = ['themeName', 'bubbleName', 'inputStyle', 'dimming', 'wpEnabled', 'customWp', 'userAvatar', 'agentAvatar', 'glassBlur', 'avatarSize', 'avatarRadius', 'workspaceMode', 'chatOpacity', 'accentOverride', 'reducedMotion', 'zenMode', 'focusVignette'];
          keys.forEach((k) => {
            if (parsed[k] !== undefined) allowed[k] = parsed[k];
          });
          applyTheme(allowed);
          renderThemePanels(container);
        } catch (err) {
          if (importMsg) importMsg.textContent = 'Invalid JSON: ' + err.message;
        }
      });
    }

    const resetBtn = container.querySelector('#agy-reset-btn');
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_CUSTOM_WP);
      localStorage.removeItem(STORAGE_USER_AVATAR);
      localStorage.removeItem(STORAGE_AGENT_AVATAR);
      localStorage.removeItem(STORAGE_GLASS_BLUR);
      localStorage.removeItem(STORAGE_AVATAR_SIZE);
      localStorage.removeItem(STORAGE_AVATAR_RADIUS);
      localStorage.removeItem(STORAGE_THEME);
      localStorage.removeItem(STORAGE_BUBBLE);
      localStorage.removeItem(STORAGE_INPUT);
      localStorage.removeItem(STORAGE_DIMMING);
      localStorage.removeItem(STORAGE_WP_ENABLED);
      localStorage.removeItem(STORAGE_MODE);
      localStorage.removeItem(STORAGE_CHAT_OPACITY);
      localStorage.removeItem(STORAGE_ACCENT);
      localStorage.removeItem(STORAGE_REDUCED_MOTION);
      localStorage.removeItem(STORAGE_ZEN);
      localStorage.removeItem(STORAGE_FOCUS_VIGNETTE);
      const defTheme = THEMES[DEFAULT_THEME_KEY] || {};
      const defDim = Number.isFinite(defTheme.defaultDimming) ? defTheme.defaultDimming : 69;
      const defBlur = parseFiniteInt(String(defTheme.headerBlur || '').replace(/[^\d]/g, ''), 3);
      applyTheme({
        themeName: DEFAULT_THEME_KEY,
        bubbleName: DEFAULT_THEME_KEY,
        inputStyle: 'sync',
        dimming: defDim,
        wpEnabled: true,
        customWp: '',
        userAvatar: '',
        agentAvatar: '',
        glassBlur: defBlur,
        avatarSize: 32,
        avatarRadius: 50,
        workspaceMode: 'balanced',
        chatOpacity: 0,
        accentOverride: '',
        reducedMotion: false,
        zenMode: false,
        focusVignette: true
      });
      renderThemePanels(container);
    });

    const bindCardActivation = (el, activate) => {
      el.addEventListener('click', activate);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      });
    };

    container.querySelectorAll('.agy-preset-card').forEach(card => {
      bindCardActivation(card, () => {
        const name = card.dataset.name;
        const picked = THEMES[name] || {};
        const nextOverrides = { themeName: name, bubbleName: name, customWp: '', chatOpacity: 0 };
        if (Number.isFinite(picked.defaultDimming)) {
          nextOverrides.dimming = picked.defaultDimming;
        }
        applyTheme(nextOverrides);
        renderThemePanels(container);
      });
    });

    container.querySelectorAll('.agy-bubble-card').forEach(card => {
      bindCardActivation(card, () => {
        const name = card.dataset.name;
        applyTheme({ bubbleName: name });

        container.querySelectorAll('.agy-bubble-card').forEach(b => {
          const isSel = b.dataset.name === name;
          b.setAttribute('aria-pressed', String(isSel));
          b.style.border = isSel ? mCardSelBorder : ('1px solid ' + mBorder);
          b.style.background = isSel ? mCardSelBg : mCardBg;
          const slot = b.querySelector('.agy-card-check-slot');
          if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
        });

        updateInputPreviews(name);
      });
    });

    container.querySelectorAll('.agy-input-card').forEach(card => {
      bindCardActivation(card, () => {
        const styleKey = card.dataset.style;
        applyTheme({ inputStyle: styleKey });

        container.querySelectorAll('.agy-input-card').forEach(c => {
          const isSel = c.dataset.style === styleKey;
          c.setAttribute('aria-pressed', String(isSel));
          c.style.border = isSel ? mCardSelBorder : ('1px solid ' + mBorder);
          c.style.background = isSel ? mCardSelBg : mCardBg;
          const slot = c.querySelector('.agy-card-check-slot');
          if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
        });
      });
    });
  }

  const STORAGE_MASCOT_RATIO = 'agy_mascot_x_ratio_v3';

  function cleanupLivingMascot() {
    if (Array.isArray(window.__AGY_MASCOT_PHASE_TIMERS__)) {
      window.__AGY_MASCOT_PHASE_TIMERS__.forEach(id => clearTimeout(id));
      window.__AGY_MASCOT_PHASE_TIMERS__ = [];
    }
    if (window.__AGY_MASCOT_ROAM_RAF__) {
      cancelAnimationFrame(window.__AGY_MASCOT_ROAM_RAF__);
      window.__AGY_MASCOT_ROAM_RAF__ = 0;
    }
    if (window.__AGY_MASCOT_ROAM_TIMER__) {
      clearTimeout(window.__AGY_MASCOT_ROAM_TIMER__);
      window.__AGY_MASCOT_ROAM_TIMER__ = 0;
    }
    if (window.__AGY_MASCOT_SUCCESS_TIMER__) {
      clearTimeout(window.__AGY_MASCOT_SUCCESS_TIMER__);
      window.__AGY_MASCOT_SUCCESS_TIMER__ = 0;
    }
    if (window.__AGY_MASCOT_BUBBLE_TIMER__) {
      clearTimeout(window.__AGY_MASCOT_BUBBLE_TIMER__);
      window.__AGY_MASCOT_BUBBLE_TIMER__ = 0;
    }
    if (window.__AGY_MASCOT_LISTEN_TIMER__) {
      clearTimeout(window.__AGY_MASCOT_LISTEN_TIMER__);
      window.__AGY_MASCOT_LISTEN_TIMER__ = 0;
    }
    if (window.__AGY_MASCOT_AC__) {
      try { window.__AGY_MASCOT_AC__.abort(); } catch (_) {}
      window.__AGY_MASCOT_AC__ = null;
    }
    window.__AGY_MASCOT_CTRL__ = null;
    const existing = document.getElementById('agy-living-mascot');
    if (existing) existing.remove();
  }

  function spawnSakuraBurst(composerEl, originLeftPx) {
    const st = getState();
    if (st.reducedMotion) return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!composerEl) return;
    const baseLeft = Number.isFinite(originLeftPx)
      ? originLeftPx
      : Math.max(24, (composerEl.clientWidth || 600) - 56);
    const offsets = [
      { ox: -14, top: -32, dx: -32, dy: -48, rot: -110, delay: 0 },
      { ox: 6, top: -44, dx: -8, dy: -56, rot: 95, delay: 80 },
      { ox: -22, top: -24, dx: -44, dy: -34, rot: -145, delay: 140 },
      { ox: 18, top: -36, dx: 26, dy: -46, rot: 130, delay: 200 },
      { ox: 0, top: -28, dx: 14, dy: -60, rot: 75, delay: 260 }
    ];
    offsets.forEach((p) => {
      const el = document.createElement('span');
      el.className = 'agy-sakura-petal';
      el.style.left = Math.round(baseLeft + p.ox) + 'px';
      el.style.top = p.top + 'px';
      el.style.setProperty('--dx', p.dx + 'px');
      el.style.setProperty('--dy', p.dy + 'px');
      el.style.setProperty('--rot', p.rot + 'deg');
      el.style.animationDelay = p.delay + 'ms';
      composerEl.appendChild(el);
      setTimeout(() => { el.remove(); }, 1850);
    });
  }

  function showMascotBubble(mascot, text, durationMs = 1500) {
    if (!mascot) return;
    const bubble = mascot.querySelector('.agy-mascot-bubble');
    if (!bubble) return;
    bubble.textContent = text;
    bubble.dataset.show = '1';
    if (window.__AGY_MASCOT_BUBBLE_TIMER__) clearTimeout(window.__AGY_MASCOT_BUBBLE_TIMER__);
    if (durationMs > 0) {
      window.__AGY_MASCOT_BUBBLE_TIMER__ = setTimeout(() => {
        if (mascot.dataset.state !== 'thinking') {
          delete bubble.dataset.show;
        }
        window.__AGY_MASCOT_BUBBLE_TIMER__ = 0;
      }, durationMs);
    }
  }

  function syncLivingMascot(stOverride) {
    const st = stOverride || getState();
    const bubbleTheme = THEMES[st.bubbleName] || THEMES[st.themeName] || THEMES[DEFAULT_THEME_KEY] || {};
    const shouldMount = Boolean(bubbleTheme.composerOnlyMascot && bubbleTheme.sticker && st.inputStyle !== 'minimal');
    const existing = document.getElementById('agy-living-mascot');

    if (!shouldMount) {
      cleanupLivingMascot();
      return;
    }

    const composer = document.querySelector('.surface-composer');
    if (!composer) return;

    const mascotW = Number(bubbleTheme.stickerW) || 74;
    const padX = 16;
    const getBounds = () => {
      const cw = composer.clientWidth || 640;
      const minX = padX;
      const maxX = Math.max(minX, cw - mascotW - padX);
      return { minX, maxX };
    };

    let mascot = existing;
    let ctrl = window.__AGY_MASCOT_CTRL__;
    if (!mascot || mascot.parentNode !== composer || !ctrl) {
      cleanupLivingMascot();
      const ac = new AbortController();
      window.__AGY_MASCOT_AC__ = ac;

      mascot = document.createElement('div');
      mascot.id = 'agy-living-mascot';
      mascot.setAttribute('role', 'button');
      mascot.setAttribute('aria-label', 'Sakura Kitsune Mascot');
      mascot.title = 'Sakura Kitsune • Click to pet · Drag along bar · Double-click for Studio';
      mascot.dataset.state = 'idle';
      mascot.dataset.phase = 'perched';
      mascot.innerHTML = `
        <div class="agy-mascot-bubble" aria-hidden="true">•••</div>
        <div class="agy-mascot-stage"><div class="agy-mascot-sprite"></div></div>
      `;
      composer.appendChild(mascot);

      const { minX, maxX } = getBounds();
      let savedRatio = parseFloat(localStorage.getItem(STORAGE_MASCOT_RATIO) || '');
      if (!Number.isFinite(savedRatio) || savedRatio < 0 || savedRatio > 1) {
        savedRatio = 0.94;
      }
      ctrl = {
        x: Math.round(minX + (maxX - minX) * savedRatio),
        dragging: false,
        moving: false,
        lastUserInteraction: 0,
        petCount: 0,
        composer
      };
      window.__AGY_MASCOT_CTRL__ = ctrl;

      const clearPhaseTimers = () => {
        if (Array.isArray(window.__AGY_MASCOT_PHASE_TIMERS__)) {
          window.__AGY_MASCOT_PHASE_TIMERS__.forEach(id => clearTimeout(id));
        }
        window.__AGY_MASCOT_PHASE_TIMERS__ = [];
      };

      const applyPos = (nx, save = false) => {
        const b = getBounds();
        ctrl.x = Math.max(b.minX, Math.min(b.maxX, nx));
        mascot.style.setProperty('--agy-mx', `${Math.round(ctrl.x)}px`);
        if (save && b.maxX > b.minX) {
          const ratio = (ctrl.x - b.minX) / (b.maxX - b.minX);
          try { localStorage.setItem(STORAGE_MASCOT_RATIO, ratio.toFixed(4)); } catch (_) {}
        }
      };
      ctrl.applyPos = applyPos;
      applyPos(ctrl.x, false);

      const stopMove = () => {
        clearPhaseTimers();
        ctrl.moving = false;
        mascot.dataset.phase = 'perched';
        if (mascot.dataset.state === 'popup') {
          mascot.dataset.state = 'idle';
        }
      };
      ctrl.stopMove = stopMove;
      ctrl.stopWalk = stopMove;

      // Natural 4-beat "Peek-a-Boo" relocation along the composer rim
      const moveTo = (targetX, onDone) => {
        const curSt = getState();
        const reduced = Boolean(curSt.reducedMotion) || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (reduced || document.hidden || ctrl.dragging) return;
        const b = getBounds();
        const clampedTarget = Math.max(b.minX, Math.min(b.maxX, targetX));
        if (Math.abs(clampedTarget - ctrl.x) < 24) return;

        clearPhaseTimers();
        ctrl.moving = true;
        mascot.dataset.phase = 'ducking';

        const schedulePhase = (ms, fn) => {
          const tid = setTimeout(() => {
            if (!ctrl.moving || ctrl.dragging || document.hidden || !mascot.isConnected) {
              stopMove();
              return;
            }
            fn();
          }, ms);
          window.__AGY_MASCOT_PHASE_TIMERS__.push(tid);
        };

        schedulePhase(260, () => {
          mascot.dataset.phase = 'scurry';
          applyPos(clampedTarget, true);
        });

        schedulePhase(480, () => {
          mascot.dataset.phase = 'peeking';
        });

        schedulePhase(920, () => {
          mascot.dataset.phase = 'perched';
          mascot.dataset.state = 'popup';
        });

        schedulePhase(1320, () => {
          ctrl.moving = false;
          if (mascot.dataset.state === 'popup') {
            mascot.dataset.state = 'idle';
          }
          if (typeof onDone === 'function') onDone();
        });
      };
      ctrl.moveTo = moveTo;
      ctrl.walkTo = moveTo;

      const scheduleRoam = () => {
        if (window.__AGY_MASCOT_ROAM_TIMER__) clearTimeout(window.__AGY_MASCOT_ROAM_TIMER__);
        const delayMs = 13000 + Math.round(Math.random() * 9000);
        window.__AGY_MASCOT_ROAM_TIMER__ = setTimeout(() => {
          window.__AGY_MASCOT_ROAM_TIMER__ = 0;
          if (!mascot.isConnected) return;
          const curSt = getState();
          const reduced = Boolean(curSt.reducedMotion) || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
          const recentlyInteracted = (Date.now() - ctrl.lastUserInteraction) < 6000;
          if (!reduced && !document.hidden && !ctrl.dragging && !ctrl.moving && mascot.dataset.state === 'idle') {
            if (!recentlyInteracted) {
              const b = getBounds();
              const span = b.maxX - b.minX;
              if (span > 90) {
                let target = b.minX + Math.random() * span;
                if (Math.abs(target - ctrl.x) < 90) {
                  target = ctrl.x > (b.minX + span * 0.5) ? b.minX + span * 0.16 : b.maxX - span * 0.10;
                }
                moveTo(target);
              }
            }
          }
          scheduleRoam();
        }, delayMs);
      };
      scheduleRoam();

      // Pointer drag along rim & pet interaction
      let dragStartClientX = 0;
      let dragStartX = 0;
      let movedDist = 0;
      let lastClientX = 0;

      mascot.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        stopMove();
        ctrl.dragging = true;
        ctrl.lastUserInteraction = Date.now();
        dragStartClientX = e.clientX;
        lastClientX = e.clientX;
        dragStartX = ctrl.x;
        movedDist = 0;
        mascot.dataset.phase = 'perched';
        mascot.dataset.dragging = '1';
        mascot.style.setProperty('--agy-tilt', '0deg');
        try { mascot.setPointerCapture(e.pointerId); } catch (_) {}
      }, { signal: ac.signal });

      mascot.addEventListener('pointermove', (e) => {
        if (!ctrl.dragging) return;
        const dx = e.clientX - dragStartClientX;
        const stepDx = e.clientX - lastClientX;
        lastClientX = e.clientX;
        movedDist = Math.max(movedDist, Math.abs(dx));
        const tilt = Math.max(-5, Math.min(5, stepDx * 0.45));
        mascot.style.setProperty('--agy-tilt', `${tilt.toFixed(1)}deg`);
        applyPos(dragStartX + dx, false);
      }, { signal: ac.signal });

      const finishDrag = (e) => {
        if (!ctrl.dragging) return;
        ctrl.dragging = false;
        delete mascot.dataset.dragging;
        mascot.style.setProperty('--agy-tilt', '0deg');
        try { mascot.releasePointerCapture(e.pointerId); } catch (_) {}
        applyPos(ctrl.x, true);
        if (movedDist < 6) {
          // Gentle pet interaction!
          ctrl.petCount += 1;
          const moods = ['♥', '✨', '🌸', '♥'];
          const glyph = moods[ctrl.petCount % moods.length];
          mascot.dataset.state = 'happy';
          showMascotBubble(mascot, glyph, 1200);
          spawnSakuraBurst(composer, ctrl.x + mascotW * 0.5);
          if (window.__AGY_MASCOT_SUCCESS_TIMER__) clearTimeout(window.__AGY_MASCOT_SUCCESS_TIMER__);
          window.__AGY_MASCOT_SUCCESS_TIMER__ = setTimeout(() => {
            if (mascot.dataset.state === 'happy') mascot.dataset.state = 'idle';
            window.__AGY_MASCOT_SUCCESS_TIMER__ = 0;
          }, 700);
        }
      };
      mascot.addEventListener('pointerup', finishDrag, { signal: ac.signal });
      mascot.addEventListener('pointercancel', finishDrag, { signal: ac.signal });

      mascot.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        window.__ANTIGRAVITY_OPEN_THEME_MODAL__();
      }, { signal: ac.signal });

      mascot.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.__ANTIGRAVITY_OPEN_THEME_MODAL__();
      }, { signal: ac.signal });

      // Perk up attentively while user is typing in composer
      composer.addEventListener('input', () => {
        ctrl.lastUserInteraction = Date.now();
        if (ctrl.dragging || mascot.dataset.state === 'thinking') return;
        stopMove();
        mascot.dataset.state = 'listening';
        if (window.__AGY_MASCOT_LISTEN_TIMER__) clearTimeout(window.__AGY_MASCOT_LISTEN_TIMER__);
        window.__AGY_MASCOT_LISTEN_TIMER__ = setTimeout(() => {
          if (mascot.dataset.state === 'listening') mascot.dataset.state = 'idle';
          window.__AGY_MASCOT_LISTEN_TIMER__ = 0;
        }, 1600);
      }, { signal: ac.signal });

      window.addEventListener('resize', () => {
        const b = getBounds();
        const r = parseFloat(localStorage.getItem(STORAGE_MASCOT_RATIO) || '0.94');
        const safeR = Number.isFinite(r) ? Math.max(0, Math.min(1, r)) : 0.94;
        applyPos(b.minX + (b.maxX - b.minX) * safeR, false);
      }, { signal: ac.signal });
    } else {
      // Re-clamp position if composer width changed
      ctrl.applyPos(ctrl.x, false);
    }

    const isThinking = Boolean(
      composer.querySelector('.surface-composer-card button[aria-label*="Cancel"], .surface-composer-card button[aria-label*="Stop"]')
    );
    const prevThinking = Boolean(window.__AGY_MASCOT_PREV_THINKING__);
    window.__AGY_MASCOT_PREV_THINKING__ = isThinking;

    if (isThinking) {
      if (ctrl && ctrl.stopMove) ctrl.stopMove();
      if (window.__AGY_MASCOT_SUCCESS_TIMER__) {
        clearTimeout(window.__AGY_MASCOT_SUCCESS_TIMER__);
        window.__AGY_MASCOT_SUCCESS_TIMER__ = 0;
      }
      mascot.dataset.state = 'thinking';
      const bubble = mascot.querySelector('.agy-mascot-bubble');
      if (bubble) bubble.textContent = '•••';
    } else if (prevThinking) {
      mascot.dataset.state = 'success';
      showMascotBubble(mascot, '✨', 1500);
      spawnSakuraBurst(composer, (ctrl ? ctrl.x : 0) + mascotW * 0.5);
      if (window.__AGY_MASCOT_SUCCESS_TIMER__) clearTimeout(window.__AGY_MASCOT_SUCCESS_TIMER__);
      window.__AGY_MASCOT_SUCCESS_TIMER__ = setTimeout(() => {
        const cur = document.getElementById('agy-living-mascot');
        if (cur && cur.dataset.state === 'success') cur.dataset.state = 'idle';
        window.__AGY_MASCOT_SUCCESS_TIMER__ = 0;
      }, 1500);
    } else if (mascot.dataset.state === 'thinking') {
      mascot.dataset.state = 'idle';
      const bubble = mascot.querySelector('.agy-mascot-bubble');
      if (bubble) delete bubble.dataset.show;
    }
  }

  function injectTitlebarThemeButton() {
    if (document.getElementById('agy-custom-theme-titlebar-btn')) return;
    const toolbar = document.querySelector('[data-testid="pane-titlebar-toolbar"]');
    if (!toolbar) return;

    const btn = document.createElement('button');
    btn.id = 'agy-custom-theme-titlebar-btn';
    btn.type = 'button';
    btn.title = 'Custom Theme Studio (Zen Mode: Ctrl+Shift+Z)';
    btn.setAttribute('aria-label', 'Open Custom Theme Studio');
    btn.className = 'inline-flex items-center justify-center rounded-md p-1.5 transition-colors cursor-pointer select-none';
    btn.style.cssText = 'background: transparent; border: none; opacity: 0.92;';
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.__ANTIGRAVITY_OPEN_THEME_MODAL__();
    });
    toolbar.insertBefore(btn, toolbar.firstChild);
  }

  function injectMainSidebarButton() {
    if (document.getElementById('agy-custom-theme-sidebar-btn')) return;

    const sidebars = Array.from(document.querySelectorAll('.agy-shell .bg-sidebar, .agy-shell [data-testid="sidebar-split"]'));
    if (!sidebars.length) return;

    let customSpan = null;
    for (const sb of sidebars) {
      const spans = Array.from(sb.querySelectorAll('span'));
      customSpan = spans.find(s => s.textContent?.trim() === 'Customizations');
      if (customSpan) break;
    }
    if (!customSpan) return;

    const row = customSpan.closest('a, button, div[role="button"], .group\\/headerbtn') || customSpan.parentElement;
    if (!row || !row.parentNode) return;

    const btn = document.createElement('button');
    btn.id = 'agy-custom-theme-sidebar-btn';
    btn.type = 'button';
    btn.className = 'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer select-none';
    btn.style.cssText = 'text-align: left;';
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
      <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Custom theme</span>
    `;

    row.parentNode.insertBefore(btn, row.nextSibling);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.__ANTIGRAVITY_OPEN_THEME_MODAL__();
    });
  }

  function injectSettingsModalButton() {
    const modal = document.querySelector('.settings-modal-container');
    if (!modal || document.getElementById('agy-custom-theme-settings-btn')) return;

    const headers = Array.from(modal.querySelectorAll('h2, h3'));
    const appearanceHeader = headers.find(h => h.textContent?.trim() === 'Appearance');
    if (!appearanceHeader) return;

    let targetContainer = appearanceHeader.parentElement;
    while (targetContainer && !targetContainer.className.includes('justify-between') && targetContainer !== modal) {
      targetContainer = targetContainer.parentElement;
    }

    if (!targetContainer || !targetContainer.parentNode) return;

    Array.from(targetContainer.parentNode.children).forEach(child => {
      if (child.id === 'agy-custom-theme-settings-btn') child.remove();
    });

    const activeSt = getState();
    const activeTh = THEMES[activeSt.themeName] || THEMES[DEFAULT_THEME_KEY] || {};
    const btn = document.createElement('button');
    btn.id = 'agy-custom-theme-settings-btn';
    btn.type = 'button';
    btn.className = 'select-none rounded px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer';
    btn.style.cssText = `background: ${activeTh.btnBg || 'rgba(15, 30, 58, 0.72)'}; color: ${activeTh.isLight ? '#0f172a' : '#f8fafc'}; border: 1px solid ${activeTh.borderColor || 'rgba(255, 255, 255, 0.25)'}; box-shadow: 0 2px 10px ${activeTh.glow || 'rgba(0, 0, 0, 0.25)'}; margin-top: 8px; margin-bottom: 8px; display: inline-flex; align-items: center; gap: 6px;`;
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
      <span>Open Custom Theme Studio</span>
    `;

    targetContainer.parentNode.insertBefore(btn, targetContainer.nextSibling);

    btn.addEventListener('click', () => {
      window.__ANTIGRAVITY_OPEN_THEME_MODAL__();
    });
  }

  function hookSidebarScroll() {
    if (!window.__AGY_SCROLL_AC__) return;
    const scrollers = document.querySelectorAll('.agy-shell .bg-sidebar .overflow-y-auto');
    scrollers.forEach(sc => {
      if (sc.dataset.agyScrollBound) return;
      sc.dataset.agyScrollBound = '1';
      const sync = () => sc.classList.toggle('agy-scrolled', sc.scrollTop > 2);
      sync();
      sc.addEventListener('scroll', sync, { passive: true, signal: window.__AGY_SCROLL_AC__.signal });
    });
  }

  function syncShellMetrics() {
    const shell = document.querySelector('.agy-shell');
    if (!shell) return;
    const split = shell.querySelector('[data-testid="sidebar-split"]');
    const sidebarPane = split ? split.firstElementChild : null;
    const titleBar = shell.querySelector('[class*="@container/titlebar"]');
    const sw = sidebarPane ? Math.round(sidebarPane.getBoundingClientRect().width) : 0;
    const shellRect = shell.getBoundingClientRect();
    const hdrBottom = titleBar ? Math.round(titleBar.getBoundingClientRect().bottom - shellRect.top) : 35;
    shell.style.setProperty('--agy-sidebar-w', sw + 'px');
    shell.style.setProperty('--agy-hdr-h', hdrBottom + 'px');

    const hasHoleAttr = document.body.getAttribute('data-has-browser-hole') === 'true';
    const holeEl = hasHoleAttr ? shell.querySelector('[data-browser-hole]:not([data-browser-hole="false"])') : null;
    if (holeEl) {
      if (window.__AGY_SHELL_RO__ && window.__AGY_HOLE_EL__ !== holeEl) {
        try { window.__AGY_SHELL_RO__.observe(holeEl); } catch (e) {}
        window.__AGY_HOLE_EL__ = holeEl;
      }
      const hRect = holeEl.getBoundingClientRect();
      if (hRect.width > 1 && hRect.height > 1) {
        const l = Math.max(0, Math.round(hRect.left - shellRect.left));
        const t = Math.max(0, Math.round(hRect.top - shellRect.top));
        const r = Math.max(l, Math.round(hRect.right - shellRect.left));
        const b = Math.max(t, Math.round(hRect.bottom - shellRect.top));
        shell.style.setProperty(
          '--agy-hole-clip',
          `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${l}px ${t}px, ${r}px ${t}px, ${r}px ${b}px, ${l}px ${b}px, ${l}px ${t}px)`
        );
        shell.dataset.agyHoleActive = '1';
        delete shell.dataset.agySideGlass;
        return;
      }
    }
    window.__AGY_HOLE_EL__ = null;
    delete shell.dataset.agyHoleActive;
    shell.style.removeProperty('--agy-hole-clip');

    const sideBody = shell.querySelector('[data-side-panel-body="true"]');
    if (sideBody) {
      if (window.__AGY_SHELL_RO__ && window.__AGY_SIDE_EL__ !== sideBody) {
        try { window.__AGY_SHELL_RO__.observe(sideBody); } catch (e) {}
        window.__AGY_SIDE_EL__ = sideBody;
      }
      const sRect = sideBody.getBoundingClientRect();
      const hasContent = sideBody.children.length > 0;
      if (hasContent && sRect.width > 24 && sRect.height > 24 && sRect.left < shellRect.right - 8 && sRect.right > shellRect.left + 8) {
        const sl = Math.max(sw, Math.round(sRect.left - shellRect.left));
        const st = Math.max(hdrBottom, Math.round(sRect.top - shellRect.top));
        const sr = Math.min(Math.round(shellRect.width), Math.max(sl, Math.round(sRect.right - shellRect.left)));
        const sb = Math.min(Math.round(shellRect.height), Math.max(st, Math.round(sRect.bottom - shellRect.top)));
        if (sr - sl > 20 && sb - st > 20) {
          shell.style.setProperty('--agy-side-l', sl + 'px');
          shell.style.setProperty('--agy-side-t', st + 'px');
          shell.style.setProperty('--agy-side-r', sr + 'px');
          shell.style.setProperty('--agy-side-b', sb + 'px');
          shell.dataset.agySideGlass = '1';
          return;
        }
      }
    }
    delete shell.dataset.agySideGlass;
  }

  function hookShellMetrics() {
    const shell = document.querySelector('.agy-shell');
    if (!shell) return;
    if (window.__AGY_VIDEO_WP_CFG__ && !document.getElementById('agy-bg-video')) {
      syncVideoWallpaper(window.__AGY_VIDEO_WP_CFG__);
    }
    if (!shell.dataset.agyTboMounted) {
      shell.dataset.agyTboMounted = '1';
      scheduleTitleBarSync();
    }
    if (window.__AGY_LAST_GLASS__ && window.__AGY_LAST_GLASS__.url && !shell.style.getPropertyValue('--agy-l-glass-bg')) {
      shell.style.setProperty('--agy-l-glass-bg', 'url("' + window.__AGY_LAST_GLASS__.url + '")');
    }
    if (!window.__AGY_SHELL_RO__ && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(syncShellMetrics);
      ro.observe(shell);
      window.__AGY_SHELL_RO__ = ro;
    }
    if (window.__AGY_SHELL_RO__) {
      const sidebarPane = shell.querySelector('[data-testid="sidebar-split"]')?.firstElementChild;
      if (sidebarPane && window.__AGY_SIDEBAR_PANE_EL__ !== sidebarPane) {
        try { window.__AGY_SHELL_RO__.observe(sidebarPane); } catch (e) {}
        window.__AGY_SIDEBAR_PANE_EL__ = sidebarPane;
      }
    }
    syncShellMetrics();
    syncFocusVignette();
  }

  function tick() {
    injectMainSidebarButton();
    injectTitlebarThemeButton();
    injectSettingsModalButton();
    hookSidebarScroll();
    hookShellMetrics();
    syncFocusVignette();
    syncLivingMascot();
  }

  function scheduleTick() {
    if (window.__AGY_TICK_RAF__) return;
    window.__AGY_TICK_RAF__ = requestAnimationFrame(() => {
      window.__AGY_TICK_RAF__ = 0;
      tick();
    });
  }

  function boot() {
    clearTitleBarTimers();
    if (window.__AGY_TICK_RAF__) {
      cancelAnimationFrame(window.__AGY_TICK_RAF__);
      window.__AGY_TICK_RAF__ = 0;
    }
    if (window.__AGY_SHELL_RO__) {
      try { window.__AGY_SHELL_RO__.disconnect(); } catch (e) {}
      window.__AGY_SHELL_RO__ = null;
    }
    if (window.__AGY_SCROLL_AC__) {
      try { window.__AGY_SCROLL_AC__.abort(); } catch (e) {}
    }
    window.__AGY_SCROLL_AC__ = new AbortController();
    window.addEventListener('load', () => scheduleTitleBarSync(), { signal: window.__AGY_SCROLL_AC__.signal });
    window.addEventListener('focus', () => {
      syncTitleBarOverlay();
      if (window.__AGY_VIDEO_WP_CFG__) syncVideoWallpaper(window.__AGY_VIDEO_WP_CFG__);
    }, { signal: window.__AGY_SCROLL_AC__.signal });
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'Z' || e.key === 'z')) {
        e.preventDefault();
        const cur = getState();
        applyTheme({ zenMode: !cur.zenMode });
        syncShellMetrics();
      }
    }, { signal: window.__AGY_SCROLL_AC__.signal });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) syncTitleBarOverlay();
      if (window.__AGY_VIDEO_WP_CFG__) syncVideoWallpaper(window.__AGY_VIDEO_WP_CFG__);
    }, { signal: window.__AGY_SCROLL_AC__.signal });
    document.querySelectorAll('[data-agy-scroll-bound]').forEach(el => delete el.dataset.agyScrollBound);
    document.querySelectorAll('[data-agy-tbo-mounted]').forEach(el => delete el.dataset.agyTboMounted);
    const staleBackdrop = document.getElementById('agy-custom-theme-modal-backdrop');
    if (staleBackdrop) staleBackdrop.remove();
    const staleSidebarBtn = document.getElementById('agy-custom-theme-sidebar-btn');
    if (staleSidebarBtn) staleSidebarBtn.remove();
    const staleTitleBtn = document.getElementById('agy-custom-theme-titlebar-btn');
    if (staleTitleBtn) staleTitleBtn.remove();
    const staleSettingsBtn = document.getElementById('agy-custom-theme-settings-btn');
    if (staleSettingsBtn) staleSettingsBtn.remove();
    cleanupLivingMascot();
    cleanupVideoWallpaper();
    cleanupFocusVignette();

    window.__AGY_HOLE_EL__ = null;
    window.__AGY_SIDE_EL__ = null;
    window.__AGY_SIDEBAR_PANE_EL__ = null;
    applyTheme();
    if (window.__AGY_MODAL_OBSERVER__) {
      window.__AGY_MODAL_OBSERVER__.disconnect();
    }
    if (document.body) {
      window.__AGY_MODAL_OBSERVER__ = new MutationObserver(scheduleTick);
      window.__AGY_MODAL_OBSERVER__.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-has-browser-hole', 'data-browser-hole']
      });
    }
    tick();
  }

  if (document.body && (document.head || document.documentElement)) {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  }

  return 'Antigravity Custom Theme Engine Ready!';
})();
