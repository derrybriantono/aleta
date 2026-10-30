# -*- coding: utf-8 -*-
"""Peta teks tampak RTF -> posisi di RTF mentah (G6 6.2): tiap huruf teks tampak tahu letak aslinya, supaya satu tanda baca dapat
diganti tepat di tempatnya tanpa menyentuh kode RTF. Kelompok tujuan yang tidak tampak (fonttbl, colortbl, stylesheet, info, {\\* ...},
pict, header/footer, fldinst, dst.) dilewati - titik koma di sana (pemisah nama huruf, warna) bukan teks blangko.
"""
import re

LEWATI = {'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'headerl', 'headerr', 'footerl', 'footerr',
          'listtable', 'listoverridetable', 'rsidtbl', 'xmlnstbl', 'mmathPr', 'themedata', 'colorschememapping', 'datastore',
          'latentstyles', 'generator', 'pgdsctbl', 'fldinst', 'object', 'shp', 'shppict', 'nonshppict', 'bkmkstart', 'bkmkend',
          'wgrffmtfilter', 'filetbl', 'listtext', 'pntext', 'pntxta', 'pntxtb'}
BATAS = {'par', 'line', 'sect', 'cell', 'row', 'page'}
RE_KATA = re.compile(r'\\([a-zA-Z]+)(-?\d+)? ?')


def peta(raw):
    """-> (teks, idx): teks tampak (paragraf dipisah '\\n') dan idx[i] = posisi huruf ke-i di raw (-1 untuk pemisah buatan)."""
    teks = []
    idx = []
    i = 0
    n = len(raw)
    tumpuk = []
    lewat = False
    while i < n:
        c = raw[i]
        if c == '{':
            tumpuk.append(lewat)
            i += 1
            if raw.startswith('\\*', i):
                lewat = True
            continue
        if c == '}':
            lewat = tumpuk.pop() if tumpuk else False
            i += 1
            continue
        if c == '\\':
            m = RE_KATA.match(raw, i)
            if m:
                kata = m.group(1)
                if kata in LEWATI:
                    lewat = True
                elif not lewat and kata in BATAS:
                    teks.append('\n')
                    idx.append(-1)
                elif not lewat and kata == 'tab':
                    teks.append('\t')
                    idx.append(-1)
                i = m.end()
                continue
            if raw.startswith("\\'", i) and i + 3 < n + 1:
                if not lewat:
                    try:
                        teks.append(bytes.fromhex(raw[i + 2:i + 4]).decode('cp1252'))
                    except (ValueError, UnicodeDecodeError):
                        teks.append('?')
                    idx.append(i)
                i += 4
                continue
            # \\ \{ \} \~ \- \_
            if i + 1 < n:
                d = raw[i + 1]
                if not lewat and d in '\\{}':
                    teks.append(d)
                    idx.append(i + 1)
                elif not lewat and d == '~':
                    teks.append(' ')
                    idx.append(-1)
            i += 2
            continue
        if c in '\r\n':
            i += 1
            continue
        if not lewat:
            teks.append(c)
            idx.append(i)
        i += 1
    return ''.join(teks), idx
