# -*- coding: utf-8 -*-
"""Basis SIPP uji render x4 (laptop): sipp_x4 = VIEW ke semua tabel/view sipp_donggala, kecuali perkara, perkara_rekonvensi dan
perkara_kumulasi yang DISALIN (tabel sendiri) supaya petitum / jenis perkara uji dapat diatur tanpa menyentuh salinan SIPP bersama.
pakai: python siapkan_sipp_uji.py"""
import subprocess

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
SUMBER, DB = 'sipp_donggala', 'sipp_x4'
SALIN = {'perkara', 'perkara_rekonvensi', 'perkara_kumulasi'}


def sql(q, db=None):
    a = [MYSQL, '-h127.0.0.1', '-uroot', '--default-character-set=latin1', '-N'] + ([db] if db else [])
    r = subprocess.run(a, input=q.encode('latin1'), capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode('latin1')[:500])
    return r.stdout.decode('latin1')


tabel = [l.split('\t') for l in sql("SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA='%s'" % SUMBER).splitlines() if l]
out = ["DROP DATABASE IF EXISTS %s;" % DB, "CREATE DATABASE %s DEFAULT CHARSET latin1;" % DB, "USE %s;" % DB]
for t, jenis in tabel:
    if t in SALIN:
        out.append("CREATE TABLE `%s` LIKE `%s`.`%s`; INSERT INTO `%s` SELECT * FROM `%s`.`%s`;" % (t, SUMBER, t, t, SUMBER, t))
    else:
        out.append("CREATE VIEW `%s` AS SELECT * FROM `%s`.`%s`;" % (t, SUMBER, t))
sql('\n'.join(out))
print('tabel', len(tabel), 'disalin', len(SALIN))
