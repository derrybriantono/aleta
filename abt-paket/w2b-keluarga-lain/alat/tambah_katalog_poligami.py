# -*- coding: utf-8 -*-
"""Menambah butir ke katalog saksi izin-poligami, pencegahan-perkawinan, pembatalan-perkawinan (agen W2b-A, 20-21 Okt 2026).

  python tambah_katalog_poligami.py            -> tulis ke ekstensi-sipp/saksi-katalog/*.json (cadangan asli di ../cadangan-katalog/ sekali saja)
  python tambah_katalog_poligami.py --kering   -> hanya periksa (tanpa menulis)
  python tambah_katalog_poligami.py isi_pencegahan [--kering] -> hanya jenis itu (modul yang disebut)

Hanya MENAMBAH (butir, pokok, dasar hukum, keadaan lama tidak dihapus) dan menaikkan `versi` +1. Selalu dijalankan dari katalog ASLI
(cadangan) sehingga aman diulang. Setelah menulis: dari manajemen_surat/ `node scripts/susun-saksi-katalog.mjs`.

Tiap jenis punya modul isi (antarmuka sama):
  isi_poligami.py -> izin-poligami.json | isi_pencegahan.py -> pencegahan-perkawinan.json | isi_pembatalan.py -> pembatalan-perkawinan.json
  KATALOG (nama berkas), FORM {nama: dict(sfx, keadaan, PAS, PRIA, WAN, PEM, LAWAN, URUT)}, BENTUK (nama FORM yang dipakai),
  DASAR_BARU, KEADAAN_BARU, POKOK_BARU, SPEC, CATATAN, VARBARU (variabel ABT baru yang dipakai butir; boleh kosong).
"""
import copy
import importlib
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

import katalog_mesin_w2b as M  # noqa: E402

MODUL = ['isi_poligami', 'isi_pencegahan', 'isi_pembatalan']


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
        ada.add(x[kunci])


def susun(mod):
    k = baca(mod.KATALOG)
    k['versi'] += 1
    M.FORM.clear()
    M.FORM.update(mod.FORM)
    tambah_daftar(k['dasarHukum'], mod.DASAR_BARU)
    for n, v in mod.KEADAAN_BARU.items():
        assert n not in k['keadaan'], 'keadaan kembar ' + n
        k['keadaan'][n] = copy.deepcopy(v)
    tambah_daftar(k['pokokPembuktian'], mod.POKOK_BARU)
    baru = []
    for sp in mod.SPEC:
        baru += M.bangun_semua(sp, list(mod.BENTUK))
    tambah_daftar(k['pertanyaan'], baru)
    vb = sorted(set(k.get('variabelBaru', [])) | set(getattr(mod, 'VARBARU', [])))
    pakai = set()
    for q in k['pertanyaan']:
        pakai |= set(q['variabelAbt'])
    vb = [v for v in vb if v in pakai]
    if vb:
        k['variabelBaru'] = vb
    k['catatanPetugas'] = k['catatanPetugas'] + list(mod.CATATAN)
    urut = [q['urutan'] for q in k['pertanyaan']]
    assert len(urut) == len(set(urut)), 'urutan kembar di %s: %s' % (mod.KATALOG, sorted({u for u in urut if urut.count(u) > 1}))
    salah = list(M.ERR)
    del M.ERR[:]
    for q in baru:
        salah += M.diagnosa(q)
    return k, baru, salah


def main():
    kering = '--kering' in sys.argv
    hasil = {}
    semua_salah = []
    pilih = [a for a in sys.argv[1:] if not a.startswith('--')]
    for nama in (pilih or MODUL):
        try:
            mod = importlib.import_module(nama)
        except ModuleNotFoundError as e:
            if e.name != nama:
                raise
            print('(lewati %s: belum ada)' % nama)
            continue
        k, baru, salah = susun(mod)
        hasil[mod.KATALOG] = (k, len(baru))
        semua_salah += salah
        print('%s: +%d butir, total %d, pokok %d, versi %d' % (mod.KATALOG, len(baru), len(k['pertanyaan']), len(k['pokokPembuktian']), k['versi']))
    for s in semua_salah[:80]:
        print('DIAGNOSA', s)
    if not kering and not semua_salah:
        for nama, (k, _n) in hasil.items():
            tulis(nama, k)
    elif semua_salah:
        print('tidak menulis: %d temuan diagnosa' % len(semua_salah))
        sys.exit(1)


if __name__ == '__main__':
    main()
