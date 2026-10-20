# -*- coding: utf-8 -*-
"""Penyusun BAS (berita acara sidang) satu jenis perkara.

GUGATAN  : salinan 6c Nafkah Anak - BAS (29 salinan ALUR 04-09 + berkas ALUR 46: V1, V2, AP, GD->CB, N->NO, T->TP, CS, CM); V2S (kabul sebagian) tidak ikut.
PERMOHONAN: 6 Perwalian - BAS (ALUR 16): 1, 1a, 1b, 1c, 2, 2a, 2b, 3, T, N ('Mohon'); cabut / gugur memakai 9b Permohonan Umum - BAS seperti hibah.
Isi berkas hanya diubah pada frasa jenis-spesifik; semua penanda #nnnn# dan susunan RTF dipertahankan.
"""
import os
import re

from pustaka import ASLI, KELUAR, Berkas, Rakit, ganti_umum

DASAR_G = os.path.join(ASLI, '6c Nafkah Anak - BAS')
DASAR_P = os.path.join(ASLI, '6 Perwalian - BAS')

# kode langkah ALUR jenis-spesifik gugatan (nama berkas dasar ALUR 46 -> kode, keterangan)
LANGKAH_G = [
    ('V1', 'Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T', 'BAS ALUR 46 Nafkah Anak - Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T.rtf'),
    ('V2', 'Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek', 'BAS ALUR 46 Nafkah Anak - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek.rtf'),
    ('AP', 'Sidang 2 - Mediasi Berhasil - Akta Perdamaian', 'BAS ALUR 46 Nafkah Anak - Sidang 2 - Mediasi Berhasil - Akta Perdamaian.rtf'),
    ('CB', 'Sidang 2 - Mediasi Berhasil - Gugatan Dicabut', 'BAS ALUR 46 Nafkah Anak - Sidang 2 - Mediasi Berhasil - Gugatan Dicabut.rtf'),
    ('TP', 'Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P', 'BAS ALUR 46 Nafkah Anak - Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P.rtf'),
    ('NO', 'Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022)', 'BAS ALUR 46 Nafkah Anak - Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022).rtf'),
    ('CS', 'Cabut sesudah Jawaban - Tergugat Setuju', 'BAS ALUR 46 Nafkah Anak - Cabut sesudah Jawaban - Tergugat Setuju.rtf'),
    ('CM', 'Cabut sesudah Jawaban - Tergugat Menolak', 'BAS ALUR 46 Nafkah Anak - Cabut sesudah Jawaban - Tergugat Menolak.rtf'),
]
LANGKAH_P = ['1', '1a', '1b', '1c', '2', '2a', '2b', '3', 'T', 'N']


def nama_langkah_g(S, kode):
    for k, ket, dasar in LANGKAH_G:
        if k == kode:
            return dasar.replace('ALUR 46 Nafkah Anak', 'ALUR %d %s' % (S['alur'], S['nama_pendek']))


def klon_gugatan(S, folder_keluar=None):
    """Salin BAS gugatan; kembalikan daftar nama berkas keluaran."""
    folder_keluar = folder_keluar or os.path.join(KELUAR, S['folder'] + ' - BAS')
    os.makedirs(folder_keluar, exist_ok=True)
    label = S['label']
    hasil = []
    dasar_ke_kode = {d: k for k, _, d in LANGKAH_G}
    for f in sorted(os.listdir(DASAR_G)):
        if not f.lower().endswith('.rtf'):
            continue
        if 'Kabul Sebagian' in f:        # V2S tidak dipakai jenis ini
            continue
        if f in dasar_ke_kode:
            kode = dasar_ke_kode[f]
            if kode == 'AP' and not S.get('perdamaian'):
                continue
            keluar = nama_langkah_g(S, kode)
        else:
            keluar = f                     # salinan ALUR 04-09: nama sama
        b = Berkas(os.path.join(DASAR_G, f))
        r = Rakit(b)
        # BAS verstek memuat amar putusan: butir "Menghukum ..." khusus 6c diganti amar jenis ini (butir biaya dinomori ulang)
        i_hukum = b.cari(r'^\d+\.	Menghukum') if 'Pembuktian dan Putusan Verstek' in f else None
        i_biaya = b.cari(r'^\d+\.	#8505#', i_hukum) if i_hukum is not None else None
        for i in range(b.n):
            if i_hukum is not None and i == i_hukum:
                butir = list(S['gugatan']['amar_kabul']) + ['#8505# (#0155# #7095#).']
                n0 = int(re.match(r'^(\d+)\.', b.t[i_hukum]).group(1))
                for k, teks in enumerate(butir):
                    r.nomor(i_hukum, n0 + k, teks)
            elif i_biaya is not None and i == i_biaya:
                continue
            elif 'nafkah anak' in b.t[i]:
                r.frasa(i, [('nafkah anak', label)])
            else:
                r.raw(i)
        r.selesai(os.path.join(folder_keluar, keluar), S.get('isian_bas'))
        hasil.append(keluar)
    return hasil


def klon_permohonan(S, folder_keluar=None):
    folder_keluar = folder_keluar or os.path.join(KELUAR, S['folder'] + ' - BAS')
    os.makedirs(folder_keluar, exist_ok=True)
    P = S['permohonan']
    hasil = []
    for f in sorted(os.listdir(DASAR_P)):
        m = re.match(r'^BAS ALUR 16 Perwalian - \[([0-9a-zA-Z]+)\] (.*)$', f)
        if not m or m.group(1) not in LANGKAH_P:
            continue
        keluar = 'BAS ALUR %d %s%s - [%s] %s' % (S['alur'], S['nama_pendek'], ' Mohon' if 'gugatan' in S else '', m.group(1), m.group(2))
        b = Berkas(os.path.join(DASAR_P, f))
        r = Rakit(b)
        for i in range(b.n):
            t = b.t[i]
            baru = t
            if i == 0 and re.match(r'^(#\d{4}# ?)+$', t.strip()) and '#1025#' in t:
                baru = ' '.join('#%04d#' % n for n in S['isian_bas']) + ' #9134#'
            elif 'tentang hal-hal yang berkaitan dengan perwalian anak' in t:
                baru = re.sub(r'tentang hal-hal yang berkaitan dengan perwalian anak, antara lain kewajiban wali untuk memelihara dan mengurus anak yang berada di bawah perwaliannya beserta harta bendanya dengan sebaik-baiknya',
                              'tentang hal-hal yang berkaitan dengan ' + P['penjelasan_bas'], t)
            if baru == t:
                r.raw(i)
            elif i == 0:
                r.frasa(i, [(t.strip(), baru)])
            else:
                r.frasa(i, [('perwalian anak, antara lain kewajiban wali untuk memelihara dan mengurus anak yang berada di bawah perwaliannya beserta harta bendanya dengan sebaik-baiknya', P['penjelasan_bas'])])
        r.selesai(os.path.join(folder_keluar, keluar))
        hasil.append(keluar)
    return hasil
