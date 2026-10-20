# -*- coding: utf-8 -*-
"""Render blangko RTF memakai renderer php56 ABT (Abt_model::variabel_library) atas SALINAN aplikasi ABT di
D:\\Aplikasi\\aleta\\tmp\\w2b-anak\\abt-salinan yang menunjuk basis ABT sementara aps_badilag_w3brender (tabel lain = view baca-saja ke aps_badilag
LOKAL; abt_variabel = salinan + definisi dari server + variabel paket). Tidak menyentuh ABT asli, basis asli, maupun server.

Persiapan basis (sekali): python render_w3b.py siapkan
Render:  python render_w3b.py render <keluar_dir> <kode>=<rtf>@<perkara_id>[,<perkara_id>...] ...
Isian uji: python render_w3b.py isian <perkara_id> NNNN=teks ...   (ditulis ke aps_badilag.abt_data_teks LOKAL, FK dimatikan)
           python render_w3b.py hapus-isian <perkara_id>
"""
import json
import os
import re
import shutil
import subprocess
import sys

AKAR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AKAR)
sys.path.insert(0, os.path.join(AKAR, '..', 'sumber'))
sys.path.insert(0, AKAR)
from rtf2txt import rtf_ke_teks  # noqa: E402

SALINAN = r'D:\Aplikasi\aleta\tmp\w3b-render\abt-salinan'
PHP = r'D:\sipp-server\php56\php.exe'
TMP = r'D:\Aplikasi\aleta\tmp'
MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
DBR = 'aps_badilag_w3brender'
VARSERVER = r'D:\aleta-dev\kerja\w3b-render-var.json'
VAREXTRA = r'D:\aleta-dev\kerja\w3b-render-extra.json'
PENGGANTI = {
    '9250': "SELECT IFNULL(p.posita,'') AS data FROM perkara p WHERE p.perkara_id = '#perkara_id#'",
    '9251': "SELECT IFNULL(p.petitum,'') AS data FROM perkara p WHERE p.perkara_id = '#perkara_id#'",
    '9259': "SELECT '[keterangan saksi 1 penggugat]' AS data", '9260': "SELECT '[keterangan saksi 2 penggugat]' AS data",
    '9264': "SELECT '[keterangan saksi 1 tergugat]' AS data", '9265': "SELECT '[keterangan saksi 2 tergugat]' AS data",
}


def mysql(sql, db=None):
    cmd = [MYSQL, '-h127.0.0.1', '-uroot', '--default-character-set=utf8', '-B'] + ([db] if db else [])
    r = subprocess.run(cmd, input=sql.encode('utf-8'), capture_output=True)
    return (r.stdout.decode('utf-8', 'replace') + r.stderr.decode('utf-8', 'replace')).strip()


def q(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "''") + "'"


def siapkan():
    import importlib
    import jenis as J
    import variabel_def as V
    for _k, _d in J.JENIS.items():
        importlib.import_module(_d['variabel'])
    sql = open(r'D:\Aplikasi\aleta\tmp\w3b-render\buat-w3brender.sql', encoding='utf-8').read()
    print(mysql(sql) or 'basis dibuat')
    srv = json.load(open(VARSERVER, encoding='utf-8'))
    if os.path.exists(VAREXTRA):
        srv.update(json.load(open(VAREXTRA, encoding='utf-8')))
    baris = []
    for k, e in srv.items():
        sq = PENGGANTI.get(k, e['sql_query'])
        if k not in PENGGANTI and 'aps_badilag.isian_' in (sq or ''):
            sq = "SELECT '[pengganti %s]' AS data" % k
            PENGGANTI[k] = sq
        tipe = 'data_sql' if k in PENGGANTI else e['data_type']
        baris.append("REPLACE INTO %s.abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, sql_query, default_data, referensi, urutan_data, multi_sidang, locked, modifier) VALUES (%d, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0, 'uji');" % (
            DBR, int(k), q(e['nama']), q(tipe), q(e['data_tabel']) if e['data_tabel'] else 'NULL', q(e['data_kolom']) if e['data_kolom'] else 'NULL', q(sq) if sq else 'NULL', q(e['default_data']) if e['default_data'] else 'NULL', e['referensi'] or 'NULL', e['urutan_data'] or 'NULL', q(e['multi_sidang']) if e['multi_sidang'] else 'NULL'))
    for x in V.VAR:
        baris.append("REPLACE INTO %s.abt_variabel (no_var, nama, data_type, sql_query, default_data, referensi, locked, modifier) VALUES (%d, %s, %s, %s, %s, %s, 0, 'uji');" % (DBR, x['no'], q(x['nama']), q(x['tipe']), q(x['sql']) if x['sql'] else 'NULL', q(x['default']) if x.get('default') else 'NULL', q(str(x['referensi'])) if x.get('referensi') else 'NULL'))
    print(mysql('\n'.join(baris)) or '%d variabel dimasukkan' % len(baris))


def isian(pid, pasangan):
    ins = 'SET FOREIGN_KEY_CHECKS=0;' + ';'.join("REPLACE INTO aps_badilag.abt_data_teks (no_var, perkara_id, data, modifier) VALUES (%d, %s, %s, 'uji')" % (int(k), pid, q(v.replace('\\n', '\n'))) for k, v in pasangan.items())
    print(mysql(ins + ';') or 'isian tertulis')


def render(keluar_dir, args):
    os.makedirs(keluar_dir, exist_ok=True)
    env = dict(os.environ, TMP=TMP, TEMP=TMP)
    sementara = os.path.join(SALINAN, '_blangko_abt', '_uji_t_sementara.rtf')
    hasil = []
    for arg in args:
        kode, sisa = arg.split('=', 1)
        rtf, pids = sisa.rsplit('@', 1)
        shutil.copy(rtf, sementara)
        for pid in pids.split(','):
            pid, _, sd = pid.partition(':')   # 'perkara_id:urutan_sidang' (urutan sidang untuk variabel multi-sidang, mis. 0050)
            out = os.path.join(keluar_dir, '%s-%s.rtf' % (kode, pid))
            tugas = os.path.join(TMP, '_tugas_w3brender.json')
            json.dump({'perkara_id': int(pid), 'rtf': '_blangko_abt/_uji_t_sementara.rtf', 'keluar': out, 'sidang': sd}, open(tugas, 'w'))
            r = subprocess.run([PHP, '-d', 'memory_limit=512M', 'index.php', 'uji_t', 'render'], cwd=SALINAN, env=dict(env, UJI_T_TUGAS=tugas), capture_output=True)
            os.remove(tugas)
            st = r.stdout.decode('cp1252', 'replace').strip()
            t = re.sub(r'\n{3,}', '\n\n', rtf_ke_teks(open(out, 'rb').read().decode('latin1'))) if os.path.exists(out) else ''
            open(out[:-4] + '.txt', 'w', encoding='utf-8').write(t)
            sisa_t = sorted(set(re.findall(r'#\d{4,5}#', t)))
            galat = 'ERROR' in t or not st.startswith('OK')
            hasil.append(dict(kode=kode, perkara=pid, php=st[:200], token_sisa=sisa_t, titik3=t.count('...'), periksa=t.count('[PERIKSA'), galat=galat))
            print('%s %s: %s | sisa %s | ... %d | PERIKSA %d%s' % (kode, pid, st[:50], sisa_t, t.count('...'), t.count('[PERIKSA'), ' GALAT ' + r.stderr.decode('cp1252', 'replace')[:300] if galat else ''))
    json.dump(hasil, open(os.path.join(keluar_dir, 'ringkasan.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if sys.argv[1] == 'siapkan':
        siapkan()
    elif sys.argv[1] == 'render':
        render(sys.argv[2], sys.argv[3:])
    elif sys.argv[1] == 'isian':
        isian(sys.argv[2], dict(a.split('=', 1) for a in sys.argv[3:]))
    elif sys.argv[1] == 'hapus-isian':
        print(mysql("SET FOREIGN_KEY_CHECKS=0; DELETE FROM aps_badilag.abt_data_teks WHERE modifier='uji' AND perkara_id=%s;" % sys.argv[2]))
