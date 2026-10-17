// Beban isian tangan NYATA: berapa perkara (sipp_donggala, terdaftar >= 2023) yang isiannya diketik petugas
// di ABT lokal (aps_badilag.abt_data_teks / abt_data_tanggal). Dipakai menimbang prioritas pengisi baru.
//   node scripts/isi-sipp-abt/beban-manual.cjs [keluaran.json]
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const akar = path.resolve(__dirname, "..", "..");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");

function kueri(sql) {
  const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: "aps_badilag" });
  return new Promise((ok, gagal) => kon.query(sql, (e, r) => (kon.end(), e ? gagal(e) : ok(r))));
}

(async () => {
  const baris = await kueri(`
    SELECT x.no_var, COUNT(DISTINCT x.perkara_id) n,
           SUM(x.p_jenis IN (346,347)) cerai, SUM(x.p_jenis = 360) itsbat
      FROM (
        SELECT d.no_var, d.perkara_id, p.jenis_perkara_id p_jenis
          FROM abt_data_teks d JOIN sipp_donggala.perkara p ON p.perkara_id = d.perkara_id
         WHERE p.tanggal_pendaftaran >= '2023-01-01' AND TRIM(COALESCE(d.data,'')) <> ''
        UNION ALL
        SELECT d.no_var, d.perkara_id, p.jenis_perkara_id
          FROM abt_data_tanggal d JOIN sipp_donggala.perkara p ON p.perkara_id = d.perkara_id
         WHERE p.tanggal_pendaftaran >= '2023-01-01'
      ) x GROUP BY x.no_var`);
  const hasil = {};
  for (const b of baris) hasil[String(b.no_var).padStart(4, "0")] = { perkara: b.n, cerai: Number(b.cerai), itsbat: Number(b.itsbat) };
  const keluar = process.argv[2];
  if (keluar) fs.writeFileSync(keluar, JSON.stringify(hasil));
  console.log("kode dengan isian tangan:", Object.keys(hasil).length);
})();
