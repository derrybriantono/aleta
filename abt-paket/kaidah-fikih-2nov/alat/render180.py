# -*- coding: utf-8 -*-
"""Render SUNGGUHAN (renderer ABT php56 asli, controller CLI Uji_sela) blangko Derry SEBELUM/SESUDAH paket tanya-jawab-format-1nov,
di salinan MILIK SENDIRI: ABT aps_badilag_w180d (= dump server 28 Okt + 28 paket), tampilan aps_badilag_w180r, SIPP sipp_w180 (salinan
sipp_w163), salinan aplikasi D:/Aplikasi/aleta/tmp/w180/abt.

pakai: python render180.py siapkan
       python render180.py render <akar _blangko_abt> <label> <kasus,kasus,...|semua> [folder keluar]
keluaran: <keluar>/<label>-<kasus>.rtf
"""
import json
import os
import subprocess
import sys

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
PHP = r'D:\sipp-server\php56\php.exe'
TMP = r'D:\Aplikasi\aleta\tmp\w180'
SALINAN = os.path.join(TMP, 'abt')
SRC, RDB = 'aps_badilag_w180d', 'aps_badilag_w180r'
KELUAR = os.path.join(TMP, 'render')
# (kasus, perkara_id, blangko relatif derry_briantono, urutan sidang yang dirender)
KASUS = {
    'cg-saksi': (10184, '1 Perceraian CG - BAS/BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf', 2),
    'ct-saksi': (8668, '1a Perceraian CT - BAS/BAS ALUR 05 [3a] BAS 3 P & T Hadir - Pembuktian P dan T.rtf', 1),
    'poligami-saksi': (7883, '5 Izin Poligami - BAS/BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P.rtf', 2),
    'walad-saksi': (9817, '7 Wali Adhal - BAS/BAS ALUR 19 Wali Adhal - [2] Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan.rtf', 2),
    'itsbat-saksi': (10041, '2 Itsbat Nikah - BAS/BAS ALUR 11 [1] BAS 1 IN - Kabul (1x Sidang).rtf', 1),
    'dk-majelis': (10008, '3 Dispensasi Kawin - BAS/BAS ALUR 12 [1] BAS DK - Anak Perempuan Hamil.rtf', 2),
    'cg-verstek-1x': (9870, '1 Perceraian CG - BAS/BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verstek di Sidang Pertama - Cerai Gugat.rtf', 1),
    'm5404-hp': (9382, '1a Perceraian CT - BAS/BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf', 2),
    'm5404-h': (9384, '1a Perceraian CT - BAS/BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf', 2),
    'm5404-sama': (9384, '1a Perceraian CT - BAS/BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf', 3),
    'cg-3a': (10015, '1 Perceraian CG - BAS/BAS ALUR 05 [3a] BAS 3 P & T Hadir - Pembuktian P dan T.rtf', 3),
    'cg-mediasi': (10015, '1 Perceraian CG - BAS/BAS ALUR 04 [1] BAS 1 P & T Hadir - Mediasi.rtf', 1),
}


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
    jt = os.path.join(TMP, '_tugas_w180_%s.json' % label)
    json.dump(tugas, open(jt, 'w'))
    r = subprocess.run([PHP, '-d', 'memory_limit=1024M', 'index.php', 'uji_sela', 'render'], cwd=SALINAN, env=dict(os.environ, TMP=TMP, TEMP=TMP, UJI_SELA_TUGAS=jt), capture_output=True)
    for t in tugas:
        print('OK' if os.path.exists(t['keluar']) else 'GALAT ' + r.stdout.decode('cp1252', 'replace')[-400:] + r.stderr.decode('cp1252', 'replace')[-300:], t['keluar'])


if __name__ == '__main__':
    if sys.argv[1] == 'siapkan':
        siapkan()
    else:
        render(sys.argv[2], sys.argv[3], sys.argv[4].split(','), sys.argv[5] if len(sys.argv) > 5 else KELUAR)
