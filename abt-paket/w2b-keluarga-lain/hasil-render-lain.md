# Hasil render php56 (21 Okt 2026) - keluarga lain-lain

Renderer asli `Abt_model::variabel_library` (php 5.6) atas salinan aplikasi ABT dan basis sementara `aps_badilag_w2blain` (tabel selain `abt_variabel` = view ke `aps_badilag` lokal; `abt_variabel` = salinan + 26 variabel paket + 15 variabel lama dari server yang belum ada di ABT lokal). Perintah: `python alat/render_uji.py <keluar> kode=<rtf>@<perkara_id>`.

| blangko | perkara (SIPP lokal) | hasil | token tersisa |
|---|---|---|---|
| 9a Pengangkatan Anak [01] Kabul (timpa) | 6323 (5/Pdt.P/2022, isian 4910-4914 contoh) | OK, 4916-4919 tercetak benar | 0 |
| 9b Permohonan Umum [01] Kabul (baru) | 4505 (648/Pdt.P/2019, penetapan kematian) | OK | 0 |
| 9b Permohonan Umum [03] Tolak (baru) | 4505 | OK | 0 |
| 9c Mafqud [01] Kabul (timpa) | 4505 (data mafqud contoh) | OK, 4924 dan 4925 tercetak | 0 |

Batas: variabel POSITA RAPI / PETITUM RAPI / KETERANGAN SAKSI (9250, 9251, 9259, 9260) diganti stub karena fungsi `isian_rtf_*` ABT server tidak dapat disalin utuh ke MariaDB lokal (definisi di information_schema kehilangan garis miring terbalik); isinya tidak diuji di sini. Isian contoh ditulis sementara ke `aps_badilag.abt_data_teks` lokal lalu dihapus. Titik-titik yang tersisa adalah isian yang tidak diisi pada uji.
