# Memasang ALETA ABT di Pengadilan Agama lain (Tahap 8, persiapan)

Dokumen ini hanya menyiapkan. Belum ada satker lain yang memasang, dan Tahap 7 belum lulus, jadi tidak satu pun jenis perkara di Pengadilan Agama Donggala dipindah dari ABT.

## Yang dipasang

Satu **paket induk**: semua blangko Derry (folder blangko, tanpa folder `terhapus`) dan definisi isiannya, dalam satu folder:

```
paket-induk/
  manifest.json      daftar blangko, isian, dan fungsi basis data; sidik paket; daftar perubahan netral; daftar isian yang perlu ditinjau
  blangko/<folder>/<berkas>.rtf
  fungsi/<nama>.sql  dan fungsi/semua.sql (fungsi basis data yang dipanggil rumus isian)
```

Paket dibuat dari pohon blangko Derry dan katalog isian ABT salinan uji. Tidak ada data pihak di dalamnya. Dua hal sudah dinetralkan dari isi khas satu satker:

- isian satker (alamat, telepon, laman, surel, provinsi) tidak lagi membawa cabang khusus Pengadilan Agama Donggala. Satker lain jatuh ke data SIPP setempat (alamat, provinsi) atau dikosongkan (telepon, laman, surel; barisnya tidak dicetak bila kosong);
- kode surat pada nomor surat relaas (isian 1154) diganti kode netral `W00-A00`. Satker mengisi kode suratnya sendiri di Pengaturan SIPP & ABT, bagian Identitas satker.

Isian lain yang masih memuat kata khas daerah (media pengumuman setempat, penanda kota di Sulawesi Tengah, kalimat contoh) **tidak diubah diam-diam**. Namanya tercatat di `perluDisesuaikan` pada manifest (saat paket ini disusun: 2224, 7045, 7063, 8508, 8547, 8706). Petugas satker meninjaunya sebelum memakai blangko yang memuatnya.

## Fungsi basis data (syarat yang mudah terlewat)

Sekitar sepertiga isian Derry memanggil **fungsi basis data** buatan Derry (`aps_badilag.isian_rtf_*`, `isian_bukti_*`, `bulan_romawi`, dan sebagainya; 70 fungsi pada salinan uji). Fungsi itu dibuat di skema ABT, bukan di ALETA. Satker tanpa ABT Derry tidak memilikinya, dan tanpa fungsi itu isian yang memanggilnya kosong dengan galat "FUNCTION ... does not exist" (pada uji awal: nama pihak, identitas pihak, terbilang, bukti, dan semua isian yang bergantung padanya).

Paket menyertakan semuanya di folder `fungsi/` (satu berkas per fungsi, dan `semua.sql` yang siap dijalankan; DEFINER dibuang). Sidiknya ikut sidik paket. **Memasangnya adalah pekerjaan administrator basis data satker, di luar ALETA**: ALETA tidak menulis ke basis data SIPP atau ABT. Fungsi dipasang di skema bernama `aps_badilag` pada MariaDB yang sama dengan SIPP satker (skema itu boleh hanya berisi fungsi). Fungsi ditulis untuk MariaDB 5.5.

## Yang terbaca dari SIPP setempat

Nama pengadilan, pengadilan tinggi, alamat kantor, zona waktu, dan kode satker dibaca isian blangko langsung dari tabel `sys_config` SIPP satker itu. Telepon, laman, dan surel tidak disimpan SIPP; bila satker mengisinya, ia melakukannya di Identitas satker. `periksaIdentitasSipp` (src/lib/aleta-abt-satker.ts) menyusun temuan dengan kalimat sehari-hari sebelum pemasangan.

## Pemisahan

- Pustaka induk adalah **server "induk"** di tabel pustaka ALETA ABT. Blangko dan isian yang dibuat atau diubah satker (asal "aleta", atau diubah) tidak pernah ditimpa dan tidak pernah ditandai hilang oleh pemasangan atau pembaruan paket. Bedanya dicatat sebagai bentrok, seperti sinkron dari ABT.
- Kode isian ALETA ABT (AA + angka) dipetakan **per server**. Nomor isian pada ABT setempat satker (bila ada dan disinkron) memegang kode sendiri dan tidak bentrok dengan nomor isian induk.
- Catatan yang belum terbukti: `muatPustakaMesin` (jalur cetak yang ada) memilih server dengan isian aktif terbanyak. Paket induk memuat sekitar 2.000 isian sehingga menang atas ABT biasa, tetapi tidak ada penunjuk yang memaksanya. Layar dan jalur cetak yang kelak membaca pustaka satker harus memakai `muatPustakaInduk`.

## Urutan pasang (kelak, oleh Derry)

1. Salin folder paket ke server satker; periksa sidik yang sama dengan yang tercatat di laporan.
2. Pasang portal ALETA dan bot di server satker, hubungkan ke SIPP setempat (baca saja).
3. Administrator basis data satker menjalankan `fungsi/semua.sql` di skema `aps_badilag` (lihat bagian Fungsi basis data). Lalu jalankan `pasangPaketInduk(db, "<folder paket>", "<nama pemasang>")`. Paket diperiksa utuh dulu (ukuran dan md5 tiap berkas); paket rusak tidak dipasang setengah. Memasang ulang paket yang sama tidak menulis apa pun.
4. Isi Identitas satker: kode surat, telepon, laman, surel, logo kop. Tinjau isian yang tercatat `perluDisesuaikan`.
5. Uji pada perkara satker itu dengan layar cetak ALETA ABT; bandingkan dengan blangko satker yang ada bila punya.

Pemasangan memakai mesin isian dalam **mode tanpa ABT** (`jalurAleta.tanpaAbt`): katalog isian hanya dari pustaka induk, tabel ABT yang dibaca rumus isian dianggap kosong, dan yang diketik petugas datang dari ALETA. Tabel ABT lain yang disebut rumus tidak ditebak: isian itu kosong dan sebabnya tercatat.

## Cara menyusun dan menguji di laptop

Dari `manajemen_surat/` (salinan uji `sipp_vs` dan `aps_badilag_vs`, hanya dibaca):

```
POHON_AKAR=<folder yang memuat derry_briantono> npx tsx ../scripts/paket-satker-aleta-abt/susun.mts <folder keluaran kosong>
npx tsx ../scripts/paket-satker-aleta-abt/uji-bersih.mts <folder paket> <perkara_id,...> <keluar.txt> [maks blangko]
```

`uji-bersih` memasang paket pada database ALETA kosong di memori, memakai satker rekaan di tempat `sys_config`, dan menyusun semua blangko: yang dihitung hanya penanda yang tertinggal, kata khas satker pembuat paket, galat mesin, dan isian kosong. Keluarannya angka dan nama blangko saja.

## Batas yang jujur

- Diuji di laptop: pemasangan, pustaka induk, mode tanpa ABT, identitas rekaan, penanda tertinggal, bocoran identitas. Pada uji itu fungsi basis data dibaca dari skema salinan uji (`aps_badilag_vs`) karena tidak boleh membuat skema baru di server lokal; bahwa definisi di paket sama dengan yang di salinan itu dijamin oleh cara paket disusun (dibaca dari sana), bukan diuji dengan memasangnya ulang.
- Belum diuji: SIPP satker lain yang sungguhan (versi SIPP dapat berbeda), ABT versi lain, folder blangko yang diubah satker, PDF dan halaman, jumlah isian yang kosong karena tidak ada isian tangan di salinan bersih.
- Keterangan saksi dan isian tangan dalam mode tanpa ABT bergantung pada penyambungan dari ALETA; yang belum tersambung tampil sebagai isian kosong bersorot, tidak pernah diisi dengan tebakan.
- Tidak ada yang ditulis ke ABT, SIPP, atau e-Court, dan tidak ada kata ALETA yang dikirim ke sistem luar.
