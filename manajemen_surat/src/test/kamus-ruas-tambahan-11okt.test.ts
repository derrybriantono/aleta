// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_KAMUS_RUAS_TAMBAHAN } from "@/server/db/schema";
import { bacaLapisDb, lapisUntukBot } from "@/server/modules/aleta-ecourt/kamus-deteksi";

/**
 * ============================================================================
 * KAMUS DETEKSI - RUAS TAMBAHAN DI LAPIS DATABASE (0063) - 11 Okt 2026
 * ============================================================================
 *
 * Bug (temuan agen 2, batch B): layar Admin "Kamus deteksi & kalimat" hanya
 * menyimpan ruas baku. Pola benih memakai ruas tambahan yang dibaca mesin bot
 * (kebalikan, jenis, golongan, jk, sebab, cakupan, peran, ...). Menyunting
 * atau menonaktifkan pola benih dari layar menulis baris TANPA ruas itu, dan
 * baris database menimpa benih menurut kode: pola rusak diam-diam.
 *
 * Uji ini memakai BENIH SUNGGUHAN (aleta_bot/kamus-deteksi/awal) dan PEMUAT
 * LAPIS BOT SUNGGUHAN (kamusDeteksiLapis.terimaLapis) di balik gateway
 * tiruan: yang diperiksa adalah pola yang dipakai mesin bot sesudah admin
 * bertindak lewat rute, dan perilaku deteksinya (deteksiSaksiService).
 */

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot", "package.json"));
const BENIH = path.join(akar, "aleta_bot", "kamus-deteksi", "awal");

type PolaBot = Record<string, unknown> & { kode: string; asal: string; status?: string; re: RegExp };
type KamusBot = {
  lupakan: () => void;
  polaKelompok: (k: string) => PolaBot[];
  templatKelompok: (k: string) => Array<Record<string, unknown> & { kode: string; asal: string }>;
};
type LapisBot = {
  terimaLapis: (isi: unknown) => { ok: boolean; diterima: { pola: number; templat: number }; ditolak: string[]; galatSimpan: string };
  keadaanLapis: () => { jumlahPola: number; jumlahTemplat: number; sidik: string; diterimaPada: string };
  benihSemua: () => Record<string, unknown>;
  _setel: () => void;
};
type SaksiBot = {
  deteksiHubungan: (t: string, o?: Record<string, unknown>) => { kunci: string; jangkar?: string } | null;
  klasifikasiFrasa: (f: string) => { kunci: string; golongan: string; jk: string; yakinGolongan: string } | null;
};

const kamus = require_(path.join(akar, "aleta_bot/services/kamusDeteksi.js")) as KamusBot;
const lapisBot = require_(path.join(akar, "aleta_bot/services/kamusDeteksiLapis.js")) as LapisBot;
const saksi = require_(path.join(akar, "aleta_bot/services/deteksiSaksiService.js")) as SaksiBot;

const benihJson = (kelompok: string) =>
  JSON.parse(readFileSync(path.join(BENIH, `${kelompok}.json`), "utf8")) as {
    pola?: Array<Record<string, unknown>>;
    templat?: Array<Record<string, unknown>>;
  };
const benihPola = (kelompok: string, kode: string) => benihJson(kelompok).pola!.find((p) => p.kode === kode)!;
const benihTemplat = (kelompok: string, kode: string) => benihJson(kelompok).templat!.find((t) => t.kode === kode)!;

// ─── Migrasi 0063 ────────────────────────────────────────────────────────────

const pernyataan = (sql: string) =>
  sql
    .split("\n")
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

describe("migrasi 0063 - diklaim sekali di idx 62, DDL berkas = schema.ts", () => {
  const SQL63 = path.join(process.cwd(), "drizzle", "0063_aleta_kamus_ruas_tambahan.sql");

  it("jurnal: 0063 di idx 62 tepat sekali, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    expect(j.entries.filter((e) => e.tag.startsWith("0063_"))).toEqual([expect.objectContaining({ idx: 62, tag: "0063_aleta_kamus_ruas_tambahan" })]);
    expect(j.entries.filter((e) => e.idx === 62)).toHaveLength(1);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
  });

  it("pernyataan berkas = DDL_KAMUS_RUAS_TAMBAHAN, berjalan di pg-mem sesudah 0060 (dua kali aman)", () => {
    expect(pernyataan(readFileSync(SQL63, "utf8"))).toEqual(DDL_KAMUS_RUAS_TAMBAHAN.kolom.map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(readFileSync(path.join(process.cwd(), "drizzle/0060_aleta_kamus_deteksi.sql"), "utf8"));
    kosong.public.none(
      `INSERT INTO aleta_kamus_deteksi_pola (id, kode, kelompok, regex, dibuat_at, diubah_at) VALUES ('1', 'lama', 'alasan', 'x', 'k', 'k')`
    );
    kosong.public.none(readFileSync(SQL63, "utf8"));
    kosong.public.none(readFileSync(SQL63, "utf8"));
    // Baris yang sudah ada sebelum 0063 mendapat '{}' - bukan NULL yang meruntuhkan JSON.parse.
    expect(kosong.public.many("SELECT kode, tambahan FROM aleta_kamus_deteksi_pola")).toEqual([{ kode: "lama", tambahan: "{}" }]);
    expect(kosong.public.many("SELECT tambahan FROM aleta_kamus_deteksi_templat")).toEqual([]);
  });
});

// ─── Rute portal -> pemuat lapis bot sungguhan ───────────────────────────────

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
vi.mock("@/server/modules/aleta-ecourt/kamus-deteksi-gateway", async () => {
  const { createRequire: cr } = await import("node:module");
  const p = await import("node:path");
  const r = cr(p.join(p.resolve(process.cwd(), ".."), "aleta_bot", "package.json"));
  const lapis = r(p.join(p.resolve(process.cwd(), ".."), "aleta_bot/services/kamusDeteksiLapis.js")) as LapisBot;
  return {
    // Gateway tiruan yang meneruskan ke modul bot SUNGGUHAN (rute kamusDeteksiRoutes memanggil fungsi yang sama).
    panggilBotKamus: async (jalur: string, pilihan: { method?: string; body?: unknown } = {}) => {
      const cara = pilihan.method ?? "GET";
      if (jalur === "" && cara === "GET") return { ok: true, data: { ok: true, benih: lapis.benihSemua(), lapis: lapis.keadaanLapis() } };
      if (jalur === "/lapis" && cara === "PUT") return { ok: true, data: lapis.terimaLapis(pilihan.body ?? {}) };
      return { ok: false, error: "jalur tidak dikenal" };
    },
  };
});

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, unknown>; error?: { message: string } } };

async function panggil(cara: "GET" | "POST", badan?: unknown): Promise<Hasil> {
  const modul = (await import("@/app/api/aleta-ecourt/kamus-deteksi/route")) as unknown as Record<string, (r: NextRequest) => Promise<Response>>;
  const req = new NextRequest("http://localhost/api/aleta-ecourt/kamus-deteksi", {
    method: cara,
    headers: badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: badan !== undefined ? JSON.stringify(badan) : undefined,
  });
  const jawaban = await modul[cara](req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

type Kelompok = { kelompok: string; pola: Array<Record<string, unknown>>; templat: Array<Record<string, unknown>> };
const butirLayar = async (jenis: "pola" | "templat", kode: string) => {
  const g = await panggil("GET");
  expect(g.status).toBe(200);
  return (g.isi.data.kelompok as Kelompok[]).flatMap((k) => k[jenis]).find((x) => x.kode === kode) as Record<string, unknown>;
};
const polaBot = (kelompok: string, kode: string) => kamus.polaKelompok(kelompok).find((p) => p.kode === kode);

/** Badan persis seperti yang dikirim layar Admin sesudah perbaikan (simpanPola di komponen). */
function badanLayar(item: Record<string, unknown>, ubah: Record<string, unknown> = {}) {
  return {
    tindakan: "simpan-pola",
    kode: item.kode,
    kelompok: item.kelompok,
    label: item.label,
    kunci: item.kunci,
    regex: item.regex,
    flags: item.flags,
    status: item.status,
    yakin: item.yakin,
    contohBenar: item.contohBenar,
    contohSalah: item.contohSalah,
    ukur: item.ukur,
    catatan: item.catatan,
    tambahan: item.tambahan,
    ...ubah,
  };
}

describe("ruas tambahan pola benih: sunting/nonaktifkan dari rute -> bot menerima pola utuh", () => {
  const folder = mkdtempSync(path.join(process.env.TMP || os.tmpdir(), "kamus-ruas-"));
  const berkas = path.join(folder, "kamus-deteksi-lapis.json");

  beforeEach(async () => {
    process.env.ALETA_KAMUS_DETEKSI_LAPIS_PATH = berkas;
    rmSync(berkas, { force: true });
    kamus.lupakan();
    lapisBot._setel();
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });
  afterAll(() => {
    delete process.env.ALETA_KAMUS_DETEKSI_LAPIS_PATH;
    kamus.lupakan();
    lapisBot._setel();
    rmSync(folder, { recursive: true, force: true });
  });

  it("layar menampilkan ruas tambahan pola benih (jangkar terbalik: jenis + peta kebalikan; ukur pihakLain)", async () => {
    const item = await butirLayar("pola", "hub-jangkar-terbalik");
    const benih = benihPola("saksi-hubungan", "hub-jangkar-terbalik");
    expect(item).toMatchObject({ asal: "benih", status: "aktif" });
    expect(item.tambahan).toEqual({ jenis: "jangkar", kebalikan: benih.kebalikan });
    expect(item.ukur).toMatchObject({ pihakLain: 7, beda: 0 });
  });

  it("sunting pola benih dari layar (label diubah): baris database membawa ruas tambahan, bot memakai pola database UTUH dan deteksinya tetap benar", async () => {
    const sebelum = saksi.deteksiHubungan("Saya kenal dengan Tergugat karena Tergugat adalah menantu saya", { bentuk: "kalimat" });
    expect(sebelum).toMatchObject({ kunci: "Mertua", jangkar: "hub-jangkar-terbalik" });

    const item = await butirLayar("pola", "hub-jangkar-terbalik");
    const r = await panggil("POST", badanLayar(item, { label: "Jangkar terbalik (disunting admin)" }));
    expect(r.status).toBe(200);
    expect(r.isi.data.dorong).toMatchObject({ ok: true, jumlahPola: 1 });

    const benih = benihPola("saksi-hubungan", "hub-jangkar-terbalik");
    const dipakai = polaBot("saksi-hubungan", "hub-jangkar-terbalik")!;
    expect(dipakai).toMatchObject({ asal: "database", label: "Jangkar terbalik (disunting admin)", jenis: "jangkar" });
    expect(dipakai.kebalikan).toEqual(benih.kebalikan);
    expect(dipakai.ukur).toEqual(benih.ukur);
    expect(lapisBot.keadaanLapis().jumlahPola).toBe(1);

    // Perilaku mesin bot atas pola yang kini berasal dari database.
    expect(saksi.deteksiHubungan("Saya kenal dengan Tergugat karena Tergugat adalah menantu saya", { bentuk: "kalimat" })).toMatchObject({
      kunci: "Mertua",
      jangkar: "hub-jangkar-terbalik",
    });
    expect(saksi.deteksiHubungan("Penggugat adalah adik kandung saya sedangkan Tergugat adalah adik ipar saya", { bentuk: "kalimat" })?.kunci).toBe(
      "Kakak Kandung"
    );
    // Layar membaca baris database dengan ruas tambahan yang sama.
    expect(await butirLayar("pola", "hub-jangkar-terbalik")).toMatchObject({ asal: "database-menimpa", tambahan: { jenis: "jangkar", kebalikan: benih.kebalikan } });
  });

  it("bukti bug lama: baris tanpa ruas tambahan mematahkan jangkar terbalik di bot", () => {
    const benih = benihPola("saksi-hubungan", "hub-jangkar-terbalik");
    // Bentuk yang dulu terkirim: hanya ruas baku.
    const { jenis: _j, kebalikan: _k, ...hanyaBaku } = benih;
    void _j;
    void _k;
    lapisBot.terimaLapis({ sidik: "lama", pola: [{ ...hanyaBaku, kelompok: "saksi-hubungan" }], templat: [] });
    expect(saksi.deteksiHubungan("Saya kenal dengan Tergugat karena Tergugat adalah menantu saya", { bentuk: "kalimat" })?.kunci).not.toBe("Mertua");
  });

  it("klien lama (badan tanpa `tambahan`) menyunting pola benih: ruas tambahan + rincian ukur DIWARISI dari benih", async () => {
    const benih = benihPola("saksi-hubungan", "hub-ibu-kandung");
    const r = await panggil("POST", {
      tindakan: "simpan-pola",
      kode: "hub-ibu-kandung",
      kelompok: "saksi-hubungan",
      label: "Ibu kandung (disunting klien lama)",
      kunci: benih.kunci,
      regex: benih.regex,
      flags: benih.flags,
      status: "aktif",
      yakin: benih.yakin,
      contohBenar: benih.contohBenar,
      contohSalah: benih.contohSalah,
      // Bentuk lama layar: hanya n/tepat/salahTangkap/sumber.
      ukur: { n: (benih.ukur as { n: number }).n, tepat: (benih.ukur as { tepat: number }).tepat, salahTangkap: 0, sumber: "x" },
      catatan: "",
    });
    expect(r.status).toBe(200);
    const dipakai = polaBot("saksi-hubungan", "hub-ibu-kandung")!;
    expect(dipakai).toMatchObject({ asal: "database", golongan: "keluarga", jk: "P", jenis: benih.jenis });
    expect((dipakai.ukur as Record<string, unknown>).golongan).toEqual((benih.ukur as Record<string, unknown>).golongan);
    // deteksiSaksiService membaca golongan, jk, dan ukur.golongan (yakin golongan "pasti" bila n >= 30 & >= 95%).
    expect(saksi.klasifikasiFrasa("ibu kandung")).toMatchObject({ kunci: "Ibu Kandung", golongan: "keluarga", jk: "P", yakinGolongan: "pasti" });
    // Kunci badan yang bukan ruas pola (tindakan) tidak menyusup menjadi ruas tambahan.
    expect(dipakai).not.toHaveProperty("tindakan");
  });

  it("nonaktifkan pola benih lalu aktifkan & kembalikan: salinan memuat SELURUH ruas, bot membuang/memakai lagi pola utuh", async () => {
    const benih = benihPola("alasan", "sangkal-f-tidak-bertengkar");
    expect(polaBot("alasan", "sangkal-f-tidak-bertengkar")).toMatchObject({ asal: "benih", cakupan: "letak" });

    const n = await panggil("POST", { tindakan: "status", jenis: "pola", kode: "sangkal-f-tidak-bertengkar", status: "nonaktif" });
    expect(n.status).toBe(200);
    expect(n.isi.data.hasil).toMatchObject({ disalinDariBenih: true, status: "nonaktif" });
    expect(polaBot("alasan", "sangkal-f-tidak-bertengkar")).toBeUndefined();
    const baris = (await bacaLapisDb(db!)).pola.find((p) => p.kode === "sangkal-f-tidak-bertengkar")!;
    expect(baris.tambahan).toEqual({ sebab: benih.sebab, jenis: benih.jenis, cakupan: benih.cakupan });
    expect(baris.ukur).toEqual(benih.ukur);

    const a = await panggil("POST", { tindakan: "status", jenis: "pola", kode: "sangkal-f-tidak-bertengkar", status: "aktif" });
    expect(a.status).toBe(200);
    const dipakai = polaBot("alasan", "sangkal-f-tidak-bertengkar")!;
    expect(dipakai).toMatchObject({ asal: "database", status: "aktif", sebab: benih.sebab, jenis: benih.jenis, cakupan: benih.cakupan, kunci: "F" });
    // Selain asal/kelompok/re (ditambahkan bot), pola database = pola benih.
    const { asal: _a, re: _re, ...tanpaBuatanBot } = dipakai;
    void _a;
    void _re;
    expect(tanpaBuatanBot).toEqual({ ...benih, kelompok: "alasan" });

    const k = await panggil("POST", { tindakan: "kembalikan", jenis: "pola", kode: "sangkal-f-tidak-bertengkar" });
    expect(k.status).toBe(200);
    expect(polaBot("alasan", "sangkal-f-tidak-bertengkar")).toMatchObject({ asal: "benih", cakupan: "letak" });
    expect(lapisBot.keadaanLapis().jumlahPola).toBe(0);
  });

  it("templat benih dinonaktifkan lalu disunting dari layar: kodeAbt/asal dan syarat tidak hilang", async () => {
    const benih = benihTemplat("kalimat-hakim", "hakim-5227-ringkas");
    expect((await panggil("POST", { tindakan: "status", jenis: "templat", kode: "hakim-5227-ringkas", status: "nonaktif" })).status).toBe(200);
    expect(kamus.templatKelompok("kalimat-hakim").some((t) => t.kode === "hakim-5227-ringkas")).toBe(false);

    const item = await butirLayar("templat", "hakim-5227-ringkas");
    expect(item).toMatchObject({ asal: "database-menimpa", status: "nonaktif", syarat: benih.syarat, tambahan: { kodeAbt: "5227", asal: benih.asal } });
    // Layar lama tidak mengirim syarat maupun tambahan sama sekali.
    const s = await panggil("POST", { tindakan: "simpan-templat", kode: item.kode, kelompok: item.kelompok, label: item.label, gaya: item.gaya, teks: item.teks, status: "aktif", catatan: "" });
    expect(s.status).toBe(200);
    const dipakai = kamus.templatKelompok("kalimat-hakim").find((t) => t.kode === "hakim-5227-ringkas")!;
    expect(dipakai).toMatchObject({ asal: "database", kodeAbt: "5227", syarat: benih.syarat, teks: benih.teks });
  });

  it("layar Admin menyunting ruas tambahan; ruas yang bentrok, bukan objek, atau bernama ngawur ditolak 400 sebelum menyentuh bot", async () => {
    const item = await butirLayar("pola", "hub-jangkar-terbalik");
    const kebalikan = { ...(item.tambahan as { kebalikan: Record<string, string> }).kebalikan, Besan: "Besan", Pengasuh: "Anak Asuh" };
    const ok = await panggil("POST", badanLayar(item, { tambahan: { jenis: "jangkar", kebalikan } }));
    expect(ok.status).toBe(200);
    expect(polaBot("saksi-hubungan", "hub-jangkar-terbalik")!.kebalikan).toEqual(kebalikan);

    const sidikSah = lapisBot.keadaanLapis().sidik;
    const bentrok = await panggil("POST", badanLayar(item, { tambahan: { jenis: "jangkar", regex: "apa saja" } }));
    expect(bentrok.status).toBe(400);
    expect(bentrok.isi.error?.message).toMatch(/ruas tambahan "regex" bentrok dengan ruas baku/);
    const daftar = await panggil("POST", badanLayar(item, { tambahan: ["jangkar"] }));
    expect(daftar.status).toBe(400);
    expect(daftar.isi.error?.message).toMatch(/harus objek JSON/);
    const nama = await panggil("POST", badanLayar(item, { tambahan: { "nama ngawur": 1 } }));
    expect(nama.status).toBe(400);
    // Penolakan tidak mengubah apa yang dipakai bot.
    expect(lapisBot.keadaanLapis().sidik).toBe(sidikSah);
    expect(polaBot("saksi-hubungan", "hub-jangkar-terbalik")!.kebalikan).toEqual(kebalikan);

    // Mengosongkan tambahan dengan sengaja ({}) memang mengosongkan.
    await panggil("POST", badanLayar(item, { tambahan: {} }));
    expect(polaBot("saksi-hubungan", "hub-jangkar-terbalik")).not.toHaveProperty("kebalikan");
  });

  it("lapisUntukBot: ruas baku selalu menang atas ruas tambahan; tanpa tambahan bentuknya sama dengan sebelum 0063", () => {
    const dasar = {
      kode: "p-1",
      kelompok: "uji",
      label: "",
      kunci: "",
      regex: "x",
      flags: "i",
      status: "aktif" as const,
      yakin: "ragu" as const,
      contohBenar: [],
      contohSalah: [],
      ukur: { n: 0, tepat: 0, salahTangkap: 0 },
      catatan: "",
      asalCalon: "",
      diubahOleh: "",
      diubahAt: "",
    };
    const l = lapisUntukBot({ pola: [{ ...dasar, tambahan: { regex: "(menimpa", status: "draf", jenis: "fakta" } }], templat: [] });
    expect(l.pola[0]).toMatchObject({ regex: "x", status: "aktif", jenis: "fakta" });
    const tanpa = lapisUntukBot({ pola: [dasar], templat: [] });
    const kosong = lapisUntukBot({ pola: [{ ...dasar, tambahan: {} }], templat: [] });
    expect(Object.keys(kosong.pola[0])).toEqual(Object.keys(tanpa.pola[0]));
    expect(kosong.sidik).toBe(tanpa.sidik);
  });

  it("pemuat bot tetap menolak baris rusak SATU PER SATU; pola sah ber-ruas tambahan tetap dipasang", () => {
    const benih = benihPola("saksi-hubungan", "hub-jangkar-terbalik");
    const h = lapisBot.terimaLapis({
      sidik: "uji",
      pola: [
        { ...benih, kelompok: "saksi-hubungan", label: "dari database" },
        { kode: "rusak", kelompok: "saksi-hubungan", regex: "(menantu", jenis: "jangkar", kebalikan: { a: "b" } },
        { kode: "tanpa-kelompok", regex: "x", jenis: "jangkar" },
      ],
      templat: [],
    });
    expect(h.diterima.pola).toBe(1);
    expect(h.ditolak).toEqual([expect.stringMatching(/^rusak: regex tidak terkompilasi/), "pola tanpa kode/kelompok"]);
    expect(polaBot("saksi-hubungan", "hub-jangkar-terbalik")).toMatchObject({ asal: "database", label: "dari database", kebalikan: benih.kebalikan });
  });
});
