# -*- coding: utf-8 -*-
"""Urai ulang semua keluaran render (*.txt.rtf -> *.txt) dengan rtfteks terbaru. pakai: python urai_ulang.py <folder>"""
import glob, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtfteks import teks_tampak  # noqa: E402
n = 0
for f in glob.glob(os.path.join(sys.argv[1], '**', '*.txt.rtf'), recursive=True):
    open(f[:-4], 'w', encoding='utf-8').write(teks_tampak(open(f, 'rb').read().decode('latin1')))
    n += 1
print(n)
