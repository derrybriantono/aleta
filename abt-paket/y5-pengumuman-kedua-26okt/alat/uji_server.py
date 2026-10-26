#!/usr/bin/env python3
"""
Uji BACA SAJA di server (SELECT lewat lihat-jejak.sh): variabel 7063 lama vs baru atas SEMUA perkara yang punya relaas pengumuman
(ket_temu R/M/W/P). Keluaran: jumlah perkara, yang hasilnya BERBEDA (hanya boleh yang tadinya berakhir "..." dan kini terisi), dan
galat. Tidak menulis apa pun.

pakai: python alat/uji_server.py [perkara_id ...]   (tanpa argumen = semua perkara berrelaas pengumuman)
"""
import os
import re
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(AKAR, "alat"))
import srv_sql  # noqa: E402


def baca(nama):
    with open(os.path.join(AKAR, "sumber", nama), "rb") as f:
        t = f.read().decode("latin1")
    return "\n".join(l for l in t.split("\n") if not l.startswith("--")).strip()


LAMA = baca("7063-lama-server-26okt.sql")
BARU = baca("7063-baru.sql")


def daftar_perkara():
    o, _ = srv_sql.srv(
        "SELECT r.perkara_id FROM perkara_pelaksanaan_relaas r WHERE r.ket_temu IN ('R','M','W','P') AND r.tanggal_relaas > '1000-01-01' "
        "GROUP BY r.perkara_id ORDER BY r.perkara_id;"
    )
    return [l.strip() for l in o.split("\n")[1:] if l.strip().isdigit()]


def main():
    pids = sys.argv[1:] or daftar_perkara()
    print("perkara diuji:", len(pids))
    sama = beda = galat = 0
    rincian = []
    for i in range(0, len(pids), 6):
        potong = pids[i : i + 6]
        bag = []
        for pid in potong:
            bag.append(
                "SELECT %s AS pid, IFNULL((%s), '(null)') AS lama, IFNULL((%s), '(null)') AS baru;"
                % (pid, LAMA.replace("#perkara_id#", pid).rstrip(";"), BARU.replace("#perkara_id#", pid).rstrip(";"))
            )
        o, e = srv_sql.srv("\n".join(bag))
        if "ERROR" in e or "ERROR" in o:
            galat += 1
            print("GALAT:", (e or o)[:300])
            continue
        for l in o.split("\n"):
            k = l.split("\t")
            if len(k) == 3 and k[0].isdigit():
                if k[1] == k[2]:
                    sama += 1
                else:
                    beda += 1
                    rincian.append(k)
    print({"sama": sama, "beda": beda, "galat_kelompok": galat})
    for pid, lama, baru in rincian:
        print(f"  {pid}: LAMA [{lama}]  ->  BARU [{baru}]")
    salah = [r for r in rincian if "..." not in r[1] or r[2].count("...") >= r[1].count("...")]
    print("perubahan yang BUKAN dari '...' menjadi terisi:", len(salah))


if __name__ == "__main__":
    main()
