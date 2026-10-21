# Paket ABT `abt-x1-perbaikan-audit-21okt` - perbaikan temuan BERAT audit variabel ABT 21 Okt 2026 (agen X1)

**Status: teruji di ABT LAPTOP (PRASYARAT, pasang, PERIKSA, pasang ulang, pulih, pasang lagi) dan di renderer php56 ABT asli; PRASYARAT dan kueri variabel baru dijalankan BACA SAJA di server (MariaDB 5.5). Server: BELUM dipasang - dipasang sesi utama.**
Bahan: `D:/Aplikasi/aleta/tmp/audit-variabel-abt-21okt.json` (B1, B2, B3 dan catatan "di luar cakupan" 7047/7048/7054/7055/7097/7098).
Hanya tabel `abt_variabel` yang disentuh: **44 variabel baru** dan **7 baris diubah**. Tidak ada blangko (RTF), folder, menu, atau isian tersimpan per perkara yang diubah. Kolom `modifier` = `admin` (sama dengan paket-paket lain), tanpa kata "Aleta"; teks semua ASCII.

## Isi

| butir | yang dibuat / diubah | sumber data |
|---|---|---|
| **B2** `8133` Alat Bukti Dispen | `default_data` DIGANTI kerangka 9 bukti surat (P.1-P.9: KTP, KTP, KK, Akta Nikah, Akta Kelahiran, Ijazah, KTP calon, KK calon, surat penolakan KUA) berisi `...` pada nama, NIK, nomor, tanggal, penerbit. Tipe (`data_teks`) dan nama tetap. Isian tersimpan per perkara TIDAK diubah (lihat "Isian 8133 yang masih berdata lama"). | - |
| **B1** `9023` Nama Yang Menikahkan (dirujuk 58 blangko itsbat + templat tanya-jawab IN1/IN2/IN3/A3) | **BARU** `9023` `data_teks` (isian popup), `default_data` = `#10113#`. **BARU** `10113` "Otomatis Nama Yang Menikahkan" `data_sql`: membaca kalimat posita `yang menikahkan adalah <nama> (Imam ...)` (juga `... yaitu <nama> (`), dipagari (3-80 huruf, tanpa angka/tanda kurung/titik koma), kosong bila tidak yakin. | SIPP TIDAK memuatnya terstruktur (`perkara_data_itsbat` hanya `tgl_menikah`, `tempat_menikah`; `perkara_data_pernikahan` hanya tgl/KUA/nomor akta), hanya teks posita; terbaca pada ±18-26% perkara itsbat. Karena tidak andal -> isian teks (bukan `data_sql`) dengan bawaan bantuan, pola yang sama dengan `8087` (bawaan `#10109#`). |
| **B3** `8013` nama mediator ("menetapkan #8013# sebagai mediator", Cerai Gugur habis biaya) | **BARU** `data_sql`: `perkara_mediasi.mediator_text` mediasi TERAKHIR yang namanya terisi; tanpa mediasi = titik-titik. Setara `56` (Nama Mediator, `data_sipp`) tetapi tidak mengambil baris kosong. | SIPP `perkara_mediasi` |
| **B3** `0237` nama mediator (Akta Perdamaian) | **BARU** `237` (tertulis `0237` di blangko), kueri sama dengan `8013`. | SIPP `perkara_mediasi` |
| **B3** `8129` tanggal relaas ("berita acara panggilan tanggal #8129# dan tanggal #0120#", Kewarisan NO) | **BARU** `data_sql`: tanggal relaas PERTAMA ke Tergugat I (`perkara_pelaksanaan_relaas` + `perkara_pihak2.urutan=1`); tanpa relaas = titik-titik. Hasilnya sama dengan `1077` pada 873/873 perkara Pdt.G uji (822 berisi), tetapi tanpa tampilan `v_pihak_perkara` yang lambat. | SIPP |
| **B3** `5510` nama anak (DK 2023) | **BARU** `data_sql`: dari `perkara_mempelai_dk` - mempelai yang berumur di bawah 19 tahun saat perkara didaftarkan; bila dua orang, yang ditandai `dimohonkan`; tetap dua = "A dan B"; tanpa data umur, yang ditandai `dimohonkan`; selain itu titik-titik. DK 199 perkara: 27 kosong (tanpa baris mempelai), 116 satu nama, 56 dua nama (lokal). | SIPP |
| **Butir 4** Pemohon/Penggugat IV-V dirujuk `7047`/`7097` | **BARU** `3121`-`3129` (nama, agama, NIK, tempat lahir, tgl lahir, umur, pekerjaan, pendidikan, alamat Pemohon IV; pola `3111`-`3119` +10, cocok dengan templat "Penetapan Ahli Waris Kabul" yang memakai 3111/3121/3131 sebagai nama III/IV/V) dan `3131` (nama Pemohon V). | SIPP `perkara_pihak1` + `pihak` |
| **Butir 4** Tergugat/Termohon II-V dirujuk `7048`/`7098` | **BARU** NIK/tempat/tgl lahir/agama Tergugat II (`5078`-`5081`) dan seperangkat lengkap Tergugat III (`5083`-`5089`, nama `5118`), IV (`5090`-`5097`), V (`5098`,`5099`,`5102`-`5104`,`5106`,`5107`,`5117`). Nomor persis seperti yang sudah dirujuk kueri, KECUALI nama Tergugat III: `5082` -> `5118` (lihat di bawah). Tgl lahir `0000-00-00` = titik-titik. | SIPP `perkara_pihak2` + `pihak` |
| **Butir 4** `7048`, `7098` | DIUBAH: `#5082#` -> `#5118#` (4 dan 6 tempat). `5082` sudah dipakai templat Fikrianto ("BAS IN CERAI Sidang 2 ... saksi keempat") sebagai TANYA-JAWAB saksi 4; kalau dibuat sebagai nama Tergugat III, templat itu mencetak nama pihak. | - |
| **Butir 4** `7047`, `7097` | DIUBAH: `#7064#` dibuang (4 dan 5 tempat). Nomor 7064 tidak ada di ABT; di dalam kueri menyulih kosong, jadi tidak mengubah cetakan - hanya dibersihkan supaya paket lain yang kelak memakai 7064 tidak menyusup. | - |
| **Butir 4** `7055` (Turut Tergugat, `perkara_pihak4`) | DIUBAH: sekarang `SELECT "#8710#" AS data`. Rujukan lamanya (`3510`-`3515`, `03517`) tidak ada di ABT sehingga Turut Tergugat tercetak sebagai baris kosong ("NIK , tempat dan tanggal lahir , ...") dan berhenti di 5 orang. `8710` sudah tersedia: identitas Turut Tergugat dari SIPP sampai 10 orang. | SIPP |
| **Butir 4** `7054` (pihak ketiga = `perkara_pihak3`, pihak intervensi) | DITULIS ULANG: identitas pihak intervensi dari `perkara_pihak3` + `pihak` (sebutan dari `jenis_intervensi_nama`, bawaan "Pihak Intervensi"; sampai 5 orang). Kueri lama mencetak data Tergugat I/II dengan nomor yang salah. Di server `perkara_pihak3` kosong (0 perkara), jadi tidak mengubah cetakan yang ada. | SIPP |

Nomor `3121`-`3131`, `5078`-`5118`, `0237`, `5510`, `8013`, `8129`, `9023`, `10113`: BEBAS di server (dicek `abt_variabel` 21 Okt, 2.377 baris) dan tidak dipakai paket lain yang dicek (`D:/aleta-dev/wt/*/abt-paket`, `kerja`, `cadangan-db`).

Berkas `paket-satker/`: `...-PRASYARAT.sql`, `...-PASANG.sql`, `...-PERIKSA.sql`, `...-PULIH.sql`, `pasang-satker.sh`, `pulih-satker.sh`, `hitung-8133.sh`, `nomor-baru.txt`, `nomor-ubah.txt`, `perkara-uji.txt`, `uji-kueri.tsv`, `MD5SUMS.txt`. Dibangun ulang dengan `python sumber/bangun_paket.py` (butuh salinan HEX `abt_variabel` server di `VAR_SERVER_HEX`, di luar repo; untuk memasang cukup `paket-satker/`). `sumber/variabel_def.py` = definisi terbaca; `hasil/isi-paket.json` = ringkasan tanpa data pribadi.

## PRASYARAT yang diharapkan (server, baca saja, 21 Okt 2026)

`0|0|7|0|43|0` = A nomor baru berisi lain (0) | B nomor baru yang sudah persis paket (0) | C dari 7 baris yang akan diubah, yang masih isi LAMA (7) | D yang sudah isi BARU (0) | E dari 43 variabel lama yang dirujuk, yang ada (43) | F baris diubah yang isinya bukan lama bukan baru (0).
Pasang ulang: `0|44|0|7|43|0`. Angka lain = berhenti, tidak ada yang diubah.
Ini SUDAH dijalankan baca saja di server dan hasilnya `0|0|7|0|43|0` (SELECT atas `aps_badilag.abt_variabel`).

## Pasang (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/integrasi21/abt-paket/x1-perbaikan-audit-21okt     # atau folder repo hasil gabung
ssh aleta 'mkdir -p /root/abt-x1-20261021'
scp -r paket-satker/* aleta:/root/abt-x1-20261021/
ssh aleta 'cd /root/abt-x1-20261021 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-x1-20261021/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|7|0|43|0)`, `CADANGAN: ... (7 baris lama)`, tiga baris hitungan "isian 8133 ...", `SEMUA COCOK`, delapan baris `uji perkara NNNN: 37 kueri jalan; berisi: ...`, `SELESAI`.
Pulih: `ssh aleta 'bash /root/abt-x1-20261021/pulih-satker.sh'` (baris terakhir `PULIH COCOK`).
Gagal sesudah PASANG (PERIKSA/uji tidak cocok) = pulih otomatis. Tidak perlu memulai ulang apa pun (ABT membaca `abt_variabel` setiap cetak); tidak ada perubahan berkas di server.
Cadangan `cadangan/abt_variabel-sebelum.sql` memuat 7 baris lama TERMASUK teks bawaan lama 8133 (berisi NIK): hapus folder `/root/abt-x1-20261021/cadangan` bila sudah tidak dipakai. Pasang ulang tidak menimpa cadangan itu.

## Hasil uji (21 Okt 2026)

- **ABT laptop** (MariaDB 10.4, DB `aps_badilag_x1` = salinan PERSIS `abt_variabel` server, 2.377 baris, dibaca dari HEX; sidik jari seluruh baris dibandingkan): PRASYARAT `0|0|7|0|43|0` -> pasang (44 baris tambah, 7 ubah; 2.421 baris) -> PERIKSA `SEMUA COCOK` -> pasang ulang (`0|44|0|7|43|0`, tanpa perubahan, sidik jari sama) -> **pulih `PULIH COCOK` dan sidik jari seluruh tabel kembali SAMA dengan server (2.377 baris, termasuk kolom `modified`)** -> PRASYARAT `0|0|7|0|43|0` lagi -> pasang lagi `SEMUA COCOK`. Pulih juga diuji dengan isian `9023` yang sudah ada (FK CASCADE): isiannya disalin dulu ke `cadangan/abt_data_teks-isian-sebelum-pulih.*.sql`. `hitung-8133.sh` diuji dengan 4 isian tiruan (persis sama / diubah / NIK lain / sebagian): terhitung benar. Jalankan ulang: `bash sumber/uji_lokal.sh semua`.
- **Kueri baru atas perkara nyata**: 37 kueri x 8 perkara (itsbat 239/Pdt.P/2026 dan 142/Pdt.P/2026, DK 231/Pdt.P/2026, 88/Pdt.P/2026 dan 217/Pdt.P/2026, perkara bermediasi 600/Pdt.G/2026, 602/Pdt.G/2026 dan 273/Pdt.G/2026 yang banyak pihak) dijalankan di `sipp_donggala` lokal DAN BACA SAJA di server (MariaDB 5.5): 0 galat, variabel yang berisi sama di kedua tempat. Itsbat: 10113 berisi hanya pada perkara yang kalimat posita-nya berpola. Tambahan: 10113 atas 2.245 perkara itsbat/poligami lokal terbaca 578 (tanpa karakter rusak); 8129 = 1077 pada 873/873 perkara.
- **Renderer php56 ABT asli** (`alat/rend.py`, `alat/render_uji.py`; salinan aplikasi ABT dengan `abt_variabel` = tampilan ke DB uji): 43 cetakan SEBELUM dan SESUDAH paket (`#7062#`, `#7107#`, `#7097#`, `#7098#`, `#7048#`, `#7047#`, `#7054#`, `#7055#`, kalimat `#8087#`/`#9023#`/`#10113#`, `#8013#`/`#0237#`/`#8129#`/`#5510#`, dan 5 blangko RTF asli dari server: Kewarisan (NO), Akta Perdamaian, Cerai Gugur Habis Biaya, DK Perempuan versi 2023, Penetapan IN 2P). 14 cetakan tidak berubah (perkara 1 pihak: 7062/7107/7047/7048/7098 persis sama); 29 berubah dan semuanya perbaikan: Pemohon IV tercetak lengkap (sebelumnya "NIK , tempat dan tanggal lahir , ..."), Tergugat III-V terisi, Turut Tergugat terisi (sebelumnya baris kosong), nama mediator, tanggal relaas dan nama anak tercetak, "..." pada cetakan yang berubah turun 82 -> 62, 0 token `#nnnn#` tersisa. Ringkasan: `hasil/render-ringkasan-sebelum.json`, `hasil/render-ringkasan-sesudah.json` (hasil cetak lengkap memuat data perkara dan TIDAK disimpan di repo).
- `7054` (pihak intervensi) belum pernah dicoba atas data sungguhan (0 perkara `perkara_pihak3`): diuji dengan 1 dan 2 baris tiruan di basis sementara (sebutan, angka Romawi, tanpa data = kosong), basis tiruan sudah dihapus.
- Portal/ekstensi: tidak ada perubahan; uji penuh tidak relevan (hanya paket SQL).

## Isian 8133 yang masih berdata lama (keputusan pengguna)

Teks bawaan lama memuat 5 deret 16 angka (NIK dan nomor KK orang nyata). Dihitung BACA SAJA di server (angka tidak dicetak): dari **49** isian 8133 tersimpan, **4 perkara** masih memuat teks itu:

| perkara_id | nomor | keadaan |
|---|---|---|
| 6893 | 158/Pdt.P/2022/PA.Dgl | persis sama dengan teks bawaan lama - ini SUMBER teks (diputus 1 Des 2022 = tanggal `modified` 8133), datanya sah milik perkara itu |
| 7626 | 3/Pdt.P/2024/PA.Dgl | persis sama (salinan tak diubah dari perkara lain) |
| 9033 | 155/Pdt.P/2025/PA.Dgl | persis sama (salinan tak diubah dari perkara lain) |
| 8710 | 37/Pdt.P/2025/PA.Dgl | sebagian: sudah diedit, memuat 2 dari 5 deret |

Paket TIDAK mengubah apa pun pada isian ini; sesudah dipasang, `hitung-8133.sh` mengulang hitungan itu dari server (`bash /root/abt-x1-20261021/hitung-8133.sh`). Usulan: periksa 7626, 9033, 8710 (perkara sudah diputus; BAS yang sudah dicetak/ditandatangani tidak berubah, tetapi cetak ulang akan memuat data perkara lain) dan kosongkan/ganti isian itu bila memang salinan.

## Yang TIDAK diperbaiki (dan alasannya)

1. **Duplikasi pada 58 blangko lama yang merujuk `#9023#`** ("dinikahkan oleh #8087#, bernama #9023#"): di server 603 dari 712 isian `8087` sudah berbunyi "Imam ... bernama <nama>" (bawaan `#10109#`). Bila `9023` ikut terisi, cetakan lama menjadi "Imam Dusun A bernama X, bernama X," (diuji di renderer). Tanpa isian `9023` tetap "bernama ..." seperti sekarang. Blangko Derry tidak memakai `#9023#`, jadi tidak terdampak. Pilihan: biarkan; atau sunting 58 RTF (bukan blangko Derry) membuang ", bernama #9023#"; atau kosongkan `9023` bila `8087` sudah memuat "bernama". `9023` adalah isian popup: ia terisi bila petugas menyimpan popup (nilai bawaan `#10113#`); pengisian otomatis oleh ekstensi tidak ditambahkan (di luar paket ABT).
2. **Pemohon/Penggugat V ke atas (7047/7097) dan Tergugat VI ke atas (7048/7098) tetap tidak tercetak**: kueri sengaja berhenti di 4 Pemohon dan 5 Tergugat (ada komentar "lanjutkan pola" di 7047). Di server 18 perkara punya >=5 Pemohon (sampai 32 orang) dan 12 perkara >=6 Tergugat; perlu rancangan generik (daftar sampai N orang seperti `8710`), bukan menambah ratusan variabel. `3131` hanya menambah nama V yang dirujuk `7097` (7047 sendiri tidak mencetak V).
3. **Perkara yang dipulihkan paket ini** (sebelumnya cetak kosong): 24 perkara dengan tepat 4 Pemohon, 45 perkara dengan 2-5 Tergugat/Termohon (NIK, tempat/tanggal lahir dan agama Tergugat II tercetak kosong pada SEMUA perkara dengan >=2 Tergugat/Termohon), 10 perkara ber-Turut Tergugat. Pada perkara uji 602/Pdt.G/2026 baris Tergugat I dan II tetap kosong karena `perkara_pihak2.urutan` 1 dan 2 memang tidak ada pada data (bukan galat variabel).
4. **"DK Perempuan versi 2023.rtf"** (`putusan_penetapan/Putusan Penetapan Standar 2024`, bukan Derry): selain `#5510#`, badan RTF-nya memuat nama calon suami yang diketik langsung ("calon suami bernama ..."). Itu bukan variabel; tidak bisa diperbaiki dari `abt_variabel`. Perlu sunting RTF atau tidak dipakai.
5. **Isian tersimpan 8133 pada 3 perkara** (tabel di atas): menunggu keputusan; nomor `3141`-`3181` (nama Pemohon VI-X) yang dirujuk templat "test saja/Penetapan Ahli Waris Kabul" tidak dibuat (di luar rujukan temuan).
6. Sisa audit (SEDANG/RINGAN) tidak dikerjakan di paket ini.
