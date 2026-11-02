# -*- coding: utf-8 -*-
"""periksa_pdf.py <folder pdf> <daftar-pdf.txt> <keluar.tsv> : tiap halaman PDF (hasil Word atas blangko) harus berakhir dengan nomor halaman di kaki.
Baris keluaran: kode, berkas, jumlah halaman, halaman tanpa nomor (daftar), nomor yang terbaca (ringkas). Butuh pdftotext (poppler/mingw)."""
import os
import re
import subprocess
import sys

folder, daftar, keluar = sys.argv[1:4]
rows = []
for l in open(daftar, encoding='utf-8').read().split('\n'):
    if not l.strip():
        continue
    kode, p = l.split('\t')
    pdf = os.path.join(folder, kode + '.pdf')
    if not os.path.exists(pdf):
        rows.append((kode, p, 'TANPA PDF', '', ''))
        continue
    t = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True).stdout.decode('utf-8', 'replace')
    hal = t.split('\f')
    if hal and not hal[-1].strip():
        hal = hal[:-1]
    kosong, nomor = [], []
    for i, h in enumerate(hal, 1):
        baris = [x.strip() for x in h.split('\n') if x.strip()]
        akhir = baris[-5:] if baris else []
        # nomor halaman di kaki: baris yang hanya angka, atau angka di ujung baris yang sama dengan label kecil (mis. "SC Z 1x  2")
        m = [re.search(r'(\d{1,3})$', x).group(1) for x in akhir if re.fullmatch(r'(?:.{0,25}\s{2,})?\d{1,3}', x)]
        if m:
            nomor.append(m[-1])
        else:
            kosong.append(i)
            nomor.append('-')
    rows.append((kode, p.split(chr(92))[-1], str(len(hal)), ','.join(map(str, kosong)) or '-', ' '.join(nomor)))
with open(keluar, 'w', encoding='utf-8', newline='\n') as o:
    o.write('kode\tberkas\thalaman\thalaman tanpa nomor\tnomor terbaca per halaman\n')
    for r in rows:
        o.write('\t'.join(r) + '\n')
bad = [r for r in rows if r[3] != '-' or r[2] == 'TANPA PDF']
print('berkas %d, halaman bernomor semua %d, ada halaman tanpa nomor %d' % (len(rows), len(rows) - len(bad), len(bad)))
for r in bad[:20]:
    print(r)
