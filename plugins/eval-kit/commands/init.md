---
description: Interview me about an AI feature and scaffold evals/ (golden set, sealed holdout, graders, config.yaml)
argument-hint: "[short description of the AI feature, optional]"
---

You are setting up an evaluation suite for an AI feature in the current project, using eval-kit.
Feature description from the user (may be empty): $ARGUMENTS

## 1. Check first

- If `evals/config.yaml` already exists, stop and ask whether to extend it or start over. Never overwrite existing eval files without an explicit yes.
- Look around the repo briefly (README, entry points, scripts, API routes) so your questions are specific, not generic.

## 2. Interview (ask in small batches, 2-3 questions at a time, skip what the repo already answers)

1. **Inputs**: what does the feature receive? Plain text, JSON, a file path? Show one realistic example.
2. **Outputs**: what does it return? Plain text or JSON? If JSON, which fields matter (e.g. `label`, `confidence`)?
3. **What "correct" means**: exact value, must contain or avoid certain phrases, matches a format, a number within a tolerance, or a quality judgment that needs a rubric?
4. **How to call it**: a CLI command (input on stdin or as an argument), a Python or Node script, or an HTTP endpoint (eval-kit POSTs `{"input": ...}` and reads the response body)? Which command or URL, and does it need a shell (pipes, npm)?
5. **Risk**: what is the worst plausible failure (wrong refund advice, leaking data, a bad label routing a ticket to the wrong team)? This decides thresholds and which cases go in the holdout.
6. **Real examples**: ask for 10-30 real-looking inputs with the correct output, including hard and ambiguous ones. If the user has none, draft candidates from the interview and mark them `"tags": ["draft"]` for the user to confirm.

## 3. Scaffold

Copy the templates, then fill them with what you learned:

- `${CLAUDE_PLUGIN_ROOT}/templates/config.yaml` -> `evals/config.yaml`
- `${CLAUDE_PLUGIN_ROOT}/templates/golden.jsonl` -> `evals/golden.jsonl`
- `${CLAUDE_PLUGIN_ROOT}/templates/holdout.jsonl` -> `evals/holdout.jsonl`
- `${CLAUDE_PLUGIN_ROOT}/templates/graders/` -> `evals/graders/` (README.md, rubric.md, example_custom.py, example_custom.mjs)

Rules:

- One case per line: `{"id", "input", "expected", "grader", "tags"}`. Give every case a stable, descriptive `id`.
- Pick the grader per case (see `evals/graders/README.md`): `exact`, `contains`, `not_contains`, `regex`, `numeric` (with `tolerance`), `llm_judge` (uses `graders/rubric.md`), or `custom:<name>`. Use `field` to grade one key of JSON output.
- Split roughly 75/25: about 3 golden cases for every holdout case. Put a representative slice (including some hard cases) in `holdout.jsonl`. Tell the user the holdout is **sealed**: it is only run by `/eval-kit:gate`, and nobody should tune prompts or code against it.
- Thresholds from risk: low risk 0.80/0.75, medium 0.90/0.85, high 0.95/0.95 (golden/holdout). Explain the choice in one line.
- `config.yaml` uses a small YAML subset (nested `key: value`, comments, no lists, no multi-line strings). Keep to it.
- Tailor `graders/rubric.md` to the feature if any case uses `llm_judge`; leave `judge.command` empty unless the user has a judge script (those cases are then reported as skipped).
- Do not put secrets, API keys, or real customer personal data in eval files. Suggest anonymizing real tickets.

## 4. Smoke test

Run `python "${CLAUDE_PLUGIN_ROOT}/scripts/run.py" --dir evals` once (if `python` is missing or is the Windows Store stub, try `python3` or `py`; with no Python 3.9+, use `node "${CLAUDE_PLUGIN_ROOT}/scripts/run.mjs" --dir evals`). If the target errors (command not found, timeout), fix the config with the user. Then summarize: number of golden and holdout cases, graders used, thresholds, first pass rate, and suggest `/eval-kit:run` after each change and `/eval-kit:gate` before release.
