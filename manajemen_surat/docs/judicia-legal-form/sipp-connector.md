# SIPP Connector

## Prinsip

SIPP adalah sumber data perkara read-only. JLF tidak boleh melakukan write ke database SIPP, tidak boleh menerima raw SQL dari client, dan tidak boleh membuat endpoint eksekusi SQL bebas.

## Provider Mode

- `disabled`: default aman. Tidak ada koneksi SIPP.
- `aleta_bot_bridge`: memakai bridge internal ALETA Bot jika tersedia dan aman.
- `direct_mysql`: placeholder. Belum aktif tanpa izin dependency MySQL/MariaDB.

## Query Safety

JLF hanya memanggil operasi terdaftar seperti:

- `case.searchByNumber`
- `case.searchByPartyName`
- `case.detail`
- `user.search`
- `user.byId`

Bridge harus menjalankan query terdaftar/parameterized. Client tidak pernah mengirim SQL.

## Guard

Input pencarian melewati validasi panjang dan guard kata SQL seperti `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`.

Hasil search dipotong sesuai limit server-side meski provider mengembalikan data lebih banyak.

## Health Check

Endpoint:

- `/api/judicia/legal-form/sipp/health`

Output tidak menampilkan credential/token.

## Troubleshooting

- `provider disabled`: aktifkan `jlf.sipp.enabled` dan konfigurasi provider.
- `bridge unavailable`: cek URL internal ALETA Bot dan token internal.
- `direct_mysql not implemented`: ini expected sampai dependency disetujui.
- Search kosong: cek query minimal 3 karakter dan permission `case.search`.

