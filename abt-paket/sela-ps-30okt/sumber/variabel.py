# -*- coding: utf-8 -*-
"""Variabel BARU paket sela-ps-30okt (blok 11300-11366, diklaim 30 Okt 2026; 11300-11499 dicadangkan untuk paket ini).

Aturan tulis (pelajaran paket lain):
- MariaDB 5.5 server: tanpa REGEXP_REPLACE, CTE, fungsi jendela. Penanda #nnnn# di dalam kueri hanya SEBUTAN / angka / tanggal
  (tidak pernah nama orang atau isian bebas yang bisa memuat tanda kutip) dan selalu di dalam tanda kutip ganda.
- Isian bebas dibaca langsung dari aps_badilag.abt_data_teks (garis miring terbalik -> '/', kutip -> entitas) seperti variabel 3801.
- Rujukan pasal hukum acara (RBg) hanya lewat variabel ACARA 11300-11309: satu tempat bila kelak dipadankan HIR (satker Jawa-Madura).
"""

ASAL = "aps_badilag.abt_data_teks"


def isian(n):
    return ("(SELECT TRIM(REPLACE(REPLACE(REPLACE(CONVERT(t.data USING utf8), '\\\\', '/'), '\"', '&quot;'), '''', '&#39;')) "
            "FROM %s t WHERE t.no_var = %d AND t.perkara_id = '#perkara_id#' LIMIT 1)" % (ASAL, n))


def nil(expr):
    """NULL bila kosong / titik-titik / strip."""
    return "NULLIF(NULLIF(NULLIF(TRIM(IFNULL(%s, '')), ''), '...'), '-')" % expr


def ada(n):
    return "(%s IS NOT NULL)" % nil(isian(n))


def huruf1(n):
    return "UPPER(LEFT(TRIM(IFNULL(%s, '')), 1))" % isian(n)


PERKARA = "FROM perkara p WHERE p.perkara_id = '#perkara_id#'"
UU_PA = ("Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 "
         "dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009")

V = []  # dict(no, nama, tipe, sql, referensi, multi)


def var(no, nama, tipe='data_sql', sql=None, referensi=None, multi=None):
    assert 11300 <= no <= 11499 and all(x['no'] != no for x in V), no
    assert len(nama) <= 200, (no, len(nama))
    assert 'aleta' not in (nama + (sql or '')).lower()
    V.append(dict(no=no, nama=nama, tipe=tipe, sql=sql, referensi=referensi, multi=multi))


# --- ACARA: rujukan pasal hukum acara satu tempat (sekarang RBg; padanan HIR DIKERJAKAN BELAKANGAN, dicatat di nama) ---------
ACARA = [
    (11300, 'Pasal 159 RBg', 'EKSEPSI KEWENANGAN RELATIF', 'Pasal 133 HIR'),
    (11301, 'Pasal 160 RBg', 'EKSEPSI KEWENANGAN ABSOLUT', 'Pasal 134 HIR'),
    (11302, 'Pasal 162 RBg', 'EKSEPSI LAIN DIPUTUS BERSAMA POKOK PERKARA', 'Pasal 136 HIR'),
    (11303, 'Pasal 142 ayat (1) dan ayat (5) RBg', 'KEWENANGAN RELATIF TEMPAT TINGGAL TERGUGAT DAN LETAK BENDA TETAP', 'Pasal 118 ayat (1) dan ayat (3) HIR'),
    (11304, 'Pasal 180 RBg', 'PEMERIKSAAN SETEMPAT', 'Pasal 153 HIR'),
    (11305, 'Pasal 182 RBg', 'SUMPAH PELENGKAP (SUPPLETOIR)', 'Pasal 155 HIR'),
    (11306, 'Pasal 154 RBg', 'UPAYA DAMAI OLEH HAKIM', 'Pasal 130 HIR'),
    (11307, 'Pasal 192 ayat (1) RBg', 'BIAYA PERKARA DIBEBANKAN KEPADA PIHAK YANG KALAH', 'Pasal 181 ayat (1) HIR'),
    (11308, 'Pasal 191 ayat (1) RBg', 'PUTUSAN PROVISI / DAPAT DIJALANKAN LEBIH DAHULU (USULAN - periksa)', 'Pasal 180 ayat (1) HIR'),
    (11309, 'Pasal 283 RBg', 'BEBAN PEMBUKTIAN', 'Pasal 163 HIR'),
]
for no, teks, apa, hir in ACARA:
    var(no, 'ACARA: PASAL %s (satker luar Jawa-Madura = RBg; padanan untuk satker Jawa-Madura: %s - belum dipakai)' % (apa, hir),
        sql="SELECT '%s' AS data" % teks)

# --- umum putusan sela ------------------------------------------------------------------------------------------------------
var(11310, 'PUTUSAN SELA: PIHAK YANG DIDENGAR (OTOMATIS SIPP: permohonan atau #0047# tidak pernah hadir sampai sidang yang dicetak = #0046#; selain itu #0046# dan #0047#)',
    sql=("SELECT IF(p.alur_perkara_id = 16 OR NOT EXISTS (SELECT 1 FROM perkara_jadwal_sidang j WHERE j.perkara_id = p.perkara_id AND IFNULL(j.ikrar_talak, 'T') <> 'Y' "
         "AND j.dihadiri_oleh IN (1, 3, 8, 9) AND (CAST('#0050#' AS SIGNED) < 1 OR j.urutan <= CAST('#0050#' AS SIGNED))), \"#7036#\", \"#7036# dan #7037#\") AS data " + PERKARA))

var(11311, 'PUTUSAN SELA: KAKI MAJELIS/TUNGGAL DENGAN KEHADIRAN PADA SIDANG YANG DICETAK (OTOMATIS SIPP dihadiri_oleh sidang yang dipilih; e-Court = dikirim elektronik)',
    sql=('SELECT CONCAT(IF("#8554#" = "Majelis Hakim", '
         'CONCAT("oleh <strong>#8550#</strong> sebagai #8555#, <strong>#8551#</strong> dan <strong>#8552#</strong>, masing-masing sebagai Hakim Anggota, ", x.sebut, '
         '" tersebut diucapkan dalam sidang terbuka untuk umum pada hari itu juga oleh #8555# tersebut didampingi para Hakim Anggota, dibantu oleh <strong>#8553#</strong> sebagai #8556#, "), '
         'CONCAT("oleh <strong>#8550#</strong> sebagai #8555#, ", x.sebut, " tersebut diucapkan dalam sidang terbuka untuk umum pada hari itu juga oleh #8555# tersebut, dibantu oleh <strong>#8553#</strong> sebagai #8556#, ")), '
         'CASE WHEN x.alur = 16 THEN IF(x.h = 4, "di luar hadirnya #7036#", "dengan dihadiri oleh #7036#") '
         'WHEN x.h IN (2, 7) THEN "dengan dihadiri oleh #7036# di luar hadirnya #7037#" '
         'WHEN x.h IN (3, 8) THEN "dengan dihadiri oleh #7037# di luar hadirnya #7036#" '
         'WHEN x.h = 4 THEN "di luar hadirnya #7036# dan #7037#" '
         'ELSE "dengan dihadiri oleh #7036# dan #7037#" END, '
         'IF(x.h IN (7, 8, 9) AND "#3521#" <> "", " serta #3521#", ""), '
         'IF(x.ecourt = 1, CONCAT(", dan ", x.sebut, " tersebut telah dikirim secara elektronik melalui sistem informasi pengadilan pada hari itu juga."), ".")) AS data '
         "FROM (SELECT p.alur_perkara_id AS alur, IF(p.alur_perkara_id = 16, 'penetapan sela', 'putusan sela') AS sebut, "
         "(SELECT j.dihadiri_oleh FROM perkara_jadwal_sidang j WHERE j.perkara_id = p.perkara_id AND j.urutan = CAST('#0050#' AS SIGNED) LIMIT 1) AS h, "
         "IF(EXISTS (SELECT 1 FROM perkara_efiling_id f WHERE f.perkara_id = p.perkara_id AND f.efiling_id <> ''), 1, 0) AS ecourt "
         + PERKARA + ") x"))

MED = ("FROM perkara_mediasi m WHERE m.perkara_id = p.perkara_id AND IFNULL(m.is_mediasi, 1) <> 0 ORDER BY m.mediasi_id DESC LIMIT 1")
var(11312, 'PUTUSAN SELA: DUDUK PERKARA KEHADIRAN DAN UPAYA DAMAI (OTOMATIS SIPP: kehadiran sampai sidang yang dicetak + mediasi terakhir; permohonan = kehadiran #0046#)',
    sql=('SELECT CASE WHEN x.alur = 16 THEN "Bahwa pada hari sidang yang telah ditetapkan, #7036# telah hadir menghadap di persidangan;" '
         'WHEN x.t > 0 THEN CONCAT("Bahwa pada hari-hari sidang yang telah ditetapkan, #7036# dan #7037# telah hadir menghadap di persidangan;<br>Bahwa #8554# telah berupaya mendamaikan #7036# dan #7037#", '
         'IF(x.med IS NULL, ", namun tidak berhasil;", CONCAT(", dan para pihak telah menempuh mediasi dengan Mediator ", x.med, '
         'IF(x.tgl IS NULL OR x.tgl < "1900-01-01", ", namun ", CONCAT(", namun berdasarkan laporan Mediator tanggal ", aps_badilag.isian_rtf_tanggal(x.tgl), ", ")), x.hasil, ";"))) '
         'ELSE "Bahwa pada hari-hari sidang yang telah ditetapkan, #7036# telah hadir menghadap di persidangan, sedangkan #7037# tidak hadir dan tidak pula menyuruh orang lain sebagai wakil atau kuasanya yang sah meskipun telah dipanggil secara resmi dan patut, sehingga mediasi tidak dapat dilaksanakan;" END AS data '
         "FROM (SELECT p.alur_perkara_id AS alur, "
         "(SELECT COUNT(*) FROM perkara_jadwal_sidang j WHERE j.perkara_id = p.perkara_id AND IFNULL(j.ikrar_talak, 'T') <> 'Y' AND j.dihadiri_oleh IN (1, 3, 8, 9) "
         "AND (CAST('#0050#' AS SIGNED) < 1 OR j.urutan <= CAST('#0050#' AS SIGNED))) AS t, "
         "(SELECT NULLIF(TRIM(CONVERT(IFNULL(m.mediator_text, '') USING utf8)), '') " + MED + ") AS med, "
         "(SELECT m.tgl_laporan_mediator " + MED + ") AS tgl, "
         "(SELECT CASE m.hasil_mediasi WHEN 'S' THEN 'mediasi berhasil mencapai kesepakatan sebagian' WHEN 'D' THEN 'mediasi tidak dapat dilaksanakan' "
         "ELSE 'mediasi tidak berhasil mencapai kesepakatan' END " + MED + ") AS hasil "
         + PERKARA + ") x"))

# --- eksepsi kewenangan ------------------------------------------------------------------------------------------------------
var(11313, 'EKSEPSI KEWENANGAN: ISI EKSEPSI #0047# (OTOMATIS: isian 9685; kosong = isian 9681; belum diisi = titik-titik)',
    sql='SELECT COALESCE(%s, %s, "...") AS data' % (nil(isian(9685)), nil(isian(9681))))
var(11314, 'EKSEPSI KEWENANGAN: TANGGAPAN #0046# ATAS EKSEPSI - ISIAN (pokok tanggapan dalam replik, satu kalimat tanpa titik akhir; kosong = tidak tercetak)',
    tipe='data_teks')
var(11315, 'EKSEPSI KEWENANGAN: KALIMAT TANGGAPAN #0046# (OTOMATIS dari isian 11314; kosong bila tidak diisi)',
    sql="SELECT IF(%s, CONCAT('<br>Bahwa atas eksepsi tersebut, #7036# menanggapi yang pada pokoknya ', %s, ';'), '') AS data" % (ada(11314), isian(11314)))
var(11316, 'EKSEPSI KEWENANGAN RELATIF: DASAR KEWENANGAN RELATIF MENURUT JENIS (OTOMATIS: cerai gugat Pasal 73 ayat (1), cerai talak Pasal 66 ayat (2) UU 7/1989; lainnya #11303#)',
    sql=('SELECT CASE WHEN p.jenis_perkara_id = 347 THEN "berdasarkan Pasal 73 ayat (1) ' + UU_PA + ', gugatan perceraian diajukan oleh istri atau kuasanya kepada Pengadilan yang daerah hukumnya meliputi tempat kediaman Penggugat, kecuali apabila Penggugat dengan sengaja meninggalkan tempat kediaman bersama tanpa izin Tergugat" '
         'WHEN p.jenis_perkara_id = 346 THEN "berdasarkan Pasal 66 ayat (2) ' + UU_PA + ', permohonan cerai talak diajukan kepada Pengadilan yang daerah hukumnya meliputi tempat kediaman Termohon, kecuali apabila Termohon dengan sengaja meninggalkan tempat kediaman yang ditentukan bersama tanpa izin Pemohon" '
         'ELSE "berdasarkan #11303#, gugatan diajukan kepada pengadilan yang daerah hukumnya meliputi tempat tinggal Tergugat (asas actor sequitur forum rei), sedangkan gugatan mengenai benda tetap diajukan kepada pengadilan yang daerah hukumnya meliputi letak benda tetap tersebut (asas forum rei sitae)" END AS data '
         + PERKARA))
var(11317, 'EKSEPSI KEWENANGAN RELATIF DIKABULKAN: PENGADILAN YANG BERWENANG - ISIAN (mis. Pengadilan Agama Palu; kosong = tidak disebut)',
    tipe='data_teks')
var(11318, 'EKSEPSI KEWENANGAN RELATIF DIKABULKAN: KALIMAT PENGADILAN YANG BERWENANG (OTOMATIS dari isian 11317; kosong bila tidak diisi)',
    sql="SELECT IF(%s, CONCAT(', sedangkan yang berwenang mengadili perkara a quo adalah ', %s), '') AS data" % (ada(11317), isian(11317)))
var(11319, 'EKSEPSI KEWENANGAN DIKABULKAN (PUTUSAN AKHIR): PERTIMBANGAN BIAYA PERKARA (OTOMATIS: prodeo = DIPA tahun pendaftaran; bidang perkawinan = Pasal 89 ayat (1) UU 7/1989; lainnya #11307#)',
    sql=('SELECT CONCAT(CASE WHEN IFNULL(p.prodeo, 0) = 1 THEN CONCAT("Menimbang, bahwa oleh karena eksepsi #7037# dikabulkan, biaya perkara semestinya dibebankan kepada #7036#; akan tetapi oleh karena #7036# telah mendapatkan Surat Keputusan Ketua #8008# Nomor ", '
         + 'COALESCE(%s, "...")' % nil(isian(661)) +
         ', " tentang Penetapan Layanan Pembebasan Biaya Perkara tanggal #0663#, maka biaya perkara dibebankan kepada DIPA #8008# Tahun #0191#") '
         'WHEN p.jenis_perkara_id BETWEEN 341 AND 363 OR p.jenis_perkara_id = 743 THEN "Menimbang, bahwa oleh karena perkara a quo termasuk bidang perkawinan, berdasarkan Pasal 89 ayat (1) ' + UU_PA + ', biaya perkara dibebankan kepada #7036#" '
         'ELSE "Menimbang, bahwa oleh karena eksepsi #7037# dikabulkan, #7036# berada di pihak yang kalah, sehingga berdasarkan #11307# biaya perkara dibebankan kepada #7036#" END, "#8185#") AS data '
         + PERKARA))

# --- provisi -----------------------------------------------------------------------------------------------------------------
var(11320, 'PROVISI: ISI TUNTUTAN PROVISI #0046# - ISIAN (salin dari surat gugatan sesudah kata "agar", mis. Tergugat dihukum membayar nafkah ... setiap bulan selama perkara berlangsung; tanpa titik akhir)', tipe='data_teks')
var(11321, 'PROVISI: TANGGAPAN #0047# - ISIAN (satu kalimat tanpa titik akhir; kosong = tidak tercetak)', tipe='data_teks')
var(11322, 'PROVISI: KALIMAT TANGGAPAN #0047# (OTOMATIS dari isian 11321; kosong bila tidak diisi)',
    sql="SELECT IF(%s, CONCAT('<br>Bahwa atas tuntutan provisi tersebut, #7037# menanggapi yang pada pokoknya ', %s, ';'), '') AS data" % (ada(11321), isian(11321)))
var(11323, 'PROVISI: DASAR HUKUM MENURUT JENIS (OTOMATIS: CG Pasal 78 UU 7/1989 jo. Ps 24 (2) PP 9/1975 jo. Ps 136 (2) KHI; CT PP 9/1975 + KHI; lainnya #11308# + SEMA 3/2000) - USULAN',
    sql=('SELECT CASE WHEN p.jenis_perkara_id = 347 THEN "berdasarkan Pasal 78 ' + UU_PA + ' jo. Pasal 24 ayat (2) Peraturan Pemerintah Nomor 9 Tahun 1975 tentang Pelaksanaan Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 136 ayat (2) Kompilasi Hukum Islam, selama berlangsungnya gugatan perceraian, atas permohonan Penggugat, Pengadilan dapat menentukan nafkah yang ditanggung oleh suami, menentukan hal-hal yang perlu untuk menjamin pemeliharaan dan pendidikan anak, serta menentukan hal-hal yang perlu untuk menjamin terpeliharanya barang-barang yang menjadi hak bersama suami istri atau barang-barang yang menjadi hak suami atau hak istri" '
         'WHEN p.jenis_perkara_id = 346 THEN "berdasarkan Pasal 24 ayat (2) Peraturan Pemerintah Nomor 9 Tahun 1975 tentang Pelaksanaan Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 136 ayat (2) Kompilasi Hukum Islam, selama berlangsungnya gugatan perceraian, atas permohonan penggugat atau tergugat, Pengadilan dapat menentukan nafkah yang harus ditanggung oleh suami, menentukan hal-hal yang perlu untuk menjamin pemeliharaan dan pendidikan anak, serta menentukan hal-hal yang perlu untuk menjamin terpeliharanya barang-barang yang menjadi hak bersama suami istri atau barang-barang yang menjadi hak suami atau hak istri" '
         'ELSE "berdasarkan #11308# jo. Surat Edaran Mahkamah Agung Nomor 3 Tahun 2000 tentang Putusan Serta Merta (Uitvoerbaar bij Voorraad) dan Provisionil, tuntutan provisi dapat dikabulkan apabila terdapat keadaan mendesak yang memerlukan tindakan sementara sebelum putusan akhir dijatuhkan dan tuntutan tersebut tidak mengenai pokok perkara" END AS data '
         + PERKARA))
var(11324, 'PROVISI DIKABULKAN: AMAR TINDAKAN SEMENTARA - ISIAN (diawali kata kerja, mis. Menghukum Tergugat membayar nafkah ... setiap bulan selama perkara berlangsung; tanpa titik akhir)', tipe='data_teks')
var(11325, 'PROVISI: PERTIMBANGAN MAJELIS - ISIAN (alasan dikabulkan atau ditolak, kalimat sesudah "Menimbang, bahwa"; tanpa titik akhir)', tipe='data_teks')

# --- intervensi --------------------------------------------------------------------------------------------------------------
P3 = "FROM perkara_pihak3 t LEFT JOIN pihak ph ON ph.id = t.pihak_id WHERE t.perkara_id = '#perkara_id#' ORDER BY t.urutan, t.id LIMIT 1"
var(11326, 'INTERVENSI: IDENTITAS PEMOHON INTERVENSI - ISIAN (dipakai bila pihak intervensi belum dicatat di SIPP; nama, umur/tempat dan tanggal lahir, agama, pekerjaan, tempat tinggal; tanpa titik akhir)', tipe='data_teks')
var(11327, 'INTERVENSI: IDENTITAS PEMOHON INTERVENSI (OTOMATIS: SIPP pihak intervensi pertama; belum tercatat = isian 11326; keduanya kosong = titik-titik)',
    sql=("SELECT CONCAT(COALESCE((SELECT CONCAT('<strong>', TRIM(t.nama), '</strong>', "
         "IF(TRIM(IFNULL(ph.tempat_lahir, '')) = '' OR ph.tanggal_lahir IS NULL OR ph.tanggal_lahir < '1900-01-01', '', CONCAT(', tempat dan tanggal lahir ', TRIM(ph.tempat_lahir), ', ', aps_badilag.isian_rtf_tanggal(ph.tanggal_lahir))), "
         "IF(IFNULL(ph.agama_id, 0) BETWEEN 1 AND 7, CONCAT(', agama ', ELT(ph.agama_id, 'Islam', 'Protestan', 'Katolik', 'Budha', 'Hindu', 'Lainnya', 'Kong Hu Cu')), ''), "
         "IF(TRIM(IFNULL(ph.pekerjaan, '')) = '', '', CONCAT(', pekerjaan ', TRIM(ph.pekerjaan))), "
         "', beralamat di ', aps_badilag.isian_rtf_alamat(t.alamat)) " + P3 + "), "
         "TRIM(TRAILING ';' FROM TRIM(TRAILING '.' FROM %s)), '...'), ', sebagai <strong>Pemohon Intervensi</strong>;') AS data") % nil(isian(11326)))
var(11328, 'INTERVENSI: NAMA PEMOHON INTERVENSI (OTOMATIS: SIPP pihak intervensi pertama; belum tercatat = isian 11326 sampai koma pertama)',
    sql=("SELECT COALESCE((SELECT NULLIF(TRIM(t.nama), '') " + P3 + "), TRIM(SUBSTRING_INDEX(%s, ',', 1)), '...') AS data") % nil(isian(11326)))
var(11329, 'INTERVENSI: KEPENTINGAN PEMOHON INTERVENSI - ISIAN (hubungan hukum dengan objek atau perkara, satu kalimat tanpa titik akhir)', tipe='data_teks')
var(11330, 'INTERVENSI: TANGGAPAN #0046# DAN #0047# - ISIAN (sikap para pihak atas permohonan intervensi, tanpa titik akhir)', tipe='data_teks')
var(11331, 'INTERVENSI: PERTIMBANGAN MAJELIS - ISIAN (alasan dikabulkan atau ditolak, kalimat sesudah "Menimbang, bahwa"; tanpa titik akhir)', tipe='data_teks')
var(11332, 'INTERVENSI: KEDUDUKAN PEMOHON INTERVENSI BILA DIKABULKAN - ISIAN (mis. Tergugat II Intervensi; kosong = bawaan menurut bentuk intervensi)', tipe='data_teks')
var(11333, 'INTERVENSI (VOEGING): BERGABUNG KEPADA PIHAK - ISIAN (ketik P atau T; kosong = menurut SIPP, belum tercatat = T)', tipe='data_teks')
var(11334, 'INTERVENSI (VOEGING): SEBUTAN PIHAK YANG DIGABUNGI (OTOMATIS dari isian 11333 atau SIPP tergabung_ke_pihak; bawaan #0047#)',
    sql=('SELECT CASE WHEN %s = "P" THEN "#7036#" WHEN %s = "T" THEN "#7037#" ' % (huruf1(11333), huruf1(11333)) +
         'WHEN (SELECT t.tergabung_ke_pihak ' + P3 + ') = 1 THEN "#7036#" ELSE "#7037#" END AS data'))
var(11335, 'INTERVENSI (VOEGING): KEDUDUKAN (OTOMATIS: isian 11332; kosong = Penggugat Intervensi / Tergugat Intervensi menurut pihak yang digabungi) - USULAN',
    sql='SELECT COALESCE(%s, IF("#11334#" = "#7036#", "Penggugat Intervensi", "Tergugat Intervensi")) AS data' % nil(isian(11332)))
var(11336, 'INTERVENSI (TUSSENKOMST): KEDUDUKAN (OTOMATIS: isian 11332; kosong = Penggugat Intervensi) - USULAN',
    sql='SELECT COALESCE(%s, "Penggugat Intervensi") AS data' % nil(isian(11332)))
var(11337, 'INTERVENSI (VRIJWARING): KEDUDUKAN (OTOMATIS: isian 11332; kosong = Tergugat Intervensi) - USULAN',
    sql='SELECT COALESCE(%s, "Tergugat Intervensi") AS data' % nil(isian(11332)))

# --- sumpah pelengkap --------------------------------------------------------------------------------------------------------
var(11338, 'SUMPAH PELENGKAP: PIHAK YANG BERSUMPAH - ISIAN (ketik T bila #0047#; kosong = #0046#)', tipe='data_teks')
var(11339, 'SUMPAH PELENGKAP: SEBUTAN PIHAK YANG BERSUMPAH (OTOMATIS dari isian 11338; bawaan #0046#)',
    sql='SELECT IF(%s = "T", "#7037#", "#7036#") AS data' % huruf1(11338))
var(11340, 'SUMPAH PELENGKAP: AGAMA PIHAK YANG BERSUMPAH (OTOMATIS SIPP #0011# / #0020#; kosong = Islam)',
    sql='SELECT IF(%s = "T", IFNULL(NULLIF(TRIM("#0020#"), ""), "Islam"), IFNULL(NULLIF(TRIM("#0011#"), ""), "Islam")) AS data' % huruf1(11338))
var(11341, 'SUMPAH PELENGKAP: LAFAL SUMPAH - ISIAN (tanpa tanda kutip; kosong = lafal bawaan menurut agama dan pihak)', tipe='data_teks')
var(11342, 'SUMPAH PELENGKAP / PENAKSIR: LAFAL SUMPAH PELENGKAP (OTOMATIS: isian 11341; kosong = pembuka menurut agama + "apa yang saya dalilkan ..." / "apa yang saya terangkan dalam jawaban ...")',
    sql=('SELECT COALESCE(%s, CASE WHEN "#11340#" = "Islam" THEN CONCAT("Demi Allah, saya bersumpah bahwa ", x.i) '
         'WHEN "#11340#" IN ("Protestan", "Katolik") THEN CONCAT("Saya berjanji bahwa ", x.i, ", semoga Tuhan menolong saya") '
         'WHEN "#11340#" = "Hindu" THEN CONCAT("Om Atah Parama Wisesa, saya bersumpah bahwa ", x.i) '
         'WHEN "#11340#" = "Budha" THEN CONCAT("Demi Sang Hyang Adi Budha, saya bersumpah bahwa ", x.i) '
         'ELSE CONCAT("Saya berjanji bahwa ", x.i) END) AS data FROM (SELECT IF(%s = "T", '
         '"apa yang saya terangkan dalam jawaban saya di persidangan adalah benar, tidak lain dari yang sebenarnya", '
         '"apa yang saya dalilkan dalam surat #0053# saya adalah benar, tidak lain dari yang sebenarnya") AS i) x') % (nil(isian(11341)), huruf1(11338)))
var(11343, 'SUMPAH PELENGKAP: ALAT BUKTI YANG TELAH DIAJUKAN DAN KEKURANGANNYA - ISIAN (mis. bukti surat P.1 sampai P.3 dan seorang saksi bernama ... yang menerangkan ...; tanpa titik akhir)', tipe='data_teks')

# --- pemeriksaan setempat ----------------------------------------------------------------------------------------------------
var(11344, 'PEMERIKSAAN SETEMPAT: ASAL PERMINTAAN - ISIAN (ketik P bila dimohon #0046#, T bila dimohon #0047#; kosong = karena jabatan)', tipe='data_teks')
var(11345, 'PEMERIKSAAN SETEMPAT: KALIMAT ASAL PERMINTAAN (OTOMATIS dari isian 11344)',
    sql=('SELECT CASE %s WHEN "P" THEN "#7036# mengajukan permohonan agar dilakukan pemeriksaan setempat atas objek sengketa" ' % huruf1(11344) +
         'WHEN "T" THEN "#7037# mengajukan permohonan agar dilakukan pemeriksaan setempat atas objek sengketa" '
         'ELSE "#8554# karena jabatannya memandang perlu dilakukan pemeriksaan setempat atas objek sengketa" END AS data'))
var(11346, 'PEMERIKSAAN SETEMPAT: OBJEK SENGKETA (OTOMATIS: isian 11347; kosong = isian objek jenis: HB/cerai kumulasi 8730, waris 8718, wasiat 9479, hibah 9795, wakaf 9826; lalu objek sita 9162)',
    sql=('SELECT COALESCE(%s, CASE p.jenis_perkara_id WHEN 346 THEN %s WHEN 347 THEN %s WHEN 348 THEN %s WHEN 364 THEN %s WHEN 365 THEN %s WHEN 366 THEN %s WHEN 367 THEN %s ELSE NULL END, %s, "...") AS data '
         % (nil(isian(11347)), nil(isian(8730)), nil(isian(8730)), nil(isian(8730)), nil(isian(8718)), nil(isian(9479)), nil(isian(9795)), nil(isian(9826)), nil(isian(9162))) + PERKARA))
var(11347, 'PEMERIKSAAN SETEMPAT: OBJEK YANG DIPERIKSA - ISIAN (salin dari surat gugatan; satu objek per baris dengan letak, luas dan batas-batas; kosong = isian objek jenis perkara)', tipe='data_teks')


def agenda(no, nama, bawaan):
    """Agenda sidang berikutnya: agenda sidang SESUDAH sidang yang dicetak (SIPP, ditulis saat menunda); kosong = alasan tunda sidang yang dicetak;
    keduanya kosong = bawaan. Kata "untuk" di depan dibuang (kalimat blangko sudah memuat "untuk"); huruf pertama dikecilkan."""
    def dari(kolom, geser):
        return ("(SELECT CONCAT(LOWER(LEFT(a.y, 1)), SUBSTRING(a.y, 2)) FROM (SELECT IF(LOWER(b.x) LIKE 'untuk %%%%', TRIM(SUBSTRING(b.x, 7)), b.x) AS y "
                "FROM (SELECT TRIM(REPLACE(REPLACE(CONVERT(IFNULL(j.%s, '') USING utf8), CHAR(13 USING utf8), ' '), CHAR(10 USING utf8), ' ')) AS x "
                "FROM perkara_jadwal_sidang j WHERE j.perkara_id = '#perkara_id#' AND j.urutan = CAST('#0050#' AS SIGNED) + %d LIMIT 1) b "
                "WHERE b.x REGEXP '[A-Za-z]') a)" % (kolom, geser))
    var(no, nama, sql=("SELECT COALESCE(%s, %s, '%s') AS data" % (dari('agenda', 1), dari('alasan_ditunda', 0), bawaan)) % ())


agenda(11348, 'PEMERIKSAAN SETEMPAT: AGENDA SIDANG BERIKUTNYA (OTOMATIS SIPP agenda sidang berikutnya / alasan tunda; kosong = penyampaian kesimpulan)', 'penyampaian kesimpulan')
var(11349, 'PEMERIKSAAN SETEMPAT: PEJABAT ATAU ORANG LAIN YANG HADIR - ISIAN (mis. petugas Kantor Pertanahan Kabupaten ... bernama ...; pemilik tanah yang berbatasan; kosong = tidak tercetak)', tipe='data_teks')
var(11350, 'PEMERIKSAAN SETEMPAT: KALIMAT PEJABAT LAIN YANG HADIR (OTOMATIS dari isian 11349; kosong bila tidak diisi)',
    sql="SELECT IF(%s, CONCAT('<br>Hadir pula ', %s, ', yang turut menyaksikan pemeriksaan setempat ini;'), '') AS data" % (ada(11349), isian(11349)))
var(11351, 'PEMERIKSAAN SETEMPAT: KESIMPULAN PENCOCOKAN - ISIAN (sesuai / tidak sesuai / sebagian, boleh diikuti keterangan sesudah titik dua, mis. sebagian: luas objek 2 hanya 300 m2)', tipe='data_teks')
K = isian(11351)
KET = "IF(LOCATE(':', %s) > 0, CONCAT(', yaitu ', TRIM(SUBSTRING(%s, LOCATE(':', %s) + 1))), '')" % (K, K, K)
DASAR = 'Berdasarkan hasil pemeriksaan setempat tersebut, objek sengketa yang ditemukan di lokasi '
var(11352, 'PEMERIKSAAN SETEMPAT: KALIMAT KESIMPULAN PENCOCOKAN (OTOMATIS dari isian 11351)',
    sql=('SELECT CASE WHEN NOT %s THEN "Berdasarkan hasil pemeriksaan setempat tersebut, keadaan objek sengketa di lokasi telah dicatat sebagaimana diuraikan di atas, dan penilaiannya akan dipertimbangkan bersama-sama dengan alat bukti lain dalam putusan akhir;" ' % ada(11351) +
         'WHEN LOWER(%s) LIKE "tidak%%" THEN CONCAT("%stidak sesuai dengan objek yang diuraikan dalam surat #0053# #7036#", %s, ";") ' % (K, DASAR, KET) +
         'WHEN LOWER(%s) LIKE "sebagian%%" THEN CONCAT("%ssebagian sesuai dengan objek yang diuraikan dalam surat #0053# #7036#", %s, ";") ' % (K, DASAR, KET) +
         'WHEN LOWER(%s) LIKE "sesuai%%" THEN CONCAT("%ssesuai dengan objek yang diuraikan dalam surat #0053# #7036#", %s, ";") ' % (K, DASAR, KET) +
         'ELSE CONCAT("Berdasarkan hasil pemeriksaan setempat tersebut, ", %s, ";") END AS data' % K))
var(11353, 'TanyaJwb Pemeriksaan Setempat #0046# di Lokasi Objek', tipe='tanya_jawab', referensi='0098', multi='tanyajawab')
var(11354, 'TanyaJwb Pemeriksaan Setempat #0047# di Lokasi Objek', tipe='tanya_jawab', referensi='0102', multi='tanyajawab')
var(11355, 'PEMERIKSAAN SETEMPAT: KETERANGAN APARAT DESA/KELURAHAN DI LOKASI - ISIAN (kalimat sesudah "menerangkan bahwa", tanpa titik akhir; kosong = tidak tercetak)', tipe='data_teks')
var(11356, 'PEMERIKSAAN SETEMPAT: KALIMAT KETERANGAN APARAT (OTOMATIS dari isian 11355 dan 9166; kosong bila tidak diisi)',
    sql=("SELECT IF(%s, CONCAT('<br>Atas pertanyaan #4004#, ', COALESCE(%s, 'aparat desa/kelurahan setempat'), ' menerangkan bahwa ', %s, ';'), '') AS data"
         % (ada(11355), nil(isian(9166)), isian(11355))))

# --- BAS sela ----------------------------------------------------------------------------------------------------------------
var(11357, 'SIDANG INSIDENTIL: HAL YANG DIPERIKSA - ISIAN (mis. eksepsi kewenangan absolut yang diajukan #0047#; tuntutan provisi #0046#; permohonan intervensi dari ...; tanpa titik akhir)', tipe='data_teks')
var(11358, 'SIDANG INSIDENTIL: KETERANGAN DAN TANGGAPAN PARA PIHAK - ISIAN (pokok keterangan para pihak, tanpa titik akhir)', tipe='data_teks')
var(11359, 'BAS SELA: SIDANG TERTUTUP PERKARA PERCERAIAN (OTOMATIS: cerai gugat/talak = kalimat sidang tertutup; lainnya kosong)',
    sql='SELECT IF(p.jenis_perkara_id IN (346, 347), "<br>Selanjutnya #4004# menyatakan sidang tertutup untuk umum;", "") AS data ' + PERKARA)
var(11360, 'BAS SELA: SIDANG DIBUKA KEMBALI UNTUK UMUM PERKARA PERCERAIAN (OTOMATIS: cerai = kalimat; lainnya kosong)',
    sql='SELECT IF(p.jenis_perkara_id IN (346, 347), "Kemudian #4004# menyatakan sidang terbuka kembali untuk umum;<br>", "") AS data ' + PERKARA)
var(11361, 'BAS SELA: JUDUL AMAR (OTOMATIS: permohonan = MENETAPKAN, gugatan = MENGADILI)',
    sql="SELECT IF(p.alur_perkara_id = 16, 'MENETAPKAN', 'MENGADILI') AS data " + PERKARA)
var(11362, 'PEMERIKSAAN SETEMPAT: RUJUKAN PUTUSAN SELA PEMERIKSAAN SETEMPAT (OTOMATIS SIPP perkara_putusan_sela yang memuat kata setempat; kosong bila tidak ada)',
    sql=("SELECT IFNULL((SELECT CONCAT(', sebagaimana diperintahkan dalam putusan sela tanggal ', aps_badilag.isian_rtf_tanggal(s.tanggal_putusan_sela)) "
         "FROM perkara_putusan_sela s WHERE s.perkara_id = '#perkara_id#' AND s.tanggal_putusan_sela > '1900-01-01' AND IFNULL(s.amar_sela, '') LIKE '%setempat%' "
         "ORDER BY s.tanggal_putusan_sela DESC LIMIT 1), '') AS data"))
var(11363, 'BAS SELA: KEHADIRAN #0047# (OTOMATIS: permohonan = kosong; gugatan = baris #0142#)',
    sql='SELECT IF(p.alur_perkara_id = 16, "", "<br>#0142#;") AS data ' + PERKARA)
agenda(11364, 'BAS SELA: AGENDA SIDANG SESUDAH PUTUSAN SELA (OTOMATIS SIPP agenda sidang berikutnya / alasan tunda; kosong = melanjutkan pemeriksaan pokok perkara)', 'melanjutkan pemeriksaan pokok perkara')
agenda(11365, 'BAS SELA: AGENDA SIDANG SESUDAH SUMPAH PELENGKAP (OTOMATIS SIPP agenda sidang berikutnya / alasan tunda; kosong = musyawarah dan pembacaan putusan/penetapan)', 'musyawarah dan pembacaan #0194#')
agenda(11366, 'BAS SELA: AGENDA SIDANG SESUDAH SIDANG INSIDENTIL (OTOMATIS SIPP agenda sidang berikutnya / alasan tunda; kosong = pembacaan putusan sela)', 'pembacaan putusan sela')

var(11367, 'BAS SELA: PIHAK YANG DIPANGGIL MENGHADAP (OTOMATIS: permohonan = #0046#; gugatan = #0046# dan #0047#)',
    sql='SELECT IF(p.alur_perkara_id = 16, "#7036#", "#7036# dan #7037#") AS data ' + PERKARA)

def _pihak(sisi):
    t = 'perkara_pihak%d' % sisi
    return ("IF(x.n%d <= 1, CONCAT('<strong>', IFNULL(x.nm%d, '...'), '</strong>, sebagai <strong>', x.s%d, '</strong>;'), "
            "aps_badilag.isian_rtf_pihak_nama(x.pid, %d, 1, x.s%d))" % (sisi, sisi, sisi, sisi, sisi)), t


var(11368, 'BAS: IDENTITAS SINGKAT PARA PIHAK (OTOMATIS SIPP: semua #0046#, lalu "melawan" dan semua #0047# pada gugatan; permohonan tanpa melawan; bernomor romawi bila lebih dari satu)',
    sql=("SELECT CONCAT(%s, IF(x.alur = 16, '', CONCAT('<br>melawan<br>', %s))) AS data FROM (SELECT p.perkara_id AS pid, p.alur_perkara_id AS alur, "
         "(SELECT COUNT(*) FROM perkara_pihak1 a WHERE a.perkara_id = p.perkara_id) AS n1, (SELECT COUNT(*) FROM perkara_pihak2 a WHERE a.perkara_id = p.perkara_id) AS n2, "
         "(SELECT TRIM(a.nama) FROM perkara_pihak1 a WHERE a.perkara_id = p.perkara_id ORDER BY a.urutan, a.id LIMIT 1) AS nm1, "
         "(SELECT TRIM(a.nama) FROM perkara_pihak2 a WHERE a.perkara_id = p.perkara_id ORDER BY a.urutan, a.id LIMIT 1) AS nm2, "
         "IF(p.alur_perkara_id = 16 OR p.jenis_perkara_id IN (346, 341), 'Pemohon', 'Penggugat') AS s1, "
         "IF(p.alur_perkara_id = 16 OR p.jenis_perkara_id IN (346, 341), 'Termohon', 'Tergugat') AS s2 " % (_pihak(1)[0], _pihak(2)[0]) + PERKARA + ") x"))

var(11369, 'BAS SELA: PRODUK AKHIR (OTOMATIS: permohonan = penetapan akhir; gugatan = putusan akhir)',
    sql="SELECT IF(p.alur_perkara_id = 16, 'penetapan akhir', 'putusan akhir') AS data " + PERKARA)

import variabel_31  # noqa: E402
variabel_31.tambah(var, isian, nil, ada, huruf1, PERKARA, UU_PA)

# turunan: kaki penetapan dalam pemeriksaan (sebutan "penetapan") dan pertimbangan biaya putusan akhir "tidak dapat diterima" umum
_kaki = next(x for x in V if x['no'] == 11311)
_ganti = "IF(p.alur_perkara_id = 16, 'penetapan sela', 'putusan sela')"
assert _kaki['sql'].count(_ganti) == 1
var(11402, 'PENETAPAN DALAM PEMERIKSAAN (mis. tidak beriktikad baik dalam mediasi): KAKI MAJELIS/TUNGGAL DENGAN KEHADIRAN (OTOMATIS seperti 11311, sebutan penetapan)',
    sql=_kaki['sql'].replace(_ganti, "'penetapan'"))
_biaya = next(x for x in V if x['no'] == 11319)
assert _biaya['sql'].count('oleh karena eksepsi #7037# dikabulkan, ') == 2
var(11403, 'GUGATAN TIDAK DAPAT DITERIMA (PUTUSAN AKHIR, mis. tidak beriktikad baik dalam mediasi): PERTIMBANGAN BIAYA PERKARA (OTOMATIS seperti 11319)',
    sql=_biaya['sql'].replace('oleh karena eksepsi #7037# dikabulkan, ', 'oleh karena #0053# #7036# dinyatakan tidak dapat diterima, '))

import variabel_32  # noqa: E402
variabel_32.tambah(var, isian, nil, ada, huruf1, PERKARA, UU_PA, V)

NOMOR = [x['no'] for x in V]
ISIAN = [x['no'] for x in V if x['tipe'] == 'data_teks']
