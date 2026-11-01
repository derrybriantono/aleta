# -*- coding: utf-8 -*-
"""Bangun seluruh paket-satker paket ABT ke-30 perbaikan-1nov (1 Nov 2026).
pakai: python bangun_paket.py <basis ABT sesudah 29 paket> <akar _blangko_abt sesudah 29 paket>
(SQL variabel dari basis; potongan RTF dari akar; skrip pasang/pulih disalin dari sumber/; MD5SUMS terakhir)
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


def jalan(*a):
    r = subprocess.run([sys.executable] + list(a), capture_output=True)
    if r.returncode:
        sys.exit(r.stderr.decode('utf-8', 'replace')[-2000:])
    sys.stdout.write(r.stdout.decode('utf-8', 'replace'))


def main():
    basis, akar = sys.argv[1], sys.argv[2]
    os.makedirs(PK, exist_ok=True)
    jalan(os.path.join(SINI, 'bangun_variabel.py'), PK, basis)
    jalan(os.path.join(SINI, 'tulis_tsv.py'), basis)
    jalan(os.path.join(SINI, 'bangun_berkas.py'), akar, PK, HASIL)
    for f in ('pasang-satker.sh', 'pulih-satker.sh'):
        shutil.copyfile(os.path.join(SINI, f), os.path.join(PK, f))
    # tambal_rtf.py = salinan apa adanya dari paket tanya-jawab-format-1nov (tidak diubah)
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
