# Deployment and release

## Add to an existing site

1. Download the exact `hoverbridge.browser.js` asset from a [versioned release](https://github.com/IamAngusU/HoverBridge/releases). Optionally verify it with the adjacent `.sha256` file.
2. Serve it from a versioned path on your own site, for example `/vendor/hoverbridge/0.2.0-alpha.3/hoverbridge.browser.js`.
3. Add `data-hoverbridge` to the selected menu group. Keep unique `aria-controls` or `popovertarget` relationships and style `data-hoverbridge-active`.
4. Check diagonal travel, deliberate sibling clicks, keyboard focus, Escape, touch fallback and teardown in the real page. To roll back, restore the previous script URL, scope attributes and any host CSS changed for the integration.

The browser file needs no backend process, database migration, runtime dependency or network call. Do not deploy development scripts or `node_modules` into the site's document root. [Copy-ready installation](install.md).

## CI and evidence

[CI](../.github/workflows/ci.yml) is configured for pushes to `main`, pull requests and manual dispatch. It tests the browser matrix on Windows, Linux and macOS with Node 24, verifies the package on Node 20, smoke-tests both demo forms, and checks `npm pack`. Linux uploads measured size and DOM-free benchmark JSON as run artifacts. GitHub currently refuses to start jobs on IamAngusU because of an account billing lock. The identical commit is pushed to the public [angusu-de/HoverBridge-CI mirror](https://github.com/angusu-de/HoverBridge-CI), where Actions can run. Each mirror job first compares its commit with `IamAngusU/HoverBridge` `main` and fails if they differ. Its GitHub-generated badge in the README reflects the mirror's actual workflow status. For each release, also confirm the mirror's run SHA equals the source tag's commit before citing it as release evidence; a later source-only push can make an older green badge stale.

The workflow uses read-only repository permission, pinned official actions and no publication secret. It does not automatically publish to npm or create a release.

## Make a release

1. Run `npm ci`, `npm run browsers:install`, `npm run check`, `npm run metrics` and `npm run demo:capture` locally.
2. Commit the source and generated `dist/` files. Push `main` to IamAngusU, push the exact same commit to the public CI mirror, and wait for the mirror's CI run to pass. Compare the full SHAs.
3. Tag that exact commit as `v0.2.0-alpha.3`. From the clean checkout, run `npm run release:bundle`.
4. The ignored `release/v0.2.0-alpha.3/` directory contains the browser file, standalone HTML, npm archive, source ZIP, per-file manifest and SHA-256 checksums. Review the files, then push the tag and create a GitHub prerelease with those assets.
5. Download the published browser file and npm archive from the release, verify their hashes, and smoke-test the public URLs. Link the published tag from the README.

`release:bundle` refuses a dirty checkout and archives the exact Git commit. The checksum manifest records that commit and every local asset's hash. It does not assert a hosted CI result; the run URL and matching SHA are the proof of CI. When GitHub unlocks Actions on IamAngusU, the primary workflow can run there again.

The npm package is not published to the npm registry in this prerelease. The release archive and GitHub tag are the versioned installation sources. Publishing to npm later requires a separate account and publication decision.
