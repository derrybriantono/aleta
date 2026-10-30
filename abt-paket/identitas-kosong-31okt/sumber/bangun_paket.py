# -*- coding: utf-8 -*-
"""Bangun paket ABT abt-identitas-kosong-31okt dari basis salinan SESUDAH semua paket 29-30 Okt + variabel-sehat-30okt (aps_badilag_vs).
Keputusan sesi utama 31 Okt (pengguna tidur): identitas pihak yang datanya KOSONG di SIPP tidak lagi tercetak
"NIK , tempat dan tanggal lahir , 00 0000, agama , pekerjaan , pendidikan ," -> bagian kosong ditulis "..." (label tetap, satu kali),
agama kosong = "Islam" (keputusan pengguna 30 Okt), tanggal 0000-00-00 ("00 0000") = kosong. Nama dan alamat seperti biasa.
Caranya: fungsi baru isian_rtf_identitas_kosong(teks) (hanya REPLACE atas pola label-kosong; teks yang lengkap tidak berubah) dan
11 variabel identitas dibungkus: SELECT aps_badilag.isian_rtf_identitas_kosong(x.data) AS data FROM (<kueri lama>) x.
Kueri lama tidak disunting satu huruf pun (PULIH = isi lama persis). md5 atas bentuk server (nama basis salinan -> aps_badilag.).
pakai: python bangun_paket.py <basis salinan>"""
import hashlib, io, os, subprocess, sys
SINI = os.path.dirname(os.path.abspath(__file__))
PK = os.path.join(SINI, '..', 'paket-satker')
N = 'abt-identitas-kosong-31okt'
MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
db = sys.argv[1]
NORM = "REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')"
NO = ['3507', '3509', '3970', '3971', '7047', '7048', '7062', '9230', '9231', '11205', '11206']
BUKA = 'SELECT aps_badilag.isian_rtf_identitas_kosong(x.data) AS data FROM (\n'
TUTUP = '\n) x'


def q(sql):
    r = subprocess.run([MYSQL, '-u', 'root', '-h', '127.0.0.1', '-N', '--default-character-set=latin1', db, '-e', sql], capture_output=True)
    if r.returncode:
        sys.exit(r.stderr.decode('latin1'))
    return [l.split('\t') for l in r.stdout.decode('latin1').splitlines()]


def lama(no):
    rows = q("SELECT HEX(%s) FROM abt_variabel WHERE no_var = %s" % (NORM, no))
    assert len(rows) == 1, (no, rows)
    return bytes.fromhex(rows[0][0]).decode('latin1')


def bungkus(s):
    inti = s.rstrip()
    while inti.endswith(';'):
        inti = inti[:-1].rstrip()
    assert 'isian_rtf_identitas_kosong' not in inti
    return BUKA + inti + TUTUP


UBAH = {}
for no in NO:
    s = lama(no)
    UBAH[no] = (s, bungkus(s))
md5 = lambda t: hashlib.md5(t.encode('latin1')).hexdigest()
hexl = lambda t: t.encode('latin1').hex().upper()
IN = ','.join(NO)
L = ','.join("'%s'" % md5(UBAH[k][0]) for k in NO)
B = ','.join("'%s'" % md5(UBAH[k][1]) for k in NO)
n = len(NO)
FUNGSI = open(os.path.join(SINI, 'fungsi.sql'), encoding='utf-8').read()
FUNGSI = FUNGSI.replace('DROP FUNCTION IF EXISTS isian_rtf_identitas_kosong', 'DROP FUNCTION IF EXISTS aps_badilag.isian_rtf_identitas_kosong')
FUNGSI = FUNGSI.replace('FUNCTION isian_rtf_identitas_kosong(', 'FUNCTION aps_badilag.isian_rtf_identitas_kosong(')
assert FUNGSI.count('aps_badilag.isian_rtf_identitas_kosong') == 2


def tulis(nama, isi):
    with io.open(os.path.join(PK, nama), 'w', encoding='utf-8', newline='\n') as f:
        f.write(isi)


os.makedirs(PK, exist_ok=True)
tulis(N + '-FUNGSI.sql', "-- Paket ABT \"%s\": fungsi baru (hanya REPLACE, tanpa membaca tabel). aps_badilag. = basis ABT (pasang-satker.sh menggantinya di laptop).\n%s" % (N, FUNGSI))
tulis(N + '-FUNGSI-PULIH.sql', "-- PULIH fungsi paket %s (fungsi baru paket ini; tidak ada fungsi lama yang diganti).\nDROP FUNCTION IF EXISTS aps_badilag.isian_rtf_identitas_kosong;\n" % N)
tulis(N + '-PRASYARAT.sql',
      "-- PRASYARAT %s (BACA SAJA). Satu baris A|B|C:\n"
      "--  A = variabel %s yang isinya PERSIS keadaan sebelum paket (%d sebelum, 0 sesudah)\n"
      "--  B = variabel yang sama yang isinya PERSIS hasil paket (0 sebelum, %d sesudah)\n"
      "--  C = fungsi isian_rtf_identitas_kosong sudah ada (0 sebelum, 1 sesudah)\n"
      "-- Pasang bila %d|0|0; pasang ulang bila 0|%d|1; selain itu berhenti tanpa mengubah apa pun.\n"
      "SELECT CONCAT_WS('|',\n (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s)),\n"
      " (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s)),\n"
      " (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = 'isian_rtf_identitas_kosong')\n"
      ") AS prasyarat;\n" % (N, IN, n, n, n, n, IN, NORM, L, IN, NORM, B))
pasang = ''.join("UPDATE abt_variabel SET sql_query = CONVERT(UNHEX('%s') USING latin1)\n WHERE no_var = %s AND MD5(%s) = '%s';\n"
                 % (hexl(UBAH[k][1]), k, NORM, md5(UBAH[k][0])) for k in NO)
tulis(N + '-PASANG.sql', "-- Paket ABT \"%s\": satu transaksi; tiap baris hanya diubah bila isinya persis keadaan sebelum paket.\n"
      "START TRANSACTION;\n%sCOMMIT;\n" % (N, pasang))
pulih = ''.join("UPDATE abt_variabel SET sql_query = CONVERT(UNHEX('%s') USING latin1)\n WHERE no_var = %s AND MD5(%s) = '%s';\n"
                % (hexl(UBAH[k][0]), k, NORM, md5(UBAH[k][1])) for k in NO)
tulis(N + '-PULIH.sql', "-- PULIH %s: isi lama dikembalikan persis, hanya baris yang masih persis hasil paket (suntingan sesudahnya dibiarkan).\n"
      "START TRANSACTION;\n%sCOMMIT;\n" % (N, pulih))
tulis(N + '-PERIKSA.sql',
      "-- PERIKSA %s (BACA SAJA). Baris terakhir harus \"SEMUA COCOK\".\n"
      "SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s)) = %d\n"
      "  AND isian_rtf_identitas_kosong('<strong>A</strong>, NIK , tempat dan tanggal lahir , 00 0000, agama , pekerjaan , pendidikan , tempat kediaman di X, sebagai <strong>B</strong>;')\n"
      "    = '<strong>A</strong>, NIK ..., tempat dan tanggal lahir ..., agama Islam, pekerjaan ..., pendidikan ..., tempat kediaman di X, sebagai <strong>B</strong>;'\n"
      "  AND isian_rtf_identitas_kosong('<strong>A</strong>, NIK 1, tempat dan tanggal lahir P, 1 Mei 1990, agama Islam, pekerjaan Q, pendidikan S1, tempat kediaman di X;')\n"
      "    = '<strong>A</strong>, NIK 1, tempat dan tanggal lahir P, 1 Mei 1990, agama Islam, pekerjaan Q, pendidikan S1, tempat kediaman di X;',\n"
      "  'SEMUA COCOK', 'TIDAK COCOK') AS periksa;\n" % (N, IN, NORM, B, n))
tulis('harap.txt', '%d|0|0\n0|%d|1\n' % (n, n))
tulis('nomor-variabel.txt', '# variabel yang diubah paket (dibungkus fungsi isian_rtf_identitas_kosong; tidak ada variabel baru)\n' + '\n'.join(NO) + '\n')
for k in NO:
    print(k, md5(UBAH[k][0]), '->', md5(UBAH[k][1]))
