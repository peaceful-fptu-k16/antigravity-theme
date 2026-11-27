import http from 'node:http';
import { getPortInfo, resolvePortFile } from './paths.mjs';

export function fetchJson(url, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
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

export function filterAntigravityPages(targets) {
  if (!Array.isArray(targets)) return [];
  return targets.filter((t) => {
    if (!t || t.type !== 'page' || !t.webSocketDebuggerUrl) return false;
    const url = String(t.url || '');
    if (url.startsWith('devtools://') || url.startsWith('chrome-extension://')) return false;
    return url.includes('127.0.0.1') || url.includes('workbench') || url.includes('launchpad');
  });
}

export async function discoverAntigravityPages() {
  const portFile = resolvePortFile();
  const info = getPortInfo();
  if (!info) {
    return { cdpAvailable: false, port: null, portFile, pages: [], reason: `DevToolsActivePort not found at ${portFile}` };
  }
  try {
    const targets = await fetchJson(`http://127.0.0.1:${info.port}/json`);
    const pages = filterAntigravityPages(targets);
    return { cdpAvailable: true, port: info.port, portFile: info.portFile, pages, reason: null };
  } catch (err) {
    return {
      cdpAvailable: false,
      port: info.port,
      portFile: info.portFile,
      pages: [],
      reason: `CDP endpoint on port ${info.port} unreachable: ${err.message}`,
    };
  }
}

export function evaluateOnTarget(wsUrl, expression, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    if (typeof globalThis.WebSocket !== 'function') {
      reject(new Error('Node.js >= 22 with built-in WebSocket is required.'));
      return;
    }
    const ws = new globalThis.WebSocket(wsUrl);
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {
        // ignore
      }
      reject(new Error('CDP evaluation timeout'));
    }, timeoutMs);

    ws.addEventListener('open', () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression, returnByValue: true, awaitPromise: true },
        })
      );
    });

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.id === 1) {
          clearTimeout(timer);
          ws.close();
          if (msg.error) {
            reject(new Error(msg.error.message || 'CDP error'));
          } else if (msg.result && msg.result.exceptionDetails) {
            reject(new Error(msg.result.exceptionDetails.text || 'Runtime exception'));
          } else {
            resolve(msg.result && msg.result.result ? msg.result.result.value : null);
          }
        }
      } catch {
        // ignore malformed frame
      }
    });

    ws.addEventListener('error', (err) => {
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error('WebSocket error'));
    });
  });
}

export async function applyOverridesLive(overrides) {
  const discovery = await discoverAntigravityPages();
  if (!discovery.cdpAvailable) {
    return { ...discovery, appliedCount: 0, totalPages: 0 };
  }
  const serialized = JSON.stringify(overrides || {});
  const expr = `(() => {
    if (typeof window.__ANTIGRAVITY_APPLY_CUSTOM_THEME__ === 'function') {
      window.__ANTIGRAVITY_APPLY_CUSTOM_THEME__(${serialized});
      return true;
    }
    return false;
  })()`;

  let appliedCount = 0;
  for (const page of discovery.pages) {
    try {
      const ok = await evaluateOnTarget(page.webSocketDebuggerUrl, expr);
      if (ok) appliedCount += 1;
    } catch {
      // ignore per-page failure
    }
  }
  return {
    cdpAvailable: true,
    port: discovery.port,
    portFile: discovery.portFile,
    appliedCount,
    totalPages: discovery.pages.length,
  };
}

export async function openThemeModalLive() {
  const discovery = await discoverAntigravityPages();
  if (!discovery.cdpAvailable) {
    return { ...discovery, openedCount: 0, totalPages: 0 };
  }
  const expr = `(() => {
    if (typeof window.__ANTIGRAVITY_OPEN_THEME_MODAL__ === 'function') {
      window.__ANTIGRAVITY_OPEN_THEME_MODAL__();
      return true;
    }
    return false;
  })()`;
  let openedCount = 0;
  for (const page of discovery.pages) {
    try {
      const ok = await evaluateOnTarget(page.webSocketDebuggerUrl, expr);
      if (ok) openedCount += 1;
    } catch {
      // ignore
    }
  }
  return { cdpAvailable: true, port: discovery.port, openedCount, totalPages: discovery.pages.length };
}

export async function removeThemeLive() {
  const discovery = await discoverAntigravityPages();
  if (!discovery.cdpAvailable) {
    return { ...discovery, clearedCount: 0, totalPages: 0 };
  }
  const expr = `(() => {
    if (typeof window.__ANTIGRAVITY_REMOVE_CUSTOM_THEME__ === 'function') {
      window.__ANTIGRAVITY_REMOVE_CUSTOM_THEME__();
      return true;
    }
    return false;
  })()`;
  let clearedCount = 0;
  for (const page of discovery.pages) {
    try {
      const ok = await evaluateOnTarget(page.webSocketDebuggerUrl, expr);
      if (ok) clearedCount += 1;
    } catch {
      // ignore
    }
  }
  return { cdpAvailable: true, port: discovery.port, clearedCount, totalPages: discovery.pages.length };
}

export const INSPECT_EXPR = `(() => {
  const styleEl = document.getElementById('antigravity-custom-theme-active');
  const shellEl = document.querySelector('.agy-shell');
  const projPill = document.querySelector('[data-testid="project-selector-trigger"]');
  const envPill = document.querySelector('[aria-label="Select Environment"]');
  const scrollers = Array.from(document.querySelectorAll('.overflow-y-auto, [data-main-content-body], [data-side-panel-body]'));
  const liveBlurScrollers = scrollers.filter((el) => /blur\\(/i.test(getComputedStyle(el).backdropFilter || ''));
  const shellBackdrop = shellEl ? (getComputedStyle(shellEl).backdropFilter || 'none') : 'none';
  const hasLiveBlurRule = /blur\\(/i.test(shellBackdrop) || liveBlurScrollers.length > 0;
  const prebakedGlassPresent = shellEl ? Boolean(shellEl.style.getPropertyValue('--agy-l-glass-bg')) : false;

  const rootCs = getComputedStyle(document.documentElement);
  const designTokens = {
    bg: rootCs.getPropertyValue('--sakura-bg').trim() || null,
    surface: rootCs.getPropertyValue('--sakura-surface').trim() || null,
    code: rootCs.getPropertyValue('--sakura-code').trim() || null,
    terminal: rootCs.getPropertyValue('--sakura-terminal').trim() || null,
    accent: rootCs.getPropertyValue('--sakura-accent').trim() || null,
  };

  const vigEl = document.getElementById('agy-focus-vignette');
  const vigCs = vigEl ? getComputedStyle(vigEl) : null;
  const focusVignette = {
    present: Boolean(vigEl),
    context: shellEl ? (shellEl.dataset.agyContext || null) : null,
    mode: shellEl ? (shellEl.dataset.agyMode || null) : null,
    enabled: shellEl ? (shellEl.dataset.agyFocusVignette || null) : null,
    pointerEvents: vigCs ? vigCs.pointerEvents : null,
    opacity: vigCs ? vigCs.opacity : null,
  };

  const proseP = document.querySelector('.agy-shell [data-testid="agent-response"] [data-markdown-root] p');
  const proseCs = proseP ? getComputedStyle(proseP) : null;
  const proseMetrics = proseCs ? {
    fontSize: proseCs.fontSize,
    lineHeight: proseCs.lineHeight,
    fontFamily: proseCs.fontFamily,
    color: proseCs.color,
  } : null;

  const codeCard = document.querySelector('.agy-shell [data-testid="agent-response"] pre > div');
  const codeCardCs = codeCard ? getComputedStyle(codeCard) : null;
  const codeBody = codeCard ? codeCard.lastElementChild : null;
  const codeBodyCs = codeBody ? getComputedStyle(codeBody) : null;
  const codeBlockMetrics = codeCardCs ? {
    backgroundColor: codeCardCs.backgroundColor,
    borderRadius: codeCardCs.borderRadius,
    borderColor: codeCardCs.borderColor,
    bodyPadding: codeBodyCs ? codeBodyCs.padding : null,
    bodyOverflowX: codeBodyCs ? codeBodyCs.overflowX : null,
  } : null;

  return {
    url: location.href,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    themeActive: Boolean(styleEl),
    activeTheme: localStorage.getItem('agy_theme_v3') || null,
    shellFound: Boolean(shellEl),
    shellBgImagePresent: shellEl ? getComputedStyle(shellEl).backgroundImage !== 'none' : false,
    prebakedGlassPresent,
    hasBrowserHole: document.body.dataset.hasBrowserHole || null,
    shellHoleActive: shellEl ? shellEl.getAttribute('data-agy-hole-active') : null,
    projectPillBg: projPill ? getComputedStyle(projPill).backgroundColor : null,
    envPillBg: envPill ? getComputedStyle(envPill).backgroundColor : null,
    scrollerCount: scrollers.length,
    liveBlurScrollerCount: liveBlurScrollers.length,
    hasLiveBlurRule,
    settingsTriggerPresent: Boolean(document.getElementById('agy-custom-theme-sidebar-btn')),
    composerPresent: Boolean(document.querySelector('.surface-composer')),
    designTokens,
    focusVignette,
    proseMetrics,
    codeBlockMetrics,
  };
})()`;

export async function verifyCdpLive() {
  const discovery = await discoverAntigravityPages();
  if (!discovery.cdpAvailable) {
    return {
      cdpAvailable: false,
      passed: false,
      port: discovery.port,
      portFile: discovery.portFile,
      failures: [discovery.reason],
      pages: [],
    };
  }
  if (discovery.pages.length === 0) {
    return {
      cdpAvailable: true,
      passed: false,
      port: discovery.port,
      portFile: discovery.portFile,
      failures: [`No Antigravity CDP page targets found on port ${discovery.port}.`],
      pages: [],
    };
  }

  const pages = [];
  for (const page of discovery.pages) {
    const report = await evaluateOnTarget(page.webSocketDebuggerUrl, INSPECT_EXPR);
    pages.push({ id: page.id, title: page.title, ...report });
  }

  const failures = [];
  const themedPages = pages.filter((r) => r.themeActive);
  if (themedPages.length === 0) {
    failures.push('#antigravity-custom-theme-active is not active on any page.');
  }
  if (themedPages.some((r) => r.hasLiveBlurRule)) {
    failures.push('Detected prohibited backdrop-filter blur rule in injected style.');
  }
  if (themedPages.some((r) => r.focusVignette && r.focusVignette.present && r.focusVignette.pointerEvents !== 'none')) {
    failures.push('#agy-focus-vignette must have pointer-events: none.');
  }

  return {
    cdpAvailable: true,
    passed: failures.length === 0,
    port: discovery.port,
    portFile: discovery.portFile,
    themedCount: themedPages.length,
    totalPages: pages.length,
    failures,
    pages,
  };
}
