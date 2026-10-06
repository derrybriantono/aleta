"use strict";

/**
 * Status satu perkara, dari pendaftaran sampai produk pengadilan.
 *
 * ============================================================================
 * SATU PERKARA, SATU LAYAR
 * ============================================================================
 *
 * Jadwal Sidang menjawab "hari ini sidang apa saja". Layar ini menjawab
 * pertanyaan yang berbeda: "perkara nomor sekian itu bagaimana keadaannya" -
 * pertanyaan yang datang dari meja pelayanan, dari pimpinan, dan dari majelis
 * yang menyiapkan berkas.
 *
 * Karena itu isinya menyusuri perkara dari awal: didaftarkan kapan, sudah
 * berjalan berapa lama, siapa yang menanganinya, sudah sampai sidang keberapa,
 * sudah diputus atau belum, dan sesudah putus sudah sampai mana.
 *
 * ============================================================================
 * PENCARIAN MENERIMA ANGKA SAJA
 * ============================================================================
 *
 * Petugas mengingat "419", bukan "419/Pdt.G/2026/PA.Dgl". Nomor urut saja
 * dapat cocok pada beberapa perkara - Pdt.G, Pdt.P, tahun berbeda - dan
 * itulah sebabnya pencarian mengembalikan DAFTAR, bukan langsung membuka satu.
 * Membuka yang pertama begitu saja berarti menampilkan perkara yang keliru
 * tanpa ada yang menyadarinya.
 *
 * ============================================================================
 * SIPP HANYA DIBACA
 * ============================================================================
 *
 * Seluruh kueri di berkas ini SELECT, dan nilai dari luar selalu masuk sebagai
 * parameter.
 */

const db = require("../db_config");
const { cleanText, normalizeCaseNumber } = require("./ecourtTextService");
const sippJadwalSidangService = require("./sippJadwalSidangService");
const sippKonteksService = require("./sippKonteksService");
const ecourtStoreService = require("./ecourtStoreService");
const ecourtPanggilanService = require("./ecourtPanggilanService");
const penilaianPerkaraService = require("./penilaianPerkaraService");
const analisaPerkaraService = require("./analisaPerkaraService");
const penilaianSippService = require("./penilaianSippService");
const sippTahapanService = require("./sippTahapanService");
const putusanEcourtService = require("./putusanEcourtService");
// Majelis PEMERIKSA dan majelis ikrar talak - satu sumber aturan dengan rekap
// petugas dan eviden SKP. Lihat petugasStatusPerkara di bawah.
const majelisPemeriksaService = require("./majelisPemeriksaService");
// Sebutan para pihak punya SATU sumber - kembaran lib/sebutan-pihak.ts yang
// dijaga uji pembanding. Tidak ada pola sebutan baru yang ditulis di sini.
const sebutanPihakService = require("./sebutanPihakService");
// Tanggal hari ini menurut zona PENGADILAN, bukan zona mesin.
const { tanggalHariIni } = require("./periodePenilaianService");
// Pengenal galat habis waktu dan batas waktunya - satu sumber dengan penjaga
// kueri di db_config, bukan pola kedua yang ditulis ulang di sini.
const queryMetricsService = require("./queryMetricsService");
const queryGuardService = require("./queryGuardService");

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

function isoTanggal(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    const bulan = String(nilai.getMonth() + 1).padStart(2, "0");
    const hari = String(nilai.getDate()).padStart(2, "0");
    return `${nilai.getFullYear()}-${bulan}-${hari}`;
  }
  return cleanText(nilai).slice(0, 10);
}

/** Selisih hari kalender antara dua tanggal, atau null. */
function selisihHari(dari, sampai) {
  if (!dari) return null;
  const urai = (teks) => {
    const cocok = String(teks).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!cocok) return null;
    return new Date(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3]));
  };
  const awal = urai(dari);

  // Hari ini dipotong ke tengah malam, sama seperti tanggal yang diurai.
  // Memakai jam sekarang membandingkan tengah malam dengan waktu berjalan,
  // dan pembulatannya menambah satu hari begitu lewat tengah hari - perkara
  // yang didaftarkan pagi ini tercatat "1 hari berjalan" pada sore yang sama.
  const hariIni = new Date();
  const akhir = sampai
    ? urai(sampai)
    : new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate());

  if (!awal || !akhir) return null;
  return Math.round((akhir - awal) / 86400000);
}

/**
 * Mencari perkara.
 *
 * ============================================================================
 * SATU KOTAK UNTUK BANYAK BENTUK MASUKAN
 * ============================================================================
 *
 * Petugas mengetik apa yang diingatnya, dan yang diingat berbeda-beda: nomor
 * urutnya saja ("419"), sepotong nomor perkara, nama pihak, atau jenis
 * perkaranya. Menuntut mereka memilih dulu "cari berdasarkan apa" hanya
 * memindahkan pekerjaan menebak dari program ke orang.
 *
 * Karena itu satu kotak menerima semuanya, dan bentuk masukannya dikenali
 * sendiri:
 *
 *   angka 1-5 digit   -> nomor urut perkara, cocok persis
 *   angka 6+ digit    -> nomor identitas (NIK) atau telepon pihak, dan nomor
 *                        kutipan akta nikah bentuk baru (16 digit)
 *   ada garis miring  -> sepotong nomor perkara lebih dahulu; HANYA bila tidak
 *                        satu pun nomor perkara cocok, barulah nomor akta
 *                        cerai, nomor perkara/putusan banding, kasasi, PK, dan
 *                        nomor kutipan akta nikah bentuk lama ("008/01/III/2018")
 *                        - sebabnya di cabang "nomor" cariHalamanInti()
 *   selain itu        -> dicoba pada nomor perkara, jenis perkara, nama
 *                        pihak, DAN nama kuasa hukum sekaligus; bila kosong,
 *                        diperdalam sampai alamat, KUA, pertimbangan, amar,
 *                        petugas, dan agenda sidang
 *
 * Perluasan 25 September 2026 (butir 8 permintaan pengguna) - sebelum itu
 * nomor akta cerai dicari sebagai nomor perkara dan selalu nihil, NIK dicari
 * sebagai nomor urut dan selalu nihil, dan nama kuasa hukum tidak dijangkau
 * sama sekali.
 *
 * ============================================================================
 * SARINGAN MEMPERSEMPIT, BUKAN MENGGANTIKAN
 * ============================================================================
 *
 * Saringan jenis, status, tahun, dan alur perkara dapat dipakai TANPA kata
 * cari - itulah cara menjawab "perkara cerai gugat 2025 yang belum putus ada
 * berapa". Bila keduanya diisi, keduanya berlaku bersamaan.
 *
 * ============================================================================
 * NAMA PIHAK DICARI LEWAT SUBKUERI EXISTS
 * ============================================================================
 *
 * Menyambung langsung ke tabel pihak menggandakan baris perkara sebanyak
 * pihaknya, dan perkara dengan lima tergugat akan muncul lima kali. EXISTS
 * menjawab pertanyaan yang sebenarnya - "apakah ADA pihak yang namanya
 * begini" - tanpa menggandakan apa pun.
 */
/**
 * Keadaan relaas, sebagai daftar tertutup.
 *
 * ket_temu bukan "bertemu atau tidak" melainkan CARA pemanggilannya. Artinya
 * TIDAK ditebak dari teks bebas yang menyertainya, melainkan diambil dari
 * komentar kolom ket_temu pada skema SIPP - satu-satunya definisi resmi yang
 * ada. Dibaca apa adanya dari information_schema salinan satker:
 *
 *   Y  bertemu                   T  tidak bertemu
 *   S  SURAT TERCATAT (pos)      E  elektronik
 *   R  radio                     M  media massa cetak/elektronik
 *   W  web/papan pengumuman      P  papan pengumuman pemda
 *      pengadilan
 *
 * Empat yang terakhir adalah cara memanggil pihak yang tidak diketahui
 * keberadaannya - itulah yang dimaksud "ghaib".
 *
 * ==========================================================================
 * S ADALAH SALURAN, BUKAN KEGAGALAN
 * ==========================================================================
 *
 * Sandi S pernah dibaca di sini sebagai "gagal". Itu salah, dan salahnya
 * besar. Terukur di salinan satker 25 September 2026:
 *
 *   ket_temu = 'S'                    3.104 baris / 1.431 perkara
 *     di antaranya status_pos = 1     1.603 baris /   829 perkara
 *     (komentar kolom status_pos: "1. Berhasil 2.tidak berhasil")
 *     di antaranya status_pos = 2       177 baris
 *
 * Keterangan hasilnya pun berbunyi terkirim, bukan gagal: "telah diterima
 * langsung oleh pihak penerima" 70 baris, "DITERIMA LANGSUNG OLEH PIHAK
 * PENERIMA" 67, "Diterima yang bersangkutan" 49, "Diterima orang serumah"
 * 49. Membaca S sebagai gagal karena itu mengarang 1.431 perkara tunggakan
 * panggilan dari perkara yang justru BERHASIL dipanggil lewat pos.
 *
 * Kegagalan yang sungguhan ada di tempat lain, dan sudah punya kuncinya:
 * status_pos = 2, yaitu relaas yang dikembalikan - 177 baris / 147 perkara,
 * dan `retur` di bawah sudah menjaringnya (216 baris / 180 perkara bersama
 * ket_hasil_relaas yang menyebut retur). Tidak ada sandi ket_temu yang
 * berarti "pemanggilan gagal"; yang paling dekat, T, berarti juru sita tidak
 * bertemu orangnya lalu MENERUSKAN relaas lewat pemerintah desa - 2.667
 * baris yang keterangannya berbunyi "tidak bertemu dengan tergugat ...
 * selanjutnya panggilan ini saya serahkan kepada Kantor Desa" - sehingga
 * panggilannya sah, bukan gagal.
 */
const RELAAS_SYARAT = {
  retur:
    `EXISTS (SELECT 1 FROM perkara_pelaksanaan_relaas r
              WHERE r.perkara_id = p.perkara_id
                AND (r.ket_hasil_relaas LIKE '%retur%' OR r.status_pos = 2))`,
  // Dipanggil lewat surat tercatat - saluran, bukan hasil. Kuncinya dulu
  // bernama `gagal`; sebabnya di blok penjelasan di atas.
  surat_tercatat:
    "EXISTS (SELECT 1 FROM perkara_pelaksanaan_relaas r WHERE r.perkara_id = p.perkara_id AND r.ket_temu = 'S')",
  ghaib:
    `EXISTS (SELECT 1 FROM perkara_pelaksanaan_relaas r
              WHERE r.perkara_id = p.perkara_id AND r.ket_temu IN ('R', 'M', 'W', 'P'))`,
  bertemu:
    "EXISTS (SELECT 1 FROM perkara_pelaksanaan_relaas r WHERE r.perkara_id = p.perkara_id AND r.ket_temu = 'Y')",
  // Belum ada satu pun relaas tercatat - beda dengan relaas yang dikembalikan.
  tanpa_relaas:
    "NOT EXISTS (SELECT 1 FROM perkara_pelaksanaan_relaas r WHERE r.perkara_id = p.perkara_id)",
};

/**
 * Kunci lama yang masih mungkin dikirim layar yang belum diperbarui.
 *
 * Tanpa peta ini, layar yang masih mengirim relaas=gagal kehilangan
 * saringannya TANPA GALAT - hasilnya seluruh register, dan itu cacat yang
 * sama jenisnya dengan yang sedang dibetulkan. Diarahkan ke `retur`, yaitu
 * kegagalan yang sungguhan, bukan ke `surat_tercatat`: orang yang memilih
 * "Pemanggilan gagal" menanyakan relaas yang tidak sampai, dan jawaban yang
 * benar untuk pertanyaan itu 180 perkara - bukan 1.431.
 */
const RELAAS_KUNCI_LAMA = { gagal: "retur" };

/**
 * Membuang apostrof dari sebuah kolom sebelum dicocokkan.
 *
 * Dipakai pada kolom teks panjang saja - pertimbangan dan amar - sebab di
 * situlah kalimat berapostrof berada. Byte E2 80 99 adalah apostrof miring
 * U+2019 yang benar-benar tersimpan di SIPP; 0x27 apostrof biasa; 0x60
 * aksen balik yang kadang terketik menggantikannya.
 */
function tanpaApostrof(kolom) {
  return `REPLACE(REPLACE(REPLACE(${kolom}, 0xE28099, ''), 0x27, ''), 0x60, '')`;
}

/** Kata carinya diperlakukan sama dengan kolomnya. */
function bersihApostrof(teks) {
  return String(teks || "").replace(/[\u2019'`\u00b4]/g, "");
}

/**
 * ============================================================================
 * TABEL PIHAK DISEBUT SATU PER SATU, BUKAN LEWAT v_pihak_perkara
 * ============================================================================
 *
 * v_pihak_perkara adalah UNION berpembeda atas tabel-tabel di bawah, dan
 * MariaDB harus MEMBENTUKNYA UTUH lebih dahulu - termasuk subkueri
 * status_pihak untuk tiap baris - sebelum saringan apa pun berlaku. Terukur
 * atas sipp_donggala 25 September 2026: mencari "419" (nomor urut, empat
 * perkara) memakan 11,9 detik hanya karena keterangan kecocokannya menanyai
 * view itu dengan LIKE '%419%'; mencari nama pihak 19,8 detik; dan lapis
 * dalam melewati batas 15 detik penjaga kueri sehingga pencariannya GAGAL.
 *
 * Daftarnya PERSIS tabel yang dihimpun view itu, dibaca dari definisinya di
 * sipp_donggala: pihak1 sampai pihak5 dan pihak korban. Menjangkau lebih
 * sedikit akan diam-diam menghilangkan perkara yang dulu ketemu - dan itulah
 * sebabnya kesetaraan himpunannya diukur (lihat laporan pengukuran) sebelum
 * view ini ditinggalkan di berkas ini.
 */
const TABEL_PIHAK = Object.freeze([
  "perkara_pihak1",
  "perkara_pihak2",
  "perkara_pihak3",
  "perkara_pihak4",
  "perkara_pihak5",
  "perkara_pihak_korban",
]);

/** Kolom pihak yang boleh dicocokkan - daftar tertutup, bukan dari peramban. */
const KOLOM_PIHAK = Object.freeze({ nama: "nama", alamat: "alamat" });

/**
 * Syarat "ada pihak yang kolomnya cocok" - satu EXISTS per tabel pihak.
 *
 * Tiap kolom memakan SATU tanda tanya per tabel; pemanggil memasang nilainya
 * lewat nilaiPihak() dengan urutan yang sama.
 */
function syaratPihak(kolom) {
  const daftarKolom = kolom.map((k) => KOLOM_PIHAK[k]).filter(Boolean);
  return (
    "(" +
    TABEL_PIHAK.map(
      (tabel, i) =>
        `EXISTS (SELECT 1 FROM ${tabel} ph${i}
                  WHERE ph${i}.perkara_id = p.perkara_id
                    AND (${daftarKolom.map((k) => `ph${i}.${k} LIKE ?`).join(" OR ")}))`
    ).join("\n          OR ") +
    ")"
  );
}

/** Nilai isian untuk syaratPihak(): tiap tabel, tiap kolom, nilai yang sama. */
function nilaiPihak(suka, jumlahKolom = 1) {
  const hasil = [];
  for (let i = 0; i < TABEL_PIHAK.length; i += 1) {
    for (let k = 0; k < jumlahKolom; k += 1) hasil.push(suka);
  }
  return hasil;
}

/**
 * Syarat "ada pihak yang NIK-nya atau teleponnya cocok".
 *
 * Nomor identitas tidak tersimpan pada perkara_pihakN, melainkan pada tabel
 * induk `pihak` - dijembatani lewat pihak_id. Kolomnya memang bernama
 * nomor_indentitas (salah eja di skema SIPP, bukan di sini).
 */
function syaratIdentitasPihak() {
  return (
    "(" +
    TABEL_PIHAK.map(
      (tabel, i) =>
        `EXISTS (SELECT 1 FROM ${tabel} pi${i}
                   JOIN pihak id${i} ON id${i}.id = pi${i}.pihak_id
                  WHERE pi${i}.perkara_id = p.perkara_id
                    AND (id${i}.nomor_indentitas LIKE ? OR id${i}.telepon LIKE ?))`
    ).join("\n          OR ") +
    ")"
  );
}

/** Pagu pihak yang dijemput lebih dahulu untuk pencarian NIK/telepon. */
const PAGU_PIHAK_IDENTITAS = 2000;

/**
 * Batas panjang nomor urut perkara.
 *
 * Nomor urut tertinggi di satker 833 (terukur 25 September 2026); lima digit
 * memberi ruang 99.999 perkara setahun. Angka yang lebih panjang tidak
 * mungkin nomor urut - NIK 16 digit, nomor kutipan akta nikah bentuk baru 16
 * digit, telepon 10-13 digit - dan sebelum perluasan ini semuanya dicari
 * sebagai nomor urut lalu nihil tanpa penjelasan.
 */
const PANJANG_NOMOR_URUT = 5;

/**
 * Pagu baris per halaman.
 *
 * Dinaikkan dari 200 ke 500 atas permintaan tampilan daftar/rinci (butir 7).
 * Lebih dari itu tidak lagi dibaca orang - dipakai `lewati` untuk halaman
 * berikutnya.
 */
const PAGU_BARIS = 500;

/**
 * Mencatat bagian yang gagal dibaca, TIDAK menelannya.
 *
 * Hasil pencariannya tetap dikembalikan - keterangan tambahan yang hilang
 * tidak boleh menghilangkan perkara yang sudah ketemu - tetapi galatnya
 * masuk log dan namanya dikirim ke layar lewat `ruasTakTerbaca`. Tanpa itu,
 * kolom kuasa yang kosong karena tabelnya tak terbaca tidak dapat dibedakan
 * dari perkara yang memang tanpa kuasa.
 */
function catatTakTerbaca(daftar, nama, error) {
  const pesan = String((error && error.message) || error || "").slice(0, 200);
  console.warn(`[sippStatusPerkara] ${nama} tidak terbaca: ${pesan}`);
  if (Array.isArray(daftar) && !daftar.includes(nama)) daftar.push(nama);
}

/**
 * ============================================================================
 * KOSAKATA: KATA YANG BUKAN TEKS, MELAINKAN KEADAAN
 * ============================================================================
 *
 * "verstek", "banding", "retur" tidak pernah tertulis di nomor perkara
 * maupun nama pihak. Mencarinya sebagai teks selalu nihil, dan nihilnya
 * tidak dapat dibedakan dari perkaranya-memang-tidak-ada.
 *
 * Kuncinya daftar TERTUTUP dan dicocokkan utuh, bukan disambung: kata yang
 * tidak dikenali jatuh ke pencarian teks biasa, bukan menjadi bagian
 * perintah SQL.
 */
const KOSAKATA_CARI = {
  verstek: { label: "Putusan verstek", sql: "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.putusan_verstek = 'Y')" },
  "bukan verstek": { label: "Bukan verstek", sql: "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.putusan_verstek = 'T')" },
  banding: { label: "Ada banding", sql: "EXISTS (SELECT 1 FROM perkara_banding b WHERE b.perkara_id = p.perkara_id)" },
  kasasi: { label: "Ada kasasi", sql: "EXISTS (SELECT 1 FROM perkara_kasasi k WHERE k.perkara_id = p.perkara_id)" },
  pk: { label: "Ada peninjauan kembali", sql: "EXISTS (SELECT 1 FROM perkara_pk k WHERE k.perkara_id = p.perkara_id)" },
  "peninjauan kembali": { label: "Ada peninjauan kembali", sql: "EXISTS (SELECT 1 FROM perkara_pk k WHERE k.perkara_id = p.perkara_id)" },
  "upaya hukum": {
    label: "Ada upaya hukum",
    sql: `(EXISTS (SELECT 1 FROM perkara_banding b WHERE b.perkara_id = p.perkara_id)
           OR EXISTS (SELECT 1 FROM perkara_kasasi k WHERE k.perkara_id = p.perkara_id)
           OR EXISTS (SELECT 1 FROM perkara_pk q WHERE q.perkara_id = p.perkara_id))`,
  },
};

/** Kunci kosakata yang meminjam daftar tertutup yang sudah ada. */
const KOSAKATA_PINJAM = [
  ["retur", "Relaas retur", () => RELAAS_SYARAT.retur],
  // "gagal panggil" diarahkan ke relaas yang DIKEMBALIKAN, bukan ke sandi S.
  // Dulu kata ini memulangkan 1.431 perkara yang dipanggil lewat surat
  // tercatat - 829 di antaranya ber-status_pos = 1, alias berhasil.
  ["gagal panggil", "Relaas dikembalikan", () => RELAAS_SYARAT.retur],
  ["surat tercatat", "Dipanggil lewat surat tercatat", () => RELAAS_SYARAT.surat_tercatat],
  ["ghaib", "Dipanggil sebagai ghaib", () => RELAAS_SYARAT.ghaib],
  ["belum ada relaas", "Belum ada relaas", () => RELAAS_SYARAT.tanpa_relaas],
  ["e-court", "Perkara e-Court", () => ECOURT_SYARAT.ya],
  ["ecourt", "Perkara e-Court", () => ECOURT_SYARAT.ya],
  ["lewat 3 bulan", "Belum putus lewat 3 bulan", () => UMUR_SYARAT.lewat3bulan],
  ["lewat 5 bulan", "Belum putus lewat 5 bulan", () => UMUR_SYARAT.lewat5bulan],
];

/**
 * Umur perkara yang belum putus.
 *
 * Angka bulannya HARUS dari daftar tertutup: INTERVAL di MySQL tidak dapat
 * diparameterkan, sehingga angka yang datang dari peramban akan menjadi
 * bagian teks perintah.
 *
 * Lima bulan adalah ambang SEMA 2/2014 - inilah pertanyaan yang ditanyakan
 * pengawasan tiap bulan, dan sebelumnya tidak dapat ditanyakan sama sekali.
 */
const UMUR_SYARAT = {
  lewat3bulan:
    `NOT EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan IS NOT NULL)
     AND p.tanggal_pendaftaran < DATE_SUB(CURDATE(), INTERVAL 3 MONTH)`,
  lewat5bulan:
    `NOT EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan IS NOT NULL)
     AND p.tanggal_pendaftaran < DATE_SUB(CURDATE(), INTERVAL 5 MONTH)`,
};

/** Perkara masuk lewat e-Court atau didaftarkan di meja. */
const ECOURT_SYARAT = {
  ya: "EXISTS (SELECT 1 FROM perkara_efiling_id k WHERE k.perkara_id = p.perkara_id)",
  tidak: "NOT EXISTS (SELECT 1 FROM perkara_efiling_id k WHERE k.perkara_id = p.perkara_id)",
};

/** Kunci umur perkara yang diterima, untuk ditampilkan di layar. */
const UMUR_PENCARIAN = [
  { kunci: "lewat3bulan", label: "Belum putus, lewat 3 bulan" },
  { kunci: "lewat5bulan", label: "Belum putus, lewat 5 bulan (SEMA 2/2014)" },
];

/** Kunci relaas yang diterima, untuk ditampilkan di layar. */
const RELAAS_PENCARIAN = [
  { kunci: "retur", label: "Relaas retur" },
  // Bukan lagi "Pemanggilan gagal": sandi yang disaringnya berarti SURAT
  // TERCATAT, dan 829 dari 1.431 perkaranya berhasil diterima.
  { kunci: "surat_tercatat", label: "Dipanggil lewat surat tercatat" },
  { kunci: "ghaib", label: "Dipanggil sebagai ghaib" },
  { kunci: "bertemu", label: "Bertemu langsung" },
  { kunci: "tanpa_relaas", label: "Belum ada relaas" },
];

/** Jenis putusan yang benar-benar ada di register, untuk pilihan di layar. */
const PUTUSAN_PENCARIAN = [
  "Dikabulkan",
  "Ditolak",
  "Tidak Dapat Diterima",
  "Dicabut",
  "Digugurkan",
  "Dicoret dari Register",
];

/**
 * Memotong sepenggal teks di sekitar kata yang dicari.
 *
 * Pertimbangan hukum panjangnya bisa ribuan huruf. Menampilkannya utuh di
 * kartu hasil berarti kartunya tidak dapat dibaca sama sekali; menampilkan
 * awalnya saja berarti bagian yang dicari justru tidak kelihatan.
 */
function penggalan(teks, kata, lebar = 70) {
  const isiTeks = String(teks || "").replace(/\s+/g, " ").trim();
  const cari = String(kata || "").trim();
  if (!isiTeks) return "";
  if (!cari) return isiTeks.slice(0, lebar * 2);

  const posisi = isiTeks.toLowerCase().indexOf(cari.toLowerCase());
  if (posisi < 0) return isiTeks.slice(0, lebar * 2);

  const mulai = Math.max(0, posisi - lebar);
  const akhir = Math.min(isiTeks.length, posisi + cari.length + lebar);
  return (mulai > 0 ? "…" : "") + isiTeks.slice(mulai, akhir) + (akhir < isiTeks.length ? "…" : "");
}

/**
 * NIK atau telepon untuk keterangan "cocok karena": yang tampak HANYA angka
 * yang diketik petugas sendiri, sisanya disamarkan "*".
 *
 * ============================================================================
 * SEBABNYA
 * ============================================================================
 *
 * Kata bebas enam digit ke atas dicocokkan SEBAGIAN ke NIK dan telepon. Enam
 * digit pertama NIK adalah kode wilayah: terukur 26 September 2026 atas
 * sipp_donggala, "720325" memulangkan 100 perkara (dan masih ada lagi) dengan
 * 95 NIK enam belas digit UTUH milik 88 orang di keterangan cocoknya - ikut ke
 * "Muat semua" (500) dan ke lembar cetak. Itu bertentangan dengan aturan yang
 * sudah berlaku di ALETA: identitasPihakService menyamarkan NIK dan telepon
 * di PELADEN, bukan di layar.
 *
 * Yang dibiarkan tampak justru yang diketik, bukan empat depan dan tiga
 * belakang seperti identitasPihakService.samarkan: angka yang diketik sudah
 * diketahui pengetiknya, jadi menampakkannya tidak membuka apa pun - dan
 * itulah yang menjelaskan MENGAPA perkara itu muncul. Angka di luarnya milik
 * orang lain yang kebetulan berawalan sama.
 */
function samarkanKecualiDiketik(nomor, diketik) {
  const teks = cleanText(nomor);
  if (!teks) return "";
  const kata = cleanText(diketik);
  const posisi = kata ? teks.indexOf(kata) : -1;
  if (posisi < 0) return "*".repeat(teks.length);
  return "*".repeat(posisi) + kata + "*".repeat(teks.length - posisi - kata.length);
}

/**
 * ============================================================================
 * MENJELASKAN MENGAPA SEBUAH PERKARA MUNCUL
 * ============================================================================
 *
 * Kartu hasil sebelumnya hanya memuat nomor, jenis, tanggal daftar, dan
 * keadaan putusan. Saat yang dicari nama juru sita, alamat desa, atau sebuah
 * kalimat di pertimbangan hukum, tidak satu pun dari keempatnya menyebut
 * kata yang diketik - dan petugas menatap daftar berisi dua puluh nomor
 * perkara tanpa tahu mana yang benar-benar dimaksud.
 *
 * Dicari SESUDAH perkaranya ketemu, dibatasi pada perkara yang memang
 * dikembalikan - satu kueri untuk tiap jenis keterangan, bukan satu kueri
 * untuk tiap baris.
 */
async function lampirkanCocok(hasil, kriteria, takTerbaca = []) {
  const daftarId = hasil.map((x) => x.perkaraId).filter(Boolean);
  if (daftarId.length === 0) return;

  const peta = new Map(hasil.map((x) => [x.perkaraId, x]));
  const isian = daftarId.map(() => "?").join(", ");

  const tambah = (perkaraId, medan, nilaiCocok) => {
    const baris = peta.get(String(perkaraId));
    if (!baris || !nilaiCocok) return;
    // Satu keterangan per medan sudah cukup menjelaskan. Perkara dengan
    // sepuluh pihak yang semuanya cocok tidak perlu sepuluh lencana.
    if (baris.cocok.some((x) => x.medan === medan)) return;
    baris.cocok.push({ medan, nilai: String(nilaiCocok).slice(0, 200) });
  };

  const jalankan = async (label, sql, params) => {
    try {
      return await runQuery(sql, params);
    } catch (error) {
      // SIPP versi lain bisa saja tidak punya tabelnya. Keterangan yang
      // hilang tidak boleh menghilangkan hasil pencariannya - tetapi juga
      // tidak boleh hilang dalam diam.
      catatTakTerbaca(takTerbaca, `cocok:${label}`, error);
      return [];
    }
  };

  /**
   * Pihak dari keenam tabel pihak, disaring DI DALAM tiap cabang.
   *
   * Nilai isiannya diulang per cabang: daftar id lalu kata carinya. Kolomnya
   * dari KOLOM_PIHAK yang tertutup.
   */
  const cariDiPihak = (kolom, suka) => {
    const k = KOLOM_PIHAK[kolom];
    const cabang = TABEL_PIHAK.map(
      (tabel) =>
        `SELECT t.perkara_id AS perkaraId, t.${k} AS nilai, t.nama AS nama
           FROM ${tabel} t
          WHERE t.perkara_id IN (${isian}) AND t.${k} LIKE ?`
    ).join("\n         UNION ALL ");
    const params = [];
    for (let i = 0; i < TABEL_PIHAK.length; i += 1) params.push(...daftarId, suka);
    return { sql: cabang, params };
  };

  const kataBebas = cleanText(kriteria.kata);
  const caraKata = String(kriteria.caraKata || "");
  // Kata bebas dicocokkan ke nama pihak dan kuasa HANYA bila memang dicari
  // sebagai teks. Dulu "419" pun ditanyakan ke nama pihak dengan LIKE
  // '%419%' - satu kueri lagi yang tidak pernah menemukan apa pun.
  const kataTeks = caraKata === "teks" ? kataBebas : "";
  const pihakDicari = cleanText(kriteria.namaPihak) || kataTeks;
  // Bila pencariannya diperdalam, kata bebasnya juga berlaku untuk alamat,
  // KUA, pertimbangan, amar, dan agenda sidang.
  const kataDalam = cleanText(kriteria.kataDalam);

  const pekerjaan = [];

  if (pihakDicari) {
    const { sql, params } = cariDiPihak("nama", `%${pihakDicari}%`);
    pekerjaan.push(
      jalankan("Pihak", `SELECT u.perkaraId, u.nama FROM (${sql}) u`, params).then((baris) =>
        baris.forEach((x) => tambah(x.perkaraId, "Pihak", x.nama))
      )
    );
  }

  if (cleanText(kriteria.alamatPihak) || kataDalam) {
    const alamat = cleanText(kriteria.alamatPihak) || kataDalam;
    const { sql, params } = cariDiPihak("alamat", `%${alamat}%`);
    pekerjaan.push(
      jalankan("Alamat", `SELECT u.perkaraId, u.nilai AS alamat FROM (${sql}) u`, params).then((baris) =>
        baris.forEach((x) => tambah(x.perkaraId, "Alamat", penggalan(x.alamat, alamat)))
      )
    );
  }

  // Nama kuasa hukum - dijangkau lapis cepat kata bebas sejak 25 September
  // 2026. Seluruh kuasa yang pernah tercatat, bukan hanya yang aktif: yang
  // mencari nama advokat ingin tahu perkara mana saja yang pernah ia pegang.
  if (kataTeks) {
    pekerjaan.push(
      jalankan(
        "Kuasa",
        `SELECT k.perkara_id AS perkaraId, k.nama AS nama
           FROM perkara_pengacara k
          WHERE k.perkara_id IN (${isian}) AND k.nama LIKE ?`,
        [...daftarId, `%${kataTeks}%`]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, "Kuasa", x.nama)))
    );
  }

  // Agenda sidang - hanya bila diperdalam, sama dengan syarat pencariannya.
  if (kataDalam) {
    pekerjaan.push(
      jalankan(
        "Agenda sidang",
        `SELECT j.perkara_id AS perkaraId, j.agenda AS agenda
           FROM perkara_jadwal_sidang j
          WHERE j.perkara_id IN (${isian}) AND j.agenda LIKE ?
          ORDER BY j.tanggal_sidang DESC`,
        [...daftarId, `%${kataDalam}%`]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, "Agenda sidang", x.agenda)))
    );
  }

  // Nomor bergaris miring: nomor perkara sudah tampil di kartunya sendiri,
  // jadi yang dijelaskan hanya nomor LAIN yang cocok - akta cerai, banding,
  // kasasi, PK, akta nikah. Tanpa ini, petugas yang mengetik nomor akta
  // cerai melihat perkara yang nomornya sama sekali tidak mirip.
  //
  // HANYA bila perkaranya memang ketemu lewat nomor lain (tahap kedua cabang
  // "nomor"). Perkara yang ketemu lewat nomor perkaranya sendiri tidak diberi
  // keterangan akta nikah yang kebetulan juga memuat "/2019" - keterangan itu
  // akan menyebut alasan yang bukan alasannya.
  const nomorLainDicari = caraKata === "nomor" && Boolean(kriteria.nomorLain);
  if (nomorLainDicari && kataBebas) {
    const suka = `%${kataBebas}%`;
    pekerjaan.push(
      jalankan(
        "Akta cerai",
        `SELECT ac.perkara_id AS perkaraId, ac.nomor_akta_cerai AS nomor
           FROM perkara_akta_cerai ac
          WHERE ac.perkara_id IN (${isian}) AND ac.nomor_akta_cerai LIKE ?`,
        [...daftarId, suka]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, "Akta cerai", x.nomor))),
      jalankan(
        "Nomor banding",
        `SELECT b.perkara_id AS perkaraId,
                CASE WHEN b.nomor_perkara_banding LIKE ? THEN b.nomor_perkara_banding
                     ELSE b.nomor_putusan_banding END AS nomor
           FROM perkara_banding b
          WHERE b.perkara_id IN (${isian})
            AND (b.nomor_perkara_banding LIKE ? OR b.nomor_putusan_banding LIKE ?)`,
        [suka, ...daftarId, suka, suka]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, "Nomor banding", x.nomor))),
      jalankan(
        "Nomor kasasi",
        `SELECT k.perkara_id AS perkaraId,
                CASE WHEN k.nomor_perkara_kasasi LIKE ? THEN k.nomor_perkara_kasasi
                     ELSE k.nomor_putusan_kasasi END AS nomor
           FROM perkara_kasasi k
          WHERE k.perkara_id IN (${isian})
            AND (k.nomor_perkara_kasasi LIKE ? OR k.nomor_putusan_kasasi LIKE ?)`,
        [suka, ...daftarId, suka, suka]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, "Nomor kasasi", x.nomor))),
      jalankan(
        "Nomor PK",
        `SELECT q.perkara_id AS perkaraId,
                CASE WHEN q.nomor_perkara_pk LIKE ? THEN q.nomor_perkara_pk
                     ELSE q.nomor_putusan_pk END AS nomor
           FROM perkara_pk q
          WHERE q.perkara_id IN (${isian})
            AND (q.nomor_perkara_pk LIKE ? OR q.nomor_putusan_pk LIKE ?)`,
        [suka, ...daftarId, suka, suka]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, "Nomor PK", x.nomor)))
    );
  }

  // Nomor kutipan akta nikah: bentuk lama bergaris miring, bentuk baru 16
  // digit - jadi dijelaskan pada kedua cara itu.
  if ((nomorLainDicari || caraKata === "identitas") && kataBebas) {
    pekerjaan.push(
      jalankan(
        "Akta nikah",
        `SELECT dn.perkara_id AS perkaraId, dn.no_kutipan_akta_nikah AS nomor
           FROM perkara_data_pernikahan dn
          WHERE dn.perkara_id IN (${isian}) AND dn.no_kutipan_akta_nikah LIKE ?`,
        [...daftarId, `%${kataBebas}%`]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, "Akta nikah", x.nomor)))
    );
  }

  // NIK dan telepon pihak. Nilainya menyebut NAMA pihaknya juga - nomor enam
  // belas digit saja tidak menjelaskan siapa yang dicari. Nomornya sendiri
  // DISAMARKAN kecuali angka yang diketik - lihat samarkanKecualiDiketik().
  if (caraKata === "identitas" && kataBebas) {
    const suka = `%${kataBebas}%`;
    const cabang = TABEL_PIHAK.map(
      (tabel) =>
        `SELECT t.perkara_id AS perkaraId, t.nama AS nama,
                ip.nomor_indentitas AS nik, ip.telepon AS telepon
           FROM ${tabel} t
           JOIN pihak ip ON ip.id = t.pihak_id
          WHERE t.perkara_id IN (${isian})
            AND (ip.nomor_indentitas LIKE ? OR ip.telepon LIKE ?)`
    ).join("\n         UNION ALL ");
    const params = [];
    for (let i = 0; i < TABEL_PIHAK.length; i += 1) params.push(...daftarId, suka, suka);
    pekerjaan.push(
      jalankan("Nomor identitas", `SELECT u.perkaraId, u.nama, u.nik, u.telepon FROM (${cabang}) u`, params).then(
        (baris) =>
          baris.forEach((x) => {
            const nik = cleanText(x.nik);
            const telepon = cleanText(x.telepon);
            if (nik.includes(kataBebas)) {
              tambah(x.perkaraId, "Nomor identitas", `${samarkanKecualiDiketik(nik, kataBebas)} - ${cleanText(x.nama)}`);
            }
            if (telepon.includes(kataBebas)) {
              tambah(x.perkaraId, "Telepon", `${samarkanKecualiDiketik(telepon, kataBebas)} - ${cleanText(x.nama)}`);
            }
          })
      )
    );
  }

  const jabatan = [
    // kataDalam ikut: lapis dalam menjangkau ketiga jabatan ini, dan tanpa
    // itu perkara yang ketemu lewat nama hakim tampil tanpa satu keterangan.
    [cleanText(kriteria.hakim) || cleanText(kriteria.petugas) || kataDalam, "perkara_hakim_pn", "hakim_nama", "Hakim"],
    [cleanText(kriteria.panitera) || cleanText(kriteria.petugas) || kataDalam, "perkara_panitera_pn", "panitera_nama", "Panitera Pengganti"],
    [cleanText(kriteria.jurusita) || cleanText(kriteria.petugas) || kataDalam, "perkara_jurusita", "jurusita_nama", "Juru Sita"],
  ];
  for (const [dicari, tabel, kolom, label] of jabatan) {
    if (!dicari) continue;
    pekerjaan.push(
      jalankan(
        label,
        `SELECT t.perkara_id AS perkaraId, t.${kolom} AS nama
           FROM ${tabel} t
          WHERE t.perkara_id IN (${isian}) AND t.${kolom} LIKE ?`,
        [...daftarId, `%${dicari}%`]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, label, x.nama)))
    );
  }

  if (cleanText(kriteria.pertimbangan) || kataDalam) {
    const kataPtb = cleanText(kriteria.pertimbangan) || kataDalam;
    pekerjaan.push(
      jalankan(
        "Pertimbangan",
        `SELECT ph.perkara_id AS perkaraId, ph.pertimbangan_hukum AS teks
           FROM perkara_pertimbangan_hukum ph
          WHERE ph.perkara_id IN (${isian}) AND ph.pertimbangan_hukum LIKE ?`,
        [...daftarId, `%${kataPtb}%`]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, "Pertimbangan", penggalan(x.teks, kataPtb))))
    );
  }

  if (cleanText(kriteria.amar) || kataDalam) {
    const kataAmar = cleanText(kriteria.amar) || kataDalam;
    pekerjaan.push(
      jalankan(
        "Amar",
        `SELECT pu.perkara_id AS perkaraId, pu.amar_putusan AS teks
           FROM perkara_putusan pu
          WHERE pu.perkara_id IN (${isian}) AND pu.amar_putusan LIKE ?`,
        [...daftarId, `%${kataAmar}%`]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, "Amar", penggalan(x.teks, kataAmar))))
    );
  }

  if (cleanText(kriteria.kua) || kataDalam) {
    const kataKua = cleanText(kriteria.kua) || kataDalam;
    pekerjaan.push(
      jalankan(
        "KUA",
        `SELECT dn.perkara_id AS perkaraId, dn.kua_tempat_nikah AS kua
           FROM perkara_data_pernikahan dn
          WHERE dn.perkara_id IN (${isian}) AND dn.kua_tempat_nikah LIKE ?`,
        [...daftarId, `%${kataKua}%`]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, "KUA", x.kua)))
    );
  }

  await Promise.all(pekerjaan);
}

/**
 * Perkara yang NOMOR PERKARANYA memuat sepotong kata - dijemput lewat indeks
 * nomor_perkara saja, tanpa menyentuh tabelnya.
 *
 * Syarat "p.nomor_perkara LIKE '%12/%'" yang ditempel ke kueri utama membuat
 * MariaDB menyisir indeks tanggal_pendaftaran menurut urutan hasil sambil
 * membaca BARIS perkara satu per satu untuk memeriksa nomornya (EXPLAIN: type
 * index, key tanggal_pendaftaran) - untuk potongan yang jarang cocok itu
 * berarti hampir seluruh tabel 60 MB dibaca acak dari cakram. Terukur 26
 * September 2026 atas sipp_donggala, kueri halaman "12/": 2,6 detik; dengan
 * daftar id yang dijemput di sini 0,7 detik (lihat PAGU_ID_NOMOR). Kueri ini
 * hanya menyisir indeks nomor_perkara (EXPLAIN: Using index).
 *
 * Alias tabelnya sengaja bukan `p`: yang beralias `p` hanya kueri utama.
 */
async function idPerkaraBerNomor(suka) {
  const rows = await runQuery(
    `SELECT pn.perkara_id AS perkaraId
       FROM perkara pn
      WHERE pn.nomor_perkara LIKE ?`,
    [suka]
  );
  return [...new Set(rows.map((r) => Number(r.perkaraId)).filter((n) => n > 0))];
}

/**
 * Pagu daftar id nomor perkara yang dipakai sebagai IN.
 *
 * Di bawahnya, syarat "p.perkara_id IN (daftar)" dibaca lewat PRIMARY
 * (range) - cepat. Mulai 1.000 unsur MariaDB mengubah daftar IN menjadi tabel
 * turunan (in_predicate_conversion_threshold = 1000, dibaca dari salinan
 * satker), dan tiap id dibaca acak lewat PRIMARY: lambat. Sebaliknya potongan
 * yang cocok pada ribuan perkara tidak perlu daftar - syarat LIKE-nya sendiri
 * cepat, sebab baris cocok segera bertemu di urutan tanggal. Terukur 26
 * September 2026 atas sipp_donggala, kueri halaman saja (median 3 kali):
 *
 *   kata      id cocok   LIKE      daftar IN
 *   "419/"         13    2.996 ms     153 ms
 *   "33/"         106    2.412 ms     664 ms
 *   "12/"         111    2.649 ms     738 ms
 *   "/2021"       721      983 ms      68 ms
 *   "2/Pdt"     1.022       67 ms   5.060 ms
 *   "7/"        1.913      316 ms   4.749 ms
 *   "5/"        2.215       38 ms   5.661 ms
 *
 * Jawaban kedua bentuk sama pada seluruh kata di atas (diperiksa).
 */
const PAGU_ID_NOMOR = 999;

/**
 * Perkara yang NOMOR LAINNYA cocok: akta cerai, banding, kasasi, PK, dan
 * kutipan akta nikah. Satu kueri, lima tabel kecil, disisir sekali.
 *
 * Galatnya TIDAK ditelan: ini bagian dari pencarian itu sendiri, bukan
 * keterangan tambahan - hasil tanpa bagian ini akan tampak lengkap padahal
 * tidak.
 */
async function idPerkaraBerNomorLain(suka) {
  const rows = await runQuery(
    `SELECT u.perkaraId
       FROM (SELECT ac.perkara_id AS perkaraId FROM perkara_akta_cerai ac
              WHERE ac.nomor_akta_cerai LIKE ?
             UNION SELECT bd.perkara_id FROM perkara_banding bd
              WHERE bd.nomor_perkara_banding LIKE ? OR bd.nomor_putusan_banding LIKE ?
             UNION SELECT ks.perkara_id FROM perkara_kasasi ks
              WHERE ks.nomor_perkara_kasasi LIKE ? OR ks.nomor_putusan_kasasi LIKE ?
             UNION SELECT pq.perkara_id FROM perkara_pk pq
              WHERE pq.nomor_perkara_pk LIKE ? OR pq.nomor_putusan_pk LIKE ?
             UNION SELECT an.perkara_id FROM perkara_data_pernikahan an
              WHERE an.no_kutipan_akta_nikah LIKE ?) u`,
    [suka, suka, suka, suka, suka, suka, suka, suka]
  );
  return [...new Set(rows.map((r) => Number(r.perkaraId)).filter((n) => n > 0))];
}

/**
 * Perkara yang pihaknya ber-NIK/bertelepon cocok, atau yang nomor kutipan
 * akta nikahnya cocok.
 *
 * Pihaknya dijemput SEKALI dari tabel induk `pihak` (terukur 0,43 detik per
 * sisiran di salinan satker - menyambungnya ke dalam keenam EXISTS menyisirnya
 * enam kali), lalu perkaranya dari keenam tabel pihak lewat pihak_id.
 *
 * Memulangkan null bila pihak yang cocok mentok di pagu - pemanggil lalu
 * memakai bentuk sambungan yang lengkap, supaya tidak ada yang terpotong.
 */
async function idPerkaraBerIdentitas(suka) {
  const idPihak = (
    await runQuery(
      `SELECT ip.id AS id
         FROM pihak ip
        WHERE ip.nomor_indentitas LIKE ? OR ip.telepon LIKE ?
        LIMIT ${PAGU_PIHAK_IDENTITAS}`,
      [suka, suka]
    )
  )
    .map((r) => Number(r.id))
    .filter((n) => n > 0);
  if (idPihak.length >= PAGU_PIHAK_IDENTITAS) return null;

  const idPerkara = new Set();
  if (idPihak.length > 0) {
    const isianPihak = idPihak.map(() => "?").join(", ");
    const cabang = TABEL_PIHAK.map(
      (tabel) => `SELECT t.perkara_id AS perkaraId FROM ${tabel} t WHERE t.pihak_id IN (${isianPihak})`
    ).join("\n             UNION ");
    const params = [];
    for (let i = 0; i < TABEL_PIHAK.length; i += 1) params.push(...idPihak);
    const dariPihak = await runQuery(`SELECT u.perkaraId FROM (${cabang}) u`, params);
    for (const r of dariPihak) idPerkara.add(Number(r.perkaraId));
  }

  const dariAkta = await runQuery(
    `SELECT an.perkara_id AS perkaraId
       FROM perkara_data_pernikahan an
      WHERE an.no_kutipan_akta_nikah LIKE ?`,
    [suka]
  );
  for (const r of dariAkta) idPerkara.add(Number(r.perkaraId));

  return [...idPerkara].filter((n) => n > 0);
}

/**
 * ============================================================================
 * GALAT HABIS WAKTU DIKATAKAN DALAM BAHASA ORANGNYA
 * ============================================================================
 *
 * Penjaga kueri di db_config memutus kueri yang lewat batas waktunya (bawaan
 * 15 detik), dan driver mysql melaporkannya sebagai "Query inactivity timeout"
 * (PROTOCOL_SEQUENCE_TIMEOUT). Pesan itu dulu diteruskan apa adanya sampai ke
 * kotak galat layar Status Perkara: terukur 26 September 2026 atas bot hidup,
 * kata bebas "Sudarmin" 17 detik lalu layar menulis persis "Query inactivity
 * timeout" - bahasa Inggris, dan tidak menyebut apa yang dapat dilakukan.
 *
 * Yang dikenali sebagai habis waktu memakai pengenal yang SAMA dengan
 * pencatat kueri (queryMetricsService.isTimeoutError), dan angka detiknya dari
 * pengaturan penjaga yang sedang berlaku. Galat lain diteruskan APA ADANYA -
 * tidak ada yang ditelan. Pesan mentahnya tetap masuk log.
 */
const KODE_PENCARIAN_HABIS_WAKTU = "PENCARIAN_HABIS_WAKTU";

function galatPencarian(error) {
  if (!error || error.code === KODE_PENCARIAN_HABIS_WAKTU) return error;
  if (!queryMetricsService.isTimeoutError(error)) return error;
  const detik = Math.round(queryGuardService.getGuardConfig().timeoutMs / 1000);
  console.warn(
    `[sippStatusPerkara] pencarian habis waktu (${String(error.code || "")}): ${String(error.message || error).slice(0, 200)}`
  );
  const galat = new Error(
    `Pencarian dihentikan karena melewati batas ${detik} detik untuk membaca SIPP. ` +
      "Coba lagi, atau persempit dengan Saringan lain atau rentang waktu."
  );
  galat.code = KODE_PENCARIAN_HABIS_WAKTU;
  galat.cause = error;
  return galat;
}

/** Pesan galat pencarian untuk dikirim rute: habis waktu diterjemahkan. */
function pesanGalatPencarian(error) {
  const galat = galatPencarian(error);
  return String((galat && galat.message) || galat || "").slice(0, 300);
}

/**
 * Satu halaman hasil pencarian, beserta keterangan halamannya.
 *
 *   perkara         baris hasil, masing-masing sudah dilengkapi ruas rinci
 *   adaLagi         masih ada baris SESUDAH halaman ini
 *   lewati, batas   halaman yang benar-benar dipakai (sesudah dipagari)
 *   lapis           "cepat" / "dalam" untuk kata bebas teks, "" selain itu
 *   ruasTakTerbaca  bagian yang gagal dibaca - lihat catatTakTerbaca()
 *
 * cariPerkara() di bawah tetap memulangkan larik saja, supaya pemanggil lama
 * tidak berubah. Galat habis waktu dilempar sebagai galat berbahasa Indonesia
 * berkode PENCARIAN_HABIS_WAKTU - lihat galatPencarian().
 */
async function cariPerkaraHalaman(kataCari, pilihan = {}) {
  try {
    return await cariHalamanInti(kataCari, pilihan);
  } catch (error) {
    throw galatPencarian(error);
  }
}

async function cariHalamanInti(kataCari, pilihan = {}) {
  const {
    batas = 25,
    // Mulai dari baris ke berapa (halaman berikutnya). Urutannya tetap urutan
    // yang sama - tanggal daftar terbaru lebih dahulu - jadi halaman tidak
    // saling menumpuk.
    lewati = 0,
    // Hanya untuk uji: tanggal "hari ini" yang dipakai umur perkara dan
    // pembagian sidang terakhir/berikut. Rute tidak pernah mengirimnya.
    hariIni = "",
    jenisPerkara = "",
    status = "",
    tahun = "",
    alurPerkaraId = 0,
    sejak = "",
    sampai = "",
    namaPihak = "",
    petugas = "",
    // --- perluasan ---
    hakim = "",
    panitera = "",
    jurusita = "",
    statusPutusan = "",
    pertimbangan = "",
    amar = "",
    verstek = "",
    alamatPihak = "",
    kua = "",
    relaas = "",
    putusSejak = "",
    putusSampai = "",
    umur = "",
    ecourt = "",
    // --- tag dan rentang waktu (diminta pengguna 25 September 2026) ---
    // Daftar perkara_id yang sudah disaring tagPerkaraService. Dijemput di
    // luar supaya kueri di bawah tidak perlu menempelkan EXISTS atas tabel
    // yang tidak berindeks - terukur 2,98 detik menjadi 0,44 detik.
    idTag = null,
    // Rentang waktu dari panel tag, sudah berbentuk { sql, nilai } susunan
    // tagPerkaraService. Nama kolomnya datang dari katalog DASAR_TANGGAL yang
    // dibekukan di sana, tidak pernah dari peramban; tanggalnya tetap lewat
    // tanda tanya. Dipakai supaya "diputus triwulan ini" tetap menyaring
    // walaupun tidak ada satu pun tag yang dinyalakan.
    lingkupTanggal = null,
  } = pilihan || {};

  const kata = cleanText(kataCari);
  const syarat = [];
  const nilai = [];
  // Bagian yang gagal dibaca - dikirim ke layar, tidak ditelan.
  const ruasTakTerbaca = [];

  const batasBaris = Math.min(Math.max(Math.floor(Number(batas)) || 25, 1), PAGU_BARIS);
  const lewatiBaris = Math.min(Math.max(Math.floor(Number(lewati)) || 0, 0), 1000000);
  const tanggalAcuan = /^\d{4}-\d{2}-\d{2}$/.test(String(hariIni || ""))
    ? String(hariIni)
    : tanggalHariIni("Asia/Makassar");

  const kosong = () => ({
    perkara: [],
    adaLagi: false,
    lewati: lewatiBaris,
    batas: batasBaris,
    lapis: "",
    ruasTakTerbaca,
  });

  // Cara kata bebas dicari - ditentukan di sini, dijalankan di bawah.
  //   ""          tidak ada kata bebas
  //   "tepat"     nomor urut, satu kueri saja
  //   "identitas" angka panjang: NIK/telepon pihak, akta nikah 16 digit
  //   "nomor"     bergaris miring: nomor perkara, akta cerai, banding,
  //               kasasi, PK, akta nikah bentuk lama
  //   "kosakata"  kata yang berarti keadaan, bukan teks
  //   "teks"      dicari cepat dulu, diperdalam bila kosong
  let caraKata = "";
  let labelKosakata = "";

  if (kata) {
    const kataKecil = kata.toLowerCase();
    const pinjam = KOSAKATA_PINJAM.find(([kunci]) => kunci === kataKecil);
    const langsung = KOSAKATA_CARI[kataKecil];

    if (/^\d+$/.test(kata) && kata.length <= PANJANG_NOMOR_URUT) {
      // Nomor urut saja - dicocokkan persis, bukan LIKE. "41" tidak boleh
      // memunculkan perkara 410 sampai 419.
      //
      // ======================================================================
      // RENTANG INDEKS DI DEPAN, SUPAYA INDEKS nomor_perkara TERPAKAI
      // ======================================================================
      //
      // SUBSTRING_INDEX sendirian tidak dapat memakai indeks apa pun, dan
      // rencana MariaDB atasnya menyisir SELURUH register lewat indeks
      // tanggal_pendaftaran - tiap baris dibaca acak dari tabel perkara yang
      // 60 MB. Terukur atas sipp_donggala 25 September 2026 (cakram HDD,
      // kolam InnoDB 16 MB): "419" 3,4 detik; dengan rentang di depannya
      // 0,57 detik, 13 baris yang sama.
      //
      // Rentangnya TIGA, bukan satu awalan "7%". Awalan itu memuat 70-79 dan
      // 700-799 - kira-kira 260 baris menurut taksiran - sehingga MariaDB
      // menilai lebih murah menyisir indeks tanggal sambil menunggu 26 baris
      // cocok, padahal yang sungguh cocok hanya 20: seluruh register
      // tersisir lagi (EXPLAIN atas "7": type index, key tanggal_pendaftaran).
      // Ketiga rentang di bawah menaksir 21 baris, dan rencananya kembali
      // rentang nomor_perkara.
      //
      // Ketiganya MENCAKUP SELURUH baris yang lolos SUBSTRING_INDEX = "7":
      // collation SIPP mengabaikan spasi di ujung, jadi awalannya "7" disusul
      // nol atau lebih spasi - diikuti garis miring ("7/%"), diikuti spasi
      // ("7 %"), atau tanpa garis miring sama sekali (= "7"). Kata ini hanya
      // angka, jadi tidak ada wildcard LIKE yang dapat ikut terbawa. Syarat
      // SUBSTRING_INDEX TETAP dipasang, jadi jawabannya tidak berubah sedikit
      // pun - "7 x/..." yang lolos "7 %" dibuang olehnya.
      syarat.push(
        `((p.nomor_perkara LIKE ? OR p.nomor_perkara LIKE ? OR p.nomor_perkara = ?)
          AND SUBSTRING_INDEX(p.nomor_perkara, '/', 1) = ?)`
      );
      nilai.push(`${kata}/%`, `${kata} %`, kata, kata);
      caraKata = "tepat";
    } else if (/^\d+$/.test(kata)) {
      // Angka yang terlalu panjang untuk nomor urut: NIK/telepon pihak atau
      // nomor kutipan akta nikah 16 digit. Dicocokkan sebagian (LIKE), sebab
      // yang diingat petugas sering hanya ekor NIK-nya.
      //
      // Perkaranya DIJEMPUT lebih dahulu lalu dipakai sebagai daftar id -
      // pola yang sama dengan tag. Syarat EXISTS di dalam kueri utama
      // dievaluasi untuk tiap baris register yang disisir, dan untuk nomor
      // yang jarang cocok itu berarti SELURUH register.
      const suka = `%${kata}%`;
      const idCocok = await idPerkaraBerIdentitas(suka);
      if (idCocok === null) {
        // Pihak yang cocok terlalu banyak untuk dijemput (sepotong NIK yang
        // pendek) - bentuk sambungan yang lengkap dipakai. Lebih lambat,
        // tetapi tidak ada perkara yang terpotong diam-diam.
        syarat.push(
          `(${syaratIdentitasPihak()}
            OR EXISTS (SELECT 1 FROM perkara_data_pernikahan an
                        WHERE an.perkara_id = p.perkara_id AND an.no_kutipan_akta_nikah LIKE ?))`
        );
        for (let i = 0; i < TABEL_PIHAK.length; i += 1) nilai.push(suka, suka);
        nilai.push(suka);
      } else if (idCocok.length === 0) {
        // Tidak ada yang cocok: nol baris, dan kueri utama tidak perlu jalan.
        return kosong();
      } else {
        syarat.push(`p.perkara_id IN (${idCocok.map(() => "?").join(", ")})`);
        nilai.push(...idCocok);
      }
      caraKata = "identitas";
    } else if (kata.includes("/")) {
      // Bukan hanya nomor perkara: nomor akta cerai ("376/AC/2026/PA.Dgl"),
      // nomor banding, kasasi, PK, dan nomor kutipan akta nikah bentuk lama
      // juga bergaris miring. Dulu semuanya dicari sebagai nomor perkara dan
      // nihil - 4.527 perkara punya nomor akta cerai yang tidak dapat dicari.
      //
      // Syaratnya BELUM dipasang di sini - dipasang saat dijalankan, sebab
      // nomor perkara dan nomor lain dicari BERTAHAP (lihat cabang "nomor" di
      // bawah), sama seperti lapis cepat dan lapis dalam kata teks.
      caraKata = "nomor";
    } else if (langsung) {
      syarat.push(langsung.sql);
      labelKosakata = langsung.label;
      caraKata = "kosakata";
    } else if (pinjam) {
      syarat.push(pinjam[2]());
      labelKosakata = pinjam[1];
      caraKata = "kosakata";
    } else {
      // Syaratnya BELUM dipasang di sini - dipasang saat dijalankan, sebab
      // lapis cepat dan lapis dalam memakai syarat yang berbeda.
      caraKata = "teks";
    }
  }

  if (cleanText(jenisPerkara)) {
    syarat.push("p.jenis_perkara_nama LIKE ?");
    nilai.push(`%${cleanText(jenisPerkara)}%`);
  }

  if (cleanText(namaPihak)) {
    syarat.push(syaratPihak(["nama"]));
    nilai.push(...nilaiPihak(`%${cleanText(namaPihak)}%`));
  }

  // Petugas: hakim, panitera, atau juru sita mana pun pada perkara itu.
  if (cleanText(petugas)) {
    syarat.push(
      `(EXISTS (SELECT 1 FROM perkara_hakim_pn hk
                 WHERE hk.perkara_id = p.perkara_id AND hk.hakim_nama LIKE ?)
        OR EXISTS (SELECT 1 FROM perkara_panitera_pn pn
                    WHERE pn.perkara_id = p.perkara_id AND pn.panitera_nama LIKE ?)
        OR EXISTS (SELECT 1 FROM perkara_jurusita js
                    WHERE js.perkara_id = p.perkara_id AND js.jurusita_nama LIKE ?))`
    );
    const namaPetugas = `%${cleanText(petugas)}%`;
    nilai.push(namaPetugas, namaPetugas, namaPetugas);
  }

  // Petugas per jabatan. `petugas` mencari ketiganya sekaligus; ketiga
  // isian di bawah mencari satu jabatan saja - itu yang dibutuhkan saat
  // pertanyaannya "perkara siapa saja yang dipegang juru sita ini", bukan
  // "perkara yang menyebut nama ini di mana pun".
  const perJabatan = [
    [hakim, "perkara_hakim_pn hk", "hk.hakim_nama"],
    [panitera, "perkara_panitera_pn pn", "pn.panitera_nama"],
    [jurusita, "perkara_jurusita js", "js.jurusita_nama"],
  ];
  for (const [isian, tabel, kolom] of perJabatan) {
    const teks = cleanText(isian);
    if (!teks) continue;
    // Nama tabel dan kolom berasal dari daftar tertutup di atas, tidak
    // pernah dari peramban.
    syarat.push(
      `EXISTS (SELECT 1 FROM ${tabel} WHERE ${tabel.split(" ")[1]}.perkara_id = p.perkara_id AND ${kolom} LIKE ?)`
    );
    nilai.push(`%${teks}%`);
  }

  // Jenis putusan - Dikabulkan, Ditolak, Dicabut, dan seterusnya.
  //
  // ==========================================================================
  // NAMANYA DIBACA LEWAT JOIN, SAMA DENGAN KARTU HASILNYA
  // ==========================================================================
  //
  // Saringan ini dulu hanya membaca pu.status_putusan_nama, dan kolom itu
  // kosong pada 9.474 dari 9.993 baris - 94,8%, terukur di salinan satker 25
  // September 2026. Akibatnya satu layar menjawab dua angka untuk satu
  // pertanyaan: chip tag dan kartu hasil membaca namanya lewat JOIN,
  // sedangkan kotak isian ini tidak.
  //
  //   "Dicabut"     lewat kolom nama saja  46   lewat JOIN    535
  //   "Dikabulkan"  lewat kolom nama saja 447   lewat JOIN  8.909
  //
  // Kolom namanya TIDAK dibuang - ia masih terisi pada 519 baris, dan di
  // situlah satu-satunya tempat namanya tercatat bila status_putusan_id
  // menunjuk baris yang sudah tidak ada. Karena itu COALESCE keduanya: kolom
  // nama lebih dahulu bila terisi, lalu nama dari JOIN.
  //
  // CONVERT ... USING utf8 pada KEDUA sisinya, bukan salah satu:
  // perkara_putusan.status_putusan_nama ber-collation latin1_swedish_ci
  // sedangkan status_putusan.nama latin1_general_ci, dan COALESCE atas
  // campuran keduanya ditolak MariaDB dengan ERROR 1267. Galat itu
  // menjatuhkan SELURUH kueri, bukan kolom ini saja - jadi satu saringan yang
  // dipakai panitera akan memulangkan nol baris tanpa sebab yang terlihat.
  // Pola yang sama sudah dipakai kartu hasil di bawah.
  if (cleanText(statusPutusan)) {
    syarat.push(
      `EXISTS (SELECT 1 FROM perkara_putusan pu
                LEFT JOIN status_putusan sp ON sp.id = pu.status_putusan_id
               WHERE pu.perkara_id = p.perkara_id
                 AND COALESCE(
                       NULLIF(CONVERT(pu.status_putusan_nama USING utf8), ''),
                       CONVERT(sp.nama USING utf8)
                     ) LIKE ?)`
    );
    nilai.push(`%${cleanText(statusPutusan)}%`);
  }

  // Isi pertimbangan hukum. Di sinilah istilah seperti "ba'da dukhul" dan
  // "qabla dukhul" benar-benar tertulis - tidak ada kolomnya tersendiri di
  // SIPP, dan tidak satu pun muncul di amar putusan.
  if (cleanText(pertimbangan)) {
    syarat.push(
      `EXISTS (SELECT 1 FROM perkara_pertimbangan_hukum ph
                WHERE ph.perkara_id = p.perkara_id AND ph.pertimbangan_hukum LIKE ?)`
    );
    nilai.push(`%${cleanText(pertimbangan)}%`);
  }

  // Isi amar putusan.
  if (cleanText(amar)) {
    syarat.push(
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.amar_putusan LIKE ?)"
    );
    nilai.push(`%${cleanText(amar)}%`);
  }

  // Verstek. Kolomnya berisi 'Y' atau 'T' - dicocokkan dengan daftar
  // tertutup, bukan disambung apa adanya.
  const kunciVerstek = cleanText(verstek).toLowerCase();
  if (kunciVerstek === "ya" || kunciVerstek === "tidak") {
    syarat.push(
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.putusan_verstek = ?)"
    );
    nilai.push(kunciVerstek === "ya" ? "Y" : "T");
  }

  // Alamat pihak - untuk pertanyaan kewilayahan: berapa perkara dari desa
  // ini, dari kecamatan ini.
  if (cleanText(alamatPihak)) {
    syarat.push(syaratPihak(["alamat"]));
    nilai.push(...nilaiPihak(`%${cleanText(alamatPihak)}%`));
  }

  // KUA tempat nikah. Dipakai saat menyiapkan pemberitahuan akta cerai ke
  // KUA yang bersangkutan.
  if (cleanText(kua)) {
    syarat.push(
      `EXISTS (SELECT 1 FROM perkara_data_pernikahan dn
                WHERE dn.perkara_id = p.perkara_id AND dn.kua_tempat_nikah LIKE ?)`
    );
    nilai.push(`%${cleanText(kua)}%`);
  }

  // Keadaan relaas. Kuncinya daftar tertutup - nilai dari peramban tidak
  // pernah menjadi bagian teks kueri.
  const kunciUmur = cleanText(umur);
  if (kunciUmur && UMUR_SYARAT[kunciUmur]) syarat.push(UMUR_SYARAT[kunciUmur]);

  const kunciEcourt = cleanText(ecourt);
  if (kunciEcourt && ECOURT_SYARAT[kunciEcourt]) syarat.push(ECOURT_SYARAT[kunciEcourt]);

  // Kunci lama dipetakan lebih dahulu, supaya layar yang belum diperbarui
  // tidak kehilangan saringannya dalam diam.
  const kunciRelaasMasuk = cleanText(relaas);
  const kunciRelaas = RELAAS_KUNCI_LAMA[kunciRelaasMasuk] || kunciRelaasMasuk;
  if (kunciRelaas && RELAAS_SYARAT[kunciRelaas]) syarat.push(RELAAS_SYARAT[kunciRelaas]);

  // Rentang TANGGAL PUTUSAN, terpisah dari rentang pendaftaran.
  //
  // Selama ini sejak/sampai hanya menyaring tanggal pendaftaran, sehingga
  // "perkara yang diputus bulan ini" - pertanyaan yang ditanyakan tiap awal
  // bulan untuk laporan - tidak dapat ditanyakan sama sekali.
  const putusDari = cleanText(putusSejak);
  const putusKe = cleanText(putusSampai);
  if (/^\d{4}-\d{2}-\d{2}$/.test(putusDari)) {
    syarat.push(
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan >= ?)"
    );
    nilai.push(putusDari);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(putusKe)) {
    syarat.push(
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan <= ?)"
    );
    nilai.push(putusKe);
  }

  if (/^\d{4}$/.test(cleanText(tahun))) {
    syarat.push("YEAR(p.tanggal_pendaftaran) = ?");
    nilai.push(Number(cleanText(tahun)));
  }

  const dari = cleanText(sejak);
  const ke = cleanText(sampai);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dari)) {
    syarat.push("p.tanggal_pendaftaran >= ?");
    nilai.push(dari);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(ke)) {
    syarat.push("p.tanggal_pendaftaran <= ?");
    nilai.push(ke);
  }

  const alur = Number(alurPerkaraId) || 0;
  if (alur > 0) {
    syarat.push("p.alur_perkara_id = ?");
    nilai.push(alur);
  }

  // Daftar id dari tag. KOSONG berarti tidak ada yang cocok - dan itu harus
  // memulangkan nol baris, bukan mengabaikan tagnya. Mengabaikannya akan
  // menampilkan seluruh register seolah tagnya menyala.
  if (Array.isArray(idTag)) {
    if (idTag.length === 0) return kosong();
    const isianId = idTag.map(() => "?").join(", ");
    syarat.push(`p.perkara_id IN (${isianId})`);
    nilai.push(...idTag.map((x) => Number(x) || 0));
  }

  if (lingkupTanggal && lingkupTanggal.sql) {
    syarat.push(`(${lingkupTanggal.sql})`);
    nilai.push(...(lingkupTanggal.nilai || []));
  }

  // Status dibaca dari tabel putusan. Ditulis sebagai EXISTS supaya perkara
  // dengan lebih dari satu baris putusan tidak muncul berkali-kali.
  const STATUS = {
    // Cabut dan gugur ikut mengisi tanggal_putusan pada SIPP yang berjalan,
    // jadi keduanya sudah tersaring di sini tanpa syarat tambahan.
    berjalan:
      "NOT EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan IS NOT NULL)",
    putus:
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan IS NOT NULL)",
    belum_minutasi:
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan IS NOT NULL AND pu.tanggal_minutasi IS NULL)",
    sudah_minutasi:
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_minutasi IS NOT NULL)",
    belum_bht:
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan IS NOT NULL AND pu.tanggal_bht IS NULL)",
    sudah_bht:
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_bht IS NOT NULL)",
    // ======================================================================
    // DIBACA DARI status_putusan_id, BUKAN DARI tanggal_cabut/tanggal_gugur
    // ======================================================================
    //
    // Terukur di salinan satker 25 September 2026: tanggal_cabut terisi pada
    // 47 perkara, sedangkan status putusannya "Dicabut" pada 535 - 488
    // perkara (91%) tidak terjaring tanpa satu pun galat. tanggal_gugur 6
    // lawan 379.
    //
    // "Digugurkan" dan "Gugur" dua id berbeda dengan arti yang sama, karena
    // itu yang dicocokkan NAMAnya di tabel status_putusan.
    cabut:
      `EXISTS (SELECT 1 FROM perkara_putusan pu
                JOIN status_putusan sp ON sp.id = pu.status_putusan_id
               WHERE pu.perkara_id = p.perkara_id AND sp.nama = 'Dicabut')`,
    gugur:
      `EXISTS (SELECT 1 FROM perkara_putusan pu
                JOIN status_putusan sp ON sp.id = pu.status_putusan_id
               WHERE pu.perkara_id = p.perkara_id AND sp.nama IN ('Digugurkan', 'Gugur'))`,
  };

  // Kunci status dicocokkan dengan daftar tertutup di atas - bukan disambung
  // apa adanya. Nilai dari peramban tidak pernah menjadi bagian teks kueri.
  const kunciStatus = cleanText(status);
  if (kunciStatus && STATUS[kunciStatus]) syarat.push(STATUS[kunciStatus]);

  // Tanpa satu pun syarat, kuerinya akan memuat seluruh register. Yang keluar
  // bukan hasil pencarian, melainkan daftar acak sebanyak batas - dan itu
  // menyesatkan orang yang mengiranya hasil.
  // Tanpa satu pun syarat DAN tanpa kata bebas, kuerinya akan memuat seluruh
  // register. Yang keluar bukan hasil pencarian melainkan daftar acak
  // sebanyak batas - dan itu menyesatkan orang yang mengiranya hasil.
  // Kata teks dan kata bergaris miring memasang syaratnya sendiri saat
  // dijalankan, jadi keduanya tidak pernah "tanpa syarat".
  if (syarat.length === 0 && caraKata !== "teks" && caraKata !== "nomor") return kosong();

  // Kuerinya ditulis harfiah di dalam runQuery, tidak disusun dari peubah.
  //
  // verify-pemisahan-database.js memeriksa bahwa tiap pembacaan SIPP dimulai
  // dengan SELECT - penjagaan statis atas sambungan baca-saja ke basis data
  // pengadilan yang sedang dipakai. Menyusunnya dari peubah membuat penjagaan
  // itu tidak dapat lagi membacanya.
  //
  // Satu baris lebih banyak dari batasnya diminta, supaya "masih ada lagi"
  // diketahui tanpa kueri COUNT terpisah. Baris kelebihannya dibuang di bawah.
  //
  // ==========================================================================
  // HALAMANNYA DITENTUKAN DULU, BARU DISAMBUNG KE PUTUSAN
  // ==========================================================================
  //
  // Syarat, urutan, dan LIMIT/OFFSET dijalankan di tabel turunan `halaman`
  // yang hanya memulangkan perkara_id - sama persis dengan kueri lama,
  // termasuk urutannya - lalu barulah baris halaman itu disambung ke
  // perkara dan ringkasan putusannya.
  //
  // Bentuk lama menyambung ringkasan putusan pada TIAP baris yang disisir,
  // termasuk baris yang dilompati OFFSET: halaman kedua berisi 500 membayar
  // 1.001 sambungan untuk 460 baris. Terukur atas sipp_donggala 26 September
  // 2026 (HDD, kolam InnoDB 16 MB), kueri utama saja:
  //
  //   tahun 2025, batas 500, lewati 500     4.022 ms -> 361 ms
  //   jenis Cerai Gugat, batas 100, lewati 200 91 ms ->  12 ms
  //   kata "Rahmawati" (lapis cepat)         2.980 ms -> 1.909 ms
  //   tahun 2025, batas 25, halaman pertama     12 ms ->  11 ms
  //
  // Seluruh syarat hanya menyebut alias `p` (dan alias subkuerinya
  // sendiri), jadi syarat yang sama dipakai di dalam `halaman` tanpa diubah.
  // Urutan akhirnya diulang di luar, sebab urutan tabel turunan tidak
  // dijamin terbawa ke sambungannya.
  const jalankan = (syaratPakai, nilaiPakai, ambil = batasBaris + 1, mulai = lewatiBaris) =>
    runQuery(
      `SELECT pr.perkara_id AS perkaraId,
            pr.nomor_perkara AS nomorPerkara,
            pr.jenis_perkara_nama AS jenisPerkara,
            pr.alur_perkara_id AS alurPerkaraId,
            pr.tanggal_pendaftaran AS tanggalDaftar,
            pu.tanggalPutusan AS tanggalPutusan,
            pu.tanggalMinutasi AS tanggalMinutasi,
            pu.tanggalBht AS tanggalBht,
            pu.statusPutusan AS statusPutusan
       FROM (SELECT p.perkara_id, p.tanggal_pendaftaran
               FROM perkara p
              WHERE ${syaratPakai.join(" AND ")}
              ORDER BY p.tanggal_pendaftaran DESC, p.perkara_id DESC
              LIMIT ${Math.max(1, Math.floor(Number(ambil)) || 1)} OFFSET ${Math.max(0, Math.floor(Number(mulai)) || 0)}) halaman
       JOIN perkara pr ON pr.perkara_id = halaman.perkara_id
       LEFT JOIN (
         SELECT x.perkara_id,
                MAX(x.tanggal_putusan) AS tanggalPutusan,
                MAX(x.tanggal_minutasi) AS tanggalMinutasi,
                MAX(x.tanggal_bht) AS tanggalBht,
                -- status_putusan_nama kosong pada 9.474 dari 9.993 baris
                -- (94,8% terukur). Yang selalu terisi status_putusan_id.
                --
                -- CONVERT ... USING utf8 pada KEDUANYA, bukan pada salah
                -- satu: perkara_putusan.status_putusan_nama ber-collation
                -- latin1_swedish_ci sedangkan status_putusan.nama
                -- latin1_general_ci, dan MAX() atas campuran keduanya
                -- ditolak MariaDB dengan ERROR 1267. Cara yang sama sudah
                -- dipakai putusanBanyakPerkara di sippJadwalSidangService,
                -- dan galat itu pernah membuat seluruh kolom putusan kosong
                -- tanpa sebab yang terlihat.
                MAX(COALESCE(
                  NULLIF(CONVERT(x.status_putusan_nama USING utf8), ''),
                  CONVERT(sx.nama USING utf8)
                )) AS statusPutusan
           FROM perkara_putusan x
           LEFT JOIN status_putusan sx ON sx.id = x.status_putusan_id
          GROUP BY x.perkara_id
       ) pu ON pu.perkara_id = pr.perkara_id
      ORDER BY halaman.tanggal_pendaftaran DESC, halaman.perkara_id DESC`,
      nilaiPakai
    );

  // --- lapis cepat: nomor, jenis, nama pihak, nama kuasa hukum ---
  //
  // Nama pihak dicari langsung di keenam tabel pihak, bukan lewat
  // v_pihak_perkara - sebabnya pada TABEL_PIHAK. Nama kuasa hukum masuk
  // lapis cepat sejak 25 September 2026: nama advokat dicari sesering nama
  // pihak di meja pelayanan, dan tabelnya kecil (878 baris di satker).
  const SYARAT_CEPAT = `(p.nomor_perkara LIKE ?
          OR p.jenis_perkara_nama LIKE ?
          OR ${syaratPihak(["nama"])}
          OR EXISTS (SELECT 1 FROM perkara_pengacara kh
                      WHERE kh.perkara_id = p.perkara_id AND kh.nama LIKE ?))`;
  const nilaiCepat = (suka) => [suka, suka, ...nilaiPihak(suka), suka];

  // --- lapis dalam: seluruh yang dijangkau pencarian lanjutan ---
  //
  // Apostrof dibuang dari kolom teks panjang DAN dari kata carinya. Yang
  // tertulis di SIPP "ba’da dukhul" dengan apostrof miring U+2019, sehingga
  // mengetik "bada dukhul" maupun "ba'da dukhul" sama-sama nihil tanpa ini.
  //
  // Agenda sidang ditambahkan 25 September 2026 ("pembuktian", "mediasi",
  // "ikrar talak" - 19.508 dari 20.109 baris jadwal beragenda).
  const SYARAT_DALAM = `(p.nomor_perkara LIKE ?
          OR p.jenis_perkara_nama LIKE ?
          OR ${syaratPihak(["nama", "alamat"])}
          OR EXISTS (SELECT 1 FROM perkara_pengacara kh
                      WHERE kh.perkara_id = p.perkara_id AND kh.nama LIKE ?)
          OR EXISTS (SELECT 1 FROM perkara_data_pernikahan dn
                      WHERE dn.perkara_id = p.perkara_id AND dn.kua_tempat_nikah LIKE ?)
          OR EXISTS (SELECT 1 FROM perkara_pertimbangan_hukum ph
                      WHERE ph.perkara_id = p.perkara_id AND ${tanpaApostrof("ph.pertimbangan_hukum")} LIKE ?)
          OR EXISTS (SELECT 1 FROM perkara_putusan pv
                      WHERE pv.perkara_id = p.perkara_id AND ${tanpaApostrof("pv.amar_putusan")} LIKE ?)
          OR EXISTS (SELECT 1 FROM perkara_hakim_pn hk
                      WHERE hk.perkara_id = p.perkara_id AND hk.hakim_nama LIKE ?)
          OR EXISTS (SELECT 1 FROM perkara_panitera_pn pp
                      WHERE pp.perkara_id = p.perkara_id AND pp.panitera_nama LIKE ?)
          OR EXISTS (SELECT 1 FROM perkara_jurusita jr
                      WHERE jr.perkara_id = p.perkara_id AND jr.jurusita_nama LIKE ?)
          OR EXISTS (SELECT 1 FROM perkara_jadwal_sidang jd
                      WHERE jd.perkara_id = p.perkara_id AND jd.agenda LIKE ?))`;
  const nilaiDalam = (suka, sukaDalam) => [
    suka,
    suka,
    ...nilaiPihak(suka, 2),
    suka,
    suka,
    sukaDalam,
    sukaDalam,
    suka,
    suka,
    suka,
    suka,
  ];

  let rows;
  let lapis = "";
  // Benar bila perkara halaman ini ketemu lewat NOMOR LAIN (akta cerai,
  // banding, kasasi, PK, akta nikah) - hanya saat itulah keterangan nomor
  // lain dilampirkan.
  let nomorLain = false;

  if (caraKata === "nomor") {
    // ========================================================================
    // NOMOR PERKARA DULU; NOMOR LAIN HANYA BILA NOMOR PERKARA KOSONG
    // ========================================================================
    //
    // Nomor lain dulu digabung ke SYARAT YANG SAMA (nomor perkara ATAU id
    // bernomor lain cocok) dan diurutkan bersama menurut tanggal daftar.
    // Potongan nomor perkara - cara yang dianjurkan layar sendiri - lalu
    // dibanjiri perkara lain: 5.388 nomor kutipan akta nikah bentuk lama
    // bergaris miring ("0074/006/IV/2019"), dan pemiliknya kebanyakan perkara
    // yang lebih baru. Terukur 26 September 2026 atas sipp_donggala, halaman
    // pertama (100 baris):
    //
    //   "/2019"  kode lama 100/100 bernomor 2019   gabungan 0/100
    //   "12/"    kode lama 100/100 bernomor "12/"  gabungan 23/100
    //   "419/"   kode lama 13 baris                gabungan 22 (9 tambahan)
    //
    // Nomor perkara tidak pernah memuat "/AC/", "PTA", "K/Ag", "PK/", atau
    // bulan Romawi akta nikah ("/IV/") - terukur 0 dari 10.120 - jadi nomor
    // akta cerai, banding, kasasi, PK, dan akta nikah yang diketik utuh, atau
    // sepotong yang memuat penanda itu, selalu KOSONG di tahap pertama dan
    // dicari di tahap kedua. Nomor akta cerai, banding, dan kasasi yang
    // tersimpan tidak satu pun merupakan potongan nomor perkara (terukur);
    // akta nikah 16, dan keenam belasnya ISINYA nomor perkara yang salah
    // ketik ("140/Pdt.G/2016/Pa.Dgl") - mengetiknya menemukan perkara bernomor
    // itu. Yang kehilangan tahap kedua hanya potongan yang memang cocok dengan
    // nomor perkara - dan untuk itu jawabannya kini SAMA dengan kode lama:
    // himpunan, urutan, dan hitungannya.
    //
    // "Kosong" berarti kosong SAMA SEKALI, bukan halaman ini saja - alasannya
    // sama dengan lapis kata teks di bawah.
    const suka = `%${kata}%`;
    // Nomor perkara yang cocok dijemput lebih dahulu lewat indeksnya - lihat
    // idPerkaraBerNomor(). Tidak satu pun cocok: kueri utama tahap pertama
    // tidak perlu jalan sama sekali.
    const idNomor = await idPerkaraBerNomor(suka);
    let nomorKosong = idNomor.length === 0;
    rows = [];
    if (!nomorKosong) {
      const pakaiDaftar = idNomor.length <= PAGU_ID_NOMOR;
      const syaratNomor = [
        ...syarat,
        pakaiDaftar ? `p.perkara_id IN (${idNomor.map(() => "?").join(", ")})` : "p.nomor_perkara LIKE ?",
      ];
      const nilaiNomor = [...nilai, ...(pakaiDaftar ? idNomor : [suka])];
      rows = await jalankan(syaratNomor, nilaiNomor);
      nomorKosong = rows.length === 0;
      if (nomorKosong && lewatiBaris > 0) {
        const awal = await jalankan(syaratNomor, nilaiNomor, 1, 0);
        nomorKosong = awal.length === 0;
      }
    }
    if (nomorKosong) {
      // Dijemput lebih dahulu, bukan ditempel sebagai lima EXISTS: terukur
      // 25 September 2026, bentuk EXISTS membuat nomor akta cerai 2,4 kali
      // lebih lambat (3,8 detik menjadi 9,1).
      const idLain = await idPerkaraBerNomorLain(suka);
      if (idLain.length > 0) {
        rows = await jalankan(
          [...syarat, `p.perkara_id IN (${idLain.map(() => "?").join(", ")})`],
          [...nilai, ...idLain]
        );
        nomorLain = true;
      }
    }
  } else if (caraKata === "teks") {
    const suka = `%${kata}%`;
    const syaratCepat = [...syarat, SYARAT_CEPAT];
    const nilaiCepatPakai = [...nilai, ...nilaiCepat(suka)];
    rows = await jalankan(syaratCepat, nilaiCepatPakai);
    lapis = "cepat";

    // Diperdalam HANYA bila lapis cepat kosong. Nama pihak dan nomor perkara
    // - yang dicari sembilan dari sepuluh kali - tetap secepat sebelumnya,
    // dan yang tidak ketemu di sana barulah dicari sampai ke isi
    // pertimbangan. Diukur pada SIPP yang berjalan: 0,16 detik lawan 1,39.
    //
    // "Kosong" berarti kosong SAMA SEKALI, bukan halaman ini saja yang
    // kosong. Tanpa pemeriksaan halaman awal, meminta halaman sesudah hasil
    // terakhir lapis cepat akan diam-diam berpindah ke lapis dalam dan
    // menyuguhkan perkara dari himpunan yang lain sebagai "halaman berikutnya".
    let cepatKosong = rows.length === 0;
    if (cepatKosong && lewatiBaris > 0) {
      const awal = await jalankan(syaratCepat, nilaiCepatPakai, 1, 0);
      cepatKosong = awal.length === 0;
    }
    if (cepatKosong) {
      const sukaDalam = `%${bersihApostrof(kata)}%`;
      rows = await jalankan([...syarat, SYARAT_DALAM], [...nilai, ...nilaiDalam(suka, sukaDalam)]);
      lapis = "dalam";
    }
  } else {
    rows = await jalankan(syarat, nilai);
  }

  const adaLagi = rows.length > batasBaris;
  if (adaLagi) rows = rows.slice(0, batasBaris);

  const hasil = rows.map((row) => ({
    perkaraId: String(row.perkaraId || ""),
    nomorPerkara: cleanText(row.nomorPerkara),
    jenisPerkara: cleanText(row.jenisPerkara),
    alurPerkaraId: Number(row.alurPerkaraId) || 0,
    tanggalDaftar: isoTanggal(row.tanggalDaftar),
    sudahPutus: Boolean(row.tanggalPutusan),
    tanggalPutusan: isoTanggal(row.tanggalPutusan),
    tanggalMinutasi: isoTanggal(row.tanggalMinutasi),
    tanggalBht: isoTanggal(row.tanggalBht),
    statusPutusan: cleanText(row.statusPutusan),
    // Ruas rinci - diisi lengkapiRuas() dengan kueri kedua. Nilai awalnya
    // "tidak ada"; bila kuerinya gagal, namanya masuk ruasTakTerbaca.
    jenisPerkaraId: 0,
    pihak1: "",
    pihak2: "",
    // Butir 24 (6 Okt 2026): turut tergugat (perkara_pihak4) dan intervensi
    // (perkara_pihak3), "; " seperti pihak1/2. Kosong = tidak ada.
    turutTergugat: "",
    intervensi: "",
    sebutanPihak1: "",
    sebutanPihak2: "",
    kuasa: "",
    hakimKetua: "",
    paniteraPengganti: "",
    jurusita: "",
    tahapan: "",
    proses: "",
    jumlahSidang: 0,
    sidangTerakhir: "",
    sidangBerikut: "",
    umurHari: null,
    ecourt: null,
    nomorAktaCerai: "",
    tanggalAktaCerai: "",
    // Diisi lampirkanCocok di bawah.
    cocok: [],
  }));

  // Kosakata dijelaskan langsung: tidak ada teks yang dapat dipotong
  // sebagai buktinya - yang cocok adalah KEADAAN perkaranya.
  if (labelKosakata) {
    for (const baris of hasil) baris.cocok.push({ medan: "Keadaan", nilai: labelKosakata });
  }

  await Promise.all([
    lengkapiRuas(hasil, tanggalAcuan, ruasTakTerbaca),
    lampirkanCocok(
      hasil,
      {
        kata,
        caraKata,
        // Keterangan nomor lain hanya untuk perkara yang ketemu LEWAT nomor
        // lain - lihat cabang "nomor" di atas.
        nomorLain,
        // Lapis dalam menjangkau alamat, KUA, pertimbangan, amar, petugas, dan
        // agenda - jadi keterangannya pun harus dicari di sana, kalau tidak
        // kartunya kembali tidak menyebut apa pun yang diketik.
        kataDalam: lapis === "dalam" ? kata : "",
        namaPihak,
        alamatPihak,
        hakim,
        panitera,
        jurusita,
        petugas,
        pertimbangan,
        amar,
        kua,
      },
      ruasTakTerbaca
    ),
  ]);

  return {
    perkara: hasil,
    adaLagi,
    lewati: lewatiBaris,
    batas: batasBaris,
    lapis,
    ruasTakTerbaca,
  };
}

/**
 * Bentuk lama: larik hasil saja, halaman pertama.
 *
 * Dipertahankan supaya pemanggil yang sudah ada - dan verify-cari-perkara.js
 * yang mengujinya - tidak berubah. Ruas rinci dan keterangan kecocokannya
 * tetap ikut, sebab keduanya menempel pada tiap baris.
 */
async function cariPerkara(kataCari, pilihan = {}) {
  const halaman = await cariPerkaraHalaman(kataCari, pilihan);
  return halaman.perkara;
}

/**
 * ============================================================================
 * RUAS RINCI UNTUK TAMPILAN DAFTAR DAN RINCI
 * ============================================================================
 *
 * Diminta pengguna 25 September 2026 (butir 7): hasil pencarian dapat dilihat
 * sebagai kotak, daftar, dan rinci - dan tampilan rinci memuat pihak, kuasa,
 * majelis, tahapan, sidang, umur perkara, e-Court, dan akta cerai.
 *
 * ============================================================================
 * KUERI KEDUA ATAS ID HASIL, BUKAN JOIN KE KUERI PENCARIAN
 * ============================================================================
 *
 * Kueri pencarian menyisir seluruh register untuk menemukan paling banyak
 * 500 baris. Menempelkan sembilan sambungan ke sana berarti tiap baris yang
 * DISISIR ikut menanggungnya, padahal yang ditampilkan hanya yang lolos.
 * Di sini tiap keterangan dibaca dengan SATU kueri berindeks atas daftar
 * perkara_id hasil - sembilan kueri untuk satu halaman, bukan sembilan per
 * baris - dan dijalankan bersamaan.
 *
 * ============================================================================
 * ARTI TIAP RUAS
 * ============================================================================
 *
 *   pihak1/pihak2       nama dari perkara_pihak1/perkara_pihak2 menurut
 *                       urutan, dipisah "; ", apa adanya. pihak2 = sisi
 *                       Tergugat/Termohon - JANGAN tertukar (pernah dua kali).
 *   sebutanPihak1/2     sebutanPihakService, menurut alur & jenis_perkara_id
 *   kuasa               perkara_pengacara yang aktif, DIKELOMPOKKAN MENURUT
 *                       SISINYA (pihak_ke): "Kuasa Penggugat: A; B; Kuasa
 *                       Tergugat: C". Sebutannya dari sebutanPihakService
 *                       .sebutanSatuPihak(pihak_ke, ..., "kuasa") - sumber
 *                       yang sama dengan sebutanPihak1/2, bukan peta baru.
 *                       Satu orang (pengacara_id) disebut sekali per sisi.
 *   hakimKetua          penunjukan AKTIF berjabatan Hakim Ketua (1) atau
 *                       Hakim Tunggal (3); tahapan terakhir didahulukan -
 *                       sesudah ikrar talak majelis tahapan 18 yang aktif,
 *                       majelis tahapan 10 dinonaktifkan SIPP (terukur)
 *   paniteraPengganti,  penunjukan AKTIF, tahapan terakhir dahulu; satu ORANG
 *   jurusita            (panitera_id / jurusita_id) disebut sekali, dengan
 *                       ejaan penunjukan tahapan terakhirnya
 *   tahapan, proses     perkara.tahapan_terakhir_text / proses_terakhir_text -
 *                       yang dibaca daftar SIPP sendiri
 *   jumlahSidang        sidang yang tanggalnya SEBELUM hari ini (yang sudah
 *                       lewat) - sama dengan sidangLewat pada statusLengkap
 *   sidangTerakhir      tanggal sidang terakhir sebelum hari ini
 *   sidangBerikut       tanggal sidang terdekat mulai HARI INI - sidang hari
 *                       ini belum tentu sudah berlangsung saat layar dibuka
 *   umurHari            hari kalender sejak daftar sampai putus, atau sampai
 *                       hari ini (zona Asia/Makassar) bila belum putus
 *   ecourt              ada tidaknya perkara_efiling_id; null = tak terbaca
 *   nomorAktaCerai,     perkara_akta_cerai
 *   tanggalAktaCerai
 */
async function lengkapiRuas(hasil, hariIni, takTerbaca = []) {
  const daftarId = hasil.map((x) => x.perkaraId).filter(Boolean);
  if (daftarId.length === 0) return;

  const peta = new Map(hasil.map((x) => [x.perkaraId, x]));
  const isian = daftarId.map(() => "?").join(", ");
  const baris = (perkaraId) => peta.get(String(perkaraId));

  const baca = async (nama, sql, params) => {
    try {
      return { ok: true, baris: await runQuery(sql, params) };
    } catch (error) {
      catatTakTerbaca(takTerbaca, nama, error);
      return { ok: false, baris: [] };
    }
  };

  /**
   * Nama per ORANG, menurut urutan kemunculan pertamanya.
   *
   * Kuncinya id orangnya (jurusita_id, panitera_id, pengacara_id), BUKAN
   * ejaan namanya. SIPP menyimpan nama salinan pada tiap penunjukan, dan orang
   * yang sama ditunjuk lagi pada tahapan lain dapat tertulis berbeda: terukur
   * 26 September 2026, jurusita_id 22 aktif dua kali pada lima perkara -
   * "Mohammad Syukri" (tahapan 10) dan "Mohammad Syukri, S.H." (tahapan 18) -
   * sehingga kolom Juru sita menulis orang yang sama dua kali. Yang dipakai
   * ejaan baris PERTAMA menurut ORDER BY kuerinya: tahapan terakhir.
   *
   * Baris tanpa id (tidak ada di salinan satker, tetapi SIPP versi lain
   * mungkin) dikenali lewat namanya, seperti sebelumnya.
   */
  const unikOrang = (daftar) => {
    const lihat = new Set();
    const keluar = [];
    for (const r of daftar) {
      const bersih = cleanText(r.nama);
      if (!bersih) continue;
      const orang = Number(r.orang) || 0;
      const kunci = orang > 0 ? `id:${orang}` : `nama:${bersih}`;
      if (lihat.has(kunci)) continue;
      lihat.add(kunci);
      keluar.push(bersih);
    }
    return keluar;
  };

  // Umur tidak memerlukan kueri: tanggal daftar dan putusnya sudah ada.
  for (const x of hasil) {
    x.umurHari = x.tanggalDaftar ? selisihHari(x.tanggalDaftar, x.tanggalPutusan || hariIni) : null;
  }

  const [perkara, pihak, kuasa, hakim, panitera, jurusita, sidang, efiling, akta] = await Promise.all([
    baca(
      "perkara",
      `SELECT pr.perkara_id AS perkaraId,
              pr.jenis_perkara_id AS jenisPerkaraId,
              pr.tahapan_terakhir_text AS tahapan,
              pr.proses_terakhir_text AS proses
         FROM perkara pr
        WHERE pr.perkara_id IN (${isian})`,
      daftarId
    ),
    // Kedua sisi dalam satu kueri, masing-masing ditandai kedudukannya.
    baca(
      "pihak",
      `SELECT u.ke, u.perkaraId, u.nama
         FROM (SELECT 1 AS ke, a.perkara_id AS perkaraId, a.nama AS nama, a.urutan AS urutan, a.id AS id
                 FROM perkara_pihak1 a WHERE a.perkara_id IN (${isian})
               UNION ALL
               SELECT 2 AS ke, b.perkara_id AS perkaraId, b.nama AS nama, b.urutan AS urutan, b.id AS id
                 FROM perkara_pihak2 b WHERE b.perkara_id IN (${isian})
               UNION ALL
               SELECT 3 AS ke, c.perkara_id AS perkaraId, c.nama AS nama, c.urutan AS urutan, c.id AS id
                 FROM perkara_pihak3 c WHERE c.perkara_id IN (${isian})
               UNION ALL
               SELECT 4 AS ke, d.perkara_id AS perkaraId, d.nama AS nama, d.urutan AS urutan, d.id AS id
                 FROM perkara_pihak4 d WHERE d.perkara_id IN (${isian})) u
        ORDER BY u.perkaraId, u.ke, u.urutan, u.id`,
      [...daftarId, ...daftarId, ...daftarId, ...daftarId]
    ),
    // Sisinya (pihak_ke) ikut dibaca: kuasa kedua pihak dulu digabung dalam
    // satu kolom tanpa sisi, dan kuasa Tergugat/Termohon terbaca sebagai kuasa
    // Penggugat - lihat pengisiannya di bawah.
    baca(
      "kuasa",
      `SELECT k.perkara_id AS perkaraId, k.pihak_ke AS pihakKe, k.pengacara_id AS orang, k.nama AS nama
         FROM perkara_pengacara k
        WHERE k.perkara_id IN (${isian}) AND k.aktif = 'Y'
        ORDER BY k.perkara_id, k.pihak_ke, k.urutan, k.id`,
      daftarId
    ),
    baca(
      "hakimKetua",
      `SELECT hk.perkara_id AS perkaraId, hk.hakim_nama AS nama
         FROM perkara_hakim_pn hk
        WHERE hk.perkara_id IN (${isian}) AND hk.aktif = 'Y'
        ORDER BY hk.perkara_id,
                 (hk.jabatan_hakim_id IN (1, 3)) DESC,
                 hk.tahapan_id DESC,
                 hk.urutan ASC,
                 hk.id ASC`,
      daftarId
    ),
    baca(
      "paniteraPengganti",
      `SELECT pn.perkara_id AS perkaraId, pn.panitera_id AS orang, pn.panitera_nama AS nama
         FROM perkara_panitera_pn pn
        WHERE pn.perkara_id IN (${isian}) AND pn.aktif = 'Y'
        ORDER BY pn.perkara_id, pn.tahapan_id DESC, pn.urutan ASC, pn.id ASC`,
      daftarId
    ),
    baca(
      "jurusita",
      `SELECT js.perkara_id AS perkaraId, js.jurusita_id AS orang, js.jurusita_nama AS nama
         FROM perkara_jurusita js
        WHERE js.perkara_id IN (${isian}) AND js.aktif = 'Y'
        ORDER BY js.perkara_id, js.tahapan_id DESC, js.urutan ASC, js.id ASC`,
      daftarId
    ),
    // Tanggal acuan lewat tanda tanya, bukan CURDATE(): zona peladen
    // basis data tidak dijamin zona pengadilan.
    baca(
      "sidang",
      `SELECT j.perkara_id AS perkaraId,
              SUM(CASE WHEN j.tanggal_sidang < ? THEN 1 ELSE 0 END) AS jumlahLewat,
              MAX(CASE WHEN j.tanggal_sidang < ? THEN j.tanggal_sidang END) AS terakhir,
              MIN(CASE WHEN j.tanggal_sidang >= ? THEN j.tanggal_sidang END) AS berikut
         FROM perkara_jadwal_sidang j
        WHERE j.perkara_id IN (${isian})
        GROUP BY j.perkara_id`,
      [hariIni, hariIni, hariIni, ...daftarId]
    ),
    baca(
      "ecourt",
      `SELECT k.perkara_id AS perkaraId
         FROM perkara_efiling_id k
        WHERE k.perkara_id IN (${isian})
        GROUP BY k.perkara_id`,
      daftarId
    ),
    baca(
      "aktaCerai",
      `SELECT ac.perkara_id AS perkaraId, ac.nomor_akta_cerai AS nomor, ac.tgl_akta_cerai AS tanggal
         FROM perkara_akta_cerai ac
        WHERE ac.perkara_id IN (${isian})`,
      daftarId
    ),
  ]);

  for (const r of perkara.baris) {
    const x = baris(r.perkaraId);
    if (!x) continue;
    x.jenisPerkaraId = Number(r.jenisPerkaraId) || 0;
    x.tahapan = cleanText(r.tahapan);
    x.proses = cleanText(r.proses);
  }

  // Sebutan dihitung SESUDAH jenis_perkara_id terbaca - cerai talak dan izin
  // poligami bernomor Pdt.G tetapi bersebutan Pemohon/Termohon, dan hanya
  // jenis_perkara_id yang membedakannya. Bila kueri perkara gagal, sebutannya
  // tetap disusun dari alur dan nama jenis (cadangan kata milik layanan itu).
  for (const x of hasil) {
    const sebutan = sebutanPihakService.sebutanPihakPerkara({
      alurPerkaraId: x.alurPerkaraId || null,
      jenisPerkaraId: x.jenisPerkaraId || null,
      jenisPerkaraNama: x.jenisPerkara,
      nomorPerkara: x.nomorPerkara,
    });
    x.sebutanPihak1 = sebutan.satu;
    x.sebutanPihak2 = sebutan.dua;
  }

  const kumpul = (daftarBaris) => {
    const himpun = new Map();
    for (const r of daftarBaris) {
      const kunci = String(r.perkaraId);
      if (!himpun.has(kunci)) himpun.set(kunci, []);
      himpun.get(kunci).push(r);
    }
    return himpun;
  };

  for (const [perkaraId, daftar] of kumpul(pihak.baris)) {
    const x = baris(perkaraId);
    if (!x) continue;
    // Nama pihak TIDAK dibuat unik: dua orang bernama sama pada satu sisi
    // tetap dua orang, dan ruas ini "apa adanya dari SIPP".
    const sisi = (ke) =>
      daftar
        .filter((r) => Number(r.ke) === ke)
        .map((r) => cleanText(r.nama))
        .filter(Boolean)
        .join("; ");
    x.pihak1 = sisi(1);
    x.pihak2 = sisi(2);
    x.intervensi = sisi(3);
    x.turutTergugat = sisi(4);
  }

  // ==========================================================================
  // KUASA DISEBUT BESERTA SISINYA
  // ==========================================================================
  //
  // Dulu seluruh kuasa aktif digabung "A; B" tanpa sisi. Terukur 26 September
  // 2026 atas sipp_donggala: 28 perkara berkuasa di KEDUA sisi (mis.
  // 120/Pdt.G/2016 tertulis "Erik Cahyono ,SH; Misbahuddin, S.H., M.H" -
  // kuasa Pemohon dan kuasa Termohon), dan 21 perkara yang kuasanya HANYA
  // milik pihak kedua (mis. 375/Pdt.G/2026, tiga kuasa Termohon) - di kolom
  // yang bersebelahan dengan "Pihak pertama", pembaca lazim mengiranya kuasa
  // Penggugat. Keliru menyebut sisi sudah dua kali terjadi di ALETA
  // (pelaku/lawan); di sini sisinya disebut, dari sumber sebutan yang sama
  // dengan sebutanPihak1/2.
  //
  // pihak_ke di satker hanya 1 atau 2 (878 baris, terukur). Nilai lain - SIPP
  // versi lain - disebut "Kuasa" saja, TIDAK ditebak sebagai sisi pertama
  // (sebutanSatuPihak memperlakukan selain 2 sebagai pihak pertama).
  for (const [perkaraId, daftar] of kumpul(kuasa.baris)) {
    const x = baris(perkaraId);
    if (!x) continue;
    const bahan = {
      alurPerkaraId: x.alurPerkaraId || null,
      jenisPerkaraId: x.jenisPerkaraId || null,
      jenisPerkaraNama: x.jenisPerkara,
      nomorPerkara: x.nomorPerkara,
    };
    const persisi = new Map([
      [1, []],
      [2, []],
      [0, []],
    ]);
    for (const r of daftar) {
      const ke = Number(r.pihakKe);
      persisi.get(ke === 1 || ke === 2 ? ke : 0).push(r);
    }
    const bagian = [];
    for (const [ke, isi] of persisi) {
      const nama = unikOrang(isi);
      if (nama.length === 0) continue;
      const sebutan = ke === 0 ? "Kuasa" : sebutanPihakService.sebutanSatuPihak(ke, bahan, "kuasa");
      bagian.push(`${sebutan}: ${nama.join("; ")}`);
    }
    x.kuasa = bagian.join("; ");
  }

  for (const [perkaraId, daftar] of kumpul(hakim.baris)) {
    const x = baris(perkaraId);
    // Baris pertama sudah ketua menurut ORDER BY kuerinya. Bila tidak ada
    // yang berjabatan ketua/tunggal, yang pertama menurut urutan dipakai -
    // sama dengan ketuaMajelisTercatat pada penunjukanService.
    if (x) x.hakimKetua = cleanText(daftar[0] && daftar[0].nama);
  }

  for (const [perkaraId, daftar] of kumpul(panitera.baris)) {
    const x = baris(perkaraId);
    if (x) x.paniteraPengganti = unikOrang(daftar).join("; ");
  }

  for (const [perkaraId, daftar] of kumpul(jurusita.baris)) {
    const x = baris(perkaraId);
    if (x) x.jurusita = unikOrang(daftar).join("; ");
  }

  for (const r of sidang.baris) {
    const x = baris(r.perkaraId);
    if (!x) continue;
    x.jumlahSidang = Number(r.jumlahLewat) || 0;
    x.sidangTerakhir = isoTanggal(r.terakhir);
    x.sidangBerikut = isoTanggal(r.berikut);
  }

  if (efiling.ok) {
    const ada = new Set(efiling.baris.map((r) => String(r.perkaraId)));
    for (const x of hasil) x.ecourt = ada.has(x.perkaraId);
  }

  for (const r of akta.baris) {
    const x = baris(r.perkaraId);
    if (!x) continue;
    x.nomorAktaCerai = cleanText(r.nomor);
    x.tanggalAktaCerai = isoTanggal(r.tanggal);
  }
}

/** Kunci status yang diterima cariPerkara, untuk ditampilkan di layar. */
const STATUS_PENCARIAN = [
  { kunci: "berjalan", label: "Masih berjalan" },
  { kunci: "putus", label: "Sudah putus" },
  { kunci: "belum_minutasi", label: "Putus, belum diminutasi" },
  { kunci: "sudah_minutasi", label: "Sudah diminutasi" },
  { kunci: "belum_bht", label: "Putus, belum BHT" },
  { kunci: "sudah_bht", label: "Sudah BHT" },
  { kunci: "cabut", label: "Dicabut" },
  { kunci: "gugur", label: "Gugur" },
];

/** Alur perkara pada SIPP, untuk saringan di layar. */
const ALUR_PENCARIAN = [
  { id: 15, label: "Gugatan (Pdt.G)" },
  { id: 16, label: "Permohonan (Pdt.P)" },
  { id: 17, label: "Gugatan Sederhana (Pdt.G.S)" },
  { id: 122, label: "Jinayah (JN)" },
];

/** Ringkasan biaya perkara: panjar, terpakai, dan sisanya. */
async function biayaPerkara(perkaraId) {
  // Dua kueri: ringkasannya untuk kartu, rinciannya untuk daftar. Yang kedua
  // dibatasi supaya perkara dengan ratusan transaksi tidak membanjiri layar.
  const [ringkas, rinci] = await Promise.all([
    runQuery(
      `SELECT b.jenis_transaksi AS jenisTransaksi, SUM(b.jumlah) AS jumlah
         FROM perkara_biaya b WHERE b.perkara_id = ? GROUP BY b.jenis_transaksi`,
      [perkaraId]
    ),
    runQuery(
      `SELECT b.jenis_transaksi AS jenisTransaksi,
              b.uraian AS uraian,
              b.jumlah AS jumlah,
              b.tanggal_transaksi AS tanggal
         FROM perkara_biaya b
        WHERE b.perkara_id = ?
        ORDER BY b.tanggal_transaksi ASC, b.id ASC
        LIMIT 200`,
      [perkaraId]
    ).catch(() => []),
  ]);

  // jenis_transaksi SIPP: 1 pemasukan. Pengeluaran ditulis -1 pada jalur query
  // lama yang sudah lama menjawab publik; catatan di sini sempat menyebut 2.
  // Karena keduanya sama-sama BUKAN 1, hasil penjumlahannya tidak berbeda -
  // tetapi keterangannya diluruskan supaya pembaca berikutnya tidak menyangka
  // ada nilai ketiga yang terlewat.
  let masuk = 0;
  let keluar = 0;
  for (const baris of ringkas) {
    if (Number(baris.jenisTransaksi) === 1) masuk += Number(baris.jumlah) || 0;
    else keluar += Number(baris.jumlah) || 0;
  }

  return {
    panjar: masuk,
    terpakai: keluar,
    sisa: masuk - keluar,
    // Rinciannya - "terpakai Rp 179.500" tidak memberi tahu untuk apa.
    // Yang ditanya kasir dan pihak justru rinciannya.
    rincian: (Array.isArray(rinci) ? rinci : []).map((baris) => ({
      jenis: Number(baris.jenisTransaksi) === 1 ? "masuk" : "keluar",
      uraian: cleanText(baris.uraian),
      jumlah: Number(baris.jumlah) || 0,
      tanggal: isoTanggal(baris.tanggal),
    })),
  };
}

/** Riwayat penundaan sidang - berapa kali dan sebabnya. */
async function riwayatPenundaan(perkaraId) {
  const rows = await runQuery(
    `SELECT j.tanggal_sidang AS tanggalSidang,
            j.agenda AS agenda,
            j.alasan_ditunda AS alasanDitunda
       FROM perkara_jadwal_sidang j
      WHERE j.perkara_id = ? AND j.ditunda = 'Y'
      ORDER BY j.tanggal_sidang ASC`,
    [perkaraId]
  );

  return rows.map((row) => ({
    tanggalSidang: isoTanggal(row.tanggalSidang),
    agenda: cleanText(row.agenda),
    alasanDitunda: cleanText(row.alasanDitunda),
  }));
}

/**
 * Identitas dasar satu perkara.
 *
 * jenisPerkaraId ikut dikirim sejak 2.39.0 (27 September 2026). Sebutan para
 * pihak ditentukan NOMOR alur DAN jenis perkara (sebutan-pihak.ts), dan alur
 * saja tidak cukup: cerai talak (346) dan izin poligami (341) beralur gugatan
 * (15) tetapi bersebutan Pemohon/Termohon. Tanpa nomor jenis, ringkasan salin
 * Status Perkara hanya dapat menulis sebutan ganda "Penggugat/Pemohon".
 */
async function identitasPerkara(nomorPerkara) {
  const rows = await runQuery(
    `SELECT p.perkara_id AS perkaraId,
            p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            p.jenis_perkara_text AS jenisPerkaraLengkap,
            p.alur_perkara_id AS alurPerkaraId,
            p.jenis_perkara_id AS jenisPerkaraId,
            p.tanggal_pendaftaran AS tanggalDaftar
       FROM perkara p
      WHERE p.nomor_perkara = ?
      ORDER BY p.perkara_id DESC
      LIMIT 1`,
    [nomorPerkara]
  );

  const baris = rows[0];
  if (!baris) return null;

  return {
    perkaraId: String(baris.perkaraId || ""),
    nomorPerkara: cleanText(baris.nomorPerkara),
    jenisPerkara: cleanText(baris.jenisPerkara),
    jenisPerkaraLengkap: cleanText(baris.jenisPerkaraLengkap),
    alurPerkaraId: Number(baris.alurPerkaraId) || 0,
    jenisPerkaraId: Number(baris.jenisPerkaraId) || 0,
    tanggalDaftar: isoTanggal(baris.tanggalDaftar),
  };
}

/**
 * Menyusun fakta satu perkara untuk dinilai menurut SK Penilaian SIPP.
 *
 * ============================================================================
 * ADA TIDAKNYA TERBACA, TEPAT TIDAKNYA WAKTU BELUM
 * ============================================================================
 *
 * Sebagian unsur SK dinilai dari WAKTU - berapa hari sesudah suatu peristiwa
 * datanya diinput ke SIPP. Kolom tanggal input itu belum dibaca ALETA; yang
 * terbaca baru ada tidaknya datanya.
 *
 * Karena itu berlaku satu aturan di seluruh fungsi ini:
 *
 *   tidak ada sama sekali     -> tetap dinilai, sebab SK memang menilainya
 *                                nol (atau -5), dan itu memang keadaannya
 *   ada tetapi waktunya gelap -> TIDAK dinilai, dan disebutkan sebagai unsur
 *                                yang sumber datanya belum tersambung
 *
 * Menebak yang kedua akan memberi nilai buruk kepada pekerjaan yang mungkin
 * sudah dikerjakan tepat waktu. Nilai yang keliru pada berkas resmi lebih
 * berbahaya daripada nilai yang jujur mengaku belum lengkap.
 *
 * Bidang yang dibiarkan undefined berarti "belum tersambung"; yang bernilai
 * null berarti "terbaca, memang kosong".
 */
function faktaPenilaianSk({ identitas, putusan, jadwal, relaas, saksi, sidangLewat, basAda, tahapan, pendukung } = {}) {
  const fakta = {};

  fakta.tanggalDaftar = identitas && identitas.tanggalDaftar ? identitas.tanggalDaftar : null;

  const sudahPutus = Boolean(putusan && putusan.sudahPutus);
  if (sudahPutus) {
    fakta.tanggalPutus = putusan.tanggalPutusan || null;
    fakta.tanggalMinutasi = putusan.tanggalMinutasi || null;
    fakta.tanggalBht = putusan.tanggalBht || null;
    fakta.wajibBht = true;

    // Sidang terakhir yang jatuh pada atau sebelum tanggal putus - itulah
    // yang dibandingkan SK Tabel 2 III.1.
    const sebelumPutus = (jadwal || []).filter(
      (x) => x.tanggalSidang && x.tanggalSidang <= putusan.tanggalPutusan
    );
    if (sebelumPutus.length > 0) {
      fakta.tanggalSidangTerakhir = sebelumPutus[sebelumPutus.length - 1].tanggalSidang;
    }

    // Perkara talak kabul dan verzet dikecualikan SK dari unsur ini.
    const status = String(putusan.statusPutusan || "").toLowerCase();
    if (/talak|verzet/.test(status)) fakta.dikecualikanAgendaTerakhir = true;

    fakta.adaAmarPutusan = Boolean(putusan.adaBerkasPutusan);

    // Verstek diucapkan bila tergugat tidak hadir. Kehadiran pada sidang
    // terakhir yang dibandingkan - SK Tabel 2 III.4.
    const hadirTerakhir = sebelumPutus.length > 0 ? sebelumPutus[sebelumPutus.length - 1].dihadiriOleh : null;
    if (hadirTerakhir === 1 || hadirTerakhir === 2) {
      // 1 = kedua pihak hadir (contradictoir), 2 = penggugat saja (verstek).
      fakta.jenisPutusanSesuai = putusan.verstek === (hadirTerakhir === 2);
    }

    // Perkara cabut atau gugur dikecualikan dari unsur data saksi.
    if (putusan.tanggalCabut || putusan.tanggalGugur) fakta.dikecualikanSaksi = true;

    // ----------------------------------------------------------------------
    // AKTA CERAI HANYA PADA PERKARA PERCERAIAN
    // ----------------------------------------------------------------------
    //
    // Dibaca dari SIPP yang berjalan: akta cerai terbit pada Cerai Gugat
    // (3.701) dan Cerai Talak (902). Jenis perkara lain - istbat nikah,
    // dispensasi kawin, kewarisan, perwalian - tidak menerbitkannya sama
    // sekali.
    //
    // Dibedakan bertingkat, dan itu menentukan:
    //   true       perkara perceraian - aktanya wajib ada
    //   false      jenisnya diketahui dan bukan perceraian - tidak berlaku
    //   undefined  jenisnya tidak terbaca - belum dapat dinilai
    //
    // Menyamakan yang KEDUA dengan yang KETIGA akan memberi nilai sempurna
    // kepada perkara yang jenisnya belum diketahui - nilai yang tidak
    // berdasar apa pun.
    const jenisPerkara = String((identitas && identitas.jenisPerkara) || "").trim();
    if (jenisPerkara) fakta.wajibAktaCerai = /cerai/i.test(jenisPerkara);

    if (putusan.aktaCerai) {
      fakta.wajibAktaCerai = true;
      fakta.tanggalAktaCerai = putusan.aktaCerai.tanggal || null;
    }
  }





  // ------------------------------------------------------------------------
  // KETEPATAN WAKTU PENGINPUTAN - SK Tabel 2 bagian I
  // ------------------------------------------------------------------------
  //
  // Tahapan yang KOLOMNYA ada di SIPP dinilai, termasuk bila isinya kosong -
  // kosong memang berarti belum dikerjakan. Tahapan yang kolomnya TIDAK ADA
  // dibiarkan undefined, sehingga tetap dilaporkan belum tersambung.
  const tahapPerKunci = {};
  for (const satu of tahapan && Array.isArray(tahapan.tahap) ? tahapan.tahap : []) {
    tahapPerKunci[satu.kunci] = satu;
  }

  const pasangTahap = (kunci, medanTanggal, medanInput) => {
    const satu = tahapPerKunci[kunci];
    if (!satu) return;
    if (satu.terbaca && medanTanggal) fakta[medanTanggal] = satu.tanggal || null;
    if (satu.inputTerbaca) fakta[medanInput] = satu.diinput || null;
  };

  pasangTahap("pendaftaran", "", "tanggalInputPendaftaran");
  pasangTahap("pmh", "tanggalPmh", "tanggalInputPmh");
  pasangTahap("ppp", "tanggalPpp", "tanggalInputPpp");
  pasangTahap("pjs", "tanggalPjs", "tanggalInputPjs");
  pasangTahap("phs", "tanggalPhs", "tanggalInputPhs");

  const bantu = pendukung || {};

  // Lama mediasi dipotong dari waktu putus - lihat catatan pada penilaian.
  if (bantu.durasiMediasi && bantu.durasiMediasi.terbaca) {
    fakta.hariMediasi = bantu.durasiMediasi.hari;
  }

  // E-Dokumen petitum - SK Tabel 2 II.1.
  if (bantu.petitum && bantu.petitum.terbaca) fakta.adaDokPetitum = bantu.petitum.ada;

  // Kelengkapan dokumen relaas - SK Tabel 2 II.2. Yang seharusnya ada
  // sebanyak relaas yang tercatat; menghitungnya dari biaya panggilan
  // menuntut penafsiran tarif yang berbeda tiap radius.
  if (bantu.dokumenRelaas && bantu.dokumenRelaas.terbaca && bantu.dokumenRelaas.jumlah > 0) {
    fakta.relaasSeharusnya = bantu.dokumenRelaas.jumlah;
    fakta.relaasBerdokumen = bantu.dokumenRelaas.berdokumen;
  }

  // ------------------------------------------------------------------------
  // KELONGGARAN PERKARA KHUSUS - SK Tabel 2 nomor 1
  // ------------------------------------------------------------------------
  //
  // Perkara ghaib dan perkara berpihak PNS/TNI/POLRI memang berjalan lebih
  // lama karena hukum acaranya sendiri yang mengharuskan. Tanpa penanda ini,
  // majelis yang sudah bekerja benar dinilai lambat.
  if (bantu.penanda) {
    // Urutannya penting: kelonggaran mafqud (270 hari) lebih besar daripada
    // ghaib (120 hari), dan kelonggaranWaktuPutus memakai yang pertama cocok.
    // Perkara yang keduanya terindikasi berhak atas yang lebih besar.
    if (bantu.penanda.mafqud === true) fakta.perkaraMafqud = true;
    if (bantu.penanda.ghaib === true) fakta.perkaraGhaib = true;
    // Waktu menunggu izin atasan tidak tercatat tersendiri di SIPP. Yang dapat
    // dipastikan hanyalah bahwa izin itu DIPERLUKAN; berapa lama menunggunya
    // tidak ditebak, sebab menebaknya berarti memberi kelonggaran yang mungkin
    // tidak berhak.
    fakta.perluIzinAtasan = Boolean(bantu.penanda.perluIzinAtasan);
  }

  // ------------------------------------------------------------------------
  // RELAAS - SK Tabel 2 I.10
  // ------------------------------------------------------------------------
  //
  // penilaianRelaasPerkara sudah mencoba empat sumber berurutan: tabel
  // penilaian, kolom tanggal input, dan jejak audit. Yang sampai ke sini
  // hasilnya, beserta keterangan dari mana ia datang.
  const nilaiR = bantu.nilaiRelaas;
  if (nilaiR && nilaiR.terbaca) {
    if (typeof nilaiR.nilaiLangsung === "number") {
      // SIPP sudah menghitung sendiri. Nilai itu dipakai apa adanya - ia
      // catatan pengadilan, bukan tafsiran kita.
      fakta.nilaiRelaasLangsung = nilaiR.nilaiLangsung;
    } else {
      fakta.relaas = nilaiR.relaas;
    }
  } else if (Array.isArray(relaas) && relaas.length === 0) {
    // Tidak ada relaas sama sekali - ini terbaca, dan SK menilainya -5.
    fakta.relaas = [];
  }

  // ------------------------------------------------------------------------
  // MEDIASI - SK Tabel 2 I.11
  // ------------------------------------------------------------------------
  //
  // Yang dinilai SK sekadar terisi atau tidak. Yang dianggap terisi: ada
  // baris mediasi yang HASILNYA sudah dicatat. Baris kosong yang terbentuk
  // saat mediator ditetapkan belum berarti rapornya diisi.
  if (bantu.mediasiLengkap && bantu.mediasiLengkap.terbaca) {
    // ADA barisnya atau tidak - dipisahkan dari terisi atau tidak. Perkara
    // yang memang tidak melalui mediasi tidak boleh dinilai seolah
    // rapornya dilalaikan.
    fakta.adaMediasi = bantu.mediasiLengkap.baris.length > 0;
    fakta.rapotMediasiTerisi = bantu.mediasiLengkap.baris.some((x) => Boolean(x.hasil));
  } else if (bantu.durasiMediasi && bantu.durasiMediasi.terbaca && bantu.durasiMediasi.hari > 0) {
    // Mediasi yang lamanya tercatat berarti mediasinya memang berlangsung -
    // dan v_durasi_mediasi hanya menghasilkan angka bila datanya ada.
    fakta.adaMediasi = true;
    fakta.rapotMediasiTerisi = true;
  }

  // Saksi: kelengkapan identitasnya - SK Tabel 2 I.12.
  if (bantu.saksiLengkap && bantu.saksiLengkap.terbaca) {
    fakta.saksi = bantu.saksiLengkap.baris.map((x) => ({ isianTerisi: x.isianTerisi }));
  } else if (saksi && Number(saksi.jumlahSaksi) === 0) {
    fakta.saksi = [];
  }

  // ------------------------------------------------------------------------
  // PEMBERITAHUAN PUTUSAN - SK Tabel 2 I.13
  // ------------------------------------------------------------------------
  //
  // Hanya WAJIB bagi pihak yang tidak hadir saat putusan dibacakan - yang
  // hadir sudah mendengarnya sendiri. Kewajibannya ditentukan dari kode
  // kehadiran pada sidang putusan, bukan dari sudah-putus semata.
  //
  // Sumber tanggalnya perkara_putusan_pemberitahuan_putusan. Tabel yang
  // dibaca sebelumnya - perkara_pemberitahuan - berisi NOL baris di SIPP
  // yang berjalan, sehingga butir ini selalu jatuh ke nilai nol.
  if (sudahPutus && bantu.pbtPutusan && bantu.pbtPutusan.terbaca) {
    const pbt = bantu.pbtPutusan;
    fakta.kehadiranSidangPutusan = pbt.kehadiran || '';

    if (!pbt.wajib) {
      fakta.wajibPbt = false;
      fakta.alasanTidakWajibPbt = pbt.alasan || '';
    } else {
      fakta.wajibPbt = true;
      fakta.pbtPerPihak = pbt.baris.map((x) => ({
        sebutan: x.sebutan,
        tanggal: x.tanggal,
        hari: x.hari,
      }));

      const berhari = pbt.baris.filter((x) => x.hari !== null);
      // Yang dinilai pelaksanaan PALING LAMBAT: itulah yang menentukan kapan
      // seluruh pihak yang tidak hadir sudah diberitahu. Pihak yang BELUM
      // diberitahu sama sekali membuat butirnya belum terlaksana.
      fakta.hariPbt =
        berhari.length === pbt.baris.length && berhari.length > 0
          ? Math.max(...berhari.map((x) => x.hari))
          : null;
    }
  }


  // Sisa panjar - SK Tabel 2 I.15.
  if (bantu.sisaPanjar && bantu.sisaPanjar.terbaca) {
    const kembali = bantu.sisaPanjar.baris.filter((x) => x.tanggal && x.hariSampaiInput !== null);
    fakta.hariInputSisaPanjar = kembali.length > 0 ? kembali[0].hariSampaiInput : null;
  }

  // Arsip - SK Tabel 2 I.16, diukur dari akta cerai atau dari BHT.
  if (bantu.arsip && bantu.arsip.terbaca) {
    const acuanArsip =
      putusan && putusan.aktaCerai && putusan.aktaCerai.tanggal
        ? putusan.aktaCerai.tanggal
        : putusan && putusan.tanggalBht
          ? putusan.tanggalBht
          : "";
    const diinput = bantu.arsip.baris.find((x) => x.tanggal);
    fakta.hariInputArsip =
      acuanArsip && diinput ? sippTahapanService.selisihHari(acuanArsip, diinput.tanggal) : null;
  }

  // Delegasi MASUK - SK Tabel 2 I.17. Yang dinilai penerimaan paling LAMBAT:
  // satu delegasi yang tertinggal tidak boleh tertutup oleh yang cepat.
  if (bantu.delegasiMasuk && bantu.delegasiMasuk.terbaca) {
    const berhari = bantu.delegasiMasuk.baris.filter((x) => x.hariSampaiTerima !== null);
    fakta.hariTerimaDelegasi =
      berhari.length > 0 ? Math.max(...berhari.map((x) => x.hariSampaiTerima)) : null;
  } else if (bantu.delegasi && bantu.delegasi.terbaca) {
    const adaDelegasi = bantu.delegasi.baris.find((x) => x.tanggal);
    fakta.hariTerimaDelegasi =
      adaDelegasi && adaDelegasi.hariSampaiInput !== null ? adaDelegasi.hariSampaiInput : null;
  }

  // Delegasi KELUAR (tabayun) - SK Tabel 2 III.3, unsur pengurang. Yang
  // dinilai permohonan yang paling MEPET ke hari sidang.
  if (bantu.delegasiKeluar && bantu.delegasiKeluar.terbaca) {
    // Hanya delegasi PANGGILAN yang dinilai - delegasi pemberitahuan bukan
    // pemanggilan, dan SK III.3 menilai kepatutan waktu pemanggilan.
    const berjarak = bantu.delegasiKeluar.baris.filter(
      (x) => x.panggilan && x.hariSebelumSidang !== null
    );
    fakta.hariSebelumSidangDelegasi =
      berjarak.length > 0 ? Math.min(...berjarak.map((x) => x.hariSebelumSidang)) : null;
  }

  // Unggah naskah putusan - SK Tabel 2 huruf c.
  if (sudahPutus && bantu.unggahPutusan && bantu.unggahPutusan.terbaca) {
    fakta.tanggalUnggahPutusan = bantu.unggahPutusan.tanggal || null;
  }

  // Unggah BAS - SK Tabel 2 II.3.
  if (bantu.unggahBas && bantu.unggahBas.terbaca) {
    const sidangAda = bantu.unggahBas.baris.filter((x) => x.tanggalSidang);
    if (sidangAda.length > 0) {
      fakta.bas = sidangAda.map((x) => ({
        tanggalSidang: x.tanggalSidang,
        tanggalUnggah: x.diunggah || null,
      }));
    }
  }

  return fakta;
}

/**
 * ============================================================================
 * MAJELIS DAN PETUGAS - PEMERIKSA, BUKAN YANG AKTIF SEKARANG
 * ============================================================================
 *
 * Dulu bagian ini meneruskan majelis Jadwal Sidang (majelisPerkara) - baris
 * penunjukan yang AKTIF. SIPP menonaktifkan majelis pemeriksaan begitu majelis
 * ikrar talak ditetapkan, jadi pada perkara cerai talak yang sudah ikrar
 * layar ini menulis majelis IKRAR sebagai majelis perkara: perkara_id 385
 * tertulis diketuai Ulfah (ketua ikrar), padahal yang memeriksa dan memutus
 * Muh. Arasy Latif. Pada data lama yang seluruh barisnya T (perkara_id 1, 4,
 * 384) layar bahkan menulis "Majelis belum ditetapkan".
 *
 * Sekarang majelis, panitera, dan juru sita = PEMERIKSA menurut
 * majelisPemeriksaService - aturan yang sama dengan rekap petugas - dan
 * majelis ikrar talak disebut tersendiri (`ikrar`), per peran dari penunjukan
 * tahapan 18 atau, bila tabel penunjukan tidak mencatatnya, dari borang ikrar
 * (ikrarLengkap). Majelis Jadwal Sidang TIDAK diubah: sidang ikrar memang
 * harus menampilkan majelis ikrar yang aktif.
 *
 * Bentuk tiap orang sama dengan sebelumnya ({ id, kode, nama, jabatan }) -
 * ringkasan salin, unduh lengkap, banding, dan rubrik membacanya apa adanya -
 * ditambah kedudukan, tahapanId, keterangan tahapan (verzet, banding, ...),
 * dan untuk ikrar `sumber`.
 *
 * Bila modul bersama gagal dibaca, yang tampil penunjukan AKTIF milik Jadwal
 * Sidang, dan itu DISEBUT lewat sumberMajelis "aktif" - layar tidak
 * menamainya majelis pemeriksa. Bila keduanya gagal: "tidakTerbaca".
 */
const SEBUTAN_TAHAPAN_PENUNJUKAN = Object.freeze({
  16: "verzet",
  20: "banding",
  30: "kasasi",
  40: "peninjauan kembali",
});

function keteranganTahapanPenunjukan(tahapanId) {
  const t = Number(tahapanId);
  if (!Number.isFinite(t) || t === majelisPemeriksaService.TAHAPAN_PEMERIKSAAN) return "";
  if (t === majelisPemeriksaService.TAHAPAN_IKRAR) return "";
  return SEBUTAN_TAHAPAN_PENUNJUKAN[t] || `tahapan ${t}`;
}

function petugasStatusPerkara(entri, cadangan) {
  if (!entri || !entri.pemeriksa) {
    // Keduanya membaca tabel penunjukan yang sama, jadi yang lazim gagal
    // bersama - dan daftar kosong itu "tidak terbaca", bukan "belum ditetapkan".
    if (!cadangan) return { majelis: [], panitera: [], jurusita: [], ikrar: null, sumberMajelis: "tidakTerbaca" };
    return {
      majelis: Array.isArray(cadangan.majelis) ? cadangan.majelis : [],
      panitera: Array.isArray(cadangan.panitera) ? cadangan.panitera : [],
      jurusita: Array.isArray(cadangan.jurusita) ? cadangan.jurusita : [],
      ikrar: null,
      sumberMajelis: "aktif",
    };
  }
  const tambahan = (x) => {
    const lain = { tahapanId: x.tahapanId || null, keteranganTahapan: keteranganTahapanPenunjukan(x.tahapanId) };
    if (x.sumber) lain.sumber = x.sumber;
    return lain;
  };
  const hakim = (x) => ({
    id: x.hakimId || null,
    kode: x.kode || "",
    nama: x.nama,
    jabatan: x.kedudukan,
    kedudukan: x.kedudukan,
    ...tambahan(x),
  });
  const panitera = (x) => ({ id: x.paniteraId || null, kode: x.kode || "", nama: x.nama, ...tambahan(x) });
  const jurusita = (x) => ({ id: x.jurusitaId || null, kode: x.kode || "", nama: x.nama, ...tambahan(x) });
  const ikrar = majelisPemeriksaService.ikrarLengkap(entri);
  return {
    majelis: entri.pemeriksa.hakim.map(hakim),
    panitera: entri.pemeriksa.panitera.map(panitera),
    jurusita: entri.pemeriksa.jurusita.map(jurusita),
    ikrar: ikrar
      ? {
          majelis: ikrar.hakim.map(hakim),
          panitera: ikrar.panitera.map(panitera),
          jurusita: ikrar.jurusita.map(jurusita),
        }
      : null,
    sumberMajelis: "pemeriksa",
  };
}

/**
 * Seluruh keadaan satu perkara, dari pendaftaran sampai produk pengadilan.
 *
 * ============================================================================
 * MEMANGGIL LAYANAN YANG SUDAH ADA, BUKAN MENYALIN KUERINYA
 * ============================================================================
 *
 * Majelis, relaas, putusan, dan dokumen sudah punya pembacanya masing-masing
 * yang dipakai layar Jadwal Sidang. Menyalin kuerinya ke sini berarti punya dua
 * jalur yang dapat berbeda perilaku - dan yang satu ini akan lebih jarang
 * diperhatikan orang.
 *
 * ============================================================================
 * TIAP BAGIAN GAGAL SENDIRI-SENDIRI
 * ============================================================================
 *
 * Satu sumber yang tidak terbaca tidak boleh mengosongkan seluruh layar.
 * Bagian yang gagal tampil kosong dengan keterangannya, sisanya tetap terisi.
 */
async function statusLengkap(nomorPerkaraMentah) {
  const nomorPerkara = normalizeCaseNumber(nomorPerkaraMentah);
  if (!nomorPerkara) return { ok: false, alasan: "nomor_perkara_kosong" };

  const identitas = await identitasPerkara(nomorPerkara);
  if (!identitas) return { ok: false, alasan: "perkara_tidak_ditemukan" };

  const aman = async (kerja, cadangan) => {
    try {
      return await kerja();
    } catch {
      return cadangan;
    }
  };

  // Tahapan dan tabel pendukungnya dibaca bersamaan dengan yang lain. Tiap
  // bagian gagal sendiri-sendiri: SIPP versi lama yang tidak punya tabel
  // pemberitahuan tidak boleh mengosongkan seluruh layar.
  const [rincian, biaya, penundaan, panggilanEcourt, dokumen, konteks, penunjukan] = await Promise.all([
    aman(() => sippJadwalSidangService.rincianSidang(nomorPerkara, 0), null),
    aman(() => biayaPerkara(identitas.perkaraId), { panjar: 0, terpakai: 0, sisa: 0 }),
    aman(() => riwayatPenundaan(identitas.perkaraId), []),
    aman(() => ecourtStoreService.bacaPanggilanPerkara(nomorPerkara), { pihak: [], panggilan: [] }),
    aman(() => ecourtStoreService.rincianArsipPerkara(nomorPerkara), { dokumen: [] }),
    aman(() => sippKonteksService.getKonteks(nomorPerkara), null),
    // Majelis PEMERIKSA dan ikrar talak - bukan majelis aktif Jadwal Sidang.
    aman(() => majelisPemeriksaService.penunjukanPerkaraBanyak([identitas.perkaraId]), null),
  ]);
  const petugas = petugasStatusPerkara(
    penunjukan instanceof Map ? penunjukan.get(String(identitas.perkaraId)) : null,
    rincian && rincian.ok ? rincian : null
  );

  const [
    tahapan,
    upayaHukum,
    pemberitahuan,
    mediasi,
    arsipSipp,
    delegasi,
    sisaPanjar,
    unggahPutusan,
    unggahBas,
    saksiLengkap,
    relaasInput,
  ] = await Promise.all([
    aman(() => sippTahapanService.tahapanPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.upayaHukumPerkara(identitas.perkaraId), []),
    aman(() => sippTahapanService.pemberitahuanPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.mediasiPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.arsipPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.delegasiPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.sisaPanjarPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.unggahPutusanPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.unggahBasPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.saksiLengkapPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.relaasBerinputPerkara(identitas.perkaraId), null),
  ]);

  // Penanda perkara dibaca SETELAH tahapan, karena salah satu pencirinya
  // adalah jarak PHS ke sidang pertama - dan itu baru diketahui dari tahapan.
  const tanggalPhs = tahapan && Array.isArray(tahapan.tahap)
    ? (tahapan.tahap.find((x) => x.kunci === "phs") || {}).tanggal || ""
    : "";

  const [
    penanda,
    saksiLengkapBaru,
    mediasiLengkap,
    penetapanKembali,
    durasiMediasi,
    petitum,
    dokumenRelaas,
    nilaiRelaas,
    delegasiMasuk,
    delegasiKeluar,
    arsipKeterangan,
    putusanLengkap,
    ikrarTalak,
    konseptor,
    courtCalendar,
  ] = await Promise.all([
    aman(
      () =>
        sippTahapanService.penandaPerkara(identitas.perkaraId, {
          tanggalPhs,
          sidangPertama: tahapan ? tahapan.sidangPertama : "",
        }),
      null
    ),
    aman(() => sippTahapanService.saksiLengkapPerkaraBaru(identitas.perkaraId), null),
    aman(() => sippTahapanService.mediasiLengkapPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.penetapanKembaliPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.durasiMediasiPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.petitumPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.dokumenRelaasPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.penilaianRelaasPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.delegasiMasukPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.delegasiKeluarPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.arsipKeteranganPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.putusanLengkapPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.ikrarTalakPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.konseptorPutusanPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.courtCalendarPerkara(identitas.perkaraId), null),
  ]);

  const pendukung = {
    pemberitahuan,
    mediasi,
    arsip: arsipSipp,
    delegasi,
    sisaPanjar,
    unggahPutusan,
    unggahBas,
    saksiLengkap: saksiLengkapBaru || saksiLengkap,
    relaasInput,
    penanda,
    mediasiLengkap,
    durasiMediasi,
    petitum,
    dokumenRelaas,
    nilaiRelaas,
    delegasiMasuk,
    delegasiKeluar,
  };

  const putusan = rincian && rincian.ok ? rincian.putusan : null;

  // Pemberitahuan putusan menuntut tanggal putusannya lebih dulu, jadi ia
  // dibaca SESUDAH putusan diketahui - bukan bersama rombongan di atas.
  //
  // Gagal-terbuka: bila tabelnya tidak ada pada SIPP versi lain, butirnya
  // dilaporkan belum tersambung, bukan dinilai nol.
  pendukung.pbtPutusan = await aman(
    () =>
      sippTahapanService.pemberitahuanPutusanPerkara(
        identitas.perkaraId,
        putusan ? putusan.tanggalPutusan : ""
      ),
    null
  );
  const jadwal = rincian && rincian.ok ? rincian.jadwalPerkara || [] : [];
  const nomorPihak = konteks && konteks.ok ? konteks.nomorPihak : [];

  // --- umur perkara --------------------------------------------------------
  //
  // Perkara yang sudah diputus dihitung sampai putusannya; yang masih berjalan
  // dihitung sampai HARI INI. Menghitung keduanya sampai hari ini membuat
  // perkara lama yang sudah selesai tampak terus memburuk.
  // ------------------------------------------------------------------------
  // CABUT DAN GUGUR JUGA MEMBAWA TANGGAL PUTUSAN
  // ------------------------------------------------------------------------
  //
  // Dikonfirmasi langsung dari SIPP yang berjalan: perkara yang berakhir
  // karena dicabut atau gugur TETAP mengisi tanggal_putusan, sama seperti
  // perkara yang diputus. Karena itu "sudahPutus" sudah mencakup ketiganya,
  // jam umurnya sudah berhenti pada tempatnya, dan saringan "perkara berjalan"
  // sudah tidak memuatnya.
  //
  // Ini ditulis supaya tidak ada yang menambahkan jalur cadangan lewat
  // tanggal_cabut dan tanggal_gugur - jalur yang tidak akan pernah terpakai,
  // dan yang keberadaannya justru menyiratkan keadaan yang tidak ada.
  //
  // Yang tetap berguna dari kedua kolom itu hanya SEBUTANNYA: layar menyebut
  // "sampai dicabut" alih-alih "sampai putus", sebab keduanya memang bukan
  // peristiwa yang sama bagi yang membacanya.
  const sebabSelesai = !putusan || !putusan.sudahPutus
    ? ""
    : putusan.tanggalCabut
      ? "dicabut"
      : putusan.tanggalGugur
        ? "gugur"
        : "putus";

  const hariBerjalan = selisihHari(
    identitas.tanggalDaftar,
    putusan && putusan.sudahPutus ? putusan.tanggalPutusan : null
  );

  const hariMinutasi =
    putusan && putusan.sudahPutus && putusan.tanggalMinutasi
      ? selisihHari(putusan.tanggalPutusan, putusan.tanggalMinutasi)
      : null;

  // Berapa hari sejak putusan sampai HARI INI. Dipakai membedakan berkas yang
  // tenggang minutasinya masih berjalan dari berkas yang tenggangnya sudah
  // lewat - dua keadaan yang sangat berbeda dan dulu dinilai sama-sama nol.
  const hariSejakPutus =
    putusan && putusan.sudahPutus && putusan.tanggalPutusan
      ? selisihHari(putusan.tanggalPutusan, null)
      : null;

  // ------------------------------------------------------------------------
  // UMUR YANG DINILAI: HARI BERSIH
  // ------------------------------------------------------------------------
  //
  // Hari pendaftaran ikut dihitung, lalu lama mediasi dipotong - persis cara
  // SK menghitungnya. Inilah angka yang ditampilkan besar di layar beserta
  // warnanya, dan karena itu inilah yang harus dinilai.
  //
  // Dulu tidak: layar mewarnai hariBersih sementara rubrik menilai hari
  // mentah. Perkara bermediasi 40 hari yang selesai pada hari ke-120 tampil
  // HIJAU di layar - bersihnya 81 hari - sementara rubrik menilainya seolah
  // 120 hari dan memotong separuh bobot lama penyelesaian. Yang dilihat
  // petugas dan yang dihitung mesin bukan angka yang sama, dan justru perkara
  // bermediasi - yang potongannya memang disediakan untuk melindunginya -
  // yang paling dirugikan.
  const hariMediasi = durasiMediasi && durasiMediasi.terbaca ? Math.max(0, durasiMediasi.hari) : 0;
  const hariBersih = (() => {
    if (hariBerjalan === null) return null;
    const kotor = hariBerjalan + 1;
    // Dijepit sama seperti pada penilaian SK - lihat penilaianSippService.
    const dipotong = Math.min(hariMediasi, Math.max(0, kotor - 1));
    return kotor - dipotong;
  })();

  // --- keadaan panggilan ---------------------------------------------------
  //
  // Dinilai untuk SATU sidang: yang terakhir punya relaas. Dulu relaas seluruh
  // perkara dicampur dengan tanggal sidang terakhir - relaas sidang lama
  // dinilai terhadap sidang yang tidak pernah ia panggil. Sisi yang wajib
  // dipanggil dibaca dari kehadiran sidang sebelumnya, sama seperti skor
  // kesiapan; tanpa itu pihak yang hadir tertandai belum dipanggil.
  //
  // sidangId dan sisiWajib WAJIB dikirim bersama. Menyaring per sidang tanpa
  // sisi wajib menandai penggugat yang hadir sebagai belum dipanggil. Bila
  // kueri kehadirannya gagal, sisiWajib null dan seluruh pihak dianggap wajib
  // dipanggil - gagal-tertutup, disengaja.
  const relaasPerkara = rincian && rincian.ok ? rincian.relaas || [] : [];
  const sidangBerelaas = new Set(relaasPerkara.map((r) => String(r.sidangId || "")).filter(Boolean));
  const sidangAcuan =
    [...jadwal].reverse().find((x) => sidangBerelaas.has(String(x.sidangId))) ||
    (jadwal.length > 0 ? jadwal[jadwal.length - 1] : null);
  const keadaanAcuan =
    sidangAcuan && rincian && rincian.ok && rincian.perkaraId
      ? await aman(
          () =>
            sippJadwalSidangService.keadaanPanggilanSidang([
              { sidangId: sidangAcuan.sidangId, perkaraId: rincian.perkaraId },
            ]),
          null
        )
      : null;
  const wajibAcuan =
    keadaanAcuan && sidangAcuan && keadaanAcuan[String(sidangAcuan.sidangId)]
      ? keadaanAcuan[String(sidangAcuan.sidangId)].wajibDipanggil
      : null;
  const keadaanPanggilan = ecourtPanggilanService.susunKeadaanPanggilan({
    persetujuan: panggilanEcourt.pihak,
    panggilan: panggilanEcourt.panggilan,
    relaas: relaasPerkara,
    tanggalSidang: sidangAcuan ? sidangAcuan.tanggalSidang : null,
    sidangId: sidangAcuan ? sidangAcuan.sidangId : null,
    lewatEcourt: rincian && rincian.ok ? rincian.lewatEcourt === true : false,
    sisiWajib: wajibAcuan,
  });

  // ==========================================================================
  // YANG DINILAI HANYA PIHAK YANG WAJIB DIPANGGIL
  // ==========================================================================
  //
  // Sejak relaas dinilai per sidang, pihak yang hadir pada sidang sebelumnya
  // lazimnya tidak punya relaas untuk sidang acuan - dan memang tidak perlu.
  // Membaginya dengan seluruh pihak membuat rubrik menulis "1 dari 2 pihak
  // dipanggil patut" dan analisa menulis "1 dari 2 pihak belum dipanggil
  // secara patut" atas penggugat yang hadir (perkara 521/Pdt.G/2026 - diukur
  // 770 dari 1.703 perkara berelaas sejak 2025 punya sisi seperti itu).
  // Pihak tidak wajib yang TOH dipanggil tetap dinilai: relaasnya fakta.
  const pihakWajib = keadaanPanggilan.pihak.filter((p) => !(p.tidakPerluDipanggil && !p.sudahDikirim));
  const panggilanWajib = {
    jumlahPihak: pihakWajib.length,
    patut: pihakWajib.filter((p) => p.kepatutan && p.kepatutan.patut === true).length,
    tidakWajib: keadaanPanggilan.pihak.length - pihakWajib.length,
  };

  // --- sidang yang sudah berlalu, dan berapa yang ada BAS-nya --------------
  const hariIni = isoTanggal(new Date());
  const sidangLewat = jadwal.filter((x) => x.tanggalSidang && x.tanggalSidang < hariIni);
  const basAda = sidangLewat.filter((x) => x.adaBas).length;

  const penilaian = penilaianPerkaraService.nilaiPerkara({
    hariBerjalan,
    // Yang dinilai hari bersih - angka yang sama dengan yang dibaca petugas
    // di layar. hariBerjalan tetap dikirim untuk keterangannya.
    hariBersih,
    sudahPutus: Boolean(putusan && putusan.sudahPutus),
    // Daftar yang SAMA dengan yang tampil di layar - bila rubrik membaca
    // penunjukan aktif, perkara lama yang seluruh barisnya T dinilai "majelis
    // belum ditetapkan" sementara layarnya menyebut majelisnya.
    majelis: petugas.majelis,
    panitera: petugas.panitera,
    pihak: nomorPihak,
    nomorPihakBermasalah: nomorPihak.filter(
      (n) => !n.adaNomor || n.statusVerifikasi === "ditolak" || n.statusVerifikasi === "menunggu"
    ).length,
    panggilan: panggilanWajib,
    sidangLewat: sidangLewat.length,
    basAda,
    adaBerkasPutusan: Boolean(putusan && putusan.adaBerkasPutusan),
    adaBerkasAnonim: Boolean(putusan && putusan.adaBerkasAnonim),
    hariMinutasi,
    hariSejakPutus,
  });

  // Nilai menurut SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024. Dipisah dari
  // rubrik ALETA di atas: yang satu aturan resmi, yang satu penilaian sendiri.
  const penilaianSk = penilaianSippService.poinPerkara(
    faktaPenilaianSk({
      identitas,
      putusan,
      jadwal,
      relaas: rincian && rincian.ok ? rincian.relaas : null,
      saksi: rincian && rincian.ok ? rincian.saksi : null,
      sidangLewat: sidangLewat.length,
      basAda,
      tahapan,
      pendukung,
    }),
    { jenisPengadilan: "pertama" }
  );

  // Gagal-terbuka: keadaan putusan e-Court keterangan pelengkap. Bila
  // tabelnya belum ada - pemasangan yang belum pernah menjalankan penarikan -
  // sisanya tetap tampil seperti biasa.
  const putusanEcourt = await aman(
    () =>
      putusanEcourtService.keadaanSatu(identitas.nomorPerkara, {
        sudahPutus: Boolean(putusan && putusan.sudahPutus),
        tanggalPutusan: putusan ? putusan.tanggalPutusan : "",
      }),
    null
  );
  return {
    ok: true,
    alasan: "",
    identitas,
    umur: {
      hariBerjalan,
      sudahPutus: Boolean(putusan && putusan.sudahPutus),
      // Cabut dan gugur tetap berakhir dengan tanggal putusan, tetapi bukan
      // peristiwa yang sama bagi yang membaca layar. Sebutannya dipisah supaya
      // keterangan umurnya berbunyi "sampai dicabut", bukan "sampai putus".
      sebabSelesai,
      hariMinutasi,
      // ====================================================================
      // DUA ANGKA, DUA PERTANYAAN
      // ====================================================================
      //
      // hariBerjalan  - selisih mentah pendaftaran ke putusan
      // hariBersih    - yang DINILAI: hari pendaftaran ikut dihitung, lalu
      //                 lama mediasi dipotong
      //
      // Yang ditampilkan besar di layar hariBersih, sebab itulah yang
      // menentukan nilai. Yang mentah tetap disebutkan dalam kurung supaya
      // dapat dicocokkan dengan tanggal pada berkas.
      hariMediasi,
      hariBersih,
      // Umur dalam bulan, dibulatkan - itulah satuan yang dipakai laporan.
      // Dihitung dari hari BERSIH, sama seperti angka besar di layar dan sama
      // seperti yang dinilai. Menghitungnya dari hari mentah membuat satu
      // layar memuat dua umur yang berbeda untuk perkara yang sama.
      bulanBerjalan: hariBersih === null ? null : Math.round((hariBersih / 30) * 10) / 10,
    },
    // Majelis, panitera, dan juru sita PEMERIKSA; majelis ikrar talak di
    // `ikrar` - lihat petugasStatusPerkara. sumberMajelis "aktif" bila modul
    // bersama gagal dibaca dan yang tampil penunjukan aktif Jadwal Sidang,
    // "tidakTerbaca" bila keduanya gagal.
    majelis: petugas.majelis,
    panitera: petugas.panitera,
    jurusita: petugas.jurusita,
    ikrar: petugas.ikrar,
    sumberMajelis: petugas.sumberMajelis,
    saksi: rincian && rincian.ok ? rincian.saksi : { ada: false, jumlahSaksi: 0, jumlahKeterangan: 0 },
    pihak: nomorPihak,
    identitasPihak: konteks && konteks.ok ? konteks.identitas : null,
    jadwal,
    penundaan,
    relaas: rincian && rincian.ok ? rincian.relaas : [],
    panggilan: keadaanPanggilan,
    putusan,
    biaya,
    dokumenEcourt: dokumen.dokumen || [],
    dokumenSipp: rincian && rincian.ok ? rincian.dokumenSipp : [],
    // Surat gugatan atau permohonan - berkas yang paling sering dicari, dan
    // tempatnya BUKAN di perkara_dokumen melainkan pada kolom petitum tabel
    // perkara. Tanpa diteruskan ke sini, layar status perkara menampilkan
    // daftar lampiran tanpa berkas pokoknya.
    petitum: rincian && rincian.ok ? rincian.petitum || { ada: false } : { ada: false },
    lewatEcourt: rincian && rincian.ok ? rincian.lewatEcourt === true : false,
    penilaian,
    penilaianSk,
    // Garis waktu, jeda antar sidang, ketepatan input, dan ringkasan - seluruhnya
    // dirakit dari data di atas, tanpa satu pun kueri tambahan ke SIPP.
    analisa: analisaPerkaraService.analisaPerkara({
      tanggalDaftar: identitas.tanggalDaftar,
      hariIni,
      sudahPutus: Boolean(putusan && putusan.sudahPutus),
      sebabSelesai,
      putusan: putusan || {},
      tahapan,
      jadwal,
      biaya,
      panggilan: {
        ...keadaanPanggilan.ringkasan,
        jumlahPihak: panggilanWajib.jumlahPihak,
        patut: panggilanWajib.patut,
      },
      penilaian,
      hariBerjalan,
      hariBersih,
      hariMediasi,
      hariSejakPutus,
      ambangMinutasi: penilaian.pengaturan.hariMinutasi,
      ambangHari: penilaian.pengaturan.bulanNol * 30,
    }),
    // Tahapan dari pendaftaran sampai penetapan hari sidang, beserta kapan
    // masing-masing diinput ke SIPP.
    tahapan: tahapan || { terbaca: false, alasan: "Tahapan tidak terbaca.", tahap: [] },
    upayaHukum: Array.isArray(upayaHukum) ? upayaHukum : [],
    // Penanda yang mengubah cara perkara dinilai dan ditangani.
    penanda: penanda || { ghaib: null, sumberGhaib: [], instansi: [], perluIzinAtasan: false },
    penetapanKembali: penetapanKembali || { terbaca: false, adaPenggantian: false, baris: [] },
    durasiMediasi: durasiMediasi || { terbaca: false, hari: 0, alasan: "" },
    delegasiMasuk: delegasiMasuk || { terbaca: false, alasan: "", baris: [] },
    delegasiKeluar: delegasiKeluar || { terbaca: false, alasan: "", baris: [] },
    arsipKeterangan: arsipKeterangan || { terbaca: false, alasan: "", sudahDiarsipkan: false, baris: [] },
    putusanLengkap: putusanLengkap || { terbaca: false, ada: false },
    // Apakah putusannya benar-benar terbit di e-Court: barisnya ada, salinannya
    // diunggah, dan Panitera sudah menandatanganinya. Ketiganya dapat gagal
    // tanpa satu pun peringatan - lihat catatan pada putusanEcourtService.
    putusanEcourt,
    ikrarTalak: ikrarTalak || { terbaca: false, ada: false, alasan: "" },
    konseptor: konseptor || { terbaca: false, alasan: "", baris: [] },
    // Court Calendar - RENCANA sidang yang disusun majelis. Selisihnya
    // dengan perkara_jadwal_sidang yang berguna, bukan salah satunya saja.
    courtCalendar: courtCalendar || { terbaca: false, alasan: "", baris: [] },
    nilaiRelaas: nilaiRelaas || { terbaca: false, alasan: "", sumber: "", relaas: [] },
    dokumenRelaas: dokumenRelaas || { terbaca: false, jumlah: 0, berdokumen: 0, berresi: 0 },
    saksiRinci: saksiLengkapBaru || { terbaca: false, alasan: "", baris: [] },
    mediasi: mediasiLengkap || { terbaca: false, alasan: "", baris: [] },
    pendukungSipp: {
      pemberitahuan,
      mediasi,
      arsip: arsipSipp,
      delegasi,
      sisaPanjar,
      unggahBas,
      relaasInput,
    },
    pesanSipp: rincian && rincian.ok ? "" : "Sebagian keterangan SIPP belum dapat dibaca.",
  };
}

module.exports = {
  ALUR_PENCARIAN,
  PUTUSAN_PENCARIAN,
  RELAAS_PENCARIAN,
  UMUR_PENCARIAN,
  // Dibuka supaya penjaga uji dapat MEMBANDINGKANNYA dengan syarat tag
  // tunggakan pada tagPerkaraService. Keduanya tidak dapat berbagi teks -
  // saringan ini memakai NOT EXISTS berkorelasi sedangkan tag memakai
  // sambungan turunan yang jauh lebih murah - tetapi JAWABANNYA wajib sama,
  // dan yang menahannya penjaga, bukan kebetulan.
  UMUR_SYARAT,
  STATUS_PENCARIAN,
  biayaPerkara,
  faktaPenilaianSk,
  cariPerkara,
  cariPerkaraHalaman,
  // Dibuka untuk penjaga uji: daftar tabel pihak yang harus dijangkau, pagu
  // baris per halaman, dan panjang nomor urut.
  TABEL_PIHAK,
  PAGU_BARIS,
  PANJANG_NOMOR_URUT,
  // Galat habis waktu pencarian dalam bahasa orangnya - dipakai rute cari,
  // yang juga menjemput daftar tag sebelum pencariannya sendiri.
  KODE_PENCARIAN_HABIS_WAKTU,
  pesanGalatPencarian,
  identitasPerkara,
  isoTanggal,
  // Dibuka untuk uji muatan "Majelis dan petugas" tanpa basis data.
  petugasStatusPerkara,
  riwayatPenundaan,
  selisihHari,
  statusLengkap,
};
