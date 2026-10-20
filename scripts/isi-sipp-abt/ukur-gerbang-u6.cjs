// Ukur (baca saja) KETEPATAN pengisi otomatis atas perkara nyata dan bangun GERBANG: aleta_bot/config/gerbang-isian.json.
//
//   node scripts/isi-sipp-abt/ukur-gerbang-u6.cjs --maks 220 --kerja 4 --mentah <ukuran-mentah.json> [--tulis]
//
// Cara kerja: untuk sampel perkara 2023+ yang punya isian petugas di ABT lokal (aps_badilag.abt_data_teks), memanggil RUTE BOT
// SUNGGUHAN /abt/usulan (sumber sipp + saksi/itsbat/posita-lain seperti ekstensi) lalu membandingkan tiap usulan dengan isian
// petugas untuk kode yang sama. Tidak menulis ke SIPP/ABT. Hasil mentah per (kode, asal) -> aturan gerbang:
//   n_banding >= 20 dan cocok >= 0,97  -> otomatis, pangkatMaks pasti
//   n_banding >= 20 dan cocok >= 0,90  -> otomatis, pangkatMaks cukup
//   n_banding >= 20 dan cocok <  0,90  -> saran (ragu)
//   n_banding <  20 dan asal SIPP terstruktur dengan n_emit >= 15 dan (tanpa pembanding, atau cocok >= 90% dari yang ada) -> terstruktur (pangkatMaks cukup)
//   selainnya -> saran (contoh belum cukup)
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const arg = (n, b) => {
  const i = process.argv.indexOf(n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : b;
};
const akar = path.resolve(__dirname, "..", "..");
const maks = Number(arg("--maks", "200"));
const kerja = Number(arg("--kerja", "4"));
const mentahBerkas = arg("--mentah", "");
const tulis = process.argv.includes("--tulis");
const dariMentah = arg("--dari-mentah", "");
const khusus = Number(arg("--khusus", "0"));

process.env.ALETA_BOT_DB_SIPP_NAME = process.env.ALETA_BOT_DB_SIPP_NAME || "sipp_donggala";
process.env.ALETA_BOT_DB_USER = process.env.ALETA_BOT_DB_USER || "root";
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const FP = require(path.join(akar, "aleta_bot", "services", "faktaPerkara.js"));

const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", typeCast: (f) => f.string() });
const q = (s, p) => new Promise((a, b) => kon.query(s, p || [], (e, r) => (e ? b(e) : a(r))));

// ── rute bot sungguhan ──
let penangan = null;
function muatRute() {
  if (penangan) return penangan;
  const r = require(path.join(akar, "aleta_bot", "routes", "internalGatewayRoutes.js"));
  const router = r.router || r;
  const lapis = (router.stack || []).find((l) => l.route && l.route.path === "/abt/usulan" && l.route.methods.post);
  if (!lapis) throw new Error("rute /abt/usulan tidak ditemukan");
  penangan = lapis.route.stack[lapis.route.stack.length - 1].handle;
  return penangan;
}
function panggilRute(body) {
  return new Promise((ok, gagal) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(o) { ok(o); }, send(o) { ok(o); } };
    Promise.resolve(muatRute()({ body, headers: {}, query: {}, get: () => "" }, res, () => {})).catch(gagal);
  });
}

const rapat = (t) => String(t == null ? "" : t).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const norm = (t) => rapat(t).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const angkaSemua = (t) => (String(t).match(/\d[\d.]*/g) || []).map((x) => x.replace(/\./g, "")).filter((x) => x.length >= 1);
/** Kecocokan usulan vs isian petugas (longgar tetapi tidak asal): tanggal sama, angka sama, atau teks saling memuat / token berimpit. */
function cocok(usulan, petugas) {
  const a = rapat(usulan);
  const b = rapat(petugas);
  if (!a || !b) return null;
  const ta = FP.kanon("tanggal", a);
  const tb = FP.kanon("tanggal", b);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ta) && /^\d{4}-\d{2}-\d{2}$/.test(tb)) return ta === tb;
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  if (na.length >= 3 && nb.length >= 3 && (na.includes(nb) || nb.includes(na))) return true;
  const xa = angkaSemua(a);
  const xb = angkaSemua(b);
  if (xa.length && xb.length && xa.length <= 4 && xb.length <= 4 && xa.every((x) => xb.includes(x)) && na.replace(/\d+/g, "").length < 40) return true;
  const sa = new Set(na.split(" ").filter((x) => x.length > 2));
  const sb = new Set(nb.split(" ").filter((x) => x.length > 2));
  if (sa.size && sb.size) {
    const irisan = [...sa].filter((x) => sb.has(x)).length;
    if (irisan / Math.min(sa.size, sb.size) >= 0.7) return true;
  }
  return false;
}

const asalNama = (u) => {
  const p = FP.prioUsulan(u);
  return p === FP.PRIO.sipp ? "sipp" : p === FP.PRIO.berkas ? "berkas" : "posita";
};

async function ukurPerkara(p, agregat, o) {
  const pihak = p.j === 346 ? { pelaku: "Termohon", lawan: "Pemohon" } : p.j === 347 ? { pelaku: "Tergugat", lawan: "Penggugat" } : { pelaku: "Termohon", lawan: "Pemohon" };
  const petugasBaris = await q("SELECT no_var, data FROM aps_badilag.abt_data_teks WHERE perkara_id = ?", [p.perkara_id]);
  const petugas = {};
  for (const b of petugasBaris) petugas[String(b.no_var).padStart(4, "0")] = b.data;
  const dasar = { nomorPerkara: p.nomor_perkara, pelaku: pihak.pelaku, lawan: pihak.lawan, posita: p.posita, jenisPerkara: p.jt, alur: String(p.a) };
  const hasil = [];
  const sippJ = await panggilRute({ nomorPerkara: p.nomor_perkara, sumber: "sipp" }).catch(() => null);
  if (sippJ && sippJ.sipp && Array.isArray(sippJ.sipp.usulan)) hasil.push(["sipp", sippJ.sipp.usulan]);
  const tambahan = [];
  if (!(o && o.hanyaSipp)) {
  if (p.j === 346 || p.j === 347) tambahan.push(["saksi", { saksi1: "", saksi2: "", tanggalSidang: "", pelaku: pihak.pelaku, lawan: pihak.lawan, posita: p.posita }, "saksi"]);
  if (p.j === 360) tambahan.push(["itsbat", { posita: p.posita, pemohon: "Pemohon I", pelaku: "Pemohon II", jenisPerkara: p.jt, alur: String(p.a) }, "itsbat"]);
  else tambahan.push(["posita-lain", { ...dasar, pemohon: pihak.lawan }, "positaLain"]);
  }
  for (const [nm, muatan, kunci] of tambahan) {
    const jw = await panggilRute({ nomorPerkara: p.nomor_perkara, ...muatan, sumber: nm }).catch(() => null);
    if (jw && jw[kunci] && Array.isArray(jw[kunci].usulan)) hasil.push([nm, jw[kunci].usulan]);
  }
  for (const [sumberRute, daftar] of hasil) {
    const lihat = new Set();
    for (const u of daftar) {
      if (!u || !u.kode || !rapat(u.nilai)) continue;
      if (/^fakta-setara/.test(String(u.kodePola || ""))) continue;
      const y = String(u.keyakinan || "");
      if (!/^(pasti|cukup|ragu)$/.test(y)) continue;
      const kode = String(u.kode).padStart(4, "0");
      const asal = asalNama(u);
      const kunci = `${kode}@${asal}`;
      if (lihat.has(kunci)) continue;
      lihat.add(kunci);
      const a = (agregat[kunci] = agregat[kunci] || { kode, asal, nama: u.nama || "", n: 0, banding: 0, cocok: 0, perYakin: {}, perJenis: {}, rute: {}, contohSalah: [] });
      a.n++;
      a.rute[sumberRute] = (a.rute[sumberRute] || 0) + 1;
      const py = (a.perYakin[y] = a.perYakin[y] || { n: 0, banding: 0, cocok: 0 });
      py.n++;
      const pj = (a.perJenis[p.j] = a.perJenis[p.j] || { n: 0, banding: 0, cocok: 0 });
      pj.n++;
      if (petugas[kode] != null && rapat(petugas[kode])) {
        const c = cocok(u.nilai, petugas[kode]);
        if (c !== null) {
          a.banding++;
          py.banding++;
          pj.banding++;
          if (c) {
            a.cocok++;
            py.cocok++;
            pj.cocok++;
          } else if (a.contohSalah.length < 3) a.contohSalah.push({ usulan: rapat(u.nilai).slice(0, 80), petugas: rapat(petugas[kode]).slice(0, 80) });
        }
      }
    }
  }
}

function aturan(a) {
  const MIN_BANDING = 20;
  const rasio = a.banding ? a.cocok / a.banding : null;
  if (a.banding >= MIN_BANDING) {
    if (rasio >= 0.97) return { status: "otomatis", pangkatMaks: "pasti", dasar: "pembanding isian petugas" };
    if (rasio >= 0.9) return { status: "otomatis", pangkatMaks: "cukup", dasar: "pembanding isian petugas" };
    return { status: "saran", pangkatMaks: "ragu", dasar: "pembanding isian petugas: ketepatan di bawah 90%" };
  }
  if (a.asal === "sipp" && a.n >= 15 && (a.banding === 0 || a.cocok / a.banding >= 0.9)) return { status: "terstruktur", pangkatMaks: "cukup", dasar: "terbaca langsung dari kolom SIPP; isian petugas pembanding kurang dari 20" };
  return { status: "saran", pangkatMaks: "ragu", dasar: a.banding ? "contoh pembanding kurang dari 20" : "belum ada pembanding dan contoh kurang" };
}

(async () => {
  let agregat = {};
  let diukur = 0;
  let sampelInfo = {};
  if (dariMentah) {
    // beberapa berkas mentah (dipisah koma) digabung: pencacah dijumlahkan
    for (const berkas of dariMentah.split(",")) {
      const m = JSON.parse(fs.readFileSync(berkas, "utf8"));
      diukur += m.perkara;
      for (const [j, n] of Object.entries(m.sampel || {})) sampelInfo[j] = (sampelInfo[j] || 0) + n;
      for (const [k, a] of Object.entries(m.agregat)) {
        const t = (agregat[k] = agregat[k] || { kode: a.kode, asal: a.asal, nama: a.nama, n: 0, banding: 0, cocok: 0, perYakin: {}, perJenis: {}, rute: {}, contohSalah: [] });
        t.n += a.n;
        t.banding += a.banding;
        t.cocok += a.cocok;
        if (!t.nama && a.nama) t.nama = a.nama;
        for (const grp of ["perYakin", "perJenis", "rute"]) {
          for (const [x, v] of Object.entries(a[grp] || {})) {
            if (typeof v === "number") t[grp][x] = (t[grp][x] || 0) + v;
            else {
              const d = (t[grp][x] = t[grp][x] || { n: 0, banding: 0, cocok: 0 });
              d.n += v.n;
              d.banding += v.banding;
              d.cocok += v.cocok;
            }
          }
        }
        for (const c of a.contohSalah || []) if (t.contohSalah.length < 3) t.contohSalah.push(c);
      }
    }
  } else if (khusus > 0) {
    // perkara yang punya data terstruktur khusus (delegasi, kuasa, mediasi, ikrar, anak): hanya rute sipp, tanpa pembanding wajib
    const kelompok = [
      "SELECT perkara_id FROM sipp_donggala.delegasi_keluar WHERE id_jenis_delegasi = 1",
      "SELECT perkara_id FROM sipp_donggala.perkara_pengacara WHERE aktif = 'Y'",
      "SELECT perkara_id FROM sipp_donggala.perkara_mediasi WHERE hasil_mediasi IS NOT NULL",
      "SELECT perkara_id FROM sipp_donggala.perkara_ikrar_talak",
      "SELECT perkara_id FROM sipp_donggala.perkara_anak_pihak WHERE nama_anak IS NOT NULL",
      "SELECT perkara_id FROM sipp_donggala.perkara_data_pernikahan",
      "SELECT perkara_id FROM sipp_donggala.perkara_data_itsbat",
    ];
    const ids = new Set();
    for (const sql of kelompok) {
      try {
        for (const r of await q(`SELECT DISTINCT x.perkara_id FROM (${sql}) x JOIN sipp_donggala.perkara p ON p.perkara_id = x.perkara_id WHERE p.tanggal_pendaftaran >= '2023-01-01' ORDER BY RAND() LIMIT ${khusus}`)) ids.add(Number(r.perkara_id));
      } catch (e) {
        console.error("kelompok khusus dilewati:", e.code || e.message);
      }
    }
    const sampel = await q(`SELECT p.perkara_id, p.nomor_perkara, p.jenis_perkara_id j, p.jenis_perkara_text jt, p.alur_perkara_id a, p.posita FROM sipp_donggala.perkara p WHERE p.perkara_id IN (${[...ids].join(",") || 0})`);
    for (const s of sampel) sampelInfo[s.j] = (sampelInfo[s.j] || 0) + 1;
    const antre = sampel.slice();
    const pekerja = async () => {
      while (antre.length) {
        const p = antre.shift();
        try {
          await ukurPerkara({ ...p, j: Number(p.j) }, agregat, { hanyaSipp: true });
          diukur++;
        } catch (e) {
          console.error("gagal", p.perkara_id, e.message);
        }
      }
    };
    await Promise.all(Array.from({ length: kerja }, pekerja));
    if (mentahBerkas) fs.writeFileSync(mentahBerkas, JSON.stringify({ perkara: diukur, sampel: sampelInfo, agregat }, null, 1));
  } else {
    const sampel = await q(
      `SELECT p.perkara_id, p.nomor_perkara, p.jenis_perkara_id j, p.jenis_perkara_text jt, p.alur_perkara_id a, p.posita
         FROM sipp_donggala.perkara p
        WHERE p.tanggal_pendaftaran >= '2023-01-01' AND p.posita IS NOT NULL AND LENGTH(p.posita) > 150
          AND p.perkara_id IN (SELECT perkara_id FROM aps_badilag.abt_data_teks GROUP BY perkara_id HAVING COUNT(*) >= 6)
        ORDER BY RAND() LIMIT ${maks}`
    );
    for (const s of sampel) sampelInfo[s.j] = (sampelInfo[s.j] || 0) + 1;
    const antre = sampel.slice();
    const pekerja = async () => {
      while (antre.length) {
        const p = antre.shift();
        try {
          await ukurPerkara({ ...p, j: Number(p.j) }, agregat);
          diukur++;
        } catch (e) {
          console.error("gagal", p.perkara_id, e.message);
        }
        if (diukur % 20 === 0) console.error("terukur", diukur, "dari", sampel.length);
      }
    };
    await Promise.all(Array.from({ length: kerja }, pekerja));
    if (mentahBerkas) fs.writeFileSync(mentahBerkas, JSON.stringify({ perkara: diukur, sampel: sampelInfo, agregat }, null, 1));
  }
  // aturan gerbang
  const kode = {};
  for (const a of Object.values(agregat)) {
    const t = aturan(a);
    const e = (kode[a.kode] = kode[a.kode] || { nama: a.nama, asal: {} });
    if (!e.nama && a.nama) e.nama = a.nama;
    e.asal[a.asal] = {
      n: a.n,
      banding: a.banding,
      cocok: a.cocok,
      persen: a.banding ? Math.round((a.cocok / a.banding) * 1000) / 10 : null,
      status: t.status,
      pangkatMaks: t.pangkatMaks,
      dasar: t.dasar,
      ...(a.contohSalah.length ? { contohSalah: a.contohSalah } : {}),
    };
  }
  // kode yang ditulis pengisi dengan pasti/cukup tetapi tidak muncul di sampel: diakui BELUM TERUKUR (diperlakukan sebagai saran)
  const belumTerukur = {};
  for (const [k, lokasi] of Object.entries(require(path.join(akar, "aleta_bot", "services", "gerbangIsian.js")).pindaiPengisi())) {
    if (!kode[k]) belumTerukur[k] = `ditulis ${[...new Set(lokasi)].slice(0, 2).join(", ")} dengan pasti/cukup, tetapi tidak muncul pada ${diukur} perkara sampel; sampai terukur hanya saran`;
  }
  const out = {
    skema: "gerbang-isian/1",
    versi: 1,
    diukur: new Date().toISOString().slice(0, 10),
    cara: "scripts/isi-sipp-abt/ukur-gerbang-u6.cjs: rute bot /abt/usulan sungguhan atas sampel perkara 2023+ yang punya isian petugas di ABT lokal; pembanding = aps_badilag.abt_data_teks (isian petugas/hakim)",
    sampel: { perkara: diukur, perJenis: sampelInfo },
    aturan: {
      otomatis: "n_banding >= 20 dan cocok >= 90% (pasti bila >= 97%)",
      terstruktur: "nilai terbaca langsung dari kolom SIPP, pembanding < 20: boleh terisi sendiri sampai 'cukup'",
      saran: "selainnya: usulan hanya saran 'ragu - periksa'",
      tanpaUkuran: "kode/asal yang tidak tercatat di sini diturunkan menjadi saran 'ragu' saat berjalan",
    },
    kode,
    belumTerukur,
  };
  if (tulis) fs.writeFileSync(path.join(akar, "aleta_bot", "config", "gerbang-isian.json"), JSON.stringify(out, null, 1) + "\n");
  const ringkas = Object.values(kode).reduce((acc, e) => {
    for (const v of Object.values(e.asal)) acc[v.status] = (acc[v.status] || 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({ perkara: diukur, kodeAsal: ringkas }, null, 1));
  kon.end();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
