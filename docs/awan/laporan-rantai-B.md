# Laporan rantai B - Ekstensi dan PC tua (25 Okt 2026)

Dikerjakan oleh agen RB di laptop (worktree `D:/aleta-dev/wt/w75`), dasar `integrasi-1205-39` (c70ca746). Enam cabang bertumpuk, semua sudah didorong ke `origin`.
Tidak ada versi yang dinaikkan, tidak ada yang dipasang, tidak ada yang digabung ke `main`/`integrasi-*`, server 192.168.10.10 tidak dijangkau.

## 1. Cabang dan commit ujung

| Urut | Cabang | Commit | Butir |
| :--- | :--- | :--- | :--- |
| B1 | `fitur/pengamat-tunggal` | `c577bfb7` | K12 |
| B2 | `fitur/mode-ringan` | `6f01c4ea` | K16 |
| B3 | `fitur/data-peramban-ke-db` | `d1e5e7fd` | K15 |
| B4 | `fitur/berkas-di-server` | `9e9d24ec` | K14 |
| B5 | `fitur/konteks-server` | `2b8b6107` | U16 |
| B6 | `fitur/ejaan-nama-pihak` | lihat `git log` cabang ini (commit laporan menyusul commit `8b16a679`) | U18 |

Ujung rantai = cabang B6. Laporan ini ada di cabang B6.

## 2. Saklar baru (semua MATI bawaan)

Semuanya disimpan di `aleta_ekstensi_setelan` (pengguna `*sistem*`, kunci `sistem:kinerja-ekstensi`, tanpa migrasi), diubah HANYA Super Admin
lewat kartu "Kinerja untuk PC tua" di halaman Integrasi e-Court (jangkar `#kinerja-ekstensi`, `GET/PUT /api/aleta-ecourt/ekstensi/kinerja`,
tercatat di audit `UPDATE_KINERJA_EKSTENSI`), dan dikirim ke ekstensi lewat ruas `kinerja` pada `GET /ekstensi/tampilan`
(disinggahkan panel-alat.js di `chrome.storage.local.tampilanServer`, paling lambat 5 menit sampai ke tab yang terbuka).

| Saklar | Efek bila menyala | Mati = |
| :--- | :--- | :--- |
| `pengamatTunggal` (B1) | satu MutationObserver untuk 14 pengamat badan-halaman; pewaktu 0,25-1,5 detik jadi kejadian DOM + denyut cadangan; pewaktu berhenti di tab tersembunyi; satu tab per PC menanyakan giliran putusan terjadwal | `MutationObserver` / `setInterval` asli dengan argumen semula |
| `modeRinganOtomatis` (B2) | `deviceMemory <= 4` atau `hardwareConcurrency <= 2` otomatis mematikan hiasan ALETA (animasi/transisi/kabur) dan memperlambat pewaktu dua kali, di ekstensi dan portal | tidak ada yang berubah |
| `antreanDiServer` (B3) | keadaan antrean cetak massal, relaas massal, dan catatan putusan terjadwal disalin ke Postgres dan ditawarkan lagi (tidak dijalankan sendiri) | tidak ada satu permintaan pun |
| `berkasDiServer` (B4) | cetak massal (ZIP RTF / PDF gabungan tanpa tanda tangan sah) dan pemeriksa sisa blangko RTF besar (>= 150 KB) dikerjakan server | jalur lama di peramban |
| `konteksDiServer` (B5) | perkara terakhir di SIPP dan versi ekstensi tiap PC disalin per pengguna; popup memperingatkan versi PC lain yang berbeda | hanya lokal |
| `ejaanNamaPihak` (B6) | pemeriksa ejaan/nama pihak + kamus alias (formulir pihak SIPP, penguji portal, penyamaran ALETA Ai) | tidak ada pemeriksaan, kamus tidak dipakai |

Pengaturan per pengguna: mode ringan punya pilihan **Otomatis (bawaan) / Nyala / Mati** per PC (popup ekstensi, kunci `chrome.storage.local.modeRingan`;
portal: tombol kecil di samping tema, `localStorage aleta-mode-ringan`, tombol hanya tampil bila saklar menyala atau pengguna sudah memilih).
Pilihan Nyala/Mati selalu menang atas deteksi dan atas saklar Super Admin (satu aturan, dijaga uji kembar lib TS = ekstensi JS atas semua kombinasi).

## 3. Migrasi

| Berkas | idx jurnal di cabang ini | Isi |
| :--- | :--- | :--- |
| `0098_aleta_antrean_peramban` (B3) | 81 | `aleta_antrean_peramban` (PK pengguna+jenis+kunci), muatan hanya keadaan pengerjaan |
| `0099` | tidak dipakai | B4 (K14) sengaja TANPA tabel: pekerjaan berkas hidup di memori proses server (lihat butir 6) |
| `0100_aleta_alias_nama` (B6) | 82 | `aleta_alias_nama` (nama baku + varian), indeks unik |

Tiap migrasi: SQL + `_journal.json` + DDL `schema.ts` + daftar `client.ts`; uji `tabel-cadangan-terdaftar` hijau. **Jurnal harus dirapikan saat gabung**:
cabang rantai lain memakai idx 81+ juga (uji menuntut idx berurutan tanpa lubang), jadi tag 0098/0100 perlu diberi idx baru oleh sesi utama.
B5 (U16) tidak butuh migrasi (dua kunci baru di `aleta_ekstensi_setelan`: `konteks.perkara`, `perangkat.versi`).

## 4. Yang dikerjakan per cabang (ringkas)

- **B1 K12** - `pengamat-bersama.js` (dimuat paling depan di tiga kelompok skrip konten): kelas `Pengamat` pengganti langsung `MutationObserver`,
  `interval()/denyut()/hapus()` pengganti `setInterval/clearInterval`, `pemimpin()` (lewat pekerja latar, sewa disimpan di `chrome.storage.session`,
  tab terlihat boleh merebut dari tab tersembunyi, dilepas saat tab ditutup), `sibuk()` (selama pekerjaan otomatis berjalan tidak ada yang ditahan).
  Pelanggan dipindahkan di tempat bila saklar berubah (tanpa memuat ulang tab). 14 pengamat badan-halaman, ±22 pewaktu, dan polling putusan terjadwal dialihkan.
  Putusan terjadwal: pewaktu 30 dtk tetap berdetak di tab tersembunyi (`tetap`), tetapi hanya tab pemimpin yang bertanya ke portal; klaim di portal tetap atomik.
- **B2 K16** - `mode-ringan.js` (+ `popup-ringan.js`, `src/lib/mode-ringan.ts`, `components/layout/mode-ringan.tsx`, blok `globals.css`).
- **B3 K15** - `antrean-server.js` + `/ekstensi/antrean` (GET/PUT/POST, milik pemanggil). Cetak massal: keadaan per perkara disalin; antrean terputus untuk
  jenis+tanggal yang sama mencentang kembali perkara yang belum selesai (petugas menekan Cetak sendiri). Relaas massal (latar.js): putaran disalin; tombol
  Pulihkan di panel juru sita memulihkannya sebagai putaran TERTAHAN. Putusan terjadwal: catatan disalin; catatan server baru dipulihkan bila >= 10 menit tak berubah,
  lewat alur catatan terputus yang sudah ada (dikembalikan ke antrean, tidak diulang diam-diam). Retensi: jalan 14 hari, selesai 2 hari.
- **B4 K14** - `berkas-server.js` + `/berkas-server` + `/berkas-server/periksa-sisa`. Naskah RTF dikirim satu per satu, server memeriksa sisa blangko, mengubah ke PDF lewat bot,
  menggabung/ZIP; hasil menunggu di server; jendela Cetak massal menampilkan "Hasil yang sudah disusun di server" (Unduh/Hapus). Gagal di titik mana pun = jalur lama
  dari naskah yang masih dipegang peramban. PDF dengan tanda tangan sah dicentang tetap jalur lama (gambar tanda tangan tidak dikirim). Hanya blangko Derry (jendela
  Cetak massal Derry).
- **B5 U16** - `konteks-server.js` (`riwayatPerkaraSipp` digabung dengan salinan server: satu entri per nomor, 12 di server, 8 per PC; `perangkat.versi`), `popup-versi-pc.js`.
- **B6 U18** - `src/lib/ejaan-nama.ts` (aturan), `alias-nama.ts` + rute `/alias-nama` (Admin/Super Admin) dan `/alias-nama/periksa`, kartu "Kamus alias nama pihak",
  `ejaan-nama.js` (satu baris usulan di bawah `#pihak_fullname` + tombol "Salin ejaan baku"), `Penyamar.pakaiAlias` (satu orang = satu kode samaran).

## 5. Uji

Uji sasaran baru `-25okt` (perilaku nyata: jsdom, pg-mem, rute, `vm` dengan chrome tiruan):

| Berkas | Isi |
| :--- | :--- |
| `ekstensi-pengamat-tunggal-25okt` (17) | satu MO untuk 10 pelanggan, catatan milik sendiri, hasil sama dengan mode lama, tab tersembunyi, sibuk, perpindahan saklar langsung, pemimpin satu tab |
| `ekstensi-pengamat-putusan-terjadwal-25okt` (6) | pelaksana putusan terjadwal: bukan pemimpin = tidak bertanya, paksa, gagal-aman, tab tersembunyi |
| `kinerja-ekstensi-25okt` | rute saklar: hak Super Admin, audit, ruas `kinerja` di `/ekstensi/tampilan`, versi tampilan tidak bergeser |
| `ekstensi-mode-ringan-25okt` (13) + `mode-ringan-portal-25okt` (7) | aturan kembar semua kombinasi, atribut/gaya hanya elemen ALETA, pewaktu benar-benar lebih jarang, pilihan menang, berubah langsung |
| `antrean-peramban-25okt` | migrasi 0098, saklar mati/menyala, milik pemanggil, sapu antrean basi, batas |
| `ekstensi-antrean-server-25okt` | klien antrean, catatan putusan terjadwal (salin, pulihkan >= 10 menit, lokal menang), relaas (muatan, pemeriksaan bentuk pemulihan) |
| `blangko-derry-cetak-massal-20okt` bagian I dan J (13 baru) | antrean cetak massal terputus; server menyusun ZIP/PDF; semua jalur cadangan |
| `berkas-pekerjaan-25okt` + `ekstensi-berkas-server-25okt` | pekerjaan berkas (milik sendiri, batas, kedaluwarsa, PDF gabungan, konversi gagal), klien, pemeriksa sisa server vs lokal |
| `konteks-server-25okt` + `ekstensi-konteks-server-25okt` | normalisasi dua kunci, saklar 409, penjaga dua-PC, penggabungan, laporan versi, popup |
| `ejaan-nama-25okt` + `alias-nama-25okt` + `ekstensi-ejaan-nama-25okt` | aturan ejaan, kamus (hak, audit tanpa nama, dedupe), pemeriksa, penyamaran, formulir pihak SIPP |

Regresi sasaran per cabang: tsc bersih di setiap cabang; eslint bersih atas berkas yang saya tambah/ubah; `npm run lint:jangan-bertambah` melaporkan entri "BARU" yang
SAMA dengan dasar (tidak satu pun berkas saya di dalamnya).
Kegagalan yang tidak berasal dari perubahan saya (diperiksa satu per satu, hijau bila dijalankan sendirian atau sudah merah di dasar):
- `aleta-ai-dompet-25okt` (urutan mutasi 'tahan'/'isi' pada rekonsiliasi): merah juga di `integrasi-1205-39` murni (w33).
- `tema-ecourt-23okt` > `manifest.version` menuntut 1.205.38: merah di dasar (manifest 1.205.39).
- `ekstensi-versi-tanam`, `aleta-ai-gelembung-23okt`, `cetak-relaas-antrian`, `deteksi-sisa-blangko-17okt`/`ekstensi-abt-tahap6`/`ekstensi-portal-tahap4` (satu butir): habis waktu / "Timeout calling fetch ekstensi-berkas.ts"
  hanya saat banyak proses uji berjalan bersamaan (berkas tertanam kini ±17 MB); hijau bila dijalankan sendirian.
- `aleta-ai-tugas-25okt` (pelaksana Python sungguhan): lingkungan laptop.

HASIL UJI PENUH: lihat bagian 8 (diisi sesudah dijalankan).

## 6. Keputusan yang saya ambil (pilihan paling aman, mohon ditinjau)

1. **Pekerjaan berkas (K14) hanya di memori server, tanpa tabel dan tanpa disk.** Isi naskah memuat nama, alamat, NIK; rute `abt/pdf` dan `pdf-gabung` selama ini
   "menerima, mengolah, memulangkan, lupa". Pekerjaan hidup paling lama 2 jam sesudah selesai (30 menit bila tak pernah dimulai), maks 3 pekerjaan aktif per pengguna,
   60 naskah / 48 MB. Konsekuensi: **mulai ulang portal melupakan hasil** (peramban lalu memakai jalur lama). Bila Derry ingin hasil bertahan melewati mulai ulang,
   perlu keputusan menyimpan di disk server (terenkripsi) - belum saya lakukan. Karena itu migrasi 0099 tidak dipakai.
2. **PDF bertanda tangan sah tetap jalur lama** (gambar tanda tangan/cap tidak dikirim ke server pekerjaan).
3. **Putusan terjadwal tetap berdetak di tab tersembunyi** (opsi `tetap`) agar jadwal tidak terlewat karena tab di belakang; penghematan datang dari "satu tab per PC".
4. **Antrean putusan massal SIPP** sudah bertahan di `chrome.storage.local` sejak dulu, jadi tidak disalin ke server; yang disalin hanya yang memang hilang saat Chrome
   ditutup (cetak massal di memori, relaas di `chrome.storage.session`).
5. **"Konteks perkara" (U16)** saya wujudkan sebagai perkara terakhir lintas PC + versi ekstensi per PC. Hasil bacaan SIPP (`simpananKonteks`, cadangan saat portal mati)
   TIDAK disalin ke server: isinya data perkara dan cadangan itu justru untuk saat portal/server mati. Riwayat Urungkan bukan milik rantai ini (C/U6).
6. **K15 "tampilan per pengguna"**: tampilan sudah tersimpan per pengguna di `aleta_ekstensi_setelan` (`widget.tata`, `panel.bawaan`, `pengaturan.ekstensi`) dan ikut GET tampilan; tidak ada yang baru.
7. **B6 hanya usulan**: yang dibangun adalah pemeriksa di formulir pihak SIPP (nama yang diketik dicocokkan ke kamus) dan penguji di portal. Perbandingan otomatis nama
   SIPP vs blangko ABT vs BAS pada satu perkara BELUM dihubungkan ke halaman perkara (butuh sumber nama dari ABT/BAS per perkara); API `/alias-nama/periksa` sudah menerima
   daftar `{asal, nama}` sehingga pemanggil berikutnya tinggal mengirim nama dari sumber-sumber itu.
8. `modeRinganOtomatis`: bagian "memuat modul seperlunya" dari K16 TIDAK dikerjakan di rantai ini (memuat modul hanya dapat dipersempit lewat K10/K11 - katalog saksi sebagian dan
   pecah `konten.js`). Yang dikerjakan: hiasan dimatikan, pewaktu diperlambat.

## 7. Langkah laptop/server sesudah gabung

1. Gabung berurutan B1 -> B6, rapikan `_journal.json` (idx 0098 dan 0100) dan jalankan `ALETA_TANAM_PAKSA=1 node scripts/susun-ekstensi.mjs` (berkas ekstensi baru:
   `pengamat-bersama.js`, `mode-ringan.js`, `popup-ringan.js`, `antrean-server.js`, `berkas-server.js`, `konteks-server.js`, `popup-versi-pc.js`, `ejaan-nama.js`);
   naikkan versi ekstensi/portal sekali, uji penuh, rilis dengan skill `rilis-ekstensi`.
2. Server: migrasi 0098 dan 0100 butuh `ALETA_RUN_DB_MIGRATIONS=1` (bukan lewat jalur diam). Mulai ulang bot TIDAK diperlukan; portal diperbarui seperti biasa.
3. **Ukur di PC tua kantor sebelum menyalakan saklar** (semua mati bawaan): buka Pengelola Tugas Chrome pada tab SIPP/ABT dengan saklar mati lalu menyala; catat memori tab,
   CPU latar tab tersembunyi (sasaran: mendekati nol), dan ukuran JS ABT. Urutan saran menyalakan: `pengamatTunggal` -> `modeRinganOtomatis` -> `antreanDiServer` ->
   `berkasDiServer` -> `konteksDiServer` -> `ejaanNamaPihak`. Tiap saklar sampai ke tab yang terbuka paling lambat 5 menit.
4. `berkasDiServer`: uji sekali cetak massal PDF 40 perkara di kembaran (bot + LibreOffice), pantau memori proses portal.
5. `ejaanNamaPihak`: isi kamus awal dari kartu "Kamus alias nama pihak" (Admin/Super Admin).

## 8. Uji penuh

(diisi di bawah setelah dijalankan)

## 9. Pertanyaan terbuka (tidak menghentikan pekerjaan; pilihan aman sudah diambil)

1. Hasil pekerjaan berkas (K14) bertahan melewati mulai ulang portal? (saat ini tidak; butir 6.1)
2. Boleh kamus alias (B6) diisi otomatis dari pasangan nama yang dikonfirmasi petugas di pemeriksa? (kolom `sumber` sudah menyiapkan nilai `usulan`; belum ada tombolnya)
3. Perlu tombol "Periksa ejaan nama perkara ini" di halaman perkara SIPP yang membandingkan nama SIPP, blangko ABT, dan BAS sekaligus? (butir 6.7)
4. Retensi antrean peramban: 14 hari (jalan) / 2 hari (selesai) cukup?
