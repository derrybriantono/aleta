# -*- coding: utf-8 -*-
"""Bangun paket abt-saksi-tanya-jawab-43-5nov: blangko yang mencetak keterangan saksi lewat #9259#-#9267# tetapi tidak memuat variabel tanya jawab saksinya.
Pola sama dengan putusan Format Lengkap: grup tersembunyi {\\*\\isianasal #2021#} tepat sebelum penanda keterangan, supaya isian Keterangan Saksi tampil di tabel ABT blangko itu.
Teks tercetak tidak berubah (diperiksa per paragraf). Dasar = keadaan sesudah a5-kelompok-5nov.
pakai: python -B sumber/bangun_saksi.py <akar sebelum a5-merah> <paket-satker> <hasil>"""
import base64
import collections
import csv
import hashlib
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
AK = os.path.join(SINI, '..', '..')
sys.path.insert(0, os.path.join(AK, 'a5-merah-5nov', 'sumber'))
import merahpos as mp  # noqa: E402
import rtfmini  # noqa: E402

N = 'abt-saksi-tanya-jawab-43-5nov'
BS = bytes([92])
PETA = collections.OrderedDict([('9259', '2021'), ('9260', '2022'), ('9261', '2031'), ('9262', '8920'), ('9263', '8932'), ('9264', '2023'), ('9265', '2024'), ('9266', '2032'), ('9267', '8942')])
LEWATI_FOLDER = re.compile(r'^(ALUR |- BAS |terhapus)')


def md5b(b):
    return hashlib.md5(b).hexdigest()


def muat(paket):
    dt = {}
    pot = collections.defaultdict(list)
    d = os.path.join(AK, paket, 'paket-satker')
    for l in open(os.path.join(d, 'daftar-tambal.tsv'), encoding='utf-8'):
        if not l.startswith('#') and l.strip():
            x = l.rstrip('\n').split('\t')
            dt[x[1]] = x
    for l in open(os.path.join(d, 'tambal.tsv'), encoding='ascii'):
        if not l.startswith('#') and l.strip():
            k, off, l0, l1 = l.rstrip('\n').split('\t')
            pot[k].append((int(off), base64.b64decode(l0), base64.b64decode(l1)))
    return dt, pot


def terapkan(b, rel, dt, pot):
    if rel not in dt:
        return b
    if md5b(b) != dt[rel][2]:
        raise SystemExit('md5 dasar paket beda: ' + rel)
    for off, l0, l1 in sorted(pot[dt[rel][0]], key=lambda x: -x[0]):
        assert b[off:off + len(l0)] == l0
        b = b[:off] + l1 + b[off + len(l0):]
    if md5b(b) != dt[rel][3]:
        raise SystemExit('md5 hasil paket beda: ' + rel)
    return b


def main():
    akar, keluar, hasil = sys.argv[1:4]
    a5, ka5 = muat('a5-merah-5nov')
    kl, kkl = muat('a5-kelompok-5nov')
    catat = []
    daftar = []
    tambal = []
    n = collections.Counter()
    per_folder = collections.Counter()
    pohon = os.path.join(akar, 'derry_briantono')
    semua = []
    for dp, dn, fn in os.walk(pohon):
        for f in fn:
            if f.endswith('.rtf'):
                semua.append(os.path.relpath(os.path.join(dp, f), akar).replace(os.sep, '/'))
    kode_n = 0
    for p_rel in sorted(semua):
        b0 = open(os.path.join(akar, p_rel.replace('/', os.sep)), 'rb').read()
        v0 = set(x.decode() for x in re.findall(rb'#(\d{4,5})#', b0))
        if not (v0 & set(PETA)):
            continue
        b = terapkan(terapkan(b0, p_rel, a5, ka5), p_rel, kl, kkl)
        v = set(x.decode() for x in re.findall(rb'#(\d{4,5})#', b))
        rel = p_rel[len('derry_briantono/'):]
        kurang = [k for k in PETA if k in v and PETA[k] not in v]
        n['memuat 9259-9267'] += 1
        if not kurang:
            n['sudah lengkap'] += 1
            continue
        if LEWATI_FOLDER.match(rel):
            n['dilewati folder arsip'] += 1
            catat.append((rel, ' '.join(PETA[k] for k in kurang), 'dilewati: folder arsip'))
            continue
        p = mp.peta(b)
        ops = []
        for k in kurang:
            tk = [t for t in p['toks'] if '#%s#' % k in t['teks']]
            if not tk:
                raise SystemExit('penanda tidak ada di teks tampak: %s %s' % (rel, k))
            t = tk[0]
            off = t['o0'] + t['teks'].index('#%s#' % k)
            ops.append((off, b'{' + BS + b'*' + BS + b'isianasal #' + PETA[k].encode() + b'#}'))
        h = b
        for off, s in sorted(ops, key=lambda x: -x[0]):
            h = h[:off] + s + h[off:]
        if rtfmini.urai(h)['paragraf'] != rtfmini.urai(b)['paragraf'] or rtfmini.urai(h)['merah'] != rtfmini.urai(b)['merah']:
            raise SystemExit('teks tampak berubah: ' + rel)
        v1 = set(x.decode() for x in re.findall(rb'#(\d{4,5})#', h))
        if v1 - v != set(PETA[k] for k in kurang):
            raise SystemExit('penanda hasil beda: ' + rel)
        d = 0
        for c in re.sub(BS * 2 + b'.', b'', h, flags=re.S):
            d += (c == 123) - (c == 125)
        if d != 0:
            raise SystemExit('kurung tidak seimbang: ' + rel)
        kode_n += 1
        kode = 'S%04d' % kode_n
        gab = [(off, b[off:off + 1], s + b[off:off + 1]) for off, s in sorted(ops)]
        daftar.append((kode, p_rel, md5b(b), md5b(h), len(gab)))
        tambal += [(kode, off, base64.b64encode(l0).decode(), base64.b64encode(l1).decode()) for off, l0, l1 in gab]
        catat.append((rel, ' '.join(PETA[k] for k in kurang), 'ditambah'))
        n['berkas ditambah'] += 1
        n['penanda ditambah'] += len(kurang)
        n['tanpa satu pun variabel tanya jawab' if len(kurang) == len([k for k in PETA if k in v]) else 'sebagian kurang'] += 1
        per_folder[rel.split('/')[0]] += 1
    os.makedirs(keluar, exist_ok=True)
    os.makedirs(hasil, exist_ok=True)
    with open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('# kode\tberkas\tmd5_lama (sesudah a5-kelompok-5nov)\tmd5_baru\tpotongan\n')
        for d in daftar:
            f.write('%s\t%s\t%s\t%s\t%d\n' % d)
    with open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='ascii', newline='\n') as f:
        f.write('# kode\toffset\tb64(teks lama)\tb64(teks baru)\n')
        for x in tambal:
            f.write('%s\t%d\t%s\t%s\n' % x)
    kepala = '-- Paket ABT "%s" (5 Nov 2026): variabel tanya jawab saksi yang dirujuk tambalan + penanda paket sebelumnya. Baca saja.\n' % N
    ada = list(PETA.values()) + ['12150']
    open(os.path.join(keluar, '%s-PRASYARAT.sql' % N), 'w', encoding='latin1', newline='\n').write(
        kepala + "SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s);\n" % ','.join(ada))
    open(os.path.join(keluar, 'harap.txt'), 'w', newline='\n').write('%d\n' % len(ada))
    with open(os.path.join(hasil, 'daftar-tambalan.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['berkas', 'variabel tanya jawab', 'status'])
        for c in catat:
            w.writerow(c)
    with open(os.path.join(hasil, 'ringkas.txt'), 'w', encoding='utf-8', newline='\n') as f:
        for k in sorted(n):
            f.write('%s\t%d\n' % (k, n[k]))
        f.write('potongan\t%d\n' % len(tambal))
        for k, v in per_folder.most_common():
            f.write('folder %s\t%d\n' % (k, v))
    print(open(os.path.join(hasil, 'ringkas.txt'), encoding='utf-8').read())


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
