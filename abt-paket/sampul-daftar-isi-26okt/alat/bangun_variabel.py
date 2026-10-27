#!/usr/bin/env python3
# Definisi variabel ABT paket "sampul-daftar-isi-26okt" (sumber tunggal): dipakai bangun_paket.py (sumber/) dan menulis draf/variabel.json.
# Blok 5800-5899 (ciri, sampul, daftar isi) dan 5700-5779 (riwayat sidang: 20 baris x 4 kolom). Hanya ASCII; simbol memakai entitas HTML
# Tanda ciri di keluaran ABT: [+ ...] pendaftaran dan biaya, [* ...] pihak, [> ...] proses (ASCII; ABT mengubah entitas > 255 menjadi byte UTF-8 mentah: terbukti 26 Okt di renderer php56). Panel mengisi sendiri bentuk kotak/bulat/segitiga. Tag <b> dan <i> dibuang renderer ABT; <br> menjadi baris baru.
# Keputusan Derry 26 Okt: tag NON e-COURT dihapus (5804 kosong); cerai tanpa blok pokok perkara (5843 kosong untuk 346/347).
import json, os

P = '#perkara_id#'
BULAN = "'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'"
V = []   # (kode, nama, tipe, kueri)


def tgl_id(e):
    return "CONCAT(DAY(%s),' ',ELT(MONTH(%s),%s),' ',YEAR(%s))" % (e, e, BULAN, e)


def sql(kode, nama, q):
    V.append((kode, nama, 'data_sql', q))


def teks(kode, nama):
    V.append((kode, nama, 'data_teks', None))


def tag(kode, nama, kondisi, label, lambang):
    sql(kode, 'CIRI SAMPUL: %s (OTOMATIS; kosong = tidak berlaku)' % nama, "SELECT IF(%s,'%s','') AS data" % (kondisi, label))


def tag_sisi(kode, nama, a, b, label, lambang):
    sql(kode, 'CIRI SAMPUL: %s (OTOMATIS; sisi P/T; kosong = tidak berlaku)' % nama,
        "SELECT (CASE WHEN x.a AND x.b THEN '%s P+T' WHEN x.a THEN '%s P' WHEN x.b THEN '%s T' ELSE '' END) AS data "
        "FROM (SELECT %s AS a, %s AS b) x" % (label, label, label, a, b))


K, B, T3 = '+', '*', '>'   # penanda ASCII: '+' pendaftaran dan biaya, '*' pihak, '>' proses (renderer ABT mengubah entitas > 255 menjadi byte UTF-8 mentah, jadi simbol bentuk tidak dipakai di keluaran ABT)
# ---- ciri pendaftaran dan biaya
tag(5802, 'PRODEO', "IFNULL((SELECT prodeo FROM perkara WHERE perkara_id=%s),0)=1" % P, 'PRODEO', K)
tag(5803, 'e-COURT', "EXISTS(SELECT 1 FROM perkara_efiling_id WHERE perkara_id=%s AND efiling_id<>'')" % P, 'e-COURT', K)
# 5804 (NON e-COURT) DIHAPUS atas keputusan Derry 26 Okt: nomor dibiarkan kosong
tag_sisi(5805, 'KUASA HUKUM',
         "EXISTS(SELECT 1 FROM perkara_pengacara WHERE perkara_id=%s AND pihak_ke=1 AND aktif='Y')" % P,
         "EXISTS(SELECT 1 FROM perkara_pengacara WHERE perkara_id=%s AND pihak_ke=2 AND aktif='Y')" % P, 'KUASA HUKUM', K)
tag(5806, 'KUASA INSIDENTIL', "IFNULL((SELECT TRIM(data) FROM aps_badilag.abt_data_teks WHERE no_var=8537 AND perkara_id=%s),'')<>''" % P, 'KUASA INSIDENTIL', K)
# ---- ciri pihak: hasil analisa pada ALETA ditulis ke isian (data_teks); kosong = tidak berlaku
for kode, nm in ((5807, 'GHAIB'), (5808, 'MAFQUD'), (5809, 'PNS/ASN'), (5810, 'PPPK'), (5811, 'TNI'), (5812, 'POLRI'), (5813, 'BUMN/BUMD')):
    teks(kode, 'CIRI SAMPUL: %s (ISIAN OTOMATIS dari panel; kosong = tidak berlaku; contoh isi: %s T)' % (nm, nm))
tag_sisi(5814, 'DISABILITAS',
         "EXISTS(SELECT 1 FROM perkara_pihak1 k JOIN pihak h ON h.id=k.pihak_id WHERE k.perkara_id=%s AND h.difabel='Y')" % P,
         "EXISTS(SELECT 1 FROM perkara_pihak2 k JOIN pihak h ON h.id=k.pihak_id WHERE k.perkara_id=%s AND h.difabel='Y')" % P, 'DISABILITAS', B)
teks(5815, 'CIRI SAMPUL: PENERJEMAH (ISIAN TANGAN; isi PENERJEMAH bila perlu penerjemah/juru bahasa; kosong = tidak ada)')
tag_sisi(5816, 'WNA',
         "EXISTS(SELECT 1 FROM perkara_pihak1 k JOIN pihak h ON h.id=k.pihak_id WHERE k.perkara_id=%s AND IFNULL(h.warga_negara_id,98)<>98)" % P,
         "EXISTS(SELECT 1 FROM perkara_pihak2 k JOIN pihak h ON h.id=k.pihak_id WHERE k.perkara_id=%s AND IFNULL(h.warga_negara_id,98)<>98)" % P, 'WNA', B)
# ---- ciri proses
tag(5817, 'VERSTEK', "IFNULL((SELECT putusan_verstek FROM perkara_putusan WHERE perkara_id=%s LIMIT 1),'')='Y'" % P, 'VERSTEK', T3)
sql(5818, 'CIRI SAMPUL: KUMULASI (OTOMATIS dari perkara_kumulasi; kosong = tidak ada)',
    "SELECT IF(COUNT(*)>0,CONCAT('KUMULASI ',COUNT(*)),'') AS data FROM perkara_kumulasi WHERE perkara_id=%s" % P)
teks(5819, 'CIRI SAMPUL: REKONVENSI (ISIAN OTOMATIS dari panel; kosong = tidak berlaku)')
tag(5820, 'MEDIASI', "EXISTS(SELECT 1 FROM perkara_mediasi WHERE perkara_id=%s AND penetapan_penunjukan_mediator IS NOT NULL)" % P, 'MEDIASI', T3)
teks(5821, 'CIRI SAMPUL: SITA (ISIAN OTOMATIS dari panel; SIPP tidak mencatat sita di proses; kosong = tidak berlaku)')
tag(5822, 'SIDANG KELILING', "EXISTS(SELECT 1 FROM perkara_jadwal_sidang WHERE perkara_id=%s AND sidang_keliling='Y')" % P, 'SIDANG KELILING', T3)
tag(5823, 'HAKIM TUNGGAL', "(SELECT COUNT(*) FROM perkara_hakim_pn WHERE perkara_id=%s AND aktif='Y')=1" % P, 'HAKIM TUNGGAL', T3)
tag(5824, 'GUGATAN SEDERHANA', "IFNULL((SELECT alur_perkara_id FROM perkara WHERE perkara_id=%s),0)=17" % P, 'GUGATAN SEDERHANA', T3)
tag(5825, 'VERZET', "EXISTS(SELECT 1 FROM perkara_jadwal_sidang WHERE perkara_id=%s AND verzet='Y')" % P, 'VERZET', T3)
tag(5826, 'DISPENSASI KAWIN', "IFNULL((SELECT jenis_perkara_id FROM perkara WHERE perkara_id=%s),0)=362" % P, 'DISPENSASI KAWIN', T3)
tag(5827, 'IKRAR TALAK', "EXISTS(SELECT 1 FROM perkara_ikrar_talak WHERE perkara_id=%s)" % P, 'IKRAR TALAK', T3)

KODE_TAG = [k for k in range(5802, 5828) if k != 5804]
sql(5801, 'CIRI PERKARA SAMPUL (OTOMATIS: gabungan 5802 sampai 5827 tanpa 5804; kosong semua = tidak ada ciri khusus)',
    "SELECT IFNULL(NULLIF(TRIM(CONCAT_WS(CONCAT(' ',CHAR(183),' '),%s)),''),'- tidak ada ciri khusus -') AS data" % ','.join("NULLIF('#%d#','')" % k for k in KODE_TAG))
sql(5800, 'JENIS PERKARA SAMPUL (OTOMATIS: jenis perkara + kumulasi)',
    "SELECT CONCAT('#0048#',IFNULL((SELECT CONCAT(' Kumulasi ',REPLACE(GROUP_CONCAT(j.nama SEPARATOR '|'),'|',' dan ')) "
    "FROM perkara_kumulasi k JOIN jenis_perkara j ON j.id=k.jenis_perkara_id WHERE k.perkara_id=%s HAVING COUNT(*)>0),'')) AS data" % P)
sql(5829, 'BARIS IKRAR TALAK SAMPUL (OTOMATIS; kosong bila bukan cerai talak)',
    "SELECT IFNULL((SELECT CONCAT('<b>IKRAR TALAK</b> PMH ',IFNULL(%s,'-'),' - PHS ikrar ',IFNULL(%s,'-'),' - Sidang ikrar ',IFNULL(%s,'-')) "
    "FROM perkara_ikrar_talak i WHERE i.perkara_id=%s LIMIT 1),'') AS data" % (
        tgl_id('i.penetapan_majelis_hakim'), tgl_id('i.tanggal_penetapan_sidang_ikrar'), tgl_id('i.tgl_ikrar_talak'), P))
sql(5836, 'MEDIATOR SAMPUL (OTOMATIS dari mediasi terakhir)',
    "SELECT m.mediator_text AS data FROM perkara_mediasi m WHERE m.perkara_id=%s ORDER BY m.mediasi_id DESC LIMIT 1" % P)
sql(5837, 'HASIL MEDIASI SAMPUL (OTOMATIS: tanggal berhasil/gagal di SIPP; kosong bila belum dicatat)',
    "SELECT (CASE WHEN m.mediasi_berhasil IS NOT NULL THEN 'Berhasil' WHEN m.mediasi_gagal IS NOT NULL THEN 'Tidak berhasil' ELSE '' END) AS data "
    "FROM perkara_mediasi m WHERE m.perkara_id=%s ORDER BY m.mediasi_id DESC LIMIT 1" % P)
teks(5839, 'KONSEPTOR SAMPUL (ISIAN TANGAN)')
sql(5840, 'TGL PEMBERITAHUAN PUTUSAN / PBT (OTOMATIS: terakhir)',
    "SELECT MAX(tanggal_pemberitahuan_putusan) AS data FROM perkara_putusan_pemberitahuan_putusan WHERE perkara_id=%s" % P)

# ---- sampul mengikuti jenis perkara (id jenis SIPP: 362 dispensasi, 360 itsbat, 358 asal usul anak, 354 perwalian, 363 wali adhol, 371 P3HP)
sql(5841, 'SEBUTAN PIHAK I SAMPUL (OTOMATIS menurut jenis perkara; selain yang dikhususkan = #8146#)',
    "SELECT (CASE p.jenis_perkara_id WHEN 362 THEN 'PEMOHON (ORANG TUA / WALI)' WHEN 360 THEN 'PEMOHON I' WHEN 363 THEN 'PEMOHON (CALON MEMPELAI)' "
    "WHEN 354 THEN 'PEMOHON (CALON WALI)' WHEN 371 THEN 'PEMOHON (AHLI WARIS)' ELSE '#8146#' END) AS data FROM perkara p WHERE p.perkara_id=%s" % P)
teks(5845, 'FOKUS SAMPUL (ISIAN TANGAN; dipakai bila jenis perkara belum punya kueri otomatis: nama anak, calon mempelai, pewaris, dan seterusnya)')
teks(5846, 'POKOK PERKARA SAMPUL (ISIAN TANGAN; baris dipisah <br>, dipakai bila jenis perkara belum punya kueri otomatis)')
sql(5842, 'FOKUS PERKARA SAMPUL (OTOMATIS: dispensasi kawin = anak yang dimohonkan; itsbat nikah = pasangan; asal usul anak = anak; lainnya = isian 5845; cerai kosong)',
    "SELECT (CASE p.jenis_perkara_id "
    "WHEN 362 THEN CONCAT('<b>ANAK YANG DIMOHONKAN DISPENSASI</b><br>', IFNULL((SELECT IF(CAST(IFNULL(u.data,'99') AS UNSIGNED)<19 OR IFNULL(w.data,'')='', n.data, w.data) "
    "FROM aps_badilag.abt_data_teks n LEFT JOIN aps_badilag.abt_data_teks u ON u.no_var=601 AND u.perkara_id=n.perkara_id "
    "LEFT JOIN aps_badilag.abt_data_teks w ON w.no_var=606 AND w.perkara_id=n.perkara_id WHERE n.no_var=600 AND n.perkara_id=p.perkara_id), '')) "
    "WHEN 360 THEN CONCAT('<b>PASANGAN YANG DIITSBATKAN</b><br>', IFNULL((SELECT GROUP_CONCAT(k.nama ORDER BY k.urutan SEPARATOR ' dan ') FROM perkara_pihak1 k WHERE k.perkara_id=p.perkara_id AND k.urutan<=2), '')) "
    "WHEN 358 THEN CONCAT('<b>ANAK YANG DIMOHONKAN ASAL USULNYA</b><br>', IFNULL((SELECT a.nama_anak FROM perkara_anak_pihak a WHERE a.perkara_id=p.perkara_id ORDER BY a.id LIMIT 1), '')) "
    "WHEN 346 THEN '' WHEN 347 THEN '' "
    "ELSE IFNULL((SELECT TRIM(data) FROM aps_badilag.abt_data_teks WHERE no_var=5845 AND perkara_id=p.perkara_id), '') END) AS data FROM perkara p WHERE p.perkara_id=%s" % P)
sql(5843, 'POKOK PERKARA SAMPUL (OTOMATIS menurut jenis: itsbat = tanggal/tempat/alasan; dispensasi = alasan; cerai kosong; lainnya = isian 5846)',
    "SELECT (CASE "
    "WHEN p.jenis_perkara_id IN (346,347) THEN '' "
    "WHEN p.jenis_perkara_id=360 THEN CONCAT('<b>PERNIKAHAN YANG DIITSBATKAN</b><br>Tanggal menikah: ', IFNULL(%s,'-'), '<br>Tempat menikah: ', IFNULL(i.tempat_menikah,'-'), '<br>Alasan: ', "
    "IFNULL((SELECT GROUP_CONCAT(l.nama SEPARATOR '; ') FROM perkara_alasan_nikah l WHERE l.perkara_id=p.perkara_id),'-')) "
    "WHEN p.jenis_perkara_id=362 THEN CONCAT('<b>ANAK DAN CALON PASANGAN</b><br>Alasan dispensasi: ', IFNULL((SELECT GROUP_CONCAT(l.nama SEPARATOR '; ') FROM perkara_alasan_nikah l WHERE l.perkara_id=p.perkara_id),'-')) "
    "ELSE IFNULL((SELECT TRIM(data) FROM aps_badilag.abt_data_teks WHERE no_var=5846 AND perkara_id=p.perkara_id), '') END) AS data "
    "FROM perkara p LEFT JOIN perkara_data_itsbat i ON i.perkara_id=p.perkara_id WHERE p.perkara_id=%s" % (tgl_id('i.tgl_menikah'), P))

# ---- daftar isi: 4 kolom per bundel (fungsi tersimpan isian_rtf_daftar_isi)
for bundel, awal in (('A', 5851), ('B', 5856)):
    for kol, nm in ((1, 'NO'), (2, 'JENIS DOKUMEN'), (3, 'TANGGAL'), (4, 'HALAMAN')):
        sql(awal + kol - 1, 'DAFTAR ISI BUNDEL %s: %s (OTOMATIS; satu baris per dokumen yang ada)' % (bundel, nm),
            "SELECT aps_badilag.isian_rtf_daftar_isi(%s,'%s',%d) AS data" % (P, bundel, kol))

# ---- riwayat sidang: 20 baris x 4 kolom (tgl, hadir, agenda, alasan); sidang ke-n = urutan tanggal tanpa sidang ikrar
KODE_RIWAYAT = 5700
def bersih(kolom):
    # nilai bermakna kosong dari SIPP ("0", "-", "--", titik, garis bawah) tidak dicetak: sel dikosongkan
    return "IF(TRIM(IFNULL(%s,'')) REGEXP '^[-0._ ]*$','',%s)" % (kolom, kolom)


HADIR = "(CASE dihadiri_oleh WHEN 1 THEN 'P T' WHEN 2 THEN 'P' WHEN 3 THEN 'T' WHEN 4 THEN '-' WHEN 5 THEN 'I' ELSE '' END)"
for n in range(1, 21):
    pilih = "FROM perkara_jadwal_sidang WHERE perkara_id=%s AND IFNULL(ikrar_talak,'T')<>'Y' ORDER BY tanggal_sidang, id LIMIT %d,1" % (P, n - 1)
    k = KODE_RIWAYAT + (n - 1) * 4
    sql(k, 'RIWAYAT SIDANG SAMPUL baris %d: tanggal sidang' % n, "SELECT tanggal_sidang AS data " + pilih)
    sql(k + 1, 'RIWAYAT SIDANG SAMPUL baris %d: kehadiran (P T / P / T / -)' % n, "SELECT %s AS data " % HADIR + pilih)
    sql(k + 2, 'RIWAYAT SIDANG SAMPUL baris %d: agenda / hasil' % n, "SELECT CONCAT(%s,IF(sidang_keliling='Y',' (sidang keliling)','')) AS data " % bersih('agenda') + pilih)
    sql(k + 3, 'RIWAYAT SIDANG SAMPUL baris %d: alasan penundaan / keterangan' % n, "SELECT %s AS data " % bersih('alasan_ditunda') + pilih)

# ---- SAMPUL CETAK AWAL (keputusan Derry 26 Okt, versi 3): ciri yang sudah diketahui, ciri susulan, putusan, hadir per baris
# Kotak centang ditulis ASCII "[ ]" / "[X]" (portal mengubahnya menjadi kotak saat naskah disusun). "Berlawanan" = nomor perkara memuat /Pdt.G (gugatan dan cerai talak).
LAWAN = "(SELECT IF(p0.nomor_perkara LIKE '%/Pdt.G%',1,0) FROM perkara p0 WHERE p0.perkara_id=#perkara_id#)"
KODE_CIRI_AWAL = [k for k in KODE_TAG if k not in (5807, 5808, 5817, 5818, 5819, 5820, 5821)]   # tanpa ghaib dan mafqud (bingkai ganda, runut sendiri), kumulasi (sudah di judul), verstek (sifat putusan), rekonvensi, mediasi, sita (kotak centang, pita mediasi)
sql(5861, 'CIRI PERKARA AWAL SAMPUL (OTOMATIS: ciri yang berlaku dan sudah diketahui saat daftar; tanpa ghaib, mafqud, verstek, rekonvensi, mediasi, sita)',
    "SELECT IFNULL(NULLIF(TRIM(CONCAT_WS(CONCAT(' ',CHAR(183),' '),%s)),''),'- tidak ada ciri khusus -') AS data" % ','.join("NULLIF('#%d#','')" % k for k in KODE_CIRI_AWAL))
SUSULAN_LAWAN = '[ ] MEDIASI   [ ] EKSEPSI   [ ] REKONVENSI   [ ] PERMINTAAN SITA   [ ] PEMERIKSAAN SETEMPAT   [ ] PUTUSAN SELA   [ ] PERUBAHAN GUGATAN   [ ] TAMBAHAN PANJAR   [ ] PENCABUTAN'
SUSULAN_MOHON = '[ ] PERBAIKAN PERMOHONAN   [ ] PEMERIKSAAN SETEMPAT   [ ] TAMBAHAN PANJAR   [ ] PENCABUTAN'
sql(5862, 'CIRI SUSULAN SAMPUL (KOTAK CENTANG menurut jenis perkara; dicentang tangan; panel mencentang otomatis yang terdeteksi dari data)',
    "SELECT (CASE WHEN p.nomor_perkara LIKE '%/Pdt.G%' THEN '" + SUSULAN_LAWAN + "' "
    "WHEN p.jenis_perkara_id=362 THEN '" + SUSULAN_MOHON + "   [ ] ANAK & CALON DIDENGAR' "
    "WHEN p.jenis_perkara_id=360 THEN '" + SUSULAN_MOHON + "   [ ] PENGUMUMAN 14 HARI' "
    "ELSE '" + SUSULAN_MOHON + "' END) AS data FROM perkara p WHERE p.perkara_id=" + P)
STATUS_KABUL = '62,1,2,30,34,117,133'
STATUS_TOLAK = '63,3,32,35,119,134'
STATUS_NO = '64,61,4,33,36,84,120'
STATUS_GUGUR = '65,93,6,29,31,38,118'
STATUS_CABUT = '67,7,37'
STATUS_DAMAI = '85,5'


def kotak_status(daftar, label):
    return "CONCAT(IF(x.s IN (%s),'[X]','[ ]'),' %s')" % (daftar, label)


sql(5863, 'AMAR PUTUSAN SAMPUL (KOTAK CENTANG; terisi dari status putusan SIPP bila sudah ada; perkara berlawanan enam pilihan, permohonan empat)',
    "SELECT CONCAT_WS('   ',%s,%s,%s,IF(x.l=1,%s,NULL),%s,IF(x.l=1,%s,NULL)) AS data FROM (SELECT %s AS l, (SELECT status_putusan_id FROM perkara_putusan WHERE perkara_id=%s LIMIT 1) AS s) x"
    % (kotak_status(STATUS_KABUL, 'KABUL'), kotak_status(STATUS_TOLAK, 'TOLAK'), kotak_status(STATUS_NO, 'TIDAK DITERIMA (NO)'), kotak_status(STATUS_GUGUR, 'GUGUR'),
       kotak_status(STATUS_CABUT, 'DICABUT'), kotak_status(STATUS_DAMAI, 'DAMAI'), LAWAN, P))
sql(5864, 'SIFAT PUTUSAN SAMPUL (KOTAK CENTANG: hadir/kontradiktoir dan verstek; terisi dari putusan_verstek SIPP bila putusan sudah ada)',
    "SELECT (CASE WHEN x.l=1 THEN CONCAT(IF(x.t IS NOT NULL AND IFNULL(x.v,'T')<>'Y','[X]','[ ]'),' HADIR (KONTRADIKTOIR)   ',IF(x.t IS NOT NULL AND x.v='Y','[X]','[ ]'),' VERSTEK') "
    "ELSE CONCAT(IF(x.t IS NOT NULL,'[X]','[ ]'),' HADIR') END) AS data FROM (SELECT %s AS l, "
    "(SELECT tanggal_putusan FROM perkara_putusan WHERE perkara_id=%s LIMIT 1) AS t, (SELECT putusan_verstek FROM perkara_putusan WHERE perkara_id=%s LIMIT 1) AS v) x" % (LAWAN, P, P))
sql(5865, 'KONSEPTOR PUTUSAN SAMPUL (isian tangan 5839 bila ada; kalau tidak, pengguna tahapan putusan di SIPP; kosong = ditulis tangan)',
    "SELECT CONVERT(IFNULL(NULLIF(TRIM(CONVERT((SELECT data FROM aps_badilag.abt_data_teks WHERE no_var=5839 AND perkara_id=%s LIMIT 1) USING latin1)),''), "
    "CONVERT((SELECT IFNULL(NULLIF(u.fullname,''),pr.diinput_oleh) FROM perkara_proses pr LEFT JOIN sys_users u ON BINARY u.username=BINARY pr.diinput_oleh "
    "WHERE pr.perkara_id=%s AND pr.proses_id=210 ORDER BY pr.diinput_tanggal DESC LIMIT 1) USING latin1)) USING latin1) AS data" % (P, P))
sql(5866, 'HASIL MEDIASI SAMPUL (KOTAK CENTANG; terisi dari tanggal berhasil/gagal di SIPP bila sudah dicatat)',
    "SELECT CONCAT(IF(m.b IS NOT NULL,'[X]','[ ]'),' BERHASIL   [ ] BERHASIL SEBAGIAN   ',IF(m.g IS NOT NULL AND m.b IS NULL,'[X]','[ ]'),' TIDAK BERHASIL   [ ] TIDAK DAPAT DILAKSANAKAN') AS data "
    "FROM (SELECT 1 AS d) z LEFT JOIN (SELECT mediasi_berhasil AS b, mediasi_gagal AS g FROM perkara_mediasi WHERE perkara_id=%s ORDER BY mediasi_id DESC LIMIT 1) m ON 1=1" % P)
sql(5867, 'JENIS PERKARA SAMPUL AWAL (OTOMATIS: jenis perkara; diberi kata Kumulasi bila berkumulasi)',
    "SELECT CONCAT('#0048#',IF(EXISTS(SELECT 1 FROM perkara_kumulasi k WHERE k.perkara_id=%s),' Kumulasi','')) AS data" % P)
sql(5868, 'BARIS KUMULASI SAMPUL AWAL (OTOMATIS dari perkara_kumulasi; kosong bila tidak berkumulasi)',
    "SELECT CONCAT('Kumulasi: ',REPLACE(GROUP_CONCAT(j.nama SEPARATOR '|'),'|',' dan ')) AS data FROM perkara_kumulasi k JOIN jenis_perkara j ON j.id=k.jenis_perkara_id WHERE k.perkara_id=%s HAVING COUNT(*)>0" % P)
sql(5869, 'MAJELIS SAMPUL AWAL (OTOMATIS: satu hakim per baris; Ketua, Anggota, atau Hakim tunggal)',
    "SELECT GROUP_CONCAT(CONCAT(b.nama_gelar,' (',IF(x.n=1,'Hakim tunggal',IF(a.urutan=1,'Ketua','Anggota')),')') ORDER BY a.urutan SEPARATOR '<br>') AS data "
    "FROM perkara_hakim_pn a JOIN hakim_pn b ON a.hakim_id=b.id JOIN (SELECT COUNT(*) AS n FROM perkara_hakim_pn WHERE aktif='Y' AND perkara_id=%s) x "
    "WHERE a.aktif='Y' AND a.perkara_id=%s" % (P, P))
# ---- PIHAK BANYAK (kewarisan, penetapan ahli waris, dan sebagainya): pihak I lengkap, selebihnya nama bernomor romawi dua kolom; batas tampil
#      8 nama per sisi (perkara berlawanan) atau 12 (permohonan); lebihnya "dan N lainnya" + Lampiran Daftar Para Pihak (disusun portal).
ROMAWI = ','.join("'%s'" % r for r in ('I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'))
MUAT = "IF(%s=1,8,12)" % LAWAN


def jumlah_sisi(tabel):
    return "(SELECT COUNT(*) FROM %s WHERE perkara_id=%s)" % (tabel, P)


def kolom_pihak(tabel, kiri):
    tot = jumlah_sisi(tabel)
    tampil = "IF(%s>%s,%s-2,%s-1)" % (tot, MUAT, MUAT, tot)           # jumlah nama sesudah pihak I yang ditampilkan
    separuh = "CEIL(%s/2)" % tampil
    batas = ("a.urutan BETWEEN 2 AND 1+%s" % separuh) if kiri else ("a.urutan BETWEEN 2+%s AND 1+%s" % (separuh, tampil))
    daftar = "GROUP_CONCAT(CONCAT(ELT(a.urutan,%s),'. ',a.nama) ORDER BY a.urutan SEPARATOR '<br>')" % ROMAWI
    if kiri:
        return "SELECT %s AS data FROM %s a WHERE a.perkara_id=%s AND %s" % (daftar, tabel, P, batas)
    lainnya = "IF(%s>%s,CONCAT('dan ',%s-%s-1,' lainnya - lengkap di Lampiran Daftar Para Pihak'),NULL)" % (tot, MUAT, tot, tampil)
    return "SELECT CONCAT_WS('<br>',(SELECT %s FROM %s a WHERE a.perkara_id=%s AND %s),%s) AS data" % (daftar, tabel, P, batas, lainnya)


sql(5890, 'PIHAK BANYAK SAMPUL: pihak I (penggugat/pemohon), kolom kiri nama II dan seterusnya (romawi, satu per baris)', kolom_pihak('perkara_pihak1', True))
sql(5891, 'PIHAK BANYAK SAMPUL: pihak I, kolom kanan (dan keterangan "dan N lainnya" bila melebihi batas tampil)', kolom_pihak('perkara_pihak1', False))
sql(5892, 'PIHAK BANYAK SAMPUL: pihak II (tergugat/termohon), kolom kiri', kolom_pihak('perkara_pihak2', True))
sql(5893, 'PIHAK BANYAK SAMPUL: pihak II, kolom kanan (dan keterangan "dan N lainnya" bila melebihi batas tampil)', kolom_pihak('perkara_pihak2', False))
sql(5894, 'SEBUTAN PIHAK I SAMPUL AWAL (sebutan + jumlah orang bila lebih dari satu)',
    "SELECT CONCAT('#5841#',IF(%s>1,CONCAT(' (',%s,' ORANG)'),'')) AS data" % (jumlah_sisi('perkara_pihak1'), jumlah_sisi('perkara_pihak1')))
sql(5895, 'SEBUTAN PIHAK II SAMPUL AWAL (sebutan + jumlah orang bila lebih dari satu)',
    "SELECT CONCAT('#8147#',IF(%s>1,CONCAT(' (',%s,' ORANG)'),'')) AS data" % (jumlah_sisi('perkara_pihak2'), jumlah_sisi('perkara_pihak2')))
sql(5896, 'KUASA PIHAK I SAMPUL AWAL: keterangan "(untuk Penggugat I-IX)" bila pihak I lebih dari satu dan berkuasa',
    "SELECT IF(%s>1 AND EXISTS(SELECT 1 FROM perkara_pengacara WHERE perkara_id=%s AND pihak_ke=1 AND aktif='Y'),"
    "CONCAT('(untuk ',IF(%s=1 AND (SELECT jenis_perkara_id FROM perkara WHERE perkara_id=%s)<>346,'Penggugat','Pemohon'),' I-',ELT(LEAST(%s,20),%s),')'),'') AS data"
    % (jumlah_sisi('perkara_pihak1'), P, LAWAN, P, jumlah_sisi('perkara_pihak1'), ROMAWI))
sql(5897, 'TURUT TERGUGAT SAMPUL (tiga nama sebaris; lebihnya "dan N lainnya" ke lampiran; kosong bila tidak ada)',
    "SELECT CONCAT('TURUT TERGUGAT (',COUNT(*),') ',GROUP_CONCAT(CASE WHEN a.urutan<=3 THEN CONCAT(ELT(a.urutan,%s),'. ',a.nama) END ORDER BY a.urutan SEPARATOR ' - '),"
    "IF(COUNT(*)>3,CONCAT(' - dan ',COUNT(*)-3,' lainnya (lampiran)'),'')) AS data FROM perkara_pihak4 a WHERE a.perkara_id=%s HAVING COUNT(*)>0" % (ROMAWI, P))
def nama_pertama(tabel):
    n = jumlah_sisi(tabel)
    return "SELECT CONCAT(IF(%s>1,'I. ',''),IFNULL((SELECT a.nama FROM %s a WHERE a.perkara_id=%s ORDER BY a.urutan LIMIT 1),'')) AS data" % (n, tabel, P)


def rincian_pertama(tabel):
    return ("SELECT CONCAT('Pekerjaan: ',IFNULL(NULLIF(h.pekerjaan,''),'-'),' - Alamat: ',IFNULL(a.alamat,'')) AS data FROM %s a LEFT JOIN pihak h ON h.id=a.pihak_id "
            "WHERE a.perkara_id=%s ORDER BY a.urutan LIMIT 1" % (tabel, P))


sql(5898, 'NAMA PIHAK I SAMPUL AWAL (langsung dari SIPP; diawali "I. " bila pihak I lebih dari satu)', nama_pertama('perkara_pihak1'))
sql(5899, 'NAMA PIHAK II SAMPUL AWAL (langsung dari SIPP; diawali "I. " bila pihak II lebih dari satu)', nama_pertama('perkara_pihak2'))
sql(5830, 'PEKERJAAN DAN ALAMAT PIHAK I SAMPUL AWAL (langsung dari SIPP)', rincian_pertama('perkara_pihak1'))
sql(5831, 'PEKERJAAN DAN ALAMAT PIHAK II SAMPUL AWAL (langsung dari SIPP)', rincian_pertama('perkara_pihak2'))

sql(5832, 'ANAK SAMPUL AWAL (OTOMATIS: satu sampai tiga anak sebaris dari tab Anak SIPP; lebih dari tiga masuk lampiran; kosong bila tidak ada)',
    "SELECT CONCAT('Anak: ',GROUP_CONCAT(a.nama_anak ORDER BY a.anak_ke,a.id SEPARATOR '; ')) AS data FROM perkara_anak_pihak a WHERE a.perkara_id=%s AND TRIM(IFNULL(a.nama_anak,''))<>'' HAVING COUNT(*) BETWEEN 1 AND 3" % P)
sql(5833, 'KAKI SAMPUL AWAL: rujukan lampiran (diisi saat naskah disusun; kosong bila tidak ada lampiran)', "SELECT '' AS data")
sql(5834, 'CATATAN SAMPUL: ALASAN (diisi saat naskah disusun dari deteksi; ABT langsung: kosong)', "SELECT '' AS data")
sql(5835, 'CATATAN SAMPUL: KETERANGAN (diisi saat naskah disusun; ABT langsung: kosong)', "SELECT '' AS data")
sql(5847, 'INTERVENSI SAMPUL AWAL (OTOMATIS: pihak intervensi dari SIPP, tiga nama sebaris; kosong bila tidak ada)',
    "SELECT CONCAT('INTERVENSI (',COUNT(*),') ',GROUP_CONCAT(CASE WHEN a.urutan<=3 THEN CONCAT(ELT(a.urutan,%s),'. ',a.nama) END ORDER BY a.urutan SEPARATOR ' - '),"
    "IF(COUNT(*)>3,CONCAT(' - dan ',COUNT(*)-3,' lainnya (lampiran)'),'')) AS data FROM perkara_pihak3 a WHERE a.perkara_id=%s HAVING COUNT(*)>0" % (ROMAWI, P))
# ---- CEKLIST BERKAS PERKARA (Meja I): kerangka lewat variabel; tabel dokumen disusun portal (paragraf penanda 5850)
sql(5850, 'CEKLIST: PENANDA TABEL (diganti tabel dokumen saat naskah disusun; ABT langsung: keterangan)', "SELECT 'Tabel dokumen disusun otomatis saat dicetak dari panel Blangko.' AS data")
sql(5848, 'CEKLIST: RINGKASAN (diisi saat naskah disusun; ABT langsung: kosong)', "SELECT '' AS data")
sql(5849, 'CEKLIST: PANITERA PENGGANTI (dari penetapan PPP; kosong = garis titik)',
    "SELECT IFNULL(NULLIF(TRIM(REPLACE(REPLACE(panitera_pengganti_text,'Panitera Pengganti:',''),'Panitera Pengganti :','')),''),'.................................') AS data FROM perkara_penetapan WHERE perkara_id=%s" % P)
sql(5838, 'CEKLIST: PETUGAS MEJA I (akun pencetak; diisi saat naskah disusun)', "SELECT '.................................' AS data")
sql(5855, 'CEKLIST: KOTA DAN TANGGAL (diisi saat naskah disusun)', "SELECT '.................., ..................' AS data")
sql(5860, 'CEKLIST: PENANDA JENIS PERKARA (CT/CG menyala sesuai perkara; jenis lain satu kode)',
    "SELECT (CASE p.jenis_perkara_id WHEN 346 THEN '[X] CT   [ ] CG' WHEN 347 THEN '[ ] CT   [X] CG' WHEN 362 THEN '[X] DK' WHEN 360 THEN '[X] IN' WHEN 364 THEN '[X] WR' WHEN 371 THEN '[X] PAW' WHEN 348 THEN '[X] HB' "
    "WHEN 370 THEN '[X] ES' WHEN 358 THEN '[X] AU' WHEN 354 THEN '[X] PW' WHEN 363 THEN '[X] WA' WHEN 341 THEN '[X] IP' ELSE '[X] LN' END) AS data FROM perkara p WHERE p.perkara_id=%s" % P)
KODE_HADIR = 5870   # baris n (1..20): kotak hadir P / T
for n in range(1, 21):
    sql(KODE_HADIR + n - 1, 'RIWAYAT SIDANG SAMPUL AWAL baris %d: kotak hadir P/T (terisi bila sidang itu sudah tercatat; permohonan hanya P)' % n,
        "SELECT IFNULL((SELECT (CASE WHEN %s=1 THEN CONCAT(IF(s.d IN (1,2),'[X]','[ ]'),' P   ',IF(s.d IN (1,3),'[X]','[ ]'),' T') ELSE CONCAT(IF(s.d IN (1,2),'[X]','[ ]'),' P') END) "
        "FROM (SELECT dihadiri_oleh AS d FROM perkara_jadwal_sidang WHERE perkara_id=%s AND IFNULL(ikrar_talak,'T')<>'Y' ORDER BY tanggal_sidang, id LIMIT %d,1) s), "
        "(CASE WHEN %s=1 THEN '[ ] P   [ ] T' ELSE '[ ] P' END)) AS data" % (LAWAN, P, n - 1, LAWAN))

# variabel lama yang dirujuk RTF/kueri paket (harus ada di server; PRASYARAT memeriksanya)
RUJUKAN = [1, 12, 13, 14, 15, 18, 38, 48, 55, 98, 100, 101, 102, 104, 105, 106, 168, 170, 180, 191, 1033, 1036, 1060, 1061, 1064, 1069, 1278, 8010, 8012, 8146, 8147]


def cek():
    kodes = [v[0] for v in V]
    assert len(set(kodes)) == len(kodes), 'kode ganda'
    assert all((5700 <= k <= 5779) or (5800 <= k <= 5899) for k in kodes), 'di luar blok'
    for kode, nama, tipe, kueri in V:
        assert 'aleta' not in (nama + (kueri or '')).lower()
        assert all(ord(c) < 128 for c in nama + (kueri or '')), kode


if __name__ == '__main__':
    cek()
    akar = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tuj = os.path.join(akar, 'sumber')
    os.makedirs(tuj, exist_ok=True)
    with open(os.path.join(tuj, 'variabel.json'), 'w', encoding='ascii') as f:
        json.dump([{'no_var': k, 'nama': n, 'data_type': t, 'sql_query': c} for k, n, t, c in V], f, indent=1)
    print(len(V), 'variabel')
