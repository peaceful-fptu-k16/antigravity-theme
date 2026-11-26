# Antigravity Custom Theme Skill

Turn any wallpaper, aesthetic mood, or color palette into a live, 60fps custom theme inside **Antigravity** — packaged as both a standalone cross-platform CDP theme engine and a drop-in **AI Agent Skill** (`SKILL.md`).

> Give your AI agent an image + vibe ("cosmic violin gold on deep midnight", "cozy Kyoto matcha", "cyberpunk neon cyan"), and let it extract the palette, stage assets, compile the payload, and hot-reload your Antigravity UI cleanly without touching Electron app binaries.

## Features

- **Zero Live Blur Architecture (60fps Scroll):** Uses pre-baked offscreen canvas glass (`syncPrebakedGlass`) and gradient scrims instead of CSS `backdrop-filter: blur()`, preventing Electron/GPU scroll lag.
- **Unified L-Glass + Split-Browser Safe:** Automatically detects Antigravity's split embedded Chromium view (`data-has-browser-hole`) and cuts an `evenodd` `clip-path` window so embedded pages never get tinted or blurred.
- **Live Settings Modal:** Switch presets, upload custom wallpapers or **User / AI Agent circular avatars** (auto-compressed WebP), adjust scrim darkness, and persist choices to `theme_config.json`.
- **Light & Dark Glass Modes:** Supports both deep dark themes and daytime bright palettes (`isLight: true`) with adaptive ink, frosted pills, and titlebar controls.
- **Three Built-In Presets Included (default: `Sakura Midnight`):**
  - `Sakura Midnight` — 4K Magical Sakura Tree seamless Dual-Video Crossfade Loop (`themes/assets/magical_sakura_4k.mp4`), Midnight Plum 92% cards, Living Sakura Kitsune mascot (`idle` / `thinking` / `success` + petal burst), Adaptive Workspace Modes (`Focus` / `Balanced` / `Immersive`), and Zen Mode (`Ctrl+Shift+Z`)
  - `WLOP Cosmic` — 2K starlight wallpaper + custom SVG flourishes (`themes/assets/wlop_cosmic_2k.webp`)
  - `Midnight Obsidian` — Ultra-light zero-image pure-CSS gradient preset
- **4K Live Video & GIF Streaming:** Local HTTP Range (`206 Partial Content`) media server inside `daemon/theme_daemon.js` streams large 4K `.mp4`/`.webm` wallpapers on `127.0.0.1` without bloating `dist/theme_payload.js`, paired with GPU Dual-Video Crossfade looping for zero-stutter transitions.
- **Data/Engine Separation:** Add your own themes solely inside `themes/themes.json` + `themes/assets/` and compile via `scripts/build_payload.py`.
- **Cross-Platform Daemon (`daemon/theme_daemon.js`):** Windows, macOS, and Linux support using Node >= 22 built-in `WebSocket` (supports `--exit-on-close` On-Demand mode).

## Prerequisites

- **Antigravity** running with CDP debugging port active (`DevToolsActivePort`)
- **Node.js >= 22** (uses native `globalThis.WebSocket`, zero `npm install` needed)
- **Python 3.9+** (optional `Pillow` package recommended for auto-compressing large >2K wallpapers into WebP)

## Quick Start

### 1. Build the Runtime Payload

```bash
python scripts/build_payload.py
```

This resolves `themes/themes.json` + `themes/assets/*` and compiles them with `engine/core.js` into gitignored `dist/theme_payload.js`.

### 2. Install & Run the Daemon

**Windows (PowerShell):**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-win.ps1
```

By default, this installs the **On-Demand Launcher** (no Windows Startup entry, zero background process when Antigravity is closed): it wraps your `Antigravity.lnk` shortcuts (Desktop / Start Menu / Taskbar) via a generated hidden `launch-antigravity.vbs` that launches `Antigravity.exe --remote-debugging-port=0` together with `theme_daemon.js --exit-on-close`, so the daemon starts automatically whenever you open Antigravity and exits automatically once Antigravity closes. Pass `-Startup` if you prefer the legacy always-on Windows Startup daemon, or `-NoStartup` to run only for the current session.

**macOS / Linux (Bash):**

```bash
bash scripts/install-unix.sh
```

- On **macOS**, installs a `~/Library/LaunchAgents/io.antigravity.custom-theme.plist` LaunchAgent.
- On **Linux**, installs a `systemd --user` service (or falls back to `nohup`).
- Use `bash scripts/install-unix.sh --foreground` to run interactively in your terminal, `node daemon/theme_daemon.js --exit-on-close` for on-demand single-session use, or `stop` / `status`.

> **Platform Testing Note:** Windows (`install-win.ps1`, CDP hot-reload, uninstall) has been verified live against Antigravity on Windows 11. macOS (`launchd`) and Linux (`systemd --user`) scripts are implemented and shell-syntax verified, and welcome community runtime feedback across macOS/Linux setups (you can override `DevToolsActivePort` location anytime via `AGY_PORT_FILE=/path/to/DevToolsActivePort`).

### 3. Verify Live via CDP

```bash
node scripts/verify_cdp.js
```

### 4. Uninstall Cleanly

```bash
node scripts/uninstall.js
```

Removes auto-start shortcuts/services, stops the background daemon, and immediately restores Antigravity's default styling on open windows.

## Troubleshooting: Theme Disappeared After an Antigravity Update

Starting with **Antigravity v2.33.0+**, Antigravity no longer creates `DevToolsActivePort` by default unless launched with `--remote-debugging-port=0`, and the built-in auto-updater restarts `Antigravity.exe --updated` without shortcut flags.

- **Windows:**
  1. Re-run `powershell -ExecutionPolicy Bypass -File scripts/install-win.ps1` (it automatically patches `--remote-debugging-port=0` onto your `Antigravity.lnk` shortcuts in Start Menu, Desktop, Startup, and Taskbar).
  2. **Quit Antigravity completely** (right-click the System Tray icon -> **Quit**) and reopen it from the **Start Menu**.
  3. If you use a **Taskbar pin**, **Unpin** the old icon and re-pin it from the Start Menu `Antigravity` shortcut so the `--remote-debugging-port=0` flag is preserved.
- **macOS / Linux:**
  - Start Antigravity with `--remote-debugging-port=0` (`open -a Antigravity --args --remote-debugging-port=0` on macOS, or append `--remote-debugging-port=0` to the `Exec=` command in your `.desktop` entry on Linux).

## Use as an Antigravity Skill (`SKILL.md`)

Copy or clone this repository into either:

- **Global skill directory:** `~/.gemini/config/skills/antigravity-custom-theme/`
- **Workspace skill directory:** `.agents/skills/antigravity-custom-theme/`

Once installed, simply prompt your Antigravity agent with an image and aesthetic preference (e.g., *"Use `antigravity-custom-theme` to build me a dark emerald studio Ghibli theme from this image"*). The agent reads `SKILL.md` + `references/theme-schema.md`, creates your preset in `themes/`, builds `dist/theme_payload.js`, and verifies it via `verify_cdp.js`.

## Repository Structure

```text
antigravity-custom-theme-skill/
├── SKILL.md                    # Agent skill definition & workflow
├── README.md
├── LICENSE                     # MIT
├── references/
│   └── theme-schema.md         # themes.json schema & DOM notes
├── themes/
│   ├── themes.json             # Sample theme presets
│   └── assets/                 # Wallpapers & SVG stickers/corners
├── engine/
│   └── core.js                 # Core injection engine (Zero Live Blur + UI)
├── daemon/
│   └── theme_daemon.js         # Cross-platform CDP injector & config persistence
├── scripts/
│   ├── build_payload.py        # Compiles themes.json + core.js -> dist/theme_payload.js
│   ├── install-win.ps1         # Windows Startup launcher setup
│   ├── install-unix.sh         # macOS LaunchAgent / Linux systemd user setup
│   ├── uninstall.js            # Clean cross-platform removal
│   └── verify_cdp.js           # Live CDP diagnostic & assertion check
└── dist/                       # Gitignored compiled runtime output
```

## License

MIT
