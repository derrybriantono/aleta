# -*- coding: utf-8 -*-
"""Selisih TEKS (paragraf) antara blangko lama (asli-server-21okt) dan baru (paket-satker/rtf): JSON {nn: {folder, berkas, hilang:[...], tambah:[...]}}.
Dipakai uji w2a-kebendaan.test.ts untuk memastikan hanya paragraf yang sengaja diganti yang berubah."""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtf2txt import rtf_ke_teks

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def baris(rtf):
    t = rtf_ke_teks(rtf.decode("latin1"))
    return [" ".join(x.replace("\t", " ").split()) for x in t.split("\n") if x.strip()]


hasil = {}
for l in open(os.path.join(AKAR, "paket-satker", "DAFTAR-BLANGKO.tsv"), encoding="latin1"):
    if not l.strip():
        continue
    nn, folder, berkas, pra, baru = l.rstrip("\n").split("\t")
    lama = baris(open(os.path.join(AKAR, "asli-server-21okt", folder, berkas), "rb").read())
    nw = baris(open(os.path.join(AKAR, "paket-satker", "rtf", nn + ".rtf"), "rb").read())
    sl, sn = {}, {}
    for x in lama:
        sl[x] = sl.get(x, 0) + 1
    for x in nw:
        sn[x] = sn.get(x, 0) + 1
    hilang = [x for x in sl for _ in range(max(0, sl[x] - sn.get(x, 0)))]
    tambah = [x for x in sn for _ in range(max(0, sn[x] - sl.get(x, 0)))]
    hasil[nn] = dict(folder=folder, berkas=berkas, hilang=hilang, tambah=tambah)
sys.stdout.reconfigure(encoding="utf-8")
print(json.dumps(hasil, ensure_ascii=True))
