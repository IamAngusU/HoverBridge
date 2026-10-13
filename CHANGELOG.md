# Changelog

## 0.2.0-alpha.3

- Published a versioned, self-hostable GitHub prerelease with a browser script, standalone playground, npm archive, source ZIP and SHA-256 manifest.
- Added copy-ready installation guidance, a pinned and read-only CI workflow, and a live badge from a public commit-matched CI mirror while Actions on IamAngusU are blocked by account billing.
- Added `npm run metrics` for reproducible bundle-size and DOM-free core measurements, with run artifacts in CI.
- Added repeatable release bundling and smoke checks for both the source demo and exported single-file playground.
- Preserved a pending hover opening across a layout notification when the pointer still hits the same trigger; added a browser regression check.

This release remains an alpha and is not published to the npm registry.

## 0.2.0-alpha.2

- Added per-scope markup tuning for corridor tolerance, rest time and hover delays, plus `setOptions()` for live numeric changes.
- Added a playground tolerance control and a technical README diagram based on the Bloom plot style.
- Added a local Chromium, Firefox and WebKit test command. Fixed hover handling when a browser reports an empty Pointer Events `pointerType`.
- Refreshed setup, browser support and release documentation.

This remains a local source release candidate; no npm or GitHub publication is implied.

## 0.2.0-alpha.1

- Added `createHoverBridgeGuard()` and the `/guard` entry for components that own their own menu state. It shares passive document listeners, skips layout reads for idle guards, reports source/target/corridor intent, and releases stationary crossings on time without changing DOM state.
- Added `connectHoverBridge()` for a single managed trigger/panel pair without discovery markup.
- Added `setItems()` to replace explicit bindings during component updates and return to attribute discovery with `null`.
- Expanded browser interaction coverage for the new paths and refreshed integration guidance.

This is a local source release candidate. No npm or GitHub publication is implied.

## 0.1.0-alpha.1

Initial repository-ready snapshot. Not yet published to npm or uploaded by this build process.

- DOM-free convex corridor geometry and deterministic intent tracker with rest, retreat and hard-transit release.
- Explicit-scope browser discovery, manual element bindings and controlled-visibility callback.
- Shared document events, nested same-document portals and explicit open ShadowRoot registration.
- Native popover integration, keyboard focus persistence, deepest-first Escape and click/tap pinning.
- Reversible managed attributes, duplicate-initialization guards, AbortSignal support and component removal cleanup.
- Diagnostic polygon and memory-only counters with documented counting semantics.
- Local playground, ready-built classic script, ESM/types, tests, measured sizes and reproducible core microbenchmark.

Release boundaries: no native UI adapters, no universal framework takeover, no complete ARIA menu widget, no Firefox/WebKit verification and no hosted CI claim. See `docs/testing.md` for the execution record.
