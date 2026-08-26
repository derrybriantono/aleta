# Pemisahan Database ALETA, ALETA Bot, Manajemen Surat, dan SIPP

Dokumen ini menjelaskan target arsitektur database agar Portal ALETA tidak menulis tabel internal ke database SIPP.

## Target Arsitektur

| Kebutuhan | Database | Engine | Akses |
| --- | --- | --- | --- |
| Portal ALETA dan Manajemen Surat | `aleta` | PostgreSQL | Read/write oleh Portal ALETA |
| ALETA Bot queue/log/settings/public QA | `aleta_bot` | MySQL/MariaDB | Read/write oleh ALETA Bot |
| Format/template pesan ALETA Bot | `aleta_bot` | MySQL/MariaDB | Read/write oleh ALETA Bot |
| Data perkara SIPP | `SIPP` | MySQL/MariaDB | Read-only oleh ALETA/ALETA Bot |
| Antrian sidang jika ada | `sipp_turunan_antrian` | MySQL/MariaDB | Read-only sesuai kebutuhan |
| APS Badilag jika ada | `aps_badilag` | MySQL/MariaDB | Read-only sesuai kebutuhan |

## Env yang Benar

```env
ALETA_BOT_DB_NAME=aleta_bot
ALETA_BOT_DB_SIPP_NAME=SIPP
```

`ALETA_BOT_DB_NAME` adalah database internal ALETA Bot.  
`ALETA_BOT_DB_SIPP_NAME` adalah database SIPP yang hanya dibaca.

Jangan menyamakan keduanya. Jika keduanya sama-sama `SIPP`, tabel `aleta_bot_*` akan dibuat di database SIPP.

## Perubahan Kode yang Mencegah Masalah Berulang

- `aleta_bot/services/botDbService.js` sekarang memakai `aleta_bot/bot_db_config.js`.
- `aleta_bot/bot_db_config.js` menolak konfigurasi jika database internal sama dengan database SIPP.
- `aleta_bot/db_config.js` tetap dipakai untuk koneksi SIPP legacy/read-only dan membaca env `ALETA_BOT_DB_SIPP_*`.
- `aleta_bot/services/configValidationService.js` menolak konfigurasi produksi yang menyamakan database internal bot dengan SIPP.

## Cara Setup MySQL/MariaDB

1. Salin dan edit:

```text
deploy/sql/setup-aleta-mysql-databases.sql
```

2. Ganti placeholder password.

3. Jalankan sebagai DBA/root MySQL.

4. Buat seluruh tabel internal ALETA Bot:

```powershell
mysql -u aleta_bot_user -p aleta_bot < deploy/sql/schema-aleta-bot-mysql.sql
```

5. Set env:

```env
ALETA_BOT_DB_HOST=127.0.0.1
ALETA_BOT_DB_PORT=3306
ALETA_BOT_DB_USER=aleta_bot_user
ALETA_BOT_DB_PASSWORD=<password_aleta_bot_user>
ALETA_BOT_DB_NAME=aleta_bot

ALETA_BOT_DB_SIPP_HOST=127.0.0.1
ALETA_BOT_DB_SIPP_PORT=3306
ALETA_BOT_DB_SIPP_USER=sipp_readonly_user
ALETA_BOT_DB_SIPP_PASSWORD=<password_sipp_readonly_user>
ALETA_BOT_DB_SIPP_NAME=SIPP
```

6. Restart `aleta_bot`.

## Tabel Utama ALETA Bot

| Kelompok | Tabel |
| --- | --- |
| Pengaturan | `aleta_bot_settings` |
| Format pesan | `aleta_bot_message_templates`, `aleta_bot_message_template_versions`, `aleta_bot_message_template_placeholders`, `aleta_bot_message_template_render_logs` |
| Definisi notifikasi | `aleta_bot_notification_definitions`, `aleta_bot_notification_recipients` |
| Queue dan delivery | `aleta_bot_message_queue`, `aleta_bot_message_logs`, `aleta_bot_notification_runs`, `aleta_bot_policy_skip_logs` |
| Public Q&A | `aleta_bot_public_qa_intents`, `aleta_bot_public_qa_examples`, `aleta_bot_public_qa_logs`, `aleta_bot_public_qa_sessions`, `aleta_bot_public_qa_intent_versions`, `aleta_bot_public_qa_ai_logs`, `aleta_bot_public_qa_knowledge` |
| Koneksi eksternal | `aleta_bot_db_connections` |
| Kontrol operasional | `aleta_bot_approval_requests`, `aleta_bot_audit_logs`, `aleta_bot_worker_locks` |

## Cara Setup PostgreSQL Portal / Manajemen Surat

1. Salin dan edit:

```text
deploy/sql/setup-portal-postgres-database.sql
```

2. Ganti placeholder password.

3. Jalankan sebagai DBA/superuser PostgreSQL.

4. Set env:

```env
DATABASE_URL=postgresql://aleta:<password>@postgres:5432/aleta
POSTGRES_USER=aleta
POSTGRES_DB=aleta
```

5. Jalankan migrasi/bootstrap Portal ALETA sesuai pola project.

## Migrasi Tabel yang Sudah Terlanjur Masuk SIPP

Jangan langsung hapus tabel `aleta_bot_*` dari SIPP.

Tahapan aman:

1. Stop service `aleta_bot`.
2. Backup database SIPP.
3. Buat database `aleta_bot`.
4. Export tabel `aleta_bot_*` dari `SIPP`.
5. Import tabel tersebut ke database `aleta_bot`.
6. Ubah env agar `ALETA_BOT_DB_NAME=aleta_bot`.
7. Start `aleta_bot` dan pastikan queue/log/settings terbaca.
8. Setelah validasi, hapus tabel `aleta_bot_*` dari SIPP hanya jika backup dan import sudah aman.

## Prinsip Penting

- Database SIPP hanya boleh dibaca.
- Tabel internal ALETA tidak boleh dibuat di SIPP.
- User SIPP untuk ALETA harus read-only.
- User internal ALETA Bot hanya diberi hak write di database `aleta_bot`.
- Portal ALETA dan Manajemen Surat memakai PostgreSQL `aleta`.
