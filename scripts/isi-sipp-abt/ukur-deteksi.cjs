// Mengukur berapa perkara (sipp_donggala, terdaftar >= 2023, per jenis) yang menghasilkan nilai untuk tiap kode
// pada modul deteksi bot yang MURNI (deteksi(posita)): cerai, dispensasi kawin, waris, dst. Hanya SELECT.
//   node scripts/isi-sipp-abt/ukur-deteksi.cjs [keluaran.json]
// Catatan: jalur itsbat/saksi/cerai-alasan memakai layanan lain (abtUsulanService) dan tidak diukur di sini.
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const akar = path.resolve(__dirname, "..", "..");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const deteksi = require(path.join(akar, "aleta_bot", "services", "deteksi", "index.js"));

const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: "sipp_donggala", typeCast: (f) => f.string() });
const q = (sql, p) => new Promise((ok, gagal) => kon.query(sql, p || [], (e, r) => (e ? gagal(e) : ok(r))));

(async () => {
  const baris = await q(
    "SELECT perkara_id, jenis_perkara_id j, alur_perkara_id a, posita, petitum FROM perkara WHERE tanggal_pendaftaran >= '2023-01-01' AND posita IS NOT NULL AND posita <> ''"
  );
  const hasil = {};
  for (const b of baris) {
    const modul = deteksi.modulUntuk(Number(b.j));
    if (!modul) continue;
    let fakta = {};
    try {
      fakta = modul.deteksi(String(b.posita), { petitum: String(b.petitum || ""), alur: String(b.a || "") }) || {};
    } catch {
      fakta = {};
    }
    const r = (hasil[modul.kunci] = hasil[modul.kunci] || { perkara: 0, kode: {} });
    r.perkara++;
    for (const [kode, f] of Object.entries(fakta)) {
      if (f && String(f.nilai || "").trim()) r.kode[kode] = (r.kode[kode] || 0) + 1;
    }
  }
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(hasil, null, 1));
  for (const [k, r] of Object.entries(hasil)) console.log(k.padEnd(18), `perkara berposita ${r.perkara}`, JSON.stringify(r.kode));
  kon.end();
})();
