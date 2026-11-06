# -*- coding: utf-8 -*-
"""Menampilkan selisih TEKS POLOS (paragraf) tiap berkas yang ditambal paket, dikelompokkan menurut bunyi selisih.
pakai: python -B bandingkan_teks.py <folder derry_briantono dasar> <folder paket-satker>   (menyusun ulang hasil tambal dari tambal.tsv)"""
import base64
import collections
import difflib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtfpatch import Dok, terapkan  # noqa: E402

DASAR = sys.argv[1].replace('\\', '/').rstrip('/') + '/'
SAT = sys.argv[2].replace('\\', '/').rstrip('/') + '/'
AWAL = 'derry_briantono/'


def tsv(nama):
    return [l.split('\t') for l in open(SAT + nama, 'rb').read().decode('utf-8').split('\n') if l and not l.startswith('#')]


per = collections.defaultdict(list)
for kode, off, lama, baru in tsv('tambal.tsv'):
    per[kode].append((int(off), int(off) + len(base64.b64decode(lama)), base64.b64decode(baru)))
kelompok = collections.OrderedDict()
for kode, rel, m0, m1, n in tsv('daftar-tambal.tsv'):
    lama = open(DASAR + rel[len(AWAL):], 'rb').read()
    baru = terapkan(lama, per[kode])
    a = Dok(lama).T.split('\n')
    b = Dok(baru).T.split('\n')
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            continue
        kunci = (tag, tuple(x[:700] for x in a[i1:i2]), tuple(x[:700] for x in b[j1:j2]))
        kelompok.setdefault(kunci, []).append(rel.split('/', 1)[1][:70])
for (tag, lama, baru), berkas in kelompok.items():
    print('=== %s  x%d berkas  (mis. %s)' % (tag, len(berkas), berkas[0]))
    for x in lama:
        print('  - ' + x.replace('\n', '<P>'))
    for x in baru:
        print('  + ' + x.replace('\n', '<P>'))
print('KELOMPOK', len(kelompok))
