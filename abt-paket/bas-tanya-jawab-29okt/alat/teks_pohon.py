"""Tulis teks polos tiap RTF pohon ke folder keluaran (folder/berkas.txt). Pakai: python teks_pohon.py <akar> <keluar>"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtf2txt import rtf_ke_teks
akar, kel = sys.argv[1], sys.argv[2]
n = 0
for dp, dn, fn in os.walk(akar):
    for f in fn:
        if not f.lower().endswith('.rtf'):
            continue
        rel = os.path.relpath(dp, akar)
        if rel.startswith(('ALUR', '- BAS', 'terhapus', 'BAS ')):
            continue
        os.makedirs(os.path.join(kel, rel), exist_ok=True)
        t = rtf_ke_teks(open(os.path.join(dp, f), 'rb').read().decode('latin1'))
        open(os.path.join(kel, rel, f[:-4] + '.txt'), 'w', encoding='utf-8').write(t)
        n += 1
print(n, 'teks')
