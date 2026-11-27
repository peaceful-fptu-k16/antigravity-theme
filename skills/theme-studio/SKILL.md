---
name: theme-studio
description: >-
  Design, customize, switch, verify, or troubleshoot visual glassmorphic themes,
  4K live wallpapers, palettes, mascots, and avatars via Theme Studio MCP tools.
  Use when the user asks to change themes, create a custom theme from an image
  or aesthetic mood, open Theme Studio, or troubleshoot CDP theming.
---

# Theme Studio

Design and apply 60fps Zero-Live-Blur glassmorphic themes (wallpapers, 4K video loops, cohesive color tokens, custom ornaments, avatars, and split-browser-safe overlays) without modifying Electron binaries.

## Bundled MCP Tools (`theme-studio_studio`)

Prefer the plugin's MCP tools over manual shell edits so user themes and runtime payloads persist safely inside `${PLUGIN_DATA}` across plugin updates:

- `open_studio` — Open the interactive **Theme Studio** UI panel (also available in the side pane `+` menu and left sidebar).
- `theme_status` — Inspect active theme config, CDP port availability, daemon attachment, payload freshness, and installed presets.
- `theme_list_presets` — List built-in presets (`Sakura Midnight`, `WLOP Cosmic`, `Midnight Obsidian`) and user custom presets.
- `theme_apply` — Switch active theme or adjust `workspaceMode` (`focus` | `balanced` | `immersive`), `dimming`, `glassBlur`, `accentOverride`, `wpEnabled`, `focusVignette`, `zenMode`, `reducedMotion`, `inputStyle`, `chatOpacity`, or `bubbleName`.
- `theme_create_preset` — Validate and persist a new custom preset into `${PLUGIN_DATA}/themes/themes.json`, optionally stage local image/SVG/video assets into `${PLUGIN_DATA}/themes/assets/`, compile `dist/theme_payload.js`, and hot-reload open windows.
- `theme_delete_preset` — Delete a user custom preset (built-in presets are immutable).
- `theme_build_payload` — Recompile built-in + custom presets with `engine/core.js` and syntax-check the bundle.
- `theme_verify_cdp` — Run live non-destructive CDP verification (`themeActive`, `hasLiveBlurRule: false`, pre-baked glass, split-browser hole cutout, vignette `pointer-events: none`).
- `theme_reset` — Strip live custom theme layers from open windows (and optionally reset `theme_config.json`).
- `theme_daemon_control` — Start, stop, restart, reinject, or open the in-shell settings modal.

## Workflow: Creating a Custom Theme

1. **Gather aesthetic & inspect media**
   - Ask at most one brief clarifying question if the mood (dark glass, light glass, neon cyberpunk, cozy warm, pure-CSS gradient) is ambiguous.
   - If the user supplies a wallpaper image with an unwanted watermark, crop/clean it before staging.
2. **Design cohesive palette tokens**
   - Read [references/theme-schema.md](references/theme-schema.md) for every required and optional preset field.
   - Extract dominant and accent colors to populate `primary`, `secondary`, `overlayRgb`, `bg`, `frameBg`, `sidebarBg`, `aiCardBg`, `headerBg`, `inputCardBg`, and `modalBg` with crisp WCAG-friendly readability.
   - For bright/pastel/daytime wallpapers, set `"isLight": true` with dark ink (`uiTextColor`, `pillTextColor`) and light frosted cards.
   - Populate `refinedSurfaceTokens: true` plus `codeBg`, `terminalBg`, `popupBg`, and semantic status/diff colors for complete IDE/App parity.
3. **Save, stage assets, compile, and activate**
   - Call `theme_create_preset` with `name`, `preset`, optional `stageAssets` (local file paths for `wallpaper`, `sticker`, `cornerSvg`, `userAvatar`, `agentAvatar`), and `activate: true`.
   - Never hardcode personal absolute OS paths inside `preset` fields; pass local file paths via `stageAssets` so they are copied into `${PLUGIN_DATA}/themes/assets/`.
4. **Verify live via CDP**
   - Call `theme_verify_cdp`.
   - Confirm `passed: true`, `themeActive: true`, and `hasLiveBlurRule: false`.
   - If CDP is inactive (`DevToolsActivePort` missing), guide the user through the CDP setup section below.

## Troubleshooting: CDP Inactive / Theme Disappeared After Update

Antigravity v2.33.0+ only creates `DevToolsActivePort` when launched with `--remote-debugging-port=0`, and auto-updates relaunch without shortcut flags:

- **Windows:** Run `powershell -ExecutionPolicy Bypass -File "<plugin-root>/scripts/install-win.ps1"` (wraps shortcuts with an On-Demand launcher, zero Windows Startup entries; pass `-Startup` for always-on). Fully quit Antigravity via System Tray -> **Quit**, then reopen from Start Menu.
- **macOS / Linux:** Launch with `--remote-debugging-port=0` (e.g. `open -a Antigravity --args --remote-debugging-port=0` on macOS, or add it to `Exec=` in your `.desktop` file on Linux), or run `bash "<plugin-root>/scripts/install-unix.sh"`.
- **Clean removal of standalone launchers & live styles:** Run `node "<plugin-root>/scripts/uninstall.mjs"` (or call `theme_reset`).
