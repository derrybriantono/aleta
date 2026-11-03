# -*- coding: utf-8 -*-
"""Peta huruf tampak RTF -> offset bita. Untuk tambalan mekanis: tiap huruf tampak dicatat (offset, panjang, harfiah?).
Hanya huruf harfiah (satu bita = huruf itu sendiri, bukan \\'xx / \\u) yang boleh dihapus/ditempeli.
Teks tujuan tersembunyi (\\* , fonttbl, colortbl, stylesheet, info, pict, fldinst, ...) dilewati.
Pemisah: \\par/\\sect/\\row -> '\\n', \\cell -> '|', \\tab -> '\\t', \\line -> '\\n'."""
import re

TOK = re.compile(rb"\\([a-zA-Z]+)(-?\d+)? ?|\\'([0-9a-fA-F]{2})|\\(.)|([{}])|([^\\{}\r\n]+)|([\r\n]+)", re.S)

LEWAT = {b'fonttbl', b'colortbl', b'stylesheet', b'info', b'pict', b'object', b'listtable', b'listoverridetable',
         b'rsidtbl', b'themedata', b'colorschememapping', b'datastore', b'latentstyles', b'generator', b'xmlnstbl',
         b'mmathPr', b'pgdsctbl', b'fldinst', b'bkmkstart', b'bkmkend', b'shp', b'shpinst', b'nonshppict', b'revtbl',
         b'filetbl', b'protusertbl', b'wgrffmtfilter', b'xe', b'tc', b'atnid', b'atnauthor', b'annotation', b'userprops',
         b'docvar', b'template', b'falt', b'panose', b'objdata', b'blipuid', b'sp', b'sv', b'sn', b'fontemb', b'fontfile',
         b'listtext', b'pntext', b'pntxta', b'pntxtb'}


def peta(b):
    """-> (teks, pos) ; pos[i] = (offset, panjang, harfiah) untuk teks[i]"""
    teks = []
    pos = []
    tumpuk = []
    lewat = False
    uc = 1
    lewat_u = 0
    awal = False

    def tambah(ch, off, n, harf):
        teks.append(ch)
        pos.append((off, n, harf))

    for m in TOK.finditer(b):
        kata, angka, hexa, sim, kur, tx, nl = m.groups()
        o = m.start()
        if nl is not None:
            continue
        if kur == b'{':
            tumpuk.append((lewat, uc))
            awal = True
            continue
        if kur == b'}':
            if tumpuk:
                lewat, uc = tumpuk.pop()
            awal = False
            continue
        if sim is not None:
            if sim == b'*' and awal:
                lewat = True
            elif not lewat:
                if sim == b'~':
                    tambah(' ', o, 2, False)
                elif sim in (b'\\', b'{', b'}'):
                    tambah(sim.decode(), o, 2, False)
                elif sim == b'_':
                    tambah('-', o, 2, False)
            awal = False
            continue
        if kata is not None:
            if awal and kata in LEWAT:
                lewat = True
            awal = False
            if lewat:
                continue
            if kata in (b'par', b'sect', b'row', b'line', b'page'):
                tambah('\n', o, 0, False)
            elif kata == b'tab':
                tambah('\t', o, 0, False)
            elif kata == b'cell':
                tambah('|', o, 0, False)
            elif kata == b'uc':
                uc = int(angka or 1)
            elif kata == b'u':
                v = int(angka or 0)
                if v < 0:
                    v += 65536
                tambah(chr(v), o, 0, False)
                lewat_u = uc
            elif kata in (b'emdash', b'endash'):
                tambah('-', o, 0, False)
            elif kata in (b'lquote', b'rquote'):
                tambah("'", o, 0, False)
            elif kata in (b'ldblquote', b'rdblquote'):
                tambah('"', o, 0, False)
            continue
        awal = False
        if lewat:
            continue
        if hexa is not None:
            if lewat_u > 0:
                lewat_u -= 1
                continue
            tambah(bytes([int(hexa, 16)]).decode('cp1252', 'replace'), o, 4, False)
            continue
        if tx is not None:
            i0 = 0
            if lewat_u > 0:
                i0 = min(lewat_u, len(tx))
                lewat_u = 0
            for i in range(i0, len(tx)):
                tambah(chr(tx[i]) if tx[i] < 128 else bytes([tx[i]]).decode('cp1252', 'replace'), o + i, 1, tx[i] < 128)
    return ''.join(teks), pos


def kurung_seimbang(b):
    d = 0
    i = 0
    n = len(b)
    while i < n:
        c = b[i]
        if c == 0x5C:
            i += 2
            continue
        if c == 0x7B:
            d += 1
        elif c == 0x7D:
            d -= 1
            if d < 0:
                return False
        i += 1
    return d == 0
