"use strict";
// Fixture REKAAN (nama, nomor, dan alamat dikarang; bukan berkas e-Court sungguhan) bentuk teks PDF berlapis teks:
// baris dipatahkan seperti keluaran pembaca PDF, halaman dipisah "\f", kepala-kaki dan nomor halaman ikut terbaca.
// Dipakai jawab-menjawab-ecourt-18okt.test.ts. Sengaja memuat kop, salam, identitas, penutup, dan tanda tangan.

const KEPALA = "JAWABAN TERGUGAT PERKARA NOMOR 901/Pdt.G/2026/PA.Xyz";

const JAWABAN_PDF = [
  KEPALA,
  "KANTOR HUKUM BUDI & REKAN",
  "Jl. Contoh Raya No. 12, Kota Contoh, Telp 0451-123456, email: kantor@contoh.example",
  "Kepada Yth.",
  "Ketua Pengadilan Agama Xyz",
  "di Xyz",
  "Perihal : Jawaban Tergugat dalam perkara Nomor 901/Pdt.G/2026/PA.Xyz",
  "Assalamu'alaikum Warahmatullahi Wabarakatuh",
  "Dengan hormat,",
  "Yang bertanda tangan di bawah ini:",
  "Nama : Rahmat bin Sulaiman",
  "NIK : 7201000000000001",
  "Pekerjaan : Wiraswasta",
  "Alamat : Jl. Mawar No. 3, Desa Contoh",
  "Selanjutnya disebut sebagai TERGUGAT;",
  "JAWABAN TERGUGAT",
  "DALAM KONVENSI",
  "Bahwa Tergugat mengakui dalil Penggugat pada angka 1 dan 2 gugatannya yang menyatakan bahwa Penggugat dan Tergugat",
  "menikah pada tanggal 10 Mei 2018 di Kota Contoh;",
  "\f" + KEPALA,
  "- 2 -",
  "Bahwa Tergugat membantah dalil Penggugat pada angka 4 yang menyatakan bahwa Tergugat tidak memberi nafkah, sebab",
  "setiap bulan Tergugat menyerahkan penghasilannya kepada Penggugat, sehingga dalil tersebut tidak benar;",
  "Bahwa menurut Pasal 39 ayat (2) Undang-Undang Nomor 1 Tahun 1974 yang berbunyi untuk melakukan perceraian harus ada cukup alasan;",
  "Bahwa Tergugat masih mencintai Penggugat dan keberatan untuk bercerai karena ingin mempertahankan rumah tangga demi anak;",
  "DALAM REKONVENSI",
  "Bahwa Tergugat dalam rekonvensi disebut Penggugat Rekonvensi dan Penggugat dalam konvensi disebut Tergugat Rekonvensi;",
  "Bahwa apabila perceraian tetap dikabulkan, Penggugat Rekonvensi meminta hak asuh atas anak yang lahir dari perkawinan",
  "\f" + KEPALA,
  "- 3 -",
  "ini karena anak masih berusia di bawah 12 tahun;",
  "Berdasarkan segala uraian di atas, Tergugat memohon dengan hormat kepada Majelis Hakim yang memeriksa perkara ini untuk memutus:",
  "DALAM KONVENSI",
  "1. Menolak gugatan Penggugat untuk seluruhnya;",
  "DALAM REKONVENSI",
  "1. Menetapkan hak asuh anak kepada Penggugat Rekonvensi;",
  "SUBSIDAIR: mohon putusan yang seadil-adilnya (ex aequo et bono).",
  "Demikian jawaban ini kami sampaikan, atas perhatian Majelis Hakim kami ucapkan terima kasih.",
  "Wassalamu'alaikum Warahmatullahi Wabarakatuh",
  "Xyz, 12 Agustus 2026",
  "Hormat kami,",
  "Kuasa Hukum Tergugat",
  "Budi Santoso, S.H.",
].join("\n");

// Jawaban orang awam (sendiri, orang pertama), tanpa kop, tanpa rekonvensi.
const JAWABAN_AWAM = [
  "JAWABAN TERMOHON",
  "Perkara Nomor 902/Pdt.G/2026/PA.Xyz",
  "Nama : Siti binti Ahmad",
  "Umur : 30 tahun",
  "Alamat : Dusun Tiga, Desa Contoh",
  "Bahwa saya mengakui telah menikah dengan Pemohon pada tahun 2015 dan telah dikaruniai dua orang anak yang sekarang",
  "tinggal bersama saya;",
  "Bahwa saya membantah bahwa saya sering pergi tanpa izin, karena saya hanya pergi ke rumah orang tua saya yang sedang sakit;",
  "Bahwa saya tidak mengajukan gugatan rekonvensi dalam perkara ini;",
  "Demikian jawaban saya.",
  "Hormat saya,",
  "Siti binti Ahmad",
].join("\n");

const JAWABAN_EKSEPSI_KEWENANGAN = [
  "EKSEPSI DAN JAWABAN TERGUGAT",
  "DALAM EKSEPSI",
  "Bahwa pengadilan agama tidak berwenang memeriksa perkara ini secara relatif karena Tergugat bertempat tinggal",
  "di luar wilayah hukum Pengadilan Agama Xyz;",
  "DALAM POKOK PERKARA",
  "Bahwa Tergugat menolak seluruh dalil Penggugat kecuali yang diakui secara tegas dalam jawaban ini;",
  "Bahwa Tergugat tidak pernah melakukan wanprestasi karena angsuran telah dibayar sesuai jadwal;",
  "Demikian jawaban ini disampaikan.",
  "Hormat kami,",
  "Kuasa Hukum Tergugat",
].join("\n");

const REPLIK = [
  "REPLIK PENGGUGAT ATAS JAWABAN TERGUGAT",
  "Bahwa Penggugat tetap pada dalil-dalil gugatannya semula dan menolak seluruh dalil jawaban Tergugat kecuali yang diakui;",
  "Bahwa dalil Tergugat yang menyatakan telah memberi nafkah setiap bulan adalah tidak benar, karena Tergugat hanya memberi",
  "uang belanja tidak tetap dan sering terlambat berbulan-bulan;",
  "Demikian replik ini disampaikan.",
  "Hormat kami,",
  "Penggugat",
].join("\n");

const DUPLIK = [
  "DUPLIK TERGUGAT",
  "Bahwa Tergugat tetap pada jawabannya semula dan menolak dalil replik Penggugat;",
  "Bahwa Tergugat berkeberatan atas dalil Penggugat tentang uang belanja karena Penggugat mengelola sendiri seluruh penghasilan Tergugat;",
  "Demikian duplik ini disampaikan.",
].join("\n");

const KESIMPULAN_PENGGUGAT = [
  "KESIMPULAN PENGGUGAT",
  "Bahwa berdasarkan pemeriksaan bukti surat P.1 sampai P.3 dan keterangan dua orang saksi, telah terbukti rumah tangga Penggugat dan Tergugat",
  "tidak harmonis lagi karena sering terjadi perselisihan;",
  "Bahwa Penggugat tetap pada gugatannya semula untuk bercerai dengan Tergugat;",
  "Berdasarkan hal tersebut, Penggugat memohon kepada Majelis Hakim untuk mengabulkan gugatan Penggugat seluruhnya.",
  "Demikian kesimpulan ini disampaikan.",
  "Hormat kami,",
  "Penggugat",
].join("\n");

const KESIMPULAN_TERGUGAT = [
  "KESIMPULAN TERGUGAT",
  "Bahwa dari bukti yang diajukan Penggugat tidak terbukti adanya perselisihan yang terus menerus;",
  "Bahwa Tergugat tidak ingin bercerai dengan Penggugat karena masih ingin mempertahankan rumah tangga;",
  "Berdasarkan hal tersebut, Tergugat memohon kepada Majelis Hakim untuk menolak gugatan Penggugat seluruhnya.",
  "Demikian kesimpulan ini disampaikan.",
].join("\n");

// Diunggah dengan jenis "Kesimpulan" padahal isinya daftar bukti.
const DAFTAR_BUKTI = [
  "DAFTAR BUKTI SURAT PENGGUGAT",
  "Perkara Nomor 901/Pdt.G/2026/PA.Xyz",
  "P.1 Fotokopi KTP atas nama Penggugat",
  "P.2 Fotokopi Kutipan Akta Nikah Nomor 123/45/V/2018",
  "P.3 Fotokopi Kartu Keluarga atas nama kepala keluarga Penggugat yang beralamat di Desa Contoh",
  "P.4 Fotokopi surat pernyataan tetangga tentang pisah rumah antara Penggugat dan Tergugat sejak tahun 2025",
  "P.5 Fotokopi tangkapan layar percakapan antara Penggugat dan Tergugat yang telah dinazegelen dan dicocokkan",
  "P.6 Fotokopi surat keterangan dari kepala desa tentang tempat tinggal Penggugat dan Tergugat",
].join("\n");

module.exports = {
  JAWABAN_PDF,
  JAWABAN_AWAM,
  JAWABAN_EKSEPSI_KEWENANGAN,
  REPLIK,
  DUPLIK,
  KESIMPULAN_PENGGUGAT,
  KESIMPULAN_TERGUGAT,
  DAFTAR_BUKTI,
};
