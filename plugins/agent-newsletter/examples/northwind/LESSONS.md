# LESSONS.md (Northwind Analytics)

One line per rule. Each rule links to the failure that produced it.

- 2026-10-21: Handoffs stay under 3 KB; if it does not fit, it is not a handoff. (failures/2026-10-21-lost-context.md)
- 2026-11-04: Every scheduled job carries an idempotency key; a duplicate run is a no-op plus an alert. (failures/2026-11-04-double-export.md)
- 2026-11-05: Re-read the live audience right before any send; snapshots are for planning. (failures/2026-11-05-wrong-segment.md)
- 2026-11-06: One task, one inbox, one `claimed-by` line. First claim wins. (failures/2026-11-06-double-pickup.md)
