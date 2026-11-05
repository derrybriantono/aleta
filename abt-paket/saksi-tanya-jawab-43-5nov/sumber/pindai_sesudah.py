# -*- coding: utf-8 -*-
"""Pemeriksaan ulang lepas dari pembangun, atas salinan terpasang: md5, teks tampak dan merah sama dengan sebelum paket, penanda bertambah hanya variabel tanya jawab yang berpasangan, kurung seimbang.
Lalu hitung ulang seluruh pohon: blangko bermuatan #9259#-#9267# yang masih kurang variabel tanya jawabnya.
pakai: python -B sumber/pindai_sesudah.py <akar pohon dasar> <akar sebelum paket> <akar sesudah> <paket-satker> <hasil.txt>"""
import collections
import hashlib
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'a5-merah-5nov', 'sumber'))
import rtfmini  # noqa: E402

PETA = {'9259': '2021', '9260': '2022', '9261': '2031', '9262': '8920', '9263': '8932', '9264': '2023', '9265': '2024', '9266': '2032', '9267': '8942'}


def v(b):
    return re.findall(rb'#(\d{4,5})#', b)


def seimbang(h):
    d = 0
    i = 0
    while i < len(h):
        if h[i] == 92:
            i += 2
            continue
        d += (h[i] == 123) - (h[i] == 125)
        if d < 0:
            return False
        i += 1
    return d == 0


def main():
    dasar, sebelum, sesudah, paket, hasil = sys.argv[1:6]
    gagal = []
    n = collections.Counter()
    dt = {}
    for l in open(os.path.join(paket, 'daftar-tambal.tsv'), encoding='utf-8'):
        if not l.startswith('#') and l.strip():
            x = l.rstrip('\n').split('\t')
            dt[x[1]] = x
    for rel, x in dt.items():
        b0 = open(os.path.join(sebelum, rel), 'rb').read()
        b1 = open(os.path.join(sesudah, rel), 'rb').read()
        if hashlib.md5(b0).hexdigest() != x[2] or hashlib.md5(b1).hexdigest() != x[3]:
            gagal.append('MD5 ' + rel)
        u0, u1 = rtfmini.urai(b0), rtfmini.urai(b1)
        if u0['paragraf'] != u1['paragraf'] or u0['merah'] != u1['merah']:
            gagal.append('TEKS BERUBAH ' + rel)
        tambah = collections.Counter(v(b1)) - collections.Counter(v(b0))
        hilang = collections.Counter(v(b0)) - collections.Counter(v(b1))
        if hilang or any(k.decode() not in PETA.values() or c != 1 for k, c in tambah.items()):
            gagal.append('PENANDA ' + rel)
        for k, c in tambah.items():
            nama = [a for a, z in PETA.items() if z == k.decode()][0]
            if nama.encode() not in v(b1):
                gagal.append('PASANGAN ' + rel)
        if not seimbang(b1):
            gagal.append('KURUNG ' + rel)
        if b1.lower().count(b'aleta') != b0.lower().count(b'aleta'):
            gagal.append('KATA NAMA APLIKASI ' + rel)
        n['berkas'] += 1
        n['penanda ditambah'] += sum(tambah.values())
    # seluruh pohon
    masih = collections.Counter()
    akar = os.path.join(dasar, 'derry_briantono')
    for dp, dn, fn in os.walk(akar):
        for f in fn:
            if not f.endswith('.rtf'):
                continue
            rel = os.path.relpath(os.path.join(dp, f), dasar).replace(os.sep, '/')
            if rel in dt:
                continue
            s = set(x.decode() for x in v(open(os.path.join(dp, f), 'rb').read()))
            if any(k in s and PETA[k] not in s for k in PETA):
                masih[rel] += 1
    with open(hasil, 'w', encoding='utf-8', newline='\n') as f:
        f.write('Pindai ulang lepas dari pembangun (rtfmini atas salinan terpasang).\n')
        for k in sorted(n):
            f.write('%s\t%d\n' % (k, n[k]))
        f.write('Berkas lain di pohon yang masih kurang variabel tanya jawab\t%d\n' % len(masih))
        f.write('GAGAL\t%d\n' % len(gagal))
        for l in gagal:
            f.write(l + '\n')
    print(open(hasil, encoding='utf-8').read())


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
