# -*- coding: utf-8 -*-
"""Render SEBELUM/SESUDAH paket x9 memakai renderer php56 ABT asli (alat/rend.py + alat/render_siapkan.py).
pakai: python render_uji.py sebelum|sesudah   (basis sumber aps_badilag_x9b = keadaan server, aps_badilag_x9 = paket terpasang)
Hasil teks per cetakan: D:/Aplikasi/aleta/tmp/x1/w39/out/<label>/<kode>-<perkara>.txt (memuat data perkara; TIDAK masuk repo) + ringkasan.json."""
import json, os, re, subprocess, sys
AL = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AL)
import rend

label = sys.argv[1]
sumber = {'sebelum': 'aps_badilag_x9b', 'sesudah': 'aps_badilag_x9'}[label]
subprocess.run([sys.executable, os.path.join(AL, 'render_siapkan.py'), sumber], check=True)
KELUAR = r'D:\Aplikasi\aleta\tmp\x1\w39\out\%s' % label
os.makedirs(KELUAR, exist_ok=True)
RTF = r'D:\Aplikasi\aleta\tmp\x1\w39\rtf'
HIBAH = '@' + RTF + r'\_01___Kabul__Hibah_-_Kontradiktoir.rtf'
ITSBAT = '@' + RTF + r'\_01a___Kabul__IN_-_Syahadah_Al_Istifadhah.rtf'
UJI = [
    ('p47', '#7047#', [10152, 10070, 7450, 8644, 5979, 6759, 9729, 9571]),
    ('p97', '#7097#', [10070, 8644, 5979, 6759, 9571]),
    ('t48', '#7048#', [10152, 10155, 6533, 6952, 7712, 10225, 9729]),
    ('t98', '#7098#', [10155, 6533, 6952, 7712, 9729]),
    ('u8710', '#8710#', [9233, 9528, 6326, 9729, 10225]),
    ('c62', '#7062#', [10152, 6759, 9729, 6952]),
    ('c107', '#7107#', [10152, 6759, 9729, 6952]),
    ('r-hibah', HIBAH, [10152, 6759, 6952, 9729]),
    ('r-itsbat', ITSBAT, [10070, 8644, 5979, 9571]),
]
ring = {}
SARING = sys.argv[2] if len(sys.argv) > 2 else ''
for kode, tpl, pids in UJI:
    if SARING and not kode.startswith(SARING):
        continue
    for pid in pids:
        t = rend.render(tpl, pid)
        open(os.path.join(KELUAR, '%s-%s.txt' % (kode, pid)), 'w', encoding='utf-8').write(t)
        ring['%s-%s' % (kode, pid)] = dict(panjang=len(t), titik3=t.count('...'), sebutan=len(re.findall(r'sebagai (?:<strong>)?(?:Pemohon|Penggugat|Termohon|Tergugat|Turut)', t)), sisa=sorted(set(re.findall(r'#\d{3,5}#', t))))
json.dump(ring, open(os.path.join(KELUAR, 'ringkasan%s.json' % SARING), 'w'), indent=0)
print(label, 'selesai', len(ring))
