# Control Tower (lite)

A small AI agent team that coordinates **through files only**. Edit this page to describe your company.

## Roles
| Role | Default model | Weekly cap | File |
|---|---|---|---|
| Chief of Staff | Haiku | $20 | `roles/chief-of-staff.md` |
| Dev Lead | Sonnet | $50 | `roles/dev-lead.md` |
| QA | Sonnet | $30 | `roles/qa.md` |

Add a role: copy a file in `roles/`, add `inbox/<role>.md` and `handoff/<role>.md`, and add it to `control-tower.json`.

## The loop
1. Work arrives in `inbox/<role>.md`. Each role reads its inbox at the start of every session.
2. A decision a role can't make goes to `decisions/queue.md` with options, a default, an undo line and a deadline. The role keeps moving on other work.
3. The founder answers queue items; answered ones move to `DECISIONS.md`.
4. Each role ends every session with `handoff/<role>.md`, **under 3 KB**.
5. `/control-tower:status` shows open decisions, stale roles, handoff sizes and spend against caps.

## Keys: decisions only the founder makes
Publish · Money · Secrets · Customer sends. Agents prepare these but never execute them, and they are never defaulted.

## Model routing (simple)
High risk: Opus. Standard work: Sonnet. Routine checks: Haiku. Escalate one level after two failed attempts.

## Spend
Log one line per session in `spend/ledger.md`: `YYYY-MM-DD · role · model · $amount · task`. Caps are in `control-tower.json`.

---
Want this tailored to your company (full role library, twice-daily decision packs with defaults and undo lines, routing and spend-cap tuning, keep-moving automation)? That's **Control Tower Pro**, by Felipe Molino.
