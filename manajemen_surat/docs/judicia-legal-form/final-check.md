# Final Check JLF

## Konsistensi Produk

- Nama: ALETA Judicia (Legal Form).
- Route: `/judicia/legal-form`.
- Admin route: `/admin/judicia-legal-form`.
- Prefix tabel: `jlf_`.
- Tidak ada route baru `/abt`.
- ABT hanya legacy/importer.

## UI/UX

- Mengikuti PortalShell ALETA.
- Komponen memakai PageIntro, Card, Badge, Button, EmptyState, AccessDeniedCard.
- Menu permission-aware.
- Superadmin, Admin, dan User punya tampilan berbeda.

## Database

- Schema Drizzle JLF tersedia.
- Runtime ensure schema JLF tersedia.
- Migration foundation tersedia.
- Seed kategori, setting, jenis peraturan, dan topik tersedia.

## Auth/RBAC

- Auth tetap ALETA/better-auth.
- Permission server-side enforced.
- UI mengikuti permission.

## SIPP

- Adapter read-only.
- No raw SQL endpoint.
- No write operation.
- No SIPP password/hash storage.

## Account Sync

- Link/unlink masuk audit.
- Conflict tidak auto-link.
- Role mapping rekomendasi, approval default.

## Template/Dokumen

- Placeholder legacy dan modern didukung.
- Resolver dan transform tersedia.
- Snapshot generate tersedia.
- Download authorized.
- Workflow validasi tersedia.

## Legal KB

- Jenis peraturan, peraturan, versi, section, topik, verification, dan relation tersedia.

## AI

- Memakai AI global.
- Feature/global disable dihormati.
- Redaction, audit, prompt injection guard.
- Legal analysis pakai Legal KB dan verified-only mode.

## WhatsApp

- Memakai ALETA Bot global.
- Event notification/toggle/template/log tersedia.
- Pesan aman.

## Testing

- Vitest unit/integration/security JLF tersedia.
- Playwright smoke spec JLF tersedia.
- Lint terarah JLF lolos.

