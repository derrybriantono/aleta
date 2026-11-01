# -*- coding: utf-8 -*-
"""tampil.py <berkas relatif> [konteks_paragraf=1] : tampilkan paragraf identitas dengan properti dan teks, dan paragraf sekitar."""
import sys, re
sys.path.insert(0, 'D:/aleta-dev/wt/w177/abt-paket/tanya-jawab-format-1nov/sumber')
from rtf2txt import rtf_ke_teks
AKAR = sys.argv[3] if len(sys.argv) > 3 else 'D:/Aplikasi/aleta/tmp/w177/pohon29/derry_briantono/'
b = open(AKAR + sys.argv[1], 'rb').read().decode('latin1')
BS = chr(92)
ctx = int(sys.argv[2]) if len(sys.argv) > 2 else 1
pos = [m.start() for m in re.finditer(re.escape(BS + 'pard'), b)]
VAR = r'#(7047|7048|0335|0336)#|tanggal lahir'
tampil = set()
for m in re.finditer(VAR, b):
    k = max(i for i in range(len(pos)) if pos[i] <= m.start())
    for j in range(k - ctx, k + ctx + 1):
        tampil.add(j)
for j in sorted(tampil):
    if j < 0 or j >= len(pos):
        continue
    s = pos[j]
    e = b.find('{', s)
    ppr = b[s:e]
    pe = pos[j + 1] if j + 1 < len(pos) else len(b)
    t = rtf_ke_teks(b[s:pe]).strip().replace('\n', ' / ')
    kode = ' '.join(re.findall(r'\\(?:q[jlcr]|fi-?\d+|li-?\d+|ls\d+|intbl|b1)(?![a-z0-9])', ppr)) + (' [tebal]' if BS + 'b1' in b[s:pe] else '')
    print(j, kode, '|', t[:260])
