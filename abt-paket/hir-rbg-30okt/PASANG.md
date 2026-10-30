# Paket ABT `abt-hir-rbg-30okt` - hukum acara satker RBg/HIR + variabel padanan pasal (G6 6.1, 30 Okt 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang - dipasang sesi utama. URUTAN PASANG: PALING AKHIR**
(sesudah SEMUA paket 29-30 Okt: prodeo -> bas-tanya-jawab -> bas-itsbat-varian -> bukti-nomor -> ket-saksi-kata -> ket-saksi-baris -> titik-koma
-> titik-koma-data -> alasan-belum-dipilih -> relaas-penetapan -> sampul-rapi -> sela-ps -> **paket ini** -> `../titik-koma-teks-30okt`).
Hanya pengguna **derry_briantono**. Tanpa kata nama aplikasi, tanpa migrasi Drizzle.

## Isi

| bagian | isi |
|---|---|
| `#11850#` (BARU) | `SATKER: HUKUM ACARA PERDATA`: bentuk isian satker (`CASE KodePN ...`), tanpa cabang satker = **OTOMATIS dari provinsi satker `#9276#`** (Jawa, DKI Jakarta, DI Yogyakarta, Banten, Madura = `HIR`; selain itu `RBg`). Super Admin menetapkan RBg/HIR di Pengaturan SIPP & ABT > Identitas satker > Hukum acara perdata (cabang `WHEN '<KodePN>' THEN 'HIR'`, tercatat, Kembalikan) |
| `#11851#` `#11852#` | singkatan `RBg`/`HIR`; wilayah `di luar Jawa dan Madura` / `di Jawa dan Madura` |
| `#11853#`-`#11892#` | nomor pasal padanan PASTI (mis. `#11859#` = 149 / 125 HIR) |
| `#11893#`-`#11895#` | nomor AYAT yang berbeda: 142 (5) = 118 (3); 192 (3) = 181 (2); 192 (4) = 181 (3) |
| 603 blangko RTF | rujukan `Pasal ... RBg` PASTI diganti, mis. `Pasal 149 ayat (1) RBg` -> `Pasal #11859# ayat (1) #11851#`; 3 kalimat (`... di luar Jawa dan Madura, hukum acara yang berlaku adalah RBg`, `RBg tidak mengatur secara tegas`, `tidak diatur dalam RBg,`). Disimpan sebagai POTONGAN ber-md5 (`daftar-tambal.tsv` + `tambal.tsv`, 1,4 MB), bukan salinan utuh |
| 40 kueri variabel lama | rujukan pasal di dalam kueri (sela-ps 11300-11309/11370/11371/11379, relaas 11218, kalimat bukti/saksi dll.) diganti padanan; nama "- belum dipakai" -> "- otomatis lewat #11850#" |

Yang belum pasti TETAP RBg dan dicatat (`hasil/rujukan-diganti.tsv`, `hasil/tabel-padanan.md`): 199 (banding; Jawa-Madura UU 20/1947),
288 (akta bawah tangan; tidak berpadanan), 718 (usulan 390 HIR), eksekusi 208-210 dan 216-218 (ayat HIR 197/200 tidak bernomor di naskah),
153 ayat (3)-(6), 144 ayat (1), 207 berayat; bentuk tidak baku (`R.Bg.`, `Rbg`, `pasal` huruf kecil, nama panjang "Reglemen Acara Hukum ...",
4 rujukan DK yang terpecah kode format RTF). Rv tidak diubah (berlaku sama).

**Identik untuk satker RBg (Donggala):** pembangun MEMBUKTIKAN untuk SEMUA perkara (bukan sampel): tiap RTF dengan variabel padanan diisi
nilai RBg = RTF lama persis (selain putus baris berkas yang tak bermakna di RTF), dan tiap kueri yang diubah dengan padanan RBg = kueri
lama persis (assert di `sumber/bangun_paket.py`; nilai variabel padanan tidak bergantung perkara). Render php56 ABT asli sebelum/sesudah:
lihat `hasil/uji-lokal.md`.

## Pasang (Git Bash, server hidup) - PALING AKHIR

```bash
cd /d/.../abt-paket/hir-rbg-30okt
ssh aleta 'mkdir -p /root/abt-hir-rbg-20261030'
scp -r paket-satker/* aleta:/root/abt-hir-rbg-20261030/
ssh aleta 'cd /root/abt-hir-rbg-20261030 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-hir-rbg-20261030/pasang-satker.sh'
```

Keluaran benar: `PRASYARAT COCOK (0|0|40|0|1)`, `SIAP=603`, `BERKAS SIAP`, `CADANGAN ...`, `SEMUA COCOK`,
`UJI: satker PA.Dgl provinsi 'Sulawesi Tengah' -> hukum acara RBg`, `TAMBAL=603`, `BERKAS COCOK`, `SELESAI`. Pasang ulang: `0|46|0|40|1`, `SUDAH=603`.
PRASYARAT `A|B|C|D|E` = nomor 11850-11899 berisi lain | variabel baru persis paket | variabel lama masih persis dasar | variabel lama sudah
isi baru | #9276# ada. **Berkas yang md5-nya bukan keadaan sesudah semua paket lain -> GAGAL tanpa mengubah apa pun.** Bila paket lain
dibangun ulang/berubah: bangun ulang paket ini (deterministik) dari pohon server sesudah semua paket:
`python sumber/bangun_paket.py <_blangko_abt> <basis ABT>` (menulis juga `../titik-koma-teks-30okt/paket-satker`).

Pulih: `ssh aleta 'bash /root/abt-hir-rbg-20261030/pulih-satker.sh'` -> `PULIH COCOK (0|0|40|0|1)`. Berkas dikembalikan dari
`cadangan/rtf-lama` HANYA bila masih isi paket; variabel baru dihapus / kueri lama dikembalikan HANYA bila masih persis isi paket.

## Temuan paket lain (untuk sesi utama, BELUM diperbaiki di sini)

1. `bas-tanya-jawab-29okt/paket-satker/abt-bas-tanya-jawab-29okt-PRASYARAT.sql` di repo LF (git `eol=lf`), MD5SUMS dibuat atas versi
   CRLF (w124) -> di server `md5sum -c` GAGAL "isi paket rusak" (berhenti aman). Perbaiki MD5SUMS (atau tandai berkas `-text`).
2. `bukti-nomor-30okt`: 14 `md5_lama` (ES, Kewarisan, BAS sidang 2 Wasiat/Hibah/Wakaf) = keluaran prodeo VERSI LAMA, bukan prodeo di repo
   (8c8d090a) -> `LEWAT=16` berhenti. Dan N152/N153 (`2 Itsbat Nikah - BAS [1b]/[1c]`) dipindah `bas-itsbat-varian-30okt`: urutan
   "bas-itsbat-varian -> bukti-nomor" pasti gagal. Simulasi laptop: bukti-nomor DIBANGUN ULANG (`sumber/bangun_bukti.py`) atas pohon
   sesudah paket lain -> 397 berkas COCOK. Sesi utama perlu membangun ulang bukti-nomor (dan sesudahnya paket ini).
3. Pasang laptop: bas-tanya-jawab, bas-itsbat-varian, bukti-nomor memakai `ABT_BLANGKO=.../_blangko_abt/derry_briantono`, paket lain `.../_blangko_abt`.
