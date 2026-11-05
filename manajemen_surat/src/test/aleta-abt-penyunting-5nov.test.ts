// @vitest-environment node
/**
 * ============================================================================
 * PENYUNTING BLANGKO DAN VERSI ALETA ABT (5 Nov 2026, Tahap 3, migrasi 0135)
 * ============================================================================
 *   1. migrasi 0135 = DDL schema.ts = urutan penyimpanan; jurnal idx 117 sesudah 0134; tanpa kunci asing;
 *   2. buka: isian bernama (nomor tidak tampil), kepala/kaki/kotak/tabel terkunci, berkas non-RTF tidak disunting;
 *   3. tiap simpan = versi baru (draf); isi pustaka TIDAK berubah sampai terbit; salah dasar = 409; tanpa ubahan = 400;
 *   4. terbit mengganti isi pustaka + menandai diubah; Sinkron dari ABT tidak menimpanya (bentrok dicatat);
 *   5. pulihkan = bita identik (md5 dan isi sama persis), bahkan untuk isi yang memuat bita nol;
 *   6. beda antarversi, coba pada perkara rekaan (tanpa kata Aleta, tanpa data nyata).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import { PEMISAH_PARAGRAF, uraiRtf } from "@/lib/aleta-abt-rtf";
import { DDL_ALETA_ABT_PENYUNTING } from "@/server/db/schema";
import { bitaIsi, jalankanSinkron, simpananIsi, type PotretAbt } from "@/server/modules/aleta-abt-pustaka/service";
import {
  bedaAntarVersi,
  bukaBlangko,
  cobaBlangko,
  daftarBlangko,
  daftarIsian,
  pulihkanVersi,
  riwayatVersi,
  simpanSuntingan,
  terbitkanVersi,
} from "@/server/modules/aleta-abt-penyunting/service";

const M = process.cwd();
const SQL_0133 = readFileSync(path.join(M, "drizzle/0133_aleta_abt_pustaka.sql"), "utf8");
const SQL_0135 = readFileSync(path.join(M, "drizzle/0135_aleta_abt_penyunting.sql"), "utf8");
const SQL_0136 = readFileSync(path.join(M, "drizzle/0136_aleta_abt_banding.sql"), "utf8");
const JURNAL = JSON.parse(readFileSync(path.join(M, "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; when: number; tag: string }> };
const KLIEN = readFileSync(path.join(M, "src/server/db/client.ts"), "utf8");
const rapat = (s: string) => s.replace(/--.*$/gm, "").replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").trim();

describe("migrasi 0135", () => {
  it("SQL = DDL schema.ts; jurnal idx 117 sesudah 0134; terdaftar di urutan penyimpanan; tanpa kunci asing", () => {
    const sqlTabel = SQL_0135.match(/CREATE TABLE IF NOT EXISTS [^;]+/g)!;
    expect(DDL_ALETA_ABT_PENYUNTING.tabel.map(rapat)).toEqual(sqlTabel.map(rapat));
    expect(DDL_ALETA_ABT_PENYUNTING.indeks.map(rapat)).toEqual(SQL_0135.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS [^;]+/g)!.map(rapat));
    const e = JURNAL.entries;
    const i = e.findIndex((x) => x.tag === "0135_aleta_abt_penyunting");
    expect(e[i]).toMatchObject({ idx: 117 });
    expect(e[i - 1].tag).toBe("0134_aleta_cermin_jadwal_lengkap");
    expect(e[i].when).toBeGreaterThan(e[i - 1].when);
    expect(new Set(e.map((x) => x.idx)).size).toBe(e.length);
    expect(KLIEN).toContain('"aleta_abt_berkas_versi"');
    expect(SQL_0135).not.toMatch(/REFERENCES|FOREIGN KEY/i);
  });
});

// ─── pg-mem ─────────────────────────────────────────────────────────────────────────────────────────────────────
async function siapkan() {
  const mem = newDb();
  mem.public.none(SQL_0133);
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
    queryOne: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows[0] ?? null,
    run: async (q: string, p: unknown[] = []) => {
      await c.query(ubah(q), p);
    },
  };
  const baca = async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows as Array<Record<string, unknown>>;
  let n = 0;
  const o = {
    transaksi: async <T,>(kerja: (tx: never) => Promise<T>) => kerja(db as never),
    kini: () => `2026-11-05T10:${String(10 + n).padStart(2, "0")}:00.000Z`,
    idBaru: () => `v${++n}`,
  };
  return { db: db as never, dbUji: db, baca, o: o as never };
}

const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");
const KEPALA = "{\\rtf1\\ansi\\ansicpg1252\\uc1\\deff1{\\fonttbl{\\f0\\fnil\\fcharset0 Arial;}{\\f1\\fswiss\\fcharset0 Calibri;}}{\\colortbl;}\r\n";
const RTF =
  KEPALA +
  "{\\header\\pard\\qc Kop #9999#\\par}{\\footer\\pard\\qr{\\field{\\*\\fldinst{ PAGE }}{\\fldrslt{1}}}\\par}\r\n" +
  "\\pard\\qc\\b PUTUSAN\\b0\\par\r\n" +
  "\\pard\\qj Nomor #0001# antara #0098# melawan #0102# \\'93kutipan\\'94.\\par\r\n" +
  "\\pard\\intbl Sel satu #0098#\\cell\\row\r\n" +
  "\\pard\\qj Kotak {\\shp{\\*\\shpinst{\\shptxt\\pard Isi\\par}}{\\shprslt{\\pict abc}}} sesudah.\\par\r\n" +
  "\\pard Terakhir.\\par}";
const JALUR = "1 Perceraian CG/[01] Kabul.rtf";

async function isiPustaka(dbUji: Awaited<ReturnType<typeof siapkan>>["dbUji"], berkas = RTF, jalur = JALUR) {
  const bita = Buffer.from(berkas, "latin1");
  const s = simpananIsi(bita);
  await dbUji.run(
    `INSERT INTO aleta_abt_berkas (id, folder, nama, arsip, isi, pengkodean, md5, ukuran, asal, asal_server, md5_asal, diubah, status, dibuat_at, diubah_at)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?, 'abt', 'PA.Dgl', ?, 0, 'aktif', '2026-11-03T00:00:00.000Z', '2026-11-03T00:00:00.000Z')`,
    [jalur, jalur.split("/")[0], jalur.split("/")[1], s.isi, s.pengkodean, md5(bita), bita.length, md5(bita)]
  );
  return md5(bita);
}

async function isiVariabel(dbUji: Awaited<ReturnType<typeof siapkan>>["dbUji"]) {
  const daftar: Array<[string, string, string, string]> = [
    ["0001", "AA00001", "Nomor Perkara", "SELECT 1"],
    ["0098", "AA00098", "Nama Penggugat", "SELECT IF(a, b, c)"],
    ["0102", "AA00102", "Nama Tergugat", "SELECT 2"],
  ];
  for (const [no, kode, nama, sql] of daftar) {
    await dbUji.run("INSERT INTO aleta_abt_peta_variabel (id, server, no_var, kode, sidik, status, dibuat_at, diubah_at) VALUES (?, 'PA.Dgl', ?, ?, 'x', 'aktif', 'a', 'a')", [`PA.Dgl|${no}`, no, kode]);
    await dbUji.run(
      "INSERT INTO aleta_abt_variabel (kode, nama, sql_query, jumlah_blangko, asal, asal_server, status, dibuat_at, diubah_at) VALUES (?, ?, ?, 5, 'abt', 'PA.Dgl', 'aktif', 'a', 'a')",
      [kode, nama, sql]
    );
  }
  await dbUji.run("INSERT INTO aleta_abt_menu (id, nama, nama_alias, asal, asal_server, status, dibuat_at, diubah_at) VALUES ('1 Perceraian CG', 'Perceraian CG', 'Cerai Gugat', 'abt', 'PA.Dgl', 'aktif', 'a', 'a')");
}

const AKTOR = { id: "usr-derry", name: "Derry" };

describe("penyunting (pg-mem, SQL migrasi sungguhan)", () => {
  it("buka: isian bernama tanpa nomor di data layar, kotak/kepala/tabel terkunci, folder berlabel", async () => {
    const { db, dbUji } = await siapkan();
    await isiPustaka(dbUji);
    await isiVariabel(dbUji);
    const daftar = await daftarBlangko(db);
    expect(daftar.folder).toHaveLength(1);
    expect(daftar.folder[0]).toMatchObject({ folder: "1 Perceraian CG", label: "Cerai Gugat" });
    expect(daftar.folder[0].blangko[0]).toMatchObject({ nama: "[01] Kabul", rtf: true, disunting: false, versi: 1, terbit: 1, adaDraf: false });
    const b = await bukaBlangko(db, JALUR);
    expect(b).toMatchObject({ dapatDisunting: true, belumDisimpan: true, terakhir: 1, terbit: 1, nama: "[01] Kabul" });
    expect(b.versi).toMatchObject({ nomor: 1, jenis: "asal", status: "terbit" });
    expect(b.isian["0098"]).toEqual({ nama: "Nama Penggugat", bersyarat: true });
    expect(b.isian["0001"]).toEqual({ nama: "Nomor Perkara", bersyarat: false });
    expect(b.isian["9999"].nama).toBe("Isian 9999");
    expect(b.paragraf[2].tabel).toBe(true);
    expect(b.paragraf[3].bagian.some((x) => x.j === "kotak")).toBe(true);
    expect(b.tetap.map((t) => t.jenis)).toEqual(["kepala", "kaki"]);
    const isian = await daftarIsian(db);
    expect(isian[0]).toMatchObject({ dipakai: 5 });
  });

  it("berkas non-RTF dan versi yang tidak ada ditolak dengan sebab jelas", async () => {
    const { db, dbUji, o } = await siapkan();
    await isiPustaka(dbUji, "bukan rtf", "9 Lain/catatan.txt");
    const b = await bukaBlangko(db, "9 Lain/catatan.txt");
    expect(b).toMatchObject({ dapatDisunting: false, paragraf: [] });
    expect(b.sebabTerkunci).toMatch(/bukan RTF/);
    await expect(simpanSuntingan(db, AKTOR, { id: "9 Lain/catatan.txt", dasarNomor: 1, suntingan: [{ i: 0, teks: "x" }] }, o)).rejects.toMatchObject({ status: 422 });
    await expect(bukaBlangko(db, "tidak/ada.rtf")).rejects.toMatchObject({ status: 404 });
    await isiPustaka(dbUji);
    await expect(bukaBlangko(db, JALUR, 7)).rejects.toMatchObject({ status: 404 });
  });

  it("simpan = versi baru (draf) tanpa menyentuh isi pustaka; berkas ditandai diubah; salah dasar 409; tanpa ubahan 400; kotak terkunci 422", async () => {
    const { db, dbUji, baca, o } = await siapkan();
    const md5Asal = await isiPustaka(dbUji);
    await isiVariabel(dbUji);
    const h = await simpanSuntingan(db, AKTOR, { id: JALUR, dasarNomor: 1, suntingan: [{ i: 1, teks: "Nomor #0001# antara #0098# dan #0102# “kutipan”." }], catatan: "ganti kata" }, o);
    expect(h).toMatchObject({ nomor: 2, diubah: 1, ringkas: "1 paragraf diubah" });
    const pustaka = (await baca("SELECT md5, diubah, isi, md5_asal FROM aleta_abt_berkas WHERE id = ?", [JALUR]))[0];
    expect(pustaka).toMatchObject({ md5: md5Asal, diubah: 1, md5_asal: md5Asal });
    expect(String(pustaka.isi)).toBe(RTF);
    const versi = await baca("SELECT nomor, jenis, status, dari_nomor, catatan, md5 FROM aleta_abt_berkas_versi ORDER BY nomor");
    expect(versi).toEqual([
      { nomor: 1, jenis: "asal", status: "terbit", dari_nomor: 0, catatan: "Salinan dari ABT", md5: md5Asal },
      { nomor: 2, jenis: "sunting", status: "draf", dari_nomor: 1, catatan: "ganti kata", md5: h.md5 },
    ]);
    // Buka versi terkini = draf; versi terbit tetap 1.
    const buka = await bukaBlangko(db, JALUR);
    expect(buka).toMatchObject({ terakhir: 2, terbit: 1, belumDisimpan: false });
    expect(buka.versi).toMatchObject({ nomor: 2, status: "draf" });
    expect(buka.paragraf[1].bagian.some((x) => x.j === "teks" && x.t.includes("dan"))).toBe(true);
    // Hanya kata itu yang berbeda di bita (kerangka, kepala/kaki, kotak, tabel utuh).
    const baru = (await baca("SELECT isi FROM aleta_abt_berkas_versi WHERE nomor = 2"))[0].isi as string;
    expect(baru.replace("dan #0102#", "melawan #0102#")).toBe(RTF);
    // Salah dasar, tanpa ubahan, kotak terkunci.
    await expect(simpanSuntingan(db, AKTOR, { id: JALUR, dasarNomor: 1, suntingan: [{ i: 0, teks: "X" }] }, o)).rejects.toMatchObject({ status: 409 });
    await expect(simpanSuntingan(db, AKTOR, { id: JALUR, dasarNomor: 2, suntingan: [] }, o)).rejects.toMatchObject({ status: 400 });
    const kotak = (await bukaBlangko(db, JALUR)).paragraf[3];
    await expect(simpanSuntingan(db, AKTOR, { id: JALUR, dasarNomor: 2, suntingan: [{ i: kotak.i, teks: "tanpa kotak" }] }, o)).rejects.toMatchObject({ status: 422 });
    const daftar = await daftarBlangko(db);
    expect(daftar.folder[0].blangko[0]).toMatchObject({ disunting: true, versi: 2, terbit: 1, adaDraf: true });
  });

  it("terbit mengganti isi pustaka; versi lama jadi 'lama'; terbit dua kali ditolak; penanda isian mengikuti isi baru", async () => {
    const { db, dbUji, baca, o } = await siapkan();
    await isiPustaka(dbUji);
    await isiVariabel(dbUji);
    const h = await simpanSuntingan(db, AKTOR, { id: JALUR, dasarNomor: 1, suntingan: [{ i: 1, teks: "Nomor #0001# antara #0098#." }] }, o);
    await terbitkanVersi(db, AKTOR, { id: JALUR, nomor: h.nomor }, o);
    const pustaka = (await baca("SELECT md5, ukuran, diubah, penanda_asal, penanda_kode, isi FROM aleta_abt_berkas WHERE id = ?", [JALUR]))[0];
    expect(pustaka).toMatchObject({ md5: h.md5, diubah: 1 });
    expect(uraiRtf(String(pustaka.isi)).paragraf[1].teks).toBe("Nomor #0001# antara #0098#.");
    expect(JSON.parse(String(pustaka.penanda_asal))).toEqual(["0001", "0098", "9999"]);
    expect(JSON.parse(String(pustaka.penanda_kode))).toEqual(["AA00001", "AA00098"]);
    const status = await baca("SELECT nomor, status, terbit_nama FROM aleta_abt_berkas_versi ORDER BY nomor");
    expect(status).toMatchObject([{ nomor: 1, status: "lama" }, { nomor: 2, status: "terbit", terbit_nama: "Derry" }]);
    await expect(terbitkanVersi(db, AKTOR, { id: JALUR, nomor: 2 }, o)).rejects.toMatchObject({ status: 409 });
    const r = await riwayatVersi(db, JALUR);
    expect(r.versi.map((v) => [v.nomor, v.status])).toEqual([[2, "terbit"], [1, "lama"]]);
  });

  it("pulihkan = bita identik dengan versi lama (md5 dan isi persis); terbit versi pulih mengembalikan isi pustaka persis", async () => {
    const { db, dbUji, baca, o } = await siapkan();
    const md5Asal = await isiPustaka(dbUji);
    await isiVariabel(dbUji);
    const a = await simpanSuntingan(db, AKTOR, { id: JALUR, dasarNomor: 1, suntingan: [{ i: 1, teks: "Nomor #0001#." }, { i: 3, teks: `Kotak ${"￼"} setelah.` }] }, o);
    await terbitkanVersi(db, AKTOR, { id: JALUR, nomor: a.nomor }, o);
    await expect(pulihkanVersi(db, AKTOR, { id: JALUR, nomor: a.nomor }, o)).rejects.toMatchObject({ status: 400 });
    const p = await pulihkanVersi(db, AKTOR, { id: JALUR, nomor: 1 }, o);
    expect(p).toMatchObject({ nomor: 3, dariNomor: 1, md5: md5Asal });
    const baris = (await baca("SELECT isi, pengkodean, md5, ukuran, jenis, status, dari_nomor FROM aleta_abt_berkas_versi WHERE nomor = 3"))[0];
    expect(baris).toMatchObject({ jenis: "pulih", status: "draf", dari_nomor: 1, md5: md5Asal });
    expect(bitaIsi(String(baris.isi), String(baris.pengkodean)).equals(Buffer.from(RTF, "latin1"))).toBe(true);
    await terbitkanVersi(db, AKTOR, { id: JALUR, nomor: 3 }, o);
    const pustaka = (await baca("SELECT isi, pengkodean, md5, md5_asal, diubah FROM aleta_abt_berkas WHERE id = ?", [JALUR]))[0];
    expect(bitaIsi(String(pustaka.isi), String(pustaka.pengkodean)).equals(Buffer.from(RTF, "latin1"))).toBe(true);
    expect(pustaka).toMatchObject({ md5: md5Asal, md5_asal: md5Asal, diubah: 1 });
    // Pulihkan sebelum ada riwayat sama sekali: versi maya 1 = versi terkini.
    const { db: db2, dbUji: dbUji2, o: o2 } = await siapkan();
    await isiPustaka(dbUji2);
    await expect(pulihkanVersi(db2, AKTOR, { id: JALUR, nomor: 1 }, o2)).rejects.toMatchObject({ status: 400 });
  });

  it("isi yang memuat bita nol tersimpan base64 dan pulih persis per bita", async () => {
    const { db, dbUji, baca, o } = await siapkan();
    const dengan0 = `${RTF.slice(0, -1)}\\bin3 \u0000\u0001\u0002}`;
    // \bin3 memuat 3 bita biner (nol, 1, 2): berkas sah dan tetap diurai.
    await isiPustaka(dbUji, dengan0);
    const asal = Buffer.from(dengan0, "latin1");
    expect(String((await baca("SELECT pengkodean FROM aleta_abt_berkas WHERE id = ?", [JALUR]))[0].pengkodean)).toBe("base64");
    const a = await simpanSuntingan(db, AKTOR, { id: JALUR, dasarNomor: 1, suntingan: [{ i: 4, teks: "Terakhir diubah." }] }, o);
    expect(a.nomor).toBe(2);
    const p = await pulihkanVersi(db, AKTOR, { id: JALUR, nomor: 1 }, o);
    const baris = (await baca("SELECT isi, pengkodean FROM aleta_abt_berkas_versi WHERE nomor = ?", [p.nomor]))[0];
    expect(bitaIsi(String(baris.isi), String(baris.pengkodean)).equals(asal)).toBe(true);
  });

  it("Sinkron dari ABT tidak menimpa blangko yang sudah disunting: bentrok dicatat, isi tetap", async () => {
    const { db, dbUji, baca, o } = await siapkan();
    const md5Asal = await isiPustaka(dbUji);
    await isiVariabel(dbUji);
    const h = await simpanSuntingan(db, AKTOR, { id: JALUR, dasarNomor: 1, suntingan: [{ i: 1, teks: "Nomor #0001# disunting." }] }, o);
    await terbitkanVersi(db, AKTOR, { id: JALUR, nomor: h.nomor }, o);
    const terbit = (await baca("SELECT isi, md5 FROM aleta_abt_berkas WHERE id = ?", [JALUR]))[0];
    const isiAbtBaru = `${RTF.slice(0, -1)} baru di ABT}`;
    const bitaAbt = Buffer.from(isiAbtBaru, "latin1");
    const potret: PotretAbt & { berkas: PotretAbt["berkas"] } = {
      server: "PA.Dgl",
      berkas: [{ jalur: JALUR, folder: "1 Perceraian CG", nama: "[01] Kabul.rtf", arsip: false, md5: md5(bitaAbt), ukuran: bitaAbt.length, waktu: "2026-11-05T00:00:00.000Z", penanda: ["0001"] }],
      variabel: [],
      menu: [],
    };
    const mulai = async () => {
      const id = `s-${Math.random()}`;
      await dbUji.run("INSERT INTO aleta_abt_sinkron (id, status, oleh, mulai_at) VALUES (?, 'jalan', 'Derry', ?)", [id, "2026-11-05T11:00:00.000Z"]);
      return id;
    };
    const hasil = await jalankanSinkron(db, await mulai(), {
      ambilPotret: async () => potret,
      ambilIsi: async (jalur) => ({ berkas: jalur.map((j) => ({ jalur: j, md5: md5(bitaAbt), ukuran: bitaAbt.length, isi: bitaAbt.toString("base64") })), ditolak: [], lewat: [] }),
      transaksi: async <T,>(kerja: (tx: never) => Promise<T>) => kerja(db as never),
      kini: () => "2026-11-05T11:00:00.000Z",
    });
    expect(hasil.berkas).toMatchObject({ bentrok: 1, berubah: 0 });
    const sesudah = (await baca("SELECT isi, md5, md5_asal, bentrok_md5, diubah FROM aleta_abt_berkas WHERE id = ?", [JALUR]))[0];
    expect(sesudah).toMatchObject({ isi: terbit.isi, md5: terbit.md5, md5_asal: md5Asal, bentrok_md5: md5(bitaAbt), diubah: 1 });
  });

  it("beda antarversi: paragraf yang berubah dipasangkan dan beda kata ditandai; sama bita dikenali", async () => {
    const { db, dbUji, o } = await siapkan();
    await isiPustaka(dbUji);
    await isiVariabel(dbUji);
    await simpanSuntingan(db, AKTOR, { id: JALUR, dasarNomor: 1, suntingan: [{ i: 1, teks: "Nomor #0001# antara #0098# dan #0102# “kutipan”." }, { i: 4, teks: "Terakhir sekali." }] }, o);
    const b = await bedaAntarVersi(db, JALUR, 1, 2);
    expect(b).toMatchObject({ samaBita: false, samaTeks: false, kepalaKakiBeda: false, ringkas: { ubah: 2, tambah: 0, hapus: 0 } });
    const ubah = b.baris.filter((x) => x.k === "ubah");
    expect(ubah).toHaveLength(2);
    const satu = ubah[0] as { a: Array<{ t: string; d?: string }>; b: Array<{ t: string; d?: string }> };
    expect(satu.a.some((p) => p.d === "hapus" && p.t.includes("melawan"))).toBe(true);
    expect(satu.b.some((p) => p.d === "tambah" && p.t.includes("dan"))).toBe(true);
    // Isian tampil dengan nama, bukan nomor.
    expect(JSON.stringify(b.baris)).toContain("Nama Penggugat");
    expect(JSON.stringify(b.baris)).not.toContain("#0098#");
    const sama = await bedaAntarVersi(db, JALUR, 2, 2);
    expect(sama).toMatchObject({ samaBita: true, samaTeks: true, ringkas: { ubah: 0 } });
    // Tambah dan hapus paragraf.
    await simpanSuntingan(db, AKTOR, { id: JALUR, dasarNomor: 2, suntingan: [{ i: 0, teks: `PUTUSAN${PEMISAH_PARAGRAF}Paragraf baru` }], hapus: [] }, o);
    const c = await bedaAntarVersi(db, JALUR, 2, 3);
    expect(c.ringkas.tambah + c.ringkas.ubah).toBeGreaterThan(0);
  });

  it("coba pada perkara rekaan: isian terisi contoh, tanpa kata Aleta, berkas contoh sah dan kepala/kaki utuh", async () => {
    const { db, dbUji } = await siapkan();
    await isiPustaka(dbUji);
    await isiVariabel(dbUji);
    const c = await cobaBlangko(db, JALUR, undefined, true);
    expect(c.terisi).toBe(4);
    expect(c.takBerContoh).toBe(0);
    const teksTampil = JSON.stringify(c.paragraf);
    expect(teksTampil).toContain("Siti Contoh binti Budi Contoh");
    expect(teksTampil).toContain("1/Pdt.G/2026/PA.Contoh");
    expect(teksTampil).toContain("Sel satu");
    expect(teksTampil).not.toMatch(/#\d{3,5}#/);
    expect(c.rtfBase64).not.toBeNull();
    const rtf = Buffer.from(c.rtfBase64!, "base64").toString("latin1");
    expect(rtf).not.toMatch(/aleta/i);
    expect(JSON.stringify(c)).not.toMatch(/aleta/i);
    const doc = uraiRtf(rtf);
    expect(doc.paragraf[1].teks).toBe("Nomor 1/Pdt.G/2026/PA.Contoh antara Siti Contoh binti Budi Contoh melawan Ahmad Contoh bin Hasan Contoh “kutipan”.");
    expect(rtf).toContain("{\\header\\pard\\qc Kop #9999#\\par}");
    // Isian tanpa contoh tampil dengan namanya.
    await isiPustaka(dbUji, "{\\rtf1 Nilai #0555# di sini.\\par}", "2 Lain/b.rtf");
    await dbUji.run("INSERT INTO aleta_abt_peta_variabel (id, server, no_var, kode, sidik, status, dibuat_at, diubah_at) VALUES ('PA.Dgl|0555', 'PA.Dgl', '0555', 'AA00555', 'x', 'aktif', 'a', 'a')");
    await dbUji.run("INSERT INTO aleta_abt_variabel (kode, nama, asal, asal_server, status, dibuat_at, diubah_at) VALUES ('AA00555', 'Kode Khusus', 'abt', 'PA.Dgl', 'aktif', 'a', 'a')");
    const k = await cobaBlangko(db, "2 Lain/b.rtf", undefined, false);
    expect(k).toMatchObject({ terisi: 0, takBerContoh: 1, rtfBase64: null });
    expect(JSON.stringify(k.paragraf)).toContain("‹Kode Khusus›");
  });
});
