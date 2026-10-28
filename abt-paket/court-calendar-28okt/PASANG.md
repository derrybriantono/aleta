# Paket ABT `abt-court-calendar-28okt` - blangko Court Calendar di Blangko Derry (28 Okt 2026)

**Status: teruji di ABT LAPTOP (MariaDB 10.4, basis milik sendiri `aps_badilag_cc`): PRASYARAT, pasang, PERIKSA, pasang ulang idempoten, pulih = keadaan awal persis, pasang lagi, dua penjaga. Dirender dengan renderer php56 ABT asli atas perkara cerai nyata dan dibandingkan dengan bagian court calendar di BAS 2/3 asli. Server: BELUM dipasang - dipasang sesi utama (mesin 5.5 server belum diuji; SQL paket hanya `SELECT` dan satu `INSERT`).**

Hanya pengguna **derry_briantono**. Tidak ada variabel, fungsi, berkas, atau menu lama yang diubah; blangko BAS asli tidak disentuh. Tanpa kata nama aplikasi di blangko, SQL, maupun menu.

Permintaan hakim/Super Admin 28 Okt 2026: "blangko court calendar di blangko abt by derry briantono" - bagian court calendar semula hanya ada di dalam BAS 2 (penetapan jadwal sesudah mediasi gagal) dan BAS 3 (perubahan jadwal karena gugatan rekonvensi) pada `ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)` dan `- BAS CONTRA PERCERAIAN -` (PERMA 7 Tahun 2022, Keputusan Dirjen Badilag 1465).

## Isi (`paket-satker/`)

| berkas | isi |
|---|---|
| `rtf/derry_briantono/98c Court Calendar - BAS/` | 2 blangko BARU (folder baru): **Court Calendar - Penetapan Jadwal Persidangan.rtf** (kop PENETAPAN + Nomor + "Tentang Jadwal Persidangan (Court Calendar)", identitas perkara, pertimbangan PERMA 7/2022 + KMA 363/2022, tabel Jawaban / Replik / Duplik / Pembuktian kedua pihak / Kesimpulan / Pengucapan, dua perintah unggah dan patuhi jadwal, Ditetapkan di / Pada tanggal, tanda tangan Panitera Pengganti dan Ketua Majelis) dan **Court Calendar - Perubahan Jadwal Persidangan (Gugatan Rekonvensi).rtf** (alasan perubahan, tabel Replik konvensi + Jawaban rekonvensi / Duplik konvensi + Replik rekonvensi / Duplik rekonvensi / Pembuktian / Kesimpulan / Pengucapan, perintah unggah perubahan, tanda tangan). Paragraf, tabel, dan variabel dikutip UTUH dari BAS 2 dan BAS 3 (gaya Derry sama); yang baru hanya judul, "Dalam perkara ... antara", dan penutup |
| `abt-court-calendar-28okt-PRASYARAT.sql` | baca saja: `A\|B\|C` |
| `...-PASANG.sql` | satu `INSERT` `abt_menu` (id = MAX+1, `WHERE NOT EXISTS`), satu transaksi |
| `...-PERIKSA.sql` | md5 semua kolom baris menu; baris akhir `SEMUA COCOK` |
| `...-PULIH.sql` | menghapus baris menu HANYA bila isinya masih persis paket |
| `berkas_rtf.py`, `pasang-satker.sh`, `pulih-satker.sh`, `daftar-rtf.tsv`, `folder-ada.txt`, `folder-baru.txt`, `nomor-variabel.txt`, `MD5SUMS.txt` | urutan: md5 -> prasyarat -> cadangan -> pasang SQL -> periksa -> folder baru -> berkas -> periksa berkas; gagal = pulih otomatis |

Cadangan ke `cadangan/` di folder paket (baris menu lama folder ini; kosong pada pasang pertama). `sumber/` (bangun_rtf.py, bangun_paket.py, uji_lokal.sh, berkas_rtf.py) dan `alat/` (render_banding.py) TIDAK dikirim ke server.

## Menu (hak) - satu baris `abt_menu`

`BAS Court Calendar (Jadwal Persidangan)` (alias `BAS Court Calendar`), folder `98c Court Calendar - BAS`, induk `derry_briantono`. Hak DISALIN dari menu ALUR 04 (id 963) - tempat BAS 2 dan BAS 3: `proses_id` 80-297, `perkara_id` 15-15 (`alur_perkara_id`, Pdt.G), `user_cek` 3, grup `1|30|500|430|1000|1010|1020`, top `1|30`, validator `10|20`. Nama berawalan "BAS" dan folder berakhiran "- BAS": ekstensi dan portal mengenalnya sebagai folder BAS (Panitera Sidang). Sengaja TIDAK memakai kata "Alur 04" di nama menu/folder agar pencocokan folder ALUR oleh BAS massal tidak tertukar.

## PRASYARAT yang diharapkan

`A|B|C` = A variabel yang dirujuk kedua blangko ADA di `abt_variabel` (37, semuanya sudah dipakai BAS 2/3) | B baris menu folder baru (0; 1 bila sudah terpasang) | C menu id 963 ada dengan hak persis seperti di atas (1).

- Pasang pertama: **`37|0|1`**. Pasang ulang: **`37|1|1`**. Selain itu paket berhenti dan TIDAK ada yang diubah (mis. `37|0|0` = hak menu ALUR 04 di server sudah beda dari yang disalin; periksa lalu sesuaikan `HAK` di `sumber/bangun_paket.py` dan bangun ulang).

## Pasang (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/w115/abt-paket/court-calendar-28okt     # atau folder repo hasil gabung
rm -rf paket-satker/cadangan                                 # cadangan uji laptop (bila ada) tidak ikut terkirim
ssh aleta 'mkdir -p /root/abt-court-calendar-20261028'
scp -r paket-satker/* aleta:/root/abt-court-calendar-20261028/
ssh aleta 'cd /root/abt-court-calendar-20261028 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-court-calendar-20261028/pasang-satker.sh'
```

Keluaran benar: `PRASYARAT COCOK (37|0|1)`, `BERKAS SIAP`, `CADANGAN: ... (menu lama folder ini: 0)`, `SEMUA COCOK`, `FOLDER BARU derry_briantono/98c Court Calendar - BAS`, `BUAT=2`, `COCOK=2`, `BERKAS COCOK`, `SELESAI`. Pasang ulang: `PRASYARAT COCOK (37|1|1)`, `SUDAH_BARU=2`, `SEMUA COCOK`, `FOLDER SUDAH ADA`, `SUDAH=2`, `COCOK=2`, `SELESAI`.

Pulih: `ssh aleta 'bash /root/abt-court-calendar-20261028/pulih-satker.sh'` (keluaran: `HAPUS=2`, `BERKAS PULIH`, `FOLDER DIHAPUS ...`, `PULIH SQL SELESAI`, baris akhir `PULIH COCOK`). Berkas yang sudah disunting orang sesudah dipasang dibiarkan dan dilaporkan.

Laptop (diuji): `bash sumber/uji_lokal.sh semua` (basis `aps_badilag_cc`, folder blangko uji `D:/Aplikasi/aleta/tmp/cc/blangko`, paket disalin ke jalur pendek).

## Hasil uji (28 Okt 2026)

- Laptop `aps_badilag_cc` (dump keadaan server sesudah paket 27 Okt: 2.677 variabel; `abt_menu` 69 baris disalin dari ABT lokal): PRASYARAT `37|0|1`; pasang -> `SEMUA COCOK`, `BUAT=2`, `COCOK=2`; pasang ulang `37|1|1` tanpa perubahan apa pun (menu, variabel, pohon blangko); pulih -> `PULIH COCOK` dan keadaan awal PERSIS (jumlah dan md5 menu, jumlah variabel, pohon folder); pasang lagi = sama dengan pasang pertama; pulih lagi. Penjaga: menu 963 berhak lain -> `GAGAL: prasyarat '37|0|0'`, tidak ada yang berubah; folder baru sudah ada sebelum paket -> `GAGAL`, tidak ada yang berubah.
- Render php56 ABT asli (alat/render_banding.py): lihat bagian "Perbandingan render" di bawah.
- Menu id baru = MAX+1 saat pasang (di ABT lokal 995).

## Perbandingan render (renderer php56 ABT asli, `alat/render_banding.py`, hasil ringkas di `hasil/render-ringkasan.json`)
Perkara cerai gugat nyata `sipp_donggala` (baca saja): 10105 (jadwal Jawaban/Replik/Duplik terisi) dan 10080 (Jawaban, Replik, Duplik terisi; pembuktian dan kesimpulan belum dijadwalkan di SIPP, jadi kosong - sama seperti di BAS). Tiap perkara dirender 4 kali: blangko baru 1 dan 2, BAS 2 dan BAS 3 asli ALUR 04.
- Blangko 1 vs bagian court calendar BAS 2 (dari "PENETAPAN" sampai sebelum "Kemudian ... sidang ditunda", 37 baris isi): SEMUA 37 baris BAS ada, urutan sama, di kedua perkara. Baris tambahan blangko 1 hanya yang disengaja: judul "PENETAPAN" + "TENTANG JADWAL PERSIDANGAN (COURT CALENDAR)", "Dalam perkara <jenis> antara:", tiga baris identitas pihak, dan blok tanda tangan Panitera (nama) - 12 baris termasuk 3 baris sisa gaya RTF.
- Blangko 2 vs bagian court calendar BAS 3 (dari "Selanjutnya ... gugatan rekonvensi" sampai "Kemudian ... mengunggah perubahan court calendar", 24 baris): SEMUA 24 baris ada (selain catatan petugas "(APABILA ADA REKONVENSI)" dan titik koma akhir yang sengaja dibuang), di kedua perkara.
- Pengecualian terukur: perkara 9987 (cerai gugat berrekonvensi) melewati batas 300 detik per render dan 10062 gagal tanpa keluaran (variabel majelis/pihak berat di laptop); keduanya tidak dibandingkan.

## Belum / batas (jujur)
- Server (MariaDB 5.5, data menu sebenarnya) BELUM dicoba; baris menu 963 server tidak dapat dibaca dari rumah. Bila PRASYARAT C = 0, hak menu ALUR 04 di server berbeda dari ABT lokal.
- Saran blangko per agenda di Blangko Derry ekstensi (mis. agenda "laporan hasil mediasi" -> Court Calendar) TIDAK ditambahkan: menu baru muncul sendiri di daftar karena dibaca dari ABT, tetapi saran otomatisnya perlu perubahan ekstensi (butuh rilis/tanam).
- Isian jadwal (`#7111#`, `#7112#`, ... dari tabel court calendar SIPP) kosong bila hakim belum menyepakati jadwal di SIPP - sama seperti di BAS 2/3.
