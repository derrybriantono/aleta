# -*- coding: utf-8 -*-
"""Menyusun blangko DK BARU dari "3 Dispensasi Kawin/[01] [Kabul] DK - (Anak P Cewek) Hamil.rtf":
  [01c] Kabul DK - Anak P Cewek - Alasan Mendesak Otomatis (Hamil atau Pacaran Erat): satu keluarga Pemohon, calon suami dewasa.
  [01d] Kabul DK - Kedua Calon Mempelai di Bawah Umur (Dua Keluarga Pemohon): para Pemohon = orang tua calon istri DAN calon suami
        (8 dari 26 perkara DK 2025-2026 PA Donggala; identitas lewat #7047# sampai 4 pemohon).
Penambahan pada keduanya: paragraf Hakim Tunggal, beban pembuktian (Pasal 283 RBg jo. Pasal 1865 KUH Perdata), Pasal 15 PERMA 5/2019,
perbedaan usia (SIPP), rekomendasi (Pasal 16 huruf h PERMA 5/2019) - dasar hukum dari katalog yang berstatus terverifikasi."""
import os
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(AKAR, 'alat'))
from bangun import Dok, simpan, periksa_token  # noqa: E402

ASLI = os.environ.get('U4_ASLI', 'D:/Aplikasi/aleta/tmp/u4/asli')
DASAR = ASLI + '/3 Dispensasi Kawin/[01] [Kabul] DK - (Anak P Cewek) Hamil.rtf'
FOLDER = os.path.join(AKAR, 'rtf', 'derry_briantono', '3 Dispensasi Kawin')
TUJUAN_A = os.path.join(FOLDER, '[01c] [Kabul] DK - (Anak P Cewek) Alasan Mendesak Otomatis (Hamil atau Pacaran Erat).rtf')
TUJUAN_B = os.path.join(FOLDER, '[01d] [Kabul] DK - Kedua Calon Mempelai di Bawah Umur (Dua Keluarga Pemohon, Hamil atau Pacaran Erat).rtf')

HAKIM_TUNGGAL = ('Menimbang, bahwa perkara ini diperiksa dan diadili oleh Hakim Tunggal yang ditunjuk berdasarkan Penetapan Hakim Tunggal tanggal #1143# '
                 'sesuai dengan ketentuan Peraturan Mahkamah Agung Republik Indonesia Nomor 5 Tahun 2019 tentang Pedoman Mengadili Permohonan Dispensasi Kawin;')
PASAL_15 = ('Menimbang, bahwa dalam memeriksa anak yang dimohonkan dispensasi kawin, Hakim telah mendengar keterangan anak tersebut secara terpisah di persidangan '
            'sebagaimana dimungkinkan oleh Pasal 15 Peraturan Mahkamah Agung Republik Indonesia Nomor 5 Tahun 2019 tentang Pedoman Mengadili Permohonan Dispensasi Kawin, '
            'agar anak dapat menyampaikan pendapat dan kehendaknya sendiri tanpa tekanan, dan keterangan tersebut dipertimbangkan dalam penetapan ini;')
BEBAN_BUKTI = ('Menimbang, bahwa berdasarkan Pasal 283 RBg jo. Pasal 1865 Kitab Undang-Undang Hukum Perdata, para #0046# berkewajiban membuktikan dalil-dalil permohonannya, '
               'dan untuk itu para #0046# telah mengajukan bukti surat serta 2 (dua) orang saksi di persidangan;')

# bukti surat B: tematik (tanpa nomor P.) karena daftar bukti per perkara disusun dinamis (#9956#)
BUKTI_B = [
    'Menimbang, bahwa seluruh bukti surat yang diajukan para #0046# berupa fotokopi yang telah bercap pos (nazegelen) dan sesuai dengan aslinya serta surat asli (antara lain surat penolakan dari Kantor Urusan Agama), yang berdasarkan Pasal 285 RBg mempunyai nilai kekuatan pembuktian sempurna dan mengikat (volledig en bindende bewijskracht) karena berupa akta autentik, dan secara materiil berkaitan dengan perkara ini sehingga sesuai maksud Pasal 1888 KUH Perdata jo. Pasal 3 ayat (1) huruf b Undang-Undang Nomor 10 Tahun 2020 tentang Bea Meterai, dengan demikian bukti surat yang diajukan oleh para #0046# tersebut memenuhi syarat formil sehingga dapat diterima sebagai alat bukti dan dapat dipertimbangkan lebih lanjut;',
    'Menimbang, bahwa Kartu Tanda Penduduk, Kartu Keluarga, dan kutipan akta nikah para #0046# menerangkan bahwa para #0046# beragama Islam, bertempat tinggal di #0101# yang merupakan wilayah hukum #8008#, sehingga dari segi kewenangan relatif Hakim berpendapat #8008# berwenang untuk memeriksa dan mengadili perkara a quo, serta bahwa para #0046# adalah suami istri yang sah selaku orang tua dari calon mempelai;',
    'Menimbang, bahwa Kartu Tanda Penduduk atau Kartu Identitas Anak, Kartu Keluarga, dan akta kelahiran atas nama #0606# dan #0600# menerangkan bahwa #0606# saat ini berusia #0607# dan #0600# saat ini berusia #0601#, masing-masing adalah anak kandung dari para #0046#, beragama Islam, dan keduanya belum mencapai usia 19 (sembilan belas) tahun, sehingga berdasarkan Pasal 6 ayat (1) Peraturan Mahkamah Agung Republik Indonesia Nomor 5 Tahun 2019 para #0046# memiliki legal standing dalam perkara a quo;',
    'Menimbang, bahwa ijazah atau surat keterangan pendidikan atas nama #0606# membuktikan bahwa #0606# telah menyelesaikan pendidikan sampai tingkat #0609# pada tanggal #8812#;',
    'Menimbang, bahwa surat penolakan dari #5178# membuktikan bahwa permohonan para #0046# untuk menikahkan anak-anaknya, #0606# dengan #0600#, telah ditolak oleh #5178# karena kedua calon mempelai belum berumur 19 tahun, dan terbukti juga bahwa syarat perkawinan telah terpenuhi kecuali persyaratan usia minimal bagi kedua calon pengantin;#4425#',
]


def ganti(teks, lama, baru):
    assert teks.count(lama) == 1, 'jangkar %r muncul %d kali' % (lama[:70], teks.count(lama))
    return teks.replace(lama, baru)


def umum(i, t):
    """Perubahan A (juga dipakai B)."""
    if i == 27:
        t = ganti(t, 'sejak #1666# terakhir, yang mengakibatkan hamil dan sekarang anak yang dikandung telah berumur #0999# serta', 'sejak #1666# terakhir, #4421# serta')
    elif i in (32, 42, 51):
        t = ganti(t, 'yang mengakibatkan hamil dan sekarang anak yang dikandung telah berumur #0999#;', '#4421#;')
    elif i in (65, 75):
        t = ganti(t, 'yang mengakibatkan anak para Pemohon sekarang mengandung usia kehamilan sekitar #0999# sehingga', '#4422# sehingga')
    elif i == 100:
        t = t.rstrip() + '#4426##4428#'
    elif i == 101:
        t = ganti(t, 'karena anak para #0046# telah mengandung usia kehamilan sekitar #0999#, dan sangat mendesak', 'karena #4420#, dan sangat mendesak')
    elif i == 111:
        t = t.rstrip() + '#4425#'
    elif i == 116:
        t = ganti(t, 'yang mengakibatkan anak para Pemohon telah mengandung usia kehamilan sekitar #0999#;', '#4422#;')
    elif i == 132:
        t = ganti(t, 'terakhir dan anak para Pemohon saat ini telah hamil dengan mengandung usia kehamilan sekitar #0999# karena telah melakukan hubungan seksual dengan calon suaminya;', 'terakhir #4423#;')
    elif i == 133:
        t = ganti(t, 'anak para dengan calon suaminya', 'anak para Pemohon dengan calon suaminya')
    return t


def khusus_a(i, t):
    if i == 102:
        t = ganti(t, 'bukti bertanda P.10 dan P.11 merupakan surat asli', 'bukti bertanda #4424# merupakan surat asli')
    return t


def khusus_b(i, t):
    r = lambda lama, baru: ganti(t, lama, baru)  # noqa: E731
    if i == 23:
        return 'Bahwa para #0046# telah menghadirkan anak-anak para #0046# yang dimintakan dispensasi, yaitu calon istri #0606# dan calon suami #0600#, di persidangan;'
    if i == 22:
        return '#9251#' + t
    if i == 24:
        return r('kepada para Pemohon, anak para Pemohon yang dimintakan dispensasi, calon suami anak para Pemohon dan orang tua calon suami anak para Pemohon tentang risiko',
                 'kepada para Pemohon selaku orang tua kedua calon mempelai, serta anak-anak para Pemohon yang dimintakan dispensasi, yaitu calon istri dan calon suami, tentang risiko')
    if i == 27:
        return r('hendak menikahkan anak Pemohon dengan calon suaminya karena antara anak para Pemohon dan calon suaminya sudah',
                 'hendak menikahkan anak-anak mereka karena antara anak para Pemohon yang sebagai calon istri dan yang sebagai calon suami sudah')
    if i == 28:
        t = r('tidak keberatan anaknya menikah dengan calon suaminya', 'tidak keberatan anak-anaknya menikah satu sama lain')
        return ganti(t, 'terhadap anak Pemohon dan calon suaminya', 'terhadap anak-anak mereka')
    if i == 48:
        return r('orang tua calon suami anak para Pemohon yang bernama', 'para Pemohon selaku orang tua calon suami yang bernama')
    if i == 56:
        return r('kecuali masalah umur calon istri yang masih di bawah umur 19 tahun', 'kecuali masalah umur kedua calon mempelai yang masih di bawah umur 19 tahun')
    if i == 86:
        return r('para #0046# adalah orang tua kandung dari calon mempelai perempuan, maka', 'para #0046# adalah orang tua kandung dari calon mempelai perempuan dan calon mempelai laki-laki yang keduanya belum berusia 19 tahun, maka')
    if i == 87:
        return r('Para Pemohon, anak para Pemohon, calon istri anak para Pemohon, dan orang tua calon istri anak para Pemohon hadir',
                 'Para Pemohon dan anak-anak para Pemohon yang dimintakan dispensasi (calon istri dan calon suami) hadir')
    if i == 95:
        return 'anak yang dimintakan dispensasi kawin (calon istri);'
    if i == 96:
        return 'anak yang dimintakan dispensasi kawin (calon suami);'
    if i == 97:
        return 'orang tua calon istri (para Pemohon); dan'
    if i == 98:
        return 'orang tua calon suami (para Pemohon);'
    if i == 100:
        return r('serta para Pemohon dan orang tua calon suami anak para Pemohon menyatakan pula', 'serta para Pemohon selaku orang tua kedua calon mempelai menyatakan pula')
    if i == 101:
        t = r('hendak menikahkan anak kandungnya bernama #0606#, umur #0607# dengan seorang laki-laki bernama #0600#, umur #0601#, karena',
              'hendak menikahkan anak-anak kandung mereka, yaitu #0606# (calon istri), umur #0607#, dengan #0600# (calon suami), umur #0601#, karena')
        return ganti(t, 'menolak dengan alasan anak para #0046# masih belum cukup umur', 'menolak dengan alasan anak-anak para #0046# masih belum cukup umur')
    if i == 115:
        return 'Bahwa anak kandung para Pemohon yang bernama #0606# saat ini berumur #0607# dan anak kandung para Pemohon yang bernama #0600# saat ini berumur #0601#, keduanya masih di bawah umur yang dibolehkan undang-undang untuk menikah, dan keduanya telah menjalin hubungan cinta;'
    if i == 118:
        return r('anak para Pemohon dan calon suaminya masing-masing', 'anak-anak para Pemohon sebagai calon istri dan calon suami masing-masing')
    if i == 119:
        return 'Bahwa calon suami tidak pernah melakukan kekerasan seksual, fisik dan psikis terhadap calon istri;'
    if i == 123:
        t = r('Bahwa para Pemohon dan orang tua calon suami anak para Pemohon tidak ada yang keberatan dengan rencana pernikahan anak para Pemohon tersebut',
              'Bahwa para Pemohon selaku orang tua kedua calon mempelai tidak ada yang keberatan dengan rencana pernikahan anak-anak para Pemohon tersebut')
        return ganti(t, 'pendidikan anak para Pemohon jika nanti sudah menikah', 'pendidikan anak-anak para Pemohon jika nanti sudah menikah')
    if i == 125:
        return r('Bahwa anak para Pemohon sebagai calon istri belum cukup umur', 'Bahwa anak-anak para Pemohon sebagai calon istri dan calon suami belum cukup umur')
    if i == 136:
        return r('walaupun anak para Pemohon belum cukup umur', 'walaupun anak-anak para Pemohon belum cukup umur')
    if i == 138:
        return r('ternyata anak para Pemohon belum berumur 19 tahun', 'ternyata anak-anak para Pemohon belum berumur 19 tahun')
    if i == 148:
        return r('dengan memberikan dispensasi kepada anak para Pemohon yang bernama #0606# untuk menikah dengan seorang laki-laki bernama #0600#',
                 'dengan memberikan dispensasi kepada anak-anak para Pemohon, yaitu #0606# (calon istri) dan #0600# (calon suami), untuk menikah satu sama lain')
    if i == 154:
        return 'Memberikan dispensasi kawin kepada anak-anak para #0046#, yaitu #0606# (calon istri) dan #0600# (calon suami), untuk menikah satu sama lain;'
    return t


def susun_b():
    d = Dok(DASAR)
    out = []
    lewati = {8, 9} | set(range(16, 22)) | set(range(102, 113))
    for i in range(len(d.par)):
        if i in lewati:
            continue
        t0 = d.isi(i)
        t = khusus_b(i, umum(i, t0))
        if i == 7:
            t = '#7047#'
        if i == 85:
            out.append(d.ganti_teks(84, HAKIM_TUNGGAL))
        if i == 100:
            out.append(d.ganti_teks(84, PASAL_15))
        if i == 101:
            out.append(d.ganti_teks(i, t))
            out.append(d.ganti_teks(84, BEBAN_BUKTI))
            for x in BUKTI_B:
                out.append(d.ganti_teks(84, x))
            continue
        out.append(d.ganti_teks(i, t) if t != t0 else d.par[i])
    return d.rakit(out)


def susun_a():
    d = Dok(DASAR)
    out = []
    for i in range(len(d.par)):
        if i == 112:
            continue  # keterangan hamil dipindah ke #4425# (hanya bila hamil)
        t0 = d.isi(i)
        t = khusus_a(i, umum(i, t0))
        if i == 85:
            out.append(d.ganti_teks(84, HAKIM_TUNGGAL))
        if i == 100:
            out.append(d.ganti_teks(84, PASAL_15))
        if i == 102:
            out.append(d.ganti_teks(84, BEBAN_BUKTI))
        out.append(d.ganti_teks(i, t) if t != t0 else d.par[i])
    return d.rakit(out)


def main():
    for tujuan, fungsi in ((TUJUAN_A, susun_a), (TUJUAN_B, susun_b)):
        isi = fungsi()
        pecah = periksa_token(isi)
        if pecah:
            raise SystemExit('token terpecah: %r' % pecah)
        simpan(tujuan, isi)
        print('ditulis', os.path.basename(tujuan), len(isi))


if __name__ == '__main__':
    main()
