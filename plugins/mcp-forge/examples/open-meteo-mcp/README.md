# open-meteo-mcp

Working example MCP server for the free [Open-Meteo](https://open-meteo.com/) APIs (no API key). Built with TypeScript, `@modelcontextprotocol/sdk` and `zod`, over stdio. It has the same file layout as the `mcp-forge` server template.

## Tools

| Tool | Kind | Inputs | Upstream |
|---|---|---|---|
| `geocode` | read | `name` (2-100 chars), `count` (1-10, default 5) | `https://geocoding-api.open-meteo.com/v1/search` |
| `get_forecast` | read | `lat` (-90..90), `lon` (-180..180), `days` (1-16, default 3) | `https://api.open-meteo.com/v1/forecast` |

No write tools, so no propose/confirm pair. See `templates/server-ts` for that pattern.

## Run

```bash
npm install
npm run build
npm test          # node:test unit tests with a fake fetch (no network)
npm run smoke     # spawns dist/index.js, real JSON-RPC over stdio, real API calls
```

## Register with Claude Code

```bash
claude mcp add open-meteo -- node /absolute/path/to/open-meteo-mcp/dist/index.js
```

## Notes

Open-Meteo's free tier is for non-commercial use; check their terms before using it commercially.
