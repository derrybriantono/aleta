# -*- coding: utf-8 -*-
"""Tambalan blangko folder '4a Harta Bersama' (putusan): [01b] verstek, [02a] T tidak hadir setelah mediasi, [01] dan [01a] konvensi-rekonvensi."""
from rtfkit import *

ISIAN_UMUM = [4780, 4781, 4782, 4783, 4784, 4785, 4786]
PEMICU = [4788, 4789, 4790, 4791]

BAGIAN_V = "Menimbang, bahwa menurut fakta persidangan, tidak ada fakta hukum yang menunjukkan bahwa antara #0046# dan #7037# pernah mengadakan"
SEMA_V = "Menimbang, bahwa tentang obyek barang tidak bergerak"
BUKTI_V = "Menimbang, bahwa bukti-bukti surat yang diajukan #0046# telah bermeterai cukup"


def _amar_v(d, b):
    d = ganti_paragraf(d, "\\tab Menyatakan #7037# yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir;", "#4800#", b)
    d = hapus_paragraf(d, "\\tab Mengabulkan #0053# #0046# dengan verstek;", b)
    d = hapus_paragraf(d, "\\tab Menetapkan harta-harta sebagai berikut: #8730# adalah harta bersama", b)
    d = hapus_paragraf(d, "masing-masing berhak 1/2 (seperdua) dari harta bersama sebagaimana disebutkan pada diktum putusan nomor 3;", b)
    d = hapus_paragraf(d, "\\tab Menghukum #0046# atau #7037# atau siapapun yang menguasai obyek harta bersama pada diktum putusan nomor 3", b)
    d = ganti_teks(d, "6.\\tab #8505# (#0155# #7095#)", "#4801#.\\tab #8505# (#0155# #7095#)", 1, b)
    return d


def _amar_k(d, b):
    d = ganti_paragraf(d, "1.\\tab Mengabulkan #0053# #0046#;", "#4802#", b)
    d = hapus_paragraf(d, "2.\\tab Menetapkan harta-harta sebagai berikut: #8730# adalah harta bersama", b)
    d = hapus_paragraf(d, "masing-masing berhak 1/2 (seperdua) dari harta bersama sebagaimana disebutkan pada diktum putusan nomor 2;", b)
    d = hapus_paragraf(d, "4.\\tab Menghukum #0046# atau #7037# atau siapapun yang menguasai obyek harta bersama pada diktum putusan nomor 2", b)
    d = ganti_teks(d, "5.\\tab #8505# (#0155# #7095#)", "#4803#.\\tab #8505# (#0155# #7095#)", 1, b)
    return d


def tambal_v_k(nama, d):
    """[01b] verstek dan [02a] kontradiktoir tanpa konvensi."""
    verstek = nama.startswith("[01b]")
    d = ganti_paragraf(d, BAGIAN_V, "#4794#", nama)
    d = sisip_setelah(d, SEMA_V, "#4799#", nama)
    d = sisip_setelah(d, BUKTI_V, "#4807#", nama)
    d = _amar_v(d, nama) if verstek else _amar_k(d, nama)
    d = tambah_isianasal(d, ISIAN_UMUM + [8730], nama)
    seimbang(d, nama)
    return d


def tambal_kk(nama, d):
    """[01] dan [01a]: konvensi-rekonvensi. Bagian rekonvensi tidak diubah."""
    b = nama
    normal = "Menimbang, bahwa terhadap syarat formil dan materiil bukti surat dan saksi-saksi Tergugat"
    # jawab-menjawab dan beban pembuktian per objek (dulu keterangan merah + butir contoh)
    d = ganti_paragraf(d, "ISI SESUAI JAWAB-MENJAWAB", "#4805#", b)
    d = hapus_paragraf(d, "mengakui bahwa objek tersebut diperoleh selama perkawinan Penggugat dan Tergugat, sehingga merupakan pengakuan murni", b)
    d = hapus_paragraf(d, "mengakui objek tersebut dengan keterangan tambahan bahwa", b)
    d = hapus_paragraf(d, "membantah dengan alasan _;", b)
    d = ganti_paragraf(d, "Apakah objek _ (posita _) diperoleh selama masa perkawinan", "#4806#", b)
    # bukti surat
    d = ganti_paragraf(d, "ISI URAIAN ISI MASING-MASING BUKTI SURAT/ELEKTRONIK PENGGUGAT", "#4807#", b)
    d = sisip_sebelum(d, "ISI URAIAN ISI MASING-MASING BUKTI TERGUGAT (T.1 dst.)", "#4808#", b, tiru=normal)
    d = ganti_teks(d, "ISI URAIAN ISI MASING-MASING BUKTI TERGUGAT (T.1 dst.) DAN KETERANGAN SAKSI TERGUGAT YANG RELEVAN.", "ISI KETERANGAN SAKSI TERGUGAT YANG RELEVAN.", 1, b)
    # fakta objek tidak terbukti
    d = ganti_paragraf(d, "Bahwa objek _ (posita _) tidak terbukti sebagai harta bersama", "#4809#", b)
    # bagian dan sita
    d = ganti_paragraf(d, "Menimbang, bahwa menurut fakta persidangan, tidak ada fakta hukum yang menunjukkan bahwa antara Penggugat dan Tergugat pernah mengadakan perjanjian perkawinan pada waktu", "#4813#", b)
    d = hapus_paragraf(d, "Menimbang, bahwa berdasarkan pertimbangan tersebut, #8554# menyimpulkan pembagian harta bersama antara Penggugat dan Tergugat, adalah masing-masing", b)
    d = ganti_paragraf(d, "Menimbang, bahwa oleh karena objek yang telah diletakkan sita jaminan berdasarkan Putusan Sela tanggal #0218# terbukti sebagai harta bersama", "#4814#", b)
    # pertimbangan lain + uang paksa + serta merta (judul ikut variabel)
    judul_up = "Tentang Petitum Uang Paksa ("
    d = sisip_sebelum(d, judul_up, "#4812#", b, tiru=normal)
    d = sisip_sebelum(d, judul_up, "#4810#", b, tiru=normal)
    for a in (judul_up, "HAPUS BAGIAN UANG PAKSA INI BILA TIDAK DITUNTUT.", "Menimbang, bahwa Penggugat dalam petitumnya menuntut agar Tergugat dihukum membayar uang paksa", "putusan Mahkamah Agung No. 307K/Sip/1976, tertanggal 7 Desember 1976. Intinya", "dapat dilaksanakan dengan eksekusi riil, terlebih terhadap objek yang telah diletakkan sita jaminan"):
        d = hapus_paragraf(d, a, b)
    judul_sm = "Tentang Petitum Putusan Serta Merta ("
    d = sisip_sebelum(d, judul_sm, "#4811#", b, tiru=normal)
    for a in (judul_sm, "HAPUS BAGIAN PUTUSAN SERTA MERTA INI BILA TIDAK DITUNTUT.", "Menimbang, bahwa terhadap petitum putusan serta merta, #8554# merujuk Surat Edaran Mahkamah Agung Nomor 3 Tahun 2000"):
        d = hapus_paragraf(d, a, b)
    # amar dalam konvensi
    d = ganti_paragraf(d, "\\tab Mengabulkan gugatan Penggugat untuk sebagian;", "#4804#", b)
    for a in ("\\tab Menyatakan sah dan berharga sita jaminan", "\\tab Menetapkan harta berupa: ", "\\tab Menetapkan Penggugat dan Tergugat masing-masing berhak mendapat seperdua", "\\tab Menghukum Penggugat dan Tergugat atau siapa saja yang menguasai harta bersama", "\\tab Menolak gugatan Penggugat selain dan selebihnya;"):
        d = hapus_paragraf(d, a, b, urut=0 if a.endswith("harta berupa: ") else None)
    d = tambah_isianasal(d, ISIAN_UMUM + [4787, 8730], b)
    seimbang(d, b)
    return d


def tambal(nama, d):
    if nama.startswith("[01b]") or nama.startswith("[02a]"):
        return tambal_v_k(nama, d)
    if nama.startswith("[01] ") or nama.startswith("[01a]"):
        return tambal_kk(nama, d)
    raise GagalTambal("berkas tidak dikenal: " + nama)
