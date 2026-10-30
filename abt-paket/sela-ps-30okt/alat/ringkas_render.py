# -*- coding: utf-8 -*-
"""Tambah ringkasan render (tanpa isi/nama pihak) ke hasil/render-ringkasan.json: python ringkas_render.py <folder render> <putaran> <tugas.tsv>"""
import io
import json
import os
import re
import sys

SINI = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'hasil', 'render-ringkasan.json')
folder, putaran, tugas = sys.argv[1], sys.argv[2], sys.argv[3]
NOMOR = {'8329': '546/Pdt.G/2024', '9215': '620/Pdt.G/2025', '9235': '637/Pdt.G/2025', '9291': '687/Pdt.G/2025', '9496': '42/Pdt.P/2026',
         '9575': '167/Pdt.G/2026', '9806': '308/Pdt.G/2026', '9929': '419/Pdt.G/2026', '10059': '517/Pdt.G/2026', '8785': '376/Pdt.G/2025'}
data = json.load(io.open(SINI, encoding='utf-8'))
data = [x for x in data if x.get('putaran') != putaran]
for baris in io.open(tugas, encoding='utf-8'):
    rtf, pid, sd, keluar = baris.rstrip('\n').split('\t')
    t = io.open(keluar, encoding='utf-8').read()
    data.append(dict(putaran=putaran, blangko=os.path.basename(rtf), perkara=NOMOR.get(pid, pid), sidang=int(sd), baris=t.count('\n') + 1,
                     sisa_penanda=len(re.findall(r'#\d{4,5}#', t)), isian_kosong=t.count('...')))
io.open(SINI, 'w', encoding='utf-8', newline='\n').write(json.dumps(data, ensure_ascii=False, indent=1) + '\n')
print(len(data))
