# -*- coding: utf-8 -*-
"""Variabel ABT baru - DISPENSASI KAWIN (4420-4439). Lihat variabel_def.py untuk aturan."""
from variabel_def import v

v(4420, 'DK: ALASAN MENDESAK RINGKAS (OTOMATIS: usia kehamilan #0999# terisi = hamil; selain itu berpacaran erat dengan lama #1666#)', 'data_sql',
  '''SELECT CASE WHEN TRIM("#0999#") <> "" THEN "anak para #0046# telah mengandung usia kehamilan sekitar #0999#"
  ELSE CONCAT("anak para #0046# dan calon suaminya telah berhubungan dekat (berpacaran)", IF(TRIM("#1666#") <> "", " selama #1666#", ""), " dan hubungan mereka sudah sedemikian erat sehingga keduanya khawatir terjerumus pada perbuatan yang dilarang oleh ketentuan Hukum Islam") END AS data''')
v(4421, 'DK: AKIBAT HUBUNGAN - KALIMAT KETERANGAN PEMOHON/ANAK/CALON/ORANG TUA CALON (OTOMATIS: hamil atau berpacaran erat)', 'data_sql',
  '''SELECT IF(TRIM("#0999#") <> "", "yang mengakibatkan hamil dan sekarang anak yang dikandung telah berumur #0999#", "dan hubungan mereka sudah sedemikian erat sehingga dikhawatirkan terjadi hal-hal yang dilarang oleh agama") AS data''')
v(4422, 'DK: AKIBAT HUBUNGAN - KALIMAT SAKSI DAN FAKTA (OTOMATIS: hamil atau berpacaran erat)', 'data_sql',
  '''SELECT IF(TRIM("#0999#") <> "", "yang mengakibatkan anak para Pemohon sekarang mengandung usia kehamilan sekitar #0999#", "dan hubungan keduanya sudah sedemikian erat sehingga dikhawatirkan terjadi hal-hal yang dilarang oleh agama") AS data''')
v(4423, 'DK: LATAR PERSETUJUAN ORANG TUA (OTOMATIS: hamil atau berpacaran erat)', 'data_sql',
  '''SELECT IF(TRIM("#0999#") <> "", "dan anak para Pemohon saat ini telah hamil dengan mengandung usia kehamilan sekitar #0999# karena telah melakukan hubungan seksual dengan calon suaminya", "sehingga timbul kekhawatiran terjadinya perbuatan yang dilarang oleh agama apabila keduanya tidak segera dinikahkan") AS data''')
v(4424, 'DK: SEBUTAN BUKTI SURAT ASLI (OTOMATIS: P.10 dan P.11 bila hamil; P.10 saja bila tidak)', 'data_sql',
  '''SELECT IF(TRIM("#0999#") <> "", "P.10 dan P.11", "P.10") AS data''')
v(4425, 'DK: PERTIMBANGAN BUKTI SURAT KETERANGAN HAMIL (OTOMATIS: hanya bila hamil; diawali satu baris baru)', 'data_sql',
  '''SELECT IF(TRIM("#0999#") <> "", "<br>Menimbang, bahwa Surat Keterangan atas nama #0606# yang dikeluarkan oleh #0997# merupakan akta otentik, yang melakukan pemeriksaan kesehatan dan menerangkan bahwa Anak Para #0046# yang bernama #0606# dalam kondisi hamil;", "") AS data''')
v(4426, 'DK: PERTIMBANGAN PERBEDAAN USIA (OTOMATIS dari SIPP perkara_mempelai_dk: selisih tanggal lahir calon suami dan calon istri; kosong bila tanggal lahir belum ada)', 'data_sql',
  '''SELECT IF(x.s IS NULL, "", CONCAT("<br>Menimbang, bahwa mengenai perbedaan usia antara anak yang dimohonkan dispensasi kawin dengan calon suami atau istrinya, berdasarkan data kelahiran keduanya selisih usia mereka sekitar ", x.s, " tahun, dan hal tersebut #8554# pertimbangkan bersama-sama dengan keterangan anak dan calon suami atau istrinya sebagaimana diuraikan di atas;")) AS data
FROM (SELECT ROUND(ABS(DATEDIFF(MAX(CASE WHEN jenis_mempelai = '1' THEN tanggal_lahir END), MAX(CASE WHEN jenis_mempelai = '2' THEN tanggal_lahir END))) / 365.25) AS s
      FROM perkara_mempelai_dk WHERE perkara_id = '#perkara_id#' AND tanggal_lahir IS NOT NULL AND tanggal_lahir <> '0000-00-00') x''')
v(4427, 'DK: REKOMENDASI PSIKOLOG / DOKTER / BIDAN / PEKERJA SOSIAL / P2TP2A / KPAD - ISIAN (nama lembaga dan kesimpulan singkat; kosongkan bila tidak ada rekomendasi)', 'data_teks')
v(4428, 'DK: PERTIMBANGAN REKOMENDASI (OTOMATIS: muncul hanya bila isian 4427 terisi)', 'data_sql',
  '''SELECT IF(TRIM("#4427#") <> "", CONCAT("<br>Menimbang, bahwa sesuai Pasal 16 huruf h Peraturan Mahkamah Agung Republik Indonesia Nomor 5 Tahun 2019 tentang Pedoman Mengadili Permohonan Dispensasi Kawin, #8554# telah mempertimbangkan kondisi psikologis, sosiologis, budaya, pendidikan, kesehatan, dan ekonomi anak dan orang tua berdasarkan rekomendasi dari #4427#, yang menjadi bahan pertimbangan #8554# bersama-sama dengan keterangan para pihak sebagaimana diuraikan di atas;"), "") AS data''')
