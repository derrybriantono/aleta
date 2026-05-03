# ALETA Smoke Dry-run Report

Generated: 2026-05-03T11:34:04.633Z
Overall: PASS

## Kesimpulan
- Siap pilot non-WA: ya
- Siap pilot WhatsApp terbatas: ya
- Siap production: ya

## Status Akhir
- WhatsApp runtime: connected
- Worker: enabled=true, activeTimer=true, paused=false
- Queue: pending=0, processing=0, failed=0
- Dead-letter aktif: 0
- Approval pending: 0
- Nomor WA pegawai: 42/42, missing=0
- Safe sending window: {"enabled":true,"start":"07:30","end":"21:00","inside":true,"allowed":true,"message":"Pengiriman berada dalam jam aman."}
- Reminder/scheduler: {"mode":"production","enabled":true,"schedulerEnabled":true,"schedulerMode":"production","killSwitch":false,"approved":true}
- AI Bridge: synced

## Actions Taken
- read_only_smoke: Tidak ada send, resend, enqueue, approve, scan QR, logout/reset, atau production activation.

## Checks
| Status | Key | Detail |
| --- | --- | --- |
| PASS | portal_reachable | Portal HTTP 200. |
| PASS | bot_reachable | Runtime ALETA Bot reachable. |
| PASS | whatsapp_status_endpoint | Endpoint status WhatsApp reachable. |
| PASS | whatsapp_diagnostics_endpoint | Endpoint diagnostics WhatsApp reachable. |
| PASS | runtime_response_sanitized | Smoke runner tidak menemukan token, QR raw, path session, stack trace, atau API key pada response runtime. |
| PASS | whatsapp_runtime | WhatsApp connected. |
| PASS | portal_whatsapp_status | Endpoint HTTP 401; auth guard aktif dan tidak dilonggarkan. |
| PASS | portal_whatsapp_qr | Endpoint HTTP 401; auth guard aktif dan tidak dilonggarkan. |
| PASS | portal_tasks | Endpoint HTTP 401; auth guard aktif dan tidak dilonggarkan. |
| PASS | portal_kpi | Endpoint HTTP 401; auth guard aktif dan tidak dilonggarkan. |
| PASS | portal_sla | Endpoint HTTP 401; auth guard aktif dan tidak dilonggarkan. |
| PASS | portal_disposisi_stats | Endpoint readable HTTP 200. |
| PASS | worker_operational | enabled=true, activeTimer=true, paused=false, running=false. |
| PASS | safe_sending_window | enabled 07:30-21:00; insideWindow=true, allowed=true. |
| PASS | dead_letters_active | 0 dead-letter aktif. 1 sudah ditangani. |
| PASS | phase4_dead_letter_active | Tidak ada dead-letter Phase 4 aktif. |
| PASS | queue_health | pending=0, processing=0, failed=0. |
| PASS | portal_db | Koneksi database portal berhasil. |
| PASS | whatsapp_number_completeness | 42/42 pegawai punya nomor WhatsApp. Missing=0, priorityMissing=0. |
| PASS | approval_pending | 0 approval masih pending. |
| PASS | phase4_approval_pending | Tidak ada approval Phase 4 pending. |
| PASS | reminder_scheduler_safety | mode=production, enabled=true, scheduler=enabled/production, killSwitch=false, approved=true. |
| PASS | public_qa_pending_review | 0 pertanyaan publik perlu review. |
| PASS | ai_bridge | AI Bridge status=synced. Smoke tidak memanggil provider eksternal. |

## Blockers
- Tidak ada blocker untuk smoke dry-run/non-WA pilot.

## Warnings
- Tidak ada warning.

## Safety Notes
- Smoke runner ini read-only: tidak mengirim WhatsApp, tidak enqueue, tidak resend, tidak approve, tidak scan QR, dan tidak mengubah scheduler.
- Pilot WhatsApp terbatas lolos smoke dry-run teknis; tetap jalankan hanya lewat kontrol Super Admin dan guard approval yang sudah ada.
- Production automation terbaca aktif dengan approval/gate dan queue sehat.
