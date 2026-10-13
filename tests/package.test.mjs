import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const bundle = await readFile(new URL('../dist/hoverbridge.browser.js', import.meta.url), 'utf8');

test('the ESM main entry imports without window or document', async () => {
  const api = await import('../dist/index.js');
  assert.equal(typeof api.IntentTracker, 'function');
  assert.equal(typeof api.createHoverBridge, 'function');
});
test('the auto entry is SSR-safe', async () => {
  const api = await import('../dist/auto.js');
  assert.deepEqual(api.start().controllers, []);
});
test('the classic bundle loads without a DOM', () => {
  const context = {}; runInNewContext(bundle, context);
  assert.equal(typeof context.HoverBridge.IntentTracker, 'function');
});
test('the classic bundle does not overwrite an existing global', () => {
  const sentinel = {}; const context = { HoverBridge: sentinel };
  runInNewContext(bundle, context); assert.equal(context.HoverBridge, sentinel);
});
test('there are no runtime dependencies', () => {
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
});
test('every package export points to an emitted file', async () => {
  for (const target of Object.values(pkg.exports)) {
    for (const path of typeof target === 'string' ? [target] : Object.values(target)) await access(new URL(`../${path}`, import.meta.url));
  }
});
test('browser code needs neither eval nor dynamically compiled functions', () => {
  assert.doesNotMatch(bundle, /\beval\s*\(|\bnew\s+Function\s*\(/);
});
test('browser code contains no network or storage API calls', () => {
  assert.doesNotMatch(bundle, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|document\.cookie/);
});
