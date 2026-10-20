# -*- coding: utf-8 -*-
"""Uji kueri variabel keluarga anak di SIPP LOKAL (sipp_donggala, XAMPP D:) atau SERVER (baca saja).
Pakai:
  python anak_ujisql.py lokal <no_var[,no_var]> <perkara_id> [NNNN=isian ...]    isian ditulis sementara ke aps_badilag.abt_data_teks lokal (perkara_id uji 999000001 dst.), lalu dihapus
  python anak_ujisql.py server <no_var[,no_var]> <perkara_id>                    server: tanpa isian (baca saja)
Penanda #nnnn# lain diganti [nnnn] agar terbaca.
"""
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sumber'))
import variabel_def as V  # noqa: E402

MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'


def lokal(sql, db='sipp_donggala'):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '--default-character-set=utf8', '-B', db], input=sql.encode('utf-8'), capture_output=True)
    return (r.stdout.decode('utf-8', 'replace') + r.stderr.decode('utf-8', 'replace')).strip()


def server(sql):
    r = subprocess.run(['ssh', '-o', 'ConnectTimeout=25', 'aleta', 'bash /root/lihat-jejak.sh "$(cat)"'], input=sql.encode('utf-8'), capture_output=True, timeout=180)
    return (r.stdout.decode('utf-8', 'replace') + r.stderr.decode('utf-8', 'replace')).strip()


def siapkan(sql, pid):
    s = sql.replace('#perkara_id#', str(pid))
    return re.sub(r'#(\d{4})#', r'[\1]', s)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    mode, nomor, pid = sys.argv[1], sys.argv[2], sys.argv[3]
    isian = dict(a.split('=', 1) for a in sys.argv[4:])
    tabel = {x['no']: x for x in V.VAR}
    if mode == 'lokal' and isian:
        ins = 'SET FOREIGN_KEY_CHECKS=0;' + ';'.join("INSERT INTO aps_badilag.abt_data_teks (no_var, perkara_id, data, modifier) VALUES (%d, %s, '%s', 'uji') ON DUPLICATE KEY UPDATE data=VALUES(data)" % (int(k), pid, v.replace("'", "''").replace('\\n', '\n')) for k, v in isian.items())
        print(lokal(ins + ';'))
    try:
        for n in nomor.split(','):
            sql = siapkan(tabel[int(n)]['sql'], pid)
            hasil = lokal(sql) if mode == 'lokal' else server(sql)
            print('== %s ==\n%s' % (n, hasil))
    finally:
        if mode == 'lokal' and isian:
            lokal("SET FOREIGN_KEY_CHECKS=0; DELETE FROM aps_badilag.abt_data_teks WHERE modifier='uji' AND perkara_id=%s;" % pid)
