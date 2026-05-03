# ALETA Post-Copy Debug Baseline

Generated at: 2026-05-03T18:32:47+08:00

## Keputusan Baseline

Baseline validation: WARN_GO.

Validasi build, lint, test, syntax check, smoke dry-run, number quality, risk-check, dan shadow-run lulus. Preflight menghasilkan WARN non-blocking karena endpoint portal WhatsApp mengembalikan 401 tanpa sesi dan scheduler/reminder terbaca dalam mode production.

## Validasi Aplikasi Utama

| Check | Hasil | Catatan |
| --- | --- | --- |
| npx tsc --noEmit --pretty false | PASS | Tidak ada error TypeScript. |
| npm run lint | PASS | ESLint lulus tanpa warning. |
| npm run build | PASS | Next.js build berhasil. |
| npm test | PASS | 16 test files, 62 tests lulus. |

## Validasi ALETA Bot

| Check | Hasil |
| --- | --- |
| node --check app.js | PASS |
| node --check whatsapp.js | PASS |
| node --check services/whatsappStatusService.js | PASS |
| node --check routes/internalGatewayRoutes.js | PASS |
| node --check services/productionGuardService.js | PASS |
| node --check services/messageService.js | PASS |
| node --check services/idempotencyService.js | PASS |

## Validasi Root

| Check | Hasil | Catatan |
| --- | --- | --- |
| node scripts/aleta-preflight.mjs | WARN | Tidak ada blocker. |
| node scripts/aleta-smoke-dry-run.mjs | PASS | No-send dry-run. |
| node scripts/aleta-whatsapp-number-quality.mjs | PASS | 42/42 pegawai eligible. |
| node scripts/aleta-whatsapp-production-risk-check.mjs | PASS | Semua risk gate PASS. |
| node scripts/aleta-whatsapp-production-shadow-run.mjs | PASS | Semua workflow shadow-run PASS, tanpa kirim WA. |

## Status Runtime Dari Laporan

- Portal: reachable.
- ALETA Bot: reachable.
- WhatsApp: connected.
- Worker: enabled, activeTimer true, paused false.
- Queue: pending 0, processing 0, failed 0.
- Dead-letter aktif: 0.
- Approval pending: 0.
- Safe Sending Window: allowed, 07:30-21:00.
- Data WA: 42/42 eligible, dummy 0, duplicate 0, excluded 0.
- Production guard: PASS.

## Warning Baseline

1. Portal proxy WhatsApp mengembalikan HTTP 401 dari shell tanpa sesi. Ini sesuai auth guard dan bukan blocker.
2. Runtime/config saat ini menunjukkan botEnabled, notificationsEnabled, scheduler/reminder, dan productionAutomationEnabled sudah aktif setelah canary PASS. Ini berbeda dari baseline teks permintaan yang menyebut production masih menunggu canary, tetapi laporan canary dan launch audit lokal menunjukkan canary PASS dan production guard aktif.

## Catatan Keselamatan

- Tidak ada WhatsApp yang dikirim dalam ronde debugging ini.
- Tidak ada canary yang dijalankan.
- Tidak ada botEnabled, scheduler, reminder, atau config production yang diubah.
- Tidak ada perubahan auth, RBAC, API contract, database, atau value internal.
