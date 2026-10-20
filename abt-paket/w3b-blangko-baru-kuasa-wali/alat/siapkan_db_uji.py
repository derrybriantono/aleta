# -*- coding: utf-8 -*-
"""Menyiapkan DB uji lokal `aps_badilag_w3b` (MariaDB XAMPP di D:) yang meniru ABT server untuk uji pasang/pulih paket:
  - tabel abt_variabel (stub: SEMUA nomor variabel server 21 Okt, tanpa kueri), abt_menu (baris asli server), abt_data_teks / abt_data_tanggal (kosong);
  - pohon blangko uji `D:/Aplikasi/aleta/tmp/w3b-blangko/derry_briantono` (kosong).
Data server dibaca SELECT saja (ssh aleta lihat-jejak). Pakai: python siapkan_db_uji.py"""
import os
import pickle
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
MYSQL = 'D:/satker asal/website pa bungku/xampp/mysql/bin/mysql.exe'
DB = 'aps_badilag_w3b'


def my(sql, db=None):
    cmd = [MYSQL, '-h', '127.0.0.1', '-u', 'root', '--default-character-set=latin1'] + ([db] if db else [])
    r = subprocess.run(cmd, input=sql.encode('latin1', 'replace'), capture_output=True)
    if r.returncode:
        raise RuntimeError(r.stderr.decode('latin1', 'replace'))
    return r.stdout.decode('latin1', 'replace')


def hexs(t):
    return '0x' + t.encode('cp1252', 'replace').hex() if t is not None else 'NULL'


def ssh(sql):
    r = subprocess.run(['ssh', '-o', 'ConnectTimeout=25', 'aleta', 'bash /root/lihat-jejak.sh "$(cat)"'], input=sql.encode('utf-8'), capture_output=True, timeout=180)
    return r.stdout.decode('utf-8', 'replace')


def main():
    my('DROP DATABASE IF EXISTS %s; CREATE DATABASE %s CHARACTER SET latin1;' % (DB, DB))
    for t in ('abt_variabel', 'abt_menu', 'abt_data_teks', 'abt_data_tanggal'):
        my('CREATE TABLE %s LIKE aps_badilag.%s' % (t, t), DB)
    server = pickle.load(open('D:/aleta-dev/kerja/w3b-var-server.pkl', 'rb'))
    baris = []
    for no, (tipe, nama) in sorted((k, v) for k, v in server.items() if k.isdigit()):
        baris.append("(%d, %s, %s, 0, 'admin')" % (int(no), hexs(nama[:190]), hexs(tipe if tipe != 'NULL' else 'data_teks')))
    for i in range(0, len(baris), 300):
        my('INSERT INTO abt_variabel (no_var, nama, data_type, locked, modifier) VALUES ' + ','.join(baris[i:i + 300]), DB)
    # menu asli server
    out = ssh('SELECT id, nama, nama_alias, direktori, parent_direktori, proses_id_min, proses_id_max, IFNULL(perkara_id_min,"~"), IFNULL(perkara_id_max,"~"), IFNULL(perkara_id_referensi,"~"), user_cek, IFNULL(user_grup_id,"~"), IFNULL(user_top_id,"~"), IFNULL(user_validator,"~") FROM aps_badilag.abt_menu')
    menu = [l.split('\t') for l in out.split('\n')[1:] if l.strip()]
    vals = []
    nul = lambda x: 'NULL' if x in ('~', 'NULL') else hexs(x)
    angka = lambda x: 'NULL' if x in ('~', 'NULL') else str(int(x))
    for m in menu:
        if len(m) < 14:
            continue
        vals.append('(%d, %s, %s, %s, %s, %d, %d, %s, %s, %s, %d, %s, %s, %s)' % (int(m[0]), hexs(m[1]), hexs(m[2]), hexs(m[3]), hexs(m[4]), int(m[5]), int(m[6]), angka(m[7]), angka(m[8]), nul(m[9]), int(m[10]), nul(m[11]), nul(m[12]), nul(m[13])))
    my('INSERT INTO abt_menu (id, nama, nama_alias, direktori, parent_direktori, proses_id_min, proses_id_max, perkara_id_min, perkara_id_max, perkara_id_referensi, user_cek, user_grup_id, user_top_id, user_validator) VALUES ' + ','.join(vals), DB)
    os.makedirs('D:/Aplikasi/aleta/tmp/w3b-blangko/derry_briantono', exist_ok=True)
    print('DB %s siap: %d variabel stub, %d menu' % (DB, len(baris), len(vals)))


if __name__ == '__main__':
    main()
