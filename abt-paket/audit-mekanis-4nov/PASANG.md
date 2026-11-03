# Paket ABT `abt-audit-mekanis-4nov` - tambalan mekanis hasil audit A3 (4 Nov 2026, disetujui Derry)

**Status: dibangun dan diuji di LAPTOP. Server: BELUM dipasang.** Hanya blangko pengguna **derry_briantono** (720 berkas,
1.427 potongan). Tanpa variabel, menu, fungsi, tabel, atau data yang diubah; tanpa kata nama aplikasi. Hanya huruf teks yang berubah:
kode RTF di dalam setiap potongan sama persis (dijaga uji), dan teks tampak baru = teks lama dengan ubahan yang dimaksud PERSIS
(diperiksa `sumber/bangun_paket.py` per berkas; berhenti bila beda).

## Isi (jumlah = pindai teks tampak seluruh 1.881 blangko; sama dengan hitungan audit A3)
| kode | ubahan | kali | berkas |
|---|---|---|---|
| K01 | `#8554# Hakim` -> `#8554#` (8554 = "Majelis Hakim"/"Hakim"; dulu tercetak "Majelis Hakim Hakim"/"Hakim Hakim") - Itsbat [03] [03a] [03b] [03c] [99c] [99d] | 30 | 6 |
| K09 | `Penetapan Hakim #4004#` -> `Penetapan #4004#` (4004 = "Ketua Majelis"/"Hakim"; tercetak "Penetapan Ketua Majelis"/"Penetapan Hakim") - BAS sidang 1 | 131 | 131 |
| K13 | teks `isbat`/`Isbat` -> `itsbat`/`Itsbat` (nama folder/berkas TIDAK diubah) | 19 | 8 |
| K06 | salah ketik jelas (34 jenis: berkaitaan, dipertahankankan, sebaga, berdasarkan berdasarkan, "Republik Indonesia Republik/Repblik Indonesia", perempaun, satusa, perara, bahwa bahwa, Nomor Nomor, calon/sebagai istri istri, dll.) | 303 | 149 |
| K07 | ejaan baku: `diatas` -> `di atas` (819), `dipersidangan` -> `di persidangan` (78), `dibawah` -> `di bawah` (24), `Undang Undang` -> `Undang-Undang` (17) | 938 | 581 |
| S01 | identitas saksi ke-2 memakai variabel saksi ke-1: `#1241#` -> `#1242#` (hubungan; CG [01a] Qabla, CG/CT [01ab] Kurang 6 Bulan, ALUR 05 [3]/[3a]) dan `#1202#` -> `#1208#` (alamat; CG [01ab] Unus Testis) | 6 | 6 |

Rincian per potongan (berkas, sebelum -> sesudah, konteks): `D:/aleta-dev/kerja/audit-abt-4nov/C1/daftar-tambalan.csv`; ringkas: `hasil/ringkas.txt`.
Berkas kembar (A3: 151 kelompok) ikut semuanya karena aturan dijalankan atas seluruh pohon (termasuk 4 berkas di `terhapus/`).

Berbeda dari usulan A3 (sengaja):
- `citakan -> cetakan` TIDAK dipakai: kedua tempat berbunyi "cita-citakan" (benar).
- `calon istri istri` -> `calon suami istri` (bukan "calon istri"): sama dengan 8 varian DK sesaudara ("keterangan kedua orang tua calon suami istri, kedua calon suami istri").
- `Repblik` (4) hanya ada di "Peraturan Mahkamah Agung Republik Indonesia Repblik Indonesia Nomor 5 Tahun 2019" -> digabung ke aturan
  ganda: hasil "Republik Indonesia" (bila hanya Repblik yang diperbaiki, tersisa "Republik Indonesia Republik Indonesia").
- `isteri` (K07) TIDAK disentuh: banyak di kutipan peraturan (UU 1/1974, KHI) yang ejaan aslinya "isteri".
- S01 dicari dengan aturan: `#1241#`/`#1202#` di identitas yang nama saksi terdekat sebelumnya `#1203#` (saksi ke-2). Padanan benar di blangko lain: 242 (`saksi mengaku sebagai #1242#`), 10 (`karena saya adalah #1242#`), 580 (`bertempat tinggal di #1208#`). Katalog server 3 Nov: 1241/1242 = Hbgn. Saksi1/Saksi2 P dg. Pihak, 1202/1208 = Alamat Saksi 1/2 P.

## Dasar md5 (PRASYARAT)
Keadaan server = cadangan 2 Nov + `saksi-rapi-3nov` + `in-lupa-prosesi-3nov` + **`ijab-yang-menikahkan-3nov`** (pohon
`D:/aleta-dev/kerja/audit-abt-4nov/pohon`, md5 daftar `37886602f6f292d16defad980eb46bb2`). 5 berkas paket ini adalah berkas paket ijab
(`2 Itsbat Nikah/[01] [01a] [01b] [01d] [01e]`) - jadi **paket ijab WAJIB dipasang lebih dulu**; bila belum, `cek` -> `BERKAS TIDAK SIAP`
dan paket BERHENTI tanpa mengubah apa pun (diuji, butir 6). Satu saja dari 720 berkas berbeda -> BERHENTI.

## Pasang (Git Bash, server hidup; SESUDAH paket ijab-yang-menikahkan-3nov)
```bash
cd /d/.../abt-paket/audit-mekanis-4nov && rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-audit-mekanis-20261104'
scp -r paket-satker/* aleta:/root/abt-audit-mekanis-20261104/
ssh aleta 'cd /root/abt-audit-mekanis-20261104 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-audit-mekanis-20261104/pasang-satker.sh'
```
Keluaran benar: `SIAP=720`, `BERKAS SIAP`, `PRASYARAT COCOK`, `TAMBAL=720`, `BERKAS COCOK`, `SELESAI`. Pasang ulang: `SUDAH=720 ... SELESAI`
(tidak mengubah apa pun). Bila `GAGAL ... md5 ... bukan dasar ...`: blangko server berubah (atau paket ijab belum terpasang) - jangan
dipaksa; pasang paket ijab dulu, atau bangun ulang atas blangko server terbaru (`python -B sumber/bangun_paket.py <_blangko_abt> paket-satker hasil`,
lalu MD5SUMS dan uji). Pulih: `ssh aleta 'bash /root/abt-audit-mekanis-20261104/pulih-satker.sh'` -> `PULIH=720`, `BERKAS PULIH`,
`PULIH COCOK` (berkas yang disunting sesudah dipasang dibiarkan dan dilaporkan). Tidak perlu memulai ulang apa pun.

## Uji (laptop)
- `hasil/uji-lokal.txt` (`U=<salinan> IJAB_LAMA=<rtf-lama paket ijab> bash sumber/uji_lokal.sh <pohon keadaan server>`): pasang, pasang
  ulang (sidik tetap), pulih (sidik = awal), pasang lagi, md5 berbeda -> berhenti tanpa ubahan, paket ijab belum terpasang -> berhenti
  tanpa ubahan, disunting lalu pulih -> dibiarkan.
- `hasil/pindai-sesudah.txt`: pindai ulang pohon sesudah tambal - semua pola 0.
- Penjaga repo: `manajemen_surat/src/test/audit-mekanis-4nov.test.ts`.
- Render REKAAN (Word -> PDF, majelis + hakim tunggal, sebelum/sesudah) 18 blangko yang mencakup semua 43 jenis tambalan:
  `D:/aleta-dev/kerja/audit-abt-4nov/C1/bukti/` (`banding.txt` = beda kata PDF sebelum/sesudah tanpa kaki halaman, PNG halaman yang
  berubah di `bukti/rtf/`). Hasil: 36 pasang, jumlah halaman sama kecuali DK [01] Anak P Cowok 19 -> 18 (3x "Republik Indonesia" ganda
  hilang; isi akhir rincian biaya utuh). Beda kata hanya kata yang dimaksud; sisanya tata letak (nomor halaman BAS bergeser, urutan baca
  tabel biaya, potongan huruf Arab hasil pdftotext - potongan paket tidak memuat satu pun huruf Arab/kode `\u`/`\'`).
  Contoh hakim tunggal: "c/q Hakim Hakim" -> "c/q Hakim", "Bahwa, Hakim Hakim memulai" -> "Bahwa, Hakim memulai", "Penetapan Hakim Hakim
  Nomor" -> "Penetapan Hakim Nomor"; majelis: "Penetapan Hakim Ketua Majelis" -> "Penetapan Ketua Majelis".
