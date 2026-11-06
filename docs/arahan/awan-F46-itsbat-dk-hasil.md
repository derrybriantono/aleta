# Hasil Fitur 46 tahap itsbat nikah dan dispensasi kawin (cabang `fitur-46-cerai`)

Lanjutan `awan-F46-cerai-hasil.md`. Tanpa rilis, tanpa merge, tanpa mengubah cabang lain. Tidak menyentuh `ekstensi-sipp/`, `abt-paket/`, berkas blangko, `naskah.ts`, `APP_VERSION`, migrasi, atau rute tulis. Tidak menulis ke SIPP atau ABT.

## Yang selesai

1. **Bahan**: `docs/arahan/awan-f46-bahan-itsbat-dk.json`, 33 blangko (folder `2 Itsbat Nikah`, `2a Itsbat Nikah Kontensius`, `3 Dispensasi Kawin`) dan 66 variabel. Dibuat dengan salinan `bahan-f46.cjs` (hanya pola folder diubah). Pindai: NIK 16 angka 0, rekening 0, kunci 0, kata "aleta" 0, surel 0, alamat atau nama pihak 0 (satu kata "jakarta" ada di rumus pemilih hukum acara, bukan data pihak). Kata "Derry Briantono" hanya pada kolom `sumber` (atribusi blangko, sama dengan bahan cerai).
2. **Kartu**: `kartu-pertimbangan-bukti.json` versi 2, **43 kartu** (14 cerai tidak berubah, **29 baru**: itsbat 10, dispensasi 19). Kolom `cerai` diganti `perkara` (CG, CT, IN, DK). Kartu baru punya bidang tambahan `maks`, `anak`, `butuh`. Bunyi disusun mesin dari alinea blangko lewat penukaran penanda ke nama kolom; `asal` diisi otomatis dari semua alinea yang sama persis (mis. kartu meterai itsbat menunjuk 14 alinea di 14 blangko).
3. **Penyusun**: `sinkron-pertimbangan-bukti.ts`. Input `jenisPerkara` (`jenisCerai` lama tetap diterima). Keadaan permohonan: `kabul`, `tolak`, `tdt`; verstek dan lawan diabaikan. `konteks` ditambah `jumlahPemohon`, `anak` (P/L), `isian` (alamat, anak, calon, usiaAnak, tglLahirAnak). Fungsi baru `jenisPerkaraBukti`, `gabungKodeRentang` ("P.1 sampai P.9", cara blangko dispensasi).
4. **Layar**: `bukti-aleta-abt.tsx` memilih jenis dari teks jenis perkara SIPP. Permohonan: saklar verstek dan "Lawan membantah" disembunyikan; muncul pilihan Jumlah Pemohon (dibaca dari SIPP, bawaan dua), Anak Pemohon (dispensasi), dan isian opsional. Jenis lain (termasuk Itsbat Nikah Kontensius) menampilkan keterangan "belum punya bunyi", bukan hilang.
5. **Uji**: `sinkron-pertimbangan-itsbat-dk-6nov.test.ts`.

## Angka uji (apa adanya)

- `sinkron-pertimbangan-itsbat-dk-6nov.test.ts`: 34 lulus dari 34.
- `sinkron-pertimbangan-bukti-6nov.test.ts` (cerai): 31 lulus dari 31. Dua pemeriksaan kepatuhannya dipersempit ke kartu cerai karena kartu baru memakai bahan lain.
- `aleta-abt-cetak-layar-t5.test.tsx`: 13 lulus dari 13.
- Jumlah: 78 lulus dari 78. `npx tsc --noEmit` bersih. `npx eslint` pada empat berkas yang diubah bersih.
- Uji penuh tidak dijalankan. Layar belum dilihat di peramban sungguhan (hanya uji render jsdom).

## Jenis bukti yang punya bunyi (per perkara dan keadaan)

| Perkara | Keadaan | Bukti yang punya bunyi | Sifat |
| :--- | :--- | :--- | :--- |
| Itsbat | Dikabulkan | KTP: meterai, pencocokan, akta autentik, kedudukan hukum (dua KTP pertama) | otomatis |
| Itsbat | Ditolak | KTP: meterai, pencocokan, akta autentik, KTP dan wilayah (butuh alamat) | otomatis |
| Itsbat | Tidak dapat diterima | sama dengan Ditolak (bunyi dari blangko NO 99c dan 99d) | otomatis |
| Itsbat | ketiganya | bukti surat lain (KK, surat KUA atau desa): kalimat meterai, pencocokan, akta autentik | usulan |
| Dispensasi | Dikabulkan | kalimat formil (fotokopi dan asli) untuk KTP, KK, kutipan nikah, KIA, akta kelahiran, ijazah, penolakan KUA, surat hamil; bunyi sendiri: KTP dua pertama, KIA, akta kelahiran, ijazah, penolakan KUA, surat hamil | otomatis |
| Dispensasi | Ditolak | sama tanpa surat hamil; ijazah dan penolakan KUA punya varian anak laki-laki | otomatis |
| Dispensasi | lain-lain | bukti selain di atas: hanya kalimat formil | usulan |
| Semua | Dikabulkan/Ditolak | bukti tanpa asli: "tidak dapat dicocokkan dengan aslinya" (keputusan pemilik, bukan dari blangko) | menurut jenis |

## Keadaan tanpa bunyi

- Dispensasi, Tidak Dapat Diterima: blangko NO dispensasi tidak menguraikan bukti, semua bukti masuk `belumAdaBunyi`.
- Gugur, Digugurkan, Perdamaian: kosong. Dicabut: kosong sebelum dan pada pembuktian pertama; pada pembuktian kedua bukti agenda lama menjadi usulan (kartu kabul).
- Itsbat Nikah Kontensius (gugatan, ada Tergugat): tidak dibuat kartunya (arahan menyebut perkara ini permohonan). Bahannya ikut tersimpan.
- Dispensasi dengan satu Pemohon: blangko hanya ditulis untuk dua Pemohon (Pemohon I dan II), jadi tidak ada bunyi.
- KK, kutipan nikah, KTP calon, akta kelahiran calon, bukti P.8 dan P.9 blangko dispensasi (identitas calon): tidak punya bunyi sendiri. Peran anak atau calon tidak terbaca dari jenis bukti; hanya terkena kalimat formil.
- Varian blangko khusus yang belum dibuat: itsbat 01a (saksi istifadhah), 01b (terpadu), 01d, 01f; dispensasi 01d (dua keluarga Pemohon); fragmen 99aa (akta cerai atau kematian pasangan sebelumnya, butuh peran suami atau istri sebelumnya).

## Keputusan yang saya ambil sendiri (cek)

1. **Pokok itsbat = KTP saja.** Blangko hanya menyebut P.1 dan P.2 sebagai KTP (alinea Ditolak dan NO). Surat lain jadi usulan. **Pokok dispensasi** = semua jenis yang masuk rentang P.1 sampai P.11 blangko (KTP, KK, kutipan nikah, KIA, akta kelahiran, ijazah, penolakan KUA, surat hamil atau bidan).
2. **Surat asli dispensasi** = penolakan KUA dan surat hamil atau bidan (blangko: "P.10 dan P.11 merupakan surat asli"); yang lain fotokopi. Rentang ditulis "P.1 sampai P.8" menurut nomor yang ada.
3. **Batas urutan dispensasi**: kalimat KTP hanya untuk dua KTP pertama (Pemohon I dan II); kalimat KIA, akta kelahiran, dan ijazah hanya untuk bukti pertama jenisnya (dianggap anak Pemohon).
4. **Isian yang tidak ada di baris bukti** (alamat, usia dan tanggal lahir anak, nama calon): kolom isian opsional di layar. Anak kalimat yang memerlukannya dihapus bila kosong (tanpa tebakan). Kalimat yang tidak berdiri tanpa isian (penolakan KUA, akta kelahiran, ijazah, KTP dan wilayah di itsbat, kalimat formil tanpa fotokopi) tidak ditulis dan dicatat "Lengkapi dulu: ..." di `belumAdaBunyi`.
5. **"para"** mengikuti jumlah Pemohon dari SIPP (`bahan.P`), bawaan dua. Satu Pemohon menghapus kata "para" (bunyi blangko itsbat satu Pemohon sama selain itu).
6. **Pilihan anak P/L** (bawaan perempuan) memengaruhi hanya kartu Ditolak (ijazah, penolakan KUA) dan surat hamil Dikabulkan; kartu Dikabulkan lain identik untuk kedua varian setelah penanda disamakan.
7. **Tidak dapat diterima itsbat** memakai bunyi blangko NO 99c dan 99d (blangko NO itu memuat penilaian bukti), berbeda dengan cerai yang tidak.
8. Rujukan `asal` pada paragraf memilih blangko menurut keadaan (Kabul, Tolak, atau NO) bila ada, agar layar tidak menunjuk blangko Kabul untuk paragraf Ditolak.
9. Kecil: `isiKartu` membuang spasi sebelum titik koma (blangko ijazah menulis " ;"); ini berlaku juga untuk cerai tetapi tidak mengubah bunyi cerai mana pun (uji cerai tetap hijau).
10. Tidak ada kalimat baru yang dikarang. Satu-satunya bunyi di luar bahan tetap "tidak dapat dicocokkan dengan aslinya" (keputusan pemilik), ditandai `sumberKhusus` dan dijaga uji.

## Bunyi blangko mencurigakan (tidak dibetulkan diam-diam)

1. **Dispensasi, P.9** (Cewek, Kabul dan Tolak): kalimat berhenti di "...calon suami anak para Pemohon telah" tanpa predikat. Tidak masuk kartu.
2. **Dispensasi `[03] [Tolak] ... Cewek ... Belum Hamil`** menulis "Pasal 285 RBg" tetap dan "Ayat" besar, padahal blangko lain memakai variabel acara (RBg atau HIR). Kartu memakai versi bervariabel dari `[03a]`; versi tetap tidak dipakai.
3. **"berwewenang"** (salah ketik) pada kalimat KTP dispensasi, Kabul dan Tolak. Tetap tertulis di kartu.
4. **Dispensasi Cowok**: kalimat penolakan KUA di blangko Kabul menutup dengan "calon pengantin perempuan", sedangkan blangko Tolak Cowok menulis "laki-laki". Kartu Kabul mengikuti blangko (perempuan) untuk kedua varian.
5. **Dispensasi Cowok, surat hamil**: kalimat menyebut "Anak Para Pemohon yang bernama X dalam kondisi hamil", padahal X adalah calon istri (variabel nama wanita), bukan anak Pemohon. Kartu `dk-hamil-l` menyalin apa adanya.
6. **Dispensasi Cowok, akta kelahiran**: tanggal lahir anak laki-laki diambil dari variabel "Tgl. Lahir Wanita (Dispensasi)" (0349). Kartu memetakannya ke isian tanggal lahir anak.
7. **Kalimat formil dispensasi**: "bukti bertanda P.1, sampai P.9 berupa fotokopi" (koma salah tempat) dan "P.1 sampai P.8 tersebut berkaitan" yang tidak menyebut P.9 sampai P.11. Kartu memakai seluruh bukti fotokopi pada kedua tempat.
8. **Pasal 22 ayat (2) PP 9/1975** muncul pada kalimat saksi dispensasi dan itsbat; setahu saya pasal itu mengatur pemeriksaan perceraian, tampaknya tersalin dari blangko cerai. Tidak masuk kartu (saksi di luar tugas), mohon dicek.
9. **Pasal 6 ayat (1) PERMA 5 Tahun 2019** dikutip sebagai dasar kedudukan hukum orang tua. Dari ingatan saya Pasal 5 mengatur siapa pemohon dan Pasal 6 mengatur dokumen; nomor ayat perlu dicek. Masuk kartu `dk-lahir-*` apa adanya.
10. Pasal lain yang dipakai kartu (1865, 1868, 1870, 1888 KUHPerdata; Pasal 3 ayat (1) dan Pasal 5 UU 10/2020; Pasal 283 atau 285 RBg) sesuai pemakaian lazim.
11. Itsbat `[99] [NO]` memuat penanda isian tak terisi ("_", "pria/wanita", "I / II") dan `[01a]` memuat karakter rusak pada kutipan SEMA; `[99aa]` menulis "dansetelah". Tidak dipakai.

## Yang harus dicek di laptop

- Layar sungguhan (tata letak, mode gelap, ponsel) pada perkara itsbat dan dispensasi nyata; apakah `jenis perkara` SIPP yang tampil di daftar cocok dengan deteksi ("Pengesahan Perkawinan/Istbat Nikah", "Dispensasi Kawin"); apakah itsbat kontensius punya teks jenis yang bisa dibedakan.
- Apakah `bahan.P` dari rute bukti-sipp benar jumlah Pemohon pada itsbat dan dispensasi.
- Apakah pengguna lebih suka isian alamat dan calon diambil dari SIPP otomatis (belum ada sumbernya di rute bukti).
- Sumber agenda pembuktian per bukti (sama dengan catatan cerai).
- Penyisipan ke naskah cetak tetap belum dilakukan.
