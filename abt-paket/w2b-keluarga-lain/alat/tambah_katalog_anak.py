# -*- coding: utf-8 -*-
"""Menambah butir ke katalog saksi hak-asuh, penguasaan-anak, nafkah-anak (agen W2b-B, 21 Okt 2026).

  python tambah_katalog_anak.py            -> tulis ke ekstensi-sipp/saksi-katalog/*.json (cadangan asli di ../cadangan-katalog/ sekali saja)
  python tambah_katalog_anak.py --kering   -> hanya periksa (tanpa menulis)

Hanya MENAMBAH (butir, pokok, dasar hukum, keadaan lama tidak dihapus) dan menaikkan `versi` +1. Dijalankan dari katalog ASLI
(cadangan) sehingga aman diulang. Setelah menulis: dari manajemen_surat/ `node scripts/susun-saksi-katalog.mjs`.
"""
import copy
import io
import json
import os
import shutil
import sys

AKAR_ALAT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AKAR_ALAT)
REPO = os.path.abspath(os.path.join(AKAR_ALAT, '..', '..', '..'))
KAT = os.path.join(REPO, 'ekstensi-sipp', 'saksi-katalog')
CAD = os.path.join(AKAR_ALAT, '..', 'cadangan-katalog')

import katalog_anak as M  # noqa: E402

CATATAN = {
    'hak-asuh.json': [
        'Pilih pihak yang mengasuh anak sekarang dan keadaan pihak yang dipersoalkan pada borang agar butir yang sesuai ikut diajukan; pilihan itu hanya menentukan pertanyaan, bukan putusan.',
        'Jawaban saksi hanya kerangka dari isian perkara; sesuaikan dengan keterangan saksi yang sesungguhnya dan jangan biarkan titik-titik atau isian kosong.',
        'Pendapat anak yang sudah mumayyiz (12 tahun) didengar langsung oleh hakim; keterangan saksi tentang pilihan anak hanya pelengkap.',
    ],
    'penguasaan-anak.json': [
        'Pilih dasar penguasaan dan pihak yang sekarang menguasai anak pada borang; pilihan itu hanya menentukan pertanyaan, bukan putusan.',
        'Jawaban saksi hanya kerangka dari isian perkara; sesuaikan dengan keterangan saksi yang sesungguhnya dan jangan biarkan titik-titik atau isian kosong.',
        'Butir tentang pengalihan penguasaan dan penyerahan anak hanya diajukan bila dituntut dalam gugatan.',
    ],
    'nafkah-anak.json': [
        'Pilih jenis nafkah yang dituntut dan kemampuan ayah pada borang agar butir yang sesuai ikut diajukan; besaran nafkah yang dikabulkan tetap pilihan majelis.',
        'Jawaban saksi hanya kerangka dari isian perkara; sesuaikan dengan keterangan saksi yang sesungguhnya dan jangan biarkan titik-titik atau isian kosong.',
        'Nafkah lampau hanya dapat dituntut oleh ibu atau pengasuh nyata yang telah menanggung biaya anak; tanyakan hanya bila dituntut dalam gugatan.',
    ],
}


def baca(nama):
    asli = os.path.join(CAD, nama)
    if not os.path.exists(asli):
        os.makedirs(CAD, exist_ok=True)
        shutil.copyfile(os.path.join(KAT, nama), asli)
    return json.load(io.open(asli, encoding='utf-8'))


def tulis(nama, kat):
    kat['pertanyaan'].sort(key=lambda q: q['urutan'])
    io.open(os.path.join(KAT, nama), 'w', encoding='utf-8', newline='\n').write(json.dumps(kat, ensure_ascii=False, indent=2) + '\n')


def tambah_daftar(dst, baru, kunci='id'):
    ada = {x[kunci] for x in dst}
    for x in baru:
        assert x[kunci] not in ada, 'kembar %s' % x[kunci]
        dst.append(copy.deepcopy(x))


def bangun_jenis(nama, modul):
    k = baca(nama)
    k['versi'] += 1
    tambah_daftar(k['dasarHukum'], [d for d in modul.DASAR_BARU if d['id'] not in {x['id'] for x in k['dasarHukum']}])
    for n, v in modul.KEADAAN_BARU.items():
        assert n not in k['keadaan'], n
        k['keadaan'][n] = copy.deepcopy(v)
    tambah_daftar(k['pokokPembuktian'], modul.POKOK_BARU)
    baru = [M.bangun(sp) for sp in modul.SPEC]
    masalah = []
    for q in baru:
        masalah += M.periksa(q)
    tambah_daftar(k['pertanyaan'], baru)
    k['catatanPetugas'] = k['catatanPetugas'] + CATATAN[nama]
    urut = [q['urutan'] for q in k['pertanyaan']]
    assert len(urut) == len(set(urut)), 'urutan kembar di %s: %s' % (nama, sorted(u for u in urut if urut.count(u) > 1))
    return k, baru, masalah


def main():
    kering = '--kering' in sys.argv
    import isi_hak_asuh as HA
    daftar = [('hak-asuh.json', HA)]
    try:
        import isi_penguasaan as PA
        daftar.append(('penguasaan-anak.json', PA))
    except ModuleNotFoundError as e:
        if e.name != 'isi_penguasaan':
            raise
    try:
        import isi_nafkah as NA
        daftar.append(('nafkah-anak.json', NA))
    except ModuleNotFoundError as e:
        if e.name != 'isi_nafkah':
            raise
    hasil = {}
    semua_masalah = []
    for nama, mod in daftar:
        k, baru, masalah = bangun_jenis(nama, mod)
        hasil[nama] = k
        semua_masalah += ['%s: %s' % (nama, m) for m in masalah]
        print('%s: +%d butir, total %d, versi %d' % (nama, len(baru), len(k['pertanyaan']), k['versi']))
    for m in semua_masalah:
        print('MASALAH', m)
    if not kering and not semua_masalah:
        for nama, k in hasil.items():
            tulis(nama, k)
        print('ditulis')
    elif semua_masalah:
        print('TIDAK ditulis: %d masalah' % len(semua_masalah))
        sys.exit(1)


if __name__ == '__main__':
    main()
