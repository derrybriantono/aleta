# -*- coding: utf-8 -*-
"""Pembangun paket ABT alamat-putusan-28okt (python 3, di laptop). Membaca abt_variabel keadaan server SESUDAH paket pihak-urut-ecourt-27okt dan pihak-urut-sisa-28okt
(VAR_DASAR_HEX: no_var, HEX(nama), data_type, HEX(sql_query)), memakai satu pembungkus alamat baru (isian_rtf_alamat_putusan = isian_rtf_alamat tanpa petunjuk arah dalam kurung)
di variabel yang HANYA dipakai blangko putusan/BAS/penetapan (bukan relaas) dan di dua fungsi paket 27 Okt (isian_rtf_pihak_identitas, isian_rtf_pihak_utama). Lalu menulis paket-satker/*.
pakai: python bangun_paket.py"""
import hashlib
import json
import os
import re

AKAR = os.path.dirname(os.path.abspath(__file__))
N = 'abt-alamat-putusan-28okt'
KELUAR = os.path.join(AKAR, '..', 'paket-satker')
PAKET = os.path.join(AKAR, '..', '..')
HEXFILE = os.environ.get('VAR_DASAR_HEX', r'D:\Aplikasi\aleta\tmp\w111\var_dasar_hex.tsv')
MODIFIED = '2026-10-28 00:00:00'
BARU_FN = 'isian_rtf_alamat_putusan'
LAMA_FN = 'isian_rtf_alamat'
# variabel yang diubah (milik Derry, modifier admin) - TIDAK ada yang dipakai relaas (diukur: tutupan rujukan blangko [JS] tidak mencapai satu pun dari enam ini)
NO_UBAH = [7047, 7048, 8700, 8890, 9349, 9350]
# fungsi paket 27 Okt yang memanggil isian_rtf_alamat untuk alamat pihak (hanya dipanggil 7047/7048 dan 3507/3509/3513/3514; tidak dicapai relaas)
FN_UBAH = ['isian_rtf_pihak_identitas', 'isian_rtf_pihak_utama']
# isian_rtf_alamat (paket alamat-ganda-26okt) harus persis keadaan server: md5 definisi dibaca dari basis laptop hasil dump server 27 Okt (nama basis SIPP)
MD5_ALAMAT = 'dfb14adb3ed8e29efaea5e2e03c6983b'


def md5(b):
    return hashlib.md5(b).hexdigest()


def hx(b):
    return '0x' + b.hex()


var = {}
for baris in open(HEXFILE, encoding='latin1', newline='').read().replace('\r', '').split('\n'):
    if baris.strip():
        k = baris.split('\t')
        var[int(k[0])] = dict(nama=bytes.fromhex(k[1]), tipe=k[2], sql=None if k[3] == 'NULL' else bytes.fromhex(k[3]))

# ---- fungsi paket 27 Okt (sumber) -> lama (md5 dari isi-paket.json 27 Okt) dan baru (isian_rtf_alamat( -> isian_rtf_alamat_putusan( )
P27 = json.load(open(os.path.join(PAKET, 'pihak-urut-ecourt-27okt', 'hasil', 'isi-paket.json'), encoding='utf-8'))
MD5_LAMA = {'isian_rtf_pihak_identitas': P27['fungsi_baru']['isian_rtf_pihak_identitas'], 'isian_rtf_pihak_utama': P27['fungsi_x9']['isian_rtf_pihak_utama']['baru_md5']}
SRC27 = open(os.path.join(PAKET, 'pihak-urut-ecourt-27okt', 'paket-satker', 'abt-pihak-urut-ecourt-27okt-FUNGSI.sql'), 'rb').read().decode('latin1').replace('\r\n', '\n')


def blok(nama, teks):
    m = re.search(r'(DROP FUNCTION IF EXISTS %s\$\$\nCREATE FUNCTION %s\(.*?\nBEGIN\n(.*?)\nEND)\$\$' % (nama, nama), teks, re.S)
    assert m, nama
    return m.group(1), 'BEGIN\n' + m.group(2) + '\nEND'


FN = {}
for f in FN_UBAH:
    teks, badan = blok(f, SRC27)
    assert md5(badan.encode('latin1')) == MD5_LAMA[f], ('sumber 27 Okt tak cocok dengan md5 paket 27 Okt', f)
    n = len(re.findall(r'(?<![A-Za-z_])%s\(' % LAMA_FN, badan))
    assert n == 2, (f, n)
    teks2 = re.sub(r'(?<![A-Za-z_])%s\(' % LAMA_FN, BARU_FN + '(', teks)
    badan2 = re.sub(r'(?<![A-Za-z_])%s\(' % LAMA_FN, BARU_FN + '(', badan)
    FN[f] = dict(lama=teks, baru=teks2, md5_lama=MD5_LAMA[f], md5_baru=md5(badan2.encode('latin1')), badan_baru=badan2)

# ---- fungsi baru AP (templat-fungsi.sql)
templat = open(os.path.join(AKAR, 'templat-fungsi.sql'), 'rb').read().decode('latin1').replace('\r\n', '\n')
AP = {}
for f in ('isian_rtf_alamat_arah', 'isian_rtf_alamat_buang_arah', 'isian_rtf_alamat_putusan'):
    m = re.search(r'CREATE FUNCTION %s\(.*?\nBEGIN\n(.*?)\nEND\$\$' % f, templat, re.S)
    assert m, f
    AP[f] = md5(('BEGIN\n' + m.group(1) + '\nEND').encode('latin1'))

# ---- variabel
ubah = {}
for no in NO_UBAH:
    v = var[no]
    assert v['tipe'] == 'data_sql' and v['sql'] is not None, no
    q = v['sql'].decode('latin1')
    n = len(re.findall(r'aps_badilag\.%s\(' % LAMA_FN, q))
    assert n >= 1, no
    q2 = re.sub(r'aps_badilag\.%s\(' % LAMA_FN, 'aps_badilag.%s(' % BARU_FN, q)
    nb = q2.encode('latin1')
    ubah[no] = dict(lama_md5=md5(v['sql']), baru_md5=md5(nb), baru_b=nb, nama_md5=md5(v['nama']), tipe=v['tipe'], diganti=n)
# tidak ada variabel lain yang boleh memakai pembungkus baru / tidak ada yang memanggil isian_rtf_alamat selain relaas, eksekusi, dan enam di atas
sisa_langsung = sorted(no for no, v in var.items() if v['sql'] and re.search(rb'aps_badilag\.%s\(' % LAMA_FN.encode(), v['sql']) and no not in NO_UBAH)
assert sisa_langsung == [3517, 3518, 3519, 3943, 3944, 7108, 7109, 9230, 9231, 9292, 9293, 10126], sisa_langsung
assert not any(v['sql'] and BARU_FN.encode() in v['sql'] for v in var.values())


def kond(no, keadaan, a=''):
    p = a + '.' if a else ''
    u = ubah[no]
    m = u['lama_md5'] if keadaan == 'lama' else u['baru_md5']
    return "(%sno_var=%d AND MD5(%snama)='%s' AND %sdata_type='%s' AND MD5(%ssql_query)='%s')" % (p, no, p, u['nama_md5'], p, u['tipe'], p, m)


def atau(lst):
    return '(' + ' OR '.join(lst) + ')' if lst else '(1=0)'


def kond_fn(keadaan):
    return atau(["(routine_name='%s' AND MD5(routine_definition)='%s')" % (f, FN[f]['md5_lama'] if keadaan == 'lama' else FN[f]['md5_baru']) for f in FN_UBAH])


def kond_ap():
    return atau(["(routine_name='%s' AND MD5(routine_definition)='%s')" % (f, h) for f, h in AP.items()])


RT = "information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION'"
KUL = [kond(n, 'lama') for n in NO_UBAH]
KUB = [kond(n, 'baru') for n in NO_UBAH]
daftar = ','.join(str(n) for n in NO_UBAH)
HARAP = '2|0|%d|0|0|1|0' % len(NO_UBAH)
ULANG = '0|2|0|%d|3|1|0' % len(NO_UBAH)
KEPALA = ("-- Paket ABT \"%s\" (28 Okt 2026): keterangan arah di dalam KURUNG pada alamat pihak dibuang di PUTUSAN (relaas tetap utuh). %d variabel diubah (%s), 2 fungsi paket 27 Okt diganti, 3 fungsi baru (AP).\n"
          "-- Prasyarat: paket pihak-urut-ecourt-27okt dan pihak-urut-sisa-28okt sudah terpasang.\n") % (N, len(NO_UBAH), ', '.join(map(str, NO_UBAH)))

pra = KEPALA + ("-- PRASYARAT (baca saja) \"A|B|C|D|E|F|G\": A = fungsi isian_rtf_pihak_identitas/utama yang isinya persis paket 27 Okt (2 pertama, 0 ulang) | B = yang sudah isi BARU paket ini (0 pertama, 2 ulang) | "
                "C = dari %d variabel yang diubah, yang masih isi LAMA (%d pertama, 0 ulang) | D = yang sudah isi BARU (0 pertama, %d ulang) | E = fungsi baru AP (3) yang sudah ada dengan isi persis (0 pertama, 3 ulang) | "
                "F = isian_rtf_alamat (paket alamat-ganda-26okt) yang isinya persis keadaan server (harus 1) | G = baris variabel diubah yang bukan lama bukan baru, ditambah fungsi identitas/utama yang bukan lama bukan baru (harus 0).\n"
                "-- Benar: \"%s\" (pertama) atau \"%s\" (pasang ulang).\n") % (len(NO_UBAH), len(NO_UBAH), len(NO_UBAH), HARAP, ULANG)
pra += ("SELECT CONCAT((SELECT COUNT(*) FROM %s AND %s), '|', (SELECT COUNT(*) FROM %s AND %s), '|', (SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', (SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', "
        "(SELECT COUNT(*) FROM %s AND %s), '|', (SELECT COUNT(*) FROM %s AND routine_name='%s' AND MD5(routine_definition)='%s'), '|', "
        "((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND NOT (%s OR %s)) + (SELECT COUNT(*) FROM %s AND routine_name IN ('isian_rtf_pihak_identitas','isian_rtf_pihak_utama') AND NOT (%s OR %s)))) AS prasyarat;\n") % (
    RT, kond_fn('lama'), RT, kond_fn('baru'), atau(KUL), atau(KUB), RT, kond_ap(), RT, LAMA_FN, MD5_ALAMAT, daftar, atau(KUL), atau(KUB), RT, kond_fn('lama'), kond_fn('baru'))

ps = KEPALA + ("-- PASANG variabel (fungsi dipasang lebih dulu oleh pasang-satker.sh dari -FUNGSI.sql): satu transaksi; baris diubah hanya bila isinya masih persis isi LAMA (pasang ulang aman).\n"
               "SET NAMES latin1;\nSTART TRANSACTION;\n")
for n in NO_UBAH:
    ps += "UPDATE abt_variabel SET sql_query=%s, modified='%s' WHERE %s;\n" % (hx(ubah[n]['baru_b']), MODIFIED, kond(n, 'lama'))
ps += "COMMIT;\n"

CEK_AP = "(SELECT COUNT(*) FROM %s AND %s) = 3" % (RT, kond_ap())
CEK_UJI = ("isian_rtf_alamat_arah('GAIB') = 0 AND isian_rtf_alamat_arah('rumah sesudah Jembatan / Kios X') = 1 AND isian_rtf_alamat_arah('RT/RW 01/02') = 0 "
           "AND isian_rtf_alamat_buang_arah('Jalan Poros Palu-Bangga (rumah sesudah Jembatan / Kios X), Desa Poi') = 'Jalan Poros Palu-Bangga, Desa Poi' "
           "AND isian_rtf_alamat_buang_arah('Jalan A (samping SD) , Desa B') = 'Jalan A, Desa B' AND isian_rtf_alamat_buang_arah('Desa C (GAIB), Kec D') = 'Desa C (GAIB), Kec D' "
           "AND isian_rtf_alamat_buang_arah('Desa C, Kec D') = 'Desa C, Kec D' AND isian_rtf_alamat_buang_arah(NULL) IS NULL "
           "AND isian_rtf_alamat_putusan('Desa Poi (rumah depan Masjid), Kecamatan Dolo Selatan') = isian_rtf_alamat('Desa Poi, Kecamatan Dolo Selatan')")
pk = KEPALA + "-- PERIKSA: tiap variabel persis isi paket; fungsi benar; relaas (7108 7109 9230 9231 9292 9293), alamat langsung blangko (3517 3518 3519 10126) dan eksekusi (3943 3944) tidak tersentuh; baris terakhir \"SEMUA COCOK\".\n"
for n in NO_UBAH:
    pk += "SELECT 'var %d diubah' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (n, kond(n, 'baru'))
pk += "SELECT 'fungsi AP ada' AS butir, IF(%s, 1, 0) AS cocok;\n" % CEK_AP
pk += "SELECT 'fungsi identitas dan utama baru' AS butir, IF((SELECT COUNT(*) FROM %s AND %s) = 2, 1, 0) AS cocok;\n" % (RT, kond_fn('baru'))
pk += "SELECT 'fungsi jalan' AS butir, IF(%s, 1, 0) AS cocok;\n" % CEK_UJI
pk += ("SELECT 'relaas dan eksekusi tak tersentuh' AS butir, IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (3517,3518,3519,3943,3944,7108,7109,9230,9231,9292,9293,10126) AND sql_query LIKE '%%aps_badilag.isian_rtf_alamat(%%' "
       "AND sql_query NOT LIKE '%%isian_rtf_alamat_putusan%%') = 12 AND (SELECT COUNT(*) FROM abt_variabel WHERE sql_query LIKE '%%isian_rtf_alamat_putusan%%') = %d, 1, 0) AS cocok;\n") % len(NO_UBAH)
pk += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d AND %s AND (SELECT COUNT(*) FROM %s AND %s) = 2 AND %s, 'SEMUA COCOK', 'TIDAK COCOK') AS hasil;\n") % (atau(KUB), len(NO_UBAH), CEK_AP, RT, kond_fn('baru'), CEK_UJI)

cek_fn = "SELECT (SELECT COUNT(*) FROM %s AND %s) AS fungsi_baru;\n" % (RT, kond_fn('baru'))

pl = KEPALA + ("-- PULIH (deterministik): variabel dikembalikan dari tabel sementara pu_lama (dibuat pulih-satker.sh dari cadangan/abt_variabel-sebelum.sql) HANYA bila isinya masih isi BARU paket dan baris cadangan masih isi LAMA yang diharapkan.\n"
               "-- Dua fungsi paket 27 Okt dikembalikan oleh pulih-satker.sh (-FUNGSI-LAMA.sql) SESUDAH ini, lalu fungsi AP dihapus bila tak ada yang memanggilnya.\n")
pl += "START TRANSACTION;\n"
for n in NO_UBAH:
    pl += ("UPDATE abt_variabel a JOIN pu_lama l ON l.no_var=a.no_var SET a.nama=l.nama, a.data_type=l.data_type, a.data_tabel=l.data_tabel, a.data_kolom=l.data_kolom, "
           "a.urutan_data=l.urutan_data, a.referensi=l.referensi, a.sql_query=l.sql_query, a.default_data=l.default_data, a.multi_sidang=l.multi_sidang, a.locked=l.locked, "
           "a.modifier=l.modifier, a.modified=l.modified WHERE %s AND %s;\n") % (kond(n, 'baru', 'a'), kond(n, 'lama', 'l'))
pl += "COMMIT;\n"
pl += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d, 'VARIABEL KEMBALI', CONCAT('PULIH TIDAK LENGKAP - baris diubah yang sudah kembali ', (SELECT COUNT(*) FROM abt_variabel WHERE %s), ' dari %d (diubah orang sesudah dipasang? dibiarkan)')) AS hasil;\n") % (
    atau(KUL), len(NO_UBAH), atau(KUL), len(NO_UBAH))

uv = KEPALA + "-- UJIVAR: kueri baru tiap variabel diubah dijalankan pasang-satker.sh atas beberapa perkara contoh (@pid diisi skrip; rujukan #NNNN# = 0). Hanya memeriksa kueri berjalan tanpa galat.\n"
for n in NO_UBAH:
    q = ubah[n]['baru_b'].decode('latin1')
    q = re.sub(r"'#perkara_id#'|#perkara_id#", '@pid', q)
    q = re.sub(r'#\d{1,5}#', '0', q)
    q = q.replace('\r\n', '\n').rstrip().rstrip(';')
    q = q.encode('ascii', 'replace').decode('ascii')
    uv += "SELECT %d AS no_var, COUNT(*) AS baris FROM (%s) AS uji_%d;\n" % (n, q, n)

# ---- berkas
fungsi_sql = templat.replace('DELIMITER ;', '').rstrip() + '\n\n'
fungsi_sql += ("-- Dua fungsi paket 27 Okt diganti: isian_rtf_alamat( -> isian_rtf_alamat_putusan( (dua tempat per fungsi: pihak sisi 1 dan sisi 2). Selebihnya persis paket 27 Okt.\n")
for f in FN_UBAH:
    fungsi_sql += FN[f]['baru'] + '$$\n\n'
fungsi_sql += 'DELIMITER ;\n'
lama_sql = "-- Definisi LAMA (persis paket pihak-urut-ecourt-27okt) dua fungsi yang diganti; dipakai pulih-satker.sh.\nDELIMITER $$\n\n" + ''.join(FN[f]['lama'] + '$$\n\n' for f in FN_UBAH) + 'DELIMITER ;\n'
with open(os.path.join(KELUAR, '%s-FUNGSI.sql' % N), 'wb') as f:
    f.write(fungsi_sql.encode('latin1'))
with open(os.path.join(KELUAR, '%s-FUNGSI-LAMA.sql' % N), 'wb') as f:
    f.write(lama_sql.encode('latin1'))
for nama, isi in (('PRASYARAT', pra), ('PASANG', ps), ('PERIKSA', pk), ('PULIH', pl), ('UJIVAR', uv), ('FUNGSI-CEK', KEPALA + cek_fn)):
    open(os.path.join(KELUAR, '%s-%s.sql' % (N, nama)), 'w', newline='\n', encoding='ascii').write(isi)
open(os.path.join(KELUAR, 'nomor-ubah.txt'), 'w', newline='\n').write(daftar + '\n')
open(os.path.join(KELUAR, 'harap.txt'), 'w', newline='\n').write(HARAP + '\n' + ULANG + '\n')
for sk in ('pasang-satker.sh', 'pulih-satker.sh', 'perkara-uji.txt'):
    open(os.path.join(KELUAR, sk), 'wb').write(open(os.path.join(AKAR, sk), 'rb').read().replace(b'\r\n', b'\n'))

ring = dict(ubah=[dict(no=n, lama_md5=ubah[n]['lama_md5'], baru_md5=ubah[n]['baru_md5'], diganti=ubah[n]['diganti']) for n in NO_UBAH],
            fungsi_ap=AP, fungsi_diganti={f: dict(lama_md5=FN[f]['md5_lama'], baru_md5=FN[f]['md5_baru']) for f in FN_UBAH}, md5_isian_rtf_alamat=MD5_ALAMAT,
            harap=HARAP, ulang=ULANG, tidak_diubah_memanggil_alamat=sisa_langsung)
json.dump(ring, open(os.path.join(AKAR, '..', 'hasil', 'isi-paket.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
berkas = sorted(x for x in os.listdir(KELUAR) if os.path.isfile(os.path.join(KELUAR, x)) and x != 'MD5SUMS.txt')
with open(os.path.join(KELUAR, 'MD5SUMS.txt'), 'w', newline='\n') as f:
    for x in berkas:
        f.write('%s  %s\n' % (md5(open(os.path.join(KELUAR, x), 'rb').read()), x))
print('ubah', len(NO_UBAH), [ubah[n]['diganti'] for n in NO_UBAH], 'HARAP', HARAP, 'ULANG', ULANG, 'berkas', len(berkas))
print({f: FN[f]['md5_baru'] for f in FN_UBAH}, AP)
