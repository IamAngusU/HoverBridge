# Boundaries worth knowing before integration

**Zero setup is conditional, not magic.** One script plus one scope attribute is enough when the markup already identifies its panels and HoverBridge may own their state. Unknown relationships, private framework state and unrelated CSS cannot safely be guessed.

## State and styling

The browser's `:hover` pseudo-class still matches the element beneath the actual pointer. HoverBridge controls its own active selection and provides `data-hoverbridge-blocked` for authored CSS. It does not cancel arbitrary mouse/pointer handlers, override a framework's private store, or guarantee that a third-party component will accept its state.

Use one owner of opening/closing. Do not combine CSS hover visibility, a framework hover hook and the managed DOM controller on the same panel. For existing component libraries, use the read-only guard to observe movement while keeping their state machine, or integrate the DOM-free core directly.

## Accessibility

Focus inside an active endpoint/tree keeps it open. Escape closes the deepest relevant active controller and restores focus when dismissal came from inside that tree. Touch uses ordinary click/tap behavior instead of fake hover geometry. Keyboard Tab remains native.

Those behaviors are **not a complete accessible menu implementation**. HoverBridge does not add role semantics, arrow-key navigation, roving tabindex, focus traps or application-specific return-focus rules. Native menu widgets, disclosure navigation and tooltips have different requirements. The author must use suitable semantics and test assistive technology. No WCAG conformance certification, screen-reader matrix or user study was performed.

A true modal dialog should not be made dependent on a hover corridor. Its focus and dismissal model is different. HoverBridge's automatic surface is for hover-capable transitions, not for taking ownership of modal state.

## Geometry and time

The DOM adapter uses axis-aligned `getBoundingClientRect()` values in the pointer's viewport coordinate system. Current rectangles account for ordinary offset/flip/resize/scroll changes. Irregular shapes, rotated hit geometry, occlusion, animation frames with no pointer input, and multi-window coordinate conversion are not exact geometric proofs.

The adapter checks actual hit paths as well as geometry. A stationary pointer outside the corridor may still close after `closeDelay`. The rest and hard transit deadlines are deliberate tradeoffs, not measured universal human thresholds. Tune them for the product and test with real users. Large gaps and very slow travel can exceed defaults.

An asynchronously rendered panel can be unmeasurable during its first samples. Coordinate rendering with your host or use a custom adapter. A missing portal target added outside a manually observed root needs `refresh()`.

## Platform and lifecycle

- Browser interaction tests passed in Playwright Chromium, Firefox and WebKit on Windows; installed Chrome and Edge were checked separately. Exact runtimes are recorded in the [test report](testing.md). Safari on Apple hardware, physical pen hardware and a physical touch device were not tested.
- The core imports under Node and SSR. Native UI adapters, OS menus and cross-iframe protection are not implemented.
- Open Shadow DOM is explicitly supported and exercised. Closed roots require a component-owned adapter.
- Multiple independent library copies or overlapping auto installations are not independent state owners. Use a single registration strategy.
- The production script does not contact a server. A site's own telemetry or component callbacks remain outside the library's control.

## Demo and publication

The demo contains ordinary local scripts/CSS and no remote assets. Direct `file:` navigation of both the multi-file demo and the exported single HTML passed in Chrome 155 on Windows. The Node preview server was exercised separately through actual loopback HTTP requests.

This snapshot is not an npm publication, a remote GitHub repository, a signed release or a passing hosted CI run. The local logs are evidence of the tested build, not evidence of every possible integration.
