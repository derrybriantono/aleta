# -*- coding: utf-8 -*-
"""Pindai pohon: tiap aturan -> jumlah kali/berkas + konteks unik (untuk ditinjau). pakai: python pindai_c1.py <akar derry_briantono> <keluar.json>"""
import collections
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtfpeta import peta  # noqa
from aturan import DIKOMPILASI  # noqa

akar, keluar = sys.argv[1], sys.argv[2]
hasil = collections.OrderedDict()
for k, j, rx, g, t in DIKOMPILASI:
    hasil[j] = {'kode': k, 'kali': 0, 'berkas': set(), 'konteks': collections.Counter(), 'tidak_harfiah': 0}
tumpang = []
for d, _, fs in os.walk(akar):
    for f in sorted(fs):
        if not f.lower().endswith('.rtf'):
            continue
        p = os.path.join(d, f)
        rel = os.path.relpath(p, akar).replace('\\', '/')
        b = open(p, 'rb').read()
        teks, pos = peta(b)
        rentang = []
        for k, j, rx, g, t in DIKOMPILASI:
            for m in rx.finditer(teks):
                h = hasil[j]
                h['kali'] += 1
                h['berkas'].add(rel)
                kon = teks[max(0, m.start() - 60):m.end() + 60].replace('\n', ' / ')
                h['konteks'][kon] += 1
                if not all(pos[i][2] for i in range(m.start(), m.end())):
                    h['tidak_harfiah'] += 1
                rentang.append((m.start(), m.end(), j, rel))
        rentang.sort()
        for a, bb in zip(rentang, rentang[1:]):
            if bb[0] < a[1]:
                tumpang.append((a, bb))
out = {}
for j, h in hasil.items():
    out[j] = {'kode': h['kode'], 'kali': h['kali'], 'berkas': len(h['berkas']), 'tidak_harfiah': h['tidak_harfiah'],
              'daftar': sorted(h['berkas']), 'konteks': h['konteks'].most_common()}
    print('%s\t%s\t%d kali\t%d berkas\ttidak_harfiah=%d\tkonteks_unik=%d' % (h['kode'], j, h['kali'], len(h['berkas']), h['tidak_harfiah'], len(h['konteks'])))
print('TUMPANG', len(tumpang), tumpang[:10])
json.dump(out, open(keluar, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
