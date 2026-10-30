// Banding kueri lama vs baru (paket abt-tanggal-agenda-31okt) atas perkara nyata salinan SIPP: baris PERTAMA tiap kueri (yang dipakai ABT).
// pakai: node banding.js <basis SIPP> <tanggal daftar mulai> [keluaran.json]   (NODE_PATH = node_modules bot yang memuat mysql)
const mysql = require("mysql"); const fs = require("fs"); const path = require("path");
const [db, mulai, keluar] = process.argv.slice(2);
const baris = fs.readFileSync(path.join(__dirname, "../hasil/kueri-lama-baru.tsv"), "utf8").trim().split("\n").map((l) => l.split("\t"));
const c = mysql.createConnection({ host: "127.0.0.1", user: "root", database: db, multipleStatements: false });
const q = (s) => new Promise((ok, no) => c.query(s, (e, r) => (e ? no(e) : ok(r))));
(async () => {
  const pk = await q(`SELECT perkara_id id, jenis_perkara_id j FROM perkara WHERE tanggal_pendaftaran >= '${mulai}'`);
  const hasil = {};
  for (const [no, lama, baru] of baris) {
    const L = lama.split("\\n").join("\n").replace(/;\s*$/, ""), B = baru.split("\\n").join("\n").replace(/;\s*$/, "");
    const h = (hasil[no] = { n: 0, samaTerisi: 0, samaKosong: 0, baruTerisi: 0, berubahTerisi: 0, galat: 0, contoh: [] });
    for (const p of pk) {
      h.n++;
      try {
        const a = await q(L.split("#perkara_id#").join(p.id)), b = await q(B.split("#perkara_id#").join(p.id));
        const fa = a.length ? String(a[0].data instanceof Date ? a[0].data.toISOString().slice(0, 10) : a[0].data) : "(tanpa baris)";
        const fb = b.length ? String(b[0].data instanceof Date ? b[0].data.toISOString().slice(0, 10) : b[0].data) : "(tanpa baris)";
        if (fa === fb) { if (fa === "") h.samaKosong++; else h.samaTerisi++; }
        else if (fa === "") { h.baruTerisi++; if (h.contoh.length < 6) h.contoh.push([p.id, fb]); }
        else { h.berubahTerisi++; h.contoh.push(["BERUBAH", p.id, fa, fb]); }
      } catch (e) { h.galat++; if (h.galat < 3) console.error(no, p.id, e.message); }
    }
    console.log(no, JSON.stringify({ ...h, contoh: undefined }));
  }
  c.end();
  if (keluar) fs.writeFileSync(keluar, JSON.stringify(hasil, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
