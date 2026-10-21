# -*- coding: utf-8 -*-
"""Skenario render php56 paket x4 (alat/render_x4.py). Petitum sintetis (tanpa data pribadi; nama pihak tetap dari SIPP lokal) ditulis
ke salinan sipp_x4 hanya selama render. harus_sama = teks sesudah paket HARUS persis sama dengan sebelum (tuntutan tidak diminta tidak
menambah apa pun)."""

CT = '1a Perceraian CT/'
CG = '1 Perceraian CG/'
D1 = '1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/'
HB = '4a Harta Bersama/'
HBI = '1f Hak Bekas Istri/'
P_CT, P_CG = 7522, 7326  # perkara CT / CG verstek lokal (nama Termohon/Penggugat memuat "idah")


def pet(*butir):
    return ''.join('<p>%d. %s</p>' % (i, b) for i, b in enumerate(butir, 1))


CT_POKOK = ['Mengabulkan permohonan Pemohon;', 'Memberi izin kepada Pemohon untuk menjatuhkan talak satu raj&#39;i terhadap Termohon di depan sidang Pengadilan Agama;']
CG_POKOK = ['Mengabulkan gugatan Penggugat;', 'Menjatuhkan talak satu ba&#39;in shughra Tergugat terhadap Penggugat;']
AKHIR = 'Membebankan biaya perkara menurut hukum;'
HADHANAH = 'Menetapkan anak Penggugat dan Tergugat berada di bawah hadhanah (pemeliharaan) ibunya;'
NAFKAH_ANAK = 'Menghukum ayahnya membayar nafkah anak sejumlah Rp1.000.000,00 setiap bulan sampai anak dewasa;'
MADLIYAH = 'Menghukum suami membayar nafkah madliyah (lampau) sejumlah Rp3.000.000,00;'
IDDAH = 'Menghukum Tergugat membayar nafkah iddah sejumlah Rp3.000.000,00;'
MUTAH = 'Menghukum Tergugat membayar mut&#39;ah berupa uang sejumlah Rp2.000.000,00;'
DAFTAR = 'dikabulkan seluruhnya\ndikabulkan sebagian\nditolak\ntidak dapat diterima\ndiberikan secara ex officio (tidak dituntut)'
KAB = 'dikabulkan seluruhnya'
MI = "[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah.rtf"
EX = '[01a] [Kabul Verstek] CT - F (Ex Offiicio mutah iddah dan nafkah anak).rtf'
NI = '[01d] [Kabul Verstek] Cerai (Format Lengkap) - Kumulasi Nafkah Istri (Madliyah, Iddah, Mutah).rtf'
EXOFF = {'6054': 'Rp1.500.000,00 (satu juta lima ratus ribu rupiah)', '6055': 'uang sejumlah Rp2.000.000,00 (dua juta rupiah)'}

SKENARIO = [
    # ---- kelompok 2: varian cerai -------------------------------------------------------------------------------------
    dict(kode='g2-mi-tanpa-tuntutan', label="CT Mut'ah Iddah, petitum cerai saja", rtf=CT + MI, perkara=P_CT, isian=EXOFF, harus_sama=True),
    dict(kode='g2-mi-tuntut-belum', label="CT Mut'ah Iddah, petitum + hak asuh, nafkah anak, madliyah - belum dipilih", rtf=CT + MI, perkara=P_CT,
         petitum=pet(*(CT_POKOK + [HADHANAH, NAFKAH_ANAK, MADLIYAH, AKHIR])), isian=EXOFF,
         harap_ada={'periksa hak asuh': r'PERIKSA: petitum menuntut hak asuh', 'periksa nafkah anak': r'PERIKSA: petitum menuntut nafkah anak',
                    'periksa madliyah': r'PERIKSA: petitum menuntut nafkah madliyah'}),
    dict(kode='g2-mi-tuntut-diputus', label="CT Mut'ah Iddah, hak asuh + nafkah anak + madliyah dikabulkan", rtf=CT + MI, perkara=P_CT,
         petitum=pet(*(CT_POKOK + [HADHANAH, NAFKAH_ANAK, MADLIYAH, AKHIR])),
         isian=dict(EXOFF, **{'4100': KAB, '4106': 'belum mumayyiz (belum berumur 12 tahun)', '4101': KAB, '9740': 'Rp1.000.000,00 (satu juta rupiah)',
                              '4104': KAB, '7120': 'Rp3.000.000,00 (tiga juta rupiah)'}),
         harap_ada={'amar hadhanah': r'berada di bawah pemeliharaan \(hadhanah\)', 'amar nafkah anak': r'membayar nafkah .{0,60}melalui',
                    'amar madliyah': r'Nafkah madliyah sejumlah', 'pertimbangan madliyah': r'madliyah'},
         harap_tidak={'periksa': r'PERIKSA: petitum menuntut'}),
    dict(kode='g2-penjaga-daftar-bawaan', label='CG Format Lengkap, petitum cerai saja, keputusan 4100-4105 dan 4109 tersimpan sebagai DAFTAR bawaan',
         rtf=CG + '[01] [Kabul Verstek] Cerai (Format Lengkap).rtf', perkara=P_CG,
         isian={'4100': DAFTAR, '4101': DAFTAR, '4102': DAFTAR, '4103': DAFTAR, '4104': DAFTAR.rsplit('\n', 1)[0], '4105': DAFTAR.rsplit('\n', 1)[0],
                '4109': 'sebelum ikrar talak\nsebelum akta cerai\ntidak disyaratkan (istri tidak keberatan)'},
         harap_tidak={'tidak dapat diterima': r'tuntutan mengenai [a-z\' ]+ tidak dapat diterima'}),
    dict(kode='g2-ex-tanpa-tuntutan', label='CT [01a] ex officio, petitum cerai saja', rtf=CT + EX, perkara=P_CT, isian=dict(EXOFF, **{'6072': 'Rp500.000,00 (lima ratus ribu rupiah) setiap bulan'}), harus_sama=True),
    dict(kode='g2-ex-madliyah-hadhanah', label='CT [01a] ex officio, petitum + madliyah + hak asuh dikabulkan', rtf=CT + EX, perkara=P_CT,
         petitum=pet(*(CT_POKOK + [HADHANAH, MADLIYAH, AKHIR])),
         isian=dict(EXOFF, **{'6072': 'Rp500.000,00 (lima ratus ribu rupiah) setiap bulan', '4100': KAB, '4106': 'belum mumayyiz (belum berumur 12 tahun)',
                              '4104': KAB, '7120': 'Rp3.000.000,00 (tiga juta rupiah)'}),
         harap_ada={'amar hadhanah': r'berada di bawah pemeliharaan \(hadhanah\)', 'amar madliyah': r'Nafkah madliyah sejumlah'},
         harap_tidak={'periksa': r'PERIKSA: petitum menuntut'}),
    dict(kode='g2-ni-tanpa-tuntutan', label='CG kumulasi nafkah istri, petitum cerai saja', rtf=CG + NI, perkara=P_CG, harus_sama=True),
    dict(kode='g2-ni-hadhanah', label='CG kumulasi nafkah istri, madliyah (9711) + hak asuh dikabulkan', rtf=CG + NI, perkara=P_CG,
         petitum=pet(*(CG_POKOK + [MADLIYAH, HADHANAH, AKHIR])),
         isian={'9711': 'Rp3.000.000,00 (tiga juta rupiah)', '4100': KAB, '4106': 'belum mumayyiz (belum berumur 12 tahun)'},
         harap_ada={'amar hadhanah': r'berada di bawah pemeliharaan \(hadhanah\)', 'amar madliyah 9716': r'nafkah madliyah sebesar'},
         harap_tidak={'periksa': r'PERIKSA: petitum menuntut'}),
    dict(kode='g2-1d02-tanpa-tuntutan', label='1d [02] kontradiktoir (nomor amar tetap), petitum cerai + hak asuh', rtf=D1 + '[02] [Kabul] Putusan CG Kumulasi Hak Asuh Anak - Kontradiktoir.rtf',
         perkara=P_CG, petitum=pet(*(CG_POKOK + [HADHANAH, AKHIR])), harus_sama=True),
    dict(kode='g2-1d02-nafkah-mutah', label='1d [02] nomor tetap: nafkah anak dikabulkan, mut\'ah ditolak', rtf=D1 + '[02] [Kabul] Putusan CG Kumulasi Hak Asuh Anak - Kontradiktoir.rtf',
         perkara=P_CG, petitum=pet(*(CG_POKOK + [HADHANAH, NAFKAH_ANAK, MUTAH, AKHIR])),
         isian={'4101': KAB, '9740': 'Rp1.000.000,00 (satu juta rupiah)', '4103': 'ditolak: Penggugat terbukti nusyuz'},
         harap_ada={'amar nafkah anak': r'membayar nafkah .{0,60}melalui', 'menolak selebihnya': r'Menolak .{0,40}selain dan selebihnya',
                    'pertimbangan mutah ditolak': r'mut.ah'},
         harap_tidak={'periksa': r'PERIKSA: petitum menuntut'}),
    dict(kode='g2-1d01d-iddah', label='1d [01d] nomor tetap mulai 5: nafkah iddah dikabulkan', rtf=D1 + '[01d] [Kabul] Putusan CG Kumulasi Hak Asuh dan Nafkah Anak - T Tidak Hadir Setelah Mediasi.rtf',
         perkara=P_CG, petitum=pet(*(CG_POKOK + [HADHANAH, NAFKAH_ANAK, IDDAH, AKHIR])), isian={'4102': KAB, '9712': 'Rp3.000.000,00 (tiga juta rupiah)'},
         harap_ada={'amar iddah': r'Nafkah iddah sejumlah'}, harap_tidak={'periksa': r'PERIKSA: petitum menuntut'}),
    dict(kode='g2-1d01-tanpa-tuntutan', label='1d [01] verstek (daftar otomatis), petitum cerai + hak asuh', rtf=D1 + '[01] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak - Anak Belum Mumayyiz.rtf',
         perkara=P_CG, petitum=pet(*(CG_POKOK + [HADHANAH, AKHIR])), harus_sama=True),
    dict(kode='g2-qd-hadhanah-belum', label='CG [01a] qabla dukhul, petitum + hak asuh belum dipilih', rtf=CG + '[01a] [Kabul Verstek] Cerai - Alasan E (Qabla Ad Dukhul).rtf',
         perkara=P_CG, petitum=pet(*(CG_POKOK + [HADHANAH, AKHIR])), harap_ada={'periksa hak asuh': r'PERIKSA: petitum menuntut hak asuh'}),
    dict(kode='g2-qd-tanpa-tuntutan', label='CG [01a] qabla dukhul, petitum cerai saja', rtf=CG + '[01a] [Kabul Verstek] Cerai - Alasan E (Qabla Ad Dukhul).rtf',
         perkara=P_CG, harus_sama=True),
    dict(kode='g2-bas1d-nafkah', label='BAS putus verstek 1d [2]: nafkah anak dikabulkan', perkara=P_CG,
         rtf='1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak - BAS/BAS KUMULASI [2] BAS Putus Verstek CG Kumulasi Hak Asuh Anak - P Hadir & T Tidak Hadir (2 Saksi).rtf',
         petitum=pet(*(CG_POKOK + [HADHANAH, NAFKAH_ANAK, AKHIR])), isian={'4101': KAB, '9740': 'Rp1.000.000,00 (satu juta rupiah)'},
         harap_ada={'amar nafkah anak': r'membayar nafkah .{0,60}melalui'}),
    # ---- kelompok 1: hak bekas istri ---------------------------------------------------------------------------------------
    dict(kode='g1-hbi-mutah-nama', label="HBI verstek: petitum hanya mut'ah (nama Penggugat memuat \"idah\", alamat \"tempat tinggal\")", rtf=HBI + '[01b] [Kabul Verstek] Hak Bekas Istri.rtf',
         perkara=P_CG, jenis=351, petitum=pet('Mengabulkan gugatan Penggugat;', MUTAH.replace('Tergugat membayar', 'Tergugat yang bertempat tinggal di Desa Labuan membayar'), AKHIR),
         isian={'9713': 'uang sejumlah Rp2.000.000,00 (dua juta rupiah)', '3741': 'cerai gugat'},
         harap_ada={'mutah dituntut': r"memenuhi mut'ah bagi"}, harap_tidak={'iddah dituntut': r'memenuhi nafkah iddah', 'maskan dituntut': r'memenuhi[^;]{0,60}maskan'}),
    dict(kode='g1-hbi-daftar-bawaan', label='HBI verstek: isian PILIH tersimpan sebagai DAFTAR bawaan (waktu bayar, nusyuz, dukhul)', rtf=HBI + '[01b] [Kabul Verstek] Hak Bekas Istri.rtf',
         perkara=P_CG, jenis=351, petitum=pet('Mengabulkan gugatan Penggugat;', IDDAH, AKHIR),
         isian={'9712': 'Rp3.000.000,00 (tiga juta rupiah)', '3756': 'segera setelah putusan ini berkekuatan hukum tetap\npaling lambat 30 (tiga puluh) hari sejak putusan ini berkekuatan hukum tetap',
                '3741': 'cerai talak\ncerai gugat'},
         # baris kepala penanda (baris 1 blangko gelombang 3) mencetak nilai mentah semua isian - yang dinilai: amar
         harap_tidak={'dua pilihan waktu bayar di amar': r'dilakukan segera setelah putusan ini berkekuatan hukum tetap\s*paling lambat'}),
    # ---- kelompok 3: kebendaan -----------------------------------------------------------------------------------------
    dict(kode='g3-hb-posita-bukan-sita', label='HB verstek, petitum menyebut "posita" tanpa sita jaminan (perkara nyata)', rtf=HB + '[01b] [Kabul Verstek] HB.rtf', perkara=5404,
         harap_tidak={'periksa sita': r'PERIKSA[^\]]{0,80}sita'}),
    dict(kode='g3-hb-sita-nyata', label='HB verstek, petitum menuntut sita marital (perkara nyata)', rtf=HB + '[01b] [Kabul Verstek] HB.rtf', perkara=8706,
         harap_ada={'periksa sita': r'PERIKSA[^\]]{0,120}sita'}),
]

# Perkara uji BERBEDA per skenario (render berjalan paralel; isian uji per perkara tidak boleh bertabrakan). Perkara CG/CT verstek
# lokal; petitum skenario tanpa 'petitum' = petitum cerai saja (sintetis) supaya hasilnya tidak bergantung petitum asli perkara itu.
_PERKARA = {
    'g2-mi-tanpa-tuntutan': 10083, 'g2-mi-tuntut-belum': 10078, 'g2-mi-tuntut-diputus': 10077, 'g2-penjaga-daftar-bawaan': 10110,
    'g2-ex-tanpa-tuntutan': 10066, 'g2-ex-madliyah-hadhanah': 10004, 'g2-ni-tanpa-tuntutan': 10109, 'g2-ni-hadhanah': 10108,
    'g2-1d02-tanpa-tuntutan': 10107, 'g2-1d02-nafkah-mutah': 10106, 'g2-1d01d-iddah': 10104, 'g2-1d01-tanpa-tuntutan': 10102,
    'g2-qd-hadhanah-belum': 10100, 'g2-qd-tanpa-tuntutan': 10098, 'g2-bas1d-nafkah': 10093, 'g1-hbi-mutah-nama': P_CG, 'g1-hbi-daftar-bawaan': 10087,
}
for _sk in SKENARIO:
    if _sk['kode'] in _PERKARA:
        _sk['perkara'] = _PERKARA[_sk['kode']]
    if 'petitum' not in _sk and _sk['perkara'] not in (5404, 8706):
        _sk['petitum'] = pet(*((CT_POKOK if _sk['rtf'].startswith(CT) else CG_POKOK) + [AKHIR]))
assert len({s['perkara'] for s in SKENARIO}) == len(SKENARIO), 'perkara uji ganda'
