# -*- coding: utf-8 -*-
"""Salin skema ABT uji aps_badilag_w206 (baca saja) menjadi aps_badilag_w223 (milik pekerjaan ini). Nama skema dan rujukan SIPP di badan fungsi diganti."""
import os
import re
import subprocess
import sys

BIN = r'D:\satker asal\website pa bungku\xampp\mysql\bin'
MY = os.path.join(BIN, 'mysql.exe')
DUMP = os.path.join(BIN, 'mysqldump.exe')
SUMBER, BARU, SIPP_BARU = 'aps_badilag_w206', 'aps_badilag_w223', 'sipp_vs'
TMP = r'D:\Aplikasi\aleta\tmp\w223'

if sys.argv[1] == 'klon':
    ada = subprocess.run([MY, '-h127.0.0.1', '-uroot', '-N', '-e', "SHOW DATABASES LIKE '%s'" % BARU], capture_output=True).stdout.decode().strip()
    if ada:
        raise SystemExit('skema %s sudah ada' % BARU)
    out = os.path.join(TMP, 'dasar-w206.sql')
    with open(out, 'wb') as f:
        r = subprocess.run([DUMP, '-h127.0.0.1', '-uroot', '--default-character-set=latin1', '--routines', '--skip-triggers', '--skip-add-locks', '--hex-blob', '--single-transaction', SUMBER], stdout=f, stderr=subprocess.PIPE)
    if r.returncode:
        raise SystemExit('dump gagal: ' + r.stderr.decode('latin1')[:500])
    s = open(out, 'rb').read().decode('latin1')
    s = s.replace(SUMBER, BARU)
    s = re.sub(r'\bsipp_donggala\.', SIPP_BARU + '.', s)
    s = re.sub(r'\bSIPP\.', SIPP_BARU + '.', s)
    s = re.sub(r'DEFINER=`[^`]*`@`[^`]*`', '', s)
    open(out.replace('dasar-w206', 'dasar-w223'), 'wb').write(s.encode('latin1'))
    subprocess.run([MY, '-h127.0.0.1', '-uroot', '-e', 'CREATE DATABASE %s DEFAULT CHARACTER SET latin1' % BARU], check=True)
    r = subprocess.run([MY, '-h127.0.0.1', '-uroot', '--default-character-set=latin1', BARU], input=open(out.replace('dasar-w206', 'dasar-w223'), 'rb').read(), capture_output=True)
    if r.returncode:
        raise SystemExit('muat gagal: ' + r.stderr.decode('latin1')[:800])
    print('KLON SELESAI')
