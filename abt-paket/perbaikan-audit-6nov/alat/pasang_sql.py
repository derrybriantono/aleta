# -*- coding: utf-8 -*-
"""Pasang SQL paket (PRASYARAT -> PASANG -> PERIKSA) ke skema uji aps_badilag_w223 (milik pekerjaan ini). python -I pasang_sql.py <paket> ..."""
import os
import subprocess
import sys

MY = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
DB = 'aps_badilag_w223'
PK = 'D:/aleta-dev/wt/w223/abt-paket/'


def q(sql_file=None, sql=None):
    inp = open(sql_file, 'rb').read() if sql_file else sql.encode('latin1')
    r = subprocess.run([MY, '-h127.0.0.1', '-uroot', '-N', '--default-character-set=latin1', DB], input=inp, capture_output=True)
    return r.returncode, r.stdout.decode('latin1').replace('\r', '').strip(), r.stderr.decode('latin1')[:300]


for n in sys.argv[1:]:
    d = PK + n + '/paket-satker/'
    nama = 'abt-' + n
    harap = [l.strip() for l in open(d + 'harap.txt', encoding='utf8').read().split('\n') if l.strip()] if os.path.exists(d + 'harap.txt') else []
    pra = d + nama + '-PRASYARAT.sql'
    pas = d + nama + '-PASANG.sql'
    per = d + nama + '-PERIKSA.sql'
    if not os.path.exists(pas):
        print(n, 'TIDAK ADA PASANG.sql (lewat)')
        continue
    rc, p, e = q(pra)
    print(n, 'prasyarat', repr(p), 'harap', harap, e if rc else '')
    if harap and p not in harap:
        print('   TIDAK COCOK -> dilewati')
        continue
    if harap and p == harap[-1] and len(harap) > 1:
        print('   sudah terpasang')
        continue
    rc, o, e = q(pas)
    print('   pasang rc', rc, e)
    if os.path.exists(per):
        rc, o, e = q(per)
        print('   periksa', o[:80], e)
    rc, p2, e = q(pra)
    print('   prasyarat sesudah', repr(p2))
