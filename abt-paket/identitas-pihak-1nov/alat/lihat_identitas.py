# -*- coding: utf-8 -*-
"""lihat_identitas.py <rtf keluaran> [n=6]: tampilkan n paragraf pertama sesudah 'antara' dengan properti dan teks (tebal ditandai **)."""
import sys, re
sys.path.insert(0, 'D:/aleta-dev/wt/w177/abt-paket/tanya-jawab-format-1nov/sumber')
b = open(sys.argv[1], 'rb').read().decode('latin1')
n = int(sys.argv[2]) if len(sys.argv) > 2 else 6
BS = chr(92)
pos = [m.start() for m in re.finditer(re.escape(BS + 'pard'), b)]
mulai = None
for i, p in enumerate(pos):
    seg = b[p:(pos[i + 1] if i + 1 < len(pos) else len(b))]
    if 'NIK' in seg:
        mulai = i
        break
if mulai is None:
    print('tidak ada NIK'); sys.exit()
from rtf2txt import rtf_ke_teks
for i in range(max(0, mulai - 1), min(len(pos), mulai + n)):
    p = pos[i]
    seg = b[p:(pos[i + 1] if i + 1 < len(pos) else len(b))]
    e = seg.find('{')
    ppr = seg[:e]
    kode = ' '.join(re.findall(r'\\(?:q[jlcr]|fi-?\d+|li-?\d+|lin-?\d+)(?![a-z0-9])', ppr))
    # tandai tebal
    t = seg
    t = re.sub(r'\\b1(?![0-9a-z])', '**', t)
    t = re.sub(r'\\b0(?![0-9a-z])', '**', t)
    teks = rtf_ke_teks(t).strip().replace('\n', ' / ')
    print(i, kode, '|', teks[:700])
