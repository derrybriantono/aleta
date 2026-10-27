# -*- coding: utf-8 -*-
"""Pembangun paket ABT pihak-urut-ecourt-27okt (python 3, di laptop). Membaca (1) salinan persis abt_variabel server (HEX, baca-saja) dari VAR_SERVER_HEX,
(2) definisi EMPAT fungsi x9 di server (HEX routine_definition, baca-saja), (3) salinan folder blangko derry_briantono dari RTF_DIR,
lalu menulis paket-satker/*. Isi lama baris yang diubah dijaga md5 dan dicadangkan di server oleh pasang-satker.sh.
pakai: python bangun_paket.py   (jalur bawaan: D:/Aplikasi/aleta/tmp/w91/...)"""
import base64
import hashlib
import json
import os
import re
import shutil

AKAR = os.path.dirname(os.path.abspath(__file__))
N = 'abt-pihak-urut-ecourt-27okt'
KELUAR = os.path.join(AKAR, '..', 'paket-satker')
TMPW = os.environ.get('PU_TMP', r'D:\Aplikasi\aleta\tmp\w91')
HEXFILE = os.environ.get('VAR_SERVER_HEX', os.path.join(TMPW, 'var_server_hex.tsv'))
RTF_DIR = os.environ.get('RTF_DIR', os.path.join(TMPW, 'rtf', 'derry_briantono'))
PAKET = os.path.join(AKAR, '..', '..')
X9_FUNGSI = os.path.join(PAKET, 'x9-pihak-banyak-21okt', 'paket-satker', 'abt-x9-pihak-banyak-21okt-FUNGSI.sql')
AG_FUNGSI = os.path.join(PAKET, 'alamat-ganda-26okt', 'paket-satker', 'abt-alamat-ganda-26okt-FUNGSI.sql')
MODIFIER = 'admin'
MODIFIED = '2026-10-27 00:00:00'

FUNGSI_BARU = ['isian_rtf_pihak_jumlah', 'isian_rtf_pihak_identitas', 'isian_rtf_pihak_nama_semua', 'isian_rtf_pihak_kaki', 'isian_rtf_pihak_sebut']
FUNGSI_X9 = ['isian_rtf_pihak_utama', 'isian_rtf_pihak_nama', 'isian_rtf_pihak_urutan', 'isian_rtf_pihak_tambahan']


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


def sub1(q, pola, ganti, jml=1, flags=0):
    hasil, n = re.subn(pola, ganti, q, flags=flags)
    assert n == jml, ('anchor', pola[:80], n, jml)
    return hasil


# ---------------------------------------------------------------------------------------------------------------------------------------------
# Ekspresi baku
RAPAT = '(MIN(urutan) = 1 AND MAX(urutan) = COUNT(*) AND COUNT(DISTINCT urutan) = COUNT(*))'


def alamat1(no):
    return ("IFNULL(NULLIF(TRIM((SELECT CONVERT(REPLACE(t.data, '\"', '') USING utf8) FROM aps_badilag.abt_data_teks t "
            "WHERE t.perkara_id = '#perkara_id#' AND t.no_var = %d LIMIT 1)), ''), '')" % no)


def ubah_7047(q):
    # urutan tidak rapat dari 1 (e-Court menomori bersambung): seluruh identitas dari fungsi menurut peringkat
    q = sub1(q, r'(SELECT\s+CASE\s+)(WHEN p1\.urutan = 1 THEN)',
             lambda m: m.group(1) + 'WHEN COALESCE(p1.rapat, 0) = 0 THEN aps_badilag.isian_rtf_pihak_identitas(#perkara_id#, 1, "#0046#", "tempat kediaman di", '
             + alamat1(8548) + ', "#8540#")\r\n        ' + m.group(2))
    q = sub1(q, r'SELECT perkara_id, MAX\(urutan\) AS urutan\b', lambda m: 'SELECT perkara_id, MAX(urutan) AS urutan, ' + RAPAT + ' AS rapat')
    return q


def ubah_7048(q):
    q = sub1(q, r'(CASE\s+)(WHEN COALESCE\(p1\.urutan, 0\) = 1 AND EXISTS \()',
             lambda m: m.group(1) + 'WHEN COALESCE(p1.rapat, 0) = 0 THEN aps_badilag.isian_rtf_pihak_identitas(#perkara_id#, 2, "#0047#", "tempat kediaman di", '
             + alamat1(8549) + ', "#8541#")\r\n        ' + m.group(2))
    q = sub1(q, r'SELECT COALESCE\(pp\.urutan, 0\) AS urutan\b', lambda m: 'SELECT COALESCE(pp.urutan, 0) AS urutan, pp.rapat AS rapat')
    q = sub1(q, r'SELECT MAX\(urutan\) AS urutan\b', lambda m: 'SELECT MAX(urutan) AS urutan, ' + RAPAT + ' AS rapat')
    return q


def ubah_7097(q):
    q = sub1(q, r'(SELECT\s+CASE\s+)(WHEN p1\.urutan = 1 THEN)',
             lambda m: m.group(1) + 'WHEN COALESCE(p1.rapat, 0) = 0 THEN aps_badilag.isian_rtf_pihak_nama_semua(#perkara_id#, 1, "#0046#")\r\n        ' + m.group(2))
    q = sub1(q, r'SELECT perkara_id, MAX\(urutan\) AS urutan\b', lambda m: 'SELECT perkara_id, MAX(urutan) AS urutan, ' + RAPAT + ' AS rapat')
    return q


def ubah_7098(q):
    q = sub1(q, r'(CASE\s+)(WHEN p1\.urutan = 1 AND EXISTS \()',
             lambda m: m.group(1) + 'WHEN COALESCE(p1.rapat, 0) = 0 THEN aps_badilag.isian_rtf_pihak_nama_semua(#perkara_id#, 2, "#0047#")\r\n        ' + m.group(2))
    q = sub1(q, r'SELECT COALESCE\(pp\.urutan, 0\) AS urutan\b', lambda m: 'SELECT COALESCE(pp.urutan, 0) AS urutan, pp.rapat AS rapat')
    q = sub1(q, r'SELECT MAX\(urutan\) AS urutan\b', lambda m: 'SELECT MAX(urutan) AS urutan, ' + RAPAT + ' AS rapat')
    return q


def ubah_7036_7037(q):
    return sub1(q, r'MAX\(pp1\.urutan\) AS urutan', lambda m: 'COUNT(*) AS urutan')


def ubah_7152(q):
    q = sub1(q, r'^select \(case', lambda m: 'select CONCAT((case', flags=re.M)
    q = sub1(q, r'end\) data\s*$', lambda m: 'end), IF("#3520#" = "", "", " serta #3520#")) data')
    return q


def ubah_8516(q):
    q = sub1(q, r'(\n\s*ORDER BY j\.urutan DESC LIMIT 1\) AS akhir,)',
             lambda m: m.group(1) + "\r\n    (SELECT IF(j.dihadiri_oleh IN (7, 8, 9), 1, 0) FROM perkara_jadwal_sidang j WHERE j.perkara_id = p.perkara_id AND IFNULL(j.ikrar_talak, 'T') <> 'Y' "
             "AND j.tanggal_sidang <= IFNULL((SELECT MAX(pu.tanggal_putusan) FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan > '1000-01-01'), '9999-12-31') "
             "ORDER BY j.urutan DESC LIMIT 1) AS ivh,")
    q = sub1(q, r'(\n\s*)(IF\(z\.ecourt, ", dan #0194# tersebut)',
             lambda m: m.group(1) + 'IF(IFNULL(z.ivh, 0) = 1 AND "#3521#" <> "", " serta #3521#", ""),' + m.group(1) + m.group(2))
    return q


UBAH_FN = {
    7036: (ubah_7036_7037, '7036: penyebutan Pemohon/Penggugat atau para ... menurut JUMLAH pihak (bukan nilai urutan terbesar)'),
    7037: (ubah_7036_7037, '7037: penyebutan Termohon/Tergugat atau para ... menurut JUMLAH pihak (bukan nilai urutan terbesar)'),
    7047: (ubah_7047, '7047: identitas Pemohon/Penggugat; urutan tidak rapat -> fungsi menurut peringkat'),
    7048: (ubah_7048, '7048: identitas Termohon/Tergugat; urutan tidak rapat -> fungsi menurut peringkat'),
    7097: (ubah_7097, '7097: nama Pemohon/Penggugat; urutan tidak rapat -> fungsi menurut peringkat'),
    7098: (ubah_7098, '7098: nama Termohon/Tergugat; urutan tidak rapat -> fungsi menurut peringkat'),
    7148: (lambda q: b'SELECT aps_badilag.isian_rtf_pihak_kaki(#perkara_id#, 1) AS data'.decode('latin1'), '7148: pihak P di kaki putusan, romawi untuk semua, peringkat'),
    7149: (lambda q: b'SELECT aps_badilag.isian_rtf_pihak_kaki(#perkara_id#, 2) AS data'.decode('latin1'), '7149: pihak T di kaki putusan, romawi untuk semua, peringkat'),
    7152: (ubah_7152, '7152: pihak T di kaki + kuasa + Turut Tergugat'),
    8516: (ubah_8516, '8516: kehadiran di kaki putusan + pihak intervensi bila hadir'),
}

BARU = [
    dict(no=3520, nama='PIHAK: SEBUTAN TURUT #0047# UNTUK KAKI PUTUSAN (OTOMATIS dari SIPP perkara_pihak4: Turut Tergugat I dan Turut Tergugat II; kosong bila tidak ada)',
         sql='SELECT aps_badilag.isian_rtf_pihak_sebut(#perkara_id#, 4) AS data'),
    dict(no=3521, nama='PIHAK: SEBUTAN PIHAK INTERVENSI UNTUK KAKI PUTUSAN (OTOMATIS dari SIPP perkara_pihak3; kosong bila tidak ada)',
         sql='SELECT aps_badilag.isian_rtf_pihak_sebut(#perkara_id#, 3) AS data'),
]
# ---- kaki putusan NO karena Penggugat/Pemohon hadir lalu tidak hadir lagi (SEMA 1/2022) dan NO "P & T tidak hadir": kehadiran TETAP "di luar hadirnya ..."
# (kehadiran yang tercatat di SIPP tidak dipakai). 3522 = kalimat kehadiran; 3523 = salinan 8502 (kaki putusan majelis/tunggal) yang memanggil 3522 sebagai ganti 8516.
BARU.append(dict(no=3522,
    nama='KAKI PUTUSAN NO PIHAK TIDAK HADIR (OTOMATIS: kehadiran tetap "di luar hadirnya #0046# dan #0047#", jamak menurut jumlah pihak, Turut Tergugat ikut, kalimat e-Court)',
    sql=('SELECT CONCAT("di luar hadirnya ", "#7036#", '
         "IF(EXISTS (SELECT 1 FROM perkara_pihak2 WHERE perkara_id = '#perkara_id#'), CONCAT(\" dan \", \"#7037#\"), \"\"), "
         'IF("#3520#" = "", "", " serta #3520#"), '
         "IF(EXISTS (SELECT 1 FROM perkara_efiling_id f WHERE f.perkara_id = '#perkara_id#' AND f.efiling_id <> ''), "
         '", dan #0194# tersebut telah dikirim secara elektronik melalui sistem informasi pengadilan pada hari itu juga.", ".")) AS data')))
_s8502 = server[8502]['sql'].decode('latin1')
assert _s8502.count('#8516#') >= 1
BARU.append(dict(no=3523, nama='2. KAKI PUTUSAN MAJELIS ATAU TUNGGAL - NO PIHAK TIDAK HADIR (salinan 8502; kehadiran tetap, bukan yang tercatat)',
                 sql=_s8502.replace('#8516#', '#3522#')))
baru = {}
for d in BARU:
    assert d['no'] not in server, 'nomor %d sudah ada di server' % d['no']
    d = dict(d)
    d['nama_b'] = d['nama'].encode('ascii')
    assert len(d['nama_b']) <= 200, ('nama > 200 huruf', d['no'], len(d['nama_b']))
    assert set(re.findall(r'#(\d+)#', d['nama'])) <= {'0046', '0047'}, ('nama memuat rujukan variabel lain', d['no'])
    d['sql_b'] = d['sql'].encode('latin1')
    baru[d['no']] = d
NO_BARU = sorted(baru)

ubah = {}
for no in sorted(UBAH_FN):
    fn, ket = UBAH_FN[no]
    s = server[no]
    assert s['sql'] is not None
    nb = fn(s['sql'].decode('latin1')).encode('latin1')
    assert nb != s['sql'], no
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

# ---- empat fungsi x9: definisi LAMA = routine_definition server (baca saja); kepala (CREATE FUNCTION ...) diambil dari berkas paket sebelumnya
x9src = open(X9_FUNGSI, 'rb').read().decode('latin1')
agsrc = open(AG_FUNGSI, 'rb').read().decode('latin1')
x9 = {}
for f in FUNGSI_X9:
    lama = bytes.fromhex(open(os.path.join(TMPW, 'fn-%s.hex' % f)).read().strip()).decode('latin1')
    sumber = agsrc if f in ('isian_rtf_pihak_utama', 'isian_rtf_pihak_tambahan') else x9src
    m = re.search(r'(CREATE FUNCTION %s\(.*?\n)BEGIN\n' % f, sumber, re.S)
    assert m, f
    assert lama.startswith('BEGIN\n') or lama.startswith('BEGIN\r\n'), f
    x9[f] = dict(kepala=m.group(1), lama=lama, lama_md5=md5(lama.encode('latin1')))
fungsi_baru = open(os.path.join(AKAR, 'templat-fungsi.sql'), 'rb').read().decode('latin1').replace('\r\n', '\n')
assert fungsi_baru.rstrip().endswith('DELIMITER ;')
# definisi BARU: badan fungsi (antara BEGIN dan END$$) -> md5 routine_definition (MariaDB menyimpan BEGIN ... END persis seperti ditulis)
for f in FUNGSI_X9 + FUNGSI_BARU:
    m = re.search(r'CREATE FUNCTION %s\(.*?\nBEGIN\n(.*?)\nEND\$\$' % f, fungsi_baru, re.S)
    assert m, f
    badan = 'BEGIN\n' + m.group(1) + '\nEND'
    if f in x9:
        x9[f]['baru'] = badan
        x9[f]['baru_md5'] = md5(badan.encode('latin1'))
    else:
        globals().setdefault('BARU_FN', {})[f] = dict(baru=badan, baru_md5=md5(badan.encode('latin1')))


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
JX = len(FUNGSI_X9)
FN_IN = ','.join("'%s'" % f for f in FUNGSI_BARU)
X9_LAMA = ' OR '.join("(routine_name='%s' AND MD5(routine_definition)='%s')" % (f, x9[f]['lama_md5']) for f in FUNGSI_X9)
X9_BARU = ' OR '.join("(routine_name='%s' AND MD5(routine_definition)='%s')" % (f, x9[f]['baru_md5']) for f in FUNGSI_X9)
FN_BARU_MD5 = ' OR '.join("(routine_name='%s' AND MD5(routine_definition)='%s')" % (f, BARU_FN[f]['baru_md5']) for f in FUNGSI_BARU)

# ---- RTF: Turut Tergugat (#8710#) dan pihak intervensi (#7054#) di bagian identitas blangko keluarga yang sudah memuat Turut Tergugat
def keluarga(folder):
    return folder[:-6] if folder.endswith(' - BAS') else folder


berkas = []
ada_turut = set()
for dp, dn, fn in os.walk(RTF_DIR):
    for f in sorted(fn):
        if not f.lower().endswith('.rtf'):
            continue
        p = os.path.join(dp, f)
        rel = os.path.relpath(p, RTF_DIR).replace('\\', '/')
        b = open(p, 'rb').read()
        folder = rel.split('/')[0]
        berkas.append((rel, folder, b))
        if b'#8710#' in b and not folder.endswith(' - BAS'):
            ada_turut.add(keluarga(folder))

rtf_daftar, rtf_tambal = [], []
kode_n = 0
jml_8710 = jml_7054 = 0
POLA_NO = re.compile(r'Hadir Lalu 2x|Hadir Sidang Pertama Lalu 2x|Tidak Hadir Lagi|\[NO\] 4\. Cerai P & T Tidak Hadir')
jml_no = 0
for rel, folder, b in berkas:
    if folder.startswith('terhapus'):
        continue
    nama_b = rel.split('/')[-1]
    no_sema = (not folder.endswith(' - BAS')) and '[NO]' in nama_b and POLA_NO.search(nama_b) is not None and b'#8502#' in b
    if keluarga(folder) not in ada_turut and not no_sema:
        continue
    t = b.decode('latin1')
    langkah = []
    baru_t = t
    if no_sema:
        # kaki NO: kehadiran tetap (3523 = 8502 yang memanggil 3522)
        assert baru_t.count('#8502#') == 1, (rel, '8502 tidak tepat satu')
        langkah.append(('#8502#', '#3523#', 1))
        baru_t = baru_t.replace('#8502#', '#3523#')
        jml_no += 1
    if keluarga(folder) not in ada_turut:
        kode_n += 1
        rtf_daftar.append((kode_n, rel, md5(b), md5(baru_t.encode('latin1')), 1))
        rtf_tambal.append((rel, 1, 1, '#8502#', '#3523#'))
        continue
    # (1) #8710# sesudah variabel identitas pihak kedua (#7048#, atau #9350# pada ekonomi syariah) yang belum diikuti #8710#
    for kunci in ('#7048#', '#9350#'):
        total = baru_t.count(kunci)
        if total == 0:
            continue
        sudah = baru_t.count(kunci + '#8710#')
        kurang = total - sudah
        if kurang == 0:
            continue
        # sesudah variabel selalu "}" (akhir potongan teks RTF) atau "#8710#" - diperiksa
        assert baru_t.count(kunci + '}') == kurang, (rel, kunci, 'bukan akhir potongan teks')
        langkah.append((kunci + '}', kunci + '#8710#}', kurang))
        baru_t = baru_t.replace(kunci + '}', kunci + '#8710#}')
        jml_8710 += kurang
    # (2) #7054# sesudah #8710# (kosong bila tidak ada pihak intervensi)
    if '#8710#' in baru_t:
        assert '#7054#' not in baru_t, (rel, '7054 sudah ada')
        n2 = baru_t.count('#8710#')
        assert baru_t.count('#8710#}') == n2, (rel, '#8710# bukan akhir potongan teks')
        langkah.append(('#8710#}', '#8710##7054#}', n2))
        baru_t = baru_t.replace('#8710#}', '#8710##7054#}')
        jml_7054 += n2
    if not langkah:
        continue
    kode_n += 1
    assert '\t' not in rel and '\n' not in rel
    rtf_daftar.append((kode_n, rel, md5(b), md5(baru_t.encode('latin1')), sum(x[2] for x in langkah)))
    for u, (a, g, j) in enumerate(langkah, 1):
        rtf_tambal.append((rel, u, j, a, g))
JR = len(rtf_daftar)

KEPALA = ("-- Paket ABT \"%s\" (27 Okt 2026): sebutan pihak banyak menurut peringkat (perkara e-Court dengan urutan bersambung), Turut Tergugat dan kaki putusan.\n"
          "-- %d variabel baru (%s), %d baris variabel diubah (%s), %d fungsi tersimpan baru (%s), %d fungsi x9 diganti (%s), %d blangko RTF derry_briantono ditambal.\n"
          % (N, JB, daftar(NO_BARU), JU, ', '.join(str(n) for n in NO_UBAH), JF, ', '.join(FUNGSI_BARU), JX, ', '.join(FUNGSI_X9), JR))

HARAP = '0|0|%d|0|0|%d|0|%d|0' % (JU, len(DEP), JX)
ULANG = '0|%d|0|%d|%d|%d|0|0|%d' % (JB, JU, JF, len(DEP), JX)

pra = KEPALA + ("-- PRASYARAT (baca saja) \"A|B|C|D|E|F|G|H|I\": A = nomor baru (%d) yang berisi LAIN dari paket (harus 0) | B = nomor baru yang sudah persis paket (0 pertama, %d ulang) | "
                "C = baris yang akan diubah (%d) yang masih isi LAMA (%d pertama, 0 ulang) | D = yang sudah isi BARU (0 pertama, %d ulang) | "
                "E = fungsi baru (%d) yang sudah ada (0 pertama, %d ulang) | F = variabel lama yang dirujuk dan harus ada (%d) | G = baris diubah yang bukan lama bukan baru (harus 0) | "
                "H = fungsi x9 (%d) yang masih isi LAMA (%d pertama, 0 ulang) | I = fungsi x9 yang sudah isi BARU (0 pertama, %d ulang).\n"
                "-- Benar: \"%s\" (pertama) atau \"%s\" (pasang ulang).\n") % (JB, JB, JU, JU, JU, JF, JF, len(DEP), JX, JX, JX, HARAP, ULANG)
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

CEK_FN = "(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND (%s)) = %d" % (FN_BARU_MD5, JF)
CEK_X9 = "(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND (%s)) = %d" % (X9_BARU, JX)
CEK_UJI = ("isian_rtf_romawi(11) = 'XI' AND isian_rtf_romawi(25) = 'XXV' AND isian_rtf_romawi(12) = 'XII' "
           "AND isian_rtf_pihak_utama(0, 1, 1, 'Pemohon', 'tempat kediaman di') = '' AND isian_rtf_pihak_nama(0, 2, 1, 'Tergugat') = '' "
           "AND isian_rtf_pihak_urutan(0, 1, 'Pemohon') = '' AND isian_rtf_pihak_tambahan(0, 4) = '' AND isian_rtf_pihak_identitas(0, 2, 'Tergugat', 'tempat kediaman di', '', '') = '' "
           "AND isian_rtf_pihak_nama_semua(0, 1, 'Pemohon') = '' AND isian_rtf_pihak_kaki(0, 1) IS NULL AND isian_rtf_pihak_sebut(0, 4) = '' AND isian_rtf_pihak_jumlah(0, 1) = 0")
pk = KEPALA + "-- PERIKSA: tiap variabel baru dan baris diubah persis isi paket; fungsi ada dan benar; baris terakhir \"SEMUA COCOK\".\n"
for n in NO_BARU:
    pk += "SELECT 'var %d baru' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (n, kond_baru(baru[n]))
for n in NO_UBAH:
    pk += "SELECT 'var %d diubah' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (n, kond_ubah(n, 'baru'))
pk += "SELECT 'fungsi baru ada' AS butir, IF(%s, 1, 0) AS cocok;\n" % CEK_FN
pk += "SELECT 'fungsi x9 diganti' AS butir, IF(%s, 1, 0) AS cocok;\n" % CEK_X9
pk += "SELECT 'fungsi jalan' AS butir, IF(%s, 1, 0) AS cocok;\n" % CEK_UJI
pk += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d AND %s AND %s AND %s, 'SEMUA COCOK', 'TIDAK COCOK') AS hasil;\n") % (
    atau(KB + KUB), JB + JU, CEK_FN, CEK_X9, CEK_UJI)

pl = KEPALA + ("-- PULIH (deterministik): variabel baru dihapus HANYA bila isinya masih persis paket; baris yang diubah dikembalikan dari tabel sementara pu_lama\n"
               "-- (dibuat pulih-satker.sh dari cadangan/abt_variabel-sebelum.sql) HANYA bila isinya masih isi BARU paket dan baris cadangan masih isi LAMA yang diharapkan.\n"
               "-- Fungsi x9 dikembalikan dan fungsi PU dihapus oleh pulih-satker.sh SESUDAH ini. Jalankan lewat pulih-satker.sh (bukan langsung): tabel pu_lama harus ada.\n")
pl += "START TRANSACTION;\n"
for n in NO_UBAH:
    pl += ("UPDATE abt_variabel a JOIN pu_lama l ON l.no_var=a.no_var SET a.nama=l.nama, a.data_type=l.data_type, a.data_tabel=l.data_tabel, a.data_kolom=l.data_kolom, "
           "a.urutan_data=l.urutan_data, a.referensi=l.referensi, a.sql_query=l.sql_query, a.default_data=l.default_data, a.multi_sidang=l.multi_sidang, a.locked=l.locked, "
           "a.modifier=l.modifier, a.modified=l.modified WHERE %s AND %s;\n") % (kond_ubah(n, 'baru', 'a'), kond_ubah(n, 'lama', 'l'))
for n in NO_BARU:
    pl += "DELETE FROM abt_variabel WHERE %s;\n" % kond_baru(baru[n])
pl += "COMMIT;\n"
pl += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)) = 0 AND (SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d, 'VARIABEL KEMBALI', "
       "CONCAT('PULIH TIDAK LENGKAP - nomor baru tersisa ', (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)), ', baris diubah yang sudah kembali ', "
       "(SELECT COUNT(*) FROM abt_variabel WHERE %s), ' dari %d (diubah orang sesudah dipasang? dibiarkan)')) AS hasil;\n") % (
    daftar(NO_BARU), atau(KUL), JU, daftar(NO_BARU), atau(KUL), JU)

# ---- berkas fungsi: baru (-FUNGSI.sql = templat) dan lama (empat fungsi x9 sebagaimana di server)
bagian_lama = '-- Definisi LAMA empat fungsi x9 (routine_definition di server pada 27 Okt 2026) - dipakai PULIH.\nDELIMITER $$\n\n'
for f in FUNGSI_X9:
    isi = x9[f]['lama'].replace('\r\n', '\n')
    assert isi.rstrip().endswith('END')
    bagian_lama += 'DROP FUNCTION IF EXISTS %s$$\n%s%s$$\n\n' % (f, x9[f]['kepala'], isi)
bagian_lama += 'DELIMITER ;\n'

for nama, isi in (('PRASYARAT', pra), ('PASANG', ps), ('PERIKSA', pk), ('PULIH', pl)):
    open(os.path.join(KELUAR, '%s-%s.sql' % (N, nama)), 'w', newline='\n', encoding='ascii').write(isi)
open(os.path.join(KELUAR, '%s-FUNGSI.sql' % N), 'wb').write(fungsi_baru.encode('latin1'))
open(os.path.join(KELUAR, '%s-FUNGSI-X9-LAMA.sql' % N), 'wb').write(bagian_lama.encode('latin1'))
open(os.path.join(KELUAR, 'nomor-baru.txt'), 'w', newline='\n').write(daftar(NO_BARU) + '\n')
open(os.path.join(KELUAR, 'nomor-ubah.txt'), 'w', newline='\n').write(daftar(NO_UBAH) + '\n')
open(os.path.join(KELUAR, 'nama-fungsi.txt'), 'w', newline='\n').write(' '.join(FUNGSI_BARU) + '\n')
open(os.path.join(KELUAR, 'rtf-daftar-tambal.tsv'), 'w', newline='\n', encoding='utf-8').write(''.join('R%03d\t%s\t%s\t%s\t%d\n' % r for r in rtf_daftar))
open(os.path.join(KELUAR, 'rtf-tambal.tsv'), 'w', newline='\n', encoding='ascii').write(''.join(
    '%s\t%d\t%d\t%s\t%s\n' % (base64.b64encode(rel.encode('utf-8')).decode(), u, j, base64.b64encode(a.encode()).decode(), base64.b64encode(g.encode()).decode()) for rel, u, j, a, g in rtf_tambal))
shutil.copyfile(os.path.join(PAKET, 'alamat-ganda-26okt', 'sumber', 'tambal-rtf.pl'), os.path.join(AKAR, 'tambal-rtf.pl'))
shutil.copyfile(os.path.join(AKAR, 'tambal-rtf.pl'), os.path.join(KELUAR, 'tambal-rtf.pl'))
open(os.path.join(KELUAR, 'harap.txt'), 'w', newline='\n').write(HARAP + '\n' + ULANG + '\n')
for sk in ('pasang-satker.sh', 'pulih-satker.sh'):
    open(os.path.join(KELUAR, sk), 'wb').write(open(os.path.join(AKAR, sk), 'rb').read().replace(b'\r\n', b'\n'))
open(os.path.join(KELUAR, 'perkara-uji.txt'), 'w', newline='\n').write(open(os.path.join(AKAR, 'perkara-uji.txt')).read())

ring = dict(baru=[dict(no=n, nama=baru[n]['nama'], sql=baru[n]['sql']) for n in NO_BARU],
            ubah=[dict(no=n, ket=ubah[n]['ket'], lama_md5=ubah[n]['lama_md5'], baru_md5=ubah[n]['baru_md5'], lama_panjang=ubah[n]['lama_len'], baru_panjang=ubah[n]['baru_len']) for n in NO_UBAH],
            fungsi_baru={f: BARU_FN[f]['baru_md5'] for f in FUNGSI_BARU}, fungsi_x9={f: dict(lama_md5=x9[f]['lama_md5'], baru_md5=x9[f]['baru_md5']) for f in FUNGSI_X9},
            rtf_berkas=JR, rtf_kaki_no=jml_no, rtf_tambah_8710=jml_8710, rtf_tambah_7054=jml_7054, dependensi=DEP, harap=HARAP, ulang=ULANG)
json.dump(ring, open(os.path.join(AKAR, '..', 'hasil', 'isi-paket.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

berkas_paket = sorted(x for x in os.listdir(KELUAR) if os.path.isfile(os.path.join(KELUAR, x)) and x != 'MD5SUMS.txt')
with open(os.path.join(KELUAR, 'MD5SUMS.txt'), 'w', newline='\n') as f:
    for x in berkas_paket:
        f.write('%s  %s\n' % (md5(open(os.path.join(KELUAR, x), 'rb').read()), x))
print('baru', JB, 'ubah', JU, 'fungsi baru', JF, 'fungsi x9', JX, 'dependensi', len(DEP), 'rtf', JR, 'tambah8710', jml_8710, 'tambah7054', jml_7054, 'kaki NO', jml_no)
print('HARAP', HARAP)
print('ULANG', ULANG)
print('MD5SUMS:', len(berkas_paket), 'berkas')
for n in NO_UBAH:
    print(n, ubah[n]['lama_len'], '->', ubah[n]['baru_len'])
