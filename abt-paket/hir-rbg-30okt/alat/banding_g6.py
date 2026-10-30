# -*- coding: utf-8 -*-
"""Render ABT ASLI sebelum/sesudah paket hir-rbg-30okt (dan titik-koma-teks-30okt) lalu bandingkan (G6).

pakai:
  python banding_g6.py tugas <paket-satker> <sampel.tsv> <keluar tugas.tsv> [maks]
      pilih blangko yang diganti paket sehingga SETIAP variabel padanan baru dipakai minimal sekali (+ blangko tersering per folder),
      perkara menurut jenis folder (sampel.tsv: perkara_id TAB sidang TAB label).
  python banding_g6.py render <tugas.tsv> <akar _blangko_abt> <folder keluar>
  python banding_g6.py banding <folder sebelum> <folder sesudah> <keluar ringkas.json>
      RTF hasil dibandingkan byte demi byte (CR/LF berkas tidak bermakna di RTF dan dibuang ABT sendiri).
"""
import collections
import difflib
import json
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)

JENIS = [  # awalan folder -> kata label sampel
    (r'^1 Perceraian CG|^1c |^1d |^1e |^1f |^97', 'CG putus'), (r'^1a ', 'CT putus'), (r'^2', 'Itsbat'), (r'^3 ', 'DK'),
    (r'^3a|^5', 'Poligami'), (r'^4a', 'HB'), (r'^4b|^4c|^4d|^4e', 'Waris'), (r'^6', 'Perwalian'), (r'^7', 'Wali adhol'),
    (r'^8', 'Asal usul'), (r'^9 ', 'P3HP'), (r'^10', 'ES'), (r'^9[5-9]', 'CG putus'),
]


def panjang(p):
    p = os.path.abspath(p)
    a = chr(92) * 2 + '?' + chr(92)
    return p if p.startswith(a) else a + p


def pilih_perkara(folder, sampel):
    f = folder.split('/', 1)[-1]
    for pola, kata in JENIS:
        if re.match(pola, f):
            for pid, sd, label in sampel:
                if kata in label:
                    return pid, sd
    return sampel[0][0], sampel[0][1]


def tugas(paket, sampel_tsv, keluar, maks=60):
    sampel = [l.rstrip('\n').split('\t') for l in open(sampel_tsv, encoding='utf-8') if l.strip()]
    sampel = [(a, b, c) for a, b, c in sampel]
    daftar = [l.rstrip('\n').split('\t') for l in open(os.path.join(paket, 'daftar-timpa.tsv'), encoding='utf-8') if not l.startswith('#')]
    belum = set()
    isi = {}
    for d, f, *_ in daftar:
        raw = open(panjang(os.path.join(paket, 'timpa', d, f)), 'rb').read().decode('latin1')
        isi[(d, f)] = set(re.findall(r'#(118[5-9]\d)#', raw))
        belum |= isi[(d, f)]
    pilih = []
    # rakus: blangko yang menutup variabel terbanyak yang belum tertutup
    while belum:
        terbaik = max(isi, key=lambda k: (len(isi[k] & belum), -len(k[1])))
        if not isi[terbaik] & belum:
            break
        pilih.append(terbaik)
        belum -= isi[terbaik]
    # + satu blangko per folder
    sudah_folder = {d for d, _ in pilih}
    for d, f, *_ in daftar:
        if d not in sudah_folder and len(pilih) < maks:
            pilih.append((d, f))
            sudah_folder.add(d)
    with open(keluar, 'w', encoding='utf-8', newline='\n') as o:
        for d, f in pilih:
            pid, sd = pilih_perkara(d, sampel)
            o.write('%s/%s\t%s\t%s\n' % (d, f, pid, sd))
    print('tugas', len(pilih), 'variabel tak tertutup', sorted(belum))


def render(tugas_tsv, akar, keluar):
    import render_g6 as R
    t = [l.rstrip('\n').split('\t') for l in open(tugas_tsv, encoding='utf-8') if l.strip()]
    kerja = []
    for i, (rel, pid, sd) in enumerate(t):
        kerja.append((os.path.join(akar, rel), pid, sd, os.path.join(keluar, '%03d_%s.txt' % (i, pid))))
    h = R.render_banyak(kerja)
    json.dump({k: v[:200] for k, v in h.items()}, open(os.path.join(keluar, '_hasil.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('render', len(h), 'OK', sum(1 for v in h.values() if v == 'OK'))


def banding(a, b, keluar):
    hasil = []
    for f in sorted(os.listdir(a)):
        if not f.endswith('.txt.rtf'):
            continue
        x = open(os.path.join(a, f), 'rb').read().replace(b'\r', b'').replace(b'\n', b'')
        pb = os.path.join(b, f)
        if not os.path.exists(pb):
            hasil.append(dict(berkas=f, sama=False, sebab='tidak ada sesudah'))
            continue
        y = open(pb, 'rb').read().replace(b'\r', b'').replace(b'\n', b'')
        if x == y:
            hasil.append(dict(berkas=f, sama=True))
            continue
        ta = open(os.path.join(a, f[:-4]), encoding='utf-8').read().split('\n')
        tb = open(os.path.join(b, f[:-4]), encoding='utf-8').read().split('\n')
        beda = [l for l in difflib.unified_diff(ta, tb, lineterm='', n=0) if l[:1] in '+-' and not l.startswith(('+++', '---'))]
        hasil.append(dict(berkas=f, sama=False, beda=beda[:12], jumlah_baris_beda=len(beda)))
    json.dump(hasil, open(keluar, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('dibandingkan', len(hasil), 'sama persis', sum(1 for h in hasil if h['sama']), 'beda', sum(1 for h in hasil if not h['sama']))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    a = sys.argv[1]
    if a == 'tugas':
        tugas(sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5]) if len(sys.argv) > 5 else 60)
    elif a == 'render':
        render(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        banding(sys.argv[2], sys.argv[3], sys.argv[4])
