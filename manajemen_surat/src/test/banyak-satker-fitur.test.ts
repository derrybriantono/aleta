// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BAGIAN_FITUR_EKSTENSI } from "@/lib/daftar-fitur-ekstensi";
import {
  GalatFiturSatker,
  KATALOG_FITUR_SATKER,
  STATUS_FITUR,
  bagianEkstensiMenyala,
  bersihkanPengaturanFitur,
  keadaanFitur,
  petaKeadaanFitur,
  ringkasUntukKlien,
  susunPengaturanFitur,
  type IzinPusat,
  type SaluranSatker,
  type StatusFitur,
} from "@/lib/fitur-satker";
import { FITUR_BLANGKO_SAYA_SEMUA_PERAN } from "@/lib/fitur-satker";
import { KODE_FITUR_ISIAN_SEKALI } from "@/lib/isian-sekali";
import { KODE_FITUR_JEJAK_ISIAN } from "@/lib/jejak-isian";
import { KODE_FITUR_KETEPATAN_ISIAN } from "@/lib/ketepatan-isian";
import { moduleVisibility, modules } from "@/lib/mock-data";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  bacaRingkasanFiturKlien,
  dorongFiturKeBot,
  fiturMenyala,
  pastikanFiturMenyala,
  simpanPengaturanFitur,
} from "@/server/modules/satker/fitur";
import { bacaSaluranEfektif, simpanKanal } from "@/server/modules/satker/kanal";

/**
 * Banyak satker, Tahap 0 - saklar fitur per satker.
 *   A. matriks aturan murni (status pilihan x saluran x plafon Pusat);
 *   B. BAWAAN: semua fitur yang ada menyala, juga bila penyimpanan rusak;
 *   C. simpan / tolak / audit di pg-mem berbenih;
 *   D. rute /api/satker/fitur hanya Super Admin; menu hanya Super Admin;
 *   E. sisi bot menerima dan gagal ke sisi menyala.
 */

const akar = path.resolve(process.cwd(), "..");

describe("A - matriks saklar (murni)", () => {
  const STATUS: StatusFitur[] = ["stabil", "uji-coba", "mati"];
  const SALURAN: SaluranSatker[] = ["stabil", "uji-coba"];
  const kode = "putusan-advance";

  it("tanpa pengaturan: status bawaan katalog, menyala", () => {
    for (const s of SALURAN) {
      const k = keadaanFitur(kode, { saluran: s });
      expect(k).toMatchObject({ status: "stabil", menyala: true, sebab: "", diubah: false });
    }
  });

  it("pilihan x saluran: uji-coba hanya menyala di saluran uji-coba; mati selalu mati", () => {
    const hasil: Record<string, string> = {};
    for (const pilihan of STATUS) {
      for (const saluran of SALURAN) {
        const k = keadaanFitur(kode, { saluran, pengaturan: { fitur: { [kode]: pilihan }, diubahOleh: "", diubahPada: "" } });
        hasil[`${pilihan}@${saluran}`] = `${k.status}/${k.menyala}`;
      }
    }
    expect(hasil).toEqual({
      "stabil@stabil": "stabil/true",
      "stabil@uji-coba": "stabil/true",
      "uji-coba@stabil": "mati/false",
      "uji-coba@uji-coba": "uji-coba/true",
      "mati@stabil": "mati/false",
      "mati@uji-coba": "mati/false",
    });
  });

  it("plafon Pusat: pilihan satker tidak melampauinya (mati < uji-coba < stabil)", () => {
    const izin = (s: StatusFitur): IzinPusat => ({ fitur: { [kode]: s }, diterimaPada: "" });
    const pilih = (s: StatusFitur) => ({ fitur: { [kode]: s }, diubahOleh: "", diubahPada: "" });
    expect(keadaanFitur(kode, { saluran: "uji-coba", pengaturan: pilih("stabil"), izinPusat: izin("mati") })).toMatchObject({ status: "mati", menyala: false });
    expect(keadaanFitur(kode, { saluran: "uji-coba", pengaturan: pilih("stabil"), izinPusat: izin("uji-coba") })).toMatchObject({ status: "uji-coba", menyala: true });
    expect(keadaanFitur(kode, { saluran: "stabil", pengaturan: pilih("stabil"), izinPusat: izin("uji-coba") })).toMatchObject({ status: "mati", menyala: false });
    expect(keadaanFitur(kode, { saluran: "stabil", pengaturan: pilih("mati"), izinPusat: izin("stabil") })).toMatchObject({ status: "mati" });
    expect(keadaanFitur(kode, { saluran: "stabil", izinPusat: izin("stabil") })).toMatchObject({ status: "stabil", menyala: true });
  });

  it("kode di luar katalog dianggap menyala; kode dan status tidak dikenal dibuang saat dibersihkan", () => {
    expect(keadaanFitur("fitur-tidak-ada", {}).menyala).toBe(true);
    const p = bersihkanPengaturanFitur({ fitur: { [kode]: "mati", "tidak-ada": "mati", "bot-ai": "rusak" }, diubahOleh: "X" });
    expect(p?.fitur).toEqual({ [kode]: "mati" });
    expect(bersihkanPengaturanFitur("bukan objek")).toBeNull();
    expect(bersihkanPengaturanFitur({ fitur: [] })).toBeNull();
  });

  it("susunPengaturanFitur: hanya selisih dari bawaan; menolak kode asing, status asing, dan uji-coba di saluran stabil", () => {
    expect(susunPengaturanFitur({ [kode]: "stabil", "bot-ai": "mati" }, "stabil")).toEqual({ "bot-ai": "mati" });
    expect(() => susunPengaturanFitur({ asing: "mati" }, "stabil")).toThrow(GalatFiturSatker);
    expect(() => susunPengaturanFitur({ [kode]: "rusak" }, "stabil")).toThrow(/stabil, uji-coba, atau mati/);
    expect(() => susunPengaturanFitur({ [kode]: "uji-coba" }, "stabil")).toThrow(/saluran uji coba/);
    expect(susunPengaturanFitur({ [kode]: "uji-coba" }, "uji-coba")).toEqual({ [kode]: "uji-coba" });
    expect(() => susunPengaturanFitur([], "stabil")).toThrow(GalatFiturSatker);
  });

  it("katalog: kode unik berkebab-case, bagian ekstensi sama dengan daftar fitur ekstensi", () => {
    const kodeSemua = KATALOG_FITUR_SATKER.map((f) => f.kode);
    expect(new Set(kodeSemua).size).toBe(kodeSemua.length);
    for (const k of kodeSemua) expect(k).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const bagian of Object.keys(BAGIAN_FITUR_EKSTENSI)) expect(kodeSemua).toContain(`ekstensi-${bagian}`);
    for (const f of KATALOG_FITUR_SATKER) expect(STATUS_FITUR).toContain(f.bawaan);
  });
});

/**
 * Pengecualian TUNGGAL (18 Okt 2026, butir 10): saklar tahap awal Blangko Saya. Fitur baru ini belum pernah menyala di
 * satker mana pun, jadi bawaannya MATI (hanya Super Admin) sampai dibuka; "fitur lama tidak boleh berkurang" tidak terlanggar.
 */
// 25 Okt 2026 (rantai C, C1): saklar jejak isian juga fitur baru yang bawaannya MATI. Rantai D: begitu pula Ketepatan isian (D1) dan Isian sekali per perkara (D2).
const BAWAAN_MATI = new Set([FITUR_BLANGKO_SAYA_SEMUA_PERAN, KODE_FITUR_JEJAK_ISIAN, KODE_FITUR_KETEPATAN_ISIAN, KODE_FITUR_ISIAN_SEKALI]);
const FITUR_LAMA = KATALOG_FITUR_SATKER.filter((f) => !BAWAAN_MATI.has(f.kode));
const hanyaLama = (peta: Record<string, unknown>) => Object.entries(peta).filter(([k]) => !BAWAAN_MATI.has(k)).map(([, v]) => v);

describe("B - bawaan: semua yang ada sekarang menyala", () => {
  it("katalog: setiap fitur bawaannya stabil; peta tanpa pengaturan menyala semua", () => {
    for (const f of FITUR_LAMA) expect(f.bawaan, f.kode).toBe("stabil");
    for (const f of KATALOG_FITUR_SATKER.filter((x) => BAWAAN_MATI.has(x.kode))) expect(f.bawaan, f.kode).toBe("mati");
    const peta = petaKeadaanFitur({});
    expect((hanyaLama(peta) as Array<{ menyala: boolean; status: string }>).every((k) => k.menyala && k.status === "stabil")).toBe(true);
    expect(peta[FITUR_BLANGKO_SAYA_SEMUA_PERAN]).toMatchObject({ menyala: false, status: "mati" });
    const ringkas = ringkasUntukKlien({});
    expect(ringkas.saluran).toBe("stabil");
    expect(hanyaLama(ringkas.fitur).every((s) => s === "stabil")).toBe(true);
    expect(Object.values(bagianEkstensiMenyala(ringkas)).every(Boolean)).toBe(true);
  });

  it("basis data berbenih yang belum pernah diatur: semua menyala dan pastikanFiturMenyala tidak melempar", async () => {
    const db = await createAletaDatabase({ useInMemory: true, seed: true });
    try {
      for (const f of FITUR_LAMA) {
        expect(await fiturMenyala(db, f.kode), f.kode).toBe(true);
        await expect(pastikanFiturMenyala(db, f.kode)).resolves.toBeUndefined();
      }
      expect(await bacaSaluranEfektif(db)).toBe("stabil");
    } finally {
      await db.close();
    }
  });

  it("penyimpanan rusak atau tak terbaca: gagal ke sisi MENYALA", async () => {
    const patah = {
      queryOne: async () => {
        throw new Error("basis data mati");
      },
      queryAll: async () => {
        throw new Error("basis data mati");
      },
    } as unknown as AletaDatabase;
    expect(await fiturMenyala(patah, "putusan-advance")).toBe(true);
    const ringkas = await bacaRingkasanFiturKlien(patah);
    expect(hanyaLama(ringkas.fitur).every((s) => s === "stabil")).toBe(true);

    const rusak = {
      queryOne: async () => ({ nilai: "{bukan json" }),
      queryAll: async () => [],
    } as unknown as AletaDatabase;
    expect(await fiturMenyala(rusak, "putusan-advance")).toBe(true);
  });
});

describe("C - simpan, tolak, audit (pg-mem)", () => {
  let db: AletaDatabase;
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.close();
  });
  const aktor = { id: "usr-super", name: "Super Admin" };

  it("mematikan satu fitur: hanya itu yang mati, tercatat di jejak audit, dan didorong ke bot", async () => {
    const hasil = await simpanPengaturanFitur(db, aktor, { fitur: { "putusan-advance": "mati" } });
    expect(hasil.berubah).toBe(1);
    expect(hasil.bot.terkirim).toBe(true);
    expect(await fiturMenyala(db, "putusan-advance")).toBe(false);
    expect(await fiturMenyala(db, "kasir-otomatis")).toBe(true);
    await expect(pastikanFiturMenyala(db, "putusan-advance")).rejects.toMatchObject({ status: 403 });
    const audit = await db.queryAll<{ action: string; payload_json: string }>("SELECT action, payload_json FROM audit_logs WHERE action = 'UPDATE_FITUR_SATKER'");
    expect(audit).toHaveLength(1);
    expect(JSON.parse(audit[0].payload_json).berubah).toEqual([{ kode: "putusan-advance", dari: "stabil", ke: "mati" }]);
    const ringkas = await bacaRingkasanFiturKlien(db);
    expect(ringkas.fitur["putusan-advance"]).toBe("mati");
    // dikirim ke bot dengan peta lengkap
    const panggilan = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(panggilan[0])).toContain("/internal/aleta-bot/fitur-satker/sinkron");
    expect(JSON.parse(String((panggilan[1] as RequestInit).body)).fitur["putusan-advance"]).toBe("mati");
  });

  it("menyalakan kembali = kembali ke bawaan; kode asing dan uji-coba di saluran stabil ditolak 400", async () => {
    await simpanPengaturanFitur(db, aktor, { fitur: { "bot-ai": "mati" } });
    await simpanPengaturanFitur(db, aktor, { fitur: { "bot-ai": "stabil" } });
    expect(await fiturMenyala(db, "bot-ai")).toBe(true);
    await expect(simpanPengaturanFitur(db, aktor, { fitur: { asing: "mati" } })).rejects.toMatchObject({ status: 400 });
    await expect(simpanPengaturanFitur(db, aktor, { fitur: { "bot-ai": "uji-coba" } })).rejects.toMatchObject({ status: 400 });
  });

  it("uji-coba: boleh hanya di saluran uji-coba; kembali ke saluran stabil mematikannya", async () => {
    await simpanKanal(db, aktor, { saluran: "uji-coba" });
    await simpanPengaturanFitur(db, aktor, { fitur: { "skp-jabatan": "uji-coba" } });
    expect(await fiturMenyala(db, "skp-jabatan")).toBe(true);
    await simpanKanal(db, aktor, { saluran: "stabil" });
    expect(await bacaSaluranEfektif(db)).toBe("stabil");
    expect(await fiturMenyala(db, "skp-jabatan")).toBe(false);
  });

  it("bot tidak terjangkau: penyimpanan tetap berhasil dan layar diberi tahu", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("tidak terjangkau"); }));
    const hasil = await simpanPengaturanFitur(db, aktor, { fitur: { "bot-ai": "mati" } });
    expect(hasil.bot.terkirim).toBe(false);
    expect(hasil.bot.pesan).toMatch(/belum dapat dihubungi/);
    expect((await dorongFiturKeBot(db)).terkirim).toBe(false);
    expect(await fiturMenyala(db, "bot-ai")).toBe(false);
  });
});

describe("D - rute /api/satker/fitur dan menu", () => {
  let db: AletaDatabase;
  let pemanggil = "usr-super";
  beforeEach(async () => {
    vi.resetModules();
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    vi.doMock("@/server/db/client", async (asli) => ({ ...(await asli<typeof import("@/server/db/client")>()), getDatabase: async () => db }));
    vi.doMock("@/server/shared/auth", () => ({ resolveActorUserId: async () => pemanggil }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    pemanggil = "usr-super";
  });
  afterEach(async () => {
    vi.doUnmock("@/server/db/client");
    vi.doUnmock("@/server/shared/auth");
    vi.unstubAllGlobals();
    await db.close();
  });

  async function rute(cara: "GET" | "POST", badan?: Record<string, unknown>) {
    const modul = (await import("@/app/api/satker/fitur/route")) as unknown as Record<string, (r: NextRequest) => Promise<Response>>;
    const res = await modul[cara](
      new NextRequest("http://localhost/api/satker/fitur", {
        method: cara,
        headers: badan ? { "content-type": "application/json" } : undefined,
        body: badan ? JSON.stringify(badan) : undefined,
      })
    );
    return { status: res.status, isi: (await res.json()) as { ok: boolean; data?: Record<string, unknown> } };
  }

  it("Super Admin membuka dan mengubah; Admin dan peran lain ditolak 403", async () => {
    const baca = await rute("GET");
    expect(baca.status).toBe(200);
    expect((baca.isi.data!.fitur as unknown[]).length).toBe(KATALOG_FITUR_SATKER.length);
    expect(baca.isi.data).toMatchObject({ saluran: "stabil", tersimpan: false, kanal: { alamatPusat: "" } });

    const ubah = await rute("POST", { tindakan: "simpan-fitur", fitur: { "kasir-otomatis": "mati" } });
    expect(ubah.status).toBe(200);
    expect(await fiturMenyala(db, "kasir-otomatis")).toBe(false);

    const kanal = await rute("POST", { tindakan: "simpan-kanal", saluran: "uji-coba", alamatPusat: "http://pusat.contoh.id/" });
    expect(kanal.isi.data).toMatchObject({ kanal: { saluran: "uji-coba", alamatPusat: "http://pusat.contoh.id" } });
    expect((await rute("POST", { tindakan: "simpan-kanal", alamatPusat: "ftp://x" })).status).toBe(400);
    expect((await rute("POST", { tindakan: "tidak-ada" })).status).toBe(400);

    for (const p of ["usr-admin", "usr-ketua"]) {
      pemanggil = p;
      expect((await rute("GET")).status, p).toBe(403);
      expect((await rute("POST", { tindakan: "simpan-fitur", fitur: { "bot-ai": "mati" } })).status, p).toBe(403);
    }
    expect(await fiturMenyala(db, "bot-ai")).toBe(true);
  });

  it("cek pembaruan tanpa alamat Pusat: 'belum diatur', bukan galat", async () => {
    const r = await rute("POST", { tindakan: "cek-pusat" });
    expect(r.status).toBe(200);
    expect(r.isi.data).toMatchObject({ hasil: { status: "belum-diatur" } });
  });

  it("menu Fitur Satker hanya untuk Super Admin", () => {
    const modul = modules.find((m) => m.id === "fitur-satker");
    expect(modul?.roleIds).toEqual(["super-admin"]);
    expect(modul?.href).toBe("/admin/fitur-satker");
    const lihat = (peran: string) => moduleVisibility.find((v) => v.roleId === peran)?.modules["fitur-satker"];
    expect(lihat("super-admin")).toBe(true);
    expect(lihat("admin")).toBeFalsy();
  });
});

describe("E - sisi bot", () => {
  const req = createRequire(path.join(akar, "aleta_bot", "package.json"));
  const bot = req(path.join(akar, "aleta_bot/services/fiturSatkerService.js")) as {
    terima: (x: unknown) => { diterima: boolean; saluran: string; fitur: Record<string, string> };
    baca: () => { diterima: boolean; fitur: Record<string, string> };
    fiturMenyala: (k: string) => boolean;
    statusFitur: (k: string) => string;
    aturBerkasUji: (p: string) => void;
  };
  let folder = "";
  beforeEach(() => {
    folder = mkdtempSync(path.join(os.tmpdir(), "fitur-satker-"));
    bot.aturBerkasUji(path.join(folder, "fitur-satker.json"));
  });
  afterEach(() => rmSync(folder, { recursive: true, force: true }));

  it("belum pernah menerima: semua menyala", () => {
    expect(bot.baca()).toMatchObject({ diterima: false, fitur: {} });
    expect(bot.fiturMenyala("bot-whatsapp")).toBe(true);
    expect(bot.fiturMenyala("apa-saja")).toBe(true);
  });

  it("menerima ringkasan portal: hanya yang mati yang mati; status/kode aneh diabaikan", () => {
    bot.terima({ saluran: "uji-coba", fitur: { "bot-ai": "mati", "bot-whatsapp": "uji-coba", "bot-abt-pengaturan": "rusak", "KODE Aneh": "mati" } });
    expect(bot.fiturMenyala("bot-ai")).toBe(false);
    expect(bot.fiturMenyala("bot-whatsapp")).toBe(true);
    expect(bot.fiturMenyala("bot-abt-pengaturan")).toBe(true);
    expect(bot.fiturMenyala("KODE Aneh")).toBe(true);
    expect(() => bot.terima("bukan objek")).toThrow(/tidak sah/);
    expect(() => bot.terima({ fitur: [] })).toThrow(/tidak sah/);
  });

  it("diingat setelah bot dinyalakan ulang; berkas rusak = semua menyala", () => {
    bot.terima({ saluran: "stabil", fitur: { "bot-ai": "mati" } });
    const berkas = path.join(folder, "fitur-satker.json");
    expect(JSON.parse(readFileSync(berkas, "utf8")).fitur["bot-ai"]).toBe("mati");
    bot.aturBerkasUji(berkas);
    expect(bot.fiturMenyala("bot-ai")).toBe(false);
    writeFileSync(berkas, "{rusak", "utf8");
    bot.aturBerkasUji(berkas);
    expect(bot.fiturMenyala("bot-ai")).toBe(true);
  });

  it("rute bot terpasang di app.js dan dijaga token internal", () => {
    expect(readFileSync(path.join(akar, "aleta_bot/app.js"), "utf8")).toContain('app.use("/internal/aleta-bot/fitur-satker", require("./routes/fiturSatkerRoutes"))');
    const rute = readFileSync(path.join(akar, "aleta_bot/routes/fiturSatkerRoutes.js"), "utf8");
    expect(rute).toContain("router.use(wajibToken)");
    expect(rute).toContain('router.post("/sinkron"');
  });
});
