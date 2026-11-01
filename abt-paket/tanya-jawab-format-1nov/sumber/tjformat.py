# -*- coding: utf-8 -*-
"""Penata format tanya jawab hand-made (tabel dua kolom) menjadi bentuk ABT (Abt_model::kolom_kode_A4):
pertanyaan di sel KIRI, jawaban di baris bawahnya di sel KANAN diawali "- " (rata kanan di sel kiri). Lebar 4250/8500."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtf2txt import rtf_ke_teks

BS = chr(92)
AKHIR = re.compile(r'\{' + re.escape(BS) + r'trowd[^{}]*?' + re.escape(BS) + r'row \}')
CELLX = re.compile(re.escape(BS) + r'cellx(-?\d+)')
TANDA_TTD = ('#6034#', '#6032#', '#6033#', '#0012#', '#4004#', 'Panitera,', 'Ketua Majelis,', 'Jurusita,', '#8004#', '#8000#')


class Lewat(Exception):
    pass


def baris(raw):
    """-> list of dict(start, end, header(bool), cells[list of raw cell], lebar)"""
    hasil = []
    pos = 0
    for m in AKHIR.finditer(raw):
        pot = raw[pos:m.start()]
        header = False
        start = pos
        isi_awal = 0
        i0 = pot.rfind(BS + 'trowd')
        if i0 >= 0:
            mm = None
            for mm in CELLX.finditer(pot, i0):
                pass
            if mm:
                header = True
                start = pos + i0
                isi_awal = mm.end()
        isi = pot[isi_awal:]
        bagian = re.split(r'\\cell(?![a-zA-Z])', isi)
        sel = bagian[:-1]
        # sel ke-2 dst diawali penutup grup "}" dari \cell sebelumnya
        sel2 = []
        for k, s in enumerate(sel):
            if k > 0:
                s = re.sub(r'^\s*\}', '', s, count=1)
            sel2.append(s)
        hasil.append(dict(start=start, end=m.end(), header=header, cells=sel2, lebar=[int(x) for x in CELLX.findall(m.group(0))], pot=pot))
        pos = m.end()
    return hasil


def teks(cell):
    return rtf_ke_teks(cell).strip()


def jenis_baris(b):
    if len(b['cells']) != 2 or len(b['lebar']) != 2:
        return 'x'
    a, z = teks(b['cells'][0]), teks(b['cells'][1])
    NL3 = chr(10) * 3
    if (NL3[:2] in a) or (NL3[:2] in z):
        return 'ttd'
    if a and not z:
        return 'L'
    if z and not a:
        return 'R'
    if a and z:
        return 'B'
    return '0'


def kelompok(raw):
    """Run baris berurutan (end == start berikut atau header baru tepat sesudah). -> list of list"""
    bs = baris(raw)
    runs, cur = [], []
    for b in bs:
        # bersambung bila potongan sebelum header (jika ada) hanya spasi/kosong
        if cur:
            sebelum = raw[cur[-1]['end']:b['start']]
            if sebelum.strip() == '':
                cur.append(b)
                continue
            runs.append(cur)
            cur = []
        cur.append(b)
    if cur:
        runs.append(cur)
    return runs


def region_qa(raw):
    """-> list of (rows, bentuk) yang layak diubah: sub-run baris berurutan L/R/B yang memuat pasangan pertanyaan-jawaban 'LR'."""
    hasil = []
    for run in kelompok(raw):
        jenis = [jenis_baris(b) for b in run]
        k = 0
        while k < len(run):
            if jenis[k] not in ('L', 'R', 'B'):
                k += 1
                continue
            z = k
            while z < len(run) and jenis[z] in ('L', 'R', 'B'):
                z += 1
            s = ''.join(jenis[k:z])
            if 'LR' in s:
                if s[0] == 'R':
                    raise Lewat('tabel diawali jawaban: ' + s)
                for q, j in enumerate(s):
                    if j == 'R' and s[q - 1] != 'L':
                        raise Lewat('baris jawaban tanpa pertanyaan sebelumnya: ' + s)
                hasil.append((run[k:z], s))
            k = z
    return hasil


def _seimbangkan(isi):
    """Satu paragraf: isi run-run. \cell berada DI DALAM grup terakhir "{props \cell }" -> ada satu '{' tak tertutup."""
    depth = 0
    k = 0
    while k < len(isi):
        c = isi[k]
        if c == BS:
            k += 2
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        k += 1
    if depth < 0:
        raise Lewat('kurung penutup berlebih dalam sel')
    if depth > 0:
        if depth != 1:
            raise Lewat('kedalaman kurung sel %d' % depth)
        j = isi.rfind('{')
        sisa = isi[j:]
        if rtf_ke_teks(sisa + '}').strip() == '':
            isi = isi[:j]
        else:
            isi = isi + '}'
    return isi


RUN_PAR = re.compile(r'\{(?:\\[a-zA-Z]+-?\d* ?)*\\par \}\s*$')


def pecah_sel(cell):
    """-> (head, isi): head = pengaturan paragraf pertama; isi = run-run seluruh paragraf BERISI, dipisah \\par
    (paragraf kosong = baris kosong di dalam sel dibuang)."""
    bagian = [x for x in re.split(r'(?=\\pard(?![a-zA-Z]))', cell) if x.strip()]
    head = ''
    paras = []
    for k, p in enumerate(bagian):
        j = p.find('{')
        h = p[:j] if j >= 0 else p
        isi = p[j:] if j >= 0 else ''
        if k == 0:
            head = h
        if j < 0 and h.strip() and not h.startswith(BS + 'pard'):
            raise Lewat('sel berisi teks di luar grup')
        isi = _seimbangkan(isi)
        isi = RUN_PAR.sub('', isi)
        if rtf_ke_teks(isi).strip():
            paras.append(isi)
    return head, (BS + 'par ').join(paras)



KATA_PARAGRAF = re.compile(r'\\(?:pard|plain|q[ljcr]|fi-?\d+|li-?\d+|ri-?\d+|lin-?\d+|rin-?\d+|sa\d+|sb\d+|sl-?\d+|slmult\d+|lisa\d+|lisb\d+|widctlpar|intbl|itap\d+|tql|tqr|tx-?\d+|keepn|keep|nowidctlpar|faauto|adjustright|aspalpha|aspnum|ltrpar|rtlpar|s\d+)(?![a-zA-Z])\s?')


def prop_run(isi):
    """Properti grup run pertama pada isi (kata kendali sebelum teks), untuk menulis tanda '- ' dengan huruf yang sama."""
    m = re.match(r'\s*\{((?:\\[a-zA-Z]+-?\d*\s?)+)', isi)
    return m.group(1) if m else ''


def lebar_abt():
    return 4250, 8500


def K(s):
    # s memakai '/' sebagai pengganti garis miring terbalik
    return s.replace('/', BS)


def kode_baris(irow, last):
    l1, l2 = lebar_abt()
    return K('/trowd/irow%d/irowband%d%s/trgaph0/trleft0/trftsWidth1 ' % (irow, irow, '/lastrow' if last else '') +
             '/trftsWidthB3/trftsWidthA3/trpaddfl3/trpaddft3/trpaddfr3/trpaddfb3 ' +
             '/clvertalt/clftsWidth3/clwWidth%d/cellx%d ' % (l1, l1) +
             '/clvertalt/clftsWidth3/clwWidth%d/cellx%d/row ' % (l1, l2))


def baris_tanya(isi):
    return K('/pard/intbl/widctlpar/qj/sl360/slmult1 ') + isi + K(' /cell/cell ') + kode_baris(0, False)


def baris_jawab(isi_jawab, prop):
    return (K('/pard/intbl/widctlpar/qr/ri100/sl360/slmult1 {') + prop + K('- }/cell/pard/intbl/widctlpar/qj/sl360/slmult1 ') +
            isi_jawab + K(' /cell ') + kode_baris(1, True))


def bangun_region(rows, bentuk):
    """-> teks RTF baru pengganti raw[rows[0].start : rows[-1].end]"""
    keluar = []
    for k, (b, j) in enumerate(zip(rows, bentuk)):
        h1, i1 = pecah_sel(b['cells'][0])
        h2, i2 = pecah_sel(b['cells'][1])
        if j == 'L':
            if i2.strip() and teks(i2):
                raise Lewat('sel kanan baris tanya berisi')
            keluar.append(baris_tanya(i1))
        elif j == 'R':
            if teks(i1):
                raise Lewat('sel kiri baris jawab berisi')
            keluar.append(baris_jawab(i2, prop_run(i2) or prop_run(i1)))
        elif j == 'B':
            keluar.append(baris_tanya(i1))
            keluar.append(baris_jawab(i2, prop_run(i2) or prop_run(i1)))
    return ''.join(keluar)
