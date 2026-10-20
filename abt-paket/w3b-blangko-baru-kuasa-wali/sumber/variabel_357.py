# -*- coding: utf-8 -*-
"""Variabel ABT baru - GANTI RUGI TERHADAP WALI (jenis SIPP 357), jatah 3890-3919.

Dasar hukum yang dicetak (semua terverifikasi dengan naskah di D:/aleta-dev/kerja/referensi/_unduhan; lihat spek/PASAL-357.md):
  Pasal 48, 50, 51, 52, 54 UU 1/1974 (naskah BPK); Pasal 107, 110, 111, 112 KHI (khi-pasalid.json); Pasal 33 ayat (4) UU 23/2002 sebagaimana diubah UU 35/2014;
  Pasal 14 ayat (1) huruf d PP 29/2019; Pasal 49 huruf a dan penjelasan angka 18 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009; Pasal 283 RBg.

Pola angka rupiah meniru variabel 9341-9344 di server: isian (3898) -> angka murni (3899) -> terbilang (3900) -> bertitik (3901).
Variabel lama yang dipakai: #4406# #4407# (nama anak / sebutan anak), #0046# #0047# #8554# #0053#.
"""
from variabel_def import v, isi

P = 'GANTI RUGI WALI: '


def bersih(n):
    """Ungkapan SQL: isian n tanpa Rp, titik, spasi, ',00', koma dan tanda hubung (pola variabel 9342)."""
    return ("REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(%s), 'RP', ''), '.', ''), ' ', ''), ',00', ''), ',', ''), '-', '')" % isi(n))


def angka(n):
    """Ungkapan SQL boolean: isian n berupa angka rupiah sah."""
    return "%s REGEXP '^[0-9]+$'" % bersih(n)


def titik(n):
    """Ungkapan SQL: isian n sebagai rupiah bertitik (61.241.800), '........' bila bukan angka."""
    return "IF(%s, REPLACE(FORMAT(%s, 0), ',', '.'), '........')" % (angka(n), bersih(n))


def ada_huruf(n, huruf):
    return "LOCATE('%s', UPPER(%s)) > 0" % (huruf, isi(n))


def tanpa_huruf(n, huruf_a, huruf_b):
    return "(%s) = 0 AND (%s) = 0" % ("LOCATE('%s', UPPER(%s))" % (huruf_a, isi(n)), "LOCATE('%s', UPPER(%s))" % (huruf_b, isi(n)))


# ---------------- kedudukan para pihak, anak, dasar perwalian ----------------
v(3890, P + 'KEDUDUKAN #0046# - ISIAN uraian lengkap (mis. anak yang bersangkutan yang kini telah dewasa; paman kandung dari anak tersebut; nenek anak tersebut; kakak kandung yang telah dewasa)',
  'data_teks')
v(3891, P + 'KEDUDUKAN #0046# (OTOMATIS: isian 3890; kosong = titik-titik)', 'data_sql',
  "SELECT IF(%s <> '', %s, '........') AS data" % (isi(3890), isi(3890)))
v(3892, P + 'NAMA ANAK PEMILIK HARTA - ISIAN OPSIONAL (nama lengkap bin/binti ...; kosong = nama anak dari data SIPP perkara_anak_pihak, variabel 4406)', 'data_teks')
v(3893, P + 'NAMA ANAK PEMILIK HARTA (OTOMATIS: isian 3892; kosong = #4406#)', 'data_sql',
  "SELECT IF(%s <> '', %s, '#4406#') AS data" % (isi(3892), isi(3892)))
v(3894, P + 'DASAR PERWALIAN #0047# - ISIAN (mis. penetapan Pengadilan Agama nomor ... tanggal ...; wasiat orang tua; wali yang menjalankan perwalian secara nyata)', 'data_teks')

# ---------------- harta, perbuatan wali, waktu ----------------
v(3895, P + 'HARTA BENDA ANAK YANG MENGALAMI KERUGIAN - ISIAN uraian objek (jenis, letak/nomor sertifikat, ukuran atau jumlah; mis. sebidang tanah SHM Nomor ... luas ... m2)', 'data_teks')
v(3896, P + 'PERBUATAN #0047# YANG SALAH ATAU LALAI - ISIAN frasa kerja (mis. menjual tanah tersebut tanpa izin dan tanpa untuk kepentingan anak; memakai hasil panen untuk keperluan pribadi)', 'data_teks')
v(3897, P + 'WAKTU PERBUATAN #0047# - ISIAN (tanggal, bulan, tahun atau rentang waktu; mis. pada sekitar bulan Maret 2024; sejak tahun 2020 sampai 2023)', 'data_teks')

# ---------------- jumlah kerugian yang ditetapkan: angka, terbilang, bertitik (pola 9341-9344) ----------------
v(3898, P + 'JUMLAH KERUGIAN YANG DITETAPKAN HAKIM - ISIAN (rupiah, angka saja; mis. 150000000 atau 150.000.000; kosong bila bentuk ganti rugi hanya pengembalian harta)', 'data_teks')
v(3899, P + 'JUMLAH KERUGIAN ANGKA MURNI (OTOMATIS dari isian 3898, tanpa titik; dasar terbilang 3900)', 'data_sql',
  "SELECT IF(%s, %s, '') AS data" % (angka(3898), bersih(3898)))
v(3900, P + 'TERBILANG JUMLAH KERUGIAN (#3899#)', 'terbilang', referensi=3899)
v(3901, P + 'JUMLAH KERUGIAN BERTITIK (OTOMATIS dari 3899, mis. 150.000.000; kosong = titik-titik)', 'data_sql',
  "SELECT IF(\"#3899#\" REGEXP '^[0-9]+$', REPLACE(FORMAT(\"#3899#\", 0), ',', '.'), '........') AS data")

# ---------------- bentuk ganti rugi, penerima, pertimbangan dan amar ----------------
v(3902, P + 'BENTUK GANTI RUGI - PILIH HURUF: A uang, B pengembalian harta atau barang (boleh keduanya: A, B); kosong = ikut isian: ada jumlah 3898 = uang, ada isian 3903 = pengembalian', 'data_teks')
v(3903, P + 'HARTA ATAU BARANG YANG HARUS DIKEMBALIKAN - ISIAN uraian (bila bentuk ganti rugi memuat pengembalian; mis. sebidang tanah SHM Nomor ... atau uang hasil penjualan)', 'data_teks')

# kondisi bentuk (dipakai 3904 dan 3906): u = uang, b = pengembalian harta
_U = "(%s OR ((%s) AND \"#3899#\" REGEXP '^[0-9]+$'))" % (ada_huruf(3902, 'A'), tanpa_huruf(3902, 'A', 'B'))
_B = "(%s OR ((%s) AND %s <> ''))" % (ada_huruf(3902, 'B'), tanpa_huruf(3902, 'A', 'B'), isi(3903))

v(3904, P + 'PERTIMBANGAN BESARAN KERUGIAN DAN BENTUK GANTI RUGI (OTOMATIS: isian 3898, 3902, 3903, 3912, 3915; diawali satu baris baru)', 'data_sql',
  "SELECT CONCAT('<br>', CASE WHEN c.u = 0 AND c.b = 0 THEN 'Menimbang, bahwa mengenai besarnya kerugian dan bentuk penggantiannya, #8554# berpendapat ........;' "
  "ELSE CONCAT_WS('<br>', "
  "IF(c.u = 1, CONCAT('Menimbang, bahwa mengenai besarnya kerugian, ', IF(c.dt <> '', CONCAT('#0046# menuntut ganti rugi sebesar Rp', c.dtt, ',00; '), ''), "
  "'berdasarkan ', IF(c.pn <> '', c.pn, '........'), ', #8554# menilai bahwa kerugian nyata yang diderita harta benda #4407# tersebut akibat perbuatan #0047# adalah sebesar Rp', \"#3901#\", ',00 (', \"#3900#\", ' rupiah), sehingga patut dan layak #0047# diwajibkan membayar ganti rugi sebesar jumlah tersebut;'), NULL), "
  "IF(c.b = 1, CONCAT('Menimbang, bahwa ', IF(c.u = 1, 'selain penggantian dalam bentuk uang, ', ''), '#8554# berpendapat bahwa penggantian kerugian yang sesuai dengan kepentingan terbaik #4407# tersebut juga dilakukan dengan menyerahkan kembali ', c.br, "
  "', sejalan dengan kewajiban wali mengelola harta milik anak untuk kepentingan terbaik bagi anak sebagaimana Pasal 33 ayat (4) Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak sebagaimana telah diubah dengan Undang-Undang Nomor 35 Tahun 2014 dan kewajiban wali bertanggung jawab atas harta orang yang berada di bawah perwaliannya sebagaimana Pasal 110 ayat (3) Kompilasi Hukum Islam, sehingga patut #0047# diwajibkan menyerahkan kembali harta tersebut;'), NULL)) END) AS data "
  "FROM (SELECT %s AS u, %s AS b, %s AS dt, %s AS dtt, %s AS pn, IF(%s <> '', %s, '........') AS br) c" % (
      _U, _B, bersih(3915), titik(3915), isi(3912), isi(3903), isi(3903)))

v(3905, P + 'PENERIMA GANTI RUGI - PILIH HURUF: A kepada #0046# selaku anak yang telah dewasa, B kepada #0046# untuk dikelola bagi kepentingan anak yang belum dewasa; kosong = A', 'data_teks')
v(3906, P + 'AMAR PENGGANTIAN KERUGIAN (OTOMATIS: bentuk 3902/3898/3903 dan penerima 3905; kalimat sesudah kata "mengganti kerugian ...")', 'data_sql',
  "SELECT CASE WHEN c.u = 1 AND c.b = 1 THEN CONCAT('dengan membayar ganti rugi sebesar Rp', \"#3901#\", ',00 (', \"#3900#\", ' rupiah) dan menyerahkan kembali ', c.br, ', masing-masing ', c.rc) "
  "WHEN c.u = 1 THEN CONCAT('dengan membayar ganti rugi sebesar Rp', \"#3901#\", ',00 (', \"#3900#\", ' rupiah) ', c.rc) "
  "WHEN c.b = 1 THEN CONCAT('dengan menyerahkan kembali ', c.br, ' ', c.rc) "
  "ELSE '........' END AS data "
  "FROM (SELECT %s AS u, %s AS b, IF(%s <> '', %s, '........') AS br, \"#3919#\" AS rc) c" % (_U, _B, isi(3903), isi(3903)))

# ---------------- fakta terbukti, alasan tolak, sebab NO, alat bukti ----------------
v(3907, P + 'FAKTA KESALAHAN ATAU KELALAIAN YANG TERBUKTI - ISIAN kalimat sesudah kata "Bahwa" (apa yang dilakukan atau dilalaikan #0047#, bukti dan saksi yang menguatkan)', 'data_teks')
v(3908, P + 'ALASAN DITOLAK - ISIAN kalimat sesudah kata "Menimbang, bahwa" (mis. kerugian harta benda anak tidak terbukti, atau kerugian bukan akibat kesalahan atau kelalaian #0047#)', 'data_teks')
v(3909, P + 'NO - CACAT FORMIL GUGATAN (isian: mis. gugatan kabur karena harta benda anak, perbuatan wali atau jumlah kerugian tidak diuraikan dengan jelas, satu kalimat tanpa titik akhir)', 'data_teks')
v(3910, P + 'ALAT BUKTI SURAT #0046# - ISIAN (daftar bukti P.1 dst.; bila dibiarkan, memakai contoh bawaan)', 'data_teks',
  default=('1. Fotokopi Kartu Tanda Penduduk atas nama #0098#, NIK ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.1;<br>'
           '2. Fotokopi Kartu Keluarga Nomor ... atas nama ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.2;<br>'
           '3. Fotokopi Kutipan Akta Kelahiran anak atas nama ..., Nomor ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.3;<br>'
           '4. Fotokopi Penetapan Pengadilan Agama ... Nomor ... tanggal ... tentang penunjukan wali, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.4;<br>'
           '5. Fotokopi bukti kepemilikan harta benda anak berupa ... Nomor ... atas nama ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.5;<br>'
           '6. ...'))
v(3911, P + 'ALAT BUKTI SURAT #0047# - ISIAN (daftar bukti T.1 dst.; bila dibiarkan, memakai contoh bawaan)', 'data_teks',
  default=('1. Fotokopi Kartu Tanda Penduduk atas nama #0102#, NIK ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda T.1;<br>'
           '2. Fotokopi Penetapan Pengadilan Agama ... Nomor ... tanggal ... tentang penunjukan wali, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda T.2;<br>'
           '3. Fotokopi bukti pengeluaran atau pembukuan pengelolaan harta anak berupa ... tanggal ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda T.3;<br>'
           '4. ...'))

# ---------------- penilaian, teguran, jumlah dituntut, pembukuan ----------------
v(3912, P + 'DASAR PENILAIAN BESARAN KERUGIAN - ISIAN frasa sesudah kata "berdasarkan" (mis. bukti harga jual, taksiran harga pasar, hasil pemeriksaan setempat, keterangan saksi dan ahli)', 'data_teks')
v(3913, P + 'TEGURAN ATAU UPAYA PENYELESAIAN SEBELUM GUGATAN - ISIAN OPSIONAL (siapa menegur #0047#, kapan, dan tanggapannya; kosong = tidak tercetak)', 'data_teks')
v(3914, P + 'PERTIMBANGAN TEGURAN SEBELUM GUGATAN (OTOMATIS: hanya bila isian 3913 terisi; diawali satu baris baru)', 'data_sql',
  "SELECT IF(%s <> '', CONCAT('<br>Menimbang, bahwa berdasarkan keterangan yang terungkap di persidangan, sebelum perkara ini diajukan telah ada teguran atau upaya penyelesaian kepada #0047#, yaitu ', %s, ', yang #8554# pertimbangkan bersama-sama dengan alat bukti lainnya dalam menilai kesalahan atau kelalaian #0047#;'), '') AS data" % (isi(3913), isi(3913)))
v(3915, P + 'JUMLAH KERUGIAN YANG DITUNTUT #0046# - ISIAN (rupiah, angka saja; mis. 150000000; kosong bila tidak menuntut uang)', 'data_teks')
v(3916, P + 'JUMLAH KERUGIAN YANG DITUNTUT BERTITIK (OTOMATIS dari isian 3915, mis. 150.000.000; kosong = titik-titik)', 'data_sql',
  "SELECT %s AS data" % titik(3915))
v(3917, P + 'DAFTAR HARTA DAN PEMBUKUAN WALI - ISIAN OPSIONAL (apakah #0047# membuat daftar harta anak saat memulai jabatan dan pembukuan tahunan; kosong = tidak tercetak)', 'data_teks')
v(3918, P + 'PERTIMBANGAN DAFTAR HARTA DAN PEMBUKUAN (OTOMATIS: hanya bila isian 3917 terisi; Pasal 51 ayat (4) UU 1/1974, Pasal 110 ayat (4) KHI; diawali satu baris baru)', 'data_sql',
  "SELECT IF(%s <> '', CONCAT('<br>Menimbang, bahwa mengenai kewajiban wali membuat daftar harta benda anak pada waktu memulai jabatannya dan mencatat semua perubahan harta benda anak sebagaimana Pasal 51 ayat (4) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, serta pembukuan yang ditutup tiap satu tahun sekali sebagai bukti pertanggungjawaban wali sebagaimana Pasal 110 ayat (4) Kompilasi Hukum Islam, terungkap bahwa ', %s, ', yang #8554# pertimbangkan dalam menilai pertanggungjawaban #0047# atas harta benda #4407# tersebut;'), '') AS data" % (isi(3917), isi(3917)))
v(3919, P + 'PENERIMA GANTI RUGI DALAM KALIMAT (OTOMATIS dari huruf isian 3905: A atau kosong = kepada #0046#, B = untuk dikelola bagi kepentingan anak)', 'data_sql',
  "SELECT IF(%s, 'kepada #0046# untuk dikelola dan dipergunakan bagi kepentingan #4407# tersebut', 'kepada #0046#') AS data" % ada_huruf(3905, 'B'))
