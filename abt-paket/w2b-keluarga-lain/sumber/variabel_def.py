# -*- coding: utf-8 -*-
"""Definisi variabel ABT BARU paket w2b-keluarga-lain (jatah nomor 4850-4949).

Pembagian nomor (jangan keluar jatah; cek tidak terpakai di server):
  4850-4879  keluarga A : izin poligami, pencegahan perkawinan, pembatalan perkawinan   (berkas variabel_poligami.py)
  4880-4909  keluarga B : hak asuh, penguasaan anak, nafkah anak                         (berkas variabel_anak.py)
  4910-4939  keluarga C : pengangkatan anak, mafqud, permohonan umum                     (berkas variabel_lain.py)
  4940-4949  cadangan

Setiap entri: no, nama (tanpa kata aplikasi), tipe ('data_teks' | 'data_tanggal' | 'data_sql'), sql (untuk data_sql).
Aturan: kueri hanya SELECT, MariaDB 5.5, kolom hasil bernama `data`; penanda #perkara_id# dan #nnnn# diganti ABT sebelum dijalankan.
Teks keluaran memakai ejaan baku; tanpa penanda tanda aplikasi.
"""
import importlib

VAR = []
RENTANG = {'variabel_poligami': (4850, 4879), 'variabel_anak': (4880, 4909), 'variabel_lain': (4910, 4939)}


def v(no, nama, tipe, sql=None):
    if not 4850 <= no <= 4949:
        raise ValueError('nomor %d di luar jatah 4850-4949' % no)
    if any(x['no'] == no for x in VAR):
        raise ValueError('nomor %d dipakai dua kali' % no)
    VAR.append(dict(no=no, nama=nama, tipe=tipe, sql=sql))


for _m in RENTANG:
    try:
        importlib.import_module(_m)
    except ModuleNotFoundError as e:  # keluarga yang belum digabung
        if e.name != _m:
            raise
