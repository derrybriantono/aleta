# -*- coding: utf-8 -*-
"""Salin fungsi/prosedur tersimpan sipp_donggala ke sipp_x4 (basis uji render; view tidak membawa fungsi)."""
import subprocess

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'


def q(sql, db=None, raw=False):
    a = [MYSQL, '-h127.0.0.1', '-uroot', '--default-character-set=latin1', '-N'] + (['-r'] if raw else []) + ([db] if db else [])
    r = subprocess.run(a, input=sql.encode('latin1'), capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode('latin1')[:400])
    return r.stdout.decode('latin1')


rut = [l.split('\t') for l in q("SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA='sipp_donggala'").splitlines() if l]
n = 0
for nama, jenis in rut:
    out = q("SHOW CREATE %s `sipp_donggala`.`%s`" % (jenis, nama), raw=True)
    # kolom: nama, sql_mode, create, charset, collation, db collation
    buat = out.rstrip('\n').rsplit('\t', 3)[0].split('\t', 2)[2]  # badan rutin memuat TAB
    q("DROP %s IF EXISTS `%s`;\nDELIMITER $$\n%s$$\nDELIMITER ;\n" % (jenis, nama, buat), 'sipp_x4')
    n += 1
print('disalin', n, 'rutin')
