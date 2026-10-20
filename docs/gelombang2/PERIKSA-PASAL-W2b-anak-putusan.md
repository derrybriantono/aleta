# Daftar periksa rujukan hukum - W2b keluarga anak, bagian putusan (21 Okt 2026)

Cakupan: variabel ABT 4880-4909 dan blangko Derry 6a Hak Asuh, 6b Penguasaan Anak, 6c Nafkah Anak (ditambal dan baru) dalam `abt-paket/w2b-keluarga-lain`.
Aturan: tidak ada nomor pasal atau putusan yang dikarang. Rujukan yang SUDAH tercetak di blangko/variabel Derry sebelum paket ini hanya dipakai ulang (kolom "Asal"); hanya rujukan yang
benar-benar baru, atau dipakai di tempat baru, diberi status. Status "terverifikasi" memerlukan pencocokan dengan naskah resmi; tidak ada rujukan di bawah yang dicocokkan dengan
naskah resmi dalam sesi ini, sehingga semuanya ditulis "perlu-verifikasi" kecuali dinyatakan lain. Tercetak = muncul di putusan yang diunggah; panel = hanya di layar/isian.

| # | Rujukan | Isi singkat (sebagaimana tercetak) | Tempat | Asal | Status | Tercetak? |
|---|---|---|---|---|---|---|
| 1 | Pasal 41 huruf b UU 1/1974 tentang Perkawinan (kalimat kedua) | bila bapak dalam kenyataan tidak dapat memenuhi kewajiban biaya pemeliharaan dan pendidikan anak, Pengadilan dapat menentukan ibu ikut memikul biaya tersebut | variabel 4903 (pertimbangan Kabul Sebagian nafkah anak) | BARU; kalimat pertamanya sudah dikutip blangko 6c | perlu-verifikasi (dikutip dari pengetahuan hukum; cocokkan dengan naskah UU 1/1974 jo. UU 16/2019) | ya, hanya bila isian 4902 diisi |
| 2 | Pasal 156 huruf d KHI | biaya hadhanah dan nafkah anak menjadi tanggung jawab ayah menurut kemampuannya sampai anak dewasa/mandiri (21 tahun) | variabel 4903 dan 4909 | blangko 6c lama (pasal yang sama sudah tercetak) | dari blangko Derry; tidak dicocokkan ulang | ya |
| 3 | Pasal 105 KHI (huruf a dan b) dan Pasal 156 huruf a dan b KHI | anak belum mumayyiz hak ibu; anak mumayyiz memilih ayah atau ibu | variabel 4880; blangko BARU [01g] dan [03c] | blangko 6a/6b lama | dari blangko Derry; tidak dicocokkan ulang | ya |
| 4 | SEMA 2/2024, Rumusan Kamar Agama, Hukum Formil angka 4 | perkara hadanah dapat diajukan ke pengadilan agama yang wilayahnya meliputi tempat tinggal anak senyatanya | variabel 4898 (semua putusan 6a) | disalin dari paragraf kewenangan relatif blangko 6b yang sudah ada | perlu-verifikasi (naskah SEMA belum dicocokkan) | ya |
| 5 | SEMA 1/2025 angka 1 (Hukum Perkawinan Terkait Hadanah) | penghukuman pihak yang menguasai anak untuk menyerahkannya kepada pemegang hadanah | variabel 4892 (saklar 4890 = 1) | disalin dari variabel 9722 yang sudah terpasang | perlu-verifikasi | ya, hanya bila 4890 = 1 |
| 6 | Buku II Peradilan Agama Tahun 2026 | hakim dapat menetapkan hadhanah walau tidak diajukan tuntutan khusus, disertai penyerahan anak dan akses | variabel 4892 (saklar 4890 = 2) | disalin dari variabel 9722 | perlu-verifikasi (ringkasan Buku II di arsip/memori, bukan naskah) | ya, hanya bila 4890 = 2 |
| 7 | SEMA 1/2017, Rumusan Kamar Agama (akses bagi orang tua yang tidak memegang hak asuh) | kewajiban memberi akses dicantumkan di amar | variabel 4889 (rincian akses); blangko BARU [01g] | blangko 6a/6b lama | dari blangko Derry; tidak dicocokkan ulang | ya |
| 8 | Pasal 156 huruf c KHI | pemindahan hak hadhanah bila pemegang tidak dapat menjamin keselamatan jasmani dan rohani anak | blangko BARU [03c] (kerangka [03a]) | blangko 6a lama | dari blangko Derry; tidak dicocokkan ulang | ya |

Catatan:
- Kalimat baru pada variabel 4885, 4887, 4900, 4904, 4906, 4907 tidak memuat nomor pasal atau putusan; hanya menyusun kalimat dari isian majelis ("ketentuan peraturan perundang-undangan yang berlaku" tidak diperlukan).
- Rujukan nomor 4 sampai 6 berasal dari paket gelombang sebelumnya (blangko/variabel Derry) dan ikut terbawa ke tempat baru; bila naskah resmi ternyata berbeda, ubah di `variabel_anak.py`
  (4892, 4898) lalu bangun ulang paket.
- Tidak ada rujukan yang hanya tampil di panel; seluruh isian bersifat pilihan majelis dan kosong = tidak tercetak.
