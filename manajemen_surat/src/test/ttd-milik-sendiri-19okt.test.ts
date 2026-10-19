// @vitest-environment node
/**
 * ============================================================================
 * 19 OKT 2026 - TANDA TANGAN SAH UNTUK CETAK PDF BLANGKO DERRY (SISI PORTAL)
 * ============================================================================
 *
 * Menu "Tambah tanda tangan ke PDF" di ekstensi dulu selalu berkata "belum ada tanda tangan tersimpan":
 *   - ekstensi mencari kunci `tandaTangan/daftar/data/items`, sedangkan bot menjawab `baris`;
 *   - rute /api/aleta-ecourt/tanda-tangan menuntut kapabilitas "blangko-abt", sehingga hakim dan panitera pengganti
 *     biasa ditolak 403 walau tanda tangan mereka sudah disahkan dan ditautkan ke akun.
 * Rute kini menjawab akun tanpa kapabilitas itu (hanyaSah=1) dengan baris sah MILIKNYA saja, dan gambar hanya yang miliknya.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/shared/errors";
import { barisTtdMilik, intiNamaTtd, namaTtdSama } from "@/lib/ttd-milik-sendiri";

const ID: { aktor: string } = { aktor: "u-hs" };
const akunTabel: Record<string, { id: string; name: string }> = {
  "u-hs": { id: "u-hs", name: "Hakim Satu, S.H." },
  "u-hd": { id: "u-hd", name: "Hakim Dua" },
};
const kapabilitas = { boleh: false };
const BARIS = [
  { id: 11, namaPejabat: "Hakim Satu, S.H., M.H.", disahkan: true, penggunaId: "u-hs", disahkanPada: "2026-10-19T01:00:00.000Z", jabatan: "Hakim" },
  { id: 12, namaPejabat: "Hakim Dua", disahkan: true, penggunaId: "u-hd", disahkanPada: "2026-10-19T01:00:00.000Z", jabatan: "Hakim" },
  { id: 13, namaPejabat: "Hakim Satu", disahkan: true, penggunaId: "u-lain", disahkanPada: "2026-10-19T05:00:00.000Z", jabatan: "" }, // nama sama tetapi tertaut akun LAIN
  { id: 14, namaPejabat: "Drs. H. Hakim Satu, S.H.", disahkan: true, penggunaId: "", disahkanPada: "2026-10-19T02:00:00.000Z", jabatan: "" }, // belum tertaut, nama sama (tanpa gelar)
  { id: 15, namaPejabat: "Hakim Satu", disahkan: false, penggunaId: "u-hs", disahkanPada: "" }, // belum sah
];

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => ID.aktor }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => {
    if (!kapabilitas.boleh) throw new ApiError(403, "Peran Anda tidak diberi akses.");
    return {};
  },
}));
vi.mock("@/server/modules/organization/service", () => ({
  getUserByIdFromDb: async (_db: unknown, id: string) => akunTabel[id] ?? null,
  getPositionsFromDb: async () => [],
}));
vi.mock("@/server/modules/users/service", () => ({ listUsersFromDb: async () => [] }));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayTandaTangan: async (hanyaSah = false) => ({ ok: true, baris: hanyaSah ? BARIS.filter((b) => b.disahkan) : BARIS }),
  ambilGambarTandaTangan: async () => new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { status: 200, headers: { "content-type": "image/png" } }),
  kirimTandaTanganHapus: async () => ({}),
  kirimTandaTanganNama: async () => ({}),
  kirimTandaTanganSahkan: async () => ({}),
  kirimTandaTanganTambah: async () => ({}),
  kirimTandaTanganTautkanAkun: async () => ({}),
}));
vi.mock("@/server/modules/aleta-ecourt/tautan-ttd", () => ({ tautanSaatUnggah: () => null, tautkanTtdOtomatis: async () => ({}) }));
vi.mock("@/server/shared/audit", () => ({ appendAuditLog: async () => undefined }));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "x-1" }));
vi.mock("@/server/modules/akses/hak-peran", () => ({ pastikanAksi: async () => undefined }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (error: { status?: number; message?: string }) => Response.json({ ok: false, pesan: error.message }, { status: error.status ?? 500 }),
}));

describe("barisTtdMilik: hanya baris SAH milik akun", () => {
  it("tautan akun (pengguna_id) dulu; baris belum tertaut dikenali lewat nama tanpa gelar; baris milik akun lain atau belum sah tidak ikut", () => {
    const milik = barisTtdMilik(BARIS, { id: "u-hs", name: "Hakim Satu, S.H." });
    expect(milik.map((b) => b.id).sort()).toEqual([11, 14]);
    expect(barisTtdMilik(BARIS, { id: "u-hd", name: "Hakim Dua" }).map((b) => b.id)).toEqual([12]);
    expect(barisTtdMilik(BARIS, { id: "", name: "" })).toEqual([]);
    expect(barisTtdMilik(BARIS, { id: "u-baru", name: "Orang Lain" })).toEqual([]);
  });

  it("normalisasi gelar dan tanda baca sama dengan penetapanEdocService.cocokkanTandaTangan", () => {
    expect(intiNamaTtd("Drs. H. Himawan Tatura Wijaya, S.H., M.H.")).toBe("himawantaturawijaya");
    expect(namaTtdSama("Himawan Tatura Wijaya, S.H.", "Drs. H. Himawan Tatura Wijaya, S.H., M.H.")).toBe(true);
    expect(namaTtdSama("H. Ali", "Ali")).toBe(false); // inti kurang dari 5 huruf: tidak ditebak
    expect(namaTtdSama("Qadariyah", "Qadariyah, S.H.")).toBe(true);
  });
});

describe("rute /api/aleta-ecourt/tanda-tangan (hanyaSah=1) untuk akun tanpa kapabilitas blangko-abt", () => {
  beforeEach(() => {
    kapabilitas.boleh = false;
    ID.aktor = "u-hs";
  });

  it("GET: hakim biasa menerima baris sah miliknya saja, tanpa daftar pengguna", async () => {
    const { GET } = await import("@/app/api/aleta-ecourt/tanda-tangan/route");
    const r = await GET(new NextRequest("http://localhost/api/aleta-ecourt/tanda-tangan?hanyaSah=1"));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { ok: boolean; baris: Array<{ id: number }>; pembatasan: string; pengguna: unknown[] };
    expect(j.ok).toBe(true);
    expect(j.pembatasan).toBe("milik-sendiri");
    expect(j.baris.map((b) => b.id).sort()).toEqual([11, 14]);
    expect(j.pengguna).toEqual([]);
  });

  it("GET tanpa hanyaSah=1: tetap 403 (layar pengesahan memerlukan kapabilitas)", async () => {
    const { GET } = await import("@/app/api/aleta-ecourt/tanda-tangan/route");
    const r = await GET(new NextRequest("http://localhost/api/aleta-ecourt/tanda-tangan"));
    expect(r.status).toBe(403);
  });

  it("GET: pemegang kapabilitas blangko-abt tetap menerima semua baris sah (jalur lama tidak berubah)", async () => {
    kapabilitas.boleh = true;
    const { GET } = await import("@/app/api/aleta-ecourt/tanda-tangan/route");
    const r = await GET(new NextRequest("http://localhost/api/aleta-ecourt/tanda-tangan?hanyaSah=1"));
    const j = (await r.json()) as { baris: Array<{ id: number }>; pembatasan?: string };
    expect(j.pembatasan).toBeUndefined();
    expect(j.baris.map((b) => b.id)).toEqual([11, 12, 13, 14]);
  });

  it("gambar: milik sendiri boleh; milik orang lain atau akun lain 403; pemegang kapabilitas boleh semua", async () => {
    const { GET } = await import("@/app/api/aleta-ecourt/tanda-tangan/[id]/gambar/route");
    const minta = (id: string) => GET(new NextRequest(`http://localhost/api/aleta-ecourt/tanda-tangan/${id}/gambar`), { params: Promise.resolve({ id }) });
    expect((await minta("11")).status).toBe(200);
    expect((await minta("14")).status).toBe(200);
    expect((await minta("12")).status).toBe(403); // milik Hakim Dua
    expect((await minta("13")).status).toBe(403); // tertaut ke akun lain
    expect((await minta("15")).status).toBe(403); // belum sah
    expect((await minta("abc")).status).toBe(403);
    kapabilitas.boleh = true;
    expect((await minta("12")).status).toBe(200);
  });
});

describe("sumber: /ekstensi/siapa membawa id akun; ekstensi membaca bentuk jawaban bot", () => {
  const baca = (jalur: string) => readFileSync(path.resolve(process.cwd(), jalur), "utf8").replace(/\r\n/g, "\n");
  it("id akun ikut di jawaban siapa; ekstensi memuat kunci 'baris' dan cocokkan tautan akun", () => {
    expect(baca("src/app/api/aleta-ecourt/ekstensi/siapa/route.ts")).toContain("id: actor.id,");
    const isian = baca("../ekstensi-sipp/blangko-derry-isian.js");
    expect(isian).toContain("[j.baris, j.data && j.data.baris,");
    expect(isian).toContain("b.penggunaId === String(akun.id)");
  });
});
