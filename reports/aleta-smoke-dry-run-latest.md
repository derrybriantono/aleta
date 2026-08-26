# ALETA Smoke Dry-run Report

Generated: 2026-05-13T07:21:47.999Z
Overall: FAIL

## Kesimpulan
- Siap pilot non-WA: tidak
- Siap pilot WhatsApp terbatas: tidak
- Siap production: tidak

## Status Akhir
- WhatsApp runtime: unknown
- Worker: enabled=false, activeTimer=false, paused=false
- Queue: pending=0, processing=0, failed=0
- Dead-letter aktif: 0
- Approval pending: 0
- Nomor WA pegawai: 42/42, missing=0
- Safe sending window: {}
- Reminder/scheduler: {"mode":"production","enabled":true,"schedulerEnabled":true,"schedulerMode":"production","killSwitch":false,"approved":true}
- AI Bridge: unknown

## Actions Taken
- read_only_smoke: Tidak ada send, resend, enqueue, approve, scan QR, logout/reset, atau production activation.

## Checks
| Status | Key | Detail |
| --- | --- | --- |
| FAIL | portal_reachable | Portal tidak reachable: fetch failed. |
| FAIL | bot_reachable | Runtime ALETA Bot tidak reachable: fetch failed. |
| FAIL | whatsapp_status_endpoint | Endpoint status WhatsApp gagal: fetch failed. |
| FAIL | whatsapp_diagnostics_endpoint | Endpoint diagnostics gagal: fetch failed. |
| PASS | runtime_response_sanitized | Smoke runner tidak menemukan token, QR raw, path session, stack trace, atau API key pada response runtime. |
| WARN | whatsapp_runtime | WhatsApp belum connected: unknown. |
| WARN | portal_whatsapp_status | Endpoint belum readable dari runner: fetch failed. |
| WARN | portal_whatsapp_qr | Endpoint belum readable dari runner: fetch failed. |
| WARN | portal_tasks | Endpoint belum readable dari runner: fetch failed. |
| WARN | portal_kpi | Endpoint belum readable dari runner: fetch failed. |
| WARN | portal_sla | Endpoint belum readable dari runner: fetch failed. |
| WARN | portal_disposisi_stats | Endpoint belum readable dari runner: fetch failed. |
| FAIL | worker_operational | enabled=false, activeTimer=false, paused=false, running=false. |
| FAIL | safe_sending_window | Safe Sending Window belum terbaca/sinkron. |
| PASS | dead_letters_active | 0 dead-letter aktif. 0 sudah ditangani. |
| PASS | phase4_dead_letter_active | Tidak ada dead-letter Phase 4 aktif. |
| PASS | queue_health | pending=0, processing=0, failed=0. |
| PASS | portal_db | Koneksi database portal berhasil. |
| PASS | whatsapp_number_completeness | 42/42 pegawai punya nomor WhatsApp. Missing=0, priorityMissing=0. |
| PASS | approval_pending | 0 approval masih pending. |
| PASS | phase4_approval_pending | Tidak ada approval Phase 4 pending. |
| PASS | reminder_scheduler_safety | mode=production, enabled=true, scheduler=enabled/production, killSwitch=false, approved=true. |
| PASS | public_qa_pending_review | 0 pertanyaan publik perlu review. |
| WARN | ai_bridge | AI Bridge status=unknown. Smoke tidak memanggil provider eksternal. |

## Blockers
- Portal reachable: Portal tidak reachable: fetch failed.
- ALETA Bot reachable: Runtime ALETA Bot tidak reachable: fetch failed.
- WhatsApp status endpoint: Endpoint status WhatsApp gagal: fetch failed.
- WhatsApp diagnostics endpoint: Endpoint diagnostics gagal: fetch failed.
- Worker antrean: enabled=false, activeTimer=false, paused=false, running=false.
- Safe Sending Window: Safe Sending Window belum terbaca/sinkron.

## Warnings
- WhatsApp Gateway: WhatsApp belum connected: unknown.
- /api/whatsapp/status: Endpoint belum readable dari runner: fetch failed.
- /api/whatsapp/qr: Endpoint belum readable dari runner: fetch failed.
- /api/tasks: Endpoint belum readable dari runner: fetch failed.
- /api/stats/kpi: Endpoint belum readable dari runner: fetch failed.
- /api/stats/surat/sla: Endpoint belum readable dari runner: fetch failed.
- /api/stats/disposisi: Endpoint belum readable dari runner: fetch failed.
- AI Bridge: AI Bridge status=unknown. Smoke tidak memanggil provider eksternal.

## Safety Notes
- Smoke runner ini read-only: tidak mengirim WhatsApp, tidak enqueue, tidak resend, tidak approve, tidak scan QR, dan tidak mengubah scheduler.
- Pilot WhatsApp terbatas tetap ditahan sampai WhatsApp Gateway connected dan warning operasional selesai.
- Production tetap tidak siap tanpa approval dan gate terpisah.
