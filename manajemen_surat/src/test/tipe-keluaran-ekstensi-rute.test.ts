// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cerminDaftar } from "@/lib/tipe-keluaran/bawaan";
import { DAFTAR_EKSTENSI, type EntriCermin, type EntriTipe } from "@/lib/tipe-keluaran/kontrak";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { kapabilitasPengguna, simpanPengecualianPengguna } from "@/server/modules/aleta-ecourt/akses";
import { sahkan, usul } from "@/server/modules/aleta-ecourt/tipe-keluaran";

/**
 * ============================================================================
 * RUTE BACA EKSTENSI (K5) DAN versiTipe DI /ekstensi/siapa
 * ============================================================================
 *
 * Dijalankan lewat handler GET sungguhan atas pg-mem berbenih. Yang dijaga:
 *   - bentuk jawabannya PERSIS K5: {ok, versi (16 hex), dibuatPada (ISO),
 *     daftar} dengan tepat empat daftar ekstensi, tiap entri tepat enam ruas;
 *   - versi sama untuk isi sama, dan berubah bila satu entri disahkan;
 *   - tabel kosong: isinya deep-equal cermin bawaan ekstensi;
 *   - tabel tak terbaca: 503 {ok:false, alasan:'basis_data_tidak_terbaca'} -
 *     BUKAN 200 berisi cermin, yang akan menimpa singgahan ekstensi;
 *   - /ekstensi/siapa membawa versiTipe yang SAMA dengan versi rute di atas,
 *     dan null (bukan galat) bila tabel tak terbaca.
 */

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-admin";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-admin";
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db?.close();
  db = null;
});

const d = () => db as AletaDatabase;

async function tipe() {
  const { GET } = await import("@/app/api/aleta-ecourt/ekstensi/tipe-keluaran/route");
  const jawaban = await GET(new NextRequest("http://localhost/api/aleta-ecourt/ekstensi/tipe-keluaran"));
  return { status: jawaban.status, isi: (await jawaban.json()) as Record<string, unknown> };
}

async function siapa() {
  const { GET } = await import("@/app/api/aleta-ecourt/ekstensi/siapa/route");
  const jawaban = await GET(new NextRequest("http://localhost/api/aleta-ecourt/ekstensi/siapa"));
  return { status: jawaban.status, isi: (await jawaban.json()) as { ok: boolean; data: Record<string, unknown> } };
}

function inti(e: EntriTipe | EntriCermin) {
  return { kunci: e.kunci, nilai: e.nilai, data: e.data ?? {}, urutan: e.urutan };
}

/** Membuat tabel tipe keluaran tak terbaca: setiap kueri ke aleta_tipe_keluaran melempar. */
function rusakkanTabel(basis: AletaDatabase) {
  const galat = () => Promise.reject(new Error('relation "aleta_tipe_keluaran" does not exist'));
  for (const nama of ["queryAll", "queryOne", "run"] as const) {
    const asli = basis[nama].bind(basis) as (...a: unknown[]) => Promise<unknown>;
    vi.spyOn(basis, nama).mockImplementation(((sql: string, ...sisa: unknown[]) =>
      /aleta_tipe_keluaran/.test(String(sql)) ? galat() : asli(sql, ...sisa)) as never);
  }
}

// ============================================================================
describe("GET /api/aleta-ecourt/ekstensi/tipe-keluaran (K5)", () => {
  it("berbentuk K5 persis: empat daftar ekstensi, versi 16 hex, dibuatPada ISO, entri enam ruas", async () => {
    const r = await tipe();
    expect(r.status).toBe(200);
    expect(Object.keys(r.isi).sort()).toEqual(["daftar", "dibuatPada", "ok", "versi"]);
    expect(r.isi.ok).toBe(true);
    expect(r.isi.versi).toMatch(/^[0-9a-f]{16}$/);
    expect(new Date(String(r.isi.dibuatPada)).toISOString()).toBe(r.isi.dibuatPada);
    const daftar = r.isi.daftar as Record<string, EntriTipe[]>;
    expect(Object.keys(daftar)).toEqual([...DAFTAR_EKSTENSI]);
    for (const [nama, entri] of Object.entries(daftar)) {
      expect(entri.length, nama).toBeGreaterThan(0);
      for (const e of entri) expect(Object.keys(e).sort(), nama).toEqual(["asal", "data", "kunci", "nilai", "sidik", "urutan"]);
    }
  });

  it("tabel kosong: isi deep-equal cermin bawaan ekstensi, seluruhnya asal 'bawaan'", async () => {
    expect(Number((await d().queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran"))?.n)).toBe(0);
    const r = await tipe();
    expect(r.status).toBe(200);
    const daftar = r.isi.daftar as Record<string, EntriTipe[]>;
    for (const nama of DAFTAR_EKSTENSI) {
      expect(daftar[nama].map(inti), nama).toEqual(cerminDaftar(nama)!.map(inti));
      expect(new Set(daftar[nama].map((e) => e.asal)), nama).toEqual(new Set(["bawaan"]));
    }
  });

  it("versi sama untuk isi sama; berubah bila satu entri disahkan, dan entri itu ikut terkirim", async () => {
    const a = await tipe();
    const b = await tipe();
    expect(b.isi.versi).toBe(a.isi.versi);
    expect(b.isi.dibuatPada).not.toBeUndefined();

    const u = await usul(d(), "usr-admin", {
      daftar: "putusan.medan-borang",
      kunci: "putusan-akhir",
      nilai: "Status Banding",
      data: { penunjuk: 'select[name="status_banding"]' },
    });
    if (!u.ok) throw new Error(u.alasan.join("; "));
    // Usulan belum berlaku: versi tidak berubah.
    expect((await tipe()).isi.versi).toBe(a.isi.versi);

    const s = await sahkan(d(), "usr-super", { id: u.butir.id, atasPerintah: "usr-ketua" });
    expect(s.ok).toBe(true);
    const c = await tipe();
    expect(c.isi.versi).toMatch(/^[0-9a-f]{16}$/);
    expect(c.isi.versi).not.toBe(a.isi.versi);
    const medan = (c.isi.daftar as Record<string, EntriTipe[]>)["putusan.medan-borang"];
    expect(medan.at(-1)).toMatchObject({ nilai: "Status Banding", asal: "tambahan" });
  });

  it("tabel tak terbaca: 503 {ok:false, alasan:'basis_data_tidak_terbaca'}", async () => {
    await tipe(); // benih tertanam lebih dulu, lalu tabelnya "rusak"
    rusakkanTabel(d());
    const galatKonsol = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await tipe();
    expect(r.status).toBe(503);
    expect(r.isi).toEqual({ ok: false, alasan: "basis_data_tidak_terbaca" });
    // Tidak diam: tercatat di log peladen.
    expect(galatKonsol).toHaveBeenCalled();
  });

  it("tanpa pengguna 401; pengguna tanpa kemampuan 'panel' 403", async () => {
    aktor = null;
    expect((await tipe()).status).toBe(401);

    // Pengecualian SUNGGUHAN lewat jalur yang dipakai layar akses: kemampuan
    // 'panel' dicabut dari satu panitera.
    await simpanPengecualianPengguna(d(), {
      actorUserId: "usr-super",
      userId: "usr-panitera",
      kapabilitas: "panel",
      aktif: false,
      alasan: "uji penjagaan rute ekstensi",
    });
    const tanpaPanel = "usr-panitera";
    expect((await kapabilitasPengguna(d(), { id: tanpaPanel, roleId: "panitera", additionalRoleIds: [] })).panel).toBe(false);
    aktor = tanpaPanel;
    expect((await tipe()).status).toBe(403);
  });
});

// ============================================================================
describe("GET /api/aleta-ecourt/ekstensi/siapa memuat versiTipe (K5)", () => {
  it("versiTipe 16 hex dan SAMA dengan versi rute tipe keluaran; ikut berubah bila satu entri disahkan", async () => {
    const s1 = await siapa();
    expect(s1.status).toBe(200);
    expect(s1.isi.data.versiTipe).toMatch(/^[0-9a-f]{16}$/);
    expect(s1.isi.data.versiTipe).toBe((await tipe()).isi.versi);

    const u = await usul(d(), "usr-admin", {
      daftar: "putusan.medan-borang",
      kunci: "putusan-akhir",
      nilai: "Status Banding",
      data: { penunjuk: 'select[name="status_banding"]' },
    });
    if (!u.ok) throw new Error(u.alasan.join("; "));
    await sahkan(d(), "usr-super", { id: u.butir.id, atasPerintah: "usr-ketua" });
    const s2 = await siapa();
    expect(s2.isi.data.versiTipe).not.toBe(s1.isi.data.versiTipe);
    expect(s2.isi.data.versiTipe).toBe((await tipe()).isi.versi);
  });

  it("tabel tak terbaca: siapa tetap 200 dengan versiTipe null, dan galatnya tercatat", async () => {
    await siapa();
    rusakkanTabel(d());
    const galatKonsol = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const s = await siapa();
    expect(s.status).toBe(200);
    expect(s.isi.data).toHaveProperty("versiTipe", null);
    expect(s.isi.data.kapabilitas).toBeTruthy();
    expect(galatKonsol.mock.calls.some((c) => String(c[0]).includes("versiTipe null"))).toBe(true);
  });
});
