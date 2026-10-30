# -*- coding: utf-8 -*-
"""Render blangko RTF Derry dengan renderer php56 ABT ASLI (Abt_model::variabel_library) di salinan ABT laptop.

Salinan: D:/Aplikasi/aleta/tmp/rp30/abt (controller CLI Uji_rp; SIPP = sipp_2810, ABT = aps_badilag_rp30r).
aps_badilag_rp30r = tampilan baca-saja ke <sumber> (aps_badilag_rp30 = keadaan server 28 Okt / aps_badilag_rp30b = paket
terpasang); 'aps_badilag.' di kueri variabel disulih '<sumber>.', fungsi isian_rtf_* di <sumber> membaca sipp_2810.

pakai (modul):  siapkan(sumber); render_banyak([(rtf, perkara_id, sidang_urutan, keluar_txt), ...])
pakai (CLI):    python render.py <sumber> <tugas.tsv>   (kolom: rtf, perkara_id, sidang, keluar_txt)
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtfteks import teks_tampak  # noqa: E402

SALINAN = r'D:\Aplikasi\aleta\tmp\rp30\abt'
PHP = r'D:\sipp-server\php56\php.exe'
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
TMP = r'D:\Aplikasi\aleta\tmp\rp30'
RDB = 'aps_badilag_rp30r'


def siapkan(src, var_src=None):
    """src = basis ABT (tabel + fungsi isian_rtf_*); var_src = basis tempat abt_variabel dibaca (bawaan src; aps_badilag_rp30b = paket terpasang)."""
    var_src = var_src or src
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '-e',
                        "SELECT table_name FROM information_schema.tables WHERE table_schema = '%s' AND table_type = 'BASE TABLE'" % src],
                       capture_output=True, check=True)
    tabel = [t for t in r.stdout.decode().split() if t != 'abt_variabel']
    s = ['DROP DATABASE IF EXISTS %s;' % RDB, 'CREATE DATABASE %s DEFAULT CHARSET latin1;' % RDB]
    s += ['CREATE VIEW %s.`%s` AS SELECT * FROM %s.`%s`;' % (RDB, t, src, t) for t in tabel]
    kol = ("no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, REPLACE(sql_query, 'aps_badilag.', '%s.') AS sql_query, "
           "default_data, multi_sidang, locked, modifier, modified" % src)
    s.append('CREATE VIEW %s.abt_variabel AS SELECT %s FROM %s.abt_variabel;' % (RDB, kol, var_src))
    subprocess.run([MYSQL, '-h127.0.0.1', '-uroot'], input='\n'.join(s).encode(), check=True)


def render_banyak(tugas, potong=40):
    """tugas: [(rtf, perkara_id, sidang, keluar_txt)]. Keluaran: teks tampak (utf-8) di keluar_txt, RTF di keluar_txt + '.rtf'."""
    hasil = {}
    for i in range(0, len(tugas), potong):
        bagian = tugas[i:i + potong]
        daftar = [{'perkara_id': int(p), 'rtf': os.path.abspath(r), 'keluar': os.path.abspath(k) + '.rtf', 'sidang': str(sd or '')}
                  for r, p, sd, k in bagian]
        for _, _, _, k in bagian:
            os.makedirs(os.path.dirname(os.path.abspath(k)), exist_ok=True)
            if os.path.exists(k + '.rtf'):
                os.remove(k + '.rtf')
        jt = os.path.join(TMP, '_tugas_rp_%d.json' % os.getpid())
        json.dump(daftar, open(jt, 'w'))
        env = dict(os.environ, TMP=TMP, TEMP=TMP, UJI_RP_TUGAS=jt)
        r = subprocess.run([PHP, '-d', 'memory_limit=512M', 'index.php', 'uji_rp', 'render'], cwd=SALINAN, env=env, capture_output=True)
        keluar = r.stdout.decode('cp1252', 'replace')
        for rtf, p, sd, k in bagian:
            if os.path.exists(k + '.rtf'):
                t = teks_tampak(open(k + '.rtf', 'rb').read().decode('latin1'))
                open(k, 'w', encoding='utf-8').write(t)
                hasil[k] = 'OK'
            else:
                hasil[k] = 'GALAT ' + keluar[-400:].replace('\n', ' ') + ' ' + r.stderr.decode('cp1252', 'replace')[-200:]
        if any(v != 'OK' for v in hasil.values()) and 'ERROR Variabel' in keluar:
            # die() di Abt_model menghentikan proses: sisa tugas bagian ini diulang satu per satu
            sisa = [t for t in bagian if hasil.get(t[3]) != 'OK']
            if len(sisa) < len(bagian):
                hasil.update(render_banyak(sisa, 1))
    return hasil


if __name__ == '__main__':
    # python render.py <sumber|-> <tugas.tsv> [i/n]   ('-' = tampilan rp30r sudah disiapkan; i/n = bagian ke-i dari n)
    sys.stdout.reconfigure(encoding='utf-8')
    if sys.argv[1] != '-':
        a, _, b = sys.argv[1].partition('+')     # "aps_badilag_rp30+aps_badilag_rp30b" = tabel rp30, variabel rp30b
        siapkan(a, b or None)
    tg = [l.rstrip('\n').split('\t') for l in open(sys.argv[2], encoding='utf-8') if l.strip() and not l.startswith('#')]
    tg = [t for t in tg if not os.path.exists(t[3])]
    if len(sys.argv) > 3:
        i, n = map(int, sys.argv[3].split('/'))
        tg = tg[i::n]
    for k, v in render_banyak(tg, 10).items():
        print(v[:300], k, flush=True)
