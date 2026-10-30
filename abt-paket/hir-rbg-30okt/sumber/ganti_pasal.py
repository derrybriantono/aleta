# -*- coding: utf-8 -*-
"""Mesin penggantian rujukan pasal RBg -> variabel padanan (G6 6.1).

Satu rujukan = "Pasal <butir>[, <butir>]... [dan <butir>] RBg" dengan butir = [Pasal ]<nomor>[-<nomor>][ ayat (<n>)[ dan ayat (<n>)]...].
Rujukan diganti HANYA bila SEMUA pasal dan ayatnya PASTI berpadanan (sumber/padanan.py):
   nomor pasal  -> #<var nomor pasal># (hasil '149' untuk RBg, '125' untuk HIR)
   ayat beda    -> #<var nomor ayat># (mis. 192 ayat (3) RBg = 181 ayat (2) HIR); ayat sama -> tetap tertulis
   "RBg"        -> #11851# (hasil 'RBg' / 'HIR')
Bentuk lain ("R.Bg.", "Rbg", nama panjang "Reglemen Acara Hukum ...") TIDAK diubah (keluaran Donggala harus identik) - dicatat.
"""
import re

from padanan import PASAL, padanan

NO_PENANDA = 11850
NO_KODE = 11851
NO_WILAYAH = 11852

# Kalimat berisi kata RBg tanpa nomor pasal yang BENAR juga untuk HIR (HIR pun tidak mengaturnya) / yang menyebut wilayahnya.
# (asal persis, pengganti) - hanya bila tertulis utuh sebagai teks biasa.
KALIMAT = [
    ('berada di luar Jawa dan Madura, hukum acara yang berlaku adalah RBg', 'berada #11852#, hukum acara yang berlaku adalah #11851#'),
    ('RBg tidak mengatur secara tegas', '#11851# tidak mengatur secara tegas'),
    ('tidak diatur dalam RBg,', 'tidak diatur dalam #11851#,'),
]

RE_RUJUKAN = re.compile(
    r'(?<![A-Za-z0-9#])Pasal\s+'
    r'((?:\d{1,3}[a-z]?(?:\s*-\s*\d{1,3}[a-z]?)?)'
    r'(?:\s+[Aa]yat\s+\(\d+\)(?:\s*(?:,|dan|,\s*dan)\s+[Aa]yat\s+\(\d+\))*)?'
    r'(?:\s*(?:,|dan|,\s*dan)\s+(?:Pasal\s+)?\d{1,3}[a-z]?(?:\s*-\s*\d{1,3}[a-z]?)?(?:\s+[Aa]yat\s+\(\d+\)(?:\s*(?:,|dan|,\s*dan)\s+[Aa]yat\s+\(\d+\))*)?)*)'
    r'\s+RBg(?![A-Za-z])')

RE_TOKEN = re.compile(r'(\d{1,3}[a-z]?)|([Aa]yat\s+\((\d+)\))')


class Alokasi:
    """Nomor variabel padanan: pasal & ayat-beda, berurutan 11852.. sesuai urutan pertama dipakai (deterministik bila masukan urut)."""

    def __init__(self, mulai=11853, akhir=11899):
        self.pasal = {}
        self.ayat = {}
        self.berikut = mulai
        self.akhir = akhir

    def _baru(self):
        n = self.berikut
        assert n <= self.akhir, 'blok variabel 11852-11899 habis'
        self.berikut += 1
        return n

    def no_pasal(self, rbg):
        if rbg not in self.pasal:
            self.pasal[rbg] = self._baru()
        return self.pasal[rbg]

    def no_ayat(self, rbg, ayat):
        k = (rbg, ayat)
        if k not in self.ayat:
            self.ayat[k] = self._baru()
        return self.ayat[k]


def uraikan(inti):
    """inti rujukan -> daftar (pasal, [ayat...]) dan bentuk templat token; None bila ada yang tidak dikenali."""
    butir = []
    for m in RE_TOKEN.finditer(inti):
        if m.group(1):
            butir.append([m.group(1), []])
        else:
            if not butir:
                return None
            butir[-1][1].append(m.group(3))
    return butir


def templat(inti, alokasi, rekam=None):
    """Templat pengganti inti rujukan (tanpa kata 'Pasal' depan dan 'RBg'), atau (None, sebab)."""
    butir = uraikan(inti)
    if not butir:
        return None, 'tidak terurai'
    # pasal dalam rentang a-b: kedua ujung pasti & selisih HIR = selisih RBg
    for m in re.finditer(r'(\d{1,3})\s*-\s*(\d{1,3})', inti):
        a, b = m.group(1), m.group(2)
        pa, pb = padanan(a), padanan(b)
        if not pa or not pb or not pa[0].isdigit() or not pb[0].isdigit() or int(pb[0]) - int(pa[0]) != int(b) - int(a):
            return None, 'rentang %s-%s belum pasti' % (a, b)
        for x in range(int(a) + 1, int(b)):
            if not padanan(str(x)):
                return None, 'pasal %d di rentang belum pasti' % x
    for p, ayat in butir:
        if not padanan(p):
            e = PASAL.get(p)
            return None, 'pasal %s %s' % (p, e['status'] if e else 'belum ada di tabel padanan')
        for a in ayat:
            pd = padanan(p, a)
            if pd is None or pd[1] == '':
                return None, 'pasal %s ayat (%s) belum pasti' % (p, a)
    # susun: ganti tiap token angka/ayat di posisinya
    keluar = []
    pos = 0
    sekarang = None
    for m in RE_TOKEN.finditer(inti):
        keluar.append(inti[pos:m.start()])
        if m.group(1):
            sekarang = m.group(1)
            keluar.append('#%d#' % alokasi.no_pasal(sekarang))
        else:
            a = m.group(3)
            hir_a = padanan(sekarang, a)[1]
            if hir_a == a:
                keluar.append(m.group(2))
            else:
                keluar.append(m.group(2).replace('(%s)' % a, '(#%d#)' % alokasi.no_ayat(sekarang, a)))
        pos = m.end()
    keluar.append(inti[pos:])
    if rekam is not None:
        for p, ayat in butir:
            rekam.add(p)
    return ''.join(keluar), ''


def ganti_teks(teks, alokasi, catat):
    """Ganti semua rujukan PASTI dalam teks polos (dipakai untuk kueri SQL). catat(list) menerima (asal, hasil|None, sebab)."""
    hasil = []
    pos = 0
    for m in RE_RUJUKAN.finditer(teks):
        t, sebab = templat(m.group(1), alokasi)
        hasil.append(teks[pos:m.start()])
        if t is None:
            hasil.append(m.group(0))
            catat.append((m.group(0), None, sebab))
        else:
            baru = 'Pasal %s #%d#' % (t, NO_KODE)
            # spasi asli antara inti dan RBg dipertahankan
            antara = m.group(0)[m.end(1) - m.start():len(m.group(0)) - 3]
            baru = 'Pasal ' + t + antara + '#%d#' % NO_KODE
            sela = m.group(0)[len('Pasal'):m.start(1) - m.start()]
            baru = 'Pasal' + sela + t + antara + '#%d#' % NO_KODE
            hasil.append(baru)
            catat.append((m.group(0), baru, ''))
        pos = m.end()
    hasil.append(teks[pos:])
    return ''.join(hasil)




def rencana_rtf(raw, alokasi, catat):
    """Daftar ubahan [(awal, akhir, pengganti)] pada RTF MENTAH (koordinat asli), tidak tumpang tindih, urut naik.
    Hanya rujukan/kalimat yang tertulis UTUH sebagai teks biasa (boleh terpotong CR/LF berkas, yang tidak bermakna di RTF);
    yang diselingi kode RTF dilewati dan dicatat."""
    idx = [i for i, ch in enumerate(raw) if ch not in '\r\n']
    rata = ''.join(raw[i] for i in idx)
    ubah = []
    for m in RE_RUJUKAN.finditer(rata):
        s, e = idx[m.start()], idx[m.end() - 1] + 1
        if re.search(r'[\\{}]', raw[s:e]):
            catat.append((m.group(0), None, 'diselingi kode RTF'))
            continue
        t, sebab = templat(m.group(1), alokasi)
        if t is None:
            catat.append((m.group(0), None, sebab))
            continue
        sela = m.group(0)[len('Pasal'):m.start(1) - m.start()]
        antara = m.group(0)[m.end(1) - m.start():len(m.group(0)) - 3]
        baru = 'Pasal' + sela + t + antara + '#%d#' % NO_KODE
        ubah.append((s, e, baru))
        catat.append((m.group(0), baru, ''))
    for asal, pengganti in KALIMAT:
        for m in re.finditer(re.escape(asal), rata):
            s, e = idx[m.start()], idx[m.end() - 1] + 1
            if re.search(r'[\\{}]', raw[s:e]):
                catat.append((asal, None, 'diselingi kode RTF'))
                continue
            if any(not (e <= a or s >= b) for a, b, _ in ubah):
                continue
            ubah.append((s, e, pengganti))
            catat.append((asal, pengganti, ''))
    ubah.sort()
    return ubah


def terapkan(raw, ubah):
    keluar = []
    pos = 0
    for s, e, baru in ubah:
        assert s >= pos
        keluar.append(raw[pos:s])
        keluar.append(baru)
        pos = e
    keluar.append(raw[pos:])
    return ''.join(keluar)


def ganti_rtf(raw, alokasi, catat):
    return terapkan(raw, rencana_rtf(raw, alokasi, catat))
