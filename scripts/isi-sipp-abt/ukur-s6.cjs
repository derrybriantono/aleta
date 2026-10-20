// Ukur isian otomatis jenis-jenis agen S6 (harta bersama, kewarisan, wasiat, hibah, wakaf, poligami, pembatalan/pencegahan,
// ekonomi syariah, hak asuh/penguasaan/nafkah anak, pengangkatan anak, permohonan umum) atas data nyata SALINAN LOKAL.
// Hanya SELECT pada sipp_donggala (XAMPP D:). Tidak menyentuh SIPP/ABT sungguhan.
//
//   node scripts/isi-sipp-abt/ukur-s6.cjs <keluaran.json>
//
// Per perkara nyata dijalankan jalur yang sama dengan panel Blangko Derry: dariSipp (sumber "sipp") dan rantai posita-lain
// (dariPositaLain -> tambahUsulanJenis -> sambunganPwh -> lengkapiPositaLain -> blangkoDerry.lengkapiJenis). Hasil: untuk tiap
// jenis dan kode, berapa perkara yang mendapat nilai pasti/cukup, ragu, atau "tidak ada sumber" (diisi manual).
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
const layanan = (n) => reqBot(path.join(akar, "aleta_bot", "services", n));

/** Jenis perkara SIPP milik agen S6 (selain cerai/itsbat/ikrar = S3, dispensasi/wali adhal/asal usul/perwalian/P3HP = S5). */
const JENIS_S6 = Object.freeze([341, 342, 343, 344, 345, 348, 349, 350, 351, 352, 353, 359, 361, 364, 365, 366, 367, 369, 370]);

const kolam = mysql.createPool({ host: "127.0.0.1", user: "root", database: process.env.ALETA_BOT_DB_SIPP_NAME, connectionLimit: 4, typeCast: (f) => f.string() });
const q = (sql, p) => new Promise((ok, gagal) => kolam.query(sql, p || [], (e, r) => (e ? gagal(e) : ok(r))));

/** Satu perkara nyata (atau fixture) -> peta kode -> { tingkat: "otomatis"|"ragu"|"manual", nilai } lewat jalur panel. */
async function jalankanPerkara(p) {
  const hasil = new Map();
  const taruh = (u, asal) => {
    if (!u || !u.kode) return;
    const kode = String(u.kode);
    const nilai = String(u.nilai || "").trim();
    const kunciYakin = u.keyakinan === "pasti" || u.keyakinan === "cukup" ? "otomatis" : u.keyakinan === "ragu" ? "ragu" : "manual";
    if (!nilai && kunciYakin !== "manual") return;
    const lama = hasil.get(kode);
    const pangkat = { otomatis: 3, ragu: 2, manual: 1 };
    if (!lama || pangkat[kunciYakin] > pangkat[lama.tingkat]) hasil.set(kode, { tingkat: kunciYakin, nilai: nilai.slice(0, 120), asal });
  };
  const nomor = p.nomor_perkara;
  const svc = layanan("abtUsulanService.js");
  const sipp = await svc.dariSipp(nomor).catch((g) => ({ ok: false, usulan: [], galat: String(g.message || g) }));
  for (const u of sipp.usulan || []) taruh(u, "sipp");

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
  const sippPosita = {
    posita,
    petitum,
    jenisPerkara: j,
    alur,
    namaPihak: (p.pihak1 || []).map((x) => x.nama),
  };
  let pl = null;
  try {
    pl = lain.dariPositaLain(posita, { jenisPerkara: j, alur, sebutan });
    pl = jenisSvc.tambahUsulanJenis(pl, posita, { jenisPerkara: j, alur });
    if (pwh.idJenis(j)) {
      const ps = await pwh.bacaSipp(nomor, q).catch(() => null);
      pl = pwh.tambahUsulanPwh(pl, posita, { jenisPerkara: j, alur, sipp: ps });
    }
    pl = await sambung.lengkapiPositaLain(pl, { posita, nomorPerkara: nomor, jenisPerkara: j, alur, bacaSipp: async () => sippPosita });
    pl = await derry.lengkapiJenis(pl, { jalur: "posita-lain", posita, jenisPerkara: j, nomorPerkara: nomor, bacaSipp: async () => sippPosita, bacaKumulasi: async () => null });
  } catch (g) {
    pl = pl || null;
    hasil.set("_galat_posita_lain", { tingkat: "manual", nilai: String(g.message || g).slice(0, 120), asal: "galat" });
  }
  for (const u of (pl && pl.usulan) || []) taruh(u, "posita-lain");
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

async function utama() {
  const keluar = process.argv[2];
  const per = await perkaraNyata();
  const perJenis = {};
  const contoh = {};
  for (const p of per) {
    const j = String(p.jenis_perkara_id);
    const e = (perJenis[j] = perJenis[j] || { nama: p.jenis_perkara_nama, perkara: 0, kode: {} });
    e.perkara += 1;
    const peta = await jalankanPerkara(p);
    for (const [kode, v] of peta) {
      const c = (e.kode[kode] = e.kode[kode] || { otomatis: 0, ragu: 0, manual: 0 });
      c[v.tingkat] += 1;
      contoh[`${j}:${kode}`] = contoh[`${j}:${kode}`] || { perkara: p.nomor_perkara, ...v };
    }
  }
  const dokumen = { dibuat: new Date().toISOString().slice(0, 10), sumber: "sipp_donggala lokal (semua tahun), jalur dariSipp + posita-lain", jenis: perJenis, contoh };
  if (keluar) fs.writeFileSync(keluar, JSON.stringify(dokumen, null, 1));
  for (const [j, e] of Object.entries(perJenis)) {
    const k = Object.entries(e.kode).filter(([kode]) => !kode.startsWith("_"));
    const ot = k.filter(([, c]) => c.otomatis).length;
    const rg = k.filter(([, c]) => !c.otomatis && c.ragu).length;
    console.log(`${j} ${e.nama}: ${e.perkara} perkara; kode otomatis ${ot}, hanya ragu ${rg}, manual ${k.filter(([, c]) => !c.otomatis && !c.ragu).length}`);
  }
  process.exit(0);
}

if (require.main === module) {
  utama().catch((g) => {
    console.error(g);
    process.exit(1);
  });
}

module.exports = { JENIS_S6, jalankanPerkara, perkaraNyata, q };
