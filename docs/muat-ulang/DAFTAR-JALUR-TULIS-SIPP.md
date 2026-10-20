# Daftar jalur tulis ke SIPP dan muat ulangnya (20 Okt 2026)

Permintaan pengguna: sesudah ekstensi/widget/penanda halaman menulis ke SIPP, halaman SIPP yang terbuka tidak
boleh menampilkan data basi, dan petugas tetap di halaman perkaranya (SIPP tidak menyediakan alamat detil
yang dapat dimuat ulang begitu saja: `location.reload()` jatuh ke dasbor karena nomor perkara hanya ada di sesi kilat).

Satu modul bersama: `ekstensi-sipp/muat-ulang-sipp.js` (global `aletaMuatUlangSipp`), gaya di
`penetapan-sipp.css`, jembatan ke `konten.js` lewat `catatAlamatSebelumTulis()` dan `muatUlangSesudahTulis()`.

| Fungsi modul | Kegunaan |
| :-- | :-- |
| `catatAlamat(kunci)` | SEBELUM menulis: simpan pintu masuk perkara (`perkara_detil/<enc>`) dan alamat saat ini di `chrome.storage.local` |
| `jadwalkan({...})` | SESUDAH selesai: ringkasan per langkah + hitung mundur 3 detik + "Muat ulang sekarang" / "Jangan muat ulang". Ada yang GAGAL = hanya tombol. `tanpaOtomatis` = hanya tombol (pekerjaan latar) |
| `pasangPengawal(kunci)` / `lepaskan(kunci)` | Jalur yang menekan Simpan borang SIPP (SIPP sendiri yang memuat ulang): menjaga bila SIPP jatuh ke dasbor, 15 detik |
| `tahan()` / `lepasTahan()` | Antrean massal: muat ulang di tengah ditahan (juga dari `muatUlangHalamanPerkara` lama); sekali di akhir |
| `sesudahMemuat()` (otomatis) | Kembali dari dasbor ke alamat semula SEKALI (penanda dicabut dulu: tanpa perulangan); ringkasan hasil tampil lagi (sekali, lalu bersih); dua tab: tab lain yang sedang memuat ulang perkara yang sama tidak diulang |

Aturan keputusan: jalur yang SIPP sendiri memuat ulang lewat submit borangnya TIDAK diberi muat ulang kedua - hanya
pengawal dasbor. Jalur yang menulis lewat bot/portal atau POST langsung (SIPP tidak tahu) diberi ringkasan + muat ulang otomatis.
Yang bukan penulisan ke SIPP (ABT, e-Court, data ALETA sendiri, hanya mengisi borang lalu petugas menekan Simpan) tidak diubah.

## Jalur yang menulis ke SIPP

| # | Jalur | Berkas / fungsi | Menulis apa | Sebelumnya muat ulang? | Sekarang |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | Panel "Penetapan Otomatis" (halaman perkara) | `penetapan-sipp.js` `jalankan()` -> `tetapkanLewatAleta` + `e6UnggahEdocPenetapan` | PMH/PPP/PJS/PHS + e-Doc (bot/portal) | Tidak ada (baru) | `catatAlamat` -> ringkasan + muat ulang otomatis di perkara itu; gagal = tombol saja |
| 2 | Tombol Tetapkan / kartu Penetapan / mode otomatis papan | `konten.js` `siapkanKerjakan` -> `tetapkanLewatAleta` | Sisa PMH->PHS (bot/portal) + e-Doc otomatis | `setTimeout(muatUlangHalamanPerkara, 2500)` tanpa menunggu e-Doc, tanpa ringkasan | Menunggu e-Doc otomatis selesai, ringkasan 3 dtk + tombol, muat ulang di perkara yang sama; gagal = tombol; kunci tulis bersama panel |
| 3 | Bongkar satu / semua penetapan | `konten.js` `mintaBongkar`, `mintaBongkarSemua` (+ `tombolBongkarSemua`) | Hapus penetapan (bot) | `setTimeout(muatUlangHalamanPerkara, 2000)` | Tetap memuat ulang (jalur lama), kini lewat modul: alamat disimpan, kembali dari dasbor sekali, ditahan di dalam antrean massal |
| 4 | Data Umum dari gugatan | `konten.js` `gambarKerjakanDataUmum` (POST `penunjukan/tulis` jenis dataUmum) | Tabel `perkara` Data Umum (bot) | Tidak ada (petugas disuruh muat ulang sendiri) | `catatAlamat` + ringkasan + muat ulang otomatis; gagal = tidak otomatis |
| 5 | Court Calendar otomatis | `konten.js` `ccInputKeSipp` / `ccKirimBaris` (POST langsung `manage_court_calendar/validateInput`) | Baris jadwal Court Calendar | Tidak ada ("Muat ulang tab Court Calendar SIPP") | `catatAlamat` + ringkasan per baris + muat ulang otomatis bila ada yang tersimpan; ada yang ditolak/gagal = tombol saja |
| 6 | e-Doc penetapan: tombol "e-Doc" per baris kartu, bagian PTSP, mesin `e6UnggahEdocPenetapan` | `konten.js` `e6UnggahEdocPenetapan`, `jalankanEdoc` | e-Doc PMH/PPP/PJS/PHS di tab Penetapan SIPP (bot) | Tidak ada | `catatAlamat` + ringkasan + muat ulang otomatis; pemanggil yang mengurutkan banyak langkah (panel baru, e-Doc sesudah menulis) memberi `tanpaMuatUlang` dan memuat ulang SEKALI sendiri |
| 7 | e-Doc penetapan manual (unggah berkas sendiri) | `konten.js` `s2BagianEdocPenetapanManual` -> `s2KirimEdoc` | e-Doc tab Penetapan | Tidak ada | `catatAlamat` + ringkasan + muat ulang otomatis |
| 8 | Penetapan massal (daftar perkara) | `konten.js` `bagianPenetapanMassal` (`jalankanIsi`) | Banyak perkara: PMH->PHS (bot) | Tidak ada ("Muat ulang halaman daftar...") | SEKALI di akhir: ringkasan jumlah ditetapkan/dilewati/gagal + muat ulang halaman DAFTAR yang sama; ada yang gagal = tombol saja |
| 9 | Kasir satu perkara (jurnal biaya) | `basmassal.js` `gambarPerkara` -> `kirim` (POST `sidang/kasir`) | Jurnal biaya perkara (bot) | Tombol "Muat ulang halaman SIPP" = `location.reload()` mentah (jatuh ke dasbor) | `catatAlamat` + ringkasan + muat ulang otomatis lewat modul; gagal = tombol |
| 10 | Kasir massal (per hari) | `basmassal.js` `bagianMassal` -> `jalankan` | Jurnal banyak perkara (jeda 20-150 dtk) | Tidak ada | `tahan()` sepanjang antrean; SEKALI di akhir, ringkasan per perkara; gagal = tombol |
| 11 | Kasir otomatis (jalan sendiri tiap 10 menit / saat panel dibuka) | `basmassal.js` `bagianOtomatis` -> `jalankan` | Jurnal banyak perkara | Tidak ada | `tahan()` sepanjang antrean; di akhir hanya ringkasan + tombol (`tanpaOtomatis`) bila jalan sendiri di latar - halaman yang sedang dipakai tidak direbut; ditekan petugas = muat ulang otomatis |
| 12 | Putusan Akhir "Putusan otomatis": isi borang + Simpan | `konten.js` `tekanSimpanPutusan` -> `kirimKeJembatan("tekan")`; `simpanPutusanLaluBuka` | Putusan akhir (borang SIPP) | Ya: `setTimeout(muatUlangHalamanPerkara, 900/1500)` sesudah bukti simpan (+ e-Doc) | Tetap (SIPP + jalur lama); ditambah pengawal dasbor di satu pintu jembatan dan alamat disimpan; di antrean putusan massal muat ulang tetap per halaman perkara (antrean berjalan menyusuri halaman perkara; lihat catatan) |
| 13 | Unggah e-Doc putusan + anonimisasi ke SIPP | `konten.js` `kirimBadanUnggahSipp`, `bagianUnggahEdocTerpisah` | e-Doc putusan/anonimisasi | Ya (1500 ms) | Tetap, lewat modul (dasbor dijaga) |
| 14 | Kerjakan borang PMH/PPP/PJS/PHS atau Data Umum di borang SIPP terbuka | `konten.js` `kerjakanBorang` (isi + Simpan SIPP) | Borang SIPP | SIPP sendiri | Pengawal dasbor dipasang eksplisit sebelum Simpan; tanpa muat ulang kedua |
| 15 | Ikrar talak otomatis (isi + Simpan) | `konten.js` `ikrarOtomatis` -> `kirimKeJembatan("tekan", "#simpan")` | Penetapan ikrar (borang SIPP) | SIPP sendiri | Pengawal dasbor di satu pintu jembatan (penunjuk "simpan") |
| 16 | Antrean putusan massal SIPP (per halaman perkara) | `konten.js` `jalankanAntreanSippSekali`, `simpanPutusanLaluBuka` (`lanjutWalauEdocGagal`) | Putusan banyak perkara, satu halaman perkara per butir | Ya, di halaman perkara yang baru diproses (900 ms) - itulah mekanisme berpindah butir | Tidak diubah (muat ulang berjalan di halaman perkara yang diproses, bukan di halaman asal); lewat `muatUlangHalamanPerkara` sehingga alamat dijaga dan tidak jatuh ke dasbor |
| 17 | Tombol "Putusan Otomatis" di halaman perkara SIPP (agen B2) | `putusan-sipp.js` -> `kotak.otomatis()` (konten.js `bagianIsiPutusan`) -> `simpanPutusanLaluBuka` + `putusan-edoc-sekaligus.js` | Putusan Akhir (borang SIPP) lalu e-Doc putusan + anonimisasi (bot/portal) | - | Alur Putusan otomatis ekstensi yang SAMA; kotak ringkasan per langkah melayang di halaman + muat ulang otomatis di perkara itu (`catatAlamat` oleh pengawal Simpan); ada e-Doc yang gagal = tombol saja. Hanya e-Doc (putusan sudah terisi) = ringkasan lewat `muatUlangSesudahTulis` |

## Bukan jalur tulis ke SIPP (tidak diubah) atau yang menulis hanya isian borang

| Jalur | Berkas / fungsi | Alasan |
| :-- | :-- | :-- |
| Isi otomatis borang penetapan | `penetapan-borang.js` | Hanya MENGISI; Simpan ditekan petugas (SIPP yang memuat ulang) |
| "Isi dengan ALETA" Tunda/Edit Jadwal, Relaas, Putusan Sela, Rekonvensi, Saksi, Tambah Biaya, Arsip | `sipp-ide-m1.js`, `sipp-ide-l1.js` pita Isi | Hanya MENGISI; Simpan petugas. "Isikan, lalu Simpan" di Putusan Akhir menekan tombol Isikan panel = jalur 12 |
| Isi alasan perkara (Data Umum) | `konten.js` `bagianIsiAlasanPerkara` | Mengisi borang; Simpan petugas |
| Data pihak / KTP / saksi (scan, rapikan alamat, keterangan saksi bantu) | `saksiscan.js`, `konten.js` `p5IsiAlamatSipp` | Mengisi; "BELUM TERSIMPAN: tekan Simpan sendiri" |
| Teruskan (titip) penetapan ke pejabat | `konten.js` `titipkanBorang` | Hanya antrean di ALETA |
| Catat jejak (`ALETA_API_CATAT`), masukan, keputusan dokumen, pengingat PNBP, setelan Kasir otomatis | `konten.js`, `basmassal.js` | Data ALETA sendiri, bukan SIPP |
| Relaas massal / cetak relaas | `jurusita.js`, `latar.js` | "Tidak ada yang ditulis ke SIPP" (berkas diunduh) |
| Unggah putusan ke e-Court, konversi naskah, anonimisasi ABT, Blangko Derry, BAS/ABT | `konten.js` s1/a30, `abt*.js`, `blangko-derry*.js` | e-Court / ABT, bukan halaman SIPP |
| Penanda halaman SIPP ("ALETA tandai") | `konten.js` `tandaiHalamanDaftar`, `sipp-ide-m2.js` | Hanya membaca |
| Widget/portal ALETA (`aleta.js`) | `aleta.js` | Halaman portal; muat ulangnya hanya sesudah pembaruan ekstensi (`panel-alat.js`) |
| `saksi-susun.js` `location.reload()` | ABT | Halaman ABT, bukan SIPP |

## Catatan

- Antrean massal yang berpindah halaman per butir (jalur 16) sengaja tidak ditahan: berpindah/memuat ulang halaman
  perkara ITULAH cara antrean berjalan, dan butir terakhir tidak meninggalkan halaman basi. Yang ditahan adalah
  antrean yang tinggal di SATU halaman (jalur 8, 10, 11).
- Pengawal (jalur 12, 14, 15) hanya berlaku 15 detik sesudah Simpan ditekan dan dicabut begitu halaman tiba;
  tidak pernah membajak dasbor yang dibuka petugas sendiri sesudahnya.
- Uji: `ekstensi-penetapan-sipp-tombol-20okt.test.ts` (modul, kembali dari dasbor, tanpa perulangan, ringkasan sesudah
  memuat, dua tab, penetapan, e-Doc, pengawal Simpan), `kasir-otomatis.test.ts` (Kasir per perkara dan massal).
