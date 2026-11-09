# Failure: nightly export ran twice (2026-11-04)

**Reporter:** engineering agent | **Severity:** medium | **Status:** fixed

## What happened
After the queue migration, both the old cron trigger and the new queue consumer fired the nightly export. 37 accounts got two identical CSV files in their bucket. One customer's import pipeline loaded both and double-counted a day of data.

## How we noticed
A customer emailed support (billing@northwind-example.com got it by mistake) at 08:40. No alert fired.

## Cost
About $800 in credits issued to the affected account.

## Root cause
Migration checklist said "switch off old trigger" but the step had no owner and no check. Two systems were both allowed to start the job.

## Rule
**Every scheduled job carries an idempotency key; a second run with the same key is a no-op and raises an alert.** (D-029)
