// Ukur (baca saja) ketepatan MAKNA usulan pengisi atas isian petugas di ABT lokal untuk isian berkosakata tertutup, yang pembanding
// teks biasa (ukur-gerbang-u6.cjs) menganggap beda padahal sama makna: status sebelum nikah (Jejaka = Perjaka = Bujang; Perawan = Gadis),
// pendidikan (SMP = SLTP, SMA = SLTA), pekerjaan "belum ada" = "belum bekerja", bentuk kata tujuan (mengurus = pengurusan).
//   node scripts/isi-sipp-abt/ukur-semantik-27okt.cjs [--keluar berkas.json] [--jenis 360,362] [--maks 900]
// Memanggil RUTE BOT SUNGGUHAN /abt/usulan (sumber sipp + itsbat / posita-lain) seperti ukur-gerbang-u6.cjs, lalu membandingkan per
// (kode, asal) dengan golongan makna. Hanya SELECT. Keluaran: { kode@asal: { n, banding, cocok, persen, contohSalah (tanpa nama) } }.
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const arg = (n, b) => {
  const i = process.argv.indexOf(n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : b;
};
const akar = path.resolve(__dirname, "..", "..");
const keluar = arg("--keluar", "");
const maks = Number(arg("--maks", "900"));
const jenisFokus = arg("--jenis", "360,362,354,358,363").split(",").map(Number);
process.env.ALETA_BOT_DB_SIPP_NAME = process.env.ALETA_BOT_DB_SIPP_NAME || "sipp_donggala";
process.env.ALETA_BOT_DB_USER = process.env.ALETA_BOT_DB_USER || "root";
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const FP = require(path.join(akar, "aleta_bot", "services", "faktaPerkara.js"));
const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", typeCast: (f) => f.string() });
const q = (s, p) => new Promise((a, b) => kon.query(s, p || [], (e, r) => (e ? b(e) : a(r))));

let penangan = null;
function muatRute() {
  if (penangan) return penangan;
  const r = require(path.join(akar, "aleta_bot", "routes", "internalGatewayRoutes.js"));
  const lapis = (r.router || r).stack.find((l) => l.route && l.route.path === "/abt/usulan" && l.route.methods.post);
  penangan = lapis.route.stack[lapis.route.stack.length - 1].handle;
  return penangan;
}
const panggilRute = (body) =>
  new Promise((ok, gagal) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(o) { ok(o); }, send(o) { ok(o); } };
    Promise.resolve(muatRute()({ body, headers: {}, query: {}, get: () => "" }, res, () => {})).catch(gagal);
  });

const rapat = (t) => String(t == null ? "" : t).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

/** Golongan makna per kode; null = tidak ada golongan (kode tidak diukur dengan pembanding makna). */
const GOLONGAN = {
  status: (t) => {
    t = rapat(t);
    if (/duda/.test(t)) return /mati/.test(t) ? "duda-mati" : /cerai|hidup/.test(t) ? "duda-hidup" : "duda";
    if (/janda/.test(t)) return /mati/.test(t) ? "janda-mati" : /cerai|hidup/.test(t) ? "janda-hidup" : "janda";
    if (/jejaka|perjaka|bujang|lajang/.test(t)) return "jejaka";
    if (/perawan|gadis/.test(t)) return "perawan";
    return "";
  },
  pendidikan: (t) => {
    t = rapat(t);
    if (/tidak\s+(?:pernah\s+)?sekolah|belum\s+sekolah/.test(t)) return "tidak-sekolah";
    if (/tidak\s+tamat\s+(?:sd|sekolah\s+dasar)/.test(t)) return "tidak-tamat-sd";
    if (/\bsltp\b|\bsmp\b|\bmts\b|menengah\s+pertama|lanjutan\s+tingkat\s+pertama/.test(t)) return "smp";
    if (/\bslta\b|\bsma\b|\bsmk\b|\bma\b|menengah\s+atas|lanjutan\s+tingkat\s+atas/.test(t)) return "sma";
    if (/\bsd\b|\bmi\b|sekolah\s+dasar|ibtidaiyah/.test(t)) return "sd";
    if (/\bd[1-4]\b|\bs[1-3]\b|sarjana|diploma|kuliah|mahasiswa/.test(t)) return "tinggi";
    return "";
  },
  pekerjaan: (t) => {
    t = rapat(t);
    if (/belum\s+(?:ada|bekerja)|tidak\s+(?:ada|bekerja)|belum\s+punya|^-$/.test(t)) return "belum";
    if (/pelajar|siswa|mahasiswa/.test(t)) return "pelajar";
    if (/rumah\s+tangga/.test(t)) return "irt";
    return t.replace(/[^a-z ]/g, "").split(" ").slice(0, 2).join(" ");
  },
  tujuan: (t) =>
    rapat(t)
      .replace(/^untuk\s+/, "")
      .replace(/\b(?:mengurus|pengurusan|pengurus|penerbitan|menerbitkan|mengurusnya)\b/g, "urus")
      .replace(/\b(?:kepentingan\s+hukum|keperluan|kepentingan)\s+lainnya\b/g, "lain")
      .replace(/\b(?:serta|dan|untuk)\b/g, " ")
      .replace(/[^a-z ]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
};
const PETA_KODE = { "1002": "status", "1003": "status", "2029": "status", "2030": "status", "9204": "status", "0609": "pendidikan", "0603": "pendidikan", "0610": "pekerjaan", "0604": "pekerjaan", "8171": "tujuan" };

function samaMakna(kode, usulan, petugas) {
  const g = GOLONGAN[PETA_KODE[kode]];
  const a = g(usulan);
  const b = g(petugas);
  if (!a || !b) return null;
  if (PETA_KODE[kode] === "tujuan") {
    if (a === b || a.includes(b) || b.includes(a)) return true;
    const ta = new Set(a.split(" ").filter((x) => x.length > 2));
    const tb = new Set(b.split(" ").filter((x) => x.length > 2));
    const ir = [...ta].filter((x) => tb.has(x)).length;
    return ir / Math.max(1, Math.min(ta.size, tb.size)) >= 0.8;
  }
  return a === b || (PETA_KODE[kode] === "status" && a.split("-")[0] === b.split("-")[0] && (a.indexOf("-") < 0 || b.indexOf("-") < 0));
}

const asalNama = (u) => {
  const p = FP.prioUsulan(u);
  return p === FP.PRIO.sipp ? "sipp" : p === FP.PRIO.berkas ? "berkas" : "posita";
};

(async () => {
  const baris = await q(
    `SELECT p.perkara_id, p.nomor_perkara, p.jenis_perkara_id j, p.alur_perkara_id a, p.jenis_perkara_text jt, p.posita, p.petitum
       FROM sipp_donggala.perkara p
      WHERE p.jenis_perkara_id IN (${jenisFokus.join(",")}) AND p.posita IS NOT NULL AND LENGTH(p.posita) > 60
        AND p.perkara_id IN (SELECT DISTINCT perkara_id FROM aps_badilag.abt_data_teks WHERE CAST(no_var AS UNSIGNED) IN (${Object.keys(PETA_KODE).join(",")}))
      ORDER BY p.perkara_id DESC LIMIT ${maks}`
  );
  const agregat = {};
  for (const p of baris) {
    const petugasBaris = await q("SELECT CAST(no_var AS UNSIGNED) k, data FROM aps_badilag.abt_data_teks WHERE perkara_id = ?", [p.perkara_id]);
    const petugas = {};
    for (const b of petugasBaris) petugas[String(b.k).padStart(4, "0")] = b.data;
    const rute = [];
    const s = await panggilRute({ nomorPerkara: p.nomor_perkara, sumber: "sipp" }).catch(() => null);
    if (s && s.sipp && Array.isArray(s.sipp.usulan)) rute.push(s.sipp.usulan);
    if (Number(p.j) === 360) {
      const it = await panggilRute({ nomorPerkara: p.nomor_perkara, posita: p.posita, pemohon: "Pemohon I", pelaku: "Pemohon II", jenisPerkara: p.jt, alur: String(p.a), sumber: "itsbat" }).catch(() => null);
      if (it && it.itsbat && Array.isArray(it.itsbat.usulan)) rute.push(it.itsbat.usulan);
    }
    const dasar = { nomorPerkara: p.nomor_perkara, pelaku: "Termohon", lawan: "Pemohon", posita: p.posita, petitum: p.petitum, jenisPerkara: p.jt, alur: String(p.a), pemohon: "Pemohon" };
    const pl = await panggilRute({ ...dasar, sumber: "posita-lain" }).catch(() => null);
    if (pl && pl.positaLain && Array.isArray(pl.positaLain.usulan)) rute.push(pl.positaLain.usulan);
    for (const daftar of rute) {
      const lihat = new Set();
      for (const u of daftar) {
        if (!u || !u.kode || !rapat(u.nilai)) continue;
        const kode = String(u.kode).padStart(4, "0");
        if (!PETA_KODE[kode]) continue;
        const kunci = `${kode}@${asalNama(u)}`;
        if (lihat.has(kunci)) continue;
        lihat.add(kunci);
        const a = (agregat[kunci] = agregat[kunci] || { n: 0, banding: 0, cocok: 0, contohSalah: [] });
        a.n++;
        if (petugas[kode] && rapat(petugas[kode])) {
          const c = samaMakna(kode, u.nilai, petugas[kode]);
          if (c === null) continue;
          a.banding++;
          if (c) a.cocok++;
          else if (a.contohSalah.length < 3) a.contohSalah.push({ usulan: rapat(u.nilai).slice(0, 60), petugas: rapat(petugas[kode]).slice(0, 60) });
        }
      }
    }
  }
  for (const a of Object.values(agregat)) a.persen = a.banding ? Math.round((a.cocok / a.banding) * 1000) / 10 : null;
  const out = { diukur: new Date().toISOString().slice(0, 10), perkara: baris.length, jenis: jenisFokus, agregat };
  if (keluar) fs.writeFileSync(keluar, JSON.stringify(out, null, 1));
  for (const [k, a] of Object.entries(agregat).sort()) console.log(k.padEnd(14), `n ${a.n}`.padEnd(8), `banding ${a.banding}`.padEnd(13), `cocok ${a.cocok}`.padEnd(11), a.persen + "%");
  kon.end();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
