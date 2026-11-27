#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { removeThemeLive } from '../lib/cdp.mjs';
import { stopExternalDaemon } from '../lib/daemon-core.mjs';
import { parseCliArgs, resolvePluginPaths } from '../lib/paths.mjs';

const cli = parseCliArgs(process.argv.slice(2));
const paths = resolvePluginPaths({ rootDir: cli.rootDir, dataDir: cli.dataDir });

function restoreWindowsShortcuts(stateFile) {
  if (!fs.existsSync(stateFile)) return;
  try {
    const psScript = [
      "$ErrorActionPreference = 'Stop'",
      `$state = Get-Content -Path '${stateFile.replace(/'/g, "''")}' -Raw -Encoding UTF8 | ConvertFrom-Json`,
      '$ws = New-Object -ComObject WScript.Shell',
      'foreach ($entry in @($state.shortcuts)) {',
      '  if ($entry.shortcutPath -and (Test-Path $entry.shortcutPath) -and $entry.targetPath) {',
      '    $sc = $ws.CreateShortcut($entry.shortcutPath)',
      '    $sc.TargetPath = [string]$entry.targetPath',
      '    $sc.Arguments = [string]$entry.arguments',
      '    if ($entry.workingDirectory) { $sc.WorkingDirectory = [string]$entry.workingDirectory }',
      '    if ($entry.iconLocation) { $sc.IconLocation = [string]$entry.iconLocation }',
      '    if ($entry.description) { $sc.Description = [string]$entry.description }',
      '    $sc.Save()',
      '    Write-Host ("[uninstall] Restored shortcut: " + $entry.shortcutPath)',
      '  }',
      '}',
      'foreach ($createdPath in @($state.createdShortcuts)) {',
      '  if ($createdPath -and (Test-Path $createdPath)) {',
      '    Remove-Item -Path $createdPath -Force -ErrorAction SilentlyContinue',
      '    Write-Host ("[uninstall] Removed custom shortcut: " + $createdPath)',
      '  }',
      '}',
    ].join('\n');
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { stdio: 'inherit' });
  } catch (err) {
    console.warn(`[uninstall] Could not restore shortcuts automatically: ${err.message}`);
  }
  try {
    fs.unlinkSync(stateFile);
    console.log(`[uninstall] Removed launcher state: ${stateFile}`);
  } catch {
    // ignore
  }
}

function removeFileIfExists(filePath, label) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`[uninstall] Removed ${label}: ${filePath}`);
  }
}

function removeAutoStart() {
  if (process.platform === 'win32') {
    restoreWindowsShortcuts(paths.launcherStateFile);
    restoreWindowsShortcuts(path.join(paths.pluginRoot, 'launcher_state.json'));

    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    removeFileIfExists(
      path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'AntigravityCustomTheme.lnk'),
      'Windows Startup shortcut'
    );
    removeFileIfExists(
      path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Antigravity (Custom Theme).lnk'),
      'Start Menu shortcut'
    );
    removeFileIfExists(paths.silentVbsFile, 'helper script');
    removeFileIfExists(paths.launcherVbsFile, 'on-demand launcher');
    removeFileIfExists(path.join(paths.pluginRoot, 'silent-start.vbs'), 'legacy helper script');
    removeFileIfExists(path.join(paths.pluginRoot, 'launch-antigravity.vbs'), 'legacy launcher');
    return;
  }

  if (process.platform === 'darwin') {
    const label = 'io.antigravity.custom-theme';
    const plist = path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
    try {
      execSync(`launchctl bootout gui/$(id -u)/${label}`, { stdio: 'ignore' });
    } catch {
      try {
        if (fs.existsSync(plist)) execSync(`launchctl unload "${plist}"`, { stdio: 'ignore' });
      } catch {
        // ignore
      }
    }
    removeFileIfExists(plist, 'LaunchAgent plist');
    return;
  }

  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const unitName = 'antigravity-custom-theme.service';
  const unitPath = path.join(xdg, 'systemd', 'user', unitName);
  try {
    execSync(`systemctl --user disable --now ${unitName}`, { stdio: 'ignore' });
  } catch {
    // ignore
  }
  if (fs.existsSync(unitPath)) {
    fs.unlinkSync(unitPath);
    try {
      execSync('systemctl --user daemon-reload', { stdio: 'ignore' });
    } catch {
      // ignore
    }
    console.log(`[uninstall] Removed systemd user unit: ${unitPath}`);
  }
}

async function main() {
  removeAutoStart();

  const stopped = stopExternalDaemon(paths);
  if (stopped.stopped) {
    console.log(`[uninstall] Stopped daemon PID ${stopped.pid}.`);
  } else {
    console.log('[uninstall] No active standalone daemon.pid found.');
  }

  // Also check legacy PID file at plugin root
  const legacyPidFile = path.join(paths.pluginRoot, 'daemon.pid');
  if (legacyPidFile !== paths.pidFile && fs.existsSync(legacyPidFile)) {
    const legacyPid = Number.parseInt(fs.readFileSync(legacyPidFile, 'utf8').trim(), 10);
    if (legacyPid) {
      try {
        process.kill(legacyPid, 'SIGTERM');
        console.log(`[uninstall] Stopped legacy daemon PID ${legacyPid}.`);
      } catch {
        // already stopped
      }
    }
    try {
      fs.unlinkSync(legacyPidFile);
    } catch {
      // ignore
    }
  }

  const live = await removeThemeLive();
  if (live.cdpAvailable) {
    console.log(`[uninstall] Cleared theme from ${live.clearedCount}/${live.totalPages} open page(s).`);
  } else {
    console.log(`[uninstall] CDP cleanup skipped (${live.reason}).`);
  }

  console.log('[uninstall] Done. Theme Studio daemon and live styles removed.');
}

main();
