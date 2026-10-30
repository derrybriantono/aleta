# -*- coding: utf-8 -*-
"""Tampilkan contoh beda dari banding-rinci.json. pakai: python lihat_beda.py <potongan> [prodeo|bukan] [n] [saring-regex]"""
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
d = json.load(open(r'D:\Aplikasi\aleta\tmp\pp29\banding\banding-rinci.json', encoding='utf-8'))
k = sys.argv[1]
jenis = sys.argv[2] if len(sys.argv) > 2 else 'bukan'
n = int(sys.argv[3]) if len(sys.argv) > 3 else 5
saring = re.compile(sys.argv[4]) if len(sys.argv) > 4 else None
c = 0
for pid, h in d.items():
    if k not in h or h['prodeo'] != (jenis == 'prodeo'):
        continue
    a, b = h[k]
    if a == b:
        continue
    if saring and not saring.search(a + '|' + b):
        continue
    print('--- %s (relaas T %s)\n  LAMA: %s\n  BARU: %s' % (pid, h.get('nRelaasT'), a[:700], b[:700]))
    c += 1
    if c >= n:
        break
