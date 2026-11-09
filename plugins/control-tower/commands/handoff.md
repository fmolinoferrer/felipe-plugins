---
description: Write or compact a role's handoff to under 3 KB
argument-hint: "<role> [--compact]"
---

Write or compact the handoff for a role. Arguments: `$ARGUMENTS` (first word = role slug, e.g. `dev-lead`).

1. If no role was given, list `handoff/*.md` with their sizes and ask which one.
2. Format and rules: `handoff/README.md` (3,072-byte hard limit; sections State, Changed, Open threads, Next, Blocked on; header `# Handoff: <role> · YYYY-MM-DD HH:MM`).
3. **Write mode** (default): build the handoff from this session's work (what you did in this conversation), the role's inbox, and the queue items it raised. Overwrite `handoff/<role>.md`.
   **Compact mode** (`--compact`, or the file is over 3 KB): rewrite the existing handoff to fit. Keep: current state, open threads, next step, blockers. Move anything historical worth keeping into `DECISIONS.md` (if it's a decision) or drop it (git has history). Never drop an open thread or a blocker.
4. Check the size: `node -e "console.log(require('fs').statSync('handoff/<role>.md').size)"`. If it is over 3072 bytes, compact again until it fits. Report the final size.
5. Add one line to `spend/ledger.md` for this session if the user tells you the amount; otherwise skip.

Write only that role's handoff. Never edit other roles' handoffs.
