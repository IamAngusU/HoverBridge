# npm publication

The public package is `@iamangusu/hoverbridge`, owned by npm user `iamangusu`.
Alpha releases use the `alpha` dist-tag. Pin a version for reproducible installs:

```sh
npm install @iamangusu/hoverbridge@0.2.0-alpha.4
```

For a release, test and commit the source, wait for the matching public CI run,
and run `npm run release:bundle` from the clean tagged checkout. Publish that
exact tarball with `--access public --tag alpha`, check the registry's SHA-512
integrity against it, and install in a fresh consumer project. GitHub assets
retain the browser script, npm archive, source ZIP and SHA-256 checksums.

Authentication belongs in a process-scoped environment and an npm config that
references the environment variable. Never commit a token. For future OIDC
publishing, configure the actual workflow repository in npm after its runner
can start; the CI mirror is not automatically authorized to publish.

[npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).
