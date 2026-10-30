# -*- coding: utf-8 -*-
"""Inventaris blangko relaas/penetapan Derry: penanda #nnnn# yang terbaca ABT (teks RTF mentah sesudah pembersihan ABT)
dan penanda yang TERPECAH kata kendali RTF (tidak akan diganti ABT -> tercetak mentah), plus teks tampak tiap blangko.
pakai: python inventaris.py <akar derry_briantono> <keluar.json> <folder teks> folder ..."""
import hashlib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtfteks import bersih_abt, teks_tampak  # noqa: E402


def main():
    akar, keluar, fteks = sys.argv[1], sys.argv[2], sys.argv[3]
    hasil = {}
    for d in sys.argv[4:]:
        for f in sorted(os.listdir(os.path.join(akar, d))):
            if not f.lower().endswith('.rtf'):
                continue
            b = open(os.path.join(akar, d, f), 'rb').read()
            s = bersih_abt(b)
            utuh = re.findall(r'#(\d{4,5})#', s)
            tampak = teks_tampak(s)
            semua = re.findall(r'#(\d{4,5})#', tampak)
            pecah = sorted(set(semua) - set(utuh))
            os.makedirs(os.path.join(fteks, d), exist_ok=True)
            open(os.path.join(fteks, d, f[:-4] + '.txt'), 'w', encoding='utf-8').write(tampak)
            hasil[d + '/' + f] = {'md5': hashlib.md5(b).hexdigest(), 'var': sorted(set(utuh), key=int), 'jml': len(utuh),
                                  'pecah': pecah, 'crlf': b.count(b'\r\n'), 'lf': b.count(b'\n') - b.count(b'\r\n'),
                                  'aleta': len(re.findall(r'aleta', tampak, re.I)),
                                  'satker_mati': re.findall(r'(?i)bungku|morowali|donggala', tampak)}
    json.dump(hasil, open(keluar, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    semua = {}
    for k, v in hasil.items():
        for x in v['var']:
            semua.setdefault(x, []).append(k)
        print('%-90s var=%3d pecah=%s crlf=%d lf=%d aleta=%d satker=%s' % (
            k[:90], len(v['var']), ','.join(v['pecah']), v['crlf'], v['lf'], v['aleta'], ','.join(sorted(set(v['satker_mati'])))))
    print('variabel berbeda:', len(semua))


main()
