# -*- coding: utf-8 -*-
"""Pasang variabel paket ke DB UJI laptop (aps_badilag_u2, salinan sendiri; BUKAN aps_badilag bersama).
Nama basis data di dalam kueri diganti aps_badilag. -> aps_badilag_u2. khusus untuk DB uji ini.
Pakai: python pasang_uji.py [pulih]"""
import json, os, subprocess, sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
DB_UJI = 'aps_badilag_u2'


def hx(s):
    return 'NULL' if s is None else '0x' + s.encode('latin1').hex()


def jalankan(sql):
    r = subprocess.run([MYSQL, '-uroot', '--default-character-set=latin1', DB_UJI], input=sql.encode('latin1'), capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode('utf-8', 'replace')[:800])
    return r.stdout.decode('utf-8', 'replace')


def main():
    V = json.load(open(os.path.join(AKAR, 'data', 'variabel.json'), encoding='utf-8'))
    stmt = ['DELETE FROM abt_variabel WHERE no_var BETWEEN 4100 AND 4299;']
    if len(sys.argv) > 1 and sys.argv[1] == 'pulih':
        print(jalankan('\n'.join(stmt)))
        return
    for v in V:
        q = v['sql'].replace('aps_badilag.', DB_UJI + '.') if v['sql'] else None
        stmt.append("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier) "
                    "VALUES (%d, %s, %s, NULL, NULL, NULL, NULL, %s, %s, NULL, 0, 'admin');" % (v['no'], hx(v['nama']), hx(v['tipe']), hx(q), hx(v['default'])))
    jalankan('\n'.join(stmt))
    print('terpasang di', DB_UJI, len(V))


if __name__ == '__main__':
    main()
