# mcp-forge

A Claude Code plugin for building MCP (Model Context Protocol) servers, so a product works inside Claude and ChatGPT: plan the tools, scaffold a tested TypeScript server, and review existing servers. Open source (MIT).

## Install

```
/plugin marketplace add fmolinoferrer/felipe-plugins
/plugin install mcp-forge@felipe-plugins
```

Requires Node 20+ and npm for scaffolding and running generated servers.

## Commands

### `/mcp-forge:new <API name | OpenAPI URL | file>`

Reads the API docs or spec, then **stops and shows a tool plan for approval**: a table of tools marked read or write, inputs, endpoints and exclusions. Writes are always a propose/confirm pair (`propose_x` returns a preview plus a single-use `confirm_token` and makes no changes; `confirm_x` executes exactly that preview). Auth comes from env vars only. After you approve, it runs `scripts/scaffold.mjs` to copy `templates/server-ts/` into `./<name>-mcp`, fills it in, and runs `npm install && npm test && npm run smoke`.

```
/mcp-forge:new https://api.example.com/openapi.json
/mcp-forge:new HubSpot CRM, read contacts and deals, update deal stage
```

Scaffolder on its own:

```
node scripts/scaffold.mjs --name northwind-crm --title "Northwind CRM" --env-prefix NORTHWIND_CRM
```

### `/mcp-forge:review [path]`

Reviews an existing MCP server against `templates/review-checklist.md`: tool names, descriptions, input schemas, outputs, error handling, auth and secrets, write-tool safety, transport, tests, docs. Runs the tests and a `tools/list` if it is safe to, never calls write tools, and writes `mcp-review.md` with Critical/High/Medium/Low findings that cite file and line.

```
/mcp-forge:review ./northwind-crm-mcp
```

### Need a server built for you?

Custom MCP server builds and maintenance are offered as a fixed-price service by Felipe Molino.

## What's bundled

| Path | Purpose |
|---|---|
| `templates/server-ts/` | Server template: stdio, `@modelcontextprotocol/sdk`, zod, `ConfirmStore` for propose/confirm, read-only switch, node:test tests over an in-memory MCP client, stdio smoke script, README, `.env.example` |
| `scripts/scaffold.mjs` | Copies the template and fills `{{NAME}}`, `{{TITLE}}`, `{{ENV_PREFIX}}`, `{{DESCRIPTION}}`; refuses to overwrite |
| `examples/open-meteo-mcp/` | Working example (no API key): `geocode`, `get_forecast`, with unit tests and a real stdio smoke test |
| `templates/review-checklist.md` | Review checklist |

Try the example:

```
cd examples/open-meteo-mcp
npm install && npm test && npm run smoke
```

## Limits

- Generates TypeScript stdio servers only. No Python template, and no remote HTTP or OAuth hosting scaffold yet.
- Confirm tokens are kept in memory, so they are lost on restart and are not shared across server instances.
- `/mcp-forge:new` relies on the API docs it can reach. Endpoints it cannot verify are marked `UNVERIFIED`, and you should check them against a sandbox.
- Third-party API terms, for example Open-Meteo's non-commercial free tier, are the user's responsibility.
