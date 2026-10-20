# -*- coding: utf-8 -*-
"""Variabel ABT baru - VERZET (perlawanan Tergugat/Termohon atas PUTUSAN VERSTEK dalam perkara yang SAMA), jatah nomor 3970-3999.

Verzet bukan perkara baru: ABT bekerja per perkara_id perkara ASAL. Sumber data otomatis: SIPP perkara_verzet (satu baris per perkara asal: tanggal surat,
pendaftaran, penetapan majelis, sidang, putusan verzet, status), perkara_putusan (nomor dan tanggal putusan verstek), perkara_putusan_pemberitahuan_putusan
(tanggal pemberitahuan putusan verstek kepada Tergugat/Termohon, pihak = 2), perkara_hakim_pn / perkara_panitera_pn tahapan_id = 16 (majelis dan panitera VERZET;
tahapan 16 = Verzet pada tabel tahapan SIPP), perkara_jadwal_sidang (kolom verzet = 'Y').

Pihak: Pelawan = Tergugat/Termohon asal (data sisi T), Terlawan = Penggugat/Pemohon asal (data sisi P). Sebutan tidak lewat #0046#/#0047# (itu Penggugat/Tergugat) tetapi
kata tetap "Pelawan" dan "Terlawan". Identitas diambil dari #7048# dan #7047# lalu sebutan akhirnya diganti (REPLACE), sehingga kuasa dan banyak pihak ikut benar.

Dasar hukum yang dicetak (naskah di D:/aleta-dev/kerja/referensi/_unduhan/hir-rbg-bw/rbg-unnes.txt, dibaca bunyinya; lihat spek/PASAL-verzet.md):
  Pasal 148, 149 ayat (1)-(4), 153 ayat (1)-(6), 154 ayat (1), 192 ayat (1) dan (4), 207, 208, 283 RBg.

Pembagian nomor:
  OTOMATIS : 3970 Pelawan  3971 Terlawan  3972 putusan verstek  3973 tanggal surat  3974 tanggal daftar  3975 tanggal pemberitahuan  3976 pertimbangan tenggang
             3990 amar pokok perkara  3992 angka murni biaya  3993 biaya bertitik  3994 terbilang biaya  3995-3997 kaki putusan dan tanda tangan majelis VERZET
  ISIAN    : 3977 cara pemberitahuan (huruf)  3978 tanggal teguran/perintah  3979 tenggang diperpanjang  3980 dalil  3981 petitum  3982 jawaban  3983/3984 bukti surat
             3985 pertimbangan utama  3986 sebab tidak dapat diterima  3987 pilihan hasil pokok  3988 pertimbangan pokok  3989 amar pokok bebas  3991 biaya (angka)
             3998 mediasi/upaya damai tambahan  3999 fakta hukum
Tanggal isian (3978, 3979) ditulis angka: hh-bb-tttt (mis. 05-01-2026) supaya kueri dapat menghitung hari.
"""
from variabel_def import v, isi

P = 'VERZET: '
BULAN = "'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'"
HARI = "'Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'"
TITIK = "'........'"


def _tgl(x):
    return "CONCAT(LPAD(DAY(%s),2,'0'),' ',ELT(MONTH(%s),%s),' ',YEAR(%s))" % (x, x, BULAN, x)


def _vz(kolom):
    """Skalar: kolom perkara_verzet perkara ini."""
    return "(SELECT %s FROM perkara_verzet vz WHERE vz.perkara_id = '#perkara_id#' ORDER BY vz.perkara_id LIMIT 1)" % kolom


def _tgl_vz(kolom):
    return "IFNULL((SELECT %s FROM (SELECT %s AS d) z WHERE z.d > '1900-01-01'), %s)" % (_tgl('z.d'), _vz(kolom), TITIK)


def _tg_pemberitahuan():
    """Skalar tanggal: pemberitahuan putusan verstek terakhir kepada pihak kedua (Tergugat/Termohon)."""
    return ("(SELECT MAX(q.tanggal_pemberitahuan_putusan) FROM perkara_putusan_pemberitahuan_putusan q "
            "WHERE q.perkara_id = '#perkara_id#' AND q.pihak = 2 AND q.tanggal_pemberitahuan_putusan > '1900-01-01')")


def _tanggal_isian(n):
    """Skalar tanggal dari isian n berbentuk hh-bb-tttt (atau hh/bb/tttt); NULL bila bukan tanggal sah."""
    return "STR_TO_DATE(REPLACE(REPLACE(%s, '/', '-'), ' ', ''), '%%d-%%m-%%Y')" % isi(n)


def bersih(n):
    return ("REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(%s), 'RP', ''), '.', ''), ' ', ''), ',00', ''), ',', ''), '-', '')" % isi(n))


# ---------------------------------------------------------------------------------------------------------------------------------
# Pihak, putusan verstek, tanggal
# ---------------------------------------------------------------------------------------------------------------------------------
v(3970, P + 'IDENTITAS PELAWAN (OTOMATIS: identitas Tergugat/Termohon asal dari #7048#, sebutan akhir menjadi "Pelawan semula Tergugat/Termohon"; kuasa dan banyak pihak ikut)', 'data_sql',
  "SELECT REPLACE(\"#7048#\", \"sebagai <strong>#0047#\", \"sebagai <strong>Pelawan semula #0047#\") AS data")
v(3971, P + 'IDENTITAS TERLAWAN (OTOMATIS: identitas Penggugat/Pemohon asal dari #7047# dan Turut Tergugat dari #8710#, sebutan akhir menjadi "Terlawan semula Penggugat/Pemohon")', 'data_sql',
  "SELECT CONCAT(REPLACE(\"#7047#\", \"sebagai <strong>#0046#\", \"sebagai <strong>Terlawan semula #0046#\"), "
  "REPLACE(\"#8710#\", \"sebagai <strong>Turut \", \"sebagai <strong>Turut Terlawan semula Turut \")) AS data")
v(3972, P + 'PUTUSAN VERSTEK YANG DILAWAN (OTOMATIS SIPP: "Nomor ... tanggal ..." dari nomor perkara dan tanggal putusan perkara ini)', 'data_sql',
  "SELECT IFNULL((SELECT CONCAT('Nomor ', p.nomor_perkara, ' tanggal ', %s) FROM perkara p JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id "
  "WHERE p.perkara_id = '#perkara_id#' AND pu.tanggal_putusan > '1900-01-01' LIMIT 1), 'Nomor #0001# tanggal ........') AS data" % _tgl('pu.tanggal_putusan'))
v(3973, P + 'TANGGAL SURAT PERLAWANAN (OTOMATIS SIPP perkara_verzet.tanggal_surat, bila kosong tanggal pendaftaran; belum ada = titik-titik)', 'data_sql',
  "SELECT IFNULL((SELECT %s FROM (SELECT IF(%s > '1900-01-01', %s, %s) AS d) z WHERE z.d > '1900-01-01'), %s) AS data" % (
      _tgl('z.d'), _vz('vz.tanggal_surat'), _vz('vz.tanggal_surat'), _vz('vz.tanggal_pendaftaran_verzet'), TITIK))
v(3974, P + 'TANGGAL PENDAFTARAN PERLAWANAN DI KEPANITERAAN (OTOMATIS SIPP perkara_verzet.tanggal_pendaftaran_verzet; belum ada = titik-titik)', 'data_sql',
  "SELECT %s AS data" % _tgl_vz('vz.tanggal_pendaftaran_verzet'))
v(3975, P + 'TANGGAL PEMBERITAHUAN PUTUSAN VERSTEK KEPADA TERGUGAT/TERMOHON (OTOMATIS SIPP perkara_putusan_pemberitahuan_putusan pihak 2, yang terakhir; belum ada = titik-titik)', 'data_sql',
  "SELECT IFNULL((SELECT %s FROM (SELECT %s AS d) z WHERE z.d IS NOT NULL), %s) AS data" % (_tgl('z.d'), _tg_pemberitahuan(), TITIK))

# ---------------------------------------------------------------------------------------------------------------------------------
# Tenggang waktu perlawanan - Pasal 153 ayat (2) dan (3) RBg
# ---------------------------------------------------------------------------------------------------------------------------------
v(3977, P + 'TENGGANG PERLAWANAN - PILIH HURUF: A diberitahukan ke Pelawan sendiri (14 hari), B tidak ke Pelawan sendiri (hari ke-8 sesudah teguran; isi 3978), C diperpanjang (isi 3979)', 'data_teks')
v(3978, P + 'TANGGAL TEGURAN (PASAL 207 RBg) ATAU PERINTAH TERTULIS (PASAL 208 RBg) - ISIAN angka hh-bb-tttt, mis. 05-01-2026 (hanya untuk pilihan B; batas perlawanan = hari kedelapan sesudahnya)', 'data_teks')
v(3979, P + 'TENGGANG DIPERPANJANG SAMPAI TANGGAL - ISIAN angka hh-bb-tttt, mis. 20-01-2026 (hanya untuk pilihan C; Pasal 153 ayat (3) RBg)', 'data_teks')

_Z3976 = (
    "(SELECT %s AS tg, %s AS dz, %s AS d3, %s AS d4, UPPER(%s) AS h) z" % (
        _tg_pemberitahuan(), _vz('vz.tanggal_pendaftaran_verzet'), _tanggal_isian(3978), _tanggal_isian(3979), isi(3977)))
_DZ = "IF(z.dz > '1900-01-01', %s, %s)" % (_tgl('z.dz'), TITIK)
_TG = "IF(z.tg IS NOT NULL, %s, %s)" % (_tgl('z.tg'), TITIK)
_AWAL = "Menimbang, bahwa menurut Pasal 153 ayat (2) RBg, "
v(3976, P + 'PERTIMBANGAN TENGGANG WAKTU PERLAWANAN (OTOMATIS: tanggal pemberitahuan dan pendaftaran dari SIPP + pilihan 3977; menghitung dalam atau lewat tenggang; huruf C > B > A; kosong = titik-titik)', 'data_sql',
  "SELECT CASE "
  # C - diperpanjang
  "WHEN z.h LIKE '%%C%%' THEN CONCAT('Menimbang, bahwa menurut Pasal 153 ayat (3) RBg, Pengadilan berwenang dalam putusannya memperpanjang tenggang waktu pengajuan perlawanan menurut keadaan; dalam perkara ini tenggang waktu perlawanan diperpanjang sampai dengan tanggal ', IF(z.d4 IS NOT NULL, %s, %s), ', sedangkan perlawanan didaftarkan pada tanggal ', %s, ', sehingga perlawanan ', "
  "IF(z.d4 IS NULL OR z.dz IS NULL, '........', IF(z.dz <= z.d4, 'diajukan dalam tenggang waktu yang diperpanjang tersebut', 'diajukan setelah lewat tenggang waktu yang diperpanjang tersebut')), ';') "
  # B - tidak diterima sendiri
  "WHEN z.h LIKE '%%B%%' THEN CONCAT('%s', 'apabila putusan verstek tidak disampaikan kepada orang yang dikalahkan sendiri, perlawanan dapat diajukan sampai dengan hari kedelapan setelah teguran menurut Pasal 207 RBg atau, apabila ia tidak datang menghadap untuk diberitahu meskipun telah dipanggil dengan patut, sampai dengan hari kedelapan setelah perintah tertulis menurut Pasal 208 RBg dilaksanakan; dalam perkara ini putusan verstek tersebut tidak diterima oleh Pelawan sendiri, sedangkan teguran atau perintah tertulis tersebut dilaksanakan pada tanggal ', IF(z.d3 IS NOT NULL, %s, %s), ', sehingga batas akhir pengajuan perlawanan adalah tanggal ', IF(z.d3 IS NOT NULL, %s, %s), ', sedangkan perlawanan didaftarkan pada tanggal ', %s, ', sehingga perlawanan ', "
  "IF(z.d3 IS NULL OR z.dz IS NULL, '........', IF(z.dz <= DATE_ADD(z.d3, INTERVAL 8 DAY), 'diajukan dalam tenggang waktu yang ditentukan undang-undang', 'diajukan setelah lewat tenggang waktu yang ditentukan undang-undang')), ';') "
  # A - diterima sendiri
  "WHEN z.h LIKE '%%A%%' THEN CONCAT('%s', 'apabila pemberitahuan putusan verstek telah diterima oleh orang yang dikalahkan sendiri, perlawanan dapat dilakukan dalam tenggang waktu 14 (empat belas) hari setelah pemberitahuan itu; dalam perkara ini putusan verstek tersebut telah diberitahukan kepada Pelawan sendiri pada tanggal ', %s, ', sedangkan perlawanan didaftarkan pada tanggal ', %s, ', yaitu ', IF(z.tg IS NULL OR z.dz IS NULL, '........', DATEDIFF(z.dz, z.tg)), ' hari setelah pemberitahuan tersebut, sehingga perlawanan ', "
  "IF(z.tg IS NULL OR z.dz IS NULL, '........', IF(DATEDIFF(z.dz, z.tg) <= 14, 'diajukan dalam tenggang waktu yang ditentukan undang-undang', 'diajukan setelah lewat tenggang waktu yang ditentukan undang-undang')), ';') "
  # kosong
  "ELSE CONCAT('Menimbang, bahwa putusan verstek tersebut diberitahukan kepada Pelawan pada tanggal ', %s, ', sedangkan perlawanan didaftarkan pada tanggal ', %s, '; mengenai tenggang waktu pengajuan perlawanan menurut Pasal 153 ayat (2) RBg, ........;') END AS data "
  "FROM %s" % (
      _tgl('z.d4'), TITIK, _DZ,
      _AWAL, _tgl('z.d3'), TITIK, _tgl('DATE_ADD(z.d3, INTERVAL 8 DAY)'), TITIK, _DZ,
      _AWAL, _TG, _DZ,
      _TG, _DZ,
      _Z3976))

# ---------------------------------------------------------------------------------------------------------------------------------
# Isian pokok (tidak ada di SIPP)
# ---------------------------------------------------------------------------------------------------------------------------------
v(3980, P + 'DALIL PERLAWANAN PELAWAN - ISIAN uraian pokok alasan perlawanan (mis. tidak dipanggil secara patut, bantahan atas dalil gugatan); butir dipisah <br>', 'data_teks', default='........')
v(3981, P + 'PETITUM PERLAWANAN PELAWAN - ISIAN permintaan Pelawan (mis. menerima perlawanan; membatalkan putusan verstek; menolak gugatan Terlawan); butir bernomor dipisah <br>', 'data_teks', default='........')
v(3982, P + 'JAWABAN TERLAWAN - ISIAN uraian pokok jawaban Terlawan atas perlawanan (lisan atau tertulis); kosong = titik-titik', 'data_teks', default='........')
v(3983, P + 'BUKTI SURAT PELAWAN - ISIAN daftar bukti dengan tanda P.1 dst. (Pelawan bertindak sebagai pihak yang mendalilkan perlawanannya, Pasal 283 RBg); butir bernomor dipisah <br>', 'data_teks',
  default=('1. Fotokopi Kartu Tanda Penduduk atas nama #0102#, NIK ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.1;<br>'
           '2. ...'))
v(3984, P + 'BUKTI SURAT TERLAWAN - ISIAN daftar bukti dengan tanda T.1 dst. (Terlawan membuktikan dalil gugatan asal dan bantahannya, Pasal 283 RBg); butir bernomor dipisah <br>', 'data_teks',
  default=('1. Fotokopi Kartu Tanda Penduduk atas nama #0098#, NIK ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda T.1;<br>'
           '2. ...'))
v(3985, P + 'PERTIMBANGAN UTAMA PERLAWANAN - ISIAN sesudah "Menimbang, bahwa" (kabul: mengapa verstek tak dapat dipertahankan; tolak: mengapa dalil tidak terbukti; boleh beberapa paragraf)', 'data_teks', default='........')
v(3986, P + 'SEBAB PERLAWANAN TIDAK DAPAT DITERIMA - ISIAN kalimat sesudah "Menimbang, bahwa" (mis. diajukan oleh yang tidak berhak, bukan Tergugat yang diputus verstek, atau cacat formil lain)', 'data_teks', default='........')
v(3987, P + 'HASIL POKOK PERKARA SESUDAH VERSTEK DIBATALKAN - PILIH HURUF: A gugatan asal ditolak, B gugatan asal tidak dapat diterima, C amar bebas (isi 3989); keduanya kosong = titik-titik', 'data_teks')
v(3988, P + 'PERTIMBANGAN POKOK PERKARA SESUDAH VERSTEK DIBATALKAN - ISIAN paragraf "Menimbang, bahwa ..." tentang gugatan asal (Pasal 153 ayat (4) RBg); dipisah <br>', 'data_teks', default='........')
v(3989, P + 'AMAR POKOK PERKARA BEBAS - ISIAN butir amar atas gugatan/permohonan asal (untuk pilihan C pada 3987); beberapa butir dipisah <br>; tanpa nomor, nomor dibuat oleh susunan putusan', 'data_teks')

_H87 = "UPPER(%s)" % isi(3987)
v(3990, P + 'AMAR POKOK PERKARA SESUDAH VERSTEK DIBATALKAN (OTOMATIS: pilihan 3987 dan isian 3989; A menolak, B tidak dapat diterima, C isian bebas; titik-titik bila belum dipilih)', 'data_sql',
  "SELECT CASE WHEN %s LIKE '%%C%%' OR (%s = '' AND %s <> '') THEN %s "
  "WHEN %s LIKE '%%B%%' THEN 'Menyatakan #0053# Terlawan tidak dapat diterima (niet ontvankelijk verklaard);' "
  "WHEN %s LIKE '%%A%%' THEN 'Menolak #0053# Terlawan;' "
  "ELSE '........;' END AS data" % (_H87, _H87, isi(3989), isi(3989), _H87, _H87))

# ---------------------------------------------------------------------------------------------------------------------------------
# Biaya perkara perlawanan: isian -> angka murni -> bertitik, terbilang
# ---------------------------------------------------------------------------------------------------------------------------------
v(3991, P + 'BIAYA PERKARA PERLAWANAN - ISIAN rupiah angka saja (mis. 140000 atau 140.000); jumlah biaya perlawanan menurut SIPP/kasir, bukan seluruh biaya perkara asal', 'data_teks')
v(3992, P + 'BIAYA PERLAWANAN ANGKA MURNI (OTOMATIS dari isian 3991, tanpa titik; dasar terbilang 3994)', 'data_sql',
  "SELECT IF(%s REGEXP '^[0-9]+$', %s, '') AS data" % (bersih(3991), bersih(3991)))
v(3993, P + 'BIAYA PERLAWANAN BERTITIK (OTOMATIS dari 3992, mis. 140.000; belum diisi = titik-titik)', 'data_sql',
  "SELECT IF(\"#3992#\" REGEXP '^[0-9]+$', REPLACE(FORMAT(\"#3992#\", 0), ',', '.'), '........') AS data")
v(3994, P + 'TERBILANG BIAYA PERLAWANAN (#3992#)', 'terbilang', referensi=3992)

# ---------------------------------------------------------------------------------------------------------------------------------
# Kaki putusan dan tanda tangan MAJELIS VERZET (perkara_hakim_pn / perkara_panitera_pn tahapan_id = 16; bila tidak ada, majelis perkara asal)
# ---------------------------------------------------------------------------------------------------------------------------------
_HAKIM = ("(SELECT MIN(h.jabatan_hakim_id) AS jb, MAX(IF(h.urutan = 1, b.nama_gelar, NULL)) AS k, MAX(IF(h.urutan = 2, b.nama_gelar, NULL)) AS a1, MAX(IF(h.urutan = 3, b.nama_gelar, NULL)) AS a2 "
          "FROM perkara_hakim_pn h JOIN hakim_pn b ON b.id = h.hakim_id WHERE h.perkara_id = '#perkara_id#' AND h.tahapan_id = 16 "
          "AND (h.aktif = 'Y' OR NOT EXISTS (SELECT 1 FROM perkara_hakim_pn z WHERE z.perkara_id = h.perkara_id AND z.tahapan_id = 16 AND z.aktif = 'Y'))) m")
_PP = ("(SELECT x.panitera_nama FROM perkara_panitera_pn x WHERE x.perkara_id = '#perkara_id#' AND x.tahapan_id = 16 "
       "ORDER BY IF(x.aktif = 'Y', 0, 1), x.tanggal_penetapan DESC, x.id DESC LIMIT 1)")
_HADIR = ("(SELECT CASE WHEN j.dihadiri_oleh IN (1, 9) THEN 1 WHEN j.dihadiri_oleh IN (2, 7) THEN 2 WHEN j.dihadiri_oleh IN (3, 8) THEN 3 WHEN j.dihadiri_oleh = 4 THEN 4 ELSE 0 END "
          "FROM perkara_jadwal_sidang j WHERE j.perkara_id = '#perkara_id#' AND j.verzet = 'Y' ORDER BY j.urutan DESC LIMIT 1)")
_ECOURT = "EXISTS (SELECT 1 FROM perkara_efiling_id f WHERE f.perkara_id = '#perkara_id#' AND f.efiling_id <> '')"

v(3995, P + 'KAKI PUTUSAN VERZET - PEMBUKA (OTOMATIS: majelis verzet tahapan 16; "Demikian diputuskan dalam rapat musyawarah Majelis Hakim" atau Hakim Tunggal; tak ada = #8501#)', 'data_sql',
  "SELECT IF(m.jb IS NULL, \"#8501#\", IF(m.jb = 1, CONCAT('Demikian diputuskan dalam rapat musyawarah ', 'Majelis Hakim ', \"#8008#\"), CONCAT('Demikian diputuskan oleh Hakim Tunggal ', \"#8008#\"))) AS data FROM " + _HAKIM)
v(3996, P + 'KAKI PUTUSAN VERZET - NAMA MAJELIS DAN KEHADIRAN (OTOMATIS: hakim dan panitera pengganti tahapan 16; kehadiran pada sidang verzet terakhir dari SIPP; bila tak ada = #8502#)', 'data_sql',
  "SELECT IF(m.jb IS NULL, \"#8502#\", CONCAT('oleh <strong>', m.k, '</strong> sebagai Hakim Ketua, ', "
  "IF(m.jb = 1, CONCAT('<strong>', IFNULL(m.a1, '........'), '</strong> dan <strong>', IFNULL(m.a2, '........'), '</strong>, masing-masing sebagai Hakim Anggota, dan diucapkan dalam sidang terbuka untuk umum pada hari itu oleh Hakim Ketua tersebut didampingi para Hakim Anggota tersebut'), "
  "'dan diucapkan dalam sidang terbuka untuk umum pada hari itu oleh Hakim Tunggal tersebut'), "
  "', dibantu oleh <strong>', IFNULL(%s, \"#8553#\"), '</strong> sebagai ', IF(IFNULL(%s, \"#8553#\") = \"#8004#\", 'Panitera', 'Panitera Sidang'), ', ', "
  "CASE %s WHEN 1 THEN 'serta dihadiri oleh Pelawan dan Terlawan' WHEN 2 THEN 'serta dihadiri oleh Terlawan tanpa kehadiran Pelawan' WHEN 3 THEN 'serta dihadiri oleh Pelawan tanpa kehadiran Terlawan' "
  "WHEN 4 THEN 'tanpa kehadiran Pelawan dan Terlawan' ELSE 'serta dihadiri oleh Pelawan dan Terlawan' END, "
  "IF(%s, ', dan putusan tersebut telah dikirim secara elektronik melalui sistem informasi pengadilan pada hari itu juga.', '.'))) AS data FROM %s" % (_PP, _PP, _HADIR, _ECOURT, _HAKIM))
v(3997, P + 'TANDA TANGAN MAJELIS VERZET (OTOMATIS, RTF: Ketua dan Anggota sampingan, Panitera Pengganti tidak dicetak; majelis tahapan 16; bila tak ada = blok majelis asal #8500#)', 'data_sql',
  "SELECT REPLACE(IF(m.jb IS NULL, \"#8500#\", IF(m.jb = 1, "
  "CONCAT('~trowd~trqc~trgaph85~trleft0~trkeep~cellx8400~pard~intbl~qc~sl360~slmult1 Hakim Ketua,~par~par~par~par ~b ', m.k, '~b0~cell~row~trowd~trqc~trgaph85~trleft0~trkeep~cellx4200~cellx8400~pard~intbl~qc~sl360~slmult1 Hakim Anggota,~par~par~par~par ~b ', IFNULL(m.a1, '........'), '~b0~cell~pard~intbl~qc~sl360~slmult1 Hakim Anggota,~par~par~par~par ~b ', IFNULL(m.a2, '........'), '~b0~cell~row~trowd~trqc~trgaph85~trleft0~trkeep~cellx8400~pard~intbl~qc~sl360~slmult1 ', IF(IFNULL(%s, \"#8553#\") = \"#8004#\", 'Panitera', 'Panitera Sidang'), ',~par~par~par~par ~b ', IFNULL(%s, \"#8553#\"), '~b0~cell~row~pard '), "
  "CONCAT('~trowd~trqc~trgaph85~trleft0~trkeep~cellx8400~pard~intbl~qc~sl360~slmult1 Hakim Tunggal,~par~par~par~par ~b ', m.k, '~b0~cell~row~trowd~trqc~trgaph85~trleft0~trkeep~cellx8400~pard~intbl~qc~sl360~slmult1 ', IF(IFNULL(%s, \"#8553#\") = \"#8004#\", 'Panitera', 'Panitera Sidang'), ',~par~par~par~par ~b ', IFNULL(%s, \"#8553#\"), '~b0~cell~row~pard '))), '~', CHAR(92)) AS data FROM %s" % (_PP, _PP, _PP, _PP, _HAKIM))

v(3998, P + 'UPAYA DAMAI/MEDIASI TAMBAHAN PADA PERLAWANAN - ISIAN OPSIONAL kalimat lengkap (mis. mediasi dengan mediator ... tidak berhasil); kosong = hanya upaya damai Pasal 154 RBg', 'data_teks')
v(3999, P + 'FAKTA HUKUM PERLAWANAN - ISIAN kalimat sesudah "Bahwa" dari alat bukti kedua pihak (dipisah <br> tiap butir, tanpa nomor), mis. cara pemanggilan Pelawan, alasan tidak hadir', 'data_teks', default='........')
