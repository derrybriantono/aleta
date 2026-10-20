# -*- coding: utf-8 -*-
"""Cek jangkar paragraf di semua blangko putusan keluarga anak: python anak_jangkar.py <awalan1> [<awalan2> ...]
Mencetak, per berkas, jumlah paragraf yang diawali tiap awalan (atau berisi bila diawali ~)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bangun import Dok  # noqa: E402

ASLI = os.environ.get('W2B_ASLI', 'D:/aleta-dev/kerja/w2b-asli-server')
FOLDER = os.environ.get('W2B_FOLDER', '6a Hak Asuh Anak (Hadhanah),6b Penguasaan Anak,6c Nafkah Anak').split(',')

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    for f in FOLDER:
        for b in sorted(os.listdir(os.path.join(ASLI, f))):
            if not b.endswith('.rtf'):
                continue
            d = Dok(os.path.join(ASLI, f, b))
            isi = [d.isi(i) for i in range(len(d.par))]
            hasil = []
            for a in sys.argv[1:]:
                if a.startswith('~'):
                    n = sum(1 for x in isi if a[1:] in x)
                else:
                    n = sum(1 for x in isi if x.startswith(a))
                hasil.append(str(n))
            print(f[:2], b[:70].ljust(70), ' '.join(hasil))
