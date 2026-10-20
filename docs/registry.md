# npm publication

The public package is `@iamangusu/hoverbridge`, owned by npm user `iamangusu`.
Alpha releases use the `alpha` dist-tag. Pin a version for reproducible installs:

```sh
npm install @iamangusu/hoverbridge@0.2.0-alpha.4
```

The registry currently also points `latest` at this prerelease. A freshly
authenticated removal, including a security-key confirmation, was rejected by
the npm registry with HTTP 400 on 2026-10-20. The version remains an alpha;
use the explicit version above rather than treating `latest` as a stability claim.

For a release, test and commit the source, wait for the matching public CI run,
and run `npm run release:bundle` from the clean tagged checkout. Publish that
exact tarball with `--access public --tag alpha`, check the registry's SHA-512
integrity against it, and install in a fresh consumer project. GitHub assets
retain the browser script, npm archive, source ZIP and SHA-256 checksums.

`npm run package:smoke` tests a newly packed archive offline before publication.
Pass an existing archive as `npm run package:smoke -- /path/to/package.tgz` to
test those exact bytes instead. The command requires a build and development
dependencies in the checkout; its consumer uses only the installed archive.

## Verified first release

`0.2.0-alpha.4` was published on 2026-10-20. The public registry tarball matches
the archive in the [GitHub release](https://github.com/IamAngusU/HoverBridge/releases/tag/v0.2.0-alpha.4)
and has this SHA-512 integrity:

```text
sha512-zE1C4S3bCpKGvhs6sAvyQSWC8kMYKJefm4Hx6cOps/KM9C4cPYLH2iU/kL5LOTcvZQIoiV6VjcN2bnEYz+t99Q==
```

A fresh registry installation passed ESM imports for the main, core, guard and
auto entries, SSR-safe auto initialization, a diagonal pointer trajectory and
strict TypeScript consumer compilation. The [release CI run](https://github.com/angusu-de/HoverBridge-CI/actions/runs/39367838573)
passed at source commit `efc3946d9819fe26d8c802b700a8af23621c4a6a`.
Both public playground URLs serve the exact standalone release HTML; hosted
hover behavior and protection, debug and tolerance controls were smoke-tested.

## Credentials

Authentication belongs in a process-scoped environment and an npm config that
references the environment variable. Never commit a token. For future OIDC
publishing, configure the actual workflow repository in npm after its runner
can start; the CI mirror is not automatically authorized to publish.

[npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).
