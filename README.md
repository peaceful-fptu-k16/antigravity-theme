# Theme Studio — Antigravity Plugin

Turn any wallpaper, 4K live video loop, aesthetic mood, or color palette into a live 60fps glassmorphic theme inside **Antigravity** — packaged as a native **Antigravity Plugin** with an interactive **MCP App UI**, zero-dependency Node.js MCP server, `/theme-studio` skill, `theme-designer` custom agent, and architectural guardrails.

## What This Plugin Bundles

| Component | Path | What It Provides |
| :--- | :--- | :--- |
| **Plugin Manifest** | `plugin.json` | Native Antigravity plugin metadata, SVG icon (`assets/logo.svg`), and 3 starter prompt chips. |
| **MCP Server + App UI** | `mcp_config.json`, `scripts/mcp-server.mjs`, `assets/studio-app.html` | Pure Node.js (>= 22) stdio MCP server (`theme-studio_studio`) exposing 10 theme management tools, an embedded CDP injector + HTTP Range 4K video server, and the **Theme Studio** UI panel in the side pane (`+`) and left sidebar. |
| **Skill** | `skills/theme-studio/SKILL.md` | `/theme-studio` slash command + full schema reference (`references/theme-schema.md`). |
| **Custom Agent** | `agents/theme-designer.md` | Dedicated `theme-designer` primary/subagent specialized in crafting cohesive glassmorphic themes. |
| **Rule** | `rules/theme-architecture.md` | Model-decision guardrails enforcing Zero Live Blur, Split-Browser Cutout, and Data-Only authoring. |
| **Built-In Presets (63)** | `themes/themes.json`, `themes/assets/` | 3 flagship presets (`Sakura Midnight` 4K video + living kitsune, `WLOP Cosmic` 2K art, `Midnight Obsidian`) + **60 verified iconic developer themes** (Catppuccin, Tokyo Night, Rosé Pine, Kanagawa, Everforest, Nord, Gruvbox, Solarized, GitHub Primer, Ayu, One Dark/Light, Flexoki, Nightfox, Dracula, Monokai Pro, SynthWave '84, Vesper, Oxocarbon, Poimandres, Cobalt2, Aura, Cyberdream, Eldritch, etc. — 51 Dark + 12 Light Glass) with custom SVG corner ornaments. |

## Prerequisites

- **Node.js >= 22** (uses native `globalThis.WebSocket`, zero `npm install` needed at runtime)
- **Antigravity launched with `--remote-debugging-port=0`** for live Electron shell injection (`DevToolsActivePort`)
- Optional: **Python 3 + Pillow** for automatic >2K raster downscaling and WebP compression when adding large custom wallpapers (pure Node.js fallback works without Python)

## Installation

### From Local Folder or GitHub (Antigravity CLI)

```bash
# Validate the plugin bundle
agy plugin validate --strict .

# Install from this local repository
agy plugin install .

# Or install directly from GitHub
agy plugin install https://github.com/peaceful-fptu-k16/antigravity-theme

# Verify installation
agy plugin list
```

### Manual Global / Workspace Install

- **Global:** Copy this folder to `~/.gemini/config/plugins/theme-studio/`
- **Workspace:** Copy this folder to `.agents/plugins/theme-studio/`

All user config (`theme_config.json`), custom presets (`themes/themes.json`), staged custom assets (`themes/assets/`), compiled payloads (`dist/theme_payload.js`), and logs live in persistent `${PLUGIN_DATA}` so plugin updates never overwrite your themes.

## Usage

### 1. Open Theme Studio UI

- Open **Theme Studio** from the left sidebar or the side pane **`+`** menu, or ask the agent to call `open_studio`.
- Switch presets, tune Workspace Mode (`Focus` / `Balanced` / `Immersive`), dimming, pre-baked glass blur, accent overrides, Focus Vignette, Zen Mode (`Ctrl+Shift+Z`), and Reduced Motion live.

### 2. Design Custom Themes with the Agent

- Invoke `/theme-studio` in chat or select the `theme-designer` agent (`agy --agent theme-designer`).
- Give the agent a wallpaper image or mood (e.g., *"Create a dark emerald Kyoto night glass theme and activate it"*). It uses `theme_create_preset` to validate tokens, stage assets into `${PLUGIN_DATA}`, compile `theme_payload.js`, hot-reload live windows, and run `theme_verify_cdp`.

### 3. Enable Live Shell Injection (`--remote-debugging-port=0`)

Starting with **Antigravity v2.33.0+**, Antigravity only opens `DevToolsActivePort` when started with `--remote-debugging-port=0`.

- **Windows (On-Demand Launcher — zero Windows Startup entries):**
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/install-win.ps1
  ```
  Quit Antigravity completely (**System Tray -> Quit**) and reopen from the Start Menu or Desktop. Pass `-Startup` for always-on OS startup.
- **macOS / Linux:**
  ```bash
  bash scripts/install-unix.sh
  ```
  Launch Antigravity with `--remote-debugging-port=0` (`open -a Antigravity --args --remote-debugging-port=0` on macOS, or add it to `Exec=` in your `.desktop` entry on Linux).

### 4. Standalone CLI & Tests

```bash
# Compile payload manually (pure Node.js)
node scripts/build-payload.mjs

# Verify live CDP injection & Zero-Live-Blur compliance
node scripts/verify-cdp.mjs

# Remove standalone OS launchers, stop daemon, and strip live styles
node scripts/uninstall.mjs

# Rebuild the bundled Studio MCP App HTML (dev only, requires bun)
node scripts/build-studio-ui.mjs

# Run automated test suite
node --test test/plugin.test.mjs
```

## Architecture Highlights

- **Zero Live Blur (60fps Scroll):** Pre-bakes blurred sidebar/header strips onto offscreen `<canvas>` instead of applying CSS `backdrop-filter: blur(...)` to scrollable panes.
- **Split-Browser Safe Cutout:** Detects `body[data-has-browser-hole="true"]` and applies an `evenodd` `clip-path` window so embedded Chromium views stay sharp and untinted.
- **4K HTTP Range Streaming:** Serves built-in (`${PLUGIN_ROOT}/themes/assets`) and user (`${PLUGIN_DATA}/themes/assets`) `.mp4`/`.webm` wallpapers over `127.0.0.1` with `206 Partial Content` streaming and GPU dual-video crossfade looping.
- **Read-Only Plugin Safe:** Separates immutable plugin files (`${PLUGIN_ROOT}`) from mutable user state (`${PLUGIN_DATA}`).

## License

MIT
