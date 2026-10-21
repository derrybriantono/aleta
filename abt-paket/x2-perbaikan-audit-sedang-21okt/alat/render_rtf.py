# -*- coding: utf-8 -*-
"""Render blangko RTF asli (salinan lab ABT) memakai renderer php56 ABT asli. pakai: python render_rtf.py <label>
Hasil: out/<label>/rtf/<kode>-<perkara>.txt dan ringkasan.json (hitung '...' dan token sisa)."""
import json, os, re, sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, r'D:\Aplikasi\aleta\tmp\x2')
import rend

B = r'D:/Satker Asal/Website PA Bungku/xampp/htdocs/aps_badilag/_blangko_abt/'
label = sys.argv[1]
KELUAR = r'D:\Aplikasi\aleta\tmp\x2\out\%s\rtf' % label
os.makedirs(KELUAR, exist_ok=True)
S = json.load(open(r'D:\Aplikasi\aleta\tmp\x2\sampel.json'))

UJI = [
    ('bas2-calendar', 'derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)/[2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf',
     [7883, 5265, 9844, 5353, 9291, 10070, 9729]),
    ('bas-verstek2', 'berita_acara_sidang/BAS PA Donggala/BAS Verstek 2.rtf', [10070, 9729, 7883, 5740]),
    ('bas-verstek37a', 'berita_acara_sidang/BAS PA Donggala/37-a. BAS Putus P Hadir & T Tidak Hadir (verstek).PA.Dgl.rtf', [10070, 9729, 7883]),
    ('sampul-bundel-a', 'Fikrianto/Blangko/SAMPUL BUNDEL A DGL.rtf', [9844, 3366, 7194, 8634, 10070]),
    ('relaas-penggugat', 'BLANGKO_JURUSITA_DONGGALA/RELAAS/1.1 RELASS ECOURT PENGGUGAT - PEMOHON.rtf', [5740, 6754, 9729]),
    ('relaas-tergugat', 'BLANGKO_JURUSITA_DONGGALA/RELAAS/1.2 RELASS ECOURT TERGUGAT - TERMOHON.rtf', [5740, 6754, 7883]),
    ('pengangkatan-anak', 'gugatan_permohonan/Pendaftaran P/Pengangkatan Anak.rtf', [10070, 7883]),
    ('tussenkomst', 'berita_acara_sidang/2 BAS Lanjutan Standar/25-a. BAS Lanjutan - Putusan Sela Penggabungan Pihak Ketiga (Tussenkomst).rtf', [10070, 9729]),
    ('bas1-pkuasa', 'berita_acara_sidang/1 BAS Pertama Standar/01-b. BAS Pertama P (Kuasa) Tidak Hadir & T Hadir - Tunda Panggil PKuasanya .PA. Mj.rtf', [9729, 7883]),
    ('wali-adhal', 'berita_acara_sidang/3 BAS Putus Standar/42-a. BAS Putus Wali Adhal.rtf', [9729, 10070]),
    ('derry-in-kabul', 'derry_briantono/- BAS ITSTBAT NIKAH -/[01a] BAS 1 IN - Kabul.rtf', [10070, 9729, 7883]),
    ('derry-verstek-3saksi', 'derry_briantono/- BAS VERSTEK PERCERAIAN -/[09] (E-Court) BAS 2 P Hadir & T Tidak Hadir - Putusan Verstek - (3 Saksi).rtf', [10070, 9729, 7883]),
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
