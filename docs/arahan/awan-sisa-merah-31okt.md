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

## 4. Tambahan (dari pengguna, 31 Okt)
A. Deteksi SEMUA bahasa yang masih berbunyi blangko / isian kosong, bukan hanya pola di daftar: kalimat petunjuk ("isi dengan", "diisi", "sesuaikan", "contoh:", "pilih", "ketik", "tulis"); label tanpa isi ("Nama :", "Umur :", "NIK :", "Alamat :" diikuti kosong/titik/garis); tanggal/nomor/nominal kosong ("tanggal bulan tahun", "Rp,00", "Nomor /Pdt.G/"); spasi ganda bekas isian kosong ("Penggugat  bin  ", "pada tanggal , "); koma/titik ganda (", ,", " ,", "( )"). Dua tingkat: jelas sisa blangko = PASTI (merah + .txt); bisa sah = RAGU (.txt "periksa"). Tiap pola: uji kena + uji tidak salah tangkap.
B. (RALAT) Tidak boleh ada paragraf kosong akibat enter: HAPUS SEMUA paragraf kosong (termasuk dari isian kosong) otomatis saat cetak/unduh dari panel; jarak antar paragraf dari \sb/\sa format blangko. Pengecualian: kop surat, ruang tanda tangan (Ketua Majelis/Hakim/Panitera/Jurusita), seluruh blok Jurusita/Jurusita Pengganti, sekitar ganti halaman, sel tabel, gambar/Z cross. Judul bab (DUDUK PERKARA, PERTIMBANGAN HUKUM, MENGADILI, ...) yang berdampingan dengan paragraf kosong terhapus dan tanpa \sb/\sa diberi \sb240. Catat jumlah di .txt (info) dan laporan.
C. Pengecualian WAJIB: titik-titik pada blok Jurusita / Jurusita Pengganti (relaas dan blangko jurusita lain) diisi tangan jurusita: JANGAN dimerahkan, JANGAN dicatat di .txt, JANGAN diubah/dirapikan. Uji: relaas dengan "Jurusita Pengganti ....." -> 0 temuan, RTF bagian itu tidak berubah.
