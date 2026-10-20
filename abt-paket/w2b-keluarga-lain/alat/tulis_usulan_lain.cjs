// Menulis berkas usulan untuk sesi utama (tidak mengubah config bot): lain-peta-fakta.json dan lain-gerbang.json,
// dari docs/gelombang2/UKURAN-W2b-lain.json dan nama isian pengisi. Pakai: node tulis_usulan_lain.cjs
const fs = require("node:fs");
const path = require("node:path");
const REPO = path.resolve(__dirname, "..", "..", "..");
const { NAMA } = require(path.join(REPO, "aleta_bot", "services", "isiOtomatisW2b", "lain.js"));
const ukur = JSON.parse(fs.readFileSync(path.join(REPO, "docs", "gelombang2", "UKURAN-W2b-lain.json"), "utf8"));
const keluar = path.join(REPO, "abt-paket", "w2b-keluarga-lain", "untuk-sesi-utama");
fs.mkdirSync(keluar, { recursive: true });

const FAKTA = {
  "angkat.sejakDiasuh": ["4910", "Sejak kapan anak diasuh Pemohon", "teks"],
  "angkat.alasanPenyerahan": ["4911", NAMA["4911"], "teks"],
  "angkat.riwayatPerkawinan": ["4912", NAMA["4912"], "teks"],
  "angkat.izinInstansiSosial": ["4913", NAMA["4913"], "teks"],
  "angkat.penghasilan": ["4914", NAMA["4914"], "teks"],
  "angkat.tujuan": ["4915", NAMA["4915"], "teks"],
  "mafqud.identitasHilang": ["4920", NAMA["4920"], "teks"],
  "mafqud.keluargaDitinggal": ["4921", NAMA["4921"], "teks"],
  "mafqud.hartaDitinggal": ["4922", NAMA["4922"], "teks"],
  "mafqud.sebabKepergian": ["4923", NAMA["4923"], "teks"],
  "umum.halDimohonkan": ["4930", NAMA["4930"], "teks"],
  "umum.waktuTempat": ["4931", NAMA["4931"], "teks"],
  "umum.keperluan": ["4933", NAMA["4933"], "teks"],
  "umum.sebabMeninggalMakam": ["4934", NAMA["4934"], "teks"],
};
const fakta = {};
for (const [k, [kode, label, tipe]] of Object.entries(FAKTA)) fakta[k] = { label, tipe, kode: [kode], hanyaSaran: true };
fs.writeFileSync(path.join(keluar, "lain-peta-fakta.json"), JSON.stringify({
  skema: "peta-fakta-variabel/1",
  catatan: "TAMBAHAN W2b-C (pengangkatan anak, mafqud, permohonan umum) untuk aleta_bot/config/peta-fakta-variabel.json. Satu kode satu fakta; semua hanyaSaran karena kode baru belum terukur. Gabungkan saat merge ('fakta' = entri baru).",
  tambahKode: {},
  fakta,
}, null, 2) + "\n");

const kode = {};
for (const [k, e] of Object.entries(ukur.kode)) {
  kode[k] = {
    nama: NAMA[k],
    asal: { posita: { n: e.n, banding: e.n, cocok: e.cocok, persen: e.persenCocokDariAda, status: "saran", pangkatMaks: "ragu", dasar: "pelabelan manual agen W2b-C atas posita (bukan isian petugas)" } },
  };
}
fs.writeFileSync(path.join(keluar, "lain-gerbang.json"), JSON.stringify({
  skema: "gerbang-isian/1",
  catatan: "USULAN W2b-C untuk aleta_bot/config/gerbang-isian.json (kode -> ukuran). SEMUA berstatus saran: pembanding hanya 1-6 perkara hasil pelabelan manual dan belum ada isian petugas untuk kode 4910-4939. Jangan dinaikkan sebelum >= 20 perkara dengan isian petugas. Data ukur mentah: docs/gelombang2/UKURAN-W2b-lain.json.",
  kode,
  belumTerukur: Object.fromEntries(["4920", "4921", "4922", "4923"].map((k) => [k, "mafqud: tidak ada perkara nyata; hanya diuji dengan fixture"])),
}, null, 2) + "\n");
console.log("ditulis", Object.keys(fakta).length, "fakta,", Object.keys(kode).length, "kode gerbang");
