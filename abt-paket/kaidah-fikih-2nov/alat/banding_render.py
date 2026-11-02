# -*- coding: utf-8 -*-
"""Banding teks hasil render sungguhan sebelum/sesudah paket: hanya paragraf kaidah yang bertambah (dan kalimat poligami [01b]) yang boleh berbeda.
pakai: python banding_render.py <folder render> kasus1,kasus2,...  -> ringkasan per kasus (tanpa data pihak: hanya baris yang berbeda dicetak)"""
import difflib
import io
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sumber'))
from rtf2txt import rtf_ke_teks  # noqa: E402


def teks(p):
    t = rtf_ke_teks(open(p, 'rb').read().decode('latin1'))
    return [re.sub(r'\s+', ' ', l).strip() for l in t.split('\n') if l.strip()]


d, kasus = sys.argv[1], sys.argv[2].split(',')
for k in kasus:
    a, b = os.path.join(d, 'sebelum-%s.rtf' % k), os.path.join(d, 'sesudah-%s.rtf' % k)
    if not (os.path.exists(a) and os.path.exists(b)):
        print('== %s: berkas render tidak lengkap' % k)
        continue
    A, B = teks(a), teks(b)
    sm = difflib.SequenceMatcher(None, A, B, autojunk=False)
    tambah, buang, ganti = [], [], []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'insert':
            tambah += B[j1:j2]
        elif op == 'delete':
            buang += A[i1:i2]
        elif op == 'replace':
            ganti.append((A[i1:i2], B[j1:j2]))
    sisa_var = sum(len(re.findall(r'#\d{4,5}#', l)) for l in tambah)
    print('== %s: paragraf %d -> %d | ditambah %d | dibuang %d | diganti %d | penanda #nnnn# tersisa di tambahan: %d' % (k, len(A), len(B), len(tambah), len(buang), len(ganti), sisa_var))
    for l in tambah:
        print('   + ' + l[:220])
    for l in buang:
        print('   - ' + l[:220])
    for x, y in ganti:
        for l in x:
            print('   ~- ' + l[:300])
        for l in y:
            print('   ~+ ' + l[:300])
