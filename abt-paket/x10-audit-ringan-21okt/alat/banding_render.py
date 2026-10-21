# -*- coding: utf-8 -*-
"""Bandingkan render SEBELUM vs SESUDAH (renderer php56 ABT asli) per variabel x10; rincian perbedaan dan cocokkan dengan harness SQL bila ada."""
import collections, json, re, sys
sys.stdout.reconfigure(encoding='utf-8')
O = r'D:\Aplikasi\aleta\tmp\x10\out' + '\\'
A0 = json.load(open(O + r'sebelum\A.json', encoding='utf-8'))
A1 = json.load(open(O + r'sesudah\A.json', encoding='utf-8'))
pids = sorted(A0, key=int)
print('perkara', len(pids), 'galat sebelum', sum('_galat' in A0[p] for p in pids), 'sesudah', sum('_galat' in A1[p] for p in pids))
vars_ = sorted({v for p in pids if '_galat' not in A0[p] for v in A0[p]}, key=int)
ringkas = {}
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
            if len(contoh) < 8:
                contoh.append((p, a[:60], b[:60]))
    ringkas[v] = dict(sama=sama, beda=beda, contoh=contoh)
print('berubah:', {v: r['beda'] for v, r in ringkas.items() if r['beda']})
for v, r in ringkas.items():
    if r['beda']:
        print('\n==', v, r['beda'], 'dari', r['beda'] + r['sama'])
        for c in r['contoh'][:6]:
            print('   ', c)
json.dump(ringkas, open(O + 'banding_render_A.json', 'w', encoding='utf-8'), ensure_ascii=False)
