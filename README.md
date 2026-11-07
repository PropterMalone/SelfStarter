# SelfStarter

Analyze a public Bluesky account’s interactions, adjust ranking weights, review selected accounts, and publish a starter pack. Public analysis does not require sign-in. Publishing uses Bluesky/AT Protocol OAuth: enter your handle and authorize on your account’s server; SelfStarter never collects passwords.

## Development

Requires Node.js 22 or newer.

```sh
npm ci --ignore-scripts
npm run dev -- --host 127.0.0.1
npm test
npm run lint
npm run build
```

Open the Vite URL with `/SelfStarter/`. OAuth uses a local loopback client and IP callback, not the production callback. No environment variables or client secrets are required.

See [OAuth migration and acceptance gates](docs/oauth-migration.md) for the architecture, exact production metadata URLs, security caveat, and outstanding live acceptance checks. The recovered project uses ESLint/Prettier/Vitest; it does not have an aggregate `validate` or dead-code script.
