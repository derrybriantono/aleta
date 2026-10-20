# -*- coding: utf-8 -*-
"""Blangko BARU 9b Permohonan Umum: [01] Kabul, [03] Tolak, [99] NO formil (agen W2b-C).

Folder 9b hanya punya 4 berkas prosedural (Cabut, Coret, Gugur, NO tidak hadir lagi): permohonan umum tidak punya blangko penetapan
dikabulkan, ditolak, maupun tidak dapat diterima. Berkas dasar: blangko Derry "9c Penetapan Mafqud" (struktur penetapan voluntair
dengan saksi dari BAS: #9259#/#9260#), diubah menjadi universal. Hal yang berbeda tiap jenis permohonan (penetapan kematian,
status hukum tertentu, dll.) menjadi isian petugas/hakim, bukan diputus mesin:

  4930 hal yang dimohonkan ditetapkan | 4932 bukti surat | 4935 dasar kewenangan Pengadilan Agama | 4936 kedudukan dan kepentingan hukum Pemohon
  4937 fakta yang terbukti | 4938 amar pokok (kalimat setelah "Menetapkan") | 4939 pertimbangan penolakan / alasan tidak dapat diterima
"""
import os

KAB = '9c Penetapan Mafqud/[01] [Kabul] Mafqud - Orang Hilang Ditetapkan Meninggal Secara Hukum.rtf'
TOL = '9c Penetapan Mafqud/[03] [Tolak] Mafqud - Dalil Permohonan Tidak Terbukti.rtf'
NO = '9c Penetapan Mafqud/[99] [NO] Mafqud - Permohonan Tidak Dapat Diterima (Formil).rtf'
FOLDER = '9b Permohonan Umum'

KEWENANGAN = ('Menimbang, bahwa permohonan ini pada pokoknya mengenai #4930#; bahwa perkara permohonan (voluntair) diperiksa dan diputus dalam bentuk penetapan '
              'sepanjang ditentukan peraturan perundang-undangan dan atau terdapat kepentingan hukum Pemohon yang perlu dilindungi, dan #4935#, sehingga perkara '
              'a quo termasuk kewenangan absolut Pengadilan Agama; mengenai kewenangan relatif, bahwa berdasarkan ketentuan hukum acara perdata yang berlaku di lingkungan '
              'Peradilan Agama, kompetensi relatif pada asasnya mengikuti domisili Pemohon sebagaimana asas Pasal 142 RBg jo. Pasal 54 Undang-Undang Nomor 7 Tahun 1989, '
              'ternyata #7036# berdomisili di wilayah hukum #8008#, sehingga #8008# berwenang secara relatif memeriksa dan mengadili permohonan ini;')


def _ambil(S, rel):
    from bangun import Dok
    return Dok(os.path.join(S.ASLI, rel))


def kabul(S):
    d = _ambil(S, KAB)
    t = lambda i: d.isi(i)  # noqa: E731
    # jangkar (indeks berdasarkan awal teks, bukan angka tetap)
    cari = lambda awal: S.satu(d, awal)  # noqa: E731
    i_hidden = 0
    i_jelas = cari('Bahwa #0690# telah menjelaskan kepada #0046#')
    i_ket = cari('Bahwa atas pertanyaan #0690#')
    i_umum = cari('Bahwa perkara ini telah diumumkan')
    i_surat = cari('#9873#')
    i_wewenang = cari('Menimbang, bahwa #0053# #0046# pada pokoknya mengenai penetapan orang yang hilang')
    i_standing = cari('Menimbang, bahwa #0046# adalah #9861#')
    i_fakta1 = cari('1.\tBahwa #0046# adalah #9861#')
    i_fakta2, i_fakta3, i_fakta4, i_fakta5 = cari('2.\tBahwa #9860# #9862#'), cari('3.\tBahwa #9860# tidak diketahui'), cari('4.\tBahwa perkara ini telah diumumkan'), cari('5.\tBahwa #9870#')
    i_mafqud = cari('Menimbang, bahwa orang yang hilang (mafqud)')
    i_dasar = cari('Menimbang, bahwa berdasarkan #9866#')
    i_simpul = cari('Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, telah terbukti bahwa #9870#')
    i_amar = cari('2.\t#9874#')
    ganti = {
        i_hidden: '#4930# #4932# #4935# #4936# #4937# #4938#',
        i_jelas: 'Bahwa #0690# telah menjelaskan kepada #0046# tentang hal-hal yang berkaitan dengan permohonannya, dan atas penjelasan tersebut #0046# menyatakan tetap pada #0053#nya;',
        i_ket: 'Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya membenarkan dalil-dalil #0053#nya dan mohon agar permohonannya mengenai #4930# dikabulkan;',
        i_surat: '#4932#',
        i_wewenang: KEWENANGAN,
        i_standing: 'Menimbang, bahwa #4936#, sehingga #0046# mempunyai kepentingan hukum (legal standing) untuk mengajukan #0053# a quo;',
        i_fakta1: '1.\tBahwa #4937#;',
        i_mafqud: 'Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, dalil-dalil #0053# #0046# mengenai #4930# telah terbukti dan tidak bertentangan dengan peraturan perundang-undangan maupun hukum Islam;',
        i_amar: '2.\t#4938#;',
    }
    buang = {i_umum, i_fakta2, i_fakta3, i_fakta4, i_fakta5, i_dasar, i_simpul}
    out = []
    for i in range(len(d.par)):
        if i in buang:
            continue
        out.append(d.ganti_teks(i, ganti[i]) if i in ganti else d.par[i])
    S.simpan_baru(FOLDER, '[01] [Kabul] Permohonan Umum - Permohonan Dikabulkan.rtf', d, out)


def tolak(S):
    d = _ambil(S, TOL)
    cari = lambda awal: S.satu(d, awal)  # noqa: E731
    i_hidden = 0
    i_jelas = cari('Bahwa #0690# telah menjelaskan kepada #0046#')
    i_ket = cari('Bahwa atas pertanyaan #0690#')
    i_umum = cari('Bahwa perkara ini telah diumumkan')
    i_surat = cari('#9873#')
    i_wewenang = cari('Menimbang, bahwa #0053# #0046# pada pokoknya mengenai penetapan orang yang hilang')
    i_standing = cari('Menimbang, bahwa #0046# adalah #9861#')
    i_f1 = cari('1.\tBahwa #0046# adalah #9861#')
    i_f2, i_f3, i_f4 = cari('2.\tBahwa #9860# #9862#'), cari('3.\tBahwa perkara ini telah diumumkan'), cari('4.\tBahwa #9871#')
    i_mafqud = cari('Menimbang, bahwa orang yang hilang (mafqud)')
    i_dasar = cari('Menimbang, bahwa berdasarkan #9866#')
    i_simpul = cari('Menimbang, bahwa berdasarkan fakta-fakta yang terungkap di persidangan, #9871#')
    i_tolak = cari('Menimbang, bahwa oleh karena dalil-dalil #0053# #0046# tidak terbukti')
    ganti = {
        i_hidden: '#4930# #4932# #4935# #4936# #4937# #4939#',
        i_jelas: 'Bahwa #0690# telah menjelaskan kepada #0046# tentang hal-hal yang berkaitan dengan permohonannya, dan atas penjelasan tersebut #0046# menyatakan tetap pada #0053#nya;',
        i_ket: 'Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya membenarkan dalil-dalil #0053#nya dan mohon agar permohonannya mengenai #4930# dikabulkan;',
        i_surat: '#4932#',
        i_wewenang: KEWENANGAN,
        i_standing: 'Menimbang, bahwa #4936#, sehingga #0046# mempunyai kepentingan hukum (legal standing) untuk mengajukan #0053# a quo;',
        i_f1: '1.\tBahwa #4937#;',
        i_mafqud: 'Menimbang, bahwa pembuktian dalam perkara permohonan tetap berpedoman pada kaidah pembuktian Pasal 283 RBg, yaitu pihak yang mendalilkan suatu hak atau peristiwa wajib membuktikannya;',
        i_simpul: 'Menimbang, bahwa berdasarkan fakta-fakta yang terungkap di persidangan, #4939#, sehingga #0046# tidak berhasil membuktikan dalil-dalil #0053#nya sebagaimana kaidah pembuktian Pasal 283 RBg;',
    }
    buang = {i_umum, i_f2, i_f3, i_f4, i_dasar}
    out = []
    for i in range(len(d.par)):
        if i in buang:
            continue
        out.append(d.ganti_teks(i, ganti[i]) if i in ganti else d.par[i])
    S.simpan_baru(FOLDER, '[03] [Tolak] Permohonan Umum - Dalil Permohonan Tidak Terbukti.rtf', d, out)
    return i_tolak


def jalan(S):
    kabul(S)
    tolak(S)
