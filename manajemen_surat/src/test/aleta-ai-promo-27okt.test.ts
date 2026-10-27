// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { PenggunaanToken } from "@/lib/aleta-ai/biaya";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ALETA_AI_PROMO } from "@/server/db/schema";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import { PESAN_BATAS_HARIAN } from "@/server/modules/aleta-ai/batas";
import { strukGiliran, tampilDompet } from "@/server/modules/aleta-ai/dompet";
import { ringkasAi } from "@/server/modules/aleta-ai/layanan";
import { GalatKlienAi, suntikKlienAi, type HasilAi, type KlienAi, type OpsiAlir } from "@/server/modules/aleta-ai/klien";
import { simpanKurs, tanggalLokal } from "@/server/modules/aleta-ai/kurs";
import { laporanKeCsv, laporanKeXlsx, laporanRentang } from "@/server/modules/aleta-ai/laporan";
import { kirimPesan, perkirakanPesan, ulangiBatasLaju, type EventAi } from "@/server/modules/aleta-ai/mesin";
import { buatPercakapan } from "@/server/modules/aleta-ai/percakapan";
import { simpanPengaturan, type PerubahanPengaturan } from "@/server/modules/aleta-ai/pengaturan";
import { bacaPromo, pemakaianApiPromo, PROMO_BAWAAN, simpanPromo, statusPromo, type PerubahanPromo } from "@/server/modules/aleta-ai/promo";
import { unggahProyek } from "@/server/modules/aleta-ai/proyek";
import { daftarMutasi, saldoPengguna, terapkanMutasi, verifikasiSaldo } from "@/server/modules/aleta-ai/saldo";
import { susunZip } from "@/server/shared/zip";

/**
 * ============================================================================
 * ALETA Ai - PROGRAM PROMOSI "GRATIS PAKAI ALETA Ai" (27 Okt 2026)
 * ============================================================================
 *
 * Tanpa jaringan dan tanpa kunci API: klien Claude TIRUAN. Perilaku nyata (pg-mem + rute HTTP).
 *
 *   1. migrasi 0113 = DDL schema.ts, jurnal idx 99, tabel ikut cadangan
 *   2. pengaturan: nilai bawaan, pemeriksaan, jejak
 *   3. status: periode WITA, sasaran peran, Super Admin, sisa jatah
 *   4. giliran: Rp0, saldo tidak tersentuh, jatah harian/rupiah, batas satker promosi, gagal tidak memakai jatah
 *   5. pengguna di luar sasaran/periode: persis seperti biasa
 *   6. laporan memisahkan giliran promosi dari gratis Super Admin; dompet dan struk
 *   7. rute: hak per peran
 */

const ctx = vi.hoisted(() => ({ db: null as unknown, aktor: null as string | null }));

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => ctx.db,
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => ctx.aktor }));

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const hakim = (id: string, extra: Partial<PelakuAi> = {}): PelakuAi => ({ id, nama: `Hakim ${id}`, peranId: "hakim", superAdmin: false, ...extra });
const panitera = (id: string): PelakuAi => ({ id, nama: `Panitera ${id}`, peranId: "panitera", superAdmin: false });
const superAdmin: PelakuAi = { id: "u-sa", nama: "Super Rekaan", peranId: "super-admin", superAdmin: true };

const geser = (hari: number, dari: Date = new Date()) => tanggalLokal(new Date(dari.getTime() + hari * 86_400_000));

const MENU_MD = `# ALETA_05 — TRIGGER MENU LENGKAP
## KELOMPOK A — DRAFTING UTAMA
| Trigger | Output |
|---|---|
| Duduk Perkara | Ringkasan rekaan |

## KELOMPOK I — UTILITAS
| Trigger | Output |
|---|---|
| help / bantuan / ? | Menu ini |
`;

const zipRekaan = () =>
  susunZip(
    [
      { nama: "ALETA_AI_PA_Edition_V4_5_Core_Prompt.md", isi: "# CORE PROMPT REKAAN\nAsisten rekaan untuk uji. " + "Kalimat pengisi. ".repeat(30) },
      { nama: "ALETA_05_Trigger_Menu.md", isi: MENU_MD },
      { nama: "ALETA_08_Format_Putusan_Donggala.md", isi: "# ALETA_08 — FORMAT PUTUSAN\nIsi rekaan." },
    ].map((e) => ({ nama: e.nama, isi: Buffer.from(e.isi, "utf8") }))
  );

type Jawaban = { teks?: string[]; penggunaan?: Partial<PenggunaanToken>; galat?: GalatKlienAi };
const NOL: PenggunaanToken = { masuk: 0, keluar: 0, cacheTulis: 0, cacheBaca: 0 };

class KlienTiruan implements KlienAi {
  jawaban = 0;
  constructor(private antrean: Jawaban[] = []) {}

  async alirkan(p: import("@/lib/aleta-ai/penyusun").PermintaanAi, opsi: OpsiAlir = {}): Promise<HasilAi> {
    this.jawaban += 1;
    const j = this.antrean.shift() ?? { teks: ["Jawaban rekaan."], penggunaan: { masuk: 1000, keluar: 500 } };
    if (j.galat) throw j.galat;
    let teks = "";
    for (const potong of j.teks ?? []) {
      await Promise.resolve();
      teks += potong;
      opsi.onTeks?.(potong);
    }
    return { teks, berhenti: "selesai", model: p.model, penggunaan: { ...NOL, ...(j.penggunaan ?? {}) }, iterasi: [], kategoriTolak: "", dialihkan: false };
  }

  async hitungToken(): Promise<number> {
    return 4000;
  }
}

async function kumpulkan(g: AsyncGenerator<EventAi, void, void>): Promise<EventAi[]> {
  const hasil: EventAi[] = [];
  for await (const e of g) hasil.push(e);
  return hasil;
}

const TEKS_DP = "Duduk Perkara dari gugatan rekaan nomor 1/Pdt.G/2026";

async function dbBaru(): Promise<AletaDatabase> {
  const db = await createAletaDatabase({ useInMemory: true, seed: false });
  await simpanKurs(db, { tanggal: tanggalLokal(), kurs: 16000, sumber: "uji" });
  await unggahProyek(db, superAdmin.id, { bita: zipRekaan(), namaBerkas: "proyek-rekaan.zip" });
  return db;
}

const isi = (db: AletaDatabase, id: string, rp: number) => terapkanMutasi(db, { penggunaId: id, jenis: "isi", jumlahRp: rp, catatan: "uji" });
const jenisMutasi = async (db: AletaDatabase, id: string) => (await daftarMutasi(db, id, 200)).map((m) => `${m.jenis}:${m.jumlahRp}`).reverse();

const PROMO_MENYALA = (tambah: PerubahanPromo = {}): PerubahanPromo => ({
  aktif: true,
  mulai: geser(-1),
  akhir: geser(5),
  giliranPerHari: 20,
  rupiahPeriode: 25_000,
  batasSatkerRp: 500_000,
  semuaPeran: true,
  peran: [],
  ...tambah,
});

// ─── 1. Migrasi ──────────────────────────────────────────────────────────────

describe("migrasi 0113 - berkas = DDL schema.ts, jurnal idx 99, ikut cadangan", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0113_aleta_ai_promo.sql");

  it("jurnal: 0113 sekali di idx 99 (sesudah 0112), tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0113_"))).toEqual([expect.objectContaining({ idx: 99, tag: "0113_aleta_ai_promo" })]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i]?.when).toBeGreaterThan(j.entries[i - 1]?.when ?? 0);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_ALETA_AI_PROMO dan berjalan di atas tabel 0078 (pg-mem); tabel baru ikut cadangan", () => {
    const isiSql = readFileSync(SQL, "utf8");
    expect(pernyataan(isiSql)).toEqual([...DDL_ALETA_AI_PROMO.tabel, ...DDL_ALETA_AI_PROMO.indeks, ...DDL_ALETA_AI_PROMO.kolom].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(readFileSync(path.join(process.cwd(), "drizzle", "0078_aleta_ai.sql"), "utf8"));
    kosong.public.none(isiSql);
    expect(kosong.public.many(`SELECT * FROM aleta_ai_promo_pakai`)).toEqual([]);
    kosong.public.none(`INSERT INTO aleta_ai_obrolan_pesan (id, percakapan_id, pemilik_id, peran, dibuat_at) VALUES ('p', 'c', 'u', 'ai', 'x')`);
    expect(kosong.public.one(`SELECT promo FROM aleta_ai_obrolan_pesan`)).toEqual({ promo: 0 });
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_ai_promo_pakai");
  });
});

// ─── 2-6. Berbasis data ──────────────────────────────────────────────────────

describe("program promosi gratis ALETA Ai (pg-mem)", () => {
  let db: AletaDatabase;
  const atur = (p: PerubahanPengaturan) => simpanPengaturan(db, superAdmin.id, p);
  const promoAtur = (p: PerubahanPromo) => simpanPromo(db, superAdmin.id, p);

  beforeAll(async () => {
    db = await dbBaru();
    ctx.db = db;
  }, 180000);

  afterAll(async () => {
    suntikKlienAi(undefined);
    await db?.close();
  });

  afterEach(async () => {
    ulangiBatasLaju();
    await atur({ aktif: true, batasHarianRp: 100_000, batasHarianToken: 3_000_000, batasLajuPerMenit: 60, batasSatkerBulananRp: 5_000_000 });
    await promoAtur({ aktif: false });
    await db.run(`DELETE FROM aleta_ai_promo_pakai`);
  });

  async function siapkan(id: string, saldo = 0, klien: KlienTiruan = new KlienTiruan()) {
    suntikKlienAi(klien);
    if (saldo > 0) await isi(db, id, saldo);
    return (await buatPercakapan(db, id)).id;
  }
  const giliran = async (p: PelakuAi, pc: string) => kumpulkan(kirimPesan(db, p, pc, { teks: TEKS_DP }));
  const baris = (id: string) =>
    db.queryAll<{ jenis: string; dihitung: number; setara_rp: number; token: number; biaya_api_rp: number }>(
      `SELECT jenis, dihitung, setara_rp, token, biaya_api_rp FROM aleta_ai_promo_pakai WHERE pengguna_id = ? ORDER BY dibuat_at, id`,
      [id]
    );

  // ── 2. Pengaturan ──
  it("bawaan: mati, judul 'Gratis mencoba ALETA Ai', 20 giliran/hari, Rp25.000, batas satker Rp500.000, semua pengguna", async () => {
    expect(PROMO_BAWAAN).toMatchObject({ aktif: false, judul: "Gratis mencoba ALETA Ai", giliranPerHari: 20, rupiahPeriode: 25_000, batasSatkerRp: 500_000, semuaPeran: true });
    expect(await bacaPromo(db)).toMatchObject({ aktif: false, giliranPerHari: 20 });
    expect((await statusPromo(db, hakim("u-x"))).tampil).toBe(false);
  });

  it("pemeriksaan: tanggal wajib saat menyala, akhir tidak sebelum mulai, minimal satu jatah, batas satker > 0, peran sasaran wajib", async () => {
    await expect(promoAtur({ aktif: true })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/tanggal mulai/) });
    await expect(promoAtur(PROMO_MENYALA({ mulai: geser(3), akhir: geser(1) }))).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/sebelum tanggal mulai/) });
    await expect(promoAtur(PROMO_MENYALA({ giliranPerHari: 0, rupiahPeriode: 0 }))).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/salah satu/) });
    await expect(promoAtur(PROMO_MENYALA({ batasSatkerRp: 0 }))).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/pengaman tagihan/) });
    await expect(promoAtur(PROMO_MENYALA({ semuaPeran: false, peran: [] }))).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/minimal satu peran/) });
    await expect(promoAtur(PROMO_MENYALA({ mulai: geser(0), akhir: geser(400) }))).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/paling panjang/) });
    await expect(promoAtur({ giliranPerHari: "banyak" as unknown as number })).rejects.toMatchObject({ status: 400 });
    expect((await bacaPromo(db)).aktif).toBe(false);
  });

  it("menyimpan menyalakan promosi dan tercatat di jejak tanpa isi pesan", async () => {
    await promoAtur(PROMO_MENYALA({ judul: "Gratis mencoba ALETA Ai" }));
    expect(await bacaPromo(db)).toMatchObject({ aktif: true, giliranPerHari: 20, rupiahPeriode: 25_000, batasSatkerRp: 500_000 });
    const jejak = await db.queryAll<{ aksi: string; pengguna_id: string; ringkas: string }>(`SELECT aksi, pengguna_id, ringkas FROM aleta_ai_jejak WHERE aksi = 'admin.promo'`);
    expect(jejak.length).toBeGreaterThanOrEqual(1);
    expect(jejak.at(-1)).toMatchObject({ pengguna_id: superAdmin.id });
    expect(jejak.at(-1)?.ringkas).toMatch(/MENYALA/);
  });

  // ── 3. Status ──
  it("periode WITA: sebelum mulai dan sesudah akhir tidak tampil; hari mulai dan hari akhir termasuk", async () => {
    const hariIni = geser(0);
    await promoAtur(PROMO_MENYALA({ mulai: hariIni, akhir: hariIni }));
    const kini = new Date();
    expect((await statusPromo(db, hakim("u-per"), { sekarang: kini })).berlaku).toBe(true);
    const besok = new Date(kini.getTime() + 86_400_000);
    const kemarin = new Date(kini.getTime() - 86_400_000);
    expect(await statusPromo(db, hakim("u-per"), { sekarang: besok })).toMatchObject({ tampil: false, berlaku: false, alasan: "berakhir" });
    expect(await statusPromo(db, hakim("u-per"), { sekarang: kemarin })).toMatchObject({ tampil: false, berlaku: false, alasan: "belum-mulai" });
    // Pergantian hari memakai WITA (UTC+8): 23.30 WITA = 15.30 UTC hari yang sama, 00.30 WITA hari berikutnya = 16.30 UTC.
    const [t, b, h] = hariIni.split("-").map(Number) as [number, number, number];
    const malam = new Date(Date.UTC(t, b - 1, h, 15, 30));
    const lewatTengahMalam = new Date(Date.UTC(t, b - 1, h, 16, 30));
    expect((await statusPromo(db, hakim("u-per"), { sekarang: malam })).berlaku).toBe(true);
    expect((await statusPromo(db, hakim("u-per"), { sekarang: lewatTengahMalam })).alasan).toBe("berakhir");
  });

  it("sasaran peran: hanya peran terpilih (juga peran tambahan); Super Admin tidak termasuk", async () => {
    await promoAtur(PROMO_MENYALA({ semuaPeran: false, peran: ["hakim"] }));
    expect(await statusPromo(db, hakim("u-s1"))).toMatchObject({ tampil: true, berlaku: true, alasan: "" });
    expect(await statusPromo(db, panitera("u-s2"))).toMatchObject({ tampil: false, berlaku: false, alasan: "bukan-sasaran" });
    expect((await statusPromo(db, { ...panitera("u-s3"), peranTambahan: ["hakim"] })).berlaku).toBe(true);
    expect(await statusPromo(db, superAdmin)).toMatchObject({ tampil: false, berlaku: false, alasan: "super-admin" });
    await promoAtur({ semuaPeran: true });
    expect((await statusPromo(db, panitera("u-s2"))).berlaku).toBe(true);
  });

  // ── 4. Giliran ──
  it("giliran promosi: Rp0, saldo dan kuota tidak tersentuh, tanpa saldo pun jalan, ditandai promo dan tercatat di pemakaian", async () => {
    await promoAtur(PROMO_MENYALA());
    const id = "u-gr-1";
    const pc = await siapkan(id, 0, new KlienTiruan([{ teks: ["Bahwa ", "rekaan."], penggunaan: { masuk: 2000, keluar: 3000, cacheTulis: 10_000 } }]));
    const e = await giliran(hakim(id), pc);
    expect(e[0]).toMatchObject({ jenis: "perkiraan", perkiraanRp: 0 });
    expect(e.at(-1)).toMatchObject({ jenis: "selesai", biayaRp: 0, saldoRp: 0 });
    expect(await jenisMutasi(db, id)).toEqual([]);
    expect(await saldoPengguna(db, id)).toBe(0);
    const pesan = await db.queryOne<{ promo: number; gratis: number; biaya_rp: number; biaya_api_rp: number }>(
      `SELECT promo, gratis, biaya_rp, biaya_api_rp FROM aleta_ai_obrolan_pesan WHERE pemilik_id = ? AND peran = 'ai'`,
      [id]
    );
    expect(Number(pesan?.promo)).toBe(1);
    expect(Number(pesan?.gratis)).toBe(0); // terpisah dari gratis Super Admin
    expect(Number(pesan?.biaya_rp)).toBe(0);
    expect(Number(pesan?.biaya_api_rp)).toBeGreaterThan(0);
    const b = await baris(id);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ jenis: "giliran", dihitung: 1 });
    expect(Number(b[0]?.setara_rp)).toBeGreaterThanOrEqual(1000);
    expect(Number(b[0]?.token)).toBe(15_000);
    expect(Number(b[0]?.biaya_api_rp)).toBeGreaterThan(0);
    expect(await statusPromo(db, hakim(id))).toMatchObject({ terpakaiGiliranHariIni: 1, sisaGiliranHariIni: 19 });
  });

  it("perkiraan sebelum jalan: gratis promosi, Rp0, boleh jalan tanpa saldo", async () => {
    await promoAtur(PROMO_MENYALA());
    const id = "u-gr-2";
    const pc = await siapkan(id, 0);
    expect(await perkirakanPesan(db, hakim(id), pc, { teks: TEKS_DP })).toMatchObject({ perkiraanRp: 0, tahanRp: 0, gratis: true, promo: true, bolehJalan: true });
    await promoAtur({ aktif: false });
    const biasa = await perkirakanPesan(db, hakim(id), pc, { teks: TEKS_DP });
    expect(biasa).toMatchObject({ gratis: false, bolehJalan: false });
    expect(biasa.perkiraanRp).toBeGreaterThan(0);
  });

  it("jatah giliran per hari habis: giliran berikutnya kembali ke saldo dengan pesan jelas; saldo ada = ditagih biasa", async () => {
    await promoAtur(PROMO_MENYALA({ giliranPerHari: 2, rupiahPeriode: 0 }));
    const id = "u-gr-3";
    const pc = await siapkan(id, 0);
    expect((await giliran(hakim(id), pc)).at(-1)).toMatchObject({ jenis: "selesai", biayaRp: 0 });
    expect((await giliran(hakim(id), pc)).at(-1)).toMatchObject({ jenis: "selesai", biayaRp: 0 });
    expect(await statusPromo(db, hakim(id))).toMatchObject({ berlaku: false, alasan: "jatah-harian-habis", sisaGiliranHariIni: 0, tampil: true });
    const ditolak = await giliran(hakim(id), pc);
    expect(ditolak).toHaveLength(1);
    expect(ditolak[0]).toMatchObject({ jenis: "gagal", pesan: expect.stringMatching(/Jatah gratis ALETA Ai Anda untuk hari ini sudah habis[\s\S]*Saldo ALETA Ai Anda/) });
    await isi(db, id, 100_000);
    const biasa = await giliran(hakim(id), pc);
    const akhir = biasa.at(-1) as Extract<EventAi, { jenis: "selesai" }>;
    expect(akhir.jenis).toBe("selesai");
    expect(akhir.biayaRp).toBeGreaterThan(0);
    expect(await saldoPengguna(db, id)).toBe(100_000 - akhir.biayaRp);
    expect((await baris(id)).length).toBe(2); // giliran berbayar tidak masuk catatan promosi
    expect((await verifikasiSaldo(db, id)).seimbang).toBe(true);
  });

  it("jatah rupiah-setara habis (periode): giliran berikutnya ditagih biasa; jatah giliran 0 = tanpa batas jumlah", async () => {
    await promoAtur(PROMO_MENYALA({ giliranPerHari: 0, rupiahPeriode: 1000 }));
    const id = "u-gr-4";
    const pc = await siapkan(id, 0);
    expect((await giliran(hakim(id), pc)).at(-1)).toMatchObject({ jenis: "selesai", biayaRp: 0 });
    const st = await statusPromo(db, hakim(id));
    expect(st).toMatchObject({ berlaku: false, alasan: "jatah-rupiah-habis", sisaRupiah: 0, sisaGiliranHariIni: null });
    expect(st.pesan).toMatch(/selama promosi sudah terpakai/);
    expect((await giliran(hakim(id), pc))[0]).toMatchObject({ jenis: "gagal", pesan: expect.stringMatching(/^Jatah gratis ALETA Ai Anda selama promosi/) });
  });

  it("batas biaya API promosi satker: tercapai = promosi berhenti untuk SEMUA; batas harian token tetap berlaku", async () => {
    await promoAtur(PROMO_MENYALA({ batasSatkerRp: 1 }));
    const a = "u-sat-1";
    const pcA = await siapkan(a, 0);
    // Perkiraan biaya API satu giliran sudah melampaui Rp1: promosi tidak berlaku untuk giliran itu.
    expect(await statusPromo(db, hakim(a), { tambahanApiRp: 100 })).toMatchObject({ berlaku: false, alasan: "batas-promo-habis" });
    expect((await giliran(hakim(a), pcA))[0]).toMatchObject({ jenis: "gagal", pesan: expect.stringMatching(/Program gratis ALETA Ai telah mencapai batasnya/) });

    await promoAtur({ batasSatkerRp: 100_000 });
    const b = "u-sat-2";
    const pcB = await siapkan(b, 0, new KlienTiruan([{ teks: ["x"], penggunaan: { masuk: 100_000, keluar: 50_000 } }]));
    expect((await giliran(hakim(b), pcB)).at(-1)).toMatchObject({ jenis: "selesai", biayaRp: 0 });
    const terpakai = await pemakaianApiPromo(db, await bacaPromo(db));
    expect(terpakai).toBeGreaterThan(0);
    expect(terpakai).toBeGreaterThan(1);
    await promoAtur({ batasSatkerRp: 1 });
    // Sudah tercapai: pengguna lain (belum memakai apa pun) ikut berhenti.
    expect(await statusPromo(db, hakim("u-sat-3"))).toMatchObject({ berlaku: false, alasan: "batas-promo-habis" });

    await promoAtur({ batasSatkerRp: 500_000 });
    await atur({ batasHarianToken: 1000 });
    expect((await giliran(hakim("u-sat-4"), await siapkan("u-sat-4", 0)))[0]).toEqual({ jenis: "gagal", pesan: PESAN_BATAS_HARIAN });
  });

  it("giliran gagal tidak memakai jatah dan tidak membebani saldo (biaya API tetap tercatat)", async () => {
    await promoAtur(PROMO_MENYALA({ giliranPerHari: 3 }));
    const id = "u-gr-5";
    const pc = await siapkan(id, 0, new KlienTiruan([{ galat: new GalatKlienAi("lain", "gangguan") }]));
    const e = await giliran(hakim(id), pc);
    expect(e.at(-1)).toMatchObject({ jenis: "gagal" });
    expect((await baris(id))[0]).toMatchObject({ jenis: "giliran", dihitung: 0, setara_rp: 0 });
    expect(await statusPromo(db, hakim(id))).toMatchObject({ terpakaiGiliranHariIni: 0, sisaGiliranHariIni: 3 });
    expect(await jenisMutasi(db, id)).toEqual([]);
  });

  // ── 5. Di luar sasaran / periode ──
  it("peran di luar sasaran dan pengguna di luar periode: persis seperti biasa (saldo habis = ditolak, saldo ada = dipotong)", async () => {
    await promoAtur(PROMO_MENYALA({ semuaPeran: false, peran: ["hakim"] }));
    const id = "u-lw-1";
    const pc = await siapkan(id, 0);
    const tanpa = await giliran(panitera(id), pc);
    expect(tanpa).toEqual([{ jenis: "gagal", pesan: expect.stringMatching(/^Saldo ALETA Ai Anda \(Rp0\) tidak cukup/) }]);
    await isi(db, id, 50_000);
    const bayar = (await giliran(panitera(id), pc)).at(-1) as Extract<EventAi, { jenis: "selesai" }>;
    expect(bayar.biayaRp).toBeGreaterThan(0);
    expect(await jenisMutasi(db, id)).toEqual(["isi:50000", expect.stringMatching(/^tahan:-/), expect.stringMatching(/^lepas:/), `potong:-${bayar.biayaRp}`]);
    expect(await baris(id)).toEqual([]);
    expect(Number((await db.queryOne<{ promo: number }>(`SELECT promo FROM aleta_ai_obrolan_pesan WHERE pemilik_id = ? AND peran = 'ai'`, [id]))?.promo)).toBe(0);

    await promoAtur({ semuaPeran: true, mulai: geser(2), akhir: geser(4) });
    const id2 = "u-lw-2";
    const pc2 = await siapkan(id2, 0);
    expect((await giliran(hakim(id2), pc2))[0]).toMatchObject({ jenis: "gagal", pesan: expect.stringMatching(/^Saldo ALETA Ai Anda/) });
  });

  it("Super Admin tetap gratis seperti dulu: tandai gratis=1, promo=0, tidak tercatat sebagai pemakaian promosi", async () => {
    await promoAtur(PROMO_MENYALA());
    const pc = await siapkan(superAdmin.id, 0);
    expect((await giliran(superAdmin, pc)).at(-1)).toMatchObject({ jenis: "selesai", biayaRp: 0 });
    const p = await db.queryOne<{ promo: number; gratis: number }>(`SELECT promo, gratis FROM aleta_ai_obrolan_pesan WHERE pemilik_id = ? AND peran = 'ai'`, [superAdmin.id]);
    expect({ promo: Number(p?.promo), gratis: Number(p?.gratis) }).toEqual({ promo: 0, gratis: 1 });
    expect(await baris(superAdmin.id)).toEqual([]);
    await db.run(`DELETE FROM aleta_ai_obrolan_pesan WHERE pemilik_id = ?`, [superAdmin.id]);
  });

  // ── 6. Laporan, dompet, struk, ringkasan ──
  it("laporan: giliran/token/biaya API promosi TERPISAH dari giliran gratis Super Admin; CSV dan XLSX ikut", async () => {
    await db.run(`DELETE FROM aleta_ai_obrolan_pesan`);
    await promoAtur(PROMO_MENYALA());
    const a = "u-lap-1";
    await giliran(hakim(a), await siapkan(a, 0, new KlienTiruan([{ penggunaan: { masuk: 1000, keluar: 500 } }])));
    await giliran(hakim(a), await siapkan(a, 0, new KlienTiruan([{ penggunaan: { masuk: 1000, keluar: 500 } }])));
    await giliran(superAdmin, await siapkan(superAdmin.id, 0));
    const lap = await laporanRentang(db);
    expect(lap.ringkasan.promoGiliran).toBe(2);
    expect(lap.ringkasan.promoToken).toBe(3000);
    expect(lap.ringkasan.promoBiayaApiRp).toBeGreaterThan(0);
    expect(lap.ringkasan.gratis).toBe(1); // hanya Super Admin
    expect(lap.promo).toMatchObject({ giliran: 2, token: 3000, pengguna: 1 });
    expect(lap.promo.setaraRp).toBeGreaterThanOrEqual(2000);
    expect(lap.pendapatanRp).toBe(0);
    expect(lap.perPengguna.find((x) => x.penggunaId === a)).toMatchObject({ promoGiliran: 2, promoToken: 3000 });
    expect(lap.perPengguna.find((x) => x.penggunaId === superAdmin.id)).toMatchObject({ promoGiliran: 0, gratis: 1 });
    expect(lap.perBulan[0]?.promoGiliran).toBe(2);
    const csv = laporanKeCsv(lap);
    expect(csv).toMatch(/Giliran promosi,Token promosi,Biaya API promosi \(Rp\)/);
    expect(laporanKeXlsx(lap).length).toBeGreaterThan(1000);
    await db.run(`DELETE FROM aleta_ai_obrolan_pesan WHERE pemilik_id IN (?, ?)`, [a, superAdmin.id]);
  });

  it("dompet dan struk: pita promosi dengan sisa jatah, giliran ditandai promo, struk 'Rp0 (gratis promosi)'; ringkasan layar memuat promo", async () => {
    await promoAtur(PROMO_MENYALA({ judul: "Gratis mencoba ALETA Ai", giliranPerHari: 5, rupiahPeriode: 0, akhir: geser(5) }));
    const id = "u-dmp-1";
    const pc = await siapkan(id, 0);
    await giliran(hakim(id), pc);
    const d = await tampilDompet(db, hakim(id));
    expect(d.promo).toMatchObject({ tampil: true, berlaku: true, judul: "Gratis mencoba ALETA Ai", sisaGiliranHariIni: 4, giliranPerHari: 5 });
    expect(d.promo?.akhirTeks).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
    expect(d.giliran[0]).toMatchObject({ promo: true, gratis: false, biayaRp: 0 });
    const struk = await strukGiliran(db, hakim(id), d.giliran[0]!.pesanId);
    expect(struk).toMatch(/Rp0 \(gratis promosi\)/);
    const r = await ringkasAi(db, hakim(id));
    expect(r.promo).toMatchObject({ tampil: true, berlaku: true });
    expect((await ringkasAi(db, panitera("u-dmp-2"))).promo).toMatchObject({ tampil: true }); // semua pengguna
    await promoAtur({ semuaPeran: false, peran: ["hakim"] });
    expect((await ringkasAi(db, panitera("u-dmp-2"))).promo).toBeUndefined();
    expect((await tampilDompet(db, panitera("u-dmp-2"))).promo).toBeNull();
  });
});

// ─── 7. Rute ─────────────────────────────────────────────────────────────────

describe("rute /api/aleta-ai/promo (hak per peran)", () => {
  let db: AletaDatabase;
  const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(`http://localhost${url}`, init);
  const jawab = async (r: Response) => ({ status: r.status, isi: (await r.json()) as { ok: boolean; data?: Record<string, unknown>; error?: { message: string } } });

  beforeAll(async () => {
    db = await dbBaru();
    ctx.db = db;
    const kini = new Date().toISOString();
    for (const r of ["hakim", "super-admin"]) await db.run(`INSERT INTO roles (id, name, description) VALUES (?, ?, '')`, [r, r]);
    await db.run(`INSERT INTO positions (id, name, unit_kerja, level_hierarchy, created_at, updated_at) VALUES ('pos-uji', 'Uji', 'Uji', 1, ?, ?)`, [kini, kini]);
    for (const [id, peran] of [
      ["u-hakim", "hakim"],
      ["u-sa", "super-admin"],
    ]) {
      await db.run(
        `INSERT INTO users (id, username, password_hash, name, email, whatsapp_number, role_id, position_id, created_at, updated_at) VALUES (?, ?, 'x', ?, ?, '0', ?, 'pos-uji', ?, ?)`,
        [id, id, `Nama ${id}`, `${id}@rekaan.test`, peran, kini, kini]
      );
    }
  }, 180000);

  afterAll(async () => {
    await db?.close();
  });

  it("tanpa sesi 401; hakim: GET hanya status (tanpa pengaturan lengkap), PUT 403 dan pengaturan tidak berubah; Super Admin: GET lengkap, PUT 200", async () => {
    const { GET, PUT } = await import("@/app/api/aleta-ai/promo/route");
    ctx.aktor = null;
    expect((await GET(req("/api/aleta-ai/promo"))).status).toBe(401);

    ctx.aktor = "u-hakim";
    const g = await jawab(await GET(req("/api/aleta-ai/promo")));
    expect(g.status).toBe(200);
    expect(Object.keys(g.isi.data ?? {})).toEqual(["status"]);
    const p = await jawab(await PUT(req("/api/aleta-ai/promo", { method: "PUT", body: JSON.stringify(PROMO_MENYALA()) })));
    expect(p.status).toBe(403);
    expect((await bacaPromo(db)).aktif).toBe(false);

    ctx.aktor = "u-sa";
    const sa = await jawab(await PUT(req("/api/aleta-ai/promo", { method: "PUT", body: JSON.stringify(PROMO_MENYALA({ judul: "Gratis mencoba ALETA Ai" })) })));
    expect(sa.status).toBe(200);
    expect(sa.isi.data).toMatchObject({ konfig: { aktif: true, giliranPerHari: 20 }, status: { tampil: false, alasan: "super-admin" } });
    const salah = await jawab(await PUT(req("/api/aleta-ai/promo", { method: "PUT", body: JSON.stringify({ akhir: "2020-01-01" }) })));
    expect(salah.status).toBe(400);

    ctx.aktor = "u-hakim";
    const lagi = await jawab(await GET(req("/api/aleta-ai/promo")));
    expect(lagi.isi.data?.status).toMatchObject({ tampil: true, berlaku: true, sisaGiliranHariIni: 20 });
    expect(JSON.stringify(lagi.isi)).not.toMatch(/batasSatkerRp|konfig/);
  });
});
