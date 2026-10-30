# Paket ABT `abt-bukti-nomor-30okt` - daftar bukti surat di blangko Derry selalu bernomor 1., 2., ... (30 Okt 2026)

**Status: diuji di laptop (basis salinan `aps_badilag_bas29` = dump server 28 Okt 15.44; salinan 399 blangko). Server: BELUM dipasang - dipasang sesi utama. URUTAN: `prodeo-panggilan-29okt` (versi bangun-ulang) -> `bas-tanya-jawab-29okt` -> paket ini.**

Hanya pekerjaan Derry: 2 fungsi baru, 8 variabel `data_sql` BARU (`11170`-`11177`, `modifier=admin`), 399 blangko RTF `derry_briantono` (folder menu aktif). Isian bukti lama (`9955`, `9911`, `1214`, `9958`, `9956`, `8131`, `8132`, `0378`) dan bawaannya TIDAK diubah; data tersimpan tidak diubah. Tanpa kata nama aplikasi.

## Masalah (temuan simulasi 30 Okt)
Isian bukti surat (`data_teks`) dicetak ABT apa adanya, satu baris = satu paragraf, ke paragraf blangko yang penomorannya berbeda-beda (`hasil/isi-paket.json`, kolom bentuk):

| bentuk paragraf lama | jumlah paragraf | akibat |
|---|---|---|
| daftar bernomor Word (`\ls`) | 277 | isian yang nomornya DIKETIK (petugas/isi otomatis lama: "1.  Fotokopi ...") tercetak **"1. 1. Fotokopi ..."**, "2. 2. ..." (render 623/Pdt.G/2026, 367/Pdt.G/2026) |
| "1.<tab>#isian#" diketik di paragraf biasa | 166 | isian tanpa nomor: butir ke-2 dst. **tanpa nomor** (render 377/Pdt.G/2025: "Fotokopi Kutipan Akta Nikah" tanpa "2."); isian bernomor: "1. 1." pada butir pertama |
| paragraf biasa tanpa nomor | 34 | bernomor hanya bila petugas mengetiknya (render 150/Pdt.P/2026: tanpa nomor) |

Isian tersimpan di dump server: 1214 = 2.119 (1.345 bernomor ketik), 0378 = 453 (388), 9958 = 196 (13), 9955 = 59 (6), 8131 = 35 (33), 8132 = 32 (32), 9911 = 14 (4), 9956 = 10 (4).

## Perbaikan
- `isian_rtf_bukti(teks)`: tiap baris = satu butir "N.\tab ...", dipisah `<br>` (ABT: paragraf baru); nomor ketikan dibuang (`1.`, `1)`, `(1)`, `1 .`, `1.Fotokopi`, `1.1.`, nomor ganda "1.<tab>1.", `6 Fotokopi` dalam daftar bernomor); dalam daftar bernomor ketik, baris yang diawali huruf kecil/tanda baca penyambung = lanjutan butir sebelumnya; "1.5 juta", "12.000", "2 (dua)" bukan nomor; isian belum disimpan = "1.\tab ..." (seperti dulu "1. ..."). `isian_rtf_bukti_nomor` = pengenal nomor ketikan.
- Variabel baru (OTOMATIS) membaca isian TERSIMPAN (`abt_data_teks`) lalu `isian_rtf_bukti`: 11170<-9955, 11171<-9911, 11172<-1214, 11173<-9958, 11174<-9956, 11175<-8131, 11176<-8132, 11177<-0378 (`nomor-baru.txt`).
- Blangko: tiap paragraf yang isinya hanya "[n.] #isian bukti#" (477 paragraf, 399 berkas; baris daftar isian tersembunyi ber-fs2 tidak disentuh) diganti satu paragraf bergaya sama TANPA penomoran daftar dan tanpa "1.<tab>" ketikan, berisi `#1117x#` + `{\*\isianbukti #isian#}`. Tujuan RTF `\*` diabaikan Word/LibreOffice (tidak tercetak, tidak tersembunyi-tampil), tetapi penanda isian lama tetap ada di berkas sehingga penyunting ABT dan panel Blangko Derry (yang membaca penanda dari RTF mentah) tetap menawarkan isian bukti dan penyunting buktinya.

## Dasar (md5) dan penjaga
Dasar RTF = pohon server perkiraan (lihat `../bas-tanya-jawab-29okt/PASANG.md`) **sesudah** prodeo bangun-ulang **dan** bas-tanya-jawab (265 dari 399 berkas juga diubah salah satu paket itu: 257 prodeo, 92 bas-tanya-jawab). PRASYARAT RTF = `tambal-rtf.pl periksa`: semua 399 md5 persis; satu beda = BERHENTI sebelum basis data diubah. PRASYARAT SQL `A|B|C|D|E`: 8 isian sumber ada | nomor 11170-11177 terpakai | isinya persis paket | fungsi ada | jumlah variabel (info). Pasang `8|0|0|0|*`, pasang ulang `8|8|8|1|*` (dump server: `8|0|0|0|2677`). Bila RTF prodeo/bas-tanya-jawab berubah: `python sumber/bangun_bukti.py <pohon sesudah keduanya>/derry_briantono` lalu `python sumber/bangun_sql.py`, perbarui MD5SUMS.

## Pasang / pulih (Git Bash, server hidup)
```bash
cd /d/.../abt-paket/bukti-nomor-30okt
rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-bukti-nomor-20261030'
scp -r paket-satker/* aleta:/root/abt-bukti-nomor-20261030/
ssh aleta 'cd /root/abt-bukti-nomor-20261030 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-bukti-nomor-20261030/pasang-satker.sh'
ssh aleta 'bash /root/abt-bukti-nomor-20261030/pulih-satker.sh'      # bila perlu; akhir PULIH COCOK
```
Keluaran benar: `PRASYARAT COCOK (8|0|0|0|N)`, `PRAPERIKSA RTF: RINGKAS COCOK=399 SUDAH=0 LEWAT=0`, `PERIKSA: SEMUA COCOK`, `RINGKAS DITAMBAL=399 ...`, `PERIKSA RTF: RINGKAS COCOK=0 SUDAH=399 LEWAT=0`, `PRASYARAT SESUDAH: 8|8|8|1|N+8`, `SELESAI`.

## Hasil uji laptop
- `alat/verifikasi.py`: 399/399 berkas - teks yang hilang hanya paragraf "[n.] #isian#", yang bertambah hanya `#1117x#`; kurung seimbang; tanpa kata nama aplikasi; di SELURUH 1.681 blangko aktif tidak ada lagi isian bukti yang tercetak langsung (0).
- Siklus (`ABT_LOKAL=1 ABT_DB=aps_badilag_bas29`, salinan 399 berkas): pasang (`8|0|0|0|2677` -> `8|8|8|1|2685`, 399 ditambal) -> pasang ulang (tanpa tulis) -> pulih (`PULIH COCOK`, sidik pohon kembali `df014183e9fc`, variabel 0, fungsi dihapus) -> gagal (1 berkas disunting: `LEWAT=1`, berhenti SEBELUM basis data diubah, prasyarat tetap `8|0|0|0`) -> pasang lagi (sidik sama `48990281487e`).
- Banding seluruh isian tersimpan (`hasil/banding-data.tsv`): jumlah butir = jumlah baris kecuali 6 isian (baris lanjutan huruf kecil digabung / baris "3." kosong); nomor ganda tersisa 3 dari 2.918 isian = salah ketik data ("6..Fotokopi", "14.; Fotokopi").
- Render php56 ABT asli (`alat/render_bukti.py`, `hasil/render-ringkasan.json`): 623/Pdt.G/2026 `[01] Format Lengkap` (daftar Word, isian bernomor ketik): "1. 1." -> "1."/"2."; 367/Pdt.G/2026 dan 377/Pdt.G/2025 `[03a] Tolak kontradiktoir` ("1.<tab>" diketik): "1. 1." -> "1.", dan butir ke-2 tanpa nomor -> "2."; bukti Tergugat belum diisi tetap "1. ..."; 150/Pdt.P/2026 dan 233/Pdt.P/2025 AUA `[01a]` (paragraf biasa): tanpa nomor -> "1."; bernomor tetap "1., 2., 3."; 0 penanda tersisa di semua render.

## Catatan
- Isi otomatis lama yang menulis "1.  " ke isian tidak perlu diubah lagi (nomor ketikan kini dibuang saat cetak); penyunting bukti panel (1214/9911) sudah menulis tanpa nomor sejak 19 Okt.
- Nomor variabel 11170-11177 diklaim paket ini (prodeo memakai 11120-11166).
