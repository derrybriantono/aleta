// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KATALOG_FITUR_SATKER, keadaanFitur } from "@/lib/fitur-satker";
import { KODE_FITUR_JEJAK_ISIAN } from "@/lib/jejak-isian";
import {
  BATAS_RIWAYAT_PER_BERKAS,
  JENDELA_LAPOR,
  KODE_FITUR_WAJIB_CETAK,
  MIN_CETAK_WAJIB,
  RASIO_WAJIB,
  bersihkanFaktaPola,
  bersihkanLapor,
  bolehDisalin,
  pelajariWajib,
  susunUsulanSerupa,
  tandaIsian,
  uraiTanda,
  type NilaiPerkaraSerupa,
} from "@/lib/wajib-cetak";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_BLANGKO_LAPOR } from "@/server/db/schema";
import { catatJejakIsian } from "@/server/modules/aleta-ecourt/jejak-isian";
import { bacaWajibBelajar, bersihkanLaporLawas, catatLaporan, lupakanPembersihanLapor, usulSalinSerupa, wajibCetakAktif } from "@/server/modules/aleta-ecourt/wajib-cetak";
import { KUNCI_FITUR_SATKER } from "@/server/modules/satker/fitur";
import { tulisSetelanSistem } from "@/server/modules/satker/setelan";

/**
 * ============================================================================
 * 25 OKT 2026 - RANTAI D, BUTIR D3: DAFTAR WAJIB SEBELUM CETAK + SALIN DARI PERKARA SERUPA (U13)
 * ============================================================================
 *
 * pg-mem + rute HTTP sungguhan; data rekaan. Yang dijaga:
 *   1. migrasi 0102 = DDL schema.ts, jurnal idx 91 (tanpa lubang), ikut cadangan; saklar bawaan MATI
 *   2. aturan murni: pembersih laporan, tanda isian, belajar "biasanya terisi" (8 cetak, 90%), penyaring identitas, usulan serupa
 *   3. saklar mati: tidak satu baris pun ditulis, tidak ada pengingat, tidak ada usulan
 *   4. riwayat: satu baris per keadaan berbeda, satu baris tiap cetak, batas per perkara + blangko, cetak dipertahankan, retensi 2 tahun
 *   5. belajar dari cetak (satu per perkara) dan usulan dari perkara serupa yang SUDAH PUTUS, hanya non-identitas, hanya nilai yang sama pada >= 2 perkara
 *   6. hak per peran di rute
 */

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-hakim";

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => db,
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

async function nyalakan(d: AletaDatabase, kode: string[] = [KODE_FITUR_WAJIB_CETAK, KODE_FITUR_JEJAK_ISIAN]) {
  const fitur: Record<string, string> = {};
  for (const k of kode) fitur[k] = "stabil";
  await tulisSetelanSistem(d, KUNCI_FITUR_SATKER, { fitur, diubahOleh: "uji", diubahPada: new Date().toISOString() }, new Date().toISOString());
}

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, any>; error?: { message: string } } };
async function panggil(cara: "GET" | "POST", opsi: { query?: string; badan?: unknown } = {}): Promise<Hasil> {
  const modul = await import("@/app/api/aleta-ecourt/wajib-cetak/route");
  const req = new NextRequest("http://localhost/api/aleta-ecourt/wajib-cetak" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const jawaban = await (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara](req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

const BERKAS = "[01] [Kabul Verstek] Cerai (Format Lengkap).rtf";
const FAKTA = { alur: "15", ghaib: false, prodeo: false, jumlahP: 1, jumlahT: 1, verstek: true };
const ISIAN = [
  { kode: "0007", terisi: true },
  { kode: "9134", terisi: false },
  { kode: "2004", terisi: true },
];
const lapor = (tambah: Record<string, unknown> = {}) => ({
  aksi: "lapor",
  perkaraId: "p1",
  nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
  berkas: BERKAS,
  jenisBlangko: "put",
  jenisPerkara: "Cerai Gugat",
  isian: ISIAN,
  dicetak: false,
  fakta: FAKTA,
  ...tambah,
});

// ─── 1. Migrasi dan saklar ───────────────────────────────────────────────────

describe("migrasi 0102 - berkas = DDL schema.ts, jurnal idx 91, ikut cadangan", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0102_aleta_blangko_lapor.sql");

  it("jurnal: 0102 sekali di idx 90 sesudah 0100, tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0102_"))).toEqual([expect.objectContaining({ idx: 90, tag: "0102_aleta_blangko_lapor" })]);
    expect(j.entries[89]?.tag).toBe("0100_aleta_alias_nama");
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i]?.when).toBeGreaterThan(j.entries[i - 1]?.when ?? 0);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_BLANGKO_LAPOR, berjalan di pg-mem, kolom bawaan benar; tabel ikut cadangan", () => {
    const isiSql = readFileSync(SQL, "utf8");
    expect(pernyataan(isiSql)).toEqual([...DDL_BLANGKO_LAPOR.tabel, ...DDL_BLANGKO_LAPOR.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(isiSql);
    kosong.public.none(`INSERT INTO aleta_blangko_lapor (id, pada, dibuat_at) VALUES ('a', 'x', 'y')`);
    expect(kosong.public.one(`SELECT dicetak, terisi, jumlah, isian FROM aleta_blangko_lapor`)).toEqual({ dicetak: 0, terisi: 0, jumlah: 0, isian: "" });
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_blangko_lapor");
  });

  it("saklar katalog Fitur Satker: kode wajib-sebelum-cetak, bawaan MATI", () => {
    expect(KATALOG_FITUR_SATKER.find((f) => f.kode === KODE_FITUR_WAJIB_CETAK)).toMatchObject({ bawaan: "mati", bagian: "portal" });
    expect(keadaanFitur(KODE_FITUR_WAJIB_CETAK, {})).toMatchObject({ menyala: false, status: "mati" });
  });
});

// ─── 2. Aturan murni ─────────────────────────────────────────────────────────

describe("aturan murni daftar wajib dan salinan", () => {
  it("ambang tertulis: 8 cetak, 90%, riwayat 50 per blangko", () => {
    expect([MIN_CETAK_WAJIB, RASIO_WAJIB, BATAS_RIWAYAT_PER_BERKAS, JENDELA_LAPOR]).toEqual([8, 0.9, 50, 300]);
  });

  it("pembersih laporan: wajib perkara + blangko + isian; kode dirapikan, ganda dibuang; fakta hanya skalar pendek", () => {
    expect(bersihkanLapor(lapor())).toMatchObject({ perkaraId: "p1", berkas: BERKAS, jenisBlangko: "put", dicetak: false });
    expect(bersihkanLapor(lapor({ perkaraId: "" }))).toBeNull();
    expect(bersihkanLapor(lapor({ berkas: "" }))).toBeNull();
    expect(bersihkanLapor(lapor({ isian: [] }))).toBeNull();
    expect(bersihkanLapor(null)).toBeNull();
    const m = bersihkanLapor(lapor({ isian: [{ kode: " 0007 ", terisi: 1 }, { kode: "0007", terisi: false }, { kode: "x y!", terisi: true }, { kode: "", terisi: true }] }))!;
    expect(m.isian).toEqual([{ kode: "0007", terisi: true }, { kode: "xy", terisi: true }]);
    expect(bersihkanLapor(lapor({ dicetak: "ya" }))!.dicetak).toBe(false); // hanya true sungguhan
    expect(bersihkanFaktaPola({ alur: "15", "bad key!": 1, objek: { a: 1 }, panjang: "x".repeat(100), kosong: "  ", angka: Infinity, ok: true })).toEqual({ alur: "15", panjang: "x".repeat(60), ok: true });
  });

  it("tanda isian terurut dan dapat diurai kembali", () => {
    const t = tandaIsian([{ kode: "9134", terisi: false }, { kode: "0007", terisi: true }]);
    expect(t).toBe("0007:1,9134:0");
    expect([...uraiTanda(t)]).toEqual([["0007", true], ["9134", false]]);
  });

  const cetak = (n: number, terisi: (i: number) => boolean) => Array.from({ length: n }, (_, i) => ({ dicetak: true, isian: tandaIsian([{ kode: "0007", terisi: terisi(i) }, { kode: "9134", terisi: i % 2 === 0 }]) }));

  it("belajar: 8 cetak dengan 90% terisi cukup; 7 cetak tidak; 89% tidak; hanya baris cetak dihitung", () => {
    expect(pelajariWajib(cetak(8, () => true))).toMatchObject({ cetak: 8, cukupData: true, wajib: [{ kode: "0007", terisi: 8, dari: 8, rasio: 1 }] });
    expect(pelajariWajib(cetak(7, () => true))).toMatchObject({ cetak: 7, cukupData: false, wajib: [] });
    // 9 dari 10 = 90% -> termasuk; 8 dari 10 = 80% -> tidak
    expect(pelajariWajib(cetak(10, (i) => i !== 3)).wajib.map((w) => w.kode)).toEqual(["0007"]);
    expect(pelajariWajib(cetak(10, (i) => i > 1)).wajib).toEqual([]);
    // keadaan sementara (bukan cetak) tidak dihitung
    const campur = [...cetak(8, () => true), ...Array.from({ length: 30 }, () => ({ dicetak: false, isian: tandaIsian([{ kode: "0007", terisi: false }]) }))];
    expect(pelajariWajib(campur).wajib).toEqual([expect.objectContaining({ kode: "0007", terisi: 8, dari: 8 })]);
    // isian yang separuh cetak saja tidak diingatkan (9134 terisi tiap dua cetak)
    expect(pelajariWajib(cetak(20, () => true)).wajib.map((w) => w.kode)).not.toContain("9134");
  });

  it("boleh disalin: rumusan umum ya; identitas, fakta tunggal, tanggal, angka panjang, tanda sistem tidak", () => {
    expect(bolehDisalin("Petunjuk perbaikan permohonan", "Perbaiki uraian posita sesuai petunjuk majelis")).toBe(true);
    for (const nama of ["Nama saksi", "Alamat Tergugat", "Tanggal penetapan prodeo", "Nomor penetapan prodeo", "Mas kawin", "Nafkah iddah", "Pekerjaan terakhir Tergugat", "Putusan pidana Tergugat", "Tempat tinggal setelah menikah", "Telah dikaruniai anak"]) {
      expect(bolehDisalin(nama, "rumusan umum"), nama).toBe(false);
    }
    expect(bolehDisalin("Petunjuk", "pada 12 Mei 2026")).toBe(false);
    expect(bolehDisalin("Petunjuk", "tanggal 12/05/2026")).toBe(false);
    expect(bolehDisalin("Petunjuk", "tahun 2019")).toBe(false);
    expect(bolehDisalin("Petunjuk", "NIK 7271 0364")).toBe(false);
    expect(bolehDisalin("Petunjuk", "ditulis ALETA")).toBe(false);
    expect(bolehDisalin("Petunjuk", "x".repeat(401))).toBe(false);
    expect(bolehDisalin("Petunjuk", "   ")).toBe(false);
  });

  const nilai = (perkaraId: string, kode: string, nilaiX: string, pada = "2026-10-20T01:00:00.000Z", nama = "Petunjuk perbaikan"): NilaiPerkaraSerupa => ({ perkaraId, nomorPerkara: `${perkaraId}/Pdt.G/2026/PA.Dgl`, kode, nama, nilai: nilaiX, pada });

  it("usulan serupa: nilai sama pada >= 2 perkara berbeda; satu perkara satu suara; sama banyak -> terbaru; hanya kode diminta", () => {
    const baris = [
      nilai("a", "9134", "Perbaiki uraian posita"),
      nilai("b", "9134", "perbaiki  uraian POSITA"),
      nilai("c", "9134", "Lengkapi identitas"),
      nilai("a", "9134", "Perbaiki uraian posita", "2026-10-21T01:00:00.000Z"), // perkara a menulis dua kali: tetap satu suara
      nilai("a", "8888", "Tunggal"),
      nilai("a", "7777", "Tidak diminta"),
      nilai("b", "7777", "Tidak diminta"),
    ];
    const u = susunUsulanSerupa(baris, ["9134", "8888"]);
    expect(u).toEqual([{ kode: "9134", nilai: "Perbaiki uraian posita", jumlah: 2, dari: 3, nomorPerkara: ["a/Pdt.G/2026/PA.Dgl", "b/Pdt.G/2026/PA.Dgl"] }]);
    // sama banyak -> yang terbaru menang
    const seri = susunUsulanSerupa([nilai("a", "9134", "Lama", "2026-10-01T00:00:00.000Z"), nilai("b", "9134", "Lama", "2026-10-02T00:00:00.000Z"), nilai("c", "9134", "Baru", "2026-10-10T00:00:00.000Z"), nilai("d", "9134", "Baru", "2026-10-11T00:00:00.000Z")], ["9134"]);
    expect(seri[0]).toMatchObject({ nilai: "Baru", jumlah: 2 });
    // nama identitas -> tidak pernah diusulkan walau semua perkara menulis nilai yang sama
    expect(susunUsulanSerupa([nilai("a", "0046", "rumusan", undefined, "Nama Penggugat"), nilai("b", "0046", "rumusan", undefined, "Nama Penggugat")], ["0046"])).toEqual([]);
    // minimal sama bisa dinaikkan
    expect(susunUsulanSerupa(baris, ["9134"], 3)).toEqual([]);
  });
});

// ─── 3-5. Penyimpanan ────────────────────────────────────────────────────────

describe("penyimpanan riwayat dan usulan (pg-mem)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-hakim";
    lupakanPembersihanLapor();
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("saklar mati (bawaan): tidak menulis, tidak ada pengetahuan, tidak ada usulan", async () => {
    expect(await wajibCetakAktif(db!)).toBe(false);
    expect(await catatLaporan(db!, { id: "usr-hakim" }, lapor())).toEqual({ aktif: false, dicatat: false, sebab: "" });
    expect(await db!.queryAll(`SELECT id FROM aleta_blangko_lapor`)).toEqual([]);
    expect(await db!.queryAll(`SELECT id FROM aleta_perkara_sidik`)).toEqual([]);
    expect(await bacaWajibBelajar(db!, BERKAS)).toEqual({ aktif: false, cetak: 0, cukupData: false, wajib: [] });
    expect(await usulSalinSerupa(db!, { perkaraId: "p1", nomorPerkara: "", jenisPerkara: "Cerai Gugat", fakta: FAKTA, kode: ["9134"] })).toEqual({ aktif: false, serupa: 0, usulan: [] });
  });

  it("riwayat: satu baris per keadaan berbeda, keadaan sama tidak digandakan, tiap cetak satu baris; nilai isian TIDAK disimpan", async () => {
    await nyalakan(db!);
    const h = { id: "usr-hakim", nama: "Hakim Satu" };
    expect(await catatLaporan(db!, h, lapor())).toEqual({ aktif: true, dicatat: true, sebab: "" });
    expect(await catatLaporan(db!, h, lapor())).toMatchObject({ dicatat: false, sebab: "Sudah sama." });
    expect(await catatLaporan(db!, h, lapor({ isian: [{ kode: "0007", terisi: true }, { kode: "9134", terisi: true }, { kode: "2004", terisi: true }] }))).toMatchObject({ dicatat: true });
    // dua kali cetak dengan keadaan sama: dua baris
    await catatLaporan(db!, h, lapor({ dicetak: true }));
    await catatLaporan(db!, h, lapor({ dicetak: true }));
    const baris = await db!.queryAll<Record<string, unknown>>(`SELECT * FROM aleta_blangko_lapor ORDER BY pada ASC`);
    expect(baris).toHaveLength(4);
    expect(baris.filter((b) => Number(b.dicetak) === 1)).toHaveLength(2);
    expect(baris[0]).toMatchObject({ perkara_id: "p1", berkas: BERKAS, jenis_blangko: "put", jenis_perkara: "Cerai Gugat", isian: "0007:1,2004:1,9134:0", terisi: 2, jumlah: 3, pengguna_nama: "Hakim Satu" });
    // tidak ada nilai isian dan tidak ada nama pihak di tabel
    expect(JSON.stringify(baris)).not.toMatch(/Yulfiani|dikaruniai/);
    // pola perkara ikut tercatat (bahan perkara serupa), tanpa nama/tanggal/nomor
    const sidik = await db!.queryOne<Record<string, unknown>>(`SELECT butir, jenis_perkara FROM aleta_perkara_sidik WHERE perkara_id = 'p1'`);
    expect(sidik).toMatchObject({ jenis_perkara: "Cerai Gugat" });
    expect(JSON.parse(String(sidik!.butir))).toEqual(["alur=15", "ghaib=tidak", "jumlahp=1", "jumlaht=1", "prodeo=tidak", "verstek=ya"]);
  });

  it("riwayat bukan-cetak dibatasi 50 per perkara + blangko; baris cetak dipertahankan", async () => {
    await nyalakan(db!);
    const h = { id: "usr-hakim", nama: "H" };
    await catatLaporan(db!, h, lapor({ dicetak: true }));
    for (let i = 0; i < BATAS_RIWAYAT_PER_BERKAS + 8; i += 1) await catatLaporan(db!, h, lapor({ isian: [{ kode: "0007", terisi: true }, { kode: `k${i}`, terisi: true }] }));
    expect(Number((await db!.queryOne<Record<string, unknown>>(`SELECT COUNT(*) AS n FROM aleta_blangko_lapor WHERE dicetak = 0`))!.n)).toBe(BATAS_RIWAYAT_PER_BERKAS);
    expect(Number((await db!.queryOne<Record<string, unknown>>(`SELECT COUNT(*) AS n FROM aleta_blangko_lapor WHERE dicetak = 1`))!.n)).toBe(1);
    // perkara lain tidak terpengaruh
    await catatLaporan(db!, h, lapor({ perkaraId: "p2" }));
    expect(Number((await db!.queryOne<Record<string, unknown>>(`SELECT COUNT(*) AS n FROM aleta_blangko_lapor WHERE perkara_id = 'p2'`))!.n)).toBe(1);
  });

  it("retensi 2 tahun: baris lebih tua dihapus, yang baru tetap", async () => {
    await nyalakan(db!);
    const lama = new Date(Date.now() - 800 * 86_400_000).toISOString();
    const baru = new Date().toISOString();
    for (const [id, pada] of [["lama", lama], ["baru", baru]]) await db!.run(`INSERT INTO aleta_blangko_lapor (id, perkara_id, berkas, pada, dibuat_at) VALUES (?, 'p', 'b', ?, ?)`, [id, pada, pada]);
    const r = await bersihkanLaporLawas(db!);
    expect(r.dihapus).toBe(1);
    expect((await db!.queryAll<Record<string, unknown>>(`SELECT id FROM aleta_blangko_lapor`)).map((b) => b.id)).toEqual(["baru"]);
  });

  it("belajar dari cetak: satu cetak terbaru per perkara; isian yang biasanya terisi muncul setelah 8 perkara", async () => {
    await nyalakan(db!);
    const h = { id: "usr-hakim", nama: "H" };
    for (let i = 0; i < 7; i += 1) await catatLaporan(db!, h, lapor({ perkaraId: `q${i}`, dicetak: true, fakta: {} }));
    expect(await bacaWajibBelajar(db!, BERKAS)).toMatchObject({ aktif: true, cetak: 7, cukupData: false, wajib: [] });
    // perkara yang sama mencetak berkali-kali tetap satu suara
    for (let i = 0; i < 5; i += 1) await catatLaporan(db!, h, lapor({ perkaraId: "q0", dicetak: true, fakta: {} }));
    expect((await bacaWajibBelajar(db!, BERKAS)).cetak).toBe(7);
    await catatLaporan(db!, h, lapor({ perkaraId: "q7", dicetak: true, fakta: {} }));
    const j = await bacaWajibBelajar(db!, BERKAS);
    expect(j).toMatchObject({ aktif: true, cetak: 8, cukupData: true });
    expect(j.wajib.map((w) => w.kode).sort()).toEqual(["0007", "2004"]); // 9134 kosong pada semua cetak
    // blangko lain tidak tercampur
    expect(await bacaWajibBelajar(db!, "BAS lain.rtf")).toMatchObject({ cetak: 0, wajib: [] });
    expect(await bacaWajibBelajar(db!, "")).toMatchObject({ aktif: true, cetak: 0 });
  });

  /** Perkara selesai: pola fakta tercatat, putusan dicetak, dan nilai akhir isian dicatat di jejak isian. */
  async function perkaraSelesai(id: string, nilaiIsian: Record<string, { nama: string; nilai: string }>, opsi: { putusCetak?: boolean; jenisPerkara?: string; fakta?: Record<string, unknown> } = {}) {
    const h = { id: "usr-hakim", nama: "H" };
    const jenis = opsi.jenisPerkara ?? "Cerai Gugat";
    await catatLaporan(db!, h, lapor({ perkaraId: id, nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`, jenisPerkara: jenis, dicetak: opsi.putusCetak !== false, fakta: opsi.fakta ?? FAKTA }));
    await catatJejakIsian(
      db!,
      h,
      Object.entries(nilaiIsian).map(([kode, v]) => ({
        perkaraId: id, nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`, jenisPerkara: jenis, blangko: BERKAS, jenisBlangko: "put", kode, namaVariabel: v.nama, nilaiUsulan: "", nilaiSebelum: "", nilaiFinal: v.nilai, cara: "diketik", jalur: "blangko-derry", pada: "2026-10-20T03:00:00.000Z",
      }))
    );
  }
  const PETUNJUK = { nama: "Petunjuk perbaikan permohonan", nilai: "Perbaiki uraian posita sesuai petunjuk majelis" };

  it("usulan dari perkara serupa: hanya yang SUDAH PUTUS, jenis sama, pola sama; hanya nilai bukan-identitas yang ditulis sama oleh >= 2 perkara", async () => {
    await nyalakan(db!);
    await perkaraSelesai("s1", { "9134": PETUNJUK, "0046": { nama: "Nama Penggugat", nilai: "rumusan sama" }, "0007": { nama: "Telah dikaruniai anak", nilai: "belum dikaruniai anak" } });
    await perkaraSelesai("s2", { "9134": PETUNJUK, "0046": { nama: "Nama Penggugat", nilai: "rumusan sama" }, "0007": { nama: "Telah dikaruniai anak", nilai: "belum dikaruniai anak" } });
    await perkaraSelesai("s3", { "9134": { nama: "Petunjuk perbaikan permohonan", nilai: "Lengkapi identitas pihak" } });
    // belum putus (putusan belum dicetak): tidak dipakai walau nilainya sama
    await perkaraSelesai("t1", { "9134": PETUNJUK }, { putusCetak: false });
    await perkaraSelesai("t2", { "9134": PETUNJUK }, { putusCetak: false });
    // jenis perkara lain: tidak dipakai
    await perkaraSelesai("u1", { "9134": { nama: "Petunjuk perbaikan permohonan", nilai: "Dari itsbat" } }, { jenisPerkara: "Istbat Nikah" });
    await perkaraSelesai("u2", { "9134": { nama: "Petunjuk perbaikan permohonan", nilai: "Dari itsbat" } }, { jenisPerkara: "Istbat Nikah" });
    // perkara ini (belum selesai) mencatat polanya
    await catatLaporan(db!, { id: "usr-hakim", nama: "H" }, lapor({ perkaraId: "baru", nomorPerkara: "99/Pdt.G/2026/PA.Dgl" }));

    const u = await usulSalinSerupa(db!, { perkaraId: "baru", nomorPerkara: "99/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", fakta: FAKTA, kode: ["9134", "0046", "0007"] });
    expect(u).toMatchObject({ aktif: true, serupa: 3 });
    expect(u.usulan).toEqual([{ kode: "9134", nilai: PETUNJUK.nilai, jumlah: 2, dari: 3, nomorPerkara: ["s1/Pdt.G/2026/PA.Dgl", "s2/Pdt.G/2026/PA.Dgl"] }]);
    // identitas / fakta perkara (nama, anak) tidak pernah diusulkan walau rumusannya seragam
    expect(u.usulan.map((x) => x.kode)).not.toContain("0046");
    expect(u.usulan.map((x) => x.kode)).not.toContain("0007");

    // kode yang tidak diminta tidak dicari; pola berbeda tidak serupa; tanpa fakta tidak ada
    expect((await usulSalinSerupa(db!, { perkaraId: "baru", nomorPerkara: "", jenisPerkara: "Cerai Gugat", fakta: FAKTA, kode: ["0046"] })).usulan).toEqual([]);
    expect(await usulSalinSerupa(db!, { perkaraId: "baru", nomorPerkara: "", jenisPerkara: "Cerai Gugat", fakta: { alur: "16", ghaib: true }, kode: ["9134"] })).toMatchObject({ serupa: 0, usulan: [] });
    expect(await usulSalinSerupa(db!, { perkaraId: "baru", nomorPerkara: "", jenisPerkara: "Cerai Gugat", fakta: {}, kode: ["9134"] })).toMatchObject({ serupa: 0, usulan: [] });
    expect(await usulSalinSerupa(db!, { perkaraId: "baru", nomorPerkara: "", jenisPerkara: "Cerai Gugat", fakta: FAKTA, kode: [] })).toMatchObject({ serupa: 0, usulan: [] });
  });

  it("nilai yang diurungkan tidak diusulkan; perkara itu sendiri tidak menjadi perkara serupa bagi dirinya", async () => {
    await nyalakan(db!);
    await perkaraSelesai("s1", { "9134": PETUNJUK });
    await perkaraSelesai("s2", { "9134": PETUNJUK });
    await db!.run(`UPDATE aleta_isian_jejak SET hasil = 'diurungkan' WHERE perkara_id = 's2'`);
    const u = await usulSalinSerupa(db!, { perkaraId: "s1", nomorPerkara: "", jenisPerkara: "Cerai Gugat", fakta: FAKTA, kode: ["9134"] });
    expect(u.usulan).toEqual([]); // hanya s2 yang tersisa sebagai perkara serupa, dan nilainya diurungkan
  });
});

// ─── 6. Rute ─────────────────────────────────────────────────────────────────

describe("rute wajib-cetak", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-hakim";
    lupakanPembersihanLapor();
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("saklar mati: saklar -> aktif:false; lapor tidak menulis; serupa kosong; berkas kosong", async () => {
    expect((await panggil("GET", { query: "bagian=saklar" })).isi.data).toEqual({ aktif: false });
    expect((await panggil("POST", { badan: lapor() })).isi.data).toEqual({ aktif: false, dicatat: false, sebab: "" });
    expect((await panggil("POST", { badan: { aksi: "serupa", perkaraId: "p1", jenisPerkara: "Cerai Gugat", fakta: FAKTA, kode: ["9134"] } })).isi.data).toEqual({ aktif: false, serupa: 0, usulan: [] });
    expect((await panggil("GET", { query: `berkas=${encodeURIComponent(BERKAS)}` })).isi.data).toMatchObject({ aktif: false, wajib: [] });
    expect(await db!.queryAll(`SELECT id FROM aleta_blangko_lapor`)).toEqual([]);
  });

  it("saklar menyala: lapor mencatat; berkas mengembalikan yang biasanya terisi; tindakan tak dikenal 400", async () => {
    await nyalakan(db!);
    expect((await panggil("GET", { query: "bagian=saklar" })).isi.data).toEqual({ aktif: true });
    expect((await panggil("POST", { badan: lapor() })).isi.data).toMatchObject({ aktif: true, dicatat: true });
    for (let i = 0; i < 8; i += 1) await panggil("POST", { badan: lapor({ perkaraId: `r${i}`, dicetak: true, fakta: {} }) });
    const b = await panggil("GET", { query: `berkas=${encodeURIComponent(BERKAS)}` });
    expect(b.isi.data).toMatchObject({ aktif: true, cetak: 8, cukupData: true });
    expect(b.isi.data.wajib.map((w: any) => w.kode).sort()).toEqual(["0007", "2004"]);
    expect((await panggil("POST", { badan: { aksi: "ngawur" } })).status).toBe(400);
    expect((await panggil("POST", { badan: lapor({ isian: [] }) })).isi.data).toMatchObject({ aktif: true, dicatat: false });
  });

  it("hak per peran: tanpa 'blangko-abt' ditolak 403; saklar boleh ditanya siapa pun yang masuk; tanpa masuk 401", async () => {
    await nyalakan(db!);
    aktor = "usr-bendahara";
    expect((await panggil("POST", { badan: lapor() })).status).toBe(403);
    expect((await panggil("GET", { query: `berkas=${encodeURIComponent(BERKAS)}` })).status).toBe(403);
    expect((await panggil("GET", { query: "bagian=saklar" })).status).toBe(200);
    aktor = "usr-hakim";
    expect((await panggil("POST", { badan: lapor() })).status).toBe(200);
    expect((await panggil("GET", { query: `berkas=${encodeURIComponent(BERKAS)}` })).status).toBe(200);
    aktor = null;
    expect((await panggil("POST", { badan: lapor() })).status).toBe(401);
    expect(await db!.queryAll(`SELECT id FROM aleta_blangko_lapor`)).toHaveLength(1);
  });
});
