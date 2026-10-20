# -*- coding: utf-8 -*-
"""Variabel ABT baru keluarga ANAK (hak asuh / hadhanah, penguasaan anak, nafkah anak): nomor 4880-4909.
Aturan: kueri hanya SELECT, MariaDB 5.5, kolom hasil `data`; teks dalam kueri ASCII murni (tanpa tanda kutip lengkung, garis miring terbalik);
kutip ganda di isian petugas diganti entitas; keputusan hakim = pilihan pada isian data_teks (mesin hanya menyusun kalimat dari pilihan itu);
tuntutan yang terbaca tetapi belum diputus = kalimat [PERIKSA: ...] (pola paket u2). Tanpa kata aplikasi ini.

Pembagian:
  4880-4883  umur anak otomatis (SIPP perkara_anak_pihak) dan peringatan kesesuaian mumayyiz / dewasa
  4884-4889  kelayakan pemegang hadhanah, pendapat ahli, akses bertemu rinci
  4890-4895  penyerahan anak (hak asuh), nomor amar biaya
  4896-4898  kabul sebagian hak asuh, kewenangan relatif tempat tinggal anak
  4899-4900  nafkah anak: jumlah yang dimohon dan perbandingannya
  4901-4903  nafkah anak: ayah hanya mampu sebagian, ibu ikut memikul sisanya (pertimbangan Kabul Sebagian); 4904 cadangan
  4905-4907  hak asuh anak-anak dengan status mumayyiz berbeda
  4908       amar penyerahan anak pada putusan verstek (butir 4)
  4909       umur anak untuk nafkah (batas dewasa 21 tahun)
"""
import re

from variabel_def import v

DB = 'aps_badilag'


def lit(s):
    assert '"' not in s and '\\' not in s, s
    assert all(ord(ch) < 128 for ch in s), [ch for ch in s if ord(ch) >= 128]
    s = re.sub(r';[ ]+(?=[A-Za-z0-9])', ';', s)  # ABT menambah satu spasi sesudah tiap titik koma
    return '"' + s + '"'


def T(n):
    """Isian data_teks bersih: garis miring terbalik -> /, kutip ganda -> entitas, kutip tunggal -> entitas, pangkas titik koma ujung."""
    return ("TRIM(TRAILING ';' FROM TRIM(REPLACE(IFNULL(REPLACE(REPLACE(REPLACE(CONVERT((SELECT data FROM %s.abt_data_teks WHERE no_var = %d AND perkara_id = '#perkara_id#' LIMIT 1) "
            "USING utf8), '\\\\', '/'), '\"', '&quot;'), '''', '&#39;'), ''), '; ', ';')))") % (DB, n)


def SK(n):
    """Saklar/pilihan pendek (tanpa pengaman karakter)."""
    return "IFNULL((SELECT TRIM(CONVERT(t.data USING utf8)) FROM %s.abt_data_teks t WHERE t.no_var = %d AND t.perkara_id = '#perkara_id#' LIMIT 1), '')" % (DB, n)


def JIKA(c, a, b='""'):
    return 'IF(%s, %s, %s)' % (c, a, b)


def G(*xs):
    return 'CONCAT(' + ', '.join(xs) + ')'


# Tanggal acuan umur: tanggal putusan bila sudah ada, selain itu hari ini
REF = "IF(IFNULL(pp.tanggal_putusan, '0000-00-00') > '1000-01-01', pp.tanggal_putusan, CURDATE())"
# Anak bernama dengan tanggal lahir sah
ANAK = ("perkara_anak_pihak a WHERE a.perkara_id = '#perkara_id#' AND TRIM(IFNULL(a.nama_anak, '')) <> '' AND IFNULL(a.tanggal_lahir, '0000-00-00') > '1000-01-01'")
TGL_REF = "(SELECT %s FROM (SELECT 1) z LEFT JOIN perkara_putusan pp ON pp.perkara_id = '#perkara_id#' LIMIT 1)" % REF


def _min_maks_umur(kolom_ref=TGL_REF):
    return ("(SELECT COUNT(*) FROM %s) AS n, (SELECT MIN(TIMESTAMPDIFF(MONTH, a.tanggal_lahir, %s)) FROM %s) AS bln_min, "
            "(SELECT MAX(TIMESTAMPDIFF(MONTH, a.tanggal_lahir, %s)) FROM %s) AS bln_maks") % (ANAK, kolom_ref, ANAK, kolom_ref, ANAK)


BULAN = "ELT(MONTH(a.tanggal_lahir), 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember')"
UMUR_ANAK = ("CONCAT(TRIM(CONVERT(a.nama_anak USING utf8)), ' (lahir tanggal ', DAY(a.tanggal_lahir), ' ', " + BULAN + ", ' ', YEAR(a.tanggal_lahir), ', berumur ', "
             "TIMESTAMPDIFF(YEAR, a.tanggal_lahir, " + TGL_REF + "), ' tahun ', MOD(TIMESTAMPDIFF(MONTH, a.tanggal_lahir, " + TGL_REF + "), 12), ' bulan, ', "
             "IF(TIMESTAMPDIFF(YEAR, a.tanggal_lahir, " + TGL_REF + ") < 12, 'belum mencapai 12 (dua belas) tahun', 'telah mencapai 12 (dua belas) tahun'), ')')")

UMUR_ANAK_NAFKAH = ("CONCAT(TRIM(CONVERT(a.nama_anak USING utf8)), ' (lahir tanggal ', DAY(a.tanggal_lahir), ' ', " + BULAN + ", ' ', YEAR(a.tanggal_lahir), ', berumur ', "
                    "TIMESTAMPDIFF(YEAR, a.tanggal_lahir, " + TGL_REF + "), ' tahun ', MOD(TIMESTAMPDIFF(MONTH, a.tanggal_lahir, " + TGL_REF + "), 12), ' bulan, ', "
                    "IF(TIMESTAMPDIFF(YEAR, a.tanggal_lahir, " + TGL_REF + ") < 21, 'belum mencapai 21 (dua puluh satu) tahun', 'telah mencapai 21 (dua puluh satu) tahun'), ')')")

v(4880, 'ANAK: UMUR ANAK PADA SAAT PUTUSAN (OTOMATIS: tanggal lahir anak di SIPP; tiap anak ditulis umurnya dan belum atau telah 12 tahun; kosong bila tanggal lahir belum ada; diawali satu baris baru)', 'data_sql',
  "SELECT IF(s.n = 0, '', CONCAT('<br>Menimbang, bahwa berdasarkan data kelahiran yang tercatat dalam perkara ini, ', s.daftar, '; umur tersebut dihitung sampai dengan tanggal putusan ini dijatuhkan dan menjadi bahan #8554# menilai keadaan mumayyiz atau belum mumayyiz anak tersebut sesuai Pasal 105 Kompilasi Hukum Islam;')) AS data "
  "FROM (SELECT COUNT(*) AS n, GROUP_CONCAT(" + UMUR_ANAK + " ORDER BY a.anak_ke, a.id SEPARATOR ';') AS daftar FROM " + ANAK + ") s")

PERIKSA_12 = ('<br>[PERIKSA: data kelahiran di SIPP menunjukkan ada anak yang telah berumur 12 tahun atau lebih (mumayyiz), padahal blangko ini menyatakan anak belum mumayyiz; '
              'periksa tanggal lahir anak atau pilih blangko hak asuh untuk anak mumayyiz atau campuran]')
PERIKSA_KURANG_12 = ('<br>[PERIKSA: data kelahiran di SIPP menunjukkan ada anak yang belum berumur 12 tahun, padahal blangko ini menyatakan anak sudah mumayyiz memilih; '
                     'periksa tanggal lahir anak atau pilih blangko hak asuh untuk anak belum mumayyiz atau campuran]')
PERIKSA_21 = ('<br>[PERIKSA: data kelahiran di SIPP menunjukkan ada anak yang telah berumur 21 tahun atau lebih sehingga sudah dewasa; '
              'periksa tanggal lahir anak dan apakah tuntutan masih dapat dikabulkan]')


def _flag(kondisi, teks):
    return ("SELECT IF(s.n > 0 AND (%s), %s, '') AS data FROM (SELECT %s) s") % (kondisi, lit(teks), _min_maks_umur())


v(4881, 'ANAK: PERINGATAN BLANGKO ANAK BELUM MUMAYYIZ (OTOMATIS: kalimat [PERIKSA] hanya bila tanggal lahir anak di SIPP menunjukkan ada anak berumur 12 tahun atau lebih; selain itu kosong)', 'data_sql',
  _flag('s.bln_maks >= 144', PERIKSA_12))
v(4882, 'ANAK: PERINGATAN BLANGKO ANAK MUMAYYIZ MEMILIH (OTOMATIS: kalimat [PERIKSA] hanya bila tanggal lahir anak di SIPP menunjukkan ada anak berumur kurang dari 12 tahun; selain itu kosong)', 'data_sql',
  _flag('s.bln_min < 144', PERIKSA_KURANG_12))
v(4883, 'ANAK: PERINGATAN ANAK SUDAH DEWASA (OTOMATIS: kalimat [PERIKSA] hanya bila tanggal lahir anak di SIPP menunjukkan ada anak berumur 21 tahun atau lebih; selain itu kosong)', 'data_sql',
  _flag('s.bln_maks >= 252', PERIKSA_21))

# ---------------------------------------------------------------------------------------------------------------------
# Kelayakan pemegang hadhanah, pendapat ahli, akses bertemu
# ---------------------------------------------------------------------------------------------------------------------
v(4884, 'HAK ASUH: KELAYAKAN CALON PEMEGANG HADHANAH - ISIAN fakta jasmani, rohani, waktu, tempat tinggal, ekonomi, akhlak, agama; sesudah kata "fakta bahwa", tanpa titik akhir; kosong = tidak tercetak', 'data_teks')
v(4885, 'HAK ASUH: PERTIMBANGAN KELAYAKAN PEMEGANG HADHANAH (OTOMATIS: isian 4884; kosong = tidak tercetak; diawali satu baris baru)', 'data_sql',
  "SELECT IF(" + T(4884) + " = '', '', CONCAT('<br>Menimbang, bahwa untuk menilai kemampuan dan kelayakan pihak yang dimohonkan sebagai pemegang hak hadhanah, #8554# menilai keadaan jasmani, rohani, waktu mengasuh, tempat tinggal, kemampuan ekonomi, akhlak dan agama, dan dari alat-alat bukti yang diajukan diperoleh fakta bahwa ', "
  + T(4884) + ", ';')) AS data")

v(4886, 'ANAK: PENDAPAT AHLI ATAU LAPORAN LEMBAGA (psikolog, pekerja sosial, KPAD, P2TP2A) - ISIAN nama dan kesimpulan singkat, tanpa titik akhir; kosong = tidak tercetak', 'data_teks')
v(4887, 'ANAK: PERTIMBANGAN PENDAPAT AHLI ATAU LAPORAN LEMBAGA (OTOMATIS: isian 4886; kosong = tidak tercetak; diawali satu baris baru)', 'data_sql',
  "SELECT IF(" + T(4886) + " = '', '', CONCAT('<br>Menimbang, bahwa dalam pemeriksaan perkara ini #8554# juga memperoleh masukan dari ', " + T(4886)
  + ", ', yang dijadikan bahan pertimbangan bersama-sama dengan keterangan para pihak dan saksi demi kepentingan terbaik bagi anak, tanpa mengikat #8554# dalam menentukan pemegang hak hadhanah;')) AS data")

v(4888, 'ANAK: AKSES BERTEMU - RINCIAN WAKTU DAN CARA bagi orang tua yang tidak memegang hak asuh - ISIAN, mis. setiap akhir pekan di rumah pemegang hak asuh; kosong = tanpa rincian', 'data_teks')
v(4889, 'ANAK: KALIMAT RINCIAN AKSES BERTEMU DI AMAR DAN PERTIMBANGAN (OTOMATIS: isian 4888; kosong = tidak tercetak)', 'data_sql',
  "SELECT IF(" + T(4888) + " = '', '', CONCAT(', dengan ketentuan ', " + T(4888) + ")) AS data")

# ---------------------------------------------------------------------------------------------------------------------
# Penyerahan anak pada putusan hak asuh
# ---------------------------------------------------------------------------------------------------------------------
v(4890, 'HAK ASUH: SAKLAR PENYERAHAN ANAK - ISIAN 1 = dimohonkan dalam petitum, 2 = ditetapkan hakim meskipun tidak dimohonkan, kosong = tidak ada penyerahan (anak sudah bersama pemegang hak asuh)', 'data_teks')
v(4891, 'HAK ASUH: AMAR MENGHUKUM MENYERAHKAN ANAK (OTOMATIS: hanya bila saklar 4890 = 1 atau 2; kosong = tidak tercetak; menjadi butir 3)', 'data_sql',
  "SELECT IF(" + SK(4890) + " IN ('1', '2'), " + lit('<br>3.   Menghukum #0047# (<strong>#0102#</strong>) untuk menyerahkan #9302# tersebut yang bernama <strong>#9304#</strong> kepada #0046# (<strong>#0098#</strong>) selaku #9300#nya;') + ", '') AS data")
v(4892, 'HAK ASUH: PERTIMBANGAN PENYERAHAN ANAK (OTOMATIS: saklar 4890 = 1 sesuai petitum, = 2 ditetapkan hakim; kosong = tidak tercetak)', 'data_sql',
  "SELECT IF(" + SK(4890) + " = '2', " + lit('<br>Menimbang, bahwa meskipun petitum #0053# #0046# tidak memuat permintaan agar #0047# dihukum menyerahkan #9302# tersebut, hakim dapat menetapkan hadhanah walaupun tidak diajukan tuntutan khusus mengenai hadhanah, berdasarkan kepentingan terbaik anak dan disertai penyerahan anak serta akses bagi orang tua lainnya, sebagaimana Buku II Peradilan Agama Tahun 2026; oleh karena #9302# tersebut saat ini berada dalam penguasaan #0047#, sedangkan hak asuh (hadhanah) atas #9302# tersebut ditetapkan kepada #0046# selaku #9300#nya, maka agar penetapan tersebut dapat dilaksanakan #0047# harus dihukum untuk menyerahkan #9302# tersebut kepada #0046#;')
  + ", IF(" + SK(4890) + " = '1', " + lit('<br>Menimbang, bahwa oleh karena #9302# tersebut saat ini berada dalam penguasaan #0047#, sedangkan hak asuh (hadhanah) atas #9302# tersebut ditetapkan kepada #0046# selaku #9300#nya, maka agar penetapan tersebut dapat dilaksanakan #0047# harus dihukum untuk menyerahkan #9302# tersebut kepada #0046#, sebagaimana dimohonkan dalam petitum #0053# #0046# dan sejalan dengan Rumusan Hukum Kamar Agama dalam Surat Edaran Mahkamah Agung Nomor 1 Tahun 2025 angka 1 (Hukum Perkawinan Terkait Hadanah) yang memuat penghukuman pihak yang menguasai anak untuk menyerahkannya kepada orang tua yang ditetapkan sebagai pemegang hadanah;')
  + ", '')) AS data")
v(4893, 'HAK ASUH: KALIMAT PENYERAHAN DI PERTIMBANGAN AKHIR (OTOMATIS: hanya bila saklar 4890 = 1 atau 2; kosong = tidak tercetak)', 'data_sql',
  "SELECT IF(" + SK(4890) + " IN ('1', '2'), " + lit(', serta menghukum #0047# untuk menyerahkan #9302# tersebut kepada #0046#') + ", '') AS data")
v(4894, 'HAK ASUH: NOMOR AMAR BIAYA PERKARA BILA PENYERAHAN ADALAH BUTIR 3 (OTOMATIS: saklar 4890 = 1 atau 2 maka 4, selain itu 3)', 'data_sql',
  "SELECT IF(" + SK(4890) + " IN ('1', '2'), '4', '3') AS data")
v(4895, 'HAK ASUH: NOMOR AMAR BIAYA PERKARA PUTUSAN VERSTEK BILA PENYERAHAN ADALAH BUTIR 4 (OTOMATIS: saklar 4890 = 1 atau 2 maka 5, selain itu 4)', 'data_sql',
  "SELECT IF(" + SK(4890) + " IN ('1', '2'), '5', '4') AS data")

# ---------------------------------------------------------------------------------------------------------------------
# Kabul sebagian hak asuh dan kewenangan relatif
# ---------------------------------------------------------------------------------------------------------------------
v(4896, 'HAK ASUH (KABUL SEBAGIAN): ALASAN PETITUM SELEBIHNYA DITOLAK - ISIAN kalimat sesudah kata "selebihnya," tanpa titik akhir; kosong = kalimat bawaan', 'data_teks')
v(4897, 'HAK ASUH (KABUL SEBAGIAN): ALASAN PETITUM SELEBIHNYA DITOLAK (OTOMATIS: isian 4896; kosong = kalimat bawaan)', 'data_sql',
  "SELECT IF(" + T(4896) + " <> '', " + T(4896) + ", " + lit('tidak didukung alat bukti yang cukup dan tidak diperlukan demi kepentingan terbaik bagi #9302# tersebut') + ") AS data")
v(4898, 'HAK ASUH: PERTIMBANGAN KEWENANGAN RELATIF TEMPAT TINGGAL ANAK SENYATANYA (OTOMATIS: isian 9592; kosong = bertempat tinggal di wilayah hukum Pengadilan ini; diawali satu baris baru)', 'data_sql',
  "SELECT CONCAT('<br>Menimbang, bahwa berdasarkan Rumusan Hukum Kamar Agama dalam Surat Edaran Mahkamah Agung Nomor 2 Tahun 2024 (Hukum Formil angka 4), demi kepentingan terbaik bagi anak (the best interest of the child), perkara hadanah dapat diajukan ke pengadilan agama yang wilayah hukumnya meliputi tempat tinggal anak senyatanya; oleh karena berdasarkan surat #0053# dan keterangan para pihak #9302# tersebut ', "
  "IF(" + SK(9592) + " NOT IN ('', '...', '-'), " + SK(9592) + ", " + lit('bertempat tinggal di wilayah hukum #8008#') + "), ', maka perkara a quo juga termasuk kewenangan relatif #8008#;') AS data")

# ---------------------------------------------------------------------------------------------------------------------
# Nafkah anak
# ---------------------------------------------------------------------------------------------------------------------
v(4899, 'NAFKAH ANAK: JUMLAH YANG DIMOHON DALAM PETITUM - ISIAN, mis. Rp1.500.000,00 (satu juta lima ratus ribu rupiah); dibandingkan dengan isian 9740; kosong = tidak dibandingkan', 'data_teks')


def _angka(n):
    """Angka rupiah pertama pada isian n: buang 'Rp', titik ribuan, spasi; ambil sebelum koma desimal; 0 bila tidak terbaca."""
    return "CAST(SUBSTRING_INDEX(REPLACE(REPLACE(REPLACE(LOWER(" + SK(n) + "), 'rp', ''), '.', ''), ' ', ''), ',', 1) AS UNSIGNED)"


v(4900, 'NAFKAH ANAK: PERTIMBANGAN JUMLAH DIMOHON DAN DITETAPKAN (OTOMATIS: isian 4899 dan 9740; sama = sesuai; rendah = selebihnya ditolak; tinggi = [PERIKSA]; kosong = tidak tercetak)', 'data_sql',
  "SELECT CASE WHEN " + T(4899) + " = '' OR " + T(9740) + " = '' THEN '' "
  "WHEN " + _angka(4899) + " > 0 AND " + _angka(9740) + " > " + _angka(4899) + " THEN " + lit('<br>[PERIKSA: jumlah nafkah anak yang ditetapkan pada isian 9740 lebih besar dari jumlah yang dimohon pada isian 4899; periksa kedua isian karena putusan tidak boleh melebihi tuntutan kecuali ada dasar hukumnya]') + " "
  "WHEN LOWER(" + T(4899) + ") = LOWER(" + T(9740) + ") OR (" + _angka(4899) + " > 0 AND " + _angka(9740) + " = " + _angka(4899) + ") THEN CONCAT(" + lit('<br>Menimbang, bahwa jumlah nafkah #9302# tersebut yang dimohon #0046# adalah ') + ", " + T(4899)
  + ", " + lit(' setiap bulan, dan setelah #8554# mempertimbangkan kebutuhan dasar hidup #9302# tersebut serta kemampuan #0047# sebagaimana fakta hukum di atas, jumlah tersebut patut dan layak sehingga ditetapkan sesuai permohonan;') + ") "
  "ELSE CONCAT(" + lit('<br>Menimbang, bahwa jumlah nafkah #9302# tersebut yang dimohon #0046# adalah ') + ", " + T(4899)
  + ", " + lit(', sedangkan setelah #8554# mempertimbangkan kebutuhan dasar hidup #9302# tersebut serta kemampuan #0047# sebagaimana fakta hukum di atas, jumlah yang patut dan layak ditetapkan adalah ') + ", " + T(9740)
  + ", " + lit(' setiap bulan, sehingga permohonan mengenai jumlah selebihnya patut ditolak;') + ") END AS data")

# Nafkah anak: ayah hanya mampu sebagian, ibu ikut memikul sisanya (Pasal 41 huruf b UU 1/1974) - dipakai di pertimbangan Kabul Sebagian
v(4901, 'NAFKAH ANAK (KABUL SEBAGIAN): FAKTA AYAH HANYA MAMPU SEBAGIAN - ISIAN sesudah "fakta bahwa" (mis. ayah tidak berpenghasilan tetap atau sakit), tanpa titik akhir; kosong = tidak tercetak', 'data_teks')
v(4902, 'NAFKAH ANAK (KABUL SEBAGIAN): BAGIAN BIAYA YANG DIPIKUL IBU - ISIAN, mis. Rp1.000.000,00 (satu juta rupiah) setiap bulan; kosong = belum ditetapkan', 'data_teks')
v(4903, 'NAFKAH ANAK (KABUL SEBAGIAN): PERTIMBANGAN IBU IKUT MEMIKUL BIAYA (OTOMATIS: isian 4901 dan 4902; kosong = tidak tercetak; diawali satu baris baru)', 'data_sql',
  "SELECT IF(" + T(4902) + " = '', '', CONCAT(" + lit('<br>Menimbang, bahwa Pasal 41 huruf b Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa bapak yang bertanggung jawab atas semua biaya pemeliharaan dan pendidikan yang diperlukan anak itu, dan bilamana bapak dalam kenyataan tidak dapat memenuhi kewajiban tersebut, Pengadilan dapat menentukan bahwa ibu ikut memikul biaya tersebut;')
  + ", IF(" + T(4901) + " = '', '', CONCAT(" + lit('<br>Menimbang, bahwa berdasarkan alat-alat bukti yang diajukan, diperoleh fakta bahwa ') + ", " + T(4901) + ", " + lit(', sehingga #0047# dalam kenyataan tidak dapat memenuhi seluruh kewajibannya memberi nafkah #9302# tersebut;') + ")), "
  + lit('<br>Menimbang, bahwa oleh karena itu dan demi kepentingan terbaik bagi #9302# tersebut, #8554# berpendapat patut dan layak ibu ikut memikul biaya pemeliharaan dan pendidikan #9302# tersebut sebesar atau berupa ') + ", " + T(4902)
  + ", " + lit(', sampai #9302# tersebut dewasa atau mampu berdiri sendiri (berumur 21 (dua puluh satu) tahun) sebagaimana Pasal 156 huruf d Kompilasi Hukum Islam;') + ")) AS data")

# ---------------------------------------------------------------------------------------------------------------------
# Hak asuh anak-anak dengan status mumayyiz berbeda
# ---------------------------------------------------------------------------------------------------------------------
v(4905, 'HAK ASUH ANAK DENGAN STATUS MUMAYYIZ BERBEDA: PENETAPAN PER ANAK - ISIAN satu anak per baris: nama - belum mumayyiz atau mumayyiz memilih - pemegang hadhanah (ibu atau ayah kandung)', 'data_teks')
v(4906, 'HAK ASUH ANAK-ANAK DENGAN STATUS MUMAYYIZ BERBEDA: AMAR PER ANAK (OTOMATIS: isian 4905, satu butir per anak; kosong = kalimat [PERIKSA])', 'data_sql',
  "SELECT IF(" + SK(4905) + " = '', " + lit('[PERIKSA: isi penetapan per anak pada isian 4905, satu anak per baris]') + ", CONCAT('<br>    - ', REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(CONVERT(" + SK(4905) + " USING utf8), CHAR(13), ''), '\\\\', '/'), '\"', '&quot;'), '''', '&#39;'), CHAR(10), CONCAT(';<br>    - ')), ';')) AS data")
v(4907, 'HAK ASUH ANAK-ANAK DENGAN STATUS MUMAYYIZ BERBEDA: PERTIMBANGAN PER ANAK (OTOMATIS: isian 4905, satu baris per anak; kosong = kalimat [PERIKSA])', 'data_sql',
  "SELECT IF(" + SK(4905) + " = '', " + lit('<br>[PERIKSA: isi penetapan per anak pada isian 4905, satu anak per baris]') + ", CONCAT('<br>Menimbang, bahwa oleh karena anak-anak tersebut berada dalam keadaan yang berbeda, ada yang belum mumayyiz dan ada yang telah mumayyiz, maka #8554# menilai kepentingan terbaik bagi masing-masing anak secara tersendiri dengan hasil sebagai berikut:', "
  "'<br>    - ', REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(CONVERT(" + SK(4905) + " USING utf8), CHAR(13), ''), '\\\\', '/'), '\"', '&quot;'), '''', '&#39;'), CHAR(10), CONCAT(';<br>    - ')), ';')) AS data")

# ---------------------------------------------------------------------------------------------------------------------
# Tambahan: penyerahan anak pada putusan verstek dan umur anak untuk nafkah
# ---------------------------------------------------------------------------------------------------------------------
v(4908, 'HAK ASUH: AMAR MENGHUKUM MENYERAHKAN ANAK, PUTUSAN VERSTEK (OTOMATIS: hanya bila saklar 4890 = 1 atau 2; kosong = tidak tercetak; menjadi butir 4)', 'data_sql',
  "SELECT IF(" + SK(4890) + " IN ('1', '2'), " + lit('<br>4.   Menghukum #0047# (<strong>#0102#</strong>) untuk menyerahkan #9302# tersebut yang bernama <strong>#9304#</strong> kepada #0046# (<strong>#0098#</strong>) selaku #9300#nya;') + ", '') AS data")
v(4909, 'ANAK: UMUR ANAK UNTUK NAFKAH (OTOMATIS: tanggal lahir anak di SIPP; tiap anak ditulis umurnya terhadap batas dewasa 21 tahun; kosong bila tanggal lahir belum ada; diawali satu baris baru)', 'data_sql',
  "SELECT IF(s.n = 0, '', CONCAT('<br>Menimbang, bahwa berdasarkan data kelahiran yang tercatat dalam perkara ini, ', s.daftar, '; umur tersebut dihitung sampai dengan tanggal putusan ini dijatuhkan dan menjadi bahan #8554# menilai lamanya nafkah dapat dibebankan, yaitu sampai anak tersebut dewasa atau mampu berdiri sendiri (berumur 21 (dua puluh satu) tahun) sebagaimana Pasal 156 huruf d Kompilasi Hukum Islam;')) AS data "
  "FROM (SELECT COUNT(*) AS n, GROUP_CONCAT(" + UMUR_ANAK_NAFKAH + " ORDER BY a.anak_ke, a.id SEPARATOR ';') AS daftar FROM " + ANAK + ") s")

for _x in __import__('variabel_def').VAR:
    if _x['no'] >= 4880 and _x['no'] <= 4909:
        if _x['sql']:  # ABT menambah satu spasi sesudah tiap titik koma: buang spasi yang kita tulis sendiri
            _x['sql'] = re.sub(r';[ ]+(?=[A-Za-z0-9<#(])', ';', _x['sql'])
        assert len(_x['nama']) <= 195, (_x['no'], len(_x['nama']))
