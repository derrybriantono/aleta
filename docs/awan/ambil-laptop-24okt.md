# Ambil semua hasil cloud ke laptop (mulai 24 Okt 2026)

Panduan untuk sesi Claude Code **LAPTOP**. Isinya: menggabungkan semua kerja cloud yang belum digabung di lokal, lalu meneruskan rencana kerja cloud bila perlu dikerjakan di laptop. Patuhi `CLAUDE.md` bagian laptop:
- drive D:/C:;
- papan kemajuan `localhost:8787`;
- skill `periksa-uji` dan `rilis-ekstensi`;
- jangan naikkan `APP_VERSION`.

## Prompt untuk ditempel di sesi laptop

```
git fetch origin, lalu baca docs/awan/ambil-laptop-24okt.md dari origin/fitur/panduan-laptop-24okt
(git show origin/fitur/panduan-laptop-24okt:docs/awan/ambil-laptop-24okt.md) dan kerjakan
Bagian 1 sampai 3. Bagian 4 hanya untuk rantai yang laporannya sudah ada di origin.
Perbarui papan kemajuan di setiap langkah. Laporkan ke saya dalam bahasa Indonesia.
```

## Keadaan per 24 Okt (yang belum ada di lokal)

| Cabang di origin | Isi | Keadaan |
| :--- | :--- | :--- |
| `integrasi-awan-24okt` | `integrasi-1205-38` (GitHub, `24fa2f74`) + 16 cabang: kalender libur, T1–T10, audit login perangkat, PWA, rencana fitur admin, perbaikan AWAN, panduan gabung 23 Okt, rencana upgrade 24 Okt. Bentrok jurnal migrasi 0084–0088 dan penyelarasan T9↔T10 sudah dikerjakan | **Selesai** (ujung `f5e181c3`): `tsc` bersih, lint = dasar; uji penuh cloud 914 berkas hijau, 28 merah = 23 sama dengan dasar (lingkungan cloud) + 5 merah baru yang sudah diperbaiki. Rincian di `docs/awan/laporan-integrasi-awan-24okt.md`; laptop mengulang uji penuh |
| `fitur/panduan-laptop-24okt` | panduan ini | — |
| Rantai A–F (`docs/awan/rantai-upgrade-24okt.md`) | Cermin Perkara, kinerja, jejak isian, saksi, blangko, admin, server | **Belum dimulai.** Cloud mulai Minggu 25 Okt 10.15 WITA bila kuota langganan pulih, dua rantai sekaligus (A + C dulu) |

**Yang hanya ada di laptop:** perbaikan error 1.205.38 yang sudah terpasang di lokal dan server, tetapi belum di-push. Jangan sampai hilang.

## Bagian 1 — Amankan perbaikan lokal

1. Di repo lokal: `git status`.
   - Bila ada ubahan perbaikan 1.205.38 yang belum di-commit, commit di `integrasi-1205-38` lokal dengan pola commit `CLAUDE.md`.
   - Jangan commit `.env`, dump, atau data perkara.
2. `git fetch origin`.
3. Gabungkan `origin/integrasi-1205-38` ke lokal (merge), lalu `git push origin integrasi-1205-38`.

## Bagian 2 — Gabung hasil cloud

1. Buat cabang rilis: `git switch -c integrasi-1205-39` dari `integrasi-1205-38` lokal.
2. Gabungkan **ujung terbaru** `origin/integrasi-awan-24okt` (merge, bukan rebase).
   - Bentrok yang mungkin muncul hanya antara perbaikan error lokal dan kerja cloud. Satukan keduanya, jangan ada perilaku yang hilang.
   - Bila memilih salah satu sisi menghilangkan perilaku, BERHENTI dan tanyakan Derry.
3. Gabungkan juga `origin/fitur/panduan-laptop-24okt` (dokumen ini).
4. Baca `docs/awan/laporan-integrasi-awan-24okt.md` (bentrok yang sudah diselesaikan cloud) dan `docs/awan/gabung-23okt.md`, bagian "Bentrok dan penyelarasan". Periksa:
   - jurnal migrasi urut 0083 → 0088 tanpa idx ganda;
   - kembaran `schema.ts` dan daftar tabel `client.ts` lengkap;
   - sesudah merge: `ALETA_TANAM_PAKSA=1 node scripts/susun-ekstensi.mjs` dari `manajemen_surat/`.
5. Verifikasi, wajib hijau sebelum rilis:
   - `npx tsc --noEmit` dan `npm run lint`;
   - uji penuh lewat skill `periksa-uji`, satu kali, dari salinan kerja `C:\aleta\kerja` bila perlu;
   - uji baru di tabel "Verifikasi" `gabung-23okt.md` harus hijau;
   - jangan skip atau menonaktifkan uji.

## Bagian 3 — Rilis 1.205.39 dan pasang

Ikuti `docs/awan/gabung-23okt.md` bagian **"Rilis dan pasang"** langkah 1–8. Ringkasnya:
- `rilis-ekstensi` → 1.205.39;
- push `integrasi-1205-39`;
- `aleta-deploy-from-git.sh --dry-run`, lalu pasang sungguhan;
- migrasi 0084–0088 harus berjalan, dan bot dibangun ulang serta dimulai ulang (T2);
- **ALETA Ai, batas perangkat, isi saldo berbayar, dan sandbox tetap MATI**;
- cek di browser dan HP.

Sesudah terpasang, kerjakan **pengukuran Tahap 0** (`docs/rancangan/upgrade-otomatisasi-24okt/TAHAPAN.md`, Tahap 0 langkah 2). Tulis hasilnya di `docs/rancangan/upgrade-otomatisasi-24okt/ukuran-server.md`, tanpa sandi atau data perkara:
- CPU, RAM, dan disk server;
- `max_connections` dan versi MariaDB SIPP/ABT;
- port Apache 8008;
- jumlah perangkat bersamaan;
- tabel SIPP yang punya `diinput_tanggal`/`diperbaharui_tanggal` (di kembaran laptop);
- jumlah perkara;
- memori Chrome di 2–3 PC tua.

Commit dan push ke `integrasi-1205-39`. Angka ini dipakai rantai A, E, dan F.

## Bagian 4 — Ambil rantai upgrade yang sudah selesai di cloud

Setiap rantai menulis laporan `docs/awan/laporan-rantai-<huruf>.md` di cabang terakhirnya. Gabungkan **hanya** rantai yang laporannya sudah ada, dengan urutan ini:

| Urut | Rantai | Cabang terakhir (gabungkan ini; cabang dalam rantai bertumpuk) | Langkah laptop sesudah gabung |
| :--- | :--- | :--- | :--- |
| 1 | F Server | `fitur/riwayat-tunda-putus` | Isi ukuran kolam SIPP dari `max_connections`; pasang Apache 8008 bila belum; mulai ulang bot |
| 2 | E Ukur & admin | `fitur/otp-whatsapp` | **Uji beban K9 di kembaran laptop saja** (sebelum rantai A/B dipasang), simpan angka awal; OTP tetap mati |
| 3 | C Jejak & saksi | `fitur/saksi-ke-bas-sipp` | Rilis ekstensi; kirim saksi ke BAS SIPP tetap mati |
| 4 | D Blangko | `fitur/isian-per-sidang` | Rilis ekstensi |
| 5 | A Cermin | `fitur/kabar-perubahan` | Pasang dengan saklar mati. Malam pertama pemindaian awal (18.00–06.30), pantau di Pemantau Cermin. Sesudah 100% dan pencocokan bersih, Super Admin menyalakan per layar: Mediasi → Status Perkara → Jadwal Sidang → panel ekstensi |
| 6 | B Ekstensi & PC tua | `fitur/ejaan-nama-pihak` | Rilis ekstensi; ukur ulang memori Chrome di PC tua |

Untuk setiap rantai:
1. Baca laporannya, lalu merge ke cabang integrasi berikutnya, misalnya `integrasi-1205-40`.
2. Jurnal migrasi diurutkan menurut nomor berkas. Pembagian nomor ada di `rantai-upgrade-24okt.md`.
3. `tsc`, lint, uji penuh sekali, `rilis-ekstensi` bila ekstensi berubah, lalu pasang.
4. Semua saklar baru tetap mati sampai Derry menyalakannya.
5. Uji beban K9 diulang sesudah rantai A dan B.

Sesudah semua rantai digabung, sisanya:
- **K11** (pecah `konten.js`, persempit `matches`), dikerjakan paling akhir;
- **K4/K5/SSE**, diputuskan dari hasil uji beban (TAHAPAN, keputusan 8).

## Bila kuota cloud habis: kerjakan rantai di laptop

Rantai yang belum dimulai cloud boleh dikerjakan di laptop dengan kartu yang sama, `docs/awan/rantai-upgrade-24okt.md`. Ketentuannya:
- dasar `integrasi-1205-39`;
- aturan bersama 1–10 di kartu itu berlaku, plus aturan laptop di `CLAUDE.md`;
- **cek dulu di origin** apakah cabang rantai itu sudah ada (`git ls-remote origin "fitur/*"`), supaya tidak mengerjakan ulang;
- tulis keadaan di papan kemajuan dan push tiap cabang.

Urutan saran bila dikerjakan di laptop: A → C → E → F → B → D (D dimulai sesudah `fitur/jejak-isian` dari C ada).

## Laporan akhir ke Derry
- cabang dan commit gabungan;
- bentrok dan cara menyelesaikannya;
- angka `periksa-uji`;
- versi rilis dan hasil pemasangan;
- isi `ukuran-server.md`;
- rantai yang sudah dan belum digabung.
