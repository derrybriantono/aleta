# Instalasi Dan Konfigurasi JLF

## Database

ALETA memakai PostgreSQL dan Drizzle.

- Schema Drizzle: `src/server/db/drizzle-schema.ts`
- Runtime idempotent schema: `src/server/db/schema.ts`
- Migration: `drizzle/0003_judicia_legal_form_foundation.sql`
- Prefix tabel baru: `jlf_`

Development:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Jangan menjalankan migration ke production tanpa prosedur rilis.

## SIPP

Environment yang disiapkan:

- `JLF_SIPP_PROVIDER=disabled|aleta_bot_bridge|direct_mysql`
- `JLF_SIPP_BRIDGE_BASE_URL`
- `JLF_SIPP_BRIDGE_TOKEN`
- `SIPP_SEARCH_LIMIT`
- `SIPP_QUERY_TIMEOUT_MS`

Default aman adalah `disabled` atau `aleta_bot_bridge` jika endpoint internal aman tersedia. `direct_mysql` hanya placeholder sampai ada izin dependency MySQL/MariaDB.

Catatan Docker/CentOS:

- Jangan memakai `http://127.0.0.1:3003` dari container portal untuk menghubungi ALETA Bot, kecuali ALETA Bot berjalan di container yang sama.
- Gunakan URL service di network Docker, misalnya `JLF_SIPP_BRIDGE_BASE_URL=http://aleta_bot:3003` atau `ALETA_BOT_BASE_URL=http://aleta_bot:3003`.
- Jika nama service berbeda, cek dengan `docker-compose config --services`, lalu sesuaikan host pada URL.
- Konfigurasi database SIPP tetap berada di ALETA Bot. JLF hanya memanggil operasi bridge read-only seperti `case.searchByNumber`, bukan menjalankan SQL bebas.

## AI

JLF wajib memakai AI global ALETA:

- Global service: `src/server/modules/ai/service.ts`
- Provider client: `src/server/modules/ai/provider-client.ts`
- Tabel global: `ai_global_settings`, `ai_providers`

JLF tidak menyimpan API key dan tidak membuat provider/model picker terpisah.

## WhatsApp

JLF memakai gateway global:

- `src/server/modules/aleta-bot/whatsapp-gateway-client.ts`
- `src/server/modules/whatsapp/portal-whatsapp-sender.ts`
- Tabel global: `whatsapp_web_settings`, `aleta_bot_settings`

JLF hanya menyimpan toggle, template pesan aman, event notification, dan log JLF.

## Storage

Template dan output dokumen disimpan di storage private, default:

- `uploads/jlf/templates`
- `uploads/jlf/documents`
- `uploads/jlf/anonymized`

Jika `ALETA_UPLOAD_DIR` tersedia, folder JLF dibuat di bawah root tersebut. Jangan menyimpan dokumen sensitif di `public`.

## Setting Penting

- `jlf.enabled`
- `jlf.sipp.enabled`
- `jlf.upload.max_file_size_mb`
- `jlf.upload.allowed_template_types`
- `jlf.upload.allowed_anonymizer_types`
- `jlf.ai.enabled`
- `jlf.ai.use_global_aleta_ai_settings`
- `jlf.ai.require_verified_regulations`
- `jlf.whatsapp.enabled`
- `jlf.whatsapp.use_global_aleta_bot_gateway`
- `jlf.account_sync.enabled`
- `jlf.legacy_import.enabled`
