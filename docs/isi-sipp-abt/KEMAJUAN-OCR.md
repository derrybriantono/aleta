# Kemajuan OCR lampiran e-Court (Isi SIPP & Input ABT tahap 2)

Agen OCR-ECOURT, branch `fitur/ocr-ecourt` dari `integrasi-1205-10`. Server hanya dibaca (SELECT, salin berkas sampel).

## Sela 1 - 19 Okt, sekitar 09.05 WITA

- Inventaris (DAFTAR-CEK): isian berstatus tidak/sebagian yang sumbernya lampiran: 0185 (tgl. surat kuasa T, bobot 193.352),
  8894/8895 (kuasa insidentil), 0157 (kantor advokat T), 5271/5171 (penghasilan), 0652/0653 (penolakan KUA),
  1108/0889 (duplikat akta nikah), 9709 (TTL anak AUA). Nomor/tanggal akta nikah dan KUA sudah dari SIPP (#1004#/#1012#/#1005#).
  KK, akta kelahiran, surat keterangan desa, akta kematian/cerai tidak punya variabel sendiri: diketik petugas di dalam
  kalimat alat bukti (1214, 9958, 0378, 9955).
- Ukur sumber di server: lampiran 2026 berberkas = "Dokumen Bukti" 850 perkara (PDF gabungan, rerata 4,2 halaman),
  surat kuasa 28+13, KTP 51. Sampel 164 Dokumen Bukti: 157 pindaian (96%), 3 berteks, 4 campuran. Surat kuasa 51/57 pindaian.
- Isian petugas 2026 di ABT server untuk pembanding: 1214 = 502 perkara, 9958 = 180, 0378 = 61, 9955 = 30; di dalamnya
  butir KK 42 perkara, akta kelahiran 21, surat keterangan desa 29, akta kematian 10, akta cerai 5.
  0157/0185/5171/5271/8894 hampir tidak pernah diisi petugas di server (0-3 baris): tidak dapat diukur ke "otomatis".
- Dibangun: pembaca per jenis (bot `lampiranEcourtService.js`), simpanan+antrean (`lampiranEcourtStoreService.js`),
  penyapu latar portal (`lampiran-ecourt.ts`), rute bot, usulan masuk lewat `/abt/isi-gugatan`. Commit 05672c4f.
- Uji sasaran `ocr-lampiran-ecourt-19okt.test.ts`: 23 lulus. tsc bersih.
- Berjalan: OCR laptop atas 238 berkas sampel (salinan di D:/Aplikasi/aleta/tmp/ocr-ukur, dihapus sesudah ukur).
