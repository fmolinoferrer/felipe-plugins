---
description: Draft a public newsletter issue from a week of agent handoffs, decisions and failure notes, with a no-financials filter
argument-hint: "[folder] [--since YYYY-MM-DD]"
---

You are drafting one public newsletter issue from a week of agent coordination files.

Arguments: `$ARGUMENTS`

## 1. Parse arguments

- `folder`: first non-flag argument. Default: the current working directory.
- `--since YYYY-MM-DD`: start of the week. Default: 7 days before today.
- `DATE`: today's date as YYYY-MM-DD (run `date +%F` if unsure). The issue is `<folder>/newsletter/issue-<DATE>.md`.
- Private working files go in `<folder>/newsletter/_private/`. Tell the user to keep that folder out of anything public (for example add `newsletter/_private/` to `.gitignore`).

## 2. Collect

Run:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/collect.mjs" "<folder>" --since <since> --out "<folder>/newsletter/_private/bundle-<DATE>.md"
```

Read the bundle. It contains, in order: `handoff/<role>.md`, `DECISIONS.md` and `decisions/queue.md`, failure notes and `LESSONS.md`, `inbox/<role>.md`. If the script reports zero files, stop and tell the user what folder and date you used. Pass on any handoff-size warnings to the user, but do not put them in the issue.

## 3. Write the draft

Read `${CLAUDE_PLUGIN_ROOT}/templates/issue.md` and follow its structure exactly. Sections, in order:

1. **What shipped**: things that reached users or changed how the team works. One line each, with the role that did it.
2. **What broke**: every failure note from the window. What happened, how it was noticed, the blast radius in plain words.
3. **The rule each failure produced**: a table, one row per failure. Take the rule from the failure note, `LESSONS.md` or `DECISIONS.md`. If a failure has no rule yet, say "No rule yet" rather than inventing one.
4. **One lesson**: one paragraph. The single idea a reader running their own agents could use on Monday. Prefer the pattern shared by several failures over a summary of one.
5. **What's next**: open items from `decisions/queue.md` phrased as questions, plus planned work from the handoffs' "Next" sections.

Writing rules:
- Only use facts that are in the bundle. Do not invent incidents, quotes, names or results.
- Write for outsiders. Explain internal names the first time (for example "D-029, a logged decision").
- Leave out money, prices, costs, spend, salaries, user or customer counts, investor details, emails and keys even before the filter runs. Describe impact in words ("one customer", "a day of data"), not numbers.
- Plain, short sentences. No hype.

Save it as `<folder>/newsletter/_private/issue-<DATE>.draft.md`.

## 4. Run the NO-FINANCIALS filter

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/redact.mjs" "<folder>/newsletter/_private/issue-<DATE>.draft.md" --out "<folder>/newsletter/issue-<DATE>.md" --report "<folder>/newsletter/_private/issue-<DATE>.removals.json" --append-list
```

The script removes currency amounts, percentages on lines with money words, "N users/customers/accounts", emails, key-like tokens, and drops whole lines that mention revenue, MRR, ARR, runway, burn, valuation, salaries, payroll or investors. It appends a public `## Removed by the filter` list (categories, line numbers, reasons; never the values) and writes the private JSON report with the values.

## 5. Review the filtered issue (you, not the script)

Read `<folder>/newsletter/issue-<DATE>.md` and the removals JSON, then edit the issue:

- Rewrite every sentence that now contains `[amount removed]`, `[count removed]`, `[% removed]`, `[email removed]`, `[key removed]` or `[line removed by filter: ...]` so it reads naturally **without** putting the value back. Drop the sentence if nothing is left.
- Look for leaks the regexes cannot catch: relative financial claims ("doubled revenue", "our biggest month"), customer or investor names, prices written in words, headcounts of customers, internal URLs, personal names of people outside the team. Remove them and add one bullet per item to `## Removed by the filter` in the form `- **manual** (reviewer): <category>, <why>.` Never include the removed value.
- Keep the `## Removed by the filter` section at the end of the issue.
- Re-run the step 4 command on the edited issue only if you added new text with numbers; otherwise do not re-run (it would re-number the list).

## 6. Report

Tell the user: the issue path, the counts by category from the filter, any manual removals, and anything in the bundle you were unsure about (for example a failure with no rule). Remind them that `newsletter/_private/` holds unfiltered content.
