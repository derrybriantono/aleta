"""Analisa blok saksi seluruh pohon. Pakai: python analisa_blok.py <akar derry_briantono> <keluar.tsv>"""
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sumber'))
from saksi_blok import kenali
def panjang(p):
    p = os.path.abspath(p); a = chr(92)*2+'?'+chr(92)
    return p if (os.name != 'nt' or p.startswith(a)) else a + p.replace('/', chr(92))
akar = panjang(sys.argv[1]); out = []
for dp, dn, fn in os.walk(akar):
    rel = os.path.relpath(dp, akar).replace(chr(92), '/')
    if rel.startswith(('ALUR', '- BAS', 'terhapus', 'BAS ')): continue
    for f in sorted(fn):
        if not f.lower().endswith('.rtf'): continue
        d = open(os.path.join(dp, f), 'rb').read().decode('latin1')
        bas = rel.endswith('- BAS')
        u, T, bl = kenali(d, bas)
        for b in bl:
            contoh = ' | '.join(T[i][:60] for i in range(b['mulai'], min(b['akhir'], b['mulai'] + 3))) if b.get('mulai') is not None and b.get('akhir') else ''
            out.append([rel, f, b['jenis'], b['saksi'], b['keadaan'], str((b.get('akhir') or 0) - (b.get('mulai') or 0)), ','.join(b.get('isi', [])), b.get('sesudah', ''), contoh])
with open(sys.argv[2], 'w', encoding='utf-8') as o:
    for r in out: o.write('\t'.join(x.replace('\t', ' ') for x in r) + '\n')
print(len(out), 'blok')
