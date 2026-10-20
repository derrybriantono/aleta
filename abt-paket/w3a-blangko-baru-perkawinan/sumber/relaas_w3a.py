# -*- coding: utf-8 -*-
"""Dua relaas panggilan BARU di folder "98 Relaas" (menu 981, alur 15-17, grup jurusita; tanpa menu/hak baru):
  [JS] 12.1 Penolakan Perkawinan - Pegawai Pencatat Nikah  : Pegawai Pencatat Nikah/Kepala KUA yang menolak dipanggil untuk didengar (Pasal 21 ayat (3)-(4) UU 1/1974)
  [JS] 13.1 Izin Kawin - Orang Tua/Wali                    : orang tua, wali, atau keluarga garis lurus dipanggil untuk didengar (Pasal 6 ayat (5) UU 1/1974)
Dasar: "[JS] 11.2 ... Calon Suami" (relaas pihak yang bukan pihak SIPP; identitas dari isian ABT 3790-3792). Pemohon dan pihak SIPP lain memakai relaas [JS] 0./1./2. yang sudah ada.
Variabel bersama 3790-3799 didefinisikan di bawah (V dipanggil bila modul ini diimpor)."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import w3a_lib as L
from variabel_def import V, VAR

DASAR = '98 Relaas/[JS] 11.2. Relaas Panggilan Sidang Pencegahan Perkawinan - Calon Suami.rtf'
FOLDER = '98 Relaas'

if not any(x['no'] == 3790 for x in VAR):
    V(3790, 'RELAAS PIHAK DIDENGAR: NAMA DAN JABATAN ATAU HUBUNGAN YANG DIPANGGIL - ISIAN (mis. Kepala Kantor Urusan Agama Kecamatan ..., atau nama orang tua/wali)', 'data_teks', default='...........................................')
    V(3791, 'RELAAS PIHAK DIDENGAR: TEMPAT KEDIAMAN ATAU ALAMAT KANTOR YANG DIPANGGIL - ISIAN', 'data_teks', default='....................................................')

ISIAN = {
    '3790': ('manual', 'Nama dan jabatan atau hubungan pihak yang dipanggil untuk didengar (pejabat pencatat nikah, orang tua, wali) tidak tercatat di SIPP; ketik dari surat atau berkas perkara.'),
    '3791': ('manual', 'Tempat kediaman atau alamat kantor pihak yang dipanggil untuk didengar tidak tercatat di SIPP; ketik dari surat atau berkas perkara.'),
}
RAMAH = {
    '3790': dict(nm='Pihak yang dipanggil untuk didengar (nama lengkap dan jabatan atau hubungan, mis. Kepala Kantor Urusan Agama Kecamatan ... atau ayah kandung Pemohon bernama ...)'),
    '3791': dict(nm='Tempat kediaman atau alamat kantor pihak yang dipanggil untuk didengar'),
}
RELAAS = [
    dict(berkas='[JS] 12.1. Relaas Panggilan Sidang Penolakan Perkawinan - Pegawai Pencatat Nikah.rtf',
         peran='sebagai Pegawai Pencatat Nikah yang menolak melangsungkan perkawinan Pemohon',
         tujuan='mengenai penolakan melangsungkan perkawinan tersebut (Pasal 21 ayat (3) dan (4) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan)',
         ttd='Pegawai Pencatat Nikah yang dipanggil,'),
    dict(berkas='[JS] 13.1. Relaas Panggilan Sidang Izin Kawin - Orang Tua atau Wali.rtf',
         peran='sebagai orang tua, wali, atau keluarga dalam garis lurus ke atas dari calon mempelai yang akan didengar pendapatnya',
         tujuan='mengenai permohonan izin kawin tersebut (Pasal 6 ayat (5) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan)',
         ttd='Yang dipanggil,'),
]


def bangun():
    hasil = []
    for r in RELAAS:
        d = L.dok(DASAR)
        out = []
        for i, p in enumerate(d.par):
            if i == 5:
                out.append(d.ganti_teks(i, '#3790#, tempat kediaman atau kantor di #3791#, %s;' % r['peran']))
            elif i == 10:
                out.append(d.ganti_teks(i, 'untuk didengar keterangannya dalam pemeriksaan perkara #0053# #0048# Nomor #0001# tanggal #1061# yang diajukan oleh #0098# sebagai #0046#, %s;' % r['tujuan']))
            elif i == 16:
                out.append(d.ganti_teks(i, r['ttd']))
            elif i == 20:
                out.append(d.ganti_teks(i, '#3790#'))
            else:
                out.append(p)
        raw = d.rakit(out)
        hasil.append(L.tulis_raw(FOLDER, r['berkas'], raw))
    return hasil


if __name__ == '__main__':
    for p in bangun():
        print('ditulis', os.path.basename(p))
