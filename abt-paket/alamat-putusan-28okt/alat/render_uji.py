# -*- coding: utf-8 -*-
"""Render SEBELUM/SESUDAH paket alamat-putusan-28okt memakai renderer php56 ABT asli (alat/rend.py + alat/render_siapkan.py).
  sebelum = basis DB_SEBELUM (bawaan aps_badilag_alamat_lama = keadaan server sesudah paket 27 Okt dan sisa 28 Okt); sesudah = DB_SESUDAH (bawaan aps_badilag_alamat = paket ini terpasang).
Yang dirender: (1) variabel putusan 7047 7048 8700 8890 (2) variabel relaas 9230 9231 7108 7109 9293 (HARUS sama persis) (3) satu blangko putusan Derry utuh dan satu relaas Derry utuh (salinan RTF server 26 Okt).
Teks per cetakan: D:/Aplikasi/aleta/tmp/w111/out/<label>/ (memuat data perkara; TIDAK masuk repo). Ringkasan (hanya hitungan): hasil/render-ringkasan.json.
pakai: python render_uji.py sebelum | sesudah | banding"""
import json
import os
import re
import subprocess
import sys

AL = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AL)
import rend  # noqa: E402

RTF = r'D:\Aplikasi\aleta\tmp\w82\rtf\derry_briantono'
OUT = r'D:\Aplikasi\aleta\tmp\w111\out'
# berkurung dan dibuang: 10187 (630/Pdt.G/2026, Tergugat), 10222, 10209, 10170 (Tergugat berkurung). berkurung dan DIPERTAHANKAN: 10176 ((BTN ...), kompleks). tanpa kurung: 9233, 6463.
PERKARA = [10187, 10222, 10209, 10170, 10176, 9233, 6463]
VARIABEL = [('putusan', '#7047#||#7048#||#8700#||#8890#'), ('relaas', '#9230#||#9231#||#7108#||#7109#||#9293#')]
BERKAS = [('putusan-cg', os.path.join(RTF, '1 Perceraian CG', '[02] [Kabul] CG - F.rtf')),
          ('relaas-js', os.path.join(RTF, '98 Relaas', '[JS] 0. Relaas Panggilan Sidang Pertama T.rtf'))]
label = sys.argv[1]


def jalankan(lbl):
    sumber = {'sebelum': os.environ.get('DB_SEBELUM', 'aps_badilag_alamat_lama'), 'sesudah': os.environ.get('DB_SESUDAH', 'aps_badilag_alamat')}[lbl]
    subprocess.run([sys.executable, os.path.join(AL, 'render_siapkan.py'), sumber], check=True)
    d = os.path.join(OUT, lbl)
    os.makedirs(d, exist_ok=True)
    for pid in PERKARA:
        for kode, tpl in VARIABEL:
            open(os.path.join(d, '%s-%s.txt' % (kode, pid)), 'w', encoding='utf-8').write(rend.render(tpl, pid))
        for kode, path in BERKAS:
            open(os.path.join(d, '%s-%s.txt' % (kode, pid)), 'w', encoding='utf-8').write(rend.render('@' + path, pid))
        print(lbl, pid, 'selesai', flush=True)


def baca(lbl, kode, pid):
    return open(os.path.join(OUT, lbl, '%s-%s.txt' % (kode, pid)), encoding='utf-8').read()


def kurung(t):
    return len(re.findall(r'\([^()]*\)', t))


if label in ('sebelum', 'sesudah'):
    jalankan(label)
else:
    ring = {}
    for pid in PERKARA:
        for kode in ['putusan', 'relaas', 'putusan-cg', 'relaas-js']:
            a, b = baca('sebelum', kode, pid), baca('sesudah', kode, pid)
            ring['%s-%s' % (kode, pid)] = dict(sama=a == b, kurung_sebelum=kurung(a), kurung_sesudah=kurung(b), galat=('ERROR' in a or 'ERROR' in b))
    for k, v in ring.items():
        print(k, v)
    json.dump(ring, open(os.path.join(AL, '..', 'hasil', 'render-ringkasan.json'), 'w'), indent=0)
