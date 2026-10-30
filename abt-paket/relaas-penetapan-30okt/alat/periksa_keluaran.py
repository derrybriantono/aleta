# -*- coding: utf-8 -*-
"""Pindai keluaran render (teks tampak) seperti pembaca: sisa penanda, kosong, ganda, tanda baca, satker mati, kata Aleta.
pakai: python periksa_keluaran.py <folder render> [keluar.json]"""
import collections
import glob
import json
import os
import re
import sys

POLA = [
    ('sisa_penanda', re.compile(r'#\d{4,5}#')),
    ('data_tidak_ada', re.compile(r'DATA_TIDAK_ADA|TIDAK_BISA_LOAD|ERROR Variabel|CODE MASIH ADA YANG SALAH')),
    ('koma_sendiri', re.compile(r'(?m)^\s*[,;.]\s*$')),
    ('koma_ganda', re.compile(r',[ \t]*,|;[ \t]*;|[,;][ \t]*\.(?![.…])')),
    ('isian_kosong', re.compile(r'\b(pendidikan|pekerjaan|agama|NIK|umur|lahir)[ \t]*[,;]')),
    ('spasi_sebelum_tanda', re.compile(r'\w[ \t]+[,;](?!\d)')),
    ('tanpa_spasi_sesudah_tanda', re.compile(r'[a-z][,;][A-Za-z]')),
    ('kurung_kosong', re.compile(r'\(\s*(rupiah)?\s*\)')),
    ('rupiah_kosong', re.compile(r'Rp\s*[.,]*\s*,00|Rp\s*\.\.\.')),
    ('umur_janggal', re.compile(r'umur\s+(20\d\d|0|-\d+)\s+tahun')),
    ('kata_ganda', re.compile(r'\b(\w{3,})[ \t]+\1\b', re.I)),
    ('tanggal_kosong', re.compile(r'[Tt]anggal[ \t]*[,;]|tanggal[ \t]+(?:dan|yang)\b')),
    ('satker_mati', re.compile(r'(?i)bungku|morowali')),
    ('aleta', re.compile(r'(?i)aleta')),
    ('nama_kosong', re.compile(r'(?m)^\s*,\s*(NIK|umur|sebagai|beralamat)')),
    ('di_kosong', re.compile(r'(tempat kediaman di|bertempat tinggal di|beralamat di)\s*[,;.]')),
    ('huruf_menempel', re.compile(r'\d{4}(yang|dan|sebagai)\b')),
]


def main():
    akar = sys.argv[1]
    hasil = collections.defaultdict(list)
    for f in sorted(glob.glob(os.path.join(akar, '**', '*.txt'), recursive=True)):
        t = open(f, encoding='utf-8').read()
        rel = os.path.relpath(f, akar).replace('\\', '/')
        for nama, p in POLA:
            for m in p.finditer(t):
                a = max(0, m.start() - 60)
                hasil[rel].append((nama, t[a:m.end() + 40].replace('\n', ' | ')))
    if len(sys.argv) > 2:
        json.dump(hasil, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    hit = collections.Counter(n for v in hasil.values() for n, _ in v)
    print('berkas ditandai:', len(hasil), dict(hit))
    for k, v in hasil.items():
        for n, c in v:
            print('%-80s %-24s %s' % (k[:80], n, c[:160]))


main()
