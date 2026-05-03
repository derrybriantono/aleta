# ALETA Small Internal WhatsApp Pilot

Generated at: 2026-05-02T10:56:10.543Z

Overall: PASS
Recipient count: 3
Sent count: 3
Enqueued count: 3
botEnabled before/during/final: false/true/false

## Recipients
- DERRY BRIANTONO, S.H. (Hakim), 628****6962: sent
- ABDUL SALAM, S.HI. MH. (Ketua), 628****3055: sent
- AKBAR ALI, S.H.I. (Wakil Ketua), 628****1382: sent

## Gates Before Enable
- PASS - Preflight terakhir: overall=WARN.
- PASS - Smoke dry-run terakhir: overall=PASS.
- PASS - Whitelist valid: 3 penerima whitelist valid.
- PASS - Runtime reachable: Status runtime, WhatsApp, diagnostics, dan queue dibaca.
- PASS - WhatsApp connected: status=connected.
- PASS - WhatsApp tidak lock/stuck: lastErrorType=-, initializing=false.
- PASS - Worker operasional: enabled=true, activeTimer=true, paused=false.
- PASS - Queue kosong: pending=0, processing=0, failed=0.
- PASS - Dead-letter aktif: 0 dead-letter aktif.
- PASS - Approval pending: 0 approval pending.
- PASS - Safe Sending Window allowed: enabled=true, 07:30-21:00, allowed=true.
- PASS - Scheduler/reminder non-production: reminder=false/dry_run, scheduler=false/dry_run.

## Gates Before Send
- PASS - botEnabled true: botEnabled=true.
- PASS - Queue tetap kosong: pending=0, processing=0, failed=0.
- PASS - Production tetap disabled: reminder=false/dry_run, scheduler=false/dry_run.

## Queue After Pilot
- pending=0, processing=0, failed=0, sent=5, skipped=1
- dead-letter active=0
- approval pending=0

## Actions
- generate_database_whitelist: Whitelist otomatis dibuat di D:\aleta\config\pilot-whatsapp-small-whitelist.json.
- enable_bot_temporarily: botEnabled=true ditulis sementara untuk pilot whitelist kecil.
- disable_bot_after_pilot: botEnabled dikembalikan ke nilai awal setelah pilot kecil.

## Blockers
- Tidak ada blocker.

## Warnings
- Tidak ada warning.
