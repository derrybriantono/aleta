# -*- coding: utf-8 -*-
"""Pindai keluaran SEMUA variabel yang dipakai blangko Derry aktif lewat php56 ABT ASLI: satu RTF uji berisi tiap penanda di
paragrafnya sendiri ("@@NNNN@@ #NNNN#"), dirender untuk perkara sampel tiap jenis. Keluaran digolongkan:
  GALAT   = teks galat ("TIDAK BENAR", "QUERY", "ERROR", "Unknown column", "syntax", "Error Number")
  MENTAH  = penanda #NNNN# tertinggal di keluaran
  KOSONG  = keluaran kosong
pakai: python pindai_galat.py <pakai.json> <sampel.tsv: perkara_id TAB jenis TAB label> <keluar.json> [jenis_variabel,...]"""
import json, os, re, sys, time
SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'bas-tanya-jawab-29okt', 'sumber'))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'bas-tanya-jawab-29okt', 'alat'))
import render_uji as R  # noqa: E402
from rtf2txt import rtf_ke_teks  # noqa: E402

pakai = json.load(open(sys.argv[1], encoding='utf-8'))
sampel = [l.rstrip('\n').split('\t') for l in open(sys.argv[2], encoding='utf-8') if l.strip() and not l.startswith('#')]
kel = sys.argv[3]
jenis_v = set((sys.argv[4] if len(sys.argv) > 4 else 'data_sql,data_sipp,data_teks,data_tanggal,terbilang,tanggal_hari,tanggal_hijriah').split(','))
kode = sorted((k for k, v in pakai.items() if v['jenis'] in jenis_v), key=int)
B = chr(92)
rtf = ('{' + B + 'rtf1' + B + 'ansi' + B + 'ansicpg1252' + B + 'deff0{' + B + 'fonttbl{' + B + 'f0 Times New Roman;}}\n'
       + ''.join(B + 'pard @@%s@@ #%s#' % (k, k) + B + 'par\n' for k in kode) + B + 'pard @@AKHIR@@' + B + 'par}')
GALAT = re.compile(r'TIDAK BENAR|QUERY|ERROR|Unknown column|syntax|Error Number|A Database Error', re.I)
hasil = {k: dict(pemilik=pakai[k]['pemilik'], jenis=pakai[k]['jenis'], nama=pakai[k]['nama'][:80], blangko=pakai[k]['blangko'],
                 contoh_blangko=pakai[k]['contoh'], folder=pakai[k].get('folder', []), galat=[], mentah=[], kosong=[], terisi=[]) for k in kode}
for pid, jenis, label in sampel:
    t0 = time.time()
    out = R.render(rtf.encode('latin1'), pid, '')
    teks = rtf_ke_teks(out.decode('latin1'))
    bag = re.split(r'@@(\d{4,5}|AKHIR)@@', teks)
    nilai = {bag[i]: bag[i + 1] for i in range(1, len(bag) - 1, 2)}
    for k in kode:
        v = re.sub(r'\s+', ' ', nilai.get(k, '')).strip()
        rec = hasil[k]
        if GALAT.search(v):
            rec['galat'].append([pid, jenis, v[:160]])
        elif re.search(r'#\d{4,5}#', v):
            rec['mentah'].append([pid, jenis, re.findall(r'#\d{4,5}#', v)[:5]])
        elif v in ('', '...'):
            rec['kosong'].append([pid, jenis])
        else:
            rec['terisi'].append(pid)
    print(pid, jenis, 'variabel', len(kode), 'detik', round(time.time() - t0), flush=True)
    json.dump(hasil, open(kel, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)  # disimpan tiap perkara (proses boleh dihentikan)
json.dump(hasil, open(kel, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
g = [k for k, v in hasil.items() if v['galat']]
m = [k for k, v in hasil.items() if v['mentah']]
print('variabel dengan GALAT', len(g), 'MENTAH', len(m))
