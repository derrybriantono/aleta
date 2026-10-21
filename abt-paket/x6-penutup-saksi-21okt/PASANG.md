# Paket ABT `abt-x6-penutup-saksi-21okt` - kalimat penutup keterangan saksi tidak pernah tercetak (21 Okt 2026)

**Status: teruji di ABT LAPTOP (PRASYARAT, pasang, PERIKSA, pasang ulang, pulih, pasang lagi; md5 definisi fungsi sesudah pulih = md5 server), dan pola SQL dibandingkan dengan pola bot di server MariaDB 5.5.68 secara BACA SAJA. Server: BELUM dipasang - dipasang sesi utama.**

Hanya **fungsi tersimpan** di basis ABT (`aps_badilag`) yang disentuh: dua fungsi baru (`isian_rtf_penutup`, `isian_rtf_saring_penutup`) dan satu diganti (`isian_rtf_ket_saksi`, nama dan tanda tangan sama). **Tidak ada** baris `abt_variabel`, blangko (RTF), menu, isian tersimpan per perkara, `abt_keterangan_saksi`, atau SIPP yang diubah. Tidak ada variabel baru. Nama fungsi netral (`isian_rtf_*`, tanpa kata nama aplikasi); polanya sama dengan paket `abt-netral-db-derry` (FUNGSI.sql + PRASYARAT + PERIKSA + cadangan + pulih deterministik).

## Sebab pasti "Bahwa sudah cukup;" lolos

Variabel ABT 9259-9265 ("KETERANGAN SAKSI N #0046#/#0047# TANPA BARIS KOSONG (OTOMATIS: sama dengan tanya jawab keterangan saksi ABT)") - yang dipakai blangko putusan Derry - memanggil fungsi SQL `isian_rtf_ket_saksi`. Fungsi itu (paket I3) membaca SEMUA jawaban `abt_keterangan_saksi` dan mencetaknya `-   Bahwa <jawaban>` **tanpa penyaring**. Penyaring penutup hanya ada di JS (bot `penutupSaksi.js`, ekstensi `abt.js`), dan di jalur ekstensi pun ada tiga celah:

| # | Jalur | Celah | Perbaikan |
|---|---|---|---|
| 1 | Blangko Derry langsung (variabel SQL 9259-9265) | fungsi SQL tanpa penyaring: **4.179 dari 4.789 kelompok saksi** (87%) di server mencetak butir penutup (HITUNG, baca saja) | penyaring SQL = terjemahan mekanis pola bot (paket ini) |
| 2 | Panel Blangko Derry, cetak putusan (`bersihkanPenutupSaksiRtf`) | RTF dipecah per `\par` dan paragraf yang kurungnya tidak seimbang dilewati; butir keterangan satu variabel ada di SATU grup `{...}`, jadi butir PERTAMA dan TERAKHIR (tempat "Bahwa sudah cukup;" hampir selalu berada) selalu lolos | pembersih berbasis token: buang teks penutup + penanda butir + satu `\par` pemisah; kurung dan format paragraf tidak terpotong (diuji atas keluaran php56 ABT asli) |
| 3 | Tulis ke ABT: Susun saksi, editor tanya jawab Blangko Derry | templat ABT membawa jawaban bawaan "Sudah cukup;" di setiap kumpulan (04, A1, DK1, ...) dan semua baris ikut tersimpan | `saringBarisPenutup` di `kirimTanyaJawab` (abt.js) dan `simpanTanyaJawab` (abt-klien.js): baris yang jawabannya hanya penutup tidak ditulis |
| 4 | Rapikan / Input ke ABT | hanya variabel 2021/2022 (saksi 1-2 Penggugat) | semua "Keterangan Saksi N" (P: 2021 2022 2031 8920 8932; T: 2023 2024 2032 8942) |
| 5 | Blangko non-Derry / BAS (variabel `tanya_jawab` bawaan ABT, dicetak PHP `list_keterangan` / `kolom_kode_A4`) | PHP ABT tidak dapat disaring dari SQL | data baru bersih lewat #3/#4; cetak BAS lewat panel: pasangan baris tabel yang jawabannya hanya penutup dibuang (`bersihkanPenutupTabelRtf`) |

Ditemukan juga satu **kekeliruan pemotongan** pada pembersih ekstensi lama: jawaban yang baris terbelahnya jatuh di tengah kalimat (`...nafkah ... tidak` + baris baru + `cukup;`) kehilangan `cukup;` karena baris itu dikira penutup. Kini baris penutup hanya dibuang bila baris sebelumnya sudah berakhir `; . ! ? :` dan baris itu sendiri berakhir begitu atau baris terakhir (SQL dan JS sama).

## Isi `paket-satker/`

| berkas | isi |
|---|---|
| `abt-x6-penutup-saksi-21okt-FUNGSI.sql` | tiga fungsi (dibangun dari `sumber/templat-fungsi.sql` + pola bot) |
| `...-PRASYARAT.sql` | satu baris `A\|B\|C\|D\|E\|F` (di bawah) |
| `...-PERIKSA.sql` | 13 butir: fungsi ada; `isian_rtf_penutup` = fungsi bot atas **353 contoh** (137 penutup, 216 bukan; dihitung oleh `penutupSaksi.js`, termasuk tabel uji F1.3/17 Okt, "tidak sanggup lagi" dengan/tanpa pertanyaan, 157 jawaban nyata pendek); `saring` (ujung jawaban, terbelah baris, pecahan di tengah kalimat); data nyata: tak satu pun kelompok saksi mencetak butir penutup dan jumlah butir keluaran = jumlah jawaban bukan-penutup. Baris terakhir `SEMUA COCOK` |
| `...-HITUNG.sql` | baca saja: berapa kelompok saksi yang keluarannya memuat butir penutup (detektor kasar berdiri sendiri) |
| `fungsi-lama.sql` | `isian_rtf_ket_saksi` lama persis seperti terpasang di server (SHOW CREATE FUNCTION); md5 definisi `f984ebccf51a11d4f3779cc9092fd491` |
| `pasang-satker.sh`, `pulih-satker.sh`, `MD5SUMS.txt` | pasang/pulih |

Dibangun ulang dengan `node sumber/bangun_paket.js` (butuh `aleta_bot/services/penutupSaksi.js`; uji `penutup-saksi-x6-21okt.test.ts` menjaga FUNGSI.sql tidak basi dan pola SQL = terjemahan mekanis pola bot).

## PRASYARAT yang diharapkan (server, baca saja, 21 Okt 2026)

`1|0|1|0|7|20` = A fungsi `isian_rtf_ket_saksi` (1) \| B fungsi baru (0) \| C `isian_rtf_ket_saksi` masih persis versi lama - md5 definisi (1) \| D sudah memanggil penyaring (0) \| E variabel pemanggil, info (7: 9259-9265) \| F fungsi `isian_rtf_*`, info (20).
Pasang ulang: `1|2|0|1|7|22`. Pasang hanya bila A\|B\|C\|D = `1|0|1|0`; selain itu berhenti, tidak ada yang diubah.
**SUDAH dijalankan baca saja di server: `1|0|1|0|7|20`** (md5 definisi lama = `f984ebcc...`).

## Pasang (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/w30/abt-paket/x6-penutup-saksi-21okt     # atau folder repo hasil gabung
ssh aleta 'mkdir -p /root/abt-x6-20261021'
scp -r paket-satker/* aleta:/root/abt-x6-20261021/
ssh aleta 'cd /root/abt-x6-20261021 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-x6-20261021/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT (1|0|1|0|7|20)`, `MODE BARU`, `CADANGAN: ...`, `SEBELUM: ~4179 kelompok saksi mencetak butir kalimat penutup`, `PERIKSA: 13 butir cocok - SEMUA COCOK`, `SESUDAH: 0 ...`, `FUNGSI isian_rtf_*: 22`, `SELESAI`.
Pulih: `ssh aleta 'bash /root/abt-x6-20261021/pulih-satker.sh'` (baris terakhir `PULIH COCOK`). Gagal sesudah FUNGSI = pulih otomatis (juga bila fungsi hilang karena terputus). Tidak perlu memulai ulang apa pun (ABT membaca fungsi setiap cetak). Urutan dengan paket lain: bebas (tidak ada nomor variabel; x1-x5 tak tersentuh). Paket yang membangun ulang `isian_rtf_ket_saksi` dari berkas I3/netral lama akan menimpa paket ini: PRASYARAT x6 akan menolak bila isinya bukan versi I3 lama - pasang x6 lagi sesudahnya.

## Hasil uji (21 Okt 2026) - rincian di `hasil/ringkasan-uji.json`

- **Ukur atas data nyata server (baca saja)**: 69.427 jawaban di `abt_keterangan_saksi`. Pola penutup menangkap **4.334 dari 4.334** jawaban penutup (+124 jawaban kosong); **0 lolos** (pencarian longgar: jawaban pendek berkata cukup/sekian/demikian/terima kasih/tidak ada/sampai di sini/hanya itu/lagi, dan semua jawaban atas pertanyaan penutup yang tak tertangkap = 3, ketiganya keterangan perkara). 59 bentuk sengaja dibiarkan (mis. "Saya tidak sanggup lagi;" 463x = jawaban atas "masih sanggup mendamaikan?", "tidak ada komunikasi lagi", "tidak ada pekerjaan lain"). Pola TIDAK diperlebar karena tak ada yang lolos; yang diperbaiki hanya kekeliruan pemotongan baris terbelah (1 jawaban nyata). Jawaban yang hanya sebagian barisnya penutup: 0.
- **Kesetaraan pola**: 32.896 string (semua bentuk ternormalkan dari data + varian tata bahasa): terjemahan POSIX vs `POLA_PENUTUP_LENTUR` JS = 0 beda di MariaDB 10.4 laptop **dan** di server MariaDB 5.5.68 (baca saja). Subpola lain (tidak ada...ketahui, kesanggupan, kata kerja, pertanyaan) 20 uji di server: 0 beda.
- **Fungsi baru vs lama atas SELURUH data** (lab laptop, 4.789 kelompok saksi): keluaran fungsi baru = keluaran fungsi lama atas tabel yang baris penutupnya dibuang: **4.789 sama, 0 beda** - jadi hanya butir penutup yang hilang, tak ada butir lain yang berubah.
- **Siklus ABT laptop** (`sumber/uji_lokal.sh`, basis sampel 250 perkara/7.792 jawaban, fungsi lain persis server): fungsi lama dipasang dari `fungsi-lama.sql` -> md5 definisi `f984ebcc...` = server; PRASYARAT `1|0|1|0|7|20` -> pasang (`SEBELUM: 465` kelompok mencetak penutup -> `SESUDAH: 0`, PERIKSA 13 butir cocok) -> pasang ulang (`1|2|0|1|7|22`, MODE ULANG, cocok) -> PULIH (`PULIH COCOK`, md5 kembali `f984ebcc...`, 20 fungsi) -> PRASYARAT `1|0|1|0|7|20` -> pasang lagi (cocok). Satu percobaan awal PERIKSA gagal (hitungan butir salah menghitung `<br>` yang diketik dalam jawaban); skrip memulihkan sendiri, lalu dihitung dengan `-   Bahwa `.
- **Renderer php56 ABT asli** (`alat/render_x6.py`, blangko server `[01] [Kabul Verstek] Cerai (Format Lengkap)` CG dan `BAS ALUR 02 [2] ... (2 Saksi)`; baris saksi SINTETIS pada perkara uji laptop; basis `aps_badilag_x6r`, tanpa menyentuh `aps_badilag` laptop): putusan sebelum = 2 butir penutup tercetak ("Bahwa sudah cukup;", "Bahwa tidak ada, sudah cukup."); sesudah fungsi baru = 0, butir lain utuh termasuk "saksi tidak sanggup lagi" (jawaban atas pertanyaan mendamaikan) dan jawaban terbelah baris yang memuat kata "cukup". BAS: pembersih ekstensi membuang 2 pasangan baris tabel (baris `\row` 18 -> 14), pertanyaan/jawaban perkara utuh, kurung seimbang. Pembersih RTF putusan atas keluaran lama: 4 butir dibuang (2 terlihat + 2 salinan di tujuan tersembunyi `isianasal`), kurung seimbang, tanpa paragraf kosong baru.

## Isian/arsip tersimpan yang masih memuat penutup (TIDAK diubah - putusan pengguna)

`abt_keterangan_saksi` server: **4.334 baris di 2.057 perkara** masih menyimpan jawaban penutup. **Perkara berjalan (belum putus): 25 perkara / 48 baris**; putus 30 hari terakhir: 65 perkara / 139 baris (bisa dicetak ulang). Sesudah paket ini cetakan variabel SQL (blangko Derry) bersih untuk SEMUA perkara tanpa mengubah data. Yang masih menampilkan penutup dari data tersimpan hanya blangko non-Derry/BAS bawaan ABT (variabel `tanya_jawab`) bila dicetak langsung dari ABT tanpa panel; pembersihannya lewat Rapikan / Input ke ABT per perkara (kini mencakup semua saksi) bila pengguna memutuskan.

## Yang TIDAK diubah (dan alasannya)

1. Pola penutup bot/ekstensi (`penutupSaksi.js`, `abt.js`): tidak ada bentuk yang lolos di 69.427 jawaban; diperlebar tanpa bukti berisiko memakan keterangan perkara.
2. "Tidak sanggup lagi" tanpa kata kerja menjawab: keputusan 17 Okt - penutup hanya bila pertanyaannya pertanyaan penutup. Fungsi SQL kini memakai kolom `pertanyaan`; pembersih RTF panel tidak punya pertanyaan, jadi bentuk itu dibiarkan di sana (dibuang di sumbernya oleh SQL).
3. Variabel 9259-9265 dan blangko: tidak disentuh (fungsi diganti di tempat). Variabel `tanya_jawab` bawaan (2021 dst.): PHP ABT, tidak dapat disaring dari SQL tanpa mengubah tipe variabelnya (merusak editor tanya jawab ABT).
