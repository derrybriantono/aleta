# -*- coding: utf-8 -*-
"""Definisi isi paket x2-perbaikan-audit-sedang-21okt (temuan SEDANG S1-S10 audit variabel ABT 21 Okt 2026).
Semua teks ASCII. BARU = nomor yang belum ada di server; UBAH = baris yang ada dan diubah (isi lama dijaga sidik jari seluruh barisnya).
Keadaan dasar = server pagi 21 Okt + paket x1 (abt_variabel 2.421 baris)."""

MODIFIER = 'admin'          # sama dengan paket x1 (tidak memuat kata "Aleta")
MODIFIED = '2026-10-21 00:00:00'

BARU = []   # dict(no, nama, tipe, sql, default, tabel, kolom, urutan, ref, butir)


def tambah(no, nama, tipe, sql=None, default=None, tabel=None, kolom=None, urutan=None, ref=None, butir=''):
    BARU.append(dict(no=no, nama=nama, tipe=tipe, sql=sql, default=default, tabel=tabel, kolom=kolom, urutan=urutan, ref=ref, butir=butir))


# ---------------------------------------------------------------- UBAH: baris yang sudah ada
# no -> dict(ubah=fungsi(dict baris lama) -> dict kolom yang berubah {kolom: nilai bytes|str|None}, butir)
UBAH = {}


def ubah(no, fungsi, butir):
    assert no not in UBAH, no
    UBAH[no] = dict(fungsi=fungsi, butir=butir)


def ganti(kolom, lama, baru, harap=1):
    """Ganti potongan bytes tertentu di kolom teks (sql_query/default_data); jumlah kemunculan lama harus persis `harap`."""
    lama = lama.encode('ascii') if isinstance(lama, str) else lama
    baru = baru.encode('ascii') if isinstance(baru, str) else baru

    def f(r):
        b = r[kolom]
        assert b is not None and b.count(lama) == harap, (kolom, lama, None if b is None else b.count(lama), harap)
        return {kolom: b.replace(lama, baru)}
    return f


def beberapa(*fungsi):
    def f(r):
        out = {}
        for g in fungsi:
            h = g(dict(r, **out))
            out.update(h)
        return out
    return f


# ---------------------------------------------------------------- S1 #0015 Nama PP
# Aturan (tepat satu PP): PP aktif ('Y') dengan nama; yang PALING BARU ditunjuk (tanggal_penetapan terbesar) - mis. PP ikrar talak yang penunjukannya tidak
# menonaktifkan PP pemeriksa di SIPP; bila sama tanggal, urutan terkecil (PP utama; SIPP menampilkan PP menurut urutan), lalu id terkecil.
ubah(15, ganti('sql_query', b'where aktif="Y" and perkara_id=#perkara_id#',
               b'where aktif="Y" and perkara_id=#perkara_id# and IFNULL(panitera_nama,"")<>""\r\n'
               b'order by tanggal_penetapan desc, urutan, id\r\nlimit 1'), 'S1')

# ---------------------------------------------------------------- S2 #6032 dan #5101 label jurusita
# Sama dengan nama jurusita #0018#/#6031#: aktif='Y' dan urutan=1 (jurusita yang sudah diganti = aktif 'T' tidak lagi menentukan label); id kecil lebih dulu.
_J = b'where a.perkara_id=#perkara_id#'
_J2 = b'where a.aktif="Y" and a.urutan=1 and a.perkara_id=#perkara_id#\r\norder by a.id\r\nlimit 1'
ubah(6032, ganti('sql_query', _J, _J2), 'S2')
ubah(5101, ganti('sql_query', _J, _J2), 'S2')

# ---------------------------------------------------------------- S3 #9003, #7105, #7106: perkara tanpa jadwal sidang
# #0050# kosong -> "case when = 1" (galat sintaks, seluruh blangko berhenti "ERROR Variabel"). Dibungkus kutip; tanpa jadwal = tanpa baris = "...".
ubah(9003, beberapa(ganti('sql_query', b'#0050# = 1', b"'#0050#' = '1'"),
                    ganti('sql_query', b'end) data', b"end) data from dual where '#0050#' <> ''")), 'S3')
ubah(7105, beberapa(ganti('sql_query', b'#0050# = 1', b"'#0050#' = '1'"),
                    ganti('sql_query', b'end) data', b"end) data from dual where '#0050#' <> ''")), 'S3')
ubah(7106, beberapa(ganti('sql_query', b'#0050# = 1', b"'#0050#' = '1'"),
                    ganti('sql_query', b'end) data', b"end) data from dual where '#0050#' <> ''")), 'S3')

# ---------------------------------------------------------------- S4 hubungan saksi = saksi yang sama dengan namanya (ORDER BY urutan LIMIT k,1)
for _no, _sk, _u in ((1241, 1, 1), (1242, 1, 2), (1251, 2, 1), (1252, 2, 2), (6149, 1, 3)):
    ubah(_no, ganti('sql_query', ('saksi_pihak_ke=%d and urutan=%d and perkara_id=#perkara_id#' % (_sk, _u)),
                    ('saksi_pihak_ke=%d and perkara_id=#perkara_id# order by urutan limit %d,1' % (_sk, _u - 1))), 'S4')

# ---------------------------------------------------------------- S6 #8544 Tanggal Putusan dan #8545 Hari Tanggal Putusan
# Tanggal putusan sungguhan (perkara_putusan) bila sudah ada; bila belum, agenda court calendar (musyawarah/putusan/penetapan) yang TERAKHIR
# menurut tanggal (jadwal pengucapan; musyawarah yang mendahuluinya tidak lagi terpilih). Tidak ada = '' (sama dengan perilaku lama).
_EXPR_TGL = ("IFNULL((SELECT pu.tanggal_putusan FROM perkara_putusan pu WHERE pu.perkara_id = #perkara_id# AND pu.tanggal_putusan > '1900-01-01' "
             "ORDER BY pu.tanggal_putusan DESC LIMIT 1), "
             "(SELECT c.rencana_tanggal FROM perkara_court_calendar c WHERE c.perkara_id = #perkara_id# AND c.rencana_tanggal > '1900-01-01' "
             "AND (c.rencana_agenda LIKE '%musyawarah%' OR c.rencana_agenda LIKE '%putusan%' OR c.rencana_agenda LIKE '%penetapan%') "
             "ORDER BY c.rencana_tanggal DESC, c.id DESC LIMIT 1))")
SQL_8544 = "SELECT\r\n  IFNULL(" + _EXPR_TGL + ", '') AS data"
SQL_8545 = ("SELECT\r\n  IFNULL(CASE DAYOFWEEK(DATE(x.d))\r\n    WHEN 1 THEN 'Minggu'\r\n    WHEN 2 THEN 'Senin'\r\n    WHEN 3 THEN 'Selasa'\r\n"
            "    WHEN 4 THEN 'Rabu'\r\n    WHEN 5 THEN 'Kamis'\r\n    WHEN 6 THEN 'Jumat'\r\n    WHEN 7 THEN 'Sabtu'\r\n  END, '') AS data\r\n"
            "FROM (SELECT " + _EXPR_TGL + " AS d) x")
ubah(8544, lambda r: {'sql_query': SQL_8544.encode('ascii')}, 'S6')
ubah(8545, lambda r: {'sql_query': SQL_8545.encode('ascii')}, 'S6')

# ---------------------------------------------------------------- S7 #5128 salah ketik (teks bawaan yang sama; makna tetap)
# "Pernggugat" -> #0046# (variabel sebutan Pemohon/Penggugat yang dipakai SEMUA baris lain teks ini; mencetak "Penggugat" pada gugatan dan "Pemohon" pada permohonan)
ubah(5128, beberapa(ganti('default_data', b'Pernggugat', b'#0046#'), ganti('default_data', b'kekerasan pisik', b'kekerasan fisik')), 'S7')

# ---------------------------------------------------------------- S9 #1335 (+ #1372 sejenis): sisa satker lain "Kabupaten Majene" -> "Kabupaten ....." (pola #1339)
ubah(1335, ganti('default_data', b'Sipil Kabupaten Majene', b'Sipil Kabupaten .....'), 'S9')
ubah(1372, ganti('default_data', b'Sipil Kabupaten Majene', b'Sipil Kabupaten .....'), 'S9')

# ---------------------------------------------------------------- S10 #6271 bertipe data_sql padahal teks biasa -> data_teks (isi tetap, pindah ke default_data seperti #5271/#0009)
ubah(6271, lambda r: {'data_type': 'data_teks', 'default_data': r['sql_query'], 'sql_query': None}, 'S10')

# ---------------------------------------------------------------- S5 variabel tanpa data_type yang dipakai blangko
# data_tanggal: dipakai sebagai tanggal di blangko; data_teks: selebihnya (termasuk 1162/1163/8020 yang dipakai berbeda dari namanya - lihat PASANG.md)
S5_TANGGAL = [309, 662, 1281, 8018]
S5_TEKS = [704, 705, 706, 707, 1031, 1032, 1037, 1038, 1039, 1040, 1042, 1043, 1044, 1045, 1048, 1162, 1163, 1236, 1245, 1249, 1250, 1356,
           2011, 2040, 5004, 5111, 5113, 5140, 5208, 5209, 5210, 6058, 6065, 6118, 6119, 6125, 6128, 6129, 6130, 6131,
           8020, 8134, 8426, 8427, 8428, 8429, 8430, 8431]


def _tipe(t):
    def f(r):
        assert r['data_type'] is None, r['no_var']
        return {'data_type': t}
    return f


for _no in S5_TANGGAL:
    ubah(_no, _tipe('data_tanggal'), 'S5')
for _no in S5_TEKS:
    ubah(_no, _tipe('data_teks'), 'S5')
assert len(S5_TANGGAL) + len(S5_TEKS) == 52, len(S5_TANGGAL) + len(S5_TEKS)

# ---------------------------------------------------------------- S8 variabel yang dirujuk BAS standar tetapi tidak ada
# 8155: tanggal Hijriah = tanggal sidang (0033) seperti #8184# ("...pada hari #0032# tanggal #0033# Masehi bertepatan tanggal #8155# Hijriyah")
tambah(8155, "Hijriyah Tgl. Putusan Sela (sama dengan tanggal sidang #0033#, seperti #8184#)", 'tanggal_hijriah', ref=33, butir='S8')

# 0207: dua BAS "P (Kuasa)" menulis "surat kuasa khusus tanggal #0207#" tempat BAS saudaranya memakai #0184# (Tgl. Surat Kuasa) -> sama dengan #0184#; tanpa isian = "..."
tambah(207, "Tgl. Surat Kuasa Khusus #0046# (sama dengan isian #0184#; dirujuk BAS Pertama P Kuasa Tidak Hadir/T Hadir)", 'data_sql',
       sql="SELECT x.d AS data FROM (SELECT '#0184#' AS d) x WHERE x.d <> ''", butir='S8')

# 0074: hubungan saksi pertama Penggugat/Pemohon dengan pihak (BAS PA Donggala verstek: "ia adalah #0074# #0046#"; nama saksi pertama = #1197#) = #1241#
tambah(74, "Hbgn. Saksi1 P dg. Pihak (BAS PA Donggala; sama dengan #1241#)", 'data_sql',
       sql="select keterangan as data from perkara_pihak5 where saksi_pihak_ke=1 and perkara_id=#perkara_id# order by urutan limit 0,1", butir='S8')

# 5052, 6115, 6116, 8445: isian teks (jawaban, tanya-jawab pemeriksaan setempat, tuntutan pihak ketiga) - tidak ada sumber di SIPP
tambah(5052, "Jawaban #0047# atas #0053# (Voeging/Vrijwaring) - isian", 'data_teks', butir='S8')
tambah(6115, "Pertanyaan Ketua Majelis pada pemeriksaan setempat (1) - isian", 'data_teks', butir='S8')
tambah(6116, "Pertanyaan Ketua Majelis pada pemeriksaan setempat (2) - isian", 'data_teks', butir='S8')
tambah(8445, "Tuntutan pihak ketiga (Tussenkomst/Voeging/Vrijwaring) - isian", 'data_teks', butir='S8')

# 8439-8444: identitas pihak ketiga = isian popup yang bawaannya (default_data) memakai bacaan otomatis dari SIPP perkara_pihak3 (pola sama dengan 9023/#10113# di paket x1).
_P3 = "perkara_pihak3 a"
_ORD = "order by a.urutan, a.id limit 1"
tambah(10121, "Otomatis Nama Pihak Ketiga (SIPP perkara_pihak3 urutan pertama)", 'data_sql',
       sql="select a.nama as data from %s where a.perkara_id=#perkara_id# %s" % (_P3, _ORD), butir='S8')
tambah(10122, "Otomatis Umur Pihak Ketiga (SIPP perkara_pihak3 urutan pertama)", 'data_sql',
       sql=("select (get_umur(b.tanggal_lahir,c.tanggal_pendaftaran)) as data from %s join pihak b on a.pihak_id=b.id "
            "join perkara c on a.perkara_id=c.perkara_id where a.perkara_id=#perkara_id# %s") % (_P3, _ORD), butir='S8')
tambah(10123, "Otomatis Agama Pihak Ketiga (SIPP perkara_pihak3 urutan pertama)", 'data_sql',
       sql=("select c.nama as data from %s join pihak b on a.pihak_id=b.id join agama c on b.agama_id=c.id "
            "where a.perkara_id=#perkara_id# %s") % (_P3, _ORD), butir='S8')
tambah(10124, "Otomatis Pendidikan Pihak Ketiga (SIPP perkara_pihak3 urutan pertama)", 'data_sql',
       sql=("select c.kode as data from %s join pihak b on a.pihak_id=b.id join tingkat_pendidikan c on b.pendidikan_id=c.id "
            "where a.perkara_id=#perkara_id# %s") % (_P3, _ORD), butir='S8')
tambah(10125, "Otomatis Pekerjaan Pihak Ketiga (SIPP perkara_pihak3 urutan pertama)", 'data_sql',
       sql="select b.pekerjaan as data from %s join pihak b on a.pihak_id=b.id where a.perkara_id=#perkara_id# %s" % (_P3, _ORD), butir='S8')
tambah(10126, "Otomatis Alamat Pihak Ketiga (SIPP perkara_pihak3 urutan pertama)", 'data_sql',
       sql="select a.alamat as data from %s where a.perkara_id=#perkara_id# %s" % (_P3, _ORD), butir='S8')
for _no, _nama, _help in ((8439, 'Nama', 10121), (8440, 'Umur', 10122), (8441, 'Agama', 10123), (8442, 'Pendidikan', 10124),
                          (8443, 'Pekerjaan', 10125), (8444, 'Tempat Tinggal', 10126)):
    tambah(_no, "%s Pihak Ketiga (Tussenkomst/Voeging/Vrijwaring) - isian, bawaan dari SIPP" % _nama, 'data_teks', default='#%d#' % _help, butir='S8')
