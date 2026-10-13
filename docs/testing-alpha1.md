# Tested behavior and measured cost

Version **0.1.0-alpha.1**. This is a local execution record, not a hosted CI badge, third-party audit or a claim of universal compatibility.

## Actual execution

| Check | Result |
| --- | --- |
| Strict TypeScript build | Passed, TypeScript 5.8.3. |
| Core, package and preview-server tests | **65 passed, 0 failed**; 157.541831 ms in the recorded run. |
| Real Chromium interaction tests | **53 passed, 0 failed**; 8991.589695 ms in the recorded run. |
| Total runner tests | **118 passed, 0 failed.** |
| Seeded randomized geometry | **20,000 cases** within one of those tests, with three containment invariants per case. Not 20,000 additional runner tests. |
| Local demo controls and screenshots | Passed in a real Chromium fixture loading the original assets. |
| Single-file demo export | Startup, panel activation, toggle controls and self-contained asset checks passed in a browser fixture. |

Raw output: [build](evidence/build.txt), [Node tests](evidence/unit-package-server.tap), [Chromium tests](evidence/chromium.tap), [summary JSON](evidence/summary.json).

The browser cases include all four opening sides, diagonal sibling crossing, gaps, deliberate vertical selection, return/focus behavior, rest expiry, click-through with trusted clicks, outside clicks, keyboard focus, Escape and re-entry, nested portal retention, deepest-first dismissal, native popovers, invalid/missing targets, disabled controls, dynamic items, removed roots, reversible attributes, aborts, repeated installation, custom render callbacks, callback-triggered teardown, open Shadow DOM, touch emulation, synthetic pen hover/contact, drag cancellation, native scrolling and runtime switches.

A regression found during development kept a trigger suppressed after Escape even after the pointer left and returned. The fix is covered by the re-entry test. Late core samples also have an explicit test preventing missed rest deadlines from reviving a crossing.

## Environment and reproduction

Recorded runtime: **v22.16.0**, Linux x64, **Chromium 144.0.7559.96**, TypeScript **5.8.3**, Playwright Core **1.57.0-beta-1764944708000**. The available Playwright runtime is a preinstalled beta, not silently relabeled as the stable development manifest version.

The manifest pins TypeScript 5.8.3 and Playwright Core 1.57.0 for a normal install. Registry access was unavailable during this build. Development used the preinstalled tools; there is no fabricated lockfile or claim of a clean registry install. Before release, generate and review a lockfile and rerun with the intended clean toolchain.

```sh
npm install
npm exec -- playwright-core install chromium
npm run check
npm run bench
npm run size
```

An existing browser can be selected with `PLAYWRIGHT_EXECUTABLE_PATH`. Select `HOVERBRIDGE_BROWSER=firefox` or `webkit` only after installing that engine. **Firefox and WebKit were not executed here.** Neither physical pen/touch hardware nor assistive technology was tested.

## Demo evidence

The included light/dark screenshots are actual Chromium renders, not mockups. Browser administrator policy in this environment rejects both `file:` and `http://127.0.0.1` navigation. No policy was changed. The capture harness instead reads the original local HTML and supplies its unmodified CSS and scripts to an `about:blank` page through Playwright.

The single-file export was likewise executed as original exported HTML through `page.setContent`. The Node preview server was tested separately through actual loopback HTTP requests. These checks establish browser behavior and server responses, **not a successful direct-navigation launch in this environment**.

[Original demo execution record](demo-check.json) · [Standalone export check](evidence/standalone-demo.json) · [Capture script](../scripts/capture-demo.mjs).

The demo loads no remote fonts, images, scripts or stylesheet. The capture records zero external HTTP(S) requests. Deliberately following an external footer link is navigation outside the demo's runtime.

## Package sizes

| Artifact | Raw bytes | gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: |
| Complete self-contained browser script | 51,521 | 11,238 | 9,695 |
| Core ESM modules, summed individually | 9,188 | 2,971 | 2,579 |

Compression settings are gzip level 9 and Brotli quality 11. Core compressed totals sum separately compressed emitted `.js` files, not an imaginary prebundled core artifact. Types, maps, source, docs and screenshots are excluded from these runtime figures. The npm archive is larger because it includes source and documentation. Actual transfer savings require server compression.

[All module sizes, SHA-256 and SHA-384 integrity](evidence/sizes-alpha1.json).

Browser script SHA-256:

```text
eeb658e4a5f2ec6a7e5097bee0a99cfd80fc10cf2110cbccb0b8774e5fe58149
```

## Core timing, not a UI latency claim

Measured on **AMD EPYC 9V74 80-Core Processor** under **v22.16.0**, linux x64. Each benchmark has two 10,000-sample warmups followed by 11 batches of 100,000 samples.

| Operation | Median µs per sample | Batch min..max µs |
| --- | ---: | ---: |
| Safe corridor construction | 0.645 | 0.620..0.725 |
| Intent tracker, mixed trajectory | 0.514 | 0.505..0.536 |

The intent trajectory repeats source, diagonal, gap and target samples: 50% endpoint handling and 50% corridor work. It includes core allocations. It excludes DOM events, styles, layout and painting, so it is **not** input-to-display latency, FPS or a comparison with another library. Shared-machine timing and other hardware will vary. [Raw batches](evidence/benchmark.json) · [Benchmark source](../scripts/bench.mjs).

## Idle behavior and telemetry

A dedicated browser test verifies zero adapter rectangle reads when the pointer moves outside a closed scope. This is not a claim of zero CPU work for arbitrarily many registrations. The runtime has zero declared runtime dependencies, no network/storage APIs and no continuous animation loop. The demo refreshes its own counters on an interval.

Counters describe internal events, not actual human error prevention. No user study or saved-time metric is claimed.

## Local package consumer

The actual local npm archive was installed offline into a separate consumer folder. Strict TypeScript imports and types, main/core/auto Node SSR imports, a tracker sample, and the installed browser script hash passed. This is a local archive check, not a registry publication. [Record](evidence/package-smoke.json).

## Publication status

No remote GitHub repository was created by this session. No npm package or hosted CI run was published. The CI file in `docs` is an inactive manual template. See [deployment](deployment.md) for the exact static file rollout and repository creation commands.
