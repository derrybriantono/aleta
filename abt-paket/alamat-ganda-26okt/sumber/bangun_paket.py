# -*- coding: utf-8 -*-
"""Pembangun paket ABT alamat-ganda-26okt (python 3, di laptop). Membaca (1) salinan persis abt_variabel server (HEX, baca-saja) dari VAR_SERVER_HEX,
(2) definisi dua fungsi x9 di server (HEX routine_definition, baca-saja) dari FUNGSI_X9_DIR, (3) salinan folder blangko derry_briantono dari RTF_DIR,
lalu menulis paket-satker/*. Isi lama baris yang diubah dijaga md5 dan dicadangkan di server oleh pasang-satker.sh.
pakai: python bangun_paket.py   (jalur bawaan: D:/Aplikasi/aleta/tmp/w82/...)"""
import base64
import hashlib
import json
import os
import re
import shutil
import sys

AKAR = os.path.dirname(os.path.abspath(__file__))
N = 'abt-alamat-ganda-26okt'
KELUAR = os.path.join(AKAR, '..', 'paket-satker')
TMPW = os.environ.get('AG_TMP', r'D:\Aplikasi\aleta\tmp\w82')
HEXFILE = os.environ.get('VAR_SERVER_HEX', os.path.join(TMPW, 'var_server_hex.tsv'))
RTF_DIR = os.environ.get('RTF_DIR', os.path.join(TMPW, 'rtf', 'derry_briantono'))
X9_FUNGSI = os.path.join(AKAR, '..', '..', 'x9-pihak-banyak-21okt', 'paket-satker', 'abt-x9-pihak-banyak-21okt-FUNGSI.sql')
MODIFIER = 'admin'
MODIFIED = '2026-10-26 00:00:00'

FN = 'aps_badilag.isian_rtf_alamat'
FUNGSI_BARU = ['isian_rtf_alamat_rapi', 'isian_rtf_alamat_padat', 'isian_rtf_alamat_kunci', 'isian_rtf_alamat_tingkat', 'isian_rtf_alamat_sah',
               'isian_rtf_alamat_provinsi', 'isian_rtf_alamat_mirip', 'isian_rtf_alamat_ekor', 'isian_rtf_alamat_inti', 'isian_rtf_alamat']
FUNGSI_X9 = ['isian_rtf_pihak_utama', 'isian_rtf_pihak_tambahan']


def md5(b):
    return hashlib.md5(b).hexdigest()


def hx(b):
    return '0x' + b.hex()


server = {}
for baris in open(HEXFILE, encoding='latin1', newline='').read().split('\n')[1:]:
    if not baris.strip():
        continue
    k = baris.rstrip('\r').split('\t')
    no = int(k[0])
    server[no] = dict(nama=bytes.fromhex(k[1]), tipe=k[2], sql=None if k[7] == 'NULL' else bytes.fromhex(k[7]),
                      default=None if k[8] == 'NULL' else bytes.fromhex(k[8]))


# ---------------------------------------------------------------------------------------------------------------------------------------------
# Pemecah kueri: literal "..." / '...' / `...` dan komentar dipisahkan dari kode supaya penyisipan hanya menyentuh literal yang benar.
def potong(q):
    i, n, buf, out = 0, len(q), [], []
    while i < n:
        c = q[i]
        if c in '\'"`':
            j = i + 1
            while j < n:
                if q[j] == '\\' and c != '`':
                    j += 2
                    continue
                if q[j] == c:
                    if j + 1 < n and q[j + 1] == c:
                        j += 2
                        continue
                    break
                j += 1
            else:
                raise AssertionError('literal tak tertutup')
            out.append(('kode', ''.join(buf)))
            buf = []
            out.append((c, q[i:j + 1]))
            i = j + 1
            continue
        if c == '-' and q[i:i + 2] == '--' and (i + 2 >= n or q[i + 2] in ' \t\r\n'):
            j = q.find('\n', i)
            j = n if j < 0 else j
            out.append(('kode', ''.join(buf)))
            buf = []
            out.append(('kom', q[i:j]))
            i = j
            continue
        buf.append(c)
        i += 1
    out.append(('kode', ''.join(buf)))
    return out


def bungkus(q, markers):
    """tiap literal "..." yang memuat #M# diganti CONCAT("sebelum", fungsi("#M#"), "sesudah"); literal yang HANYA marker -> fungsi("#M#") saja"""
    pola = re.compile('(#(?:%s)#)' % '|'.join(markers))
    hasil = []
    for jenis, t in potong(q):
        if jenis == '"' and pola.search(t):
            inner = t[1:-1]
            if pola.fullmatch(inner):
                hasil.append('%s("%s")' % (FN, inner))
            else:
                bagian = pola.split(inner)
                args = []
                for k, p in enumerate(bagian):
                    if k % 2 == 1:
                        args.append('%s("%s")' % (FN, p))
                    elif p != '':
                        args.append('"%s"' % p)
                hasil.append('CONCAT(%s)' % ', '.join(args))
        else:
            hasil.append(t)
    return ''.join(hasil)


def periksa_marker(lama, baru, markers):
    for m in markers:
        tag = '#%s#' % m
        assert lama.count(tag) >= 1, ('marker tidak ada di kueri lama', m)
        assert baru.count(tag) == lama.count(tag), ('jumlah marker berubah', m, baru.count(tag), lama.count(tag))
        assert baru.count('%s("%s")' % (FN, tag)) == lama.count(tag), ('marker tidak semuanya dibungkus', m)


def ubah_bungkus(markers):
    def f(b):
        q = b.decode('latin1')
        nb = bungkus(q, markers)
        periksa_marker(q, nb, markers)
        return nb.encode('latin1')
    return f


def ganti_tepat(pasangan):
    """pasangan = [(lama, baru, jumlah)] - tiap `lama` harus muncul PERSIS `jumlah` kali"""
    def f(b):
        q = b.decode('latin1')
        for lama, baru, jml in pasangan:
            assert q.count(lama) == jml, ('anchor', lama[:70], q.count(lama), jml)
            q = q.replace(lama, baru)
        return q.encode('latin1')
    return f


EKS = ("NULLIF(TRIM(IFNULL((SELECT x.alamat FROM perkara_pihak1 x WHERE x.perkara_id = d.perkara_id AND x.pihak_id = d.pihak_id LIMIT 1),"
       "(SELECT y.alamat FROM perkara_pihak2 y WHERE y.perkara_id = d.perkara_id AND y.pihak_id = d.pihak_id LIMIT 1))),'')")
EKS_BARU = ("NULLIF(CONVERT(aps_badilag.isian_rtf_alamat(TRIM(IFNULL((SELECT x.alamat FROM perkara_pihak1 x WHERE x.perkara_id = d.perkara_id AND x.pihak_id = d.pihak_id LIMIT 1),"
            "(SELECT y.alamat FROM perkara_pihak2 y WHERE y.perkara_id = d.perkara_id AND y.pihak_id = d.pihak_id LIMIT 1)))) USING utf8),'')")

UBAH_FN = {
    7047: (ubah_bungkus(['0101', '1036', '3119', '3129']), '7047: alamat Pemohon/Penggugat I-IV lewat isian_rtf_alamat'),
    7048: (ubah_bungkus(['0105', '5089', '5097', '5117']), '7048: alamat Termohon/Tergugat I-IV lewat isian_rtf_alamat'),
    7108: (ubah_bungkus(['0101']), '7108: identitas pihak relaas (Pemohon/Penggugat)'),
    7109: (ubah_bungkus(['1036', '0105']), '7109: identitas pihak relaas (Termohon/Tergugat)'),
    9230: (ubah_bungkus(['0101']), '9230: identitas yang dipanggil (Pemohon/Penggugat)'),
    9231: (ubah_bungkus(['0105']), '9231: identitas yang dipanggil (Termohon/Tergugat)'),
    8890: (ubah_bungkus(['0101', '0105']), '8890: kewenangan relatif gaya relaas'),
    8700: (ganti_tepat([
        ('CONVERT((SELECT x.alamat FROM perkara_pihak2 x WHERE x.perkara_id=p.perkara_id ORDER BY x.urutan LIMIT 1) USING utf8)',
         'CONVERT(aps_badilag.isian_rtf_alamat((SELECT x.alamat FROM perkara_pihak2 x WHERE x.perkara_id=p.perkara_id ORDER BY x.urutan LIMIT 1)) USING utf8)', 1),
        ('CONVERT((SELECT x.alamat FROM perkara_pihak1 x WHERE x.perkara_id=p.perkara_id ORDER BY x.urutan LIMIT 1) USING utf8)',
         'CONVERT(aps_badilag.isian_rtf_alamat((SELECT x.alamat FROM perkara_pihak1 x WHERE x.perkara_id=p.perkara_id ORDER BY x.urutan LIMIT 1)) USING utf8)', 1)]),
        '8700: pertimbangan kewenangan relatif cerai'),
    9292: (ganti_tepat([("SELECT IFNULL(p.alamat, '') AS a FROM perkara_pihak1 p", "SELECT aps_badilag.isian_rtf_alamat(IFNULL(p.alamat, '')) AS a FROM perkara_pihak1 p", 1)]),
           '9292: alamat Pemohon/Penggugat dengan kode pos'),
    9293: (ganti_tepat([("SELECT IFNULL(p.alamat, '') AS a FROM perkara_pihak2 p", "SELECT aps_badilag.isian_rtf_alamat(IFNULL(p.alamat, '')) AS a FROM perkara_pihak2 p", 1)]),
           '9293: alamat Termohon/Tergugat dengan kode pos'),
    9349: (ganti_tepat([("TRIM(CONVERT(IFNULL(NULLIF(TRIM(p.alamat), ''), b.alamat) USING utf8))", "TRIM(CONVERT(aps_badilag.isian_rtf_alamat(IFNULL(NULLIF(TRIM(p.alamat), ''), b.alamat)) USING utf8))", 1)]),
           '9349: ekonomi syariah identitas Penggugat (kedudukan badan hukum)'),
    9350: (ganti_tepat([("TRIM(CONVERT(IFNULL(NULLIF(TRIM(p.alamat), ''), b.alamat) USING utf8))", "TRIM(CONVERT(aps_badilag.isian_rtf_alamat(IFNULL(NULLIF(TRIM(p.alamat), ''), b.alamat)) USING utf8))", 1)]),
           '9350: ekonomi syariah identitas Tergugat (kedudukan badan hukum)'),
    3943: (ganti_tepat([(EKS, EKS_BARU, 2)]), '3943: eksekusi identitas pemohon eksekusi (alamat pihak)'),
    3944: (ganti_tepat([(EKS, EKS_BARU, 2)]), '3944: eksekusi identitas termohon eksekusi (alamat pihak)'),
    10126: (ganti_tepat([("select a.alamat as data from perkara_pihak3 a", "select aps_badilag.isian_rtf_alamat(a.alamat) as data from perkara_pihak3 a", 1)]),
            '10126: alamat pihak ketiga'),
}

# ---- variabel baru: alamat dirapikan untuk RTF (menggantikan #0101#, #0105#, #1036# di blangko Derry)
BARU = [
    dict(no=3517, nama='ALAMAT #0046# I DIRAPIKAN (OTOMATIS: alamat SIPP tanpa ekor wilayah ganda; pengganti variabel 0101 di blangko Derry)',
         sql='SELECT aps_badilag.isian_rtf_alamat("#0101#") AS data', ganti='0101'),
    dict(no=3518, nama='ALAMAT #0047# I DIRAPIKAN (OTOMATIS: alamat SIPP tanpa ekor wilayah ganda; pengganti variabel 0105 di blangko Derry)',
         sql='SELECT aps_badilag.isian_rtf_alamat("#0105#") AS data', ganti='0105'),
    dict(no=3519, nama='ALAMAT #0046# II DIRAPIKAN (OTOMATIS: alamat SIPP tanpa ekor wilayah ganda; pengganti variabel 1036 di blangko Derry)',
         sql='SELECT aps_badilag.isian_rtf_alamat("#1036#") AS data', ganti='1036'),
]
baru = {}
for d in BARU:
    assert d['no'] not in server, 'nomor %d sudah ada di server' % d['no']
    d = dict(d)
    d['nama_b'] = d['nama'].encode('ascii')
    assert len(d['nama_b']) <= 200, ('nama > 200 huruf', d['no'])
    assert set(re.findall(r'#(\d+)#', d['nama'])) <= {'0046', '0047'}, ('nama memuat rujukan variabel lain', d['no'])
    d['sql_b'] = d['sql'].encode('ascii')
    baru[d['no']] = d
NO_BARU = sorted(baru)

ubah = {}
for no in sorted(UBAH_FN):
    fn, ket = UBAH_FN[no]
    s = server[no]
    assert s['sql'] is not None
    nb = fn(s['sql'])
    assert nb != s['sql'], no
    assert b'aps_badilag.isian_rtf_alamat' in nb
    ubah[no] = dict(kolom='sql_query', lama_md5=md5(s['sql']), baru_b=nb, baru_md5=md5(nb), nama_md5=md5(s['nama']), tipe=s['tipe'], ket=ket, lama_len=len(s['sql']), baru_len=len(nb))
NO_UBAH = sorted(ubah)

ref = set()
for d in baru.values():
    ref |= {int(x) for x in re.findall(rb'#(\d{1,5})#', d['sql_b'])}
for no, u in ubah.items():
    ref |= {int(x) for x in re.findall(rb'#(\d{1,5})#', u['baru_b'])}
DEP = sorted(x for x in ref if x not in baru and x != 0)
hilang = [x for x in DEP if x not in server]
assert not hilang, hilang

# ---- dua fungsi x9: definisi LAMA = routine_definition server (baca saja); BARU = alamat dibungkus
x9src = open(X9_FUNGSI, 'rb').read().decode('latin1')
x9 = {}
for f in FUNGSI_X9:
    lama = bytes.fromhex(open(os.path.join(TMPW, 'fungsi-x9-%s.hex' % f)).read().strip()).decode('latin1')
    m = re.search(r'(CREATE FUNCTION %s\(.*?\n)BEGIN\n' % f, x9src, re.S)
    assert m, f
    kepala = m.group(1)
    if f == 'isian_rtf_pihak_utama':
        baru_body = lama
        assert baru_body.count('d.kode, a.alamat') == 2
        baru_body = baru_body.replace('d.kode, a.alamat', 'd.kode, isian_rtf_alamat(a.alamat)')
    else:
        baru_body = lama
        assert baru_body.count('SELECT t.urutan, t.nama, t.alamat,') == 2
        baru_body = baru_body.replace('SELECT t.urutan, t.nama, t.alamat,', 'SELECT t.urutan, t.nama, isian_rtf_alamat(t.alamat),')
    assert baru_body != lama
    x9[f] = dict(kepala=kepala, lama=lama, baru=baru_body, lama_md5=md5(lama.encode('latin1')), baru_md5=md5(baru_body.encode('latin1')))


def kond_baru(d, a=''):
    p = a + '.' if a else ''
    c = ["%sno_var=%d" % (p, d['no']), "MD5(%snama)='%s'" % (p, md5(d['nama_b'])), "%sdata_type='data_sql'" % p,
         "%sdata_tabel IS NULL" % p, "%sdata_kolom IS NULL" % p, "%surutan_data IS NULL" % p, "%sreferensi IS NULL" % p, "%smulti_sidang IS NULL" % p, "%slocked=0" % p,
         "MD5(%ssql_query)='%s'" % (p, md5(d['sql_b'])), "%sdefault_data IS NULL" % p]
    return '(' + ' AND '.join(c) + ')'


def kond_ubah(no, estado, a=''):
    p = a + '.' if a else ''
    u = ubah[no]
    m = u['lama_md5'] if estado == 'lama' else u['baru_md5']
    return "(%sno_var=%d AND MD5(%snama)='%s' AND %sdata_type='%s' AND MD5(%s%s)='%s')" % (p, no, p, u['nama_md5'], p, u['tipe'], p, u['kolom'], m)


def atau(lst):
    return '(' + ' OR '.join(lst) + ')' if lst else '(1=0)'


def daftar(ns):
    return ','.join(str(x) for x in ns)


KB = [kond_baru(baru[n]) for n in NO_BARU]
KUL = [kond_ubah(n, 'lama') for n in NO_UBAH]
KUB = [kond_ubah(n, 'baru') for n in NO_UBAH]
JB, JU, JF = len(NO_BARU), len(NO_UBAH), len(FUNGSI_BARU)
FN_IN = ','.join("'%s'" % f for f in FUNGSI_BARU)
X9_LAMA = ' OR '.join("(routine_name='%s' AND MD5(routine_definition)='%s')" % (f, x9[f]['lama_md5']) for f in FUNGSI_X9)
X9_BARU = ' OR '.join("(routine_name='%s' AND MD5(routine_definition)='%s')" % (f, x9[f]['baru_md5']) for f in FUNGSI_X9)

# ---- RTF
rtf_daftar, rtf_tambal = [], []
GANTI = {'#%s#' % d['ganti']: '#%d#' % d['no'] for d in baru.values()}
kode_n = 0
for dp, dn, fn in os.walk(RTF_DIR):
    for f in sorted(fn):
        if not f.lower().endswith('.rtf'):
            continue
        p = os.path.join(dp, f)
        rel = os.path.relpath(p, RTF_DIR).replace('\\', '/')
        b = open(p, 'rb').read()
        t = b.decode('latin1')
        ada = {a: t.count(a) for a in GANTI if t.count(a) > 0}
        if not ada:
            continue
        baru_t = t
        for a, g in GANTI.items():
            baru_t = baru_t.replace(a, g)
        kode_n += 1
        assert '\t' not in rel and '\n' not in rel
        rtf_daftar.append((kode_n, rel, md5(b), md5(baru_t.encode('latin1')), sum(ada.values())))
        for u, (a, j) in enumerate(sorted(ada.items()), 1):
            rtf_tambal.append((rel, u, j, a, GANTI[a]))
JR = len(rtf_daftar)

KEPALA = ("-- Paket ABT \"%s\" (26 Okt 2026): alamat pihak tanpa ekor wilayah ganda (putusan 620/Pdt.G/2026/PA.Dgl dan sejenisnya).\n"
          "-- %d variabel baru (%s), %d baris variabel diubah (%s), %d fungsi tersimpan baru (isian_rtf_alamat*), 2 fungsi x9 dibungkus alamatnya (%s), %d blangko RTF derry_briantono ditambal.\n"
          % (N, JB, daftar(NO_BARU), JU, ', '.join(str(n) for n in NO_UBAH), JF, ', '.join(FUNGSI_X9), JR))

HARAP = '0|0|%d|0|0|%d|0|2|0' % (JU, len(DEP))
ULANG = '0|%d|0|%d|%d|%d|0|0|2' % (JB, JU, JF, len(DEP))

pra = KEPALA + ("-- PRASYARAT (baca saja) \"A|B|C|D|E|F|G|H|I\": A = nomor baru (%d) yang berisi LAIN dari paket (harus 0) | B = nomor baru yang sudah persis paket (0 pertama, %d ulang) | "
                "C = baris yang akan diubah (%d) yang masih isi LAMA (%d pertama, 0 ulang) | D = yang sudah isi BARU (0 pertama, %d ulang) | "
                "E = fungsi baru (%d) yang sudah ada (0 pertama, %d ulang) | F = variabel lama yang dirujuk dan harus ada (%d) | G = baris diubah yang bukan lama bukan baru (harus 0) | "
                "H = fungsi x9 (2) yang masih isi LAMA (2 pertama, 0 ulang) | I = fungsi x9 yang sudah isi BARU (0 pertama, 2 ulang).\n"
                "-- Benar: \"%s\" (pertama) atau \"%s\" (pasang ulang).\n") % (JB, JB, JU, JU, JU, JF, JF, len(DEP), HARAP, ULANG)
pra += ("SELECT CONCAT((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND NOT %s), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', "
        "(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name IN (%s)), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND NOT (%s OR %s)), '|', "
        "(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND (%s)), '|', "
        "(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND (%s))) AS prasyarat;\n") % (
    daftar(NO_BARU), atau(KB), atau(KB), atau(KUL), atau(KUB), FN_IN, daftar(DEP), daftar(NO_UBAH), atau(KUL), atau(KUB), X9_LAMA, X9_BARU)

ps = KEPALA + ("-- PASANG variabel (fungsi dipasang lebih dulu oleh pasang-satker.sh dari -FUNGSI.sql): satu transaksi; nomor baru hanya ditulis bila belum ada; "
               "baris diubah hanya bila isinya masih persis isi LAMA (pasang ulang aman).\nSET NAMES latin1;\nSTART TRANSACTION;\n")
for n in NO_BARU:
    d = baru[n]
    ps += ("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
           "SELECT %d, %s, 'data_sql', NULL, NULL, NULL, NULL, %s, NULL, NULL, 0, '%s', '%s' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var=%d);\n") % (
        n, hx(d['nama_b']), hx(d['sql_b']), MODIFIER, MODIFIED, n)
for n in NO_UBAH:
    u = ubah[n]
    ps += "UPDATE abt_variabel SET %s=%s, modified='%s' WHERE %s;\n" % (u['kolom'], hx(u['baru_b']), MODIFIED, kond_ubah(n, 'lama'))
ps += "COMMIT;\n"

CEK_FN = ("(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name IN (%s) AND routine_comment LIKE 'AG:%%') = %d" % (FN_IN, JF))
CEK_X9 = "(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND (%s)) = 2" % X9_BARU
CEK_UJI = ("isian_rtf_alamat('Kelurahan Ganti, Kecamatan Banawa , Kabupaten Donggala, Provinsi Sulawesi Tengah, Ganti, Banawa, Kabupaten Donggala, Sulawesi Tengah') = "
           "'Kelurahan Ganti, Kecamatan Banawa, Kabupaten Donggala, Provinsi Sulawesi Tengah' "
           "AND isian_rtf_alamat('Jalan Anggur 4, Kelurahan Boyaoge, Kecamatan Tatanga, Kota Palu, Provinsi Sulawesi Tengah') = 'Jalan Anggur 4, Kelurahan Boyaoge, Kecamatan Tatanga, Kota Palu, Provinsi Sulawesi Tengah' "
           "AND isian_rtf_alamat('Dusun II, Desa Tulo, Kecamatan Dolo, Kabupaten Sigi, Tulo, Dolo, Kabupaten Sigi, Sulawesi Tengah') = 'Dusun II, Desa Tulo, Kecamatan Dolo, Kabupaten Sigi, Provinsi Sulawesi Tengah' "
           "AND isian_rtf_alamat('Jalan Poros, Tosale, Banawa Selatan, Kabupaten Donggala, Sulawesi Tengah') = 'Jalan Poros, Desa Tosale, Kecamatan Banawa Selatan, Kabupaten Donggala, Provinsi Sulawesi Tengah' "
           "AND isian_rtf_alamat('') = '' AND isian_rtf_alamat(NULL) = '' AND isian_rtf_alamat('Jalan Mawar No 3') = 'Jalan Mawar No 3'")
pk = KEPALA + "-- PERIKSA: tiap variabel baru dan baris diubah persis isi paket; fungsi ada dan benar; baris terakhir \"SEMUA COCOK\".\n"
for n in NO_BARU:
    pk += "SELECT 'var %d baru' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (n, kond_baru(baru[n]))
for n in NO_UBAH:
    pk += "SELECT 'var %d diubah' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (n, kond_ubah(n, 'baru'))
pk += "SELECT 'fungsi alamat ada' AS butir, IF(%s, 1, 0) AS cocok;\n" % CEK_FN
pk += "SELECT 'fungsi x9 dibungkus' AS butir, IF(%s, 1, 0) AS cocok;\n" % CEK_X9
pk += "SELECT 'fungsi alamat benar' AS butir, IF(%s, 1, 0) AS cocok;\n" % CEK_UJI
pk += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d AND %s AND %s AND %s, 'SEMUA COCOK', 'TIDAK COCOK') AS hasil;\n") % (
    atau(KB + KUB), JB + JU, CEK_FN, CEK_X9, CEK_UJI)

pl = KEPALA + ("-- PULIH (deterministik): variabel baru dihapus HANYA bila isinya masih persis paket; baris yang diubah dikembalikan dari tabel sementara ag_lama\n"
               "-- (dibuat pulih-satker.sh dari cadangan/abt_variabel-sebelum.sql) HANYA bila isinya masih isi BARU paket dan baris cadangan masih isi LAMA yang diharapkan.\n"
               "-- Fungsi x9 dikembalikan dan fungsi AG dihapus oleh pulih-satker.sh SESUDAH ini. Jalankan lewat pulih-satker.sh (bukan langsung): tabel ag_lama harus ada.\n")
pl += "START TRANSACTION;\n"
for n in NO_UBAH:
    pl += ("UPDATE abt_variabel a JOIN ag_lama l ON l.no_var=a.no_var SET a.nama=l.nama, a.data_type=l.data_type, a.data_tabel=l.data_tabel, a.data_kolom=l.data_kolom, "
           "a.urutan_data=l.urutan_data, a.referensi=l.referensi, a.sql_query=l.sql_query, a.default_data=l.default_data, a.multi_sidang=l.multi_sidang, a.locked=l.locked, "
           "a.modifier=l.modifier, a.modified=l.modified WHERE %s AND %s;\n") % (kond_ubah(n, 'baru', 'a'), kond_ubah(n, 'lama', 'l'))
for n in NO_BARU:
    pl += "DELETE FROM abt_variabel WHERE %s;\n" % kond_baru(baru[n])
pl += "COMMIT;\n"
pl += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)) = 0 AND (SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d, 'VARIABEL KEMBALI', "
       "CONCAT('PULIH TIDAK LENGKAP - nomor baru tersisa ', (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)), ', baris diubah yang sudah kembali ', "
       "(SELECT COUNT(*) FROM abt_variabel WHERE %s), ' dari %d (diubah orang sesudah dipasang? dibiarkan)')) AS hasil;\n") % (
    daftar(NO_BARU), atau(KUL), JU, daftar(NO_BARU), atau(KUL), JU)

# ---- berkas fungsi: baru (AG + x9 dibungkus) dan lama (x9 saja)
fungsi_baru = open(os.path.join(AKAR, 'templat-fungsi.sql'), 'rb').read().decode('latin1').replace('\r\n', '\n')
assert fungsi_baru.rstrip().endswith('DELIMITER ;')
bagian_x9_baru = 'DELIMITER $$\n\n'
bagian_x9_lama = '-- Definisi LAMA fungsi x9 (routine_definition di server pada 26 Okt 2026) - dipakai PULIH.\nDELIMITER $$\n\n'
for f in FUNGSI_X9:
    bagian_x9_baru += 'DROP FUNCTION IF EXISTS %s$$\n%sBEGIN\n%s$$\n\n' % (f, x9[f]['kepala'], x9[f]['baru'][len('BEGIN\n'):])
    bagian_x9_lama += 'DROP FUNCTION IF EXISTS %s$$\n%sBEGIN\n%s$$\n\n' % (f, x9[f]['kepala'], x9[f]['lama'][len('BEGIN\n'):])
bagian_x9_baru += 'DELIMITER ;\n'
bagian_x9_lama += 'DELIMITER ;\n'
for f in FUNGSI_X9:
    assert x9[f]['baru'].startswith('BEGIN\n') and x9[f]['lama'].startswith('BEGIN\n')

for nama, isi in (('PRASYARAT', pra), ('PASANG', ps), ('PERIKSA', pk), ('PULIH', pl)):
    open(os.path.join(KELUAR, '%s-%s.sql' % (N, nama)), 'w', newline='\n', encoding='ascii').write(isi)
open(os.path.join(KELUAR, '%s-FUNGSI.sql' % N), 'wb').write((fungsi_baru.replace('DELIMITER ;\n', '').rstrip() + '\n\n' + bagian_x9_baru.replace('DELIMITER $$\n\n', '', 1)).replace('\r\n', '\n').encode('latin1'))
open(os.path.join(KELUAR, '%s-FUNGSI-X9-LAMA.sql' % N), 'wb').write(bagian_x9_lama.encode('latin1'))
open(os.path.join(KELUAR, 'nomor-baru.txt'), 'w', newline='\n').write(daftar(NO_BARU) + '\n')
open(os.path.join(KELUAR, 'nomor-ubah.txt'), 'w', newline='\n').write(daftar(NO_UBAH) + '\n')
open(os.path.join(KELUAR, 'nama-fungsi.txt'), 'w', newline='\n').write(' '.join(FUNGSI_BARU) + '\n')
open(os.path.join(KELUAR, 'rtf-daftar-tambal.tsv'), 'w', newline='\n', encoding='utf-8').write(''.join('R%03d\t%s\t%s\t%s\t%d\n' % r for r in rtf_daftar))
open(os.path.join(KELUAR, 'rtf-tambal.tsv'), 'w', newline='\n', encoding='ascii').write(''.join(
    '%s\t%d\t%d\t%s\t%s\n' % (base64.b64encode(rel.encode('utf-8')).decode(), u, j, base64.b64encode(a.encode()).decode(), base64.b64encode(g.encode()).decode()) for rel, u, j, a, g in rtf_tambal))
shutil.copyfile(os.path.join(AKAR, 'tambal-rtf.pl'), os.path.join(KELUAR, 'tambal-rtf.pl'))
open(os.path.join(KELUAR, 'harap.txt'), 'w', newline='\n').write(HARAP + '\n' + ULANG + '\n')
for sk in ('pasang-satker.sh', 'pulih-satker.sh'):
    open(os.path.join(KELUAR, sk), 'wb').write(open(os.path.join(AKAR, sk), 'rb').read().replace(b'\r\n', b'\n'))
open(os.path.join(KELUAR, 'perkara-uji.txt'), 'w', newline='\n').write(open(os.path.join(AKAR, 'perkara-uji.txt')).read())

ring = dict(baru=[dict(no=n, nama=baru[n]['nama'], sql=baru[n]['sql']) for n in NO_BARU],
            ubah=[dict(no=n, ket=ubah[n]['ket'], lama_md5=ubah[n]['lama_md5'], baru_md5=ubah[n]['baru_md5'], lama_panjang=ubah[n]['lama_len'], baru_panjang=ubah[n]['baru_len']) for n in NO_UBAH],
            fungsi=FUNGSI_BARU, fungsi_x9={f: dict(lama_md5=x9[f]['lama_md5'], baru_md5=x9[f]['baru_md5']) for f in FUNGSI_X9},
            rtf_berkas=JR, rtf_penanda=sum(r[4] for r in rtf_daftar), dependensi=DEP, harap=HARAP, ulang=ULANG)
json.dump(ring, open(os.path.join(AKAR, '..', 'hasil', 'isi-paket.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

berkas = sorted(x for x in os.listdir(KELUAR) if os.path.isfile(os.path.join(KELUAR, x)) and x != 'MD5SUMS.txt')
with open(os.path.join(KELUAR, 'MD5SUMS.txt'), 'w', newline='\n') as f:
    for x in berkas:
        f.write('%s  %s\n' % (md5(open(os.path.join(KELUAR, x), 'rb').read()), x))
print('baru', JB, 'ubah', JU, 'fungsi', JF, 'dependensi', len(DEP), 'rtf', JR, 'penanda', sum(r[4] for r in rtf_daftar))
print('HARAP', HARAP)
print('ULANG', ULANG)
print('MD5SUMS:', len(berkas), 'berkas')
for n in NO_UBAH:
    print(n, ubah[n]['lama_len'], '->', ubah[n]['baru_len'])
