# ALETA Post WhatsApp Single Test Checkpoint

Generated at: 2026-05-02T10:21:47.483Z

Overall: PASS
Aman lanjut pilot WhatsApp kecil: ya
Aman production: tidak

## Status Runtime
- WhatsApp: connected
- Worker: enabled=true, activeTimer=true, paused=false, running=false
- Queue: pending=0, processing=0, failed=0, sent=2, skipped=1
- Dead-letter aktif: 0
- Approval pending: 0
- botEnabled final: false
- Scheduler/reminder: dry_run, enabled=false, scheduler=false/dry_run
- AI Bridge: synced

## Uji WhatsApp 1 Pesan
- Recipient: DERRY BRIANTONO (Hakim), 628****6962
- Delivery: sent
- Queue ID: 6934307c-6c55-4157-aada-e67370fa3a4a

## Validasi
- PASS - node scripts/aleta-preflight.mjs (overall=WARN)
- PASS - node scripts/aleta-smoke-dry-run.mjs (overall=PASS)
- PASS - node --check app.js
- PASS - node --check whatsapp.js
- PASS - node --check services/whatsappStatusService.js
- PASS - node --check routes/internalGatewayRoutes.js
- PASS - npx tsc --noEmit --pretty false
- PASS - npm run lint
- PASS - npm run build
- PASS - npm test (38/38 tests)

## Warnings
- portal_whatsapp_status_proxy: Portal status tidak readable tanpa sesi atau gagal: HTTP 401.
- historical_skipped_queue_item: Ada queue item historis skipped dari uji saat botEnabled=false; tidak aktif dan bukan dead-letter.

## Blockers
- Tidak ada blocker.

## Risiko Tersisa
- Production scheduler/reminder tetap disabled/dry_run dan belum boleh production tanpa approval eksplisit.
- Pilot WhatsApp kecil berikutnya harus tetap whitelist, idempotent, dan dipantau queue/dead-letter.
