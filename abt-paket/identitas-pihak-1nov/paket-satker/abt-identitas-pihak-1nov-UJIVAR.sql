-- Paket ABT "abt-identitas-pihak-1nov" (1 Nov 2026, agen V; keputusan pengguna 101 dan 102): format identitas pihak putusan/penetapan = blangko acuan "[01] [Kabul Verstek] Cerai (Format Lengkap)".
-- Variabel 7047, 7048 dan fungsi isian_rtf_pihak_identitas, isian_rtf_pihak_tambahan diubah; blangko RTF lewat daftar-tambal.tsv/tambal.tsv. Hanya pengguna derry_briantono. Prasyarat: paket ke-30 (perbaikan-1nov) terpasang.
-- UJIVAR: kueri baru tiap variabel diubah dijalankan pasang-satker.sh atas beberapa perkara contoh (@pid diisi skrip; rujukan #NNNN# = 0). Hanya memeriksa kueri berjalan tanpa galat.
SELECT 7047 AS no_var, COUNT(*) AS baris FROM (SELECT aps_badilag.isian_rtf_identitas_kosong(x.data) AS data FROM (
SELECT aps_badilag.isian_rtf_pihak_identitas(@pid, 1, "0", "tempat kediaman di", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8548 LIMIT 1)), ''), ''), "0") AS data
) x) AS uji_7047;
SELECT 7048 AS no_var, COUNT(*) AS baris FROM (SELECT aps_badilag.isian_rtf_identitas_kosong(x.data) AS data FROM (
SELECT aps_badilag.isian_rtf_pihak_identitas(@pid, 2, "0", "tempat kediaman di", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = @pid AND t.no_var = 8549 LIMIT 1)), ''), ''), "0") AS data
) x) AS uji_7048;
