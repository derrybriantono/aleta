# -*- coding: utf-8 -*-
"""Ambil definisi variabel ABT dari server (BACA SAJA) ke berkas JSON kerja.
Pakai: python anak_varserver.py <keluaran.json> 9250 9251 ...  atau  python anak_varserver.py <keluaran.json> @daftar.txt"""
import json
import subprocess
import sys


def ambil(nomor):
    sql = ("SELECT no_var, nama, data_type, IFNULL(data_tabel,''), IFNULL(data_kolom,''), IFNULL(sql_query,''), IFNULL(default_data,'') FROM aps_badilag.abt_variabel WHERE no_var IN (%s) ORDER BY no_var"
           % ','.join(str(int(n)) for n in nomor))
    r = subprocess.run(['ssh', '-o', 'ConnectTimeout=25', 'aleta', 'bash /root/lihat-jejak.sh "$(cat)"'], input=sql.encode(), capture_output=True, timeout=180)
    hasil = {}
    for b in r.stdout.decode('utf-8', 'replace').split('\n')[1:]:
        if not b.strip():
            continue
        k = b.split('\t')
        k += [''] * (7 - len(k))
        sq = k[5].replace('\\n', '\n').replace('\\t', '\t').replace('\\\\', '\\')
        hasil[k[0].zfill(4)] = dict(no_var=k[0].zfill(4), nama=k[1], data_type=k[2], data_tabel=k[3], data_kolom=k[4], sql_query=sq, default_data=k[6])
    return hasil


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    arg = sys.argv[2:]
    if arg and arg[0].startswith('@'):
        arg = [x for x in open(arg[0][1:]).read().split() if x]
    h = ambil(arg)
    json.dump(h, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(h), 'variabel')
