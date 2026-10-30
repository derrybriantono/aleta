# Paket ABT `abt-sela-ps-30okt` - putusan sela semua jenis + BAS pemeriksaan setempat + mediasi elektronik (30 Okt 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang - dipasang sesi utama. URUTAN PASANG: PALING AKHIR**
(sesudah `prodeo-panggilan-29okt` -> `bas-tanya-jawab-29okt` -> `ket-saksi-kata-30okt` -> `relaas-penetapan-30okt` -> `sampul-rapi-30okt`).

Permintaan Derry 30 Okt ±09.35: BAS pemeriksaan setempat, dan putusan sela di bab baru terpisah dari putusan, untuk semua jenis putusan sela dan
semua statusnya. Putaran 2 (jawaban 13 butir, 30 Okt siang): kalimat baku biaya, pasal putusan sela, eksepsi dikabulkan = gugatan NO, semua jenis
sumpah (+ BAS lalu putus), mediasi tidak beriktikad baik (PERMA 1/2016) + mediasi elektronik (PERMA 3/2022), eksepsi lain, rekonvensi, penggabungan,
Pasal 49/50 UU 7/1989, panjar PS, gambar situasi, BAS PS cerai kumulasi, tab "Putusan sela" di panel. Hanya pengguna **derry_briantono**. Tanpa kata
nama aplikasi, tanpa nama satker tertulis mati (identitas dari variabel satker).

## Isi

| bagian | isi |
|---|---|
| menu 151 `Putusan Sela (Eksepsi, Provisi, Intervensi, Sumpah, Pemeriksaan Setempat, Mediasi, Rekonvensi, Penggabungan)` (alias `Putusan Sela - Putusan`), folder BARU `97a Putusan Sela` | 37 blangko (matriks di bawah). Hak = menu 150 `97 Sita`: proses 80-297, alur 15-17, cek 3, grup `1\|10\|20`, top `1` |
| menu 152 `Putusan Sela - BAS` (alias sama), folder BARU `97a Putusan Sela - BAS` | 9 BAS: [1] sidang insidentil, [2] pembacaan putusan sela (amar SIPP #9160#), [3]/[3a] sumpah pelengkap, [4]/[4a] sumpah pemutus, [5]/[5a] sumpah penaksir (tanpa huruf = tunda putusan; `a` = skors musyawarah lalu putusan dibacakan hari itu: #0067# + #9403# + amar SIPP #0065#), [6] sumpah li'an. Hak = menu BAS: grup `1\|30\|500\|430\|1000\|1010\|1020`, top `1\|30`, validator `10\|20` |
| BAS pemeriksaan setempat | DITIMPA (md5 lama `2a660b99...`, cadangan + pulih): `4a Harta Bersama - BAS`, `4b Kewarisan - BAS`. BARU: `4c Wasiat` (ALUR 42), `4d Hibah` (47), `4e Wakaf` (48), `10a Ekonomi Syariah Biasa` (43), `1 Perceraian CG - BAS` dan `1a Perceraian CT - BAS` (`BAS ALUR 04 [PS] ... Objek Harta Bersama (Kumulasi)`, objek isian 8730). Isi sama: tanya-jawab para pihak, kesimpulan pencocokan, baris "gambar situasi ... terlampir" |
| putusan akhir li'an (putaran 3) | BARU `1 Perceraian CG/[97] [Lian] CG - Perkawinan Putus karena Lian (Putusan Akhir).rtf` dan `1a Perceraian CT/[97] [Lian] CT - ...`: Pasal 87 ayat (1) dan 88 ayat (1) UU 7/1989, KHI Pasal 125-128 dan 162; amar: mengabulkan, perkawinan putus karena li'an, tidak dapat rujuk dan tidak dapat menikah kembali untuk selama-lamanya, (bila ada pengingkaran anak, isian 11411) anak dinasabkan kepada ibunya, biaya bidang perkawinan (#11414#: Pasal 89 ayat (1) / prodeo DIPA) |
| mediasi elektronik (PERMA 3/2022) | BARU 41 BAS: `BAS ALUR 04 [1e] ...` dan `BAS ALUR 05 [1e] BAS 1 P & T Hadir - Mediasi Elektronik (PERMA 3 2022).rtf` di 19 folder BAS, serta ALUR 34 (poligami), 36 (cerai kumulasi itsbat), 37 (CG kumulasi hak asuh) `Sidang 1 - ... Mediasi Elektronik (PERMA 3 2022).rtf`; pasal: persetujuan dan formulir = Pasal 5 dan Pasal 6 PERMA 3/2022, audio visual dianggap kehadiran langsung = Pasal 5 ayat (3) dan Pasal 6 ayat (2) PERMA 1/2016 (lihat catatan pasal di bawah) (disusun dari [1] folder itu: butir penjelasan 7 baru, persetujuan para pihak, Menimbang PERMA 3/2022 jo. PERMA 1/2016, amar "secara elektronik melalui ..." #11400#) dan `99 PTSP/@ 4a - Penetapan Penunjukan Mediator - Mediasi Elektronik (PERMA 3 2022).rtf` (dari `@ 4`). Blangko mediasi biasa TIDAK diubah; `@ 4` tidak disentuh paket relaas-penetapan (w131 hanya @0-@3) |
| 117 variabel baru 11300-11419 | blok 11300-11499 diklaim paket ini; 11600-11619 (paket sampul) TIDAK dipakai. `alat/cek_bentrok.py`: tidak ada nomor/menu/berkas yang sama di paket lain. ACARA (11300-11309, 11370, 11371, 11379) = SATU-SATUNYA tempat rujukan pasal RBg (padanan HIR dicatat di nama variabel, belum dipakai) |

Sita (jaminan/marital/revindikasi) TETAP di `97 Sita` [01]/[02] (menu 150) dan tampil juga di tab "Putusan sela" panel (butir 1). Blangko sela lama
`[98e]/[98f]` per jenis TIDAK diubah (butir 2) - ikut tampil di tab "Putusan sela" pada kelompok jenis perkaranya.

### Matriks putusan sela jenis x status (folder `97a Putusan Sela`)

| jenis | dikabulkan | ditolak / lainnya |
|---|---|---|
| eksepsi kewenangan absolut | [02] PUTUSAN akhir: tidak berwenang + **gugatan tidak dapat diterima**, biaya putusan akhir (#11319#, amar #11122# prodeo DIPA, rincian) | [01] PUTUSAN SELA: bidang Pasal 49 huruf ... (#11372#) + Pasal 50 ayat (2) bila sengketa milik (#11373#), pemeriksaan dilanjutkan |
| eksepsi kewenangan relatif | [04] PUTUSAN akhir: tidak berwenang (+ pengadilan berwenang isian 11317) + gugatan tidak dapat diterima | [03] PUTUSAN SELA |
| eksepsi gugatan kabur / keliru pihak / kurang pihak / ne bis in idem / prematur | [16]/[18]/[20]/[22]/[24] `[NO]` PUTUSAN akhir: Dalam Eksepsi mengabulkan, Dalam Pokok Perkara gugatan tidak dapat diterima, biaya putusan akhir | [17]/[19]/[21]/[23]/[25] `[Sisipan]`: bagian pertimbangan + amar "Dalam Eksepsi: Menolak eksepsi" untuk DISALIN ke putusan akhir (Pasal 162 RBg: diputus bersama pokok perkara) |
| tuntutan provisi | [05] | [06] |
| intervensi voeging / tussenkomst / vrijwaring | [07] / [09] / [11] | [08] / [10] / [12] |
| sumpah pelengkap (suppletoir) | [13] gugatan; [14] permohonan PENETAPAN SELA | (diperintahkan) |
| sumpah pemutus (decisoir) | [29] gugatan, Pasal 183 RBg (#11371#) jo. Pasal 1929-1939 KUHPerdata, lafal per agama (#11387#) | (diperintahkan) |
| sumpah penaksir (aestimatoir) | [30] gugatan, #11305# jo. Pasal 1940 dan 1942 KUHPerdata, batas jumlah (isian 11389) | (diperintahkan) |
| sumpah li'an | [31] cerai alasan zina, Pasal 87-88 UU 7/1989 jo. KHI Pasal 126-128 | (diperintahkan) |
| pemeriksaan setempat | [15] perintah PS + **tambah panjar** oleh pihak peminta (#11397#, isian 11396) | (satu status) |
| gugatan rekonvensi | [34] `[Sisipan]` Dalam Rekonvensi dikabulkan (seluruhnya/sebagian isian 11408, amar isian 11407, "menolak selebihnya" otomatis) | [35] `[Sisipan]` Dalam Rekonvensi ditolak; [26] PUTUSAN SELA tidak dapat diterima (#11379# Pasal 157-158 RBg), konvensi dilanjutkan |
| penggabungan perkara | [27] | [28] |
| pemisahan perkara (splitsing) | [36] (dasar sejalan penggabungan: praktik + Pasal 2 ayat (4) UU 48/2009) | [37] |
| tidak beriktikad baik dalam mediasi | [32] Tergugat: PENETAPAN (Pasal 7 ayat (2) + Pasal 23 ayat (1),(3),(4) PERMA 1/2016): menyatakan tidak beriktikad baik, menghukum biaya mediasi (isian 11398) yang dimasukkan dalam panjar biaya perkara (isian 11416 = P) atau dibayar tersendiri melalui Kasir (bawaan), pemeriksaan dilanjutkan; kaki #11402# | [33] Penggugat: PUTUSAN akhir `[NO]` (Pasal 22 ayat (1),(2),(4)): gugatan tidak dapat diterima + biaya mediasi + biaya perkara (#11403#, #11122#) |
| sita jaminan/marital/revindikasi | `97 Sita` [01] (tidak diubah) | `97 Sita` [02] |

Semua putusan sela yang pemeriksaannya berlanjut: amar terakhir PERSIS "Menangguhkan pembebanan biaya perkara hingga putusan akhir." (permohonan
[14]: "... hingga penetapan akhir." - pertanyaan 1), tanpa rincian biaya; pertimbangan Pasal 89 ayat (2) UU 7/1989 dan "putusan yang bukan putusan
akhir ... sebagaimana dimaksud dalam #11370#" (= Pasal 196 ayat (1) RBg; padanan Pasal 185 ayat (1) HIR - selisih 11 pasal seperti 180/191, 181/192,
196/207 HIR/RBg; benar seperti dugaan pengguna). Rincian/pembebanan biaya hanya pada yang menjadi putusan akhir (`[NO]`). Kaki #11311# (kehadiran pada
SIDANG YANG DICETAK, e-Court = dikirim elektronik); TTD #8500#; identitas #7047# / #7048##8710##7054#. Bidang kewenangan (#11372#): Pasal 49 huruf a-i
menurut jenis perkara SIPP (341-363/743 perkawinan, 364/371 waris, 365 wasiat, 366 hibah, 367 wakaf, 370 ekonomi syariah, Lain-Lain 369 menurut kata
di petitum: perkawinan/zakat/infaq/shadaqah; selain itu "perkara lain-lain yang menjadi kewenangan Pengadilan Agama menurut undang-undang").
Isian yang dipakai tidak langsung (lewat variabel OTOMATIS) ada di kelompok tersembunyi `{\*\isianasal ...}` agar tampil di borang ABT.

## Pasang (Git Bash, server hidup) - SESUDAH semua paket 29-30 Okt lain

```bash
cd /d/.../abt-paket/sela-ps-30okt                   # folder repo hasil gabung
rm -rf paket-satker/cadangan                        # cadangan uji laptop (bila ada) jangan ikut tersalin
ssh aleta 'mkdir -p /root/abt-sela-ps-20261030'
scp -r paket-satker/* aleta:/root/abt-sela-ps-20261030/
ssh aleta 'cd /root/abt-sela-ps-20261030 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-sela-ps-20261030/pasang-satker.sh'
```

Keluaran benar: `PRASYARAT COCOK (0|0|111|0|0|2)`, `SIAP_TIMPA=2`, `BERKAS SIAP`, `CADANGAN ...`, `SEMUA COCOK`, `uji perkara ...: 69 kueri COCOK` (x6, perkara
dipilih dari SIPP server sendiri), `FOLDER BARU ...` (x2), `BUAT=96 TIMPA=2`, `COCOK=98`, `BERKAS COCOK`, `TANPA KATA NAMA APLIKASI`, `SELESAI`.
Pasang ulang: `PRASYARAT COCOK (0|117|111|0|2|2)`, `SUDAH=98`.

PRASYARAT `A|B|C|D|E|F` = nomor 11300-11499 berisi lain (0) | variabel paket persis (0/117) | variabel lama dirujuk ADA (111, termasuk 11122/11123/11130-11140
paket prodeo - **tanpa prodeo terpasang C < 111, paket berhenti**) | menu 151/152 berisi lain / folder paket dipakai menu lain (0) | menu paket persis (0/2) |
fungsi `isian_rtf_tanggal` + `isian_rtf_alamat` (2). RTF: dua berkas yang ditimpa harus md5 persis `md5_lama`; berkas baru dan folder baru tidak boleh sudah
ada; folder lama tempat berkas baru (`folder-ada.txt`) harus ada.

Pulih: `ssh aleta 'bash /root/abt-sela-ps-20261030/pulih-satker.sh'` -> akhir `PULIH COCOK`. **Tidak ada hapus permanen:** 96 berkas baru dipindah ke
`cadangan/pulih-arsip/`, 2 berkas yang ditimpa dikembalikan dari `cadangan/timpa-asal/` (isi paket juga disalin ke arsip), folder baru dilepas bila kosong,
isian perkara (abt_data_teks) nomor paket dicadangkan ke `cadangan/abt_data_teks-pulih-<waktu>.sql` SEBELUM variabel dihapus (FK cascade).

Bangun ulang (deterministik): `python sumber/bangun_paket.py <pohon derry_briantono sesudah prodeo>` (bawaan `D:/Aplikasi/aleta/tmp/bas29/dasar3/derry_briantono`).
Sumber: `sumber/isi.py` (putaran 1), `sumber/isi_31.py` (putaran 2), `sumber/mediasi_el.py` (mediasi elektronik dari blangko yang ada), `sumber/variabel.py` + `variabel_31.py`.

## Hasil uji

- **Putaran 3 (jawaban 9 pertanyaan, 30 Okt)** - `uji_lokal.sh semua` pada paket akhir: PRASYARAT `0|0|111|0|0|2` -> `SEMUA COCOK`, 6 perkara x 69 kueri COCOK,
  `BUAT=96 TIMPA=2`, `COCOK=98`; pasang ulang tanpa perubahan; pulih `ARSIP=96 KEMBALI=2` -> keadaan awal PERSIS; pasang lagi = pasang pertama; dua penjaga
  berhenti tanpa perubahan; AKHIR = KEADAAN AWAL. Render ABT asli 13 contoh (`alat/tugas_32.py`, isian `alat/isian_simulasi_32.sql`), 0 galat, 0 sisa penanda:
  [34]/[35] 517/Pdt.G/2026 (CT; nafkah iddah dan mut'ah, dikabulkan sebagian: butir 3 "Menolak ... selebihnya" otomatis), [36]/[37] 308/Pdt.G/2026,
  [32] 687/Pdt.G/2025 ("... yang dibayar tersendiri oleh para Tergugat melalui Kasir ..."), li'an CT 517/Pdt.G/2026 (dengan pengingkaran anak: amar 4 nasab
  ibu, biaya butir 5) dan CG 419/Pdt.G/2026 (suami = Tergugat, biaya butir 4), mediasi elektronik ALUR 04/05 [1e] 419/Pdt.G/2026, ALUR 34 376/Pdt.G/2025
  (sebutan Pemohon/Termohon dari #0046#/#0047#), ALUR 36/37, PTSP @ 4a. Diperbaiki saat membaca: kalimat "ditetapkan yang dibayar ..." di [32].

- **Pasang/pulih laptop** (`sumber/uji_lokal.sh semua`; basis sendiri `aps_badilag_sela30` = dump server 28 Okt + paket prodeo-panggilan-29okt w125;
  pohon uji `D:/Aplikasi/aleta/tmp/sela30/blangko`): PRASYARAT `0|0|110|0|0|2` -> `SEMUA COCOK`, uji kueri 6 perkara x 63 kueri COCOK, `BUAT=68 TIMPA=2`,
  `COCOK=70`; pasang ulang tanpa perubahan apa pun; pulih -> `ARSIP=68 KEMBALI=2`, `PULIH COCOK`, keadaan awal PERSIS (sidik menu, variabel, pohon) dan
  70 berkas di `cadangan/pulih-arsip`; pasang lagi = sidik pasang pertama; penjaga: menu 151 dipakai lain -> `0|0|110|1|0|2` BERHENTI tanpa perubahan;
  berkas yang akan ditimpa disunting -> `BERKAS TIDAK SIAP` BERHENTI tanpa perubahan; AKHIR = KEADAAN AWAL.
- **Render renderer php56 ABT asli** (`alat/render.py`, `alat/tugas_31.py`; isian rekaan hanya di basis salinan: `alat/isian_simulasi.sql` + `alat/isian_simulasi_31.sql`):
  putaran 2 = 32 contoh, 0 galat render, 0 sisa `#nnnn#`, dibaca seperti hakim:
  - eksepsi kabur [16]/[17] 308/Pdt.G/2026 (HB): Pasal 49 huruf a "bidang perkawinan", Dalam Eksepsi / Dalam Pokok Perkara, biaya Pasal 89 ayat (1) Rp239.000,00 + rincian;
    sisipan berkaki "Putusan Nomor"; keliru pihak [18] 620/Pdt.G/2025; kurang pihak [20]/[21] dan ne bis in idem [22] 546/Pdt.G/2024 ("para Penggugat",
    biaya Rp169.500,00); prematur [24]/[25] 419/Pdt.G/2026;
  - rekonvensi [26] 637/Pdt.G/2025; penggabungan [27]/[28] 620/Pdt.G/2025; sumpah pemutus [29] 637/Pdt.G/2025 (Tergugat dibebani, lafal Islam);
    penaksir [30] 620/Pdt.G/2025 (batas Rp20.000.000,00); li'an [31] 517/Pdt.G/2026 (cerai talak);
  - mediasi: [32] 687/Pdt.G/2025 (para Tergugat, huruf a; mediator & tanggal laporan dari SIPP; "Demikian ditetapkan ... penetapan tersebut diucapkan ...");
    [33] 419/Pdt.G/2026 (huruf b, d; NO + biaya mediasi + biaya perkara Rp184.500,00, e-Court);
  - BAS [3]/[3a] 167/Pdt.G/2026 dan [3a] 42/Pdt.P/2026, [4]/[4a] 637/Pdt.G/2025, [5]/[5a] 620/Pdt.G/2025, [6] 517/Pdt.G/2026 (empat kali + kelima, laknat/murka);
  - mediasi elektronik [1e] 419/Pdt.G/2026 (CG) dan 546/Pdt.G/2024 (waris), PTSP @ 4a 419/Pdt.G/2026; BAS PS cerai 419/Pdt.G/2026, BAS PS HB 637/Pdt.G/2025.
  - Diperbaiki saat membaca: "elektronikmelalui" (ABT memangkas spasi awal nilai variabel -> spasi dipindah ke blangko), kalimat huruf PERMA dua atau lebih
    huruf disambung ", serta", rumusan sumpah pemutus dan tuduhan li'an dikutip (kalimat orang pertama).
- **Repo** (putaran 3: sela-ps-30okt + panel 31/31, 96 berkas uji terkait 1805 lulus; satu merah `k11-peta-fitur-26okt` (md5 `basmassal.js`) sudah merah di basis d47fc2c1, berkas itu tidak disentuh paket ini; tsc bersih). Putaran 2: `src/test/sela-ps-30okt.test.ts` 23/23 (matriks 33 blangko, kalimat baku, #11370#, NO, sisipan, BAS 9, PS 8 folder, mediasi elektronik 19+1, saran portal);
  `src/test/blangko-derry-sela-30okt.test.ts` 8/8 (panel jsdom); panel lain yang menyentuh jendela Pilih blangko 19 berkas 330 uji hijau; saran blangko
  (alur-bas-baru, rekomendasi-blangko-q3, rekomendasi-status-keterangan-27okt, sidang-keadaan-rekomendasi-q3, pemetaan-*, w3a/w3b, saran-semua-jenis) hijau; tsc bersih.
- **Saran blangko portal** (`lib/rekomendasi-blangko.ts`): sumpah pemutus/penaksir (gugatan) -> [29]/[30]; li'an (cerai) -> [31]; "tidak beriktikad baik" ->
  [32] tergugat (utama) / [33] penggugat; rekonvensi (putusan sela) -> [26]; penggabungan -> [27]/[28]; eksepsi kabur/keliru pihak/kurang pihak/ne bis in idem/
  prematur (bukan kewenangan) -> sisipan ditolak (utama) + NO dikabulkan; BAS sumpah: tunda (utama) atau "... dan/lalu putusan/musyawarah" -> varian `a`;
  keterangan "mediasi ... elektronik/daring/online/virtual" -> BAS [1e] di folder yang sama didahulukan, [1] alternatif.
- **Panel ekstensi** (`ekstensi-sipp/blangko-derry-isian.js`): tab "Putusan sela" tepat sesudah tab "Putusan" pada jendela Pilih blangko, hanya bila menu
  Derry memuat kelompok putusan sela yang boleh dibuka akun itu; kelompok per pokok sela (Eksepsi kewenangan mengadili, Eksepsi lain, Tuntutan provisi,
  Intervensi pihak ketiga, Sumpah, Pemeriksaan setempat, Sita, Tidak beriktikad baik dalam mediasi, Gugatan rekonvensi, Penggabungan perkara) dengan
  keterangan status (dikabulkan, ditolak, perkara tidak dapat diterima, bagian putusan akhir, penetapan), lalu butir `[Sela]` per jenis perkara (jenis perkara
  terpilih naik ke atas); butir dibuka lewat kelompok ASLINYA (hak folder asal). **Perlu rilis ekstensi** (skill `rilis-ekstensi`, sesi utama).

## Catatan pasal PERMA 3/2022 (butir 6 putaran 3)

Naskah resmi PERMA 3/2022 (JDIH Mahkamah Agung) TIDAK dapat dibuka dari laptop (cermin datahukum.com menolak, pasal.id kosong). Nomor pasal yang dikutip
berasal dari beberapa sumber sekunder yang isinya sama: **Pasal 5** = mediasi elektronik dilaksanakan setelah para pihak dan/atau kuasanya memberikan
persetujuan; **Pasal 6** = hakim pemeriksa perkara menyerahkan formulir persetujuan mediasi secara elektronik (hukumonline, skripsi PA Sarolangun, kutipan
datahukum). "Kehadiran melalui audio visual dianggap kehadiran langsung" BUKAN dari PERMA 3/2022 melainkan **Pasal 5 ayat (3) dan Pasal 6 ayat (2) PERMA 1/2016**
(laman PN Gunungsitoli dan kepaniteraan MA) - blangko mengutipnya begitu. Pasal pemilihan aplikasi (disebut Pasal 10 oleh satu sumber saja) TIDAK dikutip.
**Mohon dicocokkan dengan salinan resmi sebelum dipasang**; bila berbeda cukup ubah teks di `sumber/mediasi_el.py` lalu bangun ulang.

## Pertanyaan hukum baru (putaran 3) - dengan usulan

1. **Putusan akhir li'an**: amar "tidak dapat rujuk dan tidak dapat menikah kembali untuk selama-lamanya" berdasar KHI Pasal 125. KHI Pasal 70 (batal bila
   menikahi bekas istri yang telah dili'an) sengaja TIDAK dikutip karena hurufnya belum dapat dipastikan dari naskah. Usulan: tetap tanpa Pasal 70. Untuk cerai
   talak amar tidak memuat izin ikrar talak (putus karena li'an, bukan talak) - benar?
2. **Li'an**: iddah/nafkah istri sesudah li'an tidak diamarkan (KHI 162 hanya membebaskan suami dari nafkah anak yang diingkari). Perlu butir lain?
3. **Pemisahan perkara dikabulkan**: amar "memisahkan pemeriksaan ... untuk diperiksa dan diputus sebagai perkara tersendiri"; di praktik bagian itu perlu
   didaftarkan sebagai perkara baru (panjar baru). Perlu butir "memerintahkan ... mendaftarkannya sebagai perkara tersendiri"?
4. **Sisipan rekonvensi**: sebutan "Penggugat Rekonvensi/Tergugat Rekonvensi" untuk semua jenis (cerai talak lazim "Termohon Konvensi/Penggugat
   Rekonvensi" pada kali pertama). Usulan: cukup seperti sekarang.

## Pertanyaan hukum putaran 2 (SUDAH DIJAWAB 30 Okt dan diterapkan di putaran 3: 1 tetap penetapan akhir, 2 sisipan cukup, 3 sisipan rekonvensi, 4 putusan akhir li'an, 5 benar, 6 pasal + ALUR 05/34/36/37, 7 cara bayar Pasal 23 ayat (4), 8 splitsing, 9 benar)

1. **Penetapan sela permohonan [14]**: kalimat baku diminta "... hingga putusan akhir"; untuk permohonan dipakai "Menangguhkan pembebanan biaya perkara hingga
   penetapan akhir." Usulan: tetap "penetapan akhir" (produk akhir permohonan adalah penetapan). Atau persis "putusan akhir" juga di permohonan?
2. **Eksepsi lain ditolak** dibuat sebagai SISIPAN (bagian Dalam Eksepsi untuk disalin ke putusan akhir), bukan putusan sela berdiri sendiri, karena Pasal 162
   RBg (diperiksa dan diputus bersama pokok perkara). Usulan: tetap sisipan. Perlu juga versi putusan sela berdiri sendiri?
3. **Rekonvensi**: hanya "tidak dapat diterima" sebagai putusan sela (konvensi dilanjutkan); rekonvensi dikabulkan/ditolak lazimnya di putusan akhir "Dalam
   Rekonvensi". Usulan: cukup [26]. Perlu sisipan "Dalam Rekonvensi" dikabulkan/ditolak?
4. **Putusan akhir li'an** (perkawinan putus selamanya, Pasal 125 KHI; anak bernasab kepada ibu, Pasal 162 KHI) BELUM dibuat - hanya putusan sela + BAS
   sumpah li'an. Usulan: dibuat di folder 1/1a pada putaran berikut. Lafal li'an hanya menurut Islam (li'an khusus perkawinan Islam) - benar?
5. **Sumpah pemutus dan penaksir** hanya untuk gugatan (permohonan tidak berlawanan). Pihak dibebani bawaan sumpah pemutus = #0047# (isian 11382 = P bila
   sebaliknya); sumpah penaksir = pihak menurut isian 11338 (bawaan #0046#). Benar?
6. **PERMA 3/2022**: blangko menyebut nama peraturannya saja, belum nomor pasal (persetujuan para pihak, sarana, domisili elektronik). Usulan: sebutkan
   pasal yang dikehendaki - cukup diubah satu kalimat. BAS [1e] dibuat hanya untuk `BAS ALUR 04 [1]` (19 folder); varian lain (ALUR 05 [1] lisan,
   ALUR 34/36/37 "Sidang 1 - Mediasi") belum - perlu?
7. **Penetapan tergugat tidak beriktikad baik [32]**: biaya mediasi dihukumkan tanpa menyebut cara bayar (Pasal 23 ayat (4): masuk panjar atau dibayar
   tersendiri). Usulan: tanpa kalimat cara bayar. Perlu ditambah?
8. **Penggabungan perkara**: dasar = praktik peradilan (tidak diatur RBg) + asas sederhana, cepat, biaya ringan Pasal 2 ayat (4) UU 48/2009; pemisahan
   perkara (splitsing) belum dibuat. Benar / perlu?
9. **Mediasi penggugat tidak beriktikad baik [33]** pada perkara cerai: biaya perkara mengikuti Pasal 89 ayat (1) (dibebankan kepada Penggugat); prodeo = DIPA.
   Benar?

(Pertanyaan putaran 1 sudah dijawab pengguna 30 Okt dan diterapkan seluruhnya: 1 sita tetap + tab panel, 2 [98e]/[98f] dibiarkan + kalimat baku, 3 NO,
4 Pasal 196 ayat (1) RBg, 5-6 sesuai, 7 semua jenis sumpah + BAS lalu putus, 8 PERMA 1/2016 + mediasi elektronik, 9 eksepsi lain/rekonvensi/penggabungan/
sumpah penaksir & pemutus, 10 Pasal 49/50, 11 kesimpulan + gambar situasi + BAS PS cerai, 12 panjar PS, 13 timpa BAS PS HB/waris.)
