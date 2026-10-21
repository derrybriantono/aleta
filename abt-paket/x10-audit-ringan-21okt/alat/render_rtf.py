# -*- coding: utf-8 -*-
"""Render blangko RTF asli (salinan lab ABT) memakai renderer php56 ABT asli. pakai: python render_rtf.py <label>
Hasil: out/<label>/rtf/<kode>-<perkara>.txt dan ringkasan.json (hitung '...' dan token sisa)."""
import json, os, re, sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, r'D:\Aplikasi\aleta\tmp\x10')
import rend

B = r'D:/Satker Asal/Website PA Bungku/xampp/htdocs/aps_badilag/_blangko_abt/'
label = sys.argv[1]
KELUAR = r'D:\Aplikasi\aleta\tmp\x10\out\%s\rtf' % label
os.makedirs(KELUAR, exist_ok=True)
S = json.load(open(r'D:\Aplikasi\aleta\tmp\x10\sampel.json'))

UJI = [
    ('derry-in-kabul', 'derry_briantono/- BAS ITSTBAT NIKAH -/[01a] BAS 1 IN - Kabul.rtf', [10070, 9729, 7883, 5740]),
    ('derry-in-syahadah', 'derry_briantono/- BAS ITSTBAT NIKAH -/[01ab] BAS 1 IN - Kabul Syahadah Istifadhah.rtf', [10070, 7883]),
    ('derry-bas6-4saksi', 'derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan Dirjen 1465 - (4 Saksi).rtf', [9729, 7883, 10070]),
    ('derry-gugur', 'derry_briantono/1 Perceraian CG/[98] [Gugur] 3a. Cerai P Tidak Hadir & T Hadir.rtf', [9729, 7883, 5740]),
    ('derry-alamat-tidak-jelas', 'derry_briantono/- BAS CONTRA PERCERAIAN -/[99] BAS 1 P Hadir & T Tidak Hadir - Alamat Tidak Jelas Atau Luar Batas Antar.rtf', [9729, 7883, 6754]),
    ('sampul-berkas-a', 'blangko_lainnya/Sampul Berkas A (1 Pemohon).rtf', [10070, 9729]),
    ('penetapan-in-2p', 'blangko_lainnya/Sidang Keliling Blangko Lama/Penetapan - IN 2P (Hakim Tunggal).rtf', [10070, 7883]),
    ('penunjukan-jsjsp', '_formulir_kepaniteraan/A.3 Penunjukan JS-JSP/A.3.b. Perubahan Js-JsP.rtf', [5740, 6754, 9729]),
    ('penunjukan-pp', '_formulir_kepaniteraan/A.2 Penunjukan PP/A.2.b. Perubahan Penunjukan PP.rtf', [9844, 7194, 9729]),
    ('bas-setempat', 'berita_acara_sidang/2 BAS Lanjutan Standar/23-b. BAS Lanjutan P _ T Hadir, Pembuktian T - Tunda Pemeriksaan Setempat.PA.Mj.rtf', [9729, 7883]),
]
tugas = []
for kode, rel, pids in UJI:
    if os.environ.get('KODE') and not re.search(os.environ['KODE'], kode):
        continue
    p = B + rel
    if not os.path.exists(p):
        print('TIDAK ADA', rel)
        continue
    for pid in pids:
        tugas.append((kode, p, pid))


def kerja(a):
    i, (kode, p, pid) = a
    t = rend.render('@' + p, pid, '', w='_r%d' % (i % 4))
    open(os.path.join(KELUAR, '%s-%s.txt' % (kode, pid)), 'w', encoding='utf-8').write(t)
    return '%s-%s' % (kode, pid), dict(panjang=len(t), titik3=t.count('...'), sisa=sorted(set(re.findall(r'#\d{3,5}#', t))), galat='ERROR Variabel' in t)


ring = {}
with ThreadPoolExecutor(max_workers=3) as ex:
    for k, v in ex.map(kerja, list(enumerate(tugas))):
        ring[k] = v
_f = os.path.join(KELUAR, 'ringkasan.json')
if os.path.exists(_f):
    _lama = json.load(open(_f))
    _lama.update(ring)
    ring = _lama
json.dump(ring, open(_f, 'w'), indent=0)
print(label, 'selesai', len(ring), 'galat:', [k for k, v in ring.items() if v['galat']])
