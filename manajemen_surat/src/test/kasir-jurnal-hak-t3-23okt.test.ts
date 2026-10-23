// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { bolehKasir, bolehMengerjakanKasir } from "@/lib/kasir-jurnal";
import { AKSI, bolehAksi } from "@/lib/matriks-peran";

/**
 * ============================================================================
 * HAK TOMBOL "KASIR ALETA" DI JURNAL KEUANGAN PERKARA SIPP (T3, 23 Okt 2026)
 * ============================================================================
 *
 *   - matriks peran: sidang.kasir (menulis) = kasir + Admin/Super Admin; sidang.kasir-baca = juga panitera/panmud;
 *   - matriks SAMA dengan aturan lama (bolehKasir / pengawasKasir): tidak ada akun yang kehilangan atau mendapat hak;
 *   - rute kasir (GET/POST) dijalankan sungguhan dengan akses/bot tiruan: pengawas membaca (200) tetapi POST 403
 *     tanpa satu pun panggilan tulis ke bot; hakim/PP 403 bahkan untuk GET;  */

type Orang = { id: string; name: string; roleId: string; positionId: string; additionalRoleIds: string[] };
const orang = (roleId: string, positionId = "", additionalRoleIds: string[] = []): Orang => ({ id: `u-${roleId}`, name: `Uji ${roleId}`, roleId, positionId, additionalRoleIds });

const PELAKSANA = [orang("staf", "pos-arsiparis", ["kasir"]), orang("analis-keuangan"), orang("staf", "pos-bendahara"), orang("panitera", "pos-panitera", ["kasir"])];
const PENGAWAS = [orang("panitera", "pos-panitera"), orang("panitera-muda"), orang("pejabat-struktural", "pos-panitera-muda-hukum")];
const ADMIN = [orang("admin"), orang("super-admin")];
const BUKAN = [orang("hakim", "pos-hakim"), orang("panitera-pengganti", "pos-panitera-pengganti"), orang("jurusita", "pos-jurusita"), orang("ketua", "pos-ketua"), orang("staf", "pos-arsiparis")];

describe("matriks peran: sidang.kasir / sidang.kasir-baca", () => {
  it("pelaksana dan admin menulis + membaca; pengawas hanya membaca; lainnya tidak sama sekali", () => {
    for (const o of [...PELAKSANA, ...ADMIN]) {
      expect(bolehAksi(o as never, "sidang.kasir"), o.roleId).toBe(true);
      expect(bolehAksi(o as never, "sidang.kasir-baca"), o.roleId).toBe(true);
    }
    for (const o of PENGAWAS) {
      expect(bolehAksi(o as never, "sidang.kasir"), o.roleId).toBe(false);
      expect(bolehAksi(o as never, "sidang.kasir-baca"), o.roleId).toBe(true);
    }
    for (const o of BUKAN) {
      expect(bolehAksi(o as never, "sidang.kasir"), o.roleId).toBe(false);
      expect(bolehAksi(o as never, "sidang.kasir-baca"), o.roleId).toBe(false);
    }
  });

  it("sama dengan aturan lama untuk setiap contoh akun (tidak ada yang terkunci atau terbuka mendadak)", () => {
    for (const o of [...PELAKSANA, ...PENGAWAS, ...ADMIN, ...BUKAN]) {
      expect(bolehAksi(o as never, "sidang.kasir-baca"), `baca ${o.roleId}/${o.positionId}`).toBe(bolehKasir(o as never));
      expect(bolehAksi(o as never, "sidang.kasir"), `tulis ${o.roleId}/${o.positionId}`).toBe(bolehMengerjakanKasir(o as never));
    }
    expect(AKSI["sidang.kasir"].crud).toBe("CU");
    expect(AKSI["sidang.kasir-baca"].crud).toBe("R");
  });
});

// ─── rute sungguhan dengan tiruan di tepinya ─────────────────────────────────
const keadaan = vi.hoisted(() => ({ aktor: null as unknown, panggilan: [] as Array<{ jalur: string; metode: string }> }));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "u-uji" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => keadaan.aktor }));
vi.mock("@/server/modules/aleta-ecourt/court-calendar-akun", () => ({ akunSippPengguna: async () => ({ ok: true, username: "kasir.uji" }) }));
vi.mock("@/server/modules/aleta-ecourt/jadwal-sidang-gateway", () => ({
  panggilBotJadwalSidang: async (jalur: string, opsi?: { method?: string }) => {
    keadaan.panggilan.push({ jalur, metode: opsi?.method ?? "GET" });
    return { ok: true, data: { ok: true, saldo: 0, usulan: [] } };
  },
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { isApiError } = await import("@/server/shared/errors");
  return {
    handleAdminRouteError: (error: unknown) => new Response(JSON.stringify({ ok: false }), { status: isApiError(error) ? error.status : 500 }),
  };
});

async function rute() {
  return import("@/app/api/aleta-ecourt/sidang/kasir/route");
}
const minta = (metode: "GET" | "POST", url: string, badan?: unknown) =>
  new NextRequest(`http://portal.test${url}`, { method: metode, ...(badan ? { body: JSON.stringify(badan), headers: { "content-type": "application/json" } } : {}) });

beforeEach(() => {
  keadaan.panggilan = [];
});

describe("rute Kasir menegakkan hak (bukan hanya tombol disembunyikan)", () => {
  it("pelaksana: GET membawa bolehUbah=true dan POST diteruskan ke bot", async () => {
    const { GET, POST } = await rute();
    keadaan.aktor = PELAKSANA[0];
    const g = await GET(minta("GET", "/api/aleta-ecourt/sidang/kasir?perkaraId=9950"));
    expect(g.status).toBe(200);
    expect((await g.json()).data.bolehUbah).toBe(true);
    const p = await POST(minta("POST", "/api/aleta-ecourt/sidang/kasir", { perkaraId: "9950", baris: [], kering: true }));
    expect(p.status).toBe(200);
    expect(keadaan.panggilan.filter((c) => c.metode === "POST")).toHaveLength(1);
  });

  it("pengawas (panitera, panmud): GET boleh dengan bolehUbah=false; POST 403 dan bot tidak dipanggil", async () => {
    const { GET, POST } = await rute();
    for (const o of PENGAWAS) {
      keadaan.panggilan = [];
      keadaan.aktor = o;
      const g = await GET(minta("GET", "/api/aleta-ecourt/sidang/kasir?perkaraId=9950"));
      expect(g.status, o.roleId).toBe(200);
      expect((await g.json()).data.bolehUbah, o.roleId).toBe(false);
      const p = await POST(minta("POST", "/api/aleta-ecourt/sidang/kasir", { perkaraId: "9950", baris: [{}], kering: false }));
      expect(p.status, o.roleId).toBe(403);
      expect(keadaan.panggilan.filter((c) => c.metode === "POST"), o.roleId).toHaveLength(0);
    }
  });

  it("admin dan super admin menulis; hakim, PP, juru sita, pimpinan ditolak untuk membaca maupun menulis", async () => {
    const { GET, POST } = await rute();
    for (const o of ADMIN) {
      keadaan.aktor = o;
      expect((await GET(minta("GET", "/api/aleta-ecourt/sidang/kasir?perkaraId=9950"))).status, o.roleId).toBe(200);
      expect((await POST(minta("POST", "/api/aleta-ecourt/sidang/kasir", { perkaraId: "9950", baris: [], kering: true }))).status, o.roleId).toBe(200);
    }
    for (const o of BUKAN) {
      keadaan.panggilan = [];
      keadaan.aktor = o;
      expect((await GET(minta("GET", "/api/aleta-ecourt/sidang/kasir?perkaraId=9950"))).status, o.roleId).toBe(403);
      expect((await POST(minta("POST", "/api/aleta-ecourt/sidang/kasir", { perkaraId: "9950", baris: [], kering: true }))).status, o.roleId).toBe(403);
      expect(keadaan.panggilan, o.roleId).toHaveLength(0);
    }
  });

  it("penjaga bersama rute kasir lain (harian/rekap membaca; pengingat/otomatis menulis) mengikuti matriks yang sama", async () => {
    const { pastikanHakKasir, pastikanHakKasirTulis } = await import("@/server/modules/aleta-ecourt/kasir-otomatis");
    for (const o of PENGAWAS) {
      keadaan.aktor = o;
      await expect(pastikanHakKasir({} as never, "u")).resolves.toBeTruthy();
      await expect(pastikanHakKasirTulis({} as never, "u")).rejects.toMatchObject({ status: 403 });
    }
    for (const o of [...PELAKSANA, ...ADMIN]) {
      keadaan.aktor = o;
      await expect(pastikanHakKasirTulis({} as never, "u")).resolves.toBeTruthy();
    }
    for (const o of BUKAN) {
      keadaan.aktor = o;
      await expect(pastikanHakKasir({} as never, "u")).rejects.toMatchObject({ status: 403 });
    }
  });
});
