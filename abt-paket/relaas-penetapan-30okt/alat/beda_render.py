# -*- coding: utf-8 -*-
"""Banding teks tampak render lama vs baru per berkas (baris berubah saja).
pakai: python beda_render.py <render-lama> <render-baru> [keluar.txt]"""
import difflib
import glob
import os
import sys

lama, baru = sys.argv[1], sys.argv[2]
o = open(sys.argv[3], 'w', encoding='utf-8') if len(sys.argv) > 3 else sys.stdout
n = sama = 0
for f in sorted(glob.glob(os.path.join(baru, '**', '*.txt'), recursive=True)):
    rel = os.path.relpath(f, baru)
    g = os.path.join(lama, rel)
    if not os.path.exists(g):
        o.write('TANPA PASANGAN LAMA %s\n' % rel)
        continue
    a = open(g, encoding='utf-8').read().splitlines()
    b = open(f, encoding='utf-8').read().splitlines()
    n += 1
    d = [x for x in difflib.unified_diff(a, b, lineterm='', n=0) if not x.startswith(('---', '+++', '@@'))]
    if not d:
        sama += 1
        continue
    o.write('=== %s\n' % rel.replace('\\', '/'))
    for x in d:
        o.write(x[:400] + '\n')
o.write('BERKAS %d, IDENTIK %d, BERUBAH %d\n' % (n, sama, n - sama))
