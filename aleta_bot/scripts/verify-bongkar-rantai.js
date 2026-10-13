"use strict";

/**
 * ============================================================================
 * MEMBONGKAR SELURUH RANTAI PENETAPAN - PENJAGA URUTANNYA
 * ============================================================================
 *
 * Urutan membongkar tidak dapat dibalik: membongkar majelis selagi hari
 * sidangnya masih berdiri meninggalkan sidang bagi majelis yang sudah tidak
 * ada. Penjaga itu sudah ada sejak pembatalan satu langkah dibuat.
 *
 * Yang baru: rantaiDibongkar, yang melonggarkan penjaga itu supaya rencana
 * keempat langkahnya dapat disusun SEKALIGUS untuk diperlihatkan - pada saat
 * itu belum ada satu baris pun yang dihapus, sehingga penjaga yang ketat akan
 * menolak PJS selagi PHS-nya masih berdiri, padahal PHS itu memang akan
 * dibongkar lebih dahulu pada rantai yang sama.
 *
 * Dan itulah yang dijaga berkas ini, satu-satunya yang benar-benar berbahaya:
 *
 *     PELONGGARAN ITU HANYA BERLAKU PADA UJI KERING.
 *
 * Pembongkaran sungguhan berjalan satu per satu dan basis datanya benar-benar
 * berubah di antara langkah, jadi di sana penjaganya membaca keadaan yang
 * sebenarnya. Bila pelonggarannya bocor ke pembongkaran sungguhan, ALETA akan
 * menghapus majelis dari perkara yang hari sidangnya masih tercatat - dan itu
 * tidak menimbulkan galat apa pun, hanya perkara yang rusak diam-diam.
 *
 * Berjalan tanpa jaringan dan tanpa basis data - db_config diganti penadah.
 */

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

// ---------------------------------------------------------------- penadah
// Perkara yang KEEMPAT penetapannya sudah ada - keadaan yang justru menuntut
// pembongkaran menyeluruh.
const perkaraLengkap = {
  perkaraId: 10113,
  nomorPerkara: "561/Pdt.G/2026/PA.Dgl",
  adaPenetapan: 10113,
  pmh: "2026-09-12",
  ppp: "2026-09-12",
  pjs: "2026-09-12",
  phs: "2026-09-12",
  pppId: 30,
  pjsId: 30,
  adaSmartMajelis: 10113,
};

const { jawabPejabat } = require("./_penadah-pejabat");

const dbPath = require.resolve("../db_config");
require("../db_config");
require.cache[dbPath].exports = {
  query: (sql, params, selesai) => {
    const teks = String(sql);
    // Butir 17 (13 Okt 2026): akun pejabat, majelis, dan jam SIPP.
    const pejabat = jawabPejabat(teks, { username: "sudarmin" });
    if (pejabat !== undefined) return selesai(null, pejabat);
    if (/FROM perkara p\b/.test(teks)) return selesai(null, [perkaraLengkap]);
    if (/FROM sys_users/.test(teks)) {
      return selesai(null, [{ username: "sudarmin", fullname: "Sudarmin H.I.M. Tang, S.H.I., M.H." }]);
    }
    if (/FROM perkara_penetapan_hari_sidang/.test(teks)) return selesai(null, [{ id: 20100 }]);
    if (/information_schema/.test(teks)) return selesai(null, [{ TABLE_NAME: "x", COLUMN_NAME: "y" }]);
    if (/NOW\(\)|CURRENT_TIMESTAMP/i.test(teks)) return selesai(null, [{ saat: "2026-09-12 12:00:00" }]);
    return selesai(null, []);
  },
};

const skemaPath = require.resolve("../services/sippSkemaService");
const skemaAsli = require("../services/sippSkemaService");
require.cache[skemaPath].exports = { ...skemaAsli, tabelAda: async () => true, muat: async () => ({}) };

const layanan = require("../services/penetapanTulisService");

const dasar = {
  perkaraId: 10113,
  olehUsername: "sudarmin",
  // Butir 17: dibongkar atas akun pejabat yang tercatat; akun yang masuk = jejak ALETA.
  akunSippMasuk: "sudarmin",
  operator: "SUPER ADMIN DERRY",
  ip: "127.0.0.1",
};

(async () => {
  console.log("membongkar rantai penetapan");

  // ======================================================================
  // 1. Urutannya masih dijaga ketika tidak ada rantai yang disebut
  // ======================================================================
  {
    const pmh = await layanan.susunRencanaHapus({ ...dasar, jenis: "pmh" });
    periksa("PMH ditolak selagi PPP/PJS/PHS masih berdiri", pmh.ok === false);
    periksa(
      "sebabnya disebut, bukan sekadar gagal",
      pmh.alasan === "langkah_sesudahnya_masih_ada",
      pmh.alasan || ""
    );
    periksa(
      "langkah yang menghalangi ikut disebut",
      Array.isArray(pmh.langkah) && pmh.langkah.join(",") === "ppp,pjs,phs",
      String(pmh.langkah)
    );

    const phs = await layanan.susunRencanaHapus({ ...dasar, jenis: "phs" });
    periksa("PHS - yang paling akhir - boleh dibongkar lebih dulu", phs.ok === true, phs.alasan || "");
  }

  // ======================================================================
  // 2. Uji kering boleh menyusun rencana keempatnya sekaligus
  // ======================================================================
  {
    const rantai = [];
    const jenisUrut = layanan.URUTAN_BONGKAR;
    periksa(
      "urutan bongkarnya dari yang paling akhir ke yang paling awal",
      jenisUrut.join(",") === "phs,pjs,ppp,pmh",
      jenisUrut.join(",")
    );

    let semuanyaTersusun = true;
    for (const jenis of jenisUrut) {
      const rencana = await layanan.susunRencanaHapus({
        ...dasar,
        jenis,
        kering: true,
        rantaiDibongkar: [...rantai],
      });
      if (!rencana.ok) {
        semuanyaTersusun = false;
        periksa(`rencana kering ${jenis} tersusun`, false, rencana.alasan || "");
        break;
      }
      rantai.push(jenis);
    }
    periksa("keempat rencana kering tersusun berurutan", semuanyaTersusun);
  }

  // ======================================================================
  // 3. YANG PALING PENTING - pelonggaran itu tidak bocor ke yang sungguhan
  // ======================================================================
  {
    const sungguhan = await layanan.susunRencanaHapus({
      ...dasar,
      jenis: "pmh",
      kering: false,
      rantaiDibongkar: ["phs", "pjs", "ppp"],
    });
    periksa(
      "rantaiDibongkar TIDAK melonggarkan pembongkaran sungguhan",
      sungguhan.ok === false && sungguhan.alasan === "langkah_sesudahnya_masih_ada",
      `${sungguhan.ok} ${sungguhan.alasan || ""}`
    );

    // kering yang tidak disebut sama sekali sama artinya dengan sungguhan -
    // bawaan yang lalai di sini berakibat pada berkas perkara.
    const tanpaKering = await layanan.susunRencanaHapus({
      ...dasar,
      jenis: "pmh",
      rantaiDibongkar: ["phs", "pjs", "ppp"],
    });
    periksa(
      "tanpa menyebut kering, penjaganya tetap ketat",
      tanpaKering.ok === false && tanpaKering.alasan === "langkah_sesudahnya_masih_ada",
      tanpaKering.alasan || ""
    );

    // Rantai yang tidak lengkap tetap ditolak, bahkan pada uji kering: yang
    // disebut hanya PHS berarti PJS dan PPP memang masih akan berdiri.
    const separuh = await layanan.susunRencanaHapus({
      ...dasar,
      jenis: "pmh",
      kering: true,
      rantaiDibongkar: ["phs"],
    });
    periksa(
      "rantai yang tidak lengkap tetap ditolak walau kering",
      separuh.ok === false && separuh.alasan === "langkah_sesudahnya_masih_ada",
      separuh.alasan || ""
    );
  }

  // ======================================================================
  // 4. Yang memang belum ada dibedakan dari yang terhalang
  // ======================================================================
  {
    perkaraLengkap.phs = null;
    const phs = await layanan.susunRencanaHapus({ ...dasar, jenis: "phs" });
    periksa(
      "PHS yang belum pernah ada dijawab phs_belum_ada, bukan terhalang",
      phs.ok === false && phs.alasan === "phs_belum_ada",
      phs.alasan || ""
    );
    perkaraLengkap.phs = "2026-09-12";
  }

  console.log("");
  console.log(`lulus ${lulus}, gagal ${gagal}`);
  process.exit(gagal > 0 ? 1 : 0);
})().catch((galat) => {
  console.error("GALAT:", String(galat.stack || galat.message || galat).slice(0, 600));
  process.exit(1);
});
