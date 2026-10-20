# -*- coding: utf-8 -*-
"""Membangun SEMUA berkas RTF paket (folder rtf/derry_briantono/...) dari spek_*.py. Jenis yang spek-nya belum ada dilewati.
Pakai: python bangun_semua.py [kunci ...]   (kunci: 353 355 356 357 350 eksekusi verzet; kosong = semua)
Lalu: python bangun_paket.py"""
import importlib
import os
import shutil
import sys

import bas
import gugatan
import permohonan
from jenis import JENIS
from pustaka import KELUAR, lp


def bangun(kunci):
    J = JENIS[kunci]
    try:
        modul = importlib.import_module(J['modul'])
    except ModuleNotFoundError as e:
        if e.name != J['modul']:
            raise
        print('LEWATI %s (spek belum ada)' % kunci)
        return None
    S = modul.SPEK
    S['alur'] = J['alur']
    S['nama_pendek'] = J['nama_pendek']
    for f in (S['folder'], S['folder'] + ' - BAS'):
        d = os.path.join(KELUAR, f)
        if os.path.isdir(lp(d)):
            shutil.rmtree(lp(d))
    n = 0
    if hasattr(modul, 'bangun'):
        n += modul.bangun(S)
    else:
        if 'gugatan' in S:
            n += len(gugatan.susun_semua(S))
            n += len(bas.klon_gugatan(S))
        if 'permohonan' in S:
            n += len(permohonan.susun_semua(S))
            n += len(bas.klon_permohonan(S))
    print('%s: %d berkas -> %s' % (kunci, n, S['folder']))
    return S


if __name__ == '__main__':
    kunci = sys.argv[1:] or list(JENIS)
    for k in kunci:
        bangun(k)
