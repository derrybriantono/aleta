# Naskah A (keputusan Derry 182/184, 4 Nov 2026) - SELESAI di laptop, BELUM dipasang di server

Tiga paket ABT + daftar A5. Semuanya dibangun dan diuji di laptop (uji pasang/ulang/pulih/prasyarat, render Word rekaan, uji vitest sasaran, tsc).

## Urutan pasang di server (pulih terbalik)
`ijab-yang-menikahkan-3nov` -> `audit-mekanis-4nov` -> `audit-ejaan-4nov` -> **`keputusan-a-mekanis-4nov`** (151 berkas) -> **`keputusan-a-kerangka-4nov`** (12 berkas + 4 baru + variabel 9266-9269) -> **`keputusan-a-rekonvensi-4nov`** (1 berkas).
Rincian dan perintah pasang: `PASANG.md` di tiap folder paket. Portal/ekstensi: `susun.ts` + `abt-panel-blangko.js` (daftar `keteranganOtomatis`) memetakan 9266/9267; ekstensi BELUM dirilis (ikut rilis berikutnya, berkas tertanam belum disusun ulang).

## Klaim nomor variabel
9266 (keterangan saksi 3 T), 9267 (saksi 4 T), 9268 (nafkah iddah per bulan), 9269 (per hari). Diperiksa kosong di basis salinan server 3 Nov dan tidak diklaim di worktree/branch lain (4 Nov 08.00). Bila ada sesi lain yang sudah memakai nomor ini, ubah `V_*` di `keputusan-a-kerangka-4nov/sumber/bangun_kerangka.py` dan bangun ulang (juga paket rekonvensi: `#9268#/#9269#`).

## Dilewati / menunggu keputusan Derry
- **Penetapan `[98] Cabut`** ("dikabulkan `#8555#` maka perkara tersebut dinyatakan telah selesai"; 6 berkas): tidak diubah (instruksi koordinator).
- **E2** disebut 11 blangko; di pohon hanya **6** berkas memuat "Bahwa tujuan ... itsbat nikah adalah untuk mendapatkan Buku Nikah" (diubah semuanya).
- **A13 isian ganda Wasiat/Hibah/ES**: tidak ada blangko yang memuat dua variabel bukti surat sekaligus (Wasiat hanya 9488/9489, Hibah hanya 9804/9805; Wakaf 9835) - ganda hanya di panel (A2-09), bukan bagian naskah: dicatat dan dilewati.
- **A13 `isteri`**: 217 diubah di kalimat buatan blangko; 135 tetap (kutipan UU/KHI/PERMA/kitab/lafal ikrar). **`fijtelijkeground`** tetap (3, tanpa variasi lain).
- **A9**: varian saksi T 3-4 hanya untuk putusan kontradiktoir cerai CG dan CT `[02]` (4 blangko baru); ~100 putusan kontradiktoir lain (HB, kewarisan, hak asuh, ...) belum punya varian 3-4 saksi T.
- **A3/K03**: kalimat alternatif sesudah catatan dijadikan paragraf sendiri (bukan variabel pilihan): bila Derry ingin bentuk lain (mis. isian pilihan), ubah di `keputusan-a-mekanis-4nov`.
- **A2**: istilah "Penggugat/Tergugat (Rekonvensi)" dipertahankan (didefinisikan berkas itu); pasangan variabel pekerjaan di draf lama terbalik dan sudah dibetulkan (lihat `keputusan-a-rekonvensi-4nov/PASANG.md`).
- **A12 / A1 / A7**: bukan bagian naskah ini.

## Daftar A5 (teks merah, tidak diubah)
`D:/aleta-dev/kerja/audit-abt-4nov/A5/daftar-teks-merah.html` dan `.csv` (63 blangko, 911 potongan; usulan isian/hitamkan; kolom keputusan Derry kosong). Pembangkit: `abt-paket/keputusan-a-naskah-4nov/alat/daftar_merah.py`.

## Cara membangun ulang (bila blangko di server berubah)
Pohon dasar: pohon A3 (`D:/aleta-dev/kerja/audit-abt-4nov/pohon`) + paket audit-mekanis + audit-ejaan (`ABT_BLANGKO=<salinan> PY=python bash pasang-satker.sh`), lalu `python -B sumber/bangun_mekanis.py <akar> paket-satker hasil` (mekanis), pohon sesudahnya untuk `bangun_kerangka.py`, dan seterusnya untuk `bangun_rekonvensi.py`. Skrip Python HARUS ditulis dengan alat Write (heredoc Bash menyusutkan garis miring terbalik).
Basis ABT uji: `aps_badilag_w206` (salinan `aps_badilag_w189d`, MariaDB 10.4 XAMPP; dibuat dengan mysqldump + sed nama basis).
