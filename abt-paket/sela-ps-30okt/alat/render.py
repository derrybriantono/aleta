# -*- coding: utf-8 -*-
"""Render blangko RTF dengan renderer php56 ABT ASLI (Abt_model::variabel_library) di salinan ABT laptop milik paket ini.

Salinan: D:/Aplikasi/aleta/tmp/sela30/abt (controller CLI Uji_sela; SIPP = sipp_sela30 salinan sipp_2810, ABT = aps_badilag_sela30r).
aps_badilag_sela30r = tampilan baca-saja ke aps_badilag_sela30 (dump server 28 Okt + paket prodeo + paket ini bila terpasang);
'aps_badilag.' di kueri variabel disulih 'aps_badilag_sela30.' (fungsi isian_rtf_* di sana membaca sipp_sela30).
Pola: alat render paket relaas-penetapan-30okt (w131).

pakai: python render.py <tugas.tsv> [siapkan]   (kolom: rtf, perkara_id, sidang_urutan, keluar_txt)
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtfteks import teks_tampak  # noqa: E402

SALINAN = r'D:\Aplikasi\aleta\tmp\sela30\abt'
PHP = r'D:\sipp-server\php56\php.exe'
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
TMP = r'D:\Aplikasi\aleta\tmp\sela30'
SRC = 'aps_badilag_sela30'
RDB = 'aps_badilag_sela30r'


def siapkan():
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '-e',
                        "SELECT table_name FROM information_schema.tables WHERE table_schema = '%s' AND table_type = 'BASE TABLE'" % SRC],
                       capture_output=True, check=True)
    tabel = [t for t in r.stdout.decode().split() if t != 'abt_variabel']
    s = ['DROP DATABASE IF EXISTS %s;' % RDB, 'CREATE DATABASE %s DEFAULT CHARSET latin1;' % RDB]
    s += ['CREATE VIEW %s.`%s` AS SELECT * FROM %s.`%s`;' % (RDB, t, SRC, t) for t in tabel]
    kol = ("no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, REPLACE(sql_query, 'aps_badilag.', '%s.') AS sql_query, "
           "default_data, multi_sidang, locked, modifier, modified" % SRC)
    s.append('CREATE VIEW %s.abt_variabel AS SELECT %s FROM %s.abt_variabel;' % (RDB, kol, SRC))
    subprocess.run([MYSQL, '-h127.0.0.1', '-uroot'], input='\n'.join(s).encode(), check=True)


def render_banyak(tugas, potong=20):
    hasil = {}
    for i in range(0, len(tugas), potong):
        bagian = tugas[i:i + potong]
        daftar = [{'perkara_id': int(p), 'rtf': os.path.abspath(r), 'keluar': os.path.abspath(k) + '.rtf', 'sidang': str(sd or '')}
                  for r, p, sd, k in bagian]
        for _, _, _, k in bagian:
            os.makedirs(os.path.dirname(os.path.abspath(k)), exist_ok=True)
            if os.path.exists(k + '.rtf'):
                os.remove(k + '.rtf')
        jt = os.path.join(TMP, '_tugas_sela_%d.json' % os.getpid())
        json.dump(daftar, open(jt, 'w'))
        env = dict(os.environ, TMP=TMP, TEMP=TMP, UJI_SELA_TUGAS=jt)
        r = subprocess.run([PHP, '-d', 'memory_limit=512M', 'index.php', 'uji_sela', 'render'], cwd=SALINAN, env=env, capture_output=True)
        keluar = r.stdout.decode('cp1252', 'replace')
        for rtf, p, sd, k in bagian:
            if os.path.exists(k + '.rtf'):
                t = teks_tampak(open(k + '.rtf', 'rb').read().decode('latin1'))
                open(k, 'w', encoding='utf-8').write(t)
                hasil[k] = 'OK'
            else:
                hasil[k] = 'GALAT ' + keluar[-600:].replace('\n', ' ') + ' ' + r.stderr.decode('cp1252', 'replace')[-300:]
        if any(v != 'OK' for v in hasil.values()) and 'ERROR Variabel' in keluar and len(bagian) > 1:
            sisa = [t for t in bagian if hasil.get(t[3]) != 'OK']
            if len(sisa) < len(bagian):
                hasil.update(render_banyak(sisa, 1))
    return hasil


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if 'siapkan' in sys.argv[2:]:
        siapkan()
    tg = [l.rstrip('\n').split('\t') for l in open(sys.argv[1], encoding='utf-8') if l.strip() and not l.startswith('#')]
    for k, v in render_banyak(tg).items():
        print(v[:400], k, flush=True)
