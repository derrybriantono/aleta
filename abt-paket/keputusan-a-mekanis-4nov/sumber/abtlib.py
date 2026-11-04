# -*- coding: utf-8 -*-
"""Pustaka bersama paket keputusan-a-* (4 Nov 2026): ubahan teks tampak -> potongan bita RTF dengan penjaga md5.
Dipakai bangun_mekanis.py (paket keputusan-a-mekanis-4nov) dan bangun_*.py paket keputusan-a-kerangka/rekonvensi.
- ubah(b, ops): ops = [(awal, akhir, baru)] atas teks tampak (rtfpeta.peta); hanya huruf harfiah yang disentuh.
- ubah_mentah(b, ganti): ganti = [(bita lama, bita baru)] untuk ubahan yang memuat kode RTF (hanya bila perlu; tiap bita lama harus tepat satu kali).
Pemeriksaan per berkas (BERHENTI bila gagal): teks tampak hasil = teks lama dengan ubahan PERSIS; kurung seimbang; tanpa kata nama aplikasi."""
import base64
import difflib
import hashlib
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
from rtfpeta import peta, kurung_seimbang  # noqa: E402

PENANDA = re.compile(r'#\d{4,5}#')


def md5b(b):
    return hashlib.md5(b).hexdigest()


def potong(b, pos, a, z, lama, baru):
    """ubahan huruf lama->baru pada teks[a:z] -> (offset, bita lama, bita baru)"""
    o0 = pos[a][0]
    o1 = pos[z - 1][0] + pos[z - 1][1]
    seg = bytearray(b[o0:o1])
    ops = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, lama, baru, autojunk=False).get_opcodes():
        if tag == 'equal':
            continue
        s = baru[j1:j2].encode('ascii')
        if tag == 'insert':
            assert i1 > 0, 'sisip di awal'
            p = pos[a + i1 - 1]
            assert p[2], 'bukan harfiah'
            ops.append((p[0] + 1 - o0, 0, s))
            continue
        for n, i in enumerate(range(i1, i2)):
            p = pos[a + i]
            assert p[2] and p[1] == 1 and b[p[0]:p[0] + 1] == lama[i].encode('ascii'), 'bukan harfiah: %r' % lama[i]
            ops.append((p[0] - o0, 1, s if n == 0 else b''))
    for off, n, s in sorted(ops, key=lambda x: -x[0]):
        seg[off:off + n] = s
    return o0, bytes(b[o0:o1]), bytes(seg)


def ubah(b, ops, teks=None, pos=None):
    """-> (hasil bita, [(offset, lama, baru)] potongan atas b)"""
    if teks is None:
        teks, pos = peta(b)
    ops = sorted(ops)
    for x, y in zip(ops, ops[1:]):
        if y[0] < x[1]:
            raise SystemExit('TUMPANG %r %r' % (x, y))
    pot = []
    harap = teks
    for a, z, baru in reversed(ops):
        pot.append(potong(b, pos, a, z, teks[a:z], baru))
        harap = harap[:a] + baru + harap[z:]
    pot.sort()
    h = b
    for off, l0, l1 in sorted(pot, key=lambda x: -x[0]):
        assert h[off:off + len(l0)] == l0
        h = h[:off] + l1 + h[off + len(l0):]
    return h, pot, harap


def ubah_mentah(b, ganti):
    pot = []
    h = b
    for lama, baru in ganti:
        if b.count(lama) != 1:
            raise SystemExit('BITA LAMA TIDAK TEPAT SATU (%d): %r' % (b.count(lama), lama[:80]))
        pot.append((b.index(lama), lama, baru))
    pot.sort()
    for off, l0, l1 in sorted(pot, key=lambda x: -x[0]):
        h = h[:off] + l1 + h[off + len(l0):]
    return h, pot


def periksa(b, h, harap_teks=None, penanda_harap=None):
    if not kurung_seimbang(h):
        raise SystemExit('KURUNG TIDAK SEIMBANG')
    if kurung_seimbang(b) != kurung_seimbang(h):
        raise SystemExit('KURUNG')
    if re.search(rb'(?i)aleta', h) and not re.search(rb'(?i)aleta', b):
        raise SystemExit('NAMA APLIKASI')
    if harap_teks is not None:
        t2, _ = peta(h)
        if t2 != harap_teks:
            raise SystemExit('TEKS BEDA')


def tulis_paket(keluar, daftar, tambal, ket_dasar):
    """daftar: [(kode, rel, md5_lama, md5_baru, n)]; tambal: [(kode, offset, lama, baru)]"""
    if not os.path.isdir(keluar):
        os.makedirs(keluar)
    with open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('# kode\tberkas\tmd5_lama (%s)\tmd5_baru\tpotongan\n' % ket_dasar)
        for d in daftar:
            f.write('%s\t%s\t%s\t%s\t%d\n' % d)
    with open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('# kode\toffset\tb64(teks lama)\tb64(teks baru)\n')
        for k, off, l0, l1 in tambal:
            f.write('%s\t%d\t%s\t%s\n' % (k, off, base64.b64encode(l0).decode(), base64.b64encode(l1).decode()))
