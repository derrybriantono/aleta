# -*- coding: utf-8 -*-
"""Tulis tabel Markdown untuk PASANG.md: (A) 12 berkas yang ditambal, (B) 31 berkas yang dilewati paket u2 + keadaan sekarang.
Pakai: python tulis_tabel.py <pohon-server> <paket-satker> <data> > tabel.md"""
import hashlib, os, sys

pohon, paket, data = [os.path.abspath(x) for x in sys.argv[1:4]]


def md5f(rel):
    p = os.path.join(pohon, rel)
    return hashlib.md5(open(p, 'rb').read()).hexdigest() if os.path.exists(p) else '(tidak ada)'


def pendek(rel):
    return rel.replace('Cerai ', '').replace(' P Hadir & T Tidak Hadir', ' P&TTH')


daftar = [l.rstrip('\n').split('\t') for l in open(os.path.join(paket, 'rtf-daftar-tambal.tsv'), encoding='utf-8') if l.strip()]
tidak = [l.rstrip('\n').split('\t') for l in open(os.path.join(data, 'tidak-ditambal.tsv'), encoding='utf-8') if l.strip()]

print('### A. Berkas yang DITAMBAL paket ini (%d)\n' % len(daftar))
print('| kode | folder / berkas | jangkar | penanda disisipkan | md5 server sebelum | md5 sesudah tambal | setara dengan |')
print('|---|---|---|---|---|---|---|')
pindah = [t for t in tidak if t[1] == 'DIPINDAH' and t[0] >= 'T005' and t[0] <= 'T054']
for k, rel, m0, m1, n in daftar:
    f, nm = rel.split('/', 1)
    kunci = 'ALUR %s %s' % (f.split(' ')[1], nm)
    setara = [t[0] for t in pindah if t[2].split('/', 1)[1][4:] == kunci]
    print('| %s | `%s` / `%s` | `#8505#` (1x) | `#4138#` sebelum `#8505#` | `%s` | `%s` | %s |' % (k, f, nm, m0, m1, ', '.join(setara) or '-'))

print('\n### B. 31 berkas yang dilewati paket u2 (baris LEWAT di tambal-hasil.txt)\n')
print('| kode u2 | jalur yang dicari paket u2 | keadaan di server | md5 pengganti sekarang |')
print('|---|---|---|---|')
for kd, st, rel, peng, ket in tidak:
    pg = peng.split(' ; ')[0] if peng and 'dan ALUR' not in peng else ''
    md = md5f(pg) if pg else (md5f(rel) if os.path.exists(os.path.join(pohon, rel)) else '-')
    print('| %s | `%s` | %s: %s | `%s` |' % (kd, rel, st, ket, md))
