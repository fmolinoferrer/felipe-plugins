# control-tower (lite)

Run a small AI agent team through files. One command sets up a starter team (Chief of Staff, Dev Lead, QA) with per-role instructions and inboxes, a decisions queue with defaults and undo lines, 3 KB handoffs, and weekly spend caps. A status view shows who is stuck.

## Install
```
/plugin marketplace add fmolinoferrer/felipe-plugins
/plugin install control-tower@felipe-plugins
```
Requires Node 18+ (standard library only).

## Commands
| Command | What it does |
|---|---|
| `/control-tower:init [company]` | Copies the 3-role starter into the current folder (never overwrites), then shows the status view. |
| `/control-tower:status [--nudge]` | One-screen health view: open decisions, overdue defaults, stale roles, handoff sizes, spend against caps. `--nudge` writes a nudge into each stale role's inbox. |
| `/control-tower:handoff <role> [--compact]` | Writes or compacts `handoff/<role>.md` to under 3 KB and checks the size. |

Example:
```
/control-tower:init Northwind Analytics
/control-tower:handoff dev-lead
/control-tower:status --nudge
```

The scripts also run on their own:
```
node scripts/init.mjs --out ./my-team
node scripts/status.mjs --dir ./my-team
```

## What you get
```
CONTROL-TOWER.md      how the team works: roles, loop, keys, routing, spend
control-tower.json    roles and caps (read by status)
roles/<role>.md       instructions per role
inbox/<role>.md       work for that role
decisions/queue.md    questions for the founder: options, default, undo, deadline
DECISIONS.md          log of decisions
handoff/<role>.md     each role's latest state, under 3 KB
spend/ledger.md       one line per session
```
The bundled `operating-model` skill keeps any Claude session in that folder following the rules: files are the only channel, never wait idle, never execute a founder key, end with a handoff.

## Control Tower Pro
Lite is a fixed starter. **Control Tower Pro** (paid, by Felipe Molino) adds a setup interview that tailors the model to your company, a full role library (product, data, marketing, infosec, finance, strategy and more), twice-daily decision packs that apply defaults with undo lines, model routing and spend-cap tuning, and keep-moving automation.

## Limits
- Three fixed roles; add more by hand (see `CONTROL-TOWER.md`).
- Spend is whatever roles log in the ledger; no billing integration.
- Status times use the machine's local time zone.

## License
MIT
