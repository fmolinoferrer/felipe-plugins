---
description: Set up a starter AI agent team in the current folder - 3 roles, inboxes, a decisions queue, 3 KB handoffs, spend caps
argument-hint: "[company name]"
---

Set up Control Tower (lite) in the current folder. Arguments: `$ARGUMENTS`

1. Run:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" --out .
   ```
   It copies the starter (Chief of Staff, Dev Lead, QA) and never overwrites existing files. Show the user what was copied or skipped.
2. If a company name was given, replace "Your Company" in `control-tower.json` and the first lines of `CONTROL-TOWER.md`, and ask for a one-sentence description of what the company does to put in `CONTROL-TOWER.md`.
3. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/status.mjs" --dir .` and show the output.
4. Tell the user how to use it: each role session starts by reading `roles/<role>.md` and `inbox/<role>.md`, raises decisions in `decisions/queue.md`, and ends with `/control-tower:handoff <role>`; run `/control-tower:status` to see who is stuck.

Do not invent extra roles or files. To add a role, follow the instructions in `CONTROL-TOWER.md`.
