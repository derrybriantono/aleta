# -*- coding: utf-8 -*-
"""Bangun paket ABT abt-pembuktian-urut-1nov (1 Nov 2026, keputusan pengguna butir 52 - MENGGANTI butir 29-30).

Tanggal & hari pembuktian #0046# (2111/7119) dan #0047# (2112/7121) cabang JADWAL SIDANG (paket tanggal-agenda-31okt) kini
mengikuti URUTAN TAHAP pembuktian:
  - pembuktian selalu diawali Penggugat/Pemohon; "pembuktian lanjutan" melanjutkan pihak yang sedang membuktikan;
  - agenda pembuktian tanpa sebutan pihak SESUDAH pembuktian Penggugat selesai = pembuktian Tergugat/Termohon (perkara Pdt.G);
  - satu tahap bisa beberapa hari sidang; tanggal tahap = sidang pertamanya;
  - "pembuktian Penggugat selesai" dibaca dari data: agenda tegas pembuktian Tergugat, agenda kesimpulan, alasan ditunda /
    keterangan sidang (pembuktian Tergugat berikutnya, kesimpulan, Penggugat mencukupkan bukti, Tergugat sudah mulai membuktikan).
Pola POSIX diambil dari aleta_bot/services/tahapPembuktianService.js (SATU sumber; kembarannya diuji agenda-selingkuh-1nov.test.ts).
Cabang Court Calendar TIDAK diubah (tetap dijalankan lebih dulu). Hanya syarat agenda cabang jadwal sidang yang diganti.
pakai: python bangun_paket.py <basis salinan sesudah semua paket URUTAN-PASANG-31okt (termasuk tanggal-agenda-31okt)>"""
import hashlib, io, json, os, subprocess, sys
SINI = os.path.dirname(os.path.abspath(__file__))
PK = os.path.join(SINI, '..', 'paket-satker')
AKAR = os.path.abspath(os.path.join(SINI, '..', '..', '..'))
N = 'abt-pembuktian-urut-1nov'
MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
db = sys.argv[1]
NORM = "REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')"

POSIX = json.loads(subprocess.run(['node', '-e', 'process.stdout.write(JSON.stringify(require(process.argv[1]).POSIX))',
                                   os.path.join(AKAR, 'aleta_bot', 'services', 'tahapPembuktianService.js')],
                                  capture_output=True, check=True).stdout.decode('utf-8'))
for k, v in POSIX.items():
    assert "'" not in v and '\\' not in v, k

# --- syarat LAMA persis paket tanggal-agenda-31okt (harus ada 2x di tiap kueri) ---
A0 = "LOWER(j.agenda)"
BUKTI0 = "(%s LIKE '%%bukti%%' OR %s LIKE '%%saksi%%')" % (A0, A0)
RE_T0 = "(bukti|saksi)[a-z-]*( lanjutan| tambahan)?( dari| oleh)? ((penggugat|pemohon) dan )?(tergugat|termohon)"
RE_P0 = "(bukti|saksi)[a-z-]*( lanjutan| tambahan)?( dari| oleh)? (penggugat|pemohon)"
LAMA = {
    'bukti-p': "%s AND (%s REGEXP '%s' OR NOT %s REGEXP '%s')" % (BUKTI0, A0, RE_P0, A0, RE_T0),
    'bukti-t': "%s AND %s REGEXP '%s'" % (BUKTI0, A0, RE_T0),
}

# --- syarat BARU (alias j = sidang calon; i = sidang sebelumnya; k = sidang pembuktian pertama) ---
A = lambda x: "LOWER(IFNULL(%s.agenda,''))" % x
D = lambda x: "LOWER(IFNULL(%s.alasan_ditunda,''))" % x
K = lambda x: "LOWER(IFNULL(%s.keterangan,''))" % x
BUKTI = lambda t: "(%s LIKE '%%bukti%%' OR %s LIKE '%%saksi%%')" % (t, t)
RX = lambda t, nama: "(%s REGEXP '%s')" % (t, POSIX[nama])
SEBELUM = lambda a, b: "(%s.tanggal_sidang < %s.tanggal_sidang OR (%s.tanggal_sidang = %s.tanggal_sidang AND %s.id < %s.id))" % (a, b, a, b, a, b)
# Tanda "Penggugat selesai" pada alasan ditunda / keterangan (kembaran tandaTeks).
TANDA = lambda t: ("(%s OR %s OR (%s LIKE '%%kesimpulan%%' AND NOT %s) OR (%s AND NOT (%s REGEXP 'belum[[:space:]]+cukup')))"
                   % (RX(t, 'T_MULAI'), RX(t, 'T'), t, BUKTI(t), RX(t, 'CUKUP'), t))
SELESAI = ("EXISTS (SELECT 1 FROM perkara_jadwal_sidang i WHERE i.perkara_id = j.perkara_id AND %s"
           " AND EXISTS (SELECT 1 FROM perkara_jadwal_sidang k WHERE k.perkara_id = i.perkara_id AND %s AND NOT %s)"
           " AND ((%s AND %s) OR (NOT %s AND %s LIKE '%%kesimpulan%%') OR %s OR %s))"
           % (SEBELUM('i', 'j'), BUKTI(A('k')), SEBELUM('i', 'k'), BUKTI(A('i')), RX(A('i'), 'T'), BUKTI(A('i')), A('i'),
              TANDA(D('i')), TANDA(K('i'))))
GUGATAN = "EXISTS (SELECT 1 FROM perkara pk WHERE pk.perkara_id = j.perkara_id AND pk.nomor_perkara LIKE '%Pdt.G%')"
BARU = {
    'bukti-p': "(%s AND (%s OR (NOT %s AND (NOT %s OR NOT %s))))" % (BUKTI(A('j')), RX(A('j'), 'P'), RX(A('j'), 'T'), GUGATAN, SELESAI),
    'bukti-t': "(%s AND (%s OR (%s AND (%s OR %s OR (NOT %s AND %s)))))"
               % (BUKTI(A('j')), RX(A('j'), 'T'), GUGATAN, RX(D('j'), 'T_MULAI'), RX(K('j'), 'T_MULAI'), RX(A('j'), 'P'), SELESAI),
}
VAR = [('2111', 'bukti-p'), ('7119', 'bukti-p'), ('2112', 'bukti-t'), ('7121', 'bukti-t')]
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
    assert 'perkara_jadwal_sidang j' in s, 'paket tanggal-agenda-31okt belum terpasang?'
    assert s.count(LAMA[jenis]) == 2, (jenis, s.count(LAMA[jenis]))
    return s.replace(LAMA[jenis], BARU[jenis])


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
      "--  A = variabel %s yang isinya PERSIS hasil paket tanggal-agenda-31okt (%d sebelum, 0 sesudah)\n"
      "--  B = variabel yang sama yang isinya PERSIS hasil paket ini (0 sebelum, %d sesudah)\n"
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
tulis(N + '-PULIH.sql', "-- PULIH %s: isi hasil paket tanggal-agenda-31okt dikembalikan persis, hanya baris yang masih persis hasil paket ini.\n"
      "START TRANSACTION;\n%sCOMMIT;\n" % (N, pulih))
tulis(N + '-PERIKSA.sql',
      "-- PERIKSA %s (BACA SAJA). Harus \"SEMUA COCOK\".\n"
      "SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s)) = %d, 'SEMUA COCOK', 'TIDAK COCOK') AS periksa;\n"
      % (N, IN, NORM, B, n))
tulis('harap.txt', '%d|0\n0|%d\n' % (n, n))
tulis('nomor-variabel.txt', '# variabel yang diubah paket (syarat agenda cabang jadwal sidang diganti; tidak ada variabel baru)\n' + '\n'.join(NO) + '\n')
os.makedirs(os.path.join(SINI, '..', 'hasil'), exist_ok=True)
with io.open(os.path.join(SINI, '..', 'hasil', 'kueri-lama-baru.tsv'), 'w', encoding='utf-8', newline='\n') as f:
    for k in NO:
        f.write('%s\t%s\t%s\n' % (k, UBAH[k][0].replace('\n', '\\n').replace('\t', ' '), UBAH[k][1].replace('\n', '\\n').replace('\t', ' ')))
for k in NO:
    print(k, md5(UBAH[k][0]), '->', md5(UBAH[k][1]), len(UBAH[k][1]))
