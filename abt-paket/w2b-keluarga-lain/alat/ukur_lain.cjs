// Mengukur pengisi saran keluarga LAIN-LAIN (aleta_bot/services/isiOtomatisW2b/lain.js) atas perkara Lain-Lain (369) nyata
// di SIPP lokal sipp_donggala (19 perkara; fixture data-uji/lain-posita.json, NIK disamarkan).
//
// PEMBANDING: bukan isian petugas (kode 4910-4939 baru, belum pernah diisi siapa pun di ABT server maupun lokal) melainkan PELABELAN
// MANUAL agen W2b-C atas posita/petitum (data-uji/lain-gold.json: potongan teks yang HARUS ada pada nilai usulan). Karena itu hasilnya
// tidak boleh dipakai menaikkan keyakinan ke "cukup"/"pasti": semua kode tetap saran (status "saran", pembanding < 20).
//
// Pakai: node abt-paket/w2b-keluarga-lain/alat/ukur_lain.cjs   -> menulis docs/gelombang2/UKURAN-W2b-lain.json
const fs = require("node:fs");
const path = require("node:path");
const REPO = path.resolve(__dirname, "..", "..", "..");
const L = require(path.join(REPO, "aleta_bot", "services", "isiOtomatisW2b", "lain.js"));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data-uji", "lain-posita.json"), "utf8"));
const gold = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data-uji", "lain-gold.json"), "utf8"));

const butir = (x) => ({ kode: x.kode, nama: x.kode, nilai: x.nilai, keyakinan: x.keyakinan, sumber: [] });
const kode = {};
const catat = (k) => (kode[k] = kode[k] || { n: 0, ditemukan: 0, cocok: 0, tambahanSalah: 0, contohSalah: [] });
const perPerkara = [];
let perkaraTanpaGold = 0;
let usulanDiPerkaraLain = 0;

for (const p of data) {
  const usulan = L.usulanLain({ jenisPerkaraId: 369, posita: p.posita, petitum: p.petitum, alur: p.alur }, butir).filter((u) => u.keyakinan !== "tidak_ada_sumber");
  const peta = Object.fromEntries(usulan.map((u) => [u.kode, u.nilai]));
  const g = gold[p.nomor];
  if (!g) {
    perkaraTanpaGold += 1;
    usulanDiPerkaraLain += usulan.length;
    perPerkara.push({ nomor: p.nomor, subJenis: L.subJenis(p.posita, p.petitum, p.alur), usulan: usulan.length });
    continue;
  }
  for (const [k, potongan] of Object.entries(g)) {
    const e = catat(k);
    e.n += 1;
    if (peta[k] !== undefined) {
      e.ditemukan += 1;
      if (potongan.every((s) => peta[k].toLowerCase().includes(s.toLowerCase()))) e.cocok += 1;
      else e.contohSalah.push({ nomor: p.nomor, usulan: peta[k], harusMemuat: potongan });
    }
  }
  for (const k of Object.keys(peta)) {
    if (!(k in g)) {
      const e = catat(k);
      e.tambahanSalah += 1;
      e.contohSalah.push({ nomor: p.nomor, usulan: peta[k], harusMemuat: "(tidak ada di posita menurut pelabelan)" });
    }
  }
  perPerkara.push({ nomor: p.nomor, subJenis: L.subJenis(p.posita, p.petitum, p.alur), usulan: usulan.length, gold: Object.keys(g).length });
}

for (const e of Object.values(kode)) {
  e.persenCocokDariAda = e.n ? Math.round((1000 * e.cocok) / e.n) / 10 : null;
  e.status = "saran";
  e.alasanStatus = "pembanding hasil pelabelan manual dan kurang dari 20 perkara; kode baru belum pernah diisi petugas";
}
const hasil = {
  skema: "ukuran-w2b-lain/1",
  diukur: "2026-10-21",
  cara: "alat/ukur_lain.cjs: pengisi isiOtomatisW2b/lain.js atas 19 perkara Lain-Lain (369) sipp_donggala; pembanding = pelabelan manual agen atas posita (data-uji/lain-gold.json)",
  batas: [
    "Hanya 6 perkara pengangkatan anak dan 1 penetapan kematian (permohonan umum); mafqud TIDAK ADA perkara nyata (diuji dengan fixture di uji w2b-lain-isian-21okt).",
    "Kode 4910-4939 baru: belum ada isian petugas pembanding di ABT server (0 baris) maupun lokal; ketepatan di sini = kecocokan dengan pelabelan manual, bukan dengan isian hakim.",
    "Pola pembaca disusun atas perkara yang sama dengan yang diukur (tidak ada himpunan uji terpisah), sehingga angka 100% ini batas atas, bukan jaminan untuk perkara baru.",
    "Semua usulan keyakinan ragu (saran). Naik tingkat hanya setelah ada pembanding isian petugas >= 20 perkara.",
  ],
  jumlahPerkara: data.length,
  perkaraBerlabel: Object.keys(gold).length,
  perkaraTanpaLabel: perkaraTanpaGold,
  usulanPadaPerkaraBukanKeluargaIni: usulanDiPerkaraLain,
  kode,
  perPerkara,
};
const tujuan = path.join(REPO, "docs", "gelombang2", "UKURAN-W2b-lain.json");
fs.mkdirSync(path.dirname(tujuan), { recursive: true });
fs.writeFileSync(tujuan, JSON.stringify(hasil, null, 1) + "\n");
const ringkas = Object.entries(kode).map(([k, e]) => `${k}: ${e.cocok}/${e.n} cocok, ${e.ditemukan} ditemukan, ${e.tambahanSalah} tambahan salah`);
console.log(ringkas.join("\n"));
console.log(`perkara tanpa label: ${perkaraTanpaGold}, usulan pada perkara bukan keluarga ini (harus 0 kecuali penetapan kematian): ${usulanDiPerkaraLain}`);
