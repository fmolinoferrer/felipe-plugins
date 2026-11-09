---
description: Quick self-check of a team's readiness to run with AI agents, scored against the bundled 6-area rubric; writes agent-readiness.md
argument-hint: "[team or company name]"
---

Run a short agent-readiness self-check for: `$ARGUMENTS` (if empty, ask for the team name).

1. Read the rubric `${CLAUDE_PLUGIN_ROOT}/rubric/readiness-rubric.md` and the reference model `${CLAUDE_PLUGIN_ROOT}/skills/agent-operating-model/SKILL.md`.
2. For each rubric area, ask **one** question that tells you which level (0–4) the team is at. Ask in two batches of three; offer the level descriptors as answer choices so the user can reply with numbers.
3. Write `agent-readiness.md`:
   - a table: area, level (0–4), one-line evidence from their answers;
   - overall score (average, one decimal) and what it means in one sentence;
   - the two weakest areas, each with **one** concrete next step they can take this week on their own (for example: "create `inbox/<role>.md` per role and a `decisions/queue.md`", "write down which decisions stay human");
   - the first three agent roles worth starting with, from the reference model.
4. Keep it under one page. Do not invent facts; mark anything unknown as "not asked".
5. End with one line: a full assessment, proposal and 2-week pilot plan are available as the Agent Operating Model Sprint (contact Felipe Molino).
