# -*- coding: utf-8 -*-
"""Tambalan RTF blangko Derry paket x4 (kelompok 2): bagian akibat cerai yang belum tercetak pada varian. Tiap tambalan = jangkar
(penanda yang sudah ada di blangko, harus ditemukan TEPAT sebanyak 'n') diganti jangkar + penanda baru. Isi tetap varian (mut'ah/iddah
ex officio, hak asuh/nafkah anak kumulasi, nafkah istri 9716/9717) tidak disentuh, jadi tidak ada yang tergandakan.
Daftar: (folder, pola nama berkas (awalan), jenis) ; jenis -> tambalan."""

CT = '1a Perceraian CT'
CG = '1 Perceraian CG'
D1 = '1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak'
D1B = '1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak - BAS'
BK = 'BAS Kumulasi Cerai Gugat Verstek (Hak Asuh Anak)'

JENIS = {
    # varian Mut'ah Iddah CT: mut'ah + iddah tetap (4139 + isi tetap); tambah hak asuh, nafkah anak, madliyah, harta bersama
    'mi': [('#4117##8527#', '#4117##3410##8527#', 1), ('#4139##8505#', '#4139##3411##8505#', 1)],
    # CT [01a] ex officio mut'ah, iddah, nafkah anak tetap: tambah hak asuh, madliyah, harta bersama
    'ex': [('#4117##8527#', '#4117##3412##8527#', 1), ('#8505#', '#3413##8505#', 1)],
    # CG kumulasi nafkah istri (9716/9717): tambah hak asuh, nafkah anak, harta bersama
    'ni': [('#8527#', '#3414##8527#', 1), ('#8505#', '#3415##8505#', 1)],
    # 1d kumulasi hak asuh (hak asuh tetap), amar daftar otomatis
    'ha': [('#8527#', '#3416##8527#', 1), ('#8505#', '#3417##8505#', 1)],
    # 1d kumulasi hak asuh, amar nomor tetap "4.\tab #8505#"
    'ha4': [('#8527#', '#3416##8527#', 1), ('4.\\tab #8505#', '#3420#\\tab #8505#', 1)],
    # 1d kumulasi hak asuh + nafkah anak (keduanya tetap), amar daftar otomatis
    'han': [('#8527#', '#3418##8527#', 1), ('#8505#', '#3419##8505#', 1)],
    # 1d kumulasi hak asuh + nafkah anak, amar nomor tetap "5.\tab #8505#"
    'han5': [('#8527#', '#3418##8527#', 1), ('5.\\tab #8505#', '#3421#\\tab #8505#', 1)],
    # BAS putus verstek 1d (amar saja)
    'bha': [('#8505#', '#3417##8505#', 1)],
    'bhan': [('#8505#', '#3419##8505#', 1)],
    # CG [01a] qabla dukhul: punya amar 4138 tetapi pertimbangan 4119 belum (dilewati paket u2: tanpa jangkar 8527)
    'qd': [('Menimbang bahwa karena perkara }', '#4119#Menimbang bahwa karena perkara }', 1)],
}

BERKAS = [
    (CT, "[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah", 'mi'),
    (CT, "[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - Mut'ah Iddah", 'mi'),
    (CT, '[01a] [Kabul Verstek] CT - F (Ex Offiicio mutah iddah dan nafkah anak)', 'ex'),
    (CG, '[01d] [Kabul Verstek] Cerai (Format Lengkap) - Kumulasi Nafkah Istri', 'ni'),
    (CG, '[02c] [Kabul] CG - Kumulasi Nafkah Istri', 'ni'),
    (CG, '[01a] [Kabul Verstek] Cerai - Alasan E (Qabla Ad Dukhul)', 'qd'),
    (D1, '[01] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak - Anak Belum Mumayyiz', 'ha'),
    (D1, '[01b] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak dan Nafkah Anak', 'han'),
    (D1, '[01c] [Kabul] Putusan CG Kumulasi Hak Asuh Anak - T Tidak Hadir Setelah Mediasi', 'ha4'),
    (D1, '[01d] [Kabul] Putusan CG Kumulasi Hak Asuh dan Nafkah Anak', 'han5'),
    (D1, '[02] [Kabul] Putusan CG Kumulasi Hak Asuh Anak - Kontradiktoir', 'ha4'),
    (D1, '[02b] [Kabul] Putusan CG Kumulasi Hak Asuh dan Nafkah Anak', 'han5'),
    (D1B, 'BAS KUMULASI [2] BAS Putus Verstek CG Kumulasi Hak Asuh Anak - P', 'bha'),
    (D1B, 'BAS KUMULASI [2b] BAS Putus Verstek CG Kumulasi Hak Asuh Anak dan Nafkah Anak', 'bhan'),
    (BK, '[2] BAS Putus Verstek CG Kumulasi Hak Asuh Anak - P', 'bha'),
    (BK, '[2b] BAS Putus Verstek CG Kumulasi Hak Asuh Anak dan Nafkah Anak', 'bhan'),
]
# jumlah berkas yang diharapkan per baris BERKAS (awalan nama bisa mencakup beberapa varian jumlah saksi)
HARAP = {0: 4, 1: 4}
