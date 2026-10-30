# -*- coding: utf-8 -*-
"""Cari BAS mediasi sidang pertama (ALUR 04/05/34/36/37) di pohon Derry dan cek jangkar mediasi_el: python cari_mediasi.py [akar] [-v berkas]"""
import glob
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sumber'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paragraf  # noqa: E402
import rtf2txt  # noqa: E402

AKAR = 'D:/Aplikasi/aleta/tmp/bas29/dasar3/derry_briantono'
if len(sys.argv) > 2 and sys.argv[1] == '-v':
    raw = open(sys.argv[2], 'rb').read().decode('latin1')
    k, ps, e = paragraf.pecah(raw)
    for i, p in enumerate(ps):
        t = rtf2txt.rtf_ke_teks(p).strip()
        if t:
            print(i, t[:170].replace('\n', ' / '))
    sys.exit()
pola = re.compile(r'^BAS ALUR (05|34|36|37) .*Mediasi.*\.rtf$', re.I)
for f in sorted(glob.glob(os.path.join(AKAR, '*', '*.rtf'))):
    n = os.path.basename(f)
    if pola.match(n) and not re.search(r'cabut|elektronik', n, re.I):
        print(os.path.basename(os.path.dirname(f)), '|', n)
