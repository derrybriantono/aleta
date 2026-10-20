# Paket ABT "abt-w2b-keluarga-lain" - keluarga dan lain-lain (gelombang 2, agen W2b, 20-21 Okt 2026)

**Laptop: SIAP dan teruji (basis ABT sementara + pohon blangko salinan server 20 Okt 22.50). Satker: BELUM dipasang (dipasang sesi utama).**
Hanya blangko dan variabel Derry (`derry_briantono/...`). Tanpa kata aplikasi di ABT. Tidak ada baris lama yang diubah; berkas lama hanya ditimpa
bila md5 di server persis md5 yang diukur (31 berkas), dengan cadangan utuh.

Jenis: Izin Poligami (341), Pencegahan Perkawinan (342), Pembatalan Perkawinan (344), Hak Asuh / Penguasaan Anak (349, 369) / Nafkah Anak (350, 743),
Pengangkatan Anak, Mafqud, Permohonan Umum (369). Rincian per keluarga: `PASANG-poligami.md`, `PASANG-anak.md`, `PASANG-lain.md` (di folder ini).

## Isi `paket-satker/`

| berkas | isi |
|---|---|
| `abt-w2b-keluarga-lain-PRASYARAT.sql` | baca saja: `A\|B\|C\|D\|E` benar `0\|0\|204\|0\|0` (pertama) atau `0\|70\|204\|0\|0` (pasang ulang); C = 204 variabel lama yang dirujuk blangko/kueri HARUS ada (diperiksa ada semua di server 21 Okt 00.5x) |
| `...-PASANG.sql` | 70 variabel baru (hex cp1252, satu transaksi, `WHERE NOT EXISTS`): 4850-4864 (A, 14 dipakai), 4880-4909 (B, 30), 4910-4925 + 4930-4939 (C, 26) |
| `...-PERIKSA.sql` | md5 nama + tipe + kueri tiap variabel; baris akhir `SEMUA COCOK` |
| `...-PULIH.sql` | menghapus variabel baru HANYA bila isinya masih persis paket; akhir `PULIH COCOK` |
| `rtf/` | 14 blangko BARU (tidak pernah menimpa berkas lain) |
| `timpa/` | 31 blangko LAMA versi baru (ditimpa HANYA bila md5 di server persis `daftar-timpa.tsv`) |
| `berkas_rtf.py`, `pasang-satker.sh`, `pulih-satker.sh`, `uji-kueri.tsv`, `MD5SUMS.txt`, `daftar-*.tsv`, `folder-*.txt` | urutan: md5 -> prasyarat -> cadangan -> pasang SQL -> periksa -> uji kueri atas 17 perkara nyata -> berkas -> periksa berkas; gagal sesudah pasang = pulih otomatis |

Dibangun ulang dari sumber dengan `python sumber/bangun_paket.py` (keluarga: `sumber/susun_poligami.py`, `susun_anak.py`, `susun_lain*.py`; bila md5 server berubah:
`W2B_ASLI=<salinan derry_briantono terbaru> python sumber/susun_<keluarga>.py` lalu `bangun_paket.py`).

## Pasang (Git Bash di laptop, server hidup)

Sebelum: cek jatah kosong (hasil 0) dan, bila perlu, cadangan penuh (lihat `docs/gelombang2/URUTAN-PASANG.md`).

```bash
cd /d/aleta-dev/wt/w2b-keluarga-lain/abt-paket/w2b-keluarga-lain      # atau folder repo hasil gabungan
ssh aleta 'bash /root/lihat-jejak.sh "SELECT COUNT(*) FROM aps_badilag.abt_variabel WHERE no_var BETWEEN 4850 AND 4949"'     # harus 0
ssh aleta 'mkdir -p /root/abt-w2b-20261021'
scp -r paket-satker/* aleta:/root/abt-w2b-20261021/
ssh aleta 'cd /root/abt-w2b-20261021 && md5sum -c MD5SUMS.txt | grep -vc ": OK$"'      # harus 0
ssh aleta 'bash /root/abt-w2b-20261021/pasang-satker.sh'
```

Keluaran benar: `PRASYARAT COCOK (0|0|204|0|0)`, `BERKAS SIAP` (`SIAP_TIMPA=31`), `SEMUA COCOK`, 17 blok `uji perkara NNNN: 48xx ...` (34 kueri menjawab semuanya),
`BUAT=14 TIMPA=31`, `COCOK=45`, `BERKAS COCOK`, `SELESAI`.
Bila `GAGAL: berkas ... sudah berubah (md5 ...)`: berkas disunting sesudah 20 Okt 22.50; TIDAK ada yang diubah. Susun ulang paket dari berkas terbaru (lihat atas).
Pulih: `ssh aleta 'bash /root/abt-w2b-20261021/pulih-satker.sh'` -> `HAPUS=14 KEMBALI=31`, `BERKAS PULIH`, `PULIH COCOK`.

Pasang SESUDAH paket gelombang 1 (u2..u6) dan u2b boleh urut apa saja: paket ini tidak memakai variabel baru gelombang 1 kecuali yang ada di PRASYARAT-nya (semua sudah terpasang di server).
Setelah dipasang: muat ulang pohon blangko Derry di ekstensi (popup memuat isian baru); label/pilihan isian ada di `isian-metadata.ts` (ikut rilis berikutnya).

## Hasil uji laptop (21 Okt 2026)

- Basis sementara `aps_badilag_w2b` (salinan abt_variabel dari ABT lokal yang lebih tua; 63 variabel lama yang hanya ada di server diisi baris pengganti agar prasyarat sama):
  pasang -> `SEMUA COCOK`; pasang ulang tanpa cadangan ganda; pulih -> `PULIH COCOK`, jumlah baris kembali semula (1475 -> 1545 -> 1475); variabel yang disunting orang dibiarkan.
- Pohon blangko 303 berkas (18 folder, salinan server): pasang `BUAT=14 TIMPA=31`, `COCOK=45`; pasang ulang `SUDAH=45`; pulih -> 303 berkas md5 persis semula.
- Semua 34 kueri `data_sql` dijalankan di SIPP SERVER (baca saja) atas perkara nyata: 34 dari 34 menjawab, tanpa galat.
- md5 31 berkas lama di server tepat sama dengan `daftar-timpa.tsv` (diperiksa 21 Okt 00.2x); 14 berkas baru tidak ada di server.
- vitest: `w2b-keluarga-lain-paket-21okt` (20), `w2b-poligami-katalog` (21), `w2b-poligami-isian` (14), `w2b-anak-katalog` (31), `w2b-anak-isian` (11), `w2b-lain-katalog` (13), `w2b-lain-katalog-mu` (22), `w2b-lain-isian` (11),
  ditambah uji penjaga/gerbang/fakta/mesin/katalog gelombang 1 dan 49 uji terkait lain (1070) hijau; `tsc --noEmit` bersih.
- Render PHP56 aplikasi ABT: keluarga anak (25 ditambal + 8 baru + 3 BAS), pengangkatan anak/permohonan umum/mafqud (4 blangko) lolos dengan fungsi `isian_rtf_*` diganti stub; poligami belum dirender (lihat Belum).

## Yang belum / batas

- Render ABT blangko poligami baru (php56) belum dijalankan; yang diuji: RTF utuh, penanda ada di server, SQL jalan di server.
- Isian otomatis keluarga baru semuanya `ragu` (saran): tidak ada isian petugas pembanding di ABT untuk kode 4850-4939 (belum pernah diisi), jadi tidak ada yang bisa dinaikkan lewat gerbang. Dicatat di `belumTerukur`.
- Data nyata: poligami 12, pencegahan 2, pembatalan 1, Lain-Lain 19 perkara (SIPP lokal s.d. 2025); jenis hak asuh/penguasaan/nafkah anak mandiri 0 perkara -> diukur dari petitum 117 perkara cerai berkumulasi; mafqud 0 perkara -> fixture.
- Rujukan hukum: banyak yang `perlu-verifikasi` (lihat `docs/gelombang2/PERIKSA-PASAL-W2b.md`); tidak ada nomor pasal yang dikarang.
- Belum ada blangko untuk: eksepsi pada putusan kontradiktoir hak asuh, hak asuh oleh kerabat, jenis 350 mandiri; BAS selain sidang putusan verstek tidak ditambal; pencegahan dan pembatalan tidak berubah (blangko lama sudah lengkap menurut audit).
- Kebergantungan rilis: katalog saksi v2 (ekstensi), gerbang/peta fakta, pengisi `isiOtomatisW2b/*`, `isian-metadata.ts` ikut rilis berikutnya (tanam ulang ekstensi). Berkas `ekstensi-sipp/saksi-katalog-data.js` dihasilkan: bangun ulang (`node manajemen_surat/scripts/susun-saksi-katalog.mjs`) setelah menggabung cabang lain.
