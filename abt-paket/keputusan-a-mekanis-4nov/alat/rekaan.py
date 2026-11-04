# -*- coding: utf-8 -*-
"""RTF REKAAN (nama rekaan) SEBELUM/SESUDAH tambalan paket audit-mekanis-4nov, keadaan MAJELIS atau HAKIM TUNGGAL.
Penanda diganti nilai rekaan (meniru ABT: ganti teks #NNNN# di RTF mentah); penanda lain -> '...'. Hanya untuk bukti tampilan.
pakai: python rekaan_c1.py <akar _blangko_abt> <paket-satker> <berkas relatif> <majelis|tunggal> <keluar-awalan>
 -> <awalan>-sebelum-<keadaan>.rtf, <awalan>-sesudah-<keadaan>.rtf"""
import base64
import os
import re
import sys

KET = {
    '9259': 'saksi kenal dengan para pihak karena saksi adalah paman Penggugat; rumah tangga para pihak tidak harmonis sejak tahun 2025',
    '9260': 'saksi kenal dengan para pihak karena saksi adalah tetangga Penggugat; para pihak telah berpisah tempat tinggal sejak Maret 2025',
}
TETAP = {
    '1197': 'AMINAH REKAAN binti FULAN', '1203': 'HASAN CONTOH bin FULAN',
    '1241': 'PAMAN-SAKSI-SATU', '1242': 'TETANGGA-SAKSI-DUA',
    '1202': 'DESA-SAKSI-SATU', '1208': 'DESA-SAKSI-DUA',
    '1204': '45', '1207': 'Petani', '1201': 'Wiraswasta', '1200': 'SMA', '1206': 'SMA', '1205': 'Islam', '1199': 'Islam', '1198': '50',
    '8171': 'pengurusan akta kelahiran anak dan keperluan lainnya', '0001': '99/Pdt.X/2026/PA.Rekaan', '1064': '5 Januari 2026', '0606': 'SITI REKAAN', '0600': 'BUDI REKAAN', '0601': '18 tahun',
}


def nilai(keadaan, rel):
    v = dict(TETAP)
    maj = keadaan == 'majelis'
    v['8554'] = v['0690'] = 'Majelis Hakim' if maj else 'Hakim'
    v['8555'] = v['4004'] = 'Ketua Majelis' if maj else 'Hakim'
    gugat = ('CG' in rel or 'Gugat' in rel or 'Ekonomi' in rel)
    v['0046'] = 'Penggugat' if gugat else 'Pemohon'
    v['0047'] = 'Tergugat' if gugat else 'Termohon'
    v['0053'] = 'gugatan' if gugat else 'permohonan'
    v.update(KET)
    return v


def isi(d, v):
    d = re.sub(r'\{\\\*\\isian[a-z]*[^{}]*\}', '', d)
    return re.sub(r'#(\d{4,5})#', lambda m: v.get(m.group(1), '...'), d)


def main():
    akar, paket, rel, keadaan, awal = sys.argv[1:6]
    raw = open(os.path.join(akar, rel), 'rb').read()
    kode = None
    for l in open(os.path.join(paket, 'daftar-tambal.tsv'), encoding='utf-8'):
        b = l.rstrip('\n').split('\t')
        if len(b) > 2 and b[1] == rel:
            kode = b[0]
    assert kode, rel
    pot = []
    for l in open(os.path.join(paket, 'tambal.tsv'), encoding='utf-8'):
        b = l.rstrip('\n').split('\t')
        if b[0] == kode:
            pot.append((int(b[1]), base64.b64decode(b[2]), base64.b64decode(b[3])))
    baru = raw
    for off, lama, t in sorted(pot, key=lambda x: -x[0]):
        assert baru[off:off + len(lama)] == lama
        baru = baru[:off] + t + baru[off + len(lama):]
    v = nilai(keadaan, rel)
    open('%s-sebelum-%s.rtf' % (awal, keadaan), 'wb').write(isi(raw.decode('latin1'), v).encode('latin1'))
    open('%s-sesudah-%s.rtf' % (awal, keadaan), 'wb').write(isi(baru.decode('latin1'), v).encode('latin1'))
    print(kode, len(pot), 'potongan', rel)


if __name__ == '__main__':
    main()
