# Kerjakan penetapan perkara - antarmuka bersama (agen P1 -> P2)

Satu pintu untuk mengerjakan PMH -> PPP -> PJS -> PHS satu perkara, lalu (bila
dicentang) mengunggah e-Doc tiap penetapan. Dipakai ekstensi (kartu Penetapan),
tombol "Penetapan Otomatis" di halaman SIPP, dan penanda halaman SIPP. Semuanya
membaca keadaan dari SATU sumber dan memakai SATU kunci per perkara.

Status: bentuk ini tetap; medan boleh DITAMBAH, tidak diubah maknanya. Isinya diisi bertahap (lihat "Status pengerjaan").

## 1. Fungsi di peramban (yang dipanggil P2)

Berkas baru `ekstensi-sipp/penetapan-kerja.js`, dimuat di halaman SIPP sesudah
`konten.js` (satu skrip konten yang sama, jadi fungsi `konten.js` tetap terlihat).
Ia memasang `globalThis.aletaPenetapanKerja`.

```js
const hasil = await aletaPenetapanKerja.kerjakan({
  nomorPerkara: "684/Pdt.G/2026/PA.Dgl", // wajib
  perkaraId: 10260,                       // opsional (dikenali dari nomor bila kosong)
  mode: "otomatis",                       // "otomatis" | "manual"
  pilihan: {},                            // lihat bagian 3; disaring server menurut mode
  langkah:   { pmh: true, ppp: true, pjs: true, phs: true }, // yang dicentang
  unggahEdoc:{ pmh: true, ppp: true, pjs: true, phs: true }, // yang dicentang
  sita: "",                               // "" | "dikabulkan" | "ditolak" (varian blangko PHS bersita)
  timpaEdoc: false,                       // true = e-Doc yang sudah ada DITIMPA (disetujui di konfirmasi); false = dilewati
  kering: false,                          // true = hanya rencana, tidak menulis apa pun
  pada: (k) => {},                        // kemajuan opsional: { tahap, jenis, teks }
});
```

`unggahEdoc[jenis]` hanya berlaku bila `langkah[jenis]` juga dicentang. Langkah
yang tidak dicentang tidak disentuh sama sekali.

Hasil (selalu objek, tidak melempar):

```js
{
  ok: true,                      // false bila ada langkah DICENTANG yang gagal
  perkara: { perkaraId: 10260, nomorPerkara: "684/Pdt.G/2026/PA.Dgl" },
  kunci: { diambil: true },      // atau { diambil:false, oleh:"...", sampai:"2026-10-20 14:08:00" }
  laporan: [
    {
      jenis: "pmh",              // pmh | ppp | pjs | phs, urut tetap
      status: "tercatat",        // "tercatat" | "dilewati" | "gagal"
      sebab: "",                 // dilewati: "sudah_ada" | "tidak_dicentang" | "sedang_dikerjakan"
                                 // gagal: kode bot (mis. "tanggal_sidang_hari_libur")
      bunyi: "",                 // kalimat untuk dibaca petugas (kosong bila tercatat)
      atasNama: "fahri",         // akun SIPP pejabat yang dicatat (bila tercatat)
      tanggal: "2026-10-20",     // tanggal penetapan yang tercatat / yang sudah ada
      edoc: {                    // hanya bila unggahEdoc[jenis] dicentang
        status: "terunggah",     // "terunggah" | "dilewati" | "gagal" | "tidak_dicentang"
        sebab: "", bunyi: ""
      }
    }
    // ... satu elemen untuk KEEMPAT jenis, urut pmh, ppp, pjs, phs
  ],
  keadaanSesudah: { /* bentuk bagian 2 */ },
  perluPilihanJamKerja: false,   // true bila di luar jam kerja: ulangi dengan jamKerja
  pesan: ""                      // kalimat ringkas seluruh pekerjaan
}
```

Aturan yang dijamin fungsi ini:

- Keadaan SIPP dibaca tepat sebelum menulis. Langkah yang SUDAH ada -> `dilewati/sudah_ada`
  (tidak pernah ditulis ulang, tidak pernah dibongkar).
- Satu perkara satu pekerjaan: kunci per perkara dengan masa berlaku. Pekerjaan kedua
  atas perkara yang sama (tab lain, penanda halaman, ekstensi, antrean) -> semua langkah
  `dilewati/sedang_dikerjakan`, `kunci.diambil=false`.
- Tidak pernah membongkar. Membongkar hanya lewat tombol Bongkar yang ditekan pengguna
  (lihat bagian 5).
- Sisa PMH->PHS ditulis dalam satu transaksi (utuh atau batal); e-Doc diunggah SESUDAH
  penetapannya tercatat, satu per satu, dan e-Doc yang sudah terunggah tidak ditimpa tanpa ditanyakan.
- Mode kering/latihan/coba ekstensi tetap menahan penulisan (sama seperti kartu Penetapan).

## 2. Keadaan penetapan (satu sumber)

`aletaPenetapanKerja.keadaan({ nomorPerkara })` -> bentuk berikut. Bentuk yang sama
dipakai kartu Penetapan, tombol di halaman SIPP, dan penanda baris daftar perkara.

```js
{
  ok: true,
  perkaraId: 10260, nomorPerkara: "684/Pdt.G/2026/PA.Dgl",
  langkah: {
    pmh: { ada: true,  tanggal: "2026-10-20", baris: 3 },  // baris = jumlah baris aktif di perkara_hakim_pn
    ppp: { ada: true,  tanggal: "2026-10-20", baris: 1 },  // perkara_panitera_pn
    pjs: { ada: true,  tanggal: "2026-10-20", baris: 1 },  // perkara_jurusita
    phs: { ada: true,  tanggal: "2026-10-20", baris: 1, tanggalSidang: "2026-11-02" }
  },
  sisa: [],                  // jenis yang belum ada, urut
  lengkap: true,             // keempatnya ada
  tidakSelaras: [],          // jenis yang tanggalnya terisi tetapi barisnya kosong (atau sebaliknya)
  sidik: "9f2c4a7e",         // ikut berubah bila keadaan berubah; dipakai mendeteksi keadaan basi
  kunci: { aktif: false }    // atau { aktif:true, oleh:"...", tujuan:"...", sampai:"..." }
}
```

`ada` benar bila tanggal penetapan terisi ATAU barisnya sudah ada (mana saja) - keadaan
separuh dianggap ada dan ditandai di `tidakSelaras`, tidak pernah ditimpa.

## 3. Pilihan (`pilihan`)

Pada `mode:"otomatis"` server menyusun sendiri majelis (giliran/SK), PP, JS, dan hari sidang;
yang tetap berlaku dari `pilihan` hanya yang juga berlaku di kartu Penetapan pada mode itu
(28 Okt 2026, penetapan sama): `pejabat`, `majelisDipilih` ("Ubah majelis" - usulan dihitung
ulang untuknya), dan - bila `sidkel: true` - `phs`/`ruangan`/`jam` sidang keliling. Pada
`mode:"manual"` hanya yang ingin diubah:

```js
pilihan: {
  majelis: "26-28-31",     // kunci susunan (per majelis), atau
  pmhKursi: [26, 28, 31],  // id hakim_pn per kursi (per orang); hakim tunggal = satu id
  hakimTunggal: false,
  ppp: 30,                 // id panitera
  pjs: 30,                 // id juru sita
  phs: "2026-11-02",       // tanggal sidang pilihan sendiri (hari libur ditolak, tidak diganti)
  ruangan: 2,              // id ruang sidang (sidang keliling = ruang berbendera keliling)
  jam: "09:30",
  pejabat: { pmh: "fahri", ppp: "Sri Susilowati", pjs: "Sri Susilowati", phs: "Himawan" },
  sidkel: false,           // saklar sidang keliling (membuka phs/ruangan/jam di mode otomatis)
  majelisDipilih: [26, 28, 31] // "Ubah majelis" (kedua mode)
}
```

Yang tidak disebut memakai usulan server. Pilihan yang menunjuk orang tidak dikenal -> langkah
itu `gagal` (tidak diam-diam diganti).

## 4. Rute (untuk yang tidak lewat fungsi peramban)

Portal (sesi ALETA, kemampuan `penunjukan`):

| Rute | Fungsi |
| :-- | :-- |
| `POST /aleta/api/aleta-bot/penunjukan/kerjakan` | badan = argumen di atas tanpa `pada`/`unggahEdoc`; menulis penetapan, TIDAK mengunggah e-Doc (e-Doc terikat peramban: blangko ABT dicetak sesi ABT petugas) |
| `GET  /aleta/api/aleta-bot/penunjukan/keadaan?nomor=...` | keadaan (bagian 2) |
| `POST /aleta/api/aleta-bot/penunjukan/kunci` | `{perkaraId, aksi:"ambil"|"lepas", token?, tujuan?}` -> `{ok, token, sampai}` / `{ok:false, alasan:"sedang_dikerjakan", oleh, sampai}` |

Bot (token internal): `POST /internal/aleta-bot/penetapan/keadaan`, `/penetapan/kunci`,
`/penetapan/kunci/lepas`; `/penetapan/tulis-rantai` kini mengambil kunci dan memakai keadaan
yang sama.

Kunci berlaku 180 detik dan diperpanjang tiap langkah; kunci yang mati sendiri tidak
menghalangi selamanya. Peramban yang mengisi borang SIPP lalu menekan Simpan SIPP sendiri
(isi borang / Penunjukan otomatis) mengambil kunci yang sama dan membaca ulang keadaan
tepat sebelum Simpan: bila langkahnya sudah ada, Simpan tidak ditekan.

## 5. Bongkar

`/penetapan/hapus` dan `/penetapan/hapus-semua` (bot) menuntut `perintahPengguna:"bongkar"`
yang HANYA dikirim tombol Bongkar. Tanpanya ditolak `bongkar_tanpa_perintah`. Mode otomatis,
antrean, penanda halaman, dan `kerjakan` tidak pernah mengirimnya.

## Status pengerjaan

Cabang `fitur/p1-penetapan-ganda`, 20 Okt 2026. SELESAI dan diuji:

- Bot: `penetapanKeadaanService` (satu definisi "ada", dipakai penulis, usulan papan, dan penanda baris daftar), `penetapanKunciService` (kunci bermasa berlaku di basis data ALETA, gagal tertutup), kunci baris `SELECT ... FOR UPDATE` di awal transaksi rantai, rute `/penetapan/keadaan`, `/penetapan/kunci`, `/penetapan/kunci/lepas`; `tulis-rantai`, `tulis` (sungguhan) dan `hapus`/`hapus-semua` memakai kunci; bongkar menuntut `perintahPengguna:"bongkar"`.
- Portal: `POST /penunjukan/kerjakan`, `GET /penunjukan/keadaan`, `POST /penunjukan/kunci`; rute hapus/hapus-semua meneruskan dan menuntut `perintahPengguna`.
- Ekstensi: `ekstensi-sipp/penetapan-kerja.js` (`aletaPenetapanKerja.kerjakan/keadaan/ambilKunci/lepasKunci`); pengisian borang SIPP (`kerjakanBorang`) memegang kunci dan membaca ulang keadaan tepat sebelum menekan Simpan.

Catatan untuk penggabungan dengan cabang tombol halaman SIPP (P2): e-Doc pada `kerjakan()` diunggah dengan `otomatis:false` (yang dicentang petugas tidak tersaring oleh "unggah otomatis" di Peta penetapan). Sejak 28 Okt e-Doc yang sudah ada DILEWATI (`sudah_terunggah`) kecuali `timpaEdoc:true` dari konfirmasi halaman - tidak lagi ditanyakan lewat window.confirm di tengah pekerjaan; muat ulang halaman sekali oleh pemanggil (`tanpaMuatUlang`). Kunci sisi ekstensi P2 (`kunciTulisPenetapan`) berlapis di atas kunci server ini - keduanya dipertahankan. Berkas yang kemungkinan bentrok teks: `ekstensi-sipp/manifest.json`, `manajemen_surat/scripts/susun-ekstensi.mjs`, `src/test/sipp-ide-l1-16okt.test.ts` (sama-sama menambah satu berkas skrip), `ekstensi-berkas.ts` (hasil tanam - jalankan ulang `rilis-ekstensi.mjs`).
