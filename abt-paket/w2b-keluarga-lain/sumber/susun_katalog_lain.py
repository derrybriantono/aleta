# -*- coding: utf-8 -*-
"""Menambah butir ke katalog saksi keluarga LAIN-LAIN (agen W2b-C, 21 Okt 2026): pengangkatan-anak, mafqud, permohonan-umum.

  python susun_katalog_lain.py            -> tulis ke ekstensi-sipp/saksi-katalog/*.json (cadangan asli di ../cadangan-katalog/ sekali saja)
  python susun_katalog_lain.py --kering   -> hanya periksa (tanpa menulis)
  python susun_katalog_lain.py mafqud     -> hanya satu jenis (kunci katalog)

Tiap jenis punya modul sumber/kat_<nama>.py dengan atribut:
  KUNCI        kunci katalog ('pengangkatan-anak' | 'mafqud' | 'permohonan-umum')
  DASAR_BARU   daftar dasar hukum baru (id, rujukan, uraian, status terverifikasi|perlu-verifikasi, sumber)
  KEADAAN_BARU kamus keadaan baru (sumber 'borang', nilai, label, bawaan)
  POKOK_BARU   daftar pokok pembuktian baru
  SPEC         daftar spesifikasi butir (lihat alat/katalog_mesin.py)
  CATATAN      daftar catatan petugas tambahan
  VARBARU      kode variabel ABT baru (jatah 4910-4939) yang dipakai butir
  KELUARAN_TAMBAHAN (opsional) fungsi(kat) untuk penyesuaian akhir
Hanya MENAMBAH (butir, pokok, dasar hukum, keadaan lama tidak dihapus) dan menaikkan `versi` +1. Dijalankan dari katalog ASLI
(cadangan), sehingga aman diulang. Setelah menulis: node manajemen_surat/scripts/susun-saksi-katalog.mjs (dijalankan agen induk/sesi utama).
"""
import copy
import importlib
import io
import json
import os
import shutil
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(AKAR, 'alat'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.abspath(os.path.join(AKAR, '..', '..'))
KAT = os.path.join(REPO, 'ekstensi-sipp', 'saksi-katalog')
CAD = os.path.join(AKAR, 'cadangan-katalog')

import katalog_mesin as M  # noqa: E402

MODUL = ['kat_pengangkatan', 'kat_mafqud', 'kat_umum']


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
        ada.add(x[kunci])
        dst.append(copy.deepcopy(x))


def susun(mod):
    k = baca(mod.KUNCI + '.json')
    k['versi'] += 1
    tambah_daftar(k['dasarHukum'], getattr(mod, 'DASAR_BARU', []))
    for n, v in getattr(mod, 'KEADAAN_BARU', {}).items():
        assert n not in k['keadaan'], 'keadaan kembar ' + n
        k['keadaan'][n] = copy.deepcopy(v)
    tambah_daftar(k['pokokPembuktian'], getattr(mod, 'POKOK_BARU', []))
    baru = []
    for sp in mod.SPEC:
        baru += M.bangun_semua(sp)
    semua_d = []
    for q in baru:
        semua_d += M.diagnosa(q)
    if semua_d:
        for baris_d in semua_d:
            print(baris_d)
        raise SystemExit('diagnosa: %d masalah di %s' % (len(semua_d), mod.KUNCI))
    tambah_daftar(k['pertanyaan'], baru)
    k['catatanPetugas'] = k['catatanPetugas'] + list(getattr(mod, 'CATATAN', []))
    pakai = set()
    for q in k['pertanyaan']:
        pakai |= set(q['variabelAbt'])
    vb = set(k.get('variabelBaru', [])) | set(getattr(mod, 'VARBARU', []))
    k['variabelBaru'] = sorted(v for v in vb if v in pakai)
    if not k['variabelBaru']:
        del k['variabelBaru']
    urut = [q['urutan'] for q in k['pertanyaan']]
    assert len(urut) == len(set(urut)), 'urutan kembar di %s: %s' % (mod.KUNCI, sorted(u for u in urut if urut.count(u) > 1))
    if hasattr(mod, 'KELUARAN_TAMBAHAN'):
        mod.KELUARAN_TAMBAHAN(k)
    return k, baru


def main():
    kering = '--kering' in sys.argv
    pilih = [a for a in sys.argv[1:] if not a.startswith('--')]
    hasil = {}
    for nama in MODUL:
        try:
            mod = importlib.import_module(nama)
        except ModuleNotFoundError as e:
            if e.name != nama:
                raise
            continue
        if pilih and mod.KUNCI not in pilih:
            continue
        k, baru = susun(mod)
        hasil[mod.KUNCI + '.json'] = (k, len(baru))
        print('%s: +%d butir, total %d, versi %d' % (mod.KUNCI, len(baru), len(k['pertanyaan']), k['versi']))
    if not kering:
        for nama, (k, _n) in hasil.items():
            tulis(nama, k)


if __name__ == '__main__':
    main()
