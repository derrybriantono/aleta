# Paket ABT `abt-x8-sisa-tuntutan-21okt` - sisa paket x4 (21 Okt 2026 malam)

**Status: teruji di ABT LAPTOP (siklus pasang - periksa - pasang ulang - pulih - pasang lagi; sidik jari variabel DAN pohon RTF kembali sama
dengan server) dan di renderer php56 ABT asli; PRASYARAT dan 3 kueri baru dijalankan BACA SAJA di server: 0 galat. Server: BELUM dipasang.**
Hanya blangko dan variabel Derry; tanpa kata nama aplikasi di ABT (`modifier` = `admin`); teks ASCII; tidak ada baris lama yang diubah.

## Isi

| butir | isi |
|---|---|
| BARU `3450` | keadaan + kutipan petitum untuk pemicu tuntutan LAIN (hak bekas istri 3401-3408, anak 3430-3435, utang 3440, kelalaian 3441-3448, kebendaan 4788-4791 dan 4845-4847): satu baris per pemicu `NNNN|ya|<kutipan>` / `NNNN|tidak|` / `NNNN|ragu|petitum di SIPP kosong`, bentuk sama dengan `#3400#` (x3). **Bendera = nilai pemicu itu sendiri** (`#3401#` dst. di dalam kueri diganti ABT/bot dengan nilainya sebelum kueri jalan) - tidak ada pola kedua. Tidak dicetak blangko mana pun; dibaca panel "Tuntutan dalam posita dan petitum". |
| BARU `3451` | pertimbangan harta bersama dalam gugatan rekonvensi cerai talak (penyusun paket u2 `pert_harta` + pola x3 + penjaga daftar bawaan x4; sebutan "Penggugat Rekonvensi"/"Tergugat Rekonvensi", dasar Pasal 66 ayat (5) UU 7/1989 yang sudah dikutip blangko itu). Tidak dituntut dan tidak dipilih = kosong; dituntut belum dipilih = `[PERIKSA ...]`. |
| BARU `3452` | amar harta bersama dalam gugatan rekonvensi (u2 `amar_harta`), diawali `<br>` = butir bernomor berikutnya. |
| RTF (1 berkas) | `1a Perceraian CT/[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).rtf`: (1) paragraf baru berformat pertimbangan (rata, menjorok 720, spasi 1,5) yang hanya berisi `#3451#`, tepat sebelum judul "Dalam Konvensi Dan Rekonvensi" - kosong = tidak ada paragraf (perintah format langsung disusul `\pard` judul); (2) `#3452#` disambung di ujung butir amar rekonvensi terakhir (nafkah anak, daftar bernomor otomatis Word). Isi tetap contoh (jawaban, mut'ah, iddah, madliyah, hak asuh, nafkah anak) tidak disentuh. |

Nomor 3450-3452 bebas di server (21 Okt malam; 3400-3448 dipakai x3/x4, 3500-3599 jatah agen lain) dan tidak dipakai x1-x7.

## Baris kepala penanda gelombang 3 - TIDAK diubah (sudah tidak tercetak)

Diperiksa atas seluruh 1.759 RTF server (`alat/cek_kepala.py`, pembaca keadaan RTF): 504 baris kepala penanda (daftar penanda berspasi), 0 yang tampil:
251 di tujuan `{\*\isianasal ...}` (diabaikan semua pembaca RTF), 67 teks tersembunyi `\v` (termasuk 1f Hak Bekas Istri, 1e), 186 kotak penanda di
header halaman (huruf 1 pt putih, dibuang `bersihkanHeaderPenanda` saat cetak lewat ALETA). Laporan x4 yang menyebut "baris kepala ikut tercetak"
keliru: pengurai teks uji x4 membaca `\v`/`\*` sebagai teks biasa. Nilai isian tetap masuk ke kepala itu (dalam keadaan tersembunyi) - itulah
yang membuat urutan tabel ABT sama dengan urutan panel.

## PRASYARAT yang diharapkan (server, baca saja)

`0|0|0|0|35|0` (3 nomor baru kosong; 0 baris diubah; 35 variabel rujukan ada). Pasang ulang `0|3|0|0|35|0`. **SUDAH dijalankan baca saja di server 21 Okt malam: `0|0|0|0|35|0`.**
RTF: praperiksa `RINGKAS COCOK=1 SUDAH=0 LEWAT=0` (pasang ulang `COCOK=0 SUDAH=1`). Prasyarat paket: x4 terpasang (3401-3448 dirujuk 3450).

## Pasang (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/w38/abt-paket/x8-sisa-tuntutan-21okt
ssh aleta 'mkdir -p /root/abt-x8-20261021'
scp -r paket-satker/* aleta:/root/abt-x8-20261021/
ssh aleta 'cd /root/abt-x8-20261021 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-x8-20261021/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|0|0|35|0)`, `RTF RINGKAS COCOK=1 SUDAH=0 LEWAT=0`, `CADANGAN: ... (0 baris lama)`, `SEMUA COCOK`, baris `uji perkara`,
`RINGKAS DITAMBAL=1 SUDAH=0 LEWAT=0`, `RTF RINGKAS COCOK=0 SUDAH=1 LEWAT=0`, `SELESAI`. Pulih: `bash /root/abt-x8-20261021/pulih-satker.sh`
(`RTF RINGKAS PULIH=1`, akhir `PULIH COCOK`). Portal + ekstensi (kutipan 3450, peta rekonvensi) ikut rilis berikutnya; sebelum paket terpasang
panel tidak meminta 3450 dan tidak mengenal 3451/3452 (aman dalam urutan mana pun).

## Hasil uji (21 Okt 2026 malam)

- **Server, baca saja**: PRASYARAT `0|0|0|0|35|0`; 3 kueri baru atas 7326, 8706, 9089: 0 galat. `#3450#` dijalankan seperti ABT (rujukan diganti
  nilai pemicu perkara itu, `alat/uji_kutipan_server.py`) atas 9089, 8706, 5404: 30 baris, status "ya" = persis pemicu yang menyala (9089: 3401,
  3404, 3405, 3407, 3441, 3442; 8706: 3408, 4788, 4790, 3435, 3447, 3448; 5404 "posita": tidak ada), kutipan dari petitum.
- **ABT laptop** (`sumber/uji_lokal.sh`, `hasil/uji-lokal-siklus.txt`): PRASYARAT `0|0|0|0|35|0` -> `COCOK=1` -> `SEMUA COCOK` -> 11 perkara x 3 kueri
  -> `DITAMBAL=1` -> pasang ulang `0|3|0|0|35|0` -> PULIH: variabel 2480 dan pohon RTF kembali sama persis dengan server -> pasang lagi `SEMUA COCOK`.
- **Renderer php56** (`alat/render_x8.py`, `sumber/skenario_x8.py`, `hasil/render-ringkasan.json`), CT [02] Rekonvensi, 3/3 lolos (0 butir kosong,
  0 penanda tersisa, nomor amar sama dengan sebelum + butir tambahan melanjutkan):
  - gugatan rekonvensi tanpa harta bersama: teks sesudah **persis sama** dengan sebelum (paragraf sisipan kosong tidak meninggalkan baris);
  - harta bersama dituntut, belum dipilih: `[PERIKSA: petitum menuntut harta bersama ...]` di akhir pertimbangan rekonvensi, amar tidak berubah;
  - harta bersama dikabulkan: 3 paragraf pertimbangan (Pasal 66 ayat (5), Pasal 35 ayat (1) UUP, Pasal 97 KHI) tepat sebelum "Dalam Konvensi Dan
    Rekonvensi", dan butir amar rekonvensi **5.** "Menetapkan harta bersama Tergugat Rekonvensi dan Penggugat Rekonvensi berupa: ..." sesudah butir 4.
