# -*- coding: utf-8 -*-
"""Pembangun paket ABT x9-pihak-banyak-21okt (python 3, di laptop). Membaca salinan persis abt_variabel server (HEX, baca-saja)
dari VAR_SERVER_HEX, menulis paket-satker/*.sql. Isi lama baris yang diubah dijaga md5 dan dicadangkan di server oleh pasang-satker.sh.
pakai: VAR_SERVER_HEX=D:/Aplikasi/aleta/tmp/x1/w39/var_server_hex.tsv python bangun_paket.py"""
import hashlib
import json
import os
import re
import shutil
import sys

AKAR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AKAR)
import variabel_def as V  # noqa: E402

N = 'abt-x9-pihak-banyak-21okt'
KELUAR = os.path.join(AKAR, '..', 'paket-satker')
HEXFILE = os.environ.get('VAR_SERVER_HEX', r'D:\Aplikasi\aleta\tmp\x1\w39\var_server_hex.tsv')
FUNGSI = ['isian_rtf_romawi', 'isian_rtf_tanggal', 'isian_rtf_pihak_utama', 'isian_rtf_pihak_nama', 'isian_rtf_pihak_urutan', 'isian_rtf_pihak_tambahan']


def md5(b):
    return hashlib.md5(b).hexdigest()


def hx(b):
    return '0x' + b.hex()


server = {}
for baris in open(HEXFILE, encoding='latin1', newline='').read().split('\n')[1:]:
    if not baris.strip():
        continue
    k = baris.split('\t')
    no = int(k[0])
    server[no] = dict(nama=bytes.fromhex(k[1]), tipe=k[2], sql=None if k[7] == 'NULL' else bytes.fromhex(k[7]),
                      default=None if k[8] == 'NULL' else bytes.fromhex(k[8]))


# ---- pembantu pengurai kueri: tanda kurung seimbang yang menghormati literal '..' dan ".."
def cocok_kurung(s, i):
    """s[i] == '(' -> indeks ')' pasangannya"""
    assert s[i] == '('
    d = 0
    j = i
    q = None
    while j < len(s):
        c = s[j]
        if q:
            if c == '\\':
                j += 2
                continue
            if c == q:
                if j + 1 < len(s) and s[j + 1] == q:
                    j += 2
                    continue
                q = None
        elif c in '\'"':
            q = c
        elif c == '(':
            d += 1
        elif c == ')':
            d -= 1
            if d == 0:
                return j
        j += 1
    raise AssertionError('kurung tak seimbang')


def ekspresi_concat(s, mulai):
    """ambil ekspresi CONCAT(...) pertama pada/ sesudah indeks mulai"""
    i = s.index('CONCAT(', mulai)
    j = cocok_kurung(s, i + len('CONCAT'))
    return s[i:j + 1], i, j


def sisip_cabang(q, nl, cabang, ganti_else):
    """sisipkan cabang WHEN baru tepat sebelum ELSE terakhir (ELSE "" / ELSE ''), anchor harus tunggal"""
    m = list(re.finditer(r'\n[ \t]*ELSE[ \t]*(?:""|\'\')[ \t]*\r?\n[ \t]*END AS data', q))
    assert len(m) == 1, ('anchor ELSE tidak tunggal', len(m))
    awal = m[0].start() + 1
    return q[:awal] + cabang + q[awal:]


KUASA = "IF(EXISTS (SELECT 1 FROM perkara WHERE perkara_id = '#perkara_id#' AND \"#%s#\" != \"\"), \"<br>Dalam hal ini #%s# #%s#, %s\", \"\")"


def ubah_7047(b):
    q = b.decode('latin1')
    nl = '\r\n' if '\r\n' in q else '\n'
    i4 = q.index('WHEN p1.urutan = 4 THEN')
    e = q.index('ELSE', i4)  # ELSE pertama sesudah cabang 4 = ELSE kueri tanpa kuasa
    inner, _, _ = ekspresi_concat(q, e)
    cab = ('        WHEN p1.urutan >= 5 THEN' + nl + '            CONCAT(' + nl + '                ' + inner + ',' + nl + '                "<br>",' + nl +
           '                "#3507#",' + nl + '                ' + (KUASA % ('8540', '3508', '8540', 'selanjutnya disebut sebagai <strong>#0046#</strong>;')) + nl + '            )' + nl)
    return sisip_cabang(q, nl, cab, None).encode('latin1')


def ubah_7048(b):
    q = b.decode('latin1')
    nl = '\r\n' if '\r\n' in q else '\n'
    m = list(re.finditer(r'WHEN COALESCE\(p1\.urutan, 0\) = 5 THEN', q))
    assert len(m) == 1, len(m)
    inner, _, _ = ekspresi_concat(q, m[0].end())
    cab = ('        WHEN COALESCE(p1.urutan, 0) >= 6 THEN' + nl + '            CONCAT(' + nl + '                ' + inner + ',' + nl + '                "<br>",' + nl +
           '                "#3509#",' + nl + '                ' + (KUASA % ('8541', '3510', '8541', 'sebagai <strong>#0047#</strong>;')) + nl + '            )' + nl)
    return sisip_cabang(q, nl, cab, None).encode('latin1')


def ubah_7097(b):
    q = b.decode('latin1')
    nl = '\r\n' if '\r\n' in q else '\n'
    i5 = q.index('WHEN p1.urutan = 5 THEN')
    e = q.index('ELSE', i5)
    inner, _, _ = ekspresi_concat(q, e)
    cab = ('        WHEN p1.urutan >= 6 THEN' + nl + '            CONCAT(' + nl + '                ' + inner + ',' + nl + '                "<br>",' + nl + '                "#3511#"' + nl + '            )' + nl)
    return sisip_cabang(q, nl, cab, None).encode('latin1')


def ubah_7098(b):
    q = b.decode('latin1')
    nl = '\r\n' if '\r\n' in q else '\n'
    m = list(re.finditer(r'WHEN p1\.urutan = 5 THEN', q))
    assert len(m) == 1, len(m)
    inner, _, _ = ekspresi_concat(q, m[0].end())
    cab = ('        WHEN p1.urutan >= 6 THEN' + nl + '            CONCAT(' + nl + '                ' + inner + ',' + nl + '                "<br>",' + nl + '                "#3512#"' + nl + '            )' + nl)
    return sisip_cabang(q, nl, cab, None).encode('latin1')


UBAH_FN = {
    7047: ('sql_query', ubah_7047, '7047: cabang urutan >= 5 (dulu ELSE kosong) memakai #3507# dan #3508#'),
    7048: ('sql_query', ubah_7048, '7048: cabang urutan >= 6 memakai #3509# dan #3510#'),
    7097: ('sql_query', ubah_7097, '7097: cabang urutan >= 6 memakai #3511#'),
    7098: ('sql_query', ubah_7098, '7098: cabang urutan >= 6 memakai #3512#'),
    8710: ('sql_query', lambda b: b'SELECT aps_badilag.isian_rtf_pihak_tambahan(#perkara_id#, 4) AS data', '8710: Turut Tergugat semua urutan lewat fungsi (dulu maksimum 10)'),
    7054: ('sql_query', lambda b: b'SELECT aps_badilag.isian_rtf_pihak_tambahan(#perkara_id#, 3) AS data', '7054: pihak intervensi semua urutan lewat fungsi (dulu maksimum 5)'),
}

baru = {}
for d in V.BARU:
    assert d['no'] not in server, 'nomor %d sudah ada di server' % d['no']
    assert d['no'] not in baru
    d = dict(d)
    d['nama_b'] = d['nama'].encode('ascii')
    assert len(d['nama_b']) <= 200, ('nama > 200 huruf', d['no'])
    d['sql_b'] = d['sql'].encode('ascii')
    # nama variabel ikut disulih ABT (variabel($nama)); rujukan ke variabel pemanggil membuat rekursi tak berujung
    assert set(re.findall(r'#(\d+)#', d['nama'])) <= {'0046', '0047'}, ('nama memuat rujukan variabel lain', d['no'])
    d['def_b'] = None
    baru[d['no']] = d
NO_BARU = sorted(baru)

ubah = {}
for no in sorted(UBAH_FN):
    kol, fn, ket = UBAH_FN[no]
    s = server[no]
    lama = s['sql']
    nb = fn(lama)
    assert nb != lama
    ubah[no] = dict(kolom=kol, lama_md5=md5(lama), baru_b=nb, baru_md5=md5(nb), nama_md5=md5(s['nama']), tipe=s['tipe'], ket=ket, lama_len=len(lama), baru_len=len(nb))
NO_UBAH = sorted(ubah)

# jaminan: kueri 7047/7048/7097/7098 baru = lama + SATU cabang yang disisipkan (awalan dan akhiran lama utuh)
for no in (7047, 7048, 7097, 7098):
    lama = server[no]['sql']
    nb = ubah[no]['baru_b']
    t = nb.decode('latin1')
    a = lama.decode('latin1')
    # buang cabang sisipan -> harus sama dengan lama
    i = 0
    while i < len(a) and a[i] == t[i]:
        i += 1
    j = 0
    while j < len(a) and a[-1 - j] == t[-1 - j]:
        j += 1
    assert i + j >= len(a), ('perbedaan bukan satu sisipan', no, i, j, len(a))

ref = set()
for d in baru.values():
    ref |= {int(x) for x in re.findall(rb'#(\d{1,5})#', d['sql_b'])}
for no, u in ubah.items():
    ref |= {int(x) for x in re.findall(rb'#(\d{1,5})#', u['baru_b'])}
DEP = sorted(x for x in ref if x not in baru and x != 0)
hilang = [x for x in DEP if x not in server]
assert not hilang, hilang


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
JB, JU, JF = len(NO_BARU), len(NO_UBAH), len(FUNGSI)
FN_IN = ','.join("'%s'" % f for f in FUNGSI)
HARAP = '0|0|%d|0|0|%d|0' % (JU, len(DEP))
ULANG = '0|%d|0|%d|%d|%d|0' % (JB, JU, JF, len(DEP))

KEPALA = ("-- Paket ABT \"%s\" (21 Okt 2026): identitas pihak banyak (Pemohon/Penggugat, Termohon/Tergugat, Turut Tergugat, pihak intervensi) tercetak lengkap sampai pihak terakhir.\n"
          "-- %d variabel baru (3507-3516), %d baris diubah (%s), %d fungsi tersimpan baru (%s).\n"
          % (N, JB, JU, ', '.join(str(n) for n in NO_UBAH), JF, ', '.join(FUNGSI)))

pra = KEPALA + ("-- PRASYARAT (baca saja) \"A|B|C|D|E|F|G\": A = nomor baru (%d) yang berisi LAIN dari paket (harus 0) | B = nomor baru yang sudah persis paket (0 pertama, %d ulang) | "
                "C = baris yang akan diubah (%d) yang masih berisi isi LAMA (%d pertama, 0 ulang) | D = yang sudah isi BARU (0 pertama, %d ulang) | "
                "E = fungsi baru (%d) yang sudah ada di basis ini (0 pertama, %d ulang) | F = variabel lama yang dirujuk dan harus ada (%d) | G = baris diubah yang isinya bukan lama bukan baru (harus 0).\n"
                "-- Benar: \"%s\" (pertama) atau \"%s\" (pasang ulang).\n") % (JB, JB, JU, JU, JU, JF, JF, len(DEP), HARAP, ULANG)
pra += ("SELECT CONCAT((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND NOT %s), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', "
        "(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name IN (%s)), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND NOT (%s OR %s))) AS prasyarat;\n") % (
    daftar(NO_BARU), atau(KB), atau(KB), atau(KUL), atau(KUB), FN_IN, daftar(DEP), daftar(NO_UBAH), atau(KUL), atau(KUB))

ps = KEPALA + ("-- PASANG variabel (fungsi dipasang lebih dulu oleh pasang-satker.sh dari -FUNGSI.sql): satu transaksi; nomor baru hanya ditulis bila belum ada; "
               "baris diubah hanya bila isinya masih persis isi LAMA (pasang ulang aman).\nSET NAMES latin1;\nSTART TRANSACTION;\n")
for n in NO_BARU:
    d = baru[n]
    ps += ("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
           "SELECT %d, %s, 'data_sql', NULL, NULL, NULL, NULL, %s, NULL, NULL, 0, '%s', '%s' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var=%d);\n") % (
        n, hx(d['nama_b']), hx(d['sql_b']), V.MODIFIER, V.MODIFIED, n)
for n in NO_UBAH:
    u = ubah[n]
    ps += "UPDATE abt_variabel SET %s=%s, modified='%s' WHERE %s;\n" % (u['kolom'], hx(u['baru_b']), V.MODIFIED, kond_ubah(n, 'lama'))
ps += "COMMIT;\n"

CEK_FN = (
    "(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name IN (%s) AND routine_comment LIKE 'X9:%%') = %d" % (FN_IN, JF))
CEK_ROMAWI = ("isian_rtf_romawi(4) = 'IV' AND isian_rtf_romawi(9) = 'IX' AND isian_rtf_romawi(14) = 'XIV' AND isian_rtf_romawi(29) = 'XXIX' AND isian_rtf_romawi(49) = 'XLIX' "
              "AND isian_rtf_romawi(32) = 'XXXII' AND isian_rtf_romawi(1994) = 'MCMXCIV' AND isian_rtf_romawi(0) = '' AND isian_rtf_romawi(4000) = ''")
CEK_TGL = ("isian_rtf_tanggal('1970-10-01') = '01 Oktober 1970' AND isian_rtf_tanggal('2026-11-25') = '25 November 2026' AND isian_rtf_tanggal(NULL) = '' "
           "AND isian_rtf_tanggal('1899-12-31') = ''")
CEK_KOSONG = ("isian_rtf_pihak_utama(0, 1, 1, 'a', 'b') = '' AND isian_rtf_pihak_utama(0, 2, 1, 'a', 'b') = '' AND isian_rtf_pihak_utama(0, 3, 1, 'a', 'b') = '' "
              "AND isian_rtf_pihak_nama(0, 1, 1, 'a') = '' AND isian_rtf_pihak_nama(0, 2, 1, 'a') = '' AND isian_rtf_pihak_urutan(0, 1, 'a') = '' "
              "AND isian_rtf_pihak_urutan(0, 2, 'a') = '' AND isian_rtf_pihak_tambahan(0, 4) = '' AND isian_rtf_pihak_tambahan(0, 3) = '' AND isian_rtf_pihak_tambahan(0, 5) = ''")
pk = KEPALA + "-- PERIKSA: tiap variabel baru dan baris diubah persis isi paket; fungsi ada dan benar; baris terakhir \"SEMUA COCOK\".\n"
for n in NO_BARU:
    pk += "SELECT 'var %d baru' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (n, kond_baru(baru[n]))
for n in NO_UBAH:
    pk += "SELECT 'var %d diubah' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (n, kond_ubah(n, 'baru'))
pk += "SELECT 'fungsi ada' AS butir, IF(%s, 1, 0) AS cocok;\n" % CEK_FN
pk += "SELECT 'fungsi romawi' AS butir, IF(%s, 1, 0) AS cocok;\n" % CEK_ROMAWI
pk += "SELECT 'fungsi tanggal' AS butir, IF(%s, 1, 0) AS cocok;\n" % CEK_TGL
pk += "SELECT 'fungsi perkara kosong' AS butir, IF(%s, 1, 0) AS cocok;\n" % CEK_KOSONG
pk += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d AND %s AND %s AND %s AND %s, 'SEMUA COCOK', 'TIDAK COCOK') AS hasil;\n") % (
    atau(KB + KUB), JB + JU, CEK_FN, CEK_ROMAWI, CEK_TGL, CEK_KOSONG)

pl = KEPALA + ("-- PULIH (deterministik): variabel baru dihapus HANYA bila isinya masih persis paket; baris yang diubah dikembalikan dari tabel sementara x9_lama\n"
               "-- (dibuat pulih-satker.sh dari cadangan/abt_variabel-sebelum.sql) HANYA bila isinya masih isi BARU paket dan baris cadangan masih isi LAMA yang diharapkan.\n"
               "-- Fungsi dihapus oleh pulih-satker.sh SESUDAH ini, hanya yang berkomentar \"X9:\". Jalankan lewat pulih-satker.sh (bukan langsung): tabel x9_lama harus ada.\n")
pl += "START TRANSACTION;\n"
for n in NO_BARU:
    pl += "DELETE FROM abt_variabel WHERE %s;\n" % kond_baru(baru[n])
for n in NO_UBAH:
    pl += ("UPDATE abt_variabel a JOIN x9_lama l ON l.no_var=a.no_var SET a.nama=l.nama, a.data_type=l.data_type, a.data_tabel=l.data_tabel, a.data_kolom=l.data_kolom, "
           "a.urutan_data=l.urutan_data, a.referensi=l.referensi, a.sql_query=l.sql_query, a.default_data=l.default_data, a.multi_sidang=l.multi_sidang, a.locked=l.locked, "
           "a.modifier=l.modifier, a.modified=l.modified WHERE %s AND %s;\n") % (kond_ubah(n, 'baru', 'a'), kond_ubah(n, 'lama', 'l'))
pl += "COMMIT;\n"
pl += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)) = 0 AND (SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d, 'VARIABEL KEMBALI', "
       "CONCAT('PULIH TIDAK LENGKAP - nomor baru tersisa ', (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)), ', baris diubah yang sudah kembali ', "
       "(SELECT COUNT(*) FROM abt_variabel WHERE %s), ' dari %d (diubah orang sesudah dipasang? dibiarkan)')) AS hasil;\n") % (
    daftar(NO_BARU), atau(KUL), JU, daftar(NO_BARU), atau(KUL), JU)

for nama, isi in (('PRASYARAT', pra), ('PASANG', ps), ('PERIKSA', pk), ('PULIH', pl)):
    open(os.path.join(KELUAR, '%s-%s.sql' % (N, nama)), 'w', newline='\n', encoding='ascii').write(isi)
shutil.copyfile(os.path.join(AKAR, 'templat-fungsi.sql'), os.path.join(KELUAR, '%s-FUNGSI.sql' % N))
open(os.path.join(KELUAR, 'nomor-baru.txt'), 'w', newline='\n').write(daftar(NO_BARU) + '\n')
open(os.path.join(KELUAR, 'nomor-ubah.txt'), 'w', newline='\n').write(daftar(NO_UBAH) + '\n')
open(os.path.join(KELUAR, 'nama-fungsi.txt'), 'w', newline='\n').write(' '.join(FUNGSI) + '\n')

# kueri uji: variabel baru dan dua variabel yang kini memanggil fungsi, dengan penyulih literal; diukur panjang dan jumlah pihak (tanpa mencetak nama)
SUB = {'#0046#': 'Pemohon', '#0047#': 'Tergugat', '#0124#': 'tempat kediaman di '}
with open(os.path.join(KELUAR, 'uji-kueri.tsv'), 'w', newline='\n', encoding='ascii') as f:
    f.write("# no_var<TAB>kueri (#perkara_id# diganti pasang-satker.sh; hanya SELECT; baca saja)\n")
    for n in NO_BARU:
        s = baru[n]['sql']
        for a, b in SUB.items():
            s = s.replace(a, b)
        f.write("%d\t%s\n" % (n, s))
    for n in (8710, 7054):
        f.write("%d\t%s\n" % (n, ubah[n]['baru_b'].decode('ascii')))

ring = dict(baru=[dict(no=n, nama=baru[n]['nama'], sql=baru[n]['sql'], butir=baru[n]['butir']) for n in NO_BARU],
            ubah=[dict(no=n, kolom=ubah[n]['kolom'], ket=ubah[n]['ket'], lama_md5=ubah[n]['lama_md5'], baru_md5=ubah[n]['baru_md5'],
                       lama_panjang=ubah[n]['lama_len'], baru_panjang=ubah[n]['baru_len']) for n in NO_UBAH],
            fungsi=FUNGSI, dependensi=DEP, harap=HARAP, ulang=ULANG)
json.dump(ring, open(os.path.join(AKAR, '..', 'hasil', 'isi-paket.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

berkas = sorted(x for x in os.listdir(KELUAR) if os.path.isfile(os.path.join(KELUAR, x)) and x != 'MD5SUMS.txt')
with open(os.path.join(KELUAR, 'MD5SUMS.txt'), 'w', newline='\n') as f:
    for x in berkas:
        f.write('%s  %s\n' % (md5(open(os.path.join(KELUAR, x), 'rb').read()), x))
print('baru', JB, 'ubah', JU, 'fungsi', JF, 'dependensi', len(DEP))
print('HARAP', HARAP)
print('ULANG', ULANG)
print('MD5SUMS:', len(berkas), 'berkas')
for n in NO_UBAH:
    print(n, ubah[n]['lama_len'], '->', ubah[n]['baru_len'])
