// Ukur (baca saja) cakupan isian popup blangko Derry untuk jenis perkara SELAIN cerai: per jenis/alur dan per kode, berapa perkara
// terisi OTOMATIS (mesin menulis), RAGU (saran), atau tidak terisi, beserta waktu rata-rata (ms) per perkara.
//   node scripts/isi-sipp-abt/ukur-perkara-lain-27okt.cjs [--akar <repo>] [--keluar <berkas.json>] [--maks 40] [--jenis 360,362,...] [--sejak 2023-01-01]
// Meniru ukur-isi-otomatis-20okt.cjs (rute bot /abt/usulan + mesin bersama ekstensi) tetapi memanggil rute SEKALI per perkara,
// menggabungkan blangko putusan + BAS, dan mencatat ms. Hanya SELECT pada sipp_donggala lokal. Contoh disamarkan: keluaran tanpa nama pihak.
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const arg = (nama, bawaan) => {
  const i = process.argv.indexOf(nama);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : bawaan;
};
const akarSkrip = path.resolve(__dirname, "..", "..");
const akar = path.resolve(arg("--akar", akarSkrip));
const keluar = arg("--keluar", "");
const maks = Number(arg("--maks", "40"));
const sejak = arg("--sejak", "2023-01-01");
const jenisFokus = arg("--jenis", "360,362,371,354,364,369,348,358,363,341,342,370,365,344,343").split(",").map(Number);

process.env.ALETA_BOT_DB_SIPP_NAME = process.env.ALETA_BOT_DB_SIPP_NAME || "sipp_donggala";
process.env.ALETA_BOT_DB_USER = process.env.ALETA_BOT_DB_USER || "root";
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const { petaFolder } = require(path.join(akarSkrip, "scripts", "isi-sipp-abt", "folder-jenis.cjs"));
require(path.join(akar, "ekstensi-sipp", "isi-sipp-bersama.js"));
const mesin = globalThis.AletaIsiSipp;

const { KELOMPOK } = require(path.join(akarSkrip, "scripts", "isi-sipp-abt", "pengisi-kurasi.cjs"));
// Kode yang dipenuhi berkas e-Court (OCR/gugatan/jawab-menjawab/bukti/KTP/kuasa) menurut kurasi - tak terukur lokal.
const KODE_ECOURT = new Set();
for (const g of KELOMPOK) if (/ecourt|Ecourt/.test(g.berkas) || /e-Court/.test(g.sumber || "") || g.berkas === "ekstensi-sipp/abt.js" || g.berkas === "ekstensi-sipp/blangko-derry-isian.js") for (const k of g.kode) KODE_ECOURT.add(k);

const daftarCek = JSON.parse(fs.readFileSync(path.join(akarSkrip, "docs", "isi-sipp-abt", "DAFTAR-CEK.json"), "utf8"));
const infoIsian = new Map(daftarCek.isian.map((x) => [x.kunci, x]));

let metadata = { manual: {}, opsional: {} };
try {
  const teks = fs.readFileSync(path.join(akar, "manajemen_surat", "src", "app", "api", "aleta-ecourt", "blangko-derry", "isian-metadata.ts"), "utf8");
  const ambil = (nama) => {
    const m = teks.match(new RegExp(`export const ${nama}[^=]*=\\s*(\\{[\\s\\S]*?\\n\\});`));
    return m ? new Function(`return (${m[1]});`)() : {};
  };
  metadata = { manual: ambil("ISIAN_MANUAL"), opsional: ambil("ISIAN_OPSIONAL") };
} catch {
  /* belum ada */
}

const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: "sipp_donggala", typeCast: (f) => f.string() });
const q = (sql, p) => new Promise((ok, gagal) => kon.query(sql, p || [], (e, r) => (e ? gagal(e) : ok(r))));

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function keIso(teks) {
  const t = String(teks || "").trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/);
  if (m) {
    const b = BULAN.findIndex((x) => x.toLowerCase().startsWith(m[2].toLowerCase().slice(0, 3)));
    if (b >= 0) return `${m[3]}-${String(b + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
}

let penangan = null;
function muatRute() {
  if (penangan) return penangan;
  const r = require(path.join(akar, "aleta_bot", "routes", "internalGatewayRoutes.js"));
  const router = r.router || r;
  const lapis = (router.stack || []).find((l) => l.route && l.route.path === "/abt/usulan" && l.route.methods.post);
  if (!lapis) throw new Error("rute /abt/usulan tidak ditemukan");
  const tumpuk = lapis.route.stack;
  penangan = tumpuk[tumpuk.length - 1].handle;
  return penangan;
}
function panggilRute(body) {
  return new Promise((ok, gagal) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(o) { ok(o); }, send(o) { ok(o); } };
    Promise.resolve(muatRute()({ body, headers: {}, query: {}, get: () => "" }, res, () => {})).catch(gagal);
  });
}

function kategori(b) {
  const berkas = String(b.jalur || "").split("/").pop();
  if (/^98 Relaas/.test(b.folder) || /^99 PTSP/.test(b.folder) || /^97 Sita/.test(b.folder)) return "lintas";
  if (/ikrar/i.test(berkas)) return "ikrar";
  if (/BAS/.test(b.folder) || /^\[\d+\w*\]\s*BAS/i.test(berkas)) return "bas";
  return "putusan";
}

(async () => {
  const baris = await q(
    `SELECT perkara_id, nomor_perkara, jenis_perkara_id j, alur_perkara_id a, jenis_perkara_text jt, posita, petitum
       FROM perkara WHERE tanggal_pendaftaran >= ? AND jenis_perkara_id IN (${jenisFokus.join(",")}) AND posita IS NOT NULL AND LENGTH(posita) > 120
       ORDER BY perkara_id DESC`,
    [sejak]
  );
  const hasil = {};
  const hitung = {};
  for (const b of baris) {
    const j = Number(b.j);
    const kj = `${b.j}/${b.a}`;
    hitung[kj] = (hitung[kj] || 0) + 1;
    if (hitung[kj] > maks) continue;
    const blangko = daftarCek.blangko.filter((x) => {
      const pf = petaFolder(x.folder);
      return !pf.universal && pf.freq.includes(kj) && kategori(x) !== "ikrar";
    });
    if (!blangko.length) continue;
    // kode -> {jenis, jumlah blangko pemakai}
    const kodeMap = new Map();
    for (const bl of blangko) {
      for (const k of bl.isian) {
        const x = infoIsian.get(k);
        if (!x || String(k).startsWith("tj:") || x.keadaan) continue;
        const c = kodeMap.get(k) || { jenis: x.jenis === "tanggal" ? "tanggal" : "teks", pakai: 0 };
        c.pakai++;
        kodeMap.set(k, c);
      }
    }
    const t0 = process.hrtime.bigint();
    const daftarUsulan = [];
    const sipp = await panggilRute({ nomorPerkara: b.nomor_perkara, sumber: "sipp" }).catch(() => null);
    if (sipp && sipp.sipp && Array.isArray(sipp.sipp.usulan)) daftarUsulan.push(sipp.sipp.usulan);
    if (j === 360) {
      const jw = await panggilRute({ nomorPerkara: b.nomor_perkara, posita: b.posita, pemohon: "Pemohon I", pelaku: "Pemohon II", jenisPerkara: b.jt, alur: String(b.a), sumber: "itsbat" }).catch(() => null);
      if (jw && jw.itsbat && Array.isArray(jw.itsbat.usulan)) daftarUsulan.push(jw.itsbat.usulan);
    }
    const dasar = { nomorPerkara: b.nomor_perkara, pelaku: "Termohon", lawan: "Pemohon", posita: b.posita, petitum: b.petitum, jenisPerkara: b.jt, alur: String(b.a), pemohon: "Pemohon" };
    const jl = await panggilRute({ ...dasar, sumber: "posita-lain" }).catch(() => null);
    if (jl && jl.positaLain && Array.isArray(jl.positaLain.usulan)) daftarUsulan.push(jl.positaLain.usulan);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const kodeAda = new Set(kodeMap.keys());
    const usulan = mesin.pilihPerKode(daftarUsulan, kodeAda);
    const katalog = [...kodeMap.entries()].map(([kode, v]) => ({ kode, nama: (infoIsian.get(kode) || {}).nama || "", jenis: v.jenis, opsi: [], kosong: true, bolehGanti: false, manual: Boolean(metadata.manual[kode]), alasanManual: metadata.manual[kode] || "" }));
    const rencana = mesin.rencanakan(usulan, katalog, keIso, daftarUsulan);
    const tulis = new Set(rencana.tulis.map((x) => x.kode));
    const saran = new Set(rencana.saran.map((x) => x.kode));
    const r = (hasil[kj] = hasil[kj] || { perkara: 0, ms: 0, blangko: blangko.length, kode: {} });
    r.perkara++;
    r.ms += ms;
    for (const [k, v] of kodeMap) {
      let kelas;
      if (tulis.has(k)) kelas = "otomatis";
      else if (saran.has(k)) kelas = "ragu";
      else if (KODE_ECOURT.has(k)) kelas = "ecourt";
      else if (metadata.opsional[k]) kelas = "opsional";
      else if (metadata.manual[k] || (rencana.info[k] && rencana.info[k].golongan === "manual")) kelas = "manual";
      else kelas = "kosong";
      const c = (r.kode[k] = r.kode[k] || { nama: (infoIsian.get(k) || {}).nama || "", pakai: v.pakai, status: (infoIsian.get(k) || {}).status || "", otomatis: 0, ragu: 0, opsional: 0, manual: 0, ecourt: 0, kosong: 0 });
      c[kelas]++;
    }
  }
  for (const r of Object.values(hasil)) r.msPerPerkara = r.perkara ? Math.round(r.ms / r.perkara) : 0;
  const out = { diukur: new Date().toISOString().slice(0, 10), akar, sejak, maks, jenis: hasil };
  if (keluar) fs.writeFileSync(keluar, JSON.stringify(out, null, 1));
  for (const [kj, r] of Object.entries(hasil)) {
    let ot = 0, rg = 0, tot = 0;
    for (const c of Object.values(r.kode)) {
      ot += c.otomatis; rg += c.ragu; tot += c.otomatis + c.ragu + c.opsional + c.manual + c.ecourt + c.kosong;
    }
    console.log(kj.padEnd(8), `perkara ${r.perkara}`.padEnd(12), `ms/perkara ${r.msPerPerkara}`.padEnd(18), `ruas ${Object.keys(r.kode).length}`.padEnd(10), `otomatis ${((ot / (tot || 1)) * 100).toFixed(1)}%`, `ragu ${((rg / (tot || 1)) * 100).toFixed(1)}%`);
  }
  kon.end();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
