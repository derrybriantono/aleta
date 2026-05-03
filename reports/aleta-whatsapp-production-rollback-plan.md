# ALETA WhatsApp Production Rollback Plan

## Fast Safe Mode

1. Set `botEnabled=false`.
2. Set `notificationsEnabled=false`.
3. Set `dryRunEnabled=true`.
4. Set `dispositionDeadlineReminder.enabled=false`.
5. Set `dispositionDeadlineReminder.scheduler.enabled=false`.
6. Pause queue worker if queue failed grows.
7. Do not resend dead-letter automatically.
8. Run preflight and smoke dry-run.

## Rollback Triggers

- queue failed > 0
- active dead-letter > 0
- duplicate send suspected
- wrong recipient suspected
- scheduler sends outside approved scope
- WhatsApp browser_locked or stuck initializing