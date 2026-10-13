# API · 0.2.0-alpha.3

## Entry points

| Entry | Exports / effects |
| --- | --- |
| `@iamangusu/hoverbridge` | `createHoverBridge`, `connectHoverBridge`, `createHoverBridgeGuard`, `autoHoverBridge`, geometry, `IntentTracker`, types. No browser side effects on import. |
| `@iamangusu/hoverbridge/core` | DOM-free geometry and intent. Safe to import in Node or SSR. |
| `@iamangusu/hoverbridge/guard` | Read-only DOM guard and its types, without managed-menu imports. |
| `@iamangusu/hoverbridge/auto` | `start()`, plus automatic document registration at DOM readiness. No-op in SSR. |
| `dist/hoverbridge.browser.js` | Self-contained classic script. Adds `globalThis.HoverBridge`, starts explicit-scope discovery. Does not replace an existing global of that name. |

The package is not published to the npm registry. Install the pinned [GitHub release archive](install.md#application-with-a-build-step) or a local folder. ESM and TypeScript declarations are shipped; CommonJS `require()` is not a supported package entry.

## `createHoverBridge(root, options?)`

`root` is an HTML element in a window-backed document. It identifies one sibling group. Existing `aria-controls` or `popovertarget` relationships are discovered within that group. Exactly one target ID is accepted. A panel cannot contain its own trigger. Buttons inside a controlled panel are excluded from the outer group; give them a nested group instead.

The factory is idempotent per root in this module instance: the existing live handle is returned. **The first options win.** Use the handle setters for supported runtime changes, or destroy and recreate. Do not load several independent copies of the library onto the same components.

Without `render`, managed panels start closed. Original attributes are recorded for teardown. With `render`, initial visibility remains the host's responsibility; start closed and keep state synchronized.

### Options

| Option | Default | Meaning |
| --- | --- | --- |
| `items` | discovered | Explicit `{ trigger, panel? }[]`; both endpoints must be HTML elements in the same document. Omit `panel` for a leaf item. No selector guessing. |
| `buffer` | `6` | Corridor tolerance in CSS pixels, range 0..128. Larger values forgive more deviation, but can delay nearby intentional selection. |
| `restMs` | `360` | Maximum time without meaningful progress inside a crossing, range 1..60000 ms. |
| `maxTransitMs` | `1800` | Hard time bound for one crossing, range 1..60000 ms. Does not expire while actually inside an endpoint. |
| `retreatTolerance` | `10` | Allowed increase over the best distance reached, in CSS pixels, range 0..256. |
| `openDelay` | `0` | Delay before hover activation, range 0..60000 ms. Cancelled when the candidate is left. Not applied to click, focus or API opening. |
| `closeDelay` | `120` | Short leave grace outside both endpoints and their safe corridor, range 0..60000 ms. |
| `intent` | `true` | Trajectory protection. `false` keeps ordinary hover/click/focus behavior for comparison. |
| `enabled` | `true` | Whole controller input handling. Disabling closes its active item. |
| `openOnFocus` | `true` | Keyboard-driven focus opens the associated panel. Never implements a focus trap or roving tabindex. |
| `clickToPin` | `true` | Clicking a panel trigger pins it until a second click, dismissal, Escape or API closure. Clicking a leaf releases the previous panel. |
| `debug` | `false` | Draws the current corridor as a pointer-transparent SVG. Diagnostic only. |
| `observe` | `true` | Observe item relationships and controlled panel hiding. With `false`, call `refresh()` after structural/attribute changes; shared document cleanup still removes detached roots. |
| `render` | built-in | Callback that replaces visibility changes, not discovery, ARIA or state markers. See controlled ownership below. |
| `onChange` | none | Notification for each open/close transition, excluding initial discovery and destroy. |
| `signal` | none | AbortSignal; abort destroys the controller. An already-aborted signal leaves no installed controller. |

Finite numeric options are validated eagerly; invalid values throw `RangeError`. Invalid endpoint objects or duplicate triggers throw `TypeError`. Disabled, `aria-disabled="true"`, inert or ignored triggers are not activated.

### Handle

```ts
bridge.open(trigger);       // registered trigger only; no pin; throws if unknown
bridge.close();             // dismiss; suppress reopening until trigger is left
bridge.setItems(nextItems);  // replace explicit bindings; null resumes discovery
bridge.setOptions({ buffer: 10, closeDelay: 160 }); // live numeric tuning
bridge.refresh();           // discover new relationships / explicit item changes
bridge.setEnabled(false);   // disable and close
bridge.setIntent(false);    // disable geometry only
bridge.setDebug(true);      // show corridor, never intercept pointer input
bridge.resetMetrics();
bridge.destroy();           // idempotent teardown
```

Destroy clears timers, owned observers, abort listeners and debug drawing. The shared document event hub is removed after its last controller. Managed attributes are restored only while they still equal HoverBridge's last write; later host writes are preserved. Custom `render` state is not rolled back automatically. Unmount cleanup remains the host's responsibility.

Properties return snapshots: `active` (trigger or null), `state`, `metrics`, `warnings`, `destroyed`; `root` is the registered root.

`setOptions()` accepts `buffer`, `restMs`, `maxTransitMs`, `retreatTolerance`, `openDelay` and `closeDelay`. Omitted values retain their current setting. Values use the same validation and ranges as the constructor. Updating clears an in-progress corridor and rechecks the current pointer; active selection is preserved.

`connectHoverBridge(trigger, panel, options?)` is shorthand for a single explicit managed item. It returns the same controller handle and does not require an ID or discovery attribute.

`state` contains `{ active, panel, guarding, pinned, enabled, reason }`. The reason is the most recent geometric decision, or `idle`; it is not a prediction confidence or a user intention score.

### Events and callbacks

`onChange` and `render` receive:

```ts
{ trigger, panel, open, reason }
```

Reasons: `pointer`, `focus`, `click`, `escape`, `outside`, `leave`, `ancestor`, `disabled`, `removed`, `api`.

`hoverbridge:change` bubbles from the scope with that payload in `event.detail`. `hoverbridge:intent` emits on guard state changes with `{ guarding, reason, polygon }`. Both are composed events, so they can cross an open shadow boundary. They are notifications, not cancellation hooks. Use `render` or the core to own state.

Callbacks are synchronous. They can tear down a controller. Keep them short and do not throw: host exceptions are surfaced, not silently swallowed or converted to successful transitions. Asynchronous visibility commits can leave the core without a measurable target during the first crossing; coordinate host rendering or use the headless integration.

### State attributes

| Element | Attribute |
| --- | --- |
| Active trigger | `data-hoverbridge-active` |
| Pinned trigger | `data-hoverbridge-pinned` |
| Inactive sibling during a corridor | `data-hoverbridge-blocked` |
| Scope while guarding | `data-hoverbridge-guarding` |
| Open panel | `data-hoverbridge-open` |
| Panel trigger | `aria-expanded="true"` / `"false"` |

Plain panels use `hidden`. Native `[popover]` panels use `showPopover()` and `hidePopover()` when supported. A managed `popovertarget` click is handled once rather than also running the browser's default toggle. External native dismissal is reflected in controller state.

No `role`, tabindex, focus trap, stylesheets or global pointer-event blocks are injected.

### Warnings

`warnings` reports skipped relationships rather than guessing:

- `missing-target`: referenced ID not found.
- `multiple-targets`: zero or multiple target IDs; HoverBridge needs exactly one.
- `invalid-target`: target is not a valid separate HTML panel.

With a manual controller, call `refresh()` after a missing portal target is inserted outside the observed root. Automatic document discovery also reacts to inserted elements. IDs must be unique in their lookup tree.

## `autoHoverBridge(root?, options?)`

`root` defaults to `document`. It can also be an HTML element or an explicitly supplied open ShadowRoot. Only `[data-hoverbridge]` scopes are managed. Unmarked menus, popovers and dialogs are untouched.

Returns `{ controllers, refresh, destroy }`. Repeated calls for the same discovery root reuse the live installation; the first options win. Auto discovery does not descend into shadow roots or frames. Register each open shadow root explicitly.

The classic script already starts a document installation.

### Markup tuning

Each marked scope can override four common numeric options at creation:

| Scope attribute | Option | Unit |
| --- | --- | --- |
| `data-hoverbridge-buffer` | `buffer` | CSS pixels |
| `data-hoverbridge-rest-ms` | `restMs` | milliseconds |
| `data-hoverbridge-open-delay` | `openDelay` | milliseconds |
| `data-hoverbridge-close-delay` | `closeDelay` | milliseconds |

For live changes use the controller's `setOptions()`; changing these attributes on an existing scope does not reconfigure it. Use the side-effect-free ESM factory on an unmarked root for other per-component constructor options. Prefer one auto installation per document/tree; overlapping installations share controllers, so destroying one can dispose a controller reused by another. They are not independent owners.

## `createHoverBridgeGuard(trigger, panel, options?)`

This adapter is for a component that already manages selection, opening and closing. It only reads pointer movement and endpoint rectangles. It does not mutate the DOM, intercept input or control visibility. All guards in a document share a passive pointer subscription set. Both endpoints must be distinct HTML elements in the same window-backed document.

```ts
const guard = createHoverBridgeGuard(trigger, panel, {
  buffer: 6,
  restMs: 360,
  onChange: ({ hold, reason }) => {
    if (!hold) reconsiderClosing();
  },
});

guard.update(openingPointerEvent); // optional: seed from a host event
guard.refresh();                   // after making the panel measurable
if (guard.shouldHold()) return;    // in a host leave/switch handler
guard.setEnabled(false);
guard.destroy();                   // on unmount; also accepts AbortSignal
```

`state` is `{ hold, reason, polygon, deadline }`. `hold` covers source, target and corridor; `reason` explains the last sample. `onChange` runs when protection starts, ends or changes endpoint/corridor reason. A timer rechecks stationary pointer positions at the next deadline. Pointer contact, cancellation, page blur and leaving the viewport release the guard. The host must still handle focus, keyboard, touch, intentional clicks and panel visibility. Call `refresh()` after an async render or layout change. The guard cannot protect a panel that is still hidden or has an empty rectangle.

## Headless `IntentTracker`

```ts
import { IntentTracker } from '@iamangusu/hoverbridge/core';

const intent = new IntentTracker({ buffer: 6, restMs: 360 });
const result = intent.sample({
  point: { x: 130, y: 150 },
  source: { left: 40, top: 100, right: 200, bottom: 140 },
  target: { left: 250, top: 80, right: 450, bottom: 340 },
  time: monotonicTimeInMilliseconds,
});
```

Prime it with an actual source/target sample first. Return value:

- `hold`: whether this sample belongs to an endpoint or a currently protected crossing.
- `reason`: `source`, `target`, `corridor`, `unprimed`, `outside`, `retreat`, `rest`, `timeout` or `invalid`.
- `polygon`: current convex corridor or an empty array.
- `deadline`: absolute timestamp for the next required check, or null.

The host must schedule `deadline` and resample the last pointer when it fires. Otherwise a stationary user produces no event to release the corridor. Late samples cannot revive an expired crossing; actually entering an endpoint still re-arms it. Use a monotonic clock and one coordinate system for all rectangles and points. Nonfinite values, reversed time, and empty/invalid rectangles release and reset the tracker. `reset()` clears its history.

The core does not inspect DOM visibility, hit targets, focus, pointer types or nested groups. An adapter must supply those checks. Geometry alone cannot tell whether another element covers the target.

## Metrics

| Counter | What it counts |
| --- | --- |
| `pointerSamples` | Eligible pointer dispatches processed while this scope is active or contains a candidate. Boundary and move events can share coordinates. |
| `protectedSamples` | Decisions retaining the active item inside a corridor, including deadline resampling. Not unique mouse positions. |
| `deferredSwitches` | Distinct competing candidates encountered within a continuous guard. Not people, clicks, mistakes, or guaranteed prevented switches. |
| `opens`, `closes` | Actual item state transitions, including leaf activation; initial discovery and destroy are excluded. |
| `layoutReads` | Calls made by this adapter to `getBoundingClientRect()`. Not all browser layout work. |

Counters live in memory and reset on reload or `resetMetrics()`. They are never stored or uploaded by the library.
