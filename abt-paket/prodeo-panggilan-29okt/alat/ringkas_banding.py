# -*- coding: utf-8 -*-
"""Tulis hasil/banding-ringkasan.json (HANYA hitungan) dari keluaran banding.js (D:/Aplikasi/aleta/tmp/pp29/banding)."""
import collections
import io
import json
import os
import re

B = r'D:\Aplikasi\aleta\tmp\pp29\banding'
d = json.load(io.open(os.path.join(B, 'banding-rinci.json'), encoding='utf-8'))
R = json.load(io.open(os.path.join(B, 'ringkas.json'), encoding='utf-8'))
TGL = r'\d{2} [A-Z][a-z]+ \d{4}'


def n(b):
    return 0 if b.endswith('...') else len(re.findall(TGL, b))


st = collections.Counter()
ganda = 0
for h in d.values():
    if not h['putus']:
        continue
    a, b = h['tglT']
    st[min(n(b), 5)] += 1
    m = re.match(r'tanggal (.*) dan tanggal (.*)$', a)
    if m and m.group(1) and m.group(1) == m.group(2):
        ganda += 1
ring = {
    'perkara_diperiksa': R['perkara'], 'galat_lama': R['galat_lama'], 'galat_baru': R['galat_baru'], 'potongan': R['potongan'],
    'panggilan_T_putus_2025_2026': {'jumlah_tanggal': {str(k): v for k, v in sorted(st.items())}, 'lama_tanggal_ganda_sama': ganda},
    'catatan': ('beda bukan prodeo yang disengaja: 399 = #8504# kini tercetak utuh (ABT dulu "Rp290,00" untuk 290.000); '
                '467 = ikrar biaya 0 tanpa "sejumlah Rp0,00 ( rupiah)" dan rincian (nihil); varian11152 semua = bunyi amar ikrar keputusan 30 Okt; '
                '1 = perkara 9321 (galat lama #5223#, verzet kini otomatis)'),
}
json.dump(ring, io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'hasil', 'banding-ringkasan.json'), 'w', encoding='utf-8'),
          indent=1, ensure_ascii=False)
print(json.dumps(ring['panggilan_T_putus_2025_2026']))
