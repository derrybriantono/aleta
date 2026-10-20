# -*- coding: utf-8 -*-
"""Penyusun set putusan GUGATAN (Pdt.G) satu jenis perkara dari blangko Derry "6c Nafkah Anak" (pohon server 20 Okt 2026).

Satu spesifikasi (spek_<jenis>.py::SPEK['gugatan']) menghasilkan 12-13 putusan:
  [01] kabul kontradiktoir, [01a] kabul T tidak hadir setelah mediasi, [01b] kabul verstek, [03] tolak kontradiktoir, [03b] tolak verstek,
  [97] perdamaian (bila spek['perdamaian']), [98] cabut sebelum jawaban, [98a] gugur, [98b] cabut sesudah jawaban, [98c] coret (panjar habis),
  [99] NO SEMA 1/2022, [99a] NO kurang pihak, [99b] NO gugatan kabur.

Cara kerja: paragraf berkas dasar yang jenis-spesifik DIKENALI dari teksnya (jangkar regex), bukan dari nomor urut, lalu diganti teks spek;
paragraf lain dibiarkan mentah (gaya RTF utuh) kecuali frasa "nafkah anak" yang diganti ke sebutan perkara. Tidak ada paragraf yang dibuang
diam-diam: jangkar wajib ditemukan (galat bila tidak) sesuai peran berkas.
"""
import os
import re

from pustaka import ASLI, KELUAR, Berkas, Rakit, ganti_umum

DASAR = os.path.join(ASLI, '6c Nafkah Anak')

# (kode, nama berkas dasar, nama berkas keluaran (format dengan {N}), peran)
BERKAS = [
    ('[01]', '[01] [Kabul] Nafkah Anak - Kontradiktoir.rtf', '[01] [Kabul] {N} - Kontradiktoir.rtf', 'kabul'),
    ('[01a]', '[01a] [Kabul] Nafkah Anak - T Tidak Hadir Setelah Mediasi.rtf', '[01a] [Kabul] {N} - T Tidak Hadir Setelah Mediasi.rtf', 'kabul'),
    ('[01b]', '[01b] [Kabul Verstek] Nafkah Anak.rtf', '[01b] [Kabul Verstek] {N}.rtf', 'kabul-verstek'),
    ('[03]', '[03] [Tolak] Nafkah Anak - Kontradiktoir - Dalil Tidak Terbukti.rtf', '[03] [Tolak] {N} - Kontradiktoir - Dalil Tidak Terbukti.rtf', 'tolak'),
    ('[03b]', '[03b] [Tolak Verstek] Nafkah Anak - T Tidak Hadir - Dalil Tidak Terbukti.rtf', '[03b] [Tolak Verstek] {N} - Dalil Tidak Terbukti.rtf', 'tolak-verstek'),
    ('[97]', '[97] [Perdamaian] Nafkah Anak - Akta Perdamaian.rtf', '[97] [Perdamaian] {N} - Akta Perdamaian.rtf', 'damai'),
    ('[98a]', '[98a] [Gugur] Nafkah Anak - P Tidak Hadir Sidang Pertama.rtf', '[98a] [Gugur] {N} - P Tidak Hadir Sidang Pertama.rtf', 'umum'),
    ('[98b]', '[98b] [Cabut] Nafkah Anak - Sesudah Jawaban dengan Persetujuan T.rtf', '[98b] [Cabut] {N} - Sesudah Jawaban dengan Persetujuan T.rtf', 'umum'),
    ('[98]', '[98] [Cabut] Nafkah Anak - P & T Hadir Sebelum Jawaban.rtf', '[98] [Cabut] {N} - P & T Hadir Sebelum Jawaban.rtf', 'umum'),
    ('[98c]', '[98c] [Coret] Nafkah Anak - Dibatalkan dari Pendaftaran - Panjar Habis.rtf', '[98c] [Coret] {N} - Dibatalkan dari Pendaftaran - Panjar Habis.rtf', 'umum'),
    ('[99a]', '[99a] [NO] Nafkah Anak - Kurang Pihak (Plurium Litis Consortium).rtf', '[99a] [NO] {N} - Kurang Pihak (Plurium Litis Consortium).rtf', 'umum'),
    ('[99b]', '[99b] [NO] Nafkah Anak - Gugatan Kabur (Obscuur Libel).rtf', '[99b] [NO] {N} - Gugatan Kabur (Obscuur Libel).rtf', 'umum'),
    ('[99]', '[99] [NO] Nafkah Anak - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022).rtf', '[99] [NO] {N} - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022).rtf', 'umum'),
]

RX_ITEM = re.compile(r'^\d+\.\t')
BIAYA = '#8505# (#0155# #7095#).'


def _items(b, mulai):
    """Indeks paragraf berbutir (n.<tab>) berurutan mulai dari 'mulai'."""
    hasil = []
    i = mulai
    while i < b.n and RX_ITEM.match(b.t[i]):
        hasil.append(i)
        i += 1
    return hasil


def susun(kode, nama_dasar, nama_keluar, peran, S, folder_keluar):
    """S = spek lengkap jenis; S['gugatan'] = bagian gugatan."""
    G = S['gugatan']
    b = Berkas(os.path.join(DASAR, nama_dasar))
    r = Rakit(b)
    label = S['label']
    aturan = [] if S.get('sita') else [('#9755#', ''), ('#9756#', '')]
    verstek = peran in ('kabul-verstek', 'tolak-verstek')
    t = b.t

    def galat(msg):
        raise ValueError('%s: %s' % (nama_dasar, msg))

    iKew = b.cari(r'pada pokoknya mengenai nafkah')
    iStand = b.cari(r'adalah #9759# dan|adalah #9300# dan')
    iIsuHead = b.cari(r'isu-isu pokok')
    iFakta = b.cari(r'menemukan fakta hukum sebagai berikut|ditemukan fakta-fakta kongkret')
    iCore = b.cari(r'^(Mengenai Nafkah Anak|Pertimbangan Nafkah Anak)$')
    iCoreEnd = b.cari(r'^(Mengenai Biaya Perkara|Pertimbangan Pembebanan Biaya)$')
    iAmar = b.cari(r'^MENGADILI$')
    iKaki = b.cari(r'^#8501#') if iAmar is None else b.cari(r'^#8501#', iAmar)
    gantungan = {}  # indeks -> teks pengganti satu paragraf

    # ---------------- jangkar menurut peran ----------------
    if peran in ('kabul', 'kabul-verstek', 'tolak', 'tolak-verstek', 'umum', 'damai'):
        if iKew is None:
            if peran not in ('umum',):
                galat('jangkar kewenangan tidak ditemukan')
        else:
            gantungan[iKew] = G['kewenangan'] if peran in ('kabul', 'kabul-verstek', 'tolak', 'tolak-verstek') else G['kewenangan_ringkas']
    if iStand is not None:
        gantungan[iStand] = G['standing'] if peran in ('kabul', 'kabul-verstek', 'tolak', 'tolak-verstek') else G['standing_no']
    elif peran in ('kabul', 'kabul-verstek', 'tolak', 'tolak-verstek'):
        galat('jangkar kedudukan hukum tidak ditemukan')

    skip = set()
    isi_isu = isi_fakta = None
    if peran in ('kabul', 'kabul-verstek', 'tolak', 'tolak-verstek'):
        if iFakta is None or iCore is None or iCoreEnd is None or iAmar is None or iKaki is None:
            galat('jangkar fakta/inti/amar tidak lengkap (fakta=%s inti=%s akhir=%s amar=%s)' % (iFakta, iCore, iCoreEnd, iAmar))
        if iIsuHead is not None:
            isu = _items(b, iIsuHead + 1)
            skip |= set(isu)
            isi_isu = (isu[0], G['isu'])
        fakta = _items(b, iFakta + 1)
        skip |= set(fakta)
        isi_fakta = (fakta[0], G['fakta'])
        skip |= set(range(iCore, iCoreEnd))
        skip |= set(range(iAmar + 1, iKaki))

    # ---------------- rakit ----------------
    inti_aktif = peran in ('kabul', 'kabul-verstek', 'tolak', 'tolak-verstek')
    for i in range(b.n):
        if inti_aktif and isi_isu and i == isi_isu[0]:
            for k, teks in enumerate(isi_isu[1], 1):
                r.nomor(isi_isu[0], k, teks)
            continue
        if inti_aktif and isi_fakta and i == isi_fakta[0]:
            for k, teks in enumerate(isi_fakta[1], 1):
                r.nomor(isi_fakta[0], k, teks)
            continue
        if inti_aktif and i == iCore:
            judul = G['judul_inti']
            kepala = ('Pertimbangan ' if t[iCore].startswith('Pertimbangan') else 'Mengenai ') + judul
            r.teks(iCore, kepala)
            if peran in ('kabul', 'kabul-verstek'):
                akhir = G['inti_kabul_akhir']['verstek' if verstek else 'kontra']
                blok = G['inti_hukum'] + G['inti_kabul'] + [('body', akhir)]
            else:
                akhir = G['inti_tolak_akhir']['verstek' if verstek else 'kontra']
                blok = G['inti_hukum'] + G['inti_tolak'] + [('body', akhir)]
            model_body = iCore + 1
            model_num = isi_fakta[0] if isi_fakta else model_body
            n = 0
            for tipe, teks in blok:
                if tipe == 'sub':
                    n = 0
                    r.teks(iCore, teks)
                elif tipe == 'num':
                    n += 1
                    r.nomor(model_num, n, teks)
                else:
                    n = 0
                    r.teks(model_body, teks)
            continue
        if inti_aktif and i == iAmar + 1:
            _amar(r, b, iAmar, iKaki, peran, G, verstek)
            continue
        if i in skip:
            continue
        if i in gantungan:
            r.teks(i, ganti_umum(gantungan[i], label, aturan))
            continue
        baru = ganti_umum(t[i], label, aturan)
        if baru != t[i]:
            r.teks(i, baru)
        else:
            r.raw(i)

    # kaki: tanggal hijriah dst. dibiarkan; simpan
    tujuan = os.path.join(folder_keluar, nama_keluar.replace('{N}', S['nama_berkas']))
    r.selesai(tujuan)
    return tujuan


def _amar(r, b, iAmar, iKaki, peran, G, verstek):
    awal = iAmar + 1
    butir = _items(b, awal)
    teks_dasar = [re.sub(r'^\d+\.\t', '', b.t[i]) for i in butir]
    model = butir[0]
    # awalan = butir sebelum butir substantif dasar (Menghukum / Menolak)
    k = next((j for j, x in enumerate(teks_dasar) if x.startswith('Menghukum') or x.startswith('Menolak')), None)
    if k is None:
        raise ValueError('amar dasar tanpa butir Menghukum/Menolak')
    awalan = teks_dasar[:k]
    if peran in ('kabul', 'kabul-verstek'):
        butir_baru = awalan + G['amar_kabul']
    else:
        butir_baru = awalan + G['amar_tolak']
    butir_baru = butir_baru + [BIAYA]
    for n, teks in enumerate(butir_baru, 1):
        r.nomor(model, n, teks)


def susun_semua(S, folder_keluar=None):
    folder_keluar = folder_keluar or os.path.join(KELUAR, S['folder'])
    os.makedirs(folder_keluar, exist_ok=True)
    hasil = []
    for kode, dasar, keluar, peran in BERKAS:
        if kode == '[97]' and not S.get('perdamaian'):
            continue
        hasil.append(susun(kode, dasar, keluar, peran, S, folder_keluar))
    return hasil
