# -*- coding: utf-8 -*-
"""Banding nilai variabel LAMA vs pengganti BARU atas banyak perkara, dengan renderer php56 ABT asli (satu RTF kecil berisi
semua pasangan penanda, dirender per perkara; sidang = urutan 1 untuk variabel per sidang).
Basis: tampilan aps_badilag_rp30r = tabel aps_badilag_rp30 + abt_variabel aps_badilag_rp30b (paket terpasang).
pakai: python banding.py <daftar perkara.txt> <keluar.jsonl> [i/n]"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render  # noqa: E402
from rtfteks import teks_tampak  # noqa: E402

PASANGAN = [("1064+7100", "11204"), ("1099+7100", "11214"), ("1064+7100", "11216"), ("7108", "11205"), ("7109", "11206"), ("7008", "11207"), ("7006", "11208"),
            ("9564", "11209"), ("9565", "11210"), ("0180", "11200"), ("0180", "11201"), ("1066", "11202"), ("1167", "11203")]
NOMOR = sorted(set(x for p in PASANGAN for x in p))


def templat(p):
    isi = "".join("@@V%s@@%s" % (n.replace("+", "_"), "".join("#%s#" % x for x in n.split("+"))) for n in NOMOR) + "@@AKHIR@@"
    open(p, "wb").write(("{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0 " + isi + "}").encode("latin1"))


def urai(raw):
    t = teks_tampak(raw)
    hasil = {}
    for m in re.finditer(r"@@V([\d_]+)@@(.*?)(?=@@V[\d_]+@@|@@AKHIR@@)", t, re.S):
        hasil[m.group(1).replace("_", "+")] = m.group(2).strip()
    return hasil


def main():
    daftar = [l.strip() for l in open(sys.argv[1]) if l.strip()]
    if len(sys.argv) > 3:
        i, n = map(int, sys.argv[3].split("/"))
        daftar = daftar[i::n]
    tmp = os.path.join(render.TMP, "banding")
    os.makedirs(tmp, exist_ok=True)
    rtf = os.path.join(tmp, "templat-banding.rtf")
    templat(rtf)
    sudah = set()
    if os.path.exists(sys.argv[2]):
        sudah = set(json.loads(l)["perkara"] for l in open(sys.argv[2], encoding="utf-8"))
    daftar = [p for p in daftar if p not in sudah]
    with open(sys.argv[2], "a", encoding="utf-8") as o:
        for k in range(0, len(daftar), 25):
            bagian = daftar[k:k + 25]
            tugas = [(rtf, p, "1", os.path.join(tmp, "b_%s_%s.txt" % (os.getpid(), p))) for p in bagian]
            h = render.render_banyak(tugas, 25)
            for (_, p, _, kel) in tugas:
                if h.get(kel) == "OK":
                    raw = open(kel + ".rtf", "rb").read().decode("latin1")
                    o.write(json.dumps({"perkara": p, "nilai": urai(raw)}, ensure_ascii=False) + "\n")
                    os.remove(kel + ".rtf")
                    os.remove(kel)
                else:
                    o.write(json.dumps({"perkara": p, "galat": h.get(kel, "?")[:300]}, ensure_ascii=False) + "\n")
            o.flush()


if __name__ == "__main__":
    main()
