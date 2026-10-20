# -*- coding: utf-8 -*-
"""Coba tambal wasiat/hibah/wakaf/ES: python coba_lain.py <keluar-folder>"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tambal_lain

ASLI = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "asli-server-21okt")
FOLDER = {"4c Wasiat": "4c", "4d Hibah": "4d", "4e Wakaf": "4e", "10 Ekonomi Syariah": "10", "10a Ekonomi Syariah Biasa": "10a"}
keluar = sys.argv[1]
n = 0
for nama_folder, kode in FOLDER.items():
    os.makedirs(os.path.join(keluar, nama_folder), exist_ok=True)
    for f in sorted(os.listdir(os.path.join(ASLI, nama_folder))):
        if not (f.startswith("[01] ") or f.startswith("[01a]") or f.startswith("[01b]")):
            continue
        lama = open(os.path.join(ASLI, nama_folder, f), "rb").read().decode("latin1")
        baru = tambal_lain.tambal(kode, f, lama)
        open(os.path.join(keluar, nama_folder, f), "wb").write(baru.encode("latin1"))
        n += 1
        print("OK", kode, f[:50], len(lama), "->", len(baru))
print(n, "berkas")
