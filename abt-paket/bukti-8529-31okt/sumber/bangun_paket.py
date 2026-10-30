# -*- coding: utf-8 -*-
"""Bangun paket ABT abt-bukti-8529-31okt (keputusan pengguna 31 Okt butir 9): cabang terakhir 8529 (pertimbangan bukti surat
perceraian verstek) - daftar bukti surat (#1214#) tanpa KTP maupun surat domisili - dulu berbunyi "[HURUF ALASAN PERCERAIAN BELUM
DIPILIH]" (bunyi itu bukan soal huruf alasan) -> "[BUKTI SURAT KTP/SURAT DOMISILI BELUM ADA DI DAFTAR BUKTI]". Cabang lain, termasuk
paragraf murtad paket murtad-8529-30okt, tidak disentuh.
URUTAN: SESUDAH SEMUA paket abt-paket/URUTAN-PASANG-31okt.md (8529 juga disentuh alasan-belum-dipilih, murtad-8529, hir-rbg):
md5 dasar = keadaan sesudah rantai (basis salinan aps_badilag_g1r = salinan aps_badilag_rantai uji-rantai-31okt).
pakai: python bangun_paket.py <basis salinan sesudah rantai>"""
import io, os, subprocess, sys
SINI = os.path.dirname(os.path.abspath(__file__))
PK = os.path.join(SINI, '..', 'paket-satker')
N = 'abt-bukti-8529-31okt'
MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
db = sys.argv[1]
SEMUA = ['8529']
LAMA = '<mark>[HURUF ALASAN PERCERAIAN BELUM DIPILIH]</mark>'
BARU = '<mark>[BUKTI SURAT KTP/SURAT DOMISILI BELUM ADA DI DAFTAR BUKTI]</mark>'
PRASYARAT_ALASAN = 'telah keluar dari agama Islam'  # paket murtad-8529-30okt harus sudah terpasang
NORM = "REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')"
GANTI = "REPLACE(%s, '" + LAMA + "', '" + BARU + "')"


def q(sql):
    r = subprocess.run([MYSQL, '-u', 'root', '-h', '127.0.0.1', '-N', '--default-character-set=latin1', db, '-e', sql], capture_output=True)
    if r.returncode:
        sys.exit(r.stderr.decode('latin1'))
    return [l.split('\t') for l in r.stdout.decode('latin1').splitlines()]


rows = q("SELECT no_var, MD5(%s), MD5(%s), (CHAR_LENGTH(sql_query) - CHAR_LENGTH(REPLACE(sql_query, '%s', ''))) / CHAR_LENGTH('%s'), "
         "LOCATE('%s', sql_query) > 0, modifier FROM abt_variabel WHERE no_var IN (%s) ORDER BY no_var"
         % (NORM, GANTI % NORM, LAMA, LAMA, PRASYARAT_ALASAN, ','.join(SEMUA)))
assert len(rows) == 1, rows
for no, a, b, n, alasan, modifier in rows:
    assert float(n) == 1.0, (no, n)  # tepat satu cabang agama per variabel
    assert alasan == '1', (no, 'paket murtad-8529-30okt belum terpasang di basis ini')
    assert modifier == 'admin', (no, modifier)  # hanya variabel pekerjaan Derry
SBL = sorted(r[1] for r in rows)
SSD = sorted(r[2] for r in rows)
IN = ','.join(SEMUA)
L = ','.join("'%s'" % x for x in SBL)
B = ','.join("'%s'" % x for x in SSD)


def tulis(nama, isi):
    with io.open(os.path.join(PK, nama), 'w', encoding='utf-8', newline='\n') as f:
        f.write(isi)


os.makedirs(PK, exist_ok=True)
tulis(N + '-PRASYARAT.sql',
      "-- PRASYARAT %s (BACA SAJA). Satu baris A|B:\n"
      "--  A = 8529 PERSIS sebelum paket ini (= sesudah seluruh rantai URUTAN-PASANG-31okt): 1 sebelum, 0 sesudah\n"
      "--  B = 8529 PERSIS hasil paket ini: 0 sebelum, 1 sesudah\n"
      "-- Pasang bila 1|0; pasang ulang bila 0|1; selain itu (rantai belum lengkap / 8529 disunting) berhenti tanpa mengubah apa pun.\n"
      "SELECT CONCAT_WS('|',\n (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s)),\n"
      " (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s))\n) AS prasyarat;\n" % (N, IN, NORM, L, IN, NORM, B))
tulis(N + '-PASANG.sql',
      "-- Paket ABT \"%s\": satu transaksi; hanya cabang terakhir 8529 (frasa lama persis) yang diganti, baris lain tidak disentuh.\n"
      "START TRANSACTION;\nUPDATE abt_variabel SET sql_query = %s\n WHERE no_var IN (%s) AND MD5(%s) IN (%s);\nCOMMIT;\n" % (N, GANTI % 'sql_query', IN, NORM, L))
tulis(N + '-PULIH.sql',
      "-- PULIH %s: frasa lama dikembalikan, hanya baris yang masih persis hasil paket.\n"
      "START TRANSACTION;\n"
      "UPDATE abt_variabel SET sql_query = REPLACE(sql_query, '%s', '%s') WHERE no_var IN (%s) AND MD5(%s) IN (%s);\n"
      "COMMIT;\n" % (N, BARU, LAMA, IN, NORM, B))
tulis(N + '-PERIKSA.sql',
      "-- PERIKSA %s (BACA SAJA). Baris terakhir harus \"SEMUA COCOK\".\n"
      "SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s)) = 1\n"
      "  AND (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND LOCATE('[HURUF ALASAN PERCERAIAN BELUM DIPILIH]', sql_query) > 0) = 0\n"
      "  AND (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND LOCATE('%s', sql_query) > 0) = 1,\n"
      "  'SEMUA COCOK', 'TIDAK COCOK') AS periksa;\n" % (N, IN, NORM, B, IN, IN, BARU))
tulis('harap.txt', '1|0\n0|1\n')
print('sebelum', SBL, '\nsesudah', SSD)
