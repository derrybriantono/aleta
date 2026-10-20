# -*- coding: utf-8 -*-
"""Katalog saksi PERKAWINAN CAMPURAN (359) - agen W3a-A. Dibangkitkan oleh jenis_perkawinan_campuran.py (bangun_katalog)."""
import glob
import os

import w3a_lib as L
import w3aA_susun as S
from w3aA_susun import J, JG, Q
from w3aA_katalog_penolakan import _dh, _q_dari

BARU = ['3622', '3623', '3625', '3626', '3627']


def katalog(j):
    dasar = _dh('pencegahan-perkawinan', ['dh-sebab-pengetahuan', 'dh-beban-bukti', 'dh-pc-a', 'dh-pc-b', 'dh-pc-e'])
    dasar += _dh('wali-adhal', ['dh-rbg-saksi-formil', 'dh-rbg-saksi-materiil'])
    dasar += [
        dict(id='dh-pasal-49a-21', rujukan='Pasal 49 huruf a beserta penjelasannya angka 21 UU 7/1989 jo UU 3/2006 jo UU 50/2009; Pasal 63 ayat (1) huruf a UU 1/1974',
             uraian='putusan tentang hal penolakan pemberian keterangan untuk melakukan perkawinan campuran menjadi kewenangan Pengadilan Agama bagi yang beragama Islam',
             status='terverifikasi', sumber='Penjelasan Pasal 49 huruf a angka 21 pada naskah UU 3/2006 (referensi/_unduhan/ekstra/uu3-2006.txt) dan Pasal 63 ayat (1) huruf a naskah BPK UU 1/1974'),
        dict(id='dh-uup-57-59', rujukan='Pasal 57 dan Pasal 59 ayat (2) UU 1/1974',
             uraian='perkawinan campuran ialah perkawinan antara dua orang yang tunduk pada hukum yang berlainan karena perbedaan kewarganegaraan dan salah satu pihak WNI; yang dilangsungkan di Indonesia dilakukan menurut UU Perkawinan',
             status='terverifikasi', sumber='naskah BPK UU 1/1974 (referensi/_unduhan/uu1-1974/uu1-1974-bpk.txt) Pasal 57 dan Pasal 59'),
        dict(id='dh-uup-60', rujukan='Pasal 60 ayat (1) sampai ayat (5) UU 1/1974',
             uraian='perkawinan campuran baru dapat dilangsungkan setelah terbukti syarat menurut hukum masing-masing pihak dipenuhi; surat keterangan dari yang berwenang mencatat; penolakan diputus pengadilan dengan tidak beracara dan tanpa banding; keputusan menjadi pengganti keterangan; berlaku 6 bulan',
             status='terverifikasi', sumber='naskah BPK UU 1/1974 Pasal 60'),
        dict(id='dh-uup-6-khi-16', rujukan='Pasal 6 ayat (1) UU 1/1974 jo Pasal 16 ayat (1) KHI',
             uraian='perkawinan didasarkan atas persetujuan kedua calon mempelai',
             status='terverifikasi', sumber='naskah BPK UU 1/1974 Pasal 6 ayat (1); KHI-pasal-terverifikasi.md Pasal 16'),
    ]
    keadaan = {
        'alasan': dict(sumber='borang', nilai=list('ABCDEF'), bawaan='A', label='Syarat yang dijadikan alasan penolakan (huruf A sampai F)',
                       labelNilai={'A': 'A surat keterangan negara asal belum ada', 'B': 'B calon masih terikat perkawinan', 'C': 'C belum mencapai umur perkawinan',
                                   'D': 'D perbedaan agama', 'E': 'E paspor atau izin tinggal bermasalah', 'F': 'F syarat lain menurut hukum masing-masing'}),
        'hasil': dict(sumber='borang', nilai=['syarat-terpenuhi', 'syarat-tidak-terpenuhi'], bawaan='syarat-terpenuhi',
                      label='Keterangan saksi tentang syarat perkawinan yang dijadikan alasan penolakan',
                      labelNilai={'syarat-terpenuhi': 'syarat itu sudah terpenuhi', 'syarat-tidak-terpenuhi': 'syarat itu belum terpenuhi'}),
    }
    huruf_dh = ['dh-uup-60']
    pokok = [
        dict(id='pp-saksi-formil', judul='Syarat formil saksi', uraian='saksi mengenal Pemohon, menyebut hubungannya, dan tidak berkepentingan', dasarHukum=['dh-rbg-saksi-formil', 'dh-sebab-pengetahuan'], wajib=True),
        dict(id='pp-calon-mempelai', judul='Kedua calon mempelai', uraian='identitas calon mempelai WNI dan calon mempelai WNA dan hubungan keduanya', dasarHukum=['dh-uup-57-59'], wajib=True),
        dict(id='pp-kewarganegaraan-agama', judul='Kewarganegaraan dan agama', uraian='perbedaan kewarganegaraan (salah satu WNI) dan agama Islam kedua calon sehingga menjadi kewenangan Pengadilan Agama', dasarHukum=['dh-uup-57-59', 'dh-pasal-49a-21'], wajib=True),
        dict(id='pp-rencana-nikah', judul='Rencana perkawinan dan permintaan surat keterangan', uraian='kedua calon berencana menikah di Indonesia dan telah meminta surat keterangan syarat-syarat perkawinan', dasarHukum=['dh-uup-60'], wajib=True),
        dict(id='pp-penolakan-pejabat', judul='Penolakan pejabat', uraian='pejabat menolak memberikan surat keterangan dan alasannya', dasarHukum=['dh-uup-60'], wajib=True),
        dict(id='pp-syarat', judul='Terpenuhi atau tidaknya syarat perkawinan menurut hukum masing-masing', uraian='fakta tentang syarat yang dijadikan alasan penolakan (surat keterangan negara asal, status, umur, agama, paspor, syarat lain)', dasarHukum=['dh-uup-60', 'dh-pc-a', 'dh-pc-b', 'dh-pc-e'], wajib=True),
        dict(id='pp-syarat-umum', judul='Persetujuan calon mempelai dan halangan lain', uraian='perkawinan dikehendaki kedua calon tanpa paksaan dan tidak ada halangan lain', dasarHukum=['dh-uup-6-khi-16'], wajib=True),
        dict(id='pp-upaya-akibat', judul='Upaya Pemohon dan rencana waktu perkawinan', uraian='upaya Pemohon sebelum ke pengadilan dan rencana perkawinan setelah keterangan diberikan (berlaku enam bulan)', dasarHukum=['dh-uup-60'], wajib=False),
        dict(id='pp-penutup', judul='Penutup', uraian='saksi menyatakan keterangannya telah cukup', dasarHukum=[], wajib=False),
    ]
    P = []
    P.append(_q_dari('wali-adhal', 'q-kenal-pemohon', urutan=10, variabelAbt=['0046']))
    P.append(Q('q-hubungan-kepentingan', 'pp-saksi-formil', 20, 'inti', 'hubungan',
               'Apakah saksi mempunyai kepentingan atau hubungan lain dengan #0046# yang dapat memengaruhi keterangan saksi ?', None,
               J('saksi tidak punya kepentingan yang memengaruhi keterangannya',
                 ['saya tidak mempunyai kepentingan apa pun atas permohonan #0046# ini selain menjadi saksi', 'saya datang hanya sebagai saksi dan tidak punya kepentingan pribadi terhadap #0046#',
                  'tidak ada hubungan kerja atau kepentingan lain antara saya dengan #0046# yang memengaruhi keterangan saya', 'saya tidak terikat kepentingan dengan #0046# dan berdiri netral dalam perkara ini'],
                 ['keterangan ini saya berikan tanpa kepentingan pribadi terhadap #0046#', 'tak ada kepentingan lain antara saya dan #0046# selain keterangan yang saya berikan hari ini',
                  'saya bukan pihak yang berkepentingan atas permohonan #0046# ini', 'saya tidak memiliki ikatan kepentingan dengan #0046# dan menerangkan apa adanya']),
               varian=['Apakah saksi punya kepentingan lain atas permohonan #0046# ini ?']))
    P.append(Q('q-kenal-calon', 'pp-calon-mempelai', 30, 'inti', 'pokok',
               'Apakah saksi kenal dengan calon mempelai yang bernama #3622# dan calon mempelai yang bernama #3623# ?', 'kedua calon mempelai yang hendak menikah',
               J('saksi mengenal calon mempelai WNI dan calon mempelai WNA',
                 ['saya kenal baik dengan #3622# dan #3623# yang hendak menikah', 'saya mengenal #3622# sebagai calon mempelai Indonesia dan #3623# sebagai calon mempelai asing', 'sejak lama saya mengenal #3622# serta #3623# yang berencana menikah', 'benar saya kenal dengan #3622# dan juga dengan #3623# calon pasangannya'],
                 ['#3622# dan #3623# adalah dua orang yang saya kenal dan keduanya akan menikah', 'calon mempelai #3622# dan calon mempelai #3623# sama-sama saya kenal dari dulu', 'saya sudah mengenal #3622# maupun #3623# sebelum mereka berencana menikah', 'dua orang itu yaitu #3622# dan #3623# memang saya kenal dengan baik']),
               varian=['Apakah saksi mengenal #3622# dan #3623# yang hendak menikah ?', 'Kenalkah saksi dengan #3622# dan #3623# ?']))
    P.append(Q('q-hubungan-calon', 'pp-calon-mempelai', 40, 'inti', 'pokok', 'Apa hubungan antara #3622# dan #3623# dan sejak kapan keduanya berencana menikah ?', 'hubungan dan rencana menikah kedua calon mempelai',
               JG('keduanya berencana menikah', ['#3622# dan #3623# telah menjalin hubungan dan sepakat untuk menikah', '#3622# dan #3623# adalah sepasang calon mempelai yang berencana menikah'],
                  ['kedua calon yaitu #3622# dan #3623# sudah sepakat membangun rumah tangga', '#3622# bersama #3623# berniat menikah dan saling menyetujui rencana tersebut']),
               varian=['Bagaimana hubungan #3622# dengan #3623# sampai keduanya berencana menikah ?']))
    P.append(Q('q-kewarganegaraan', 'pp-kewarganegaraan-agama', 50, 'inti', 'pokok', 'Apa kewarganegaraan #3622# dan #3623# ?', 'kewarganegaraan kedua calon mempelai',
               J('calon mempelai pertama warga negara Indonesia dan calon mempelai lainnya warga negara asing',
                 ['#3622# adalah warga negara Indonesia sedangkan #3623# adalah warga negara #3625#', 'saya tahu #3622# berkewarganegaraan Indonesia dan #3623# berkewarganegaraan #3625#',
                  'saya melihat kartu tanda penduduk #3622# sebagai warga negara Indonesia dan paspor #3623# dari negara #3625#', 'kewarganegaraan #3622# adalah Indonesia dan kewarganegaraan #3623# adalah #3625#'],
                 ['paspor #3623# diterbitkan oleh negara #3625# dan #3622# memegang kartu tanda penduduk Indonesia', '#3622# orang Indonesia sedangkan #3623# berasal dari negara #3625#',
                  'saya mengenal #3622# sebagai warga Indonesia dan #3623# sebagai warga negara #3625#', 'menurut dokumen yang saya lihat #3622# berkewarganegaraan Indonesia dan #3623# berkewarganegaraan #3625#']),
               varian=['Apakah #3622# warga negara Indonesia dan #3623# warga negara asing, dan dari mana saksi mengetahuinya ?', 'Warga negara mana #3622# dan #3623# ?']))
    P.append(Q('q-agama-calon', 'pp-kewarganegaraan-agama', 60, 'inti', 'pokok', 'Apa agama #3622# dan #3623# ?', 'agama kedua calon mempelai',
               J('kedua calon beragama Islam',
                 ['#3622# dan #3623# sama-sama beragama Islam', 'kedua calon mempelai yaitu #3622# dan #3623# beragama Islam', 'saya tahu #3622# dan #3623# memeluk agama Islam', 'agama #3622# dan #3623# adalah Islam dan keduanya menjalankan ibadah'],
                 ['#3622# maupun #3623# memeluk agama Islam', 'agama yang dianut #3622# dan #3623# adalah Islam', 'keduanya yaitu #3622# dan #3623# adalah orang Islam', 'saya melihat #3622# dan #3623# beribadah sebagai pemeluk Islam']),
               varian=['Apakah #3622# dan #3623# sama-sama beragama Islam ?', 'Agama apa yang dianut oleh #3622# dan #3623# ?']))
    P.append(Q('q-rencana-nikah', 'pp-rencana-nikah', 70, 'inti', 'pokok', 'Apakah saksi mengetahui bahwa #3622# dan #3623# berencana melangsungkan perkawinan di Indonesia ?', 'rencana perkawinan kedua calon di Indonesia',
               JG('keduanya berencana menikah di Indonesia', ['#3622# dan #3623# berencana melangsungkan perkawinan di Indonesia', 'rencana perkawinan #3622# dan #3623# akan dilangsungkan di wilayah Indonesia'],
                  ['kedua calon yaitu #3622# dan #3623# hendak menikah di Indonesia', '#3622# bersama #3623# bermaksud menikah di Indonesia']),
               varian=['Apakah #3622# dan #3623# akan menikah di Indonesia ?']))
    P.append(Q('q-permintaan-surat', 'pp-rencana-nikah', 80, 'inti', 'upaya', 'Apakah saksi mengetahui bahwa #3622# dan #3623# telah meminta surat keterangan bahwa syarat-syarat perkawinan telah dipenuhi kepada #3626# ?', 'permintaan surat keterangan syarat-syarat perkawinan',
               J('kedua calon telah meminta surat keterangan syarat perkawinan kepada pejabat',
                 ['#3622# dan #3623# telah mendatangi #3626# untuk meminta surat keterangan bahwa syarat-syarat perkawinan telah dipenuhi', '#3622# dan #3623# sudah mengajukan permintaan surat keterangan syarat perkawinan kepada #3626#',
                  'saya melihat #3622# dan #3623# mengurus surat keterangan syarat perkawinan di #3626#', 'permintaan surat keterangan syarat perkawinan dari #3622# dan #3623# sudah diajukan ke #3626# dan saya ikut mengantar'],
                 ['permohonan surat keterangan syarat perkawinan #3622# dan #3623# telah disampaikan kepada #3626#', 'kedua calon yaitu #3622# dan #3623# telah mengurus permintaan surat keterangan di #3626#',
                  'saya mengetahui #3622# dan #3623# melapor kepada #3626# tentang rencana menikah dan meminta surat keterangan', 'saya hadir ketika #3622# dan #3623# menyerahkan berkas permintaan surat keterangan kepada #3626#']),
               varian=['Apakah #3622# dan #3623# sudah meminta surat keterangan syarat perkawinan kepada #3626# ?']))
    P.append(Q('q-penolakan-pejabat', 'pp-penolakan-pejabat', 90, 'inti', 'pokok', 'Apakah saksi mengetahui bahwa #3626# menolak memberikan surat keterangan syarat perkawinan bagi #3622# dan #3623# dan apa alasan penolakannya ?', 'penolakan pejabat dan alasannya',
               JG('pejabat menolak memberikan surat keterangan dengan alasan tertentu',
                  ['#3626# menolak memberikan surat keterangan syarat perkawinan bagi #3622# dan #3623# dengan alasan #3627#', 'permintaan surat keterangan #3622# dan #3623# ditolak oleh #3626# dengan alasan #3627#'],
                  ['#3626# menolak menerbitkan surat keterangan bagi #3622# dan #3623# karena #3627#', 'penolakan atas permintaan #3622# dan #3623# dari #3626# didasarkan pada #3627#']),
               varian=['Bagaimana saksi mengetahui penolakan #3626# atas permintaan surat keterangan #3622# dan #3623# dan apa alasannya ?']))
    P.append(Q('q-surat-penolakan', 'pp-penolakan-pejabat', 100, 'pilihan', 'pokok', 'Apakah saksi pernah melihat surat penolakan tertulis dari pejabat itu ?', 'surat penolakan tertulis dari pejabat',
               J('saksi pernah melihat surat penolakan tertulis',
                 ['saya pernah membaca surat penolakan tertanggal #0653# dari #3626# yang dipegang #0046#', 'surat penolakan tertanggal #0653# dari #3626# sudah diserahkan kepada #0046# dan saya melihatnya',
                  'saya melihat langsung surat penolakan #3626# tertanggal #0653# di tangan #0046#', 'benar ada surat penolakan tertanggal #0653# dari #3626# yang saya lihat sendiri'],
                 ['#0046# memperlihatkan kepada saya surat penolakan tertanggal #0653# dari #3626#', 'saya sempat membaca surat penolakan #3626# yang bertanggal #0653#',
                  'surat dari #3626# bertanggal #0653# yang menolak permintaan itu pernah ditunjukkan #0046# kepada saya', 'saya melihat sendiri surat penolakan bertanggal #0653# yang dikeluarkan #3626#'])))

    def lar(huruf, urut, id_, teks, varian, hal, maksud, ok1, ok2, ng1, ng2):
        P.append(Q(id_, 'pp-syarat', urut, 'inti', 'pokok', teks, hal,
                   [JG(maksud[0], ok1, ok2, {'hasil': 'syarat-terpenuhi'}), JG(maksud[1], ng1, ng2, {'hasil': 'syarat-tidak-terpenuhi'})], varian=varian, keadaan={'alasan': huruf}))

    lar('A', 110, 'q-syarat-a', 'Apakah #3623# sudah memiliki surat keterangan dari pejabat yang berwenang di negara asalnya, yaitu #3625#, bahwa syarat-syarat perkawinan menurut hukum negaranya telah dipenuhi ?',
        ['Apakah ada surat keterangan dari instansi negara #3625# tentang status dan kecakapan #3623# untuk menikah ?', 'Apakah perwakilan atau pejabat negara #3625# telah menerangkan bahwa #3623# boleh menikah ?'], 'surat keterangan dari negara asal calon mempelai WNA',
        ('surat keterangan negara asal sudah ada', 'surat keterangan negara asal belum ada'),
        ['#3623# sudah memperoleh surat keterangan dari kedutaan atau instansi berwenang di negara #3625# yang menyatakan ia bebas menikah', 'surat keterangan dari pejabat negara #3625# tentang status dan kecakapan #3623# untuk menikah sudah diterbitkan dan saya melihatnya'],
        ['#3623# telah mengantongi surat keterangan dari instansi negara #3625# yang menerangkan syarat perkawinannya terpenuhi', 'saya pernah melihat surat dari perwakilan negara #3625# yang menerangkan bahwa #3623# boleh menikah'],
        ['#3623# belum memperoleh surat keterangan dari instansi berwenang di negara #3625#', 'surat keterangan dari pejabat negara #3625# tentang status #3623# belum pernah diterbitkan'],
        ['pejabat negara #3625# tidak menerbitkan surat keterangan bahwa #3623# boleh menikah', '#3623# tidak memiliki surat keterangan dari perwakilan negara #3625# yang menerangkan syarat perkawinannya terpenuhi'])
    lar('B', 120, 'q-syarat-b', 'Apakah #3622# atau #3623# masih terikat perkawinan dengan orang lain, di Indonesia maupun di negara asalnya ?',
        ['Bagaimana status perkawinan #3622# dan #3623# sebelum rencana perkawinan ini ?', 'Apakah ada perkawinan lain yang masih mengikat #3622# atau #3623# ?'], 'status perkawinan kedua calon mempelai',
        ('kedua calon tidak sedang terikat perkawinan lain', 'salah seorang calon masih terikat perkawinan lain'),
        ['#3622# dan #3623# tidak sedang terikat perkawinan dengan orang lain', 'perkawinan terdahulu #3622# atau #3623# sudah berakhir dan tidak ada ikatan perkawinan yang tersisa'],
        ['#3622# dan #3623# tidak memiliki istri atau suami lain', '#3622# dan #3623# berstatus bebas dan tidak terikat perkawinan lain'],
        ['salah seorang dari #3622# dan #3623# masih terikat perkawinan yang sah dengan orang lain', 'perkawinan #3622# atau #3623# dengan pasangan terdahulu masih berlangsung sampai sekarang'],
        ['salah seorang calon yaitu #3622# atau #3623# masih berstatus suami atau istri orang lain', 'ikatan perkawinan terdahulu #3622# atau #3623# masih ada dan masih berlaku'])
    lar('C', 130, 'q-syarat-c', 'Berapa umur #3622# dan #3623# dan dari mana saksi mengetahuinya ?', ['Sudah cukupkah umur #3622# dan #3623# untuk menikah menurut yang saksi ketahui ?', 'Berapa umur #3622# dan #3623# saat ini ?'], 'umur kedua calon mempelai',
        ('umur kedua calon sudah mencapai batas umur perkawinan', 'umur salah seorang calon belum mencapai batas umur perkawinan'),
        ['#3622# dan #3623# keduanya sudah berumur lebih dari sembilan belas tahun menurut kartu keluarga dan paspor yang saya lihat', 'umur #3622# dan #3623# sudah melewati sembilan belas tahun sebagaimana tertulis pada dokumen identitas mereka'],
        ['baik #3622# maupun #3623# telah cukup umur untuk menikah karena umurnya sudah di atas sembilan belas tahun', 'pada kartu tanda penduduk dan paspor yang saya lihat #3622# dan #3623# sudah berusia di atas sembilan belas tahun'],
        ['salah seorang di antara #3622# dan #3623# umurnya masih di bawah sembilan belas tahun', 'umur #3622# atau #3623# masih kurang dari sembilan belas tahun menurut dokumen identitasnya'],
        ['#3622# atau #3623# masih di bawah umur perkawinan karena umurnya masih kurang dari sembilan belas tahun', 'salah satu calon yaitu #3622# atau #3623# baru berumur di bawah sembilan belas tahun pada saat mendaftar'])
    lar('D', 140, 'q-syarat-d', 'Apakah ada perbedaan agama antara #3622# dan #3623# ?', ['Apakah agama #3622# dan #3623# sama ?', 'Adakah perbedaan keyakinan antara #3622# dan #3623# ?'], 'perbedaan agama kedua calon mempelai',
        ('tidak ada perbedaan agama', 'ada perbedaan agama'),
        ['tidak ada perbedaan agama antara #3622# dan #3623# karena keduanya beragama Islam', '#3622# dan #3623# tidak berbeda agama sebab sama-sama memeluk Islam'],
        ['agama #3622# sama dengan agama #3623# dan tidak ada perbedaan keyakinan di antara mereka', 'keduanya yaitu #3622# dan #3623# seagama Islam tanpa ada perbedaan'],
        ['agama #3622# berbeda dengan agama #3623# sehingga ada perbedaan keyakinan di antara mereka', 'salah seorang dari #3622# dan #3623# beragama selain Islam sehingga ada perbedaan agama'],
        ['#3622# dan #3623# berbeda agama dan ada perbedaan keyakinan di antara keduanya', 'ada perbedaan agama yang saya ketahui antara #3622# dan #3623#'])
    lar('E', 150, 'q-syarat-e', 'Apakah paspor dan izin tinggal #3623# yang berasal dari negara #3625# sah dan masih berlaku ?', ['Bagaimana keadaan paspor dan izin tinggal #3623# dari negara #3625# ?', 'Apakah dokumen keimigrasian #3623# yang berasal dari negara #3625# masih berlaku ?'], 'paspor dan izin tinggal calon mempelai WNA',
        ('paspor dan izin tinggal sah', 'paspor atau izin tinggal bermasalah'),
        ['paspor #3623# dari negara #3625# masih berlaku dan izin tinggalnya sah', 'saya melihat paspor #3623# dari negara #3625# yang masih berlaku dan izin tinggal yang sah'],
        ['dokumen keimigrasian #3623# dari negara #3625# lengkap dan masih berlaku', 'paspor milik #3623# yang berasal dari negara #3625# serta izin tinggalnya masih sah'],
        ['paspor #3623# dari negara #3625# sudah habis masa berlakunya', 'izin tinggal #3623# yang berasal dari negara #3625# sudah berakhir'],
        ['masa berlaku paspor #3623# dari negara #3625# sudah lewat', 'saya melihat izin tinggal #3623# dari negara #3625# yang sudah kedaluwarsa'])
    lar('F', 160, 'q-syarat-f', 'Apakah ada syarat lain menurut hukum Indonesia atau hukum negara #3625# yang masih harus dipenuhi #3622# dan #3623# ?', ['Adakah syarat perkawinan lain yang belum dipenuhi #3622# dan #3623# menurut hukum negara #3625# ?', 'Apakah menurut yang saksi ketahui #3622# dan #3623# telah memenuhi semua syarat menikah menurut hukum negara #3625# dan hukum Indonesia ?'], 'syarat lain menurut hukum masing-masing',
        ('tidak ada syarat lain yang belum dipenuhi', 'ada syarat lain yang belum dipenuhi'),
        ['tidak ada syarat lain menurut hukum Indonesia maupun hukum negara #3625# yang harus dipenuhi #3622# dan #3623#', '#3622# dan #3623# telah memenuhi semua syarat menurut hukum negara #3625# dan hukum Indonesia sehingga tidak ada kekurangan'],
        ['menurut yang saya ketahui tidak ada kewajiban lain dari hukum negara #3625# maupun hukum Indonesia bagi #3622# dan #3623#', 'syarat menikah menurut hukum negara #3625# dan hukum Indonesia sudah dijalankan #3622# dan #3623# tanpa ada yang tertinggal'],
        ['masih ada syarat lain menurut hukum negara #3625# yang belum dipenuhi #3622# dan #3623#', 'syarat tambahan menurut hukum Indonesia atau hukum negara #3625# belum dipenuhi #3622# dan #3623#'],
        ['syarat menikah menurut hukum negara #3625# belum seluruhnya dijalankan #3622# dan #3623#', 'ada kekurangan syarat menurut hukum negara #3625# yang belum dilengkapi #3622# dan #3623#'])

    P.append(Q('q-kehendak-sendiri', 'pp-syarat-umum', 200, 'inti', 'pokok', 'Apakah rencana perkawinan itu datang dari kehendak #3622# dan #3623# sendiri tanpa paksaan dari pihak mana pun ?', 'kehendak kedua calon untuk menikah tanpa paksaan',
               JG('perkawinan dikehendaki kedua calon tanpa paksaan', ['perkawinan itu dikehendaki oleh #3622# dan #3623# sendiri tanpa paksaan dari siapa pun', '#3622# dan #3623# menikah atas kemauan masing-masing tanpa ada tekanan dari pihak lain'],
                  ['tidak ada paksaan terhadap #3622# maupun #3623# dalam rencana perkawinan itu', '#3622# dan #3623# sama-sama setuju menikah dan tidak dipaksa oleh siapa pun']),
               varian=['Apakah #3622# dan #3623# sama-sama mau menikah dan tidak dipaksa ?']))
    P.append(Q('q-halangan-lain', 'pp-syarat-umum', 210, 'inti', 'pokok', 'Apakah saksi mengetahui adanya halangan lain bagi #3622# dan #3623# untuk menikah menurut hukum Islam dan peraturan perundang-undangan ?', 'halangan lain untuk menikah',
               JG('tidak ada halangan lain untuk menikah', ['tidak ada halangan lain bagi #3622# dan #3623# untuk menikah menurut agama maupun peraturan', 'bagi #3622# dan #3623# tidak ada rintangan lain untuk melangsungkan perkawinan'],
                  ['saya tidak menemukan halangan apa pun yang menghalangi #3622# dan #3623# menikah', 'selain yang disebut alasan penolakan tidak ada halangan lain antara #3622# dan #3623#']),
               varian=['Adakah halangan lain yang saksi ketahui untuk perkawinan #3622# dan #3623# ?']))
    P.append(Q('q-keberatan-keluarga', 'pp-syarat-umum', 220, 'pilihan', 'upaya', 'Apakah ada keluarga atau pihak lain yang keberatan atas rencana perkawinan #3622# dan #3623# ?', 'keberatan keluarga atas rencana perkawinan',
               JG('tidak ada pihak yang keberatan', ['tidak ada keluarga maupun pihak lain yang keberatan atas rencana perkawinan #3622# dan #3623#', 'keluarga kedua belah pihak tidak keberatan #3622# dan #3623# menikah'],
                  ['rencana perkawinan #3622# dan #3623# tidak mendapat keberatan dari siapa pun', 'saya tidak pernah melihat ada yang menentang perkawinan #3622# dan #3623#']),
               varian=['Adakah yang menentang rencana perkawinan #3622# dan #3623# ?']))
    P.append(Q('q-upaya-lengkapi', 'pp-upaya-akibat', 230, 'pilihan', 'upaya', 'Apa yang dilakukan #0046# setelah #3626# menolak memberikan surat keterangan sebelum mengajukan permohonan ke Pengadilan ?', 'upaya Pemohon sesudah penolakan',
               J('Pemohon meminta surat penolakan lalu mengajukan permohonan ke Pengadilan',
                 ['setelah ditolak #0046# meminta surat penolakan tertulis dari #3626# lalu mengajukan permohonan ke Pengadilan', '#0046# menanyakan alasan penolakan kepada #3626# dan meminta surat penolakan tertulis sebelum ke Pengadilan',
                  'saya melihat #0046# mengurus surat penolakan di #3626# lalu mendaftarkan permohonan ke Pengadilan', 'sesudah penolakan itu #0046# datang lagi ke #3626# meminta surat tertulis dan mengajukan perkaranya ke Pengadilan'],
                 ['#0046# meminta penjelasan dan surat penolakan tertulis dari #3626# sebelum membawa perkaranya ke Pengadilan', 'saya mengantar #0046# ke #3626# untuk mengambil surat penolakan lalu mendaftarkan permohonan ke Pengadilan',
                  'atas penolakan #3626# #0046# mengurus surat penolakan dan melanjutkan ke Pengadilan', 'setelah ditolak #0046# mendapatkan surat penolakan dari #3626# dan memohon penetapan kepada Pengadilan']),
               varian=['Langkah apa yang ditempuh #0046# sesudah #3626# menolak memberikan surat keterangan ?']))
    P.append(Q('q-rencana-waktu', 'pp-upaya-akibat', 240, 'pilihan', 'akibat', 'Kapan #3622# dan #3623# berencana melangsungkan perkawinan setelah memperoleh surat keterangan itu ?', 'rencana waktu perkawinan setelah surat keterangan diberikan',
               JG('keduanya berencana segera menikah setelah surat keterangan diberikan', ['#3622# dan #3623# berencana segera menikah setelah surat keterangan diberikan dan masih dalam masa enam bulan', 'rencana #3622# dan #3623# adalah menikah dalam waktu dekat sesudah surat keterangan diterima'],
                  ['#3622# bersama #3623# bermaksud menikah secepatnya setelah memperoleh surat keterangan itu', 'keinginan #3622# dan #3623# adalah menikah secepat-cepatnya begitu surat keterangan terbit']),
               varian=['Kapan rencana #3622# dan #3623# menikah apabila surat keterangan telah diberikan ?']))
    P.append(_q_dari('wali-adhal', 'q-penutup', urutan=900, variabelAbt=[]))

    bas = []
    for p in sorted(glob.glob(L.lp(os.path.join(L.OUT, j['folder_bas'])) + '/*.rtf')):
        raw = open(p, 'rb').read().decode('latin1')
        if '#5058#' in raw and '#5059#' in raw:
            bas.append(dict(folder=j['folder_bas'], berkas=os.path.basename(p)[:-4], variabelSaksi=['5058', '5059'], catatan=''))
    assert bas, 'jalankan bangun() lebih dulu'
    return {
        'skema': 'saksi-katalog/1', 'kunci': 'perkawinan-campuran', 'judul': 'Perkawinan campuran', 'versi': 1, 'penulis': 'W3A-A', 'tahap': 2, 'contoh': False,
        'syarat': {'jenisPerkaraId': [str(j['sipp'])]}, 'pihak': {'pengaju': '#0046#', 'lawan': '#0047#'}, 'blangkoBas': bas,
        'dasarHukum': dasar, 'keadaan': keadaan, 'pokokPembuktian': pokok, 'pertanyaan': P, 'jawabanUmum': S.jawaban_umum_baku(),
        'catatanPetugas': [
            'Isi nama calon mempelai WNI dan WNA, negara asal, pejabat yang menolak dan alasan penolakan menurut surat pejabat pada isian blangko sebelum menyusun; isian kosong tampil sebagai titik-titik.',
            'Pilih satu huruf syarat sesuai alasan penolakan pada surat pejabat; pertanyaan syarat hanya diajukan sesuai huruf itu. Pilih juga apakah keterangan saksi menyatakan syarat itu sudah terpenuhi atau belum.',
            'Pengadilan Agama berwenang hanya bila para pihak beragama Islam; pastikan agama kedua calon mempelai terbukti lewat keterangan saksi dan bukti surat.',
            'Keputusan diberikan dengan tidak beracara dan tidak dapat dimintakan banding; bukti penting adalah paspor, surat keterangan dari negara asal calon WNA, kartu tanda penduduk, kartu keluarga dan surat penolakan pejabat.',
        ],
        'tanpaLawan': True, 'variabelBaru': BARU,
    }
