# Integrate without giving two systems the steering wheel

Choose the smallest surface that matches what your application already owns.

## Plain HTML / PHP / static server

Use the classic script and one `data-hoverbridge` attribute on each sibling group. This is the shortest path when HoverBridge may own opening and closing.

```html
<script defer src="/vendor/hoverbridge.browser.js"></script>
<div class="menu-shell">
  <nav data-hoverbridge data-hoverbridge-buffer="10" data-hoverbridge-close-delay="160">
    <button type="button" aria-controls="tools-panel" aria-expanded="false">Tools</button>
    <button type="button" data-hoverbridge-item>Settings</button>
  </nav>
  <section id="tools-panel" hidden>Panel contents</section>
</div>
```

`aria-controls` already present? Add the scope attribute and script. Native `popovertarget` is also recognized. A standalone trigger can itself be a marked scope. `data-hoverbridge-item` marks selectable leaves that have no panel. `data-hoverbridge-ignore` opts an element/subtree out of automatic relationship discovery.

The numeric attributes are optional. `buffer` controls the safe corridor's tolerance in CSS pixels; `close-delay` controls leave grace in milliseconds. See [all four markup options](api.md#markup-tuning) and [all API options](api.md#options). Scope attributes are read at creation; use `setOptions()` for live updates.

Use actual HTML buttons for actions, links for navigation, and unique IDs. Server-rendered markup does not require a backend integration. Set the HTTP content type for the script to JavaScript. The source ZIP includes the build; deployment does not require npm.

### Keep CSS state explicit

```css
[hidden] { display: none !important; }
.menu-item[data-hoverbridge-active] { background: var(--menu-selected); }
.menu-item:hover:not([data-hoverbridge-blocked]) { outline: 1px solid var(--menu-hover); }
```

Remove CSS that independently controls visibility, such as `.parent:hover .panel { display:block }`, when HoverBridge owns that panel. It cannot cancel the `:hover` pseudo-class or arbitrary host `mouseenter` listeners. Do not use `pointer-events:none` as a universal fix: it also changes hit testing for deliberate clicks.

The library supplies no panel positioning, menu dimensions or theme. Your existing CSS, Floating UI positioner, Popper, CSS anchors or other layout logic can remain responsible for that part. Recalculate placement in that layer; HoverBridge reads the resulting rectangles.

## Programmatic binding without markup changes

Import the side-effect-free entry. Do not also mark this root for default auto ownership:

```ts
import { createHoverBridge } from '@iamangusu/hoverbridge';

const bridge = createHoverBridge(rootElement, {
  items: [
    { trigger: toolsButton, panel: toolsPanel },
    { trigger: settingsButton },
  ],
  openDelay: 40,
  closeDelay: 120,
});

// Your framework's unmount / cleanup callback:
bridge.destroy();
```

To replace a programmatic list after a framework render, call `bridge.setItems(nextItems)`. Pass `null` to return to attribute discovery. To register disconnected elements, insert them first and call `refresh()` or `setItems()`. Discovery is not a query for all menus on the page.

Use `bridge.setOptions({ buffer: 10, closeDelay: 160 })` to tune a running controller without replacing its bindings.

For a single pair, the shortest programmatic setup is:

```ts
import { connectHoverBridge } from '@iamangusu/hoverbridge';

const bridge = connectHoverBridge(trigger, panel);
// On unmount:
bridge.destroy();
```

## Controlled visibility

A component that owns visibility may supply `render`. This avoids competing `hidden` writes:

```ts
const bridge = createHoverBridge(rootElement, {
  items: [{ trigger, panel }],
  render({ panel, open }) {
    // Example synchronous host renderer. Keep the panel measurable when open.
    panel?.classList.toggle('is-open', open);
  },
});
```

HoverBridge still owns selection, event routing, `aria-expanded` and its state markers. `render` replaces visibility only. The hook is not called for initial setup or destroy, so the host must initialize and clean up its own state. For asynchronous React/Vue state commits, ensure the open target becomes measurable before leaving the source; use the core when that cannot be coordinated.

When an existing framework component already owns `pointerleave`, close timers and sibling activation, use the read-only guard below. Its handlers remain the sole owner of selection and visibility.

## Read-only guard for React, Vue and existing menus

```ts
import { createHoverBridgeGuard } from '@iamangusu/hoverbridge/guard';

const guard = createHoverBridgeGuard(trigger, panel, {
  onChange({ hold }) {
    if (!hold) reconsiderClosingOrSwitching();
  },
});

// Your component's pointer-leave/switch decision:
if (guard.shouldHold()) return;
closeOrSwitchNormally();

// After an asynchronous render opens or repositions the panel:
guard.refresh();
// On unmount:
guard.destroy();
```

The guard shares one passive pointer listener set per document, measures the current rectangles, and wakes at the rest or maximum crossing deadline. It never writes DOM attributes, opens panels, prevents events or emulates clicks. `hold` means the pointer is in an endpoint or a protected crossing; keep your own focus, keyboard, touch, click and close logic. Seed a newly opened panel from its opening pointer event with `guard.update(event)` if needed, then call `refresh()` once the panel is measurable. If your component's panel is hidden before `refresh()`, the guard cannot infer its future geometry.

No framework-specific hooks or compatibility certification are shipped. The APIs above are integration surfaces, not tested wrappers for arbitrary versions of React, Vue, Radix, Floating UI or other libraries.

## Headless adapter contract

```ts
import { IntentTracker } from '@iamangusu/hoverbridge/core';

const intent = new IntentTracker();
const result = intent.sample({
  point: currentPointer,
  source: sourceRectangle,
  target: targetRectangle,
  time: monotonicMilliseconds,
});

if (!result.hold) {
  // Existing component may select its candidate or schedule closure.
}
// Also arrange a check at result.deadline when it is non-null.
```

This fragment is the decision boundary, not a complete event adapter. Your host must prime the tracker at an endpoint, maintain one coordinate system, schedule deadline checks with the last pointer, and reset on pointer cancellation, touch/contact, focus changes and explicit clicks. It must preserve actual endpoint focus/hover and account for nested ownership. No synthetic click should be needed.

This surface can be used outside the DOM in a JavaScript-capable runtime. A C#, Swift, Rust or native UI implementation still needs a port or binding plus its own coordinate/event adapter. Native OS menus cannot be changed by adding this web script.

## Nested and portaled panels

Mark a separate group inside the parent's panel:

```html
<nav data-hoverbridge>
  <button aria-controls="parent-panel">Insert</button>
</nav>
<section id="parent-panel" hidden>
  <nav data-hoverbridge>
    <button aria-controls="child-panel">Layout</button>
  </nav>
</section>
<!-- Elsewhere in the same document is fine. -->
<section id="child-panel" hidden>Stack, grid, container…</section>
```

An active child protects its ancestors even when its target is portaled outside the parent's DOM subtree. Do not make ownership cycles or assign one panel to unrelated competing controllers. Native `popover="auto"` has its own top-layer dismissal rules; portaled nested native popovers may need `popover="manual"` or host-managed coordination. Only the single native popover integration was exercised here.

## Shadow DOM and frames

```ts
const auto = autoHoverBridge(openShadowRoot);
// On component teardown:
auto.destroy();
```

Open ShadowRoot registration is explicit. Composed pointer paths, active elements and same-tree IDs are used. Closed roots need cooperation from the component that owns them. Install independently in each iframe document; no cross-frame corridor is provided. A document without a window is invalid for the DOM adapter.

## Content Security Policy

The production library performs no network requests, injects no stylesheet, and uses no `eval` or `new Function`. Load the external script under your existing `script-src` policy. No inline event handler or unsafe-eval allowance is required. Strict environments can leave the optional SVG debug view off.

The demo has its own CSS and sets inline layout properties for playground positioning. Its optional preview server permits inline styles for that reason, not because the production library needs a blanket script-policy exception. Use your existing production headers; the demo server is not a production host.
