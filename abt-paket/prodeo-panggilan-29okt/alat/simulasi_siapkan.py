# -*- coding: utf-8 -*-
"""Basis simulasi BACA-SAJA untuk render ABT: sipp_pp29v = tampilan ke sipp_2810 dengan perkara.prodeo DIPAKSA 1 untuk
perkara tertentu (perkara prodeo cerai talak / ekonomi syariah tidak ada di data); pp29_fnv = salinan fungsi ABT server yang
membaca skema sipp_pp29v. Tidak ada tulisan ke sipp_2810 / aps_badilag_2810. Prosedur SIPP tidak disalin (render tidak
menjalankan perkara_jadwal_sidang_reorder).
pakai: python simulasi_siapkan.py <perkara_id paksa prodeo,...>"""
import re
import subprocess
import sys

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
MYSQLDUMP = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysqldump.exe'
SUMBER, SIM, FN = 'sipp_2810', 'sipp_pp29v', 'pp29_fnv'
paksa = [int(x) for x in sys.argv[1].split(',')] if len(sys.argv) > 1 else []


def q(sql, db=''):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '--raw'] + ([db] if db else []), input=sql.encode('latin1'), capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode('latin1')[:800])
    return r.stdout.decode('latin1')


tabel = q("SELECT table_name FROM information_schema.tables WHERE table_schema = '%s'" % SUMBER).split()
kol = q("SELECT column_name FROM information_schema.columns WHERE table_schema = '%s' AND table_name = 'perkara' ORDER BY ordinal_position" % SUMBER).split()
s = ['DROP DATABASE IF EXISTS %s;' % SIM, 'CREATE DATABASE %s DEFAULT CHARSET latin1;' % SIM]
for t in tabel:
    if t == 'perkara':
        daftar = ', '.join(('IF(perkara_id IN (%s), 1, prodeo) AS prodeo' % ','.join(map(str, paksa or [0]))) if c == 'prodeo' else '`%s`' % c for c in kol)
        s.append('CREATE VIEW %s.`perkara` AS SELECT %s FROM %s.`perkara`;' % (SIM, daftar, SUMBER))
    else:
        s.append('CREATE VIEW %s.`%s` AS SELECT * FROM %s.`%s`;' % (SIM, t, SUMBER, t))
q('\n'.join(s))
# FUNGSI SIPP (get_umur dsb., dipanggil variabel tanpa awalan skema) disalin ke basis simulasi - tabelnya = tampilan di atas.
# PROSEDUR tidak disalin (sebagian menulis, mis. perkara_jadwal_sidang_reorder).
rut = subprocess.run([MYSQLDUMP, '-h127.0.0.1', '-uroot', '--routines', '--no-create-info', '--no-data', '--skip-triggers', '--no-create-db', SUMBER],
                     capture_output=True, check=True).stdout.decode('latin1')
q(rut, SIM)
for pr in q("SELECT routine_name FROM information_schema.routines WHERE routine_schema = '%s' AND routine_type = 'PROCEDURE'" % SIM).split():
    q('DROP PROCEDURE `%s`.`%s`;' % (SIM, pr))
fn = subprocess.run([MYSQLDUMP, '-h127.0.0.1', '-uroot', '--routines', '--no-create-info', '--no-data', '--skip-triggers', '--no-create-db', 'pp29_fn'],
                    capture_output=True, check=True).stdout.decode('latin1')
fn = re.sub(r'\bsipp_2810\.', SIM + '.', fn)
q('DROP DATABASE IF EXISTS %s; CREATE DATABASE %s DEFAULT CHARSET latin1;' % (FN, FN))
q(fn, FN)
print('tampilan', len(tabel), 'fungsi', q("SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = '%s'" % FN).strip(),
      'prodeo dipaksa', paksa, '->', q("SELECT GROUP_CONCAT(perkara_id, ':', prodeo) FROM %s.perkara WHERE perkara_id IN (%s)" % (SIM, ','.join(map(str, paksa or [0])))).strip())
