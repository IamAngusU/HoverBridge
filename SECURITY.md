# Security

For a sensitive vulnerability report, contact **hello@angusu.de** rather than posting credentials or private application content publicly. Include the affected version and a minimal reproduction. No response-time SLA is promised for this prerelease.

The runtime has no network or storage APIs and no dynamic source evaluation. It owns only explicitly registered hover state. Host callbacks, third-party components, injected page scripts and the surrounding site's security are separate trust boundaries.

The optional preview server binds to loopback and serves a small set of local documentation/demo/build paths. It is a development helper, not a production server. Do not expose it by reverse proxy as a general file host.

Keep scope ownership explicit. Automatic takeover of every arbitrary popover would be a compatibility and input-routing risk, not a security feature. This library does not provide an isolation boundary against other scripts in the same page.
