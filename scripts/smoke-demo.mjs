import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
const requested = process.argv[2] === '--exported'
  ? resolve(root, `hoverbridge-playground-v${version}.html`)
  : process.argv[2] ?? resolve(root, 'demo/index.html');
const path = resolve(requested);
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path).href);
  await page.locator('#components-trigger').hover();
  assert.equal(await page.locator('#components').isVisible(), true);
  await page.locator('#buffer').evaluate(input => {
    input.value = '14';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await page.locator('#buffer-value').textContent(), '14 px');
  await page.locator('#protection').click();
  assert.equal(await page.locator('#protection').getAttribute('aria-pressed'), 'false');
  await page.locator('#debug').click();
  assert.equal(await page.locator('#debug').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(errors, []);
  console.log(`Demo smoke passed: ${version}, ${browser.version()}, ${path}`);
} finally { await browser.close(); }
