"use strict";

/**
 * ============================================================================
 * PENJAGA JALUR RAPOR APARATUR
 * ============================================================================
 *
 * Rapor bernama orang adalah keluaran paling berbahaya pada seluruh aplikasi
 * ini. Angka penilaian yang keliru pada tingkat pengadilan menghasilkan
 * kesimpulan yang salah; angka yang keliru pada tingkat orang menghasilkan
 * seseorang dipanggil menghadap.
 *
 * Karena itu jalurnya dijaga terpisah, dan yang dijaga bukan "apakah rapornya
 * terbentuk" melainkan tiga hal yang seluruhnya tentang MENAHAN:
 *
 *   1. Gerbang enam syarat benar-benar dijalankan, dan ketika ia menahan,
 *      yang hilang HANYA nilainya - nama, pembilang, dan penyebutnya tetap.
 *
 *   2. Dimensi yang ditawarkan hanya yang benar-benar ada pada baris bukti.
 *      Meminta rapor per juru sita atas penilaian yang tidak menyebut juru
 *      sita menghasilkan satu kelompok "(tidak tercatat)" berisi segalanya -
 *      terbaca seperti temuan padahal hanya salah pertanyaan.
 *
 *   3. Tidak ada baris yang hilang saat dipecah per orang. Rapor yang
 *      kehilangan baris memberi nilai yang lebih baik daripada yang
 *      sebenarnya, dan tidak ada yang menyadarinya.
 */

const fs = require("fs");
const path = require("path");

let lulus = 0;
let gagal = 0;

function cek(nama, syarat, keterangan) {
  if (syarat) {
    lulus += 1;
    return;
  }
  gagal += 1;
  console.log(`  GAGAL  ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
}

console.log("Jalur rapor kinerja aparatur\n");

const G = require("../services/gerbangRaporAparaturService");
const R = require("../services/raporBerjenjangService");

/* ------------------------------------------------------------ gerbangnya */

console.log("== Gerbang enam syarat ==");

cek("enam syarat terdaftar", G.SYARAT.length === 6, `${G.SYARAT.length}`);
cek(
  "tiap syarat menyebutkan sebabnya panjang lebar",
  G.SYARAT.every((s) => (s.sebabnya || "").length >= 80),
  G.SYARAT.filter((s) => (s.sebabnya || "").length < 80).map((s) => s.kunci).join(", ")
);
cek("peringatan tetap ada dan tidak kosong", (G.PERINGATAN_TETAP || "").length >= 40);

/* ------------------------------------------------- menahan dengan benar */

console.log("== Ketika menahan, yang hilang hanya nilainya ==");

const raporPalsu = {
  ok: true,
  kunci: "ujiRapor",
  ringkasPelaku: [
    { pelaku: "Rusdin", terpenuhi: 40, penyebut: 44, nilai: 90.9, cukup: true },
    { pelaku: "Yusuf", terpenuhi: 2, penyebut: 3, nilai: null, cukup: false },
  ],
};

const terbit = G.terbitkan(raporPalsu, { penilaian: "ujiRapor", tanggal: "2026-09-07" });

cek("gerbang menjawab", terbit && typeof terbit === "object");
cek("membawa peringatan tetap", String(terbit.peringatan || "").length >= 40);
cek("menyatakan boleh terbit atau tidak", typeof terbit.terbit === "boolean");

const daftarPelaku = (terbit.rapor && terbit.rapor.ringkasPelaku) || [];
cek("nama pelaku tetap ada walau ditahan", daftarPelaku.length === 2, `${daftarPelaku.length}`);

if (daftarPelaku.length === 2) {
  const p = daftarPelaku[0];
  cek("pembilang tetap ada", p.terpenuhi === 40, String(p.terpenuhi));
  cek("penyebut tetap ada", p.penyebut === 44, String(p.penyebut));

  // Inilah yang menentukan. Ketika ditahan, yang hilang HANYA nilainya -
  // bukan barisnya. Membuang barisnya membuat orang menyangka tidak ada
  // datanya, padahal datanya ada dan justru belum layak dinilai.
  if (terbit.terbit === false) {
    cek("nilai dibuang saat ditahan", p.nilai === null, String(p.nilai));
    cek("dan penahanannya ditandai pada barisnya", p.nilaiDitahan === true, String(p.nilaiDitahan));
  } else {
    cek("nilai tetap ada saat boleh terbit", p.nilai !== null);
  }
}

// Sebab penahanan harus disebutkan - dan bukan sekadar "belum boleh".
cek(
  "sebab penahanan disebutkan",
  terbit.terbit === true || String(terbit.sebabDitahan || "").length >= 20,
  String(terbit.sebabDitahan || "")
);
cek(
  "syarat yang belum terpenuhi disebutkan satu per satu",
  terbit.terbit === true ||
    (terbit.syarat && Array.isArray(terbit.syarat.belum) && terbit.syarat.belum.length > 0),
  JSON.stringify((terbit.syarat && terbit.syarat.belum) || []).slice(0, 120)
);
cek(
  "tiap syarat yang belum terpenuhi membawa sebabnya",
  terbit.terbit === true ||
    ((terbit.syarat && terbit.syarat.belum) || []).every((b) => (b.sebabnya || "").length >= 40),
  "ada syarat tanpa sebab"
);

/* -------------------------------------------- tidak ada baris yang hilang */

console.log("== Pemecahan per orang tidak kehilangan baris ==");

const hasilPalsu = {
  ok: true,
  kunci: "ujiPecah",
  satuan: [
    {
      unit: { kunci: "2026-01", label: "Januari 2026", mulai: "2026-01-01", selesai: "2026-01-31" },
      terpenuhi: 3,
      penyebut: 5,
      nilai: null,
      cukup: false,
      bukti: [
        { kunci: "a", jurusita: "Rusdin", memenuhi: true },
        { kunci: "b", jurusita: "Rusdin", memenuhi: true },
        { kunci: "c", jurusita: "Yusuf", memenuhi: true },
        { kunci: "d", jurusita: "Yusuf", memenuhi: false },
        // Baris tanpa nama petugas - harus tetap terhitung, bukan hilang.
        { kunci: "e", memenuhi: false },
      ],
    },
  ],
};

const pecah = R.berjenjang(hasilPalsu, "jurusita");
const jumlah = pecah.ringkasPelaku.reduce((s, x) => s + x.penyebut, 0);
cek("seluruh lima baris terhitung", jumlah === 5, `${jumlah}`);
cek(
  "baris tanpa nama masuk kelompok yang disebutkan",
  pecah.ringkasPelaku.some((p) => p.pelaku === R.TIDAK_TERCATAT),
  pecah.ringkasPelaku.map((p) => p.pelaku).join(", ")
);
cek(
  "pelaku berpenyebut kecil tidak diberi nilai",
  pecah.ringkasPelaku.filter((p) => p.penyebut < 20).every((p) => p.nilai === null),
  JSON.stringify(pecah.ringkasPelaku)
);

// Dan bila baris hilang, ia harus MELEDAK - bukan diam-diam memberi nilai yang
// lebih baik daripada yang sebenarnya.
let meledak = false;
try {
  R.berjenjang({ ...hasilPalsu, satuan: [{ ...hasilPalsu.satuan[0], penyebut: 99 }] }, "jurusita");
} catch (_) {
  meledak = true;
}
cek("kehilangan baris menggagalkan penyusunan, bukan didiamkan", meledak);

/* --------------------------------------------------------------- rutenya */

console.log("== Rute terdaftar dan menjalankan gerbangnya ==");

const RUTE = fs.readFileSync(path.join(__dirname, "..", "routes", "internalGatewayRoutes.js"), "utf8");
cek("rute /e-audit/rapor terdaftar", RUTE.includes('router.get("/e-audit/rapor"'));
cek("rute memanggil penyusun berjenjang", RUTE.includes("raporBerjenjangService.berjenjang("));
cek("rute menjalankan gerbangnya", RUTE.includes("gerbangRaporAparaturService.terbitkan("));
cek(
  "rute menolak dimensi yang tidak ada pada barisnya",
  RUTE.includes("tidak membawa ruas") && RUTE.includes("dimensiTersedia")
);

console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal === 0 ? 0 : 1);
