// Example custom grader. Use it from a case with: "grader": {"type": "custom:example_custom"}
// Rename the file and the type to match. Default export: (actual, expected, options) => {pass, detail}
// `actual` is the output (or the `field` value if a field is set), `options.raw` is the raw stdout,
// `options.case` is the whole case object.
export default function grade(actual, expected, options) {
  const text = String(actual ?? '').trim();
  const words = text ? text.split(/\s+/).length : 0;
  const max = Number(expected) || 50;
  return { pass: words > 0 && words <= max, detail: `${words} words (max ${max})` };
}
