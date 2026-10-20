# Keluarga PERKAWINAN (izin poligami, pencegahan, pembatalan) - ringkasan untuk perakit paket W2b

Cabang `fitur/w2b-keluarga-lain-a`. Jatah variabel 4850-4879; terpakai 4850-4858, 4860-4864 (4859 tidak dipakai).

## Variabel baru (`sumber/variabel_poligami.py`)
Isian (data_teks): 4850 surat persetujuan tertulis istri, 4851 alasan keberatan istri, 4852 keadaan istri tidak mungkin dimintai persetujuan, 4853 bentuk persetujuan, 4854 status calon istri, 4855 bukti status janda, 4856 jumlah istri saat ini.
Otomatis (data_sql, baca isian lewat `aps_badilag.abt_data_teks`): 4857 bentuk persetujuan, 4858 alasan keberatan, 4860 pertimbangan calon istri (status, iddah, halangan), 4861 pertimbangan jumlah istri dan izin Pengadilan (Pasal 55-56 KHI), 4862 fakta persetujuan istri tidak hadir, 4863 pertimbangan persetujuan istri tidak hadir, 4864 pertimbangan Pasal 59 KHI.
Pencegahan dan pembatalan: tidak memerlukan variabel baru (blangko lama sudah lengkap: headings, legal standing, tenggang 6 bulan lewat 9331).

## Blangko (`sumber/susun_poligami.py`, env W2B_ASLI = salinan derry_briantono terbaru)
- DITAMBAL (timpa, penjaga md5; `daftar-timpa-poligami.tsv`): `5 Izin Poligami/[01] [Kabul] Izin Poligami.rtf` - fakta 4 memakai #4857#; pertimbangan calon istri dan jumlah istri (#4860# #4861#) ditambahkan di ujung pertimbangan fakta 6.
- BARU: `[01a] [Kabul Verstek] ... Termohon Tidak Hadir`, `[01b] [Kabul] ... Termohon Keberatan (Pasal 59 KHI)`, `[03a] [Tolak Verstek] ... Termohon Tidak Hadir`, `[03b] [Tolak] ... Termohon Keberatan`.
- md5 lama [01] di server 20 Okt 22.50 = `6d8655b3110fb38cb267b71f6a60e638` (dicek ulang lewat ssh 21 Okt: sama).
- Isian baru ditambahkan ke `isian-metadata.ts` (ISIAN_MANUAL 4851, 4852; ISIAN_OPSIONAL 4850, 4853-4856).

## Pengisi (aleta_bot)
`aleta_bot/services/isiOtomatisW2b/poligami.js` (file baru). SATU baris sambungan: `deteksi/poligami.js`, sebelum `return hasil;` di fungsi `deteksi` (`Object.assign(hasil, require("../isiOtomatisW2b/poligami").deteksi(satu))`). Semua usulan `ragu`. Berkas usulan untuk sesi utama: `untuk-sesi-utama/poligami-peta-fakta.json`, `poligami-gerbang.json`.

## Uji
- `manajemen_surat/src/test/w2b-poligami-katalog-21okt.test.ts` (21), `w2b-poligami-isian-21okt.test.ts` (14), `w2b-poligami-paket-21okt.test.ts`.
- `alat/uji_paket_lokal.py`: PRASYARAT, PASANG, PERIKSA ("SEMUA COCOK"), PASANG ulang, PULIH ("PULIH COCOK", jumlah baris kembali, variabel yang disunting orang dibiarkan) di MariaDB lokal.
- `alat/uji_lokal_sql.py` dan `alat/uji_sql.py` (server baca saja) untuk kueri; nomor perkara uji: `sumber/uji-perkara-poligami.txt` (252/Pdt.G/2024 dan 376/Pdt.G/2025).

## Belum / batas
- Render nyata blangko baru di ABT (php56) tidak dilakukan di laptop; yang diuji: struktur RTF, penanda tidak terpecah, semua penanda ada di server, SQL jalan di server (baca saja).
- Pengisi belum ada pembanding isian petugas (kode baru): tetap saran.
- Rujukan perlu-verifikasi: lihat `docs/gelombang2/PERIKSA-PASAL-W2b-poligami.md`.
