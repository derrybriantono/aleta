# -*- coding: utf-8 -*-
"""Render blangko LAMA (asli server) dan BARU (hasil tambal) atas perkara nyata, simpan teks, dan cetak selisihnya.
  python render_banding.py <perkara_id> <folder> <berkas-awalan> <nama-contoh> [paket-satker/rtf]
Hasil: ../contoh/<nama>-sebelum.txt, <nama>-sesudah.txt, <nama>-selisih.txt (selisih baris yang berbeda saja).
Pakai perkara TANPA tuntutan khusus (regresi: bunyi lama) atau dengan fixture isian (fitur)."""
import difflib, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_w2a

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pid, folder, awalan, nama = sys.argv[1:5]
asli = os.path.join(AKAR, "asli-server-21okt", folder)
berkas = [f for f in os.listdir(asli) if f.startswith(awalan)]
assert len(berkas) == 1, berkas
daftar = [l.rstrip("\n").split("\t") for l in open(os.path.join(AKAR, "paket-satker", "DAFTAR-BLANGKO.tsv"), encoding="latin1") if l.strip()]
nn = [d[0] for d in daftar if d[1] == folder and d[2] == berkas[0]]
assert len(nn) == 1, nn
tmp = os.environ.get("TMP", ".")
st1, lama = render_w2a.render(pid, os.path.join(asli, berkas[0]), os.path.join(tmp, "banding_lama_%s.rtf" % nama))
st2, baru = render_w2a.render(pid, os.path.join(AKAR, "paket-satker", "rtf", nn[0] + ".rtf"), os.path.join(tmp, "banding_baru_%s.rtf" % nama))
os.makedirs(os.path.join(AKAR, "contoh"), exist_ok=True)


def rapi(t):
    return [" ".join(x.split()) for x in t.split("\n") if x.strip()]


a, b = rapi(lama), rapi(baru)
open(os.path.join(AKAR, "contoh", nama + "-sebelum.txt"), "w", encoding="utf-8").write("\n".join(a) + "\n")
open(os.path.join(AKAR, "contoh", nama + "-sesudah.txt"), "w", encoding="utf-8").write("\n".join(b) + "\n")
selisih = [l for l in difflib.unified_diff(a, b, "sebelum", "sesudah", lineterm="", n=0) if not l.startswith("@@")]
open(os.path.join(AKAR, "contoh", nama + "-selisih.txt"), "w", encoding="utf-8").write("\n".join(selisih) + "\n")
print(nama, st1[:60], "|", st2[:60], "| baris sebelum/sesudah", len(a), len(b), "| baris selisih", len(selisih))
