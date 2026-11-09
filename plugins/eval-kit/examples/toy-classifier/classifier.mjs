#!/usr/bin/env node
// Toy support-ticket classifier for "Northwind Analytics" (fictional 12-person SaaS company).
// Reads ticket text on stdin, prints JSON: {"label": "...", "confidence": 0.00}
// Deliberately naive keyword matching, so some eval cases fail and the report shows diffs.
const KEYWORDS = {
  billing: ['invoice', 'charge', 'charged', 'refund', 'payment', 'credit card', 'billing', 'price', 'plan'],
  bug: ['error', 'crash', 'crashes', 'broken', 'bug', '500', 'not loading', 'fails', 'blank'],
  account: ['password', 'login', 'log in', 'sso', '2fa', 'locked', 'username', 'email address'],
  feature_request: ['feature', 'would be great', 'please add', 'wish', 'could you add', 'support for', 'roadmap'],
};
let text = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { text += d; });
process.stdin.on('end', () => {
  const t = text.toLowerCase();
  const scores = Object.fromEntries(Object.entries(KEYWORDS).map(([label, words]) => [label, words.filter((w) => t.includes(w)).length]));
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  // Ties resolve in KEYWORDS order (billing first): a known weakness the evals catch.
  const [label, hits] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const out = hits === 0
    ? { label: 'other', confidence: 0.3 }
    : { label, confidence: Math.round((0.5 + 0.5 * (hits / total)) * 100) / 100 };
  process.stdout.write(JSON.stringify(out) + '\n');
});
