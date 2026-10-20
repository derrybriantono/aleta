# -*- coding: utf-8 -*-
"""Ringkas keluaran alat/periksa_katalog.cjs: satu baris per (butir, jenis jawaban, macam galat).  Pakai: python ringkas_galat.py <nama>.json"""
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
import os
AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = subprocess.run(['node', AKAR + '/alat/periksa_katalog.cjs'] + sys.argv[1:], capture_output=True, text=True, encoding='utf-8').stdout
rangkum = {}
for baris in out.splitlines():
    if not baris.strip().startswith('GALAT'):
        print(baris)
        continue
    m = re.match(r'\s*GALAT (pertanyaan\[\d+\] \(([\w-]+)\))?\.?(jawaban\.([\w-]+)\[\d+\])?\s*(#\d+)?:?\s*(.*)', baris)
    kunci = (m.group(2) if m else '?', m.group(4) if m and m.group(4) else '', re.sub(r'varian \d+', 'varian N', m.group(6)) if m else baris)
    rangkum.setdefault(kunci, 0)
    rangkum[kunci] += 1
for (q, j, pesan), n in rangkum.items():
    print('%-22s %-10s x%-2d %s' % (q, j, n, pesan[:150]))
