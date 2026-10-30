# -*- coding: utf-8 -*-
"""Bangun paket ABT abt-agama-belum-diubah-30okt (G1 30 Okt 2026, rencana "Blangko ABT by Derry Briantono" disetujui pengguna):
cabang "alasan H dipilih tetapi agama pihak di SIPP belum diubah" pada 4 variabel alasan perceraian (8521, 8522, 8528, 8531)
berbunyi "TIDAK BENAR QUERY NYA / ALASAN H: AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP - ubah agama pihak itu di SIPP, lalu muat
ulang ABT" (ikut tercetak di putusan) -> "[AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP]" (tetap berstabilo <mark>). Petunjuk
perbaikannya pindah ke ekstensi (Periksa sebelum cetak di Blangko Derry). Cabang lain tidak disentuh.
URUTAN: SESUDAH paket alasan-belum-dipilih-30okt (md5 dasar = keadaan sesudah paket itu, basis salinan aps_badilag_bas29).
md5 dihitung dari basis salinan (nama basis dinormalkan ke aps_badilag.) - sama dengan pemeriksaan di server.
pakai: python bangun_paket.py <basis salinan sesudah alasan-belum-dipilih-30okt>"""
import io, os, subprocess, sys
SINI = os.path.dirname(os.path.abspath(__file__))
PK = os.path.join(SINI, '..', 'paket-satker')
N = 'abt-agama-belum-diubah-30okt'
MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
db = sys.argv[1]
SEMUA = ['8521', '8522', '8528', '8531']
LAMA = '<mark>TIDAK BENAR QUERY NYA / ALASAN H: AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP - ubah agama pihak itu di SIPP, lalu muat ulang ABT</mark>'
BARU = '<mark>[AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP]</mark>'
PRASYARAT_ALASAN = '[HURUF ALASAN PERCERAIAN BELUM DIPILIH]'
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
assert len(rows) == 4, rows
for no, a, b, n, alasan, modifier in rows:
    assert float(n) == 1.0, (no, n)  # tepat satu cabang agama per variabel
    assert alasan == '1', (no, 'paket alasan-belum-dipilih-30okt belum terpasang di basis ini')
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
      "--  A = variabel 8521, 8522, 8528, 8531 yang isinya PERSIS sebelum paket ini (= sesudah paket alasan-belum-dipilih-30okt): 4 sebelum, 0 sesudah\n"
      "--  B = variabel yang sama yang isinya PERSIS hasil paket ini: 0 sebelum, 4 sesudah\n"
      "-- Pasang bila 4|0; pasang ulang bila 0|4; selain itu (mis. paket alasan-belum-dipilih-30okt belum dipasang) berhenti tanpa mengubah apa pun.\n"
      "SELECT CONCAT_WS('|',\n (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s)),\n"
      " (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s))\n) AS prasyarat;\n" % (N, IN, NORM, L, IN, NORM, B))
tulis(N + '-PASANG.sql',
      "-- Paket ABT \"%s\": satu transaksi; hanya cabang agama-belum-diubah (frasa lama persis) yang diganti, baris lain tidak disentuh.\n"
      "START TRANSACTION;\nUPDATE abt_variabel SET sql_query = %s\n WHERE no_var IN (%s) AND MD5(%s) IN (%s);\nCOMMIT;\n" % (N, GANTI % 'sql_query', IN, NORM, L))
tulis(N + '-PULIH.sql',
      "-- PULIH %s: frasa lama dikembalikan, hanya baris yang masih persis hasil paket.\n"
      "START TRANSACTION;\n"
      "UPDATE abt_variabel SET sql_query = REPLACE(sql_query, '%s', '%s') WHERE no_var IN (%s) AND MD5(%s) IN (%s);\n"
      "COMMIT;\n" % (N, BARU, LAMA, IN, NORM, B))
tulis(N + '-PERIKSA.sql',
      "-- PERIKSA %s (BACA SAJA). Baris terakhir harus \"SEMUA COCOK\".\n"
      "SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s)) = 4\n"
      "  AND (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND LOCATE('ALASAN H: AGAMA', sql_query) > 0) = 0\n"
      "  AND (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND LOCATE('%s', sql_query) > 0) = 4,\n"
      "  'SEMUA COCOK', 'TIDAK COCOK') AS periksa;\n" % (N, IN, NORM, B, IN, IN, BARU))
tulis('harap.txt', '4|0\n0|4\n')
print('sebelum', SBL, '\nsesudah', SSD)
