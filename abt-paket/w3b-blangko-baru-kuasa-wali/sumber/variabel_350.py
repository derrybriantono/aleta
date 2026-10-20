# -*- coding: utf-8 -*-
"""Variabel ABT baru - NAFKAH ANAK OLEH IBU KARENA AYAH TIDAK MAMPU (jenis SIPP 350), jatah 3920-3939.

Dasar hukum yang dicetak (terverifikasi dengan naskah di D:/aleta-dev/kerja/referensi/_unduhan; lihat spek/PASAL-350.md):
  Pasal 41 huruf b dan Pasal 45 ayat (1)-(2) UU 1/1974 (naskah BPK); Pasal 105 huruf c, Pasal 156 huruf d-f dan Pasal 98 ayat (3) KHI;
  Pasal 26 ayat (1)-(2) UU 23/2002 sebagaimana diubah UU 35/2014; Pasal 49 huruf a dan penjelasan angka 12 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009;
  rumusan Kamar Agama yang sudah dipakai blangko "6c Nafkah Anak": SEMA 3/2018 (Hukum Keluarga huruf b), SEMA 3/2015 angka 14, Buku II 2026.

Pembagian nomor (semua isian dibaca lewat isi(n), aman dari tanda kutip):
  isian petugas : 3920 alasan ayah tidak mampu (huruf)  3921 fakta keadaan ayah  3922 fakta kemampuan ibu  3923 kebutuhan biaya anak per bulan (angka)
                  3924 bagian ayah per bulan (angka)  3928 kedudukan Penggugat bila bukan ibu kandung  3931 kenaikan per tahun  3932 dasar penilaian kebutuhan
                  3933 fakta pengasuhan anak  3936 alasan ditolak  3937 sebab tidak dapat diterima  3938 bukti surat Penggugat
  turunan       : 3925 kebutuhan (angka murni)  3926 bagian ayah (angka murni)  3927 bagian ibu = kebutuhan - bagian ayah (angka murni)
                  3929 kedudukan Penggugat terhadap anak  3934 pertimbangan pembagian  3935 butir amar pembagian  3939 kualifikasi ketidakmampuan ayah
  cadangan      : 3930 (tidak dipakai)
Hakim yang memutuskan: huruf alasan, besar kebutuhan, bagian ayah (bagian ibu = selisihnya), kenaikan; mesin hanya menghitung selisih dan menyusun kalimat.

Terbilang: dihitung SENDIRI di dalam kueri 3934/3935 (kata_jumlah), BUKAN lewat variabel bertipe terbilang. Penanda #nnnn# di dalam TEKS KUERI diganti ABT dengan nilai
mentahnya (var_data = angka) SEBELUM kueri dijalankan, sehingga penanda terbilang di dalam kalimat kueri akan tercetak sebagai angka, bukan kata; sedangkan kalimat ini
bersyarat (bagian ayah boleh nol) sehingga tidak dapat ditaruh sebagai teks tetap di RTF.
"""
from variabel_def import v, isi, ada, pilihan_huruf

P = 'NAFKAH ANAK OLEH IBU: '

SAT = "'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'"


def _rapi(n):
    """isian n tanpa titik-koma di ujung (gaya 6c)."""
    return "TRIM(TRAILING ';' FROM %s)" % isi(n)


def _mentah(n):
    """isian angka n: huruf besar, tanpa 'RP', titik dan spasi."""
    return "REPLACE(REPLACE(REPLACE(UPPER(%s), 'RP', ''), '.', ''), ' ', '')" % isi(n)


# Tabel turunan satu baris: a = kebutuhan (angka murni > 0, atau kosong), b = bagian ayah (angka murni >= 0, atau kosong), i = a - b (> 0, atau kosong),
# kn = kenaikan per tahun, dk = dasar penilaian kebutuhan; aj/ar/au = kelompok jutaan/ribuan/satuan untuk terbilang (juga bj/br/bu dan ij/ir/iu).
# Angka dibaca dari isian petugas ("Rp3.000.000,00", "3.000.000", "3000000" semuanya sah); isian yang bukan angka murni (ada huruf) dianggap kosong
# sehingga hasilnya '........' dan mesin tidak pernah menebak.
_L0 = "SELECT %s AS ra, %s AS rb, %s AS kn, %s AS dk" % (_mentah(3923), _mentah(3924), _rapi(3931), _rapi(3932))
_L1 = ("SELECT REPLACE(IF(RIGHT(ra, 3) = ',00', LEFT(ra, CHAR_LENGTH(ra) - 3), ra), ',', '') AS ca, "
       "REPLACE(IF(RIGHT(rb, 3) = ',00', LEFT(rb, CHAR_LENGTH(rb) - 3), rb), ',', '') AS cb, kn, dk FROM (" + _L0 + ") l0")
_L2 = ("SELECT IF(ca REGEXP '^[0-9]{1,9}$' AND CAST(ca AS UNSIGNED) > 0, CAST(CAST(ca AS UNSIGNED) AS CHAR), '') AS a, "
       "IF(cb REGEXP '^[0-9]{1,9}$', CAST(CAST(cb AS UNSIGNED) AS CHAR), '') AS b, kn, dk FROM (" + _L1 + ") l1")
_L3 = ("SELECT a, b, kn, dk, IF(a <> '' AND CAST(IF(b = '', '0', b) AS SIGNED) < CAST(a AS SIGNED), "
       "CAST(CAST(a AS SIGNED) - CAST(IF(b = '', '0', b) AS SIGNED) AS CHAR), '') AS i FROM (" + _L2 + ") l2")


def _bagi(x):
    n = "CAST(IF(%s = '', '0', %s) AS UNSIGNED)" % (x, x)
    return "%s DIV 1000000 AS %sj, (%s MOD 1000000) DIV 1000 AS %sr, %s MOD 1000 AS %su" % (n, x, n, x, n, x)


_L4 = "SELECT a, b, i, kn, dk, " + ", ".join(_bagi(x) for x in 'abi') + " FROM (" + _L3 + ") l3"


def _dari(ekspresi, dasar=None):
    return "SELECT %s AS data FROM (%s) z" % (ekspresi, dasar or _L4)


def rp(x):
    """Ungkapan SQL: kolom angka murni x diberi titik ribuan; kosong = titik-titik."""
    return "IF(%s = '', '........', REPLACE(FORMAT(CAST(%s AS SIGNED), 0), ',', '.'))" % (x, x)


def kata3(g):
    """Ungkapan SQL: kata untuk bilangan 0-999 pada kolom g ('' bila 0)."""
    d = "MOD(%s, 100)" % g
    ratus = "IF(%s >= 200, CONCAT(ELT(%s DIV 100, %s), ' ratus'), IF(%s >= 100, 'seratus', NULL))" % (g, g, SAT, g)
    sisa = ("CASE WHEN {d} = 0 THEN NULL WHEN {d} < 10 THEN ELT({d}, {s}) WHEN {d} = 10 THEN 'sepuluh' WHEN {d} = 11 THEN 'sebelas' "
            "WHEN {d} < 20 THEN CONCAT(ELT({d} - 10, {s}), ' belas') "
            "ELSE CONCAT(ELT({d} DIV 10, {s}), ' puluh', IF(MOD({d}, 10) = 0, '', CONCAT(' ', ELT(MOD({d}, 10), {s})))) END").format(d=d, s=SAT)
    return "CONCAT_WS(' ', %s, %s)" % (ratus, sisa)


def kata_jumlah(x):
    """Ungkapan SQL: terbilang rupiah (tanpa kata 'rupiah') bilangan pada kolom angka murni x (kolom pendamping xj, xr, xu)."""
    j, r, u = x + 'j', x + 'r', x + 'u'
    return ("CONCAT_WS(' ', IF(%s > 0, CONCAT(%s, ' juta'), NULL), IF(%s = 1, 'seribu', IF(%s > 1, CONCAT(%s, ' ribu'), NULL)), IF(%s > 0, %s, NULL))"
            % (j, kata3(j), r, r, kata3(r), u, kata3(u)))


# L5: kata untuk ketiga angka dihitung SEKALI (kolom wa, wb, wi) lalu dipakai ulang oleh kalimat pertimbangan dan amar.
_L5 = "SELECT a, b, i, kn, dk, " + ", ".join("%s AS w%s" % (kata_jumlah(x), x) for x in 'abi') + " FROM (" + _L4 + ") l4"


ADA_AYAH = "(b <> '' AND b <> '0')"

# ----------------------------------------------------------------------------------------------------------------------------------
# ISIAN KEADAAN
# ----------------------------------------------------------------------------------------------------------------------------------
v(3920, P + 'ALASAN AYAH TIDAK MAMPU - PILIH HURUF: A sakit/cacat/lanjut usia, B tidak bekerja, C penghasilan kurang, D dipenjara, E tidak diketahui tempatnya, F sebab lain (boleh beberapa)', 'data_teks')
v(3921, P + 'FAKTA KEADAAN AYAH - ISIAN kalimat sesudah kata "Bahwa" (penyakit/pekerjaan/penghasilan/pemenjaraan Tergugat, sejak kapan, dan sejauh mana ia dapat memenuhi kewajibannya)', 'data_teks')
v(3922, P + 'FAKTA KEMAMPUAN IBU - ISIAN kalimat sesudah kata "Bahwa" (pekerjaan dan penghasilan Penggugat setiap bulan yang menjadi dasar ia mampu ikut memikul biaya)', 'data_teks')
v(3933, P + 'FAKTA PENGASUHAN ANAK SAAT INI - ISIAN kalimat sesudah kata "Bahwa" (anak tinggal dan diasuh siapa, sejak kapan, siapa yang selama ini membiayai kebutuhan anak)', 'data_teks')
v(3928, P + 'KEDUDUKAN PENGGUGAT BILA BUKAN IBU KANDUNG - ISIAN, mis. nenek kandung atau kerabat terdekat yang nyata-nyata mengasuh anak; kosong = ibu/ayah kandung menurut SIPP', 'data_teks')
v(3929, P + 'KEDUDUKAN PENGGUGAT TERHADAP ANAK (OTOMATIS: isian 3928; kosong = #9300# yaitu ibu kandung bila Penggugat perempuan di SIPP)', 'data_sql',
  "SELECT IF(c.kd = '', '#9300#', c.kd) AS data FROM (SELECT %s AS kd) c" % _rapi(3928))

# ----------------------------------------------------------------------------------------------------------------------------------
# ISIAN BESARAN (penilaian hakim)
# ----------------------------------------------------------------------------------------------------------------------------------
v(3923, P + 'KEBUTUHAN BIAYA PEMELIHARAAN DAN PENDIDIKAN ANAK SETIAP BULAN - ISIAN angka rupiah, mis. 3000000 atau 3.000.000 (penilaian hakim; kosong = tercetak titik-titik)', 'data_teks')
v(3924, P + 'BAGIAN YANG MASIH DITANGGUNG AYAH SETIAP BULAN - ISIAN angka rupiah (penilaian hakim); kosong atau 0 = ayah tidak dibebani. Bagian ibu = kebutuhan dikurangi bagian ayah', 'data_teks')
v(3931, P + 'KENAIKAN BAGIAN AYAH SETIAP TAHUN - ISIAN (SEMA 3/2015 angka 14: 10% s.d. 20%), mis. 10% (sepuluh persen); kosong = tidak ada kenaikan', 'data_teks')
v(3932, P + 'DASAR PENILAIAN KEBUTUHAN DASAR ANAK DAN STANDAR BIAYA HIDUP MINIMAL SETEMPAT - ISIAN tanpa titik akhir (rincian makan, sekolah, kesehatan, dst.); kosong = tidak dicetak', 'data_teks')

# ----------------------------------------------------------------------------------------------------------------------------------
# TURUNAN ANGKA MURNI
# ----------------------------------------------------------------------------------------------------------------------------------
v(3925, P + 'KEBUTUHAN BIAYA ANAK SETIAP BULAN - ANGKA MURNI (OTOMATIS dari isian 3923, tanpa titik; isian bukan angka atau nol = kosong)', 'data_sql', _dari('a'))
v(3926, P + 'BAGIAN AYAH SETIAP BULAN - ANGKA MURNI (OTOMATIS dari isian 3924, tanpa titik; isian bukan angka = kosong)', 'data_sql', _dari('b'))
v(3927, P + 'BAGIAN IBU SETIAP BULAN - ANGKA MURNI (OTOMATIS: isian 3923 dikurangi isian 3924; kosong bila bagian ayah >= kebutuhan atau angka tidak sah)', 'data_sql', _dari('i'))

# ----------------------------------------------------------------------------------------------------------------------------------
# KUALIFIKASI KETIDAKMAMPUAN AYAH (dari huruf 3920)
# ----------------------------------------------------------------------------------------------------------------------------------
_pilihan = [
    ('A', 'sakit atau cacat atau telah lanjut usia sehingga tidak dapat bekerja'),
    ('B', 'tidak bekerja dan tidak mempunyai penghasilan'),
    ('C', 'penghasilannya tidak mencukupi untuk membiayai kebutuhan anak'),
    ('D', 'sedang menjalani pidana penjara'),
    ('E', 'tidak diketahui keberadaannya'),
    ('F', 'keadaan lain sebagaimana fakta hukum tersebut di atas'),
]
_rangkai = "CONCAT_WS(', ', " + ", ".join("IF(%s, '%s', NULL)" % (pilihan_huruf(3920, h), teks) for h, teks in _pilihan) + ")"
v(3939, P + 'KEADAAN AYAH TIDAK MAMPU (OTOMATIS dari huruf isian 3920; kalimat sesudah kata "karena"; kosong = titik-titik)', 'data_sql',
  "SELECT IF(x.k = '', '........', x.k) AS data FROM (SELECT %s AS k) x" % _rangkai)

# ----------------------------------------------------------------------------------------------------------------------------------
# PERTIMBANGAN DAN AMAR PEMBAGIAN BIAYA (kalimat disusun mesin dari angka isian hakim; tidak ada nilai yang ditebak)
# ----------------------------------------------------------------------------------------------------------------------------------
def rpk(x):
    """'Rp3.000.000,00 (tiga juta rupiah)' atau titik-titik."""
    return "CONCAT('Rp', " + rp(x) + ", ',00 (', IF(%s = '', '........', w%s), ' rupiah)')" % (x, x)


_P1 = ("CONCAT('Menimbang, bahwa dengan menggali fakta kemampuan ekonomi #0047# dan #0046# serta fakta kebutuhan dasar hidup #4407# tersebut sebagaimana Surat Edaran Mahkamah Agung "
       "Nomor 3 Tahun 2018 (Rumusan Hukum Kamar Agama, Hukum Keluarga huruf b)', "
       "IF(dk = '', '', CONCAT(', yaitu ', dk, ', dengan memperhatikan keadilan dan kepatutan serta standar biaya hidup minimal setempat sebagaimana Buku II Tahun 2026')), "
       "', #8554# berpendapat bahwa kebutuhan biaya pemeliharaan dan pendidikan #4407# tersebut patut ditetapkan sebesar ', " + rpk('a') + ", ' setiap bulan;')")
_P2 = ("CONCAT('Menimbang, bahwa berdasarkan Pasal 41 huruf b Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, dengan memperhatikan fakta hukum tersebut di atas mengenai keadaan #0047# "
       "dan mengenai pekerjaan serta penghasilan #0046#, #8554# berpendapat patut dan layak #0046# selaku #3929# ikut memikul biaya pemeliharaan dan pendidikan #4407# tersebut sebesar ', "
       + rpk('i') + ", ' setiap bulan', "
       "IF(" + ADA_AYAH + ", CONCAT(', sedangkan sisanya sebesar ', " + rpk('b') + ", ' setiap bulan tetap menjadi tanggung jawab #0047# sesuai kemampuannya "
       "sebagaimana Pasal 156 huruf d Kompilasi Hukum Islam dan dibayarkan kepada #0046# selaku #3929# sampai #4407# tersebut dewasa atau mampu berdiri sendiri (berumur 21 (dua puluh satu) tahun)'), "
       "', mengingat #0047# dalam kenyataan belum dapat memenuhi kewajibannya sama sekali, namun hal tersebut tidak menghilangkan kewajiban #0047# sebagai #9301# "
       "sebagaimana Pasal 45 ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan'), ';')")
_P3 = ("IF(kn <> '' AND " + ADA_AYAH + ", CONCAT('Menimbang, bahwa berdasarkan Surat Edaran Mahkamah Agung Nomor 3 Tahun 2015 (Rumusan Hukum Kamar Agama angka 14), amar mengenai pembebanan "
       "nafkah anak hendaknya diikuti dengan penambahan 10% sampai dengan 20% per tahun dari jumlah yang ditetapkan; oleh karena itu, untuk mengantisipasi kenaikan kebutuhan hidup #4407# tersebut, "
       "bagian yang menjadi tanggung jawab #0047# ditetapkan bertambah sebesar ', kn, ' setiap tahun;'), NULL)")
v(3934, P + 'PERTIMBANGAN PEMBAGIAN BIAYA ANAK ANTARA IBU DAN AYAH (OTOMATIS dari isian 3923, 3924, 3931, 3932; angka belum diisi = titik-titik; diawali satu baris baru)', 'data_sql',
  _dari("CONCAT('<br>', CONCAT_WS('<br>', " + _P1 + ", " + _P2 + ", " + _P3 + "))", _L5))

_A1 = ("'<br>    - kebutuhan biaya pemeliharaan dan pendidikan #4407# tersebut ditetapkan sebesar ', " + rpk('a') + ", ' setiap bulan;'")
_A2 = ("'<br>    - bagian yang dipikul oleh #0046# selaku #3929# sebesar ', " + rpk('i') + ", ' setiap bulan;'")
_A3 = ("IF(" + ADA_AYAH + ", CONCAT('<br>    - bagian yang menjadi tanggung jawab #0047# sebesar ', " + rpk('b') + ", ' setiap bulan', "
       "IF(kn = '', '', CONCAT(', dengan kenaikan sebesar ', kn, ' setiap tahun')), "
       "', dan menghukum #0047# untuk membayar bagian tersebut kepada #0046# selaku #3929# setiap bulan sampai #4407# tersebut dewasa atau mampu berdiri sendiri (berumur 21 (dua puluh satu) tahun);'), "
       "'<br>    - #0047# tidak dibebani membayar bagian apa pun untuk saat ini, dengan tidak menghilangkan kewajiban #0047# sebagai #9301# sebagaimana Pasal 45 ayat (2) "
       "Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan;')")
v(3935, P + 'AMAR PEMBAGIAN BIAYA ANAK ANTARA IBU DAN AYAH (OTOMATIS dari isian 3923, 3924, 3931; angka belum diisi = titik-titik; butir rinci di bawah amar penetapan)', 'data_sql',
  _dari("CONCAT(" + _A1 + ", " + _A2 + ", " + _A3 + ")", _L5))

# ----------------------------------------------------------------------------------------------------------------------------------
# PUTUSAN LAIN
# ----------------------------------------------------------------------------------------------------------------------------------
v(3936, P + 'ALASAN DITOLAK - ISIAN kalimat sesudah kata "Menimbang, bahwa" (mengapa ketidakmampuan ayah atau kemampuan/pembagian biaya tidak terbukti)', 'data_teks')
v(3937, P + 'CACAT FORMIL GUGATAN (NO) - ISIAN satu kalimat tanpa titik akhir, mis. gugatan kabur karena tidak menyebut kebutuhan biaya anak, bagian yang dipikul ibu dan bagian ayah', 'data_teks')
v(3938, P + 'ALAT BUKTI SURAT #0046# - ISIAN (daftar bukti P.1 dst.; bila dibiarkan, memakai contoh bawaan)', 'data_teks',
  default=('Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama #0098#, NIK #0335# tanggal #8870#, yang dikeluarkan oleh Pemerintah #9277#, Provinsi #9278#, bukti surat tersebut telah diberi meterai cukup, '
           'di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu oleh #4004# diberi tanda P.1;\n'
           'Fotokopi Kutipan Akta Nikah, Nomor #1004# tanggal #1012#, yang dikeluarkan oleh #1005#, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya '
           'yang ternyata sesuai, lalu oleh #4004# diberi tanda P.2;\n'
           'Fotokopi Kutipan Akta Kelahiran anak atas nama ..., Nomor ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya '
           'yang ternyata sesuai, lalu oleh #4004# diberi tanda P.3;\n'
           'Fotokopi Akta Cerai Nomor ... tanggal ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, '
           'lalu oleh #4004# diberi tanda P.4;\n'
           'Surat keterangan mengenai keadaan Tergugat (mis. surat keterangan dokter/rumah sakit atau surat keterangan pemerintah desa/kelurahan) Nomor ... tanggal ..., yang dikeluarkan oleh ..., bukti surat '
           'tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu oleh #4004# diberi tanda P.5;\n'
           'Surat keterangan pekerjaan dan penghasilan Penggugat Nomor ... tanggal ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan '
           'aslinya yang ternyata sesuai, lalu oleh #4004# diberi tanda P.6;'))
