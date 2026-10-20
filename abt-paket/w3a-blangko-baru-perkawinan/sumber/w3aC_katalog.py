# -*- coding: utf-8 -*-
"""Pembangkit katalog saksi jenis 345 KELALAIAN KEWAJIBAN SUAMI / ISTRI (agen W3a-C, 21 Okt 2026).

Menulis dua berkas (skema saksi-katalog/1):
  ekstensi-sipp/saksi-katalog/kelalaian-kewajiban.json            katalog utama (saksi Penggugat, juga saksi Tergugat bila butir berlaku untuk '*')
  ekstensi-sipp/saksi-katalog/kelalaian-kewajiban-tergugat.json   katalog TAMBAHAN: butir pengganti bila saksi diajukan Tergugat (bantahan)
Jawaban saksi dalam kalimat orang pertama; TANPA koma (ABT memakan "ya, "); tanpa nama orang; sebutan pihak dengan penanda #0046# / #0047#.
Kata peran suami atau istri tertulis langsung pada butir menurut keadaan `kedudukanPenggugat` (istri = Tergugat suami; suami = Tergugat istri).
Jalankan: python sumber/w3aC_katalog.py  (idempoten).  Periksa: node abt-paket/u4-dk-wali-perwalian/alat/periksa_katalog.cjs kelalaian-kewajiban.json kelalaian-kewajiban-tergugat.json
"""
import json
import os

AKAR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
FOLDER = os.path.join(AKAR, 'ekstensi-sipp', 'saksi-katalog')
CONTOH = os.path.join(FOLDER, 'nafkah-anak.json')          # sumber jawabanUmum baku dan dasar hukum saksi umum
LAMA = json.load(open(CONTOH, encoding='utf-8'))

ISTRI = {'kedudukanPenggugat': 'istri'}
SUAMI = {'kedudukanPenggugat': 'suami'}


def M(maksud, saksi1, saksi2, **ekstra):
    d = dict(maksud=maksud, saksi1=list(saksi1), saksi2=list(saksi2))
    d.update(ekstra)
    return d


def Q(id_, pokok, urutan, tingkat, kelompok, teks, melihat, hal='', pihak=('*',), keadaan=None, varian=(), variabel=('0046', '0047'), berbeda=None, tb=None, menggantikan=None, **lain):
    q = {'id': 'q-' + id_, 'pokok': pokok, 'urutan': urutan, 'tingkat': tingkat, 'kelompok': kelompok, 'pihakSaksi': list(pihak), 'keadaan': keadaan or {}, 'teks': teks}
    if varian:
        q['teksVarian'] = list(varian)
    q['variabelAbt'] = list(variabel)
    if hal:
        q['hal'] = hal
    if menggantikan:
        q['menggantikan'] = menggantikan
    if tb is None:
        tb = [] if kelompok not in ('hubungan', 'penutup') else []
        if berbeda is None and kelompok not in ('hubungan', 'penutup'):
            tb = ['berbeda']
    q['tidakBerlaku'] = tb
    q['jawaban'] = {'melihat': melihat}
    if berbeda is not None:
        q['jawaban']['berbeda'] = berbeda
    q.update(lain)
    return q


# ---------------------------------------------------------------------------------------------------------------------
# Dasar hukum
# ---------------------------------------------------------------------------------------------------------------------
def dasar_lama(*ids):
    kamus = {d['id']: d for d in LAMA['dasarHukum']}
    return [kamus[i] for i in ids]


SUMBER_UU1 = 'naskah UU 1/1974 tentang Perkawinan, salinan peraturan.bpk.go.id (referensi/_unduhan/uu1-1974/uu1-1974-bpk.txt), dicocokkan 21 Okt 2026 (W3a-C)'
SUMBER_KHI = ('KHI lampiran Inpres 1/1991, terbitan Direktorat Pembinaan Badan Peradilan Agama Islam Depag (OCR khi.txt) dan pasal.id (khi-pasalid.json); '
              'Pasal 80 dari OCR naskah Depag karena tidak ada di pasal.id; dicocokkan 21 Okt 2026 (W3a-C)')
DASAR = dasar_lama('dh-sebab-pengetahuan', 'dh-larangan-saksi', 'dh-unus-testis', 'dh-de-auditu', 'dh-kesesuaian-saksi') + [
    dict(id='dh-uu1-34', rujukan='Pasal 34 ayat (1), (2) dan (3) UU 1/1974 tentang Perkawinan', status='terverifikasi', sumber=SUMBER_UU1,
         uraian='suami wajib melindungi istri dan memberi keperluan hidup berumah tangga sesuai kemampuannya; istri wajib mengatur urusan rumah tangga; suami atau istri yang melalaikan kewajibannya dapat digugat ke Pengadilan'),
    dict(id='dh-uu1-30-33', rujukan='Pasal 30, 31, 32 dan 33 UU 1/1974 tentang Perkawinan', status='terverifikasi', sumber=SUMBER_UU1,
         uraian='suami istri menegakkan rumah tangga; hak dan kedudukan seimbang; tempat kediaman tetap yang ditentukan bersama; saling cinta-mencintai hormat-menghormati setia dan membantu lahir batin'),
    dict(id='dh-khi-77-78', rujukan='Pasal 77 dan Pasal 78 Kompilasi Hukum Islam', status='terverifikasi', sumber=SUMBER_KHI,
         uraian='kewajiban bersama suami istri dan tempat kediaman tetap; Pasal 77 ayat (5): suami atau istri yang melalaikan kewajibannya dapat digugat ke Pengadilan Agama'),
    dict(id='dh-khi-80-81', rujukan='Pasal 80 ayat (2) dan (4)-(7) serta Pasal 81 Kompilasi Hukum Islam', status='terverifikasi', sumber=SUMBER_KHI,
         uraian='kewajiban suami: melindungi dan, sesuai penghasilannya, menanggung nafkah kiswah tempat kediaman serta biaya rumah tangga perawatan dan pengobatan; berlaku sesudah tamkin sempurna; dapat dibebaskan istri; gugur bila istri nusyuz'),
    dict(id='dh-khi-83-84', rujukan='Pasal 83 dan Pasal 84 Kompilasi Hukum Islam', status='terverifikasi', sumber=SUMBER_KHI,
         uraian='kewajiban utama istri berbakti lahir batin dan mengatur keperluan rumah tangga; istri nusyuz bila tanpa alasan sah tidak melaksanakannya; nusyuz harus berdasarkan bukti yang sah'),
    dict(id='dh-penjelasan-49-7', rujukan='Penjelasan Pasal 49 huruf a angka 7 UU 7/1989 sebagaimana diubah UU 3/2006 dan UU 50/2009', status='terverifikasi',
         sumber='naskah UU 3/2006 (referensi/_unduhan/ekstra/uu3-2006.txt baris 1205-1290), dicocokkan 21 Okt 2026 (W3a-C)',
         uraian='gugatan kelalaian atas kewajiban suami dan istri adalah kewenangan absolut Pengadilan Agama'),
] + dasar_lama('dh-sema-3-2018-b')

POKOK = [
    dict(id='pp-hubungan-saksi', judul='Hubungan saksi dengan para pihak', uraian='saksi menerangkan siapa dirinya dan bagaimana ia mengenal para pihak (sebab pengetahuan)', wajib=True,
         dasarHukum=['dh-sebab-pengetahuan', 'dh-larangan-saksi', 'dh-unus-testis']),
    dict(id='pp-perkawinan', judul='Perkawinan sah yang masih berlangsung', uraian='Penggugat dan Tergugat terikat perkawinan yang sah dan belum putus; gugatan ini bukan gugatan cerai', wajib=True,
         dasarHukum=['dh-uu1-34', 'dh-khi-77-78', 'dh-penjelasan-49-7']),
    dict(id='pp-kewajiban-suami', judul='Kewajiban suami yang dilalaikan', uraian='nafkah lahir kiswah tempat kediaman dan biaya rumah tangga perawatan pengobatan yang tidak dipenuhi suami', wajib=True,
         dasarHukum=['dh-uu1-34', 'dh-khi-80-81'], keadaan=dict(kedudukanPenggugat='istri')),
    dict(id='pp-kewajiban-istri', judul='Kewajiban istri yang dilalaikan', uraian='mengatur urusan rumah tangga berbakti lahir batin dan tinggal di tempat kediaman bersama yang tidak dipenuhi istri', wajib=True,
         dasarHukum=['dh-uu1-34', 'dh-khi-83-84'], keadaan=dict(kedudukanPenggugat='suami')),
    dict(id='pp-waktu-kelalaian', judul='Sejak kapan dan berapa lama kelalaian', uraian='waktu mulai dan lamanya kewajiban tidak dipenuhi', wajib=True, dasarHukum=['dh-sebab-pengetahuan']),
    dict(id='pp-kemampuan', judul='Kemampuan Tergugat dan kebutuhan Penggugat', uraian='pekerjaan penghasilan dan harta Tergugat serta kebutuhan dasar hidup Penggugat (suami wajib sesuai kemampuannya)', wajib=False,
         dasarHukum=['dh-uu1-34', 'dh-khi-80-81', 'dh-sema-3-2018-b']),
    dict(id='pp-alasan-sah', judul='Alasan sah, pembebasan atau nusyuz', uraian='ada atau tidaknya alasan sah Tergugat tidak memenuhi kewajiban: tidak mampu, dibebaskan, atau pasangan nusyuz', wajib=False,
         dasarHukum=['dh-khi-80-81', 'dh-khi-83-84']),
    dict(id='pp-upaya', judul='Upaya menagih dan mendamaikan', uraian='Penggugat pernah meminta pemenuhan kewajiban dan keluarga pernah mendamaikan', wajib=False, dasarHukum=['dh-sebab-pengetahuan']),
    dict(id='pp-akibat', judul='Akibat kelalaian bagi rumah tangga', uraian='siapa yang menanggung kebutuhan Penggugat dan keadaan anak selama kewajiban tidak dipenuhi', wajib=False, dasarHukum=['dh-uu1-30-33', 'dh-khi-77-78']),
]

KEADAAN = {
    'kehadiran': dict(sumber='otomatis', nilai=['verstek', 'kontradiktoir', 't-tidak-hadir-setelah-mediasi'], label='Kehadiran Tergugat', bawaan='kontradiktoir'),
    'kedudukanPenggugat': dict(sumber='borang', nilai=['istri', 'suami'], label='Kedudukan Penggugat', bawaan='istri',
                               labelNilai={'istri': 'Istri (Tergugat adalah suami)', 'suami': 'Suami (Tergugat adalah istri)'}),
    'kelalaian': dict(sumber='borang', nilai=['nafkah', 'tempat-kediaman', 'kiswah-biaya', 'meninggalkan', 'rumah-tangga', 'berbakti'], label='Kewajiban yang didalilkan dilalaikan', bawaan=['nafkah'], jamak=True,
                      labelNilai={'nafkah': 'Nafkah lahir', 'tempat-kediaman': 'Tempat kediaman', 'kiswah-biaya': 'Kiswah dan biaya rumah tangga perawatan pengobatan',
                                  'meninggalkan': 'Meninggalkan pasangan atau tidak serumah', 'rumah-tangga': 'Mengatur urusan rumah tangga', 'berbakti': 'Berbakti lahir dan batin'}),
    'tempatTinggal': dict(sumber='borang', nilai=['masih-serumah', 'berpisah-rumah'], label='Keadaan tempat tinggal sekarang', bawaan='berpisah-rumah',
                          labelNilai={'masih-serumah': 'Masih tinggal serumah', 'berpisah-rumah': 'Sudah tidak tinggal serumah'}),
    'nafkahLampau': dict(sumber='borang', nilai=['tidak', 'ya'], label='Nafkah lampau (madliyah) dituntut', bawaan='tidak'),
    'kemampuanTergugat': dict(sumber='borang', nilai=['mampu', 'terbatas'], label='Kemampuan ekonomi Tergugat menurut gugatan', bawaan='mampu',
                              labelNilai={'mampu': 'Mampu', 'terbatas': 'Terbatas'}),
    'dalilNusyuz': dict(sumber='borang', nilai=['tidak', 'ya'], label='Ada dalil nusyuz atau alasan sah dari Tergugat', bawaan='tidak'),
}

# ---------------------------------------------------------------------------------------------------------------------
# Butir
# ---------------------------------------------------------------------------------------------------------------------
def butir():
    q = []
    lama = {x['id']: x for x in LAMA['pertanyaan']}
    kenal = dict(lama['q-kenal'])
    kenal['pokok'] = 'pp-hubungan-saksi'
    q.append(kenal)

    q.append(Q('perkawinan-sah', 'pp-perkawinan', 20, 'inti', 'hubungan', 'Apakah saksi tahu bahwa #0046# dan #0047# adalah suami istri yang sah ?',
               M('saksi menerangkan bahwa Penggugat dan Tergugat menikah secara sah dan tercatat',
                 ['saya tahu #0046# dan #0047# adalah suami istri yang menikah secara sah menurut agama dan tercatat di Kantor Urusan Agama',
                  'saya mengetahui sendiri bahwa #0046# dan #0047# menikah secara sah dan telah dicatat oleh Kantor Urusan Agama',
                  '#0046# dan #0047# adalah pasangan suami istri yang sah karena pernikahan mereka dilangsungkan menurut agama dan tercatat resmi',
                  'yang saya ketahui langsung #0046# dan #0047# terikat perkawinan yang sah dan memiliki buku nikah'],
                 ['saya mengenal mereka sebagai suami istri yang sah sejak menikah dan pernikahannya dicatat di Kantor Urusan Agama',
                  'pernikahan #0046# dan #0047# sah menurut agama dan dicatatkan resmi sebagaimana saya ketahui sendiri',
                  'setahu saya langsung #0046# dan #0047# resmi menjadi suami istri melalui akad nikah yang sah dan tercatat',
                  'saya melihat sendiri keduanya hidup sebagai suami istri yang sah dengan pernikahan yang tercatat resmi']),
               hal='keabsahan perkawinan #0046# dan #0047#', varian=['Apakah saksi mengetahui #0046# dan #0047# terikat perkawinan yang sah ?']))

    q.append(Q('masih-terikat', 'pp-perkawinan', 30, 'inti', 'pokok', 'Apakah #0046# dan #0047# sampai sekarang masih suami istri dan belum pernah bercerai ?',
               M('saksi menerangkan perkawinan masih berlangsung dan tidak ada perceraian',
                 ['sampai sekarang #0046# dan #0047# masih berstatus suami istri dan belum pernah bercerai menurut yang saya ketahui langsung',
                  'saya tahu sendiri bahwa #0046# dan #0047# belum pernah bercerai dan perkawinan mereka masih berlangsung',
                  'perkawinan #0046# dan #0047# belum putus dan keduanya belum pernah mengajukan cerai sepengetahuan saya',
                  'hingga hari ini #0046# dan #0047# tetap suami istri karena tidak pernah ada perceraian yang saya ketahui'],
                 ['saya mengetahui langsung bahwa mereka belum bercerai dan masih terikat sebagai suami istri',
                  'tidak pernah ada perceraian antara #0046# dan #0047# sampai sekarang sebagaimana saya saksikan sendiri',
                  'status #0046# dan #0047# sampai saat ini masih suami istri dan hal itu saya ketahui sendiri',
                  'sejauh yang saya lihat sendiri perkawinan #0046# dan #0047# masih utuh dan belum putus']),
               hal='status perkawinan #0046# dan #0047# sampai sekarang', varian=['Sampai sekarang apakah #0046# dan #0047# masih terikat perkawinan ?']))

    q.append(Q('tinggal-sekarang', 'pp-perkawinan', 40, 'inti', 'pokok', 'Di mana #0046# dan #0047# tinggal sekarang, apakah masih serumah ?',
               [M('saksi menerangkan para pihak masih tinggal serumah',
                  ['sampai sekarang #0046# dan #0047# masih tinggal serumah di satu tempat kediaman yang saya ketahui sendiri',
                   'saya melihat sendiri #0046# dan #0047# masih satu rumah dan belum berpisah tempat tinggal',
                   'keduanya masih berada dalam satu rumah sebagaimana saya saksikan langsung',
                   'hingga saat ini #0046# dan #0047# belum pisah rumah menurut penglihatan saya'],
                  ['yang saya ketahui sendiri mereka masih menempati rumah yang sama sampai sekarang',
                   'saya sering melihat #0046# dan #0047# berada di rumah yang sama sehingga mereka belum pisah tempat tinggal',
                   'tempat tinggal #0046# dan #0047# masih satu atap sebagaimana saya lihat sendiri',
                   'mereka belum berpisah rumah dan saya menyaksikannya sendiri'], keadaan=dict(tempatTinggal='masih-serumah')),
                M('saksi menerangkan para pihak sudah tidak tinggal serumah sejak waktu tertentu',
                  ['sejak {sejak} #0046# dan #0047# sudah tidak tinggal serumah lagi sebagaimana saya ketahui sendiri',
                   'saya melihat sendiri bahwa mulai {sejak} #0046# dan #0047# berpisah tempat tinggal',
                   'keduanya tidak lagi satu rumah sejak {sejak} menurut penglihatan saya langsung',
                   'pisah rumah antara #0046# dan #0047# terjadi sejak {sejak} dan hal itu saya saksikan sendiri'],
                  ['yang saya ketahui sendiri mereka tidak serumah lagi mulai {sejak}',
                   'sejak {sejak} #0046# dan #0047# tidak berada di rumah yang sama sebagaimana saya lihat sendiri',
                   'saya menyaksikan langsung mereka berpisah tempat tinggal sejak {sejak}',
                   'tempat tinggal #0046# dan #0047# sudah terpisah mulai {sejak} menurut yang saya ketahui langsung'], keadaan=dict(tempatTinggal='berpisah-rumah'))],
               hal='tempat tinggal #0046# dan #0047# sekarang', varian=['Sekarang #0046# dan #0047# tinggal di mana, apakah masih satu rumah ?'], tb=['berbeda']))

    # ---- kelalaian oleh SUAMI (Penggugat istri) ----
    q.append(Q('nafkah-diberikan', 'pp-kewajiban-suami', 50, 'inti', 'pokok', 'Apakah #0047# memberikan nafkah lahir kepada #0046# selama ini ?',
               M('saksi menerangkan Tergugat tidak memberikan nafkah lahir kepada Penggugat',
                 ['saya melihat sendiri #0047# tidak memberikan nafkah lahir kepada #0046#',
                  'sepengetahuan saya yang saya saksikan langsung #0047# tidak menafkahi #0046#',
                  '#0047# tidak pernah menyerahkan uang belanja kepada #0046# sebagaimana saya lihat sendiri',
                  'kebutuhan sehari-hari #0046# tidak dipenuhi oleh #0047# menurut yang saya saksikan'],
                 ['saya mengetahui langsung bahwa #0047# tidak memberi nafkah kepada #0046#',
                  'yang saya lihat sendiri #0047# tidak lagi menafkahi #0046#',
                  'saya menyaksikan sendiri #0046# tidak menerima nafkah dari #0047#',
                  'uang untuk kebutuhan #0046# tidak diberikan oleh #0047# sebagaimana saya ketahui sendiri'],
                 keadaan=dict(kelalaian='nafkah')),
               hal='nafkah lahir yang diberikan #0047# kepada #0046#', keadaan=dict(kedudukanPenggugat='istri', kelalaian='nafkah'),
               varian=['Apakah #0047# menafkahi #0046# secara lahir ?'],
               berbeda=M('versi A: Tergugat sama sekali tidak memberi nafkah; versi B: Tergugat masih memberi nafkah walau tidak teratur - berselisih pada JUMLAH NAFKAH',
                         ['#0047# sama sekali tidak memberi nafkah kepada #0046# menurut penglihatan saya',
                          'saya lihat sendiri tidak ada nafkah yang diberikan #0047# kepada #0046#',
                          '#0046# tidak pernah menerima nafkah dari #0047# sebagaimana saya saksikan',
                          'tidak satu pun kebutuhan #0046# dipenuhi #0047# menurut yang saya ketahui langsung'],
                         ['#0047# masih memberi nafkah kepada #0046# meskipun jumlahnya kecil dan tidak teratur menurut penglihatan saya',
                          'saya lihat sendiri #0047# sesekali menyerahkan uang untuk #0046#',
                          '#0046# kadang masih menerima nafkah dari #0047# sebagaimana saya saksikan',
                          'sebagian kebutuhan #0046# masih dipenuhi #0047# menurut yang saya ketahui langsung'], bedaPada='jumlah')))

    q.append(Q('sejak-kapan', 'pp-waktu-kelalaian', 60, 'inti', 'pokok', 'Sejak kapan #0047# tidak lagi melaksanakan kewajibannya terhadap #0046# ?',
               M('saksi menerangkan sejak kapan Tergugat tidak melaksanakan kewajibannya',
                 ['saya melihat sendiri bahwa sejak {sejak} #0047# tidak lagi melaksanakan kewajibannya terhadap #0046#',
                  'mulai {sejak} #0047# tidak memenuhi kewajibannya kepada #0046# sebagaimana saya saksikan langsung',
                  'kelalaian #0047# terhadap #0046# dimulai sejak {sejak} dan hal itu saya ketahui sendiri',
                  'sejak {sejak} kewajiban #0047# kepada #0046# tidak dijalankan menurut penglihatan saya'],
                 ['yang saya ketahui sendiri #0047# berhenti memenuhi kewajibannya kepada #0046# mulai {sejak}',
                  'saya menyaksikan langsung sejak {sejak} #0047# tidak lagi menjalankan kewajibannya terhadap #0046#',
                  'sejak {sejak} #0046# tidak lagi mendapat pemenuhan kewajiban dari #0047# sebagaimana saya lihat sendiri',
                  'pemenuhan kewajiban oleh #0047# kepada #0046# terhenti sejak {sejak} menurut yang saya ketahui langsung'],),
               hal='waktu #0047# mulai tidak melaksanakan kewajibannya',
               varian=['Mulai kapan #0047# berhenti memenuhi kewajibannya kepada #0046# ?'],
               berbeda=M('versi A: kelalaian dimulai awal; versi B: kelalaian dimulai belakangan - berselisih pada WAKTU',
                         ['kelalaian itu sudah dimulai sejak {sejak} menurut penglihatan saya',
                          'saya lihat sendiri #0047# sudah lalai sejak {sejak}',
                          'sejak {sejak} #0047# sudah tidak memenuhi kewajibannya sebagaimana saya saksikan',
                          'awal kelalaian #0047# adalah {sejak} menurut yang saya ketahui langsung'],
                         ['kelalaian itu baru dimulai belakangan ini menurut penglihatan saya dan bukan sejak {sejak}',
                          'saya lihat sendiri #0047# baru lalai belakangan dan bukan sejak {sejak}',
                          'barulah belakangan #0047# tidak memenuhi kewajibannya dan bukan sejak {sejak} sebagaimana saya saksikan',
                          'awal kelalaian #0047# bukan {sejak} melainkan lebih belakangan menurut yang saya ketahui langsung'], bedaPada='waktu')))

    q.append(Q('tempat-kediaman', 'pp-kewajiban-suami', 70, 'inti', 'pokok', 'Apakah #0047# menyediakan tempat kediaman yang layak bagi #0046# ?',
               M('saksi menerangkan Tergugat tidak menyediakan tempat kediaman yang layak bagi Penggugat',
                 ['saya melihat sendiri #0047# tidak menyediakan tempat kediaman yang layak bagi #0046#',
                  'tempat tinggal #0046# bukan disediakan oleh #0047# sebagaimana saya saksikan langsung',
                  '#0047# tidak menyiapkan rumah untuk ditempati #0046# menurut penglihatan saya',
                  'saya tahu sendiri #0046# tinggal di tempat yang tidak disediakan #0047#'],
                 ['yang saya ketahui langsung #0047# tidak menyediakan rumah yang layak untuk #0046#',
                  'saya menyaksikan sendiri #0046# menumpang di tempat lain karena #0047# tidak menyediakan tempat tinggal',
                  'tempat kediaman bagi #0046# tidak disiapkan #0047# sebagaimana saya lihat sendiri',
                  'saya lihat langsung #0046# harus mencari tempat tinggal sendiri tanpa disediakan #0047#'],
                 keadaan=dict(kelalaian='tempat-kediaman')),
               hal='tempat kediaman bagi #0046#', keadaan=dict(kedudukanPenggugat='istri', kelalaian='tempat-kediaman'),
               varian=['Apakah #0047# yang menyediakan tempat tinggal bagi #0046# ?'],
               berbeda=M('versi A: Tergugat tidak menyediakan tempat tinggal; versi B: Tergugat menyediakan tempat tinggal - berselisih pada PERISTIWA',
                         ['#0047# tidak menyediakan tempat tinggal bagi #0046# menurut penglihatan saya',
                          'saya lihat sendiri tidak ada rumah yang disiapkan #0047# untuk #0046#',
                          'tempat tinggal #0046# bukan disediakan #0047# sebagaimana saya saksikan',
                          '#0047# tidak menyiapkan tempat kediaman sama sekali menurut yang saya ketahui langsung'],
                         ['#0047# menyediakan tempat tinggal bagi #0046# menurut penglihatan saya',
                          'saya lihat sendiri rumah yang ditempati #0046# disiapkan oleh #0047#',
                          'tempat tinggal #0046# disediakan #0047# sebagaimana saya saksikan',
                          '#0047# menyiapkan tempat kediaman untuk #0046# menurut yang saya ketahui langsung'], bedaPada='peristiwa')))

    q.append(Q('kiswah-biaya', 'pp-kewajiban-suami', 80, 'pilihan', 'pokok', 'Apakah #0047# memenuhi kebutuhan pakaian dan biaya berobat #0046# ?',
               M('saksi menerangkan Tergugat tidak memenuhi pakaian dan biaya berobat Penggugat',
                 ['saya melihat sendiri #0047# tidak membelikan pakaian dan tidak membiayai pengobatan #0046#',
                  'kebutuhan pakaian dan biaya berobat #0046# tidak ditanggung #0047# sebagaimana saya saksikan langsung',
                  '#0046# harus mengurus sendiri pakaian dan biaya berobat karena #0047# tidak membantu menurut penglihatan saya',
                  'saya tahu sendiri bahwa pakaian dan biaya pengobatan #0046# tidak dipenuhi oleh #0047#'],
                 ['yang saya ketahui langsung #0047# tidak menanggung pakaian maupun biaya berobat #0046#',
                  'saya menyaksikan sendiri #0046# membeli pakaian dan berobat dengan uangnya sendiri tanpa bantuan #0047#',
                  'biaya berobat dan pakaian #0046# bukan dipikul oleh #0047# sebagaimana saya lihat sendiri',
                  'saya lihat langsung bahwa #0047# tidak memenuhi kebutuhan sandang dan pengobatan #0046#'],
                 keadaan=dict(kelalaian='kiswah-biaya')),
               hal='pakaian dan biaya berobat #0046#', keadaan=dict(kedudukanPenggugat='istri', kelalaian='kiswah-biaya'),
               varian=['Apakah #0047# yang menanggung pakaian dan biaya berobat #0046# ?']))

    q.append(Q('meninggalkan-istri', 'pp-kewajiban-suami', 90, 'pilihan', 'pokok', 'Apakah #0047# pernah pergi meninggalkan #0046#, dan ke mana ?',
               M('saksi menerangkan Tergugat pergi meninggalkan Penggugat',
                 ['saya melihat sendiri #0047# pergi meninggalkan #0046# tanpa memberi nafkah dan tanpa kabar',
                  '#0047# meninggalkan rumah dan #0046# sebagaimana saya saksikan langsung',
                  'saya tahu sendiri #0047# pergi dari tempat tinggal bersama dan tidak mengurus #0046# lagi',
                  'menurut penglihatan saya #0047# pergi begitu saja dan membiarkan #0046#'],
                 ['yang saya ketahui langsung #0047# meninggalkan #0046# dan tidak pernah memberi kabar',
                  'saya menyaksikan sendiri #0047# keluar dari rumah dan tidak kembali menemui #0046#',
                  'saya lihat sendiri #0047# pergi dan #0046# ditinggalkan seorang diri',
                  '#0047# tidak lagi berada bersama #0046# karena pergi sebagaimana saya ketahui sendiri'],
                 keadaan=dict(kelalaian='meninggalkan')),
               hal='kepergian #0047# meninggalkan #0046#', keadaan=dict(kedudukanPenggugat='istri', kelalaian='meninggalkan'),
               varian=['Apakah #0047# meninggalkan #0046#, dan sudah berapa lama ?'],
               berbeda=M('versi A: Tergugat meninggalkan Penggugat; versi B: Penggugat yang pergi dari rumah - berselisih pada PELAKU',
                         ['#0047# yang pergi meninggalkan rumah menurut penglihatan saya',
                          'saya lihat sendiri #0047# keluar dari rumah dan meninggalkan #0046#',
                          'yang pergi adalah #0047# sebagaimana saya saksikan',
                          '#0046# ditinggalkan oleh #0047# menurut yang saya ketahui langsung'],
                         ['#0046# yang pergi meninggalkan rumah menurut penglihatan saya',
                          'saya lihat sendiri #0046# keluar dari rumah dan meninggalkan #0047#',
                          'yang pergi adalah #0046# sebagaimana saya saksikan',
                          '#0047# ditinggalkan oleh #0046# menurut yang saya ketahui langsung'], bedaPada='pelaku')))

    # ---- kelalaian oleh ISTRI (Penggugat suami) ----
    q.append(Q('rumah-tangga-istri', 'pp-kewajiban-istri', 100, 'inti', 'pokok', 'Apakah #0047# mengurus dan mengatur rumah tangga dengan baik ?',
               M('saksi menerangkan Tergugat tidak mengurus dan mengatur rumah tangga',
                 ['saya melihat sendiri #0047# tidak mengurus rumah tangga dan membiarkan rumah tidak terawat',
                  'urusan rumah tangga tidak diatur oleh #0047# sebagaimana saya saksikan langsung',
                  '#0047# tidak mengerjakan keperluan rumah tangga sehari-hari menurut penglihatan saya',
                  'saya tahu sendiri #0047# lalai mengatur rumah tangga bersama #0046#'],
                 ['yang saya ketahui langsung #0047# tidak mengurus rumah tangga dengan sebaik-baiknya',
                  'saya menyaksikan sendiri pekerjaan rumah dan keperluan rumah tangga dibiarkan oleh #0047#',
                  'rumah tangga #0046# dan #0047# tidak diatur oleh #0047# sebagaimana saya lihat sendiri',
                  'saya lihat langsung #0047# tidak menjalankan kewajibannya mengatur rumah tangga'],
                 keadaan=dict(kelalaian='rumah-tangga')),
               hal='pengurusan rumah tangga oleh #0047#', keadaan=dict(kedudukanPenggugat='suami', kelalaian='rumah-tangga'),
               varian=['Bagaimana #0047# mengurus rumah tangga dengan baik ?'],
               berbeda=M('versi A: Tergugat tidak mengurus rumah tangga; versi B: Tergugat tetap mengurus rumah tangga - berselisih pada PERISTIWA',
                         ['#0047# tidak mengurus rumah tangga menurut penglihatan saya',
                          'saya lihat sendiri rumah tangga dibiarkan oleh #0047#',
                          'keperluan rumah tangga tidak diatur #0047# sebagaimana saya saksikan',
                          '#0047# lalai mengatur rumah tangga menurut yang saya ketahui langsung'],
                         ['#0047# tetap mengurus rumah tangga menurut penglihatan saya',
                          'saya lihat sendiri rumah tangga diatur dengan baik oleh #0047#',
                          'keperluan rumah tangga diurus #0047# sebagaimana saya saksikan',
                          '#0047# menjalankan tugasnya mengatur rumah tangga menurut yang saya ketahui langsung'], bedaPada='peristiwa')))

    q.append(Q('berbakti', 'pp-kewajiban-istri', 110, 'inti', 'pokok', 'Apakah #0047# berbakti lahir dan batin kepada #0046# ?',
               M('saksi menerangkan Tergugat tidak berbakti kepada Penggugat',
                 ['saya melihat sendiri #0047# tidak menghormati dan tidak melayani #0046# sebagai suami',
                  '#0047# tidak berbakti kepada #0046# lahir maupun batin sebagaimana saya saksikan langsung',
                  'saya tahu sendiri #0047# mengabaikan #0046# dan tidak mau menuruti ajakan yang wajar',
                  'menurut penglihatan saya #0047# tidak menjalankan kewajiban berbakti kepada #0046#'],
                 ['yang saya ketahui langsung #0047# tidak melayani kebutuhan #0046# dan tidak hormat kepadanya',
                  'saya menyaksikan sendiri #0047# acuh dan tidak berbakti kepada #0046#',
                  'sikap #0047# kepada #0046# jauh dari berbakti sebagaimana saya lihat sendiri',
                  'saya lihat langsung #0047# menolak menjalankan kewajibannya terhadap #0046# sebagai istri'],
                 keadaan=dict(kelalaian='berbakti')),
               hal='sikap #0047# terhadap #0046#', keadaan=dict(kedudukanPenggugat='suami', kelalaian='berbakti'),
               varian=['Bagaimana sikap #0047# terhadap #0046# sehari-hari ?'],
               berbeda=M('versi A: Tergugat tidak berbakti; versi B: Tergugat masih berbakti - berselisih pada PERISTIWA',
                         ['#0047# tidak berbakti kepada #0046# menurut penglihatan saya',
                          'saya lihat sendiri #0047# mengabaikan #0046#',
                          'sikap #0047# kepada #0046# tidak baik sebagaimana saya saksikan',
                          '#0047# tidak menghormati #0046# menurut yang saya ketahui langsung'],
                         ['#0047# masih berbakti kepada #0046# menurut penglihatan saya',
                          'saya lihat sendiri #0047# melayani #0046# dengan baik',
                          'sikap #0047# kepada #0046# baik sebagaimana saya saksikan',
                          '#0047# menghormati #0046# menurut yang saya ketahui langsung'], bedaPada='peristiwa')))

    q.append(Q('meninggalkan-suami', 'pp-kewajiban-istri', 120, 'inti', 'pokok', 'Apakah #0047# tinggal serumah dengan #0046#, atau pergi dari tempat kediaman bersama ?',
               M('saksi menerangkan Tergugat pergi dari tempat kediaman bersama tanpa izin Penggugat dan tidak mau kembali',
                 ['saya melihat sendiri #0047# pergi dari tempat kediaman bersama tanpa izin #0046# dan tidak mau kembali',
                  '#0047# meninggalkan rumah tanpa seizin #0046# dan menolak pulang sebagaimana saya saksikan langsung',
                  'saya tahu sendiri #0047# tidak mau lagi tinggal serumah dengan #0046# padahal sudah diminta pulang',
                  'menurut penglihatan saya #0047# pergi tanpa izin dan tidak bersedia kembali ke rumah #0046#'],
                 ['yang saya ketahui langsung #0047# keluar dari rumah bersama tanpa persetujuan #0046# dan enggan kembali',
                  'saya menyaksikan sendiri #0047# memilih tinggal di tempat lain dan menolak serumah dengan #0046#',
                  'tanpa izin #0046# rupanya #0047# pergi dan tidak mau pulang sebagaimana saya lihat sendiri',
                  'saya lihat langsung #0047# tidak bersedia tinggal bersama #0046# lagi'],
                 keadaan=dict(kelalaian='meninggalkan')),
               hal='kepergian #0047# dari tempat kediaman bersama', keadaan=dict(kedudukanPenggugat='suami', kelalaian='meninggalkan'),
               varian=['Mengapa #0047# tidak tinggal serumah dengan #0046# lagi ?'],
               berbeda=M('versi A: Tergugat pergi tanpa izin; versi B: Tergugat pergi dengan izin Penggugat - berselisih pada PERISTIWA',
                         ['#0047# pergi tanpa izin #0046# menurut penglihatan saya',
                          'saya lihat sendiri #0047# berangkat tanpa sepengetahuan #0046#',
                          'kepergian #0047# tidak diizinkan #0046# sebagaimana saya saksikan',
                          '#0046# tidak memberi izin ketika #0047# pergi menurut yang saya ketahui langsung'],
                         ['#0047# pergi dengan izin #0046# menurut penglihatan saya',
                          'saya lihat sendiri #0047# berangkat dengan sepengetahuan #0046#',
                          'kepergian #0047# diizinkan #0046# sebagaimana saya saksikan',
                          '#0046# memberi izin ketika #0047# pergi menurut yang saya ketahui langsung'], bedaPada='peristiwa')))

    q.append(Q('suami-menafkahi', 'pp-kewajiban-istri', 130, 'pilihan', 'pokok', 'Apakah #0046# tetap memenuhi kebutuhan #0047# selama ini ?',
               M('saksi menerangkan Penggugat tetap memenuhi kebutuhan Tergugat sehingga tidak ada alasan Tergugat melalaikan kewajiban',
                 ['saya melihat sendiri #0046# tetap memenuhi kebutuhan #0047# selama ini',
                  '#0046# terus memberi nafkah kepada #0047# sebagaimana saya saksikan langsung',
                  'kebutuhan sehari-hari #0047# dicukupi oleh #0046# menurut penglihatan saya',
                  'saya tahu sendiri #0046# tidak pernah menelantarkan #0047#'],
                 ['yang saya ketahui langsung #0046# tetap menanggung kebutuhan #0047#',
                  'saya menyaksikan sendiri #0046# menyerahkan nafkah kepada #0047# secara rutin',
                  'uang belanja #0047# selalu disediakan oleh #0046# sebagaimana saya lihat sendiri',
                  'saya lihat langsung #0046# memenuhi kewajibannya sebagai suami terhadap #0047#'],
                 keadaan=dict(kedudukanPenggugat='suami')),
               hal='pemenuhan kebutuhan #0047# oleh #0046#', keadaan=dict(kedudukanPenggugat='suami'), varian=['Apakah #0046# menafkahi #0047# selama ini ?']))

    # ---- umum ----
    q.append(Q('pekerjaan-tergugat', 'pp-kemampuan', 140, 'inti', 'pokok', 'Apa pekerjaan #0047# dan berapa penghasilannya ?',
               M('saksi menerangkan pekerjaan dan penghasilan Tergugat',
                 ['saya tahu sendiri pekerjaan #0047# adalah {pekerjaan} dengan penghasilan {penghasilan}',
                  '#0047# bekerja sebagai {pekerjaan} dan penghasilannya {penghasilan} sebagaimana saya ketahui langsung',
                  'sehari-hari #0047# berpenghasilan {penghasilan} dari pekerjaan {pekerjaan} menurut penglihatan saya',
                  'saya melihat sendiri #0047# bekerja sebagai {pekerjaan} yang menghasilkan {penghasilan}'],
                 ['yang saya ketahui langsung #0047# berprofesi {pekerjaan} dengan penghasilan {penghasilan}',
                  'saya menyaksikan sendiri #0047# bekerja di bidang {pekerjaan} dan memperoleh {penghasilan}',
                  'penghasilan #0047# sebesar {penghasilan} diperoleh dari pekerjaan {pekerjaan} sebagaimana saya lihat sendiri',
                  'saya lihat langsung #0047# menjalani pekerjaan {pekerjaan} dengan hasil {penghasilan}']),
               hal='pekerjaan dan penghasilan #0047#', variabel=('0047',), varian=['Apakah #0047# bekerja dan berapa penghasilannya ?'],
               berbeda=M('versi A: Tergugat berpenghasilan cukup; versi B: Tergugat berpenghasilan sangat kecil - berselisih pada JUMLAH PENGHASILAN',
                         ['penghasilan #0047# cukup besar dari pekerjaan {pekerjaan} menurut penglihatan saya',
                          'saya lihat sendiri #0047# bekerja sebagai {pekerjaan} dengan penghasilan yang lumayan',
                          '#0047# berpenghasilan baik dari pekerjaan {pekerjaan} sebagaimana saya saksikan',
                          'hasil kerja {pekerjaan} #0047# memadai menurut yang saya ketahui langsung'],
                         ['penghasilan #0047# sangat kecil dari pekerjaan {pekerjaan} menurut penglihatan saya',
                          'saya lihat sendiri #0047# bekerja sebagai {pekerjaan} dengan penghasilan yang pas-pasan',
                          '#0047# berpenghasilan rendah dari pekerjaan {pekerjaan} sebagaimana saya saksikan',
                          'hasil kerja {pekerjaan} #0047# hampir tidak cukup menurut yang saya ketahui langsung'], bedaPada='jumlah')))

    q.append(Q('kemampuan-tergugat', 'pp-kemampuan', 150, 'inti', 'pokok', 'Apakah #0047# mampu memenuhi kewajibannya terhadap #0046# ?',
               [M('saksi menerangkan Tergugat mampu memenuhi kewajibannya karena berpenghasilan',
                  ['saya melihat sendiri #0047# sebenarnya mampu memenuhi kewajibannya terhadap #0046# karena berpenghasilan',
                   '#0047# berkecukupan sehingga mampu menafkahi #0046# sebagaimana saya saksikan langsung',
                   'sepengetahuan saya yang saya lihat sendiri #0047# mampu karena bekerja dan punya penghasilan',
                   'menurut penglihatan saya #0047# tidak kekurangan sehingga mampu memenuhi kewajibannya'],
                  ['yang saya ketahui langsung #0047# punya kemampuan untuk memenuhi kewajiban kepada #0046#',
                   'saya menyaksikan sendiri #0047# hidup cukup dan mampu menafkahi #0046#',
                   'kemampuan #0047# untuk memenuhi kewajibannya ada karena penghasilannya tetap sebagaimana saya lihat sendiri',
                   'saya lihat langsung #0047# mampu secara ekonomi untuk memenuhi kebutuhan #0046#'], keadaan=dict(kemampuanTergugat='mampu')),
                M('saksi menerangkan Tergugat berkemampuan terbatas tetapi masih dapat memenuhi sebagian kewajibannya',
                  ['saya melihat sendiri kemampuan #0047# terbatas tetapi masih dapat memenuhi sebagian kewajibannya terhadap #0046#',
                   '#0047# tidak berkelebihan namun masih mampu menyisihkan sebagian untuk #0046# sebagaimana saya saksikan langsung',
                   'penghasilan #0047# pas-pasan walau begitu masih sanggup memenuhi sebagian kebutuhan #0046# menurut penglihatan saya',
                   'saya tahu sendiri kemampuan #0047# sederhana tetapi tidak sampai tidak mampu sama sekali'],
                  ['yang saya ketahui langsung #0047# berkemampuan terbatas namun tetap dapat membantu sebagian kebutuhan #0046#',
                   'saya menyaksikan sendiri hidup #0047# sederhana tetapi masih sanggup memenuhi sebagian kewajibannya',
                   'kemampuan ekonomi #0047# tidak besar walaupun masih cukup untuk sebagian kebutuhan #0046# sebagaimana saya lihat sendiri',
                   'saya lihat langsung #0047# tidak kaya tetapi masih dapat memenuhi sebagian nafkah #0046#'], keadaan=dict(kemampuanTergugat='terbatas'))],
               hal='kemampuan ekonomi #0047#', varian=['Bagaimana kemampuan ekonomi #0047# untuk menafkahi #0046# ?'],
               berbeda=M('versi A: Tergugat mampu; versi B: Tergugat tidak mampu - berselisih pada JUMLAH KEMAMPUAN',
                         ['#0047# mampu secara ekonomi menurut penglihatan saya',
                          'saya lihat sendiri #0047# hidup berkecukupan',
                          '#0047# punya kemampuan untuk menafkahi sebagaimana saya saksikan',
                          'kemampuan #0047# cukup menurut yang saya ketahui langsung'],
                         ['#0047# tidak mampu secara ekonomi menurut penglihatan saya',
                          'saya lihat sendiri #0047# hidup serba kekurangan',
                          '#0047# tidak punya kemampuan untuk menafkahi sebagaimana saya saksikan',
                          'kemampuan #0047# sangat kurang menurut yang saya ketahui langsung'], bedaPada='jumlah')))

    q.append(Q('harta-tergugat', 'pp-kemampuan', 160, 'pilihan', 'pokok', 'Apakah #0047# memiliki harta atau usaha lain, misalnya tanah, rumah, kendaraan atau kebun ?',
               lama['q-harta-ayah']['jawaban']['melihat'], hal='harta dan usaha lain milik #0047#', variabel=('0047',),
               berbeda=lama['q-harta-ayah']['jawaban']['berbeda']))
    q[-1]['teks'] = lama['q-harta-ayah']['teks']

    q.append(Q('upaya-minta', 'pp-upaya', 170, 'inti', 'upaya', 'Apakah #0046# pernah meminta #0047# memenuhi kewajibannya, dan bagaimana tanggapan #0047# ?',
               M('saksi menerangkan Penggugat pernah meminta Tergugat memenuhi kewajibannya tetapi tidak dihiraukan',
                 ['saya melihat sendiri #0046# meminta #0047# memenuhi kewajibannya tetapi #0047# tidak menghiraukan',
                  '#0046# pernah menagih kewajiban kepada #0047# dan tidak ditanggapi sebagaimana saya saksikan langsung',
                  'saya tahu sendiri #0046# sudah berulang kali menegur #0047# namun tidak ada perubahan',
                  'menurut penglihatan saya #0047# mengabaikan permintaan #0046# untuk memenuhi kewajibannya'],
                 ['yang saya ketahui langsung #0046# telah meminta kepada #0047# agar kewajibannya dipenuhi tetapi tidak digubris',
                  'saya menyaksikan sendiri #0047# tidak peduli ketika #0046# menuntut pemenuhan kewajiban',
                  'permintaan #0046# kepada #0047# agar memenuhi kewajiban tidak diindahkan sebagaimana saya lihat sendiri',
                  'saya lihat langsung #0046# berkali-kali menyampaikan hal itu kepada #0047# tanpa hasil']),
               hal='permintaan #0046# agar #0047# memenuhi kewajibannya', varian=['Apakah #0046# pernah menegur #0047# agar memenuhi kewajiban, dan apa tanggapan #0047# ?'],
               berbeda=M('versi A: Penggugat pernah menagih; versi B: Penggugat tidak pernah menagih - berselisih pada PERISTIWA',
                         ['#0046# pernah menagih kewajiban kepada #0047# menurut penglihatan saya',
                          'saya lihat sendiri #0046# meminta #0047# memenuhi kewajibannya',
                          '#0046# sudah menegur #0047# sebagaimana saya saksikan',
                          'permintaan #0046# kepada #0047# memang ada menurut yang saya ketahui langsung'],
                         ['#0046# tidak pernah menagih kewajiban kepada #0047# menurut penglihatan saya',
                          'saya lihat sendiri #0046# tidak pernah meminta #0047# memenuhi kewajibannya',
                          '#0046# belum pernah menegur #0047# sebagaimana saya saksikan',
                          'permintaan #0046# kepada #0047# tidak pernah ada menurut yang saya ketahui langsung'], bedaPada='peristiwa')))

    q.append(Q('upaya-keluarga', 'pp-upaya', 180, 'pilihan', 'upaya', 'Apakah keluarga pernah berusaha mendamaikan #0046# dan #0047# ?',
               M('saksi menerangkan keluarga pernah berusaha mendamaikan tetapi tidak berhasil',
                 ['saya tahu sendiri keluarga pernah berusaha mendamaikan #0046# dan #0047# tetapi tidak berhasil',
                  'pihak keluarga sudah berupaya merukunkan #0046# dan #0047# namun tidak ada hasil sebagaimana saya saksikan langsung',
                  'saya melihat sendiri keluarga mempertemukan #0046# dan #0047# untuk berdamai tetapi gagal',
                  'menurut penglihatan saya upaya keluarga menyatukan mereka belum membuahkan hasil'],
                 ['yang saya ketahui langsung keluarga telah mencoba mendamaikan mereka namun usaha itu tidak berhasil',
                  'saya menyaksikan sendiri keluarga duduk bersama #0046# dan #0047# untuk menyelesaikan masalah tetapi tidak berhasil',
                  'perdamaian yang diusahakan keluarga antara #0046# dan #0047# gagal sebagaimana saya lihat sendiri',
                  'saya lihat langsung keluarga berulang kali berusaha merukunkan mereka tanpa hasil']),
               hal='upaya keluarga mendamaikan #0046# dan #0047#', varian=['Apakah ada upaya keluarga untuk merukunkan #0046# dan #0047# ?']))

    q.append(Q('alasan-tergugat', 'pp-alasan-sah', 190, 'tambahan', 'pokok', 'Apa alasan #0047# tidak memenuhi kewajibannya terhadap #0046# ?',
               M('saksi menerangkan alasan yang disampaikan Tergugat atau yang saksi ketahui sendiri',
                 ['alasan #0047# tidak memenuhi kewajibannya menurut yang saya ketahui sendiri adalah {isi}',
                  'saya mendapati sendiri bahwa #0047# beralasan {isi} ketika tidak memenuhi kewajibannya',
                  'sebab #0047# lalai terhadap #0046# adalah {isi} sebagaimana saya saksikan langsung',
                  'yang menjadi alasan #0047# menurut penglihatan saya adalah {isi}'],
                 ['yang saya ketahui langsung #0047# tidak memenuhi kewajiban karena {isi}',
                  'saya menyaksikan sendiri #0047# mengemukakan {isi} sebagai sebabnya',
                  'dasar #0047# tidak melaksanakan kewajibannya adalah {isi} sebagaimana saya dengar dan lihat sendiri',
                  'saya lihat langsung bahwa pangkal kelalaian #0047# ialah {isi}']),
               hal='alasan #0047# tidak memenuhi kewajibannya', keadaan=dict(dalilNusyuz='ya'), variabel=('0046', '0047'), varian=['Mengapa #0047# tidak memenuhi kewajibannya terhadap #0046# ?'],
               berbeda=M('versi A: alasan Tergugat adalah nusyuz pasangan; versi B: tidak ada alasan sah - berselisih pada PENYEBAB',
                         ['#0047# beralasan karena #0046# lebih dahulu nusyuz menurut penglihatan saya',
                          'saya lihat sendiri #0047# menyatakan #0046# yang tidak taat lebih dahulu',
                          'sebab kelalaian #0047# adalah ketidaktaatan #0046# sebagaimana saya saksikan',
                          '#0047# menyebut #0046# tidak menjalankan kewajibannya lebih dahulu menurut yang saya ketahui langsung'],
                         ['tidak ada alasan sah bagi #0047# menurut penglihatan saya',
                          'saya lihat sendiri #0046# tidak pernah nusyuz dan #0047# tetap lalai',
                          'kelalaian #0047# tidak disebabkan sikap #0046# sebagaimana saya saksikan',
                          '#0046# selalu taat dan #0047# tetap tidak memenuhi kewajibannya menurut yang saya ketahui langsung'], bedaPada='penyebab')))

    q.append(Q('pembebasan', 'pp-alasan-sah', 200, 'tambahan', 'pokok', 'Apakah #0046# pernah menyatakan membebaskan #0047# dari kewajibannya ?',
               M('saksi menerangkan Penggugat tidak pernah membebaskan Tergugat dari kewajibannya',
                 ['saya tahu sendiri #0046# tidak pernah membebaskan #0047# dari kewajibannya',
                  '#0046# tidak pernah menyatakan rela atau membebaskan kewajiban #0047# sebagaimana saya saksikan langsung',
                  'menurut penglihatan saya #0046# tetap menuntut haknya dan tidak membebaskan #0047#',
                  'saya melihat sendiri tidak ada pembebasan kewajiban dari #0046# kepada #0047#'],
                 ['yang saya ketahui langsung #0046# tidak pernah merelakan kewajiban #0047#',
                  'saya menyaksikan sendiri #0046# tidak pernah berkata membebaskan #0047#',
                  'pembebasan atas kewajiban #0047# tidak pernah diucapkan #0046# sebagaimana saya lihat sendiri',
                  'saya lihat langsung #0046# masih menagih haknya sehingga tidak ada pembebasan'],
                 keadaan=dict(kedudukanPenggugat='istri')),
               hal='pembebasan kewajiban #0047# oleh #0046#', keadaan=dict(kedudukanPenggugat='istri'), varian=['Apakah #0046# pernah merelakan atau membebaskan kewajiban #0047# ?']))

    q.append(Q('lama-nafkah', 'pp-waktu-kelalaian', 210, 'tambahan', 'pokok', 'Berapa lama #0047# tidak memberi nafkah kepada #0046# ?',
               M('saksi menerangkan lama Tergugat tidak memberi nafkah',
                 ['saya tahu sendiri #0047# tidak memberi nafkah kepada #0046# selama {lama}',
                  'sudah {lama} lamanya #0047# tidak menafkahi #0046# sebagaimana saya saksikan langsung',
                  'selama {lama} #0046# tidak menerima nafkah dari #0047# menurut penglihatan saya',
                  'saya melihat sendiri nafkah dari #0047# terhenti selama {lama}'],
                 ['yang saya ketahui langsung #0047# tidak menafkahi #0046# sepanjang {lama}',
                  'saya menyaksikan sendiri sepanjang {lama} tidak ada nafkah dari #0047# untuk #0046#',
                  'lamanya #0047# tidak memberi nafkah kepada #0046# adalah {lama} sebagaimana saya lihat sendiri',
                  'saya lihat langsung #0046# hidup tanpa nafkah #0047# selama {lama}']),
               hal='lama #0047# tidak memberi nafkah', keadaan=dict(nafkahLampau='ya', kedudukanPenggugat='istri'), varian=['Sudah berapa lama #0046# tidak dinafkahi #0047# ?'],
               berbeda=M('versi A: lama tidak memberi nafkah sebagaimana didalilkan; versi B: lebih singkat - berselisih pada LAMA',
                         ['#0047# tidak memberi nafkah selama {lama} menurut penglihatan saya',
                          'saya lihat sendiri nafkah terhenti selama {lama}',
                          'sudah {lama} #0046# tidak dinafkahi sebagaimana saya saksikan',
                          'kelalaian nafkah itu berlangsung {lama} menurut yang saya ketahui langsung'],
                         ['nafkah terhenti hanya sebentar dan tidak selama {lama} menurut penglihatan saya',
                          'saya lihat sendiri lamanya jauh lebih singkat daripada {lama}',
                          'kelalaian nafkah tidak sampai {lama} sebagaimana saya saksikan',
                          'bukan {lama} lamanya #0047# tidak menafkahi menurut yang saya ketahui langsung'], bedaPada='lama')))

    q.append(Q('kebutuhan-bulanan', 'pp-kemampuan', 220, 'tambahan', 'pokok', 'Berapa kira-kira kebutuhan hidup #0046# setiap bulan ?',
               M('saksi menerangkan kebutuhan hidup Penggugat setiap bulan',
                 ['saya tahu sendiri kebutuhan hidup #0046# setiap bulan meliputi {daftar}',
                  'untuk hidup sehari-hari #0046# membutuhkan {daftar} setiap bulan sebagaimana saya saksikan langsung',
                  'menurut penglihatan saya kebutuhan bulanan #0046# berupa {daftar}',
                  'saya melihat sendiri bahwa #0046# harus mencukupi {daftar} tiap bulan'],
                 ['yang saya ketahui langsung kebutuhan #0046# tiap bulan adalah {daftar}',
                  'saya menyaksikan sendiri #0046# setiap bulan memerlukan {daftar}',
                  'pengeluaran pokok #0046# bulanan berupa {daftar} sebagaimana saya lihat sendiri',
                  'saya lihat langsung bahwa kebutuhan hidup #0046# sebulan mencakup {daftar}']),
               hal='kebutuhan hidup #0046# setiap bulan', keadaan=dict(kedudukanPenggugat='istri'), varian=['Apa saja kebutuhan #0046# sehari-hari dan berapa biayanya ?'],
               berbeda=M('versi A: kebutuhan besar; versi B: kebutuhan sederhana - berselisih pada JUMLAH KEBUTUHAN',
                         ['kebutuhan hidup #0046# cukup besar setiap bulan menurut penglihatan saya',
                          'saya lihat sendiri #0046# perlu biaya yang tidak sedikit tiap bulan',
                          'pengeluaran #0046# sebulan lumayan banyak sebagaimana saya saksikan',
                          'kebutuhan bulanan #0046# tinggi menurut yang saya ketahui langsung'],
                         ['kebutuhan hidup #0046# sederhana setiap bulan menurut penglihatan saya',
                          'saya lihat sendiri #0046# hanya perlu biaya yang kecil tiap bulan',
                          'pengeluaran #0046# sebulan sedikit sebagaimana saya saksikan',
                          'kebutuhan bulanan #0046# rendah menurut yang saya ketahui langsung'], bedaPada='jumlah')))

    q.append(Q('yang-menanggung', 'pp-akibat', 230, 'tambahan', 'akibat', 'Siapa yang selama ini menanggung kebutuhan hidup #0046# ?',
               M('saksi menerangkan siapa yang menanggung kebutuhan Penggugat selama Tergugat lalai',
                 ['selama ini kebutuhan hidup #0046# ditanggung oleh {daftar} sebagaimana saya ketahui sendiri',
                  'saya melihat sendiri #0046# dibantu oleh {daftar} dalam mencukupi kebutuhannya',
                  'sejak #0047# lalai yang menanggung kebutuhan #0046# adalah {daftar} menurut penglihatan saya',
                  'kebutuhan sehari-hari #0046# dipikul oleh {daftar} sebagaimana saya saksikan langsung'],
                 ['yang saya ketahui langsung kebutuhan #0046# dipenuhi oleh {daftar}',
                  'saya menyaksikan sendiri #0046# bergantung pada {daftar} untuk kebutuhannya',
                  'beban kebutuhan #0046# diambil alih oleh {daftar} sebagaimana saya lihat sendiri',
                  'saya lihat langsung {daftar} yang selama ini membiayai kebutuhan #0046#']),
               hal='pihak yang menanggung kebutuhan #0046#', keadaan=dict(kedudukanPenggugat='istri'), varian=['Dari mana #0046# mencukupi kebutuhannya selama ini ?']))

    q.append(Q('anak-terdampak', 'pp-akibat', 240, 'pilihan', 'akibat', 'Apakah ada anak dari pernikahan #0046# dan #0047#, dan siapa yang merawatnya sekarang ?',
               M('saksi menerangkan keadaan anak para pihak dan siapa yang merawatnya',
                 ['saya tahu sendiri #0046# dan #0047# mempunyai anak yang sekarang dirawat oleh {daftar}',
                  'dari pernikahan mereka ada anak yang diasuh {daftar} menurut penglihatan saya',
                  'anak #0046# dan #0047# saat ini berada dalam perawatan {daftar} sebagaimana saya saksikan langsung',
                  'saya melihat sendiri anak mereka diurus oleh {daftar}'],
                 ['yang saya ketahui langsung anak dari pernikahan itu kini dirawat {daftar}',
                  'saya menyaksikan sendiri anak #0046# dan #0047# diasuh sehari-hari oleh {daftar}',
                  'sekarang {daftar} yang mengurus anak mereka sebagaimana saya lihat sendiri',
                  'saya lihat langsung anak tersebut tinggal dan dirawat bersama {daftar}']),
               hal='keadaan anak #0046# dan #0047#', keadaan=dict(anak='ada'), varian=['Bagaimana keadaan anak #0046# dan #0047# sekarang ?']))

    penutup = dict(lama['q-penutup'])
    penutup['pokok'] = 'pp-hubungan-saksi'
    penutup['urutan'] = 900
    q.append(penutup)
    # urutan unik
    return q


def katalog_utama():
    q = butir()
    # q-kenal dan q-penutup mewarisi urutan lama: sesuaikan
    q[0]['urutan'] = 10
    return {
        'skema': 'saksi-katalog/1', 'kunci': 'kelalaian-kewajiban', 'judul': 'Kelalaian atas kewajiban suami / istri', 'versi': 1,
        'penulis': 'W3a-C (21 Okt 2026)', 'tahap': 2, 'contoh': False,
        'syarat': {'jenisPerkaraId': ['345']},
        'pihak': {'pengaju': '#0046#', 'lawan': '#0047#'},
        'blangkoBas': [
            {'folder': '1e Kelalaian Kewajiban Suami Istri - BAS', 'berkas': 'BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P', 'variabelSaksi': ['2021', '2022', '2031', '6124', '8932'],
             'catatan': 'paket abt-w3a-blangko-baru-perkawinan (menu 176/177, jenis 345); saksi P lewat variabel tanya_jawab; [6a] 3 saksi, [6b] 4 saksi, [6c] 5 saksi sama'},
            {'folder': '1e Kelalaian Kewajiban Suami Istri - BAS', 'berkas': 'BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T', 'variabelSaksi': ['2023', '2024', '2032', '8942'],
             'catatan': 'saksi T; [7a] 3 saksi, [7b] 4 saksi'},
            {'folder': '1e Kelalaian Kewajiban Suami Istri - BAS', 'berkas': 'BAS ALUR 64 Kelalaian Kewajiban - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek', 'variabelSaksi': ['2021', '2022'],
             'catatan': 'verstek: hanya saksi P (2 saksi); varian Verstek Kabul Sebagian untuk petitum sebagian'},
        ],
        'dasarHukum': DASAR, 'keadaan': KEADAAN, 'pokokPembuktian': POKOK, 'pertanyaan': q,
        'jawabanUmum': LAMA['jawabanUmum'],
        'catatanPetugas': [
            'Pilih kedudukan Penggugat (istri atau suami) agar butir kewajiban suami atau kewajiban istri yang sesuai ikut diajukan; kedudukan dibaca dari jenis kelamin Penggugat di SIPP.',
            'Keterangan saksi harus menyebut sebab pengetahuannya; keterangan seorang saksi saja tanpa alat bukti lain tidak cukup.',
            'Kewajiban suami berupa nafkah kiswah dan tempat kediaman berlaku sesuai penghasilan dan kemampuan suami; gugur bila istri nusyuz dan dapat dibebaskan oleh istri (Pasal 80 KHI).',
            'Nusyuz harus didasarkan atas bukti yang sah (Pasal 84 ayat (4) KHI); tanyakan butir alasan Tergugat bila Tergugat mendalilkan nusyuz atau ketidakmampuan.',
            'Nafkah lampau dan besar nafkah ditetapkan majelis dengan menggali fakta kemampuan Tergugat dan kebutuhan dasar Penggugat; jangan menanyakan angka bila tidak dituntut.',
        ],
    }


# ---------------------------------------------------------------------------------------------------------------------
# Katalog tambahan: saksi diajukan TERGUGAT (bantahan) - butir pengganti
# ---------------------------------------------------------------------------------------------------------------------
def katalog_tergugat():
    P = ['T']
    q = []
    q.append(Q('tg-nafkah-diberikan', 'pp-bantahan', 10, 'tambahan', 'pokok', 'Apakah #0047# selama ini memenuhi kewajibannya terhadap #0046# ?',
               M('saksi Tergugat menerangkan Tergugat tetap memenuhi kewajibannya terhadap Penggugat',
                 ['saya melihat sendiri #0047# tetap memenuhi kewajibannya terhadap #0046#',
                  '#0047# selalu menyerahkan nafkah kepada #0046# sebagaimana saya saksikan langsung',
                  'kebutuhan #0046# masih dicukupi oleh #0047# menurut penglihatan saya',
                  'saya tahu sendiri #0047# tidak pernah menelantarkan #0046#'],
                 ['yang saya ketahui langsung #0047# masih menafkahi #0046# sesuai kemampuannya',
                  'saya menyaksikan sendiri #0047# memberi uang belanja kepada #0046#',
                  'kewajiban #0047# kepada #0046# tetap dijalankan sebagaimana saya lihat sendiri',
                  'saya lihat langsung #0047# memenuhi kebutuhan sehari-hari #0046#']),
               hal='pemenuhan kewajiban oleh #0047# terhadap #0046#', pihak=P, menggantikan=['q-nafkah-diberikan', 'q-suami-menafkahi'],
               keadaan=dict(bantahan='sudah-dipenuhi'), varian=['Apakah #0047# menafkahi #0046# selama ini ?']))
    q.append(Q('tg-tidak-mampu', 'pp-bantahan', 20, 'tambahan', 'pokok', 'Bagaimana keadaan ekonomi #0047# sehingga sulit memenuhi kewajibannya ?',
               M('saksi Tergugat menerangkan Tergugat berkemampuan sangat terbatas',
                 ['saya melihat sendiri #0047# hidup serba kekurangan sehingga sulit memenuhi kewajibannya terhadap #0046#',
                  'penghasilan #0047# sangat kecil dan tidak tetap sebagaimana saya saksikan langsung',
                  'menurut penglihatan saya #0047# memang tidak mampu memberi lebih kepada #0046#',
                  'saya tahu sendiri #0047# berpenghasilan rendah dan banyak tanggungan'],
                 ['yang saya ketahui langsung kemampuan ekonomi #0047# sangat terbatas',
                  'saya menyaksikan sendiri #0047# kesulitan mencukupi kebutuhannya sendiri',
                  'hasil kerja #0047# habis untuk kebutuhan paling pokok sebagaimana saya lihat sendiri',
                  'saya lihat langsung #0047# tidak punya kelebihan untuk diberikan kepada #0046#']),
               hal='keadaan ekonomi #0047#', pihak=P, menggantikan=['q-kemampuan-tergugat'], keadaan=dict(bantahan='tidak-mampu'), varian=['Apakah #0047# mampu secara ekonomi ?']))
    q.append(Q('tg-nusyuz-pergi', 'pp-bantahan', 30, 'tambahan', 'pokok', 'Apakah #0046# pergi dari rumah bersama tanpa izin #0047# ?',
               M('saksi Tergugat menerangkan Penggugat yang pergi dari rumah bersama tanpa izin Tergugat',
                 ['saya melihat sendiri #0046# pergi dari rumah bersama tanpa izin #0047#',
                  '#0046# meninggalkan tempat kediaman bersama tanpa seizin #0047# sebagaimana saya saksikan langsung',
                  'saya tahu sendiri #0046# yang memilih pergi dan tidak mau kembali ke rumah #0047#',
                  'menurut penglihatan saya #0047# tidak pernah mengusir tetapi #0046# pergi sendiri'],
                 ['yang saya ketahui langsung #0046# keluar dari rumah bersama tanpa persetujuan #0047#',
                  'saya menyaksikan sendiri #0046# meninggalkan rumah dan menolak pulang meski dijemput #0047#',
                  'kepergian #0046# tidak diizinkan #0047# sebagaimana saya lihat sendiri',
                  'saya lihat langsung #0046# yang meninggalkan #0047# dan rumahnya']),
               hal='kepergian #0046# dari rumah bersama', pihak=P, menggantikan=['q-meninggalkan-istri'], keadaan=dict(bantahan='penggugat-pergi'), varian=['Apakah #0046# atau #0047# yang pergi dari rumah bersama tanpa izin ?']))
    q.append(Q('tg-nusyuz-tidak-taat', 'pp-bantahan', 40, 'tambahan', 'pokok', 'Apakah #0046# tidak mau melayani atau menaati #0047# dalam batas yang wajar ?',
               M('saksi Tergugat menerangkan Penggugat tidak taat dan tidak melayani Tergugat tanpa alasan yang sah',
                 ['saya melihat sendiri #0046# menolak melayani dan menaati #0047# tanpa alasan yang jelas',
                  '#0046# tidak mau tunduk pada ajakan wajar #0047# sebagaimana saya saksikan langsung',
                  'saya tahu sendiri #0046# mengabaikan #0047# dan tidak menjalankan kewajibannya sebagai istri',
                  'menurut penglihatan saya #0046# sering menentang #0047# tanpa sebab yang sah'],
                 ['yang saya ketahui langsung #0046# tidak berbakti kepada #0047# dan tidak punya alasan yang sah',
                  'saya menyaksikan sendiri #0046# acuh terhadap permintaan #0047# yang wajar',
                  'sikap #0046# kepada #0047# jauh dari taat sebagaimana saya lihat sendiri',
                  'saya lihat langsung #0046# menolak menjalankan kewajibannya terhadap #0047#']),
               hal='sikap #0046# terhadap #0047#', pihak=P, keadaan=dict(bantahan='penggugat-nusyuz'), varian=['Bagaimana sikap #0046# kepada #0047# sehari-hari ?'], tb=['berbeda']))
    q.append(Q('tg-dibebaskan', 'pp-bantahan', 50, 'tambahan', 'pokok', 'Apakah #0046# pernah menyatakan tidak menuntut nafkah dari #0047# ?',
               M('saksi Tergugat menerangkan Penggugat pernah menyatakan merelakan atau membebaskan Tergugat',
                 ['saya mendengar sendiri #0046# berkata tidak menuntut nafkah dari #0047#',
                  'di depan saya #0046# menyatakan merelakan kewajiban #0047# sebagaimana saya dengar langsung',
                  'saya tahu dengan telinga sendiri #0046# membebaskan #0047# dari kewajiban nafkah',
                  'ucapan #0046# bahwa ia tidak menuntut apa pun dari #0047# saya dengar sendiri'],
                 ['yang saya dengar langsung #0046# mengatakan rela tidak dinafkahi #0047#',
                  'saya mendengar sendiri #0046# melepaskan hak nafkahnya terhadap #0047#',
                  'perkataan #0046# yang membebaskan #0047# dari nafkah terdengar oleh saya sendiri',
                  'saya dengar langsung #0046# menyatakan tidak lagi menuntut nafkah dari #0047#']),
               hal='pernyataan #0046# tentang nafkah', pihak=P, menggantikan=['q-pembebasan'], keadaan=dict(bantahan='dibebaskan'), varian=['Apakah #0046# pernah membebaskan #0047# dari kewajiban nafkah ?'], tb=['berbeda']))
    q.append(Q('tg-masih-rukun', 'pp-bantahan', 60, 'tambahan', 'pokok', 'Apakah #0046# dan #0047# masih hidup rukun sebagai suami istri ?',
               M('saksi Tergugat menerangkan Penggugat dan Tergugat masih hidup rukun',
                 ['saya melihat sendiri #0046# dan #0047# masih hidup rukun sebagai suami istri',
                  'rumah tangga #0046# dan #0047# masih harmonis sebagaimana saya saksikan langsung',
                  'menurut penglihatan saya keduanya masih saling menghormati dan tinggal bersama',
                  'saya tahu sendiri tidak ada pertengkaran besar antara #0046# dan #0047#'],
                 ['yang saya ketahui langsung #0046# dan #0047# tetap rukun dan serumah',
                  'saya menyaksikan sendiri keduanya masih saling membantu dalam rumah tangga',
                  'hubungan #0046# dan #0047# baik-baik saja sebagaimana saya lihat sendiri',
                  'saya lihat langsung mereka masih menjalani kehidupan rumah tangga bersama']),
               hal='kerukunan #0046# dan #0047#', pihak=P, keadaan=dict(bantahan='masih-rukun'), varian=['Bagaimana keadaan rumah tangga #0046# dan #0047# ?'], tb=['berbeda']))
    return {
        'skema': 'saksi-katalog/1', 'kunci': 'kelalaian-kewajiban-tergugat', 'judul': 'Kelalaian atas kewajiban suami / istri - keterangan saksi yang diajukan Tergugat', 'versi': 1,
        'penulis': 'W3a-C (21 Okt 2026)', 'tahap': 2, 'contoh': False,
        'syarat': {'jenisPerkaraId': ['345']}, 'tambahanUntuk': ['kelalaian-kewajiban'], 'urutanAwal': 2000,
        'pihak': {'pengaju': '#0046#', 'lawan': '#0047#'}, 'blangkoBas': [],
        'dasarHukum': dasar_lama('dh-sebab-pengetahuan') + [d for d in DASAR if d['id'] in ('dh-khi-80-81', 'dh-khi-83-84')],
        'keadaan': {'bantahan': dict(sumber='borang', jamak=True, nilai=['sudah-dipenuhi', 'tidak-mampu', 'penggugat-pergi', 'penggugat-nusyuz', 'dibebaskan', 'masih-rukun'], bawaan=[],
                                    label='Bantahan Tergugat atas dalil kelalaian',
                                    labelNilai={'sudah-dipenuhi': 'Kewajiban sudah dipenuhi', 'tidak-mampu': 'Tergugat tidak mampu', 'penggugat-pergi': 'Penggugat pergi dari rumah tanpa izin',
                                                'penggugat-nusyuz': 'Penggugat tidak taat atau nusyuz', 'dibebaskan': 'Penggugat membebaskan Tergugat', 'masih-rukun': 'Masih hidup rukun'})},
        'pokokPembuktian': [dict(id='pp-bantahan', judul='Bantahan Tergugat atas dalil kelalaian',
                                 uraian='Tergugat membantah kelalaian: kewajiban sudah dipenuhi, tidak mampu, Penggugat nusyuz atau pergi tanpa izin, atau kewajiban dibebaskan',
                                 wajib=False, dasarHukum=['dh-sebab-pengetahuan', 'dh-khi-80-81', 'dh-khi-83-84'], keadaan=dict(kehadiran=['kontradiktoir', 't-tidak-hadir-setelah-mediasi']))],
        'pertanyaan': q, 'jawabanUmum': LAMA['jawabanUmum'],
        'catatanPetugas': ['Pilih bantahan yang diajukan Tergugat agar butir saksi Tergugat yang sesuai ikut diajukan; nusyuz harus dibuktikan dengan bukti yang sah (Pasal 84 ayat (4) KHI).',
                           'Keterangan saksi harus menyebut sebab pengetahuannya; keterangan seorang saksi saja tanpa alat bukti lain tidak cukup.'],
    }


def tulis():
    for nama, kat in (('kelalaian-kewajiban.json', katalog_utama()), ('kelalaian-kewajiban-tergugat.json', katalog_tergugat())):
        with open(os.path.join(FOLDER, nama), 'w', encoding='utf-8', newline='\n') as f:
            json.dump(kat, f, ensure_ascii=False, indent=1)
            f.write('\n')
        print('ditulis', nama, len(kat['pertanyaan']), 'butir')


if __name__ == '__main__':
    tulis()
