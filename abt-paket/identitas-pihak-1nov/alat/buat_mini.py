# -*- coding: utf-8 -*-
"""Buat RTF mini (hanya paragraf #7047# / melawan / #7048#) dari blangko acuan, untuk uji cepat variabel identitas."""
import re
BS = chr(92)
SRC = 'D:/Aplikasi/aleta/tmp/w177/pohon29/derry_briantono/1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap).rtf'
b = open(SRC, 'rb').read().decode('latin1')
pos = [m.start() for m in re.finditer(re.escape(BS + 'pard'), b)]


def par_dengan(teks):
    i = b.find(teks)
    k = max(p for p in pos if p <= i)
    j = min(p for p in pos if p > i)
    return b[k:j]

p1 = par_dengan('#7047#')
pm = par_dengan('melawan}')
p2 = par_dengan('#7048#')
kepala = b[:pos[0]]
# hanya kepala sampai paragraf pertama dokumen
isi = kepala + p1 + pm + p2 + '}'
import os
os.makedirs('D:/Aplikasi/aleta/tmp/w177/uji/derry_briantono', exist_ok=True)
open('D:/Aplikasi/aleta/tmp/w177/uji/derry_briantono/mini-identitas.rtf', 'wb').write(isi.encode('latin1'))
print(len(isi))
