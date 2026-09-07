"use strict";

/**
 * ============================================================================
 * PENJAGA KERANGKA RAPOR
 * ============================================================================
 *
 * Bentuk penilaian ketiga - memecah penilaian yang sudah ada menurut orangnya.
 *
 * Yang dijaga di sini tiga hal, dan ketiganya tentang MENAHAN:
 *
 *   1. Tidak ada nilai gabungan. Satu angka per orang menuntut pembobotan,
 *      dan pembobotan adalah kewenangan pimpinan. Menjumlahkan baris begitu
 *      saja diam-diam memilih pembobotan menurut volume - petugas yang
 *      mengerjakan banyak tugas ringan akan tampak lebih baik, dan tidak
 *      seorang pun tahu pilihan itu pernah diambil.
 *
 *   2. Penilaian yang baris buktinya tidak membawa nama peran itu TIDAK
 *      dipakai, dan sebabnya disebutkan. Memakainya menghasilkan satu kelompok
 *      "(tidak tercatat)" berisi segalanya - terbaca seperti temuan besar
 *      padahal hanya salah pertanyaan.
 *
 *   3. Ketika gerbang menahan, SELURUH sel kehilangan nilainya - bukan hanya
 *      kolom yang diperiksa gerbang. Menahan sebagian membuat orang membaca
 *      kolom yang tersisa seolah sudah layak dipakai.
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

console.log("Kerangka rapor - bentuk penilaian ketiga\n");

const R = require("../services/kerangkaRaporService");
const A = require("../services/raporAparaturService");
const T = require("../services/penilaianTahapanService");

/* -------------------------------------------------- definisi yang cacat */

console.log("== Definisi cacat ditolak ==");

const SAH = {
  kunci: "ujiRapor",
  judul: "Uji Rapor",
  keterangan: "Rapor contoh untuk menguji kerangka, panjangnya cukup untuk lolos pemeriksaan.",
  versiRumus: "uji-v1",
  dimensi: "jurusita",
  sebutanDimensi: "juru sita",
  sumber: ["ketaatanPenetapanMajelis"],
};

cek("definisi yang sah diterima", R.celaDefinisi(SAH).length === 0, R.celaDefinisi(SAH).join("; "));

function ditolak(ubah, sebutan) {
  const cela = R.celaDefinisi({ ...SAH, ...ubah });
  cek(`ditolak: ${sebutan}`, cela.length > 0, "justru diterima");
}

ditolak({ kunci: "" }, "kunci kosong");
ditolak({ judul: "" }, "judul kosong");
ditolak({ keterangan: "" }, "keterangan kosong");
ditolak({ versiRumus: "" }, "versiRumus kosong");
ditolak({ dimensi: "" }, "dimensi kosong");
ditolak({ sebutanDimensi: "" }, "sebutan peran kosong");
ditolak({ sumber: [] }, "tanpa penilaian sumber");
ditolak({ sumber: null }, "sumber bukan larik");

// Inilah pemeriksaan yang paling menentukan pada berkas ini.
["bobot", "nilaiGabungan", "rumusGabungan", "peringkat"].forEach((k) => {
  ditolak({ [k]: 1 }, `rapor membawa "${k}" - jalan menuju nilai gabungan`);
});

/* ------------------------------------------------------- empat rapor Bab 7 */

console.log("== Empat rapor Bab 7 ==");

R.lupakanSemua();
T.daftarkanSemua();
A.daftarkanSemua();

const daftar = R.daftar();
cek("empat rapor terdaftar", daftar.length === 4, String(daftar.length));
cek(
  "tiap rapor menyebut kode butir katalognya",
  daftar.every((d) => /^AP\d{2}$/.test(d.kode)),
  daftar.map((d) => d.kode).join(", ")
);
cek(
  "tiap rapor menyebut peran dalam bahasa orang",
  daftar.every((d) => d.sebutanDimensi && d.sebutanDimensi.length >= 5)
);
cek(
  "tiap rapor menyusun sebelas penilaian tahapan",
  daftar.every((d) => d.sumber.length === T.TAHAPAN.length),
  daftar.map((d) => `${d.kode}:${d.sumber.length}`).join(", ")
);

/* --------------------------------------- sepuluh butir yang belum dibangun */

console.log("== Sepuluh butir yang belum dibangun menyebutkan penghalangnya ==");

const belum = Object.entries(A.BELUM_DAPAT);
cek("sepuluh butir tercatat", belum.length === 10, String(belum.length));
cek(
  "tiap butir menyebutkan penghalangnya panjang lebar",
  belum.every(([, v]) => (v.sebab || "").length >= 80),
  belum.filter(([, v]) => (v.sebab || "").length < 80).map(([k]) => k).join(", ")
);
cek(
  "tidak ada penghalang yang hampa maknanya",
  !belum.some(([, v]) => /belum sempat|nanti|menyusul/i.test(v.sebab)),
  "ada sebab yang tidak menerangkan apa pun"
);

// Empat yang dibangun ditambah sepuluh yang belum harus berjumlah empat belas.
cek(
  "empat ditambah sepuluh berjumlah empat belas butir Bab 7",
  Object.keys(A.sambungan()).length + belum.length === 14,
  `${Object.keys(A.sambungan()).length} + ${belum.length}`
);
const bertindih = Object.keys(A.sambungan()).filter((k) => Object.prototype.hasOwnProperty.call(A.BELUM_DAPAT, k));
cek("tidak ada butir yang tercatat dua kali", bertindih.length === 0, bertindih.join(", "));

/* ------------------------------------------------ penyusunan tanpa SIPP */

console.log("== Penyusunan diuji dengan baris buatan ==");

const db = require("../db_config");
const queryAsli = db.query;
let jawaban = [];
db.query = (sql, params, balik) => balik(null, jawaban);

(async () => {
  jawaban = Array.from({ length: 60 }, (_, i) => ({
    nomorPerkara: `${i + 1}/Pdt.G`,
    jenisPerkara: "Cerai Gugat",
    acuan: "2026-01-05",
    peristiwa: i % 4 === 0 ? "2026-02-20" : "2026-01-07",
    hakim: i < 30 ? "Hakim A" : "Hakim B",
    majelis: "Majelis I",
    paniteraPengganti: "PP Satu",
    jurusita: i % 3 === 0 ? "" : "Rusdin",
  }));

  const h = await R.jalankan("raporHakimPerorangan", "bulanan", "2026-01-31", { banyak: 1 });

  cek("rapor tersusun", h.ok === true && h.bentuk === "rapor");
  cek("seluruh kolom terpakai", h.kolom.every((k) => k.terpakai), h.kolom.filter((k) => !k.terpakai).map((k) => k.sebab).join("; "));
  cek("dua orang terkumpul", h.jumlahOrang === 2, String(h.jumlahOrang));
  cek("tiap orang punya sel untuk tiap kolom", h.baris.every((b) => Object.keys(b.sel).length === h.kolom.length));

  // TIDAK ADA nilai gabungan - dan itu dinyatakan, bukan sekadar tidak ada.
  cek(
    "tidak ada ruas nilai gabungan pada rapor",
    !Object.prototype.hasOwnProperty.call(h, "nilaiGabungan") &&
      !Object.prototype.hasOwnProperty.call(h, "peringkat"),
    Object.keys(h).join(", ")
  );
  cek(
    "tidak ada nilai gabungan pada baris orang",
    h.baris.every((b) => !Object.prototype.hasOwnProperty.call(b, "nilai")),
    "ada baris yang membawa nilai gabungan"
  );
  cek("dan alasannya dinyatakan", String(h.tanpaNilaiGabungan).length >= 80);
  cek(
    "totalPenyebut dipulangkan untuk menerangkan beban, bukan sebagai nilai",
    h.baris.every((b) => typeof b.totalPenyebut === "number")
  );

  // Gerbang menahan, dan yang hilang HANYA nilainya.
  cek("gerbang menahan", h.terbit === false);
  cek("sebab penahanan disebutkan", Array.isArray(h.sebabDitahan) && h.sebabDitahan.length > 0, JSON.stringify(h.sebabDitahan));
  const sel = h.baris[0].sel[h.kolom[0].penilaian];
  cek("nilai sel dibuang saat ditahan", sel.nilai === null, String(sel.nilai));
  cek("dan penahanannya ditandai", sel.nilaiDitahan === true);
  // Yang dijaga: pembilang dan penyebut TETAP ADA sesudah nilainya dibuang -
  // bukan bahwa keduanya positif. Kolom pertama kebetulan KT01 yang berbatas
  // nol hari, sehingga pembilangnya memang nol pada data uji ini, dan menuntut
  // angka positif berarti menuduh perilaku yang justru benar.
  cek("pembilang tetap ada sesudah nilai dibuang", typeof sel.terpenuhi === "number", String(sel.terpenuhi));
  cek("penyebut tetap ada sesudah nilai dibuang", typeof sel.penyebut === "number" && sel.penyebut > 0, String(sel.penyebut));

  // Dan pada rapor keseluruhan, harus ada sekurangnya satu sel berpembilang
  // positif - kalau tidak, pemecahannya sendiri yang gagal, bukan datanya.
  const adaPembilang = h.baris.some((b) => Object.values(b.sel).some((x) => x.terpenuhi > 0));
  cek("sekurangnya satu sel berpembilang positif", adaPembilang, "seluruh pembilang nol - pemecahannya gagal");

  // SELURUH sel ditahan, bukan hanya kolom pertama.
  const adaYangLolos = h.baris.some((b) => Object.values(b.sel).some((s) => s.nilai !== null));
  cek("seluruh sel ikut ditahan, bukan hanya kolom yang diperiksa gerbang", !adaYangLolos);

  // Baris tanpa nama petugas terkumpul dan terlihat.
  const hj = await R.jalankan("raporJurusita", "bulanan", "2026-01-31", { banyak: 1 });
  cek(
    "baris tanpa nama terkumpul sebagai kelompok yang disebutkan",
    hj.baris.some((b) => /tidak tercatat/i.test(b.pelaku)),
    hj.baris.map((b) => b.pelaku).join(", ")
  );

  // Penilaian yang baris buktinya tidak membawa perannya TIDAK dipakai.
  R.daftarkan({
    ...SAH,
    kunci: "ujiPeranTidakAda",
    dimensi: "peranKarangan",
    sebutanDimensi: "peran karangan",
    sumber: ["ketaatanPenetapanMajelis"],
  });
  const hx = await R.jalankan("ujiPeranTidakAda", "bulanan", "2026-01-31", { banyak: 1 });
  cek("penilaian tanpa ruas peran tidak dipakai", hx.kolom.every((k) => !k.terpakai));
  cek(
    "dan sebabnya menyebut ruas yang dicarinya",
    hx.kolom.every((k) => /peranKarangan/.test(k.sebab)),
    hx.kolom.map((k) => k.sebab).join("; ")
  );
  cek("tidak ada orang terkumpul dari penilaian yang tidak dipakai", hx.jumlahOrang === 0);

  // Jawaban kosong tidak meledak.
  jawaban = [];
  const hk = await R.jalankan("raporHakimPerorangan", "bulanan", "2026-01-31", { banyak: 1 });
  cek("jawaban kosong tidak meledak", hk.ok === true && hk.jumlahOrang === 0);

  cek("rapor karangan dijawab tidak dikenali", (await R.jalankan("tidakAda", "bulanan", "2026-01-31")).ok === false);

  db.query = queryAsli;

  /* ----------------------------------------------------------- rutenya */

  console.log("== Rute terdaftar ==");
  const RUTE = fs.readFileSync(path.join(__dirname, "..", "routes", "internalGatewayRoutes.js"), "utf8");
  cek("rute /e-audit/rapor-aparatur terdaftar", RUTE.includes('router.get("/e-audit/rapor-aparatur"'));
  cek("layanan rapor aparatur disambungkan", RUTE.includes('require("../services/raporAparaturService")'));

  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal === 0 ? 0 : 1);
})().catch((e) => {
  db.query = queryAsli;
  console.log("  GAGAL  penjaga sendiri meledak - " + String(e && e.message ? e.message : e));
  console.log(`\nHasil: ${lulus} lulus, ${gagal + 1} gagal`);
  process.exit(1);
});
