# -*- coding: utf-8 -*-
"""Pindai pohon sesudah paket (pickle teks tampak {rel: teks}) -> hasil/pindai-sesudah.txt.
pakai: python pindai_sesudah.py <sebelum.pkl> <sesudah.pkl> <hasil.txt>"""
import pickle, re, sys, os

SINI = os.path.dirname(os.path.abspath(__file__))
A = pickle.load(open(sys.argv[1], 'rb'))
B = pickle.load(open(sys.argv[2], 'rb'))
v03 = [l.strip() for l in open(os.path.join(SINI, 'daftar-v03.txt'), encoding='utf-8') if l.strip() and not l.startswith('#')]
v03 = ['derry_briantono/' + x for x in v03]
k10 = ['1 Perceraian CG/[01a] [Kabul Verstek] Cerai - Alasan E (Qabla Ad Dukhul).rtf', '1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti.rtf',
       '1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Unus Testis Nullus Testis.rtf', '1a Perceraian CT/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti.rtf']
k10 = ['derry_briantono/' + x for x in k10]
out = []


def hit(nama, rx, daftar_a, daftar_b, jumlah_harap=None):
    ra = re.compile(rx)
    n0 = sum(len(ra.findall(A[k])) for k in daftar_a)
    n1 = sum(len(ra.findall(B[k])) for k in daftar_b)
    out.append('%s\tsebelum %d\tsesudah %d' % (nama, n0, n1))
    return n0, n1


hit('A11 #0690# di 106 berkas', r'#0690#', v03, v03)
hit('A11 #4004# di 106 berkas', r'#4004#', v03, v03)
hit('A6 "#8555# <pemutus>" di 4 putusan', r'#8555# (?:tetap |telah dapat |perlu |akan )?(?:membebani|berpendapat|menilai|berkesimpulan|memberi pertimbangan|menolak)|pendapat #8555#|menurut #8555#|agar #8555#', k10, k10)
hit('A6 #8555# tersisa (memimpin sidang) di 4 putusan', r'#8555#', k10, k10)
hit('A3 "apabila tau" di seluruh pohon', r'apabila tau', list(A), list(B))
hit('E2 "untuk mendapatkan Buku Nikah" seluruh pohon', r'untuk mendapatkan Buku Nikah', list(A), list(B))
hit('E2 "adalah untuk #8171#" seluruh pohon', r'tujuan[^\n]{0,40}itsbat nikah adalah untuk #8171#', list(A), list(B))
hit('A13 "c/q Majelis #8554#" seluruh pohon', r'c/q Majelis #8554#', list(A), list(B))
hit('A13 "fijtelijkeground" (harus tetap 3)', r'fijtelijkeground', list(A), list(B))
hit('A13 isteri seluruh pohon (sisa = kutipan)', r'[Ii]steri', list(A), list(B))
hit('[98] Cabut "dikabulkan #8555# maka" (sengaja tetap)', r'dikabulkan #8555# maka', list(A), list(B))
tidak_v03 = [k for k in A if k not in v03]
hit('BAS/arsip: #0690# di luar 106 berkas (harus sama)', r'#0690#', tidak_v03, tidak_v03)
hit('BAS/arsip: #4004# di luar 106 berkas (harus sama)', r'#4004#', tidak_v03, tidak_v03)
open(sys.argv[3], 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
print('\n'.join(out))
