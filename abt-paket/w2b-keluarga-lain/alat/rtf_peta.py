# -*- coding: utf-8 -*-
"""Peta teks-tampak -> posisi mentah RTF, untuk mengganti teks per jangkar walau teksnya terpecah grup format.

cari(raw, teks)            -> daftar (awal_mentah, akhir_mentah) tiap kemunculan teks tampak
ganti(raw, teks, baru, n)  -> raw baru; gagal bila jumlah kemunculan != n, rentang memotong \\par/\\cell,
                              atau kurung kurawal di rentang tidak seimbang (bersih 0 dan tak pernah negatif-lalu-positif).
Teks baru ditulis sebagai teks RTF (karakter > 127 di-escape \\'xx, { } \\ di-escape)."""
import re

LEWATI = {'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'headerl', 'headerr', 'footerl',
          'footerr', 'listtable', 'listoverridetable', 'rsidtbl', 'xmlnstbl', 'mmathPr', 'themedata', 'colorschememapping',
          'datastore', 'latentstyles', 'generator', 'pgdsctbl', 'fldinst', 'object', 'shp', 'shppict', 'nonshppict',
          'bkmkstart', 'bkmkend', 'wgrffmtfilter', 'filetbl'}


def peta(data):
    """data: str latin1. Pulang (teks, awal[], akhir[]) - satu entri per karakter tampak."""
    chars, aw, ak = [], [], []
    i, n = 0, len(data)
    stack, skip, ucskip = [], False, 1
    while i < n:
        c = data[i]
        if c == '{':
            stack.append((skip, ucskip)); i += 1; continue
        if c == '}':
            if stack:
                skip, ucskip = stack.pop()
            i += 1; continue
        if c == '\\':
            j = i
            i += 1
            if i >= n:
                break
            c2 = data[i]
            if c2 in '\\{}':
                if not skip:
                    chars.append(c2); aw.append(j); ak.append(i + 1)
                i += 1; continue
            if c2 == "'":
                hx = data[i + 1:i + 3]
                if not skip:
                    try:
                        chars.append(bytes([int(hx, 16)]).decode('cp1252'))
                    except Exception:
                        chars.append('?')
                    aw.append(j); ak.append(i + 3)
                i += 3; continue
            if c2 == '*':
                skip = True; i += 1; continue
            if c2 == '~':
                if not skip:
                    chars.append(' '); aw.append(j); ak.append(i + 1)
                i += 1; continue
            if c2 in '-_':
                i += 1; continue
            m = re.match(r'([a-zA-Z]+)(-?\d+)? ?', data[i:])
            if m:
                w, arg = m.group(1), m.group(2)
                i += m.end()
                if w in LEWATI:
                    skip = True
                elif not skip:
                    if w in ('par', 'line', 'sect', 'page', 'row'):
                        chars.append('\n'); aw.append(j); ak.append(i)
                    elif w in ('tab', 'cell'):
                        chars.append('\t'); aw.append(j); ak.append(i)
                    elif w == 'u' and arg:
                        v = int(arg)
                        if v < 0:
                            v += 65536
                        chars.append(chr(v)); aw.append(j)
                        i += ucskip
                        ak.append(i)
                    elif w == 'uc' and arg:
                        ucskip = int(arg)
                continue
            i += 1; continue
        if c in '\r\n':
            i += 1; continue
        if not skip:
            chars.append(c); aw.append(i); ak.append(i + 1)
        i += 1
    return ''.join(chars), aw, ak


def cari(data, teks):
    t, aw, ak = peta(data)
    hasil, mulai = [], 0
    while True:
        k = t.find(teks, mulai)
        if k < 0:
            break
        hasil.append((aw[k], ak[k + len(teks) - 1]))
        mulai = k + len(teks)
    return hasil


def seimbang(seg):
    d = 0
    i = 0
    while i < len(seg):
        c = seg[i]
        if c == '\\':
            i += 2; continue
        if c == '{':
            d += 1
        elif c == '}':
            d -= 1
        i += 1
    return d == 0


def esc(teks):
    out = []
    for ch in teks:
        o = ord(ch)
        if ch in '\\{}':
            out.append('\\' + ch)
        elif o < 128:
            out.append(ch)
        else:
            try:
                b = ch.encode('cp1252')
                out.append("\\'%02x" % b[0])
            except UnicodeEncodeError:
                out.append('{\\uc1 \\u%d ?}' % (o if o < 32768 else o - 65536))
    return ''.join(out)


def ganti(data, teks, baru, n=None):
    letak = cari(data, teks)
    if n is not None and len(letak) != n:
        raise ValueError('jangkar %r muncul %d kali, diharapkan %d' % (teks[:60], len(letak), n))
    for a, b in reversed(letak):
        seg = data[a:b]
        if re.search(r'\\(par|cell|row|sect)\b', seg):
            raise ValueError('rentang jangkar %r memotong paragraf/sel' % teks[:60])
        if not seimbang(seg):
            raise ValueError('rentang jangkar %r tidak seimbang kurung' % teks[:60])
        data = data[:a] + esc(baru) + data[b:]
    return data, len(letak)


def ganti_rentang(data, awal, akhir, baru, n=None):
    """Ganti teks tampak dari `awal` sampai `akhir` (inklusif, satu paragraf) dengan `baru`."""
    t, aw, ak = peta(data)
    letak, mulai = [], 0
    while True:
        k = t.find(awal, mulai)
        if k < 0:
            break
        e = t.find(akhir, k)
        if e < 0 or '\n' in t[k:e + len(akhir)]:
            raise ValueError('akhir %r tidak ditemukan dalam paragraf yang sama dengan %r' % (akhir[:40], awal[:40]))
        letak.append((aw[k], ak[e + len(akhir) - 1]))
        mulai = e + len(akhir)
    if n is not None and len(letak) != n:
        raise ValueError('rentang %r..%r muncul %d kali, diharapkan %d' % (awal[:40], akhir[:40], len(letak), n))
    for a, b in reversed(letak):
        seg = data[a:b]
        if re.search(r'\(par|cell|row|sect)\b', seg):
            raise ValueError('rentang %r memotong paragraf/sel' % awal[:40])
        if not seimbang(seg):
            raise ValueError('rentang %r tidak seimbang kurung' % awal[:40])
        data = data[:a] + esc(baru) + data[b:]
    return data, len(letak)


def ganti_dalam(data, depan, sasaran, baru, n=None):
    """Seperti ganti(), tetapi jangkarnya `depan`+`sasaran` dan yang diganti hanya bagian `sasaran`."""
    t, aw, ak = peta(data)
    utuh = depan + sasaran
    letak, mulai = [], 0
    while True:
        k = t.find(utuh, mulai)
        if k < 0:
            break
        s = k + len(depan)
        letak.append((aw[s], ak[s + len(sasaran) - 1]))
        mulai = k + len(utuh)
    if n is not None and len(letak) != n:
        raise ValueError('jangkar %r muncul %d kali, diharapkan %d' % (utuh[:60], len(letak), n))
    for a, b in reversed(letak):
        seg = data[a:b]
        if re.search(r'\(par|cell|row|sect)\b', seg) or not seimbang(seg):
            raise ValueError('rentang jangkar %r tidak aman' % utuh[:60])
        data = data[:a] + esc(baru) + data[b:]
    return data, len(letak)
