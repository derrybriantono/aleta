# -*- coding: utf-8 -*-
"""render194.py <akar _blangko_abt> <label> - render SUNGGUHAN (renderer ABT php56 asli, controller CLI Uji_sela; alat
D:/Aplikasi/aleta/tmp/w180/alat/render180.py, salinan ABT aps_badilag_w180d/w180r + SIPP sipp_w180) blangko itsbat [01] dan [01f]
atas perkara itsbat laptop. Keluaran D:/Aplikasi/aleta/tmp/w194/render/<label>-<kasus>.rtf - memuat data perkara laptop:
TIDAK masuk repo, TIDAK dikirim keluar. Lalu hitung penanda mentah dan kata aplikasi."""
import re
import sys
import time

sys.path.insert(0, 'D:/Aplikasi/aleta/tmp/w180/alat')
import render180 as R  # noqa: E402

KELUAR = 'D:/Aplikasi/aleta/tmp/w194/render'
PERKARA = int(sys.argv[3]) if len(sys.argv) > 3 else 10041
KASUS = {
    'in01': (PERKARA, '2 Itsbat Nikah/[01] [Kabul] IN.rtf', 1),
    'in01f': (PERKARA, '2 Itsbat Nikah/[01f] [Kabul] IN Kabul (Hadir Tapi Lupa Prosesi Nikah).rtf', 1),
}
akar, label = sys.argv[1], sys.argv[2]
t = time.time()
R.render(akar, label, list(KASUS), KELUAR, KASUS)
print('waktu %.1f dtk' % (time.time() - t))
for k in KASUS:
    s = open('%s/%s-%s.rtf' % (KELUAR, label, k), 'rb').read().decode('latin1')
    mentah = sorted(set(re.findall(r'#\d{4,5}#', s)))
    print(k, 'bita', len(s), 'mentah', mentah or 0, 'aleta', 'ADA' if re.search('aleta', s, re.I) else 0)
