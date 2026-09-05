# Memasang ALETA untuk SIPP

Ekstensi peramban yang menempelkan keterangan ALETA ke halaman SIPP, dan
mengisikan usulan penunjukan serta Data Umum ke formulirnya.

**Yang menekan Simpan tetap petugas.** ALETA mengetik; penetapan tetap
perbuatan pejabat yang menandatanganinya. Pengisian otomatis hanya berjalan
pada formulir yang petanya sudah diisi di pengaturan ALETA, dan hanya bagi peran
yang diberi kewenangan itu — di luar itu ekstensi tetap hanya membaca.

## Yang ditampilkan

Langsung terlihat saat panel terbuka:

- **Batas waktu unggah e-Court** — keterangan yang tidak dimiliki SIPP sama sekali
- **Status pemberitahuan** — pihak sudah diberi tahu atau belum
- **Keadaan nomor pihak** — terkonfirmasi, menunggu jawaban, atau salah alamat
- **Selisih dengan e-Court** — catatan ALETA yang tidak cocok dengan status resmi
- **Nomor register e-Court** — tidak ditampilkan SIPP di mana pun, lengkap dengan tombol salin

### Menu yang dibuka bila diperlukan

Empat menu di bawah panel **terlipat dan tidak berongkos** sampai dibuka. Isinya
baru diminta ke ALETA saat menunya ditekan pertama kali, lalu dipakai bersama
keempatnya — satu permintaan untuk semuanya.

| Menu | Isinya |
|---|---|
| **Tahapan dan ketepatan input** | PMH, penunjukan PP, penunjukan juru sita, dan PHS beserta **berapa hari** jaraknya sampai diinput ke SIPP |
| **Kelengkapan berkas SIPP** | Gugatan/permohonan, relaas berdokumen, berita acara sidang, dan arsip |
| **Putusan dan upaya hukum** | Tanggal putusan, status, sumber hukum, minutasi, BHT, serta banding/kasasi/PK beserta kemajuan tahapannya |
| **Penilaian SK 048/2024** | Unsur yang belum bernilai penuh untuk perkara ini |

Menu-menu ini membaca keadaan perkara selengkapnya — bacaan yang jauh lebih berat
daripada konteks e-Court. Itulah sebabnya ia tidak diambil otomatis: perkara yang
hanya dilihat sekilas tidak perlu membayar ongkosnya.

Kewenangannya **sama persis** dengan panel utama. Menu ini tidak membuka satu pun
pintu baru bagi peran mana pun — yang tidak boleh melihat panel juga tidak dapat
membuka menu ini.

## Memasang di komputer petugas

1. **Ekstrak** berkas ZIP yang diunduh dari portal — klik kanan → **Extract All**
2. Buka Chrome → `chrome://extensions`
3. Nyalakan **Developer mode** di pojok kanan atas
4. Tekan **Load unpacked**, pilih folder hasil ekstrak
5. Buka portal ALETA dan login seperti biasa
6. Buka halaman perkara di SIPP — panel muncul di sisi kanan

### Kenapa ZIP-nya tidak bisa langsung diseret

Chrome **tidak dapat memasang ekstensi dari berkas ZIP**. Menyeret ZIP ke halaman
Extensions tidak menghasilkan apa-apa. Berkasnya harus diekstrak lebih dulu.

Di Windows ada jebakan tambahan: klik dua kali pada ZIP hanya *menampilkan* isinya
seperti folder, tanpa benar-benar mengekstrak. Load unpacked pada tampilan itu akan
ditolak Chrome. Gunakan klik kanan → **Extract All**.

Setelah diekstrak, folder hasilnya **boleh diseret langsung** ke halaman Extensions —
cara itu berhasil dan setara dengan Load unpacked.

## Tiga saklar di popup ekstensi

Klik ikon ALETA di bilah ekstensi Chrome.

| Saklar | Bawaan | Yang dilakukan |
|---|---|---|
| **Nyalakan ALETA di SIPP** | menyala | Saklar induk. Panel melayang di sisi kanan halaman perkara |
| **Tandai halaman SIPP** | **mati** | Menempelkan tenggat e-Court dan keadaan nomor pihak langsung di dalam halaman SIPP |
| **Sisipkan berkas ke Jadwal Sidang** | **mati** | Menaruh berkas jawaban, replik, dan duplik di baris sidangnya |

Saklar kedua bawaannya mati dengan sengaja. Panel di sisi kanan mudah diabaikan;
menandai isi halaman SIPP sendiri lebih jauh dari itu, dan halaman SIPP adalah
tempat kerja orang. Menyalakannya harus keputusan petugas, bukan efek samping
sebuah pembaruan.

Yang ditandai hanya keterangan yang **memang tidak ada di SIPP**: sisa hari
tenggat unggah e-Court, dan pihak yang nomornya belum dikonfirmasi atau tidak
tercatat. Menandai hal yang sudah tertulis di layar hanya menambah keramaian.

Penandaan ini **hanya menambah**. Ia tidak mengubah teks, nilai, atau susunan
apa pun milik SIPP, dan mematikan saklarnya mengembalikan halaman seperti semula
seketika, tanpa perlu memuat ulang.

Pengisian formulir adalah hal yang **terpisah dari penandaan ini** — ia tidak
pernah berjalan sendiri, hanya sesudah tombol Kerjakan ditekan, dan hanya pada
kolom yang disebutkan peta kolom di pengaturan ALETA.

## Kalau panelnya tidak muncul

Ekstensi ini **sengaja diam** ketika tidak yakin. Panel tidak muncul bila:

| Sebab | Cara memastikan |
|---|---|
| Belum login ALETA | Panel menampilkan tombol "Buka ALETA" |
| Halaman bukan halaman perkara | Wajar — panel hanya muncul bila ada nomor perkara |
| ALETA Bot tidak berjalan | Buka portal → ALETA Bot, periksa status |
| Saklar dimatikan | Klik ikon ekstensi, centang "Tampilkan panel" |
| Tampilan SIPP berubah | Nomor perkara tidak dikenali polanya |

Tidak ada kotak galat yang muncul di SIPP. Itu disengaja: SIPP dipakai bekerja
sehari-hari, dan lapisan bantu yang merusak tampilannya lebih merugikan
daripada lapisan bantu yang absen.

## Yang perlu diketahui

**Dua petugas bisa melihat isi berbeda.** Yang punya ekstensi melihat panelnya,
yang tidak, tidak. Ini konsekuensi wajar dari lapisan bantu, tetapi perlu
disepakati supaya tidak membingungkan saat rapat.

**Nomor pihak ditampilkan tersamar** (`0852****977`). Layar SIPP dapat terlihat
orang lain, dan nomor pihak berperkara bukan keterangan yang perlu dipajang.

**Ekstensi tidak menyimpan kata sandi apa pun.** Ia menumpang sesi portal ALETA
yang sudah ada. Tanpa login, tidak ada data yang ditampilkan.

## Kalau SIPP dipindah ke alamat lain

Ubah `192.168.10.10` di dua tempat pada `manifest.json`, lalu muat ulang
ekstensinya. Bila SIPP dan portal berada di host yang **berbeda**, panggilan
API akan ditolak peramban — dan itu perilaku yang benar. Yang perlu diperbaiki
penempatannya, bukan melonggarkan pemeriksaan asal permintaan.
