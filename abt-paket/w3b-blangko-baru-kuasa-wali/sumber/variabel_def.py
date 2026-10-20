# -*- coding: utf-8 -*-
"""Definisi variabel ABT BARU paket w3b-blangko-baru-kuasa-wali (jatah nomor 3800-3999).

Setiap entri: no, nama (tanpa kata ALETA, <= 200 huruf), tipe ('data_teks' | 'data_tanggal' | 'data_sql' | 'terbilang'),
sql (untuk data_sql), default (data_teks, boleh kosong), referensi (terbilang: nomor variabel angka murni).
Aturan: kueri hanya SELECT, MariaDB 5.5, kolom hasil bernama `data`; penanda #perkara_id# dan #nnnn# diganti ABT sebelum dijalankan.
Teks keluaran memakai ejaan baku. Isian bebas dibaca lewat isi(n) (bukan "#nnnn#" langsung) agar tanda kutip/garis miring pada isian
tidak merusak kueri (pola yang sama dengan variabel 9759 dan 9342 di server).

Pembagian jatah nomor (dijaga oleh uji paket):
  3800-3829 pencabutan kekuasaan orang tua (353)      3830-3859 pencabutan kekuasaan wali (355)
  3860-3889 penunjukan orang lain sebagai wali (356)  3890-3919 ganti rugi terhadap wali (357)
  3920-3939 nafkah anak oleh ibu karena ayah tidak mampu (350)
  3940-3969 eksekusi                                   3970-3999 verzet (perlawanan atas putusan verstek)
"""

VAR = []
PANJANG = []   # nomor yang namanya > 200 huruf (varchar(200)); bangun_paket menolak bila tidak kosong
BATAS = (3800, 3999)


def v(no, nama, tipe, sql=None, default=None, referensi=None):
    assert BATAS[0] <= no <= BATAS[1], no
    if len(nama) > 200:
        PANJANG.append((no, len(nama)))
    assert 'aleta' not in (nama + (sql or '') + (default or '')).lower(), no
    VAR.append(dict(no=no, nama=nama, tipe=tipe, sql=sql, default=default, referensi=referensi))


def isi(n):
    """Ungkapan SQL: isian data_teks nomor n untuk perkara ini (kosong bila tidak ada), aman dari tanda kutip dan garis miring."""
    return ("TRIM(IFNULL(REPLACE(REPLACE(REPLACE(CONVERT((SELECT data FROM aps_badilag.abt_data_teks WHERE no_var = %d AND perkara_id = '#perkara_id#' LIMIT 1) "
            "USING utf8), '\\\\', '/'), '\"', '&quot;'), '''', '&#39;'), ''))" % n)


def ada(n):
    """Ungkapan SQL boolean: isian n terisi."""
    return "%s <> ''" % isi(n)


def pilihan_huruf(n, huruf):
    """Ungkapan SQL boolean: isian pilihan huruf n memuat huruf (besar) tersebut sebagai butir tersendiri (mis. 'A, C' atau 'AC')."""
    return "LOCATE('%s', UPPER(%s)) > 0" % (huruf, isi(n))


def bil_romawi(n):  # kecil, dipakai teks
    return n


import importlib  # noqa: E402

for _modul in ('variabel_353', 'variabel_355', 'variabel_356', 'variabel_357', 'variabel_350', 'variabel_eksekusi', 'variabel_verzet'):
    try:
        importlib.import_module(_modul)
    except ModuleNotFoundError as _e:  # modul jenis yang belum disusun dilewati
        if _e.name != _modul:
            raise
