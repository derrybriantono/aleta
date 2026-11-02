# -*- coding: utf-8 -*-
"""Paket ABT ke-32 kaidah-fikih-2nov (keputusan 104, 110 dan 120 Derry 2 Nov 2026).

1. Audit kaidah fikih semua blangko putusan/penetapan akhir derry_briantono (hasil/audit.tsv).
2. Tambah kaidah fikih/dalil syar'i yang LAZIM (bukti kelaziman: blangko Derry lain, putusan SIPP PA Donggala, blangko ABT
   PA Donggala/PA Bungku) ke blangko yang belum punya kaidah yang sesuai pokok perkaranya - teks langsung di blangko,
   tanpa variabel baru. Jenis yang tidak punya kaidah lazim yang meyakinkan TIDAK diisi (hasil/perlu-derry.tsv).
3. Izin Poligami [01b] (keputusan 120): syarat berlaku adil dikutip Pasal 58 ayat (1) huruf b KHI jo. Pasal 5 ayat (1) huruf c UU 1/1974.
Pasal 119 ayat (2) KHI tidak disentuh (jumlah kemunculannya diperiksa sama sebelum/sesudah).

Tiap tambahan = sisipan paragraf RTF (ASCII murni; huruf non-ASCII sebagai \\uN) tepat sebelum/sesudah paragraf jangkar; format paragraf
dan run diambil dari paragraf jangkar di berkas itu sendiri (huruf/ukuran sama), paragraf Arab memakai \\f0 (Times New Roman) rata kanan
seperti blangko Derry yang sudah memuat teks Arab.

pakai: python bangun_berkas.py <akar _blangko_abt (berisi derry_briantono) sesudah 31 paket> <folder paket-satker> <folder hasil>
"""
import base64
import hashlib
import io
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
from rtf2txt import rtf_ke_teks  # noqa: E402
from rtfhuruf import tabel_huruf  # noqa: E402

M = '{M}'  # sebutan majelis/hakim (#8554# atau #8555#, mengikuti berkas)
P = '{P}'  # pihak yang mengajukan (#0046# atau #7036#, mengikuti berkas)
I0, I1 = '<i>', '</i>'

AR_MUHADZDZAB = u'\u0641\u0625\u0646 \u0644\u0645 \u064a\u0643\u0646 \u0645\u0639\u0647 \u0628\u064a\u0646\u0629 \u0644\u0645 \u064a\u0633\u0645\u0639 \u062f\u0639\u0648\u0627\u0647'
AR_IANAT = (u'\u0648\u064e\u0641\u0650\u064a \u0627\u0644\u062f\u064e\u0651\u0639\u0652\u0648\u064e\u0649 \u0628\u0650\u0646\u0650\u0643\u064e\u0627\u062d\u064d '
            u'\u0639\u064e\u0644\u064e\u0649 \u0627\u0645\u0652\u0631\u064e\u0623\u064e\u0629\u064d \u0630\u0650\u0643\u0652\u0631\u064f '
            u'\u0635\u0650\u062d\u064e\u0651\u062a\u0650\u0647\u0650 \u0648\u064e\u0634\u064f\u0631\u064f\u0648\u0637\u0650\u0647\u0650 '
            u'\u0645\u0650\u0646\u0652 \u0646\u064e\u062d\u0652\u0648\u0650 \u0648\u064e\u0644\u0650\u064a\u064d\u0651 '
            u'\u0648\u064e\u0634\u064e\u0627\u0647\u0650\u062f\u064e\u064a\u0652\u0646\u0650 \u0639\u064f\u062f\u064f\u0648\u0644\u064d')
AR_HAWI = (u'\u0642\u0627\u0644 \u0627\u0644\u0634\u0627\u0641\u0639\u064a \u0631\u062d\u0645\u0647 \u0627\u0644\u0644\u0647 \u062a\u0639\u0627\u0644\u0649 : "'
           u'\u0641\u064a \u0643\u062a\u0627\u0628 \u0627\u0644\u0644\u0647 \u062a\u0639\u0627\u0644\u0649 \u0648\u0631\u0633\u0648\u0644\u0647 '
           u'\u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0628\u064a\u0627\u0646 \u0623\u0646 '
           u'\u0639\u0644\u0649 \u0627\u0644\u0623\u0628 \u0623\u0646 \u064a\u0642\u0648\u0645 \u0628\u0627\u0644\u0645\u0624\u0646\u0629 \u0641\u064a '
           u'\u0625\u0635\u0644\u0627\u062d \u0635\u063a\u0627\u0631\u0648\u0644\u062f\u0647 \u0645\u0646 \u0631\u0636\u0627\u0639 \u0648\u0646\u0641\u0642\u0629 '
           u'\u0648\u0643\u0633\u0648\u0629 \u0648\u062e\u062f\u0645\u0629 \u062f\u0648\u0646 \u0623\u0645\u0647". \u0642\u0627\u0644 '
           u'\u0627\u0644\u0645\u0627\u0648\u0631\u062f\u0649: \u0646\u0641\u0642\u0629 \u0627\u0644\u0623\u0648\u0644\u0627\u062f\u0639\u0644\u0649 '
           u'\u0627\u0644\u0623\u0628\u0627\u0621 \u0628\u062f\u0644\u064a\u0644 \u0627\u0644\u0643\u062a\u0627\u0628 \u0648\u0627\u0644\u0633\u0646\u0629 '
           u'\u0648\u0627\u0644\u0625\u062c\u0645\u0627\u0639 \u0648\u0627\u0644\u0639\u0628\u0631\u0629...\u0627\u0644\u062e')
AR_SHULHU_KHAIR = u'\u0648\u064e\u0627\u0644\u0635\u0651\u064f\u0644\u0652\u062d\u064f \u062e\u064e\u064a\u0652\u0631\u064c'
AR_SHULHU_JAIZ = (u'\u0627\u0644\u0635\u0651\u064f\u0644\u0652\u062d\u064f \u062c\u064e\u0627\u0626\u0650\u0632\u064c \u0628\u064e\u064a\u0652\u0646\u064e '
                  u'\u0627\u0644\u0652\u0645\u064f\u0633\u0652\u0644\u0650\u0645\u0650\u064a\u0646\u064e \u0625\u0650\u0644\u0651\u064e\u0627 '
                  u'\u0635\u064f\u0644\u0652\u062d\u064b\u0627 \u062d\u064e\u0631\u0651\u064e\u0645\u064e \u062d\u064e\u0644\u064e\u0627\u0644\u064b\u0627 '
                  u'\u0623\u064e\u0648\u0652 \u0623\u064e\u062d\u064e\u0644\u0651\u064e \u062d\u064e\u0631\u064e\u0627\u0645\u064b\u0627')
AR_TASHARRUF = u'\u062a\u0635\u0631\u0641 \u0627\u0644\u0627\u0645\u0627\u0645 \u0639\u0644\u0649 \u0627\u0644\u0631\u0639\u064a\u0629 \u0645\u0646\u0648\u0637 \u0628\u0627\u0644\u0645\u0635\u0644\u062d\u0629'

Q0, Q1 = u'\u201c', u'\u201d'
AP = u'\u2019'

# Kaidah: daftar paragraf (jenis, teks). jenis: 'isi' (paragraf biasa, format jangkar), 'arab', 'arti' (Artinya : <tab> "...").
KAIDAH = {
    'BUKTI': dict(
        nama=u'Kaidah pembuktian: bila Penggugat/Pemohon tidak mempunyai cukup bukti, gugatan/permohonannya ditolak',
        sumber=u'Kitab Al Muhadzdzab Juz II halaman 320 (teks Arab dan terjemahan persis blangko Derry 1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti dan 3 blangko tolak cerai lain)',
        par=[('isi', u'Menimbang, bahwa ' + M + u' perlu mengemukakan sebuah dalil ' + I0 + u'syar' + AP + u'i' + I1 + u' yang terdapat dalam Kitab ' + I0 + u'Al Muhadzdzab' + I1 +
              u' Juz II halaman 320 yang selanjutnya diambil alih sebagai pendapat ' + M + u' sebagai berikut:'),
             ('arab', AR_MUHADZDZAB),
             ('arti', Q0 + I0 + u'Apabila ' + P + u' tidak mempunyai cukup bukti, maka #0053#nya ditolak' + I1 + Q1 + u'.')]),
    'IANAT': dict(
        nama=u'Pembuktian keabsahan perkawinan: gugatan/permohonan tentang nikah harus menyebutkan sahnya beserta syarat-syaratnya (wali dan dua saksi adil)',
        sumber=u"Kitab I'anatuth Thalibin juz IV halaman 253-254 (teks persis blangko Derry 2a Itsbat Nikah Kontensius [01], [01b], [01c]; 14 blangko itsbat Derry memuat dalil yang sama)",
        par=[('isi', u'Menimbang, bahwa ' + M + u" mengambil alih pula dalil fikih yang termaktub dalam kitab " + I0 + u"I'anatuth Thalibin" + I1 +
              u' juz IV halaman 253-254 sebagai bahan pertimbangan, yang berbunyi:'),
             ('arab', AR_IANAT),
             ('arti', Q0 + I0 + u'Dalam suatu gugatan tentang pernikahan dengan seorang perempuan, harus disebutkan keabsahan pernikahan itu terlebih dahulu beserta syarat-syaratnya, seperti adanya wali dan dua orang saksi yang adil.' + I1 + Q1)]),
    'NISA3': dict(
        nama=u'Syarat berlaku adil dalam poligami',
        sumber=u"QS. an-Nisa (4) ayat 3 (kalimat persis blangko Derry 5 Izin Poligami [01], [01a], [01b]; juga blangko ABT lama PUTUSAN_IJIN_POLIGAMI_HADIR)",
        par=[('isi', u'Menimbang, bahwa ' + M + u" perlu mengemukakan firman Allah dalam al-Qur'an surat an-Nisa (4) ayat 3 yang artinya: " + Q0 +
              u'...Maka kawinilah wanita-wanita (lain) yang kamu senangi: dua, tiga atau empat. Kemudian jika kamu takut tidak akan dapat berlaku adil, maka (kawinilah) seorang saja' + Q1 + u';')]),
    'NISA7': dict(
        nama=u'Hak bagian laki-laki dan perempuan atas harta peninggalan kerabat',
        sumber=u'QS. An-Nisa ayat 7 (terjemahan persis putusan SIPP PA Donggala perkara P3HP/Penetapan Ahli Waris 6/Pdt.P dan 31/Pdt.P)',
        par=[('isi', u'Menimbang, bahwa berdasarkan firman Allah dalam surat An-Nisa ayat 7 telah diatur adanya bagian hak bagi laki-laki dan perempuan dari harta peninggalan kerabatnya sebagai berikut:'),
             ('arti', Q0 + I0 + u'Dan bagi laki-laki ada hak bagian (pula) dari harta peninggalan ibu-bapak dan kerabatnya dan bagi orang wanita ada hak bagian (pula) dari harta peninggalan ibu-bapak dan kerabatnya, baik sedikit atau banyak menurut bahagian yang telah ditetapkan' + I1 + Q1 + u';')]),
    'NISA32': dict(
        nama=u'Bagian laki-laki dan perempuan dari apa yang mereka usahakan (kemitraan suami istri atas harta bersama)',
        sumber=u'QS. An-Nisa ayat 32 (terjemahan persis putusan SIPP PA Donggala perkara Harta Bersama 637/Pdt.G)',
        par=[('isi', u'Menimbang, bahwa prinsip keadilan dan kemitraan antara suami istri atas harta yang diperoleh selama perkawinan sejalan dengan firman Allah dalam Surat An-Nisa ayat 32 sebagai berikut:'),
             ('arti', Q0 + I0 + u'Dan janganlah kamu iri hati terhadap apa yang dikaruniakan Allah kepada sebagian kamu lebih banyak dari sebagian yang lain. (Karena) bagi laki-laki ada bagian dari apa yang mereka usahakan, dan bagi para wanita (pun) ada bagian dari apa yang mereka usahakan.' + I1 + Q1 + u';')]),
    'HADHANAH': dict(
        nama=u'Ibu lebih berhak atas pemeliharaan anak selama belum menikah lagi',
        sumber=u"Hadits riwayat Abdullah bin Amr, sebagaimana diuraikan Imam Nawawi dalam al-Majmu' Syarhul Muhazzab Juz 20 halaman 223 dan al-Bujairimi dalam Tuhfatul Habib Juz 4 halaman 475-476 (teks blangko lama Derry di ABT PA Bungku: putusan_penetapan/(C3) 6, Hadhanah (Hak Asuh Anak)/Hadhanah Ibu Kandung belum mummayiz (Lite) Verstek; teks Arab tidak dibawa)",
        par=[('isi', u'Menimbang, bahwa ketentuan Pasal 105 huruf a Kompilasi Hukum Islam tersebut bersesuaian dengan sebuah hadits dan doktrin hukum Islam yang diuraikan oleh Imam Nawawi dalam kitab ' + I0 + u'al-Majmu' + AP + u' Syarhul Muhazzab' + I1 +
              u' Juz 20 halaman 223 dan Imam al-Bujairimi dalam kitab ' + I0 + u'Tuhfatul Habib' + I1 + u' Juz 4 halaman 475-476 yang diambil alih oleh ' + M + u' menjadi pertimbangan sebagai berikut:'),
             ('arti', I0 + u'Adapun dalil kami adalah hadits yang diriwayatkan oleh Abdullah bin Amr ' + Q0 + u'sesungguhnya ada seorang perempuan datang kepada Nabi Shallallahu ' + u'\u2018' + u'alaihi wasallam dan berkata wahai Rasulullah sesungguhnya anakku yang ini perutku yang mengandungnya, pangkuanku jadi pelindungnya, air susuku yang memberinya minum, sementara ayahnya mentalakku dan bermaksud mengambil anak tersebut dariku, kemudian Rasulullah Shallallahu ' + u'\u2018' + u'alaihi wasallam berkata kamu lebih berhak terhadap anak tersebut selama tidak menikah' + Q1 + I1 + u';')]),
    'NAFKAH_ANAK': dict(
        nama=u'Nafkah anak kewajiban ayah',
        sumber=u'Imam Mawardi, al Hawi al Kabir juz 11 halaman 477 (cetakan Darul Kutub Ilmiah 1994), mengutip Imam Syafi' + AP + u'i (teks Arab dan terjemahan persis blangko Derry 1a Perceraian CT/[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak))',
        par=[('isi', u'Menimbang, bahwa kewajiban ayah/bapak terhadap pemenuhan nafkah anaknya juga merupakan ketentuan yang telah ditetapkan dalam syariat Islam sesuai dengan kemampuan si ayah/bapak. Imam Mawardi dalam kitabnya ' + I0 + u'al Hawi al Kabir' + I1 +
              u' juz 11 halaman 477 (cetakan Darul Kutub Ilmiah. Tahun 1994) yang diambil alih menjadi pertimbangan ' + M + u' menguraikan sebagai berikut:'),
             ('arab', AR_HAWI),
             ('arti', Q0 + I0 + u'imam Syafi' + AP + u'i berkata (dalam kitabullah dan rasulnya, ada penjelasan bahwa sesungguhnya wajib atas ayah/bapak dalam rangka memperbaiki masa kecil anaknya untuk menunaikan pemenuhan kebutuhan anaknya berupa kebutuhan menyusu, kebutuhan nafkah/biaya belanja, pakaian dan kebutuhan dirawat/dilayani, dan bukan kewajiban ibunya). Imam Mawardi berkata, belanja anak wajib atas ayah/bapaknya berdasarkan dalil kitab (al-Qur' + AP + u'an), sunnah, ijma' + AP + u' dan ibaroh' + u'\u2026' + I1 + Q1 + u';')]),
    'TASHARRUF': dict(
        nama=u'Kaidah fikih: kebijakan pemimpin (hakim) atas rakyatnya harus berdasarkan kemaslahatan',
        sumber=u'Kaidah fiqhiyyah tasharruful imam (teks Arab dan terjemahan persis 15 blangko Itsbat Nikah Derry; dipakai pula putusan SIPP PA Donggala Perwalian 151/Pdt.P dan P3HP 169/Pdt.P)',
        par=[('isi', u'Menimbang, bahwa penetapan wali oleh pengadilan harus senantiasa berorientasi pada kemaslahatan anak yang berada di bawah perwalian, hal ini sesuai dengan kaidah fikih:'),
             ('arab', AR_TASHARRUF),
             ('arti', Q0 + I0 + u'Kebijakan pemerintah atas rakyatnya harus berdasarkan kemaslahatan' + I1 + Q1 + u';')]),
    'NISA19': dict(
        nama=u"Kewajiban suami istri saling bergaul secara patut (mu'asyarah bil ma'ruf)",
        sumber=u'QS. An-Nisa ayat 19 (rumusan persis variabel pertimbangan alasan cerai D (8530) di blangko Derry)',
        par=[('isi', u'Menimbang, bahwa Islam mewajibkan suami istri untuk saling bergaul secara patut (' + I0 + u"mu'asyarah bil ma'ruf" + I1 +
              u') sebagaimana firman Allah SWT dalam Surat An-Nisa ayat 19, sehingga suami atau istri yang melalaikan kewajibannya patut dihukum untuk memenuhi kewajiban tersebut;')]),
    'FIRASY': dict(
        nama=u'Nasab anak kepada ayah ditentukan oleh perkawinan yang sah (al-walad lil firasy)',
        sumber=u"Hadits riwayat al-Bukhari dan Muslim (terjemahan persis putusan SIPP PA Donggala P3HP 186/Pdt.P; dipakai pula Asal Usul Anak 155/Pdt.P)",
        par=[('isi', u'Menimbang, bahwa hubungan nasab anak dengan ayahnya digantungkan pada adanya ' + I0 + u'firasy' + I1 + u' atau perkawinan yang sah, sebagaimana sabda Rasulullah shallallahu ' + u'\u2018' + u'alaihi wa sallam yang diriwayatkan oleh Imam al-Bukhari dan Muslim:'),
             ('arti', Q0 + I0 + u'Anak itu bagi pemilik firasy (suami yang sah) dan bagi pezina adalah kerugian.' + I1 + Q1 + u';')]),
    'AHZAB5': dict(
        nama=u'Anak angkat tetap dinasabkan kepada ayah kandungnya',
        sumber=u"QS. al-Ahzab ayat 5 (terjemahan persis blangko ABT PA Donggala 'Konsep PA Donggala/Pengangkatan Anak' dan 'Putusan Penetapan Standar 2024/Pengangkatan Anak'; blangko ABT lama PA Bungku R. PENETAPAN PENGANGKATAN ANAK)",
        par=[('isi', u"Menimbang, bahwa hal tersebut sejalan dengan petunjuk Allah Swt. dalam al-Qur'an surat al-Ahzab ayat 5 sebagai berikut:"),
             ('arti', Q0 + I0 + u'Panggillah mereka (anak-anak angkat itu) dengan (memakai) nama bapak-bapak mereka; itulah yang lebih adil pada sisi Allah, dan jika kamu tidak mengetahui bapak-bapak mereka, maka (panggillah mereka sebagai) saudara-saudaramu seagama dan maula-maulamu. Dan tidak ada dosa atasmu terhadap apa yang kamu khilaf padanya, tetapi (yang ada dosanya) apa yang disengaja oleh hatimu. Dan adalah Allah Maha Pengampun lagi Maha Penyayang.' + I1 + Q1 + u';')]),
    'SHULHU': dict(
        nama=u'Perdamaian lebih baik dan boleh di antara kaum muslimin',
        sumber=u'QS. An-Nisa ayat 128 dan hadits riwayat at-Tirmidzi Nomor 1352 (teks Arab dan terjemahan persis blangko Derry 1 Perceraian CG/[02b] [Kabul] CG - F - Mediasi Berhasil Sebagian)',
        par=[('isi', u'Menimbang, bahwa perdamaian merupakan jalan yang paling dianjurkan dalam syariat Islam, sebagaimana firman Allah Subhanahu wa Ta' + AP + u'ala dalam Surah An-Nisa ayat 128:'),
             ('arab', AR_SHULHU_KHAIR),
             ('arti', Q0 + I0 + u'Dan perdamaian itu lebih baik.' + I1 + Q1 + u';'),
             ('isi', u'serta sabda Rasulullah Shallallahu ' + u'\u2018' + u'alaihi wa sallam yang diriwayatkan oleh Imam at-Tirmidzi dalam Sunan at-Tirmidzi Nomor 1352 dengan derajat hasan sahih:'),
             ('arab', AR_SHULHU_JAIZ),
             ('arti', Q0 + I0 + u'Perdamaian itu boleh dilakukan di antara kaum muslimin, kecuali perdamaian yang mengharamkan yang halal atau menghalalkan yang haram.' + I1 + Q1 + u';')]),
}

SUBST = {'Kabul', 'Kabul Verstek', 'Tolak', 'Tolak Verstek', 'Kabul Sebagian', 'Kabul Sebagian Verstek', 'Lian', 'Perdamaian'}
PROSEDUR = {'NO', 'Cabut', 'Gugur', 'Coret', 'Ikrar', 'Ikrar Rukun', 'Ikrar Gugur'}
FOLDER_LEWAT = ('98 Relaas', '99 PTSP', 'terhapus', '97a Putusan Sela', '97 Sita', '96 Eksekusi')

# Kaidah yang dikenali di blangko (label untuk audit). Urutan: yang pertama cocok.
LABEL = [
    ('bayyinah (al-bayyinatu ' + AP + 'alal mudda' + AP + 'i)', r'Beban pembuktian \(bayyinah\)'),
    ('Al Muhadzdzab II:320 (tidak cukup bukti -> ditolak)', r'tidak mempunyai cukup bukti'),
    ('dar' + AP + 'ul mafasid (menolak kemudaratan)', r'Menolak kemudaratan|Menolak kerusakan'),
    ('adh-dhararu yuzal (kemudaratan dihilangkan)', r'Kemudaratan dihilangkan'),
    ('Madza Hurriyatuz Zaujaini (al-Shabuni)', r'Madza Hurriyatuz'),
    ('QS Ar-Rum 21', r'tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu istri'),
    ('QS Al-Baqarah 227', r'Al-Baqarah ayat 227'),
    ('QS Ath-Thalaq/At-Thalaq 7', r'(?i)(at|ath)-?Thalaq ayat 7|Hendaklah orang yang mampu memberikan nafkah'),
    ('QS Al-Ahzab 49 / Al-Baqarah 241 (mut' + AP + 'ah)', r'(?i)al-Ahzab ayat 49|al-Baqarah ayat 241'),
    ('qaul jadid mut' + AP + 'ah', r'qaul jadid'),
    ('Ibnu Qudamah (nusyuz)', r'Ibnu Qudamah'),
    ('al Hawi al Kabir (nafkah anak)', r'(?i)al.Hawi al.Kabir'),
    ('hadits abghadhul halal', r'halal yang paling Allah benci|paling dibenci Allah'),
    ('hadits Tsauban (istri minta cerai)', r'mencium bau surga'),
    ('QS Al-Baqarah 230-232 / ayat lain cerai', r'(?i)jika suami istri bercerai maka Allah'),
    ('Al-Muwatha' + AP + ' III:145 (cacat)', r'(?i)Muwatha'),
    ('Abu Ishaq al-Syairazi (Al-Muhadzdzab)', r'Syairazi'),
    ('Bughyatul Mustarsyidin', r'Bughyatul Mustarsyidin'),
    ("I'anatuth Thalibin (pembuktian nikah)", r"(?i)I.anatu.? ?Thalibin"),
    ('tasharruful imam (kemaslahatan)', r'Kebijakan pemerintah atas rakyatnya|Kebijakan seorang pemimpin'),
    ('hadits la nikaha illa bi waliyyin', r'tidak ada nikah kecuali dengan wali|Tidak sah suatu pernikahan kecuali'),
    ('QS An-Nisa 3 (poligami adil)', r'(?i)an-Nisa \(4\) ayat 3|surah an-nisa ayat 3'),
    ('QS An-Nisa 11-12 (waris)', r'(?i)An-Nisa ayat 11'),
    ('QS An-Nisa 128 + hadits ash-shulhu jaiz', r'Dan perdamaian itu lebih baik'),
    ('QS Al-Isra 32 / hadits zina (DK)', r'(?i)Al Isra|bagian zinanya'),
    ('Wahbah az-Zuhaili (perwalian)', r'(?i)Wahbah'),
    ('Kifayatul Akhyar / QS An-Nisa 24', r'(?i)Kifayatul Akhyar|An-Nisa ayat 24'),
    ('hadits wali/janda (wali adhal)', r'(?i)wali yang enggan|Janda lebih berhak|penguasa adalah wali'),
    ('QS Al-Maidah 1 (memenuhi akad)', r'Al-Maidah ayat 1 '),
    ('dalil syar' + AP + 'i lain (Artinya/firman/hadits)', r'(?im)^Artinya\s*:|yang artinya|firman Allah|hadits|hadis |sabda Rasul'),
]
VAR_DALIL = {'8522': u'pengantar kaidah fikih + MA 38 K/AG/1990 + QS Al-Mumtahanah 10 (variabel alasan cerai)',
             '8530': u'QS An-Nisa 19, Al-Baqarah 231, Al-Muwatha' + AP + u' III:145 (variabel alasan cerai)',
             '4112': u'QS At-Thalaq 7 (variabel nafkah iddah)', '4113': u'QS Al-Ahzab 49, Al-Baqarah 241 (variabel mut' + AP + u'ah)',
             '4119': u'QS At-Thalaq 7, Al-Ahzab 49, Al-Baqarah 241 (variabel akibat cerai)',
             '3416': u'QS At-Thalaq 7, Al-Ahzab 49 dst (variabel akibat cerai kumulasi hak asuh)', '3418': u'idem 3416'}
BUKTI_SAJA = ('bayyinah', 'Al Muhadzdzab II:320')
DALAM_GRUP = []


def md5b(b):
    return hashlib.md5(b).hexdigest()


def tag_berkas(f):
    m = re.match(r'^\[[^\]]*\]\s*\[([^\]]*)\]', f)
    if m:
        return m.group(1)
    if f.startswith('Perwalian Anak oleh ortu kandung'):
        return 'Kabul'
    return '-'


def label_teks(t):
    out = []
    # label umum tidak boleh terpicu oleh kaidah pembuktian (bayyinah / Al Muhadzdzab) saja
    tu = '\n'.join(l for l in t.split('\n') if not re.search(r'Beban pembuktian \(bayyinah\)|tidak mempunyai cukup bukti', l))
    for nama, pola in LABEL:
        if re.search(pola, tu if nama.startswith('dalil syar') else t):
            out.append(nama)
    return out


def baris_teks(t):
    return [l.strip() for l in t.split('\n')]


# --- Rencana per blangko -------------------------------------------------------------------------------------------------
TOLAK_MATERIIL = {'3', '3a', '5c', '5d', '7'}  # penolakan karena alasan materiil (keberatan beralasan, larangan terbukti, syarat belum terpenuhi)
POLA_TIDAK_TERBUKTI = r'(tidak berhasil membuktikan|tidak terbukti|tidak dapat membuktikan)'


def kode_folder(folder):
    return folder.split(' ')[0]


def rencana(folder, f, tag, t, label):
    """-> (kode kaidah | None, mode jangkar, alasan bila None)."""
    kf = kode_folder(folder)
    sub = [x for x in label if not x.startswith(BUKTI_SAJA)]
    bukti = [x for x in label if x.startswith(BUKTI_SAJA)]
    if tag == 'Perdamaian':
        if any('An-Nisa 128' in x for x in label):
            return None, None, 'sudah ada'
        return 'SHULHU', 'perdamaian', ''
    if tag == 'Lian':
        return None, None, 'PERLU DERRY: belum ada kaidah lazim berbukti setempat (usul: QS An-Nur 6-9)'
    if tag.startswith('Tolak'):
        if label:
            return None, None, 'sudah ada'
        if kf in ('1c', '2a'):
            return 'IANAT', 'simpulan_tolak', ''
        if kf == '5':
            return 'NISA3', 'sesudah_simpulan_tolak', ''
        if kf not in TOLAK_MATERIIL:
            bar = [l for l in baris_teks(t) if l.startswith('Menimbang')]
            simp = [i for i, l in enumerate(bar) if re.search(r'(harus|patut|haruslah|dinyatakan) ditolak|ditolak;', l) and not re.search(r'biaya perkara|dibebankan', l)]
            if (simp and re.search(POLA_TIDAK_TERBUKTI, ' '.join(bar[max(0, simp[-1] - 1):simp[-1] + 1]))) or re.search(r'Tidak Terbukti', f):
                return 'BUKTI', 'simpulan_tolak', ''
        return None, None, 'PERLU DERRY: penolakan karena alasan materiil (bukan karena tidak terbukti), belum ada kaidah lazim berbukti setempat'
    # Kabul
    if sub:
        return None, None, 'sudah ada'
    if kf == '1e':
        return 'NISA19', 'simpulan_kabul', ''
    if kf == '4a':
        return 'NISA32', 'simpulan_kabul', ''
    if kf in ('4b', '9'):
        return 'NISA7', 'simpulan_kabul', ''
    if kf == '6a':
        if any(l.startswith('Menimbang, bahwa Pasal 105 huruf a Kompilasi Hukum Islam menentukan pemeliharaan anak yang belum mumayyiz') for l in baris_teks(t)):
            return 'HADHANAH', 'sesudah_105', ''
        return None, None, 'PERLU DERRY: tidak memuat kaidah Pasal 105 KHI (anak belum mumayyiz) sebagai sandaran hadits'
    if kf == '6c':
        return 'NAFKAH_ANAK', 'simpulan_kabul', ''
    if kf in ('6', '6f'):
        return 'TASHARRUF', 'simpulan_kabul', ''
    if kf in ('8', '8a'):
        if '[01c]' in f or '[01a] [Kabul] Pengesahan Anak - Anak Lahir Sebelum' in f:
            return None, None, 'PERLU DERRY: anak lahir < 6 bulan / sebelum nikah - hadits al-walad lil firasy dapat bertentangan dengan amar'
        return 'FIRASY', 'simpulan_kabul', ''
    if kf == '9a':
        return 'AHZAB5', 'sesudah_nasab', ''
    alasan = {
        '1f': 'hak bekas istri bervariasi (mut\'ah/iddah/madliyah/hadhanah) - kaidah harus mengikuti petitum (perlu variabel bersyarat seperti 4112/4113)',
        '3a': 'izin kawin (Pasal 6 ayat (5) UU 1/1974) - tidak ditemukan kaidah lazim di blangko/putusan setempat',
        '4c': 'wasiat - tidak ditemukan di blangko/putusan setempat (usul: QS Al-Baqarah 180; hadits Sa\'ad bin Abi Waqqash "sepertiga, dan sepertiga itu banyak", HR al-Bukhari dan Muslim)',
        '4d': 'hibah - tidak ditemukan di blangko/putusan setempat (usul: hadits "saling memberi hadiahlah kamu niscaya saling mencintai"; bila pembatalan: hadits larangan menarik kembali hibah kecuali orang tua)',
        '4e': 'wakaf - tidak ditemukan di blangko/putusan setempat (usul: hadits Ibnu Umar tentang tanah Khaibar "tahanlah pokoknya dan sedekahkan hasilnya", HR al-Bukhari dan Muslim; QS Ali Imran 92)',
        '5a': 'pembatalan perkawinan - alasan beragam (Pasal 70-72 KHI); kaidah harus mengikuti alasan',
        '5b': 'pencegahan perkawinan - tidak ditemukan kaidah lazim setempat',
        '5c': 'penolakan perkawinan - tidak ditemukan kaidah lazim setempat',
        '5d': 'perkawinan campuran - tidak ditemukan kaidah lazim setempat',
        '6b': 'penguasaan anak - Pasal 105 KHI di blangko ini dinyatakan tidak mutlak; hadits hak ibu tidak selalu sejalan',
        '6d': 'pencabutan kekuasaan orang tua - tidak ditemukan kaidah lazim setempat (usul: kaidah adh-dhararu yuzal yang sudah ada di blangko DK)',
        '6e': 'pencabutan kekuasaan wali - tidak ditemukan kaidah lazim setempat (usul: QS An-Nisa 2 / kaidah tasharruf)',
        '6g': 'ganti rugi terhadap wali - tidak ditemukan kaidah lazim setempat',
        '6h': 'nafkah anak oleh ibu - dalil nafkah anak di blangko Derry (al-Hawi) menyatakan "bukan kewajiban ibunya", bertentangan dengan pokok perkara',
        '10': 'ekonomi syariah - tidak ditemukan di blangko/putusan setempat (usul: QS Al-Maidah 1 "penuhilah akad-akad itu"; hadits "kaum muslimin terikat pada syarat-syarat mereka")',
        '10a': 'ekonomi syariah - idem',
        '96a': 'verzet - prosedural (perlawanan atas verstek), kaidah mengikuti pokok perkara asal',
        '9b': 'permohonan umum - pokok perkara tidak tertentu',
        '9c': 'mafqud - tidak ditemukan kaidah lazim setempat (usul: pendapat Umar bin Khattab tentang masa tunggu 4 tahun - perlu dicek sumbernya)',
        '7': 'wali adhal - lihat blangko',
    }.get(kf, 'tidak ada kaidah lazim berbukti setempat')
    return None, None, 'PERLU DERRY: ' + alasan


# --- RTF -----------------------------------------------------------------------------------------------------------------
def tanpa_crlf(raw):
    peta = []
    out = []
    for i, c in enumerate(raw):
        if c in '\r\n':
            continue
        out.append(c)
        peta.append(i)
    return ''.join(out), peta


def cari_baris(raw, baris, nama):
    """Posisi raw (mentah) dari potongan ASCII terpanjang yang unik dari baris teks."""
    r2, peta = tanpa_crlf(raw)
    calon = re.split(r'#\d+#|[^\x20-\x7e]|[\\{}]', baris)
    calon = sorted([c.strip() for c in calon if len(c.strip()) >= 20], key=len, reverse=True)
    for c in calon:
        for pjg in (len(c), 60, 40, 30):
            for awal in range(0, max(1, len(c) - pjg + 1), 7):
                s = c[awal:awal + pjg]
                if len(s) < 20:
                    continue
                if r2.count(s) == 1:
                    return peta[r2.index(s)]
    raise AssertionError((nama, 'jangkar tidak ditemukan unik', baris[:80]))


PAR = re.compile(r'\\par(?![a-z])')


def kedalaman(raw, idx):
    d = 0
    k = 0
    while k < idx:
        c = raw[k]
        if c == '\\':
            k += 2
            continue
        if c == '{':
            d += 1
        elif c == '}':
            d -= 1
        k += 1
    return d


def batas_paragraf(raw, pos, arah):
    """Titik antara dua paragraf: sesudah \\par (dan kurung tutup run) sebelum (arah -1) atau sesudah (arah +1) pos."""
    if arah < 0:
        ms = [m for m in PAR.finditer(raw, 0, pos)]
        assert ms, 'tidak ada \\par sebelum jangkar'
        m = ms[-1]
    else:
        m = PAR.search(raw, pos)
        assert m, 'tidak ada \\par sesudah jangkar'
    j = m.end()
    while j < len(raw) and raw[j] in ' \r\n}':
        j += 1
    return j


def grup_pembuka(raw, p):
    """Posisi '{' pembuka grup yang melingkupi titik p."""
    d = 0
    k = p - 1
    while k >= 0:
        c = raw[k]
        bs = 0
        j = k - 1
        while j >= 0 and raw[j] == '\\':
            bs += 1
            j -= 1
        if c in '{}' and bs % 2 == 0:
            if c == '}':
                d += 1
            elif d == 0:
                return k
            else:
                d -= 1
        k -= 1
    raise AssertionError('grup pembuka tidak ada')


def awalan_berlaku(raw, pos):
    p = raw.rfind('\\pard', 0, pos)
    assert p > 0
    return p, raw[p:raw.index('{', p)]


HURUF_KATA = re.compile(r'\\(f|fs|af|afs|lang|langfe|langnp|langfenp|hich|loch|dbch|rtlch|ltrch|fcs|cf)(-?\d+)?(?![A-Za-z])')


def saring_huruf(seg):
    """Hanya kata kendali format HURUF (huruf, ukuran, bahasa, warna) dari potongan kata kendali; yang lain (\\par, \\i, \\b, rsid ...) dibuang."""
    return ''.join('\\%s%s ' % (m.group(1), m.group(2) or '') for m in HURUF_KATA.finditer(seg))


def tanpa_grup(seg):
    while True:
        x = seg.find('{')
        if x < 0:
            return seg
        y = grup_akhir_rtf(seg, x)
        seg = seg[:x] + (seg[y + 1:] if y >= 0 else '')


def grup_akhir_rtf(s, i):
    d = 0
    j = i
    while j < len(s):
        c = s[j]
        if c == '\\':
            j += 2
            continue
        if c == '{':
            d += 1
        elif c == '}':
            d -= 1
            if d == 0:
                return j
        j += 1
    return -1


def format_run(raw, b):
    """Format huruf run pertama paragraf yang mulai di titik b."""
    a = raw.index('{', b)
    m = re.match(r'\{((?:\\[a-z]+-?\d* ?)+)', raw[a:a + 2000].replace('\r', '').replace('\n', ''))
    run = saring_huruf(m.group(1)) if m else ''
    return run or '\\fs24 '


TOKEN = re.compile(r'\\([a-z]+)(-?\d+)? ?|\\.|[{}]|[^\\{}]+', re.S)


def format_di(raw, pos):
    """Format HURUF yang berlaku tepat di posisi pos (penelusuran grup dari awal berkas; \\plain mengosongkan)."""
    tumpuk = [{}]
    for m in TOKEN.finditer(raw, 0, pos):
        s = m.group(0)
        if s == '{':
            tumpuk.append(dict(tumpuk[-1]))
        elif s == '}':
            if len(tumpuk) > 1:
                tumpuk.pop()
        elif m.group(1):
            w, n = m.group(1), m.group(2)
            if w == 'plain':
                for k in ('f', 'fs', 'af', 'afs', 'lang', 'langfe', 'langnp', 'langfenp', 'cf'):
                    tumpuk[-1].pop(k, None)
            elif w in ('f', 'fs', 'af', 'afs', 'lang', 'langfe', 'langnp', 'langfenp', 'cf') and n is not None:
                tumpuk[-1][w] = n
    st = tumpuk[-1]
    run = ''
    if 'af' in st or 'afs' in st:
        run += '\\rtlch \\fcs1 ' + ('\\af%s ' % st['af'] if 'af' in st else '') + ('\\afs%s ' % st['afs'] if 'afs' in st else '')
    run += '\\ltrch \\fcs0 '
    for k in ('f', 'fs', 'lang', 'langfe', 'langnp', 'langfenp', 'cf'):
        if k in st:
            run += '\\%s%s ' % (k, st[k])
    if 'fs' not in st:
        run += '\\fs24 '
    return run


def format_aktif(raw, a, p):
    """Format huruf yang BERLAKU di titik p di dalam grup yang dibuka di a: kemunculan TERAKHIR tiap kata kendali huruf
    di antara pembuka grup dan p (grup bersarang di antaranya diabaikan)."""
    seg = tanpa_grup(raw[a + 1:p]).replace('\r', '').replace('\n', '')
    akhir = {}
    for m in HURUF_KATA.finditer(seg):
        akhir[m.group(1)] = m.group(2) or ''
    urut = ['rtlch', 'fcs', 'af', 'afs', 'ltrch', 'f', 'fs', 'lang', 'langfe', 'langnp', 'langfenp', 'cf', 'hich', 'dbch', 'loch']
    run = ''.join('\\%s%s ' % (k, akhir[k]) for k in urut if k in akhir and k not in ('hich', 'dbch', 'loch'))
    return run or '\\fs24 '


def esc(s):
    out = []
    for ch in s:
        o = ord(ch)
        if ch in '\\{}':
            out.append('\\' + ch)
        elif ch == '\t':
            out.append('\\tab ')
        elif 32 <= o < 127:
            out.append(ch)
        else:
            if o > 32767:
                o -= 65536
            out.append('\\uc1 \\u%d ?' % o)
    return ''.join(out)


def run_teks(run, s):
    """Teks dengan penanda <i>..</i> -> run RTF."""
    out = []
    for i, bag in enumerate(re.split(r'(<i>|</i>)', s)):
        pass
    miring = False
    for bag in re.split(r'(<i>|</i>)', s):
        if bag == '<i>':
            miring = True
            continue
        if bag == '</i>':
            miring = False
            continue
        if bag:
            out.append('{' + ('\\i1 ' if miring else '') + run + esc(bag) + '}')
    return ''.join(out)


def ubah_awalan(awalan, jenis):
    a = awalan
    if jenis == 'arab':
        a = re.sub(r'\\q[jlrc]\b ?', '', a)
        a = a.replace('\\pard \\plain ', '\\pard \\plain \\qr ', 1) if '\\pard \\plain ' in a else a.replace('\\pard ', '\\pard \\qr ', 1)
        a = re.sub(r'\\fi-?\d+', r'\\fi0', a)
        a = re.sub(r'\\li\d+', r'\\li0', a)
        a = re.sub(r'\\lin\d+', r'\\lin0', a)
    elif jenis == 'arti':
        a = re.sub(r'\\q[lrc]\b', r'\\qj', a)
        a = re.sub(r'\\fi-?\d+', r'\\fi-998', a)
        a = re.sub(r'\\li\d+', r'\\li998', a)
        a = re.sub(r'\\lin\d+', r'\\lin998', a)
        a = re.sub(r'(\\tq[lrc] )?\\tx\d+ ?', '', a)
        a = a.replace('\\itap0', '\\tql \\tx998 \\itap0', 1) if '\\itap0' in a else a + '\\tql \\tx998 '
    else:
        a = re.sub(r'\\q[lrc]\b', r'\\qj', a)
        if not re.search(r'\\fi-?\d+', a):
            a = a.replace('\\pard \\plain ', '\\pard \\plain \\fi720 ', 1)
    if not a.endswith(' '):
        a += ' '
    return a


def bangun_sisipan(paragraf, awalan, run, ganti):
    out = []
    for jenis, teks in paragraf:
        for k, v in ganti.items():
            teks = teks.replace(k, v)
        a = ubah_awalan(awalan, jenis)
        if jenis == 'arab':
            isi = '{\\rtlch \\fcs1 \\af0 \\afs40 \\ltrch \\fcs0 \\b1 \\fs40 \\loch \\af0 \\hich \\af0 \\dbch \\f0 ' + esc(teks) + '}'
            out.append(a + isi + '{' + run + '\\par }')
        elif jenis == 'arti':
            out.append(a + '{' + run + 'Artinya :}{' + run + '\\tab }' + run_teks(run, teks) + '{' + run + '\\par }')
        else:
            out.append(a + run_teks(run, teks) + '{' + run + '\\par }')
    return ''.join(out)


def seimbang(raw):
    d = 0
    k = 0
    while k < len(raw):
        c = raw[k]
        if c == '\\':
            k += 2
            continue
        if c == '{':
            d += 1
        elif c == '}':
            d -= 1
            if d < 0:
                return False
        k += 1
    return d == 0


def baris_jangkar(mode, bar, nama):
    """Baris teks jangkar + apakah sisipan SESUDAH baris itu."""
    mz = [l for l in bar if l.startswith('Menimbang')]
    if mode == 'simpulan_kabul':
        c = [l for l in mz if 'berdasarkan pertimbangan-pertimbangan tersebut di atas' in l or 'berdasarkan pertimbangan tersebut di atas' in l]
        c = [l for l in c if 'dikabulkan' in l or 'beralasan hukum' in l or 'ditetapkan' in l]
        if not c:
            c = [l for l in mz if re.search(r'berdasarkan (segala |seluruh )?pertimbangan', l) and re.search(r'dikabulkan|beralasan', l)
                 and not re.search(r'biaya perkara|dibebankan|pencabutan', l)]
        if not c:
            c = [l for l in mz if re.search(r'(dapat|patut) dikabulkan|patut untuk dikabulkan', l) and not re.search(r'biaya perkara|dibebankan|pencabutan', l)]
        if not c:
            # tanpa kalimat simpulan tersendiri: sisip sebelum pertimbangan biaya perkara
            c = [l for l in mz if re.search(r'biaya perkara', l)][:1]
        assert c, (nama, 'simpulan kabul tidak ada')
        return c[-1], False
    if mode == 'simpulan_tolak':
        c = [l for l in mz if re.search(r'(harus|patut|haruslah|dinyatakan) ditolak|ditolak;', l) and not re.search(r'biaya perkara|dibebankan', l)]
        assert c, (nama, 'simpulan tolak tidak ada')
        return c[-1], False
    if mode == 'sesudah_simpulan_tolak':
        c = [l for l in mz if 'tidak beralasan hukum dan harus ditolak' in l]
        assert len(c) == 1, (nama, 'simpulan tolak poligami', len(c))
        return c[0], True
    if mode == 'sesudah_105':
        c = [l for l in mz if l.startswith('Menimbang, bahwa Pasal 105 huruf a Kompilasi Hukum Islam menentukan pemeliharaan anak yang belum mumayyiz')]
        assert len(c) == 1, (nama, '105')
        return c[0], True
    if mode == 'sesudah_nasab':
        c = [l for l in mz if 'dalam perspektif Hukum Islam, pengangkatan anak' in l]
        assert len(c) == 1, (nama, 'nasab')
        return c[0], True
    if mode == 'perdamaian':
        c = [l for l in mz if 'untuk menguatkan kesepakatan perdamaian' in l]
        if c:
            return c[0], False
        c = [l for l in mz if 'biaya perkara' in l]
        if c:
            return c[0], False
        c = [l for l in bar if l.startswith('Mengingat')]
        assert c, (nama, 'perdamaian')
        return c[0], False
    raise AssertionError(mode)


# --- Keputusan 120: Izin Poligami [01b] -----------------------------------------------------------------------------------
POLIGAMI_01B = 'derry_briantono/5 Izin Poligami/[01b] [Kabul] Izin Poligami - Termohon Keberatan (Pasal 59 KHI).rtf'
POLIGAMI_LAMA = ('Pasal 5 ayat (1) huruf b dan huruf c Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 55 ayat (2), Pasal 57, Pasal 58 ayat (1) huruf b dan Pasal 59 Kompilasi Hukum Islam')
POLIGAMI_BARU = ('Pasal 5 ayat (1) huruf b Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 55 ayat (2), Pasal 57, Pasal 58 ayat (1) huruf b Kompilasi Hukum Islam '
                 'jo. Pasal 5 ayat (1) huruf c Undang-Undang Nomor 1 Tahun 1974 dan Pasal 59 Kompilasi Hukum Islam')


def potong_poligami(raw):
    """Potongan kata (offset, lama, baru) atas raw untuk kalimat simpulan [01b]; kalimat boleh terpecah run/CRLF."""
    r2, peta = tanpa_crlf(raw)
    pot = []
    # 1) "huruf b dan huruf c Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 55" -> buang " dan huruf c"
    k1 = 'Pasal 5 ayat (1) huruf b dan huruf c Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 55 ayat (2)'
    assert r2.count(k1) == 1, ('poligami k1', r2.count(k1))
    o = r2.index(k1) + k1.index(' dan huruf c')
    assert all(peta[o + j] == peta[o] + j for j in range(len(' dan huruf c')))
    pot.append((peta[o], ' dan huruf c', ''))
    # 2) "Pasal 58 ayat (1) huruf b dan Pasal 59 Kompilasi Hukum Islam, sedangkan" -> sisip sesudah "huruf b"
    k2 = 'Pasal 58 ayat (1) huruf b dan Pasal 59 Kompilasi Hukum Islam, sedangkan keberatan'
    assert r2.count(k2) == 1, ('poligami k2', r2.count(k2))
    o2 = r2.index(k2) + len('Pasal 58 ayat (1) huruf b')
    pot.append((peta[o2 - 1] + 1, '', ' Kompilasi Hukum Islam jo. Pasal 5 ayat (1) huruf c Undang-Undang Nomor 1 Tahun 1974'))
    return pot


def terapkan(raw, pot):
    for off, lama, baru in sorted(pot, key=lambda x: -x[0]):
        assert raw[off:off + len(lama)] == lama, (off, lama)
        raw = raw[:off] + baru + raw[off + len(lama):]
    return raw


def polos(t):
    return re.sub(r'\s+', ' ', t)


def main():
    akar, keluar, hasil = sys.argv[1], sys.argv[2], sys.argv[3]
    for x in (keluar, hasil):
        if not os.path.isdir(x):
            os.makedirs(x)
    dasar = os.path.join(akar, 'derry_briantono')
    audit = []
    tambal = []
    for dp, dn, fn in os.walk(dasar):
        dn.sort()
        rel_dir = os.path.relpath(dp, dasar).replace(os.sep, '/')
        folder = rel_dir.split('/')[0]
        if folder == '.' or ' - BAS' in folder or folder.startswith(('- BAS', 'ALUR', 'BAS ')) or folder in FOLDER_LEWAT:
            continue
        for f in sorted(fn):
            if not f.lower().endswith('.rtf'):
                continue
            rel = 'derry_briantono/' + rel_dir + '/' + f
            b = open(os.path.join(dp, f), 'rb').read()
            raw = b.decode('latin1')
            t = rtf_ke_teks(raw)
            tag = tag_berkas(f)
            label = label_teks(t)
            vd = sorted(v for v in set(re.findall(r'#(\d{4,5})#', t)) if v in VAR_DALIL)
            p119 = len(re.findall(r'Pasal 119 ayat \(2\)', polos(t)))
            if tag in PROSEDUR:
                audit.append((folder, f[:-4], tag, '; '.join(label), '; '.join(VAR_DALIL[v] for v in vd), p119, '-', 'prosedural (NO/cabut/gugur/coret/ikrar): kaidah fikih tidak lazim, tidak diisi'))
                continue
            if tag not in SUBST:
                audit.append((folder, f[:-4], tag, '; '.join(label), '', p119, '-', 'bukan putusan akhir pokok perkara (sela/sisipan/penetapan antara), tidak diisi'))
                continue
            if vd and tag != 'Perdamaian':
                label = label + ['(variabel) ' + VAR_DALIL[v] for v in vd]
            kode, mode, alasan = rencana(folder, f, tag, t, label)
            pot = []
            if rel == POLIGAMI_01B:
                pot += potong_poligami(raw)
            if kode:
                bar = baris_teks(t)
                jb, sesudah = baris_jangkar(mode, bar, rel)
                pos = cari_baris(raw, jb, rel)
                pg, awalan = awalan_berlaku(raw, pos)
                b0 = batas_paragraf(raw, pos, -1)
                run = format_di(raw, pos)  # format huruf teks jangkar itu sendiri
                p = batas_paragraf(raw, pos, +1) if sesudah else b0
                # blangko simpanan Word: beberapa paragraf hidup dalam SATU grup run ("... \par Menimbang ... \par }"); titik sisip
                # lalu berada satu tingkat di dalam grup itu - sisipan tetap seimbang dan format paragraf jangkar diulang sesudahnya.
                dk = kedalaman(raw, p) - kedalaman(raw, pg)
                assert dk in (0, 1), (rel, 'kedalaman titik sisip', dk)
                if dk:
                    DALAM_GRUP.append(rel)
                # paragraf sesudah titik sisip yang TIDAK punya \pard sendiri mewarisi format dari \pard terakhir:
                # sesudah sisipan, format paragraf jangkar diulang agar paragraf itu tetap seperti semula.
                ulang = '' if raw[p:].lstrip(' \r\n').startswith('\\pard') else awalan
                tm = '#8555#' if (t.count('#8555#') > t.count('#8554#')) else '#8554#'
                tp = '#7036#' if (t.count('#7036#') > t.count('#0046#')) else '#0046#'
                sis = bangun_sisipan(KAIDAH[kode]['par'], awalan, run, {M: tm, P: tp})
                assert all(ord(c) < 128 for c in sis)
                pot.append((p, '', sis + ulang))
            if pot:
                baru = terapkan(raw, pot)
                assert seimbang(raw) and seimbang(baru), rel
                t2 = rtf_ke_teks(baru)
                assert len(re.findall(r'Pasal 119 ayat \(2\)', polos(t2))) == p119, (rel, 'Pasal 119 ayat (2) berubah')
                assert 'aleta' not in baru.lower() or 'aleta' in raw.lower()
                if kode:
                    # paragraf pertama sisipan tampak di teks, tepat di sekitar jangkar
                    awal = polos(rtf_ke_teks('{' + bangun_sisipan(KAIDAH[kode]['par'][:1], '\\pard ', '', {M: tm, P: tp}) + '}')).strip()[:60]
                    assert awal in polos(t2), (rel, 'sisipan tidak tampak', awal)
                    pt2 = polos(t2)
                    ja = polos(jb)[:50]
                    i_s, i_j = pt2.index(awal), pt2.index(ja)
                    assert (i_j < i_s) if sesudah else (i_s < i_j), (rel, 'urutan sisipan-jangkar')
                    assert abs(i_s - i_j) < 6000, (rel, 'sisipan jauh dari jangkar')
                if rel == POLIGAMI_01B:
                    assert polos(POLIGAMI_BARU) in polos(t2), 'poligami teks baru tidak tampak'
                    assert polos(POLIGAMI_LAMA) not in polos(t2)
                tambal.append((rel, b, baru.encode('latin1'), pot, kode or '-', ('+120' if rel == POLIGAMI_01B else '')))
                ket = ('DITAMBAH: ' + KAIDAH[kode]['nama'] + ' - ' + KAIDAH[kode]['sumber']) if kode else ''
                if rel == POLIGAMI_01B:
                    ket = (ket + ' | ' if ket else '') + 'keputusan 120: syarat adil = Pasal 58 ayat (1) huruf b KHI jo. Pasal 5 ayat (1) huruf c UU 1/1974'
                audit.append((folder, f[:-4], tag, '; '.join(label), '', p119, kode or '-', ket or alasan))
            else:
                audit.append((folder, f[:-4], tag, '; '.join(label), '', p119, '-', alasan))
    tambal.sort(key=lambda x: x[0])
    with io.open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as d, \
            io.open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='utf-8', newline='\n') as tt:
        d.write(u'# kode\tberkas\tmd5_lama\tmd5_baru\tjumlah potongan - berkas diubah HANYA bila md5 persis md5_lama (keadaan sesudah 31 paket ../URUTAN-PASANG-1nov.md)\n')
        tt.write(u'# kode\toffset\tb64(teks lama)\tb64(teks baru)\n')
        for i, (rel, lama, baru, pot, kode, x) in enumerate(tambal, 1):
            k = 'K%04d' % i
            d.write(u'%s\t%s\t%s\t%s\t%d\n' % (k, rel, md5b(lama), md5b(baru), len(pot)))
            for off, a, z in sorted(pot):
                tt.write(u'%s\t%d\t%s\t%s\n' % (k, off, base64.b64encode(a.encode('latin1')).decode('ascii'), base64.b64encode(z.encode('latin1')).decode('ascii')))
    with io.open(os.path.join(hasil, 'rincian.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(u'# kode\tkaidah\tberkas\tpotongan\n')
        for i, (rel, lama, baru, pot, kode, x) in enumerate(tambal, 1):
            o.write(u'K%04d\t%s%s\t%s\t%d\n' % (i, kode, x, rel, len(pot)))
    with io.open(os.path.join(hasil, 'audit.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(u'# folder\tblangko\tjenis\tkaidah/dalil yang ADA (sebelum paket)\tdalil lewat variabel (lama)\tPasal 119 ayat (2) KHI (kali)\tditambah\tketerangan\n')
        for r in sorted(audit):
            o.write(u'%s\t%s\t%s\t%s\t%s\t%d\t%s\t%s\n' % r)
    with io.open(os.path.join(hasil, 'kaidah.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(u'# kode\tkaidah\tsumber dan bukti kelaziman\tteks yang disisipkan (#8554#/#0046# mengikuti berkas)\n')
        for k in sorted(KAIDAH):
            v = KAIDAH[k]
            o.write(u'%s\t%s\t%s\t%s\n' % (k, v['nama'], v['sumber'], ' || '.join('[%s] %s' % (j, re.sub('</?i>', '', s)) for j, s in v['par'])))
    n = {}
    for r in audit:
        n[r[6]] = n.get(r[6], 0) + 1
    print('SISIP DALAM GRUP RUN: %d %s' % (len(DALAM_GRUP), '; '.join(DALAM_GRUP)))
    print('BLANGKO DIAUDIT=%d DITAMBAL=%d %s' % (len(audit), len(tambal), ' '.join('%s=%d' % kv for kv in sorted(n.items()))))


if __name__ == '__main__':
    main()
