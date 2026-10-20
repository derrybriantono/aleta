# -*- coding: utf-8 -*-
"""Blangko EKSEKUSI putusan (folder "96 Eksekusi" = penetapan Ketua; "96 Eksekusi - BAS" = berita acara pelaksanaan).

Eksekusi BUKAN perkara baru: ia tahap sesudah putusan berkekuatan hukum tetap, dijalankan atas perintah dan di bawah pimpinan Ketua (Pasal 206 ayat (1) RBg).
Mesin gugatan/permohonan (gugatan.py, permohonan.py) tidak cocok, maka modul ini memiliki fungsi bangun(S) sendiri (dipanggil bangun_semua.py).

Dasar hukum yang dicetak (naskah RBg D:/aleta-dev/kerja/referensi/_unduhan/hir-rbg-bw/rbg-unnes.txt dibaca; lihat spek/PASAL-eksekusi.md):
  Pasal 206 ayat (1), 207 ayat (1)-(2), 208, 209 ayat (1)-(4), 210 ayat (1), 213, 214 ayat (1), 215 ayat (1), 216, 217 ayat (1), 218 ayat (2) RBg
  dan Pasal 54 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 (perlu-verifikasi: bunyi naskah UU 7/1989 tidak ada di folder referensi).
Variabel baru: sumber/variabel_eksekusi.py (3940-3969). Variabel lama: #0001# (nomor perkara asal), #8004# (Panitera), #8000# (Ketua), #8008# #8011# (satker).

Susunan dasar: penetapan = "99 PTSP/@ 4 - Penetapan Penunjukan Mediator.rtf" (kepala PENETAPAN, tanda tangan Ketua); BAS = "6 Perwalian - BAS/... [3] ... .rtf"
(kepala, badan, tabel tanda tangan dua kolom). Semua paragraf memakai gaya paragraf berkas dasar.
"""
import os
import re

import bangun as B
from pustaka import ASLI, KELUAR, Berkas, Rakit, isian_diperlukan

SPEK = dict(
    kode='eksekusi',
    kunci='eksekusi',
    label='eksekusi',
    nama_berkas='Eksekusi',
    folder='96 Eksekusi',
    isian_bas=[],        # eksekusi tidak memeriksa saksi: tanpa katalog saksi
    perdamaian=False,
)

DASAR_PEN = os.path.join(ASLI, '99 PTSP', '@ 4 - Penetapan Penunjukan Mediator.rtf')
DASAR_BAS = os.path.join(ASLI, '6 Perwalian - BAS', 'BAS ALUR 16 Perwalian - [3] Sidang Terakhir - Pembacaan Penetapan.rtf')

RBG = 'Reglemen Acara Hukum untuk Daerah Luar Jawa dan Madura (RBg)'
UU = ('Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 '
      'dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009')


def mengingat(pasal):
    return 'Mengingat, %s RBg jo. Pasal 54 %s, serta ketentuan peraturan perundang-undangan lain yang berkaitan dengan perkara ini;' % (pasal, UU)


PEMBUKA = ('Ketua #8008# telah membaca permohonan eksekusi tertanggal #3941# dari Pemohon Eksekusi yang terdaftar di Kepaniteraan #8008# dalam Register Eksekusi Nomor #3940# '
           'untuk melaksanakan #3942#, dalam perkara antara:')
KALIMAT_ANMN = ('Menimbang, bahwa Termohon Eksekusi telah dipanggil untuk ditegur (aanmaning) pada hari/tanggal #3957#, tetapi putusan tersebut belum dilaksanakan '
                'oleh Termohon Eksekusi;')
PASAL_206 = ('Menimbang, bahwa menurut Pasal 206 ayat (1) %s, pelaksanaan putusan Pengadilan tingkat pertama dilakukan atas perintah dan di bawah pimpinan Ketua' % RBG)

# ---------------------------------------------------------------------------------------------------------------------------------
# PENETAPAN (Ketua). Kunci: berkas, menimbang[], mengingat, menetapkan[], tgl (variabel tanggal penetapan)
# ---------------------------------------------------------------------------------------------------------------------------------
PENETAPAN = [
    dict(
        kode='[01]',
        berkas='[01] [Aanmaning] Eksekusi - Penetapan Teguran dan Panggilan Termohon Eksekusi.rtf',
        tgl='#3949#',
        menimbang=[
            'Menimbang, bahwa Pemohon Eksekusi pada pokoknya memohon agar #3942# dilaksanakan, oleh karena Termohon Eksekusi enggan atau alpa melaksanakan isi putusan tersebut secara sukarela;',
            PASAL_206 + ', dan menurut Pasal 207 ayat (1) dan ayat (2) RBg, dalam hal pihak yang kalah enggan atau alpa melaksanakan putusan secara sukarela, pihak yang menang dapat '
            'mengajukan permohonan agar putusan itu dilaksanakan, dan Ketua menyuruh memanggil pihak yang kalah serta memperingatkannya agar dalam waktu yang ditentukan, tidak melebihi '
            'delapan hari, ia melaksanakan putusan tersebut;',
            'Menimbang, bahwa oleh karena isi putusan tersebut belum dilaksanakan oleh Termohon Eksekusi, maka Termohon Eksekusi perlu dipanggil untuk ditegur (aanmaning) agar '
            'melaksanakan isi putusan tersebut secara sukarela dalam waktu #3963# terhitung sejak hari ia ditegur;',
        ],
        mengingat=mengingat('Pasal 206 ayat (1) dan Pasal 207'),
        menetapkan=[
            'Menetapkan hari sidang teguran (aanmaning) pada hari/tanggal #3957#, pukul #3962#, bertempat di #8008#;',
            'Memerintahkan Jurusita atau Jurusita Pengganti #3945# untuk memanggil Termohon Eksekusi secara sah dan patut agar hadir pada hari sidang teguran tersebut;',
            'Memerintahkan agar pada hari sidang tersebut Termohon Eksekusi ditegur (aanmaning) untuk melaksanakan isi putusan dalam perkara Nomor #0001# secara sukarela dalam waktu #3963# terhitung sejak hari ia ditegur;',
            'Memerintahkan Panitera atau Panitera Pengganti untuk membuat berita acara sidang teguran (aanmaning) tersebut;',
        ],
    ),
    dict(
        kode='[02]',
        berkas='[02] [Sita] Eksekusi - Penetapan Sita Eksekusi.rtf',
        tgl='#3950#',
        objek=True,
        menimbang=[
            'Menimbang, bahwa Termohon Eksekusi telah dipanggil untuk ditegur (aanmaning) pada hari/tanggal #3957#, dan setelah lampau tenggang waktu yang ditentukan putusan tersebut '
            'tidak dilaksanakan atau Termohon Eksekusi tidak datang menghadap setelah dipanggil;',
            'Menimbang, bahwa menurut Pasal 208 %s, apabila setelah lampau tenggang waktu yang telah ditentukan putusan hakim tidak dilaksanakan atau pihak yang kalah tidak datang '
            'menghadap setelah dipanggil, maka Ketua karena jabatannya mengeluarkan perintah untuk menyita barang-barang milik pihak yang kalah sebanyak yang diperkirakan akan '
            'mencukupi untuk pelaksanaan putusan;' % RBG,
            'Menimbang, bahwa menurut Pasal 209 RBg penyitaan dilakukan oleh Panitera, dan apabila Panitera berhalangan penyitaan dilakukan oleh orang yang cakap dan terpercaya '
            'yang ditunjuk oleh Ketua, penunjukan mana cukup dengan menyebutnya dalam perintah tertulis, dan Panitera atau penggantinya itu membuat berita acara tentang apa yang '
            'dilakukannya serta memberikan penjelasan tentang maksudnya kepada pihak yang barangnya disita bila ia ada; selanjutnya menurut Pasal 210 ayat (1) RBg penyitaan dilakukan '
            'dengan dibantu dua orang saksi yang nama, pekerjaan, dan tempat tinggalnya disebut dalam berita acara dan yang ikut menandatanganinya;',
            'Menimbang, bahwa berdasarkan hal-hal tersebut perlu dilakukan sita eksekusi terhadap objek eksekusi milik Termohon Eksekusi berupa:',
            '#3964#',
            'Menimbang, bahwa menurut Pasal 213 ayat (1) RBg berita acara penyitaan terhadap barang tetap diumumkan kepada khalayak ramai dengan mencatatnya dalam daftar di '
            'kepaniteraan pengadilan, dan menurut Pasal 214 ayat (1) RBg terhitung mulai hari diumumkannya berita acara penyitaan itu pihak yang mengalami penyitaan tidak '
            'diperbolehkan memindahtangankan, membebani dengan suatu hak, atau menyewakan barang tetap itu;',
        ],
        mengingat=mengingat('Pasal 206 ayat (1), Pasal 208, Pasal 209, Pasal 210 ayat (1), Pasal 213, dan Pasal 214 ayat (1)'),
        menetapkan=[
            'Memerintahkan Panitera atau, apabila Panitera berhalangan, Jurusita #3945# yang dengan penetapan ini ditunjuk untuk itu, untuk melakukan sita eksekusi terhadap objek '
            'eksekusi milik Termohon Eksekusi sebagaimana tersebut di atas;',
            'Menetapkan bahwa penyitaan dilakukan dengan dibantu dua orang saksi yang nama, pekerjaan, dan tempat tinggalnya disebut dalam berita acara penyitaan dan yang ikut menandatanganinya;',
            'Memerintahkan Panitera atau Jurusita tersebut untuk membuat berita acara penyitaan dan memberikan penjelasan tentang maksud penyitaan kepada Termohon Eksekusi apabila ia hadir;',
            'Memerintahkan, apabila objek yang disita berupa barang tetap, agar berita acara penyitaan diumumkan dengan mencatatnya dalam daftar di Kepaniteraan #8008# dan dengan '
            'meminta kepala desa atau lurah setempat untuk memaklumkan penyitaan itu kepada khalayak ramai menurut cara yang lazim di tempat itu;',
            'Menetapkan bahwa terhitung sejak berita acara penyitaan atas barang tetap diumumkan, Termohon Eksekusi dilarang memindahtangankan, membebani dengan suatu hak, atau '
            'menyewakan barang tetap yang disita;',
            'Memerintahkan Panitera atau Jurusita tersebut untuk melaporkan hasil penyitaan kepada Ketua;',
        ],
    ),
    dict(
        kode='[03]',
        berkas='[03] [Riil] Eksekusi - Penetapan Perintah Eksekusi Riil (Pengosongan atau Penyerahan).rtf',
        tgl='#3951#',
        objek=True,
        menimbang=[
            KALIMAT_ANMN,
            'Menimbang, bahwa pelaksanaan putusan tersebut berupa penyerahan dan/atau pengosongan (eksekusi riil) atas objek eksekusi berupa:',
            '#3964#',
            PASAL_206 + '; terhadap pihak yang enggan menyerahkan barang, Pasal 218 ayat (2) RBg memberi pedoman bahwa Ketua mengeluarkan surat perintah untuk, bila perlu dengan '
            'bantuan polisi, memaksa agar yang membangkang beserta keluarganya meninggalkan dan mengosongkan barang itu;',
            'Menimbang, bahwa berdasarkan hal-hal tersebut perlu diperintahkan pelaksanaan eksekusi riil atas objek eksekusi tersebut;',
        ],
        mengingat=mengingat('Pasal 206 ayat (1) dan Pasal 218 ayat (2)'),
        menetapkan=[
            'Memerintahkan Panitera atau, apabila Panitera berhalangan, Jurusita #3945# yang dengan penetapan ini ditunjuk untuk itu, untuk melaksanakan eksekusi riil atas putusan dalam perkara Nomor #0001#, '
            'dengan menyerahkan dan/atau mengosongkan objek eksekusi sebagaimana tersebut di atas kepada Pemohon Eksekusi sesuai amar putusan;',
            'Memerintahkan agar waktu pelaksanaan eksekusi diberitahukan lebih dahulu kepada Pemohon Eksekusi dan Termohon Eksekusi;',
            'Menetapkan bahwa apabila Termohon Eksekusi beserta keluarganya atau pihak yang menguasai objek eksekusi enggan meninggalkan dan mengosongkan objek eksekusi, pelaksanaan '
            'eksekusi dilakukan, bila perlu, dengan bantuan polisi atau alat negara lain yang berwenang;',
            'Menetapkan bahwa pelaksanaan eksekusi disaksikan oleh dua orang saksi yang namanya dicatat dalam berita acara pelaksanaan eksekusi;',
            'Memerintahkan Panitera atau Jurusita tersebut untuk membuat berita acara pelaksanaan eksekusi dan melaporkan hasilnya kepada Ketua;',
        ],
    ),
    dict(
        kode='[04]',
        berkas='[04] [Lelang] Eksekusi - Penetapan Perintah Penjualan Lelang.rtf',
        tgl='#3952#',
        objek=True,
        menimbang=[
            'Menimbang, bahwa terhadap objek eksekusi sebagaimana tersebut di bawah ini telah dilakukan sita eksekusi pada hari/tanggal #3958#, tetapi Termohon Eksekusi tetap tidak '
            'melaksanakan isi #3942#, adapun objek sita tersebut adalah:',
            '#3964#',
            'Menimbang, bahwa menurut Pasal 215 ayat (1) %s, penjualan barang sitaan dilakukan dengan perantaraan kantor lelang, atau tergantung dari keadaan atas pertimbangan Ketua '
            'oleh orang lain yang dipandang cakap dan dapat dipercaya, menurut syarat-syarat biasa secara umum dan diberikan kepada yang menawar dengan harga tertinggi;' % RBG,
            'Menimbang, bahwa menurut Pasal 216 RBg pihak yang barangnya disita dapat memberikan urutan barang yang harus didahulukan untuk ditawarkan, dan begitu jumlah yang '
            'diperlukan untuk memenuhi putusan beserta biayanya tercapai maka penjualan dihentikan dan sisa barangnya dikembalikan kepada pemiliknya, sedangkan menurut Pasal 217 '
            'ayat (1) RBg pelelangan barang bergerak dilakukan sesudah pengumuman menurut cara setempat dan tidak boleh dilakukan sebelum lewat delapan hari setelah dilakukan penyitaan;',
            'Menimbang, bahwa berdasarkan hal-hal tersebut perlu diperintahkan penjualan lelang atas objek sita tersebut guna melaksanakan isi putusan;',
        ],
        mengingat=mengingat('Pasal 206 ayat (1), Pasal 215 ayat (1), Pasal 216, dan Pasal 217 ayat (1)'),
        menetapkan=[
            'Memerintahkan Panitera atau Jurusita #3945# untuk mengajukan permintaan lelang kepada kantor lelang yang berwenang (Kantor Pelayanan Kekayaan Negara dan Lelang) guna '
            'menjual lelang objek sita sebagaimana tersebut di atas;',
            'Menetapkan bahwa penjualan lelang dilakukan menurut syarat-syarat lelang yang berlaku secara umum dan diberikan kepada penawar dengan harga tertinggi, setelah diumumkan '
            'menurut ketentuan Pasal 217 RBg;',
            'Menetapkan bahwa penjualan dihentikan apabila jumlah yang diperlukan untuk memenuhi putusan beserta biayanya telah tercapai, dan sisa barang yang tidak dijual '
            'dikembalikan kepada pemiliknya;',
            'Memerintahkan agar hasil lelang, setelah dikurangi biaya lelang, diserahkan kepada pihak yang berhak sesuai amar putusan dengan berita acara;',
            'Memerintahkan Panitera atau Jurusita tersebut untuk melaporkan pelaksanaan lelang kepada Ketua;',
        ],
    ),
    dict(
        kode='[05]',
        berkas='[05] [Non-Eksekutabel] Eksekusi - Putusan Tidak Dapat Dilaksanakan.rtf',
        tgl='#3953#',
        menimbang=[
            'Menimbang, bahwa Pemohon Eksekusi memohon agar #3942# dilaksanakan;',
            'Menimbang, bahwa berdasarkan hasil pemeriksaan atas permohonan eksekusi tersebut ternyata: #3968#;',
            PASAL_206 + '; oleh karena putusan tersebut tidak dapat dilaksanakan dengan alasan sebagaimana diuraikan di atas, maka putusan tersebut harus dinyatakan tidak dapat '
            'dilaksanakan (non-eksekutabel) dan permohonan eksekusi tidak dapat dilanjutkan;',
        ],
        mengingat=mengingat('Pasal 206 ayat (1)'),
        menetapkan=[
            'Menyatakan putusan dalam perkara Nomor #0001# tidak dapat dilaksanakan (non-eksekutabel);',
            'Menyatakan permohonan eksekusi dari Pemohon Eksekusi yang terdaftar dalam Register Eksekusi Nomor #3940# tidak dapat dilanjutkan;',
            'Memerintahkan Panitera untuk memberitahukan penetapan ini kepada Pemohon Eksekusi dan Termohon Eksekusi;',
            'Memerintahkan Panitera untuk mencatat penetapan ini dalam register eksekusi dan sistem informasi penelusuran perkara;',
        ],
    ),
    dict(
        kode='[06]',
        berkas='[06] [Konstatering] Eksekusi - Penetapan Pencocokan Objek Eksekusi.rtf',
        tgl='#3954#',
        objek=True,
        menimbang=[
            'Menimbang, bahwa Pemohon Eksekusi memohon agar #3942# dilaksanakan atas objek eksekusi berupa:',
            '#3964#',
            'Menimbang, bahwa sebelum eksekusi dilaksanakan perlu dipastikan lebih dahulu kesesuaian objek eksekusi dengan amar putusan, baik mengenai letak, luas, maupun batas-batasnya, '
            'melalui pencocokan di tempat objek (konstatering), agar pelaksanaan eksekusi tepat sasaran dan tidak menimbulkan sengketa baru;',
            PASAL_206 + ', sehingga Ketua berwenang memerintahkan langkah pendahuluan yang diperlukan untuk pelaksanaan putusan tersebut;',
        ],
        mengingat=mengingat('Pasal 206 ayat (1)'),
        menetapkan=[
            'Memerintahkan Panitera atau Jurusita #3945# untuk melakukan pencocokan (konstatering) atas objek eksekusi sebagaimana tersebut di atas di tempat objek tersebut berada, '
            'yaitu mencocokkan letak, luas, dan batas-batasnya dengan amar putusan;',
            'Menetapkan bahwa konstatering dilakukan dengan disaksikan oleh dua orang saksi yang namanya dicatat dalam berita acara;',
            'Memerintahkan agar Pemohon Eksekusi dan Termohon Eksekusi diberitahu dan dipersilakan hadir pada saat konstatering dilaksanakan;',
            'Memerintahkan Panitera atau Jurusita tersebut untuk membuat berita acara konstatering dan melaporkan hasilnya kepada Ketua;',
        ],
    ),
    dict(
        kode='[97]',
        berkas='[97] [Sukarela] Eksekusi - Putusan Dilaksanakan Secara Sukarela.rtf',
        tgl='#3956#',
        menimbang=[
            'Menimbang, bahwa sesudah permohonan eksekusi diajukan, Termohon Eksekusi telah melaksanakan isi #3942# secara sukarela, dengan uraian sebagai berikut: #3967#;',
            'Menimbang, bahwa menurut Pasal 207 ayat (1) %s, permohonan eksekusi diajukan dalam hal keengganan atau kealpaan pihak yang kalah untuk melaksanakan putusan secara sukarela; '
            'oleh karena putusan tersebut telah dilaksanakan secara sukarela, maka tidak ada lagi alasan untuk melanjutkan pelaksanaan putusan secara paksa;' % RBG,
            'Menimbang, bahwa dengan telah dilaksanakannya isi putusan tersebut, permohonan eksekusi telah selesai dan tidak perlu dilanjutkan dengan penyitaan maupun eksekusi paksa;',
        ],
        mengingat=mengingat('Pasal 206 ayat (1) dan Pasal 207 ayat (1)'),
        menetapkan=[
            'Menyatakan bahwa putusan dalam perkara Nomor #0001# telah dilaksanakan secara sukarela oleh Termohon Eksekusi;',
            'Menyatakan bahwa permohonan eksekusi yang terdaftar dalam Register Eksekusi Nomor #3940# telah selesai dan tidak dilanjutkan;',
            'Memerintahkan Panitera untuk mencatat penyelesaian ini dalam register eksekusi dan sistem informasi penelusuran perkara;',
            'Memerintahkan Panitera untuk memberitahukan penetapan ini kepada Pemohon Eksekusi dan Termohon Eksekusi;',
        ],
    ),
    dict(
        kode='[98]',
        berkas='[98] [Cabut] Eksekusi - Pencabutan Permohonan Eksekusi.rtf',
        tgl='#3955#',
        menimbang=[
            'Menimbang, bahwa Pemohon Eksekusi telah menyatakan mencabut permohonan eksekusi atas #3942# yang terdaftar dalam Register Eksekusi Nomor #3940#, dengan alasan sebagai berikut: #3968#;',
            'Menimbang, bahwa menurut Pasal 207 ayat (1) %s, pelaksanaan putusan dimohonkan oleh pihak yang menang; oleh karena itu pencabutan permohonan eksekusi oleh Pemohon '
            'Eksekusi sendiri beralasan untuk diterima dan proses eksekusi tidak perlu dilanjutkan;' % RBG,
        ],
        mengingat=mengingat('Pasal 206 ayat (1) dan Pasal 207 ayat (1)'),
        menetapkan=[
            'Menyatakan permohonan eksekusi dari Pemohon Eksekusi yang terdaftar dalam Register Eksekusi Nomor #3940# dicabut;',
            'Menyatakan proses eksekusi atas putusan dalam perkara Nomor #0001# dihentikan dan tidak dilanjutkan;',
            'Memerintahkan Panitera atau Jurusita untuk mengangkat sita eksekusi yang telah diletakkan atas objek eksekusi, apabila ada, dan melaporkannya kepada Ketua;',
            'Memerintahkan Panitera untuk mencatat pencabutan ini dalam register eksekusi dan sistem informasi penelusuran perkara serta memberitahukannya kepada Pemohon Eksekusi dan Termohon Eksekusi;',
        ],
    ),
]


BLOK_ISIAN = ('#3964#', '#3965#', '#3966#')   # isian berbaris-baris (objek, saksi): blok menjorok seperti identitas para pihak


def _jaga(p, kata):
    """Tambah \\keepn (jaga bersama paragraf berikutnya) atau \\keep (jangan terpotong halaman) pada kepala paragraf p."""
    return p.replace('\\pard \\plain ', '\\pard \\plain \\%s ' % kata, 1)


def _blok(p, kiri=567):
    """Paragraf berblok menjorok (tanpa baris pertama menjorok sendiri): blok identitas para pihak yang berbaris-baris (<br>) agar semua barisnya sejajar."""
    j = p.find('{')
    kepala, sisa = p[:j], p[j:]
    kepala = re.sub(r'\\fi-?\d+', lambda m: '\\fi0', kepala)
    kepala = re.sub(r'\\li(?!n)-?\d+', lambda m: '\\li%d' % kiri, kepala)
    kepala = re.sub(r'\\lin-?\d+', lambda m: '\\lin%d' % kiri, kepala)
    return kepala + sisa


def _tambah_tersembunyi(p, tokens):
    """Sisipkan run teks tersembunyi (\\v) berisi penanda isian di akhir paragraf p (sebelum grup penutup \\par): ABT menanyakan isian yang hanya dibaca kueri variabel lain."""
    grup = B._grup_anak(p)
    a, b = grup[-1]
    akhir = p[a:b]
    tanda = '\\par '
    if tanda not in akhir:
        tanda = '\\par'
    tersembunyi = akhir.replace(tanda, '\\v ' + B.esc(' ' + tokens), 1)
    return p[:a] + tersembunyi + p[a:]


def susun_penetapan(spec, folder_keluar):
    b = Berkas(DASAR_PEN)
    r = Rakit(b)
    r.raw(0)                                             # PENETAPAN
    r.teks(1, 'Nomor #3940#')
    r.raw(2)
    r.teks(3, PEMBUKA)
    r.out.append(_blok(b.d.ganti_teks(3, '#3943#')))
    r.teks(9, 'Melawan')
    r.out.append(_blok(b.d.ganti_teks(3, '#3944#')))
    for t in spec['menimbang']:
        if t in BLOK_ISIAN:
            r.out.append(_blok(b.d.ganti_teks(5, t)))
        else:
            r.teks(5, t)
    r.teks(8, spec['mengingat'])
    r.teks(9, 'MENETAPKAN')
    for n, t in enumerate(spec['menetapkan'], 1):
        r.nomor(10, n, t)
    r.out[-1] = _jaga(r.out[-1], 'keepn')            # butir terakhir, tanggal, dan tanda tangan satu halaman
    r.out.append(_jaga(b.d.par[15], 'keepn'))
    r.out.append(_jaga(b.d.ganti_teks(16, 'Ditetapkan di #8011#'), 'keepn'))
    r.out.append(_jaga(b.d.ganti_teks(17, 'Pada tanggal ' + spec['tgl']), 'keepn'))
    r.out.append(_jaga(b.d.ganti_teks(18, '#3946#'), 'keep'))
    r.raw(22)
    perlu = isian_diperlukan(''.join(r.out))
    r.out[1] = _tambah_tersembunyi(r.out[1], ' '.join('#%04d#' % n for n in perlu))
    tujuan = os.path.join(folder_keluar, spec['berkas'])
    r.selesai(tujuan)
    return tujuan


# ---------------------------------------------------------------------------------------------------------------------------------
# BERITA ACARA (BAS). Kunci: berkas, judul, badan[] (str = paragraf; ('pihak',) = blok para pihak; ('tengah', teks)), tabel[] ((jabatan kiri, nama kiri, jabatan kanan, nama kanan))
# ---------------------------------------------------------------------------------------------------------------------------------
PIHAK = ('pihak',)
TITIK_NAMA = '(................................)'

ANTAR = ' dalam perkara antara:'
ISI_PUTUSAN_ANMN = ('Selanjutnya Ketua memeriksa identitas Termohon Eksekusi yang hadir dan menjelaskan bahwa #3942# telah berkekuatan hukum tetap, serta bahwa Pemohon Eksekusi '
                    'memohon agar putusan tersebut dilaksanakan karena Termohon Eksekusi enggan atau alpa melaksanakannya secara sukarela;')
PEMBUKA_ANMN = ('Pada hari/tanggal #3957#, pukul #3962#, bertempat di ruang sidang #8008#, Ketua #8008# didampingi Panitera #8004# telah melaksanakan sidang teguran (aanmaning) atas '
                'permohonan eksekusi Nomor #3940# tertanggal #3941# untuk melaksanakan #3942#,' + ANTAR)
PERINGATAN_208 = ('memperingatkan bahwa apabila setelah lampau tenggang waktu tersebut putusan tidak dilaksanakan, maka sesuai Pasal 208 RBg Ketua dapat memerintahkan penyitaan '
                  'dan pelaksanaan putusan tersebut secara paksa;')
TTD_ANMN = [('Panitera', '#8004#', 'Ketua', '#8000#')]
SAKSI_TTD = ('Saksi I', TITIK_NAMA, 'Saksi II', TITIK_NAMA)

BAS = [
    dict(
        berkas='BAS ALUR 75 Eksekusi - [1] Sidang Teguran (Aanmaning) - Termohon Eksekusi Hadir dan Ditegur.rtf',
        judul='BERITA ACARA TEGURAN (AANMANING)',
        badan=[
            PEMBUKA_ANMN, PIHAK,
            'Setelah sidang teguran dibuka oleh Ketua, Termohon Eksekusi dipanggil menghadap, dan ternyata Termohon Eksekusi hadir di persidangan;',
            ISI_PUTUSAN_ANMN,
            'Selanjutnya Ketua menegur (aanmaning) Termohon Eksekusi agar melaksanakan isi putusan tersebut secara sukarela dalam waktu #3963# terhitung sejak hari ini, dan ' + PERINGATAN_208,
            'Atas teguran tersebut, Termohon Eksekusi menyatakan: #3969#;',
            'Setelah teguran disampaikan dan pernyataan Termohon Eksekusi dicatat, Ketua menyatakan sidang teguran (aanmaning) ditutup;',
            'Demikian berita acara teguran (aanmaning) ini dibuat dengan sebenarnya dan ditandatangani oleh Ketua dan Panitera.',
        ],
        tabel=TTD_ANMN,
    ),
    dict(
        berkas='BAS ALUR 75 Eksekusi - [1a] Sidang Teguran (Aanmaning) - Termohon Eksekusi Tidak Hadir Setelah Dipanggil Patut.rtf',
        judul='BERITA ACARA TEGURAN (AANMANING)',
        badan=[
            PEMBUKA_ANMN, PIHAK,
            'Setelah sidang teguran dibuka oleh Ketua, Termohon Eksekusi dipanggil menghadap, tetapi sampai dengan ditutupnya sidang Termohon Eksekusi tidak hadir dan tidak pula '
            'menyuruh orang lain sebagai wakil atau kuasanya, meskipun menurut relaas panggilan yang dibuat Jurusita #3945# Termohon Eksekusi telah dipanggil secara sah dan patut;',
            'Ketua menjelaskan bahwa menurut Pasal 208 RBg, apabila setelah lampau tenggang waktu yang telah ditentukan putusan hakim tidak dilaksanakan atau pihak yang kalah tidak '
            'datang menghadap setelah dipanggil, maka Ketua karena jabatannya mengeluarkan perintah untuk menyita barang-barang milik pihak yang kalah;',
            'Oleh karena Termohon Eksekusi tidak menghadap setelah dipanggil dengan patut, teguran (aanmaning) tidak dapat disampaikan secara langsung, dan Ketua akan mempertimbangkan '
            'permohonan Pemohon Eksekusi untuk memerintahkan penyitaan dan pelaksanaan #3942# sesuai Pasal 208 RBg;',
            'Setelah itu Ketua menyatakan sidang teguran (aanmaning) ditutup;',
            'Demikian berita acara teguran (aanmaning) ini dibuat dengan sebenarnya dan ditandatangani oleh Ketua dan Panitera.',
        ],
        tabel=TTD_ANMN,
    ),
    dict(
        berkas='BAS ALUR 75 Eksekusi - [1b] Sidang Teguran (Aanmaning) - Termohon Eksekusi Bersedia Melaksanakan Secara Sukarela.rtf',
        judul='BERITA ACARA TEGURAN (AANMANING)',
        badan=[
            PEMBUKA_ANMN, PIHAK,
            'Setelah sidang teguran dibuka oleh Ketua, Termohon Eksekusi dipanggil menghadap, dan ternyata Termohon Eksekusi hadir di persidangan;',
            ISI_PUTUSAN_ANMN,
            'Atas teguran Ketua, Termohon Eksekusi menyatakan bersedia melaksanakan isi putusan tersebut secara sukarela, dengan keterangan sebagai berikut: #3969#;',
            'Ketua menetapkan agar pelaksanaan secara sukarela tersebut diselesaikan dalam waktu #3963# terhitung sejak hari ini, dan ' + PERINGATAN_208,
            'Setelah itu Ketua menyatakan sidang teguran (aanmaning) ditutup;',
            'Demikian berita acara teguran (aanmaning) ini dibuat dengan sebenarnya dan ditandatangani oleh Ketua dan Panitera.',
        ],
        tabel=TTD_ANMN,
    ),
    dict(
        berkas='BAS ALUR 75 Eksekusi - [2] Pelaksanaan Sita Eksekusi - Dibantu Dua Saksi (Pasal 210 RBg).rtf',
        judul='BERITA ACARA SITA EKSEKUSI',
        badan=[
            'Pada hari/tanggal #3958#, bertempat di lokasi objek sita, kami, #3945# selaku Jurusita atau Jurusita Pengganti #8008# yang ditunjuk oleh Ketua untuk melakukan penyitaan '
            'menggantikan Panitera #8004# berdasarkan Penetapan Ketua #8008# Nomor #3940# tanggal #3950# tentang Sita Eksekusi (Pasal 209 ayat (2) dan ayat (3) RBg), telah melaksanakan '
            'sita eksekusi untuk melaksanakan #3942#,' + ANTAR,
            PIHAK,
            'Penyitaan dilaksanakan dengan dibantu oleh dua orang saksi (Pasal 210 ayat (1) RBg), yang nama, pekerjaan, dan tempat tinggalnya adalah sebagai berikut:',
            '#3966#',
            'Sebelum penyitaan dilaksanakan, kami memberitahukan maksud kedatangan serta memberikan penjelasan tentang maksud penyitaan kepada Termohon Eksekusi atau yang mewakilinya '
            'apabila hadir, sebagaimana Pasal 209 ayat (4) RBg;',
            'Selanjutnya, dengan disaksikan oleh kedua saksi tersebut, kami telah meletakkan sita eksekusi terhadap objek sebagai berikut:',
            '#3964#',
            'Jalannya penyitaan dan keterangan yang diberikan pada saat penyitaan adalah sebagai berikut: #3967#;',
            'Terhadap objek yang disita dinyatakan bahwa objek tersebut berada dalam sitaan, dan Termohon Eksekusi dilarang memindahtangankan, membebani dengan suatu hak, atau menyewakan '
            'objek yang disita; khusus untuk barang tetap, larangan tersebut berlaku terhitung mulai hari diumumkannya berita acara penyitaan ini (Pasal 214 ayat (1) RBg);',
            'Berita acara penyitaan atas barang tetap akan diumumkan dengan mencatatnya dalam daftar di Kepaniteraan #8008# dan dengan meminta kepala desa atau lurah setempat untuk '
            'memaklumkannya kepada khalayak ramai menurut cara yang lazim di tempat itu (Pasal 213 RBg);',
            'Demikian berita acara sita eksekusi ini dibuat dengan sebenarnya dan ditandatangani oleh Jurusita, kedua saksi tersebut di atas, dan Termohon Eksekusi atau yang '
            'mewakilinya apabila hadir.',
        ],
        tabel=[('Jurusita', '#3945#', 'Termohon Eksekusi', TITIK_NAMA), SAKSI_TTD],
    ),
    dict(
        berkas='BAS ALUR 75 Eksekusi - [3] Pelaksanaan Konstatering - Pencocokan Objek Eksekusi.rtf',
        judul='BERITA ACARA KONSTATERING',
        badan=[
            'Pada hari/tanggal #3959#, bertempat di lokasi objek eksekusi, kami, #3945# selaku Jurusita atau Jurusita Pengganti #8008#, berdasarkan Penetapan Ketua #8008# Nomor #3940# '
            'tanggal #3954# tentang Konstatering, telah melakukan pencocokan (konstatering) atas objek eksekusi untuk melaksanakan #3942#,' + ANTAR,
            PIHAK,
            'Konstatering dilaksanakan dengan disaksikan oleh dua orang saksi, yaitu:',
            '#3965#',
            'Objek yang menurut amar putusan harus dicocokkan adalah sebagai berikut:',
            '#3964#',
            'Jalannya pencocokan, pihak-pihak yang hadir, serta hasil pemeriksaan atau pengukuran atas letak, luas, dan batas-batas objek tersebut adalah sebagai berikut: #3967#;',
            'Hasil pencocokan tersebut dicatat dan dilaporkan kepada Ketua sebagai bahan untuk memerintahkan pelaksanaan eksekusi lebih lanjut;',
            'Demikian berita acara konstatering ini dibuat dengan sebenarnya dan ditandatangani oleh Jurusita, kedua saksi tersebut di atas, dan Pemohon Eksekusi atau kuasanya apabila hadir.',
        ],
        tabel=[('Jurusita', '#3945#', 'Pemohon Eksekusi', TITIK_NAMA), SAKSI_TTD],
    ),
    dict(
        berkas='BAS ALUR 75 Eksekusi - [4] Pelaksanaan Eksekusi Riil - Berhasil.rtf',
        judul='BERITA ACARA PELAKSANAAN EKSEKUSI RIIL',
        badan=None,   # diisi _bas_riil(True)
        tabel=[('Jurusita', '#3945#', 'Pemohon Eksekusi', TITIK_NAMA), SAKSI_TTD],
        riil=True,
    ),
    dict(
        berkas='BAS ALUR 75 Eksekusi - [4a] Pelaksanaan Eksekusi Riil - Tidak Berhasil atau Ditunda.rtf',
        judul='BERITA ACARA PELAKSANAAN EKSEKUSI RIIL',
        badan=None,
        tabel=[('Jurusita', '#3945#', 'Pemohon Eksekusi', TITIK_NAMA), SAKSI_TTD],
        riil=False,
    ),
    dict(
        berkas='BAS ALUR 75 Eksekusi - [5] Penyerahan Hasil Lelang kepada Pihak yang Berhak.rtf',
        judul='BERITA ACARA PENYERAHAN HASIL LELANG',
        badan=[
            'Pada hari/tanggal #3961#, bertempat di #8008#, kami, Panitera #8004#, berdasarkan Penetapan Ketua #8008# Nomor #3940# tanggal #3952# tentang Perintah Penjualan Lelang, '
            'telah menyerahkan hasil lelang atas objek yang dijual lelang dalam rangka melaksanakan #3942#,' + ANTAR,
            PIHAK,
            'Objek yang dijual lelang adalah sebagai berikut:',
            '#3964#',
            'Penjualan lelang dilakukan dengan perantaraan kantor lelang menurut Pasal 215 ayat (1) RBg, dengan hasil lelang serta penyerahannya sebagai berikut: #3967#;',
            'Hasil lelang tersebut, setelah dikurangi biaya yang sah, telah diserahkan kepada pihak yang berhak sesuai amar putusan, dan pihak yang menerima menyatakan telah menerimanya;',
            'Dengan penyerahan ini, penyerahan hasil lelang kepada pihak yang berhak telah selesai dilaksanakan;',
            'Demikian berita acara penyerahan hasil lelang ini dibuat dengan sebenarnya dan ditandatangani oleh Panitera selaku yang menyerahkan dan oleh pihak yang menerima.',
        ],
        tabel=[('Panitera', '#8004#', 'Pemohon Eksekusi', TITIK_NAMA)],
    ),
]


def _bas_riil(berhasil):
    badan = [
        'Pada hari/tanggal #3960#, bertempat di lokasi objek eksekusi, kami, #3945# selaku Jurusita atau Jurusita Pengganti #8008#, berdasarkan Penetapan Ketua #8008# Nomor #3940# '
        'tanggal #3951# tentang Perintah Eksekusi Riil, telah melaksanakan eksekusi riil untuk melaksanakan #3942#,' + ANTAR,
        PIHAK,
        'Pelaksanaan eksekusi disaksikan oleh dua orang saksi, yaitu:',
        '#3965#',
        'Sebelum eksekusi dilaksanakan, kami membacakan Penetapan Ketua tersebut dan amar putusan yang akan dilaksanakan, serta menjelaskan maksud dan tujuan eksekusi kepada '
        'Termohon Eksekusi dan pihak-pihak yang hadir;',
        'Objek yang dieksekusi adalah sebagai berikut:',
        '#3964#',
        'Jalannya pelaksanaan eksekusi, pihak-pihak yang hadir, serta pernyataan para pihak adalah sebagai berikut: #3967#;',
    ]
    if berhasil:
        badan += [
            'Dengan demikian eksekusi riil telah dilaksanakan dengan berhasil, dan objek eksekusi tersebut di atas telah dikosongkan dan/atau diserahkan kepada Pemohon Eksekusi sesuai amar putusan;',
            'Pemohon Eksekusi menyatakan telah menerima penyerahan objek eksekusi tersebut;',
            'Demikian berita acara pelaksanaan eksekusi riil ini dibuat dengan sebenarnya dan ditandatangani oleh Jurusita, kedua saksi tersebut di atas, dan Pemohon Eksekusi atau kuasanya.',
        ]
    else:
        badan += [
            'Oleh karena keadaan sebagaimana diuraikan di atas, eksekusi riil tidak dapat dilaksanakan seluruhnya pada hari ini dan dinyatakan tidak berhasil atau ditunda, dengan alasan '
            'sebagai berikut: #3968#;',
            'Pelaksanaan eksekusi selanjutnya akan ditentukan oleh Ketua dan diberitahukan kepada para pihak, dan berita acara ini disampaikan kepada Ketua sebagai bahan penetapan lebih lanjut;',
            'Demikian berita acara pelaksanaan eksekusi riil ini dibuat dengan sebenarnya dan ditandatangani oleh Jurusita, kedua saksi tersebut di atas, dan Pemohon Eksekusi atau kuasanya.',
        ]
    return badan


def _tabel_ttd(r, kiri_j, kiri_n, kanan_j, kanan_n):
    r.out.append(_jaga(r.b.d.par[15], 'keepn').replace('\\trowd', '\\trowd \\trkeep', 1))   # baris tanda tangan tidak terpotong antar halaman
    r.teks(16, kiri_j + ',')
    for i in (17, 18, 19):
        r.raw(i)
    r.teks(20, kiri_n)
    r.teks(21, kanan_j + ',')
    for i in (22, 23, 24):
        r.raw(i)
    r.teks(25, kanan_n)
    r.out.append(r.b.d.par[26].replace('\\trowd', '\\trowd \\trkeep', 1))


def susun_bas(spec, folder_keluar):
    b = Berkas(DASAR_BAS)
    r = Rakit(b)
    r.raw(0)
    r.raw(1)
    r.teks(2, spec['judul'])
    r.teks(3, 'Nomor #3940#')
    r.teks(4, 'Pelaksanaan Putusan Perkara Nomor #0001#')
    r.raw(5)
    badan = spec['badan'] if spec.get('badan') else _bas_riil(spec['riil'])
    sudah = False   # singkatan RBg diuraikan pada penyebutan pertama
    for x in badan:
        if x != PIHAK and not sudah and 'RBg' in x:
            x = x.replace('RBg', RBG, 1)
            sudah = True
        if x == PIHAK:
            r.out.append(_blok(b.d.ganti_teks(6, '#3943#')))
            r.teks(4, 'Melawan')
            r.out.append(_blok(b.d.ganti_teks(6, '#3944#')))
        else:
            if x in BLOK_ISIAN:
                r.out.append(_blok(b.d.ganti_teks(6, x)))
            else:
                r.teks(6, x)
    r.out[-1] = _jaga(r.out[-1], 'keepn')            # kalimat penutup bersama tanda tangan
    for kj, kn, kaj, kan in spec['tabel']:
        _tabel_ttd(r, kj, kn, kaj, kan)
    r.raw(27)
    perlu = isian_diperlukan(''.join(r.out))
    r.out[0] = b.d.ganti_teks(0, ' '.join('#%04d#' % n for n in perlu))
    tujuan = os.path.join(folder_keluar, spec['berkas'])
    r.selesai(tujuan)
    return tujuan


def bangun(S):
    """Dipanggil bangun_semua.py: menyusun semua penetapan dan BAS eksekusi; mengembalikan jumlah berkas."""
    pen = os.path.join(KELUAR, S['folder'])
    bas = os.path.join(KELUAR, S['folder'] + ' - BAS')
    os.makedirs(B.lp(pen), exist_ok=True)
    os.makedirs(B.lp(bas), exist_ok=True)
    n = 0
    for spec in PENETAPAN:
        susun_penetapan(spec, pen)
        n += 1
    for spec in BAS:
        susun_bas(spec, bas)
        n += 1
    return n
