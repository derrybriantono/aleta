# -*- coding: utf-8 -*-
"""Pemeriksaan struktur RTF hasil bangun: kurung seimbang, \\trowd/\\row seimbang, tanpa kata ALETA, token #NNNN# yang dikenal.
  python periksa_rtf.py <berkas.rtf>... -> satu baris per berkas, keluar 1 bila ada yang rusak"""
import re, sys

BS = chr(92)


def seimbang(raw):
    s = raw.replace(BS * 2, '').replace(BS + '{', '').replace(BS + '}', '')
    return s.count('{') - s.count('}')


def hitung(raw):
    return len(re.findall(re.escape(BS) + r'trowd\b', raw)), len(re.findall(re.escape(BS) + r'row\b', raw)), len(re.findall(re.escape(BS) + r'cell\b', raw))


if __name__ == '__main__':
    rusak = 0
    for f in sys.argv[1:]:
        raw = open(f, 'rb').read().decode('latin1')
        sb = seimbang(raw)
        tr, rw, ce = hitung(raw)
        aleta = bool(re.search('aleta', raw, re.I))
        ok = sb == 0 and not aleta
        rusak += 0 if ok else 1
        print('%s | kurung %+d | trowd %d row %d cell %d | aleta %s | %s' % (f.replace(BS, '/').split('/')[-1][:70], sb, tr, rw, ce, aleta, 'OK' if ok else 'RUSAK'))
    sys.exit(1 if rusak else 0)
