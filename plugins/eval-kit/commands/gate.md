---
description: Release gate - run golden + sealed holdout against thresholds, PASS/FAIL with exit code, writes evals/gate.md
argument-hint: "[evals dir, default: evals]"
---

Run the eval-kit release gate.

1. Evals directory: use `$ARGUMENTS` if given, otherwise `evals`. If `<dir>/config.yaml` is missing, point the user to `/eval-kit:init` and stop.
2. Run:

   ```
   python "${CLAUDE_PLUGIN_ROOT}/scripts/run.py" --dir <dir> --gate
   ```

   If `python` is not found (or is the Windows Store stub), use `python3` or `py` instead. If no Python 3.9+ is available, fall back to the Node runner with the same flags: `node "${CLAUDE_PLUGIN_ROOT}/scripts/run.mjs" ...` (Node 18+). Both runners write the same report and run-history formats.

   It runs `golden.jsonl` and the sealed `holdout.jsonl`, compares each pass rate with `pass_threshold` and `holdout_threshold` from `config.yaml`, writes `<dir>/gate.md`, and exits 0 for PASS, 1 for FAIL, 2 for config errors. An empty or missing holdout is a FAIL.
3. Report the verdict first, in one line (`PASS` or `FAIL`), then the golden and holdout rates against their thresholds.
4. If golden is more than 10 points above holdout, warn that the feature may be overfit to the golden set.
5. For holdout failures, mention only case ids and tags. Do not open, print or reason about holdout inputs or expected outputs; the holdout stays sealed so it remains an honest test.
6. Do not change thresholds or eval files to turn a FAIL into a PASS. If the user wants to, they must say so explicitly.
7. For CI, the same command works as a pipeline step: `python <path-to-eval-kit>/scripts/run.py --dir evals --gate` (or `node <path-to-eval-kit>/scripts/run.mjs --dir evals --gate`).
