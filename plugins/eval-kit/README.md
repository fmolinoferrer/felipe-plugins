# eval-kit

Evals for teams shipping AI features, without a framework. eval-kit gives you:

- a **golden set** you run after every prompt or code change,
- a **sealed holdout** set that only the release gate touches, so you can tell real improvement from overfitting,
- built-in **graders** (exact, contains / not_contains, regex, numeric tolerance, optional LLM judge with a rubric, custom Python or JS graders),
- a **runner** in plain Python 3.9+ (standard library only, no `pip install`; a Node 18+ port is included as a fallback) that writes a Markdown report with expected-vs-actual diffs and a comparison with the previous run,
- a **release gate** with PASS/FAIL and exit code 0/1 for CI.

## Install

```
/plugin marketplace add fmolinoferrer/felipe-plugins
/plugin install eval-kit@felipe-plugins
```

Requires Python 3.9 or newer (standard library only), or Node.js 18+ as a fallback. No pip or npm packages.

The commands call `python`; if that is missing or is the Windows Store stub, Claude tries `python3` or `py`, then falls back to `node scripts/run.mjs`. Both runners take the same flags, return the same exit codes and write the same `report.md`, `gate.md` and `runs/<timestamp>.json`, so run history carries over between them.

## Commands

### `/eval-kit:init [feature description]`

Interviews you about the AI feature (inputs, outputs, what "correct" means, how to call it, risk), then creates `evals/` in the current project from the bundled templates:

```
evals/
  config.yaml      target, thresholds, timeout, optional judge command
  golden.jsonl     day-to-day cases: {"id","input","expected","grader","tags"}
  holdout.jsonl    sealed cases, only used by /eval-kit:gate
  graders/         README.md (grader reference), rubric.md (LLM judge), example_custom.py / .mjs
```

Example: `/eval-kit:init support-ticket classifier that returns {"label","confidence"}`

### `/eval-kit:run [evals dir]`

Runs `python ${CLAUDE_PLUGIN_ROOT}/scripts/run.py --dir evals`: sends each golden case to the target, grades it, writes `evals/report.md` (pass rate, per-tag rates, failures with expected-vs-actual diffs, comparison with the previous run) and saves `evals/runs/<timestamp>.json`. Claude then summarizes regressions, failures and next steps.

Example: `/eval-kit:run` or `/eval-kit:run services/classifier/evals`

### `/eval-kit:gate [evals dir]`

Runs `python ${CLAUDE_PLUGIN_ROOT}/scripts/run.py --dir evals --gate`: golden + holdout against `pass_threshold` and `holdout_threshold`, writes `evals/gate.md`, exits **0 on PASS, 1 on FAIL** (2 on config errors). Holdout inputs and expectations are never printed in `gate.md`.

Example: `/eval-kit:gate`, or in CI: `python path/to/eval-kit/scripts/run.py --dir evals --gate` (or `node path/to/eval-kit/scripts/run.mjs --dir evals --gate`)

Extra runner flags: `--pass-threshold 0.95`, `--holdout-threshold 0.9` (override config), `--quiet`.

## Targets

| `target.type` | how the input is sent | output that gets graded |
|---|---|---|
| `command` | stdin (default) or last argument (`input_mode: arg`) | stdout |
| `script` | `node <target.script>` (Python runner: `.py` scripts run with the same Python) with stdin/arg as above | stdout |
| `http` | `POST target.url` with JSON body `{"input": ...}` | response body |

Commands run from the folder that contains `evals/`, without a shell unless `shell: true` (needed for pipes, `npm`, `.cmd` files). In the Python runner a leading `python`/`python3`/`py` in `target.command` or `judge.command` is replaced by the interpreter running eval-kit. Non-string inputs are sent as JSON. If the output is JSON, graders can pick a key with `"field": "label"` (dot paths work).

## config.yaml format

eval-kit parses a deliberately small YAML subset so it needs no dependencies: `key: value` pairs, nested maps by space indentation, `#` comments, quoted or bare strings, numbers, `true`/`false`/`null`. Lists, multi-line strings (`|`, `>`), anchors and tabs are rejected with a line number.

```yaml
target:
  type: command
  command: node classifier.mjs
  input_mode: stdin
pass_threshold: 0.85
holdout_threshold: 0.80
timeout_ms: 10000
judge:
  command: ""          # empty = llm_judge cases are skipped
```

## Worked example

`examples/toy-classifier/` is a support-ticket classifier for Northwind Analytics, a fictional 12-person SaaS company. It is a naive keyword matcher (`classifier.mjs`, a Node script: the target can be any command; stdin text -> `{"label","confidence"}`) with 15 golden cases (exact, contains, regex, numeric tolerance on `confidence`, one LLM-judge case that is skipped) and 6 holdout cases. Two golden cases fail on purpose, so `evals/report.md` shows real diffs, and `evals/gate.md` shows a gate verdict.

```
cd examples/toy-classifier
python ../../scripts/run.py --dir evals          # golden: 85.7% (12/14, 1 skipped)
python ../../scripts/run.py --dir evals --gate   # PASS, exit 0
python ../../scripts/run.py --dir evals --gate --pass-threshold 0.95   # FAIL, exit 1
node ../../scripts/run.mjs --dir evals          # same results with the Node runner
```

## Limits

- Cases run sequentially; there is no parallelism, retry, or caching. Fine for tens to low hundreds of cases.
- Regexes are written JavaScript-style. The Python runner translates named groups and the `i`/`m`/`s`/`y` flags; other JS-only syntax may behave differently.
- The LLM judge is bring-your-own: set `judge.command` to a script that reads `{"rubric","input","expected","actual"}` on stdin and prints `PASS`/`FAIL` (or `{"pass": bool}`). eval-kit ships no model client and no API keys.
- One run per case: non-deterministic features can flip between runs. Repeat runs or tighten temperature before trusting small deltas.
- The diff is a simple expected/actual block with the first differing character, not a full line diff.
- Comparison is with the most recent file in `evals/runs/` only; there is no long-term trend view.
- HTTP targets only support `POST` with a JSON body `{"input": ...}` and no custom headers (wrap other APIs in a small script target).
- "Sealed" holdout is a convention enforced by the commands' instructions and by `gate.md` not printing holdout contents; the file itself is readable on disk.
