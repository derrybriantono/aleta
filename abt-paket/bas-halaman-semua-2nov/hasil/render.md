# Render sungguhan paket `abt-bas-halaman-semua-2nov` (2 Nov 2026) - nomor halaman semua BAS

Alat: `alat/periksa_pdf.py` (pdftotext: tiap halaman PDF harus berakhir dengan nomor di kaki), Word (COM) untuk RTF -> PDF, `alat/pdf_ke_png.ps1` untuk gambar. Catatan: `alat/rtf_ke_pdf_daftar.ps1` dijalankan
dengan menempelkan isinya langsung di PowerShell (dijalankan sebagai berkas `.ps1` lewat alat, Word kadang tidak menjawab di dokumen pertama). PNG memuat nama pihak SUNGGUHAN - tidak masuk repo.

## 1. Seluruh blangko yang diubah, Word -> PDF (tanpa data; `#kode#` tetap tertulis tapi kaki dan nomor nyata)
- SESUDAH paket (pohon sesudah 33): 180 berkas diubah + 15 pembanding acak (sudah bernomor): **195 dari 195 berkas, SEMUA halaman bernomor** (`hasil/halaman-sesudah-word.tsv`).
- SEBELUM paket (pohon sesudah 31), contoh tiap ke-4 berkas dari 180: **45 dari 45 berkas punya halaman TANPA nomor** (`hasil/halaman-sebelum-word.tsv`), mis. BAS Mediasi: nomor terbaca `- - 13 1 2 15` (dua halaman pertama kosong),
  folder BAS lama `[02] BAS ...`: `- - - - - -` (tidak ada nomor sama sekali).

## 2. Data nyata lewat renderer ABT (php56) - perkara 350/Pdt.G/2026 (perkara_id 9853, 9 sidang), BAS ALUR 04 satu per tahap (lima BAS)
Sebelum = pohon sesudah 31, sesudah = pohon sesudah 33; nomor sebagaimana dicetak blangko (`hasil/render-blangko-word.tsv`):

| BAS (sidang) | halaman | nomor SEBELUM | nomor SESUDAH |
|---|---|---|---|
| ALUR 04 [1] Mediasi (sidang pertama, 1) | 7 | `- - - 13 1 2 15` | `1 2 3 13 1 2 15` |
| folder lama ALUR 04 [2] Laporan Mediasi (lanjutan, 2) | 5 | `- - - - -` | `11 12 13 14 19` |
| ALUR 04 [4] Replik (lanjutan, 4) | 2 | `- 1` | `20 1` |
| ALUR 04 [6] Pembuktian P (6; sudah bernomor, pembanding) | 13 | `1 2 15 16 ... 25` | sama persis |
| ALUR 04 [9] Penyampaian Putusan (putus, 9; pembanding) | 2 | `1 2` | sama persis |

(Angka acak seperti 13/20/11 = nomor tetap `\pgnstarts` bawaan blangko per bagian; portal menggantinya dengan nomor runut.)

## 3. Jalur portal (`pasangNomorAwal`, nomor awal runut sidang 1, 2, 4, 6, 9 = halaman akhir BAS sebelumnya + 1; `hasil/render-runut-portal.tsv`)
| BAS | nomor SEBELUM paket | nomor SESUDAH paket |
|---|---|---|
| [1] 7 hal, mulai 1 | `- - - 4 5 6 7` | `1 2 3 4 5 6 7` |
| lama [2] 5 hal, mulai 8 | `- - - - -` | `8 9 10 11 12` |
| [4] 2 hal, mulai 13 | `- 14` | `13 14` |
| [6] 13 hal, mulai 15 | `15 ... 27` | `15 ... 27` |
| [9] 2 hal, mulai 28 | `28 29` | `28 29` |

Sesudah paket nomor BAS runut tanpa lubang dari BAS sidang pertama sampai BAS putus (1-7, 8-12, 13-14, 15-27, 28-29). Lompatan sesudah bukti/lampiran tidak diuji di sini (tanpa bentuk "SC Z" pada perkara ini);
itu sudah diuji paket ke-27 (`bas-halaman-runut-1nov.test.ts` C dan H) dan tidak berubah.
