import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ensureDataDirs, readJsonSafe, writeJsonAtomic, writeTextAtomic } from './paths.mjs';

export const ASSET_KEYS = ['wallpaper', 'sticker', 'cornerSvg', 'userAvatar', 'agentAvatar'];
export const AVATAR_KEYS = new Set(['userAvatar', 'agentAvatar']);
export const AVATAR_MAX_DIM = 256;
export const DEFAULT_MAX_DIM = 2560;
export const PLACEHOLDER = '/*__THEMES_PLACEHOLDER__*/{}';

export const REQUIRED_THEME_KEYS = [
  'concept',
  'primary',
  'secondary',
  'glow',
  'secondaryGlow',
  'bg',
  'frameBg',
  'textColor',
  'borderColor',
  'innerBorder',
  'clearBackdrop',
  'overlayRgb',
  'wallpaper',
  'sidebarBg',
  'sidebarHoverBg',
  'aiCardBg',
  'aiCardBorder',
  'headerBg',
  'headerBorder',
  'unifiedGlass',
  'btnBg',
  'inputGlassBg',
  'inputCardBg',
  'modalBg',
  'modalHeaderBg',
  'cardBg',
  'cardSelectedBg',
];

const MIME_BY_EXT = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

const PILLOW_COMPRESS_SCRIPT = `
import base64, io, sys
from pathlib import Path
from PIL import Image, ImageOps

img_path = Path(sys.argv[1])
max_dim = int(sys.argv[2])

with Image.open(img_path) as img:
    is_animated = bool(getattr(img, "is_animated", False)) and getattr(img, "n_frames", 1) > 1
    if is_animated:
        raw = img_path.read_bytes()
        ext = img_path.suffix.lower()
        if ext == ".gif" and len(raw) <= 6 * 1024 * 1024:
            sys.stdout.write("data:image/gif;base64," + base64.b64encode(raw).decode("ascii"))
            raise SystemExit(0)
        if ext == ".webp" and len(raw) <= 6 * 1024 * 1024:
            sys.stdout.write("data:image/webp;base64," + base64.b64encode(raw).decode("ascii"))
            raise SystemExit(0)
        frames, durations = [], []
        w, h = img.size
        longest = max(w, h)
        target_max = min(max_dim, 1600) if max_dim > 0 else 1600
        scale = (target_max / float(longest)) if longest > target_max else 1.0
        new_size = (max(1, int(round(w * scale))), max(1, int(round(h * scale))))
        resample = getattr(getattr(Image, "Resampling", Image), "LANCZOS")
        for idx in range(getattr(img, "n_frames", 1)):
            img.seek(idx)
            fr = img.convert("RGBA")
            if scale < 1.0:
                fr = fr.resize(new_size, resample)
            frames.append(fr)
            durations.append(int(img.info.get("duration", 60) or 60))
        buf = io.BytesIO()
        frames[0].save(
            buf, format="WEBP", save_all=True, append_images=frames[1:],
            duration=durations, loop=int(img.info.get("loop", 0) or 0), quality=80, method=4
        )
        sys.stdout.write("data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii"))
        raise SystemExit(0)

    img = ImageOps.exif_transpose(img)
    has_alpha = img.mode in ("RGBA", "LA", "PA") or (img.mode == "P" and "transparency" in img.info)
    img = img.convert("RGBA" if has_alpha else "RGB")
    w, h = img.size
    longest = max(w, h)
    if max_dim > 0 and longest > max_dim:
        scale = max_dim / float(longest)
        new_size = (max(1, int(round(w * scale))), max(1, int(round(h * scale))))
        resample = getattr(getattr(Image, "Resampling", Image), "LANCZOS")
        img = img.resize(new_size, resample)
    if img_path.suffix.lower() == ".webp" and longest <= max_dim:
        raw = img_path.read_bytes()
        if len(raw) <= 1.2 * 1024 * 1024:
            sys.stdout.write("data:image/webp;base64," + base64.b64encode(raw).decode("ascii"))
            raise SystemExit(0)
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=88, method=4)
    sys.stdout.write("data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii"))
`;

let cachedPythonCmd = undefined;

function detectPythonWithPillow() {
  if (cachedPythonCmd !== undefined) return cachedPythonCmd;
  const candidates = process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python'];
  for (const cmd of candidates) {
    try {
      const args = cmd === 'py' ? ['-3', '-c', 'import PIL'] : ['-c', 'import PIL'];
      execFileSync(cmd, args, { stdio: 'ignore', timeout: 4000 });
      cachedPythonCmd = cmd === 'py' ? ['py', '-3'] : [cmd];
      return cachedPythonCmd;
    } catch {
      // Try next candidate
    }
  }
  cachedPythonCmd = null;
  return null;
}

function encodeSvg(svgPath) {
  const svgText = fs.readFileSync(svgPath, 'utf8');
  return 'data:image/svg+xml,' + encodeURIComponent(svgText);
}

function encodeRaster(imgPath, maxDim, warnings) {
  const ext = path.extname(imgPath).toLowerCase();
  const stat = fs.statSync(imgPath);

  // Fast pure-Node path for already compact WebP/GIF assets
  if (ext === '.webp' && maxDim >= DEFAULT_MAX_DIM && stat.size <= 1.2 * 1024 * 1024) {
    return `data:image/webp;base64,${fs.readFileSync(imgPath).toString('base64')}`;
  }
  if (ext === '.gif' && stat.size <= 6 * 1024 * 1024) {
    return `data:image/gif;base64,${fs.readFileSync(imgPath).toString('base64')}`;
  }

  // Optional Pillow compression when available (handles EXIF, downscaling >2560px / avatars <=256px, WebP encoding)
  const py = detectPythonWithPillow();
  if (py) {
    try {
      const [bin, ...prefix] = py;
      const out = execFileSync(bin, [...prefix, '-c', PILLOW_COMPRESS_SCRIPT, imgPath, String(maxDim)], {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        timeout: 20000,
      });
      if (out && out.startsWith('data:image/')) {
        return out.trim();
      }
    } catch (err) {
      warnings.push(`Pillow compression fallback for ${path.basename(imgPath)}: ${err.message}`);
    }
  }

  const raw = fs.readFileSync(imgPath);
  const mime = MIME_BY_EXT[ext] || 'image/png';
  if (raw.length > 2 * 1024 * 1024) {
    warnings.push(
      `Embedded uncompressed ${path.basename(imgPath)} (${Math.round(raw.length / 1024)} KB); install Python Pillow for automatic 2K WebP compression.`
    );
  }
  return `data:${mime};base64,${raw.toString('base64')}`;
}

function resolveLocalAssetPath(trimmed, searchDirs) {
  if (path.isAbsolute(trimmed)) {
    return fs.existsSync(trimmed) ? { fullPath: trimmed, baseDir: path.dirname(trimmed) } : null;
  }
  for (const dir of searchDirs) {
    if (!dir) continue;
    const candidate = path.resolve(dir, trimmed);
    const resolvedDir = path.resolve(dir);
    if (
      (candidate === resolvedDir || candidate.startsWith(resolvedDir + path.sep)) &&
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile()
    ) {
      return { fullPath: candidate, baseDir: resolvedDir };
    }
  }
  return null;
}

export function resolveAssetValue(value, searchDirs, maxDim, warnings = []) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('__AGY_MEDIA__/')
  ) {
    return trimmed;
  }

  const located = resolveLocalAssetPath(trimmed, searchDirs);
  if (!located) {
    throw new Error(`Theme asset not found: ${trimmed} (searched: ${searchDirs.join(', ')})`);
  }

  const { fullPath, baseDir } = located;
  const ext = path.extname(fullPath).toLowerCase();
  if (ext === '.svg') {
    return encodeSvg(fullPath);
  }
  if (ext === '.mp4' || ext === '.webm') {
    const sizeBytes = fs.statSync(fullPath).size;
    if (sizeBytes > 3 * 1024 * 1024) {
      const relPosix = path.relative(baseDir, fullPath).split(path.sep).join('/');
      const normalized = relPosix.startsWith('assets/') ? relPosix : `assets/${path.basename(fullPath)}`;
      return `__AGY_MEDIA__/${normalized}`;
    }
    const mime = ext === '.mp4' ? 'video/mp4' : 'video/webm';
    return `data:${mime};base64,${fs.readFileSync(fullPath).toString('base64')}`;
  }
  return encodeRaster(fullPath, maxDim, warnings);
}

export function loadBuiltinThemes(paths) {
  if (!fs.existsSync(paths.builtinThemesFile)) {
    throw new Error(`Built-in themes.json not found: ${paths.builtinThemesFile}`);
  }
  const parsed = readJsonSafe(paths.builtinThemesFile, null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid built-in themes.json at ${paths.builtinThemesFile}`);
  }
  return parsed;
}

export function loadUserThemes(paths) {
  if (!fs.existsSync(paths.userThemesFile)) return {};
  const parsed = readJsonSafe(paths.userThemesFile, {});
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed;
}

export function loadMergedThemes(paths) {
  const builtin = loadBuiltinThemes(paths);
  const user = loadUserThemes(paths);
  const merged = { ...builtin, ...user };
  const sources = {};
  for (const name of Object.keys(builtin)) {
    sources[name] = Object.prototype.hasOwnProperty.call(user, name) ? 'custom-override' : 'builtin';
  }
  for (const name of Object.keys(user)) {
    if (!Object.prototype.hasOwnProperty.call(builtin, name)) {
      sources[name] = 'custom';
    }
  }
  return { builtin, user, merged, sources };
}

export function validateThemePreset(name, cfg) {
  const errors = [];
  const warnings = [];
  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('Preset name must be a non-empty string.');
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    errors.push('Preset definition must be a JSON object.');
    return { valid: false, errors, warnings };
  }
  for (const key of REQUIRED_THEME_KEYS) {
    if (cfg[key] === undefined || cfg[key] === null) {
      errors.push(`Missing required preset field: ${key}`);
    }
  }
  if (cfg.overlayRgb && !/^\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*$/.test(String(cfg.overlayRgb))) {
    errors.push(`overlayRgb must be an "R, G, B" triplet (got: ${cfg.overlayRgb})`);
  }
  if (cfg.wallpaper === '' && !cfg.pureBg) {
    warnings.push('wallpaper is empty and pureBg is not set; background may look bare.');
  }
  for (const key of ASSET_KEYS) {
    if (typeof cfg[key] === 'string' && /^([a-zA-Z]:\\|\/Users\/|\/home\/)/.test(cfg[key].trim())) {
      warnings.push(`Field "${key}" contains a personal absolute path; stage assets into themes/assets/ instead.`);
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function saveUserThemePreset(paths, name, preset, { stageAssetFiles = {} } = {}) {
  ensureDataDirs(paths);
  const cleanedName = String(name || '').trim();
  const copy = { ...preset };

  // Optional asset staging from local source files into persistent PLUGIN_DATA/themes/assets/
  for (const [fieldKey, srcFile] of Object.entries(stageAssetFiles)) {
    if (!ASSET_KEYS.includes(fieldKey) || !srcFile) continue;
    const resolvedSrc = path.resolve(String(srcFile));
    if (!fs.existsSync(resolvedSrc) || !fs.statSync(resolvedSrc).isFile()) {
      throw new Error(`Asset source file for ${fieldKey} not found: ${resolvedSrc}`);
    }
    const slug = cleanedName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'custom';
    const ext = path.extname(resolvedSrc).toLowerCase() || '.webp';
    const destName = `${slug}_${fieldKey.toLowerCase()}${ext}`;
    const destPath = path.join(paths.userAssetsDir, destName);
    fs.copyFileSync(resolvedSrc, destPath);
    copy[fieldKey] = `assets/${destName}`;
  }

  const validation = validateThemePreset(cleanedName, copy);
  if (!validation.valid) {
    throw new Error(`Invalid theme preset "${cleanedName}": ${validation.errors.join('; ')}`);
  }

  const userThemes = loadUserThemes(paths);
  userThemes[cleanedName] = copy;
  writeJsonAtomic(paths.userThemesFile, userThemes);

  return { name: cleanedName, preset: copy, warnings: validation.warnings };
}

export function deleteUserThemePreset(paths, name) {
  const userThemes = loadUserThemes(paths);
  if (!Object.prototype.hasOwnProperty.call(userThemes, name)) {
    return { deleted: false, reason: 'Preset not found in user custom themes (built-in presets are read-only).' };
  }
  delete userThemes[name];
  writeJsonAtomic(paths.userThemesFile, userThemes);
  return { deleted: true, name };
}

export function isPayloadStale(paths) {
  if (!fs.existsSync(paths.payloadFile)) return true;
  try {
    const outMtime = fs.statSync(paths.payloadFile).mtimeMs;
    const inputs = [paths.builtinThemesFile, paths.engineCoreFile];
    if (fs.existsSync(paths.userThemesFile)) inputs.push(paths.userThemesFile);
    for (const file of inputs) {
      if (fs.existsSync(file) && fs.statSync(file).mtimeMs > outMtime) {
        return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

export function buildPayload(paths, options = {}) {
  ensureDataDirs(paths);
  const maxDim = Number.isFinite(options.maxDim) && options.maxDim > 0 ? options.maxDim : DEFAULT_MAX_DIM;
  const outPath = options.outPath ? path.resolve(options.outPath) : paths.payloadFile;

  if (!fs.existsSync(paths.engineCoreFile)) {
    throw new Error(`Engine core.js not found: ${paths.engineCoreFile}`);
  }

  const { builtin, user, merged } = loadMergedThemes(paths);
  const themeNames = Object.keys(merged);
  if (themeNames.length === 0) {
    throw new Error('No theme presets found in built-in or user themes.json.');
  }

  const warnings = [];
  const searchDirs = [paths.userThemesDir, paths.builtinThemesDir];
  const resolvedThemes = {};

  for (const [name, cfg] of Object.entries(merged)) {
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
      throw new Error(`Theme "${name}" must be a JSON object.`);
    }
    const copied = { ...cfg };
    for (const key of ASSET_KEYS) {
      if (Object.prototype.hasOwnProperty.call(copied, key)) {
        const targetDim = AVATAR_KEYS.has(key) ? Math.min(maxDim, AVATAR_MAX_DIM) : maxDim;
        copied[key] = resolveAssetValue(copied[key], searchDirs, targetDim, warnings);
      }
    }
    resolvedThemes[name] = copied;
  }

  const engineSrc = fs.readFileSync(paths.engineCoreFile, 'utf8');
  const occurrences = engineSrc.split(PLACEHOLDER).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected exactly 1 '${PLACEHOLDER}' placeholder in ${paths.engineCoreFile}, found ${occurrences}.`);
  }

  const themesJson = JSON.stringify(resolvedThemes);
  const compiled = engineSrc.replace(PLACEHOLDER, () => themesJson);

  // Verify compiled payload parses cleanly as JavaScript before writing
  new vm.Script(compiled, { filename: 'theme_payload.js' });

  writeTextAtomic(outPath, compiled);
  const sizeBytes = fs.statSync(outPath).size;

  return {
    outPath,
    sizeBytes,
    sizeKB: Number((sizeBytes / 1024).toFixed(1)),
    themeCount: themeNames.length,
    builtinCount: Object.keys(builtin).length,
    customCount: Object.keys(user).length,
    themes: themeNames,
    warnings,
  };
}
