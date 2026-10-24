# Ambil semua hasil cloud ke laptop (mulai 24 Okt 2026)

Panduan untuk sesi Claude Code **LAPTOP**. Isinya: menggabungkan semua kerja cloud yang belum digabung di lokal, lalu meneruskan rencana kerja cloud bila perlu dikerjakan di laptop. Patuhi `CLAUDE.md` bagian laptop:
- drive D:/C:;
- papan kemajuan `localhost:8787`;
- skill `periksa-uji` dan `rilis-ekstensi`;
- jangan naikkan `APP_VERSION`.

## Prompt untuk ditempel di sesi laptop

```
Ambil hasil kerja cloud dari GitHub: jalankan git fetch origin di repo ALETA lokal, lalu baca
panduan dari cloud dengan
  git show origin/fitur/panduan-laptop-24okt:docs/awan/ambil-laptop-24okt.md
dan kerjakan berurutan:
1. Bagian 1-3: amankan perbaikan lokal 1.205.38, gabung origin/integrasi-awan-24okt +
   origin/fitur/panduan-laptop-24okt + origin/fitur/rencana-upgrade-otomatisasi, uji penuh,
   rilis 1.205.39, pasang ke server 192.168.10.10 (tag + pg_dump dulu), lalu cek layar utama.
2. Sesudah 1.205.39 terpasang dan normal: Bagian 7, mulai rantai A (Cermin Perkara), lalu
   rantai berikutnya sesuai urutan. Satu rantai per sesi.
3. Audit keamanan Bagian 5a (baca saja) dan Bagian 6 dikerjakan sesudah rantai A, atau bila saya minta.
Perbarui papan kemajuan di setiap langkah. Laporkan ke saya dalam bahasa Indonesia.
```

**Alamat server yang benar: `192.168.10.10`** (dikonfirmasi Derry 24 Okt), sama dengan yang tercatat di ekstensi (`alamat-portal.js`, `host_permissions`). Jangan ubah alamat.

**Urutan besar:** pasang 1.205.39 (Bagian 1–3) → rantai A → audit 5a → C → E → F → B → D → G → K11. Bagian 6 diselipkan sesudah rantai A, saat Derry memintanya. Pemasangan hasil tiap rantai mengikuti Bagian 4.

## Keadaan per 24 Okt (yang belum ada di lokal)

| Cabang di origin | Isi | Keadaan |
| :--- | :--- | :--- |
| `integrasi-awan-24okt` | `integrasi-1205-38` (GitHub, `24fa2f74`) + 16 cabang: kalender libur, T1–T10, audit login perangkat, PWA, rencana fitur admin, perbaikan AWAN, panduan gabung 23 Okt, rencana upgrade 24 Okt. Bentrok jurnal migrasi 0084–0088 dan penyelarasan T9↔T10 sudah dikerjakan | **Selesai** (ujung `f5e181c3`): `tsc` bersih, lint = dasar; uji penuh cloud 914 berkas hijau, 28 merah = 23 sama dengan dasar (lingkungan cloud) + 5 merah baru yang sudah diperbaiki. Rincian di `docs/awan/laporan-integrasi-awan-24okt.md`; laptop mengulang uji penuh |
| `fitur/panduan-laptop-24okt` | panduan ini | — |
| `fitur/rencana-upgrade-otomatisasi` | Rencana upgrade (`docs/rancangan/upgrade-otomatisasi-24okt/README.md`, `TAHAPAN.md`) dan **kartu kerja rantai A–G terbaru** (`docs/awan/rantai-upgrade-24okt.md`; salinan di `integrasi-awan-24okt` sudah usang) | Dokumen saja |
| Rantai A–G | Cermin Perkara, kinerja, jejak isian, saksi, blangko, admin, server, tenggat & berkas e-Court | **Belum dimulai. 24 Okt: dipindah ke LAPTOP** karena kredit cloud hampir habis (Bagian 7). Tidak ada sesi cloud yang berjalan dan tidak ada jadwal cloud |

**Yang hanya ada di laptop:** perbaikan error 1.205.38 yang sudah terpasang di lokal dan server, tetapi belum di-push. Jangan sampai hilang.

**Tampilan rancangan** (artifact claude.ai, privat milik Derry; hanya referensi, tidak perlu digabung):
- Tampilan Rencana Upgrade ALETA (12 layar realistis, dikelompokkan "hanya data / tambahan kecil / layar baru"): https://claude.ai/artifact/PDxgf4mHJ7KpnV7E4RUth8
- Peta Rencana ALETA: https://claude.ai/artifact/1G8a4rq5dLBRKT3N8GNKp2
- Mockup Fitur Admin ALETA: https://claude.ai/artifact/1zvgkn9pxggeDmYLaB3mSi

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
3. Gabungkan juga `origin/fitur/panduan-laptop-24okt` (dokumen ini) dan `origin/fitur/rencana-upgrade-otomatisasi` (rencana + kartu rantai terbaru). Kedua cabang hanya berisi dokumen.
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

**Sebelum memasang (wajib, supaya bisa mundur bila ada yang rusak):**
- catat commit yang sedang berjalan di server, lalu beri tag `server-sebelum-1205-39` dan push tag-nya;
- `pg_dump` basis data ALETA ke folder cadangan di luar folder aplikasi;
- catat versi ekstensi yang terpasang di PC;
- pasang di luar jam kerja, karena bot dimulai ulang.

**Rencana mundur:** bila sesudah pasang ada fitur lama yang rusak dan tidak bisa diperbaiki cepat, pasang ulang commit `server-sebelum-1205-39` dengan skrip pasang yang sama. Migrasi 0084–0088 hanya menambah tabel/kolom (tanpa DROP/RENAME/UPDATE), sehingga kode lama tetap berjalan di atas basis data baru. `pg_dump` hanya dipakai bila data rusak. Ekstensi lama di PC tetap boleh dipakai selama peralihan.

**Pantau 1–3 hari kerja** sesudah setiap pemasangan sebelum memasang rantai berikutnya. Yang dipantau: layar utama (Jadwal Sidang, Mediasi, Status Perkara, panel SIPP/ABT, Blangko Derry, susun saksi, kasir, e-Court), log galat portal/bot, dan keluhan pengguna. Satu pemasangan berisi satu rantai, jangan digabung beberapa rantai sekaligus.

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

## Bagian 4 — Gabung dan pasang hasil rantai

Rantai sekarang dikerjakan di laptop (Bagian 7). Bagian ini mengatur **urutan memasang** hasilnya ke server.

Setiap rantai menulis laporan `docs/awan/laporan-rantai-<huruf>.md` di cabang terakhirnya. Pasang **hanya** rantai yang laporannya sudah ada dan uji penuhnya hijau. Urutan pasang yang disarankan (boleh berbeda dari urutan kerja):

| Urut | Rantai | Cabang terakhir (gabungkan ini; cabang dalam rantai bertumpuk) | Langkah laptop sesudah gabung |
| :--- | :--- | :--- | :--- |
| 1 | F Server | `fitur/riwayat-tunda-putus` | Isi ukuran kolam SIPP dari `max_connections`; pasang Apache 8008 bila belum; mulai ulang bot |
| 2 | E Ukur & admin | `fitur/penjaga-integritas-berkas` | **Uji beban K9 di kembaran laptop saja** (sebelum rantai A/B dipasang), simpan angka awal; OTP/authenticator tetap mati; daftarkan folder website satker di penjaga integritas (baca saja) |
| 3 | C Jejak & saksi | `fitur/saksi-ke-bas-sipp` | Rilis ekstensi; kirim saksi ke BAS SIPP tetap mati |
| 4 | D Blangko | `fitur/isian-per-sidang` | Rilis ekstensi |
| 5 | A Cermin | `fitur/kabar-perubahan` | Pasang dengan saklar mati. Malam pertama pemindaian awal (18.00–06.30), pantau di Pemantau Cermin. Sesudah 100% dan pencocokan bersih, Super Admin menyalakan per layar: Mediasi → Status Perkara → Jadwal Sidang → panel ekstensi |
| 6 | B Ekstensi & PC tua | `fitur/ejaan-nama-pihak` | Rilis ekstensi; ukur ulang memori Chrome di PC tua |
| 7 | G Tenggat & berkas e-Court | `fitur/ecourt-kesimpulan-bukti` | Verifikasi dasar hukum tiap aturan tenggat bersama Derry sebelum pengingat WA dinyalakan; jalankan skrip ukur ketepatan kesimpulan/daftar bukti pada berkas e-Court sungguhan (hasil angka saja); rilis ekstensi |

Untuk setiap rantai:
1. Baca laporannya, lalu merge ke cabang integrasi berikutnya, misalnya `integrasi-1205-40`.
2. Jurnal migrasi diurutkan menurut nomor berkas. Pembagian nomor ada di `rantai-upgrade-24okt.md`.
3. `tsc`, lint, uji penuh sekali, `rilis-ekstensi` bila ekstensi berubah, lalu pasang.
4. Semua saklar baru tetap mati sampai Derry menyalakannya.
5. Uji beban K9 diulang sesudah rantai A dan B.

Sesudah semua rantai digabung, sisanya:
- **K11** (pecah `konten.js`, persempit `matches`), dikerjakan paling akhir;
- **K4/K5/SSE**, diputuskan dari hasil uji beban (TAHAPAN, keputusan 8).

## Bagian 5 — Pengamanan website satker dan server (isu judol, surat Dirjen)

Website satker dihosting di server kantor. Belum ada laporan terkena, jadi ini pencegahan. **Kerjakan audit (5a) dulu, lalu laporkan ke Derry. Ubahan 5b hanya sesudah Derry setuju, satu per satu.** Sebelum setiap ubahan: cadangkan berkas konfigurasi, jalankan `apachectl configtest`, lalu `reload` (bukan restart) di luar jam kerja.

**5a. Audit, hanya membaca:**
- Daftar vhost Apache dan alamat dengarnya. Cari tahu apakah website satker satu mesin/satu Apache dengan SIPP, ABT, dan ALETA.
- `ss -tlnp`: port yang terbuka.
- `bind-address` MySQL/MariaDB SIPP dan ABT.
- Port forwarding di router: hanya 80/443 website yang boleh menghadap internet. Ditanyakan ke Derry/pengelola jaringan.
- Di folder website:
  - berkas `.php` yang berubah 30 hari terakhir;
  - `.php` di folder unggahan;
  - pola `eval(base64_decode`, `assert(`, `gzinflate`;
  - kata judol (slot, gacor, togel, maxwin) di berkas dan halaman;
  - akun admin CMS yang tidak dikenal;
  - versi CMS dan plugin.
- Laporkan temuan tanpa menyalin isi berkas mencurigakan ke repo/cloud.

**5b. Pengerasan, sesudah Derry setuju:**
1. Vhost SIPP, ABT, dan ALETA hanya menerima subnet kantor (`Require ip 192.168.0.0/16` atau subnet nyata).
2. Website:
   - eksekusi PHP dimatikan di folder unggahan;
   - daftar isi folder dimatikan;
   - pool PHP-FPM dan pengguna sistem sendiri dengan `open_basedir`, supaya website tidak bisa membaca berkas SIPP/ABT/ALETA;
   - akun basis data sendiri yang hanya berhak atas basis datanya;
   - folder web tidak dapat ditulis oleh proses web, kecuali folder unggahan.
3. ModSecurity + OWASP CRS untuk vhost website: **DetectionOnly** seminggu, periksa log, baru **On**.
4. fail2ban untuk percobaan masuk admin CMS.
5. Cloudflare untuk domain website, bila Derry memegang DNS:
   - proxy DNS + WAF gratis;
   - Apache website hanya menerima IP Cloudflare.

   SIPP, ABT, dan ALETA **tidak** dimasukkan Cloudflare.
6. Cadangan website di luar server, dengan uji pulih.
7. Ideal jangka menengah: website dipindah ke kontainer/VM terpisah dari SIPP/ABT/ALETA.

## Bagian 6 — Keamanan tambahan menuju skor 85–90 (keputusan Derry 24 Okt)

Dikerjakan di **laptop**, bukan oleh rantai cloud. Ketentuannya:
- satu butir satu cabang `fitur/<nama>` dari `integrasi-1205-39`;
- aturan bersama di `docs/awan/rantai-upgrade-24okt.md` berlaku: saklar mati bawaan, uji sasaran + `tsc` + lint, push tiap commit hijau, tanpa naik versi;
- nomor migrasi cadangan untuk laptop: **0107, 0108, 0109**;
- cloud rantai E sejajar mengerjakan OTP/authenticator (E5) dan penjaga integritas (E6), jadi jangan menyentuh berkas inti E5 kecuali butir 6c di bawah.

**Urutan butir Bagian 6** (dikerjakan sesudah 1.205.39 terpasang dan rantai A selesai, atau saat Derry meminta): 6a → 6b → 6c → 6d → 5b → 6e → 6f.

| Urut | Cabang | Butir | Bawaan sesudah dipasang |
| :--- | :--- | :--- | :--- |
| 6a | `fitur/kebijakan-sandi` | Admin 8 dengan **saklar "Kebijakan sandi" di Pengaturan admin, MATI bawaan** (keputusan Derry 24 Okt). Selama mati, aturan sandi persis seperti sekarang. Bila dinyalakan, aturannya dapat diatur Super Admin, bukan dipatok: panjang minimal (bawaan = panjang sekarang), tolak sandi umum/nama/NIP/username, campuran huruf-angka, larang pakai ulang N sandi terakhir, masa berlaku opsional, "paksa ganti saat masuk berikutnya" per akun, dan daftar akun yang belum memenuhi. Hanya berlaku untuk sandi baru/diganti. Migrasi 0107 bila perlu riwayat sandi (hash saja). | Mati |
| 6b | `fitur/batas-jaringan-peran` | Admin 12: daftar subnet kantor (mis. 192.168.10.0/24, 192.168.9.0/24) dan aturan per peran: mana pun / kantor saja / luar kantor wajib verifikasi (menyambung E5 bila sudah digabung). IP dibaca dari ujung XFF (`alamatIpPeramban`). Penolakan tercatat di Riwayat Masuk. Migrasi 0108. | Semua peran "mana pun", sehingga perilakunya sama dengan sekarang |
| 6c | `fitur/pengaman-aksi-admin` | Admin 13: aksi berdampak besar meminta **sandi ulang + ketik konfirmasi**. Contoh aksi: hapus massal >20 baris, pulihkan cadangan, ubah hak peran, angkat Admin/Super Admin, matikan audit/ubah retensi, Lihat sebagai, ubah batas perangkat/jaringan, nyalakan OTP. Kode WhatsApp/authenticator ditambahkan sebagai langkah kedua sesudah E5 digabung (kait disiapkan). Semua tercatat `appendAuditLog`. | Mati; dinyalakan Super Admin |
| 6d | `fitur/uji-pulih-cadangan` | Admin 4: mingguan (saran Minggu 03.00, sesudah pencocokan Cermin 02.00). Cadangan terbaru dipulihkan ke basis data sementara, migrasi diperiksa, jumlah baris tabel penting dicocokkan, basis data sementara dihapus, lalu laporan ke Pusat kesehatan + WhatsApp admin bila gagal. Tidak pernah menyentuh basis data produksi. Migrasi 0109 (hasil uji). | Mati |
| 6e | — (jaringan, tanpa ubah kode) | **Tanpa HTTPS** (keputusan Derry 24 Okt: tetap http supaya fitur yang sudah jalan tidak terganggu). Penggantinya untuk mencegah penyadapan di jaringan kantor:<br>1. Pastikan ALETA/SIPP/ABT tidak dapat dibuka dari internet (hasil audit 5a). Akses dari luar hanya lewat VPN.<br>2. Wi-Fi tamu/pengunjung terpisah dari jaringan server; PC kantor memakai kabel atau Wi-Fi khusus pegawai (ditanyakan ke pengelola jaringan).<br>3. Jangan ubah kuki/sesi ke `SameSite=Strict` atau `Secure`: ekstensi di halaman SIPP memanggil ALETA dan bisa berhenti bekerja.<br>Passkey di E5 tidak aktif selama http; OTP WhatsApp dan authenticator tetap berfungsi. | Tidak ada perubahan perilaku |
| 6f | — (server) | **Pindahkan website satker ke kontainer/VM terpisah** dari SIPP/ABT/ALETA. Dikerjakan sesudah 5b terbukti stabil. Rancang dulu, lalu minta persetujuan Derry: berkas dan DB website disalin, Apache depan meneruskan domain website ke kontainer, uji, lalu pindah pada jendela pemeliharaan. Cadangan lama disimpan sampai seminggu stabil. | — |

Sesudah tiap butir: perbarui papan kemajuan, catat skor keamanan perkiraan per bidang (lihat percakapan 24 Okt: sekarang ±45, sasaran 85–90), dan laporkan ke Derry.

## Bagian 7 — Kerjakan rantai upgrade A–G di laptop (keputusan Derry 24 Okt)

Kartu kerja: `git show origin/fitur/rencana-upgrade-otomatisasi:docs/awan/rantai-upgrade-24okt.md`. Isi tiap cabang, nomor migrasi cadangan, dan aturan bersama 1–10 ada di sana.

**Aturan di laptop:**
- **Dasar:** `integrasi-1205-39`, sesudah Bagian 1–3. Cabang di dalam satu rantai bertumpuk.
- **Kartu menyebut "sesi awan":** baca sebagai "sesi laptop", lalu tambahkan aturan laptop `CLAUDE.md`: drive D:/C:, papan kemajuan, `periksa-uji` untuk uji penuh.
- **Model per `CLAUDE.md`:**
  - Sonnet 5.5 effort medium untuk fitur harian;
  - Sonnet effort **high** untuk kode yang menulis ke SIPP/ABT (C1, C6, D, G2);
  - Opus untuk aturan hukum (G1 dasar tenggat, D4 huruf alasan).
- **Satu rantai per sesi.** Jalankan `/clear` di antara rantai supaya konteks dan kuota hemat. Push tiap commit hijau.
- **Kuota habis di tengah rantai:** commit WIP, push, lalu lanjut di sesi berikut dari cabang terakhir. Sebelum memulai, cek `git ls-remote origin "fitur/*"` supaya tidak mengerjakan ulang.
- **Saklar:** semua saklar baru mati bawaan.
- **Laporan:** `docs/awan/laporan-rantai-<huruf>.md`.

**Urutan kerja yang disarankan:**

| Urut | Rantai | Isi singkat | Catatan |
| :--- | :--- | :--- | :--- |
| 1 | A Cermin Perkara (A1–A8) | Singgahan jadwal, Cermin Perkara + pemindai + pemantau, Jadwal Sidang/Mediasi/Status/panel SIPP membaca cermin, tabel ringan, kabar perubahan | Dampak terbesar untuk 100+ perangkat |
| 2 | C Jejak & saksi (C1–C6) | Jejak isian + Urungkan, katalog saksi per jenis lalu ke basis data, mesin saksi tunggal, non-cerai, saksi ke BAS SIPP | C1 dulu, karena D memakai tabelnya |
| 3 | E Ukur & admin (E1–E6) | Uji beban, Pusat kesehatan + galat, mode pemeliharaan, Lihat sebagai, OTP WA + authenticator (mati), penjaga integritas berkas | Uji beban hanya ke kembaran laptop |
| 4 | F Server (F1–F3) | Kolam SIPP terpisah, port 8008, riwayat tunda/putus | Butuh angka `max_connections` dari Bagian 3 |
| 5 | B Ekstensi & PC tua (B1–B6) | Satu pengamat, mode ringan, data peramban ke DB, berkas di server, konteks lintas PC, ejaan nama | Regresi ekstensi paling mungkin di sini; uji berat |
| 6 | D Blangko (D1–D6) | Ketepatan isian, tutup isian manual, wajib sebelum CETAK, huruf alasan, sebutan pihak, isian per sidang | Dasar `fitur/jejak-isian` |
| 7 | G Tenggat & e-Court (G1–G2) | Penjaga tenggat terjadwal + banding/kasasi/mediasi + pengingat per orang; kesimpulan dan daftar bukti e-Court ke ABT | Dasar ujung rantai A |
| 8 | K11 | Pecah `konten.js`, persempit `matches` | Paling akhir, sesudah semua rantai digabung |

**Ditunda:** K4/K5/SSE, diputuskan dari hasil uji beban.

## Laporan akhir ke Derry
- cabang dan commit gabungan;
- bentrok dan cara menyelesaikannya;
- angka `periksa-uji`;
- versi rilis dan hasil pemasangan;
- isi `ukuran-server.md`;
- rantai yang sudah dan belum digabung.
