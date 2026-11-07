# Laporan kerja fitur 46, 7 November 2026

Cabang `fitur-46-cerai`. Kode terakhir yang diuji: commit `725bcc16`. Belum dirilis, belum digabung, dan belum terpasang. Paket pasang yang siap tetap 1.205.80.

## Selesai

- 85 kartu dari Blangko ABT by Derry: cerai 14, itsbat nikah 10, dispensasi kawin 19, bukti elektronik 6, harta bersama 18, kewarisan 15, penetapan ahli waris 3.
- 48 kartu usulan tulisan AI untuk bukti tanpa bunyi blangko. Semuanya `disetujui: false` dan tidak dipakai. Tinjauan: `docs/arahan/awan-F46-usulan-bunyi.md`.
- Paragraf otomatis tersisip ke naskah cetak di peramban, tanpa mengubah server dan `naskah.ts`.
- Agenda pembuktian dibaca dari jadwal SIPP.
- Kode PK, TK, PR, dan TR terbaca di layar dan di penyisip.
- Bukti elektronik dibaca dari naskah dan mendapat paragraf menurut keadaan pemeriksaan. Bukti elektronik tidak ikut golongan surat.
- Format alinea "- Bahwa": tanda hubung, tab, lalu baris berikutnya rata dengan teks, sama seperti "- Bahwa bukti" di blangko. Alinea sesudahnya tetap seperti semula.
- Kalimat bukti yang diketik sendiri ikut terbaca. Kalimat itu tampil apa adanya, masuk daftar belum ada bunyi, dan tidak diberi paragraf karangan.
- Layar menyebut asal blangko tanpa nomor rumus.
- Bagian di layar cetak ALETA ABT: paragraf otomatis, usulan bercentang, toggle Lawan membantah, Salin, dan centang masuk naskah.

## Bukti

- Uji penuh pada `725bcc16`: 23.653 lulus, 35 dilewati, 0 gagal.
- Cerai, itsbat, dan dispensasi kawin, 20 naskah nyata di laptop dengan paragraf sungguhan: 30 paragraf sudah ada dan 0 disisipkan, jadi tidak ada paragraf ganda. Dengan paragraf contoh: 19 berkas tersisip, 1 berkas tanpa kode bukti tidak tersisip. Di luar titik sisip identik pada 20 dari 20.
- Kebendaan, 22 naskah nyata di laptop, sebagian salinan berkas yang sama dan sebagian blangko kosong atau tanpa bukti:
  - Paragraf sungguhan: 0 disisipkan, 0 ganda.
  - Bukti terbaca pada 6 berkas; sebelum perbaikan pembaca hanya 1 berkas.
  - 3 berkas punya bukti tetapi tidak punya kalimat tanda, jadi tetap 0 terbaca.
  - Paragraf contoh tersisip pada 5 berkas. 17 berkas ditolak dengan alasan, karena alinea penilaian atau batas pembuktian tidak terbaca. 3 dari 17 itu punya bukti yang terbaca.
  - Di luar titik sisip identik, alinea utuh, dan kurung seimbang pada semua berkas.
- 3 naskah cerai, itsbat, dan dispensasi kawin di Word, dan 3 naskah kebendaan di Word: alinea bertambah tepat satu; tabel, gambar, dan halaman tidak berubah.
- Sisipan kebendaan di Word: baris pertama -19,2, kiri 19,2, rata kanan-kiri, spasi 18, Arial 12.
- Render dengan data fiktif ada di artefak Upgrade ALETA ABT dan Alat Bukti Tertulis.

## Belum diuji

Server, SIPP, dan ABT sungguhan. Layar hanya dilihat dengan data fiktif pada halaman uji.

## Keterbatasan

1. Alinea pengantar yang menyebut kode dihitung sudah ada. Aman dari paragraf ganda, tetapi bisa menahan paragraf yang belum dinilai blangko.
2. Bunyi sisipan mengikuti kartunya, jadi bisa berbentuk "- Bahwa bukti" di antara alinea "Menimbang, bahwa".
3. Agenda pembuktian bisa kurang dari kenyataan. Dari 1.263 perkara berbukti, 230 agenda pertamanya sudah tertulis lanjutan atau tambahan.
4. Saat Lawan membantah, klausa tidak dibantah hanya dihapus, karena blangko tidak punya bunyi penggantinya.
5. Saklar Lawan membantah tersembunyi pada kebendaan, karena blangko kebendaan tidak punya kalimat itu.
6. "Dikabulkan sebagian" memakai bunyi Dikabulkan.
7. Wasiat, hibah, dan wakaf belum punya bunyi.
8. Perubahan di ALETA ABT belum tersimpan ke ABT.

## Perlu diperiksa pemilik

- Format "- Bahwa". Bila yang dimaksud tanda hubung tepat di posisi tab Menimbang, ubah ke `\fi720\li0`.
- 48 kartu usulan. Bunyi hukumnya tulisan AI.
- Bunyi blangko yang mencurigakan: `awan-F46-cerai-hasil.md`, `awan-F46-itsbat-dk-hasil.md`, dan `awan-F46-kebendaan-hasil.md`. Pada kebendaan: "volledig bidende bewijskracht", penulisan perubahan UU ITE yang berbeda antar-blangko, kalimat Tergugat yang selalu menyebut saksi, kalimat lain-lain, dan penggolongan kata kunci yang longgar seperti "Surat Keterangan Rumah Sakit" masuk golongan tanah.
- Rujukan yang belum terverifikasi: Pasal 284 dan 285 RBg hanya bersumber dari kartu blangko, sedangkan rak peraturan masih mencatat belum.
- Apakah fitur 46 ikut paket berikutnya. Saran: pasang 1.205.80 dulu, lalu fitur 46 sesudah usulan diperiksa dan dicoba di server.
