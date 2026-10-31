# Hasil: sisa blangko merah + perluasan deteksi + rapikan paragraf kosong (31 Okt 2026)

Branch `awan-sisa-merah` (dari `gabung-56`). Tidak merge, tidak rilis, tidak naikkan versi, `abt-paket/` tidak disentuh, ekstensi belum ditanam ke `ekstensi-berkas.ts`.

## Berkas diubah
- `ekstensi-sipp/deteksi-sisa-blangko.js` - aturan baru, `rentangParagraf`, blok Jurusita, `merahkanRtf`, `rapikanBarisKosong`, catatan info di .txt.
- `manajemen_surat/src/lib/deteksi-sisa-blangko.ts` - salinan aturan (satu aturan, dua salinan; merah/rapikan hanya di JS ekstensi).
- `ekstensi-sipp/blangko-derry-isian.js` - `lakukanCetak`: rapikan -> periksa -> merahkan.
- `manajemen_surat/src/lib/draf-blangko-prompt.ts` - label jenis baru; tingkat RAGU tidak jadi penanda kekosongan bagi AI; blok Jurusita.
- Uji: `src/test/sisa-merah-31okt.test.ts` (baru), `deteksi-sisa-blangko-17okt.test.ts` (2 ubahan sah, lihat bawah).
- `docs/arahan/awan-sisa-merah-31okt.md` (bagian 4 Tambahan).

## Pola
PASTI (merah + .txt): isian setengah `20..`/`202…`, `Nomor ..../Pdt.G/....`, `Rp. ....`, `hari ..., tanggal ...`/`tanggal ... bulan ...`; `XX`/`XXX` huruf besar (angka Romawi sesudah Pasal/Bab/Bagian/abad dst. dikecualikan); kata berulang (`para Para`, `pada pada`, `yang yang`; nama kembar "Siti Siti" tidak); `{...}`, `#kode#` huruf, `(nama)`/`(alamat)`/`(umur)`/... ; `(pilih salah satu)`, `*) coret yang tidak perlu`; "butuh/perlu/harus/tinggal verifikasi", `verifikasi dulu`, `(verifikasi)`; kalimat petunjuk (`isi/isilah/isikan/diisi dengan|sesuai|nama...`, `sesuaikan dengan...`, `hapus bagian ini`); label+titik/garis (`Nama : ......`) dan label berturut (`Nama : Umur :`); `tanggal bulan tahun`, `Rp,00`, `Rp ,-`, `Nomor /Pdt.G/`, `/Pdt.G//`, `terbilang: )`; `tanggal ,`, `bin  `, `, ,`, `( )`. Aturan lama (kurung siku, #nnnn#, titik, garis, merah, perbaikan) tetap.
RAGU (hanya .txt "Periksa", tidak merah, tidak masuk penanda AI): `Penggugat/Tergugat`, `Pemohon/Termohon`, `laki-laki/perempuan`, `bin/binti` (dulu PASTI "kalimat"), `suami/istri`; `ketik/tulis/pilih sesuai|nama|...`, `contoh:`, `diisi`; label di ujung paragraf yang ada teks sebelumnya; spasi ganda antar kata; ` ,`; `,.`; `..`.
Tidak ditandai: `dan/atau`, `... Rekonvensi/Konvensi`, kutipan Pasal/ayat/undang-undang, kutipan bertanda kutip, teks Arab, "verifikasi" polos dalam kalimat, `xx`/`xxx` huruf kecil (topeng anonimisasi putusan), label sel tabel sendirian.
Blok Jurusita (paragraf yang diawali "Jurusita", + sampai 6 paragraf pendek berikutnya): titik/garis/isian kosong/RAGU tidak ditandai, tidak dimerahkan, baris kosongnya tidak dirapikan. Kurung siku/kode di blok itu tetap temuan.

## Perilaku cetak/unduh panel (`lakukanCetak`)
1. `rapikanBarisKosong`: SEMUA paragraf kosong dibuang (kata `\par`-nya + spasi/tab di dalamnya); format paragraf (`\pard`, `\fi`, `\li`, `\qj`, `\sl`, `\sb`, `\sa`, tab) tidak disentuh. Dikecualikan: kop (sebelum paragraf isi ke-5), sekitar baris TTD/Jurusita, ganti halaman, tabel, gambar. Judul bab huruf kapital di samping paragraf kosong yang dibuang dan tanpa `\sb/\sa` diberi `\sb240`. Jumlah masuk log dan `.txt` (baris "Info").
2. `tinjau` (dialog + .txt seperti sekarang).
3. `merahkanRtf`: warna merah ditambah di `\colortbl` (atau dipakai yang ada), potongan PASTI dibungkus `\cfN ... \cf<semula>`; dipakai untuk RTF unduhan, PDF biasa, PDF salinan. e-Doc SIPP dan salinan anonim tetap memakai naskah tanpa warna (pemeriksa unggah yang menahan teks merah tetap jalan).

## Uji (sasaran saja, tanpa uji penuh)
- `sisa-merah-31okt.test.ts`: 48 lulus. Isi: tiap pola kena + tidak salah tangkap, TS=JS atas korpus, RTF seimbang + `\cf` tepat di potongan, Jurusita -> 0 temuan dan RTF tidak berubah, 3 enter kosong -> 0, isian kosong -> hilang, blok TTD/Jurusita/kop/halaman/tabel/gambar tidak berubah, paragraf campuran (bertab, tanpa tab, `\fi`, inden gantung, judul tengah, rata kiri/kanan) byte-identik selain `\sb240` judul, `.txt` memuat Info.
- Uji lama yang menyentuh deteksi/panel: `deteksi-sisa-blangko-17okt`, `edoc-seret-30okt`, `alasan-belum-dipilih-30okt`, `bas-word-pdf-30okt`, `cetak-kotak-acuan-26okt`, `draf-blangko-prompt`, `berkas-pekerjaan-25okt`, `ekstensi-berkas-server-25okt`, `cetak-cepat-27okt`, `penjaga-tanda-ekstensi-17okt`, `penjaga-tanda-sipp-17okt`, `k11-peta-fitur-26okt`, `putusan-advance-draf-17okt`, `putusan-advance-f44`, `blangko-derry-cetak-massal-20okt`, `blangko-derry-rapi-16okt`, `g1-cegah-salah-30okt`, `identitas-kosong-31okt`, `salinan-unggah-28okt`, `blangko-derry-isian-rapi-30okt`, `wajib-sebelum-cetak-ekstensi-25okt`, `ekstensi-pratinjau-bas-relaas-20okt`: semua lulus.
- Dua ubahan sah pada `deteksi-sisa-blangko-17okt.test.ts`: (a) `bin/binti` kini jenis `ragu` (bukan `kalimat`); (b) fixture "letak tanpa pemisah halaman" memakai kata berbeda (kata berulang kini temuan PASTI dan menghabiskan batas 500 temuan).
- `npx tsc --noEmit`: bersih. Fixture hash k11 tidak diubah. `ekstensi-berkas.ts` (tanam) BELUM diperbarui - bagian rilis.

## Belum terverifikasi
- Cetak sungguhan di Word (warna merah tampil, jarak `\sb240` judul, tidak ada pergeseran tata letak setelah paragraf kosong dibuang) dan pengubah RTF->PDF memahami `\cf` merah baru.
- Pengukuran atas putusan/BAS/relaas sungguhan: laju salah tangkap pola RAGU (spasi ganda, label ujung paragraf, `diisi`) dan PASTI umum (kata berulang, "isi/diisi dengan", `Rp` di ujung); heuristik kop (5 paragraf isi pertama), blok TTD (3 paragraf isi sebelumnya) dan blok Jurusita (6 paragraf pendek) perlu dicocokkan dengan blangko Derry nyata.
- Paragraf campuran memakai fixture rekaan; RTF ABT asli (grup `{\pard...\par}` per paragraf, field, shape Z-cross) belum diuji.
- Dialog `tinjau` kini muncul juga untuk temuan RAGU saja; belum dilihat di layar.
- Papan kemajuan ALETA tidak diperbarui (lingkungan awan).
