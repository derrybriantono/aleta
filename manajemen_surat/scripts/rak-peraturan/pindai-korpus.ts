/**
 * Pindai rujukan pasal di korpus ALETA (P1 rak peraturan, 1 Nov 2026) - BACA SAJA.
 *
 *   npx tsx scripts/rak-peraturan/pindai-korpus.ts <pohon RTF derry_briantono> <variabel-b64.tsv> <keluaran.json>
 *
 * Sumber: blangko RTF Derry (pohon sesudah semua paket), kueri variabel ABT (no_var, base64 nama, base64 sql_query - dari
 * `SELECT no_var, TO_BASE64(nama), TO_BASE64(sql_query)`), katalog saksi (ekstensi-sipp/saksi-katalog), kode deteksi bot
 * (aleta_bot/services/deteksi, aleta_bot/kamus-deteksi) dan layanan bot yang memuat dasar hukum.
 * Variabel padanan RBg/HIR (#11851#-#11899#, #12000#-#12019#) di RTF diganti nilai RBg (satker Donggala) sebelum dipindai.
 * Keluaran: daftar rujukan per sumber (dipakai susun_rak.py dan periksa-korpus.ts).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { bacaRtfDariBita } from "../../src/lib/baca-rtf";
import { temukanRujukan, type Rujukan } from "../../src/lib/rak-peraturan/rujukan";

const [, , pohon, tsv, keluar] = process.argv;
if (!pohon || !tsv || !keluar) {
  console.error("pakai: pindai-korpus.ts <pohon RTF> <variabel-b64.tsv> <keluaran.json>");
  process.exit(2);
}
const AKAR = path.resolve(__dirname, "../../..");

const dariB64 = (s: string) => Buffer.from(String(s || "").replace(/\\n/g, ""), "base64").toString("utf8");
const variabel = new Map<string, { nama: string; sql: string }>();
for (const baris of readFileSync(tsv, "utf8").split(/\r?\n/)) {
  if (!baris.trim()) continue;
  const [no, n64, q64] = baris.split("\t");
  variabel.set(String(+no), { nama: dariB64(n64), sql: dariB64(q64) });
}
/** Nilai RBg variabel padanan: SELECT IF('#11850#' = 'HIR', '<hir>', '<rbg>') AS data */
const nilaiRbg = new Map<string, string>();
for (const [no, v] of variabel) {
  const m = v.sql.match(/^\s*SELECT\s+IF\('#11850#'\s*=\s*'HIR',\s*'([^']*)',\s*'([^']*)'\)\s+AS\s+data\s*$/i);
  if (m) nilaiRbg.set(no, m[2]);
}

type Catatan = { sumber: string; jenis: string; rujukan: Array<Omit<Rujukan, "mulai" | "akhir"> & { letak: number }> };
const hasil: Catatan[] = [];
const simpan = (sumber: string, jenis: string, teks: string) => {
  const r = temukanRujukan(teks);
  if (r.length) hasil.push({ sumber, jenis, rujukan: r.map(({ mulai, akhir: _a, ...x }) => ({ ...x, letak: mulai })) });
};

function jalan(d: string, cocok: (f: string) => boolean, f: (p: string) => void) {
  for (const n of readdirSync(d)) {
    const p = path.join(d, n);
    const st = statSync(p);
    if (st.isDirectory()) jalan(p, cocok, f);
    else if (cocok(n)) f(p);
  }
}

const mulai = Date.now();
let nRtf = 0;
jalan(pohon, (n) => /\.rtf$/i.test(n), (p) => {
  nRtf++;
  let t = bacaRtfDariBita(new Uint8Array(readFileSync(p)));
  t = t.replace(/#(\d{4,5})#/g, (m, no) => nilaiRbg.get(String(+no)) ?? m);
  simpan(path.relative(pohon, p).replace(/\\/g, "/"), "blangko", t);
});
for (const [no, v] of variabel) {
  if (!/pasal/i.test(v.sql)) continue;
  const t = v.sql.replace(/#(\d{4,5})#/g, (m, n) => nilaiRbg.get(String(+n)) ?? m).replace(/<br\s*\/?>/gi, "\n");
  simpan(`variabel ${no} ${v.nama.slice(0, 80)}`, "variabel", t);
}
const KATALOG = path.join(AKAR, "ekstensi-sipp/saksi-katalog");
for (const n of readdirSync(KATALOG).filter((x) => x.endsWith(".json")).sort()) {
  const d = JSON.parse(readFileSync(path.join(KATALOG, n), "utf8"));
  for (const dh of Array.isArray(d.dasarHukum) ? d.dasarHukum : []) {
    simpan(`katalog ${n} ${dh.id}`, "katalog", `${dh.rujukan}\n${dh.uraian}`);
  }
}
for (const dir of ["aleta_bot/services/deteksi", "aleta_bot/kamus-deteksi", "aleta_bot/services"]) {
  const d = path.join(AKAR, dir);
  jalan(
    d,
    (n) => /\.(js|json)$/i.test(n),
    (p) => {
      if (dir === "aleta_bot/services" && path.dirname(p) !== d) return; // hanya berkas langsung (subfolder deteksi sudah)
      simpan(path.relative(AKAR, p).replace(/\\/g, "/"), "deteksi", readFileSync(p, "utf8"));
    }
  );
}
writeFileSync(keluar, JSON.stringify({ dibuat: new Date().toISOString(), pohon, nRtf, sumber: hasil }, null, 0));
const nr = hasil.reduce((a, x) => a + x.rujukan.length, 0);
console.log(`RTF ${nRtf}, sumber berujukan ${hasil.length}, rujukan ${nr}, ${((Date.now() - mulai) / 1000).toFixed(1)} dtk`);
