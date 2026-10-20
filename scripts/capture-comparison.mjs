// Requires ffmpeg on PATH. Records the real demo; no recreated menu or timing claim.
import { chromium } from 'playwright-core';
import { createPreviewServer } from './serve.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const temporary = await mkdtemp(join(tmpdir(), 'hoverbridge-capture-'));
const server = createPreviewServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 },
    recordVideo: { dir: temporary, size: { width: 1280, height: 900 } } });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/demo/`);
  await page.waitForFunction(() => !!window.hoverBridgeDemo);
  await page.evaluate(() => {
    const dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;width:12px;height:12px;border:2px solid white;border-radius:50%;background:#183fca;pointer-events:none;z-index:999999;transform:translate(-50%,-50%)';
    document.body.append(dot);
    document.addEventListener('pointermove', event => {
      dot.style.left = `${event.clientX}px`; dot.style.top = `${event.clientY}px`;
    });
  });
  const a = await page.locator('#components-trigger').boundingBox();
  const b = await page.locator('#type-trigger').boundingBox();
  const points = [[a.x+60,a.y+a.height/2],[a.x+115,a.y+a.height-6],
    [a.x+148,a.y+a.height+12],[a.x+220,b.y+20],[a.x+300,b.y+40]];
  await page.locator('#debug').click();
  for (const protection of [false, true]) {
    const start = Date.now();
    await page.mouse.move(5, 5);
    await page.locator('#protection').click();
    assert.equal(await page.locator('#protection').getAttribute('aria-pressed'), String(protection));
    await page.waitForTimeout(300);
    await page.mouse.move(...points[0]);
    await page.waitForTimeout(450);
    for (let step = 1; step < points.length; step++) {
      const [sx, sy] = points[step-1], [ex, ey] = points[step];
      for (let frame = 1; frame <= 5; frame++) {
        await page.mouse.move(sx+(ex-sx)*frame/5, sy+(ey-sy)*frame/5);
        await page.waitForTimeout(12);
      }
    }
    assert.equal(await page.evaluate(() => hoverBridgeDemo.controllers[0].active?.id),
      protection ? 'components-trigger' : 'type-trigger');
    await page.waitForTimeout(Math.max(0, 5000-(Date.now()-start)));
  }
  await context.close();
  const movie = join(temporary, 'comparison.webm');
  await page.video().saveAs(movie);
  execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-y','-ss','0.4','-i',movie,'-t','10','-vf',
    'crop=1280:560:0:325,fps=15,scale=1000:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer',
    fileURLToPath(new URL('../docs/assets/hoverbridge-comparison.gif', import.meta.url))]);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
