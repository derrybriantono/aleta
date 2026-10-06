// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * PEMANTAU SUMBER DAYA - PORTAL (butir 3, 6 Oktober 2026)
 * ============================================================================
 *
 * Handler GET sungguhan atas pg-mem berbenih; gerbang bot ditiru. Yang dijaga:
 *
 *   - /api/aleta-ecourt/sumber-daya (widget): tanpa sesi 401; pegawai
 *     berkapabilitas panel mendapat RINGKASAN saja - peta layanan host tidak
 *     ikut; bolehRinci hanya bagi Admin/Super Admin;
 *   - /api/admin/sumber-daya (rincian): hakim 403, Admin mendapat semuanya;
 *   - bot mati: 503 dengan sebabnya, tidak pernah angka karangan;
 *   - jawaban bot yang rusak dibersihkan: warna asing = kelabu;
 *   - tambahan portal (Postgres) menghitung ulang persen DAN warna;
 *   - singgahan 3 detik: puluhan tab = satu panggilan ke bot.
 */

vi.mock("@/server/modules/sumber-daya/gateway", () => ({ mintaSumberDayaBot: vi.fn() }));

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-hakim";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

const { mintaSumberDayaBot } = await import("@/server/modules/sumber-daya/gateway");
const layanan = await import("@/server/modules/sumber-daya/layanan");
const gerbang = vi.mocked(mintaSumberDayaBot);

const GIB = 1024 ** 3;

function jawabanBot(ubah: Record<string, unknown> = {}) {
  return {
    ok: true,
    diukurPada: "2026-10-06T05:36:48.000Z",
    ambang: { ram: { kuning: 75, merah: 90 }, disk: { kuning: 80, merah: 90 }, gpu: { kuning: 70, merah: 90 } },
    sumber: { ramServer: "/proc/meminfo", rincian: "netdata (cgroup host)" },
    ringkas: {
      aleta: {
        ram: { byte: 1.4 * GIB, totalByte: 30.9 * GIB, persen: 4.5, warna: "hijau" },
        disk: { byte: 100 * GIB, totalByte: 200 * GIB, persen: 50, warna: "hijau" },
        gpu: { ada: false, persen: null, warna: "kelabu", keterangan: "Tidak ada GPU di server ini." },
      },
      server: {
        ram: { byte: 5.6 * GIB, totalByte: 30.9 * GIB, persen: 18.1, warna: "hijau" },
        disk: { byte: 121 * GIB, totalByte: 200 * GIB, persen: 60.6, warna: "hijau", partisi: "/home" },
        gpu: { ada: false, persen: null, warna: "kelabu", keterangan: "Tidak ada GPU di server ini." },
      },
    },
    rincian: {
      memori: null,
      aleta: [{ kunci: "aleta-bot", nama: "ALETA Bot (Node)", jenis: "container", ramByte: 500, cacheByte: 1, swapByte: 0 }],
      lain: [{ kunci: "mariadb", nama: "MariaDB", jenis: "layanan", ramByte: 2000, cacheByte: 9, swapByte: 0 }],
      ramLainnyaByte: 10,
      partisi: [],
      diskAleta: { byte: 100 * GIB, lengkap: true, rincian: [] },
      docker: null,
      folderDiukurPada: null,
      gpu: { ada: false, persen: null, keterangan: "Tidak ada GPU di server ini.", perangkat: [] },
    },
    catatan: [],
    ...ubah,
  };
}

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-hakim";
  layanan.kosongkanSinggahSumberDaya();
  gerbang.mockReset();
  gerbang.mockResolvedValue({ ok: true, data: jawabanBot() });
});

afterEach(async () => {
  await db?.close();
  db = null;
});

async function panggilWidget() {
  const { GET } = await import("@/app/api/aleta-ecourt/sumber-daya/route");
  const r = await GET(new NextRequest("http://localhost/api/aleta-ecourt/sumber-daya"));
  return { status: r.status, isi: (await r.json()) as { ok: boolean; data: Record<string, any>; error?: unknown } };
}

async function panggilAdmin() {
  const { GET } = await import("@/app/api/admin/sumber-daya/route");
  const r = await GET(new NextRequest("http://localhost/api/admin/sumber-daya"));
  return { status: r.status, isi: (await r.json()) as { ok: boolean; data: Record<string, any>; error?: unknown } };
}

describe("GET /api/aleta-ecourt/sumber-daya (widget)", () => {
  it("tanpa sesi: 401, bot tidak ditanya", async () => {
    aktor = null;
    const r = await panggilWidget();
    expect(r.status).toBe(401);
    expect(gerbang).not.toHaveBeenCalled();
  });

  it("hakim: ringkasan ALETA + server saja, TANPA rincian layanan host, bolehRinci false", async () => {
    const r = await panggilWidget();
    expect(r.status).toBe(200);
    expect(Object.keys(r.isi.data).sort()).toEqual(["alamatRinci", "bolehRinci", "diukurPada", "ringkas"]);
    expect(r.isi.data.bolehRinci).toBe(false);
    expect(JSON.stringify(r.isi.data)).not.toContain("mariadb");
    expect(r.isi.data.ringkas.aleta.ram).toMatchObject({ persen: 4.5, warna: "hijau" });
    expect(r.isi.data.ringkas.server.disk).toMatchObject({ persen: 60.6, partisi: "/home" });
    expect(r.isi.data.ringkas.server.gpu).toEqual({ ada: false, persen: null, warna: "kelabu", keterangan: "Tidak ada GPU di server ini." });
  });

  it("Admin: bolehRinci true dan alamat rinciannya halaman admin", async () => {
    aktor = "usr-admin";
    const r = await panggilWidget();
    expect(r.isi.data.bolehRinci).toBe(true);
    expect(r.isi.data.alamatRinci).toBe("/admin/sumber-daya");
  });

  it("bot mati: 503 dengan sebabnya", async () => {
    gerbang.mockResolvedValue({ ok: false, error: "ALETA Bot tidak menjawab dalam batas waktu." });
    const r = await panggilWidget();
    expect(r.status).toBe(503);
    expect(JSON.stringify(r.isi)).toContain("tidak menjawab");
  });

  it("singgahan 3 detik: lima panggilan beruntun = satu pengukuran di bot", async () => {
    for (let i = 0; i < 5; i += 1) expect((await panggilWidget()).status).toBe(200);
    expect(gerbang).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/admin/sumber-daya (rincian)", () => {
  it("hakim: 403", async () => {
    const r = await panggilAdmin();
    expect(r.status).toBe(403);
  });

  it("Admin: rincian lengkap - ALETA dan aplikasi lain terpisah", async () => {
    aktor = "usr-admin";
    const r = await panggilAdmin();
    expect(r.status).toBe(200);
    expect(r.isi.data.rincian.aleta.map((b: any) => b.kunci)).toEqual(["aleta-bot"]);
    expect(r.isi.data.rincian.lain.map((b: any) => b.kunci)).toEqual(["mariadb"]);
  });
});

describe("layanan portal", () => {
  it("jawaban bot rusak: null; warna asing menjadi kelabu; GPU yang 'tidak ada' tidak membawa persen", () => {
    expect(layanan.bersihkanJawabanBot(null)).toBeNull();
    expect(layanan.bersihkanJawabanBot({ ringkas: { aleta: {} } })).toBeNull();
    const kotor = jawabanBot();
    (kotor.ringkas.aleta.ram as Record<string, unknown>).warna = "ungu";
    (kotor.ringkas.server.gpu as Record<string, unknown>).persen = 55;
    const b = layanan.bersihkanJawabanBot(kotor)!;
    expect(b.ringkas.aleta.ram.warna).toBe("kelabu");
    expect(b.ringkas.server.gpu.persen).toBeNull();
  });

  it("Postgres ditambahkan ke disk ALETA: byte, persen, DAN warna dihitung ulang dengan ambang bot", () => {
    const b = layanan.bersihkanJawabanBot(jawabanBot())!;
    const g = layanan.gabungTambahanPortal(b, { postgresByte: 70 * GIB, portalSendiri: null });
    expect(g.ringkas.aleta.disk.byte).toBe(170 * GIB);
    expect(g.ringkas.aleta.disk.persen).toBe(85);
    expect(g.ringkas.aleta.disk.warna).toBe("kuning");
    expect(g.rincian.diskAleta.rincian.at(-1)).toMatchObject({ kunci: "postgres", byte: 70 * GIB });
    // Masukannya tidak diubah.
    expect(b.ringkas.aleta.disk.byte).toBe(100 * GIB);
  });

  it("memori portal sendiri HANYA bila bot tidak menyebut aleta-portal", () => {
    const b = layanan.bersihkanJawabanBot(jawabanBot())!;
    const g = layanan.gabungTambahanPortal(b, { postgresByte: null, portalSendiri: { ramByte: 300, cacheByte: 5 } });
    expect(g.rincian.aleta.map((x) => x.kunci)).toEqual(["aleta-bot", "aleta-portal"]);
    expect(g.ringkas.aleta.ram.byte).toBe(1.4 * GIB + 300);
    const sudah = layanan.bersihkanJawabanBot(
      jawabanBot({
        rincian: { ...jawabanBot().rincian, aleta: [{ kunci: "aleta-portal", nama: "Portal", jenis: "container", ramByte: 9, cacheByte: 0, swapByte: 0 }] },
      })
    )!;
    expect(layanan.gabungTambahanPortal(sudah, { postgresByte: null, portalSendiri: { ramByte: 300, cacheByte: 5 } }).rincian.aleta).toHaveLength(1);
  });

  it("warnaDariAmbang sama dengan bot di batasnya", () => {
    const a = { kuning: 75, merah: 90 };
    expect([74.9, 75, 89.9, 90].map((p) => layanan.warnaDariAmbang(p, a))).toEqual(["hijau", "kuning", "kuning", "merah"]);
    expect(layanan.warnaDariAmbang(null, a)).toBe("kelabu");
  });

  it("ambang di portal dan bot bersumber sama: cadangan portal = AMBANG bot", () => {
    const bot = readFileSync(path.resolve(process.cwd(), "../aleta_bot/services/sumberDayaService.js"), "utf8");
    const portal = readFileSync(path.resolve(process.cwd(), "src/server/modules/sumber-daya/layanan.ts"), "utf8");
    for (const [jenis, k, m] of [["ram", 75, 90], ["disk", 80, 90], ["gpu", 70, 90]] as const) {
      expect(bot).toContain(`${jenis}: Object.freeze({ kuning: ${k}, merah: ${m} })`);
      expect(portal).toContain(`${jenis}: { kuning: ${k}, merah: ${m} }`);
    }
  });
});
