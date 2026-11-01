# -*- coding: utf-8 -*-
"""Render SUNGGUHAN (renderer ABT php56 asli, controller CLI Uji_sela) BAS sidang lanjutan dengan blangko SEBELUM dan SESUDAH paket
bas-lanjutan-1nov, di salinan MILIK SENDIRI: ABT aps_badilag_w163d (salinan aps_badilag_w159d = dump server 28 Okt + 27 paket; paket ini
tidak mengubah variabel), tampilan aps_badilag_w163r, SIPP sipp_w163 (salinan sipp_w159), salinan aplikasi D:/Aplikasi/aleta/tmp/w163/abt.

pakai: python render163.py <akar derry_briantono sebelum/sesudah> <label>   (label: sebelum | sesudah)
keluaran: D:/Aplikasi/aleta/tmp/w163/render/abt/<label>-<kasus>.rtf
"""
import json
import os
import shutil
import subprocess
import sys

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
PHP = r'D:\sipp-server\php56\php.exe'
TMP = r'D:\Aplikasi\aleta\tmp\w163'
SALINAN = os.path.join(TMP, 'abt')
SRC, RDB, SIPP = 'aps_badilag_w163d', 'aps_badilag_w163r', 'sipp_w163'
KELUAR = os.path.join(TMP, 'render', 'abt')
BUKTI_JS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'teks-pihak-1nov', 'alat', 'isian_bukti.js')
# (kasus, perkara_id, blangko relatif derry_briantono, urutan sidang yang dirender)
KASUS = [
    ('cg-350-s7-pembuktian-t', 9853, '1 Perceraian CG - BAS/BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf', 7),
    ('ct-375-s9-pembuktian-t', 9878, '1a Perceraian CT - BAS/BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf', 9),
    ('hb-308-s5-jawaban', 9806, '4a Harta Bersama - BAS/BAS ALUR 04 [3] BAS 3 P & T Hadir - Jawaban (dan Gugatan Rekonvensi bila ada).rtf', 5),
]


def sql(s, db=''):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '--default-character-set=latin1'] + ([db] if db else []), input=s.encode('latin1'), capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode('latin1')[-500:])
    return r.stdout.decode('latin1')


def siapkan():
    if not os.path.isdir(SALINAN):
        shutil.copytree(r'D:\Aplikasi\aleta\tmp\w159\abt', SALINAN)
    p = os.path.join(SALINAN, 'application', 'config', 'database.php')
    t = open(p, encoding='latin1').read().replace("'sipp_w159'", "'%s'" % SIPP).replace("'aps_badilag_w159r'", "'%s'" % RDB)
    open(p, 'w', encoding='latin1', newline='').write(t)
    tabel = [x for x in sql("SELECT table_name FROM information_schema.tables WHERE table_schema = '%s' AND table_type = 'BASE TABLE'" % SRC).split() if x != 'abt_variabel']
    s = ['DROP DATABASE IF EXISTS %s;' % RDB, 'CREATE DATABASE %s DEFAULT CHARSET latin1;' % RDB]
    s += ['CREATE VIEW %s.`%s` AS SELECT * FROM %s.`%s`;' % (RDB, t, SRC, t) for t in tabel]
    kol = ("no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, REPLACE(sql_query, 'aps_badilag.', '%s.') AS sql_query, "
           "default_data, multi_sidang, locked, modifier, modified" % SRC)
    s.append('CREATE VIEW %s.abt_variabel AS SELECT %s FROM %s.abt_variabel;' % (RDB, kol, SRC))
    sql('\n'.join(s))


def main():
    akar, label = sys.argv[1], sys.argv[2]
    os.makedirs(KELUAR, exist_ok=True)
    siapkan()
    bukti = json.loads(subprocess.run(['node', BUKTI_JS], capture_output=True, check=True).stdout.decode('utf8'))
    s = ['DELETE FROM %s.abt_data_teks WHERE perkara_id = 9853 AND no_var IN (9955, 9911);' % SRC]
    for no, t in ((9955, bukti['surat']['P']), (9911, bukti['surat']['T'])):
        s.append("INSERT INTO %s.abt_data_teks (no_var, perkara_id, data, modifier) VALUES (%d, 9853, CONVERT(0x%s USING latin1), 'uji');" % (SRC, no, t.encode('latin1').hex()))
    sql('\n'.join(s))
    tugas = []
    for nama, perkara, rel, sidang in KASUS:
        k = os.path.join(KELUAR, '%s-%s.rtf' % (label, nama))
        if os.path.exists(k):
            os.remove(k)
        tugas.append({'perkara_id': perkara, 'rtf': os.path.abspath(os.path.join(akar, 'derry_briantono', rel)), 'keluar': k, 'sidang': str(sidang)})
    jt = os.path.join(TMP, '_tugas_w163_%s.json' % label)
    json.dump(tugas, open(jt, 'w'))
    r = subprocess.run([PHP, '-d', 'memory_limit=1024M', 'index.php', 'uji_sela', 'render'], cwd=SALINAN, env=dict(os.environ, TMP=TMP, TEMP=TMP, UJI_SELA_TUGAS=jt), capture_output=True)
    for t in tugas:
        print('OK' if os.path.exists(t['keluar']) else 'GALAT ' + r.stdout.decode('cp1252', 'replace')[-400:], t['keluar'])


if __name__ == '__main__':
    main()
