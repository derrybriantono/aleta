# -*- coding: utf-8 -*-
"""Tabel padanan RBg <-> HIR + data pemakaian (G6 6.1a/b) -> hasil/tabel-padanan.md
pakai: python tabel_padanan.py <rujukan.tsv dari pindai_pasal.py> <rujukan-diganti.tsv dari bangun_paket.py> <keluar.md>"""
import collections
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', 'sumber'))
from padanan import PASAL  # noqa: E402


def main():
    ruj, ganti, kel = sys.argv[1:4]
    pakai = collections.defaultdict(lambda: dict(n=0, rtf=set(), var=set(), bentuk=collections.Counter()))
    lain = collections.Counter()
    for l in list(open(ruj, encoding='utf-8'))[1:]:
        sb, tp, ak, kode, span, ps, ktx = l.rstrip('\n').split('\t')
        if ak != '1':
            continue
        if kode != 'RBg':
            lain[(kode, span or ktx[90:150])] += 1
            continue
        for p in [x for x in ps.split(',') if x]:
            e = pakai[p]
            e['n'] += 1
            (e['rtf'] if sb == 'rtf' else e['var']).add(tp)
            e['bentuk'][span] += 1
    diganti = collections.Counter()
    tidak = collections.Counter()
    for l in list(open(ganti, encoding='utf-8'))[1:]:
        c = l.rstrip('\n').split('\t')
        if len(c) < 5:
            continue
        (diganti if c[3] else tidak)[c[4] if not c[3] else c[2]] += 1
    baris = ['# Tabel padanan RBg <-> HIR (G6, 30 Okt 2026)', '',
             'Naskah: RBg = terjemahan Reglemen Acara Hukum untuk Daerah Luar Jawa dan Madura (S. 1927-227) Pasal 142-314 dengan catatan "IR." '
             '(berandahukum.com, awambicara.id); HIR = Herzien Inlandsch Reglement / Reglemen Indonesia yang Diperbaharui (S. 1941-44), JDIH PN Bengkalis. '
             'Status: **pasti** = isi pasal dicocokkan; ayat pasti hanya bila ayat HIR bernomor atau paragrafnya berurutan sama.', '',
             '| Pasal RBg | Pasal HIR | status | ayat RBg -> HIR (pasti) | pokok | dipakai (kemunculan / berkas / variabel) | bentuk tersering | dasar / catatan |',
             '|---|---|---|---|---|---|---|---|']
    semua = sorted(set(PASAL) | set(pakai), key=lambda x: (int(re.match(r'\d+', x).group()), x))
    for p in semua:
        e = PASAL.get(p)
        u = pakai.get(p)
        ay = ', '.join('(%s)->%s' % (a, '(%s)' % h if h else 'tanpa ayat') for a, h in (e['ayat'].items() if e else []))
        baris.append('| %s | %s | %s | %s | %s | %s | %s | %s |' % (
            p, (e['hir'] or '-') if e else '?', e['status'] if e else '**belum ditinjau**', ay or '-', e['pokok'] if e else '',
            '%d / %d / %d' % (u['n'], len(u['rtf']), len(u['var'])) if u else '0', '; '.join('%s (%d)' % (s, n) for s, n in u['bentuk'].most_common(2)) if u else '',
            e['catatan'] if e else ''))
    baris += ['', '## Rujukan bukan "RBg" baku (tidak diubah, keluaran Donggala harus identik)', '']
    for (k, s), n in lain.most_common():
        baris.append('- %s: %s (%d)' % (k, s, n))
    baris += ['', '## Rujukan RBg yang TIDAK diganti (sebab)', '']
    for s, n in tidak.most_common():
        baris.append('- %s: %d' % (s, n))
    baris += ['', 'Rujukan diganti variabel padanan: %d.' % sum(diganti.values())]
    open(kel, 'w', encoding='utf-8', newline='\n').write('\n'.join(baris) + '\n')
    print('pasal', len(semua), 'diganti', sum(diganti.values()), 'tidak', sum(tidak.values()))


if __name__ == '__main__':
    main()
