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

## BAS -> putusan (keterangan saksi dan bukti yang sudah tersimpan)

`aleta_bot/services/basPerkara.js` (`bacaBas(perkaraId, runAbt, runQuery)`) membaca `abt_keterangan_saksi` (+ identitas saksi di SIPP `perkara_pihak5`, `saksi_id = perkara_pihak5.id`, `saksi_pihak_ke` 1 = pihak Penggugat/Pemohon, 2 = Tergugat/Termohon) dan isian alat bukti 1214 (bukti P.n), 9911 dan 1262 (bukti T.n). Keluaran di `faktaPerkara().bas`:

```jsonc
{ "ada": true, "jumlahSaksi": {"P": 2, "T": 0},
  "saksi": [ { "id": 17557, "pihak": "P", "urutan": 1, "nama": "...", "hubungan": "Adik Kandung Penggugat", "sidang": [20272],
               "tanyaJawab": [ { "no": 1, "tanya": "...", "jawab": "...", "pokok": ["hubungan"] } ] } ],
  "pokok": { "pernikahan": [ { "saksi": 1, "pihak": "P", "nama": "...", "tanya": "...", "jawab": "..." } ], "penyebab": [...], ... },
  "bukti": [ { "sisi": "P", "tanda": "P.2", "jenisKode": "aktaNikah", "nomor": "63/19/II/2010", "tanggal": "01 Maret 2010", "penerbit": "KUA ...", "teks": "..." } ],
  "jumlahBukti": {"P": 2, "T": 0}, "adaJenisBukti": {"ktp": true, "aktaNikah": true} }
```

Pokok pembuktian (`pernikahan, kediaman, anak, penyebab, pisah, nafkah, damai, harta, kematian, identitas-calon, kemampuan, hubungan`) dikenali dari bunyi pertanyaan (pola di `peta-fakta-variabel.json` -> `pokokBas`, boleh ditambah). Jawaban saksi dikutip apa adanya, tidak ada yang dikarang. `bas` hanya dibaca bila pembaca ABT tersedia (`runAbt`).

**Sisi ABT (putusan)**: paket `abt-paket/u6-fakta-sinkron/` menambah 29 variabel kueri 4600-4629 (jumlah/nama/hubungan saksi, kutipan ringkas per pokok 4610-4618, jumlah dan tanda bukti 4620-4623, jenis bukti 4624-4629) yang membaca BAS yang sama, untuk jenis perkara apa pun. Isi dan cara pasang: `abt-paket/u6-fakta-sinkron/PASANG.md`. Duduk perkara cerai sudah membaca keterangan saksi lewat `#2021#`/`#2022#`; variabel baru ini untuk jenis lain dan untuk pertimbangan per dalil.

**Sisi tanya jawab saksi/BAS**: `isiJawabanSaksiService.lengkapi/isiBaris` menerima `faktaBersama` (hasil `faktaPerkara`); rute `/abt/usulan` memasangnya otomatis. Hasil: jawaban saksi memakai nilai yang sama dengan Blangko Derry dan putusan, termasuk koreksi petugas.

## Gerbang otomatis berdasar

`aleta_bot/config/gerbang-isian.json` + `aleta_bot/services/gerbangIsian.js`. Satu tempat yang memutuskan "terisi sendiri" (pasti/cukup) atau "saran ragu":

- tiap (kode, asal: sipp | posita | berkas) membawa ukuran `n` (muncul), `banding` (ada isian petugas pembanding), `cocok`, `persen`, `status`, `pangkatMaks`, `dasar`;
- `otomatis`: pembanding >= 20 dan >= 90% cocok (pasti bila >= 97%); `terstruktur`: dibaca langsung dari kolom SIPP, contoh >= 15, tak ada selisih besar dengan pembanding; selainnya `saran`;
- saat berjalan, rute `/abt/usulan` menerapkan gerbang pada semua usulan (sipp, saksi, itsbat, posita-lain): kode+asal TANPA ukuran atau berstatus saran diturunkan menjadi "ragu" (`keyakinanSemula` dicatat), pasti dibatasi `pangkatMaks`; kalimat ketepatan masuk `catatan` (ikon i) dan objek `gerbang` {status, n, banding, cocok, persen}; isian petugas dan keyakinan non-otomatis tidak disentuh;
- membangun ulang (setelah menambah pengisi): `ALETA_BOT_DB5_NAME=tidak_ada node scripts/isi-sipp-abt/ukur-gerbang-u6.cjs --maks 900 --kerja 5 --mentah <acak.json>` lalu `--khusus 45 --mentah <terstruktur.json>` lalu `--dari-mentah acak.json,terstruktur.json --tulis` (butuh XAMPP lokal `sipp_donggala` + `aps_badilag`; set `ALETA_GERBANG_ISIAN=mati` bila mengukur lewat rute agar penurunan tidak mengacaukan ukuran);
- penjaga: uji `gerbang-isian-u6.test.ts` memindai berkas pengisi (`abtIsian*.js`, `isiOtomatis*.js`, `isiOtomatisS5/*`, termasuk berkas BARU) dan GAGAL bila ada kode yang ditulis dengan pasti/cukup tanpa entri terukur atau tanpa catatan `belumTerukur`; juga menghitung ulang seluruh entri dari data ukur mentah (`UKURAN-GERBANG-U6-*.json`) sehingga tidak ada yang dilonggarkan dengan tangan.

## Hasil ukur (20 Okt 2026, salinan lokal sipp_donggala + aps_badilag; pembanding = isian petugas/hakim)

| yang diukur | berkas mentah | hasil |
| --- | --- | --- |
| Petitum berbutir atas 3.266 perkara 2023+ | `UKURAN-PETITUM-U6.json` | 10.371 butir; 99,0% dikenali jenisnya (sisa "lain" tidak dikarang); jumlah butir = jumlah baris bernomor pada 3.254 dari 3.266 perkara (99,6%) |
| Fakta bersama atas 300 perkara | `UKURAN-FAKTA-U6.json` | 2.724 pasangan fakta-vs-isian petugas, 86,9% cocok; pengisi tunggal lama hanya menjangkau 541 pasangan (87,4%) - jangkauan sekitar 5x dengan ketepatan setara. Fakta yang ditandai bertentangan 88,7% cocok vs 86,8% yang tidak: penanda pertentangan belum membedakan salah-benar dengan tajam (jangan dijadikan satu-satunya alasan menolak nilai) |
| Gerbang atas 1.207 perkara | `UKURAN-GERBANG-U6-ACAK.json`, `-TERSTRUKTUR.json`, `gerbang-isian.json` | 111 pasangan (kode, asal): 26 otomatis, 15 terstruktur, 70 saran; 7 kode `belumTerukur` |

Temuan yang dibawa gerbang (sebelumnya terisi sendiri, kini saran): status Pemohon sebelum nikah (1002: 50% cocok, beda istilah perjaka/jejaka), 1003 (84%), upaya damai 1268 (74%), tujuan itsbat 8171 (66%), huruf alasan 8503 (61%), alasan-alasan cerai 5227 (16%), pendidikan/pekerjaan calon mempelai (68%/35%).
