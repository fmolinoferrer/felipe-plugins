---
description: Run the golden eval set, write evals/report.md, compare with the previous run, and summarize
argument-hint: "[evals dir, default: evals]"
---

Run the eval-kit golden set for this project.

1. Evals directory: use `$ARGUMENTS` if given, otherwise `evals`. If `<dir>/config.yaml` does not exist, tell the user to run `/eval-kit:init` first and stop.
2. Run:

   ```
   python "${CLAUDE_PLUGIN_ROOT}/scripts/run.py" --dir <dir>
   ```

   If `python` is not found (or is the Windows Store stub), use `python3` or `py` instead. If no Python 3.9+ is available, fall back to the Node runner with the same flags: `node "${CLAUDE_PLUGIN_ROOT}/scripts/run.mjs" ...` (Node 18+). Both runners write the same report and run-history formats.

   This sends every case in `golden.jsonl` (never `holdout.jsonl`) to the configured target, grades it, writes `<dir>/report.md`, and saves `<dir>/runs/<timestamp>.json` for the next comparison. Exit code 2 means a config or data error: show the message and help fix it.
3. Read `<dir>/report.md` and give the user a short summary:
   - pass rate and change versus the previous run (regressions first, by case id)
   - each failure in one line: case id, expected vs actual, and your best guess at the cause
   - weakest tags
   - skipped cases (for example `llm_judge` without `judge.command`)
   - one or two concrete next steps
4. Do not edit `golden.jsonl` expectations to make failures pass unless the user confirms the expectation itself was wrong. Never open or quote `holdout.jsonl` while helping fix failures.
