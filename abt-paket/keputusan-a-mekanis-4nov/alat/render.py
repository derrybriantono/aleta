# -*- coding: utf-8 -*-
"""Bukti render: tahap 'siap' -> RTF rekaan; tahap 'banding' -> pdftotext + beda kata sebelum/sesudah per berkas & keadaan.
pakai: python -B render_c1.py siap <akar> <paket-satker> <pilih.txt> <bukti>
       python -B render_c1.py banding <bukti>"""
import difflib
import json
import os
import re
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
KEADAAN = ('majelis', 'tunggal')
KAKI = re.compile(r'\d+ dari \d+ Halaman|(?:Halaman )?(?:Penetapan|Putusan) Nomor 99/Pdt\.X/2026/PA\.Rekaan')


def siap(akar, paket, pilih, bukti):
    rtf = os.path.join(bukti, 'rtf')
    os.makedirs(rtf, exist_ok=True)
    daftar = []
    for n, l in enumerate(open(pilih, encoding='utf-8')):
        if '|' not in l:
            continue
        rel = l.rsplit('|', 1)[1].strip()
        awal = os.path.join(rtf, 'R%02d' % (n + 1))
        for k in KEADAAN:
            subprocess.check_call([sys.executable, '-B', os.path.join(SINI, 'rekaan.py'), akar, paket, 'derry_briantono/' + rel, k, awal])
            daftar.append({'no': 'R%02d' % (n + 1), 'rel': rel, 'keadaan': k,
                           'sebelum': '%s-sebelum-%s.rtf' % (awal, k), 'sesudah': '%s-sesudah-%s.rtf' % (awal, k)})
    json.dump(daftar, open(os.path.join(bukti, 'render.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    with open(os.path.join(bukti, 'rtf-daftar.txt'), 'w', encoding='utf-8') as f:
        for d in daftar:
            f.write(d['sebelum'] + '\n' + d['sesudah'] + '\n')


def teks_pdf(pdf):
    t = subprocess.run(['pdftotext', '-enc', 'UTF-8', pdf, '-'], capture_output=True).stdout.decode('utf-8', 'replace')
    return t.split('\f')


def banding(bukti):
    daftar = json.load(open(os.path.join(bukti, 'render.json'), encoding='utf-8'))
    keluar = []
    for d in daftar:
        h0 = teks_pdf(d['sebelum'][:-4] + '.pdf')
        h1 = teks_pdf(d['sesudah'][:-4] + '.pdf')
        w0 = KAKI.sub(' ', ' '.join(h0)).split()
        w1 = KAKI.sub(' ', ' '.join(h1)).split()
        beda = []
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, w0, w1, autojunk=False).get_opcodes():
            if tag != 'equal':
                beda.append((' '.join(w0[max(0, i1 - 3):i1]), ' '.join(w0[i1:i2]), ' '.join(w1[j1:j2]), ' '.join(w0[i2:i2 + 3])))
        # halaman pertama yang berbeda
        hal = None
        for i in range(min(len(h0), len(h1))):
            if h0[i].split() != h1[i].split():
                hal = i + 1
                break
        d.update({'halaman_sebelum': len([x for x in h0 if x.strip()]), 'halaman_sesudah': len([x for x in h1 if x.strip()]),
                  'kata_sebelum': len(w0), 'kata_sesudah': len(w1), 'beda': beda, 'halaman_beda': hal})
        keluar.append(d)
    json.dump(keluar, open(os.path.join(bukti, 'banding.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    with open(os.path.join(bukti, 'banding.txt'), 'w', encoding='utf-8') as f:
        for d in keluar:
            f.write('%s %-7s hal %s->%s kata %d->%d beda %d (hal pertama beda %s) | %s\n' % (
                d['no'], d['keadaan'], d['halaman_sebelum'], d['halaman_sesudah'], d['kata_sebelum'], d['kata_sesudah'],
                len(d['beda']), d['halaman_beda'], d['rel']))
            for a, x, y, z in d['beda']:
                f.write('    ...%s [%s] -> [%s] %s...\n' % (a, x, y, z))


if __name__ == '__main__':
    if sys.argv[1] == 'siap':
        siap(*sys.argv[2:6])
    else:
        banding(sys.argv[2])
