# Development and deployment

Project context is in the maintainer's InfoHub workspace; locate it via `~/.config/infohub/config.json`. See [AGENTS.md](AGENTS.md).

The page talks only to the InfoHub Web API. Its contract, the server configuration and the deployment of this page's build are documented in work-ontology [`server/WEB-API.md`](https://github.com/lpmasser/work-ontology/blob/main/server/WEB-API.md); follow that document rather than a copy here.

## Checks

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm --filter @otterly/markdown-editor check
pnpm lint
pnpm test
```

GitHub Actions runs the same checks and a build.

## Local development

1. Start an InfoHub Web service from a work-ontology checkout: `INFOHUB_WEB_CONFIG=<config.json> node server/web.mjs`. Point its user at a scratch clone of an InfoHub repository whose `origin` is another scratch bare repository, never at a real workspace or remote: the clone's background sync commits and pushes idle changes. Set the config's `origin` to `http://127.0.0.1:5173` (the dev server below) and its `port` to `3999`, or set `INFOHUB_WEB_API` to where it listens.
2. `pnpm dev` serves the page at `http://127.0.0.1:5173` and forwards `/api` to the Web service, so page and API share one origin as in production.

## Build and deploy

`pnpm build` writes the static single-page build to `build/`. Deploy the contents of `build/` (index.html, `_app/` and the rest, without the folder itself) as described in the "前端构建产物部署" section of `server/WEB-API.md`: upload new hashed assets first, replace `index.html` last, keep older assets for pages already open.
