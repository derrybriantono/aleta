# -*- coding: utf-8 -*-
"""Pemeriksaan ulang lepas dari pembangun, atas berkas SESUDAH pasang (salinan uji), dibaca dengan rtfmini.
pakai: python -B sumber/pindai_sesudah.py <akar dasar> <akar a5> <akar sesudah> <daftar-teks-merah.csv> <paket-satker> <hasil.txt>
Memeriksa: md5 lama/baru; kurung seimbang; merah >=2 huruf sesudah = baris "tetap merah"; penanda tanpa pembungkus berimbang; kalimat belang sisa; merah satu huruf dan huruf Arab sisa."""
import collections
import csv
import hashlib
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'a5-merah-5nov', 'sumber'))
import merahpos as mp  # noqa: E402
import rtfmini  # noqa: E402


def baca(p):
    return open(p, 'rb').read()


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
    dasar, a5, sesudah, daftar, paket, hasil = sys.argv[1:7]
    rows = list(csv.DictReader(open(daftar, encoding='utf-8-sig')))
    per = collections.OrderedDict()
    for r in rows:
        per.setdefault(r['berkas'], []).append(r)
    akar = os.path.dirname(paket)
    kel = {r['no daftar']: r for r in csv.DictReader(open(os.path.join(akar, 'hasil', 'daftar-tambalan.csv'), encoding='utf-8-sig'))}
    a5c = {r['no daftar']: r for r in csv.DictReader(open(os.path.join(akar, '..', 'a5-merah-5nov', 'hasil', 'daftar-tambalan.csv'), encoding='utf-8-sig')) if r['no daftar']}
    dt = {}
    for l in open(os.path.join(paket, 'daftar-tambal.tsv'), encoding='utf-8'):
        if not l.startswith('#') and l.strip():
            x = l.rstrip('\n').split('\t')
            dt[x[1]] = x
    keluar = []
    gagal = 0
    jum = collections.Counter()
    campur = []
    satu = collections.Counter()
    belang_a5 = 0
    arab = 0
    for rel, rr in per.items():
        p_rel = 'derry_briantono/' + rel
        if not any(r['usulan'] == 'hitamkan atau isian' for r in rr):
            continue
        if p_rel not in dt:
            jum['berkas 540 tanpa tambalan'] += 1
            b1 = baca(os.path.join(dasar, p_rel))
        else:
            b0 = baca(os.path.join(a5, p_rel))
            b1 = baca(os.path.join(sesudah, p_rel))
            if hashlib.md5(b0).hexdigest() != dt[p_rel][2] or hashlib.md5(b1).hexdigest() != dt[p_rel][3]:
                gagal += 1
                keluar.append('MD5 BEDA\t' + rel)
        if not seimbang(b1):
            gagal += 1
            keluar.append('KURUNG TIDAK SEIMBANG\t' + rel)
        if b1.lower().count(b'aleta') != baca(os.path.join(dasar, p_rel)).lower().count(b'aleta'):
            gagal += 1
            keluar.append('KATA NAMA APLIKASI BERTAMBAH\t' + rel)
        # merah sesudah
        tetap = [r['potongan teks merah'] for r in rr if r['no'] in kel and kel[r['no']]['golongan'] == 'tetap merah']
        m1 = [f.strip().replace('\n', ' / ').replace('\t', ' ')[:400] for f in rtfmini.urai(b1)['merah'] if len(f.strip()) >= 2]
        if m1 != tetap:
            gagal += 1
            keluar.append('MERAH TIDAK COCOK\t%s\t%d\t%d\t%r' % (rel, len(tetap), len(m1), [x[:40] for x in m1 if x not in tetap][:6]))
        jum['merah >=2 sesudah'] += len(m1)
        p = mp.peta(b1)
        by = collections.defaultdict(list)
        for t in p['toks']:
            by[t['para']].append(t)
        for k, ts in by.items():
            mr = [t for t in ts if t['merah']]
            if not mr:
                continue
            hitam = [t for t in ts if not t['merah'] and t['teks'].strip()]
            for t in mr:
                if len(t['teks'].strip()) < 2:
                    satu[t['teks'].strip()] += 1
            if hitam:
                campur.append((rel, ' '.join(t['teks'].strip() for t in mr)[:70], ''.join(t['teks'] for t in ts)[:120].replace('\n', ' ')))
        # huruf Arab/unicode masih di bawah kendali merah
        merah_i = [i for i, c in enumerate(p['warna']) if rtfmini.merah(c)]
        for cf, n in p['pakai_cf'].items():
            m = re.match(rb'\\cf(\d+)', b1[cf[0]:cf[1]])
            if m and int(m.group(1)) in merah_i:
                arab += n
        # baris hitamkan a5 dalam paragraf yang masih memuat merah: kalimat belang akibat a5
        toks0 = mp.peta(baca(os.path.join(dasar, p_rel)))
        bc0 = mp.baris_csv(toks0['toks'])
        para_h = {t['para'] for r, t in zip(rr, bc0) if r['no'] in a5c and a5c[r['no']]['golongan'] == 'hitamkan'}
        para_k = {t['para'] for r, t in zip(rr, bc0) if r['no'] in kel and kel[r['no']]['golongan'] == 'tetap merah'}
        belang_a5 += len(para_h & para_k)
        for t in toks0['toks']:
            if t['merah'] and len(t['teks'].strip()) < 2 and t['para'] in para_h and not any(x['para'] == t['para'] for x in bc0 if x and x is not t and False):
                pass
    # keluaran
    with open(hasil, 'w', encoding='utf-8', newline='\n') as f:
        f.write('Pindai ulang lepas dari pembangun (rtfmini atas salinan terpasang).\n')
        for k in sorted(jum):
            f.write('%s\t%d\n' % (k, jum[k]))
        f.write('GAGAL\t%d\n' % gagal)
        for l in keluar:
            f.write(l + '\n')
        f.write('Paragraf berisi baris hitamkan a5 dan baris tetap merah: %d\n' % belang_a5)
        f.write('Merah satu huruf sisa (tidak masuk daftar A5): %s\n' % dict(satu))
        f.write('Huruf unicode/Arab di bawah warna merah sisa: %d\n' % arab)
        f.write('Paragraf campur merah dan hitam sisa: %d\n' % len(campur))
        for rel, m, tx in campur:
            f.write('  %s | merah: %s | awal paragraf: %s\n' % (rel[:70], m, tx))
    print(open(hasil, encoding='utf-8').read())


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
