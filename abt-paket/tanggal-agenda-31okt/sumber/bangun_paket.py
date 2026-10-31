# -*- coding: utf-8 -*-
"""Bangun paket ABT abt-tanggal-agenda-31okt (31 Okt 2026, keputusan pengguna butir 25).

Tanggal & hari jawaban/replik/duplik/duplik rekonvensi/kesimpulan/pembuktian (14 variabel blangko Derry) dahulu HANYA dari
Court Calendar SIPP (perkara_court_calendar). Bila Court Calendar tidak memuat agenda itu (perkara biasa / tidak dijadwalkan di
Court Calendar), kini diambil dari JADWAL SIDANG SIPP (perkara_jadwal_sidang): sidang PERTAMA yang agendanya memuat kata itu.
Bila Court Calendar memuatnya, hasilnya TETAP SAMA PERSIS (cabang Court Calendar disalin utuh dari kueri lama, dijalankan lebih dulu).
Kueri lama tidak dibuang: PULIH = isi lama persis. md5 atas bentuk server (nama basis salinan -> aps_badilag.).
pakai: python bangun_paket.py <basis salinan sesudah semua paket URUTAN-PASANG-31okt>"""
import hashlib, io, os, re, subprocess, sys
SINI = os.path.dirname(os.path.abspath(__file__))
PK = os.path.join(SINI, '..', 'paket-satker')
N = 'abt-tanggal-agenda-31okt'
MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
db = sys.argv[1]
NORM = "REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')"

A = "LOWER(j.agenda)"
BUKTI = "(%s LIKE '%%bukti%%' OR %s LIKE '%%saksi%%')" % (A, A)
# Pembuktian pihak kedua: sebutan Tergugat/Termohon TEPAT sesudah kata bukti/saksi ("pembuktian tergugat", "saksi termohon",
# "pembuktian lanjutan tergugat", "pembuktian penggugat dan tergugat"). "pembuktian dan panggil tergugat" BUKAN pembuktian Tergugat.
RE_T = "(bukti|saksi)[a-z-]*( lanjutan| tambahan)?( dari| oleh)? ((penggugat|pemohon) dan )?(tergugat|termohon)"
RE_P = "(bukti|saksi)[a-z-]*( lanjutan| tambahan)?( dari| oleh)? (penggugat|pemohon)"
AGENDA = {
    'jawaban': "%s LIKE '%%jawab%%' AND %s NOT LIKE '%%rekonvensi%%'" % (A, A),
    'replik': "%s LIKE '%%replik%%' AND %s NOT LIKE '%%replik rekonvensi%%'" % (A, A),
    'duplik': "%s LIKE '%%duplik%%' AND %s NOT LIKE '%%duplik rekonvensi%%'" % (A, A),
    'duplik-rek': "%s LIKE '%%duplik rekonvensi%%'" % A,
    'kesimpulan': "%s LIKE '%%kesimpulan%%'" % A,
    # Pembuktian pihak pertama: agenda pembuktian/saksi yang bukan KHUSUS pihak kedua (pembuktian tanpa sebutan pihak = pihak
    # pertama yang membuktikan lebih dulu - termasuk perkara verstek).
    'bukti-p': "%s AND (%s REGEXP '%s' OR NOT %s REGEXP '%s')" % (BUKTI, A, RE_P, A, RE_T),
    'bukti-t': "%s AND %s REGEXP '%s'" % (BUKTI, A, RE_T),
}
VAR = [('7111', 'jawaban'), ('7115', 'jawaban'), ('7112', 'replik'), ('7116', 'replik'), ('7113', 'duplik'), ('7117', 'duplik'),
       ('7114', 'duplik-rek'), ('7118', 'duplik-rek'), ('8438', 'kesimpulan'), ('7122', 'kesimpulan'), ('2111', 'bukti-p'),
       ('7119', 'bukti-p'), ('2112', 'bukti-t'), ('7121', 'bukti-t')]
NO = [v for v, _ in VAR]


def q(sql):
    r = subprocess.run([MYSQL, '-u', 'root', '-h', '127.0.0.1', '-N', '--default-character-set=latin1', db, '-e', sql], capture_output=True)
    if r.returncode:
        sys.exit(r.stderr.decode('latin1'))
    return [l.split('\t') for l in r.stdout.decode('latin1').splitlines()]


def lama(no):
    rows = q("SELECT HEX(%s) FROM abt_variabel WHERE no_var = %s" % (NORM, no))
    assert len(rows) == 1, (no, rows)
    return bytes.fromhex(rows[0][0]).decode('latin1')


def baru(s, jenis):
    """Cabang Court Calendar lama utuh + cabang jadwal sidang + baris kosong bila keduanya tidak ada."""
    assert 'perkara_jadwal_sidang' not in s, 'sudah diubah?'
    nl = '\r\n' if '\r\n' in s else '\n'
    # Cabang Court Calendar disalin PERSIS (akhir baris aslinya ikut); bagian baru memakai akhir baris yang sama.
    bagian = re.split(r'\r?\n\s*UNION ALL\s*\r?\n', s)
    assert len(bagian) == 2, bagian
    cc = bagian[0].rstrip()
    m = re.match(r'(?s)^SELECT\s+(.*?)\s+AS data\s+FROM\s+perkara_court_calendar\s+WHERE\s+(.*)$', cc.strip())
    assert m, cc
    ekspr, syarat = m.group(1).replace('\r\n', '\n'), m.group(2).strip().replace('\r\n', '\n')
    assert ekspr.count('rencana_tanggal') == 1
    ekspr_j = ekspr.replace('rencana_tanggal', 'j.tanggal_sidang')
    ag = AGENDA[jenis]
    return cc + ("\n\nUNION ALL\n\n"
            "(SELECT\n  " + ekspr_j + " AS data\nFROM\n  perkara_jadwal_sidang j\nWHERE\n  j.perkara_id = #perkara_id#\n  AND " + ag + "\n"
            "  AND NOT EXISTS (\n    SELECT 1\n    FROM perkara_court_calendar\n    WHERE\n      " + syarat + "\n  )\n"
            "ORDER BY j.tanggal_sidang, j.id\nLIMIT 1)\n\nUNION ALL\n\n"
            "SELECT '' AS data\nFROM DUAL\nWHERE NOT EXISTS (\n  SELECT 1\n  FROM perkara_court_calendar\n  WHERE\n    " + syarat + "\n)\n"
            "AND NOT EXISTS (\n  SELECT 1\n  FROM perkara_jadwal_sidang j\n  WHERE\n    j.perkara_id = #perkara_id#\n    AND " + ag + "\n);").replace('\n', nl)


UBAH = {}
for no, jenis in VAR:
    s = lama(no)
    UBAH[no] = (s, baru(s, jenis))
md5 = lambda t: hashlib.md5(t.encode('latin1')).hexdigest()
hexl = lambda t: t.encode('latin1').hex().upper()
IN = ','.join(NO)
L = ','.join("'%s'" % md5(UBAH[k][0]) for k in NO)
B = ','.join("'%s'" % md5(UBAH[k][1]) for k in NO)
n = len(NO)


def tulis(nama, isi):
    with io.open(os.path.join(PK, nama), 'w', encoding='utf-8', newline='\n') as f:
        f.write(isi)


os.makedirs(PK, exist_ok=True)
tulis(N + '-PRASYARAT.sql',
      "-- PRASYARAT %s (BACA SAJA). Satu baris A|B:\n"
      "--  A = variabel %s yang isinya PERSIS keadaan sebelum paket (%d sebelum, 0 sesudah)\n"
      "--  B = variabel yang sama yang isinya PERSIS hasil paket (0 sebelum, %d sesudah)\n"
      "-- Pasang bila %d|0; pasang ulang bila 0|%d; selain itu berhenti tanpa mengubah apa pun.\n"
      "SELECT CONCAT_WS('|',\n (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s)),\n"
      " (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s))\n"
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
      "-- PERIKSA %s (BACA SAJA). Harus \"SEMUA COCOK\".\n"
      "SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s)) = %d, 'SEMUA COCOK', 'TIDAK COCOK') AS periksa;\n"
      % (N, IN, NORM, B, n))
tulis('harap.txt', '%d|0\n0|%d\n' % (n, n))
tulis('nomor-variabel.txt', '# variabel yang diubah paket (cabang jadwal sidang ditambahkan; tidak ada variabel baru)\n' + '\n'.join(NO) + '\n')
# Kueri sesudah (bentuk server) untuk uji banding atas SIPP.
os.makedirs(os.path.join(SINI, '..', 'hasil'), exist_ok=True)
with io.open(os.path.join(SINI, '..', 'hasil', 'kueri-lama-baru.tsv'), 'w', encoding='utf-8', newline='\n') as f:
    for k in NO:
        f.write('%s\t%s\t%s\n' % (k, UBAH[k][0].replace('\n', '\\n').replace('\t', ' '), UBAH[k][1].replace('\n', '\\n').replace('\t', ' ')))
for k in NO:
    print(k, md5(UBAH[k][0]), '->', md5(UBAH[k][1]))
