# -*- coding: utf-8 -*-
"""Render blangko RTF Derry utuh memakai renderer php56 ABT asli (Abt_model::variabel_library, salinan milik paket ini
D:/Aplikasi/aleta/tmp/pp29/abt-salinan: SIPP = sipp_2810, ABT = aps_badilag_pp29r). aps_badilag_pp29r = tampilan baca-saja ke
<sumber> (aps_badilag_2810 = keadaan server / aps_badilag_pp29 = paket terpasang); 'aps_badilag.' di kueri variabel disulih '<sumber>.'.
pakai: python render.py <sumber> <berkas.rtf> <perkara_id>[:sidang] ...  -> teks polos ke stdout"""
import json
import os
import re
import subprocess
import sys

SALINAN = r'D:\Aplikasi\aleta\tmp\pp29\abt-salinan'
PHP = r'D:\sipp-server\php56\php.exe'
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
TMP = r'D:\Aplikasi\aleta\tmp\pp29'
RDB = 'aps_badilag_pp29r'


def siapkan(src):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '-e',
                        "SELECT table_name FROM information_schema.tables WHERE table_schema = '%s' AND table_type = 'BASE TABLE'" % src],
                       capture_output=True, check=True)
    tabel = [t for t in r.stdout.decode().split() if t != 'abt_variabel']
    s = ['DROP DATABASE IF EXISTS %s;' % RDB, 'CREATE DATABASE %s DEFAULT CHARSET latin1;' % RDB]
    s += ['CREATE VIEW %s.`%s` AS SELECT * FROM %s.`%s`;' % (RDB, t, src, t) for t in tabel]
    kol = ("no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, REPLACE(sql_query, 'aps_badilag.', '%s.') AS sql_query, "
           "default_data, multi_sidang, locked, modifier, modified" % src)
    s.append('CREATE VIEW %s.abt_variabel AS SELECT %s FROM %s.abt_variabel;' % (RDB, kol, src))
    subprocess.run([MYSQL, '-h127.0.0.1', '-uroot'], input='\n'.join(s).encode(), check=True)


def rtf_teks(s):
    s = re.sub(r'\\u(-?\d+)\??', lambda m: chr(int(m.group(1)) % 65536), s)
    s = re.sub(r"\\'([0-9a-f]{2})", lambda m: bytes.fromhex(m.group(1)).decode('cp1252', 'replace'), s)
    s = re.sub(r'\\par[d]?\b', '\n', s)
    s = re.sub(r'\\line\b', '\n', s)
    s = re.sub(r'\\tab\b', '\t', s)
    s = re.sub(r'\\[a-zA-Z]+-?\d* ?', '', s)
    s = re.sub(r'[{}]', '', s)
    return s.strip()


def render(berkas, pid, sidang=''):
    rtf = open(berkas, 'rb').read()
    sem = os.path.join(SALINAN, '_blangko_abt', '_uji_t_sementara.rtf')
    open(sem, 'wb').write(rtf)
    out = os.path.join(TMP, '_keluar_%s.rtf' % pid)
    tugas = os.path.join(TMP, '_tugas.json')
    json.dump({'perkara_id': int(pid), 'rtf': '_blangko_abt/_uji_t_sementara.rtf', 'keluar': out, 'sidang': sidang}, open(tugas, 'w'))
    env = dict(os.environ, TMP=TMP, TEMP=TMP, UJI_T_TUGAS=tugas)
    r = subprocess.run([PHP, '-d', 'memory_limit=512M', 'index.php', 'uji_t', 'render'], cwd=SALINAN, env=env, capture_output=True)
    st = r.stdout.decode('cp1252', 'replace').strip()
    if not os.path.exists(out):
        return 'GALAT RENDER ' + st[:500] + ' ' + r.stderr.decode('cp1252', 'replace')[:300]
    t = rtf_teks(open(out, 'rb').read().decode('latin1'))
    os.remove(out)
    return t


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    siapkan(sys.argv[1])
    for a in sys.argv[3:]:
        pid, _, sd = a.partition(':')
        print('=== perkara %s' % pid)
        print(render(sys.argv[2], pid, sd))
