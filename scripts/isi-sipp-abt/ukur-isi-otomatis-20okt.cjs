// Ukur (baca saja) berapa isian popup blangko Derry yang TERISI OTOMATIS / RAGU / MANUAL / KOSONG untuk cerai gugat, cerai talak
// (termasuk ikrar & kumulasi) dan itsbat nikah, per KATEGORI blangko (putusan/penetapan, BAS tiap sidang, relaas, PTSP, sita, ikrar),
// atas perkara terdaftar 2026 di salinan lokal sipp_donggala (hanya SELECT).
//
//   node scripts/isi-sipp-abt/ukur-isi-otomatis-20okt.cjs [--akar <repo>] [--keluar <berkas.json>] [--maks <perkara per jenis>] [--jenis 346,347,360]
//
// --akar : repo yang diukur (bawaan repo ini). Untuk "sebelum" arahkan ke salinan tag rilis (git archive + junction node_modules aleta_bot).
//
// Cara kerja (meniru panel Blangko Derry, bukan menyalin aturannya):
//   - memanggil RUTE BOT SUNGGUHAN /abt/usulan dengan sumber yang sama seperti ekstensi (ekstensi-sipp/blangko-derry-isian.js susunTambahan):
//     "sipp" selalu; "saksi" (posita saja) bila blangko memuat variabel alasan cerai; "itsbat" untuk itsbat nikah; "posita-lain" bila bukan keduanya;
//   - memutuskan nasib tiap usulan dengan MESIN BERSAMA ekstensi (isi-sipp-bersama.js: pilihPerKode + rencanakan): tulis = otomatis,
//     saran = ragu, lainnya = kosong;
//   - sumber e-Court (gugatan, kuasa, KTP, bukti, jawab-menjawab) tidak bisa dibaca lokal: isian yang bergantung padanya dihitung "ecourt".
//
// Kelas tiap (perkara x kategori x isian tanpa syarat keadaan):
//   otomatis : mesin akan MENULIS (pasti/cukup)    ragu : hanya saran bertanda "yakin: ragu - periksa"
//   ecourt   : bergantung berkas e-Court (tak terukur lokal)
//   manual   : keputusan majelis/tidak ada sumber, ditandai "diisi manual" + alasan (isian-metadata.ts)
//   opsional : isian tambahan (bila ada)
//   kosong   : tidak ada pengisi dan belum ditandai (celah yang harus ditutup)
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
const jenisFokus = arg("--jenis", "346,347,360").split(",").map(Number);

process.env.ALETA_BOT_DB_SIPP_NAME = process.env.ALETA_BOT_DB_SIPP_NAME || "sipp_donggala";
process.env.ALETA_BOT_DB_USER = process.env.ALETA_BOT_DB_USER || "root";
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const { petaFolder } = require(path.join(akarSkrip, "scripts", "isi-sipp-abt", "folder-jenis.cjs"));
const { KELOMPOK } = require(path.join(akar, "scripts", "isi-sipp-abt", "pengisi-kurasi.cjs"));
require(path.join(akar, "ekstensi-sipp", "isi-sipp-bersama.js"));
const mesin = globalThis.AletaIsiSipp;

const daftarCek = JSON.parse(fs.readFileSync(path.join(akar, "docs", "isi-sipp-abt", "DAFTAR-CEK.json"), "utf8"));
const infoIsian = new Map(daftarCek.isian.map((x) => [x.kunci, x]));

/** Penanda manual/opsional dari isian-metadata.ts (bila sudah ada di repo yang diukur). */
let metadata = { manual: {}, opsional: {} };
try {
  const teks = fs.readFileSync(path.join(akar, "manajemen_surat", "src", "app", "api", "aleta-ecourt", "blangko-derry", "isian-metadata.ts"), "utf8");
  const ambil = (nama) => {
    const m = teks.match(new RegExp(`export const ${nama}[^=]*=\\s*(\\{[\\s\\S]*?\\n\\});`));
    if (!m) return {};
    // eslint-disable-next-line no-new-func
    return new Function(`return (${m[1]});`)();
  };
  metadata = { manual: ambil("ISIAN_MANUAL"), opsional: ambil("ISIAN_OPSIONAL") };
} catch {
  /* belum ada: ukuran "sebelum" */
}

// Kode yang dipenuhi e-Court (berkas OCR/gugatan/jawab-menjawab/bukti/KTP/kuasa) menurut kurasi - tak terukur lokal.
const KODE_ECOURT = new Set();
for (const g of KELOMPOK) if (/ecourt|Ecourt/.test(g.berkas) || /e-Court/.test(g.sumber || "") || g.berkas === "ekstensi-sipp/abt.js" || g.berkas === "ekstensi-sipp/blangko-derry-isian.js") for (const k of g.kode) KODE_ECOURT.add(k);

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

// ── rute bot sungguhan ────────────────────────────────────────────────────────
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
    const res = {
      statusCode: 200,
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(o) {
        ok(o);
      },
      send(o) {
        ok(o);
      },
    };
    Promise.resolve(muatRute()({ body, headers: {}, query: {}, get: () => "" }, res, () => {})).catch(gagal);
  });
}

// ── kategori & relevansi blangko ──────────────────────────────────────────────
function kategoriBlangko(b) {
  const berkas = String(b.jalur || "").split("/").pop();
  if (/^98 Relaas/.test(b.folder)) return "relaas";
  if (/^99 PTSP/.test(b.folder)) return "ptsp";
  if (/^97 Sita/.test(b.folder)) return "sita";
  if (/ikrar/i.test(berkas)) return "ikrar";
  if (/BAS/.test(b.folder) || /^\[\d+\w*\]\s*BAS/i.test(berkas)) return "bas";
  return "putusan";
}
/** Blangko lintas jenis (relaas/PTSP/sita) hanya dihitung bila relevan bagi perkara itu. */
function relevan(b, jenis, alur, perkara) {
  const berkas = String(b.jalur || "").split("/").pop();
  if (/Pencegahan Perkawinan/i.test(berkas)) return false;
  if (/Pengumuman Permohonan Itsbat/i.test(berkas)) {
    if (!(jenis === 360 && String(alur) === "16")) return false;
    // 9.1 = dua Pemohon, 9.2 = satu Pemohon (pasangan telah meninggal)
    const dua = Number(perkara.jmlPihak1) >= 2;
    return /2 Pemohon/i.test(berkas) ? dua : !dua;
  }
  if (/Ikrar Talak/i.test(berkas)) return jenis === 346;
  // Blangko ikrar hanya untuk cerai talak (nama berkas/folder memuat "ikrar" juga pada folder cerai gugat: tidak berlaku).
  if (kategoriBlangko(b) === "ikrar") return jenis === 346;
  if (/^97 Sita/.test(b.folder) || /Sita/i.test(berkas)) return /(^|[^a-z])sita([^a-z]|$)/i.test(`${perkara.petitum || ""} ${perkara.posita || ""}`);
  if (/Mediator|Mediasi/i.test(berkas) && /Relaas/.test(b.folder)) return true;
  return true;
}
function blangkoUntuk(j, a, perkara) {
  const kunci = `${j}/${a}`;
  return daftarCek.blangko.filter((b) => {
    const pf = petaFolder(b.folder);
    if (pf.universal) return relevan(b, j, a, perkara);
    if (kategoriBlangko(b) === "ikrar" && j !== 346) return false;
    return pf.freq.includes(kunci);
  });
}

(async () => {
  const baris = await q(
    `SELECT perkara_id, nomor_perkara, jenis_perkara_id j, alur_perkara_id a, jenis_perkara_text jt, posita, petitum
       FROM perkara WHERE tanggal_pendaftaran >= '2026-01-01' AND jenis_perkara_id IN (${jenisFokus.join(",")}) AND posita IS NOT NULL AND LENGTH(posita) > 200
       ORDER BY perkara_id DESC`
  );
  const perJenis = {};
  const hitung = {};
  for (const b of baris) {
    const j = Number(b.j);
    const kunciJ = `${b.j}/${b.a}`;
    hitung[kunciJ] = (hitung[kunciJ] || 0) + 1;
    if (hitung[kunciJ] > maks) continue;
    b.jmlPihak1 = Number(((await q("SELECT COUNT(*) AS n FROM perkara_pihak1 WHERE perkara_id = ?", [b.perkara_id])) || [{}])[0].n) || 0;
    const blangko = blangkoUntuk(j, b.a, b);
    if (!blangko.length) continue;
    const perKat = {};
    const jmlBlangko = {};
    const adaDi = {};
    for (const bl of blangko) {
      const kat = kategoriBlangko(bl);
      jmlBlangko[kat] = (jmlBlangko[kat] || 0) + 1;
      for (const k of bl.isian) {
        const x = infoIsian.get(k);
        if (!x || String(k).startsWith("tj:")) continue;
        if (x.keadaan) continue; // kuasa/prodeo/ghaib/insidentil/alasan C-H: bersyarat keadaan
        (perKat[kat] = perKat[kat] || new Map()).set(k, x.jenis === "tanggal" ? "tanggal" : "teks");
        const kunciF = `${kat}|${k}`;
        adaDi[kunciF] = (adaDi[kunciF] || 0) + 1;
      }
    }
    const pihak = j === 346 ? { pelaku: "Termohon", lawan: "Pemohon" } : j === 347 ? { pelaku: "Tergugat", lawan: "Penggugat" } : { pelaku: "Termohon", lawan: "Pemohon" };
    const itsbat = j === 360;
    const rJ = (perJenis[kunciJ] = perJenis[kunciJ] || { perkara: 0, kategori: {} });
    rJ.perkara++;
    let sippJawaban = null;
    for (const [kat, kodeMap] of Object.entries(perKat)) {
      const kodeAda = new Set(kodeMap.keys());
      const perluAlasan = mesin.VAR_ALASAN_CERAI.some((k) => kodeAda.has(k));
      const sumber = [];
      // sipp (satu kali per perkara)
      if (!sippJawaban) sippJawaban = await panggilRute({ nomorPerkara: b.nomor_perkara, sumber: "sipp" }).catch(() => null);
      const daftarUsulan = [];
      if (sippJawaban && sippJawaban.sipp && Array.isArray(sippJawaban.sipp.usulan)) daftarUsulan.push(sippJawaban.sipp.usulan);
      const dasar = { nomorPerkara: b.nomor_perkara, pelaku: pihak.pelaku, lawan: pihak.lawan, posita: b.posita, jenisPerkara: b.jt, alur: String(b.a) };
      if (perluAlasan) sumber.push(["saksi", { saksi1: "", saksi2: "", tanggalSidang: "", pelaku: pihak.pelaku, lawan: pihak.lawan, posita: b.posita }, "saksi"]);
      if (itsbat) sumber.push(["itsbat", { posita: b.posita, pemohon: "Pemohon I", pelaku: "Pemohon II", jenisPerkara: b.jt, alur: String(b.a) }, "itsbat"]);
      else if (!perluAlasan) sumber.push(["posita-lain", { ...dasar, pemohon: pihak.lawan }, "positaLain"]);
      // jenis cerai tanpa kode alasan: sumber "posita-lain" seperti ekstensi; kategori yang memuat alasan memakai "saksi"
      for (const [nm, muatan, kunci] of sumber) {
        const jw = await panggilRute({ nomorPerkara: b.nomor_perkara, ...muatan, sumber: nm }).catch(() => null);
        const bag = jw && jw[kunci];
        if (bag && Array.isArray(bag.usulan)) daftarUsulan.push(bag.usulan);
      }
      const usulan = mesin.pilihPerKode(daftarUsulan, kodeAda);
      const katalog = [...kodeMap.entries()].map(([kode, jenis]) => ({ kode, nama: (infoIsian.get(kode) || {}).nama || "", jenis, opsi: [], kosong: true, bolehGanti: false, manual: Boolean(metadata.manual[kode]), alasanManual: metadata.manual[kode] || "" }));
      const rencana = mesin.rencanakan(usulan, katalog, keIso, daftarUsulan);
      const tulis = new Set(rencana.tulis.map((x) => x.kode));
      const saran = new Set(rencana.saran.map((x) => x.kode));
      const r = (rJ.kategori[kat] = rJ.kategori[kat] || { kode: {} });
      for (const k of kodeAda) {
        let kelas;
        if (tulis.has(k)) kelas = "otomatis";
        else if (saran.has(k)) kelas = "ragu";
        else if (KODE_ECOURT.has(k)) kelas = "ecourt";
        else if (metadata.opsional[k]) kelas = "opsional";
        else if (rencana.info[k] && rencana.info[k].golongan === "manual") kelas = "manual";
        else kelas = "kosong";
        const c = (r.kode[k] = r.kode[k] || { otomatis: 0, ragu: 0, ecourt: 0, manual: 0, opsional: 0, kosong: 0 });
        c[kelas]++;
        // Isian "umum" = ada di sedikitnya 40% blangko kategori itu (selebihnya khas satu skenario: tolak, cabut, nafkah, pasangan meninggal ...).
        c.umum = (adaDi[`${kat}|${k}`] || 0) / (jmlBlangko[kat] || 1) >= 0.4;
      }
    }
  }
  const ringkas = {};
  const total = { otomatis: 0, ragu: 0, ecourt: 0, manual: 0, opsional: 0, kosong: 0 };
  for (const [kj, rJ] of Object.entries(perJenis)) {
    ringkas[kj] = { perkara: rJ.perkara, kategori: {} };
    for (const [kat, r] of Object.entries(rJ.kategori)) {
      const tot = { otomatis: 0, ragu: 0, ecourt: 0, manual: 0, opsional: 0, kosong: 0 };
      for (const c of Object.values(r.kode)) for (const k of Object.keys(tot)) tot[k] += c[k];
      for (const k of Object.keys(tot)) total[k] += tot[k];
      const jumlah = Object.values(tot).reduce((x, y) => x + y, 0) || 1;
      ringkas[kj].kategori[kat] = { isian: Object.keys(r.kode).length, ...Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, Math.round((v / jumlah) * 1000) / 10])) };
    }
  }
  const jml = Object.values(total).reduce((x, y) => x + y, 0) || 1;
  const keseluruhan = Object.fromEntries(Object.entries(total).map(([k, v]) => [k, Math.round((v / jml) * 1000) / 10]));
  // Hanya isian umum (ada di >= 40% blangko kategorinya): gambaran perkara biasa tanpa skenario khusus.
  const totU = { otomatis: 0, ragu: 0, ecourt: 0, manual: 0, opsional: 0, kosong: 0 };
  for (const rJ of Object.values(perJenis)) for (const r of Object.values(rJ.kategori)) for (const c of Object.values(r.kode)) if (c.umum) for (const k of Object.keys(totU)) totU[k] += c[k];
  const jmlU = Object.values(totU).reduce((x, y) => x + y, 0) || 1;
  const keseluruhanUmum = Object.fromEntries(Object.entries(totU).map(([k, v]) => [k, Math.round((v / jmlU) * 1000) / 10]));
  const out = { diukur: new Date().toISOString().slice(0, 10), akar, keseluruhan, keseluruhanUmum, ringkasPersen: ringkas, jenis: perJenis };
  if (keluar) fs.writeFileSync(keluar, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ keseluruhan, keseluruhanUmum, ringkas }));
  kon.end();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
