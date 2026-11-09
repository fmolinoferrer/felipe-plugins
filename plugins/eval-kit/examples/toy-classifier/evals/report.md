# Eval report

- Run: `2026-11-09T12-15-40-780Z`
- Target: `command` node classifier.mjs
- Set: golden (holdout is sealed; only `--gate` uses it)

## Summary

| Metric | Value |
|---|---|
| Pass rate | **85.7%** (12/14) |
| Failed | 2 |
| Skipped (e.g. LLM judge not configured) | 1 |
| pass_threshold | 85.0% -> meets threshold |

## Comparison with previous run

Previous run: `2026-11-09T12-15-39-434Z.json`

| | Previous | Now | Delta |
|---|---|---|---|
| Pass rate | 85.7% | 85.7% | +0.0 pts |
| Passed / graded | 12/14 | 12/14 | |

- Regressions (passed before, fail now): none
- Fixed (failed before, pass now): none
- New cases: none
- Removed cases: none

## By tag

| Tag | Pass rate | Passed/graded |
|---|---|---|
| account | 100.0% | 3/3 |
| billing | 100.0% | 2/2 |
| bug | 60.0% | 3/5 |
| calibration | 75.0% | 3/4 |
| feature_request | 100.0% | 2/2 |
| multi-intent | 0.0% | 0/2 |
| other | 100.0% | 2/2 |

## Failures (2)

### `g-12-broken-export-tie` (grader: exact, tags: bug, multi-intent)

**Input**

```
The export button is broken since you changed our plan
```

**Expected vs actual**

```diff
- bug
+ billing
```
_first difference at character 1_

### `g-14-invoice-error-confidence` (grader: numeric, tags: bug, calibration, multi-intent)

**Input**

```
Invoice download fails with an error
```

**Expected vs actual**

```diff
- 0.9
+ 0.83
```
_first difference at character 2_

Detail: |0.83 - 0.9| = 0.07 (tolerance 0.05)

## Skipped (1)

- `g-15-judge-ambiguous`: no judge.command configured

## All cases

| Case | Grader | Result | ms |
|---|---|---|---|
| `g-01-refund` | exact | PASS | 72 |
| `g-02-500-error` | exact | PASS | 83 |
| `g-03-password-reset` | exact | PASS | 87 |
| `g-04-slack-alerts` | exact | PASS | 73 |
| `g-05-support-hours` | exact | PASS | 68 |
| `g-06-sso-contains` | contains | PASS | 69 |
| `g-07-blank-charts-regex` | regex | PASS | 79 |
| `g-08-double-charge-confidence` | numeric | PASS | 76 |
| `g-09-crash-billing-confidence` | numeric | PASS | 76 |
| `g-10-office-confidence` | numeric | PASS | 70 |
| `g-11-dark-mode-ignore-case` | exact | PASS | 72 |
| `g-12-broken-export-tie` | exact | FAIL | 68 |
| `g-13-locked-2fa` | exact | PASS | 71 |
| `g-14-invoice-error-confidence` | numeric | FAIL | 68 |
| `g-15-judge-ambiguous` | llm_judge | SKIPPED | 70 |
