# -*- coding: utf-8 -*-
import sys, re, collections
sys.path.insert(0, 'D:/Aplikasi/aleta/tmp/w206/alat')
from kon import *

# aturan pemutus: #8555# + kata kerja pertimbangan/pendapat/putusan -> #8554#
SESUDAH = re.compile(r'^(?:tetap |juga |tidak |sudah |telah dapat |perlu |akan |dapat )?(?:membebani|membebankan|berpendapat|menilai|memberi pertimbangan|mengemukakan|mempertimbangkan|berkesimpulan|menjatuhkan|menolak|mengabulkan|menetapkan|memutuskan|menyatakan|sampai pada|telah menolak|telah mempertimbangkan|dapat mempertimbangkan)')
SEBELUM = re.compile(r'(?:pendapat|menurut|agar|dipertimbangkan oleh|diambil alih sebagai pendapat) $')
KEEP = re.compile(r'^(?:telah |sudah )?(?:menasehati|menasihati|berusaha|memerintahkan|memeriksa|memulai pemeriksaan|mengingatkan|memberikan kesempatan|memberi nasihat|memberi kesempatan|mendamaikan|menyarankan|memanggil)')
if __name__ == '__main__':
    tot = collections.Counter()
    sisa = collections.Counter()
    for rel in semua():
        b, t, pos = teks(D + rel)
        for m in re.finditer('#8555#', t):
            s = t[m.end() + 1:m.end() + 60]
            p = t[max(0, m.start() - 40):m.start()]
            if SESUDAH.match(s) or SEBELUM.search(p):
                tot[rel] += 1
            elif KEEP.match(s):
                pass
            else:
                sisa[(s[:40].replace('\n', '/'), p[-25:].replace('\n', '/'))] += 1
    print('berkas pemutus:', len(tot), 'kali', sum(tot.values()))
    for r, n in tot.most_common(40):
        print(n, r)
    print('--- tak terklasifikasi')
    for k, n in sisa.most_common(60):
        print(n, k)
