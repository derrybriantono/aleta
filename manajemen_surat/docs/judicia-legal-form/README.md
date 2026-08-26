# ALETA Judicia (Legal Form)

ALETA Judicia (Legal Form), atau JLF, adalah modul portal ALETA untuk membuat dan mengelola legal form/dokumen perkara berbasis template, variabel, data SIPP read-only, validasi manusia, Legal Knowledge Base, AI global ALETA, dan notifikasi ALETA Bot/WhatsApp global.

## Route Utama

- Portal: `/judicia/legal-form`
- Admin: `/admin/judicia-legal-form`
- API root: `/api/judicia/legal-form`
- Prefix tabel: `jlf_`

Tidak ada route baru `/abt`. ABT hanya dipakai sebagai sumber legacy/importer.

## Fitur Utama

- Dashboard JLF role-aware.
- Pencarian perkara SIPP melalui adapter read-only.
- Template dokumen DOCX/RTF metadata dan RTF/text-safe rendering.
- Placeholder legacy `#0001#` dan modern `{{nomor_perkara}}`.
- Registry variabel dan mapping template-variable.
- Resolver variabel, transform, data manual, snapshot generate.
- Workflow validasi dokumen/BAS.
- QR verification token dengan output publik minimal.
- Legal Knowledge Base: jenis peraturan, peraturan, versi, section/pasal, topik, dan verifikasi.
- AI assistant memakai pengaturan AI global ALETA.
- WhatsApp notification memakai ALETA Bot/WhatsApp Gateway global.
- Account sync ALETA-SIPP tanpa menyimpan password/hash SIPP.
- Audit trail JLF dan reporting dasar.
- Anonimisasi dokumen dengan rule-based detector dan saran AI opsional.

## Permission Utama

Permission memakai RBAC ALETA existing, antara lain:

- `judicia_legal_form.view`
- `judicia_legal_form.dashboard.view`
- `judicia_legal_form.case.search`
- `judicia_legal_form.case.view`
- `judicia_legal_form.template.*`
- `judicia_legal_form.variable.*`
- `judicia_legal_form.document.*`
- `judicia_legal_form.manual_data.*`
- `judicia_legal_form.regulation.*`
- `judicia_legal_form.ai.*`
- `judicia_legal_form.account_sync.*`
- `judicia_legal_form.whatsapp.*`
- `judicia_legal_form.audit.view`
- `judicia_legal_form.settings.manage`

## Alur Umum

1. User login dengan akun ALETA.
2. User membuka JLF sesuai visibility dan permission.
3. User mencari perkara SIPP melalui adapter read-only.
4. User memilih template aktif.
5. Sistem resolve variabel dari data SIPP, manual, computed, static, atau fallback.
6. User melihat preview dan mengisi data manual jika perlu.
7. Sistem generate draft dan menyimpan snapshot variabel.
8. Jika perlu, dokumen diajukan ke validasi.
9. Validator approve/reject/request change/finalize.
10. Dokumen final diverifikasi melalui QR/token minimal.

