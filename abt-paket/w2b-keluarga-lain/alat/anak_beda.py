# -*- coding: utf-8 -*-
"""Tampilkan paragraf blangko B yang TIDAK ada di blangko A (per teks): python anak_beda.py <A.txt> <B.txt>  (berkas dump anak_inventaris)"""
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
a = [re.sub(r'^\d+\| ?', '', x) for x in open(sys.argv[1], encoding='utf-8').read().split('\n')]
sa = set(a)
for x in open(sys.argv[2], encoding='utf-8').read().split('\n'):
    t = re.sub(r'^\d+\| ?', '', x)
    if t not in sa and t.strip():
        print(x)
