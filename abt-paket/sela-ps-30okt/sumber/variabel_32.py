# -*- coding: utf-8 -*-
"""Variabel putaran 3 (jawaban pengguna 30 Okt atas 9 pertanyaan putaran 2): blok 11404-11419. Dipanggil dari variabel.py (tambah(...))."""


def tambah(var, isian, nil, ada, huruf1, PERKARA, UU_PA, V):
    # --- rekonvensi: sisipan "Dalam Rekonvensi" dikabulkan / ditolak --------------------------------------------------------------
    var(11404, 'REKONVENSI: POKOK TUNTUTAN PENGGUGAT REKONVENSI - ISIAN (kalimat sesudah "menuntut", mis. nafkah iddah sejumlah ...; tanpa titik akhir)',
        tipe='data_teks')
    var(11405, 'REKONVENSI: TANGGAPAN TERGUGAT REKONVENSI - ISIAN (kalimat sesudah "yang pada pokoknya", tanpa titik akhir)', tipe='data_teks')
    var(11406, 'REKONVENSI: FAKTA DAN PERTIMBANGAN MAJELIS - ISIAN (kalimat sesudah "bahwa", tanpa titik akhir)', tipe='data_teks')
    var(11407, 'REKONVENSI DIKABULKAN: AMAR HUKUMAN/PENETAPAN - ISIAN (mis. Menghukum Tergugat Rekonvensi untuk membayar ...; tanpa nomor dan titik akhir)',
        tipe='data_teks')
    var(11408, 'REKONVENSI DIKABULKAN: SEBAGIAN ATAU SELURUHNYA - ISIAN (ketik S bila dikabulkan sebagian; kosong = seluruhnya)', tipe='data_teks')
    var(11409, 'REKONVENSI DIKABULKAN: KATA SEBAGIAN/SELURUHNYA (OTOMATIS dari isian 11408)',
        sql='SELECT IF(%s = "S", "sebagian", "seluruhnya") AS data' % huruf1(11408))
    var(11410, 'REKONVENSI DIKABULKAN SEBAGIAN: AMAR MENOLAK SELEBIHNYA (OTOMATIS dari isian 11408; kosong bila seluruhnya)',
        sql=('SELECT IF(%s = "S", CONCAT(";<br>3.", CHAR(9), "Menolak gugatan Penggugat Rekonvensi untuk selain dan selebihnya"), "") AS data' % huruf1(11408)))
    # --- putusan akhir li'an ------------------------------------------------------------------------------------------------------
    var(11411, "LI'AN: ANAK YANG DIINGKARI SUAMI - ISIAN (nama, tempat dan tanggal lahir; kosong = tidak ada pengingkaran anak)", tipe='data_teks')
    var(11412, "LI'AN: AMAR NASAB ANAK KEPADA IBU (OTOMATIS dari isian 11411; kosong bila tidak ada pengingkaran anak)",
        sql=('SELECT IF(%s, CONCAT(";<br>4.", CHAR(9), "Menyatakan anak bernama ", %s, " dinasabkan kepada #11393# sebagai ibunya"), "") AS data'
             % (ada(11411), isian(11411))))
    var(11419, "LI'AN: NOMOR BUTIR AMAR BIAYA (OTOMATIS: 5. bila ada amar nasab anak, selain itu 4.)",
        sql='SELECT IF(%s, "5.", "4.") AS data' % ada(11411))
    biaya = next(x for x in V if x['no'] == 11319)['sql']
    kawin = ('"Menimbang, bahwa oleh karena perkara a quo termasuk bidang perkawinan, berdasarkan Pasal 89 ayat (1) ' + UU_PA +
             ', biaya perkara dibebankan kepada #7036#"')
    lama_else = '"Menimbang, bahwa oleh karena eksepsi #7037# dikabulkan, #7036# berada di pihak yang kalah, sehingga berdasarkan #11307# biaya perkara dibebankan kepada #7036#"'
    assert biaya.count(lama_else) == 1 and biaya.count('oleh karena eksepsi #7037# dikabulkan, biaya perkara semestinya') == 1
    biaya = biaya.replace(lama_else, kawin).replace('oleh karena eksepsi #7037# dikabulkan, biaya perkara semestinya',
                                                   'oleh karena perkara a quo termasuk bidang perkawinan, biaya perkara semestinya')
    var(11414, 'PUTUSAN AKHIR BIDANG PERKAWINAN (mis. li\'an): PERTIMBANGAN BIAYA PERKARA (OTOMATIS: prodeo = DIPA tahun pendaftaran; selain itu Pasal 89 ayat (1) UU 7/1989)',
        sql=biaya)
    # --- penetapan tergugat tidak beriktikad baik: cara bayar biaya mediasi (PERMA 1/2016 Pasal 23 ayat (4)) -------------------
    var(11416, 'MEDIASI TIDAK BERIKTIKAD BAIK (TERGUGAT): CARA BAYAR BIAYA MEDIASI - ISIAN (ketik P bila dimasukkan dalam panjar biaya perkara; kosong = dibayar tersendiri)',
        tipe='data_teks')
    var(11415, 'MEDIASI TIDAK BERIKTIKAD BAIK (TERGUGAT): KALIMAT CARA BAYAR BIAYA MEDIASI (OTOMATIS dari isian 11416, PERMA 1/2016 Pasal 23 ayat (4))',
        sql=('SELECT IF(%s = "P", "yang dimasukkan dalam panjar biaya perkara", "yang dibayar tersendiri oleh #7037# melalui Kasir #8008#") AS data'
             % huruf1(11416)))
    # --- pemisahan perkara (splitsing) --------------------------------------------------------------------------------------------
    var(11417, 'PEMISAHAN PERKARA: TUNTUTAN/BAGIAN YANG DIMOHONKAN DIPISAHKAN - ISIAN (mis. tuntutan pembagian harta bersama; tanpa titik akhir)',
        tipe='data_teks')
    var(11418, 'PEMISAHAN PERKARA: ALASAN MAJELIS - ISIAN (mis. tidak ada hubungan erat / pemeriksaan bersama mempersulit; tanpa titik akhir)', tipe='data_teks')
