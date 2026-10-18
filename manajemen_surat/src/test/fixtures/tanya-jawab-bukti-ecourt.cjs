"use strict";
// Fixture REKAAN JJ2 (18 Okt 2026): nama, nomor, NIK, dan alamat dikarang; bukan berkas e-Court sungguhan.
// Dipakai tanya-jawab-ecourt-18okt.test.ts dan bukti-ecourt-18okt.test.ts. Bentuk teks seperti keluaran pembaca PDF
// (baris dipatahkan, "\f" pemisah halaman, nomor halaman dan kepala berulang ikut terbaca).

const base = require("./jawab-menjawab-ecourt.cjs");

// ─── Daftar bukti ───────────────────────────────────────────────────────────

const DAFTAR_BUKTI_P = [
  "DAFTAR BUKTI SURAT PENGGUGAT",
  "Perkara Nomor 901/Pdt.G/2026/PA.Xyz",
  "P.1 Fotokopi Kartu Tanda Penduduk Elektronik atas nama Rahmi binti Hasan, NIK 7201000000000009",
  "P.2 Fotokopi Kutipan Akta Nikah Nomor 123/45/V/2018 tanggal 10 Mei 2018, yang dikeluarkan oleh Kantor Urusan Agama",
  "Kecamatan Contoh",
  "P.3 Surat Keterangan Nikah Tidak Tercatat Nomor B-045/Kua.19.04.2/PW.01/06/2026 tanggal 5 Juni 2026, yang dikeluarkan oleh",
  "Kantor Urusan Agama Kecamatan Contoh",
  "P.4 Tangkapan layar percakapan WhatsApp antara Penggugat dan Tergugat tanggal 3 Maret 2026",
  "P.5 Fotokopi surat pernyataan tetangga tentang pisah rumah antara Penggugat dan Tergugat sejak tahun 2025",
].join("\n");

const DAFTAR_BUKTI_T = [
  "DAFTAR BUKTI TERGUGAT",
  "T-1 : Fotokopi Kartu Keluarga atas nama kepala keluarga Rahmat bin Sulaiman, Nomor 7201010101010001 tanggal 2 Januari 2020",
  "T-2 : Foto rumah tempat tinggal bersama",
  "T-3 : Rekaman video kunjungan Tergugat ke rumah orang tua Penggugat",
].join("\n");

// Daftar bertanda urutan saja (tanpa P/T): pihak dari judul.
const DAFTAR_BUKTI_URUTAN = [
  "DAFTAR ALAT BUKTI PEMOHON",
  "1. Fotokopi Kartu Tanda Penduduk atas nama Pemohon",
  "2. Fotokopi Kutipan Akta Nikah Nomor 55/10/II/2015 tanggal 3 Februari 2015",
].join("\n");

// ─── Posita itsbat ──────────────────────────────────────────────────────────

const GUGATAN_ITSBAT_JELAS = [
  "PERMOHONAN ITSBAT NIKAH",
  "Bahwa Pemohon I dan Pemohon II telah melangsungkan pernikahan pada tanggal 10 Mei 2018 secara agama Islam di Kota Contoh;",
  "Bahwa pernikahan tersebut tidak tercatat pada Kantor Urusan Agama sebagaimana Surat Keterangan dari Kantor Urusan Agama Kecamatan",
  "Contoh Nomor: B-045/Kua.19.04.2/PW.01/06/2026 tanggal 5 Juni 2026 yang menyatakan bahwa pernikahan Pemohon I dan Pemohon II tidak tercatat;",
  "Bahwa Pemohon I dan Pemohon II memerlukan penetapan itsbat nikah untuk mengurus akta kelahiran anak;",
  "Berdasarkan hal tersebut Pemohon memohon kepada Ketua Pengadilan Agama Xyz untuk menetapkan sahnya pernikahan Pemohon I dan Pemohon II;",
  "PRIMAIR",
  "1. Mengabulkan permohonan Pemohon;",
].join("\n");

const GUGATAN_ITSBAT_TANPA_NOMOR = [
  "PERMOHONAN ITSBAT NIKAH",
  "Bahwa Pemohon I dan Pemohon II telah melangsungkan pernikahan pada tanggal 10 Mei 2018 secara agama Islam di Kota Contoh;",
  "Bahwa pernikahan tersebut tidak tercatat pada Kantor Urusan Agama setempat;",
  "Bahwa Pemohon I dan Pemohon II memerlukan penetapan itsbat nikah untuk mengurus akta kelahiran anak;",
  "Berdasarkan hal tersebut Pemohon memohon kepada Ketua Pengadilan Agama Xyz untuk menetapkan sahnya pernikahan;",
  "PRIMAIR",
  "1. Mengabulkan permohonan Pemohon;",
].join("\n");

const GUGATAN_ITSBAT_DUA_SURAT = [
  "PERMOHONAN ITSBAT NIKAH",
  "Bahwa pernikahan tersebut tidak tercatat sebagaimana Surat Keterangan Kantor Urusan Agama Kecamatan Contoh Nomor: B-045/Kua.19.04.2/PW.01/06/2026 tanggal 5 Juni 2026;",
  "Bahwa menurut Surat Keterangan KUA Kecamatan Lain Nomor: B-099/Kua.19.05.1/PW.01/08/2026 tanggal 9 Agustus 2026 pernikahan itu tidak tercatat;",
].join("\n");

// Isi berkas surat keterangan KUA yang dibaca OCR/teks.
const BERKAS_KUA = [
  "KEMENTERIAN AGAMA REPUBLIK INDONESIA",
  "KANTOR URUSAN AGAMA KECAMATAN CONTOH",
  "SURAT KETERANGAN",
  "Nomor : B-078/Kua.19.04.2/PW.01/07/2026",
  "Yang bertanda tangan di bawah ini Kepala Kantor Urusan Agama Kecamatan Contoh menerangkan bahwa pernikahan atas nama",
  "Rahmat dan Rahmi tidak tercatat pada register nikah kantor kami.",
  "Contoh, 14 Juli 2026",
  "Kepala KUA",
].join("\n");

const BERKAS_KTP = ["REPUBLIK INDONESIA", "PROVINSI CONTOH", "NIK : 7201000000000009", "Nama : RAHMI BINTI HASAN"].join("\n");

// ─── Jawaban bersama sita dan rekonvensi harta bersama ──────────────────────

const JAWABAN_SITA_HB = [
  "JAWABAN TERGUGAT",
  "DALAM KONVENSI",
  "Bahwa Tergugat membantah dalil Penggugat pada angka 3 gugatannya karena Tergugat selalu memberi nafkah setiap bulan kepada Penggugat;",
  "Bahwa Tergugat keberatan atas permohonan sita jaminan yang diajukan Penggugat karena objek yang dimohonkan sita adalah harta pribadi Tergugat yang diperoleh sebelum menikah;",
  "Bahwa menurut Pasal 190 RBg yang berbunyi sita jaminan hanya dapat dilakukan bila ada dugaan barang akan dialihkan;",
  "DALAM REKONVENSI",
  "Bahwa selama perkawinan Penggugat Rekonvensi dan Tergugat Rekonvensi memperoleh harta bersama berupa:",
  "1. Sebidang tanah seluas 400 m2 yang terletak di Desa Contoh;",
  "2. Sebuah rumah permanen di atas tanah tersebut;",
  "3. Satu unit sepeda motor Honda tahun 2019;",
  "Bahwa harta bersama tersebut harus dibagi dua sama rata;",
  "Berdasarkan segala uraian di atas Tergugat memohon dengan hormat kepada Majelis Hakim untuk memutus:",
  "DALAM REKONVENSI",
  "1. Menetapkan harta bersama berupa tanah, rumah, dan sepeda motor tersebut;",
  "Demikian jawaban ini kami sampaikan.",
  "Hormat kami,",
  "Kuasa Hukum Tergugat",
].join("\n");

const JAWABAN_SITA_BUKAN_TERGUGAT = [
  "JAWABAN TERGUGAT",
  "Bahwa dalil Penggugat tentang sita jaminan tidak berdasar sama sekali dan harus dikesampingkan;",
  "Bahwa Tergugat membantah seluruh dalil gugatan Penggugat;",
].join("\n");

// ─── Surat yang TIDAK rapi (tiap satu melanggar satu ukuran) ────────────────

const JAWABAN_SATU_PARAGRAF = [
  "JAWABAN TERGUGAT",
  "Bahwa Tergugat membantah seluruh dalil Penggugat karena tidak sesuai dengan kenyataan yang sebenarnya terjadi dalam rumah tangga.",
].join("\n");

const JAWABAN_TANPA_STRUKTUR = [
  "JAWABAN TERGUGAT",
  "Bahwa Tergugat membantah dalil Penggugat tentang nafkah karena Tergugat memberi nafkah setiap bulan;",
  "",
  "Rumah tangga yang dibangun bersama selama ini baik baik saja dan tidak ada yang perlu dipersoalkan di sini sama sekali.",
  "",
  "Bahwa Tergugat membantah pula dalil Penggugat tentang pisah rumah karena masih tinggal serumah;",
].join("\n");

const JAWABAN_SISA_TANDA_TANGAN = [
  "JAWABAN TERGUGAT",
  "Bahwa Tergugat membantah dalil Penggugat tentang nafkah karena Tergugat memberi nafkah setiap bulan kepada Penggugat;",
  "Bahwa Tergugat membantah pula dalil Penggugat tentang pisah rumah karena Tergugat dan Penggugat masih tinggal serumah;",
  "Bahwa Tergugat mohon agar gugatan Penggugat ditolak karena tidak ada alasan yang cukup untuk bercerai; Hormat kami, ttd Budi Santoso, S.H., M.H.",
  "email: budi@contoh.example",
].join("\n");

const JAWABAN_KARAKTER_RUSAK = [
  "JAWABAN TERGUGAT",
  "Bahwa Tergugat membantah dalil Penggugat tentang nafkah karena Tergugat memberi nafkah setiap bulan kepada Penggugat��;",
  "Bahwa Tergugat membantah pula dalil Penggugat tentang pisah rumah karena Tergugat dan Penggugat masih tinggal serumah;",
  "Bahwa Tergugat mohon agar gugatan Penggugat ditolak karena tidak ada alasan yang cukup untuk bercerai;",
].join("\n");

const JAWABAN_OCR_BERSERAK = [
  "JAWABAN TERGUGAT",
  "Bahwa T e r g u g a t m e m b a n t a h d a l i l P e n g g u g a t t e n t a n g n a f k a h k a r e n a T e r g u g a t m e m b e r i n a f k a h s e t i a p b u l a n ;",
  "Bahwa T e r g u g a t m e m b a n t a h p u l a d a l i l P e n g g u g a t t e n t a n g p i s a h r u m a h k a r e n a m a s i h s e r u m a h ;",
].join("\n");

const JAWABAN_HURUF_BESAR = [
  "JAWABAN TERGUGAT",
  "BAHWA TERGUGAT MEMBANTAH DALIL PENGGUGAT TENTANG NAFKAH KARENA TERGUGAT MEMBERI NAFKAH SETIAP BULAN KEPADA PENGGUGAT;",
  "BAHWA TERGUGAT MEMBANTAH PULA DALIL PENGGUGAT TENTANG PISAH RUMAH KARENA MASIH TINGGAL SERUMAH BERSAMA ANAK;",
].join("\n");

module.exports = {
  ...base,
  DAFTAR_BUKTI_P,
  DAFTAR_BUKTI_T,
  DAFTAR_BUKTI_URUTAN,
  GUGATAN_ITSBAT_JELAS,
  GUGATAN_ITSBAT_TANPA_NOMOR,
  GUGATAN_ITSBAT_DUA_SURAT,
  BERKAS_KUA,
  BERKAS_KTP,
  JAWABAN_SITA_HB,
  JAWABAN_SITA_BUKAN_TERGUGAT,
  JAWABAN_SATU_PARAGRAF,
  JAWABAN_TANPA_STRUKTUR,
  JAWABAN_SISA_TANDA_TANGAN,
  JAWABAN_KARAKTER_RUSAK,
  JAWABAN_OCR_BERSERAK,
  JAWABAN_HURUF_BESAR,
};
