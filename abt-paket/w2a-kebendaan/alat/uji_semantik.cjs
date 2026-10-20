// Uji perilaku kueri variabel paket w2a-kebendaan atas perkara nyata + isian fixture (SELECT atas SIPP lokal; isian ditulis HANYA ke DB uji aps_badilag_w2ap).
//   node uji_semantik.cjs  -> JSON {skenario: {no_var: nilai}}
// Token #nnnn# di dalam kueri dibiarkan apa adanya (tidak dievaluasi ABT); yang diuji adalah rakitan kalimat, nomor butir dan syarat tampil.
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const akar = path.resolve(__dirname, "..", "..", "..");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const V = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "variabel.json"), "utf8"));
const DB = "aps_badilag_w2ap";
const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", multipleStatements: true, typeCast: (f) => f.string() });
const q = (s, p) => new Promise((ok, g) => kon.query(s, p || [], (e, r) => (e ? g(e) : ok(r))));

async function jalankan(pid, nomor) {
  const hasil = {};
  for (const no of nomor) {
    const v = V.find((x) => x.no === no);
    const sql = v.sql.split("aps_badilag.").join(DB + ".").split("#perkara_id#").join(String(pid));
    await q("USE sipp_donggala");
    try {
      const r = await q(sql);
      hasil[no] = r[0] ? r[0].data : null;
    } catch (e) {
      hasil[no] = "GALAT " + e.message.slice(0, 150);
    }
  }
  return hasil;
}

async function isian(pid, peta) {
  await q(`DELETE FROM ${DB}.abt_data_teks WHERE perkara_id = ?`, [pid]);
  for (const [no, teks] of Object.entries(peta)) if (teks) await q(`INSERT INTO ${DB}.abt_data_teks (perkara_id, no_var, data) VALUES (?, ?, ?)`, [pid, Number(no), teks]);
}

(async () => {
  await q(`DROP DATABASE IF EXISTS ${DB}; CREATE DATABASE ${DB} DEFAULT CHARSET latin1;`);
  await q(`CREATE TABLE ${DB}.abt_data_teks LIKE aps_badilag_w2a.abt_data_teks`);
  const fx = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixture", n), "utf8"));
  const semua = {};

  const hb = fx("hb-10025.json");
  await isian(hb.perkara_id, hb.isian);
  semua.hb_fixture = await jalankan(hb.perkara_id, [4788, 4789, 4790, 4791, 4792, 4793, 4794, 4795, 4796, 4799, 4800, 4801, 4802, 4803, 4804, 4805, 4806, 4807, 4808, 4809, 4810, 4811, 4812, 4813, 4814]);

  await isian(9789, {});
  semua.hb_netral = await jalankan(9789, [4788, 4789, 4790, 4791, 4793, 4794, 4796, 4799, 4800, 4801, 4802, 4803, 4804, 4807, 4809, 4810, 4811, 4812, 4813, 4814]);

  const wr = fx("waris-9528.json");
  await isian(wr.perkara_id, wr.isian);
  semua.waris_fixture = await jalankan(wr.perkara_id, [4820, 4821, 4823, 4824, 4825, 4826, 4827, 4828, 4829, 4831, 4832]);
  semua.waris_fixture_bagian = await jalankan(wr.perkara_id, [4822]);

  await isian(10006, {});
  semua.waris_netral = await jalankan(10006, [4820, 4821, 4822, 4823, 4824, 4825, 4826, 4827, 4828, 4829, 4830, 4831, 4832]);

  // waris: keputusan seluruhnya + tanpa penguasa + sita sah
  await isian(9528, { 4815: "dikabulkan seluruhnya", 4817: "tidak ada", 4783: "sah dan berharga", 4784: "ditolak", 4785: "ditolak" });
  semua.waris_seluruhnya = await jalankan(9528, [4824, 4827, 4828, 4832]);

  // wasiat 9291: tanpa keputusan lalu dengan keputusan
  await isian(9291, {});
  semua.wasiat_tanpa_keputusan = await jalankan(9291, [4835, 4836, 4837, 4838, 4839, 4840, 4841]);
  await isian(9291, { 4783: "sah dan berharga", 4784: "ditolak", 4785: "ditolak", 4815: "dikabulkan sebagian" });
  semua.wasiat_keputusan = await jalankan(9291, [4835, 4836, 4837, 4838, 4839, 4840, 4841]);

  // ekonomi syariah gugatan sederhana 8781
  await isian(8781, {});
  semua.es_tanpa_keputusan = await jalankan(8781, [4833, 4835, 4836, 4837, 4838, 4845, 4846, 4847]);
  await isian(8781, { 4783: "sah dan berharga", 4784: "ditolak", 4842: "dikabulkan: Menghukum Tergugat membayar denda keterlambatan sejumlah Rp100.000,00", 4843: "ditolak: jaminan tidak disebut dalam akad", 4844: "ditolak: akad tidak dibatalkan", 9955: "Fotokopi Akad Murabahah diberi tanda P.1;\nFotokopi KTP diberi tanda P.2;\nBukti transfer diberi tanda P.3" });
  semua.es_keputusan = await jalankan(8781, [4833, 4835, 4837, 4838]);

  console.log(JSON.stringify(semua));
  kon.end();
})().catch((e) => {
  console.error("GALAT", e.message);
  process.exit(1);
});
