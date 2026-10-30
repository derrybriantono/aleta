# -*- coding: utf-8 -*-
"""Cek bentrok nomor variabel, menu, dan nama berkas paket ini dengan paket ABT di worktree lain (baca saja).
pakai: python cek_bentrok.py [akar worktree, bawaan D:/aleta-dev/wt]"""
import glob
import os
import re
import sys

AKAR = sys.argv[1] if len(sys.argv) > 1 else 'D:/aleta-dev/wt'
SINI = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
PS = os.path.join(SINI, 'paket-satker')
milik = set(int(x) for x in open(os.path.join(PS, 'nomor-variabel.txt'), encoding='utf-8').read().split() if x.isdigit())
berkas = set()
for nm in ('daftar-rtf.tsv', 'daftar-timpa.tsv'):
    for b in open(os.path.join(PS, nm), encoding='utf-8'):
        if b.strip() and not b.startswith('#'):
            f = b.split('\t')
            berkas.add(f[0] + '/' + f[1])
temuan = []
for d in sorted(glob.glob(os.path.join(AKAR, '*', 'abt-paket', '*', 'paket-satker'))):
    # salinan paket ini sendiri di worktree gabungan (nama folder paket sama) bukan bentrok
    if os.path.abspath(d) == os.path.abspath(PS) or os.path.basename(os.path.dirname(d)) == os.path.basename(SINI):
        continue
    for sql in glob.glob(os.path.join(d, '*PASANG*.sql')):
        t = open(sql, encoding='latin1').read()
        no = set(int(x) for x in re.findall(r'INSERT INTO abt_variabel\s*\([^)]*\)\s*VALUES\s*\((\d+)', t))
        no |= set(int(x) for x in re.findall(r'no_var\s*=\s*(\d{4,5})\b', t) if 11300 <= int(x) <= 11499 or 11600 <= int(x) <= 11619)
        b = sorted(no & milik)
        if b:
            temuan.append('VARIABEL %s: %s' % (sql, b[:10]))
        for m in re.findall(r'INSERT INTO abt_menu\s*\([^)]*\)\s*VALUES\s*\((\d+)', t):
            if int(m) in (151, 152):
                temuan.append('MENU %s: %s' % (sql, m))
    for nm in ('daftar-rtf.tsv', 'daftar-timpa.tsv'):
        p = os.path.join(d, nm)
        if not os.path.exists(p):
            continue
        for b in open(p, encoding='utf-8'):
            if b.strip() and not b.startswith('#'):
                f = b.split('\t')
                if len(f) > 1 and f[0] + '/' + f[1] in berkas:
                    temuan.append('BERKAS %s: %s/%s' % (p, f[0], f[1]))
print('paket lain diperiksa:', len(glob.glob(os.path.join(AKAR, '*', 'abt-paket', '*', 'paket-satker'))) - 1)
print('milik paket ini: %d variabel %d-%d, %d berkas; 11600-11619 dipakai: %s' % (len(milik), min(milik), max(milik), len(berkas), any(11600 <= x <= 11619 for x in milik)))
print('\n'.join(temuan) if temuan else 'TIDAK ADA BENTROK')
