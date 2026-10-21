# -*- coding: utf-8 -*-
"""Hubungan saksi (baru) harus milik saksi yang sama dengan namanya: bandingkan dengan satu kueri yang mengambil nama+keterangan dari baris yang SAMA
(ORDER BY urutan LIMIT k,1) dan dengan nilai variabel nama (1197/1203/6100/6106/6132) hasil harness banding_sql."""
import json, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8')
MY = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
d = json.load(open(r'D:\Aplikasi\aleta\tmp\x2\out\banding_sql.json', encoding='utf-8'))
PASANGAN = [('1197', '1241', 1, 0), ('1203', '1242', 1, 1), ('6100', '1251', 2, 0), ('6106', '1252', 2, 1), ('6132', '6149', 1, 2)]
pids = sorted(int(p) for p in d['1241'])
IDX = int(sys.argv[1]) if len(sys.argv) > 1 else 1
hasil = {}
for nama_v, hub_v, sk, k in PASANGAN:
    with open(r'D:\Aplikasi\aleta\tmp\x2\cek_s4.sql', 'w') as f:
        for p in pids:
            f.write("SELECT 'M|%d';\nselect nama, keterangan from perkara_pihak5 where saksi_pihak_ke=%d and perkara_id=%d order by urutan limit %d,1;\n" % (p, sk, p, k))
    r = subprocess.run([MY, '-uroot', '--default-character-set=latin1', '-N', '-B', 'sipp_donggala'], stdin=open(r'D:\Aplikasi\aleta\tmp\x2\cek_s4.sql', 'rb'), capture_output=True)
    out = r.stdout.decode('latin1').replace('\r\n', '\n').split('\n')
    blok = {}
    cur = None
    for l in out:
        if l.startswith('M|'):
            cur = int(l[2:])
            blok[cur] = None
        elif cur is not None and blok[cur] is None:
            blok[cur] = l.split('\t')
    salah_nama = salah_hub = ada = 0
    for p in pids:
        b = blok.get(p)
        nama_var = d[nama_v][str(p)][1]
        hub_baru = d[hub_v][str(p)][IDX]
        if b is None:
            # tidak ada saksi di posisi itu: nama dan hubungan harus sama-sama "tak ada baris"
            if nama_var is not None or hub_baru is not None:
                salah_nama += 1
            continue
        ada += 1
        nm = b[0]
        kt = b[1] if len(b) > 1 and b[1] != 'NULL' else ''
        if (nama_var or '') != ('' if nm == 'NULL' else nm):
            salah_nama += 1
        if (hub_baru or '') != kt:
            salah_hub += 1
    hasil[hub_v] = dict(perkara_dengan_saksi=ada, nama_tak_cocok=salah_nama, hubungan_tak_cocok=salah_hub)
    print(hub_v, hasil[hub_v])
