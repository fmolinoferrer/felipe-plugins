# agent-ops

Is your team ready to run with AI agents? A free, open-source readiness check plus a reference operating model for small companies run with a team of Claude Code agents.

## Install
```
/plugin marketplace add fmolinoferrer/felipe-plugins
/plugin install agent-ops@felipe-plugins
```

## What's inside
| Piece | What it does |
|---|---|
| `/agent-ops:readiness [team]` | Six questions, one per rubric area, then `agent-readiness.md`: level 0–4 per area, overall score, the two weakest areas with a next step you can take this week, and three agent roles to start with. |
| Skill `agent-operating-model` | The reference model Claude uses when you ask how agents should coordinate, who decides what, or which model to use: standing and on-demand roles, file-based coordination (inboxes, decisions queue, ADRs, 3 KB handoffs), twice-daily decision packs with defaults and undo lines, founder "keys", model routing by risk, weekly spend caps, a keep-moving check. |
| `rubric/readiness-rubric.md` | Six areas, levels 0–4 with concrete descriptors and scoring rules. |

Example:
```
/agent-ops:readiness Northwind Analytics
```

## Want the full sprint?
The **Agent Operating Model Sprint** (full assessment, client-ready proposal, 2-week pilot plan, hands-on setup) is a paid engagement by Felipe Molino. To put the model into practice yourself, use the free `control-tower` plugin in this marketplace.

## Limits
A self-check, not an audit: it scores what you tell it.

## License
MIT
