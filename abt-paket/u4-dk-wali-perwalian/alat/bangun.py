# -*- coding: utf-8 -*-
"""Pustaka penyusun blangko RTF Derry dari paragraf berkas dasar (paket u4-dk-wali-perwalian).

Pakai sebagai pustaka:
    from bangun import Dok
    d = Dok(path_rtf_dasar)         # d.par[i] = paragraf mentah ke-i (lihat paragraf.py)
    d.teks(i)                       # teks tampak paragraf i tanpa ganti baris
    d.ganti_teks(i, "teks baru")    # paragraf i dengan isi baru (gaya paragraf i dipertahankan, label daftar boleh diatur)
    d.rakit(daftar)                 # daftar = potongan mentah -> RTF utuh (kepala + potongan + ekor)

Aturan: teks baru ditulis sebagai teks RTF (karakter > 127 di-escape, TAB -> \\tab). Label daftar (\\listtext) bernomor
literal diatur lewat argumen `label`. Penanda #nnnn# ditulis utuh dalam satu rangkaian teks (tidak pernah dipecah kode RTF).
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paragraf as P  # noqa: E402
import rtf_peta as R  # noqa: E402


def esc(teks):
    out = []
    for ch in teks:
        o = ord(ch)
        if ch in '\\{}':
            out.append('\\' + ch)
        elif ch == '\t':
            out.append('\\tab ')
        elif ch == '\n':
            out.append('\\line ')
        elif o < 128:
            out.append(ch)
        else:
            try:
                b = ch.encode('cp1252')
                out.append("\\'%02x" % b[0])
            except UnicodeEncodeError:
                out.append('{\\uc1 \\u%d ?}' % (o if o < 32768 else o - 65536))
    return ''.join(out)


def _akhir_grup(p, mulai):
    """Indeks sesudah '}' penutup grup yang dibuka di p[mulai] == '{'."""
    d = 0
    i = mulai
    while i < len(p):
        c = p[i]
        if c == '\\':
            i += 2
            continue
        if c == '{':
            d += 1
        elif c == '}':
            d -= 1
            if d == 0:
                return i + 1
        i += 1
    raise ValueError('grup tidak seimbang')


def _grup_anak(p):
    """Daftar (awal, akhir) grup tingkat-1 di dalam paragraf (sesudah header kendali)."""
    hasil = []
    i = p.find('{')
    while 0 <= i < len(p):
        j = _akhir_grup(p, i)
        hasil.append((i, j))
        i = p.find('{', j)
    return hasil


class Dok:
    def __init__(self, path):
        self.raw = open(path, 'rb').read().decode('latin1')
        self.kepala, self.par, self.ekor = P.pecah(self.raw)

    def teks(self, i):
        return R.peta(self.par[i])[0].replace('\n', '').strip()

    def ganti_teks(self, i, teks, label=None):
        """Paragraf i dengan isi `teks` (satu rangkaian). label: teks label daftar baru (mis. '3.' atau '-'), None = tetap."""
        p = self.par[i]
        grup = _grup_anak(p)
        if not grup:
            raise ValueError('paragraf %d tanpa grup' % i)
        # grup terakhir = penutup \par ; grup pertama bertulisan = run teks (bukan listtext)
        akhir_par = p[grup[-1][0]:grup[-1][1]]
        bacaan = [(a, b) for (a, b) in grup[:-1] if not p[a:b].startswith('{\\listtext')]
        if not bacaan:
            raise ValueError('paragraf %d tanpa run teks' % i)
        a, b = bacaan[0]
        run = p[a:b]
        m = re.match(r'^\{((?:\\[a-zA-Z]+-?\d* ?)+)', run)
        ctrl = m.group(1)
        listtext = ''
        for (x, y) in grup[:-1]:
            if p[x:y].startswith('{\\listtext'):
                listtext = p[x:y]
        if listtext and label is not None:
            # ganti label literal sebelum \tab
            listtext = re.sub(r'(\\f\d+ )[^\\]*(\\(?:\'00)?\\?tab ?)', lambda mm: mm.group(1) + esc(label) + mm.group(2), listtext, count=1)
        awal = p[:grup[0][0]]
        return awal + listtext + '{' + ctrl + esc(teks) + '}' + akhir_par

    def rakit(self, potongan):
        return self.kepala + ''.join(potongan) + self.ekor


def simpan(path, isi):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'wb').write(isi.encode('latin1'))


def teks_rtf(isi):
    return R.peta(isi)[0]


def periksa_token(isi):
    """Token #nnnn# yang tampak utuh di teks tetapi terpecah di RTF mentah."""
    from collections import Counter
    a = Counter(re.findall(r'#\d{4}#', R.peta(isi)[0]))
    b = Counter(re.findall(r'#\d{4}#', isi))
    return {k: a[k] - b.get(k, 0) for k in a if a[k] > b.get(k, 0)}
