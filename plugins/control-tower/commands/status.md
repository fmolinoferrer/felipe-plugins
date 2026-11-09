---
description: One-screen health view - open decisions, stale inboxes, handoff sizes, spend against the weekly cap
argument-hint: "[--nudge]"
---

Show the Control Tower health view. Arguments: `$ARGUMENTS`

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/status.mjs" --dir .` and show its output as-is in a code block.
2. Below it, add at most 5 bullets: what needs attention first (overdue defaults, keys waiting, stale roles, handoffs over 3 KB, roles over 80% of cap), each with the exact next action (e.g. "answer Q-0003 in `decisions/queue.md`", "`/control-tower:handoff qa --compact`").
3. If `--nudge` is in the arguments: for each stale role, add a dated nudge at the top of its inbox's `## Open` list naming the reason, and list the nudges you wrote. Never apply a default or answer a decision here.

This check should be cheap: prefer a small model when scheduling it.
