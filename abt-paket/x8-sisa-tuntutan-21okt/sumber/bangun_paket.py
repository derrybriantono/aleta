# -*- coding: utf-8 -*-
"""Pembangun paket ABT x8-sisa-tuntutan-21okt (python 3, di laptop). Membaca salinan persis abt_variabel server (HEX, baca-saja,
21 Okt malam sesudah x1-x5 (+ fungsi x6/x7): 2.480 baris) dari VAR_SERVER_HEX dan salinan pohon blangko derry_briantono server (RTF_SERVER, baca-saja),
lalu menulis paket-satker/*.sql, rtf-daftar-tambal.tsv, rtf-tambal.tsv, daftar nomor, uji-kueri.tsv, MD5SUMS.txt.
Isi LAMA baris yang diubah TIDAK disimpan di repo (cukup md5-nya): dicadangkan di server oleh pasang-satker.sh.
pakai: python bangun_paket.py [folder keluaran pohon RTF hasil tambal untuk uji laptop]"""
import base64
import fnmatch
import hashlib
import json
import os
import re
import sys

AKAR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AKAR)
import importlib.util  # noqa: E402
_s = importlib.util.spec_from_file_location('rtf_def_x8', os.path.join(AKAR, 'rtf_def.py'))
R = importlib.util.module_from_spec(_s)
_s.loader.exec_module(R)  # dimuat lewat jalur: definisi_x8 memuat sumber x4 yang juga punya rtf_def
import definisi_x8 as V  # noqa: E402

N = 'abt-x8-sisa-tuntutan-21okt'
KELUAR = os.path.join(AKAR, '..', 'paket-satker')
HEXFILE = os.environ.get('VAR_SERVER_HEX', r'D:\Aplikasi\aleta\tmp\w38\var_server_hex.tsv')
RTF_SERVER = os.environ.get('RTF_SERVER', r'D:\Aplikasi\aleta\tmp\w38\rtf-server\derry_briantono')
PJ = '\\\\?\\'


def md5(b):
    return hashlib.md5(b).hexdigest()


def hx(b):
    return '0x' + b.hex()


# ---- baca isi server
server = {}
for baris in open(HEXFILE, encoding='latin1', newline='').read().split('\n')[1:]:
    if not baris.strip():
        continue
    k = baris.split('\t')
    no = int(k[0])
    server[no] = dict(nama=bytes.fromhex(k[1]), tipe=k[2], tabel=k[3], kolom=k[4], urut=k[5], ref=k[6],
                      sql=None if k[7] == 'NULL' else bytes.fromhex(k[7]), default=None if k[8] == 'NULL' else bytes.fromhex(k[8]),
                      multi=k[9], locked=k[10], modifier=k[11], modified=k[12])
assert len(server) == 2480, ('salinan server bukan 2.480 baris (x1-x5 terpasang)', len(server))

# ---- baris baru: harus belum ada di server
baru = {}
for d in V.BARU:
    assert d['no'] not in server, 'nomor %d sudah ada di server' % d['no']
    assert d['no'] not in baru, 'nomor ganda %d' % d['no']
    d = dict(d)
    d['nama_b'] = d['nama'].encode('ascii')
    assert len(d['nama_b']) <= 200, ('nama lebih dari 200 huruf', d['no'])
    d['sql_b'] = d['sql'].encode('ascii') if d['sql'] else None
    assert not d['sql_b'] or len(d['sql_b']) < 65535, ('kueri melebihi TEXT', d['no'])
    assert b'aleta' not in (d['sql_b'] or b'').lower() and b'aleta' not in d['nama_b'].lower()
    d['def_b'] = d['default'].encode('ascii') if d['default'] else None
    baru[d['no']] = d
NO_BARU = sorted(baru)

# ---- baris ubah
ubah = {}
for no, u in sorted(V.susun_ubah(server).items()):
    s = server[no]
    kol = u['kolom']
    lama = s['sql'] if kol == 'sql_query' else s['default']
    assert lama is not None, no
    baru_b = u['fungsi'](lama)
    assert baru_b != lama, no
    assert len(baru_b) < 65535, ('kueri melebihi TEXT', no)
    ubah[no] = dict(kolom=kol, lama_md5=md5(lama), baru_b=baru_b, baru_md5=md5(baru_b), nama_md5=md5(s['nama']), tipe=s['tipe'], butir=u['butir'],
                    kelompok=u['kelompok'], lama_len=len(lama), baru_len=len(baru_b))
NO_UBAH = sorted(ubah)

# ---- ketergantungan
ref = set()
for d in baru.values():
    for b in (d['sql_b'], d['def_b']):
        if b:
            ref |= {int(x) for x in re.findall(rb'#(\d{1,5})#', b)}
for no, u in ubah.items():
    for x in re.findall(rb'#(\d{1,5})#', u['baru_b']):
        ref.add(int(x))
ref -= {0}
DEP = sorted(x for x in ref if x not in baru)
hilang = [x for x in DEP if x not in server]
assert not hilang, 'dirujuk tetapi tidak ada di server dan tidak dibuat paket: %s' % hilang

# ---- tambalan RTF


def semua_rtf():
    for r, ds, fs in os.walk(PJ + RTF_SERVER):
        for f in fs:
            if f.lower().endswith('.rtf'):
                p = os.path.join(r, f)
                yield os.path.relpath(p, PJ + RTF_SERVER).replace('\\', '/'), p


RTFS = dict(semua_rtf())
daftar_rtf, tambal_tsv = [], []
POHON_HASIL = sys.argv[1] if len(sys.argv) > 1 else None
kode = 0
for folder, awal, jenis in R.BERKAS:
    cocok = sorted(r for r in RTFS if r.startswith(folder + '/') and r[len(folder) + 1:].startswith(awal))
    assert cocok, ('tidak ada berkas', folder, awal)
    for rel in cocok:
        mentah = open(RTFS[rel], 'rb').read()
        s = mentah.decode('latin1')
        for i, (j, b, n) in enumerate(R.JENIS[jenis], 1):
            c = s.count(j)
            assert c == n, ('jangkar', rel, j, c)
            s = s.replace(j, b)
            tambal_tsv.append('%s\t%d\t%d\t%s\t%s' % (base64.b64encode(rel.encode('latin1')).decode(), i, n, base64.b64encode(j.encode('latin1')).decode(),
                                                      base64.b64encode(b.encode('latin1')).decode()))
        hasil = s.encode('latin1')
        kode += 1
        daftar_rtf.append(dict(kode='R%03d' % kode, rel=rel, m0=md5(mentah), m1=md5(hasil), n=len(R.JENIS[jenis]), jenis=jenis))
        if POHON_HASIL:
            p = PJ + os.path.join(POHON_HASIL, rel.replace('/', '\\'))
            os.makedirs(os.path.dirname(p), exist_ok=True)
            open(p, 'wb').write(hasil)
NR = len(daftar_rtf)


# ---- syarat baris
def kond_baru(d, a=''):
    p = a + '.' if a else ''
    c = ["%sno_var=%d" % (p, d['no']), "MD5(%snama)='%s'" % (p, md5(d['nama_b'])), "%sdata_type='%s'" % (p, d['tipe']),
         "IFNULL(%sdata_tabel,'')='%s'" % (p, d['tabel'] or ''), "IFNULL(%sdata_kolom,'')='%s'" % (p, d['kolom'] or ''),
         "IFNULL(%surutan_data,0)=%d" % (p, d['urutan'] or 0), "%sreferensi IS NULL" % p, "%smulti_sidang IS NULL" % p, "%slocked=0" % p,
         "IFNULL(MD5(%ssql_query),'-')='%s'" % (p, md5(d['sql_b']) if d['sql_b'] else '-'),
         "IFNULL(MD5(%sdefault_data),'-')='%s'" % (p, md5(d['def_b']) if d['def_b'] else '-')]
    return '(' + ' AND '.join(c) + ')'


def kond_ubah(no, keadaan, a=''):
    p = a + '.' if a else ''
    u = ubah[no]
    m = u['lama_md5'] if keadaan == 'lama' else u['baru_md5']
    return "(%sno_var=%d AND MD5(%snama)='%s' AND %sdata_type='%s' AND MD5(%s%s)='%s')" % (p, no, p, u['nama_md5'], p, u['tipe'], p, u['kolom'], m)


def atau(lst):
    return '(' + ' OR '.join(lst) + ')' if lst else '(1=0)'


def daftar(ns):
    return ','.join(str(x) for x in ns) or '-1'  # paket tanpa baris diubah: IN (-1) = tidak ada


KB = [kond_baru(baru[n]) for n in NO_BARU]
KUL = [kond_ubah(n, 'lama') for n in NO_UBAH]
KUB = [kond_ubah(n, 'baru') for n in NO_UBAH]
JB, JU = len(NO_BARU), len(NO_UBAH)
HARAP = '0|0|%d|0|%d|0' % (JU, len(DEP))
ULANG = '0|%d|0|%d|%d|0' % (JB, JU, len(DEP))

KEPALA = ("-- Paket ABT \"%s\" (21 Okt 2026): sisa paket x4 - kutipan petitum untuk pemicu tuntutan lain (layar), harta bersama dalam\n"
          "-- gugatan rekonvensi cerai talak. %d variabel baru, %d baris diubah. Blangko RTF yang ditambal: %d (lihat rtf-daftar-tambal.tsv).\n" % (N, JB, JU, NR))

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

ps = KEPALA + "-- PASANG: satu transaksi; nomor baru hanya ditulis bila belum ada; baris diubah hanya bila isinya masih persis isi LAMA (pasang ulang aman).\nSET NAMES latin1;\nSTART TRANSACTION;\n"
for n in NO_BARU:
    d = baru[n]
    ps += ("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
           "SELECT %d, %s, '%s', %s, %s, %s, NULL, %s, %s, NULL, 0, '%s', '%s' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var=%d);\n") % (
        n, hx(d['nama_b']), d['tipe'], "'%s'" % d['tabel'] if d['tabel'] else 'NULL', "'%s'" % d['kolom'] if d['kolom'] else 'NULL',
        d['urutan'] if d['urutan'] else 'NULL', hx(d['sql_b']) if d['sql_b'] else 'NULL', hx(d['def_b']) if d['def_b'] else 'NULL', V.MODIFIER, V.MODIFIED, n)
for n in NO_UBAH:
    u = ubah[n]
    ps += "UPDATE abt_variabel SET %s=%s, modified='%s' WHERE %s;\n" % (u['kolom'], hx(u['baru_b']), V.MODIFIED, kond_ubah(n, 'lama'))
ps += "COMMIT;\n"

pk = KEPALA + "-- PERIKSA: tiap variabel baru dan tiap baris yang diubah persis isi paket; baris terakhir \"SEMUA COCOK\".\n"
for n in NO_BARU:
    pk += "SELECT 'var %d baru' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (n, kond_baru(baru[n]))
for n in NO_UBAH:
    pk += "SELECT 'var %d diubah' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (n, kond_ubah(n, 'baru'))
pk += "SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d, 'SEMUA COCOK', 'TIDAK COCOK') AS hasil;\n" % (atau(KB + KUB), JB + JU)

pl = KEPALA + ("-- PULIH (deterministik): variabel baru dihapus HANYA bila isinya masih persis paket; baris yang diubah dikembalikan dari tabel sementara x8_lama\n"
               "-- (dibuat pulih-satker.sh dari cadangan/abt_variabel-sebelum.sql) HANYA bila isinya masih isi BARU paket dan baris cadangan masih isi LAMA yang diharapkan.\n"
               "-- Jalankan lewat pulih-satker.sh (bukan langsung): tabel x8_lama harus ada.\n")
pl += "START TRANSACTION;\n"
for n in NO_BARU:
    pl += "DELETE FROM abt_variabel WHERE %s;\n" % kond_baru(baru[n])
for n in NO_UBAH:
    pl += ("UPDATE abt_variabel a JOIN x8_lama l ON l.no_var=a.no_var SET a.nama=l.nama, a.data_type=l.data_type, a.data_tabel=l.data_tabel, a.data_kolom=l.data_kolom, "
           "a.urutan_data=l.urutan_data, a.referensi=l.referensi, a.sql_query=l.sql_query, a.default_data=l.default_data, a.multi_sidang=l.multi_sidang, a.locked=l.locked, "
           "a.modifier=l.modifier, a.modified=l.modified WHERE %s AND %s;\n") % (kond_ubah(n, 'baru', 'a'), kond_ubah(n, 'lama', 'l'))
pl += "COMMIT;\n"
pl += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)) = 0 AND (SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d, 'PULIH COCOK', "
       "CONCAT('PULIH TIDAK LENGKAP - nomor baru tersisa ', (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)), ', baris diubah yang sudah kembali ', "
       "(SELECT COUNT(*) FROM abt_variabel WHERE %s), ' dari %d (diubah orang sesudah dipasang? dibiarkan)')) AS hasil;\n") % (
    daftar(NO_BARU), atau(KUL), JU, daftar(NO_BARU), atau(KUL), JU)

os.makedirs(KELUAR, exist_ok=True)
for nama, isi in (('PRASYARAT', pra), ('PASANG', ps), ('PERIKSA', pk), ('PULIH', pl)):
    open(os.path.join(KELUAR, '%s-%s.sql' % (N, nama)), 'w', newline='\n', encoding='ascii').write(isi)
open(os.path.join(KELUAR, 'nomor-baru.txt'), 'w', newline='\n').write(daftar(NO_BARU) + '\n')
open(os.path.join(KELUAR, 'nomor-ubah.txt'), 'w', newline='\n').write(daftar(NO_UBAH) + '\n')
open(os.path.join(KELUAR, 'harap.txt'), 'w', newline='\n').write('%s\n%s\n%d\n%d\n' % (HARAP, ULANG, JU, NR))
with open(os.path.join(KELUAR, 'rtf-daftar-tambal.tsv'), 'w', newline='\n', encoding='latin1') as f:
    for d in daftar_rtf:
        f.write('%s\t%s\t%s\t%s\t%d\n' % (d['kode'], d['rel'], d['m0'], d['m1'], d['n']))
with open(os.path.join(KELUAR, 'rtf-tambal.tsv'), 'w', newline='\n', encoding='ascii') as f:
    f.write('\n'.join(tambal_tsv) + '\n')

with open(os.path.join(KELUAR, 'uji-kueri.tsv'), 'w', newline='\n', encoding='ascii') as f:
    f.write("# no_var<TAB>kueri (#perkara_id# diganti pasang-satker.sh; hanya SELECT; baca saja; rujukan #NNNN# lain diganti X)\n")
    for n in NO_BARU:
        f.write("%d\t%s\n" % (n, re.sub(r'#\d{1,5}#', 'X', re.sub(r'\s+', ' ', baru[n]['sql']))))
    for n in NO_UBAH:
        f.write("%d\t%s\n" % (n, re.sub(r'#\d{1,5}#', 'X', re.sub(r'\s+', ' ', ubah[n]['baru_b'].decode('latin1')))))

ring = dict(baru=[dict(no=n, nama=baru[n]['nama'], kelompok=baru[n]['kelompok'], butir=baru[n]['butir'], panjang=len(baru[n]['sql'])) for n in NO_BARU],
            ubah=[dict(no=n, kelompok=ubah[n]['kelompok'], butir=ubah[n]['butir'], lama_md5=ubah[n]['lama_md5'], baru_md5=ubah[n]['baru_md5'],
                       lama_panjang=ubah[n]['lama_len'], baru_panjang=ubah[n]['baru_len']) for n in NO_UBAH],
            rtf=daftar_rtf, dependensi=DEP, harap=HARAP, ulang=ULANG)
json.dump(ring, open(os.path.join(AKAR, '..', 'hasil', 'isi-paket.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('baru', JB, 'ubah', JU, 'dependensi', len(DEP), 'rtf', NR)
print('HARAP', HARAP)
print('ULANG', ULANG)

berkas = sorted(x for x in os.listdir(KELUAR) if os.path.isfile(os.path.join(KELUAR, x)) and x != 'MD5SUMS.txt')
with open(os.path.join(KELUAR, 'MD5SUMS.txt'), 'w', newline='\n') as f:
    for x in berkas:
        f.write('%s  %s\n' % (md5(open(os.path.join(KELUAR, x), 'rb').read()), x))
print('MD5SUMS:', len(berkas), 'berkas')
