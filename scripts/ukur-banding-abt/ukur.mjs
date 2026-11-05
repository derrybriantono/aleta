#!/usr/bin/env node
/**
 * PENGUKUR BANDING TAHAP 4 - nilai tiap isian (#NNNN#) menurut mesin ALETA vs menurut ABT (renderer php56 ABT asli).
 * HANYA MEMBACA: sisi mesin lewat pagarBaca (aleta_bot/services/abtMesinVariabel.js); sisi ABT lewat salinan ABT milik sendiri
 * (UJI_ABT_DIR -> sipp_vs + aps_badilag_vs), yang menulis urutan sidang ke SALINAN itu saja - tidak pernah ke SIPP sungguhan.
 * Keluaran memuat data perkara -> tulis ke luar repo (bawaan D:/aleta-dev/kerja/aleta-abt/t4).
 *
 *   node ukur.mjs pilih   <pool.tsv> <jumlah> <keluar.tsv>
 *   node ukur.mjs mesin   <perkara.tsv> <kode.txt> <dir>      [env ALETA_JALUR=pustaka|katalog]
 *   node ukur.mjs abt     <perkara.tsv> <kode.txt> <dir> [paralel=2]
 *   node ukur.mjs dari-mentah <perkara.tsv> <kode.txt> <dirMentah> <dirAbt>   (sisi ABT dari pecahan mentah Tahap 5/8, tanpa render PHP)
 *   node ukur.mjs banding <perkara.tsv> <kode.txt> <dirMesin> <dirAbt> <keluar.json>
 *   env SIPP_DB (bawaan sipp_vs), ABT_DB (bawaan aps_badilag_vs)
 * perkara.tsv: perkara_id TAB tag TAB jenis
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const AKAR = path.join(SINI, "..", "..");
const req = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
const SIPP = process.env.SIPP_DB || "sipp_vs";
const ABT = process.env.ABT_DB || "aps_badilag_vs";
const JEDA = 150;

const baca = (f) => fs.readFileSync(f, "utf8");
const daftarPerkara = (f) => baca(f).split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t"));
const daftarKode = (f) => baca(f).split(/[,\s]+/).filter(Boolean);
/** Daftar penanda satu perkara: KODE_DIR/p<perkara>.txt bila ada (Tahap 8: hanya penanda keluarga perkara itu), selain itu daftar umum. */
function kodePid(pid, kodeF) {
  const f = process.env.KODE_DIR ? path.join(process.env.KODE_DIR, `p${pid}.txt`) : "";
  const berkas = f && fs.existsSync(f) ? f : kodeF;
  return { daftar: daftarKode(berkas), berkas };
}
export const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
/** Longgar: spasi dibuang seluruhnya (membedakan "beda tata letak" dari "beda isi"). */
export const longgar = (s) => String(s ?? "").replace(/\s+/g, "");

async function pilih([pool, jumlah, keluar]) {
  const baris = daftarPerkara(pool).filter((b) => /^Cerai (Gugat|Talak)/.test(b[2]));
  const kel = new Map();
  for (const b of baris) {
    const k = `${b[2]}|${b[1]}`;
    if (!kel.has(k)) kel.set(k, []);
    kel.get(k).push(b);
  }
  const dipilih = [];
  const wadah = [...kel.values()];
  const tiap = { "Cerai Gugat": 0, "Cerai Talak": 0 };
  const maks = Math.ceil(Number(jumlah) / 2);
  for (let putar = 0; dipilih.length < Number(jumlah) && putar < 50; putar += 1) {
    for (const w of wadah) {
      const b = w[putar];
      if (!b || dipilih.length >= Number(jumlah)) continue;
      if (tiap[b[2]] >= maks) continue;
      tiap[b[2]] += 1;
      dipilih.push(b);
    }
  }
  fs.writeFileSync(keluar, dipilih.map((b) => b.slice(0, 3).join("\t")).join("\n") + "\n");
  console.log("dipilih", dipilih.length, JSON.stringify(tiap));
}

function bukaKolam() {
  const mysql = req("mysql");
  const kolam = mysql.createPool({ host: "127.0.0.1", user: "root", database: SIPP, connectionLimit: 4, multipleStatements: false });
  const kueri = (sql, params, opsi) => {
    const teks = String(sql).replace(/\baps_badilag\./g, `${ABT}.`);
    return new Promise((ok, gagal) =>
      kolam.query({ sql: teks, values: params || [], timeout: (opsi && opsi.timeoutMs) || Number(process.env.BATAS_KUERI_MS) || 60000, typeCast: (f) => (f.packet && f.packet.charsetNr === 63 && /STRING|BLOB/.test(String(f.type)) ? f.buffer().toString("latin1") : f.string()) }, (g, r) => (g ? gagal(g) : ok(r)))
    );
  };
  return { kolam, kueri };
}

async function mesin([perkaraF, kodeF, dir]) {
  // MESIN_BERKAS = salinan mesin dari rilis sebelumnya (pengukuran "sebelum"); bawaan = mesin di pohon kerja.
  const { buatMesin } = req(process.env.MESIN_BERKAS || path.join(AKAR, "aleta_bot", "services", "abtMesinVariabel.js"));
  const { kolam, kueri } = bukaKolam();
  fs.mkdirSync(dir, { recursive: true });
  // JALUR=aleta: mesin dijalankan dengan opsi jalurAleta; pustaka disusun dari KATALOG ABT yang sama (kesetaraan jalur pustaka = jalur katalog).
  const jalurAleta = process.env.JALUR === "aleta" ? await jalurDariKatalog(kueri) : undefined;
  // Dokumen uji yang SAMA persis dengan yang dirender ABT (abt_render.py): satu paragraf per penanda.
  const B = "\\";
  const N = String.fromCharCode(10);
  for (const [pid] of daftarPerkara(perkaraF)) {
    const f = path.join(dir, `p${pid}.json`);
    if (fs.existsSync(f)) continue;
    const { daftar: kode, berkas: kodeBerkas } = kodePid(pid, kodeF);
    const dok = `{${B}rtf1${B}ansi${B}ansicpg1252${B}deff0{${B}fonttbl{${B}f0 Times New Roman;}}${N}` + kode.map((k) => `${B}pard @@${k}@@ #${k}#${B}par${N}`).join("") + `${B}pard @@AKHIR@@${B}par}`;
    const t0 = Date.now();
    const m = buatMesin({ kueri, skemaAbt: ABT, umurKatalogMs: 3600 * 1000, batasKueriMs: Number(process.env.BATAS_KUERI_MS) || 60000, ...(jalurAleta ? { jalurAleta } : {}) });
    const h = await m.isiRtf(dok, { perkaraId: pid });
    const rtfF = path.join(dir, `p${pid}.rtf`);
    fs.writeFileSync(rtfF, h.rtf, "latin1");
    await new Promise((ok, gagal) => {
      const c = spawn("python", [path.join(SINI, "abt_render.py"), "--dari-rtf", rtfF, kodeBerkas, path.join(dir, `t${pid}.json`)], { stdio: "inherit" });
      c.on("exit", (kd) => (kd === 0 ? ok() : gagal(new Error("ubah RTF gagal"))));
    });
    const teks = JSON.parse(baca(path.join(dir, `t${pid}.json`))).nilai;
    const kosong = Object.fromEntries(h.kosong.map((x) => [x.noVar, x.status + ":" + x.sebab.slice(0, 160)]));
    fs.writeFileSync(f, JSON.stringify({ perkara: pid, detik: Math.round((Date.now() - t0) / 1000), mesinGalat: h.mesinGalat, teks, kosong, terisi: h.terisi, peringatan: h.peringatan || [] }));
    fs.unlinkSync(rtfF);
    fs.unlinkSync(path.join(dir, `t${pid}.json`));
    console.log("mesin", pid, "detik", Math.round((Date.now() - t0) / 1000), "kosong", h.kosong.length);
  }
  kolam.end();
}

async function jalurDariKatalog(kueri) {
  const baris = await kueri(`SELECT no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang FROM ${ABT}.abt_variabel`);
  const pustaka = {};
  const alias = {};
  for (const b of baris) {
    const no = String(b.no_var).trim();
    pustaka[no] = { ...b, no_var: no, kode: `AA${no.padStart(5, "0")}` };
    alias[`AA${no.padStart(5, "0")}`] = no;
  }
  return { pustaka, alias };
}

async function abt([perkaraF, kodeF, dir, paralel = "2"]) {
  fs.mkdirSync(dir, { recursive: true });
  // satu perkara dapat mewakili beberapa keluarga (barisnya berulang): render sekali saja
  const antre = [...new Set(daftarPerkara(perkaraF).map((b) => b[0]))].filter((pid) => !fs.existsSync(path.join(dir, `p${pid}.json`)));
  const env = { ...process.env, TMP: process.env.TMP || "D:\Aplikasi\aleta\tmp", TEMP: process.env.TMP || "D:\Aplikasi\aleta\tmp" };
  async function pekerja() {
    while (antre.length) {
      const pid = antre.shift();
      await new Promise((ok) => {
        const c = spawn("python", [path.join(SINI, "abt_render.py"), `@${kodeF}`, pid, path.join(dir, `p${pid}.json`)], { env, stdio: "inherit" });
        c.on("exit", ok);
      });
    }
  }
  await Promise.all(Array.from({ length: Number(paralel) }, pekerja));
}

/**
 * Nilai tiap isian sisi ABT dari pecahan RTF mentah (naskah.mts abt) tanpa merender ulang di PHP: tiap pecahan diubah dengan pengubah
 * yang sama seperti keluaran ABT. Hasilnya berbentuk sama dengan `abt` sehingga `banding` memakainya tanpa perubahan.
 *   node ukur.mjs dari-mentah <perkara.tsv> <kode.txt> <dirMentah> <dirKeluar>
 */
async function dariMentah([perkaraF, kodeF, dirMentah, dir]) {
  fs.mkdirSync(dir, { recursive: true });
  for (const pid of [...new Set(daftarPerkara(perkaraF).map((b) => b[0]))]) {
    const f = path.join(dir, `p${pid}.json`);
    const m = path.join(dirMentah, `p${pid}.json`);
    if (fs.existsSync(f) || !fs.existsSync(m)) continue;
    await new Promise((ok, gagal) => {
      const c = spawn("python", [path.join(SINI, "abt_render.py"), "--dari-mentah", m, kodePid(pid, kodeF).berkas, f], { stdio: "inherit" });
      c.on("exit", (kd) => (kd === 0 ? ok() : gagal(new Error(`ubah pecahan gagal untuk ${pid}`))));
    });
    console.log("dari-mentah", pid);
  }
}

/**
 * Sebab beda isian yang SUDAH DIKENAL (ditetapkan sesudah ditinjau, bukan ditebak oleh mesin):
 *   tandaKosong  isian kosong: ALETA mencetak titik-titik isian (kebijakan cetak), ABT mencetak kosong;
 *   cacatAbt     nilai ABT memuat kata kendali RTF yang tercetak sebagai teks (mis. "rowd rqc rgaph85") atau karakter kendali: cacat ABT,
 *                ALETA mencetak yang benar dan TIDAK meniru kesalahannya;
 *   waktuHabis   mesin ALETA kehabisan waktu kueri (mesin sibuk): BUKAN beda isi, tetapi juga bukan cocok; dihitung terpisah dan diukur ulang.
 * Selain itu "" (beda isi yang belum dijelaskan).
 */
/** Urutan bita UTF-8 yang terbaca sebagai huruf latin1 diubah kembali menjadi hurufnya; huruf latin1 tunggal (mis. "±") dibiarkan. */
export function perbaikiMojibake(t) {
  return t.replace(/[Â-ô][\u0080-¿]{1,3}/g, (m) => {
    const u = Buffer.from(m, "latin1").toString("utf8");
    return u.includes("�") ? m : u;
  });
}

export function kelasDijelaskan(x, y, kosongMesin) {
  const sebab = String(kosongMesin || "");
  if (/inactivity timeout|timeout|ETIMEDOUT|PROTOCOL_SEQUENCE_TIMEOUT/i.test(sebab)) return "waktuHabis";
  if (/(^|\s)(rowd|trqc|trgaph\d+|trleft\d+|cellx\d+|pardintbl\w*)(\s|$)/.test(y) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(String(y))) return "cacatAbt";
  // Mojibake ABT: nilai berisi huruf UTF-8 (mis. tanda pisah "–") yang diteruskan PHP sebagai bita mentah lalu dibaca sebagai latin1 ("â").
  // Dikenali hanya bila membaca bita ABT sebagai UTF-8 menghasilkan PERSIS nilai ALETA.
  if (y !== x && perbaikiMojibake(String(y)) === x) return "cacatAbt";
  if (y === "" && sebab.startsWith("kosong") && /^[.…\s]+$/.test(x)) return "tandaKosong";
  return "";
}

function banding([perkaraF, kodeF, dirM, dirA, keluar]) {
  const kode = daftarKode(kodeF);
  const perkara = daftarPerkara(perkaraF);
  const ringkas = { perkara: 0, per_jenis: {}, per_isian: {}, selisih: [] };
  const isian = Object.fromEntries(kode.map((k) => [k, { cocok: 0, spasi: 0, beda: 0 }]));
  for (const [pid, tag, jenis] of perkara) {
    const fm = path.join(dirM, `p${pid}.json`);
    const fa = path.join(dirA, `p${pid}.json`);
    if (!fs.existsSync(fm) || !fs.existsSync(fa)) continue;
    const mm = JSON.parse(baca(fm));
    const m = mm.teks;
    const a = JSON.parse(baca(fa)).nilai;
    const kode = kodePid(pid, kodeF).daftar;
    const j = (ringkas.per_jenis[jenis] ||= { perkara: 0, nilai: 0, cocok: 0, spasi: 0, beda: 0, tandaKosong: 0, cacatAbt: 0, waktuHabis: 0 });
    j.perkara += 1;
    ringkas.perkara += 1;
    for (const k of kode) {
      const x = norm(m[k]);
      const y = norm(a[k]);
      j.nilai += 1;
      if (x === y) {
        j.cocok += 1;
        isian[k].cocok += 1;
      } else if (longgar(x) === longgar(y)) {
        j.spasi += 1;
        isian[k].spasi += 1;
      } else if (kelasDijelaskan(x, y, mm.kosong[k])) {
        // Beda yang sebabnya sudah dikenal (Tahap 8): dihitung terpisah, tidak digabung ke "cocok", dan tetap tercatat di selisih.
        const kelas = kelasDijelaskan(x, y, mm.kosong[k]);
        if (kelas === "tandaKosong") j.tandaKosong += 1;
        else if (kelas === "cacatAbt") j.cacatAbt += 1;
        else j.waktuHabis += 1;
        isian[k][kelas] = (isian[k][kelas] || 0) + 1;
        ringkas.selisih.push({ perkara: pid, tag, jenis, isian: k, kelas, status: mm.kosong[k] ? "kosong" : "terisi", sebabMesin: mm.kosong[k] || "", panjangMesin: x.length, panjangAbt: y.length });
      } else {
        j.beda += 1;
        isian[k].beda += 1;
        let i = 0;
        while (i < x.length && i < y.length && x[i] === y[i]) i += 1;
        const potong = (t) => t.slice(Math.max(0, i - 50), i + 70);
        ringkas.selisih.push({ perkara: pid, tag, jenis, isian: k, status: mm.kosong[k] ? "kosong" : "terisi", sebabMesin: mm.kosong[k] || "", pertamaBeda: i, panjangMesin: x.length, panjangAbt: y.length, mesin: potong(x), abt: potong(y) });
      }
    }
  }
  ringkas.per_isian = isian;
  fs.writeFileSync(keluar, JSON.stringify(ringkas, null, 1));
  for (const [jn, j] of Object.entries(ringkas.per_jenis)) {
    console.log(jn, "perkara", j.perkara, "nilai", j.nilai, "cocok", j.cocok, "cocok-kecuali-spasi", j.spasi, "beda", j.beda, "persen", ((100 * (j.cocok + j.spasi)) / j.nilai).toFixed(2), "persen-ketat", ((100 * j.cocok) / j.nilai).toFixed(2));
  }
  const bedaIsian = Object.entries(isian).filter(([, v]) => v.beda > 0);
  console.log("isian dengan selisih isi:", bedaIsian.length, "dari", kode.length);
}

const [cmd, ...arg] = process.argv.slice(2);
const peta = { pilih, mesin, abt, banding, "dari-mentah": dariMentah };
if (!peta[cmd]) {
  console.error("perintah: pilih | mesin | abt | dari-mentah | banding");
  process.exit(2);
}
await peta[cmd](arg);
