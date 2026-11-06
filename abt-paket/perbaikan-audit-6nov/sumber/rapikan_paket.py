# -*- coding: utf-8 -*-
"""Menormalkan berkas teks paket-satker ke akhir baris LF (skrip bash di server) dan menulis harap.txt + MD5SUMS.txt.
pakai: python -B rapikan_paket.py <folder paket-satker>"""
import hashlib
import os
import sys

D = sys.argv[1].replace('\\', '/').rstrip('/') + '/'
TEKS = ['tambal_rtf.py', 'pasang-satker.sh', 'pulih-satker.sh', 'abt-perbaikan-audit-6nov-PRASYARAT.sql', 'daftar-tambal.tsv', 'daftar-baru.tsv', 'tambal.tsv']
for n in TEKS:
    b = open(D + n, 'rb').read()
    b2 = b.replace(b'\r\n', b'\n')
    if b2 != b:
        open(D + n, 'wb').write(b2)
open(D + 'harap.txt', 'wb').write(b'9|2\n')
DAFTAR = ['tambal_rtf.py', 'daftar-tambal.tsv', 'daftar-baru.tsv', 'tambal.tsv', 'rtf-baru/N0001.rtf', 'pasang-satker.sh', 'pulih-satker.sh', 'abt-perbaikan-audit-6nov-PRASYARAT.sql', 'harap.txt']
baris = ['%s *%s' % (hashlib.md5(open(D + n, 'rb').read()).hexdigest(), n) for n in DAFTAR]
open(D + 'MD5SUMS.txt', 'wb').write(('\n'.join(baris) + '\n').encode('ascii'))
print('\n'.join(baris))
