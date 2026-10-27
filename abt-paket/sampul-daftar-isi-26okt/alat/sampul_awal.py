# -*- coding: utf-8 -*-
"""RTF SAMPUL CETAK AWAL (keputusan Derry 26 Okt, versi 4; acuan: docs/rancangan/sampul-daftar-isi-26okt/artifact-sampul-cetak-awal.html).

Dicetak saat pendaftaran atau sesudah PHS: yang sudah diketahui tercetak, yang belum berupa kotak atau garis isi tangan. Sampul BERHENTI di putusan
(tanpa minutasi, PBT, BHT, akta cerai, ikrar). Dua varian tata letak: BERLAWANAN (gugatan dan cerai talak: dua kolom pihak, pita mediasi, amar enam
pilihan, sifat putusan hadir/verstek) dan PERMOHONAN (satu kolom pihak, tanpa mediasi).

Versi 4: riwayat sidang lima kolom (KE, TANGGAL, AGENDA, HADIR, HASIL / DITUNDA KE - ALASAN; tanpa paraf), nama mediator lebar, majelis satu hakim per
baris, kumulasi disebut (judul + baris), amar satu baris, konseptor cukup nama, ciri berikon dengan bingkai ganda untuk ghaib dan mafqud.

Kotak centang di variabel ABT ditulis ASCII "[ ]" / "[X]" (renderer ABT merusak karakter > 255); portal mengubahnya menjadi kotak saat naskah disusun,
dan membuang tanda "..." variabel kosong (kolom tulis tangan). Kotak statis di RTF memakai karakter kotak langsung.
"""
import bangun_rtf as b

TINGGI_BANYAK = {'a4': 250, 'f4': 290, 'legal': 310}   # twip; sekitar 5 mm (artifact: minimum 15-16 px)
KERTAS_AWAL = {   # kode: (baris riwayat sidang, tinggi minimum baris dalam twip)
    'a4': (15, 300),
    'f4': (18, 330),
    'legal': (20, 350),
}
KOTAK = '{\\f1\\u9744?}'
IKON = '{\\f1\\u9632?}'    # ikon pada keterangan: pendaftaran, pihak, proses
IKON_B = '{\\f1\\u9679?}'
IKON_C = '{\\f1\\u9650?}'
GANDA = '\\chbrdr\\brdrdb\\brdrw15\\brsp20'   # bingkai ganda karakter (ciri yang mengubah cara pemeriksaan)


def kotak_teks(teks, sz=14):
    return [KOTAK + '\\~', b.run(teks.replace(' ', '\u00a0'), sz=sz)]   # kotak dan label tidak terpisah baris


def sampul_awal(kertas='a4', lawan=True, banyak=False):
    b.pilih_kertas(kertas)
    LEBAR = b.HAL[0] - 1400   # lebar isi menurut ukuran kertas (margin kiri dan kanan 700)

    def e(x):
        return int(x * LEBAR / 10506)
    run, par, p_sel, sel, tabel, K_SEL = b.run, b.par, b.p_sel, b.sel, b.tabel, b.K_SEL
    n_baris, tinggi = KERTAS_AWAL[kertas]
    if banyak:
        tinggi = TINGGI_BANYAK[kertas]   # pihak banyak: baris riwayat dirapatkan agar tetap satu lembar (jumlah baris tidak dikurangi)
    half = LEBAR // 2
    s = b.kepala_rtf()

    def kot(l, v, sz=15, al='l'):
        return sel([par([run(l, b=True, sz=11, sp=30)], al=al, intbl='mid', sb=25, sa=25), p_sel([run(v, b=True, sz=sz)], al=al, sa=25)])

    # kop berlogo (logo disisipkan portal dari identitas satker)
    s += b.kop_logo('Sampul berkas perkara tingkat pertama', 'BUNDEL A', lebar_total=LEBAR)
    # jenis perkara (+ kata Kumulasi, baris kumulasi) dan nomor perkara
    s += tabel([{
        'lebar': [e(5400), LEBAR - e(5400)], 'brd': [(0, 0, 0, 0), (30, 30, 30, 30)], 'va': ['c', 'c'],
        'sel': [sel([par([run('JENIS PERKARA', b=True, sz=13, sp=100)], intbl='mid', sb=60),
                     par([run('#5867#', b=True, sz=30)], intbl='mid', sb=20),
                     p_sel([run('#5868#', sz=15)], sb=10, sa=40)]),
                sel([par([run('PERKARA NOMOR', b=True, sz=13, sp=60)], al='c', intbl='mid', sb=30),
                     par([run('#0001#', b=True, sz=32)], al='c', intbl='mid'),
                     p_sel([run('TAHUN #0191#  -  TERDAFTAR #1061#', sz=14)], al='c', sa=30)])],
    }])
    # ciri perkara berikon (hanya yang berlaku); ghaib dan mafqud berbingkai ganda; satu baris keterangan kecil
    ciri = sel([
        par([run('CIRI PERKARA', b=True, sz=12, sp=60), run('   hanya yang berlaku', sz=12)], intbl='mid', sb=20),
        par([run('#5861#', b=True, sz=16, sp=10), ' ', '{' + GANDA + '\\b\\fs16 #5807#}', ' ', '{' + GANDA + '\\b\\fs16 #5808#}'], intbl='mid', sb=30, sa=20),
        par([run('#5842#', b=True, sz=16)], intbl='mid', sb=0, sa=10),
        p_sel([run('#5832#', b=True, sz=15)], sb=0, sa=20),
    ])
    susulan = sel([par([run('CIRI SUSULAN', b=True, sz=12, sp=60), run('   centang bila terjadi', sz=12)], intbl='mid', sb=20),
                   p_sel([run('#5862#', sz=15)], sb=30, sa=20)])
    s += tabel([{'lebar': [e(4800), LEBAR - e(4800)], 'brd': [(15, 15, 15, 15)] * 2, 'sel': [ciri, susulan]}])
    # pihak
    if banyak:
        fs = 13
        kiri = sel([
            par([run('#5894#', b=True, sz=12, sp=60)], intbl='mid', sb=20),
            par([run('#5898#', b=True, sz=20)], intbl='mid'),
            par([run('#5830#', sz=14)], intbl='mid'),
            p_sel([run('Kuasa: #0106#  #5896#', sz=14)], sb=20, sa=20),
        ])
        kanan = sel([
            par([run('#5895#', b=True, sz=12, sp=60)], intbl='mid', sb=20),
            par([run('#5899#', b=True, sz=20)], intbl='mid'),
            par([run('#5831#', sz=14)], intbl='mid'),
            p_sel([run('Kuasa: #0170#', sz=14)], sb=20, sa=20),
        ])
        if lawan:
            s += tabel([{'lebar': [half, LEBAR - half], 'brd': [(15, 15, 0, 15)] * 2, 'sel': [kiri, kanan]}])
            q = half // 2
            s += tabel([{'lebar': [q, half - q, q, LEBAR - half - q], 'brd': [(0, 15, 15, 10), (0, 10, 15, 15), (0, 15, 15, 10), (0, 10, 15, 15)],
                         'sel': [sel(p_sel([run('#5890#', sz=fs)], sb=10, sa=10)), sel(p_sel([run('#5891#', sz=fs)], sb=10, sa=10)),
                                 sel(p_sel([run('#5892#', sz=fs)], sb=10, sa=10)), sel(p_sel([run('#5893#', sz=fs)], sb=10, sa=10))]}])
        else:
            s += tabel([{'lebar': [LEBAR], 'brd': [(15, 15, 0, 15)], 'sel': [kiri]}])
            s += tabel([{'lebar': [half, LEBAR - half], 'brd': [(0, 15, 15, 10), (0, 10, 15, 15)],
                         'sel': [sel(p_sel([run('#5890#', sz=fs)], sb=10, sa=10)), sel(p_sel([run('#5891#', sz=fs)], sb=10, sa=10))]}])
        s += par([run('#5897#', b=True, sz=12)], sb=10, sa=0)
        s += par([run('#5847#', b=True, sz=12)], sb=0, sa=0)
    elif lawan:
        kiri = sel([
            par([run('#5841#', b=True, sz=12, sp=60)], intbl='mid', sb=20),
            par([run('#0098#', b=True, sz=20)], intbl='mid'),
            par([run('Pekerjaan: #0100#  -  Alamat: #0101#', sz=14)], intbl='mid'),
            p_sel([run('Kuasa: #0106#', sz=14)], sb=20, sa=20),
        ])
        kanan = sel([
            par([run('#8147#', b=True, sz=12, sp=60)], intbl='mid', sb=20),
            par([run('#0102#', b=True, sz=20)], intbl='mid'),
            par([run('Pekerjaan: #0104#  -  Alamat: #0105#', sz=14)], intbl='mid'),
            p_sel([run('Kuasa: #0170#', sz=14)], sb=20, sa=20),
        ])
        s += tabel([{'lebar': [half, LEBAR - half], 'brd': [(15, 15, 15, 15)] * 2, 'sel': [kiri, kanan]}])
    else:
        satu = sel([
            par([run('#5841#', b=True, sz=12, sp=60)], intbl='mid', sb=20),
            par([run('#0098#   #1033#', b=True, sz=20)], intbl='mid'),
            par([run('Pekerjaan: #0100#  -  Alamat: #0101#  #1036#', sz=14)], intbl='mid'),
            p_sel([run('Kuasa: #0106#', sz=14)], sb=20, sa=20),
        ])
        s += tabel([{'lebar': [LEBAR], 'brd': [(15, 15, 15, 15)], 'sel': [satu]}])
    # pokok khas jenis perkara (nama anak dispensasi, nikah yang diitsbatkan, dan seterusnya; kosong bila tidak ada)
    s += par([run('#5843#', sz=15)], sb=20, sa=10)
    # majelis (satu hakim per baris) dan petugas: terisi sesudah PMH/PHS, selebihnya sel kosong untuk ditulis tangan
    w4 = [e(4300), e(2200), e(2200), LEBAR - e(4300) - 2 * e(2200)]
    s += tabel([{'lebar': w4, 'tinggi': 700, 'brd': [K_SEL] * 4,
                 'sel': [kot('MAJELIS / HAKIM TUNGGAL', '#5869#', 13), kot('PANITERA PENGGANTI', '#0015#', 13),
                         kot('JURUSITA / PENGGANTI', '#0018#', 13), kot('PHS / SIDANG PERTAMA', '#1064#', 13)]}])
    # ===== RIWAYAT SIDANG =====
    s += par('', sz=6)
    s += tabel([{'lebar': [LEBAR], 'brd': [(30, 30, 0, 30)], 'shade': [4],
                 'sel': [sel(p_sel([run('RIWAYAT SIDANG', b=True, sz=26, sp=160, cf=5),
                                    run('     %d baris, ditulis tangan tiap sidang; sidang pertama dari PHS' % n_baris, sz=12, cf=5)], sb=40, sa=40))]}])
    w5 = [e(450), e(1950), e(2650), e(1150), LEBAR - e(450) - e(1950) - e(2650) - e(1150)]
    kep = {'lebar': w5, 'brd': [(0, 30, 20, 10)] + [(0, 10, 20, 10)] * 3 + [(0, 10, 20, 30)], 'shade': [2] * 5,
           'sel': [sel(p_sel([run(t, b=True, sz=13, sp=30)], al=a, sb=25, sa=25)) for t, a in
                   (('KE', 'c'), ('TANGGAL', 'l'), ('AGENDA', 'l'), ('HADIR', 'c'), ('HASIL / DITUNDA KE - ALASAN', 'l'))]}
    baris = [kep]
    for n in range(1, n_baris + 1):
        kode = b.KODE_RIWAYAT + (n - 1) * 4
        bb = 30 if n == n_baris else 10
        baris.append({'lebar': w5, 'tinggi': tinggi, 'va': ['c'] * 5,
                      'brd': [(0, 30, bb, 10)] + [(0, 10, bb, 10)] * 3 + [(0, 10, bb, 30)],
                      'sel': [sel(p_sel([run(str(n), b=True, sz=20)], al='c')),
                              sel(p_sel([run('#%d#' % kode, sz=18)])),
                              sel(p_sel([run('#%d#' % (kode + 2), sz=18)])),
                              sel(p_sel([run('#%d#' % (5870 + n - 1), sz=14)], al='c')),
                              sel(p_sel([run('#%d#' % (kode + 3), sz=18)]))]})
    s += tabel(baris)
    # ===== mediasi (hanya perkara berlawanan): satu pita, nama mediator lebar =====
    if lawan:
        s += par('', sz=6)
        wm = [e(4900), e(2300), e(1650), LEBAR - e(4900) - e(2300) - e(1650)]
        s += tabel([
            {'lebar': wm, 'tinggi': 520, 'brd': [(15, 15, 0, 15), (15, 10, 0, 10), (15, 10, 0, 10), (15, 10, 0, 15)], 'va': ['t'] * 4,
             'sel': [kot('MEDIASI  -  MEDIATOR', '#5836#', 16),
                     sel([par([run('MEDIATOR ADALAH', b=True, sz=11, sp=30)], intbl='mid', sb=15),
                          p_sel(kotak_teks('hakim', 14) + ['   '] + kotak_teks('non hakim', 14), sb=10, sa=15)]),
                     kot('DITETAPKAN', '#0055#', 14), kot('LAPORAN', '#8012#', 14)]},
            {'lebar': [LEBAR], 'brd': [(15, 15, 15, 15)],
             'sel': [sel(p_sel([run('Hasil: ', b=True, sz=14), run('#5866#', sz=14)], sb=25, sa=25))]},
        ])
    # ===== putusan (versi 8): tabel label | isi; sampul berhenti di putusan =====
    s += b.judul_bagian('PUTUSAN', sb=80)

    def lab(t):
        return sel(p_sel([run(t, b=True, sz=11, sp=30)], sb=20, sa=20))

    def isi(v, sz=15):
        return sel(p_sel([run(v, b=True, sz=sz)], sb=20, sa=20))
    wl = e(1500)
    s += tabel([
        {'lebar': [wl, e(2600), e(1500), LEBAR - wl - e(2600) - e(1500)], 'tinggi': 330, 'va': ['c'] * 4, 'brd': [K_SEL] * 4,
         'sel': [lab('TANGGAL PUTUS'), isi('#1069#', 16), lab('SIFAT PUTUSAN'), isi('#5864#', 14)]},
        {'lebar': [wl, LEBAR - wl], 'tinggi': 330, 'va': ['c'] * 2, 'brd': [K_SEL] * 2, 'sel': [lab('AMAR'), isi('#5863#', 14)]},
        {'lebar': [wl, LEBAR - wl], 'tinggi': 330, 'va': ['c'] * 2, 'brd': [K_SEL] * 2, 'sel': [lab('KONSEPTOR'), isi('#5865#', 15)]},
    ])
    # ===== catatan (versi 8 dan 9): alasan terdeteksi sebaris + rujukan lampiran; keterangan otomatis + garis tangan =====
    s += b.judul_bagian('CATATAN', sb=60)
    # ALASAN hanya bila ada yang terdeteksi (keputusan Derry 26 Okt): satu paragraf variabel, bukan baris tabel; kosong = tidak tampil
    s += par([run('#5834#', b=True, sz=14)], sb=30, sa=10)
    s += tabel([
        {'lebar': [wl, LEBAR - wl], 'tinggi': 480, 'va': ['t'] * 2, 'brd': [K_SEL] * 2, 'sel': [lab('KETERANGAN'), isi('#5835#', 14)]},
    ])
    if kertas != 'a4':
        s += tabel([{'lebar': [wl, LEBAR - wl], 'tinggi': 330, 'va': ['c'] * 2, 'brd': [K_SEL] * 2, 'sel': [lab('CADANGAN'), isi('', 14)]}])
    s += par([run('Isian bergaris atau berkotak diisi tangan oleh Panitera Pengganti; bila sampul dicetak ulang, data yang sudah ada terisi otomatis.', sz=12)], sb=40)
    s += par([run('#5833#', b=True, sz=12)], sb=10)
    return s + '}\n'
