# -*- coding: utf-8 -*-
"""Definisi isi paket x9-pihak-banyak-21okt. Semua teks ASCII.
BARU = nomor yang belum ada di server (rentang jatah 3500-3549; 3502-3506 sudah dipakai ABT lama, jadi dipakai 3507-3516).
UBAH = baris yang ada dan diubah (isi lama dijaga md5)."""

MODIFIER = 'admin'
MODIFIED = '2026-10-21 00:00:00'
BARU = []


def tambah(no, nama, sql, butir=''):
    BARU.append(dict(no=no, nama=nama, tipe='data_sql', sql=sql, default=None, tabel=None, kolom=None, urutan=None, butir=butir))


# sisa pihak SESUDAH batas kueri lama (dipanggil 7047/7048/7097/7098 pada cabang ELSE yang dulu kosong)
tambah(3507, "PIHAK: IDENTITAS #0046# KE-5 DST (OTOMATIS dari SIPP perkara_pihak1, semua pihak urutan 5 sampai terakhir, sebutan berangka romawi; dipanggil variabel 7047)",
       'SELECT aps_badilag.isian_rtf_pihak_utama(#perkara_id#, 1, 5, "#0046#", "tempat kediaman di") AS data', 'a')
tambah(3508, "PIHAK: SEBUTAN SEMUA #0046# (OTOMATIS: #0046# I, #0046# II, ... dan #0046# N menurut urutan terbesar di SIPP)",
       'SELECT aps_badilag.isian_rtf_pihak_urutan(#perkara_id#, 1, "#0046#") AS data', 'a')
tambah(3509, "PIHAK: IDENTITAS #0047# KE-6 DST (OTOMATIS dari SIPP perkara_pihak2, semua pihak urutan 6 sampai terakhir, sebutan berangka romawi; dipanggil variabel 7048)",
       'SELECT aps_badilag.isian_rtf_pihak_utama(#perkara_id#, 2, 6, "#0047#", "#0124#") AS data', 'a')
tambah(3510, "PIHAK: SEBUTAN SEMUA #0047# (OTOMATIS: #0047# I, #0047# II, ... dan #0047# N menurut urutan terbesar di SIPP)",
       'SELECT aps_badilag.isian_rtf_pihak_urutan(#perkara_id#, 2, "#0047#") AS data', 'a')
tambah(3511, "PIHAK: NAMA #0046# KE-6 DST (OTOMATIS dari SIPP perkara_pihak1, urutan 6 sampai terakhir; dipanggil variabel 7097)",
       'SELECT aps_badilag.isian_rtf_pihak_nama(#perkara_id#, 1, 6, "#0046#") AS data', 'a')
tambah(3512, "PIHAK: NAMA #0047# KE-6 DST (OTOMATIS dari SIPP perkara_pihak2, urutan 6 sampai terakhir; dipanggil variabel 7098)",
       'SELECT aps_badilag.isian_rtf_pihak_nama(#perkara_id#, 2, 6, "#0047#") AS data', 'a')
# daftar LENGKAP dari pihak pertama (untuk blangko yang ingin menyusun sendiri, tanpa batas)
tambah(3513, "PIHAK: IDENTITAS SEMUA #0046# (OTOMATIS dari SIPP perkara_pihak1, urutan 1 sampai terakhir, tanpa batas; tanpa kalimat kuasa)",
       'SELECT aps_badilag.isian_rtf_pihak_utama(#perkara_id#, 1, 1, "#0046#", "tempat kediaman di") AS data', 'b')
tambah(3514, "PIHAK: IDENTITAS SEMUA #0047# (OTOMATIS dari SIPP perkara_pihak2, urutan 1 sampai terakhir, tanpa batas; tanpa kalimat kuasa)",
       'SELECT aps_badilag.isian_rtf_pihak_utama(#perkara_id#, 2, 1, "#0047#", "#0124#") AS data', 'b')
tambah(3515, "PIHAK: NAMA SEMUA #0046# (OTOMATIS dari SIPP perkara_pihak1, urutan 1 sampai terakhir, tanpa batas)",
       'SELECT aps_badilag.isian_rtf_pihak_nama(#perkara_id#, 1, 1, "#0046#") AS data', 'b')
tambah(3516, "PIHAK: NAMA SEMUA #0047# (OTOMATIS dari SIPP perkara_pihak2, urutan 1 sampai terakhir, tanpa batas)",
       'SELECT aps_badilag.isian_rtf_pihak_nama(#perkara_id#, 2, 1, "#0047#") AS data', 'b')

# ---- baris yang diubah
UBAH = {}
