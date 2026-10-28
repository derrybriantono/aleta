# -*- coding: utf-8 -*-
"""Bandingkan cetakan sampul SEBELUM/SESUDAH (hasil render_sampul.py) dan tulis hasil/render-ringkasan.json (hitungan saja, tanpa data perkara).
pakai: python bandingkan_render.py [keluar.json]"""
import difflib
import json
import os
import re
import sys

D = r'D:\Aplikasi\aleta\tmp\w109\out'
a = json.load(open(os.path.join(D, 'sebelum', 'ringkasan.json')))
b = json.load(open(os.path.join(D, 'sesudah', 'ringkasan.json')))
ring = {'cetakan': len(a), 'sama': 0, 'beda': 0, 'per_grup': {}, 'beda_rapat': [], 'beda_tak_rapat': []}
for k in sorted(a):
    ta = open(os.path.join(D, 'sebelum', k + '.txt'), encoding='utf-8').read()
    tb = open(os.path.join(D, 'sesudah', k + '.txt'), encoding='utf-8').read()
    g = a[k]['grup']
    ring['per_grup'].setdefault(g, {'sama': 0, 'beda': 0})
    if ta == tb:
        ring['sama'] += 1
        ring['per_grup'][g]['sama'] += 1
    else:
        ring['beda'] += 1
        ring['per_grup'][g]['beda'] += 1
        (ring['beda_rapat'] if g == 'kontrol_rapat' else ring['beda_tak_rapat']).append(k)
        if '-v' in sys.argv:
            print('=== ', k)
            sa = re.sub(r'(?<=[IVXL]\. )[^\n|<]+', '<nama>', ta).splitlines()
            sb = re.sub(r'(?<=[IVXL]\. )[^\n|<]+', '<nama>', tb).splitlines()
            for l in difflib.unified_diff(sa, sb, 'sebelum', 'sesudah', lineterm='', n=0):
                print(l[:200])
json.dump(ring, open(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'hasil', 'render-ringkasan.json'), 'w'), indent=1)
print(json.dumps(ring, indent=1))
