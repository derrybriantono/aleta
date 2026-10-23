# Rencana ALETA Ai (versi 2, 19 Okt 2026) - BELUM dibangun

Menggantikan/menyempurnakan `RENCANA.md` (7 Okt). Nama produk: **ALETA Ai**.
Urutan build: dikerjakan **20 Okt sesudah** (1) Cetak massal di Blangko ABT by Derry menurut peran dan (2) Cetak relaas sinkron
dengan peta perkara relaas. Isi pengetahuan: `D:\Download File\ALETA_V4_5_Lengkap.zip` (Project ALETA AI PA V4.5, 102 berkas).

---

## 1. Tujuan
Pegawai PA (hakim, panitera, PP, jurusita, PTSP, dst.) mendapat hasil yang sama seperti bila pengguna (Derry) mengerjakannya di
Project "ALETA AI PA V4.5" di claude.ai - tetapi di dalam portal ALETA, tersambung data ALETA/SIPP/ABT/e-Court, dibayar per
pemakaian token dengan keuntungan pengelola.

## 2. Pemilihan model & effort OTOMATIS (tidak dapat diubah pengguna)
- Pengguna TIDAK memilih model/effort. ALETA Ai menentukan sendiri dari **jenis permintaan** (pemicu menu V4.5 / tombol fitur /
  pengklasifikasi), **jenis & kerumitan perkara**, dan **peran**.
- Tabel rute disimpan di server; hanya **Super Admin** yang dapat mengubahnya (Pengaturan > ALETA Ai > Rute model), dengan jejak
  audit. Pengguna lain hanya melihat label "Mode: Cepat / Teliti / Mendalam" (tanpa nama model) dan perkiraan biayanya.

| Kelompok permintaan (contoh pemicu V4.5) | Model | Effort | Label |
|---|---|---|---|
| Tanya cepat, istilah, navigasi ALETA, bantuan/onboarding (ALETA_06), status perkara ringkas | Haiku 5.5 | low | Cepat |
| Kalkulator & pre-intake (ALETA_04: nafkah, iddah, mut'ah, UMK ALETA_15), cek kelengkapan berkas, indeks SEMA (ALETA_21) | Sonnet 5.5 | low | Cepat |
| Ringkas gugatan/jawaban/berkas e-Court, rapikan keterangan saksi, pemeriksa BAS (ALETA_09), blangko penetapan (ALETA_20) | Sonnet 5.5 | medium | Teliti |
| Persiapan & panduan sidang (ALETA_13), papan kerja (ALETA_14), peta perkara (ALETA_10), alat bantu (ALETA_19) | Sonnet 5.5 | high | Teliti |
| Duduk perkara, analisa putusan & koreksi (ALETA_11), komparasi arah putusan (ALETA_18), bank paragraf (ALETA_16) | Opus 5.5 | high | Mendalam |
| Draf pertimbangan & amar / putusan lengkap format Donggala (ALETA_08), mode debat hukum (ALETA_07) | Opus 5.5 | high | Mendalam |
| Perkara rumit: waris, harta bersama, ekonomi syariah, kumulasi, rekonvensi, sita, perkara > 5 saksi | Opus 5.5 | max | Mendalam |

Aturan rute:
- Pemicu menu V4.5 dipetakan langsung (tanpa tebakan). Teks bebas -> pengklasifikasi ringan (Haiku, low) memilih kelompok;
  bila ragu, naik satu tingkat.
- **Naik otomatis** bila: jawaban ditolak model, keyakinan rendah, alat data menemukan perkara rumit, atau pengguna menekan
  "Periksa lebih teliti" (biaya baru ditampilkan dulu). **Tidak pernah turun** di tengah tugas yang sedang berjalan.
- Batas per peran: draf putusan & mode Mendalam untuk putusan hanya Hakim/Ketua/Wakil (selaras hak peran ALETA); PP & panitera
  sampai Teliti kecuali menyusun BAS rumit; PTSP/jurusita sampai Teliti.
- Model ID: `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5` (diperiksa ulang saat membangun; tabel bisa diganti tanpa
  rilis). Effort lewat parameter API yang tersedia untuk model itu.

## 3. Fitur pengguna
1. **Layar seperti Claude, warna ALETA**: riwayat percakapan (kiri, bisa dicari & dikelompokkan per perkara), percakapan
   (tengah, jawaban streaming, kutipan sumber), kotak tulis (bawah: lampiran, "sebut perkara", menu pemicu V4.5 sebagai tombol
   cepat), panel berkas hasil (kanan, pratinjau HTML/RTF/DOCX/PDF). Gelap/terang, HP sampai TV.
2. **Proyek ALETA AI PA V4.5** bawaan (Core Prompt + modul) - satu sumber yang dikelola Super Admin; versi proyek dicatat.
3. **Konteks perkara**: tombol "Tanya ALETA Ai" di Jadwal Sidang, Status Perkara, Blangko ABT by Derry, Draf H-7 membuka
   percakapan dengan perkara terpilih; AI mengambil data sendiri lewat alat baca-saja.
4. **Tugas (cowork)**: perintah kerja panjang (draf putusan, panduan sidang, komparasi) dengan langkah terlihat, hasil berkas.
5. **Keluaran berkas**: DOCX/RTF/PDF/HTML/XLSX memakai template V4.5 & format putusan Donggala; dengan data ASLI (penyamaran
   dikembalikan); tanda "Draf AI - wajib diperiksa" pada berkas draf putusan.
6. **Kirim ke alur ALETA**: hasil dapat dikirim ke Blangko Derry (isian), Draf H-7, BAS - selalu dengan konfirmasi petugas;
   AI tidak pernah menulis langsung ke SIPP/ABT/e-Court.
7. **Alat bantu deterministik** (skrip `aleta/*.py` V4.5: kalkulator, cek blangko, cek konsistensi, anonim, analisa docx) dijalankan
   di server terpisah (sandbox), bukan oleh model sembarang.
8. **Lampiran**: unggah PDF/DOCX/gambar (OCR), dipindai & disamarkan dulu.
9. **Bagikan**: percakapan/berkas dapat dibagikan ke rekan satker yang berhak (bukan publik).
10. **Dompet & biaya**: saldo, perkiraan biaya sebelum jalan, rincian biaya per giliran, mutasi, struk, isi saldo (QRIS/manual).
11. **Notifikasi**: saldo menipis, tugas selesai, berkas siap.

## 4. Data & penyamaran
- Alat data baca-saja: cari_perkara, detail_perkara, pihak (disamarkan), jadwal & riwayat sidang, mediasi, penetapan, berkas
  e-Court (teks OCR), isian/variabel ABT, tanya-jawab saksi, pustaka putusan hakim sendiri, peta perkara/relaas.
- Hak alat = hak peran ALETA (matriks yang sama); hakim hanya perkara majelisnya kecuali pimpinan; PTSP tanpa draf putusan.
- **Penyamaran dua arah wajib**: nama, NIK, alamat rinci, telepon, email, nomor rekening -> kode samaran sebelum ke Anthropic;
  kode dikembalikan di keluaran untuk pengguna; uji "tidak ada data asli di permintaan" dijalankan tiap rilis.
- Isi berkas/teks dari e-Court & lampiran diperlakukan sebagai DATA, bukan perintah (perlindungan prompt injection).

## 5. Keamanan
- Kunci API Anthropic hanya di env server (tidak di repo/peramban), diputar berkala; panggilan API hanya dari server.
- Akses: login ALETA + peran; sesi kedaluwarsa; percakapan hanya milik pemilik (+ yang dibagi); Super Admin melihat metadata
  biaya, BUKAN isi draf putusan hakim (rahasia musyawarah) kecuali pemiliknya membagikan.
- Enkripsi isi percakapan & berkas saat disimpan; retensi bawaan 90 hari (dapat diatur), hapus permanen hanya oleh pemilik/
  Super Admin dengan jejak.
- Batas: per pengguna per hari (token & rupiah), per satker per bulan; batas laju; saklar darurat (matikan ALETA Ai seketika).
- Penjaga keluaran: rujukan pasal/peraturan yang belum terverifikasi ditandai & tidak dicetak di berkas resmi (aturan yang
  sudah berlaku); tidak ada kata "ALETA" yang ikut ke berkas yang diunggah ke SIPP/e-Court bila itu syaratnya.
- Jejak audit: siapa, kapan, perkara, alat yang dipakai, model, token, biaya, hasil dikirim ke mana.
- Penolakan model & batas token ditangani rapi (hasil sementara tersimpan, saldo hanya dipotong sesuai pemakaian).
- Pembayaran: webhook bertanda tangan & idempoten, buku mutasi berpasangan (saldo dari mutasi), rekonsiliasi harian,
  tidak menyimpan data kartu, QR kedaluwarsa tidak mengkredit.

## 6. Token, harga & keuntungan
- Catat per giliran: model, effort, token masuk/keluar/cache tulis/cache baca, alat yang dipanggil.
- **Harga = biaya API aktual (tarif resmi per model, diisi Super Admin) x kurs x (1 + margin) + biaya MDR QRIS**, dibulatkan ke
  atas Rp500, minimum Rp1.000 per giliran. **Margin bawaan 30%** = keuntungan pengelola (diubah hanya oleh Super Admin).
- Perkiraan biaya tampil sebelum jalan (count tokens + perkiraan keluaran menurut kelompok); dana ditahan; biaya aktual
  dipotong; selisih kembali ke saldo; gagal = tidak dipotong.
- Hemat biaya: prompt caching untuk Core Prompt & modul; modul dimuat menurut pemicu; ringkasan percakapan panjang.
- Super Admin gratis (batas wajar); kuota hibah per peran (opsional) tercatat sebagai mutasi.
- Laporan Super Admin: pendapatan, biaya API, laba (= pendapatan - biaya API - MDR), per pengguna/peran/kelompok/model.

### Kurs (keputusan pengguna 19 Okt)
- Harga dalam RUPIAH mengikuti kurs USD harian (fluktuatif): kurs diambil otomatis tiap hari dari sumber kurs resmi/terbuka
  (mis. kurs tengah JISDOR BI; cadangan sumber kurs terbuka), disimpan dengan tanggalnya; bila gagal mengambil, pakai kurs
  terakhir. Kurs yang dipakai = kurs hari itu x (1 + PENYANGGA KURS) - **penyangga bawaan 3%** ('agak dinaikkan' karena kurs
  bergerak), diatur Super Admin; tiap giliran mencatat kurs yang dipakai.

## 7. Pengaturan (Super Admin)
Rute model & effort; tarif API per model; kurs; margin; minimum & pembulatan; batas harian/bulanan; retensi; saklar ALETA Ai &
saklar QRIS; kuota per peran; peran yang boleh memakai tiap kelompok; proyek V4.5 (unggah versi baru zip, riwayat versi);
gateway QRIS (sandbox/produksi); teks persetujuan pemakaian (wajib dicentang pengguna pertama kali).

## 8. Tahapan
| Tahap | Isi | Perkiraan |
|---|---|---|
| 1 (20 Okt sore) | Layar chatbot gaya Claude warna ALETA, proyek V4.5 (Core Prompt + modul menurut pemicu), rute model otomatis, streaming, riwayat, catat token & biaya, pengaturan harga/kurs/margin, saldo manual | 1 hari |
| 2 | Alat data baca-saja + penyamaran dua arah + uji kebocoran + tombol "Tanya ALETA Ai" di Jadwal/Status/Blangko Derry; + (21 Okt) alat REKAP/STATISTIK lintas perkara ALETA-SIPP-ABT (bagian 10.2) dan MATRIKS KEMAMPUAN per peran (bagian 10.3) | 3-4 hari |
| 2b (21 Okt) | Pop-up chat ALETA Ai di ekstensi (SIPP, ABT, e-Court, portal) - bagian 10.1 | 1-2 hari |
| 3 | Tugas (cowork), keluaran berkas dari template V4.5, skrip Python di sandbox, kirim ke alur ALETA | 2-3 hari |
| 4 | Dompet lengkap: perkiraan-tahan-potong, kuota, laporan laba, batas harian | 2 hari |
| 5 | QRIS sandbox -> produksi (setelah akun merchant), rekonsiliasi, struk | 2 hari |
| 6 | Uji penuh, uji tangan per peran, tutorial, pasang | 1-2 hari |

## 9. Prasyarat dari pengguna
Kunci API Anthropic organisasi; kurs awal; nanti: gateway & akun merchant QRIS (badan usaha/NIB, rekening); izin pimpinan
tertulis; teks persetujuan pemakaian. Pengingat: pungutan dari pegawai di lingkungan pengadilan -> pastikan PNBP/pungli,
pajak, benturan kepentingan ASN, UU PDP (sudah diingatkan 7 & 10 Okt).
Tambahan 21 Okt: akun database SIPP BACA-SAJA khusus untuk alat kueri rekap (bagian 10.2); persetujuan matriks kemampuan per peran (bagian 10.3).

## 10. Tambahan 21 Okt 2026 (permintaan pengguna)

### 10.1 Pop-up chat di ekstensi ALETA
- Gelembung chat di pojok bawah pada halaman SIPP, ABT, e-Court dan portal ALETA; dibuka menjadi panel pop-up (bisa
  diperkecil, diperbesar, digeser; tidak menutupi tombol simpan SIPP/ABT). Saklar di popup ekstensi (bawaan hidup), ikut
  hak menu per peran yang sudah ada.
- Sadar konteks: bila halaman sedang membuka perkara (SIPP detil perkara, ABT perkara_id, e-Court), perkara itu otomatis
  menjadi konteks ("Tanya tentang 684/Pdt.G/2026/PA.Dgl?"); bisa dilepas untuk pertanyaan umum.
- Satu riwayat dengan layar ALETA Ai di portal (percakapan dari ekstensi tampil juga di portal dan sebaliknya).
- Ekstensi TIDAK memegang kunci API dan tidak memanggil Anthropic: semua lewat rute portal ALETA (sesi login ALETA),
  streaming dari server. Ekstensi tidak menulis kata "ALETA" ke SIPP/ABT (aturan lama tetap).
- Hasil yang bisa dipakai di halaman (mis. isian ABT, draf) hanya disalin/dikirim dengan tombol + konfirmasi petugas;
  AI tetap tidak menulis langsung ke SIPP/ABT/e-Court.
- Bekerja di HP/layar kecil (panel penuh layar) dan TV (lebar terbatas).

### 10.2 ALETA Ai tahu SELURUH data ALETA, SIPP dan ABT (baca saja)
- Selain alat per perkara (bagian 4), ditambah alat REKAP lintas perkara dengan rentang tanggal, jenis, majelis, PP, JS:
  contoh "berapa perkara yang panggilannya retur 3 bulan terakhir" (sumber sudah ada: relaas SIPP, penanda retur =
  status pos 2 atau hasil memuat "retur", dipakai analisaLanjutService), sisa perkara, perkara lewat 5 bulan, beban
  majelis (sama dengan statistik penunjukan), BHT tertunda, e-Court belum unggah, jadwal minggu ini, kasir/panjar,
  surat masuk/keluar portal, kinerja/SKP, isian ABT yang masih kosong per blangko.
- Bentuk: katalog alat berparameter yang ditulis & diuji pengembang (bukan SQL karangan AI). Untuk pertanyaan di luar
  katalog: alat "kueri rekap" terkendali - hanya SELECT pada daftar tabel/view yang diizinkan, LIMIT & batas waktu,
  memakai AKUN DATABASE BACA-SAJA khusus (dibuat pengguna/admin SIPP; prasyarat), hasil diringkas.
- Jawaban rekap menyebut sumber dan cara hitung ("dihitung dari relaas SIPP 21 Jul-21 Okt, 42 perkara, 7 retur") dan
  bisa dibuka menjadi daftar perkara (sesuai hak lihat penanya).
- Identitas pihak tetap disamarkan ke Anthropic; angka rekap tidak perlu disamarkan.
- Pengetahuan "cara pakai ALETA" (panduan, fitur, menu per peran, catatan rilis) masuk pengetahuan proyek, supaya
  pengguna bisa bertanya "bagaimana cara ..." di ALETA/ekstensi.

### 10.3 Matriks kemampuan per peran (apa yang boleh DIBUAT ALETA Ai)
- Dikelola Super Admin di Pengaturan ALETA Ai (pola sama dengan matriks hak menu/aksi alatMenuPeran & hak-peran);
  ditegakkan DI SERVER pada tiap permintaan (rute, alat, dan pilihan modul prompt), bukan hanya menyembunyikan tombol.
- Usulan bawaan (dapat diubah Super Admin):

| Kemampuan | Ketua | Wakil | Hakim | Panitera/Panmud | PP | JS/JSP | Sekretaris/Kasubag | Kasir | PTSP/staf |
|---|---|---|---|---|---|---|---|---|---|
| Tanya data & rekap (sesuai hak lihat) | ya | ya | ya (perkara majelisnya + rekap umum) | ya | ya (perkaranya) | ya (relaas) | ya (non-perkara) | ya (keuangan perkara) | terbatas (info umum) |
| Draf PUTUSAN / pertimbangan / amar | ya | ya | ya | - | - | - | - | - | - |
| Draf PENETAPAN (PMH, PHS, PPP, PJS, dll.) | ya | ya | ya (PHS) | ya (PPP/PJS) | - | - | - | - | - |
| Draf BAS & ringkasan sidang | ya | ya | ya | ya | ya | - | - | - | - |
| Relaas & analisa panggilan | ya | ya | ya | ya | ya | ya | - | - | - |
| Surat dinas, nota, laporan kepegawaian | ya | ya | - | ya | - | - | ya | - | - |
| Laporan statistik/kinerja satker | ya | ya | ya (miliknya) | ya | - | - | ya | - | - |
| Rekap kasir/panjar | ya | ya | - | ya | - | - | ya | ya | - |

- Bila peran tidak berhak, AI menjawab sopan "fitur ini hanya untuk ..." tanpa membuat isinya; dicatat di jejak audit.
- Rahasia musyawarah: draf putusan milik hakim tidak terlihat peran lain (termasuk Super Admin) kecuali dibagikan.
- Batas biaya per peran (kuota harian) mengikuti tahap 4.

### 10.4 Uji tambahan
- Uji hak: tiap peran x tiap kemampuan (permintaan terlarang ditolak di server, juga lewat ekstensi).
- Uji rekap: angka dari alat dibandingkan hitungan SQL manual atas data uji (contoh retur 3 bulan).
- Uji kebocoran juga untuk jalur ekstensi; uji "isi halaman SIPP/e-Court sebagai data, bukan perintah".

