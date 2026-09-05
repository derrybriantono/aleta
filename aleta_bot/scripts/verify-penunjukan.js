"use strict";

/**
 * Usulan penunjukan PMH, PPP, PJS, dan PHS.
 *
 * ============================================================================
 * MENJALANKAN KUERINYA, BUKAN MEMBACA TULISANNYA
 * ============================================================================
 *
 * db_config diganti tiruan sebelum layanannya dimuat, sehingga kueri yang
 * BENAR-BENAR ditembakkan dapat diperiksa - termasuk apa yang masuk sebagai
 * parameter dan apa yang menjadi teks kueri. Tidak ada database yang disentuh.
 *
 * ============================================================================
 * DUA TANGGAL YANG DIUJI BUKAN KARANGAN
 * ============================================================================
 *
 * Acuannya perkara 468/Pdt.G/2026/PA.Dgl - perkara gugatan biasa, bukan upaya
 * hukum: didaftarkan 2026-07-28, Majelis B yang bersidang Selasa, dan sidang
 * pertamanya di SIPP tercatat 2026-08-11.
 *
 * Uji yang memakai tanggal karangan hanya membuktikan kodenya konsisten dengan
 * dirinya sendiri. Yang memakai tanggal sungguhan membuktikan ia sepakat dengan
 * pengadilannya.
 *
 * Sisanya menguji SIFAT yang harus selalu benar - jaraknya tidak pernah kurang
 * dari jeda minimal, harinya selalu hari majelisnya - untuk seluruh gabungan
 * hari dan tanggal daftar. Itu menutup celah yang tidak tertutup oleh satu
 * contoh saja.
 */

const pathx = require("path");
const Module = require("module");

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

// --- SIPP palsu -------------------------------------------------------------

const KOLOM = {
  perkara: [
    "perkara_id",
    "nomor_perkara",
    "jenis_perkara_nama",
    "jenis_perkara_text",
    "tanggal_pendaftaran",
    "nilai_sengketa",
  ],
  perkara_penetapan: [
    "perkara_id",
    "penetapan_majelis_hakim",
    "penetapan_panitera_pengganti",
    "penetapan_jurusita",
    "penetapan_hari_sidang",
    "sidang_pertama",
    "majelis_hakim_kode",
    "majelis_hakim_nama",
    "panitera_pengganti_text",
    "jurusita_text",
  ],
  perkara_hakim_pn: ["perkara_id", "hakim_id", "tahapan_id", "aktif", "tanggal_penetapan"],
  perkara_jurusita: ["perkara_id", "jurusita_id", "tahapan_id", "aktif", "tanggal_penetapan"],
  perkara_smartmajelis: ["perkara_id", "majelis_id", "hakim_id", "hakim_id2", "status", "keterangan"],
  ref_majelis_tetap: ["majelis_id", "hakim_id", "hakim_nama", "urutan", "kompetensi_id", "aktif"],
  ref_sk_majelis_tetap: ["id", "nomor_sk", "tanggal_sk", "aktif"],
  ref_kompetensi_majelis: ["id", "nama_kompetensi_majelis", "aktif"],
  hakim_pn: ["id", "kode", "nama", "nama_gelar", "jabatan", "aktif"],
  panitera_pn: ["id", "kode", "nama", "nama_gelar", "jabatan", "aktif"],
  jurusita: ["id", "kode", "nama", "jabatan", "aktif"],
};

const kueri = [];
let jawaban = {};

function cocokkan(sql) {
  const teks = String(sql);
  if (/information_schema/i.test(teks)) {
    const hasil = [];
    for (const [tabel, daftar] of Object.entries(KOLOM)) {
      for (const nama of daftar) hasil.push({ tabel, kolom: nama });
    }
    return hasil;
  }
  if (teks.includes("FROM perkara p")) return jawaban.perkara || [];
  if (teks.includes("FROM perkara_penetapan pp")) return jawaban.penetapan || [];
  if (teks.includes("FROM ref_majelis_tetap")) return jawaban.majelisTetap || [];
  if (teks.includes("FROM perkara_smartmajelis")) return jawaban.smart || [];
  if (teks.includes("FROM hakim_pn h")) return jawaban.hakim || [];
  if (teks.includes("FROM panitera_pn pn")) return jawaban.panitera || [];
  if (teks.includes("FROM jurusita js")) return jawaban.jurusita || [];
  if (teks.includes("FROM perkara_jurusita pj")) return jawaban.giliran || [];
  if (teks.includes("FROM perkara_hakim_pn hp")) {
    // Dua kueri berbeda memakai alias yang sama: yang menghitung beban hakim
    // tunggal, dan yang membaca majelis satu perkara.
    return /hp\.hakim_nama/.test(teks) ? jawaban.majelisTercatat || [] : jawaban.beban || [];
  }
  return [];
}

const dbPath = require.resolve(pathx.resolve(__dirname, "..", "db_config.js"));
require.cache[dbPath] = new Module(dbPath, null);
require.cache[dbPath].filename = dbPath;
require.cache[dbPath].loaded = true;
require.cache[dbPath].exports = {
  query(sql, params, callback) {
    kueri.push({ sql: String(sql), params: params || [] });
    callback(null, cocokkan(sql));
  },
};

const layanan = require("../services/penunjukanService");
const skema = require("../services/sippSkemaService");

function bersihkan() {
  kueri.length = 0;
}

// --- Data tiruan, mengikuti isi SIPP PA Donggala -----------------------------

const HAKIM = [
  { hakimId: 26, kode: "C1", nama: "Himawan Tatura Wijaya", gelar: "", jabatan: "" },
  { hakimId: 28, kode: "C2", nama: "Idris", gelar: "", jabatan: "" },
  { hakimId: 31, kode: "C3", nama: "Derry Briantono", gelar: "", jabatan: "" },
  { hakimId: 32, kode: "A", nama: "Fahri Saifuddin", gelar: "", jabatan: "" },
  { hakimId: 33, kode: "B", nama: "Sudarmin H.I.M. Tang", gelar: "", jabatan: "" },
];

const PANITERA = [
  { paniteraId: 1, kode: "D", nama: "Sri Susilowati", gelar: "", jabatan: "" },
  { paniteraId: 2, kode: "D1", nama: "Munifah", gelar: "", jabatan: "" },
  { paniteraId: 3, kode: "D2", nama: "Nurhayati", gelar: "", jabatan: "" },
];

const JURUSITA = [
  { jurusitaId: 22, kode: "E", nama: "Syukri", jabatan: "Jurusita" },
  { jurusitaId: 28, kode: "E1", nama: "Tanty Restianty", jabatan: "Jurusita Pengganti" },
  { jurusitaId: 30, kode: "E2", nama: "Mustini", jabatan: "Jurusita Pengganti" },
];

const PENGATURAN = {
  aturan: {
    jedaMinimalHari: 10,
    ambangNilaiSengketa: 500000000,
    klasifikasiHakimTunggal: ["dispensasi kawin", "isbat", "istbat"],
    kolamHakimTunggal: "hakim",
  },
  hariSidang: { A: 3, B: 2, C1: 1 },
  paniteraMajelis: { A: ["D", "D4"], B: ["D1", "D5"], C1: ["D2", "D3", "D6"] },
};

function dasar(ubah = {}) {
  return {
    perkara: [
      {
        perkaraId: 468,
        nomorPerkara: "468/Pdt.G/2026/PA.Dgl",
        jenisPerkara: "Cerai Gugat",
        jenisPerkaraLengkap: "Perceraian - Cerai Gugat",
        tanggalDaftar: "2026-07-28",
        nilaiSengketa: null,
      },
    ],
    penetapan: [],
    majelisTetap: [],
    smart: [{ majelisId: 2, hakimId: "33,28,31", hakimId2: null, status: "1", keterangan: "" }],
    hakim: HAKIM,
    panitera: PANITERA,
    jurusita: JURUSITA,
    giliran: [
      { jurusitaId: 22, jumlah: 254, perkaraTerakhir: 466 },
      { jurusitaId: 28, jumlah: 257, perkaraTerakhir: 467 },
      { jurusitaId: 30, jumlah: 256, perkaraTerakhir: 465 },
    ],
    beban: [],
    majelisTercatat: [],
    ...ubah,
  };
}

async function jalan() {
  skema.lupakan();

  // ==========================================================================
  console.log("\n== Tanggal sidang pertama, diadu dengan SIPP ==");
  // ==========================================================================
  {
    periksa(
      "perkara 468: daftar 2026-07-28, Majelis B (Selasa) -> 2026-08-11",
      layanan.tanggalSidangPertama("2026-07-28", 2, 10) === "2026-08-11"
    );
    periksa(
      "hari sidangnya selalu hari majelisnya, untuk seluruh gabungan",
      (() => {
        for (let h = 0; h <= 6; h += 1) {
          for (let g = 0; g < 21; g += 1) {
            const daftar = layanan.geserHari("2026-03-01", g);
            const sidang = layanan.tanggalSidangPertama(daftar, h, 10);
            if (new Date(`${sidang}T00:00:00`).getDay() !== h) return false;
          }
        }
        return true;
      })()
    );
    periksa(
      "jeda dihitung dari pendaftaran, bukan dari penetapan",
      layanan.tanggalSidangPertama("2026-07-28", 2, 10) !==
        layanan.tanggalSidangPertama("2026-08-04", 2, 10)
    );
    periksa(
      "hari majelis yang tepat jatuh di batas jeda dipakai apa adanya",
      layanan.tanggalSidangPertama("2026-01-12", 4, 10) === "2026-01-22"
    );
    periksa(
      "jarak ke sidang tidak pernah kurang dari jeda minimal",
      (() => {
        for (let h = 0; h <= 6; h += 1) {
          for (let g = 0; g < 14; g += 1) {
            const daftar = layanan.geserHari("2026-01-01", g);
            const sidang = layanan.tanggalSidangPertama(daftar, h, 10);
            const jarak = (new Date(sidang) - new Date(daftar)) / 86400000;
            if (jarak < 10) return false;
          }
        }
        return true;
      })()
    );
    periksa(
      "jeda nol tetap menghasilkan tanggal, bukan kosong",
      layanan.tanggalSidangPertama("2026-07-28", 2, 0) === "2026-07-28"
    );
    periksa(
      "tanggal daftar kosong tidak dikarang jadi hari ini",
      layanan.tanggalSidangPertama("", 2, 10) === ""
    );
    periksa("hari di luar 0..6 ditolak", layanan.tanggalSidangPertama("2026-07-28", 9, 10) === "");
  }

  // ==========================================================================
  console.log("\n== Tunggal atau majelis ==");
  // ==========================================================================
  {
    const a = PENGATURAN.aturan;
    const uji = (jenis, nilai) =>
      layanan.tentukanSusunan(
        { jenisPerkara: jenis, jenisPerkaraLengkap: jenis, nilaiSengketa: nilai },
        a
      );

    periksa("Dispensasi Kawin berhakim tunggal", uji("Dispensasi Kawin", null).bentuk === "tunggal");
    periksa("Isbat Nikah berhakim tunggal", uji("Isbat Nikah Terpadu", null).bentuk === "tunggal");
    periksa("Cerai Gugat bermajelis", uji("Cerai Gugat", null).bentuk === "majelis");
    periksa(
      "ekonomi syariah di bawah ambang berhakim tunggal",
      uji("Ekonomi Syariah", 320000000).bentuk === "tunggal"
    );
    periksa(
      "ekonomi syariah di atas ambang bermajelis",
      uji("Ekonomi Syariah", 800000000).bentuk === "majelis"
    );
    periksa(
      "tepat di ambang masih berhakim tunggal",
      uji("Ekonomi Syariah", 500000000).bentuk === "tunggal"
    );
    periksa(
      "nilai belum diisi TIDAK disimpulkan hakim tunggal",
      uji("Ekonomi Syariah", null).bentuk === "belum-tentu"
    );
    periksa(
      "nilai belum diisi menandai bahwa nilainya perlu ditanyakan",
      uji("Ekonomi Syariah", null).perluNilai === true
    );
    periksa(
      "nilai nol berbeda dari nilai kosong",
      uji("Ekonomi Syariah", 0).bentuk === "tunggal" &&
        uji("Ekonomi Syariah", null).bentuk !== "tunggal"
    );
    periksa(
      "daftar klasifikasi kosong tidak membuat semua jadi tunggal",
      layanan.tentukanSusunan(
        { jenisPerkara: "Dispensasi Kawin", jenisPerkaraLengkap: "", nilaiSengketa: null },
        { ...a, klasifikasiHakimTunggal: [] }
      ).bentuk === "majelis"
    );
  }

  // ==========================================================================
  console.log("\n== PMH bermajelis mengikuti smart majelis ==");
  // ==========================================================================
  {
    bersihkan();
    jawaban = dasar();
    const hasil = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", PENGATURAN);

    periksa("perkaranya ketemu", hasil.ok === true);
    periksa("bentuknya majelis", hasil.pmh.bentuk === "majelis");
    periksa("tiga hakim diusulkan", hasil.pmh.anggota.length === 3);
    periksa(
      "ketua majelisnya yang pertama - Sudarmin (B)",
      hasil.pmh.anggota[0].nama === "Sudarmin H.I.M. Tang" && hasil.pmh.majelisKode === "B"
    );
    periksa("PP mengikuti kode D majelis B", hasil.ppp.usulan && hasil.ppp.usulan.kode === "D1");
    periksa("sidang pertama 2026-08-11", hasil.phs.usulan === "2026-08-11");
    periksa("jaraknya 14 hari", hasil.phs.jarakHari === 14);
    periksa("tanggal penetapan keempatnya satu", typeof hasil.tanggalPenetapan === "string");
  }

  // ==========================================================================
  console.log("\n== hakim_id2 mengalahkan hakim_id ==");
  // ==========================================================================
  {
    bersihkan();
    jawaban = dasar({
      smart: [{ majelisId: 2, hakimId: "33,28,31", hakimId2: "32,26,31", status: "3", keterangan: "mutasi" }],
    });
    const hasil = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", PENGATURAN);

    periksa(
      "yang dipakai penggantinya, bukan susunan semula",
      hasil.pmh.anggota[0].nama === "Fahri Saifuddin"
    );
    periksa("penggantiannya disebutkan", /pengganti/i.test(hasil.pmh.sebab));
    periksa(
      "hari sidangnya ikut berubah mengikuti majelis penggantinya",
      hasil.pmh.majelisKode === "A" && hasil.phs.usulan === "2026-08-12"
    );
  }

  // ==========================================================================
  console.log("\n== Giliran juru sita ==");
  // ==========================================================================
  {
    bersihkan();
    jawaban = dasar();
    const hasil = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", PENGATURAN);

    periksa("yang paling sedikit didahulukan - Syukri 254", hasil.pjs.usulan.nama === "Syukri");
    periksa("ketiganya tetap dapat dipilih manual", hasil.pjs.calon.length === 3);
    periksa("hitungannya disebutkan", /254/.test(hasil.pjs.sebab));
    periksa("tidak ada peringatan bila giliran wajar", hasil.pjs.peringatan === "");
  }

  {
    bersihkan();
    // Jumlahnya sama - yang menentukan siapa paling lama tidak kebagian.
    jawaban = dasar({
      giliran: [
        { jurusitaId: 22, jumlah: 250, perkaraTerakhir: 467 },
        { jurusitaId: 28, jumlah: 250, perkaraTerakhir: 400 },
        { jurusitaId: 30, jumlah: 250, perkaraTerakhir: 466 },
      ],
    });
    const hasil = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", PENGATURAN);

    periksa(
      "jumlah sama: yang paling lama tidak kebagian didahulukan",
      hasil.pjs.usulan.nama === "Tanty Restianty"
    );
    periksa(
      "tertinggal jauh ditandai sebagai dugaan berhalangan",
      hasil.pjs.peringatan.includes("Tanty Restianty") && /berhalangan/i.test(hasil.pjs.peringatan)
    );
  }

  {
    bersihkan();
    // Belum pernah kebagian sama sekali tahun ini.
    jawaban = dasar({
      giliran: [
        { jurusitaId: 22, jumlah: 5, perkaraTerakhir: 467 },
        { jurusitaId: 28, jumlah: 5, perkaraTerakhir: 466 },
      ],
    });
    const hasil = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", PENGATURAN);

    periksa(
      "yang belum pernah kebagian didahulukan, bukan dianggap paling baru",
      hasil.pjs.usulan.nama === "Mustini" && hasil.pjs.usulan.jumlah === 0
    );
  }

  // ==========================================================================
  console.log("\n== Hakim tunggal ==");
  // ==========================================================================
  {
    bersihkan();
    jawaban = dasar({
      perkara: [
        {
          perkaraId: 500,
          nomorPerkara: "500/Pdt.P/2026/PA.Dgl",
          jenisPerkara: "Dispensasi Kawin",
          jenisPerkaraLengkap: "Permohonan - Dispensasi Kawin",
          tanggalDaftar: "2026-07-28",
          nilaiSengketa: null,
        },
      ],
      beban: [
        { hakimId: 26, jumlah: 33 },
        { hakimId: 28, jumlah: 28 },
        { hakimId: 31, jumlah: 37 },
      ],
    });
    const hasil = await layanan.usulanPenunjukan("500/Pdt.P/2026/PA.Dgl", PENGATURAN);

    periksa("satu nama, bukan tiga", hasil.pmh.anggota.length === 1);
    periksa("yang paling sedikit - Idris 28", hasil.pmh.anggota[0].nama === "Idris");
    periksa("hitungannya ikut dikirim", hasil.pmh.hitungan.length === 3);
    periksa(
      "Ketua dan Wakil gugur dari usulan",
      !hasil.pmh.hitungan.some((x) => x.kode === "A" || x.kode === "B")
    );
    periksa(
      "keduanya tetap ada di daftar pilihan manual",
      hasil.pmh.calon.some((x) => x.kode === "A") && hasil.pmh.calon.some((x) => x.kode === "B")
    );
  }

  {
    bersihkan();
    jawaban = dasar({
      perkara: [
        {
          perkaraId: 500,
          nomorPerkara: "500/Pdt.P/2026/PA.Dgl",
          jenisPerkara: "Dispensasi Kawin",
          jenisPerkaraLengkap: "",
          tanggalDaftar: "2026-07-28",
          nilaiSengketa: null,
        },
      ],
      beban: [{ hakimId: 26, jumlah: 1 }],
    });
    const hasil = await layanan.usulanPenunjukan("500/Pdt.P/2026/PA.Dgl", {
      ...PENGATURAN,
      aturan: { ...PENGATURAN.aturan, kolamHakimTunggal: "ketua-wakil" },
    });

    periksa(
      'saklar "ketua-wakil" mengikutkan Ketua dan Wakil',
      hasil.pmh.hitungan.some((x) => x.kode === "A") && hasil.pmh.hitungan.some((x) => x.kode === "B")
    );
    periksa(
      "yang belum pernah menerima tetap didahulukan",
      hasil.pmh.anggota[0].kode !== "C1"
    );
  }

  // ==========================================================================
  console.log("\n== Ekonomi syariah: kompetensi, bukan hitungan ==");
  // ==========================================================================
  {
    bersihkan();
    jawaban = dasar({
      perkara: [
        {
          perkaraId: 512,
          nomorPerkara: "512/Pdt.G.S/2026/PA.Dgl",
          jenisPerkara: "Ekonomi Syariah",
          jenisPerkaraLengkap: "Gugatan Sederhana - Ekonomi Syariah",
          tanggalDaftar: "2026-07-28",
          nilaiSengketa: 320000000,
        },
      ],
      majelisTetap: [
        {
          majelisId: 3,
          hakimId: 26,
          hakimNama: "Himawan Tatura Wijaya",
          urutan: 1,
          kompetensiId: 4,
          kompetensiNama: "Ekonomi Syariah",
          hakimKode: "C1",
          hakimAktif: "Y",
          nomorSk: "W19-A5/1234/2026",
          tanggalSk: "2026-08-27",
        },
        {
          majelisId: 1,
          hakimId: 32,
          hakimNama: "Fahri Saifuddin",
          urutan: 1,
          kompetensiId: 1,
          kompetensiNama: "Perkawinan",
          hakimKode: "A",
          hakimAktif: "Y",
          nomorSk: "W19-A5/1234/2026",
          tanggalSk: "2026-08-27",
        },
      ],
      beban: [
        { hakimId: 26, jumlah: 99 },
        { hakimId: 28, jumlah: 0 },
        { hakimId: 31, jumlah: 0 },
      ],
    });
    const hasil = await layanan.usulanPenunjukan("512/Pdt.G.S/2026/PA.Dgl", PENGATURAN);

    periksa("berhakim tunggal karena di bawah ambang", hasil.pmh.bentuk === "tunggal");
    periksa(
      "yang diusulkan hakim berkompetensi ekonomi syariah, walau bebannya paling berat",
      hasil.pmh.anggota[0].kode === "C1"
    );
    periksa("kolamnya satu orang", hasil.pmh.hitungan.length === 1);
    periksa(
      'sebabnya menyebut "satu-satunya", bukan "paling sedikit"',
      /satu-satunya/i.test(hasil.pmh.sebab)
    );
    periksa("nomor SK terbaca dari SIPP", hasil.sk.nomor === "W19-A5/1234/2026");
  }

  {
    bersihkan();
    jawaban = dasar({
      perkara: [
        {
          perkaraId: 512,
          nomorPerkara: "512/Pdt.G/2026/PA.Dgl",
          jenisPerkara: "Ekonomi Syariah",
          jenisPerkaraLengkap: "Gugatan - Ekonomi Syariah",
          tanggalDaftar: "2026-07-28",
          nilaiSengketa: null,
        },
      ],
    });
    const hasil = await layanan.usulanPenunjukan("512/Pdt.G/2026/PA.Dgl", PENGATURAN);

    periksa("nilai kosong: tidak ada nama yang diusulkan", hasil.pmh.anggota.length === 0);
    periksa("papan diminta menanyakan nilainya", hasil.pmh.perluNilai === true);
    periksa(
      "PHS ikut menahan diri selama majelisnya belum tentu",
      hasil.phs.usulan === ""
    );
  }

  // ==========================================================================
  console.log("\n== Keadaan yang tidak lengkap ==");
  // ==========================================================================
  {
    bersihkan();
    jawaban = dasar({ perkara: [] });
    const hasil = await layanan.usulanPenunjukan("999/Pdt.G/2026/PA.Dgl", PENGATURAN);
    periksa("perkara tidak ketemu dijawab apa adanya", hasil.ok === false);
    periksa("alasannya disebutkan", hasil.alasan === "perkara_tidak_ketemu");
  }

  {
    bersihkan();
    jawaban = dasar({ smart: [] });
    const hasil = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", PENGATURAN);
    periksa("tanpa usulan smart majelis: tidak dikarang", hasil.pmh.anggota.length === 0);
    periksa(
      "alasannya disebutkan, bukan didiamkan",
      /smartmajelis/i.test(hasil.pmh.sebab)
    );
  }

  {
    bersihkan();
    jawaban = dasar();
    const hasil = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", {
      ...PENGATURAN,
      hariSidang: {},
    });
    periksa("hari sidang belum diatur: tanggalnya kosong", hasil.phs.usulan === "");
    periksa("dan sebabnya menyebut belum diatur", /belum diatur/i.test(hasil.phs.sebab));
  }

  {
    bersihkan();
    jawaban = dasar();
    const hasil = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", {
      ...PENGATURAN,
      paniteraMajelis: {},
    });
    periksa(
      "kode panitera belum diatur: seluruh panitera aktif ditampilkan",
      hasil.ppp.calon.length === 3
    );
    // Dulu sebabnya berbunyi "kode panitera majelis ini belum diatur", dari masa
    // ketika panitera pengganti ditautkan per majelis. Penautan itu ternyata
    // tidak berlaku di PA Donggala dan dilepas; yang berlaku giliran. Maka
    // kode panitera yang kosong bukan lagi keadaan yang kurang - dan sebabnya
    // menyebut apa yang benar-benar dipakai memilih.
    periksa("dan itu dijelaskan", /seluruh panitera aktif|giliran panitera/i.test(hasil.ppp.sebab));
  }

  {
    bersihkan();
    jawaban = dasar({
      penetapan: [
        {
          pmh: "2026-07-28",
          ppp: null,
          pjs: null,
          phs: null,
          sidangPertama: null,
          majelisKode: "B-C2-C3",
          majelisNama: "Sudarmin<br />Idris<br />Derry",
          paniteraText: "",
          jurusitaText: "",
        },
      ],
    });
    const hasil = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", PENGATURAN);
    periksa(
      "PMH sudah ada: tanggal penetapan mengikutinya, bukan hari ini",
      hasil.tanggalPenetapan === "2026-07-28"
    );
    periksa(
      "nama majelis yang sudah ditetapkan dibaca tanpa tanda br",
      !hasil.penetapan.majelisNama.includes("<br")
    );
  }

  // ==========================================================================
  console.log("\n== Pemeriksaan balik sesudah Simpan ==");
  // ==========================================================================
  {
    bersihkan();
    jawaban = dasar({
      penetapan: [
        {
          pmh: "2026-07-28",
          ppp: "2026-07-28",
          pjs: null,
          phs: null,
          sidangPertama: null,
          majelisKode: "B-C2-C3",
          majelisNama: "Sudarmin",
          paniteraText: "Munifah",
          jurusitaText: "",
        },
      ],
    });

    const semua = await layanan.periksaPengisian("468/Pdt.G/2026/PA.Dgl", {
      pmh: "2026-07-28",
      ppp: "2026-07-28",
    });
    periksa("keduanya cocok -> mendarat ya", semua.mendarat === "ya");
    periksa("tiap penetapan dirinci sendiri-sendiri", semua.rinci.length === 2);
    periksa("ringkasan tercatat ikut disusun", /pmh=2026-07-28/.test(semua.tercatat));
  }

  {
    bersihkan();
    jawaban = dasar({
      penetapan: [
        {
          pmh: "2026-07-28",
          ppp: null,
          pjs: null,
          phs: null,
          sidangPertama: null,
          majelisKode: "",
          majelisNama: "",
          paniteraText: "",
          jurusitaText: "",
        },
      ],
    });

    const sebagian = await layanan.periksaPengisian("468/Pdt.G/2026/PA.Dgl", {
      pmh: "2026-07-28",
      ppp: "2026-07-28",
    });
    // Yang berhasil sebagian TIDAK dibulatkan jadi gagal - membulatkannya
    // menyembunyikan penetapan yang sudah benar-benar tercatat.
    periksa("satu cocok satu tidak -> sebagian", sebagian.mendarat === "sebagian");
    periksa(
      "yang tidak cocok disebut apa yang tercatat",
      sebagian.rinci.find((x) => x.jenis === "ppp").tercatat === ""
    );
  }

  {
    bersihkan();
    jawaban = dasar({ penetapan: [] });
    const kosong = await layanan.periksaPengisian("468/Pdt.G/2026/PA.Dgl", { pmh: "2026-07-28" });
    periksa("tanpa baris penetapan -> tidak mendarat", kosong.mendarat === "tidak");
    periksa("alasannya disebutkan", /belum ada baris penetapan/i.test(kosong.alasan));
  }

  {
    bersihkan();
    jawaban = dasar({ perkara: [] });
    const hilang = await layanan.periksaPengisian("999/Pdt.G/2026/PA.Dgl", { pmh: "2026-07-28" });
    periksa("perkara tidak ketemu -> tidak mendarat", hilang.mendarat === "tidak");
    periksa("tidak berpura-pura berhasil", hilang.ok === false);
  }

  {
    bersihkan();
    jawaban = dasar({
      penetapan: [
        {
          pmh: "2026-07-28",
          ppp: null,
          pjs: null,
          phs: null,
          sidangPertama: null,
          majelisKode: "",
          majelisNama: "",
          paniteraText: "",
          jurusitaText: "",
        },
      ],
    });
    const tanpaHarapan = await layanan.periksaPengisian("468/Pdt.G/2026/PA.Dgl", {});
    // Tanpa harapan tidak ada yang dapat dibandingkan - itu bukan berhasil.
    periksa("tanpa harapan tidak dinyatakan mendarat", tanpaHarapan.mendarat === "tidak");
  }

  {
    bersihkan();
    jawaban = dasar();
    await layanan.periksaPengisian("468/Pdt.G/2026/PA.Dgl", { pmh: "2026-07-28" });
    periksa(
      "pemeriksaan balik pun hanya SELECT",
      kueri.every((x) => /^\s*SELECT\b/i.test(x.sql.trim()))
    );
  }

  // ==========================================================================
  console.log("\n== Ketua majelis yang TERCATAT, untuk PHS ==");
  // ==========================================================================
  //
  // PHS dikerjakan ketua majelis perkara itu, dengan akun SIPP-nya sendiri.
  // Sampai PMH tersimpan ketuanya belum ada - yang ada baru usulan, dan usulan
  // boleh berubah. Karena itu usulan membawa keduanya secara terpisah, dan
  // portal memilih yang tercatat.
  {
    bersihkan();
    jawaban = dasar({ majelisTercatat: [] });
    const hasil = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", PENGATURAN);
    periksa("belum ditetapkan: tercatat kosong, bukan diisi usulan", hasil.tercatat.ada === false);
    periksa("dan ketuanya tidak dikarang", hasil.tercatat.ketuaHakimId === 0);
  }

  {
    bersihkan();
    jawaban = dasar({
      // jabatan_hakim_id 1 = ketua majelis. Urutannya sengaja dibalik supaya
      // yang terbukti bukan "baris pertama" melainkan penandanya.
      majelisTercatat: [
        { hakimId: 28, nama: "Idris", urutan: 1, jabatanId: 3 },
        { hakimId: 33, nama: "Sudarmin H.I.M. Tang", urutan: 2, jabatanId: 1 },
      ],
    });
    const hasil = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", PENGATURAN);
    periksa("ketua dibaca dari jabatan_hakim_id = 1", hasil.tercatat.ketuaHakimId === 33);
    periksa("namanya ikut dibawa", hasil.tercatat.ketuaNama.includes("Sudarmin"));
    periksa("seluruh majelisnya ikut", hasil.tercatat.hakim.length === 2);
  }

  {
    bersihkan();
    // Hakim tunggal: satu baris, dan pemasangan yang tidak mengisi
    // jabatan_hakim_id sama sekali. Keduanya jatuh ke urutan pertama.
    jawaban = dasar({
      majelisTercatat: [{ hakimId: 26, nama: "Himawan Tatura Wijaya", urutan: 1, jabatanId: 0 }],
    });
    const hasil = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", PENGATURAN);
    periksa("tanpa penanda jabatan: urutan pertama yang dipakai", hasil.tercatat.ketuaHakimId === 26);
    periksa("dan itu tetap dinyatakan tercatat", hasil.tercatat.ada === true);
  }

  // ==========================================================================
  console.log("\n== PMH diadu dengan smart majelis ==");
  // ==========================================================================
  {
    bersihkan();
    jawaban = dasar({
      penetapan: [{ pmh: "2026-07-28", ppp: null, pjs: null, phs: null, sidangPertama: null,
                    majelisKode: "", majelisNama: "", paniteraText: "", jurusitaText: "" }],
      // Tercatat sama dengan usulan smart majelis 33,28,31.
      majelisTercatat: [
        { hakimId: 33, nama: "Sudarmin H.I.M. Tang", urutan: 1 },
        { hakimId: 28, nama: "Idris", urutan: 2 },
        { hakimId: 31, nama: "Derry Briantono", urutan: 3 },
      ],
    });
    const hasil = await layanan.periksaPengisian("468/Pdt.G/2026/PA.Dgl", { pmh: "2026-07-28" });
    periksa("majelis tercatat sama dengan usulan smart majelis", hasil.smartMajelis.cocok === true);
  }

  {
    bersihkan();
    jawaban = dasar({
      penetapan: [{ pmh: "2026-07-28", ppp: null, pjs: null, phs: null, sidangPertama: null,
                    majelisKode: "", majelisNama: "", paniteraText: "", jurusitaText: "" }],
      // Hakim ketiga berbeda dari usulan - inilah yang harus tertangkap.
      majelisTercatat: [
        { hakimId: 33, nama: "Sudarmin H.I.M. Tang", urutan: 1 },
        { hakimId: 28, nama: "Idris", urutan: 2 },
        { hakimId: 26, nama: "Himawan Tatura Wijaya", urutan: 3 },
      ],
    });
    const hasil = await layanan.periksaPengisian("468/Pdt.G/2026/PA.Dgl", { pmh: "2026-07-28" });
    periksa("majelis yang menyimpang tertangkap", hasil.smartMajelis.cocok === false);
    periksa(
      "keduanya disebutkan supaya dapat dibandingkan",
      hasil.smartMajelis.usulan.includes("Derry Briantono") &&
        hasil.smartMajelis.tercatat.includes("Himawan Tatura Wijaya")
    );
    // Penyimpangan TANPA keterangan lebih patut diperiksa daripada yang
    // berketerangan - isbat terpadu dan hakim berhalangan memang menyimpang
    // dengan sengaja, dan smart majelis mencatat sebabnya.
    periksa("penyimpangan tanpa keterangan ditandai", hasil.smartMajelis.berketerangan === false);
  }

  {
    bersihkan();
    jawaban = dasar({
      penetapan: [{ pmh: "2026-07-28", ppp: null, pjs: null, phs: null, sidangPertama: null,
                    majelisKode: "", majelisNama: "", paniteraText: "", jurusitaText: "" }],
      majelisTercatat: [],
    });
    const hasil = await layanan.periksaPengisian("468/Pdt.G/2026/PA.Dgl", { pmh: "2026-07-28" });
    // Belum ditetapkan BUKAN penyimpangan - ia keadaan yang berbeda, dan
    // menyatakannya tidak cocok akan menyalakan peringatan atas perkara yang
    // memang belum sampai gilirannya.
    periksa("majelis yang belum ditetapkan bukan penyimpangan", hasil.smartMajelis.cocok === null);
  }

  {
    bersihkan();
    // Barisnya harus ADA - tanpa itu periksaPengisian keluar lebih awal, dan
    // yang diuji jadi jalur yang berbeda sama sekali.
    jawaban = dasar({
      penetapan: [{ pmh: null, ppp: "2026-07-28", pjs: null, phs: null, sidangPertama: null,
                    majelisKode: "", majelisNama: "", paniteraText: "", jurusitaText: "" }],
    });
    const hasil = await layanan.periksaPengisian("468/Pdt.G/2026/PA.Dgl", { ppp: "2026-07-28" });
    // Tidak dibaca saat yang diperiksa bukan PMH - dua kueri tanpa jawaban.
    periksa("tidak diperiksa ketika PMH tidak termasuk", hasil.smartMajelis === null);
  }

  // ==========================================================================
  console.log("\n== SIPP hanya dibaca ==");
  // ==========================================================================
  {
    bersihkan();
    jawaban = dasar();
    await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", PENGATURAN);

    periksa("seluruh kueri berupa SELECT", kueri.every((x) => /^\s*SELECT\b/i.test(x.sql.trim())));
    periksa(
      "tidak ada INSERT, UPDATE, DELETE, DROP, atau ALTER",
      kueri.every((x) => !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|REPLACE)\b/i.test(x.sql))
    );
    periksa(
      "nomor perkara masuk sebagai parameter, tidak disambung ke teks kueri",
      kueri.every((x) => !x.sql.includes("468/Pdt.G/2026/PA.Dgl"))
    );
    periksa(
      "tahapan penunjukan disaring, bukan seluruh tahapan dihitung",
      kueri
        .filter((x) => /FROM perkara_jurusita|FROM perkara_hakim_pn/i.test(x.sql))
        .every((x) => /tahapan_id\s*=\s*\?/i.test(x.sql))
    );
    periksa(
      "giliran dihitung untuk tahun perkaranya, bukan seluruh tahun",
      kueri.some((x) => /FROM perkara_jurusita/i.test(x.sql) && /YEAR\(/i.test(x.sql))
    );
  }

  {
    bersihkan();
    jawaban = dasar();
    await layanan.usulanPenunjukan("468'; DROP TABLE perkara; --", PENGATURAN);
    periksa(
      "nomor perkara berisi SQL tetap masuk sebagai parameter",
      kueri.every((x) => !x.sql.includes("DROP TABLE"))
    );
  }

  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal\n`);
  process.exit(gagal === 0 ? 0 : 1);
}

jalan().catch((galat) => {
  console.error("Gagal dijalankan:", galat);
  process.exit(1);
});
