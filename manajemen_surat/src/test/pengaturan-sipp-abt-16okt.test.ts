// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bedaFolder,
  hakPengaturanAbt,
  hurufDiluarLatin1,
  periksaKueriVariabel,
  rancanganSaklar,
  susunSaklar,
  susunUbahMenu,
  type FolderMenuAbt,
} from "@/lib/pengaturan-abt";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ABT_SUNTINGAN } from "@/server/db/schema";

/**
 * ============================================================================
 * PENGATURAN SIPP & ABT (Tahap H, 16 Okt 2026)
 * ============================================================================
 *
 * Yang dijaga:
 *   1. migrasi 0066 (idx 63) - berkas = schema.ts, jurnal tanpa lubang;
 *   2. pemeriksa kueri variabel - hanya satu SELECT, kata tulis & titik koma
 *      ganda ditolak; portal dan bot memberi putusan yang sama;
 *   3. saklar kebijakan diturunkan dari hak menu (bawaan = keadaan ABT);
 *   4. penulis bot: prasyarat nilai lama, satu transaksi (gagal = pulih),
 *      variabel bukan-Derry/dikunci ditolak, kueri wajib lolos uji;
 *   5. rute portal: hak peran (Admin/Super Admin saja; hak menu & kueri Super
 *      Admin), cadangan dicatat SEBELUM menulis, Kembalikan menukar lama/baru.
 */

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot", "package.json"));

type LayananBot = {
  simpanMenu: (b: unknown) => Promise<Record<string, unknown>>;
  simpanTemplat: (b: unknown) => Promise<Record<string, unknown>>;
  simpanVariabel: (b: unknown) => Promise<Record<string, unknown>>;
  ujiVariabel: (b: unknown) => Promise<{ ok: boolean; status: string; sebab: string }>;
  daftarVariabel: () => Promise<{ jumlahBerkas: number; daftar: Array<{ noVar: string; jumlahBlangko: number }> }>;
};
const servisBot = require_(path.join(akar, "aleta_bot/services/abtPengaturanService.js")) as {
  buatLayanan: (d: Record<string, unknown>) => LayananBot;
  periksaKueriVariabel: (sql: string, pagar: (s: string) => string) => string;
  hurufDiluarLatin1: (t: string) => string[];
};
const mesinBot = require_(path.join(akar, "aleta_bot/services/abtMesinVariabel.js")) as { pagarBaca: (s: string) => string };

const pernyataan = (sql: string) =>
  sql
    .split("\n")
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

// ─── 1. Migrasi ──────────────────────────────────────────────────────────────

describe("migrasi 0066 - diklaim sekali, DDL berkas = schema.ts", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0066_aleta_abt_suntingan.sql");

  it("jurnal: 0066 di idx 63 sekali, tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0066_"))).toEqual([expect.objectContaining({ idx: 63, tag: "0066_aleta_abt_suntingan" })]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_ABT_SUNTINGAN, berjalan di pg-mem, ikut cadangan mode ingatan", () => {
    expect(pernyataan(readFileSync(SQL, "utf8"))).toEqual([...DDL_ABT_SUNTINGAN.tabel, ...DDL_ABT_SUNTINGAN.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(readFileSync(SQL, "utf8"));
    expect(kosong.public.many("SELECT id FROM aleta_abt_suntingan")).toEqual([]);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_abt_suntingan");
  });
});

// ─── 2. Pemeriksa kueri & huruf ──────────────────────────────────────────────

describe("pemeriksa kueri variabel - hanya membaca", () => {
  const LOLOS = [
    "select nama as data from pihak where id = #0046#",
    "SELECT replace(nama,'a','b') AS data FROM perkara WHERE perkara_id = #perkara_id#",
    "select concat('x;y', nama) as data from perkara where perkara_id=#perkara_id#;",
    "(select 1 as data)",
  ];
  const TOLAK: Array<[string, RegExp]> = [
    ["insert into perkara values (1)", /SELECT/],
    ["select 1 as data; delete from perkara", /lebih dari satu perintah/],
    ["select 1 as data;;", /titik koma ganda/],
    ["select 1 as data from x where 1=1 union select sleep(5)", /sleep/],
    ["select * from perkara into outfile '/tmp/x'", /into outfile/i],
    ["select 1 as data from perkara for update", /for update/i],
    ["update perkara set x = 1", /SELECT/],
    ["drop table perkara", /SELECT/],
    ["select 1 as data, (select grant from x)", /grant/],
    ["select 1 as data from t where a in (select 1); truncate t", /lebih dari satu/],
    ["", /kosong/],
  ];

  it("kueri SELECT dengan penanda, REPLACE() dan titik koma di dalam kutipan lolos", () => {
    for (const q of LOLOS) {
      expect(periksaKueriVariabel(q)).toBe("");
      expect(servisBot.periksaKueriVariabel(q, mesinBot.pagarBaca)).toBe("");
    }
  });

  it("kata tulis, titik koma ganda/tengah, sleep, outfile, FOR UPDATE ditolak - portal dan bot sepakat", () => {
    for (const [q, pola] of TOLAK) {
      expect(periksaKueriVariabel(q), q).toMatch(pola);
      expect(servisBot.periksaKueriVariabel(q, mesinBot.pagarBaca), q).not.toBe("");
    }
  });

  it("huruf di luar latin1/cp1252 terdeteksi; huruf cp1252 aman", () => {
    expect(hurufDiluarLatin1("Uji é ü ’ “kutip” – ½ ©")).toEqual([]);
    expect(hurufDiluarLatin1("الله 😀")).toEqual(expect.arrayContaining(["😀"]));
    expect(servisBot.hurufDiluarLatin1("Uji ’ – ½")).toEqual([]);
    expect(servisBot.hurufDiluarLatin1("😀").length).toBe(1);
    expect(periksaKueriVariabel("select 'ا' as data")).toMatch(/huruf/);
  });
});

// ─── 3. Hak & saklar ─────────────────────────────────────────────────────────

const FOLDER: FolderMenuAbt[] = [
  {
    id: 101,
    nama: "Putusan Cerai Gugat",
    namaAlias: "CG - Putusan",
    direktori: "1 Perceraian CG",
    user_grup_id: "1|10|20",
    user_top_id: "1",
    user_validator: null,
    user_cek: 0,
    proses_id_min: 80,
    proses_id_max: 297,
    perkara_id_min: 347,
    perkara_id_max: 347,
    perkara_id_referensi: "jenis_perkara_id",
  },
  {
    id: 102,
    nama: "Cerai Gugat - BAS",
    namaAlias: "CG - BAS",
    direktori: "1 Perceraian CG - BAS",
    user_grup_id: "1|30|500|430|1000|1010|1020",
    user_top_id: "1|30",
    user_validator: "10|20",
    user_cek: 3,
    proses_id_min: 80,
    proses_id_max: 297,
    perkara_id_min: 347,
    perkara_id_max: 347,
    perkara_id_referensi: "jenis_perkara_id",
  },
  {
    id: 981,
    nama: "Relaas Panggilan Sidang dan Pemberitahuan Putusan",
    namaAlias: "Relaas dan PBT",
    direktori: "Relaas",
    user_grup_id: "600|650",
    user_top_id: "1|30",
    user_validator: null,
    user_cek: 3,
    proses_id_min: 80,
    proses_id_max: 297,
    perkara_id_min: 15,
    perkara_id_max: 16,
    perkara_id_referensi: "alur_perkara_id",
  },
];
const RUJUKAN = { peran: [{ id: 20, nama: "Hakim" }, { id: 10, nama: "Ketua/Wakil Ketua" }, { id: 500, nama: "Panitera Pengganti" }], proses: [], jenis: [], alur: [] };

describe("hak peran dan saklar kebijakan", () => {
  it("lihat: Super Admin & Admin; hak menu & kueri: Super Admin; template & bawaan: keduanya; peran lain: tidak ada", () => {
    expect(hakPengaturanAbt("super-admin")).toEqual({ lihat: true, ubahMenu: true, ubahKueri: true, ubahBawaan: true, ubahTemplat: true });
    expect(hakPengaturanAbt("admin")).toEqual({ lihat: true, ubahMenu: false, ubahKueri: false, ubahBawaan: true, ubahTemplat: true });
    for (const r of ["hakim", "panitera-pengganti", "jurusita", "", null]) expect(Object.values(hakPengaturanAbt(r)).some(Boolean)).toBe(false);
  });

  it("bawaan saklar = keadaan ABT: hakim TIDAK melihat BAS (keputusan 15 Okt), validasi BAS dari abt_config", () => {
    const s = susunSaklar({ folder: FOLDER, config: { validasi_data_bas: "0" } });
    expect(s.find((x) => x.kunci === "hakim-lihat-bas")).toMatchObject({ keadaan: "mati", folder: [102] });
    expect(s.find((x) => x.kunci === "pp-lihat-putusan")).toMatchObject({ keadaan: "mati", folder: [101] });
    expect(s.find((x) => x.kunci === "validasi-bas")).toMatchObject({ keadaan: "mati" });
  });

  it("menyalakan 'hakim melihat BAS' hanya menambah 10|20 pada folder BAS; mematikan membuangnya lagi; beda dibaca sebagai himpunan", () => {
    const r = rancanganSaklar("hakim-lihat-bas", true, FOLDER);
    expect(Object.keys(r)).toEqual(["102"]);
    expect(r[102].user_grup_id).toBe("1|30|500|430|1000|1010|1020|10|20");
    const ubah = susunUbahMenu(FOLDER, r, RUJUKAN);
    expect(ubah).toEqual([{ id: 102, lama: { user_grup_id: "1|30|500|430|1000|1010|1020" }, baru: { user_grup_id: "1|30|500|430|1000|1010|1020|10|20" } }]);
    const sesudah = FOLDER.map((f) => ({ ...f, ...(r[f.id] ?? {}) }));
    expect(susunSaklar({ folder: sesudah, config: {} }).find((x) => x.kunci === "hakim-lihat-bas")!.keadaan).toBe("nyala");
    const balik = rancanganSaklar("hakim-lihat-bas", false, FOLDER, r);
    expect(susunUbahMenu(FOLDER, balik, RUJUKAN)).toEqual([]);
    // urutan berbeda, isi sama -> bukan perubahan
    expect(bedaFolder(FOLDER[0], { user_grup_id: "20|10|1" }, RUJUKAN)).toEqual([]);
    expect(bedaFolder(FOLDER[0], { user_grup_id: "1|10" }, RUJUKAN)[0]).toMatchObject({ kolom: "user_grup_id", baruTeks: "Super Administrator, Ketua/Wakil Ketua" });
  });
});

// ─── 4. Penulis bot (basis data ABT tiruan bertransaksi) ─────────────────────

type BarisMenu = Record<string, unknown>;
function buatAbtTiruan() {
  const awal = () => ({
    menu: [
      { id: 102, nama: "Cerai Gugat - BAS", nama_alias: "CG - BAS", direktori: "1 Perceraian CG - BAS", parent_direktori: "derry_briantono", user_grup_id: "1|30|500", user_top_id: "1|30", user_validator: "10|20", user_cek: 3, proses_id_min: 80, proses_id_max: 297, perkara_id_min: 347, perkara_id_max: 347, perkara_id_referensi: "jenis_perkara_id", modified: "2026-10-15 18:38:28" },
      { id: 801, nama: "Blangko lain", nama_alias: "Lain", direktori: "Lain", parent_direktori: "BLANGKO_JURUSITA_DONGGALA", user_grup_id: "-1", user_top_id: "1", user_validator: null, user_cek: 0, proses_id_min: 1, proses_id_max: 1000, perkara_id_min: null, perkara_id_max: null, perkara_id_referensi: null, modified: "" },
    ] as BarisMenu[],
    config: { validasi_data_bas: "0" } as Record<string, string>,
    variabel: {
      "0046": { no_var: "0046", nama: "Sebutan P", data_type: "data_sql", sql_query: "select 'Penggugat' as data", default_data: null, locked: 0 },
      "0099": { no_var: "0099", nama: "Dikunci", data_type: "data_sql", sql_query: "select 1 as data", default_data: null, locked: 1 },
      "0500": { no_var: "0500", nama: "Bukan Derry", data_type: "data_teks", sql_query: null, default_data: null, locked: 0 },
    } as Record<string, Record<string, unknown>>,
    tjId: [{ kode: "A1a", nama: "Pertanyaan Saksi P CG", jenis_perkara_id: 347 }],
    tj: [
      { kode_tanyajawab: "A1a", urutan_pertanyaan: 1, pertanyaan: "Apakah saksi kenal #0046#?", jawaban: "Kenal", modifier: "admin" },
      { kode_tanyajawab: "A1a", urutan_pertanyaan: 2, pertanyaan: "Sejak kapan?", jawaban: "", modifier: "admin" },
    ] as Array<Record<string, unknown>>,
  });
  let isi = awal();
  const tulisan: string[] = [];
  let gagalSetelah: RegExp | null = null;

  function jalankan(sql: string, p: unknown[] = []): Array<Record<string, unknown>> {
    const s = sql.replace(/\s+/g, " ").trim();
    if (/^UPDATE|^DELETE|^INSERT/.test(s)) {
      tulisan.push(s);
      if (gagalSetelah && gagalSetelah.test(s)) throw new Error("galat tiruan saat menulis");
    }
    let m: RegExpMatchArray | null;
    if (/FROM aps_badilag\.abt_menu WHERE id = \? AND parent_direktori = \?/.test(s)) return isi.menu.filter((r) => r.id === p[0] && r.parent_direktori === p[1]).map((r) => ({ ...r }));
    if (/FROM aps_badilag\.abt_menu WHERE id = \?$/.test(s)) return isi.menu.filter((r) => r.id === p[0]).map((r) => ({ ...r }));
    if ((m = s.match(/^UPDATE aps_badilag\.abt_menu SET (.+) WHERE id = \? AND parent_direktori = \?$/))) {
      const kolom = m[1].split(", ").map((x) => x.replace(" = ?", ""));
      const r = isi.menu.find((x) => x.id === p[kolom.length] && x.parent_direktori === p[kolom.length + 1]);
      if (r) kolom.forEach((k, i) => (r[k] = p[i]));
      return [];
    }
    if (/^SELECT value FROM aps_badilag\.abt_config WHERE name = \?/.test(s)) return Object.prototype.hasOwnProperty.call(isi.config, String(p[0])) ? [{ value: isi.config[String(p[0])] }] : [];
    if (/^UPDATE aps_badilag\.abt_config SET value = \? WHERE name = \?$/.test(s)) {
      isi.config[p[1] as string] = p[0] as string;
      return [];
    }
    if (/FROM aps_badilag\.abt_variabel WHERE no_var = \?/.test(s)) {
      const v = isi.variabel[p[0] as string];
      return v ? [{ ...v }] : [];
    }
    if (/FROM aps_badilag\.abt_variabel$/.test(s)) return Object.values(isi.variabel).map((v) => ({ ...v }));
    if ((m = s.match(/^UPDATE aps_badilag\.abt_variabel SET (.+) WHERE no_var = \?$/))) {
      const kolom = m[1].split(", ").map((x) => x.replace(" = ?", ""));
      const v = isi.variabel[p[kolom.length] as string];
      kolom.forEach((k, i) => (v[k] = p[i]));
      return [];
    }
    if (/FROM aps_badilag\.abt_tanyajawab_id WHERE kode = \?/.test(s)) return isi.tjId.filter((r) => r.kode === p[0]);
    if (/^SELECT .* FROM aps_badilag\.abt_tanyajawab_template WHERE kode_tanyajawab = \?/.test(s))
      return isi.tj
        .filter((r) => r.kode_tanyajawab === p[0])
        .sort((a, b) => Number(a.urutan_pertanyaan) - Number(b.urutan_pertanyaan))
        .map((r) => ({ ...r }));
    if (/^DELETE FROM aps_badilag\.abt_tanyajawab_template WHERE kode_tanyajawab = \?$/.test(s)) {
      isi.tj = isi.tj.filter((r) => r.kode_tanyajawab !== p[0]);
      return [];
    }
    if (/^INSERT INTO aps_badilag\.abt_tanyajawab_template/.test(s)) {
      isi.tj.push({ kode_tanyajawab: p[0], urutan_pertanyaan: p[1], pertanyaan: p[2], jawaban: p[3], modifier: p[4] });
      return [];
    }
    throw new Error(`SQL tiruan tidak dikenal: ${s}`);
  }

  return {
    get isi() {
      return isi;
    },
    tulisan,
    gagalPada(pola: RegExp | null) {
      gagalSetelah = pola;
    },
    setel() {
      isi = awal();
      tulisan.length = 0;
      gagalSetelah = null;
    },
    kueri: async (sql: string, p: unknown[] = []) => {
      if (/^\s*(UPDATE|DELETE|INSERT)/i.test(sql)) throw new Error("jalur baca dipakai untuk menulis");
      return jalankan(sql, p);
    },
    transaksi: async (kerja: (q: (sql: string, p?: unknown[]) => Promise<unknown[]>) => Promise<unknown>) => {
      const cadangan = JSON.parse(JSON.stringify(isi)) as typeof isi;
      try {
        return await kerja(async (sql, p) => jalankan(sql, p));
      } catch (g) {
        isi = cadangan; // ROLLBACK
        throw g;
      }
    },
  };
}

describe("penulis bot abtPengaturanService (ABT tiruan bertransaksi)", () => {
  const abt = buatAbtTiruan();
  const folderSementara = mkdtempSync(path.join(process.env.TMP || os.tmpdir(), "aleta-pengaturan-abt-"));
  mkdirSync(path.join(folderSementara, "derry_briantono", "1 Perceraian CG - BAS"), { recursive: true });
  writeFileSync(path.join(folderSementara, "derry_briantono", "1 Perceraian CG - BAS", "[01] BAS.rtf"), "{\\rtf1 #0046# hadir #0099#}", "latin1");
  writeFileSync(path.join(folderSementara, "derry_briantono", "1 Perceraian CG - BAS", "[02] BAS.rtf"), "{\\rtf1 #0046#}", "latin1");
  const ujiDiminta: Array<Record<string, unknown>> = [];
  const layanan = servisBot.buatLayanan({
    kueri: abt.kueri,
    transaksi: abt.transaksi,
    skemaAbt: "aps_badilag",
    akarBlangko: folderSementara,
    buatMesin: (opsi: { timpaKatalog: Record<string, { sql_query?: string }> }) => ({
      nilaiPenanda: async (_k: unknown, daftar: string[]) => {
        ujiDiminta.push(opsi.timpaKatalog);
        const timpa = opsi.timpaKatalog[daftar[0]] ?? {};
        const gagal = String(timpa.sql_query ?? "").includes("kolom_tidak_ada");
        return new Map([[daftar[0], gagal ? { status: "galat", sebab: "Unknown column", polos: "" } : { status: "terisi", sebab: "", polos: "Penggugat" }]]);
      },
    }),
  });

  beforeEach(() => {
    abt.setel();
    ujiDiminta.length = 0;
  });
  afterAll(() => rmSync(folderSementara, { recursive: true, force: true }));

  it("daftar variabel = penanda RTF Blangko Derry saja", async () => {
    const d = await layanan.daftarVariabel();
    expect(d.jumlahBerkas).toBe(2);
    expect(d.daftar.map((v) => [v.noVar, v.jumlahBlangko])).toEqual([
      ["0046", 2],
      ["0099", 1],
    ]);
  });

  it("menu: nilai lama berbeda = TIDAK ada yang ditulis; sama = ditulis dan terbaca kembali", async () => {
    await expect(layanan.simpanMenu({ ubah: [{ id: 102, lama: { user_grup_id: "1|30" }, baru: { user_grup_id: "1|30|500|10|20" } }] })).rejects.toMatchObject({ kode: "berubah" });
    expect(abt.tulisan).toEqual([]);
    const h = await layanan.simpanMenu({ ubah: [{ id: 102, lama: { user_grup_id: "1|30|500" }, baru: { user_grup_id: "1|30|500|10|20|20" } }], config: [{ name: "validasi_data_bas", lama: "0", baru: "1" }] });
    expect(abt.isi.menu[0].user_grup_id).toBe("1|30|500|10|20");
    expect(abt.isi.config.validasi_data_bas).toBe("1");
    expect(h).toMatchObject({ sebelum: [{ id: 102, user_grup_id: "1|30|500" }], sesudah: [{ id: 102, user_grup_id: "1|30|500|10|20" }] });
  });

  it("menu: folder di luar Blangko Derry, kolom terlarang, config tak dikenal ditolak", async () => {
    await expect(layanan.simpanMenu({ ubah: [{ id: 801, lama: { user_grup_id: "-1" }, baru: { user_grup_id: "1" } }] })).rejects.toMatchObject({ kode: "bukan_derry" });
    await expect(layanan.simpanMenu({ ubah: [{ id: 102, lama: { nama: "x" }, baru: { nama: "y" } }] })).rejects.toThrow(/tidak boleh diubah/);
    await expect(layanan.simpanMenu({ config: [{ name: "jenis_kertas", lama: "A4", baru: "A4s" }] })).rejects.toThrow(/tidak boleh diubah/);
    await expect(layanan.simpanMenu({ ubah: [{ id: 102, lama: { user_grup_id: "1|30|500" }, baru: { user_grup_id: "1|abc" } }] })).rejects.toThrow(/bukan nomor peran/);
    expect(abt.isi.menu[1].user_grup_id).toBe("-1");
  });

  it("menu: galat di tengah transaksi = semua dipulihkan (folder kedua gagal, folder pertama tidak tertinggal)", async () => {
    abt.gagalPada(/abt_config/);
    await expect(
      layanan.simpanMenu({ ubah: [{ id: 102, lama: { user_cek: 3 }, baru: { user_cek: 0 } }], config: [{ name: "validasi_data_bas", lama: "0", baru: "1" }] })
    ).rejects.toThrow(/galat tiruan/);
    expect(abt.isi.menu[0].user_cek).toBe(3);
    expect(abt.isi.config.validasi_data_bas).toBe("0");
  });

  it("template: diganti seluruhnya dalam satu transaksi tanpa rute hapus ABT; prasyarat & latin1 dijaga", async () => {
    const lama = [
      { tanya: "Apakah saksi kenal #0046#?", jawab: "Kenal" },
      { tanya: "Sejak kapan?", jawab: "" },
    ];
    await expect(layanan.simpanTemplat({ kode: "A1a", lama: lama.slice(0, 1), baru: lama })).rejects.toMatchObject({ kode: "berubah" });
    await expect(layanan.simpanTemplat({ kode: "A1a", lama, baru: [{ tanya: "Saksi 😀", jawab: "" }] })).rejects.toThrow(/huruf/);
    await expect(layanan.simpanTemplat({ kode: "A1a", lama, baru: [] })).rejects.toThrow(/sedikitnya satu/);
    expect(abt.tulisan).toEqual([]);
    const h = await layanan.simpanTemplat({ kode: "A1a", lama, baru: [{ tanya: "apakah <b>saksi</b> kenal?", jawab: "kenal" }, { tanya: "Baru", jawab: "" }, ...lama.slice(1)] });
    expect(abt.isi.tj.map((r) => [r.urutan_pertanyaan, r.pertanyaan, r.jawaban, r.modifier])).toEqual([
      [1, "Apakah saksi kenal?", "Kenal", "admin"],
      [2, "Baru", "", "admin"],
      [3, "Sejak kapan?", "", "admin"],
    ]);
    expect(h.sebelum).toEqual(lama);
    expect(abt.tulisan.every((t) => !/tanyajawab_template\?hapus/.test(t))).toBe(true);
    abt.gagalPada(/INSERT INTO/);
    await expect(layanan.simpanTemplat({ kode: "A1a", lama: (h.sesudah as typeof lama), baru: lama })).rejects.toThrow(/galat tiruan/);
    expect(abt.isi.tj).toHaveLength(3);
  });

  it("variabel: bukan Derry dan dikunci ABT ditolak; kueri tulis ditolak sebelum diuji; kueri gagal uji tidak disimpan", async () => {
    await expect(layanan.simpanVariabel({ noVar: "0500", lama: { default_data: "" }, baru: { default_data: "x" } })).rejects.toMatchObject({ kode: "bukan_derry" });
    await expect(layanan.simpanVariabel({ noVar: "0099", lama: { sql_query: "select 1 as data" }, baru: { sql_query: "select 2 as data" }, perkaraId: 1 })).rejects.toMatchObject({ kode: "dikunci" });
    await expect(layanan.simpanVariabel({ noVar: "0046", lama: { sql_query: "x" }, baru: { sql_query: "update perkara set a=1" }, perkaraId: 1 })).rejects.toMatchObject({ kode: "kueri_ditolak" });
    expect(ujiDiminta).toEqual([]);
    await expect(
      layanan.simpanVariabel({ noVar: "0046", lama: { sql_query: "select 'Penggugat' as data" }, baru: { sql_query: "select kolom_tidak_ada as data from perkara" }, perkaraId: 1 })
    ).rejects.toMatchObject({ kode: "uji_gagal" });
    expect(abt.tulisan).toEqual([]);
  });

  it("variabel: kueri lolos uji ditulis (prasyarat nilai lama); pulihkan menulis tanpa uji ulang", async () => {
    await expect(
      layanan.simpanVariabel({ noVar: "0046", lama: { sql_query: "bukan ini" }, baru: { sql_query: "select 'P' as data" }, perkaraId: 1 })
    ).rejects.toMatchObject({ kode: "berubah" });
    const h = await layanan.simpanVariabel({ noVar: "046", lama: { sql_query: "select 'Penggugat' as data" }, baru: { sql_query: "select 'P' as data" }, perkaraId: 1 });
    expect(ujiDiminta.at(-1)).toEqual({ "0046": { sql_query: "select 'P' as data" } });
    expect(abt.isi.variabel["0046"].sql_query).toBe("select 'P' as data");
    expect(h).toMatchObject({ sebelum: { sql_query: "select 'Penggugat' as data" }, sesudah: { sql_query: "select 'P' as data" } });
    const sebelumUji = ujiDiminta.length;
    await layanan.simpanVariabel({ noVar: "0046", lama: { sql_query: "select 'P' as data", default_data: "" }, baru: { sql_query: "select 'Penggugat' as data", default_data: "" }, pulihkan: true });
    expect(ujiDiminta.length).toBe(sebelumUji);
    expect(abt.isi.variabel["0046"]).toMatchObject({ sql_query: "select 'Penggugat' as data", default_data: null });
  });

  // Audit 18 Okt 2026: nama 2223 memuat #2223# -> render ABT macet >110 detik (memori habis); tanpa penanda itu selesai.
  // ABT mengisi penanda di NAMA dan KUERI tiap variabel dihitung, jadi rantai yang kembali ke dirinya berputar tanpa ujung.
  it("variabel: kueri yang membuat penanda berputar (langsung, lewat nama, lewat kueri lain) ditolak sebelum diuji dan ditulis", async () => {
    abt.isi.variabel["0700"] = { no_var: "0700", nama: "Nama untuk #0046#", data_type: "data_sql", sql_query: "select 'x' as data", default_data: null, locked: 0 };
    abt.isi.variabel["0701"] = { no_var: "0701", nama: "Rantai", data_type: "data_sql", sql_query: "select '#0700#' as data", default_data: null, locked: 0 };
    abt.isi.variabel["0702"] = { no_var: "0702", nama: "Bawaan saja", data_type: "data_teks", sql_query: null, default_data: "#0046#", locked: 0 };
    const simpan = (sql: string) => layanan.simpanVariabel({ noVar: "0046", lama: { sql_query: "select 'Penggugat' as data" }, baru: { sql_query: sql }, perkaraId: 1 });
    await expect(simpan("select '#0046#' as data")).rejects.toMatchObject({ kode: "penanda_berputar", message: expect.stringContaining("#0046# -> #0046#") });
    await expect(simpan("select '#0700#' as data")).rejects.toMatchObject({ kode: "penanda_berputar", message: expect.stringContaining("#0046# -> #0700# -> #0046#") });
    await expect(simpan("select '#0701#' as data")).rejects.toMatchObject({ message: expect.stringContaining("#0046# -> #0701# -> #0700# -> #0046#") });
    expect(ujiDiminta).toEqual([]);
    expect(abt.tulisan).toEqual([]);
    // bawaan (default_data) hanya dipakai popup - bukan putaran cetak; penanda biasa tetap boleh
    await layanan.simpanVariabel({ noVar: "0046", lama: { sql_query: "select 'Penggugat' as data" }, baru: { sql_query: "select '#0702# #0500#' as data" }, perkaraId: 1 });
    expect(abt.isi.variabel["0046"].sql_query).toBe("select '#0702# #0500#' as data");
  });

  it("variabel: nama tidak dapat diubah dari Pengaturan (hanya kueri dan bawaan) - nama berpenanda hanya lewat paket", async () => {
    await expect(layanan.simpanVariabel({ noVar: "0046", lama: { nama: "Sebutan P" }, baru: { nama: "Sebutan #0046#" } })).rejects.toThrow(/tidak boleh diubah/);
    expect(abt.tulisan).toEqual([]);
  });
});

// ─── 5. Rute portal ──────────────────────────────────────────────────────────

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
const panggilanBot: Array<{ jalur: string; method: string; body: Record<string, unknown> }> = [];
let botMenolak: { kode: string; error: string; status: number } | null = null;

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
vi.mock("@/server/modules/pengaturan-abt/gateway", () => ({
  panggilBotPengaturanAbt: async (jalur: string, pilihan: { method?: string; body?: Record<string, unknown> } = {}) => {
    panggilanBot.push({ jalur, method: pilihan.method ?? "GET", body: pilihan.body ?? {} });
    if (botMenolak) return { ok: false, ...botMenolak };
    if (jalur === "/menu")
      return { ok: true, data: { ok: true, grup: null, folder: FOLDER, peran: RUJUKAN.peran, proses: [], jenis: [], alur: [], config: { validasi_data_bas: "0" } } };
    if (jalur === "/menu/simpan") {
      const b = pilihan.body as { ubah: Array<{ id: number; lama: Record<string, unknown>; baru: Record<string, unknown> }>; config: Array<{ name: string; baru: string }> };
      return {
        ok: true,
        data: {
          ok: true,
          sebelum: b.ubah.map((u) => ({ id: u.id, ...u.lama })),
          sesudah: b.ubah.map((u) => ({ id: u.id, ...u.baru })),
          configSebelum: [],
          configSesudah: b.config.map((c) => ({ name: c.name, value: c.baru })),
        },
      };
    }
    if (jalur.startsWith("/variabel/0046"))
      return { ok: true, data: { ok: true, variabel: { noVar: "0046", nama: "Sebutan P", jenis: "data_sql", sql_query: "select 'Penggugat' as data", default_data: "", dikunci: false, blangko: ["a.rtf"] } } };
    if (jalur === "/variabel/uji") return { ok: true, data: { ok: true, uji: { ok: true, status: "terisi", sebab: "", nilai: "Penggugat", ms: 5 } } };
    if (jalur === "/variabel/simpan") {
      const b = pilihan.body as { lama: Record<string, string>; baru: Record<string, string> };
      return { ok: true, data: { ok: true, sebelum: b.lama, sesudah: b.baru, uji: null } };
    }
    if (jalur === "/templat/simpan") {
      const b = pilihan.body as { lama: unknown[]; baru: unknown[] };
      return { ok: true, data: { ok: true, sebelum: b.lama, sesudah: b.baru } };
    }
    return { ok: false, error: "jalur tidak dikenal", status: 404 };
  },
}));

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, unknown>; error?: { message: string } } };
async function rute(cara: "GET" | "POST", opsi: { query?: string; badan?: unknown } = {}): Promise<Hasil> {
  const modul = (await import("@/app/api/pengaturan-sipp-abt/route")) as unknown as Record<string, (r: NextRequest) => Promise<Response>>;
  const req = new NextRequest("http://localhost/api/pengaturan-sipp-abt" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const j = await modul[cara](req);
  return { status: j.status, isi: (await j.json()) as Hasil["isi"] };
}

const suntingan = async () => (await db!.queryAll<Record<string, string>>("SELECT * FROM aleta_abt_suntingan ORDER BY pada ASC, id ASC"));

describe("rute /api/pengaturan-sipp-abt (pg-mem berbenih, bot tiruan)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    panggilanBot.length = 0;
    botMenolak = null;
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("peran lain ditolak membaca maupun mengubah; Admin boleh membuka", async () => {
    aktor = "usr-ppg";
    expect((await rute("GET", { query: "bagian=menu" })).status).toBe(403);
    expect((await rute("POST", { badan: { tindakan: "simpan-templat", kode: "A1a", lama: [], baru: [{ tanya: "x", jawab: "" }] } })).status).toBe(403);
    expect(panggilanBot).toEqual([]);
    aktor = "usr-admin";
    const r = await rute("GET", { query: "bagian=menu" });
    expect(r.status).toBe(200);
    expect(r.isi.data.hak).toMatchObject({ ubahMenu: false, ubahTemplat: true });
    expect((r.isi.data.saklar as Array<{ kunci: string; keadaan: string }>).find((s) => s.kunci === "hakim-lihat-bas")!.keadaan).toBe("mati");
  });

  it("Admin tidak boleh mengubah hak menu maupun kueri, dan tidak melihat kueri; Super Admin melihatnya", async () => {
    aktor = "usr-admin";
    const ubah = [{ id: 102, lama: { user_grup_id: "1|30" }, baru: { user_grup_id: "1|30|20" } }];
    expect((await rute("POST", { badan: { tindakan: "simpan-menu", ubah } })).status).toBe(403);
    expect((await rute("POST", { badan: { tindakan: "simpan-variabel", noVar: "0046", lama: { sql_query: "a" }, baru: { sql_query: "select 1 as data" } } })).status).toBe(403);
    expect((await rute("POST", { badan: { tindakan: "uji-variabel", noVar: "0046", perkaraId: 1, sql_query: "select 1 as data" } })).status).toBe(403);
    const v = await rute("GET", { query: "bagian=variabel&noVar=0046" });
    expect((v.isi.data.variabel as Record<string, unknown>).sql_query).toBeUndefined();
    expect(panggilanBot.filter((p) => p.method === "POST")).toEqual([]);
    expect(await suntingan()).toEqual([]);
    aktor = "usr-super";
    const v2 = await rute("GET", { query: "bagian=variabel&noVar=0046" });
    expect((v2.isi.data.variabel as Record<string, unknown>).sql_query).toBe("select 'Penggugat' as data");
  });

  it("kueri tulis ditolak portal sebelum sampai ke bot dan tanpa catatan", async () => {
    const r = await rute("POST", { badan: { tindakan: "simpan-variabel", noVar: "0046", lama: { sql_query: "a" }, baru: { sql_query: "delete from perkara" }, perkaraId: 1 } });
    expect(r.status).toBe(400);
    const u = await rute("POST", { badan: { tindakan: "uji-variabel", noVar: "0046", perkaraId: 1, sql_query: "select 1 as data;; drop table x" } });
    expect((u.isi.data.uji as { ok: boolean; sebab: string }).sebab).toMatch(/titik koma ganda/);
    expect(panggilanBot).toEqual([]);
    expect(await suntingan()).toEqual([]);
  });

  it("Super Admin simpan hak menu: cadangan nilai lama tercatat, lalu Kembalikan menukar lama/baru", async () => {
    const ubah = [{ id: 102, lama: { user_grup_id: "1|30|500|430|1000|1010|1020" }, baru: { user_grup_id: "1|30|500|430|1000|1010|1020|10|20" } }];
    const r = await rute("POST", { badan: { tindakan: "simpan-menu", ubah, ringkas: "hakim melihat BAS" } });
    expect(r.status).toBe(200);
    const [s] = await suntingan();
    expect(s).toMatchObject({ jenis: "menu", kunci: "102", status: "tersimpan", oleh_id: "usr-super", ringkas: "hakim melihat BAS" });
    expect(JSON.parse(s.nilai_lama)).toEqual({ ubah: [{ id: 102, user_grup_id: "1|30|500|430|1000|1010|1020" }], config: [] });
    const k = await rute("POST", { badan: { tindakan: "kembalikan", id: s.id } });
    expect(k.status).toBe(200);
    const kirimanPulih = panggilanBot.filter((p) => p.jalur === "/menu/simpan").at(-1)!.body;
    expect(kirimanPulih.ubah).toEqual([{ id: 102, lama: { user_grup_id: "1|30|500|430|1000|1010|1020|10|20" }, baru: { user_grup_id: "1|30|500|430|1000|1010|1020" } }]);
    const semua = await suntingan();
    expect(semua).toHaveLength(2);
    expect(semua.find((x) => x.id !== s.id)).toMatchObject({ pulih_dari: s.id, status: "tersimpan" });
  });

  it("Admin simpan template; bot menolak (diubah orang lain) = catatan 'gagal' dengan sebabnya, status 409", async () => {
    aktor = "usr-admin";
    const lama = [{ tanya: "Apakah kenal?", jawab: "Kenal" }];
    const baru = [{ tanya: "Apakah saksi kenal?", jawab: "Kenal" }];
    expect((await rute("POST", { badan: { tindakan: "simpan-templat", kode: "A1a", lama, baru } })).status).toBe(200);
    botMenolak = { kode: "berubah", error: "Template ini sudah diubah orang lain", status: 409 };
    const r = await rute("POST", { badan: { tindakan: "simpan-templat", kode: "A1a", lama, baru: [{ tanya: "Lagi", jawab: "" }] } });
    expect(r.status).toBe(409);
    const s = await suntingan();
    const ok = s.find((x) => x.status === "tersimpan")!;
    const gagal = s.find((x) => x.status === "gagal")!;
    expect(s).toHaveLength(2);
    expect(gagal.galat).toMatch(/diubah orang lain/);
    expect(JSON.parse(ok.nilai_lama)).toEqual({ baris: lama });
    // Kembalikan hanya untuk yang tersimpan
    expect((await rute("POST", { badan: { tindakan: "kembalikan", id: gagal.id } })).status).toBe(400);
  });

  it("riwayat dapat disaring per jenis & kunci", async () => {
    await rute("POST", { badan: { tindakan: "simpan-variabel", noVar: "0046", lama: { default_data: "" }, baru: { default_data: "Penggugat" }, perkaraId: 1 } });
    await rute("POST", { badan: { tindakan: "simpan-templat", kode: "A1a", lama: [], baru: [{ tanya: "x", jawab: "" }] } });
    const r = await rute("GET", { query: "bagian=riwayat&jenis=variabel&kunci=0046" });
    expect((r.isi.data.riwayat as Array<{ jenis: string; kunci: string }>).map((x) => [x.jenis, x.kunci])).toEqual([["variabel", "0046"]]);
  });
});

describe("audit 17 Okt: riwayat tidak membocorkan kueri variabel ke Admin", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    panggilanBot.length = 0;
    botMenolak = null;
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("Super Admin menyimpan kueri; Admin membaca riwayat tanpa teks kueri, Super Admin tetap melihatnya", async () => {
    const KUERI = "select 'Pemohon Rahasia' as data from perkara where perkara_id = #perkara_id#";
    const s = await rute("POST", { badan: { tindakan: "simpan-variabel", noVar: "0046", lama: { sql_query: "select 'Penggugat' as data" }, baru: { sql_query: KUERI }, perkaraId: 1 } });
    expect(s.status).toBe(200);
    expect(JSON.stringify((await rute("GET", { query: "bagian=riwayat" })).isi)).toContain("Pemohon Rahasia");
    aktor = "usr-admin";
    const r = await rute("GET", { query: "bagian=riwayat" });
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.isi)).not.toContain("Pemohon Rahasia");
    expect(JSON.stringify(r.isi)).not.toContain("'Penggugat' as data");
    expect(JSON.stringify(r.isi)).toContain("kueri disembunyikan");
  });
});

describe("Putusan Advance per akun (17 Okt) - aleta_ekstensi_setelan, tanpa migrasi", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-admin";
    panggilanBot.length = 0;
    botMenolak = null;
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("bawaan: belum tersimpan, akun benih (tanpa Derry Briantono) semuanya mati", async () => {
    const r = await rute("GET", { query: "bagian=putusan-advance" });
    expect(r.status).toBe(200);
    expect(r.isi.data.tersimpan).toBe(false);
    const calon = r.isi.data.calon as Array<{ id: string; menyala: boolean }>;
    expect(calon.some((c) => c.id === "usr-hakim")).toBe(true);
    expect(calon.every((c) => !c.menyala)).toBe(true);
  });

  it("Admin menyalakan satu akun: tersimpan, tercatat audit, rute membaca saklarnya; peran lain 403; akun tak dikenal 400", async () => {
    const r = await rute("POST", { badan: { tindakan: "simpan-putusan-advance", akun: ["usr-hakim"] } });
    expect(r.status).toBe(200);
    const calon = r.isi.data.calon as Array<{ id: string; menyala: boolean }>;
    expect(calon.find((c) => c.id === "usr-hakim")?.menyala).toBe(true);
    expect(calon.filter((c) => c.menyala).length).toBe(1);
    const { advanceMenyalaUntuk } = await import("@/server/modules/aleta-ecourt/putusan-advance-akun");
    expect(await advanceMenyalaUntuk(db!, { id: "usr-hakim", name: "Hj. Nur Aisyah" })).toBe(true);
    expect(await advanceMenyalaUntuk(db!, { id: "usr-ketua", name: "Drs. H. Malik" })).toBe(false);
    const jejak = await db!.queryAll<Record<string, string>>("SELECT action FROM audit_logs WHERE action = 'UPDATE_PUTUSAN_ADVANCE_AKUN'");
    expect(jejak.length).toBe(1);
    expect((await rute("POST", { badan: { tindakan: "simpan-putusan-advance", akun: ["usr-tidak-ada"] } })).status).toBe(400);
    aktor = "usr-ppg";
    expect((await rute("POST", { badan: { tindakan: "simpan-putusan-advance", akun: ["usr-ppg"] } })).status).toBe(403);
    expect((await rute("GET", { query: "bagian=putusan-advance" })).status).toBe(403);
    expect(panggilanBot).toEqual([]);
  });
});
