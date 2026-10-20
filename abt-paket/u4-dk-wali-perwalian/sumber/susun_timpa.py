# -*- coding: utf-8 -*-
"""Menyusun versi BARU dari blangko Derry yang sudah ada (ditimpa di server dengan penjaga md5, cadangan dibuat paket):
  - 6 Perwalian/Perwalian Anak oleh ortu kandung Kabul.rtf  : sisa isian mentah dibuang, nama/jumlah anak tidak lagi bergantung SIPP anak (kosong pada 23/23 perkara),
                                                              pertimbangan tindakan hukum (#4411#) dan amar (#4412#)
  - 3 Dispensasi Kawin/[01] [01] [02] [02] [03] [03a] [03b] [03c] : Hakim Tunggal, Pasal 15 PERMA 5/2019, beban pembuktian, perbedaan usia, rekomendasi
  - 7 Wali Adhal/[01] [01a] [03]                              : urutan wali (Pasal 21 KHI), persetujuan calon & umur, kesepadanan (Pasal 61 KHI), masa tunggu
Keluaran: timpa/<folder>/<berkas>.rtf dan daftar-timpa.tsv (folder, berkas, md5 lama, md5 baru, keterangan)."""
import hashlib
import os
import re
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(AKAR, 'alat'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bangun import Dok, simpan, periksa_token  # noqa: E402
from susun_dk import HAKIM_TUNGGAL, PASAL_15, BEBAN_BUKTI  # noqa: E402

ASLI = os.environ.get('U4_ASLI', 'D:/Aplikasi/aleta/tmp/u4/asli')
KELUAR = os.path.join(AKAR, 'timpa')
PREFIKS = 'derry_briantono/'

W1 = ('Menimbang, bahwa Pasal 21 ayat (1) Kompilasi Hukum Islam menentukan bahwa wali nasab terdiri dari empat kelompok dalam urutan kedudukan, kelompok yang satu '
      'didahulukan dari kelompok yang lain sesuai erat tidaknya susunan kekerabatan dengan calon mempelai wanita; berdasarkan fakta hukum, wali nasab yang berhak menikahkan '
      '#0046# adalah #9202# #0046# bernama #9200#, sehingga keengganan yang dinilai dalam perkara ini adalah keengganan wali nasab tersebut;')
W2 = '#4441#'
W3 = ('Menimbang, bahwa Pasal 61 Kompilasi Hukum Islam menentukan bahwa tidak sekufu tidak dapat dijadikan alasan untuk mencegah perkawinan, kecuali tidak sekufu karena perbedaan agama; '
      'dalam perkara ini #0046# dan #1029# sama-sama beragama Islam, sehingga apabila alasan penolakan wali nasab berkaitan dengan kesepadanan (kafaah) selain agama, hal itu tidak dapat '
      'dijadikan alasan untuk menolak menikahkan;#4442#')

DAFTAR = []  # (folder, berkas, md5_lama, md5_baru, ket)


def md5b(b):
    return hashlib.md5(b).hexdigest()


def simpan_timpa(folder, berkas, d, out, ket, ganti_token=()):
    isi = d.rakit(out)
    for lama, baru in ganti_token:
        isi = isi.replace(lama, baru)
    pecah = periksa_token(isi)
    if pecah:
        raise SystemExit('token terpecah di %s: %r' % (berkas, pecah))
    simpan(os.path.join(KELUAR, PREFIKS + folder, berkas), isi)
    lama = md5b(open(os.path.join(ASLI, folder, berkas), 'rb').read())
    DAFTAR.append((PREFIKS + folder, berkas, lama, md5b(isi.encode('latin1')), ket))
    print('timpa', folder, berkas[:60])


def ada(d, awalan):
    return [i for i in range(len(d.par)) if d.isi(i).startswith(awalan)]


def ganti1(t, lama, baru, wajib=True):
    n = t.count(lama)
    if n != 1:
        if wajib:
            raise SystemExit('jangkar %r muncul %d kali' % (lama[:70], n))
        return t
    return t.replace(lama, baru)


# ---------------------------------------------------------------------------------------------------------------------
def perwalian_ortu():
    folder, berkas = '6 Perwalian', 'Perwalian Anak oleh ortu kandung Kabul.rtf'
    d = Dok(os.path.join(ASLI, folder, berkas))
    out = []
    for i in range(len(d.par)):
        t0 = d.isi(i)
        t = t0
        if i == 72:
            t = ganti1(t, ' (ANAK 1 PERSATU P NYA)', '')
            t = ganti1(t, 'Bukti tersebut menerangkan bahwa ANAK 1 merupakan putri dari #0046# yang lahir tanggal _ (_ tahun) dan ANAK 2 merupakan putra dari #0046# yang lahir tanggal _ (_ tahun);',
                       'Bukti tersebut menerangkan bahwa #5115# adalah anak dari #0046# dan #1025#;')
        elif i == 76:
            t = ganti1(t, 'dengan #0046# dan #0047#.', 'dengan #0046# dan #5114# yang dimintakan perwalian.')
        elif i == 78:
            t = ganti1(t, 'keadaan rumah tangga #0046# dan #0047# yang', 'keadaan #0046# dan #5114# yang dimintakan perwalian yang')
        elif i == 112:
            t = ganti1(t, 'dari ketiga anak tersebut', 'dari #5114# tersebut')
        elif i == 113:
            t = ganti1(t, 'bahwa kedua anak bernama #5110#. Sehingga #8515# anak tersebut masih', 'bahwa #5114# bernama #5110#. Sehingga #5114# tersebut masih')
            t = ganti1(t, 'pula kedua anak tersebut belum', 'pula #5114# tersebut belum')
        elif i == 114:
            t = ganti1(t, 'Sedangkan kedua anak #0046# yang belum', 'Sedangkan #5114# #0046# yang belum')
            t = ganti1(t, 'terhadap kedua anak-anaknya yang belum', 'terhadap #5114# tersebut yang belum')
        elif i == 116:
            t = ganti1(t, 'dari kedua anak tersebut', 'dari #5114# tersebut')
        elif i == 121:
            t = ganti1(t, 'atas #8515# anaknya #5110#', 'atas #5114# tersebut, yaitu #5110#')
            t = t.rstrip() + '#4411#'
        elif i == 127:
            t = ganti1(t, 'Menetapkan anak yang bernama #5110#, berada dibawah perwalian #0098# (#0046#);', 'Menetapkan #5114# yang bernama #5110# berada di bawah perwalian #0098# (#0046#)#4412#;')
        out.append(d.ganti_teks(i, t) if t != t0 else d.par[i])
    simpan_timpa(folder, berkas, d, out, 'Perwalian ortu kandung: buang sisa isian mentah (ANAK 1 / _), nama dan jumlah anak otomatis 4406/4407, izin tindakan hukum 4411/4412',
                 (('#5115#', '#4406#'), ('#5110#', '#4406#'), ('#5114#', '#4407#')))


def sisip_dk(folder, berkas):
    d = Dok(os.path.join(ASLI, folder, berkas))
    out = []
    kena = []
    a_ht = ada(d, 'Menimbang, bahwa perkara ini termasuk dalam bidang perkawinan')
    a_p15 = ada(d, 'Menimbang, bahwa berkaitan dengan prinsip kepentingan terbaik')
    a_bb = ada(d, 'Menimbang, bahwa bukti bertanda P.1')
    if any(x.startswith('Menimbang, bahwa perkara ini diperiksa dan diadili oleh Hakim Tunggal') for x in (d.isi(i) for i in range(len(d.par)))):
        print('lewati (sudah ada paragraf Hakim Tunggal):', berkas)
        return
    for i in range(len(d.par)):
        t0 = d.isi(i)
        if a_ht and i == a_ht[0]:
            out.append(d.ganti_teks(i, HAKIM_TUNGGAL))
            kena.append('hakim-tunggal')
        if a_p15 and i == a_p15[0]:
            out.append(d.ganti_teks(i, PASAL_15))
            kena.append('pasal-15')
        if a_bb and i == a_bb[0]:
            out.append(d.ganti_teks(i, BEBAN_BUKTI))
            kena.append('beban-bukti')
        t = t0
        if a_p15 and i == a_p15[0]:
            t = t0.rstrip() + '#4426##4428#'
            kena.append('usia-rekomendasi')
        out.append(d.ganti_teks(i, t) if t != t0 else d.par[i])
    if not kena:
        print('lewati (tanpa jangkar):', berkas)
        return
    simpan_timpa(folder, berkas, d, out, 'DK: ' + ', '.join(kena))


def sisip_wa(folder, berkas, tolak):
    d = Dok(os.path.join(ASLI, folder, berkas))
    out = []
    a19 = ada(d, 'Menimbang, bahwa berdasarkan Pasal 19 dan Pasal 20 ayat (1)')
    afakta = ada(d, 'Menimbang, bahwa berdasarkan fakta hukum tersebut, antara')
    kena = []
    for i in range(len(d.par)):
        if afakta and i == afakta[0] and not tolak:
            out.append(d.ganti_teks(i, W3))
            kena.append('Pasal-61')
        out.append(d.par[i])
        if a19 and i == a19[0]:
            out.append(d.ganti_teks(i, W1))
            kena.append('Pasal-21')
            if not tolak:
                out.append(d.ganti_teks(i, W2))
                kena.append('persetujuan-umur')
    simpan_timpa(folder, berkas, d, out, 'Wali adhal: ' + ', '.join(kena))


def main():
    perwalian_ortu()
    for berkas in sorted(os.listdir(os.path.join(ASLI, '3 Dispensasi Kawin'))):
        if re.match(r'\[(01|02|03|03a|03b|03c)\]', berkas) and berkas.endswith('.rtf'):
            sisip_dk('3 Dispensasi Kawin', berkas)
    sisip_wa('7 Wali Adhal', '[01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf', False)
    sisip_wa('7 Wali Adhal', '[01a] [Kabul] Wali Adhal - Wali Hadir Tetap Enggan.rtf', False)
    sisip_wa('7 Wali Adhal', '[03] [Tolak] Wali Adhal - Keengganan Wali Beralasan Hukum.rtf', True)
    with open(os.path.join(AKAR, 'daftar-timpa.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('# folder<TAB>berkas<TAB>md5 lama (server 20 Okt 2026)<TAB>md5 baru<TAB>keterangan - berkas LAMA ditimpa HANYA bila md5-nya persis md5 lama; cadangan utuh dibuat paket\n')
        for r in DAFTAR:
            f.write('\t'.join(r) + '\n')
    print(len(DAFTAR), 'berkas ditimpa')


if __name__ == '__main__':
    main()
