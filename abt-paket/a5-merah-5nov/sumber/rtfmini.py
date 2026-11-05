# -*- coding: utf-8 -*-
"""Pengurai RTF sederhana untuk audit A3 (baca saja). Mengembalikan paragraf teks polos + tanda (merah/sorot) + keadaan kurung."""
import re

TOK = re.compile(rb"\\([a-zA-Z]+)(-?\d+)? ?|\\'([0-9a-fA-F]{2})|\\(.)|([{}])|([^\\{}\r\n]+)|[\r\n]+", re.S)

LEWAT = {b'fonttbl', b'colortbl', b'stylesheet', b'info', b'pict', b'object', b'listtable', b'listoverridetable',
         b'rsidtbl', b'themedata', b'colorschememapping', b'datastore', b'latentstyles', b'generator', b'xmlnstbl',
         b'mmathPr', b'pgdsctbl', b'fldinst', b'bkmkstart', b'bkmkend', b'shp', b'shpinst', b'nonshppict', b'header',
         b'footer', b'headerl', b'headerr', b'headerf', b'footerl', b'footerr', b'footerf', b'revtbl', b'filetbl',
         b'protusertbl', b'wgrffmtfilter', b'xe', b'tc', b'atnid', b'atnauthor', b'annotation', b'userprops', b'docvar',
         b'template', b'falt', b'panose', b'objdata', b'blipuid', b'sp', b'sv', b'sn', b'fontemb', b'fontfile'}


def kurung(b):
    """(seimbang?, posisi depth kembali 0 pertama, panjang, depth minimum, depth akhir, sisa teks bermakna sesudah penutup)"""
    d = 0
    nol = None
    mn = 0
    i = 0
    n = len(b)
    while i < n:
        c = b[i]
        if c == 0x5C:  # backslash
            i += 2
            continue
        if c == 0x7B:
            d += 1
        elif c == 0x7D:
            d -= 1
            if d == 0 and nol is None:
                nol = i
            mn = min(mn, d)
        i += 1
    sisa = b[nol + 1:].strip(b' \r\n\t\x00') if nol is not None else b''
    return {'akhir': d, 'min': mn, 'nol': nol, 'panjang': n, 'sisa': len(sisa)}


def warna_tabel(b):
    m = re.search(rb'\{\\colortbl\s*;?(.*?)\}', b, re.S)
    if not m:
        return []
    isi = m.group(1)
    hasil = [None]  # indeks 0 = otomatis (sebelum titik koma pertama)
    if not b[m.start():m.start() + 40].replace(b' ', b'').startswith(b'{\\colortbl;'):
        hasil = []
    for bag in isi.split(b';'):
        r = re.search(rb'\\red(\d+)', bag)
        g = re.search(rb'\\green(\d+)', bag)
        bl = re.search(rb'\\blue(\d+)', bag)
        if r or g or bl:
            hasil.append((int(r.group(1)) if r else 0, int(g.group(1)) if g else 0, int(bl.group(1)) if bl else 0))
        elif bag.strip():
            hasil.append(None)
    return hasil


def merah(c):
    return c is not None and c[0] >= 170 and c[1] <= 90 and c[2] <= 90


def urai(b):
    """-> dict(paragraf=[teks], merah=[cuplikan], sorot=[cuplikan])"""
    warna = warna_tabel(b)
    tumpuk = []
    st = {'lewat': False, 'cf': 0, 'hl': 0, 'uc': 1, 'listtext': False}
    para = []
    cur = []
    merahc, sorotc = [], []
    cur_m, cur_s = [], []
    lewat_u = 0
    awal_grup = False
    for m in TOK.finditer(b):
        kata, angka, hexa, sim, kur, teks = m.groups()
        if kur == b'{':
            tumpuk.append(dict(st))
            awal_grup = True
            continue
        if kur == b'}':
            if tumpuk:
                st = tumpuk.pop()
            awal_grup = False
            continue
        if sim is not None:
            if sim == b'*' and awal_grup:
                st['lewat'] = True
            elif not st['lewat']:
                if sim == b'~':
                    cur.append(' ')
                elif sim in (b'\\', b'{', b'}'):
                    cur.append(sim.decode())
                elif sim == b'-':
                    pass
                elif sim == b'_':
                    cur.append('-')
            awal_grup = False
            continue
        if kata is not None:
            k = kata
            if awal_grup and k in LEWAT:
                st['lewat'] = True
            awal_grup = False
            if st['lewat']:
                continue
            if k == b'listtext':
                st['listtext'] = True
            if k in (b'par', b'sect'):
                para.append(''.join(cur))
                cur = []
            elif k == b'tab':
                cur.append('\t')
            elif k in (b'line',):
                cur.append('\n')
            elif k == b'cell':
                cur.append(' | ')
            elif k == b'row':
                para.append(''.join(cur))
                cur = []
            elif k == b'cf':
                st['cf'] = int(angka or 0)
            elif k in (b'highlight', b'chcbpat'):
                st['hl'] = int(angka or 0)
            elif k == b'plain':
                st['cf'] = 0
                st['hl'] = 0
            elif k == b'uc':
                st['uc'] = int(angka or 1)
            elif k == b'u':
                v = int(angka or 0)
                if v < 0:
                    v += 65536
                try:
                    cur.append(chr(v))
                except ValueError:
                    pass
                lewat_u = st['uc']
            elif k in (b'emdash',):
                cur.append('-')
            elif k in (b'endash',):
                cur.append('-')
            elif k in (b'lquote', b'rquote'):
                cur.append("'")
            elif k in (b'ldblquote', b'rdblquote'):
                cur.append('"')
            elif k == b'bullet':
                cur.append('*')
            continue
        awal_grup = False
        if st['lewat']:
            continue
        if hexa is not None:
            if lewat_u > 0:
                lewat_u -= 1
                continue
            ch = bytes([int(hexa, 16)]).decode('cp1252', 'replace')
            s = ch
        elif teks is not None:
            s = teks.decode('cp1252', 'replace')
            if lewat_u > 0:
                s = s[lewat_u:]
                lewat_u = 0
        else:
            continue
        cur.append(s)
        idx = st['cf']
        c = warna[idx] if 0 <= idx < len(warna) else None
        if s.strip():
            if merah(c):
                merahc.append(s)
            if st['hl']:
                sorotc.append(s)
    if cur:
        para.append(''.join(cur))
    return {'paragraf': para, 'merah': merahc, 'sorot': sorotc}


if __name__ == '__main__':
    import sys
    d = urai(open(sys.argv[1], 'rb').read())
    for p in d['paragraf']:
        print(repr(p)[:300])
    print('MERAH', d['merah'][:20])
    print('SOROT', d['sorot'][:20])
