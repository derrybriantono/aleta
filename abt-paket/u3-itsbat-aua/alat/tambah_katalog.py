# -*- coding: utf-8 -*-
"""Menambah butir ke katalog saksi itsbat-nikah, asal-usul-anak, cerai-kumulasi-itsbat (agen U3, 20 Okt 2026).

  python tambah_katalog.py            -> tulis ke ekstensi-sipp/saksi-katalog/*.json (cadangan asli di ../cadangan-katalog/ sekali saja)
  python tambah_katalog.py --kering   -> hanya periksa (tanpa menulis)

Hanya MENAMBAH (butir, pokok, dasar hukum, keadaan lama tidak dihapus) dan menaikkan `versi` +1. Dijalankan dari katalog ASLI
(cadangan), sehingga aman diulang. Setelah menulis: node manajemen_surat/scripts/susun-saksi-katalog.mjs.
"""
import copy, io, json, os, shutil, sys

AKAR_ALAT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AKAR_ALAT)
REPO = os.path.abspath(os.path.join(AKAR_ALAT, '..', '..', '..'))
KAT = os.path.join(REPO, 'ekstensi-sipp', 'saksi-katalog')
CAD = os.path.join(AKAR_ALAT, '..', 'cadangan-katalog')

import katalog_mesin as M  # noqa: E402
import isi_itsbat as IT  # noqa: E402
import isi_aua as AU  # noqa: E402

KUMULASI_SPEC = ['persetujuan', 'hadirin', 'wali-syarat', 'wali-urutan', 'saksi-syarat', 'saksi-hadir', 'kabul-pribadi',
                 'mahar-serah', 'iddah', 'hidup-bersama', 'dasar-a', 'dasar-d', 'ket-kua']

CATATAN_IN = [
    'Pilih "Dasar itsbat nikah" (Pasal 7 ayat (3) KHI) sesuai pertimbangan majelis; pilihan itu hanya menentukan pertanyaan yang diajukan, bukan putusan.',
    'Untuk saksi yang tidak menyaksikan akad (syahadah al-istifadhah) pilih "Cara saksi mengetahui pernikahan" = kabar yang tersiar luas; dasar hukumnya masih perlu dicocokkan pada naskah resmi.',
    'Pertanyaan dan jawaban hanyalah kerangka dari isian perkara; sesuaikan dengan keterangan saksi yang sesungguhnya dan jangan biarkan titik-titik.',
]


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


def itsbat():
    k = baca('itsbat-nikah.json')
    k['versi'] += 1
    tambah_daftar(k['dasarHukum'], IT.DASAR_BARU)
    for n, v in IT.KEADAAN_BARU.items():
        assert n not in k['keadaan']
        k['keadaan'][n] = copy.deepcopy(v)
    tambah_daftar(k['pokokPembuktian'], IT.POKOK_BARU)
    baru = []
    for sp in IT.SPEC:
        baru += M.bangun_semua(sp)
    tambah_daftar(k['pertanyaan'], baru)
    k['variabelBaru'] = sorted(set(k.get('variabelBaru', [])) | VARBARU)
    k['catatanPetugas'] = k['catatanPetugas'] + CATATAN_IN
    return k, baru


def aua():
    k = baca('asal-usul-anak.json')
    k['versi'] += 1
    tambah_daftar(k['pokokPembuktian'], AU.POKOK_BARU)
    baru = []
    for sp in AU.SPEC:
        baru += M.bangun_semua(sp)
    tambah_daftar(k['pertanyaan'], baru)
    k['variabelBaru'] = sorted(set(k.get('variabelBaru', [])) | VARBARU)
    return k, baru


def kumulasi():
    k = baca('cerai-kumulasi-itsbat.json')
    k['versi'] += 1
    for n, v in IT.KEADAAN_BARU.items():
        k['keadaan'][n] = copy.deepcopy(v)
    dasar_ada = {d['id'] for d in k['dasarHukum']}
    tambah_daftar(k['dasarHukum'], [d for d in IT.DASAR_BARU if d['id'] not in dasar_ada])
    pakai = [sp for sp in IT.SPEC if sp['id'] in KUMULASI_SPEC]
    pokok_pakai = {sp['pokok'] for sp in pakai}
    for p in IT.POKOK_BARU:
        if p['id'] in pokok_pakai:
            p2 = copy.deepcopy(p)
            p2['keadaan'] = dict(p2.get('keadaan', {}), kumulasi='itsbat-nikah')
            k['pokokPembuktian'].append(p2)
    # pokok lama yang dipakai butir km sudah ada dengan keadaan kumulasi
    baru = []
    for sp in pakai:
        sp2 = dict(sp, bentuk=('km',))
        sp2.pop('peran', None) if False else None
        baru += M.bangun_semua(sp2)
    ada_pokok = {p['id'] for p in k['pokokPembuktian']}
    for q in baru:
        assert q['pokok'] in ada_pokok, q['pokok']
    tambah_daftar(k['pertanyaan'], baru)
    k['variabelBaru'] = sorted(set(k.get('variabelBaru', [])) | VARBARU)
    return k, baru


VARBARU = {'4301', '4302', '4310', '4311', '9709', '9710'}


def main():
    kering = '--kering' in sys.argv
    hasil = {}
    for nama, fn in (('itsbat-nikah.json', itsbat), ('asal-usul-anak.json', aua), ('cerai-kumulasi-itsbat.json', kumulasi)):
        k, baru = fn()
        # variabelBaru hanya yang dipakai katalog itu
        pakai = set()
        for q in k['pertanyaan']:
            pakai |= set(q['variabelAbt'])
        k['variabelBaru'] = sorted(v for v in k['variabelBaru'] if v in pakai)
        if not k['variabelBaru']:
            del k['variabelBaru']
        urut = [q['urutan'] for q in k['pertanyaan']]
        assert len(urut) == len(set(urut)), 'urutan kembar di %s' % nama
        hasil[nama] = (k, len(baru))
        print('%s: +%d butir, total %d, versi %d' % (nama, len(baru), len(k['pertanyaan']), k['versi']))
    if not kering:
        for nama, (k, _n) in hasil.items():
            tulis(nama, k)


if __name__ == '__main__':
    main()
