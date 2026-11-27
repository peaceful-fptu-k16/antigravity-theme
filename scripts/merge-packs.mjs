#!/usr/bin/env node
/**
 * Assembles themes/themes.json by preserving the 3 flagship bundled presets
 * ("Sakura Midnight", "WLOP Cosmic", "Midnight Obsidian") verbatim and merging
 * the 6 curated theme packs in deterministic order:
 *   pastel, japan, arctic, classic, neon, minimal
 *
 * Validates every preset with validateThemePreset(), verifies all referenced
 * asset files exist under themes/, checks SVG XML well-formedness & safety,
 * and rejects duplicate theme names or personal OS path leaks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_KEYS, validateThemePreset } from '../lib/builder.mjs';
import { parseCliArgs, writeJsonAtomic } from '../lib/paths.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const FLAGSHIP_NAMES = ['Sakura Midnight', 'WLOP Cosmic', 'Midnight Obsidian'];
export const PACK_ORDER = ['pastel', 'japan', 'arctic', 'classic', 'neon', 'minimal'];
export const EXPECTED_THEMES_PER_PACK = 10;

const ALLOWED_XML_NS = new Set([
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/XML/1998/namespace',
]);

const PERSONAL_PATH_RE = /([A-Za-z]:\\Users\\|\/Users\/|\/home\/)/;

export function validateSvgXml(svgText, label = 'svg') {
  const errors = [];
  if (typeof svgText !== 'string' || !svgText.trim()) {
    return [`${label}: empty SVG content`];
  }

  if (/<script[\s>]/i.test(svgText)) {
    errors.push(`${label}: contains forbidden <script> element`);
  }
  if (/<foreignObject[\s>]/i.test(svgText)) {
    errors.push(`${label}: contains forbidden <foreignObject> element`);
  }
  if (/\son[a-z]+\s*=/i.test(svgText)) {
    errors.push(`${label}: contains forbidden inline event handler attribute`);
  }

  const urls = svgText.match(/https?:\/\/[^\s"'<>)]+/gi) || [];
  for (const url of urls) {
    if (!ALLOWED_XML_NS.has(url)) {
      errors.push(`${label}: contains forbidden external URL "${url}"`);
    }
  }

  // Strip BOM, XML declaration, comments, and CDATA for structural XML verification
  const stripped = svgText
    .replace(/^\uFEFF/, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .trim();

  if (!stripped.startsWith('<svg') || !stripped.endsWith('</svg>')) {
    errors.push(`${label}: root element must start with <svg and end with </svg>`);
    return errors;
  }

  const stack = [];
  let rootCount = 0;
  let rootHasViewBox = false;
  const tagRe = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[^<>]*?)?)(\/?)>/g;
  let lastIndex = 0;
  let match;

  while ((match = tagRe.exec(stripped)) !== null) {
    const between = stripped.slice(lastIndex, match.index);
    if (between.includes('<') || between.includes('>')) {
      errors.push(`${label}: unescaped angle bracket in text content near offset ${lastIndex}`);
      break;
    }
    lastIndex = tagRe.lastIndex;

    const [, closingSlash, tagName, rawAttrs, selfCloseSlash] = match;
    if (closingSlash && selfCloseSlash) {
      errors.push(`${label}: malformed tag </${tagName}/>`);
      break;
    }

    if (closingSlash) {
      if (rawAttrs.trim()) {
        errors.push(`${label}: unexpected attributes on closing tag </${tagName}>`);
        break;
      }
      const expected = stack.pop();
      if (expected !== tagName) {
        errors.push(`${label}: mismatched closing tag </${tagName}> (expected </${expected || 'EOF'}>)`);
        break;
      }
      continue;
    }

    // Validate attribute syntax (all values must be properly quoted)
    const attrText = rawAttrs.trim();
    if (attrText) {
      const remainder = attrText.replace(
        /[A-Za-z_][\w:.-]*\s*=\s*(?:"[^"]*"|'[^']*')/g,
        ''
      ).trim();
      if (remainder.length > 0) {
        errors.push(`${label}: malformed attribute syntax in <${tagName}>: "${remainder.slice(0, 60)}"`);
        break;
      }
    }

    if (stack.length === 0) {
      rootCount += 1;
      if (tagName !== 'svg') {
        errors.push(`${label}: root element is <${tagName}>, expected <svg>`);
        break;
      }
      rootHasViewBox = /\bviewBox\s*=\s*(?:"[^"]+"|'[^']+')/.test(attrText);
    }

    if (!selfCloseSlash) {
      stack.push(tagName);
    }
  }

  const trailing = stripped.slice(lastIndex);
  if (trailing.includes('<') || trailing.includes('>')) {
    errors.push(`${label}: unclosed tag or stray angle bracket near end of document`);
  }
  if (stack.length > 0) {
    errors.push(`${label}: unclosed XML element(s): ${stack.join(', ')}`);
  }
  if (rootCount !== 1) {
    errors.push(`${label}: expected exactly 1 root <svg> element, found ${rootCount}`);
  }
  if (!rootHasViewBox) {
    errors.push(`${label}: root <svg> is missing viewBox attribute`);
  }

  return errors;
}

function isRemoteOrDataAsset(val) {
  return (
    val.startsWith('data:') ||
    val.startsWith('http://') ||
    val.startsWith('https://') ||
    val.startsWith('__AGY_MEDIA__/')
  );
}

export function mergeThemePacks({
  rootDir = path.resolve(__dirname, '..'),
  checkOnly = false,
} = {}) {
  const themesDir = path.join(rootDir, 'themes');
  const themesFile = path.join(themesDir, 'themes.json');
  const packsDir = path.join(themesDir, 'packs');

  if (!fs.existsSync(themesFile)) {
    throw new Error(`Existing themes.json not found at ${themesFile} (required for flagship presets).`);
  }

  const existing = JSON.parse(fs.readFileSync(themesFile, 'utf8'));
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    throw new Error(`Invalid JSON object in ${themesFile}`);
  }

  const merged = {};
  const errors = [];
  const packCounts = {};
  const bespokeAssetOwners = new Map();

  // 1. Preserve the 3 flagship presets verbatim
  for (const name of FLAGSHIP_NAMES) {
    if (!Object.prototype.hasOwnProperty.call(existing, name)) {
      errors.push(`Missing flagship preset "${name}" in ${themesFile}`);
      continue;
    }
    merged[name] = existing[name];
  }

  // 2. Load and merge all 6 packs in deterministic order
  for (const packName of PACK_ORDER) {
    const packPath = path.join(packsDir, `${packName}.json`);
    if (!fs.existsSync(packPath)) {
      errors.push(`Missing theme pack file: themes/packs/${packName}.json`);
      continue;
    }

    let packData;
    try {
      packData = JSON.parse(fs.readFileSync(packPath, 'utf8'));
    } catch (err) {
      errors.push(`Failed parsing themes/packs/${packName}.json: ${err.message}`);
      continue;
    }

    if (!packData || typeof packData !== 'object' || Array.isArray(packData)) {
      errors.push(`themes/packs/${packName}.json must export a JSON object keyed by theme name.`);
      continue;
    }

    const entries = Object.entries(packData);
    packCounts[packName] = entries.length;
    if (entries.length !== EXPECTED_THEMES_PER_PACK) {
      errors.push(
        `themes/packs/${packName}.json has ${entries.length} theme(s), expected ${EXPECTED_THEMES_PER_PACK}.`
      );
    }

    for (const [name, cfg] of entries) {
      if (Object.prototype.hasOwnProperty.call(merged, name)) {
        errors.push(`Duplicate theme preset "${name}" found in pack "${packName}".`);
        continue;
      }
      merged[name] = cfg;
    }
  }

  // 3. Validate every preset + verify every referenced asset file under themes/
  const resolvedThemesDir = path.resolve(themesDir);
  const flagshipSet = new Set(FLAGSHIP_NAMES);
  let darkCount = 0;
  let lightCount = 0;
  let svgAssetCount = 0;
  const validatedSvgs = new Set();

  for (const [name, cfg] of Object.entries(merged)) {
    const check = validateThemePreset(name, cfg);
    if (!check.valid) {
      for (const e of check.errors) errors.push(`[${name}] ${e}`);
    }
    if (check.warnings.length > 0) {
      for (const w of check.warnings) errors.push(`[${name}] Warning: ${w}`);
    }

    if (cfg && typeof cfg === 'object') {
      if (cfg.isLight) lightCount += 1;
      else darkCount += 1;
    }

    const isFlagship = flagshipSet.has(name);
    if (!isFlagship && cfg?.refinedSurfaceTokens !== true) {
      errors.push(`[${name}] Non-flagship preset must set refinedSurfaceTokens: true`);
    }

    for (const key of ASSET_KEYS) {
      const rawVal = cfg?.[key];
      const trimmed = typeof rawVal === 'string' ? rawVal.trim() : '';

      if (!isFlagship) {
        if (!trimmed) {
          errors.push(`[${name}] Missing required bespoke SVG field "${key}"`);
          continue;
        }
        if (!trimmed.toLowerCase().endsWith('.svg')) {
          errors.push(`[${name}] Bespoke field "${key}" must reference an .svg file (got "${trimmed}")`);
          continue;
        }
        if (bespokeAssetOwners.has(trimmed)) {
          errors.push(
            `[${name}] Recycled SVG asset "${trimmed}" for "${key}" (already used by "${bespokeAssetOwners.get(trimmed)}")`
          );
        } else {
          bespokeAssetOwners.set(trimmed, `${name}.${key}`);
        }
      }

      if (!trimmed || isRemoteOrDataAsset(trimmed)) continue;

      if (path.isAbsolute(trimmed)) {
        errors.push(`[${name}] Asset "${key}" must be a relative path under themes/ (got "${trimmed}")`);
        continue;
      }

      const fullPath = path.resolve(themesDir, trimmed);
      if (!fullPath.startsWith(resolvedThemesDir + path.sep)) {
        errors.push(`[${name}] Asset "${key}" escapes themes/ directory: "${trimmed}"`);
        continue;
      }

      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
        errors.push(`[${name}] Referenced asset missing for "${key}": themes/${trimmed}`);
        continue;
      }

      if (fullPath.toLowerCase().endsWith('.svg') && !validatedSvgs.has(fullPath)) {
        validatedSvgs.add(fullPath);
        svgAssetCount += 1;
        const svgContent = fs.readFileSync(fullPath, 'utf8');
        const svgErrs = validateSvgXml(svgContent, `themes/${trimmed}`);
        for (const se of svgErrs) errors.push(`[${name}] ${se}`);
      }
    }
  }

  const serialized = JSON.stringify(merged, null, 2);
  if (PERSONAL_PATH_RE.test(serialized)) {
    errors.push('Merged themes.json contains a personal absolute OS path leak.');
  }

  const totalCount = Object.keys(merged).length;
  const expectedTotal = FLAGSHIP_NAMES.length + PACK_ORDER.length * EXPECTED_THEMES_PER_PACK;
  if (totalCount !== expectedTotal) {
    errors.push(`Expected ${expectedTotal} total themes after merge, got ${totalCount}.`);
  }

  if (errors.length > 0) {
    const err = new Error(`Theme pack merge validation failed with ${errors.length} issue(s):\n- ${errors.join('\n- ')}`);
    err.validationErrors = errors;
    throw err;
  }

  if (!checkOnly) {
    writeJsonAtomic(themesFile, merged);
  }

  return {
    themesFile,
    totalCount,
    flagshipCount: FLAGSHIP_NAMES.length,
    packThemeCount: totalCount - FLAGSHIP_NAMES.length,
    darkCount,
    lightCount,
    svgAssetCount,
    bespokeSvgCount: bespokeAssetOwners.size,
    packCounts,
    wroteFile: !checkOnly,
  };
}

// Run when invoked directly via CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const cli = parseCliArgs(process.argv.slice(2));
  const checkOnly = process.argv.includes('--check') || process.argv.includes('--dry-run');
  try {
    const res = mergeThemePacks({
      rootDir: cli.rootDir || path.resolve(__dirname, '..'),
      checkOnly,
    });
    const modeLabel = checkOnly ? 'Validated (dry-run)' : 'Merged & wrote';
    console.log(
      `[merge-packs] ${modeLabel} ${res.totalCount} themes (${res.flagshipCount} flagship + ${res.packThemeCount} pack themes; ${res.darkCount} dark, ${res.lightCount} light; ${res.bespokeSvgCount} unique bespoke SVGs) -> ${res.themesFile}`
    );
  } catch (err) {
    console.error(`[merge-packs] ${err.message}`);
    process.exit(1);
  }
}
