# -*- coding: utf-8 -*-
"""Coba tambal satu folder: python coba_umum.py <modul> <folder-asli> <awalan-berkas,...> <keluar>"""
import importlib, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
modul, folder, awalan, keluar = sys.argv[1], sys.argv[2], sys.argv[3].split(","), sys.argv[4]
m = importlib.import_module(modul)
asli = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "asli-server-21okt", folder)
os.makedirs(keluar, exist_ok=True)
for f in sorted(os.listdir(asli)):
    if not any(f.startswith(a) for a in awalan):
        continue
    lama = open(os.path.join(asli, f), "rb").read().decode("latin1")
    baru = m.tambal(f, lama)
    open(os.path.join(keluar, f), "wb").write(baru.encode("latin1"))
    print("OK", f[:50], len(lama), "->", len(baru))
