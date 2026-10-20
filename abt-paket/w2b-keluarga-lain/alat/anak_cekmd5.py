# -*- coding: utf-8 -*-
"""Cocokkan md5 LAMA di daftar-timpa-anak.tsv dengan md5 berkas yang SEKARANG ada di server (BACA SAJA, ssh aleta md5sum).
Pakai: python anak_cekmd5.py   -> cetak berkas yang beda; kode keluar 1 bila ada yang beda."""
import os
import subprocess
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DASAR = '/var/www/html/aps_badilag/_blangko_abt/'

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    baris = [b.split('\t') for b in open(os.path.join(AKAR, 'daftar-timpa-anak.tsv'), encoding='utf-8').read().split('\n') if b and not b.startswith('#')]
    per_folder = {}
    for f, berkas, lama, baru, ket in baris:
        per_folder.setdefault(f, []).append((berkas, lama))
    beda = 0
    for f, daftar in per_folder.items():
        r = subprocess.run(['ssh', '-o', 'ConnectTimeout=25', 'aleta', "cd '%s%s' && md5sum *.rtf" % (DASAR, f)], capture_output=True, timeout=120)
        server = {}
        for x in r.stdout.decode('utf-8', 'replace').split('\n'):
            if x.strip():
                h, n = x.split(None, 1)
                server[n.strip().lstrip('*')] = h
        for berkas, lama in daftar:
            if server.get(berkas) != lama:
                beda += 1
                print('BEDA', f, berkas, 'server', server.get(berkas), 'daftar', lama)
    print('berkas diperiksa: %d, beda: %d' % (sum(len(v) for v in per_folder.values()), beda))
    sys.exit(1 if beda else 0)
