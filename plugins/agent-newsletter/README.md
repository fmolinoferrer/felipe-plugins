# agent-newsletter

A Claude Code plugin that turns a week of agent coordination files into a public newsletter issue, and turns past issues into a live workshop.

It assumes your company runs a team of Claude Code agents that coordinate through plain files:

- `handoff/<role>.md`: each agent's current state, kept under 3 KB
- `DECISIONS.md` and `decisions/queue.md`: decisions made and decisions waiting on a human
- `inbox/<role>.md`: tasks routed to each agent
- `failures/*.md` and `LESSONS.md`: incident notes, each one producing a rule

Every issue has the same five sections: **What shipped**, **What broke**, **The rule each failure produced**, **One lesson**, **What's next**. Before anything is published, a **no-financials filter** removes revenue, prices, costs, spend, salaries, user and customer counts, investor details, emails and API keys, and appends a "Removed by the filter" list saying what was removed and why (never the values).

## Install

```
/plugin marketplace add fmolinoferrer/felipe-plugins
/plugin install agent-newsletter@felipe-plugins
```

Requires Node 18+ for the bundled scripts (no npm packages).

## Commands

### `/agent-newsletter:draft [folder] [--since YYYY-MM-DD]`

Drafts `newsletter/issue-<today>.md` from the files changed since `--since` (default: 7 days ago).

```
/agent-newsletter:draft ./ops --since 2026-11-02
```

What it does:

1. `scripts/collect.mjs` bundles the week's handoffs, decisions, failure notes, lessons and inboxes into `newsletter/_private/bundle-<date>.md` and warns about handoffs over 3 KB.
2. Claude writes the issue from `templates/issue.md` into `newsletter/_private/issue-<date>.draft.md`.
3. `scripts/redact.mjs` filters the draft into `newsletter/issue-<date>.md`, appends the public "Removed by the filter" list, and writes the private `issue-<date>.removals.json`.
4. Claude reviews the filtered issue: rewrites sentences broken by placeholders, catches leaks the regexes miss (for example "doubled revenue" said in words, or customer names), and logs those as manual removals.

Keep `newsletter/_private/` out of anything public. It holds unfiltered text.

### `/agent-newsletter:workshop [folder] [--audience "..."]`

Reads every published `newsletter/issue-*.md` (never `_private/`) and writes `newsletter/workshop-outline.md`: a 3-hour agenda with timings, exercises built from your real failures and rules, takeaways cited back to issues, and facilitator notes. The outline also goes through the filter.

```
/agent-newsletter:workshop ./ops --audience "seed-stage founders"
```

### Running the scripts directly

```
node scripts/collect.mjs <folder> --since 2026-11-02 --out bundle.md
node scripts/redact.mjs draft.md --out issue.md --report removals.json --append-list
```

`redact.mjs` with no `--out` prints to stdout; it always prints a summary of removals to stderr.

## Example: Northwind Analytics (fictional)

`examples/northwind/` is a made-up 12-person SaaS company run with AI agents. It has three handoffs, a decision log and queue, an inbox, three failure notes and a lessons file, with some fake financial lines planted so the filter has something to catch.

Outputs from real runs are checked in under `examples/northwind/newsletter/`:

| File | What it is |
|---|---|
| `_private/bundle-2026-11-08.md` | `collect.mjs` output (10 files) |
| `_private/bundle-2026-11-08.redacted.md`, `.removals.json` | filter run on the raw bundle: 15 removals (5 currency, 3 money-percent, 2 user-count, 2 email, 1 API key, 1 money-topic line, 1 investors line) |
| `_private/issue-2026-11-08.draft.md` | the draft before filtering |
| `_private/issue-2026-11-08.filtered.md`, `.removals.json` | filter run on the draft: 6 removals (3 currency, 2 money-percent, 1 user-count) |
| `issue-sample.md` | the reviewed, publishable issue |

To reproduce from this folder:

```
node scripts/collect.mjs examples/northwind --since 2026-11-02 --out examples/northwind/newsletter/_private/bundle-2026-11-08.md
node scripts/redact.mjs examples/northwind/newsletter/_private/issue-2026-11-08.draft.md --out examples/northwind/newsletter/_private/issue-2026-11-08.filtered.md --report examples/northwind/newsletter/_private/issue-2026-11-08.removals.json --append-list
```

## Limits

- The filter is regex-based. It catches numbers in standard formats and a fixed list of words. It does **not** catch amounts written in words ("forty thousand"), relative claims ("revenue doubled" is caught only because of the word "revenue"; "our best month ever" is not), customer or investor names, or screenshots. The Claude review step exists for this; read the issue yourself before publishing.
- It over-removes on purpose: any line mentioning revenue, runway, burn, valuation, salaries or investors is dropped whole, and percentages are removed on any line containing words like "plan", "price" or "churn".
- `collect.mjs` picks files by modification time or a date in the filename. A fresh git clone resets mtimes, so use dated filenames for failure notes or a wider `--since`.
- The five-section structure is fixed. Edit `templates/issue.md` to change it.
- The workshop outline is only as good as the issues it reads; with one or two issues, some blocks will be thin.

## License

MIT
