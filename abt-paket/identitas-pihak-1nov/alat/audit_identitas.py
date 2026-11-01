# -*- coding: utf-8 -*-
"""Audit paragraf identitas pihak di semua blangko derry_briantono (tanpa folder terhapus)."""
import os, re, sys
AKAR = sys.argv[1]
KELUAR = sys.argv[2]
VAR = r'7047|7048|3513|3507|7108|7109|9230|9231|11205|11206|3943|3944|11327'
MARK = re.compile(r'#(' + VAR + r'|0335|0336)#|tanggal lahir|tempat kediaman di|Tempat kediaman di')
PPR = re.compile(r'\\(q[jlcr])(?![a-z])|\\fi(-?\d+)|\\li(-?\d+)|\\lin(-?\d+)|\\(intbl)|\\ls(\d+)')
rows = []
for dp, dn, fn in os.walk(AKAR):
    dn[:] = [d for d in dn if d.lower() != 'terhapus']
    for f in fn:
        if not f.lower().endswith('.rtf'):
            continue
        p = os.path.join(dp, f)
        b = open(p, 'rb').read().decode('latin1')
        rel = os.path.relpath(p, AKAR).replace(chr(92), '/')
        seen = set()
        for m in MARK.finditer(b):
            k = b.rfind(chr(92) + 'pard', 0, m.start())
            if k < 0 or k in seen:
                continue
            seen.add(k)
            e = b.find('{', k)
            ppr = b[k:e]
            q = fi = li = lin = None
            intbl = False
            for mm in PPR.finditer(ppr):
                if mm.group(1):
                    q = mm.group(1)
                elif mm.group(2) is not None:
                    fi = int(mm.group(2))
                elif mm.group(3) is not None:
                    li = int(mm.group(3))
                elif mm.group(4) is not None:
                    lin = int(mm.group(4))
                elif mm.group(5):
                    intbl = True
            pe = b.find(chr(92) + 'par', k + 5)
            isi = b[k:pe if pe > 0 else k + 5000]
            penanda = sorted(set(re.findall(r'#(' + VAR + r')#', isi)))
            manual = ('tanggal lahir' in isi) or ('#0335#' in isi) or ('tempat kediaman di' in isi.lower())
            rows.append((rel, k, q, fi, li, lin, intbl, ','.join(penanda), manual))
with open(KELUAR, 'w', encoding='utf-8') as o:
    o.write('berkas\tpos\tq\tfi\tli\tlin\ttabel\tpenanda\tmanual\n')
    for r in rows:
        o.write('\t'.join(str(x) for x in r) + '\n')
print(len(rows), 'paragraf')
