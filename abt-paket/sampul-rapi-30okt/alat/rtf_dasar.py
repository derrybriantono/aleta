# -*- coding: utf-8 -*-
"""Alat dasar RTF blangko berkas perkara (paket sampul-rapi-30okt). Pola sama dengan paket sampul-daftar-isi-26okt (alat/bangun_rtf.py),
dengan tata halaman penuh: margin 1,27 cm kiri-kanan, 1,2 cm atas, 1,06 cm bawah (aman untuk printer), tata halaman ditulis DUA kali
(dokumen dan seksi) agar Word, WPS, dan LibreOffice membaca ukuran kertas dan margin yang sama; satu huruf (Arial, seperti blangko Derry lain)
dengan ukuran terbaca (label >= 7,5 pt, isi 9-11 pt); kop berlogo monokrom satker di kiri."""
import os

KERTAS = {   # kode: (akhiran nama berkas, lebar twip, tinggi twip)
    'a4': ('', 11906, 16838),            # 210 x 297 mm
    'f4': (' (F4)', 12189, 18709),       # 215 x 330 mm
    'legal': (' (Legal)', 12246, 20183),  # 216 x 356 mm
}
MARGIN = dict(kiri=720, kanan=720, atas=680, bawah=600)
HAL = [11906, 16838]
LOGO = {'png': b'', 'w': 0, 'h': 0}
LOGO_TINGGI = 1080   # twip (1,9 cm) - sama dengan LOGO_KOP_TINGGI_TWIP di portal (lib/logo-rtf.ts)


def pilih_kertas(k):
    HAL[0], HAL[1] = KERTAS[k][1], KERTAS[k][2]


def lebar_isi():
    return HAL[0] - MARGIN['kiri'] - MARGIN['kanan']


def tinggi_isi():
    return HAL[1] - MARGIN['atas'] - MARGIN['bawah']


def muat_logo(jalur):
    import struct
    b = open(jalur, 'rb').read()
    assert b[:8] == b'\x89PNG\r\n\x1a\n'
    w, h = struct.unpack('>II', b[16:24])
    LOGO.update(png=b, w=w, h=h)


def esc(t):
    out = []
    for ch in t:
        o = ord(ch)
        if ch in '\\{}':
            out.append('\\' + ch)
        elif o > 127:
            out.append('\\u%d?' % (o if o < 32768 else o - 65536))
        else:
            out.append(ch)
    return ''.join(out)


def run(t, b=False, sz=None, sp=None, cf=None, caps=False):
    pre = ''
    if b: pre += '\\b'
    if sz: pre += '\\fs%d' % sz
    if sp: pre += '\\expndtw%d' % sp
    if cf: pre += '\\cf%d' % cf
    if not pre:
        return esc(t)
    return '{' + pre + ' ' + esc(t) + '}'


def par(segs, al='l', sb=0, sa=0, sz=18, intbl=None, keepn=False, brdb=False, li=0):
    """intbl: None = paragraf biasa; 'mid' = dalam sel (bukan terakhir, berakhir \\par); True = paragraf terakhir sel (berakhir \\cell)."""
    if isinstance(segs, str):
        segs = [esc(segs)]
    a = {'l': '\\ql', 'c': '\\qc', 'r': '\\qr', 'j': '\\qj'}[al]
    s = '\\pard\\plain' + ('\\intbl' if intbl else '') + a + '\\f0\\fs%d\\sb%d\\sa%d' % (sz, sb, sa)
    if li: s += '\\li%d' % li
    if keepn: s += '\\keepn'
    if brdb: s += '\\brdrb\\brdrs\\brdrw15\\brsp30'
    return s + ' ' + ''.join(segs) + ('\\cell' if intbl is True else '\\par') + '\n'


def p_sel(segs, **kw):
    return par(segs, intbl=True, **kw)


def sel(paragraf):
    return paragraf if isinstance(paragraf, str) else ''.join(paragraf)


def cell_def(x, brd, shade=None, va='t'):
    s = ''
    for n, w in zip(('t', 'l', 'b', 'r'), brd):
        if w:
            s += '\\clbrdr%s\\brdrs\\brdrw%d' % (n, w)
    if shade: s += '\\clcbpat%d' % shade
    s += {'t': '\\clvertalt', 'c': '\\clvertalc', 'b': '\\clvertalb'}[va]
    return s + '\\cellx%d' % x


def tabel(baris, jaga=True):
    """baris: [{'lebar': [...], 'sel': [...], 'brd': [(t,l,b,r)...], 'shade': [...], 'va': [...], 'tinggi': n, 'kepala': bool}].
    jaga: \\trkeep (baris tidak dipecah antar halaman) dan \\keepn pada baris yang bukan terakhir tidak dipakai - tabel panjang boleh lanjut."""
    out = ''
    for r in baris:
        # {\*\bkrw}: penanda tak terlihat baris riwayat sidang - portal menyetel tinggi baris ini per perkara (lib/tinggi-rtf.ts)
        out += '\\trowd' + ('{\\*\\bkrw}' if r.get('riwayat') else '') + '\\trgaph70\\trleft0\\trpaddl70\\trpaddr70\\trpaddfl3\\trpaddfr3'
        if r.get('tinggi'): out += '\\trrh%d' % r['tinggi']
        if jaga: out += '\\trkeep'
        if r.get('kepala'): out += '\\trhdr'
        x = 0
        for k, w in enumerate(r['lebar']):
            x += w
            brd = r['brd'][k] if 'brd' in r else (10, 10, 10, 10)
            out += cell_def(x, brd, shade=(r.get('shade') or [None] * len(r['lebar']))[k], va=(r.get('va') or ['t'] * len(r['lebar']))[k])
        out += '\n' + ''.join(r['sel']) + '\\row\n'
    return out


def gambar_logo(tinggi=LOGO_TINGGI):
    """Penanda tak terlihat + gambar logo monokrom tertanam (portal mengganti keduanya dengan logo Identitas satker bila ada)."""
    if not LOGO['png']:
        return '{\\fs2\\cf5 @@LOGO@@}'
    lebar = int(round(tinggi * LOGO['w'] / LOGO['h']))
    hx = LOGO['png'].hex()
    baris = '\n'.join(hx[i:i + 128] for i in range(0, len(hx), 128))
    return '{\\fs2\\cf5 @@LOGO@@}{\\pict\\pngblip\\picw%d\\pich%d\\picwgoal%d\\pichgoal%d\n%s}' % (LOGO['w'], LOGO['h'], lebar, tinggi, baris)


def kepala_rtf():
    w, h = HAL
    m = MARGIN
    return ('{\\rtf1\\ansi\\ansicpg1252\\deff0\\deflang1057\n'
            '{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}{\\f1\\fnil\\fcharset0 Segoe UI Symbol;}}\n'
            '{\\colortbl;\\red0\\green0\\blue0;\\red226\\green226\\blue226;\\red242\\green242\\blue242;\\red38\\green38\\blue38;\\red255\\green255\\blue255;}\n'
            '\\paperw%d\\paperh%d\\margl%d\\margr%d\\margt%d\\margb%d\\widowctrl\\ftnbj\\viewkind1\n'
            '\\sectd\\pgwsxn%d\\pghsxn%d\\marglsxn%d\\margrsxn%d\\margtsxn%d\\margbsxn%d\\headery280\\footery280\n'
            % (w, h, m['kiri'], m['kanan'], m['atas'], m['bawah'], w, h, m['kiri'], m['kanan'], m['atas'], m['bawah']))


def kop(sub, kanan, kanan_ket=None):
    """Kop: logo monokrom satker (kiri) | nama satker + keterangan blangko | kotak (BUNDEL A, MEJA I)."""
    L = lebar_isi()
    w_logo = 1450
    w_kanan = int(2900 * L / 10466)
    isi_kanan = ([par([run(kanan, b=True, sz=26, sp=8)], al='c', intbl=True, sb=40, sa=40)] if not kanan_ket else
                 [par([run(kanan, b=True, sz=26, sp=8)], al='c', intbl='mid', sb=40), p_sel([run(kanan_ket, b=True, sz=15, sp=6)], al='c', sa=40)])
    return tabel([{
        'lebar': [w_logo, L - w_logo - w_kanan, w_kanan], 'tinggi': 1000, 'va': ['c', 'c', 'c'],
        'brd': [(0, 0, 25, 0), (0, 0, 25, 0), (25, 25, 25, 25)],
        'sel': [p_sel([gambar_logo()], al='l', sz=4),
                sel([par([run('#8010#', b=True, sz=30, sp=4)], intbl='mid', sb=0, sa=40), p_sel([run(sub, sz=18)], sa=0)]),
                sel(isi_kanan)],
    }])


def judul_bagian(teks, ket=None, sb=120):
    segs = [run(teks, b=True, sz=18, sp=10)]
    if ket: segs.append(run('   ' + ket, sz=15))
    return par(segs, sb=sb, sa=40, keepn=True, brdb=True)


K = (10, 10, 10, 10)


def simpan(folder, nama, isi):
    assert 'aleta' not in isi.lower()
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, nama), 'wb') as f:
        f.write(isi.replace('\r\n', '\n').replace('\n', '\r\n').encode('latin1'))
