# -*- coding: utf-8 -*-
"""Pembangun paket ABT x2-perbaikan-audit-sedang-21okt (python 3, di laptop). Membaca salinan persis abt_variabel (server pagi 21 Okt + paket x1,
HEX, baca-saja) dari berkas yang ditunjuk VAR_BASE_HEX, lalu menulis paket-satker/*.sql.
Isi LAMA baris yang diubah tidak disimpan di repo: paket hanya membawa sidik jari (md5) tiap kolom; isi lama dicadangkan di server oleh pasang-satker.sh
(cadangan/abt_variabel-sebelum.sql) dan dipakai pulih-satker.sh.
pakai: VAR_BASE_HEX=D:/Aplikasi/aleta/tmp/x2/lab/var_base_hex.tsv python bangun_paket.py"""
import hashlib
import json
import os
import re
import sys

AKAR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AKAR)
import variabel_def as V  # noqa: E402

N = 'abt-x2-perbaikan-audit-sedang-21okt'
KELUAR = os.path.join(AKAR, '..', 'paket-satker')
HEXFILE = os.environ.get('VAR_BASE_HEX', r'D:\Aplikasi\aleta\tmp\x2\lab\var_base_hex.tsv')
AUDIT = r'D:\Aplikasi\aleta\tmp\audit-variabel-abt-21okt.json'


def md5(b):
    return hashlib.md5(b).hexdigest()


def hx(b):
    return '0x' + b.hex()


def nul(x):
    return None if x == 'NULL' else x


# ---- baca keadaan dasar
dasar = {}
for baris in open(HEXFILE, encoding='latin1', newline='').read().split('\n')[1:]:
    if not baris.strip():
        continue
    k = baris.split('\t')
    no = int(k[0])
    dasar[no] = dict(no_var=no, nama=bytes.fromhex(k[1]), data_type=nul(k[2]), data_tabel=nul(k[3]), data_kolom=nul(k[4]),
                     urutan_data=None if k[5] == 'NULL' else int(k[5]), referensi=None if k[6] == 'NULL' else int(k[6]),
                     sql_query=None if k[7] == 'NULL' else bytes.fromhex(k[7]), default_data=None if k[8] == 'NULL' else bytes.fromhex(k[8]),
                     multi_sidang=nul(k[9]), locked=int(k[10]), modifier=nul(k[11]), modified=k[12])
assert len(dasar) == 2421, len(dasar)

# ---- daftar S5 sama dengan audit
aud = json.load(open(AUDIT, encoding='utf-8'))
s5 = {int(n) for x in aud['temuan'] if x['id'] == 'S5' for n in x['no_var']}
assert s5 == set(V.S5_TANGGAL) | set(V.S5_TEKS) and len(s5) == 52, sorted(s5 ^ (set(V.S5_TANGGAL) | set(V.S5_TEKS)))


# ---- baris dengan isi lengkap -> kondisi sidik jari (semua kolom isi; bukan locked/modifier/modified)
def kunci(r):
    return dict(no_var=r['no_var'], nama_md5=md5(r['nama']), data_type=r['data_type'], data_tabel=r['data_tabel'], data_kolom=r['data_kolom'],
                urutan_data=r['urutan_data'], referensi=r['referensi'],
                sql_md5=None if r['sql_query'] is None else md5(r['sql_query']),
                def_md5=None if r['default_data'] is None else md5(r['default_data']), multi_sidang=r['multi_sidang'])


def kond(r, a='', locked=None):
    p = a + '.' if a else ''
    k = kunci(r)

    def s(v):
        return "'%s'" % v.replace("'", "''")
    c = ["%sno_var=%d" % (p, k['no_var']), "MD5(%snama)='%s'" % (p, k['nama_md5']),
         "IFNULL(%sdata_type,'~')=%s" % (p, s(k['data_type'] if k['data_type'] is not None else '~')),
         "IFNULL(%sdata_tabel,'~')=%s" % (p, s(k['data_tabel'] if k['data_tabel'] is not None else '~')),
         "IFNULL(%sdata_kolom,'~')=%s" % (p, s(k['data_kolom'] if k['data_kolom'] is not None else '~')),
         "IFNULL(%surutan_data,-1)=%d" % (p, -1 if k['urutan_data'] is None else k['urutan_data']),
         "IFNULL(%sreferensi,-1)=%d" % (p, -1 if k['referensi'] is None else k['referensi']),
         "IFNULL(MD5(%ssql_query),'~')='%s'" % (p, k['sql_md5'] or '~'),
         "IFNULL(MD5(%sdefault_data),'~')='%s'" % (p, k['def_md5'] or '~'),
         "IFNULL(%smulti_sidang,'~')=%s" % (p, s(k['multi_sidang'] if k['multi_sidang'] is not None else '~'))]
    if locked is not None:
        c.append("%slocked=%d" % (p, locked))
    return '(' + ' AND '.join(c) + ')'


# ---- baris baru: harus belum ada di dasar
baru = {}
for d in V.BARU:
    assert d['no'] not in dasar, 'nomor %d sudah ada di server' % d['no']
    assert d['no'] not in baru, 'nomor ganda %d' % d['no']
    nama = d['nama'].encode('ascii')
    assert len(nama) <= 200, ('nama lebih dari 200 huruf', d['no'], len(nama))
    baru[d['no']] = dict(no_var=d['no'], nama=nama, data_type=d['tipe'], data_tabel=d['tabel'], data_kolom=d['kolom'], urutan_data=d['urutan'],
                         referensi=d['ref'], sql_query=d['sql'].encode('ascii') if d['sql'] else None,
                         default_data=d['default'].encode('ascii') if d['default'] else None, multi_sidang=None, locked=0, butir=d['butir'])
NO_BARU = sorted(baru)

# ---- baris ubah
lama = {}
sesudah = {}
kolom_ubah = {}
for no, u in sorted(V.UBAH.items()):
    r = dasar[no]
    delta = u['fungsi'](r)
    assert delta, no
    n = dict(r)
    for kol, nil in delta.items():
        assert kol in ('data_type', 'sql_query', 'default_data'), kol
        if isinstance(nil, str):
            nil = nil if kol == 'data_type' else nil.encode('ascii')
        n[kol] = nil
        assert n[kol] != r[kol], (no, kol)
    for kol in ('sql_query', 'default_data'):
        if n[kol] is not None:
            n[kol].decode('ascii')
    lama[no] = r
    sesudah[no] = n
    kolom_ubah[no] = sorted(delta)
NO_UBAH = sorted(lama)
KOL_SEMUA = ['data_type', 'sql_query', 'default_data']

# ---- ketergantungan: variabel yang dirujuk isi baru/diubah dan harus SUDAH ada (selain yang dibuat paket)
ref = set()
for d in baru.values():
    for b in (d['sql_query'], d['default_data']):
        if b:
            ref |= {int(x) for x in re.findall(rb'#(\d{1,5})#', b)}
    if d['referensi']:
        ref.add(d['referensi'])
for no in NO_UBAH:
    for kol in kolom_ubah[no]:
        b = sesudah[no][kol]
        if isinstance(b, bytes):
            ref |= {int(x) for x in re.findall(rb'#(\d{1,5})#', b)}
ref -= {0}  # '#perkara_id#' tidak berangka
DEP = sorted(x for x in ref if x not in baru)
hilang = [x for x in DEP if x not in dasar]
assert not hilang, 'dirujuk tetapi tidak ada di server dan tidak dibuat paket: %s' % hilang


def atau(lst):
    return '(' + ' OR '.join(lst) + ')' if lst else '(1=0)'


def daftar(ns):
    return ','.join(str(x) for x in ns)


KB = [kond(baru[n], locked=0) for n in NO_BARU]
KUL = [kond(lama[n]) for n in NO_UBAH]
KUB = [kond(sesudah[n]) for n in NO_UBAH]
JB, JU = len(NO_BARU), len(NO_UBAH)
HARAP = '0|0|%d|0|%d|0' % (JU, len(DEP))
ULANG = '0|%d|0|%d|%d|0' % (JB, JU, len(DEP))

KEPALA = ("-- Paket ABT \"%s\" (21 Okt 2026): perbaikan temuan SEDANG S1-S10 audit variabel ABT 21 Okt 2026.\n"
          "-- S1 #0015 | S2 #6032 #5101 | S3 #9003 #7105 #7106 | S4 #1241 #1242 #1251 #1252 #6149 | S5 52 variabel tanpa data_type | S6 #8544 #8545 | S7 #5128 | S8 variabel yang dirujuk BAS tetapi tidak ada | S9 #1335 (+#1372) | S10 #6271.\n"
          "-- %d variabel baru, %d baris diubah (hanya kolom data_type/sql_query/default_data). Keadaan dasar = server 21 Okt pagi + paket x1 (abt_variabel 2.421 baris).\n"
          % (N, JB, JU))

# ---- PRASYARAT
pra = KEPALA + ("-- PRASYARAT (baca saja) \"A|B|C|D|E|F\": A = nomor baru (%d) yang berisi LAIN dari paket (harus 0) | B = nomor baru yang sudah persis paket (0 pertama, %d ulang) | "
                "C = baris yang akan diubah (%d) yang masih berisi isi LAMA (%d pertama, 0 ulang) | D = yang sudah isi BARU (0 pertama, %d ulang) | "
                "E = variabel lama yang dirujuk dan harus ada (%d) | F = baris diubah yang isinya bukan lama bukan baru (harus 0).\n"
                "-- Benar: \"%s\" (pertama) atau \"%s\" (pasang ulang).\n") % (JB, JB, JU, JU, JU, len(DEP), HARAP, ULANG)
pra += ("SELECT CONCAT((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND NOT %s), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND NOT (%s OR %s))) AS prasyarat;\n") % (
    daftar(NO_BARU), atau(KB), atau(KB), atau(KUL), atau(KUB), daftar(DEP), daftar(NO_UBAH), atau(KUL), atau(KUB))

# ---- PASANG
ps = KEPALA + "-- PASANG: satu transaksi; nomor baru hanya ditulis bila belum ada; baris diubah hanya bila isinya masih persis isi LAMA (pasang ulang aman).\nSET NAMES latin1;\nSTART TRANSACTION;\n"
for n in NO_BARU:
    d = baru[n]
    ps += ("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
           "SELECT %d, %s, '%s', %s, %s, %s, %s, %s, %s, NULL, 0, '%s', '%s' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var=%d);\n") % (
        n, hx(d['nama']), d['data_type'], "'%s'" % d['data_tabel'] if d['data_tabel'] else 'NULL', "'%s'" % d['data_kolom'] if d['data_kolom'] else 'NULL',
        d['urutan_data'] if d['urutan_data'] else 'NULL', d['referensi'] if d['referensi'] else 'NULL',
        hx(d['sql_query']) if d['sql_query'] else 'NULL', hx(d['default_data']) if d['default_data'] else 'NULL', V.MODIFIER, V.MODIFIED, n)
for n in NO_UBAH:
    sets = []
    for kol in kolom_ubah[n]:
        nil = sesudah[n][kol]
        if nil is None:
            sets.append("%s=NULL" % kol)
        elif kol == 'data_type':
            sets.append("data_type='%s'" % nil)
        else:
            sets.append("%s=%s" % (kol, hx(nil)))
    ps += "UPDATE abt_variabel SET %s, modified='%s' WHERE %s;\n" % (', '.join(sets), V.MODIFIED, kond(lama[n]))
ps += "COMMIT;\n"

# ---- PERIKSA
pk = KEPALA + "-- PERIKSA: tiap variabel baru dan tiap baris yang diubah persis isi paket; baris terakhir \"SEMUA COCOK\".\n"
for n in NO_BARU:
    pk += "SELECT 'var %d baru' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (n, kond(baru[n], locked=0))
for n in NO_UBAH:
    pk += "SELECT 'var %d diubah' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (n, kond(sesudah[n]))
pk += "SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d, 'SEMUA COCOK', 'TIDAK COCOK') AS hasil;\n" % (atau(KB + KUB), JB + JU)

# ---- PULIH (butuh tabel sementara x2_lama berisi baris lama dari cadangan; disiapkan pulih-satker.sh)
pl = KEPALA + ("-- PULIH (deterministik): variabel baru dihapus HANYA bila isinya masih persis paket; baris yang diubah dikembalikan dari tabel sementara x2_lama\n"
               "-- (dibuat pulih-satker.sh dari cadangan/abt_variabel-sebelum.sql) HANYA bila isinya masih isi BARU paket dan baris cadangan masih isi LAMA yang diharapkan.\n"
               "-- Jalankan lewat pulih-satker.sh (bukan langsung): tabel x2_lama harus ada.\n")
pl += "START TRANSACTION;\n"
for n in NO_BARU:
    pl += "DELETE FROM abt_variabel WHERE %s;\n" % kond(baru[n], locked=0)
for n in NO_UBAH:
    pl += ("UPDATE abt_variabel a JOIN x2_lama l ON l.no_var=a.no_var SET a.data_type=l.data_type, a.sql_query=l.sql_query, a.default_data=l.default_data, "
           "a.modified=l.modified WHERE %s AND %s;\n") % (kond(sesudah[n], 'a'), kond(lama[n], 'l'))
pl += "COMMIT;\n"
pl += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)) = 0 AND (SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d, 'PULIH COCOK', "
       "CONCAT('PULIH TIDAK LENGKAP - nomor baru tersisa ', (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)), ', baris diubah yang sudah kembali ', "
       "(SELECT COUNT(*) FROM abt_variabel WHERE %s), ' dari %d (diubah orang sesudah dipasang? dibiarkan)')) AS hasil;\n") % (
    daftar(NO_BARU), atau(KUL), JU, daftar(NO_BARU), atau(KUL), JU)

for nama, isi in (('PRASYARAT', pra), ('PASANG', ps), ('PERIKSA', pk), ('PULIH', pl)):
    isi.encode('ascii')
    open(os.path.join(KELUAR, '%s-%s.sql' % (N, nama)), 'w', newline='\n', encoding='ascii').write(isi)

open(os.path.join(KELUAR, 'nomor-baru.txt'), 'w', newline='\n').write(daftar(NO_BARU) + '\n')
open(os.path.join(KELUAR, 'nomor-ubah.txt'), 'w', newline='\n').write(daftar(NO_UBAH) + '\n')

# ---- kueri uji untuk server (mandiri, tanpa rujukan variabel lain; #perkara_id# diganti pasang-satker.sh; hanya SELECT; baca saja)
def padat(b):
    s = b.decode('ascii') if isinstance(b, bytes) else b
    return re.sub(r'\s+', ' ', s).strip().rstrip(';')


uji = []
for n in NO_BARU:
    d = baru[n]
    if d['data_type'] == 'data_sql' and d['sql_query'] and not re.search(rb'#\d{1,5}#', d['sql_query'].replace(b'#perkara_id#', b'')):
        uji.append((n, padat(d['sql_query'])))
for n in NO_UBAH:
    s = sesudah[n]['sql_query']
    if sesudah[n]['data_type'] == 'data_sql' and s and not re.search(rb'#\d{1,5}#', s.replace(b'#perkara_id#', b'')):
        uji.append((n, padat(s)))
# S3: #0050# kosong dan 1 (sintaks di MariaDB server); rujukan lain (#7101#...) diganti teks pendek
for n in (9003, 7105, 7106):
    s = padat(sesudah[n]['sql_query'])
    s = re.sub(r'"#71\d\d#"', '"x"', s)
    uji.append((n, s.replace('#0050#', '1')))
    uji.append((n, s.replace('#0050#', '')))
with open(os.path.join(KELUAR, 'uji-kueri.tsv'), 'w', newline='\n', encoding='ascii') as f:
    f.write("# no_var<TAB>kueri (#perkara_id# diganti pasang-satker.sh; hanya SELECT; baca saja)\n")
    for n, q in uji:
        assert '\t' not in q
        f.write("%d\t%s\n" % (n, q))

# ringkasan terbaca
ring = dict(baru=[dict(no=n, nama=baru[n]['nama'].decode('ascii'), tipe=baru[n]['data_type'], butir=baru[n]['butir'],
                       sql=baru[n]['sql_query'].decode('ascii') if baru[n]['sql_query'] else None,
                       default=baru[n]['default_data'].decode('ascii') if baru[n]['default_data'] else None, ref=baru[n]['referensi']) for n in NO_BARU],
            ubah=[dict(no=n, butir=V.UBAH[n]['butir'], kolom=kolom_ubah[n],
                       sesudah={k: (sesudah[n][k].decode('ascii') if isinstance(sesudah[n][k], bytes) else sesudah[n][k]) for k in kolom_ubah[n]},
                       lama={k: (lama[n][k].decode('latin1') if isinstance(lama[n][k], bytes) else lama[n][k]) for k in kolom_ubah[n]}) for n in NO_UBAH],
            dependensi=DEP, harap=HARAP, ulang=ULANG)
json.dump(ring, open(os.path.join(AKAR, '..', 'hasil', 'isi-paket.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('baru', JB, 'ubah', JU, 'dependensi', len(DEP), 'uji', len(uji))
print('HARAP', HARAP)
print('ULANG', ULANG)
print('DEP', DEP)

berkas = sorted(x for x in os.listdir(KELUAR) if os.path.isfile(os.path.join(KELUAR, x)) and x != 'MD5SUMS.txt')
with open(os.path.join(KELUAR, 'MD5SUMS.txt'), 'w', newline='\n') as f:
    for x in berkas:
        f.write('%s  %s\n' % (md5(open(os.path.join(KELUAR, x), 'rb').read()), x))
print('MD5SUMS:', len(berkas), 'berkas')
