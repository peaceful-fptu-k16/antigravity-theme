#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="${PLUGIN_DATA:-${AGY_THEME_DATA_DIR:-$HOME/.gemini/antigravity/plugin_data/theme-studio}}"
mkdir -p "$DATA_DIR"

DAEMON_JS="$PLUGIN_ROOT/scripts/theme-daemon.mjs"
BUILD_JS="$PLUGIN_ROOT/scripts/build-payload.mjs"
PID_FILE="$DATA_DIR/daemon.pid"
LOG_FILE="$DATA_DIR/daemon.log"

SERVICE_LABEL="io.antigravity.custom-theme"
SYSTEMD_UNIT="antigravity-custom-theme.service"

find_node() {
    if ! command -v node >/dev/null 2>&1; then
        echo "[install-unix] Error: Node.js not found in PATH. Install Node.js >= 22." >&2
        exit 1
    fi
    local node_bin
    node_bin="$(command -v node)"
    local major
    major="$("$node_bin" -p "process.versions.node.split('.')[0]")"
    if [ "$major" -lt 22 ]; then
        echo "[install-unix] Error: Node.js >= 22 is required (found v$major at $node_bin)." >&2
        exit 1
    fi
    printf '%s\n' "$node_bin"
}

ensure_payload() {
    local node_bin="$1"
    echo "[install-unix] Building runtime payload into $DATA_DIR/dist/theme_payload.js..."
    "$node_bin" "$BUILD_JS" --root-dir "$PLUGIN_ROOT" --data-dir "$DATA_DIR"
}

stop_existing_pid() {
    if [ -f "$PID_FILE" ]; then
        local old_pid
        old_pid="$(tr -d '[:space:]' < "$PID_FILE" || true)"
        if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
            echo "[install-unix] Stopping existing daemon (PID $old_pid)..."
            kill "$old_pid" 2>/dev/null || true
            sleep 0.4
        fi
        rm -f "$PID_FILE"
    fi
}

install_macos() {
    local node_bin="$1"
    local plist_dir="$HOME/Library/LaunchAgents"
    local plist_path="$plist_dir/$SERVICE_LABEL.plist"
    mkdir -p "$plist_dir"

    cat > "$plist_path" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$SERVICE_LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$node_bin</string>
        <string>$DAEMON_JS</string>
        <string>--root-dir</string>
        <string>$PLUGIN_ROOT</string>
        <string>--data-dir</string>
        <string>$DATA_DIR</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$PLUGIN_ROOT</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_FILE</string>
    <key>StandardErrorPath</key>
    <string>$LOG_FILE</string>
</dict>
</plist>
EOF

    local uid_num
    uid_num="$(id -u)"
    launchctl bootout "gui/$uid_num/$SERVICE_LABEL" >/dev/null 2>&1 || launchctl unload "$plist_path" >/dev/null 2>&1 || true
    if launchctl bootstrap "gui/$uid_num" "$plist_path" >/dev/null 2>&1; then
        echo "[install-unix] LaunchAgent loaded via bootstrap: $plist_path"
    else
        launchctl load -w "$plist_path"
        echo "[install-unix] LaunchAgent loaded: $plist_path"
    fi
}

install_linux() {
    local node_bin="$1"
    if command -v systemctl >/dev/null 2>&1 && systemctl --user status >/dev/null 2>&1; then
        local unit_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
        local unit_path="$unit_dir/$SYSTEMD_UNIT"
        mkdir -p "$unit_dir"

        cat > "$unit_path" <<EOF
[Unit]
Description=Theme Studio CDP Daemon
After=graphical-session.target

[Service]
Type=simple
WorkingDirectory="$PLUGIN_ROOT"
ExecStart="$node_bin" "$DAEMON_JS" --root-dir "$PLUGIN_ROOT" --data-dir "$DATA_DIR"
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

        systemctl --user daemon-reload
        systemctl --user enable --now "$SYSTEMD_UNIT"
        echo "[install-unix] systemd user service active: $unit_path"
    else
        echo "[install-unix] systemd --user unavailable; starting background process with nohup."
        nohup "$node_bin" "$DAEMON_JS" --root-dir "$PLUGIN_ROOT" --data-dir "$DATA_DIR" >> "$LOG_FILE" 2>&1 &
        echo "[install-unix] Daemon started (PID $!). Logs: $LOG_FILE"
    fi
}

cmd="${1:-install}"
case "$cmd" in
    --foreground|foreground|run)
        NODE_BIN="$(find_node)"
        ensure_payload "$NODE_BIN"
        stop_existing_pid
        exec "$NODE_BIN" "$DAEMON_JS" --root-dir "$PLUGIN_ROOT" --data-dir "$DATA_DIR"
        ;;
    stop)
        if [ "$(uname -s)" = "Darwin" ]; then
            launchctl bootout "gui/$(id -u)/$SERVICE_LABEL" >/dev/null 2>&1 || true
        elif command -v systemctl >/dev/null 2>&1; then
            systemctl --user stop "$SYSTEMD_UNIT" >/dev/null 2>&1 || true
        fi
        stop_existing_pid
        echo "[install-unix] Stopped."
        ;;
    status)
        if [ -f "$PID_FILE" ]; then
            pid="$(tr -d '[:space:]' < "$PID_FILE" || true)"
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                echo "[install-unix] Running (PID $pid)"
                exit 0
            fi
        fi
        echo "[install-unix] Not running."
        exit 1
        ;;
    install)
        NODE_BIN="$(find_node)"
        ensure_payload "$NODE_BIN"
        stop_existing_pid
        OS_NAME="$(uname -s)"
        case "$OS_NAME" in
            Darwin) install_macos "$NODE_BIN" ;;
            Linux)  install_linux "$NODE_BIN" ;;
            *)
                echo "[install-unix] Unsupported OS '$OS_NAME' for auto-start; running in background."
                nohup "$NODE_BIN" "$DAEMON_JS" --root-dir "$PLUGIN_ROOT" --data-dir "$DATA_DIR" >> "$LOG_FILE" 2>&1 &
                ;;
        esac
        ;;
    *)
        echo "Usage: $0 [install|--foreground|stop|status]" >&2
        exit 2
        ;;
esac
