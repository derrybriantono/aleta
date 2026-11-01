# -*- coding: utf-8 -*-
"""Bagian B paket perbaikan-1nov (keputusan 92, 1 Nov 2026): 5 perbaikan dasar hukum di 14 blangko Derry, persis spesifikasi
hasil/spesifikasi-perbaikan-blangko-1nov.tsv (salinan dari w165 manajemen_surat/scripts/rak-peraturan/hasil/perbaikan-blangko-1nov.tsv).

Tiap perbaikan = beberapa potongan KATA (konteks unik di berkas, teks lama, teks baru); bagian RTF yang terpecah (kode run) tidak disentuh,
hanya kata yang diganti. Berkas diubah HANYA bila md5-nya persis md5 di spesifikasi (= keadaan sesudah 29 paket; sudah dicek cocok).

pakai: python bangun_berkas.py <akar _blangko_abt sesudah 29 paket> <folder paket-satker> <folder hasil>
"""
import base64
import csv
import hashlib
import io
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
SPEK = os.path.join(SINI, '..', 'hasil', 'spesifikasi-perbaikan-blangko-1nov.tsv')


def md5b(b):
    return hashlib.md5(b).hexdigest()


# Potongan per nomor temuan: [(konteks, lama, baru)] - konteks harus ada TEPAT 1x di berkas; lama TEPAT 1x di konteks.
RTF_PETIK_BUKA = '\\uc1 \\u8220 ?'
POTONGAN = {
    '1': [('Pasal 7 ayat (4) huruf a Kompilasi Hukum Islam', ' huruf a', '')],
    '2': [('Pasal 58 ayat (1) huruf b dan huruf c dan Pasal 59 Kompilasi Hukum Islam', ' dan huruf c', '')],
    '3': [
        ('Pasal 35 ayat (1) Undang-Undang Nomor 1 Tahun 1974 Tentang Perkawinan disebutkan ', 'ayat (1)', 'ayat (2)'),
        (RTF_PETIK_BUKA + 'Harta bawaan dari masing-masing suami isteri dan harta benda yang di peroleh masing-masing sebagai hadiah atau warisan adalah di bawah penguasaan',
         'suami isteri dan harta benda yang di peroleh masing-masing sebagai hadiah atau warisan adalah di bawah',
         'suami dan isteri dan harta benda yang diperoleh masing-masing sebagai hadiah atau warisan, adalah dibawah'),
    ],
    '4': [(RTF_PETIK_BUKA + 'Perkawinan hanya diizinkan jika pihak pria dan wanita sudah mencapai usia 19 tahun',
           'jika pihak pria dan wanita sudah mencapai usia 19 tahun',
           'apabila pria dan wanita sudah mencapai umur 19 (sembilan belas) tahun')],
    '5': [('\\lang14345 \\langnp14345 Ayat}{\\rtlch \\fcs1 \\af4 \\afs24 \\ltrch \\fcs0 \\fs24 \\rtlch \\ltrch \\dbch \\af0 \\hich \\af6 \\loch \\f4  1 Undang-Undang Nomor 35 Tahun 2014',
           'Ayat', 'angka')],
}
# Teks polos yang HARUS ada sesudah perbaikan (dan tidak ada sebelumnya) - dicek pada berkas jadi lewat penyusun teks sederhana.
POLOS_BARU = {
    '1': 'Pasal 7 ayat (4) Kompilasi Hukum Islam',
    '2': 'Pasal 58 ayat (1) huruf b dan Pasal 59 Kompilasi Hukum Islam',
    '3': 'Pasal 35 ayat (2) Undang-Undang Nomor 1 Tahun 1974 Tentang Perkawinan disebutkan ',
    '4': 'Perkawinan hanya diizinkan apabila pria dan wanita sudah mencapai umur 19 (sembilan belas) tahun',
    '5': None,
}


def rancang(raw, no):
    pot = []
    for konteks, lama, baru in POTONGAN[no]:
        n = raw.count(konteks)
        assert n == 1, (no, 'konteks muncul %d kali' % n, konteks[:60])
        assert konteks.count(lama) == 1, (no, 'lama tidak tunggal di konteks', lama)
        off = raw.index(konteks) + konteks.index(lama)
        pot.append((off, lama, baru))
    pot.sort()
    for (o1, l1, _), (o2, _l2, _b2) in zip(pot, pot[1:]):
        assert o1 + len(l1) <= o2, 'potongan bertumpuk'
    return pot


def terapkan(raw, pot):
    for off, lama, baru in sorted(pot, key=lambda x: -x[0]):
        assert raw[off:off + len(lama)] == lama
        raw = raw[:off] + baru + raw[off + len(lama):]
    return raw


def seimbang(raw):
    d = 0
    k = 0
    while k < len(raw):
        c = raw[k]
        if c == '\\':
            k += 2
            continue
        if c == '{':
            d += 1
        elif c == '}':
            d -= 1
            if d < 0:
                return False
        k += 1
    return d == 0


def main():
    akar, keluar, hasil = sys.argv[1], sys.argv[2], sys.argv[3]
    for x in (keluar, hasil):
        if not os.path.isdir(x):
            os.makedirs(x)
    with io.open(SPEK, encoding='utf-8', newline='') as f:
        baris = list(csv.reader(f, delimiter='\t'))[1:]
    assert len(baris) == 14, len(baris)
    daftar = []
    for r in baris:
        no, rel, md5_spek = r[0], r[2], r[3]
        rel = 'derry_briantono/' + rel
        b = open(os.path.join(akar, rel), 'rb').read()
        assert md5b(b) == md5_spek, ('md5 dasar BEDA dari spesifikasi', rel, md5b(b), md5_spek)
        raw = b.decode('latin1')
        pot = rancang(raw, no)
        baru = terapkan(raw, pot)
        assert seimbang(baru) and seimbang(raw), rel
        if POLOS_BARU[no]:
            assert POLOS_BARU[no] in baru, (rel, 'teks baru tidak tampak')
        daftar.append((no, rel, b, baru.encode('latin1'), pot, r[1]))
    daftar.sort(key=lambda x: x[1])
    with io.open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as d, \
            io.open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='utf-8', newline='\n') as t:
        d.write(u'# kode\tberkas\tmd5_lama\tmd5_baru\tjumlah potongan - berkas diubah HANYA bila md5 persis md5_lama (keadaan sesudah 29 paket ../URUTAN-PASANG-1nov.md)\n')
        t.write(u'# kode\toffset\tb64(teks lama)\tb64(teks baru)\n')
        for i, (no, rel, lama, baru, pot, _tm) in enumerate(daftar, 1):
            kode = 'K%04d' % i
            d.write(u'%s\t%s\t%s\t%s\t%d\n' % (kode, rel, md5b(lama), md5b(baru), len(pot)))
            for off, a, z in pot:
                t.write(u'%s\t%d\t%s\t%s\n' % (kode, off, base64.b64encode(a.encode('latin1')).decode('ascii'), base64.b64encode(z.encode('latin1')).decode('ascii')))
    with io.open(os.path.join(hasil, 'rincian-berkas.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(u'# kode\ttemuan\tberkas\tpotongan\n')
        for i, (no, rel, lama, baru, pot, tm) in enumerate(daftar, 1):
            o.write(u'K%04d\t%s\t%s\t%d\n' % (i, no, rel, len(pot)))
    # Sisa kemunculan frasa yang SAMA di blangko lain (tidak diubah - di luar spesifikasi; hanya dilaporkan).
    dasar = os.path.join(akar, 'derry_briantono')
    diubah = set(x[1] for x in daftar)
    pola = [('KHI 7(4) huruf a', 'Pasal 7 ayat (4) huruf a'), ('KHI 58(1) huruf c', 'huruf b dan huruf c dan Pasal 59'),
            ('UU 35/2014 Pasal 1 Ayat', 'Pasal 1 Ayat 1 Undang-Undang Nomor 35'), ('UU 1/1974 Ps 35(1) bunyi ayat (2)', 'Pasal 35 ayat (1) Undang-Undang Nomor 1 Tahun 1974 Tentang Perkawinan disebutkan'),
            ('UU 16/2019 usia 19 tahun', 'sudah mencapai usia 19 tahun')]
    sisa = []
    for dp, dn, fn in os.walk(dasar):
        for f in fn:
            if not f.lower().endswith('.rtf'):
                continue
            rel = 'derry_briantono/' + os.path.relpath(os.path.join(dp, f), dasar).replace(os.sep, '/')
            raw = open(os.path.join(dp, f), 'rb').read().decode('latin1')
            for nama, p in pola:
                if p in raw:
                    sisa.append((nama, rel, 'DIUBAH' if rel in diubah else 'masih ada (di luar spesifikasi)'))
    with io.open(os.path.join(hasil, 'sisa-frasa.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(u'# frasa\tberkas\tkeadaan\n')
        for x in sorted(sisa):
            o.write(u'%s\t%s\t%s\n' % x)
    print('BERKAS DIUBAH=%d POTONGAN=%d' % (len(daftar), sum(len(x[4]) for x in daftar)))


if __name__ == '__main__':
    main()
