#!/usr/bin/env node
import { ThemeDaemon } from '../lib/daemon-core.mjs';
import { parseCliArgs, resolvePluginPaths } from '../lib/paths.mjs';

if (typeof globalThis.WebSocket !== 'function') {
  console.error('[theme-daemon] Node.js >= 22 with built-in WebSocket is required.');
  process.exit(1);
}

const cli = parseCliArgs(process.argv.slice(2));
const paths = resolvePluginPaths({ rootDir: cli.rootDir, dataDir: cli.dataDir });
const exitOnClose = Boolean(cli.exitOnClose || process.env.AGY_EXIT_ON_CLOSE === '1');

const daemon = new ThemeDaemon(paths, {
  embedded: false,
  exitOnClose,
  managePid: true,
  logToStdout: Boolean(process.stdout.isTTY || process.env.AGY_DAEMON_STDOUT === '1'),
  onShutdown: () => process.exit(0),
});

process.on('SIGINT', () => daemon.stop('SIGINT'));
process.on('SIGTERM', () => daemon.stop('SIGTERM'));
process.on('exit', () => daemon.removePidLock());

const res = await daemon.start();
if (!res.started) {
  process.exit(0);
}
