// Perkara contoh realistis (nama diganti) untuk jenis S6 yang TIDAK punya perkara nyata di SIPP PA Donggala
// (hibah 366, wakaf 367, mafqud dalam Lain-Lain 369, pencegahan/pembatalan, wasiat tambahan, ekonomi syariah dengan damai).
// Dipakai ukur-s6.cjs / laporan-s6.cjs supaya jenis tanpa data nyata tetap terukur - DITANDAI "fixture" di laporan.
// Susunan kalimat meniru posita/petitum yang lazim di PA Donggala; bukan data pihak sungguhan.

const dasar = { tanggalDaftar: "2026-06-01", pihak1: ["Penggugat bin Ayah"], pihak2: ["Tergugat binti Ibu"], rekonvensi: null, akad: [], mediasi: null, terdahulu: [], tglDamai: "" };

module.exports = [
  {
    nama: "Hibah kontradiktoir (lisan, 2 saksi)",
    jenisPerkaraId: 366,
    posita:
      "1. Bahwa almarhum Hasan bin Ali semasa hidupnya memiliki sebidang tanah; 2. Bahwa pada tanggal 12 Mei 2015 almarhum Hasan bin Ali telah menghibahkan sebidang tanah seluas 400 m2 yang terletak di Desa Lolu, Kecamatan Sigi Biromaru, Kabupaten Sigi kepada Tergugat secara lisan di hadapan 2 (dua) orang saksi; 3. Bahwa Penggugat adalah anak kandung dari penghibah; 4. Bahwa Tergugat adalah penerima hibah yang menguasai objek tersebut",
    petitum: "Menyatakan hibah yang dilakukan Hasan bin Ali kepada Tergugat melebihi 1/3 harta warisan; Menghukum Tergugat menyerahkan objek",
    ...dasar,
  },
  {
    nama: "Hibah dengan akta PPAT (permohonan)",
    jenisPerkaraId: 366,
    posita: "Bahwa Pemohon telah menghibahkan sebidang rumah kepada anak Pemohon dengan Akta Hibah Nomor 12/2019 tanggal 3 Maret 2019 di hadapan PPAT Rahmat, S.H.; Bahwa Pemohon adalah penghibah",
    petitum: "Mengabulkan permohonan Pemohon; Menyatakan sah hibah tersebut",
    ...dasar,
    pihak1: ["Burhan bin Daud"],
    pihak2: [],
  },
  {
    nama: "Wakaf kontradiktoir (Akta Ikrar Wakaf)",
    jenisPerkaraId: 367,
    posita:
      "Bahwa Wakif bernama H. Abdullah bin Ibrahim telah mewakafkan sebidang tanah seluas 20 x 30 meter yang terletak di Desa Bora untuk pembangunan masjid; Bahwa ikrar wakaf tersebut dituangkan dalam Akta Ikrar Wakaf Nomor 45/AIW/2010 tanggal 5 Agustus 2010 di hadapan PPAIW Kecamatan Sigi Biromaru; Bahwa Nazhir adalah Pengurus Masjid Al-Ikhlas Desa Bora; Bahwa tanah wakaf tersebut dikuasai oleh Tergugat",
    petitum: "Menyatakan sah wakaf tanah tersebut dan menyerahkan kepada Nazhir",
    ...dasar,
  },
  {
    nama: "Wasiat dibatalkan (melebihi sepertiga)",
    jenisPerkaraId: 365,
    posita:
      "Bahwa Pewasiat Maryam binti Usman membuat surat wasiat tertanggal 27 Juli 2011 yang mewasiatkan sebidang kebun cengkeh seluas 1 hektar kepada Tergugat; Bahwa Penggugat adalah ahli waris dari Pewasiat",
    petitum: "Menyatakan Surat Wasiat tertanggal 27 Juli 2011 melebihi sepertiga harta peninggalan",
    ...dasar,
  },
  {
    nama: "Mafqud (permohonan orang hilang)",
    jenisPerkaraId: 369,
    posita:
      "Perihal: Permohonan Penetapan Mafqud. Bahwa Pemohon adalah istri sah dari Rusli bin Taher; Bahwa Rusli bin Taher telah pergi meninggalkan rumah sejak bulan Maret 2015 dan hingga kini tidak diketahui keberadaannya; Bahwa Pemohon telah berusaha mencari ke keluarga dan kenalan namun tidak berhasil ditemukan; Bahwa sudah 9 (sembilan) tahun tidak ada kabar; Bahwa Pemohon memerlukan penetapan untuk pembagian harta bersama",
    petitum: "Menetapkan Rusli bin Taher sebagai mafqud dan dianggap meninggal secara hukum",
    ...dasar,
    pihak2: [],
  },
  {
    nama: "Pencegahan perkawinan oleh ayah kandung",
    jenisPerkaraId: 342,
    posita:
      "Perihal: Permohonan Pencegahan Perkawinan. Bahwa Pemohon adalah orang tua/ayah kandung dari Rahmawati binti Aidin (calon istri); Bahwa Pemohon tidak menyetujui hubungan anak Pemohon dengan seorang lelaki yang bernama Jufri bin Batria (calon suami); Bahwa pernikahan akan dilangsungkan di Kantor Urusan Agama Kecamatan Marawola",
    petitum: "Memerintahkan Kepala Kantor Urusan Agama Kecamatan Marawola untuk tidak melaksanakan pernikahan antara Rahmawati binti Aidin dengan Jufri bin Batria (calon suami)",
    ...dasar,
    pihak2: [],
  },
  {
    nama: "Pembatalan perkawinan (hamil dari laki-laki lain)",
    jenisPerkaraId: 344,
    posita: "Permohonan Pembatalan Perkawinan. Bahwa Pemohon memastikan Termohon mengandung biologis orang lain",
    petitum: "Membatalkan perkawinan antara Pemohon dengan Termohon",
    ...dasar,
  },
  {
    nama: "Ekonomi syariah gugatan sederhana (damai di hadapan hakim)",
    jenisPerkaraId: 370,
    posita:
      "Bahwa pada Hari Jumat tanggal 24 Februari 2023 PENGGUGAT memberikan fasilitas pembiayaan kepada TERGUGAT sebagaimana tertuang dalam Akad Jual Beli Murabahah Nomor: 006/ULS-MSBV/PP-MRB/II/2023 tanggal 24 Februari 2023; Bahwa TERGUGAT tidak membayar angsuran pinjaman sesuai apa yang diperjanjikan sehingga menjadi kredit macet; Bahwa PENGGUGAT telah memberikan Surat Peringatan kepada TERGUGAT sebanyak 3 (tiga) kali",
    petitum: "Menghukum TERGUGAT untuk membayar lunas seketika seluruh sisa pinjaman sebesar Rp. 61.241.800 (Enam Puluh Satu Juta Dua Ratus Empat Puluh Satu Ribu Delapan Ratus Rupiah) kepada PENGGUGAT",
    ...dasar,
    akad: ["Murabahah"],
    mediasi: { hasil: "Y1", tgl: "2025-07-02", isi: "<p>Pasal 1</p><p>Tergugat mengakui utang dan membayar Rp10.000.000,00 dalam 3 kali angsuran.</p><p>Pasal 2</p><p>Biaya perkara dibebankan kepada Tergugat.</p>" },
  },
  {
    nama: "Hak asuh anak + nafkah anak (Lain-Lain 369 Pdt.G)",
    jenisPerkaraId: 369,
    posita:
      "1. Bahwa setelah perceraian anak Penggugat dan Tergugat yang masih di bawah umur tinggal bersama Penggugat; 2. Bahwa Tergugat tidak pernah memberikan nafkah anak sejak bercerai; 3. Bahwa penghasilan Tergugat sebagai nelayan sekitar Rp 3.500.000 per bulan; 4. Hak Asuh Anak",
    petitum: "Menetapkan hak asuh anak kepada Penggugat; Menghukum Tergugat untuk membayar nafkah anak sebesar Rp. 2.500.000 setiap bulan sampai anak dewasa",
    ...dasar,
  },
];
