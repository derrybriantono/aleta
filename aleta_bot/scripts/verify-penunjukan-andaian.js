"use strict";

/**
 * ============================================================================
 * ANDAIAN ANTREAN MASSAL - PRATINJAU YANG BERGILIR SEPERTI PENULISANNYA
 * ============================================================================
 *
 * Penetapan massal memeriksa dua puluh perkara atas keadaan basis data yang
 * sama, lalu menuliskannya satu per satu - dan tiap penulisan mengubah
 * keadaan bagi perkara berikutnya. Tanpa andaian, pratinjau mengusulkan
 * majelis, panitera pengganti, dan juru sita yang SAMA untuk semuanya.
 *
 * Yang dibuktikan di sini: usulan yang diberi andaian "perkara X sudah
 * kebagian" berpindah ke giliran berikutnya - untuk juru sita, panitera
 * pengganti, dan majelis - dengan bobot yang sama dengan kueri bebannya; dan
 * andaian TIDAK mengarang beban tanggal yang tidak terbaca.
 *
 * SIPP diganti tiruan sebelum layanannya dimuat; tidak ada basis data yang
 * disentuh.
 */

const pathx = require("path");
const Module = require("module");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, tambahan = "") {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${tambahan ? ` - ${tambahan}` : ""}`);
  }
}

// --- SIPP palsu -------------------------------------------------------------
let jawaban = {};
function cocokkan(sql) {
  const teks = String(sql);
  if (teks.includes("FROM perkara p")) return jawaban.perkara || [];
  if (teks.includes("FROM perkara_penetapan pp")) return [];
  if (teks.includes("FROM ref_majelis_tetap")) return [];
  if (teks.includes("FROM perkara_smartmajelis")) return [];
  if (teks.includes("FROM hakim_pn h")) return jawaban.hakim || [];
  if (teks.includes("FROM panitera_pn pn")) return jawaban.panitera || [];
  if (teks.includes("FROM jurusita js")) return jawaban.jurusita || [];
  if (teks.includes("FROM perkara_jurusita pj")) return jawaban.giliran || [];
  if (teks.includes("FROM perkara_hakim_pn hp")) {
    return /hp\.hakim_nama/.test(teks) ? [] : jawaban.beban || [];
  }
  return [];
}

const dbPath = require.resolve(pathx.resolve(__dirname, "..", "db_config.js"));
require.cache[dbPath] = new Module(dbPath, null);
require.cache[dbPath].filename = dbPath;
require.cache[dbPath].loaded = true;
require.cache[dbPath].exports = {
  query(sql, params, callback) {
    callback(null, cocokkan(sql));
  },
};

const skemaPath = require.resolve("../services/sippSkemaService");
const skemaAsli = require("../services/sippSkemaService");
require.cache[skemaPath].exports = { ...skemaAsli, tabelAda: async () => true, muat: async () => ({}), lupakan: () => {} };

const layanan = require("../services/penunjukanService");

const HAKIM = [
  { hakimId: 26, kode: "C1", nama: "Himawan", gelar: "", jabatan: "" },
  { hakimId: 28, kode: "C2", nama: "Idris", gelar: "", jabatan: "" },
  { hakimId: 31, kode: "C3", nama: "Derry", gelar: "", jabatan: "" },
  { hakimId: 32, kode: "A", nama: "Fahri", gelar: "", jabatan: "" },
  { hakimId: 33, kode: "B", nama: "Sudarmin", gelar: "", jabatan: "" },
];
const PANITERA = [
  { paniteraId: 1, kode: "D", nama: "Sri Susilowati", gelar: "", jabatan: "" },
  { paniteraId: 2, kode: "D1", nama: "Munifah", gelar: "", jabatan: "" },
  { paniteraId: 3, kode: "D2", nama: "Nurhayati", gelar: "", jabatan: "" },
];
const JURUSITA = [
  { jurusitaId: 22, kode: "E", nama: "Syukri", jabatan: "Jurusita" },
  { jurusitaId: 28, kode: "E1", nama: "Tanty", jabatan: "Jurusita Pengganti" },
  { jurusitaId: 30, kode: "E2", nama: "Mustini", jabatan: "Jurusita Pengganti" },
];
const PENGATURAN = {
  aturan: { jedaMinimalHari: 10, ambangNilaiSengketa: 500000000, klasifikasiHakimTunggal: ["dispensasi kawin"], kolamHakimTunggal: "hakim" },
  hariSidang: { A: 3, B: 2, C1: 1 },
  paniteraMajelis: {},
};

function dasar() {
  return {
    perkara: [
      {
        perkaraId: 468,
        nomorPerkara: "468/Pdt.G/2026/PA.Dgl",
        jenisPerkara: "Cerai Gugat",
        jenisPerkaraLengkap: "Perceraian - Cerai Gugat",
        jenisPerkaraId: 347,
        tanggalDaftar: "2026-07-28",
        nilaiSengketa: null,
      },
    ],
    hakim: HAKIM,
    panitera: PANITERA,
    jurusita: JURUSITA,
    giliran: [
      { jurusitaId: 22, jumlah: 254, perkaraTerakhir: 466 },
      { jurusitaId: 28, jumlah: 257, perkaraTerakhir: 467 },
      { jurusitaId: 30, jumlah: 256, perkaraTerakhir: 465 },
    ],
    // Dua susunan yang terpakai tahun ini - yang pertama lebih ringan.
    beban: [
      { susunan: "33,28,31", anggota: 3, perkara: 10 },
      { susunan: "32,26,31", anggota: 3, perkara: 12 },
    ],
  };
}

const idMajelis = (usulan) => (usulan.pmh.anggota || []).map((x) => x.hakimId).join(",");

(async () => {
  console.log("andaian antrean massal");

  // --------------------------------------------------- pembantu murni
  {
    const n = layanan.normalkanAndaian([
      { perkaraId: "10", hakimId: ["33", 28, "x", 31], paniteraId: 2, jurusitaId: "30", tanggalSidang: "2026-09-23" },
      { perkaraId: 0, hakimId: [], paniteraId: 0, jurusitaId: 0, tanggalSidang: "23-09-2026" },
      "bukan objek",
    ]);
    periksa("normalkanAndaian: yang sah dibaca, yang kosong dibuang", n.length === 1 && n[0].hakimId.join() === "33,28,31" && n[0].jurusitaId === 30 && n[0].tanggalSidang === "2026-09-23");
    periksa("normalkanAndaian: dibatasi 25", layanan.normalkanAndaian(Array.from({ length: 40 }, () => ({ jurusitaId: 1 }))).length === 25);
    periksa("bobotJenis: cerai 1.0, waris 2.0, bawaan 1.5", layanan.bobotJenis(347) === 1.0 && layanan.bobotJenis(364) === 2.0 && layanan.bobotJenis(999) === 1.5);

    const giliran = {
      terbaca: true,
      daftar: [
        { jurusitaId: 22, jumlah: 10, _selisih: -1, selisih: -1, tertinggal: 5 },
        { jurusitaId: 30, jumlah: 11, _selisih: 0, selisih: 0, tertinggal: 9 },
      ],
      usulan: null,
    };
    giliran.usulan = giliran.daftar[0];
    const sesudah = layanan.terapkanAndaianPetugas(giliran, [{ id: 22, bobot: 2 }], "jurusitaId");
    periksa("terapkanAndaianPetugas: yang diandaikan turun ke bawah", sesudah.usulan.jurusitaId === 30);
    periksa("terapkanAndaianPetugas: bobotnya ditambahkan, bukan satu", sesudah.daftar.find((x) => x.jurusitaId === 22).jumlah === 12);
    periksa("terapkanAndaianPetugas: aslinya tidak diubah", giliran.daftar[0].jumlah === 10 && giliran.usulan.jurusitaId === 22);
    periksa("terapkanAndaianPetugas: id yang tidak dikenal tidak mengubah apa pun", layanan.terapkanAndaianPetugas(giliran, [{ id: 99 }], "jurusitaId") === giliran);
  }

  // ----------------------------------------- juru sita berpindah giliran
  {
    jawaban = dasar();
    const tanpa = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", PENGATURAN);
    const jsTanpa = tanpa.pjs.usulan && tanpa.pjs.usulan.jurusitaId;
    periksa("tanpa andaian: ada usulan juru sita", Boolean(jsTanpa));
    const dengan = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", {
      ...PENGATURAN,
      andaian: [1, 2, 3].map(() => ({ perkaraId: 0, hakimId: [], paniteraId: 0, jurusitaId: jsTanpa, tanggalSidang: "" })),
    });
    const jsDengan = dengan.pjs.usulan && dengan.pjs.usulan.jurusitaId;
    periksa("tiga perkara diandaikan ke juru sita itu: usulan berpindah", Boolean(jsDengan) && jsDengan !== jsTanpa, `${jsTanpa} -> ${jsDengan}`);
    periksa("daftar juru sita tetap tiga orang", dengan.pjs.calon.length === 3);
  }

  // ------------------------------------ panitera pengganti berpindah giliran
  {
    jawaban = dasar();
    const tanpa = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", PENGATURAN);
    const ppTanpa = tanpa.ppp.usulan && (tanpa.ppp.usulan.paniteraId ?? tanpa.ppp.usulan.id);
    periksa("tanpa andaian: ada usulan panitera pengganti", Boolean(ppTanpa));
    const dengan = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", {
      ...PENGATURAN,
      andaian: [1, 2].map(() => ({ perkaraId: 0, hakimId: [], paniteraId: ppTanpa, jurusitaId: 0, tanggalSidang: "" })),
    });
    const ppDengan = dengan.ppp.usulan && (dengan.ppp.usulan.paniteraId ?? dengan.ppp.usulan.id);
    periksa("dua perkara diandaikan ke panitera itu: usulan berpindah", Boolean(ppDengan) && ppDengan !== ppTanpa, `${ppTanpa} -> ${ppDengan}`);
  }

  // -------------------------------------------- majelis bergilir menurut susunan
  {
    jawaban = dasar();
    const tanpa = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", PENGATURAN);
    periksa("tanpa andaian: susunan teringan (10 perkara) yang diusulkan", idMajelis(tanpa) === "33,28,31", idMajelis(tanpa));
    const dengan = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", {
      ...PENGATURAN,
      andaian: [1, 2, 3].map(() => ({ perkaraId: 0, hakimId: [33, 28, 31], paniteraId: 0, jurusitaId: 0, tanggalSidang: "" })),
    });
    periksa("tiga perkara diandaikan ke susunan itu (13 > 12): giliran berpindah", idMajelis(dengan) === "32,26,31", idMajelis(dengan));
    const dua = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", {
      ...PENGATURAN,
      andaian: [1, 2].map(() => ({ perkaraId: 0, hakimId: [33, 28, 31], paniteraId: 0, jurusitaId: 0, tanggalSidang: "" })),
    });
    periksa("dua perkara (12 = 12): urutan ditentukan kunci, tetap tetap", idMajelis(dua) === "33,28,31" || idMajelis(dua) === "32,26,31");
    periksa("urutan anggota mengikuti urutan SIPP, bukan urutan andaian", (() => {
      const acak = layanan.terapkanAndaianSusunan;
      const susunan = [{ hakimId: [33, 28, 31], perkara: 1 }];
      acak(susunan, [{ hakimId: [31, 33, 28] }]);
      return susunan[0].perkara === 2 && susunan[0].hakimId.join() === "33,28,31";
    })());
  }

  // ----------------------------------- beban tanggal tidak dikarang dari andaian
  {
    jawaban = dasar();
    const tanpa = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", PENGATURAN);
    const tanggal = tanpa.phs.usulan;
    periksa("ada usulan hari sidang", Boolean(tanggal), String(tanggal));
    const dengan = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", {
      ...PENGATURAN,
      andaian: [{ perkaraId: 0, hakimId: [], paniteraId: 0, jurusitaId: 0, tanggalSidang: tanggal }],
    });
    const calon = (dengan.phs.calon || []).find((x) => x.tanggal === tanggal);
    periksa("beban tanggal yang tidak terbaca tetap null walau ada andaian", calon && calon.jumlahSidang === null, calon && String(calon.jumlahSidang));
    periksa("hari sidangnya tidak bergeser karena andaian", dengan.phs.usulan === tanggal);
  }

  console.log("");
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
})().catch((galat) => {
  console.error("GALAT:", galat && galat.stack ? galat.stack : galat);
  process.exit(1);
});
