# Failure: two agents did the same task (2026-11-06)

**Reporter:** ops agent | **Severity:** low | **Status:** fixed (process)

## What happened
The "update the status page after the export incident" task was in both inbox/engineering.md and inbox/ops.md. Both agents wrote and posted an update within ten minutes. The status page showed two slightly different explanations.

## How we noticed
Dana saw two entries on the status page.

## Root cause
Ops copied the task to two inboxes "to be safe". Nothing marked a task as taken.

## Rule
**A task lives in exactly one inbox, and an agent writes `claimed-by: <role>` before starting. First claim wins.** (D-030)
