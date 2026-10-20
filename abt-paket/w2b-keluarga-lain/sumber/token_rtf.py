# -*- coding: utf-8 -*-
"""Kumpulkan penanda #nnnn# dari semua RTF baru/timpa paket dan dari kueri variabel baru; periksa ke server (BACA SAJA).
Pakai: python token_rtf.py [--server]"""
import os
import re
import subprocess
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(AKAR, 'alat'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rtf_peta as R  # noqa: E402
import variabel_def as V  # noqa: E402


def token_dalam(path):
    raw = open(path, 'rb').read().decode('latin1')
    # SEMUA penanda di RTF mentah (termasuk kepala/kaki halaman dan teks tersembunyi): ABT menggantinya juga
    return set(re.findall(r'#(\d{4})#', raw))


def semua():
    rtf = {}
    for akar in ('rtf', 'timpa'):
        for d, _, fs in os.walk(os.path.join(AKAR, akar)):
            for f in fs:
                if f.lower().endswith('.rtf'):
                    rtf[os.path.relpath(os.path.join(d, f), AKAR)] = token_dalam(os.path.join(d, f))
    return rtf


def dari_sql():
    t = set()
    for x in V.VAR:
        t |= set(re.findall(r'#(\d{4})#', (x['sql'] or '')))
        t |= set(re.findall(r'#(\d{4})#', x['nama']))
    return t


def ada_di_server(kode):
    sql = "SELECT no_var FROM aps_badilag.abt_variabel WHERE no_var IN (%s)" % ','.join(str(int(k)) for k in kode)
    r = subprocess.run(['ssh', '-o', 'ConnectTimeout=25', 'aleta', 'bash /root/lihat-jejak.sh "$(cat)"'], input=sql.encode(), capture_output=True, timeout=120)
    return set(x.strip().zfill(4) for x in r.stdout.decode().split('\n')[1:] if x.strip())


if __name__ == '__main__':
    rtf = semua()
    milik = set('%04d' % x['no'] for x in V.VAR)
    pakai = set()
    for k, v in rtf.items():
        pakai |= v
    pakai |= dari_sql()
    lama = sorted(pakai - milik)
    print('RTF:', len(rtf), 'penanda dipakai:', len(pakai), 'milik paket:', len(pakai & milik), 'variabel lama dirujuk:', len(lama))
    # variabel milik paket yang tidak dipakai RTF/kueri mana pun
    nganggur = sorted(milik - pakai)
    print('milik paket tidak dirujuk RTF/kueri:', nganggur)
    if '--server' in sys.argv:
        ada = ada_di_server(lama)
        print('hilang di server:', sorted(set(lama) - ada))
