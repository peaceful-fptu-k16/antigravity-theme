#!/usr/bin/env node
import { verifyCdpLive } from '../lib/cdp.mjs';

if (typeof globalThis.WebSocket !== 'function') {
  console.error('[verify-cdp] Node.js >= 22 is required.');
  process.exit(1);
}

const report = await verifyCdpLive();
console.log(JSON.stringify(report, null, 2));

if (!report.passed) {
  for (const failure of report.failures) {
    console.error(`[verify-cdp] FAIL: ${failure}`);
  }
  process.exit(1);
}

console.log(`[verify-cdp] PASS: ${report.themedCount}/${report.totalPages} page(s) themed with zero live blur.`);
