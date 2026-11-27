# Theme Preset Schema & Antigravity DOM Reference

Built-in presets live in `${PLUGIN_ROOT}/themes/themes.json` (read-only). User custom presets are stored persistently in `${PLUGIN_DATA}/themes/themes.json` and merged on top of built-in presets during compilation (`lib/builder.mjs`).

## Preset Fields

| Key | Type | Required | Purpose |
| :--- | :--- | :--- | :--- |
| `concept` | string | Yes | Short subtitle shown in Theme Studio and the in-shell selector modal |
| `primary` | hex/css color | Yes | Primary accent color (composer focus border, active highlights, accents) |
| `secondary` | hex/css color | Yes | Secondary accent color (paired gradient highlight) |
| `glow` | rgba string | Yes | Primary ambient glow behind active composer / bubbles |
| `secondaryGlow` | rgba string | Yes | Secondary ambient glow |
| `bg` | css background | Yes | User chat bubble gradient/background |
| `frameBg` | css background | Yes | Border/frame gradient around user message / composer frame |
| `textColor` | hex string | Yes | Foreground text inside user bubble (`#f8fafc` recommended on dark) |
| `borderColor` | rgba string | Yes | Subtle border color for composer & interactive cards |
| `innerBorder` | css border | Yes | Inner border shorthand for cards/frames |
| `clearBackdrop` | boolean | Yes | Removes heavy default opaque panels so wallpaper / `pureBg` breathes |
| `overlayRgb` | `"R, G, B"` | Yes | Base RGB triplet for wallpaper tint/scrim and unified glass overlay |
| `bgPosition` | css background-position | Optional | Focal point alignment (`"center center"`, `"center 20%"`, etc.) |
| `pureBg` | css background | Optional | Pure-CSS multi-layer gradient used when `wallpaper` is `""` |
| `wallpaper` | string | Yes | Relative asset path (`"assets/foo.webp"`), `data:` URI, or `""` for CSS-only |
| `sidebarBg` | rgba string | Yes | Left navigation rail tint |
| `sidebarBlur` | string | Optional | Offscreen pre-baked texture blur hint (`syncPrebakedGlass`) — never applied as live CSS `backdrop-filter` |
| `sidebarHoverBg` | rgba string | Yes | Hover highlight on sidebar conversation rows |
| `sidebarEnhanceText` | boolean | Optional | Adds crisp text-shadow contrast boost on bright/detailed wallpapers |
| `aiCardBg` | rgba string | Yes | Scrim over AI response cards & markdown panels |
| `aiCardBorder` | rgba string | Yes | Border tint for AI response cards |
| `headerBg` | rgba string | Yes | Top bar tint matching the L-shaped unified glass frame |
| `headerBlur` | string | Optional | Pre-bake blur hint for top header glass |
| `headerBorder` | rgba string | Yes | Bottom hairline border of the top bar |
| `unifiedGlass` | boolean | Yes | Enables seamless unified L-glass spanning sidebar + top header |
| `btnBg` | rgba string | Yes | Composer pill/button surface (`rgba(15, 30, 58, 0.56)` etc.) |
| `inputGlassBg` | rgba string | Yes | Composer glass backdrop |
| `inputCardBg` | css background | Yes | Composer container gradient |
| `modalBg` | rgba string | Yes | Settings modal surface (`rgba(..., 0.96)` keeps text razor sharp) |
| `modalHeaderBg` | rgba string | Yes | Settings modal header gradient/color |
| `cardBg` | rgba string | Yes | Theme card background inside settings modal |
| `cardSelectedBg` | rgba string | Yes | Active theme card background inside settings modal |
| `isOrnament` | boolean | Optional | True when decorative SVG flourishes (`cornerSvg` / `sticker`) are used |
| `cornerSvg` | string | Optional | Asset path (`"assets/corner.svg"`) or `data:image/svg+xml,...` for corner badges |
| `sticker` | string | Optional | Asset path (`"assets/ornament.svg"`) or `data:image/svg+xml,...` above composer |
| `stickerW`, `stickerH` | number | Optional | Rendered px width & height for `sticker` |
| `stickerTop`, `stickerRight` | number | Optional | Offset px above/right of the composer box |
| `userAvatar` | string | Optional | Circular avatar (`assets/...` or `data:`) rendered next to `[data-testid="user-message"]` |
| `agentAvatar` | string | Optional | Circular avatar (`assets/...` or `data:`) rendered top-left of `[data-testid="agent-response"]` |
| `isLight` | boolean | Optional | Enables Light Mode Glass typography (`#0f172a` ink, frosted light pills, dark window controls) |
| `uiTextColor`, `uiSecondaryColor`, `uiMutedColor` | css color | Optional | Override header/sidebar/body primary, secondary, and muted ink |
| `pillBg`, `pillHoverBg`, `pillTextColor`, `pillBorder` | css color | Optional | Custom styling for composer strip pills (`No Project`, `Local Checkout`, branch trigger) |
| `defaultDimming` | number | Optional | Recommended default wallpaper dim % (e.g. `34` or `62`) |
| `focusVignetteRgb` | `"R, G, B"` | Optional | Base RGB triplet for the soft radial Focus Vignette behind conversation & technical views |
| `composerOnlyMascot` | boolean | Optional | Places the interactive living mascot exclusively above the composer |
| `sidebarActiveBg` | rgba string | Optional | Highlight background for the active sidebar conversation row |
| `refinedSurfaceTokens` | boolean | Optional | Opt-in flag to map centralized `--sakura-*` tokens and native dark-surface, tooltip, terminal, and diff CSS variables |
| `surfaceBg`, `surfaceRaisedBg` | css color | Optional | Primary and raised surface tokens (`--sakura-surface`, `--sakura-surface-raised`) |
| `codeBg`, `codeHeaderBg`, `inlineCodeBg`, `inlineCodeColor` | css color | Optional | Custom surface, header, and text colors for code blocks (`pre`) and inline code pills |
| `terminalBg`, `terminalFg`, `terminalCursor`, `terminalSelection` | css color | Optional | Terminal surface, foreground, cursor accent, and translucent selection highlight |
| `popupBg`, `popupBorder` | css color | Optional | Shared opaque/elevated surface & border for menus, dropdowns, command palette, tooltips, and dialogs |
| `successColor`, `warningColor`, `errorColor`, `infoColor` | css color | Optional | Semantic status accents used in design tokens, tooltips, and terminal/UI indicators |
| `diffAddedBg`, `diffAddedTextBg`, `diffRemovedBg`, `diffRemovedTextBg`, `diffModifiedBg` | css color | Optional | Restrained semantic diff line & inline highlight backgrounds |

## Asset Resolution (`lib/builder.mjs`)

When compiling `${PLUGIN_DATA}/dist/theme_payload.js`:
- Values under `wallpaper`, `sticker`, `cornerSvg`, `userAvatar`, and `agentAvatar` resolve first in `${PLUGIN_DATA}/themes/` and fall back to `${PLUGIN_ROOT}/themes/`.
- `.svg` files become URL-encoded `data:image/svg+xml,...`.
- `.mp4` / `.webm` videos `> 3 MiB` resolve to `__AGY_MEDIA__/assets/<filename>` and stream with HTTP `206 Partial Content` Range support from the local media server on `127.0.0.1`.
- Raster images (`.png`, `.jpg`, `.jpeg`, `.webp`) embed directly when compact WebP/GIF, or auto-downscale to max `2560px` (`256px` for avatars) as WebP when Python + Pillow is installed.
- Leave `wallpaper` as `""` and supply `pureBg` for zero-image gradient presets (e.g. `Midnight Obsidian`).

## Antigravity UI Targets Handled by `engine/core.js`

- **Root Shell:** `.agy-shell` receives wallpaper/pureBg framing with `data-agy-hole-active="1"` + `clip-path: polygon(evenodd, ...)` whenever Antigravity opens the split embedded browser (`body[data-has-browser-hole="true"]`).
- **Pre-baked Glass:** Offscreen canvas generates blurred sidebar/header strips only when theme/wallpaper/dimensions change, avoiding per-frame `backdrop-filter: blur(...)` scroll jank.
- **Composer Top Strip Pills:** `[data-testid="project-selector-trigger"]`, `[aria-label="Select Environment"]`, `[data-testid="branch-pill-trigger"]` receive high-contrast frosted badges.
- **Settings Entry & Persistence:** Sidebar trigger `#agy-custom-theme-sidebar-btn` opens the in-shell customizer modal; choices persist via CDP binding `agySaveThemeConfig` -> `${PLUGIN_DATA}/theme_config.json`.
