# -*- coding: utf-8 -*-
"""Penyusun set penetapan PERMOHONAN (Pdt.P) satu jenis perkara dari blangko Derry "4d Hibah" ([01p], [03p], [99p]; pohon server 20 Okt 2026).

Spesifikasi: spek_<jenis>.py::SPEK['permohonan'] dengan kunci
  penjelasan, pengakuan, tokens_tersembunyi, kewenangan, standing, fakta[], hukum[('body',teks)], kabul[], amar_kabul[], tolak[], amar_tolak[], no[], amar_no[]
Keluaran: [01p] kabul, [03p] tolak, [99p] tidak dapat diterima (cabut / gugur / coret / NO SEMA permohonan memakai 9b Permohonan Umum seperti hibah).
"""
import os
import re

from pustaka import ASLI, KELUAR, Berkas, Rakit, ganti_umum, isian_diperlukan

DASAR = os.path.join(ASLI, '4d Hibah')

BERKAS = [
    ('[01p]', '[01p] [Kabul] Hibah - Permohonan Penetapan (Pemohon Hadir).rtf', '[01p] [Kabul] {N} - Permohonan (Pemohon Hadir).rtf', 'kabul'),
    ('[03p]', '[03p] [Tolak] Hibah - Dalil Permohonan Tidak Terbukti.rtf', '[03p] [Tolak] {N} - Dalil Permohonan Tidak Terbukti.rtf', 'tolak'),
    ('[99p]', '[99p] [NO] Hibah - Permohonan Tidak Dapat Diterima (Formil).rtf', '[99p] [NO] {N} - Permohonan Tidak Dapat Diterima (Formil).rtf', 'no'),
]
BIAYA = '#8505# (#0155# #7095#).'
RX_ITEM = re.compile(r'^\d+\.\t')


def susun(kode, dasar, keluar, peran, S, folder_keluar):
    P = S['permohonan']
    b = Berkas(os.path.join(DASAR, dasar))
    r = Rakit(b)
    t = b.t

    def galat(msg):
        raise ValueError('%s: %s' % (dasar, msg))

    iTok = 0
    iJelas = b.cari(r'telah menjelaskan kepada')
    iPengakuan = b.cari(r'memberikan keterangan yang pada pokoknya bahwa')
    iBukti = b.cari(r'^#9810#$')
    iKew = b.cari(r'pada pokoknya mengenai penetapan')
    iStand = b.cari(r'mempunyai kepentingan hukum \(legal standing\)')
    iFakta = b.cari(r'ditemukan fakta hukum sebagai berikut')
    iVol = b.cari(r'terdaftar sebagai perkara permohonan \(voluntair\), maka seluruh biaya')
    iMenetapkan = b.cari(r'^MENETAPKAN$')
    iKaki = b.cari(r'^#8501#', iMenetapkan or 0)
    for nama, v in (('jelas', iJelas), ('pengakuan', iPengakuan), ('bukti', iBukti), ('kew', iKew), ('stand', iStand), ('fakta', iFakta), ('vol', iVol), ('menetapkan', iMenetapkan), ('kaki', iKaki)):
        if v is None:
            galat('jangkar %s tidak ditemukan' % nama)
    fakta = []
    i = iFakta + 1
    while i < b.n and RX_ITEM.match(t[i]):
        fakta.append(i)
        i += 1
    blok_awal, blok_akhir = fakta[-1] + 1, iVol     # paragraf hukum lama (dibuang) [blok_awal, blok_akhir)
    amar_awal = iMenetapkan + 1
    model_amar = amar_awal
    model_body = blok_awal
    label = S['label']
    for i in range(b.n):
        if i == iTok:
            r.raw(i)   # diganti di akhir (isian yang dipakai)
        elif i == iJelas:
            r.teks(i, 'Bahwa #0690# telah menjelaskan kepada #0046# tentang hal-hal yang berkaitan dengan %s, dan atas penjelasan tersebut #0046# menyatakan tetap pada #0053#nya;' % P['penjelasan'])
        elif i == iPengakuan:
            r.teks(i, 'Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya %s;' % P['pengakuan'])
        elif i == iBukti:
            r.teks(i, P.get('token_bukti', '#3814#'))
        elif i == iKew:
            r.teks(i, P['kewenangan'])
        elif i == iStand:
            r.teks(i, P['standing'])
        elif i == fakta[0]:
            butir = P['fakta'] if peran != 'no' else P.get('fakta_no', P['fakta'])
            for n, teks in enumerate(butir, 1):
                r.nomor(fakta[0], n, teks)
        elif i in fakta:
            continue
        elif blok_awal <= i < blok_akhir:
            if i == blok_awal:
                if peran == 'kabul':
                    paragraf = [x[1] for x in P['hukum']] + P['kabul']
                elif peran == 'tolak':
                    paragraf = [x[1] for x in P['hukum']] + P['tolak']
                else:
                    paragraf = P['no']
                for teks in paragraf:
                    r.teks(model_body, teks)
        elif amar_awal <= i < iKaki:
            if i == amar_awal:
                butir = P['amar_kabul'] if peran == 'kabul' else P['amar_tolak'] if peran == 'tolak' else P['amar_no']
                for n, teks in enumerate(list(butir) + [BIAYA], 1):
                    r.nomor(model_amar, n, teks)
        else:
            baru = t[i]
            if baru != t[i]:
                r.teks(i, baru)
            else:
                r.raw(i)
    # paragraf 0 (teks tersembunyi): semua isian paket yang dipakai berkas ini (juga yang hanya dibaca kueri variabel lain), supaya ABT menanyakannya
    perlu = isian_diperlukan(''.join(r.out[1:]))
    r.out[0] = b.d.ganti_teks(0, ' '.join('#%04d#' % n for n in perlu))
    tujuan = os.path.join(folder_keluar, keluar.replace('{N}', S['nama_berkas']))
    r.selesai(tujuan)
    return tujuan


def susun_semua(S, folder_keluar=None):
    folder_keluar = folder_keluar or os.path.join(KELUAR, S['folder'])
    os.makedirs(folder_keluar, exist_ok=True)
    return [susun(kode, dasar, keluar, peran, S, folder_keluar) for kode, dasar, keluar, peran in BERKAS]
