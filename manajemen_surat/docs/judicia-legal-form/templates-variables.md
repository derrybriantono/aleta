# Template Dan Variable Registry

## Format Template

- Target modern: DOCX metadata dan parser adapter.
- Kompatibilitas legacy: RTF.
- Output/preview: RTF/text-safe saat ini.
- PDF bukan template utama.

DOCX rendering penuh belum diklaim aktif tanpa dependency/engine dokumen yang tepat.

## Upload Template

Upload dibatasi oleh:

- `jlf.upload.max_file_size_mb`
- `jlf.upload.allowed_template_types`

Executable dan macro VBA ditolak. File disimpan di storage private.

## Placeholder

Legacy:

- `#0001#`
- `#0048#`
- `#1234#`

Modern:

- `{{nomor_perkara}}`
- `{{nama_pihak_1}}`
- `{{tanggal_sidang}}`

Placeholder invalid tidak membuat sistem crash. Unknown placeholder ditampilkan sebagai warning.

## Variable Registry

Variabel memiliki:

- `legacy_code`
- `key`
- `label`
- `data_type`
- `source_type`
- `source_key`
- `transform_key`
- `fallback_value`
- `is_required`

## Source Type

Contoh:

- `sipp_perkara`
- `sipp_pihak`
- `sipp_jadwal_sidang`
- `sipp_hakim`
- `jlf_manual`
- `function`
- `computed`
- `static`
- `ai`

## Transform Function

Transform yang tersedia antara lain:

- tanggal Indonesia panjang/pendek
- hari/bulan Indonesia
- angka terbilang
- rupiah
- daftar hakim/panitera/jurusita
- jadwal sidang
- umur
- sanitize text
- escape RTF/DOCX
- QR payload

## Importer Legacy

Importer legacy ABT membaca SQL/file legacy dalam mode dry-run default dan menghasilkan laporan. Query legacy berisiko ditandai `needs_review` dan tidak diaktifkan otomatis.

