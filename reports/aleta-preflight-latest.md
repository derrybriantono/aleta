# ALETA Automated Preflight Report

Generated: 2026-05-13T07:21:47.997Z
Overall: FAIL

## Kesimpulan
- Siap smoke test dry-run: tidak
- Siap pilot non-WA: tidak
- Siap pilot WhatsApp terbatas: tidak
- Siap production: tidak

## Status Akhir
- WhatsApp runtime: unknown
- Worker: enabled=false, activeTimer=false, paused=false
- Queue: pending=n/a, processing=n/a, failed=n/a, resolved=n/a
- Dead-letter aktif: n/a
- Approval pending: 0
- Nomor WA pegawai: 42/42, missing=0
- Safe sending window: {}
- Reminder/scheduler: {"mode":"production","enabled":true,"schedulerEnabled":true,"schedulerMode":"production","killSwitch":false,"approved":true}
- AI bridge: unknown
- Portal proxy: {"statusEndpoint":"http_0","qrEndpoint":"http_0","portalStatus":"unknown","qrAvailable":false}

## Automated Cleanup
- reject_phase4_approval: Tidak ada approval Phase 4 pending yang perlu ditolak.

## Checks
| Status | Key | Detail |
| --- | --- | --- |
| FAIL | portal_reachable | Portal tidak reachable: fetch failed. |
| FAIL | bot_runtime_status | Runtime ALETA Bot tidak reachable: fetch failed. |
| FAIL | bot_whatsapp_status_endpoint | Endpoint status WhatsApp gagal: fetch failed. |
| FAIL | bot_whatsapp_diagnostics | Endpoint diagnostics gagal: fetch failed. |
| WARN | whatsapp_connection | WhatsApp belum connected: unknown. |
| WARN | portal_whatsapp_status_proxy | Portal status tidak readable tanpa sesi atau gagal: HTTP 0. |
| PASS | portal_whatsapp_mapping | Tidak ada mismatch connected runtime vs portal. |
| WARN | portal_qr_proxy | Endpoint QR portal HTTP 0. |
| FAIL | worker_operational | enabled=false, activeTimer=false, paused=false, running=false. |
| WARN | safe_sending_window | Safe Sending Window runtime belum lengkap atau belum terbaca. |
| WARN | dead_letters_active | Dead-letter endpoint tidak readable: HTTP 0. |
| PASS | portal_db | Koneksi database portal berhasil. |
| PASS | whatsapp_number_completeness | 42/42 pegawai punya nomor WhatsApp. Missing=0, priorityMissing=0. |
| PASS | approval_pending | 0 approval masih pending. Phase 4 exact match sudah dibersihkan jika ada. |
| WARN | reminder_scheduler_safety | mode=production, scheduler=enabled/production, killSwitch=false. |
| WARN | ai_bridge | AI Bridge status=unknown. API key tidak ditampilkan. |
| WARN | portal_tasks_endpoint | Endpoint /api/tasks HTTP 0; auth guard dianggap aktif bila 401. |
| PASS | validation_node_check_scripts_aleta_preflight_mjs | Command passed. |
| PASS | validation_node_check_app_js | Command passed. |
| PASS | validation_node_check_whatsapp_js | Command passed. |
| PASS | validation_node_check_services_whatsappstatusservice_js | Command passed. |
| PASS | validation_node_check_routes_internalgatewayroutes_js | Command passed. |
| PASS | validation_npx_tsc_noemit_pretty_false | Command passed. |
| FAIL | validation_npm_run_lint | Command failed with exit code 1. |
| PASS | validation_npm_run_build | Command passed. |
| FAIL | validation_npm_test | Command failed with exit code 1. |

## Validation
| Status | Command | Duration |
| --- | --- | --- |
| PASS | node --check scripts/aleta-preflight.mjs | 2316 ms |
| PASS | node --check app.js | 2385 ms |
| PASS | node --check whatsapp.js | 2068 ms |
| PASS | node --check services/whatsappStatusService.js | 2304 ms |
| PASS | node --check routes/internalGatewayRoutes.js | 2118 ms |
| PASS | npx tsc --noEmit --pretty false | 18464 ms |
| FAIL | npm run lint | 84960 ms |
| PASS | npm run build | 95599 ms |
| FAIL | npm test | 116702 ms |

## Blockers
- Portal manajemen_surat reachable: Portal tidak reachable: fetch failed.
- Runtime ALETA Bot status: Runtime ALETA Bot tidak reachable: fetch failed.
- WhatsApp status endpoint: Endpoint status WhatsApp gagal: fetch failed.
- WhatsApp diagnostics endpoint: Endpoint diagnostics gagal: fetch failed.
- Worker antrean: enabled=false, activeTimer=false, paused=false, running=false.
- npm run lint: Command failed with exit code 1.
- npm test: Command failed with exit code 1.

## Warnings
- WhatsApp Gateway: WhatsApp belum connected: unknown.
- Portal proxy status WhatsApp: Portal status tidak readable tanpa sesi atau gagal: HTTP 0.
- Portal proxy QR: Endpoint QR portal HTTP 0.
- Safe Sending Window: Safe Sending Window runtime belum lengkap atau belum terbaca.
- Dead-letter aktif: Dead-letter endpoint tidak readable: HTTP 0.
- Reminder dan scheduler: mode=production, scheduler=enabled/production, killSwitch=false.
- AI Bridge: AI Bridge status=unknown. API key tidak ditampilkan.
- Pusat Tugas endpoint: Endpoint /api/tasks HTTP 0; auth guard dianggap aktif bila 401.

## Risiko Tersisa
- Runner tidak melakukan scan QR, connect berulang, resend, enqueue real, atau production reminder.
- Endpoint admin berbasis sesi tetap perlu diuji dari UI Super Admin bila ingin memverifikasi tampilan per-role.
- Pilot WhatsApp terbatas belum disarankan sampai status WhatsApp connected dan semua warning operasional selesai.
- Production tetap tidak disarankan tanpa approval eksplisit dan gate terpisah.
