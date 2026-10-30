# -*- coding: utf-8 -*-
"""Susun tugas render (render.py) untuk contoh tiap blangko tambahan putaran 30 Okt: python tugas_31.py <keluar.tsv> <folder keluaran>"""
import glob
import os
import sys

AKAR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
R = os.path.join(AKAR, 'paket-satker', 'rtf', 'derry_briantono')
S = os.path.join(R, '97a Putusan Sela')
B = os.path.join(R, '97a Putusan Sela - BAS')
O = sys.argv[2]
t = []


def add(folder, awal, pid, sd, nama):
    g = [x for x in glob.glob(os.path.join(folder, '*.rtf')) if os.path.basename(x).startswith(awal)]
    assert len(g) == 1, (folder, awal, g)
    t.append((g[0].replace(os.sep, '/'), pid, sd, '%s/%s.txt' % (O, nama)))


for kode, pid, sd in (('[16]', 9806, 5), ('[17]', 9806, 5), ('[18]', 9215, 5), ('[20]', 8329, 4), ('[21]', 8329, 4), ('[22]', 8329, 4),
                      ('[24]', 9929, 4), ('[25]', 9929, 4), ('[26]', 9235, 5), ('[27]', 9215, 5), ('[28]', 9215, 5), ('[29]', 9235, 6),
                      ('[30]', 9215, 9), ('[31]', 10059, 4), ('[32]', 9291, 3), ('[33]', 9929, 3), ('[02]', 9929, 3), ('[13]', 9575, 2),
                      ('[15]', 9929, 3)):
    add(S, kode, pid, sd, 's%s-%d' % (kode.strip('[]'), pid))
for kode, pid, sd in (('BAS SELA [3] ', 9575, 3), ('BAS SELA [3a]', 9575, 3), ('BAS SELA [3a]', 9496, 1), ('BAS SELA [4] ', 9235, 7),
                      ('BAS SELA [4a]', 9235, 7), ('BAS SELA [5] ', 9215, 10), ('BAS SELA [5a]', 9215, 10), ('BAS SELA [6]', 10059, 5)):
    add(B, kode, pid, sd, 'b%s-%d' % (kode.split('[')[1].split(']')[0], pid))
add(os.path.join(R, '1 Perceraian CG - BAS'), 'BAS ALUR 04 [1e]', 9929, 1, 'm1e-9929')
add(os.path.join(R, '4b Kewarisan - BAS'), 'BAS ALUR 04 [1e]', 8329, 1, 'm1e-8329')
add(os.path.join(R, '99 PTSP'), '@ 4a', 9929, 1, 'p4a-9929')
add(os.path.join(R, '1 Perceraian CG - BAS'), 'BAS ALUR 04 [PS]', 9929, 4, 'ps-cg-9929')
add(os.path.join(AKAR, 'paket-satker', 'timpa', 'derry_briantono', '4a Harta Bersama - BAS'), 'BAS ALUR 30 HB - Sidang PS', 9235, 8, 'ps-hb-9235')
with open(sys.argv[1], 'w', encoding='utf-8') as f:
    for x in t:
        f.write('\t'.join(str(y) for y in x) + '\n')
print(len(t))
