/**
 * UJI PASANG PADA SALINAN BERSIH TANPA ABT DERRY (Tahap 8) - sebatas yang dapat dilakukan di laptop.
 *
 * "Salinan bersih" di sini = database ALETA KOSONG (pg-mem, di memori) tempat paket induk dipasang lewat kode pemasangan yang sama dengan
 * produksi (pasangPaketInduk), lalu SEMUA blangko di database itu disusun untuk beberapa perkara. Yang dibuat bersih:
 *   - ABT: mesin dijalankan dalam mode tanpa ABT (jalurAleta.tanpaAbt): tidak satu pun kueri menyentuh abt_variabel, abt_config, atau
 *     tabel ABT lain; isian tangan dan keterangan saksi dianggap kosong; pustaka isian hanya dari paket induk;
 *   - identitas satker: tabel sys_config SIPP diganti tabel turunan berisi satker REKAAN ("PA.Xyz", Pengadilan Agama Contoh) lewat penulisan
 *     ulang kueri, jadi nama, alamat, zona waktu, dan kode satker yang terbaca adalah milik satker rekaan itu, bukan Pengadilan Agama Donggala.
 * Data perkara tetap dari salinan uji sipp_vs (hanya dibaca). Keluaran hanya angka dan nama blangko: tidak ada data pihak.
 *
 * Yang diukur per naskah: penanda #nomor# atau #kode# yang tertinggal (harus 0), bocoran identitas satker pembuat paket (harus 0 selain isian
 * yang memang didaftar perluDisesuaikan), galat mesin, dan jumlah isian kosong (kosong wajar: tidak ada isian tangan di salinan bersih).
 *
 *   npx tsx ../scripts/paket-satker-aleta-abt/uji-bersih.mts <folder paket> <perkara_id,perkara_id,...> [keluar.txt] [maks blangko]
 * Jalankan dari manajemen_surat/. Skrip menolak basis data yang bukan salinan uji (_vs).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bocoranIdentitas, penandaTersisa } from "@/lib/aleta-abt-satker";
import { bitaIsi } from "@/server/modules/aleta-abt-pustaka/service";
import { muatPustakaInduk, pasangPaketInduk } from "@/server/modules/aleta-abt-satker/paket";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const AKAR = path.join(SINI, "..", "..");
const req = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
const { newDb } = createRequire(path.join(AKAR, "manajemen_surat", "package.json"))("pg-mem") as typeof import("pg-mem");
const SIPP = process.env.SIPP_DB || "sipp_vs";
/** Skema tempat fungsi basis data paket berada pada salinan uji (hanya fungsi yang dibaca dari sini; tabelnya tidak). */
const FUNGSI_DB = process.env.ABT_DB || "aps_badilag_vs";
if (!/_vs$/.test(SIPP) || !/_vs$/.test(FUNGSI_DB)) {
  console.error(`Berhenti: SIPP_DB=${SIPP} dan ABT_DB=${FUNGSI_DB} bukan pasangan salinan uji (_vs).`);
  process.exit(2);
}
const [dirPaket, daftarPerkara, keluar = path.join(process.env.TMP || ".", "uji-bersih.txt"), maksArg] = process.argv.slice(2);
if (!dirPaket || !daftarPerkara) {
  console.error("pakai: uji-bersih.mts <folder paket> <perkara_id,...> [keluar.txt] [maks blangko]");
  process.exit(2);
}
const perkara = daftarPerkara.split(",").map((x) => x.trim()).filter((x) => /^\d+$/.test(x));
const maks = Number(maksArg) > 0 ? Number(maksArg) : Infinity;

// ---- satker rekaan ----------------------------------------------------------------------------------------------------------------
const SATKER_REKAAN: Record<string, string> = {
  KodePN: "PA.Xyz",
  NamaPN: "PENGADILAN AGAMA CONTOH",
  NamaPT: "PENGADILAN TINGGI AGAMA CONTOH",
  AlamatPN: "JL. CONTOH NOMOR 1 KOTA CONTOH",
  ZonaWaktu: "WIB",
  IDPN: "1",
  kode_satker: "000000",
  pengadilan_id: "000000PA000",
  KetuaPNNama: "KETUA CONTOH, S.H.",
  KetuaPNNIP: "190001010000000001",
  WakilKetuaPNNama: "WAKIL KETUA CONTOH, S.H.",
  WakilKetuaPNNIP: "190001010000000002",
  PanSekNama: "PANITERA CONTOH, S.H.",
  WaPanNama: "Tidak Ada",
  WaSekNama: "SEKRETARIS CONTOH, S.H.",
};
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const TURUNAN_SYS_CONFIG = `(${Object.entries(SATKER_REKAAN).map(([k, v], i) => `SELECT ${i + 1} AS id, ${lit(k)} AS name, ${lit(v)} AS value`).join(" UNION ALL ")})`;
const KATA_ALIAS = new Set(["where", "limit", "order", "group", "having", "union", "on", "join", "left", "right", "inner", "cross", "as", "and", "or", "set", "into", "natural", "straight_join", "use", "ignore", "force"]);

/** sys_config -> tabel turunan satker rekaan (salinan uji tidak disentuh; ini hanya penulisan ulang kueri baca). */
function ganti_sys_config(sql: string): string {
  return sql.replace(/(?<![A-Za-z0-9_])((?:`?[A-Za-z0-9_]+`?\s*\.\s*)?)`?sys_config`?(?![A-Za-z0-9_])(\s*(?:as\s+)?`?([A-Za-z_][A-Za-z0-9_]*)`?)?/gi, (utuh, awalan: string, ekor: string | undefined, alias: string | undefined) => {
    if (awalan && !/^`?(sipp_vs|sipp|aps_badilag[a-z0-9_]*)`?\s*\.\s*$/i.test(awalan)) return utuh;
    if (ekor && alias && !KATA_ALIAS.has(alias.toLowerCase())) return `${TURUNAN_SYS_CONFIG}${ekor}`;
    return `${TURUNAN_SYS_CONFIG} sys_config${ekor ?? ""}`;
  });
}

const mysql = req("mysql");
const kolam = mysql.createPool({ host: "127.0.0.1", user: "root", database: SIPP, connectionLimit: 3, multipleStatements: false });
const rujukanAbt: Record<string, number> = {};
const fungsiDipakai = new Set<string>();
const kueri = (sql: string, params: unknown[] = [], opsi?: { timeoutMs?: number }) => {
  for (const m of String(sql).matchAll(/aps_badilag[A-Za-z0-9_]*\.(abt_[a-z_]+)/gi)) rujukanAbt[m[1]] = (rujukanAbt[m[1]] || 0) + 1;
  for (const m of String(sql).matchAll(/aps_badilag[A-Za-z0-9_]*\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/gi)) fungsiDipakai.add(m[1].toLowerCase());
  // Fungsi basis data paket (aps_badilag.isian_*(...)) dipanggil dari skema salinan uji; yang dibaca di sana hanya definisi fungsinya.
  const teks = ganti_sys_config(String(sql)).replace(/\baps_badilag\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/g, `${FUNGSI_DB}.$1(`);
  return new Promise<Array<Record<string, string>>>((ok, gagal) =>
    kolam.query({ sql: teks, values: params, timeout: opsi?.timeoutMs || 60000, typeCast: (f: { string: () => string; buffer: () => Buffer; type?: string; packet?: { charsetNr?: number } }) => (f.packet && f.packet.charsetNr === 63 && /STRING|BLOB/.test(String(f.type)) ? f.buffer().toString("latin1") : f.string()) }, (g: Error | null, r: Array<Record<string, string>>) => (g ? gagal(g) : ok(r)))
  );
};

// ---- database ALETA kosong + pasang paket -----------------------------------------------------------------------------------------
const M = path.join(AKAR, "manajemen_surat");
const mem = newDb();
for (const n of ["0133_aleta_abt_pustaka", "0135_aleta_abt_penyunting", "0136_aleta_abt_banding"]) mem.public.none(readFileSync(path.join(M, "drizzle", `${n}.sql`), "utf8"));
const { Client } = mem.adapters.createPg();
const pg = new Client();
await pg.connect();
const ubah = (q: string) => {
  let n = 0;
  return q.replace(/\?/g, () => `$${++n}`);
};
const db = {
  queryAll: async (q: string, p: unknown[] = []) => (await pg.query(ubah(q), p)).rows,
  queryOne: async (q: string, p: unknown[] = []) => (await pg.query(ubah(q), p)).rows[0] ?? null,
  run: async (q: string, p: unknown[] = []) => {
    await pg.query(ubah(q), p);
  },
} as never;

const t0 = Date.now();
const pasang = await pasangPaketInduk(db, dirPaket, "uji salinan bersih", { transaksi: async (kerja) => kerja(db) });
const laporan: string[] = [];
laporan.push(`UJI PASANG PADA SALINAN BERSIH TANPA ABT DERRY (tanpa data pihak). Dibuat ${new Date().toISOString()}.`);
laporan.push(`Paket induk dipasang pada database ALETA kosong dalam ${Math.round((Date.now() - t0) / 1000)} dtk: ${pasang.berkasPaket} blangko (${pasang.berkas.baru} baru, ${pasang.berkas.gagal} gagal), ${pasang.variabelPaket} isian (${pasang.variabel.baru} baru); sidik ${pasang.paketSidik}.`);

const pustaka = await muatPustakaInduk(db);
laporan.push(`Pustaka isian dari server induk: ${Object.keys(pustaka.pustaka).length} isian.`);

const berkas = (await (db as unknown as { queryAll: (q: string) => Promise<Array<{ id: string; folder: string; nama: string; isi: string; pengkodean: string; arsip: number }>> }).queryAll(
  "SELECT id, folder, nama, isi, pengkodean, arsip FROM aleta_abt_berkas WHERE status = 'aktif' ORDER BY folder, nama"
)).filter((b) => /\.rtf$/i.test(b.nama));
laporan.push(`Blangko RTF yang disusun: ${Math.min(berkas.length, maks)} dari ${berkas.length} untuk ${perkara.length} perkara.`);

const { buatMesin } = req(path.join(AKAR, "aleta_bot", "services", "abtMesinVariabel.js")) as {
  buatMesin: (p: Record<string, unknown>) => { isiRtf: (rtf: string, o: Record<string, unknown>) => Promise<{ rtf: string; kosong: Array<{ noVar: string; sebab: string }>; mesinGalat: string }> };
};
/** Kata khas satker pembuat paket yang tidak boleh muncul pada naskah satker rekaan. */
const BOCOR = ["vatu bala", "pa-donggala", "082271115021", "pa.donggala", "w20-a11", "pengadilan agama donggala", "pengadilan tinggi agama palu"];

type Hitung = { naskah: number; penandaTersisa: number; naskahBocor: number; naskahGalat: number; kosong: number; tanpaKosong: number };
const total: Hitung = { naskah: 0, penandaTersisa: 0, naskahBocor: 0, naskahGalat: 0, kosong: 0, tanpaKosong: 0 };
const perFolder = new Map<string, Hitung>();
const contohTersisa: string[] = [];
const contohBocor = new Map<string, number>();
const bocorDi: string[] = [];
const sebabKosong = new Map<string, number>();
const identitasTerbaca = new Set<string>();

for (const pid of perkara) {
  const mesin = buatMesin({ kueri, skemaAbt: "aps_badilag", umurKatalogMs: 3600 * 1000, batasKueriMs: 60000, jalurAleta: { pustaka: pustaka.pustaka, alias: pustaka.alias, tanpaAbt: true } });
  let n = 0;
  for (const b of berkas) {
    if (n >= maks) break;
    n += 1;
    const templat = bitaIsi(b.isi, b.pengkodean).toString("latin1");
    const h = await mesin.isiRtf(templat, { perkaraId: pid });
    const f = perFolder.get(b.folder) ?? { naskah: 0, penandaTersisa: 0, naskahBocor: 0, naskahGalat: 0, kosong: 0, tanpaKosong: 0 };
    for (const t of [total, f]) {
      t.naskah += 1;
      const sisa = penandaTersisa(h.rtf);
      t.penandaTersisa += sisa.length ? 1 : 0;
      const bocor = bocoranIdentitas(h.rtf, BOCOR);
      t.naskahBocor += bocor.length ? 1 : 0;
      t.naskahGalat += h.mesinGalat ? 1 : 0;
      t.kosong += h.kosong.length;
      t.tanpaKosong += h.kosong.length === 0 ? 1 : 0;
    }
    perFolder.set(b.folder, f);
    const sisa = penandaTersisa(h.rtf);
    if (sisa.length && contohTersisa.length < 20) contohTersisa.push(`${b.folder}/${b.nama}: ${sisa.slice(0, 5).join(",")}`);
    for (const x of bocoranIdentitas(h.rtf, BOCOR)) {
      contohBocor.set(x, (contohBocor.get(x) || 0) + 1);
      if (bocorDi.length < 30) bocorDi.push(`${b.folder}/${b.nama} (perkara ${pid}): ${x}`);
    }
    for (const k of h.kosong) sebabKosong.set(String(k.sebab).slice(0, 80), (sebabKosong.get(String(k.sebab).slice(0, 80)) || 0) + 1);
    if (/PENGADILAN AGAMA CONTOH/i.test(h.rtf)) identitasTerbaca.add("nama pengadilan");
    if (/JL\. CONTOH NOMOR 1/i.test(h.rtf)) identitasTerbaca.add("alamat");
    if (/PENGADILAN TINGGI AGAMA CONTOH/i.test(h.rtf)) identitasTerbaca.add("pengadilan tinggi");
    if (total.naskah % 100 === 0) console.log(`${total.naskah} naskah, tersisa ${total.penandaTersisa}, bocor ${total.naskahBocor}`);
  }
}

laporan.push("");
laporan.push(`Naskah disusun: ${total.naskah}. Naskah dengan penanda tertinggal: ${total.penandaTersisa}. Naskah dengan kata khas satker pembuat paket: ${total.naskahBocor}. Naskah dengan galat mesin: ${total.naskahGalat}. Isian kosong: ${total.kosong} (naskah tanpa isian kosong: ${total.tanpaKosong}).`);
laporan.push(`Identitas satker rekaan terbaca dari sys_config di naskah: ${[...identitasTerbaca].join(", ") || "tidak ada"}.`);
const fungsiPaket = (JSON.parse(readFileSync(path.join(dirPaket, "manifest.json"), "utf8")) as { fungsi?: unknown[] }).fungsi?.length ?? 0;
laporan.push(`Fungsi basis data yang dipanggil rumus isian pada uji ini: ${fungsiDipakai.size} dari ${fungsiPaket} fungsi di paket.`);
laporan.push(`Rujukan ke tabel ABT pada kueri yang dikirim mesin (seharusnya semuanya sudah ditulis ulang di dalam mesin): ${JSON.stringify(rujukanAbt)}.`);
if (contohTersisa.length) laporan.push("Contoh penanda tertinggal:", ...contohTersisa.map((x) => `  ${x}`));
if (contohBocor.size) laporan.push("Kata khas satker pembuat paket yang muncul:", ...[...contohBocor.entries()].map(([k, v]) => `  ${k}: ${v} naskah`));
if (bocorDi.length) laporan.push("Naskah yang memuat kata itu (nama blangko dan nomor perkara internal; kata itu dapat datang dari data perkara, bukan identitas):", ...bocorDi.map((x) => `  ${x}`));
laporan.push("Sebab isian kosong terbanyak:", ...[...sebabKosong.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `  ${v} x ${k}`));
laporan.push("Per folder (naskah / tertinggal / bocor / galat):");
for (const [folder, h] of [...perFolder.entries()].sort()) if (h.penandaTersisa || h.naskahBocor || h.naskahGalat) laporan.push(`  ${folder}: ${h.naskah} / ${h.penandaTersisa} / ${h.naskahBocor} / ${h.naskahGalat}`);
writeFileSync(keluar, laporan.join("\n") + "\n");
console.log(laporan.slice(0, 12).join("\n"));
kolam.end();
await pg.end();
