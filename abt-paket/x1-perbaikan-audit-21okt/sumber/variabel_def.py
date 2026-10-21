# -*- coding: utf-8 -*-
"""Definisi isi paket x1-perbaikan-audit-21okt (temuan BERAT audit variabel ABT 21 Okt 2026).
Semua teks ASCII. BARU = nomor yang belum ada di server; UBAH = baris yang ada dan diubah (isi lama dijaga md5)."""

MODIFIER = 'admin'          # sama dengan paket-paket sebelumnya (tidak memuat kata "Aleta")
MODIFIED = '2026-10-21 00:00:00'


def sipp_pihak(tabel, urutan, kolom):
    """Variabel data_sql bentuk 3111-3119: kolom pihak (join pihak) menurut urutan."""
    tambahan = " and b.tanggal_lahir > '1900-01-01'" if kolom == 'tanggal_lahir' else ''   # tanggal 0000-00-00 = kosong (titik-titik), bukan tanggal aneh
    return ("select b.%s as data from %s a join pihak b on a.pihak_id=b.id "
            "where a.urutan=%d and a.perkara_id=#perkara_id#%s") % (kolom, tabel, urutan, tambahan)


def sql_agama(tabel, urutan):
    return ("select c.nama as data from %s a join pihak b on a.pihak_id=b.id join agama c on b.agama_id=c.id "
            "where a.urutan=%d and a.perkara_id=#perkara_id#") % (tabel, urutan)


def sql_pendidikan(tabel, urutan):
    return ("select c.kode as data from %s a join pihak b on a.pihak_id=b.id join tingkat_pendidikan c on b.pendidikan_id=c.id "
            "where a.urutan=%d and a.perkara_id=#perkara_id#") % (tabel, urutan)


def sql_umur(tabel, urutan):
    return ("select (get_umur(b.tanggal_lahir,c.tanggal_pendaftaran))as data from %s a join pihak b on a.pihak_id=b.id "
            "join perkara c on a.perkara_id=c.perkara_id where a.urutan=%d and a.perkara_id=#perkara_id#") % (tabel, urutan)


def sql_nama(tabel, urutan):
    return "select nama as data from %s where urutan=%d and perkara_id=#perkara_id#" % (tabel, urutan)


BARU = []   # dict(no, nama, tipe, sql, default, tabel, kolom, urutan, alasan)


def tambah(no, nama, tipe, sql=None, default=None, tabel=None, kolom=None, urutan=None, butir=''):
    BARU.append(dict(no=no, nama=nama, tipe=tipe, sql=sql, default=default, tabel=tabel, kolom=kolom, urutan=urutan, butir=butir))


# ---------------------------------------------------------------- B1: nama yang menikahkan (58 blangko + templat tanya-jawab)
# Sumber SIPP tidak terstruktur (perkara_data_itsbat hanya tgl/tempat menikah): satu-satunya jejak = kalimat posita
# "yang menikahkan adalah <nama> (Imam ...)". Dibaca hati-hati (pagar panjang/karakter), kosong bila tidak yakin;
# 9023 = isian teks (popup) yang bawaannya memakai bacaan itu, sama pola dengan 8087 (bawaan #10109#).
SQL_10113 = (
    "SELECT CASE WHEN z.ada > 1 AND CHAR_LENGTH(z.n) BETWEEN 3 AND 80 AND z.n NOT REGEXP '[()0-9<>;:]' THEN z.n ELSE NULL END AS data\n"
    "FROM (SELECT y.ada, TRIM(TRAILING '.' FROM TRIM(TRAILING ',' FROM TRIM(SUBSTRING_INDEX(y.r, ' (', 1)))) AS n\n"
    "  FROM (SELECT x.r, LOCATE(' (', x.r) AS ada\n"
    "    FROM (SELECT SUBSTRING(q.p, CASE WHEN LOCATE('yang menikahkan adalah ', q.p) > 0 THEN LOCATE('yang menikahkan adalah ', q.p) + 23\n"
    "                                     WHEN LOCATE('yang menikahkan yaitu ', q.p) > 0 THEN LOCATE('yang menikahkan yaitu ', q.p) + 22\n"
    "                                     ELSE CHAR_LENGTH(q.p) + 1 END) AS r\n"
    "      FROM (SELECT REPLACE(CONVERT(IFNULL(posita, '') USING utf8), CONVERT(UNHEX('C2A0') USING utf8), ' ') AS p FROM perkara WHERE perkara_id = '#perkara_id#') q) x) y) z")
tambah(10113, "Otomatis Nama Yang Menikahkan", 'data_sql', sql=SQL_10113, butir='B1')
tambah(9023, "Nama Yang Menikahkan", 'data_teks', default='#10113#', butir='B1')

# ---------------------------------------------------------------- B3: variabel dirujuk blangko tetapi belum ada
SQL_MEDIATOR = (
    "SELECT TRIM(CONVERT(m.mediator_text USING utf8)) AS data FROM perkara_mediasi m "
    "WHERE m.perkara_id = '#perkara_id#' AND TRIM(IFNULL(m.mediator_text, '')) <> '' ORDER BY m.mediasi_id DESC LIMIT 1")
tambah(8013, "MEDIATOR: NAMA (OTOMATIS dari SIPP perkara_mediasi.mediator_text, mediasi terakhir; titik-titik bila belum ada)",
       'data_sql', sql=SQL_MEDIATOR, butir='B3')
tambah(237, "MEDIATOR: NAMA UNTUK AKTA PERDAMAIAN (OTOMATIS dari SIPP, sama dengan #8013#)", 'data_sql', sql=SQL_MEDIATOR, butir='B3')
tambah(8129, "TANGGAL RELAAS PANGGILAN PERTAMA #0047# (OTOMATIS dari SIPP perkara_pelaksanaan_relaas; titik-titik bila belum ada)",
       'data_sql',
       sql=("SELECT MIN(r.tanggal_relaas) AS data FROM perkara_pelaksanaan_relaas r "
            "JOIN perkara_pihak2 p ON p.perkara_id = r.perkara_id AND p.pihak_id = r.pihak_id AND p.urutan = 1 "
            "WHERE r.perkara_id = '#perkara_id#' AND r.tanggal_relaas > '1900-01-01' HAVING COUNT(*) > 0"),
       butir='B3')
tambah(5510, "DK: NAMA ANAK YANG DIMOHONKAN DISPENSASI (OTOMATIS dari SIPP perkara_mempelai_dk: yang di bawah 19 tahun saat didaftarkan (bila dua, yang ditandai dimohonkan); titik-titik bila tidak jelas)",
       'data_sql',
       sql=("SELECT GROUP_CONCAT(y.nama ORDER BY y.jenis_mempelai DESC SEPARATOR ' dan ') AS data\n"
            "FROM (SELECT TRIM(CONVERT(m.nama USING utf8)) AS nama, m.jenis_mempelai, IF(m.dimohonkan = 1, 1, 0) AS dm,\n"
            "    IF(m.tanggal_lahir IS NOT NULL AND m.tanggal_lahir > '1900-01-01' AND TIMESTAMPDIFF(YEAR, m.tanggal_lahir, p.tanggal_pendaftaran) < 19, 1, 0) AS u19\n"
            "  FROM perkara_mempelai_dk m JOIN perkara p ON p.perkara_id = m.perkara_id\n"
            "  WHERE m.perkara_id = '#perkara_id#' AND TRIM(IFNULL(m.nama, '')) <> '') y\n"
            "WHERE (y.u19 = 1 AND (y.dm = 1 OR NOT EXISTS (SELECT 1 FROM perkara_mempelai_dk d JOIN perkara q ON q.perkara_id = d.perkara_id\n"
            "    WHERE d.perkara_id = '#perkara_id#' AND d.dimohonkan = 1 AND d.tanggal_lahir > '1900-01-01' AND TIMESTAMPDIFF(YEAR, d.tanggal_lahir, q.tanggal_pendaftaran) < 19)))\n"
            "  OR (y.dm = 1 AND NOT EXISTS (SELECT 1 FROM perkara_mempelai_dk d JOIN perkara q ON q.perkara_id = d.perkara_id\n"
            "    WHERE d.perkara_id = '#perkara_id#' AND d.tanggal_lahir > '1900-01-01' AND TIMESTAMPDIFF(YEAR, d.tanggal_lahir, q.tanggal_pendaftaran) < 19))\n"
            "HAVING COUNT(*) > 0"),
       butir='B3')

# ---------------------------------------------------------------- Butir 4: nomor yang dirujuk variabel 7047/7048/7097/7098 tetapi tidak ada
# Penggugat/Pemohon IV (pola 3111-3119 +10) dan Pemohon V (hanya nama; dirujuk 7097).
for i, (sufiks, kolom_fn) in enumerate([
        ('Nama', None), ('Agama', 'agama'), ('No. NIK', 'nomor_indentitas'), ('Tempat Lahir', 'tempat_lahir'), ('Tgl. Lahir', 'tanggal_lahir'),
        ('Umur', 'umur'), ('Pekerjaan', 'pekerjaan'), ('Pendidikan', 'pendidikan'), ('Alamat', 'alamat')]):
    no = 3121 + i
    nama = '%s #0046# IV' % sufiks
    if sufiks == 'Nama':
        tambah(no, nama, 'data_sql', sql=sql_nama('perkara_pihak1', 4), butir='4')
    elif sufiks == 'Agama':
        tambah(no, nama, 'data_sql', sql=sql_agama('perkara_pihak1', 4), butir='4')
    elif sufiks == 'Umur':
        tambah(no, nama, 'data_sql', sql=sql_umur('perkara_pihak1', 4), butir='4')
    elif sufiks == 'Pendidikan':
        tambah(no, nama, 'data_sql', sql=sql_pendidikan('perkara_pihak1', 4), butir='4')
    elif sufiks == 'Alamat':
        tambah(no, nama, 'data_sipp', tabel='perkara_pihak1', kolom='alamat', urutan=4, butir='4')
    else:
        tambah(no, nama, 'data_sql', sql=sipp_pihak('perkara_pihak1', 4, kolom_fn), butir='4')
tambah(3131, "Nama #0046# V", 'data_sql', sql=sql_nama('perkara_pihak1', 5), butir='4')

# Tergugat/Termohon II (NIK, tempat/tgl lahir, agama; nama/pekerjaan/pendidikan/alamat sudah ada: 5026/5028/5019/5029)
tambah(5078, "No. NIK #0047# II", 'data_sql', sql=sipp_pihak('perkara_pihak2', 2, 'nomor_indentitas'), butir='4')
tambah(5079, "Tempat Lahir #0047# II", 'data_sql', sql=sipp_pihak('perkara_pihak2', 2, 'tempat_lahir'), butir='4')
tambah(5080, "Tgl. Lahir #0047# II", 'data_sql', sql=sipp_pihak('perkara_pihak2', 2, 'tanggal_lahir'), butir='4')
tambah(5081, "Agama #0047# II", 'data_sql', sql=sql_agama('perkara_pihak2', 2), butir='4')


def tergugat(urut, roman, no_nama, no_nik, no_tempat, no_tgl, no_agama, no_pekerjaan, no_pendidikan, no_alamat):
    t = 'perkara_pihak2'
    tambah(no_nama, 'Nama #0047# %s' % roman, 'data_sipp', tabel=t, kolom='nama', urutan=urut, butir='4')
    tambah(no_nik, 'No. NIK #0047# %s' % roman, 'data_sql', sql=sipp_pihak(t, urut, 'nomor_indentitas'), butir='4')
    tambah(no_tempat, 'Tempat Lahir #0047# %s' % roman, 'data_sql', sql=sipp_pihak(t, urut, 'tempat_lahir'), butir='4')
    tambah(no_tgl, 'Tgl. Lahir #0047# %s' % roman, 'data_sql', sql=sipp_pihak(t, urut, 'tanggal_lahir'), butir='4')
    tambah(no_agama, 'Agama #0047# %s' % roman, 'data_sql', sql=sql_agama(t, urut), butir='4')
    tambah(no_pekerjaan, 'Pekerjaan #0047# %s' % roman, 'data_sql', sql=sipp_pihak(t, urut, 'pekerjaan'), butir='4')
    tambah(no_pendidikan, 'Pendidikan #0047# %s' % roman, 'data_sql', sql=sql_pendidikan(t, urut), butir='4')
    tambah(no_alamat, 'Alamat #0047# %s' % roman, 'data_sipp', tabel=t, kolom='alamat', urutan=urut, butir='4')


# nomor menurut rujukan di 7048; nama Tergugat III dipindah 5082 -> 5118 (5082 sudah dipakai templat Fikrianto sebagai tanya-jawab saksi)
tergugat(3, 'III', 5118, 5083, 5084, 5085, 5086, 5088, 5087, 5089)
tergugat(4, 'IV', 5090, 5091, 5092, 5093, 5094, 5095, 5096, 5097)
tergugat(5, 'V', 5098, 5099, 5102, 5103, 5104, 5106, 5107, 5117)

# ---------------------------------------------------------------- UBAH: baris yang sudah ada
# kunci: no -> dict(kolom='sql_query'|'default_data', fungsi pembuat isi baru dari bytes lama)
UBAH = {}


def ubah(no, kolom, fungsi, butir):
    UBAH[no] = dict(kolom=kolom, fungsi=fungsi, butir=butir)


def ganti_token(lama, baru, harap):
    def f(b):
        assert b.count(lama) == harap, (lama, b.count(lama), harap)
        return b.replace(lama, baru)
    return f


# B2: kerangka bukti DK tanpa data pribadi (bentuk daftar sama: 9 bukti surat P.1-P.9)
_CAP = ("Bukti surat tersebut telah diperiksa oleh Hakim, dicocokkan dengan aslinya yang ternyata sesuai dan telah dinazegelen, "
        "kemudian diberi kode bukti (P.%d). Diberi tanggal dan paraf Hakim;")
_DUKCAPIL = "yang dikeluarkan oleh Kepala Dinas Kependudukan dan Pencatatan Sipil Kabupaten ..."
_KUA = "yang dikeluarkan oleh Kantor Urusan Agama Kecamatan ..., Kabupaten ..."
KERANGKA_8133 = [
    "Fotokopi Kartu Tanda Penduduk a.n. ..., NIK: ..., tanggal ..., " + _DUKCAPIL + ".",
    "Fotokopi Kartu Tanda Penduduk a.n. ..., NIK: ..., tanggal ..., " + _DUKCAPIL + ".",
    "Fotokopi Kartu Keluarga a.n. ..., Nomor: ..., tanggal ..., " + _DUKCAPIL + ".",
    "Fotokopi Kutipan Akta Nikah a.n. ... dan ..., Nomor: ..., tanggal ..., " + _KUA + ".",
    "Fotokopi Kutipan Akta Kelahiran a.n. ..., Nomor: ..., tanggal ..., " + _DUKCAPIL + ".",
    "Fotokopi Ijazah ... a.n. ..., tanggal ..., yang dikeluarkan oleh ....",
    "Fotokopi Kartu Tanda Penduduk a.n. ..., NIK: ..., tanggal ..., " + _DUKCAPIL + ".",
    "Fotokopi Kartu Keluarga a.n. ..., Nomor: ..., tanggal ..., " + _DUKCAPIL + ".",
    "Surat Pemberitahuan Penolakan Nikah terhadap ... dan ..., Nomor ..., tanggal ..., " + _KUA + ".",
]
TEKS_8133 = "\r\n".join("%d.\t%s %s" % (i + 1, b, _CAP % (i + 1)) for i, b in enumerate(KERANGKA_8133))
ubah(8133, 'default_data', lambda b: TEKS_8133.encode('ascii'), 'B2')

# 7047/7097: #7064# tidak ada di abt_variabel (dalam kueri menyulih kosong); dibuang agar tidak tertimpa nomor 7064 kelak
ubah(7047, 'sql_query', ganti_token(b'#7064#', b'', 4), '4')
ubah(7097, 'sql_query', ganti_token(b'#7064#', b'', 5), '4')
# 7048/7098: Tergugat III memakai 5118 (bukan 5082)
ubah(7048, 'sql_query', ganti_token(b'#5082#', b'#5118#', 4), '4')
ubah(7098, 'sql_query', ganti_token(b'#5082#', b'#5118#', 6), '4')

# 7055: Turut Tergugat = perkara_pihak4; rujukan 3510-3517 tidak ada -> pakai #8710# (identitas Turut Tergugat otomatis dari SIPP, sampai 10 orang)
ubah(7055, 'sql_query', lambda b: b'SELECT "#8710#" AS data', '4')


# 7054: pihak ketiga = perkara_pihak3 (pihak intervensi); kueri lama mencetak data Tergugat dengan nomor salah -> tulis ulang
def _blok(k):
    return ("MAX(CASE WHEN a.rn = %d THEN CONCAT('<strong>', TRIM(CONVERT(IFNULL(a.nama,'') USING utf8)), '</strong>', "
            "IF(TRIM(IFNULL(ph.nomor_indentitas,'')) = '' OR TRIM(ph.nomor_indentitas) REGEXP '^[0 -]+$', '', CONCAT(', NIK ',TRIM(CONVERT(ph.nomor_indentitas USING utf8)))), "
            "IF(TRIM(IFNULL(ph.tempat_lahir,'')) = '' OR ph.tanggal_lahir IS NULL OR ph.tanggal_lahir < '1900-01-01', '', CONCAT(', tempat dan tanggal lahir ', TRIM(CONVERT(ph.tempat_lahir USING utf8)), ', ', "
            "CONCAT(LPAD(CAST(DAY(ph.tanggal_lahir) AS CHAR CHARACTER SET utf8), 2, '0'), ' ', ELT(MONTH(ph.tanggal_lahir), 'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'), ' ', CAST(YEAR(ph.tanggal_lahir) AS CHAR CHARACTER SET utf8)))), "
            "IF(IFNULL(ph.agama_id,0) BETWEEN 1 AND 7, CONCAT(', agama ', ELT(ph.agama_id,'Islam','Protestan','Katolik','Budha','Hindu','Lainnya','Kong Hu Cu')), ''), "
            "IF(TRIM(IFNULL(ph.pekerjaan,'')) = '', '', CONCAT(', pekerjaan ', TRIM(CONVERT(ph.pekerjaan USING utf8)))), "
            "', beralamat di ', TRIM(CONVERT(IFNULL(a.alamat,'') USING utf8)), ', sebagai <strong>', "
            "IFNULL(NULLIF(TRIM(CONVERT(a.jenis_intervensi_nama USING utf8)), ''), 'Pihak Intervensi'), "
            "IF(s.n > 1, CONCAT(' ', ELT(a.rn,'I','II','III','IV','V')), ''), '</strong>;') END)") % k


SQL_7054 = ("SELECT IFNULL((SELECT CONCAT('<br>', CONCAT_WS('<br>', " + ", ".join(_blok(k) for k in range(1, 6)) + ")) "
            "FROM (SELECT t.nama, t.alamat, t.pihak_id, t.jenis_intervensi_nama, "
            "(SELECT COUNT(*) FROM perkara_pihak3 z WHERE z.perkara_id = t.perkara_id AND z.urutan <= t.urutan) AS rn "
            "FROM perkara_pihak3 t WHERE t.perkara_id = '#perkara_id#') a "
            "LEFT JOIN pihak ph ON ph.id = a.pihak_id "
            "JOIN (SELECT (SELECT COUNT(*) FROM perkara_pihak3 z WHERE z.perkara_id = p.perkara_id) AS n FROM perkara p WHERE p.perkara_id = '#perkara_id#') s ON 1 = 1 "
            "HAVING COUNT(*) > 0), '') AS data")
ubah(7054, 'sql_query', lambda b: SQL_7054.encode('ascii'), '4')
