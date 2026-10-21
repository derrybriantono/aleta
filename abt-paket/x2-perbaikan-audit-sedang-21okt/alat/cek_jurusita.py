# -*- coding: utf-8 -*-
"""Nama jurusita #0018# (baris pertama alami, tanpa ORDER BY) vs jurusita yang dipakai label baru (ORDER BY a.id LIMIT 1): harus sama pada semua perkara."""
import subprocess, sys
MY = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
pids = [int(x) for x in subprocess.run([MY, '-uroot', '-N', 'sipp_donggala', '-e', 'select distinct perkara_id from perkara_jurusita'], capture_output=True).stdout.decode().split()]
A = 'select b.nama_gelar as data from perkara_jurusita a join jurusita b on a.jurusita_id =b.id where a.aktif="Y" and a.urutan=1 and a.perkara_id=%d'
B = A + ' order by a.id limit 1'
with open(r'D:\Aplikasi\aleta\tmp\x2\cek_jur.sql', 'w') as f:
    for p in pids:
        f.write("SELECT 'M|%d';\n%s;\n%s;\n" % (p, A % p, B % p))
r = subprocess.run([MY, '-uroot', '-N', '-B', '--force', 'sipp_donggala'], stdin=open(r'D:\Aplikasi\aleta\tmp\x2\cek_jur.sql', 'rb'), capture_output=True)
out = r.stdout.decode('latin1').replace('\r\n', '\n').split('\n')
blok = {}
cur = None
for l in out:
    if l.startswith('M|'):
        cur = int(l[2:])
        blok[cur] = []
    elif cur is not None:
        blok[cur].append(l)
# tiap perkara: baris untuk A (n baris) lalu B (<=1 baris); B = baris terakhir bila ada
tak_sama = []
for p, b in blok.items():
    b = [x for x in b if x != '' or True]
    if b and b[-1] == '':
        b = b[:-1]
    if not b:
        continue
    pertamaA = b[0]
    B_ = b[-1]
    if pertamaA != B_:
        tak_sama.append((p, b))
print('perkara', len(blok), 'tidak sama:', len(tak_sama), tak_sama[:10])
