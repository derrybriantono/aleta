# -*- coding: utf-8 -*-
"""Ekspor abt_variabel basis lab (default aps_badilag_x4, paket terpasang) ke JSON katalog (no_var, nama, data_type, sql_query,
default_data) untuk survei panel (skrip survei.ts) dan fixture uji. pakai: python katalog_lab.py [db] [keluar.json]"""
import json, subprocess, sys

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
db = sys.argv[1] if len(sys.argv) > 1 else 'aps_badilag_x4'
keluar = sys.argv[2] if len(sys.argv) > 2 else r'D:\Aplikasi\aleta\tmp\w26\var_lab_x4.json'
q = "SELECT no_var, HEX(nama), IFNULL(data_type,''), IFNULL(HEX(sql_query),''), IFNULL(HEX(default_data),'') FROM abt_variabel ORDER BY no_var"
r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '--default-character-set=latin1', '-N', db, '-e', q], capture_output=True)
out = []
for l in r.stdout.decode('ascii').splitlines():
    no, n, t, s, d = l.split('\t')
    h = lambda x: bytes.fromhex(x).decode('latin1') if x else None  # noqa: E731
    out.append(dict(no_var=int(no), nama=h(n), data_type=t or None, sql_query=h(s), default_data=h(d)))
json.dump(out, open(keluar, 'w', encoding='utf-8'), ensure_ascii=False)
print(len(out), keluar)
