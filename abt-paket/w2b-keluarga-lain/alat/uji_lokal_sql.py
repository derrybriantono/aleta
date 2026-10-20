# -*- coding: utf-8 -*-
"""Uji kueri variabel data_sql atas MariaDB LOKAL (XAMPP): SIPP sipp_donggala + isian ABT aps_badilag.abt_data_teks.
Pakai: python uji_lokal_sql.py <no_var> <perkara_id> [KODE=isian ...]
KODE=isian menyisipkan baris sementara ke aps_badilag.abt_data_teks (no_var=KODE, perkara_id) untuk satu kali jalan lalu dihapus.
Sebagai pustaka: jalankan(sql, perkara_id, isian_dict) -> teks hasil. Hanya basis lokal; tidak menyentuh server."""
import os
import re
import subprocess
import sys

MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sumber'))


def _mysql(sql, db='sipp_donggala'):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '--default-character-set=utf8', '-N', '-B', db], input=sql.encode('utf-8'), capture_output=True, timeout=120)
    return (r.stdout.decode('utf-8', 'replace') + r.stderr.decode('utf-8', 'replace')).strip()


def jalankan(sql, perkara_id, isian=None):
    isian = isian or {}
    baris = []
    baru_var = []
    for k, n in isian.items():
        ada = _mysql("SELECT COUNT(*) FROM aps_badilag.abt_variabel WHERE no_var=%d;" % int(k))
        if ada.strip() == '0':
            baris.append("INSERT INTO aps_badilag.abt_variabel (no_var, nama, data_type, locked, modifier, modified) VALUES (%d, 'uji sementara', 'data_teks', 0, 'uji', NOW())" % int(k))
            baru_var.append(int(k))
        baris.append("INSERT INTO aps_badilag.abt_data_teks (perkara_id, no_var, data) VALUES ('%s', %d, '%s')" % (perkara_id, int(k), n.replace("'", "''")))
    try:
        if baris:
            _mysql(';'.join(baris) + ';')
        s = sql.replace('#perkara_id#', str(perkara_id))
        s = re.sub(r'(?<!&)#(\d{4})#', '#\\1#', s)
        return _mysql(s + ';')
    finally:
        if isian:
            _mysql("DELETE FROM aps_badilag.abt_data_teks WHERE perkara_id='%s' AND no_var IN (%s);" % (perkara_id, ','.join(str(int(k)) for k in isian)))
        for k in baru_var:
            _mysql("DELETE FROM aps_badilag.abt_variabel WHERE no_var=%d AND nama='uji sementara';" % k)


if __name__ == '__main__':
    import variabel_def as V
    no = int(sys.argv[1])
    d = [x for x in V.VAR if x['no'] == no][0]
    isi = dict(a.split('=', 1) for a in sys.argv[3:])
    print(jalankan(d['sql'], sys.argv[2], isi))
