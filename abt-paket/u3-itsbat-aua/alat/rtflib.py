# -*- coding: utf-8 -*-
"""Pustaka kecil untuk menyunting RTF blangko Derry pada tingkat paragraf (agen U3, 20 Okt 2026).
Paragraf = potongan mentah dari paragraf.pecah(); teks polos lewat rtf2txt. Semua pekerjaan atas str latin1 (bita apa adanya)."""
import re, sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paragraf import pecah  # noqa: E402
from rtf2txt import rtf_ke_teks  # noqa: E402

BS = chr(92)


def esc(t):
    """Teks -> RTF: \\ { } diloloskan, tab -> \\tab, non-ASCII -> \\'xx (cp1252)."""
    out = []
    for ch in t:
        if ch in BS + '{}':
            out.append(BS + ch)
        elif ch == '\n':
            out.append(BS + 'line ')
        elif ch == '\t':
            out.append(BS + 'tab ')
        elif ord(ch) < 128:
            out.append(ch)
        else:
            out.append(BS + "'%02x" % ch.encode('cp1252')[0])
    return ''.join(out)


def polos(p):
    return rtf_ke_teks('{' + p + '}').replace('\n', ' ').strip()


class Berkas:
    def __init__(self, path):
        raw = open(path, 'rb').read().decode('latin1')
        self.kepala, self.par, self.ekor = pecah(raw)
        self.asal = path

    def cari(self, potongan, mulai=0, ke_akhir=False):
        """Indeks paragraf pertama (atau terakhir) yang teks polosnya memuat `potongan`."""
        hasil = [i for i in range(mulai, len(self.par)) if potongan in polos(self.par[i])]
        if not hasil:
            raise KeyError('paragraf tidak ditemukan: %s' % potongan[:80])
        return hasil[-1] if ke_akhir else hasil[0]

    def teks(self, i):
        return polos(self.par[i])

    def simpan(self, path):
        data = (self.kepala + ''.join(self.par) + self.ekor).encode('latin1')
        open(path, 'wb').write(data)
        return data


def _awalan(p):
    j = p.index('{')
    return p[:j]


def _run_props(p):
    """Properti run pertama paragraf (tanpa teks) untuk dipakai ulang."""
    m = re.search(r'\{((?:\\(?!par\b)[^\s{}\\]+ ?)+)', p[p.index('{'):])
    return m.group(1) if m else ''


def buat_dari(p_contoh, teks, tebal_awal=False):
    """Paragraf baru bergaya sama dengan p_contoh: awalan paragraf + satu run berisi `teks` + penutup \\par.
    Daftar bernomor (\\listtext) dibuang; nomor ditulis literal di `teks` (mis. '1.\\t...')."""
    aw = _awalan(p_contoh)
    aw = re.sub(r'\\ls\d+ ', '', aw)
    # run teks pertama yang BUKAN \listtext
    grup = re.findall(r'\{(?!\\listtext)((?:\\[a-zA-Z0-9]+ ?)+)', p_contoh)
    props = grup[0] if grup else ''
    props = re.sub(r'\\par ?', '', props)
    return aw + '{' + props + esc(teks) + '}{' + props + BS + 'par }'


def ganti_teks(p, lama, baru):
    """Ganti `lama` dengan `baru` (teks biasa, di-escape) di dalam run paragraf. Gagal bila tidak ditemukan."""
    el, eb = esc(lama), esc(baru)
    if el not in p:
        raise KeyError('teks tidak ada di paragraf: %s' % lama[:70])
    return p.replace(el, eb)


def ganti_semua(p, pasangan):
    """Terapkan beberapa penggantian (teks biasa); yang tidak ada diabaikan. Mengembalikan (p_baru, jumlah_terpakai)."""
    n = 0
    for lama, baru in pasangan:
        el, eb = esc(lama), esc(baru)
        if el in p:
            p = p.replace(el, eb)
            n += 1
    return p, n


def _grup_atas(isi):
    """Potong `isi` (sesudah awalan paragraf) menjadi grup {..} tingkat atas; teks di luar grup dikembalikan apa adanya."""
    hasil = []
    i = 0
    n = len(isi)
    while i < n:
        if isi[i] == '{':
            d = 0
            j = i
            while j < n:
                c = isi[j]
                if c == BS and j + 1 < n and isi[j + 1] in BS + '{}':
                    j += 2
                    continue
                if c == '{':
                    d += 1
                elif c == '}':
                    d -= 1
                    if d == 0:
                        break
                j += 1
            hasil.append(isi[i:j + 1])
            i = j + 1
        else:
            k = isi.find('{', i)
            k = n if k < 0 else k
            hasil.append(isi[i:k])
            i = k
    return hasil


def ubah_teks(p, fn):
    """Ubah teks paragraf dengan fn(teks)->teks. Bila hasil sama, paragraf dikembalikan apa adanya; bila beda, semua run
    digabung menjadi satu run (gaya run pertama), daftar bernomor (listtext) dipertahankan."""
    aw = _awalan(p)
    grup = _grup_atas(p[len(aw):])
    if any(m in p for m in (BS + 'trowd', BS + 'cell', BS + 'row ', BS + 'row}')):
        # paragraf tabel: struktur sel/baris dipertahankan; hanya teks per run yang diubah (frasa lintas run tidak terjangkau)
        baru = []
        for g in grup:
            if g.startswith('{') and g.count('{') == 1 and not any(m in g for m in (BS + 'cell', BS + 'row', BS + 'trowd', BS + 'listtext', BS + 'par ')):
                m = re.match(r'(\{(?:\\[a-zA-Z0-9]+ ?)+)(.*)\}$', g, re.S)
                if m:
                    lama = rtf_ke_teks(g)
                    baru_t = fn(lama)
                    g = (m.group(1) + esc(baru_t) + '}') if baru_t != lama else g
            baru.append(g)
        return aw + ''.join(baru)
    daftar = [g for g in grup if g.startswith('{' + BS + 'listtext')]
    run = [g for g in grup if g.startswith('{') and not g.startswith('{' + BS + 'listtext')]
    teks_lama = ''.join(rtf_ke_teks(g) for g in run).replace('\r', '')
    while teks_lama.endswith('\n'):  # \par penutup
        teks_lama = teks_lama[:-1]
    teks_baru = fn(teks_lama)
    if teks_baru == teks_lama:
        return p
    props = ''
    for g in run:
        m = re.match(r'\{((?:\\[a-zA-Z0-9]+ ?)+)', g)
        if m and BS + 'par' not in m.group(1):
            props = m.group(1)
            break
    props = re.sub(r'\\i1 ?|\\b1 ?', '', props)
    return aw + ''.join(daftar) + '{' + props + esc(teks_baru) + '}{' + props + BS + 'par }'
