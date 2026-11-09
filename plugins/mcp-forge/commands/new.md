---
description: Plan an MCP server's tools for an API, get approval, then scaffold a TypeScript stdio server
argument-hint: <API name | OpenAPI URL | path to openapi.json/yaml>
---

You are building a custom MCP (Model Context Protocol) server for: **$ARGUMENTS**

If `$ARGUMENTS` is empty, ask which API (name, docs URL, or OpenAPI file) and stop.

## Phase 1 - Understand the API (read only)

1. If the argument is a local file, read it. If it is a URL, fetch it. If it is only a name, find the official API docs (or OpenAPI spec) and read the auth, rate limit, and core resource sections. Do not guess endpoints; mark anything unverified as `UNVERIFIED`.
2. Note: base URL, auth scheme (API key header, bearer token, OAuth client credentials), pagination style, rate limits, and the 5-15 operations that matter most for the user's goal. Ask the user one short question about their goal if it is unclear what they want the server for.

## Phase 2 - Tool plan (STOP for approval)

Present the plan and **do not write any files until the user approves it**. Use this format:

**Server:** `<name>-mcp` - one-line purpose
**Auth:** env vars only, e.g. `<ENV_PREFIX>_API_KEY`, `<ENV_PREFIX>_BASE_URL` (never tool arguments, never hard-coded)

| # | Tool | Kind | Endpoint | Inputs (zod) | Returns | Notes |
|---|------|------|----------|--------------|---------|-------|
| 1 | `search_contacts` | read | `GET /contacts?q=` | `query: string(2..200)`, `limit: int(1..100)=20` | id, name, email | paginated |
| 2 | `propose_update_deal` | write step 1 | none (preview only) | `deal_id`, `stage` | preview + `confirm_token` | no side effects |
| 3 | `confirm_update_deal` | write step 2 | `PATCH /deals/{id}` | `confirm_token: uuid` | updated deal | single-use, 5 min TTL |

Rules for the plan:
- Names are `snake_case` `verb_noun`, unique, and say what they do. Prefer 4-12 well-scoped tools over one tool per endpoint.
- **Every write is a propose/confirm pair.** `propose_x` validates and returns a human-readable preview plus a `confirm_token`, and makes no API call that changes state. `confirm_x` takes only the token and executes exactly the previewed payload. Mark destructive operations (delete, send, pay, bulk) clearly and suggest leaving them out of v1.
- Every input is bounded (min/max lengths, int ranges, enums) and has a `.describe()`.
- Say which tools are excluded and why (risky, low value, needs OAuth user flow, etc.).
- List open questions and anything `UNVERIFIED`.

End with: "Reply **approve** (or edit the table) and I will scaffold `./<name>-mcp`."

## Phase 3 - Scaffold (after approval only)

1. Run the bundled scaffolder from the current working directory:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/scaffold.mjs" --name <name> --title "<Title>" --description "<one line>" --env-prefix <ENV_PREFIX>
   ```
   It copies `${CLAUDE_PLUGIN_ROOT}/templates/server-ts/` to `./<name>-mcp`, fills `{{NAME}}`, `{{TITLE}}`, `{{ENV_PREFIX}}`, `{{DESCRIPTION}}`, and refuses to overwrite an existing folder. If Node cannot run it, copy the template files manually and replace the placeholders yourself.
2. Use `${CLAUDE_PLUGIN_ROOT}/examples/open-meteo-mcp/` as the reference for a finished server (same file layout).
3. Replace the example `Item` endpoints in `src/api.ts` and the example tools in `src/server.ts` with the approved plan. Keep the template conventions:
   - `src/api.ts`: config from env, injectable `fetch`, timeout, every failure becomes `ApiError`, upstream error bodies truncated, never echo auth headers.
   - `src/server.ts`: `server.registerTool(name, { title, description, inputSchema, annotations }, handler)`; read tools get `readOnlyHint: true`; write pairs use `ConfirmStore` from `src/confirm.ts`; errors are returned as `isError: true` results; write tools are skipped when `<ENV_PREFIX>_READ_ONLY=true`.
   - `src/index.ts`: stdio transport; log to stderr only.
4. Update `test/server.test.mjs` so it covers each tool with a fake fetch (no network), including: propose makes no call, confirm executes once, token is single-use, an upstream 4xx becomes `isError`.
5. Update `README.md` tool table and `.env.example` with every env var used.
6. Remove all `TODO(mcp-forge)` markers you resolved. Search for leftover `{{` placeholders.
7. Verify: `cd <name>-mcp && npm install && npm test && npm run smoke`. Fix failures. If credentials are available in the environment, add one real read call to `scripts/smoke.mjs`; never call a confirm tool against a production account in a smoke test.

## Phase 4 - Report

Summarize: folder created, tool list (read vs write), test and smoke results, env vars the user must set, how to register it (`claude mcp add <name> -e <ENV_PREFIX>_API_KEY=... -- node <abs path>/dist/index.js`), and known gaps.
