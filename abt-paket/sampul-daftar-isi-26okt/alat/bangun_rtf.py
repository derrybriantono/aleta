#!/usr/bin/env python3
# DRAF (26 Okt 2026): membangun dua berkas RTF blangko Derry:
#   rtf/Sampul Berkas Perkara.rtf
#   rtf/Daftar Isi Berkas.rtf
# Isian memakai penanda #NNNN# gaya ABT. TIDAK ada kata nama aplikasi di isi RTF.
# Jalankan:  python -I alat/bangun_rtf.py   (dari folder paket). Hanya menulis ke folder rtf/ paket ini.
import os, sys

LEBAR = 10506           # lebar isi A4 dalam twip (margin 700)
HAL = (11906, 16838)   # A4 (bawaan); diganti per ukuran lewat KERTAS
KERTAS = {   # kode: (nama berkas, lebar twip, tinggi twip, baris riwayat sidang)
    'a4': ('', 11906, 16838, 12),                 # 210 x 297 mm
    'f4': (' (F4)', 12189, 18709, 18),            # 215 x 330 mm (Folio)
    'legal': (' (Legal)', 12246, 20183, 20),      # 216 x 356 mm
}

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

def run(t, b=False, i=False, sz=None, sp=None, caps=False):
    # t boleh memuat penanda #NNNN# - ikut apa adanya
    pre = ''
    if b: pre += '\\b'
    if i: pre += '\\i'
    if sz: pre += '\\fs%d' % sz
    if sp: pre += '\\expndtw%d' % sp
    if caps: pre += '\\caps'
    if not pre:
        return esc(t)
    return '{' + pre + ' ' + esc(t) + '}'

def par(segs, al='l', sb=0, sa=0, sz=18, intbl=None, keepn=False, brdb=False):
    # segs: str atau daftar potongan RTF (hasil run)
    # intbl: None = paragraf biasa; 'mid' = dalam sel (bukan terakhir, berakhir \par); True = paragraf TERAKHIR sel (berakhir \cell)
    if isinstance(segs, str):
        segs = [esc(segs)]
    a = {'l': '\\ql', 'c': '\\qc', 'r': '\\qr', 'j': '\\qj'}[al]
    s = '\\pard\\plain' + ('\\intbl' if intbl else '') + a + '\\f0\\fs%d' % sz
    s += '\\sb%d\\sa%d' % (sb, sa)
    if keepn: s += '\\keepn'
    if brdb: s += '\\brdrb\\brdrs\\brdrw10\\brsp20'
    akhir = '\\cell' if intbl is True else '\\par'
    s += ' ' + ''.join(segs) + akhir + '\n'
    return s

def cell_def(x, brd=(1, 1, 1, 1), w=10, shade=None, valign='t', merge=None):
    s = ''
    if merge == 'first': s += '\\clmgf'
    elif merge == 'cont': s += '\\clmrg'
    names = ('t', 'l', 'b', 'r')
    for n, on in zip(names, brd):
        if on:
            s += '\\clbrdr%s\\brdrs\\brdrw%d' % (n, on if on > 1 else w)
    if shade: s += '\\clcbpat%d' % shade
    s += {'t': '\\clvertalt', 'c': '\\clvertalc', 'b': '\\clvertalb'}[valign]
    s += '\\cellx%d' % x
    return s

def tabel(baris):
    # baris: daftar dict {'lebar': [..], 'sel': [rtf per sel], 'brd': [(t,l,b,r)...], 'shade': [...], 'tinggi':int}
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
    # isi satu sel = satu atau lebih paragraf; paragraf terakhir mengakhiri dengan \cell
    if isinstance(paragrafs, str):
        paragrafs = [paragrafs]
    return ''.join(paragrafs)

def p_sel(segs, **kw):
    return par(segs, intbl=True, **kw)

def kepala_rtf():
    return ('{\\rtf1\\ansi\\ansicpg1252\\deff0\\deflang1057\n'
            '{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}\n'
            '{\\colortbl;\\red0\\green0\\blue0;\\red230\\green240\\blue243;\\red243\\green244\\blue246;\\red20\\green24\\blue31;}\n'
            '\\paperw%d\\paperh%d\\margl700\\margr700\\margt600\\margb600\\widowctrl\n' % HAL)

def judul_bagian(teks, ket=None):
    segs = [run(teks, b=True, sz=16, sp=40)]
    if ket: segs.append(run('   ' + ket, sz=14))
    return par(segs, sb=160, sa=40, keepn=True, brdb=True)

K_SEL = (10, 10, 10, 10)

# --------------------------------------------------------------------------------------------------------------------
def sampul(kertas='a4'):
    global HAL
    HAL = (KERTAS[kertas][1], KERTAS[kertas][2])
    s = kepala_rtf()
    # kop
    w = [7300, LEBAR - 7300]
    s += tabel([{
        'lebar': w,
        'brd': [(0, 0, 20, 0), (20, 20, 20, 20)],
        'sel': [
            sel([par([run('#8010#', b=True, sz=26, sp=20)], intbl='mid', sa=0).replace('\\par\n', '\\par\n') ,
                 p_sel([run('Berkas perkara tingkat pertama', sz=16)])]),
            sel([p_sel([run('BUNDEL A', b=True, sz=24, sp=40)], al='c'),])
        ],
        'va': ['c', 'c'],
    }])
    s += par([run('SAMPUL BERKAS PERKARA', b=True, sz=16, sp=120)], al='c', sb=200)
    s += par([run('#5800#', b=True, sz=34)], al='c', sa=80)
    # nomor
    s += tabel([{
        'lebar': [LEBAR],
        'brd': [(30, 30, 30, 30)],
        'sel': [sel([
            par([run('PERKARA NOMOR', b=True, sz=15, sp=60)], al='c', sb=40, intbl='mid'),
            par([run('#0001#', b=True, sz=44)], al='c', intbl='mid'),
            p_sel([run('TAHUN #0191#   -   TERDAFTAR #1061#', sz=17, sp=20)], al='c', sa=40),
        ])],
    }])
    # fokus perkara (nama anak, pasangan, pewaris, dan seterusnya; kosong untuk cerai)
    s += par([run('#5842#', sz=22)], al='c', sb=120, sa=40)
    # ciri
    s += judul_bagian('CIRI PERKARA', 'hanya yang berlaku')
    s += tabel([{
        'lebar': [LEBAR],
        'brd': [(15, 15, 15, 15)],
        'sel': [sel([p_sel([run('#5801#', b=True, sz=18, sp=10)], sb=60, sa=60)])],
    }])
    s += par([run('\u25A0 pendaftaran dan biaya     \u25CF pihak     \u25B2 proses', sz=14)], sb=40)
    # pihak
    s += judul_bagian('PARA PIHAK')
    half = LEBAR // 2
    kiri = sel([
        par([run('#5841#', b=True, sz=15, sp=60)], intbl='mid', sb=40),
        par([run('#0098#', b=True, sz=22)], intbl='mid'),
        par([run('Pekerjaan: #0100#', sz=17)], intbl='mid'),
        par([run('Alamat: #0101#', sz=17)], intbl='mid'),
        par([run('Kuasa: #0106#', sz=16)], intbl='mid', sb=40),
        par([run('#1033#', b=True, sz=20)], intbl='mid', sb=80),
        p_sel([run('#1036#', sz=16)], sa=40),
    ])
    kanan = sel([
        par([run('#8147#', b=True, sz=15, sp=60)], intbl='mid', sb=40),
        par([run('#0102#', b=True, sz=22)], intbl='mid'),
        par([run('Pekerjaan: #0104#', sz=17)], intbl='mid'),
        par([run('Alamat: #0105#', sz=17)], intbl='mid'),
        p_sel([run('Kuasa: #0170#', sz=16)], sb=40, sa=40),
    ])
    s += tabel([{'lebar': [half, LEBAR - half], 'brd': [(15, 15, 15, 15), (15, 15, 15, 15)], 'sel': [kiri, kanan]}])
    # majelis
    s += judul_bagian('MAJELIS DAN PETUGAS')
    L = 1750
    V = (LEBAR - 2 * L) // 2
    def baris4(a, b, c, d):
        return {'lebar': [L, V, L, V], 'brd': [K_SEL] * 4, 'shade': [3, None, 3, None],
                'sel': [sel(p_sel([run(a, sz=15)])), sel(p_sel([run(b, b=True, sz=17)])),
                        sel(p_sel([run(c, sz=15)])), sel(p_sel([run(d, b=True, sz=17)]))]}
    s += tabel([
        baris4('Ketua Majelis', '#0012#', 'Panitera Pengganti', '#0015#'),
        baris4('Hakim Anggota I', '#0013#', 'Jurusita / Pengganti', '#0018#'),
        baris4('Hakim Anggota II', '#0014#', 'Mediator', '#5836#'),
        baris4('Konseptor', '#5839#', 'Hasil mediasi', '#5837#'),
    ])
    # tanggal penting
    s += judul_bagian('TANGGAL PENTING')
    s += tabel([
        baris4('Daftar perkara', '#1061#', 'Penetapan PP / JS', '#0180#'),
        baris4('Penetapan Majelis (PMH)', '#1060#', 'Penetapan mediator', '#0055#'),
        baris4('Penetapan Hari Sidang (PHS)', '#1064#', 'Laporan mediator', '#8012#'),
    ])
    # pokok perkara menurut jenis (satu isian bergaris banyak; kosong bila tidak ada)
    s += par([run('#5843#', sz=17)], sb=120, sa=40)
    # riwayat sidang
    s += judul_bagian('RIWAYAT SIDANG')
    w4 = [600, 2300, 3300, LEBAR - 600 - 2300 - 3300]
    kep = {'lebar': w4, 'brd': [K_SEL] * 4, 'shade': [2] * 4,
           'sel': [sel(p_sel([run(t, b=True, sz=14, sp=30)])) for t in ('NO', 'TGL SIDANG', 'ALASAN PENUNDAAN', 'AGENDA SIDANG / KET.')]}
    baris = [kep]
    kode = 5860
    for n in range(1, KERTAS[kertas][3] + 1):
        if n == 13: kode = 5700   # baris 13 dst. memakai blok 5700-5723
        baris.append({'lebar': w4, 'brd': [K_SEL] * 4, 'tinggi': 300,
                      'sel': [sel(p_sel([run(str(n), b=True, sz=16)], al='c')),
                              sel(p_sel([run('#%d#' % kode, sz=16)])),
                              sel(p_sel([run('#%d#' % (kode + 1), sz=16)])),
                              sel(p_sel([run('#%d#' % (kode + 2), sz=16)]))]})
        kode += 3
    s += tabel(baris)
    # akhir
    s += par('', sz=8)
    q = LEBAR // 4
    def kot(l, v):
        return sel([par([run(l, b=True, sz=13, sp=30)], al='c', intbl='mid', sb=30),
                    p_sel([run(v, b=True, sz=20)], al='c', sa=30)])
    s += tabel([{'lebar': [q, q, q, LEBAR - 3 * q], 'brd': [K_SEL] * 4,
                 'sel': [kot('TGL PUTUS', '#1069#'), kot('TGL MINUTASI', '#1278#'), kot('TGL PBT', '#5840#'), kot('TGL BHT', '#0168#')]}])
    s += par([run('#5829#', b=True, sz=17)], sb=100)
    s += par([run('Hijriah putusan: #0038#', sz=14)], sb=60, al='r')
    s += '}\n'
    return s

# --------------------------------------------------------------------------------------------------------------------
def daftar_isi(kertas='a4'):
    global HAL
    HAL = (KERTAS[kertas][1], KERTAS[kertas][2])
    s = kepala_rtf()
    w = [7300, LEBAR - 7300]
    s += tabel([{
        'lebar': w,
        'brd': [(0, 0, 20, 0), (20, 20, 20, 20)],
        'sel': [
            sel([par([run('#8010#', b=True, sz=24, sp=20)], intbl='mid'),
                 p_sel([run('Daftar isi berkas perkara tingkat pertama', sz=16)])]),
            sel([p_sel([run('BUNDEL A  /  B', b=True, sz=20, sp=30)], al='c')]),
        ],
        'va': ['c', 'c'],
    }])
    s += par([run('DAFTAR ISI BERKAS', b=True, sz=30, sp=40)], al='c', sb=160)
    s += par([run('Nomor #0001#', b=True, sz=22)], al='c', sa=100)
    half = LEBAR // 2
    s += tabel([
        {'lebar': [half, LEBAR - half], 'brd': [K_SEL] * 2,
         'sel': [sel([par([run('#8146#', b=True, sz=13, sp=50)], intbl='mid', sb=20),
                      p_sel([run('#0098#   #1033#', sz=17)])]),
                 sel([par([run('#8147#', b=True, sz=13, sp=50)], intbl='mid', sb=20),
                      p_sel([run('#0102#', sz=17)])])]},
        {'lebar': [half, LEBAR - half], 'brd': [K_SEL] * 2,
         'sel': [sel([par([run('MAJELIS', b=True, sz=13, sp=50)], intbl='mid', sb=20),
                      p_sel([run('#0012#;  #0013#;  #0014#', sz=16)])]),
                 sel([par([run('PANITERA SIDANG', b=True, sz=13, sp=50)], intbl='mid', sb=20),
                      p_sel([run('#0015#', sz=16)])])]},
        {'lebar': [LEBAR], 'brd': [K_SEL],
         'sel': [sel([par([run('CIRI PERKARA', b=True, sz=13, sp=50)], intbl='mid', sb=20),
                      p_sel([run('#5801#', b=True, sz=16)])])]},
    ])
    s += par('', sz=8)
    wk = [650, 6350, 2000, LEBAR - 650 - 6350 - 2000]
    kep = {'lebar': wk, 'brd': [K_SEL] * 4, 'shade': [2] * 4,
           'sel': [sel(p_sel([run(t, b=True, sz=14, sp=40)], al=a)) for t, a in
                   (('NO', 'c'), ('JENIS DOKUMEN', 'l'), ('TANGGAL', 'l'), ('HALAMAN', 'c'))]}
    def judul_bundel(t):
        return {'lebar': [LEBAR], 'brd': [K_SEL], 'shade': [4],
                'sel': [sel(p_sel([run(t, b=True, sz=18, sp=80)]).replace('\\fs18', '\\fs18\\cf2'))]}
    def isi(k1, k2, k3, k4):
        return {'lebar': wk, 'brd': [K_SEL] * 4, 'jaga': False,
                'sel': [sel(p_sel([run('#%d#' % k1, sz=17)], al='c')),
                        sel(p_sel([run('#%d#' % k2, sz=17)])),
                        sel(p_sel([run('#%d#' % k3, sz=17)])),
                        sel(p_sel([run('#%d#' % k4, sz=17)], al='c'))]}
    s += tabel([kep, judul_bundel('BUNDEL A'), isi(5851, 5852, 5853, 5854),
                judul_bundel('BUNDEL B'), isi(5856, 5857, 5858, 5859)])
    s += par([run('Kolom halaman diisi tangan saat berkas dijilid.', sz=14)], sb=60)
    s += par([run('Panitera Pengganti,', sz=18)], al='r', sb=240)
    s += par('', sz=18, al='r', sb=500)
    s += par([run('#0015#', b=True, sz=18)], al='r')
    s += '}\n'
    return s

if __name__ == '__main__':
    akar = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tuj = os.path.join(akar, 'rtf')
    os.makedirs(tuj, exist_ok=True)
    for kode, (akhiran, w, h, baris) in KERTAS.items():
        for dasar, fn in (('Sampul Berkas Perkara', sampul), ('Daftar Isi Berkas', daftar_isi)):
            isi = fn(kode)
            assert 'aleta' not in isi.lower()   # tidak boleh ada nama aplikasi di isi blangko
            nama = dasar + akhiran + '.rtf'
            with open(os.path.join(tuj, nama), 'wb') as f:
                f.write(isi.encode('ascii'))
            print(nama, len(isi))
