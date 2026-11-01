# Audit identitas pihak di blangko Derry (tahap 1, 1-2 Nov 2026, agen V)

Pohon diperiksa: `derry_briantono` sesudah 29 paket (selisih ke-30 hanya 14 berkas dasar hukum yang tidak memuat identitas; sidik pohon sesudah 30 paket = rantai agen Q `9931cdd9...`).
Alat: `alat/audit_identitas.py` (paragraf berpenanda identitas atau "NIK #0335#"/"tempat dan tanggal lahir"), 1.880 berkas aktif tanpa folder `terhapus`, 2.041 paragraf di 1.067 berkas.

## Acuan (keputusan 102)
`1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap).rtf` (varian 3/4/5 saksi sama bentuknya). Statistik cetak blangko tidak tercatat di ABT/SIPP, jadi "paling sering dipakai"
dipilih dari nama: blangko dasar kabul verstek cerai gugat, format lengkap. Bentuk acuan:
- paragraf identitas hanya berisi penanda `#7047#` (Penggugat/Pemohon) / `#7048#` (Tergugat/Termohon, boleh disusul `#8710##7054#` = Turut Tergugat/intervensi), `\qj \fi-1843 \li2552 \lin2552`, jarak `\sl360` (1,5 baris);
  = baris pertama menjorok 709 twips (1,25 cm), baris lanjutan menjorok gantung 2552 twips (4,5 cm) - sama dengan contoh pengguna (penetapan 473/Pdt.G/2026);
- "melawan" di tengah (`\qc`): 587 dari 587 berkas yang memuat kedua penanda memakainya, tidak perlu diubah;
- nama dan sebutan tebal berasal dari bunyi variabel (`<strong>`); banyak pihak: `<br>` menjadi `\par` sehingga TIAP pihak mulai di baris pertama (menjorok 1,25 cm).

## Bentuk paragraf di blangko
| golongan | paragraf | berkas | status |
|---|---|---|---|
| putusan/penetapan, `#7047#`/`#7048#`, menjorok acuan (-1843/2552) | 777 + 6 intervensi | ±550 | sesuai (tak diubah) |
| putusan/penetapan, `#7047#`, menjorok -1952/2552 (permohonan: itsbat, wali adhal, perwalian, izin kawin, dll.) | 121 | 121 | tidak sesuai -> disamakan |
| putusan DK, `#7047#`/tertulis tangan -1325/1985 (identitas Pemohon I dan II tertulis tangan, ada tulisan "(umur)" tersisa) | 20 manual + 1 | 11 | tidak sesuai -> `#7047#` |
| BAS memakai `#7047#`/`#7048#` menjorok -1608/2268 | 380 | 295 | tidak sesuai -> disamakan |
| BAS memakai `#7047#`/`#7048#` menjorok -1892/2552 | 484 | 242 | tidak sesuai -> disamakan |
| BAS ALUR tertulis tangan -2268/2268 (nama tebal, "tempat dan tanggal lahir (umur) ...", baris pertama tanpa inden) | 122 (+24 DK) | 61 | tidak sesuai -> `#7047#`/`#7048#` |
| akta perdamaian ("I.<tab>#7047#", bernomor) | 24 | 12 | bentuk lain (akta) - tidak diubah |
| identitas dalam sel tabel (BAS ikrar talak, BAS LAINNYA), relaas/PTSP, identitas ringkas | ±40 | ±25 | di luar acuan - tidak diubah |
| `#7047# Konvensi/Tergugat Rekonvensi;` | 2 | 1 | label rekonvensi menempel - tidak diubah |

## Bunyi variabel (7047/7048 dan fungsi di belakangnya) - sebelum paket
- 5 cabang CASE per jumlah pihak, ~45 penanda `#nnnn#` per variabel (ABT memecah SETIAP kemunculan penanda: tiap kemunculan = satu pembacaan data), tiga bunyi berbeda:
  umur hanya di cabang "Tergugat dengan kuasa" dan di situ tulisan "(umur)" ikut tercetak ("tempat dan tanggal lahir (umur) Donggala, 16 Maret 1975 (51 tahun)"); urutan pekerjaan-pendidikan terbalik antara cabang dengan dan tanpa kuasa;
  ";" tercetak DI DALAM huruf tebal sebutan Tergugat tanpa kuasa; sisi Tergugat tidak punya cabang untuk 3 pihak atau lebih (perkara 10089: Tergugat III hilang dari identitas); pihak ke-5 dst. lewat fungsi lain.
- Fungsi `isian_rtf_pihak_identitas` (hanya untuk urutan tidak rapat): tanpa umur, pekerjaan-pendidikan terbalik, kalimat kuasa+sebutan dipotong di 400 huruf (`v_akhir VARCHAR(400)`: kalimat kuasa panjang berhenti di tengah kata dan "sebagai Penggugat;" hilang).
- `isian_rtf_pihak_tambahan` (Turut Tergugat `#8710#`, intervensi `#7054#`): tanpa umur dan pendidikan.
