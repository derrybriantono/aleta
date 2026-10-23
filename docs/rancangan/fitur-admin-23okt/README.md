# Rencana fitur admin (23 Okt 2026)

Usulan fitur admin yang belum ada di ALETA, disusun sesudah menelusuri 24 menu admin yang sudah ada (`manajemen_surat/src/app/(portal)/admin/`). Pengguna menyetujui rencana ini dan meminta disimpan. **Belum ada yang dikerjakan**; dikerjakan bertahap, satu fitur per sesi, sesuai pilihan pengguna.

- **Tampilan contoh (mockup) 15 layar:** https://claude.ai/artifact/1zvgkn9pxggeDmYLaB3mSi. Hanya dapat dibuka pemiliknya sampai dibagikan dari menu Share. Data di dalamnya rekaan.
- Gaya mengikuti portal: tema gelap/terang, judul serif, `bg-card`, tanpa label teknis bagi pengguna.
- Super Admin tetap tidak terbatas aksesnya. Fitur 13 hanya meminta bukti identitas untuk aksi berdampak besar, bukan membatasi.

Sudah dikerjakan terpisah dan **tidak** termasuk daftar ini: Riwayat Masuk & Perangkat + batas perangkat per peran/akun (cabang `fitur/audit-login-perangkat`, migrasi 0085), dan Pasang di HP (`fitur/pwa-pasang`).

## Prioritas tinggi (saran urutan kerja: 1, 2+3, 5, 6, 4)

| No | Fitur | Isi | Menyambung ke |
| :--- | :--- | :--- | :--- |
| 1 | **Lihat sebagai pengguna/peran** | Super Admin membuka ALETA seperti yang dilihat akun atau peran lain, baca-saja, dengan pita kuning dan alasan wajib. Batas 30 menit, tercatat di audit, dan pemilik akun melihat catatan "dilihat oleh Super Admin". Menjelaskan **kenapa** sebuah menu tersembunyi: saklar Akses Tampilan per Peran, atau aksi di matriks hak. | `src/lib/matriks-peran.ts` (`golonganPengguna`, `bolehAksi`), `admin/visibility-role`, `resolveActorUserId` (`src/server/shared/auth.ts`) |
| 2 | **Pusat kesehatan sistem** | Status portal, bot, database ALETA, SIPP, ABT, e-Court, WhatsApp, cadangan; disk/memori/prosesor; versi ekstensi per PC; jumlah galat. Pemeriksaan tiap menit, dan WhatsApp ke admin bila merah. | `admin/sumber-daya`, `admin/status-whatsapp`, `admin/backup`, `scripts/aleta-sumber-daya-docker.sh`, data versi ekstensi dari panel |
| 3 | **Catatan galat** | Galat server, peramban, dan ekstensi, dikelompokkan per jenis dengan jumlah kejadian. Rincian: halaman, akun, peramban, versi, potongan stack. Tandai ditangani, salin untuk pengembang. Retensi 90 hari. | Penangkap galat klien baru (window.onerror/unhandledrejection) + `handleRouteError` (`src/server/shared/http.ts`) |
| 4 | **Uji pulih cadangan** | Mingguan: pulihkan cadangan ke database sementara, cek migrasi, cocokkan jumlah baris per tabel penting, hapus, lalu laporkan. Selisih yang lebih tua dari waktu cadangan ditandai merah. | `admin/backup`, `admin/sinkron-cadangan`, `src/server/db/client.ts` |
| 5 | **Mode pemeliharaan portal** | Saklar plus pesan dan jadwal. Super Admin tetap masuk (Admin opsional), layar antrean dan jadwal publik boleh tetap tampil. Pemberitahuan WhatsApp ke admin 15 menit sebelumnya. Halaman memuat ulang sendiri saat selesai. | `src/proxy.ts` (penjaga), pola mode pemeliharaan bot `src/app/api/admin/aleta-bot/maintenance/route.ts` |
| 6 | **Verifikasi dua langkah (OTP WhatsApp)** | Aturan per peran: setiap masuk / perangkat baru saja / dari luar jaringan kantor / tidak diminta. "Percayai perangkat 30 hari". Kode cadangan dari admin. | OTP lupa sandi (`src/server/modules/users/service.ts`, tabel `verifications`), kuki perangkat dan tiket dari `fitur/audit-login-perangkat` |

## Prioritas menengah

| No | Fitur | Isi | Menyambung ke |
| :--- | :--- | :--- | :--- |
| 7 | **Pengumuman ke pengguna** | Pita atas, pop-up wajib dibaca, dan/atau WhatsApp. Sasaran per peran/akun, jadwal tampil, dan siapa yang sudah membaca. Tampil di portal dan panel ekstensi. | Pola pengumuman yang ada di layar antrean/jadwal, gateway WhatsApp bot |
| 8 | **Kebijakan sandi** | Panjang minimal (sekarang 6, disarankan 10), tolak sandi umum/nama/NIP, campuran huruf-angka, masa berlaku opsional, larang pakai ulang, paksa ganti saat masuk berikutnya, dan daftar akun yang belum memenuhi. | `src/lib/auth.ts` (`emailAndPassword`), `src/server/modules/users/service.ts` |
| 9 | **Impor & ekspor akun massal** | Blangko Excel/CSV. Pratinjau per baris (baru/diubah/nonaktif/bermasalah); sandi awal lewat WhatsApp, wajib diganti; baris bermasalah dilewati. | `admin/mapping-user-jabatan`, `src/app/api/users/route.ts` |
| 10 | **Plt & delegasi terjadwal** | Hak akun A ke akun B dengan tanggal mulai/berakhir otomatis, pilihan hak yang dipindah, dasar SK, dan linimasa. Pita "Anda bertindak sebagai Plt"; surat mencantumkan "Plt.". | Periksa dulu `admin/..`/`penugasan` dan `acting-assignments` yang sudah ada (`golonganPengguna(..., acting)`); mungkin sebagian sudah ada |
| 11 | **Daftar tugas terjadwal** | Semua pekerjaan otomatis portal dan bot: jadwal, hasil terakhir, lama, grafik 10 jalan terakhir, tombol "Jalankan". Gagal 2× berturut-turut → WhatsApp + merah di fitur 2. | Penjadwal di bot (tarik e-Court, sinkron kembaran, pengingat), cadangan, `tunda-otomatis` |
| 12 | **Pembatasan jaringan per peran** | Daftar subnet kantor (mis. 192.168.10.0/24, 192.168.9.0/24) dan aturan per peran: mana pun / jaringan kantor saja / luar kantor wajib OTP. Penolakan tercatat di Riwayat Masuk. | Pemeriksa IP pribadi `periksaTautan` (`src/server/modules/tautan-jadwal/service.ts`), IP dari ujung XFF (`alamatIpPeramban`), kait sesi dari fitur audit login |

## Untuk Super Admin

| No | Fitur | Isi | Menyambung ke |
| :--- | :--- | :--- | :--- |
| 13 | **Pengaman aksi Super Admin** | Aksi berdampak besar meminta sandi ulang atau sandi + kode WhatsApp, plus ketik konfirmasi. Contoh: hapus massal >20 baris, pulihkan cadangan, ubah hak peran, angkat Admin/Super Admin, matikan audit/ubah retensi, Lihat sebagai. Semua tercatat. | Fitur 6, `appendAuditLog` |
| 14 | **Laporan pemakaian** | Akun aktif, pengguna per hari, persentase dari HP, fitur paling dan paling jarang dipakai, PC dengan ekstensi lama. Tanpa menghitung isi perkara. | Riwayat masuk (fitur audit login), catatan buka halaman baru yang ringan |
| 15 | **Pelindungan data pribadi (UU 27/2022)** | Ekspor semua data satu pegawai (ZIP), samarkan data pribadi pegawai keluar (surat dinas tetap utuh dengan nama tersamar), retensi per jenis data, dan daftar permintaan pegawai dengan persetujuan. Data perkara di SIPP tidak disentuh. | E-Kepegawaian, retensi riwayat masuk (fitur audit login) |

## Aturan saat mengerjakan
Ikuti `AWAN.md` (cloud) / `CLAUDE.md` (laptop):
- Satu fitur per cabang `fitur/<nama>`.
- Hak lewat `matriks-peran.ts` + penjaga rute API.
- Fitur lama tidak dikurangi.
- Migrasi memakai nomor bebas sesudah yang terpakai (0084 T1, 0085 audit login).
- Uji perilaku nyata.
- Bawaan aman: fitur yang bisa mengunci pengguna (5, 6, 8, 12) bawaannya MATI sampai dinyalakan Super Admin.
