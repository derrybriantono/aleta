// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * RUTE RIWAYAT PIHAK - KEWENANGAN, MASUKAN, DAN PERKARA YANG TIDAK ADA
 * ============================================================================
 *
 * Dua sisi dijalankan sungguhan:
 *
 *   PORTAL  GET /api/aleta-ecourt/riwayat-pihak - yang ditiru hanya basis
 *           data, identitas penanya, KEWENANGAN, dan pengangkut ke bot.
 *           Penolakan kewenangan harus berujung 403 TANPA menyentuh bot -
 *           riwayat perkara orang lain bukan untuk peran tanpa akses panel.
 *
 *   BOT     potongan router.get("/sipp/riwayat-pihak") DIPOTONG dari
 *           internalGatewayRoutes.js dan dijalankan di node:vm: penjaganya
 *           harus requireInternalToken, dan status HTTP-nya harus status dari
 *           jawabRute (400/404/500 - perilakunya diuji di
 *           riwayat-pihak-pengenal.test.ts).
 */

const keadaan = vi.hoisted(() => ({
  izinkan: true,
  panggilanBot: [] as Array<Record<string, unknown>>,
  jawabanBot: null as
    | null
    | { ok: true; data: Record<string, unknown> }
    | { ok: false; error: string; status?: number; kode?: string },
  audit: [] as Array<Record<string, unknown>>,
  auditGagal: false,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
// Jejak audit: yang dicatat ditangkap di sini. Mekanismenya sama dengan rute
// berkas-zip dan eviden-skp - appendAuditLog + nextPrefixedId.
vi.mock("@/server/shared/audit", () => ({
  appendAuditLog: async (_db: unknown, catatan: Record<string, unknown>) => {
    if (keadaan.auditGagal) throw new Error("tabel audit_logs terkunci (uji)");
    keadaan.audit.push(JSON.parse(JSON.stringify(catatan)));
  },
}));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt_uji_1" }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async (_db: unknown, _aktor: unknown, kapabilitas: string) => {
    // Kewenangan yang diminta rute harus "panel" - sama dengan Status Perkara.
    if (kapabilitas !== "panel") throw new ApiError(500, `kewenangan tak terduga: ${kapabilitas}`);
    if (!keadaan.izinkan) throw new ApiError(403, "Peran Anda tidak diberi akses panel status perkara.");
    // HAK-PERAN 12 Okt: riwayat pihak = data pribadi, hanya golongan status.data-pihak (di sini PP).
    return { id: "usr_uji", name: "Penguji Panel", roleId: "panitera-pengganti" };
  },
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { handleRouteError } = await import("@/server/shared/http");
  return { handleAdminRouteError: (galat: unknown) => handleRouteError(galat) };
});
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayRiwayatPihak: async (pilihan: Record<string, unknown>) => {
    keadaan.panggilanBot.push(pilihan);
    return keadaan.jawabanBot ?? { ok: false, error: "tidak ada jawaban tiruan" };
  },
}));

// Uji mutan menjalankan berkas ini atas SALINAN rutenya lewat variabel ini.
vi.mock("@/app/api/aleta-ecourt/riwayat-pihak/route", async (asli) =>
  process.env.RIWAYAT_RUTE_BERKAS ? await import(/* @vite-ignore */ process.env.RIWAYAT_RUTE_BERKAS) : await asli()
);

import { GET } from "@/app/api/aleta-ecourt/riwayat-pihak/route";

beforeEach(() => {
  keadaan.izinkan = true;
  keadaan.panggilanBot = [];
  keadaan.jawabanBot = null;
  keadaan.audit = [];
  keadaan.auditGagal = false;
});

async function tanya(kueri: string) {
  const balasan = await GET(new NextRequest(`http://portal.contoh/api/aleta-ecourt/riwayat-pihak${kueri}`));
  return { status: balasan.status, json: (await balasan.json()) as Record<string, unknown> };
}

describe("rute portal /api/aleta-ecourt/riwayat-pihak", () => {
  it("tanpa kewenangan panel: 403, dan bot tidak pernah ditanya", async () => {
    keadaan.izinkan = false;
    const { status, json } = await tanya("?perkaraId=9001");
    expect(status).toBe(403);
    expect(json.ok).toBe(false);
    expect(keadaan.panggilanBot).toEqual([]);
  });

  it("berwenang: bot ditanya dengan perkaraId, jawabannya diteruskan utuh", async () => {
    keadaan.jawabanBot = {
      ok: true,
      data: { ok: true, aktaTerbaca: true, pihak: [{ pihakId: 1, pihakKe: 1, nama: "A", ceraiBerakta: 2 }] },
    };
    const { status, json } = await tanya("?perkaraId=9001");
    expect(status).toBe(200);
    expect(keadaan.panggilanBot).toEqual([{ perkaraId: "9001", nomorPerkara: "" }]);
    expect(json.data).toMatchObject({ available: true, ok: true, aktaTerbaca: true, pihak: [{ ceraiBerakta: 2 }] });
  });

  // =========================================================================
  // TIGA PENOLAKAN YANG BERBEDA TINDAKANNYA, BUKAN SATU "BOT TIDAK TERJANGKAU"
  // =========================================================================
  //
  // Telaah gabungan 2.40.0 butir 1: jawaban 400/404 bot dulu diteruskan
  // sebagai available:false - yang di portal berarti "bot tidak dapat
  // dihubungi". Petugas lalu memeriksa layanan bot yang sehat, padahal
  // perkaranya yang tidak ada.
  it("perkara tidak ada: bot TERJANGKAU, kodenya perkara_tidak_ada", async () => {
    keadaan.jawabanBot = { ok: false, error: "Perkara tidak ditemukan di SIPP.", status: 404, kode: "perkara_tidak_ada" };
    const { status, json } = await tanya("?perkaraId=987654");
    expect(status).toBe(200);
    expect(json.data).toEqual({
      available: true,
      ok: false,
      kode: "perkara_tidak_ada",
      alasan: "Perkara tidak ditemukan di SIPP.",
    });
  });

  it("masukan ditolak bot: TERJANGKAU, kodenya masukan_tidak_sah", async () => {
    keadaan.jawabanBot = { ok: false, error: "perkaraId atau nomorPerkara wajib diisi.", status: 400, kode: "masukan_tidak_sah" };
    const { json } = await tanya("?nomorPerkara=x");
    expect(json.data).toMatchObject({ available: true, ok: false, kode: "masukan_tidak_sah" });
  });

  it("SIPP error di bot: TERJANGKAU, kodenya gagal_membaca_sipp", async () => {
    keadaan.jawabanBot = { ok: false, error: "Table 'perkara' doesn't exist", status: 500, kode: "gagal_membaca_sipp" };
    const { json } = await tanya("?perkaraId=5");
    expect(json.data).toMatchObject({ available: true, ok: false, kode: "gagal_membaca_sipp" });
    expect(String((json.data as Record<string, unknown>).alasan)).toContain("doesn't exist");
  });

  it("bot tidak dapat dihubungi (tanpa kode): available false, kodenya bot_tak_terjangkau", async () => {
    for (const jawaban of [
      { ok: false as const, error: "aleta_bot tidak dapat dihubungi (koneksi ditolak). Pastikan layanan aleta_bot berjalan." },
      { ok: false as const, error: "aleta_bot menjawab dengan halaman 404, bukan data pada /internal/aleta-bot/sipp/riwayat-pihak.", status: 404 },
      { ok: false as const, error: "aleta_bot tidak merespons dalam 20000ms. Periksa status layanan." },
    ]) {
      keadaan.jawabanBot = jawaban;
      const { json } = await tanya("?perkaraId=5");
      expect(json.data, jawaban.error).toMatchObject({ available: false, ok: false, kode: "bot_tak_terjangkau", alasan: jawaban.error });
    }
  });

  it("masukan kosong atau id yang jelas salah ditolak tanpa menyeberang ke bot", async () => {
    for (const kueri of ["", "?perkaraId=abc", "?perkaraId=0", "?perkaraId=1%20OR%201=1"]) {
      const { json } = await tanya(kueri);
      expect(json.data, kueri).toMatchObject({ ok: false });
    }
    expect(keadaan.panggilanBot).toEqual([]);
  });

  it("nomor perkara saja pun diterima - diteruskan apa adanya", async () => {
    keadaan.jawabanBot = { ok: true, data: { ok: true, pihak: [] } };
    await tanya(`?nomorPerkara=${encodeURIComponent("12/Pdt.G/2026/PA.Ctt")}`);
    expect(keadaan.panggilanBot).toEqual([{ perkaraId: "", nomorPerkara: "12/Pdt.G/2026/PA.Ctt" }]);
  });
});

// ===========================================================================
// JEJAK AUDIT - SIAPA MEMBACA RIWAYAT PIHAK PERKARA APA, DAN KAPAN
// ===========================================================================
//
// Telaah gabungan 2.40.0 butir 2: riwayat pihak menyebut perkara LAIN milik
// orang yang sama - lebih peka daripada Status Perkara sendiri - tetapi
// pembacaannya tidak meninggalkan jejak. handleAdminRouteError hanya mencatat
// PENOLAKAN; yang berhasil membaca yang justru perlu dapat ditelusuri.

describe("jejak audit pembacaan riwayat pihak", () => {
  const MUATAN = {
    ok: true,
    aktaTerbaca: true,
    perkara: { perkaraId: "9001", nomorPerkara: "77/Pdt.G/2026/PA.Ctt" },
    pihak: [
      {
        pihakId: 11,
        pihakKe: 1,
        nama: "Sitti Aminah binti Lahamu",
        ceraiBerakta: 2,
        jumlahTerkait: 3,
        cerai: [{ nomorPerkara: "70/Pdt.G/2020/PA.Ctt" }],
        terkait: [{ nomorPerkara: "70/Pdt.G/2020/PA.Ctt" }],
      },
      { pihakId: 12, pihakKe: 2, nama: "Rahmat bin Lambogo", ceraiBerakta: 1, jumlahTerkait: 0, cerai: [], terkait: [] },
    ],
    waktuMs: 321,
  };

  it("yang berhasil membaca dicatat: siapa, perkara apa - kapannya dicatat penulis audit", async () => {
    keadaan.jawabanBot = { ok: true, data: MUATAN };
    const { status } = await tanya("?perkaraId=9001");
    expect(status).toBe(200);
    expect(keadaan.audit).toHaveLength(1);
    const [catatan] = keadaan.audit;
    expect(catatan).toMatchObject({
      id: "adt_uji_1",
      actorUserId: "usr_uji",
      action: "SIPP_RIWAYAT_PIHAK_BACA",
      entityType: "perkara",
      entityId: "77/Pdt.G/2026/PA.Ctt",
    });
    expect(catatan.payload).toMatchObject({
      perkaraId: "9001",
      nomorPerkara: "77/Pdt.G/2026/PA.Ctt",
      jumlahPihak: 2,
      pihakCeraiBerulang: 1,
      pihakBerperkaraTerkait: 1,
      oleh: "Penguji Panel",
    });
    // Tanpa NIK, tanggal lahir, atau nama para pihak: yang ditelusuri jejak
    // ini adalah PEMBACANYA, bukan isi riwayatnya.
    const teks = JSON.stringify(catatan);
    expect(teks).not.toMatch(/\d{16}/);
    expect(teks).not.toMatch(/"(nik|lahir|tanggalLahir|nama)"\s*:/);
    expect(teks).not.toContain("Sitti Aminah");
  });

  it("ditolak kewenangan, perkara tidak ada, atau bot tak terjangkau: tidak dicatat sebagai pembacaan", async () => {
    keadaan.izinkan = false;
    await tanya("?perkaraId=9001");
    keadaan.izinkan = true;
    keadaan.jawabanBot = { ok: false, error: "Perkara tidak ditemukan di SIPP.", status: 404, kode: "perkara_tidak_ada" };
    await tanya("?perkaraId=9001");
    keadaan.jawabanBot = { ok: false, error: "aleta_bot tidak dapat dihubungi (koneksi ditolak)." };
    await tanya("?perkaraId=9001");
    expect(keadaan.audit).toEqual([]);
  });

  it("gagal menulis jejak tidak membatalkan jawaban yang sudah ada", async () => {
    keadaan.jawabanBot = { ok: true, data: MUATAN };
    keadaan.auditGagal = true;
    const { status, json } = await tanya("?perkaraId=9001");
    expect(status).toBe(200);
    expect(json.data).toMatchObject({ ok: true, available: true });
  });
});

// ===========================================================================
// SISI BOT - POTONGAN ROUTER YANG SESUNGGUHNYA
// ===========================================================================

const BERKAS_RUTE = path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js");

function potongRuteBot(jawabRute: (q: Record<string, unknown>) => Promise<{ status: number; body: unknown }>) {
  const isi = readFileSync(BERKAS_RUTE, "utf8");
  const awal = isi.indexOf('router.get("/sipp/riwayat-pihak"');
  expect(awal, "rute /sipp/riwayat-pihak tidak ditemukan di internalGatewayRoutes.js").toBeGreaterThan(0);
  const akhir = isi.indexOf("\n});", awal) + "\n});".length;
  const PENJAGA = Symbol("requireInternalToken");
  const terdaftar: Array<{ jalur: string; penjaga: unknown; penangan: (req: unknown, res: unknown) => Promise<void> }> = [];
  const konteks = vm.createContext({
    requireInternalToken: PENJAGA,
    riwayatPihakService: { jawabRute },
    router: {
      get: (jalur: string, penjaga: unknown, penangan: (req: unknown, res: unknown) => Promise<void>) =>
        terdaftar.push({ jalur, penjaga, penangan }),
    },
  });
  vm.runInContext(isi.slice(awal, akhir), konteks, { filename: "internalGatewayRoutes.js#riwayat-pihak" });
  return { terdaftar, PENJAGA };
}

describe("rute bot /sipp/riwayat-pihak", () => {
  it("dijaga requireInternalToken dan memakai status dari jawabRute", async () => {
    const dipanggil: Array<Record<string, unknown>> = [];
    const { terdaftar, PENJAGA } = potongRuteBot(async (q) => {
      dipanggil.push(q);
      return { status: 404, body: { ok: false, kode: "perkara_tidak_ada" } };
    });
    expect(terdaftar).toHaveLength(1);
    expect(terdaftar[0].jalur).toBe("/sipp/riwayat-pihak");
    expect(terdaftar[0].penjaga).toBe(PENJAGA);

    let status = 0;
    let badan: unknown = null;
    const res = {
      status(s: number) {
        status = s;
        return res;
      },
      json(x: unknown) {
        badan = x;
        return res;
      },
    };
    await terdaftar[0].penangan({ query: { perkaraId: "42" } }, res);
    expect(dipanggil).toEqual([{ perkaraId: "42" }]);
    expect(status).toBe(404);
    expect(badan).toEqual({ ok: false, kode: "perkara_tidak_ada" });
  });
});
