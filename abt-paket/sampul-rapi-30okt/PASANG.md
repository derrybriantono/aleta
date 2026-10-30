# Paket ABT `abt-sampul-rapi-30okt` - sampul, lampiran, daftar isi, ceklist berkas perkara rapi saat dicetak (30 Okt 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang - dipasang sesi utama.**

Hanya blangko RTF dan variabel pengguna **derry_briantono**. Tanpa kata nama aplikasi di blangko, variabel, fungsi, maupun komentar fungsi.

## Permintaan dan sebab (Derry, 30 Okt)

> "perbaiki juga sampul, lampiran dan daftar isi, contoh lampiran tidak ada isinya ... sampul dan daftar isi printnya tidak sampai penuh halaman ...
> buat agar semua ketika dicetak rapi (tabel, font, format) ... tambahkan logo monokrom ... (pengadilan agama Donggala)"; tambahan: "logo asli berwarna,
> buatkan monokrom yang jelas, jangan kabur".

Sebab yang ditemukan (render ABT asli + Word):
1. **Lampiran dan tabel kosong bila dicetak langsung dari ABT** (atau lewat Pilih blangko biasa): tabel daftar isi dan ceklist serta seluruh lampiran
   sampul hanya disusun portal saat dicetak lewat layar khusus panel. Dari ABT, daftar isi hanya berisi kalimat "Tabel dokumen disusun otomatis saat
   dicetak dari panel Blangko" (setengah halaman ke bawah kosong), dan sampul menyebut "lengkap di Lampiran" padahal tidak ada lampiran.
2. **Tidak penuh halaman**: huruf label 5,5-7,5 pt, sampul berhenti 17% di atas tepi bawah; daftar isi dari ABT hanya terisi kop dan identitas.
3. **Riwayat sidang pecah dua lembar** pada data nyata: agenda SIPP memuat baris baru berderet (perkara 459/Pdt.G/2026: 12 baris kosong) sehingga satu
   baris riwayat setinggi seperempat halaman.
4. **Logo** hanya penanda tak terlihat (portal yang menyisipkan, skala abu-abu dari logo bawaan portal) - cetak dari ABT tanpa logo; skala abu-abu
   logo hijau-emas pudar di printer.

## Isi paket

| Jenis | Isi |
|---|---|
| RTF (21, ditimpa) | `99 PTSP`: Sampul Berkas Perkara (+ Permohonan, Pihak Banyak, Permohonan Pihak Banyak, Lengkap), Ceklist Berkas Perkara; `98b Berkas Perkara - BAS`: Daftar Isi Berkas - masing-masing A4/F4/Legal. Ditimpa HANYA bila md5 server persis dasar (`daftar-timpa.tsv`). |
| Variabel baru (20) | 11600-11602 tabel daftar isi (A4/F4/Legal), 11603-11605 tabel ceklist, 11606-11617 lampiran sampul (4 varian x 3 kertas), 11618/11619 ciri ghaib/mafqud tampil (isian 5807/5808; kosong tanpa titik-titik) |
| Variabel diubah (106) | 5700-5779 riwayat sidang sampul (tanggal, sandi hadir, agenda, hasil/alasan): agenda dan alasan satu baris spasi tunggal (`isian_rtf_teks_sel`), baris yang belum ada tercetak kosong (bukan "..."); 5870-5889 kotak hadir: pemisah satu spasi (tiga spasi menjadi tab di ABT); 5832 anak, 5847 intervensi, 5868 kumulasi, 5897 turut tergugat: tanpa data tercetak kosong; 5830/5831 pihak I/II: "Pekerjaan: X - Alamat: Y" tanpa "- -" bila pekerjaan kosong, alamat Pemohon II (permohonan) bila berbeda, dan baris "Kuasa: NAMA" hanya bila ada kuasa (dipakai semua varian sampul; baris "Kuasa:" kosong hilang). Diubah HANYA bila md5 isi lama persis dasar. |
| Fungsi baru (5) | `isian_rtf_teks_sel`, `isian_rtf_baris_tabel`, `isian_rtf_tabel_daftar_isi` (memakai `isian_rtf_daftar_isi` yang sudah ada), `isian_rtf_tabel_ceklist`, `isian_rtf_lampiran_sampul` |

Tata letak (alat/bangun_rtf.py, alat/rtf_dasar.py): margin 1,27 cm kiri-kanan, 1,2 cm atas, 1,06 cm bawah, ditulis di dokumen DAN seksi (Word,
WPS, LibreOffice membaca sama); satu huruf Arial (sama dengan blangko Derry lain), label >= 7 pt, isi 8,5-11 pt; tabel bergaris tipis seragam, kepala
tabel berulang di halaman lanjutan, baris tidak dipecah antar halaman; kop: **logo monokrom satker di kiri**, nama satker (#8010#), kotak BUNDEL A /
MEJA I di kanan. Tabel daftar isi dan ceklist diberi baris kosong sampai halaman penuh (dokumen tambahan ditulis tangan).

**Logo**: `sumber/logo-kop-mono.png` dibuat `alat/logo_mono.ts` dari logo kop satker yang tersimpan di blangkonya sendiri (`99 PTSP/@ 0 - PMH - PHS.rtf`,
logo berwarna 3375 px), cara cap (unsur emas/merah/gelap hitam, bidang hijau putih), satu bit, 640 px (lebih dari 800 dpi pada 1,9 cm). Satker lain:
jalankan alat itu atas logonya lalu bangun ulang paket. Lewat panel, portal mengganti logo tertanam dengan logo **Identitas satker** (bila diunggah)
dengan cara yang sama (`manajemen_surat/src/lib/logo-monokrom.ts`).

**Lewat panel** (layar khusus): portal menimpa 11600-11619 dengan penanda lalu menempelkan tabel/lampiran susunannya (halaman otomatis, OTO e-Court,
lampiran alasan terdeteksi) dengan huruf dan lebar kolom yang SAMA dengan versi ABT.

## Dasar (md5) - WAJIB dibaca sebelum pasang

Server mati; dasar = **pohon server perkiraan** `D:/Aplikasi/aleta/tmp/bas29/dasar2/derry_briantono` (salinan server w82 + alamat-ganda, sampul-daftar-isi
+ peningkatan 27 Okt, pihak-urut, court-calendar, ikrar-92; 21 berkas berkas-perkara = isi paket sampul-daftar-isi-26okt persis) dan basis
`aps_badilag_2810` (dump server 28 Okt 15.44, sudah memuat paket sampul + romawi-pihak). Bila PRASYARAT/CEK BERKAS tidak cocok, TIDAK ada yang
diubah: bangun ulang dari keadaan server terbaru (`python -I alat/bangun_rtf.py`, lalu `python -I sumber/bangun_paket.py <basis> <pohon derry_briantono>`).

## Urutan pasang

Paket ini tidak bersinggungan dengan paket lain yang menunggu (berkas, nomor variabel, fungsi berbeda): `prodeo-panggilan-29okt` (11120-11199, amar/biaya),
`bas-tanya-jawab-29okt` + `ket-saksi-kata-30okt` (BAS/putusan, fungsi keterangan saksi), `relaas-penetapan-30okt` (11200-11219, 98 Relaas dan
penetapan di 99 PTSP - bukan sampul/ceklist), `bukti-nomor-30okt` (11170-11177). Urutan yang disarankan:

1. prodeo-panggilan-29okt  2. bas-tanya-jawab-29okt  3. ket-saksi-kata-30okt  4. relaas-penetapan-30okt  5. **sampul-rapi-30okt (paket ini)**

## Pasang (Git Bash, server hidup)

```bash
cd /d/.../abt-paket/sampul-rapi-30okt          # folder repo hasil gabung
rm -rf paket-satker/cadangan                     # cadangan uji laptop JANGAN ikut tersalin
ssh aleta 'mkdir -p /root/abt-sampul-rapi-20261030'
scp -r paket-satker/* aleta:/root/abt-sampul-rapi-20261030/
ssh aleta 'cd /root/abt-sampul-rapi-20261030 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-sampul-rapi-20261030/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (<HARAP di harap.txt>)`, `BERKAS SIAP`, `CADANGAN: ...`, `SEMUA COCOK`, `uji kueri perkara ...: 126 variabel jalan, 0 galat`
(beberapa perkara), `BERKAS COCOK`, `SELESAI`. Pasang ulang aman (PRASYARAT = `ULANG`).
Pulih: `ssh aleta 'bash /root/abt-sampul-rapi-20261030/pulih-satker.sh'` (akhir `PULIH COCOK`; blangko/variabel yang disunting sesudah dipasang dibiarkan
dan dilaporkan). Portal: rilis yang memuat commit paket ini (susunan panel memakai nomor 11600-11619 dan logo monokrom tajam); urutan portal-paket
bebas (portal tetap melayani blangko lama #5850#).

## Hasil uji (laptop, 30 Okt 2026)

- Lab `aps_badilag_sr30` (= aps_badilag_2810) + `sipp_sr30` (= sipp_2810) + pohon tiruan `99 PTSP`/`98b` (= dasar2), skrip `pasang-satker.sh`/`pulih-satker.sh`
  mode laptop: PRASYARAT `HARAP` -> `SEMUA COCOK`, uji kueri 126 variabel x 6 perkara 0 galat, `COCOK=21`, `SELESAI`; pasang ulang
  `ULANG` (harap.txt) -> `SELESAI`; pulih -> `PULIH COCOK`, abt_variabel sama persis dasar (md5 seluruh baris), 21 blangko sama persis dasar, fungsi
  isian_rtf_* kembali 48.
- Render php56 ABT ASLI (cetak langsung dari ABT) lalu Microsoft Word -> PDF -> PNG: 24 naskah (cerai gugat e-Court 459/Pdt.G/2026, cerai talak
  274/Pdt.G/2026 dan 12/Pdt.G/2019 (20 sidang), itsbat 166/Pdt.P/2026, dispensasi 85/Pdt.P/2026 (4 pemohon), kewarisan 656/Pdt.G/2026 (28 pihak),
  penetapan ahli waris 81/Pdt.P/2026 (32 pihak), cerai gugat dengan 6 anak; A4, F4, Legal). Semua sampul SATU lembar; halaman berikutnya hanya
  lampiran yang perlu (pihak, anak, riwayat lanjutan); daftar isi/ceklist penuh sampai bawah (daftar isi berlanjut halaman 2 bila dokumen banyak).
- Simulasi lewat panel (layanan bot + layar ekstensi + susunan portal sungguhan atas salinan basis): 10 naskah, sampul tetap satu lembar dengan
  lampiran alasan/pihak/anak/riwayat dari portal, logo Identitas satker menggantikan logo tertanam.
- PNG bukti: `D:/Aplikasi/aleta/tmp/sampul-rapi/hasil/` (`cetak-langsung-abt/`, `lewat-panel/`, banding logo monokrom) - memuat data perkara, TIDAK
  masuk repo.
