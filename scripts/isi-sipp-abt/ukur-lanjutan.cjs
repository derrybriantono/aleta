// Mengukur pengisi baru (aleta_bot/services/abtIsianSippLanjutan.js) atas data nyata salinan lokal:
// berapa perkara (sipp_donggala, terdaftar >= 2023) yang kini terisi, dan - bila ada isian petugas di
// aps_badilag (abt_data_teks / abt_data_tanggal) - berapa yang cocok persis. Hanya SELECT.
//   node scripts/isi-sipp-abt/ukur-lanjutan.cjs [keluaran.json]
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const akar = path.resolve(__dirname, "..", "..");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const { usulanLanjutanSipp } = require(path.join(akar, "aleta_bot", "services", "abtIsianSippLanjutan.js"));

const kolam = mysql.createPool({ host: "127.0.0.1", user: "root", database: "sipp_donggala", connectionLimit: 4, typeCast: (f) => f.string() });
const q = (sql, p) => new Promise((ok, gagal) => kolam.query(sql, p || [], (e, r) => (e ? gagal(e) : ok(r))));

(async () => {
  const perkara = await q("SELECT perkara_id, jenis_perkara_id j FROM perkara WHERE tanggal_pendaftaran >= '2023-01-01'");
  const dihitung = {};
  const nilaiPerkara = new Map(); // `${kode}:${perkara_id}` -> nilai (dd/mm/yyyy)
  const perJenis = {};
  let selesai = 0;
  const antri = [...perkara];
  const kerja = async () => {
    while (antri.length) {
      const p = antri.pop();
      const u = await usulanLanjutanSipp(Number(p.perkara_id), q);
      for (const x of u) {
        dihitung[x.kode] = dihitung[x.kode] || { perkara: 0, pasti_cukup: 0, ragu: 0 };
        dihitung[x.kode].perkara++;
        dihitung[x.kode][x.keyakinan === "ragu" ? "ragu" : "pasti_cukup"]++;
        perJenis[x.kode] = perJenis[x.kode] || {};
        perJenis[x.kode][p.j] = (perJenis[x.kode][p.j] || 0) + 1;
        nilaiPerkara.set(`${x.kode}:${p.perkara_id}`, x.nilai);
      }
      selesai++;
    }
  };
  await Promise.all([kerja(), kerja(), kerja(), kerja()]);

  // Pembanding isian petugas (ABT lokal).
  const ground = {};
  const dmy = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
  for (const kode of ["1183", "0303", "0185", "8705"]) {
    const baris = await new Promise((ok, gagal) => {
      const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: "aps_badilag", typeCast: (f) => f.string() });
      kon.query(
        "SELECT t.perkara_id, t.data FROM abt_data_tanggal t JOIN sipp_donggala.perkara p ON p.perkara_id = t.perkara_id WHERE t.no_var = ? AND p.tanggal_pendaftaran >= '2023-01-01'",
        [kode],
        (e, r) => (kon.end(), e ? gagal(e) : ok(r))
      );
    });
    let ada = 0;
    let cocok = 0;
    for (const b of baris) {
      const usul = nilaiPerkara.get(`${kode}:${b.perkara_id}`);
      if (!usul) continue;
      ada++;
      if (usul === dmy(String(b.data))) cocok++;
    }
    ground[kode] = { diketikPetugas: baris.length, adaUsulan: ada, cocokPersis: cocok };
  }
  const hasil = { perkaraDiperiksa: selesai, dihitung, perJenis, ground };
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(hasil, null, 1));
  console.log(JSON.stringify(hasil));
  kolam.end();
})();
