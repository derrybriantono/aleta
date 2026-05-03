# ALETA Automated Preflight Report

Generated: 2026-05-03T11:29:38.174Z
Overall: WARN

## Kesimpulan
- Siap smoke test dry-run: ya
- Siap pilot non-WA: ya
- Siap pilot WhatsApp terbatas: ya
- Siap production: ya

## Status Akhir
- WhatsApp runtime: connected
- Worker: enabled=true, activeTimer=true, paused=false
- Queue: pending=0, processing=0, failed=0, resolved=1
- Dead-letter aktif: 0
- Approval pending: 0
- Nomor WA pegawai: 42/42, missing=0
- Safe sending window: {"enabled":true,"start":"07:30","end":"21:00","inside":true,"allowed":true,"message":"Pengiriman berada dalam jam aman."}
- Reminder/scheduler: {"mode":"production","enabled":true,"schedulerEnabled":true,"schedulerMode":"production","killSwitch":false,"approved":true}
- AI bridge: synced
- Portal proxy: {"statusEndpoint":"http_401","qrEndpoint":"http_401","portalStatus":"unknown","qrAvailable":false}

## Automated Cleanup
- resolve_phase4_dead_letter: Tidak ada Phase 4 dead-letter aktif yang perlu di-resolve.
- reject_phase4_approval: Tidak ada approval Phase 4 pending yang perlu ditolak.

## Checks
| Status | Key | Detail |
| --- | --- | --- |
| PASS | portal_reachable | Portal reachable HTTP 200. |
| PASS | bot_runtime_status | Runtime ALETA Bot reachable. |
| PASS | bot_whatsapp_status_endpoint | Endpoint status WhatsApp reachable. |
| PASS | bot_whatsapp_diagnostics | Endpoint diagnostics WhatsApp reachable. |
| PASS | bot_status_no_raw_qr | Tidak ada field QR raw pada status runtime. |
| PASS | diagnostics_sanitized | Diagnostics tidak menampilkan token, QR raw, atau path session sensitif. |
| PASS | whatsapp_connection | WhatsApp runtime connected. |
| WARN | portal_whatsapp_status_proxy | Portal status tidak readable tanpa sesi atau gagal: HTTP 401. |
| PASS | portal_whatsapp_mapping | Tidak ada mismatch connected runtime vs portal. |
| PASS | portal_qr_proxy | Endpoint QR portal HTTP 401. |
| PASS | worker_operational | enabled=true, activeTimer=true, paused=false, running=false. |
| PASS | safe_sending_window | enabled 07:30-21:00. insideWindow=true, allowed=true. |
| PASS | dead_letters_active | 0 dead-letter aktif. 1 sudah ditangani. |
| PASS | portal_db | Koneksi database portal berhasil. |
| PASS | whatsapp_number_completeness | 42/42 pegawai punya nomor WhatsApp. Missing=0, priorityMissing=0. |
| PASS | approval_pending | 0 approval masih pending. Phase 4 exact match sudah dibersihkan jika ada. |
| WARN | reminder_scheduler_safety | mode=production, scheduler=enabled/production, killSwitch=false. |
| PASS | ai_bridge | AI Bridge status=synced. API key tidak ditampilkan. |
| PASS | portal_tasks_endpoint | Endpoint /api/tasks HTTP 401; auth guard dianggap aktif bila 401. |
| PASS | validation_node_check_scripts_aleta_preflight_mjs | Command passed. |
| PASS | validation_node_check_app_js | Command passed. |
| PASS | validation_node_check_whatsapp_js | Command passed. |
| PASS | validation_node_check_services_whatsappstatusservice_js | Command passed. |
| PASS | validation_node_check_routes_internalgatewayroutes_js | Command passed. |
| PASS | validation_npx_tsc_noemit_pretty_false | Command passed. |
| PASS | validation_npm_run_lint | Command passed. |
| PASS | validation_npm_run_build | Command passed. |
| PASS | validation_npm_test | Command passed. |

## Validation
| Status | Command | Duration |
| --- | --- | --- |
| PASS | node --check scripts/aleta-preflight.mjs | 1380 ms |
| PASS | node --check app.js | 1398 ms |
| PASS | node --check whatsapp.js | 1327 ms |
| PASS | node --check services/whatsappStatusService.js | 1318 ms |
| PASS | node --check routes/internalGatewayRoutes.js | 1381 ms |
| PASS | npx tsc --noEmit --pretty false | 16019 ms |
| PASS | npm run lint | 62643 ms |
| PASS | npm run build | 92340 ms |
| PASS | npm test | 71029 ms |

## Blockers
- Tidak ada blocker teknis kritis dari runner.

## Warnings
- Portal proxy status WhatsApp: Portal status tidak readable tanpa sesi atau gagal: HTTP 401.
- Reminder dan scheduler: mode=production, scheduler=enabled/production, killSwitch=false.

## Risiko Tersisa
- Runner tidak melakukan scan QR, connect berulang, resend, enqueue real, atau production reminder.
- Endpoint admin berbasis sesi tetap perlu diuji dari UI Super Admin bila ingin memverifikasi tampilan per-role.
- Production tetap tidak disarankan tanpa approval eksplisit dan gate terpisah.
