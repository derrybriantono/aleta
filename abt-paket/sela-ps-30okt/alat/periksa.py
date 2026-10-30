# -*- coding: utf-8 -*-
"""Pindai teks hasil render (keluaran render.py): sisa penanda #nnnn#, kosong (...), tanda baca ganda, kata berulang, spasi sebelum tanda baca.
pakai: python periksa.py <folder render>  -> ringkasan per berkas (dan rincian baris bermasalah)."""
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
POLA = [
    ('penanda', re.compile(r'#\d{4,5}#')),
    ('isian kosong', re.compile(r'(?<![.\w])\.\.\.(?![.\w])')),
    ('titik-titik', re.compile(r'\.{5,}')),
    ('tanda ganda', re.compile(r'[;,]{2}|;\s*;|,\s*,|\.\s*\.(?!\.)|:\s*[;:]')),
    ('spasi sebelum tanda', re.compile(r'\w \s*[;,](?!\d)')),
    ('kata berulang', re.compile(r'\b(\w{3,})\s+\1\b', re.I)),
    ('tanpa spasi', re.compile(r'[a-z][;,][A-Za-z]')),
    ('tag html', re.compile(r'</?(?:strong|b|i|br|p)>', re.I)),
]
d = sys.argv[1]
for f in sorted(os.listdir(d)):
    if not f.endswith('.txt'):
        continue
    t = open(os.path.join(d, f), encoding='utf-8').read()
    hasil = []
    for nama, rx in POLA:
        for m in rx.finditer(t):
            a = max(0, m.start() - 60)
            hasil.append('   %s: ...%s...' % (nama, t[a:m.end() + 40].replace('\n', ' / ')))
    print('%s: %d temuan, %d baris' % (f, len(hasil), t.count('\n')))
    for h in hasil[:25]:
        print(h)
