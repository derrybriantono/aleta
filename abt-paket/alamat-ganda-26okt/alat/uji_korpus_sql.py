# -*- coding: utf-8 -*-
"""Uji korpus bersama alamat-ganda-26okt atas fungsi SQL isian_rtf_alamat di basis laptop (MariaDB XAMPP): hasil SQL harus = "dasar" tiap kasus
(sama dengan bot alamatPihakRapi.js). Korpus: manajemen_surat/src/test/fixtures/alamat-ganda-26okt.json (alamat rekaan, tanpa data pribadi).
pakai: python uji_korpus_sql.py [basis=aps_badilag_ag2]   (basis harus sudah memuat fungsi paket dan tabel referensi SIPP lewat SIPP_DB)
Keluar 0 bila semua cocok."""
import json
import os
import subprocess
import sys

MYSQL = os.environ.get('MYSQL_EXE', r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe')
AKAR = os.path.dirname(os.path.abspath(__file__))
KORPUS = os.path.join(AKAR, '..', '..', '..', 'manajemen_surat', 'src', 'test', 'fixtures', 'alamat-ganda-26okt.json')
db = sys.argv[1] if len(sys.argv) > 1 else 'aps_badilag_ag2'
kasus = json.load(open(KORPUS, encoding='utf-8'))['kasus']
sql = ''.join("SELECT %d, HEX(isian_rtf_alamat(CONVERT(UNHEX('%s') USING latin1)));\n" % (i, k['masuk'].encode('utf-8').hex() if k['masuk'] else '') for i, k in enumerate(kasus))
r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '--default-character-set=latin1', '-N', db], input=sql.encode('ascii'), capture_output=True)
if r.stderr:
    print('GALAT SQL:', r.stderr.decode()[:400])
    sys.exit(2)
hasil = {}
for baris in r.stdout.decode().split('\n'):
    p = baris.rstrip('\r').split('\t')
    if len(p) == 2:
        hasil[int(p[0])] = bytes.fromhex(p[1]).decode('utf-8', 'replace')
beda = 0
for i, k in enumerate(kasus):
    h = hasil.get(i, '')
    if h != k['dasar']:
        beda += 1
        print('BEDA', i, k['nama'])
        print('   harap :', k['dasar'])
        print('   SQL   :', h)
print('korpus %d kasus, beda %d' % (len(kasus), beda))
sys.exit(1 if beda else 0)
