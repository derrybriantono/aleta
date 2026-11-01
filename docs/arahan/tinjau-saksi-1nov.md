# Tinjauan "Susun keterangan saksi" - 1 Nov 2026 (agen F, tinjauan saja)

Permintaan Derry (rencana 1 Nov bagian 5): tinjau menyeluruh fitur susun keterangan saksi atas SELURUH jenis perkara x SELURUH
pengetahuan saksi (centangan & dropdown panel) x SETIAP arah putusan. **Tidak ada kode atau paket yang diubah.** Semua skrip,
keluaran mentah, dan render ada di `D:/Aplikasi/aleta/tmp/w156/` (daftar di bagian 7).

## 0. Ringkas untuk Derry

Ada DUA mesin yang berbeda mutunya:

| | Mesin katalog (`saksi-katalog.js` + 45 katalog) | Jalur cerai Blangko Derry (`set-pertanyaan-saksi.ts` + bot `saksi-sdg`) |
|---|---|---|
| Dipakai | panel ABT "Susun saksi menurut keadaan perkara" (semua jenis) dan Blangko Derry NON-cerai | Blangko Derry cerai (346/347): draf otomatis saat penyunting dibuka, tombol Muat, "Susun keterangan saksi 1 & 2" |
| Pilihan pengetahuan | 6 jenis + 8 profil per saksi, per butir, "berbeda" per butir, centang alasan | 8 modus (saksi 1 & 2), sumber cerita, centang alasan |
| Dua saksi sama persis | dijamin tidak pernah | **7-14 dari 22-28 butir sama persis** |
| Sebab dari gugatan | saran (kuning, ragu) - keputusan T2 | **"cukup" (hijau), tersimpan otomatis** |
| Arah putusan | tidak dikenal | tidak dikenal |

Lima temuan berdampak paling besar (rinci di bagian 2):
1. **Draf cerai menyusun kesaksian yang menguatkan dalil dan menandainya "dari data" lalu TERSIMPAN OTOMATIS** - termasuk
   "Saya pernah melihat dan mendengar sendiri ... bertengkar beberapa kali" yang ditandai bersumber "gugatan" walau gugatannya
   kosong. Atas 13 perkara cerai DITOLAK sungguhan: saksi asli tidak pernah melihat pertengkaran pada 9 dari 15 jawaban, tidak
   tahu sebab pada 7 dari 16, tidak tahu upaya damai pada 7 dari 20 - draf menulis sebaliknya.
2. **Saksi Tergugat/Termohon (BAS Pembuktian T) mendapat draf saksi Penggugat**: "saya adalah ... Penggugat", sebab = posita
   Penggugat, "melihat sendiri bertengkar".
3. **Alamat Tergugat sekarang (verstek) diisi kediaman bersama** dari posita: "Sekarang Tergugat tinggal di rumah orang tua
   Penggugat di Desa ... / tidak diketahui keberadaannya" - bertentangan dengan butir "yang meninggalkan = Tergugat", pilihan
   "/" tidak dipilih, dan tersimpan otomatis.
4. **Panel ABT itsbat kontensius (360 alur 15; 81 perkara di SIPP)**: bentuk bawaan "permohonan berdua" -> tercetak
   "Penggugat I dan Penggugat II" (Blangko Derry sudah benar karena membaca alur; panel tidak).
5. **Arah putusan tidak menjadi masukan sama sekali**: 78 blangko [Tolak]/[Tolak Verstek] dan 52 blangko [NO] sesudah
   pembuktian mencetak tanya-jawab saksi apa adanya, sedangkan bawaan pengetahuan saksi selalu "tahu seluruhnya/melihat sendiri".
   Data nyata: saksi perkara cerai ditolak 55-57% "tidak tahu sebab" (perkara dikabulkan 5-11%).

## 1. Ukuran matriks yang diuji

Semua dengan KODE ASLI (worktree w156 = gabung-56 92d7f6e8), kaki palsu seperti uji yang ada (variabel tiruan `«kode»`, isian
petugas tiruan `«slot»`, sebutan dari jenis/alur).

| # | Lapisan | Kombinasi | Jumlah susunan |
|---|---|---|---|
| 1 | Mesin katalog - 33 katalog utama (45 berkas, termasuk 7 katalog saksi Tergugat dan 2 kumulasi) | tiap dropdown/centang keadaan x tiap nilai (dengan konteks induk), 6 jenis keterangan + profil katalog (8 cerai, 9 HB/waris, 6 ES/hibah/wakaf/wasiat), keadaan per saksi (keluarga/bukan, kedudukan saksi nikah), 2-5 saksi, saksi T x tiap bantahan, "berbeda" tiap butir yang mendukungnya, 12 centang alasan; cerai: alasan A-H x kehadiran 3 x 14 jenis/profil x pisah 2 x anak 2 | 8.063 |
| 1b | Keterangan pihak dispensasi kawin (anak, calon, orang tua) | 4 peran x 8 keadaan x 6 jenis x konfirmasi sebab | 252 |
| 1c | Uji berpasangan dropdown tak berpengaruh | tiap dropdown x tiap nilai dropdown lain | 33 katalog |
| 2 | Jalur cerai Blangko Derry | CG/CT x huruf F,A,B,C,D,E,G,H,AF,DF,BF x kehadiran 3 (verstek / kontradiktoir / T tidak hadir sesudah mediasi) x modus saksi 1 (8) x modus saksi 2 (4) x posita ada/tidak, + sumber cerita 3 + 16 centang alasan | 5.229 |
| 3 | Arah putusan - pemetaan blangko | 1.880 RTF Derry (pohon `D:/r152b`, sesudah 24 paket) -> status di nama x variabel keterangan saksi | 1.880 |
| 4 | Data nyata | 70.045 jawaban / 2.358 perkara `abt_keterangan_saksi` (dump 28 Okt) x status putusan SIPP | - |
| 5 | Perkara sungguhan vs draf | 247 perkara cerai (SEMUA 82 non-kabul bersaksi + 165 sampel kabul), posita SIPP, draf bawaan vs ketikan petugas | 247 |
| 6 | Cakupan pertanyaan | pertanyaan nyata (>=10% saksi) vs butir katalog, 9 jenis | - |
| 7 | Render php56 ABT asli | 7 kelompok, asli vs draf/panel (bagian 6) | 24 dokumen |

## 2. Temuan menurut dampak

### A. Isi keliru/salah arah yang TERSIMPAN OTOMATIS (dampak tertinggi)

**A1. Draf cerai = kesaksian yang menguatkan dalil, ditandai "dari data", tersimpan otomatis.**
Alur: penyunting tanya jawab dibuka -> set yang disarankan dipasang (`drafSaksiOtomatis`) -> bot `saksi-sdg` mengisi dengan modus
bawaan saksi 1 "sama", saksi lain "sebagian" -> baris yang berubah dari kalimat contoh dihitung `asalBaris` = **"data"**
(`otomatis === jawab` dan usulan tidak "ragu") -> **begitu petugas mengetik di satu kotak saja**, `simpanTjOtomatis` mengirim
SELURUH baris "data/ragu" saksi itu ke ABT (keputusan 42).
- Baris yang sesungguhnya tidak punya sumber data ikut "data": `Saya pernah melihat dan mendengar sendiri Penggugat dan Tergugat
  bertengkar beberapa kali;` membawa `usulan {yakin: "cukup", sumber: "gugatan"}` **juga ketika posita kosong** (titik-titik
  "sebanyak ... kali, di ..." diganti "beberapa kali"); `Pertengkaran ... berbentuk adu mulut dan saling mengucapkan kata-kata
  kasar, dan terjadi berulang kali;` cukup diragamkan urutan katanya oleh pemilih ragam untuk lolos dari "contoh".
- Penyebab dari posita = `yakin "cukup"` (hijau). Jalur katalog memperlakukan sebab yang hanya didalilkan posita sebagai SARAN
  (ragu, kuning) - keputusan T2 25 Okt; jalur cerai tidak.
- Dari 22 butir draf CG verstek (perkara rekaan, posita lengkap): 13 "data", 5 "contoh", 4 "kosong" (`cek-c2.js`).
- **Ukur atas perkara nyata** (`nyata-cerai.js`, 247 perkara): jawaban petugas yang NEGATIF ("tidak tahu", "tidak pernah melihat",
  "dari cerita") sedangkan draf POSITIF:

| status | perkara | penyebab | pernah melihat/mendengar | upaya merukunkan |
|---|---|---|---|---|
| Ditolak | 13 | 7/16 | 9/15 | 7/20 |
| NO | 28 | 4/33 | 17/31 | 4/32 |
| Dicabut | 23 | 1/22 | 3/13 | 1/22 |
| Dikabulkan (sampel) | 165 | 11/306 | 62/263 | 4/302 |

  Contoh 371/Pdt.G/2024/PA.Dgl (CT, **Ditolak**): asli "Saya tidak tahu pasti apa yang menjadi penyebab ...", "Saya tidak pernah
  melihat dan mendengar langsung Pemohon dan Termohon bertengkar", "Saya juga tidak mengetahui apakah sudah ada upaya dari pihak
  keluarga ..."; draf: "Ya, penyebabnya karena Termohon tidak taat ... nasehat yang di sampaikan oleh Pemohon" (bunyi posita),
  "Saya pernah melihat dan mendengar sendiri Pemohon dan Termohon bertengkar beberapa kali", "Sudah, Pemohon dan Termohon pernah
  dirukunkan oleh keluarga Pemohon, tetapi tidak berhasil". Sama pola pada 403/Pdt.G/2023 (NO), 405/Pdt.G/2023 (Tolak),
  331/Pdt.G/2024 (NO), 430/Pdt.G/2023 (NO), 413/Pdt.G/2023 (NO).
  Render: `render/G2-cg-tolak-hadir-putusan-*.txt`, `render/G3-ct-tolak-hadir-putusan-*.txt` (bagian 6).
- Catatan komentar kode bertentangan: `blangko-derry-isian.js` (drafSaksiOtomatis) masih menulis "Tidak tersimpan ke ABT sebelum
  petugas menekan Simpan ke ABT", sedangkan keputusan 42 membuatnya tersimpan saat petugas mengetik.

**A2. Saksi Tergugat/Termohon mendapat draf saksi Penggugat (cerai, Blangko Derry).**
`drafSaksiOtomatis` memasang set yang sama untuk SEMUA daftar yang dibuka; rute `set-saksi` tidak mengenal pihak saksi dan
`set-pertanyaan-saksi.ts` tidak punya set Tergugat. Pada `BAS ALUR 04 [7] Pembuktian T` saksi 1 T (`cek-t.js`): "Saya kenal ...,
saya adalah ... Penggugat;", "Sumber pertengkaran mereka adalah Tergugat melalaikan kewajiban nafkah lahir, berkata kasar dan
suka bermain judi;", "Saya pernah melihat dan mendengar sendiri ... bertengkar beberapa kali;" - semuanya "data". Katalog Tergugat
(`cerai-gugat-tergugat.json`, `cerai-talak-tergugat.json`, versi bantahan) sudah ada, tetapi hanya dipakai panel ABT.

**A3. Alamat Tergugat sekarang (tambahan verstek) diisi kediaman bersama.**
Templat `Sekarang {T} tinggal di ... / tidak diketahui keberadaannya;` diisi fakta "kediaman" posita: "Sekarang Tergugat tinggal
di rumah orang tua Penggugat di Desa Contoh / tidak diketahui keberadaannya;" (`usulan.yakin "cukup"` -> "data" -> tersimpan),
padahal butir 13 menyebut Tergugat yang pergi meninggalkan kediaman itu. Matriks: 4.284 kemunculan (setiap verstek/setelah
mediasi dengan posita yang menyebut kediaman). Juga di CT ("Termohon tinggal di rumah orang tua Termohon" - kebetulan benar).
Sisa garis miring pilihan "/" ada pada 16.192 baris matriks (alamat T, "Saya melihat sendiri ... / saya melihat bekas luka",
"sejak ... / tidak pernah", sikap T); yang ditandai server "pilihan" tidak dipasang, tetapi baris alamat T lolos.

**A4. Panel ABT: itsbat kontensius tercetak "Penggugat I dan Penggugat II".**
`turunkanKeadaan` (saksi-susun.js) tidak menurunkan `bentuk` itsbat dari alur; bawaan katalog "permohonan-berdua". Perkara 360
alur 15 = 81 di SIPP (21 bersaksi; mis. 542/Pdt.G/2026 pasangan meninggal). Hasil panel: "Sejak kapan Saudara mengenal Penggugat I
dan Penggugat II ...". `blangko-derry-katalog.js` sudah menurunkannya (keadaanDariData). Render G4 (bagian 6).

**A5. Arah putusan tidak dikenal kedua mesin.**
- Pemetaan 1.880 blangko (`blangko-var-saksi-r152b.tsv`): mencetak tanya-jawab saksi (#9259-#9265 / #5058-#6121) = Kabul 128 +
  Kabul Verstek 39, **Tolak 57, Tolak Verstek 21, NO 52** (NO kontradiktoir cacat formil, kurang pihak, obscuur libel, itsbat
  poligami sirri, ...), Cabut 3 (sesudah pembuktian). Tidak mencetak: Gugur 45, Coret 36, Cabut sebelum pembuktian 65, NO
  formil 74, Sela 29, [Tolak Verstek] Tidak ada bukti 2 - semuanya benar (tidak ada saksi).
- Tidak ada satu pun masukan "arah" ke mesin: memilih blangko [Tolak] Cerai F Tidak Terbukti / [Tolak Verstek] Kurang 6 Bulan /
  Unus Testis tidak mengubah bawaan "tahu seluruhnya", lama pisah bawaan "enam bulan atau lebih", jumlah saksi minimal 2.
- Data nyata (`nyata-arah.js`, saksi per kelompok): cerai Ditolak hadir: tidak tahu sebab 55%, menjawab "tidak tahu" 60%, dari
  cerita 25%; Ditolak verstek: 57% / 86% / 57%; NO verstek: dari cerita 52%, menyebut pisah <= 5 bulan 71%. Dikabulkan verstek:
  5% / 6% / 13%.
- Damai/cabut/gugur: tidak ada blangko yang mencetak keterangan saksi selain [Cabut] 5 "Setelah Pembuktian" -> tidak ada
  keterangan perceraian yang tercetak pada perkara damai (aman).

### B. Kalimat bertentangan dengan pengetahuan saksi yang dipilih

- **B1 (katalog cerai, de auditu)** `q-saksi-lihat`: "menurut cerita ibu kandung saya mereka pernah bertengkar di hadapan saya dan
  saya tidak menyaksikannya sendiri"; varian lain "... bahwa saya pernah mengalami sendiri mereka bertengkar di tempat saya berada
  dan saya tidak berada di tempat kejadian" (69 kemunculan per jenis cerai). Render G5.
- **B2 (16 butir di 11 katalog) butir pengetahuan DIRI saksi diberi jawaban de auditu / tidak tahu**: `q-upaya-saksi` ("saya
  mengetahui upaya saksi merukunkan mereka berdasarkan cerita ibu kandung saya"), `q-sanggup-damai` ("saya sama sekali tidak
  mengetahui kesanggupan saksi mendamaikan mereka"), `q-cara-tahu`, `q-saksi-lihat` ("saya tidak mengetahui pertengkaran yang
  saksi lihat atau dengar sendiri"), itsbat `q-in-hadir-*` ("kehadiran saksi pada pernikahan itu ... dari cerita"), ganti rugi
  wali `q-dasar-nilai`, permohonan umum `q-sebab-tahu`. Penyebab: `hal` berbunyi orang ketiga "saksi" dan `tidakBerlaku` tidak
  memuat de-auditu/tidak-tahu.
- **B3 Jawaban umum (jawabanUmum) de auditu/mendengar tidak menjawab pertanyaan fakta**: "Apakah ... sudah dikaruniai anak?" ->
  "ibu kandung saya memberi tahu saya tentang anak mereka sedangkan saya tidak ada di tempat kejadian"; jenis "mendengar" ->
  "saya sendiri yang mendengar langsung perkataan mereka tentang anak mereka" (juga ketika anak = tidak; 240 per jenis cerai).
  Berlaku untuk semua butir fakta tanpa jawaban khusus (lama nikah, pekerjaan, harapan rukun, ...).
- **B4 Jalur cerai, modus "Ragu dan kurang ingat"**: jawaban butir 7 dan 11 tertukar - "sering bertengkar, sejak kapan?" -> "Saya
  kurang ingat kapan puncak pertengkaran itu terjadi"; "puncak?" -> "Saya lupa kapan tepatnya mereka mulai berselisih". Modus
  "Tidak pernah menyaksikan": sumber yang dipilih (Penggugat) diganti "Dari cerita tetangga mereka" / "dari keluarga mereka". Modus
  ragu/tidak menyaksikan/dari cerita: butir "bentuk pertengkaran" tetap "adu mulut ... berulang kali" tanpa penanda cerita/ragu.
  Modus "tahu-pisah"/"tidak-tahu": benar.
- **B5 Izin poligami, anak = tidak** (keadaan tidak dideklarasikan): 13 butir tetap "anak-anak Penggugat dan Tergugat ...",
  "menanggung kebutuhan Tergugat dan anak-anak mereka".
- **B6 Cerai verstek + masih serumah**: `q-lawan-kabar` "selama berpisah Tergugat tidak pernah datang menemui ..." (896 matriks).
- **B7 Kumulasi nafkah iddah/mut'ah + "istri didalilkan nusyuz"**: `q-istri-tidak-nusyuz` tidak punya jawaban untuk nusyuz = ada
  -> butir hilang (hanya peringatan; 60 matriks).
- **B8 CT, saksi Pemohon** `q-nafkah-pisah`: bawaan "Pemohon tidak lagi menanggung kebutuhan Termohon sejak mereka berpisah" -
  keterangan yang merugikan Pemohon dan bahan nafkah madliyah ex officio; perlu keputusan (pertanyaan 5).

### C. Kerapian kalimat

- C1 Jalur cerai: saksi 1 dan 2 berbunyi SAMA PERSIS pada 7-14 dari 22-28 butir (34.023 baris kembar di matriks; contoh
  "Penggugat dan Tergugat adalah suami isteri yang sah, menikah pada ...", "Selama berpisah Tergugat tidak pernah lagi memberi
  nafkah ..."). Mesin katalog menjamin beda (0 kembar).
- C2 "Ya," di depan jawaban pertanyaan terbuka (2.550): "Ya, penyebabnya sebab ...;" (tanpa posita), "Ya, penyebab pastinya saya
  tidak mengetahui ...", "Ya, saya mendengar dari Penggugat sendiri bahwa yang menjadi penyebab adalah ...".
- C3 Kata ganda: "dari penuturan ibu kandung saya saya tahu bahwa ..." (sumber yang diketik berakhiran "saya"; petunjuk panel
  "mis. ibu kandung"), "objek-objek itu itu" (HB `q-sumber-dana`, 7 jenis), "antara para pemohon Pemohon bercerita" (AUA,
  kelalaian kewajiban, penunjukan wali).
- C4 Huruf besar di tengah kalimat: "dari cerita yang sampai kepada saya Puncaknya terjadi ..." (modus dari cerita/tidak
  menyaksikan; 12/2.544).
- C5 Pencabutan kekuasaan orang tua: 138 kalimat "sejak ... dan lain-lain" (sisa templat), mis. "tidak memberi nafkah ... sejak
  ... dan lain-lain, sedangkan selebihnya kurang saya ketahui".
- C6 Jalur cerai menyalin bunyi posita (termasuk salah ketik "nasehat yang di sampaikan") ke mulut saksi. Ini BUKAN teks pihak
  (keputusan 55 tidak berlaku: keterangan saksi), jadi perapian boleh/perlu - minta keputusan bila ragu.
- C7 Butir kontradiktoir "Bagaimana tanggapan P dan T ketika dinasihati?" dijawab "telah pernah diupayakan untuk dirukunkan oleh
  keluarga tetapi tidak berhasil" (mengulang butir upaya, tidak menjawab tanggapan; "telah pernah").
- C8 Pertanyaan ganda dijawab separuh: "Siapa yang meninggalkan ..., dan sekarang masing-masing tinggal di mana?" -> hanya "Yang
  meninggalkan kediaman bersama adalah Tergugat;".
- C9 Katalog: 150 butir di 16 katalog memuat titik-titik HARFIAH di kalimat (HB 50, waris 37, PAW 13, pencabutan wali 12, ...);
  panel ABT hanya memerahkan baris ber-`kosong` (slot/variabel), titik-titik harfiah tidak ditandai (Blangko Derry menandainya).

### D. Dropdown/centang yang tidak berpengaruh (uji berpasangan, `inert.js`)

- Tidak berpengaruh sama sekali: cerai `bentukKesaksian` (dari kumulasi itsbat; dideklarasikan, tak dipakai satu syarat pun);
  ekonomi syariah `pengaju`; pencabutan kekuasaan orang tua dan wali `kehadiran`; penguasaan anak `kedudukanPengaju`.
- Centang yang tidak mengubah apa pun (keadaan bawaan): `kumulasi` pada hak asuh (7 dari 8 nilai), harta bersama (7), izin
  poligami (7), pembatalan (7), cerai (rekonvensi); hibah `pokokTuntutan` C/D/F, `jenisObjek` benda lain; wasiat `jenisObjek`
  (3), `pokokTuntutan` C; `tuntutanTambahan` uang paksa/serta merta (ES, hibah, wakaf, wasiat); nafkah anak `jenisNafkah`
  ke depan; kelalaian kewajiban `kelalaian` rumah tangga/berbakti; ganti rugi wali `bentukPenggantian` uang. Penyebab umum:
  `keadaanUntukBorang` menampilkan SELURUH nilai baku `kumulasi` begitu satu syarat menyebutnya.
- Profil "Tahu seluruhnya, melihat sendiri" (cerai, HB, waris) dan "hadir sendiri" (ES, hibah, wakaf) = sama persis dengan jenis
  "melihat" (wajar, hanya label ganda).

### E. Jenis/alasan yang belum punya set dan pertanyaan kurang/berlebih

- Tanpa katalog: **745 Pengangkatan Anak** (jenis SIPP baru; katalog pengangkatan anak hanya 369 + nama), **744 Perjanjian
  Perkawinan**, 369 alur 15 yang bukan hak asuh (8 perkara). Bot `kodeJenis` juga belum mengenal 361, 343, 352, 353, 355-357, 359,
  744, 745 (jatuh ke "umum").
- Jalur cerai Blangko Derry: tidak ada set saksi Tergugat (A2); tidak ada set "pisah kurang 6 bulan", "masih serumah"
  (ada tambah-serumah, tidak disarankan otomatis), "unus testis".
- Berlebih: katalog cerai menyusun **39 butir per saksi** (panel), set Blangko Derry 22-28; praktik PA Donggala median **15**
  (p90 18) per saksi cerai (4.078 saksi). Itsbat 28 vs 15, DK 28 vs 18, izin poligami 63 vs (2 saksi nyata) 13, PAW 21 vs 17.
- Kurang (pertanyaan nyata >=10% saksi tanpa padanan; `cakupan-tanya.txt`): kebanyakan sudah tercakup dengan bunyi lain.
  Yang betul-betul belum: poligami "tanggapan keluarga terhadap rencana poligami" (100% dari 2 saksi), PAW "dengan siapa almarhum
  menikah" (37%, ada sebagai jawaban bukan pertanyaan), wali adhal "hubungan Pemohon dengan wali" (100% dari 6).

### F. Data di basis (dump 28 Okt)

- 2.831 jawaban di 126 perkara memakai `saksi_id` yang sudah tidak ada di `perkara_pihak5` (tidak tercetak per nama saksi).
- 153 jawaban di 7 perkara memakai saksi milik PERKARA LAIN (mis. 42/Pdt.P/2025 -> saksi 345/Pdt.G/2025; 604/Pdt.G/2025 ->
  saksi 228/Pdt.P/2025).
- 177 saksi di 117 perkara tersimpan di lebih dari satu sidang (mis. 231/Pdt.G/2026 sidang 2 dan 7).
- 670 jawaban masih bertitik-titik.
Ini kebiasaan ABT/petugas, bukan buatan ALETA; disebut karena panel/blangko membaca data ini.

## 3. Yang sudah benar (tidak perlu diubah)

- Mesin katalog: 0 jawaban kembar antar saksi, 0 penanda mentah, 0 saksi tanpa pertanyaan, peringatan pokok bila semua saksi
  ragu/tidak tahu, sebutan pihak dari jenis/alur (pelaku = #0047# Tergugat/Termohon, tidak tertukar di 8.063 susunan).
- Keterangan pihak DK: 252 susunan tanpa jawaban kosong/ganda.
- Jalur cerai: sebutan CT benar (0 "Penggugat/Tergugat" di CT), nafkah CT tidak terbalik, modus tahu-pisah/tidak-tahu benar,
  tanpa kata nama aplikasi.
- Blangko damai/cabut/gugur/coret/NO formil tidak mencetak keterangan saksi.

## 4. Usulan (urut dampak, lalu usaha)

| # | Usulan | Dampak | Usaha |
|---|---|---|---|
| 1 | Butir yang HANYA diketahui saksi (pernah melihat/mendengar, bentuk pertengkaran, upaya keluarga, sanggup merukunkan) tidak pernah "data": tetap "contoh" walau diragamkan; penyebab dari posita = "ragu" (samakan T2). Akibatnya tidak ikut simpan otomatis. | tinggi | kecil (bot `isiJawabanSaksi*` + `asalBaris`) |
| 2 | Saksi T cerai: jangan pasang set P; pakai katalog `cerai-*-tergugat` atau biarkan kosong + kabar | tinggi | kecil-sedang |
| 3 | Alamat Tergugat sekarang: jangan diisi kediaman bersama; baris berpilihan "/" selalu "pilihan" | tinggi | kecil |
| 4 | Panel: turunkan `bentuk` itsbat dari alur (salin dari blangko-derry-katalog) | tinggi | kecil |
| 5 | Arah putusan sebagai masukan: bila blangko [Tolak]/[NO] terpilih (atau status SIPP Ditolak/NO), bawaan pengetahuan saksi = "tahu sebagian/dari cerita/tidak tahu sebab" + kabar; [Tolak Verstek] Kurang 6 Bulan -> lama pisah kurang 6 bulan; Unus Testis -> 1 saksi | tinggi | sedang |
| 6 | `tidakBerlaku` de-auditu/tidak-tahu untuk 16 butir pengetahuan diri; perbaiki varian de auditu `q-saksi-lihat` | sedang | kecil (data katalog) |
| 7 | jawabanUmum de auditu/mendengar: hanya untuk butir peristiwa; butir fakta pakai "menurut cerita {sumber}, <kalimat melihat>" seperti jalur cerai | sedang | sedang |
| 8 | Jalur cerai: jaminan beda kalimat antar saksi (pemilih varian per saksi), buang "Ya," untuk tanya terbuka, perbaiki tukar 7/11 modus ragu, sumber cerita konsisten, huruf kecil sesudah "bahwa" | sedang | sedang |
| 9 | Kurangi butir bawaan cerai ke +-18 inti (sisanya "pilihan"), itsbat/DK/poligami serupa | sedang | sedang (data katalog) |
| 10 | Panel: tandai merah titik-titik harfiah (seperti Blangko Derry) | sedang | kecil |
| 11 | Dropdown tanpa pengaruh: sambungkan atau sembunyikan; `kumulasi` hanya nilai yang dipakai katalog | rendah | kecil |
| 12 | Katalog baru: 745 Pengangkatan Anak (alihkan ke katalog pengangkatan-anak), 744 Perjanjian Perkawinan; jawaban nusyuz = ada; keadaan anak pada izin poligami; bersihkan "dan lain-lain" pencabutan kuasa asuh; "itu itu", "pemohon Pemohon", "saya saya" | rendah-sedang | kecil |
| 12b | Jawaban draf tanpa awalan "Tidak, "/"Sudah, " (atau `isian_rtf_ket_saksi` ikut membuangnya - itu paket ABT, perlu keputusan) agar putusan tidak berbunyi "Bahwa tidak, ..." | rendah | kecil |
| 13 | Data: kabar di panel bila keterangan saksi tersimpan dengan saksi_id yatim/milik perkara lain/di dua sidang | rendah | kecil |

Perluasan yang disarankan sesudah 1-5: profil "Tidak tahu apa-apa selain identitas" (praktik saksi ditolak), profil "Masih
serumah", profil saksi Tergugat cerai di Blangko Derry, set per huruf untuk B/C/D/E sesuai praktik (sekarang hampir tak pernah
ditanyakan: KDRT 3% pada perkara berfaktor KDRT).

## 5. Pertanyaan keputusan untuk Derry

1. Draf otomatis boleh menulis klaim pengetahuan LANGSUNG ("saya melihat/mendengar sendiri", "sudah dirukunkan keluarga",
   "bentuk adu mulut") sebagai "dari data" (tersimpan otomatis)? Usulan: TIDAK - selalu "contoh" sampai disentuh petugas.
2. Penyebab perselisihan yang diambil dari posita pada jalur cerai: samakan dengan keputusan T2 (saran, kuning, tidak tersimpan
   otomatis)? Usulan: YA.
3. Saksi Tergugat/Termohon cerai di Blangko Derry: (a) pakai katalog bantahan Tergugat yang sudah ada, (b) kosong + kabar, atau
   (c) set P tetapi tanpa isian dari posita? Usulan: (a).
4. Arah putusan: bila petugas memilih blangko [Tolak]/[NO] (atau SIPP berstatus Ditolak/NO), bawaan pengetahuan saksi menjadi
   apa? Usulan: saksi 1 "tahu berselisih, tidak tahu sebabnya", saksi 2 "tahu dari cerita", dengan kabar "sesuaikan dengan BAS".
5. CT: saksi Pemohon ditanya "apakah Pemohon masih memberi nafkah kepada Termohon" dengan bawaan "tidak lagi menanggung"? Usulan:
   jawaban bawaan kosong (contoh) karena menyangkut nafkah madliyah.
6. Jumlah butir bawaan cerai 39 (panel) / 22-28 (Blangko Derry) vs praktik 15: dikurangi menjadi +-18?
7. Katalog baru untuk 745 Pengangkatan Anak dan 744 Perjanjian Perkawinan - perlu sekarang?
8. Bunyi posita yang salah ketik ikut ke keterangan saksi: dirapikan (bukan teks pihak) atau dibiarkan?

## 6. Render php56 ABT asli

Salinan milik w156: SIPP `sipp_w156` (= `sipp_w148`), ABT `aps_badilag_w156` (= `aps_badilag_rantai152b`, 24 paket terpasang)
+ tampilan `aps_badilag_w156r`; blangko dari pohon `D:/r152b/_blangko_abt/derry_briantono`; salinan program ABT
`D:/Aplikasi/aleta/tmp/w156/abt`. Tiap varian mengganti baris `abt_keterangan_saksi` saksi sasaran DI SALINAN, render, lalu
memulihkan baris asli. 24 dokumen OK, 0 galat. Keluaran `D:/Aplikasi/aleta/tmp/w156/render/<nama>.txt` (teks tampak) dan
`<nama>.txt.rtf` (RTF persis - buka di Word untuk melihat tampilannya; PNG tidak dibuat agar tidak menjalankan Word bersamaan
dengan agen lain).

| Kelompok | Perkara | Dokumen | Temuan yang tampak |
|---|---|---|---|
| G1 CG kabul verstek, draf otomatis (yang tersimpan otomatis) vs asli | 627/Pdt.G/2026 | BAS ALUR 02 [2], putusan [01] Format Lengkap (`G1-*-asli`, `G1-*-draf-otomatis`) | Draf: "Sekarang Tergugat tinggal di rumah orang tua Penggugat di Desa Sibalaya Utara / tidak diketahui keberadaannya;" (BAS baris 64 & 100, putusan baris 60 & 74). Asli: Tergugat pamit ke Makassar dan tidak kembali (A3). Kalimat saksi 1 dan 2 banyak yang sama persis (C1). |
| G2 CG **Ditolak** kontradiktoir | 217/Pdt.G/2026 | BAS ALUR 04 [6], putusan [03a] Tolak F Tidak Terbukti | Asli: sebab "masalah keturunan yang belum hadir"; draf: "sumber pertengkaran mereka adalah Tergugat melalaikan kewajiban nafkah lahir, bersikap temperamental dan melakukan KDRT ..." (bunyi posita), "saksi pernah melihat dan mendengar sendiri ... beberapa kali", "Bahwa tidak, Penggugat dan Tergugat telah berpisah ...", "Bahwa sudah, ... dirukunkan" + butir upaya diulang (A1, C7). Asli mencetak keterangan saksi 1 DUA KALI (tersimpan di sidang 2 dan 3; F). |
| G3 CT **Ditolak** kontradiktoir | 506/Pdt.G/2025 | BAS ALUR 04 [6], putusan [03a] | Asli saksi 2 "saksi tidak tahu" (upaya); draf "sudah ... dirukunkan oleh keluarga, namun tidak berhasil", "telah tidak sanggup lagi". Sebutan CT benar. |
| G4 itsbat kontensius, panel bawaan | 542/Pdt.G/2026 | BAS ALUR 04 [6], putusan 2a [01] Kabul | "Bahwa saksi ikut hadir pada acara akad nikah Penggugat I dan Penggugat II" padahal pihaknya Penggugat dan Tergugat I-II (A4). G4b (bentuk = gugatan pasangan meninggal, dipilih benar): "Penggugat dengan ..." (benar). |
| G5 CG verstek, panel, saksi 2 de auditu | 627/Pdt.G/2026 | putusan [01] | "Penggugat bercerita bahwa mereka pernah bertengkar sewaktu saksi berkunjung ke tempat mereka dan saksi sendiri tidak mengetahuinya secara langsung" (B1); "saksi mendengar dari Penggugat soal kesanggupan saksi mendamaikan mereka" dan "soal upaya saksi merukunkan mereka saksi dikabari oleh Penggugat" (B2); 76 butir keterangan (asli 28). |
| G6 dispensasi kawin, panel | 223/Pdt.P/2026 | BAS ALUR 12 DK [1t], putusan DK [01] | 54 butir keterangan (asli 31), 6 bertitik-titik; isi kalimat sesuai. |
| G7 penetapan ahli waris, panel | 230/Pdt.P/2026 | putusan PAW [01] | Variabel pewaris di ABT perkara ini kosong -> 16 dari 20 butir "...": "meninggalnya ... terjadi di ... pada tanggal ..., dan hal itu saksi lihat dengan mata kepala saksi sendiri". Simulasi ini TIDAK memanggil isian fakta bot (T2) yang di panel sungguhan mengisi dari posita - belum terverifikasi berapa yang terisi di halaman. |

Temuan tambahan dari render: fungsi `isian_rtf_ket_saksi` hanya membuang "Ya, " di awal, sehingga jawaban draf yang diawali
"Tidak, " / "Sudah, " tercetak "Bahwa tidak, Penggugat dan Tergugat telah berpisah ..." dan "Bahwa sudah, ..." (G2, G3).

## 7. Berkas tinjauan (`D:/Aplikasi/aleta/tmp/w156/`)

- `matriks-katalog.js` -> `hasil-matriks-katalog.json`, `ringkas-katalog.txt`, `rinci-katalog.txt`; `inert.js`; `dump-katalog.js`
  (cetak susunan satu keadaan), `dump-cg-deauditu.txt`.
- `matriks-cerai.js` (+ `set-saksi.cjs` = bundel esbuild `set-pertanyaan-saksi.ts`) -> `hasil-matriks-cerai.json`,
  `ringkas-cerai.txt`; `cek-c*.js`, `cek-t.js`.
- `peta-blangko.js` -> `blangko-var-saksi-r152b.tsv` (1.880 blangko x status x variabel saksi).
- `nyata-arah.js` (status x pola jawaban nyata), `nyata-cerai.js` -> `hasil-nyata-cerai.json` (247 perkara), `cakupan-tanya.js`
  -> `cakupan-tanya.txt`, `saksi-nyata.tsv` (ekspor dump 28 Okt).
- Render: `jalankan-render.py`, `render156.py`, `gen-render-cerai.js`, `gen-render-katalog.js`, folder `render/`.
