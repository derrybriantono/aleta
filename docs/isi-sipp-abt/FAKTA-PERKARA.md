# FAKTA PERKARA - satu sumber fakta per perkara (agen U6, 20 Okt 2026)

Untuk agen U1-U5 dan sesi utama. Cabang: `fitur/u6-fakta-sinkron`. Variabel ABT baru jatah U6: 4600-4699.

## Intinya

Fakta yang sama (tanggal nikah, wali, anak, awal perselisihan, ...) dulu dibaca banyak pengisi yang berdiri sendiri. `faktaPerkara()` MEMBUNGKUS semuanya (tidak ada pengisi lama yang dihapus) dan memberi satu pintu:

```js
const { faktaPerkara, nilaiFakta, nilaiKode } = require("./faktaPerkara");   // aleta_bot/services/faktaPerkara.js
const f = await faktaPerkara(perkaraId /* atau nomor perkara */, { isian, runQuery, runAbt, tanggalSidang, ... });
```

Yang dibungkus: `abtUsulanService.dariSipp` (termasuk `abtIsianSippLanjutan`, `abtIsianLengkap20okt` S3, `isiOtomatisJenisS5`, `isiOtomatisJenisS6`), mesin jawaban saksi (`isiJawabanSaksiService.bacaSippSaksi/deteksiPosita`, `isiJawabanSaksiPosita.positaTambahan`, `isiJawabanSaksiFakta.bangunFakta`), isian petugas yang sudah tersimpan di ABT (`abt_data_teks`, baca saja), dan `petitumBerbutir`.

## Bentuk keluaran

```jsonc
{
  "ok": true, "versi": "fakta-perkara/1",
  "perkaraId": 10211, "nomorPerkara": "651/Pdt.G/2026/PA.Dgl", "jenis": 347, "alur": 3,
  "fakta": {                                   // kunci fakta = kunci di peta-fakta-variabel.json
    "nikah.tanggal": {
      "label": "Tanggal nikah", "tipe": "tanggal",
      "nilai": "2018-02-05",                   // nilai KANONIK menurut tipe (tanggal = ISO; rupiah/angka = bilangan; daftar = "a; b")
      "yakin": "pasti",                        // pasti | cukup | ragu
      "sumber": "data SIPP + posita/gugatan",  // sumber yang SEPAKAT dengan nilai ini
      "kutipan": "perkara_data_pernikahan ...",// kalimat/kolom asal (untuk ikon "i")
      "kode": ["5197"],                        // kode variabel ABT yang menyimpan fakta ini
      "kodeAsal": ["5197"],                    // kode dari mana nilai ini terbaca
      "bertentangan": [ { "nilai": "...", "sumber": "posita/gugatan", "kutipan": "...", "kode": "" } ],
      "catatan": "", "hanyaSaran": false       // hanyaSaran: keputusan hakim (mis. huruf alasan 8503) - jangan ditulis sendiri
    }
  },
  "kode": { "5197": { "nilai": "2018-02-05", "yakin": "pasti", "sumber": "...", "kutipan": "...", "fakta": "nikah.tanggal", "bentrok": false, "asalKode": true } },
  "petitum": [ /* butir petitum, lihat bawah */ ],
  "bas": null,                                 // keterangan saksi & bukti tersimpan (modul basPerkara, lihat bagian BAS)
  "bertentangan": ["nikah.kua"],               // fakta yang sumbernya saling bertentangan (yakin otomatis "ragu")
  "usulanSetara": [ /* usulan {kode,nilai,keyakinan,...} untuk kode setara - bentuk sama dengan usulan dariSipp */ ],
  "terbaca": { "perkara": true, "dariSipp": true, "posita": true, "isianAbt": false, "bas": false, "petitum": true },
  "galat": []
}
```

Pembantu: `nilaiFakta(f, "nikah.tanggal")`, `nilaiKode(f, "5197")` (fakta yang sama dibaca dari kode mana pun; tulisan menurut bentuk kode, mis. `slash` 17/11/2025).

## Prioritas sumber (angka kecil menang)

| tingkat | sumber | catatan |
| ---: | --- | --- |
| 1 | isian petugas | `abt_data_teks` / `opsi.isian`; tidak pernah dikalahkan; tetap "pasti" walau sumber lain berbeda (perbedaan dicatat di `bertentangan`) |
| 2 | data SIPP | kolom terstruktur |
| 3 | BAS | keterangan saksi tersimpan |
| 4 | berkas e-Court | gugatan/KTP/lampiran |
| 5 | posita/gugatan | mesin deteksi kalimat |

Dua sumber otomatis berbeda -> `yakin: "ragu"` + `bertentangan`. Sepakat -> sumber digabung, keyakinan tertinggi. Nilai yang memuat kata aplikasi dibuang.

## Peta fakta -> kode variabel

`aleta_bot/config/peta-fakta-variabel.json` (skema `peta-fakta-variabel/1`). Boleh DITAMBAH oleh U1-U5; jangan hapus/ubah arti yang ada.

```json
"anak.nama": { "label": "Nama anak", "tipe": "daftar", "kode": ["5110", "8603"], "kunciSaksi": "anakNama" }
```

- `kode`: kode variabel yang menyimpan fakta itu (dapat lebih dari satu: blangko berbeda memakai kode berbeda). Entri boleh `"5197"` atau `{ "kode": "5197", "bentuk": "indo" }`; `bentukKode: {"1183":"slash"}` di tingkat fakta. Bentuk: `asal | indo | slash | iso`.
- `tipe`: teks | tanggal | angka | rupiah | nama | daftar | jumlahAnak | pilihan (menentukan cara membandingkan dua sumber).
- `kunciSaksi`: kunci lama di `isiJawabanSaksiFakta` (`tglNikah`, `anakNama`, ...) supaya tanya jawab saksi memakai fakta yang sama.
- `hanyaSaran: true`: tidak pernah ditulis sendiri (huruf alasan perceraian).
- Satu kode hanya boleh di satu fakta (dijaga `manajemen_surat/src/test/fakta-perkara-u6.test.ts`).

## Sinkron antar blangko (Blangko Derry)

Isian ABT tersimpan per perkara per KODE, jadi blangko yang memakai kode sama otomatis sama. Untuk kode BERBEDA yang menyimpan fakta yang sama, `usulanSetara` memberi usulan:

- sumber pemenang = isian petugas -> `keyakinan: "pasti"`, `sumber[0].asal: "isian-petugas"`, `kodePola: "fakta-setara-petugas"`, `jagaIsianLama: true` (hanya mengisi yang KOSONG; ketikan petugas tidak pernah ditimpa);
- sumber lain -> keyakinan diturunkan (pasti->cukup, tidak pernah naik) dan `kodePola: "fakta-setara:<fakta>"`.

## Petitum berbutir

`aleta_bot/services/petitumBerbutir.js`: `petitumBerbutir(petitumHtml, { posita, jenis, alur })` -> `{ ada, butir[], utama[], jenisAda{}, ringkas }`.
Butir: `{ urut, nomor, bagian (primer|subsider|provisi|rekonvensi|eksepsi), utama, jenis, jenisLabel, varian, teks, sub[], nominal{nilai,teks,cocok,perBulan,bulan,total}, dibebani (P|T), penerima, didukungPosita, yakin, sumber }`.
`jenis`: cerai-talak, talak-ikrar, cerai-fasakh, nafkah-iddah, mutah, nafkah-madliyah, nafkah-anak, hadhanah, harta-bersama, mahar, itsbat-nikah, dispensasi, wali-adhal, perwalian, asal-usul-anak, ahli-waris, hibah, wasiat, wakaf, poligami, sita, uang-paksa, serta-merta, eksekusi, pengangkatan-anak, ekonomi-syariah, pencatatan-akta, verstek, biaya, kabul, subsider, lain (tidak dikenal - tidak pernah dikarang). Nominal = yang DITUNTUT, bukan yang dikabulkan; besaran dikabulkan tetap keputusan majelis.
Pakai untuk: satu butir amar dan satu pertimbangan per butir petitum (`butir.filter(b => b.utama && !['kabul','biaya','verstek'].includes(b.jenis))`).

## Cara memakai di pengisi jenis (U1-U5)

1. Tambahkan fakta/kode jenismu ke peta (bukan peta sendiri).
2. Pengisi baru cukup memberi usulan lewat jalur `dariSipp` seperti biasa; panggil `faktaPerkara` bila butuh nilai gabungan (mis. tanya jawab saksi: `isiJawabanSaksiService.lengkapi/isiBaris` menerima `faktaBersama`).
3. Setiap usulan `pasti/cukup` yang diisi sendiri wajib punya ukuran di `aleta_bot/config/gerbang-isian.json` (lihat bagian gerbang di bawah). Tanpa ukuran, uji `gerbang-isian-u6.test.ts` gagal dan saat berjalan usulan diturunkan menjadi saran "ragu".

(Bagian BAS dan gerbang diisi pada dorongan berikutnya.)
