# DECISIONS.md (Northwind Analytics)

Append-only. One decision per entry. Format: ID, date, decider, decision, why.

## D-028 (2026-11-03) Felix
Agents may merge to main only behind a feature flag. Why: the export change went out unflagged last month and we could not turn it off without a deploy.

## D-029 (2026-11-04) Dana
Every scheduled job must carry an idempotency key. Why: the double-export incident (failures/2026-11-04-double-export.md).

## D-030 (2026-11-06) Felix
Tasks are claimed in the owner's inbox file before work starts; the first claim wins. Why: double pickup of the status page task.

## D-030a (2026-11-06) Felix
Keep the annual plan discount at 20% for now; revisit with Q1 pricing.
