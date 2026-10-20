# -*- coding: utf-8 -*-
"""Variabel ABT baru keluarga LAIN-LAIN (agen W2b-C): pengangkatan anak, mafqud, permohonan umum. Jatah 4910-4939.

Pembagian dalam jatah:
  4910-4915  pengangkatan anak, ISIAN (data_teks) yang dipakai tanya-jawab saksi dan blangko
  4916-4919  pengangkatan anak, pertimbangan blangko (data_sql)
  4920-4929  mafqud     (4920-4923 isian katalog saksi: berkas variabel_lain_mafqud.py; sisanya blangko, di bawah)
  4930-4939  permohonan umum (4930-4934 isian katalog saksi: berkas variabel_lain_umum.py; sisanya blangko, di bawah)
Kueri hanya SELECT, MariaDB 5.5, kolom hasil `data`. Isian dibaca lewat aps_badilag.abt_data_teks (pola variabel server 9866, 9874).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from variabel_def import v  # noqa: E402


def isian(no, default=""):
    """Subkueri membaca isian petugas (data_teks) nomor `no`; kosong bila belum diisi."""
    return ("IFNULL((SELECT TRIM(CONVERT(t.data USING utf8)) FROM aps_badilag.abt_data_teks t WHERE t.no_var = %d AND t.perkara_id = '#perkara_id#' LIMIT 1), %s)"
            % (no, '"%s"' % default if default is not None else '""'))


# ---- PENGANGKATAN ANAK: isian (dibaca dari posita oleh pengisi; boleh diubah petugas) -------------------------------
v(4910, 'PENGANGKATAN ANAK: SEJAK KAPAN ANAK DIASUH #0046# - ISIAN: lanjutan kalimat "sejak ...", mis. "lahir" atau "tahun 2017" atau "bulan Maret 2021"', 'data_teks')
v(4911, 'PENGANGKATAN ANAK: ALASAN ORANG TUA KANDUNG MENYERAHKAN ANAK - ISIAN: mis. "ibu anak itu telah meninggal dunia dan ayahnya tidak mampu mengasuh sendiri"', 'data_teks')
v(4912, 'PENGANGKATAN ANAK: RIWAYAT PERKAWINAN DAN ANAK KANDUNG #0046# - ISIAN: mis. "dilangsungkan pada tanggal 12 Februari 2004 dan telah dikaruniai satu orang anak" atau "belum dikaruniai keturunan"', 'data_teks')
v(4913, 'PENGANGKATAN ANAK: IZIN ATAU REKOMENDASI INSTANSI SOSIAL - ISIAN: mis. "izin pengasuhan dari Dinas Sosial Provinsi ... Nomor ... tanggal ..."', 'data_teks')
v(4914, 'PENGANGKATAN ANAK: PENGHASILAN #0046# - ISIAN: mis. "sekitar Rp3.000.000,00 setiap bulan"', 'data_teks')
v(4915, 'PENGANGKATAN ANAK: TUJUAN PENGANGKATAN MENURUT #0046# - ISIAN: lanjutan kalimat, mis. "kelanjutan pendidikan, kesehatan, dan masa depan anak"', 'data_teks')

# ---- PENGANGKATAN ANAK: pertimbangan blangko [01] Kabul -----------------------------------------------------------------
v(4916, 'PENGANGKATAN ANAK: HUBUNGAN #0046# DENGAN CALON ANAK ANGKAT (OTOMATIS dari #8623#: kerabat atau bukan kerabat; kosong diberi tanda PERIKSA)', 'data_sql',
  '''SELECT CASE
  WHEN TRIM("#8623#") IN ("", "...", "-") THEN "Bahwa antara #7036# dan calon anak angkat [PERIKSA: hubungan keluarga atau bukan keluarga belum diisi pada variabel 8623]"
  WHEN LOWER("#8623#") REGEXP "^(bukan|tidak ada|tanpa|tidak)" THEN "Bahwa antara #7036# dan calon anak angkat tidak terdapat hubungan keluarga"
  ELSE CONCAT("Bahwa antara #7036# dan calon anak angkat terdapat hubungan keluarga, di mana #7036# adalah #8623# dari anak tersebut")
END AS data''')

v(4917, 'PENGANGKATAN ANAK: PERTIMBANGAN SYARAT CALON ANAK ANGKAT (OTOMATIS dari #8602#, #8618#, #8619#, #4911#, #4910#; bagian yang belum diisi dilewati)', 'data_sql',
  '''SELECT CONCAT("Menimbang, bahwa mengenai syarat calon anak angkat sebagaimana Pasal 12 ayat (1) Peraturan Pemerintah Nomor 54 Tahun 2007 tentang Pelaksanaan Pengangkatan Anak, "
  "berdasarkan bukti surat, keterangan orang tua kandung, dan keterangan para saksi, calon anak angkat bernama #8602#",
  IF(TRIM("#8618#") NOT IN ("", "...", "-"), CONCAT(", lahir di #8618#,"), ""),
  " masih berusia di bawah 18 (delapan belas) tahun dan beragama Islam seagama dengan #7036#",
  IF(TRIM("#8619#") NOT IN ("", "...", "-"), ", merupakan anak dari #8619#", ""),
  IF(TRIM("#4911#") NOT IN ("", "...", "-"), CONCAT(", yang diserahkan pengasuhannya kepada #7036# karena #4911#"), ""),
  IF(TRIM("#4910#") NOT IN ("", "...", "-"), CONCAT(", dan berada dalam asuhan #7036# sejak #4910#"), ", dan berada dalam asuhan #7036#"),
  ", sehingga calon anak angkat memenuhi syarat sebagai anak yang dapat diangkat;") AS data''')

v(4918, 'PENGANGKATAN ANAK: PERTIMBANGAN SYARAT CALON ORANG TUA ANGKAT (OTOMATIS dari #0099#, #8622#, #4912#, #4910#, #4913#, #0100#, #4914#; umur di luar batas diberi tanda PERIKSA)', 'data_sql',
  '''SELECT CONCAT("Menimbang, bahwa Pasal 13 Peraturan Pemerintah Nomor 54 Tahun 2007 mengatur syarat calon orang tua angkat antara lain sehat jasmani dan rohani, "
  "berumur paling rendah 30 (tiga puluh) tahun dan paling tinggi 55 (lima puluh lima) tahun, seagama dengan calon anak angkat, berkelakuan baik dan tidak pernah dihukum karena melakukan kejahatan, "
  "mampu secara ekonomi dan sosial, telah mengasuh calon anak angkat paling singkat 6 (enam) bulan sejak izin pengasuhan diberikan, serta memperoleh izin dari instansi sosial; "
  "bahwa dalam perkara ini #7036# ",
  CASE WHEN TRIM("#0099#") REGEXP "^[0-9]+$" THEN
         IF(CAST("#0099#" AS UNSIGNED) BETWEEN 30 AND 55,
            CONCAT("berumur #0099# tahun sehingga memenuhi batas umur, "),
            CONCAT("[PERIKSA: umur #0099# tahun menurut SIPP berada di luar batas umur 30 sampai 55 tahun Pasal 13 PP 54/2007; pertimbangkan dasar pengecualiannya atau ubah amar] "))
       ELSE "" END,
  IF(TRIM("#8622#") NOT IN ("", "...", "-"), "berstatus #8622#, ", ""),
  IF(TRIM("#4912#") NOT IN ("", "...", "-"), "dengan riwayat perkawinan yang #4912#, ", ""),
  IF(TRIM("#0100#") NOT IN ("", "...", "-"), CONCAT("bekerja sebagai #0100#", IF(TRIM("#4914#") NOT IN ("", "...", "-"), " dengan penghasilan #4914#", ""), " sehingga mampu secara ekonomi, "), ""),
  IF(TRIM("#4910#") NOT IN ("", "...", "-"), "telah mengasuh calon anak angkat sejak #4910#, ", ""),
  IF(TRIM("#4913#") NOT IN ("", "...", "-"), "dan telah memperoleh #4913#, ", ""),
  "serta berdasarkan bukti dan keterangan saksi berkelakuan baik dan sehat jasmani rohani, sehingga syarat-syarat tersebut telah terpenuhi;") AS data''')

v(4919, 'PENGANGKATAN ANAK: PERTIMBANGAN AKIBAT HUKUM PENGANGKATAN (OTOMATIS: nasab, wasiat wajibah, wali nikah, pemberitahuan asal-usul; teks tetap, diawali tanda Menimbang)', 'data_sql',
  '''SELECT CONCAT("Menimbang, bahwa oleh karena pengangkatan anak tidak memutuskan hubungan nasab, maka anak angkat tetap bernasab kepada ayah kandungnya, tidak menjadi ahli waris #7036# tetapi dapat diberi wasiat wajibah ",
  "sebagaimana Pasal 209 Kompilasi Hukum Islam, dan apabila anak angkat adalah perempuan maka yang berhak menjadi wali nikahnya kelak adalah wali nasabnya; ",
  "bahwa selain itu #7036# berkewajiban memberitahukan kepada anak angkatnya mengenai asal-usul dan orang tua kandungnya dengan memperhatikan kesiapan anak sebagaimana Pasal 6 ayat (1) dan ayat (2) ",
  "Peraturan Pemerintah Nomor 54 Tahun 2007 serta Pasal 40 Undang-Undang Nomor 35 Tahun 2014 tentang Perubahan atas Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak;") AS data''')

# ---- MAFQUD dan PERMOHONAN UMUM: isian katalog saksi (ditulis agen pembantu) dan variabel blangko ----------------------
for _m in ('variabel_lain_mafqud', 'variabel_lain_umum', 'variabel_lain_blangko'):
    try:
        __import__(_m)
    except ModuleNotFoundError as e:
        if e.name != _m:
            raise
