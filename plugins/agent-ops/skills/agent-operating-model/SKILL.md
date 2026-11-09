---
name: agent-operating-model
description: Reference operating model for running a small company with a team of Claude Code agents - standing and on-demand roles, file-based coordination, decision packs, founder keys, model routing by risk, spend caps, and the keep-moving check. Use when assessing a team's agent readiness, designing agent roles, writing an agent-ops proposal or pilot plan, or answering "how should our agents coordinate / who decides what / which model for what".
---

# Agent Operating Model (reference)

A generic model for a small company (5-50 people) running roughly 5-20 Claude Code agents alongside humans. Adapt it; do not impose it wholesale. Start a new team with 3-5 standing roles, not all of them.

## 1. Roles

### Standing roles (run every day)

| Agent role | Owns | Typical human counterpart | Default model |
|---|---|---|---|
| Chief of Staff | Inbox triage, decision packs, keep-moving check, handoff hygiene | Founder / COO | Sonnet |
| Product | Specs, acceptance criteria, backlog grooming | Product manager | Sonnet (Opus for strategy specs) |
| Dev Lead | Task breakdown, code changes, PRs, ADR drafts | Engineering lead | Opus for design, Sonnet for implementation |
| QA | Test plans, regression runs, verifying other agents' output | QA / any engineer | Sonnet |
| Algorithms | Hard reasoning: models, pricing logic, optimization | Senior engineer / data scientist | Opus |
| Data | Pipelines, data quality checks, metric definitions | Data engineer | Sonnet |
| Marketing | Drafts of copy, posts, emails (never sends) | Marketing lead | Sonnet |
| InfoSec | Permission reviews, dependency and secret scans, agent-access audits | Whoever owns security | Opus for reviews, Haiku for scans |

### On-demand roles (spun up for a task, then closed)

| Agent role | When | Default model |
|---|---|---|
| Analytics | A question needs data pulled and explained | Sonnet |
| Finance | Budget, spend, unit-economics drafts | Opus (numbers feed decisions) |
| Investor Relations | Update drafts, data-room prep | Sonnet (human sends) |
| Strategy | Market or option analysis for a key decision | Opus |

Rule: every agent role maps to exactly one accountable human. Agents draft and execute; humans own outcomes.

## 2. Coordination through files

All coordination is written, in the repo or a shared folder, so any agent (or human) can pick up work cold.

```
ops/
  inbox/<role>.md        # incoming requests for each role, newest on top
  decisions/queue.md     # open decisions, each with a default and an undo line
  decisions/adr/NNNN-*.md # accepted architecture/decision records
  handoffs/YYYY-MM-DD-<from>-to-<to>.md  # under 3 KB each
  packs/YYYY-MM-DD-am.md, -pm.md          # decision packs
  spend/week-YYYY-WW.md  # spend by role vs cap
```

**Handoff (under 3 KB):** goal, what was done, what is left, files touched, open questions, how to verify. If it does not fit in 3 KB, the work was not broken down enough.

**Decision queue item:**
```
## D-042 Switch nightly export to incremental
Owner key: none (reversible)   Requested by: Data   Due: next pack
Options: A) incremental (default)  B) keep full export
Default if unanswered: A
Undo: set EXPORT_MODE=full and rerun; no data loss.
```

## 3. Decision packs (twice a day)

The Chief of Staff agent assembles a pack at a fixed time, morning and afternoon. Each item: one-paragraph context, options, recommended default, undo line, and whether it needs a key.

- Items **without** a key that go unanswered by the next pack **proceed on their stated default**. The undo line makes that safe.
- Items **with** a key never proceed by default. They wait, and the Chief of Staff escalates if they block work for more than one day.
- Target: a human clears a pack in 10-15 minutes.

## 4. Founder keys (human-only decisions)

Decisions only humans make, regardless of agent confidence:

1. **Publish** - anything public: site, app store, social, docs, releases to production.
2. **Money** - spend, pricing, refunds, contracts, raising a spend cap.
3. **Schema** - production database schema and destructive data changes.
4. **Secrets** - creating, rotating, granting or reading credentials; changing agent permissions.
5. **Customer sends** - any message that reaches a customer, prospect, investor or partner.
6. **Taste** - brand, positioning, hiring, and anything where "it depends on what we want to be".

Each key has a named human holder and is enforced by permissions where possible (agents lack the credentials), not just by policy.

## 5. Model routing by risk

| Risk / difficulty | Model | Examples |
|---|---|---|
| High risk or hard reasoning | Opus | Architecture, security review, financial logic, algorithm design, anything touching a key |
| Standard work | Sonnet | Feature implementation, specs, tests, drafts, analysis |
| Cheap routine | Haiku | Triage, formatting, log summarization, scans, status rollups |

Default to Sonnet. Escalate to Opus by rule (risk category), not by mood. Drop to Haiku for anything repetitive with a checkable output.

## 6. Spend caps

- Weekly cap per role, set from the first two weeks of observed use plus 20% headroom.
- At 80% of cap: the role drops one routing tier for routine tasks and a pack item is raised.
- At 100%: the role pauses non-urgent work; raising the cap is a Money key decision.
- Track cost per shipped outcome (merged PR, published asset, answered question), not just total spend.

## 7. Keep-moving check (every 2 hours)

The Chief of Staff agent scans every role's inbox and in-flight work and answers:

1. Is anything blocked for more than 2 hours? On what?
2. Is the blocker a key? If yes, it goes to the top of the next pack (or an immediate ping if urgent).
3. If not a key, can it proceed on a default? If yes, proceed and log the undo line.
4. Is any role idle with queued work? Reassign.
5. Is any role over 80% of its spend cap?

Output: a 10-line status appended to `ops/packs/` and nothing else. No meeting.

## 8. Adoption order for a new team

1. Write the keys and the coordination folder (day 1).
2. Start Chief of Staff + Dev Lead + QA (week 1).
3. Add decision packs and the keep-moving check (week 1).
4. Add Product and one domain role (week 2).
5. Set spend caps from observed data (end of week 2).
6. Add on-demand roles only after the pilot review.
