# -*- coding: utf-8 -*-
"""Tulis SQL paket abt-bukti-nomor-30okt (PRASYARAT, PASANG, PERIKSA, PULIH) dari PETA bangun_bukti. Deterministik.

Variabel baru membaca isian tersimpan (abt_data_teks) saja; isian belum disimpan tercetak "..." seperti sebelumnya.
pakai: python bangun_sql.py
"""
import hashlib, io, os, sys
SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'bas-tanya-jawab-29okt', 'sumber'))
sys.path.insert(0, SINI)
from bangun_bukti import PETA  # noqa: E402

BASIS = sys.argv[1] if len(sys.argv) > 1 else 'aps_badilag_2810'
MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
PK = os.path.join(SINI, '..', 'paket-satker')
N = 'abt-bukti-nomor-30okt'
NAMA = {
    '9955': 'BUKTI SURAT PERCERAIAN', '9911': 'BUKTI SURAT TERGUGAT/TERMOHON', '1214': 'ALAT BUKTI SURAT CERAI GUGAT/TALAK',
    '9958': 'ALAT BUKTI ITSBAT NIKAH TERPADU', '9956': 'BUKTI SURAT MENURUT JENIS PERKARA', '8131': 'ALAT BUKTI PERWALIAN ANAK',
    '8132': 'ALAT BUKTI PENETAPAN AHLI WARIS', '0378': 'BUKTI SURAT ITSBAT NIKAH',
}


def sql_var(sumber):
    # Isian yang belum disimpan tercetak "..." seperti isian ABT biasa (bawaan default_data hanya isi awal penyunting ABT,
    # tidak pernah dicetak) - diukur: render 367/Pdt.G/2026 bukti Tergugat kosong = "1. ...".
    no = int(sumber)
    return ("SELECT aps_badilag.isian_rtf_bukti((SELECT NULLIF(TRIM(d.data), '') FROM aps_badilag.abt_data_teks d "
            "WHERE d.no_var = %d AND d.perkara_id = '#perkara_id#' LIMIT 1)) AS data" % no)


def nama_var(sumber):
    return ('%s BERNOMOR (OTOMATIS dari isian #%s#: tiap baris satu butir 1., 2., ...; nomor ketikan dibuang)' % (NAMA[sumber], sumber))[:200]


def lit(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "''") + "'"


baris = []
for s, n in sorted(PETA.items(), key=lambda x: x[1]):
    q = sql_var(s)
    baris.append(dict(s=s, n=n, q=q, nama=nama_var(s), md5q=hashlib.md5(q.encode('latin1')).hexdigest()))
nomor = ','.join(b['n'] for b in baris)
sumber = ','.join(str(int(b['s'])) for b in baris)
K = len(baris)
md5q = ','.join("'%s'" % b['md5q'] for b in baris)
io.open(os.path.join(PK, 'nomor-baru.txt'), 'w', newline='\n').write(nomor + '\n')
MDQ = "MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.'))"

pras = ("-- PRASYARAT %s (BACA SAJA). Satu baris A|B|C|D|E:\n"
        "--  A = isian sumber (data_teks) ada: %s (harus %d)\n"
        "--  B = nomor variabel baru %s yang SUDAH dipakai (0 sebelum; %d sesudah - milik paket ini, lihat C)\n"
        "--  C = variabel baru yang isinya persis paket ini (0 sebelum, %d sesudah)\n"
        "--  D = fungsi isian_rtf_bukti ada (0 sebelum, 1 sesudah)\n"
        "--  E = baris abt_variabel seluruhnya (info)\n"
        "-- Pasang bila %d|0|0|0|*; pasang ulang bila %d|%d|%d|1|*. Selain itu berhenti tanpa mengubah apa pun.\n"
        "SELECT CONCAT_WS('|',\n"
        " (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND data_type = 'data_teks'),\n"
        " (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)),\n"
        " (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND data_type = 'data_sql' AND modifier = 'admin' AND %s IN (%s)),\n"
        " (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_type = 'FUNCTION' AND routine_name = 'isian_rtf_bukti'),\n"
        " (SELECT COUNT(*) FROM abt_variabel)\n) AS prasyarat;\n") % (
    N, sumber, K, nomor, K, K, K, K, K, K, sumber, nomor, nomor, MDQ, md5q)
io.open(os.path.join(PK, N + '-PRASYARAT.sql'), 'w', newline='\n').write(pras)
io.open(os.path.join(PK, 'harap.txt'), 'w', newline='\n').write('%d|0|0|0\n%d|%d|%d|1\n' % (K, K, K, K))

pasang = ["-- PASANG %s: %d variabel data_sql BARU (satu transaksi; nomor yang sudah ada tidak ditimpa)." % (N, K), "START TRANSACTION;"]
for b in baris:
    pasang.append("INSERT INTO abt_variabel (no_var, nama, data_type, sql_query, locked, modifier) SELECT %s, %s, 'data_sql', %s, 0, 'admin' "
                  "FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var = %s);" % (b['n'], lit(b['nama']), lit(b['q']), b['n']))
pasang.append("COMMIT;")
io.open(os.path.join(PK, N + '-PASANG.sql'), 'w', encoding='latin1', newline='\n').write('\n'.join(pasang) + '\n')

periksa = ("-- PERIKSA %s (BACA SAJA). Baris terakhir harus 'SEMUA COCOK'.\n"
           "SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND data_type = 'data_sql' AND modifier = 'admin' AND %s IN (%s)) = %d\n"
           "  AND isian_rtf_bukti(CONCAT('1.  A;', CHAR(10), '2.  B;')) = CONCAT('1.', CHAR(92), 'tab A;<br>2.', CHAR(92), 'tab B;')\n"
           "  AND isian_rtf_bukti(CONCAT('A;', CHAR(10), 'B;')) = CONCAT('1.', CHAR(92), 'tab A;<br>2.', CHAR(92), 'tab B;')\n"
           "  AND isian_rtf_bukti(CONCAT('1. A', CHAR(10), 'lanjutan;')) = CONCAT('1.', CHAR(92), 'tab A lanjutan;')\n"
           "  AND isian_rtf_bukti('12.000 rupiah') = CONCAT('1.', CHAR(92), 'tab 12.000 rupiah')\n"
           "  AND isian_rtf_bukti('') = CONCAT('1.', CHAR(92), 'tab ...') AND isian_rtf_bukti(NULL) = CONCAT('1.', CHAR(92), 'tab ...'),\n"
           "  'SEMUA COCOK', 'TIDAK COCOK') AS periksa;\n") % (N, nomor, MDQ, md5q, K)
io.open(os.path.join(PK, N + '-PERIKSA.sql'), 'w', newline='\n').write(periksa)

pulih = ("-- PULIH %s: variabel baru dihapus HANYA bila isinya masih persis paket (yang disunting dibiarkan dan dihitung).\n"
         "START TRANSACTION;\n"
         "DELETE FROM abt_variabel WHERE no_var IN (%s) AND data_type = 'data_sql' AND modifier = 'admin' AND %s IN (%s);\n"
         "SELECT CONCAT('VARIABEL DIHAPUS ', ROW_COUNT());\n"
         "COMMIT;\n"
         "SELECT CONCAT('VARIABEL TERSISA ', COUNT(*)) FROM abt_variabel WHERE no_var IN (%s);\n") % (N, nomor, MDQ, md5q, nomor)
io.open(os.path.join(PK, N + '-PULIH.sql'), 'w', newline='\n').write(pulih)
print('variabel', nomor)
