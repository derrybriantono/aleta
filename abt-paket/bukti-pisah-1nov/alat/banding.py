# -*- coding: utf-8 -*-
"""Banding teks tampak hasil render sebelum vs sesudah paket, dan pemeriksaan pola per keadaan."""
import difflib
import os
import re
import sys

R = 'D:/Aplikasi/aleta/tmp/w152/render'
KUNCI = ['b01', 'b02', 'b03', 'b04', 'b05', 'b06', 'p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07']


def baca(mode, kead, k):
    p = '%s/%s/%s/%s' % (R, mode, kead, k)
    if not os.path.exists(p):
        return None
    return [re.sub(r'\s+', ' ', l).strip() for l in open(p, encoding='utf-8').read().split('\n') if l.strip()]


def bedanya(a, b):
    return [l for l in difflib.unified_diff(a, b, lineterm='', n=0) if not l.startswith(('---', '+++', '@@'))]


if __name__ == '__main__':
    kead = sys.argv[1]
    for k in KUNCI:
        a, b = baca('sebelum', kead, k), baca('sesudah', kead, k)
        if a is None or b is None:
            print(k, 'BELUM ADA')
            continue
        d = bedanya(a, b)
        print('==', k, kead, 'sama' if not d else '%d baris beda' % len(d))
        if '-v' in sys.argv:
            for l in d[:int(os.environ.get('MAKS', '24'))]:
                print('   ', l[:330])
