# -*- coding: utf-8 -*-
"""Penyunting RTF berbasis teks polos: setiap huruf teks polos dipetakan ke rentang byte aslinya, sehingga sebuah kata dapat diganti tanpa
menyentuh kata kendali, warna, atau format di sekitarnya. Hanya untuk membangun paket (laptop, Python 3). Hasil: potongan (mulai, akhir, baru)
atas berkas lama, yang kemudian ditulis sebagai tambal.tsv.
"""
import re

TOK = re.compile(rb"\\([a-zA-Z]+)(-?\d+)? ?|\\'([0-9a-fA-F]{2})|\\(.)|([{}])|([^\\{}\r\n]+)|[\r\n]+", re.S)

LEWAT = {b'fonttbl', b'colortbl', b'stylesheet', b'info', b'pict', b'object', b'listtable', b'listoverridetable',
         b'rsidtbl', b'themedata', b'colorschememapping', b'datastore', b'latentstyles', b'generator', b'xmlnstbl',
         b'mmathPr', b'pgdsctbl', b'fldinst', b'bkmkstart', b'bkmkend', b'shp', b'shpinst', b'nonshppict', b'header',
         b'footer', b'headerl', b'headerr', b'headerf', b'footerl', b'footerr', b'footerf', b'revtbl', b'filetbl',
         b'protusertbl', b'wgrffmtfilter', b'xe', b'tc', b'atnid', b'atnauthor', b'annotation', b'userprops', b'docvar',
         b'template', b'falt', b'panose', b'objdata', b'blipuid', b'sp', b'sv', b'sn', b'fontemb', b'fontfile'}


class Dok:
    def __init__(self, data):
        self.data = data
        t, s, e = [], [], []
        tumpuk = []
        st = {'lewat': False, 'uc': 1}
        awal_grup = False
        sisa_u = 0
        for m in TOK.finditer(data):
            kata, angka, hexa, sim, kur, teks = m.groups()
            a, b = m.start(), m.end()
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
                    c = None
                    if sim == b'~':
                        c = ' '
                    elif sim in (b'\\', b'{', b'}'):
                        c = sim.decode()
                    elif sim == b'_':
                        c = '-'
                    if c is not None:
                        t.append(c); s.append(a); e.append(b)
                awal_grup = False
                continue
            if kata is not None:
                if awal_grup and kata in LEWAT:
                    st['lewat'] = True
                awal_grup = False
                if st['lewat']:
                    continue
                if kata in (b'par', b'sect'):
                    t.append('\n'); s.append(a); e.append(b)
                elif kata == b'line':
                    t.append('\x0b'); s.append(a); e.append(b)
                elif kata == b'tab':
                    t.append('\t'); s.append(a); e.append(b)
                elif kata in (b'cell', b'row'):
                    t.append('\x01'); s.append(a); e.append(b)
                elif kata == b'uc':
                    st['uc'] = int(angka or 1)
                elif kata == b'u':
                    v = int(angka or 0)
                    if v < 0:
                        v += 65536
                    t.append(chr(v)); s.append(a); e.append(b)
                    sisa_u = st['uc']
                continue
            awal_grup = False
            if st['lewat']:
                continue
            if hexa is not None:
                if sisa_u > 0:
                    sisa_u -= 1
                    e[-1] = b
                    continue
                t.append(bytes([int(hexa, 16)]).decode('cp1252', 'replace')); s.append(a); e.append(b)
            elif teks is not None:
                i = 0
                while sisa_u > 0 and i < len(teks):
                    e[-1] = a + i + 1
                    i += 1
                    sisa_u -= 1
                for j in range(i, len(teks)):
                    t.append(teks[j:j + 1].decode('cp1252', 'replace')); s.append(a + j); e.append(a + j + 1)
        self.T = ''.join(t)
        self.S = s
        self.E = e

    # --- pencarian -----------------------------------------------------------------------------------------------
    def semua(self, teks):
        i, hasil = 0, []
        while True:
            j = self.T.find(teks, i)
            if j < 0:
                return hasil
            hasil.append(j)
            i = j + 1

    def lempang(self, a, b):
        """Huruf a..b-1 menempel di byte aslinya (tidak ada kata kendali/kurung di antaranya, selain \\ucN)."""
        for i in range(a, b - 1):
            gap = self.data[self.E[i]:self.S[i + 1]]
            if gap and not re.fullmatch(rb'\\uc\d+ ?', gap):
                return False
        return True

    def ganti(self, lama, baru, sebelum='', sesudah='', n=1, lintas=False):
        """Ganti `lama` (teks polos) dengan `baru` di tiap tempat yang diapit `sebelum` dan `sesudah`. Hasil: daftar potongan (mulai, akhir, bytes)."""
        pola = sebelum + lama + sesudah
        tempat = self.semua(pola)
        if n is not None and len(tempat) != n:
            raise SystemExit('ganti: %r ditemukan %d kali, diharapkan %s' % (pola[:80], len(tempat), n))
        hasil = []
        for p in tempat:
            a = p + len(sebelum)
            b = a + len(lama)
            if lama:
                if self.lempang(a, b):
                    hasil.append((self.S[a], self.E[b - 1], enc(baru)))
                elif lintas:
                    # beberapa run: teks baru masuk ke run pertama, potongan run lain dikosongkan
                    awal = a
                    pertama = True
                    for i in range(a + 1, b + 1):
                        if i == b or not self.lempang(i - 1, i + 1):
                            hasil.append((self.S[awal], self.E[i - 1], enc(baru) if pertama else b''))
                            pertama = False
                            awal = i
                else:
                    raise SystemExit('ganti: %r melintasi format/run, pisahkan per bagian' % lama[:60])
            else:
                pos = self.E[a - 1] if sebelum else self.S[a]
                hasil.append((pos, pos, enc(baru)))
        return hasil


def enc(teks):
    """Teks polos -> byte RTF (ASCII; di luar itu \\uc1 \\uN ?)."""
    out = []
    for c in teks:
        o = ord(c)
        if c in '\\{}':
            out.append('\\' + c)
        elif c == '\n':
            raise ValueError('enc: gunakan potongan paragraf, bukan \\n')
        elif o < 128:
            out.append(c)
        else:
            n = o if o < 32768 else o - 65536
            out.append('\\uc1 \\u%d ?' % n)
    return ''.join(out).encode('latin1')


def terapkan(data, potongan):
    """potongan: [(mulai, akhir, bytes)] atas `data`. Tidak boleh bertumpuk. -> bytes baru."""
    urut = sorted(potongan, key=lambda x: (x[0], x[1]))
    for (a1, b1, _), (a2, b2, _) in zip(urut, urut[1:]):
        if a2 < b1:
            raise SystemExit('potongan bertumpuk: %r %r' % ((a1, b1), (a2, b2)))
    for a, b, n in sorted(potongan, key=lambda x: -x[0]):
        data = data[:a] + n + data[b:]
    return data


def _seimbang(b):
    """(seimbang?) tanpa kurung tutup berlebih; kurung yang dilolos dengan \ tidak dihitung."""
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


_PAR = re.compile(rb'\\par(?![a-zA-Z])')


def _rentang_paragraf(self, a, z):
    r"""Rentang byte seluruh paragraf dari huruf a (awal paragraf pertama) sampai huruf z (penutup \par paragraf terakhir): dari \pard sampai
    sesudah \par (dan kurung tutup runnya). Gagal bila rentang tidak seimbang."""
    data = self.data
    if self.T[z] != '\n':
        raise SystemExit('rentang_paragraf: huruf z bukan penutup paragraf')
    j = self.E[z]
    if data[j:j + 1] == b'}':
        j += 1
    i = data.rfind(b'\\pard', 0, self.S[a])
    for _ in range(4):
        if i < 0:
            break
        if _seimbang(data[i:j]):
            return i, j
        i = data.rfind(b'\\pard', 0, i)
    raise SystemExit('rentang_paragraf: rentang tidak seimbang di %d..%d' % (self.S[a], j))


def _par_setelah(self, a):
    k = self.T.find('\n', a)
    if k < 0:
        raise SystemExit('par_setelah: tidak ada')
    return k


def _hapus_paragraf_teks(self, awal_teks, akhir_teks=None, n=1):
    """Hapus paragraf yang dimulai dengan teks `awal_teks` (awal paragraf RTF) sampai paragraf yang memuat `akhir_teks` (bila None: paragraf yang sama)."""
    hasil = []
    for p in self.semua(awal_teks):
        a = p
        z0 = self.T.find(akhir_teks, p) + len(akhir_teks) - 1 if akhir_teks else p + len(awal_teks) - 1
        if akhir_teks and self.T.find(akhir_teks, p) < 0:
            raise SystemExit('hapus_paragraf_teks: akhir tidak ditemukan: %r' % akhir_teks[:50])
        z = self.T.find('\n', z0)
        hasil.append(_rentang_paragraf(self, a, z) + (b'',))
    if n is not None and len(hasil) != n:
        raise SystemExit('hapus_paragraf_teks: %r ditemukan %d kali, diharapkan %s' % (awal_teks[:50], len(hasil), n))
    return hasil


Dok.rentang_paragraf = _rentang_paragraf
Dok.par_setelah = _par_setelah
Dok.hapus_paragraf = _hapus_paragraf_teks
