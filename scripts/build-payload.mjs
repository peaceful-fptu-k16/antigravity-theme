#!/usr/bin/env node
import { buildPayload } from '../lib/builder.mjs';
import { parseCliArgs, resolvePluginPaths } from '../lib/paths.mjs';

const cli = parseCliArgs(process.argv.slice(2));
if (cli.help) {
  console.log('Usage: node scripts/build-payload.mjs [--root-dir <dir>] [--data-dir <dir>] [--out <file>] [--max-dim <px>]');
  process.exit(0);
}

const paths = resolvePluginPaths({ rootDir: cli.rootDir, dataDir: cli.dataDir });
const result = buildPayload(paths, {
  outPath: cli.out,
  maxDim: cli.maxDim,
});

for (const warn of result.warnings) {
  console.warn(`[build-payload] Warning: ${warn}`);
}

console.log(
  `[build-payload] Built ${result.outPath} (${result.sizeKB} KB) with ${result.themeCount} theme(s) [${result.builtinCount} built-in, ${result.customCount} custom]: ${result.themes.join(', ')}`
);
