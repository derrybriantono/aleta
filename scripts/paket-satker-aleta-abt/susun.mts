/**
 * SUSUN PAKET INDUK ALETA ABT UNTUK SATKER LAIN (Tahap 8). HANYA MEMBACA: pohon blangko Derry (folder) dan katalog isian ABT salinan uji
 * (sipp_vs + aps_badilag_vs, keduanya wajib berakhiran _vs). Menulis hanya ke folder keluaran (di luar repo).
 *
 * Keluaran:   <keluar>/manifest.json   potret pustaka (server "induk"), isian SUDAH DINETRALKAN dari isi khas satu satker, sidik paket
 *             <keluar>/blangko/<jalur> blangko RTF apa adanya (folder "terhapus" tidak ikut)
 *             <keluar>/fungsi/*.sql    fungsi basis data yang dipanggil rumus isian (tanpa DEFINER); semua.sql = semuanya, siap dipasang administrator
 *
 * Jalankan dari manajemen_surat/:
 *   POHON_AKAR=<folder yang memuat derry_briantono> npx tsx ../scripts/paket-satker-aleta-abt/susun.mts <keluar>
 *
 * Tidak ada data pihak di paket: hanya blangko, definisi isian, dan nama-nama isian yang perlu disesuaikan satker. Pemasangan memakai
 * pasangPaketInduk (src/server/modules/aleta-abt-satker/paket.ts); skrip ini tidak memasang ke mana pun.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FORMAT_PAKET, SERVER_INDUK, netralkanVariabelInduk, perluDisesuaikan, sidikPaket, type ManifestPaket, type PerubahanNetral } from "@/lib/aleta-abt-satker";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const AKAR = path.join(SINI, "..", "..");
const req = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
const SIPP = process.env.SIPP_DB || "sipp_vs";
const ABT = process.env.ABT_DB || "aps_badilag_vs";
const POHON_AKAR = process.env.POHON_AKAR || "D:/aleta-dev/kerja/audit-abt-4nov/pohon";

if (!/_vs$/.test(SIPP) || !/_vs$/.test(ABT)) {
  console.error(`Berhenti: SIPP_DB=${SIPP} dan ABT_DB=${ABT} bukan pasangan salinan uji (_vs). Skrip ini tidak boleh membaca basis data lain.`);
  process.exit(2);
}
const keluar = process.argv[2];
if (!keluar) {
  console.error("pakai: susun.mts <folder keluaran>");
  process.exit(2);
}
if (fs.existsSync(path.join(keluar, "manifest.json"))) {
  console.error(`Berhenti: ${keluar} sudah berisi paket. Pilih folder kosong.`);
  process.exit(2);
}

const mysql = req("mysql");
const kolam = mysql.createPool({ host: "127.0.0.1", user: "root", database: SIPP, connectionLimit: 2, multipleStatements: false });
const kueri = (sql: string, params: unknown[] = []) =>
  new Promise<Array<Record<string, unknown>>>((ok, gagal) =>
    kolam.query({ sql: String(sql).replace(/\baps_badilag\./g, `${ABT}.`), values: params, timeout: 120000, typeCast: (f: { string: () => string }) => f.string() }, (g: Error | null, r: Array<Record<string, unknown>>) => (g ? gagal(g) : ok(r)))
  );

const { buatPustaka } = req(path.join(AKAR, "aleta_bot", "services", "pustakaAbtDerryService.js")) as {
  buatPustaka: (d: Record<string, unknown>) => { potret: () => Promise<Record<string, unknown>>; isi: (j: string[]) => Promise<{ berkas: Array<{ jalur: string; md5: string; ukuran: number; isi: string }>; ditolak: string[]; lewat: string[] }> };
};

const pustaka = buatPustaka({ kueri, akarBlangko: POHON_AKAR, skemaAbt: ABT });
const potret = (await pustaka.potret()) as { berkas: Array<{ jalur: string; folder: string; md5: string; ukuran: number }>; variabel: Array<Record<string, unknown>>; takDikenal?: string[] };

const berkas = potret.berkas.filter((b) => b.folder !== "terhapus");
fs.mkdirSync(path.join(keluar, "blangko"), { recursive: true });
let tertulis = 0;
let sisa = berkas.map((b) => b.jalur);
while (sisa.length) {
  const jawab = await pustaka.isi(sisa.slice(0, 120));
  const ambil = new Set(jawab.berkas.map((b) => b.jalur));
  for (const b of jawab.berkas) {
    const tujuan = path.join(keluar, "blangko", ...b.jalur.split("/"));
    fs.mkdirSync(path.dirname(tujuan), { recursive: true });
    fs.writeFileSync(tujuan, Buffer.from(b.isi, "base64"));
    tertulis += 1;
  }
  const ditolak = new Set(jawab.ditolak);
  const lanjut = sisa.slice(0, 120).filter((j) => !ambil.has(j) && !ditolak.has(j));
  if (ditolak.size) throw new Error(`berkas ditolak/tidak terbaca: ${[...ditolak].slice(0, 3).join(", ")}`);
  sisa = [...lanjut, ...sisa.slice(120)];
}

// Fungsi basis data Derry (dibuat di skema ABT; rumus isian memanggilnya sebagai aps_badilag.isian_*). Dibaca saja, tanpa DEFINER.
const daftarFungsi = await kueri("SELECT ROUTINE_NAME AS nama FROM information_schema.routines WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'FUNCTION' ORDER BY ROUTINE_NAME", [ABT]);
fs.mkdirSync(path.join(keluar, "fungsi"), { recursive: true });
const fungsi: Array<{ nama: string; md5: string; ukuran: number }> = [];
const semuaSql: string[] = ["-- Fungsi basis data Derry untuk rumus isian ALETA ABT. Pasang di skema bernama aps_badilag pada MariaDB satker (oleh administrator basis data).", "DELIMITER $$"];
for (const { nama } of daftarFungsi) {
  const n = String(nama);
  const r = await kueri(`SHOW CREATE FUNCTION \`${ABT}\`.\`${n}\``);
  const definisi = String(r[0]?.["Create Function"] ?? "").replace(/^CREATE DEFINER=`[^`]*`@`[^`]*` FUNCTION/, "CREATE FUNCTION").replace(/\r\n/g, "\n");
  if (!/^CREATE FUNCTION/.test(definisi)) throw new Error(`definisi fungsi ${n} tidak terbaca`);
  const teks = `DROP FUNCTION IF EXISTS \`${n}\`$$\n${definisi}$$\n`;
  const bita = Buffer.from(teks, "latin1");
  fs.writeFileSync(path.join(keluar, "fungsi", `${n}.sql`), bita);
  fungsi.push({ nama: n, md5: createHash("md5").update(bita).digest("hex"), ukuran: bita.length });
  semuaSql.push(teks.trimEnd());
}
semuaSql.push("DELIMITER ;");
fs.writeFileSync(path.join(keluar, "fungsi", "semua.sql"), semuaSql.join("\n") + "\n", "latin1");

const perubahan: PerubahanNetral[] = [];
const variabel = potret.variabel.map((v) => {
  const n = netralkanVariabelInduk({ no: String(v.no), sql_query: (v.sql_query as string | null) ?? null, default_data: (v.default_data as string | null) ?? null });
  perubahan.push(...n.perubahan);
  return { ...v, sql_query: n.variabel.sql_query, default_data: n.variabel.default_data, modifier: "", modified: "" };
});

const manifest: ManifestPaket = {
  format: FORMAT_PAKET,
  dibuat: new Date().toISOString(),
  server: SERVER_INDUK,
  berkas: berkas.map((b) => ({ ...(b as unknown as ManifestPaket["berkas"][number]) })),
  fungsi,
  variabel,
  takDikenal: potret.takDikenal ?? [],
  perubahan,
  perluDisesuaikan: perluDisesuaikan(variabel as unknown as Array<{ no: string; sql_query: string | null; default_data: string | null }>),
  sidik: "",
};
manifest.sidik = sidikPaket(manifest.berkas, manifest.variabel, manifest.fungsi);
fs.writeFileSync(path.join(keluar, "manifest.json"), JSON.stringify(manifest));
console.log(
  `paket induk: ${manifest.berkas.length} blangko (${tertulis} ditulis), ${manifest.variabel.length} isian, ${fungsi.length} fungsi basis data, ${perubahan.length} perubahan netral (${perubahan.filter((p) => p.jenis === "cabang-satker").length} cabang satker, ${perubahan.filter((p) => p.jenis === "kode-surat").length} kode surat), ${manifest.perluDisesuaikan.length} isian perlu disesuaikan satker (${manifest.perluDisesuaikan.join(", ")}), tak dikenal ${manifest.takDikenal.length}; sidik ${manifest.sidik}`
);
kolam.end();
