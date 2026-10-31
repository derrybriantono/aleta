"use strict";
// Fixture REKAAN jawab-replik (31 Okt 2026): nama, nomor, NIK, alamat dikarang; BUKAN berkas e-Court sungguhan (arsip dokumen
// e-Court tidak ada di laptop - hanya barisnya di aleta_bot_ecourt_documents). Susunan surat meniru bentuk berkas sungguhan PA
// Donggala (judul berkas di arsip: "Jawaban Konvensi dan Gugatan Rekonvensi", "Replik Pemohon dan Jawab Rekonvensi", "Duplik
// Konvensi dan Replik Rekonvensi", "Duplik Rekonvensi", "Kesimpulan Pemohon", "KESIMPULAN TERMOHON ...", "EKSEPSI, JAWABAN DAN
// GUGATAN REKONVENSI DARI TERGUGAT"); isi dalil disusun dari pola posita cerai talak di SIPP. Teks dibentuk seperti keluaran
// pembaca PDF: paragraf dipatahkan per baris selebar halaman, "\f" pemisah halaman, nomor halaman dan kepala berulang ikut.

/** Patahkan paragraf menjadi baris selebar `lebar`, kata terpanjang tidak dipenggal (kecuali `penggal`). */
function patah(par, lebar, penggal) {
  const kata = par.split(/\s+/);
  const baris = [];
  let kini = "";
  for (const k of kata) {
    if (!kini) {
      kini = k;
      continue;
    }
    if ((kini + " " + k).length > lebar) {
      if (penggal && k.length > 9 && kini.length < lebar - 6) {
        const n = lebar - kini.length - 2;
        baris.push(`${kini} ${k.slice(0, n)}-`);
        kini = k.slice(n);
        continue;
      }
      baris.push(kini);
      kini = k;
    } else kini += " " + k;
  }
  if (kini) baris.push(kini);
  return baris;
}

/**
 * Paragraf -> teks "PDF": baris dipatahkan, halaman per `perHalaman` baris, tiap halaman diberi kepala berulang (bila ada) dan
 * nomor halaman "- n -" di bawah.
 */
function pdf(paragraf, opsi) {
  const o = { lebar: 88, perHalaman: 30, kepala: "", penggal: false, kosongAntar: false, ...(opsi || {}) };
  const semua = [];
  for (const p of paragraf) {
    if (p === "") {
      semua.push("");
      continue;
    }
    semua.push(...patah(p, o.lebar, o.penggal));
    if (o.kosongAntar) semua.push("");
  }
  const halaman = [];
  for (let i = 0; i < semua.length; i += o.perHalaman) halaman.push(semua.slice(i, i + o.perHalaman));
  return halaman.map((h, i) => [...(o.kepala && i > 0 ? [o.kepala] : []), ...h, `- ${i + 1} -`].join("\n")).join("\f");
}

const KEPALA_JAWAB = "Jawaban Termohon Perkara Nomor 901/Pdt.G/2026/PA.Xyz";

// 1. Jawaban + gugatan rekonvensi, cerai talak, ditulis Termohon sendiri ("saya"), bernomor, rincian a. b., ";" di tengah.
const PAR_JAWABAN_REKON = [
  "JAWABAN DAN GUGATAN REKONVENSI",
  "Kepada Yth.",
  "Ketua Pengadilan Agama Xyz",
  "Cq. Majelis Hakim Pemeriksa Perkara Nomor 901/Pdt.G/2026/PA.Xyz",
  "di -",
  "Tempat",
  "Assalamu'alaikum Wr. Wb.",
  "Dengan hormat,",
  "Yang bertanda tangan di bawah ini:",
  "Nama : Siti Rahmah binti Lakaso",
  "NIK : 7210000000000001",
  "Alamat : Desa Contoh, Kecamatan Contoh, Kabupaten Contoh",
  "Selanjutnya disebut sebagai Termohon/Penggugat Rekonpensi, dengan ini mengajukan jawaban atas permohonan cerai talak yang diajukan oleh Pemohon sebagai berikut:",
  "DALAM KONVENSI",
  "1. Bahwa saya membenarkan dalil permohonan Pemohon angka 1 tentang pernikahan Pemohon dan Termohon pada tanggal 17 Juni 2020 yang dicatat oleh Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Contoh;",
  "2. Bahwa saya membenarkan dalil angka 3 bahwa dari pernikahan tersebut telah dikaruniai 2 (dua) orang anak yang sekarang berada dalam pengasuhan Termohon; bahwa selama ini anak-anak tersebut tidak pernah diberi nafkah oleh Pemohon sejak bulan Januari 2026;",
  "3. Bahwa saya menolak dalil Pemohon angka 4 dan angka 5, karena yang sebenarnya terjadi adalah:",
  "a. Pemohon sering pulang larut malam tanpa alasan yang jelas;",
  "b. Pemohon tidak memberikan nafkah yang cukup untuk kebutuhan rumah tangga;",
  "c. Pemohon sering membentak Termohon di depan keluarga Pemohon;",
  "4. Bahwa Termohon pada dasarnya tidak keberatan untuk bercerai dengan Pemohon, asalkan hak-hak Termohon dan anak-anak dipenuhi oleh Pemohon sebagaimana diuraikan dalam gugatan rekonvensi di bawah ini;",
  "DALAM REKONVENSI",
  "1. Bahwa apa yang telah diuraikan dalam konvensi mohon dianggap termuat kembali dalam rekonvensi ini, dan dalam rekonvensi ini Termohon Konvensi disebut Penggugat Rekonvensi dan Pemohon Konvensi disebut Tergugat Rekonvensi;",
  "2. Bahwa oleh karena perceraian ini atas kehendak Tergugat Rekonvensi, maka Penggugat Rekonvensi menuntut nafkah iddah selama 3 (tiga) bulan sejumlah Rp3.000.000,00 (tiga juta rupiah) dan mut'ah berupa uang sejumlah Rp5.000.000,00 (lima juta rupiah);",
  "3. Bahwa Penggugat Rekonvensi menuntut nafkah 2 (dua) orang anak sejumlah Rp1.500.000,00 (satu juta lima ratus ribu rupiah) setiap bulan sampai anak dewasa atau berumur 21 tahun, dengan kenaikan 10% setiap tahun;",
  "Berdasarkan alasan-alasan tersebut di atas, Termohon mohon kepada Majelis Hakim yang memeriksa dan mengadili perkara ini berkenan memutus sebagai berikut:",
  "DALAM KONVENSI",
  "Menolak permohonan Pemohon untuk seluruhnya;",
  "DALAM REKONVENSI",
  "1. Mengabulkan gugatan Penggugat Rekonvensi untuk seluruhnya;",
  "2. Menghukum Tergugat Rekonvensi untuk membayar kepada Penggugat Rekonvensi: a. Nafkah iddah sejumlah Rp3.000.000,00 (tiga juta rupiah); b. Mut'ah berupa uang sejumlah Rp5.000.000,00 (lima juta rupiah);",
  "3. Menghukum Tergugat Rekonvensi untuk membayar nafkah 2 (dua) orang anak sejumlah Rp1.500.000,00 setiap bulan sampai anak tersebut dewasa;",
  "DALAM KONVENSI DAN REKONVENSI",
  "Membebankan biaya perkara sesuai ketentuan yang berlaku;",
  "Atau apabila Majelis Hakim berpendapat lain, mohon putusan yang seadil-adilnya (ex aequo et bono).",
  "Demikian jawaban ini saya sampaikan, atas perhatian Majelis Hakim saya ucapkan terima kasih.",
  "Wassalamu'alaikum Wr. Wb.",
  "Xyz, 27 Juli 2026",
  "Hormat saya,",
  "Termohon/Penggugat Rekonvensi",
  "Siti Rahmah",
];
const JAWABAN_REKON = pdf(PAR_JAWABAN_REKON, { kepala: KEPALA_JAWAB, perHalaman: 24 });

// 2. Jawaban dengan eksepsi, oleh kuasa hukum (kop kantor, "klien kami"), cerai gugat, sub-judul berangka Romawi, PRIMAIR/SUBSIDAIR.
const PAR_JAWABAN_EKSEPSI = [
  "KANTOR ADVOKAT DAN KONSULTAN HUKUM",
  "ANDI LAWALATA, S.H. & REKAN",
  "Jl. Contoh Raya No. 12 Kota Xyz, Telp. 0451-421000, email: kantor@contoh.example",
  "Xyz, 5 Agustus 2026",
  "Perihal : Jawaban Tergugat dalam Perkara Nomor 902/Pdt.G/2026/PA.Xyz",
  "Kepada Yth.",
  "Majelis Hakim Pengadilan Agama Xyz",
  "Dengan hormat,",
  "Kami yang bertanda tangan di bawah ini, Andi Lawalata, S.H., Advokat, berdasarkan Surat Kuasa Khusus tanggal 1 Agustus 2026, bertindak untuk dan atas nama klien kami, Rudi bin Hasan, selanjutnya disebut Tergugat, dengan ini mengajukan jawaban sebagai berikut:",
  "I. DALAM EKSEPSI",
  "1. Bahwa gugatan Penggugat kabur (obscuur libel) karena tidak menguraikan secara jelas kapan perselisihan dan pertengkaran itu terjadi;",
  "2. Bahwa gugatan Penggugat kurang pihak karena tidak menarik orang tua Tergugat yang menguasai rumah yang didalilkan sebagai tempat kediaman bersama;",
  "II. DALAM POKOK PERKARA",
  "1. Bahwa apa yang telah diuraikan dalam eksepsi mohon dianggap termuat pula dalam pokok perkara ini;",
  "2. Bahwa Tergugat membantah dalil Penggugat angka 4 yang menyatakan Tergugat tidak memberi nafkah, karena klien kami selalu mengirimkan uang setiap bulan melalui rekening Penggugat;",
  "3. Bahwa Tergugat membantah pula dalil Penggugat angka 5 tentang pisah rumah sejak tahun 2025, karena Tergugat dan Penggugat masih tinggal serumah sampai bulan Juni 2026;",
  "Berdasarkan uraian tersebut di atas, Tergugat mohon kepada Majelis Hakim untuk memutus:",
  "PRIMAIR",
  "DALAM EKSEPSI",
  "Menerima eksepsi Tergugat;",
  "Menyatakan gugatan Penggugat tidak dapat diterima;",
  "DALAM POKOK PERKARA",
  "Menolak gugatan Penggugat untuk seluruhnya;",
  "Membebankan biaya perkara kepada Penggugat;",
  "SUBSIDAIR",
  "Apabila Majelis Hakim berpendapat lain, mohon putusan yang seadil-adilnya (ex aequo et bono).",
  "Hormat kami,",
  "Kuasa Hukum Tergugat",
  "Andi Lawalata, S.H.",
];
const JAWABAN_EKSEPSI = pdf(PAR_JAWABAN_EKSEPSI, { lebar: 84, perHalaman: 40 });

// 3. Replik + jawaban rekonvensi (Pemohon), gaya "Bahwa" tanpa nomor.
const PAR_REPLIK_REKON = [
  "REPLIK PEMOHON DAN JAWABAN REKONVENSI TERGUGAT REKONVENSI",
  "Perkara Nomor 901/Pdt.G/2026/PA.Xyz",
  "Dengan hormat,",
  "Dalam Konvensi",
  "Bahwa Pemohon tetap pada dalil-dalil permohonan semula dan menolak dalil-dalil jawaban Termohon, kecuali yang secara tegas diakui kebenarannya;",
  "Bahwa tidak benar Pemohon sering pulang larut malam tanpa alasan, karena Pemohon bekerja sebagai sopir angkutan antar kota yang jadwalnya tidak tetap; bahwa hal itu telah diketahui Termohon sejak sebelum menikah;",
  "Bahwa Pemohon membantah tidak memberi nafkah, Pemohon tetap memberi nafkah setiap minggu meskipun jumlahnya tidak menentu;",
  "Dalam Rekonvensi",
  "Bahwa Tergugat Rekonvensi bersedia memberikan nafkah iddah kepada Penggugat Rekonvensi, namun hanya sanggup sejumlah Rp1.500.000,00 (satu juta lima ratus ribu rupiah) untuk 3 (tiga) bulan;",
  "Bahwa Tergugat Rekonvensi bersedia memberikan mut'ah berupa uang sejumlah Rp2.000.000,00 (dua juta rupiah) sesuai kemampuan Tergugat Rekonvensi;",
  "Bahwa Tergugat Rekonvensi sanggup memberikan nafkah 2 (dua) orang anak sejumlah Rp800.000,00 (delapan ratus ribu rupiah) setiap bulan;",
  "Berdasarkan hal-hal tersebut di atas, Pemohon mohon kepada Majelis Hakim untuk memutus:",
  "Dalam Konvensi",
  "Mengabulkan permohonan Pemohon;",
  "Memberi izin kepada Pemohon untuk menjatuhkan talak satu raj'i terhadap Termohon di depan sidang Pengadilan Agama Xyz;",
  "Dalam Rekonvensi",
  "Mengabulkan gugatan Penggugat Rekonvensi sebagian sesuai kesanggupan Tergugat Rekonvensi;",
  "Demikian replik ini Pemohon sampaikan.",
  "Pemohon,",
  "Anjas",
];
const REPLIK_REKON = pdf(PAR_REPLIK_REKON, { lebar: 92, perHalaman: 60 });

// 4. Duplik + replik rekonvensi, PDF terpotong keras: kata dipenggal, nomor berdiri sendiri, bulatan font Symbol, kepala berulang 3 halaman.
const DUPLIK_REKON = [
  "DUPLIK KONVENSI DAN REPLIK REKONVENSI",
  "Perkara Nomor 901/Pdt.G/2026/PA.Xyz",
  "DALAM KONVENSI",
  "1.",
  "Bahwa Termohon tetap pada dalil-dalil jawaban semula dan menolak dalil-dalil replik Pemohon, kecuali yang",
  "diakui secara tegas kebenarannya oleh Termohon;",
  "2.",
  "Bahwa tidak benar Pemohon tetap memberi nafkah setiap minggu, karena sejak bulan Januari 2026 Pemohon sama",
  "sekali tidak memberikan nafkah lahir kepada Termohon dan kedua anak Pemohon dan Termohon sehingga ke-",
  "\f- 1 -\fDuplik Termohon Perkara Nomor 901/Pdt.G/2026/PA.Xyz",
  "butuhan sehari-hari ditanggung orang tua Termohon;",
  "DALAM REKONVENSI",
  " Bahwa Penggugat Rekonvensi tetap pada gugatan rekonvensi semula, karena kesanggupan Tergugat Rekonvensi",
  "jauh di bawah kebutuhan hidup anak-anak dan tidak sesuai dengan penghasilan Tergugat Rekonvensi sebagai",
  "sopir yang berpenghasilan kurang lebih Rp4.000.000,00 setiap bulan;",
  " Bahwa Penggugat Rekonvensi menolak kesanggupan mut'ah sejumlah Rp2.000.000,00 karena Penggugat Rekonvensi telah",
  "mendampingi Tergugat Rekonvensi selama 6 (enam) tahun;",
  "\f- 2 -\fDuplik Termohon Perkara Nomor 901/Pdt.G/2026/PA.Xyz",
  "Berdasarkan alasan-alasan tersebut di atas, Termohon mohon Majelis Hakim berkenan memutus sesuai petitum",
  "jawaban dan gugatan rekonvensi Termohon.",
  "Hormat saya,",
  "Termohon Konvensi/Penggugat Rekonvensi",
  "- 3 -",
].join("\n");

// 5. Duplik rekonvensi (jenis e-Court "Rereplik", diunggah Pemohon).
const REREPLIK = pdf(
  [
    "DUPLIK REKONVENSI",
    "Dengan hormat,",
    "Bahwa Tergugat Rekonvensi tetap pada jawaban rekonvensi semula dan menolak seluruh dalil replik rekonvensi Penggugat Rekonvensi;",
    "Bahwa penghasilan Tergugat Rekonvensi sebagai sopir tidak tetap dan rata-rata hanya Rp2.500.000,00 setiap bulan; bahwa Tergugat Rekonvensi masih harus menanggung biaya hidup orang tua Tergugat Rekonvensi;",
    "Bahwa oleh karena itu Tergugat Rekonvensi mohon agar Majelis Hakim menetapkan nafkah iddah, mut'ah, dan nafkah anak sesuai kemampuan Tergugat Rekonvensi;",
    "Demikian duplik rekonvensi ini disampaikan.",
    "Xyz, 6 Agustus 2026",
    "Tergugat Rekonvensi",
  ],
  { lebar: 90 }
);

// 6. Kesimpulan Pemohon dan Termohon.
const KESIMPULAN_P = pdf(
  [
    "KESIMPULAN PEMOHON",
    "Dalam Perkara Nomor 901/Pdt.G/2026/PA.Xyz",
    "Setelah mengikuti seluruh proses persidangan, Pemohon menyampaikan kesimpulan sebagai berikut:",
    "1. Bahwa Pemohon tetap pada dalil-dalil permohonan semula untuk bercerai dengan Termohon;",
    "2. Bahwa dalil permohonan Pemohon telah dikuatkan oleh bukti P.1 sampai dengan P.3 dan keterangan 2 (dua) orang saksi Pemohon;",
    "3. Bahwa mengenai tuntutan rekonvensi, Pemohon tetap pada kesanggupan sebagaimana dalam jawaban rekonvensi;",
    "Berdasarkan hal tersebut, Pemohon mohon Majelis Hakim mengabulkan permohonan Pemohon.",
    "Hormat saya,",
    "Pemohon",
  ],
  { lebar: 90 }
);
const KESIMPULAN_T = pdf(
  [
    "KESIMPULAN TERMOHON",
    "Perkara Nomor 901/Pdt.G/2026/PA.Xyz",
    "DALAM KONVENSI",
    "Bahwa Termohon tetap pada jawaban dan duplik semula;",
    "DALAM REKONVENSI",
    "Bahwa Penggugat Rekonvensi tetap pada gugatan rekonvensi dan mohon dikabulkan seluruhnya, karena Tergugat Rekonvensi mampu membayar sesuai keterangan saksi-saksi;",
    "Demikian kesimpulan ini disampaikan.",
    "Termohon",
  ],
  { lebar: 90 }
);

// 7. Surat tanpa nomor maupun "Bahwa" (paragraf biasa) - bagian awal tidak jelas: ragu.
const JAWABAN_TANPA_PENANDA = [
  "Jawaban Termohon",
  "Saya tidak mau bercerai karena masih sayang dengan suami saya dan anak-anak masih kecil.",
  "Kalau memang mau bercerai saya minta nafkah anak saja.",
].join("\n");

// 8. Arahan pengguna 31 Okt: surat LENGKAP dengan semua bagian bukan-isi - kop, nomor surat, tempat-tanggal, perihal, lampiran, alamat
// tujuan, salam, identitas kuasa bernomor, kalimat kuasa, identitas pihak, pengantar (juga sesudah sub-judul pertama), penutup,
// salam penutup, tanda tangan, tembusan, nomor halaman. Yang boleh tersisa HANYA dalil + petitum.
const PAR_JAWABAN_LENGKAP = [
  "KANTOR HUKUM RAHMAT & REKAN",
  "Advokat - Konsultan Hukum",
  "Jl. Contoh Nomor 7 Kota Xyz, HP 081200000000, surel: rahmat@contoh.example",
  "Nomor : 12/RR/VIII/2026",
  "Lampiran : 1 (satu) berkas",
  "Perihal : Jawaban Tergugat",
  "Xyz, 10 Agustus 2026",
  "Kepada Yth.",
  "Ketua Pengadilan Agama Xyz",
  "Cq. Majelis Hakim yang memeriksa perkara Nomor 903/Pdt.G/2026/PA.Xyz",
  "di -",
  "Xyz",
  "Assalamu'alaikum Warahmatullahi Wabarakatuh,",
  "Dengan hormat,",
  "Yang bertanda tangan di bawah ini:",
  "1. Rahmat Hidayat, S.H., Advokat pada Kantor Hukum Rahmat & Rekan, berkantor di Jl. Contoh Nomor 7 Kota Xyz;",
  "2. Nurul Aini, S.H., M.H., Advokat pada kantor yang sama;",
  "Berdasarkan Surat Kuasa Khusus tanggal 2 Agustus 2026 yang telah didaftarkan di Kepaniteraan Pengadilan Agama Xyz, bertindak untuk dan atas nama:",
  "Nama : Budi Santoso bin Hasan",
  "Umur : 35 tahun",
  "Pekerjaan : Wiraswasta",
  "Alamat : Desa Contoh, Kecamatan Contoh, Kabupaten Contoh",
  "Selanjutnya disebut sebagai Tergugat;",
  "Dengan ini mengajukan jawaban atas gugatan Penggugat tertanggal 1 Juli 2026 sebagai berikut:",
  "DALAM POKOK PERKARA",
  "Perkenankanlah Tergugat menyampaikan jawaban atas dalil-dalil gugatan Penggugat sebagai berikut:",
  "1. Bahwa Tergugat menolak seluruh dalil gugatan Penggugat, kecuali yang secara tegas diakui kebenarannya oleh Tergugat;",
  "2. Bahwa benar Penggugat dan Tergugat menikah pada tanggal 10 Mei 2018 dan telah dikaruniai 1 (satu) orang anak;",
  "3. Bahwa tidak benar Tergugat meninggalkan tempat kediaman bersama, karena yang meninggalkan rumah adalah Penggugat sejak bulan Maret 2026;",
  "Berdasarkan alasan-alasan tersebut di atas, Tergugat mohon kepada Majelis Hakim untuk memutus:",
  "1. Menolak gugatan Penggugat untuk seluruhnya;",
  "2. Membebankan biaya perkara kepada Penggugat;",
  "Atau apabila Majelis Hakim berpendapat lain, mohon putusan yang seadil-adilnya (ex aequo et bono).",
  "Demikian jawaban ini kami sampaikan.",
  "Atas perhatian dan kebijaksanaan Majelis Hakim, kami ucapkan terima kasih.",
  "Wassalamu'alaikum Warahmatullahi Wabarakatuh.",
  "Hormat kami,",
  "Kuasa Hukum Tergugat,",
  "Rahmat Hidayat, S.H.",
  "Nurul Aini, S.H., M.H.",
  "Tembusan:",
  "1. Tergugat;",
  "2. Arsip.",
];
const JAWABAN_LENGKAP = pdf(PAR_JAWABAN_LENGKAP, { lebar: 86, perHalaman: 26, kepala: "Jawaban Tergugat Perkara Nomor 903/Pdt.G/2026/PA.Xyz" });

module.exports = {
  PAR_JAWABAN_LENGKAP,
  JAWABAN_LENGKAP,
  patah,
  pdf,
  PAR_JAWABAN_REKON,
  JAWABAN_REKON,
  JAWABAN_EKSEPSI,
  REPLIK_REKON,
  DUPLIK_REKON,
  REREPLIK,
  KESIMPULAN_P,
  KESIMPULAN_T,
  JAWABAN_TANPA_PENANDA,
  KEPALA_JAWAB,
};
