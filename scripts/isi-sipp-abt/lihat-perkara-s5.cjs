// Menampilkan usulan hasil rantai Blangko Derry untuk satu perkara (baca saja): node scripts/isi-sipp-abt/lihat-perkara-s5.cjs "228/Pdt.P/2026/PA.Dgl" [--akar <repo>]
const fs = require("fs");
const path = require("path");
const arg = (n, b) => {
  const i = process.argv.indexOf(n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : b;
};
const akar = path.resolve(arg("--akar", path.resolve(__dirname, "..", "..")));
process.env.ALETA_BOT_DB_SIPP_NAME = process.env.ALETA_BOT_DB_SIPP_NAME || "sipp_donggala";
process.env.ALETA_BOT_DB_USER = process.env.ALETA_BOT_DB_USER || "root";
process.env.ALETA_BOT_DB_SIPP_HOST = process.env.ALETA_BOT_DB_SIPP_HOST || "127.0.0.1";
const { createRequire } = require("module");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const { kumpulUsulan } = require("./rantai-usulan-s5.cjs")(akar);
const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: "sipp_donggala", typeCast: (f) => f.string() });
const q = (sql, p) => new Promise((ok, gagal) => kon.query(sql, p || [], (e, r) => (e ? gagal(e) : ok(r))));
(async () => {
  const nomor = process.argv[2];
  const [b] = await q("SELECT perkara_id, nomor_perkara, jenis_perkara_id j, alur_perkara_id a, posita, petitum FROM perkara WHERE nomor_perkara = ? LIMIT 1", [nomor]);
  if (!b) throw new Error("perkara tidak ada");
  const sumber = await kumpulUsulan(b);
  sumber.forEach((daftar, i) => {
    console.log(`--- sumber ${i === 0 ? "sipp" : "posita-lain"} (${daftar.length})`);
    for (const u of daftar) if (String(u.nilai || "").trim()) console.log(`${u.kode} [${u.keyakinan}] ${String(u.nilai).replace(/\s+/g, " ").slice(0, 110)}  <- ${(u.sumber && u.sumber[0] && u.sumber[0].asal) || ""}`);
  });
  kon.end();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
