# -*- coding: utf-8 -*-
"""Menyusun blangko BARU "Perwalian Anak oleh Kerabat (Kedua Orang Tua Telah Meninggal) Kabul" dari
"Perwalian Anak oleh ortu kandung Kabul.rtf" (derry_briantono/6 Perwalian).

Dasar susunan: penetapan nyata PA Donggala 2025-2026 (21/, 27/, 36/, 151/, 195/ Pdt.P) + Pasal 50-53 UU 1/1974, Pasal 107-111 KHI,
PP 29/2019, UU 35/2014 Pasal 33 (lihat PASANG.md bagian "dasar hukum").
Keluaran: rtf/derry_briantono/6 Perwalian/[01b] [Kabul] Perwalian - Anak Yatim Piatu oleh Kerabat (Bukan Orang Tua).rtf
"""
import os
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(AKAR, 'alat'))
from bangun import Dok, simpan, periksa_token  # noqa: E402

DASAR = os.environ.get('U4_ASLI', 'D:/Aplikasi/aleta/tmp/u4/asli') + '/6 Perwalian/Perwalian Anak oleh ortu kandung Kabul.rtf'
TUJUAN = os.path.join(AKAR, 'rtf', 'derry_briantono', '6 Perwalian',
                      '[01b] [Kabul] Perwalian - Anak Yatim Piatu oleh Kerabat (Bukan Orang Tua).rtf')

# indeks paragraf dasar (lihat alat/paragraf.py atas berkas dasar)
BODY, SUB, BUL, SAKSI_ITEM, SAKSI_NUM, FAKTA_NUM, AMAR_NUM = 60, 61, 18, 33, 79, 95, 126


def susun():
    d = Dok(DASAR)
    t = d.teks
    out = []
    raw = lambda *idx: out.extend(d.par[i] for i in idx)  # noqa: E731
    baru = lambda i, teks, label=None: out.append(d.ganti_teks(i, teks, label))  # noqa: E731

    # ---- kepala sampai permohonan/petitum (utuh) ----
    raw(*range(0, 15))
    # ---- duduk perkara ----
    baru(BODY, 'Bahwa #8554# telah memberikan penjelasan kepada #0046# mengenai konsep yuridis perwalian, syarat, serta kewajiban dan tanggung jawab seorang wali terhadap diri dan harta anak yang berada di bawah perwaliannya, dan #0046# menyatakan telah mengerti;')
    baru(BODY, 'Bahwa selanjutnya terhadap penjelasan yang disampaikan #8554# tersebut #0046# menyatakan tetap pada permohonannya;')
    baru(BODY, 'Bahwa #0046# dalam persidangan telah menghadirkan #5114# yang dimintakan perwalian, dan atas pertanyaan #8554#, #5114# tersebut telah memberikan keterangan sebagai berikut:')
    for s in [
        'Bahwa #5115# kenal dengan #0046# karena #0046# adalah #4400# #5114# tersebut;',
        'Bahwa kedua orang tua kandung #5115# telah meninggal dunia, yaitu #4405#;',
        'Bahwa sejak orang tuanya meninggal dunia, #5115# tinggal dan diasuh oleh #0046#;',
        'Bahwa #5115# mengetahui maksud dan tujuan #0046# datang ke Pengadilan, yaitu agar #0046# ditetapkan sebagai wali bagi dirinya;',
        'Bahwa #5115# menyetujui dan tidak keberatan #0046# ditetapkan sebagai walinya;',
        'Bahwa #5115# selama diasuh dan dirawat oleh #0046# tidak pernah mendapat kekerasan baik fisik maupun nonfisik dan selalu dipenuhi kebutuhannya;',
    ]:
        baru(BUL, s, '-')
    raw(27, 28, 29, 30, 31)  # pembacaan permohonan, daftar alat bukti, A. Bukti Surat, B. Saksi
    for kepala_saksi, awal in ((32, ''), (44, 'sepengetahuan saksi ')):
        out.append(d.par[kepala_saksi])
        for s in [
            'Bahwa saksi mengenal #0046# dan #5114# yang dimintakan perwalian;',
            'Bahwa %skedua orang tua kandung #5115# telah meninggal dunia, yaitu #4405#;' % awal,
            'Bahwa %s#0046# adalah #4400# #5114# tersebut;' % awal,
            'Bahwa %ssejak orang tuanya meninggal dunia, #5115# diasuh dan dipelihara oleh #0046# serta terawat dengan baik;' % awal,
            'Bahwa %s#5115# saat ini belum dewasa dan belum pernah menikah;' % awal,
            'Bahwa %stidak ada keluarga maupun pihak lain yang keberatan #0046# menjadi wali bagi #5115#;' % awal,
            'Bahwa %s#0046# berkelakuan baik, jujur, sehat jasmani dan rohani, serta bukan pemabuk, penjudi, ataupun pemboros;' % awal,
            'Bahwa %s#0046# mengajukan perwalian untuk keperluan #8171# atas nama #5114# tersebut;' % awal,
        ]:
            baru(SAKSI_ITEM, s)
    raw(56, 57, 58)  # cukup alat bukti, kesimpulan, untuk mempersingkat
    # ---- pertimbangan hukum ----
    raw(59, 60)
    raw(61, 62)  # Kewenangan Pengadilan
    raw(63, 64, 65)  # Legal Standing (+ e-court)
    baru(SUB, 'Pertimbangan Pokok Permohonan')
    baru(BODY, 'Menimbang, bahwa permohonan #0046# pada pokoknya memohon agar dirinya ditetapkan sebagai wali bagi #5114# bernama #5110#, yang kedua orang tua kandungnya telah meninggal dunia, sehingga #0046# dapat bertindak hukum atas nama dan untuk kepentingan #5114# tersebut, khususnya untuk keperluan #8171#;')
    raw(68)  # Pertimbangan Alat Bukti
    baru(BODY, 'Menimbang, bahwa untuk menguatkan dalil-dalil permohonannya, #0046# telah mengajukan alat bukti surat sebagaimana tercantum dalam duduk perkara di atas dan menghadirkan 2 (dua) orang saksi yang keterangannya telah diuraikan pada bagian duduk perkara; bukti surat yang diajukan merupakan fotokopi yang telah dinazegelen, bermeterai cukup, dan telah dicocokkan dengan aslinya, yang oleh karena itu memenuhi ketentuan Pasal 3 ayat (1) huruf b jo. Pasal 5 Undang-Undang Nomor 10 Tahun 2020 tentang Bea Meterai;')
    baru(BODY, 'Menimbang, bahwa bukti P.1 berupa fotokopi Kartu Tanda Penduduk atas nama #0046# merupakan akta otentik, karena dibuat oleh Pejabat yang berwenang berdasarkan Pasal 1 angka 7 jo. Pasal 8 ayat (1) Undang-Undang Nomor 23 Tahun 2006 sebagaimana telah diubah dengan Undang-Undang Nomor 24 Tahun 2013 tentang Administrasi Kependudukan, sehingga mempunyai nilai kekuatan pembuktian yang sempurna dan mengikat (volledig en bindende bewijskracht) berdasarkan Pasal 285 RBg, selama tidak dibuktikan kepalsuannya. Bukti tersebut menerangkan bahwa #0046# beragama Islam dan bertempat tinggal di #0101# yang termasuk dalam wilayah hukum #8008#;')
    baru(BODY, 'Menimbang, bahwa bukti P.2 berupa fotokopi Kartu Keluarga atas nama #0046# merupakan akta otentik, karena dibuat oleh Pejabat yang berwenang berdasarkan Pasal 1 angka 7 jo. Pasal 8 ayat (1) Undang-Undang Nomor 23 Tahun 2006 sebagaimana telah diubah dengan Undang-Undang Nomor 24 Tahun 2013 tentang Administrasi Kependudukan jo. Pasal 1 angka 6 Peraturan Pemerintah Nomor 40 Tahun 2019, sehingga mempunyai nilai kekuatan pembuktian yang sempurna dan mengikat berdasarkan Pasal 285 RBg, selama tidak dibuktikan kepalsuannya. Bukti tersebut menerangkan bahwa #5115# tinggal serumah dan berada dalam asuhan #0046#;')
    baru(BODY, 'Menimbang, bahwa bukti P.3 berupa fotokopi akta kelahiran atas nama #5115# merupakan akta otentik, karena dibuat oleh Pejabat yang berwenang berdasarkan Pasal 1 angka 7 jo. Pasal 8 ayat (1) jo. Pasal 28 ayat (2) Undang-Undang Nomor 23 Tahun 2006 sebagaimana telah diubah dengan Undang-Undang Nomor 24 Tahun 2013 tentang Administrasi Kependudukan, sehingga mempunyai nilai kekuatan pembuktian yang sempurna dan mengikat berdasarkan Pasal 285 RBg, selama tidak dibuktikan kepalsuannya. Bukti tersebut menerangkan bahwa #5110# adalah anak yang lahir dari perkawinan yang sah antara #4405# dan belum dewasa;')
    baru(BODY, 'Menimbang, bahwa bukti P.4 dan P.5 berupa fotokopi kutipan akta kematian merupakan akta otentik, karena dibuat oleh Pejabat yang berwenang berdasarkan Pasal 1 angka 7 jo. Pasal 61 ayat (4) Undang-Undang Nomor 23 Tahun 2006 sebagaimana telah diubah dengan Undang-Undang Nomor 24 Tahun 2013 tentang Administrasi Kependudukan, sehingga mempunyai nilai kekuatan pembuktian yang sempurna dan mengikat berdasarkan Pasal 285 RBg, selama tidak dibuktikan kepalsuannya. Bukti tersebut menerangkan bahwa #4409#;')
    baru(BODY, 'Menimbang, bahwa bukti P.6 dan bukti surat lainnya sebagaimana tercantum dalam daftar alat bukti di atas (antara lain surat keterangan silsilah atau hubungan keluarga, surat keterangan berbadan sehat, surat keterangan catatan kepolisian, dan surat pernyataan kesanggupan) merupakan surat yang dikeluarkan oleh pejabat yang berwenang atau dibuat oleh #0046# sendiri, relevan dengan perkara a quo, dan menerangkan bahwa #0046# adalah #4400# #5114# tersebut serta dalam keadaan sehat jasmani dan rohani, tidak pernah dihukum, dan sanggup menjalankan kewajiban sebagai wali;')
    baru(BODY, 'Menimbang, bahwa selain bukti surat, #0046# juga telah mengajukan bukti berupa 2 (dua) orang saksi yaitu #1197# (Saksi I) dan #1203# (Saksi II), keduanya merupakan #1241# dan #1242#, yang telah memberikan keterangan sebagaimana tertuang dalam duduk perkara dan dipertimbangkan sebagai berikut:')
    out.append(d.ganti_teks(76, '-\tBahwa kedua saksi #0046# telah dewasa, berakal sehat, disumpah, dan memberikan keterangan di depan sidang satu persatu secara bergantian; saksi yang berasal dari keluarga maupun orang yang dekat dengan #0046# dan #5114# tersebut tetap cakap menjadi saksi dalam perkara voluntair ini sesuai Pasal 171, 172 ayat (1) dan (2) serta Pasal 175 RBg jo. Pasal 1909 sampai dengan Pasal 1912 Kitab Undang-Undang Hukum Perdata, sehingga kedua saksi telah memenuhi syarat formil sebagai saksi;'.lstrip('-\t')))
    raw(77)  # syarat materiil (sesuai dasar)
    out.append(d.ganti_teks(78, '-	Bahwa saksi-saksi #0046# telah memberikan keterangan mengenai keadaan #5114# yang dimintakan perwalian dan #0046# yang pada pokoknya sebagai berikut:'))
    for i, s in enumerate([
        'Bahwa kedua orang tua kandung #5115# telah meninggal dunia, yaitu #4405#;',
        'Bahwa #0046# adalah #4400# #5114# tersebut dan beragama Islam sebagaimana #5115#;',
        'Bahwa sejak orang tuanya meninggal dunia, #5115# tinggal bersama dan diasuh serta dipelihara oleh #0046# dengan baik, hidup sejahtera lahir dan batin;',
        'Bahwa tidak ada keluarga maupun pihak lain yang mengganggu gugat pengasuhan #0046# atas #5114# tersebut dan tidak ada yang keberatan #0046# menjadi walinya;',
        'Bahwa #5115# saat ini belum dewasa dan belum pernah menikah sehingga belum cakap melakukan perbuatan hukum;',
        'Bahwa #0046# berkelakuan baik, jujur, sehat jasmani dan rohani, serta bukan pemabuk, penjudi, ataupun pemboros;',
        'Bahwa #0046# mengajukan perwalian agar dapat bertindak hukum atas nama #5114# tersebut untuk keperluan #8171#;',
    ], 1):
        baru(SAKSI_NUM, s, '%d.' % i)
    raw(87)  # keterangan para saksi memenuhi syarat materiil
    # ---- hal terbukti ----
    raw(88)
    baru(BODY, 'Menimbang, bahwa berdasarkan bukti P.3 yang bernilai sebagai akta otentik dan berkekuatan sebagai bukti sempurna dan mengikat, dihubungkan dengan keterangan saksi-saksi #0046#, terbukti bahwa #5110# adalah anak yang lahir dari perkawinan yang sah antara #4405#, dan #0046# adalah #4400# anak tersebut; oleh karenanya dalil permohonan #0046# mengenai hal tersebut dinyatakan terbukti;')
    baru(BODY, 'Menimbang, bahwa berdasarkan bukti P.4 dan P.5 yang bernilai sebagai akta otentik dan berkekuatan sebagai bukti sempurna dan mengikat, dihubungkan dengan keterangan saksi-saksi #0046#, terbukti bahwa #4409#; oleh karenanya dalil permohonan #0046# mengenai hal tersebut dinyatakan terbukti;')
    baru(BODY, 'Menimbang, bahwa berdasarkan bukti P.2 dihubungkan dengan keterangan saksi-saksi #0046# dan keterangan #5114# di persidangan, terbukti bahwa sejak orang tuanya meninggal dunia #5115# tinggal bersama dan diasuh oleh #0046#, hidup terawat dengan baik, tidak ada pihak yang keberatan, dan #0046# sanggup menjalankan kewajiban sebagai wali; oleh karenanya dalil permohonan #0046# mengenai hal tersebut dinyatakan terbukti;')
    raw(92)  # dalil yang tidak dibuktikan tidak dipertimbangkan
    # ---- fakta hukum ----
    raw(93, 94)
    for i, s in enumerate([
        'Bahwa #5110# adalah anak yang lahir dari perkawinan yang sah antara #4405#;',
        'Bahwa #0046# dan #5115# beragama Islam;',
        'Bahwa #4409#;',
        'Bahwa #0046# adalah #4400# #5114# tersebut;',
        'Bahwa sejak orang tuanya meninggal dunia, #5115# tinggal bersama dan diasuh oleh #0046#, terawat dengan baik, dan tidak ada pihak yang keberatan;',
        'Bahwa #5115# saat ini belum dewasa dan belum pernah menikah;',
        'Bahwa #0046# berkelakuan baik, jujur, sehat jasmani dan rohani, serta tidak pernah dihukum;',
        'Bahwa #0046# mengajukan perwalian untuk keperluan #8171# atas nama #5114# tersebut;',
    ], 1):
        baru(FAKTA_NUM, s, '%d.' % i)
    # ---- pertimbangan petitum ----
    raw(105)
    baru(BODY, 'Menimbang, bahwa selanjutnya #8554# akan mempertimbangkan satu demi satu petitum permohonan #0046# sesuai dengan fakta-fakta persidangan yang telah diuraikan di atas sebagai berikut;')
    baru(BODY, 'Petitum angka 1: Mengabulkan permohonan #0046#')
    baru(BODY, 'Menimbang, bahwa petitum tersebut akan dijawab setelah mempertimbangkan seluruh petitum permohonan #0046#, karenanya jawaban terhadap petitum ini akan dicantumkan dalam konklusi dan diktum penetapan;')
    baru(BODY, 'Petitum angka 2: Menetapkan #0046# (#0098#) sebagai wali bagi #5114# yang bernama #5110#')
    baru(BODY, 'Menimbang, bahwa Pasal 50 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa anak yang belum mencapai umur 18 (delapan belas) tahun atau belum pernah melangsungkan perkawinan, yang tidak berada di bawah kekuasaan orang tua, berada di bawah kekuasaan wali, dan perwalian tersebut mengenai pribadi anak yang bersangkutan maupun harta bendanya (Pasal 50 ayat (2)); sedangkan Pasal 107 ayat (1) dan (2) Kompilasi Hukum Islam menentukan bahwa perwalian hanya terhadap anak yang belum mencapai umur 21 (dua puluh satu) tahun dan atau belum pernah melangsungkan perkawinan, dan perwalian tersebut meliputi perwalian terhadap diri dan harta kekayaannya;')
    baru(BODY, 'Menimbang, bahwa berdasarkan fakta hukum, kedua orang tua kandung #5115# telah meninggal dunia sehingga #5114# tersebut yang belum dewasa dan belum pernah menikah tidak lagi berada di bawah kekuasaan orang tua dan membutuhkan wali yang menggantikan peran serta fungsi orang tuanya untuk mewakili dirinya melakukan perbuatan hukum baik di dalam maupun di luar pengadilan, sebagaimana dikehendaki Pasal 50 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan dan Pasal 33 ayat (1) Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak sebagaimana telah diubah dengan Undang-Undang Nomor 35 Tahun 2014;')
    baru(BODY, 'Menimbang, bahwa mengenai orang yang dapat ditunjuk sebagai wali, Pasal 107 ayat (4) Kompilasi Hukum Islam menentukan bahwa wali sedapat-dapatnya diambil dari keluarga anak tersebut atau orang lain yang sudah dewasa, berpikiran sehat, adil, jujur dan berkelakuan baik, atau badan hukum, yang sejalan dengan Pasal 51 ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, serta Pasal 3 ayat (1) Peraturan Pemerintah Nomor 29 Tahun 2019 tentang Syarat dan Tata Cara Penunjukan Wali yang menentukan bahwa calon wali dapat berasal dari keluarga anak, saudara, orang lain, atau badan hukum yang ditetapkan oleh pengadilan;')
    baru(BODY, 'Menimbang, bahwa berdasarkan fakta hukum, #0046# adalah #4400# #5114# tersebut sehingga termasuk keluarga anak, telah dewasa, beragama Islam sama seperti #5115#, berpikiran sehat dan sehat jasmani, berkelakuan baik, jujur, tidak pernah dihukum, bukan pemabuk, penjudi, ataupun pemboros, telah mengasuh dan memelihara #5114# tersebut dengan baik sejak orang tuanya meninggal dunia, serta tidak ada pihak yang keberatan, sehingga #8554# menilai #0046# memenuhi syarat dan patut ditetapkan sebagai wali bagi #5114# tersebut demi kepentingan terbaik anak;')
    baru(BODY, 'Menimbang, bahwa meskipun demikian #8554# memandang perlu mengingatkan bahwa sebagai wali, #0046# wajib mengurus diri dan harta #5114# yang berada di bawah perwaliannya dengan sebaik-baiknya serta memberikan bimbingan agama, pendidikan dan keterampilan sesuai Pasal 110 ayat (1) Kompilasi Hukum Islam jo. Pasal 51 ayat (3) Undang-Undang Nomor 1 Tahun 1974, wajib membuat daftar harta benda anak pada permulaan jabatannya dan mencatat perubahan-perubahannya (Pasal 51 ayat (4) Undang-Undang Nomor 1 Tahun 1974), tidak boleh memindahkan hak atau menggadaikan barang-barang tetap milik anak kecuali apabila kepentingan anak itu menghendakinya (Pasal 52 jo. Pasal 48 Undang-Undang Nomor 1 Tahun 1974), serta bertanggung jawab atas harta benda anak dan mengganti kerugian yang timbul karena kesalahan atau kelalaiannya (Pasal 51 ayat (5) Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 110 ayat (2) Kompilasi Hukum Islam), dan hak perwalian dapat dicabut apabila wali melalaikan kewajibannya (Pasal 53 Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 109 Kompilasi Hukum Islam);')
    baru(BODY, 'Menimbang, bahwa berdasarkan seluruh pertimbangan tersebut, petitum angka 2 agar #0046# ditetapkan sebagai wali bagi #5114# yang bernama #5110# telah beralasan hukum dan patut dikabulkan;#4411#')
    # ---- biaya + amar ----
    raw(122, 123, 124, 125)
    baru(AMAR_NUM, 'Mengabulkan permohonan #0046#;', '1.')
    baru(AMAR_NUM, 'Menetapkan #0098# (#0046#) sebagai wali bagi #5114# yang bernama #5110#, yang berada di bawah perwaliannya#4412#;', '2.')
    baru(AMAR_NUM, '#8505# (#0155# #7095#).', '3.')
    raw(*range(129, 146))
    isi = d.rakit(out)
    for lama, baru_ in (('#5115#', '#4406#'), ('#5110#', '#4406#'), ('#5114#', '#4407#')):
        isi = isi.replace(lama, baru_)
    return isi


def main():
    isi = susun()
    pecah = periksa_token(isi)
    if pecah:
        raise SystemExit('token terpecah: %r' % pecah)
    simpan(TUJUAN, isi)
    print('ditulis', TUJUAN, len(isi), 'bita')


if __name__ == '__main__':
    main()
