# -*- coding: utf-8 -*-
"""Bangun paket ABT abt-variabel-sehat-30okt dari basis salinan SESUDAH semua paket 29-30 Okt terpasang (aps_badilag_vs).
Hanya variabel yang TERBUKTI bermasalah pada pindai luas (alat/pindai_mesin.js + alat/analisa.py, 169 perkara) dan render ABT asli:
  4303  ITSBAT: PERTIMBANGAN DASAR PASAL 7 AYAT (3) KHI - isian "Tgl Nikah" (5197) yang diketik dengan awalan "pada" atau berakhir
        tanda baca tercetak "terjadi pada pada hari Sabtu, ..." / "terjadi pada 13 Januari 1975; . Jika ...". Nilai 5197 di keempat
        tempatnya dirapikan: awalan "pada " dibuang, titik/koma/titik koma di ujung dibuang. Kalimat lain tidak berubah.
  9292, 9293  ALAMAT #0046#/#0047# DENGAN KODE POS DI UJUNG (amplop relaas) - alamat SIPP yang memuat "Domisili Eletronik: <email>"
        (salah ketik tanpa k) tidak dikenali sebagai batas domisili elektronik, kode pos tersisip di tengah:
        "... Domisili Eletronik:, Kode Pos 94356. email". Batas dikenali dari "domisili el" (Elektronik maupun Eletronik).
md5 dihitung atas bentuk server (nama basis salinan dinormalkan ke aps_badilag.). Teks variabel ditulis sebagai UNHEX (latin1) -
tanpa masalah kutip. pakai: python bangun_paket.py <basis salinan>"""
import hashlib, io, os, re, subprocess, sys
SINI = os.path.dirname(os.path.abspath(__file__))
PK = os.path.join(SINI, '..', 'paket-satker')
N = 'abt-variabel-sehat-30okt'
MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
db = sys.argv[1]
NORM = "REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')"


def q(sql):
    r = subprocess.run([MYSQL, '-u', 'root', '-h', '127.0.0.1', '-N', '--default-character-set=latin1', db, '-e', sql], capture_output=True)
    if r.returncode:
        sys.exit(r.stderr.decode('latin1'))
    return [l.split('\t') for l in r.stdout.decode('latin1').splitlines()]


def lama(no):
    rows = q("SELECT HEX(%s) FROM abt_variabel WHERE no_var = %s" % (NORM, no))
    assert len(rows) == 1, (no, rows)
    return bytes.fromhex(rows[0][0]).decode('latin1')


# --- 4303: isian 5197 dirapikan di tiap tempatnya --------------------------------------------------------------------
E5197 = ("TRIM(TRAILING '.' FROM TRIM(TRAILING ';' FROM TRIM(TRAILING ',' FROM TRIM(TRAILING '.' FROM TRIM(TRAILING ';' FROM "
         "TRIM(IF(LOWER(LEFT(TRIM('#5197#'), 5)) = 'pada ', SUBSTRING(TRIM('#5197#'), 6), '#5197#')))))))")


def literal_ganti(sql, penanda, ekspr):
    """Tiap literal '...penanda...' (kutip tunggal, '' dan \\' di dalamnya) -> CONCAT('...', ekspr, '...'). Pulang (sql baru, jumlah)."""
    out, i, n = [], 0, 0
    while i < len(sql):
        c = sql[i]
        if c == '"':  # literal kutip ganda dilewati utuh
            j = i + 1
            while j < len(sql) and not (sql[j] == '"' and sql[j - 1] != '\\'):
                j += 1
            out.append(sql[i:j + 1]); i = j + 1; continue
        if c != "'":
            out.append(c); i += 1; continue
        j = i + 1
        while j < len(sql):
            if sql[j] == '\\':
                j += 2; continue
            if sql[j] == "'":
                if j + 1 < len(sql) and sql[j + 1] == "'":
                    j += 2; continue
                break
            j += 1
        isi = sql[i + 1:j]
        if penanda in isi and isi != penanda:
            bag = isi.split(penanda)
            out.append('CONCAT(' + (', ' + ekspr + ', ').join("'%s'" % b for b in bag) + ')')
            n += len(bag) - 1
        else:
            out.append(sql[i:j + 1])
        i = j + 1
    return ''.join(out), n


UBAH = {}
s = lama('4303')
baru, n = literal_ganti(s, '#5197#', E5197)
assert n == 4, n
assert baru.count("TRIM('#5197#')") == 8 and 'pada pada' not in baru
UBAH['4303'] = (s, baru, 'isian Tgl Nikah (5197) dirapikan: awalan "pada " dan tanda baca di ujung dibuang (4 tempat)')

for no in ('9292', '9293'):
    s = lama(no)
    a = "LOCATE('domisili elektronik', x.a)"
    assert s.count(a) == 1, (no, s.count(a))
    UBAH[no] = (s, s.replace(a, "LOCATE('domisili el', x.a)"), 'batas domisili elektronik juga dikenali bila tertulis "Domisili Eletronik"')

md5 = lambda t: hashlib.md5(t.encode('latin1')).hexdigest()
hexl = lambda t: t.encode('latin1').hex().upper()
NO = sorted(UBAH, key=int)
IN = ','.join(NO)
L = ','.join("'%s'" % md5(UBAH[k][0]) for k in NO)
B = ','.join("'%s'" % md5(UBAH[k][1]) for k in NO)
info = '\n'.join('--   %s: %s (md5 lama %s -> baru %s)' % (k, UBAH[k][2], md5(UBAH[k][0]), md5(UBAH[k][1])) for k in NO)


def tulis(nama, isi):
    with io.open(os.path.join(PK, nama), 'w', encoding='utf-8', newline='\n') as f:
        f.write(isi)


os.makedirs(PK, exist_ok=True)
tulis(N + '-PRASYARAT.sql',
      "-- PRASYARAT %s (BACA SAJA). Satu baris A|B:\n"
      "--  A = variabel %s yang isinya PERSIS keadaan sesudah semua paket 29-30 Okt (3 sebelum paket ini, 0 sesudah)\n"
      "--  B = variabel yang sama yang isinya PERSIS hasil paket ini (0 sebelum, 3 sesudah)\n"
      "-- Pasang bila 3|0; pasang ulang bila 0|3; selain itu (mis. variabel sudah disunting orang) berhenti tanpa mengubah apa pun.\n%s\n"
      "SELECT CONCAT_WS('|',\n (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s)),\n"
      " (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND MD5(%s) IN (%s))\n) AS prasyarat;\n" % (N, IN, info, IN, NORM, L, IN, NORM, B))
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
      "  AND (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4303 AND LOCATE('pada #5197#', sql_query) > 0) = 0\n"
      "  AND (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (9292, 9293) AND LOCATE('''domisili el''', sql_query) > 0) = 2,\n"
      "  'SEMUA COCOK', 'TIDAK COCOK') AS periksa;\n" % (N, IN, NORM, B, len(NO)))
tulis('harap.txt', '%d|0\n0|%d\n' % (len(NO), len(NO)))
tulis('nomor-variabel.txt', '# variabel yang diubah paket (tidak ada variabel baru; blok 11950-11999 TIDAK dipakai)\n' + '\n'.join(NO) + '\n')
for k in NO:
    print(k, md5(UBAH[k][0]), '->', md5(UBAH[k][1]), len(UBAH[k][0]), '->', len(UBAH[k][1]))
