# -*- coding: utf-8 -*-
"""Bagian A paket perbaikan-1nov: berkas SQL (PRASYARAT/PASANG/PERIKSA/PULIH) untuk variabel 2111/7119/2112/7121 (aturan tundaan).
Tanpa variabel baru. pakai: python bangun_variabel.py <folder paket-satker> <basis ABT keadaan DASAR (sesudah 29 paket)>
"""
import hashlib
import io
import os
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
import kueri_pembuktian as Q  # noqa: E402
from tulis_tsv import VAR, lama as baca_lama  # noqa: E402

N = 'abt-perbaikan-1nov'
NORM = "REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')"
md5 = lambda t: hashlib.md5(t.encode('latin1')).hexdigest()
hexl = lambda t: t.encode('latin1').hex().upper()


def tulis(folder, nama, isi):
    with io.open(os.path.join(folder, nama), 'w', encoding='utf-8', newline='\n') as f:
        f.write(isi)


def main():
    folder, basis = sys.argv[1], sys.argv[2]
    os.makedirs(folder, exist_ok=True)
    no_list = [no for no, _ in VAR]
    UBAH = {}
    for no, jenis in VAR:
        t = baca_lama(basis, no)
        UBAH[no] = (t, Q.ubah(t, jenis))
    IN = ','.join(no_list)
    L = ','.join("'%s'" % md5(UBAH[k][0]) for k in no_list)
    B = ','.join("'%s'" % md5(UBAH[k][1]) for k in no_list)
    n = len(no_list)
    tulis(folder, N + '-PRASYARAT.sql',
          "-- PRASYARAT %s (BACA SAJA). Satu baris A|B:\n"
          "--  A = variabel %s yang isinya PERSIS keadaan sesudah 29 paket (hasil pembuktian-urut-1nov): %d sebelum, 0 sesudah\n"
          "--  B = variabel yang sama yang isinya PERSIS hasil paket ini: 0 sebelum, %d sesudah\n"
          "-- Pasang bila %d|0; pasang ulang bila 0|%d; selain itu berhenti tanpa mengubah apa pun.\n"
          "SELECT CONCAT_WS('|',\n (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s)),\n"
          " (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s))\n"
          ") AS prasyarat;\n" % (N, IN, n, n, n, n, IN, NORM, L, IN, NORM, B))
    pasang = ''.join("UPDATE abt_variabel SET sql_query = CONVERT(UNHEX('%s') USING latin1)\n WHERE no_var = %s AND MD5(%s) = '%s';\n"
                     % (hexl(UBAH[k][1]), k, NORM, md5(UBAH[k][0])) for k in no_list)
    tulis(folder, N + '-PASANG.sql', "-- Paket ABT \"%s\": satu transaksi; tiap baris hanya diubah bila isinya persis keadaan sebelum paket.\n"
          "START TRANSACTION;\n%sCOMMIT;\n" % (N, pasang))
    pulih = ''.join("UPDATE abt_variabel SET sql_query = CONVERT(UNHEX('%s') USING latin1)\n WHERE no_var = %s AND MD5(%s) = '%s';\n"
                    % (hexl(UBAH[k][0]), k, NORM, md5(UBAH[k][1])) for k in no_list)
    tulis(folder, N + '-PULIH.sql', "-- PULIH %s: isi hasil pembuktian-urut-1nov dikembalikan persis, hanya baris yang masih persis hasil paket ini.\n"
          "START TRANSACTION;\n%sCOMMIT;\n" % (N, pulih))
    tulis(folder, N + '-PERIKSA.sql',
          "-- PERIKSA %s (BACA SAJA). Harus \"SEMUA COCOK\".\n"
          "SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s)) = %d, 'SEMUA COCOK', 'TIDAK COCOK') AS periksa;\n"
          % (N, IN, NORM, B, n))
    tulis(folder, 'harap.txt', '%d|0\n0|%d\n' % (n, n))
    tulis(folder, 'nomor-variabel.txt', '# variabel yang diubah paket (syarat agenda cabang jadwal sidang diberi aturan tundaan; tidak ada variabel baru)\n' + '\n'.join(no_list) + '\n')
    for k in no_list:
        print(k, md5(UBAH[k][0]), '->', md5(UBAH[k][1]), len(UBAH[k][1]))


if __name__ == '__main__':
    main()
