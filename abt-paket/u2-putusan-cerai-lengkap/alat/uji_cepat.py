# -*- coding: utf-8 -*-
"""Jalankan kueri variabel paket langsung di MySQL laptop (sipp_donggala + aps_badilag_u2) dengan penanda sistem dipetakan statis.
Dipakai untuk iterasi cepat; pembuktian akhir tetap lewat render PHP (render_u2.py).
Pakai sebagai modul: jalan(no, pid, isian=None) -> teks."""
import json, os, re, subprocess, sys
AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
V = None


def muat():
    global V
    if V is None:
        V = {v['no']: v for v in json.load(open(os.path.join(AKAR, 'data', 'variabel.json'), encoding='utf-8'))}
    return V


def peta_token(jn):
    ct = jn == 346
    return {'0046': 'Pemohon' if ct else 'Penggugat', '0047': 'Termohon' if ct else 'Tergugat', '0053': 'permohonan' if ct else 'gugatan',
            '8554': 'Majelis Hakim', '8008': 'Pengadilan Agama Donggala', '8602': 'ANAK A bin B', '5114': 'anak', '0100': 'Petani', '0104': 'Wiraswasta',
            '7777': '5 tahun', '0222': 'awal tahun 2024', '0246': 'bulan Januari 2025', '9944': '1 (satu) tahun 2 (dua) bulan', '5171': '', '5271': ''}


def jalan(no, pid, jn=None, db_sipp='sipp_donggala', db_abt='aps_badilag_u2'):
    v = muat()[no]
    if jn is None:
        r = subprocess.run([MYSQL, '-uroot', '-N', db_sipp, '-e', 'SELECT jenis_perkara_id FROM perkara WHERE perkara_id=%d' % pid], capture_output=True)
        jn = int(r.stdout.decode().strip() or 347)
    q = v['sql'].replace('aps_badilag.', db_abt + '.').replace('#perkara_id#', str(pid))
    pt = peta_token(jn)
    q = re.sub(r'#(\d{4})#', lambda m: pt.get(m.group(1), 'X' + m.group(1)), q)
    r = subprocess.run([MYSQL, '-uroot', '--default-character-set=utf8', '-N', '--raw', db_sipp], input=q.encode('utf-8'), capture_output=True)
    if r.returncode:
        return 'GALAT SQL: ' + r.stderr.decode('utf-8', 'replace')[:400]
    return r.stdout.decode('utf-8', 'replace').rstrip('\n').replace('<br>', '\n')
