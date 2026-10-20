// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bersihkanIsian,
  gantiCabangSatker,
  gantiKodeSurat,
  isiCabangSatker,
  kerangkaSatker,
  kodeSuratDari,
} from "@/lib/identitas-satker";
import { aturUntukBot, bersihkanAturPenetapan } from "@/lib/peta-penetapan";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_IDENTITAS_SATKER } from "@/server/db/schema";
import { saranIdentitas, susunRencana, type KeadaanSatkerBot } from "@/server/modules/pengaturan-abt/identitas-satker";

/**
 * ============================================================================
 * IDENTITAS SATKER & MODE TANDA TANGAN ELEKTRONIK (keputusan 17 Okt 2026)
 * ============================================================================
 *
 *   1. migrasi 0069 (idx 66): berkas = schema.ts, jurnal tanpa lubang;
 *   2. kueri isian satker: hanya cabang WHEN '<KodePN>' THEN '...' yang
 *      berubah; portal dan bot sepakat soal "kerangka"; kode surat #1154#;
 *   3. bot: simpanKueriSatker hanya 9271-9274, kerangka wajib sama, prasyarat;
 *   4. logo kop: pindai / ganti (bentuk + cadangan, kotak dipusatkan) / paket
 *      (daftar md5, pasang.sh berprasyarat, pulih.sh) - blangko tidak ditulis;
 *   5. mode TTE: gambar cap/TTD statis selalu dibuang lewat ALETA; kotak
 *      "Ditandatangani secara elektronik" + logonya dibiarkan;
 *   6. rute: simpan di ALETA (logo dikecilkan ke PNG), terapkan tercatat
 *      jenis "satker" dan dapat dikembalikan; Admin boleh, peran lain tidak.
 */

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot", "package.json"));
const servisBot = require_(path.join(akar, "aleta_bot/services/abtPengaturanService.js")) as {
  buatLayanan: (d: Record<string, unknown>) => {
    simpanKueriSatker: (b: unknown) => Promise<Record<string, unknown>>;
    bacaSatker: () => Promise<Record<string, unknown>>;
  };
  kerangkaSatker: (s: string) => string;
};
type GambarPeta = { md5: string; peran: string; bentuk: number; kotakElektronik: boolean; isi: Buffer };
const logoBot = require_(path.join(akar, "aleta_bot/services/logoKopService.js")) as {
  petakanGambar: (r: string) => { gambar: GambarPeta[]; bentuk: Array<{ geo: { kiri: number; atas: number; kanan: number; bawah: number } | null }> };
  gantiGambar: (r: string, md5: string[], logo: { isi: Buffer }) => { rtf: string; jumlah: number; bentuk: number };
  pindai: (a: string) => Promise<{ jumlahBerkas: number; gambar: Array<{ md5: string; logo: boolean; alasanLogo: string; jumlahBerkas: number; kotakElektronik: boolean }> }>;
  bangunPaket: (p: Record<string, unknown>) => Promise<{ folder: string; jumlahBerkas: number; jumlahGambar: number; berkas: Array<{ rel: string; lama: string; baru: string }> }>;
  akhirKelompok: (r: string, i: number) => number;
};
const edocBot = require_(path.join(akar, "aleta_bot/services/penetapanEdocService.js")) as {
  aturBerlaku: (j: string, k?: unknown) => Record<string, unknown>;
  buangGambarBlokTtd: (r: string, o?: Record<string, unknown>) => { dibuang: number; rtf: string };
  adaKotakTtdElektronik: (r: string) => boolean;
  bubuhkanPenetapan: (p: Record<string, unknown>) => Promise<Record<string, unknown> & { peringatan: Array<{ kode: string }> }>;
};

const pernyataan = (sql: string) =>
  sql
    .split("\n")
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

// Kueri berbentuk paket abt-universal-satker-derry (dibaca dari paket, 17 Okt 2026).
const KASUS = "CASE (SELECT TRIM(value) FROM sys_config WHERE name = 'KodePN' LIMIT 1)";
const Q9271 = `SELECT ${KASUS} WHEN 'PA.Dgl' THEN 'Jalan Vatu Bala Nomor 1 Kecamatan Banawa, Kabupaten Donggala, Sulawesi Tengah 94351' ELSE (SELECT TRIM(value) FROM sys_config WHERE name = 'AlamatPN' LIMIT 1) END AS data`;
const Q9272 = `SELECT ${KASUS} WHEN 'PA.Dgl' THEN '' ELSE '' END AS data`;
const Q9273 = `SELECT ${KASUS} WHEN 'PA.Dgl' THEN 'www.pa-donggala.go.id' ELSE '' END AS data`;
const Q9274 = `SELECT ${KASUS} WHEN 'PA.Dgl' THEN 'pa.donggala@yahoo.co.id' ELSE '' END AS data`;

// ─── 1. Migrasi ──────────────────────────────────────────────────────────────

describe("migrasi 0069 - diklaim sekali, DDL berkas = schema.ts", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0069_aleta_identitas_satker.sql");

  it("jurnal: 0069 di idx 66 sekali, tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0069_"))).toEqual([expect.objectContaining({ idx: 66, tag: "0069_aleta_identitas_satker" })]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_IDENTITAS_SATKER, berjalan di pg-mem, ikut cadangan mode ingatan", () => {
    expect(pernyataan(readFileSync(SQL, "utf8"))).toEqual(DDL_IDENTITAS_SATKER.tabel.map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(readFileSync(SQL, "utf8"));
    expect(kosong.public.many("SELECT id FROM aleta_identitas_satker")).toEqual([]);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_identitas_satker");
  });
});

// ─── 2. Kueri isian satker ───────────────────────────────────────────────────

describe("cabang satker di kueri 9271-9274", () => {
  it("mengganti isian satker saja; kerangka tetap; portal dan bot sepakat", () => {
    const baru = gantiCabangSatker(Q9272, "PA.Dgl", "082271115021");
    expect(baru).toBe(`SELECT ${KASUS} WHEN 'PA.Dgl' THEN '082271115021' ELSE '' END AS data`);
    expect(isiCabangSatker(baru, "PA.Dgl")).toEqual({ ada: true, nilai: "082271115021" });
    expect(kerangkaSatker(baru)).toBe(kerangkaSatker(Q9272));
    expect(servisBot.kerangkaSatker(baru)).toBe(kerangkaSatker(Q9272));
    expect(servisBot.kerangkaSatker(Q9271)).toBe(kerangkaSatker(Q9271));
  });

  it("satker baru mendapat cabang sendiri; cabang satker lain tidak tersentuh; kosong = cabang dibuang (kembali ke ELSE/SIPP)", () => {
    const tambah = gantiCabangSatker(Q9271, "PA.Ctn", "Jl. Contoh No. 9 O'Neil");
    expect(tambah).toContain("WHEN 'PA.Ctn' THEN 'Jl. Contoh No. 9 O''Neil'");
    expect(isiCabangSatker(tambah, "PA.Ctn").nilai).toBe("Jl. Contoh No. 9 O'Neil");
    expect(isiCabangSatker(tambah, "PA.Dgl").nilai).toMatch(/^Jalan Vatu Bala/);
    expect(servisBot.kerangkaSatker(tambah)).toBe(servisBot.kerangkaSatker(Q9271));
    const buang = gantiCabangSatker(Q9271, "PA.Dgl", "");
    expect(isiCabangSatker(buang, "PA.Dgl").ada).toBe(false);
    expect(buang).toMatch(/ELSE \(SELECT TRIM\(value\) FROM sys_config WHERE name = 'AlamatPN'/);
    expect(gantiCabangSatker(Q9273, "PA.Dgl", "www.pa-donggala.go.id")).toBe(Q9273);
  });

  it("kueri yang bukan bentuk isian satker, kode satker aneh, dan isian berbahaya ditolak", () => {
    expect(() => gantiCabangSatker("select 'x' as data", "PA.Dgl", "y")).toThrow(/bukan bentuk isian satker/);
    expect(() => gantiCabangSatker(Q9272, "PA'; drop", "y")).toThrow(/KodePN/);
    expect(() => bersihkanIsian("telepon", "#0046#")).toThrow();
    expect(() => bersihkanIsian("alamat", "Jl. A \\ B")).toThrow(/garis miring/);
    expect(() => bersihkanIsian("alamat", "Jl. 😀")).toThrow(/huruf/);
    expect(() => bersihkanIsian("kodeSurat", "W20/A11")).toThrow(/W20-A11/);
    expect(() => bersihkanIsian("zonaWaktu", "GMT")).toThrow(/WITA/);
    expect(() => bersihkanIsian("surel", "bukan surel")).toThrow(/surel/);
    expect(bersihkanIsian("kodeSurat", " w20-a11 ")).toBe("W20-A11");
    expect(bersihkanIsian("telepon", "0822 7111 5021")).toBe("0822 7111 5021");
  });

  it("kode surat #1154#: hanya kode di depan yang diganti", () => {
    expect(kodeSuratDari("W20-A11//Hk.05/ /#0191#")).toBe("W20-A11");
    expect(gantiKodeSurat("W20-A11//Hk.05/ /#0191#", "w21-a3")).toBe("W21-A3//Hk.05/ /#0191#");
    expect(() => gantiKodeSurat("Hk.05/ /#0191#", "W20-A11")).toThrow(/tidak diawali/);
  });
});

describe("rencana penerapan & saran isian (murni)", () => {
  const abt: KeadaanSatkerBot = {
    sipp: { kodePN: "PA.Dgl", namaPN: "PENGADILAN AGAMA DONGGALA", namaPT: "PENGADILAN TINGGI AGAMA PALU", alamatPN: "JL. VATU BALA", zonaWaktu: "WITA" },
    variabel: [
      { noVar: "9271", ada: true, nama: "", jenis: "data_sql", sql_query: Q9271, default_data: "", dikunci: false, bentukSatker: true, nilai: "Jalan Vatu Bala Nomor 1" },
      { noVar: "9272", ada: true, nama: "", jenis: "data_sql", sql_query: Q9272, default_data: "", dikunci: false, bentukSatker: true, nilai: "" },
      { noVar: "9273", ada: true, nama: "", jenis: "data_sql", sql_query: Q9273, default_data: "", dikunci: false, bentukSatker: true, nilai: "www.pa-donggala.go.id" },
      { noVar: "9274", ada: false, nama: "", jenis: "", sql_query: "", default_data: "", dikunci: false, bentukSatker: false, nilai: "" },
      { noVar: "1154", ada: true, nama: "", jenis: "data_teks", sql_query: "", default_data: "W20-A11//Hk.05/ /#0191#", dikunci: false, bentukSatker: false, nilai: "" },
    ],
    perkaraContoh: null,
  };
  it("saran diambil dari cabang satker ABT + SIPP", () => {
    expect(saranIdentitas(abt)).toMatchObject({ kodeSatker: "PA.Dgl", telepon: "", laman: "www.pa-donggala.go.id", kodeSurat: "W20-A11", zonaWaktu: "WITA", pengadilanTinggi: "PENGADILAN TINGGI AGAMA PALU" });
  });
  it("hanya yang berbeda yang perlu; variabel yang belum terpasang disebut sebabnya", () => {
    const r = susunRencana({ ...saranIdentitas(abt), telepon: "082271115021", kodeSurat: "W20-A11" }, abt);
    expect(r.map((x) => [x.kunci, x.perlu, x.bisa])).toEqual([
      ["alamat", false, true],
      ["telepon", true, true],
      ["laman", false, true],
      ["surel", false, false],
      ["kodeSurat", false, true],
    ]);
    expect(r.find((x) => x.kunci === "surel")!.sebab).toMatch(/belum ada di ABT/);
  });
});

// ─── 3. Bot: simpanKueriSatker ───────────────────────────────────────────────

describe("bot simpanKueriSatker (ABT tiruan bertransaksi)", () => {
  let isi: Record<string, { sql_query: string | null; default_data: string | null; locked: number; data_type: string }>;
  const tulisan: string[] = [];
  const uji: string[] = [];
  const setel = () => {
    isi = {
      "9272": { sql_query: Q9272, default_data: null, locked: 0, data_type: "data_sql" },
      "9273": { sql_query: Q9273, default_data: null, locked: 0, data_type: "data_sql" },
    };
    tulisan.length = 0;
    uji.length = 0;
  };
  const jalankan = async (sql: string, p: unknown[] = []) => {
    const s = sql.replace(/\s+/g, " ").trim();
    if (/FROM aps_badilag\.abt_variabel WHERE no_var = \?/.test(s)) {
      const v = isi[String(p[0])];
      return v ? [{ ...v, no_var: p[0] }] : [];
    }
    if (/^SELECT perkara_id, nomor_perkara/.test(s)) return [{ perkara_id: "77", nomor_perkara: "1/Pdt.G/2026/PA.Dgl", jenis_perkara_nama: "Cerai Gugat" }];
    const m = s.match(/^UPDATE aps_badilag\.abt_variabel SET sql_query = \? WHERE no_var = \?$/);
    if (m) {
      tulisan.push(String(p[1]));
      isi[String(p[1])].sql_query = p[0] as string;
      return [];
    }
    throw new Error(`SQL tiruan tidak dikenal: ${s}`);
  };
  const layanan = servisBot.buatLayanan({
    kueri: async (sql: string, p: unknown[]) => {
      if (/^\s*UPDATE/i.test(sql)) throw new Error("jalur baca dipakai menulis");
      return jalankan(sql, p);
    },
    transaksi: async (kerja: (q: typeof jalankan) => Promise<unknown>) => kerja(jalankan),
    skemaAbt: "aps_badilag",
    akarBlangko: os.tmpdir(),
    buatMesin: () => ({
      nilaiPenanda: async (_k: unknown, daftar: string[]) => {
        uji.push(daftar[0]);
        return new Map([[daftar[0], { status: "terisi", sebab: "", polos: "082271115021" }]]);
      },
    }),
  });
  beforeEach(setel);

  it("menulis cabang satker sesudah lolos uji; nomor di luar 9271-9274 dan kerangka lain ditolak tanpa menulis", async () => {
    await expect(layanan.simpanKueriSatker({ noVar: "0046", lama: { sql_query: Q9272 }, baru: { sql_query: Q9272 } })).rejects.toMatchObject({ kode: "bukan_satker" });
    await expect(
      layanan.simpanKueriSatker({ noVar: "9272", lama: { sql_query: Q9272 }, baru: { sql_query: Q9272.replace("ELSE ''", "ELSE (SELECT password FROM sys_users LIMIT 1)") } })
    ).rejects.toMatchObject({ kode: "bukan_satker" });
    await expect(layanan.simpanKueriSatker({ noVar: "9272", lama: { sql_query: Q9272 }, baru: { sql_query: "select 1 as data" } })).rejects.toMatchObject({ kode: "bukan_satker" });
    expect(tulisan).toEqual([]);
    const baru = gantiCabangSatker(Q9272, "PA.Dgl", "082271115021");
    await expect(layanan.simpanKueriSatker({ noVar: "9272", lama: { sql_query: "bukan ini" }, baru: { sql_query: baru } })).rejects.toMatchObject({ kode: "bukan_satker" });
    const h = await layanan.simpanKueriSatker({ noVar: "9272", lama: { sql_query: Q9272 }, baru: { sql_query: baru } });
    expect(uji).toEqual(["9272"]);
    expect(isi["9272"].sql_query).toBe(baru);
    expect(h).toMatchObject({ sebelum: { sql_query: Q9272 }, sesudah: { sql_query: baru } });
    // Prasyarat: isi ABT sudah berubah -> 'berubah', tidak ditulis.
    await expect(layanan.simpanKueriSatker({ noVar: "9272", lama: { sql_query: Q9272 }, baru: { sql_query: gantiCabangSatker(Q9272, "PA.Dgl", "0811") } })).rejects.toMatchObject({ kode: "berubah" });
    expect(tulisan).toEqual(["9272"]);
  });
});

// ─── 4. Logo kop ─────────────────────────────────────────────────────────────

let LOGO_LAMA: Buffer;
let LOGO_BARU: Buffer;
let TTD_STATIS: Buffer;
beforeAll(async () => {
  LOGO_LAMA = await sharp({ create: { width: 68, height: 87, channels: 3, background: { r: 0, g: 120, b: 0 } } }).jpeg().toBuffer();
  LOGO_BARU = await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 200, g: 180, b: 0, alpha: 1 } } }).png().toBuffer();
  TTD_STATIS = await sharp({ create: { width: 120, height: 60, channels: 4, background: { r: 0, g: 0, b: 90, alpha: 0.8 } } }).png().toBuffer();
});
const heks = (b: Buffer) => b.toString("hex");
const md5 = (b: Buffer) => require_("crypto").createHash("md5").update(b).digest("hex") as string;

/** Kop seperti amplop relaas Derry: logo bentuk mengambang + cadangan di shprslt. */
const rtfKop = () =>
  String.raw`{\rtf1\ansi{\fonttbl{\f0 Times;}}\pard ` +
  String.raw`{\shp{\*\shpinst\shpleft2463\shptop-793\shpright3578\shpbottom651\shpz2{\sp{\sn shapeType}{\sv 75}}{\sp{\sn pib}{\sv {\pict\picscalex92\picscaley92\picw68\pich87\picwgoal1217\pichgoal1577\jpegblip ` +
  heks(LOGO_LAMA) +
  String.raw`}}}{\sp{\sn wzDescription}{\sv E:\'5cDATA\'5cLogo Hitam Putih.jpg}}}{\shprslt\par\pard{\pict\picscalex92\picscaley92\picw68\pich87\picwgoal1217\pichgoal1577\wmetafile8 0102030405}}}` +
  String.raw`{\b #9270#}\par #8010#\par #9271#\par}`;

/** PPP di @ 0: logo + kotak "Ditandatangani secara elektronik". */
const rtfPpp = () =>
  String.raw`{\rtf1\ansi\pard PENUNJUKAN\par MENUNJUK Budi sebagai Panitera Sidang.\par Donggala, 1 Oktober 2026\par ` +
  String.raw`{\shp{\*\shpinst\shpleft0\shptop0\shpright1866\shpbottom1866{\sp{\sn pib}{\sv {\pict\pngblip\picw124\pich124\picwgoal1866\pichgoal1866 ` +
  heks(LOGO_BARU) +
  String.raw`}}}{\sp{\sn wzName}{\sv Picture 12}}}}` +
  String.raw`{\shp{\*\shpinst\shpleft2000\shptop0\shpright6000\shpbottom1200{\sp{\sn shapeType}{\sv 202}}{\shptxt \pard Ditandatangani }{\shptxt secara elektronik oleh:\par Panitera Pengadilan Agama Donggala\par Hj. Panitera}}}\par}`;

describe("logo kop: petakan, ganti, paket (blangko tidak ditulis)", () => {
  it("gambar bentuk + cadangannya diganti, kotak bentuk mengikuti perbandingan logo baru (dipusatkan), RTF seimbang", () => {
    const asal = rtfKop();
    const peta = logoBot.petakanGambar(asal);
    expect(peta.gambar.map((g) => g.peran)).toEqual(["pib", "cadangan"]);
    const h = logoBot.gantiGambar(asal, [md5(LOGO_LAMA)], { isi: LOGO_BARU });
    expect(h).toMatchObject({ jumlah: 2, bentuk: 1 });
    expect(logoBot.akhirKelompok(h.rtf, 0)).toBe(h.rtf.length - 1);
    const sesudah = logoBot.petakanGambar(h.rtf);
    expect(sesudah.gambar.map((g) => g.md5)).toEqual([md5(LOGO_BARU), md5(LOGO_BARU)]);
    // Kotak asal 1115 x 1444 twip; logo 2:1 -> lebar tetap 1115, tinggi 558, dipusatkan.
    expect(sesudah.bentuk[0].geo).toMatchObject({ kiri: 2463, kanan: 3578, atas: -793 + Math.round((1444 - 558) / 2) });
    expect(h.rtf).toContain("#9271#");
    expect(logoBot.gantiGambar(asal, ["0".repeat(32)], { isi: LOGO_BARU }).jumlah).toBe(0);
  });

  it("pindai menandai logo kop (nama) dan logo kotak TTD elektronik; paket memuat daftar md5, pasang.sh berprasyarat, pulih.sh", async () => {
    const tmp = mkdtempSync(path.join(process.env.TMP || os.tmpdir(), "aleta-logo-kop-"));
    try {
      const derry = path.join(tmp, "derry_briantono");
      mkdirSync(path.join(derry, "98 Relaas"), { recursive: true });
      mkdirSync(path.join(derry, "99 PTSP"), { recursive: true });
      mkdirSync(path.join(derry, "1 Perceraian CG"), { recursive: true });
      writeFileSync(path.join(derry, "98 Relaas", "[JS] 8.1.1. Amplop.rtf"), rtfKop(), "latin1");
      writeFileSync(path.join(derry, "99 PTSP", "@ 0 - PMH - PHS.rtf"), rtfPpp(), "latin1");
      writeFileSync(path.join(derry, "1 Perceraian CG", "[01] Putusan.rtf"), String.raw`{\rtf1 {\pict\pngblip ` + heks(TTD_STATIS) + "}}", "latin1");
      const p = await logoBot.pindai(derry);
      expect(p.jumlahBerkas).toBe(3);
      const logo = p.gambar.filter((g) => g.logo);
      expect(logo.map((g) => g.md5).sort()).toEqual([md5(LOGO_LAMA), md5(LOGO_BARU), expect.any(String)].sort());
      expect(p.gambar.find((g) => g.md5 === md5(LOGO_BARU))!.kotakElektronik).toBe(true);
      expect(p.gambar.find((g) => g.md5 === md5(TTD_STATIS))!.logo).toBe(false);

      const isiAsal = readFileSync(path.join(derry, "98 Relaas", "[JS] 8.1.1. Amplop.rtf"));
      const logoSatker = await sharp({ create: { width: 90, height: 120, channels: 4, background: { r: 0, g: 99, b: 0, alpha: 1 } } }).png().toBuffer();
      const paket = await logoBot.bangunPaket({ akar: derry, keluarAkar: path.join(tmp, "paket"), md5: logo.map((g) => g.md5), logo: { isi: logoSatker }, akarServer: "/srv/derry_briantono" });
      expect(paket.jumlahBerkas).toBe(2);
      expect(paket.berkas.map((b) => b.rel).sort()).toEqual(["98 Relaas/[JS] 8.1.1. Amplop.rtf", "99 PTSP/@ 0 - PMH - PHS.rtf"]);
      expect(paket.berkas.find((b) => b.rel.startsWith("98"))!.lama).toBe(md5(isiAsal));
      expect(readFileSync(path.join(derry, "98 Relaas", "[JS] 8.1.1. Amplop.rtf")).equals(isiAsal)).toBe(true); // blangko tidak ditulis
      const isiPaket = readdirSync(paket.folder).sort();
      expect(isiPaket).toEqual(["BACA.txt", "daftar.tsv", "logo-baru.png", "pasang.sh", "pulih.sh", "rtf"]);
      const pasang = readFileSync(path.join(paket.folder, "pasang.sh"), "utf8");
      expect(pasang).toContain('AKAR="${AKAR:-/srv/derry_briantono}"');
      expect(pasang).toMatch(/PRASYARAT GAGAL - tidak ada yang diubah/);
      expect(pasang).toMatch(/cp -p "\$f" "\$CAD\/\$rel"/);
      expect(readFileSync(path.join(paket.folder, "daftar.tsv"), "utf8").split("\n")[0]).toBe("berkas\tmd5_lama\tmd5_baru\tgambar");
      const baru = readFileSync(path.join(paket.folder, "rtf", "99 PTSP", "@ 0 - PMH - PHS.rtf"), "latin1");
      expect(baru).toMatch(/Ditandatangani/);
      expect(logoBot.petakanGambar(baru).gambar[0].md5).toBe(md5(logoSatker));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ─── 5. Mode tanda tangan elektronik ─────────────────────────────────────────

describe("mode tanda tangan elektronik (penetapan lewat ALETA)", () => {
  it("gantiGambarBawaan selalu menyala - kiriman false diabaikan, di bot maupun peta penetapan portal", () => {
    expect(edocBot.aturBerlaku("pmh", { gantiGambarBawaan: false }).gantiGambarBawaan).toBe(true);
    const atur = bersihkanAturPenetapan("pmh", { gantiGambarBawaan: false });
    expect(atur.gantiGambarBawaan).toBe(true);
    expect(aturUntukBot({ ...atur, gantiGambarBawaan: false }).gantiGambarBawaan).toBe(true);
  });

  it("kotak 'Ditandatangani secara elektronik' dikenali; logonya TIDAK dibuang; tidak ada gambar ttd ditempel", async () => {
    const rtf = rtfPpp();
    expect(edocBot.adaKotakTtdElektronik(rtf)).toBe(true);
    expect(edocBot.buangGambarBlokTtd(rtf, { dari: 0 }).dibuang).toBe(0);
    const h = await edocBot.bubuhkanPenetapan({
      rtf,
      jenis: "ppp",
      atur: {},
      cap: null,
      daftarTtd: [{ id: 1, namaPejabat: "Hj. Panitera" }],
      ambilGambar: async () => ({ jenis: "png", isi: TTD_STATIS }),
      bakuNama: (n: string) => String(n).toLowerCase().replace(/[^a-z]/g, ""),
    });
    expect(h).toMatchObject({ ok: true, modeTtd: "kotak_elektronik", tandaTangan: null });
    expect(h.peringatan.map((p) => p.kode)).toEqual(["kotak_ttd_elektronik"]);
    // 20 Okt (butir 6): satu-satunya perubahan di kotak elektronik = logo dimuat di dalam kotak (geometri bentuk), tanpa gambar ttd/cap.
    expect(h.rtf).not.toContain("Tanda tangan}");
    const tanpaGeometri = (r: string) =>
      r
        .replace(/\\shpleft-?\d+ ?\\shptop-?\d+ ?\\shpright-?\d+ ?\\shpbottom-?\d+/g, "")
        .replace(/\\pic(?:w|h)goal\d+/g, "")
        .replace(/\\picscale[xy]\d+/g, "");
    expect(tanpaGeometri(String(h.rtf))).toBe(tanpaGeometri(rtf));
  });

  it("gambar cap/TTD statis di blok tanda tangan PMH tetap dibuang (bukan kotak elektronik)", () => {
    const rtf =
      String.raw`{\rtf1\pard MENETAPKAN\par memeriksa dan memutus\par Ditetapkan di Donggala` +
      String.raw`{\shp{\*\shpinst\shpleft0\shptop0\shpright100\shpbottom100{\sp{\sn pib}{\sv {\pict\pngblip ` +
      heks(TTD_STATIS) +
      String.raw`}}}{\sp{\sn wzDescription}{\sv TTD PAK KETUA}}}}\par Ketua,\par\par Ketua Contoh\par}`;
    expect(edocBot.adaKotakTtdElektronik(rtf)).toBe(false);
    expect(edocBot.buangGambarBlokTtd(rtf).dibuang).toBe(1);
  });
});

// ─── 6. Rute portal ──────────────────────────────────────────────────────────

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
const panggilanBot: Array<{ jalur: string; method: string; body: Record<string, unknown> }> = [];
let kueriAbt: Record<string, string> = {};

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
vi.mock("@/server/modules/pengaturan-abt/gateway", () => ({
  ambilGambarBotPengaturanAbt: async () => ({ ok: true, isi: LOGO_LAMA, jenis: "image/jpeg" }),
  panggilBotPengaturanAbt: async (jalur: string, pilihan: { method?: string; body?: Record<string, unknown> } = {}) => {
    panggilanBot.push({ jalur, method: pilihan.method ?? "GET", body: pilihan.body ?? {} });
    if (jalur === "/satker")
      return {
        ok: true,
        data: {
          ok: true,
          sipp: { kodePN: "PA.Dgl", namaPN: "PENGADILAN AGAMA DONGGALA", namaPT: "PENGADILAN TINGGI AGAMA PALU", alamatPN: "JL. VATU BALA", zonaWaktu: "WITA" },
          variabel: [
            ...["9271", "9272", "9273", "9274"].map((no) => ({ noVar: no, ada: true, nama: "", jenis: "data_sql", sql_query: kueriAbt[no], default_data: "", dikunci: false, bentukSatker: true, nilai: "" })),
            { noVar: "1154", ada: true, nama: "", jenis: "data_teks", sql_query: "", default_data: kueriAbt["1154"], dikunci: false, bentukSatker: false, nilai: "" },
          ],
          perkaraContoh: null,
        },
      };
    if (jalur === "/satker/simpan") {
      const b = pilihan.body as { noVar: string; lama: { sql_query: string }; baru: { sql_query: string } };
      if (kueriAbt[b.noVar] !== b.lama.sql_query) return { ok: false, kode: "berubah", error: "sudah diubah orang lain", status: 409 };
      kueriAbt[b.noVar] = b.baru.sql_query;
      return { ok: true, data: { ok: true, sebelum: b.lama, sesudah: b.baru, uji: null } };
    }
    if (jalur === "/variabel/simpan") {
      const b = pilihan.body as { noVar: string; lama: Record<string, string>; baru: Record<string, string> };
      kueriAbt[b.noVar] = b.baru.default_data;
      return { ok: true, data: { ok: true, sebelum: b.lama, sesudah: b.baru, uji: null } };
    }
    if (jalur === "/logo/paket")
      return { ok: true, data: { ok: true, paket: { nama: "logo-kop-x", folder: "/usr/src/app/runtime-data/paket-abt/logo-kop-x", folderServer: "/var/www/html/aleta-data/aleta-bot-runtime/paket-abt/logo-kop-x", jumlahBerkas: 9, jumlahGambar: 18, berkas: [] } } };
    return { ok: false, error: "jalur tidak dikenal", status: 404 };
  },
}));

async function rute(cara: "GET" | "POST", opsi: { query?: string; badan?: unknown } = {}) {
  const modul = (await import("@/app/api/pengaturan-sipp-abt/route")) as unknown as Record<string, (r: NextRequest) => Promise<Response>>;
  const req = new NextRequest("http://localhost/api/pengaturan-sipp-abt" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  return modul[cara](req);
}
const json = async (r: Response) => (await r.json()) as { ok: boolean; data: Record<string, unknown> };

describe("rute identitas satker (pg-mem berbenih, bot tiruan)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-admin";
    panggilanBot.length = 0;
    kueriAbt = { "9271": Q9271, "9272": Q9272, "9273": Q9273, "9274": Q9274, "1154": "W20-A11//Hk.05/ /#0191#" };
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("belum tersimpan: isian disarankan dari SIPP & ABT; peran lain ditolak", async () => {
    const r = await json(await rute("GET", { query: "bagian=satker" }));
    expect(r.data).toMatchObject({ tersimpan: false, identitas: { kodeSatker: "PA.Dgl", laman: "www.pa-donggala.go.id", kodeSurat: "W20-A11" }, rencana: [] });
    aktor = "usr-ppg";
    expect((await rute("GET", { query: "bagian=satker" })).status).toBe(403);
    expect((await rute("POST", { badan: { tindakan: "simpan-satker", identitas: {} } })).status).toBe(403);
  });

  it("simpan di ALETA tidak menyentuh ABT; logo dikecilkan ke PNG dan dapat dibaca kembali", async () => {
    const besar = await sharp({ create: { width: 1800, height: 2400, channels: 3, background: { r: 0, g: 128, b: 0 } } }).jpeg().toBuffer();
    const r = await rute("POST", {
      badan: { tindakan: "simpan-satker", identitas: { kodeSatker: "PA.Dgl", telepon: "082271115021", kodeSurat: "w20-a11", zonaWaktu: "WITA" }, logoBase64: `data:image/jpeg;base64,${besar.toString("base64")}` },
    });
    expect(r.status).toBe(200);
    const d = (await json(r)).data as { identitas: Record<string, string>; logo: { ada: boolean; jenis: string; lebar: number; tinggi: number } };
    expect(d.identitas).toMatchObject({ telepon: "082271115021", kodeSurat: "W20-A11" });
    expect(d.logo).toMatchObject({ ada: true, jenis: "png", lebar: 450, tinggi: 600 });
    expect(panggilanBot.filter((p) => p.method === "POST")).toEqual([]);
    const g = await rute("GET", { query: "bagian=satker-logo" });
    expect(g.headers.get("content-type")).toBe("image/png");
    expect((await sharp(Buffer.from(await g.arrayBuffer())).metadata()).width).toBe(450);
    expect((await rute("POST", { badan: { tindakan: "simpan-satker", identitas: { telepon: "#0046#" } } })).status).toBe(400);
  });

  it("terapkan: hanya yang dicentang, tercatat jenis 'satker' dengan kueri lama, dan Kembalikan menulis kueri lama", async () => {
    await rute("POST", { badan: { tindakan: "simpan-satker", identitas: { kodeSatker: "PA.Dgl", telepon: "082271115021", laman: "www.pa-donggala.go.id", surel: "pa.donggala@yahoo.co.id", kodeSurat: "W20-A12" } } });
    const g = await json(await rute("GET", { query: "bagian=satker" }));
    expect((g.data.rencana as Array<{ kunci: string; perlu: boolean }>).filter((x) => x.perlu).map((x) => x.kunci)).toEqual(["alamat", "telepon", "kodeSurat"]);
    const t = await json(await rute("POST", { badan: { tindakan: "terapkan-satker", kunci: ["telepon", "kodeSurat"] } }));
    expect((t.data.hasil as Array<{ kunci: string; ok: boolean }>).map((x) => [x.kunci, x.ok])).toEqual([
      ["telepon", true],
      ["kodeSurat", true],
    ]);
    expect(isiCabangSatker(kueriAbt["9272"], "PA.Dgl").nilai).toBe("082271115021");
    expect(kueriAbt["9271"]).toBe(Q9271); // alamat tidak dicentang
    expect(kueriAbt["1154"]).toBe("W20-A12//Hk.05/ /#0191#");
    const catatan = await db!.queryAll<Record<string, string>>("SELECT * FROM aleta_abt_suntingan ORDER BY pada ASC, id ASC");
    const satker = catatan.find((c) => c.jenis === "satker")!;
    expect(satker).toMatchObject({ kunci: "9272", status: "tersimpan", oleh_id: "usr-admin" });
    expect(JSON.parse(satker.nilai_lama)).toEqual({ sql_query: Q9272 });
    expect(catatan.find((c) => c.jenis === "variabel")).toMatchObject({ kunci: "1154", status: "tersimpan" });
    const k = await rute("POST", { badan: { tindakan: "kembalikan", id: satker.id } });
    expect(k.status).toBe(200);
    expect(kueriAbt["9272"]).toBe(Q9272);
    expect(panggilanBot.filter((p) => p.jalur === "/satker/simpan").at(-1)!.body).toMatchObject({ pulihkan: true, baru: { sql_query: Q9272 } });
  });

  it("paket logo kop: logo ALETA dikirim ke bot, jejaknya tercatat (jenis 'logo', tidak dapat dikembalikan dari portal)", async () => {
    expect((await rute("POST", { badan: { tindakan: "paket-logo-kop", md5: ["a".repeat(32)] } })).status).toBe(400); // belum ada logo
    await rute("POST", { badan: { tindakan: "logo-dari-blangko", md5: "b".repeat(32) } });
    const r = await json(await rute("POST", { badan: { tindakan: "paket-logo-kop", md5: ["a".repeat(32)] } }));
    expect(r.data).toMatchObject({ paket: { jumlahBerkas: 9 } });
    const kiriman = panggilanBot.find((p) => p.jalur === "/logo/paket")!.body as { md5: string[]; logoBase64: string };
    expect(kiriman.md5).toEqual(["a".repeat(32)]);
    expect(Buffer.from(kiriman.logoBase64, "base64").subarray(1, 4).toString("latin1")).toBe("PNG");
    const [c] = await db!.queryAll<Record<string, string>>("SELECT * FROM aleta_abt_suntingan WHERE jenis = 'logo'");
    expect(c.ringkas).toMatch(/menunggu dipasang di server/);
    expect((await rute("POST", { badan: { tindakan: "kembalikan", id: c.id } })).status).toBe(400);
  });
});

afterAll(() => undefined);
