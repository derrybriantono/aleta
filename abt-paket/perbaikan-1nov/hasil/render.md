# Render sungguhan (renderer ABT php56 asli, `alat/render174.py`) sebelum/sesudah paket ke-30 `perbaikan-1nov`

Basis: ABT `aps_badilag_w174d` (dump server 28 Okt + 29 paket; sesudah = + paket ini lewat `pasang-satker.sh`), pohon `_blangko_abt` sebelum = salinan rantai 29 paket,
sesudah = pohon yang sama + paket ini; SIPP `sipp_w174` (salinan `sipp_w164`). RTF -> PDF (satu halaman) lewat Microsoft Word (`alat/halaman_png.ps1`), PDF -> PNG (Windows.Data.Pdf).
PNG: `D:/Aplikasi/aleta/tmp/w174/render/png/<sebelum|sesudah>-<kasus>-<kode>-h<halaman>-h1.png` (memuat NAMA PIHAK SUNGGUHAN - TIDAK masuk repo, TIDAK dikirim keluar).
Beda teks otomatis semua kasus: `python alat/beda_teks.py D:/Aplikasi/aleta/tmp/w174/render a-bukti-baru,a-bukti-berubah,b-khi7-ayat4,b-dk-angka,b-hb-ps35`
(HANYA kalimat yang diharapkan yang berbeda; jumlah paragraf sama persis pada tiap pasangan).

| kasus | perkara / blangko | sebelum | sesudah |
|---|---|---|---|
| A1 `a-bukti-baru` | 433/Pdt.G/2025 (verstek) / Perceraian CG [02] [Kabul] CG - F, hlm 5 | "...alat-alat buktinya di muka persidangan pada tanggal [kosong] untuk mendukung..." | "...pada tanggal 25 Agustus 2025 untuk mendukung..." (tundaan sidang 4 Agustus "pemeriksaan bukti Penggugat" menjadikan sidang 25 Agustus sidang pembuktian Penggugat; dulu agendanya "Panggil Tergugat" tidak dikenali) |
| A2 `a-bukti-berubah` | 134/Pdt.G/2020 / sama, hlm 8 dan 9 | Pemohon: 07 Juli 2020; Termohon: 04 Agustus 2020 | Pemohon: 14 Juli 2020; Termohon: 07 Juli 2020 (tundaan 30 Juni "Untuk Pembuktian Termohon" menjadikan sidang 7 Juli milik Termohon; lihat catatan di PASANG.md) |
| B1 `b-khi7-ayat4` | Itsbat Nikah Kontensius [01] (Ahli Waris Mengakui), hlm 7 | "Pasal 7 ayat (4) huruf a Kompilasi Hukum Islam" | "Pasal 7 ayat (4) Kompilasi Hukum Islam" |
| B2 `b-dk-angka` | Dispensasi Kawin [03] Tolak (Anak P Cewek) Belum Hamil, hlm 18 | "Pasal 1 Ayat 1 Undang-Undang Nomor 35 Tahun 2014" | "Pasal 1 angka 1 Undang-Undang Nomor 35 Tahun 2014" |
| B3 `b-hb-ps35` | Harta Bersama [01] Kabul E-Court, hlm 24 | "Pasal 35 ayat (1) ... disebutkan 'Harta bawaan dari masing-masing suami isteri dan harta benda yang di peroleh ... warisan adalah di bawah penguasaan ...'" | "Pasal 35 ayat (2) ... 'Harta bawaan dari masing-masing suami dan isteri dan harta benda yang diperoleh ... warisan, adalah dibawah penguasaan ...'" |

## Waktu render (php56 CLI, 1 proses; laptop sibuk dipakai agen lain - angka berfluktuasi besar)
- `sebelum` (5 kasus): 148,6 / 106,5 / 119,1 / 36,3 / 94,4 dtk; `sesudah`: 29,0 / 51,0 / 44,5 / 10,6 / 68,6 dtk (dijalankan pada waktu lain; BUKAN perbandingan adil).
- Perbandingan bergantian pada basis yang sama (kasus A1+A2, variabel lama lalu baru, dua putaran): lama 114,2+113,6 dan 83,8+60,4 dtk; baru 119,2+80,2 dan 70,0+63,6 dtk - tidak ada selisih yang
  melebihi fluktuasi laptop (satu dokumen memuat ratusan penanda lain; yang berubah hanya syarat kueri empat variabel).
- Waktu kueri variabel sendiri (`alat/waktu_kueri.js`, `hasil/waktu-kueri.jsonl`, 40 eksekusi per kueri, MariaDB 10.4 laptop, juga sibuk): median 12-49 ms (baru) vs 5-19 ms (lama);
  perkara 1-3 sidang: 12-26 ms vs 5-18 ms; perkara terpanjang (22 sidang): 29-49 ms vs 10-17 ms. Selisih mutlak puluhan milidetik per variabel, jauh di bawah fluktuasi waktu render dokumen.
