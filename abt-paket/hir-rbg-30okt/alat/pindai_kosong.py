# -*- coding: utf-8 -*-
"""6.3 - pindai keluaran SEMUA variabel data_sql yang dipakai blangko Derry aktif atas sampel perkara LUAS lewat php56 ABT asli.

Satu RTF uji per (perkara, sidang) memuat tiap penanda di paragrafnya sendiri ("@@NNNN@@ #NNNN#"). Hasil per variabel: berapa sampel
terisi / kosong / galat. Pola alat variabel-galat-30okt/pindai_galat.py, renderer salinan G6 (alat/render_g6.py).
pakai: python pindai_kosong.py <pakai.json dari variabel-galat-30okt/alat/kumpul_pakai.py> <sampel.tsv: perkara_id TAB sidang TAB label> <keluar.json>
"""
import json
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
import render_g6 as R  # noqa: E402

TMP = r'D:\Aplikasi\aleta\tmp\g6\pindai-kosong'


def main():
    pakai = json.load(open(sys.argv[1], encoding='utf-8'))
    sampel = [l.rstrip('\n').split('\t') for l in open(sys.argv[2], encoding='utf-8') if l.strip() and not l.startswith('#')]
    kel = sys.argv[3]
    kode = sorted((k for k, v in pakai.items() if v['jenis'] == 'data_sql'), key=int)
    B = chr(92)
    rtf = ('{' + B + 'rtf1' + B + 'ansi' + B + 'ansicpg1252' + B + 'deff0{' + B + 'fonttbl{' + B + 'f0 Times New Roman;}}\n'
           + ''.join(B + 'pard @@%s@@ #%s#' % (k, k) + B + 'par\n' for k in kode) + B + 'pard @@AKHIR@@' + B + 'par}')
    os.makedirs(TMP, exist_ok=True)
    sumber = os.path.join(TMP, '_semua_penanda.rtf')
    if not os.path.exists(sumber) or open(sumber, 'rb').read() != rtf.encode('latin1'):
        open(sumber, 'wb').write(rtf.encode('latin1'))
    tugas = [(sumber, pid, sd, os.path.join(TMP, 'k_%s_%s.txt' % (pid, sd or '0'))) for pid, sd, _ in sampel]
    # bagian i/n (proses paralel): hanya merender bagian sendiri; hasil yang sudah ada tidak dirender ulang
    bagian = os.environ.get('BAGIAN', '')
    if bagian:
        i, n = (int(x) for x in bagian.split('/'))
        belum = [t for k, t in enumerate(tugas) if k % n == i and not os.path.exists(t[3])]
        print('render bagian', bagian, len(belum), flush=True)
        R.render_banyak(belum, potong=1)
        return
    hasil_r = {t[3]: 'OK' for t in tugas if os.path.exists(t[3])}
    hasil_r.update(R.render_banyak([t for t in tugas if t[3] not in hasil_r], potong=1))
    GALAT = re.compile(r'TIDAK BENAR|QUERY|ERROR|Unknown column|syntax|Error Number|A Database Error', re.I)
    h = {k: dict(nama=pakai[k]['nama'][:120], blangko=pakai[k]['blangko'], folder=pakai[k].get('folder', [])[:6], terisi=[], kosong=[], galat=[], mentah=[]) for k in kode}
    gagal = []
    for (rtf_, pid, sd, keluar), (_, _, label) in zip(tugas, sampel):
        if hasil_r.get(keluar) != 'OK':
            gagal.append([pid, sd, hasil_r.get(keluar, '')[:300]])
            continue
        teks = open(keluar, encoding='utf-8').read()
        bag = re.split(r'@@(\d{4,5}|AKHIR)@@', teks)
        nilai = {bag[i]: bag[i + 1] for i in range(1, len(bag) - 1, 2)}
        for k in kode:
            v = re.sub(r'\s+', ' ', nilai.get(k, '')).strip()
            if GALAT.search(v):
                h[k]['galat'].append([pid, label, v[:160]])
            elif re.search(r'#\d{4,5}#', v):
                h[k]['mentah'].append([pid, label])
            elif v in ('', '...'):
                h[k]['kosong'].append([pid, label])
            else:
                mentah = nilai.get(k, '')
                # hasil diawali baris baru (<br> di kueri) = paragraf sendiri di cetakan
                h[k]['terisi'].append([pid, label, v[:100], 1 if re.match(r'[ \t]*\n', mentah) else 0])
    json.dump(dict(sampel=sampel, gagal=gagal, variabel=h), open(kel, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=0)
    selalu = [k for k in kode if not h[k]['terisi'] and not h[k]['galat']]
    print('sampel', len(sampel), 'gagal render', len(gagal), '| variabel data_sql', len(kode), '| selalu kosong', len(selalu),
          '| galat', sum(1 for k in kode if h[k]['galat']))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
