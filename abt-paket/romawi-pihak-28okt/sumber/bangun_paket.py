# -*- coding: utf-8 -*-
"""Pembangun paket ABT romawi-pihak-28okt (python 3, di laptop). Membaca abt_variabel keadaan server SESUDAH paket 27 Okt dan paket pihak-urut-sisa-28okt (VAR_DASAR_HEX; semua baris selain
yang diubah dua paket itu persis bacaan server 27 Okt di VAR_SERVER_HEX, diperiksa di bawah). Memperbaiki variabel sampul pihak banyak yang memakai nilai kolom `urutan` sebagai angka romawi
(`ELT(a.urutan, 'I', 'II', ...)`) dan sebagai batas (`BETWEEN`, `<= 3`): romawi kini dari PERINGKAT pihak (fungsi isian_rtf_pihak_peringkat, paket pihak-urut-sisa-28okt) lewat fungsi
isian_rtf_romawi (sudah ada di server, 1-3999). TIDAK ada fungsi baru. Lalu menulis paket-satker/*.
Isi lama baris yang diubah dijaga md5 dan dicadangkan di server oleh pasang-satker.sh.
pakai: python bangun_paket.py   (jalur bawaan: D:/Aplikasi/aleta/tmp/w109/var_rm0_hex.tsv = ekspor heks abt_variabel basis aps_badilag_rm0 (salinan server pasca-paket sisa), dan D:/Aplikasi/aleta/tmp/w91/var_server_hex.tsv)"""
import hashlib
import json
import os
import re

AKAR = os.path.dirname(os.path.abspath(__file__))
N = 'abt-romawi-pihak-28okt'
KELUAR = os.path.join(AKAR, '..', 'paket-satker')
PAKET = os.path.join(AKAR, '..', '..')
HEXFILE = os.environ.get('VAR_DASAR_HEX', r'D:\Aplikasi\aleta\tmp\w109\var_rm0_hex.tsv')
SERVER_HEX = os.environ.get('VAR_SERVER_HEX', r'D:\Aplikasi\aleta\tmp\w91\var_server_hex.tsv')  # bacaan server 27 Okt (baca saja)
MODIFIED = '2026-10-28 00:00:00'
PER = 'aps_badilag.isian_rtf_pihak_peringkat'
ROM = 'aps_badilag.isian_rtf_romawi'
ELT20 = "ELT(%s,'I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX')"


def md5(b):
    return hashlib.md5(b).hexdigest()


def hx(b):
    return '0x' + b.hex()


def baca_hex(jalur):
    d = {}
    for baris in open(jalur, encoding='latin1', newline='').read().replace(chr(13), '').split(chr(10))[1:]:
        if baris.strip():
            k = baris.split(chr(9))
            d[int(k[0])] = dict(baris=baris, nama=bytes.fromhex(k[1]), tipe=k[2], sql=None if k[7] == 'NULL' else bytes.fromhex(k[7]), modif=k[11], modified=k[12])
    return d


dasar = baca_hex(HEXFILE)
bacaan = baca_hex(SERVER_HEX)

# ---- prasyarat 1: paket pihak-urut-ecourt-27okt (9 fungsi, 14 variabel)
P27 = json.load(open(os.path.join(PAKET, 'pihak-urut-ecourt-27okt', 'hasil', 'isi-paket.json'), encoding='utf-8'))
SIAP27_VAR = {u['no']: u['baru_md5'] for u in P27['ubah']}
for b in P27['baru']:
    SIAP27_VAR[b['no']] = md5(b['sql'].encode('latin1'))
SIAP27_FN = dict(P27['fungsi_baru'])
SIAP27_FN.update({f: v['baru_md5'] for f, v in P27['fungsi_x9'].items()})
assert len(SIAP27_VAR) == 14 and len(SIAP27_FN) == 9
# ---- prasyarat 2: paket pihak-urut-sisa-28okt (1 fungsi, 120 variabel)
PS = json.load(open(os.path.join(PAKET, 'pihak-urut-sisa-28okt', 'hasil', 'isi-paket.json'), encoding='utf-8'))
SIAP_SISA_VAR = {u['no']: u['baru_md5'] for u in PS['ubah']}
SIAP_SISA_FN = {PS['fungsi']['nama']: PS['fungsi']['md5']}
assert len(SIAP_SISA_VAR) == 120 and list(SIAP_SISA_FN) == ['isian_rtf_pihak_peringkat']
# dasar = bacaan server 27 Okt di luar baris yang diubah paket 27 Okt dan paket sisa (keduanya sudah terpasang di server)
beda = sorted(no for no in dasar if bacaan.get(no, {}).get('baris') != dasar[no]['baris'])
assert beda == sorted(set(SIAP27_VAR) | set(SIAP_SISA_VAR)), ('dasar berbeda dari bacaan server di luar dua paket sebelumnya', set(beda) ^ (set(SIAP27_VAR) | set(SIAP_SISA_VAR)))
for no, md in SIAP_SISA_VAR.items():
    assert md5(dasar[no]['sql']) == md, ('dasar tidak memuat isi paket sisa', no)

# ---------------------------------------------------------------------------------------------------------------------------------------------
# Variabel yang diubah (izin pengguna 28 Okt untuk 5890-5893; 5847 5896 5897 dari temuan yang sama - lihat PASANG.md). Semuanya bawaan ABT (modifier kosong), data_sql.
#   5847  intervensi sampul        : pihak3 `CASE WHEN a.urutan<=3` + `ELT(a.urutan, ...)`            -> peringkat 3
#   5890/5891 pihak I kolom kiri/kanan : pihak1 `ELT(a.urutan..)`, `ORDER BY a.urutan`, `BETWEEN` pada urutan -> peringkat 1
#   5892/5893 pihak II kolom kiri/kanan: pihak2 (idem)                                             -> peringkat 2
#   5896  kuasa pihak I            : `ELT(LEAST(jumlah pihak1, 20), ...)` (jumlah, bukan urutan)    -> romawi(jumlah) tanpa batas 20
#   5897  turut tergugat sampul    : pihak4 `CASE WHEN a.urutan<=3` + `ELT(a.urutan, ...)`            -> peringkat 4
TABEL = {5847: 3, 5890: 1, 5891: 1, 5892: 2, 5893: 2, 5897: 4}
NO_UBAH = [5847, 5890, 5891, 5892, 5893, 5896, 5897]
# tidak diubah, hanya dilaporkan: 5894 5895 (hanya COUNT), 5898 5899 (nama langsung, tanpa romawi)
JU = len(NO_UBAH)


def ubah_variabel(no, q):
    if no == 5896:
        lama = ELT20 % 'LEAST((SELECT COUNT(*) FROM perkara_pihak1 WHERE perkara_id=#perkara_id#),20)'
        baru = ROM + '((SELECT COUNT(*) FROM perkara_pihak1 WHERE perkara_id=#perkara_id#))'
        assert q.count(lama) == 1 and 'urutan' not in q
        return q.replace(lama, baru), 1
    t = TABEL[no]
    tabel = 'perkara_pihak%d a' % t
    assert q.count('FROM ' + tabel) >= 1
    # alias a hanya dipakai untuk pihak itu (subkueri jumlah memakai tabel tanpa alias)
    peringkat = '%s(%d, a.id)' % (PER, t)
    elt = ELT20 % 'a.urutan'
    n_elt = q.count(elt)
    assert n_elt >= 1, no
    q2 = q.replace(elt, '%s(%s)' % (ROM, peringkat))
    n_sisa = q2.count('a.urutan')
    assert n_sisa >= 1, no
    q2 = q2.replace('a.urutan', peringkat)
    assert 'urutan' not in q2.replace('isian_rtf_pihak_peringkat', '') and q2.count(PER) == n_sisa + n_elt, (no, q2.count(PER), n_sisa, n_elt)
    return q2, n_sisa + n_elt


ubah = {}
for no in NO_UBAH:
    v = dasar[no]
    assert v['tipe'] == 'data_sql' and v['sql'] is not None and v['modif'] == 'NULL', no
    q = v['sql'].decode('latin1')
    q2, n = ubah_variabel(no, q)
    nb = q2.encode('latin1')
    ubah[no] = dict(kolom='sql_query', lama_md5=md5(v['sql']), baru_b=nb, baru_md5=md5(nb), nama_md5=md5(v['nama']), tipe=v['tipe'], lama_len=len(v['sql']), baru_len=len(nb), ganti=n)


def kond_ubah(no, estado, a=''):
    p = a + '.' if a else ''
    u = ubah[no]
    m = u['lama_md5'] if estado == 'lama' else u['baru_md5']
    return "(%sno_var=%d AND MD5(%snama)='%s' AND %sdata_type='%s' AND MD5(%s%s)='%s')" % (p, no, p, u['nama_md5'], p, u['tipe'], p, u['kolom'], m)


def atau(lst):
    return '(' + ' OR '.join(lst) + ')' if lst else '(1=0)'


def daftar(ns):
    return ','.join(str(x) for x in ns)


KUL = [kond_ubah(n, 'lama') for n in NO_UBAH]
KUB = [kond_ubah(n, 'baru') for n in NO_UBAH]
SIAP_FNSISA = ' OR '.join("(routine_name='%s' AND MD5(routine_definition)='%s')" % (f, h) for f, h in sorted(SIAP_SISA_FN.items()))
# perilaku fungsi yang dipakai: romawi 1-3999 (ada di server sejak paket x9) dan peringkat (tabel 1-4 tak mengenal id 0 -> NULL)
CEK_ROMAWI = ("isian_rtf_romawi(1)='I' AND isian_rtf_romawi(4)='IV' AND isian_rtf_romawi(9)='IX' AND isian_rtf_romawi(14)='XIV' AND isian_rtf_romawi(21)='XXI' AND isian_rtf_romawi(25)='XXV' "
              "AND isian_rtf_romawi(26)='XXVI' AND isian_rtf_romawi(32)='XXXII' AND isian_rtf_romawi(49)='XLIX' AND isian_rtf_romawi(99)='XCIX' AND isian_rtf_romawi(1994)='MCMXCIV' "
              "AND isian_rtf_romawi(3999)='MMMCMXCIX'")
CEK_PERINGKAT = ("isian_rtf_pihak_peringkat(1, 0) IS NULL AND isian_rtf_pihak_peringkat(2, 0) IS NULL AND isian_rtf_pihak_peringkat(3, 0) IS NULL AND isian_rtf_pihak_peringkat(4, 0) IS NULL "
                 "AND isian_rtf_pihak_peringkat(9, 1) IS NULL AND isian_rtf_pihak_peringkat(NULL, 1) IS NULL AND isian_rtf_pihak_peringkat(1, NULL) IS NULL")
CEK_FUNGSI = "(%s AND %s)" % (CEK_ROMAWI, CEK_PERINGKAT)

KEPALA = ("-- Paket ABT \"%s\" (28 Okt 2026): angka romawi pihak pada sampul pihak banyak (variabel %s) dihitung dari PERINGKAT pihak dalam tabelnya, bukan dari nilai kolom `urutan` "
          "(perkara e-Court menomori urutan bersambung lintas tabel).\n"
          "-- %d baris variabel diubah; TIDAK ada fungsi baru (memakai isian_rtf_pihak_peringkat dari paket abt-pihak-urut-sisa-28okt dan isian_rtf_romawi yang sudah ada). "
          "Prasyarat: paket abt-pihak-urut-ecourt-27okt dan abt-pihak-urut-sisa-28okt sudah terpasang.\n") % (N, ', '.join(str(n) for n in NO_UBAH), JU)

HARAP = '1|1|%d|0|0' % JU
ULANG = '1|1|0|%d|0' % JU

pra = KEPALA + ("-- PRASYARAT (baca saja) \"S|R|C|D|G\": S = fungsi isian_rtf_pihak_peringkat (paket sisa 28 Okt) yang isinya persis (harus 1) | "
                "R = isian_rtf_romawi dan isian_rtf_pihak_peringkat berperilaku benar (harus 1) | "
                "C = baris yang akan diubah (%d) yang masih isi LAMA (%d pertama, 0 ulang) | D = yang sudah isi BARU (0 pertama, %d ulang) | "
                "G = baris diubah yang bukan lama bukan baru (harus 0).\n"
                "-- Sengaja TIDAK mensyaratkan isi persis fungsi/variabel paket lain (mis. isian_rtf_pihak_identitas dan isian_rtf_pihak_utama atau variabel 7047 7048 yang paket lain boleh ubah): hanya yang dipakai paket ini.\n"
                "-- Benar: \"%s\" (pertama) atau \"%s\" (pasang ulang).\n") % (JU, JU, JU, HARAP, ULANG)
pra += ("SELECT CONCAT((SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND (%s)), '|', "
        "IF(%s, 1, 0), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', "
        "(SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND NOT (%s OR %s))) AS prasyarat;\n") % (
    SIAP_FNSISA, CEK_FUNGSI, atau(KUL), atau(KUB), daftar(NO_UBAH), atau(KUL), atau(KUB))

ps = KEPALA + ("-- PASANG: satu transaksi; baris diubah hanya bila isinya masih persis isi LAMA (pasang ulang aman). Tidak ada fungsi yang dibuat.\nSET NAMES latin1;\nSTART TRANSACTION;\n")
for n in NO_UBAH:
    u = ubah[n]
    ps += "UPDATE abt_variabel SET %s=%s, modified='%s' WHERE %s;\n" % (u['kolom'], hx(u['baru_b']), MODIFIED, kond_ubah(n, 'lama'))
ps += "COMMIT;\n"

pk = KEPALA + "-- PERIKSA: tiap baris diubah persis isi paket; fungsi peringkat ada dan benar; fungsi yang dipakai berperilaku benar; baris terakhir \"SEMUA COCOK\".\n"
for n in NO_UBAH:
    pk += "SELECT 'var %d diubah' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (n, kond_ubah(n, 'baru'))
pk += "SELECT 'fungsi dipakai benar' AS butir, IF(%s, 1, 0) AS cocok;\n" % CEK_FUNGSI
pk += ("SELECT 'fungsi peringkat utuh' AS butir, IF((SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND (%s)) = 1, 1, 0) AS cocok;\n") % SIAP_FNSISA
pk += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d AND %s AND (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND (%s)) = 1, 'SEMUA COCOK', 'TIDAK COCOK') AS hasil;\n") % (
    atau(KUB), JU, CEK_FUNGSI, SIAP_FNSISA)

pl = KEPALA + ("-- PULIH (deterministik): baris yang diubah dikembalikan dari tabel sementara pu_lama (dibuat pulih-satker.sh dari cadangan/abt_variabel-sebelum.sql) "
               "HANYA bila isinya masih isi BARU paket dan baris cadangan masih isi LAMA yang diharapkan. Tidak ada fungsi yang dihapus (paket ini tidak membuat fungsi). "
               "Jalankan lewat pulih-satker.sh (bukan langsung): tabel pu_lama harus ada.\n")
pl += "START TRANSACTION;\n"
for n in NO_UBAH:
    pl += ("UPDATE abt_variabel a JOIN pu_lama l ON l.no_var=a.no_var SET a.nama=l.nama, a.data_type=l.data_type, a.data_tabel=l.data_tabel, a.data_kolom=l.data_kolom, "
           "a.urutan_data=l.urutan_data, a.referensi=l.referensi, a.sql_query=l.sql_query, a.default_data=l.default_data, a.multi_sidang=l.multi_sidang, a.locked=l.locked, "
           "a.modifier=l.modifier, a.modified=l.modified WHERE %s AND %s;\n") % (kond_ubah(n, 'baru', 'a'), kond_ubah(n, 'lama', 'l'))
pl += "COMMIT;\n"
pl += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d, 'VARIABEL KEMBALI', "
       "CONCAT('PULIH TIDAK LENGKAP - baris diubah yang sudah kembali ', (SELECT COUNT(*) FROM abt_variabel WHERE %s), ' dari %d (diubah orang sesudah dipasang? dibiarkan)')) AS hasil;\n") % (
    atau(KUL), JU, atau(KUL), JU)


# ---- uji menjalankan kueri LAMA dan BARU (UJIVAR): kueri dengan #perkara_id# = @pid; keluaran "no_var<TAB>data" per variabel (variabel tanpa baris tidak mencetak apa pun).
# Pada perkara berurutan rapat pasang-satker.sh mewajibkan keluaran LAMA = BARU (baris demi baris); pada perkara tak rapat hanya memeriksa kueri BARU berjalan tanpa galat.
def siap_uji(b):
    q = b.decode('latin1')
    q = re.sub(r"'#perkara_id#'|#perkara_id#", '@pid', q)
    q = re.sub(r'#\d{1,5}#', '0', q)
    q = q.replace('\r\n', '\n').rstrip().rstrip(';')
    return q


uv = {}
for sisi, kunci in (('LAMA', 'lama'), ('BARU', 'baru')):
    s = KEPALA + "-- UJIVAR-%s: kueri %s tiap variabel diubah, dijalankan pasang-satker.sh atas perkara contoh (@pid diisi skrip). Keluaran \"no_var<TAB>data\" (0 baris bila kueri tak menghasilkan baris).\n" % (sisi, sisi.lower())
    for n in NO_UBAH:
        if kunci == 'lama':
            q = siap_uji(dasar[n]['sql'])
        else:
            q = siap_uji(ubah[n]['baru_b'])
        s += "SELECT %d AS no_var, u.data FROM (%s) AS u;\n" % (n, q)
    uv[sisi] = s

# ---- berkas
for nama, isi in (('PRASYARAT', pra), ('PASANG', ps), ('PERIKSA', pk), ('PULIH', pl), ('UJIVAR-LAMA', uv['LAMA']), ('UJIVAR-BARU', uv['BARU'])):
    open(os.path.join(KELUAR, '%s-%s.sql' % (N, nama)), 'w', newline='\n', encoding='latin1').write(isi)
open(os.path.join(KELUAR, 'nomor-ubah.txt'), 'w', newline='\n').write(daftar(NO_UBAH) + '\n')
open(os.path.join(KELUAR, 'harap.txt'), 'w', newline='\n').write(HARAP + '\n' + ULANG + '\n')
for sk, sumber in (('pasang-satker.sh', 'pasang-satker.sh'), ('pulih-satker.sh', 'pulih-satker.sh'), ('perkara-rapat.txt', 'perkara-rapat.txt'), ('perkara-banyak.txt', 'perkara-banyak.txt'), ('perkara-takrapat.txt', 'perkara-takrapat.txt')):
    open(os.path.join(KELUAR, sk), 'wb').write(open(os.path.join(AKAR, sumber), 'rb').read().replace(b'\r\n', b'\n'))

ring = dict(ubah=[dict(no=n, lama_md5=ubah[n]['lama_md5'], baru_md5=ubah[n]['baru_md5'], lama_panjang=ubah[n]['lama_len'], baru_panjang=ubah[n]['baru_len'], diganti=ubah[n]['ganti']) for n in NO_UBAH],
            harap=HARAP, ulang=ULANG, prasyarat_fungsi=SIAP_SISA_FN,
            jumlah_penggantian=sum(u['ganti'] for u in ubah.values()))
json.dump(ring, open(os.path.join(AKAR, '..', 'hasil', 'isi-paket.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

berkas_paket = sorted(x for x in os.listdir(KELUAR) if os.path.isfile(os.path.join(KELUAR, x)) and x != 'MD5SUMS.txt')
with open(os.path.join(KELUAR, 'MD5SUMS.txt'), 'w', newline='\n') as f:
    for x in berkas_paket:
        f.write('%s  %s\n' % (md5(open(os.path.join(KELUAR, x), 'rb').read()), x))
print('ubah', JU, 'penggantian', ring['jumlah_penggantian'])
print('HARAP', HARAP)
print('ULANG', ULANG)
print('MD5SUMS:', len(berkas_paket), 'berkas')
