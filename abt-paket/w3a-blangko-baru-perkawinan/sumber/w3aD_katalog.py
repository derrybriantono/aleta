# -*- coding: utf-8 -*-
"""Pembangkit katalog saksi hak-bekas-istri (agen W3a-D): menulis ekstensi-sipp/saksi-katalog/hak-bekas-istri.json (skema saksi-katalog/1).

Butir hubungan, penutup, jawaban umum, dan dasar hukum saksi dasar disalin dari katalog nafkah-anak (sudah lolos pemeriksa); selebihnya ditulis untuk
gugatan hak bekas istri: perkawinan putus, dukhul dan iddah, nusyuz, hak belum dibayar/belum diputus, kemampuan Tergugat, kebutuhan Penggugat,
dan butir per hak (nafkah iddah, maskan-kiswah, mut'ah, nafkah madliyah, mahar, biaya hadhanah).
Jalankan: python w3aD_katalog.py   (menulis berkas dan memeriksanya dengan mesin periksaKatalog lewat node bila tersedia)."""
import json
import os
import sys

AKAR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
SK = os.path.join(AKAR, 'ekstensi-sipp', 'saksi-katalog')
dasar = json.load(open(os.path.join(SK, 'nafkah-anak.json'), encoding='utf-8'))
PAKAI_DH = {x['id']: x for x in dasar['dasarHukum']}

# ---------------------------------------------------------------------------------------------------------------------
# Dasar hukum (terverifikasi bila bunyinya dicocokkan dengan naskah lokal; perlu-verifikasi tidak pernah tercetak)
# ---------------------------------------------------------------------------------------------------------------------
DH = [PAKAI_DH[k] for k in ('dh-sebab-pengetahuan', 'dh-de-auditu', 'dh-unus-testis', 'dh-larangan-saksi', 'dh-kesesuaian-saksi', 'dh-sema-2-2019-a')]
DH += [
    dict(id='dh-uu1-41c', rujukan='Pasal 41 huruf c UU 1/1974 tentang Perkawinan',
         uraian='pengadilan dapat mewajibkan kepada bekas suami untuk memberikan biaya penghidupan dan/atau menentukan sesuatu kewajiban bagi bekas isteri',
         status='terverifikasi', sumber='naskah UU 1/1974 (BPK) salinan lokal D:/aleta-dev/kerja/referensi/_unduhan/uu1-1974/uu1-1974-bpk.txt, Pasal 41 huruf c dibaca 21 Okt 2026'),
    dict(id='dh-uu1-34', rujukan='Pasal 34 ayat (1) UU 1/1974 tentang Perkawinan',
         uraian='suami wajib melindungi isterinya dan memberikan segala sesuatu keperluan hidup berumah tangga sesuai dengan kemampuannya',
         status='terverifikasi', sumber='naskah UU 1/1974 (BPK) salinan lokal, Pasal 34 ayat (1) dibaca 21 Okt 2026'),
    dict(id='dh-pen49-13', rujukan='Penjelasan Pasal 49 huruf a angka 13 UU 7/1989 sebagaimana diubah UU 3/2006 dan UU 50/2009',
         uraian='kewenangan pengadilan agama atas penentuan kewajiban memberi biaya penghidupan oleh suami kepada bekas istri atau penentuan suatu kewajiban bagi bekas istri',
         status='terverifikasi', sumber='UU 3/2006 salinan lokal D:/aleta-dev/kerja/referensi/_unduhan/ekstra/uu3-2006.txt (Penjelasan Pasal 49 huruf a angka 13)'),
    dict(id='dh-khi-149', rujukan='Pasal 149 huruf a, b, c, d Kompilasi Hukum Islam',
         uraian='bila perkawinan putus karena talak bekas suami wajib memberi mut\'ah yang layak kecuali qobla al dukhul, nafkah, maskan dan kiswah selama iddah kecuali bekas istri talak ba\'in atau nusyuz dan tidak hamil, melunasi mahar terhutang (separuh bila qobla al dukhul), dan biaya hadhanah anak yang belum 21 tahun',
         status='terverifikasi', sumber='KHI lampiran Inpres 1/1991, naskah OCR D:/aleta-dev/kerja/referensi/_unduhan/khi/khi.txt (Pasal 149 dibaca 21 Okt 2026)'),
    dict(id='dh-khi-152-153', rujukan='Pasal 152 dan Pasal 153 ayat (2) sampai (4) Kompilasi Hukum Islam',
         uraian='bekas istri berhak mendapat nafkah iddah kecuali nusyuz; waktu tunggu 3 kali suci dengan sekurang-kurangnya 90 hari atau 90 hari bagi yang tidak haid, sampai melahirkan bagi yang hamil, tidak ada waktu tunggu bila qobla al dukhul, dihitung sejak putusan berkekuatan hukum tetap',
         status='terverifikasi', sumber='KHI-pasal-terverifikasi.md (Pasal 153) dan khi.txt OCR (Pasal 152) di D:/aleta-dev/kerja/referensi, dibaca 21 Okt 2026'),
    dict(id='dh-khi-158-160', rujukan='Pasal 158, 159, 160 Kompilasi Hukum Islam',
         uraian='mut\'ah wajib bila belum ditetapkan mahar bagi istri ba\'da al dukhul dan perceraian atas kehendak suami, sunnat tanpa syarat itu, dan besarnya disesuaikan dengan kepatutan dan kemampuan suami',
         status='terverifikasi', sumber='KHI naskah OCR khi.txt (Pasal 158-160 dibaca 21 Okt 2026)'),
    dict(id='dh-sema-3-2018', rujukan='Rumusan Hukum Kamar Agama Tahun 2018 (SEMA Nomor 3 Tahun 2018) Hukum Keluarga huruf b dan c',
         uraian='nafkah madhiyah, nafkah iddah, mut\'ah dan nafkah anak ditetapkan dengan menggali fakta kemampuan ekonomi suami dan kebutuhan dasar hidup istri/anak; istri dalam cerai gugat dapat diberikan mut\'ah dan nafkah iddah sepanjang tidak terbukti nusyuz',
         status='terverifikasi', sumber='kompilasi rumusan kamar D:/aleta-dev/kerja/referensi/_unduhan/sema/k.txt, bagian H (SEMA 3/2018), dibaca 21 Okt 2026'),
    dict(id='dh-kuhperdata-1917', rujukan='Pasal 1917 KUHPerdata',
         uraian='kekuatan putusan yang berkekuatan hukum pasti hanya mengenai pokok perkara yang sama, dengan soal yang dituntut, alasan, para pihak dan hubungan yang sama',
         status='terverifikasi', sumber='KUHPerdata salinan PN Bengkalis D:/aleta-dev/kerja/referensi/_unduhan/hir-rbg-bw/kuhperdata-pn-bengkalis.txt, Pasal 1917'),
    dict(id='dh-buku2-2013-exofficio', rujukan='Buku II Edisi Revisi 2013 bagian Cerai Talak butir (g), (h), (i) dan Cerai Gugat butir (f), (g)',
         uraian='nafkah iddah ex officio sepanjang istri tidak nusyuz, mut\'ah (Pasal 158 dan 160 KHI), dan hakim berupaya mengetahui pekerjaan dan pendapatan rata-rata suami sebagai dasar menetapkan nafkah madhiyah, iddah, mut\'ah dan anak',
         status='terverifikasi', sumber='Buku II 2013 teks lokal D:/aleta-dev/kerja/referensi/_unduhan/hir-rbg-bw/bukuii-2013.txt, bagian Cerai Talak dan Cerai Gugat'),
    dict(id='dh-khi-80-4', rujukan='Pasal 80 ayat (4) huruf a Kompilasi Hukum Islam',
         uraian='suami menanggung nafkah, kiswah dan tempat kediaman bagi istri sesuai penghasilannya',
         status='perlu-verifikasi', sumber='tidak ada naskah lokal yang terbaca (OCR khi.txt tidak memuat Pasal 80 KHI); dicocokkan dengan naskah KHI resmi sebelum dikutip'),
]
DH_ID = {x['id'] for x in DH}

# ---------------------------------------------------------------------------------------------------------------------
# Keadaan
# ---------------------------------------------------------------------------------------------------------------------
KEADAAN = {
    'kehadiran': dict(sumber='otomatis', nilai=['verstek', 'kontradiktoir', 't-tidak-hadir-setelah-mediasi'], label='Kehadiran Tergugat', bawaan='kontradiktoir'),
    'caraPutus': dict(sumber='borang', nilai=['cerai-talak', 'cerai-gugat'], label='Cara perkawinan putus', bawaan='cerai-talak'),
    'hakDituntut': dict(sumber='borang', nilai=['nafkah-iddah', 'maskan-kiswah', 'mutah', 'nafkah-madliyah', 'mahar', 'biaya-hadhanah'], label='Hak yang dituntut dalam gugatan',
                        bawaan=['nafkah-iddah', 'mutah'], jamak=True),
    'dukhul': dict(sumber='borang', nilai=['bada', 'qobla'], label='Keadaan dukhul', bawaan='bada'),
    'kemampuanTergugat': dict(sumber='borang', nilai=['mampu', 'terbatas'], label='Kemampuan ekonomi Tergugat menurut gugatan', bawaan='mampu'),
}

# ---------------------------------------------------------------------------------------------------------------------
# Pokok pembuktian
# ---------------------------------------------------------------------------------------------------------------------
POKOK = [
    dict(id='pp-hubungan-saksi', judul='Hubungan saksi dengan para pihak', uraian='saksi menerangkan siapa dirinya dan bagaimana ia mengenal para pihak (sebab pengetahuan)', wajib=True,
         dasarHukum=['dh-sebab-pengetahuan', 'dh-larangan-saksi', 'dh-unus-testis']),
    dict(id='pp-perkawinan-putus', judul='Perkawinan sah dan telah putus karena perceraian', uraian='Penggugat dan Tergugat dahulu suami istri yang sah dan perkawinannya telah putus karena perceraian',
         wajib=True, dasarHukum=['dh-uu1-41c', 'dh-pen49-13']),
    dict(id='pp-dukhul-iddah', judul='Dukhul dan masa iddah', uraian='para pihak telah bergaul sebagai suami istri dan Penggugat menjalani atau telah menjalani masa iddah', wajib=True, dasarHukum=['dh-khi-149', 'dh-khi-152-153']),
    dict(id='pp-nusyuz', judul='Penggugat tidak berbuat nusyuz', uraian='selama perkawinan Penggugat tidak meninggalkan kewajibannya sebagai istri sehingga tidak gugur haknya atas nafkah iddah, maskan dan kiswah',
         wajib=True, dasarHukum=['dh-khi-149', 'dh-sema-3-2018']),
    dict(id='pp-belum-dibayar', judul='Hak belum dipenuhi dan belum diputus dalam perkara cerai', uraian='Tergugat belum memenuhi hak-hak Penggugat dan hak itu belum pernah diputus dalam perkara perceraian (bukan nebis in idem)',
         wajib=True, dasarHukum=['dh-uu1-41c', 'dh-kuhperdata-1917']),
    dict(id='pp-kemampuan-tergugat', judul='Pekerjaan dan kemampuan ekonomi Tergugat', uraian='pekerjaan, penghasilan dan kemampuan Tergugat sebagai dasar besarnya hak', wajib=True,
         dasarHukum=['dh-sema-3-2018', 'dh-buku2-2013-exofficio', 'dh-khi-158-160']),
    dict(id='pp-kebutuhan-penggugat', judul='Lama perkawinan dan kebutuhan hidup Penggugat', uraian='lamanya perkawinan, keadaan Penggugat dan kebutuhan dasar hidupnya sebagai dasar kepatutan besarnya hak', wajib=True,
         dasarHukum=['dh-sema-3-2018', 'dh-khi-158-160']),
    dict(id='pp-nafkah-iddah', judul='Nafkah iddah, maskan dan kiswah', uraian='Penggugat tidak diberi nafkah, tempat tinggal dan pakaian selama masa iddah', wajib=False,
         keadaan={'hakDituntut': ['nafkah-iddah', 'maskan-kiswah']}, dasarHukum=['dh-khi-149', 'dh-khi-152-153']),
    dict(id='pp-mutah', judul="Mut'ah", uraian='mut\'ah belum diberikan dan perceraian terjadi menurut keadaan yang diatur Pasal 158 KHI', wajib=False, keadaan={'hakDituntut': 'mutah'}, dasarHukum=['dh-khi-149', 'dh-khi-158-160']),
    dict(id='pp-madliyah', judul='Nafkah lampau (madliyah) istri', uraian='selama perkawinan Tergugat melalaikan kewajiban memberi nafkah kepada Penggugat', wajib=False, keadaan={'hakDituntut': 'nafkah-madliyah'}, dasarHukum=['dh-uu1-34', 'dh-uu1-41c']),
    dict(id='pp-mahar', judul='Mahar yang masih terhutang', uraian='mahar yang dijanjikan belum dibayar seluruhnya oleh Tergugat', wajib=False, keadaan={'hakDituntut': 'mahar'}, dasarHukum=['dh-khi-149']),
    dict(id='pp-biaya-hadhanah', judul='Biaya hadhanah anak', uraian='anak yang diasuh Penggugat dan biaya yang tidak diberikan Tergugat', wajib=False, keadaan={'hakDituntut': 'biaya-hadhanah'}, dasarHukum=['dh-khi-149', 'dh-sema-2-2019-a']),
    dict(id='pp-bantahan-tergugat', judul='Bantahan Tergugat', uraian='bantahan Tergugat atas nusyuz, pembayaran dan kemampuannya', wajib=False, dasarHukum=['dh-sema-3-2018']),
    [p for p in dasar['pokokPembuktian'] if p['id'] == 'pp-penutup'][0],
]

# ---------------------------------------------------------------------------------------------------------------------
# Pertanyaan
# ---------------------------------------------------------------------------------------------------------------------


def jawab(maksud, s1, s2, **tambahan):
    d = dict(maksud=maksud, saksi1=s1, saksi2=s2)
    d.update(tambahan)
    return d


def Q(id, pokok, urutan, tingkat, kelompok, teks, varian, variabel, hal, melihat, keadaan=None, pihak=('*',), berbeda=None, slot_dari=None):
    q = dict(id=id, pokok=pokok, urutan=urutan, tingkat=tingkat, kelompok=kelompok, pihakSaksi=list(pihak), keadaan=keadaan or {}, teks=teks)
    if varian:
        q['teksVarian'] = varian
    q['variabelAbt'] = variabel
    if slot_dari:
        q['slotDari'] = slot_dari
    q['hal'] = hal
    j = dict(melihat=melihat)
    if berbeda:
        j['berbeda'] = berbeda
        q['tidakBerlaku'] = []
    else:
        q['tidakBerlaku'] = ['berbeda']
    q['jawaban'] = j
    return q


P = '#0046#'
T = '#0047#'
PERT = []

PERT.append([x for x in dasar['pertanyaan'] if x['id'] == 'q-kenal'][0])

PERT.append(Q('q-hubungan-pihak', 'pp-perkawinan-putus', 20, 'inti', 'hubungan', 'Apa hubungan antara #0046# dan #0047# ?',
              ['Bagaimana hubungan antara #0046# dengan #0047# ?', 'Apa kedudukan #0046# terhadap #0047# ?'], ['0046', '0047'], 'hubungan antara para pihak',
              jawab('Penggugat dahulu istri Tergugat dan keduanya sudah bercerai',
                    ['#0046# dahulu adalah istri #0047# dan keduanya sekarang sudah bercerai',
                     'hubungan mereka dahulu suami istri yang sah dan sekarang sudah berpisah karena bercerai',
                     'yang saya ketahui #0046# adalah bekas istri #0047# karena mereka sudah bercerai',
                     'dahulu #0046# dan #0047# adalah suami istri dan kini hubungan itu telah berakhir dengan perceraian'],
                    ['mereka dahulu suami istri yaitu #0046# istrinya dan #0047# suaminya lalu keduanya bercerai',
                     'saya tahu #0046# adalah mantan istri dari #0047# dan perkawinan keduanya sudah berakhir',
                     'perkawinan #0046# dengan #0047# sudah selesai karena perceraian sehingga sekarang mereka bekas suami istri',
                     '#0047# adalah mantan suami #0046# setelah keduanya bercerai'])))

PERT.append(Q('q-pernikahan', 'pp-perkawinan-putus', 30, 'inti', 'pokok', 'Kapan dan di mana #0046# dan #0047# menikah ?',
              ['Pada waktu kapan #0046# dan #0047# melangsungkan pernikahan ?', 'Apakah saksi mengetahui kapan #0046# menikah dengan #0047# ?'], ['0046', '0047'], 'waktu dan tempat pernikahan para pihak',
              jawab('saksi menerangkan waktu pernikahan yang sah secara agama',
                    ['#0046# dan #0047# menikah pada {waktu} secara sah menurut agama Islam dan saya mengetahuinya sendiri',
                     'pernikahan #0046# dengan #0047# dilangsungkan {waktu} menurut ketentuan agama Islam sebagaimana saya lihat',
                     'saya hadir dan melihat #0046# menikah dengan #0047# pada {waktu} secara Islam',
                     'sebagaimana saya saksikan, akad nikah #0046# dan #0047# berlangsung {waktu} dengan cara yang sah menurut agama'],
                    ['mereka menikah {waktu} dan pernikahan itu sah menurut hukum Islam yang saya ketahui sendiri',
                     'saya ikut menyaksikan pernikahan #0046# bersama #0047# yang terjadi {waktu} secara Islam',
                     'akad nikah antara #0046# dan #0047# terjadi {waktu} dan saya melihat langsung prosesnya sesuai syariat Islam',
                     'pada {waktu} #0046# dinikahi #0047# dengan cara yang sah menurut agama sebagaimana saya lihat'])))

PERT.append(Q('q-putus-cerai', 'pp-perkawinan-putus', 40, 'inti', 'pokok', 'Apakah saksi mengetahui bahwa perkawinan #0046# dan #0047# telah putus karena perceraian ?',
              ['Apakah perkawinan #0046# dengan #0047# sudah berakhir karena bercerai ?', 'Sejak kapan #0046# dan #0047# resmi bercerai menurut yang saksi ketahui ?'], ['0046', '0047'],
              'putusnya perkawinan karena perceraian',
              jawab('saksi mengetahui perkawinan telah putus karena perceraian di pengadilan',
                    ['perkawinan #0046# dan #0047# sudah putus karena perceraian pada {waktu} dan saya mengetahuinya sendiri',
                     'saya tahu langsung bahwa #0046# dan #0047# resmi bercerai pada {waktu} melalui pengadilan agama',
                     'sebagaimana saya lihat, sejak {waktu} #0046# dan #0047# berhenti hidup sebagai suami istri karena sudah bercerai',
                     'perceraian #0046# dengan #0047# terjadi pada {waktu} dan sejak itu mereka berpisah'],
                    ['mereka sudah bercerai pada {waktu} dan hal itu saya ketahui sendiri',
                     'saya mengetahui sendiri bahwa perkawinan #0046# dengan #0047# berakhir karena perceraian di pengadilan agama pada {waktu}',
                     'sejak {waktu} #0046# dan #0047# sudah menjadi bekas suami istri berdasarkan perceraian yang saya ketahui',
                     'pada {waktu} #0046# dan #0047# resmi berpisah akibat perceraian menurut pengetahuan saya sendiri'])))

PERT.append(Q('q-cara-talak', 'pp-perkawinan-putus', 45, 'tambahan', 'pokok', 'Siapa yang mengajukan perceraian dan apakah #0047# mengucapkan ikrar talak terhadap #0046# ?',
              ['Apakah #0047# yang mengajukan perceraian dari #0046# dan talaknya diikrarkan di depan sidang ?'], ['0046', '0047'], 'cara perkawinan putus (cerai talak)',
              jawab('perceraian diajukan Tergugat dan Tergugat mengikrarkan talak di depan sidang',
                    ['perceraian itu diajukan oleh #0047# dan #0047# sendiri yang mengucapkan ikrar talak terhadap #0046# di depan sidang',
                     'saya mengetahui sendiri bahwa #0047# yang meminta bercerai lalu mengikrarkan talak kepada #0046# di pengadilan agama',
                     'yang menjatuhkan talak kepada #0046# adalah #0047# di depan sidang pengadilan agama sebagaimana saya lihat',
                     'cerai itu atas kehendak #0047# yang mengikrarkan talaknya terhadap #0046# di hadapan hakim'],
                    ['#0047# yang mengajukan permohonan cerai dan di sidang ikrar ia mengucapkan talak kepada #0046#',
                     'sebagaimana saya saksikan, #0047# mengucapkan ikrar talak terhadap #0046# setelah permohonannya dikabulkan',
                     'talak dijatuhkan oleh #0047# kepada #0046# di depan sidang atas keinginannya sendiri',
                     'perceraian mereka terjadi karena #0047# memohon cerai kemudian mengikrarkan talak kepada #0046# di persidangan']),
              keadaan={'caraPutus': 'cerai-talak'}))

PERT.append(Q('q-cara-gugat', 'pp-perkawinan-putus', 46, 'tambahan', 'pokok', 'Siapa yang mengajukan perceraian dan apakah pengadilan telah memutus perceraian #0046# dan #0047# ?',
              ['Apakah #0046# yang mengajukan cerai terhadap #0047# dan sudah diputus oleh pengadilan agama ?'], ['0046', '0047'], 'cara perkawinan putus (cerai gugat)',
              jawab('perceraian diajukan Penggugat dan telah diputus pengadilan agama',
                    ['perceraian itu diajukan oleh #0046# dan sudah diputus oleh pengadilan agama sebagaimana saya ketahui sendiri',
                     'saya mengetahui sendiri bahwa #0046# yang menggugat cerai #0047# lalu pengadilan agama memutus perceraian mereka',
                     'yang menggugat cerai adalah #0046# dan putusannya telah dijatuhkan pengadilan agama menurut yang saya lihat',
                     'gugatan cerai diajukan #0046# kepada #0047# dan perkara itu sudah diputus pengadilan agama'],
                    ['#0046# yang mengajukan gugatan cerai terhadap #0047# dan hakim pengadilan agama telah memutusnya',
                     'sebagaimana saya saksikan, #0046# menggugat #0047# di pengadilan agama sampai perceraian mereka diputus',
                     'perceraian mereka berawal dari gugatan #0046# yang kemudian dikabulkan oleh pengadilan agama',
                     'putusan cerai antara #0046# dan #0047# dijatuhkan setelah #0046# mengajukan gugatan sebagaimana saya ketahui']),
              keadaan={'caraPutus': 'cerai-gugat'}))

PERT.append(Q('q-dukhul', 'pp-dukhul-iddah', 50, 'inti', 'pokok', 'Apakah selama menjadi suami istri #0046# dan #0047# hidup bersama dan bergaul sebagaimana layaknya suami istri ?',
              ['Apakah #0046# dan #0047# pernah tinggal serumah sebagai suami istri ?'], ['0046', '0047'], 'hubungan suami istri antara para pihak',
              jawab('saksi melihat para pihak hidup serumah dan bergaul sebagai suami istri',
                    ['selama menjadi suami istri #0046# dan #0047# tinggal serumah dan bergaul sebagaimana layaknya suami istri menurut penglihatan saya',
                     'saya melihat sendiri #0046# dan #0047# hidup bersama dalam satu rumah sebagai suami istri',
                     'sebagaimana saya saksikan, kedua pihak tinggal bersama dan menjalani kehidupan layaknya suami istri',
                     'mereka serumah sebagai suami istri dan hal itu saya lihat langsung'],
                    ['#0046# dan #0047# hidup bersama sebagai suami istri dalam satu rumah di depan mata saya',
                     'saya tahu sendiri keduanya bergaul sebagaimana suami istri selama perkawinan mereka',
                     'selama pernikahan mereka tinggal satu atap dan menjalani rumah tangga seperti suami istri pada umumnya',
                     'yang saya saksikan #0046# dan #0047# berumah tangga bersama sebagaimana layaknya pasangan suami istri']),
              keadaan={'dukhul': 'bada'}))

PERT.append(Q('q-qobla', 'pp-dukhul-iddah', 51, 'tambahan', 'pokok', 'Apakah #0046# dan #0047# pernah hidup bersama sebagai suami istri setelah akad nikah ?',
              ['Apakah setelah menikah #0046# dan #0047# pernah tinggal serumah ?'], ['0046', '0047'], 'ada tidaknya hubungan suami istri setelah akad nikah',
              jawab('saksi mengetahui para pihak belum pernah hidup bersama sebagai suami istri setelah akad nikah',
                    ['setelah akad nikah #0046# dan #0047# belum pernah tinggal serumah sebagai suami istri menurut yang saya lihat',
                     'saya mengetahui sendiri keduanya belum pernah hidup bersama layaknya suami istri sejak menikah',
                     'sejak akad nikah sampai berpisah mereka belum pernah serumah sebagaimana suami istri dan saya menyaksikannya',
                     'sepanjang yang saya lihat #0046# dan #0047# belum pernah menjalani rumah tangga bersama setelah menikah'],
                    ['#0046# dan #0047# belum pernah bergaul sebagai suami istri sejak akad nikah dan saya tahu sendiri',
                     'dari penglihatan saya mereka belum pernah tinggal satu atap setelah akad nikah',
                     'keduanya belum sempat berumah tangga bersama sesudah menikah sebagaimana saya saksikan',
                     'sejak menikah #0046# dan #0047# belum pernah hidup serumah sebagai pasangan suami istri menurut pengetahuan saya sendiri']),
              keadaan={'dukhul': 'qobla'}))

PERT.append(Q('q-iddah', 'pp-dukhul-iddah', 60, 'inti', 'pokok', 'Sejak kapan perkawinan putus dan apakah #0046# menjalani masa iddah sesudahnya ?',
              ['Apakah sesudah bercerai #0046# menjalani masa iddah dan tidak menikah dengan laki-laki lain ?'], ['0046', '0047'], 'masa iddah Penggugat',
              jawab('saksi mengetahui Penggugat menjalani masa iddah sejak perkawinan putus',
                    ['sejak {waktu} #0046# menjalani masa iddah dan tidak menikah dengan laki-laki lain menurut penglihatan saya',
                     'saya melihat sendiri bahwa mulai {waktu} #0046# menjalani iddah dan tidak menerima pinangan laki-laki lain',
                     'sesudah perkawinan putus pada {waktu} #0046# menjalani masa iddah dan tidak menikah lagi sebagaimana saya saksikan',
                     'sejak {waktu} sampai sekarang #0046# menjalani masa tunggu dan tidak bersuami lagi menurut yang saya lihat'],
                    ['masa iddah #0046# berjalan sejak {waktu} dan selama itu ia tidak menikah dengan siapa pun',
                     'dari {waktu} #0046# berada dalam masa iddah dan tidak menikah lagi sebagaimana saya ketahui sendiri',
                     'saya tahu langsung #0046# menjalani iddah setelah perceraian pada {waktu} dan belum menikah lagi',
                     'terhitung {waktu} #0046# menjalani masa tunggu sebagai bekas istri #0047# tanpa menikah lagi sebagaimana saya lihat'])))

PERT.append(Q('q-tinggal-iddah', 'pp-nafkah-iddah', 65, 'inti', 'pokok', 'Di mana #0046# tinggal selama masa iddah dan siapa yang menyediakan tempat tinggal serta pakaiannya ?',
              ['Selama masa iddah, siapa yang menanggung tempat tinggal dan pakaian #0046# ?'], ['0046', '0047'], 'tempat tinggal dan pakaian Penggugat selama iddah',
              jawab('Tergugat tidak menyediakan tempat tinggal dan pakaian selama iddah',
                    ['selama masa iddah #0046# tinggal di {daftar} dan #0047# tidak menyediakan tempat tinggal maupun pakaian untuk #0046#',
                     'saya melihat sendiri #0046# tinggal di {daftar} selama iddah sedangkan #0047# tidak membiayai tempat tinggal dan pakaiannya',
                     'tempat tinggal #0046# selama iddah adalah {daftar} dan #0047# tidak ikut menanggung pakaian ataupun tempat tinggalnya',
                     'sebagaimana saya saksikan, selama iddah #0046# menumpang di {daftar} tanpa bantuan tempat tinggal dari #0047#'],
                    ['selama iddah #0046# berada di {daftar} dan #0047# tidak menyediakan kebutuhan tempat tinggal serta pakaian #0046#',
                     'yang saya ketahui sendiri, #0046# tinggal di {daftar} pada masa iddah dan #0047# tidak membantu pakaian maupun tempat tinggalnya',
                     'pada masa iddah #0046# tinggal di {daftar} dan semua kebutuhan tempat tinggal serta pakaiannya tidak disediakan #0047#',
                     'masa iddah #0046# dilalui di {daftar} tanpa tempat tinggal dan pakaian dari #0047# sebagaimana saya lihat']),
              keadaan={'hakDituntut': 'maskan-kiswah'}))

PERT.append(Q('q-nusyuz', 'pp-nusyuz', 70, 'inti', 'pokok', 'Apakah selama perkawinan #0046# pernah meninggalkan rumah tanpa izin #0047# atau melalaikan kewajibannya sebagai istri ?',
              ['Apakah #0046# pernah pergi dari rumah tanpa seizin #0047# atau membangkang kepadanya selama perkawinan ?'], ['0046', '0047'], 'ada tidaknya nusyuz Penggugat',
              jawab('saksi menerangkan Penggugat tidak pernah meninggalkan rumah tanpa izin dan tidak melalaikan kewajibannya',
                    ['selama perkawinan #0046# tidak pernah meninggalkan rumah tanpa izin #0047# dan tidak pernah melalaikan kewajibannya sebagai istri',
                     'saya melihat sendiri #0046# tidak pernah pergi dari rumah tanpa sepengetahuan #0047# dan tidak pernah mengabaikan tugasnya sebagai istri',
                     'sepanjang perkawinan mereka #0046# tidak pernah membangkang kepada #0047# dan tidak pernah meninggalkan rumah tanpa alasan menurut yang saya saksikan',
                     'tidak pernah ada kejadian #0046# meninggalkan rumah tanpa izin atau tidak menjalankan kewajiban sebagai istri terhadap #0047# sepanjang pengetahuan saya sendiri'],
                    ['#0046# tidak pernah keluar rumah tanpa seizin #0047# dan tidak pernah lalai menjalankan kewajibannya sebagai istri',
                     'dari yang saya lihat setiap hari, #0046# tidak pernah menentang #0047# dan tidak pernah pergi dari rumah tanpa pamit',
                     'saya tahu sendiri #0046# tidak pernah berbuat membangkang dan tidak pernah meninggalkan rumah tanpa izin dari #0047#',
                     'selama mereka berumah tangga #0046# tidak pernah mengabaikan kewajiban kepada #0047# dan tidak pernah pergi tanpa izin sebagaimana saya saksikan']),
              berbeda=jawab('versi A: Penggugat tidak pernah meninggalkan rumah tanpa izin; versi B: Penggugat pernah meninggalkan rumah tanpa izin - berselisih pada PERISTIWA',
                            ['#0046# tidak pernah meninggalkan rumah tanpa izin #0047# menurut penglihatan saya',
                             'saya lihat sendiri #0046# tidak pernah pergi dari rumah tanpa sepengetahuan #0047#',
                             'selama perkawinan #0046# tidak pernah keluar rumah tanpa pamit kepada #0047# sebagaimana saya saksikan',
                             'tidak pernah ada kejadian #0046# meninggalkan rumah tanpa seizin #0047# menurut yang saya ketahui'],
                            ['#0046# pernah meninggalkan rumah tanpa izin #0047# menurut penglihatan saya',
                             'saya lihat sendiri #0046# pernah pergi dari rumah tanpa sepengetahuan #0047#',
                             'selama perkawinan #0046# pernah keluar rumah tanpa pamit kepada #0047# sebagaimana saya saksikan',
                             'ada kejadian #0046# meninggalkan rumah tanpa seizin #0047# menurut yang saya ketahui'],
                            bedaPada='peristiwa')))

PERT.append(Q('q-penyebab-cerai', 'pp-nusyuz', 75, 'inti', 'pokok', 'Apa yang menjadi penyebab perceraian #0046# dan #0047# menurut yang saksi ketahui ?',
              ['Mengapa #0046# dan #0047# akhirnya bercerai ?'], ['0046', '0047'], 'penyebab perceraian para pihak',
              jawab('saksi menerangkan penyebab perceraian yang diketahuinya sendiri',
                    ['penyebab perceraian mereka menurut yang saya lihat sendiri adalah {daftar}',
                     'saya mengetahui langsung bahwa #0046# dan #0047# bercerai karena {daftar}',
                     'yang menjadi sebab mereka bercerai sebagaimana saya saksikan ialah {daftar}',
                     'perceraian mereka berawal dari {daftar} dan hal itu saya ketahui sendiri'],
                    ['sebab #0046# dan #0047# bercerai adalah {daftar} menurut pengetahuan saya sendiri',
                     'saya melihat sendiri bahwa pangkal perceraian mereka adalah {daftar}',
                     'mereka berpisah dan bercerai karena {daftar} sebagaimana yang saya saksikan',
                     'alasan #0046# dan #0047# bercerai ialah {daftar} yang saya ketahui langsung'])))

PERT.append(Q('q-belum-diberi-iddah', 'pp-belum-dibayar', 80, 'inti', 'pokok', 'Apakah #0047# sudah memberikan nafkah selama masa iddah kepada #0046# ?',
              ['Apakah #0046# pernah menerima nafkah iddah dari #0047# ?'], ['0046', '0047'], 'pemberian nafkah iddah oleh Tergugat',
              jawab('Tergugat belum memberikan nafkah selama masa iddah',
                    ['#0047# belum memberikan nafkah selama masa iddah kepada #0046# sampai sekarang menurut yang saya lihat',
                     'saya mengetahui sendiri #0046# belum menerima nafkah iddah dari #0047# sejak perceraian',
                     'sampai saat ini #0047# belum memberi #0046# nafkah untuk masa iddah sebagaimana saya saksikan',
                     'nafkah iddah untuk #0046# belum diberikan #0047# menurut penglihatan saya'],
                    ['sejak bercerai #0047# belum menyerahkan nafkah iddah kepada #0046# dan saya tahu sendiri',
                     'yang saya ketahui langsung, #0046# belum pernah mendapat nafkah masa iddah dari #0047#',
                     'untuk masa iddahnya #0046# belum diberi nafkah oleh #0047# sampai sekarang sebagaimana saya lihat',
                     'saya menyaksikan #0047# belum membayar nafkah iddah kepada #0046# hingga saat ini']),
              keadaan={'hakDituntut': 'nafkah-iddah'},
              berbeda=jawab('versi A: Tergugat belum memberi nafkah iddah; versi B: Tergugat pernah memberi sebagian - berselisih pada PERISTIWA',
                            ['#0047# belum memberi nafkah iddah kepada #0046# sama sekali menurut penglihatan saya',
                             'saya lihat sendiri #0047# belum menyerahkan nafkah iddah apa pun kepada #0046#',
                             'sampai sekarang #0046# belum menerima nafkah iddah dari #0047# sebagaimana saya saksikan',
                             'nafkah iddah belum pernah diberikan #0047# kepada #0046# sepanjang yang saya ketahui'],
                            ['#0047# pernah memberi sebagian nafkah iddah kepada #0046# menurut penglihatan saya',
                             'saya lihat sendiri #0047# pernah menyerahkan sebagian nafkah iddah kepada #0046#',
                             'ada nafkah iddah yang pernah diterima #0046# dari #0047# sebagaimana saya saksikan',
                             'sebagian nafkah iddah pernah diberikan #0047# kepada #0046# sepanjang yang saya ketahui'],
                            bedaPada='peristiwa')))

PERT.append(Q('q-belum-diberi-mutah', 'pp-belum-dibayar', 85, 'inti', 'pokok', "Apakah #0047# sudah memberikan mut'ah kepada #0046# setelah perceraian ?",
              ["Apakah #0046# pernah menerima mut'ah dari #0047# ?"], ['0046', '0047'], "pemberian mut'ah oleh Tergugat",
              jawab("Tergugat belum memberikan mut'ah apa pun",
                    ["#0047# belum memberikan mut'ah apa pun kepada #0046# setelah perceraian menurut yang saya lihat",
                     "saya mengetahui sendiri #0046# belum menerima mut'ah dari #0047#",
                     "sampai sekarang #0047# belum menyerahkan mut'ah kepada #0046# sebagaimana saya saksikan",
                     "mut'ah untuk #0046# belum diberikan #0047# menurut penglihatan saya"],
                    ["sesudah bercerai #0047# belum memberi mut'ah kepada #0046# dan saya tahu sendiri",
                     "yang saya ketahui langsung, #0046# belum pernah mendapat mut'ah dari #0047#",
                     "#0047# belum membayar mut'ah kepada #0046# sampai saat ini sebagaimana saya lihat",
                     "saya menyaksikan #0046# belum menerima apa pun sebagai mut'ah dari #0047#"]),
              keadaan={'hakDituntut': 'mutah'}))

PERT.append(Q('q-belum-diputus', 'pp-belum-dibayar', 90, 'inti', 'pokok', 'Apakah saksi mengetahui bahwa hak-hak #0046# sebagai bekas istri pernah diberikan atau diputus dalam perkara perceraian ?',
              ['Apakah dalam perkara perceraiannya hak-hak #0046# sebagai bekas istri sudah diputus ?'], ['0046', '0047'], 'status hak bekas istri dalam perkara perceraian',
              jawab('hak-hak Penggugat belum diberikan dan belum diputus dalam perkara perceraian',
                    ['hak-hak #0046# sebagai bekas istri belum pernah diberikan dan belum pernah diputus dalam perkara perceraian mereka menurut yang saya ketahui',
                     'saya mengetahui sendiri bahwa hak-hak #0046# belum pernah diterima dan belum pernah diputus dalam perceraian itu',
                     'setelah perceraian hak-hak #0046# sebagai bekas istri belum pernah dipenuhi dan belum pernah ditetapkan dalam putusan perceraian sebagaimana saya lihat',
                     'dalam perceraian mereka hak-hak #0046# belum pernah diputus dan sampai sekarang belum pernah diberikan #0047# menurut pengetahuan saya'],
                    ['hak-hak #0046# sebagai bekas istri belum pernah dibayar #0047# dan belum pernah dibahas dalam putusan perceraian sebagaimana saya ketahui sendiri',
                     'yang saya lihat langsung, perkara perceraian mereka belum pernah memutus hak-hak #0046# dan #0047# belum pernah memenuhinya',
                     'belum pernah ada pemberian hak bekas istri kepada #0046# dan belum pernah ada putusan tentang hak itu menurut penglihatan saya',
                     'saya tahu sendiri hak #0046# sebagai bekas istri belum pernah diberikan dan belum pernah diputus dalam perceraian tersebut'])))

PERT.append(Q('q-upaya-minta', 'pp-belum-dibayar', 95, 'inti', 'upaya', 'Apakah #0046# pernah meminta hak-haknya kepada #0047# dan bagaimana tanggapan #0047# ?',
              ['Apakah #0046# pernah menagih hak-haknya sebagai bekas istri kepada #0047# dan bagaimana sikap #0047# ?'], ['0046', '0047'], 'upaya Penggugat meminta haknya',
              jawab('Penggugat pernah meminta haknya dan menerima tanggapan Tergugat',
                    ['#0046# pernah meminta hak-haknya kepada #0047# secara langsung dan tanggapan #0047# adalah {isi}',
                     'saya melihat sendiri #0046# menagih haknya kepada #0047# dan jawaban #0047# adalah {isi}',
                     'sebagaimana saya saksikan #0046# sudah meminta haknya sebagai bekas istri dan sikap #0047# adalah {isi}',
                     'permintaan #0046# atas haknya kepada #0047# pernah disampaikan dan tanggapan #0047# adalah {isi}'],
                    ['#0046# sudah beberapa kali meminta haknya kepada #0047# dan #0047# menanggapinya dengan {isi}',
                     'yang saya ketahui langsung, #0046# menyampaikan tagihan haknya kepada #0047# lalu #0047# menjawab {isi}',
                     'saya hadir ketika #0046# meminta hak bekas istrinya dan #0047# memberi tanggapan berupa {isi}',
                     'tagihan #0046# kepada #0047# atas haknya telah disampaikan dan reaksi #0047# adalah {isi}'])))

PERT.append(Q('q-pekerjaan-tergugat', 'pp-kemampuan-tergugat', 100, 'inti', 'pokok', 'Apa pekerjaan #0047# dan berapa kira-kira penghasilannya setiap bulan ?',
              ['Pekerjaan #0047# apa dan berapa penghasilan bulanannya ?'], ['0046', '0047', '0104'], 'pekerjaan dan penghasilan Tergugat',
              jawab('saksi mengetahui pekerjaan dan penghasilan Tergugat',
                    ['#0047# bekerja sebagai #0104# dengan penghasilan {penghasilan} setiap bulan menurut yang saya ketahui sendiri',
                     'pekerjaan #0047# adalah #0104# dan penghasilannya {penghasilan} setiap bulan sebagaimana saya lihat',
                     'saya tahu langsung #0047# bekerja sebagai #0104# yang penghasilannya {penghasilan} setiap bulan',
                     'sehari-hari #0047# bekerja sebagai #0104# dan memperoleh penghasilan {penghasilan} tiap bulan menurut penglihatan saya'],
                    ['mata pencaharian #0047# adalah #0104# dengan penghasilan {penghasilan} setiap bulan yang saya ketahui sendiri',
                     'yang saya lihat setiap hari, #0047# bekerja sebagai #0104# dan penghasilannya {penghasilan} tiap bulan',
                     '#0047# berpenghasilan {penghasilan} setiap bulan dari pekerjaannya sebagai #0104# sebagaimana saya saksikan',
                     'saya mengetahui sendiri bahwa #0047# adalah #0104# yang memperoleh {penghasilan} setiap bulan']),
              berbeda=jawab('versi A dan B menyebut penghasilan Tergugat dengan jumlah berbeda - berselisih pada JUMLAH',
                            ['#0047# bekerja sebagai #0104# dengan penghasilan {penghasilan} setiap bulan menurut penglihatan saya',
                             'pekerjaan #0047# adalah #0104# yang penghasilannya {penghasilan} setiap bulan sebagaimana saya lihat',
                             'saya tahu sendiri #0047# sebagai #0104# memperoleh {penghasilan} tiap bulan',
                             'sehari-hari #0047# adalah #0104# dengan pendapatan {penghasilan} setiap bulan menurut yang saya saksikan'],
                            ['penghasilan #0047# sebagai #0104# menurut penglihatan saya adalah {penghasilan} setiap bulan',
                             'saya lihat sendiri #0047# yang bekerja sebagai #0104# mendapat {penghasilan} tiap bulan',
                             'pendapatan #0047# dari pekerjaannya sebagai #0104# adalah {penghasilan} setiap bulan sebagaimana saya saksikan',
                             'yang saya ketahui langsung, #0047# adalah #0104# dengan penghasilan {penghasilan} sebulan'],
                            bedaPada='jumlah')))

PERT.append(Q('q-harta-tergugat', 'pp-kemampuan-tergugat', 105, 'pilihan', 'pokok', 'Apakah #0047# mempunyai harta atau usaha lain selain pekerjaannya ?',
              ['Apakah #0047# memiliki usaha atau harta lain di luar pekerjaan pokoknya ?'], ['0047'], 'harta atau usaha lain Tergugat',
              jawab('saksi mengetahui harta atau usaha lain milik Tergugat',
                    ['selain pekerjaannya #0047# mempunyai {daftar} menurut yang saya lihat sendiri',
                     'saya mengetahui langsung #0047# memiliki {daftar} di luar pekerjaan pokoknya',
                     'di luar pekerjaannya #0047# punya {daftar} sebagaimana saya saksikan',
                     'harta atau usaha lain milik #0047# berupa {daftar} yang saya ketahui sendiri'],
                    ['#0047# juga memiliki {daftar} selain dari pekerjaan sehari-harinya menurut penglihatan saya',
                     'yang saya ketahui langsung, di samping pekerjaannya #0047# mempunyai {daftar}',
                     'saya tahu sendiri #0047# memiliki harta berupa {daftar} di luar pekerjaan tetapnya',
                     'sebagaimana saya lihat #0047# menguasai {daftar} selain pekerjaan pokoknya'])))

PERT.append(Q('q-mampu', 'pp-kemampuan-tergugat', 110, 'inti', 'pokok', 'Bagaimana kehidupan sehari-hari #0047# apakah tergolong mampu ?',
              ['Apakah #0047# tergolong mampu memenuhi kebutuhan hidup sehari-hari ?'], ['0046', '0047'], 'kemampuan ekonomi Tergugat',
              jawab('Tergugat tergolong mampu',
                    ['kehidupan sehari-hari #0047# tergolong mampu dan sanggup memenuhi kebutuhan hidup #0046# menurut yang saya lihat',
                     'saya melihat sendiri #0047# hidup berkecukupan sehingga sanggup memenuhi kebutuhan #0046#',
                     'sebagaimana saya saksikan keadaan ekonomi #0047# baik dan mampu menanggung hak #0046#',
                     '#0047# termasuk orang yang mampu menurut penglihatan saya dan sanggup menanggung kebutuhan hidup #0046#'],
                    ['#0047# hidup berkecukupan dan sanggup membiayai kebutuhan #0046# sebagaimana saya ketahui sendiri',
                     'dari yang saya lihat langsung, ekonomi #0047# tergolong baik dan cukup untuk menanggung kebutuhan hidup #0046#',
                     'saya tahu sendiri #0047# mampu secara ekonomi untuk memenuhi hak-hak #0046#',
                     'kemampuan ekonomi #0047# cukup memadai menurut pengetahuan saya sendiri untuk menanggung kebutuhan hidup #0046#']),
              keadaan={'kemampuanTergugat': 'mampu'}))

PERT.append(Q('q-terbatas', 'pp-kemampuan-tergugat', 111, 'inti', 'pokok', 'Bagaimana kehidupan sehari-hari #0047# apakah penghasilannya cukup untuk kebutuhan hidupnya sendiri ?',
              ['Apakah penghasilan #0047# hanya cukup untuk kebutuhannya sendiri ?'], ['0046', '0047'], 'kemampuan ekonomi Tergugat yang terbatas',
              jawab('penghasilan Tergugat terbatas',
                    ['penghasilan #0047# terbatas dan hanya cukup untuk kebutuhan hidup #0047# sendiri menurut yang saya lihat',
                     'saya melihat sendiri ekonomi #0047# pas-pasan sehingga hanya sanggup menanggung kebutuhan dirinya',
                     'sebagaimana saya saksikan keadaan ekonomi #0047# terbatas dan hanya cukup untuk dirinya',
                     'menurut penglihatan saya #0047# berpenghasilan terbatas yang hanya mencukupi kebutuhannya sendiri'],
                    ['#0047# hidup sederhana dengan penghasilan yang hanya cukup untuk dirinya sebagaimana saya ketahui sendiri',
                     'dari yang saya lihat langsung, ekonomi #0047# terbatas dan hanya cukup menutup kebutuhannya sendiri',
                     'saya tahu sendiri penghasilan #0047# pas-pasan dan hanya mencukupi kebutuhan dirinya',
                     'kemampuan ekonomi #0047# sederhana dan hanya cukup untuk keperluannya sendiri menurut pengetahuan saya']),
              keadaan={'kemampuanTergugat': 'terbatas'}))

PERT.append(Q('q-kebutuhan-penggugat', 'pp-kebutuhan-penggugat', 120, 'inti', 'pokok', 'Apa saja kebutuhan hidup sehari-hari #0046# setelah perceraian dan siapa yang menanggungnya ?',
              ['Apa kebutuhan hidup #0046# sehari-hari sekarang dan siapa yang membiayainya ?'], ['0046', '0047'], 'kebutuhan hidup Penggugat setelah perceraian',
              jawab('saksi mengetahui kebutuhan hidup Penggugat dan siapa yang menanggungnya',
                    ['kebutuhan hidup #0046# sehari-hari meliputi {daftar} dan selama ini ditanggung oleh {hubungan}',
                     'saya melihat sendiri kebutuhan #0046# sehari-hari berupa {daftar} yang dibiayai oleh {hubungan}',
                     'sebagaimana saya saksikan #0046# memerlukan {daftar} dan yang menanggungnya adalah {hubungan}',
                     'menurut penglihatan saya kebutuhan hidup #0046# terdiri dari {daftar} dan ditanggung {hubungan}'],
                    ['yang dibutuhkan #0046# setiap hari adalah {daftar} dan biayanya selama ini ditanggung {hubungan}',
                     'saya tahu sendiri #0046# membutuhkan {daftar} sedangkan yang membiayainya adalah {hubungan}',
                     'dari yang saya lihat langsung, kebutuhan sehari-hari #0046# mencakup {daftar} dan ditanggung oleh {hubungan}',
                     '#0046# sehari-hari memerlukan {daftar} dan pembiayaannya dipikul {hubungan} sebagaimana saya ketahui'])))

PERT.append(Q('q-lama-kawin', 'pp-kebutuhan-penggugat', 125, 'inti', 'pokok', 'Berapa lama #0046# dan #0047# hidup sebagai suami istri ?',
              ['Sudah berapa lama perkawinan #0046# dan #0047# berlangsung sampai bercerai ?'], ['0046', '0047'], 'lamanya perkawinan para pihak',
              jawab('saksi mengetahui lamanya perkawinan',
                    ['#0046# dan #0047# hidup sebagai suami istri selama {lama} menurut yang saya ketahui sendiri',
                     'perkawinan mereka berlangsung selama {lama} sebelum bercerai sebagaimana saya lihat',
                     'saya mengetahui langsung bahwa rumah tangga #0046# dengan #0047# berjalan selama {lama}',
                     'lama #0046# dan #0047# berumah tangga adalah {lama} menurut penglihatan saya'],
                    ['mereka menjadi suami istri selama {lama} sampai akhirnya bercerai dan saya tahu sendiri',
                     'rumah tangga #0046# dan #0047# bertahan selama {lama} sebagaimana saya saksikan',
                     'sejak menikah sampai bercerai #0046# dan #0047# berumah tangga selama {lama} menurut pengetahuan saya',
                     'yang saya ketahui langsung, perkawinan keduanya berlangsung {lama} sebelum berakhir'])))

PERT.append(Q('q-keadaan-penggugat', 'pp-kebutuhan-penggugat', 130, 'pilihan', 'pokok', 'Apakah #0046# bekerja atau memiliki penghasilan sendiri ?',
              ['Apa pekerjaan #0046# dan berapa penghasilannya ?'], ['0046'], 'pekerjaan dan penghasilan Penggugat',
              jawab('saksi mengetahui pekerjaan dan penghasilan Penggugat',
                    ['pekerjaan #0046# adalah {pekerjaan} dan penghasilannya {penghasilan} menurut yang saya lihat sendiri',
                     'saya mengetahui langsung #0046# bekerja sebagai {pekerjaan} dengan penghasilan {penghasilan}',
                     'sebagaimana saya saksikan #0046# berpekerjaan {pekerjaan} yang menghasilkan {penghasilan}',
                     'sehari-hari #0046# adalah {pekerjaan} dan memperoleh {penghasilan} menurut penglihatan saya'],
                    ['#0046# bekerja sebagai {pekerjaan} dan hasil yang diperolehnya {penghasilan} sebagaimana saya ketahui sendiri',
                     'dari yang saya lihat langsung, mata pencaharian #0046# adalah {pekerjaan} dengan pendapatan {penghasilan}',
                     'saya tahu sendiri #0046# adalah {pekerjaan} yang berpenghasilan {penghasilan}',
                     'pekerjaan tetap #0046# berupa {pekerjaan} dengan hasil {penghasilan} yang saya saksikan'])))

PERT.append(Q('q-madliyah-lalai', 'pp-madliyah', 140, 'tambahan', 'pokok', 'Selama masih menjadi suami istri, apakah #0047# memberikan nafkah kepada #0046# dan sejak kapan tidak memberikannya ?',
              ['Sejak kapan #0047# berhenti memberi nafkah kepada #0046# selama perkawinan ?'], ['0046', '0047'], 'kelalaian Tergugat memberi nafkah selama perkawinan',
              jawab('Tergugat tidak memberi nafkah yang layak selama perkawinan sejak waktu tertentu',
                    ['selama perkawinan #0047# tidak memberikan nafkah yang layak kepada #0046# sejak {sejak} menurut yang saya lihat',
                     'saya melihat sendiri #0047# tidak lagi menafkahi #0046# sejak {sejak} padahal mereka masih suami istri',
                     'sejak {sejak} #0047# tidak memberi nafkah kepada #0046# selama masih berumah tangga sebagaimana saya saksikan',
                     'sepanjang pengetahuan saya #0047# tidak menafkahi #0046# dengan layak mulai {sejak} saat masih menjadi suami istri'],
                    ['#0046# tidak mendapat nafkah yang layak dari #0047# sejak {sejak} walaupun masih berstatus istri dan saya tahu sendiri',
                     'dari yang saya lihat langsung, mulai {sejak} #0047# tidak memenuhi nafkah bagi #0046# selama perkawinan',
                     'sejak {sejak} nafkah dari #0047# untuk #0046# tidak diberikan dengan layak sebagaimana saya ketahui',
                     'saya menyaksikan #0047# tidak menafkahi #0046# dengan pantas sejak {sejak} saat perkawinan masih berjalan']),
              keadaan={'hakDituntut': 'nafkah-madliyah'}))

PERT.append(Q('q-madliyah-jumlah', 'pp-madliyah', 145, 'tambahan', 'akibat', 'Berapa lama #0047# tidak memberi nafkah dan berapa kebutuhan #0046# setiap bulan ?',
              ['Selama berapa lama #0047# tidak memberi nafkah dan berapa kebutuhan bulanan #0046# ?'], ['0046', '0047'], 'lamanya nafkah tidak diberikan dan kebutuhan bulanan Penggugat',
              jawab('saksi menerangkan lamanya nafkah tidak diberikan dan besar kebutuhan bulanan Penggugat',
                    ['#0047# tidak memberi nafkah selama {lama} dan kebutuhan #0046# setiap bulan sekitar {isi} menurut yang saya ketahui',
                     'saya melihat sendiri nafkah itu tidak diberikan selama {lama} sedangkan kebutuhan #0046# tiap bulan sebesar {isi}',
                     'selama {lama} #0046# tidak dinafkahi #0047# dan perlu {isi} setiap bulan sebagaimana saya saksikan',
                     'lamanya #0047# tidak menafkahi adalah {lama} dan biaya hidup #0046# sebulan sekitar {isi} menurut penglihatan saya'],
                    ['sampai {lama} #0046# tidak menerima nafkah dari #0047# dengan kebutuhan sebulan sekitar {isi} dan saya tahu sendiri',
                     'dari yang saya lihat langsung, nafkah tidak diberikan #0047# selama {lama} padahal #0046# memerlukan {isi} setiap bulan',
                     'kebutuhan #0046# sebulan adalah {isi} dan selama {lama} tidak ditanggung #0047# sebagaimana saya ketahui',
                     'saya tahu sendiri bahwa selama {lama} #0047# tidak memberi nafkah dan keperluan #0046# tiap bulan sekitar {isi}']),
              keadaan={'hakDituntut': 'nafkah-madliyah'}))

PERT.append(Q('q-mahar', 'pp-mahar', 150, 'tambahan', 'pokok', 'Apa mahar yang dijanjikan #0047# pada saat menikah dan apakah sudah dibayar seluruhnya ?',
              ['Berupa apa mahar yang dijanjikan #0047# dan apakah sudah dilunasi seluruhnya ?'], ['0046', '0047'], 'mahar pernikahan dan pelunasannya',
              jawab('mahar berupa sesuatu dan belum dibayar seluruhnya',
                    ['mahar pernikahan #0046# dan #0047# berupa {daftar} dan sampai sekarang belum dibayar seluruhnya oleh #0047# menurut yang saya ketahui',
                     'saya hadir saat akad dan mahar yang disebut adalah {daftar} namun belum dilunasi #0047# sampai saat ini',
                     'sebagaimana saya saksikan, mahar untuk #0046# berupa {daftar} dan belum dibayar lunas oleh #0047#',
                     'mahar yang dijanjikan #0047# kepada #0046# adalah {daftar} dan belum dilunasi seluruhnya menurut penglihatan saya'],
                    ['saya mengetahui sendiri mahar #0046# berupa {daftar} yang belum dibayar seluruhnya oleh #0047#',
                     'pada akad nikah mahar disebut {daftar} dan hingga kini belum dilunasi #0047# sebagaimana saya lihat',
                     'mahar yang harus diberikan #0047# kepada #0046# adalah {daftar} dan belum diselesaikan seluruhnya menurut pengetahuan saya',
                     'yang saya saksikan langsung, mahar #0046# berupa {daftar} belum dibayar penuh oleh #0047#']),
              keadaan={'hakDituntut': 'mahar'}))

PERT.append(Q('q-anak-asuh', 'pp-biaya-hadhanah', 160, 'tambahan', 'pokok', 'Siapa yang secara nyata mengasuh anak bernama #8602# sehari-hari ?',
              ['Sehari-hari anak bernama #8602# diasuh dan dirawat oleh siapa ?'], ['0046', '8602'], 'pihak yang secara nyata mengasuh anak',
              jawab('Penggugat yang secara nyata mengasuh anak sehari-hari',
                    ['yang secara nyata mengasuh anak bernama #8602# sehari-hari adalah #0046# dan saya melihatnya sendiri',
                     'saya menyaksikan sendiri #0046# yang mengurus anak bernama #8602# dari hari ke hari',
                     'anak bernama #8602# tinggal bersama #0046# yang merawat dan membesarkannya sebagaimana saya lihat',
                     'sehari-hari #0046# yang mengasuh anak bernama #8602# menurut penglihatan saya'],
                    ['saya tahu langsung bahwa pengasuh nyata anak bernama #8602# adalah #0046#',
                     '#0046# yang menyiapkan makan dan keperluan anak bernama #8602# di rumahnya dan saya melihatnya',
                     'perawatan anak bernama #8602# dari hari ke hari dikerjakan #0046# sebagaimana saya saksikan',
                     'yang membesarkan anak bernama #8602# sehari-hari adalah #0046# di depan mata saya']),
              keadaan={'hakDituntut': 'biaya-hadhanah'}))

PERT.append(Q('q-anak-biaya', 'pp-biaya-hadhanah', 165, 'tambahan', 'akibat', 'Apakah #0047# memberikan biaya untuk anak bernama #8602# setelah perceraian ?',
              ['Apakah setelah bercerai #0047# masih membiayai anak bernama #8602# ?'], ['0047', '8602'], 'biaya anak dari Tergugat setelah perceraian',
              jawab('Tergugat tidak memberikan biaya untuk anak setelah perceraian',
                    ['setelah perceraian #0047# tidak memberikan biaya untuk anak bernama #8602# menurut yang saya lihat',
                     'saya mengetahui sendiri #0047# tidak lagi membiayai anak bernama #8602# sejak bercerai',
                     'sejak berpisah #0047# tidak menyerahkan biaya apa pun bagi anak bernama #8602# sebagaimana saya saksikan',
                     'biaya hidup anak bernama #8602# tidak ditanggung #0047# setelah perceraian menurut penglihatan saya'],
                    ['sesudah bercerai #0047# tidak membiayai anak bernama #8602# dan saya tahu sendiri',
                     'yang saya ketahui langsung, #0047# tidak memberi uang untuk keperluan anak bernama #8602# sejak perceraian',
                     '#0047# tidak ikut menanggung kebutuhan anak bernama #8602# setelah berpisah sebagaimana saya lihat',
                     'saya menyaksikan #0047# tidak mengeluarkan biaya bagi anak bernama #8602# sesudah bercerai']),
              keadaan={'hakDituntut': 'biaya-hadhanah'}))

# verstek: keberadaan Tergugat (disalin dari katalog nafkah-anak, lolos pemeriksa)
PERT.append([x for x in dasar['pertanyaan'] if x['id'] == 'q-keberadaan-ayah'][0].copy())
PERT[-1]['id'] = 'q-keberadaan-tergugat'
PERT[-1]['pokok'] = 'pp-kemampuan-tergugat'
PERT[-1]['urutan'] = 190
PERT[-1]['hal'] = 'tempat tinggal dan pekerjaan #0047# sekarang'

# pihak Tergugat: bantahan
PERT.append(Q('q-t-sudah-bayar', 'pp-bantahan-tergugat', 200, 'tambahan', 'pokok', 'Apakah #0047# pernah memberikan sesuatu kepada #0046# setelah perceraian dan apa saja ?',
              ['Apa yang pernah #0047# serahkan kepada #0046# sesudah mereka bercerai ?'], ['0046', '0047'], 'pemberian Tergugat kepada Penggugat setelah perceraian',
              jawab('saksi menerangkan pemberian Tergugat kepada Penggugat setelah perceraian',
                    ['setelah perceraian #0047# pernah memberikan {daftar} kepada #0046# menurut yang saya lihat sendiri',
                     'saya menyaksikan #0047# menyerahkan {daftar} kepada #0046# sesudah mereka bercerai',
                     'sesudah berpisah #0047# pernah memberi {daftar} untuk #0046# sebagaimana saya ketahui langsung',
                     'pemberian #0047# kepada #0046# setelah bercerai berupa {daftar} dan saya melihatnya'],
                    ['#0047# pernah menyerahkan {daftar} kepada #0046# sesudah perceraian dan saya tahu sendiri',
                     'dari yang saya lihat langsung, #0047# memberi {daftar} kepada #0046# setelah mereka berpisah',
                     'saya hadir ketika #0047# memberikan {daftar} kepada #0046# usai perceraian',
                     'sesudah resmi bercerai #0046# pernah menerima {daftar} dari #0047# sebagaimana saya saksikan']),
              pihak=('T',)))

PERT.append(Q('q-t-nusyuz', 'pp-bantahan-tergugat', 205, 'tambahan', 'pokok', 'Apakah saksi mengetahui #0046# pernah berbuat nusyuz terhadap #0047# selama perkawinan ?',
              ['Apakah selama perkawinan #0046# pernah membangkang atau meninggalkan #0047# tanpa izin ?'], ['0046', '0047'], 'dugaan nusyuz Penggugat menurut Tergugat',
              jawab('saksi Tergugat menerangkan peristiwa yang disebut sebagai nusyuz Penggugat',
                    ['selama perkawinan #0046# pernah {peristiwa} tanpa izin #0047# menurut yang saya lihat sendiri',
                     'saya menyaksikan sendiri #0046# pernah {peristiwa} tanpa sepengetahuan #0047#',
                     'sebagaimana saya ketahui langsung, #0046# pernah {peristiwa} dengan tidak meminta izin #0047#',
                     'pernah terjadi #0046# {peristiwa} tanpa izin #0047# menurut penglihatan saya'],
                    ['#0046# pernah {peristiwa} tanpa seizin #0047# dan saya tahu sendiri',
                     'dari yang saya lihat langsung, #0046# pernah {peristiwa} tanpa pamit kepada #0047#',
                     'saya hadir ketika #0046# {peristiwa} tanpa izin dari #0047# selama perkawinan',
                     'kejadian #0046# {peristiwa} tanpa persetujuan #0047# pernah saya saksikan']),
              pihak=('T',)))

PERT.append(Q('q-t-penghasilan', 'pp-bantahan-tergugat', 210, 'tambahan', 'pokok', 'Bagaimana penghasilan #0047# dan apa saja tanggungan #0047# sekarang ?',
              ['Berapa penghasilan #0047# dan siapa saja yang harus ditanggung #0047# ?'], ['0047'], 'penghasilan dan tanggungan Tergugat',
              jawab('saksi Tergugat menerangkan penghasilan dan tanggungan Tergugat',
                    ['penghasilan #0047# sebesar {penghasilan} dan tanggungannya meliputi {daftar} menurut yang saya lihat sendiri',
                     'saya mengetahui langsung #0047# berpenghasilan {penghasilan} dengan tanggungan berupa {daftar}',
                     'sebagaimana saya saksikan #0047# memperoleh {penghasilan} dan menanggung {daftar}',
                     'pendapatan #0047# adalah {penghasilan} sedangkan yang ditanggungnya adalah {daftar} menurut penglihatan saya'],
                    ['#0047# berpenghasilan {penghasilan} dan harus menanggung {daftar} sebagaimana saya ketahui sendiri',
                     'dari yang saya lihat langsung, hasil kerja #0047# sebesar {penghasilan} dan tanggungannya {daftar}',
                     'saya tahu sendiri #0047# memperoleh {penghasilan} serta memikul tanggungan {daftar}',
                     'penghasilan #0047# yang saya ketahui sebesar {penghasilan} dengan tanggungan {daftar}']),
              pihak=('T',)))

PERT.append([x for x in dasar['pertanyaan'] if x['id'] == 'q-penutup'][0])

CATATAN = [
    'Keterangan saksi harus menyebut sebab pengetahuannya; keterangan seorang saksi saja tanpa alat bukti lain tidak cukup.',
    'Keluarga sedarah dan semenda garis lurus serta suami atau istri salah satu pihak (juga setelah bercerai) pada dasarnya tidak dapat didengar sebagai saksi; penilaian ada pada hakim.',
    'Gugatan ini berdiri sendiri sesudah perceraian: pastikan hak yang dituntut belum diputus dalam perkara perceraian (nebis in idem) dan Penggugat tidak terbukti nusyuz.',
    'Pilih "Cara perkawinan putus", "Keadaan dukhul" dan "Hak yang dituntut" pada form agar butir yang sesuai (nafkah iddah, maskan-kiswah, mut\'ah, nafkah madliyah, mahar, biaya hadhanah) ikut diajukan.',
    'Hakim menggali fakta kemampuan ekonomi Tergugat dan kebutuhan dasar hidup Penggugat (SEMA 3/2018); besar masing-masing hak adalah pilihan hakim, bukan isian saksi.',
    'Biaya hadhanah/nafkah anak yang berdiri sendiri memakai katalog nafkah anak; hak asuh memakai katalog penguasaan anak.',
]

KATALOG = dict(
    skema='saksi-katalog/1', kunci='hak-bekas-istri', judul='Hak bekas istri dan kewajiban bekas suami', versi=1, penulis='W3A-D', tahap=2, contoh=False,
    syarat=dict(jenisPerkaraId=['351']), pihak=dict(pengaju='#0046#', lawan='#0047#'),
    blangkoBas=[
        dict(folder='1f Hak Bekas Istri - BAS', berkas='BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P', variabelSaksi=['2021', '2022', '2031', '6124', '8932'],
             catatan='saksi P lewat variabel tanya_jawab (BAS memakai 5058/5059/5060 yang berbagi data); [6a] 3 saksi, [6b] 4 saksi, [6c] 5 saksi sama'),
        dict(folder='1f Hak Bekas Istri - BAS', berkas='BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T', variabelSaksi=['2023', '2024', '2032', '8942'],
             catatan='saksi T (BAS memakai 6120/6121/6122 dan 8921/8941); [7a] 3 saksi, [7b] 4 saksi'),
        dict(folder='1f Hak Bekas Istri - BAS', berkas='BAS ALUR 65 Hak Bekas Istri - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek', variabelSaksi=['2021', '2022'],
             catatan='verstek: hanya saksi P (2 saksi); varian Verstek Kabul Sebagian untuk petitum sebagian'),
    ],
    dasarHukum=DH, keadaan=KEADAAN, pokokPembuktian=POKOK, pertanyaan=PERT, jawabanUmum=dasar['jawabanUmum'], catatanPetugas=CATATAN,
)


def tulis():
    # dasarHukum yang tidak dirujuk pokok tetap boleh; pastikan semua rujukan pokok ada
    for p in POKOK:
        for d in p.get('dasarHukum', []):
            assert d in DH_ID, (p['id'], d)
    ids = [q['id'] for q in PERT]
    assert len(ids) == len(set(ids)), 'id kembar'
    out = os.path.join(SK, 'hak-bekas-istri.json')
    teks = json.dumps(KATALOG, ensure_ascii=False, indent=1).replace('D:/aleta-dev/kerja/referensi', 'folder referensi lokal (kerja/referensi)')
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(teks + '\n')
    return out, len(PERT)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    out, n = tulis()
    print('katalog ditulis:', out, '| butir:', n)
