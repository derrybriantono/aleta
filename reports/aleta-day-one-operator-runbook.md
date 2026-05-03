# ALETA Day-One Operator Runbook

Release: ALETA Full Internal Launch - 0.1.0-beta.5 Operational

## Start of Day

1. Run `node scripts/aleta-preflight.mjs`.
2. Run `node scripts/aleta-smoke-dry-run.mjs`.
3. Confirm portal is reachable.
4. Confirm ALETA Bot runtime is reachable.
5. Confirm WhatsApp is connected.
6. Confirm worker is enabled, active timer is true, and paused is false.
7. Confirm queue pending, processing, and failed are all 0.
8. Confirm active dead-letter is 0.
9. Confirm approval pending is 0.
10. Confirm `botEnabled=false`.
11. Confirm scheduler/reminder production is disabled/dry_run.

## During Pilot Day

- Keep Admin ALETA Bot open for monitoring.
- Watch queue, dead-letter, approval, worker, and WhatsApp status.
- Use Manajemen Surat and Pusat Tugas normally for internal operations.
- Use Pusat Masukan for user feedback.
- Do not enable production automation.
- Do not broadcast.
- Do not send to external parties.
- Do not resend old skipped/dead-letter items.

## Limited WhatsApp Test Rule

WhatsApp test is allowed only when all are true:

- Explicit approval exists for exact recipients.
- Recipients are internal and whitelisted.
- Queue pending/processing/failed are 0.
- Dead-letter active is 0.
- Approval pending is 0.
- WhatsApp is connected.
- Worker is active.
- Safe Sending Window allows send.
- Scheduler/reminder production is disabled.
- `botEnabled` is returned to false after the test.

## End of Day

1. Run preflight.
2. Run smoke dry-run.
3. Export or save readiness status.
4. Review feedback.
5. Review queue and dead-letter history.
6. Keep production automation disabled.

## Escalation

Escalate to Super Admin if:

- WhatsApp becomes browser_locked or stuck initializing.
- Queue failed is greater than 0.
- Dead-letter active is greater than 0.
- Approval pending appears unexpectedly.
- Any production automation is enabled without approval.
- Users report inaccessible Manajemen Surat or Pusat Tugas.
