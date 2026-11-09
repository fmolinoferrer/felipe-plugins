# Example custom grader (Python). Use it from a case with: "grader": {"type": "custom:example_custom"}
# Rename the file and the type to match. eval-kit's Python runner calls grade(case, actual) and
# looks for graders/<name>.py first, then graders/<name>.mjs (run with node, if installed).
# `case` is the whole case object (case["expected"], case["grader"] options, case["input"]).
# `actual` is the output (or the `field` value if a field is set; None if the field is missing).
# Return {"pass": bool, "detail": str}, a (bool, detail) tuple, or a plain bool.


def grade(case, actual):
    text = str(actual if actual is not None else "").strip()
    words = len(text.split()) if text else 0
    try:
        max_words = float(case.get("expected")) or 50
    except (TypeError, ValueError):
        max_words = 50
    return {"pass": 0 < words <= max_words, "detail": "%d words (max %g)" % (words, max_words)}
