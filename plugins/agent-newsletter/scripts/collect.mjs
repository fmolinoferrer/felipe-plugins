#!/usr/bin/env node
// collect.mjs - gather a week of agent coordination files into one markdown bundle.
// Node stdlib only.
//
// Usage:
//   node collect.mjs <folder> [--since YYYY-MM-DD] [--out <bundle.md>]
//
// A file is included when it is a .md file AND (its mtime >= since OR a YYYY-MM-DD date in its
// path/name is >= since). Core coordination files (DECISIONS.md, decisions/queue.md, LESSONS.md)
// are always included because they are append-only logs. Skips .git, node_modules and the
// newsletter/ output folder. Default --since is 7 days ago.

import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, resolve, dirname, sep } from "node:path";

const argv = process.argv.slice(2);
let folder = null, since = null, out = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--since") since = argv[++i];
  else if (argv[i] === "--out") out = argv[++i];
  else if (!folder) folder = argv[i];
}
folder = resolve(folder || ".");
if (!since) since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) {
  console.error(`collect: --since must be YYYY-MM-DD, got "${since}"`);
  process.exit(2);
}
const sinceMs = Date.parse(since + "T00:00:00");

const SKIP_DIRS = new Set([".git", "node_modules", "newsletter", ".claude"]);
const ALWAYS = [/^DECISIONS\.md$/i, /^decisions[\/\\]queue\.md$/i, /^LESSONS\.md$/i];
const HANDOFF_LIMIT = 3 * 1024;

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(p, acc);
    } else if (name.toLowerCase().endsWith(".md")) {
      acc.push({ path: p, rel: relative(folder, p).split(sep).join("/"), st });
    }
  }
  return acc;
}

function kind(rel) {
  const r = rel.toLowerCase();
  if (r.startsWith("handoff/")) return "handoff";
  if (r.startsWith("inbox/")) return "inbox";
  if (r === "decisions.md" || r.startsWith("decisions/")) return "decisions";
  if (/(^|\/)(failures?|incidents?|lessons?|postmortems?)(\/|\.md$)/.test(r)) return "failure";
  return "other";
}

function newestDateIn(s) {
  const ds = [...s.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]).sort();
  return ds.length ? ds[ds.length - 1] : null;
}

const files = walk(folder)
  .filter((f) => {
    if (ALWAYS.some((re) => re.test(f.rel))) return true;
    if (f.st.mtimeMs >= sinceMs) return true;
    const d = newestDateIn(f.rel);
    return d && d >= since;
  })
  .map((f) => ({ ...f, kind: kind(f.rel) }));

const ORDER = ["handoff", "decisions", "failure", "inbox", "other"];
files.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.rel.localeCompare(b.rel));

const warnings = [];
const parts = [
  `# Agent bundle: ${relative(process.cwd(), folder) || "."} since ${since}`,
  "",
  `Generated ${new Date().toISOString()} by collect.mjs. PRIVATE working file: raw, unfiltered.`,
  "",
  "| kind | file | bytes | modified |",
  "|---|---|---|---|",
  ...files.map((f) => `| ${f.kind} | ${f.rel} | ${f.st.size} | ${f.st.mtime.toISOString().slice(0, 10)} |`),
  "",
];
for (const f of files) {
  if (f.kind === "handoff" && f.st.size > HANDOFF_LIMIT) warnings.push(`${f.rel} is ${f.st.size} bytes (> 3 KB handoff limit)`);
  parts.push(`---`, "", `## [${f.kind}] ${f.rel}`, "", readFileSync(f.path, "utf8").trim(), "");
}
if (warnings.length) parts.splice(6, 0, "**Warnings:**", ...warnings.map((w) => `- ${w}`), "");

const bundle = parts.join("\n");
if (out) {
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, bundle, "utf8");
} else process.stdout.write(bundle);

const counts = files.reduce((m, f) => ((m[f.kind] = (m[f.kind] || 0) + 1), m), {});
console.error(`collect: ${files.length} file(s) since ${since} ${JSON.stringify(counts)}${warnings.length ? ` | ${warnings.length} warning(s)` : ""}`);
