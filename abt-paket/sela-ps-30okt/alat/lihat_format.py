# -*- coding: utf-8 -*-
"""Tampilkan run bertanda tebal/miring/garis bawah dalam paragraf tertentu: python lihat_format.py <rtf> <indeks...>"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paragraf  # noqa: E402
import rtf2txt  # noqa: E402

raw = open(sys.argv[1], 'rb').read().decode('latin1')
k, ps, e = paragraf.pecah(raw)
for a in sys.argv[2:]:
    i = int(a)
    p = ps[i]
    print('==', i, rtf2txt.rtf_ke_teks(p).strip()[:120])
    for m in re.finditer(r'\{([^{}]*)\}', p):
        g = m.group(1)
        f = [x for x in ('\\b1', '\\b ', '\\i1', '\\i ', '\\ul ', '\\ul1', '\\caps') if x in g + ' ']
        t = rtf2txt.rtf_ke_teks('{' + g + '}').strip()
        if f and t:
            print('   ', f, repr(t[:100]))
