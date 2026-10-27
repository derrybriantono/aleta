# -*- coding: utf-8 -*-
"""RTF CEKLIST BERKAS PERKARA (Meja I / Pendaftaran), pasangan sampul cetak awal (26 Okt 2026). Rancangan: docs/rancangan/sampul-daftar-isi-26okt/artifact-ceklist-berkas.html.

Kerangka (kop, kotak MEJA I, judul, nomor, penanda jenis, identitas, tanda tangan, kaki) memakai variabel ABT; TABEL dokumen disusun portal (daftar dokumen
mengikuti jenis dan keadaan perkara) dan menggantikan paragraf penanda #5850#. Satu lembar A4 (F4 dan Legal juga disediakan)."""
import bangun_rtf as b


def ceklist(kertas='a4'):
    b.pilih_kertas(kertas)
    LEBAR = b.HAL[0] - 1400
    run, par, p_sel, sel, tabel, K_SEL = b.run, b.par, b.p_sel, b.sel, b.tabel, b.K_SEL

    def e(x):
        return int(x * LEBAR / 10506)
    s = b.kepala_rtf()
    # kop berlogo + kotak MEJA I / PENDAFTARAN
    s += b.kop_logo('Kepaniteraan  -  pemeriksaan kelengkapan berkas pendaftaran', 'MEJA I', lebar_total=LEBAR, kanan_ket='PENDAFTARAN')
    # judul, nomor, penanda jenis
    s += tabel([{
        'lebar': [e(6000), LEBAR - e(6000)], 'brd': [(0, 0, 0, 0), (30, 30, 30, 30)], 'va': ['c', 'c'],
        'sel': [sel([par([run('CEKLIST BERKAS PERKARA', b=True, sz=30, sp=40)], intbl='mid', sb=60), p_sel([run('Nomor #0001#', b=True, sz=22)], sb=20, sa=40)]),
                sel([par([run('JENIS PERKARA', b=True, sz=11, sp=60)], al='c', intbl='mid', sb=30), p_sel([run('#5860#', b=True, sz=22, sp=20)], al='c', sa=40)])],
    }])
    # identitas pihak dan tanggal daftar (+ e-Court bila e-Court; non e-Court tidak disebut)
    t3 = LEBAR // 3

    def kot(l, v, sz=15):
        return sel([par([run(l, b=True, sz=11, sp=30)], intbl='mid', sb=25, sa=25), p_sel([run(v, b=True, sz=sz)], sa=25)])
    s += tabel([{'lebar': [t3, t3, LEBAR - 2 * t3], 'brd': [K_SEL] * 3,
                 'sel': [kot('PIHAK I', '#0098#'), kot('PIHAK II', '#0102#'), kot('DIDAFTARKAN', '#1061#  #5803#')]}])
    s += par('', sz=8)
    # tabel dokumen disusun portal: paragraf penanda
    s += par([run('#5850#', sz=14)], sb=0, sa=40)
    s += par([run('#5848#', b=True, sz=15)], sb=60, sa=40)
    # tanda tangan: kiri PP (nama dari penetapan PPP), kanan petugas Meja I
    w2 = LEBAR // 2
    s += tabel([{'lebar': [w2, LEBAR - w2], 'brd': [(0, 0, 0, 0)] * 2, 'tinggi': 1500,
                 'sel': [sel([par([run('Mengetahui,', sz=16)], al='c', intbl='mid', sb=20), par([run('Panitera Pengganti', sz=16)], al='c', intbl='mid', sa=700),
                              p_sel([run('#5849#', b=True, sz=17)], al='c')]),
                         sel([par([run('#5855#', sz=16)], al='c', intbl='mid', sb=20), par([run('Petugas Meja I', sz=16)], al='c', intbl='mid', sa=700),
                              p_sel([run('#5838#', b=True, sz=17)], al='c')])]}])
    s += par(['{\\f1\\u10003?}', run(' OTO / ', sz=12), '{\\f1\\u10007?}', run(' OTO = terbaca otomatis dari e-Court, e-Doc, penetapan, atau kasir; kotak kosong = diperiksa dan dicentang petugas Meja I.', sz=12)], sb=40)
    s += par([run('Dicetak otomatis dari data perkara.', sz=12)], sb=10)
    return s + '}\n'
