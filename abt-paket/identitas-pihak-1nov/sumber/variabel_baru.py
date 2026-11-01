# -*- coding: utf-8 -*-
"""Kueri BARU variabel 7047 (identitas #7024# = sisi 1) dan 7048 (identitas #7025# = sisi 2).
Dulu: CASE per jumlah pihak (1, 2, 3, 4, >=5) dengan ~45 penanda #nnnn# (ABT memecah SETIAP kemunculan penanda = satu pembacaan data tiap kemunculan) dan tiga bunyi berbeda
(umur hanya di satu cabang dengan tulisan "(umur)" tersisa, urutan pekerjaan/pendidikan beda antarcabang, ";" di dalam huruf tebal).
Sekarang: SATU jalan lewat fungsi isian_rtf_pihak_identitas (yang dulu hanya untuk urutan pihak tidak rapat), penanda hanya #0046#/#0047# (sebutan) dan #8540#/#8541# (kalimat kuasa);
alamat pihak pertama boleh diganti isian pengguna (no_var 8548/8549) persis seperti cabang lama. Dibungkus isian_rtf_identitas_kosong (paket identitas-kosong-31okt) seperti sebelumnya."""

KUERI = {
    7047: """SELECT aps_badilag.isian_rtf_identitas_kosong(x.data) AS data FROM (
SELECT aps_badilag.isian_rtf_pihak_identitas(#perkara_id#, 1, "#0046#", "tempat kediaman di", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = '#perkara_id#' AND t.no_var = 8548 LIMIT 1)), ''), ''), "#8540#") AS data
) x""",
    7048: """SELECT aps_badilag.isian_rtf_identitas_kosong(x.data) AS data FROM (
SELECT aps_badilag.isian_rtf_pihak_identitas(#perkara_id#, 2, "#0047#", "tempat kediaman di", IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '"', '') USING utf8) FROM aps_badilag.abt_data_teks t WHERE t.perkara_id = '#perkara_id#' AND t.no_var = 8549 LIMIT 1)), ''), ''), "#8541#") AS data
) x""",
}
