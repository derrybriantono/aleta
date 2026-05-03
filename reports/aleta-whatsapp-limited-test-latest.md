# ALETA WhatsApp Limited Internal Test

Generated at: 2026-05-02T09:33:57.174Z

Overall: WARN
Message sent: no
Message enqueued: yes
Sent count: 0
Enqueued count in this run: 1
Recipient: DERRY BRIANTONO (Hakim), 628****6962

## Gate Sebelum Kirim
- PASS - Preflight terakhir: overall=WARN, safeToRunSmokeTest=true.
- PASS - Smoke dry-run terakhir: overall=PASS, safeForLimitedWhatsAppPilot=true.
- PASS - Runtime ALETA Bot reachable: Status, WhatsApp, diagnostics, dan queue runtime dibaca sebelum uji.
- PASS - WhatsApp runtime connected: status=connected.
- PASS - WhatsApp tidak terkunci/stuck: lastErrorType=-, initializing=false, initializeAgeMs=0.
- PASS - Worker operasional: enabled=true, activeTimer=true, paused=false, running=false.
- PASS - Queue kosong sebelum uji: pending=0, processing=0, failed=0.
- PASS - Dead-letter aktif: 0 dead-letter aktif.
- PASS - Approval pending: 0 approval pending sebelum uji.
- PASS - Nomor tujuan internal valid: Penerima ditemukan sebagai user aktif internal dengan nomor WhatsApp terdaftar.
- PASS - Safe Sending Window allowed: enabled=true, 07:30-21:00, allowed=true.
- PASS - Reminder/scheduler production tidak aktif: mode=dry_run, enabled=false, scheduler=false/dry_run.
- WARN - Global bot notification switch: botEnabled=false; uji tetap dibatasi ke satu pesan internal eksplisit melalui queue manual, bukan scheduler/notifikasi production.
- PASS - AI Bridge dicatat tanpa provider call: status=synced. Pesan test memakai teks statis non-AI.

## Status Setelah Uji
- WhatsApp: connected
- Worker: enabled=true, activeTimer=true, paused=false
- Queue: pending=0, processing=0, failed=0, sent=1
- Dead-letter aktif: 0
- Approval pending: 0
- Delivery: skipped (5794e285-8f83-45a6-ba61-672c059fcb4c)

## Actions Taken
- send_skipped_duplicate_idempotency: Idempotency key uji terbatas sudah ada; tidak membuat enqueue baru untuk 628****6962.

## Blockers
- Tidak ada blocker.

## Warnings
- Global bot notification switch: botEnabled=false; uji tetap dibatasi ke satu pesan internal eksplisit melalui queue manual, bukan scheduler/notifikasi production.
- Pesan uji tidak terkirim: Queue item diproses tetapi ditandai skipped oleh runtime. Tidak ada retry otomatis.

## Safety
- Tidak ada broadcast.
- Tidak ada resend dead-letter.
- Tidak ada scheduler/reminder production yang diaktifkan.
- Tidak ada scan QR, logout/reset session, atau perubahan session.
