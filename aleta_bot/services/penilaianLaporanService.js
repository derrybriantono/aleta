"use strict";

/**
 * ============================================================================
 * LAPORAN PERKARA LIPA - HANYA YANG SUMBERNYA MEMANG ADA DI SIPP
 * ============================================================================
 *
 * Bab 4 katalog meminta dua puluh dua laporan LIPA beserta tiga aspek
 * penilaiannya. Dua belas di antaranya bersumber SIPP dan dikerjakan di sini.
 *
 * ============================================================================
 * KOREKSI - "TIDAK ADA DI MANA PUN" ITU KELIRU
 * ============================================================================
 *
 * Berkas ini sempat menyatakan bahwa data LIPA 14, 15, 16, 18, 19, dan 21
 * "tidak ada di SIPP, dan tidak ada di mana pun yang dapat dibaca ALETA".
 * Bagian pertamanya benar; bagian keduanya SALAH, dan salahnya sepenuhnya
 * karena saya hanya memeriksa SIPP lalu menyimpulkan tentang seluruh dunia.
 *
 * Datanya ada di aplikasi pendukung laporan yang dipakai satuan kerja
 * berdampingan dengan SIPP - lengkap dengan tabelnya sendiri untuk sidang di
 * luar gedung, prodeo, Pos Bantuan Hukum, dan pelayanan terpadu. Keempatnya
 * kini dikerjakan di penilaianDipa04Service, beserta satu butir yang
 * menyandingkan angka laporan prodeo dengan angka SIPP.
 *
 * Yang benar-benar belum punya sumber tinggal: eksaminasi putusan, stok
 * blangko akta cerai, penanganan pengaduan, dan keuangan titipan pihak ketiga.
 *
 * Mengarang angkanya jauh lebih buruk daripada membiarkannya kosong. Laporan
 * LIPA dikirim ke Pengadilan Tinggi Agama dan dipakai menilai satuan kerja;
 * angka yang tersusun dari sumber yang tidak ada akan dipertanggungjawabkan
 * seseorang yang tidak pernah tahu dari mana angkanya datang.
 *
 * ============================================================================
 * YANG DINILAI KELENGKAPAN BAHANNYA, BUKAN ANGKA LAPORANNYA
 * ============================================================================
 *
 * ALETA tidak menyusun laporan LIPA - itu pekerjaan operator laporan, dan
 * bentuk laporannya tidak diubah. Yang dinilai di sini apakah SIPP memuat
 * bahan yang laporan itu butuhkan: baris yang seharusnya ada, dengan kolom
 * yang membuatnya dapat dihitung.
 *
 * Laporan yang disusun dari baris yang separuh kolomnya kosong akan tetap
 * berbentuk laporan - lengkap dengan angkanya - dan tidak ada yang dapat
 * membedakannya dari laporan yang benar.
 */

const kerangka = require("./kerangkaPenilaianService");
const kelengkapan = require("./kelengkapanBarisPenilaian");

/**
 * Dua belas LIPA yang bahannya ada di SIPP.
 *
 * Kolom wajibnya dipilih dari yang benar-benar dipakai laporannya - bukan
 * seluruh kolom tabelnya. Menuntut seluruh kolom terisi akan membuat tiap
 * laporan bernilai rendah karena kolom yang memang tidak berlaku bagi
 * perkaranya, dan angka yang selalu merah berhenti dibaca.
 */
const LAPORAN = [
  {
    kode: "LP01",
    kunci: "lipaKeadaanPerkara",
    judul: "LIPA 1 — Keadaan Perkara",
    keterangan:
      "Bahan laporan keadaan perkara: penerimaan, penyelesaian, dan sisa. Yang dinilai apakah tiap perkara punya nomor, tanggal pendaftaran, dan jenis - tiga hal yang tanpanya perkara tidak dapat masuk hitungan mana pun.",
    tabel: "perkara",
    wajib: ["nomor_perkara", "tanggal_pendaftaran", "jenis_perkara_nama"],
  },
  {
    kode: "LP02",
    kunci: "lipaPerkaraBanding",
    judul: "LIPA 2 — Perkara Dimohonkan Banding",
    keterangan:
      "Bahan laporan upaya hukum banding: tanggal permohonan dan siapa pemohonnya.",
    tabel: "perkara_banding",
    wajib: ["nomor_perkara_pn", "permohonan_banding", "pemohon_banding"],
  },
  {
    kode: "LP03",
    kunci: "lipaPerkaraKasasi",
    judul: "LIPA 3 — Perkara Dimohonkan Kasasi",
    keterangan: "Bahan laporan upaya hukum kasasi.",
    tabel: "perkara_kasasi",
    wajib: ["nomor_perkara_pn", "permohonan_kasasi", "pemohon_kasasi"],
  },
  {
    kode: "LP04",
    kunci: "lipaPerkaraPeninjauanKembali",
    judul: "LIPA 4 — Perkara Dimohonkan Peninjauan Kembali",
    keterangan:
      "Bahan laporan peninjauan kembali. Alasan PK ikut wajib - tanpa itu laporannya tidak dapat menyebutkan dasar permohonannya.",
    tabel: "perkara_pk",
    wajib: ["nomor_perkara_pn", "permohonan_pk", "pemohon_pk", "alasan_pk"],
  },
  {
    kode: "LP05",
    kunci: "lipaEksekusi",
    judul: "LIPA 5 — Pelaksanaan Putusan atau Eksekusi",
    keterangan: "Bahan laporan permohonan dan pelaksanaan eksekusi.",
    tabel: "perkara_eksekusi",
    wajib: ["nomor_perkara_pn", "eksekusi_putusan"],
  },
  {
    kode: "LP06",
    kunci: "lipaKegiatanHakim",
    judul: "LIPA 6 — Kegiatan Hakim",
    keterangan:
      "Bahan laporan beban majelis: tiap perkara harus punya hakim yang tercatat beserta tanggal penetapannya. Perkara tanpa majelis tidak dapat dibebankan kepada siapa pun.",
    tabel: "perkara_hakim_pn",
    wajib: ["hakim_id", "hakim_nama", "tanggal_penetapan"],
  },
  {
    kode: "LP07",
    kunci: "lipaKeuanganPerkara",
    judul: "LIPA 7 — Keuangan Perkara",
    keterangan:
      "Bahan laporan keuangan perkara: tiap perkara harus punya baris biaya beserta besarannya. Nol dianggap belum terisi - panjar nol pada perkara yang bukan prodeo berarti barisnya belum diisi, bukan biayanya nihil.",
    tabel: "perkara_biaya",
    wajib: ["jumlah"],
    nolBerartiKosong: true,
  },
  {
    kode: "LP12",
    kunci: "lipaPelaksanaanMediasi",
    judul: "LIPA 12 — Pelaksanaan Mediasi",
    keterangan:
      "Bahan laporan mediasi: penetapan penunjukan mediator dan nama mediatornya.",
    tabel: "perkara_mediasi",
    wajib: ["penetapan_penunjukan_mediator", "mediator_text"],
  },
  {
    kode: "LP13",
    kunci: "lipaPenerbitanAktaCerai",
    judul: "LIPA 13 — Penerbitan Akta Cerai",
    keterangan:
      "Bahan laporan penerbitan akta cerai: nomor, tanggal, dan jenis cerainya.",
    tabel: "perkara_akta_cerai",
    wajib: ["nomor_akta_cerai", "tgl_akta_cerai", "jenis_cerai"],
  },
  {
    kode: "LP15",
    kunci: "lipaPembebasanBiaya",
    judul: "LIPA 15 — Pembebasan Biaya Perkara (Prodeo)",
    keterangan:
      "Bahan laporan prodeo. Hanya perkara yang bertanda prodeo yang dihitung; laporannya dibiayai DIPA 04 dan angkanya dipertanggungjawabkan tersendiri.",
    tabel: "perkara",
    saring: "p.prodeo = 1",
    wajib: ["nomor_perkara", "tanggal_pendaftaran", "jenis_perkara_nama"],
  },
  {
    kode: "LP17",
    kunci: "lipaBiayaProses",
    judul: "LIPA 17 — Biaya Proses Penyelesaian Perkara",
    keterangan:
      "Bahan laporan biaya proses: tiap pengeluaran harus punya jenis dan besarannya, sebab laporan ini merinci penggunaan - bukan hanya jumlah akhirnya.",
    tabel: "perkara_biaya",
    wajib: ["jenis_biaya_id", "jumlah"],
    nolBerartiKosong: true,
  },
  {
    kode: "LP22",
    kunci: "lipaDispensasiKawin",
    judul: "LIPA 22 — Dispensasi Kawin",
    keterangan:
      "Bahan laporan dispensasi kawin. Disaring dari jenis perkaranya, sebab laporan ini dipisahkan tersendiri oleh Badilag dan angkanya diawasi terpisah.",
    tabel: "perkara",
    saring: "p.jenis_perkara_nama LIKE '%ispensasi%'",
    wajib: ["nomor_perkara", "tanggal_pendaftaran"],
  },
];

let sudahDidaftar = false;

function daftarkanSemua() {
  if (sudahDidaftar) return LAPORAN.map((x) => x.kunci);
  LAPORAN.forEach((x) => {
    if (kerangka.ambil(x.kunci)) return;
    kerangka.daftarkan(kelengkapan.definisi({ ...x, versiRumus: "lipa-v1" }));
  });
  sudahDidaftar = true;
  return LAPORAN.map((x) => x.kunci);
}

function lupakanSemua() {
  sudahDidaftar = false;
}

function sambungan() {
  const peta = {};
  LAPORAN.forEach((x) => {
    peta[x.kode] = x.kunci;
  });
  return peta;
}

module.exports = { LAPORAN, daftarkanSemua, lupakanSemua, sambungan };
