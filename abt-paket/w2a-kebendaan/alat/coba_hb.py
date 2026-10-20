# -*- coding: utf-8 -*-
"""Coba tambal HB: python coba_hb.py <keluar-folder>  -> tulis RTF hasil tambal dan cetak ringkasan."""
import os, sys, hashlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tambal_hb
from rtf2txt import rtf_ke_teks

ASLI = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "asli-server-21okt", "4a Harta Bersama")
keluar = sys.argv[1]
os.makedirs(keluar, exist_ok=True)
for f in sorted(os.listdir(ASLI)):
    if not (f.startswith("[01b]") or f.startswith("[02a]") or f.startswith("[01] ") or f.startswith("[01a]")):
        continue
    lama = open(os.path.join(ASLI, f), "rb").read().decode("latin1")
    baru = tambal_hb.tambal(f, lama)
    open(os.path.join(keluar, f), "wb").write(baru.encode("latin1"))
    print("OK", f[:40], len(lama), "->", len(baru))
