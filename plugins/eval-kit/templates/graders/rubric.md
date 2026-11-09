# LLM judge rubric

Used only by cases with `"grader": {"type": "llm_judge"}`, and only when `judge.command` is set in
`config.yaml`. Otherwise those cases are reported as skipped.

You are grading one output of an AI feature. You get the user input, a short description of what
a correct answer looks like (`expected`), and the actual output.

Answer PASS only if all of these hold:

1. The output satisfies what `expected` describes. Wording may differ; meaning may not.
2. The output contains no invented facts (prices, dates, names, policies) that are not in the input.
3. The output is in the format the feature promises (for example JSON with the documented fields).

Otherwise answer FAIL.

Reply with exactly one line: `PASS: <one-sentence reason>` or `FAIL: <one-sentence reason>`.
