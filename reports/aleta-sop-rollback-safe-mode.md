# SOP: Rollback / Safe Mode

## Goal

Keep ALETA usable internally while stopping risky automation.

## Safe Mode Checklist

1. Confirm `botEnabled=false`.
2. Confirm scheduler/reminder production is disabled/dry_run.
3. Confirm no broadcast or external party notification is active.
4. Pause any new WhatsApp pilot tests.
5. Keep Manajemen Surat and Pusat Tugas available if portal is healthy.
6. Keep Admin ALETA Bot monitoring available.
7. Run preflight and smoke dry-run.

## When To Enter Safe Mode

- WhatsApp browser_locked.
- Worker is inactive or paused unexpectedly.
- Queue failed is greater than 0.
- Active dead-letter is greater than 0.
- Approval pending appears unexpectedly.
- Production automation was enabled without approval.

## Recovery Exit Criteria

- Preflight has no blocker.
- Smoke dry-run has no blocker.
- WhatsApp is connected if WhatsApp pilot will resume.
- Queue pending/processing/failed are 0.
- Dead-letter active is 0.
- Approval pending is 0.
- `botEnabled=false`.
- Scheduler/reminder production remains disabled/dry_run.
