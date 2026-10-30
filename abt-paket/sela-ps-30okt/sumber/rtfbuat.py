# -*- coding: utf-8 -*-
"""Perakit RTF blangko Derry dari paragraf CONTOH (gaya paragraf + gaya huruf diambil utuh dari blangko Derry yang ada).

Teks baru hanya ASCII (atau latin1) dengan markah kecil: <b>..</b> tebal, <i>..</i> miring, TAB = \\t.
Paragraf contoh = potongan mentah '\\pard ...{run teks}{run \\par }' hasil paragraf.pecah()."""
import re
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'alat'))
from paragraf import pecah  # noqa: E402

KENDALI = re.compile(r'\{((?:\\[A-Za-z]+-?\d*\s?)+)')


def baca(p):
    return open(p, 'rb').read().decode('latin1')


def gaya(par):
    """(pPr, kendali run pertama) dari satu paragraf contoh."""
    i = par.index('{')
    m = KENDALI.match(par, i)
    if not m:
        raise ValueError('run pertama tanpa kendali: %r' % par[:200])
    return par[:i], m.group(1).strip()


def esc(t):
    out = []
    for ch in t:
        o = ord(ch)
        if ch == '\\':
            out.append('\\\\')
        elif ch in '{}':
            out.append('\\' + ch)
        elif ch == '\t':
            out.append('\\tab ')
        elif o > 127:
            out.append("\\'%02x" % ch.encode('latin1')[0])
        else:
            out.append(ch)
    return ''.join(out)


def run(ktrl, teks):
    """Teks bermarkah -> deretan run RTF dengan kendali huruf yang sama."""
    hasil = []
    tebal = miring = False
    for bag in re.split(r'(</?[bi]>)', teks):
        if bag == '<b>':
            tebal = True
        elif bag == '</b>':
            tebal = False
        elif bag == '<i>':
            miring = True
        elif bag == '</i>':
            miring = False
        elif bag:
            k = ktrl + (' \\b1' if tebal else '') + (' \\i1' if miring else '')
            hasil.append('{' + k + ' ' + esc(bag) + '}')
    return ''.join(hasil)


def par(contoh, teks, ppr_ganti=None):
    """Paragraf baru bergaya `contoh`; ppr_ganti = (cari, ganti) untuk menyetel pPr (mis. buang inden baris pertama)."""
    ppr, ktrl = gaya(contoh)
    if ppr_ganti:
        for a, b in ppr_ganti:
            if a not in ppr:
                raise ValueError('pPr tidak memuat %r' % a)
            ppr = ppr.replace(a, b, 1)
    return ppr + run(ktrl, teks) + '{' + ktrl + ' \\par }'


def isian_asal(nomor):
    """Kelompok tersembunyi berisi penanda isian yang dipakai variabel lain (agar muncul di borang ABT), tidak tercetak."""
    if not nomor:
        return ''
    return '{\\*\\isianasal ' + ' '.join('#%04d#' % int(n) for n in nomor) + '}'


def rakit(kepala, paragraf, ekor, asal=()):
    isi = kepala + ''.join(paragraf)
    t = isian_asal(asal)
    return isi + t + ekor


def seimbang(r):
    d = 0
    i = 0
    while i < len(r):
        c = r[i]
        if c == '\\':
            i += 2
            continue
        if c == '{':
            d += 1
        elif c == '}':
            d -= 1
            if d < 0:
                return False
        i += 1
    return d == 0
