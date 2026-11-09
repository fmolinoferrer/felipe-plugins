# Handoff: engineering agent
Updated: 2026-11-07 (Fri) | Owner of record: Dana (human, eng lead)

## Done this week
- Shipped scheduled CSV exports for dashboards (PR #412). Exports run nightly and land in the customer's bucket.
- Migrated the ingestion workers to the new queue. Old queue drained and switched off Thursday.
- Cut the dashboard cold-load from ~4.1s to ~1.6s by caching the schema lookup.
- Hosting bill went from $3,400/mo to $2,150/mo after the queue migration.

## Broke
- 2026-11-04: nightly export job ran twice after the queue migration (duplicate files for some accounts). See failures/2026-11-04-double-export.md.

## In flight
- Idempotency keys on every scheduled job (rule from the double-export incident). 60% done.
- Staging creds rotated; the old token `sk_test_FAKEdemoKEY0000000000` is revoked but still in two runbooks, cleaning up.

## Blocked / needs a human
- Decision D-031 (retry policy for exports) waiting on Dana.

## Next
- Finish idempotency keys, then add a "job ran twice" alert.
