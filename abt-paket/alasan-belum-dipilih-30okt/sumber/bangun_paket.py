# -*- coding: utf-8 -*-
"""Bangun paket ABT abt-alasan-belum-dipilih-30okt (keputusan pengguna 30 Okt): cabang terakhir (ELSE) 10 variabel alasan
perceraian A-H yang berbunyi "TIDAK BENAR QUERY NYA" (isian 8503 kosong / bukan A-H) diganti "[HURUF ALASAN PERCERAIAN BELUM
DIPILIH]". Cabang lain (termasuk "TIDAK BENAR QUERY NYA / ALASAN H: AGAMA ... BELUM DIUBAH DI SIPP") tidak disentuh.
md5 dihitung dari basis salinan (nama basis dinormalkan ke aps_badilag.) - sama dengan pemeriksaan di server.
pakai: python bangun_paket.py <basis salinan>"""
import io, os, subprocess, sys
SINI = os.path.dirname(os.path.abspath(__file__))
PK = os.path.join(SINI, '..', 'paket-satker')
N = 'abt-alasan-belum-dipilih-30okt'
MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
db = sys.argv[1]
PANJANG = ['4020', '8530', '8531', '8532']
PENDEK = ['8511', '8512', '8521', '8522', '8528', '8529']
SEMUA = PANJANG + PENDEK
LAMA_P = '<mark>TIDAK BENAR QUERY NYA / BELUM ISI ALASAN DI KOLOM ABT</mark>'
LAMA_S = '<mark>TIDAK BENAR QUERY NYA</mark>'
BARU = '<mark>[HURUF ALASAN PERCERAIAN BELUM DIPILIH]</mark>'
NORM = "REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')"
GANTI = "REPLACE(REPLACE(%s, '%s', '%s'), '%s', '%s')" % ('%s', LAMA_P, BARU, LAMA_S, BARU)


def q(sql):
    r = subprocess.run([MYSQL, '-u', 'root', '-h', '127.0.0.1', '-N', '--default-character-set=latin1', db, '-e', sql], capture_output=True)
    if r.returncode:
        sys.exit(r.stderr.decode('latin1'))
    return [l.split('\t') for l in r.stdout.decode('latin1').splitlines()]


rows = q("SELECT no_var, MD5(%s), MD5(%s), (CHAR_LENGTH(sql_query) - CHAR_LENGTH(REPLACE(sql_query, 'TIDAK BENAR QUERY NYA', ''))) / 21, "
         "(CHAR_LENGTH(sql_query) - CHAR_LENGTH(REPLACE(sql_query, '%s', ''))) / CHAR_LENGTH('%s') + (CHAR_LENGTH(sql_query) - CHAR_LENGTH(REPLACE(sql_query, '%s', ''))) / CHAR_LENGTH('%s') "
         "FROM abt_variabel WHERE no_var IN (%s) ORDER BY no_var" % (NORM, GANTI % NORM, LAMA_P, LAMA_P, LAMA_S, LAMA_S, ','.join(SEMUA)))
assert len(rows) == 10, rows
for no, a, b, semua, ganti in rows:
    assert float(ganti) == 1.0, (no, ganti)  # tepat satu cabang ELSE yang diganti per variabel
LAMA = sorted(r[1] for r in rows)
BAR = sorted(r[2] for r in rows)
info = '\n'.join('--   %s: frasa lama %d kali (cabang ELSE yang diganti 1)' % (r[0], round(float(r[3]))) for r in rows)
IN = ','.join(SEMUA)
L = ','.join("'%s'" % x for x in LAMA)
B = ','.join("'%s'" % x for x in BAR)


def tulis(nama, isi):
    with io.open(os.path.join(PK, nama), 'w', encoding='utf-8', newline='\n') as f:
        f.write(isi)


os.makedirs(PK, exist_ok=True)
tulis(N + '-PRASYARAT.sql',
      "-- PRASYARAT %s (BACA SAJA). Satu baris A|B:\n"
      "--  A = variabel 4020, 8511, 8512, 8521, 8522, 8528, 8529, 8530, 8531, 8532 yang isinya PERSIS sebelum paket (10 sebelum, 0 sesudah)\n"
      "--  B = variabel yang sama yang isinya PERSIS hasil paket (0 sebelum, 10 sesudah)\n"
      "-- Pasang bila 10|0; pasang ulang bila 0|10; selain itu berhenti tanpa mengubah apa pun.\n"
      "-- Frasa lama per variabel (cabang lain, mis. alasan H agama belum diubah, TIDAK disentuh):\n%s\n"
      "SELECT CONCAT_WS('|',\n (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s)),\n"
      " (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s))\n) AS prasyarat;\n" % (N, info, IN, NORM, L, IN, NORM, B))
tulis(N + '-PASANG.sql',
      "-- Paket ABT \"%s\": satu transaksi; hanya cabang ELSE (frasa lama persis) yang diganti, baris lain tidak disentuh.\n"
      "START TRANSACTION;\nUPDATE abt_variabel SET sql_query = %s\n WHERE no_var IN (%s) AND MD5(%s) IN (%s);\nCOMMIT;\n" % (N, GANTI % 'sql_query', IN, NORM, L))
tulis(N + '-PULIH.sql',
      "-- PULIH %s: frasa dikembalikan per variabel (bentuk panjang %s, bentuk pendek %s), hanya baris yang masih persis hasil paket.\n"
      "START TRANSACTION;\n"
      "UPDATE abt_variabel SET sql_query = REPLACE(sql_query, '%s', '%s') WHERE no_var IN (%s) AND MD5(%s) IN (%s);\n"
      "UPDATE abt_variabel SET sql_query = REPLACE(sql_query, '%s', '%s') WHERE no_var IN (%s) AND MD5(%s) IN (%s);\n"
      "COMMIT;\n" % (N, ', '.join(PANJANG), ', '.join(PENDEK), BARU, LAMA_P, ','.join(PANJANG), NORM, B, BARU, LAMA_S, ','.join(PENDEK), NORM, B))
tulis(N + '-PERIKSA.sql',
      "-- PERIKSA %s (BACA SAJA). Baris terakhir harus \"SEMUA COCOK\".\n"
      "SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s)) = 10\n"
      "  AND (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND (LOCATE('%s', sql_query) > 0 OR LOCATE('%s', sql_query) > 0)) = 0,\n"
      "  'SEMUA COCOK', 'TIDAK COCOK') AS periksa;\n" % (N, IN, NORM, B, IN, LAMA_P, LAMA_S))
tulis('harap.txt', '10|0\n0|10\n')
print('lama', LAMA[:2], 'baru', BAR[:2])
