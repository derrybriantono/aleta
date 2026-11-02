# -*- coding: utf-8 -*-
"""Bangun seluruh paket-satker paket ABT ke-32 kaidah-fikih-2nov (2 Nov 2026).
pakai: python bangun_paket.py <akar _blangko_abt sesudah 31 paket>
(potongan RTF dari akar; skrip pasang/pulih disalin dari sumber/; tambal_rtf.py = salinan apa adanya paket perbaikan-1nov; MD5SUMS terakhir)
"""
import hashlib
import io
import os
import shutil
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
PK = os.path.abspath(os.path.join(SINI, '..', 'paket-satker'))
HASIL = os.path.abspath(os.path.join(SINI, '..', 'hasil'))


def main():
    akar = sys.argv[1]
    os.makedirs(PK, exist_ok=True)
    r = subprocess.run([sys.executable, os.path.join(SINI, 'bangun_berkas.py'), akar, PK, HASIL], capture_output=True)
    sys.stdout.write(r.stdout.decode('utf-8', 'replace'))
    if r.returncode:
        sys.exit(r.stderr.decode('utf-8', 'replace')[-3000:])
    for f in ('pasang-satker.sh', 'pulih-satker.sh'):
        with open(os.path.join(SINI, f), 'rb') as a, open(os.path.join(PK, f), 'wb') as b:
            b.write(a.read().replace(b'\r\n', b'\n'))
    baris = []
    for f in sorted(os.listdir(PK)):
        p = os.path.join(PK, f)
        if f == 'MD5SUMS.txt' or not os.path.isfile(p):
            continue
        baris.append('%s *%s' % (hashlib.md5(open(p, 'rb').read()).hexdigest(), f))
    with io.open(os.path.join(PK, 'MD5SUMS.txt'), 'w', encoding='utf-8', newline='\n') as o:
        o.write('\n'.join(baris) + '\n')
    print('MD5SUMS: %d berkas' % len(baris))


if __name__ == '__main__':
    main()
