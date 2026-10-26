#!/usr/bin/env python3
# Membangun enam berkas RTF blangko Derry (dua blangko x tiga ukuran kertas):
#   rtf/Sampul Berkas Perkara.rtf   (+ " (F4)", " (Legal)")
#   rtf/Daftar Isi Berkas.rtf       (+ " (F4)", " (Legal)")
# Isian memakai penanda #NNNN# gaya ABT. TIDAK ada nama aplikasi di isi RTF. Hanya menulis ke folder rtf/ paket ini.
# Jalankan:  python -I alat/bangun_rtf.py
#
# Tata letak sampul (keputusan Derry 26 Okt: "riwayat sidang paling utama"): kop, judul dan nomor, ciri, RIWAYAT SIDANG (bagian terbesar:
# judul gelap, lima kolom NO / TGL SIDANG / HADIR / AGENDA / ALASAN, baris tinggi), lalu blok lain dipadatkan (pihak, majelis dan petugas,
# tanggal penting, pokok perkara menurut jenis, putusan). Cerai tidak punya blok pokok perkara; jenis lain mendapat blok dari #5843#.
import os

LEBAR = 10506           # lebar isi dalam twip (margin 700; A4)
HAL = (11906, 16838)   # diganti per ukuran lewat KERTAS
KERTAS = {   # kode: (akhiran nama berkas, lebar twip, tinggi twip, baris riwayat sidang)
    'a4': ('', 11906, 16838, 12),                 # 210 x 297 mm
    'f4': (' (F4)', 12189, 18709, 15),            # 215 x 330 mm (Folio)
    'legal': (' (Legal)', 12246, 20183, 18),      # 216 x 356 mm
}
TINGGI_BARIS = {'a4': 395, 'f4': 435, 'legal': 450}   # tinggi minimum baris riwayat (twip); A4 dipadatkan agar satu lembar penuh bahkan untuk itsbat (blok khas + dua pemohon)
KODE_RIWAYAT = 5700   # baris n (mulai 1), kolom c (0 tgl, 1 hadir, 2 agenda, 3 alasan): 5700 + (n-1)*4 + c  -> sampai 5779 (20 baris)


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


def run(t, b=False, i=False, sz=None, sp=None, cf=None):
    # t boleh memuat penanda #NNNN# - ikut apa adanya
    pre = ''
    if b: pre += '\\b'
    if i: pre += '\\i'
    if sz: pre += '\\fs%d' % sz
    if sp: pre += '\\expndtw%d' % sp
    if cf: pre += '\\cf%d' % cf
    if not pre:
        return esc(t)
    return '{' + pre + ' ' + esc(t) + '}'


def par(segs, al='l', sb=0, sa=0, sz=18, intbl=None, keepn=False, brdb=False):
    # intbl: None = paragraf biasa; 'mid' = dalam sel (bukan terakhir, berakhir \par); True = paragraf TERAKHIR sel (berakhir \cell)
    if isinstance(segs, str):
        segs = [esc(segs)]
    a = {'l': '\\ql', 'c': '\\qc', 'r': '\\qr', 'j': '\\qj'}[al]
    s = '\\pard\\plain' + ('\\intbl' if intbl else '') + a + '\\f0\\fs%d' % sz
    s += '\\sb%d\\sa%d' % (sb, sa)
    if keepn: s += '\\keepn'
    if brdb: s += '\\brdrb\\brdrs\\brdrw10\\brsp20'
    akhir = '\\cell' if intbl is True else '\\par'
    return s + ' ' + ''.join(segs) + akhir + '\n'


def cell_def(x, brd=(1, 1, 1, 1), w=10, shade=None, valign='t'):
    s = ''
    for n, on in zip(('t', 'l', 'b', 'r'), brd):
        if on:
            s += '\\clbrdr%s\\brdrs\\brdrw%d' % (n, on if on > 1 else w)
    if shade: s += '\\clcbpat%d' % shade
    s += {'t': '\\clvertalt', 'c': '\\clvertalc', 'b': '\\clvertalb'}[valign]
    return s + '\\cellx%d' % x


def tabel(baris):
    out = ''
    for r in baris:
        out += '\\trowd\\trgaph60\\trleft0'
        if r.get('tinggi'): out += '\\trrh%d' % r['tinggi']
        if r.get('jaga', True): out += '\\trkeep'
        x = 0
        for k, w in enumerate(r['lebar']):
            x += w
            brd = r['brd'][k] if 'brd' in r else (10, 10, 10, 10)
            sh = r['shade'][k] if 'shade' in r else None
            va = r['va'][k] if 'va' in r else 't'
            out += cell_def(x, tuple(1 if v else 0 for v in brd), w=(max(brd) if max(brd) > 1 else 10), shade=sh, valign=va)
        out += '\n'
        for c in r['sel']:
            out += c
        out += '\\row\n'
    return out


def sel(paragrafs):
    if isinstance(paragrafs, str):
        paragrafs = [paragrafs]
    return ''.join(paragrafs)


def p_sel(segs, **kw):
    return par(segs, intbl=True, **kw)


def kepala_rtf():
    return ('{\\rtf1\\ansi\\ansicpg1252\\deff0\\deflang1057\n'
            '{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}\n'
            '{\\colortbl;\\red0\\green0\\blue0;\\red230\\green240\\blue243;\\red243\\green244\\blue246;\\red20\\green24\\blue31;\\red255\\green255\\blue255;}\n'
            '\\paperw%d\\paperh%d\\margl700\\margr700\\margt600\\margb600\\widowctrl\n' % HAL)


def judul_bagian(teks, ket=None, sb=100):
    segs = [run(teks, b=True, sz=14, sp=40)]
    if ket: segs.append(run('   ' + ket, sz=13))
    return par(segs, sb=sb, sa=30, keepn=True, brdb=True)


K_SEL = (10, 10, 10, 10)


def pilih_kertas(kertas):
    global HAL
    HAL = (KERTAS[kertas][1], KERTAS[kertas][2])


# --------------------------------------------------------------------------------------------------------------------
def sampul(kertas='a4'):
    pilih_kertas(kertas)
    baris_riwayat = KERTAS[kertas][3]
    s = kepala_rtf()
    # kop
    s += tabel([{
        'lebar': [7300, LEBAR - 7300], 'brd': [(0, 0, 20, 0), (20, 20, 20, 20)], 'va': ['c', 'c'],
        'sel': [sel([par([run('#8010#', b=True, sz=24, sp=20)], intbl='mid'), p_sel([run('Berkas perkara tingkat pertama', sz=15)])]),
                sel([p_sel([run('BUNDEL A', b=True, sz=22, sp=40)], al='c')])],
    }])
    # judul (kiri) dan nomor perkara (kanan, ringkas)
    s += tabel([{
        'lebar': [5400, LEBAR - 5400], 'brd': [(0, 0, 0, 0), (30, 30, 30, 30)], 'va': ['c', 'c'],
        'sel': [sel([par([run('SAMPUL BERKAS PERKARA', b=True, sz=14, sp=100)], intbl='mid', sb=80),
                     p_sel([run('#5800#', b=True, sz=34)], sb=20, sa=40)]),
                sel([par([run('PERKARA NOMOR', b=True, sz=13, sp=60)], al='c', intbl='mid', sb=30),
                     par([run('#0001#', b=True, sz=34)], al='c', intbl='mid'),
                     p_sel([run('TAHUN #0191#  -  TERDAFTAR #1061#', sz=14)], al='c', sa=30)])],
    }])
    # fokus perkara (nama anak, pasangan, pewaris, dan seterusnya; kosong untuk cerai)
    s += par([run('#5842#', sz=22)], al='c', sb=100, sa=20)
    # ciri
    s += tabel([{'lebar': [LEBAR], 'brd': [(15, 15, 15, 15)],
                 'sel': [sel([par([run('CIRI PERKARA', b=True, sz=12, sp=60), run('   menyala hanya bila berlaku', sz=12)], intbl='mid', sb=20),
                              p_sel([run('#5801#', b=True, sz=17, sp=10)], sb=20, sa=40)])]}])
    s += par([run('pendaftaran dan biaya [+ / \u25A0]      pihak [* / \u25CF]      proses [> / \u25B2]', sz=13)], sb=20)
    # ===== RIWAYAT SIDANG: bagian terbesar dan paling menonjol =====
    s += par('', sz=8)
    s += tabel([{'lebar': [LEBAR], 'brd': [(30, 30, 0, 30)], 'shade': [4],
                 'sel': [sel(p_sel([run('RIWAYAT SIDANG', b=True, sz=28, sp=160, cf=5), run('     diisi dari jadwal sidang; baris sisa untuk tulisan tangan', sz=13, cf=5)], sb=50, sa=50))]}])
    w5 = [560, 1750, 700, 3700, LEBAR - 560 - 1750 - 700 - 3700]
    br = [(10, 10, 20, 10)] * 5
    kep = {'lebar': w5, 'brd': [(0, 30, 20, 10), (0, 10, 20, 10), (0, 10, 20, 10), (0, 10, 20, 10), (0, 10, 20, 30)], 'shade': [2] * 5,
           'sel': [sel(p_sel([run(t, b=True, sz=14, sp=40)], al=a, sb=30, sa=30)) for t, a in
                   (('NO', 'c'), ('TGL SIDANG', 'l'), ('HADIR', 'c'), ('AGENDA / HASIL', 'l'), ('ALASAN PENUNDAAN / KET.', 'l'))]}
    baris = [kep]
    for n in range(1, baris_riwayat + 1):
        kode = KODE_RIWAYAT + (n - 1) * 4
        akhir = n == baris_riwayat
        b = (0, 30, 30 if akhir else 10, 10)
        baris.append({'lebar': w5, 'tinggi': TINGGI_BARIS[kertas], 'va': ['c'] * 5,
                      'brd': [(0, 30, 30 if akhir else 10, 10), (0, 10, 30 if akhir else 10, 10), (0, 10, 30 if akhir else 10, 10), (0, 10, 30 if akhir else 10, 10), (0, 10, 30 if akhir else 10, 30)],
                      'sel': [sel(p_sel([run(str(n), b=True, sz=22)], al='c')),
                              sel(p_sel([run('#%d#' % kode, sz=22)])),
                              sel(p_sel([run('#%d#' % (kode + 1), b=True, sz=18)], al='c')),
                              sel(p_sel([run('#%d#' % (kode + 2), sz=22)])),
                              sel(p_sel([run('#%d#' % (kode + 3), sz=22)]))]})
    s += tabel(baris)
    s += par([run('HADIR: P = pihak pertama, T = pihak kedua (sandi kehadiran SIPP); kosong = belum dicatat', sz=12)], sb=20)
    # ===== blok lain dipadatkan =====
    half = LEBAR // 2
    s += judul_bagian('PARA PIHAK')
    kiri = sel([
        par([run('#5841#', b=True, sz=12, sp=60)], intbl='mid', sb=20),
        par([run('#0098#', b=True, sz=20)], intbl='mid'),
        par([run('Pekerjaan: #0100#  -  Alamat: #0101#', sz=15)], intbl='mid'),
        par([run('Kuasa: #0106#', sz=14)], intbl='mid', sb=20),
        par([run('#1033#', b=True, sz=17)], intbl='mid', sb=40),
        p_sel([run('#1036#', sz=14)], sa=20),
    ])
    kanan = sel([
        par([run('#8147#', b=True, sz=12, sp=60)], intbl='mid', sb=20),
        par([run('#0102#', b=True, sz=20)], intbl='mid'),
        par([run('Pekerjaan: #0104#  -  Alamat: #0105#', sz=15)], intbl='mid'),
        p_sel([run('Kuasa: #0170#', sz=14)], sb=20, sa=20),
    ])
    s += tabel([{'lebar': [half, LEBAR - half], 'brd': [(15, 15, 15, 15)] * 2, 'sel': [kiri, kanan]}])

    q4 = LEBAR // 4

    def kot(l, v, al='l', sz=15):
        return sel([par([run(l, b=True, sz=11, sp=30)], al=al, intbl='mid', sb=15), p_sel([run(v, b=True, sz=sz)], al=al, sa=15)])
    s += judul_bagian('MAJELIS DAN PETUGAS')
    s += tabel([
        {'lebar': [q4] * 3 + [LEBAR - 3 * q4], 'brd': [K_SEL] * 4,
         'sel': [kot('KETUA MAJELIS', '#0012#'), kot('HAKIM ANGGOTA I', '#0013#'), kot('HAKIM ANGGOTA II', '#0014#'), kot('PANITERA PENGGANTI', '#0015#')]},
        {'lebar': [q4] * 3 + [LEBAR - 3 * q4], 'brd': [K_SEL] * 4,
         'sel': [kot('JURUSITA / PENGGANTI', '#0018#'), kot('MEDIATOR', '#5836#'), kot('HASIL MEDIASI', '#5837#'), kot('KONSEPTOR', '#5839#')]},
    ])
    q6 = LEBAR // 6
    s += judul_bagian('TANGGAL PENTING')
    s += tabel([{'lebar': [q6] * 5 + [LEBAR - 5 * q6], 'brd': [K_SEL] * 6,
                 'sel': [kot('DAFTAR PERKARA', '#1061#', sz=14), kot('PMH', '#1060#', sz=14), kot('PHS', '#1064#', sz=14), kot('PENETAPAN PP / JS', '#0180#', sz=14),
                         kot('PENETAPAN MEDIATOR', '#0055#', sz=14), kot('LAPORAN MEDIATOR', '#8012#', sz=14)]}])
    # pokok perkara menurut jenis (kosong untuk cerai; satu isian bergaris banyak)
    s += par([run('#5843#', sz=16)], sb=80, sa=20)
    s += judul_bagian('PUTUSAN')
    s += tabel([{'lebar': [q4] * 3 + [LEBAR - 3 * q4], 'brd': [K_SEL] * 4,
                 'sel': [kot('TGL PUTUS', '#1069#', 'c', 18), kot('TGL MINUTASI', '#1278#', 'c', 18), kot('TGL PBT', '#5840#', 'c', 18), kot('TGL BHT', '#0168#', 'c', 18)]}])
    s += par([run('#5829#', b=True, sz=16)], sb=60)
    s += par([run('Hijriah putusan: #0038#', sz=13)], sb=40, al='r')
    return s + '}\n'


# --------------------------------------------------------------------------------------------------------------------
def daftar_isi(kertas='a4'):
    pilih_kertas(kertas)
    s = kepala_rtf()
    s += tabel([{
        'lebar': [7300, LEBAR - 7300], 'brd': [(0, 0, 20, 0), (20, 20, 20, 20)], 'va': ['c', 'c'],
        'sel': [sel([par([run('#8010#', b=True, sz=24, sp=20)], intbl='mid'), p_sel([run('Daftar isi berkas perkara tingkat pertama', sz=16)])]),
                sel([p_sel([run('BUNDEL A  /  B', b=True, sz=20, sp=30)], al='c')])],
    }])
    s += par([run('DAFTAR ISI BERKAS', b=True, sz=30, sp=40)], al='c', sb=160)
    s += par([run('Nomor #0001#', b=True, sz=22)], al='c', sa=100)
    half = LEBAR // 2
    s += tabel([
        {'lebar': [half, LEBAR - half], 'brd': [K_SEL] * 2,
         'sel': [sel([par([run('#5841#', b=True, sz=13, sp=50)], intbl='mid', sb=20), p_sel([run('#0098#   #1033#', sz=17)])]),
                 sel([par([run('#8147#', b=True, sz=13, sp=50)], intbl='mid', sb=20), p_sel([run('#0102#', sz=17)])])]},
        {'lebar': [half, LEBAR - half], 'brd': [K_SEL] * 2,
         'sel': [sel([par([run('MAJELIS', b=True, sz=13, sp=50)], intbl='mid', sb=20), p_sel([run('#0012#;  #0013#;  #0014#', sz=16)])]),
                 sel([par([run('PANITERA SIDANG', b=True, sz=13, sp=50)], intbl='mid', sb=20), p_sel([run('#0015#', sz=16)])])]},
        {'lebar': [LEBAR], 'brd': [K_SEL],
         'sel': [sel([par([run('CIRI PERKARA', b=True, sz=13, sp=50)], intbl='mid', sb=20), p_sel([run('#5801#', b=True, sz=16)])])]},
    ])
    s += par('', sz=8)
    wk = [650, 6350, 2000, LEBAR - 650 - 6350 - 2000]
    kep = {'lebar': wk, 'brd': [K_SEL] * 4, 'shade': [2] * 4,
           'sel': [sel(p_sel([run(t, b=True, sz=14, sp=40)], al=a)) for t, a in (('NO', 'c'), ('JENIS DOKUMEN', 'l'), ('TANGGAL', 'l'), ('HALAMAN', 'c'))]}

    def judul_bundel(t):
        return {'lebar': [LEBAR], 'brd': [K_SEL], 'shade': [4], 'sel': [sel(p_sel([run(t, b=True, sz=18, sp=80, cf=5)]))]}

    def isi(k1, k2, k3, k4):
        return {'lebar': wk, 'brd': [K_SEL] * 4, 'jaga': False,
                'sel': [sel(p_sel([run('#%d#' % k1, sz=17)], al='c')), sel(p_sel([run('#%d#' % k2, sz=17)])),
                        sel(p_sel([run('#%d#' % k3, sz=17)])), sel(p_sel([run('#%d#' % k4, sz=17)], al='c'))]}
    s += tabel([kep, judul_bundel('BUNDEL A'), isi(5851, 5852, 5853, 5854), judul_bundel('BUNDEL B'), isi(5856, 5857, 5858, 5859)])
    s += par([run('Kolom halaman diisi tangan saat berkas dijilid.', sz=14)], sb=60)
    s += par([run('Panitera Pengganti,', sz=18)], al='r', sb=240)
    s += par('', sz=18, al='r', sb=500)
    s += par([run('#0015#', b=True, sz=18)], al='r')
    return s + '}\n'


def semua():
    """{nama berkas: isi RTF (str ASCII)} untuk keenam berkas."""
    hasil = {}
    for kode, (akhiran, w, h, baris) in KERTAS.items():
        for dasar, fn in (('Sampul Berkas Perkara', sampul), ('Daftar Isi Berkas', daftar_isi)):
            isi = fn(kode)
            assert 'aleta' not in isi.lower()   # tidak boleh ada nama aplikasi di isi blangko
            hasil[dasar + akhiran + '.rtf'] = isi
    return hasil


if __name__ == '__main__':
    akar = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tuj = os.path.join(akar, 'rtf')
    os.makedirs(tuj, exist_ok=True)
    for nama, isi in semua().items():
        with open(os.path.join(tuj, nama), 'wb') as f:
            f.write(isi.encode('ascii'))
        print(nama, len(isi))
