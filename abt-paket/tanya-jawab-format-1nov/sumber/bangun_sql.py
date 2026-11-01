# -*- coding: utf-8 -*-
"""Bangun berkas SQL paket abt-tanya-jawab-format-1nov: HANYA variabel #5404# yang diubah (kueri baru, satu variabel, tanpa variabel/menu baru).

pakai: python bangun_sql.py <folder paket-satker> [<basis ABT keadaan DASAR (sesudah 28 paket)>]
Nilai lama #5404# dibaca dari basis dasar (md5 kueri & nama) - basis harus masih keadaan dasar (belum dipasang paket ini).
"""
import hashlib
import os
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
import kueri_5404 as K  # noqa: E402

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
N = 'abt-tanya-jawab-format-1nov'


def md5b(b):
    return hashlib.md5(b).hexdigest()


def hexs(s):
    return '0x' + s.encode('latin1').hex()


def sql(q, basis):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '--raw', '--default-character-set=latin1', basis], input=q.encode('latin1'), capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode('latin1')[-400:])
    return r.stdout.decode('latin1')


def main():
    keluar = sys.argv[1]
    basis = sys.argv[2] if len(sys.argv) > 2 else 'aps_badilag_w164d'
    os.makedirs(keluar, exist_ok=True)
    nama_lama = bytes.fromhex(sql('SELECT HEX(nama) FROM abt_variabel WHERE no_var = 5404', basis).strip()).decode('latin1')
    sql_lama = bytes.fromhex(sql('SELECT HEX(sql_query) FROM abt_variabel WHERE no_var = 5404', basis).strip()).decode('latin1')
    md5_sql_lama = sql("SELECT MD5(IFNULL(sql_query,'')) FROM abt_variabel WHERE no_var = 5404", basis).strip()
    md5_nama = sql('SELECT MD5(nama) FROM abt_variabel WHERE no_var = 5404', basis).strip()
    assert md5b(sql_lama.encode('latin1')) == md5_sql_lama, 'kueri lama terbaca tidak sama dengan md5 basis'
    assert md5b(nama_lama.encode('latin1')) == md5_nama
    sql_baru = K.kueri()
    md5_sql_baru = md5b(sql_baru.encode('latin1'))
    kepala = ('-- Paket ABT "%s" (1 Nov 2026, agen M; keputusan pengguna 86): #5404# MAJELIS HAKIM DAN PANITERA SIDANG diganti kueri baru: membandingkan susunan hakim/panitera '
              'SIDANG INI dengan SIDANG SEBELUMNYA dari SIPP dan menyusun kalimat pergantian lengkap. Satu variabel; tanpa variabel/menu baru. Hanya pengguna derry_briantono.\n' % N)
    # PRASYARAT A|B|C
    pras = kepala + ('-- PRASYARAT (baca saja) "A|B|C": A = #5404# masih PERSIS keadaan dasar (1 pertama, 0 ulang) | B = #5404# sudah persis isi baru (0 pertama, 1 ulang) | '
                     'C = variabel yang dirujuk kueri (#0033# tanggal sidang, #6091# tanggal sidang sebelumnya, #6034# sebutan panitera) ada (3).\n')
    pras += ("SELECT CONCAT_WS('|',\n  (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 5404 AND MD5(IFNULL(sql_query, '')) = '%s' AND MD5(nama) = '%s'),\n"
             "  (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 5404 AND MD5(IFNULL(sql_query, '')) = '%s' AND MD5(nama) = '%s'),\n"
             "  (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN ('0033', '6034', '6091'))) AS p;\n" % (md5_sql_lama, md5_nama, md5_sql_baru, md5_nama))
    open(os.path.join(keluar, '%s-PRASYARAT.sql' % N), 'w', encoding='latin1', newline='\n').write(pras)
    open(os.path.join(keluar, 'harap.txt'), 'w', encoding='utf-8', newline='\n').write('1|0|3\n0|1|3\n')
    open(os.path.join(keluar, 'nomor-diubah.txt'), 'w', encoding='utf-8', newline='\n').write('# variabel LAMA yang kuerinya diubah (tidak ada variabel baru)\n5404\n')
    # PASANG
    p = [kepala, '-- PASANG: satu transaksi; #5404# diubah HANYA bila kuerinya persis dasar (md5).\n', 'START TRANSACTION;\n',
         "UPDATE abt_variabel SET sql_query = %s WHERE no_var = 5404 AND MD5(IFNULL(sql_query, '')) = '%s' AND MD5(nama) = '%s';\n" % (hexs(sql_baru), md5_sql_lama, md5_nama),
         'COMMIT;\n']
    open(os.path.join(keluar, '%s-PASANG.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(p))
    # PERIKSA
    q = [kepala, '-- PERIKSA (baca saja): baris terakhir harus SEMUA COCOK\n',
         "SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var = 5404 AND MD5(IFNULL(sql_query, '')) = '%s' AND MD5(nama) = '%s') = 1, 'SEMUA COCOK', 'ADA BEDA'), '';\n" % (md5_sql_baru, md5_nama)]
    open(os.path.join(keluar, '%s-PERIKSA.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(q))
    # PULIH
    r = [kepala, '-- PULIH (deterministik): bila #5404# sudah disunting orang sesudah dipasang, DIBIARKAN (dilaporkan pulih-satker.sh).\n', 'START TRANSACTION;\n',
         "UPDATE abt_variabel SET sql_query = %s WHERE no_var = 5404 AND MD5(IFNULL(sql_query, '')) = '%s' AND MD5(nama) = '%s';\n" % (hexs(sql_lama), md5_sql_baru, md5_nama),
         'COMMIT;\n']
    open(os.path.join(keluar, '%s-PULIH.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(r))
    os.makedirs(os.path.join(keluar, '..', 'hasil'), exist_ok=True)
    open(os.path.join(keluar, '..', 'hasil', 'kueri-5404-baru.sql'), 'w', encoding='latin1', newline='\n').write(sql_baru + '\n')
    open(os.path.join(keluar, '..', 'hasil', 'kueri-5404-lama.sql'), 'w', encoding='latin1', newline='\n').write(sql_lama + '\n')
    print('SQL siap: 5404 lama md5 %s -> baru %s (%d karakter; penanda #nnnn# dalam kueri: %d)' % (md5_sql_lama, md5_sql_baru, len(sql_baru), sum(1 for _ in __import__('re').finditer(r'#[0-9]+#', sql_baru))))


if __name__ == '__main__':
    main()
