// @vitest-environment node
/**
 * C6 (audit ABT 17 Okt 2026): rute blangko-derry menegakkan hak dokumen DI SERVER dari sesi (bukan parameter klien).
 * Keputusan pengguna 9 Okt (hak putusan/BAS) + 16 Okt (relaas, PTSP):
 *   put  = hakim majelis, Ketua/Wakil, Admin, Super Admin
 *   bas  = PP / panitera / panmud, Admin, Super Admin
 *   rel  = juru sita / juru sita pengganti, Admin, Super Admin (BUKAN panitera/PP/Ketua/hakim)
 *   ptsp = PTSP (folder 99 PTSP), Admin, Super Admin
 * Saklar Pengaturan SIPP & ABT ("Hakim boleh membuka folder BAS", "PP boleh membuka folder putusan") ikut.
 * "Lihat sebagai akun": hanya admin; ?sebagaiPeran= meniru satu peran.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/shared/errors";

const bridge = vi.fn();
const rute = vi.hoisted(() => ({
  aktor: { id: "u1", name: "X", roleId: "hakim" } as Record<string, unknown>,
  hak: { ada: true, saklar: { hakimBas: false, ppPutusan: false }, folder: [] } as Record<string, unknown>,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({ queryAll: async () => [], queryOne: async () => null }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "u1" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => rute.aktor }));
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({ callAletaBotSippBridge: (...a: unknown[]) => bridge(...a) }));
vi.mock("@/server/modules/pengaturan-abt/service", () => ({ bacaHakBlangko: async () => rute.hak }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (e: unknown) => {
    const status = e instanceof ApiError ? e.status : 500;
    return new Response(JSON.stringify({ ok: false, alasan: String((e as Error)?.message || e) }), { status });
  },
}));

const nextReq = (q: string) => ({ nextUrl: new URL(`http://localhost/aleta/api/aleta-ecourt/blangko-derry${q}`) }) as never;
async function panggil(q: string) {
  const m = await import("@/app/api/aleta-ecourt/blangko-derry/route");
  m.lupakanSinggahan();
  const r = await m.GET(nextReq(q));
  return { status: r.status, isi: (await r.json()) as { ok: boolean; data?: any } };
}
const bacaFolder = (folder: string, tambah = "") => panggil(`?folder=${encodeURIComponent(folder)}&berkas=${encodeURIComponent("[01] A")}${tambah}`);

const FOLDER = { put: "1 Perceraian CG", bas: "1 Perceraian CG - BAS", rel: "98 Relaas", ptsp: "99 PTSP" } as const;
type J = keyof typeof FOLDER;
const AKUN: Record<string, { aktor: Record<string, unknown>; boleh: J[] }> = {
  hakim: { aktor: { roleId: "hakim" }, boleh: ["put"] },
  ketua: { aktor: { roleId: "ketua" }, boleh: ["put"] },
  "wakil ketua": { aktor: { roleId: "wakil-ketua" }, boleh: ["put"] },
  "panitera pengganti": { aktor: { roleId: "panitera-pengganti" }, boleh: ["bas"] },
  panitera: { aktor: { roleId: "panitera" }, boleh: ["bas"] },
  "panitera muda": { aktor: { roleId: "panitera-muda" }, boleh: ["bas"] },
  jurusita: { aktor: { roleId: "jurusita" }, boleh: ["rel"] },
  "jurusita pengganti": { aktor: { roleId: "pelaksana", positionId: "pos-jurusita-pengganti" }, boleh: ["rel"] },
  ptsp: { aktor: { roleId: "pelaksana", positionId: "pos-ptsp" }, boleh: ["ptsp"] },
  kasir: { aktor: { roleId: "analis-keuangan" }, boleh: [] },
  admin: { aktor: { roleId: "admin" }, boleh: ["put", "bas", "rel", "ptsp"] },
  "super admin": { aktor: { roleId: "super-admin" }, boleh: ["put", "bas", "rel", "ptsp"] },
};

describe("C6. hak dokumen blangko-derry di server, dari sesi", () => {
  beforeEach(() => {
    bridge.mockReset();
    bridge.mockImplementation(async (op: string) => {
      if (op === "blangko.baca") return { ok: true, data: { ada: true, berkas: "[01] A.rtf", penanda: [] } };
      if (op === "blangko.pohon") {
        return {
          ok: true,
          data: { ada: true, berkas: Object.values(FOLDER).map((f) => ({ jalur: `derry_briantono/${f}/[01] A.rtf` })) },
        };
      }
      return { ok: false, error: "tidak dikenal" };
    });
    rute.hak = { ada: true, saklar: { hakimBas: false, ppPutusan: false }, folder: [] };
  });

  for (const [nama, { aktor, boleh }] of Object.entries(AKUN)) {
    it(`${nama}: membaca blangko hanya jenis ${boleh.join("/") || "(tidak ada)"}`, async () => {
      rute.aktor = { id: "u1", name: nama, ...aktor };
      for (const j of Object.keys(FOLDER) as J[]) {
        bridge.mockClear();
        const r = await bacaFolder(FOLDER[j]);
        const harap = boleh.includes(j) ? 200 : 403;
        expect([nama, j, r.status]).toEqual([nama, j, harap]);
        // Ditolak = bot tidak pernah dimintai berkas.
        if (harap === 403) expect(bridge.mock.calls.filter((c) => c[0] === "blangko.baca")).toEqual([]);
      }
    });

    it(`${nama}: indeks folder hanya memuat jenis yang boleh`, async () => {
      rute.aktor = { id: "u1", name: nama, ...aktor };
      const r = await panggil("?indeks=1");
      expect(r.status).toBe(200);
      const jenis = (r.isi.data.folder as Array<{ jenis: string }>).map((f) => f.jenis).sort();
      expect(jenis).toEqual([...boleh].sort());
    });
  }

  it("folder dengan awalan akar (derry_briantono/98 Relaas) dinilai sama", async () => {
    rute.aktor = { id: "u1", name: "h", roleId: "hakim" };
    expect((await bacaFolder("derry_briantono/98 Relaas")).status).toBe(403);
    expect((await bacaFolder("derry_briantono/1 Perceraian CG")).status).toBe(200);
  });

  it("saklar Pengaturan SIPP & ABT: hakim boleh BAS bila 'hakimBas' menyala; PP boleh putusan bila 'ppPutusan'; relaas tidak pernah", async () => {
    rute.hak = { ada: true, saklar: { hakimBas: true, ppPutusan: true }, folder: [] };
    rute.aktor = { id: "u1", name: "h", roleId: "hakim" };
    expect((await bacaFolder(FOLDER.bas)).status).toBe(200);
    expect((await bacaFolder(FOLDER.rel)).status).toBe(403);
    rute.aktor = { id: "u1", name: "p", roleId: "panitera-pengganti" };
    expect((await bacaFolder(FOLDER.put)).status).toBe(200);
    expect((await bacaFolder(FOLDER.rel)).status).toBe(403);
  });

  it("hak menu tak terbaca: saklar dianggap mati (gagal-tertutup), peran dasar tetap jalan", async () => {
    rute.hak = { ada: false };
    rute.aktor = { id: "u1", name: "h", roleId: "hakim" };
    expect((await bacaFolder(FOLDER.bas)).status).toBe(403);
    expect((await bacaFolder(FOLDER.put)).status).toBe(200);
  });

  it("'Lihat sebagai akun': admin meniru satu peran lewat ?sebagaiPeran=; bukan admin: parameter diabaikan", async () => {
    rute.aktor = { id: "u1", name: "a", roleId: "super-admin" };
    expect((await bacaFolder(FOLDER.bas, "&sebagaiPeran=hakim")).status).toBe(403);
    expect((await bacaFolder(FOLDER.put, "&sebagaiPeran=hakim")).status).toBe(200);
    expect((await bacaFolder(FOLDER.rel, "&sebagaiPeran=pp")).status).toBe(403);
    expect((await bacaFolder(FOLDER.rel, "&sebagaiPeran=js")).status).toBe(200);
    expect((await bacaFolder(FOLDER.bas)).status).toBe(200);
    rute.aktor = { id: "u1", name: "h", roleId: "hakim" };
    expect((await bacaFolder(FOLDER.rel, "&sebagaiPeran=js")).status).toBe(403);
  });

  it("?hak=1 tetap terbuka bagi semua akun berkapabilitas panel (ekstensi memakainya sebelum memilih)", async () => {
    rute.aktor = { id: "u1", name: "k", roleId: "analis-keuangan" };
    const r = await panggil("?hak=1");
    expect(r.status).toBe(200);
    expect(r.isi.data.ada).toBe(true);
  });
});
