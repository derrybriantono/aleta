"use strict";

/**
 * ============================================================================
 * BAHAN PERINTAH PENYUSUNAN PUTUSAN
 * ============================================================================
 *
 * Yang dijaga di sini adalah hal-hal yang salah tanpa memberi tanda apa pun:
 *
 *   1. `aktif = 'Y'`, BUKAN `aktif = 1`. Kolomnya berisi huruf. Membandingkan
 *      dengan angka membuat kueri kuasa hukum pulang KOSONG tanpa galat, dan
 *      seluruh 508 baris kuasa yang ada lenyap diam-diam - perintahnya lalu
 *      menyatakan "pihak hadir sendiri" pada perkara yang berkuasa hukum.
 *
 *   2. SAKSI IKUT TERBAWA SEBAGAI PIHAK. Pada v_pihak_perkara, saksi adalah
 *      pihak_ke 5 - 16.466 baris, lebih banyak daripada penggugatnya sendiri.
 *      Tanpa penyaringan, daftar penggugat berisi nama saksi.
 *
 *   3. SATU TABEL RUSAK TIDAK BOLEH MENGHAPUS SISANYA. Tiap bagian dibungkus
 *      sendiri; mediasi yang gagal dibaca tidak boleh menghilangkan jadwal
 *      sidang yang sebenarnya sudah terbaca.
 *
 *   4. TIDAK ADA TULISAN KE SIPP. Seluruhnya SELECT.
 *
 * Berjalan tanpa jaringan dan tanpa basis data - db_config diganti penadah.
 */

let lulus = 0;
let gagal = 0;

function periksa(nama, benar) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}`);
  }
}

// ---------------------------------------------------------------- penadah
const kueri = [];
let rusakkan = null;

const dbPath = require.resolve("../db_config");
require("../db_config");
require.cache[dbPath].exports = {
  query: (sql, params, selesai) => {
    const teks = String(sql);
    kueri.push({ sql: teks, params: Array.isArray(params) ? params : [] });

    if (rusakkan && rusakkan.test(teks)) {
      selesai(new Error("tabel tidak ada"), null);
      return;
    }

    if (/FROM perkara p WHERE p\.nomor_perkara = \?/.test(teks)) {
      // Penadah menghormati parameternya - kalau tidak, nomor apa pun akan
      // "ditemukan" dan pemeriksaan perkara asing kehilangan artinya.
      if (params[0] !== "359/Pdt.G/2026/PA.Dgl") {
        selesai(null, []);
        return;
      }
      selesai(null, [
        {
          perkaraId: 9862,
          nomorPerkara: "359/Pdt.G/2026/PA.Dgl",
          jenisPerkara: "Cerai Talak",
          tanggalDaftar: "2026-06-11",
        },
      ]);
      return;
    }

    // Pihak - sengaja disisipi satu baris saksi (pihak_ke 5) persis seperti
    // yang dipulangkan v_pihak_perkara pada SIPP sungguhan.
    if (/FROM v_pihak_perkara vp WHERE vp\.perkara_id = \?/.test(teks)) {
      selesai(null, [
        { nama: "Ewardin bin Lasan", pihakKe: 1, alamat: "Donggala" },
        { nama: "Nurhayati binti Salam", pihakKe: 2, alamat: "Donggala" },
        { nama: "Aswadi bin Arni", pihakKe: 5, alamat: "Donggala" },
      ]);
      return;
    }

    if (/ecourt_kuasa_hukum/.test(teks)) {
      selesai(null, [{ pihakKe: 1, klien: "Ewardin bin Lasan", kuasa: "Amit Suaib, S.H." }]);
      return;
    }

    if (/FROM perkara_jadwal_sidang j/.test(teks)) {
      selesai(null, [
        {
          tanggalSidang: "2026-06-25",
          agenda: "Sidang Pertama",
          alasanDitunda: "Proses Mediasi",
          dihadiri: "1",
        },
        {
          tanggalSidang: "2026-07-15",
          agenda: "Jawaban Termohon",
          alasanDitunda: "",
          dihadiri: "2",
        },
        { tanggalSidang: "2026-08-11", agenda: "Pembacaan putusan", alasanDitunda: "", dihadiri: "99" },
      ]);
      return;
    }

    if (/FROM perkara_mediasi md/.test(teks)) {
      selesai(null, [
        {
          mediator: "Himawan Tatura Wijaya, S.H.I., M.H.",
          dimulai: "2026-06-25",
          penetapan: null,
          tanggalLaporan: "2026-07-08",
          tanggalKesepakatan: "2026-07-08",
          tanggalPengajuan: null,
          hasil: "s",
          isiKesepakatan: "<ol><li>kesepakatan sebagian;</li></ol>",
        },
      ]);
      return;
    }

    if (/FROM perkara_pihak5 p5/.test(teks)) {
      selesai(null, [
        { nama: "Aswadi bin Arni", pihakKe: 1, alamat: "Donggala" },
        { nama: "Abd. Salam bin Udin", pihakKe: 1, alamat: "Donggala" },
      ]);
      return;
    }

    selesai(null, []);
  },
};

// Arsip e-Court dibaca lewat layanan lain - ditadah supaya uji ini tidak ikut
// menguji basis data ALETA.
const arsipPath = require.resolve("../services/ecourtStoreService");
require("../services/ecourtStoreService");
require.cache[arsipPath].exports = {
  ...require.cache[arsipPath].exports,
  /**
   * Bentuk jawabannya disalin PERSIS dari layanan arsip yang sebenarnya.
   *
   * Ruasnya `adaPdf`/`adaWord` - boolean - bukan `berkasPdf`/`berkasWord`.
   * Penadah yang memakai nama ruas karangan pernah membuat seluruh uji lolos
   * sementara daftar lampiran di peladen keluar KOSONG pada perkara yang
   * dokumennya justru lengkap.
   */
  rincianArsipPerkara: async () => ({
    dokumen: [
      {
        documentKey: "b8ce227b5b2f9affeaf5eb8e092d58a2f104c533",
        judulDokumen: "SURAT GUGATAN (Docx/Rtf)",
        jenisDokumen: "",
        peranPengunggah: "",
        statusVerifikasi: "tidak_perlu",
        diunggahPada: null,
        tanggalSidang: null,
        agenda: "Sidang Pertama",
        adaPdf: false,
        adaWord: true,
        // Nama berkas sungguhan - tersimpan pada jalur_berkas di
        // aleta_bot_ecourt_files, dan hanya dipulangkan bila berkasnya
        // benar-benar terbaca di disk.
        namaBerkasPdf: "",
        namaBerkasWord: "SURAT GUGATAN (DocxRtf)__afdc3c67.docx",
        ukuranByte: 27837,
      },
    ],
  }),
};

const layanan = require("../services/promptPutusanService");

function bersihkan() {
  kueri.length = 0;
  rusakkan = null;
}

async function utama() {
  console.log("");

  // ==========================================================================
  console.log("== Nomor perkara ==");
  {
    bersihkan();
    const kosong = await layanan.bahanPrompt("");
    periksa("nomor kosong ditolak", kosong.ok === false && kosong.alasan === "nomor_perkara_kosong");
    periksa("dan tidak menyentuh basis data", kueri.length === 0);

    bersihkan();
    const asing = await layanan.bahanPrompt("999/Pdt.G/1999/PA.XXX");
    periksa("perkara yang tidak ada dijawab apa adanya", asing.ok === false);
    periksa("sebabnya disebutkan", asing.alasan === "perkara_tidak_ditemukan");
    // Berhenti pada kueri identitas - tidak melanjutkan tujuh pembacaan lain
    // untuk perkara yang jelas tidak ada.
    periksa("berhenti setelah kueri identitas", kueri.length === 1);
  }

  // ==========================================================================
  console.log("\n== Seluruh kueri hanya membaca ==");
  {
    bersihkan();
    await layanan.bahanPrompt("359/Pdt.G/2026/PA.Dgl");
    periksa("ada kueri yang berjalan", kueri.length >= 7);
    periksa(
      "seluruhnya SELECT",
      kueri.every((k) => /^\s*SELECT\b/i.test(k.sql))
    );
    periksa(
      "tidak ada INSERT/UPDATE/DELETE/DROP",
      kueri.every((k) => !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i.test(k.sql))
    );
    periksa(
      "nomor perkara masuk sebagai parameter, bukan disambung ke teks kueri",
      kueri.every((k) => !k.sql.includes("359/Pdt.G/2026/PA.Dgl"))
    );
  }

  // ==========================================================================
  console.log("\n== Kuasa hukum ==");
  {
    bersihkan();
    const hasil = await layanan.bahanPrompt("359/Pdt.G/2026/PA.Dgl");
    const kueriKuasa = kueri.find((k) => k.sql.includes("ecourt_kuasa_hukum"));

    // Inti pemeriksaan berkas ini. `aktif` berisi 'Y'/'T'; membandingkannya
    // dengan angka 1 memulangkan kosong TANPA galat.
    periksa("kuasa disaring dengan aktif = 'Y'", Boolean(kueriKuasa) && kueriKuasa.sql.includes("kh.aktif = 'Y'"));
    periksa(
      "tidak membandingkan aktif dengan angka",
      Boolean(kueriKuasa) && !/kh\.aktif\s*=\s*1\b/.test(kueriKuasa.sql)
    );
    periksa("kuasa terbaca", hasil.kuasa.length === 1);
    periksa("namanya benar", hasil.kuasa[0].nama === "Amit Suaib, S.H.");
    periksa("kedudukan pihaknya disebut", hasil.kuasa[0].pihak === "Penggugat/Pemohon");
  }

  // ==========================================================================
  console.log("\n== Saksi tidak ikut terbawa sebagai pihak ==");
  {
    bersihkan();
    const hasil = await layanan.bahanPrompt("359/Pdt.G/2026/PA.Dgl");
    periksa("penggugat hanya satu orang", hasil.pihak.penggugat.length === 1);
    periksa(
      "nama saksi tidak masuk daftar penggugat",
      !hasil.pihak.penggugat.some((p) => p.nama === "Aswadi bin Arni")
    );
    periksa("tergugat terbaca", hasil.pihak.tergugat[0].nama === "Nurhayati binti Salam");
    periksa("saksi terbaca dari perkara_pihak5", hasil.saksi.length === 2);
    periksa("pihak yang menghadirkan saksi disebut", hasil.saksi[0].pihak === "Penggugat/Pemohon");
  }

  // ==========================================================================
  console.log("\n== Tanggal dan kehadiran ==");
  {
    bersihkan();
    const hasil = await layanan.bahanPrompt("359/Pdt.G/2026/PA.Dgl");
    periksa("tanggal terbaca disusun dalam bahasa Indonesia", hasil.sidang[0].tanggalTerbaca === "25 Juni 2026");
    periksa("tanggal ISO tetap disertakan", hasil.sidang[0].tanggal === "2026-06-25");
    periksa("kode kehadiran 1 diterjemahkan", hasil.sidang[0].kehadiran === "kedua pihak hadir");
    periksa("kode kehadiran 2 diterjemahkan", hasil.sidang[1].kehadiran === "Tergugat/Termohon tidak hadir");
    // Kode asing DISEBUTKAN apa adanya, bukan dibuang - yang membaca perlu
    // tahu ada kode yang belum dikenali, bukan mengira kehadirannya kosong.
    periksa("kode yang tidak dikenal disebut apa adanya", hasil.sidang[2].kehadiran === "kode 99");
  }

  // ==========================================================================
  console.log("\n== Mediasi ==");
  {
    bersihkan();
    const hasil = await layanan.bahanPrompt("359/Pdt.G/2026/PA.Dgl");
    periksa("mediasi ditandai ada", hasil.mediasi.ada === true);
    periksa("mediator terbaca", hasil.mediasi.mediator.startsWith("Himawan"));
    periksa("tanggal laporan mediator terbaca", hasil.mediasi.tanggalLaporanTerbaca === "8 Juli 2026");
    periksa("kode hasil dihurufbesarkan", hasil.mediasi.kodeHasil === "S");
    periksa("kode S diterjemahkan", hasil.mediasi.hasilTerbaca === "berhasil sebagian");
    // Isi kesepakatan sengaja TIDAK dibersihkan di sisi bot - layar yang
    // membersihkannya, sekaligus membiarkan penyusun menyuntingnya.
    periksa("isi kesepakatan dibawa apa adanya", hasil.mediasi.isiKesepakatan.includes("<ol>"));
  }

  // ==========================================================================
  console.log("\n== Kode hasil mediasi yang tidak baku ==");
  {
    // 'Y2' (45 baris) dan 'D' (22 baris) ada di SIPP tanpa arti yang pasti.
    // Menebaknya lebih buruk daripada mengosongkannya: yang memilih di layar
    // harus tahu bahwa ia sedang menentukan.
    periksa("hanya dua kode yang diterjemahkan", Object.keys(layanan.ARTI_HASIL_MEDIASI).length === 2);
    periksa("Y2 tidak punya terjemahan", layanan.ARTI_HASIL_MEDIASI.Y2 === undefined);
    periksa("D tidak punya terjemahan", layanan.ARTI_HASIL_MEDIASI.D === undefined);
  }

  // ==========================================================================
  console.log("\n== Satu tabel rusak tidak menghapus sisanya ==");
  {
    bersihkan();
    rusakkan = /FROM perkara_mediasi md/;
    const hasil = await layanan.bahanPrompt("359/Pdt.G/2026/PA.Dgl");
    periksa("hasilnya tetap terpakai", hasil.ok === true);
    periksa("mediasi dinyatakan tidak ada", hasil.mediasi.ada === false);
    periksa("jadwal sidang tetap terbaca", hasil.sidang.length === 3);
    periksa("saksi tetap terbaca", hasil.saksi.length === 2);
    periksa("pihak tetap terbaca", hasil.pihak.penggugat.length === 1);

    bersihkan();
    rusakkan = /FROM perkara_jadwal_sidang j/;
    const kedua = await layanan.bahanPrompt("359/Pdt.G/2026/PA.Dgl");
    periksa("jadwal rusak tidak menjatuhkan mediasi", kedua.mediasi.ada === true);
    periksa("jadwal rusak dijawab daftar kosong", kedua.sidang.length === 0);
  }

  // ==========================================================================
  console.log("\n== Sebutan tanggal Indonesia ==");
  {
    periksa("tanggal biasa", layanan.tanggalIndonesia("2026-06-25") === "25 Juni 2026");
    periksa("awal tahun", layanan.tanggalIndonesia("2026-01-01") === "1 Januari 2026");
    periksa("akhir tahun", layanan.tanggalIndonesia("2026-12-31") === "31 Desember 2026");
    periksa("kosong dijawab kosong", layanan.tanggalIndonesia("") === "");
    periksa("cacat dijawab kosong", layanan.tanggalIndonesia("kemarin") === "");
  }

  // ==========================================================================
  console.log("\n== Pilihan yang harus diisi orang ==");
  {
    // Arah putusan tidak boleh punya nilai bawaan apa pun. Menebaknya - dari
    // amar yang sudah ada, misalnya - menghasilkan perintah yang terdengar
    // berwibawa dan salah.
    periksa("arah putusan tersedia sebagai daftar", Array.isArray(layanan.PILIHAN_ARAH));
    periksa("mencakup kabul, tolak, dan NO", layanan.PILIHAN_ARAH.length >= 6);
    periksa(
      "seluruh pilihan punya kunci dan label",
      layanan.PILIHAN_ARAH.every((x) => x.kunci && x.label)
    );
    periksa(
      "kuncinya tidak kembar",
      new Set(layanan.PILIHAN_ARAH.map((x) => x.kunci)).size === layanan.PILIHAN_ARAH.length
    );
  }

  // ==========================================================================
  console.log("\n== Dokumen e-Court ==");
  {
    bersihkan();
    const hasil = await layanan.bahanPrompt("359/Pdt.G/2026/PA.Dgl");
    periksa("dokumen terbaca", hasil.berkas.length === 1);
    periksa("judulnya terbawa", hasil.berkas[0].judul === "SURAT GUGATAN (Docx/Rtf)");
    // Nama berkas TIDAK ADA di mana pun - kolom berkas_pdf dan berkas_word
    // kosong pada basis data, dan layanan arsip pun hanya memulangkan
    // boolean. Membawa ruas nama berkas berarti membawa ruas yang selamanya
    // kosong, dan daftar lampiran akan diam-diam kehilangan seluruh isinya.
    // Ruas `berkasPdf`/`berkasWord` tidak pernah dipulangkan layanan arsip -
    // namanya dikarang - dan membacanya membuat daftar lampiran keluar
    // KOSONG pada perkara yang dokumennya justru lengkap.
    periksa("tidak membaca ruas karangan berkasPdf", hasil.berkas[0].berkasPdf === undefined);
    periksa(
      "nama berkas sungguhan terbawa",
      hasil.berkas[0].namaBerkasWord === "SURAT GUGATAN (DocxRtf)__afdc3c67.docx"
    );
    periksa("bentuk yang tersedia dicatat", hasil.berkas[0].adaWord === true);
    periksa("bentuk yang tidak ada juga dicatat", hasil.berkas[0].adaPdf === false);
    periksa("nama berkas yang tidak ada dibiarkan kosong", hasil.berkas[0].namaBerkasPdf === "");
  }

  // ==========================================================================
  console.log("\n== Rutenya benar-benar terdaftar ==");
  {
    /**
     * Ini pemeriksaan yang lahir dari kesalahan sungguhan.
     *
     * Blok rute pernah tersisip DI DALAM badan handler tetangganya:
     *
     *     router.get("/sipp/analisa/daftar", ..., async (req, res) => {
     *       res.json({ ok: true, daftar: ... });     <- baris ini berakhir "});"
     *       router.get("/sipp/prompt-putusan", ...)  <- ikut tersisip di sini
     *     });
     *
     * Sah secara sintaksis, sehingga `node --check` lolos, `require()` lolos,
     * dan seluruh uji satuan lolos - tetapi rutenya baru mendaftar bila
     * handler tetangganya dipanggil, jadi tidak pernah. Yang tampak di
     * peladen hanya "Cannot GET", sesudah gambar dibangun dan dinaikkan.
     *
     * Maka yang diperiksa di sini BUKAN keberadaan teksnya di dalam berkas,
     * melainkan keberadaan rutenya di dalam tumpukan router yang sudah jadi.
     */
    const router = require("../routes/internalGatewayRoutes");
    const terdaftar = (router.stack || [])
      .filter((lapis) => lapis.route)
      .map((lapis) => lapis.route.path);

    periksa("router memuat banyak rute", terdaftar.length > 20);
    periksa(
      "/sipp/prompt-putusan terdaftar saat modul dimuat",
      terdaftar.includes("/sipp/prompt-putusan")
    );
    // Tetangga yang dipakai sebagai jangkar penyisipan - bila ia hilang,
    // penyisipannya merusak sesuatu yang lain.
    periksa(
      "rute tetangganya tidak ikut hilang",
      terdaftar.includes("/sipp/analisa/daftar") && terdaftar.includes("/sipp/analisa")
    );
    periksa("dan rute sesudahnya juga utuh", terdaftar.includes("/sipp/status-perkara"));
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exitCode = 1;
  } else {
    console.log("SEMUA PERIKSAAN LULUS.");
  }
}

utama().catch((galat) => {
  console.error(galat);
  process.exitCode = 1;
});
