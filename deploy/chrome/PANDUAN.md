# Memasang dan memperbarui ekstensi ALETA di Chrome

Ekstensi yang dimuat lewat "Load unpacked" tidak pernah diperbarui Chrome.
Petugas dapat berhari-hari menjalankan versi lama tanpa satu pun tanda, dan
gejalanya tampak seperti kerusakan portal. Berkas di folder ini menutup celah
itu.

---

## Yang perlu diketahui lebih dulu

Chrome **menolak** memasang ekstensi swa-inang lewat kebijakan di komputer yang
tidak terdeteksi terkelola perusahaan. Ini bukan dugaan - Chrome menyebutkannya
sendiri di `chrome://policy`:

> This computer is not detected as enterprise managed so policy can only
> automatically install extensions hosted on the Chrome Webstore.

Komputer kantor berjalan sebagai **WORKGROUP** dan sebagiannya **Windows 10
Home**, yang bahkan tidak dapat digabungkan ke domain. Jalur kebijakan karena
itu **buntu**, dan nilainya ditandai `[BLOCKED]` meskipun sudah terpasang benar
di registry.

Yang dipakai sebagai gantinya: **folder ekstensinya disegarkan sendiri dari
portal**, dan Chrome memuat isi yang baru saat dibuka berikutnya.

---

## Pemasangan di tiap komputer petugas

Salin folder ini ke komputer petugas, lalu jalankan sekali:

```
powershell -ExecutionPolicy Bypass -File pasang-sinkron.ps1
```

Tidak perlu hak Administrator.

Skrip itu akan:

1. menyalin penyegar ke `%USERPROFILE%\ALETA\`,
2. memasang pemicunya - lewat Tugas Terjadwal bila diizinkan, dan bila tidak,
   lewat folder Startup,
3. mengunduh ekstensinya ke `%USERPROFILE%\ALETA\ekstensi-sipp`,
4. mencetak letak folder itu.

Lalu **sekali saja**, muat foldernya di Chrome:

1. Buka `chrome://extensions`
2. Nyalakan **Developer mode** di pojok kanan atas
3. Tekan **Load unpacked**
4. Pilih folder yang dicetak tadi

Sesudah itu tidak perlu diulang. Pembaruan berikutnya masuk sendiri; petugas
cukup menutup Chrome sampai benar-benar keluar lalu membukanya lagi.

> **Hapus dulu salinan lama.** Bila di komputer itu ekstensi ALETA sudah pernah
> dimuat dari folder lain, hapus salinan itu di `chrome://extensions` sebelum
> memuat yang baru. Dua salinan menempel ke halaman SIPP yang sama dan panelnya
> muncul dobel.

---

## Kapan pembaruan masuk

| Pemicu | Kapan berjalan |
| --- | --- |
| Tugas Terjadwal | saat masuk Windows, lalu tiap 4 jam |
| Folder Startup | saat masuk Windows saja |

Skrip memeriksa `updates.xml` lebih dulu - hanya ratusan byte. Bila versinya
sama, tidak ada yang diunduh sama sekali.

Chrome membaca ulang folder ekstensi saat dijalankan. Jadi urutannya:
**komputer dinyalakan - folder disegarkan - Chrome dibuka - versi baru dipakai.**

Untuk menyegarkan segera tanpa menunggu:

```
powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\ALETA\sinkron-ekstensi.ps1"
```

---

## Bila gagal

Semua penyegaran dicatat di `%USERPROFILE%\ALETA\sinkron-ekstensi.log`.

| Gejala | Sebab yang paling sering |
| --- | --- |
| Catatan berbunyi "GAGAL: ... tidak dapat dihubungi" | Komputer tidak menjangkau `192.168.10.10`; uji dengan membuka alamat portal di peramban |
| Catatan berbunyi "versi paket tidak sama dengan updates.xml" | Portal sedang dibangun ulang; penyegaran berikutnya akan berhasil sendiri |
| Versi di Chrome tidak naik padahal catatan berkata BERHASIL | Chrome belum ditutup sepenuhnya - masih ada jendela atau ikon di baki sistem |
| Ekstensi hilang dari Chrome | Foldernya dipindah; muat ulang lewat Load unpacked. ID ekstensi tidak berubah, jadi tidak ada setelan yang hilang |
| Catatan berbunyi BERHASIL tetapi foldernya tidak ada di Explorer | Skrip dijalankan dari dalam aplikasi berpaket (Microsoft Store), yang mengalihkan tulisan ke folder pribadi aplikasi itu. Jalankan dari PowerShell biasa. Skrip memeriksa hal ini sendiri dan akan berbunyi "tulisan dialihkan ke ..." |

Skrip **tidak pernah** menimpa salinan yang sedang bekerja dengan isi yang
rusak: manifest diperiksa, versinya dicocokkan dengan `updates.xml`, dan
keberadaan `konten.js` dipastikan sebelum apa pun disalin. Bila salah satu
gagal, salinan lama dibiarkan utuh.

---

## Mencabut

```
powershell -ExecutionPolicy Bypass -File pasang-sinkron.ps1 -Copot
```

Folder ekstensinya sengaja dibiarkan supaya ekstensi yang sedang dipakai tidak
hilang mendadak. Hapus sendiri bila memang tidak dipakai lagi, lalu hapus juga
salinannya di `chrome://extensions`.

---

## Lampiran: jalur kebijakan, untuk komputer yang terkelola

Berkas `aleta-ekstensi-pasang.reg` dan `aleta-ekstensi-copot.reg` **hanya
bekerja di komputer yang terdeteksi terkelola perusahaan** - anggota domain
Active Directory, tergabung Azure AD, atau terdaftar MDM. Di komputer WORKGROUP
keduanya tidak berpengaruh apa pun; kebijakannya tercatat di registry lalu
diabaikan Chrome.

Bila kelak kantor memakai domain, jalur itu lebih baik daripada penyegar folder:
Chrome memasang dan memperbarui sendiri tanpa Load unpacked sama sekali.
Semuanya sudah siap di sisi portal:

| Hal | Nilai |
| --- | --- |
| ID ekstensi | `pmfdoflbglalkjehigbmcidccnfbohda` |
| Naskah pembaruan | `http://192.168.10.10/aleta/api/aleta-ecourt/ekstensi/updates.xml` |
| Paket | `http://192.168.10.10/aleta/api/aleta-ecourt/ekstensi/paket.crx` |
| Kunci penanda tangan | `/var/www/html/aleta/config/ekstensi-crx.pem` (izin 600) |

Untuk memeriksa apakah sebuah komputer terkelola: buka `chrome://policy` dan
lihat apakah `ExtensionInstallForcelist` bertanda `[BLOCKED]`.

---

## Peringatan tentang kunci

ID ekstensi diturunkan dari kunci penanda tangan di server, dan kunci itu pula
yang disisipkan ke manifest sehingga ID-nya **tidak berubah meskipun foldernya
berpindah**. Tanpa itu, tiap penyegaran akan tampak seperti ekstensi yang lain
dan setelan petugas hilang.

**Cadangkan kunci itu di luar server.** Kehilangannya tidak dapat dipulihkan.

```bash
scp root@192.168.10.10:/var/www/html/aleta/config/ekstensi-crx.pem ./cadangan-kunci-ekstensi.pem
```

Simpan salinannya seperti menyimpan kunci brankas, bukan seperti menyimpan
berkas biasa.
