# -*- coding: utf-8 -*-
"""Ringkas hasil bandingkan.js (JSON penuh di luar repo) menjadi hasil/bandingkan-ringkasan.json: tiap variabel - berapa perkara berubah, berapa di antaranya perkara berurutan rapat pada tabelnya,
berapa tanpa sebab yang dirancang (perkara rapat, kecuali 5896 untuk pihak > 20). Hanya nomor perkara_id dan hitungan (tanpa nama pihak).
pakai: python ringkas_bandingkan.py <bandingkan.json> <keluar.json>"""
import json
import subprocess
import sys

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
TABEL = {'5847': 3, '5890': 1, '5891': 1, '5892': 2, '5893': 2, '5896': 1, '5897': 4}


def q(sql):
    r = subprocess.run([MYSQL, '-uroot', '-N', 'sipp_donggala'], input=sql.encode(), capture_output=True, timeout=300)
    return [l.split('\t') for l in r.stdout.decode().replace(chr(13), '').strip().split(chr(10)) if l.strip()]


info = {}
for t in (1, 2, 3, 4):
    d = {}
    for pid, n, rapat in q("SELECT perkara_id, COUNT(*), (MIN(urutan)=1 AND MAX(urutan)=COUNT(*) AND COUNT(DISTINCT urutan)=COUNT(*)) FROM perkara_pihak%d GROUP BY perkara_id" % t):
        d[int(pid)] = (int(n), rapat == '1')
    info[t] = d
h = json.load(open(sys.argv[1]))
ring = {'total': h['total'], 'galat': len(h['galat']), 'per_variabel': {}, 'tak_rapat': {}}
for t in (1, 2, 4):
    ring['tak_rapat']['pihak%d' % t] = sum(1 for n, r in info[t].values() if not r)
for no, pids in sorted(h['beda'].items()):
    t = TABEL[no]
    rapat = [p for p in pids if info[t].get(p, (0, True))[1]]
    tanpa = []
    for p in pids:
        n, r = info[t].get(p, (0, True))
        sebab = (not r) or (no == '5896' and n > 20)
        if not sebab:
            tanpa.append(p)
    ring['per_variabel'][no] = {'beda': len(pids), 'beda_rapat': len(rapat), 'beda_tanpa_sebab': len(tanpa), 'perkara_id_beda': sorted(pids), 'sama': h['sama'][no]}
json.dump(ring, open(sys.argv[2], 'w'), indent=1)
print(json.dumps({k: (v if k != 'per_variabel' else {n: {a: b for a, b in x.items() if a != 'perkara_id_beda'} for n, x in v.items()}) for k, v in ring.items()}, indent=1))
