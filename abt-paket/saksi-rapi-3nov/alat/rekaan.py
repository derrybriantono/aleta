# -*- coding: utf-8 -*-
"""Bentuk RTF REKAAN (nama rekaan) dari blangko Derry SEBELUM/SESUDAH tambalan paket, meniru cara ABT mengisi
variabel keterangan saksi (isian_rtf_ket_saksi -> "-   Bahwa ...<br>..." -> cleanHtmlTagSpecial: "-\\tab Bahwa ... \\par ").
Penanda lain diganti titik-titik pendek. Hanya untuk bukti tampilan (Word -> PDF -> PNG).
pakai: python rekaan.py <akar _blangko_abt> <berkas relatif> <paket-satker> <keluar-sebelum.rtf> <keluar-sesudah.rtf>
"""
import base64
import os
import re
import sys

KET = {
    '9259': ['saksi kenal dengan Penggugat dan Tergugat karena saksi adalah paman Penggugat',
             'Penggugat dan Tergugat adalah suami istri yang menikah pada tahun 2015 dan setelah menikah tinggal bersama di rumah orang tua Tergugat di Desa Rekaan sampai berpisah',
             'saksi tidak tahu apakah Tergugat masih memberikan nafkah kepada Penggugat',
             'sejak awal tahun 2025 rumah tangga Penggugat dan Tergugat tidak harmonis lagi karena sering terjadi perselisihan dan pertengkaran yang disebabkan masalah ekonomi'],
    '9260': ['saksi kenal dengan Penggugat dan Tergugat karena saksi adalah tetangga Penggugat',
             'saksi tidak tahu proses akad jual beli tanah yang disebut Penggugat',
             'Penggugat dan Tergugat telah berpisah tempat tinggal sejak bulan Maret 2025 dan sejak itu tidak pernah rukun kembali sebagai suami istri'],
}
NAMA = {'1197': 'AMINAH REKAAN binti FULAN', '1203': 'HASAN CONTOH bin FULAN', '6132': 'SALMAH CONTOH binti FULAN',
        '6144': 'RAHMAN REKAAN bin FULAN', '8924': 'NURDIN CONTOH bin FULAN', '6100': 'YUSUF REKAAN bin FULAN', '6106': 'HALIMAH CONTOH binti FULAN'}


def ket_rtf(no):
    butir = KET.get(no, KET['9259'] if no in ('9261', '9262', '9263', '9264') else KET['9260'])
    return ' \\par '.join('-\\tab Bahwa %s;' % b for b in butir)


def isi(d):
    d = re.sub(r'\{\\\*\\isian[a-z]*[^{}]*\}', '', d)
    d = re.sub(r'#(9259|926[0-5])#', lambda m: ket_rtf(m.group(1)), d)
    d = re.sub(r'#(\d{4,5})#', lambda m: NAMA.get(m.group(1), '...'), d)
    return d


def main():
    akar, rel, paket, k0, k1 = sys.argv[1:6]
    raw = open(os.path.join(akar, rel), 'rb').read()
    kode = None
    for l in open(os.path.join(paket, 'daftar-tambal.tsv'), encoding='utf-8'):
        b = l.rstrip('\n').split('\t')
        if len(b) > 2 and b[1] == rel:
            kode = b[0]
    pot = []
    for l in open(os.path.join(paket, 'tambal.tsv'), encoding='utf-8'):
        b = l.rstrip('\n').split('\t')
        if b[0] == kode:
            pot.append((int(b[1]), base64.b64decode(b[2]), base64.b64decode(b[3])))
    baru = raw
    for off, lama, t in sorted(pot, key=lambda x: -x[0]):
        assert baru[off:off + len(lama)] == lama
        baru = baru[:off] + t + baru[off + len(lama):]
    open(k0, 'wb').write(isi(raw.decode('latin1')).encode('latin1'))
    open(k1, 'wb').write(isi(baru.decode('latin1')).encode('latin1'))
    print(kode, len(pot), 'potongan')


if __name__ == '__main__':
    main()
