# Why a corridor, not a bigger invisible button

The problem has two parts: a panel can disappear between separate hit areas, and the pointer can cross unrelated rows on its way to that panel. Delaying every row by half a second fixes neither cleanly. It also makes intentional vertical movement feel slow.

HoverBridge separates **geometry**, **intent over time** and **UI ownership**.

## 1. Geometry

`src/core/geometry.ts` accepts only points and axis-aligned rectangles. `safeCorridor()` builds the convex hull of a small square around the departure point and the destination rectangle, both padded by the configured buffer.

A full polygon is more useful than a literal triangle. It includes the gap and the destination surface, tolerates small tracking noise, and works when the destination is above, below, left, right or offset. No fixed opening-side configuration is required. `facingSide()` is an optional informational helper, not a dependency of corridor calculation.

The departure point is the most recent sample inside an endpoint, not the center of its DOM element. Moving within a trigger continually updates it. On return travel the panel becomes the source and the trigger becomes the destination.

Rectangles are supplied fresh by the DOM adapter. The core knows nothing about viewport flipping, CSS positioning libraries or portals. A rotated visual element is represented by its axis-aligned bounding box, not an exact rotated hit shape. The adapter still requires an actual composed hit path to accept an endpoint.

## 2. Intent over time

`src/core/intent.ts` is deterministic: all coordinates and time are inputs.

```text
unprimed -> endpoint -> protected crossing -> endpoint
                          |
                          +-> outside / retreat / rest / timeout -> released
```

An endpoint never expires while it is actually reached. Outside it, the pointer must remain in the corridor. Meaningful progress updates the best distance and rest clock. Jitter within tolerance does not renew the clock; a deliberate retreat releases early. A maximum transit time bounds even a continually progressing crossing.

Pausing over a crossed sibling therefore selects it after the rest budget instead of holding the old panel forever. Leaving the corridor releases immediately; the DOM adapter can still apply its separate short close delay.

`deadline` is part of the contract. Motion-only logic never releases a stationary pointer because no new motion event arrives. The DOM adapter resamples at the returned deadline using the actual current hit target. A late sample checks the old deadline before accepting new progress, preventing timer starvation from reviving expired protection.

## 3. One owner of state

`src/dom/controller.ts` owns one sibling group. It discovers explicit trigger-target relationships or accepts element pairs directly. It selects which item is active, applies state markers and updates visibility unless the host supplies `render`.

It never steals global CSS hover state or cancels every event passing through a polygon. Unconditional `:hover` remains true under the physical pointer. The author uses `data-hoverbridge-active` for selection and can exclude `data-hoverbridge-blocked` from hover decoration.

The diagnostic polygon is a pointer-transparent SVG. It has no role in event routing. Therefore actual links, buttons and scroll gestures stay reachable while a corridor is active.

## 4. Nested panels and document events

`src/dom/hub.ts` maintains one listener set per registered document. Controllers share pointer, focus, dismissal and layout events. Depth ordering is calculated once per dispatch using active panel ancestry; closed scopes cannot become ancestors.

A child group belongs to a parent when its root lies within the parent's active panel. The child's panel may be elsewhere in that same document. A hovered, focused, pinned or guarded descendant keeps its ancestors alive. Escape closes the deepest relevant controller first. Closing a parent closes its active descendants.

This is relationship-aware event routing, not an arbitrary DOM-to-component-state bridge. Cross-document coordinates and native application windows need separate adapters.

## 5. Lifecycle and cost

The main and core package entries have no import-time DOM side effects. The explicit auto entry and browser script discover only marked scopes. Constructors validate options; ambiguous relationships produce diagnostics instead of guesses. Teardown records and restores only owned attribute writes that have not subsequently been changed by the host.

No continuous animation loop runs inside the library. Timers exist only for pending transitions. Closed scopes without candidates perform zero adapter rectangle reads in the tested idle scenario. Active geometry reads current rectangles rather than relying on stale placement caches. Discovery ignores document mutations containing only text nodes.

One document may still contain many registered controllers: dispatch and discovery work scales with those registrations, and complex nested trees cost more than a single pair. The Node benchmark measures the geometric core, not browser layout or arbitrary page performance.

The demo's counter refresh interval belongs to the demo, not to the library.

## Prior art and platform contracts

This is an independent implementation of an established interaction technique, not a claim to have invented safe hover corridors. No implementation code was copied from these projects:

- [Floating UI: useHover and safePolygon](https://floating-ui.com/docs/usehover) describes safe travel, intent and the tradeoffs of pointer-event blocking.
- [jQuery-menu-aim](https://github.com/kamens/jQuery-menu-aim) demonstrates distinguishing movement toward a submenu from ordinary sibling selection.
- [MDN: :hover](https://developer.mozilla.org/en-US/docs/Web/CSS/:hover) documents the physical hover pseudo-class.
- [MDN: Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) defines input modality and pointer behavior.
- [W3C: Understanding Content on Hover or Focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) explains dismissible, hoverable and persistent content.

See [limits](limits.md) for what these mechanisms do not establish, including full accessibility conformance and universal framework compatibility.
