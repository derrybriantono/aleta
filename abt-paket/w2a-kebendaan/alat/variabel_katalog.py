# -*- coding: utf-8 -*-
"""Variabel isian yang diminta katalog saksi K1 (4750-4764) dan K2 (4765-4779): dibaca dari untuk-sesi-utama/variabel-katalog-k*.json
(semua data_teks tanpa kueri) dan ikut dipasang bersama paket ini."""
import glob, json, os

DASAR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "untuk-sesi-utama")


def semua():
    hasil = []
    for berkas in sorted(glob.glob(os.path.join(DASAR, "variabel-katalog-k*.json"))):
        for x in json.load(open(berkas, encoding="utf-8")):
            assert x.get("tipe", "data_teks") == "data_teks", (berkas, x)
            hasil.append(dict(no=int(x["no"]), nama=x["nama"], tipe="data_teks", sql=None, default=None))
    return hasil


if __name__ == "__main__":
    for v in semua():
        print(v["no"], len(v["nama"]))
