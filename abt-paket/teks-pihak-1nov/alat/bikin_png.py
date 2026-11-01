# -*- coding: utf-8 -*-
"""RTF hasil render -> PDF (Word) -> PNG halaman yang memuat teks cari. pakai: python bikin_png.py <daftar.tsv>
daftar.tsv: <rtf>\t<teks cari (dipisah |)>\t<nama png tanpa ekstensi>\t[halaman tambahan, mis. +1]
Satu proses Word untuk seluruh daftar (rtf_hal.ps1); PNG ke D:/Aplikasi/aleta/tmp/w155/render/png/."""
import os
import re
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
HAL = os.path.join(SINI, '..', '..', 'bukti-pisah-1nov', 'alat', 'rtf_hal.ps1')
PNG = os.path.join(SINI, '..', '..', 'jawab-replik-31okt', 'alat', 'pdf_ke_png.ps1')
KELUAR = 'D:/Aplikasi/aleta/tmp/w155/render/png'
os.makedirs(KELUAR, exist_ok=True)
PS = ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File']

daftar = [l.rstrip('\n').split('\t') for l in open(sys.argv[1], encoding='utf-8') if l.strip() and not l.startswith('#')]
for rtf, cari, nama, *extra in daftar:
    r = subprocess.run(PS + [HAL, cari, os.path.abspath(rtf)], capture_output=True)
    m = re.search(r'HAL (\d+) (\d+) ', r.stdout.decode('cp1252', 'replace'))
    if not m:
        print('GAGAL', rtf, r.stdout.decode('cp1252', 'replace')[-200:], r.stderr.decode('cp1252', 'replace')[-200:])
        continue
    hal, n = int(m.group(1)), int(m.group(2))
    if hal == 0:
        print('TEKS TIDAK DITEMUKAN', rtf, cari)
        hal = 1
    hal += int(extra[0]) if extra else 0
    hal = max(1, min(hal, n))
    out = os.path.join(KELUAR, nama + '.png')
    r2 = subprocess.run(PS + [PNG, os.path.abspath(rtf) + '.pdf', str(hal), os.path.abspath(out)], capture_output=True)
    print(nama, 'hal', hal, 'dari', n, r2.stdout.decode('cp1252', 'replace').strip()[-60:], flush=True)
