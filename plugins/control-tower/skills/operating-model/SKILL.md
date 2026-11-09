---
name: operating-model
description: Rules for working inside a Control Tower folder (CONTROL-TOWER.md or OPERATING-MODEL.md, control-tower.json, roles/, inbox/, decisions/queue.md, handoff/). Use when a session acts as one of the agent roles, raises a decision for the founder, writes a handoff, or touches a founder key such as publishing, money, secrets or customer sends.
---

# Working inside a Control Tower folder

If the current folder has `control-tower.json` and either `CONTROL-TOWER.md` or `OPERATING-MODEL.md`, follow these rules:

1. **Know your role.** Read `roles/<role>.md` and `inbox/<role>.md` before working. If no role was named, ask which one.
2. **Files are the only channel.** Ask another role by writing one dated item in `inbox/<their-role>.md`. Never edit another role's files.
3. **Never wait idle.** A decision you can't make goes to `decisions/queue.md` with options, a default, an undo line and a deadline; then move on.
4. **Keys are the founder's.** Anything listed under "Keys": prepare it fully, queue it with `Key: yes` and `Default: none`, never execute it.
5. **Route by risk** (high: Opus, standard: Sonnet, routine: Haiku); respect the weekly caps in `control-tower.json`; log spend in `spend/ledger.md`.
6. **End with a handoff** under 3 KB (`handoff/README.md`). Use `/control-tower:handoff <role>`.
