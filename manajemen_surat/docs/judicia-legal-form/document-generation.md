# Generate Dokumen

## Alur

1. Cari perkara SIPP melalui adapter read-only.
2. Buka detail perkara.
3. Pilih template aktif.
4. Sistem membaca versi template terbaru.
5. Sistem mendeteksi placeholder.
6. Sistem resolve variabel.
7. User melihat preview.
8. User mengisi data manual jika ada variabel kosong.
9. Sistem generate draft.
10. Sistem menyimpan snapshot variabel.
11. User download melalui route authorized.
12. Jika template perlu validasi, dokumen diajukan ke workflow validasi.

## Resolver

Prioritas default:

1. Data manual JLF override.
2. Data SIPP read-only.
3. Computed/function.
4. Static/fallback.
5. AI hanya jika user meminta eksplisit dan fitur aktif.

## Output

RTF/text-safe rendering sudah tersedia. DOCX full rendering belum aktif.

## Snapshot

Setiap generate menyimpan `jlf_document_variables_snapshot` agar nilai saat dokumen dibuat dapat diaudit.

## Download

File tidak berada di public folder. Download harus lewat endpoint authorized:

- `/api/judicia/legal-form/documents/[id]/download`

## Validasi

Status dokumen:

- `draft`
- `generated`
- `waiting_validation`
- `change_requested`
- `approved`
- `rejected`
- `finalized`
- `archived`

Dokumen finalized tidak boleh diubah sembarangan.

