# -*- coding: utf-8 -*-
"""Render SUNGGUHAN (renderer ABT php56 asli, controller CLI Uji_sela) blangko Derry SEBELUM/SESUDAH paket perbaikan-1nov,
di salinan MILIK SENDIRI: ABT aps_badilag_w174d (= dump server 28 Okt + 29 paket; sesudah = + paket ini), tampilan aps_badilag_w174r,
SIPP sipp_w174 (salinan sipp_w164), salinan aplikasi D:/Aplikasi/aleta/tmp/w174/abt.

pakai: python render174.py siapkan
       python render174.py render <akar _blangko_abt> <label> <kasus,kasus,...|semua> [folder keluar]
keluaran: <keluar>/<label>-<kasus>.rtf        (data perkara nyata - TIDAK masuk repo)
"""
import json
import os
import subprocess
import sys

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
PHP = r'D:\sipp-server\php56\php.exe'
TMP = r'D:\Aplikasi\aleta\tmp\w174'
SALINAN = os.path.join(TMP, 'abt')
SRC, RDB = 'aps_badilag_w174d', 'aps_badilag_w174r'
KELUAR = os.path.join(TMP, 'render')
KASUS = json.load(open(os.path.join(TMP, 'kasus.json'), encoding='utf-8')) if os.path.exists(os.path.join(TMP, 'kasus.json')) else {}


def sql(s, db=''):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '--default-character-set=latin1'] + ([db] if db else []), input=s.encode('latin1'), capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode('latin1')[-500:])
    return r.stdout.decode('latin1')


def siapkan():
    tabel = [x for x in sql("SELECT table_name FROM information_schema.tables WHERE table_schema = '%s' AND table_type = 'BASE TABLE'" % SRC).split() if x != 'abt_variabel']
    s = ['DROP DATABASE IF EXISTS %s;' % RDB, 'CREATE DATABASE %s DEFAULT CHARSET latin1;' % RDB]
    s += ['CREATE VIEW %s.`%s` AS SELECT * FROM %s.`%s`;' % (RDB, t, SRC, t) for t in tabel]
    kol = ("no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, REPLACE(sql_query, 'aps_badilag.', '%s.') AS sql_query, "
           "default_data, multi_sidang, locked, modifier, modified" % SRC)
    s.append('CREATE VIEW %s.abt_variabel AS SELECT %s FROM %s.abt_variabel;' % (RDB, kol, SRC))
    sql('\n'.join(s))
    print('tampilan %s siap (%d tabel)' % (RDB, len(tabel)))


def render(akar, label, kasus, keluar=KELUAR, tambahan=None):
    """kasus: nama -> (perkara_id, blangko relatif derry_briantono, urutan sidang). Mengembalikan detik jalan."""
    import time
    os.makedirs(keluar, exist_ok=True)
    daftar = dict(KASUS)
    if tambahan:
        daftar.update(tambahan)
    pilih = list(daftar) if kasus == ['semua'] else kasus
    tugas = []
    for nama in pilih:
        perkara, rel, sidang = daftar[nama]
        k = os.path.join(keluar, '%s-%s.rtf' % (label, nama))
        if os.path.exists(k):
            os.remove(k)
        tugas.append({'perkara_id': perkara, 'rtf': os.path.abspath(os.path.join(akar, 'derry_briantono', rel)), 'keluar': k, 'sidang': str(sidang)})
    jt = os.path.join(TMP, '_tugas_w174_%s.json' % label)
    json.dump(tugas, open(jt, 'w'))
    t0 = time.time()
    r = subprocess.run([PHP, '-d', 'memory_limit=1024M', 'index.php', 'uji_sela', 'render'], cwd=SALINAN, env=dict(os.environ, TMP=TMP, TEMP=TMP, UJI_SELA_TUGAS=jt), capture_output=True)
    dt = time.time() - t0
    for l in r.stdout.decode('cp1252', 'replace').splitlines():
        if l.startswith('OK '):
            print('  php: ' + os.path.basename(l.split(' ', 1)[1].rsplit(' ', 2)[0].replace(chr(92), '/')) + ' ' + l.rsplit(' ', 1)[1] + ' dtk')
    for t in tugas:
        print('OK' if os.path.exists(t['keluar']) else 'GALAT ' + r.stdout.decode('cp1252', 'replace')[-400:] + r.stderr.decode('cp1252', 'replace')[-300:], t['keluar'])
    print('waktu render %d berkas: %.1f dtk (%.2f dtk per berkas)' % (len(tugas), dt, dt / max(1, len(tugas))))
    return dt


if __name__ == '__main__':
    if sys.argv[1] == 'siapkan':
        siapkan()
    else:
        render(sys.argv[2], sys.argv[3], sys.argv[4].split(','), sys.argv[5] if len(sys.argv) > 5 else KELUAR)
