#!/usr/bin/env node
/**
 * Compiles ui/studio.js + ui/studio.css + @modelcontextprotocol/ext-apps into a
 * single self-contained CSP-safe HTML file at assets/studio-app.html.
 * Uses an isolated temp directory for installing the build-only SDK dependency so
 * the plugin repository stays free of node_modules.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const cssPath = path.join(ROOT_DIR, 'ui', 'studio.css');
const entryPath = path.join(ROOT_DIR, 'ui', 'studio.js');
const outHtmlPath = path.join(ROOT_DIR, 'assets', 'studio-app.html');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-studio-ui-build-'));

try {
  const pkg = {
    name: 'theme-studio-ui-build',
    private: true,
    type: 'module',
    dependencies: {
      '@modelcontextprotocol/ext-apps': '^2.0.0',
    },
  };
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg, null, 2));
  fs.copyFileSync(entryPath, path.join(tmpDir, 'studio.js'));

  const bunCmd = process.platform === 'win32' ? 'bun.exe' : 'bun';
  execFileSync(bunCmd, ['install'], { cwd: tmpDir, stdio: 'inherit' });
  const bundledJs = execFileSync(
    bunCmd,
    ['build', 'studio.js', '--target=browser', '--format=esm', '--minify'],
    { cwd: tmpDir, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );

  const css = fs.readFileSync(cssPath, 'utf8');
  const safeJs = bundledJs.replace(/<\/script/gi, '<\\/script');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Theme Studio</title>
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<script type="module">
${safeJs}
</script>
</body>
</html>
`;

  fs.mkdirSync(path.dirname(outHtmlPath), { recursive: true });
  fs.writeFileSync(outHtmlPath, html, 'utf8');
  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`[build-studio-ui] Built ${outHtmlPath} (${kb} KB)`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
