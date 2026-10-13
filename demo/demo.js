'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const installation = HoverBridge.start();
  const controllers = () => installation.controllers;
  const stage = $('stage');
  let protection = true, debug = false, toastTimer;
  let frozen = false;
  const writeText = (id, value) => { if ($(id).textContent !== String(value)) $(id).textContent = value; };

  function positionPanels() {
    const gap = Number($('gap').value);
    const side = $('side').value;
    const vertical = side === 'top' || side === 'bottom';
    stage.style.height = vertical ? '610px' : '430px';
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const rootWidth = 228, panelWidth = 244;
    let sx, sy, px, py;
    if (side === 'right' || side === 'left') {
      sx = (width - (rootWidth + panelWidth + gap)) / 2;
      sy = 105; py = 70;
      px = sx + rootWidth + gap;
      if (side === 'left') { px = sx; sx = px + panelWidth + gap; }
    } else {
      sx = width / 2 - rootWidth / 2 - 95; px = sx + 135;
      sy = side === 'bottom' ? 70 : height - 95 - 40;
      // Vertical variants use a single trigger row; the same controller keeps
      // its horizontal examples and all coordinate logic unchanged.
      py = side === 'bottom' ? sy + 40 + gap : sy - 242 - gap;
    }
    for (const child of $('source').children) child.hidden = vertical && child.id !== 'components-trigger';
    $('source').style.cssText = `left:${sx}px;top:${sy}px;${vertical ? 'padding:0;' : ''}`;
    for (const id of ['components', 'type-panel', 'color-panel']) $(id).style.cssText = `left:${px}px;top:${py}px;`;
    const nestedWidth = 210;
    let nx = px + panelWidth + Math.min(gap, 38);
    if (nx + nestedWidth > width - 15) nx = px - nestedWidth - Math.min(gap, 38);
    $('layouts').style.cssText = `left:${Math.max(10, nx)}px;top:${Math.max(60, py + 74)}px;`;
    writeText('gap-value', `${gap} px`);
    window.dispatchEvent(new Event('resize'));
  }
  $('protection').addEventListener('click', () => {
    protection = !protection;
    $('protection').setAttribute('aria-pressed', String(protection));
    writeText('protection-label', protection ? 'on' : 'off');
    controllers().forEach(controller => controller.setIntent(protection));
    writeText('hint', protection ? 'Start on Components. Move diagonally toward its panel.' : 'Protection off. Cross Typography on the way to Components.');
  });
  $('debug').addEventListener('click', () => {
    debug = !debug;
    $('debug').setAttribute('aria-pressed', String(debug));
    writeText('debug', debug ? 'Hide corridor' : 'Show corridor');
    controllers().forEach(controller => controller.setDebug(debug));
  });
  $('gap').addEventListener('input', positionPanels);
  $('buffer').addEventListener('input', () => {
    const value = Number($('buffer').value);
    controllers().forEach(controller => controller.setOptions({ buffer: value }));
    writeText('buffer-value', `${value} px`);
  });
  $('side').addEventListener('change', () => { controllers().forEach(c => c.close()); positionPanels(); });
  $('reset').addEventListener('click', () => controllers().forEach(controller => controller.resetMetrics()));
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-demo-action]');
    if (!button) return;
    writeText('toast', button.dataset.demoAction);
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2000);
  });
  function refreshCounters() {
    if (frozen) return;
    const totals = controllers().reduce((sum, c) => {
      const m = c.metrics;
      return { switches:sum.switches+m.deferredSwitches, samples:sum.samples+m.protectedSamples, opens:sum.opens+m.opens };
    }, { switches:0, samples:0, opens:0 });
    for (const [key, value] of Object.entries(totals)) writeText(key, value);
    const states = controllers().map(c => c.state);
    const guarded = states.find(s => s.guarding);
    const pinned = states.find(s => s.pinned);
    const open = states.find(s => s.active);
    writeText('state-label', guarded ? 'Safe corridor active' : pinned ? 'Pinned · click again to close' : open ? 'Endpoint reached' : 'Ready');
  }
  const observer = new ResizeObserver(positionPanels);
  observer.observe(stage);
  positionPanels();
  setInterval(refreshCounters, 120);
  // Local inspection only; no storage, upload or guessed "mistakes prevented".
  window.hoverBridgeDemo = { installation, positionPanels, refreshCounters,
    freezeCounters(value) { frozen = value; },
    get controllers() { return controllers(); },
  };
})();
