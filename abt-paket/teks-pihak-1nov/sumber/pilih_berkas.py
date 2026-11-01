# -*- coding: utf-8 -*-
"""Pilih berkas sasaran tiap kelompok ubahan dari pohon blangko (keadaan sesudah 25 paket). Murni baca."""
import os
import re

import ubah_blangko as U

BS = chr(92)


def aktif(rel):
    return 'terhapus' not in rel.lower()


def semua_rtf(akar):
    for d, _, fs in os.walk(akar):
        for f in fs:
            if f.lower().endswith('.rtf'):
                rel = os.path.relpath(os.path.join(d, f), akar).replace(os.sep, '/')
                if aktif(rel):
                    yield rel


def terlihat(raw, n):
    sp = U.spans_grup(raw)
    return any(not U.di_dalam(m.start(), sp) for m in re.finditer('#%s#' % n, raw))


def rancang(akar):
    """-> {kelompok: [(rel, raw, edits, catatan)]} , lewat [(kelompok, rel, alasan)]"""
    hasil = {'kesimpulan': [], 'kecil': [], 'aua': [], 'bas': []}
    lewat = []
    for rel in sorted(semua_rtf(akar)):
        raw = open(os.path.join(akar, rel), 'rb').read().decode('latin1')
        if terlihat(raw, '9255') and terlihat(raw, '9256'):
            try:
                hasil['kesimpulan'].append((rel, raw, U.kesimpulan_putusan(raw), []))
            except U.Lewat as e:
                lewat.append(('kesimpulan', rel, str(e)))
        if any(terlihat(raw, n) for n in U.KECIL):
            try:
                hasil['kecil'].append((rel, raw, U.huruf_kecil(raw), []))
            except U.Lewat as e:
                lewat.append(('kecil', rel, str(e)))
        if rel.startswith('8 Asal Usul Anak/') and '#12064#' in raw and 'telah menyerahkan alat bukti surat berupa:' in raw:
            try:
                hasil['aua'].append((rel, raw, U.aua_bukti(raw), []))
            except U.Lewat as e:
                lewat.append(('aua', rel, str(e)))
        elif 'menyatakan telah cukup dengan bukti suratnya' in raw and (terlihat(raw, '12040') or terlihat(raw, '12045')):
            catat = []
            try:
                hasil['bas'].append((rel, raw, U.bas_bukti(raw, catat), catat))
            except U.Lewat as e:
                lewat.append(('bas', rel, str(e)))
    return hasil, lewat


if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    h, l = rancang(sys.argv[1])
    for k, v in h.items():
        print(k, len(v), 'berkas;', sum(len(x[2]) for x in v), 'suntingan;', sum(1 for x in v if x[3]), 'berkas dengan kejadian dilewati')
    for x in l:
        print('LEWAT', x)
