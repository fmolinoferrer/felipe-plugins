# Agent Operations Readiness Rubric

Score each of the six areas 0-4. Pick the highest level where **every** descriptor is true. If evidence is missing, score the lower level and note "unverified".

Overall readiness = average of the six areas (one decimal). Any area at 0 or 1 is a blocker for that area's agents, regardless of the average.

| Overall | Meaning |
|---|---|
| 0.0-1.4 | Not ready. Start with one supervised agent and the coordination files. |
| 1.5-2.4 | Pilot-ready. Run 3-5 standing roles under a 2-week pilot. |
| 2.5-3.4 | Scale-ready. Add on-demand roles, spend caps per role, decision packs. |
| 3.5-4.0 | Operating. Optimize routing, cost, and cadence. |

---

## 1. Work definition (Can agents be told what "done" is?)

| Level | Descriptors |
|---|---|
| 0 | Work lives in people's heads or chat threads. No written tickets or acceptance criteria. |
| 1 | A tracker exists but tickets are one-liners. Acceptance criteria are rare. |
| 2 | Most tickets have a goal and acceptance criteria. Specs exist for larger features. |
| 3 | Tickets are sized to under a day, with acceptance criteria and links to the relevant code/docs. Specs follow a template. |
| 4 | Work is decomposed into agent-sized tasks by default. Every task names its owner role, inputs, output file, and the check that proves it is done. |

## 2. Coordination (How does work move between people and agents?)

| Level | Descriptors |
|---|---|
| 0 | Coordination is synchronous: meetings and DMs. Nothing an agent could read. |
| 1 | Some written status updates, but scattered across tools. No single place for decisions. |
| 2 | A written decision log or ADR folder exists. Handoffs are written for some work. |
| 3 | Per-role inboxes (files or queues), a decisions queue, and ADRs are in use. Handoffs are short (under 3 KB) and follow a template. |
| 4 | All agent-to-agent and agent-to-human coordination happens through files. Decision packs go out on a fixed cadence; unanswered items proceed on their stated default with an undo line. |

## 3. Decision rights (Who may decide what?)

| Level | Descriptors |
|---|---|
| 0 | Nobody has written down which decisions need a human. Agents (if any) act on anything they can reach. |
| 1 | Informal sense that "risky stuff" needs approval, but not defined. |
| 2 | A written list of human-only decisions exists (for example: publish, money, schema, secrets, customer sends). |
| 3 | Human-only decisions ("keys") are enforced by permissions or review gates, not just policy. Each key has a named owner. |
| 4 | Keys are audited weekly. Every non-key decision has a default, a reversibility rating, and an undo path. |

## 4. Quality and verification (How do you know agent output is right?)

| Level | Descriptors |
|---|---|
| 0 | No automated tests. Review is ad hoc. |
| 1 | Some tests; CI is flaky or optional. Review depends on one or two people. |
| 2 | CI runs on every change and blocks merges. Code review is required. |
| 3 | A QA role (human or agent) owns test plans. Agent output is checked by a different role than the one that produced it. Rollback is documented. |
| 4 | Every agent deliverable has an automated or independent check. Defect escape rate is measured and trending down. |

## 5. Security and data (Can agents touch the systems safely?)

| Level | Descriptors |
|---|---|
| 0 | Shared credentials, production data on laptops, no data classification. |
| 1 | Individual accounts exist, but secrets live in code or chat. Regulated data is not mapped. |
| 2 | Secrets in a manager. Data is classified at least as public / internal / confidential / regulated. |
| 3 | Agents run with least-privilege credentials, no production write access, and no regulated data in prompts. An InfoSec role reviews new agent permissions. |
| 4 | Agent actions are logged and reviewed. Permission changes require a key holder. Incident runbook covers agent misbehavior. |

## 6. Cost and model governance (Is spend predictable?)

| Level | Descriptors |
|---|---|
| 0 | No idea what AI spend is or who incurs it. |
| 1 | Total spend is visible monthly; no per-person or per-role view. |
| 2 | Spend is tracked weekly. A default model is chosen deliberately. |
| 3 | Model routing by risk is written down (high-risk/hard reasoning on the top model, standard work on the mid model, routine work on the small model). Weekly spend caps per role. |
| 4 | Caps are enforced; overruns trigger a decision-pack item. Cost per shipped outcome is tracked and reviewed monthly. |

---

## Scoring notes

- Score what is **practiced**, not what is planned. A policy nobody follows is level 1 at best.
- Regulated data (health, payment card, government ID, children's data, or anything under a contract with data terms) caps Security and data at 2 until a data map exists.
- Record one line of evidence per score. "Told us in interview" is acceptable evidence but should be marked as such.
