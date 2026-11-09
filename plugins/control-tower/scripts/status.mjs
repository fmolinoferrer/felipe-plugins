#!/usr/bin/env node
// One-screen health view of a control-tower folder.
// Usage: node status.mjs [--dir .] [--now 2026-11-09T09:00] [--json]
// Node 18+, standard library only.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const dir = path.resolve(opt('--dir', '.'));
const now = opt('--now') ? new Date(opt('--now')) : new Date();
const asJson = args.includes('--json');

const cfgPath = path.join(dir, 'control-tower.json');
if (!fs.existsSync(cfgPath)) { console.error(`No control-tower.json in ${dir}. Run /control-tower:init first.`); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const readIf = (rel) => { const p = path.join(dir, rel); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; };
const hoursSince = (d) => (now - d) / 36e5;
const parseDate = (s) => { if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00'; const d = new Date(s.replace(' ', 'T')); return isNaN(d) ? null : d; };

// --- decisions queue
const queue = readIf('decisions/queue.md');
const openPart = queue.split(/^## Open\s*$/m)[1] || '';
const items = openPart.split(/^## (?=Q-)/m).slice(1).map((block) => {
  const field = (k) => (block.match(new RegExp(`^- ${k}:\\s*(.+)$`, 'mi')) || [])[1]?.trim();
  const deadline = field('Deadline');
  const dl = deadline ? parseDate(deadline) : null;
  return {
    id: block.split(/\s/)[0], title: block.split('\n')[0].replace(/^Q-\d+\s*·\s*/, '').trim(),
    key: /^yes/i.test(field('Key') || ''), from: (field('From') || '').split('·')[0].trim(),
    default: field('Default'), deadline, overdue: dl ? dl < now : false,
  };
});

// --- roles: inbox + handoff
const roles = cfg.roles.map((r) => {
  const inbox = readIf(`inbox/${r.slug}.md`);
  const open = (inbox.split(/^## Done/m)[0].match(/^- \[ \] .+$/gm) || []);
  const dates = open.map((l) => parseDate((l.match(/\d{4}-\d{2}-\d{2}/) || [])[0] || '')).filter(Boolean);
  const oldestOpenH = dates.length ? Math.max(...dates.map(hoursSince)) : 0;
  const hPath = path.join(dir, 'handoff', `${r.slug}.md`);
  let handoffBytes = 0, handoffAgeH = Infinity;
  if (fs.existsSync(hPath)) {
    const h = fs.readFileSync(hPath, 'utf8');
    handoffBytes = Buffer.byteLength(h);
    const m = h.match(/^# Handoff:.*?(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?)/m);
    const d = m ? parseDate(m[1]) : fs.statSync(hPath).mtime;
    handoffAgeH = hoursSince(d);
  }
  const reasons = [];
  if (open.length && handoffAgeH > cfg.stale_hours) reasons.push(`handoff ${Math.round(handoffAgeH)}h old with ${open.length} open`);
  if (oldestOpenH > 24) reasons.push(`oldest inbox item ${Math.round(oldestOpenH)}h`);
  if (items.some((q) => q.overdue && !q.key && q.from.toLowerCase().includes(r.slug))) reasons.push('blocked on an expired default');
  return { ...r, open: open.length, handoffBytes, handoffAgeH, overLimit: handoffBytes > cfg.handoff_limit_bytes, stale: reasons.length > 0, reasons };
});

// --- spend: current week (Monday start)
const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
const spend = {}; let total = 0;
for (const line of readIf('spend/ledger.md').split('\n')) {
  const m = line.match(/^-?\s*(\d{4}-\d{2}-\d{2})\s*·\s*([\w-]+)\s*·\s*[^·]+·\s*[^\d]*([\d.,]+)/);
  if (!m) continue;
  const d = parseDate(m[1]); if (!d || d < monday || d > now) continue;
  const amt = Number(m[3].replace(/,/g, '')); spend[m[2]] = (spend[m[2]] || 0) + amt; total += amt;
}

const result = {
  company: cfg.company, now: now.toISOString(),
  decisions: { open: items.length, keys: items.filter((q) => q.key).length, overdueDefaults: items.filter((q) => q.overdue && !q.key).map((q) => q.id), items },
  roles, spend: { total, cap: cfg.weekly_cap, pct: Math.round((100 * total) / cfg.weekly_cap), byRole: spend },
};
if (asJson) { console.log(JSON.stringify(result, null, 2)); process.exit(0); }

const c = cfg.currency || '$';
const pad = (s, n) => String(s).padEnd(n);
const L = [];
L.push(`CONTROL TOWER · ${cfg.company} · ${now.toISOString().slice(0, 16).replace('T', ' ')}`);
L.push('='.repeat(64));
L.push(`Decisions: ${items.length} open (${result.decisions.keys} keys)` + (result.decisions.overdueDefaults.length ? ` · DEFAULTS DUE NOW: ${result.decisions.overdueDefaults.join(', ')}` : ''));
for (const q of items) L.push(`  ${q.key ? 'KEY' : '   '} ${pad(q.id, 7)} ${pad(q.title.slice(0, 34), 35)} ${q.overdue ? 'OVERDUE' : 'due ' + (q.deadline || '?')}`);
L.push('');
L.push(`${pad('Role', 18)}${pad('Inbox', 7)}${pad('Handoff', 16)}${pad('Spend/cap', 16)}Status`);
for (const r of roles) {
  const s = spend[r.slug] || 0; const pct = Math.round((100 * s) / r.cap);
  const ho = isFinite(r.handoffAgeH) ? `${Math.round(r.handoffAgeH)}h ${(r.handoffBytes / 1024).toFixed(1)}KB${r.overLimit ? '!' : ''}` : 'none';
  const st = [r.stale ? 'STALE: ' + r.reasons.join('; ') : 'ok', r.overLimit ? 'HANDOFF > 3KB' : '', pct >= 100 ? 'AT CAP' : pct >= 80 ? 'over 80%' : ''].filter(Boolean).join(' · ');
  L.push(`${pad(r.slug, 18)}${pad(r.open, 7)}${pad(ho, 16)}${pad(`${c}${s}/${c}${r.cap} ${pct}%`, 16)}${st}`);
}
L.push('');
L.push(`Spend this week: ${c}${total} of ${c}${cfg.weekly_cap} (${result.spend.pct}%)`);
const stale = roles.filter((r) => r.stale).map((r) => r.slug);
L.push(`Stale roles: ${stale.length ? stale.join(', ') : 'none'}`);
console.log(L.join('\n'));
