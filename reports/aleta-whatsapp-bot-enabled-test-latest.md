# ALETA WhatsApp Bot Enabled Limited Test

Generated at: 2026-05-02T09:49:41.627Z

Overall: PASS
botEnabled before: false
botEnabled after enable: true
botEnabled final: false
Message sent: yes
Sent count: 1
Enqueued count: 1
Recipient: DERRY BRIANTONO (Hakim), 628****6962
Idempotency key: limited-wa-test-derry-briantono-2026-05-02-001

## Gate Sebelum Enable
- PASS - Preflight terakhir: overall=WARN, safeToRunSmokeTest=true.
- PASS - Smoke dry-run terakhir: overall=PASS, safeForLimitedWhatsAppPilot=true.
- PASS - Runtime ALETA Bot reachable: Status, WhatsApp, diagnostics, dan queue runtime dibaca.
- PASS - WhatsApp runtime connected: status=connected.
- PASS - WhatsApp tidak terkunci/stuck: lastErrorType=-, initializing=false, initializeAgeMs=0.
- PASS - Worker operasional: enabled=true, activeTimer=true, paused=false.
- PASS - Queue kosong sebelum enable: pending=0, processing=0, failed=0.
- PASS - Dead-letter aktif: 0 dead-letter aktif.
- PASS - Approval pending: 0 approval pending.
- PASS - Safe Sending Window allowed: enabled=true, 07:30-21:00, allowed=true.
- PASS - Reminder/scheduler production disabled: reminder=false/dry_run, scheduler=false/dry_run, killSwitch=false.
- PASS - Nomor tujuan internal valid: Penerima ditemukan sebagai user aktif internal dengan nomor WhatsApp terdaftar.

## Gate Sebelum Kirim
- PASS - botEnabled terbaca true: botEnabled=true.
- PASS - Queue tetap kosong sebelum kirim: pending=0, processing=0, failed=0.
- PASS - Scheduler/reminder tetap non-production: reminder=false/dry_run, scheduler=false/dry_run.
- PASS - WhatsApp tetap connected: status=connected.

## Status Setelah Uji
- WhatsApp: connected
- Worker: enabled=true, activeTimer=true, paused=false
- Queue: pending=0, processing=0, failed=0, sent=2
- Dead-letter aktif: 0
- Approval pending: 0
- Delivery: sent (6934307c-6c55-4157-aada-e67370fa3a4a)

## Actions Taken
- enable_bot_temporarily: botEnabled=true ditulis ke runtime config resmi untuk uji satu pesan internal.
- send_limited_internal_test: Satu pesan test internal baru dimasukkan ke queue resmi ALETA Bot untuk 628****6962.
- disable_bot_after_test: botEnabled dikembalikan ke nilai semula setelah uji satu pesan internal.

## Blockers
- Tidak ada blocker.

## Warnings
- Tidak ada warning.

## Safety
- Tidak ada broadcast.
- Tidak ada resend queue lama atau dead-letter.
- Tidak ada scheduler/reminder production yang diaktifkan.
- Tidak ada scan QR, logout/reset session, atau perubahan session.
