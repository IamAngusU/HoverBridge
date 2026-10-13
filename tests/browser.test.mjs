import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright-core';

const engineName = process.env.HOVERBRIDGE_BROWSER ?? 'chromium';
const engine = { chromium, firefox, webkit }[engineName];
if (!engine) throw new Error('HOVERBRIDGE_BROWSER must be chromium, firefox or webkit.');
let browser;
const pages = new Set();
const bundle = fileURLToPath(new URL('../dist/hoverbridge.browser.js', import.meta.url));

before(async () => {
  const options = { headless: true };
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) options.executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  if (engineName === 'chromium') options.args = ['--no-sandbox'];
  browser = await engine.launch(options);
  console.log(`Browser evidence: ${engineName} ${browser.version()}`);
});
afterEach(async () => {
  try { for (const page of pages) page.assertNoErrors?.(); }
  finally { await Promise.all([...pages].map(page => page.close())); pages.clear(); }
});
after(async () => { await browser?.close(); });

async function fixture(options = {}, extra = '') {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  pages.add(page);
  // Browser startup and the first document load can stall on hosted runners.
  // Interaction deadlines below remain explicit where timing is the subject.
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent(`<!doctype html><html><head><style>
  *{box-sizing:border-box} body{margin:0;min-height:1600px} [hidden]{display:none!important}
  #root{position:absolute;left:100px;top:100px;width:180px}
  #root>button{display:block;width:180px;height:50px;padding:0;border:0;background:#fff}
  #root>button[data-hoverbridge-active]{background:rgb(210,230,215)}
  #root>button:hover:not([data-hoverbridge-blocked]){outline:2px solid green}
  .panel{position:absolute;left:360px;top:70px;width:200px;height:320px;background:#eee;padding:12px}
  #outside{position:absolute;top:600px;left:50px;width:100px;height:40px}
  </style></head><body>
  <nav id="root"><button id="a" aria-controls="pa" aria-expanded="false">A</button><button id="b" aria-controls="pb" aria-expanded="false">B</button><button id="leaf" data-hoverbridge-item>Leaf</button></nav>
  <section id="pa" class="panel" hidden><button id="inside">Inside A</button></section>
  <section id="pb" class="panel" hidden><button>Inside B</button></section>
  <button id="outside">Outside</button>${extra}</body></html>`, { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ path: bundle });
  await page.evaluate(options => {
    window.changes = [];
    window.ctrl = HoverBridge.createHoverBridge(document.querySelector('#root'), {
      ...options, onChange: event => changes.push({ id: event.trigger.id, open: event.open, reason: event.reason }),
    });
  }, options);
  page.assertNoErrors = () => assert.deepEqual(errors, []);
  return page;
}
const active = page => page.evaluate(() => ctrl.active?.id ?? null);
const state = page => page.evaluate(() => ({ ...ctrl.state, active: ctrl.active?.id, panel: ctrl.state.panel?.id }));
const start = async page => { await page.mouse.move(150, 125); await page.mouse.move(180, 140); };
const diagonal = async page => {
  await start(page);
  for (const [x, y] of [[215, 165], [260, 200], [330, 260], [375, 290]]) await page.mouse.move(x, y);
};

test('diagonal transit crosses a real sibling and a real empty gap', async () => {
  // This case tests geometry, not the rest deadline. Hosted runners can pause
  // between pointer commands long enough to count as a deliberate rest.
  const page = await fixture({ restMs: 5000, maxTransitMs: 10000 });
  await start(page);
  await page.mouse.move(215, 165);
  assert.equal(await active(page), 'a');
  assert.equal((await state(page)).guarding, true);
  assert.equal(await page.evaluate(() => document.elementFromPoint(215, 165).id), 'b');
  assert.equal(await page.locator('#b').getAttribute('data-hoverbridge-blocked'), '');
  await page.mouse.move(310, 250);
  assert.equal(await active(page), 'a');
  assert.equal(await page.locator('#pa').isVisible(), true);
  await page.mouse.move(375, 290);
  assert.equal(await active(page), 'a');
  assert.equal((await state(page)).guarding, false);
  page.assertNoErrors();
});
test('vertical sibling selection is immediate, not a universal hover delay', async () => {
  const page = await fixture(); await page.mouse.move(150, 125); await page.mouse.move(150, 175);
  assert.equal(await active(page), 'b');
});
test('resting deliberately over a crossed sibling eventually selects it', async () => {
  const page = await fixture({ restMs: 100 }); await start(page); await page.mouse.move(215, 165);
  assert.equal(await active(page), 'a');
  await page.waitForFunction(() => ctrl.active?.id === 'b', { timeout: 1200 });
  assert.equal((await state(page)).guarding, false);
});
test('leaving the corridor closes after closeDelay', async () => {
  const page = await fixture({ closeDelay: 30 }); await diagonal(page); await page.mouse.move(30, 30);
  await page.waitForFunction(() => !ctrl.active);
  assert.equal(await page.locator('#pa').isVisible(), false);
});
test('a target can stay hovered longer than the entire transit budget', async () => {
  const page = await fixture({ maxTransitMs: 80, restMs: 40 });
  await page.mouse.move(150, 125); await page.mouse.move(380, 120); await page.waitForTimeout(150);
  assert.equal(await active(page), 'a');
});
test('clicking a protected sibling uses the real trusted click', async () => {
  const page = await fixture();
  await page.evaluate(() => document.querySelector('#b').addEventListener('click', e => { window.realClick = e.isTrusted; }));
  await start(page); await page.mouse.move(215, 165); await page.mouse.click(215, 165);
  assert.equal(await active(page), 'b');
  assert.equal(await page.evaluate(() => realClick), true);
  assert.equal((await state(page)).pinned, true);
});
test('a second click unpins and closes without leaving stale markers', async () => {
  const page = await fixture(); await page.click('#a');
  assert.equal((await state(page)).pinned, true);
  await page.click('#a');
  assert.equal(await active(page), null);
  assert.equal(await page.locator('#a').getAttribute('data-hoverbridge-pinned'), null);
});
test('outside clicks dismiss pinned content without swallowing the click', async () => {
  const page = await fixture(); await page.click('#a');
  await page.evaluate(() => document.querySelector('#outside').addEventListener('click', e => { window.clickedOutside = e.isTrusted; }));
  await page.click('#outside');
  assert.equal(await active(page), null);
  assert.equal(await page.evaluate(() => clickedOutside), true);
});
test('keyboard focus keeps a panel open even when the pointer leaves', async () => {
  const page = await fixture(); await page.keyboard.press('Tab');
  // macOS WebKit may skip buttons with the system's default Tab preference.
  // Programmatic focus still exercises the controller's keyboard focus path.
  if (await page.evaluate(() => document.activeElement.id) !== 'a') await page.focus('#a');
  assert.equal(await active(page), 'a');
  await page.mouse.move(30, 30); await page.waitForTimeout(160);
  assert.equal(await active(page), 'a');
});
test('Escape closes focused content and does not reopen on focus restoration', async () => {
  const page = await fixture(); await page.keyboard.press('Tab');
  if (await page.evaluate(() => document.activeElement.id) !== 'a') await page.focus('#a');
  await page.focus('#inside'); await page.keyboard.press('Escape');
  assert.equal(await active(page), null);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'a');
  await page.mouse.move(150, 125); assert.equal(await active(page), null);
  await page.mouse.move(20, 20); await page.mouse.move(150, 125);
  assert.equal(await active(page), 'a');
});
test('Tab remains native and reaches content without a focus trap', async () => {
  const page = await fixture(); await page.keyboard.press('Tab');
  if (await page.evaluate(() => document.activeElement.id) !== 'a') await page.focus('#a');
  await page.focus('#inside'); await page.keyboard.press('Tab');
  if (process.platform === 'darwin' && engineName === 'webkit') {
    // The OS can omit buttons from sequential focus; HoverBridge must not
    // cancel Tab or trap focus inside the panel.
    await page.focus('#outside');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'outside');
  } else assert.equal(await page.evaluate(() => document.activeElement.id), 'outside');
});
test('disabled triggers do not open', async () => {
  const page = await fixture(); await page.evaluate(() => { document.querySelector('#a').disabled = true; });
  await page.mouse.move(150, 125); assert.equal(await active(page), null);
});
test('disabling the active trigger closes it', async () => {
  const page = await fixture(); await page.mouse.move(150, 125);
  await page.evaluate(() => { document.querySelector('#a').setAttribute('aria-disabled', 'true'); });
  await page.waitForFunction(() => !ctrl.active);
});
test('added and removed items are discovered without reinitializing', async () => {
  const page = await fixture();
  await page.evaluate(() => {
    const button = document.createElement('button'); button.id = 'new'; button.textContent = 'New';
    button.setAttribute('aria-controls', 'pn');
    const panel = document.createElement('section'); panel.id = 'pn'; panel.hidden = true; panel.className = 'panel';
    document.body.append(panel); document.querySelector('#root').append(button);
  });
  await page.mouse.move(150, 275); assert.equal(await active(page), 'new');
  await page.evaluate(() => document.querySelector('#pn').remove());
  await page.waitForFunction(() => !ctrl.active);
  assert.equal(await page.evaluate(() => ctrl.warnings[0]?.code), 'missing-target');
});
test('detached scopes dispose observers, state, markers and timers', async () => {
  const page = await fixture({ debug: true }); await start(page); await page.mouse.move(215, 165);
  await page.evaluate(() => { window.oldRoot = ctrl.root; oldRoot.remove(); });
  await page.waitForFunction(() => ctrl.destroyed);
  assert.equal(await page.locator('[data-hoverbridge-debug]').count(), 0);
  assert.equal(await page.evaluate(() => oldRoot.querySelector('#a').hasAttribute('data-hoverbridge-active')), false);
});
test('destroy restores preexisting DOM attributes', async () => {
  const page = await fixture(); await page.mouse.move(150, 125);
  await page.evaluate(() => ctrl.destroy());
  assert.equal(await page.locator('#a').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('#pa').getAttribute('hidden'), '');
  assert.equal(await page.locator('#a').getAttribute('data-hoverbridge-active'), null);
});
test('destroy does not overwrite later host-owned attribute changes', async () => {
  const page = await fixture(); await page.mouse.move(150, 125);
  await page.evaluate(() => { document.querySelector('#a').setAttribute('aria-expanded', 'host-value'); ctrl.destroy(); });
  assert.equal(await page.locator('#a').getAttribute('aria-expanded'), 'host-value');
});
test('AbortSignal cancels an installed scope', async () => {
  const page = await fixture();
  await page.evaluate(() => { ctrl.destroy(); const abort = new AbortController(); ctrl = HoverBridge.createHoverBridge(document.querySelector('#root'), { signal: abort.signal }); abort.abort(); });
  assert.equal(await page.evaluate(() => ctrl.destroyed), true);
});
test('an already aborted signal does not leave a working controller behind', async () => {
  const page = await fixture();
  await page.evaluate(() => { ctrl.destroy(); const abort = new AbortController(); abort.abort(); ctrl = HoverBridge.createHoverBridge(document.querySelector('#root'), { signal: abort.signal }); });
  await page.mouse.move(150, 125); assert.equal(await active(page), null);
  assert.equal(await page.evaluate(() => ctrl.destroyed), true);
});
test('repeated initialization is idempotent', async () => {
  const page = await fixture();
  assert.equal(await page.evaluate(() => ctrl === HoverBridge.createHoverBridge(ctrl.root)), true);
  await page.evaluate(() => { document.querySelector('#root').setAttribute('data-hoverbridge', ''); window.manager = HoverBridge.autoHoverBridge(); });
  assert.equal(await page.evaluate(() => manager === HoverBridge.autoHoverBridge()), true);
  assert.equal(await page.evaluate(() => manager.controllers[0] === ctrl), true);
});
test('automatic discovery finds newly inserted scopes', async () => {
  const page = await fixture();
  await page.evaluate(() => {
    window.manager = HoverBridge.autoHoverBridge();
    const group = document.createElement('nav'); group.id = 'new-scope'; group.dataset.hoverbridge = '';
    group.style.cssText = 'position:absolute;left:650px;top:100px';
    group.innerHTML = '<button id="new-trigger" aria-controls="new-panel">New scope</button>';
    const panel = document.createElement('section'); panel.id = 'new-panel'; panel.hidden = true; panel.textContent = 'New panel';
    document.body.append(group, panel);
  });
  await page.hover('#new-trigger');
  assert.equal(await page.locator('#new-panel').isVisible(), true);
});
test('unannotated third-party controls are not commandeered by auto mode', async () => {
  const page = await fixture(); await page.evaluate(() => ctrl.destroy());
  await page.mouse.move(150, 125);
  assert.equal(await page.locator('#pa').isVisible(), false);
});
test('missing or multi-target ARIA relationships are reported, not guessed', async () => {
  const page = await fixture();
  await page.evaluate(() => { document.querySelector('#a').setAttribute('aria-controls', 'pa pb'); document.querySelector('#b').setAttribute('aria-controls', 'missing'); ctrl.refresh(); });
  assert.deepEqual(await page.evaluate(() => ctrl.warnings.map(x => x.code).sort()), ['missing-target', 'multiple-targets']);
});
test('render callbacks replace visibility writes for controlled components', async () => {
  const page = await fixture();
  await page.evaluate(() => {
    ctrl.destroy(); window.renders = [];
    ctrl = HoverBridge.createHoverBridge(document.querySelector('#root'), { render: change => {
      renders.push(change.open); change.panel.hidden = !change.open;
    } });
  });
  await diagonal(page);
  assert.equal(await active(page), 'a');
  assert.deepEqual(await page.evaluate(() => renders), [true]);
  await page.evaluate(() => ctrl.close());
  assert.deepEqual(await page.evaluate(() => renders), [true, false]);
});
test('nested portal panels keep their ancestor open', async () => {
  const page = await fixture();
  await page.evaluate(() => {
    const child = document.createElement('nav'); child.id = 'child';
    child.innerHTML = '<button id="c" aria-controls="pc" style="display:block;width:160px;height:45px">Child</button><button data-hoverbridge-item style="display:block;width:160px;height:45px">Other</button>';
    document.querySelector('#pa').replaceChildren(child);
    const panel = document.createElement('section'); panel.id = 'pc'; panel.hidden = true;
    panel.style.cssText = 'position:absolute;left:650px;top:70px;width:180px;height:300px;background:#ddd';
    panel.innerHTML = '<button id="deep">Deep action</button>'; document.body.append(panel);
    window.child = HoverBridge.createHoverBridge(child);
  });
  await page.mouse.move(150, 125); await page.mouse.move(410, 100);
  assert.equal(await page.evaluate(() => child.active?.id), 'c');
  await page.mouse.move(570, 155);
  assert.equal(await active(page), 'a');
  await page.mouse.move(690, 180); await page.waitForTimeout(160);
  assert.equal(await page.locator('#pa').isVisible(), true);
  assert.equal(await page.locator('#pc').isVisible(), true);
});
test('Escape closes nested layers from deepest to shallowest', async () => {
  const page = await fixture();
  await page.evaluate(() => {
    const inner = document.createElement('div'); inner.id = 'child';
    inner.innerHTML = '<button id="c" aria-controls="pc">Child</button>';
    document.querySelector('#pa').replaceChildren(inner);
    const p = document.createElement('div'); p.id = 'pc'; p.hidden = true; p.innerHTML = '<button id="deep">Deep</button>'; document.body.append(p);
    window.child = HoverBridge.createHoverBridge(inner);
    ctrl.open(document.querySelector('#a')); child.open(document.querySelector('#c'));
    document.querySelector('#deep').focus();
  });
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => child.active), null);
  assert.equal(await active(page), 'a');
  await page.keyboard.press('Escape'); assert.equal(await active(page), null);
});
test('native popover hover and click do not double-toggle', async () => {
  const page = await fixture();
  await page.evaluate(() => {
    ctrl.destroy(); document.querySelector('#pa').setAttribute('popover', 'manual');
    document.querySelector('#pa').style.margin = '0';
    document.querySelector('#a').setAttribute('popovertarget', 'pa');
    ctrl = HoverBridge.createHoverBridge(document.querySelector('#root'));
  });
  await page.hover('#a');
  assert.equal(await page.evaluate(() => document.querySelector('#pa').matches(':popover-open')), true);
  await page.click('#a');
  assert.equal(await page.evaluate(() => document.querySelector('#pa').matches(':popover-open')), true);
  await page.click('#a');
  assert.equal(await page.evaluate(() => document.querySelector('#pa').matches(':popover-open')), false);
});
test('an external native popover dismissal synchronizes active state', async () => {
  const page = await fixture();
  await page.evaluate(() => { ctrl.destroy(); document.querySelector('#pa').setAttribute('popover', 'manual'); ctrl = HoverBridge.createHoverBridge(document.querySelector('#root')); });
  await page.hover('#a'); await page.evaluate(() => document.querySelector('#pa').hidePopover());
  await page.waitForFunction(() => !ctrl.active);
});
test('touch pointer motion does not activate mouse intent', async () => {
  const page = await fixture();
  await page.dispatchEvent('#a', 'pointermove', { pointerType: 'touch', pointerId: 3, isPrimary: true, clientX: 150, clientY: 125, buttons: 0 });
  assert.equal(await active(page), null);
});
test('touch activation works on the first tap', async () => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1100, height: 800 } });
  const page = await fixture();
  const touchPage = await context.newPage(); pages.add(touchPage);
  await touchPage.setContent(await page.content());
  await touchPage.addScriptTag({ path: bundle });
  await touchPage.evaluate(() => { window.ctrl = HoverBridge.createHoverBridge(document.querySelector('#root')); });
  await touchPage.tap('#a');
  assert.equal(await touchPage.locator('#pa').isVisible(), true);
  await touchPage.close(); pages.delete(touchPage); await context.close();
});
test('pen hover is accepted, pen contact is not treated as hover', async () => {
  const page = await fixture();
  await page.dispatchEvent('#a', 'pointermove', { pointerType: 'pen', pointerId: 2, isPrimary: true, clientX: 150, clientY: 125, buttons: 0 });
  assert.equal(await active(page), 'a');
  await page.dispatchEvent('#b', 'pointermove', { pointerType: 'pen', pointerId: 2, isPrimary: true, clientX: 150, clientY: 175, buttons: 1 });
  assert.notEqual(await active(page), 'b');
});
test('dragging across another trigger does not open it', async () => {
  const page = await fixture(); await page.mouse.move(30, 30); await page.mouse.down(); await page.mouse.move(150, 175);
  assert.equal(await active(page), null); await page.mouse.up();
});
test('a pointer cancellation clears a pending corridor', async () => {
  const page = await fixture({ closeDelay: 20 }); await start(page); await page.mouse.move(215, 165);
  await page.dispatchEvent('#root', 'pointercancel', { pointerType: 'mouse', pointerId: 1, isPrimary: true });
  await page.waitForFunction(() => !ctrl.active);
  assert.equal((await state(page)).guarding, false);
});
test('scroll and resize update actual geometry rather than a cached placement', async () => {
  const page = await fixture(); await start(page); await page.mouse.move(215, 165);
  await page.evaluate(() => { document.querySelector('#pa').style.left = '-200px'; window.dispatchEvent(new Event('resize')); });
  await page.waitForFunction(() => !ctrl.state.guarding);
});
test('protection can be disabled without turning off normal hover behavior', async () => {
  const page = await fixture({ intent: false }); await start(page); await page.mouse.move(215, 165);
  assert.equal(await active(page), 'b');
});
test('disabled controllers ignore input until re-enabled', async () => {
  const page = await fixture({ enabled: false }); await page.mouse.move(150, 125);
  assert.equal(await active(page), null);
  await page.evaluate(() => ctrl.setEnabled(true)); await page.mouse.move(151, 125);
  assert.equal(await active(page), 'a');
});
test('openDelay is cancelled when the trigger is only passed over', async () => {
  const page = await fixture({ openDelay: 100 }); await page.mouse.move(150, 125); await page.mouse.move(30, 30);
  await page.waitForTimeout(140); assert.equal(await active(page), null);
});
test('openDelay completes without requiring another pointer movement', async () => {
  const page = await fixture({ openDelay: 60 }); await page.mouse.move(150, 125);
  assert.ok(await page.evaluate(() => ctrl.metrics.pointerSamples) >= 1);
  // A layout notification before the timer fires must preserve this pending
  // opening if hit testing still resolves to the same trigger.
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  try { await page.waitForFunction(() => ctrl.active?.id === 'a', null, { timeout: 3000 }); }
  catch (error) {
    const detail = await page.evaluate(() => ({
      active: ctrl.active?.id ?? null,
      pending: ctrl.pending?.trigger?.id ?? null,
      pendingAt: ctrl.pendingAt,
      timer: ctrl.timer,
      now: performance.now(),
      point: ctrl.hub.point,
      path: ctrl.hub.path.map(element => element.id || element.tagName),
      hit: document.elementFromPoint(150, 125)?.id ?? null,
      metrics: ctrl.metrics,
    }));
    throw new Error(`openDelay did not activate: ${JSON.stringify(detail)}`, { cause: error });
  }
});
test('closed, idle scopes perform zero layout reads', async () => {
  const page = await fixture(); await page.mouse.move(20, 20); await page.mouse.move(30, 30);
  assert.equal(await page.evaluate(() => ctrl.metrics.layoutReads), 0);
});
test('debug drawing is pointer-transparent and leaves ordinary hit testing intact', async () => {
  const page = await fixture({ debug: true }); await start(page); await page.mouse.move(215, 165);
  assert.equal(await page.locator('[data-hoverbridge-debug]').count(), 1);
  assert.equal(await page.evaluate(() => document.elementFromPoint(215, 165).id), 'b');
  await page.evaluate(() => ctrl.setDebug(false));
  assert.equal(await page.locator('[data-hoverbridge-debug]').count(), 0);
});
test('open Shadow DOM can be explicitly registered without global constructor assumptions', async () => {
  const page = await fixture();
  await page.evaluate(() => {
    const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:650px;top:100px';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<div data-hoverbridge><button id="shadow-trigger" aria-controls="shadow-panel">Shadow</button></div><div id="shadow-panel" hidden>Shadow panel</div>';
    document.body.append(host); window.shadowManager = HoverBridge.autoHoverBridge(shadow);
  });
  await page.hover('#shadow-trigger');
  assert.equal(await page.locator('#shadow-panel').isVisible(), true);
});
test('same-document portal target replacement refreshes the relationship', async () => {
  const page = await fixture();
  await page.evaluate(() => { const replacement = document.querySelector('#pa').cloneNode(true); document.querySelector('#pa').replaceWith(replacement); ctrl.refresh(); });
  await diagonal(page); assert.equal(await page.locator('#pa').isVisible(), true);
});
test('metrics count decisions, not invented prevented user mistakes', async () => {
  const page = await fixture(); await start(page); await page.mouse.move(215, 165);
  const metrics = await page.evaluate(() => ctrl.metrics);
  assert.equal(metrics.opens, 1); assert.equal(metrics.deferredSwitches, 1);
  assert.ok(metrics.protectedSamples >= 1); assert.ok(metrics.layoutReads >= 2);
  await page.evaluate(() => ctrl.resetMetrics());
  assert.equal(await page.evaluate(() => ctrl.metrics.opens), 0);
});

for (const [turns, side] of ['right', 'bottom', 'left', 'top'].entries()) {
  test(`real layout: ${side}-facing panels preserve diagonal transit`, async () => {
    const page = await fixture({ restMs: 5000, maxTransitMs: 10000 });
    const rotate = (x, y) => {
      x -= 330; y -= 260;
      for (let turn = 0; turn < turns; turn++) [x, y] = [-y, x];
      return [x + 520, y + 360];
    };
    const rect = (x1,y1,x2,y2) => {
      const a=rotate(x1,y1), b=rotate(x2,y2);
      return { left: Math.min(a[0],b[0]), top:Math.min(a[1],b[1]), width:Math.abs(b[0]-a[0]),height:Math.abs(b[1]-a[1]) };
    };
    await page.evaluate(({a,b,leaf,panel}) => {
      document.querySelector('#root').style.cssText='position:static';
      for(const [id,r] of Object.entries({a,b,leaf,pa:panel,pb:panel})) {
        const el=document.getElementById(id);
        el.style.cssText=`position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
      }
    }, {a:rect(100,100,280,150),b:rect(100,150,280,200),leaf:rect(100,200,280,250),panel:rect(360,70,560,390)});
    for (const point of [[150,125],[180,140],[215,165],[260,190],[330,250],[375,290]]) {
      await page.mouse.move(...rotate(...point));
      assert.equal(await active(page),'a');
    }
  });
}
test('external hidden state closes the controller instead of leaving stale ARIA', async () => {
  const page=await fixture(); await start(page);
  await page.evaluate(()=>{document.getElementById('pa').hidden=true;});
  await page.waitForFunction(()=>!ctrl.active);
  assert.equal(await page.locator('#a').getAttribute('aria-expanded'),'false');
});
test('callbacks may dispose the controller while an old item is closing',async()=>{
  const page=await fixture();
  await page.evaluate(()=>{
    ctrl.destroy();
    window.ctrl=HoverBridge.createHoverBridge(document.getElementById('root'),{
      onChange:({open})=>{if(!open)ctrl.destroy();}
    });
  });
  await page.mouse.move(150,125);await page.mouse.move(150,175);
  assert.equal(await page.evaluate(()=>ctrl.destroyed),true);
  assert.equal(await active(page),null);
  assert.equal(await page.locator('[data-hoverbridge-active]').count(),0);
});
test('destroy reports inactive, unpinned and unguarded state',async()=>{
  const page=await fixture(); await page.click('#a');
  await page.evaluate(()=>ctrl.destroy());
  const value=await state(page);
  assert.equal(value.pinned,false); assert.equal(value.guarding,false); assert.equal(value.enabled,false);
});
test('scroll gestures remain native while an intent corridor is active',async()=>{
  const page=await fixture(); await start(page);await page.mouse.move(215,165);
  assert.equal((await state(page)).guarding,true);
  await page.mouse.wheel(0,240);
  await page.waitForFunction(()=>window.scrollY>0);
  assert.ok(await page.evaluate(()=>window.scrollY)>0);
});

test('a deliberate click on a leaf releases a previously pinned panel', async()=>{
  const page=await fixture(); await page.click('#a'); await page.click('#leaf');
  assert.equal(await active(page),'leaf');
  assert.equal((await state(page)).pinned,false);
  assert.equal(await page.locator('#pa').isVisible(),false);
});
test('keyboard focus can rearm a dismissed trigger after leaving it', async()=>{
  const page=await fixture(); await page.keyboard.press('Tab');
  if (await page.evaluate(() => document.activeElement.id) !== 'a') await page.focus('#a');
  await page.keyboard.press('Escape');
  assert.equal(await active(page),null);
  if (process.platform === 'darwin' && engineName === 'webkit') {
    await page.focus('#b'); await page.focus('#a');
  } else {
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  }
  assert.equal(await active(page),'a');
});

test('programmatic bindings can be replaced without rebuilding a scope', async () => {
  const page = await fixture();
  await page.evaluate(() => ctrl.setItems([{ trigger: document.querySelector('#b'), panel: document.querySelector('#pb') }]));
  await page.mouse.move(150, 125);
  assert.equal(await active(page), null);
  await page.mouse.move(150, 175);
  assert.equal(await active(page), 'b');
  await page.evaluate(() => ctrl.setItems(null));
  assert.equal(await active(page), 'b');
  await page.mouse.move(150, 125);
  assert.equal(await active(page), 'a');
});

test('single-pair connection needs no discovery attributes', async () => {
  const page = await fixture();
  await page.evaluate(() => {
    ctrl.destroy();
    document.querySelector('#a').removeAttribute('aria-controls');
    window.pair = HoverBridge.connectHoverBridge(document.querySelector('#a'), document.querySelector('#pa'));
  });
  await page.mouse.move(150, 125);
  assert.equal(await page.evaluate(() => pair.active?.id), 'a');
  assert.equal(await page.locator('#pa').isVisible(), true);
  await page.evaluate(() => pair.destroy());
});

test('read-only guard protects a diagonal crossing without changing host markup', async () => {
  const page = await fixture();
  await page.evaluate(() => {
    ctrl.destroy();
    document.querySelector('#pa').hidden = false;
    window.guardChanges = [];
    window.guard = HoverBridge.createHoverBridgeGuard(document.querySelector('#a'), document.querySelector('#pa'), {
      onChange: state => guardChanges.push({ hold: state.hold, reason: state.reason }),
    });
  });
  await start(page);
  await page.mouse.move(215, 165);
  assert.equal(await page.evaluate(() => guard.shouldHold()), true);
  assert.equal(await page.evaluate(() => guard.state.reason), 'corridor');
  assert.equal(await page.locator('#a').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('[data-hoverbridge-active]').count(), 0);
  await page.mouse.move(30, 30);
  assert.equal(await page.evaluate(() => guard.shouldHold()), false);
  assert.ok((await page.evaluate(() => guardChanges)).some(change => change.hold === false));
  await page.evaluate(() => guard.destroy());
});

test('read-only guard wakes at the rest deadline without another pointer move', async () => {
  const page = await fixture();
  await page.evaluate(() => {
    ctrl.destroy();
    document.querySelector('#pa').hidden = false;
    window.guard = HoverBridge.createHoverBridgeGuard(document.querySelector('#a'), document.querySelector('#pa'), { restMs: 80 });
  });
  await start(page);
  await page.mouse.move(215, 165);
  assert.equal(await page.evaluate(() => guard.state.hold), true);
  await page.waitForFunction(() => guard.state.reason === 'rest');
  assert.equal(await page.evaluate(() => guard.state.hold), false);
});

test('read-only guard can be seeded before a host render and refreshed after it', async () => {
  const page = await fixture();
  const results = await page.evaluate(() => {
    ctrl.destroy();
    const panel = document.querySelector('#pa');
    const guard = HoverBridge.createHoverBridgeGuard(document.querySelector('#a'), panel);
    guard.update({ clientX: 150, clientY: 125, pointerType: 'mouse', isPrimary: true, buttons: 0 });
    const before = guard.state.hold;
    panel.hidden = false;
    const after = guard.refresh();
    guard.destroy();
    return { before, after: after.hold, reason: after.reason };
  });
  assert.deepEqual(results, { before: false, after: true, reason: 'source' });
});

test('idle read-only guards skip layout reads during unrelated pointer movement', async () => {
  const page = await fixture();
  await page.evaluate(() => {
    ctrl.destroy();
    document.querySelector('#pa').hidden = false;
    window.reads = 0;
    for (const element of [document.querySelector('#a'), document.querySelector('#pa')]) {
      const original = element.getBoundingClientRect.bind(element);
      element.getBoundingClientRect = () => { reads++; return original(); };
    }
    window.guard = HoverBridge.createHoverBridgeGuard(document.querySelector('#a'), document.querySelector('#pa'));
  });
  await page.mouse.move(30, 30);
  await page.mouse.move(70, 40);
  assert.equal(await page.evaluate(() => reads), 0);
  await page.mouse.move(150, 125);
  assert.ok(await page.evaluate(() => reads) >= 2);
});

test('runtime tuning changes close timing without recreating the controller', async () => {
  const page = await fixture();
  await page.evaluate(() => ctrl.setOptions({ closeDelay: 0 }));
  await page.mouse.move(150, 125);
  await page.mouse.move(30, 30);
  assert.equal(await active(page), null);
  assert.equal(await page.evaluate(() => {
    try { ctrl.setOptions({ buffer: -1 }); return false; }
    catch (error) { return error instanceof RangeError; }
  }), true);
});

test('automatic setup reads per-scope timing attributes', async () => {
  const page = await fixture();
  await page.evaluate(() => {
    ctrl.destroy();
    const root = document.querySelector('#root');
    root.setAttribute('data-hoverbridge', '');
    root.setAttribute('data-hoverbridge-close-delay', '0');
    window.auto = HoverBridge.start();
    auto.refresh();
    window.ctrl = auto.controllers.find(member => member.root === root);
  });
  await page.mouse.move(150, 125);
  assert.equal(await active(page), 'a');
  await page.mouse.move(30, 30);
  assert.equal(await active(page), null);
});
