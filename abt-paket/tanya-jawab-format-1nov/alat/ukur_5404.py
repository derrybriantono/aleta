# -*- coding: utf-8 -*-
"""Ukur 5404 lama vs baru atas SELURUH sidang lanjutan (urutan>=2) di SIPP lokal yang perkaranya pernah ganti hakim/panitera."""
import json, re, subprocess, sys, collections
sys.path.insert(0, 'D:/Aplikasi/aleta/tmp/w164/alat')
import uji5404
from uji5404 import jalan
import kueri_5404

LAMA = open('D:/Aplikasi/aleta/tmp/w164/q5404.sql', encoding='latin1').read().rstrip('\n')
BARU = kueri_5404.kueri()

o, e = jalan("""SELECT s.perkara_id, s.urutan, s.tanggal_sidang, p.tanggal_sidang, pr.jenis_perkara_nama, YEAR(pr.tanggal_pendaftaran)
FROM perkara_jadwal_sidang s
JOIN perkara_jadwal_sidang p ON p.perkara_id=s.perkara_id AND p.urutan=s.urutan-1
JOIN perkara pr ON pr.perkara_id=s.perkara_id
WHERE s.urutan>=2 AND s.tanggal_sidang>'2000-01-01' AND p.tanggal_sidang>'2000-01-01'
""")
baris = [l.split('\t') for l in o.split('\n') if l.strip()]
print('sidang lanjutan diukur:', len(baris))
hasil = []
UKUR = 120
for i in range(0, len(baris), UKUR):
    bag = baris[i:i + UKUR]
    s = []
    for pid, ur, tgl, prev, jenis, thn in bag:
        for tag, q in (('B', BARU), ('L', LAMA)):
            qq = q.replace('#perkara_id#', pid).replace('#0033#', tgl).replace('#6091#', prev).replace('#6034#', 'Panitera Pengganti')
            s.append("SELECT '%s|%s|%s|', IFNULL((%s),'(NULL)');" % (tag, pid, ur, qq.rstrip().rstrip(';')))
    o, e = jalan('\n'.join(s))
    if e.strip():
        print('GALAT', e[:300]); break
    for l in o.split('\n'):
        if l.startswith(('B|', 'L|')):
            hasil.append(l)
        elif hasil and l.strip():
            hasil[-1] += ' ' + l
print('baris hasil', len(hasil))
data = {}
for l in hasil:
    k, rest = l.split('\t', 1) if '\t' in l else (l, '')
    tag, pid, ur, _ = k.split('|')
    data[(tag, pid, ur)] = rest
json.dump({'|'.join(k): v for k, v in data.items()}, open('D:/Aplikasi/aleta/tmp/w164/stat5404.json', 'w'), ensure_ascii=False)
ubah = lambda t: t.startswith('Susunan majelis sidang sebelumnya')
tahun = {(r[0], r[1]): r[5] for r in baris}
c = collections.Counter()
for pid, ur, tgl, prev, jenis, thn in baris:
    b, l = data.get(('B', pid, ur), ''), data.get(('L', pid, ur), '')
    c[('baru-berganti' if ubah(b) else 'baru-sama', 'lama-berganti' if ubah(l) else 'lama-sama')] += 1
    if thn == '2026': c[('2026', 'baru-berganti' if ubah(b) else 'baru-sama', 'lama-berganti' if ubah(l) else 'lama-sama')] += 1
for k, v in sorted(c.items()): print(v, k)
