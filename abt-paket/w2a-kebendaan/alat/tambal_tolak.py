# -*- coding: utf-8 -*-
"""Tambalan putusan TOLAK ([03], [03b]) folder 4a/4b/4c/4d/4e/10/10a: analisis bukti surat (dan kutipan keterangan saksi dari BAS) dari daftar bukti.
Pertimbangan tolak memakai isian alasan (9650, 9483, 9808, ...) yang tetap milik majelis; yang ditambahkan hanya uraian alat bukti agar
"tidak berhasil membuktikan" bersandar pada penilaian bukti yang tertulis. Tanpa daftar bukti dan tanpa BAS: keluaran kosong (bunyi lama)."""
from rtfkit import *

# folder -> (bukti P/T, kutipan saksi)
VARIABEL = {
    "4a": ("#4807#", "#4808#", "#4848#"),
    "4b": ("#4829#", "#4830#", "#4849#"),
    "4c": ("#4833#", "#4834#", ""),
    "4d": ("#4833#", "#4834#", ""),
    "4e": ("#4833#", "#4834#", ""),
    "10": ("#4833#", "#4834#", ""),
    "10a": ("#4833#", "#4834#", ""),
}


def tambal(kode, nama, d):
    b = "%s/%s" % (kode, nama[:40])
    p, t, s = VARIABEL[kode]
    if d.count("Menimbang, bahwa terhadap akta otentik") == 1:
        d = tambah_akhir(d, "Menimbang, bahwa terhadap akta otentik", p + t + s, b)
    else:
        d = tambah_akhir(d, "Menimbang, bahwa bukti-bukti surat yang diajukan #0046# telah bermeterai", p + s, b)
    seimbang(d, b)
    return d
