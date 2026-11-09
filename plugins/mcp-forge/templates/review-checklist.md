# MCP Server Review Checklist

Use with `/mcp-forge:review`. Each item: pass / fail / n.a. Failures become findings with a severity.

## 1. Tool names
- [ ] `snake_case`, `verb_noun` (`list_invoices`, `get_contact`), unique, no generic names (`run`, `query`, `do_action`).
- [ ] Names say read vs write; write tools use `propose_`/`confirm_` (or equivalent) pairs.
- [ ] No near-duplicate tools the model will confuse; tool count is reasonable (roughly 3-20).

## 2. Descriptions
- [ ] Each says what it does, when to use it, and what it returns (units, timezone, ids).
- [ ] Mentions prerequisites ("call search_x first to get the id").
- [ ] Write tools state side effects and that user approval is required.
- [ ] No instructions that try to steer the model beyond the tool's purpose.

## 3. Input schemas
- [ ] Every field typed and described (`.describe()` / docstring / JSON Schema `description`).
- [ ] Bounded: string min/max length, number ranges, array max items, enums instead of free text where possible.
- [ ] Defaults are safe (small page sizes, read-only modes).
- [ ] No credentials, tokens, base URLs or file paths accepted as tool arguments unless essential and validated.
- [ ] Ids/paths are encoded before being placed into URLs (`encodeURIComponent`); no string-built SQL/shell.

## 4. Outputs
- [ ] Size-limited (pagination, truncation, field selection); no multi-MB dumps.
- [ ] Structured and stable (JSON or clear text); includes ids needed for follow-up calls.
- [ ] No secrets or internal-only data in responses.

## 5. Error handling
- [ ] Upstream/validation errors returned as tool results with `isError: true` and an actionable message, not thrown as crashes.
- [ ] Timeouts on every network call; retries (if any) are bounded and only for idempotent requests.
- [ ] Rate limits (429) handled with a clear message.
- [ ] Error text truncated; never echoes request headers or keys.
- [ ] Server survives a bad call (next call still works).

## 6. Auth and secrets
- [ ] Credentials only from env vars or a secret store; `.env` gitignored; `.env.example` present with placeholders.
- [ ] Missing credentials produce a clear error at call time (or startup), not a stack trace.
- [ ] Least-privilege scopes documented; separate read-only key supported if the API allows it.
- [ ] No secrets in logs, test fixtures, README, or committed config.

## 7. Write-tool safety
- [ ] Every state-changing tool requires explicit confirmation (propose returns preview + token; confirm executes exactly the previewed payload).
- [ ] Tokens are single-use, expire, and are bound to the action.
- [ ] Destructive operations (delete, send, pay, bulk updates) are excluded or extra-guarded; blast radius limited (max items per call).
- [ ] Read-only mode switch available (env var) that removes write tools.
- [ ] Annotations set correctly (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).
- [ ] Idempotency keys used where the API supports them.

## 8. Transport and runtime
- [ ] stdio servers write only JSON-RPC to stdout; all logs go to stderr.
- [ ] HTTP transports: auth on the endpoint, origin/host validation, no open CORS by default.
- [ ] SSRF: user input cannot redirect requests to arbitrary hosts.
- [ ] Pinned/locked dependencies; SDK reasonably current.

## 9. Tests
- [ ] Unit tests per tool with a fake HTTP layer (no network).
- [ ] Tests for: validation rejects bad input, upstream error -> `isError`, propose makes no write call, confirm executes once, token reuse rejected.
- [ ] A smoke test that spawns the server and runs `initialize` + `tools/list` over stdio.

## 10. Docs and config
- [ ] README lists tools (read/write), env vars, install, build, and how to register with an MCP client.
- [ ] Example client config (`claude mcp add ...` or `.mcp.json`) with secrets referenced by env, not inlined.
- [ ] Known limits documented (rate limits, unsupported endpoints, token lifetime).
