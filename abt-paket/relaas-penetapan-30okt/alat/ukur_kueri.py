# -*- coding: utf-8 -*-
"""Ukur waktu kueri variabel (data_sql) untuk satu perkara: python ukur_kueri.py <basis_abt> <perkara_id> <no_var,...>"""
import subprocess
import sys
import time

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
basis, pid, nomor = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
q = "SELECT no_var, sql_query FROM %s.abt_variabel WHERE data_type='data_sql' AND no_var IN (%s)" % (basis, ','.join(nomor))
r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '--raw', '--batch', '-e', q], capture_output=True)
baris = r.stdout.decode('latin1').split('\n')
for b in baris:
    if '\t' not in b:
        continue
    no, s = b.split('\t', 1)
    s = s.replace('\\n', '\n').replace('\\t', '\t').replace('#perkara_id#', pid).replace('aps_badilag.', basis + '.')
    t0 = time.time()
    rr = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', 'sipp_2810'], input=s.encode('latin1'), capture_output=True)
    dt = time.time() - t0
    if dt > 0.5:
        print('%s %.1f dtk %s' % (no, dt, rr.stderr.decode('latin1')[:80]))
