# -*- coding: utf-8 -*-
"""Tugas render (render.py) contoh tiap tambahan putaran 3: python tugas_32.py <keluar.tsv> <folder keluaran>"""
import glob
import os
import sys

AKAR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
R = os.path.join(AKAR, 'paket-satker', 'rtf', 'derry_briantono')
O = sys.argv[2]
t = []


def add(folder, awal, pid, sd, nama):
    g = [x for x in glob.glob(os.path.join(R, folder, '*.rtf')) if os.path.basename(x).startswith(awal)]
    assert len(g) == 1, (folder, awal, g)
    t.append((g[0].replace(os.sep, '/'), pid, sd, '%s/%s.txt' % (O, nama)))


S = '97a Putusan Sela'
add(S, '[34]', 10059, 5, 's34-10059')
add(S, '[35]', 10059, 5, 's35-10059')
add(S, '[36]', 9806, 5, 's36-9806')
add(S, '[37]', 9806, 5, 's37-9806')
add(S, '[32]', 9291, 3, 's32-9291')
add('1a Perceraian CT', '[97] [Lian]', 10059, 6, 'lian-ct-10059')
add('1 Perceraian CG', '[97] [Lian]', 9929, 5, 'lian-cg-9929')
add('1 Perceraian CG - BAS', 'BAS ALUR 04 [1e]', 9929, 1, 'm04-9929')
add('1 Perceraian CG - BAS', 'BAS ALUR 05 [1e]', 9929, 1, 'm05-9929')
add('5 Izin Poligami - BAS', 'BAS ALUR 34 Poligami - Sidang 1', 8785, 1, 'm34-8785')
add('1c Perceraian Kumulasi Itsbat Nikah - BAS', 'BAS ALUR 36', 9929, 1, 'm36-9929')
add('1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak - BAS', 'BAS ALUR 37', 9929, 1, 'm37-9929')
add('99 PTSP', '@ 4a', 9929, 1, 'p4a-9929')
with open(sys.argv[1], 'w', encoding='utf-8') as f:
    for x in t:
        f.write('\t'.join(str(y) for y in x) + '\n')
print(len(t))
