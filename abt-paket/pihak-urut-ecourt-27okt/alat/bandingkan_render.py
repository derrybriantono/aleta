# -*- coding: utf-8 -*-
"""Bandingkan teks render php56 sebelum/sesudah (D:/Aplikasi/aleta/tmp/w91/out/{sebelum,sesudah}) per cetakan.
Keluaran: berapa cetakan sama persis, berapa berbeda, daftar perbedaan. Berkas teks memuat data perkara dan TIDAK disimpan di repo;
hanya angka ringkasan yang ditulis ke hasil/render-ringkasan.json."""
import json
import os
import sys

BASE = r'D:\Aplikasi\aleta\tmp\w91\out'
a = os.path.join(BASE, 'sebelum')
b = os.path.join(BASE, 'sesudah')
nama = sorted(f for f in os.listdir(a) if f.endswith('.txt'))
sama, beda = [], []
for f in nama:
    ta = open(os.path.join(a, f), encoding='utf-8').read()
    tb = open(os.path.join(b, f), encoding='utf-8').read() if os.path.exists(os.path.join(b, f)) else None
    (sama if ta == tb else beda).append(f)
galat = [f for f in nama if 'ERROR' in open(os.path.join(a, f), encoding='utf-8').read() or 'ERROR' in open(os.path.join(b, f), encoding='utf-8').read()]
print('cetakan:', len(nama), 'sama persis:', len(sama), 'berbeda:', len(beda), 'galat ABT:', len(galat))
print('SAMA:', ' '.join(s[:-4] for s in sama))
print('BEDA:', ' '.join(s[:-4] for s in beda))
if len(sys.argv) > 1:
    json.dump(dict(cetakan=len(nama), sama=[s[:-4] for s in sama], beda=[s[:-4] for s in beda], galat=galat), open(sys.argv[1], 'w'), indent=1)
