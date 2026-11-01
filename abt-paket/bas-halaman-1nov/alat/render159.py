# -*- coding: utf-8 -*-
"""Render SUNGGUHAN (renderer ABT php56 asli, controller CLI Uji_sela) dua BAS berurutan satu perkara dengan blangko SESUDAH paket
bas-halaman-1nov, di salinan MILIK SENDIRI: ABT aps_badilag_w159d (salinan aps_badilag_w155d = dump server 28 Okt + 26 paket), tampilan
aps_badilag_w159r, SIPP sipp_w159 (salinan sipp_w155), salinan aplikasi D:/Aplikasi/aleta/tmp/w159/abt.

pakai: python render159.py <akar derry_briantono sesudah 27 paket>
keluaran: D:/Aplikasi/aleta/tmp/w159/render/abt/<kasus>.rtf + jadwal.json (jadwal sidang perkara dari sipp_w159, untuk jalur portal)
"""
import json
import os
import shutil
import subprocess
import sys

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
PHP = r'D:\sipp-server\php56\php.exe'
TMP = r'D:\Aplikasi\aleta\tmp\w159'
SALINAN = os.path.join(TMP, 'abt')
SRC, RDB, SIPP = 'aps_badilag_w159d', 'aps_badilag_w159r', 'sipp_w159'
KELUAR = os.path.join(TMP, 'render', 'abt')
PERKARA = 9853  # 350/Pdt.G/2026/PA.Dgl: sidang 6 Pembuktian, 7 Pembuktian Lanjutan
# BAS ALUR 04 cerai gugat kontradiktoir: pembuktian Penggugat lalu pembuktian Tergugat (dua sidang berurutan)
KASUS = [('bas-a-pembuktian-p', '1 Perceraian CG - BAS/BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P.rtf'),
         ('bas-b-pembuktian-t', '1 Perceraian CG - BAS/BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf')]
ISIAN_BUKTI = 'D:/aleta-dev/wt/w159/abt-paket/teks-pihak-1nov/alat/isian_bukti.js'


def sql(s, db=''):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '--default-character-set=latin1'] + ([db] if db else []), input=s.encode('latin1'), capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode('latin1')[-500:])
    return r.stdout.decode('latin1')


def siapkan():
    if not os.path.isdir(SALINAN):
        shutil.copytree(r'D:\Aplikasi\aleta\tmp\w155\abt', SALINAN)
    p = os.path.join(SALINAN, 'application', 'config', 'database.php')
    t = open(p, encoding='latin1').read().replace("'sipp_w155'", "'%s'" % SIPP).replace("'aps_badilag_w155r'", "'%s'" % RDB)
    open(p, 'w', encoding='latin1', newline='').write(t)
    tabel = [x for x in sql("SELECT table_name FROM information_schema.tables WHERE table_schema = '%s' AND table_type = 'BASE TABLE'" % SRC).split() if x != 'abt_variabel']
    s = ['DROP DATABASE IF EXISTS %s;' % RDB, 'CREATE DATABASE %s DEFAULT CHARSET latin1;' % RDB]
    s += ['CREATE VIEW %s.`%s` AS SELECT * FROM %s.`%s`;' % (RDB, t, SRC, t) for t in tabel]
    kol = ("no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, REPLACE(sql_query, 'aps_badilag.', '%s.') AS sql_query, "
           "default_data, multi_sidang, locked, modifier, modified" % SRC)
    s.append('CREATE VIEW %s.abt_variabel AS SELECT %s FROM %s.abt_variabel;' % (RDB, kol, SRC))
    sql('\n'.join(s))


def main():
    akar = sys.argv[1]
    os.makedirs(KELUAR, exist_ok=True)
    siapkan()
    bukti = json.loads(subprocess.run(['node', ISIAN_BUKTI], capture_output=True, check=True).stdout.decode('utf8'))
    s = ['DELETE FROM %s.abt_data_teks WHERE perkara_id = %d AND no_var IN (9955, 9911);' % (SRC, PERKARA)]
    for no, t in ((9955, bukti['surat']['P']), (9911, bukti['surat']['T'])):
        s.append("INSERT INTO %s.abt_data_teks (no_var, perkara_id, data, modifier) VALUES (%d, %d, CONVERT(0x%s USING latin1), 'uji');" % (SRC, no, PERKARA, t.encode('latin1').hex()))
    sql('\n'.join(s))
    jadwal = []
    for baris in sql("SELECT id, urutan, DATE_FORMAT(tanggal_sidang, '%%Y-%%m-%%d'), IFNULL(ikrar_talak, 'T'), IFNULL(agenda, '') FROM perkara_jadwal_sidang WHERE perkara_id = %d ORDER BY tanggal_sidang, id" % PERKARA, SIPP).strip().split('\n'):
        i, u, t, ik, ag = baris.split('\t')
        jadwal.append({'id': i, 'urutan': int(u or 0), 'tanggal': t, 'ikrar': ik == 'Y', 'agenda': ag})
    json.dump({'perkaraId': str(PERKARA), 'sidang': jadwal}, open(os.path.join(KELUAR, 'jadwal.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # sidang yang dirender: sidang 6 (Pembuktian) dan 7 (Pembuktian Lanjutan) - urutan ABT = parameter d
    pilih = [j for j in jadwal if not j['ikrar'] and j['urutan'] in (6, 7)]
    tugas = []
    for (nama, rel), sd in zip(KASUS, pilih):
        k = os.path.join(KELUAR, nama + '.rtf')
        if os.path.exists(k):
            os.remove(k)
        tugas.append({'perkara_id': PERKARA, 'rtf': os.path.abspath(os.path.join(akar, rel)), 'keluar': k, 'sidang': str(sd['urutan'])})
        print('tugas', nama, 'sidang', sd)
    jt = os.path.join(TMP, '_tugas_w159.json')
    json.dump(tugas, open(jt, 'w'))
    r = subprocess.run([PHP, '-d', 'memory_limit=1024M', 'index.php', 'uji_sela', 'render'], cwd=SALINAN, env=dict(os.environ, TMP=TMP, TEMP=TMP, UJI_SELA_TUGAS=jt), capture_output=True)
    for t in tugas:
        print('OK' if os.path.exists(t['keluar']) else 'GALAT ' + r.stdout.decode('cp1252', 'replace')[-400:], t['keluar'])
    json.dump([{'berkas': t['keluar'], 'sidangId': sd['id'], 'tanggal': sd['tanggal']} for t, sd in zip(tugas, pilih)], open(os.path.join(KELUAR, 'tugas.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
