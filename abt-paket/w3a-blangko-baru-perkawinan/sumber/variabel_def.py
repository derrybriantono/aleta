# -*- coding: utf-8 -*-
"""Registri variabel ABT BARU paket abt-w3a-blangko-baru-perkawinan (jatah 3600-3799).

Tiap modul jenis memanggil V(...) untuk mendefinisikan variabelnya. Aturan:
  - nomor harus di dalam jatah jenis (w3a_lib.JENIS[...]['var']) atau jatah bersama (3790-3799);
  - tipe: 'data_teks' (isian petugas; boleh `default` = isi bawaan popup), 'data_tanggal', atau 'data_sql' (hanya SELECT, MariaDB 5.5, kolom hasil `data`,
    penanda #perkara_id# dan #nnnn# diganti ABT sebelum dijalankan);
  - nama TANPA kata "ALETA"/"Aleta"; boleh memakai penanda #0046# dst. di dalam nama (ABT mengganti);
  - kueri membaca isian petugas dengan "#nnnn#" (bukan membaca abt_data_teks langsung) kecuali butuh membedakan 'kosong' dari 'belum ada'.
"""
VAR = []


def V(no, nama, tipe, sql=None, default=None):
    if tipe not in ('data_teks', 'data_tanggal', 'data_sql'):
        raise ValueError('tipe %s' % tipe)
    if tipe == 'data_sql' and not sql:
        raise ValueError('variabel %d data_sql tanpa kueri' % no)
    if tipe != 'data_sql' and sql:
        raise ValueError('variabel %d bukan data_sql tetapi punya kueri' % no)
    if not (3600 <= no <= 3799):
        raise ValueError('nomor %d di luar jatah 3600-3799' % no)
    if any(x['no'] == no for x in VAR):
        raise ValueError('nomor %d dipakai dua kali' % no)
    if 'aleta' in (nama + (sql or '') + (default or '')).lower():
        raise ValueError('variabel %d memuat kata aleta' % no)
    VAR.append(dict(no=no, nama=nama, tipe=tipe, sql=sql, default=default))
