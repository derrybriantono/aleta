# -*- coding: utf-8 -*-
"""Definisi variabel ABT BARU paket u4-dk-wali-perwalian (jatah nomor 4400-4499).

Setiap entri: no, nama (tanpa kata ALETA), tipe ('data_teks' | 'data_tanggal' | 'data_sql'), sql (untuk data_sql).
Aturan: kueri hanya SELECT, MariaDB 5.5, kolom hasil bernama `data`; penanda #perkara_id# dan #nnnn# diganti ABT sebelum dijalankan.
Teks keluaran memakai ejaan baku; tanpa penanda tanda ALETA.
"""

VAR = []


def v(no, nama, tipe, sql=None):
    VAR.append(dict(no=no, nama=nama, tipe=tipe, sql=sql))


# ---------------------------------------------------------------------------------------------------------------------
# PERWALIAN (4400-4419)
# ---------------------------------------------------------------------------------------------------------------------
v(4400, 'PERWALIAN: HUBUNGAN #0046# DENGAN ANAK - ISIAN (frasa benda, mis. bibi (adik kandung ibu kandung anak), kakak kandung, paman kandung, nenek)', 'data_teks')
v(4401, 'PERWALIAN: NAMA AYAH KANDUNG ANAK YANG TELAH MENINGGAL - ISIAN (nama lengkap bin ..., tanpa kata Almarhum)', 'data_teks')
v(4402, 'PERWALIAN: NAMA IBU KANDUNG ANAK YANG TELAH MENINGGAL - ISIAN (nama lengkap binti ..., tanpa kata Almarhumah)', 'data_teks')
v(4403, 'PERWALIAN: TANGGAL AYAH ANAK MENINGGAL DUNIA', 'data_tanggal')
v(4404, 'PERWALIAN: TANGGAL IBU ANAK MENINGGAL DUNIA', 'data_tanggal')
v(4405, 'PERWALIAN: ORANG TUA ANAK (OTOMATIS dari isian 4401 dan 4402: almarhum ... (ayah kandung) dan almarhumah ... (ibu kandung))', 'data_sql',
  '''SELECT CASE
  WHEN TRIM("#4401#") <> "" AND TRIM("#4402#") <> "" THEN CONCAT("almarhum #4401# (ayah kandung) dan almarhumah #4402# (ibu kandung)")
  WHEN TRIM("#4401#") <> "" THEN CONCAT("almarhum #4401# (ayah kandung)")
  WHEN TRIM("#4402#") <> "" THEN CONCAT("almarhumah #4402# (ibu kandung)")
  ELSE "........" END AS data''')
v(4406, 'PERWALIAN: NAMA ANAK (OTOMATIS: SIPP perkara_anak_pihak; kosong = isian #5110#; belum ada = titik-titik)', 'data_sql',
  '''SELECT IF((SELECT COUNT(*) FROM perkara_anak_pihak WHERE perkara_id = '#perkara_id#' AND TRIM(IFNULL(nama_anak, '')) <> '') > 0,
  (SELECT GROUP_CONCAT(TRIM(nama_anak) ORDER BY anak_ke SEPARATOR ', ') FROM perkara_anak_pihak WHERE perkara_id = '#perkara_id#' AND TRIM(IFNULL(nama_anak, '')) <> ''),
  IF(TRIM("#5110#") <> "", "#5110#", "........")) AS data''')
v(4407, 'PERWALIAN: PENYEBUTAN anak / anak-anak (OTOMATIS: jumlah anak di SIPP; kosong = jumlah nama bin/binti pada isian #5110#)', 'data_sql',
  '''SELECT IF(x.n > 1, 'anak-anak', 'anak') AS data FROM (SELECT IF((SELECT COUNT(*) FROM perkara_anak_pihak WHERE perkara_id = '#perkara_id#' AND TRIM(IFNULL(nama_anak, '')) <> '') > 0,
  (SELECT COUNT(*) FROM perkara_anak_pihak WHERE perkara_id = '#perkara_id#' AND TRIM(IFNULL(nama_anak, '')) <> ''),
  ROUND((LENGTH(LOWER("#5110#")) - LENGTH(REPLACE(LOWER("#5110#"), ' bin ', ''))) / 5 + (LENGTH(LOWER("#5110#")) - LENGTH(REPLACE(LOWER("#5110#"), ' binti ', ''))) / 7)) AS n) x''')
v(4409, 'PERWALIAN: KEMATIAN ORANG TUA ANAK (OTOMATIS dari isian 4401-4404: almarhum ... meninggal dunia pada tanggal ... dan almarhumah ...)', 'data_sql',
  '''SELECT CASE
  WHEN TRIM("#4401#") <> "" AND TRIM("#4402#") <> "" THEN CONCAT("almarhum #4401# (ayah kandung) meninggal dunia", IF(TRIM("#4403#") <> "", " pada tanggal #4403#", ""), " dan almarhumah #4402# (ibu kandung) meninggal dunia", IF(TRIM("#4404#") <> "", " pada tanggal #4404#", ""))
  WHEN TRIM("#4401#") <> "" THEN CONCAT("almarhum #4401# (ayah kandung) meninggal dunia", IF(TRIM("#4403#") <> "", " pada tanggal #4403#", ""))
  WHEN TRIM("#4402#") <> "" THEN CONCAT("almarhumah #4402# (ibu kandung) meninggal dunia", IF(TRIM("#4404#") <> "", " pada tanggal #4404#", ""))
  ELSE "kedua orang tua anak telah meninggal dunia pada tanggal ........" END AS data''')
v(4410, 'PERWALIAN: TINDAKAN HUKUM YANG DIMOHONKAN IZINNYA - ISIAN (mis. pencairan dana BPJS Ketenagakerjaan atas nama almarhum ...; kosongkan bila tidak dimohonkan)', 'data_teks')
v(4411, 'PERWALIAN: PERTIMBANGAN PETITUM TINDAKAN HUKUM (OTOMATIS: muncul hanya bila isian 4410 terisi)', 'data_sql',
  '''SELECT IF(TRIM("#4410#") <> "", CONCAT("<br>Menimbang, bahwa selanjutnya terhadap permohonan agar #0046# berwenang bertindak mewakili #4407# tersebut untuk #4410#, oleh karena perwalian meliputi diri dan harta kekayaan anak (Pasal 50 ayat (2) Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 107 ayat (1) Kompilasi Hukum Islam) dan tindakan tersebut diperlukan untuk kepentingan #4407# tersebut, maka #8554# berpendapat bahwa permohonan tersebut patut dikabulkan dengan ketentuan bahwa hasil tindakan hukum tersebut wajib digunakan sebesar-besarnya untuk kepentingan #4407# yang berada di bawah perwalian dan wali bertanggung jawab atas pengelolaannya (Pasal 110 Kompilasi Hukum Islam);"), "") AS data''')
v(4412, 'PERWALIAN: TAMBAHAN AMAR - WEWENANG MEWAKILI ANAK (OTOMATIS: muncul hanya bila isian 4410 terisi)', 'data_sql',
  '''SELECT IF(TRIM("#4410#") <> "", " dan berwenang mewakili #4407# tersebut untuk #4410#", "") AS data''')

from variabel_dk import *  # noqa: E402,F401

from variabel_wa import *  # noqa: E402,F401
