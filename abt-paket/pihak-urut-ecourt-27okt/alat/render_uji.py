# -*- coding: utf-8 -*-
"""Render SEBELUM/SESUDAH paket pihak-urut-ecourt-27okt memakai renderer php56 ABT asli (alat/rend.py + alat/render_siapkan.py).
pakai: python render_uji.py sebelum|sesudah [awalan-kode]
  sebelum = basis aps_badilag_pu0 (keadaan server, x1-x11 + alamat-ganda terpasang) dan RTF asli;
  sesudah = basis aps_badilag_pu3 (paket terpasang) dan RTF yang sudah ditambal.
Hasil teks per cetakan: D:/Aplikasi/aleta/tmp/w91/out/<label>/<kode>-<perkara>.txt (memuat data perkara; TIDAK masuk repo) + ringkasan.json."""
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
sumber = {'sebelum': 'aps_badilag_pu0', 'sesudah': 'aps_badilag_pu3'}[label]
subprocess.run([sys.executable, os.path.join(AL, 'render_siapkan.py'), sumber], check=True)
KELUAR = r'D:\Aplikasi\aleta\tmp\w91\out\%s' % label
os.makedirs(KELUAR, exist_ok=True)

# 10225 = 656/Pdt.G/2026 (Penggugat 25, Tergugat tunggal berurutan 25, Turut Tergugat urutan 25 dan 26); 9729 = 273/Pdt.G/2026 (Tergugat 14-19, Turut 19-25);
# 6326 = 26/Pdt.G/2022 (Tergugat 14-17, Turut 14-16); 9528 = 142/Pdt.G/2026 (Tergugat 2-6 tak rapat, Turut 2-6); 10155 = 602/Pdt.G/2026 (Tergugat 3-5, Turut 5);
# 9233 = 635/Pdt.G/2025 (Turut 6 rapat); 5326 = 275/Pdt.G/2020 (Tergugat tunggal berurutan 2); 9571 (32 Pemohon, rapat); 10176 = 620/Pdt.G/2026 (cerai, rapat)
NONRAPAT = [10225, 9729, 6326, 9528, 10155, 5326]
KONTROL = [9233, 9571, 10176, 10222, 10207, 6463]
UJI = [
    ('v7047', '#7047#', NONRAPAT + KONTROL),
    ('v7048', '#7048#', NONRAPAT + KONTROL),
    ('v7097', '#7097#', NONRAPAT + KONTROL),
    ('v7098', '#7098#', NONRAPAT + KONTROL),
    ('v7036', '#7036#', NONRAPAT + KONTROL),
    ('v7037', '#7037#', NONRAPAT + KONTROL),
    ('v7148', '#7148#', NONRAPAT + KONTROL),
    ('v7149', '#7149#', NONRAPAT + KONTROL),
    ('v7152', '#7152#', NONRAPAT + KONTROL),
    ('v8516', '#8516#', NONRAPAT + KONTROL),
    ('v8710', '#8710#', [10225, 9729, 6326, 9528, 10155, 9233]),
    ('k8502', '#8502#', [10225, 9729, 10176]),
    ('v8516b', '#8516#', [10143, 10070]),
    ('v3522', '#3522#', [10143, 10225, 10070, 9571, 9729]),
]
RTF_BASE = r'D:\Aplikasi\aleta\tmp\w91\rtf\derry_briantono' if label == 'sebelum' else r'D:\Aplikasi\aleta\tmp\w91\blangko-lab3\derry_briantono'
# blangko utuh (jalur relatif di folder derry_briantono)
RTF_PILIH = [
    ('r98kew', '4b Kewarisan/[98] [Cabut] Kewarisan - P & T Hadir Sebelum Jawaban.rtf', [10225, 9729, 9233]),
    ('r01kew', '4b Kewarisan/[01] [Kabul] Kewarisan - Kontradiktoir.rtf', [10225, 9729]),
    ('r98hb', '4a Harta Bersama/[98] [Cabut] Gugatan - P & T Hadir Sebelum Jawaban.rtf', [10225, 9528]),
    ('rbaskew', '4b Kewarisan - BAS/BAS ALUR 04 [1] BAS 1 P & T Hadir - Mediasi.rtf', [10225]),
    ('r01cg', '1 Perceraian CG/[01] [Kabul] Cerai Gugat - Kontradiktoir.rtf', [10176, 10222]),
    # kaki NO karena Penggugat/Pemohon hadir lalu tidak hadir lagi (SEMA 1/2022): kehadiran tetap "di luar hadirnya ..."
    ('rno4a', '1 Perceraian CG/[98] [NO] 4a. Cerai P Hadir Sidang Pertama Lalu 2x Tidak Hadir (SEMA 1 2022).rtf', [10143, 10176]),
    ('rno4', '1 Perceraian CG/[98] [NO] 4. Cerai P & T Tidak Hadir - Alamat T Tidak Diketahui.rtf', [10143]),
    ('rno99kew', '4b Kewarisan/[99] [NO] Kewarisan - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022).rtf', [10225, 9729]),
    ('rno9b', '9b Permohonan Umum/[99] [NO] Permohonan - Pemohon Tidak Hadir Lagi (SEMA 1 2022).rtf', [10070, 9571]),
    ('rno8', '1 Perceraian CG/[98] [NO] 8. Cerai P & T Hadir - Kontradiktoir - Cacat Formil Gugatan.rtf', [10143]),
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
for kode, rel, pids in RTF_PILIH:
    if SARING and not kode.startswith(SARING):
        continue
    p = os.path.join(RTF_BASE, *rel.split('/'))
    if not os.path.exists(p):
        # nama berkas tidak persis: cari yang diawali sama di folder itu
        d = os.path.dirname(p)
        awal = os.path.basename(p).split(']')[0]
        cand = sorted(f for f in os.listdir(d) if f.startswith(awal + ']'))
        assert cand, p
        p = os.path.join(d, cand[0])
    for pid in pids:
        t = rend.render('@' + p, pid)
        open(os.path.join(KELUAR, '%s-%s.txt' % (kode, pid)), 'w', encoding='utf-8').write(t)
        ring['%s-%s' % (kode, pid)] = dict(panjang=len(t), titik3=t.count('...'))
    print(kode, 'selesai', flush=True)
json.dump(ring, open(os.path.join(KELUAR, 'ringkasan%s.json' % SARING), 'w'), indent=0)
print(label, 'selesai', len(ring))
