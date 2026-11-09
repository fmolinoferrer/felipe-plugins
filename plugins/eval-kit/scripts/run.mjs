#!/usr/bin/env node
// eval-kit runner. Node 22+, standard library only.
//
// Usage:
//   node run.mjs --dir evals                 # golden set only, writes report.md + runs/<ts>.json
//   node run.mjs --dir evals --gate          # golden + sealed holdout, writes gate.md, exit 0 (PASS) / 1 (FAIL)
// Options:
//   --pass-threshold <0..1>     override config pass_threshold (gate + report)
//   --holdout-threshold <0..1>  override config holdout_threshold (gate)
//   --quiet                     less console output
// Exit codes: 0 ok / gate PASS, 1 gate FAIL, 2 configuration or usage error.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// ---------- args ----------
function parseArgs(argv) {
  const a = { dir: 'evals', gate: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--dir') a.dir = argv[++i];
    else if (k === '--gate') a.gate = true;
    else if (k === '--quiet') a.quiet = true;
    else if (k === '--pass-threshold') a.passThreshold = Number(argv[++i]);
    else if (k === '--holdout-threshold') a.holdoutThreshold = Number(argv[++i]);
    else if (k === '--help' || k === '-h') a.help = true;
    else die(`Unknown argument: ${k}`);
  }
  return a;
}
function die(msg) { console.error(`eval-kit: ${msg}`); process.exit(2); }

// ---------- minimal YAML subset parser ----------
// Supports: `key: value` maps nested by indentation (spaces only), `#` comments,
// scalars: numbers, true/false, null/~, "double" or 'single' quoted strings, bare strings.
// NOT supported: lists, multi-line strings (| >), anchors, flow maps/arrays, tabs.
export function parseYamlSubset(text) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((rawLine, n) => {
    const line = stripComment(rawLine).replace(/\s+$/, '');
    if (!line.trim()) return;
    if (/^\t/.test(rawLine)) throw new Error(`config.yaml line ${n + 1}: tabs are not allowed, use spaces`);
    const indent = line.match(/^ */)[0].length;
    const m = line.trim().match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    if (!m) throw new Error(`config.yaml line ${n + 1}: expected "key: value" (lists and multi-line values are not supported)`);
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    const [, key, rawVal] = m;
    if (rawVal === '') {
      parent[key] = {};
      stack.push({ indent, obj: parent[key] });
    } else {
      parent[key] = scalar(rawVal);
    }
  });
  return root;
}
function stripComment(s) {
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
  }
  return s;
}
function scalar(v) {
  v = v.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    const inner = v.slice(1, -1);
    return v[0] === '"' ? inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\') : inner.replace(/''/g, "'");
  }
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true';
  if (/^(null|~)$/i.test(v)) return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

// ---------- data loading ----------
function readJsonl(file) {
  if (!fs.existsSync(file)) return null;
  const out = [];
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((l, i) => {
    if (!l.trim() || l.trim().startsWith('//')) return;
    try { out.push(JSON.parse(l)); } catch (e) { die(`${file} line ${i + 1}: invalid JSON (${e.message})`); }
  });
  out.forEach((c, i) => { if (c.id == null) c.id = `case-${i + 1}`; });
  return out;
}

// ---------- target invocation ----------
function splitCommand(cmd) {
  const out = []; let cur = ''; let q = null; let has = false;
  for (const c of cmd) {
    if (q) { if (c === q) q = null; else cur += c; continue; }
    if (c === '"' || c === "'") { q = c; has = true; continue; }
    if (/\s/.test(c)) { if (cur || has) { out.push(cur); cur = ''; has = false; } continue; }
    cur += c;
  }
  if (cur || has) out.push(cur);
  return out;
}
function inputToString(input) { return typeof input === 'string' ? input : JSON.stringify(input); }

function runProcess(argv, { stdin, cwd, timeoutMs, shell, env }) {
  return new Promise((resolve) => {
    const started = Date.now();
    let child;
    try {
      child = shell
        ? spawn(argv.join(' '), { cwd, shell: true, env })
        : spawn(argv[0], argv.slice(1), { cwd, env });
    } catch (e) { return resolve({ error: e.message, ms: 0 }); }
    let stdout = ''; let stderr = ''; let timedOut = false;
    const t = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => { clearTimeout(t); resolve({ error: e.message, ms: Date.now() - started }); });
    child.on('close', (code) => {
      clearTimeout(t);
      const ms = Date.now() - started;
      if (timedOut) return resolve({ error: `timeout after ${timeoutMs} ms`, ms });
      if (code !== 0) return resolve({ error: `exit code ${code}: ${stderr.trim().slice(0, 300)}`, stdout, ms });
      resolve({ stdout, ms });
    });
    child.stdin.on('error', () => {});
    if (stdin != null) child.stdin.write(stdin);
    child.stdin.end();
  });
}

async function callTarget(cfg, input, ctx) {
  const t = cfg.target || {};
  const type = t.type || 'command';
  const timeoutMs = Number(cfg.timeout_ms ?? 30000);
  if (type === 'http') {
    if (!t.url) die('target.url is required for target.type: http');
    const started = Date.now();
    try {
      const res = await fetch(t.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await res.text();
      if (!res.ok) return { error: `HTTP ${res.status}: ${body.slice(0, 300)}`, ms: Date.now() - started };
      return { stdout: body, ms: Date.now() - started };
    } catch (e) { return { error: e.name === 'TimeoutError' ? `timeout after ${timeoutMs} ms` : e.message, ms: Date.now() - started }; }
  }
  let argv;
  if (type === 'script') {
    if (!t.script) die('target.script is required for target.type: script');
    argv = [process.execPath, t.script];
  } else if (type === 'command') {
    if (!t.command) die('target.command is required for target.type: command');
    argv = splitCommand(String(t.command));
    if (argv[0] === 'node') argv[0] = process.execPath;
  } else die(`unknown target.type "${type}" (use command | script | http)`);
  const mode = t.input_mode || 'stdin';
  const s = inputToString(input);
  if (mode === 'arg') argv = [...argv, s];
  return runProcess(argv, { stdin: mode === 'stdin' ? s : null, cwd: ctx.projectDir, timeoutMs, shell: t.shell === true, env: process.env });
}

// ---------- graders ----------
function getPath(obj, p) {
  if (!p) return obj;
  return String(p).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function str(v) { return v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v); }
function norm(s, g) { let x = str(s).trim(); if (g.ignore_case) x = x.toLowerCase(); return x; }

const builtins = {
  exact(actual, expected, g) {
    if (typeof expected === 'object' && expected !== null) {
      return { pass: JSON.stringify(actual) === JSON.stringify(expected) };
    }
    return { pass: norm(actual, g) === norm(expected, g) };
  },
  contains(actual, expected, g) {
    const needles = Array.isArray(expected) ? expected : [expected];
    const hay = norm(actual, g);
    const missing = needles.filter((n) => !hay.includes(norm(n, g)));
    return { pass: missing.length === 0, detail: missing.length ? `missing: ${missing.map((m) => JSON.stringify(m)).join(', ')}` : undefined };
  },
  not_contains(actual, expected, g) {
    const needles = Array.isArray(expected) ? expected : [expected];
    const hay = norm(actual, g);
    const found = needles.filter((n) => hay.includes(norm(n, g)));
    return { pass: found.length === 0, detail: found.length ? `found forbidden: ${found.map((m) => JSON.stringify(m)).join(', ')}` : undefined };
  },
  regex(actual, expected, g) {
    let re;
    try { re = new RegExp(expected, g.flags ?? (g.ignore_case ? 'i' : '')); } catch (e) { return { pass: false, detail: `bad regex: ${e.message}` }; }
    return { pass: re.test(str(actual)) };
  },
  numeric(actual, expected, g) {
    const a = Number(typeof actual === 'string' ? actual.trim() : actual);
    const e = Number(expected);
    const tol = Number(g.tolerance ?? 0);
    if (Number.isNaN(a)) return { pass: false, detail: `actual is not a number` };
    const diff = Math.abs(a - e);
    return { pass: diff <= tol + 1e-12, detail: `|${a} - ${e}| = ${+diff.toFixed(6)} (tolerance ${tol})` };
  },
};

async function grade(c, out, cfg, ctx) {
  const g = typeof c.grader === 'string' ? { type: c.grader } : { type: 'exact', ...(c.grader || {}) };
  if (out.error) return { status: 'fail', grader: g.type, detail: `target error: ${out.error}`, actual: out.stdout ?? '' };
  const raw = String(out.stdout ?? '').trim();
  let parsed; try { parsed = JSON.parse(raw); } catch { parsed = undefined; }
  const actual = g.field ? getPath(parsed, g.field) : (typeof c.expected === 'object' && c.expected !== null && parsed !== undefined ? parsed : raw);
  if (g.field && parsed === undefined) return { status: 'fail', grader: g.type, detail: `grader wants field "${g.field}" but output is not JSON`, actual: raw };

  if (g.type === 'llm_judge') {
    const judge = cfg.judge?.command;
    if (!judge) return { status: 'skipped', grader: g.type, detail: 'no judge.command configured', actual };
    const rubricFile = path.resolve(ctx.evalsDir, g.rubric || 'graders/rubric.md');
    const rubric = fs.existsSync(rubricFile) ? fs.readFileSync(rubricFile, 'utf8') : '';
    let argv = splitCommand(String(judge)); if (argv[0] === 'node') argv[0] = process.execPath;
    const r = await runProcess(argv, { stdin: JSON.stringify({ rubric, input: c.input, expected: c.expected, actual }), cwd: ctx.projectDir, timeoutMs: Number(cfg.timeout_ms ?? 30000) * 2, shell: cfg.judge?.shell === true, env: process.env });
    if (r.error) return { status: 'fail', grader: g.type, detail: `judge error: ${r.error}`, actual };
    const verdict = r.stdout.trim();
    let pass; try { pass = !!JSON.parse(verdict).pass; } catch { pass = /^\s*PASS\b/i.test(verdict); }
    return { status: pass ? 'pass' : 'fail', grader: g.type, detail: verdict.slice(0, 300), actual };
  }
  if (g.type.startsWith('custom:')) {
    const name = g.type.slice(7);
    const file = path.resolve(ctx.evalsDir, 'graders', `${name}.mjs`);
    if (!fs.existsSync(file)) return { status: 'fail', grader: g.type, detail: `custom grader not found: graders/${name}.mjs`, actual };
    const mod = await import(pathToFileURL(file).href);
    const r = await mod.default(actual, c.expected, { ...g, case: c, raw });
    return { status: r.pass ? 'pass' : 'fail', grader: g.type, detail: r.detail, actual };
  }
  const fn = builtins[g.type];
  if (!fn) return { status: 'fail', grader: g.type, detail: `unknown grader "${g.type}"`, actual };
  const r = fn(actual, c.expected, g);
  return { status: r.pass ? 'pass' : 'fail', grader: g.type, detail: r.detail, actual };
}

// ---------- running a set ----------
async function runSet(name, cases, cfg, ctx, quiet) {
  const results = [];
  for (const c of cases) {
    const out = await callTarget(cfg, c.input, ctx);
    const g = await grade(c, out, cfg, ctx);
    results.push({ id: c.id, set: name, tags: c.tags || [], input: c.input, expected: c.expected, actual: g.actual, grader: g.grader, status: g.status, detail: g.detail, ms: out.ms });
    if (!quiet) console.log(`  ${g.status === 'pass' ? 'PASS' : g.status === 'skipped' ? 'SKIP' : 'FAIL'}  [${name}] ${c.id}`);
  }
  return results;
}
function summarize(results) {
  const graded = results.filter((r) => r.status !== 'skipped');
  const passed = graded.filter((r) => r.status === 'pass').length;
  return { total: results.length, graded: graded.length, passed, failed: graded.length - passed, skipped: results.length - graded.length, rate: graded.length ? passed / graded.length : 0 };
}
function byTag(results) {
  const m = {};
  for (const r of results) for (const t of (r.tags.length ? r.tags : ['(untagged)'])) {
    m[t] ??= []; m[t].push(r);
  }
  return Object.entries(m).sort().map(([t, rs]) => [t, summarize(rs)]);
}

// ---------- report helpers ----------
const pct = (x) => `${(x * 100).toFixed(1)}%`;
function fence(s) { const t = str(s); return '```\n' + t.replace(/```/g, '`​``') + '\n```'; }
function diffBlock(expected, actual) {
  const e = str(expected); const a = str(actual);
  let i = 0; while (i < e.length && i < a.length && e[i] === a[i]) i++;
  const lines = ['```diff', ...e.split('\n').map((l) => `- ${l}`), ...a.split('\n').map((l) => `+ ${l}`), '```'];
  const where = e === a ? 'values are identical as strings (check grader settings)' : `first difference at character ${i}`;
  return `${lines.join('\n')}\n_${where}_`;
}
function timestamp() { return new Date().toISOString().replace(/[:.]/g, '-'); }
function latestRun(runsDir) {
  if (!fs.existsSync(runsDir)) return null;
  const files = fs.readdirSync(runsDir).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) return null;
  try { return { file: files.at(-1), data: JSON.parse(fs.readFileSync(path.join(runsDir, files.at(-1)), 'utf8')) }; } catch { return null; }
}

function renderReport(cfg, s, results, prev, ts) {
  const L = [];
  L.push(`# Eval report`, '', `- Run: \`${ts}\``, `- Target: \`${cfg.target?.type || 'command'}\` ${cfg.target?.command || cfg.target?.script || cfg.target?.url || ''}`.trimEnd(), `- Set: golden (holdout is sealed; only \`--gate\` uses it)`, '');
  const thr = Number(cfg.pass_threshold ?? 0);
  L.push(`## Summary`, '', `| Metric | Value |`, `|---|---|`,
    `| Pass rate | **${pct(s.rate)}** (${s.passed}/${s.graded}) |`,
    `| Failed | ${s.failed} |`, `| Skipped (e.g. LLM judge not configured) | ${s.skipped} |`,
    `| pass_threshold | ${pct(thr)} -> ${s.rate >= thr ? 'meets threshold' : 'BELOW threshold'} |`, '');
  L.push(`## Comparison with previous run`, '');
  if (!prev) L.push('_No previous run found in `runs/`. This run is the baseline._', '');
  else {
    const ps = prev.data.summary; const delta = s.rate - ps.rate;
    const prevMap = new Map(prev.data.results.map((r) => [r.id, r.status]));
    const newlyFailing = results.filter((r) => r.status === 'fail' && prevMap.get(r.id) === 'pass').map((r) => r.id);
    const fixed = results.filter((r) => r.status === 'pass' && prevMap.get(r.id) === 'fail').map((r) => r.id);
    const added = results.filter((r) => !prevMap.has(r.id)).map((r) => r.id);
    const removed = [...prevMap.keys()].filter((id) => !results.some((r) => r.id === id));
    L.push(`Previous run: \`${prev.file}\``, '', `| | Previous | Now | Delta |`, `|---|---|---|---|`,
      `| Pass rate | ${pct(ps.rate)} | ${pct(s.rate)} | ${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)} pts |`,
      `| Passed / graded | ${ps.passed}/${ps.graded} | ${s.passed}/${s.graded} | |`, '',
      `- Regressions (passed before, fail now): ${newlyFailing.length ? newlyFailing.map((x) => `\`${x}\``).join(', ') : 'none'}`,
      `- Fixed (failed before, pass now): ${fixed.length ? fixed.map((x) => `\`${x}\``).join(', ') : 'none'}`,
      `- New cases: ${added.length ? added.map((x) => `\`${x}\``).join(', ') : 'none'}`,
      `- Removed cases: ${removed.length ? removed.map((x) => `\`${x}\``).join(', ') : 'none'}`, '');
  }
  L.push(`## By tag`, '', `| Tag | Pass rate | Passed/graded |`, `|---|---|---|`);
  for (const [t, ts2] of byTag(results)) L.push(`| ${t} | ${pct(ts2.rate)} | ${ts2.passed}/${ts2.graded} |`);
  L.push('');
  const fails = results.filter((r) => r.status === 'fail');
  L.push(`## Failures (${fails.length})`, '');
  if (!fails.length) L.push('_None._', '');
  for (const r of fails) {
    L.push(`### \`${r.id}\` (grader: ${r.grader}${r.tags.length ? `, tags: ${r.tags.join(', ')}` : ''})`, '', `**Input**`, '', fence(r.input), '', `**Expected vs actual**`, '', diffBlock(r.expected, r.actual), '');
    if (r.detail) L.push(`Detail: ${r.detail}`, '');
  }
  const skipped = results.filter((r) => r.status === 'skipped');
  if (skipped.length) { L.push(`## Skipped (${skipped.length})`, ''); for (const r of skipped) L.push(`- \`${r.id}\`: ${r.detail}`); L.push(''); }
  L.push(`## All cases`, '', `| Case | Grader | Result | ms |`, `|---|---|---|---|`);
  for (const r of results) L.push(`| \`${r.id}\` | ${r.grader} | ${r.status.toUpperCase()} | ${r.ms ?? ''} |`);
  L.push('');
  return L.join('\n');
}

function renderGate(cfg, gs, hs, golden, holdout, thr, hthr, verdict, ts) {
  const L = [];
  L.push(`# Release gate: ${verdict}`, '', `- Run: \`${ts}\``, `- Target: \`${cfg.target?.type || 'command'}\` ${cfg.target?.command || cfg.target?.script || cfg.target?.url || ''}`.trimEnd(), '');
  L.push(`| Set | Pass rate | Passed/graded | Skipped | Threshold | Result |`, `|---|---|---|---|---|---|`,
    `| golden | ${pct(gs.rate)} | ${gs.passed}/${gs.graded} | ${gs.skipped} | ${pct(thr)} | ${gs.rate >= thr && gs.graded ? 'PASS' : 'FAIL'} |`,
    `| holdout (sealed) | ${hs.graded ? pct(hs.rate) : 'n/a'} | ${hs.passed}/${hs.graded} | ${hs.skipped} | ${pct(hthr)} | ${hs.graded && hs.rate >= hthr ? 'PASS' : 'FAIL'} |`, '');
  const gap = gs.rate - hs.rate;
  if (hs.graded && gap > 0.1) L.push(`> Warning: golden beats holdout by ${(gap * 100).toFixed(1)} pts. The feature may be overfit to the golden set.`, '');
  const gf = golden.filter((r) => r.status === 'fail');
  L.push(`## Golden failures (${gf.length})`, '');
  if (!gf.length) L.push('_None._');
  for (const r of gf) L.push(`- \`${r.id}\` (${r.grader}): expected \`${str(r.expected)}\`, got \`${str(r.actual).replace(/\n/g, ' ').slice(0, 200)}\``);
  L.push('', `## Holdout failures (${holdout.filter((r) => r.status === 'fail').length})`, '',
    '_Holdout inputs and expected outputs are intentionally not printed, so they do not leak into prompt or code tuning. Only IDs and tags are shown._', '');
  for (const r of holdout.filter((x) => x.status === 'fail')) L.push(`- \`${r.id}\`${r.tags.length ? ` (tags: ${r.tags.join(', ')})` : ''}`);
  L.push('', `Exit code: ${verdict === 'PASS' ? 0 : 1}`, '');
  return L.join('\n');
}

// ---------- main ----------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 11).join('\n')); return 0; }
  const evalsDir = path.resolve(args.dir);
  const projectDir = path.dirname(evalsDir);
  const cfgFile = path.join(evalsDir, 'config.yaml');
  if (!fs.existsSync(cfgFile)) die(`no config.yaml in ${evalsDir}. Run /eval-kit:init first.`);
  let cfg; try { cfg = parseYamlSubset(fs.readFileSync(cfgFile, 'utf8')); } catch (e) { die(e.message); }
  const thr = args.passThreshold ?? Number(cfg.pass_threshold ?? 0.8);
  const hthr = args.holdoutThreshold ?? Number(cfg.holdout_threshold ?? thr);
  const golden = readJsonl(path.join(evalsDir, 'golden.jsonl'));
  if (!golden || !golden.length) die(`golden.jsonl missing or empty in ${evalsDir}`);
  const ctx = { evalsDir, projectDir };
  const ts = timestamp();

  if (!args.gate) {
    if (!args.quiet) console.log(`eval-kit: running ${golden.length} golden cases`);
    const results = await runSet('golden', golden, cfg, ctx, args.quiet);
    const s = summarize(results);
    const runsDir = path.join(evalsDir, 'runs');
    const prev = latestRun(runsDir);
    fs.mkdirSync(runsDir, { recursive: true });
    fs.writeFileSync(path.join(evalsDir, 'report.md'), renderReport({ ...cfg, pass_threshold: thr }, s, results, prev, ts));
    fs.writeFileSync(path.join(runsDir, `${ts}.json`), JSON.stringify({ timestamp: ts, set: 'golden', summary: s, results }, null, 2));
    console.log(`eval-kit: golden pass rate ${pct(s.rate)} (${s.passed}/${s.graded}, ${s.skipped} skipped)` + (prev ? `, previous ${pct(prev.data.summary.rate)}` : ', no previous run'));
    console.log(`eval-kit: wrote ${path.join(evalsDir, 'report.md')} and runs/${ts}.json`);
    return 0;
  }

  const holdout = readJsonl(path.join(evalsDir, 'holdout.jsonl')) || [];
  if (!args.quiet) console.log(`eval-kit gate: ${golden.length} golden + ${holdout.length} holdout cases`);
  const gr = await runSet('golden', golden, cfg, ctx, args.quiet);
  const hr = await runSet('holdout', holdout, cfg, ctx, args.quiet);
  const gs = summarize(gr); const hs = summarize(hr);
  const ok = gs.graded > 0 && gs.rate >= thr && hs.graded > 0 && hs.rate >= hthr;
  const verdict = ok ? 'PASS' : 'FAIL';
  fs.writeFileSync(path.join(evalsDir, 'gate.md'), renderGate(cfg, gs, hs, gr, hr, thr, hthr, verdict, ts));
  console.log(`eval-kit gate: ${verdict}  golden ${pct(gs.rate)} (>= ${pct(thr)}?)  holdout ${hs.graded ? pct(hs.rate) : 'n/a'} (>= ${pct(hthr)}?)`);
  console.log(`eval-kit: wrote ${path.join(evalsDir, 'gate.md')}`);
  return ok ? 0 : 1;
}

main().then((code) => process.exit(code), (e) => { console.error(`eval-kit: ${e.stack || e}`); process.exit(2); });
