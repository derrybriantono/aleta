# Paket ABT `abt-keputusan-a-rekonvensi-4nov` - keputusan Derry 182 butir A2 (4 Nov 2026): CT Rekonvensi [02] jadi KERANGKA

**Status: dibangun dan diuji di LAPTOP. Server: BELUM dipasang.** Satu blangko **derry_briantono**:
`1a Perceraian CT/[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).rtf` (55 potongan: 42 ubahan teks + 13 paragraf dibuang; 662.922 -> 653.519 bita).
Tanpa variabel, menu, fungsi, tabel baru; tanpa kata nama aplikasi.

**Urutan pasang: `ijab-yang-menikahkan-3nov` -> `audit-mekanis-4nov` -> `audit-ejaan-4nov` -> `keputusan-a-mekanis-4nov` -> `keputusan-a-kerangka-4nov` -> paket ini** (butuh variabel `#9268#`/`#9269#` dari paket kerangka). Pulih paling dahulu.

## Keadaan berkas sebelum paket
Berkas sudah banyak memakai variabel (konvensi seluruhnya memakai `#0046#`/`#0047#`), tetapi bagian REKONVENSI masih memuat fakta perkara contoh. Yang dibereskan:

| bagian | sebelum | sesudah | kali |
|---|---|---|---|
| daftar keterangan saksi / fakta persidangan (4 daftar) | "anak ... ikut bersama Penggugat sebagai ibunya"; "Tergugat tidak menafkahi ... satu tahun"; "Tergugat belum memiliki pekerjaan"; "Penggugat bekerja di salon"; "yang pergi dari rumah adalah Penggugat"; "pergi ... karena terjadi cekcok terus" | "anak ... bernama `#5110#` ... ikut bersama `#2004#`"; "... kurang lebih selama `#9944#`"; "Tergugat bekerja sebagai `#0100# #5171#`"; "Penggugat bekerja sebagai `#0104# #5271#`"; "yang pergi ... adalah `#7035#`"; "`#7035#` pergi ... karena `#5127#`" | 3-4 per butir |
| butir fakta khusus-contoh | "Tergugat tidak pernah datang menjemput Penggugat (serta tidak pernah berkomunikasi kembali)" | dibuang (4 paragraf) | 4 |
| kebutuhan anak (4 tempat) | susu Rp200.000/Rp400.000, makan Rp20.000, 600.000, 800.000 | "sejumlah Rp_ (_ rupiah) setiap bulan" (isian kosong, bentuk yang sudah dipakai berkas ini) | 5 |
| bukti uang resepsi | PR.3/TR.3 "mengirim uang total sejumlah Rp56.000.000,00 ... resepsi" | butir dibuang | 2 |
| kemampuan suami (PNS) | "seorang guru pegawai negeri sipil ... (IV/a) ... 35 tahun ... Rp5.000.000,00 ... (UNTUK PNS)" | "seorang pegawai negeri sipil ... golongan ruang _ ... masa kerja kurang lebih _ tahun ... Rp_ (_ rupiah)"; catatan "(UNTUK PNS)" dibuang | 2 paragraf |
| mahar dan nilai mut'ah | "emas 10 gram dan seperangkat alat sholat ... emas 5 gram ... Rp5.000.000,00" | "berupa `#1001#` ... yakni _ ... senilai Rp_ (_ rupiah)" | 1 |
| lama pernikahan | "5 (lima) tahun lamanya" | "_ (_) tahun lamanya" | 1 |
| nafkah iddah per bulan/hari | "angka Rp_ (_ rupiah) setiap bulan atau Rp_ (_ rupiah) setiap harinya" | "angka `#9268#` setiap bulan atau `#9269#` setiap harinya" (dari isian `#6054#`) | 1 |
| jawaban Tergugat Rekonvensi | 5 butir contoh ("menolak mut'ah karena sikap dan perilaku Penggugat ...", "nafkah lampau ... tetap memberi nafkah", "hak asuh mohon dibagi ... tidak mempunyai pekerjaan tetap", "referte") | "... jawaban rekonvensi yang pada pokoknya `#11405#`" (isian rekonvensi yang sudah ada); 5 butir dibuang | 1+5 |
| dalil "istri yang durhaka" | contoh jawaban Tergugat | "sebagaimana dalam jawabannya"; "durhaka" -> "nusyuz" (2 tempat) | 3 |
| catatan kerja | "(APABILA SAKSI SAMA DENGAN SAKSI KONVENSI)" | dibuang (2 paragraf) | 2 |

## PERHATIAN: pasangan variabel pekerjaan di draf lama terbalik (sudah dibetulkan)
Daftar fakta persidangan lama menulis "Tergugat saat ini bekerja sebagai `#0104# _ #5271#`" dan "Penggugat ... `#0100# _ #5171#`". Padahal pada cerai talak
Tergugat Rekonvensi = Pemohon konvensi = `#0046#`, dan katalog menamai `#0100#` "Pekerjaan #0046#", `#5171#` "Penghasilan #0046#", `#0104#` "Pekerjaan #0047#", `#5271#` "Penghasilan #0047#".
Paket ini memakai pasangan yang benar (Tergugat -> `#0100# #5171#`, Penggugat -> `#0104# #5271#`) di semua tempat, dan membuang tanda `_` nyasar di antaranya. Mohon Derry memeriksa sekilas saat uji cetak pertama.

## Yang SENGAJA tidak diubah
- **"Penggugat/Tergugat (Rekonvensi)"** (134 paragraf): istilah baku rekonvensi yang didefinisikan berkas ini sendiri ("Pertimbangan Kedudukan Para Pihak": pihak yang semula Termohon menjadi Penggugat Rekonvensi, yang semula Pemohon menjadi Tergugat Rekonvensi); bagian konvensi sudah 100% memakai `#0046#`/`#0047#`. Tidak ada nama, NIK, alamat, atau tempat nyata di berkas (diperiksa).
- Teks merah lain dan catatan kerja berformat "(PERTIMBANGAN APABILA ...)" - sama dengan keluarga blangko [02] lain (daftar di A5).
- Isian kosong yang sudah ada sebelumnya ("nafkah lampau selama _ (_) bulan", "Rp_, (_ rupiah)" nafkah anak): bentuk isian berkas ini.
- Kutipan dalil/kitab/yurisprudensi/peraturan (termasuk rujukan Prof. Dr. H. Abdul Manan sebagai penulis rujukan).

## PRASYARAT
- SQL (baca saja): jumlah variabel yang dirujuk berkas baru dan ada di `abt_variabel` = **147** (`nomor-dirujuk.txt`; termasuk 9268/9269 dari paket kerangka dan 11405). Paket kerangka belum terpasang -> 145 -> BERHENTI.
- Berkas: md5 persis keadaan sesudah `keputusan-a-mekanis-4nov` (berkas tidak disentuh paket kerangka). Beda -> BERHENTI tanpa mengubah apa pun.

## Pasang (Git Bash, server hidup; SESUDAH `keputusan-a-kerangka-4nov` `SELESAI`)
```bash
cd /d/.../abt-paket/keputusan-a-rekonvensi-4nov && rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-keputusan-a-rekonvensi-20261104'
scp -r paket-satker/* aleta:/root/abt-keputusan-a-rekonvensi-20261104/
ssh aleta 'cd /root/abt-keputusan-a-rekonvensi-20261104 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-keputusan-a-rekonvensi-20261104/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (147)`, `SIAP=1`, `BERKAS SIAP`, `TAMBAL=1`, `BERKAS COCOK`, `SELESAI`. Pasang ulang: `SUDAH=1`. Pulih: `bash /root/abt-keputusan-a-rekonvensi-20261104/pulih-satker.sh` -> `PULIH=1`, `PULIH COCOK`
(berkas yang disunting sesudah dipasang dibiarkan dan dilaporkan). Tidak perlu memulai ulang apa pun.

## Uji (laptop)
- `hasil/uji-lokal.txt` (`U=<salinan> SEBELUM_MEKANIS=<pohon dasar> bash sumber/uji_lokal.sh <pohon sesudah kerangka>`; basis `aps_badilag_w206`): pasang, pasang ulang (sidik tetap), pulih (sidik = awal), pasang lagi, berkas disunting -> berhenti, mekanis belum terpasang -> berhenti, kerangka belum terpasang (145) -> berhenti, disunting lalu pulih -> dibiarkan.
- Render Word rekaan (nama rekaan; majelis 67 -> 66 halaman, tunggal 66 -> 65): `D:/Aplikasi/aleta/tmp/w206/bukti-r1/` (`hasil/render-banding.txt`); teks "yang pada pokoknya ..." tampil benar, butir contoh hilang, penomoran daftar otomatis menyesuaikan.
- Penjaga repo: `manajemen_surat/src/test/keputusan-a-rekonvensi-4nov.test.ts`.
