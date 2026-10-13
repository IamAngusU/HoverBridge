# Install HoverBridge

HoverBridge is self-hosted. The browser build is one JavaScript file with no runtime dependencies, account, CDN, background service or package manager on the visitor's device. This prerelease is distributed from its [versioned GitHub release](https://github.com/IamAngusU/HoverBridge/releases), not the npm registry.

## Plain HTML, PHP or a static site

Download the exact [browser script for v0.2.0-alpha.3](https://github.com/IamAngusU/HoverBridge/releases/download/v0.2.0-alpha.3/hoverbridge.browser.js) and save it as `public/vendor/hoverbridge.browser.js`. If you already use GitHub CLI, one command does that:

```sh
gh release download v0.2.0-alpha.3 --repo IamAngusU/HoverBridge --pattern hoverbridge.browser.js --dir public/vendor
```

Serve the file from your own site and mark only the menu you want it to manage:

```html
<script defer src="/vendor/hoverbridge.browser.js"></script>

<nav data-hoverbridge>
  <button type="button" aria-controls="tools" aria-expanded="false">Tools</button>
</nav>
<section id="tools" hidden>Tools panel</section>
```

Your CSS positions the panel. The trigger/panel relationship comes from an existing `aria-controls` or `popovertarget` attribute. For a small menu that needs more tolerance, add `data-hoverbridge-buffer="10"` to its `nav`; see [markup tuning](api.md#markup-tuning).

You can verify the downloaded script against the release's `hoverbridge.browser.js.sha256`. Download that file into the same directory, then run `sha256sum -c hoverbridge.browser.js.sha256` there. On Windows PowerShell, compare `(Get-FileHash .\hoverbridge.browser.js -Algorithm SHA256).Hash` with the hash in the checksum file. GitHub also shows the release tag and the source commit. Do not execute an installer piped from a URL.

## Application with a build step

Install the pinned release archive, then import the managed controller or the read-only guard:

```sh
npm install https://github.com/IamAngusU/HoverBridge/releases/download/v0.2.0-alpha.3/iamangusu-hoverbridge-0.2.0-alpha.3.tgz
```

```ts
import { createHoverBridge } from '@iamangusu/hoverbridge';

const bridge = createHoverBridge(menuElement);
// Component cleanup:
bridge.destroy();
```

The archive contains ESM and TypeScript declarations. It is not an npm registry publication; `npm install @iamangusu/hoverbridge` does not refer to this release. For a source-based dependency you can pin the same tag with `npm install github:IamAngusU/HoverBridge#v0.2.0-alpha.3`. That route requires Git.

## Update or remove

To update the browser integration, download a newer version into a new static path, switch the page's script URL and test the menu. Remove the old file after the page is serving the new one. To uninstall, remove the script include and `data-hoverbridge` attributes. Restore any host CSS hover visibility rules you removed during integration. A programmatic controller should always call `destroy()` when its component unmounts.

No installation step adds a service, writes browser storage, injects tracking, or makes network calls at runtime. [Integration details](integration.md) · [Boundaries](limits.md) · [Verification](testing.md).
