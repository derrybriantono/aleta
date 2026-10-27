# -*- coding: utf-8 -*-
"""Klasifikasi selisih hasil bandingkan.js: tiap perkara yang keluarannya BERUBAH harus punya sebab yang dirancang
(urutan pihak tidak rapat dari 1, lebih dari 10 pihak -> romawi, ada Turut Tergugat / pihak intervensi). Selisih tanpa sebab = galat paket.
pakai: python klasifikasi_beda.py <bandingkan.json> [ringkasan-keluar.json]"""
import json
import subprocess
import sys

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
hasil = json.load(open(sys.argv[1], encoding='utf-8'))


def kueri(sql):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', 'sipp_donggala', '-e', sql], capture_output=True)
    return [l.split('\t') for l in r.stdout.decode('utf-8', 'replace').strip().replace('\r', '').split('\n') if l]


def himpunan(tabel, syarat):
    return {int(x[0]) for x in kueri(
        "SELECT perkara_id FROM %s GROUP BY perkara_id HAVING %s" % (tabel, syarat))}


NONRAPAT = "NOT (MIN(urutan)=1 AND MAX(urutan)=COUNT(*) AND COUNT(DISTINCT urutan)=COUNT(*))"
np1, np2 = himpunan('perkara_pihak1', NONRAPAT), himpunan('perkara_pihak2', NONRAPAT)
b1, b2 = himpunan('perkara_pihak1', 'COUNT(*)>10'), himpunan('perkara_pihak2', 'COUNT(*)>10')
turut = himpunan('perkara_pihak4', 'COUNT(*)>0')
interv = himpunan('perkara_pihak3', 'COUNT(*)>0')
# turut rapat >1 saja tidak mengubah apa pun pada 8710; yang berubah di kaki (7152, 8516) adalah semua perkara ber-Turut
dijelaskan = {
    '7047': np1, '7097': np1, '7036': np1, '3507': np1 | b1, '3511': np1 | b1, '3513': np1, '3515': np1,
    '7048': np2, '7098': np2, '7037': np2, '3509': np2 | b2, '3512': np2 | b2, '3514': np2, '3516': np2,
    '7148': np1 | b1, '7151': np1 | b1,
    '7149': np2 | b2,
    '7152': np2 | b2 | turut,
    '8516': np1 | np2 | b1 | b2 | turut | interv,
    '8710': set(), '7054': set(), '7055': set(),
}
ring = {}
tak_dijelaskan = {}
for no, beda in hasil['beda'].items():
    beda = set(beda)
    sebab = dijelaskan.get(no, set())
    tak = sorted(beda - sebab)
    ring[no] = dict(sama=hasil['sama'][no], beda=len(beda), dijelaskan=len(beda & sebab), tak_dijelaskan=tak,
                    sebab_np1=len(beda & np1), sebab_np2=len(beda & np2), sebab_lebih10=len((beda & (b1 | b2))), sebab_turut=len(beda & turut))
    if tak:
        tak_dijelaskan[no] = tak
print(json.dumps(ring, indent=1))
print('TAK DIJELASKAN:', tak_dijelaskan or 'tidak ada')
print('himpunan: nonrapat P=%d T=%d; >10 pihak P=%d T=%d; ber-Turut=%d; ber-intervensi=%d' % (len(np1), len(np2), len(b1), len(b2), len(turut), len(interv)))
if len(sys.argv) > 2:
    json.dump(dict(ring=ring, total=hasil['total'], galat=len(hasil['galat']), himpunan=dict(nonrapat_P=len(np1), nonrapat_T=len(np2), lebih10_P=len(b1), lebih10_T=len(b2), turut=len(turut), interv=len(interv))),
              open(sys.argv[2], 'w', encoding='utf-8'), indent=1)
