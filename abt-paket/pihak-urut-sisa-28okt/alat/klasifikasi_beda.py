# -*- coding: utf-8 -*-
"""Klasifikasi selisih hasil bandingkan.js (lama = keadaan server sesudah paket 27 Okt, baru = paket 28 Okt): tiap perkara yang keluarannya BERUBAH harus
punya sebab yang dirancang, yaitu urutan pihak pada tabel yang dipakai variabel itu TIDAK rapat dari 1 (mulai bukan 1, berlubang, atau kembar).
Selisih tanpa sebab itu = galat paket. Variabel yang menelusuri perkara LAIN (8890, 9280, 9281, 9290-9293) bisa berubah karena perkara lain yang tak rapat;
untuk itu dicatat terpisah.
pakai: python klasifikasi_beda.py <bandingkan.json> <ringkasan-keluar.json> [basis-sesudah=aps_badilag_ps1]"""
import json
import re
import subprocess
import sys

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
hasil = json.load(open(sys.argv[1], encoding='utf-8'))
DB = sys.argv[3] if len(sys.argv) > 3 else 'aps_badilag_ps1'
ORANG_LAIN = {8890, 9280, 9281, 9290, 9291, 9292, 9293, 8172}


def kueri(db, sql):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '--default-character-set=latin1', db, '-e', sql], capture_output=True)
    return [l.split('\t') for l in r.stdout.decode('latin1').strip().replace('\r', '').split('\n') if l]


def himpunan(tabel):
    return {int(x[0]) for x in kueri('sipp_donggala',
            "SELECT perkara_id FROM %s GROUP BY perkara_id HAVING NOT (MIN(urutan)=1 AND MAX(urutan)=COUNT(*) AND COUNT(DISTINCT urutan)=COUNT(*))" % tabel)}


NR = {1: himpunan('perkara_pihak1'), 2: himpunan('perkara_pihak2')}

# teks kueri semua variabel (basis sesudah), untuk menelusuri tabel pihak yang dipakai variabel dan variabel yang dirujuknya
teks = {}
for baris in kueri(DB, "SELECT no_var, HEX(IFNULL(sql_query,'')), HEX(nama) FROM abt_variabel"):
    teks[int(baris[0])] = bytes.fromhex(baris[1]).decode('latin1') + ' ' + bytes.fromhex(baris[2]).decode('latin1')


def tutup(no, lihat=None):
    lihat = lihat if lihat is not None else set()
    if no in lihat or no not in teks:
        return lihat
    lihat.add(no)
    for r in re.findall(r'#(\d{3,5})#', teks[no]):
        tutup(int(r), lihat)
    return lihat


def tabel_dipakai(no):
    t = set()
    for n in tutup(no):
        s = teks.get(n, '')
        if 'perkara_pihak1' in s:
            t.add(1)
        if 'perkara_pihak2' in s:
            t.add(2)
    return t


ring, tak_dijelaskan = {}, {}
for no_s, beda in hasil['beda'].items():
    no = int(no_s)
    tb = tabel_dipakai(no)
    sebab = set()
    for t in tb:
        sebab |= NR[t]
    di_luar = [p for p in beda if p not in sebab]
    ring[no_s] = dict(beda=len(beda), tabel=sorted(tb), dijelaskan=len(beda) - len(di_luar), di_luar=len(di_luar), contoh_di_luar=di_luar[:8], perkara_lain=no in ORANG_LAIN)
    if di_luar and no not in ORANG_LAIN:
        tak_dijelaskan[no_s] = di_luar
    elif di_luar:
        tak_dijelaskan['lain:' + no_s] = di_luar
total_beda = sum(len(v) for v in hasil['beda'].values())
perkara_beda = set()
for v in hasil['beda'].values():
    perkara_beda |= set(v)
out = dict(total_perkara=hasil['total'], galat=len(hasil['galat']), variabel_berbeda={k: v['beda'] for k, v in ring.items() if v['beda']},
           perkara_dengan_selisih=len(perkara_beda), selisih_tanpa_sebab={k: v for k, v in tak_dijelaskan.items()},
           nonrapat_pihak1=len(NR[1]), nonrapat_pihak2=len(NR[2]), rincian=ring)
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('perkara dibandingkan:', hasil['total'], '| galat evaluasi:', len(hasil['galat']), '| variabel yang pernah berbeda:', sum(1 for v in ring.values() if v['beda']),
      '| perkara dengan selisih:', len(perkara_beda), '| pasangan (variabel, perkara) berbeda:', total_beda)
print('selisih TANPA sebab yang dirancang:', {k: len(v) for k, v in tak_dijelaskan.items()} or 'tidak ada')
