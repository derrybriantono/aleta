# -*- coding: utf-8 -*-
"""Variabel ABT baru - WALI ADHAL (4440-4459). Lihat variabel_def.py untuk aturan."""
from variabel_def import v

v(4440, 'WALI ADHAL: UMUR #0046# SAAT PERKARA DIDAFTARKAN (OTOMATIS dari SIPP pihak.tanggal_lahir; kosong bila tanggal lahir belum ada)', 'data_sql',
  '''SELECT TIMESTAMPDIFF(YEAR, p.tanggal_lahir, pr.tanggal_pendaftaran) AS data
FROM perkara_pihak1 pp JOIN pihak p ON p.id = pp.pihak_id JOIN perkara pr ON pr.perkara_id = pp.perkara_id
WHERE pp.perkara_id = '#perkara_id#' AND pp.urutan = 1 AND p.tanggal_lahir IS NOT NULL AND p.tanggal_lahir <> '0000-00-00' LIMIT 1''')
v(4441, 'WALI ADHAL: PERTIMBANGAN PERSETUJUAN CALON MEMPELAI DAN UMUR (OTOMATIS: umur dari #4440#; bila belum 19 tahun diberi tanda PERIKSA)', 'data_sql',
  '''SELECT CONCAT("Menimbang, bahwa berdasarkan Pasal 6 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan dan Pasal 16 ayat (1) Kompilasi Hukum Islam, perkawinan harus didasarkan atas persetujuan calon mempelai, dan #0046# ",
  CASE WHEN TRIM("#4440#") = "" THEN "yang telah dewasa,"
       WHEN CAST("#4440#" AS UNSIGNED) >= 19 THEN CONCAT("yang berumur #4440# tahun telah memenuhi batas umur perkawinan 19 (sembilan belas) tahun sebagaimana Pasal 7 ayat (1) Undang-Undang Nomor 1 Tahun 1974 sebagaimana diubah dengan Undang-Undang Nomor 16 Tahun 2019,")
       ELSE CONCAT("[PERIKSA: umur #0046# menurut SIPP baru #4440# tahun, belum mencapai batas umur perkawinan 19 tahun - perlu dispensasi kawin] yang") END,
  " menyatakan sendiri kehendaknya untuk menikah dengan #1029# tanpa paksaan, sehingga syarat persetujuan calon mempelai telah terpenuhi;") AS data''')
v(4442, 'WALI ADHAL: PERTIMBANGAN MASA TUNGGU (IDDAH) (OTOMATIS: hanya bila status #1002# memuat kata janda; diawali satu baris baru)', 'data_sql',
  '''SELECT IF(LOWER("#1002#") LIKE "%janda%", "<br>Menimbang, bahwa oleh karena #0046# berstatus #1002#, perkawinan dengan calon suaminya baru dapat dilangsungkan setelah berakhirnya masa tunggu (iddah) sebagaimana ditentukan dalam Kompilasi Hukum Islam, dan berdasarkan keterangan #0046# serta keterangan saksi-saksi masa tunggu tersebut telah berakhir;", "") AS data''')
