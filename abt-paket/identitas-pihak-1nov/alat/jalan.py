# -*- coding: utf-8 -*-
"""jalan.py <akar> <label> <keluar> <kasus=perkara:rel:sidang;...>
render lewat render177.render dengan kasus tambahan. rel relatif terhadap <akar>/derry_briantono."""
import sys, time
sys.path.insert(0, 'D:/Aplikasi/aleta/tmp/w177/alat')
import render177 as R
akar, label, keluar, spec = sys.argv[1:5]
tambahan = {}
for i, s in enumerate(spec.split(';')):
    nama, perkara, rel, sidang = s.split('|')
    tambahan[nama] = (int(perkara), rel, int(sidang))
t = time.time()
R.render(akar, label, list(tambahan), keluar, tambahan)
print('waktu %.1f dtk' % (time.time() - t))
