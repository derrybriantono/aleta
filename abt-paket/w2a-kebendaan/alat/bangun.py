# -*- coding: utf-8 -*-
"""Membangun semua katalog K1 ke ekstensi-sipp/saksi-katalog/ dari salinan versi 1 (../katalog-v1/)."""
import os, subprocess, sys

AKAR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
V1 = os.path.join(AKAR, "abt-paket", "w2a-kebendaan", "katalog-v1")
KELUAR = os.path.join(AKAR, "ekstensi-sipp", "saksi-katalog")
DIR = os.path.dirname(os.path.abspath(__file__))

TUGAS = [("hb_v2.py", "harta-bersama.json"), ("hb_tg.py", "harta-bersama-tergugat.json"),
         ("waris_v2.py", "kewarisan.json"), ("waris_tg.py", "kewarisan-tergugat.json")]
pilih = sys.argv[1:]
for skrip, berkas in TUGAS:
    if pilih and not any(p in berkas for p in pilih):
        continue
    if not os.path.exists(os.path.join(DIR, skrip)):
        continue
    r = subprocess.run([sys.executable, skrip, os.path.join(V1, berkas), os.path.join(KELUAR, berkas)], cwd=DIR, capture_output=True)
    print(berkas, r.stdout.decode("utf-8", "replace").strip(), r.stderr.decode("utf-8", "replace").strip()[-800:])
