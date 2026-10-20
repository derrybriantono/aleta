// Mengukur pola W2a-K2 atas gugatan nyata di SIPP lokal (XAMPP, hanya BACA): node ukur_k2.js [--nama]
// Keluaran memuat jumlah dan kunci yang terbaca; nilai tampil hanya dengan --nama (berisi nama pihak, jangan disimpan di repo).
const path = require("path");
const { createRequire } = require("module");
const akar = path.resolve(__dirname, "..", "..", "..");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const { positaTambahan } = require(path.join(akar, "aleta_bot", "services", "isiJawabanSaksiPosita.js"));
const KB = require(path.join(akar, "aleta_bot", "services", "isiJawabanSaksiKebendaan.js"));
const tampil = process.argv.includes("--nama");

const q = (db, sql) =>
  new Promise((ok, g) => {
    const k = mysql.createConnection({ host: "127.0.0.1", user: "root", database: db, typeCast: (f) => f.string() });
    k.query(sql, (e, r) => {
      k.end();
      e ? g(e) : ok(r);
    });
  });

(async () => {
  const kasus = [
    ["sipp_donggala", 365, "wasiat"],
    ["sipp_donggala", 370, "eksyar"],
    ["sipp", 367, "wakaf"],
  ];
  for (const [db, jenisId, jenis] of kasus) {
    const baris = await q(db, `select perkara_id, nomor_perkara, posita, petitum, alur_perkara_id from perkara where jenis_perkara_id=${jenisId}`);
    for (const b of baris) {
      const fakta = positaTambahan(b.posita, jenis);
      const saran = KB.saranKeadaan(b.posita, b.petitum, jenis, { alur: b.alur_perkara_id });
      console.log(`== ${b.nomor_perkara} (${jenis}) fakta ${fakta.length}: ${fakta.map((x) => x.kunci).join(", ")}`);
      if (tampil) fakta.forEach((x) => console.log(`   ${x.kunci} [${x.yakin}] = ${x.nilai}`));
      console.log(`   saran keadaan ${saran.length}: ${saran.map((x) => `${x.kunci}=${x.nilai}`).join(", ")}`);
    }
  }
})();
