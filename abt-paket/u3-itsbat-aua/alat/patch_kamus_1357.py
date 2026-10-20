# -*- coding: utf-8 -*-
"""Menambah alasan wali (1357) pada pola kamus itsbat: ayah berada jauh/di luar daerah/sakit/uzur/hilang (contoh nyata 73/Pdt.P/2026).
Perubahan teks mentah JSON (format berkas tetap)."""
import json, sys

P = r'D:\aleta-dev\wt\u3-itsbat-aua\aleta_bot\kamus-deteksi\awal\itsbat.json'
t = open(P, encoding='utf-8').read()
LAMA = r'|tidak\\s+(?:diketahui|ada|beragama\\s+islam))(?:(?!'
BARU = (r'|tidak\\s+(?:diketahui|ada|beragama\\s+islam)|berada\\s+jauh|(?:berada|tinggal|bekerja)\\s+di\\s+luar\\s+(?:daerah|kota|negeri|pulau)'
        r'|sakit(?:\\s+keras)?|lumpuh|sudah\\s+uzur|hilang|gaib)(?:(?!')
if BARU in t:
    print('sudah dipasang')
    sys.exit(0)
assert t.count(LAMA) == 1, t.count(LAMA)
t = t.replace(LAMA, BARU)
# contoh benar tambahan
CB = '"wali nikah yaitu Ludin (Paman Pemohon II karena Ayah dari Pemohon II telah meninggal dunia) dan yang menikahkan adalah Makin"'
assert t.count(CB) == 1
t = t.replace(CB, CB + ',\n      "wali nikah yaitu Hasan (Paman kandung Pemohon II karena ayah kandung Pemohon II berada jauh sehingga menyerahkannya kepada Paman Pemohon II) dan yang menikahkan adalah Hasan (Paman kandung Pemohon II)"')
json.loads(t)
open(P, 'w', encoding='utf-8', newline='').write(t)
print('dipasang')
