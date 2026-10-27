# -*- coding: utf-8 -*-
"""Konfirmasi BACA SAJA terhadap server (ssh alias aleta; tidak menulis apa pun, tidak ada berkas yang disalin ke server):
 1. PRASYARAT.sql dijalankan lewat stdin ke mysql (SELECT saja) - hasilnya harus sama dengan harap.txt baris 1;
 2. md5 tiap blangko RTF di rtf-daftar-tambal.tsv dihitung di server (md5sum) dan dibandingkan dengan md5_lama di daftar.
pakai: python konfirmasi_server.py"""
import os
import subprocess
import sys

AL = os.path.dirname(os.path.abspath(__file__))
PK = os.path.join(AL, '..', 'paket-satker')
N = 'abt-pihak-urut-ecourt-27okt'
B = '/var/www/html/aps_badilag/_blangko_abt/derry_briantono'

harap = open(os.path.join(PK, 'harap.txt')).read().split('\n')[0].strip()
sql = open(os.path.join(PK, '%s-PRASYARAT.sql' % N), 'rb').read()
p = subprocess.run(['ssh', 'aleta', 'export MYSQL_PWD=$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD); mysql -h 127.0.0.1 -u root --default-character-set=latin1 -N aps_badilag'],
                   input=sql, capture_output=True)
hasil = p.stdout.decode().strip().split('\n')[-1].strip()
print('PRASYARAT di server:', hasil, '| diharapkan:', harap, '|', 'COCOK' if hasil == harap else 'BEDA')

baris = [l.rstrip('\n').split('\t') for l in open(os.path.join(PK, 'rtf-daftar-tambal.tsv'), encoding='utf-8')]
data = b''.join(r[1].encode('utf-8') + b'\0' for r in baris)
p = subprocess.run(['ssh', 'aleta', 'cd %s && xargs -0 md5sum' % B], input=data, capture_output=True)
got = {}
for l in p.stdout.decode('utf-8', 'replace').strip().split('\n'):
    m, _, f = l.partition('  ')
    got[f] = m
ok = sum(1 for r in baris if got.get(r[1]) == r[2])
print('RTF: %d berkas, md5 server = md5_lama di daftar: %d' % (len(baris), ok))
sys.exit(0 if hasil == harap and ok == len(baris) else 1)
