// Ukur (baca saja) pengisi W2a (harta bersama 348, kewarisan 364) dan pemicu petitum paket w2a-kebendaan atas perkara nyata.
//   node scripts/isi-sipp-abt/ukur-w2a.cjs (dari akar repo) [--tulis]
// Sumber: salinan lokal SIPP PA Donggala (sipp_donggala) dan PA Bungku (sipp). Pembanding: amar putusan SIPP (perkara_putusan.amar_putusan).
// Hasil: ringkasan di layar; --tulis menulis docs/gelombang2/UKURAN-W2a.json. Tidak menulis ke SIPP/ABT.
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const akar = path.resolve(__dirname, "..", "..");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const W2A = require(path.join(akar, "aleta_bot", "services", "isiOtomatisW2a.js"));
const S5 = require(path.join(akar, "aleta_bot", "services", "isiOtomatisJenisS5.js"));

const polos = (t) => String(t || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

// pemicu petitum: SAMA dengan ungkapan REGEXP pada kueri variabel (abt-paket/w2a-kebendaan/alat/variabel_hb.py, variabel_lain.py)
const PEMICU = {
  sita: /sita|beslag/,
  uangPaksa: /uang paksa|dwangsom/,
  sertaMerta: /serta merta|serta-merta|uitvoerbaar|bij voorraad/,
  turutTergugat: /turut tergugat/,
  bagianBukanSeperdua: /(^|[^0-9])(1\/3|2\/3|1\/4|3\/4|1\/5|2\/5|3\/5|4\/5|1\/6|5\/6|1\/8|3\/8|5\/8|7\/8)([^0-9]|$)|[0-9]+ ?%/,
  utang: /hutang|utang/,
  denda: /denda|ganti rugi|ta.?widh|ta.?zir|kerugian|margin/,
  jaminan: /jaminan|agunan|hak tanggungan|fidusia|gadai|lelang|rahn/,
  batalAkad: /batal|fasakh/,
};
// padanannya di amar putusan (kejadian nyata)
const AMAR = {
  sita: /sita|beslag/,
  uangPaksa: /uang paksa|dwangsom/,
  sertaMerta: /serta merta|serta-merta|uitvoerbaar|bij voorraad|dijalankan lebih dahulu/,
  turutTergugat: /turut tergugat/,
  bagianBukanSeperdua: /(^|[^0-9])(1\/3|2\/3|1\/4|3\/4|1\/5|2\/5|3\/5|4\/5|1\/6|5\/6|1\/8|3\/8|5\/8|7\/8)([^0-9]|$)|[0-9]+ ?%/,
  utang: /hutang|utang/,
};

async function ukurDb(nama, jenisDaftar) {
  const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: nama, typeCast: (f) => f.string() });
  const q = (s, p) => new Promise((a, b) => kon.query(s, p || [], (e, r) => (e ? b(e) : a(r))));
  const perkara = await q(
    `SELECT p.perkara_id id, p.nomor_perkara nomor, p.jenis_perkara_id jenis, p.petitum, p.posita, pp.amar_putusan amar
       FROM perkara p LEFT JOIN perkara_putusan pp ON pp.perkara_id = p.perkara_id WHERE p.jenis_perkara_id IN (${jenisDaftar.join(",")}) ORDER BY p.perkara_id`
  );
  const hasil = { db: nama, perkara: perkara.length, beramar: 0, perJenis: {}, pemicu: {}, kewarisan: { n: 0, susunan: 0, bagian: 0, penguasa: 0, penguasaDibanding: 0, penguasaCocok: 0, hartaBersama: 0, utangWasiat: 0, contoh: [] }, hartaBersama: { n: 0, utang: 0, utangDanAmar: 0 } };
  const GRUP = { 348: "harta-bersama", 364: "kewarisan", 365: "wasiat", 366: "hibah", 367: "wakaf", 370: "ekonomi-syariah" };
  for (const p of perkara) hasil.perJenis[GRUP[Number(p.jenis)]] = (hasil.perJenis[GRUP[Number(p.jenis)]] || 0) + 1;
  const KHUSUS_ES = new Set(["denda", "jaminan", "batalAkad"]);
  for (const k of Object.keys(PEMICU)) hasil.pemicu[k] = { petitum: 0, petitumDanAmar: 0, amarSaja: 0, jenis: KHUSUS_ES.has(k) ? "ekonomi-syariah" : k === "bagianBukanSeperdua" ? "harta-bersama" : "semua" };
  for (const p of perkara) {
    const pet = polos(p.petitum);
    const amar = polos(p.amar);
    if (amar) hasil.beramar += 1;
    for (const k of Object.keys(PEMICU)) {
      if (KHUSUS_ES.has(k) && Number(p.jenis) !== 370) continue;
      if (k === "bagianBukanSeperdua" && Number(p.jenis) !== 348) continue;
      const dipicu = PEMICU[k].test(pet);
      const diamar = AMAR[k] ? AMAR[k].test(amar) : false;
      if (dipicu) hasil.pemicu[k].petitum += 1;
      if (dipicu && diamar) hasil.pemicu[k].petitumDanAmar += 1;
      if (!dipicu && diamar && amar) hasil.pemicu[k].amarSaja += 1;
    }
    const data = await S5.bacaData(p.id, (sql, params) => q(sql, params));
    if (!data) continue;
    const u = W2A.usulanDariData(data);
    const kode = new Set(u.map((x) => x.kode));
    if (Number(p.jenis) === 364) {
      hasil.kewarisan.n += 1;
      if (["9701", "9702", "9703", "9704", "9718"].some((k) => kode.has(k))) hasil.kewarisan.susunan += 1;
      if (kode.has("8719")) hasil.kewarisan.bagian += 1;
      if (kode.has("4817")) {
        hasil.kewarisan.penguasa += 1;
        const nilai = String((u.find((x) => x.kode === "4817") || {}).nilai || "").toLowerCase().replace(/\bpara\s+/g, "").replace(/\s+/g, " ").trim();
        const m = /menghukum\s+((?:para\s+)?tergugat(?:\s+(?:i{1,3}|iv|v|vi{0,3}|[0-9]+))?(?:\s*(?:,|dan)\s*(?:tergugat\s+)?(?:i{1,3}|iv|v|vi{0,3}|[0-9]+))*)[^.;]{0,200}?menyerahkan/.exec(amar);
        if (m) {
          hasil.kewarisan.penguasaDibanding += 1;
          const dari = m[1].replace(/\bpara\s+/g, "").replace(/\s+/g, " ").trim();
          if (dari === nilai || dari.includes(nilai) || nilai.includes(dari)) hasil.kewarisan.penguasaCocok += 1;
        }
      }
      if (kode.has("4818")) hasil.kewarisan.hartaBersama += 1;
      if (kode.has("4819")) hasil.kewarisan.utangWasiat += 1;
      if (hasil.kewarisan.contoh.length < 40) hasil.kewarisan.contoh.push({ nomor: p.nomor, kode: [...kode].sort(), nilai8719: (u.find((x) => x.kode === "8719") || {}).nilai || "" });
    }
    if (Number(p.jenis) === 348) {
      hasil.hartaBersama.n += 1;
      if (kode.has("4786")) {
        hasil.hartaBersama.utang += 1;
        if (AMAR.utang.test(amar)) hasil.hartaBersama.utangDanAmar += 1;
      }
    }
    // semua usulan W2a harus ragu
    for (const x of u) if (x.keyakinan !== "ragu") throw new Error(`usulan W2a bukan ragu: ${x.kode} ${x.keyakinan}`);
  }
  kon.end();
  return hasil;
}

(async () => {
  const semua = [];
  for (const db of ["sipp_donggala", "sipp"]) semua.push(await ukurDb(db, [348, 364, 365, 366, 367, 370]));
  console.log(JSON.stringify(semua, null, 1));
  if (process.argv.includes("--tulis")) {
    const tujuan = path.join(akar, "docs", "gelombang2", "UKURAN-W2a.json");
    fs.mkdirSync(path.dirname(tujuan), { recursive: true });
    fs.writeFileSync(tujuan, JSON.stringify({ dibuat: new Date().toISOString().slice(0, 10), catatan: "Pembanding = amar putusan SIPP; data lokal tanpa isian petugas untuk 8717/8719/9701-9704/8730 sehingga semua usulan W2a berkeyakinan ragu.", hasil: semua }, null, 1) + "\n");
    console.log("ditulis", tujuan);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
