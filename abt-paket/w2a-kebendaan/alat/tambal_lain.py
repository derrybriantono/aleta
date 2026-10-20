# -*- coding: utf-8 -*-
"""Tambalan blangko wasiat (4c), hibah (4d), wakaf (4e) dan ekonomi syariah (10, 10a): putusan kabul [01] [01a] [01b]."""
import re
from rtfkit import *

KEPUTUSAN = [4815, 4783, 4784, 4785]
KHUSUS_ES = [4842, 4843, 4844]
POKOK = {"4c": ("9484", "wasiat"), "4d": ("9800", "hibah"), "4e": ("9830", "wakaf")}


def _biaya(d, token, b):
    pola = re.compile(r"(\d+)(\.\\tab Menghukum #(?:7037|0047)# untuk membayar biaya perkara ini sejumlah Rp#8504#)")
    if len(pola.findall(d)) != 1:
        raise GagalTambal("%s: butir biaya perkara tidak unik" % b)
    return pola.sub(lambda m: token + m.group(2), d)


def _bukti(d, nama, b):
    ada_akta = d.count("Menimbang, bahwa terhadap akta otentik") == 1
    if ada_akta:
        return tambah_akhir(d, "Menimbang, bahwa terhadap akta otentik", "#4833##4834#", b)
    t = "#4833##4834#" if (nama.startswith("[01] ") and "ES Gugatan Sederhana" in nama) else "#4833#"
    return tambah_akhir(d, "Menimbang, bahwa bukti-bukti surat yang diajukan #0046# telah bermeterai", t, b)


def tambal(folder, nama, d):
    """folder: awalan nama folder ('4c', '4d', '4e', '10', '10a')."""
    b = "%s/%s" % (folder, nama[:40])
    verstek = nama.startswith("[01b]")
    es = folder in ("10", "10a")
    d = _bukti(d, nama, b)
    if es:
        d = tambah_akhir(d, "Menimbang, bahwa terhadap tuntutan pembayaran kewajiban", "#4835#", b)
        sebutan = "#0047#" if folder == "10" else "#7037#"
        gugat = "gugatan #0046#" if folder == "10" else "#0053# #0046#"
        if verstek:
            d = ganti_paragraf(d, "\\tab Mengabulkan %s untuk sebagian dengan verstek;" % gugat, "#4839#", b)
            d = tambah_akhir(d, "\\tab Menghukum %s untuk membayar kepada #0046# sisa kewajiban" % sebutan, "#4840#", b)
            d = hapus_paragraf(d, "\\tab Menolak %s selain dan selebihnya;" % gugat, b)
            d = _biaya(d, "#4841#", b)
        else:
            d = ganti_paragraf(d, "\\tab Mengabulkan %s untuk sebagian;" % gugat, "#4836#", b)
            d = tambah_akhir(d, "\\tab Menghukum %s untuk membayar kepada #0046# sisa kewajiban" % sebutan, "#4837#", b)
            d = hapus_paragraf(d, "\\tab Menolak %s selain dan selebihnya;" % gugat, b)
            d = _biaya(d, "#4838#", b)
        d = tambah_isianasal(d, KEPUTUSAN + KHUSUS_ES, b)
    else:
        token, kata = POKOK[folder]
        d = tambah_akhir(d, "sehingga dalil #0046# mengenai %s tersebut beralasan hukum" % kata, "#4835#", b)
        if verstek:
            d = ganti_paragraf(d, "\\tab Mengabulkan #0053# #0046# dengan verstek;", "#4839#", b)
            d = tambah_akhir(d, "\\tab #%s#;" % token, "#4840#", b)
            d = _biaya(d, "#4841#", b)
        else:
            d = ganti_paragraf(d, "\\tab Mengabulkan #0053# #0046#;", "#4836#", b)
            d = tambah_akhir(d, "\\tab #%s#;" % token, "#4837#", b)
            d = _biaya(d, "#4838#", b)
        d = tambah_isianasal(d, KEPUTUSAN, b)
    seimbang(d, b)
    return d
