# -*- coding: utf-8 -*-
"""Bangun dua blangko RTF "Court Calendar" mandiri dari bagian court calendar di BAS 2 dan BAS 3 contradiktoir (blangko Derry).
Blangko BAS asli TIDAK diubah: paragraf dikutip UTUH (format, tabel, variabel) dari salinan BAS di ABT lokal, lalu dirangkai dengan kop/identitas/penutup.

  python bangun_rtf.py [akar _blangko_abt/derry_briantono]  -> ../paket-satker/rtf/derry_briantono/98c Court Calendar - BAS/*.rtf

Sumber (ALUR 04, folder aktif; isinya sama dengan BAS CONTRA PERCERAIAN PERMA 7 2022):
  [2] BAS 2 ... -> PENETAPAN jadwal (tahap Jawaban s.d. Pengucapan, tanpa rekonvensi)
  [3] BAS 3 ... -> perubahan jadwal karena gugatan rekonvensi (tahap Replik konvensi/Jawaban rekonvensi s.d. Pengucapan)
Hanya ASCII di teks baru (tanpa kata nama aplikasi)."""
import os
import re
import sys

AL = os.path.dirname(os.path.abspath(__file__))
PAKET = os.path.dirname(AL)
sys.path.insert(0, os.path.join(AL, '..', 'alat'))
from paragraf import pecah  # noqa: E402

AKAR = sys.argv[1] if len(sys.argv) > 1 else 'D:/Satker Asal/Website PA Bungku/xampp/htdocs/aps_badilag/_blangko_abt/derry_briantono'
ALUR04 = 'ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)'
S2 = '[2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf'
S3 = '[3] BAS 3 P & T Hadir - Jawaban (dan Gugatan Rekonvensi bila ada).rtf'
FOLDER = '98c Court Calendar - BAS'
NAMA1 = 'Court Calendar - Penetapan Jadwal Persidangan.rtf'
NAMA2 = 'Court Calendar - Perubahan Jadwal Persidangan (Gugatan Rekonvensi).rtf'

RUN = ('{\\rtlch \\fcs1 \\af9 \\afs24 \\ltrch \\fcs0 %s\\fs24 \\rtlch \\alang1025 \\ltrch \\dbch \\af2 \\hich \\af9 \\loch \\f9 '
       '\\lang1033 \\langnp1033 \\langfe1033 \\langfenp1033 \\alang1025 %s}')


def baca(nama):
    return open(os.path.join(AKAR, ALUR04, nama), 'rb').read().decode('latin1')


def par(ppr_dari, teks, tebal=False):
    """Paragraf baru: format paragraf (pPr) diambil dari paragraf sumber, isi satu run (ASCII)."""
    assert all(ord(c) < 128 for c in teks), teks
    awal = ppr_dari[:ppr_dari.index('{')]
    return awal + RUN % ('\\b1 ' if tebal else '', teks) + RUN % ('', '\\par ')


def tanpa_halaman(p):
    """Buang run pemecah halaman '\\page' di awal paragraf judul."""
    q = re.sub(r'\{[^{}]*?\\page \}', '', p, count=1)
    assert q != p
    return q


def rakit(kepala, paragraf, ekor):
    return kepala + ''.join(paragraf) + ekor


def blangko_1():
    k, p, e = pecah(baca(S2))
    judul = tanpa_halaman(p[20])                      # PENETAPAN (tebal, tengah)
    nomor = p[21]                                     # Nomor #0001#
    tentang = par(p[20], 'TENTANG JADWAL PERSIDANGAN (COURT CALENDAR)', tebal=True)
    kosong = p[3]
    dalam = par(p[9], 'Dalam perkara #0048# antara:')
    identitas = [p[5], p[6], p[7]]                    # #0098#, sebagai #7036# / melawan / #0102#, sebagai #7037#
    isi = p[22:26] + [p[26]] + p[27:68]               # Menimbang..Mengingat, MENETAPKAN, butir 1 + tabel
    isi += [p[68], p[69], p[70]]                      # jarak tabel + butir 2 dan 3
    tempat = [p[71], p[72]]                           # Ditetapkan di / Pada tanggal
    ttd = p[80:94]                                    # jarak + tabel tanda tangan (PP kiri, Ketua Majelis kanan) + paragraf akhir
    return rakit(k, [judul, nomor, tentang, kosong, dalam] + identitas + [kosong] + isi + tempat + ttd, e)


def blangko_2():
    k, p, e = pecah(baca(S3))
    k2, p2, e2 = pecah(baca(S2))
    judul = par(p[0], 'PENETAPAN', tebal=True)
    nomor = p[1]
    tentang = par(p[0], 'TENTANG PERUBAHAN JADWAL PERSIDANGAN (COURT CALENDAR)', tebal=True)
    tentang2 = par(p[0], 'KARENA ADA GUGATAN REKONVENSI', tebal=True)
    kosong = p[3]
    dalam = par(p[9], 'Dalam perkara #0048# antara:')
    identitas = [p[5], p[6], p[7]]
    pembuka = p[14]                                   # alasan perubahan + tabel jadwal (p[14] memuat awal tabel, p[15..54] isinya)
    tabel = p[15:55]
    perintah = p[55]
    # catatan petugas "(APABILA ADA REKONVENSI)" tidak dibawa: blangko ini memang hanya untuk perkara berrekonvensi
    assert '(APABILA ADA REKONVENSI)' in perintah and 'para pihak;}' in perintah
    perintah = perintah.replace('(APABILA ADA REKONVENSI)', '').replace('para pihak;}', 'para pihak.}')
    tempat = [p2[71], p2[72]]
    ttd = p[59:72]                                    # jarak + tabel tanda tangan + paragraf akhir (milik BAS 3, gaya yang sama)
    return rakit(k, [judul, nomor, tentang, tentang2, kosong, dalam] + identitas + [kosong, pembuka] + tabel + [perintah] + tempat + ttd, e)


def main():
    keluar = os.path.join(PAKET, 'paket-satker', 'rtf', 'derry_briantono', FOLDER)
    os.makedirs(keluar, exist_ok=True)
    for nama, isi in ((NAMA1, blangko_1()), (NAMA2, blangko_2())):
        with open(os.path.join(keluar, nama), 'wb') as f:
            f.write(isi.encode('latin1'))
        print(nama, len(isi))


if __name__ == '__main__':
    main()
