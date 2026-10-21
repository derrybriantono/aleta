# -*- coding: utf-8 -*-
"""Bandingkan render SEBELUM vs SESUDAH (renderer php56 ABT asli) per variabel atas 472 perkara, dan cocokkan dengan harness SQL."""
import json, re, sys, collections, datetime
sys.stdout.reconfigure(encoding='utf-8')
O = r'D:\Aplikasi\aleta\tmp\x2\out\\'
A0 = json.load(open(O + r'sebelum\A.json', encoding='utf-8'))
A1 = json.load(open(O + r'sesudah\A.json', encoding='utf-8'))
SQL = json.load(open(O + 'banding_sql.json', encoding='utf-8'))
BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']


def tgl(x):
    y, m, d = x.split('-')
    return '%02d %s %s' % (int(d), BLN[int(m) - 1], y)


def tampil_sql(var, x):
    """nilai harness SQL -> teks yang dicetak ABT"""
    if x is None:
        return '...'
    x = re.sub(r' {2,}', ' ', x)   # renderer merapatkan spasi ganda
    if var == '8544' and re.match(r'\d{4}-\d\d-\d\d$', x):
        return tgl(x)
    return x


pids = sorted(A0, key=int)
galat0 = [p for p in pids if '_galat' in A0[p]]
galat1 = [p for p in pids if '_galat' in A1[p]]
print('perkara', len(pids), 'galat sebelum', len(galat0), 'sesudah', len(galat1))
vars_ = sorted({v for p in pids if '_galat' not in A0[p] for v in A0[p]}, key=int)
ringkas = {}
tak_cocok_sql = collections.Counter()
for v in vars_:
    sama = beda = 0
    contoh = []
    for p in pids:
        if '_galat' in A0[p] or '_galat' in A1[p]:
            continue
        a, b = A0[p].get(v), A1[p].get(v)
        if a == b:
            sama += 1
        else:
            beda += 1
            if len(contoh) < 6:
                contoh.append((p, a[:40], b[:40]))
    # cocokkan dengan harness SQL (hanya variabel yang ada di harness)
    if v in SQL:
        for p in pids:
            if '_galat' in A1[p] or str(p) not in SQL[v]:
                continue
            lama, baru = SQL[v][str(p)]
            if A0[p].get(v) != tampil_sql(v, lama) and v != '74' and v != '8545':
                tak_cocok_sql['%s sebelum' % v] += 1
            if A1[p].get(v) != tampil_sql(v, baru):
                tak_cocok_sql['%s sesudah' % v] += 1
    if beda:
        ringkas[v] = dict(sama=sama, beda=beda, contoh=contoh)
print('variabel diuji', len(vars_), '| berubah:', {v: r['beda'] for v, r in ringkas.items()})
print('ketidakcocokan render vs harness SQL:', dict(tak_cocok_sql))
for v, r in ringkas.items():
    print(v, r['beda'], 'berubah dari', r['beda'] + r['sama'], '| contoh', r['contoh'][:3])
json.dump(ringkas, open(O + 'banding_render_A.json', 'w', encoding='utf-8'), ensure_ascii=False)
