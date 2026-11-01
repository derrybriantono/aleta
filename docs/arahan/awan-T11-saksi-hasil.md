# Hasil awan T11 - kekurangan keterangan saksi

Cabang: `awan-t11-saksi` (dari `origin/saksi-pilih`). Tidak digabung, tidak dirilis, versi tidak dinaikkan, `ekstensi-berkas.ts` tidak disentuh.
Model: Sonnet 5.5 high. Uji sasaran saja. Perkiraan biaya: jauh di bawah batas 45 dolar (sesi pendek, tanpa subagen, tanpa uji penuh).

## 1. Itsbat nikah - butir dari posita permohonan

Perluasan pengisi fakta yang ada, bukan pembaca kedua. Modul baru `aleta_bot/services/isiJawabanSaksiPositaNikah.js` dipanggil dari `itsbat()` di `isiJawabanSaksiPosita.js` (blok mahar dan umur lama diganti pemanggilan ini). Aturan murni, satu lintasan regex per butir, tanpa AI.

Yang terbaca: umur dan status mempelai saat menikah (jejaka/perjaka, perawan/gadis, duda/janda, termasuk cerai hidup/mati), wali nikah (nama dan hubungannya), dua saksi nikah, mahar (bunyi posita utuh), serta tanggal dan tempat akad.
Ejaan dan bentuk yang ditangani: umur/usia/berumur/berusia, mas kawin/maskawin/mahar, angka huruf (dua puluh lima, tujuh belas), "2 (dua) orang saksi", satu atau dua pemohon, itsbat kontensius (Pemohon/Termohon), pihak yang urutannya dibalik, status dan umur berpasangan ("berumur masing-masing 24 dan 18 tahun"), nama huruf besar semua, gelar dan "bin" (disalin apa adanya).
Yang ragu tidak diisi: dua nilai berbeda untuk kunci yang sama dibuang; rujukan pihak pada hubungan wali ("ayah kandung Pemohon II") tidak dibaca sebagai subjek; nama bukan huruf kapital, satu nama saksi saja, umur di bawah 10, dan tanggal lahir/umur anak diabaikan.
Perbaikan ikutan di `isiJawabanSaksiFakta.uraiMahar`: "uang tunai Rp. 1.000.000,-" dahulu terpotong menjadi "uang" (nominal hilang); kini nominal tetap dan cara bayar tunai.

Uji: `saksi-t11-1nov.test.ts` - 14 posita rekaan berbagai bentuk + 10 uji tidak-salah-tangkap + kinerja (300 kali dalam < 3 detik).

## 2. Cerai A/D - pengetahuan "tahu berselisih, tidak tahu sebab" (modus `tidak-tahu`)

`saksiPerbaikan1Nov.js`: fungsi baru `jawabTidakTahuSebab`. Pada modus `tidak-tahu`, butir yang bergantung pada sebab (huruf A: kebiasaan buruk, sejak kapan, cara mengetahui, dinasihati, masih melakukan, akibat; huruf D: kekerasan, kapan/berapa kali, melihat sendiri/bekas luka, akibat, dilaporkan; dan butir penyebab) kini berbunyi "tidak mengetahui penyebabnya" (3 bunyi untuk saksi 1, 3 bunyi berbeda untuk saksi 2). Hanya jawaban yang masih titik-titik atau berasal dari gugatan yang diganti. Tanda: sumber "pilihan pengetahuan saksi" (bukan tanda gugatan), sama dengan jalur arah Tolak/NO (keputusan 63). Butir tak bergantung sebab (kenal, anak, hubungan, tempat tinggal bersama, upaya rukun, dst.) tidak berubah; modus lain tidak berubah (diuji: `perbaikan1Nov.sebab` = 0 pada 7 modus lain).

Angka matriks (CG/CT x huruf F/A/D x verstek/kontradiktoir x posita ada/tidak, 24 susunan, saksi 1 dan 2 modus tidak-tahu):

| | sebelum | sesudah |
| :--- | :--- | :--- |
| butir bergantung sebab bertitik-titik | 176 dari 224 | 0 dari 224 |
| susunan dengan titik-titik pada butir itu | 16 dari 24 | 0 dari 24 |

(Matriks agen F asli, 576 dari 5.229, tidak ada di repo; angka di atas dari matriks mini sepola dengan `saksi-perbaikan-1nov`.)

## 3. Saksi Tergugat tanpa jawaban/duplik e-Court

Urutan sumber: (a) e-Court / isian 12020 dan 12024, (b) jawaban dan duplik LISAN di BAS = tanya-jawab ABT 6112 dan 6114 (pembaca BAS yang sudah dipakai ekstensi: `bacaTanyaJawab`), (c) tidak ada: titik-titik + catatan.
- `ekstensi-sipp/blangko-derry-saksi-arah.js`: `naskahTDenganLisan` (murni; e-Court tidak pernah ditimpa; teks lisan disalin apa adanya).
- `ekstensi-sipp/blangko-derry-isian.js`: `bacaNaskahT` memakai `bacaLisanT` hanya bila e-Court kosong (hasil diingat per perkara; tidak ada kerja berat saat mengetik).
- `ekstensi-sipp/blangko-derry-saksi.js` dan `aleta_bot/routes/internalGatewayRoutes.js`: penanda `asal` ("lisan") ikut ke bot.
- `saksiPerbaikan1Nov.js`: bantahan dibaca dari naskah lisan (ambang 20 huruf), sumber "jawaban lisan Tergugat (BAS)"; bila tidak ada sama sekali: butir tetap titik-titik, `hasil.jawabanTBelumAda = true`, dan catatan "Jawaban Tergugat belum ada ... isi dari keterangan saksi atau pilih 'Ikut membenarkan gugatan Penggugat'".
Uji: tiga keadaan (e-Court ada, hanya lisan, tidak ada) + lisan sebagian + pilihan "ikut gugatan" + muatan ke bot.

## Berkas

Baru: `aleta_bot/services/isiJawabanSaksiPositaNikah.js`, `manajemen_surat/src/test/saksi-t11-1nov.test.ts`, laporan ini.
Diubah: `aleta_bot/services/{isiJawabanSaksiPosita,isiJawabanSaksiFakta,saksiPerbaikan1Nov}.js`, `aleta_bot/routes/internalGatewayRoutes.js`, `ekstensi-sipp/{blangko-derry-isian,blangko-derry-saksi-arah,blangko-derry-saksi}.js`, `manajemen_surat/src/test/saksi-perbaikan-1nov.test.ts` (teks catatan).

## Uji yang dijalankan (sasaran)

`saksi-t11-1nov` (37), `saksi-perbaikan-1nov`, `saksi-pilih-1nov`, `saksi-katalog-1nov`, `isi-jawaban-saksi-20okt`, `isi-jawaban-saksi-lanjut-20okt`, `saksi-fakta-posita-butir24`, `keterangan-saksi-otomatis-22okt`, `saksi-tergugat`, `saksi-susun-ekstensi`, `saksi-semua-jenis-t2-25okt`: hijau. `tsc --noEmit`: lihat pesan akhir.

## Belum terverifikasi / catatan untuk laptop

- Ukur atas perkara sungguhan (posita itsbat asli, jawaban lisan asli di ABT 6112/6114) hanya bisa di laptop; bentuk tanya-jawab lisan (kolom `jawab` terisi) diasumsikan seperti penyunting ABT lain.
- Tanam ekstensi (`ekstensi-berkas.ts`) belum dilakukan (tugas laptop); uji sinkron berkas ekstensi, bila ada, akan meminta tanam ulang. Jalankan `ALETA_TANAM_PAKSA=1 node scripts/susun-ekstensi.mjs`.
- Pembaca lama `dariPositaItsbat` (abtUsulanService) masih salah pada beberapa bentuk (mis. nama penghulu terbaca sebagai saksi bila saksi ditulis "saksinya X dan Y", dan nama berujung titik tanpa pemisah baris). Akibatnya pada kasus itu fakta menjadi "ragu" (tetap titik-titik, tidak salah isi); perbaikannya di pembaca itu tidak dikerjakan agar tidak membuat pembaca kedua.
- Modus arah `tidak-tahu-apa` (Tolak/NO) pada huruf A/D masih menyisakan titik-titik; tidak diubah karena arahan hanya menyebut "tahu berselisih, tidak tahu sebab".
