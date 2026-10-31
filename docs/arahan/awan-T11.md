# AWAN T11 - bukti surat/elektronik terpisah + Z cross otomatis (prototipe Linux/LibreOffice)

Dasar: branch `awan-t11` (= `awan-sisa-merah` + arahan ini). Kerja & push di `awan-t11`. JANGAN merge ke gabung-56, JANGAN rilis, JANGAN naikkan versi, JANGAN ubah `ekstensi-berkas.ts`/fixture hash K11 tanpa mencatat. Bahasa Indonesia untuk komentar/commit (gaya CLAUDE.md). Tidak satu kata "Aleta" di teks naskah/SIPP/ABT.
Model Sonnet 5.5 high. Anggaran: berhenti dan laporkan bila biaya mendekati 45 dolar. Hemat: Grep lalu Read sebagian; uji sasaran saja, JANGAN uji penuh.
Rencana lengkap & alasan: lihat bagian 1 dan 2 di bawah (salinan dari rencana laptop).

## Bagian 1 - Bukti surat dan bukti elektronik terpisah (kode)
Sekarang bukti elektronik ikut daftar #9955# (satu daftar dengan bukti surat). Lihat `jenisBuktiBaku`, `gabungBuktiBaku` di `ekstensi-sipp/blangko-derry-isian.js`, daftar kode di `ekstensi-sipp/isi-sipp-bersama.js` dan `manajemen_surat/src/lib/isi-sipp-format.ts` (harus identik, dijaga `draf-h7-mulus-19okt.test.tsx`).
- Variabel baru blok 12040-12049 (cek dulu tidak dipakai: grep "1204"):
  - daftar bukti surat saja;
  - daftar bukti elektronik saja;
  - kalimat pengantar bukti surat BAS: "Atas pertanyaan Ketua Majelis, {pihak} menyatakan bahwa pada hari ini ia telah siap mengajukan alat bukti surat dan saksi-saksi. Selanjutnya {pihak} menyerahkan bukti surat berupa:" (tanpa bukti surat tetapi ada elektronik: "alat bukti elektronik dan saksi-saksi");
  - pengantar bukti elektronik BAS: "Selanjutnya {pihak} menyerahkan bukti elektronik berupa:";
  - putusan: sub-bab "a. Bukti Surat/Tertulis", "b. Bukti Elektronik", "c. Saksi" dengan huruf berurut menurut yang ada (tanpa elektronik -> saksi "b.").
  - Bagian yang kosong tidak tercetak (tanpa paragraf kosong - lihat rapikanBarisKosong di deteksi-sisa-blangko.js).
- Format paragraf mengikuti blangko yang ada (tab/inden tidak diubah).
- Tanda SC Z ditaruh sesudah daftar TERAKHIR.
- Penyisipan ke blangko ABT Derry (paket ABT ke-24 `bukti-pisah-1nov`) DIKERJAKAN DI LAPTOP. Di sini: siapkan variabel + daftar blangko sasaran bila sumber blangko ada di repo (`abt-paket/*/sumber`, tambal.tsv); bila tidak ada, tulis spesifikasi penyisipan di laporan.
- Uji: `manajemen_surat/src/test/bukti-pisah-t11.test.ts` - empat keadaan (surat saja, elektronik saja, keduanya, tanpa bukti), BAS & putusan, huruf sub-bab berurut, identitas kode portal = ekstensi.

## Bagian 2 - Z cross otomatis (prototipe jalur server: Linux + LibreOffice headless)
Pasang `libreoffice-writer` (apt) + `poppler-utils` di lingkungan awan bila belum ada.
Alat baru `ekstensi-sipp/../scripts/zcross/` (atau `manajemen_surat/scripts/zcross/`), Node atau Python, dipanggil dari alur RTF->PDF yang sudah ada (cari alur BAS Word->PDF, `bas-word-pdf`).
- Lintasan 1: RTF -> PDF (soffice --headless --convert-to pdf), cari halaman & koordinat ujung kata terakhir paragraf "...berikut:" / "...berupa:" (pdftotext -bbox-layout).
- Lintasan 2: tulis balik ke RTF:
  - garis atas Z SELALU mulai di samping kata terakhir pada baris yang sama sampai batas kanan (arahan Derry: tidak pernah di bawah paragraf; bila ruang < 3 cm, rapatkan);
  - diagonal ke kiri bawah, garis bawah ±3 cm di atas batas bawah halaman;
  - tanggal tepat di bawah garis (tidak menempel tepi kertas);
  - ganti halaman;
  - nomor halaman bagian berikutnya mulai = halaman Z + jumlah halaman bukti (RTF \sect\pgnrestart\pgnstarts N).
  - Bentuk garis: RTF \shp (shapeType line/freeform) tertambat ke paragraf.
- DOCX: setara (wp:anchor + w:pgNumType w:start), DOC dari DOCX lewat soffice. 
- Jumlah halaman bukti: dari PDF berkas bukti bila ada (pdfinfo), kalau tidak 1 per bukti + temuan info "jumlah halaman bukti bawaan".
- Penyesuaian diulang otomatis tiap cetak/unduh/unggah (tanpa tombol).
- Uji: fixture RTF BAS rekaan dengan 1, 3, 12 bukti (Z di halaman sama/berbeda), cek posisi garis dari PDF hasil (pdftotext -bbox: garis atas sebaris dengan "berikut:", tanggal di bawah garis, halaman berikutnya bernomor benar), RTF seimbang kurung, DOCX terbuka ulang di soffice.
- Word COM (laptop) DIKERJAKAN DI LAPTOP nanti; catat perbedaan yang diantisipasi.

## Laporan akhir
Pesan terakhir + `docs/arahan/awan-T11-hasil.md`: commit, berkas, angka uji, perkiraan biaya terpakai, yang belum terverifikasi (blangko ABT sungguhan, Word, cetak sungguhan, uji penuh).
