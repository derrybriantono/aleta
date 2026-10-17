# ALETA banyak satker - Tahap 0

Tahap 0 menyiapkan satu satker (Donggala) agar siap dihubungkan ke ALETA Pusat nanti, **tanpa server Pusat dan tanpa mengubah perilaku yang sudah berjalan**. Semua fitur yang ada tetap menyala di Donggala.

## Keputusan yang dipegang

- Super admin global hanya Derry. Tidak ada super admin lokal yang setara di satker lain.
- Derry dapat masuk ke ALETA satker mana pun sebagai super admin dan mengubah data tanpa persetujuan admin satker itu.
- Setiap akses itu **wajib tercatat dan diberitahukan** ke admin satker. Tidak ada pintu belakang.
- Pembaruan aplikasi dan ekstensi dapat didorong ke satker lain; fitur dibatasi per satker, terutama fitur uji coba.
- "ALETA Pusat" untuk sementara milik pribadi pengguna (nanti di VPS). http biasa, https bila tersedia.
- Tidak satu kata "Aleta" pun ditulis ke SIPP/ABT. Tahap 0 tidak menulis ke SIPP/ABT sama sekali.
- Tanpa migrasi: semua pengaturan memakai `aleta_ekstensi_setelan` (pengguna sistem `*sistem*`, kunci berawalan `sistem:`), pola yang sama dengan Putusan Advance per akun.

## Arsitektur

```
 portal (Next.js)                                   bot                    ekstensi
 ------------------------------------------         -------------------    -----------------
 lib/fitur-satker.ts        aturan murni            fiturSatkerService     rute "siapa" memuat
 lib/kanal-pembaruan.ts     kontrak Pusat           (diterima dari portal) ruas fiturSatker
 lib/super-admin-global.ts  penanda + jejak         routes/fiturSatker...  updates.xml: header
 server/modules/satker/                                                    X-Aleta-Saluran
   identitas.ts   satu sumber kode satker
   fitur.ts       baca/simpan saklar, dorong ke bot
   kanal.ts       saluran + alamat Pusat + cek Pusat
   akses-global.ts jejak akses + daftar terbaru
   tiket-masuk.ts pemeriksaan tiket dari Pusat
 server/shared/pusat-tanda-tangan.ts  Ed25519
 /api/satker/fitur  +  /admin/fitur-satker     (Super Admin saja)
```

### 1. Identitas satker (satu sumber)

`server/modules/satker/identitas.ts` membaca `aleta_identitas_satker` (migrasi 0069; diisi di Pengaturan SIPP & ABT > Identitas satker, kodenya = KodePN SIPP, mis. `PA.Dgl`). Urutan: identitas tersimpan, lalu env `ALETA_KODE_SATKER`, lalu kosong ("belum diatur"). `pastikanInstalasiId` membuat UUID per pemasangan (disimpan sekali) agar Pusat dapat membedakan salinan cadangan/server uji yang mengaku satker yang sama. Penyuntingan identitas tetap di `pengaturan-abt/identitas-satker.ts`.

### 2. Saklar fitur per satker

- Katalog 25 fitur (`KATALOG_FITUR_SATKER`): 18 portal, 3 bot, 4 ekstensi (satu per bagian: sipp, abt, portal, popup). Semua berstatus bawaan **stabil**. Fitur baru yang belum boleh menyala di semua satker ditambah dengan bawaan `uji-coba` atau `mati`.
- Status: `stabil` (menyala), `uji-coba` (menyala, hanya di saluran uji-coba; di saluran stabil dianggap mati), `mati`.
- Plafon Pusat: izin dari Pusat membatasi pilihan satker (mati < uji-coba < stabil). Tanpa Pusat tidak ada plafon.
- **Gagal ke sisi menyala**: belum diatur, setelan rusak, atau basis data tidak terbaca = semua menyala. Fitur lama tidak berkurang karena galat baca.
- Pembaca:
  - portal: `pastikanFiturMenyala(db, kode)` (sudah dipasang di `putusan/advance`; rute lain dipasang bertahap bila satker membutuhkannya);
  - ekstensi: `GET /api/aleta-ecourt/ekstensi/siapa` memuat `fiturSatker: {saluran, fitur:{kode: status}}`. Ekstensi 1.205.1 mengabaikannya; pembacanya baru masuk saat rilis ekstensi berikutnya;
  - bot: portal mendorong ringkasan ke `POST /internal/aleta-bot/fitur-satker/sinkron` tiap disimpan (token internal yang sama). Bot menyimpan di `data/fitur-satker.json`; bot tanpa data memakai bawaan menyala. `aleta_bot/services/fiturSatkerService.js` menyediakan `fiturMenyala(kode)`.
- Layar **Fitur Satker** (`/admin/fitur-satker`, menu grup Sistem) dan rute `/api/satker/fitur`: hanya Super Admin (Admin biasa ditolak 403 dan menunya tidak tampil). Perubahan tercatat sebagai `UPDATE_FITUR_SATKER` di jejak audit beserta daftar yang berubah.

### 3. Super admin global

- **Penanda** = konfigurasi server, bukan data portal: env `ALETA_SUPER_ADMIN_GLOBAL` (username atau id akun, dipisah koma). Sengaja tidak dapat diubah dari layar admin, supaya admin satker tidak dapat menandai dirinya sendiri. Akun harus berperan `super-admin` dan aktif.
- **Jejak**: `resolveActorUserId` (dilewati setiap rute ber-sesi) mencatat sesi pertama akun global ke `audit_logs` (aksi `AKSES_SUPER_ADMIN_GLOBAL`, entitas `super_admin_global`, payload: username, nama, kode satker, cara, IP, agen pengguna). Satu baris per sesi; id sesi disimpan sebagai hash, bukan mentah.
- **Gagal ke sisi tertutup**: bila jejak gagal ditulis, sesi akun global itu ditolak. Akun biasa tidak terpengaruh, dan tanpa env tidak ada kueri tambahan sama sekali.
- **Pemberitahuan**: admin satker melihat tugas "Super admin global masuk ke ALETA satker ini" (prioritas tinggi, 30 hari terakhir, maksimal 10) di daftar tugas portal yang ada; layar Fitur Satker menampilkan 20 akses terbaru.
- **Kemampuan "masuk sebagai super admin"** ke satker lain (tanpa akun lokal): tiket bertanda tangan dari Pusat. Tahap 0 menyediakan **pemeriksaan** tiket (`tiket-masuk.ts`), belum penukarannya menjadi sesi (Tahap 1).

### 4. Kanal pembaruan

- Per satker: `saluran` (`stabil` | `uji-coba`, dipilih Super Admin, kelak dapat dipaksa Pusat) dan `alamatPusat` (dapat diatur; **kosong = berjalan mandiri**, cek menjawab "belum diatur", bukan galat). Kunci `sistem:kanal-pembaruan`.
- Mekanisme pembaruan yang sudah jalan **tidak berubah**: portal lewat `system-update` (manifest + skrip host), ekstensi lewat `update_url` -> `updates.xml` -> `.crx`. Rute `updates.xml` hanya menambah header `X-Aleta-Saluran` (gagal baca = `stabil`); isi naskah dan alamat `.crx` sama.
- Cek pembaruan ke Pusat hanya **mencatat dan menampilkan**; tidak mengunduh atau menerapkan apa pun.

## Kontrak data satker <-> Pusat (untuk Tahap 1)

Satker menarik ke Pusat; Pusat tidak pernah menembak masuk ke jaringan satker.

### Cek pembaruan

`POST {alamatPusat}/api/pusat/v1/cek`, header `x-aleta-satker-kunci: <kunci satker dari Pusat>` (env `ALETA_PUSAT_KUNCI`, tidak di basis data).

Permintaan (tanpa data perkara atau pegawai):

```json
{ "skema": 1,
  "satker": { "kode": "PA.Dgl", "nama": "Pengadilan Agama Donggala", "instalasiId": "<uuid>" },
  "saluran": "stabil",
  "versi": { "portal": "2.40.1", "ekstensi": "1.205.1" },
  "waktu": "2026-10-18T03:00:00.000Z" }
```

Jawaban:

```json
{ "skema": 1,
  "manifest": { "skema": 1, "diterbitkan": "...",
    "saluran": { "stabil":   { "portal": { "versi": "2.41.0", "dirilis": "...", "minimalVersi": "2.40.0",
                                           "catatan": ["..."],
                                           "unduh": { "alamat": "https://...", "sha256": "<64 heks>", "ukuranByte": 123 } },
                               "ekstensi": { "versi": "1.206.0" }, "bot": { "versi": "..." } },
                 "uji-coba": { } } },
  "izin": { "fitur": { "kode-fitur": "stabil|uji-coba|mati" } },
  "saluranDipaksa": null,
  "pesan": "",
  "tandatangan": "<base64 Ed25519 atas kanonik({manifest, izin, saluranDipaksa})>" }
```

- Kanonik = JSON dengan kunci diurutkan, tanpa spasi (`server/shared/pusat-tanda-tangan.ts`).
- Satker hanya menerima jawaban yang tandatangannya cocok dengan kunci publik Pusat di env `ALETA_PUSAT_KUNCI_PUBLIK` (PEM). Tanpa kunci itu semua jawaban ditolak; karena yang dipercaya tanda tangan, http biasa pun aman.
- Paket tanpa `sha256` sah tidak ditawarkan untuk diunduh (sama dengan aturan `system-update`). Bentuk `portal` sejalan dengan `AletaUpdateManifest` yang sudah ada.
- Yang disimpan satker: `sistem:izin-pusat` (plafon fitur), `sistem:pusat-terakhir` (hasil cek, saluran dipaksa). Pilihan satker (`sistem:kanal-pembaruan`) tidak ditimpa; saluran efektif = dipaksa Pusat, lalu pilihan satker, lalu stabil.

### Tiket masuk super admin global

```json
{ "skema": 1, "jenis": "masuk-super-admin-global", "satker": "PA.Dgl", "sub": "<username global>",
  "jti": "<id unik>", "terbit": "...", "kedaluwarsa": "...", "alasan": "...", "tandatangan": "<Ed25519>" }
```

Diperiksa `periksaTiketMasuk`: tanda tangan, kode satker cocok, umur maksimal 10 menit, tidak bertanggal masa depan, belum kedaluwarsa, `sub` tercantum di penanda server. Tiket dipakai **sekali** (`jti`) dan hasil masuk dicatat/diberitahukan dengan `cara: "tiket-pusat"`.

## Yang masih butuh VPS / Tahap 1

1. Server ALETA Pusat: `POST /api/pusat/v1/cek`, penerbitan manifest per saluran, registri satker (kode, instalasi, kunci satker), penyimpanan kunci pribadi Ed25519 Pusat.
2. Pemasangan `ALETA_PUSAT_KUNCI_PUBLIK` dan `ALETA_PUSAT_KUNCI` di tiap satker, serta `ALETA_SUPER_ADMIN_GLOBAL` di tiap server satker.
3. Penukaran tiket menjadi sesi super admin (pembuatan sesi + daftar `jti` terpakai agar tidak dapat diulang) dan layar penerbitannya di Pusat.
4. Penolakan manifest lama yang dikirim ulang (bandingkan `diterbitkan` dengan yang terakhir diterima).
5. Pembaca `fiturSatker`/saluran di sisi ekstensi (butuh rilis ekstensi), dan penyaringan `updates.xml` per saluran bila Pusat menyediakan `.crx` uji coba terpisah.
6. Penerapan pembaruan portal terjadwal dari Pusat lewat skrip host (sekarang tetap manual oleh admin satker).
7. Penegakan "tidak ada super admin lokal" di satker lain (pembatasan pembuatan akun berperan `super-admin`) dan pemberitahuan tambahan lewat WhatsApp untuk admin satker.
8. Pemasangan `pastikanFiturMenyala` ke rute fitur lain menurut kebutuhan satker pertama selain Donggala.

## Uji

`src/test/banyak-satker-fitur.test.ts` (matriks saklar, bawaan menyala, simpan/audit, rute Super Admin saja, menu, sisi bot), `banyak-satker-akses-global.test.ts` (penanda, jejak, pemberitahuan tanpa tanda palsu, gagal tertutup, kait `resolveActorUserId`, tanda tangan, kanal, cek Pusat, tiket), `banyak-satker-advance-saklar.test.ts` (gerbang `putusan/advance`).
