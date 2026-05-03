# ALETA Pilot Non-WA Result

Generated: 2026-05-02T08:56:18.209Z
Run ID: 20260502085618
Overall: PASS

## Kesimpulan
- Pilot non-WA: boleh
- Lanjut uji WhatsApp terbatas: boleh secara teknis, tetap via guard Super Admin
- Production: tidak

## Data Uji
- Prefix: PILOT-NONWA
- Surat masuk: pilot-nonwa-in-20260502085618
- Disposisi: pilot-nonwa-dsp-20260502085618
- Surat keluar: pilot-nonwa-out-20260502085618

## Status Akhir
- WhatsApp: connected
- Queue: pending=0, processing=0, failed=0
- Dead-letter aktif: 0
- Approval pending: 0
- Reminder production: nonaktif
- Scheduler production: nonaktif

## Scenarios
| Status | Scenario | Detail |
| --- | --- | --- |
| PASS | Halaman login | /login reachable HTTP 200. |
| PASS | Portal utama | /portal reachable HTTP 200. |
| PASS | Dashboard Manajemen Surat | /manajemen-surat reachable HTTP 200. |
| PASS | Surat Masuk | /surat/masuk reachable HTTP 200. |
| PASS | Surat Keluar | /surat/keluar reachable HTTP 200. |
| PASS | Patch Notes | /patch-notes reachable HTTP 200. |
| PASS | Panduan | /panduan reachable HTTP 200. |
| PASS | Pusat Masukan | /masukan reachable HTTP 200. |
| PASS | Admin ALETA Bot | /admin/aleta-bot reachable HTTP 200. |
| PASS | Runtime ALETA Bot before | Runtime readable; WhatsApp=connected. |
| PASS | Worker before | enabled=true, activeTimer=true, paused=false. |
| PASS | Queue before | pending=0, processing=0, failed=0. |
| PASS | Dead-letter before | 0 dead-letter aktif. |
| PASS | Safe Sending Window before | enabled=true, 07:30-21:00. |
| PASS | Portal database | Koneksi database portal berhasil. |
| PASS | Login/role dasar | DB memiliki 42 user aktif. Actor pilot role=admin; recipient role=super-admin. |
| PASS | Input surat masuk PILOT-NONWA | Surat masuk dibuat: PILOT-NONWA-IN/20260502085618. |
| PASS | Detail surat | Detail DB konsisten; currentDispositionId=pilot-nonwa-dsp-20260502085618. |
| PASS | Disposisi | Disposisi status=Menunggu Tindak Lanjut. |
| PASS | Deadline disposisi | Deadline=2026-05-03T08:56:43.867Z. |
| PASS | Read status disposisi | ReadAt=2026-05-02T08:56:44.867Z. |
| PASS | Pusat Tugas task candidate | Disposisi PILOT-NONWA aktif dan memenuhi kandidat task source Manajemen Surat. |
| PASS | Workflow surat keluar | Workflow akhir=rejected; path draft -> submitted -> rejected. |
| PASS | Export laporan CSV | CSV preview minimal valid untuk data PILOT-NONWA; endpoint export tetap auth-guarded dari runner tanpa sesi. |
| PASS | Runtime ALETA Bot after | Runtime readable; WhatsApp=connected. |
| PASS | Worker after | enabled=true, activeTimer=true, paused=false. |
| PASS | Queue after | pending=0, processing=0, failed=0. |
| PASS | Dead-letter after | 0 dead-letter aktif. |
| PASS | Safe Sending Window after | enabled=true, 07:30-21:00. |
| PASS | Tidak ada queue WhatsApp baru | before pending/processing/failed=0/0/0, after=0/0/0. |
| PASS | Approval pending setelah pilot | 0 approval pending. |
| PASS | Phase 4 approval aktif | 0 approval Phase 4 pending. |
| PASS | Scheduler/reminder production tetap nonaktif | mode=dry_run, scheduler=disabled/dry_run. |

## Actions Taken
- non_wa_guard: Runner tidak memanggil endpoint send/resend/connect/approval production.
- create_pilot_nonwa_data: Data uji PILOT-NONWA dibuat tanpa jalur WhatsApp.

## Bugs
- Tidak ada bug blocker.

## Warnings
- Tidak ada warning.

## Safety Notes
- Pilot ini tidak mengirim WhatsApp, tidak enqueue real message, tidak resend dead-letter, tidak scan QR, tidak logout/reset, dan tidak mengaktifkan production scheduler/reminder.
- Data uji memakai prefix PILOT-NONWA dan tidak di-hard-delete.
