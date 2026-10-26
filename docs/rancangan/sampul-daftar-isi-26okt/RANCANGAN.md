# Rancangan: Sampul Berkas Perkara dan Daftar Isi Berkas (blangko Derry, menu PTSP)

Status: RANCANGAN + pratinjau HTML (26 Okt 2026). Belum ada yang dipasang ke ABT/SIPP/server. Pratinjau (data rekaan, dapat dibuka di peramban, juga di HP):

- `sampul-berkas.html` (centang ciri untuk melihat ciri disembunyikan; tombol contoh perkara umum dan cerai talak)
- `daftar-isi.html` (ubah jumlah sidang, prodeo, kuasa, ghaib, mediasi, bukti, saksi, sita, banding; baris tumbuh dan menyusut, nomor dihitung ulang)

Aturan: tidak satu kata nama aplikasi masuk ke isi blangko maupun nama variabel ABT (hanya tulisan netral). Judul halaman pratinjau juga netral.

---

## 1. Acuan utama: blangko yang SUDAH ADA di ABT (dibaca saja di server, 26 Okt)

Direktori RTF: `/var/www/html/aps_badilag/_blangko_abt/`. Tidak satu berkas pun diubah. Salinan baca-saja diambil ke folder kerja sesi (bukan ke repo). Teks dan variabelnya diekstrak, hasilnya dirangkum di sini.

| # | Blangko ABT (berkas) | Pemilik / folder | Isinya |
|---|---|---|---|
| A1 | `Sampul Berkas A (1 Pemohon).rtf` | umum, `blangko_lainnya` | MINUTASI, tanggal minutasi `#1278#`, tgl BHT `#0168#`, "BERKAS A", nomor `#0001#`, sebutan `#8146#`, nama `#0098#`, tahun `#0191#`; tiga salinan per lembar |
| A2 | `Sampul Berkas A (2 Pemohon).rtf` | umum | A1 + Pemohon II `#1033#` |
| A3 | `Sampul Berkas A - Contensius.rtf` | umum | A1 + lawan `#8147#`/`#0102#` |
| A4 | `Sampul Berkas Ikrar Talak.rtf`, `Sampul Penetapan Ikrar.rtf`, `Sampul Penetapan (1/2 Pemohon).rtf`, `Sampul Putusan.rtf` | umum | nomor, tanggal ikrar `#1182#` atau putusan `#1069#`, para pihak, tahun |
| A5 | `SAMPUL BERKAS BERJALAN - Contentius.rtf` dan `- Volunter.rtf` | umum | kartu pengawas berkas: nomor, pihak (nama, pekerjaan, alamat), jenis perkara `#0048#`, tgl daftar `#1061#`, tgl PP `#0180#`, tgl PMH `#1060#`, Panitera/Pengganti `#0015#`, KM `#0012#`, Jurusita/Pengganti `#0018#`, Hkm Agt I/II `#0013#`/`#0014#`, tgl PHS `#1064#`, Konseptor, Tgl Pen. Mediator, Mediator, Tgl Lap. Mediator, Hasil Mediasi, **tabel 12 baris** (Tgl sidang `#0032#,#0033#` / Alasan penundaan / Agenda), TGL PUTUS, TGL MINUTASI, TGL PBT, TGL BHT, TGL PMH IKRAR, TGL PHS IKRAR, TGL SIDANG IKRAR, TGL Pen Eks Psl 71 |
| B1 | `Daftar Isi Berkas A - Contensius.rtf` | umum | "BERKAS A", nomor, minutasi; "Halaman sampul minutasi"; 14 butir: Surat gugatan/permohonan, Surat Kuasa Untuk Membayar, Slip Penyetoran BRI, Penetapan Majelis Hakim, Penunjukan PP, Penunjukan JS, PHS, Relaas I Penggugat, Relaas I Tergugat, BAS I, Penetapan Mediator (jika ada), Laporan Hasil Mediasi (jika ada), Relaas II Tergugat, BAS II |
| B2 | `Daftar Isi Berkas A - IN 1 Pemohon.rtf`, `- IN 2 Pemohon.rtf`, `- IN 2 Pemohon - Hakim Tunggal.rtf`, `- Voluntair.rtf` | umum | varian itsbat/permohonan: + Surat Pengumuman `#0303#`, Relaas Pemohon I dan II, Penunjukan Ulang PP `#1146#`, Tambahan Panjar `#1295#`, Hakim Tunggal `#1143#` |
| C1 | `DAFTAR ISI BERKAS BUNDEL A - GUGATAN DGL.rtf` | `Fikrianto/Blangko` (Donggala; **acuan paling dekat**) | tabel No/Jenis Dokumen/Tanggal/Halaman, 27 butir (rincian di bagian 4) |
| C2 | `DAFTAR ISI BERKAS BUNDEL A - PERMOHONAN DGL.rtf` | `Fikrianto/Blangko` | 20 butir (permohonan, itsbat) |
| C3 | `DAFTAR ISI BERKAS IKRAR TALAK DGL.rtf` | `Fikrianto/Blangko` | 9 butir ikrar talak |
| C4 | `SAMPUL BUNDEL A (1 PEMOHON / 2 PEMOHON) DGL.rtf`, `SAMPUL BUNDEL A DGL.rtf` | `Fikrianto/Blangko` | "BUNDEL A", Perkara `#0048#`, Nomor, Terdaftar tanggal `#1061#`, nama pihak (sebutan), susunan majelis (KM `#0012#` + sebutan `#0668#`, HA `#0013#`, `#0014#`, PP `#0015#`), tgl PMH, PHS, Putus, Minutasi, tahun |
| C5 | `SAMPUL BERKAS IKRAR TALAK DGL.rtf`, `SAMPUL PUTUSAN DGL.rtf`, `SAMPUL PENETAPAN (1/2 PEMOHON/IKRAR) DGL.rtf` | `Fikrianto/Blangko` | kop PA Donggala (alamat, telepon, faksimile, laman, surel), judul, nomor, tanggal masehi `#1069#`/`#1182#` + hijriah `#0038#`, para pihak, tahun |

Menu ABT: folder PTSP milik Derry sudah ada: `abt_menu` id 991 "Form Bantu PTSP", direktori `99 PTSP` di bawah `derry_briantono`, jenis perkara 15 sampai 17, proses 20 sampai 1000. **Dua blangko baru cukup ditaruh sebagai berkas RTF di folder itu; tidak perlu baris menu baru.** Variabel `0178` "Daftar Isi Berkas" ada di tabel variabel tetapi hanya judul kosong (tanpa kueri); tidak dipakai dan tidak diubah.

### Isian dari ABT yang DIPERTAHANKAN semua (tidak satu pun hilang)

Rancangan ini adalah gabungan C4 + A5 + A1 sampai A4 + C5 untuk sampul, dan C1 + C2 + C3 + B1 + B2 untuk daftar isi. Pemeriksaan satu-satu ada di tabel bagian 3 (kolom "asal ABT") dan bagian 4. Yang sengaja bergeser:

- "Halaman sampul minutasi" (B1/B2): menjadi baris pertama Bundel A dengan keterangan "sampul".
- Salinan sampul tiga kali per lembar (A1 sampai A4): dibuat satu sampul per perkara; kalau Derry masih ingin tiga salinan per lembar (Putusan / Salinan Putusan), itu tetap blangko lama.
- Kop PA Donggala yang diketik langsung di C5: diganti variabel identitas satker (`#8010#` nama satker huruf besar), sesuai prinsip blangko universal per satker. Alamat/telepon/laman bila ingin tetap: perlu diputuskan (bagian 7).

---

## 2. Daftar ciri (tag) yang BENAR-BENAR ada di ALETA, dan sumber datanya

Ciri di bawah dipilih dari yang sudah dihitung ALETA (lencana jadwal sidang, penanda perkara, bot) atau yang kolomnya ada di SIPP. Pada sampul, ciri yang tidak berlaku tidak diterbitkan sama sekali (tidak ada kotak kosong).

Lambang (tetap terbaca di cetakan hitam-putih): `■` pendaftaran dan biaya, `●` pihak, `▲` proses. Ciri yang mengubah cara pemeriksaan (GHAIB, MAFQUD, VERSTEK) bertanda bingkai ganda di pratinjau; di RTF diwujudkan sebagai teks kapital tebal dengan tanda kurung: `[■ PRODEO]`.

| Ciri | Lambang | Ada di ALETA? | Aturan nyala (sumber) | Variabel usulan |
|---|---|---|---|---|
| PRODEO | ■ | Ya (lencana Jadwal Sidang) | `perkara.prodeo = 1` (118 dari 10.216 perkara di SIPP Donggala) | 5802 |
| e-COURT | ■ | Ya (sebagai kebalikan lencana "Non e-Court") | ada baris `perkara_efiling_id` (sama dengan kueri variabel ABT 0206) | 5803 |
| NON e-COURT | ■ | Ya (lencana) | tidak ada `perkara_efiling_id`. Pada sampul tetap tertulis satu dari keduanya (e-COURT atau NON e-COURT); di layar ALETA e-Court sengaja tanpa tanda. Bisa dimatikan | 5804 |
| KUASA HUKUM (P, T) | ■ | Data ada | `perkara_pengacara` aktif = 'Y' menurut `pihak_ke` 1 / 2 (kueri sama dengan 0141/0142); sisi ditulis sebagai P atau T | 5805 |
| KUASA INSIDENTIL | ■ | Data ada | isian ABT 8537 (kuasa insidentil) / 8896 terisi | 5806 |
| GHAIB | ● | Ya | `sippTahapanService.penandaGhaibBanyakPerkara` (empat sumber, penciri sama dengan lencana Jadwal Sidang dan kelonggaran 120 hari). Tidak dihitung ulang di ABT: lihat catatan ketergantungan di bawah | 5807 |
| MAFQUD | ● | Ya (penanda alur BAS) | petitum/posita menyebut mafqud/orang hilang (`alur-bas-baru`) atau saklar | 5808 |
| PNS/ASN, PPPK, TNI, POLRI, BUMN/BUMD | ● | Ya (lencana pekerjaan pihak) | `pekerjaanPihakService.klasifikasiPekerjaan` = penggolongan yang sama dengan variabel ABT 8510/8524/8533 (keputusan 11 Okt: pensiunan, CPNS, PPPK paruh waktu BUKAN PNS; PPPK = ASN (PPPK)); sisi P/T ditulis | 5809 sampai 5813 |
| DISABILITAS | ● | Data ada, ALETA belum tampil | `pihak.difabel = 'Y'` atau baris `pihak_disabilitas` (ref_disabilitas 1 s.d. 5); sisi P/T. Di SIPP Donggala 6 pihak berkolom Y | 5814 |
| PENERJEMAH | ● | Belum ada sumber | tidak ada kolom/tabel penerjemah di SIPP maupun variabel ABT; usulan isian tangan `data_teks` (isi "ya" bila perlu penerjemah/juru bahasa isyarat) | 5815 |
| WNA (usulan) | ● | Data ada | `pihak.warga_negara_id` bukan WNI. Tidak diminta Derry; dimuat sebagai usulan | 5816 |
| VERSTEK | ▲ | Ya | `perkara_putusan.putusan_verstek = 'Y'`; sebelum putus: Tergugat tidak hadir dengan relaas patut. ALETA mengenal kode keadaan "verstek-tanpa-bendera", jadi bendera SIPP sendiri tidak selalu terisi | 5817 |
| KUMULASI (jumlah) | ▲ | Ya | `kumulasiPerkaraService`: tabel `perkara_kumulasi` lebih dulu, kosong maka petitum dianalisa. Teks jenis di sampul memakai bentuk "Cerai Gugat Kumulasi Hak Asuh Anak" | 5818, 5800 |
| REKONVENSI (usulan) | ▲ | Sebagian | terbaca dari jawaban/posita; belum andal sebelum putus | 5819 |
| MEDIASI (+ hasil) | ▲ | Ya | `perkara_mediasi` ada; hasil dari `mediasi_berhasil` / `mediasi_gagal` | 5820 |
| SITA | ▲ | Ya (menu Sita) | `perkara_proses` bernama sita / penetapan sita. **Belum diukur**; perlu SELECT contoh sebelum dikunci | 5821 |
| SIDANG KELILING | ▲ | Ya | `perkara_jadwal_sidang.sidang_keliling = 'Y'` pada sidang manapun | 5822 |
| HAKIM TUNGGAL | ▲ | Ya | jumlah hakim aktif pada `perkara_hakim_pn` = 1 (PHT), lazim pada dispensasi kawin | 5823 |
| GUGATAN SEDERHANA | ▲ | Data ada | `alur_perkara_id = 17` | 5824 |
| VERZET | ▲ | Data ada | `perkara_jadwal_sidang.verzet = 'Y'` | 5825 |
| DISPENSASI KAWIN | ▲ | Ya | `jenis_perkara_id = 362` (27 perkara sejak 2025) | 5826 |
| IKRAR TALAK | ▲ | Ya | baris `perkara_ikrar_talak` ada (jenis 346) | 5827 |

Ketergantungan penting: ciri GHAIB, pekerjaan pihak (PNS dan seterusnya), dan KUMULASI-dari-petitum dihitung oleh bot ALETA dengan analisa teks, **bukan** kolom SIPP. Di ABT sebuah variabel SQL tidak dapat memanggil bot. Dua jalan:

1. (Usulan) ALETA menulis hasil penandanya ke isian ABT (`abt_data_teks`, nomor variabel tag 5802 sampai 5827 bertipe `data_teks`) sewaktu panel Blangko Derry membuka perkara. ABT hanya mencetak isian itu. Ini pola yang sudah dipakai paket lain (isi SIPP ke ABT otomatis). Berlaku untuk ciri hasil analisa; ciri yang kolomnya jelas (prodeo, e-Court, kuasa, sidang keliling, hakim tunggal, verzet, dispensasi, ikrar, mediasi) dihitung langsung oleh kueri SQL di ABT.
2. Pencetakan dari panel ALETA (sudah ada pemilih cetak dan RTF terisi di ekstensi) yang mengisi variabel sebelum dicetak.

Keputusan jalan mana ada di Derry (bagian 7).

---

## 3. Sampul Berkas Perkara: isian, variabel, aturan

Satu lembar A4 tegak (F4 sama susunannya). Susunan: kop satker, "BUNDEL A / BERKAS PERKARA", jenis perkara, nomor dalam bingkai, kotak CIRI PERKARA, para pihak (dua kolom), majelis dan petugas, tanggal penting, riwayat sidang (12 baris), baris akhir (putus, minutasi, PBT, BHT), baris ikrar (hanya cerai talak), kaki (hijriah putusan).

"Pakai ulang" = variabel ABT yang sudah ada dan dibaca persis di server (kueri/definisi terlihat 26 Okt). "Baru" = kode usulan di blok **5800 sampai 5899** (di server `abt_variabel` blok 5700 sampai 5999 KOSONG per 26 Okt; juga tidak ada klaim di paket repo, hasil pencarian). Tetap diperiksa lagi lewat PRASYARAT saat pasang.

| Isian di sampul | Asal ABT (acuan) | Variabel | Pakai ulang / baru | Aturan tampil |
|---|---|---|---|---|
| Nama satker (kop) | C5 (diketik) | `#8010#` | pakai ulang | selalu |
| Judul "BUNDEL A / BERKAS PERKARA" | C4, A1 | teks tetap | tetap | selalu |
| Jenis perkara + kumulasi | `#0048#` (sudah memperjelas "Lain-Lain") | 5800 | baru, membungkus 0048 | "Cerai Gugat Kumulasi A dan B" bila `perkara_kumulasi` ada; tanpa kumulasi = 0048 apa adanya |
| Nomor perkara | A1 sampai C5 | `#0001#` | pakai ulang | selalu |
| Tahun perkara | `#0191#` | `#0191#` | pakai ulang | selalu |
| Tanggal terdaftar | C4 | `#1061#` | pakai ulang | selalu |
| Ciri perkara (kotak) | (baru) | 5801 (gabungan), 5802 s.d. 5827 (satu per ciri) | baru | 5801 = gabungan 5802..5827 yang tidak kosong, dipisah dua spasi; tanpa satu pun = "tidak ada ciri khusus" |
| Sebutan pihak I / II | `#0046#`, `#0047#`, `#8146#`, `#8147#` | idem | pakai ulang | selalu |
| Nama Pemohon/Penggugat I, II | `#0098#`, `#1033#` | idem | pakai ulang | II hanya bila terisi (`#1033#` kosong = tanpa blok) |
| Pekerjaan, alamat Pemohon I / II | `#0100#`, `#0101#`, `#1036#` | idem | pakai ulang | idem |
| Nama Termohon/Tergugat, pekerjaan, alamat | `#0102#`, `#0104#`, `#0105#` | idem | pakai ulang | untuk permohonan satu pihak = tidak ada |
| Kuasa P / T (nama) | `#0106#`, `#0170#` | idem | pakai ulang | hanya bila ada kuasa |
| Ketua Majelis + sebutan | `#0012#`, `#0668#` | idem | pakai ulang | selalu |
| Hakim Anggota I, II | `#0013#`, `#0014#` | idem | pakai ulang | kosong bila hakim tunggal |
| Panitera Pengganti / Sidang | `#0015#` | idem | pakai ulang | selalu |
| Jurusita / Pengganti | `#0018#` | idem | pakai ulang | selalu |
| Konseptor | A5 (kosong, ditulis tangan) | 5839 | baru, `data_teks` isian tangan | kosong = garis |
| Mediator, hasil mediasi | A5 (kosong); data SIPP `perkara_mediasi` | 5836, 5837 | baru | hanya bila mediasi ada |
| Tgl daftar, PP/JS, PMH, PHS | A5, C4 | `#1061#`, `#0180#`, `#1060#`, `#1064#` | pakai ulang | selalu |
| Tgl penetapan mediator, laporan mediator | A5 (kosong), B1 `#0055#`, `#8012#` | `#0055#`, `#8012#` | pakai ulang | hanya bila ada |
| Riwayat sidang n = 1 sampai 12: tanggal, alasan penundaan, agenda | A5 (`#0032#,#0033#` hanya baris 1) | 5860 sampai 5895 (tiga per baris) | baru | baris n kosong bila sidang ke-n belum ada; 12 baris tetap, lebih dari 12 sidang: baris 12 diisi sidang terakhir dan ditulis "dst." |
| Tgl putus, minutasi, PBT, BHT | A5 `#1069#`, `#1278#`, `#0168#`; PBT baru | `#1069#`, `#1278#`, `#0168#`, 5840 | PBT baru, lainnya pakai ulang | kosong bila belum |
| Ikrar: PMH ikrar, PHS ikrar, sidang ikrar, Pen. Eks Psl 71 | A5, `#0136#`, `#1099#`, `#1182#` | 5829 (satu baris) | baru, membungkus 0136, 1099, 1182 + Ps. 71 | hanya jenis cerai talak (kosong untuk jenis lain). Sumber tanggal penetapan eksekusi Pasal 71: **belum diukur** (perlu diverifikasi) |
| Hijriah putusan | C5 `#0038#` | `#0038#` | pakai ulang | bila sudah putus |
| Judul/versi lain (Putusan, Penetapan Ikrar, Salinan) | A4, C5 | tetap blangko lama | tidak digantikan | sampul putusan/penetapan lama TIDAK dihapus; sampul baru ini adalah sampul berkas |

Aturan khusus:

- Baris nomor perkara memakai `#0001#` yang sudah berisi "NNN/Pdt.G/2026/PA.Dgl".
- "Tag yang tidak berlaku disembunyikan": setiap variabel tag mengembalikan `''` (kosong) bila tidak berlaku. 5801 merangkai dengan `CONCAT_WS` dan `NULLIF`, sehingga tidak ada spasi ganda atau kurung kosong. Teks kotak static hanya "CIRI PERKARA".
- Sisi (P / T) ditulis kecil setelah nama ciri dengan huruf biasa ("[● PNS/ASN T]").
- Semua teks yang tampil tetap kapital di tag dan huruf biasa untuk isian; tidak ada warna sebagai satu-satunya penanda.

### Batasan pewujudan RTF (jujur)

ABT mengubah keluaran variabel SQL sebagai teks dengan penanda HTML sederhana (`<b>`, `<i>`, `<br>`, seperti variabel 0206 dan fungsi `isian_rtf_*` yang memakai `<br>`). Tidak ada preseden di repo untuk variabel yang menyuntikkan potongan RTF mentah (`\trowd ... \row`). Karena itu rancangan ini **tidak** bergantung pada tabel yang barisnya diterbitkan variabel:

- Tabel selalu statis (kolom dan garis di RTF); isinya sel demi sel adalah variabel.
- Chip tag: bingkai ganda dan bayangan di pratinjau HTML adalah "ideal"; di RTF yang dijamin hanya teks tebal bertanda kurung dan lambang `■ ● ▲` (karakter Unicode, ada di Arial). Bila uji lab menunjukkan RTF mentah lolos, chip berbingkai bisa ditingkatkan.
- Baris yang jumlahnya berubah (daftar isi) dibuat dengan **empat kolom, satu baris tinggi, tiap kolom satu variabel bergaris banyak** (`<br>` antar baris). Keempatnya dibangun satu fungsi dari susunan baris yang sama, jadi panjangnya selalu sama dan sejajar selama satu dokumen satu baris (nama dokumen dibatasi 52 karakter; pewujudan memotong/menyingkat, tidak melipat).
- Tabel `abt_variabel` berkolom latin1, jadi simbol di kueri ditulis sebagai entitas HTML (`&#9632;` `&#9679;` `&#9650;`); ABT sudah memakai entitas serupa pada variabel 0226 (`&quot;`, `&#39;`). Apakah ABT menjadikannya karakter Unicode di RTF: belum terbukti; fallback bila tidak lolos: tanda ASCII `[+ PRODEO]` (kotak), `[o ...]` (pihak), `[^ ...]` (proses).
- Wajib diuji di lab php56 ABT (seperti renderer paket x6/x9) sebelum dipasang: (a) `<b>` dan `<br>` lolos ke RTF di sel tabel, (b) karakter ■ ● ▲ lolos, (c) lebar kolom bertahan.

---

## 4. Daftar Isi Berkas: susunan resmi yang diacu, baris fleksibel

### 4.1 Sumber susunan

1. **Praktik setempat yang terbukti (pasti):** blangko C1, C2, C3, B1, B2 di ABT (tabel No / Jenis Dokumen / Tanggal / Halaman). Butir-butirnya dipakai apa adanya sebagai tulang punggung; tidak satu butir pun dibuang.
2. **Pola Bundel A / Bundel B** menurut Buku II (Pedoman Pelaksanaan Tugas dan Administrasi Pengadilan, edisi untuk peradilan agama, revisi 2013 dan Buku II 2026 yang sudah dirujuk Derry 18 Okt) dan pola bindalmin kepaniteraan. Ringkasannya yang saya pakai: **Bundel A** = berkas yang diperiksa dan dikirim bila ada upaya hukum (surat gugatan/permohonan, kuasa, SKUM/panjar, penetapan-penetapan awal, relaas panggilan, BAS, dokumen para pihak, bukti, putusan); **Bundel B** = dokumen pasca putusan dan administrasi (relaas pemberitahuan putusan, minutasi, BHT, akta cerai dan penyerahannya, upaya hukum, eksekusi). **Tandai untuk diverifikasi Derry**: saya tidak mempunyai naskah resmi Buku II/bindalmin di sesi ini, dan sepengetahuan saya penempatan beberapa butir (mis. slip setoran panjar, penetapan minutasi) berbeda antara pedoman dan praktik tiap satker. Pada C1/C2, panjar dan SKUM ada di Bundel A.
3. Bila naskah resmi tersedia, urutan di fungsi cukup diubah di satu tempat (daftar `urutan`), tanpa mengubah RTF.

### 4.2 Susunan dan sumber data tiap baris (Bundel A)

Setiap baris muncul hanya bila datanya ada. Tanggal ditulis `d MMMM yyyy`. Halaman dibiarkan "......" (ditulis tangan saat dijilid, seperti di ABT).

| Kelompok / baris | Asal ABT | Sumber data (SIPP/ABT) | Aturan muncul | Variabel tanggal yang dipakai ulang |
|---|---|---|---|---|
| (sampul minutasi) "Halaman sampul" | B1, B2 | statis | selalu | tanpa |
| **I. Pendaftaran** | | | | |
| Surat Gugatan / Permohonan | C1/C2 baris 7 "Surat `#0053#` `#0046#`" | `perkara.tanggal_surat` | selalu | `#0017#`; kata gugatan/permohonan dari `#0053#` |
| SKTM, Surat Permohonan Prodeo, Pertimbangan Panitera, Pertimbangan Sekretaris, Penetapan Ketua | C1/C2 baris 1 sampai 5 | `perkara.prodeo = 1`; tanggal `#0662#`, `#0663#`, `#0017#` | hanya prodeo | `#0017#`, `#0662#`, `#0663#` |
| Surat Kuasa Khusus P / T | C1 baris 6 | `perkara_pengacara` (aktif, `tanggal_kuasa`) | hanya bila ada kuasa | `#0111#`/`#0184#`, `#0112#`/`#0185#` |
| Surat Kuasa Insidentil + Izin Ketua | (baru dari 0182/0183) | isian 0182, 0183 | hanya kuasa insidentil | `#0182#`, `#0183#` |
| Surat Kuasa Untuk Membayar | B1 baris 2, C1 baris 8 | `perkara.tanggal_pendaftaran` | selalu | `#1061#` |
| Slip Setoran Panjar Biaya Perkara | B1 baris 3, C1 baris 9 | `perkara_biaya` penerimaan panjar | tidak muncul untuk prodeo | `#1061#` |
| Tambahan Panjar Biaya Perkara | B2 baris 12 | `perkara_biaya` jenis 224 | hanya bila ada | `#1295#` |
| **II. Penetapan awal** | | | | |
| Penetapan Majelis Hakim / Hakim Tunggal | B1 baris 4, B2 | `perkara_penetapan.penetapan_majelis_hakim`; label hakim tunggal bila satu hakim | selalu | `#1060#` / `#1143#` |
| Penetapan Majelis (perubahan) | C1 baris 20 | `perkara_proses` proses 21 | bila ada | `#1144#` |
| Penunjukan Panitera Pengganti (+ ulang) | B1 baris 5, C1 baris 11, B2 baris 11 | `perkara_penetapan.penetapan_panitera_pengganti`; proses 30/31 | selalu; ulang bila ada | `#0180#`, `#1145#`, `#1146#` |
| Penunjukan Jurusita / Pengganti | B1 baris 6, C1 baris 12 | `perkara_penetapan.penetapan_jurusita` | selalu | `#0180#` |
| Penetapan Hari Sidang | B1 baris 7, C1 baris 13 | `perkara_penetapan.penetapan_hari_sidang` | selalu | `#1064#` |
| Pengumuman (itsbat nikah) | B2 baris 8, C2 baris 14 | isian tanggal pengumuman | hanya itsbat | `#0303#` |
| Pengumuman panggilan ghaib via media | (baru; ABT hanya punya teks media `#0670#`) | `perkara_pemberitahuan` (diukur dulu) atau isian | hanya perkara ghaib | belum ada tanggal; usulan variabel baru |
| **III. Pemeriksaan di persidangan**, untuk n = 1 sampai jumlah sidang | | | | |
| Panggilan elektronik (e-Summons) Penggugat/Pemohon ke n | C1 baris 14, C2 baris 15 | `perkara_pelaksanaan_relaas` + peta e-Court | bila pihak lewat e-Court | `#1076#`, `#0118#` |
| Relaas panggilan ke n, per pihak (urutan pihak) | B1 baris 8, 9, 13; C1 baris 15, 18, 22 | `perkara_pelaksanaan_relaas`: `sidang_id` (urutan sidang), `pihak_id`, `tanggal_relaas` | satu baris per relaas yang ada, per pihak, per panggilan | `#1076#`, `#1077#`, `#0118#`, `#0120#` |
| Bukti Surat Tercatat (Pos) ke n | C1 baris 16, 19, 23 | relaas: `no_resi_pos`, `tanggal_jursit_pos` | hanya yang berresi | `#1077#`, `#0120#` |
| Penetapan Penunjukan Mediator | B1 baris 11, C1 | `perkara_mediasi.penetapan_penunjukan_mediator` | hanya mediasi | `#0055#` |
| Laporan Hasil Mediasi | B1 baris 12 | `perkara_mediasi.tgl_laporan_mediator` | hanya mediasi | `#8012#` |
| Berita Acara Sidang ke n (Pertama, Kedua, ...) | B1 baris 10, 14; C1 baris 17, 21, 24 sampai 27 | `perkara_jadwal_sidang` (`urutan`, `tanggal_sidang`, `edoc_bas`, `ditunda`); keterangan "sidang keliling" bila `sidang_keliling = 'Y'` | satu per sidang yang sudah ada | `#0051#`, `#0193#`, `#1193#`, `#1194#`, `#1195#`, `#1196#` |
| Jawaban, Replik, Duplik, Kesimpulan | (baru; C1 tidak memuat) | dokumen e-Court yang diunggah (arsip e-Court ALETA) atau `perkara_dokumen`; tanggal sidang pengajuan | hanya yang ada | tanggal sidang tempat diajukan |
| Daftar Bukti Surat P.1 s.d. P.n dan T.1 s.d. T.n | (baru) | daftar bukti dari e-Court (`buktiEcourtService`) atau isian ABT 9470/9492 dan lainnya | hanya yang ada | tanggal sidang pembuktian |
| Keterangan Saksi P / T (jumlah orang) | (baru) | `abt_keterangan_saksi` per kelompok saksi | hanya yang ada | tanggal sidang saksi |
| Penetapan sita jaminan + berita acara sita | (baru; menu Sita) | `perkara_proses` / penetapan sita (belum diukur) | hanya sita | tanggal proses |
| Putusan sela | (baru) | `perkara_putusan` sela (tanggal_putusan_sela) | hanya bila ada | tanggal putusan sela |
| **IV. Ikrar talak** (hanya cerai talak) | C3 baris 1 sampai 9 | `perkara_ikrar_talak` | hanya cerai talak | `#0136#`, `#1099#`, `#1182#` |
| **V. Putusan / Penetapan** | | | | |
| Putusan (atau Penetapan bila permohonan/dicabut: `#0194#`) | (baru; B1 hanya sampai BAS II) | `perkara_putusan.tanggal_putusan` | bila sudah putus | `#1069#` |
| Salinan putusan (elektronik bila e-Court) | (baru) | `perkara_putusan.penerbitan_salinan_putusan` | bila ada | belum ada variabel; baru |

### 4.3 Bundel B (usulan, perlu diverifikasi)

| Baris | Sumber | Aturan |
|---|---|---|
| Relaas Pemberitahuan Isi Putusan, per pihak | `perkara_putusan_pemberitahuan_putusan` (`pihak`, `tanggal_pemberitahuan_putusan`, `no_resi_pos`) | satu baris per pihak yang ada |
| Bukti Surat Tercatat pemberitahuan | idem (`no_resi_pos`) | bila beresi |
| Pernyataan menerima putusan / tanda terima salinan | `tanggal_menerima_putusan`, `tanggal_kirim_salinan_putusan` | bila terisi |
| Penetapan Minutasi / tanggal minutasi | `perkara_putusan.tanggal_minutasi` | `#1278#` |
| Akta pernyataan BHT | `perkara_putusan.tanggal_bht` | `#0168#` |
| Akta Cerai (nomor, tanggal) dan tanda terima P / T | `perkara_akta_cerai` (`nomor_akta_cerai`, `tgl_akta_cerai`, `tgl_penyerahan_akta_cerai`, `_pihak2`) | hanya cerai yang sudah BHT |
| Upaya hukum: akta banding, memori, kontra memori, inzage, pengiriman berkas | `perkara_banding` / `_detil`, `perkara_kasasi`, `perkara_pk` (kolom belum diukur) | hanya bila ada |
| Eksekusi | `perkara_eksekusi*` | hanya bila ada |

### 4.4 Cara fleksibel (baris berulang)

- Fungsi `isian_rtf_daftar_a(perkara_id, kolom)` dan `isian_rtf_daftar_b(perkara_id, kolom)` (kolom 1 sampai 4: no, dokumen, tanggal, halaman). Satu fungsi dasar menyusun himpunan baris (`UNION ALL` berurutan: kelompok, urutan sidang, urutan dokumen, tanggal), dibaca dengan kursor sehingga nomor urut dihitung sebagai variabel lokal (tidak bergantung variabel sesi `@n`), lalu setiap panggilan mengembalikan satu kolom dengan `<br>` sebagai pemisah.
- Kelompok dan nomor: judul kelompok muncul hanya bila minimal satu baris di bawahnya ada; judul ditebalkan `<b>`, nomor kosong.
- Per sidang n: baris relaas dan bukti pos diurutkan pihak (urutan `perkara_pihak1/2`), sebutannya memakai `sebutan-pihak` (Penggugat/Pemohon/Tergugat/Termohon; `#0047#` = Tergugat/Termohon sesuai catatan "pelaku = 0047") dan nomor pihak bila lebih dari satu (I, II).
- Batas 52 karakter per baris dipaksa dengan singkatan baku (mis. "Relaas Panggilan Tergugat I ke 2", tanpa nama orang).
- MariaDB 5.5: hanya fungsi tersimpan, kursor, `GROUP_CONCAT` tidak dipakai (batas `group_concat_max_len` bawaan 1024), tidak ada fungsi jendela, tidak ada CTE, tidak ada JSON.

---

## 5. Daftar variabel baru yang diusulkan (blok 5800 sampai 5899)

| Kode | Nama (netral, tanpa nama aplikasi) | Jenis | Isi |
|---|---|---|---|
| 5800 | JENIS PERKARA SAMPUL (OTOMATIS: jenis + kumulasi) | data_sql | membungkus `#0048#`; menambah " Kumulasi A dan B" dari `perkara_kumulasi` |
| 5801 | CIRI PERKARA SAMPUL (OTOMATIS: gabungan) | data_sql | rangkaian 5802 sampai 5827 yang tidak kosong; kosong semua = "tidak ada ciri khusus" |
| 5802 sampai 5827 | CIRI: PRODEO ... IKRAR TALAK (daftar di bagian 2) | data_sql (sebagian data_teks bila diisi dari panel) | `'[■ NAMA]'` atau `''` |
| 5828 | PBT / catatan lain (cadangan) | data_sql | disisakan |
| 5829 | BARIS IKRAR TALAK SAMPUL | data_sql | satu baris atau `''` |
| 5836, 5837 | MEDIATOR SAMPUL, HASIL MEDIASI SAMPUL | data_sql | `perkara_mediasi.mediator_text`; "Berhasil" / "Tidak berhasil" / kosong |
| 5839 | KONSEPTOR (ISIAN TANGAN) | data_teks | kosong bawaan |
| 5840 | TGL PEMBERITAHUAN PUTUSAN (PBT) | data_sql | tanggal terakhir `perkara_putusan_pemberitahuan_putusan` |
| 5851 sampai 5854 | DAFTAR ISI BUNDEL A: NO, DOKUMEN, TANGGAL, HALAMAN | data_sql (fungsi) | satu kolom tiap isian |
| 5856 sampai 5859 | DAFTAR ISI BUNDEL B: NO, DOKUMEN, TANGGAL, HALAMAN | data_sql (fungsi) | idem |
| 5860 sampai 5895 | RIWAYAT SIDANG SAMPUL baris 1 sampai 12 (tanggal, alasan penundaan, agenda) | data_sql | sidang ke-n dari `perkara_jadwal_sidang`; kosong bila belum ada |

Tidak ada yang bentrok dengan paket lain yang tercatat di repo (pencarian `5[6-9]xx` dan `7[3-6]xx`: tidak ditemukan; 4950-4959 dipakai paket kesimpulan dan tidak disentuh). Penetapan akhir nomor mengikuti PRASYARAT yang memeriksa `abt_variabel` di server saat pasang.

Variabel yang dipakai ulang tanpa diubah: `0001, 0012, 0013, 0014, 0015, 0017, 0018, 0038, 0046, 0047, 0048, 0053, 0055, 0098, 0100, 0101, 0102, 0104, 0105, 0106, 0111, 0112, 0118, 0120, 0136, 0168, 0170, 0180, 0182, 0183, 0184, 0185, 0191, 0193, 0194, 0206, 0303, 0662, 0663, 0668, 1033, 1036, 1060, 1061, 1064, 1069, 1076, 1077, 1099, 1143, 1144, 1145, 1146, 1182, 1193, 1194, 1195, 1196, 1278, 1295, 8010, 8012, 8146, 8147`.

---

## 6. Rencana paket ABT (baru, belum dibuat; draf di `abt-paket/sampul-daftar-isi-26okt/`)

Pola sama dengan paket x6/x9 (MariaDB 5.5.68 di server, 10.4 di lab laptop):

1. `...-PRASYARAT.sql`: satu baris pemeriksa baca-saja: blok 5800 sampai 5899 kosong di `abt_variabel`; fungsi `isian_rtf_daftar_*` belum ada; berkas RTF belum ada di `derry_briantono/99 PTSP`; baris `abt_menu` 991 ada.
2. `...-FUNGSI.sql`: fungsi tersimpan baru (`isian_rtf_daftar_a/b`, `isian_rtf_sampul_*`), tanpa kata nama aplikasi.
3. `...-VARIABEL.sql` (+ `variabel.json`): `INSERT ... SELECT ... FROM DUAL WHERE NOT EXISTS` untuk setiap kode (pola `abt_menu` w3a), `data_type`, `sql_query`, `locked = 1`.
4. Dua RTF baru: `Sampul Berkas Perkara.rtf`, `Daftar Isi Berkas.rtf` ke `/var/www/html/aps_badilag/_blangko_abt/derry_briantono/99 PTSP/` (hak `apache:apache`, mode 750, seperti berkas tetangga). Tanpa baris `abt_menu` baru. Hanya folder `derry_briantono`; folder pemilik lain tidak disentuh.
5. `...-HITUNG.sql`, `...-PERIKSA.sql` (baca saja, hitung ciri atas sampel perkara; daftar isi vs jumlah relaas/sidang nyata), `pasang-satker.sh` (md5, PRASYARAT, CADANGAN, pasang, PERIKSA, balik otomatis bila gagal), `pulih-satker.sh` (hapus variabel baru, fungsi baru, dan dua RTF; atau kembalikan dari cadangan), `MD5SUMS.txt`.
6. Cadangan sebelum menulis: `mysqldump` `abt_variabel` + `SHOW CREATE FUNCTION`, salinan folder `99 PTSP`.
7. Uji: lab laptop (php56 ABT asli, renderer paket x9) atas beberapa perkara nyata: cerai gugat verstek 1 sidang, cerai gugat kontradiktoir 4 sidang + mediasi + saksi, cerai talak dengan ikrar, itsbat nikah, dispensasi kawin hakim tunggal, perkara prodeo, perkara ghaib. Bandingkan jumlah baris daftar isi dengan jumlah relaas/sidang di SIPP.

Draf yang sudah ada di repo (BELUM dipasang ke mana pun) dijelaskan di `abt-paket/sampul-daftar-isi-26okt/README-DRAF.md`.

---

## 7. Hal yang perlu diputuskan Derry

1. **Sumber ciri hasil analisa (GHAIB, pekerjaan PNS dst., KUMULASI dari petitum, MAFQUD):** (a) ALETA menulis hasilnya ke isian ABT sewaktu perkara dibuka (saya sarankan), atau (b) hanya terisi bila dicetak dari panel ALETA, atau (c) ABT menghitung sendiri dengan kueri lebih sederhana (kurang akurat dari lencana ALETA).
2. **PENERJEMAH:** belum ada sumber data sama sekali. Setuju dengan isian tangan satu ketikan (ya/tidak) di panel?
3. **e-Court dan NON e-Court:** sampul menampilkan salah satunya selalu (usulan) atau mengikuti ALETA (hanya NON e-Court yang bertanda).
4. **Susunan Bundel A/B:** verifikasi urutan terhadap naskah Buku II/bindalmin yang Derry pegang (penempatan slip panjar, penetapan minutasi, relaas pemberitahuan putusan, akta cerai).
5. **Daftar isi ikrar talak:** satu daftar isi dengan bagian IV (usulan), atau tetap terpisah seperti `DAFTAR ISI BERKAS IKRAR TALAK DGL`.
6. **Kop sampul:** hanya nama satker (usulan, universal) atau juga alamat/telepon/laman Donggala seperti sampul penetapan lama.
7. **Jumlah baris riwayat sidang:** 12 tetap (sama dengan ABT lama) atau lebih.
8. **Dokumen dalam daftar isi yang belum punya sumber tanggal:** pengumuman ghaib, salinan putusan, sita, jawaban/replik/duplik/kesimpulan, upaya hukum. Perlu SELECT pengukuran (dan bila e-Court, arsip e-Court) sebelum dikunci. Saya tandai belum diukur.
9. **Ciri tambahan usulan** (WNA, REKONVENSI, GUGATAN SEDERHANA, VERZET): ikut atau dibuang.

## 8. Ringkasan temuan yang berguna di luar tugas ini

- Variabel ABT 0178 "Daftar Isi Berkas" hanya judul kosong; tidak ada blangko ABT yang memakainya.
- Blangko sampul lama memuat nama "PENGADILAN AGAMA MAJENE" di `Sampul Berkas Ikrar Talak.rtf` dan `Sampul Putusan.rtf` (folder `blangko_lainnya`, sisa dari satker lain); tidak diubah (bukan milik Derry).
- Menu PTSP Derry (`99 PTSP`, id 991) kini hanya berisi blangko penetapan awal ("@ 0 - PMH - PHS" dan seterusnya); dua blangko baru akan menjadi isi pertama yang bukan penetapan.
