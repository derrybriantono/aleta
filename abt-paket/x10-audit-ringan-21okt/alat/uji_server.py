# -*- coding: utf-8 -*-
"""Konfirmasi di SERVER (baca saja, SELECT saja; MariaDB 5.5) untuk perkara-uji.txt: kueri LAMA dan BARU tiap variabel x10 yang berdiri sendiri
(tanpa rujukan #nnnn#) dijalankan (baris pertama, seperti ABT) dan dibandingkan; waktu 1076/1077 (v_pihak_perkara) lama vs baru; semua baris uji-kueri.tsv.
pakai: python uji_server.py  -> out/uji_server10.json dan ringkasan di layar."""
import json, os, re, sys, time

AKAR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AKAR)
sys.path.insert(0, os.path.join(AKAR, '..', 'sumber'))
from srv_sql import srv  # noqa: E402
import variabel_def as V  # noqa: E402

PK = os.path.join(AKAR, '..', 'paket-satker')
HEX = os.environ.get('VAR_BASE_HEX', r'D:\Aplikasi\aleta\tmp\x10\lab\var_server_hex.tsv')
VAR = [18, 6031, 212, 213, 357, 1076, 1077, 6144, 6145, 6146, 6147, 6148, 6150, 6151, 7123, 7124, 7713, 8146, 8147]

dasar = {}
for b in open(HEX, encoding='latin1', newline='').read().split('\n')[1:]:
    if b.strip():
        k = b.split('\t')
        dasar[int(k[0])] = dict(no_var=int(k[0]), data_type=None if k[2] == 'NULL' else k[2],
                                sql_query=None if k[7] == 'NULL' else bytes.fromhex(k[7]), default_data=None if k[8] == 'NULL' else bytes.fromhex(k[8]))
lama = {no: dasar[no]['sql_query'].decode('latin1') for no in VAR}
baru = {no: V.UBAH[no]['fungsi'](dasar[no])['sql_query'].decode('latin1') for no in VAR}

nomor = [x.strip() for x in open(os.path.join(PK, 'perkara-uji.txt')) if x.strip()]
o, e = srv("SELECT perkara_id, nomor_perkara FROM perkara WHERE nomor_perkara IN (%s)" % ','.join("'%s'" % n for n in nomor))
pid = {l.split('\t')[1]: int(l.split('\t')[0]) for l in o.strip().splitlines()[1:]}
print('perkara ketemu di server:', len(pid), 'dari', len(nomor))


def satu(sql, p):
    s = sql.strip().rstrip(';').replace('#perkara_id#', str(p))
    return 'SELECT IFNULL(REPLACE(REPLACE((SELECT x.data FROM (%s) x LIMIT 1), CHAR(13), ""), CHAR(10), " "), "(kosong)") AS h;' % s


def parse(o, n):
    baris, L, i = [], o.replace('\r', '').split('\n'), 0
    while i < len(L):
        if L[i] == 'h':
            ada = i + 1 < len(L) and L[i + 1] != 'h'
            baris.append(L[i + 1] if ada else '')
            i += 2 if ada else 1
        else:
            i += 1
    assert len(baris) == n, (len(baris), n)
    return baris


ringkas, waktu = {}, {}
for n in nomor:
    if n not in pid:
        print('TIDAK ADA di server:', n)
        continue
    p = pid[n]
    st, ket = [], []
    for no in VAR:
        for ver, tab in (('lama', lama), ('baru', baru)):
            st.append(satu(tab[no], p))
            ket.append((no, ver))
    o, e = srv('\n'.join(st))
    if e.strip():
        print('GALAT', n, e[:400])
        continue
    ringkas[n] = {'%d|%s' % k: v.strip() for k, v in zip(ket, parse(o, len(ket)))}
    # waktu 1076 lama vs baru
    for ver, tab in (('lama', lama), ('baru', baru)):
        t0 = time.time()
        srv(satu(tab[1076], p) + '\n' + satu(tab[1077], p))
        waktu.setdefault(ver, []).append(time.time() - t0)
json.dump(dict(pid=pid, hasil=ringkas, waktu_1076_1077_detik=waktu), open(os.environ.get('KELUAR', r'D:\Aplikasi\aleta\tmp\x10\out\uji_server10.json'), 'w', encoding='utf-8'), ensure_ascii=False)
tdk = 0
for n, d in ringkas.items():
    beda = [no for no in VAR if d['%d|lama' % no] != d['%d|baru' % no]]
    print(n, 'id', pid[n], '| berbeda lama->baru:', beda)
    for no in beda:
        print('    %s: %s  ->  %s' % (no, d['%d|lama' % no][:60], d['%d|baru' % no][:60]))
print('waktu 1076+1077 (detik, termasuk ssh) rata-rata: lama %.2f, baru %.2f' % (sum(waktu['lama']) / len(waktu['lama']), sum(waktu['baru']) / len(waktu['baru'])))

# ---- uji-kueri.tsv (dijalankan pasang-satker.sh di server): semua baris harus jalan tanpa galat di MariaDB 5.5
kueri = [l.rstrip('\n').split('\t') for l in open(os.path.join(PK, 'uji-kueri.tsv'), encoding='ascii') if l.strip() and not l.startswith('#')]
jalan = {}
for n in nomor:
    if n not in pid:
        continue
    st = ['SELECT "%s" AS var, LEFT(REPLACE(IFNULL((SELECT x.data FROM (%s) x LIMIT 1), "(kosong)"), CHAR(10), " "), 120) AS data;' % (no, sql.replace('#perkara_id#', str(pid[n]))) for no, sql in kueri]
    o, e = srv('\n'.join(st))
    if e.strip():
        print('GALAT uji-kueri', n, e[:300])
        continue
    jalan[n] = len([l for l in o.replace('\r', '').split('\n') if l and not l.startswith('var\t')])
print('uji-kueri.tsv di server: %d kueri x %d perkara; baris hasil per perkara: %s' % (len(kueri), len(jalan), sorted(set(jalan.values()))))
