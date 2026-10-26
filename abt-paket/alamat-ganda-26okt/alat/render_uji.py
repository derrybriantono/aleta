# -*- coding: utf-8 -*-
"""Render SEBELUM/SESUDAH paket alamat-ganda-26okt memakai renderer php56 ABT asli (alat/rend.py + alat/render_siapkan.py).
pakai: python render_uji.py sebelum|sesudah [awalan-kode]
  sebelum = basis aps_badilag_ag0 (keadaan server, x1-x11 terpasang) dan RTF asli; sesudah = basis aps_badilag_ag2 (paket terpasang) dan RTF yang sudah ditambal.
Hasil teks per cetakan: D:/Aplikasi/aleta/tmp/w82/out/<label>/<kode>-<perkara>.txt (memuat data perkara; TIDAK masuk repo) + ringkasan.json."""
import json
import os
import re
import subprocess
import sys

AL = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AL)
import rend  # noqa: E402

label = sys.argv[1]
SARING = sys.argv[2] if len(sys.argv) > 2 else ''
sumber = {'sebelum': 'aps_badilag_ag0', 'sesudah': 'aps_badilag_ag2'}[label]
subprocess.run([sys.executable, os.path.join(AL, 'render_siapkan.py'), sumber], check=True)
KELUAR = r'D:\Aplikasi\aleta\tmp\w82\out\%s' % label
os.makedirs(KELUAR, exist_ok=True)

# perkara: 10176 (620 CG, Penggugat dobel), 10222 (653 CG, dobel dua sisi), 10207 (648 CG, Tergugat dobel), 10212 (652 CG), 10221 (242 dispensasi), 10193 (634 CT),
#          9571 (32 Pemohon), 6326 (Tergugat dan Turut Tergugat banyak), 9729 (banyak pihak)
P_UMUM = [10176, 10222, 10207, 10212, 10193, 10221]
P_BANYAK = [9571, 6326, 9729, 7712]
UJI = [
    ('v7047', '#7047#', P_UMUM + P_BANYAK),
    ('v7048', '#7048#', P_UMUM + P_BANYAK),
    ('v7108', '#7108#', P_UMUM),
    ('v7109', '#7109#', P_UMUM),
    ('v9230', '#9230#', P_UMUM),
    ('v9231', '#9231#', P_UMUM),
    ('v8890', '#8890#', P_UMUM),
    ('v8700', '#8700#', P_UMUM),
    ('v9292', '#9292#', P_UMUM),
    ('v9293', '#9293#', P_UMUM),
    ('v8710', '#8710#', [6326, 9233, 9729, 9528]),
    ('v7054', '#7054#', [6326, 9233]),
    ('v9349', '#9349#', P_UMUM[:2]),
    ('v9350', '#9350#', P_UMUM[:2]),
    ('v10126', '#10126#', P_UMUM[:2]),
    ('v3943', '#3943#', P_UMUM[:3]),
    ('v3944', '#3944#', P_UMUM[:3]),
    ('v0101', '#0101#', P_UMUM),
    ('v0105', '#0105#', P_UMUM),
    ('v1036', '#1036#', P_BANYAK[:2]),
]
if label == 'sesudah':
    UJI += [('v3517', '#3517#', P_UMUM), ('v3518', '#3518#', P_UMUM), ('v3519', '#3519#', P_BANYAK[:2])]
RTF_SEBELUM = r'D:\Aplikasi\aleta\tmp\w82\rtf\derry_briantono'
RTF_SESUDAH = r'D:\Aplikasi\aleta\tmp\w82\blangko-lab\derry_briantono'
RTF_BASE = RTF_SEBELUM if label == 'sebelum' else RTF_SESUDAH
# beberapa blangko Derry yang ditambal (jalur relatif), dirender utuh pada dua perkara
RTF_PILIH = [
    ('r-ct-bas', '1a Perceraian CT - BAS', 2),
    ('r-dk', '3 Dispensasi Kawin', 2),
    ('r-relaas', '98 Relaas', 3),
]
ring = {}
for kode, tpl, pids in UJI:
    if SARING and not kode.startswith(SARING):
        continue
    for pid in pids:
        t = rend.render(tpl, pid)
        open(os.path.join(KELUAR, '%s-%s.txt' % (kode, pid)), 'w', encoding='utf-8').write(t)
        ring['%s-%s' % (kode, pid)] = dict(panjang=len(t), titik3=t.count('...'))
    print(kode, 'selesai', flush=True)
for kode, folder, n in RTF_PILIH:
    if SARING and not kode.startswith(SARING):
        continue
    dirp = os.path.join(RTF_BASE, folder)
    berkas = sorted(f for f in os.listdir(dirp) if f.lower().endswith('.rtf'))
    # hanya berkas yang menyebut penanda alamat
    pilih = []
    for f in berkas:
        t = open(os.path.join(dirp, f), 'rb').read().decode('latin1')
        if re.search(r'#(0101|0105|1036|3517|3518|3519)#', t):
            pilih.append(f)
    for f in pilih[:n]:
        for pid in (10176, 10207):
            t = rend.render('@' + os.path.join(dirp, f), pid)
            nama = '%s-%s-%s.txt' % (kode, re.sub(r'[^A-Za-z0-9]+', '_', f)[:40], pid)
            open(os.path.join(KELUAR, nama), 'w', encoding='utf-8').write(t)
            ring[nama] = dict(panjang=len(t), titik3=t.count('...'))
    print(kode, 'selesai', flush=True)
json.dump(ring, open(os.path.join(KELUAR, 'ringkasan%s.json' % SARING), 'w'), indent=0)
print(label, 'selesai', len(ring))
