# -*- coding: utf-8 -*-
"""Memindai paket: (1) kata terlarang (nama aplikasi) di SQL, TSV (termasuk isi base64), RTF baru, RTF hasil tambal, nama berkas, metadata RTF;
(2) deretan angka sepanjang NIK/nomor rekening (>= 10 angka berurutan) di teks baru dan RTF hasil tambal.
pakai: python -B pindai_paket.py <folder paket> <folder hasil tambal (sesudah/derry_briantono)>"""
import base64
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtfpatch import Dok  # noqa: E402

PAKET = sys.argv[1].replace('\\', '/').rstrip('/') + '/'
SESUDAH = sys.argv[2].replace('\\', '/').rstrip('/') + '/'
KATA = re.compile(b'ale' + b'ta', re.I)
ANGKA = re.compile(rb'(?<![\d#])\d{10,}(?![\d#])')
temuan = []


def lapor(jenis, di, ket=''):
    temuan.append('%s\t%s\t%s' % (jenis, di, ket))


# nama berkas dan folder di seluruh paket, kecuali bayangan sumber (alat bantu laptop)
for akar, dirs, files in os.walk(PAKET):
    for n in dirs + files:
        if KATA.search(n.encode('utf8')):
            lapor('NAMA', os.path.join(akar, n))

SAT = PAKET + 'paket-satker/'
for n in sorted(os.listdir(SAT)):
    p = SAT + n
    if os.path.isdir(p):
        continue
    b = open(p, 'rb').read()
    if n.endswith('.sql') and KATA.search(b):
        lapor('SQL', n)
    if n.endswith('.tsv'):
        for i, l in enumerate(b.split(b'\n')):
            if KATA.search(l):
                lapor('TSV', n, 'baris %d' % (i + 1))
            if n == 'tambal.tsv' and l and not l.startswith(b'#'):
                kolom = l.split(b'\t')
                for k in kolom[2:4]:
                    d = base64.b64decode(k)
                    if KATA.search(d):
                        lapor('TAMBAL', n, 'baris %d' % (i + 1))
                    if ANGKA.search(d):
                        lapor('ANGKA', n, 'baris %d' % (i + 1))
    if n.endswith('.sh') and KATA.search(b):
        lapor('INFO-SKRIP', n, 'nama kontainer basis data (sama dengan paket pendahulu), bukan isi blangko')
for n in sorted(os.listdir(SAT + 'rtf-baru')):
    b = open(SAT + 'rtf-baru/' + n, 'rb').read()
    if KATA.search(b):
        lapor('RTF-BARU', n)
    if ANGKA.search(b):
        lapor('ANGKA', n)
    m = re.search(rb'\{\\info.*?\}\s*\}', b, re.S)
    if m and KATA.search(m.group(0)):
        lapor('METADATA', n)

jml = 0
for akar, dirs, files in os.walk(SESUDAH):
    for n in files:
        if not n.lower().endswith('.rtf'):
            continue
        jml += 1
        b = open(os.path.join(akar, n), 'rb').read()
        if KATA.search(b):
            lapor('RTF-SESUDAH', os.path.join(akar, n)[len(SESUDAH):])
        m = re.search(rb'\{\\info.*?\}\s*\}', b, re.S)
        if m and KATA.search(m.group(0)):
            lapor('METADATA', n)
        # teks yang tampak di dokumen saja (RTF memuat deretan angka biner/rsid yang bukan data orang)
        if re.search(r'(?<![\d#])\d{10,}(?![\d#])', Dok(b).T):
            lapor('ANGKA-TEKS', os.path.join(akar, n)[len(SESUDAH):])
print('RTF sesudah dipindai: %d; RTF baru: %d' % (jml, len(os.listdir(SAT + 'rtf-baru'))))
print('TEMUAN: %d' % len([t for t in temuan if not t.startswith('INFO-SKRIP')]))
for t in temuan:
    print(t)
