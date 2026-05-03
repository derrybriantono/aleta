# ALETA Pre-Pilot Checkpoint

Generated: 2026-05-02T08:47:06.257Z
Overall: WARN

## Ringkasan
- Preflight: WARN
- Smoke dry-run: PASS
- Pilot non-WA: boleh
- Pilot WhatsApp terbatas: boleh secara teknis, tetap via Super Admin/guard
- Production: tidak

## Status Operasional
- WhatsApp: connected
- Worker: enabled=true, activeTimer=true, paused=false
- Queue: pending=0, processing=0, failed=0
- Dead-letter aktif: 0
- Approval pending: 0
- Nomor WA pegawai: 42/42, missing=0
- Safe Sending Window: {"enabled":true,"start":"07:30","end":"21:00","inside":true,"allowed":true,"message":"Pengiriman berada dalam jam aman."}
- Reminder/scheduler: {"mode":"dry_run","enabled":false,"schedulerEnabled":false,"schedulerMode":"dry_run","killSwitch":false,"approved":false}
- AI Bridge: synced

## Validasi
- PASS: node scripts/aleta-preflight.mjs (overall=WARN)
- PASS: node scripts/aleta-smoke-dry-run.mjs (overall=PASS)
- PASS: node --check app.js
- PASS: node --check whatsapp.js
- PASS: node --check services/whatsappStatusService.js
- PASS: node --check routes/internalGatewayRoutes.js
- PASS: npx tsc --noEmit --pretty false
- PASS: npm run lint
- PASS: npm run build
- PASS: npm test (38/38 tests)

## Git Status
```text
M aleta_bot/app.js
 M aleta_bot/routes/internalGatewayRoutes.js
 M aleta_bot/services/botDbService.js
 M aleta_bot/services/messageQueueService.js
 M aleta_bot/services/whatsappStatusService.js
 M manajemen_surat/src/app/api/admin/aleta-bot/queue-recovery/route.ts
 M manajemen_surat/src/components/portal/admin-panels.tsx
 M manajemen_surat/src/components/portal/aleta-bot-admin.tsx
 M manajemen_surat/src/lib/aleta-bot-types.ts
 M manajemen_surat/src/server/modules/aleta-bot/service.ts
 M manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts
?? reports/
?? scripts/
```

## Git Diff Stat
```text
aleta_bot/app.js                                   | 205 ++++++++++++++++--
 aleta_bot/routes/internalGatewayRoutes.js          |  92 +++++++-
 aleta_bot/services/botDbService.js                 |   6 +
 aleta_bot/services/messageQueueService.js          |  93 ++++++---
 aleta_bot/services/whatsappStatusService.js        |  29 ++-
 .../api/admin/aleta-bot/queue-recovery/route.ts    |   7 +-
 .../src/components/portal/admin-panels.tsx         |   2 +-
 .../src/components/portal/aleta-bot-admin.tsx      | 231 +++++++++++++++++++--
 manajemen_surat/src/lib/aleta-bot-types.ts         |   5 +
 .../src/server/modules/aleta-bot/service.ts        | 101 +++++++--
 .../modules/aleta-bot/whatsapp-gateway-client.ts   |  31 ++-
 11 files changed, 713 insertions(+), 89 deletions(-)
warning: in the working copy of 'aleta_bot/app.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'aleta_bot/routes/internalGatewayRoutes.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'aleta_bot/services/botDbService.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'aleta_bot/services/messageQueueService.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'aleta_bot/services/whatsappStatusService.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'manajemen_surat/src/app/api/admin/aleta-bot/queue-recovery/route.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'manajemen_surat/src/components/portal/admin-panels.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'manajemen_surat/src/components/portal/aleta-bot-admin.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'manajemen_surat/src/lib/aleta-bot-types.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'manajemen_surat/src/server/modules/aleta-bot/service.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts', LF will be replaced by CRLF the next time Git touches it
```

## File Baru/Diubah
- M aleta_bot/app.js
-  M aleta_bot/routes/internalGatewayRoutes.js
-  M aleta_bot/services/botDbService.js
-  M aleta_bot/services/messageQueueService.js
-  M aleta_bot/services/whatsappStatusService.js
-  M manajemen_surat/src/app/api/admin/aleta-bot/queue-recovery/route.ts
-  M manajemen_surat/src/components/portal/admin-panels.tsx
-  M manajemen_surat/src/components/portal/aleta-bot-admin.tsx
-  M manajemen_surat/src/lib/aleta-bot-types.ts
-  M manajemen_surat/src/server/modules/aleta-bot/service.ts
-  M manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts
- ?? reports/
- ?? scripts/

## Saran Commit Grouping
- Commit 1: WhatsApp Gateway safety + singleton/init watchdog + dead-letter resolve plumbing.
- Commit 2: Portal Admin ALETA Bot readiness UI, queue recovery, and status mapping.
- Commit 3: Automated preflight/smoke runners and generated pilot checkpoint reports.

## Risiko Tersisa
- Production scheduler/reminder tetap disabled/dry_run dan belum boleh diaktifkan tanpa gate approval terpisah.
- Auth-guarded portal endpoints tetap mengembalikan 401 dari runner tanpa sesi; ini tidak dilonggarkan.
- Perubahan belum di-commit otomatis sesuai instruksi.
