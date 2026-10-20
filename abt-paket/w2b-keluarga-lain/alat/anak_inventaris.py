# -*- coding: utf-8 -*-
"""Inventaris blangko putusan keluarga anak: dump teks per berkas ke folder kerja dan daftar penanda + nama variabel.
Pakai: python anak_inventaris.py  (env W2B_ASLI, W2B_TXT)"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bangun import Dok  # noqa: E402

ASLI = os.environ.get('W2B_ASLI', 'D:/aleta-dev/kerja/w2b-asli-server')
TXT = os.environ.get('W2B_TXT', 'D:/aleta-dev/kerja/w2b-anak-server/txt')
FOLDER = ['6a Hak Asuh Anak (Hadhanah)', '6b Penguasaan Anak', '6c Nafkah Anak']
KAT = json.load(open('D:/Aplikasi/aleta/tmp/abt-variabel.json', encoding='utf-8'))

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    semua = {}
    for f in FOLDER:
        os.makedirs(os.path.join(TXT, f), exist_ok=True)
        for b in sorted(os.listdir(os.path.join(ASLI, f))):
            if not b.endswith('.rtf'):
                continue
            d = Dok(os.path.join(ASLI, f, b))
            baris = ['%d| %s' % (i, d.isi(i)) for i in range(len(d.par))]
            open(os.path.join(TXT, f, b[:-4] + '.txt'), 'w', encoding='utf-8').write('\n'.join(baris) + '\n')
            for k in set(re.findall(r'#(\d{4})#', d.raw)):
                semua.setdefault(k, set()).add(f[:2])
    for k in sorted(semua):
        e = KAT.get(k)
        nama = e['nama'] if e else '(TIDAK ADA DI KATALOG LOKAL)'
        print(k, ','.join(sorted(semua[k])), e['data_type'] if e else '-', nama[:120])
