#!/usr/bin/env python3
# DRAF (26 Okt 2026) - TIDAK DIUJI. Menyusun draf/VARIABEL-DRAF.sql (INSERT ... WHERE NOT EXISTS, aman diulang) dan
# draf/variabel-draf.json dari definisi di bawah. Blok 5800-5899 (kosong di server per 26 Okt). Hanya ASCII; simbol memakai entitas HTML
# (&#9632; kotak, &#9679; bulat, &#9650; segitiga) - WAJIB diuji di renderer php56 ABT.
# Tidak ada kata nama aplikasi di nama/kueri variabel.
import json, os, sys

P = '#perkara_id#'
BULAN = "'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'"

def tgl_id(e):
    return "CONCAT(DAY(%s),' ',ELT(MONTH(%s),%s),' ',YEAR(%s))" % (e, e, BULAN, e)

V = []   # (kode, nama, tipe, kueri)

def sql(kode, nama, q):
    V.append((kode, nama, 'data_sql', q))

def teks(kode, nama):
    V.append((kode, nama, 'data_teks', None))

def tag(kode, nama, kondisi, label, lambang):
    sql(kode, 'CIRI SAMPUL: %s (OTOMATIS; kosong = tidak berlaku)' % nama,
        "SELECT IF(%s,'[&#%d; %s]','') AS data" % (kondisi, lambang, label))

def tag_sisi(kode, nama, a, b, label, lambang):
    sql(kode, 'CIRI SAMPUL: %s (OTOMATIS; sisi P/T; kosong = tidak berlaku)' % nama,
        "SELECT (CASE WHEN x.a AND x.b THEN '[&#%d; %s P+T]' WHEN x.a THEN '[&#%d; %s P]' WHEN x.b THEN '[&#%d; %s T]' ELSE '' END) AS data "
        "FROM (SELECT %s AS a, %s AS b) x" % (lambang, label, lambang, label, lambang, label, a, b))

K, B, T3 = 9632, 9679, 9650   # kotak, bulat, segitiga
# --- ciri pendaftaran dan biaya
tag(5802, 'PRODEO', "IFNULL((SELECT prodeo FROM perkara WHERE perkara_id=%s),0)=1" % P, 'PRODEO', K)
tag(5803, 'e-COURT', "EXISTS(SELECT 1 FROM perkara_efiling_id WHERE perkara_id=%s AND efiling_id<>'')" % P, 'e-COURT', K)
# 5804 (NON e-COURT) DIHAPUS atas keputusan 26 Okt: hanya e-COURT yang diberi tag; nomor 5804 dibiarkan kosong
tag_sisi(5805, 'KUASA HUKUM',
         "EXISTS(SELECT 1 FROM perkara_pengacara WHERE perkara_id=%s AND pihak_ke=1 AND aktif='Y')" % P,
         "EXISTS(SELECT 1 FROM perkara_pengacara WHERE perkara_id=%s AND pihak_ke=2 AND aktif='Y')" % P, 'KUASA HUKUM', K)
tag(5806, 'KUASA INSIDENTIL', "IFNULL((SELECT TRIM(data) FROM aps_badilag.abt_data_teks WHERE no_var=8537 AND perkara_id=%s),'')<>''" % P, 'KUASA INSIDENTIL', K)
# --- ciri pihak: hasil analisa ALETA ditulis ke isian (data_teks), kosong = tidak berlaku
for kode, nm in ((5807, 'GHAIB'), (5808, 'MAFQUD'), (5809, 'PNS/ASN'), (5810, 'PPPK'), (5811, 'TNI'), (5812, 'POLRI'), (5813, 'BUMN/BUMD')):
    teks(kode, 'CIRI SAMPUL: %s (ISIAN OTOMATIS dari panel; kosong = tidak berlaku; contoh isi: [&#%d; %s T])' % (nm, B, nm))
tag_sisi(5814, 'DISABILITAS',
         "EXISTS(SELECT 1 FROM perkara_pihak1 k JOIN pihak h ON h.id=k.pihak_id WHERE k.perkara_id=%s AND h.difabel='Y')" % P,
         "EXISTS(SELECT 1 FROM perkara_pihak2 k JOIN pihak h ON h.id=k.pihak_id WHERE k.perkara_id=%s AND h.difabel='Y')" % P, 'DISABILITAS', B)
teks(5815, 'CIRI SAMPUL: PENERJEMAH (ISIAN TANGAN; isi [&#9679; PENERJEMAH] bila perlu penerjemah/juru bahasa; kosong = tidak ada)')
tag_sisi(5816, 'WNA',
         "EXISTS(SELECT 1 FROM perkara_pihak1 k JOIN pihak h ON h.id=k.pihak_id WHERE k.perkara_id=%s AND IFNULL(h.warga_negara_id,1)<>1)" % P,
         "EXISTS(SELECT 1 FROM perkara_pihak2 k JOIN pihak h ON h.id=k.pihak_id WHERE k.perkara_id=%s AND IFNULL(h.warga_negara_id,1)<>1)" % P, 'WNA', B)
# --- ciri proses
tag(5817, 'VERSTEK', "IFNULL((SELECT putusan_verstek FROM perkara_putusan WHERE perkara_id=%s LIMIT 1),'') IN ('Y','1')" % P, 'VERSTEK', T3)
sql(5818, 'CIRI SAMPUL: KUMULASI (OTOMATIS dari perkara_kumulasi; kosong = tidak ada)',
    "SELECT IF(COUNT(*)>0,CONCAT('[&#%d; KUMULASI ',COUNT(*),']'),'') AS data FROM perkara_kumulasi WHERE perkara_id=%s" % (T3, P))
teks(5819, 'CIRI SAMPUL: REKONVENSI (ISIAN OTOMATIS dari panel; kosong = tidak berlaku)')
tag(5820, 'MEDIASI', "EXISTS(SELECT 1 FROM perkara_mediasi WHERE perkara_id=%s AND penetapan_penunjukan_mediator IS NOT NULL)" % P, 'MEDIASI', T3)
tag(5821, 'SITA', "EXISTS(SELECT 1 FROM perkara_proses WHERE perkara_id=%s AND proses_nama LIKE '%%sita%%')" % P, 'SITA', T3)
tag(5822, 'SIDANG KELILING', "EXISTS(SELECT 1 FROM perkara_jadwal_sidang WHERE perkara_id=%s AND sidang_keliling='Y')" % P, 'SIDANG KELILING', T3)
tag(5823, 'HAKIM TUNGGAL', "(SELECT COUNT(*) FROM perkara_hakim_pn WHERE perkara_id=%s AND aktif='Y')=1" % P, 'HAKIM TUNGGAL', T3)
tag(5824, 'GUGATAN SEDERHANA', "IFNULL((SELECT alur_perkara_id FROM perkara WHERE perkara_id=%s),0)=17" % P, 'GUGATAN SEDERHANA', T3)
tag(5825, 'VERZET', "EXISTS(SELECT 1 FROM perkara_jadwal_sidang WHERE perkara_id=%s AND verzet='Y')" % P, 'VERZET', T3)
tag(5826, 'DISPENSASI KAWIN', "IFNULL((SELECT jenis_perkara_id FROM perkara WHERE perkara_id=%s),0)=362" % P, 'DISPENSASI KAWIN', T3)
tag(5827, 'IKRAR TALAK', "EXISTS(SELECT 1 FROM perkara_ikrar_talak WHERE perkara_id=%s)" % P, 'IKRAR TALAK', T3)

daftar = ["NULLIF('#%d#','')" % k for k in range(5802, 5828) if k != 5804]
sql(5801, 'CIRI PERKARA SAMPUL (OTOMATIS: gabungan 5802 sampai 5827; kosong semua = tidak ada ciri khusus)',
    "SELECT IFNULL(NULLIF(TRIM(CONCAT_WS('  ',%s)),''),'- tidak ada ciri khusus -') AS data" % ','.join(daftar))
sql(5800, 'JENIS PERKARA SAMPUL (OTOMATIS: jenis perkara + kumulasi)',
    "SELECT CONCAT('#0048#',IFNULL((SELECT CONCAT(' Kumulasi ',REPLACE(GROUP_CONCAT(j.nama SEPARATOR '|'),'|',' dan ')) "
    "FROM perkara_kumulasi k JOIN jenis_perkara j ON j.id=k.jenis_perkara_id WHERE k.perkara_id=%s HAVING COUNT(*)>0),'')) AS data" % P)
sql(5829, 'BARIS IKRAR TALAK SAMPUL (OTOMATIS; kosong bila bukan cerai talak)',
    "SELECT IFNULL((SELECT CONCAT('<b>IKRAR TALAK</b>  PMH ',IFNULL(%s,'-'),'  -  PHS ikrar ',IFNULL(%s,'-'),'  -  Sidang ikrar ',IFNULL(%s,'-')) "
    "FROM perkara_ikrar_talak i WHERE i.perkara_id=%s LIMIT 1),'') AS data" % (
        tgl_id('i.penetapan_majelis_hakim'), tgl_id('i.tanggal_penetapan_sidang_ikrar'), tgl_id('i.tgl_ikrar_talak'), P))
sql(5836, 'MEDIATOR SAMPUL (OTOMATIS dari mediasi terakhir)',
    "SELECT m.mediator_text AS data FROM perkara_mediasi m WHERE m.perkara_id=%s ORDER BY m.mediasi_id DESC LIMIT 1" % P)
sql(5837, 'HASIL MEDIASI SAMPUL (OTOMATIS; kosong bila belum ada hasil)',
    "SELECT (CASE WHEN m.mediasi_berhasil IN ('Y','1') THEN 'Berhasil' WHEN m.mediasi_gagal IN ('Y','1') THEN 'Tidak berhasil' ELSE '' END) AS data "
    "FROM perkara_mediasi m WHERE m.perkara_id=%s ORDER BY m.mediasi_id DESC LIMIT 1" % P)
teks(5839, 'KONSEPTOR SAMPUL (ISIAN TANGAN)')
sql(5840, 'TGL PEMBERITAHUAN PUTUSAN / PBT (OTOMATIS: terakhir)',
    "SELECT MAX(tanggal_pemberitahuan_putusan) AS data FROM perkara_putusan_pemberitahuan_putusan WHERE perkara_id=%s" % P)


# ---------- sampul mengikuti jenis perkara (26 Okt): sebutan pihak I, band fokus, blok pokok perkara ----------
sql(5841, 'SEBUTAN PIHAK I SAMPUL (OTOMATIS menurut jenis perkara; selain yang dikhususkan = #8146#)',
    "SELECT (CASE p.jenis_perkara_id WHEN 362 THEN 'PEMOHON (ORANG TUA / WALI)' WHEN 360 THEN 'PEMOHON I' WHEN 363 THEN 'PEMOHON (CALON MEMPELAI)' "
    "WHEN 354 THEN 'PEMOHON (CALON WALI)' WHEN 371 THEN 'PEMOHON (AHLI WARIS)' ELSE '#8146#' END) AS data FROM perkara p WHERE p.perkara_id=%s" % P)
teks(5845, 'FOKUS SAMPUL (ISIAN TANGAN; dipakai bila jenis perkara belum punya kueri otomatis: nama anak, calon mempelai, pewaris, dan seterusnya)')
teks(5846, 'POKOK PERKARA SAMPUL (ISIAN TANGAN; baris dipisah <br>, dipakai bila jenis perkara belum punya kueri otomatis)')
sql(5842, 'FOKUS PERKARA SAMPUL (OTOMATIS: dispensasi kawin = anak yang dimohonkan; itsbat nikah = pasangan; asal usul anak = anak; lainnya = isian 5845)',
    "SELECT (CASE p.jenis_perkara_id "
    "WHEN 362 THEN CONCAT('<b>ANAK YANG DIMOHONKAN DISPENSASI</b><br>', IFNULL((SELECT IF(CAST(IFNULL(u.data,'99') AS UNSIGNED)<19 OR IFNULL(w.data,'')='', n.data, w.data) "
    "FROM aps_badilag.abt_data_teks n LEFT JOIN aps_badilag.abt_data_teks u ON u.no_var=601 AND u.perkara_id=n.perkara_id "
    "LEFT JOIN aps_badilag.abt_data_teks w ON w.no_var=606 AND w.perkara_id=n.perkara_id WHERE n.no_var=600 AND n.perkara_id=p.perkara_id), '')) "
    "WHEN 360 THEN CONCAT('<b>PASANGAN YANG DIITSBATKAN</b><br>', IFNULL((SELECT GROUP_CONCAT(k.nama ORDER BY k.urutan SEPARATOR ' dan ') FROM perkara_pihak1 k WHERE k.perkara_id=p.perkara_id AND k.urutan<=2), '')) "
    "WHEN 358 THEN CONCAT('<b>ANAK YANG DIMOHONKAN ASAL USULNYA</b><br>', IFNULL((SELECT a.nama_anak FROM perkara_anak_pihak a WHERE a.perkara_id=p.perkara_id ORDER BY a.id LIMIT 1), '')) "
    "ELSE IFNULL((SELECT TRIM(data) FROM aps_badilag.abt_data_teks WHERE no_var=5845 AND perkara_id=p.perkara_id), '') END) AS data FROM perkara p WHERE p.perkara_id=%s" % P)
sql(5843, 'POKOK PERKARA SAMPUL (OTOMATIS menurut jenis: cerai = pernikahan dan anak; itsbat = tanggal/tempat/alasan; dispensasi = alasan; lainnya = isian 5846)',
    "SELECT (CASE WHEN p.jenis_perkara_id IN (346,347) THEN CONCAT('<b>PERNIKAHAN DAN ANAK</b><br>Tanggal nikah: ', IFNULL(%s,'-'), '<br>KUA: ', IFNULL(n.kua_tempat_nikah,'-'), '<br>Anak: ', "
    "(SELECT COUNT(*) FROM perkara_anak_pihak a WHERE a.perkara_id=p.perkara_id), ' orang') "
    "WHEN p.jenis_perkara_id=360 THEN CONCAT('<b>PERNIKAHAN YANG DIITSBATKAN</b><br>Tanggal menikah: ', IFNULL(%s,'-'), '<br>Tempat menikah: ', IFNULL(i.tempat_menikah,'-'), '<br>Alasan: ', "
    "IFNULL((SELECT GROUP_CONCAT(l.nama SEPARATOR '; ') FROM perkara_alasan_nikah l WHERE l.perkara_id=p.perkara_id),'-')) "
    "WHEN p.jenis_perkara_id=362 THEN CONCAT('<b>ANAK DAN CALON PASANGAN</b><br>Alasan dispensasi: ', IFNULL((SELECT GROUP_CONCAT(l.nama SEPARATOR '; ') FROM perkara_alasan_nikah l WHERE l.perkara_id=p.perkara_id),'-')) "
    "ELSE IFNULL((SELECT TRIM(data) FROM aps_badilag.abt_data_teks WHERE no_var=5846 AND perkara_id=p.perkara_id), '') END) AS data "
    "FROM perkara p LEFT JOIN perkara_data_pernikahan n ON n.perkara_id=p.perkara_id LEFT JOIN perkara_data_itsbat i ON i.perkara_id=p.perkara_id WHERE p.perkara_id=%s" % (tgl_id('n.tgl_nikah'), tgl_id('i.tgl_menikah'), P))

# daftar isi: 4 kolom per bundel
for bundel, awal in (('A', 5851), ('B', 5856)):
    for kol, nm in ((1, 'NO'), (2, 'JENIS DOKUMEN'), (3, 'TANGGAL'), (4, 'HALAMAN')):
        sql(awal + kol - 1, 'DAFTAR ISI BUNDEL %s: %s (OTOMATIS; satu baris per dokumen yang ada)' % (bundel, nm),
            "SELECT aps_badilag.isian_rtf_daftar_isi(%s,'%s',%d) AS data" % (P, bundel, kol))

# riwayat sidang 12 baris x 3 sel
kode = 5860
for n in range(1, 13):
    pilih = ("FROM perkara_jadwal_sidang WHERE perkara_id=%s AND IFNULL(ikrar_talak,'T')<>'Y' ORDER BY tanggal_sidang, id LIMIT %d,1" % (P, n - 1))
    sql(kode, 'RIWAYAT SIDANG SAMPUL baris %d: tanggal sidang' % n, "SELECT tanggal_sidang AS data " + pilih)
    sql(kode + 1, 'RIWAYAT SIDANG SAMPUL baris %d: alasan penundaan' % n, "SELECT alasan_ditunda AS data " + pilih)
    sql(kode + 2, 'RIWAYAT SIDANG SAMPUL baris %d: agenda / keterangan' % n,
        "SELECT CONCAT(IFNULL(agenda,''),IF(sidang_keliling='Y',' (sidang keliling)','')) AS data " + pilih)
    kode += 3

kode = 5700
for n in range(13, 21):
    pilih = ("FROM perkara_jadwal_sidang WHERE perkara_id=%s AND IFNULL(ikrar_talak,'T')<>'Y' ORDER BY tanggal_sidang, id LIMIT %d,1" % (P, n - 1))
    sql(kode, 'RIWAYAT SIDANG SAMPUL baris %d: tanggal sidang' % n, "SELECT tanggal_sidang AS data " + pilih)
    sql(kode + 1, 'RIWAYAT SIDANG SAMPUL baris %d: alasan penundaan' % n, "SELECT alasan_ditunda AS data " + pilih)
    sql(kode + 2, 'RIWAYAT SIDANG SAMPUL baris %d: agenda / keterangan' % n,
        "SELECT CONCAT(IFNULL(agenda,''),IF(sidang_keliling='Y',' (sidang keliling)','')) AS data " + pilih)
    kode += 3

def q(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "''") + "'"

if __name__ == '__main__':
    akar = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tuj = os.path.join(akar, 'draf')
    os.makedirs(tuj, exist_ok=True)
    kodes = [v[0] for v in V]
    assert len(set(kodes)) == len(kodes) and all(5700 <= k <= 5899 for k in kodes)
    out = ['-- DRAF 26 Okt 2026 - TIDAK DIUJI, BELUM DIPASANG. Diturunkan oleh alat/bangun_variabel.py. Blok 5800-5899.',
           '-- Aman diulang: tiap baris hanya masuk bila nomor variabel belum ada. Kolom yang tidak diisi memakai bawaan tabel.', '']
    for kode, nama, tipe, kueri in V:
        assert 'aleta' not in (nama + (kueri or '')).lower()
        cols = 'no_var, nama, data_type, sql_query, locked'
        vals = '%d, %s, %s, %s, 1' % (kode, q(nama), q(tipe), q(kueri) if kueri else 'NULL')
        out.append('INSERT INTO abt_variabel (%s) SELECT %s FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var = %d);' % (cols, vals, kode))
    open(os.path.join(tuj, 'VARIABEL-DRAF.sql'), 'w', encoding='ascii', newline='\n').write('\n'.join(out) + '\n')
    json.dump([{'no_var': k, 'nama': n, 'data_type': t, 'sql_query': c} for k, n, t, c in V],
              open(os.path.join(tuj, 'variabel-draf.json'), 'w', encoding='ascii'), indent=1)
    print(len(V), 'variabel')
