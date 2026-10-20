# Penilaian beban penetapan (PMH, PPP, PJS) - 20 Okt 2026

Agen B1. Satu sumber angka untuk papan penunjukan di ekstensi DAN panel
"Penetapan Otomatis" di halaman SIPP: `aleta_bot/services/bebanPenetapanService.js`
(hitungan murni + pembaca SIPP baca-saja), dirakit di `penunjukanService.usulanPenunjukan`,
dibawa pada objek usulan (`usulan.statistik`, `usulan.kesesuaianSk`, `usulan.sk`), digambar
oleh `ekstensi-sipp/penunjukan-statistik.js` di kedua tempat. Tidak ada rumus di peramban.

## 1. Kenyataan yang ditemukan

- Pengaturan SK Majelis SUDAH ada (halaman "SK susunan majelis", `aleta_sipp_hari_sidang`,
  migrasi 0044/0045, nomor/tanggal SK bawaan di kartu Nomor SK). Tidak dibuat ulang. `ref_majelis_tetap`
  SIPP di PA Donggala tidak ada yang aktif, jadi susunan lain tetap diambil dari susunan yang terpakai tahun ini.
- Definisi kebendaan satu: `BOBOT_JENIS` bobot 2,0 (harta bersama 348, kewarisan 364, P3HP/ahli waris 371,
  wasiat 365, ekonomi syariah 370). Hibah, wakaf, sita/eksekusi belum punya id berbobot 2,0 di kode;
  bila diinginkan, tambahkan di `BOBOT_JENIS` (satu tempat) dan seluruh hitungan ikut.
- Giliran lama: juru sita dan panitera diurut menurut selisih dari bagian semestinya tahun berjalan;
  majelis (bila Smart Majelis SIPP belum jalan) menurut jumlah perkara; hakim tunggal menurut selisih.

## 2. Yang ditampilkan (butir 2)

Untuk tiap hakim, panitera pengganti (panitera sidang), juru sita, dan tiap majelis SK:

| Angka | Arti |
| :-- | :-- |
| Berjalan | perkara yang ditetapkan kepadanya dan belum diputus (`perkara.tahapan_terakhir_id < 15`), tahun berapa pun (paling jauh 3 tahun) |
| Tahun ini | penetapan tahun berjalan |
| 30 hari (bagian) | penetapan 30 hari terakhir (hari ini + 29 hari sebelumnya), bagiannya dalam persen atas seluruh penetapan 30 hari di perannya, dan rata-rata (100% dibagi jumlah orang aktif). Hakim: atas jumlah KURSI, sehingga rata-ratanya 1/N |
| Kebendaan 6 bln (bagian) | perkara kebendaan 6 bulan terakhir: jumlah, "x dari y" (y = seluruh kebendaan di perannya), dan persen |

Nomor SK (dan "berlaku mulai") tampil di judul blok; tanda kesesuaian SK untuk penetapan yang TERCATAT (atau usulan bila belum ada):
sesuai / tidak sesuai (ketua beda, PP bukan pendamping majelis itu, susunan di luar SK) / sebelum SK berlaku / hakim tunggal.
SK kosong: "Belum memakai SK - isi di Pengaturan SK Majelis" dan usulan tetap memakai susunan yang terpakai.

## 3. Brainstorming penilaian

Komponen yang dipertimbangkan:

1. **Perkara berjalan berbobot** - beban nyata saat ini (sidang yang harus dihadiri/dipanggil).
2. **Beban tahun berjalan berbobot** - keadilan jangka panjang (setahun berjalan harus sama).
3. **Penerimaan 30 hari** - keadilan jangka pendek; mencegah satu orang menerima tiga perkara beruntun walau totalnya rendah.
4. **Kebendaan 6 bulan** - kebendaan berat dan jarang; dibagi rata TERSENDIRI (jendela panjang karena jarang).
5. **Bobot jenis** - sudah ikut di (1)-(3): kebendaan 2,0; lainnya 1,5; cerai/itsbat 1,0.
6. **Hari sidang terdekat** - beban tanggal sudah ditampilkan di pilihan PHS (`phs.calon[].jumlahSidang`); tidak dimasukkan
   ke skor orang karena hari sidang milik majelis, bukan orang.
7. **Cuti / libur / mutasi** - ditangani sebagai KELAYAKAN, bukan skor: akun SIPP terblokir dan pegawai tidak aktif sudah
   dikeluarkan dari kolam (`petugasDiblokir`, `aktif='Y'`); "dugaan berhalangan" tetap peringatan; hari libur menggeser PHS.
   Data cuti tidak ada di SIPP; bila kelak ada, cukup menyaring kolam.
8. **Pegawai baru** - bagian semestinya dihitung menurut LAMA ikut dan rasio (seperti `bagianSemestinya`), supaya yang baru
   bertugas tidak dikejar beban setahun penuh ("hukuman karena datang terlambat").
9. **Ketua vs anggota** - ketua menanggung PHS dan putusan; dihitung separuh bobot di skor majelis.
10. **Majelis SK dinilai sejak SK berlaku** - susunan sebelum SK bukan majelis yang sama (lihat ukur di bawah).

### Skor (makin kecil = makin layak diusulkan lebih dulu)

Tiap komponen dinormalkan terhadap yang DIHARAPKAN bagi orang itu: nisbah = (nyata + 0,5) / (diharapkan + 0,5), dengan
diharapkan = total kelompok x (lama ikut x rasio) / jumlah seluruh lama ikut. Skor = 100 x jumlah(bobot komponen x nisbah).
1,00 x 100 berarti tepat sebanyak bagiannya.

| | berjalan | tahun | 30 hari | kebendaan 6 bln |
| :-- | --: | --: | --: | --: |
| Juru sita, perkara biasa | 0 | 0,60 | 0,30 | 0,10 |
| Juru sita, perkara kebendaan | 0 | 0,20 | 0,10 | 0,70 |
| Panitera pengganti, biasa | 0,10 | 0,50 | 0,30 | 0,10 |
| Panitera pengganti, kebendaan | 0,10 | 0,20 | 0 | 0,70 |
| Hakim (tunggal, anggota majelis), biasa | 0,20 | 0,40 | 0,30 | 0,10 |
| Hakim, kebendaan | 0,10 | 0,20 | 0 | 0,70 |

Majelis: 80% dari beban majelis itu sendiri (bobot yang sama, dinilai sejak SK berlaku, harapan = sama rata antar majelis SK),
20% dari skor anggotanya (ketua 50%, anggota lain berbagi 50%). Bobot ada di satu tempat (`BOBOT_SKOR`, `BOBOT_SKOR_PERAN`,
`BOBOT_ANGGOTA_MAJELIS`); bobot juru sita tidak menghitung "berjalan" karena satuan kerjanya panggilan/relaas, bukan perkara berjalan.

Seri skor: yang paling lama tidak menerima, lalu urutan semula (tetap tiap dihitung).

### Aturan pemerataan

- **Juru sita**: giliran menurut skor (kebendaan dibagi rata tersendiri bila perkaranya kebendaan).
- **Panitera pengganti**: PENDAMPING SK majelis itu didahulukan; di antara pendamping dan di antara yang di luar SK, skor terkecil
  lebih dulu. Urutan nama di SK tidak lagi memutuskan siapa yang pertama (sebelumnya "D sebelum D4"); SK menentukan
  HIMPUNAN pendamping, skor memeratakan di dalamnya. Seri jatuh ke urutan SK.
- **Majelis**: majelis SK didahulukan; di antaranya skor terkecil. Usulan Smart Majelis SIPP (bila sudah dijalankan untuk
  perkara itu dan susunannya majelis SK) TETAP dihormati, dan rekomendasi beban ditampilkan berdampingan bila berbeda
  ("Majelis usulan ... berbeda dari yang paling ringan bebannya ..."). Keputusan mengganti Smart Majelis dengan skor ada di
  pengguna; saat ini belum diganti karena Smart Majelis membawa rasio hakim yang tidak dimiliki skor ini.
- **Hakim tunggal**: skor di antara kolam yang sudah disaring (sertifikat ekonomi syariah, Ketua/Wakil).
- Usulan tetap dapat diubah petugas (mode manual); alasan singkat tampil pada baris (`sebab`) dan tooltip tabel, mis.
  "bagian 30 hari 18% (rata-rata 25%), kebendaan 6 bulan 1 dari 9, 12 perkara berjalan".

## 4. Hasil ukur atas data nyata

Sumber: salinan lokal `sipp_donggala` (XAMPP), penetapan 2026 sampai **9 Okt 2026** (batas: salinan berhenti di tanggal itu; server
kantor tidak terjangkau dari rumah). Skrip: `node aleta_bot/scripts/ukur-beban-penetapan.js <folder-tsv> 2026`
(masukannya ekspor `mysql -B -N` dari tabel `perkara_hakim_pn`, `perkara_panitera_pn`, `perkara_jurusita` digabung `perkara` dan
`perkara_putusan`; tahapan_id=10, aktif='Y', sejak 2025-10-01). Tiap perkara diputar ulang menurut tanggal penetapan dan
rekomendasi teratas dipilih atas keadaan yang dibangun simulasi itu sendiri.

Batas simulasi: tanpa cuti/sakit/sidang bentrok; kandidat = orang yang menerima penetapan pada tahun itu, hanya pada rentang
tanggal pertama-terakhirnya; pendamping SK panitera tidak dibatasi (SK belum mengikat panitera di salinan lokal); salinan lokal
masih memuat Nuniek, Sri Wahyuni, Mannaria sebagai aktif (mutasi terjadi sesudahnya).

| Peran | Ukuran | Nyata | Rekomendasi diikuti |
| :-- | :-- | --: | --: |
| Juru sita (887 penetapan) | selisih maks-min bobot per 100 hari bertugas | 2,8 | **0,5** |
| | koefisien variasi | 1,0% | 0,2% |
| | selisih kebendaan maks-min (setahun) | 1 | 2 |
| Panitera pengganti (885) | selisih maks-min bobot per 100 hari bertugas | 44,8 | **16,7** |
| | koefisien variasi | 28,3% | 9,9% |
| | selisih kebendaan maks-min (setahun) | 5 | 4 |
| Majelis SK, 136 perkara bermajelis 27 Agu-9 Okt | perkara per majelis A / B / C1 (+ di luar SK) | 37 / 43 / 49 (+7) | 45 / 48 / 43 |
| | selisih maks-min antar majelis | 12 | **5** |

Catatan jujur:

- **Juru sita sudah sangat merata** di kenyataan (rotasi ketat, CV 1%); skor baru sedikit lebih rapat tetapi bukan perbaikan
  yang berarti; manfaatnya di sini adalah kebendaan dibagi rata tersendiri dan alasan yang terbaca. Selisih kebendaan setahun
  (2 vs 1) sedikit naik karena jendela kebendaan 6 bulan, bukan setahun.
- **Panitera pengganti paling diuntungkan**: kenyataan timpang (CV 28%) karena mutasi dan pegawai baru; rekomendasi menurunkannya
  ke ~10% di bawah asumsi simulasi.
- **Majelis**: percobaan pertama (skor anggota 50%, riwayat sejak awal tahun) MEMBURUK: 77/43/16, karena susunan sebelum SK
  27 Agu bukan majelis yang sama dan majelis "tertinggal" dibanjiri. Diperbaiki dengan menilai majelis sejak SK berlaku (dan
  "berlaku mulai" menjadi pengaturan) serta menurunkan bobot skor anggota ke 20%. Kursi hakim individual tidak dapat merata:
  Derry (C3) duduk di ketiga majelis SK (136 dari 136), dan rasio Ketua/Wakil berbeda - itu struktur SK, bukan skor.
- Bobot dipilih dari percobaan atas satu tahun data (tujuh kombinasi); belum diuji pada tahun lain.

## 5. Cara memasang / mengubah

- Sudah terpasang di cabang: bot (`bebanPenetapanService.js`, `penunjukanService.js`, gerbang `internalGatewayRoutes.js`),
  portal (`penunjukan-pengaturan.ts` mengirim `sk`, `berlaku`, peringatan; rute usulan/kerjakan meneruskan), ekstensi
  (`penunjukan-statistik.js` dimuat sebelum `konten.js`; `konten.js` memasang blok di papan; `penetapan-sipp.js` memasangnya
  sebagai kotak terbentang di panel). Panel P2 dan papan membaca objek `usulan.statistik` yang sama.
- Mengubah bobot: `BOBOT_SKOR*` di `bebanPenetapanService.js`, ukur ulang dengan `BOBOT_JSON='{"jurusita":{...}}' node ...ukur-beban-penetapan.js`.
- Halaman admin SK majelis (butir tambahan): lihat bagian 6.

## 6. Halaman admin SK majelis

`aleta-ecourt-sk-majelis.tsx` disunting sebagai draf, disimpan sekali sesudah konfirmasi yang menyebut apa yang berubah.
Nomor/tanggal SK (lewat rute Nomor SK yang ada, tidak menyentuh ABT), berlaku mulai (`aleta_sipp_aturan_penunjukan.skBerlakuMulai`),
tambah/ubah/hapus majelis (ketua + anggota berurutan dari hakim aktif; pendamping D, D1... diikat ke panitera aktif), tautan akun
portal dan SK khusus tetap ada. Peringatan: hakim/panitera tidak aktif di SIPP, akun portal nonaktif (mutasi), jabatan bukan lagi
panitera pengganti (dicocokkan lewat akun yang ditautkan atau lewat nama). Pratinjau kalimat usulan. Jejak: `audit_logs`
(entity `sk_majelis`). Migrasi **0079** (idx 72) menambah `aleta_sipp_hari_sidang.aktif` (hapus lunak); tanpa migrasi, penyimpanan
tetap berjalan dan penghapusan ditolak dengan pesan yang jelas. Pada server, migrasi berjalan hanya dengan `ALETA_RUN_DB_MIGRATIONS=1`.
