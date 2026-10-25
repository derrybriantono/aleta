// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

import { newDb } from "pg-mem";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KATALOG_FITUR_SATKER, keadaanFitur } from "@/lib/fitur-satker";
import { KODE_FITUR_JEJAK_ISIAN } from "@/lib/jejak-isian";
import {
  AMBANG_NAIK,
  AMBANG_TURUN,
  JENDELA_BULAN,
  KODE_FITUR_KETEPATAN_ISIAN,
  MIN_KEJADIAN,
  asalGerbangDariPengisi,
  bulanMundur,
  jenisKunci,
  kelompokkanKebenaran,
  labelJenis,
  lipatKetepatanBulanan,
  nilaiJendelaKetepatan,
  ringkasBulananSaksi,
  tinjauKetepatan,
  type KejadianIsian,
  type StatusGerbang,
} from "@/lib/ketepatan-isian";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_KETEPATAN_ISIAN } from "@/server/db/schema";
import { catatButirSaksi, catatJejakIsian } from "@/server/modules/aleta-ecourt/jejak-isian";
import {
  bacaMuatanGerbangBot,
  cabutKeputusan,
  hitungDanTinjau,
  ketepatanAktif,
  keputusanBerlaku,
  putuskanUsulan,
  bacaLayarKetepatan,
} from "@/server/modules/aleta-ecourt/ketepatan-isian";
import { KUNCI_FITUR_SATKER } from "@/server/modules/satker/fitur";
import { tulisSetelanSistem } from "@/server/modules/satker/setelan";

/**
 * ============================================================================
 * 25 OKT 2026 - RANTAI D, BUTIR D1: KETEPATAN ISIAN (U3 + U4)
 * ============================================================================
 *
 * pg-mem + rute HTTP sungguhan + gerbang bot sungguhan; data rekaan. Yang dijaga:
 *   1. migrasi 0092 = DDL schema.ts, jurnal idx 83 (tanpa lubang), ikut cadangan; saklar bawaan MATI
 *   2. aturan murni: jendela, ambang 95% dari 30 kejadian, turun < 90%, suntingan atas isian otomatis mengurangi
 *      yang bertahan, jenis perkara dikelompokkan menurut id SIPP
 *   3. saklar mati: tidak satu baris pun ditulis dan tidak ada keputusan yang berlaku
 *   4. KENAIKAN TIDAK PERNAH OTOMATIS: hitung ulang hanya membuat usulan; disetujui hanya lewat Super Admin bernama
 *   5. keputusan -> muatan bot; cabut -> kembali; saklar mati melepas semuanya
 *   6. hak per peran di rute (hanya Super Admin yang memutuskan)
 *   7. gerbang bot: tanpa keputusan = perilaku lama persis; keputusan naik/turun per kode+pengisi+jenis; "pasti" tidak
 *      pernah dihasilkan oleh keputusan lapangan; penanda pengisi bot = penanda yang dicatat ekstensi
 *   8. U4: kebenaran isi saksi per jenis keterangan, katalog, bulan
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
let aktor: string | null = "usr-super";

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => db,
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

const SEKARANG = new Date("2026-10-25T03:00:00.000Z");

async function nyalakan(d: AletaDatabase, kode: string[] = [KODE_FITUR_JEJAK_ISIAN, KODE_FITUR_KETEPATAN_ISIAN]) {
  const fitur: Record<string, string> = {};
  for (const k of kode) fitur[k] = "stabil";
  await tulisSetelanSistem(d, KUNCI_FITUR_SATKER, { fitur, diubahOleh: "uji", diubahPada: new Date().toISOString() }, new Date().toISOString());
}

const GERBANG_TERBACA = { terbaca: true, statik: { "5197": { posita: "saran", sipp: "otomatis" } } };

/** Satu entri jejak isian rekaan; asal "posita-gugatan" = pengisi yang melewati gerbang bot (tingkat posita). */
const isian = (tambah: Record<string, unknown> = {}) => ({
  perkaraId: "10018",
  nomorPerkara: "533/Pdt.G/2026/PA.Dgl",
  jenisPerkara: "Cerai Gugat",
  blangko: "[01] [Kabul Verstek] Cerai (Format Lengkap)",
  jenisBlangko: "put",
  kode: "5197",
  namaVariabel: "Tanggal akta nikah",
  nilaiUsulan: "12 Mei 2015",
  asalUsulan: "posita gugatan",
  nilaiSebelum: "",
  nilaiFinal: "12 Mei 2015",
  cara: "saran-diterima",
  terverifikasi: "ya",
  jalur: "blangko-derry",
  pada: "2026-10-20T03:00:00.000Z",
  ...tambah,
});

/** n entri sama; `disunting` di antaranya disunting petugas (nilai akhir lain). */
function banyak(n: number, disunting = 0, tambah: Record<string, unknown> = {}) {
  return Array.from({ length: n }, (_, i) => (i < disunting ? isian({ perkaraId: `p${i}`, nilaiFinal: "lain", ...tambah }) : isian({ perkaraId: `p${i}`, ...tambah })));
}

async function catatBanyak(d: AletaDatabase, daftar: unknown[]) {
  for (let i = 0; i < daftar.length; i += 50) await catatJejakIsian(d, { id: "usr-super" }, daftar.slice(i, i + 50));
}

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, any>; error?: { message: string } } };
async function panggil(cara: "GET" | "POST", opsi: { query?: string; badan?: unknown } = {}): Promise<Hasil> {
  const modul = await import("@/app/api/aleta-ecourt/ketepatan-isian/route");
  const req = new NextRequest("http://localhost/api/aleta-ecourt/ketepatan-isian" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const jawaban = await (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara](req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

// ─── 1. Migrasi dan saklar ───────────────────────────────────────────────────

describe("migrasi 0092 - berkas = DDL schema.ts, jurnal idx 83, ikut cadangan", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0092_aleta_ketepatan_isian.sql");

  it("jurnal: 0092 sekali di idx 83 tepat sesudah 0091, tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0092_"))).toEqual([expect.objectContaining({ idx: 83, tag: "0092_aleta_ketepatan_isian" })]);
    expect(j.entries[81]?.tag).toBe("0091_aleta_jejak_isian");
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i]?.when).toBeGreaterThan(j.entries[i - 1]?.when ?? 0);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_KETEPATAN_ISIAN, berjalan di pg-mem, kolom bawaan benar; kedua tabel ikut cadangan", () => {
    const isiSql = readFileSync(SQL, "utf8");
    expect(pernyataan(isiSql)).toEqual([...DDL_KETEPATAN_ISIAN.tabel, ...DDL_KETEPATAN_ISIAN.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(isiSql);
    kosong.public.none(`INSERT INTO aleta_ketepatan_keputusan (id, dibuat_at) VALUES ('a', 'x')`);
    expect(kosong.public.one(`SELECT status, berlaku, dapat_diterapkan, diputuskan_oleh FROM aleta_ketepatan_keputusan`)).toEqual({ status: "usulan", berlaku: 0, dapat_diterapkan: 0, diputuskan_oleh: "" });
    for (const t of ["aleta_ketepatan_isian", "aleta_ketepatan_keputusan"]) expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
  });

  it("saklar katalog Fitur Satker: kode ketepatan-isian, bawaan MATI", () => {
    expect(KATALOG_FITUR_SATKER.find((f) => f.kode === KODE_FITUR_KETEPATAN_ISIAN)).toMatchObject({ bawaan: "mati", bagian: "portal" });
    expect(keadaanFitur(KODE_FITUR_KETEPATAN_ISIAN, {})).toMatchObject({ menyala: false, status: "mati" });
    expect(keadaanFitur(KODE_FITUR_KETEPATAN_ISIAN, { pengaturan: { fitur: { [KODE_FITUR_KETEPATAN_ISIAN]: "stabil" }, diubahOleh: "", diubahPada: "" } }).menyala).toBe(true);
  });
});

// ─── 2. Aturan murni ─────────────────────────────────────────────────────────

describe("aturan murni ketepatan isian", () => {
  const kej = (tambah: Partial<KejadianIsian>): KejadianIsian => ({ kode: "5197", pengisi: "posita-gugatan", jenis: "Cerai Gugat", pada: "2026-10-20T00:00:00.000Z", hasil: "diterima", cara: "saran-diterima", n: 1, ...tambah });

  it("ambang tertulis: 95% dari 30 kejadian untuk naik, di bawah 90% untuk turun, jendela 6 bulan", () => {
    expect([MIN_KEJADIAN, AMBANG_NAIK, AMBANG_TURUN, JENDELA_BULAN]).toEqual([30, 0.95, 0.9, 6]);
  });

  it("jenis perkara dikelompokkan menurut id SIPP (nama, id, atau alur)", () => {
    expect(jenisKunci("Cerai Gugat")).toBe("347");
    expect(jenisKunci("  cerai   TALAK ")).toBe("346");
    expect(jenisKunci("347")).toBe("347");
    expect(jenisKunci("alur:Pdt.P")).toBe("alur:Pdt.P");
    expect(jenisKunci("")).toBe("(tanpa)");
    expect(jenisKunci("Jenis Baru")).toBe("jenis baru");
    expect(labelJenis("347")).toBe("Cerai Gugat");
    expect(labelJenis("alur:Pdt.P")).toBe("Alur Pdt.P");
  });

  it("pengisi -> tingkat sumber gerbang; yang tak melewati gerbang null", () => {
    expect(asalGerbangDariPengisi("posita-gugatan")).toBe("posita");
    expect(asalGerbangDariPengisi("keterangan-saksi")).toBe("posita");
    expect(asalGerbangDariPengisi("berkas-ktp-e-court")).toBe("berkas");
    expect(asalGerbangDariPengisi("data-pernikahan-di-sipp")).toBe("sipp");
    expect(asalGerbangDariPengisi("sipp")).toBe("sipp");
    expect(asalGerbangDariPengisi("bawaan-abt")).toBeNull();
    expect(asalGerbangDariPengisi("")).toBeNull();
  });

  it("lipat bulanan: diterima+otomatis+saran disunting = usulan; suntingan atas isian otomatis mengurangi yang bertahan, bukan menambah usulan", () => {
    const baris = lipatKetepatanBulanan([
      kej({ hasil: "diterima", n: 8 }),
      kej({ hasil: "otomatis", cara: "otomatis", n: 10 }),
      kej({ hasil: "disunting", cara: "diubah", n: 2 }),
      kej({ hasil: "disunting", cara: "diubah-otomatis", n: 3 }),
      kej({ hasil: "diketik", cara: "diketik", n: 5 }),
      kej({ hasil: "diurungkan", cara: "diurungkan", n: 9 }),
    ]);
    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatchObject({ jenis: "347", bulan: "2026-10", usulan: 20, diterima: 18, diubah: 5, diubahOtomatis: 3, diketik: 5, bertahan: 15, presisi: 0.75 });
  });

  it("presisi jendela menjumlahkan bulan; suntingan bulan berikutnya atas isian otomatis bulan lalu tetap mengurangi", () => {
    const baris = lipatKetepatanBulanan([
      kej({ pada: "2026-09-10T00:00:00.000Z", hasil: "otomatis", cara: "otomatis", n: 40 }),
      kej({ pada: "2026-10-10T00:00:00.000Z", hasil: "disunting", cara: "diubah-otomatis", n: 8 }),
    ]);
    const w = nilaiJendelaKetepatan(baris, "2026-10")[0];
    expect(w).toMatchObject({ usulan: 40, bertahan: 32, presisi: 0.8, bulanAwal: "2026-09", bulanAkhir: "2026-10" });
    // di luar jendela tidak dihitung
    expect(nilaiJendelaKetepatan(baris, "2027-06")).toEqual([]);
    expect(bulanMundur("2026-02", 3)).toBe("2025-11");
  });

  const statusSaran = (): StatusGerbang => "saran";
  const statusOto = (): StatusGerbang => "otomatis";

  it("naik: tepat 30 kejadian dengan presisi 95%+ diusulkan; 29 kejadian atau 94% tidak", () => {
    const tinjau = (n: number, salah: number, status = statusSaran) =>
      tinjauKetepatan({
        baris: lipatKetepatanBulanan([kej({ n: n - salah }), kej({ hasil: "disunting", cara: "diubah", n: salah })]),
        sampaiBulan: "2026-10",
        statusSekarang: status,
      });
    // 30 kejadian, 1 disunting = 96,7%
    expect(tinjau(30, 1)).toEqual([expect.objectContaining({ arah: "naik", keStatus: "otomatis", n: 30, presisi: 0.967, dariStatus: "saran", dapatDiterapkan: true })]);
    // 29 kejadian cukup tepat, tetapi kurang dari minimal
    expect(tinjau(29, 0)).toEqual([]);
    // 100 kejadian, 6 salah = 94% < 95%
    expect(tinjau(100, 6)).toEqual([]);
    // 100 kejadian, 5 salah = 95% tepat -> naik (batas termasuk)
    expect(tinjau(100, 5)).toHaveLength(1);
    // sudah terisi sendiri dan tepat: tidak ada yang diusulkan
    expect(tinjau(100, 1, statusOto)).toEqual([]);
  });

  it("turun: isian yang terisi sendiri dengan presisi < 90% dari 30+ kejadian; 90% tepat tidak", () => {
    const tinjau = (n: number, salah: number) =>
      tinjauKetepatan({
        baris: lipatKetepatanBulanan([kej({ hasil: "otomatis", cara: "otomatis", n }), kej({ hasil: "disunting", cara: "diubah-otomatis", n: salah })]),
        sampaiBulan: "2026-10",
        statusSekarang: statusOto,
      });
    expect(tinjau(100, 11)).toEqual([expect.objectContaining({ arah: "turun", keStatus: "saran", dariStatus: "otomatis", presisi: 0.89 })]);
    expect(tinjau(100, 10)).toEqual([]);
    expect(tinjau(20, 15)).toEqual([]); // kurang dari 30 kejadian
  });

  it("pengisi tanpa nama atau yang tak melewati gerbang tidak pernah diusulkan", () => {
    const baris = lipatKetepatanBulanan([kej({ pengisi: "bawaan-abt", n: 100 }), kej({ pengisi: "", n: 100 })]);
    expect(tinjauKetepatan({ baris, sampaiBulan: "2026-10", statusSekarang: statusSaran })).toEqual([]);
  });

  it("murni: meninjau tidak pernah menghasilkan keputusan 'disetujui' (tidak ada ruas itu)", () => {
    const u = tinjauKetepatan({ baris: lipatKetepatanBulanan([kej({ n: 60 })]), sampaiBulan: "2026-10", statusSekarang: statusSaran });
    expect(u).toHaveLength(1);
    expect(JSON.stringify(u)).not.toMatch(/disetujui/);
  });

  it("U4 kebenaran saksi: diterima benar; disunting benar hanya bila tetap mirip; dibuang meleset; diketik tak ikut", () => {
    const b = (hasil: string, kemiripan: number, jenisKeterangan = "melihat", pada = "2026-10-20T00:00:00.000Z") => ({ jenisKeterangan, katalog: "cerai-gugat", pada, hasil, kemiripan });
    const k = kelompokkanKebenaran([b("diterima", 1), b("disunting", 0.95), b("disunting", 0.5), b("dibuang", 0), b("diketik", 0)], (x) => x.jenisKeterangan);
    expect(k).toEqual([expect.objectContaining({ kunci: "melihat", jumlah: 5, berusulan: 4, diterima: 1, disunting: 2, dibuang: 1, diketik: 1, benar: 2, persenBenar: 50, rataKemiripan: 0.613 })]);
    const bulan = ringkasBulananSaksi([b("diterima", 1, "melihat", "2026-09-02T00:00:00.000Z"), b("disunting", 0.4, "melihat", "2026-10-02T00:00:00.000Z")]);
    expect(bulan.map((x) => [x.bulan, x.persenBenar])).toEqual([
      ["2026-10", 0],
      ["2026-09", 100],
    ]);
  });
});

// ─── 3-5. Penyimpanan dan persetujuan ───────────────────────────────────────

describe("penyimpanan dan persetujuan (pg-mem)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db?.close();
    db = null;
  });

  it("saklar mati: tidak menghitung, tidak menulis, tidak ada keputusan yang berlaku, muatan bot kosong", async () => {
    expect(await ketepatanAktif(db!)).toBe(false);
    // jejak menyala, ketepatan mati
    await nyalakan(db!, [KODE_FITUR_JEJAK_ISIAN]);
    await catatBanyak(db!, banyak(40));
    const h = await hitungDanTinjau(db!, { sekarang: SEKARANG, gerbang: GERBANG_TERBACA });
    expect(h).toMatchObject({ aktif: false, baris: 0, usulanBaru: 0 });
    expect(await db!.queryAll(`SELECT id FROM aleta_ketepatan_isian`)).toEqual([]);
    expect(await db!.queryAll(`SELECT id FROM aleta_ketepatan_keputusan`)).toEqual([]);
    expect(await bacaMuatanGerbangBot(db!)).toEqual({ aktif: false, versi: "", entri: [] });
    expect((await bacaLayarKetepatan(db!, { sekarang: SEKARANG })).aktif).toBe(false);
  });

  it("menghitung dari jejak: angka bulanan benar dan usulan naik dibuat; TIDAK ada yang disetujui otomatis", async () => {
    await nyalakan(db!);
    await catatBanyak(db!, banyak(40, 1)); // 40 kejadian, 1 disunting = 97,5%
    const h = await hitungDanTinjau(db!, { sekarang: SEKARANG, gerbang: GERBANG_TERBACA });
    expect(h).toMatchObject({ aktif: true, baris: 1, usulanBaru: 1, kedaluwarsa: 0, gerbangTerbaca: true });
    const bulanan = await db!.queryAll<Record<string, unknown>>(`SELECT * FROM aleta_ketepatan_isian`);
    expect(bulanan).toHaveLength(1);
    expect(bulanan[0]).toMatchObject({ kode: "5197", pengisi: "posita-gugatan", jenis_perkara: "347", bulan: "2026-10", usulan: 40, diterima: 39, diubah: 1, bertahan: 39 });
    const k = await db!.queryAll<Record<string, unknown>>(`SELECT * FROM aleta_ketepatan_keputusan`);
    expect(k).toHaveLength(1);
    expect(k[0]).toMatchObject({ status: "usulan", arah: "naik", ke_status: "otomatis", dari_status: "saran", berlaku: 0, dapat_diterapkan: 1, diputuskan_oleh: "" });
    // hitung ulang berkali-kali tidak menggandakan dan tidak menyetujui
    await hitungDanTinjau(db!, { sekarang: SEKARANG, gerbang: GERBANG_TERBACA });
    await hitungDanTinjau(db!, { sekarang: SEKARANG, gerbang: GERBANG_TERBACA });
    expect(await db!.queryAll(`SELECT id FROM aleta_ketepatan_keputusan`)).toHaveLength(1);
    expect(await db!.queryAll(`SELECT id FROM aleta_ketepatan_keputusan WHERE status = 'disetujui' OR berlaku = 1`)).toEqual([]);
    expect(await keputusanBerlaku(db!)).toEqual([]);
    expect((await bacaMuatanGerbangBot(db!)).entri).toEqual([]);
  });

  it("di bawah ambang tidak ada usulan: 29 kejadian, atau 94% dari 100", async () => {
    await nyalakan(db!);
    await catatBanyak(db!, banyak(29));
    await hitungDanTinjau(db!, { sekarang: SEKARANG, gerbang: GERBANG_TERBACA });
    expect(await db!.queryAll(`SELECT id FROM aleta_ketepatan_keputusan`)).toEqual([]);
    await db!.run(`DELETE FROM aleta_isian_jejak`);
    await catatBanyak(db!, banyak(100, 6));
    await hitungDanTinjau(db!, { sekarang: SEKARANG, gerbang: GERBANG_TERBACA });
    expect(await db!.queryAll(`SELECT id FROM aleta_ketepatan_keputusan`)).toEqual([]);
  });

  it("jenis perkara terpisah: cerai gugat 40 tepat, cerai talak hanya 10 -> hanya yang pertama diusulkan", async () => {
    await nyalakan(db!);
    await catatBanyak(db!, [...banyak(40), ...banyak(10, 0, { jenisPerkara: "Cerai Talak" })]);
    await hitungDanTinjau(db!, { sekarang: SEKARANG, gerbang: GERBANG_TERBACA });
    const k = await db!.queryAll<Record<string, unknown>>(`SELECT jenis_perkara FROM aleta_ketepatan_keputusan`);
    expect(k.map((x) => x.jenis_perkara)).toEqual(["347"]);
  });

  it("setujui: hanya aktor bernama; keputusan berlaku masuk muatan bot (paling tinggi cukup); audit tercatat; cabut mengembalikan", async () => {
    await nyalakan(db!);
    await catatBanyak(db!, banyak(40, 1));
    await hitungDanTinjau(db!, { sekarang: SEKARANG, gerbang: GERBANG_TERBACA });
    const id = String((await db!.queryOne<Record<string, unknown>>(`SELECT id FROM aleta_ketepatan_keputusan`))!.id);
    await expect(putuskanUsulan(db!, { id: "" }, id, "setujui")).rejects.toThrow(/atas nama/);
    expect(await keputusanBerlaku(db!)).toEqual([]);

    const sesudah = await putuskanUsulan(db!, { id: "usr-super", name: "Super Admin" }, id, "setujui", "ukuran Oktober");
    expect(sesudah).toMatchObject({ status: "disetujui", berlaku: true, diputuskanOleh: "usr-super", diputuskanNama: "Super Admin", catatan: "ukuran Oktober" });
    const muatan = await bacaMuatanGerbangBot(db!);
    expect(muatan.aktif).toBe(true);
    expect(muatan.entri).toEqual([{ kode: "5197", pengisi: "posita-gugatan", jenis: "347", status: "otomatis", pangkatMaks: "cukup", n: 40, presisi: 0.975 }]);
    const audit = await db!.queryAll<Record<string, unknown>>(`SELECT action, actor_user_id FROM audit_logs WHERE action = 'KETEPATAN_ISIAN_SETUJUI'`);
    expect(audit).toHaveLength(1);
    // usulan yang sudah diputuskan tidak dapat diputuskan lagi
    await expect(putuskanUsulan(db!, { id: "usr-super" }, id, "tolak")).rejects.toThrow(/sudah diputuskan/);

    const dicabut = await cabutKeputusan(db!, { id: "usr-super" }, id);
    expect(dicabut).toMatchObject({ status: "dicabut", berlaku: false });
    expect((await bacaMuatanGerbangBot(db!)).entri).toEqual([]);
    await expect(cabutKeputusan(db!, { id: "usr-super" }, id)).rejects.toThrow(/tidak sedang berlaku/);
  });

  it("tolak: tidak berlaku dan tidak masuk muatan bot", async () => {
    await nyalakan(db!);
    await catatBanyak(db!, banyak(40));
    await hitungDanTinjau(db!, { sekarang: SEKARANG, gerbang: GERBANG_TERBACA });
    const id = String((await db!.queryOne<Record<string, unknown>>(`SELECT id FROM aleta_ketepatan_keputusan`))!.id);
    const r = await putuskanUsulan(db!, { id: "usr-super", name: "Super Admin" }, id, "tolak");
    expect(r).toMatchObject({ status: "ditolak", berlaku: false });
    expect((await bacaMuatanGerbangBot(db!)).entri).toEqual([]);
  });

  it("usulan yang tak lagi memenuhi syarat menjadi kedaluwarsa; usulan turun muncul untuk isian yang sudah naik", async () => {
    await nyalakan(db!);
    await catatBanyak(db!, banyak(40));
    await hitungDanTinjau(db!, { sekarang: SEKARANG, gerbang: GERBANG_TERBACA });
    // data memburuk: 30 isian lain disunting -> presisi 40/70 < 95%
    await catatBanyak(db!, banyak(30, 30, { perkaraId: "x" }));
    const h = await hitungDanTinjau(db!, { sekarang: SEKARANG, gerbang: GERBANG_TERBACA });
    expect(h.kedaluwarsa).toBe(1);
    expect((await db!.queryOne<Record<string, unknown>>(`SELECT status FROM aleta_ketepatan_keputusan`))!.status).toBe("kedaluwarsa");
  });

  it("isian yang sudah naik (disetujui) dan kemudian anjlok -> usulan TURUN, menunggu keputusan Super Admin", async () => {
    await nyalakan(db!);
    await catatBanyak(db!, banyak(40));
    await hitungDanTinjau(db!, { sekarang: SEKARANG, gerbang: GERBANG_TERBACA });
    const naik = String((await db!.queryOne<Record<string, unknown>>(`SELECT id FROM aleta_ketepatan_keputusan`))!.id);
    await putuskanUsulan(db!, { id: "usr-super", name: "Super Admin" }, naik, "setujui");
    // sesudah naik, ALETA menulis sendiri 40 kali dan petugas menyunting 12 di antaranya
    await catatBanyak(db!, [
      ...Array.from({ length: 40 }, (_, i) => isian({ perkaraId: `o${i}`, cara: "otomatis", nilaiFinal: "12 Mei 2015" })),
      ...Array.from({ length: 12 }, (_, i) => isian({ perkaraId: `o${i}`, cara: "diubah-otomatis", nilaiFinal: "lain" })),
    ]);
    const h = await hitungDanTinjau(db!, { sekarang: SEKARANG, gerbang: GERBANG_TERBACA });
    expect(h.usulanBaru).toBe(1);
    const turun = await db!.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_ketepatan_keputusan WHERE arah = 'turun'`);
    expect(turun).toMatchObject({ status: "usulan", ke_status: "saran", dari_status: "otomatis", berlaku: 0 });
    // keputusan naik tetap berlaku sampai turun disetujui
    expect((await bacaMuatanGerbangBot(db!)).entri[0]).toMatchObject({ status: "otomatis" });
    await putuskanUsulan(db!, { id: "usr-super", name: "Super Admin" }, String(turun!.id), "setujui");
    const muatan = await bacaMuatanGerbangBot(db!);
    expect(muatan.entri).toHaveLength(1);
    expect(muatan.entri[0]).toMatchObject({ status: "saran", pangkatMaks: "ragu" });
  });

  it("saklar dimatikan kembali: keputusan tersimpan tetapi tidak ada yang berlaku dan muatan bot kosong", async () => {
    await nyalakan(db!);
    await catatBanyak(db!, banyak(40));
    await hitungDanTinjau(db!, { sekarang: SEKARANG, gerbang: GERBANG_TERBACA });
    const id = String((await db!.queryOne<Record<string, unknown>>(`SELECT id FROM aleta_ketepatan_keputusan`))!.id);
    await putuskanUsulan(db!, { id: "usr-super", name: "Super Admin" }, id, "setujui");
    expect((await bacaMuatanGerbangBot(db!)).entri).toHaveLength(1);
    await nyalakan(db!, [KODE_FITUR_JEJAK_ISIAN]);
    expect(await bacaMuatanGerbangBot(db!)).toEqual({ aktif: false, versi: "", entri: [] });
    expect(await keputusanBerlaku(db!)).toEqual([]);
    await expect(putuskanUsulan(db!, { id: "usr-super" }, id, "tolak")).rejects.toThrow(/mati/);
  });

  it("bot tak terjangkau: usulan naik tetap dibuat dengan status 'belum diketahui'; usulan turun tidak", async () => {
    await nyalakan(db!);
    await catatBanyak(db!, banyak(40));
    await hitungDanTinjau(db!, { sekarang: SEKARANG, gerbang: { terbaca: false, statik: {} } });
    expect((await db!.queryOne<Record<string, unknown>>(`SELECT dari_status FROM aleta_ketepatan_keputusan`))!.dari_status).toBe("belum-diketahui");
  });

  it("layar: menghitung ulang bila belum pernah; angka per isian dan kebenaran saksi ikut", async () => {
    await nyalakan(db!);
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 503 }));
    await catatBanyak(db!, banyak(40, 1));
    await catatButirSaksi(db!, { id: "usr-super" }, [
      { perkaraId: "10018", jalur: "katalog", katalog: "cerai-gugat", jenisKeterangan: "melihat", usulan: "Kenal.", teksFinal: "Kenal.", pada: "2026-10-20T03:00:00.000Z" },
      { perkaraId: "10019", jalur: "katalog", katalog: "cerai-gugat", jenisKeterangan: "melihat", usulan: "Kenal baik sekali dengan Penggugat.", teksFinal: "Tidak tahu.", pada: "2026-10-21T03:00:00.000Z" },
    ]);
    const l = await bacaLayarKetepatan(db!, { sekarang: SEKARANG });
    expect(l.aktif).toBe(true);
    expect(l.dihitungAt).not.toBe("");
    expect(l.perIsian[0]).toMatchObject({ kode: "5197", usulan: 40, bertahan: 39, presisi: 0.975 });
    expect(l.usulan).toHaveLength(1);
    expect(l.kebenaranSaksi).toMatchObject({ jumlah: 2, persenBenar: 50 });
    expect(l.kebenaranSaksi.perJenisKeterangan[0]).toMatchObject({ kunci: "melihat", jumlah: 2, benar: 1 });
    expect(l.kebenaranSaksi.perBulan[0]?.bulan).toBe("2026-10");
  });
});

// ─── 6. Rute dan hak per peran ──────────────────────────────────────────────

describe("rute ketepatan-isian", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    vi.stubGlobal("fetch", async (_u: unknown, init?: { method?: string }) => new Response(JSON.stringify({ ok: true, statik: GERBANG_TERBACA.statik, init: init?.method }), { status: 200 }));
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db?.close();
    db = null;
  });

  it("saklar mati: GET saklar -> aktif:false; layar -> aktif:false; POST hitung tidak menulis; setujui ditolak", async () => {
    expect((await panggil("GET", { query: "bagian=saklar" })).isi.data).toEqual({ aktif: false });
    expect((await panggil("GET")).isi.data).toMatchObject({ aktif: false, usulan: [], berlaku: [] });
    expect((await panggil("POST", { badan: { aksi: "hitung" } })).isi.data.hitung).toMatchObject({ aktif: false, baris: 0 });
    const s = await panggil("POST", { badan: { aksi: "setujui", id: "tidak-ada" } });
    expect(s.status).toBeGreaterThanOrEqual(400);
    expect(await db!.queryAll(`SELECT id FROM aleta_ketepatan_isian`)).toEqual([]);
  });

  it("alur penuh lewat rute: hitung -> setujui oleh Super Admin -> bot menerima muatan -> cabut", async () => {
    await nyalakan(db!);
    await catatBanyak(db!, banyak(40, 1));
    const dikirim: Array<{ url: string; badan: any }> = [];
    vi.stubGlobal("fetch", async (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        dikirim.push({ url, badan: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, statik: GERBANG_TERBACA.statik }), { status: 200 });
    });
    const h = await panggil("POST", { badan: { aksi: "hitung" } });
    expect(h.isi.data.layar.usulan).toHaveLength(1);
    const id = h.isi.data.layar.usulan[0].id as string;

    const s = await panggil("POST", { badan: { aksi: "setujui", id, catatan: "ukuran Oktober" } });
    expect(s.status).toBe(200);
    expect(s.isi.data.keputusan).toMatchObject({ status: "disetujui", berlaku: true });
    expect(s.isi.data.bot).toMatchObject({ terkirim: true });
    expect(dikirim.at(-1)!.url).toMatch(/\/internal\/aleta-bot\/gerbang-isian\/sinkron$/);
    expect(dikirim.at(-1)!.badan).toMatchObject({ aktif: true, entri: [{ kode: "5197", pengisi: "posita-gugatan", jenis: "347", status: "otomatis" }] });

    const c = await panggil("POST", { badan: { aksi: "cabut", id } });
    expect(c.isi.data.keputusan).toMatchObject({ status: "dicabut", berlaku: false });
    expect(dikirim.at(-1)!.badan).toMatchObject({ aktif: true, entri: [] });
  });

  it("bot tak terjangkau tidak menggagalkan keputusan", async () => {
    await nyalakan(db!);
    await catatBanyak(db!, banyak(40));
    const h = await panggil("POST", { badan: { aksi: "hitung" } });
    const id = h.isi.data.layar.usulan[0].id as string;
    vi.stubGlobal("fetch", async () => {
      throw new Error("jaringan putus");
    });
    const s = await panggil("POST", { badan: { aksi: "setujui", id } });
    expect(s.status).toBe(200);
    expect(s.isi.data.keputusan.status).toBe("disetujui");
    expect(s.isi.data.bot.terkirim).toBe(false);
  });

  it("hak per peran: Admin boleh melihat dan menghitung, TIDAK boleh memutuskan; hakim tidak boleh apa pun selain bertanya saklar", async () => {
    await nyalakan(db!);
    await catatBanyak(db!, banyak(40));
    const h = await panggil("POST", { badan: { aksi: "hitung" } });
    const id = h.isi.data.layar.usulan[0].id as string;

    aktor = "usr-admin";
    expect((await panggil("GET")).status).toBe(200);
    expect((await panggil("POST", { badan: { aksi: "hitung" } })).status).toBe(200);
    const s = await panggil("POST", { badan: { aksi: "setujui", id } });
    expect(s.status).toBe(403);
    expect((await panggil("POST", { badan: { aksi: "tolak", id } })).status).toBe(403);
    expect((await panggil("POST", { badan: { aksi: "cabut", id } })).status).toBe(403);
    expect(await keputusanBerlaku(db!)).toEqual([]);

    aktor = "usr-hakim";
    expect((await panggil("GET")).status).toBe(403);
    expect((await panggil("POST", { badan: { aksi: "hitung" } })).status).toBe(403);
    expect((await panggil("GET", { query: "bagian=saklar" })).status).toBe(200);

    aktor = null;
    expect((await panggil("GET")).status).toBe(401);
    expect((await panggil("POST", { badan: { aksi: "setujui", id } })).status).toBe(401);
    expect(await db!.queryAll(`SELECT id FROM aleta_ketepatan_keputusan WHERE status = 'disetujui'`)).toEqual([]);
  });

  it("tindakan tak dikenal dan usulan tak ditunjuk ditolak", async () => {
    await nyalakan(db!);
    expect((await panggil("POST", { badan: { aksi: "ngawur" } })).status).toBe(400);
    expect((await panggil("POST", { badan: { aksi: "setujui" } })).status).toBe(400);
  });
});

// ─── 7. Gerbang bot ─────────────────────────────────────────────────────────

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
type GerbangBotModul = {
  terapkan: (u: any[], o?: any) => any[];
  putuskan: (u: any, g?: any, o?: any) => any;
  pengisiDari: (u: any) => string;
  jenisKunci: (x: unknown) => string;
  terimaDisetujui: (m: unknown) => any;
  bacaDisetujui: () => any;
  statusStatik: () => Record<string, Record<string, string>>;
  aturBerkasDisetujuiUji: (l?: string) => void;
};
const G = require_(path.join(AKAR, "aleta_bot", "services", "gerbangIsian.js")) as GerbangBotModul;

const GERBANG_UJI = {
  kode: {
    "5197": { asal: { posita: { n: 500, banding: 400, cocok: 200, persen: 50, status: "saran", pangkatMaks: "ragu" }, sipp: { n: 300, banding: 30, cocok: 30, persen: 100, status: "otomatis", pangkatMaks: "pasti" } } },
  },
};
const usulanBot = (y: string, asal = "posita-gugatan", kode = "5197") => ({ kode, nama: "x", nilai: "v", keyakinan: y, sumber: [{ saksi: 0, asal, kalimat: "k" }], catatan: "" });

describe("gerbang bot dengan keputusan lapangan", () => {
  const berkas = path.join(os.tmpdir(), `gerbang-disetujui-${process.pid}.json`);
  beforeEach(() => G.aturBerkasDisetujuiUji(berkas));
  afterEach(() => G.aturBerkasDisetujuiUji());

  const kirim = (entri: unknown[], aktif = true) => G.terimaDisetujui({ aktif, versi: "v1", entri });

  it("tanpa keputusan (belum pernah menerima): perilaku lama persis - saran tetap ragu, otomatis tetap, pasti tetap", () => {
    expect(G.bacaDisetujui()).toMatchObject({ aktif: false, jumlah: 0 });
    const [a] = G.terapkan([usulanBot("pasti")], { gerbang: GERBANG_UJI });
    expect(a.keyakinan).toBe("ragu");
    expect(a.gerbang.status).toBe("saran");
    const [b] = G.terapkan([usulanBot("pasti", "sipp")], { gerbang: GERBANG_UJI });
    expect(b.keyakinan).toBe("pasti");
    expect(b.gerbang.status).toBe("otomatis");
  });

  it("naik disetujui: isian saran menjadi terisi sendiri, paling tinggi CUKUP; kalimat ketepatan lapangan di catatan", () => {
    kirim([{ kode: "5197", pengisi: "posita-gugatan", jenis: "347", status: "otomatis", n: 40, presisi: 0.975 }]);
    const [pasti] = G.terapkan([usulanBot("pasti")], { gerbang: GERBANG_UJI, jenis: "347" });
    expect(pasti.keyakinan).toBe("cukup");
    expect(pasti.keyakinanSemula).toBe("pasti");
    expect(pasti.gerbang).toMatchObject({ status: "lapangan-otomatis", diturunkan: true, n: 40, persen: 97.5 });
    expect(pasti.catatan).toMatch(/97,?5?% usulan ini bertahan|97\.5% usulan ini bertahan/);
    const [cukup] = G.terapkan([usulanBot("cukup")], { gerbang: GERBANG_UJI, jenis: "347" });
    expect(cukup.keyakinan).toBe("cukup");
    expect(cukup.gerbang.diturunkan).toBe(false);
    // keyakinan "ragu" dari bot sendiri tidak pernah dinaikkan oleh keputusan lapangan
    const [ragu] = G.terapkan([usulanBot("ragu")], { gerbang: GERBANG_UJI, jenis: "347" });
    expect(ragu.keyakinan).toBe("ragu");
  });

  it("keputusan per jenis perkara: jenis lain tetap memakai berkas JSON; keputusan tanpa jenis berlaku untuk semua", () => {
    kirim([{ kode: "5197", pengisi: "posita-gugatan", jenis: "347", status: "otomatis", n: 40, presisi: 0.975 }]);
    expect(G.terapkan([usulanBot("cukup")], { gerbang: GERBANG_UJI, jenis: "346" })[0].keyakinan).toBe("ragu");
    expect(G.terapkan([usulanBot("cukup")], { gerbang: GERBANG_UJI })[0].keyakinan).toBe("ragu");
    kirim([{ kode: "5197", pengisi: "posita-gugatan", jenis: "", status: "otomatis", n: 40, presisi: 0.97 }]);
    expect(G.terapkan([usulanBot("cukup")], { gerbang: GERBANG_UJI, jenis: "346" })[0].keyakinan).toBe("cukup");
    expect(G.terapkan([usulanBot("cukup")], { gerbang: GERBANG_UJI })[0].keyakinan).toBe("cukup");
  });

  it("pengisi lain tidak ikut: keputusan posita-gugatan tidak mengubah usulan dari berkas KTP e-Court atau SIPP", () => {
    kirim([{ kode: "5197", pengisi: "posita-gugatan", jenis: "", status: "otomatis", n: 40, presisi: 0.97 }]);
    expect(G.terapkan([usulanBot("cukup", "ktp-ecourt")], { gerbang: GERBANG_UJI })[0].keyakinan).toBe("ragu"); // tanpa ukuran di GERBANG_UJI
    expect(G.terapkan([usulanBot("pasti", "sipp")], { gerbang: GERBANG_UJI })[0].keyakinan).toBe("pasti");
  });

  it("turun disetujui: isian yang otomatis menjadi saran ragu", () => {
    kirim([{ kode: "5197", pengisi: "sipp", jenis: "", status: "saran", n: 60, presisi: 0.8 }]);
    const [r] = G.terapkan([usulanBot("pasti", "sipp")], { gerbang: GERBANG_UJI });
    expect(r.keyakinan).toBe("ragu");
    expect(r.gerbang.status).toBe("lapangan-saran");
    expect(r.catatan).toMatch(/hanya saran - periksa/);
  });

  it("aktif:false atau muatan kosong melepas semuanya; muatan tak sah ditolak", () => {
    kirim([{ kode: "5197", pengisi: "posita-gugatan", jenis: "", status: "otomatis", n: 40, presisi: 0.97 }]);
    expect(G.terapkan([usulanBot("cukup")], { gerbang: GERBANG_UJI })[0].keyakinan).toBe("cukup");
    kirim([{ kode: "5197", pengisi: "posita-gugatan", jenis: "", status: "otomatis", n: 40, presisi: 0.97 }], false);
    expect(G.terapkan([usulanBot("cukup")], { gerbang: GERBANG_UJI })[0].keyakinan).toBe("ragu");
    kirim([{ kode: "5197", pengisi: "posita-gugatan", jenis: "", status: "otomatis", n: 40, presisi: 0.97 }]);
    kirim([]);
    expect(G.terapkan([usulanBot("cukup")], { gerbang: GERBANG_UJI })[0].keyakinan).toBe("ragu");
    expect(() => G.terimaDisetujui(null)).toThrow(/tidak sah/);
    // entri dengan status ngawur diabaikan
    kirim([{ kode: "5197", pengisi: "posita-gugatan", jenis: "", status: "pasti", n: 40, presisi: 0.97 }]);
    expect(G.bacaDisetujui().jumlah).toBe(0);
  });

  it("keputusan lapangan tidak pernah menghasilkan 'pasti', walau ukuran 100%", () => {
    kirim([{ kode: "5197", pengisi: "posita-gugatan", jenis: "", status: "otomatis", n: 500, presisi: 1 }]);
    for (const asal of ["posita-gugatan", "posita"]) expect(G.terapkan([usulanBot("pasti", asal)], { gerbang: GERBANG_UJI })[0].keyakinan).not.toBe("pasti");
  });

  it("tersimpan di berkas dan dibaca lagi sesudah bot dimulai ulang", async () => {
    kirim([{ kode: "5197", pengisi: "posita-gugatan", jenis: "347", status: "otomatis", n: 40, presisi: 0.975 }]);
    expect(existsSync(berkas)).toBe(true);
    G.aturBerkasDisetujuiUji(berkas); // bot dimulai ulang: ingatan kosong, berkas tetap
    expect(G.bacaDisetujui()).toMatchObject({ aktif: true, jumlah: 1 });
    expect(G.terapkan([usulanBot("pasti")], { gerbang: GERBANG_UJI, jenis: "347" })[0].keyakinan).toBe("cukup");
  });

  it("status bawaan berkas JSON terbaca untuk layar portal", () => {
    const s = G.statusStatik();
    expect(Object.keys(s).length).toBeGreaterThan(10);
    expect(s["1001"]).toMatchObject({ posita: "otomatis" });
  });

  it("pengisiDari di bot = penanda yang dicatat ekstensi (isi-sipp-bersama.js asalUsulan + penandaAsal)", () => {
    const konteks: Record<string, any> = {};
    vm.runInNewContext(readFileSync(path.join(AKAR, "ekstensi-sipp", "isi-sipp-bersama.js"), "utf8"), konteks);
    const jejakSrc = readFileSync(path.join(AKAR, "ekstensi-sipp", "jejak-isian.js"), "utf8");
    const konteksJ: Record<string, any> = {};
    vm.runInNewContext(jejakSrc, konteksJ);
    const penandaAsal = konteksJ.AletaJejakIsian?.penandaAsal as (x: string) => string;
    const asalUsulan = konteks.AletaIsiSipp?.asalUsulan as (u: unknown) => string;
    expect(typeof asalUsulan).toBe("function");
    expect(typeof penandaAsal).toBe("function");
    const contoh = [
      { sumber: [{ asal: "ktp-ecourt" }] },
      { sumber: [{ asal: "gugatan-ecourt" }] },
      { sumber: [{ asal: "elitigasi" }] },
      { sumber: [{ asal: "data-nikah" }] },
      { sumber: [{ asal: "posita-gugatan" }] },
      { sumber: [{ asal: "bukti-akta" }] },
      { sumber: [{ asal: "sipp", saksi: 1 }] },
      { sumber: [{ asal: "posita" }, { asal: "posita" }] },
      { sumber: [{ asal: "sipp" }] },
      { sumber: [] },
      {},
    ];
    for (const u of contoh) expect(G.pengisiDari(u)).toBe(penandaAsal(asalUsulan(u)));
    // dan setiap pengisi yang dikenal portal adalah salah satu dari penanda tersebut
    const semua = new Set(contoh.map((u) => G.pengisiDari(u)));
    for (const p of semua) expect(asalGerbangDariPengisi(p), p).not.toBeNull();
  });

  it("kunci jenis bot = kunci jenis portal untuk id dan nama", () => {
    for (const x of ["347", "346", "360", "alur:Pdt.G", "", "Jenis Baru"]) {
      const bot = G.jenisKunci(x);
      const portal = jenisKunci(x);
      expect(bot === "" ? "(tanpa)" : bot).toBe(portal);
    }
  });
});
