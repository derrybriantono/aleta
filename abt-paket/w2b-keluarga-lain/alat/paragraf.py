# -*- coding: utf-8 -*-
"""Pecah RTF blangko menjadi paragraf tingkat-atas (dipisah \\pard pada kedalaman kurung 1).
Dipakai sebagai pustaka (pecah) dan CLI: python paragraf.py <rtf> -> daftar paragraf (indeks, awalan format ringkas, teks)."""
import re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from rtf2txt import rtf_ke_teks


def pecah(raw):
    """Kembalikan (kepala, [paragraf...], ekor). Paragraf = potongan mentah mulai '\\pard' sampai sebelum '\\pard' berikut
    pada kedalaman 1 (badan dokumen). Kepala = sebelum \\pard pertama sesudah \\sectd; ekor = '}' penutup."""
    # badan mulai sesudah grup \footer/\header terakhir milik \sectd pertama
    i_sect = raw.find('\\sectd')
    depth = 0
    pos_pard = []
    i = 0
    n = len(raw)
    while i < n:
        c = raw[i]
        if c == '\\':
            if raw.startswith('\\pard', i) and depth == 1 and i > i_sect and not raw[i + 5:i + 6].isalpha():
                pos_pard.append(i)
            # lewati simbol kendali escape
            if i + 1 < n and raw[i + 1] in '\\{}':
                i += 2
                continue
            i += 1
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        i += 1
    if not pos_pard:
        return raw, [], ''
    kepala = raw[:pos_pard[0]]
    akhir = raw.rstrip()
    assert akhir.endswith('}')
    ekor_pos = len(akhir) - 1
    par = []
    for k, a in enumerate(pos_pard):
        b = pos_pard[k + 1] if k + 1 < len(pos_pard) else ekor_pos
        par.append(raw[a:b])
    return kepala, par, raw[ekor_pos:]


def awalan(p):
    j = p.find('{')
    return p[:j] if j > 0 else p[:200]


def teks(p):
    return rtf_ke_teks('{' + p + '}').replace('\n', ' / ').strip()


if __name__ == '__main__':
    raw = open(sys.argv[1], 'rb').read().decode('latin1')
    kep, par, ekor = pecah(raw)
    sys.stdout.reconfigure(encoding='utf-8')
    print('kepala', len(kep), 'paragraf', len(par))
    for i, p in enumerate(par):
        a = awalan(p)
        a = re.sub(r'\\tql \\tx\d+ ', '', a)
        a = re.sub(r'\\(rtlch|ltrch|dbch|hich|loch|widctlpar|itap0|lisb0|lisa0|plain|pard) ?', '', a)
        print('%3d [%s] %s' % (i, a.strip()[:110], teks(p)[:140]))
