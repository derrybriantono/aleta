# -*- coding: utf-8 -*-
"""Definisi isi paket x5-kodepos-amplop-21okt (21 Okt 2026): kode pos di ujung alamat penerima pada amplop relaas.

Latar: amplop relaas dicetak ABT dari blangko RTF Derry ("98 Relaas": [JS] 8.1.1-8.3.2 dan --AMPLOP PANGGILAN SURAT TERCATAT--).
Alamat penerima memakai #0101# (alamat Penggugat/Pemohon) dan #0105# (alamat Tergugat/Termohon) = kolom alamat perkara_pihak1/2.
Alamat itu TIDAK memuat kode pos. SIPP menyimpan KODE WILAYAH pihak (pihak.kelurahan '72.10.01.2009'); tabel kode_pos
(province, district, subdistrict, area, post_code) memuat kode posnya per nama desa.

BARU (4 variabel, nomor 9290-9293; bebas di server 21 Okt, di luar x1-x4 dan paket lain):
  9290  KODE POS pihak urutan 1 (Penggugat/Pemohon)   -> "94351" bila PASTI, selain itu TIDAK ADA BARIS (blangko mencetak "...")
  9291  KODE POS pihak urutan 1 (Tergugat/Termohon)   -> idem
  9292  ALAMAT #0046# + ", Kode Pos NNNNN"           -> alamat apa adanya bila kode pos tidak pasti (pengganti #0101# di amplop)
  9293  ALAMAT #0047# + ", Kode Pos NNNNN"           -> idem (pengganti #0105# di amplop)
UBAH (1 baris): 8172 "Nomor Kode Pos" (hanya dipakai amplop surat tercatat: "#0105#, #8172#"). Lama: post_code dari baris kode_pos yang
  area-nya = KATA KEDUA alamat (salah untuk desa bernama dua kata dan untuk nama desa yang sama di kabupaten lain). Baru: #9291# bila 5 angka.
BLANGKO (6 berkas RTF Derry disunting satu potongan teks, md5 dijaga): [JS] 8.x.1 "#0101#" -> "#9292#", [JS] 8.x.2 "#0105#" -> "#9293#".

ATURAN KODE POS (sama dengan aleta_bot/services/kodePosWilayahService.js):
  kode wilayah pihak -> nama provinsi/kabupaten/kecamatan/desa (ref_*_new) -> baris kode_pos (nama dinormalkan: huruf besar-kecil, spasi,
  tanda hubung, titik, teks dalam kurung, awalan Kabupaten/Kota diabaikan).
  1. desa cocok dan TEPAT SATU kode pos  -> dipakai;  2. desa cocok dengan beberapa kode pos -> kosong;
  3. desa tidak cocok tetapi kecamatan hanya punya SATU kode pos -> dipakai;  4. selain itu kosong (tidak pernah menebak).
  Tanpa kode pos juga: alamat berbunyi "Dahulu beralamat ... / tidak diketahui" dan pihak2.ghaib = 1 (panggilan lewat pengumuman).

Semua teks ASCII, tanpa kata nama aplikasi. Hanya SELECT. MariaDB 5.5 (regex Henry Spencer) dan 10.x memberi hasil sama."""

MODIFIER = 'admin'
MODIFIED = '2026-10-21 00:00:00'

AKHIR_KALIMAT_BUKAN_ALAMAT = "(p.alamat LIKE '%tidak diketahui%' OR p.alamat LIKE 'Dahulu%')"


def N(x):
    """normalisasi nama di SQL: buang teks dalam kurung, spasi, tanda hubung, titik (huruf besar-kecil ditangani collation *_ci)."""
    return "REPLACE(REPLACE(REPLACE(SUBSTRING_INDEX(%s, '(', 1), ' ', ''), '-', ''), '.', '')" % x


def N_KAB(x):
    """nama kabupaten/kota tanpa awalan Kabupaten/Kota, dinormalkan."""
    return N("IF(%s LIKE 'Kabupaten %%', SUBSTRING(%s, 11), IF(%s LIKE 'Kota %%', SUBSTRING(%s, 6), %s))" % (x, x, x, x, x))


# kode_pos berkolasi utf8mb4_unicode_ci, tabel ref_*_new utf8mb4_general_ci: sisi kode_pos diberi COLLATE eksplisit (kalau tidak: error 1267).
C = ' COLLATE utf8mb4_general_ci'
def kec(a):
    """syarat kecamatan + kabupaten + provinsi sisi kode_pos (k) = nama wilayah pihak pada alias a."""
    return ("k.subdistrict LIKE CONCAT(%s.c_2, '%%') COLLATE utf8mb4_unicode_ci AND %s%s = %s.c_n AND %s%s = %s.d_n AND %s%s = %s.p_n" % (
        a, N('k.subdistrict'), C, a, N_KAB('k.district'), C, a, N('k.province'), C, a))


DESA = "%s%s = n.a_n" % (N('k.area'), C)
GC = "SELECT GROUP_CONCAT(DISTINCT k.post_code ORDER BY k.post_code) FROM kode_pos k WHERE "


def sql_kodepos(sisi, kel_kode=None):
    """kel_kode: hanya untuk ukur (kunci kode kelurahan langsung, tanpa pihak); paket memakai pihak urutan 1 perkara."""
    t = 'perkara_pihak%d' % sisi
    ghaib = ' AND p.ghaib = 0' if sisi == 2 else ''
    return (
        "SELECT y.data FROM (SELECT IF(v.ga IS NOT NULL, IF(LOCATE(',', v.ga) = 0, v.ga, NULL), IF(v.gb IS NOT NULL AND LOCATE(',', v.gb) = 0, v.gb, NULL)) AS data FROM ("
        "SELECT u.*, IF(u.ga IS NULL, (" + GC + kec('u') + "), NULL) AS gb FROM ("
        "SELECT n.*, (" + GC + kec('n') + " AND " + DESA + ") AS ga FROM ("
        "SELECT " + N('kl.kelurahan_nama') + " AS a_n, LEFT(kc.kecamatan_nama, 2) AS c_2, " + N('kc.kecamatan_nama') + " AS c_n, " + N_KAB('kb.kabupaten_nama') + " AS d_n, " + N('pv.provinsi_nama') + " AS p_n "
        "FROM " + ("ref_kelurahan_new kl " if kel_kode else t + " p JOIN pihak b ON b.id = p.pihak_id JOIN ref_kelurahan_new kl ON kl.kelurahan_kode = TRIM(b.kelurahan) ") +
        "JOIN ref_kecamatan_new kc ON kc.kecamatan_kode = kl.kecamatan_kode "
        "JOIN ref_kabupaten_new kb ON kb.kabupaten_kode = LEFT(kl.kecamatan_kode, 5) "
        "JOIN ref_provinsi_new pv ON pv.provinsi_kode = LEFT(kl.kecamatan_kode, 2) " +
        ("WHERE kl.kelurahan_kode = '%s' LIMIT 1" % kel_kode if kel_kode else
         "WHERE p.perkara_id = '#perkara_id#' AND p.urutan = 1 AND NOT " + AKHIR_KALIMAT_BUKAN_ALAMAT + ghaib + " LIMIT 1") +
        ") n) u) v) y WHERE y.data IS NOT NULL")


def trim_semua(x):
    """buang spasi, koma, dan titik di ujung (alamat SIPP kadang berakhir ", , , ," atau "Tengah."), dengan TRIM bersarang."""
    for _ in range(3):
        for ch in (' ', ',', '.'):
            x = "TRIM(TRAILING '%s' FROM %s)" % (ch, x)
    return x


# letak penanda surel/domisili elektronik pertama di alamat (99999 = tidak ada). Kode pos disisipkan SEBELUM itu, bukan sesudah surel.
M = ("LEAST(" + ", ".join("IFNULL(NULLIF(LOCATE('%s', x.a), 0), 99999)" % k for k in ('domisili elektronik', 'elektronik', 'email', 'e-mail'))
     # surel tanpa kata pengantar: awal kata yang memuat '@'
     + ", IFNULL(NULLIF(IF(LOCATE('@', x.a) > 0, CHAR_LENGTH(LEFT(x.a, LOCATE('@', x.a) - 1)) - CHAR_LENGTH(SUBSTRING_INDEX(LEFT(x.a, LOCATE('@', x.a) - 1), ' ', -1)) + 1, 0), 0), 99999))")


def sql_alamat(sisi, var_kodepos):
    t = 'perkara_pihak%d' % sisi
    kp = "TRIM('#%d#')" % var_kodepos
    kepala = "IF(z.m < 99999, LEFT(z.a, z.m - 1), z.a)"
    pasti = ("%s REGEXP '^[0-9]{5}$' AND z.a NOT LIKE '%%kode pos%%' AND z.a NOT LIKE CONCAT('%%', %s, '%%') AND LENGTH(%s) > 0" % (kp, kp, trim_semua(kepala)))
    ekor = "IF(z.m < 99999, CONCAT('. ', TRIM(SUBSTRING(z.a, z.m))), '')"
    return ("SELECT IF(%s, CONCAT(%s, ', Kode Pos ', %s, %s), z.a) AS data FROM ("
            "SELECT x.a, %s AS m FROM (SELECT IFNULL(p.alamat, '') AS a FROM %s p WHERE p.perkara_id = '#perkara_id#' AND p.urutan = 1 LIMIT 1) x) z"
            ) % (pasti, trim_semua(kepala), kp, ekor, M, t)


SQL_8172 = "SELECT x.data FROM (SELECT TRIM('#9291#') AS data) x WHERE x.data REGEXP '^[0-9]{5}$'"

BARU = [
    dict(no=9290, nama='KODE POS ALAMAT #0046# (OTOMATIS SIPP: pihak urutan 1 dari kode wilayah; hanya bila pasti, selain itu kosong = titik-titik)',
         tipe='data_sql', tabel=None, kolom=None, urutan=None, sql=sql_kodepos(1), default=None, butir='kode pos Penggugat/Pemohon'),
    dict(no=9291, nama='KODE POS ALAMAT #0047# (OTOMATIS SIPP: pihak urutan 1 dari kode wilayah; hanya bila pasti, selain itu kosong = titik-titik)',
         tipe='data_sql', tabel=None, kolom=None, urutan=None, sql=sql_kodepos(2), default=None, butir='kode pos Tergugat/Termohon'),
    dict(no=9292, nama='ALAMAT #0046# DENGAN KODE POS DI UJUNG (OTOMATIS: alamat SIPP + ", Kode Pos NNNNN" bila pasti; untuk amplop relaas)',
         tipe='data_sql', tabel=None, kolom=None, urutan=None, sql=sql_alamat(1, 9290), default=None, butir='alamat Penggugat/Pemohon + kode pos'),
    dict(no=9293, nama='ALAMAT #0047# DENGAN KODE POS DI UJUNG (OTOMATIS: alamat SIPP + ", Kode Pos NNNNN" bila pasti; untuk amplop relaas)',
         tipe='data_sql', tabel=None, kolom=None, urutan=None, sql=sql_alamat(2, 9291), default=None, butir='alamat Tergugat/Termohon + kode pos'),
]

# baris yang diubah: no -> dict(kolom, fungsi(lama_bytes)->baru_bytes, butir). 8172 diganti seluruhnya (lama harus persis kueri lama).
LAMA_8172 = b'SELECT post_code AS data\nFROM kode_pos\nWHERE area = "#0210#";\n'
UBAH = {
    8172: dict(kolom='sql_query', fungsi=lambda lama: (SQL_8172.encode('ascii') if lama == LAMA_8172 else (_ for _ in ()).throw(AssertionError('isi lama 8172 berbeda dari yang diperiksa'))),
               butir='Nomor Kode Pos amplop surat tercatat'),
}

# blangko RTF yang disunting: (folder, berkas, dari, ke, jumlah yang diharapkan)
FOLDER_RTF = '98 Relaas'
BLANGKO = [
    ('[JS] 8.1.1. Amplop Relaas Panggilan Sidang P.rtf', '#0101#', '#9292#', 1),
    ('[JS] 8.1.2. Amplop Relaas Panggilan Sidang T.rtf', '#0105#', '#9293#', 1),
    ('[JS] 8.2.1. Amplop Relaas Pemberitahuan Putusan P.rtf', '#0101#', '#9292#', 1),
    ('[JS] 8.2.2. Amplop Relaas Pemberitahuan Putusan T.rtf', '#0105#', '#9293#', 1),
    ('[JS] 8.3.1. Amplop Relaas Panggilan Ikrar Talak P.rtf', '#0101#', '#9292#', 1),
    ('[JS] 8.3.2. Amplop Relaas Panggilan Ikrar Talak T.rtf', '#0105#', '#9293#', 1),
]
