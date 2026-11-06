# Laporan kerja malam fitur 46, 7 November 2026

Cabang `fitur-46-cerai`, commit `917984eb`. Belum dirilis, belum digabung, dan belum terpasang. Paket pasang yang siap tetap 1.205.80.

## Selesai

- Cerai, itsbat nikah, dan dispensasi kawin: 43 kartu dari Blangko ABT by Derry.
- 48 kartu usulan tulisan AI untuk bukti tanpa bunyi blangko. Semuanya `disetujui: false` dan tidak dipakai. Tinjauan: `docs/arahan/awan-F46-usulan-bunyi.md`.
- Paragraf otomatis tersisip ke naskah cetak di peramban, tanpa mengubah server dan `naskah.ts`.
- Agenda pembuktian dibaca dari jadwal SIPP. Kode PK, TK, PR, dan TR dikenali penyisip.
- Bagian di layar cetak ALETA ABT: paragraf otomatis, usulan bercentang, toggle Lawan membantah, Salin, dan centang masuk naskah.

## Bukti

- Uji penuh: 23.551 lulus, 35 dilewati, 0 gagal.
- 20 naskah nyata di laptop dengan paragraf sungguhan: 30 paragraf sudah ada dan 0 disisipkan, jadi tidak ada paragraf ganda. Dengan paragraf contoh: 19 berkas tersisip, 1 berkas tanpa kode bukti tidak tersisip. Di luar titik sisip identik pada 20 dari 20.
- 3 naskah di Word: alinea bertambah tepat satu; tabel, gambar, dan halaman tidak berubah.
- Render dengan data fiktif ada di artefak Upgrade ALETA ABT dan Alat Bukti Tertulis.

## Belum diuji

Server, SIPP, dan ABT sungguhan. Layar hanya dilihat dengan data fiktif pada halaman uji.

## Keterbatasan

1. Layar belum membaca bukti PK/TR dari duduk perkara, walau penyisipnya sudah mengenal kode itu.
2. Alinea pengantar yang menyebut kode dihitung sudah ada. Aman dari paragraf ganda, tetapi bisa menahan paragraf yang belum dinilai blangko.
3. Sisipan mengikuti bentuk kartunya, jadi bisa "- Bahwa bukti" di antara alinea "Menimbang, bahwa".
4. Agenda pembuktian bisa kurang dari kenyataan. Dari 1.263 perkara berbukti, 230 agenda pertamanya sudah tertulis lanjutan atau tambahan.
5. Saat Lawan membantah, klausa tidak dibantah hanya dihapus, karena blangko tidak punya bunyi penggantinya.
6. Perubahan di ALETA ABT belum tersimpan ke ABT.
7. Bukti elektronik belum punya paragraf otomatis.
8. Perkara kebendaan belum dikerjakan.

## Perlu diperiksa pemilik

- 48 kartu usulan. Bunyi hukumnya tulisan AI.
- Bunyi blangko yang mencurigakan: `awan-F46-cerai-hasil.md` dan `awan-F46-itsbat-dk-hasil.md`.
- Rujukan yang belum terverifikasi: Pasal 285 RBg hanya bersumber dari kartu blangko, sedangkan rak peraturan masih mencatat belum.
- Apakah fitur 46 ikut paket berikutnya. Saran: pasang 1.205.80 dulu.
