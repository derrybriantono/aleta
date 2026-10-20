# -*- coding: utf-8 -*-
"""Cari token #NNNN# yang terpecah oleh kode RTF (tampak utuh di teks, tetapi tidak utuh di RTF mentah -> ABT tidak menggantinya).
python token_pecah.py <berkas.rtf|folder> ..."""
import os, re, sys
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtf2txt import rtf_ke_teks


def periksa(p):
    mentah = open(p, 'rb').read().decode('latin1')
    teks = rtf_ke_teks(mentah)
    a = Counter(re.findall(r'#\d{4}#', teks))
    b = Counter(re.findall(r'#\d{4}#', mentah))
    beda = {k: a[k] - b.get(k, 0) for k in a if a[k] > b.get(k, 0)}
    return beda


def main():
    berkas = []
    for x in sys.argv[1:]:
        if os.path.isdir(x):
            for akar, _, fs in os.walk(x):
                berkas += [os.path.join(akar, f) for f in fs if f.lower().endswith('.rtf')]
        else:
            berkas.append(x)
    for p in sorted(berkas):
        beda = periksa(p)
        if beda:
            print('PECAH', beda, p)


if __name__ == '__main__':
    main()
