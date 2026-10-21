// Fixture uji src/test/tuntutan-perluasan-21okt.test.ts: penanda tabel ABT (bot penandaUrutAbt) blangko Derry server SESUDAH tambalan
// RTF paket x4 + katalog abt_variabel lab (paket x4 terpasang) dipadatkan ke rujukannya (#NNNN# dan "no_var = NNNN") - cukup untuk
// susunIsian (portal hanya membaca rujukan dari kueri). Tanpa data perkara.
// pakai (dari manajemen_surat/): npx tsx ../abt-paket/x4-tuntutan-perluasan-21okt/alat/buat_fixture.ts
import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(process.cwd(), "..");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { penandaUrutAbt } = require(path.join(REPO, "aleta_bot/services/abtMesinVariabel.js"));
const AKAR = "D:/Aplikasi/aleta/tmp/w26/rtf-server/derry_briantono";
const TIMPA = "D:/Aplikasi/aleta/tmp/w26/rtf-hasil/derry_briantono";
const P = "\\\\?\\";
const baca = (rel: string) => {
  const t = `${TIMPA}/${rel}`;
  const f = fs.existsSync(P + t.replace(/\//g, "\\")) ? t : `${AKAR}/${rel}`;
  return fs.readFileSync(P + f.replace(/\//g, "\\"), "latin1");
};
const BLANGKO = [
  "1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap).rtf",
  "1 Perceraian CG/[01a] [Kabul Verstek] Cerai - Alasan E (Qabla Ad Dukhul).rtf",
  "1 Perceraian CG/[01d] [Kabul Verstek] Cerai (Format Lengkap) - Kumulasi Nafkah Istri (Madliyah, Iddah, Mutah).rtf",
  "1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah.rtf",
  "1a Perceraian CT/[01a] [Kabul Verstek] CT - F (Ex Offiicio mutah iddah dan nafkah anak).rtf",
  "1a Perceraian CT/[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).rtf",
  "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[01] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak - Anak Belum Mumayyiz.rtf",
  "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[02b] [Kabul] Putusan CG Kumulasi Hak Asuh dan Nafkah Anak - Kontradiktoir.rtf",
  "1f Hak Bekas Istri/[01b] [Kabul Verstek] Hak Bekas Istri.rtf",
  "4a Harta Bersama/[01b] [Kabul Verstek] HB.rtf",
  "4a Harta Bersama/[01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvensi Sita Jaminan.rtf",
  "6a Hak Asuh Anak (Hadhanah)/[02b] [Kabul Verstek] Hak Asuh dan Nafkah Anak - Anak Belum Mumayyiz.rtf",
  "6c Nafkah Anak/[01b] [Kabul Verstek] Nafkah Anak.rtf",
  "8 Asal Usul Anak/",
  "1e Kelalaian Kewajiban Suami Istri/[01b] [Kabul Verstek] Kelalaian Kewajiban Suami Istri.rtf",
  "6h Nafkah Anak oleh Ibu/[01b] [Kabul Verstek] Nafkah Anak oleh Ibu.rtf",
  "ALUR 10 Cerai Talak Sidang Ikrar Talak/",
];
function jalan(d: string, out: string[]) {
  for (const e of fs.readdirSync(P + d.replace(/\//g, "\\"), { withFileTypes: true })) {
    const p = d + "/" + e.name;
    if (e.isDirectory()) jalan(p, out);
    else if (/\.rtf$/i.test(e.name)) out.push(path.relative(AKAR, p).replace(/\\/g, "/"));
  }
}
const semua: string[] = [];
jalan(AKAR, semua);
const pilih: string[] = [];
for (const b of BLANGKO) {
  const c = semua.filter((r) => (b.endsWith("/") ? r.startsWith(b) : r === b)).sort();
  if (!c.length) throw new Error("tidak ada " + b);
  pilih.push(...(b.endsWith("/") ? c.filter((r) => /\[01\]|Ada Beban/.test(r)).slice(0, 2) : c));
}
const vars = JSON.parse(fs.readFileSync("D:/Aplikasi/aleta/tmp/w26/var_lab_x4.json", "utf8"));
const peta = new Map<string, { nama: string; jenis: string; sql: string; bawaan: string }>();
for (const v of vars) peta.set(String(v.no_var).padStart(4, "0"), { nama: v.nama || "", jenis: v.data_type || "", sql: v.sql_query || "", bawaan: v.default_data || "" });
const padat = (s: string) => {
  const r = new Set<string>();
  for (const m of s.matchAll(/#(\d{4,5})#/g)) r.add(`#${m[1]}#`);
  for (const m of s.matchAll(/no_var\s*(?:=|in\s*\()\s*['"]?(\d{4,5})/gi)) r.add(`no_var = ${m[1]}`);
  return [...r].join(" ");
};
const blangko = pilih.map((rel) => ({ berkas: rel, penandaAbt: (penandaUrutAbt(baca(rel)) as string[]).filter((k) => /^\d{3,5}$/.test(k)) }));
// katalog: semua yang dicapai dari penanda blangko terpilih (penutup rujukan) + pemicu tuntutan
const katalog: Record<string, { nama: string; jenis: string; sql: string; bawaan: string }> = {};
const tumpuk = [...new Set(blangko.flatMap((b) => b.penandaAbt)), "3400", ..."3401 3402 3403 3404 3405 3406 3407 3408 3430 3431 3432 3433 3434 3435 3440 3441 3442 3443 3444 3445 3446 3447 3448 4140 4141 4142 4143 4144 4145 4788 4789 4790 4791 4845 4846 4847".split(" ")];
while (tumpuk.length) {
  const k = tumpuk.shift() as string;
  if (katalog[k] || !peta.has(k)) continue;
  const d = peta.get(k)!;
  katalog[k] = { nama: d.nama, jenis: d.jenis, sql: padat(d.sql), bawaan: d.bawaan };
  for (const m of `${katalog[k].sql}\n${d.bawaan}`.matchAll(/#(\d{4,5})#|no_var = (\d{4,5})/g)) tumpuk.push(m[1] || m[2]);
}
const keluar = path.join(REPO, "manajemen_surat/src/test/fixtures/tuntutan-perluasan-21okt.json");
fs.writeFileSync(keluar, JSON.stringify({ sumber: "server 21 Okt 2026 sesudah x1-x3: RTF derry_briantono + tambalan paket x4; abt_variabel lab dengan paket x4 (kueri dipadatkan ke rujukan)", blangko, katalog }));
console.log(blangko.length, "blangko", Object.keys(katalog).length, "variabel", keluar);
