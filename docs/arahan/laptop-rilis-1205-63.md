# Arahan sesi LAPTOP - gabung, uji penuh, rilis ekstensi 1.205.63, dan pasang ke server (2 Nov 2026)

Sesi cloud 2 Nov (lanjutan 1.205.62) sudah menyelesaikan butir 1-17 di cabang **`claude/fervent-edison-gw9xfn`** (dasar `gabung-56`
= rilis 1.205.62). Versi BELUM dinaikkan (manifest tetap 1.205.62), catatan rilis BELUM ditulis, uji penuh BELUM dijalankan,
server BELUM dipasang. Langkah di bawah dikerjakan sesi laptop (CLAUDE.md berlaku: papan kemajuan, drive D:, skill rilis).

## Isi cabang (commit, lama -> baru)
| Commit | Butir | Isi |
|---|---|---|
| fix(pdf-bas) | 1-6 | RTF dirapikan sebelum LibreOffice di bot (`aleta_bot/services/rtfSofficeRapi.js`): diagonal Z grup bercermin, kotak nomor halaman di kaki; Z otomatis membuang grup Z lama + garis bawah sampai batas area teks; salinan BAS bertanda tangan asli; "ttd" salinan putusan lebih tahan; nama ttd dicocokkan tanpa gelar; blok "Untuk Salinan" tersembunyi dibuang dari PDF putusan biasa |
| feat(blangko-derry) rekomendasi | 7, 8, 10, 11, 15 | rekomendasi & keadaan perkara terlipat, saran satu arah dengan rekomendasi, tanya jawab saksi di bawah bukti, saksi II "sama" |
| perf(perkara-saya) | 13 | daftar perkara 13 kueri SIPP per potongan (dulu 39), baca serentak |
| perf(cetak) | 14 | profil soffice hangat per slot (`aleta_bot/services/sofficeProfilService.js`; matikan: `ALETA_SOFFICE_PROFIL_HANGAT=0`) |
| feat(ekstensi) pemasang | 16 | `ekstensi-sipp/pembaru/pasang-aleta.cmd` + `copot-aleta.cmd`, rute `?bentuk=pemasang` |
| feat(blangko-derry) pemisah | 9 | `ekstensi-sipp/blangko-derry-golongan.js` (skrip konten BARU) |
| fix(unduh) | 17 | unduhan portal lewat ekstensi (offscreen; izin manifest BARU `offscreen`) |
| feat(blangko-derry) ringkas | 12 | Isian untuk amar, Tuntutan, Bahan musyawarah majelis |
| chore(ekstensi) tanam | - | `ekstensi-berkas.ts` ditanam ulang (sidik terakhir 5243710999f6) |

Rancangan & status: artefak "Rancangan panel Blangko Derry" (https://claude.ai/artifact/Sfn32rEyAUTcLzFKGB2NUB).

## Langkah laptop
1. `git fetch origin claude/fervent-edison-gw9xfn gabung-56` lalu gabung ke cabang rilis (mis. `git switch -c rilis-63 origin/gabung-56 &&
   git merge --no-ff origin/claude/fervent-edison-gw9xfn`). Konflik `ekstensi-berkas.ts` = tanam ulang, jangan disunting tangan.
2. Di `aleta_bot/`: `npm ci` (bot memakai modul baru `rtfSofficeRapi`, `sofficeProfilService`, `unduh-aman-latar` - tanpa dependensi baru).
3. Skill **periksa-uji** (uji penuh). Diketahui sebelum sesi ini: `penjaga-tenggat-terjadwal-25okt` ("dengan 'baru': banding per pihak")
   sudah merah di gabung-56; uji ber-MySQL (`arsip-berkas-urut`) butuh MySQL laptop; 5 uji Z "mesin sungguhan" dirancang untuk Word.
4. Skill **rilis-ekstensi**: naikkan ke **1.205.63**, catatan `catatan-ekstensi.ts` (17 butir di atas, bahasa pengguna), tanam, salin ke
   `D:\Download File\ekstensi-sipp`, tsc, uji penuh. Izin baru `offscreen` -> Reload ekstensi; pastikan tidak dinonaktifkan Chrome.
5. Pasang ke server 192.168.10.10 dari git: `scripts/aleta-deploy-from-git.sh <rujukan rilis>` (portal + bot; bot dibangun ulang supaya
   modul baru ikut). Sesudahnya periksa `soffice --version` di container bot dan `/tmp/aleta-soffice-profil-*` muncul sesudah cetak.
6. Paket ABT: sesi ini TIDAK menambah paket. Periksa dulu apakah paket ke-31..33 (`abt-paket/URUTAN-PASANG-1nov.md`) sudah terpasang;
   yang belum, pasang berurutan sesuai berkas itu.

## Uji tangan sesudah terpasang (layar sungguhan)
- BAS 668/Pdt.G/2026: PDF & PDF salinan -> Z benar (kanan-atas ke kiri-bawah) dan panjang sampai batas area teks, tanggal di bawahnya,
  nomor halaman kanan bawah, salinan bertanda tangan asli Ketua Majelis & Panitera Sidang (tanda tangan harus sudah disahkan).
- Putusan 637/Pdt.G/2026: PDF tanpa ruang kosong sesudah "1. PNBP :"; salinan bertulis "ttd" di antara pejabat + ttd Panitera di blok
  "Untuk Salinan". Bila "ttd" tetap tidak muncul: simpan RTF hasil render (nama disamarkan) untuk dibaca susunan blok tanda tangannya.
- Panel Blangko Derry: pemisah & chip lompat di Pilih blangko; rekomendasi/keadaan perkara terlipat; Isian untuk amar / Tuntutan /
  Bahan musyawarah (hakim melihat, PP tidak); tema gelap & terang.
- Status Perkara 273/Pdt.G/2026: Unduh seluruh berkas (dengan/tanpa arsip pindaian) tanpa "Insecure download blocked"; kuki sesi ikut
  (bila 401 -> "Sesi ALETA berakhir"); PC ber-IDM.
- Pemasang Windows: `pasang-aleta.cmd` di PC petugas (Mode Pengembang menyala sesudah Chrome dibuka ulang, Load unpacked sekali, pasang
  ulang melewati langkah itu, pembaru aktif); jalankan juga `npx vitest run src/test/pemasang-aleta-2nov.test.ts` di Windows (4 uji
  PowerShell yang dilewati di cloud).
- Daftar perkara "Semua perkara saya" lebih cepat dan isinya sama; waktu cetak.

## Keputusan yang menunggu Derry
- Panel ABT lama "Susun keterangan saksi" masih bawaan saksi II "sebagian" (berkas dibekukan uji K11) - samakan?
- unoserver/python3-uno di image bot (hemat +-1 detik per konversi, image dibangun ulang)?

## Ditunda (tidak dikerjakan, sesuai permintaan)
- Uji tangan fitur 1.205.62: rekomendasi putusan, cetak putusan tanpa umur + kaidah fikih, nomor halaman BAS, layar Tenggat.
- 67 blangko tanpa kaidah fikih, konfirmasi blangko prosedural, kutipan PP 42/2006 wakaf (`D:/aleta-dev/kerja/kaidah-fikih-2nov.md`).
- Model AI sendiri (butir 17 daftar lama).
