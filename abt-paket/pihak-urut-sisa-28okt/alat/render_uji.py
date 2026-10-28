# -*- coding: utf-8 -*-
"""Render SEBELUM/SESUDAH paket pihak-urut-sisa-28okt memakai renderer php56 ABT asli (alat/rend.py + alat/render_siapkan.py).
pakai: python render_uji.py sebelum|sesudah
  sebelum = basis DB_SEBELUM (bawaan aps_badilag_ps0 = keadaan server sesudah paket 27 Okt); sesudah = basis DB_SESUDAH (bawaan aps_badilag_ps1 = paket 28 Okt terpasang).
Hasil teks per cetakan: D:/Aplikasi/aleta/tmp/w108/out/<label>/<kode>-<perkara>.txt (memuat data perkara; TIDAK masuk repo) + ringkasan.json."""
import json
import os
import subprocess
import sys

AL = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AL)
import rend  # noqa: E402

label = sys.argv[1]
sumber = {'sebelum': os.environ.get('DB_SEBELUM', 'aps_badilag_ps0'), 'sesudah': os.environ.get('DB_SESUDAH', 'aps_badilag_ps1')}[label]
subprocess.run([sys.executable, os.path.join(AL, 'render_siapkan.py'), sumber], check=True)
KELUAR = r'D:\Aplikasi\aleta\tmp\w108\out\%s' % label
os.makedirs(KELUAR, exist_ok=True)

# Perkara e-Court berpihak banyak yang urutannya bersambung (Tergugat pertama bukan berurutan 1): 10225 = 656/Pdt.G/2026 (Tergugat tunggal berurutan 25, Turut 25-26),
# 9729 = 273/Pdt.G/2026 (Tergugat 14-19), 6326 = 26/Pdt.G/2022, 9528 = 142/Pdt.G/2026 (Tergugat 2-6), 10155 = 602/Pdt.G/2026 (Tergugat 3-5), 5326 = 275/Pdt.G/2020 (Tergugat berurutan 2).
# Kontrol berurutan rapat: 9233 = 635/Pdt.G/2025, 9571 (32 Pemohon), 10176 = 620/Pdt.G/2026 (cerai), 10222, 10207, 6463.
NONRAPAT = [10225, 9729, 6326, 9528, 10155, 5326]
KONTROL = [9233, 10176, 6463]
SEMUA = NONRAPAT + KONTROL
UJI = [
    # kelompok yang diminta: Nth pihak (Penggugat III-V, Tergugat II-V)
    ('v3111', '#3111#|#3121#|#3131#', SEMUA),
    ('v5078', '#5078#|#5083#|#5091#|#5099#|#5081#|#5088#', SEMUA),
    ('v3112', '#3112#|#3113#|#3122#|#3123#|#3127#', SEMUA),
    # pihak pertama
    ('v8800', '#8800#|#8801#|#8802#|#8803#', SEMUA),
    ('v8808', '#8808#|#8809#|#8810#|#8811#', SEMUA),
    ('v8510', '#8510#|#8524#|#8533#', SEMUA),
    ('v8890', '#8890#', SEMUA),
    ('v9104', '#9104#|#9200#|#9205#', SEMUA),
    ('v9277', '#9277#|#9278#|#9279#|#9560#|#9561#|#9562#', SEMUA),
    ('v8129', '#8129#|#4440#|#3642#|#3643#|#5116#|#7078#|#3673#', SEMUA),
    ('v9404', '#9404#|#9405#', SEMUA),
    ('v10106', '#10106#|#10107#', SEMUA),
    # 28 Okt (izin pengguna): variabel bawaan ABT yang ikut diubah
    ('v10', '#10#|#11#|#20#|#21#|#24#|#27#|#45#', SEMUA),
    ('v99', '#99#|#100#|#103#|#104#|#118#|#120#', SEMUA),
    ('v335', '#335#|#336#|#337#|#341#|#342#|#343#|#345#|#346#|#347#', SEMUA),
    ('v1033', '#1033#|#1034#|#1035#|#1076#|#1077#|#1173#|#1174#|#1176#|#1517#|#1518#|#2173#', SEMUA),
    ('v5019', '#5019#|#5027#|#5028#|#5842#|#7000#|#7003#|#7004#|#8175#|#8179#|#8180#', SEMUA),
    # 7078: Pemohon/Penggugat lebih dari satu -> "I,". 604 (3 Pemohon), 1356 (2), 6779 (2 Penggugat), 1191 dan 8248 (1), 7900 (2, e-Court), 9571 (32, e-Court)
    ('v7078', '#7078#', [604, 1356, 6779, 1191, 8248, 7900, 9571]),
]
ring = {}
for kode, tpl, pids in UJI:
    for pid in pids:
        t = rend.render(tpl, pid)
        open(os.path.join(KELUAR, '%s-%s.txt' % (kode, pid)), 'w', encoding='utf-8').write(t)
        ring['%s-%s' % (kode, pid)] = dict(panjang=len(t), titik3=t.count('...'))
    print(kode, 'selesai', flush=True)
json.dump(ring, open(os.path.join(KELUAR, 'ringkasan.json'), 'w'), indent=0)
print(label, 'selesai', len(ring))
