// Ukur isian otomatis jenis-jenis agen S6 (harta bersama, kewarisan, wasiat, hibah, wakaf, poligami, pembatalan/pencegahan,
// ekonomi syariah, hak asuh/penguasaan/nafkah anak, pengangkatan anak, permohonan umum) atas data nyata SALINAN LOKAL.
// Hanya SELECT pada sipp_donggala (XAMPP D:). Tidak menyentuh SIPP/ABT sungguhan.
//
//   node scripts/isi-sipp-abt/ukur-s6.cjs <keluaran.json> [--tanpa-s6]
//
// --tanpa-s6 : pengisi S6 dimatikan (modul diganti tiruan kosong) = keadaan SEBELUM pekerjaan S6, dari data yang sama.
//
// Per perkara nyata dijalankan jalur yang sama dengan panel Blangko Derry: dariSipp (sumber "sipp") dan rantai posita-lain
// (dariPositaLain -> tambahUsulanJenis -> sambunganPwh -> lengkapiPositaLain -> blangkoDerry.lengkapiJenis). Jenis yang tidak
// punya perkara nyata diukur atas perkara contoh (fixture-s6.cjs) lewat rantai posita-lain + pengisi S6, dan DITANDAI "fixture".
// Hasil: untuk tiap jenis dan kode, berapa perkara yang mendapat nilai pasti/cukup ("otomatis"), ragu, atau "tidak ada sumber"
// ("manual"). Keyakinan "kosong" (tidak berlaku / belum ada data) tidak dihitung.
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

process.env.ALETA_BOT_DB_HOST = process.env.ALETA_BOT_DB_HOST || "127.0.0.1";
process.env.ALETA_BOT_DB_SIPP_NAME = process.env.ALETA_BOT_DB_SIPP_NAME || "sipp_donggala";
process.env.ALETA_BOT_DB_USER = process.env.ALETA_BOT_DB_USER || "root";
process.env.ALETA_BOT_DB_PASSWORD = process.env.ALETA_BOT_DB_PASSWORD || "";

const akar = path.resolve(__dirname, "..", "..");
const reqBot = createRequire(path.join(akar, "aleta_bot", "package.json"));
const mysql = reqBot("mysql");
const tanpaS6 = process.argv.includes("--tanpa-s6");
if (tanpaS6) {
  // Keadaan sebelum S6: modul pengisi diganti tiruan kosong sebelum ada yang memuatnya.
  const jalur = path.join(akar, "aleta_bot", "services", "isiOtomatisJenisS6.js");
  require.cache[jalur] = { id: jalur, filename: jalur, loaded: true, exports: { usulanJenisS6: async () => [], usulanDariKonteks: () => [], JENIS_S6: [] } };
  const jalurReq = reqBot.resolve(jalur);
  reqBot.cache[jalurReq] = require.cache[jalur];
}
const layanan = (n) => reqBot(path.join(akar, "aleta_bot", "services", n));

/** Jenis perkara SIPP milik agen S6 (selain cerai/itsbat/ikrar = S3, dispensasi/wali adhal/asal usul/perwalian/P3HP = S5). */
const JENIS_S6 = Object.freeze([341, 342, 343, 344, 345, 348, 349, 350, 351, 352, 353, 359, 361, 364, 365, 366, 367, 369, 370]);

const kolam = mysql.createPool({ host: "127.0.0.1", user: "root", database: process.env.ALETA_BOT_DB_SIPP_NAME, connectionLimit: 4, typeCast: (f) => f.string() });
const q = (sql, p) => new Promise((ok, gagal) => kolam.query(sql, p || [], (e, r) => (e ? gagal(e) : ok(r))));

const PANGKAT = { otomatis: 3, ragu: 2, manual: 1 };

function pencatat() {
  const hasil = new Map();
  const taruh = (u, asal) => {
    if (!u || !u.kode) return;
    const kode = String(u.kode);
    const nilai = String(u.nilai || "").trim();
    let tingkat;
    if (u.keyakinan === "pasti" || u.keyakinan === "cukup") tingkat = "otomatis";
    else if (u.keyakinan === "ragu" || u.keyakinan === "bentrok") tingkat = "ragu";
    else if (u.keyakinan === "tidak_ada_sumber") tingkat = "manual";
    else return; // "kosong": tidak berlaku / belum ada data
    if (!nilai && tingkat !== "manual") return;
    const lama = hasil.get(kode);
    if (!lama || PANGKAT[tingkat] > PANGKAT[lama.tingkat]) hasil.set(kode, { tingkat, nilai: nilai.slice(0, 120), asal });
  };
  return { hasil, taruh };
}

/** Rantai posita-lain seperti rute /abt/usulan (posita dikirim ekstensi dari ABT; di sini dari SIPP). */
async function rantaiPositaLain(p) {
  const lain = layanan("abtUsulanLainService.js");
  const jenisSvc = layanan("deteksiJenisPerkaraService.js");
  const pwh = layanan("deteksi/sambunganPwh.js");
  const sambung = layanan("deteksi/sambungPositaLain.js");
  const derry = layanan("deteksi/blangkoDerry.js");
  const j = String(p.jenis_perkara_id);
  const alur = String(p.alur_perkara_id || "");
  const kontensius = alur === "15";
  const sebutan = { pelaku: kontensius ? "Tergugat" : "Termohon", lawan: kontensius ? "Penggugat" : "Pemohon", pemohon: kontensius ? "Penggugat" : "Pemohon", pemohon2: "" };
  const posita = String(p.posita || "");
  const petitum = String(p.petitum || "");
  const sippPosita = { posita, petitum, jenisPerkara: j, alur, namaPihak: (p.pihak1 || []).map((x) => x.nama) };
  let pl = lain.dariPositaLain(posita, { jenisPerkara: j, alur, sebutan });
  pl = jenisSvc.tambahUsulanJenis(pl, posita, { jenisPerkara: j, alur });
  if (pwh.idJenis(j)) {
    const ps = p.nomor_perkara && !p.fixture ? await pwh.bacaSipp(p.nomor_perkara, q).catch(() => null) : { perkaraId: 0, jenisPerkaraId: Number(j), petitum, alasanNikah: [], pihak1: (p.pihak1 || []).map((x) => ({ nama: x.nama })) };
    pl = pwh.tambahUsulanPwh(pl, posita, { jenisPerkara: j, alur, sipp: ps });
  }
  pl = await sambung.lengkapiPositaLain(pl, { posita, nomorPerkara: p.nomor_perkara || "fixture", jenisPerkara: j, alur, bacaSipp: async () => sippPosita });
  pl = await derry.lengkapiJenis(pl, { jalur: "posita-lain", posita, jenisPerkara: j, nomorPerkara: p.nomor_perkara || "fixture", bacaSipp: async () => sippPosita, bacaKumulasi: async () => null });
  return (pl && pl.usulan) || [];
}

/** Satu perkara nyata lewat dariSipp (data lokal) + rantai posita-lain. */
async function jalankanPerkara(p) {
  const { hasil, taruh } = pencatat();
  const svc = layanan("abtUsulanService.js");
  const sipp = await svc.dariSipp(p.nomor_perkara).catch(() => ({ ok: false, usulan: [] }));
  for (const u of sipp.usulan || []) taruh(u, "sipp");
  try {
    for (const u of await rantaiPositaLain(p)) taruh(u, "posita-lain");
  } catch (g) {
    hasil.set("_galat_posita_lain", { tingkat: "manual", nilai: String(g.message || g).slice(0, 120), asal: "galat" });
  }
  return hasil;
}

/** Perkara contoh (fixture): pengisi S6 langsung dari konteks + rantai posita-lain. */
async function jalankanFixture(fx) {
  const { hasil, taruh } = pencatat();
  if (!tanpaS6) {
    const s6 = layanan("isiOtomatisJenisS6.js");
    for (const u of s6.usulanDariKonteks(fx)) taruh(u, "s6");
  }
  const p = { nomor_perkara: "", jenis_perkara_id: fx.jenisPerkaraId, alur_perkara_id: fx.jenisPerkaraId === 369 && /Penetapan Mafqud|Pencegahan|Pembatalan/.test(fx.posita) ? 16 : 15, posita: fx.posita, petitum: fx.petitum, pihak1: (fx.pihak1 || []).map((nama) => ({ nama })), fixture: true };
  try {
    for (const u of await rantaiPositaLain(p)) taruh(u, "posita-lain");
  } catch (g) {
    hasil.set("_galat_posita_lain", { tingkat: "manual", nilai: String(g.message || g).slice(0, 120), asal: "galat" });
  }
  return hasil;
}

async function perkaraNyata() {
  const per = await q(
    `SELECT perkara_id, nomor_perkara, jenis_perkara_id, jenis_perkara_nama, alur_perkara_id, tanggal_pendaftaran, posita, petitum
       FROM perkara WHERE jenis_perkara_id IN (${JENIS_S6.join(",")}) ORDER BY perkara_id`
  );
  for (const p of per) {
    p.pihak1 = await q("SELECT nama FROM perkara_pihak1 WHERE perkara_id = ? ORDER BY urutan", [p.perkara_id]).catch(() => []);
    p.pihak2 = await q("SELECT nama FROM perkara_pihak2 WHERE perkara_id = ? ORDER BY urutan", [p.perkara_id]).catch(() => []);
  }
  return per;
}

function tambahkan(perJenis, j, nama, jenisBukti, peta) {
  const e = (perJenis[j] = perJenis[j] || { nama, nyata: 0, fixture: 0, kode: {} });
  e[jenisBukti] += 1;
  for (const [kode, v] of peta) {
    const c = (e.kode[kode] = e.kode[kode] || { nyata: { otomatis: 0, ragu: 0, manual: 0 }, fixture: { otomatis: 0, ragu: 0, manual: 0 } });
    c[jenisBukti][v.tingkat] += 1;
  }
}

async function utama() {
  const keluar = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const per = await perkaraNyata();
  const perJenis = {};
  for (const p of per) tambahkan(perJenis, String(p.jenis_perkara_id), p.jenis_perkara_nama, "nyata", await jalankanPerkara(p));
  const fixtures = require("./fixture-s6.cjs");
  for (const fx of fixtures) {
    const namaJenis = (perJenis[String(fx.jenisPerkaraId)] || {}).nama || { 366: "Hibah", 367: "Wakaf", 342: "Pencegahan Perkawinan", 344: "Pembatalan Perkawinan", 365: "Wasiat", 369: "Lain-Lain", 370: "Ekonomi Syariah" }[fx.jenisPerkaraId] || String(fx.jenisPerkaraId);
    tambahkan(perJenis, String(fx.jenisPerkaraId), namaJenis, "fixture", await jalankanFixture(fx));
  }
  const dokumen = {
    dibuat: new Date().toISOString().slice(0, 10),
    mode: tanpaS6 ? "sebelum (pengisi S6 dimatikan)" : "sesudah (pengisi S6 menyala)",
    sumber: "sipp_donggala lokal (semua tahun): jalur dariSipp + posita-lain; jenis tanpa perkara nyata = fixture-s6.cjs",
    jenis: perJenis,
  };
  if (keluar) fs.writeFileSync(keluar, JSON.stringify(dokumen, null, 1));
  for (const [j, e] of Object.entries(perJenis)) {
    const k = Object.entries(e.kode).filter(([kode]) => !kode.startsWith("_"));
    const ada = (c, t) => c.nyata[t] + c.fixture[t] > 0;
    console.log(
      `${j} ${e.nama}: ${e.nyata} nyata + ${e.fixture} fixture; kode otomatis ${k.filter(([, c]) => ada(c, "otomatis")).length}, hanya ragu ${k.filter(([, c]) => !ada(c, "otomatis") && ada(c, "ragu")).length}, manual ${k.filter(([, c]) => !ada(c, "otomatis") && !ada(c, "ragu")).length}`
    );
  }
  process.exit(0);
}

if (require.main === module) {
  utama().catch((g) => {
    console.error(g);
    process.exit(1);
  });
}

module.exports = { JENIS_S6, jalankanPerkara, jalankanFixture, perkaraNyata, q };
