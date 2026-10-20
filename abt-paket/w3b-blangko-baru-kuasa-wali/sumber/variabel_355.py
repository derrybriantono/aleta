# -*- coding: utf-8 -*-
"""Variabel ABT baru - PENCABUTAN KEKUASAAN WALI (jenis SIPP 355), jatah 3830-3859.

Dasar hukum yang dicetak (terverifikasi dengan naskah di D:/aleta-dev/kerja/referensi/_unduhan; lihat spek/PASAL-355.md):
  Pasal 50, 51, 53 UU 1/1974 (naskah BPK), Pasal 49 ayat (1) UU 1/1974 (dirujuk Pasal 53 ayat (1)); Pasal 107 ayat (3), Pasal 109, Pasal 110 KHI;
  Pasal 3-7, 12, 14, 17, 18, 19 PP 29/2019; Pasal 33 UU 23/2002 sebagaimana diubah UU 35/2014; Pasal 49 huruf a dan penjelasan angka 16-17 UU 7/1989.

Huruf alasan (isian 3834, boleh lebih dari satu; dasar hukum dan bunyi norma terbentuk OTOMATIS dari huruf):
  A melalaikan kewajiban sebagai wali           (UU 1/1974 Pasal 49 ayat (1) huruf a via Pasal 53 ayat (1); KHI Pasal 109; PP 29/2019 Pasal 17 ayat (2) huruf a)
  B berkelakuan buruk sekali                    (UU 1/1974 Pasal 49 ayat (1) huruf b via Pasal 53 ayat (1))
  C pemabuk, penjudi, pemboros, atau gila       (KHI Pasal 109)
  D menyalahgunakan hak dan wewenang sebagai wali (KHI Pasal 109; PP 29/2019 Pasal 17 ayat (2) huruf c)
  E melakukan tindak kekerasan terhadap anak    (PP 29/2019 Pasal 17 ayat (2) huruf d)
  F orang tua dianggap telah mampu melaksanakan kewajiban (PP 29/2019 Pasal 17 ayat (2) huruf e dan Pasal 18)
  G tidak cakap melakukan perbuatan hukum       (PP 29/2019 Pasal 17 ayat (2) huruf b)

Kueri berantai (tahap demi tahap lewat tabel turunan) supaya isian huruf dibaca satu kali dan tiap potongan kalimat hanya ditulis sekali.
Pemisah butir daftar sementara = tanda tilde; kueri mengubahnya menjadi "a, b dan c".
"""
from variabel_def import v, isi

P = 'KEKUASAAN WALI: '
T = "'~'"   # pemisah sementara butir daftar

WALI = "IF(%s <> '', %s, '#0047#')" % (isi(3852), isi(3852))   # wali yang dicabut: isian (permohonan) atau sebutan Tergugat (gugatan)


def _gabung(x, akhir=' dan ', tengah=', '):
    """Ungkapan SQL: daftar x berpemisah '~' -> 'a, b dan c' (satu butir tetap apa adanya)."""
    return ("IF(LOCATE('~', {x}) = 0, {x}, CONCAT(REPLACE(SUBSTRING_INDEX({x}, '~', CHAR_LENGTH({x}) - CHAR_LENGTH(REPLACE({x}, '~', ''))), '~', '{t}'), "
            "'{a}', SUBSTRING_INDEX({x}, '~', -1)))").format(x=x, a=akhir, t=tengah)


def _rantai(tahap, akhir):
    """tahap = [[(nama, ungkapan), ...], ...]; tahap pertama memakai h (= huruf isian 3834 besar semua) dan penanda fa..fg (huruf A..G dipilih).
    Tiap tahap meneruskan semua kolom tahap sebelumnya; LIMIT 1 memaksa tiap tabel turunan dimaterialisasi (MariaDB 5.5 menggabungkan tabel turunan
    dan menghitung ulang ungkapan bersarang dengan hasil keliru). Hasil: SELECT <akhir> AS data FROM (...) fin."""
    dasar = [('h', 'UPPER(%s)' % isi(3834))]
    # huruf dikenali bila berdiri sendiri (tanda baca, spasi, atau awal/akhir isian) atau bila seluruh isian hanya huruf A-G rapat (mis. AD);
    # kata utuh seperti "Salah Urus" tidak boleh cocok sembarang
    bendera = [('f' + k.lower(), "((h REGEXP '(^|[^A-Z])%s([^A-Z]|$)') OR (h REGEXP '^[A-G]+$' AND LOCATE('%s', h) > 0))" % (k, k)) for k in 'ABCDEFG']
    inner = 'SELECT ' + ', '.join('%s AS %s' % (e, n) for n, e in dasar) + ' LIMIT 1'
    for i, kolom in enumerate([bendera] + tahap):
        inner = 'SELECT s%d.*, %s FROM (%s) s%d LIMIT 1' % (i, ', '.join('%s AS %s' % (e, n) for n, e in kolom), inner, i)
    return 'SELECT %s AS data FROM (%s) fin' % (akhir, inner)


KOSONG = "'........'"

# ---------------------------------------------------------------------------------------------------------------------------------
# kedudukan para pihak
# ---------------------------------------------------------------------------------------------------------------------------------
v(3830, P + 'HUBUNGAN #0046# DENGAN ANAK - ISIAN (mis. ibu kandung, ayah kandung, nenek, kakek, paman, kakak kandung yang telah dewasa, Dinas Sosial, calon wali pengganti)',
  'data_teks')
v(3831, P + 'KEDUDUKAN #0046# TERHADAP ANAK (OTOMATIS: isian 3830; kosong = titik-titik karena hubungan tidak dapat ditebak dari SIPP)', 'data_sql',
  "SELECT IF(%s <> '', %s, %s) AS data" % (isi(3830), isi(3830), KOSONG))
v(3832, P + 'DASAR PENUNJUKAN WALI YANG DIMOHONKAN DICABUT - ISIAN (mis. Penetapan Pengadilan Agama ... Nomor ... tanggal ...; atau wasiat orang tua anak; kosong = tidak disebut)', 'data_teks')
v(3833, P + 'KALIMAT DASAR KEWALIAN (OTOMATIS: hanya bila isian 3832 terisi, berbunyi ", yang menjadi wali berdasarkan ...")', 'data_sql',
  "SELECT IF(%s <> '', CONCAT(', yang menjadi wali berdasarkan ', %s), '') AS data" % (isi(3832), isi(3832)))

# ---------------------------------------------------------------------------------------------------------------------------------
# alasan pencabutan (huruf A-G) -> dasar hukum, bunyi norma, kualifikasi
# ---------------------------------------------------------------------------------------------------------------------------------
v(3834, P + 'ALASAN PENCABUTAN - HURUF, bisa lebih dari satu (mis. A, D): A lalai; B buruk; C pemabuk/penjudi/pemboros/gila; D salah guna wewenang; E kekerasan; F orang tua mampu; G tidak cakap',
  'data_teks')

_GAB_DASAR = _gabung('raw')
v(3835, P + 'DASAR HUKUM ALASAN PENCABUTAN (OTOMATIS dari huruf isian 3834: UU 1/1974 Pasal 53 ayat (1) jo. Pasal 49 ayat (1), KHI Pasal 109, PP 29/2019 Pasal 17 ayat (2) dan Pasal 18)',
  'data_sql',
  _rantai([
      [('uu', "IF(fa OR fb, CONCAT('Pasal 53 ayat (1) jo. Pasal 49 ayat (1) ', CASE WHEN fa AND fb THEN 'huruf a dan huruf b' WHEN fa THEN 'huruf a' ELSE 'huruf b' END, "
              "' Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan'), NULL)"),
       ('khi', "IF(fa OR fc OR fd, 'Pasal 109 Kompilasi Hukum Islam', NULL)"),
       ('ppl', "CONCAT_WS('~', IF(fa, 'a', NULL), IF(fg, 'b', NULL), IF(fd, 'c', NULL), IF(fe, 'd', NULL), IF(ff, 'e', NULL))")],
      [('ppt', "IF(ppl = '', NULL, CONCAT('Pasal 17 ayat (2) huruf ', " + _gabung('ppl') + ", IF(ff, ' serta Pasal 18 ayat (1) dan ayat (2)', ''), "
               "' Peraturan Pemerintah Nomor 29 Tahun 2019 tentang Syarat dan Tata Cara Penunjukan Wali'))")],
      [('raw', "CONCAT_WS('~', uu, khi, ppt)")]],
      "IF(raw = '', %s, %s)" % (KOSONG, _GAB_DASAR)))

v(3836, P + 'BUNYI NORMA ALASAN PENCABUTAN (OTOMATIS dari huruf isian 3834: bunyi UU 1/1974, KHI dan PP 29/2019 yang sesuai huruf terpilih)', 'data_sql',
  _rantai([
      [('nuu', "IF(fa OR fb, CONCAT('wali dapat dicabut dari kekuasaannya dalam hal ', CASE WHEN fa AND fb THEN 'ia sangat melalaikan kewajibannya terhadap anaknya dan berkelakuan buruk sekali' "
               "WHEN fa THEN 'ia sangat melalaikan kewajibannya terhadap anaknya' ELSE 'ia berkelakuan buruk sekali' END), NULL)"),
       ('khx', "CONCAT_WS('~', IF(fc, 'pemabuk, penjudi, pemboros, atau gila', NULL), CASE WHEN fa AND fd THEN 'melalaikan atau menyalahgunakan hak dan wewenangnya sebagai wali' "
               "WHEN fa THEN 'melalaikan hak dan wewenangnya sebagai wali' WHEN fd THEN 'menyalahgunakan hak dan wewenangnya sebagai wali' ELSE NULL END)"),
       ('ppx', "CONCAT_WS('~', IF(fa, 'wali melalaikan kewajiban sebagai wali', NULL), IF(fg, 'wali tidak cakap melakukan perbuatan hukum', NULL), "
               "IF(fd, 'wali menyalahgunakan kewenangan sebagai wali', NULL), IF(fe, 'wali melakukan tindak kekerasan terhadap anak yang ada dalam pengasuhannya', NULL), "
               "IF(ff, 'orang tua dianggap telah mampu untuk melaksanakan kewajiban', NULL))")],
      [('nkhi', "IF(khx = '', NULL, CONCAT('Pengadilan Agama dapat mencabut hak perwalian seseorang atau badan hukum dan memindahkannya kepada pihak lain atas permohonan kerabat bila wali tersebut ', "
                + _gabung('khx', ' dan/atau ') + ", IF(fa OR fd, ' demi kepentingan orang yang berada di bawah perwaliannya', '')))"),
       ('npp', "IF(ppx = '', NULL, CONCAT('wali dapat berakhir karena kekuasaannya dicabut berdasarkan penetapan atau putusan Pengadilan dikarenakan ', " + _gabung('ppx', ' dan/atau ') +
               ", IF(ff, ', dengan penilaian terhadap kemampuan orang tua dilakukan berdasarkan rekomendasi dinas yang menyelenggarakan urusan pemerintahan di bidang sosial kabupaten/kota setempat "
               "yang dibuat berdasarkan hasil asesmen pekerja sosial profesional', '')))")],
      [('raw', "CONCAT_WS('~', nuu, nkhi, npp)")]],
      "IF(raw = '', %s, %s)" % (KOSONG, _gabung('raw', '; serta ', '; '))))

v(3837, P + 'KUALIFIKASI KEADAAN YANG TERBUKTI (OTOMATIS dari huruf isian 3834; huruf C memakai isian 3857)', 'data_sql',
  _rantai([
      [('wl', "CONCAT_WS('~', IF(fa, 'melalaikan kewajibannya sebagai wali', NULL), IF(fb, 'berkelakuan buruk sekali', NULL), "
              "IF(fc, CONCAT('bersifat ', IF(" + isi(3857) + " <> '', " + isi(3857) + ", " + KOSONG + ")), NULL), IF(fd, 'menyalahgunakan hak dan wewenangnya sebagai wali', NULL), "
              "IF(fe, 'melakukan tindak kekerasan terhadap anak yang berada dalam pengasuhannya', NULL), IF(fg, 'tidak cakap melakukan perbuatan hukum', NULL))")],
      [('hasil', "CONCAT_WS(' serta ', IF(wl = '', NULL, CONCAT('wali tersebut ', " + _gabung('wl') + ")), IF(ff, 'orang tua anak tersebut telah dianggap mampu melaksanakan kewajibannya', NULL))")]],
      "IF(hasil = '', %s, hasil)" % KOSONG))

v(3838, P + 'FAKTA YANG TERBUKTI - ISIAN kalimat sesudah kata "Bahwa" (perbuatan atau keadaan wali: apa yang dilalaikan atau disalahgunakan, sejak kapan, akibatnya bagi anak dan hartanya)', 'data_teks')
v(3839, P + 'JANGKA WAKTU PENCABUTAN - ISIAN OPSIONAL (mis. sampai anak berumur 18 (delapan belas) tahun; kosong = tanpa batas waktu dalam amar)', 'data_teks')
v(3840, P + 'KALIMAT JANGKA WAKTU (OTOMATIS: hanya bila isian 3839 terisi, berbunyi " untuk waktu ...")', 'data_sql',
  "SELECT IF(%s <> '', CONCAT(' untuk waktu ', %s), '') AS data" % (isi(3839), isi(3839)))

# ---------------------------------------------------------------------------------------------------------------------------------
# sesudah pencabutan: wali pengganti / pengembalian kuasa asuh / rekomendasi dinas sosial / harta anak
# ---------------------------------------------------------------------------------------------------------------------------------
v(3841, P + 'WALI PENGGANTI YANG DITUNJUK - ISIAN OPSIONAL (nama lengkap bin/binti ... dan hubungannya dengan anak; kosong = tidak ada penunjukan wali pengganti dalam putusan ini)', 'data_teks')
v(3842, P + 'PENGEMBALIAN KUASA ASUH KEPADA ORANG TUA - ISIAN OPSIONAL (nama dan kedudukan orang tua, mis. ibu kandung bernama ...; kosong = tidak ada pengembalian; PP 29/2019 Pasal 19 ayat (3))', 'data_teks')
v(3843, P + 'PERTIMBANGAN WALI PENGGANTI (OTOMATIS: hanya bila isian 3841 terisi; Pasal 53 ayat (2) UU 1/1974, Pasal 19 PP 29/2019, Pasal 33 UU 35/2014; diawali satu baris baru)', 'data_sql',
  "SELECT IF(%s <> '', CONCAT('<br>Menimbang, bahwa oleh karena kekuasaan wali atas #4407# tersebut dicabut, sedangkan Pasal 53 ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan "
  "menentukan bahwa dalam hal kekuasaan seorang wali dicabut oleh Pengadilan ditunjuk orang lain sebagai wali, yang menurut penjelasan Pasal 49 huruf a angka 17 Undang-Undang Nomor 7 Tahun 1989 "
  "tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009 termasuk bidang perkawinan, serta "
  "Pasal 33 ayat (1) dan ayat (2) Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak sebagaimana telah diubah dengan Undang-Undang Nomor 35 Tahun 2014 dan Pasal 19 ayat (3) dan ayat (4) "
  "Peraturan Pemerintah Nomor 29 Tahun 2019 tentang Syarat dan Tata Cara Penunjukan Wali menentukan bahwa penunjukan wali dilakukan melalui penetapan pengadilan dan Pengadilan dapat menetapkan wali pengganti, "
  "maka #8554# menilai bahwa ', %s, ' telah memenuhi syarat sebagai wali menurut Pasal 51 ayat (2) Undang-Undang Nomor 1 Tahun 1974 dan Pasal 3 sampai dengan Pasal 7 Peraturan Pemerintah tersebut "
  "berdasarkan keterangan saksi-saksi dan alat bukti yang diajukan, sehingga patut ditunjuk sebagai wali pengganti bagi #4407# tersebut demi kepentingan terbaik anak;'), '') AS data" % (isi(3841), isi(3841)))
v(3844, P + 'PERTIMBANGAN PENGEMBALIAN KUASA ASUH (OTOMATIS: hanya bila isian 3842 terisi; Pasal 19 ayat (3) PP 29/2019; diawali satu baris baru)', 'data_sql',
  "SELECT IF(%s <> '', CONCAT('<br>Menimbang, bahwa Pasal 19 ayat (3) Peraturan Pemerintah Nomor 29 Tahun 2019 tentang Syarat dan Tata Cara Penunjukan Wali menentukan bahwa dalam hal permohonan "
  "pencabutan diajukan oleh orang tua, Pengadilan dapat menetapkan pengembalian kuasa asuh kepada orang tua atau menetapkan wali pengganti; berdasarkan keterangan saksi-saksi dan alat bukti yang diajukan, "
  "#8554# menilai bahwa ', %s, ' telah mampu melaksanakan kewajiban dan tanggung jawabnya sebagai orang tua terhadap #4407# tersebut, sehingga kuasa asuh atas #4407# tersebut patut dikembalikan "
  "kepada orang tua tersebut demi kepentingan terbaik anak;'), '') AS data" % (isi(3842), isi(3842)))
v(3845, P + 'AMAR WALI PENGGANTI (OTOMATIS: hanya bila isian 3841 terisi; satu butir rinci di bawah amar pencabutan)', 'data_sql',
  "SELECT IF(%s <> '', CONCAT(';<br>    - menunjuk ', %s, ' sebagai wali pengganti bagi #4407# tersebut yang berkewajiban mengurus diri dan harta #4407# tersebut dengan sebaik-baiknya sesuai "
  "peraturan perundang-undangan'), '') AS data" % (isi(3841), isi(3841)))
v(3846, P + 'AMAR PENGEMBALIAN KUASA ASUH (OTOMATIS: hanya bila isian 3842 terisi; satu butir rinci di bawah amar pencabutan)', 'data_sql',
  "SELECT IF(%s <> '', CONCAT(';<br>    - mengembalikan kuasa asuh atas #4407# tersebut kepada ', %s), '') AS data" % (isi(3842), isi(3842)))
v(3847, P + 'REKOMENDASI DINAS SOSIAL - ISIAN OPSIONAL (nomor, tanggal, dan kesimpulan asesmen pekerja sosial profesional; PP 29/2019 Pasal 12 dan Pasal 18; kosong = tidak ada rekomendasi)', 'data_teks')
v(3848, P + 'PERTIMBANGAN REKOMENDASI DINAS SOSIAL (OTOMATIS: hanya bila isian 3847 terisi; diawali satu baris baru)', 'data_sql',
  "SELECT IF(%s <> '', CONCAT('<br>Menimbang, bahwa Pasal 12 ayat (1) dan Pasal 18 Peraturan Pemerintah Nomor 29 Tahun 2019 tentang Syarat dan Tata Cara Penunjukan Wali menentukan bahwa rekomendasi dinas "
  "yang menyelenggarakan urusan pemerintahan di bidang sosial kabupaten/kota setempat yang dibuat berdasarkan hasil asesmen pekerja sosial profesional menjadi bahan pertimbangan dalam penetapan wali atau "
  "pencabutan kuasa asuh; dalam perkara ini diajukan rekomendasi berupa ', %s, ', yang #8554# pertimbangkan bersama-sama dengan alat bukti lainnya;'), '') AS data" % (isi(3847), isi(3847)))
v(3849, P + 'HARTA ANAK YANG DIKELOLA WALI - ISIAN OPSIONAL (uraian harta anak dalam pengelolaan wali, mis. uang santunan ...; kosong = tidak dipersoalkan)', 'data_teks')
v(3850, P + 'PERTIMBANGAN HARTA ANAK (OTOMATIS: hanya bila isian 3849 terisi; Pasal 50 ayat (2) dan Pasal 51 ayat (5) UU 1/1974, Pasal 110 KHI; diawali satu baris baru)', 'data_sql',
  "SELECT IF(%s <> '', CONCAT('<br>Menimbang, bahwa Pasal 50 ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa perwalian itu mengenai pribadi anak maupun harta bendanya, "
  "Pasal 51 ayat (5) Undang-Undang yang sama menentukan bahwa wali bertanggung jawab tentang harta benda anak yang berada di bawah perwaliannya serta kerugian yang ditimbulkan karena kesalahan atau "
  "kelalaiannya, dan Pasal 110 ayat (3) dan ayat (4) Kompilasi Hukum Islam menentukan bahwa wali bertanggung jawab terhadap harta orang yang berada di bawah perwaliannya dan pertanggungjawaban itu "
  "harus dibuktikan dengan pembukuan yang ditutup tiap satu tahun sekali; oleh karena dalam perkara ini diketahui bahwa harta anak berupa ', %s, ' berada dalam pengelolaan wali, maka dengan dicabutnya "
  "kekuasaan wali tersebut patut wali diwajibkan menyerahkan harta tersebut beserta pertanggungjawaban pengelolaannya kepada pihak yang berhak mengurusnya;'), '') AS data" % (isi(3849), isi(3849)))
v(3851, P + 'AMAR PENYERAHAN HARTA ANAK (OTOMATIS: hanya bila isian 3849 terisi; penerima = wali pengganti 3841, atau orang tua 3842, atau pihak yang berhak)', 'data_sql',
  "SELECT IF(%s <> '', CONCAT(';<br>    - mewajibkan ', %s, ' untuk menyerahkan harta #4407# tersebut berupa ', %s, ' beserta pertanggungjawaban pengelolaannya berupa pembukuan kepada ', "
  "IF(%s <> '', CONCAT(%s, ' selaku wali pengganti'), IF(%s <> '', %s, 'pihak yang berhak mengurus harta anak tersebut sesuai ketentuan peraturan perundang-undangan'))), '') AS data" % (
      isi(3849), WALI, isi(3849), isi(3841), isi(3841), isi(3842), isi(3842)))

# ---------------------------------------------------------------------------------------------------------------------------------
# permohonan, bukti, penolakan, tidak dapat diterima
# ---------------------------------------------------------------------------------------------------------------------------------
v(3852, P + 'WALI YANG DIMOHONKAN DICABUT - ISIAN pada permohonan Pdt.P (nama lengkap bin/binti dan hubungannya dengan anak, mis. paman kandung anak bernama Fulan bin Fulan); pada gugatan kosongkan', 'data_teks')
v(3853, P + 'WALI YANG DICABUT (OTOMATIS: isian 3852 pada permohonan; pada gugatan memakai sebutan Tergugat)', 'data_sql',
  "SELECT %s AS data" % WALI)
v(3854, P + 'ALAT BUKTI SURAT #0046# - ISIAN (daftar bukti P.1 dst.; bila dibiarkan, memakai contoh bawaan)', 'data_teks',
  default=('1. Fotokopi Kartu Tanda Penduduk atas nama #0098#, NIK ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.1;<br>'
           '2. Fotokopi Kartu Keluarga Nomor ... atas nama ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.2;<br>'
           '3. Fotokopi Kutipan Akta Kelahiran anak atas nama ..., Nomor ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.3;<br>'
           '4. Fotokopi Penetapan Pengadilan Agama ... Nomor ... tanggal ... tentang penunjukan wali bagi anak tersebut, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.4;<br>'
           '5. ...'))
v(3855, P + 'ALASAN DITOLAK - ISIAN kalimat sesudah kata "Menimbang, bahwa" (mengapa alasan pencabutan kekuasaan wali tidak terbukti atau tidak sampai tingkat yang dimaksud ketentuan pencabutan)', 'data_teks')
v(3856, P + 'SEBAB TIDAK DAPAT DITERIMA - ISIAN kalimat sesudah kata "Menimbang, bahwa" (mis. Penggugat bukan pihak yang berhak mengajukan, atau gugatan kabur)', 'data_teks')
v(3857, P + 'SIFAT WALI YANG TERBUKTI (huruf C) - ISIAN OPSIONAL tulis yang terbukti saja (mis. penjudi dan pemabuk; pemabuk, penjudi, pemboros, gila menurut KHI Pasal 109); kosong = titik-titik', 'data_teks')
