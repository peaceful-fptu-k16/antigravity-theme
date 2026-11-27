---
trigger: model_decision
description: Architectural guardrails when designing, modifying, or debugging Antigravity visual themes, theme presets, or engine/core.js.
---

# Theme Engine Architectural Guardrails

- **Zero Live Blur:** Never add CSS `backdrop-filter: blur(...)` to `.agy-shell`, `.agy-chat-frame`, or any scrollable container. Electron scroll performance degrades severely under live blur; rely on `engine/core.js`'s offscreen `syncPrebakedGlass` canvas baking instead.
- **Split-Browser Hole Cutout:** Never paint opaque overlays over the embedded Chromium browser pane. Preserve `data-has-browser-hole`, `data-agy-hole-active`, and `evenodd` `clip-path` cutouts so split browser pages stay sharp and untinted.
- **Data-Only Theme Authoring:** Store user presets and assets in `${PLUGIN_DATA}/themes/` via `theme_create_preset` rather than mutating `${PLUGIN_ROOT}` or editing `engine/core.js` unless upstream Antigravity DOM selectors changed.
- **No Personal Path Leakage:** Never write absolute personal OS paths (`C:\Users\...`, `/Users/...`, `/home/...`) into `themes.json`, scripts, or committed files.
- **Focus Vignette Click-Through:** `#agy-focus-vignette` must always keep `pointer-events: none`.
