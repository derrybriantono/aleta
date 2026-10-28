# -*- coding: utf-8 -*-
"""Render sampul berkas pihak banyak (blangko Derry yang memakai #5890#-#5893# dan #5847# #5896# #5897#) SEBELUM/SESUDAH paket romawi-pihak-28okt dengan renderer php56 ABT asli.
pakai: python render_sampul.py sebelum|sesudah   (sebelum = DB_SEBELUM, bawaan aps_badilag_rm0; sesudah = DB_SESUDAH, bawaan aps_badilag_rm2)
Hasil teks per cetakan ke D:/Aplikasi/aleta/tmp/w109/out/<label>/ (memuat data perkara; TIDAK masuk repo) + ringkasan.json (hitungan saja)."""
import json
import os
import subprocess
import sys

AL = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AL)
import rend  # noqa: E402

label = sys.argv[1]
sumber = {'sebelum': os.environ.get('DB_SEBELUM', 'aps_badilag_rm0'), 'sesudah': os.environ.get('DB_SESUDAH', 'aps_badilag_rm2')}[label]
subprocess.run([sys.executable, os.path.join(AL, 'render_siapkan.py'), sumber], check=True)
KELUAR = r'D:\Aplikasi\aleta\tmp\w109\out\%s' % label
os.makedirs(KELUAR, exist_ok=True)
RTF = os.path.join(AL, '..', '..', 'sampul-daftar-isi-26okt', 'rtf')
BLANGKO = {'pb': 'Sampul Berkas Perkara (Pihak Banyak).rtf', 'pmb': 'Sampul Berkas Perkara (Permohonan Pihak Banyak).rtf'}
# 10225 = 656/Pdt.G/2026 (Penggugat 1-25, Tergugat tunggal berurutan 25, Turut Tergugat 25-26); 9729 = 273/Pdt.G/2026 (Tergugat 14-19, Turut 19-25); 6326 = 26/Pdt.G/2022 (Tergugat 14-17);
# 7900 = 265/Pdt.G/2024 (Tergugat 2-11); 6463 = 149/Pdt.G/2022; 9528 = 142/Pdt.G/2026; 9291 = 687/Pdt.G/2025; 9571 = 81/Pdt.P/2026 (32 Pemohon, rapat); 9593 = 86/Pdt.P/2026 (Pemohon 1-5 tak rapat)
# kontrol rapat: 9233 = 635/Pdt.G/2025, 10176 = 620/Pdt.G/2026, 9520 = 60/Pdt.P/2026 (17 Pemohon), 7154 = 106/Pdt.G/2023 (9 Penggugat)
PERKARA = {'tak_rapat': [10225, 9729, 6326, 7900, 6463, 9528, 9291, 9593], 'kontrol_rapat': [9233, 10176, 9520, 7154, 9571]}
ring = {}
for kode, nama in BLANGKO.items():
    for grup, pids in PERKARA.items():
        for pid in pids:
            t = rend.render('@' + os.path.join(RTF, nama), pid)
            open(os.path.join(KELUAR, '%s-%s.txt' % (kode, pid)), 'w', encoding='utf-8').write(t)
            ring['%s-%s' % (kode, pid)] = dict(grup=grup, panjang=len(t), titik3=t.count('...'), kosong_tanda=t.count('#'))
    print(kode, 'selesai', flush=True)
json.dump(ring, open(os.path.join(KELUAR, 'ringkasan.json'), 'w'), indent=0)
print(label, 'selesai', len(ring))
