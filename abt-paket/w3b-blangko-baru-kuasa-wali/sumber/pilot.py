# -*- coding: utf-8 -*-
import sys, re, os
sys.stdout.reconfigure(encoding='utf-8')
import gugatan
import spek_353
from pustaka import Berkas
hasil = gugatan.susun_semua(spek_353.SPEK)
for h in hasil:
    b = Berkas(h)
    sisa = [(i, t[:100]) for i, t in enumerate(b.t) if re.search(r'nafkah|97[45]\d', t, re.I)]
    print(os.path.basename(h), b.n, 'SISA' if sisa else 'ok', sisa[:3])
import permohonan
for h in permohonan.susun_semua(spek_353.SPEK):
    b = Berkas(h)
    sisa = [(i, t[:100]) for i, t in enumerate(b.t) if re.search(r'hibah|979\d|98[0-9]\d', t, re.I)]
    print(os.path.basename(h), b.n, 'SISA' if sisa else 'ok', sisa[:3])
