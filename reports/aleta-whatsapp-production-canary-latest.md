# ALETA WhatsApp Production Canary

Generated: 2026-05-02T23:45:12.375Z

Overall: **PASS**
Canary executed: **yes**
Workflow: internal_disposition_notification
Sent count: 3
Failed count: 0
Duplicate count: 0
Out-of-whitelist count: 0
botEnabled before/during/final: false/true/false

## Recipients
- DERRY BRIANTONO, S.H. (Hakim), 628****6962: sent
- ABDUL SALAM, S.HI. MH. (Ketua), 628****3055: sent
- AKBAR ALI, S.H.I. (Wakil Ketua), 628****1382: sent

## Gates
- PASS - Risk-check PASS: risk=PASS.
- PASS - Shadow-run PASS: shadow=PASS.
- PASS - Preflight usable: preflight=WARN.
- PASS - Smoke dry-run PASS: smoke=PASS.
- PASS - Whitelist canary: 3 penerima internal canary.
- PASS - Runtime reachable: Status runtime, WhatsApp, diagnostics, queue, dan dead-letter terbaca.
- PASS - WhatsApp connected: status=connected.
- PASS - WhatsApp tidak lock/stuck: lastErrorType=-, initializing=false.
- PASS - Session name tetap: session=aleta-whatsapp-main.
- PASS - Worker operasional: enabled=true, activeTimer=true, paused=false.
- PASS - Queue kosong: pending=0, processing=0, failed=0.
- PASS - Dead-letter aktif: 0 dead-letter aktif.
- PASS - Approval pending: 0 approval pending.
- PASS - Safe Sending Window allowed: enabled=true, 07:30-21:00, allowed=true.
- PASS - Scheduler/reminder belum production: reminder=false/dry_run, scheduler=false/dry_run.
- PASS - botEnabled true: botEnabled=true.
- PASS - notificationsEnabled true: notificationsEnabled=true.
- PASS - Queue tetap kosong: pending=0, processing=0, failed=0.

## Queue After Canary
- pending=0, processing=0, failed=0, sent=8
- dead-letter active=0
- approval pending=0

## Blockers
- Tidak ada blocker.

## Actions
- enable_bot_temporarily: botEnabled, notificationsEnabled, dan dryRunEnabled=false ditulis sementara untuk canary.
- restore_runtime_after_canary: Runtime config dikembalikan ke state sebelum canary.
