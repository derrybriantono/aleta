# -*- coding: utf-8 -*-
"""Katalog saksi PENOLAKAN PERKAWINAN (343) - agen W3a-A. Dibangkitkan oleh jenis_penolakan_perkawinan.py (bangun_katalog)."""
import glob
import json
import os
import re

import w3a_lib as L
import w3aA_susun as S
from w3aA_susun import J, JG, Q

REPO = S.REPO
FOLDER_KAT = os.path.join(REPO, 'ekstensi-sipp', 'saksi-katalog')
BARU = ['3602', '3603', '3604', '3605']


def _muat(nama):
    return json.load(open(os.path.join(FOLDER_KAT, nama + '.json'), encoding='utf-8'))


def _dh(sumber_kat, ids):
    hasil = []
    for k in _muat(sumber_kat)['dasarHukum']:
        if k['id'] in ids:
            hasil.append(k)
    assert len(hasil) == len(ids), (sumber_kat, ids)
    return hasil


def _q_dari(sumber_kat, id_, **ubah):
    q = [x for x in _muat(sumber_kat)['pertanyaan'] if x['id'] == id_][0]
    q = json.loads(json.dumps(q))
    q.update(ubah)
    return q


def katalog(j):
    dasar = _dh('pencegahan-perkawinan', ['dh-sebab-pengetahuan', 'dh-beban-bukti', 'dh-pc-a', 'dh-pc-b', 'dh-pc-c', 'dh-pc-d', 'dh-pc-e', 'dh-pc-f', 'dh-pc-g'])
    dasar += _dh('wali-adhal', ['dh-rbg-saksi-formil', 'dh-rbg-saksi-materiil'])
    dasar += [
        dict(id='dh-pasal-49a-5', rujukan='Pasal 49 huruf a beserta penjelasannya angka 5 UU 7/1989 jo UU 3/2006 jo UU 50/2009; Pasal 63 ayat (1) huruf a UU 1/1974',
             uraian='penolakan perkawinan oleh Pegawai Pencatat Nikah bagi orang beragama Islam menjadi kewenangan absolut Pengadilan Agama',
             status='terverifikasi', sumber='Penjelasan Pasal 49 huruf a angka 5 pada naskah UU 3/2006 (referensi/_unduhan/ekstra/uu3-2006.txt) dan Pasal 63 ayat (1) huruf a pada naskah BPK UU 1/1974'),
        dict(id='dh-uup-20-21', rujukan='Pasal 20 dan Pasal 21 ayat (1) sampai ayat (5) UU 1/1974',
             uraian='Pegawai Pencatat tidak boleh melangsungkan perkawinan yang melanggar larangan; penolakan disertai keterangan tertulis beserta alasan; para pihak dapat memohon ke pengadilan di wilayah Pegawai Pencatat yang menolak; pengadilan memeriksa dengan acara singkat dan menguatkan penolakan atau memerintahkan perkawinan dilangsungkan; ketetapan hilang kekuatannya bila rintangan hilang',
             status='terverifikasi', sumber='naskah BPK UU 1/1974 (referensi/_unduhan/uu1-1974/uu1-1974-bpk.txt) Pasal 20 dan Pasal 21'),
        dict(id='dh-pp-3-7', rujukan='Pasal 3 sampai Pasal 7 PP 9/1975',
             uraian='pemberitahuan kehendak kawin kepada Pegawai Pencatat; penelitian syarat dan halangan perkawinan; halangan atau kekurangan persyaratan diberitahukan kepada calon mempelai',
             status='terverifikasi', sumber='naskah BPK PP 9/1975 (referensi/_unduhan/pp9-1975/pp9-1975-bpk.txt) Pasal 3 sampai Pasal 7'),
        dict(id='dh-uup-6-khi-16', rujukan='Pasal 6 ayat (1) UU 1/1974 jo Pasal 16 ayat (1) KHI',
             uraian='perkawinan didasarkan atas persetujuan kedua calon mempelai',
             status='terverifikasi', sumber='naskah BPK UU 1/1974 Pasal 6 ayat (1); KHI-pasal-terverifikasi.md Pasal 16'),
        dict(id='dh-ph-h', rujukan='Pasal 12 UU 1/1974 jo Pasal 6 ayat (1) dan (2) serta Pasal 7 ayat (2) PP 9/1975',
             uraian='Pegawai Pencatat meneliti syarat administrasi perkawinan dan memberitahukan kekurangannya kepada calon mempelai',
             status='terverifikasi', sumber='naskah BPK UU 1/1974 Pasal 12 dan PP 9/1975 Pasal 6 dan Pasal 7'),
    ]
    huruf_dh = {'A': 'dh-pc-a', 'B': 'dh-pc-b', 'C': 'dh-pc-c', 'D': 'dh-pc-d', 'E': 'dh-pc-e', 'F': 'dh-pc-f', 'G': 'dh-pc-g', 'H': 'dh-ph-h'}

    keadaan = {
        'alasan': dict(sumber='borang', nilai=list('ABCDEFGH'), bawaan='B', label='Larangan yang dijadikan alasan penolakan (huruf A sampai H)',
                       labelNilai={'A': 'A masih terikat perkawinan', 'B': 'B belum cukup umur', 'C': 'C hubungan darah, semenda atau susuan', 'D': 'D masih masa tunggu (iddah)',
                                   'E': 'E beda agama', 'F': 'F cerai dua kali, talak tiga atau li\'an', 'G': 'G tanpa persetujuan atau izin orang tua', 'H': 'H syarat administrasi belum lengkap'}),
        'hasil': dict(sumber='borang', nilai=['tidak-ada-larangan', 'ada-larangan'], bawaan='tidak-ada-larangan',
                      label='Keterangan saksi tentang larangan yang dijadikan alasan penolakan',
                      labelNilai={'tidak-ada-larangan': 'larangan itu tidak ada pada kedua calon', 'ada-larangan': 'larangan itu ada'}),
    }
    pokok = [
        dict(id='pp-saksi-formil', judul='Syarat formil saksi', uraian='saksi mengenal Pemohon, menyebut hubungannya, dan tidak berkepentingan', dasarHukum=['dh-rbg-saksi-formil', 'dh-sebab-pengetahuan'], wajib=True),
        dict(id='pp-calon-mempelai', judul='Kedua calon mempelai', uraian='identitas dan hubungan calon suami dan calon istri yang perkawinannya ditolak', dasarHukum=['dh-uup-20-21'], wajib=True),
        dict(id='pp-agama-kewenangan', judul='Agama kedua calon mempelai', uraian='kedua calon beragama Islam sehingga perkara menjadi kewenangan Pengadilan Agama', dasarHukum=['dh-pasal-49a-5'], wajib=True),
        dict(id='pp-rencana-nikah', judul='Rencana perkawinan dan pemberitahuan di KUA', uraian='kedua calon berencana menikah di wilayah Kantor Urusan Agama tertentu dan telah memberitahukan kehendaknya', dasarHukum=['dh-pp-3-7'], wajib=True),
        dict(id='pp-penolakan-ppn', judul='Penolakan Pegawai Pencatat Nikah', uraian='Pegawai Pencatat Nikah menolak melangsungkan perkawinan dan memberi alasan tertulis', dasarHukum=['dh-uup-20-21'], wajib=True),
        dict(id='pp-larangan', judul='Ada atau tidak adanya larangan perkawinan yang menjadi alasan penolakan', uraian='fakta tentang larangan yang dijadikan alasan penolakan (umur, status, hubungan, masa tunggu, agama, talak tiga, izin, berkas)', dasarHukum=sorted(huruf_dh.values()), wajib=True),
        dict(id='pp-syarat-umum', judul='Persetujuan calon mempelai dan halangan lain', uraian='perkawinan dikehendaki kedua calon tanpa paksaan dan tidak ada halangan lain', dasarHukum=['dh-uup-6-khi-16'], wajib=True),
        dict(id='pp-upaya-akibat', judul='Upaya Pemohon dan keadaan rintangan', uraian='upaya Pemohon sebelum ke pengadilan dan apakah rintangan masih ada (ketetapan hilang kekuatannya bila rintangan hilang)', dasarHukum=['dh-uup-20-21'], wajib=False),
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
               'Apakah saksi kenal dengan calon suami yang bernama #3602# dan calon istri yang bernama #3603# ?', 'kedua calon mempelai yang hendak menikah',
               J('saksi mengenal calon suami dan calon istri',
                 ['saya kenal baik dengan #3602# dan #3603# yang hendak menikah', 'saya mengenal #3602# sebagai calon suami dan #3603# sebagai calon istri', 'sejak lama saya mengenal #3602# serta #3603# yang berencana menikah', 'benar saya kenal dengan #3602# dan juga dengan #3603# calon pasangannya'],
                 ['#3602# dan #3603# adalah dua orang yang saya kenal dan keduanya akan menikah', 'calon suami #3602# dan calon istri #3603# sama-sama saya kenal dari dulu', 'saya sudah mengenal #3602# maupun #3603# sebelum mereka berencana menikah', 'dua orang itu, yaitu #3602# dan #3603#, memang saya kenal dengan baik']),
               varian=['Apakah saksi mengenal #3602# selaku calon suami dan #3603# selaku calon istri ?', 'Kenalkah saksi dengan #3602# dan #3603# yang hendak menikah ?']))
    P.append(Q('q-hubungan-calon', 'pp-calon-mempelai', 40, 'inti', 'pokok',
               'Apa hubungan antara #3602# dan #3603# dan sejak kapan keduanya berencana menikah ?', 'hubungan dan rencana menikah kedua calon mempelai',
               JG('keduanya berencana menikah', ['#3602# dan #3603# telah menjalin hubungan dan sepakat untuk menikah', '#3602# dan #3603# adalah sepasang calon mempelai yang berencana menikah'],
                  ['kedua calon, yaitu #3602# dan #3603#, sudah sepakat membangun rumah tangga', '#3602# bersama #3603# berniat menikah dan saling menyetujui rencana tersebut']),
               varian=['Bagaimana hubungan #3602# dengan #3603# sampai keduanya berencana menikah ?']))
    P.append(Q('q-agama-calon', 'pp-agama-kewenangan', 50, 'inti', 'pokok', 'Apa agama #3602# dan #3603# ?', 'agama kedua calon mempelai',
               J('kedua calon beragama Islam',
                 ['#3602# dan #3603# sama-sama beragama Islam', 'kedua calon mempelai, yaitu #3602# dan #3603#, beragama Islam', 'saya tahu #3602# dan #3603# memeluk agama Islam', 'agama #3602# dan #3603# adalah Islam dan keduanya menjalankan ibadah'],
                 ['#3602# maupun #3603# memeluk agama Islam', 'agama yang dianut #3602# dan #3603# adalah Islam', 'keduanya yaitu #3602# dan #3603# adalah orang Islam', 'saya melihat #3602# dan #3603# beribadah sebagai pemeluk Islam']),
               varian=['Apakah #3602# dan #3603# sama-sama beragama Islam ?', 'Agama apa yang dianut oleh #3602# dan #3603# ?']))
    P.append(Q('q-rencana-nikah', 'pp-rencana-nikah', 60, 'inti', 'pokok',
               'Apakah saksi mengetahui bahwa #3602# dan #3603# berencana melangsungkan perkawinan di Kantor Urusan Agama #3604# ?', 'rencana perkawinan kedua calon di Kantor Urusan Agama',
               JG('keduanya berencana menikah di Kantor Urusan Agama setempat',
                  ['#3602# dan #3603# berencana melangsungkan perkawinan di Kantor Urusan Agama #3604#', 'rencana perkawinan #3602# dan #3603# akan dilangsungkan di hadapan Pegawai Pencatat Nikah Kantor Urusan Agama #3604#'],
                  ['kedua calon, yaitu #3602# dan #3603#, hendak menikah di Kantor Urusan Agama #3604#', '#3602# bersama #3603# bermaksud menikah di Kantor Urusan Agama #3604#']),
               varian=['Di Kantor Urusan Agama #3604#, apakah #3602# dan #3603# berencana melangsungkan perkawinan ?', 'Apakah #3602# dan #3603# akan menikah di Kantor Urusan Agama #3604# ?']))
    P.append(Q('q-pemberitahuan', 'pp-rencana-nikah', 70, 'inti', 'upaya',
               'Apakah saksi mengetahui bahwa #3602# dan #3603# sudah memberitahukan kehendak menikah kepada Pegawai Pencatat Nikah Kantor Urusan Agama #3604# ?', 'pemberitahuan kehendak menikah kepada Pegawai Pencatat Nikah',
               J('kedua calon telah memberitahukan kehendak menikah kepada Pegawai Pencatat Nikah',
                 ['#3602# dan #3603# telah mendatangi Kantor Urusan Agama #3604# untuk memberitahukan kehendak menikah', '#3602# dan #3603# sudah menyampaikan kehendak menikah kepada Pegawai Pencatat Nikah Kantor Urusan Agama #3604#',
                  'saya melihat #3602# dan #3603# mengurus pendaftaran nikah di Kantor Urusan Agama #3604#', 'pemberitahuan kehendak menikah dari #3602# dan #3603# sudah diajukan ke Kantor Urusan Agama #3604# dan saya ikut mengantar'],
                 ['pemberitahuan nikah #3602# dan #3603# telah disampaikan ke Kantor Urusan Agama #3604#', 'kedua calon, yaitu #3602# dan #3603#, telah mengurus pendaftaran nikah di Kantor Urusan Agama #3604#',
                  'saya mengetahui #3602# dan #3603# melapor kepada petugas Kantor Urusan Agama #3604# tentang rencana menikah', 'saya hadir ketika #3602# dan #3603# menyerahkan berkas pendaftaran nikah ke Kantor Urusan Agama #3604#']),
               varian=['Apakah #3602# dan #3603# telah mendaftarkan rencana nikahnya ke Kantor Urusan Agama #3604# ?']))
    P.append(Q('q-penolakan-ppn', 'pp-penolakan-ppn', 80, 'inti', 'pokok',
               'Apakah saksi mengetahui bahwa Pegawai Pencatat Nikah Kantor Urusan Agama #3604# menolak melangsungkan perkawinan #3602# dan #3603# dan apa alasan penolakannya ?', 'penolakan Pegawai Pencatat Nikah dan alasannya',
               JG('Pegawai Pencatat Nikah menolak melangsungkan perkawinan dengan alasan tertentu',
                  ['Pegawai Pencatat Nikah Kantor Urusan Agama #3604# menolak melangsungkan perkawinan #3602# dan #3603# dengan alasan #3605#', 'perkawinan #3602# dan #3603# ditolak oleh Pegawai Pencatat Nikah Kantor Urusan Agama #3604# dengan alasan #3605#'],
                  ['Kantor Urusan Agama #3604# menolak menikahkan #3602# dan #3603# karena #3605#', 'penolakan atas perkawinan #3602# dan #3603# dari Kantor Urusan Agama #3604# didasarkan pada #3605#']),
               varian=['Bagaimana saksi mengetahui penolakan Pegawai Pencatat Nikah Kantor Urusan Agama #3604# atas perkawinan #3602# dan #3603# dan apa alasannya ?']))
    P.append(Q('q-surat-penolakan', 'pp-penolakan-ppn', 90, 'pilihan', 'pokok', 'Apakah saksi pernah melihat surat penolakan tertulis dari Pegawai Pencatat Nikah itu ?', 'surat penolakan tertulis dari Pegawai Pencatat Nikah',
               J('saksi pernah melihat surat penolakan tertulis',
                 ['saya pernah membaca surat penolakan tertanggal #0653# dari Kantor Urusan Agama #3604# yang dipegang #0046#', 'surat penolakan tertanggal #0653# dari Kantor Urusan Agama #3604# sudah diserahkan kepada #0046# dan saya melihatnya',
                  'saya melihat langsung surat penolakan Kantor Urusan Agama #3604# tertanggal #0653# di tangan #0046#', 'benar ada surat penolakan tertanggal #0653# dari Kantor Urusan Agama #3604# yang saya lihat sendiri'],
                 ['#0046# memperlihatkan kepada saya surat penolakan tertanggal #0653# dari Kantor Urusan Agama #3604#', 'saya sempat membaca surat penolakan Kantor Urusan Agama #3604# yang bertanggal #0653#',
                  'surat dari Kantor Urusan Agama #3604# bertanggal #0653# yang menolak perkawinan itu pernah ditunjukkan #0046# kepada saya', 'saya melihat sendiri surat penolakan bertanggal #0653# yang dikeluarkan Kantor Urusan Agama #3604#'])))

    # ---- larangan A-H: dua keadaan (larangan tidak ada = pembuktian dikabulkan; larangan ada = pembuktian ditolak)
    def lar(huruf, urut, id_, teks, varian, hal, maksud, ok1, ok2, ada1, ada2):
        P.append(Q(id_, 'pp-larangan', urut, 'inti', 'pokok', teks, hal,
                   [JG(maksud[0], ok1, ok2, {'hasil': 'tidak-ada-larangan'}), JG(maksud[1], ada1, ada2, {'hasil': 'ada-larangan'})],
                   varian=varian, keadaan={'alasan': huruf}))

    lar('A', 110, 'q-alasan-a', 'Apakah #3602# atau #3603# masih terikat perkawinan dengan orang lain ?',
        ['Bagaimana status perkawinan #3602# dan #3603# sebelum rencana perkawinan ini, apakah masih terikat perkawinan dengan orang lain ?', 'Apakah ada perkawinan lain yang masih mengikat #3602# atau #3603# ?'], 'status perkawinan kedua calon mempelai',
        ('kedua calon tidak sedang terikat perkawinan lain', 'salah seorang calon masih terikat perkawinan lain'),
        ['#3602# dan #3603# tidak sedang terikat perkawinan dengan orang lain', 'perkawinan terdahulu #3602# atau #3603# sudah berakhir dan tidak ada ikatan perkawinan yang tersisa'],
        ['#3602# dan #3603# tidak memiliki istri atau suami lain', '#3602# berstatus jejaka atau duda dan #3603# berstatus perawan atau janda sehingga tidak terikat perkawinan lain'],
        ['salah seorang dari #3602# dan #3603# masih terikat perkawinan yang sah dengan orang lain', 'perkawinan #3602# atau #3603# dengan pasangan terdahulu masih berlangsung sampai sekarang'],
        ['salah seorang calon, yaitu #3602# atau #3603#, masih berstatus suami atau istri orang lain', 'ikatan perkawinan terdahulu #3602# atau #3603# masih ada dan masih berlaku'])
    lar('B', 120, 'q-alasan-b', 'Berapa umur #3602# dan #3603# dan dari mana saksi mengetahuinya ?', ['Sudah cukupkah umur #3602# dan #3603# untuk menikah menurut yang saksi ketahui ?', 'Berapa umur #3602# dan #3603# saat ini ?'], 'umur kedua calon mempelai',
        ('umur kedua calon sudah mencapai batas umur perkawinan', 'umur salah seorang calon belum mencapai batas umur perkawinan'),
        ['#3602# dan #3603# keduanya sudah berumur lebih dari sembilan belas tahun menurut kartu keluarga yang saya lihat', 'umur #3602# dan #3603# sudah melewati sembilan belas tahun sebagaimana tertulis pada akta kelahiran mereka'],
        ['baik #3602# maupun #3603# telah cukup umur untuk menikah karena umurnya sudah di atas sembilan belas tahun', 'pada kartu tanda penduduk yang saya lihat #3602# dan #3603# sudah berusia di atas sembilan belas tahun'],
        ['salah seorang di antara #3602# dan #3603# umurnya masih di bawah sembilan belas tahun', 'umur #3602# atau #3603# masih kurang dari sembilan belas tahun menurut akta kelahirannya'],
        ['#3602# atau #3603# masih di bawah umur perkawinan karena umurnya masih kurang dari sembilan belas tahun', 'salah satu calon, yaitu #3602# atau #3603#, baru berumur di bawah sembilan belas tahun pada saat mendaftar'])
    lar('C', 130, 'q-alasan-c', 'Apakah antara #3602# dan #3603# ada hubungan darah, semenda atau sesusuan yang dilarang untuk menikah ?', ['Apakah #3602# dan #3603# bersaudara, ada hubungan semenda atau sesusuan ?', 'Adakah pertalian nasab, semenda atau susuan antara #3602# dan #3603# ?'], 'hubungan darah, semenda atau sesusuan kedua calon mempelai',
        ('tidak ada hubungan terlarang antara kedua calon', 'ada hubungan terlarang antara kedua calon'),
        ['antara #3602# dan #3603# tidak ada hubungan darah, hubungan semenda maupun hubungan sesusuan', '#3602# dan #3603# tidak mempunyai pertalian nasab, semenda atau susuan yang dilarang menikah'],
        ['keluarga #3602# dan keluarga #3603# berasal dari keluarga yang berbeda dan tidak ada kaitan darah, semenda atau susuan antara keduanya', 'saya kenal keluarga keduanya dan tidak ada pertalian darah atau susuan antara #3602# dan #3603#'],
        ['antara #3602# dan #3603# terdapat hubungan darah, semenda atau sesusuan yang dilarang untuk menikah', '#3602# dan #3603# mempunyai pertalian nasab, semenda atau susuan yang menjadi larangan perkawinan'],
        ['keluarga #3602# dan keluarga #3603# berkaitan darah, semenda atau susuan sehingga keduanya dilarang menikah', 'saya kenal keluarga keduanya dan ada pertalian darah atau susuan antara #3602# dan #3603#'])
    lar('D', 140, 'q-alasan-d', 'Apakah #3603# masih dalam masa tunggu (iddah) dari perkawinan sebelumnya ?', ['Apakah masa iddah #3603# sudah selesai ketika mendaftar nikah ?', 'Bagaimana keadaan masa tunggu #3603# dari perkawinan terdahulunya ?'], 'masa tunggu (iddah) calon istri',
        ('calon istri tidak dalam masa iddah', 'calon istri masih dalam masa iddah'),
        ['#3603# tidak lagi menjalani masa iddah ketika mendaftar nikah', 'masa tunggu #3603# sudah lewat dan tidak berlaku lagi'],
        ['saat mendaftar nikah #3603# tidak sedang dalam masa iddah', 'masa iddah #3603# telah selesai sehingga tidak ada halangan masa tunggu'],
        ['#3603# masih menjalani masa iddah dari perkawinan sebelumnya', 'masa tunggu #3603# masih berjalan ketika mendaftar nikah'],
        ['#3603# sedang berada dalam masa iddah', 'perkawinan terdahulu #3603# baru berakhir dan masa iddahnya masih berjalan'])
    lar('E', 150, 'q-alasan-e', 'Apakah ada perbedaan agama antara #3602# dan #3603# ?', ['Apakah agama #3602# dan #3603# sama ?', 'Adakah perbedaan keyakinan antara #3602# dan #3603# ?'], 'perbedaan agama kedua calon mempelai',
        ('tidak ada perbedaan agama', 'ada perbedaan agama'),
        ['tidak ada perbedaan agama antara #3602# dan #3603# karena keduanya beragama Islam', '#3602# dan #3603# tidak berbeda agama sebab sama-sama memeluk Islam'],
        ['agama #3602# sama dengan agama #3603# dan tidak ada perbedaan keyakinan di antara mereka', 'keduanya yaitu #3602# dan #3603# seagama Islam tanpa ada perbedaan'],
        ['agama #3602# berbeda dengan agama #3603# sehingga ada perbedaan keyakinan di antara mereka', 'salah seorang dari #3602# dan #3603# beragama selain Islam sehingga ada perbedaan agama'],
        ['#3602# dan #3603# berbeda agama dan ada perbedaan keyakinan di antara keduanya', 'ada perbedaan agama yang saya ketahui antara #3602# dan #3603#'])
    lar('F', 160, 'q-alasan-f', 'Apakah #3602# dan #3603# pernah menikah dan bercerai satu sama lain termasuk talak tiga atau li\'an ?', ['Apakah #3603# adalah bekas istri #3602# yang pernah ditalak tiga kali atau dili\'an ?', 'Adakah riwayat talak tiga atau li\'an antara #3602# dan #3603# ?'], 'riwayat talak tiga atau li\'an antara kedua calon',
        ('tidak ada riwayat talak tiga atau li\'an', 'ada riwayat talak tiga atau li\'an'),
        ['#3602# dan #3603# tidak pernah menikah satu sama lain sebelumnya', '#3603# tidak pernah ditalak tiga atau dili\'an oleh #3602#'],
        ['#3602# dan #3603# baru pertama kali berencana menikah dan tidak punya riwayat cerai satu sama lain', 'tidak ada riwayat talak tiga maupun li\'an antara #3602# dan #3603#'],
        ['#3603# adalah bekas istri #3602# yang pernah ditalak tiga kali', '#3602# pernah menalak tiga #3603# ketika keduanya masih menjadi suami istri'],
        ['#3602# dan #3603# sudah dua kali menikah dan dua kali bercerai satu sama lain', 'riwayat talak tiga antara #3602# dan #3603# memang ada dan saya mengetahuinya'])
    lar('G', 170, 'q-alasan-g', 'Apakah #3602# dan #3603# menyetujui perkawinan itu, dan bagi yang belum berumur dua puluh satu tahun apakah sudah ada izin kedua orang tuanya ?', ['Apakah orang tua #3602# dan #3603# telah mengizinkan perkawinan itu ?', 'Bagaimana persetujuan #3602# dan #3603# serta izin orang tua mereka ?'], 'persetujuan kedua calon dan izin orang tua',
        ('persetujuan dan izin orang tua ada', 'izin orang tua tidak ada'),
        ['#3602# dan #3603# sama-sama menyetujui perkawinan itu dan orang tua keduanya telah memberi izin', 'persetujuan dari #3602# dan #3603# ada dan izin kedua orang tua mereka sudah diberikan'],
        ['kedua orang tua #3602# dan #3603# merestui dan mengizinkan perkawinan itu', 'orang tua dari #3602# dan #3603# telah menyatakan izin dan keduanya sendiri setuju'],
        ['izin orang tua #3602# atau #3603# tidak diberikan untuk perkawinan itu', 'salah seorang dari #3602# dan #3603# tidak memperoleh izin orang tua'],
        ['orang tua dari #3602# atau #3603# tidak bersedia memberi izin', 'perkawinan #3602# dan #3603# tidak disertai izin dari salah satu orang tua'])
    lar('H', 180, 'q-alasan-h', 'Apakah ada berkas persyaratan nikah #3602# dan #3603# yang belum dipenuhi di Kantor Urusan Agama ?', ['Apakah #3602# dan #3603# sudah melengkapi persyaratan administrasi nikah ?', 'Bagaimana kelengkapan berkas nikah #3602# dan #3603# ?'], 'kelengkapan berkas persyaratan nikah',
        ('berkas lengkap', 'berkas belum lengkap'),
        ['berkas persyaratan nikah #3602# dan #3603# telah dilengkapi mulai dari akta kelahiran hingga surat pengantar desa', 'semua persyaratan administrasi #3602# dan #3603# sudah dipenuhi di Kantor Urusan Agama'],
        ['#3602# dan #3603# sudah melengkapi seluruh dokumen yang diminta petugas Kantor Urusan Agama', 'dokumen nikah milik #3602# dan #3603# lengkap sebagaimana yang disyaratkan'],
        ['masih ada dokumen persyaratan nikah #3602# atau #3603# yang belum dipenuhi', 'berkas #3602# dan #3603# belum lengkap'],
        ['dokumen nikah #3602# dan #3603# tidak lengkap', 'petugas menyatakan berkas #3602# dan #3603# tidak memenuhi persyaratan'])

    P.append(Q('q-kehendak-sendiri', 'pp-syarat-umum', 200, 'inti', 'pokok', 'Apakah rencana perkawinan itu datang dari kehendak #3602# dan #3603# sendiri tanpa paksaan dari pihak mana pun ?', 'kehendak kedua calon untuk menikah tanpa paksaan',
               JG('perkawinan dikehendaki kedua calon tanpa paksaan', ['perkawinan itu dikehendaki oleh #3602# dan #3603# sendiri tanpa paksaan dari siapa pun', '#3602# dan #3603# menikah atas kemauan masing-masing tanpa ada tekanan dari pihak lain'],
                  ['tidak ada paksaan terhadap #3602# maupun #3603# dalam rencana perkawinan itu', '#3602# dan #3603# sama-sama setuju menikah dan tidak dipaksa oleh siapa pun']),
               varian=['Apakah #3602# dan #3603# sama-sama mau menikah dan tidak dipaksa ?']))
    P.append(Q('q-halangan-lain', 'pp-syarat-umum', 210, 'inti', 'pokok', 'Apakah saksi mengetahui adanya halangan lain bagi #3602# dan #3603# untuk menikah menurut hukum Islam dan peraturan perundang-undangan ?', 'halangan lain untuk menikah',
               JG('tidak ada halangan lain untuk menikah', ['tidak ada halangan lain bagi #3602# dan #3603# untuk menikah menurut agama maupun peraturan', 'bagi #3602# dan #3603# tidak ada rintangan lain untuk melangsungkan perkawinan'],
                  ['saya tidak menemukan halangan apa pun yang menghalangi #3602# dan #3603# menikah', 'selain yang disebut alasan penolakan, tidak ada halangan lain antara #3602# dan #3603#']),
               varian=['Adakah halangan lain yang saksi ketahui untuk perkawinan #3602# dan #3603# ?']))
    P.append(Q('q-wali-nikah', 'pp-syarat-umum', 220, 'pilihan', 'pokok', 'Apakah wali nikah #3603# bersedia menikahkannya dengan #3602# ?', 'kesediaan wali nikah calon istri',
               JG('wali nikah calon istri bersedia menikahkan', ['wali nikah #3603# bersedia menikahkannya dengan #3602#', 'pihak yang berhak menjadi wali bagi #3603# telah menyatakan bersedia menikahkannya dengan #3602#'],
                  ['wali dari #3603# sudah menyetujui dan siap menikahkannya dengan #3602#', 'wali nikah #3603# merestui pernikahannya dengan #3602#']),
               varian=['Siapa wali nikah #3603# dan apakah ia bersedia menikahkannya dengan #3602# ?']))
    P.append(Q('q-keberatan-keluarga', 'pp-syarat-umum', 230, 'pilihan', 'upaya', 'Apakah ada keluarga atau pihak lain yang keberatan atas rencana perkawinan #3602# dan #3603# ?', 'keberatan keluarga atas rencana perkawinan',
               JG('tidak ada pihak yang keberatan', ['tidak ada keluarga maupun pihak lain yang keberatan atas rencana perkawinan #3602# dan #3603#', 'keluarga kedua belah pihak tidak keberatan #3602# dan #3603# menikah'],
                  ['rencana perkawinan #3602# dan #3603# tidak mendapat keberatan dari siapa pun', 'saya tidak pernah melihat ada yang menentang perkawinan #3602# dan #3603#']),
               varian=['Adakah yang menentang rencana perkawinan #3602# dan #3603# ?']))
    P.append(Q('q-upaya-lengkapi', 'pp-upaya-akibat', 240, 'pilihan', 'upaya', 'Apa yang dilakukan #0046# setelah perkawinannya ditolak oleh Kantor Urusan Agama #3604# sebelum mengajukan permohonan ke Pengadilan ?', 'upaya Pemohon sesudah penolakan',
               J('Pemohon meminta surat penolakan lalu mengajukan permohonan ke Pengadilan',
                 ['setelah ditolak #0046# meminta surat penolakan tertulis dari Kantor Urusan Agama #3604# lalu mengajukan permohonan ke Pengadilan', '#0046# menanyakan alasan penolakan kepada petugas Kantor Urusan Agama #3604# dan meminta surat penolakan tertulis sebelum ke Pengadilan',
                  'saya melihat #0046# mengurus surat penolakan di Kantor Urusan Agama #3604# lalu mendaftarkan permohonan ke Pengadilan', 'sesudah penolakan itu #0046# datang lagi ke Kantor Urusan Agama #3604# meminta surat tertulis dan mengajukan perkaranya ke Pengadilan'],
                 ['#0046# meminta penjelasan dan surat penolakan tertulis dari Kantor Urusan Agama #3604# sebelum membawa perkaranya ke Pengadilan', 'saya mengantar #0046# ke Kantor Urusan Agama #3604# untuk mengambil surat penolakan lalu mendaftarkan permohonan ke Pengadilan',
                  'atas penolakan Kantor Urusan Agama #3604# #0046# mengurus surat penolakan dan melanjutkan ke Pengadilan', 'setelah ditolak #0046# mendapatkan surat penolakan dari Kantor Urusan Agama #3604# dan memohon penetapan kepada Pengadilan']),
               varian=['Langkah apa yang ditempuh #0046# sesudah Kantor Urusan Agama #3604# menolak perkawinannya ?']))
    P.append(Q('q-rintangan-masih', 'pp-upaya-akibat', 250, 'pilihan', 'akibat', 'Apakah menurut saksi rintangan berupa #3605# yang dijadikan alasan penolakan itu ada pada #3602# dan #3603# ?', 'rintangan yang menjadi alasan penolakan',
               [JG('rintangan tidak ada', ['rintangan berupa #3605# tidak ada pada #3602# maupun #3603#', 'alasan penolakan berupa #3605# tidak terbukti ada pada #3602# dan #3603#'],
                   ['#3605# yang dijadikan alasan penolakan tidak benar adanya pada #3602# dan #3603#', 'saya tahu keadaan keduanya dan #3605# tidak ada pada #3602# atau #3603#'], {'hasil': 'tidak-ada-larangan'}),
                JG('rintangan masih ada', ['rintangan berupa #3605# masih ada pada #3602# atau #3603#', 'alasan penolakan berupa #3605# memang ada pada #3602# dan #3603#'],
                   ['#3605# yang dijadikan alasan penolakan benar adanya pada #3602# atau #3603#', 'saya tahu keadaan keduanya dan #3605# masih ada pada #3602# atau #3603#'], {'hasil': 'ada-larangan'})],
               varian=['Apakah #3605# yang dijadikan alasan penolakan itu sungguh ada pada #3602# dan #3603# ?']))
    P.append(_q_dari('wali-adhal', 'q-penutup', urutan=900, variabelAbt=[]))

    pertanyaan = P
    # blangko BAS yang memuat tanya-jawab saksi (variabel tanya_jawab 5058 dan 5059)
    bas = []
    for p in sorted(glob.glob(L.lp(os.path.join(L.OUT, j['folder_bas'])) + '/*.rtf')):
        raw = open(p, 'rb').read().decode('latin1')
        if '#5058#' in raw and '#5059#' in raw:
            bas.append(dict(folder=j['folder_bas'], berkas=os.path.basename(p)[:-4], variabelSaksi=['5058', '5059'], catatan=''))
    assert bas, 'jalankan bangun() lebih dulu'

    return {
        'skema': 'saksi-katalog/1', 'kunci': 'penolakan-perkawinan', 'judul': 'Penolakan perkawinan', 'versi': 1, 'penulis': 'W3A-A', 'tahap': 2, 'contoh': False,
        'syarat': {'jenisPerkaraId': [str(j['sipp'])]}, 'pihak': {'pengaju': '#0046#', 'lawan': '#0047#'}, 'blangkoBas': bas,
        'dasarHukum': dasar, 'keadaan': keadaan, 'pokokPembuktian': pokok, 'pertanyaan': pertanyaan, 'jawabanUmum': S.jawaban_umum_baku(),
        'catatanPetugas': [
            'Isi nama calon suami dan calon istri, wilayah KUA yang menolak, alasan penolakan menurut surat Pegawai Pencatat Nikah dan huruf larangan pada isian blangko sebelum menyusun; isian kosong tampil sebagai titik-titik.',
            'Pilih satu huruf larangan sesuai alasan penolakan pada surat Pegawai Pencatat Nikah; pertanyaan larangan hanya diajukan sesuai huruf itu. Pilih juga apakah keterangan saksi menyatakan larangan itu tidak ada atau ada.',
            'Pengadilan memeriksa dengan acara singkat dan hanya menilai ada atau tidak adanya larangan perkawinan yang dijadikan alasan penolakan; surat penolakan tertulis Pegawai Pencatat Nikah harus ada dalam berkas.',
            'Keterangan saksi yang hanya cerita orang lain bukan keterangan yang dialami sendiri; usahakan saksi yang mengenal kedua calon dan keluarganya.',
        ],
        'tanpaLawan': True, 'variabelBaru': BARU,
    }
