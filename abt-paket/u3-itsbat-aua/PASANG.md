# Paket ABT "abt-u3-itsbat-aua" - itsbat nikah dan asal usul anak (agen U3, 20 Okt 2026)

**Laptop: SIAP dan teruji pada salinan basis ABT (aps_badilag_u3). Satker: BELUM dipasang (dipasang sesi utama).**
Hanya blangko dan variabel Derry; tidak ada baris lama yang diubah, tidak ada berkas lama yang disentuh, `abt_menu` tidak diubah.
Nomor variabel 4300-4399 (klaim U3); yang dipakai 4300-4315 (kosong di ABT server per 20 Okt 2026, diperiksa baca-saja).

## 1. Hasil audit (yang kurang dari susunan baku)

Susunan baku yang dipakai: kepala, identitas, duduk perkara (posita ringkas, petitum, pengumuman 14 hari bila voluntair, bukti surat,
saksi), pertimbangan (kewenangan absolut/relatif, legal standing Pasal 7 ayat (4) KHI, pokok, pembuktian, fakta hukum, rukun dan syarat
per unsur dengan fakta dari saksi, halangan, Pasal 7 ayat (3) KHI, pencatatan, biaya), amar.

| Blangko Derry | Sudah ada | Kurang | Ditutup oleh |
|---|---|---|---|
| 2 Itsbat Nikah [01]/[01a]/[01b] | kewenangan, legal standing suami/istri, pengumuman, bukti, fakta, halangan, SEMA 7/2012, Pasal 7(3) huruf e, perintah pencatatan | rukun hanya satu paragraf ringkas (wali, saksi, ijab kabul, mahar tidak ditimbang per unsur); dasar itsbat tertanam huruf e (salah untuk nikah sebelum 1974 atau huruf a/b/c); legal standing hanya suami/istri; batas usia tidak ditimbang; tidak ada varian satu Pemohon | **[01d]** (+4300, 4303, 4305-4308), **[01e]** |
| 2a Itsbat Nikah Kontensius [01] | rukun ringkas, Pasal 7(3) huruf e, ahli waris | sama (dasar huruf e tertanam) | **belum diubah** (lihat bagian 6) |
| 1c Kumulasi Itsbat | rukun, huruf e, NO poligami sirri | dasar huruf a (penyelesaian perceraian) | **belum diubah**; bank saksinya sudah (km) |
| 8 Asal Usul Anak [01] | kewenangan, legal standing ayah-ibu, Pasal 42/99/103 | hanya satu keadaan (perkawinan dicatat); tidak ada: perkawinan siri dicatat kemudian (3 dari 3 perkara 2026!), anak luar perkawinan (Pasal 100 KHI, MK 46/PUU-VIII/2010), anak lahir kurang enam bulan; rukun perkawinan orang tua tidak ditimbang; beberapa anak | **[01a]**, **[01b]**, **[01c]** (+4310-4315) |
| BAS ALUR 11 [1]/[1a], ALUR 13 [1] | 15-17 butir tanya jawab diketik pada tabel | butir baru katalog (syarat wali, saksi nikah, istifadhah, anak, dsb.) tidak ikut | **ALUR 11 [1b] [1c], ALUR 13 [1b]** (tanya jawab dari variabel katalog 5058/5059) |

## 2. Isi paket

### 2.1 Variabel baru (`abt_variabel`)

| no | jenis | isi |
|---|---|---|
| 4300 | data_teks (pilihan) | ITSBAT: dasar Pasal 7 ayat (3) KHI - pilihan majelis (huruf e/d/a/b/c); kosong = huruf d bila nikah sebelum 1974, selain itu huruf e |
| 4301 / 4302 | data_teks | keraguan syarat (huruf c) / keterangan hilangnya akta nikah (huruf b) |
| 4303 | data_sql | pertimbangan dasar Pasal 7(3) KHI, tiga paragraf (penjelasan Pasal 49, batas 7(3), kesimpulan huruf terpilih) |
| 4305 | data_teks (pilihan) | kedudukan hukum Pemohon menurut Pasal 7(4) KHI (suami/istri, anak, wali nikah, pihak berkepentingan) |
| 4306 | data_sql | pertimbangan legal standing (menurut 4305 dan jumlah Pemohon) |
| 4307 | data_sql | pertimbangan batas usia; KOSONG kecuali umur (7211/7212) dan tahun nikah memungkinkan (sesudah 2019: 19 tahun; sebelum 2019: 19 pria/16 wanita) |
| 4308 | data_sql | pertimbangan wali nikah (wali nasab kelompok pertama/kedua/ketiga, wali hakim; alasan dari 1357 atau titik-titik) |
| 4310 / 4311 | data_teks | AUA: nomor-tanggal penetapan itsbat orang tua / nama ayah biologis |
| 4312 | data_sql | AUA: nama anak + tanggal lahir dari SIPP `perkara_anak_pihak` |
| 4313 | data_sql | AUA: jarak akad nikah-kelahiran ("lebih/kurang dari enam bulan"); kosong bila tak terhitung |
| 4314 / 4315 | data_teks (pilihan) | AUA: hubungan perdata anak luar perkawinan / status anak lahir kurang enam bulan (KEPUTUSAN HAKIM, tidak diputus mesin) |

Semua `data_sql` hanya SELECT, MariaDB 5.5 (diuji juga di server lewat `alat/uji_server_baca.py`, baca saja).

### 2.2 Blangko baru (tidak menimpa apa pun)

- `2 Itsbat Nikah/[01d] [Kabul] IN - Format Lengkap Rukun dan Syarat per Unsur.rtf`
- `2 Itsbat Nikah/[01e] [Kabul] IN - Satu Pemohon (Pasangan Meninggal, Voluntair).rtf`
- `8 Asal Usul Anak/[01a] ... Perkawinan Siri Dicatat Kemudian, Anak Lahir Sebelum Pencatatan.rtf`
- `8 Asal Usul Anak/[01b] ... Anak Luar Perkawinan Sah, Hubungan Perdata (Ibu Saja atau Perkawinan Siri).rtf`
- `8 Asal Usul Anak/[01c] ... Anak Lahir Kurang dari Enam Bulan setelah Akad Nikah.rtf`
- `2 Itsbat Nikah - BAS/BAS ALUR 11 [1b]` dan `[1c]`, `8 Asal Usul Anak - BAS/BAS ALUR 13 [1b]` (tanya jawab saksi dari katalog)

Dasar hukum yang dipakai hanya yang sudah ada di blangko Derry atau terverifikasi di katalog (KHI Pasal 7, 14, 19-20, 24-27, 30, 39-44, 99, 100,
103; UU 1/1974 Pasal 2, 7, 42, 55; MK 46/PUU-VIII/2010; SEMA 7/2012). **Perlu dicocokkan dengan naskah resmi sebelum dipakai massal**:
KHI Pasal 20 ayat (2), 21, 22, 23 (urutan wali nasab/wali hakim; sumber ringkasan hukumonline.com), KHI Pasal 53, UU 1/1974 Pasal 43 ayat (1),
UU 1/1974 Pasal 7 ayat (1) sebelum diubah (19/16 tahun). Tanda kutip butir Pasal 7(3) memakai tanda kutip lurus (karakter non-ASCII hilang
saat dirender ABT).

## 3. Pasang (di server, setelah rilis ALETA yang memuat branch `fitur/u3-itsbat-aua`; boleh sebelumnya)

```bash
cd /d/aleta-dev/wt/u3-itsbat-aua/abt-paket/u3-itsbat-aua
ssh aleta 'mkdir -p /root/paket-abt/abt-u3-itsbat-aua'
scp -r paket-satker/* aleta:/root/paket-abt/abt-u3-itsbat-aua/
ssh aleta 'cd /root/paket-abt/abt-u3-itsbat-aua && md5sum -c MD5SUMS.txt | grep -vc ": OK$"'      # harus 0
ssh aleta 'bash /root/paket-abt/abt-u3-itsbat-aua/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|105|5)`, `CADANGAN ... harus 0`, `SEMUA COCOK`, `uji perkara N: 6 kueri menjawab` (2 perkara),
`PASANG=8`, `COCOK=8`, `BERKAS COCOK`, `SELESAI`. Gagal di mana pun = dipulihkan otomatis. Pulih manual: `bash .../pulih-satker.sh` -> `PULIH=8`, `PULIH COCOK`.

## 4. Hasil uji (20 Okt 2026)

- Salinan basis `aps_badilag_u3` (MariaDB lokal): pasang -> `SEMUA COCOK`; pasang ganda ditolak prasyarat (`14|105|5`); pulih -> `PULIH COCOK` dan berkas hilang; pasang ulang berhasil.
- Kueri 6 variabel `data_sql` dijalankan di MariaDB 5.5 SERVER (baca saja) atas perkara 10255 (itsbat) dan 10090 (asal usul anak): semuanya menjawab.
- Render php56 (`alat/render_uji.py`, salinan aplikasi ABT menunjuk basis sementara; aplikasi/ basis asli tidak disentuh): lihat `hasil-render.md`.
- vitest: `u3-itsbat-aua-katalog-20okt` (18), `u3-itsbat-aua-paket-20okt` (19), semua uji katalog/deteksi/kamus terkait.

## 5. Ukur (perkara nyata 2026, data baca-saja; `alat/ukur_katalog.cjs`, `alat/ukur_deteksi.cjs`)

| | sebelum | sesudah |
|---|---|---|
| itsbat nikah (212 perkara): butir per saksi (tingkat bawaan) | 20 | 28 (+8) |
| baris jawaban lengkap otomatis / ragu / manual | 7436 (87,5%) / 424 / 638 | 10780 (90,7%) / 424 / 686 |
| asal usul anak (3 perkara): butir per saksi | 17 | 23 |
| asal usul anak: otomatis / manual | 90 (88,2%) / 12 | 118 (85,5%) / 20 |
| butir katalog | 67 + 22 + 20 | 131 + 39 + 33 |
| deteksi 1357 (alasan wali bukan ayah) | 46 dari 67 wali non-ayah | 49 (+3: ayah berada jauh, sakit, tidak diketahui keberadaannya; 18 sisanya tidak menyebut alasan di posita = manual) |
| deteksi 9709 (tempat-tanggal lahir anak) | 0 | 2 dari 3 perkara AUA (anak tunggal; 1 perkara tiga anak = manual) |

Isian yang tetap manual karena tidak ada sumbernya: 7211/7212 pada 15% perkara itsbat, mahar (1001) pada 68 baris, 9710 (sebab belum akta), 4310/4311.

## 6. Yang belum

- Blangko `2a Itsbat Nikah Kontensius` dan `1c Kumulasi Itsbat` belum memakai pilihan dasar Pasal 7(3) (4300/4303); bank saksinya sudah lengkap.
- Putusan "ditolak/NO" per unsur ([03], [03a] dst.) belum memakai variabel baru.
- Layar pilihan majelis (4300, 4305, 4314, 4315) memakai kartu isian Blangko Derry; penanda "diisi manual/opsional" ada di `isian-metadata.ts`.

## 7. Alat (`alat/`)

`tambah_katalog.py` (bangun ulang JSON katalog dari `cadangan-katalog/`), `bangun_in.py` `bangun_aua.py` `bangun_bas.py` (RTF), `bangun_sql.py` (SQL, daftar, MD5SUMS),
`variabel.py` (satu sumber variabel), `uji_kueri.py` `uji_server_baca.py` `render_uji.py` (uji), `periksa_katalog.cjs` `periksa_rtf.py`.
Bangun ulang: `python tambah_katalog.py && node ../../../manajemen_surat/scripts/susun-saksi-katalog.mjs && python bangun_in.py && python bangun_aua.py && python bangun_bas.py && python bangun_sql.py`.
