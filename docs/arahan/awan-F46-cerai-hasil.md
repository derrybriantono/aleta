# Hasil Fitur 46 tahap cerai (cabang `fitur-46-cerai`)

Dikerjakan dari arahan `docs/arahan/awan-F46-cerai.md`. Tanpa rilis, tanpa merge, tanpa mengubah cabang lain. Semua langkah sudah di-commit dan di-push.

## Yang selesai

1. **Hitung dulu**: `manajemen_surat/scripts/ukur-kartu-bukti.mjs`, hasil di `docs/arahan/awan-F46-cerai-ukur.md` (52 blangko, 14 keadaan). Temuan utama: hanya KTP dan Kutipan Akta Nikah yang punya bunyi sendiri. Bukti surat lain tidak punya bunyi di blangko mana pun.
2. **Kartu aturan**: `src/lib/kartu-pertimbangan-bukti.json`, 14 kartu (bunyi, kategori pokok/pelengkap, rujukan blangko). Penanda diganti nama kolom seperti `{pihak}`, `{kode}`, `{namaTanpaBin}`.
3. **Penyusun murni**: `src/lib/sinkron-pertimbangan-bukti.ts`, `susunParagrafBukti(...)` memulangkan `paragraf` (`kode, kunci, bunyi, cara, asal`), `belumAdaBunyi`, `keadaan`, dan `catatan`.
4. **Tampilan**: bagian "Pertimbangan dari alat bukti" di `bukti-aleta-abt.tsx` (paragraf otomatis, usulan yang dicentang, toggle "Lawan membantah", pilihan keadaan, Salin). `cetak-aleta-abt.tsx` hanya menambah satu prop `jenisPerkara`.
5. **Uji**: `src/test/sinkron-pertimbangan-bukti-6nov.test.ts`.

## Angka uji (apa adanya)

- `sinkron-pertimbangan-bukti-6nov.test.ts`: 31 lulus dari 31.
- `aleta-abt-cetak-layar-t5.test.tsx` (uji layar yang sudah ada, diulang karena komponen disentuh): 13 lulus dari 13.
- `npx tsc --noEmit`: bersih. `npx eslint` pada semua berkas yang diubah: bersih.
- Rangkaian uji penuh tidak dijalankan, sesuai arahan.
- Layar belum dilihat di peramban sungguhan.

## Cara kerja per keadaan

- Dikabulkan verstek dan Ditolak verstek: bunyi KTP dan Kutipan Akta Nikah dari blangko `[01] [Kabul Verstek] Cerai (Format Lengkap)`.
- Dikabulkan kontradiktoir: meterai, pencocokan, akta autentik, KTP, Kutipan Akta Nikah. Kalimat "tidak dibantah" hanya bila lawan hadir dan toggle "Lawan membantah" mati.
- Ditolak kontradiktoir: satu alinea surat pokok sisi penggugat atau pemohon (nikah terbukti). Tidak menyimpulkan dalil perceraian terbukti.
- Tidak Dapat Diterima: tanpa paragraf, bukti masuk `belumAdaBunyi` (blangko NO tidak menguraikan bukti satu per satu).
- Gugur, Digugurkan, Perdamaian: kosong.
- Dicabut: sebelum pembuktian dan pada pembuktian pertama kosong; pada pembuktian kedua atau sesudahnya, bukti agenda sebelumnya menjadi usulan.

## Keputusan yang saya ambil sendiri (cek)

- Saat lawan membantah, tidak ada bunyi blangko pengganti. "Mengubah bunyinya" saya wujudkan dengan membuang klausa "tidak dibantah ... pengakuan atas bukti". Tidak ada kalimat baru yang dikarang.
- Bukti tanpa asli: bunyi "Bahwa bukti X adalah fotokopi yang tidak dapat dicocokkan dengan aslinya;" (keputusan pemilik; satu-satunya bunyi yang tidak ada di bahan, ditandai `sumberKhusus` dan dijaga uji).
- Dicabut pada pembuktian pertama saya anggap kosong (arahan hanya mengatur "sebelum" dan "kedua"). Bila maksudnya lain, ubah di `susunParagrafBukti`.
- Bukti dianggap berasal dari pembuktian pertama bila `agendaKe` tidak diisi. Layar belum punya sumber agenda per bukti, jadi untuk Dicabut kedua semua bukti dihitung agenda pertama. **Perlu sumber data agenda di laptop.**
- Tanpa data perkara: `satker` ditulis "Pengadilan ini", majelis "Majelis Hakim", pasal acara ditulis RBg dan HIR sekaligus ("Pasal 285 RBg/Pasal 165 HIR"). Parameter `konteks` siap diisi bila datanya ada. Tanggal nikah dibaca dari bahan SIPP bila ada; bila kosong bagian itu tidak ditulis.
- Pengantar blangko ("telah mengajukan alat bukti surat P.1 dan P.2 serta 2 saksi", "meskipun lawan dianggap mengakui...") tidak dibuat kartu, karena memuat jumlah saksi dan bukan per jenis bukti.

## Jenis bukti dan keadaan yang belum punya bunyi

- Semua jenis surat selain KTP dan Kutipan Akta Nikah (KK, akta cerai, domisili, duplikat akta nikah, dan lain-lain): tidak ada bunyi sendiri. Pada keadaan Dikabulkan kontradiktoir mereka hanya mendapat usulan meterai, pencocokan, dan akta autentik (bila akta otentik menurut katalog); selebihnya masuk `belumAdaBunyi`.
- KK pada verstek: blangko menulis "identitas dan domisili" tanpa menyebut jenisnya; saya kaitkan ke KTP saja.
- Bukti elektronik: ada bunyi di blangko kabul kontradiktoir (T.3), tetapi layar ini hanya membaca bukti surat. Belum dicakup.
- Bukti sisi tergugat atau termohon pada Ditolak dan pada verstek; bukti dengan meterai "tidak dinazegelen" atau pencocokan "dari fotokopi"/"kopian sebelumnya": tidak ada bunyi, tercatat di `belumAdaBunyi`.
- Saksi: di luar tugas ini.
- Itsbat, dispensasi kawin, kebendaan: di luar tahap ini. Format menurut selera hakim ditunda.

## Bunyi blangko yang mencurigakan (tidak dibetulkan diam-diam)

1. **`[02] [Kabul] CT - F` (3 Saksi T, 4 Saksi T, tanpa saksi)** menulis "mengajukan gugatan cerai ... terhadap" tetap pada perkara permohonan (cerai talak). Alinea yang sama di blangko `[02a] CT` memakai penanda jenis perkara. Kartu memakai versi bertanda; versi tetap tidak dipakai.
2. **Alinea meterai sisi T (`T.1 dan T.2 yang diajukan ...`)** di blangko `[02] [Kabul]` memakai penanda pihak penggugat/pemohon ("yang diajukan #0046#"), padahal bukti T diajukan lawan. Kartu memakai pihak yang sebenarnya mengajukan bukti (sisi bukti itu sendiri). Ini satu-satunya tempat kartu sengaja berbeda dari teks mentah sisi T.
3. **Pasal saksi tunggal (`unus testis nullus testis`)** di blangko Tolak memakai variabel yang namanya "pasal menilai kesaksian" (309 RBg/172 HIR), padahal asas ini umumnya dirujuk ke Pasal 306 RBg/169 HIR. Tidak masuk kartu (saksi di luar tugas), tetapi perlu dicek pemilik.
4. **`Yurisprudensi Mahkamah Agung Nomor 4057G K/Pdt/1986 tanggal 30 April 1988`** (Tolak Verstek, Unus Testis): huruf "G" pada nomor perkara dan beda tahun nomor dengan tanggal putusan tampak janggal. Tidak masuk kartu.
5. **Pasal 1865 KUHPerdata**: ditemukan di blangko kabul kontradiktoir sebagai dasar beban pembuktian, bersama Pasal 283 RBg/163 HIR. Sepengetahuan saya pasal itu memang beban pembuktian, jadi tampak wajar, tetapi alinea itu bukan per bukti dan tidak masuk kartu. Pemeriksaan pasal lain: 1868, 1870, 1888, 1925, 1905, 1866 dan Pasal 7 ayat (1) KHI sesuai pemakaian lazim.
6. Blangko `[98] [NO]` dan `[Cabut]` tidak memuat pertimbangan per bukti (hanya daftar bukti dan pencabutan).

## Yang harus dicek di laptop

- Data SIPP: apakah `bahan.nikah.tglNikah` terisi dan formatnya ISO (bila bukan ISO, tanggal tampil apa adanya); sumber data agenda pembuktian per bukti; nama pengadilan, sebutan majelis, dan hukum acara (RBg/HIR) per perkara.
- Layar sungguhan: tebakan awal keadaan putusan dari teks naskah (kata "mengabulkan", "menolak", "verstek") hanya heuristik; lihat tata letak, centang usulan, tombol Salin, mode gelap, lebar ponsel.
- Penyisipan ke naskah cetak (`naskah.ts`) sengaja belum dilakukan.
- Tidak ada perubahan pada `ekstensi-sipp/`, `abt-paket/`, berkas blangko, `naskah.ts`, `APP_VERSION`, dan migrasi basis data. Tidak ada rute tulis baru.
