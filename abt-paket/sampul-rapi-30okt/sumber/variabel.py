# -*- coding: utf-8 -*-
"""Definisi variabel paket abt-sampul-rapi-30okt.

BARU (blok 11600-11617, data_sql): tabel RTF dari fungsi paket (sumber/fungsi.sql), satu variabel per ukuran kertas (lebar isi dan jumlah
baris berbeda) dan, untuk lampiran sampul, per varian tata letak (nama per sisi yang tampil di sampul).

DIUBAH (60 variabel paket sampul-daftar-isi-26okt, keadaan server = dump 28 Okt):
  - 5702, 5706, ... 5778 (agenda riwayat sidang) dan 5703, 5707, ... 5779 (hasil / alasan penundaan): teks SIPP sering memuat baris baru
    berderet (contoh perkara 459/Pdt.G/2026: dua belas baris kosong sebelum "Pembuktian Tergugat") sehingga satu baris riwayat setinggi
    seperempat halaman dan sampul pecah dua lembar. Sekarang dibungkus isian_rtf_teks_sel (satu baris, spasi tunggal).
  - 5870-5889 (kotak hadir P/T): pemisah tiga spasi berubah menjadi tab di renderer ABT (kotak T terlempar ke kanan); kini satu spasi.
"""
import re

LEBAR = {'a4': 10466, 'f4': 10749, 'legal': 10806}           # lebar isi (twip) = kertas - margin 720 + 720 (alat/rtf_dasar.py)
BARIS_DAFTAR = {'a4': 21, 'f4': 27, 'legal': 29}               # = BARIS_DAFTAR_ISI portal (lib/berkas-cetak.ts)
BARIS_CEKLIST = {'a4': 20, 'f4': 25, 'legal': 29}              # = BARIS_CEKLIST portal
BARIS_RIWAYAT = {'a4': 15, 'f4': 18, 'legal': 20}              # baris riwayat sidang sampul cetak awal (= KERTAS.barisAwal portal)
NAMA_KERTAS = {'a4': 'A4', 'f4': 'F4', 'legal': 'LEGAL'}
URUT = ('a4', 'f4', 'legal')
VARIAN = [   # (berlawanan, banyak, muat, nama)
    (True, False, 1, 'SAMPUL BIASA'),
    (False, False, 2, 'SAMPUL PERMOHONAN'),
    (True, True, 8, 'SAMPUL PIHAK BANYAK'),
    (False, True, 12, 'SAMPUL PERMOHONAN PIHAK BANYAK'),
]
FUNGSI = ['isian_rtf_teks_sel', 'isian_rtf_baris_tabel', 'isian_rtf_tabel_daftar_isi', 'isian_rtf_tabel_ceklist', 'isian_rtf_lampiran_sampul']


def baru():
    """{no_var: (nama, sql_query)}"""
    v = {}
    for i, k in enumerate(URUT):
        v[11600 + i] = ('DAFTAR ISI BERKAS: TABEL DOKUMEN %s (OTOMATIS dari SIPP; baris kosong memenuhi halaman; lewat panel diganti tabel berhalaman)' % NAMA_KERTAS[k],
                        "SELECT aps_badilag.isian_rtf_tabel_daftar_isi(#perkara_id#,'A',%d,%d) AS data" % (LEBAR[k], BARIS_DAFTAR[k]))
    for i, k in enumerate(URUT):
        v[11603 + i] = ('CEKLIST BERKAS: TABEL DOKUMEN %s (OTOMATIS menurut jenis perkara; ada/tidak ada dari penetapan dan kasir)' % NAMA_KERTAS[k],
                        "SELECT aps_badilag.isian_rtf_tabel_ceklist(#perkara_id#,%d,%d) AS data" % (LEBAR[k], BARIS_CEKLIST[k]))
    n = 11606
    for lawan, banyak, muat, nama in VARIAN:
        for k in URUT:
            v[n] = ('LAMPIRAN %s %s (hanya bila perlu: pihak, objek sengketa, anak, riwayat sidang lanjutan; kosong = tanpa lampiran)' % (nama, NAMA_KERTAS[k]),
                    "SELECT aps_badilag.isian_rtf_lampiran_sampul(#perkara_id#,%d,%d,%d) AS data" % (LEBAR[k], BARIS_RIWAYAT[k], muat))
            n += 1
    v[11618] = ('CIRI SAMPUL: GHAIB TAMPIL (isian 5807; kosong = tanpa tampilan, bukan titik-titik)',
                "SELECT IFNULL(NULLIF((SELECT d.data FROM aps_badilag.abt_data_teks d WHERE d.no_var=5807 AND d.perkara_id=#perkara_id# LIMIT 1),''),%s) AS data" % KOSONG)
    v[11619] = ('CIRI SAMPUL: MAFQUD TAMPIL (isian 5808; kosong = tanpa tampilan, bukan titik-titik)',
                "SELECT IFNULL(NULLIF((SELECT d.data FROM aps_badilag.abt_data_teks d WHERE d.no_var=5808 AND d.perkara_id=#perkara_id# LIMIT 1),''),%s) AS data" % KOSONG)
    return v


UBAH_TEKS = [5702 + 4 * i for i in range(20)] + [5703 + 4 * i for i in range(20)]   # agenda, hasil/alasan
UBAH_LAIN = [5700 + 4 * i for i in range(20)] + [5701 + 4 * i for i in range(20)]   # tanggal, sandi hadir (sampul lengkap)
UBAH_HADIR = list(range(5870, 5890))
UBAH_BUNGKUS = [5832, 5847, 5868, 5897]   # anak sebaris, intervensi, baris kumulasi, turut tergugat: tanpa baris hasil = tanpa tampilan (bukan titik-titik)
UBAH_PIHAK = [5830, 5831]   # pekerjaan + alamat + kuasa pihak I/II (sampul semua varian)
UBAH = sorted(UBAH_TEKS + UBAH_LAIN) + UBAH_HADIR + UBAH_BUNGKUS + UBAH_PIHAK
KOSONG = "'\\\\b0'"   # literal SQL '\\b0' = kata kendali tanpa tampilan: baris riwayat yang belum ada tercetak kosong (bukan "..."), di ABT maupun panel


def ubah(asal):
    """asal: {no_var: sql lama} -> {no_var: sql baru}. Gagal (AssertionError) bila bentuk lama tidak seperti yang diharapkan."""
    hasil = {}
    for n in UBAH_TEKS + UBAH_LAIN:
        q = asal[n]
        m = re.match(r'^SELECT (.+) AS data FROM perkara_jadwal_sidang (WHERE .+ LIMIT \d+,1)$', q, re.S)
        assert m, (n, q[:120])
        isi = 'aps_badilag.isian_rtf_teks_sel(%s)' % m.group(1) if n in UBAH_TEKS else m.group(1)
        hasil[n] = "SELECT IFNULL(NULLIF((SELECT %s FROM perkara_jadwal_sidang %s),''),%s) AS data" % (isi, m.group(2), KOSONG)
    for n in UBAH_HADIR:
        q = asal[n]
        assert q.count("P   ") == 2, (n, q[:200])   # CONCAT(.., ' P   ', ..) dan bawaan '[ ] P   [ ] T'
        hasil[n] = q.replace("P   ", "P ")
    for n in UBAH_BUNGKUS:
        q = asal[n].strip().rstrip(';')
        assert re.search(r' AS data(?![A-Za-z_])', q, re.I), (n, q[:120])
        hasil[n] = "SELECT IFNULL(NULLIF((SELECT t.data FROM (%s) t LIMIT 1),''),%s) AS data" % (q, KOSONG)
    for n in UBAH_PIHAK:
        assert asal[n].startswith("SELECT CONCAT('Pekerjaan: '"), (n, asal[n][:80])
        hasil[n] = pihak_sampul(1 if n == 5830 else 2)
    return hasil


def pihak_sampul(sisi):
    """Satu isian pihak I/II di sampul: "Pekerjaan: X - Alamat: Y" (bagian pekerjaan dilewati bila SIPP kosong/"-": tidak ada "- -"),
    permohonan (Pdt.P) pihak I: alamat Pemohon II bila berbeda, lalu baris "Kuasa: NAMA" HANYA bila ada kuasa (bukan "Kuasa: ..." kosong)."""
    t = 'perkara_pihak%d' % sisi
    sebut = "IF((SELECT p.alur_perkara_id FROM perkara p WHERE p.perkara_id=#perkara_id#)=16,'Pemohon II','II')"
    alamat2 = ("IF((SELECT p.alur_perkara_id FROM perkara p WHERE p.perkara_id=#perkara_id#)=16,IFNULL((SELECT CONCAT('<br>Alamat Pemohon II: ',TRIM(b.alamat)) "
               "FROM perkara_pihak1 b WHERE b.perkara_id=a.perkara_id AND aps_badilag.isian_rtf_pihak_peringkat(1,b.id)=2 AND TRIM(IFNULL(b.alamat,''))<>'' "
               "AND TRIM(b.alamat)<>TRIM(IFNULL(a.alamat,'')) LIMIT 1),''),'')") if sisi == 1 else "''"
    del sebut
    return ("SELECT CONCAT(IF(TRIM(IFNULL(h.pekerjaan,'')) REGEXP '^[-. ]*$','',CONCAT('Pekerjaan: ',TRIM(h.pekerjaan),' - ')),"
            "'Alamat: ',IFNULL(NULLIF(TRIM(a.alamat),''),'-'),%s,"
            "IFNULL((SELECT CONCAT('<br>Kuasa: ',TRIM(k.nama)) FROM perkara_pengacara k WHERE k.perkara_id=a.perkara_id AND k.pihak_ke=%d AND k.urutan=1 "
            "AND TRIM(IFNULL(k.nama,''))<>'' LIMIT 1),'')) AS data FROM %s a LEFT JOIN pihak h ON h.id=a.pihak_id "
            "WHERE a.perkara_id=#perkara_id# ORDER BY a.urutan, a.id LIMIT 1") % (alamat2, sisi, t)
