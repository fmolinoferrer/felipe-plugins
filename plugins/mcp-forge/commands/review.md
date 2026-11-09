---
description: Review an existing MCP server and write mcp-review.md with severity-ranked findings
argument-hint: [path to MCP server project, default .]
---

Review the MCP server at: **$ARGUMENTS** (if empty, use the current directory).

Read the bundled checklist first: `${CLAUDE_PLUGIN_ROOT}/templates/review-checklist.md`. Apply every section of it.

## Steps

1. **Inventory.** Find the language/SDK (TypeScript `@modelcontextprotocol/sdk`, Python `mcp`/FastMCP, other), the transport (stdio, streamable HTTP, SSE), the entry point, and every tool, resource and prompt registration. Build a table: tool name, read or write, side effects, inputs, the upstream endpoint it calls.
2. **Read every tool handler end to end**, including the helpers it calls for HTTP, auth and error handling. Do not review from names alone.
3. **Check against the checklist**: naming, descriptions, input schemas, output size/shape, error handling, auth and secrets, write-tool safety (confirmation, idempotency, blast radius), transport and logging, tests, docs/config.
4. **Run what is safe to run**: install and build if a lockfile exists, run the existing tests, and if there is a stdio entry point do a `tools/list` over JSON-RPC (initialize, notifications/initialized, tools/list). Never call write tools. Record exactly what you ran and the result; if you could not run something, say why.
5. **Rank findings** with these severities:
   - **Critical** - can leak secrets, run unconfirmed destructive writes, or allow injection/SSRF/path traversal.
   - **High** - wrong or unsafe behavior likely in normal use (unbounded inputs, missing auth checks, errors crash the server, stdout logging corrupting stdio).
   - **Medium** - model will misuse tools (vague descriptions, overlapping tools, huge outputs), missing tests for writes.
   - **Low** - naming/style, docs gaps, nice-to-haves.
6. **Write `mcp-review.md`** in the reviewed project's root with this structure:

```
# MCP Review: <server name>
Date: <today> | Reviewed path: <path> | SDK/transport: <...>

## Summary
<3-5 sentences: overall verdict, ship / ship-with-fixes / do-not-ship, top 3 risks>

## Tool inventory
| Tool | Read/Write | Side effects | Notes |

## Findings
### [Critical] <short title>
- Where: `file:line`
- Problem: ...
- Why it matters: ...
- Fix: <concrete change, with a short code sketch if useful>
(repeat, ordered Critical > High > Medium > Low)

## What was run
<commands and results>

## Checklist results
<each checklist section: pass / fail / n.a. with one line>
```

Every finding must cite a file and line. Do not invent issues to fill sections; "no findings" is a valid result. Do not modify the reviewed code unless the user asks. End by telling the user the counts per severity and the path of `mcp-review.md`.
