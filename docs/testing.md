# Tested behavior · 0.2.0-alpha.3

Local Windows verification, 13 October 2026. These results describe this source snapshot and the listed browsers. The [workflow badge](https://github.com/IamAngusU/HoverBridge/actions/workflows/ci.yml) reports hosted CI separately; neither is a cross-device certification.

| Check | Result |
| --- | --- |
| TypeScript build | Passed with TypeScript 5.8.3. |
| Core, package and preview server | 65 passed, 0 failed. |
| Playwright Chromium 143.0.7499.4 | 61 browser interactions passed. |
| Playwright Firefox 144.0.2 | 61 browser interactions passed. |
| Playwright WebKit 26.0 | 61 browser interactions passed. |
| Google Chrome 155.0.8059.40 | 61 browser interactions passed. |
| Microsoft Edge 155.0.4283.45 | 61 browser interactions passed. |
| Geometry | 20,000 seeded cases inside one core test. |
| Runtime dependencies | None. |

The browser suite exercises diagonal crossings, four panel directions, deliberate sibling clicks, leave and rest timing, keyboard and Escape, touch emulation, pen hover events, nested and portaled panels, native popovers, Shadow DOM, dynamic bindings, teardown, the read-only guard, and live/per-scope tuning. The same 61 checks pass in each Playwright engine. Empty `pointerType` is accepted as an unclassified hovering pointer, as allowed by the [Pointer Events specification](https://www.w3.org/TR/pointerevents2/); touch and pen contact still do not activate hover intent.

[Full engine-matrix log](evidence/browser-matrix-alpha3.log) · [Chrome log](evidence/chrome-alpha3.log) · [Edge log](evidence/edge-alpha3.log)

## Run the checks

```sh
npm ci
npm run browsers:install
npm run check
```

`check` runs `build`, `test` and `test:browsers` in that order. The matrix uses bundled Chromium, Firefox and WebKit. `npm run test:browser` runs one engine; select it with `HOVERBRIDGE_BROWSER=firefox` or `webkit`. To check an installed Chromium-based browser, set `PLAYWRIGHT_EXECUTABLE_PATH` to its executable before `npm run test:browser`. On PowerShell:

```powershell
$env:PLAYWRIGHT_EXECUTABLE_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:browser
Remove-Item Env:PLAYWRIGHT_EXECUTABLE_PATH
```

Node.js 24.5.0, npm 11.5.1 and Playwright Core 1.57.0 were used for this run. The package supports Node 20+ for development tools. Firefox needed permission to spawn its browser process in this managed test environment.

## Size and core benchmark

The self-contained browser script is **61,847 bytes raw, 12,673 bytes gzip, 10,883 bytes Brotli**. Separately compressed DOM-free core modules total **9,188 bytes raw, 2,971 bytes gzip**. These are gzip level 9 and Brotli quality 11 results; actual transfer depends on server compression. [Machine-readable size report](evidence/sizes.json).

On this Windows machine (Node 24.5.0, Intel Core i9-12900K), the median of 11 batches of 100,000 calls was **1.19 µs** per `safeCorridor` sample and **0.84 µs** per synthetic `IntentTracker` path sample. These microbenchmarks include core allocations but exclude browser events, styling, layout and rendering. They are not end-to-end latency, FPS, a guaranteed threshold, or a comparison to another library. Shared-host results can vary. [Machine-readable benchmark and methodology](evidence/benchmark.json).

## Demo evidence

The included demo has local scripts and CSS only. The original multi-file demo and exported standalone HTML were opened through `file:` in Chromium on Windows and exercised with the same smoke interaction, including the live tolerance control. The preview server was checked separately over loopback HTTP in the earlier alpha.2 run. The README screenshot is a real Chromium render with corridor debugging enabled; the technical diagram is an explanatory schematic. Neither graphic represents a timing benchmark or user study.

Physical pen and touch hardware, Safari on Apple hardware, assistive technology, and arbitrary third-party component libraries were not tested. A framework that owns its own menu state must consult the guard's `shouldHold()` or `onChange`; the guard does not change host state. The original [0.1.0-alpha.1 record](testing-alpha1.md) remains for historical comparison.
