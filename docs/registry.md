# npm publication

The package is not on npm yet. Use the checked release archive until this page
and the installation guide link to an actual registry release.

Create an npm account with two-factor authentication and ownership of the
`@iamangusu` user/organization scope. The first release can be published from
the reviewed checkout after `npm ci`, `npm run check` and `npm pack --dry-run`:

```sh
npm login
npm publish --access public --tag alpha
```

Keep the alpha dist-tag; do not make this prerelease `latest`. Inspect the
pack output and verify the published tarball before changing README commands.
For subsequent automation, configure npm Trusted Publishing for the actual
runner repository and exact workflow filename. A CI mirror is not implicitly
authorized to publish the canonical package.

[npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).
