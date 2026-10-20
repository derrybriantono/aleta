# -*- coding: utf-8 -*-
"""Spesifikasi blangko VERZET (perlawanan Tergugat/Termohon atas PUTUSAN VERSTEK dalam perkara yang SAMA; folder "96a Verzet" dan "96a Verzet - BAS").

Bukan perkara baru: pihak berubah sebutan menjadi Pelawan (Tergugat/Termohon asal) dan Terlawan (Penggugat/Pemohon asal); ABT bekerja per perkara_id perkara ASAL.
Mesin gugatan.py TIDAK dipakai (susunan putusan verzet berbeda), maka modul ini menyediakan bangun(S) sendiri.

PUTUSAN/PENETAPAN (kerangka Derry dari 6c Nafkah Anak; teks diganti per jangkar, paragraf lain dipakai ulang):
  [01] Kabul   perlawanan dikabulkan: Pelawan yang benar, putusan verstek dibatalkan, pokok perkara diadili kembali (hasil dipilih hakim: A tolak / B NO / C amar bebas)
  [02] Tolak   perlawanan ditolak, putusan verstek dikuatkan
  [98] Cabut (PENETAPAN) sebelum Terlawan menjawab      [98b] Cabut (PENETAPAN) sesudah jawaban dengan persetujuan Terlawan
  [98a] Gugur  Pelawan tidak hadir (Pasal 148 RBg jo. Pasal 153 ayat (4) RBg)
  [99] NO lewat tenggang (Pasal 153 ayat (2), (3) RBg)   [99a] NO cacat formil / bukan yang berhak (Pasal 153 ayat (1))   [99b] NO Pelawan diputus verstek lagi (Pasal 153 ayat (6))
BAS 'BAS ALUR 76 Verzet - [kode] uraian.rtf': sidang pertama (4 keadaan kehadiran), replik-duplik, pembuktian Pelawan dan Terlawan (2 dan 3 saksi), kesimpulan, pembacaan
  putusan, Pelawan tidak hadir lagi (gugur), pencabutan (sebelum jawaban, sesudah jawaban setuju atau menolak).
  Pembuktian dibuat dari BAS pembuktian ALUR 04 dengan PERTUKARAN DATA: Pelawan = sisi T (nama #0102#, saksi T 6100.., tanya jawab 6120..), Terlawan = sisi P (nama #0098#,
  saksi P 1197.., tanya jawab 5058..) sebab ABT menyimpan saksi menurut sisi perkara asal.

Dasar hukum yang dicetak (bunyi dibaca dari rbg-unnes.txt): Pasal 148, 149 ayat (3), 153 ayat (1)-(6), 154 ayat (1), 192 ayat (1) dan (4), 207, 208, 283 RBg. Pasal 271 Rv, Pasal 1865
KUHPerdata, Pasal 171/172/175/307/308 RBg, Pasal 55 dan 103 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 hanya paragraf yang SUDAH ada pada blangko Derry (dipakai ulang tanpa diubah).
Lihat spek/PASAL-verzet.md.
"""
import os
import re

from pustaka import ASLI, KELUAR, Berkas, Rakit

SPEK = dict(
    kode='verzet',
    kunci='verzet',
    label='perlawanan (verzet) atas putusan verstek',
    nama_berkas='Verzet',
    folder='96a Verzet',
    isian_bas=[3980, 3981, 3982, 3983, 3984, 3999],
    perdamaian=False,
)

DASAR = os.path.join(ASLI, '6c Nafkah Anak')
DASAR_BAS = os.path.join(ASLI, '6c Nafkah Anak - BAS')
KONTRA = '[01] [Kabul] Nafkah Anak - Kontradiktoir.rtf'
GUGUR = '[98a] [Gugur] Nafkah Anak - P Tidak Hadir Sidang Pertama.rtf'
CABUT = '[98] [Cabut] Nafkah Anak - P & T Hadir Sebelum Jawaban.rtf'
CABUT_B = '[98b] [Cabut] Nafkah Anak - Sesudah Jawaban dengan Persetujuan T.rtf'

PV = 'putusan verstek #8008# #3972#'


# ------------------------------------------------------------------------------------------------------------------
# Alat bantu
# ------------------------------------------------------------------------------------------------------------------
class Doc(object):
    def __init__(self, folder, nama):
        self.nama = nama
        self.b = Berkas(os.path.join(folder, nama))
        self.r = Rakit(self.b)
        self.t = self.b.t
        self.n = self.b.n

    def ix(self, rx, mulai=0, akhir=None):
        i = self.b.cari(rx, mulai, akhir)
        if i is None:
            raise ValueError('%s: jangkar %r tidak ditemukan (mulai %d)' % (self.nama, rx, mulai))
        return i

    def raw(self, i):
        self.r.raw(i)

    def T(self, i, teks):
        self.r.teks(i, teks)

    def N(self, i, n, teks):
        self.r.nomor(i, n, teks)

    def F(self, i, pasangan):
        self.r.frasa(i, pasangan)

    def simpan(self, folder, nama, tokens=None):
        os.makedirs(folder, exist_ok=True)
        self.r.selesai(os.path.join(folder, nama), tokens)


def kepala(d, i_dp):
    """Paragraf 0 .. i_dp-1: kop, nomor, sebutan perkara, identitas Pelawan (3970) dan Terlawan (3971)."""
    for i in range(i_dp):
        t = d.t[i]
        if t.startswith('Memeriksa dan mengadili perkara perdata agama'):
            d.F(i, [('dalam perkara nafkah anak antara:', 'dalam perkara perlawanan (verzet) atas putusan verstek antara:')])
        elif t == '#7047#':
            d.T(i, '#3970#')
        elif t.startswith('#7048#'):
            d.T(i, '#3971#')
        elif t.startswith('Telah mempelajari'):
            d.T(i, 'Telah mempelajari berkas perkara dan %s;' % PV)
        elif t.startswith('Telah mendengar keterangan'):
            d.T(i, 'Telah mendengar keterangan Pelawan dan Terlawan di muka persidangan;')
        else:
            d.raw(i)


def ekor(d, i_kaki, pembuka):
    """Dari kalimat kaki sampai akhir: kaki memakai majelis VERZET (3996, 3997); rincian biaya diganti jumlah biaya perlawanan (3993, 3994)."""
    for i in range(i_kaki, d.n):
        t = d.t[i]
        if t.startswith('#8501#'):
            d.F(i, [('#8501#', pembuka), ('#8502#', '#3996#')])
        elif t == '#8500#':
            d.T(i, '#3997#')
        elif t.startswith('Rincian Biaya Perkara'):
            d.T(i, 'Rincian Biaya Perkara Perlawanan:')
        elif re.match(r'^\d\. .*Rp\t', t):
            continue
        elif t.startswith('J u m l a h'):
            d.F(i, [('#0143#', '#3993#')])
        elif t.startswith('(#0155# #7095#)'):
            d.T(i, '(#3994# rupiah).')
        else:
            d.raw(i)


def amar(d, i_model, butir):
    for n, teks in enumerate(butir, 1):
        d.N(i_model, n, teks)


BIAYA_AMAR = 'Membebankan kepada %s untuk membayar biaya perkara perlawanan ini sejumlah Rp#3993#,00 (#3994# rupiah).'
MENGINGAT_ADA = True

# ------------------------------------------------------------------------------------------------------------------
# Teks putusan kontradiktoir
# ------------------------------------------------------------------------------------------------------------------
DP_AWAL = ('Bahwa Pelawan dalam surat perlawanannya tanggal #3973# telah mengajukan perlawanan (verzet) terhadap ' + PV + ', yang telah terdaftar di Kepaniteraan #8008# '
           'pada tanggal #3974# dengan register Nomor #0001#, dengan dalil-dalil pada pokoknya sebagai berikut:')
DP_MOHON = ('Berdasarkan alasan/dalil-dalil di atas, Pelawan mohon agar #8008# c/q Majelis Hakim memeriksa dan mengadili perlawanan ini, selanjutnya menjatuhkan putusan '
            'yang amarnya berbunyi:')
DP_PEMBERITAHUAN = ('Bahwa putusan verstek tersebut telah diberitahukan kepada Pelawan pada tanggal #3975#, kemudian Pelawan mengajukan perlawanan yang didaftarkan di '
                    'Kepaniteraan #8008# pada tanggal #3974#;')
DP_PROSES = [
    'Bahwa, untuk memeriksa perlawanan tersebut #8554# telah memerintahkan Pelawan dan Terlawan untuk hadir di muka persidangan, dan terhadap panggilan tersebut pada hari-hari '
    'sidang yang telah ditetapkan Pelawan dan Terlawan telah hadir menghadap di persidangan;',
    'Bahwa, #8554# telah memeriksa identitas Pelawan dan Terlawan yang ternyata sesuai dengan yang tertera dalam surat perlawanan sebagai keterangan para pihak;',
    'Bahwa, #8554# telah berusaha mendamaikan Pelawan dan Terlawan pada setiap tahap persidangan sesuai Pasal 154 ayat (1) RBg agar dapat menyelesaikan perkara secara damai, '
    'namun upaya damai tersebut tidak berhasil;',
    'Bahwa, #8554# memulai pemeriksaan perlawanan dengan membacakan surat perlawanan Pelawan tanggal #3973#, yang isi dan maksudnya serta tujuannya tetap dipertahankan oleh Pelawan;',
]
DP_JAWAB = ['Bahwa, terhadap dalil-dalil perlawanan tersebut, Terlawan mengajukan jawaban yang pada pokoknya sebagai berikut:', '#3982#']
DP_REPLIK = ('Bahwa, terhadap jawaban Terlawan, Pelawan mengajukan repliknya dan Terlawan mengajukan dupliknya, sebagaimana termuat selengkapnya dalam berita acara sidang '
             'yang merupakan bagian yang tidak terpisahkan dari putusan ini;')
DP_BUKTI_PELAWAN = 'Bahwa, untuk menguatkan dalil-dalil perlawanannya, Pelawan mengajukan alat-alat bukti di muka persidangan yang pada pokoknya dapat diuraikan sebagai berikut:'
DP_BUKTI_TERLAWAN = ('Bahwa selanjutnya Pelawan menyatakan telah cukup dengan alat-alat buktinya, kemudian #8554# memberikan kesempatan kepada Terlawan untuk mengajukan alat-alat '
                     'bukti di muka persidangan; untuk menguatkan dalil-dalil gugatan semula dan bantahannya terhadap perlawanan, Terlawan mengajukan alat-alat bukti yang pada '
                     'pokoknya dapat diuraikan sebagai berikut:')
SAKSI_PELAWAN = [
    ('1.\t#6100#, umur #6101# tahun, agama #6102#, pendidikan #6103#, pekerjaan #6104#, bertempat tinggal di #6105#, saksi mengaku sebagai #1251#, di bawah sumpahnya telah '
     'memberikan keterangan di muka persidangan yang pada pokoknya sebagai berikut:', '#9264#'),
    ('2.\t#6106#, umur #6107# tahun, agama #6108#, pendidikan #6109#, pekerjaan #6110#, bertempat tinggal di #6111#, saksi mengaku sebagai #1252#, di bawah sumpahnya telah '
     'memberikan keterangan di muka persidangan yang pada pokoknya sebagai berikut:', '#9265#'),
]
SAKSI_TERLAWAN = [
    ('1.\t#1197#, umur #1198# tahun, agama #1199#, pendidikan #1200#, pekerjaan #1201#, bertempat tinggal di #1202#, saksi mengaku sebagai #1241#, di bawah sumpahnya telah '
     'memberikan keterangan di muka persidangan yang pada pokoknya sebagai berikut:', '#9259#'),
    ('2.\t#1203#, umur #1204# tahun, agama #1205#, pendidikan #1206#, pekerjaan #1207#, bertempat tinggal di #1208#, saksi mengaku sebagai #1242#, di bawah sumpahnya telah '
     'memberikan keterangan di muka persidangan yang pada pokoknya sebagai berikut:', '#9260#'),
]
DP_AKHIR = [
    'Bahwa selanjutnya Terlawan menyatakan telah cukup dengan alat-alat buktinya dan tidak akan mengajukan bukti suatu apapun lagi dalam perkara a quo;',
    'Bahwa, Pelawan telah menyampaikan kesimpulannya di persidangan yang pada pokoknya #9256#',
    'Bahwa, Terlawan telah menyampaikan kesimpulannya di persidangan yang pada pokoknya #9255#',
]
DP_SINGKAT = 'Bahwa, untuk singkatnya uraian putusan ini, maka semua hal yang termuat dalam berita acara sidang merupakan bagian yang tidak terpisahkan dari putusan ini;'

PH_MAKSUD = 'Menimbang, bahwa maksud dan tujuan perlawanan Pelawan adalah sebagaimana diuraikan di atas;'
PH_PANGGILAN = [
    'Menimbang, bahwa Pelawan dan Terlawan telah dipanggil secara resmi dan patut untuk menghadap di muka persidangan pada hari dan tanggal sidang yang telah ditetapkan, di mana '
    'pemanggilan tersebut telah dilaksanakan sesuai ketentuan Pasal 55 dan Pasal 103 ayat (1) dan ayat (2) Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana '
    'telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan Undang-Undang Nomor 50 Tahun 2009, jo. Pasal 145 dan Pasal 146 RBg;',
    'Menimbang, bahwa terhadap panggilan tersebut, pada hari-hari sidang yang telah ditetapkan Pelawan dan Terlawan telah hadir menghadap di persidangan;',
]
PH_DAMAI = ('Menimbang, bahwa oleh karena Pelawan dan Terlawan telah hadir menghadap di muka persidangan, maka #8554# terlebih dahulu berupaya mendamaikan para pihak agar '
            'menyelesaikan perkaranya secara kekeluargaan sesuai ketentuan Pasal 154 ayat (1) RBg, akan tetapi tidak berhasil;')
PH_KEWENANGAN = ('Menimbang, bahwa perlawanan Pelawan diajukan terhadap ' + PV + '; Pasal 149 ayat (3) RBg menentukan bahwa putusan atas gugatan yang dikabulkan diberitahukan '
                 'kepada tergugat yang tidak hadir disertai peringatan tentang haknya mengajukan perlawanan kepada pengadilan yang sama, dan Pasal 153 ayat (4) RBg menentukan '
                 'bahwa tuntutan perlawanan disampaikan dan diperiksa dengan cara yang biasa berlaku untuk gugatan perdata biasa; oleh karena itu #8008# yang telah memeriksa '
                 'dan memutus perkara asal berwenang pula memeriksa dan mengadili perlawanan a quo;')
PH_STANDING = ('Menimbang, bahwa Pasal 153 ayat (1) RBg menentukan bahwa tergugat yang perkaranya diputus tanpa kehadirannya dan tidak dapat menerima putusan itu dapat mengajukan '
               'perlawanan; Pelawan adalah #0047# dalam perkara asal yang telah diputus dengan verstek berdasarkan ' + PV + ' dan menyatakan tidak dapat menerima putusan tersebut, '
               'sehingga Pelawan mempunyai kedudukan hukum (legal standing) untuk mengajukan perlawanan a quo;')
PH_BEBAN = ('Menimbang, bahwa oleh karena perlawanan diperiksa dengan cara yang biasa berlaku untuk gugatan perdata biasa sebagaimana Pasal 153 ayat (4) RBg, maka sesuai Pasal 283 RBg '
            'Pelawan wajib membuktikan dalil-dalil perlawanannya, sedangkan Terlawan wajib membuktikan dalil-dalil gugatannya yang dibantah oleh Pelawan serta bantahannya terhadap '
            'perlawanan;')
PH_FAKTA_AWAL = ('Menimbang, bahwa berdasarkan dalil-dalil perlawanan Pelawan, jawaban Terlawan, dan alat-alat bukti yang diajukan para pihak, #8554# menemukan fakta hukum '
                 'sebagai berikut:')
PH_FAKTA = [
    'Bahwa Terlawan semula #0046# telah mengajukan #0053# terhadap Pelawan semula #0047# di #8008#, dan perkara tersebut telah diputus dengan verstek berdasarkan ' + PV + ';',
    'Bahwa putusan verstek tersebut diberitahukan kepada Pelawan pada tanggal #3975# dan Pelawan mengajukan perlawanan yang didaftarkan pada tanggal #3974#;',
    'Bahwa #3999#;',
]
MENGINGAT = 'Mengingat segala ketentuan dan peraturan perundang-undangan yang berlaku dan hukum Islam yang berkaitan dengan perkara ini.'
LANGSUNG = 'Memerintahkan agar ' + PV + ' tetap dijalankan;'
BIAYA_KALAH = ('Menimbang, bahwa oleh karena perlawanan Pelawan %s, maka sesuai Pasal 192 ayat (1) RBg Pelawan sebagai pihak yang dikalahkan dihukum untuk membayar biaya perkara '
               'perlawanan ini%s;')

DUDUK_BEBAS = '#3999#'


def duduk_kontra(d, dp, lengkap, jawab):
    """Duduk perkara putusan kontradiktoir. lengkap=True: pembuktian dan kesimpulan (kabul, tolak). jawab=True: jawaban dan replik-duplik."""
    m_p, m_posita, m_berd, m_pet = dp + 1, dp + 2, dp + 3, dp + 4
    m_body = d.ix(r'^(#8507#)?Bahwa, demi kepentingan dimulainya pemeriksaan', dp)
    d.raw(dp)
    d.T(m_p, DP_AWAL)
    d.T(m_posita, '#3980#')
    d.T(m_berd, DP_MOHON)
    d.T(m_pet, '#3981#')
    d.T(m_body, DP_PEMBERITAHUAN)
    for teks in DP_PROSES:
        d.T(m_body, teks)
    if jawab:
        for teks in DP_JAWAB:
            d.T(m_body, teks)
        d.T(m_body, DP_REPLIK)
    if lengkap:
        a1 = d.ix(r'^A\.\tBukti Surat:', dp)
        m_head, m_surat, m_sak, m_saks, m_ket = a1, a1 + 1, a1 + 2, a1 + 3, a1 + 4
        for awal, surat, saksi in ((DP_BUKTI_PELAWAN, '#3983#', SAKSI_PELAWAN), (DP_BUKTI_TERLAWAN, '#3984#', SAKSI_TERLAWAN)):
            d.T(m_body, awal)
            d.T(m_head, 'A.\tBukti Surat:')
            d.T(m_surat, surat)
            d.T(m_sak, 'B.\tSaksi:')
            for (baris, ket) in saksi:
                d.T(m_saks, baris)
                d.T(m_ket, ket)
        for teks in DP_AKHIR:
            d.T(m_body, teks)
    d.T(m_body, DP_SINGKAT)


def susun_kontra(nama_keluar, kind, folder_keluar):
    """kind: 'kabul' | 'tolak' | 'no_tenggang' | 'no_formil' | 'no_ulang'."""
    d = Doc(DASAR, KONTRA)
    dp = d.ix(r'^DUDUK PERKARA$')
    kepala(d, dp)
    putus = kind in ('kabul', 'tolak')
    duduk_kontra(d, dp, lengkap=putus, jawab=putus)

    ph = d.ix(r'^PERTIMBANGAN HUKUM$')
    b_model = d.ix(r'^Menimbang, bahwa maksud dan tujuan', ph)
    h_model = d.ix(r'^Mengenai Panggilan dan Kehadiran Para Pihak$', ph)
    f_model = d.ix(r'menemukan fakta hukum sebagai berikut', ph) + 1
    asas = d.ix(r'^Menimbang, bahwa asas kardinal', ph)
    ev1 = d.ix(r'^Menimbang, bahwa terhadap bukti surat yang diajukan para pihak', ph)
    ev2 = d.ix(r'akta otentik \(authentieke akte\)', ph)
    ev3 = d.ix(r'^Menimbang, bahwa saksi-saksi yang diajukan para pihak', ph)
    mengingat = d.ix(r'^Mengingat segala ketentuan', ph)
    mengadili = d.ix(r'^MENGADILI$', ph)
    a_model = mengadili + 1
    kaki = d.ix(r'^#8501#', mengadili)
    if not re.search(r'[؀-ۿ]', d.t[asas + 1]):
        raise ValueError('kutipan Arab tidak berada tepat sesudah asas kardinal')

    d.raw(ph)
    d.T(b_model, PH_MAKSUD)
    d.T(h_model, 'Mengenai Panggilan dan Kehadiran Para Pihak')
    for teks in PH_PANGGILAN:
        d.T(b_model, teks)
    d.T(h_model, 'Mengenai Upaya Damai')
    d.T(b_model, PH_DAMAI)
    d.T(h_model, 'Mengenai Kewenangan Mengadili')
    d.T(b_model, PH_KEWENANGAN)
    if kind not in ('no_formil', 'no_ulang'):
        d.T(h_model, 'Mengenai Kedudukan Hukum Pelawan dan Tenggang Waktu Perlawanan')
        d.T(b_model, PH_STANDING)
        d.T(b_model, '#3976#')

    if kind == 'no_tenggang':
        d.T(h_model, 'Mengenai Syarat Formil Perlawanan')
        d.T(b_model, 'Menimbang, bahwa pengajuan perlawanan terikat pada tenggang waktu yang ditentukan Pasal 153 ayat (2) RBg, yang dapat diperpanjang oleh Pengadilan menurut '
                     'keadaan sebagaimana Pasal 153 ayat (3) RBg; tenggang waktu tersebut merupakan syarat formil perlawanan sehingga #8554# wajib menilainya lebih dahulu sebelum '
                     'mempertimbangkan dalil-dalil perlawanan;')
        d.T(b_model, 'Menimbang, bahwa oleh karena perlawanan Pelawan diajukan setelah lewat tenggang waktu sebagaimana dipertimbangkan di atas, dan tidak ternyata Pengadilan '
                     'memperpanjang tenggang waktu tersebut, maka perlawanan Pelawan tidak memenuhi syarat formil sehingga tidak dapat dipertimbangkan pokok perlawanannya dan '
                     'harus dinyatakan tidak dapat diterima (niet ontvankelijk verklaard);')
        butir, pihak = ['Menyatakan perlawanan Pelawan tidak dapat diterima;', LANGSUNG], 'Pelawan'
        biaya = BIAYA_KALAH % ('dinyatakan tidak dapat diterima', '')
    elif kind == 'no_formil':
        d.T(h_model, 'Mengenai Syarat Formil Perlawanan')
        d.T(b_model, 'Menimbang, bahwa sebelum mempertimbangkan dalil-dalil perlawanan, #8554# terlebih dahulu menilai syarat formil perlawanan, yaitu bahwa perlawanan hanya dapat '
                     'diajukan oleh tergugat yang perkaranya diputus tanpa kehadirannya sebagaimana Pasal 153 ayat (1) RBg;')
        d.T(b_model, 'Menimbang, bahwa #3986#;')
        d.T(b_model, 'Menimbang, bahwa oleh karena itu perlawanan Pelawan tidak memenuhi syarat formil sehingga tidak dapat dipertimbangkan pokok perlawanannya dan harus '
                     'dinyatakan tidak dapat diterima (niet ontvankelijk verklaard);')
        butir, pihak = ['Menyatakan perlawanan Pelawan tidak dapat diterima;', LANGSUNG], 'Pelawan'
        biaya = BIAYA_KALAH % ('dinyatakan tidak dapat diterima', '')
    elif kind == 'no_ulang':
        d.T(h_model, 'Mengenai Syarat Formil Perlawanan')
        d.T(b_model, 'Menimbang, bahwa Pasal 153 ayat (6) RBg menentukan bahwa pelawan yang membiarkan diri diputus lagi tanpa kehadirannya dan mengajukan tuntutan perlawanan lagi, '
                     'tuntutan itu dinyatakan tidak dapat diterima;')
        d.T(b_model, 'Menimbang, bahwa #3986#;')
        d.T(b_model, 'Menimbang, bahwa oleh karena itu perlawanan Pelawan yang diajukan lagi tersebut dinyatakan tidak dapat diterima (niet ontvankelijk verklaard) tanpa '
                     'mempertimbangkan pokok perlawanannya;')
        butir, pihak = ['Menyatakan perlawanan Pelawan tidak dapat diterima;', LANGSUNG], 'Pelawan'
        biaya = BIAYA_KALAH % ('dinyatakan tidak dapat diterima', '')
    else:
        d.T(h_model, 'Mengenai Beban Pembuktian')
        for k in (asas, asas + 1, asas + 2):
            d.raw(k)
        d.T(b_model, PH_BEBAN)
        d.T(h_model, 'Mengenai Penilaian Alat Bukti')
        for k in (ev1, ev2, ev3):
            d.raw(k)
        d.T(h_model, 'Mengenai Fakta Hukum')
        d.T(b_model, PH_FAKTA_AWAL)
        for k, teks in enumerate(PH_FAKTA, 1):
            d.N(f_model, k, teks)
        d.T(h_model, 'Mengenai Perlawanan Pelawan')
        d.T(b_model, 'Menimbang, bahwa #3985#')
        if kind == 'kabul':
            d.T(b_model, 'Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, perlawanan Pelawan beralasan hukum dan patut dikabulkan, Pelawan adalah '
                         'Pelawan yang benar, dan ' + PV + ' harus dibatalkan;')
            d.T(h_model, 'Mengenai Pokok Perkara Sesudah Putusan Verstek Dibatalkan')
            d.T(b_model, 'Menimbang, bahwa oleh karena putusan verstek tersebut dibatalkan dan perlawanan diperiksa dengan cara yang biasa berlaku untuk gugatan perdata biasa '
                         'sebagaimana Pasal 153 ayat (4) RBg, maka #8554# memeriksa dan mengadili kembali pokok perkara sebagaimana diajukan oleh Terlawan semula #0046#;')
            d.T(b_model, '#3988#')
            butir = ['Menyatakan Pelawan adalah Pelawan yang benar;', 'Mengabulkan perlawanan Pelawan;', 'Membatalkan ' + PV + ';', 'Mengadili kembali: #3990#']
            pihak = 'Terlawan'
            biaya = ('Menimbang, bahwa oleh karena perlawanan Pelawan dikabulkan, maka sesuai Pasal 192 ayat (1) RBg Terlawan sebagai pihak yang dikalahkan dihukum untuk membayar '
                     'biaya perkara perlawanan ini, sedangkan menurut Pasal 192 ayat (4) RBg biaya perkara yang diputus tanpa kehadiran tergugat tetap menjadi tanggungan tergugat '
                     'meskipun ia dimenangkan dalam putusan perlawanan, kecuali jika pada pemeriksaan perlawanan ia ternyata tidak dipanggil dengan sepatutnya;')
        else:
            d.T(b_model, 'Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, dalil-dalil perlawanan Pelawan tidak terbukti sehingga Pelawan adalah Pelawan '
                         'yang tidak benar, perlawanan Pelawan harus ditolak, dan ' + PV + ' harus dikuatkan;')
            d.T(b_model, 'Menimbang, bahwa sesuai Pasal 153 ayat (5) RBg pengajuan tuntutan perlawanan mencegah pelaksanaan putusan, kecuali bila ditentukan dalam putusannya agar '
                         'dilaksanakan meskipun ada perlawanan; oleh karena perlawanan Pelawan ditolak, tidak ada lagi alasan untuk menunda pelaksanaan putusan verstek tersebut;')
            butir = ['Menyatakan Pelawan adalah Pelawan yang tidak benar;', 'Menolak perlawanan Pelawan;', 'Menguatkan ' + PV + ';']
            pihak = 'Pelawan'
            biaya = ('Menimbang, bahwa oleh karena perlawanan Pelawan ditolak, maka sesuai Pasal 192 ayat (1) RBg Pelawan sebagai pihak yang dikalahkan dihukum untuk membayar '
                     'biaya perkara perlawanan ini, sedangkan menurut Pasal 192 ayat (4) RBg biaya perkara yang diputus tanpa kehadiran tergugat tetap menjadi tanggungan tergugat;')
    d.T(h_model, 'Mengenai Biaya Perkara')
    d.T(b_model, biaya[:-1] + '#8185#')
    d.raw(mengingat)
    d.raw(mengadili)
    amar(d, a_model, butir + [BIAYA_AMAR % pihak])
    ekor(d, kaki, '#3995#')
    d.simpan(folder_keluar, nama_keluar)


def susun_gugur(nama_keluar, folder_keluar):
    d = Doc(DASAR, GUGUR)
    dp = d.ix(r'^DUDUK PERKARA$')
    kepala(d, dp)
    d.raw(dp)
    d.T(dp + 1, DP_AWAL)
    d.T(dp + 2, '#3980#')
    d.T(dp + 3, DP_MOHON)
    d.T(dp + 4, '#3981#')
    d.T(dp + 5, 'Bahwa, pada hari sidang yang telah ditetapkan untuk pemeriksaan perlawanan, Pelawan tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain '
                'sebagai wakil/kuasanya yang sah, meskipun menurut relaas panggilan yang dibacakan di persidangan Pelawan telah dipanggil secara resmi dan patut, dan tidak ternyata '
                'ketidakhadirannya disebabkan suatu halangan yang sah;')
    d.T(dp + 6, DP_SINGKAT)
    ph = d.ix(r'^PERTIMBANGAN HUKUM$')
    d.raw(ph)
    d.T(ph + 1, 'Menimbang bahwa maksud dan tujuan perlawanan Pelawan adalah sebagaimana diuraikan tersebut di atas;')
    d.T(ph + 2, 'Menimbang, bahwa Pasal 153 ayat (4) RBg menentukan bahwa tuntutan perlawanan disampaikan dan diperiksa dengan cara yang biasa berlaku untuk gugatan perdata biasa, '
                'sehingga terhadap Pelawan yang mengajukan tuntutan perlawanan berlaku pula Pasal 148 RBg yang menentukan bahwa penggugat yang telah dipanggil dengan sepatutnya '
                'tidak datang menghadap dan juga tidak menyuruh orang mewakilinya, gugatannya dinyatakan gugur dan penggugat dihukum untuk membayar biayanya;')
    d.T(ph + 2, 'Menimbang, bahwa oleh karena Pelawan yang telah dipanggil secara resmi dan patut tidak datang menghadap di persidangan pada hari sidang yang telah ditetapkan dan '
                'tidak pula menyuruh orang lain sebagai wakil/kuasanya, sedangkan tidak ternyata ketidakhadirannya disebabkan suatu halangan yang sah, maka berdasarkan Pasal 148 '
                'RBg jo. Pasal 153 ayat (4) RBg perlawanan Pelawan harus dinyatakan gugur;')
    d.T(ph + 2, 'Menimbang, bahwa oleh karena perlawanan Pelawan dinyatakan gugur, maka tidak ada lagi alasan untuk menunda pelaksanaan ' + PV + ' sebagaimana Pasal 153 ayat (5) '
                'RBg, sehingga putusan verstek tersebut tetap dijalankan;')
    d.T(ph + 3, 'Menimbang, bahwa oleh karena perlawanan Pelawan dinyatakan gugur, maka sesuai Pasal 148 RBg dan Pasal 192 ayat (1) RBg biaya perkara perlawanan dibebankan kepada '
                'Pelawan#8185#')
    mengingat = d.ix(r'^Mengingat segala ketentuan', ph)
    mengadili = d.ix(r'^MENGADILI$', ph)
    d.raw(mengingat)
    d.raw(mengadili)
    amar(d, mengadili + 1, ['Menyatakan perlawanan Pelawan gugur;', LANGSUNG, BIAYA_AMAR % 'Pelawan'])
    ekor(d, d.ix(r'^#8501#', mengadili), '#3995#')
    d.simpan(folder_keluar, nama_keluar)


def susun_cabut(nama_keluar, sesudah_jawaban, folder_keluar):
    d = Doc(DASAR, CABUT_B if sesudah_jawaban else CABUT)
    dp = d.ix(r'^DUDUK PERKARA$')
    kepala(d, dp)
    d.raw(dp)
    d.T(dp + 1, DP_AWAL)
    d.T(dp + 2, '#3980#')
    d.T(dp + 3, DP_MOHON)
    d.T(dp + 4, '#3981#')
    if sesudah_jawaban:
        d.T(dp + 5, 'Bahwa, untuk memeriksa perlawanan tersebut #8554# telah memerintahkan Pelawan dan Terlawan untuk hadir di muka persidangan, pada hari-hari persidangan yang '
                    'telah ditentukan Pelawan dan Terlawan telah datang dan menghadap di persidangan;')
        d.T(dp + 5, 'Bahwa, upaya perdamaian tidak berhasil, kemudian dibacakan surat perlawanan Pelawan dan atas perlawanan tersebut Terlawan telah mengajukan jawabannya;')
        d.T(dp + 5, 'Bahwa selanjutnya Pelawan menyatakan mencabut perlawanannya dengan alasan #8433# dan selanjutnya mohon penetapan;')
        d.T(dp + 5, 'Bahwa atas pencabutan tersebut, Terlawan di persidangan menyatakan menyetujuinya;')
    else:
        d.T(dp + 5, 'Bahwa, untuk memeriksa perlawanan tersebut #8554# telah memerintahkan Pelawan dan Terlawan untuk hadir di muka persidangan, pada hari-hari persidangan yang '
                    'telah ditentukan Pelawan dan Terlawan telah datang dan menghadap di persidangan;')
        d.T(dp + 5, 'Bahwa selanjutnya Pelawan menyatakan mencabut perlawanannya dengan alasan #8433# dan selanjutnya mohon penetapan;')
    d.T(dp + 5, 'Bahwa untuk singkatnya uraian penetapan ini maka semua berita acara persidangan ini dianggap telah termasuk dan merupakan bagian yang tidak terpisahkan dari penetapan ini;')
    ph = d.ix(r'^PERTIMBANGAN HUKUM$')
    d.raw(ph)
    d.T(ph + 1, 'Menimbang bahwa maksud dan tujuan perlawanan Pelawan adalah sebagaimana diuraikan tersebut di atas;')
    d.T(ph + 1, 'Menimbang bahwa pada persidangan yang telah ditetapkan, Pelawan hadir dan menyatakan mencabut perlawanannya;')
    if sesudah_jawaban:
        d.T(ph + 1, 'Menimbang bahwa oleh karena pencabutan dilakukan Pelawan setelah Terlawan mengajukan jawaban dan Terlawan telah menyatakan menyetujui pencabutan tersebut, '
                    'maka sesuai maksud Pasal 271 Rv pencabutan perlawanan yang diajukan Pelawan dapat dikabulkan;')
    else:
        d.T(ph + 1, 'Menimbang bahwa oleh karena pencabutan dilakukan Pelawan sebelum tahap Terlawan mengajukan jawaban maka sesuai maksud Pasal 271 Rv pencabutan perlawanan '
                    'yang diajukan Pelawan dapat dikabulkan tanpa harus mendapat persetujuan dari Terlawan;')
    d.T(ph + 1, 'Menimbang bahwa oleh karena permohonan Pelawan untuk mencabut perlawanannya dikabulkan #8554# maka pemeriksaan perlawanan dinyatakan telah selesai dan ' + PV +
                ' tetap berlaku;')
    d.T(ph + 1, 'Menimbang bahwa karena perlawanan dicabut dan telah didaftar dalam register perkara, untuk itu diperintahkan kepada Panitera #8008# untuk mencatat pencabutan '
                'perlawanan tersebut dalam register perkara;')
    d.T(ph + 1, 'Menimbang bahwa meskipun perlawanan dicabut, tetapi karena perlawanan telah didaftar dalam register perkara, maka biaya perkara perlawanan dibebankan kepada '
                'Pelawan sebagai pihak yang mengajukan perlawanan;')
    mengingat = d.ix(r'^Mengingat segala ketentuan', ph)
    menetapkan = d.ix(r'^MENETAPKAN$', ph)
    d.raw(mengingat)
    d.raw(menetapkan)
    amar(d, menetapkan + 1, ['Mengabulkan permohonan pencabutan perlawanan Pelawan terhadap ' + PV + ' dalam perkara Nomor #0001#;',
                             'Memerintahkan Panitera untuk mencatat pencabutan perlawanan tersebut dalam register perkara;',
                             'Menyatakan ' + PV + ' tetap berlaku;',
                             BIAYA_AMAR % 'Pelawan'])
    ekor(d, d.ix(r'^#8501#', menetapkan), 'Demikian ditetapkan dalam rapat musyawarah #8554#')
    d.simpan(folder_keluar, nama_keluar)


# ------------------------------------------------------------------------------------------------------------------
# PUTUSAN
# ------------------------------------------------------------------------------------------------------------------
PUTUSAN = [
    ('[01] [Kabul] Verzet - Perlawanan Dikabulkan - Putusan Verstek Dibatalkan.rtf', lambda n, f: susun_kontra(n, 'kabul', f)),
    ('[02] [Tolak] Verzet - Perlawanan Ditolak - Putusan Verstek Dikuatkan.rtf', lambda n, f: susun_kontra(n, 'tolak', f)),
    ('[98] [Cabut] Verzet - Pelawan Mencabut Perlawanan Sebelum Jawaban.rtf', lambda n, f: susun_cabut(n, False, f)),
    ('[98a] [Gugur] Verzet - Pelawan Tidak Hadir.rtf', susun_gugur),
    ('[98b] [Cabut] Verzet - Pelawan Mencabut Perlawanan Sesudah Jawaban dengan Persetujuan Terlawan.rtf', lambda n, f: susun_cabut(n, True, f)),
    ('[99] [NO] Verzet - Perlawanan Lewat Tenggang Waktu.rtf', lambda n, f: susun_kontra(n, 'no_tenggang', f)),
    ('[99a] [NO] Verzet - Cacat Formil atau Bukan Pihak yang Berhak.rtf', lambda n, f: susun_kontra(n, 'no_formil', f)),
    ('[99b] [NO] Verzet - Pelawan Diputus Verstek Lagi (Pasal 153 Ayat 6 RBg).rtf', lambda n, f: susun_kontra(n, 'no_ulang', f)),
]


# ------------------------------------------------------------------------------------------------------------------
# BAS
# ------------------------------------------------------------------------------------------------------------------
# pasangan (sisi P, sisi T); Pelawan = peran penggugat dalam BAS dasar dengan data sisi T, Terlawan = peran tergugat dengan data sisi P
PASANGAN_DATA = (
    [(1197 + i, 6100 + i) for i in range(6)] + [(1203 + i, 6106 + i) for i in range(6)] + [(6132 + i, 6138 + i) for i in range(6)] +
    [(1241, 1251), (1242, 1252), (6149, 8922), (5058, 6120), (5059, 6121), (5060, 8921), (7029, 7031), (7030, 7032), (7038, 7040),
     (9259, 9264), (9260, 9265), (98, 102)]
)
PERAN_P = ['#7036#', '#7085#', '#0046#']
PERAN_T = ['#7037#', '#7086#', '#0047#']
SISA_DILARANG = re.compile(r'#(0046|0047|7036|7037|7085|7086|0141|0142|1072|1073|1076|1077|8533|7080|0170|0106)#|Penggugat|Tergugat|Pemohon|Termohon', re.I)


def _pasang_tukar():
    """Daftar (lama, baru) bertahap: nomor sisi P <-> sisi T lewat penanda sementara, lalu kata peran."""
    tahap1, tahap2 = [], []
    for k, (p, t) in enumerate(PASANGAN_DATA):
        tahap1.append(('#%04d#' % p, '@@P%d@@' % k))
        tahap1.append(('#%04d#' % t, '@@T%d@@' % k))
        tahap2.append(('@@P%d@@' % k, '#%04d#' % t))
        tahap2.append(('@@T%d@@' % k, '#%04d#' % p))
    peran = [(x, 'Pelawan') for x in PERAN_P] + [(x, 'Terlawan') for x in PERAN_T]
    return tahap1 + tahap2 + peran


KOREKSI_T = [('#4004# #7085# mengatakan', '#4004# #7086# mengatakan'), ('saksi kedua #7085# dan', 'saksi kedua #7086# dan'),
             ('saksi ketiga #7085# dan', 'saksi ketiga #7086# dan'), ('tidak ajkan mengajukan', 'tidak akan mengajukan')]   # salah ketik pada BAS dasar ALUR 04 [7] dan [7a] (peran penggugat tertulis pada pembuktian tergugat)


def bas_tukar(nama_dasar, nama_keluar, folder_keluar, sunting=None, tokens=None, pra=None):
    """BAS dari BAS dasar dengan pertukaran data pihak dan sebutan; sunting(d, i, teks) -> teks baru atau None (biarkan/tukar). pra = koreksi sebelum pertukaran."""
    d = Doc(DASAR_BAS, nama_dasar)
    tukar = (list(pra or []) + _pasang_tukar() +
             [('#9955#', '#3983#'), ('#9911#', '#3984#'),
              ('sebagai Pelawan;', 'sebagai Pelawan (semula #0047#);'), ('sebagai Terlawan.', 'sebagai Terlawan (semula #0046#).'),
              ('(BEDA PENGGUGAT DAN TERGUGAT TERGANTUNG MENGAJUKAN PERTANYAAN ATAU TIDAK)', '(PELAWAN DAN TERLAWAN DAPAT BERBEDA, TERGANTUNG MENGAJUKAN PERTANYAAN ATAU TIDAK)'),
              ('nafkah anak', 'perlawanan (verzet) atas putusan verstek')])
    for i in range(d.n):
        baru = sunting(d, i, d.t[i]) if sunting else None
        if baru is not None:
            d.T(i, baru)
        else:
            d.F(i, tukar)
    d.simpan(folder_keluar, nama_keluar, tokens)


def nama_bas(kode, uraian):
    return 'BAS ALUR 76 Verzet - [%s] %s.rtf' % (kode, uraian)


KEDUDUKAN_HADIR = ('Pelawan menghadap sendiri atau didampingi kuasanya;', 'Terlawan menghadap sendiri atau didampingi kuasanya;')


def _sunting_pembuktian(pihak):
    """pihak: 'Pelawan' atau 'Terlawan' (yang mengajukan bukti)."""
    def f(d, i, t):
        if t == '#0141#;':
            return KEDUDUKAN_HADIR[0]
        if t == '#0142#;':
            return KEDUDUKAN_HADIR[1]
        if t == '#7090#':
            return 'Selanjutnya #4004# menyatakan agenda sidang hari ini untuk pembuktian %s;' % pihak
        return None
    return f


def bas_kerangka(sumber_nama, nama_keluar, folder_keluar, judul_nomor, badan, penutup=None, tokens=None):
    """BAS yang badannya ditulis sendiri di atas kerangka berkas ALUR 46: paragraf 0-8 (kepala dan pihak) disesuaikan, badan baru, tanda tangan dipakai ulang."""
    d = Doc(DASAR_BAS, sumber_nama)
    b_sidang = d.ix(r'^Setelah sidang dibuka dan dinyatakan terbuka untuk umum')
    kaki = d.ix(r'^Demikian Berita Acara Sidang ini dibuat')
    m_badan = b_sidang
    m_judul = d.ix(r'^MENETAPKAN$') if any(isinstance(x, tuple) and x[0] == 'judul' for x in badan) else None
    m_butir = d.ix(r'^1\.\tMengabulkan permohonan pencabutan') if m_judul is not None else None
    for i in range(b_sidang):
        t = d.t[i]
        if i == 2:
            d.T(i, judul_nomor)
        elif t.startswith('#8008# yang memeriksa dan mengadili'):
            d.T(i, '#8008# yang memeriksa dan mengadili perkara perlawanan (verzet) atas putusan verstek pada tingkat pertama yang dilangsungkan#0206# di #1261#, pada hari #0032# '
                   'tanggal #0033# dalam perkara antara:')
        elif t.startswith('#0098#, sebagai'):
            d.T(i, '#0102#, sebagai Pelawan (semula #0047#);')
        elif t.startswith('#0102#, sebagai'):
            d.T(i, '#0098#, sebagai Terlawan (semula #0046#);')
        else:
            d.raw(i)
    for item in badan:
        if isinstance(item, tuple):
            jenis = item[0]
            if jenis == 'judul':
                d.T(m_judul, item[1])
            elif jenis == 'butir':
                d.N(m_butir, item[1], item[2])
            continue
        d.T(m_badan, item)
    for i in range(kaki, d.n):
        d.raw(i)
    d.simpan(folder_keluar, nama_keluar, tokens)


BAS_DASAR_46 = 'BAS ALUR 46 Nafkah Anak - Cabut sesudah Jawaban - Tergugat Setuju.rtf'

SIDANG_BUKA = 'Setelah sidang dibuka dan dinyatakan terbuka untuk umum oleh #4004#, Pelawan dan Terlawan dipanggil menghadap ke persidangan;'
DAMAI = 'Kemudian #4004# berusaha mendamaikan Pelawan dan Terlawan sesuai Pasal 154 ayat (1) RBg, namun tidak berhasil;'
TUNDA = ('Selanjutnya #4004# menyatakan sidang ditunda sampai dengan hari #0133# tanggal #0134#, pukul #9400#, untuk %s, dan memberitahu %s supaya menghadap ke persidangan yang '
         'telah ditetapkan tersebut tanpa dipanggil lagi karena pemberitahuan ini merupakan panggilan resmi;')
TUTUP = 'Setelah penundaan sidang tersebut diumumkan, selanjutnya #4004# menyatakan sidang ditutup;'
IDENTITAS = 'Kemudian #4004# memeriksa identitas Pelawan dan Terlawan yang ternyata sesuai dengan yang tertera dalam surat perlawanan;'
PERIKSA_TENGGANG = ('Selanjutnya #4004# memeriksa bahwa perlawanan ini diajukan terhadap ' + PV + ', yang diberitahukan kepada Pelawan pada tanggal #3975#, sedangkan perlawanan '
                    'didaftarkan di Kepaniteraan #8008# pada tanggal #3974#;')
TIDAK_HADIR = ('%s tidak menghadap ke persidangan atau menyuruh orang lain untuk menghadap sebagai kuasanya sekalipun menurut relaas panggilan yang dibacakan di persidangan %s '
               'telah dipanggil secara resmi dan patut untuk menghadap ke persidangan;')
SKORS = ('Kemudian #4004# menyatakan sidang diskors dan tertutup untuk umum guna musyawarah. Setelah musyawarah selesai, #4004# menyatakan skors dicabut dan sidang terbuka untuk '
         'umum, lalu #4004# menjatuhkan %s yang amarnya sebagai berikut:')
SALINAN = 'Selanjutnya #4004# menyampaikan salinan %s kepada para pihak, kemudian #4004# menyatakan sidang selesai dan ditutup;'


def bangun_bas(folder_keluar):
    hasil = []

    def tambah(nama):
        hasil.append(nama)
        return nama

    tok = SPEK['isian_bas']

    # [1] sidang pertama, kedua pihak hadir
    n = tambah(nama_bas('1', 'Sidang 1 - Pelawan & Terlawan Hadir - Pembacaan Perlawanan dan Jawaban Terlawan'))
    bas_kerangka(BAS_DASAR_46, n, folder_keluar, 'Sidang Pertama', [
        SIDANG_BUKA, KEDUDUKAN_HADIR[0], KEDUDUKAN_HADIR[1], IDENTITAS, PERIKSA_TENGGANG, DAMAI,
        'Selanjutnya dibacakan surat perlawanan Pelawan tertanggal #3973# yang terdaftar di Kepaniteraan #8008# pada tanggal #3974# dengan Nomor #0001#, yang isi dan maksudnya '
        'tetap dipertahankan oleh Pelawan, pada pokoknya sebagai berikut:',
        '#3980#',
        'Atas perlawanan tersebut, Terlawan menyampaikan jawabannya yang pada pokoknya sebagai berikut:',
        '#3982#',
        TUNDA % ('agenda replik dari Pelawan', 'Pelawan dan Terlawan'), TUTUP,
    ], None, tokens=tok)

    # [1a] Terlawan tidak hadir
    n = tambah(nama_bas('1a', 'Sidang 1 - Pelawan Hadir & Terlawan Tidak Hadir - Tunda Panggil Terlawan'))
    bas_kerangka(BAS_DASAR_46, n, folder_keluar, 'Sidang Pertama', [
        SIDANG_BUKA, KEDUDUKAN_HADIR[0],
        TIDAK_HADIR % ('Terlawan', 'Terlawan'),
        'Selanjutnya #4004# memeriksa identitas Pelawan yang ternyata sesuai dengan yang tertera dalam surat perlawanan;', PERIKSA_TENGGANG,
        'Selanjutnya #4004# menasihati Pelawan agar menyelesaikan persoalan secara kekeluargaan, namun tidak berhasil;',
        'Selanjutnya #4004# menunda sidang sampai dengan hari #0133# tanggal #0134#, pukul #9400#, untuk memanggil Terlawan dan memerintahkan #6032# memanggil kembali Terlawan '
        'untuk menghadap ke persidangan pada hari dan tanggal yang telah ditetapkan di atas serta memberitahu Pelawan untuk hadir kembali pada hari dan tanggal tersebut tanpa '
        'dipanggil lagi dan pemberitahuan ini merupakan panggilan resmi;', TUTUP,
    ], None, tokens=tok)

    # [1b] keduanya tidak hadir
    n = tambah(nama_bas('1b', 'Sidang 1 - Pelawan & Terlawan Tidak Hadir - Tunda Panggil Pelawan dan Terlawan'))
    bas_kerangka(BAS_DASAR_46, n, folder_keluar, 'Sidang Pertama', [
        SIDANG_BUKA,
        TIDAK_HADIR % ('Pelawan', 'Pelawan'),
        TIDAK_HADIR % ('Terlawan', 'Terlawan'),
        'Selanjutnya #4004# menunda sidang sampai dengan hari #0133# tanggal #0134#, pukul #9400#, untuk memanggil kembali Pelawan dan Terlawan dan memerintahkan #6032# '
        'memanggil kembali Pelawan dan Terlawan untuk menghadap ke persidangan pada hari dan tanggal yang telah ditetapkan di atas;', TUTUP,
    ], None, tokens=tok)

    # [1c] Pelawan tidak hadir, Terlawan hadir
    n = tambah(nama_bas('1c', 'Sidang 1 - Pelawan Tidak Hadir & Terlawan Hadir - Tunda Panggil Pelawan'))
    bas_kerangka(BAS_DASAR_46, n, folder_keluar, 'Sidang Pertama', [
        SIDANG_BUKA, KEDUDUKAN_HADIR[1],
        TIDAK_HADIR % ('Pelawan', 'Pelawan'),
        'Selanjutnya #4004# menunda sidang sampai dengan hari #0133# tanggal #0134#, pukul #9400#, untuk memanggil kembali Pelawan dan memerintahkan #6032# memanggil kembali '
        'Pelawan untuk menghadap ke persidangan pada hari dan tanggal yang telah ditetapkan di atas serta memberitahu Terlawan untuk hadir kembali pada hari dan tanggal tersebut '
        'tanpa dipanggil lagi dan pemberitahuan ini merupakan panggilan resmi;', TUTUP,
    ], None, tokens=tok)

    # [2] replik dan duplik
    n = tambah(nama_bas('2', 'Pelawan & Terlawan Hadir - Replik Pelawan dan Duplik Terlawan'))
    bas_kerangka(BAS_DASAR_46, n, folder_keluar, 'Lanjutan', [
        SIDANG_BUKA, KEDUDUKAN_HADIR[0], KEDUDUKAN_HADIR[1], DAMAI,
        'Selanjutnya #4004# memberi kesempatan kepada Pelawan untuk menyampaikan replik atas jawaban Terlawan, kemudian Pelawan menyampaikan repliknya yang pada pokoknya '
        'menyatakan tetap pada dalil-dalil perlawanannya dan membantah jawaban Terlawan;',
        'Atas replik Pelawan tersebut, Terlawan menyampaikan dupliknya yang pada pokoknya menyatakan tetap pada jawabannya;',
        'Dengan demikian tahap jawab menjawab dinyatakan selesai oleh #4004#;',
        TUNDA % ('agenda pembuktian dari Pelawan', 'Pelawan dan Terlawan'), TUTUP,
    ], None, tokens=tok)

    # [3] [3a] [4] [4a] pembuktian (pertukaran data dari BAS ALUR 04)
    bas_tukar('BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P.rtf', nama_bas('3', 'Pembuktian Pelawan (2 Saksi)'), folder_keluar, _sunting_pembuktian('Pelawan'), tok)
    tambah(nama_bas('3', 'Pembuktian Pelawan (2 Saksi)'))
    bas_tukar('BAS ALUR 04 [6a] BAS 6 P & T Hadir - Pembuktian P (3 Saksi).rtf', nama_bas('3a', 'Pembuktian Pelawan (3 Saksi)'), folder_keluar, _sunting_pembuktian('Pelawan'), tok)
    tambah(nama_bas('3a', 'Pembuktian Pelawan (3 Saksi)'))
    bas_tukar('BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf', nama_bas('4', 'Pembuktian Terlawan (2 Saksi)'), folder_keluar, _sunting_pembuktian('Terlawan'), tok, KOREKSI_T)
    tambah(nama_bas('4', 'Pembuktian Terlawan (2 Saksi)'))
    bas_tukar('BAS ALUR 04 [7a] BAS 7 P & T Hadir - Pembuktian T (3 Saksi).rtf', nama_bas('4a', 'Pembuktian Terlawan (3 Saksi)'), folder_keluar, _sunting_pembuktian('Terlawan'), tok, KOREKSI_T)
    tambah(nama_bas('4a', 'Pembuktian Terlawan (3 Saksi)'))

    # [5] kesimpulan
    n = tambah(nama_bas('5', 'Pelawan & Terlawan Hadir - Kesimpulan'))
    bas_kerangka(BAS_DASAR_46, n, folder_keluar, 'Lanjutan', [
        SIDANG_BUKA, KEDUDUKAN_HADIR[0], KEDUDUKAN_HADIR[1], DAMAI,
        'Selanjutnya #4004# menyatakan agenda sidang hari ini adalah penyampaian kesimpulan dari Pelawan dan Terlawan;',
        'Kemudian Pelawan menyampaikan kesimpulannya yang pada pokoknya sebagai berikut:',
        '#9256#',
        'Kemudian Terlawan menyampaikan kesimpulannya yang pada pokoknya sebagai berikut:',
        '#9255#',
        'Setelah kesimpulan Pelawan dan Terlawan disampaikan, #4004# menyatakan bahwa pemeriksaan perlawanan telah selesai dan menyatakan sidang ditunda sampai dengan hari #0133# '
        'tanggal #0134#, pukul #9400#, untuk pembacaan putusan, dan memberitahu Pelawan dan Terlawan supaya menghadap ke persidangan yang telah ditetapkan tersebut tanpa dipanggil '
        'lagi karena pemberitahuan ini merupakan panggilan resmi;', TUTUP,
    ], None, tokens=tok)

    # [6] pembacaan putusan
    n = tambah(nama_bas('6', 'Pelawan & Terlawan Hadir - Musyawarah Majelis dan Pembacaan Putusan'))
    bas_kerangka(BAS_DASAR_46, n, folder_keluar, 'Lanjutan', [
        SIDANG_BUKA, KEDUDUKAN_HADIR[0], KEDUDUKAN_HADIR[1],
        'Selanjutnya #4004# mengingatkan bahwa agenda sidang hari ini adalah pembacaan hasil musyawarah Majelis Hakim atas perlawanan Pelawan, dan atas pertanyaan #4004#, Pelawan '
        'dan Terlawan menyatakan siap mendengarkan putusan;',
        'Kemudian #4004# menyatakan sidang diskors dan tertutup untuk umum guna musyawarah. Setelah musyawarah selesai, #4004# menyatakan skors dicabut dan sidang terbuka untuk '
        'umum, lalu #4004# membacakan putusan yang amarnya sebagai berikut:',
        '#3998#',
        'Selanjutnya #4004# menjelaskan kepada Pelawan dan Terlawan apabila keberatan terhadap putusan tersebut dapat mengajukan upaya hukum banding dalam tenggang waktu 14 '
        '(empat belas) hari sejak putusan ini diucapkan, kemudian #4004# menyatakan sidang selesai dan ditutup;',
    ], None, tokens=tok)

    # [7] Pelawan tidak hadir lagi - gugur
    n = tambah(nama_bas('7', 'Pelawan Tidak Hadir Lagi - Perlawanan Gugur'))
    bas_kerangka(BAS_DASAR_46, n, folder_keluar, 'Lanjutan', [
        'Setelah sidang dibuka dan dinyatakan terbuka untuk umum oleh #4004#, Pelawan dan Terlawan dipanggil menghadap ke persidangan;',
        TIDAK_HADIR % ('Pelawan', 'Pelawan'),
        KEDUDUKAN_HADIR[1],
        'Kemudian #4004# menyatakan sidang diskors dan tertutup untuk umum guna musyawarah. Setelah musyawarah selesai, #4004# menyatakan skors dicabut dan sidang terbuka untuk '
        'umum, lalu #4004# menjatuhkan putusan yang amarnya sebagai berikut:',
        '#3998#',
        'Selanjutnya #4004# memerintahkan #6032# #8008# untuk memberitahukan amar putusan tersebut kepada Pelawan dan Terlawan sesuai dengan peraturan yang berlaku, kemudian #4004# '
        'menyatakan sidang selesai dan ditutup;',
    ], None, tokens=tok)

    # [8] [9] [9a] pencabutan
    n = tambah(nama_bas('8', 'Pencabutan Perlawanan sebelum Jawaban Terlawan'))
    bas_kerangka(BAS_DASAR_46, n, folder_keluar, 'Lanjutan', [
        SIDANG_BUKA, KEDUDUKAN_HADIR[0], KEDUDUKAN_HADIR[1],
        'Kemudian #4004# menyatakan bahwa agenda persidangan hari ini adalah pemeriksaan perlawanan;',
        'Sebelum pemeriksaan perlawanan dilanjutkan, Pelawan menyatakan mencabut perlawanannya dengan alasan #8433#;',
        'Oleh karena Terlawan belum mengajukan jawaban atas perlawanan tersebut, maka sesuai Pasal 271 Rv pencabutan perlawanan dapat dilakukan tanpa persetujuan Terlawan;',
        SKORS % 'penetapan', ('judul', 'MENETAPKAN'),
        ('butir', 1, 'Mengabulkan permohonan pencabutan perlawanan Pelawan terhadap ' + PV + ' dalam perkara Nomor #0001#;'),
        ('butir', 2, 'Memerintahkan Panitera untuk mencatat pencabutan perlawanan tersebut dalam register perkara;'),
        ('butir', 3, 'Menyatakan ' + PV + ' tetap berlaku;'),
        ('butir', 4, BIAYA_AMAR % 'Pelawan'),
        SALINAN % 'penetapan',
    ], None, tokens=tok)
    n = tambah(nama_bas('9', 'Pencabutan Perlawanan sesudah Jawaban - Terlawan Setuju'))
    bas_kerangka(BAS_DASAR_46, n, folder_keluar, 'Lanjutan', [
        SIDANG_BUKA, KEDUDUKAN_HADIR[0], KEDUDUKAN_HADIR[1],
        'Kemudian #4004# menyatakan bahwa agenda persidangan hari ini adalah melanjutkan pemeriksaan perlawanan;',
        'Sebelum pemeriksaan perlawanan dilanjutkan, Pelawan menyatakan mencabut perlawanannya dengan alasan #8433#;',
        'Oleh karena Terlawan telah mengajukan jawaban atas perlawanan tersebut, maka sesuai Pasal 271 Rv pencabutan perlawanan memerlukan persetujuan Terlawan, sehingga #4004# '
        'menanyakan sikap Terlawan atas pencabutan perlawanan tersebut;',
        'Atas pertanyaan #4004# tersebut, Terlawan menyatakan setuju dan tidak keberatan atas pencabutan perlawanan tersebut;',
        SKORS % 'penetapan', ('judul', 'MENETAPKAN'),
        ('butir', 1, 'Mengabulkan permohonan pencabutan perlawanan Pelawan terhadap ' + PV + ' dalam perkara Nomor #0001#;'),
        ('butir', 2, 'Memerintahkan Panitera untuk mencatat pencabutan perlawanan tersebut dalam register perkara;'),
        ('butir', 3, 'Menyatakan ' + PV + ' tetap berlaku;'),
        ('butir', 4, BIAYA_AMAR % 'Pelawan'),
        SALINAN % 'penetapan',
    ], None, tokens=tok)
    n = tambah(nama_bas('9a', 'Pencabutan Perlawanan sesudah Jawaban - Terlawan Menolak'))
    bas_kerangka(BAS_DASAR_46, n, folder_keluar, 'Lanjutan', [
        SIDANG_BUKA, KEDUDUKAN_HADIR[0], KEDUDUKAN_HADIR[1],
        'Kemudian #4004# menyatakan bahwa agenda persidangan hari ini adalah melanjutkan pemeriksaan perlawanan;',
        'Sebelum pemeriksaan perlawanan dilanjutkan, Pelawan menyatakan mencabut perlawanannya dengan alasan #8433#;',
        'Oleh karena Terlawan telah mengajukan jawaban atas perlawanan tersebut, maka sesuai Pasal 271 Rv pencabutan perlawanan memerlukan persetujuan Terlawan, sehingga #4004# '
        'menanyakan sikap Terlawan atas pencabutan perlawanan tersebut;',
        'Atas pertanyaan #4004# tersebut, Terlawan menyatakan tidak setuju dan keberatan atas pencabutan perlawanan tersebut dan mohon pemeriksaan perlawanan dilanjutkan;',
        'Kemudian #4004# menyatakan bahwa oleh karena Terlawan tidak menyetujui pencabutan perlawanan, maka permohonan pencabutan tidak dapat dikabulkan dan pemeriksaan '
        'perlawanan dilanjutkan;',
        TUNDA % ('agenda replik dari Pelawan', 'Pelawan dan Terlawan'), TUTUP,
    ], None, tokens=tok)
    return hasil


# ------------------------------------------------------------------------------------------------------------------
def bangun(S):
    """Menyusun 8 putusan/penetapan + BAS verzet; kembalikan jumlah berkas."""
    folder = os.path.join(KELUAR, S['folder'])
    folder_bas = folder + ' - BAS'
    os.makedirs(folder, exist_ok=True)
    os.makedirs(folder_bas, exist_ok=True)
    n = 0
    for nama, fungsi in PUTUSAN:
        fungsi(nama, folder)
        n += 1
    n += len(bangun_bas(folder_bas))
    return n
