/**
 * Periksa kutipan dasar hukum seluruh blangko Derry (P1, 1 Nov 2026) - BACA SAJA, tidak mengubah blangko.
 *
 *   npx tsx scripts/rak-peraturan/periksa-korpus.ts <pohon RTF derry_briantono> <variabel-b64.tsv> <keluaran.tsv>
 *
 * Keluaran TSV: jenis, pasti, rujukan, pesan, jumlah, contoh berkas - temuan TERVERIFIKASI (pasti) lebih dulu. Juga mengukur
 * waktu periksa per naskah (naskah terpanjang dicetak) untuk laporan kinerja.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { bacaRtfDariBita } from "../../src/lib/baca-rtf";
import { indeksRak, periksaNaskah } from "../../src/lib/rak-peraturan/indeks";
import { jenisInfo } from "../../src/lib/rak-peraturan/periksa";

const [, , pohon, tsv, keluar] = process.argv;
const dariB64 = (s: string) => Buffer.from(String(s || "").replace(/\\n/g, ""), "base64").toString("utf8");
const nilaiRbg = new Map<string, string>();
for (const baris of readFileSync(tsv, "utf8").split(/\r?\n/)) {
  const [no, , q64] = baris.split("\t");
  if (!q64) continue;
  const m = dariB64(q64).match(/^\s*SELECT\s+IF\('#11850#'\s*=\s*'HIR',\s*'([^']*)',\s*'([^']*)'\)\s+AS\s+data\s*$/i);
  if (m) nilaiRbg.set(String(+no), m[2]);
}
const t0 = performance.now();
indeksRak();
const tIndeks = performance.now() - t0;

type Gabung = { jenis: string; pasti: boolean; rujukan: string; pesan: string; jumlah: number; berkas: Set<string> };
const gabung = new Map<string, Gabung>();
let terlama = { ms: 0, berkas: "", panjang: 0 };
let total = 0;
let n = 0;
function jalan(d: string) {
  for (const nm of readdirSync(d)) {
    const p = path.join(d, nm);
    if (statSync(p).isDirectory()) {
      jalan(p);
      continue;
    }
    if (!/\.rtf$/i.test(nm)) continue;
    const t = bacaRtfDariBita(new Uint8Array(readFileSync(p))).replace(/#(\d{4,5})#/g, (m, no) => nilaiRbg.get(String(+no)) ?? m);
    const a = performance.now();
    const temuan = periksaNaskah(t);
    const ms = performance.now() - a;
    total += ms;
    n++;
    const rel = path.relative(pohon, p).replace(/\\/g, "/");
    if (ms > terlama.ms) terlama = { ms, berkas: rel, panjang: t.length };
    for (const x of temuan) {
      const k = `${x.jenis}|${x.pesan}`;
      const g = gabung.get(k) || { jenis: x.jenis, pasti: x.pasti, rujukan: x.rujukan, pesan: x.pesan, jumlah: 0, berkas: new Set<string>() };
      g.jumlah += x.jumlah;
      g.berkas.add(rel);
      gabung.set(k, g);
    }
  }
}
jalan(pohon);
const baris = [...gabung.values()].sort(
  (a, b) => Number(jenisInfo(a.jenis as never)) - Number(jenisInfo(b.jenis as never)) || Number(b.pasti) - Number(a.pasti) || a.jenis.localeCompare(b.jenis) || b.berkas.size - a.berkas.size
);
const esc = (s: string) => s.replace(/[\t\r\n]+/g, " ");
writeFileSync(
  keluar,
  ["jenis\tpasti\trujukan\tpesan\tkemunculan\tberkas\tcontoh berkas"]
    .concat(baris.map((g) => [g.jenis, g.pasti ? "ya" : "tidak", esc(g.rujukan), esc(g.pesan), g.jumlah, g.berkas.size, [...g.berkas].slice(0, 3).join(" | ")].join("\t")))
    .join("\n") + "\n",
  "utf8"
);
const per = new Map<string, number>();
for (const g of baris) per.set(`${g.jenis}${g.pasti ? "" : " (tidak pasti)"}`, (per.get(`${g.jenis}${g.pasti ? "" : " (tidak pasti)"}`) || 0) + 1);
console.log(`indeks ${tIndeks.toFixed(1)} ms; ${n} naskah, rata-rata ${(total / n).toFixed(2)} ms, terlama ${terlama.ms.toFixed(1)} ms (${terlama.panjang} aksara, ${terlama.berkas})`);
console.log([...per.entries()].map(([k, v]) => `${k}: ${v}`).join("; "));
