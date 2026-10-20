# -*- coding: utf-8 -*-
"""Pemeriksaan mandiri paket keluarga anak (tanpa server): python anak_periksa_paket.py
 1. variabel 4880-4909: nomor unik, nama <= 200, kueri hanya SELECT, tanpa kata aplikasi, teks kueri ASCII murni
 2. RTF baru dan timpa: tanpa kata aplikasi, penanda #nnnn# tidak terpecah, semua penanda dikenal (variabel paket atau katalog server)
 3. daftar-timpa-anak.tsv: md5 baru = md5 berkas; md5 lama bukan md5 baru
 4. setiap variabel paket dipakai (penanda di RTF atau rujukan isian di kueri lain)
Kode keluar 1 bila ada galat."""
import hashlib
import json
import os
import re
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(AKAR, 'alat'))
sys.path.insert(0, os.path.join(AKAR, 'sumber'))
import variabel_def as V  # noqa: E402
from bangun import Dok, periksa_token  # noqa: E402

KATALOG = ['D:/aleta-dev/kerja/w2b-anak-server/var-server.json', 'D:/aleta-dev/kerja/w2b-anak-server/v-extra.json']


def md5f(p):
    return hashlib.md5(open(p, 'rb').read()).hexdigest()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    galat = []
    mine = [x for x in V.VAR if 4880 <= x['no'] <= 4909]
    nomor = [x['no'] for x in mine]
    if len(set(nomor)) != len(nomor):
        galat.append('nomor ganda')
    kenal = set('%04d' % n for n in nomor)
    for k in KATALOG:
        if os.path.exists(k):
            kenal |= set(json.load(open(k, encoding='utf-8')).keys())
    kenal |= set(json.load(open('D:/Aplikasi/aleta/tmp/abt-variabel.json', encoding='utf-8')).keys())
    for x in mine:
        if len(x['nama']) > 200:
            galat.append('nama %d terlalu panjang' % x['no'])
        if re.search(r'aleta', x['nama'] + (x['sql'] or ''), re.I):
            galat.append('kata aplikasi di %d' % x['no'])
        if x['sql']:
            s = x['sql']
            if not s.lstrip().upper().startswith('SELECT'):
                galat.append('%d bukan SELECT' % x['no'])
            if re.search(r'\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE INTO)\b', s.upper()):
                galat.append('%d memuat perintah tulis' % x['no'])
            if any(ord(c) > 127 for c in s):
                galat.append('%d memuat karakter non-ASCII' % x['no'])
            if 'AS data' not in s:
                galat.append('%d tanpa kolom data' % x['no'])
    pakai = set()
    jumlah_rtf = 0
    for akar in ('rtf', 'timpa'):
        for d, _, fs in os.walk(os.path.join(AKAR, akar)):
            for f in fs:
                if not f.endswith('.rtf'):
                    continue
                jumlah_rtf += 1
                p = os.path.join(d, f)
                raw = open(p, 'rb').read().decode('latin1')
                if re.search(r'aleta', raw, re.I):
                    galat.append('kata aplikasi di RTF ' + f)
                if periksa_token(raw):
                    galat.append('penanda terpecah di ' + f)
                for t in re.findall(r'#(\d{4})#', raw):
                    pakai.add(t)
                    if t not in kenal:
                        galat.append('penanda %s tidak dikenal di %s' % (t, f))
    for x in mine:
        if x['sql']:
            for t in re.findall(r'#(\d{4})#', x['sql']):
                pakai.add(t)
                if t not in kenal:
                    galat.append('penanda %s tidak dikenal di kueri %d' % (t, x['no']))
    rujukan_isian = set()
    for x in mine:
        for m in re.findall(r'no_var = (\d{4})', x['sql'] or ''):
            rujukan_isian.add(m)
    for x in mine:
        k = '%04d' % x['no']
        if k not in pakai and k not in rujukan_isian:
            galat.append('variabel %s tidak dipakai' % k)
    for b in open(os.path.join(AKAR, 'daftar-timpa-anak.tsv'), encoding='utf-8').read().split('\n'):
        if not b or b.startswith('#'):
            continue
        f, berkas, lama, baru, ket = b.split('\t')
        p = os.path.join(AKAR, 'timpa', f, berkas)
        if md5f(p) != baru:
            galat.append('md5 baru tidak cocok: ' + berkas)
        if lama == baru:
            galat.append('md5 lama = baru: ' + berkas)
    print('variabel milik paket: %d | RTF diperiksa: %d | galat: %d' % (len(mine), jumlah_rtf, len(galat)))
    for g in galat:
        print('  GALAT', g)
    sys.exit(1 if galat else 0)
