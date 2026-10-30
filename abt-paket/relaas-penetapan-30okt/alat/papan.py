# -*- coding: utf-8 -*-
"""Perbarui langkah RELAAS-PENETAPAN di papan kemajuan (baca-ubah-tulis JSON utuh).
pakai: python papan.py <persen> <menit> <status> "<catatan>" """
import json
import sys

P = 'D:/aleta-dev/kerja/kemajuan/rencana/56ed9ed9-d.json'
d = json.load(open(P, encoding='utf-8'))
ketemu = 0
for p in d['paket']:
    for t in p['tahap']:
        for l in t['langkah']:
            if l.get('id') == 'RELAAS-PENETAPAN':
                l['persen'] = int(sys.argv[1])
                l['menit'] = int(sys.argv[2])
                l['status'] = sys.argv[3]
                l['catatan'] = (l.get('catatan', '') + '; ' + sys.argv[4]).strip('; ')
                l['pelaku'] = 'agen RELAAS-PENETAPAN (w131)'
                l['model'] = 'Opus 5.5'
                ketemu += 1
assert ketemu == 1, ketemu
json.dump(d, open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('ok')
