# -*- coding: utf-8 -*-
"""Ukur sinkron keterangan saksi BAS <-> putusan atas hasil render (render_uji.py) perkara yang sama.

Jawaban BAS (baris "- ..." sesudah pertanyaan) dinormalkan seperti isian_rtf_ket_saksi (saya -> saksi, "ya, " dibuang,
huruf awal kecil) lalu dicari di butir putusan ("- Bahwa ..."). Kalimat penutup (sudah cukup dst.) diabaikan.
pakai: python sinkron.py <teks BAS> <teks putusan>   -> jumlah jawaban, ketemu, tidak ketemu (contoh)
"""
import re, sys

PENUTUP = re.compile(r'^(sudah cukup|cukup|tidak ada( lagi)?|sekian|demikian)\b', re.I)


def norm(s):
    s = s.strip().lstrip('-').strip()
    s = re.sub(r'^bahwa\s+', '', s, flags=re.I)
    s = re.sub(r'^ya,\s*', '', s, flags=re.I)
    s = re.sub(r'\bsaya\b', 'saksi', s, flags=re.I)
    s = re.sub(r'[^a-z0-9 ]', '', s.lower())
    return re.sub(r'\s+', '', s)[:50]   # tanpa spasi: jawaban berganti baris tergabung tanpa spasi di sel tabel BAS ABT


def main():
    bas = [x.strip() for x in open(sys.argv[1], encoding='utf-8')]
    put = [x.strip() for x in open(sys.argv[2], encoding='utf-8')]
    jawab = [x for x in bas if x.startswith('- ') and not x.startswith('- Bahwa')]
    jawab = [x for x in jawab if not PENUTUP.match(x[2:].strip())]
    butir = {norm(x) for x in put if re.match(r'^[-–]\s*Bahwa', x)}
    ada = [x for x in jawab if norm(x) in butir]
    tidak = [x for x in jawab if norm(x) not in butir]
    print('jawaban BAS %d | ada di putusan %d | tidak %d' % (len(jawab), len(ada), len(tidak)))
    for x in tidak[:5]:
        print('  TIDAK:', x[:100])


if __name__ == '__main__':
    main()
