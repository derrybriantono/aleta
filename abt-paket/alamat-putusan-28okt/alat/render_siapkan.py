# -*- coding: utf-8 -*-
"""Siapkan basis render php56 aps_badilag_alrender: semua tabel ABT = tampilan baca-saja ke aps_badilag LOKAL, KECUALI abt_variabel = tampilan ke <sumber>.abt_variabel
dengan 'aps_badilag.isian_rtf_' disulih '<sumber>.isian_rtf_' (fungsi paket di basis lab itu sendiri).
pakai: python render_siapkan.py aps_badilag_alamat_lama (keadaan server) | aps_badilag_alamat (paket terpasang)"""
import subprocess, sys
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
src = sys.argv[1]
awal = open(r'D:\Aplikasi\aleta\tmp\x1\render\buat.sql', encoding='utf-8').read().replace('aps_badilag_x1render', 'aps_badilag_alrender')
awal = '\n'.join(l for l in awal.split('\n') if 'abt_variabel AS SELECT' not in l)
kol = ("no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, "
       "REPLACE(sql_query, 'aps_badilag.isian_rtf_', '%s.isian_rtf_') AS sql_query, default_data, multi_sidang, locked, modifier, modified" % src)
awal += "\nCREATE VIEW aps_badilag_alrender.abt_variabel AS SELECT %s FROM %s.abt_variabel;\n" % (kol, src)
r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot'], input=awal.encode('utf-8'), capture_output=True)
print(r.stdout.decode()[:300], r.stderr.decode()[:500])
r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '-e', 'select count(*) from aps_badilag_alrender.abt_variabel'], capture_output=True)
print('abt_variabel di basis render:', r.stdout.decode().strip())
