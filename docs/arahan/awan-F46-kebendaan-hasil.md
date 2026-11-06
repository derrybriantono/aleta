# Hasil Fitur 46 tahap perkara kebendaan: harta bersama, kewarisan, penetapan ahli waris (cabang `fitur-46-cerai`)

Lanjutan `awan-F46-itsbat-dk-hasil.md`. Tanpa rilis, tanpa merge. Tidak menyentuh `ekstensi-sipp/`, `abt-paket/`, berkas blangko, kartu usulan, `naskah.ts`, `APP_VERSION`, migrasi, atau rute tulis. Tidak menulis ke SIPP atau ABT. Tidak ada kartu usulan AI baru. Tidak ada data pihak di repo.

## Yang selesai

1. **Bahan**: `docs/arahan/awan-f46-bahan-kebendaan.json`, 20 blangko yang punya alinea bukti (dari 45 berkas di folder `4a Harta Bersama`, `4b Kewarisan`, `9 Penetapan Ahli Waris`) dan 53 variabel. Rumus dimuat utuh (batas 40.000 huruf; rumus 4807/4808/4829/4830 panjangnya 15.895 dan 16.438). Pindai: NIK 16 angka 0, rekening 0, kunci 0, kata "aleta" 0, surel 0. Tidak ada folder P3HP; hanya `9 Penetapan Ahli Waris`.
2. **Kartu**: `kartu-pertimbangan-bukti.json` versi 3, **36 kartu baru** (49 kartu lama tidak berubah). Penyusun `sinkron-pertimbangan-bukti.ts` mengenal perkara `HB`, `KW`, `PAW`. Layar `bukti-aleta-abt.tsx` memilih jenis dari teks jenis perkara SIPP.
3. **Uji**: `sinkron-pertimbangan-kebendaan-7nov.test.ts`.

## Cara blangko menilai bukti (tafsir rumus, tanpa menjalankan SQL)

Blangko harta bersama dan kewarisan tidak menulis kalimat per bukti. Alinea penilaian bukti memanggil `#4807#` (Penggugat) dan `#4808#` (Tergugat) pada harta bersama, `#4829#` dan `#4830#` pada kewarisan. Rumus itu:

- membaca daftar bukti surat (variabel 9955 untuk P, 9911 untuk T) baris demi baris;
- menggolongkan tiap baris dengan `CASE` atas 140 huruf pertama, kata kunci diuji berurutan, yang pertama cocok menang;
- menulis satu kalimat per golongan: "Menimbang, bahwa bukti P.1, P.2 dan P.3 (nama golongan) telah bermeterai cukup, di-nazegelen, dan cocok dengan aslinya, ...".

Urutan golongan harta bersama: KTP, KK, akta nikah, akta cerai atau putusan, foto atau rekaman, kendaraan, tanah dan bangunan, keuangan, lain-lain. Kewarisan: KTP, KK, kematian, akta nikah, kelahiran, silsilah atau ahli waris, foto atau rekaman, keuangan, tanah dan kendaraan (satu golongan), lain-lain. Penyusun menirukan urutan itu pada `jenisKebendaan` (nama bukti, bukan katalog portal), supaya golongan di layar sama dengan golongan di naskah ABT. Teks rumus Penggugat dan Tergugat identik; hanya daftar sumbernya berbeda (diuji).

## Kartu per perkara

| Perkara | Kartu | Rincian |
| :--- | ---: | :--- |
| Harta bersama | 18 | 7 alinea umum, 9 kalimat golongan (rumus 4807), 2 kartu tanpa asli |
| Kewarisan | 15 | 3 alinea umum, 10 kalimat golongan (rumus 4829), 2 kartu tanpa asli |
| Penetapan ahli waris | 3 | 2 alinea umum, 1 kartu tanpa asli |
| Jumlah | 36 | |

Alinea umum: pertimbangan formil bukti (meterai, nazegel, Pasal 1888 KUHPerdata, akta otentik), per keadaan seperti di blangko. Kartu kelompok memuat `rumus` (nomor variabel dan cabang) dan rujukan menyebut "Rumus variabel 4807 (cabang k1), dipanggil di ...".

## Jenis bukti yang punya bunyi

| Perkara | Otomatis (pokok) | Usulan (pelengkap) |
| :--- | :--- | :--- |
| Harta bersama | KTP, KK, kutipan akta nikah, akta cerai atau putusan, hak atas tanah dan bangunan (sertifikat, AJB, SPPT, IMB, girik, dan sebagainya), kendaraan (BPKB, STNK, faktur), keuangan (rekening, tabungan, kwitansi, dan sebagainya) | foto, tangkapan layar, rekaman (di daftar surat); surat lain; bukti elektronik terpisah (hanya pada dikabulkan dengan lawan hadir) |
| Kewarisan | KTP, KK, akta atau surat kematian, akta nikah, akta kelahiran, silsilah atau keterangan ahli waris, tanah dan kendaraan, keuangan dan jaminan sosial | foto dan sejenisnya; surat lain |
| Penetapan ahli waris | semua surat: satu alinea umum (dikabulkan: bermeterai cukup; ditolak: formil lengkap) | tidak ada |
| Semua | bukti tanpa asli: "tidak dapat dicocokkan dengan aslinya" (keputusan pemilik, bukan dari blangko) | untuk foto dan surat lain |

## Keadaan

| Keadaan | Harta bersama dan kewarisan | Penetapan ahli waris |
| :--- | :--- | :--- |
| Dikabulkan, kontradiktoir | ada (HB: formil Penggugat, akta kedua pihak, penunjukan mutatis mutandis untuk Tergugat; KW: formil dan akta para pihak) | umum |
| Dikabulkan, verstek (termasuk T tidak hadir setelah mediasi) | ada, hanya sisi P | tidak berlaku (permohonan) |
| Dikabulkan sebagian | memakai bunyi Dikabulkan, dengan catatan | sama |
| Ditolak, kontradiktoir dan verstek | ada | umum (Ditolak) |
| Dicabut | menurut agenda: sebelum dan pada pembuktian pertama kosong; pembuktian kedua atau sesudahnya, bukti agenda lama menjadi usulan | sama |
| Tidak dapat diterima, gugur, perdamaian, dicoret, sela | **tanpa bunyi**: blangko NO, gugur, damai, coret, dan sela tidak menguraikan bukti per alat | **tanpa bunyi** |

## Keadaan dan bagian tanpa bunyi

- Tidak dapat diterima (semua perkara): semua bukti masuk `belumAdaBunyi`.
- Gugur, perdamaian: kosong. Dicabut sebelum dan pada pembuktian pertama: kosong.
- Bukti elektronik terpisah: harta bersama hanya pada Dikabulkan kontradiktoir (usulan); kewarisan dan penetapan ahli waris tidak punya.
- Bukti sisi lawan pada verstek: dicatat "Pada verstek lawan tidak hadir, blangko tidak memuat bukti sisi lawan".
- Meterai kurang atau lebih, pencocokan dari fotokopi atau kopian: dicatat, tanpa kalimat karangan. Bukti yang disunting bebas: dicatat "Bukti disunting bebas".
- **Kalimat per bukti penetapan ahli waris tidak dipakai.** Blangko `[01] PAW - Ahli Waris Anak Kandung (Suami-Istri dan Orang Tua Pewaris Telah Meninggal)` memang memuat kalimat untuk KTP, KK, akta nikah, dua akta kematian, akta kelahiran, dan silsilah, tetapi semuanya terikat satu susunan ahli waris (pewaris, pasangan, dan orang tua pewaris sudah wafat, Pemohon anak kandung) dan memerlukan nama pewaris, pasangan, tanggal dan tempat wafat. Varian `[01b]` dan `[01c]` tidak punya kalimat per bukti. Memakainya untuk susunan lain akan salah; tiap bukti dicatat dengan alasan itu dan layar menampilkan catatannya.
- Wasiat, hibah, wakaf: belum punya bunyi (layar menampilkan keterangan).

## Bunyi blangko yang mencurigakan (tidak dibetulkan diam-diam)

1. **"volledig bidende bewijskracht"** pada kalimat golongan KTP, KK, nikah, akta cerai, kematian, kelahiran (rumus 4807/4829) dan pada blangko PAW; alinea umum harta bersama menulis "volledig en bindende bewijskracht". Salah ketik di salah satunya; kartu menyalin apa adanya.
2. **Undang-Undang ITE**: kalimat foto dan alinea bukti elektronik harta bersama menulis "diubah terakhir dengan Undang-Undang Nomor 1 Tahun 2024", sedangkan kartu bukti elektronik cerai menulis "diubah dengan Undang-Undang Nomor 19 Tahun 2016". Dua blangko tidak seragam.
3. **Ditolak, alinea akta (harta bersama dan kewarisan)** menyatakan "fotokopi yang tidak dapat dicocokkan dengan aslinya dinilai secara terbatas sebagai bukti permulaan", tetapi kalimat golongan di bawahnya selalu menulis "cocok dengan aslinya" untuk semua bukti. Rumus tidak membaca isian pencocokan sama sekali; kartu hanya menulisnya bila bukti memang bermeterai dan dicocokkan.
4. **Kalimat golongan "lain-lain"** menulis "relevan dengan dalil yang hendak dibuktikan oleh Penggugat dan Tergugat" untuk bukti satu pihak saja.
5. **Harta bersama [01] alinea Tergugat** ("terhadap syarat formil dan materiil bukti surat dan saksi-saksi Tergugat ... menunjuk pertimbangan alat bukti Penggugat") selalu menyebut saksi walau Tergugat tidak punya saksi. Kartu menandainya "Periksa".
6. **Penggolongan kata kunci** rumus longgar: "rumah" digolongkan tanah (mis. "Surat Keterangan Rumah Sakit" masuk tanah), "putusan" apa pun masuk akta cerai (harta bersama), "bank" apa pun masuk keuangan. Rumus tidak diubah; penyusun menirukannya agar sama dengan naskah ABT.
7. **Label bukti** rumus mengambil kata sesudah "tanda " (huruf kecil) atau jatuh ke "P.nomor baris". Pada baris yang hanya memuat "Kartu Tanda Penduduk" (huruf besar T) tanpa "tanda P.n" kecil, label bisa menjadi kata pertama baris. Ini dugaan dari membaca rumus, tidak diuji dengan SQL; perlu dicek pada naskah ABT sungguhan.
8. **Blangko HB 01a** masih memuat petunjuk merah "KETERANGAN MERAH INI DIHAPUS SESUDAH DIISI" pada alinea [25]; tidak dipakai.
9. Kode satker `PA.Dgl` dan nama provinsi muncul di rumus hukum acara (variabel 11850) di bahan; itu kode satker, bukan data pihak.

## Keputusan yang saya ambil sendiri (cek)

1. Penggolongan portal meniru `CASE` rumus atas **nama bukti** (bukan 140 huruf baris naskah dan bukan katalog `bukti-katalog.json`), dengan satu spasi di belakang agar "foto " cocok.
2. **Pokok** = golongan bernomor selain foto dan lain-lain; **pelengkap** (usulan) = foto, lain-lain, dan bukti elektronik.
3. Kalimat golongan hanya ditulis untuk bukti **lengkap** (meterai 0 dan pencocokan 0), karena rumus selalu menulis "bermeterai cukup, di-nazegelen, dan cocok dengan aslinya". Bukti tanpa asli memakai kalimat keputusan pemilik yang sama dengan itsbat dan dispensasi.
4. Alinea umum (tanpa daftar kode) **tidak** menandai bukti sebagai sudah berbunyi; bukti tetap butuh kalimat golongannya, kalau tidak dicatat.
5. Alinea "para pihak" ditulis satu kali dengan kode gabungan P lalu T (bidang kartu baru `sekali`).
6. Pada verstek, bukti sisi T tidak diproses. "T tidak hadir setelah mediasi" diperlakukan sebagai verstek (blangko 02a dan 01a memakai bunyi verstek).
7. Dikabulkan sebagian memakai bunyi Dikabulkan dan punya pilihan sendiri di layar (berlaku juga untuk cerai: sebelumnya teks itu sudah terbaca sebagai kabul). Layar menebak "Dikabulkan sebagian" dari naskah bila ada kata "mengabulkan ... sebagian".
8. Saklar "Lawan membantah" disembunyikan untuk kebendaan, karena blangko HB dan KW tidak punya kalimat "tidak dibantah" pada alinea bukti.
9. Kewarisan punya isian **Nama pewaris** di layar; kosong berarti anak kalimat "yang membuktikan telah meninggalnya ... sebagai pewaris" tidak ditulis (bukan ditebak). Almarhum atau Almarhumah menurut kata "binti", sama dengan variabel 2026.
10. "P3HP" dan "ahli waris" pada teks jenis perkara dipetakan ke penetapan ahli waris; tidak ada folder P3HP terpisah di bahan, jadi ini dugaan.
11. Rujukan kartu HB dan KW yang berbagi bunyi memilih folder perkara sendiri dan mengenali berkas verstek; perilaku cerai tidak berubah.
12. Hukum acara kosong menulis kedua pasal ("Pasal 288 RBg/Pasal 1875 Kitab Undang-Undang Hukum Perdata" untuk akta di bawah tangan), seperti pola yang ada.

## Angka uji (apa adanya)

- `sinkron-pertimbangan-kebendaan-7nov.test.ts`: 45 lulus dari 45.
- `sinkron-pertimbangan-bukti-6nov.test.ts`: 31 dari 31. `sinkron-pertimbangan-itsbat-dk-6nov.test.ts`: 34 dari 34 (dua pemeriksaan "jenis lain" dialihkan dari Harta Bersama ke Wasiat). `kartu-usulan-bukti-6nov.test.ts`: 33 dari 33. `sisip-format-bahwa-7nov.test.ts`: 10 dari 10. `bukti-elektronik-pertimbangan-7nov.test.tsx`: 25 dari 25. `aleta-abt-cetak-layar-t5.test.tsx`: 13 dari 13.
- Jumlah: 191 lulus dari 191. Tambahan: `bukti-kode-rekonvensi-7nov`, `sisip-pertimbangan-bukti-6nov`, `sisip-pertimbangan-bukti-layar-6nov`, `agenda-pembuktian-layar-7nov`: 47 dari 47.
- `npx tsc --noEmit` bersih. `npx eslint` pada empat berkas yang diubah bersih. Uji penuh tidak dijalankan.
- Uji kepatuhan: tiap alinea umum dicocokkan ke alinea nyata di bahan; tiap kalimat golongan dicocokkan ke cabang rumus (19 cabang: 9 harta bersama, 10 kewarisan); rumus Penggugat dan Tergugat dibuktikan identik; tiap blangko Kabul dan Tolak punya kartu di keadaannya.

## Belum diuji

Layar di peramban sungguhan (hanya render jsdom), naskah ABT sungguhan (penyisipan ke RTF kebendaan belum dicoba pada berkas nyata), dan rumus 4807/4829 terhadap data SIPP dan ABT. Kalimat golongan yang disusun portal dapat berbeda dari keluaran SQL bila nama bukti di naskah tidak sama dengan baris sumber rumus.
