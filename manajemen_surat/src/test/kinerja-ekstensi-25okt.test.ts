// @vitest-environment node
/**
 * ============================================================================
 * SAKLAR KINERJA EKSTENSI (rantai B, 25 Okt 2026) - rute, hak, audit, dan ruas `kinerja` di tampilan
 * ============================================================================
 *   - tanpa pengaturan tersimpan SEMUA saklar mati;
 *   - siapa pun yang masuk boleh membaca, HANYA Super Admin yang mengubah (403 untuk Admin/hakim);
 *   - perubahan tercatat di audit dan masukan tidak sah ditolak tanpa menyimpan apa pun;
 *   - GET /ekstensi/tampilan memuat ruas `kinerja` (sumber ekstensi) dan tidak mengubah bentuk lainnya.
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SAKLAR_KINERJA_BAWAAN, bersihkanKinerja } from "@/lib/kinerja-ekstensi";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

type Hasil = { status: number; isi: any };
async function panggil(cara: "GET" | "PUT", badan?: unknown, rute: "kinerja" | "tampilan" = "kinerja"): Promise<Hasil> {
  const modul =
    rute === "kinerja"
      ? await import("@/app/api/aleta-ecourt/ekstensi/kinerja/route")
      : await import("@/app/api/aleta-ecourt/ekstensi/tampilan/route");
  const req = new NextRequest("http://localhost/api/x", {
    method: cara,
    headers: badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: badan !== undefined ? JSON.stringify(badan) : undefined,
  });
  const fungsi = (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara];
  const j = await fungsi(req);
  return { status: j.status, isi: await j.json() };
}

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-super";
});
afterEach(async () => {
  await db?.close();
  db = null;
});

describe("lib: pembersih saklar", () => {
  it("bawaan semua mati; hanya boolean true sejati yang menyalakan; kunci asing dibuang", () => {
    expect(SAKLAR_KINERJA_BAWAAN.pengamatTunggal).toBe(false);
    expect(bersihkanKinerja(null)).toEqual({ pengamatTunggal: false });
    expect(bersihkanKinerja({ pengamatTunggal: "true" })).toEqual({ pengamatTunggal: false });
    expect(bersihkanKinerja({ pengamatTunggal: 1, lain: true })).toEqual({ pengamatTunggal: false });
    expect(bersihkanKinerja({ pengamatTunggal: true, lain: true })).toEqual({ pengamatTunggal: true });
  });
});

describe("rute /ekstensi/kinerja", () => {
  it("tanpa sesi 401; siapa pun yang masuk dapat membaca, semuanya mati, bolehMengubah hanya Super Admin", async () => {
    aktor = null;
    expect((await panggil("GET")).status).toBe(401);
    for (const [siapa, boleh] of [
      ["usr-hakim", false],
      ["usr-admin", false],
      ["usr-super", true],
    ] as const) {
      aktor = siapa;
      const r = await panggil("GET");
      expect(r.status).toBe(200);
      expect(r.isi.data.saklar).toEqual({ pengamatTunggal: false });
      expect(r.isi.data.bolehMengubah).toBe(boleh);
      expect(r.isi.data.keterangan.pengamatTunggal.judul).toMatch(/Pengamat tunggal/);
    }
  });

  it("hanya Super Admin yang mengubah: Admin dan hakim 403 dan tidak ada yang tersimpan", async () => {
    for (const siapa of ["usr-admin", "usr-hakim"]) {
      aktor = siapa;
      expect((await panggil("PUT", { pengamatTunggal: true })).status).toBe(403);
    }
    aktor = "usr-super";
    expect((await panggil("GET")).isi.data.saklar).toEqual({ pengamatTunggal: false });
  });

  it("Super Admin menyalakan dan mematikan; tercatat di audit dengan sebelum dan sesudah", async () => {
    const hidup = await panggil("PUT", { pengamatTunggal: true });
    expect(hidup.status).toBe(200);
    expect(hidup.isi.data.saklar).toEqual({ pengamatTunggal: true });
    expect((await panggil("GET")).isi.data.saklar).toEqual({ pengamatTunggal: true });
    const mati = await panggil("PUT", { pengamatTunggal: false });
    expect(mati.isi.data.saklar).toEqual({ pengamatTunggal: false });
    const baris = await db!.prepare("SELECT actor_user_id, payload_json FROM audit_logs WHERE action = ? ORDER BY created_at ASC").all<any>("UPDATE_KINERJA_EKSTENSI");
    expect(baris).toHaveLength(2);
    expect(baris[0].actor_user_id).toBe("usr-super");
    expect(JSON.parse(baris[0].payload_json)).toEqual({ sebelum: { pengamatTunggal: false }, sesudah: { pengamatTunggal: true } });
  });

  it("masukan tidak sah ditolak 400 tanpa menyimpan: bukan obyek, bukan boolean", async () => {
    expect((await panggil("PUT", [true])).status).toBe(400);
    expect((await panggil("PUT", { pengamatTunggal: "ya" })).status).toBe(400);
    expect((await panggil("GET")).isi.data.saklar).toEqual({ pengamatTunggal: false });
    const n = await db!.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = ?").all<any>("UPDATE_KINERJA_EKSTENSI");
    expect(Number(n[0].n)).toBe(0);
  });
});

describe("GET /ekstensi/tampilan memuat ruas kinerja", () => {
  it("bawaan mati; sesudah Super Admin menyalakan, ekstensi pegawai biasa menerimanya", async () => {
    aktor = "usr-hakim";
    const awal = await panggil("GET", undefined, "tampilan");
    expect(awal.status).toBe(200);
    expect(awal.isi.data.kinerja).toEqual({ pengamatTunggal: false });
    expect(awal.isi.data.tampilan).toBeTruthy();
    expect(awal.isi.data.versi).toBeTruthy();
    aktor = "usr-super";
    await panggil("PUT", { pengamatTunggal: true });
    aktor = "usr-hakim";
    const kini = await panggil("GET", undefined, "tampilan");
    expect(kini.isi.data.kinerja).toEqual({ pengamatTunggal: true });
    // versi tampilan tidak bergeser karena saklar kinerja (layar tidak perlu digambar ulang)
    expect(kini.isi.data.versi).toBe(awal.isi.data.versi);
  });
});
