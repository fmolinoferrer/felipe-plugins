# {{NAME}}-mcp

{{DESCRIPTION}}

A Model Context Protocol (MCP) server for {{TITLE}}, built with TypeScript, `@modelcontextprotocol/sdk` and `zod`, over stdio.

## Tools

| Tool | Kind | What it does |
|---|---|---|
| `list_items` | read | List items, optional search |
| `get_item` | read | Fetch one item by id |
| `propose_create_item` | write (step 1, no side effects) | Validate + preview, returns `confirm_token` |
| `confirm_create_item` | write (step 2) | Executes the previewed create; single-use token, 5 min TTL |

Write tools follow **propose-then-confirm**: the model must show the preview to a human and only call `confirm_*` after explicit approval. Set `{{ENV_PREFIX}}_READ_ONLY=true` to remove all write tools.

## Setup

```bash
npm install
cp .env.example .env   # fill in {{ENV_PREFIX}}_API_KEY
npm run build
npm test               # unit tests, no network
npm run smoke          # spawns dist/index.js, real JSON-RPC over stdio
```

## Use with Claude Code

```bash
claude mcp add {{NAME}} -e {{ENV_PREFIX}}_API_KEY=... -- node /absolute/path/to/{{NAME}}-mcp/dist/index.js
```

Or in `.mcp.json`:

```json
{
  "mcpServers": {
    "{{NAME}}": {
      "command": "node",
      "args": ["/absolute/path/to/{{NAME}}-mcp/dist/index.js"],
      "env": { "{{ENV_PREFIX}}_API_KEY": "${{{ENV_PREFIX}}_API_KEY}" }
    }
  }
}
```

## Security notes

- Credentials come only from environment variables; tools never accept keys as arguments.
- Upstream error bodies are truncated to 300 chars; request headers are never echoed.
- Confirm tokens are held in memory and lost on restart.
