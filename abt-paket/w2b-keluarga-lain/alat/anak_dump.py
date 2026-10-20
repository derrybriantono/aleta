# -*- coding: utf-8 -*-
"""Cetak SEMUA paragraf blangko RTF dengan teks penuh (tanpa label daftar): python anak_dump.py <rtf> [indeks_awal [indeks_akhir]]"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bangun import Dok  # noqa: E402

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    d = Dok(sys.argv[1])
    a = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    b = int(sys.argv[3]) if len(sys.argv) > 3 else len(d.par) - 1
    for i in range(a, min(b, len(d.par) - 1) + 1):
        print('%d| %s' % (i, d.isi(i)))
