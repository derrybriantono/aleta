// @vitest-environment node
/**
 * ============================================================================
 * PUSTAKA ALETA ABT (3 Nov 2026, Tahap 1, migrasi 0133)
 * ============================================================================
 *   1. migrasi 0133 = DDL schema.ts = urutan penyimpanan; jurnal idx 115 naik dari 0132; tanpa kunci asing;
 *   2. kode ALETA ABT: diberikan sekali, cermin nomor asal bila bebas, sesudah itu TIDAK bergantung nomor ABT -
 *      server lain memetakan kode yang sama ke nomor lain;
 *   3. aturan sinkron: baru ditambah, berubah ikut bila belum diubah di ALETA, ubahan ALETA tidak pernah ditimpa
 *      (bentrok dicatat), hilang hanya ditandai, dijalankan dua kali = tidak menulis apa pun;
 *   4. pg-mem dengan SQL migrasi sungguhan: sinkron penuh berkas/variabel/menu + bentrok + hilang + idempoten;
 *   5. pembaca bot (baca saja): potret folder + penutupan variabel turunan, isi berkas aman dari jalur keluar akar.
 */
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { newDb } from "pg-mem";
import { afterAll, describe, expect, it } from "vitest";

import { berikanKode, kodeSah, nomorBaku, petaRujukan, rencanaSinkron, type KeadaanBaris } from "@/lib/aleta-abt-pustaka";
import { DDL_ALETA_ABT_PUSTAKA } from "@/server/db/schema";
import {
  bitaIsi,
  jalankanSinkron,
  ringkasanPustaka,
  sidikVariabel,
  simpananIsi,
  type BerkasPotret,
  type MenuPotret,
  type PotretAbt,
  type VariabelPotret,
} from "@/server/modules/aleta-abt-pustaka/service";

const M = process.cwd();
const AKAR = path.resolve(M, "..");
const SQL = readFileSync(path.join(M, "drizzle/0133_aleta_abt_pustaka.sql"), "utf8");
// Tahap 9: sinkron kini juga menyimpan versi lama (0135) dan pembanding (0136).
const SQL_0135 = readFileSync(path.join(M, "drizzle/0135_aleta_abt_penyunting.sql"), "utf8");
const SQL_0136 = readFileSync(path.join(M, "drizzle/0136_aleta_abt_banding.sql"), "utf8");
const JURNAL = JSON.parse(readFileSync(path.join(M, "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; when: number; tag: string }> };
const KLIEN = readFileSync(path.join(M, "src/server/db/client.ts"), "utf8");
const muatBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));

const rapat = (s: string) => s.replace(/--.*$/gm, "").replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").trim();
const TABEL = ["aleta_abt_berkas", "aleta_abt_variabel", "aleta_abt_peta_variabel", "aleta_abt_menu", "aleta_abt_sinkron"];

describe("migrasi 0133", () => {
  it("SQL = DDL schema.ts; jurnal idx 115 sesudah 0132; lima tabel terdaftar di urutan penyimpanan; tanpa kunci asing", () => {
    const sqlTabel = SQL.match(/CREATE TABLE IF NOT EXISTS [\s\S]*?\n\);/g)!.map((t) => rapat(t.replace(/;$/, "")));
    expect(DDL_ALETA_ABT_PUSTAKA.tabel.map(rapat)).toEqual(sqlTabel);
    expect(DDL_ALETA_ABT_PUSTAKA.indeks.map(rapat)).toEqual(SQL.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS [^;]+/g)!.map(rapat));
    expect(sqlTabel.map((t) => /EXISTS (\w+)/.exec(t)![1])).toEqual(TABEL);
    const e = JURNAL.entries;
    const i = e.findIndex((x) => x.tag === "0133_aleta_abt_pustaka");
    expect(e[i]).toMatchObject({ idx: 115 });
    expect(e[i - 1].tag).toBe("0132_aleta_register_kuasa");
    expect(e[i].when).toBeGreaterThan(e[i - 1].when);
    expect(new Set(e.map((x) => x.idx)).size).toBe(e.length);
    for (const t of TABEL) expect(KLIEN).toContain(`"${t}"`);
    expect(SQL).not.toMatch(/REFERENCES|FOREIGN KEY/i);
    // Tanpa tanda ALETA ke ABT: bot pustaka hanya SELECT dan membaca berkas.
    const bot = readFileSync(path.join(AKAR, "aleta_bot/services/pustakaAbtDerryService.js"), "utf8");
    expect(bot).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|TRUNCATE)\b\s/);
    expect(bot).not.toMatch(/writeFile|appendFile|unlink|rename|mkdir|rmSync/);
  });
});

describe("kode ALETA ABT", () => {
  it("cermin nomor asal bila bebas, nomor bebas berikutnya bila terpakai; hasil sama tiap dijalankan", () => {
    const a = berikanKode(["1217", "0046", "12120"], []);
    expect([...a.entries()]).toEqual([
      ["0046", "AA00046"],
      ["1217", "AA01217"],
      ["12120", "AA12120"],
    ]);
    expect(berikanKode(["1217", "0046", "12120"], [])).toEqual(a);
    const b = berikanKode(["1217", "0046"], ["AA01217", "AA100003"]);
    expect(b.get("0046")).toBe("AA00046");
    expect(b.get("1217")).toBe("AA100004");
    expect([...a.values(), ...b.values()].every(kodeSah)).toBe(true);
    expect(kodeSah("#1217#")).toBe(false);
    expect(nomorBaku("46")).toBe("0046");
    expect(nomorBaku("012120")).toBe("12120");
  });

  it("rujukan #NNNN# -> kode lewat peta server; nomor tanpa peta dicatat terpisah", () => {
    const peta = new Map([
      ["0046", "AA00046"],
      ["1217", "AA01217"],
    ]);
    expect(petaRujukan(["46", "1217", "9999", "0046"], peta)).toEqual({ kode: ["AA00046", "AA01217"], takTerpeta: ["9999"] });
  });
});

describe("aturan sinkron (murni)", () => {
  const baris = (kunci: string, lain: Partial<KeadaanBaris> = {}): KeadaanBaris => ({ kunci, sidikAsal: `s-${kunci}`, diubah: false, asal: "abt", status: "aktif", bentrokSidik: "", ...lain });

  it("baru, sama, berubah, bentrok, hilang, kembali - tanpa keluaran hapus atau timpa", () => {
    const ada = [
      baris("sama"),
      baris("berubah"),
      baris("diubah-aleta", { diubah: true }),
      baris("diubah-aleta-abt-tetap", { diubah: true }),
      baris("buatan-aleta", { asal: "aleta" }),
      baris("hilang"),
      baris("sudah-hilang", { status: "hilang" }),
      baris("kembali", { status: "hilang" }),
    ];
    const r = rencanaSinkron(ada, [
      { kunci: "sama", sidik: "s-sama" },
      { kunci: "berubah", sidik: "baru-dari-abt" },
      { kunci: "diubah-aleta", sidik: "baru-dari-abt" },
      { kunci: "diubah-aleta-abt-tetap", sidik: "s-diubah-aleta-abt-tetap" },
      { kunci: "buatan-aleta", sidik: "apa-saja" },
      { kunci: "kembali", sidik: "s-kembali" },
      { kunci: "baru", sidik: "x" },
      { kunci: "baru", sidik: "ganda-dilewati" },
    ]);
    expect(r).toEqual({
      baru: ["baru"],
      berubah: ["berubah"],
      kembali: ["kembali"],
      sama: ["sama", "diubah-aleta-abt-tetap"],
      bentrok: ["diubah-aleta", "buatan-aleta"],
      bentrokBaru: ["diubah-aleta", "buatan-aleta"],
      hilang: ["hilang"],
    });
    expect(Object.keys(r)).not.toContain("hapus");
  });

  it("bentrok yang sama tidak ditulis ulang; baris buatan ALETA tidak pernah ditandai hilang", () => {
    const r = rencanaSinkron([baris("a", { diubah: true, bentrokSidik: "abt-2" }), baris("b", { asal: "aleta" })], [{ kunci: "a", sidik: "abt-2" }]);
    expect(r.bentrok).toEqual(["a"]);
    expect(r.bentrokBaru).toEqual([]);
    expect(r.hilang).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// pg-mem
// ---------------------------------------------------------------------------

async function siapkan() {
  const mem = newDb();
  mem.public.none(SQL);
  mem.public.none(SQL_0135);
  mem.public.none(SQL_0136);
  const { Client } = mem.adapters.createPg();
  const c = new Client();
  await c.connect();
  const ubah = (q: string) => {
    let n = 0;
    return q.replace(/\?/g, () => `$${++n}`);
  };
  const db = {
    queryAll: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows,
    run: async (q: string, p: unknown[] = []) => {
      await c.query(ubah(q), p);
    },
  };
  const baca = async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows as Array<Record<string, unknown>>;
  let n = 0;
  const mulai = async () => {
    const id = `s${++n}`;
    await db.run("INSERT INTO aleta_abt_sinkron (id, status, oleh, mulai_at) VALUES (?, 'jalan', 'Derry', ?)", [id, `2026-11-03T14:0${n}:00.000Z`]);
    return id;
  };
  return { db: db as never, dbUji: db, baca, mulai };
}

const md5 = (t: string) => createHash("md5").update(Buffer.from(t, "latin1")).digest("hex");

function berkas(jalur: string, isi: string, penanda: string[] = []): BerkasPotret & { isiTeks: string } {
  const bagian = jalur.split("/");
  return { jalur, folder: bagian[0], nama: bagian[bagian.length - 1], arsip: /^ALUR/.test(jalur), md5: md5(isi), ukuran: Buffer.byteLength(isi, "latin1"), waktu: "2026-11-02T10:00:00.000Z", penanda, isiTeks: isi };
}

function variabel(no: string, lain: Partial<VariabelPotret> = {}): VariabelPotret {
  return { no, nama: `Isian ${no}`, data_type: "data_sql", data_tabel: null, data_kolom: null, urutan_data: null, referensi: null, sql_query: `SELECT '${no}' AS data`, default_data: null, multi_sidang: null, locked: 0, sumber: "blangko", jumlahBlangko: 1, rujukan: [], ...lain };
}

function menu(direktori: string, lain: Partial<MenuPotret> = {}): MenuPotret {
  return { id: "101", nama: direktori, nama_alias: direktori, direktori, parent_direktori: "derry_briantono", user_grup_id: "1|10|20", user_top_id: "1", user_validator: null, user_cek: "3", proses_id_min: "80", proses_id_max: "297", perkara_id_min: "347", perkara_id_max: "347", perkara_id_referensi: "jenis_perkara_id", ...lain };
}

type PotretUji = Omit<PotretAbt, "berkas"> & { berkas: Array<BerkasPotret & { isiTeks?: string }> };

function deps(potret: () => PotretUji, catat: string[][] = []) {
  return {
    ambilPotret: async () => potret(),
    ambilIsi: async (jalur: string[]) => {
      catat.push(jalur);
      const p = potret();
      return {
        berkas: jalur
          .map((j) => p.berkas.find((b) => b.jalur === j))
          .filter(Boolean)
          .map((b) => ({ jalur: b!.jalur, md5: b!.md5, ukuran: b!.ukuran, isi: Buffer.from(b!.isiTeks ?? "", "latin1").toString("base64") })),
        ditolak: [],
        lewat: [],
      };
    },
    transaksi: async <T,>(kerja: (tx: never) => Promise<T>) => kerja(undefined as never),
    kini: () => "2026-11-03T14:30:00.000Z",
  };
}

describe("sinkron ABT -> ALETA ABT (pg-mem, SQL migrasi sungguhan)", () => {
  it("salinan pertama, dijalankan ulang tanpa menulis, ubahan ABT ikut, ubahan ALETA tidak ditimpa, yang hilang hanya ditandai", async () => {
    const { db, dbUji, baca, mulai } = await siapkan();
    const isiCg = "{\\rtf1 Putusan #0046# lawan #0047# \\'e9 #1217#}";
    let keadaan = {
      server: "PA.Dgl",
      berkas: [berkas("1 Perceraian CG/[01] Kabul.rtf", isiCg, ["0046", "0047", "1217"]), berkas("2 Itsbat Nikah/[01] Kabul.rtf", "{\\rtf1 #0046#}", ["0046"])],
      variabel: [variabel("0046"), variabel("0047"), variabel("1217", { rujukan: ["0046"], sql_query: "SELECT CONCAT('#0046#') AS data" }), variabel("9550", { sumber: "turunan", jumlahBlangko: 0 })],
      menu: [menu("1 Perceraian CG"), menu("2 Itsbat Nikah", { id: "102" })],
      takDikenal: ["7777"],
    };
    // dbx: pg-mem tanpa transaksi sungguhan - pelaksana langsung memakai db yang sama
    const d = (catat?: string[][]) => ({ ...deps(() => keadaan, catat), transaksi: async <T,>(kerja: (tx: never) => Promise<T>) => kerja(db) });

    const satu = await jalankanSinkron(db, await mulai(), d());
    expect(satu.berkas).toMatchObject({ baru: 2, sama: 0, gagal: 0 });
    expect(satu.variabel).toMatchObject({ baru: 4 });
    expect(satu.menu).toMatchObject({ baru: 2 });
    expect(satu.takDikenal).toBe(1);
    const cg = (await baca("SELECT * FROM aleta_abt_berkas WHERE id = ?", ["1 Perceraian CG/[01] Kabul.rtf"]))[0];
    expect(bitaIsi(String(cg.isi), String(cg.pengkodean)).toString("latin1")).toBe(isiCg);
    expect(JSON.parse(String(cg.penanda_kode))).toEqual(["AA00046", "AA00047", "AA01217"]);
    const v1217 = (await baca("SELECT * FROM aleta_abt_variabel WHERE kode = 'AA01217'"))[0];
    expect(v1217).toMatchObject({ asal_no: "1217", asal_server: "PA.Dgl", sql_query: "SELECT CONCAT('#0046#') AS data", diubah: 0, status: "aktif" });
    expect(JSON.parse(String(v1217.rujukan_kode))).toEqual(["AA00046"]);
    expect(await baca("SELECT server, no_var, kode FROM aleta_abt_peta_variabel ORDER BY no_var")).toEqual([
      { server: "PA.Dgl", no_var: "0046", kode: "AA00046" },
      { server: "PA.Dgl", no_var: "0047", kode: "AA00047" },
      { server: "PA.Dgl", no_var: "1217", kode: "AA01217" },
      { server: "PA.Dgl", no_var: "9550", kode: "AA09550" },
    ]);

    // Dijalankan ulang tanpa perubahan: tidak satu baris pun ditulis, tidak ada isi yang diminta.
    const catat: string[][] = [];
    const dua = await jalankanSinkron(db, await mulai(), d(catat));
    expect(dua.tulis).toBe(0);
    expect(catat).toEqual([]);
    expect(dua.berkas).toMatchObject({ baru: 0, sama: 2, berubah: 0, bentrok: 0, hilang: 0 });
    expect(dua.sidik).toBe(satu.sidik);

    // Derry mengubah blangko Itsbat + isian 0047 + hak folder CG di ALETA ABT (tahap berikut menulis diubah = 1).
    await dbUji.run("UPDATE aleta_abt_berkas SET isi = 'UBAHAN ALETA', diubah = 1 WHERE id = '2 Itsbat Nikah/[01] Kabul.rtf'");
    await dbUji.run("UPDATE aleta_abt_variabel SET sql_query = 'UBAHAN ALETA', diubah = 1 WHERE kode = 'AA00047'");
    await dbUji.run("UPDATE aleta_abt_menu SET user_grup_id = '1', diubah = 1 WHERE id = '1 Perceraian CG'");
    // ...lalu di ABT: CG berubah, Itsbat berubah, 0047 & 1217 berubah, menu CG berubah, berkas baru, 9550 & menu Itsbat hilang.
    const isiCgBaru = "{\\rtf1 Putusan BARU #0046# #0047#}";
    keadaan = {
      ...keadaan,
      berkas: [
        berkas("1 Perceraian CG/[01] Kabul.rtf", isiCgBaru, ["0046", "0047"]),
        berkas("2 Itsbat Nikah/[01] Kabul.rtf", "{\\rtf1 versi ABT #0046#}", ["0046"]),
        berkas("ALUR CG/[00] alur.rtf", "{\\rtf1 alur}"),
      ],
      variabel: [variabel("0046"), variabel("0047", { sql_query: "SELECT 'ABT baru' AS data" }), variabel("1217", { nama: "Nama Wali Nikah (diperbarui)" })],
      menu: [menu("1 Perceraian CG", { user_grup_id: "1|10|20|30" })],
    };
    const tiga = await jalankanSinkron(db, await mulai(), d());
    expect(tiga.berkas).toMatchObject({ baru: 1, berubah: 1, bentrok: 1, hilang: 0, gagal: 0 });
    expect(tiga.variabel).toMatchObject({ berubah: 1, bentrok: 1, hilang: 1, sama: 1 });
    expect(tiga.menu).toMatchObject({ bentrok: 1, hilang: 1 });
    const semua = await baca("SELECT id, isi, diubah, status, bentrok_md5, arsip FROM aleta_abt_berkas ORDER BY id");
    expect(semua).toHaveLength(3);
    expect(semua.find((b) => b.id === "1 Perceraian CG/[01] Kabul.rtf")!.isi).toBe(isiCgBaru);
    const itsbat = semua.find((b) => b.id === "2 Itsbat Nikah/[01] Kabul.rtf")!;
    expect(itsbat).toMatchObject({ isi: "UBAHAN ALETA", diubah: 1, bentrok_md5: md5("{\\rtf1 versi ABT #0046#}") });
    expect(semua.find((b) => b.id === "ALUR CG/[00] alur.rtf")).toMatchObject({ arsip: 1, status: "aktif" });
    expect((await baca("SELECT sql_query, bentrok_sidik FROM aleta_abt_variabel WHERE kode = 'AA00047'"))[0]).toMatchObject({
      sql_query: "UBAHAN ALETA",
      bentrok_sidik: sidikVariabel(variabel("0047", { sql_query: "SELECT 'ABT baru' AS data" })),
    });
    expect((await baca("SELECT nama FROM aleta_abt_variabel WHERE kode = 'AA01217'"))[0].nama).toBe("Nama Wali Nikah (diperbarui)");
    expect((await baca("SELECT status FROM aleta_abt_variabel WHERE kode = 'AA09550'"))[0].status).toBe("hilang");
    expect((await baca("SELECT status FROM aleta_abt_peta_variabel WHERE no_var = '9550'"))[0].status).toBe("hilang");
    expect(await baca("SELECT id, user_grup_id, status, bentrok_sidik <> '' AS bentrok FROM aleta_abt_menu ORDER BY id")).toEqual([
      { id: "1 Perceraian CG", user_grup_id: "1", status: "aktif", bentrok: true },
      { id: "2 Itsbat Nikah", user_grup_id: "1|10|20", status: "hilang", bentrok: false },
    ]);

    // Diulang: bentrok tetap tercatat, tetapi tidak ditulis ulang; yang hilang tidak ditandai dua kali.
    const empat = await jalankanSinkron(db, await mulai(), d());
    expect(empat.tulis).toBe(0);
    expect(empat.berkas.bentrok).toBe(1);

    const r = await ringkasanPustaka(db);
    expect(r.berkas).toMatchObject({ aktif: 3, arsip: 1, bentrok: 1, diubah: 1, hilang: 0 });
    expect(r.variabel).toMatchObject({ aktif: 3, hilang: 1, bentrok: 1 });
    expect(r.menu).toMatchObject({ aktif: 1, hilang: 1, bentrok: 1 });
    expect(r.peta).toEqual([{ server: "PA.Dgl", jumlah: 3 }]);
    expect(r.bentrok.map((b) => b.jenis).sort()).toEqual(["berkas", "menu", "variabel"]);
    expect(r.riwayat).toHaveLength(4);
    expect(r.riwayat.every((x) => x.status === "berhasil")).toBe(true);
    expect(r.sedangJalan).toBe(false);
  });

  it("server lain: kode yang sama, nomor ABT berbeda - kode tidak ikut nomor setempat", async () => {
    const { db, dbUji, baca, mulai } = await siapkan();
    const def = { nama: "Nama Wali Nikah", sql_query: "SELECT 'wali' AS data" };
    const dasar = {
      berkas: [berkas("7 Wali Adhal/[01] Kabul.rtf", "{\\rtf1 #1217#}", ["1217"])],
      menu: [menu("7 Wali Adhal")],
    };
    const d = (p: PotretUji) => ({ ...deps(() => p), transaksi: async <T,>(kerja: (tx: never) => Promise<T>) => kerja(db) });
    await jalankanSinkron(db, await mulai(), d({ server: "PA.Dgl", ...dasar, variabel: [variabel("1217", def)] }));
    // Pemetaan tangan di server lain (tahap berikut): #5000# di PA.Lain = isian AA01217.
    await dbUji.run("INSERT INTO aleta_abt_peta_variabel (id, server, no_var, kode, sidik, status, dibuat_at, diubah_at) VALUES ('PA.Lain|5000', 'PA.Lain', '5000', 'AA01217', '', 'aktif', 'x', 'x')");
    // Di PA.Lain nomor 1217 dipakai isian LAIN milik satker itu -> mendapat kode baru, tidak menimpa AA01217.
    const h = await jalankanSinkron(
      db,
      await mulai(),
      d({ server: "PA.Lain", berkas: [berkas("7 Wali Adhal/[01] Kabul.rtf", "{\\rtf1 #5000# #1217#}", ["5000", "1217"])], menu: dasar.menu, variabel: [variabel("5000", def), variabel("1217", { nama: "Isian lain satker itu" })] })
    );
    expect(h.variabel).toMatchObject({ baru: 1, sama: 1 });
    expect(await baca("SELECT server, no_var, kode FROM aleta_abt_peta_variabel ORDER BY server, no_var")).toEqual([
      { server: "PA.Dgl", no_var: "1217", kode: "AA01217" },
      { server: "PA.Lain", no_var: "1217", kode: "AA100000" },
      { server: "PA.Lain", no_var: "5000", kode: "AA01217" },
    ]);
    expect((await baca("SELECT nama FROM aleta_abt_variabel WHERE kode = 'AA01217'"))[0].nama).toBe("Nama Wali Nikah");
    expect((await baca("SELECT nama, asal_server, asal_no FROM aleta_abt_variabel WHERE kode = 'AA100000'"))[0]).toEqual({ nama: "Isian lain satker itu", asal_server: "PA.Lain", asal_no: "1217" });
    // Berkas yang sama dari server lain berbeda md5 -> salinan diperbarui (belum diubah di ALETA), penandanya ke kode masing-masing.
    expect(JSON.parse(String((await baca("SELECT penanda_kode FROM aleta_abt_berkas"))[0].penanda_kode))).toEqual(["AA01217", "AA100000"]);
  });

  it("folder kosong/tak terbaca: sinkron dibatalkan, tidak ada yang ditandai hilang; md5 isi yang tidak cocok tidak disimpan", async () => {
    const { db, baca, mulai } = await siapkan();
    const isi = berkas("1 Perceraian CG/[01] a.rtf", "{\\rtf1 a}");
    const d = (p: PotretUji) => ({ ...deps(() => p), transaksi: async <T,>(kerja: (tx: never) => Promise<T>) => kerja(db) });
    await jalankanSinkron(db, await mulai(), d({ server: "PA.Dgl", berkas: [isi], variabel: [], menu: [] }));
    const id = await mulai();
    await expect(jalankanSinkron(db, id, d({ server: "PA.Dgl", berkas: [], variabel: [], menu: [] }))).rejects.toThrow(/dibatalkan/);
    expect((await baca("SELECT status FROM aleta_abt_berkas"))[0].status).toBe("aktif");
    expect((await baca("SELECT status FROM aleta_abt_sinkron WHERE id = ?", [id]))[0].status).toBe("gagal");
    const rusak = { ...berkas("1 Perceraian CG/[02] b.rtf", "{\\rtf1 b}"), isiTeks: "isi lain" };
    const h = await jalankanSinkron(db, await mulai(), d({ server: "PA.Dgl", berkas: [isi, rusak], variabel: [], menu: [] }));
    expect(h.berkas.gagal).toBe(1);
    expect(await baca("SELECT id FROM aleta_abt_berkas ORDER BY id")).toEqual([{ id: "1 Perceraian CG/[01] a.rtf" }]);
  });

  it("isi RTF disimpan apa adanya (latin1); bita nol -> base64", () => {
    const b = Buffer.from([0x7b, 0x5c, 0xe9, 0xff, 0x7d]);
    expect(simpananIsi(b)).toEqual({ isi: b.toString("latin1"), pengkodean: "latin1" });
    expect(bitaIsi(simpananIsi(b).isi, "latin1").equals(b)).toBe(true);
    const n = Buffer.from([1, 0, 2]);
    expect(simpananIsi(n).pengkodean).toBe("base64");
    expect(bitaIsi(simpananIsi(n).isi, "base64").equals(n)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pembaca bot (baca saja)
// ---------------------------------------------------------------------------

describe("pembaca bot pustakaAbtDerryService", () => {
  const sementara = mkdtempSync(path.join(process.env.TMP || os.tmpdir(), "pustaka-abt-"));
  afterAll(() => rmSync(sementara, { recursive: true, force: true }));
  const derry = path.join(sementara, "derry_briantono");
  mkdirSync(path.join(derry, "1 Perceraian CG"), { recursive: true });
  mkdirSync(path.join(derry, "ALUR CG"), { recursive: true });
  writeFileSync(path.join(derry, "1 Perceraian CG", "[01] Kabul.rtf"), Buffer.from("{\\rtf1 #0046# #1217# #01{\\b 23}# #46#}", "latin1"));
  writeFileSync(path.join(derry, "ALUR CG", "alur.rtf"), Buffer.from("{\\rtf1 #8000#}", "latin1"));
  writeFileSync(path.join(sementara, "rahasia.txt"), "di luar akar");

  const { buatPustaka, jalurAman } = muatBot("./services/pustakaAbtDerryService.js") as {
    buatPustaka: (d: Record<string, unknown>) => { potret: () => Promise<PotretAbt & { takDikenal: string[]; grup: unknown }>; isi: (j: string[]) => Promise<{ berkas: Array<{ jalur: string; md5: string; isi: string }>; ditolak: string[] }> };
    jalurAman: (akar: string, rel: string) => string | null;
  };
  const katalog = [
    { no_var: "0046", nama: "P", data_type: "data_sipp", referensi: null, sql_query: null, default_data: null, multi_sidang: null, locked: "1" },
    { no_var: "0047", nama: "T", data_type: "data_sipp", referensi: null, sql_query: null, default_data: null, multi_sidang: null, locked: "1" },
    { no_var: "1217", nama: "Wali", data_type: "data_sql", referensi: null, sql_query: "SELECT '#9550#' AS data", default_data: "#0120#", multi_sidang: null, locked: "0" },
    { no_var: "9550", nama: "SK", data_type: "data_sql", referensi: "0011", sql_query: "SELECT 'x'", default_data: null, multi_sidang: null, locked: "0" },
    { no_var: "0011", nama: "Tgl", data_type: "data_tanggal", referensi: null, sql_query: null, default_data: null, multi_sidang: null, locked: "0" },
    { no_var: "0120", nama: "Hadir", data_type: "multi_sidang", referensi: null, sql_query: null, default_data: null, multi_sidang: "dihadiri_oleh", locked: "0" },
    { no_var: "8000", nama: "Alur", data_type: "data_teks", referensi: null, sql_query: null, default_data: null, multi_sidang: null, locked: "0" },
  ];
  const kueri: string[] = [];
  const p = buatPustaka({
    akarBlangko: sementara,
    skemaAbt: "aps_badilag",
    kueri: async (sql: string) => {
      kueri.push(sql);
      if (/abt_variabel/.test(sql)) return katalog;
      if (/FROM aps_badilag\.abt_menu WHERE/.test(sql)) return [{ id: "101", nama: "Putusan CG", direktori: "1 Perceraian CG", parent_direktori: "derry_briantono", user_cek: "3" }];
      if (/abt_menu_grup/.test(sql)) return [{ id: "99", nama: "Blangko Derry", direktori: "derry_briantono" }];
      if (/sys_config/.test(sql)) return [{ value: "PA.Dgl" }];
      return [];
    },
  });

  it("potret: semua berkas + md5 + penanda (terpecah disatukan), penutupan variabel turunan, nomor tak dikenal, server KodePN", async () => {
    const h = await p.potret();
    expect(h.server).toBe("PA.Dgl");
    expect(h.berkas.map((b) => [b.jalur, b.arsip, b.penanda])).toEqual([
      ["1 Perceraian CG/[01] Kabul.rtf", false, ["0046", "1217", "0123"]],
      ["ALUR CG/alur.rtf", true, ["8000"]],
    ]);
    expect(h.variabel.map((v) => [v.no, v.sumber])).toEqual([
      ["0011", "turunan"],
      ["0046", "blangko"],
      ["0047", "turunan"],
      ["0120", "turunan"],
      ["1217", "blangko"],
      ["8000", "blangko"],
      ["9550", "turunan"],
    ]);
    expect(h.takDikenal).toEqual(["0123"]);
    expect(h.menu[0]).toMatchObject({ direktori: "1 Perceraian CG", user_cek: "3" });
    expect(kueri.every((q) => /^\s*SELECT\b/i.test(q))).toBe(true);
  });

  it("isi: md5 sama dengan potret; jalur keluar akar ditolak", async () => {
    const h = await p.potret();
    const i = await p.isi(["1 Perceraian CG/[01] Kabul.rtf", "../rahasia.txt", "/etc/passwd", "1 Perceraian CG/../../rahasia.txt"]);
    expect(i.berkas.map((b) => b.md5)).toEqual([h.berkas[0].md5]);
    expect(Buffer.from(i.berkas[0].isi, "base64").toString("latin1")).toContain("#1217#");
    expect(i.ditolak).toEqual(["../rahasia.txt", "/etc/passwd", "1 Perceraian CG/../../rahasia.txt"]);
    expect(jalurAman(derry, "a/b.rtf")).toBe(path.join(derry, "a", "b.rtf"));
  });
});
