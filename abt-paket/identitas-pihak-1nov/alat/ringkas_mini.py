# -*- coding: utf-8 -*-
"""ringkas_mini.py <label> : baca render-mini/<label>-*.rtf -> json {kasus: [teks paragraf identitas]} (tebal ditandai ** ), simpan render-mini/<label>.json"""
import sys, re, os, json, glob
sys.path.insert(0, 'D:/aleta-dev/wt/w177/abt-paket/tanya-jawab-format-1nov/sumber')
from rtf2txt import rtf_ke_teks
BS = chr(92)
label = sys.argv[1]
D = 'D:/Aplikasi/aleta/tmp/w177/render-mini/'
hasil = {}
for f in sorted(glob.glob(D + label + '-*.rtf')):
    kasus = os.path.basename(f)[len(label) + 1:-4]
    b = open(f, 'rb').read().decode('latin1')
    pos = [m.start() for m in re.finditer(re.escape(BS + 'pard'), b)]
    out = []
    for i, p in enumerate(pos):
        seg = b[p:(pos[i + 1] if i + 1 < len(pos) else len(b))]
        e = seg.find('{')
        ppr = seg[:e]
        kode = ' '.join(re.findall(r'\\(?:q[jlcr]|fi-?\d+|li-?\d+)(?![a-z0-9])', ppr))
        t = re.sub(r'\\b1(?![0-9a-z])', '**', seg)
        t = re.sub(r'\\b0(?![0-9a-z])', '**', t)
        teks = re.sub(r'\s+', ' ', rtf_ke_teks(t).strip().replace('\n', ' '))
        if teks:
            out.append((kode, teks))
    hasil[kasus] = out
json.dump(hasil, open(D + label + '.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(label, len(hasil), 'kasus')
