#!/usr/bin/env node
// redact.mjs - NO-FINANCIALS filter for agent-newsletter.
// Node stdlib only. Regex-based, deliberately conservative (it prefers to over-remove).
//
// Usage:
//   node redact.mjs <file> [--out <redacted.md>] [--report <removals.json>] [--append-list]
//
//   --out          write redacted text here (default: stdout)
//   --report       write the removals as JSON here (PRIVATE: contains the original values)
//   --append-list  append a public "## Removed by the filter" section to the redacted text
//                  (categories, line numbers and reasons only - never the removed values)
//
// Exit code 0 always on success; summary goes to stderr.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------- rules ----------
// Line rules drop the whole line: a sentence about revenue with the number cut out still leaks.
const LINE_RULES = [
  {
    id: "money-topic",
    reason: "line discusses company finances (revenue/MRR/ARR/runway/burn/valuation/margin/profit)",
    re: /\b(revenue|MRR|ARR|run-?rate|runway|burn(?:\s+rate|\s+multiple)?|net burn|valuation|gross margin|profit(?:able|ability)?|EBITDA|P&L|bank balance|cash (?:in bank|position|on hand))\b/i,
  },
  {
    id: "compensation",
    reason: "line discusses compensation (salary/payroll/equity grants)",
    re: /\b(salar(?:y|ies)|payroll|compensation|comp band|bonus(?:es)?|stock options?|equity grant|hourly rate|day rate)\b/i,
  },
  {
    id: "investors",
    reason: "line discusses investors or fundraising",
    re: /\b(investors?|VCs?|angels?|term sheet|cap table|fundrais(?:e|ing)|seed round|pre-seed|series [A-E]\b|pre-money|post-money|SAFE note|convertible note|board deck)\b/i,
  },
];

// Inline rules replace only the matched span.
const INLINE_RULES = [
  {
    id: "email",
    reason: "email address",
    placeholder: "[email removed]",
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    mask: true,
  },
  {
    id: "api-key",
    reason: "key-like token (API key, secret, access token)",
    placeholder: "[key removed]",
    re: /\b(?:(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}|sk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,})\b/g,
    mask: true,
  },
  {
    id: "api-key",
    reason: "long random-looking token (possible secret)",
    placeholder: "[key removed]",
    // 32+ chars, must contain both a letter and a digit, no spaces
    re: /\b(?=[A-Za-z0-9_-]{32,}\b)(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/g,
    mask: true,
  },
  {
    id: "currency",
    reason: "currency amount",
    placeholder: "[amount removed]",
    re: /(?:[$€£¥]|\b(?:USD|EUR|GBP|BRL|R\$)\s?)\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|K|m|M|mm|MM|bn|B|million|billion|thousand))?\b(?:\s?(?:\/|per\s)(?:mo|month|yr|year|seat|user|hour|hr))?/g,
  },
  {
    id: "currency",
    reason: "currency amount",
    placeholder: "[amount removed]",
    re: /\b\d[\d,]*(?:\.\d+)?\s?(?:k|K|m|M|bn)?\s?(?:USD|EUR|GBP|dollars|euros|bucks|reais)\b/gi,
  },
  {
    id: "user-count",
    reason: "user/customer count",
    placeholder: "[count removed]",
    re: /\b\d[\d,.]*\s?(?:k|K|m|M)?\+?\s+(?:(?:paying|active|new|trial|free|enterprise|monthly active|daily active|total)\s+)?(?:users|customers|subscribers|sign-?ups|accounts|seats|clients|logos|MAUs?|DAUs?)\b/gi,
  },
  {
    id: "user-count",
    reason: "user/customer count",
    placeholder: "[count removed]",
    re: /\b(?:MAU|DAU|WAU)s?\s*(?:of|at|=|:|is|was|hit|reached)?\s*\d[\d,.]*\s?(?:k|K|m|M)?\b/g,
  },
];

// A percentage is removed only when its line also contains a money word.
const MONEY_WORDS = /\b(price|pricing|priced|cost|costs|spend|spent|budget|discount|margin|churn|revenue|MRR|ARR|conversion|upsell|refund|invoice|billing|bill|paid|plan|cheaper|expensive|LTV|CAC|ARPU)\b/i;
const PERCENT = { id: "money-percent", reason: "percentage tied to a money word", placeholder: "[% removed]", re: /[-+]?\d+(?:\.\d+)?\s?%/g };

// ---------- helpers ----------
function maskValue(v) {
  if (v.includes("@")) {
    const [u, d] = v.split("@");
    return `${u[0]}***@${d.replace(/^[^.]+/, (s) => s[0] + "***")}`;
  }
  return v.length <= 8 ? v[0] + "***" : `${v.slice(0, 4)}…(${v.length} chars)`;
}

function parseArgs(argv) {
  const args = { file: null, out: null, report: null, appendList: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i];
    else if (a === "--report") args.report = argv[++i];
    else if (a === "--append-list") args.appendList = true;
    else if (a === "-h" || a === "--help") args.help = true;
    else if (!args.file) args.file = a;
  }
  return args;
}

export function redact(text) {
  const lines = text.split(/\r?\n/);
  const removals = [];
  let inFence = false;
  let stopAt = lines.findIndex((l) => /^##\s+Removed by the filter/i.test(l));
  if (stopAt === -1) stopAt = lines.length;

  const out = lines.map((line, idx) => {
    const lineNo = idx + 1;
    if (idx >= stopAt) return line; // never re-filter an existing removal list
    if (/^\s*```/.test(line)) inFence = !inFence;

    // 1) whole-line rules
    for (const r of LINE_RULES) {
      const m = line.match(r.re);
      if (m) {
        removals.push({ line: lineNo, rule: r.id, reason: r.reason, trigger: m[0], original: line.trim() });
        const indent = (line.match(/^(\s*(?:[-*+]|\d+\.)?\s*)/) || ["", ""])[1];
        return `${indent}[line removed by filter: ${r.id}]`;
      }
    }

    // 2) inline rules
    let cur = line;
    for (const r of INLINE_RULES) {
      cur = cur.replace(r.re, (match) => {
        removals.push({ line: lineNo, rule: r.id, reason: r.reason, value: r.mask ? maskValue(match) : match.trim() });
        return r.placeholder;
      });
    }

    // 3) percentages next to money words
    if (MONEY_WORDS.test(cur)) {
      cur = cur.replace(PERCENT.re, (match) => {
        removals.push({ line: lineNo, rule: PERCENT.id, reason: PERCENT.reason, value: match.trim() });
        return PERCENT.placeholder;
      });
    }
    return cur;
  });

  return { text: out.join("\n"), removals };
}

export function removalList(removals) {
  if (!removals.length) return "## Removed by the filter\n\nNothing. The automatic filter found no financial details, counts, emails or keys.\n";
  const byRule = new Map();
  for (const r of removals) {
    const k = `${r.rule}|${r.reason}`;
    if (!byRule.has(k)) byRule.set(k, { rule: r.rule, reason: r.reason, lines: new Set(), n: 0 });
    const e = byRule.get(k);
    e.n++;
    e.lines.add(r.line);
  }
  const rows = [...byRule.values()].map(
    (e) => `- **${e.rule}** (${e.n}x, draft line${e.lines.size > 1 ? "s" : ""} ${[...e.lines].join(", ")}): ${e.reason}.`
  );
  return [
    "## Removed by the filter",
    "",
    "This issue went through a no-financials filter before publishing. What it took out, and why (values are never shown):",
    "",
    ...rows,
    "",
  ].join("\n");
}

// ---------- CLI ----------
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.file) {
    console.error("usage: node redact.mjs <file> [--out <redacted.md>] [--report <removals.json>] [--append-list]");
    process.exit(args.help ? 0 : 2);
  }
  const src = readFileSync(args.file, "utf8");
  const { text, removals } = redact(src);
  let final = text;
  if (args.appendList) {
    // replace an existing removal section if present, else append
    final = final.replace(/\n##\s+Removed by the filter[\s\S]*$/i, "").replace(/\s*$/, "\n");
    final += "\n" + removalList(removals);
  }
  if (args.out) {
    mkdirSync(dirname(resolve(args.out)), { recursive: true });
    writeFileSync(args.out, final, "utf8");
  } else {
    process.stdout.write(final);
  }
  if (args.report) {
    mkdirSync(dirname(resolve(args.report)), { recursive: true });
    const report = {
      _warning: "PRIVATE. Contains removed values (keys/emails masked). Do not publish.",
      source: args.file,
      generated: new Date().toISOString(),
      total: removals.length,
      removals,
    };
    writeFileSync(args.report, JSON.stringify(report, null, 2) + "\n", "utf8");
  }
  const counts = removals.reduce((m, r) => ((m[r.rule] = (m[r.rule] || 0) + 1), m), {});
  console.error(`redact: ${removals.length} removal(s) ${JSON.stringify(counts)}`);
}
