# Graders

Each case in `golden.jsonl` / `holdout.jsonl` names a grader in its `grader` field, either as a
string (`"exact"`) or an object (`{"type": "numeric", "field": "confidence", "tolerance": 0.05}`).

Built-in graders (implemented in the eval-kit runner, nothing to install):

| type | passes when | options |
|---|---|---|
| `exact` | trimmed output equals `expected` (objects: deep-equal on parsed JSON) | `field`, `ignore_case` |
| `contains` | output contains `expected` (string, or every string in an array) | `field`, `ignore_case` |
| `not_contains` | output contains none of `expected` | `field`, `ignore_case` |
| `regex` | the JavaScript-style regex `expected` matches the output | `field`, `flags`, `ignore_case` |
| `numeric` | `abs(actual - expected) <= tolerance` | `field`, `tolerance` (default 0) |
| `llm_judge` | the configured judge command prints `PASS` (or JSON `{"pass": true}`) | `rubric` (default `graders/rubric.md`) |
| `custom:<name>` | `graders/<name>.py` `grade(case, actual)` returns `{"pass": True}`, or `graders/<name>.mjs` default export returns `{pass: true}` | anything you like |

`field` reads a value out of JSON output with a dot path (`label`, `result.score`). If the output
is not JSON and a `field` is set, the case fails with a clear message.

`llm_judge` cases are **skipped** (not counted in the pass rate) unless `judge.command` is set in
`config.yaml`. The judge command receives `{"rubric", "input", "expected", "actual"}` as JSON on
stdin and must print `PASS ...` / `FAIL ...` or `{"pass": true|false, "reason": "..."}`.

Custom graders: the Python runner (`run.py`) looks for `graders/<name>.py` first and calls
`grade(case, actual)`; if only `graders/<name>.mjs` exists it runs it with `node` (when Node is
installed). The Node runner (`run.mjs`) only loads `.mjs` graders. See `example_custom.py` and
`example_custom.mjs`.
