# Release gate: PASS

- Run: `2026-11-09T12-18-20-072Z`
- Target: `command` node classifier.mjs

| Set | Pass rate | Passed/graded | Skipped | Threshold | Result |
|---|---|---|---|---|---|
| golden | 85.7% | 12/14 | 1 | 85.0% | PASS |
| holdout (sealed) | 100.0% | 6/6 | 0 | 80.0% | PASS |

## Golden failures (2)

- `g-12-broken-export-tie` (exact): expected `bug`, got `billing`
- `g-14-invoice-error-confidence` (numeric): expected `0.9`, got `0.83`

## Holdout failures (0)

_Holdout inputs and expected outputs are intentionally not printed, so they do not leak into prompt or code tuning. Only IDs and tags are shown._


Exit code: 0
