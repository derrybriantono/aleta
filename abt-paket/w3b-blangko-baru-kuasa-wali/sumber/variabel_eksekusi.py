# -*- coding: utf-8 -*-
"""Variabel ABT baru - EKSEKUSI putusan (tahap sesudah putusan berkekuatan hukum tetap), jatah nomor 3940-3969.

Sumber data otomatis: SIPP perkara_eksekusi (baris terbaru per perkara asal), perkara_eksekusi_detil (Pemohon/Termohon Eksekusi, kuasa),
perkara_putusan.tanggal_bht, sys_config (Ketua). ABT bekerja per perkara_id perkara ASAL, jadi semua kueri membaca
perkara_eksekusi WHERE perkara_id = '#perkara_id#' ORDER BY id DESC LIMIT 1.
Hal yang tidak ada di SIPP (objek, saksi, jalannya pelaksanaan, alasan, jam sidang, jangka waktu teguran, penandatangan pengganti) = ISIAN (data_teks).
Tanggal '0000-00-00' dan NULL dikosongkan menjadi titik-titik. Format tanggal "05 Oktober 2026" sama dengan variabel relaas (1072/1073).

Dasar hukum yang dicetak: Pasal 206-218 RBg (naskah D:/aleta-dev/kerja/referensi/_unduhan/hir-rbg-bw/rbg-unnes.txt) dan Pasal 54 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009;
lihat spek/PASAL-eksekusi.md.
"""
from variabel_def import v, isi

P = 'EKSEKUSI: '
BULAN = "'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'"
HARI = "'Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'"
TITIK = "'........'"


def _tgl(x):
    return "CONCAT(LPAD(DAY(%s),2,'0'),' ',ELT(MONTH(%s),%s),' ',YEAR(%s))" % (x, x, BULAN, x)


def _ada(x):
    return "%s > '1900-01-01'" % x


def _tgl_atau_titik(x):
    return "IF(%s, %s, %s)" % (_ada(x), _tgl(x), TITIK)


def _hari_tgl(x):
    return "CONCAT(ELT(WEEKDAY(%s)+1,%s),', ',%s)" % (x, HARI, _tgl(x))


def _eks(kolom):
    """Kolom/ungkapan baris perkara_eksekusi terbaru perkara ini sebagai tabel turunan satu baris `z` kolom `d`."""
    return "(SELECT %s AS d FROM perkara_eksekusi e WHERE e.perkara_id = '#perkara_id#' ORDER BY e.id DESC LIMIT 1)" % kolom


def sql_tanggal(kolom, dengan_hari=False, timpa=True):
    """Tanggal dari perkara_eksekusi (ungkapan `kolom` dengan awalan e.) - 'DD Bulan YYYY' atau 'Hari, DD Bulan YYYY'; belum ada = titik-titik.
    timpa=True: isian 3948 (tanggal penetapan) menimpa."""
    fmt = _hari_tgl('z.d') if dengan_hari else _tgl('z.d')
    inti = "IFNULL((SELECT %s FROM %s z WHERE %s), %s)" % (fmt, _eks(kolom), _ada('z.d'), TITIK)
    if timpa:
        return "SELECT IF(o.t <> '', o.t, %s) AS data FROM (SELECT %s AS t) o" % (inti, isi(3948))
    return "SELECT %s AS data" % inti


_EID = "(SELECT e.id FROM perkara_eksekusi e WHERE e.perkara_id = '#perkara_id#' ORDER BY e.id DESC LIMIT 1)"
_ALAMAT = ("NULLIF(TRIM(IFNULL((SELECT x.alamat FROM perkara_pihak1 x WHERE x.perkara_id = d.perkara_id AND x.pihak_id = d.pihak_id LIMIT 1),"
           "(SELECT y.alamat FROM perkara_pihak2 y WHERE y.perkara_id = d.perkara_id AND y.pihak_id = d.pihak_id LIMIT 1))),'')")


def sql_pihak(status, sebutan):
    """Blok identitas Pemohon (status 1) atau Termohon (status 2) Eksekusi dari perkara_eksekusi_detil.
    Satu orang: nama, alamat, 'selaku <sebutan> (semula Penggugat)'; 2-3 orang: bernomor dengan alamat; lebih dari 3: bernomor tanpa alamat;
    lebih dari 15: tanpa tebal (batas 1024 huruf GROUP_CONCAT). Kuasa dan surat kuasa dicetak bila pihak diwakili."""
    baris = ("CONCAT(IF(d.n0 > 1, CONCAT((SELECT COUNT(*) FROM perkara_eksekusi_detil q WHERE q.eksekusi_id = d.eksekusi_id AND q.status_pihak_id = d.status_pihak_id AND q.id <= d.id), '. '), ''),"
             "IF(d.n0 > 15, TRIM(d.pihak_nama), CONCAT('<strong>', TRIM(d.pihak_nama), '</strong>')),"
             "IF(d.n0 <= 3 AND %s IS NOT NULL, CONCAT(', bertempat kediaman di ', %s), ''))" % (_ALAMAT, _ALAMAT))
    dalam = ("(SELECT d0.*, (SELECT COUNT(*) FROM perkara_eksekusi_detil q WHERE q.eksekusi_id = d0.eksekusi_id AND q.status_pihak_id = d0.status_pihak_id) AS n0 "
             "FROM perkara_eksekusi_detil d0 WHERE d0.eksekusi_id = %s AND d0.status_pihak_id = %d) d" % (_EID, status))
    g = ("(SELECT COUNT(*) AS n, GROUP_CONCAT(%s ORDER BY d.id SEPARATOR ';<br>') AS daftar, "
         "GROUP_CONCAT(DISTINCT d.pihak_asal_text ORDER BY d.pihak_asal SEPARATOR ' dan ') AS asal, "
         "MAX(IF(d.pihak_diwakili = 'Y', TRIM(IFNULL(d.pemohon_nama,'')), '')) AS kuasa, MAX(IFNULL(d.pemohon_nomor_surat,'')) AS sk, MAX(d.pemohon_tanggal_surat) AS sk_tgl "
         "FROM %s) g" % (baris, dalam))
    kuasa = ("IF(g.kuasa <> '', CONCAT(', dalam hal ini diwakili oleh kuasanya ', g.kuasa, "
             "IF(g.sk <> '', CONCAT(', berdasarkan Surat Kuasa Khusus Nomor ', g.sk, IF(%s, CONCAT(' tanggal ', %s), '')), '')), '')" % (_ada('g.sk_tgl'), _tgl('g.sk_tgl')))
    return ("SELECT IFNULL((SELECT CONCAT(g.daftar, IF(g.n > 1, ',<br>selaku para ', ', selaku '), '%s', IF(IFNULL(g.asal,'') <> '', CONCAT(' (semula ', g.asal, ')'), ''), %s, ';') "
            "FROM %s WHERE g.n > 0), %s) AS data" % (sebutan, kuasa, g, TITIK))


# ---------------------------------------------------------------------------------------------------------------------------------
# Data umum dari SIPP
# ---------------------------------------------------------------------------------------------------------------------------------
v(3940, P + 'NOMOR REGISTER EKSEKUSI (OTOMATIS SIPP perkara_eksekusi; dipakai juga sebagai nomor penetapan dan berita acara; belum ada = titik-titik)', 'data_sql',
  "SELECT IFNULL((SELECT NULLIF(TRIM(z.d),'') FROM %s z), %s) AS data" % (_eks('e.nomor_register_eksekusi'), TITIK))
v(3941, P + 'TANGGAL PERMOHONAN EKSEKUSI (OTOMATIS SIPP perkara_eksekusi.permohonan_eksekusi; belum ada = titik-titik)', 'data_sql',
  sql_tanggal('e.permohonan_eksekusi', timpa=False))
v(3942, P + 'PUTUSAN YANG DIEKSEKUSI (OTOMATIS SIPP: nomor dan tanggal putusan tingkat pertama, banding/kasasi/PK bila ada, dan tanggal berkekuatan hukum tetap)', 'data_sql',
  "SELECT IFNULL((SELECT CONCAT('putusan #8008# Nomor ', IFNULL(NULLIF(TRIM(z.no_pn),''), '........'), ' tanggal ', %s,"
  "IF(IFNULL(z.no_bd,'') <> '' AND %s, CONCAT(' jo. putusan Pengadilan Tinggi Agama Nomor ', TRIM(z.no_bd), ' tanggal ', %s), ''),"
  "IF(IFNULL(z.no_ks,'') <> '' AND %s, CONCAT(' jo. putusan Mahkamah Agung Nomor ', TRIM(z.no_ks), ' tanggal ', %s), ''),"
  "IF(IFNULL(z.no_pk,'') <> '' AND %s, CONCAT(' jo. putusan Peninjauan Kembali Mahkamah Agung Nomor ', TRIM(z.no_pk), ' tanggal ', %s), ''),"
  "', yang telah berkekuatan hukum tetap', IF(%s, CONCAT(' (<i>inkracht van gewijsde</i>) sejak tanggal ', %s), '')) "
  "FROM (SELECT e.nomor_perkara_pn AS no_pn, e.putusan_pn AS d_pn, e.nomor_perkara_banding AS no_bd, e.putusan_banding AS d_bd, e.nomor_perkara_kasasi AS no_ks, e.putusan_kasasi AS d_ks, "
  "e.nomor_perkara_pk AS no_pk, e.putusan_pk AS d_pk, (SELECT pu.tanggal_bht FROM perkara_putusan pu WHERE pu.perkara_id = e.perkara_id LIMIT 1) AS bht "
  "FROM perkara_eksekusi e WHERE e.perkara_id = '#perkara_id#' ORDER BY e.id DESC LIMIT 1) z), %s) AS data" % (
      _tgl_atau_titik('z.d_pn'), _ada('z.d_bd'), _tgl('z.d_bd'), _ada('z.d_ks'), _tgl('z.d_ks'), _ada('z.d_pk'), _tgl('z.d_pk'), _ada('z.bht'), _tgl('z.bht'), TITIK))
v(3943, P + 'IDENTITAS PEMOHON EKSEKUSI (OTOMATIS SIPP perkara_eksekusi_detil: nama, alamat bila tiga orang atau kurang, semula Penggugat/Tergugat, kuasa dan surat kuasa; belum ada = titik-titik)',
  'data_sql', sql_pihak(1, 'Pemohon Eksekusi'))
v(3944, P + 'IDENTITAS TERMOHON EKSEKUSI (OTOMATIS SIPP perkara_eksekusi_detil: nama, alamat bila tiga orang atau kurang, semula Penggugat/Tergugat; belum ada = titik-titik)',
  'data_sql', sql_pihak(2, 'Termohon Eksekusi'))
v(3945, P + 'NAMA JURUSITA PELAKSANA (OTOMATIS SIPP perkara_eksekusi.jurusita_nama; kosong atau tanda hubung = titik-titik)', 'data_sql',
  "SELECT IFNULL((SELECT IF(TRIM(z.d) IN ('', '-', 'NULL'), %s, TRIM(z.d)) FROM %s z), %s) AS data" % (TITIK, _eks('e.jurusita_nama'), TITIK))
v(3946, P + 'JABATAN DAN NAMA PENANDATANGAN PENETAPAN (OTOMATIS: Ketua menurut pengaturan satker; isian 3947 bila Wakil Ketua atau Plh. Ketua yang menandatangani)', 'data_sql',
  "SELECT IF(o.t = '', CONCAT('Ketua,<br><br><br><strong>', IFNULL((SELECT c.value FROM sys_config c WHERE c.name = 'KetuaPNNama' LIMIT 1), %s), '</strong>'), "
  "IF(LOCATE(';', o.t) > 0, CONCAT(TRIM(SUBSTRING_INDEX(o.t, ';', 1)), ',<br><br><br><strong>', TRIM(SUBSTRING(o.t, LOCATE(';', o.t) + 1)), '</strong>'), "
  "CONCAT('Ketua,<br><br><br><strong>', o.t, '</strong>'))) AS data FROM (SELECT %s AS t) o" % (TITIK, isi(3947)))
v(3947, P + 'PENANDATANGAN PENETAPAN - ISIAN OPSIONAL "Jabatan; Nama lengkap dengan gelar" (mis. Wakil Ketua; Nama, S.H.I., M.H.); kosong = Ketua Pengadilan menurut pengaturan satker', 'data_teks')
v(3948, P + 'TANGGAL PENETAPAN - ISIAN OPSIONAL (mis. 21 Oktober 2026; menimpa tanggal SIPP pada semua penetapan eksekusi; kosong = tanggal dari SIPP)', 'data_teks')

# ---------------------------------------------------------------------------------------------------------------------------------
# Tanggal penetapan (Ketua) per jenis penetapan
# ---------------------------------------------------------------------------------------------------------------------------------
v(3949, P + 'TANGGAL PENETAPAN TEGURAN/AANMANING (OTOMATIS SIPP penetapan_teguran_eksekusi; isian 3948 menimpa; belum ada = titik-titik)', 'data_sql', sql_tanggal('e.penetapan_teguran_eksekusi'))
v(3950, P + 'TANGGAL PENETAPAN SITA EKSEKUSI (OTOMATIS SIPP penetapan_sita_eksekusi; isian 3948 menimpa; belum ada = titik-titik)', 'data_sql', sql_tanggal('e.penetapan_sita_eksekusi'))
v(3951, P + 'TANGGAL PENETAPAN PERINTAH EKSEKUSI RIIL (OTOMATIS SIPP penetapan_perintah_eksekusi_rill; isian 3948 menimpa; belum ada = titik-titik)', 'data_sql',
  sql_tanggal('e.penetapan_perintah_eksekusi_rill'))
v(3952, P + 'TANGGAL PENETAPAN PERINTAH PENJUALAN LELANG (OTOMATIS SIPP penetapan_perintah_eksekusi_lelang; isian 3948 menimpa; belum ada = titik-titik)', 'data_sql',
  sql_tanggal('e.penetapan_perintah_eksekusi_lelang'))
v(3953, P + 'TANGGAL PENETAPAN NON-EKSEKUTABEL (OTOMATIS SIPP penetapan_noneksekusi; isian 3948 menimpa; belum ada = titik-titik)', 'data_sql', sql_tanggal('e.penetapan_noneksekusi'))
v(3954, P + 'TANGGAL PENETAPAN KONSTATERING (OTOMATIS SIPP konstatering_tanggal_penetapan; isian 3948 menimpa; belum ada = titik-titik)', 'data_sql',
  sql_tanggal('e.konstatering_tanggal_penetapan'))
v(3955, P + 'TANGGAL PENETAPAN PENCABUTAN PERMOHONAN EKSEKUSI (OTOMATIS SIPP tanggal_cabut_eks; isian 3948 menimpa; belum ada = titik-titik)', 'data_sql', sql_tanggal('e.tanggal_cabut_eks'))
v(3956, P + 'TANGGAL PENETAPAN EKSEKUSI DILAKSANAKAN SUKARELA (isian 3948; SIPP tidak memiliki kolom khusus; belum diisi = titik-titik)', 'data_sql',
  "SELECT IF(%s <> '', %s, %s) AS data" % (isi(3948), isi(3948), TITIK))

# ---------------------------------------------------------------------------------------------------------------------------------
# Hari dan tanggal pelaksanaan (untuk berita acara dan perintah)
# ---------------------------------------------------------------------------------------------------------------------------------
v(3957, P + 'HARI DAN TANGGAL SIDANG TEGURAN/AANMANING (OTOMATIS SIPP pelaksanaan_teguran_eksekusi, teguran kedua bila ada; belum ada = titik-titik)', 'data_sql',
  sql_tanggal("IF(e.pelaksanaan_teguran_eksekusi_kedua > '1900-01-01', e.pelaksanaan_teguran_eksekusi_kedua, e.pelaksanaan_teguran_eksekusi)", dengan_hari=True, timpa=False))
v(3958, P + 'HARI DAN TANGGAL PELAKSANAAN SITA EKSEKUSI (OTOMATIS SIPP pelaksanaan_sita_eksekusi; belum ada = titik-titik)', 'data_sql',
  sql_tanggal('e.pelaksanaan_sita_eksekusi', dengan_hari=True, timpa=False))
v(3959, P + 'HARI DAN TANGGAL PELAKSANAAN KONSTATERING (OTOMATIS SIPP konstatering_pelaksanaan; belum ada = titik-titik)', 'data_sql',
  sql_tanggal('e.konstatering_pelaksanaan', dengan_hari=True, timpa=False))
v(3960, P + 'HARI DAN TANGGAL PELAKSANAAN EKSEKUSI RIIL (OTOMATIS SIPP pelaksanaan_eksekusi_rill; belum ada = titik-titik)', 'data_sql',
  sql_tanggal('e.pelaksanaan_eksekusi_rill', dengan_hari=True, timpa=False))
v(3961, P + 'HARI DAN TANGGAL PENYERAHAN HASIL LELANG (OTOMATIS SIPP penyerahan_hasil_lelang; belum ada = titik-titik)', 'data_sql',
  sql_tanggal('e.penyerahan_hasil_lelang', dengan_hari=True, timpa=False))

# ---------------------------------------------------------------------------------------------------------------------------------
# Isian (tidak ada di SIPP)
# ---------------------------------------------------------------------------------------------------------------------------------
v(3962, P + 'JAM SIDANG TEGURAN/AANMANING - ISIAN (mis. 09.00 WITA)', 'data_teks', default='........ WITA')
v(3963, P + 'JANGKA WAKTU TEGURAN - ISIAN (paling lama 8 (delapan) hari menurut Pasal 207 ayat (2) RBg; bawaan 8 (delapan) hari)', 'data_teks', default='8 (delapan) hari')
v(3964, P + 'OBJEK EKSEKUSI - ISIAN (uraikan sesuai amar putusan: jenis, letak/alamat, luas, batas-batas, atau jumlah uang; satu objek per butir bernomor)', 'data_teks',
  default='1. ........ (jenis dan letak objek, luas, serta batas-batas: sebelah utara ........, timur ........, selatan ........, barat ........);')
v(3965, P + 'SAKSI PELAKSANAAN - ISIAN (dua orang saksi: nama, umur, pekerjaan, tempat tinggal; dipakai pada berita acara konstatering dan eksekusi riil)', 'data_teks',
  default='1. ........ (nama, umur, pekerjaan, dan tempat tinggal);<br>2. ........ (nama, umur, pekerjaan, dan tempat tinggal);')
v(3966, P + 'SAKSI SITA EKSEKUSI (OTOMATIS: isian 3965; bila kosong SIPP sita_saksi1-3; belum ada = titik-titik; Pasal 210 ayat (1) RBg: dua orang saksi)', 'data_sql',
  "SELECT IF(o.t <> '', o.t, IF(z.r <> '', z.r, '1. ........ (nama, pekerjaan, dan tempat tinggal);<br>2. ........ (nama, pekerjaan, dan tempat tinggal);')) AS data "
  "FROM (SELECT %s AS t) o, (SELECT IFNULL((SELECT CONCAT_WS('<br>', IF(NULLIF(TRIM(e.sita_saksi1),'') IS NULL, NULL, CONCAT('1. ', TRIM(e.sita_saksi1), ';')), "
  "IF(NULLIF(TRIM(e.sita_saksi2),'') IS NULL, NULL, CONCAT('2. ', TRIM(e.sita_saksi2), ';')), IF(NULLIF(TRIM(e.sita_saksi3),'') IS NULL, NULL, CONCAT('3. ', TRIM(e.sita_saksi3), ';'))) "
  "FROM perkara_eksekusi e WHERE e.perkara_id = '#perkara_id#' ORDER BY e.id DESC LIMIT 1), '') AS r) z" % isi(3965))
v(3967, P + 'URAIAN HASIL PELAKSANAAN - ISIAN (yang hadir, jalannya, pernyataan para pihak, hasil; lelang: kantor lelang, risalah, pemenang, harga, pembagian; sukarela: bentuk dan waktu)', 'data_teks',
  default='........')
v(3968, P + 'ALASAN - ISIAN (non-eksekutabel: sebab putusan tidak dapat dilaksanakan; pencabutan: alasan Pemohon mencabut; eksekusi riil tidak berhasil atau ditunda: sebabnya)', 'data_teks',
  default='........')
v(3969, P + 'PERNYATAAN TERMOHON EKSEKUSI - ISIAN (sebutkan nama Termohon yang hadir pada sidang teguran dan pernyataannya: kesediaan, keberatan, waktu yang diminta)', 'data_teks',
  default='........')
