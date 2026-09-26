// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { pastikanBenih } from "@/server/modules/aleta-ecourt/tipe-keluaran";

/**
 * ============================================================================
 * RUTE ADMIN TIPE KELUARAN (K4) - DIJALANKAN SUNGGUHAN DI pg-mem
 * ============================================================================
 *
 * Rutenya dipanggil lewat handler GET/POST yang sesungguhnya, dengan basis
 * data pg-mem berbenih dan pengguna benih (usr-super, usr-admin, usr-panitera,
 * usr-hakim). Yang dipalsukan hanya dua hal: basis data mana yang dipakai
 * getDatabase, dan siapa pemanggilnya.
 *
 * Yang dijaga:
 *   - kewenangan di pintu rute: non-admin 403, admin usul 200, admin sahkan
 *     403, super-admin sahkan tanpa atas perintah 400;
 *   - tolak/matikan tanpa alasan 400;
 *   - SETIAP tindakan sukses lewat rute menambah TEPAT 1 riwayat dan 1 audit;
 *   - tidak ada DELETE (juga PUT/PATCH) - Next menjawab 405 untuk metode yang
 *     tidak diekspor;
 *   - bentuk jawaban GET dan penolakan isi (400 {ok:false, alasan:[...]}).
 */

let db: AletaDatabase | null = null;
let aktor: string | null = null;

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  // Benih ditanam lebih dulu: tindakan pertama pada basis data baru ikut
  // menanam benih (ratusan riwayat 'benih'), dan itu bukan jejak tindakannya.
  await pastikanBenih(db);
});

afterEach(async () => {
  await db?.close();
  db = null;
  aktor = null;
});

const d = () => db as AletaDatabase;

async function rute() {
  return import("@/app/api/aleta-ecourt/tipe-keluaran/route");
}

async function get(siapa: string | null, golongan: string) {
  aktor = siapa;
  const { GET } = await rute();
  const jawaban = await GET(new NextRequest(`http://localhost/api/aleta-ecourt/tipe-keluaran?golongan=${golongan}`));
  return { status: jawaban.status, isi: (await jawaban.json()) as Record<string, unknown> };
}

async function post(siapa: string | null, badan: unknown) {
  aktor = siapa;
  const { POST } = await rute();
  const jawaban = await POST(
    new NextRequest("http://localhost/api/aleta-ecourt/tipe-keluaran", {
      method: "POST",
      body: typeof badan === "string" ? badan : JSON.stringify(badan),
      headers: { "content-type": "application/json" },
    })
  );
  return { status: jawaban.status, isi: (await jawaban.json()) as Record<string, unknown> & { butir?: { id: string } } };
}

async function hitung(sql: string) {
  const baris = await d().queryOne<{ n: string | number }>(sql);
  return Number(baris?.n ?? 0);
}

async function jejak() {
  return {
    riwayat: await hitung("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran_riwayat"),
    audit: await hitung("SELECT COUNT(*) AS n FROM audit_logs WHERE action LIKE 'TIPE_KELUARAN_%'"),
    semuaAudit: await hitung("SELECT COUNT(*) AS n FROM audit_logs"),
  };
}

/** Menjalankan satu POST dan mengembalikan jawabannya beserta selisih jejak. */
async function denganJejak(siapa: string, badan: unknown) {
  const sebelum = await jejak();
  const r = await post(siapa, badan);
  const sesudah = await jejak();
  return {
    ...r,
    riwayat: sesudah.riwayat - sebelum.riwayat,
    audit: sesudah.audit - sebelum.audit,
    semuaAudit: sesudah.semuaAudit - sebelum.semuaAudit,
  };
}

async function idBawaan(daftar: string, nilai: string) {
  const baris = await d().queryOne<{ id: string }>(
    "SELECT id FROM aleta_tipe_keluaran WHERE daftar = ? AND asal = 'bawaan' AND nilai = ?",
    [daftar, nilai]
  );
  expect(baris?.id).toBeTruthy();
  return baris!.id;
}

const USUL_KEHADIRAN = { tindakan: "usul", daftar: "bas.kehadiran.bunyi", nilai: "hadir melalui telekonferensi", alasan: "sidang daring" };

// ============================================================================
describe("kewenangan di pintu rute (K4, K13)", () => {
  it("non-admin 403 untuk GET dan POST; tanpa pengguna 401", async () => {
    expect((await get("usr-panitera", "bas")).status).toBe(403);
    expect((await post("usr-panitera", USUL_KEHADIRAN)).status).toBe(403);
    expect((await post("usr-hakim", USUL_KEHADIRAN)).status).toBe(403);
    expect((await get(null, "bas")).status).toBe(401);
    expect((await post(null, USUL_KEHADIRAN)).status).toBe(401);
    // Penolakan tidak meninggalkan butir apa pun.
    expect(await hitung("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran WHERE asal = 'tambahan'")).toBe(0);
  });

  it("admin usul 200 (+1 riwayat, +1 audit); admin sahkan 403; super-admin sahkan tanpa atas perintah 400", async () => {
    const u = await denganJejak("usr-admin", USUL_KEHADIRAN);
    expect(u.status).toBe(200);
    expect(u.isi).toMatchObject({ ok: true, butir: { asal: "tambahan", keadaan: "usulan", versi: 1 } });
    expect([u.riwayat, u.audit, u.semuaAudit]).toEqual([1, 1, 1]);
    const id = u.isi.butir!.id;

    const a = await post("usr-admin", { tindakan: "sahkan", id, atasPerintah: "usr-hakim" });
    expect(a.status).toBe(403);
    const tanpa = await post("usr-super", { tindakan: "sahkan", id });
    expect(tanpa.status).toBe(400);
    expect(JSON.stringify(tanpa.isi)).toMatch(/Atas perintah/);
    // Kalimat BAS: atas perintah panitera ditolak.
    expect((await post("usr-super", { tindakan: "sahkan", id, atasPerintah: "usr-panitera" })).status).toBe(400);

    const s = await denganJejak("usr-super", { tindakan: "sahkan", id, atasPerintah: "usr-hakim" });
    expect(s.status).toBe(200);
    expect(s.isi).toMatchObject({ ok: true, butir: { keadaan: "disahkan", atasPerintah: "usr-hakim", berlaku: true } });
    expect([s.riwayat, s.audit, s.semuaAudit]).toEqual([1, 1, 1]);
  });

  it("tolak dan matikan tanpa alasan 400 dan tidak meninggalkan jejak", async () => {
    const u = await post("usr-admin", USUL_KEHADIRAN);
    const idReskom = await idBawaan("putusan.medan-borang", "Hasil Reskom");
    for (const badan of [
      { tindakan: "tolak", id: u.isi.butir!.id },
      { tindakan: "tolak", id: u.isi.butir!.id, alasan: "   " },
      { tindakan: "matikan", id: idReskom },
      { tindakan: "nyalakan", id: idReskom },
    ]) {
      const r = await denganJejak("usr-admin", badan);
      expect(r.status, JSON.stringify(badan)).toBe(400);
      expect([r.riwayat, r.audit], JSON.stringify(badan)).toEqual([0, 0]);
    }
  });

  it("setiap tindakan sukses (usul, sahkan, tolak, matikan, nyalakan, ganti) = TEPAT 1 riwayat dan 1 audit", async () => {
    const hasil: Record<string, number[]> = {};
    const catat = (nama: string, r: { status: number; riwayat: number; audit: number; semuaAudit: number }) => {
      expect(r.status, nama).toBe(200);
      hasil[nama] = [r.riwayat, r.audit, r.semuaAudit];
    };

    const u1 = await denganJejak("usr-admin", USUL_KEHADIRAN);
    catat("usul", u1);
    catat("sahkan", await denganJejak("usr-super", { tindakan: "sahkan", id: u1.isi.butir!.id, atasPerintah: "usr-hakim" }));

    const u2 = await post("usr-admin", {
      tindakan: "usul",
      daftar: "putusan.medan-borang",
      kunci: "putusan-akhir",
      nilai: "Status Banding",
      data: { penunjuk: 'select[name="status_banding"]' },
    });
    expect(u2.status).toBe(200);
    catat("tolak", await denganJejak("usr-admin", { tindakan: "tolak", id: u2.isi.butir!.id, alasan: "medan ini tidak ada di borang SIPP" }));

    const idReskom = await idBawaan("putusan.medan-borang", "Hasil Reskom");
    catat("matikan", await denganJejak("usr-admin", { tindakan: "matikan", id: idReskom, alasan: "reskom tidak dipakai satker" }));
    catat("nyalakan", await denganJejak("usr-admin", { tindakan: "nyalakan", id: idReskom, alasan: "dipakai lagi" }));
    const g = await denganJejak("usr-admin", {
      tindakan: "ganti",
      id: idReskom,
      nilai: "Hasil Restoratif",
      data: { penunjuk: 'select[name="status_reskom"]' },
      alasan: "istilah baru",
    });
    catat("ganti", g);
    expect(g.isi).toMatchObject({ ok: true, butir: { keadaan: "usulan", versi: 2, menggantikanId: idReskom } });

    expect(hasil).toEqual({
      usul: [1, 1, 1],
      sahkan: [1, 1, 1],
      tolak: [1, 1, 1],
      matikan: [1, 1, 1],
      nyalakan: [1, 1, 1],
      ganti: [1, 1, 1],
    });
  });
});

// ============================================================================
describe("tidak ada DELETE (K4)", () => {
  it("rute hanya mengekspor GET dan POST - DELETE, PUT, PATCH tidak ada, jadi Next menjawab 405", async () => {
    const modul = (await rute()) as Record<string, unknown>;
    const metode = Object.keys(modul).filter((k) => /^[A-Z]+$/.test(k) && typeof modul[k] === "function");
    expect(metode.sort()).toEqual(["GET", "POST"]);
    expect(modul.DELETE).toBeUndefined();
  });

  it("tindakan 'hapus' lewat POST ditolak 400, bukan dijalankan", async () => {
    const u = await post("usr-admin", USUL_KEHADIRAN);
    const r = await denganJejak("usr-super", { tindakan: "hapus", id: u.isi.butir!.id });
    expect(r.status).toBe(400);
    expect([r.riwayat, r.audit]).toEqual([0, 0]);
    expect(await hitung("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran WHERE asal = 'tambahan'")).toBe(1);
  });
});

// ============================================================================
describe("bentuk jawaban", () => {
  it("GET ?golongan=putusan berbentuk K4; bawaan terkunci ditandai asal 'bawaan'; golongan ngawur 400", async () => {
    const r = await get("usr-admin", "putusan");
    expect(r.status).toBe(200);
    expect(r.isi.ok).toBe(true);
    const daftar = r.isi.daftar as Array<Record<string, unknown> & { butir: Array<Record<string, unknown>> }>;
    expect(daftar.every((x) => x.golongan === "putusan")).toBe(true);
    const medan = daftar.find((x) => x.daftar === "putusan.medan-borang")!;
    expect(medan).toMatchObject({ jenis: "tulis", dapatDitambah: true });
    expect(typeof medan.judul).toBe("string");
    const kunciButir = ["id", "kunci", "nilai", "data", "asal", "keadaan", "aktif", "urutan", "versi", "alasan", "hasilUkur", "dibuatOleh", "disahkanOleh", "atasPerintah", "riwayat"];
    for (const b of medan.butir) for (const k of kunciButir) expect(b, k).toHaveProperty(k);
    expect(medan.butir.length).toBeGreaterThan(0);
    expect(medan.butir.every((b) => b.asal === "bawaan")).toBe(true);
    expect(daftar.find((x) => x.daftar === "putusan.alasan.ciri")).toMatchObject({ jenis: "deteksi", butuhUkur: true });

    expect((await get("usr-admin", "ngawur")).status).toBe(400);
  });

  it("usul berisi kalimat tidak sah: 400 {ok:false, alasan:[...]} tanpa jejak; badan bukan JSON 400", async () => {
    const r = await denganJejak("usr-admin", { tindakan: "usul", daftar: "bas.kehadiran.bunyi", nilai: "hadir ${x}" });
    expect(r.status).toBe(400);
    expect(r.isi.ok).toBe(false);
    expect(Array.isArray(r.isi.alasan)).toBe(true);
    expect((r.isi.alasan as string[]).length).toBeGreaterThan(0);
    expect([r.riwayat, r.audit]).toEqual([0, 0]);

    expect((await post("usr-admin", "{bukan json")).status).toBe(400);
    expect((await post("usr-admin", { tindakan: "usul", daftar: "daftar.ngawur", nilai: "x" })).status).toBe(400);
  });
});
