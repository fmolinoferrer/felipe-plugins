#!/usr/bin/env node
// Copy the Control Tower lite starter into a folder. Never overwrites existing files.
// Usage: node init.mjs [--out .] [--date YYYY-MM-DD]
// Node 18+, standard library only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const STARTER = path.join(here, '..', 'starter');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const out = path.resolve(opt('--out', '.'));
const today = opt('--date', new Date().toISOString().slice(0, 10));
const PLACEHOLDER_DATE = '2026-01-01';

const copied = [], skipped = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const src = path.join(dir, e.name);
    const rel = path.relative(STARTER, src);
    if (e.isDirectory()) { walk(src); continue; }
    const dst = path.join(out, rel);
    if (fs.existsSync(dst)) { skipped.push(rel); continue; }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, fs.readFileSync(src, 'utf8').split(PLACEHOLDER_DATE).join(today));
    copied.push(rel);
  }
};
walk(STARTER);
console.log(`Control Tower lite: copied ${copied.length} files into ${out}` + (skipped.length ? `, skipped ${skipped.length} existing` : ''));
for (const f of copied) console.log(`  + ${f.split(path.sep).join('/')}`);
for (const f of skipped) console.log(`  = ${f.split(path.sep).join('/')} (exists)`);
