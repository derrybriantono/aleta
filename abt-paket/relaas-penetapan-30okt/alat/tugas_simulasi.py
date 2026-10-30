# -*- coding: utf-8 -*-
"""Susun daftar tugas simulasi (blangko x perkara x sidang) untuk render.py.
pakai: python tugas_simulasi.py <akar derry_briantono> <folder keluaran teks> <tugas.tsv>"""
import os
import subprocess
import sys

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
AKAR, KELUAR, TUGAS = sys.argv[1], sys.argv[2], sys.argv[3]

# perkara wakil keadaan (sipp_2810)
UMUM = [10163, 10083, 10077, 10155, 9870, 10246]          # CG verstek, CT ikrar, CT kuasa+ikrar, pihak banyak 3v3 kuasa, ghaib, prodeo
IKRAR = [10083, 10077, 10163]
DELEGASI = [7900, 10163, 10155]
ITSBAT = [10275, 10274]
DIDENGAR = [10191, 10275]
MEDIASI = [10227, 10163]
PTSP = [10163, 10083, 10155, 10275, 10246]
BERKAS = [10163, 10155, 10275]
CC = [10155, 10163]
SITA = []
EKS = [6952, 7900]


def sql(q):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '--batch', 'sipp_2810', '-e', q], capture_output=True, check=True)
    return [l.split('\t') for l in r.stdout.decode('latin1').strip().split('\n') if l]


SIDANG = {int(a): int(b) for a, b in sql('SELECT perkara_id, COUNT(*) FROM perkara_jadwal_sidang GROUP BY perkara_id')}
hb = sql("SELECT perkara_id FROM perkara WHERE jenis_perkara_nama LIKE 'Harta Bersama%' ORDER BY perkara_id DESC LIMIT 2")
SITA = [int(x[0]) for x in hb]

tugas = []


def tambah(folder, berkas, daftar, pilih):
    for pid in daftar:
        n = SIDANG.get(pid, 0)
        sd = pilih(n)
        k = os.path.join(KELUAR, folder, os.path.splitext(berkas)[0], '%d_s%s.txt' % (pid, sd or 0))
        tugas.append((os.path.join(AKAR, folder, berkas), str(pid), str(sd or ''), k))


PERTAMA = lambda n: 1 if n else ''          # noqa: E731
AKHIR = lambda n: n if n else ''            # noqa: E731
KEDUA = lambda n: min(2, n) if n else ''    # noqa: E731

for f in sorted(os.listdir(os.path.join(AKAR, '98 Relaas'))):
    if 'AMPLOP' in f.upper() or 'Amplop' in f:
        continue
    if 'Ikrar' in f:
        tambah('98 Relaas', f, IKRAR, AKHIR)
    elif '3.a.' in f:
        tambah('98 Relaas', f, DELEGASI, PERTAMA)
    elif ' 9.' in f:
        tambah('98 Relaas', f, ITSBAT, PERTAMA)
    elif ' 11.' in f or ' 12.' in f or ' 13.' in f:
        tambah('98 Relaas', f, DIDENGAR, PERTAMA)
    elif ' 10.' in f:
        tambah('98 Relaas', f, MEDIASI, PERTAMA)
    elif 'Lanjutan' in f:
        tambah('98 Relaas', f, UMUM, KEDUA)
    else:
        tambah('98 Relaas', f, UMUM, PERTAMA)
for f in sorted(os.listdir(os.path.join(AKAR, '99 PTSP'))):
    if f.startswith('@'):
        tambah('99 PTSP', f, PTSP, PERTAMA)
    elif '(F4)' in f or '(Legal)' in f:
        tambah('99 PTSP', f, BERKAS[:1], PERTAMA)
    else:
        tambah('99 PTSP', f, BERKAS, PERTAMA)
for f in sorted(os.listdir(os.path.join(AKAR, '98b Berkas Perkara - BAS'))):
    tambah('98b Berkas Perkara - BAS', f, BERKAS if '(' not in f else BERKAS[:1], PERTAMA)
for f in sorted(os.listdir(os.path.join(AKAR, '98c Court Calendar - BAS'))):
    tambah('98c Court Calendar - BAS', f, CC, PERTAMA)
for f in sorted(os.listdir(os.path.join(AKAR, '97 Sita'))):
    tambah('97 Sita', f, SITA, KEDUA)
for f in sorted(os.listdir(os.path.join(AKAR, '96 Eksekusi'))):
    tambah('96 Eksekusi', f, EKS, AKHIR)

# amplop (kode pos 9290/9291: kueri 30-70 dtk) paling akhir, 3 perkara
for f in sorted(os.listdir(os.path.join(AKAR, '98 Relaas'))):
    if 'AMPLOP' in f.upper():
        tambah('98 Relaas', f, IKRAR if 'Ikrar' in f else [10163, 10155, 9870], AKHIR if 'Ikrar' in f else PERTAMA)

with open(TUGAS, 'w', encoding='utf-8') as o:
    for t in tugas:
        o.write('\t'.join(t) + '\n')
print(len(tugas), 'tugas; SITA =', SITA)
