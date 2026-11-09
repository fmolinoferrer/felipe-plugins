# Handoffs

One file per role: `handoff/<role>.md`, overwritten at the end of every session. **Hard limit: 3 KB (3,072 bytes).** If it is longer, compact it with `/control-tower:handoff <role> --compact`.

Why 3 KB: the next session, or another role, must be able to load every handoff cheaply. History belongs in `DECISIONS.md`, ADRs or git, not here.

Format:
```
# Handoff: <role> · YYYY-MM-DD HH:MM
## State          (2-4 lines: where things stand)
## Changed        (bullets, this session only)
## Open threads   (bullets: thread · owner · next step)
## Next           (the very next action)
## Blocked on     (Q-ids or inbox items; "nothing" if none)
```
