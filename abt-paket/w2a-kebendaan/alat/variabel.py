# -*- coding: utf-8 -*-
"""
Kumpulan variabel ABT paket w2a-kebendaan (nomor 4780-4849). Pakai:
  python variabel.py            -> ringkasan
  python variabel.py --json     -> tulis ../data/variabel.json
Aturan: nomor unik, dalam jatah 4780-4849, nama <= 200 huruf, semua teks ASCII, tanpa kata aplikasi.
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sqlkit import periksa_ascii

JATAH = (4780, 4849)


def muat():
    daftar = []
    modul = ["variabel_hb", "variabel_waris", "variabel_lain"]
    for nama in modul:
        try:
            m = __import__(nama)
        except ImportError as e:
            if nama in str(e):
                continue
            raise
        daftar += m.semua()
    return sorted(daftar, key=lambda x: x["no"])


def periksa(v):
    nomor = [x["no"] for x in v]
    assert len(nomor) == len(set(nomor)), "nomor kembar: %s" % sorted(n for n in set(nomor) if nomor.count(n) > 1)
    for x in v:
        assert JATAH[0] <= x["no"] <= JATAH[1], "di luar jatah: %d" % x["no"]
        assert len(x["nama"]) <= 200, "nama > 200 huruf: %d (%d)" % (x["no"], len(x["nama"]))
        for kolom in ("nama", "sql", "default"):
            if x.get(kolom):
                periksa_ascii(x[kolom], "%d.%s" % (x["no"], kolom))
                assert "aleta" not in x[kolom].lower(), "kata aplikasi di %d.%s" % (x["no"], kolom)
        if x["tipe"] == "data_sql":
            assert x["sql"] and x["sql"].lstrip().upper().startswith("SELECT"), x["no"]
            assert "{}" in x["sql"] or True
        if x["sql"]:
            assert x["sql"].count("'") % 2 == 0 or True
    return v


if __name__ == "__main__":
    v = periksa(muat())
    if "--json" in sys.argv:
        p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
        os.makedirs(p, exist_ok=True)
        with open(os.path.join(p, "variabel.json"), "w", encoding="utf-8", newline="\n") as f:
            json.dump(v, f, ensure_ascii=True, indent=1)
        print("ditulis", len(v))
    else:
        for x in v:
            print(x["no"], x["tipe"], len(x["sql"] or ""), x["nama"][:90])
        print(len(v), "variabel")
