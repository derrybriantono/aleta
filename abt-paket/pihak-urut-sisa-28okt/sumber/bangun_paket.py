# -*- coding: utf-8 -*-
"""Pembangun paket ABT pihak-urut-sisa-28okt (python 3, di laptop). Membaca abt_variabel keadaan server SESUDAH paket 27 Okt (VAR_DASAR_HEX; semua baris selain 14 baris paket 27 Okt persis sama dengan bacaan server 27 Okt di VAR_SERVER_HEX, diperiksa di bawah),
mengubah variabel milik Derry DAN (izin tertulis pengguna 28 Okt) 43 dari 47 variabel bawaan ABT yang memakai `urutan = N` tetap pada perkara_pihak1/2 menjadi PERINGKAT ke-N (fungsi isian_rtf_pihak_peringkat);
7078 ditulis ulang (Pemohon/Penggugat lebih dari satu -> "I,"). Lalu menulis paket-satker/*.
Isi lama baris yang diubah dijaga md5 dan dicadangkan di server oleh pasang-satker.sh. Prasyarat: paket pihak-urut-ecourt-27okt sudah terpasang (md5 dibaca dari hasil/isi-paket.json-nya).
pakai: python bangun_paket.py   (jalur bawaan: D:/Aplikasi/aleta/tmp/w105/var_ps0_hex.tsv dan D:/Aplikasi/aleta/tmp/w91/var_server_hex.tsv)"""
import hashlib
import json
import os
import re

AKAR = os.path.dirname(os.path.abspath(__file__))
N = 'abt-pihak-urut-sisa-28okt'
KELUAR = os.path.join(AKAR, '..', 'paket-satker')
PAKET = os.path.join(AKAR, '..', '..')
HEXFILE = os.environ.get('VAR_DASAR_HEX', r'D:\Aplikasi\aleta\tmp\w105\var_ps0_hex.tsv')  # keadaan server SESUDAH paket 27 Okt (basis ABT laptop aps_badilag_ps0)
SERVER_HEX = os.environ.get('VAR_SERVER_HEX', r'D:\Aplikasi\aleta\tmp\w91\var_server_hex.tsv')  # bacaan server 27 Okt (baca saja) SEBELUM paket 27 Okt
MODIFIER = 'admin'
MODIFIED = '2026-10-28 00:00:00'
FUNGSI = 'isian_rtf_pihak_peringkat'
SIPP = 'aps_badilag.' + FUNGSI


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
                      modif=k[11], modified=k[12])

# ---- prasyarat: isi paket pihak-urut-ecourt-27okt (md5 dari hasil/isi-paket.json-nya)
P27 = json.load(open(os.path.join(PAKET, 'pihak-urut-ecourt-27okt', 'hasil', 'isi-paket.json'), encoding='utf-8'))
SIAP27_VAR = {u['no']: u['baru_md5'] for u in P27['ubah']}
for b in P27['baru']:
    SIAP27_VAR[b['no']] = md5(b['sql'].encode('latin1'))
SIAP27_FN = dict(P27['fungsi_baru'])
SIAP27_FN.update({f: v['baru_md5'] for f, v in P27['fungsi_x9'].items()})
assert len(SIAP27_VAR) == 14 and len(SIAP27_FN) == 9

# dasar = bacaan server 27 Okt di luar 14 baris paket 27 Okt (variabel yang dibaca di sini tidak diubah oleh paket 27 Okt)
bacaan = {}
for baris in open(SERVER_HEX, encoding='latin1', newline='').read().replace(chr(13), '').split(chr(10))[1:]:
    if baris.strip():
        bacaan[int(baris.split(chr(9))[0])] = baris
dasar = {}
for baris in open(HEXFILE, encoding='latin1', newline='').read().replace(chr(13), '').split(chr(10))[1:]:
    if baris.strip():
        dasar[int(baris.split(chr(9))[0])] = baris
beda27 = sorted(no for no in dasar if bacaan.get(no) != dasar[no])
assert beda27 == sorted(SIAP27_VAR), ('dasar berbeda dari bacaan server di luar paket 27 Okt', beda27)

# ---------------------------------------------------------------------------------------------------------------------------------------------
# Pemilik: variabel buatan/ubahan Derry = modifier admin, diubah 2025-2026, nomor >= 2000 (bawaan ABT: modifier kosong atau tanggal 2019, nomor rendah).
# 14 variabel paket 27 Okt (termasuk 7036/7037/7047/7048/7097/7098 yang cabang lamanya hanya berlaku untuk urutan rapat) TIDAK disentuh lagi.
DILEWATI_27 = set(SIAP27_VAR)
# Tambahan atas izin tertulis pengguna (28 Okt 2026), pengecualian aturan "hanya variabel milik Derry": 47 variabel data_sql bawaan ABT / bernomor rendah yang memakai
# `urutan = N` pada pihak1/2 (daftar di PASANG.md) ikut diubah dengan mekanisme yang sama. Yang memakai urutan sebagai angka romawi (ELT: 5890-5893) TIDAK diubah.
TAMBAHAN = set([10, 11, 20, 21, 24, 27, 45, 99, 100, 103, 104, 118, 120] + list(range(335, 338)) + list(range(341, 344)) + list(range(345, 348)) + list(range(1033, 1036)) +
               [1076, 1077, 1173, 1174, 1176, 1517, 1518, 2173, 5019, 5027, 5028, 5842] + list(range(5890, 5894)) + [7000, 7003, 7004, 8175, 8179, 8180])
assert len(TAMBAHAN) == 47, len(TAMBAHAN)
ROMAWI = {5890, 5891, 5892, 5893}  # ELT(a.urutan, 'I', 'II', ...) + BETWEEN pada urutan: nilai urutan dipakai sebagai angka romawi, bukan pemilihan pihak ke-N: tidak diubah
TB = re.compile(r'\b(?:FROM|JOIN)\s+(perkara_pihak[1-4])(?:\s+(?:AS\s+)?([A-Za-z_][A-Za-z_0-9]*))?', re.I)
KATA = {'WHERE', 'ON', 'JOIN', 'LEFT', 'INNER', 'GROUP', 'ORDER', 'LIMIT', 'USING', 'SET', 'AND', 'OR', 'UNION', 'HAVING', 'RIGHT', 'CROSS'}
# `urutan` (bertitik alias atau polos) yang dibandingkan dengan angka tetap / himpunan / z.u
CMP = re.compile(r'(?:\b([A-Za-z_][A-Za-z_0-9]*)\.)?\burutan\b(?![_A-Za-z0-9])(?=\s*(?:=|<=|>=|<>|!=|<|>|IN\b|BETWEEN\b))', re.I)


def milik_derry(no, v):
    return v['modif'] == 'admin' and v['modified'][:4] in ('2025', '2026') and no >= 2000 and v['tipe'] == 'data_sql' and v['sql'] is not None


def deklarasi(q):
    d = []
    for m in TB.finditer(q):
        a = m.group(2)
        if a and a.upper() in KATA:
            a = None
        d.append((m.start(), int(m.group(1)[-1]), a, m.group(1)))
    return d


def rujuk(tabel, a, nama_tabel):
    return '%s(%d, %s.id)' % (SIPP, tabel, a if a else nama_tabel)


def ganti_perbandingan(q):
    """Ganti tiap `X.urutan <op> ...` (X = alias tabel perkara_pihak1/2) menjadi peringkat; kembalikan (kueri baru, jumlah)."""
    dek = deklarasi(q)
    hasil, pos, n = [], 0, 0
    for m in CMP.finditer(q):
        a = m.group(1)
        cand = [x for x in dek if x[0] < m.start() and ((a is not None and x[2] == a) or (a is None))]
        if not cand:
            # pemakaian di daftar SELECT (agregat) yang tabelnya baru dideklarasikan sesudahnya: deklarasi terdekat di belakang
            cand = [x for x in dek if x[0] > m.start() and ((a is not None and x[2] == a) or (a is None))]
            cand = cand[:1]
        if not cand:
            continue
        x = cand[-1]
        if x[1] not in (1, 2):
            continue
        if a is None and len({y[3] for y in dek}) != 1:
            raise AssertionError('urutan polos pada kueri dengan beberapa tabel pihak')
        hasil.append(q[pos:m.start()])
        hasil.append(rujuk(x[1], x[2], x[3]))
        pos = m.end()
        n += 1
    hasil.append(q[pos:])
    return ''.join(hasil), n


def ganti_min(q):
    """9404/9405: `(SELECT MIN(a.urutan) FROM perkara_pihakN a ...` -> peringkat terkecil (nilai dipakai sebagai nomor sebutan)."""
    return re.subn(r'\(SELECT MIN\(a\.urutan\) FROM perkara_pihak([12]) a\b', lambda m: '(SELECT MIN(%s) FROM perkara_pihak%s a' % (rujuk(int(m.group(1)), 'a', ''), m.group(1)), q)


# 9280/9281 menelusuri SEMUA perkara cerai lain; satu panggilan fungsi per baris menggandakan waktu (5 dtk -> 14 dtk di laptop). Untuk dua variabel ini
# "peringkat 1" ditulis sebagai predikat murni SQL (tidak ada pihak lain yang lebih awal menurut urutan, id) - waktu kembali seperti semula.
INLINE_PERTAMA = {9280, 9281}
POLA_PERTAMA = re.compile(r'aps_badilag\.' + FUNGSI + r'\((\d), (\w+)\.id\) = 1')


def pertama_inline(q):
    def ganti(m):
        t, a = m.group(1), m.group(2)
        z = 'z' + a
        return ('NOT EXISTS (SELECT 1 FROM perkara_pihak%s %s WHERE %s.perkara_id = %s.perkara_id AND (IFNULL(%s.urutan, 0) < IFNULL(%s.urutan, 0) '
                'OR (IFNULL(%s.urutan, 0) = IFNULL(%s.urutan, 0) AND %s.id < %s.id)))') % (t, z, z, a, z, a, z, a, z, a)
    return POLA_PERTAMA.subn(ganti, q)


def ganti_view_pihak(q):
    """0118/0120: cabang `join v_pihak_perkara b ... b.urutan=1 and b.pihak_ke=K` -> tabel perkara_pihakK langsung (pihak_ke=K di tampilan itu persis tabel perkara_pihakK; tampilan UNION lima tabel
    lambat dan tidak stabil). Hanya kolom pihak_id, perkara_id, urutan yang dipakai."""
    m = re.search(r'b\.urutan\s*=\s*1\s+and\s+b\.pihak_ke\s*=\s*([12])', q, re.I)
    assert m, 'pola v_pihak_perkara tidak ditemukan'
    k = m.group(1)
    q2, n1 = re.subn(r'join\s+v_pihak_perkara\s+b\b', 'join perkara_pihak%s b' % k, q, flags=re.I)
    q2, n2 = re.subn(r'b\.urutan\s*=\s*1\s+and\s+b\.pihak_ke\s*=\s*%s' % k, 'b.urutan=1', q2, flags=re.I)
    assert n1 == 1 and n2 == 1 and 'v_pihak_perkara' not in q2
    return q2


def ganti_7078(q):
    """7078 (keputusan pengguna 28 Okt): e-Court tetap ''; Pemohon/Penggugat (perkara_pihak1) lebih dari satu -> "#0046# I,", hanya satu -> "#0046#,". SATU baris (agregat COUNT, bukan
    JOIN berbaris banyak); tanpa baris pihak1 tetap tanpa hasil seperti kueri lama (JOIN)."""
    a = 'WHEN alur_perkara_id = 16 AND urutan = 2 THEN'
    b = 'JOIN perkara_pihak1 ON perkara.perkara_id = perkara_pihak1.perkara_id'
    c = 'WHERE perkara.perkara_id = #perkara_id#'
    assert q.count(a) == 1 and q.count(b) == 1 and q.endswith(c)
    nl = '\r\n' if '\r\n' in q else '\n'
    q2 = q.replace(a, 'WHEN (SELECT COUNT(*) FROM perkara_pihak1 WHERE perkara_id = #perkara_id#) > 1 THEN')
    q2 = q2.replace(b + nl, '')
    q2 += nl + '  AND EXISTS (SELECT 1 FROM perkara_pihak1 WHERE perkara_id = #perkara_id#)'
    return q2


ubah = {}
for no in sorted(server):
    v = server[no]
    if no in DILEWATI_27 or no in ROMAWI or not (milik_derry(no, v) or no in TAMBAHAN):
        continue
    if no in TAMBAHAN and not (v['tipe'] == 'data_sql' and v['sql'] is not None):
        raise AssertionError(('tambahan bukan data_sql', no))
    q = v['sql'].decode('latin1')
    if 'urutan' not in q.lower():
        continue
    if no == 7078:
        q2 = ganti_7078(q)
        nb = q2.encode('latin1')
        ubah[no] = dict(kolom='sql_query', lama_md5=md5(v['sql']), baru_b=nb, baru_md5=md5(nb), nama_md5=md5(v['nama']), tipe=v['tipe'],
                        lama_len=len(v['sql']), baru_len=len(nb), ganti=0, inline=0, khusus='kedudukan-relaas')  # tanpa fungsi peringkat: kueri ditulis ulang
        continue
    if 'v_pihak_perkara' in q:
        assert no in (118, 120), no
        q = ganti_view_pihak(q)
    q2, n_min = ganti_min(q)
    q2, n = ganti_perbandingan(q2)
    if n + n_min == 0:
        continue
    # tidak boleh tersisa perbandingan urutan tetap pada perkara_pihak1/2 dan tanda kurung ganda harus utuh
    sisa = ganti_perbandingan(q2)[1]
    assert sisa == 0, (no, 'sisa perbandingan', sisa)
    n_inline = 0
    if no in INLINE_PERTAMA:
        q2, n_inline = pertama_inline(q2)
        assert n_inline == n, (no, n_inline, n)
    assert q2.count(FUNGSI) == n + n_min - n_inline, (no, q2.count(FUNGSI), n, n_min, n_inline)
    nb = q2.encode('latin1')
    ubah[no] = dict(kolom='sql_query', lama_md5=md5(v['sql']), baru_b=nb, baru_md5=md5(nb), nama_md5=md5(v['nama']), tipe=v['tipe'],
                    lama_len=len(v['sql']), baru_len=len(nb), ganti=n + n_min, inline=n_inline)
NO_UBAH = sorted(ubah)
JU = len(NO_UBAH)
assert JU > 50, JU

ref = set()
for u in ubah.values():
    ref |= {int(x) for x in re.findall(rb'#(\d{1,5})#', u['baru_b'])}
DEP = sorted(x for x in ref if x != 0)
hilang = [x for x in DEP if x not in server]
assert not hilang, hilang


def kond_ubah(no, estado, a=''):
    p = a + '.' if a else ''
    u = ubah[no]
    m = u['lama_md5'] if estado == 'lama' else u['baru_md5']
    return "(%sno_var=%d AND MD5(%snama)='%s' AND %sdata_type='%s' AND MD5(%s%s)='%s')" % (p, no, p, u['nama_md5'], p, u['tipe'], p, u['kolom'], m)


def atau(lst):
    return '(' + ' OR '.join(lst) + ')' if lst else '(1=0)'


def daftar(ns):
    return ','.join(str(x) for x in ns)


# ---- badan fungsi baru -> md5 routine_definition (MariaDB menyimpan BEGIN ... END persis seperti ditulis)
fungsi_baru = open(os.path.join(AKAR, 'templat-fungsi.sql'), 'rb').read().decode('latin1').replace('\r\n', '\n')
m = re.search(r'CREATE FUNCTION %s\(.*?\nBEGIN\n(.*?)\nEND\$\$' % FUNGSI, fungsi_baru, re.S)
assert m
FN_BADAN = 'BEGIN\n' + m.group(1) + '\nEND'
FN_MD5 = md5(FN_BADAN.encode('latin1'))

KUL = [kond_ubah(n, 'lama') for n in NO_UBAH]
KUB = [kond_ubah(n, 'baru') for n in NO_UBAH]
SIAP_VAR = ' OR '.join("(no_var=%d AND MD5(sql_query)='%s')" % (n, h) for n, h in sorted(SIAP27_VAR.items()))
SIAP_FN = ' OR '.join("(routine_name='%s' AND MD5(routine_definition)='%s')" % (f, h) for f, h in sorted(SIAP27_FN.items()))
FN_PS = "(routine_name='%s' AND MD5(routine_definition)='%s')" % (FUNGSI, FN_MD5)

KEPALA = ("-- Paket ABT \"%s\" (28 Okt 2026): sisa variabel Derry dan bawaan ABT (izin pengguna) yang memilih pihak dengan `urutan = N` tetap menjadi PERINGKAT ke-N (perkara e-Court dengan urutan bersambung).\n"
          "-- %d baris variabel diubah (%s), 1 fungsi tersimpan baru (%s). Prasyarat: paket abt-pihak-urut-ecourt-27okt sudah terpasang.\n") % (N, JU, ', '.join(str(n) for n in NO_UBAH), FUNGSI)

HARAP = '9|14|%d|0|0|%d|0' % (JU, len(DEP))
ULANG = '9|14|0|%d|1|%d|0' % (JU, len(DEP))

pra = KEPALA + ("-- PRASYARAT (baca saja) \"P|Q|C|D|E|F|G\": P = fungsi paket 27 Okt (9) yang isinya persis paket itu (harus 9) | Q = variabel paket 27 Okt (14) yang isinya persis paket itu (harus 14) | "
                "C = baris yang akan diubah (%d) yang masih isi LAMA (%d pertama, 0 ulang) | D = yang sudah isi BARU (0 pertama, %d ulang) | "
                "E = fungsi baru (1) yang sudah ada (0 pertama, 1 ulang) | F = variabel lama yang dirujuk dan harus ada (%d) | G = baris diubah yang bukan lama bukan baru (harus 0).\n"
                "-- Benar: \"%s\" (pertama) atau \"%s\" (pasang ulang).\n") % (JU, JU, JU, len(DEP), HARAP, ULANG)
pra += ("SELECT CONCAT((SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND (%s)), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', "
        "(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='%s'), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND NOT (%s OR %s))) AS prasyarat;\n") % (
    SIAP_FN, atau([SIAP_VAR]), atau(KUL), atau(KUB), FUNGSI, daftar(DEP), daftar(NO_UBAH), atau(KUL), atau(KUB))

ps = KEPALA + ("-- PASANG variabel (fungsi dipasang lebih dulu oleh pasang-satker.sh dari -FUNGSI.sql): satu transaksi; baris diubah hanya bila isinya masih persis isi LAMA "
               "(pasang ulang aman).\nSET NAMES latin1;\nSTART TRANSACTION;\n")
for n in NO_UBAH:
    u = ubah[n]
    ps += "UPDATE abt_variabel SET %s=%s, modified='%s' WHERE %s;\n" % (u['kolom'], hx(u['baru_b']), MODIFIED, kond_ubah(n, 'lama'))
ps += "COMMIT;\n"

CEK_FN = "(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND %s) = 1" % FN_PS
CEK_UJI = ("isian_rtf_pihak_peringkat(1, 0) IS NULL AND isian_rtf_pihak_peringkat(2, 0) IS NULL AND isian_rtf_pihak_peringkat(9, 1) IS NULL "
           "AND isian_rtf_pihak_peringkat(NULL, 1) IS NULL AND isian_rtf_pihak_peringkat(1, NULL) IS NULL")
pk = KEPALA + "-- PERIKSA: tiap baris diubah persis isi paket; paket 27 Okt masih utuh; fungsi ada dan benar; baris terakhir \"SEMUA COCOK\".\n"
for n in NO_UBAH:
    pk += "SELECT 'var %d diubah' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (n, kond_ubah(n, 'baru'))
pk += "SELECT 'fungsi baru ada' AS butir, IF(%s, 1, 0) AS cocok;\n" % CEK_FN
pk += "SELECT 'fungsi jalan' AS butir, IF(%s, 1, 0) AS cocok;\n" % CEK_UJI
pk += ("SELECT 'paket 27 Okt utuh' AS butir, IF((SELECT COUNT(*) FROM abt_variabel WHERE %s) = 14 AND (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND (%s)) = 9, 1, 0) AS cocok;\n") % (
    SIAP_VAR, SIAP_FN)
pk += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d AND %s AND %s AND (SELECT COUNT(*) FROM abt_variabel WHERE %s) = 14, 'SEMUA COCOK', 'TIDAK COCOK') AS hasil;\n") % (
    atau(KUB), JU, CEK_FN, CEK_UJI, SIAP_VAR)

pl = KEPALA + ("-- PULIH (deterministik): baris yang diubah dikembalikan dari tabel sementara pu_lama (dibuat pulih-satker.sh dari cadangan/abt_variabel-sebelum.sql) "
               "HANYA bila isinya masih isi BARU paket dan baris cadangan masih isi LAMA yang diharapkan.\n"
               "-- Fungsi isian_rtf_pihak_peringkat dihapus oleh pulih-satker.sh SESUDAH ini dan hanya bila tak ada variabel yang memanggilnya. Jalankan lewat pulih-satker.sh (bukan langsung): tabel pu_lama harus ada.\n")
pl += "START TRANSACTION;\n"
for n in NO_UBAH:
    pl += ("UPDATE abt_variabel a JOIN pu_lama l ON l.no_var=a.no_var SET a.nama=l.nama, a.data_type=l.data_type, a.data_tabel=l.data_tabel, a.data_kolom=l.data_kolom, "
           "a.urutan_data=l.urutan_data, a.referensi=l.referensi, a.sql_query=l.sql_query, a.default_data=l.default_data, a.multi_sidang=l.multi_sidang, a.locked=l.locked, "
           "a.modifier=l.modifier, a.modified=l.modified WHERE %s AND %s;\n") % (kond_ubah(n, 'baru', 'a'), kond_ubah(n, 'lama', 'l'))
pl += "COMMIT;\n"
pl += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d, 'VARIABEL KEMBALI', "
       "CONCAT('PULIH TIDAK LENGKAP - baris diubah yang sudah kembali ', (SELECT COUNT(*) FROM abt_variabel WHERE %s), ' dari %d (diubah orang sesudah dipasang? dibiarkan)')) AS hasil;\n") % (
    atau(KUL), JU, atau(KUL), JU)

# ---- uji menjalankan kueri BARU (UJIVAR): tiap kueri dengan #perkara_id# = @pid dan rujukan variabel lain = 0 (hanya memeriksa kueri berjalan tanpa galat).
# Kueri yang memang berat (cari ke seluruh perkara / kode pos dari tabel wilayah, 4-8 dtk per perkara di laptop sebelum paket ini) dipisah ke UJIVAR-BERAT, dijalankan untuk SATU perkara saja.
BERAT = {9280, 9281, 9290, 9291}
uv = {'': KEPALA + "-- UJIVAR: kueri baru tiap variabel diubah (kecuali yang berat), dijalankan pasang-satker.sh atas beberapa perkara contoh (@pid diisi skrip; rujukan #NNNN# = 0). Hanya memeriksa kueri berjalan tanpa galat.\n",
      '-BERAT': KEPALA + "-- UJIVAR-BERAT: kueri berat (9280 9281 9290 9291), dijalankan pasang-satker.sh untuk SATU perkara contoh (@pid diisi skrip). Hanya memeriksa kueri berjalan tanpa galat.\n"}
for n in NO_UBAH:
    q = ubah[n]['baru_b'].decode('latin1')
    q = re.sub(r"'#perkara_id#'|#perkara_id#", '@pid', q)
    q = re.sub(r'#\d{1,5}#', '0', q)
    q = q.replace('\r\n', '\n').rstrip().rstrip(';')
    q = q.encode('ascii', 'replace').decode('ascii')  # hanya uji sintaks: karakter bukan-ASCII (di dalam literal) diganti tanda tanya
    uv['-BERAT' if n in BERAT else ''] += "SELECT %d AS no_var, COUNT(*) AS baris FROM (%s) AS uji_%d;\n" % (n, q, n)
assert set(uv) == {'', '-BERAT'} and uv['-BERAT'].count('SELECT 9') == 4

# ---- berkas
with open(os.path.join(KELUAR, '%s-FUNGSI.sql' % N), 'wb') as f:
    f.write(fungsi_baru.encode('latin1'))
for nama, isi in (('PRASYARAT', pra), ('PASANG', ps), ('PERIKSA', pk), ('PULIH', pl), ('UJIVAR', uv['']), ('UJIVAR-BERAT', uv['-BERAT'])):
    open(os.path.join(KELUAR, '%s-%s.sql' % (N, nama)), 'w', newline='\n', encoding='ascii').write(isi)
open(os.path.join(KELUAR, 'nomor-ubah.txt'), 'w', newline='\n').write(daftar(NO_UBAH) + '\n')
open(os.path.join(KELUAR, 'nama-fungsi.txt'), 'w', newline='\n').write(FUNGSI + '\n')
open(os.path.join(KELUAR, 'harap.txt'), 'w', newline='\n').write(HARAP + '\n' + ULANG + '\n')
for sk in ('pasang-satker.sh', 'pulih-satker.sh', 'perkara-uji.txt'):
    open(os.path.join(KELUAR, sk), 'wb').write(open(os.path.join(AKAR, sk), 'rb').read().replace(b'\r\n', b'\n'))

ring = dict(ubah=[dict(no=n, lama_md5=ubah[n]['lama_md5'], baru_md5=ubah[n]['baru_md5'], lama_panjang=ubah[n]['lama_len'], baru_panjang=ubah[n]['baru_len'], diganti=ubah[n]['ganti'], inline=ubah[n]['inline'], khusus=ubah[n].get('khusus', ''), tambahan=n in TAMBAHAN) for n in NO_UBAH],
            fungsi=dict(nama=FUNGSI, md5=FN_MD5), dependensi=DEP, harap=HARAP, ulang=ULANG, dilewati_27=sorted(DILEWATI_27),
            prasyarat_27=dict(variabel=SIAP27_VAR, fungsi=SIAP27_FN), jumlah_penggantian=sum(u['ganti'] for u in ubah.values()))
json.dump(ring, open(os.path.join(AKAR, '..', 'hasil', 'isi-paket.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

berkas_paket = sorted(x for x in os.listdir(KELUAR) if os.path.isfile(os.path.join(KELUAR, x)) and x != 'MD5SUMS.txt')
with open(os.path.join(KELUAR, 'MD5SUMS.txt'), 'w', newline='\n') as f:
    for x in berkas_paket:
        f.write('%s  %s\n' % (md5(open(os.path.join(KELUAR, x), 'rb').read()), x))
print('ubah', JU, 'penggantian', ring['jumlah_penggantian'], 'dependensi', len(DEP), 'fungsi md5', FN_MD5)
print('HARAP', HARAP)
print('ULANG', ULANG)
print('MD5SUMS:', len(berkas_paket), 'berkas')
print('nomor:', daftar(NO_UBAH))
