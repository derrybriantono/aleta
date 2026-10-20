# -*- coding: utf-8 -*-
"""Pustaka penyusun blangko RTF Derry paket w3b-blangko-baru-kuasa-wali (agen W3b, 21 Okt 2026).

Berkas dasar = RTF blangko Derry TERBARU dari pohon server (salinan di W3B_ASLI, default D:/aleta-dev/kerja/w3b-asli-server).
Semua penyusunan bekerja per PARAGRAF: gaya paragraf berkas dasar dipertahankan, hanya teksnya diganti (alat/bangun.py::Dok).

Alat utama
  Berkas(path)                       baca berkas dasar; .t[i] = teks tampak paragraf i; .cari(regex, mulai) -> indeks
  Rakit(berkas)                      penampung keluaran: .raw(i) salin paragraf i; .teks(i, teks, label) paragraf i berteks baru;
                                     .selesai(path) menulis RTF utuh
  ganti_umum(teks, aturan)           penggantian frasa jenis-spesifik pada paragraf yang dibiarkan
  periksa_berkas(path, ...)          pemeriksa keluaran (penanda dikenal, tanpa sisa kata jenis lama)
"""
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
AKAR = os.path.dirname(SINI)
sys.path.insert(0, os.path.join(AKAR, 'alat'))
from bangun import Dok, simpan, esc, lp  # noqa: E402
import rtf_peta as RP  # noqa: E402

ASLI = os.environ.get('W3B_ASLI', 'D:/aleta-dev/kerja/w3b-asli-server')
KELUAR = os.path.join(AKAR, 'rtf', 'derry_briantono')


class Berkas(object):
    def __init__(self, path):
        self.path = path
        self.d = Dok(path)
        self.n = len(self.d.par)
        self.t = [self.d.isi(i) for i in range(self.n)]

    def cari(self, rx, mulai=0, akhir=None):
        """Indeks paragraf pertama (>= mulai, < akhir) yang teksnya cocok dengan regex; None bila tidak ada."""
        r = re.compile(rx, re.S)
        for i in range(mulai, self.n if akhir is None else akhir):
            if r.search(self.t[i]):
                return i
        return None

    def semua(self, rx, mulai=0, akhir=None):
        r = re.compile(rx, re.S)
        return [i for i in range(mulai, self.n if akhir is None else akhir) if r.search(self.t[i])]

    def punya_label(self, i):
        return '\\listtext' in self.d.par[i]


class Rakit(object):
    def __init__(self, b):
        self.b = b
        self.out = []
        self.log = []

    def raw(self, i):
        self.out.append(self.b.d.par[i])

    def teks(self, i, teks, label=None):
        self.out.append(self.b.d.ganti_teks(i, teks, label))

    def nomor(self, i, n, teks):
        """Paragraf berbutir 'n.<tab>teks' memakai gaya paragraf i (label daftar bila ada, selain itu nomor di teks)."""
        if self.b.punya_label(i):
            self.out.append(self.b.d.ganti_teks(i, teks, '%d.' % n))
        else:
            self.out.append(self.b.d.ganti_teks(i, '%d.\t%s' % (n, teks)))

    def frasa(self, i, pasangan):
        """Paragraf i dengan frasa-frasa diganti (lama -> baru) lewat peta RTF: menjaga gaya/ragam huruf paragraf, tahan teks terpecah."""
        p = self.b.d.par[i]
        for lama, baru in pasangan:
            if lama in RP.peta(p)[0]:
                p, _ = RP.ganti(p, lama, baru)
        self.out.append(p)

    def selesai(self, path, tokens_asal=None):
        """Tulis RTF utuh. Penanda isian-asal ({\*\isianasal ...}) dirapikan: penanda khusus jenis lama (nafkah anak) dibuang, isian paket ini yang
        dipakai teks ditambahkan; tokens_asal (daftar nomor) memaksa isian tertentu masuk daftar (mis. isian bahan jawaban saksi di BAS)."""
        isi = self.b.d.rakit(self.out)
        isi = perbaiki_isianasal(isi, tokens_asal)
        simpan(path, isi)
        return isi


def baca_semua(folder):
    """{nama berkas: Berkas}"""
    hasil = {}
    for f in sorted(os.listdir(folder)):
        if f.lower().endswith('.rtf'):
            hasil[f] = Berkas(os.path.join(folder, f))
    return hasil


# ------------------------------------------------------------------------------------------------------------------
# Penggantian frasa umum (paragraf yang dibiarkan dari berkas dasar 6c Nafkah Anak)
# ------------------------------------------------------------------------------------------------------------------
def ganti_umum(teks, label, aturan=None):
    """label: sebutan perkara huruf kecil, mis. 'pencabutan kekuasaan orang tua'."""
    t = teks
    t = t.replace('sengketa nafkah anak a quo', 'sengketa %s a quo' % label)
    t = t.replace('persoalan nafkah anak secara kekeluargaan', 'persoalan %s secara kekeluargaan' % label)
    t = t.replace('dalam perkara nafkah anak', 'dalam perkara %s' % label)
    t = t.replace('khusus dalam perkara nafkah anak', 'khusus dalam perkara %s' % label)
    t = re.sub(r'mengajukan (#0053#|#8728#) nafkah anak,', lambda m: 'mengajukan %s %s,' % (m.group(1), label), t)
    t = t.replace('dengan nafkah anak yang disengketakan', 'dengan %s yang disengketakan' % label)
    for k, v in (aturan or []):
        t = t.replace(k, v)
    return t


SISA_JENIS_LAMA = re.compile(r'nafkah|9300|9301|9302|9304|9759|974\d|975\d|hadhanah|hak asuh|penguasaan anak', re.I)


# ------------------------------------------------------------------------------------------------------------------
# Isian milik paket yang dipakai sebuah RTF (termasuk yang hanya dibaca kueri variabel lain)
# ------------------------------------------------------------------------------------------------------------------
_ASAL = chr(92) + '*' + chr(92) + 'isianasal '
RX_ASAL = re.compile(re.escape('{' + _ASAL) + r'([^}]*)\}')
LAMA_KHUSUS = set(range(9740, 9760)) | set(range(9300, 9310))


def _indeks_var():
    import variabel_def as V
    return {x['no']: x for x in V.VAR}


def isian_diperlukan(isi_rtf):
    """Nomor isian (data_teks / data_tanggal) milik paket yang dipakai teks, termasuk ketergantungan lewat kueri variabel paket."""
    idx = _indeks_var()
    pakai = set(int(t) for t in re.findall(r'#(\d{4})#', isi_rtf) if 3800 <= int(t) <= 3999)
    antri = list(pakai)
    while antri:
        x = idx.get(antri.pop())
        if not x or not x['sql']:
            continue
        for a, b in re.findall(r'#(\d{4})#|no_var = (\d{4})', x['sql']):
            n = int(a or b)
            if 3800 <= n <= 3999 and n not in pakai:
                pakai.add(n)
                antri.append(n)
    return sorted(n for n in pakai if idx.get(n, {}).get('tipe') in ('data_teks', 'data_tanggal'))


def perbaiki_isianasal(isi, tokens_asal=None):
    m = RX_ASAL.search(isi)
    if not m:
        return isi
    lama = [int(t) for t in re.findall(r'#(\d{4})#', m.group(1))]
    baru = [n for n in lama if n not in LAMA_KHUSUS]
    for n in list(isian_diperlukan(isi[:m.start()] + isi[m.end():])) + [int(x) for x in (tokens_asal or [])]:
        if n not in baru:
            baru.append(n)
    return isi[:m.start()] + '{' + _ASAL + ' '.join('#%04d#' % n for n in baru) + '}' + isi[m.end():]
