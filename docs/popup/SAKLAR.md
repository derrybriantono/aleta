# Saklar popup ekstensi ALETA

Daftar tunggal: tiap saklar di popup (ikon ekstensi di bilah Chrome), bagian tempatnya, kunci penyimpanan
(`chrome.storage.local`), siapa yang membacanya, dan peran yang melihatnya. Dijaga uji
`manajemen_surat/src/test/popup-saklar-rapi-21okt.test.ts`: saklar baru wajib masuk tabel uji dan tabel ini.

Aturan: satu kunci = satu saklar. Kunci tidak diganti; nilai tersimpan pengguna tetap berlaku. Saklar yang disembunyikan
bagi suatu peran nilainya tetap tersimpan. Semua kunci di tabel disimpan per akun dan peran (`KUNCI_SETELAN_AKUN`
di `popup.js` dan `latar.js`).

Tata letak: nama dan keterangan di kiri, saklar geser di kanan, sejajar dengan judulnya. Keterangan panjang dilipat di
balik tombol (i). Tiap bagian dapat dilipat; pilihan lipat diingat di PC ini (kunci `popupLipat`) dan judul bagian
menyebut jumlah saklar yang menyala. Urutan bagian (UI Baru): Tampilan, Panel saat halaman dibuka, SIPP, ABT,
Blangko ABT by Derry Briantono, Portal ALETA, Widget, Admin. Tampilan Lama (khusus Super Admin) memakai urutan yang sama
dengan judul bagian biasa.

## Saklar fitur

| Bagian | Label di popup | Kunci | Bawaan | Dibaca oleh | Dilihat oleh |
| --- | --- | --- | --- | --- | --- |
| Tampilan | Ringkas keterangan di panel | `panelRingkas` | mati | panel-alat.js | semua |
| SIPP | Tandai halaman SIPP | `tandaiHalaman` | nyala | konten.js, panel-alat.js | semua |
| SIPP | Sisipkan berkas ke Jadwal Sidang | `sisipJadwal` | mati | konten.js | semua |
| SIPP | Pratinjau dokumen sebelum unduh | `pratinjauBasRelaas` | menyala | pratinjau-bas-relaas.js | semua |
| SIPP | Menu ABT By Derry, ALETA, dan E-Court di bilah atas SIPP | `menuAtasSipp` | menyala | menu-atas.js | semua |
| SIPP | Kotak ringkasan di halaman perkara SIPP | `sippPenyatu` | nyala | sipp-ide-m2.js | semua |
| SIPP | Tampilkan tombol ALETA yang dobel | `sippTampilDobel` | mati | sipp-ide-m2.js | semua |
| SIPP | Gembok panel ALETA di SIPP: selalu tampil penuh | `gembokKepalaSipp` | mati | panel-alat.js | semua |
| SIPP | Penanda perkara di SIPP (induk) | `ideL2` | nyala | sipp-ide-l2.js | semua |
| SIPP | Penanda: Sita | `ideL2Sita` | nyala | sipp-ide-l2.js | ketua, hakim, PP, juru sita, panitera |
| SIPP | Penanda: Eksekusi | `ideL2Eksekusi` | nyala | sipp-ide-l2.js | ketua, hakim, PP, juru sita, panitera |
| SIPP | Penanda: Izin cerai PNS/ASN | `ideL2IzinCerai` | nyala | sipp-ide-l2.js | ketua, hakim, PP, panitera |
| SIPP | Penanda: Penetapan awal | `ideL2Penetapan` | nyala | sipp-ide-l2.js | ketua, panitera, PP |
| SIPP | Penanda: Belum ditunda sampai 15.00 | `ideL2BelumDitunda` | nyala | sipp-ide-l2.js | ketua, hakim, PP, panitera |
| SIPP | Penanda: Potensi verstek | `ideL2Verstek` | nyala | sipp-ide-l2.js | ketua, hakim, PP |
| SIPP | Penanda: Umur perkara | `ideL2Umur` | nyala | sipp-ide-l2.js | ketua, hakim, PP, panitera |
| SIPP | Penanda: Tanpa sidang berikutnya | `ideL2TanpaSidang` | nyala | sipp-ide-l2.js | ketua, hakim, PP, panitera |
| SIPP | Penanda: Sisa waktu ikrar talak | `ideL2Ikrar` | nyala | sipp-ide-l2.js | ketua, hakim, PP, panitera |
| SIPP | Penanda: Akta cerai dan pemberitahuan putusan | `ideL2AktaCerai` | nyala | sipp-ide-l2.js | ketua, panitera, PP, PTSP |
| SIPP | Penanda: Lewat 5 bulan | `ideL2LimaBulan` | nyala | sipp-ide-l2.js | ketua |
| SIPP | Penanda: Dokumen e-Court belum diverifikasi | `ideL2EcourtVerifikasi` | nyala | sipp-ide-l2.js | ketua, hakim, PP |
| SIPP | Penanda: Putusan di e-Court | `ideL2PutusanEcourt` | nyala | sipp-ide-l2.js | ketua, hakim, PP, panitera |
| ABT | Sunting langsung (klik dua kali) | `suntingLangsungAbt` | mati | panel-alat.js | hakim, PP (menurut profil peran) |
| ABT | Tekan CETAK di ABT menjadi 3 berkas | `cetakTigaBerkas` | mati | abt.js, panel-alat.js | hakim, PP (menurut profil peran) |
| ABT | Gembok panel ALETA di ABT: selalu tampil penuh | `gembokKepalaAbt` | mati | panel-alat.js, blangko-derry.js | peran yang memakai panel ABT |
| Blangko ABT by Derry Briantono | Blangko Derry sebagai tampilan bawaan | `blangkoDerryBawaan` | mati | blangko-derry.js | hakim, PP, juru sita |
| Blangko ABT by Derry Briantono | Tawarkan Blangko Derry di ABT biasa | `blangkoDerryTawar` | nyala | blangko-derry.js | hakim, PP, juru sita |
| Blangko ABT by Derry Briantono | Saran isian samar (tekan Tab) | `blangkoDerrySaran` | nyala | blangko-derry.js | hakim, PP |
| Blangko ABT by Derry Briantono | Ingatkan isian yang masih kosong sebelum cetak | `blangkoDerryIngat` | nyala | blangko-derry.js, abt.js | hakim, PP, juru sita |
| Blangko ABT by Derry Briantono | Isi otomatis dari SIPP | `blangkoDerryIsiOto` | nyala | blangko-derry.js | hakim, PP, juru sita |
| Blangko ABT by Derry Briantono | Tanya-jawab jawab-menjawab otomatis | `blangkoDerryTjJawab` | nyala | blangko-derry.js | hakim, PP |
| Portal ALETA | Gembok panel ALETA di portal: selalu tampil penuh | `gembokKepalaAleta` | mati | panel-alat.js | semua |
| Widget | Checklist milestone | `checklistMilestone` | mati | checklist.js, panel-alat.js | semua (menurut profil peran) |
| Widget | Kehadiran sidang hari ini di widget | `widgetKehadiran` | nyala | checklist.js | hakim, PP, juru sita |
| Widget | Draf putusan H-7 di widget | `widgetDrafH7` | nyala | checklist.js | hakim, PP |
| Admin: latihan dan e-Court | Mode latihan | `modeLatihan` | mati | panel-alat.js | Admin, Super Admin |

Super Admin dan Admin melihat semua saklar. Peran lain hanya yang tertulis di kolom terakhir (tabel `PERAN_SAKLAR` di
`popup.js`, `PERAN_IDE_L2` di `popup-ide-l2.js`, dan `relevan` per golongan di `PROFIL_GOLONGAN`).

## Bukan saklar fitur (dikelola di tempatnya)

| Bagian | Isi | Kunci | Catatan |
| --- | --- | --- | --- |
| Induk (kepala) | Aktif / Mati ALETA | `aktif` | saklar induk di kepala jendela |
| Tampilan | Tema Otomatis / Gelap / Terang, warna gelap Super Admin | `temaPopup`, `temaPanel`, `warnaGelap` | |
| Tampilan | Ukuran huruf panel | `skalaHuruf` | angka 80-160 |
| Tampilan | Sembunyikan penjelasan teknis | `sembunyikanTeknis` | |
| Panel saat halaman dibuka | Panel ALETA (portal), Panel SIPP, Panel ABT | `panelBawaanTampil` | tersimpan juga di akun (server) |
| Admin: latihan dan e-Court | Tarik data e-Court | (server) | satu saklar dengan Penjadwal di Integrasi e-Court |
| Tampilan uji (Super Admin) | Tampilan Lama / Baru / UI Baru, saklar fitur ide, izinkan tindakan nyata | `ujiTampilan`, `ujiFitur`, `ujiIzinkanNyata` | uji; diterapkan admin lewat `tampilanServer` |
| Bagian | Lipatan bagian | `popupLipat` | hanya kenyamanan PC ini |

## Sengaja tidak di popup

| Kunci | Tempat pengaturannya |
| --- | --- |
| `modeKering` | Perkakas di panel (Super Admin) |
| `modeLayarPublik` | Portal ALETA, pintasan Alt+L (fitur uji portal-28) |
| `blangkoDerryUkuran`, `temaPanel` (Derry) | Menu Pengaturan di halaman Blangko Derry |
| Putusan Advance per akun | Portal ALETA, Pengaturan SIPP dan ABT |
| Mode Penetapan Otomatis / Manual, unggah e-Doc tercentang | Panel Penetapan Otomatis di halaman SIPP (per penetapan) |
