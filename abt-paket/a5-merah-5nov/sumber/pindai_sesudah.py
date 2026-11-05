# -*- coding: utf-8 -*-
"""Pemeriksaan ulang lepas dari pembangun, atas berkas SESUDAH pasang (salinan uji). Membaca dengan rtfmini (alat pembuat daftar A5).
pakai: python -B sumber/pindai_sesudah.py <akar dasar> <akar sesudah> <daftar-teks-merah.csv> <paket-satker> <hasil.txt>
Memeriksa per berkas daftar: (1) md5 dasar/sesudah; (2) merah sesudah = baris yang harus tetap merah, urutan dan bunyi sama; (3) kata berubah hanya pada
baris isian/buang/cabut; (4) kurung seimbang; (5) tanpa kata nama aplikasi yang baru; lalu ringkasan jumlah."""
import collections
import csv
import difflib
import hashlib
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
import rtfmini  # noqa: E402

MIN = 2


def baca(p):
    return open(p, 'rb').read()


def merah(b):
    return [f.strip().replace('\n', ' / ').replace('\t', ' ')[:400] for f in rtfmini.urai(b)['merah'] if len(f.strip()) >= MIN]


def seimbang(h):
    d = 0
    i = 0
    while i < len(h):
        c = h[i]
        if c == 92:
            i += 2
            continue
        d += (c == 123) - (c == 125)
        if d < 0:
            return False
        i += 1
    return d == 0


def main():
    dasar, sesudah, daftar, paket, hasil = sys.argv[1:6]
    rows = list(csv.DictReader(open(daftar, encoding='utf-8-sig')))
    per = collections.OrderedDict()
    for r in rows:
        per.setdefault(r['berkas'], []).append(r)
    catat = {}
    for r in csv.DictReader(open(os.path.join(os.path.dirname(paket), 'hasil', 'daftar-tambalan.csv'), encoding='utf-8-sig')):
        if r['no daftar']:
            catat[r['no daftar']] = r
    dt = {}
    for l in open(os.path.join(paket, 'daftar-tambal.tsv'), encoding='utf-8'):
        if not l.startswith('#') and l.strip():
            x = l.rstrip('\n').split('\t')
            dt[x[1]] = x
    keluar = []
    gagal = 0
    jum = collections.Counter()
    kata_beda = collections.Counter()
    for rel, rr in per.items():
        p_rel = 'derry_briantono/' + rel
        b0 = baca(os.path.join(dasar, p_rel))
        # salinan uji hanya memuat berkas paket; berkas daftar tanpa tambalan = berkas dasar
        b1 = baca(os.path.join(sesudah, p_rel)) if p_rel in dt else b0
        if p_rel in dt:
            if hashlib.md5(b0).hexdigest() != dt[p_rel][2] or hashlib.md5(b1).hexdigest() != dt[p_rel][3]:
                gagal += 1
                keluar.append('MD5 BEDA\t' + rel)
        elif b0 != b1:
            gagal += 1
            keluar.append('BERKAS TANPA TAMBALAN BERUBAH\t' + rel)
        # merah: harus persis baris yang tidak dikerjakan
        tetap = [r['potongan teks merah'] for r in rr if r['no'] not in catat or catat[r['no']]['golongan'] == 'batal']
        m1 = merah(b1)
        if m1 != tetap:
            gagal += 1
            keluar.append('MERAH TIDAK COCOK\t%s\t%d\t%d' % (rel, len(tetap), len(m1)))
        jum['merah sebelum'] += len(rr)
        jum['merah sesudah'] += len(m1)
        # kata: hanya baris isian/buang boleh mengubah teks
        p0 = rtfmini.urai(b0)['paragraf']
        p1 = rtfmini.urai(b1)['paragraf']
        ubah = [catat[r['no']] for r in rr if r['no'] in catat and catat[r['no']]['golongan'] in ('isian', 'buang')]
        if not ubah and p0 != p1:
            gagal += 1
            keluar.append('KATA BERUBAH PADA BERKAS HANYA-HITAMKAN\t' + rel)
        if ubah:
            w0, w1 = ' '.join(p0).split(), ' '.join(p1).split()
            for tag, a1, a2, c1, c2 in difflib.SequenceMatcher(None, w0, w1, autojunk=False).get_opcodes():
                if tag != 'equal':
                    kata_beda[(' '.join(w0[a1:a2])[:110], ' '.join(w1[c1:c2])[:60])] += 1
        if not seimbang(b1):
            gagal += 1
            keluar.append('KURUNG TIDAK SEIMBANG\t' + rel)
        if b1.lower().count(b'aleta') != b0.lower().count(b'aleta'):
            gagal += 1
            keluar.append('KATA NAMA APLIKASI BERTAMBAH\t' + rel)
        jum['berkas daftar'] += 1
    # tambahan: berkas [98] Cabut di luar daftar
    for k, x in dt.items():
        if k[len('derry_briantono/'):] not in per:
            b0, b1 = baca(os.path.join(dasar, k)), baca(os.path.join(sesudah, k))
            if rtfmini.urai(b0)['merah'] != rtfmini.urai(b1)['merah'] or b0.count(b'#8555#') - 1 != b1.count(b'#8555#') or b0.count(b'#8554#') + 1 != b1.count(b'#8554#') or len(b0) != len(b1):
                gagal += 1
                keluar.append('CABUT TIDAK COCOK\t' + k)
            jum['berkas cabut di luar daftar'] += 1
    with open(hasil, 'w', encoding='utf-8', newline='\n') as f:
        f.write('Pindai ulang lepas dari pembangun (rtfmini atas salinan terpasang).\n')
        for k in sorted(jum):
            f.write('%s\t%d\n' % (k, jum[k]))
        f.write('GAGAL\t%d\n' % gagal)
        for l in keluar:
            f.write(l + '\n')
        f.write('\nBeda kata sebelum => sesudah (hanya berkas yang memuat isian/buang), jumlah kali:\n')
        for (a, b), n in sorted(kata_beda.items(), key=lambda x: -x[1]):
            f.write('%d\t%s  =>  %s\n' % (n, a, b))
    print(open(hasil, encoding='utf-8').read())


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
