# Toy example: Northwind Analytics ticket classifier

Fictional company, fictional tickets. `classifier.mjs` reads a support ticket on stdin and prints
`{"label": "billing|bug|account|feature_request|other", "confidence": 0..1}` using keyword matching.

It is intentionally naive: ties go to `billing`, so multi-intent tickets fail (`g-12`), and its
confidence is not calibrated (`g-14`). `g-15` uses the LLM judge and is skipped because
`judge.command` is empty.

The files in `evals/report.md`, `evals/gate.md` and `evals/runs/` were produced by real runs (the first two
files in `runs/` by the Node runner, the last two by the Python runner; the history is shared):

    python ../../scripts/run.py --dir evals           # run 1
    python ../../scripts/run.py --dir evals           # run 2 (shows comparison)
    python ../../scripts/run.py --dir evals --gate    # PASS, exit 0

The classifier itself is a Node script (`node classifier.mjs`); the target can be any command.
