import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PLUGIN_NAME = 'theme-studio';

export function parseCliArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--data-dir' || token === '--data_dir') {
      args.dataDir = argv[++i];
    } else if (token.startsWith('--data-dir=')) {
      args.dataDir = token.slice('--data-dir='.length);
    } else if (token.startsWith('--data_dir=')) {
      args.dataDir = token.slice('--data_dir='.length);
    } else if (token === '--root-dir') {
      args.rootDir = argv[++i];
    } else if (token.startsWith('--root-dir=')) {
      args.rootDir = token.slice('--root-dir='.length);
    } else if (token === '--out') {
      args.out = argv[++i];
    } else if (token.startsWith('--out=')) {
      args.out = token.slice('--out='.length);
    } else if (token === '--max-dim') {
      args.maxDim = Number(argv[++i]);
    } else if (token.startsWith('--max-dim=')) {
      args.maxDim = Number(token.slice('--max-dim='.length));
    } else if (token === '--exit-on-close') {
      args.exitOnClose = true;
    } else if (token === '--no-daemon') {
      args.noDaemon = true;
    } else if (token === '--json') {
      args.json = true;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      args._.push(token);
    }
  }
  return args;
}

export function getDefaultDataDir() {
  const home = os.homedir();
  return path.join(home, '.gemini', 'antigravity', 'plugin_data', PLUGIN_NAME);
}

export function resolvePluginPaths(options = {}) {
  const pluginRoot = path.resolve(
    options.rootDir || process.env.PLUGIN_ROOT || path.resolve(__dirname, '..')
  );
  const dataDir = path.resolve(
    options.dataDir ||
      process.env.PLUGIN_DATA ||
      process.env.AGY_THEME_DATA_DIR ||
      getDefaultDataDir()
  );

  const builtinThemesDir = path.join(pluginRoot, 'themes');
  const userThemesDir = path.join(dataDir, 'themes');
  const distDir = path.join(dataDir, 'dist');

  return {
    pluginRoot,
    dataDir,
    builtinThemesDir,
    builtinThemesFile: path.join(builtinThemesDir, 'themes.json'),
    builtinAssetsDir: path.join(builtinThemesDir, 'assets'),
    engineCoreFile: path.join(pluginRoot, 'engine', 'core.js'),
    studioHtmlFile: path.join(pluginRoot, 'assets', 'studio-app.html'),
    userThemesDir,
    userThemesFile: path.join(userThemesDir, 'themes.json'),
    userAssetsDir: path.join(userThemesDir, 'assets'),
    distDir,
    payloadFile: path.join(distDir, 'theme_payload.js'),
    configFile: process.env.AGY_CONFIG_PATH || path.join(dataDir, 'theme_config.json'),
    pidFile: path.join(dataDir, 'daemon.pid'),
    logFile: path.join(dataDir, 'daemon.log'),
    launcherVbsFile: path.join(dataDir, 'launch-antigravity.vbs'),
    silentVbsFile: path.join(dataDir, 'silent-start.vbs'),
    launcherStateFile: path.join(dataDir, 'launcher_state.json'),
  };
}

export function ensureDataDirs(paths) {
  for (const dir of [paths.dataDir, paths.userThemesDir, paths.userAssetsDir, paths.distDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function resolvePortFile() {
  if (process.env.AGY_PORT_FILE) {
    return process.env.AGY_PORT_FILE;
  }

  const home = os.homedir();
  let candidates;
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    candidates = [
      path.join(appData, 'antigravity', 'DevToolsActivePort'),
      path.join(appData, 'Antigravity', 'DevToolsActivePort'),
    ];
  } else if (process.platform === 'darwin') {
    const appSupport = path.join(home, 'Library', 'Application Support');
    candidates = [
      path.join(appSupport, 'antigravity', 'DevToolsActivePort'),
      path.join(appSupport, 'Antigravity', 'DevToolsActivePort'),
    ];
  } else {
    const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    candidates = [
      path.join(xdgConfig, 'antigravity', 'DevToolsActivePort'),
      path.join(xdgConfig, 'Antigravity', 'DevToolsActivePort'),
    ];
  }

  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

export function getPortInfo() {
  const portFile = resolvePortFile();
  if (!fs.existsSync(portFile)) return null;
  try {
    const lines = fs
      .readFileSync(portFile, 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const port = Number.parseInt(lines[0], 10);
    if (!Number.isFinite(port) || port <= 0) return null;
    return { port, token: lines[1] || '', portFile };
  } catch {
    return null;
  }
}

export function readJsonSafe(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return structuredClone(fallback);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    // Fall through to fallback
  }
  return structuredClone(fallback);
}

export function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpFile = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpFile, filePath);
}

export function writeTextAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpFile = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpFile, content, 'utf8');
  fs.renameSync(tmpFile, filePath);
}

export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readActiveDaemonPid(paths) {
  try {
    if (!fs.existsSync(paths.pidFile)) return null;
    const pid = Number.parseInt(fs.readFileSync(paths.pidFile, 'utf8').trim(), 10);
    if (isPidAlive(pid)) return pid;
    return null;
  } catch {
    return null;
  }
}
