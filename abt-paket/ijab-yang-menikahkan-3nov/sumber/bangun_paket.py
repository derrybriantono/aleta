# -*- coding: utf-8 -*-
"""Bangun paket ABT abt-ijab-yang-menikahkan-3nov (keputusan Derry 3 Nov 18.00, butir 3).

Fakta/pertimbangan penetapan Itsbat Nikah Kabul berbunyi "Wali Nikah #0046# II mengucapkan ijab ... sesaat setelah Wali Nikah
#0046# II mengucapkan ijab" - salah bila yang menikahkan bukan wali nasab (imam desa/penghulu/wakil wali). Bunyi baru menyebut
#8087# (Yang Menikahkan) "selaku yang menikahkan": benar bila #8087# = wali nasab itu sendiri maupun orang lain, dan sama dengan
katalog saksi BAS ("ijab diucapkan oleh #8087# ...").

pakai: python bangun_paket.py <akar _blangko_abt keadaan server> <folder paket-satker>
  Keadaan server 3 Nov 15.20 = cadangan 2 Nov 18.50 + paket saksi-rapi-3nov (tambal) + in-lupa-prosesi-3nov ([01f]).
Deterministik. Berhenti bila jumlah kemunculan per berkas tidak sesuai harapan atau kalimat lama masih tersisa di blangko mana pun.
"""
import base64
import glob
import hashlib
import io
import os
import sys

AKAR, PAKET = sys.argv[1], sys.argv[2]
F = "derry_briantono/2 Itsbat Nikah/"

GANTI = [
    # (lama, baru) - teks RTF mentah (latin-1), tanpa kode kendali di dalamnya (diperiksa: berturut-turut di kelima berkas)
    ("Wali Nikah #0046# II mengucapkan ijab dan #0046# I mengucapkan kabul sesaat setelah Wali Nikah #0046# II mengucapkan ijab tanpa ada jeda waktu terlalu lama",
     "#8087# selaku yang menikahkan mengucapkan ijab dan #0046# I mengucapkan kabul sesaat setelah ijab diucapkan tanpa ada jeda waktu terlalu lama"),
    ("fakta bahwa Wali Nikah #0046# II mengucapkan ijab dan #0046# I mengucapkan kabul sesaat setelah ijab diucapkan",
     "fakta bahwa #8087# selaku yang menikahkan mengucapkan ijab dan #0046# I mengucapkan kabul sesaat setelah ijab diucapkan"),
    ("Wali Nikah mempelai perempuan mengucapkan ijab dan mempelai laki-laki mengucapkan kabul sesaat setelah Wali Nikah mempelai perempuan mengucapkan ijab tanpa ada jeda waktu terlalu lama",
     "#8087# selaku yang menikahkan mengucapkan ijab dan mempelai laki-laki mengucapkan kabul sesaat setelah ijab diucapkan tanpa ada jeda waktu terlalu lama"),
    ("fakta bahwa Wali Nikah mempelai perempuan mengucapkan ijab dan mempelai laki-laki mengucapkan kabul sesaat setelah ijab diucapkan",
     "fakta bahwa #8087# selaku yang menikahkan mengucapkan ijab dan mempelai laki-laki mengucapkan kabul sesaat setelah ijab diucapkan"),
]
HARAP = {
    "[01] [Kabul] IN.rtf": 2,
    "[01a] [Kabul] IN - Syahadah Al Istifadhah.rtf": 1,
    "[01b] [Kabul] IN Itsbat Terpadu.rtf": 2,
    "[01d] [Kabul] IN - Format Lengkap Rukun dan Syarat per Unsur.rtf": 3,
    "[01e] [Kabul] IN - Satu Pemohon (Pasangan Meninggal, Voluntair).rtf": 3,
}
SISA = [b"mengucapkan ijab dan #0046# I mengucapkan kabul sesaat setelah Wali", b"Wali Nikah #0046# II mengucapkan ijab", b"Wali Nikah mempelai perempuan mengucapkan ijab"]


def md5b(b):
    return hashlib.md5(b).hexdigest()


daftar, tambal = [], []
for i, (nama, n) in enumerate(sorted(HARAP.items()), 1):
    rel = F + nama
    lama = open(os.path.join(AKAR, rel), "rb").read()
    pot = []
    for a, b in GANTI:
        aa, bb = a.encode("latin-1"), b.encode("latin-1")
        mulai = 0
        while True:
            k = lama.find(aa, mulai)
            if k < 0:
                break
            pot.append((k, aa, bb))
            mulai = k + len(aa)
    if len(pot) != n:
        sys.exit("BERHENTI: %s memuat %d kalimat, harap %d" % (rel, len(pot), n))
    baru = lama
    for k, aa, bb in sorted(pot, key=lambda x: -x[0]):
        baru = baru[:k] + bb + baru[k + len(aa):]
    if b"#8087#" not in lama:
        sys.exit("BERHENTI: %s tidak memuat #8087# (variabel harus sudah ada di tabel blangko)" % rel)
    kode = "I%03d" % i
    daftar.append("%s\t%s\t%s\t%s\t%d" % (kode, rel, md5b(lama), md5b(baru), len(pot)))
    for k, aa, bb in sorted(pot):
        tambal.append("%s\t%d\t%s\t%s" % (kode, k, base64.b64encode(aa).decode(), base64.b64encode(bb).decode()))
    for s in SISA:
        if s in baru:
            sys.exit("BERHENTI: kalimat lama tersisa di %s" % rel)

# Tidak ada blangko Derry lain yang memuat kalimat lama (selain lima berkas di atas)
for fn in glob.glob(os.path.join(AKAR, "derry_briantono", "**", "*.rtf"), recursive=True):
    rel = os.path.relpath(fn, AKAR).replace("\\", "/")
    if rel.startswith(F) and os.path.basename(rel) in HARAP:
        continue
    isi = open(fn, "rb").read()
    for s in SISA:
        if s in isi:
            sys.exit("BERHENTI: kalimat lama juga ada di %s - tambahkan ke HARAP" % rel)

with io.open(os.path.join(PAKET, "daftar-tambal.tsv"), "w", encoding="utf-8", newline="\n") as f:
    f.write(u"# kode\tberkas\tmd5_lama (server 3 Nov 15.20)\tmd5_baru\tpotongan\n" + u"\n".join(daftar) + u"\n")
with io.open(os.path.join(PAKET, "tambal.tsv"), "w", encoding="utf-8", newline="\n") as f:
    f.write(u"# kode\toffset\tb64(teks lama)\tb64(teks baru)\n" + u"\n".join(tambal) + u"\n")
print("\n".join(daftar))
print("TAMBAL %d potongan di %d berkas" % (len(tambal), len(daftar)))
