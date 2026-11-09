# Failure: onboarding email sent to the wrong people (2026-11-05)

**Reporter:** growth agent | **Severity:** low | **Status:** fixed

## What happened
Email 2 of the onboarding sequence ("finish connecting your data source") went to people who had already connected one. The growth agent used a segment snapshot from Monday instead of the live segment.

## How we noticed
Three replies saying "already did this?" within an hour. Priya paused the sequence.

## Root cause
The agent cached the segment at planning time to save API calls and never refreshed it before sending. Nothing in the send step said "re-check".

## Rule
**Any send re-reads the live audience immediately before sending; snapshots are for planning only.**
