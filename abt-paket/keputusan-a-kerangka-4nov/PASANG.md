# Paket ABT `abt-keputusan-a-kerangka-4nov` - keputusan Derry 182/184 (4 Nov 2026), kerangka berisian + variabel baru

**Status: dibangun dan diuji di LAPTOP. Server: BELUM dipasang.** Hanya blangko dan variabel pengguna **derry_briantono**.
12 blangko ditambal (14 potongan), 4 blangko BARU, 4 variabel BARU (9266-9269, data_sql). Tanpa fungsi baru, menu, tabel; tanpa kata nama aplikasi.

**Urutan pasang: `ijab-yang-menikahkan-3nov` -> `audit-mekanis-4nov` -> `audit-ejaan-4nov` -> `keputusan-a-mekanis-4nov` -> paket ini -> `keputusan-a-rekonvensi-4nov`.**
Pulih terbalik (rekonvensi, kerangka, mekanis, ...).

## Isi
| kode | keputusan | ubahan | berkas |
|---|---|---|---|
| A4 | nafkah iddah per bulan dari isian | di 9 varian CT Mut'ah Iddah, `angka Rp600.000,00 (enam ratus ribu rupiah) setiap bulan atau Rp20.000,00 (dua puluh ribu rupiah) setiap harinya` (teks MERAH) -> `angka #9268# setiap bulan atau #9269# setiap harinya` (HITAM, `\cf1`) | 9 |
| A4 | variabel 9268 / 9269 | membaca isian Nafkah iddah `#6054#` (teks bebas): angka pertama sesudah "Rp"; dibagi 3 bulan (per bulan), per hari = per bulan / 30; bila isian sudah menyebut "setiap bulan/per bulan/tiap bulan/dikali" angkanya dipakai apa adanya (tidak dibagi 3). Terbilang lewat `isian_rtf_terbilang` yang sudah ada. Isian belum terisi angka (`Rp_,00`) / tak terbaca -> `..........` | - |
| A8 | BAS Itsbat memakai tabel tanya-jawab ALETA | `- BAS ITSTBAT NIKAH -/[01a]` dan `[01ab]`: tabel tanya-jawab saksi 1 dan 2 teks tetap (30-32 baris x2, memuat `#1241#` `#5127#`...) -> satu paragraf `#5058#` / `#5059#` seperti `2 Itsbat Nikah - BAS/BAS ALUR 11` (alat `bas-tanya-jawab-29okt/sumber/ubah.py`, 2 berkas x 2 blok) | 2 |
| A9 | saksi Tergugat ke-3 / ke-4 sampai ke putusan | variabel 9266 (`isian_rtf_ket_saksi` atas nama `#6138#`), 9267 (atas `#8934#`) - pola 9264/9265; 4 blangko BARU di `1 Perceraian CG` dan `1a Perceraian CT`: `[02] [Kabul] CG - F - (3 Saksi T).rtf`, `(4 Saksi T)`, `[02] [Kabul] CT - F - (3 Saksi T).rtf`, `(4 Saksi T)` | 4 baru |
| A10 | AUA [01b] dipecah paragraf | `8 Asal Usul Anak/[01b]`: seluruh blok duduk perkara yang disambung `\line` menjadi paragraf (`\par`); identitas saksi, keterangan `#9259#`/`#9260#` (gaya `\fi-400 \li1120` persis [01]) dan kalimat berikutnya | 1 |

## Blangko baru A9 (isi)
Salinan `[02] [Kabul] C? - F` (keadaan sesudah keputusan-a-mekanis) ditambah:
- identitas saksi ke-3 T: `#6138#, umur #6139# tahun, agama #6140#, pendidikan #6141#, pekerjaan #6142#, bertempat tinggal di #6143#, saksi mengaku sebagai #8922#, ...` + `#9266#`; (4 saksi: `#8934#`-`#8939#`, `#8940#` + `#9267#`); nomor daftar "3." / "4." (daftar otomatis Word tetap).
- pertimbangan sisi Tergugat menyesuaikan bilangan: "2 (dua) orang saksi" -> "3 (tiga)" / "4 (empat)"; "yaitu #6100# (Saksi I) dan #6106# (Saksi II), keduanya merupakan #1251# dan #1252#" -> "... #6106# (Saksi II) dan #6138# (Saksi III), ketiganya merupakan #1251#, #1252# dan #8922#" (4 saksi: "... #6138# (Saksi III) dan #8934# (Saksi IV), keempatnya merupakan #1251#, #1252#, #8922# dan #8940#"); "baik saksi pertama maupun saksi kedua" -> "baik saksi pertama, saksi kedua maupun saksi ketiga" (4: "... saksi ketiga maupun saksi keempat"); "bukti elektronik T.3 dan 2 (dua) orang saksi" -> "3 (tiga)" / "4 (empat)".
- Cakupan: hanya putusan kontradiktoir cerai CG dan CT [02] (kabul). Putusan kontradiktoir jenis lain (~100 berkas dengan `#9264#/#9265#`) belum punya varian 3-4 saksi T; pola `sumber/bangun_kerangka.py` (fungsi `buat_varian`) dapat diperluas bila Derry menghendaki.
- Portal: `KETERANGAN_SAKSI_OTOMATIS` (susun.ts) memetakan `9266 -> 2032`, `9267 -> 8942` agar panel Blangko Derry menampilkan "Tanya jawab Saksi 3/4 Tergugat"; daftar `keteranganOtomatis` di `ekstensi-sipp/abt-panel-blangko.js` ditambah; uji `saksi-itsbat-sinkron-3nov` dan `k11-peta-abt-26okt` disesuaikan. **Ekstensi belum dirilis** (versi tidak dinaikkan, berkas tertanam `ekstensi-berkas.ts` belum disusun ulang): ikut rilis ekstensi berikutnya. Tanpa itu blangko baru tetap benar karena memuat `#9264#`/`#9265#` juga.

## Contoh sebelum/sesudah
- A4: "angka **Rp600.000,00 (enam ratus ribu rupiah)** setiap bulan atau **Rp20.000,00 (dua puluh ribu rupiah)** setiap harinya" -> isian `sejumlah Rp1.800.000,00 (...)`: sama; `sejumlah Rp6.000.000,00 (enam juta rupiah)`: "**Rp2.000.000,00 (dua juta rupiah)** setiap bulan atau **Rp66.667,00 (enam puluh enam ribu enam ratus enam puluh tujuh rupiah)** setiap harinya"; `Rp5.000.000,00 (lima juta rupiah) setiap bulan dikali 3 bulan ...`: "**Rp5.000.000,00 (lima juta rupiah)** setiap bulan". Rincian: `hasil/uji-iddah.txt` (11 kasus).
- A8: 30 baris tabel teks tetap ("Ya, saya kenal ... karena saya adalah #1241#; ..." dst.) -> `#5058#` (saksi 1) dan `#5059#` (saksi 2): jawaban saksi sesungguhnya dari tanya-jawab ALETA/ABT.
- A10: "...menerangkan sebagai berikut:\line 1.<tab>#1197#... sebagai berikut:\line #9259#\line 2.<tab>#1203#..." -> paragraf terpisah, `#9259#`/`#9260#` menjorok 400 twip seperti [01].

## Dasar md5 / PRASYARAT
- Berkas: `tambal_rtf.py cek` - md5 tiap 12 berkas = keadaan SESUDAH keputusan-a-mekanis-4nov (9 CT Mut'ah Iddah terkena `isteri -> istri` paket itu; BAS dan AUA tak tersentuh paket sebelumnya). Satu saja beda -> BERHENTI. Blangko baru: berkas bernama sama sudah ada -> BERHENTI.
- SQL `A|B|C`: A = nomor 9266-9269 berisi lain dari paket (0) | B = variabel paket persis (0 pasang pertama / 4 pasang ulang) | C = fungsi `isian_rtf_ket_saksi`, `isian_rtf_terbilang` dan variabel 6054, 6138, 8934, 1197 ada (6). Pasang bila `0|0|6`, pasang ulang `0|4|6`.
- Nomor 9266-9269 diperiksa kosong di basis salinan server 3 Nov (3.007 variabel) dan tidak diklaim paket lain di semua worktree/branch yang ada (4 Nov 08.00).
- Variabel ditulis dengan hex (`CONVERT(0x... USING latin1)`) dan `REPLACE(... 'aps_badilag.' -> DATABASE())`: aman untuk MariaDB 5.5 server dan basis uji laptop; tanpa escape di badan fungsi.

## Pasang (Git Bash, server hidup; SESUDAH `keputusan-a-mekanis-4nov` `SELESAI`)
```bash
cd /d/.../abt-paket/keputusan-a-kerangka-4nov && rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-keputusan-a-kerangka-20261104'
scp -r paket-satker/* aleta:/root/abt-keputusan-a-kerangka-20261104/
ssh aleta 'cd /root/abt-keputusan-a-kerangka-20261104 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-keputusan-a-kerangka-20261104/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|6)`, `SIAP=12`, `BERKAS SIAP` (dua kali), `PERIKSA: SEMUA COCOK`, `UJI: 4 kueri berjalan`, `TAMBAL=12`, `BUAT=4`, `BERKAS COCOK` (dua kali), `SELESAI`.
Pasang ulang: `PRASYARAT COCOK (0|4|6)`, `SUDAH=12`, `SUDAH_BARU=4`. Pulih: `bash /root/abt-keputusan-a-kerangka-20261104/pulih-satker.sh` -> `HAPUS=4`, `PULIH=12`, `PULIH COCOK (0|0|6)`
(berkas/variabel yang disunting sesudah dipasang dibiarkan dan dilaporkan). Tidak perlu memulai ulang apa pun. Sesudah pasang: cetak satu putusan CT Mut'ah Iddah dan satu BAS Itsbat dari panel (isian Nafkah iddah terisi).

## Uji (laptop)
- `hasil/uji-lokal.txt` (`U=<salinan> SEBELUM_MEKANIS=<pohon dasar> bash sumber/uji_lokal.sh <pohon sesudah mekanis>`; basis ABT `aps_badilag_w206` = salinan server 3 Nov, SIPP `sipp_donggala`): pasang (prasyarat 0|0|6, PERIKSA, uji 4 kueri), pasang ulang (sidik pohon dan variabel tetap),
  pulih (pohon dan seluruh tabel variabel = awal), pasang lagi (= pasang pertama), satu berkas CT disunting -> berhenti, mekanis belum terpasang -> berhenti, nomor 9268 bentrok -> berhenti, berkas baru bernama sama -> berhenti, disunting lalu pulih -> dibiarkan.
- `hasil/uji-iddah.txt` (`sumber/uji_iddah.py`): 11 isian #6054# bermacam bentuk -> angka per bulan / per hari benar (GAGAL=0).
- Render Word rekaan (nama rekaan) 6 pasangan x majelis/tunggal: `D:/Aplikasi/aleta/tmp/w206/bukti-k1/` (`hasil/render-banding.txt`): jumlah halaman sama (AUA 6 -> 6, CT 11 -> 11), putusan baru 29 halaman; beda kata hanya kata yang dimaksud.
- Penjaga repo: `manajemen_surat/src/test/keputusan-a-kerangka-4nov.test.ts`.
