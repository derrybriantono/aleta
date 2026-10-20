// Ukur (BACA SAJA) berapa isian "Perlu diisi" blangko Derry terisi OTOMATIS / RAGU / MANUAL / OPSIONAL / KOSONG untuk
// jenis perkara S5 (dispensasi kawin 362, perwalian 354, asal usul anak 358, wali adhal 363, penetapan ahli waris/P3HP 371),
// per kategori blangko (putusan, bas, relaas, ptsp, sita), atas perkara terdaftar di salinan lokal sipp_donggala (hanya SELECT).
//
//   node scripts/isi-sipp-abt/ukur-isi-s5-20okt.cjs [--akar <folder repo>] [--keluar <berkas.json>] [--dari 2025-01-01]
//                                                   [--jenis 362,354,358,363,371] [--maks <n per jenis>] [--rinci]
//
// --akar : repo yang diukur. Untuk "sebelum" arahkan ke salinan tag rilis (git archive + junction node_modules) - pembanding
//          sebelum/sesudah memakai ukuran yang sama persis.
//
// Rantai yang dijalankan meniru panel Blangko Derry (blangko-derry-isian.js: isiDariSipp -> susunTambahan -> mesin.kumpulkan):
//   1. sumber "sipp"        = abtUsulanService.dariSipp(nomor)            (kueri SELECT ke SIPP)
//   2. sumber "posita-lain" = dariPositaLain -> tambahUsulanJenis -> sambunganPwh -> lengkapiPositaLain -> lengkapiUsulanDk
//                             -> blangkoDerry.lengkapiJenis  (posita dari SIPP; panel mengirim posita ABT 5125 yang sama)
//   3. keputusan tulis/saran = AletaIsiSipp.putuskan (ekstensi-sipp/isi-sipp-bersama.js): pasti/cukup = OTOMATIS, ragu = RAGU.
// Isian yang hanya bisa dari berkas e-Court (gugatan, OCR lampiran, jawab-menjawab, bukti, KTP) tidak terukur lokal: kelas
// "ecourt" menurut kurasi (scripts/isi-sipp-abt/pengisi-kurasi.cjs). Isian yang BERGANTUNG KEADAAN (kuasa/prodeo/ghaib/
// insidentil/e-Court) dihitung hanya pada perkara yang keadaannya berlaku.
//
// Kelas tiap (perkara x isian):
//   otomatis : nilai pasti/cukup dari salah satu pengisi (tertulis sendiri bila saklar "Isi otomatis" menyala)
//   ragu     : nilai ada tetapi hanya "ragu - periksa" (saran samar, tanpa centang)
//   ecourt   : bergantung berkas e-Court (tak terukur lokal)
//   manual   : tidak mungkin otomatis; ditandai "diisi manual" + alasan (METADATA modul S5, bila ada di repo yang diukur)
//   opsional : isian tambahan (bila ada) - tidak masuk "Perlu diisi"
//   kosong   : belum ada pengisi dan belum ditandai (celah)
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
const dari = arg("--dari", "2025-01-01");
const maks = Number(arg("--maks", "400"));
const rinci = process.argv.includes("--rinci");
const JENIS = arg("--jenis", "362,354,358,363,371").split(",").map(Number);
const NAMA_JENIS = { 362: "Dispensasi Kawin", 354: "Perwalian", 358: "Asal Usul Anak", 363: "Wali Adhal", 371: "Penetapan Ahli Waris (P3HP)" };

process.env.ALETA_BOT_DB_SIPP_NAME = process.env.ALETA_BOT_DB_SIPP_NAME || "sipp_donggala";
process.env.ALETA_BOT_DB_USER = process.env.ALETA_BOT_DB_USER || "root";
process.env.ALETA_BOT_DB_SIPP_HOST = process.env.ALETA_BOT_DB_SIPP_HOST || "127.0.0.1";
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const { petaFolder } = require(path.join(akarSkrip, "scripts", "isi-sipp-abt", "folder-jenis.cjs"));
const { KELOMPOK } = require(path.join(akarSkrip, "scripts", "isi-sipp-abt", "pengisi-kurasi.cjs"));
const svc = (...p) => require(path.join(akar, "aleta_bot", "services", ...p));

// Mesin keputusan ekstensi (IIFE yang menaruh AletaIsiSipp di globalThis).
require(path.join(akar, "ekstensi-sipp", "isi-sipp-bersama.js"));
const mesin = globalThis.AletaIsiSipp;

const daftarCek = JSON.parse(fs.readFileSync(path.join(akarSkrip, "docs", "isi-sipp-abt", "DAFTAR-CEK.json"), "utf8"));
const infoIsian = new Map(daftarCek.isian.map((x) => [x.kunci, x]));

/** METADATA (manual/opsional) dari modul S5 di repo yang diukur; kosong bila belum ada ("sebelum"). */
let metadata = {};
let S5mod = null;
try {
  S5mod = require(path.join(akar, "aleta_bot", "services", "isiOtomatisJenisS5.js"));
  metadata = S5mod.METADATA || {};
} catch {
  /* belum ada: ukuran "sebelum" */
}

const KODE_ECOURT = new Set();
for (const g of KELOMPOK) {
  const eco = /ecourt|Ecourt/.test(g.berkas) || /e-Court/.test(g.sumber || "");
  const ekstensi = g.berkas === "ekstensi-sipp/abt.js" || g.berkas === "ekstensi-sipp/blangko-derry-isian.js";
  if (eco || ekstensi) for (const k of g.kode) KODE_ECOURT.add(k);
}

const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: "sipp_donggala", typeCast: (f) => f.string() });
const q = (sql, p) => new Promise((ok, gagal) => kon.query(sql, p || [], (e, r) => (e ? gagal(e) : ok(r))));

/**
 * Blangko lintas jenis (relaas, PTSP, sita) yang berlaku bagi jenis ini. Yang khusus jenis lain tidak dihitung
 * (pencegahan perkawinan 342, pengumuman itsbat 360, ikrar talak 346, sita harta bersama/waris 348/364/365).
 */
function berlakuUntukJenis(b, j) {
  if (!petaFolder(b.folder).universal) return true;
  const berkas = String(b.jalur || "").split("/").pop();
  if (/^97 Sita/.test(b.folder) || /Sita (Dikabulkan|Ditolak)/i.test(berkas)) return [348, 364, 365].includes(Number(j));
  if (/Pencegahan Perkawinan/i.test(berkas)) return Number(j) === 342;
  if (/Pengumuman Permohonan Itsbat/i.test(berkas)) return Number(j) === 360;
  if (/Ikrar Talak/i.test(berkas)) return Number(j) === 346;
  return true;
}

function blangkoUntuk(j, a) {
  const kunci = `${j}/${a}`;
  return daftarCek.blangko.filter((b) => (petaFolder(b.folder).freq.includes(kunci) || petaFolder(b.folder).universal) && berlakuUntukJenis(b, j));
}

/** Kategori blangko: putusan (putusan/penetapan hakim), bas (tiap sidang), relaas, ptsp, sita. */
function kategoriBlangko(b) {
  const berkas = String(b.jalur || "").split("/").pop();
  if (/^98 Relaas/.test(b.folder)) return "relaas";
  if (/^99 PTSP/.test(b.folder)) return "ptsp";
  if (/^97 Sita/.test(b.folder)) return "sita";
  if (/BAS/.test(b.folder) || /^\[\d+\w*\]\s*BAS/i.test(berkas)) return "bas";
  return "putusan";
}

const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
/** Sama dengan keIso di ekstensi-sipp/blangko-derry-isian.js: "15 Oktober 2026", "15/10/2026", "2026-10-15" -> ISO. */
const keIso = (teks) => {
  const t = String(teks || "").trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/);
  if (m) {
    const b = BULAN_ID.findIndex((x) => x.toLowerCase().startsWith(m[2].toLowerCase().slice(0, 3)));
    if (b >= 0) return `${m[3]}-${String(b + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
};

/** Keadaan yang membuat isian berlaku untuk perkara ini (kuasa/prodeo); "x" = tidak diukur. */
function berlaku(keadaan, ctx) {
  if (!keadaan) return true;
  if (keadaan === "kuasaP") return ctx.kuasaP;
  if (keadaan === "kuasaT") return ctx.kuasaT;
  if (keadaan === "prodeo") return ctx.prodeo;
  return false; // ghaib, insidentil, e-Court, alasan C/H: bersyarat khusus, diukur terpisah
}

const { kumpulUsulan } = require("./rantai-usulan-s5.cjs")(akar);

(async () => {
  const baris = await q(
    `SELECT p.perkara_id, p.nomor_perkara, p.jenis_perkara_id j, p.alur_perkara_id a, p.posita, p.petitum, p.prodeo,
            (SELECT COUNT(*) FROM perkara_pengacara x WHERE x.perkara_id = p.perkara_id AND x.pihak_ke = 1 AND x.aktif = 'Y') kuasa1,
            (SELECT COUNT(*) FROM perkara_pengacara x WHERE x.perkara_id = p.perkara_id AND x.pihak_ke = 2 AND x.aktif = 'Y') kuasa2
       FROM perkara p WHERE p.tanggal_pendaftaran >= ? AND p.jenis_perkara_id IN (${JENIS.join(",")})
      ORDER BY p.jenis_perkara_id, p.perkara_id DESC`,
    [dari]
  );
  const perJenis = {};
  const hitung = {};
  for (const b of baris) {
    hitung[b.j] = (hitung[b.j] || 0) + 1;
    if (hitung[b.j] > maks) continue;
    const kunciJ = String(b.j);
    const blangko = blangkoUntuk(b.j, b.a);
    if (!blangko.length) continue;
    const ctx = { kuasaP: Number(b.kuasa1) > 0, kuasaT: Number(b.kuasa2) > 0, prodeo: Number(b.prodeo) === 1 };
    const wajibKat = {};
    for (const bl of blangko) {
      const kat = kategoriBlangko(bl);
      for (const k of bl.isian) {
        const x = infoIsian.get(k);
        if (!x || String(k).startsWith("tj:")) continue;
        if (!berlaku(x.keadaan, ctx)) continue;
        (wajibKat[kat] = wajibKat[kat] || new Set()).add(k);
      }
    }
    const semuaKode = new Set(Object.values(wajibKat).flatMap((s) => [...s]));
    const sumber = await kumpulUsulan(b);
    const dataS5 = S5mod ? await S5mod.bacaData(b.perkara_id, q) : null;
    const pilih = mesin.pilihPerKode(sumber, semuaKode);
    const kelasKode = new Map();
    for (const k of semuaKode) {
      const x = infoIsian.get(k);
      const u = pilih.get(k);
      let kelas = "";
      let alasan = "";
      if (u) {
        const h = mesin.putuskan(u, { kosong: true, jenis: x.jenis === "tanggal" ? "tanggal" : "teks", opsi: [], keIso, nama: x.nama });
        if (h.golongan === "tulis") kelas = "otomatis";
        else if (h.golongan === "saran") kelas = "ragu";
        else if (h.golongan === "pilihan") kelas = "ragu";
        else alasan = h.sebab;
      }
      if (!kelas) {
        const meta = metadata[k] || null;
        if (S5mod && dataS5 && !S5mod.berlaku(k, dataS5)) kelas = "bersyarat";
        else if (KODE_ECOURT.has(k)) kelas = "ecourt";
        else if (meta && meta.opsional) kelas = "opsional";
        else if (meta && meta.manual) kelas = "manual";
        else kelas = "kosong";
        if (kelas === "kosong" && alasan) kelas = "kosong";
      }
      kelasKode.set(k, { kelas, alasan });
    }
    const rJ = (perJenis[kunciJ] = perJenis[kunciJ] || { nama: NAMA_JENIS[b.j], perkara: 0, kategori: {}, nomor: [] });
    rJ.perkara++;
    rJ.nomor.push(b.nomor_perkara);
    for (const [kat, wajib] of Object.entries(wajibKat)) {
      const r = (rJ.kategori[kat] = rJ.kategori[kat] || { kode: {} });
      for (const k of wajib) {
        const { kelas, alasan } = kelasKode.get(k);
        const c = (r.kode[k] = r.kode[k] || { otomatis: 0, ragu: 0, ecourt: 0, manual: 0, opsional: 0, kosong: 0, bersyarat: 0, alasanLewat: {} });
        c[kelas]++;
        if (alasan) c.alasanLewat[alasan] = (c.alasanLewat[alasan] || 0) + 1;
      }
    }
  }
  const NOL = () => ({ otomatis: 0, ragu: 0, ecourt: 0, manual: 0, opsional: 0, kosong: 0, bersyarat: 0 });
  const ringkas = {};
  const total = {};
  for (const [kj, rJ] of Object.entries(perJenis)) {
    ringkas[kj] = { nama: rJ.nama, perkara: rJ.perkara, kategori: {} };
    for (const [kat, r] of Object.entries(rJ.kategori)) {
      const tot = NOL();
      for (const c of Object.values(r.kode)) for (const k of Object.keys(tot)) tot[k] += c[k];
      const jumlah = Object.entries(tot).reduce((x, [k, y]) => (k === "bersyarat" ? x : x + y), 0) || 1;
      ringkas[kj].kategori[kat] = { isian: Object.keys(r.kode).length, sel: jumlah, bersyaratSel: tot.bersyarat, ...Object.fromEntries(Object.entries(tot).filter(([k]) => k !== "bersyarat").map(([k, v]) => [k, Math.round((v / jumlah) * 1000) / 10])) };
      const T = (total[kat] = total[kat] || NOL());
      for (const k of Object.keys(tot)) T[k] += tot[k];
    }
  }
  const ringkasTotal = {};
  for (const [kat, t] of Object.entries(total)) {
    const jumlah = Object.entries(t).reduce((x, [k, y]) => (k === "bersyarat" ? x : x + y), 0) || 1;
    ringkasTotal[kat] = { sel: jumlah, bersyaratSel: t.bersyarat, ...Object.fromEntries(Object.entries(t).filter(([k]) => k !== "bersyarat").map(([k, v]) => [k, Math.round((v / jumlah) * 1000) / 10])) };
  }
  const out = { diukur: new Date().toISOString().slice(0, 10), dari, akar, ringkas, total: ringkasTotal, jenis: perJenis };
  if (keluar) fs.writeFileSync(keluar, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ ringkas, total: ringkasTotal }, null, 1));
  if (rinci) {
    for (const [kj, rJ] of Object.entries(perJenis)) {
      for (const [kat, r] of Object.entries(rJ.kategori)) {
        console.log(`\n== ${rJ.nama} / ${kat} (perkara ${rJ.perkara})`);
        for (const [k, c] of Object.entries(r.kode)) {
          const n = c.otomatis + c.ragu + c.ecourt + c.manual + c.opsional + c.kosong + c.bersyarat;
          console.log(`${k} ${(infoIsian.get(k) || {}).nama?.slice(0, 48) || ""} | oto ${c.otomatis} ragu ${c.ragu} eco ${c.ecourt} man ${c.manual} ops ${c.opsional} syarat-tdk-berlaku ${c.bersyarat} kosong ${c.kosong} /${n}`);
        }
      }
    }
  }
  kon.end();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
