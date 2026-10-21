# -*- coding: utf-8 -*-
"""Render sebelum/sesudah paket x1 memakai renderer php56 ABT asli. pakai: python render_uji.py <label>
Hasil: D:/Aplikasi/aleta/tmp/x1/out/<label>/<kode>-<perkara>.txt dan ringkasan.json"""
import json, os, re, sys
sys.path.insert(0, r'D:\Aplikasi\aleta\tmp\x1')
import rend

label = sys.argv[1]
KELUAR = r'D:\Aplikasi\aleta\tmp\x1\out\%s' % label
os.makedirs(KELUAR, exist_ok=True)
RTF = r'D:\Aplikasi\aleta\tmp\x1\rtf\\'

UJI = [
    # (kode, templat, [perkara])
    ('i62', '#7062#', [10070, 9729, 10155, 7472, 9233, 10152, 6326]),
    ('i107', '#7107#', [10070, 9729, 10155, 7472, 10152]),
    ('i97', '#7097#', [10070, 9729]),
    ('i98', '#7098#', [10155, 9729, 10152]),
    ('i48', '#7048#', [10155, 9729, 10152]),
    ('i47', '#7047#', [10070, 9729, 10152]),
    ('i54', '#7054#', [10155, 10152]),
    ('i55', '#7055#', [7472, 9233, 10155, 6326]),
    ('b1', '[8087: #8087#] [9023: #9023#] [10113: #10113#]', [10218, 10217, 9747]),
    ('b3', '[8013: #8013#] [237: #0237#] [8129: #8129#] [5510: #5510#]', [10152, 10155, 10191, 9622, 10070]),
    ('r-kewarisan', '@' + RTF + 'Kewarisan__NO_.rtf', [10152]),
    ('r-akta', '@' + RTF + 'Akta_Perdamaian.rtf', [10152]),
    ('r-cgabis', '@' + RTF + 'Cerai_Gugur_-_Habis_Biaya__umum_.rtf', [10152]),
    ('r-dk', '@' + RTF + 'DK_Perempuan_versi_2023.rtf', [9622, 10191]),
    ('r-in', '@' + RTF + 'Penetapan_-_IN_2P__Hakim_Tunggal_.rtf', [10218]),
]
ring = {}
for kode, tpl, pids in UJI:
    for pid in pids:
        t = rend.render(tpl, pid)
        open(os.path.join(KELUAR, '%s-%s.txt' % (kode, pid)), 'w', encoding='utf-8').write(t)
        ring['%s-%s' % (kode, pid)] = dict(panjang=len(t), titik3=t.count('...'), sisa=sorted(set(re.findall(r'#\d{3,5}#', t))))
json.dump(ring, open(os.path.join(KELUAR, 'ringkasan.json'), 'w'), indent=0)
print(label, 'selesai', len(ring))
