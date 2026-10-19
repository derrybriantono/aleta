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

## Sela 2 (akhir) - 19 Okt, sekitar 10.40 WITA

- OCR sampel selesai: 242 berkas, 797 halaman, 189 perkara 2026; 98 halaman perlu diputar (KK melintang). Salinan berkas
  sudah DIHAPUS dari laptop. Angka lengkap: `UKURAN-OCR-ECOURT.json`.
- Ketepatan atas isian petugas (cocok / perkara terbaca): surat keterangan desa tanggal 15/18 (83%), nomor 14/22 (64%);
  tanggal surat kuasa Penggugat vs SIPP 11/16 (69%); akta kematian nomor 5/7, tanggal 4/4; akta kelahiran tanggal 4/4,
  nomor 2/4; nomor KK hanya 1 dari 32 perkara terbaca (nomor KK tercetak berlatar pengaman, OCR gagal).
  Kalibrasi kutipan akta nikah vs SIPP: nomor 2/9, tanggal 16/32 - buku nikah tidak dipakai untuk usulan.
- Tidak ada medan yang memenuhi ambang otomatis (>= 95% pada >= 20 perkara): SEMUA usulan lampiran tetap "ragu".
- Perbaikan dari ukur: tanggal lahir tidak lagi dibaca sebagai tanggal surat, halaman sambungan digabung, tanggal berhuruf
  akta dwibahasa, kedudukan pemberi kuasa diambil sebelum frasa kuasa. Commit 52d1b382 dan sesudahnya.
- Daftar cek dibangun ulang lewat skripnya: tidak 155 -> 145, sebagian 37 -> 47 (0157, 0652, 0653, 0889, 1108, 5171,
  5271, 8894, 8895, 9709).
- Uji sasaran: ocr-lampiran-ecourt-19okt (24), isi-sipp-abt-daftar-cek, tanggal-ktp-ecourt-12okt - 73 lulus. tsc bersih.
