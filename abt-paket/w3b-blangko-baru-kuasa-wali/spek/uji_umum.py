# -*- coding: utf-8 -*-
"""Uji umum satu jenis (atau semua): python uji_umum.py [kunci ...]
  (a) membangun berkas (bangun_semua.bangun) tanpa galat,
  (b) semua penanda #nnnn# di berkas dan di kueri/nama/bawaan variabel milik paket ada di server (variabel lama: w3b-var-server.pkl) atau milik paket,
  (c) tidak ada kata terlarang (Aleta) dan tidak ada sisa penanda jenis lain (nafkah 974x/975x) di jenis yang bukan nafkah,
  (d) tiap kueri data_sql milik jenis dijalankan atas perkara nyata di server (BACA SAJA) dan tidak menghasilkan galat SQL.
Keluar 1 bila ada yang gagal."""
import os
import pickle
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
AKAR = os.path.dirname(SINI)
sys.path.insert(0, os.path.join(AKAR, 'sumber'))
sys.path.insert(0, os.path.join(AKAR, 'alat'))
sys.stdout.reconfigure(encoding='utf-8')
import bangun_semua  # noqa: E402
import jenis as J  # noqa: E402
import variabel_def as V  # noqa: E402
from bangun import lp  # noqa: E402
from pustaka import KELUAR  # noqa: E402
import uji_sql  # noqa: E402

SERVER = pickle.load(open('D:/aleta-dev/kerja/w3b-var-server.pkl', 'rb'))
# perkara nyata untuk uji kueri (SIPP.perkara.perkara_id): perwalian, eksekusi kewarisan, verzet
PERKARA_UJI = {'default': [9321], 'eksekusi': [6326, 7900], 'verzet': [9321]}
RENTANG = {'353': (3800, 3829), '355': (3830, 3859), '356': (3860, 3889), '357': (3890, 3919), '350': (3920, 3939), 'eksekusi': (3940, 3969), 'verzet': (3970, 3999)}


def uji(kunci):
    gagal = []
    S = bangun_semua.bangun(kunci)
    if S is None:
        return ['spek belum ada']
    rentang = RENTANG[kunci]
    milik = {x['no']: x for x in V.VAR if rentang[0] <= x['no'] <= rentang[1]}
    print('%s: %d variabel milik jenis, rentang %s' % (kunci, len(milik), rentang))
    # (b) penanda
    semua_milik = set('%04d' % x['no'] for x in V.VAR)
    pakai = {}
    for folder in (S['folder'], S['folder'] + ' - BAS'):
        d = os.path.join(KELUAR, folder)
        if not os.path.isdir(lp(d)):
            continue
        for f in os.listdir(lp(d)):
            raw = open(lp(os.path.join(d, f)), 'rb').read().decode('latin1')
            if re.search(r'aleta', raw, re.I):
                gagal.append('kata Aleta di ' + f)
            for t in set(re.findall(r'#(\d{4})#', raw)):
                pakai.setdefault(t, f)
    for x in milik.values():
        for t in set(re.findall(r'#(\d{4})#', (x['sql'] or '') + x['nama'] + (x['default'] or ''))):
            pakai.setdefault(t, 'var %d' % x['no'])
    hilang = sorted(t for t in pakai if t not in SERVER and t not in semua_milik)
    if hilang:
        gagal.append('penanda tidak ada di server/paket: ' + ', '.join('%s (%s)' % (t, pakai[t][:40]) for t in hilang))
    # (c) sisa jenis lain
    if kunci != '350':
        for folder in (S['folder'], S['folder'] + ' - BAS'):
            d = os.path.join(KELUAR, folder)
            if not os.path.isdir(lp(d)):
                continue
            for f in os.listdir(lp(d)):
                raw = open(lp(os.path.join(d, f)), 'rb').read().decode('latin1')
                for t in set(re.findall(r'#(97[45]\d)#', raw)):
                    gagal.append('sisa penanda nafkah #%s# di %s' % (t, f[:60]))
    # (d) kueri
    perkara = PERKARA_UJI.get(kunci, PERKARA_UJI['default'])
    for no, x in sorted(milik.items()):
        if x['tipe'] != 'data_sql' or not x['sql']:
            continue
        for pid in perkara:
            hasil = uji_sql.jalankan(x['sql'], pid)
            if re.search(r'ERROR|error|Unknown|syntax', hasil):
                gagal.append('SQL %d perkara %d: %s' % (no, pid, hasil[:200]))
            else:
                print('  SQL %d perkara %d -> %s' % (no, pid, re.sub(r'\s+', ' ', hasil.split('\n', 1)[-1])[:100]))
    return gagal


if __name__ == '__main__':
    kunci = sys.argv[1:] or list(J.JENIS)
    total = 0
    for k in kunci:
        g = uji(k)
        for x in g:
            print('GAGAL', k, x)
        total += len(g)
    print('SELESAI: %d kegagalan' % total)
    sys.exit(1 if total else 0)
