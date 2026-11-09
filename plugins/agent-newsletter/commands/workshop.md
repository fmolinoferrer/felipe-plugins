---
description: Outline a 3-hour live workshop built from past newsletter issues
argument-hint: "[folder] [--audience \"who it is for\"]"
---

You are designing a 3-hour live workshop from the newsletter issues this team has already published.

Arguments: `$ARGUMENTS`

- `folder`: first non-flag argument. Default: the current working directory. Issues are in `<folder>/newsletter/issue-*.md`.
- `--audience`: optional. Default: "founders and operators who want to run part of their company with AI agents".

## 1. Read the source

- Read every `<folder>/newsletter/issue-*.md`. **Never** read `<folder>/newsletter/_private/` (unfiltered).
- If there are no issues, stop and suggest running `/agent-newsletter:draft` first.
- From the issues, list: every failure and the rule it produced, every "One lesson", recurring patterns (the same kind of failure in more than one issue), and the coordination files the team uses (handoffs, decisions, inbox, failure notes, lessons).

## 2. Build the outline

Total time is exactly 180 minutes, including one 15-minute break. Structure:

1. **Opening (15 min)**: the setup in one picture: roles, the files they coordinate through, who is human.
2. **Block 1: Coordination through files (35 min)**: handoffs under 3 KB, decision logs, inboxes. Include one exercise.
3. **Block 2: Failures become rules (40 min)**: walk through 2 or 3 real failures from the issues. Exercise: participants write the rule for a failure before you reveal the real one.
4. **Break (15 min)**
5. **Block 3: Design your own agent team (45 min)**: participants draft their own role list, handoff template and first three rules.
6. **Block 4: Publishing in public safely (20 min)**: the no-financials filter, what gets removed and why, a live run of `redact.mjs` on a sample paragraph.
7. **Close (10 min)**: takeaways and one commitment per participant.

You may rebalance timings, but they must sum to 180 and every block needs a purpose line.

For each exercise give: name, minutes, solo/pairs/groups, instructions a facilitator can read aloud, the materials needed, and what a good answer looks like (drawn from the real issues).

End with **Takeaways**: 5 to 7 one-line takeaways, each traceable to an issue (cite `issue-<date>.md`).

Add a **Facilitator notes** section: prep checklist, what to print, and likely questions with short answers.

## 3. Write and filter

Write the outline to `<folder>/newsletter/workshop-outline.md` with the agenda as a table (`Time | Block | Minutes | Purpose`) at the top.

Then run the filter on it as a safety net:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/redact.mjs" "<folder>/newsletter/workshop-outline.md" --out "<folder>/newsletter/workshop-outline.md"
```

If the filter removed anything, fix the affected sentences so they read naturally, and tell the user what was removed.

## 4. Report

Tell the user the path, the number of issues used, and any block that is thin because the issues lacked material.
