# Paket ABT `abt-identitas-pihak-1nov` - format identitas pihak putusan/penetapan sama dengan blangko acuan (keputusan pengguna 101, 102, REVISI 112: tanpa umur; 1-2 Nov 2026)

**Status: dibangun dan diuji di LAPTOP. Server: BELUM dipasang. URUTAN: KE-31, PALING AKHIR - sesudah `perbaikan-1nov` (ke-30)** (lihat `../URUTAN-PASANG-1nov.md`).
**REVISI 2 Nov 2026 (keputusan 112, Derry: "umur tidak perlu dalam putusan")**: umur `(N tahun)` DIBUANG dari dua fungsi (`isian_rtf_pihak_identitas`, `isian_rtf_pihak_tambahan`); md5 definisi baru berubah (`hasil/isi-paket.json`), sedangkan **kueri variabel 7047/7048 dan 606 dari 608 berkas RTF lama TIDAK berubah**; ditambah golongan D (2 berkas "[99] BAS LAINNYA" di folder BAS lama, 4 paragraf tertulis tangan yang lolos dari golongan B karena tanda ";" di run terpisah: tulisan `(umur)` dan `(N tahun)` dibuang, gaya tulisan tangan dibiarkan) sehingga **610 berkas**, dan golongan E (keputusan 134, Derry 2 Nov: umur di relaas dibuang) menambah 1 relaas sehingga total **611 berkas**. md5 pohon sesudah ke-31 hanya berbeda di dua berkas BAS LAINNYA itu dan satu relaas (golongan E) - paket yang memakai pohon sesudah ke-31 sebagai dasar md5 (ke-32 kaidah fikih: blangko putusan; ke-33) tidak terpengaruh. Paket ini belum pernah dipasang di server, jadi direvisi langsung.
Hanya blangko RTF, dua variabel (7047, 7048) dan dua fungsi milik **derry_briantono**; tanpa variabel/menu/data baru. Dibangun deterministik:
`python sumber/bangun_paket.py <_blangko_abt sesudah 30 paket> <var_dasar_hex.tsv> paket-satker hasil` (var_dasar_hex = `no_var, HEX(nama), data_type, HEX(sql_query)` untuk 7047/7048 sesudah 30 paket).

**Sidik fungsi di server MariaDB 5.5 (catatan sesi utama 2 Nov 09.15)**: server menyimpan `routine_definition` dengan escape string SUDAH diproses, laptop mentah. Badan kedua fungsi paket ini (baru DAN lama) TIDAK memuat
tanda `\` sama sekali (opsi 1: tanpa escape di dalam string), jadi md5 laptop = md5 bentuk server; dibuktikan dengan peniru sesi utama `D:/Aplikasi/aleta/tmp/kompat55/tiru55.py` (`alat/cek_bentuk_server.py`:
`tiru()` lalu md5 = md5 laptop untuk keempat badan fungsi) dan dijaga uji `paket-identitas-pihak-1nov.test.ts`. Dasar paket ini di server = keadaan sesudah paket 30.

## Acuan dan bentuk yang dituju
Blangko acuan: `1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap).rtf` (keputusan 102; ABT tidak mencatat statistik cetak, jadi dipilih blangko dasarnya). Paragraf identitas
hanya berisi `#7047#` / `#7048#`: rata kanan-kiri, baris pertama menjorok 1,25 cm (`\fi-1843` + `\li2552`), baris lanjutan menjorok gantung 4,5 cm, jarak 1,5; nama dan sebutan tebal;
"melawan" di tengah. Persis contoh pengguna (penetapan 473/Pdt.G/2026). Audit lengkap: `hasil/audit.md`.

Bunyi (keputusan 101): `Nama, NIK ..., tempat dan tanggal lahir X, DD Bulan YYYY, agama ..., pendidikan ..., pekerjaan ..., tempat kediaman di ..., dalam hal ini memberikan kuasa kepada
Nama, S.H., Advokat pada Kantor Hukum ..., beralamat di ..., berdasarkan Surat Kuasa Khusus tanggal ... yang telah didaftarkan di Kepaniteraan Pengadilan Agama ... Nomor ... tanggal ..., sebagai **Penggugat**;`
Tanpa kuasa: bagian kuasa tidak tercetak. Banyak pihak: tiap pihak satu paragraf (`<br>` menjadi `\par`), baris pertama tiap pihak menjorok 1,25 cm, lalu "Dalam hal ini Pemohon I dan Pemohon II ... selanjutnya disebut sebagai Pemohon;" bila ada kuasa.

## Isi
| butir | jumlah | tindakan |
|---|---|---|
| variabel 7047, 7048 (identitas #7024#/#7025# otomatis) | 2 | dari ±45 penanda dan 5 cabang jadi SATU panggilan `isian_rtf_pihak_identitas` (penanda tersisa: sebutan `#0046#`/`#0047#` dan kalimat kuasa `#8540#`/`#8541#`; isian alamat pengguna 8548/8549 tetap dihormati); tetap dibungkus `isian_rtf_identitas_kosong` |
| fungsi `isian_rtf_pihak_identitas` | 1 diganti | TANPA umur (keputusan 112, 2 Nov: "umur tidak perlu dalam putusan"; revisi paket ini), urutan agama-pendidikan-pekerjaan, tanggal lahir sebelum 1900 tetap `...`, kalimat kuasa `, yang telah didaftarkan` -> ` yang telah didaftarkan` (hanya di jalur ini; 8540/8541 untuk relaas dkk. tidak diubah), `v_akhir` VARCHAR(400) -> TEXT (kalimat kuasa panjang tidak terpotong) |
| fungsi `isian_rtf_pihak_tambahan` (Turut Tergugat `#8710#`, intervensi `#7054#`) | 1 diganti | pendidikan ikut, tanpa umur (bagian kosong tetap dilewati, "beralamat di" tetap) |
| blangko RTF | 611 berkas | A: 985 paragraf yang hanya berisi #7047#/#7048#(#8710##7054#) disamakan inden acuan (121 di 121 putusan/penetapan permohonan; 864 di BAS); B: 120 paragraf identitas TERTULIS TANGAN (49 pasang Penggugat/Tergugat di BAS ALUR, 22 pasangan Pemohon I/II di dispensasi kawin dan BAS DK) diganti `#7047#`/`#7048#` (22 paragraf Pemohon II dibuang); C: 7 paragraf "Pemohon I dan Pemohon II selanjutnya ..." disamakan inden; D (revisi 112): 4 paragraf tertulis tangan di 2 berkas `[99] BAS LAINNYA` (folder `- BAS CONTRA PERCERAIAN -` dan `- BAS VERSTEK PERCERAIAN -`) hanya dibuang tulisan `(umur)` dan `(N tahun)`-nya; E (keputusan 134): 1 relaas `98 Relaas/[JS] 6.2. Relaas Pemberitahuan Putusan Verstek T (e-Court)` - ", umur #0103# tahun" dibuang berikut koma depannya ("lahir #0343#, #0347#, agama ...", tanpa koma/kata ganda); pindai seluruh pohon: tidak ada blangko lain yang mencetak umur PIHAK (variabel #0099# #0103# #1034# #3116# #3126# #5027# #0107# #0171# #8427# #8440# #10122# hanya dipakai relaas ini; umur anak/calon mempelai/saksi/kehamilan di DK, Izin Kawin, Wali Adhal (#1030# calon suami), itsbat (#7211# #7212# umur saat menikah), saksi, "21 tahun"/"12 tahun"/"18 tahun" batas usia = bukan umur pihak, dibiarkan) |

Sengaja TIDAK diubah: akta perdamaian (12 berkas, "I./II." bernomor), identitas dalam sel tabel (BAS ikrar talak, BAS LAINNYA), relaas/PTSP, identitas ringkas, `#7047# Konvensi/Tergugat Rekonvensi;` (1 berkas),
variabel 8540/8541 (dipakai relaas dkk.), 3507/3509/3513/3514 (tak dipakai blangko). Variabel/fungsi bersifat global di basis ABT: blangko pengguna lain yang memakai 7047/7048 ikut bunyi baru.

## Yang dibetulkan sekaligus (ditemukan saat audit)
- sisi Tergugat/Termohon hanya mendukung 1-2 pihak: perkara 10089 (3 Tergugat) kehilangan Tergugat III; kini semua pihak tercetak;
- tulisan "(umur)" yang tercetak di identitas Tergugat berkuasa, DK, dan BAS tertulis tangan (kini umur tidak dicetak sama sekali, keputusan 112);
- kalimat kuasa + sebutan terpotong di 400 huruf (perkara 9826, 9878, 9987, 10081: "sebagai Termohon;" hilang);
- ";" tercetak tebal pada Tergugat tanpa kuasa; urutan pekerjaan-pendidikan terbalik antar cabang; alamat tertulis ganda pada pihak banyak (perkara 10006).

## Keputusan sementara (Derry tidur; ditetapkan agen V, mudah diubah)
1. Acuan = blangko dasar kabul verstek CG format lengkap (tanpa statistik pemakaian). 2. (DIBATALKAN 2 Nov, keputusan 112 Derry: umur tidak perlu dalam putusan) "(N tahun)" TIDAK dicetak untuk pihak mana pun; fungsi global, jadi hilang juga di penetapan dan BAS yang memakai #7047#/#7048# (penetapan akhir Pdt.P disamakan dengan putusan). Dokumen yang tidak memakai fungsi ini tidak disentuh.
3. Tanggal lahir sebelum 1900 (salah ketik di SIPP, mis. 1084) dicetak "..." seperti tanggal kosong (dulu tercetak apa adanya) - petugas melihat tanda kosong dan membetulkan SIPP.
4. Turut Tergugat/intervensi ikut pendidikan (tanpa umur). 5. BAS yang sudah memakai #7047#/#7048# ikut inden acuan; BAS tertulis tangan format lengkap diganti variabel (ikut kuasa, tebal; tulisan "(umur)" dan "(N tahun)" di paragraf tertulis tangan ikut hilang karena paragrafnya diganti variabel).
6. Koma sebelum "yang telah didaftarkan" dibuang hanya di identitas pihak.

## Pasang / pulih (server, root)
```bash
ssh aleta 'mkdir -p /root/abt-identitas-pihak-20261102'; scp -r paket-satker/* aleta:/root/abt-identitas-pihak-20261102/
ssh aleta 'bash /root/abt-identitas-pihak-20261102/pasang-satker.sh'   # PRASYARAT COCOK (2|0|2|0|0|6) -> BERKAS SIAP -> CADANGAN -> FUNGSI -> SEMUA COCOK -> UJI -> TAMBAL=611 -> BERKAS COCOK -> SELESAI
ssh aleta 'bash /root/abt-identitas-pihak-20261102/pulih-satker.sh'    # BERKAS PULIH -> VARIABEL KEMBALI -> FUNGSI ... DIKEMBALIKAN -> PULIH COCOK
```
- PRASYARAT: dua fungsi dan dua variabel persis keadaan sesudah ke-30 paket, enam fungsi pendukung ada, tiap berkas persis dasar. Satu saja berbeda -> GAGAL, TIDAK ada yang diubah.
- PASANG: cadangan (`cadangan/abt_variabel-sebelum.sql`, berkas lama di `cadangan/rtf-lama`) -> fungsi -> SQL satu transaksi -> PERIKSA -> UJI atas data nyata (identitas sisi 1 dan 2 TANPA umur "(N tahun)" dan tanpa "(umur)", tanggal lahir langsung disusul agama, pendidikan sebelum pekerjaan;
  Turut Tergugat tanpa umur; 6 perkara contoh menjalankan kueri baru) -> berkas -> PERIKSA; gagal = PULIH otomatis.
- PULIH: hanya yang masih persis isi paket dikembalikan; yang sudah disunting orang dibiarkan dan dilaporkan. Pulihkan paket ini SEBELUM paket sebelumnya.

## Uji (laptop)
- `hasil/uji-lokal.txt` (`sumber/uji_lokal.sh`): pasang, pasang ulang (tidak mengubah apa pun), pulih (= pohon, variabel DAN fungsi dasar persis), pasang lagi, tiga penjaga (berkas disunting orang; variabel 7047 disunting orang).
- Kinerja (`hasil/kinerja.md`): render identitas 34 perkara contoh, sebelum 173,3 dtk -> sesudah 5,5 dtk.
- Banding variabel sebelum/sesudah atas 34 perkara contoh (1 pihak, 2, 3, 4, >= 5, tidak rapat, kuasa satu/dua pihak, alamat diubah pengguna, ghoib): 31 SAMA setelah menormalkan urutan/koma kuasa (umur sudah tidak dicetak); 3 beda semuanya perbaikan di atas.
- Render sungguhan (renderer ABT php56) sebelum/sesudah: `hasil/render.md`; PNG di `D:/Aplikasi/aleta/tmp/w177/render/png/` (memuat data asli, tidak dikirim keluar).
- Penjaga isi paket: `manajemen_surat/src/test/paket-identitas-pihak-1nov.test.ts`. Uji rantai 31 paket: `../uji-rantai-31okt/hasil-rantai-31.txt` (`sumber/rantai177.sh`): RANTAI-KELUAR 0, sidik pohon sesudah ke-31 (610 berkas, revisi 2 Nov) = `9192536631b117d5a93401685d95bfa5` (uji lokal; 608 berkas versi lama = `19ee866e...`);
  dasar sesudah 30 paket = `9931cdd9c3f77cb0575d9ab9ec9322ee` (sama dengan rantai agen Q). Catatan laptop: fungsi bawaan dump menunjuk basis `sipp` (PA Bungku), jadi rantai mengarahkannya ke salinan SIPP uji sebelum paket ke-31 (di server tidak perlu).
- `npx tsc --noEmit` bersih; vitest paket-identitas-pihak-1nov (11), alamat-putusan-28okt, alamat-ganda-26okt, paket-bas-lanjutan-1nov, paket-tanya-jawab-format-1nov, paket-perbaikan-1nov hijau.
