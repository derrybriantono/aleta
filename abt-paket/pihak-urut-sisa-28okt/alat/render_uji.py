# -*- coding: utf-8 -*-
"""Render SEBELUM/SESUDAH paket pihak-urut-sisa-28okt memakai renderer php56 ABT asli (alat/rend.py + alat/render_siapkan.py).
pakai: python render_uji.py sebelum|sesudah
  sebelum = basis aps_badilag_ps0 (keadaan server sesudah paket 27 Okt); sesudah = basis aps_badilag_ps1 (paket 28 Okt terpasang).
Hasil teks per cetakan: D:/Aplikasi/aleta/tmp/w105/out/<label>/<kode>-<perkara>.txt (memuat data perkara; TIDAK masuk repo) + ringkasan.json."""
import json
import os
import subprocess
import sys

AL = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AL)
import rend  # noqa: E402

label = sys.argv[1]
sumber = {'sebelum': 'aps_badilag_ps0', 'sesudah': 'aps_badilag_ps1'}[label]
subprocess.run([sys.executable, os.path.join(AL, 'render_siapkan.py'), sumber], check=True)
KELUAR = r'D:\Aplikasi\aleta\tmp\w105\out\%s' % label
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
