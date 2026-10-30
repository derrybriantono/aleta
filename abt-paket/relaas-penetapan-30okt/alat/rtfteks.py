# -*- coding: utf-8 -*-
"""Pembantu bersama: pembersihan RTF seperti ABT (views/abt/preview.php) dan teks TAMPAK RTF (seperti dibaca di kertas):
tulisan tersembunyi (\\v) dan tulisan berwarna putih dibuang, tabel jadi tab, paragraf jadi baris."""
import re

BS = chr(92)

LEWATI = {'fonttbl', 'colortbl', 'stylesheet', 'info', 'listtable', 'listoverridetable', 'rsidtbl', 'latentstyles', 'datastore',
          'themedata', 'colorschememapping', 'xmlnstbl', 'generator', 'pgdsctbl', 'mmathPr', 'pict', 'object', 'fldinst', 'sp', 'shprslt', 'shppict', 'nonshppict', 'bkmkstart',
          'bkmkend', 'xe', 'tc', 'filetbl', 'revtbl', 'userprops', 'wgrffmtfilter', 'pnseclvl', 'listtext', 'ftnsep', 'ftnsepc',
          'aftnsep', 'aftnsepc', 'protusertbl', 'docvar'}


def bersih_abt(b):
    """Teks RTF yang dilihat Abt_model::variabel_library: tanpa \\n, tanpa dua urutan hich yang dibuang ABT."""
    s = b.decode('latin1').replace('\n', '')
    s = s.replace(BS + 'hich' + BS + 'af1' + BS + 'dbch' + BS + 'af31505' + BS + 'loch' + BS + 'f0 ', '')
    s = s.replace(BS + 'hich' + BS + 'af1' + BS + 'dbch' + BS + 'af31505' + BS + 'loch' + BS + 'f1 ', '')
    return s


_TOKEN = re.compile(r'\\([a-zA-Z]+)(-?\d+)? ?|\\\'([0-9a-fA-F]{2})|\\(.)|([{}])|([^\\{}\r\n]+)|[\r\n]+', re.S)
_WARNA = re.compile(r'\\red(\d+)\\green(\d+)\\blue(\d+);|;')


def _putih(s):
    """Indeks warna putih di colortbl."""
    i = s.find('{' + BS + 'colortbl')
    if i < 0:
        return set()
    j = s.find('}', i)
    isi = s[i + len('{' + BS + 'colortbl'):j]
    putih = set()
    n = 0
    for m in _WARNA.finditer(isi):
        if m.group(1) is not None:
            if (int(m.group(1)), int(m.group(2)), int(m.group(3))) == (255, 255, 255):
                putih.add(n)
        n += 1
    return putih


def teks_tampak(s, buang_putih=True):
    putih = _putih(s) if buang_putih else set()
    keluar = []
    tumpuk = []
    st = {'lewat': False, 'v': False, 'cf': 0, 'uc': 1}
    lewati_u = 0
    bintang = False
    for m in _TOKEN.finditer(s):
        kata, ang, heks, lain, kurung, teks = m.groups()
        if kurung == '{':
            tumpuk.append(dict(st))
            bintang = True
            continue
        if kurung == '}':
            if tumpuk:
                st = tumpuk.pop()
            bintang = False
            continue
        awal_grup = bintang
        bintang = False
        tampak = not st['lewat'] and not st['v'] and st['cf'] not in putih
        if kata:
            if st.get('tunda'):
                st['tunda'] = False
                if kata not in ('shpinst', 'shptxt'):
                    st['lewat'] = True
                continue
            if awal_grup and kata in LEWATI:
                st['lewat'] = True
            elif kata == 'v':
                st['v'] = ang != '0'
            elif kata == 'cf':
                st['cf'] = int(ang or 0)
            elif kata == 'plain':
                st['cf'] = 0
                st['v'] = False
            elif kata == 'uc':
                st['uc'] = int(ang or 1)
            elif kata == 'u':
                if tampak:
                    keluar.append(chr(int(ang) % 65536))
                lewati_u = st['uc']
            elif kata in ('par', 'line', 'sect', 'page', 'row'):
                if not st['lewat']:
                    keluar.append('\n')
            elif kata == 'cell':
                if not st['lewat']:
                    keluar.append('\t')
            elif kata == 'tab':
                if tampak:
                    keluar.append('\t')
            continue
        if lain is not None:
            if lain == '*':
                if awal_grup:
                    st['tunda'] = True
                    bintang = False
                continue
            if lain in '{}\\' and tampak:
                keluar.append(lain)
            elif lain == '~' and tampak:
                keluar.append(' ')
            elif lain == '_' and tampak:
                keluar.append('-')
            continue
        if heks is not None:
            if lewati_u:
                lewati_u -= 1
                continue
            if tampak:
                keluar.append(bytes.fromhex(heks).decode('cp1252', 'replace'))
            continue
        if teks:
            if lewati_u:
                k = min(lewati_u, len(teks))
                teks = teks[k:]
                lewati_u -= k
            if tampak:
                keluar.append(teks)
    t = ''.join(keluar)
    t = re.sub(r'[ \t]+\n', '\n', t)
    t = re.sub(r'\n{3,}', '\n\n', t)
    return t.strip()
