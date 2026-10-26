// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { FITUR_LIHAT_SEBAGAI } from "@/lib/fitur-satker";
import { portalApps } from "@/lib/mock-data";
import { aplikasiTampil, bolehAksi } from "@/lib/matriks-peran";
import { createAletaDatabase } from "@/server/db/client";
import { simpanPengaturanFitur } from "@/server/modules/satker/fitur";
import {
  BATAS_CATATAN,
  RETENSI_CATATAN_HARI,
  akhiriLihatSebagai,
  bacaCatatanDilihat,
  bersihkanAlasan,
  lihatSesiBerjalan,
  mulaiLihatSebagai,
  sesiLihatAktif,
} from "@/server/modules/lihat-sebagai/layanan";

/**
 * ============================================================================
 * LIHAT SEBAGAI (E4, 25 Okt 2026)
 * ============================================================================
 *
 *   1. alasan wajib 10-300 huruf; tanpa target ditolak; tak bisa sebagai diri sendiri
 *   2. penjelasan menu SAMA dengan aplikasiTampil (kenyataan), untuk akun dan peran
 *   3. sesi 30 menit lalu berakhir sendiri; akhiri tercatat; audit mulai/akhir
 *   4. pemilik akun membaca catatan "dilihat oleh"; batas jumlah dan retensi
 *   5. rute: hanya Super Admin (Admin pun ditolak), catatan hanya milik sendiri
 */

const ctx = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => ctx.db,
}));
vi.mock("@/lib/auth", () => ({
  getAuth: async () => {
    throw new Error("tanpa Better Auth di uji");
  },
}));

const KINI = new Date("2026-10-26T01:00:00.000Z");
const menitKe = (m: number) => new Date(KINI.getTime() + m * 60_000);
const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(`http://localhost${url}`, init);
const SA = { id: "u-sa", nama: "Nama u-sa" };

async function dbBaru() {
  const db = await createAletaDatabase({ useInMemory: true, seed: false });
  const kini = KINI.toISOString();
  for (const r of ["hakim", "admin", "super-admin", "pelaksana"]) await db.run(`INSERT INTO roles (id, name, description) VALUES (?, ?, '')`, [r, r]);
  await db.run(`INSERT INTO positions (id, name, unit_kerja, level_hierarchy, created_at, updated_at) VALUES ('pos-uji', 'Uji', 'Uji', 1, ?, ?)`, [kini, kini]);
  for (const [id, peran] of [
    ["u-hakim", "hakim"],
    ["u-admin", "admin"],
    ["u-sa", "super-admin"],
    ["u-staf", "pelaksana"],
  ]) {
    await db.run(
      `INSERT INTO users (id, username, password_hash, name, email, whatsapp_number, role_id, position_id, created_at, updated_at) VALUES (?, ?, 'x', ?, ?, '', ?, 'pos-uji', ?, ?)`,
      [id, id, `Nama ${id}`, `${id}@rekaan.test`, peran, kini, kini]
    );
  }
  return db;
}

// Satu basis data untuk semua uji (membuatnya mahal); keadaan dikosongkan sebelum tiap uji.
beforeAll(async () => {
  ctx.db = await dbBaru();
}, 300_000);

beforeEach(async () => {
  await db().run("DELETE FROM aleta_ekstensi_setelan");
  await db().run("DELETE FROM audit_logs");
  await db().run("DELETE FROM module_visibility_settings");
  await db().run("UPDATE users SET deleted_at = NULL");
});

const db = () => ctx.db as Awaited<ReturnType<typeof dbBaru>>;

describe("alasan dan target", () => {
  it("alasan wajib 10-300 huruf; tanda < > dibuang dan spasi dirapatkan", () => {
    expect(() => bersihkanAlasan("")).toThrow(/Alasan wajib/);
    expect(() => bersihkanAlasan("pendek")).toThrow(/10 huruf/);
    expect(() => bersihkanAlasan("x".repeat(301))).toThrow(/300 huruf/);
    expect(bersihkanAlasan("  menu   <b>hilang</b> di hakim ")).toBe("menu bhilang/b di hakim");
  });

  it("tanpa target, target tak ada, dan diri sendiri ditolak; tidak ada sesi tersimpan", async () => {
    await expect(mulaiLihatSebagai(db(), SA, { alasan: "memeriksa menu hakim" }, KINI)).rejects.toThrow(/Pilih akun atau peran/);
    await expect(mulaiLihatSebagai(db(), SA, { userId: "u-tidak-ada", alasan: "memeriksa menu hakim" }, KINI)).rejects.toThrow(/tidak ditemukan/);
    await expect(mulaiLihatSebagai(db(), SA, { roleId: "peran-gaib", alasan: "memeriksa menu hakim" }, KINI)).rejects.toThrow(/tidak ditemukan/);
    await expect(mulaiLihatSebagai(db(), SA, { userId: "u-sa", alasan: "memeriksa menu hakim" }, KINI)).rejects.toThrow(/diri sendiri/);
    await expect(mulaiLihatSebagai(db(), SA, { userId: "u-hakim", alasan: "pendek" }, KINI)).rejects.toThrow(/10 huruf/);
    expect(await sesiLihatAktif(db(), SA.id, KINI)).toBeNull();
  });
});

describe("penjelasan menu = kenyataan", () => {
  it("untuk akun: tiap aplikasi tampil persis seperti aplikasiTampil, dan tiap baris punya penjelasan", async () => {
    for (const id of ["u-hakim", "u-admin", "u-staf"]) {
      const h = await mulaiLihatSebagai(db(), SA, { userId: id, alasan: "memeriksa menu pengguna" }, KINI);
      expect(h.menu).toHaveLength(portalApps.length);
      for (const m of h.menu) {
        expect(m.penjelasan.length).toBeGreaterThan(10);
        expect(m.tampil, `${id} / ${m.appId}`).toBe(aplikasiTampil({ id, roleId: h.sesi.roleId, positionId: "pos-uji" }, m.appId, null));
      }
      expect(h.golongan.length).toBeGreaterThan(0);
    }
  });

  it("Admin tidak melihat aplikasi khusus Super Admin dan penjelasannya menyebut itu", async () => {
    const h = await mulaiLihatSebagai(db(), SA, { userId: "u-admin", alasan: "memeriksa menu admin" }, KINI);
    const khusus = h.menu.filter((m) => m.sebab === "hanya-super-admin");
    expect(khusus.length).toBeGreaterThan(0);
    for (const m of khusus) {
      expect(m.tampil).toBe(false);
      expect(m.penjelasan).toMatch(/Hanya Super Admin/);
    }
  });

  it("Akses Menu yang menutup sebuah aplikasi tampil sebagai sebab akses-menu-tutup dan menyembunyikannya", async () => {
    // Aplikasi yang matriks izinkan bagi staf: e-Court (hak R semua golongan).
    const awal = await mulaiLihatSebagai(db(), SA, { userId: "u-staf", alasan: "memeriksa menu staf" }, KINI);
    const ecourt = awal.menu.find((m) => m.appId === "aleta-ecourt");
    expect(ecourt?.tampil).toBe(true);
    await db().run(`INSERT INTO module_visibility_settings (role_id, module_id, enabled, updated_at) VALUES ('pelaksana', 'tutup:aleta-ecourt', 1, ?)`, [KINI.toISOString()]);
    const sesudah = await lihatSesiBerjalan(db(), SA.id, KINI);
    const e2 = sesudah?.menu.find((m) => m.appId === "aleta-ecourt");
    expect(e2).toMatchObject({ tampil: false, sebab: "akses-menu-tutup" });
  });

  it("untuk peran: dihitung tanpa jabatan, tidak menulis catatan ke siapa pun", async () => {
    const h = await mulaiLihatSebagai(db(), SA, { roleId: "hakim", alasan: "memeriksa peran hakim" }, KINI);
    expect(h.sesi).toMatchObject({ jenis: "peran", roleId: "hakim", userId: "" });
    expect(h.menu.length).toBe(portalApps.length);
    expect(await bacaCatatanDilihat(db(), "u-hakim", KINI)).toEqual([]);
  });
});

describe("sesi 30 menit dan audit", () => {
  it("berlaku 30 menit, sisa menit turun, lalu berakhir sendiri dan hilang", async () => {
    const h = await mulaiLihatSebagai(db(), SA, { userId: "u-hakim", alasan: "memeriksa menu hakim" }, KINI);
    expect(h.sisaMenit).toBe(30);
    expect((await lihatSesiBerjalan(db(), SA.id, menitKe(10)))?.sisaMenit).toBe(20);
    expect(await sesiLihatAktif(db(), SA.id, menitKe(29))).not.toBeNull();
    expect(await sesiLihatAktif(db(), SA.id, menitKe(30))).toBeNull();
    // Sudah dihapus: bahkan "mundur" waktu tidak menghidupkannya lagi.
    expect(await sesiLihatAktif(db(), SA.id, menitKe(1))).toBeNull();
  });

  it("mulai dan akhiri tercatat di audit_logs; akhiri tanpa sesi = false", async () => {
    await mulaiLihatSebagai(db(), SA, { userId: "u-hakim", alasan: "memeriksa menu hakim" }, KINI);
    expect(await akhiriLihatSebagai(db(), SA, menitKe(5))).toBe(true);
    expect(await akhiriLihatSebagai(db(), SA, menitKe(6))).toBe(false);
    const aksi = await db().queryAll<{ action: string; entity_id: string }>(`SELECT action, entity_id FROM audit_logs WHERE action LIKE 'LIHAT_SEBAGAI_%' ORDER BY action`);
    expect(aksi.map((a) => a.action)).toEqual(["LIHAT_SEBAGAI_AKHIR", "LIHAT_SEBAGAI_MULAI"]);
    expect(aksi.every((a) => a.entity_id === "u-hakim")).toBe(true);
  });

  it("akun yang dihapus di tengah sesi: sesi dilepas, bukan galat", async () => {
    await mulaiLihatSebagai(db(), SA, { userId: "u-staf", alasan: "memeriksa menu staf" }, KINI);
    await db().run(`UPDATE users SET deleted_at = ? WHERE id = 'u-staf'`, [KINI.toISOString()]);
    expect(await lihatSesiBerjalan(db(), SA.id, menitKe(1))).toBeNull();
  });
});

describe("catatan untuk pemilik akun", () => {
  it("pemilik membaca siapa, kapan, dan alasannya; akun lain tidak melihat apa-apa", async () => {
    await mulaiLihatSebagai(db(), SA, { userId: "u-hakim", alasan: "hakim melapor menu jadwal hilang" }, KINI);
    const c = await bacaCatatanDilihat(db(), "u-hakim", menitKe(1));
    expect(c).toEqual([{ oleh: "Nama u-sa", pada: KINI.toISOString(), alasan: "hakim melapor menu jadwal hilang" }]);
    expect(await bacaCatatanDilihat(db(), "u-staf", menitKe(1))).toEqual([]);
  });

  it("paling banyak 20 terakhir (terbaru dulu) dan yang lebih tua dari 180 hari tidak ditampilkan", async () => {
    for (let i = 0; i < BATAS_CATATAN + 3; i++) {
      await mulaiLihatSebagai(db(), SA, { userId: "u-hakim", alasan: `pemeriksaan nomor ${i} atas menu` }, menitKe(i));
    }
    const c = await bacaCatatanDilihat(db(), "u-hakim", menitKe(100));
    expect(c).toHaveLength(BATAS_CATATAN);
    expect(c[0].alasan).toContain(`nomor ${BATAS_CATATAN + 2} `);
    const jauh = new Date(KINI.getTime() + (RETENSI_CATATAN_HARI + 1) * 86_400_000);
    expect(await bacaCatatanDilihat(db(), "u-hakim", jauh)).toEqual([]);
  });
});

describe("hak dan rute", () => {
  it("hanya Super Admin: Admin pun tidak punya aksi lihat-sebagai.pakai", () => {
    expect(bolehAksi({ id: "a", roleId: "super-admin", positionId: "pos-uji" }, "lihat-sebagai.pakai")).toBe(true);
    expect(bolehAksi({ id: "a", roleId: "admin", positionId: "pos-uji" }, "lihat-sebagai.pakai")).toBe(false);
    expect(bolehAksi({ id: "a", roleId: "hakim", positionId: "pos-uji" }, "lihat-sebagai.pakai")).toBe(false);
  });

  const nyalakanSaklar = async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
    try {
      await simpanPengaturanFitur(db(), { id: "u-sa", name: "Nama u-sa" }, { fitur: { [FITUR_LIHAT_SEBAGAI]: "stabil" } });
    } finally {
      vi.unstubAllGlobals();
    }
  };

  it("saklar Fitur Satker MATI bawaan: semua metode rute menolak Super Admin pun (403), tidak ada sesi tersimpan; catatan lama tetap terbaca", async () => {
    const rute = await import("@/app/api/admin/lihat-sebagai/route");
    const dari = (id: string, metode: string, badan?: unknown) =>
      req("/api/admin/lihat-sebagai", { method: metode, headers: { "x-aleta-user-id": id, "content-type": "application/json" }, body: badan ? JSON.stringify(badan) : undefined });
    // sesi lama (dibuat langsung lewat layanan, seperti catatan dari masa saklar menyala)
    await mulaiLihatSebagai(db(), SA, { userId: "u-hakim", alasan: "memeriksa menu hakim sebelum dimatikan" }, new Date());
    expect((await rute.GET(dari("u-sa", "GET"))).status).toBe(403);
    expect((await rute.POST(dari("u-sa", "POST", { userId: "u-staf", alasan: "mencoba saat saklar mati" }))).status).toBe(403);
    expect((await rute.DELETE(dari("u-sa", "DELETE"))).status).toBe(403);
    const catatan = await import("@/app/api/portal/lihat-sebagai/catatan/route");
    const hakim = (await (await catatan.GET(req("/api/portal/lihat-sebagai/catatan", { headers: { "x-aleta-user-id": "u-hakim" } }))).json()) as { data: { catatan: unknown[] } };
    expect(hakim.data.catatan).toHaveLength(1);
    // dinyalakan -> rute terbuka; dimatikan lagi -> menolak lagi
    await nyalakanSaklar();
    expect((await rute.GET(dari("u-sa", "GET"))).status).toBe(200);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
    await simpanPengaturanFitur(db(), { id: "u-sa", name: "Nama u-sa" }, { fitur: { [FITUR_LIHAT_SEBAGAI]: "mati" } });
    vi.unstubAllGlobals();
    expect((await rute.GET(dari("u-sa", "GET"))).status).toBe(403);
  });

  it("hak-akses/saya melaporkan lihatSebagaiAktif: false bawaan, true sesudah dinyalakan", async () => {
    const rute = await import("@/app/api/hak-akses/saya/route");
    const baca = async () => ((await (await rute.GET(req("/api/hak-akses/saya", { headers: { "x-aleta-user-id": "u-sa" } }))).json()) as { data: { lihatSebagaiAktif: boolean } }).data.lihatSebagaiAktif;
    expect(await baca()).toBe(false);
    await nyalakanSaklar();
    expect(await baca()).toBe(true);
  });

  it("rute admin: Admin dan hakim ditolak 403; Super Admin mulai, melihat, lalu mengakhiri (saklar menyala)", async () => {
    await nyalakanSaklar();
    const rute = await import("@/app/api/admin/lihat-sebagai/route");
    const dari = (id: string, metode: string, badan?: unknown) =>
      req("/api/admin/lihat-sebagai", { method: metode, headers: { "x-aleta-user-id": id, "content-type": "application/json" }, body: badan ? JSON.stringify(badan) : undefined });

    expect((await rute.GET(dari("u-admin", "GET"))).status).toBe(403);
    expect((await rute.POST(dari("u-hakim", "POST", { userId: "u-staf", alasan: "mencoba tanpa hak" }))).status).toBe(403);
    expect((await rute.DELETE(dari("u-admin", "DELETE"))).status).toBe(403);
    expect(await sesiLihatAktif(db(), "u-admin")).toBeNull();

    const salah = await rute.POST(dari("u-sa", "POST", { userId: "u-hakim", alasan: "pendek" }));
    expect(salah.status).toBe(400);

    const mulai = await rute.POST(dari("u-sa", "POST", { userId: "u-hakim", alasan: "memeriksa menu hakim lewat rute" }));
    expect(mulai.status).toBe(200);
    const gabung = (await (await rute.GET(dari("u-sa", "GET"))).json()) as { data: { berjalan: { sesi: { nama: string } } | null; akun: Array<{ id: string }>; peran: unknown[] } };
    expect(gabung.data.berjalan?.sesi.nama).toBe("Nama u-hakim");
    expect(gabung.data.akun.some((a) => a.id === "u-sa")).toBe(false);
    expect(gabung.data.akun.some((a) => a.id === "u-staf")).toBe(true);
    expect(gabung.data.peran.length).toBeGreaterThan(5);

    const akhir = (await (await rute.DELETE(dari("u-sa", "DELETE"))).json()) as { data: { diakhiri: boolean } };
    expect(akhir.data.diakhiri).toBe(true);
  });

  it("rute catatan: hanya catatan milik pemanggil; tanpa sesi 401", async () => {
    await mulaiLihatSebagai(db(), SA, { userId: "u-hakim", alasan: "memeriksa menu hakim lewat rute" }, new Date());
    const rute = await import("@/app/api/portal/lihat-sebagai/catatan/route");
    const baca = async (id?: string) => rute.GET(req("/api/portal/lihat-sebagai/catatan", { headers: id ? { "x-aleta-user-id": id } : {} }));
    const hakim = (await (await baca("u-hakim")).json()) as { data: { catatan: Array<{ oleh: string }> } };
    expect(hakim.data.catatan).toHaveLength(1);
    expect(hakim.data.catatan[0].oleh).toBe("Nama u-sa");
    const staf = (await (await baca("u-staf")).json()) as { data: { catatan: unknown[] } };
    expect(staf.data.catatan).toEqual([]);
    expect((await baca()).status).toBe(401);
  });
});
