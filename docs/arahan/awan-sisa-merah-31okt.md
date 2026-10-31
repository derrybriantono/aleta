# Arahan sesi awan: sisa blangko merah + perluasan deteksi (butir 3 & 3b)

Branch dasar: `gabung-56`. Kerjakan di branch baru `awan-sisa-merah`, commit dan push ke origin. JANGAN merge ke gabung-56, JANGAN rilis, JANGAN naikkan versi manifest/APP_VERSION, JANGAN ubah abt-paket/.
Jawab/komentar/commit dalam bahasa Indonesia (gaya commit: lihat CLAUDE.md). Tidak satu kata "Aleta" di teks yang masuk ke naskah/SIPP.

## Sasaran
Berkas utama: `ekstensi-sipp/deteksi-sisa-blangko.js` (deteksi + pengingat .txt) dan jalur cetak/unduh naskah di panel Blangko Derry (`ekstensi-sipp/blangko-derry*.js`, cari pemanggil deteksi-sisa-blangko & pembuat RTF).

### 1. Sisa blangko tercetak MERAH saat dicetak/diunduh dari panel
- Semua temuan tingkat PASTI diwarnai merah di RTF (tambah warna merah di \colortbl, bungkus potongan dengan \cfN ... \cf0). Jangan merusak RTF (kurung kurawal seimbang, escape \ { }).
- Pengingat .txt TETAP diunduh seperti sekarang.
- Pengecualian yang sudah ada tetap berlaku ("..." kutipan ayat; "..." relaas yang diisi tangan).
- Deteksi saat unggah yang menahan teks merah tetap jalan.

### 2. Yang WAJIB diingatkan (.txt) dan dimerahkan
- Kurung siku `[ ... ]` (kosong maupun berisi petunjuk, mis. "[BUKTI SURAT ... BELUM ADA ...]", "[HURUF ALASAN ... BELUM DIPILIH]").
- Placeholder: `#kode#` yang belum terganti, `{...}`, `<<...>>`, "(nama)", "(alamat)", "(pilih salah satu)", "*) coret yang tidak perlu".
- Kata "verifikasi" sebagai penanda isian (mis. "butuh verifikasi", "perlu verifikasi", "[verifikasi]") - SEKARANG BELUM TERDETEKSI.
- Titik-titik "..." / "…" dan garis bawah "___" (aturan lama).
- Catatan perbaikan dan teks yang sudah merah (aturan lama).

### 3. Perluasan pola (3b), dua tingkat
PASTI (merah + .txt):
- isian setengah: "20..", "Nomor ..../Pdt.G/....", "Rp. ....", "hari ..., tanggal ...";
- "XXX"/"xx" sebagai isian;
- kata berulang hasil isian: "para Para", "pada pada", "yang yang" (tidak peka huruf besar).
RAGU (hanya .txt, ditandai "periksa", TIDAK merah):
- pilihan bergaris miring yang belum dipilih: "Penggugat/Tergugat", "Pemohon/Termohon", "laki-laki/perempuan", "bin/binti", "suami/istri".
- "dan/atau" SAH - jangan ditandai. Kutipan pasal/ayat jangan ditandai.

## Uji
- Tambah `manajemen_surat/src/test/sisa-merah-31okt.test.ts`: tiap pola = minimal satu uji kena + satu uji tidak salah tangkap; uji RTF hasil tetap seimbang kurung dan memuat \cf merah tepat di potongan.
- Jalankan HANYA uji sasaran: `cd manajemen_surat && npx vitest run src/test/sisa-merah-31okt.test.ts` + uji yang sudah ada yang menyentuh deteksi-sisa-blangko (grep di src/test). JANGAN uji penuh.
- Bila ada uji k11/peta fitur yang menjaga isi berkas ekstensi gagal karena perubahan sah, catat di laporan (jangan ubah fixture hash sembarangan).
- Typecheck: `npx tsc --noEmit` bila mengubah berkas .ts.

## Laporan akhir (di pesan terakhir + berkas `docs/arahan/awan-sisa-merah-31okt-hasil.md`)
Commit, berkas yang diubah, daftar pola (pasti/ragu), hasil uji (angka), yang belum terverifikasi (cetak sungguhan di Word, pengukuran atas putusan sungguhan - dikerjakan di laptop).
Hemat biaya: pakai Grep lalu Read sebagian; jangan membaca berkas besar utuh tanpa perlu.
