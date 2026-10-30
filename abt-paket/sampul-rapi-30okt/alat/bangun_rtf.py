# -*- coding: utf-8 -*-
"""Membangun 21 blangko RTF berkas perkara Derry (paket sampul-rapi-30okt), menggantikan isi paket sampul-daftar-isi-26okt (+ peningkatan 27 Okt):
   Sampul Berkas Perkara (cetak awal; + Permohonan, Pihak Banyak, Permohonan Pihak Banyak), Sampul Berkas Perkara (Lengkap), Daftar Isi Berkas,
   Ceklist Berkas Perkara - masing-masing A4, F4, Legal.

Perubahan (permintaan Derry 30 Okt): penuh satu halaman (margin aman, tinggi baris mengisi bidang cetak), huruf seragam Arial terbaca, tabel bergaris
rapi, logo monokrom satker di kiri kop (tertanam: cetak langsung dari ABT pun berlogo), dan isi yang dulu hanya muncul lewat panel kini juga dari ABT:
   - Daftar Isi : tabel dokumen sungguhan dari variabel #11600#-#11602# (fungsi isian_rtf_tabel_daftar_isi), baris kosong mengisi halaman
   - Ceklist    : tabel dokumen per jenis perkara dari #11603#-#11605# (fungsi isian_rtf_tabel_ceklist)
   - Sampul     : lampiran hanya bila perlu (pihak, anak, objek, riwayat lanjutan) dari #11606#-#11617# (fungsi isian_rtf_lampiran_sampul)
Lewat panel portal tetap menimpa ketiganya dengan susunannya sendiri (halaman otomatis, OTO e-Court, alasan terdeteksi).

Jalankan: python -I alat/bangun_rtf.py   (menulis rtf/ di folder paket; logo dari sumber/logo-kop-mono.png)."""
import os
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
import rtf_dasar as d   # noqa: E402
from rtf_dasar import K, judul_bagian, kop, p_sel, par, run, sel, tabel   # noqa: E402

KODE_RIWAYAT = 5700
# Variabel baru paket (blok 11600-11619), per kertas
VAR_DAFTAR = {'a4': 11600, 'f4': 11601, 'legal': 11602}
VAR_CEKLIST = {'a4': 11603, 'f4': 11604, 'legal': 11605}
VAR_LAMPIRAN = {   # (berlawanan, banyak) -> per kertas
    (True, False): {'a4': 11606, 'f4': 11607, 'legal': 11608},
    (False, False): {'a4': 11609, 'f4': 11610, 'legal': 11611},
    (True, True): {'a4': 11612, 'f4': 11613, 'legal': 11614},
    (False, True): {'a4': 11615, 'f4': 11616, 'legal': 11617},
}
# Sampul cetak awal: (baris riwayat, tinggi baris twip) per kertas; pihak banyak: baris lebih rapat
RIWAYAT_AWAL = {'a4': (15, 315), 'f4': (18, 350), 'legal': (20, 380)}
RIWAYAT_BANYAK = {'a4': 265, 'f4': 300, 'legal': 315}
# Sampul lengkap: (baris riwayat, tinggi)
RIWAYAT_LENGKAP = {'a4': (12, 340), 'f4': (15, 390), 'legal': (18, 410)}
KOTAK = '{\\f1\\u9744?}'
GANDA = '\\chbrdr\\brdrdb\\brdrw15\\brsp20'


def kotak_teks(teks, sz=16):
    return [KOTAK + '\\~', run(teks.replace(' ', ' '), sz=sz)]


def kotak_label(l, v, sz=18, al='l', sz_l=14):
    return sel([par([run(l, b=True, sz=sz_l, sp=6)], al=al, intbl='mid', sb=30, sa=20), p_sel([run(v, b=True, sz=sz)], al=al, sa=30)])


def penanda_tabel(no, sz=18):
    """Paragraf penanda variabel tabel (tanpa grup: tabel RTF dari fungsi ABT berdiri sendiri; portal menggantinya dengan tabelnya)."""
    return '\\pard\\plain\\ql\\f0\\fs%d\\sb0\\sa0 #%d#\\par\n' % (sz, no)


# --------------------------------------------------------------------------------------------------------------------
def sampul_awal(kertas='a4', lawan=True, banyak=False):
    d.pilih_kertas(kertas)
    L = d.lebar_isi()

    def e(x):
        return int(x * L / 10466)
    n_baris, tinggi = RIWAYAT_AWAL[kertas]
    if banyak:
        tinggi = RIWAYAT_BANYAK[kertas]
    half = L // 2
    s = d.kepala_rtf()
    s += kop('Sampul berkas perkara tingkat pertama', 'BUNDEL A')
    # jenis perkara dan nomor perkara
    s += tabel([{
        'lebar': [e(5600), L - e(5600)], 'brd': [(0, 0, 0, 0), (25, 25, 25, 25)], 'va': ['c', 'c'],
        'sel': [sel([par([run('JENIS PERKARA', b=True, sz=15, sp=20)], intbl='mid', sb=40),
                     par([run('#5867#', b=True, sz=32)], intbl='mid', sb=10),
                     p_sel([run('#5868#', sz=17)], sb=0, sa=30)]),
                sel([par([run('PERKARA NOMOR', b=True, sz=15, sp=20)], al='c', intbl='mid', sb=40),
                     par([run('#0001#', b=True, sz=34)], al='c', intbl='mid', sb=0),
                     p_sel([run('TAHUN #0191#  -  TERDAFTAR #1061#', sz=17)], al='c', sa=30)])],
    }])
    # ciri perkara dan ciri susulan
    ciri = sel([
        par([run('CIRI PERKARA', b=True, sz=15, sp=12), run('   hanya yang berlaku', sz=14)], intbl='mid', sb=30),
        par([run('#5861#', b=True, sz=18), ' ', '{' + GANDA + '\\b\\fs18 #11618#}', ' ', '{' + GANDA + '\\b\\fs18 #11619#}'], intbl='mid', sb=30, sa=10),
        par([run('#5842#', b=True, sz=18)], intbl='mid', sb=0, sa=0),
        p_sel([run('#5832#', b=True, sz=17)], sb=0, sa=30),
    ])
    susulan = sel([par([run('CIRI SUSULAN', b=True, sz=15, sp=12), run('   centang bila terjadi', sz=14)], intbl='mid', sb=30),
                   p_sel([run('#5862#', sz=17)], sb=30, sa=30)])
    s += tabel([{'lebar': [e(4900), L - e(4900)], 'brd': [(15, 15, 15, 15)] * 2, 'sel': [ciri, susulan]}])
    # pihak
    if banyak:
        fs = 16
        kiri = sel([par([run('#5894#', b=True, sz=15, sp=12)], intbl='mid', sb=40), par([run('#5898#', b=True, sz=22)], intbl='mid'),
                    p_sel([run('#5830#', sz=17), ' ', run('#5896#', sz=17)], sb=0, sa=30)])
        kanan = sel([par([run('#5895#', b=True, sz=15, sp=12)], intbl='mid', sb=40), par([run('#5899#', b=True, sz=22)], intbl='mid'),
                     p_sel([run('#5831#', sz=17)], sb=0, sa=30)])
        if lawan:
            s += tabel([{'lebar': [half, L - half], 'brd': [(15, 15, 0, 15)] * 2, 'sel': [kiri, kanan]}])
            q = half // 2
            s += tabel([{'lebar': [q, half - q, q, L - half - q], 'brd': [(0, 15, 15, 0), (0, 0, 15, 15), (0, 15, 15, 0), (0, 0, 15, 15)],
                         'sel': [sel(p_sel([run('#5890#', sz=fs)], sb=10, sa=30)), sel(p_sel([run('#5891#', sz=fs)], sb=10, sa=30)),
                                 sel(p_sel([run('#5892#', sz=fs)], sb=10, sa=30)), sel(p_sel([run('#5893#', sz=fs)], sb=10, sa=30))]}])
        else:
            s += tabel([{'lebar': [L], 'brd': [(15, 15, 0, 15)], 'sel': [kiri]}])
            s += tabel([{'lebar': [half, L - half], 'brd': [(0, 15, 15, 0), (0, 0, 15, 15)],
                         'sel': [sel(p_sel([run('#5890#', sz=fs)], sb=10, sa=30)), sel(p_sel([run('#5891#', sz=fs)], sb=10, sa=30))]}])
        s += par([run('#5897#', b=True, sz=15), '   ', run('#5847#', b=True, sz=15)], sb=30, sa=0)   # turut tergugat dan intervensi satu paragraf
    elif lawan:
        kiri = sel([par([run('#5841#', b=True, sz=15, sp=12)], intbl='mid', sb=40), par([run('#0098#', b=True, sz=22)], intbl='mid'),
                    p_sel([run('#5830#', sz=16)], sb=0, sa=30)])
        kanan = sel([par([run('#8147#', b=True, sz=15, sp=12)], intbl='mid', sb=40), par([run('#0102#', b=True, sz=22)], intbl='mid'),
                     p_sel([run('#5831#', sz=16)], sb=0, sa=30)])
        s += tabel([{'lebar': [half, L - half], 'brd': [(15, 15, 15, 15)] * 2, 'sel': [kiri, kanan]}])
    else:
        satu = sel([par([run('#5841#', b=True, sz=15, sp=12)], intbl='mid', sb=40), par([run('#0098#   #1033#', b=True, sz=22)], intbl='mid'),
                    p_sel([run('#5830#', sz=16)], sb=0, sa=40)])
        s += tabel([{'lebar': [L], 'brd': [(15, 15, 15, 15)], 'sel': [satu]}])
    # pokok khas jenis perkara
    s += par([run('#5843#', sz=17)], sb=20, sa=10)
    # majelis dan petugas
    w4 = [e(4200), e(2250), e(2250), L - e(4200) - 2 * e(2250)]
    s += tabel([{'lebar': w4, 'tinggi': 600, 'brd': [K] * 4,
                 'sel': [kotak_label('MAJELIS / HAKIM TUNGGAL', '#5869#', 16), kotak_label('PANITERA PENGGANTI', '#0015#', 16),
                         kotak_label('JURUSITA / PENGGANTI', '#0018#', 16), kotak_label('PHS / SIDANG PERTAMA', '#1064#', 16)]}])
    # ===== RIWAYAT SIDANG =====
    s += par('', sz=6, sb=40)
    s += tabel([{'lebar': [L], 'brd': [(20, 20, 0, 20)], 'shade': [4],
                 'sel': [p_sel([run('RIWAYAT SIDANG', b=True, sz=22, sp=40, cf=5),
                                run('     %d baris; ditulis tangan tiap sidang bila belum tercetak' % n_baris, sz=15, cf=5)], sb=30, sa=30)]}])
    w5 = [e(560), e(1950), e(3000), e(1250), L - e(560) - e(1950) - e(3000) - e(1250)]
    kep = {'lebar': w5, 'brd': [(0, 20, 15, 10)] + [(0, 10, 15, 10)] * 3 + [(0, 10, 15, 20)], 'shade': [2] * 5, 'va': ['c'] * 5, 'kepala': True,
           'sel': [p_sel([run(t, b=True, sz=15, sp=6)], al=a, sb=20, sa=20) for t, a in
                   (('KE', 'c'), ('TANGGAL', 'l'), ('AGENDA', 'l'), ('HADIR', 'c'), ('HASIL / DITUNDA KE - ALASAN', 'l'))]}
    baris = [kep]
    for n in range(1, n_baris + 1):
        kode = KODE_RIWAYAT + (n - 1) * 4
        bb = 20 if n == n_baris else 10
        baris.append({'lebar': w5, 'tinggi': tinggi, 'va': ['c'] * 5,
                      'brd': [(0, 20, bb, 10)] + [(0, 10, bb, 10)] * 3 + [(0, 10, bb, 20)],
                      'sel': [p_sel([run(str(n), b=True, sz=18 if banyak else 20)], al='c'),
                              p_sel([run('#%d#' % kode, sz=16 if banyak else 18)]),
                              p_sel([run('#%d#' % (kode + 2), sz=16 if banyak else 17)]),
                              p_sel([run('#%d#' % (5870 + n - 1), sz=14 if banyak else 17)], al='c'),
                              p_sel([run('#%d#' % (kode + 3), sz=16 if banyak else 17)])]})
    s += tabel(baris)
    # ===== mediasi (perkara berlawanan) =====
    if lawan:
        s += par('', sz=6, sb=30)
        wm = [e(4700), e(2300), e(1700), L - e(4700) - e(2300) - e(1700)]
        s += tabel([
            {'lebar': wm, 'tinggi': 430 if banyak else 470, 'brd': [(15, 15, 0, 10), (15, 10, 0, 10), (15, 10, 0, 10), (15, 10, 0, 15)], 'va': ['t'] * 4,
             'sel': [kotak_label('MEDIASI  -  MEDIATOR', '#5836#', 18),
                     sel([par([run('MEDIATOR ADALAH', b=True, sz=14, sp=6)], intbl='mid', sb=30), p_sel(kotak_teks('hakim', 17) + ['   '] + kotak_teks('non hakim', 17), sb=20, sa=30)]),
                     kotak_label('DITETAPKAN', '#0055#', 17), kotak_label('LAPORAN', '#8012#', 17)]},
            {'lebar': [L], 'brd': [(10, 15, 15, 15)], 'sel': [p_sel([run('Hasil: ', b=True, sz=17), run('#5866#', sz=17)], sb=10, sa=10)]},
        ])
    # ===== putusan =====
    s += judul_bagian('PUTUSAN', sb=50)

    def lab(t):
        return p_sel([run(t, b=True, sz=14, sp=6)], sb=20, sa=20)

    def isi(v, sz=18):
        return p_sel([run(v, b=True, sz=sz)], sb=20, sa=20)
    wl = e(1650)
    s += tabel([
        {'lebar': [wl, e(2900), e(1650), L - wl - e(2900) - e(1650)], 'tinggi': 330, 'va': ['c'] * 4, 'brd': [K] * 4,
         'sel': [lab('TANGGAL PUTUS'), isi('#1069#', 19), lab('SIFAT PUTUSAN'), isi('#5864#', 17)]},
        {'lebar': [wl, L - wl], 'tinggi': 330, 'va': ['c'] * 2, 'brd': [K] * 2, 'sel': [lab('AMAR'), isi('#5863#', 17)]},
        {'lebar': [wl, L - wl], 'tinggi': 330, 'va': ['c'] * 2, 'brd': [K] * 2, 'sel': [lab('KONSEPTOR'), isi('#5865#', 18)]},
    ])
    # ===== catatan =====
    s += judul_bagian('CATATAN', sb=40)
    s += par([run('#5834#', b=True, sz=16)], sb=20, sa=20)
    s += tabel([{'lebar': [wl, L - wl], 'tinggi': 330 if banyak else 450, 'va': ['t'] * 2, 'brd': [K] * 2, 'sel': [lab('KETERANGAN'), isi('#5835#', 17)]}])
    if kertas != 'a4':
        s += tabel([{'lebar': [wl, L - wl], 'tinggi': 360, 'va': ['c'] * 2, 'brd': [K] * 2, 'sel': [lab('CADANGAN'), isi('', 17)]}])
    # catatan kaki + rujukan lampiran SATU paragraf: #5833# (kaki susunan panel) dan variabel lampiran ABT (kaki + halaman lampiran hanya bila
    # perlu; lewat panel ditimpa penanda yang dibuang portal). Variabel lampiran langsung sebelum \par (tanpa grup: halaman lampiran berdiri sendiri).
    s += par([run('Isian bergaris atau berkotak diisi tangan oleh Panitera Pengganti; bila sampul dicetak ulang, data yang sudah ada terisi otomatis.', sz=14),
              ' ', run('#5833#', b=True, sz=15), '#%d#' % VAR_LAMPIRAN[(lawan, banyak)][kertas]], sb=40)
    return s + '}\n'


# --------------------------------------------------------------------------------------------------------------------
def sampul_lengkap(kertas='a4'):
    """Sampul lengkap (blangko pilihan kedua, bukan bawaan): tata letak 26 Okt dengan kop berlogo, huruf terbaca, dan tinggi penuh halaman."""
    d.pilih_kertas(kertas)
    L = d.lebar_isi()
    n_baris, tinggi = RIWAYAT_LENGKAP[kertas]
    s = d.kepala_rtf()
    s += kop('Berkas perkara tingkat pertama', 'BUNDEL A')
    s += tabel([{
        'lebar': [5500, L - 5500], 'brd': [(0, 0, 0, 0), (25, 25, 25, 25)], 'va': ['c', 'c'],
        'sel': [sel([par([run('SAMPUL BERKAS PERKARA', b=True, sz=16, sp=20)], intbl='mid', sb=80), p_sel([run('#5800#', b=True, sz=34)], sb=20, sa=60)]),
                sel([par([run('PERKARA NOMOR', b=True, sz=15, sp=20)], al='c', intbl='mid', sb=60), par([run('#0001#', b=True, sz=34)], al='c', intbl='mid'),
                     p_sel([run('TAHUN #0191#  -  TERDAFTAR #1061#', sz=17)], al='c', sa=60)])],
    }])
    s += par([run('#5842#', sz=22)], al='c', sb=100, sa=20)
    s += tabel([{'lebar': [L], 'brd': [(15, 15, 15, 15)],
                 'sel': [sel([par([run('CIRI PERKARA', b=True, sz=15, sp=12), run('   menyala hanya bila berlaku', sz=14)], intbl='mid', sb=40),
                              p_sel([run('#5801#', b=True, sz=18)], sb=30, sa=50)])]}])
    s += par('', sz=8, sb=40)
    s += tabel([{'lebar': [L], 'brd': [(20, 20, 0, 20)], 'shade': [4],
                 'sel': [p_sel([run('RIWAYAT SIDANG', b=True, sz=24, sp=40, cf=5), run('     diisi dari jadwal sidang; baris sisa untuk tulisan tangan', sz=15, cf=5)], sb=50, sa=50)]}])
    w5 = [560, 2150, 760, 3400, L - 560 - 2150 - 760 - 3400]
    kep = {'lebar': w5, 'brd': [(0, 20, 15, 10)] + [(0, 10, 15, 10)] * 3 + [(0, 10, 15, 20)], 'shade': [2] * 5, 'va': ['c'] * 5, 'kepala': True,
           'sel': [p_sel([run(t, b=True, sz=15, sp=6)], al=a, sb=40, sa=40) for t, a in
                   (('NO', 'c'), ('TGL SIDANG', 'l'), ('HADIR', 'c'), ('AGENDA / HASIL', 'l'), ('ALASAN PENUNDAAN / KET.', 'l'))]}
    baris = [kep]
    for n in range(1, n_baris + 1):
        kode = KODE_RIWAYAT + (n - 1) * 4
        bb = 20 if n == n_baris else 10
        baris.append({'lebar': w5, 'tinggi': tinggi, 'va': ['c'] * 5, 'brd': [(0, 20, bb, 10)] + [(0, 10, bb, 10)] * 3 + [(0, 10, bb, 20)],
                      'sel': [p_sel([run(str(n), b=True, sz=20)], al='c'), p_sel([run('#%d#' % kode, sz=18)]),
                              p_sel([run('#%d#' % (kode + 1), b=True, sz=17)], al='c'), p_sel([run('#%d#' % (kode + 2), sz=17)]),
                              p_sel([run('#%d#' % (kode + 3), sz=17)])]})
    s += tabel(baris)
    s += par([run('HADIR: P = pihak pertama, T = pihak kedua (sandi kehadiran SIPP); kosong = belum dicatat', sz=14)], sb=30)
    half = L // 2
    s += judul_bagian('PARA PIHAK')
    kiri = sel([par([run('#5841#', b=True, sz=15, sp=12)], intbl='mid', sb=40), par([run('#0098#', b=True, sz=22)], intbl='mid'),
                par([run('#5830#', sz=17)], intbl='mid'),
                par([run('#1033#', b=True, sz=19)], intbl='mid', sb=40), p_sel([run('#1036#', sz=17)], sa=40)])
    kanan = sel([par([run('#8147#', b=True, sz=15, sp=12)], intbl='mid', sb=40), par([run('#0102#', b=True, sz=22)], intbl='mid'),
                 p_sel([run('#5831#', sz=17)], sb=0, sa=40)])
    s += tabel([{'lebar': [half, L - half], 'brd': [(15, 15, 15, 15)] * 2, 'sel': [kiri, kanan]}])
    q4 = L // 4
    s += judul_bagian('MAJELIS DAN PETUGAS')
    s += tabel([
        {'lebar': [q4] * 3 + [L - 3 * q4], 'brd': [K] * 4, 'sel': [kotak_label('KETUA MAJELIS', '#0012#'), kotak_label('HAKIM ANGGOTA I', '#0013#'),
                                                                 kotak_label('HAKIM ANGGOTA II', '#0014#'), kotak_label('PANITERA PENGGANTI', '#0015#')]},
        {'lebar': [q4] * 3 + [L - 3 * q4], 'brd': [K] * 4, 'sel': [kotak_label('JURUSITA / PENGGANTI', '#0018#'), kotak_label('MEDIATOR', '#5836#'),
                                                                 kotak_label('HASIL MEDIASI', '#5837#'), kotak_label('KONSEPTOR', '#5839#')]},
    ])
    q6 = L // 6
    s += judul_bagian('TANGGAL PENTING')
    s += tabel([{'lebar': [q6] * 5 + [L - 5 * q6], 'brd': [K] * 6,
                 'sel': [kotak_label('DAFTAR PERKARA', '#1061#', 17), kotak_label('PMH', '#1060#', 17), kotak_label('PHS', '#1064#', 17),
                         kotak_label('PENETAPAN PP / JS', '#0180#', 17), kotak_label('PENETAPAN MEDIATOR', '#0055#', 17), kotak_label('LAPORAN MEDIATOR', '#8012#', 17)]}])
    s += par([run('#5843#', sz=18)], sb=80, sa=20)
    s += judul_bagian('PUTUSAN')
    s += tabel([{'lebar': [q4] * 3 + [L - 3 * q4], 'brd': [K] * 4,
                 'sel': [kotak_label('TGL PUTUS', '#1069#', 19, 'c'), kotak_label('TGL MINUTASI', '#1278#', 19, 'c'), kotak_label('TGL PBT', '#5840#', 19, 'c'),
                         kotak_label('TGL BHT', '#0168#', 19, 'c')]}])
    s += par([run('#5829#', b=True, sz=18)], sb=60)
    s += par([run('Hijriah putusan: #0038#', sz=15)], sb=40, al='r')
    return s + '}\n'


# --------------------------------------------------------------------------------------------------------------------
def daftar_isi(kertas='a4'):
    """Daftar isi berkas: kop berlogo, judul, identitas, TABEL dokumen (#11600#-#11602#: fungsi ABT; lewat panel diganti tabel portal), tanda tangan."""
    d.pilih_kertas(kertas)
    L = d.lebar_isi()
    half = L // 2
    s = d.kepala_rtf()
    s += kop('Daftar isi berkas perkara tingkat pertama', 'BUNDEL A')
    s += par([run('DAFTAR ISI BERKAS', b=True, sz=32, sp=20)], al='c', sb=160)
    s += par([run('Nomor #0001#', b=True, sz=24)], al='c', sa=120)
    s += tabel([
        {'lebar': [half, L - half], 'brd': [K] * 2, 'sel': [kotak_label('#5894#', '#5898#', 20, sz_l=15), kotak_label('#5895#', '#5899#', 20, sz_l=15)]},
        {'lebar': [half, L - half], 'brd': [K] * 2, 'sel': [kotak_label('MAJELIS HAKIM', '#5869#', 18, sz_l=15), kotak_label('PANITERA SIDANG', '#0015#', 19, sz_l=15)]},
        {'lebar': [L], 'brd': [K], 'sel': [kotak_label('CIRI PERKARA', '#5801#', 18, sz_l=15)]},
    ])
    s += par('', sz=10, sb=100)
    s += penanda_tabel(VAR_DAFTAR[kertas])
    s += par([run('Kolom halaman diisi saat berkas dijilid bila belum terisi; baris kosong untuk dokumen tambahan.', sz=15)], sb=60)
    s += tabel([{'lebar': [half, L - half], 'brd': [(0, 0, 0, 0)] * 2, 'tinggi': 1250,
                 'sel': [p_sel([run('', sz=19)]),
                         sel([par([run('Panitera Pengganti,', sz=21)], al='c', intbl='mid', sb=60, sa=760), p_sel([run('#0015#', b=True, sz=21)], al='c')])]}])
    return s + '}\n'


# --------------------------------------------------------------------------------------------------------------------
def ceklist(kertas='a4'):
    """Ceklist berkas perkara (Meja I): kop berlogo + kotak MEJA I, judul, identitas, TABEL dokumen (#11603#-#11605#: fungsi ABT; lewat panel diganti
    tabel portal dengan OTO e-Court), ringkasan, tanda tangan."""
    d.pilih_kertas(kertas)
    L = d.lebar_isi()

    def e(x):
        return int(x * L / 10466)
    s = d.kepala_rtf()
    s += kop('Kepaniteraan  -  pemeriksaan kelengkapan berkas pendaftaran', 'MEJA I', kanan_ket='PENDAFTARAN')
    s += tabel([{
        'lebar': [e(6300), L - e(6300)], 'brd': [(0, 0, 0, 0), (25, 25, 25, 25)], 'va': ['c', 'c'],
        'sel': [sel([par([run('CEKLIST BERKAS PERKARA', b=True, sz=32, sp=20)], intbl='mid', sb=80), p_sel([run('Nomor #0001#', b=True, sz=24)], sb=30, sa=60)]),
                sel([par([run('JENIS PERKARA', b=True, sz=15, sp=20)], al='c', intbl='mid', sb=40), p_sel([run('#5860#', b=True, sz=24)], al='c', sa=60)])],
    }])
    t3 = L // 3
    s += tabel([{'lebar': [t3, t3, L - 2 * t3], 'brd': [K] * 3,
                 'sel': [kotak_label('PIHAK I', '#0098#', 18), kotak_label('PIHAK II', '#0102#', 18), kotak_label('DIDAFTARKAN', '#1061#  #5803#', 18)]}])
    s += par('', sz=10, sb=80)
    s += penanda_tabel(VAR_CEKLIST[kertas])
    s += par([run('#5848#', b=True, sz=17)], sb=80, sa=40)
    w2 = L // 2
    s += tabel([{'lebar': [w2, L - w2], 'brd': [(0, 0, 0, 0)] * 2, 'tinggi': 1500,
                 'sel': [sel([par([run('Mengetahui,', sz=19)], al='c', intbl='mid', sb=40), par([run('Panitera Pengganti', sz=19)], al='c', intbl='mid', sa=800),
                              p_sel([run('#5849#', b=True, sz=19)], al='c')]),
                         sel([par([run('#5855#', sz=19)], al='c', intbl='mid', sb=40), par([run('Petugas Meja I', sz=19)], al='c', intbl='mid', sa=800),
                              p_sel([run('#5838#', b=True, sz=19)], al='c')])]}])
    s += par(['{\\f1\\u10003?}', run(' / ', sz=14), '{\\f1\\u10007?}', run(' OTO = terbaca otomatis dari data perkara (penetapan, kasir, e-Court); kotak kosong = diperiksa dan dicentang petugas Meja I.', sz=14)], sb=60)
    return s + '}\n'


def nama_sampul(lawan, banyak, akhiran):
    tengah = (' (Pihak Banyak)' if banyak else '') if lawan else (' (Permohonan Pihak Banyak)' if banyak else ' (Permohonan)')
    return 'Sampul Berkas Perkara' + tengah + akhiran + '.rtf'


def semua():
    """{(folder relatif, nama berkas): isi RTF}."""
    d.muat_logo(os.path.join(os.path.dirname(SINI), 'sumber', 'logo-kop-mono.png'))
    hasil = {}
    for kode, (akhiran, _w, _h) in d.KERTAS.items():
        for lawan in (True, False):
            for banyak in (False, True):
                hasil[('99 PTSP', nama_sampul(lawan, banyak, akhiran))] = sampul_awal(kode, lawan, banyak)
        hasil[('99 PTSP', 'Sampul Berkas Perkara (Lengkap)' + akhiran + '.rtf')] = sampul_lengkap(kode)
        hasil[('99 PTSP', 'Ceklist Berkas Perkara' + akhiran + '.rtf')] = ceklist(kode)
        hasil[('98b Berkas Perkara - BAS', 'Daftar Isi Berkas' + akhiran + '.rtf')] = daftar_isi(kode)
    return hasil


if __name__ == '__main__':
    akar = os.path.join(os.path.dirname(SINI), 'rtf', 'derry_briantono')
    for (folder, nama), isi in sorted(semua().items()):
        d.simpan(os.path.join(akar, folder), nama, isi)
        print(folder, nama, len(isi))
