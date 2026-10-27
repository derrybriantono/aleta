# Usulan variabel ABT baru untuk blangko Derry - perkara selain cerai (27 Okt 2026)

**Status: DAFTAR USULAN. Belum ada yang dipasang di ABT mana pun; belum ada paket `abt-paket/<nama>/`.**
Alasan paket belum disusun: tiap variabel di bawah baru berguna bila blangko (RTF) yang memuatnya diubah, dan perubahan blangko
memerlukan cadangan RTF terbaru dari server (tidak terjangkau dari laptop rumah) serta uji pasang di ABT server. Bila disetujui,
paketnya mengikuti pola `abt-paket/y5-pengumuman-kedua-26okt/` (PRASYARAT/FUNGSI/PASANG/PERIKSA/PULIH/MD5SUMS, hanya milik
`derry_briantono`, tanpa kata ALETA). Nomor `no_var` di bawah hanya contoh dari rentang kosong (9729, 9731-9739, 9773-9789,
9811-9819, 9842-9859, 9876-9880 per katalog `aps_badilag_pm57`); klaim nomor sebenarnya saat paket dibuat.

Dasar usulan: kalimat yang SERING ada di posita (diukur atas `sipp_donggala`, posita sejak 2022-06) dan ruas ABT-nya
belum ada, sehingga petugas mengetik ulang di kotak bukti/uraian. Tidak ada nama pihak di berkas ini.

| # | Usulan variabel (data_teks) | Jenis perkara / blangko pemakai | Bukti keseringan di posita | Sumber deteksi (kamus) | Catatan |
| ---: | --- | --- | --- | --- | --- |
| 1 | NOMOR DAN TANGGAL AKTA KEMATIAN PEWARIS - ISIAN | Penetapan ahli waris [01]-[01c], kewarisan, wasiat | 31 dari 53 posita PAW memuat "Kutipan Akta Kematian Nomor ..." | pola `fakta-nomor-akta-kematian` (sudah ada untuk perwalian; perlu disalin ke `waris`) | Hari ini disisipkan petugas ke daftar bukti (8132) |
| 2 | NOMOR DAN PENERBIT SURAT KETERANGAN KEMATIAN ORANG TUA PEWARIS | idem | 33 dari 53 posita PAW memuat "Surat Keterangan Kematian Nomor ..." (kepala desa) | pola baru per kalimat "orang tua ... meninggal lebih dahulu" | Dua orang tua = dua baris |
| 3 | NOMOR AKTA/SURAT KEMATIAN ORANG TUA ANAK - ISIAN | Perwalian [01]-[03] | 35 dari 49 posita perwalian (pola `perwalian-nomor-akta-kematian`, sudah aktif) | pola benih `perwalian-nomor-akta-kematian` | Padanan `1316`/`1342` hanya untuk pasangan Pemohon itsbat |
| 4 | HUBUNGAN ANAK DENGAN PEMOHON (anak kandung, keponakan, cucu) | Perwalian | 11 dari 49 (pola `perwalian-hubungan-anak`, sudah aktif) | pola benih `perwalian-hubungan-anak` | Dipakai kalimat "{anak} merupakan {hubungan} dari {Pemohon}" |
| 5 | NOMOR DAN TANGGAL SURAT KETERANGAN HAMIL | Dispensasi kawin [01]-[03] dan BAS DK | 9 dari 71 posita DK memuat "Surat Keterangan Hamil nomor ..." | pola baru DK (bukan di kamus saat ini) | `0997` hanya nama puskesmas, `0999` hanya usia kandungan |
| 6 | ALASAN MENDESAK PERKAWINAN SELAIN KEHAMILAN (satu frasa) | Dispensasi kawin ditolak ([03]) | `9771` sudah ada tetapi tak ada pola baca (2 pemakaian) | perlu pola posita | Cukup melengkapi pola, tanpa variabel baru bila `9771` dipakai |
| 7 | NAMA IBU CALON PASANGAN (Pemohon II pada DK) | Dispensasi kawin | `1552` selalu kosong (posita tak menyebut ibu); SIPP menyimpan Pemohon II | dibaca dari SIPP (pihak), bukan posita | Variabel sudah ada (1552); yang diusulkan adalah pengisinya dari SIPP, bukan variabel baru |
| 8 | TEMPAT TINGGAL ANAK SELAMA PERWALIAN (rumah Pemohon/keluarga) | Perwalian | belum terukur (posita tak seragam) | - | DITUNDA: butuh data lebih |

Ringkasan: variabel yang BENAR-BENAR baru = #1, #2, #3, #4, #5 (lima); #6-#7 melengkapi pengisi variabel yang sudah ada; #8 ditunda.
Nama variabel mengikuti gaya katalog ("... - ISIAN (contoh ...; kosong = ...)") agar label bahasa mudah di layar petugas dapat
dibuat dengan cara yang sama seperti `ramah-w104.ts`.
