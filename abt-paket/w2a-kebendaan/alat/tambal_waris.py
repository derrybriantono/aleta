# -*- coding: utf-8 -*-
"""Tambalan blangko folder '4b Kewarisan' (putusan kabul): [01b] verstek, [01a] T tidak hadir setelah mediasi, [01] kontradiktoir, [01c] pencabutan ditolak."""
import re
from rtfkit import *

ISIAN_W = [4815, 4816, 4817, 4818, 4819, 4783, 4784, 4785, 8717, 8718, 8719]
STRUKTUR = [9701, 9702, 9703, 9704, 9718, 9762, 9763, 9764, 9765, 9766, 9767]


def _nomor_biaya(d, token, b):
    pola = re.compile(r"(\d+)(\.\\tab Menghukum #7037# untuk membayar biaya perkara ini sejumlah Rp#8504#)")
    if len(pola.findall(d)) != 1:
        raise GagalTambal("%s: butir biaya perkara tidak unik" % b)
    return pola.sub(lambda m: token + m.group(2), d)


def tambal(nama, d):
    b = nama
    verstek = nama.startswith("[01b]")
    d = ganti_teks(d, "ahli waris sebagai berikut: #8717#;", "ahli waris sebagai berikut: #4820#;", 1, b)
    d = tambah_akhir(d, "Menimbang, bahwa terhadap harta peninggalan sebagaimana fakta angka 3", "#4822#", b)
    d = ganti_paragraf(d, "yang bersifat menghukum", "#4832##4823##4824#", b)
    if nama.startswith("[01b]") or nama.startswith("[01a]"):
        d = tambah_akhir(d, "Menimbang, bahwa bukti-bukti surat yang diajukan #0046# telah bermeterai", "#4829#", b)
    else:
        d = tambah_akhir(d, "Menimbang, bahwa terhadap akta otentik", "#4829##4830#", b)
    d = tambah_akhir(d, "Bahwa pewaris meninggalkan harta peninggalan", "#4831#", b)
    # amar
    if verstek:
        d = ganti_paragraf(d, "\\tab Menyatakan #7037# yang telah dipanggil", "#4825#", b)
        d = hapus_paragraf(d, "\\tab Mengabulkan #0053# #0046# untuk sebagian", b)
        token = "#4826#"
    else:
        d = ganti_paragraf(d, "\\tab Mengabulkan #0053# #0046# untuk sebagian", "#4827#", b)
        token = "#4828#"
    for a in ("\\tab Menetapkan #2026# #1025# telah meninggal dunia", "\\tab Menetapkan ahli waris dari", "\\tab Menetapkan harta peninggalan", "\\tab Menetapkan bagian masing-masing",
              "\\tab Menghukum #7037# untuk menyerahkan harta peninggalan", "\\tab Menolak #0053# #0046# selain dan selebihnya;"):
        d = hapus_paragraf(d, a, b)
    d = _nomor_biaya(d, token, b)
    d = tambah_isianasal(d, ISIAN_W + STRUKTUR, b)
    seimbang(d, b)
    return d
