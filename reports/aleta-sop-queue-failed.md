# SOP: Queue Failed

## Goal

Prevent retry storms and isolate the cause of queue failure.

## Do Not

- Do not retry mass messages.
- Do not enable production scheduler.
- Do not enable production reminder.
- Do not change `botEnabled` permanently.

## Steps

1. Check queue counts: pending, processing, failed, dead-letter.
2. Check worker: enabled, active timer, paused.
3. Check WhatsApp status.
4. Check Safe Sending Window.
5. Check policy skip report.
6. If failed remains greater than 0, pause new WhatsApp tests.
7. Review one failed item at a time.
8. Only retry after source, recipient, and policy are confirmed safe.
9. Run preflight and smoke dry-run after recovery.

## Launch Decision Impact

- Queue failed greater than 0 blocks WhatsApp limited pilot.
- If Manajemen Surat is unaffected, non-WA operations may continue.
- Production automation remains disabled.
