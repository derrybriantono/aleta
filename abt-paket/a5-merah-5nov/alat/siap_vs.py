# -*- coding: utf-8 -*-
"""Menyamakan SALINAN UJI aps_badilag_vs dengan keadaan server (variabel & fungsi) selama uji render, lalu mengembalikannya persis.
aps_badilag_vs lebih tua dari server: tidak memuat 54 variabel dan 5 fungsi yang dirujuk blangko paket, serta 18 definisi lebih lama. Sumber
definisi (baca saja): basis salinan server 3 Nov aps_badilag_w206 ditambah PASANG.sql keputusan-a-kerangka-4nov (9266-9269).
Hanya menyentuh aps_badilag_vs; TIDAK menyentuh aps_badilag, sipp_donggala, atau server. Tiap tahap mencetak sidik supaya pemulihan terbukti.
  python -B siap_vs.py sidik
  python -B siap_vs.py siap  <folder cadangan> <PASANG.sql kerangka>
  python -B siap_vs.py pulih <folder cadangan>
"""
import json
import os
import re
import subprocess
import sys

BIN = os.environ.get('MYSQL_BIN', r'D:\satker asal\website pa bungku\xampp\mysql\bin')
MY = os.path.join(BIN, 'mysql.exe')
UJI, DASAR, SIPP_UJI, SIPP_DASAR = 'aps_badilag_vs', 'aps_badilag_w206', 'sipp_vs', 'sipp_donggala'
KOLOM = 'no_var,nama,data_type,data_tabel,data_kolom,urutan_data,referensi,sql_query,default_data,multi_sidang,locked,modifier,modified'
ANGKA = ('no_var', 'urutan_data', 'referensi', 'locked')
TABEL_SIDIK = {
    'abt_variabel': "CONCAT_WS('|',no_var,nama,data_type,IFNULL(data_tabel,''),IFNULL(data_kolom,''),IFNULL(urutan_data,''),IFNULL(referensi,''),IFNULL(sql_query,''),IFNULL(default_data,''),IFNULL(multi_sidang,''),locked,IFNULL(modifier,''),IFNULL(modified,''))",
    'abt_data_teks': "CONCAT_WS('|',perkara_id,no_var,IFNULL(data,''))",
    'abt_data_tanggal': "CONCAT_WS('|',perkara_id,no_var,IFNULL(data,''))",
}
assert os.path.exists(MY), MY


def q(db, sql, raw=False):
    r = subprocess.run([MY, '-h', '127.0.0.1', '-u', 'root', '--default-character-set=latin1', '-N', '-B', '-r', db], input=sql.encode('latin1'), capture_output=True)
    if r.returncode:
        raise SystemExit('GALAT SQL: ' + r.stderr.decode('latin1')[:600] + '\n' + sql[:300])
    return r.stdout.replace(bytes([13,10]), bytes([10])).decode('latin1')


def baris(db, sql):
    return [l.split('\t') for l in q(db, sql).split('\n') if l != '']


def fungsi(db):
    kel = {}
    for jenis, nama in baris('information_schema', "SELECT routine_type,routine_name FROM routines WHERE routine_schema='%s'" % db):
        t = q(db, 'SHOW CREATE %s `%s`' % (jenis, nama))
        c = t.split('\t')[2] if '\t' in t else ''
        kel[nama] = (jenis, c)
    return kel


def normal(s, db, sipp):
    return s.replace(db + '.', 'A.').replace('`%s`' % db, 'A').replace(sipp + '.', 'S.').replace('SIPP.', 'S.')


def sidik():
    k = {}
    q(UJI, 'SET SESSION group_concat_max_len=1000000000')
    for t, e in TABEL_SIDIK.items():
        r = baris(UJI, "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(%s ORDER BY 1 SEPARATOR '~')) FROM %s" % (e, t))
        k[t] = r[-1]
    f = fungsi(UJI)
    import hashlib
    k['fungsi'] = [len(f), hashlib.md5(''.join(sorted(n + f[n][1] for n in f)).encode('latin1')).hexdigest()]
    return k


def siap(cad, kerangka):
    os.makedirs(cad, exist_ok=True)
    if os.path.exists(os.path.join(cad, 'sidik-awal.json')):
        raise SystemExit('cadangan sudah ada: pulih dulu')
    s0 = sidik()
    fu, fd = fungsi(UJI), fungsi(DASAR)
    ganti = [n for n in fd if n not in fu or normal(fu[n][1], UJI, SIPP_UJI) != normal(fd[n][1], DASAR, SIPP_DASAR)]
    lama = {n: fu[n] for n in ganti if n in fu}
    a = dict(baris(UJI, "SELECT no_var,MD5(CONCAT_WS('|',nama,IFNULL(data_type,''),IFNULL(sql_query,''),IFNULL(default_data,''),IFNULL(referensi,''),IFNULL(multi_sidang,''))) FROM abt_variabel"))
    b = dict(baris(DASAR, "SELECT no_var,MD5(CONCAT_WS('|',nama,IFNULL(data_type,''),IFNULL(sql_query,''),IFNULL(default_data,''),IFNULL(referensi,''),IFNULL(multi_sidang,''))) FROM abt_variabel"))
    baru = [k for k in b if k not in a]
    beda = [k for k in b if k in a and a[k] != b[k]]
    # cadangan baris lama sebagai hex supaya tepat satu lawan satu
    kol = KOLOM.split(',')
    ekspr = ','.join('IF(%s IS NULL,\'NULL\',HEX(%s))' % (c, c) for c in kol)
    lamabaris = baris(UJI, 'SELECT %s FROM abt_variabel WHERE no_var IN (%s)' % (ekspr, ','.join(beda) or '0'))
    json.dump({'sidik': s0, 'fungsi_lama': lama, 'fungsi_baru': [n for n in ganti if n not in fu], 'var_baru': baru, 'var_beda_baris': lamabaris, 'kolom': kol}, open(os.path.join(cad, 'sidik-awal.json'), 'w', encoding='latin1'), ensure_ascii=True)
    # variabel
    sel = 'SELECT %s FROM %s.abt_variabel WHERE no_var IN (%s)' % (KOLOM, DASAR, ','.join(baru + beda) or '0')
    upd = ','.join('%s=VALUES(%s)' % (c, c) for c in kol[1:])
    q(UJI, 'INSERT INTO abt_variabel (%s) %s ON DUPLICATE KEY UPDATE %s' % (KOLOM, sel, upd))
    # variabel paket yang sudah terpasang di server sesudah 3 Nov
    t = open(kerangka, 'rb').read().decode('latin1')
    q(UJI, t)
    # fungsi
    for n in ganti:
        jenis, c = fd[n]
        c = c.replace(DASAR + '.', UJI + '.').replace('`%s`' % DASAR, '`%s`' % UJI).replace(SIPP_DASAR + '.', SIPP_UJI + '.').replace('SIPP.', SIPP_UJI + '.')
        q(UJI, 'DROP %s IF EXISTS `%s`;\nDELIMITER $$\n%s$$\nDELIMITER ;\n' % (jenis, n, c))
    print(json.dumps({'var_baru': len(baru), 'var_beda': len(beda), 'fungsi_ganti': ganti, 'sidik_awal': s0, 'sidik_siap': sidik()}))


def pulih(cad):
    d = json.load(open(os.path.join(cad, 'sidik-awal.json'), encoding='latin1'))
    kol = d['kolom']
    q(UJI, 'DELETE FROM abt_variabel WHERE no_var IN (%s)' % (','.join(d['var_baru'] + ['9266', '9267', '9268', '9269'])))
    q(UJI, "DELETE FROM abt_variabel WHERE no_var = 0")  # baris sisa percobaan pulih bila ada; bukan baris asli (sidik membuktikan)
    for rw in d['var_beda_baris']:
        # HEX() kolom angka adalah heks bilangan, bukan heks teks
        nilai = ','.join('NULL' if v == 'NULL' else (str(int(v, 16)) if k in ANGKA else ('CONVERT(0x%s USING latin1)' % v if v else "''")) for k, v in zip(kol, rw))
        q(UJI, 'REPLACE INTO abt_variabel (%s) VALUES (%s)' % (','.join(kol), nilai))
    for n in d['fungsi_baru']:
        q(UJI, 'DROP FUNCTION IF EXISTS `%s`; DROP PROCEDURE IF EXISTS `%s`;' % (n, n))
    for n, (jenis, c) in d['fungsi_lama'].items():
        q(UJI, 'DROP %s IF EXISTS `%s`;\nDELIMITER $$\n%s$$\nDELIMITER ;\n' % (jenis, n, c))
    s = sidik()
    print('awal', d['sidik'])
    print('kini', s)
    print('SIDIK SAMA' if s == d['sidik'] else 'SIDIK BEDA')


if __name__ == '__main__':
    a = sys.argv[1]
    if a == 'sidik':
        print(sidik())
    elif a == 'siap':
        siap(sys.argv[2], sys.argv[3])
    elif a == 'pulih':
        pulih(sys.argv[2])
