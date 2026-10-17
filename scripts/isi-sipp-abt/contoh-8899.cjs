// Menampilkan contoh nyata usulan 8899 (pokok kesepakatan sebagian) beserta potongan isi SIPP, untuk pemeriksaan mata.
const path = require("path");
const { createRequire } = require("module");
const akar = path.resolve(__dirname, "..", "..");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const { usulanPokokSebagian } = require(path.join(akar, "aleta_bot", "services", "abtIsianSippLanjutan.js"));
const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: "sipp_donggala", typeCast: (f) => f.string() });
kon.query(
  "SELECT m.perkara_id, m.hasil_mediasi hasil, m.isi_kesepakatan_perdamaian isi FROM perkara_mediasi m JOIN perkara p USING(perkara_id) WHERE p.tanggal_pendaftaran >= '2023-01-01' AND m.hasil_mediasi = 'S' ORDER BY RAND() LIMIT ?",
  [Number(process.argv[2] || 10)],
  (e, r) => {
    if (e) throw e;
    for (const m of r) {
      const u = usulanPokokSebagian(m)[0];
      const polos = String(m.isi || "").replace(/<[^>]*>/g, " ").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
      console.log(m.perkara_id, "=>", u ? `${u.nilai} [${u.keyakinan}]` : "(tidak ada)", "\n    ", polos.slice(0, 260));
    }
    kon.end();
  }
);
