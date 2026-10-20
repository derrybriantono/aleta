# -*- coding: utf-8 -*-
"""Uji PASANG -> PERIKSA -> PASANG ulang -> PULIH paket abt-w2b-keluarga-lain di MariaDB LOKAL (XAMPP) pada basis sementara
`aps_badilag_uji_w2b` (salinan abt_variabel dari aps_badilag lokal; variabel lama yang dirujuk paket tetapi belum ada di salinan lokal
yang lebih tua diisi baris pengganti agar prasyarat sama dengan server). Basis sementara dihapus di akhir. Tidak menyentuh server.
Pakai: python uji_paket_lokal.py   (jalankan sumber/bangun_paket.py lebih dulu)"""
import os
import re
import subprocess
import sys

MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAKET = os.path.join(AKAR, 'paket-satker')
NAMA = 'abt-w2b-keluarga-lain'
DB = 'aps_badilag_uji_w2b'


def mysql(sql=None, berkas=None, db=None, charset='latin1'):
    arg = [MYSQL, '-h127.0.0.1', '-uroot', '--default-character-set=' + charset, '-N', '-B']
    if db:
        arg.append(db)
    if berkas:
        data = open(berkas, 'rb').read()
    else:
        data = sql.encode('utf-8')
    r = subprocess.run(arg, input=data, capture_output=True, timeout=300)
    return (r.stdout.decode('latin1') + r.stderr.decode('latin1')).strip()


def main():
    hasil = []

    def cek(nama, ok, rinci=''):
        hasil.append((nama, ok, rinci))
        print(('LULUS ' if ok else 'GAGAL ') + nama + (' | ' + rinci if rinci else ''))

    mysql('DROP DATABASE IF EXISTS %s; CREATE DATABASE %s CHARACTER SET latin1;' % (DB, DB))
    try:
        mysql('CREATE TABLE abt_variabel LIKE aps_badilag.abt_variabel; INSERT INTO abt_variabel SELECT * FROM aps_badilag.abt_variabel;', db=DB)
        # variabel lama yang dirujuk paket (dari PRASYARAT) tetapi belum ada di salinan lokal: baris pengganti
        pra = open(os.path.join(PAKET, NAMA + '-PRASYARAT.sql'), encoding='latin1').read()
        daftar = re.search(r"WHERE no_var IN \(((?:'\d{4}',?)+)\)\),'\|',0", pra)
        lama = [int(x) for x in re.findall(r"'(\d{4})'", daftar.group(1))] if daftar else []
        ada = set(int(x) for x in mysql('SELECT no_var FROM abt_variabel;', db=DB).split('\n') if x.strip().isdigit())
        for n in lama:
            if n not in ada:
                mysql("INSERT INTO abt_variabel (no_var, nama, data_type, locked, modifier, modified) VALUES (%d, 'pengganti uji', 'data_teks', 0, 'uji', NOW());" % n, db=DB)
        cek('variabel lama yang dirujuk', True, '%d dirujuk, %d diisi pengganti' % (len(lama), len([n for n in lama if n not in ada])))
        before = mysql('SELECT COUNT(*) FROM abt_variabel;', db=DB)
        r = mysql(berkas=os.path.join(PAKET, NAMA + '-PRASYARAT.sql'), db=DB)
        cek('PRASYARAT pertama "0|0|n|0|0"', bool(re.search(r'\b0\|0\|\d+\|0\|0\b', r)), r.split('\n')[-1])
        r = mysql(berkas=os.path.join(PAKET, NAMA + '-PASANG.sql'), db=DB)
        cek('PASANG tanpa galat', 'ERROR' not in r, r[:200])
        after = mysql('SELECT COUNT(*) FROM abt_variabel;', db=DB)
        r = mysql(berkas=os.path.join(PAKET, NAMA + '-PERIKSA.sql'), db=DB)
        cek('PERIKSA "SEMUA COCOK"', r.strip().endswith('SEMUA COCOK'), r.split('\n')[-1])
        r = mysql(berkas=os.path.join(PAKET, NAMA + '-PASANG.sql'), db=DB)
        cek('PASANG ulang aman (tidak menambah baris)', 'ERROR' not in r and mysql('SELECT COUNT(*) FROM abt_variabel;', db=DB) == after, r[:200])
        # variabel yang diubah orang tidak ikut terhapus oleh PULIH
        r = mysql(berkas=os.path.join(PAKET, NAMA + '-PULIH.sql'), db=DB)
        cek('PULIH "PULIH COCOK"', r.strip().endswith('PULIH COCOK'), r.split('\n')[-1])
        cek('PULIH mengembalikan jumlah baris semula', mysql('SELECT COUNT(*) FROM abt_variabel;', db=DB) == before, '%s -> %s -> %s' % (before, after, mysql('SELECT COUNT(*) FROM abt_variabel;', db=DB)))
        # variabel yang sudah disunting orang sesudah dipasang tidak dihapus PULIH
        mysql(berkas=os.path.join(PAKET, NAMA + '-PASANG.sql'), db=DB)
        mysql("UPDATE abt_variabel SET nama=CONCAT(nama,' (disunting)') WHERE no_var=(SELECT MIN(n) FROM (SELECT no_var n FROM abt_variabel WHERE no_var BETWEEN 4850 AND 4949) x);", db=DB)
        r = mysql(berkas=os.path.join(PAKET, NAMA + '-PULIH.sql'), db=DB)
        sisa = mysql('SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4850 AND 4949;', db=DB)
        cek('PULIH membiarkan variabel yang disunting orang', sisa == '1' and 'PULIH TIDAK LENGKAP' in r, 'sisa=%s | %s' % (sisa, r.split('\n')[-1][:100]))
    finally:
        mysql('DROP DATABASE IF EXISTS %s;' % DB)
    if not all(h[1] for h in hasil):
        sys.exit(1)


if __name__ == '__main__':
    main()
