# -*- coding: utf-8 -*-
"""potong_rtf.py <rtf masuk> <rtf keluar> [n paragraf sesudah NIK terakhir=3]: simpan kepala + paragraf 0..(paragraf identitas terakhir + n) saja agar Word cepat."""
import re, sys
BS = chr(92)
b = open(sys.argv[1], 'rb').read().decode('latin1')
n = int(sys.argv[3]) if len(sys.argv) > 3 else 3
pos = [m.start() for m in re.finditer(re.escape(BS + 'pard'), b)]
terakhir = 0
for i, p in enumerate(pos[:60]):
    seg = b[p:(pos[i + 1] if i + 1 < len(pos) else len(b))]
    if 'NIK' in seg:
        terakhir = i
akhir = pos[min(terakhir + n + 1, len(pos) - 1)]
# mulai dokumen: tampilkan juga kop (paragraf awal) -> pakai seluruh awal
isi = b[:akhir] + '}'
open(sys.argv[2], 'wb').write(isi.encode('latin1'))
print(sys.argv[2], len(b), '->', len(isi))
