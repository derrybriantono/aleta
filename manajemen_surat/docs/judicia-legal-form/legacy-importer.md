# Legacy Importer ABT SIPP

ABT SIPP hanya diperlakukan sebagai legacy/importer, bukan route atau prefix tabel baru.

## Sumber Legacy

- `assets/abt/database/data_abt_db.sql`
- `assets/abt/database/new_abt_db.sql`
- folder `_blangko_abt`
- tabel legacy seperti `abt_variabel`, `abt_config`, `abt_data_teks`, `abt_data_tanggal`, `abt_data_validasi_bas`, `abt_tanyajawab_id`, dan `abt_tanyajawab_template`

## Mode

- Dry-run default.
- Import eksplisit hanya jika diberi flag dan permission.
- Report JSON/Markdown.

## Laporan

Importer melaporkan:

- jumlah template ditemukan
- jumlah variabel ditemukan
- placeholder tidak dikenal
- variabel duplikat
- variabel tanpa source jelas
- query legacy yang perlu review
- file rusak/tidak terbaca
- rekomendasi key semantik

## Batasan

- Tidak menjalankan SQL legacy langsung ke production.
- Tidak import credential.
- Tidak import endpoint monitoring.
- Tidak mengaktifkan query legacy otomatis.
- Query write ditandai `needs_review`.

