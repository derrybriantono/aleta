# -*- coding: utf-8 -*-
"""Render SEBELUM/SESUDAH blangko utuh dengan renderer php56 ABT asli (render.py) dan bandingkan per baris.
sebelum = RTF dasar (salinan server 26 Okt + paket sesudahnya) atas aps_badilag_2810; sesudah = RTF tertimpa paket atas aps_badilag_pp29.
Teks lengkap (memuat data perkara) ke D:/Aplikasi/aleta/tmp/pp29/render (TIDAK masuk repo); ringkasan hitungan ke ../hasil/render-ringkasan.json.
pakai: python render_banding.py <relatif berkas di derry_briantono> <pid>[,<pid>...]  (bisa diulang: berkas::pid,pid berkas::pid ...)"""
import difflib
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render  # noqa: E402

DASAR = r'D:\Aplikasi\aleta\tmp\w82\rtf\derry_briantono'
TIMPA = r'D:\Aplikasi\aleta\tmp\pp29\blangko\derry_briantono'   # pohon uji yang sudah dipasang paket
OUT = r'D:\Aplikasi\aleta\tmp\pp29\render'
HASIL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'hasil', 'render-ringkasan.json')
sys.stdout.reconfigure(encoding='utf-8')
os.makedirs(OUT, exist_ok=True)
tugas = []
for a in sys.argv[1:]:
    b, _, p = a.partition('::')
    tugas += [(b, x) for x in p.split(',')]
teks = {}
for sisi, src, akar in (('sebelum', 'aps_badilag_2810', DASAR), ('sesudah', 'aps_badilag_pp29', TIMPA)):
    render.siapkan(src)
    for b, pid in tugas:
        t = render.render(os.path.join(akar, b), pid)
        teks[(sisi, b, pid)] = t
        io.open(os.path.join(OUT, '%s-%s-%s.txt' % (sisi, pid, abs(hash(b)) % 10000)), 'w', encoding='utf-8').write(t)
ring = json.load(io.open(HASIL, encoding='utf-8')) if os.path.exists(HASIL) else {}
for b, pid in tugas:
    a, c = teks[('sebelum', b, pid)], teks[('sesudah', b, pid)]
    la, lc = a.split('\n'), c.split('\n')
    beda = [x for x in difflib.unified_diff(la, lc, lineterm='', n=0) if x[:1] in '+-' and not x.startswith(('+++', '---'))]
    galat = ('GALAT RENDER' in a) or ('GALAT RENDER' in c) or ('ERROR Variabel' in a) or ('ERROR Variabel' in c)
    ring['%s | %s' % (b, pid)] = {'baris_sebelum': len(la), 'baris_sesudah': len(lc), 'baris_beda': len(beda), 'galat': galat}
    print('=== %s | perkara %s | baris beda %d | galat %s' % (b, pid, len(beda), galat))
    for x in beda[:14]:
        print('   ' + x[:330])
json.dump(ring, io.open(HASIL, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
