# -*- coding: utf-8 -*-
"""Menggabungkan untuk-sesi-utama/peta-fakta-tambahan-*.json (K1, K2, W2a) ke aleta_bot/config/peta-fakta-variabel.json.
  python gabung_peta.py            -> tulis (idempoten)
  python gabung_peta.py --periksa  -> hanya laporkan
Aturan: satu kode hanya di satu fakta; 'tambahKode' menambah kode ke fakta yang SUDAH ada; 'fakta' menambah entri baru (tidak menimpa)."""
import glob, json, os, sys

AKAR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
PETA = os.path.join(AKAR, "aleta_bot", "config", "peta-fakta-variabel.json")
TAMBAHAN = sorted(glob.glob(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "untuk-sesi-utama", "peta-fakta-tambahan-*.json")))


def kode_dari(entri):
    return [(k if isinstance(k, str) else k["kode"]) for k in entri.get("kode", [])]


def main():
    mentah = open(PETA, encoding="utf-8", newline="").read()
    peta = json.loads(mentah)
    fakta = peta["fakta"]
    laporan = []
    for berkas in TAMBAHAN:
        t = json.load(open(berkas, encoding="utf-8"))
        for nama, kode in (t.get("tambahKode") or {}).items():
            assert nama in fakta, "%s: fakta %s belum ada untuk tambahKode" % (os.path.basename(berkas), nama)
            ada = kode_dari(fakta[nama])
            for k in kode:
                if k not in ada:
                    fakta[nama].setdefault("kode", []).append(k)
                    laporan.append("%s +%s" % (nama, k))
        for nama, entri in (t.get("fakta") or {}).items():
            if nama in fakta:
                continue
            fakta[nama] = entri
            laporan.append("fakta baru %s %s" % (nama, kode_dari(entri)))
    # satu kode satu fakta
    pemilik = {}
    for nama, e in fakta.items():
        for k in kode_dari(e):
            assert k not in pemilik or pemilik[k] == nama, "kode %s di dua fakta: %s dan %s" % (k, pemilik.get(k), nama)
            pemilik[k] = nama
    print("\n".join(laporan) or "tidak ada perubahan")
    if "--periksa" in sys.argv:
        return
    baru = json.dumps(peta, ensure_ascii=False, indent=2) + "\n"
    open(PETA, "w", encoding="utf-8", newline="").write(baru)


if __name__ == "__main__":
    main()
