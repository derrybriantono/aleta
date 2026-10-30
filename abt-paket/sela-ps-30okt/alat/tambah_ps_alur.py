# -*- coding: utf-8 -*-
"""Tambah langkah "PS" (BAS pemeriksaan setempat paket sela-ps-30okt) ke ALUR 42 wasiat, 43 ES acara biasa, 47 hibah, 48 wakaf
di manajemen_surat/src/lib/alur-bas-baru-data.ts. Aman diulang (alur yang sudah punya PS dilewati)."""
import io
import re
import sys

P = sys.argv[1]
BERKAS = {
    'alur-42': 'BAS ALUR 42 Wasiat - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8]).rtf',
    'alur-43': 'BAS ALUR 43 ES Acara Biasa - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8]).rtf',
    'alur-47': 'BAS ALUR 47 Hibah - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8]).rtf',
    'alur-48': 'BAS ALUR 48 Wakaf - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8]).rtf',
}
s = io.open(P, encoding='utf-8').read()
n = 0
for idalur, berkas in BERKAS.items():
    a = s.index('"id": "%s"' % idalur)
    l = s.index('"langkah": [', a)
    tutup = s.index('\n    ]\n  }', l)   # penutup array langkah alur ini
    blok = s[l:tutup]
    if '"kode": "PS"' in blok:
        continue
    sisip = (',\n      {\n        "kode": "PS",\n        "berkas": "%s",\n'
             '        "keterangan": "Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8])"\n      }') % berkas
    assert s[tutup - 7:tutup].strip().endswith('}'), s[tutup - 40:tutup]
    s = s[:tutup] + sisip + s[tutup:]
    n += 1
io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('ditambah', n)
