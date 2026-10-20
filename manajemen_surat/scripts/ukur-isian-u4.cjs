#!/usr/bin/env node
/**
 * Ukur deteksi isian ABT dari posita untuk DISPENSASI KAWIN / WALI ADHAL / PERWALIAN terhadap isian MANUSIA (abt_data_teks / abt_data_tanggal).
 *
 *   node scripts/ukur-isian-u4.cjs [folder-data] [dk|wa|pw] [--kode=NNNN] [--salah] [--json=berkas]
 *
 * folder-data (bawaan D:/Aplikasi/aleta/tmp/u4) berisi all_<jenis>.tsv (perkara_id, nomor, tgl, alur, posita, petitum),
 * gt_teks_<jenis>.tsv dan gt_tgl_<jenis>.tsv (perkara_id, no_var, data) - semuanya tarikan BACA-SAJA dari server.
 * Keluaran per kode: n isian manusia, n terdeteksi, cocok, salah, tidak terdeteksi; per tingkat yakin. Kecocokan: sama setelah
 * dinormalkan, saling memuat, atau angka sama.
 */
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const Deteksi = require(path.join(REPO, "aleta_bot", "services", "deteksi", "index.js"));
const S5 = require(path.join(REPO, "aleta_bot", "services", "isiOtomatisJenisS5.js"));

const args = process.argv.slice(2);
const DIR = args.find((a) => !a.startsWith("--") && !["dk", "wa", "pw"].includes(a)) || "D:/Aplikasi/aleta/tmp/u4";
const PILIH = args.filter((a) => ["dk", "wa", "pw"].includes(a));
const KODE = (args.find((a) => a.startsWith("--kode=")) || "").slice(7);
const SALAH = args.includes("--salah");
const JSON_KELUAR = (args.find((a) => a.startsWith("--json=")) || "").slice(7);

const JENIS = { dk: { id: "362" }, wa: { id: "363" }, pw: { id: "354" } };

function buka(s) {
  let o = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) {
      const n = s[i + 1];
      if (n === "n") { o += "\n"; i++; continue; }
      if (n === "t") { o += "\t"; i++; continue; }
      if (n === "\\") { o += "\\"; i++; continue; }
      if (n === "0") { i++; continue; }
    }
    o += c;
  }
  return o;
}
function tsv(berkas) {
  if (!fs.existsSync(berkas)) return [];
  const baris = fs.readFileSync(berkas, "utf8").split("\n").filter(Boolean);
  return baris.slice(1).map((l) => l.split("\t").map((v) => (v === "NULL" ? "" : buka(v))));
}
const norm = (t) => String(t || "").toLowerCase().replace(/<[^>]*>/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const angka = (t) => (String(t || "").match(/\d+/g) || []).join("|");
const BLN = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
function tglIso(t) {
  const s = String(t || "");
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(s);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  m = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(s);
  if (m) {
    const b = BLN.indexOf(m[2].toLowerCase());
    if (b >= 0) return `${m[3]}-${String(b + 1).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  }
  return "";
}
function cocok(a, b) {
  const ia = tglIso(a), ib = tglIso(b);
  if (ia && ib) return ia === ib;
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const ax = angka(a), ay = angka(b);
  return Boolean(ax) && ax === ay && Math.abs(x.length - y.length) < 25;
}

function dataSipp(kunci, J, p) {
  const baca = (f) => tsv(path.join(DIR, f));
  if (!dataSipp.cache) {
    const kolom = (rows, nama) => rows.map((c) => Object.fromEntries(nama.map((n, i) => [n, c[i]])));
    dataSipp.cache = {
      mempelai: kolom(baca("sipp_dk_mempelai.tsv"), ["perkara_id", "nama", "lahir", "tempat", "pendidikan", "jenis", "pekerjaan", "nominal", "dimohonkan", "nik"]),
      pihak1: {},
      alasan: kolom(baca("sipp_alasan.tsv"), ["perkara_id", "alasanId", "nama"]),
    };
    for (const j of ["362", "363", "354"]) dataSipp.cache.pihak1[j] = kolom(baca(`sipp_p1_${j}.tsv`), ["perkara_id", "urutan", "nama", "tempat", "lahir", "statusKawin", "pekerjaan", "pendidikan", "jk"]);
  }
  const c = dataSipp.cache;
  return {
    perkaraId: Number(p.id),
    perkara: { nomor: p.no, jenisId: Number(J.id), alurId: Number(p.alur), posita: p.posita, petitum: p.petitum, tanggalDaftar: p.tgl },
    pihak1: c.pihak1[J.id].filter((x) => x.perkara_id === p.id),
    pihak2: [],
    mempelai: c.mempelai.filter((x) => x.perkara_id === p.id).map((x) => ({ ...x, dimohonkan: x.dimohonkan === "" ? null : x.dimohonkan })),
    anak: [],
    nikah: null,
    itsbat: null,
    alasanNikah: c.alasan.filter((x) => x.perkara_id === p.id),
  };
}

const keluar = {};
for (const kunci of PILIH.length ? PILIH : Object.keys(JENIS)) {
  const J = JENIS[kunci];
  const perkara = tsv(path.join(DIR, `all_${J.id}.tsv`)).map((c) => ({ id: c[0], no: c[1], tgl: c[2], alur: c[3], posita: c[4], petitum: c[5] }));
  const gt = {};
  for (const [pid, kode, data] of [...tsv(path.join(DIR, `gt_teks_${J.id}.tsv`)), ...tsv(path.join(DIR, `gt_tgl_${J.id}.tsv`))]) {
    const k = String(kode).padStart(4, "0");
    (gt[k] = gt[k] || {})[pid] = data;
  }
  const hasil = {};
  for (const p of perkara) {
    const u = Deteksi.usulanModul(J.id, `${p.posita}\n${p.petitum}`, { petitum: p.petitum, tanggalDaftar: p.tgl });
    const peta = {};
    for (const x of u) peta[String(x.kode).padStart(4, "0")] = x;
    if (!args.includes("--tanpa-sipp")) {
      let tambah = [];
      try {
        tambah = S5.usulanDariData(dataSipp(kunci, J, p));
      } catch (e) {
        if (!dataSipp.galat) { dataSipp.galat = true; console.log("galat S5:", e.message); }
      }
      for (const x of tambah) {
        const k = String(x.kode).padStart(4, "0");
        const lama = peta[k];
        peta[k] = lama && lama.nilai && lama.keyakinan === "cukup" && x.keyakinan === "ragu" ? lama : x;
      }
    }
    const kodeSemua = new Set([...Object.keys(peta), ...Object.keys(gt)]);
    for (const k of kodeSemua) {
      if (KODE && k !== KODE) continue;
      const h = (hasil[k] = hasil[k] || { gt: 0, deteksi: 0, cocok: 0, salah: 0, hilang: 0, tanpaGt: 0, yakin: {}, contohSalah: [] });
      const manusia = gt[k] && gt[k][p.id];
      const mesin = peta[k];
      if (manusia) h.gt += 1;
      if (mesin) h.deteksi += 1;
      if (manusia && mesin) {
        const y = (h.yakin[mesin.keyakinan] = h.yakin[mesin.keyakinan] || { n: 0, cocok: 0 });
        y.n += 1;
        if (cocok(manusia, mesin.nilai)) { h.cocok += 1; y.cocok += 1; }
        else { h.salah += 1; if (h.contohSalah.length < 6) h.contohSalah.push(`${p.no}: manusia="${String(manusia).slice(0, 70)}" mesin="${String(mesin.nilai).slice(0, 70)}"`); }
      } else if (manusia && !mesin) h.hilang += 1;
      else if (!manusia && mesin) h.tanpaGt += 1;
    }
  }
  keluar[kunci] = { perkara: perkara.length, kode: hasil };
  console.log(`\n== ${kunci.toUpperCase()} (${perkara.length} perkara, jenis ${J.id})`);
  console.log("kode  n-manusia  terdeteksi  cocok  salah  hilang  mesin-tanpa-isian-manusia   presisi(cocok/(cocok+salah))");
  for (const [k, h] of Object.entries(hasil).sort()) {
    if (!h.gt && !h.deteksi) continue;
    if (!h.gt && !KODE && h.deteksi < 3) continue;
    const pres = h.cocok + h.salah ? ((100 * h.cocok) / (h.cocok + h.salah)).toFixed(0) + "%" : "-";
    console.log(`${k}  ${String(h.gt).padStart(8)}  ${String(h.deteksi).padStart(10)}  ${String(h.cocok).padStart(5)}  ${String(h.salah).padStart(5)}  ${String(h.hilang).padStart(6)}  ${String(h.tanpaGt).padStart(10)}                  ${pres}   ${JSON.stringify(h.yakin)}`);
    if (SALAH) for (const c of h.contohSalah) console.log("      salah:", c);
  }
}
if (JSON_KELUAR) fs.writeFileSync(JSON_KELUAR, JSON.stringify(keluar, null, 1));
