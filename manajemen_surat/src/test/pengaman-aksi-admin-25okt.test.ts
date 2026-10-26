// @vitest-environment node
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * PENGAMAN AKSI ADMIN (Bagian 6c, 25 Okt 2026) - rute asli + pg-mem
 * ============================================================================
 *
 *   1. saklar MATI: rute yang dijaga berjalan persis seperti dulu (tanpa header);
 *   2. saklar MENYALA: tiap rute yang dijaga menjawab 403 "pengaman_aksi" tanpa
 *      mengubah apa pun; sandi benar + kata konfirmasi meloloskannya; sandi salah
 *      dihitung pembatas laju; semua tercatat di audit TANPA sandi;
 *   3. dapat diatur per aksi; hapus massal punya ambang; langkah kedua hanya lewat kait;
 *   4. yang bukan Admin tidak ditanyai (penjaga hak yang menolak).
 */

const k = vi.hoisted(() => ({ db: null as unknown, hapusArsip: [] as unknown[] }));
vi.mock("@/server/db/client", async (asli) => {
  const m = await asli<typeof import("@/server/db/client")>();
  return { ...m, getDatabase: async () => k.db };
});
vi.mock("@/server/modules/aleta-bot/service", async (asli) => ({
  ...(await asli<Record<string, unknown>>()),
  syncAletaBotRuntimeConfigFromDb: async () => undefined,
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => ({
  ...(await asli<Record<string, unknown>>()),
  bersihkanGatewayEcourtArsip: async (a: unknown) => {
    k.hapusArsip.push(a);
    return { ok: true, data: { dihapus: 3 } };
  },
}));

type Db = import("@/server/db/client").AletaDatabase;
let db: Db;
const ASAL = "http://localhost:3000";
const SUPER = "usr-super";
const SANDI_SUPER = "super123";

beforeAll(async () => {
  const { createAletaDatabase } = await import("@/server/db/client");
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  k.db = db;
}, 120_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  for (const t of ["aleta_setelan_keamanan", "aleta_batas_perangkat", "aleta_setelan_jejak_masuk", "aleta_subnet_kantor", "aleta_aturan_jaringan_peran"]) {
    await db.run(`DELETE FROM ${t}`, []);
  }
  await db.run("DELETE FROM audit_logs WHERE action LIKE 'SECURITY_%'", []);
  k.hapusArsip = [];
  const { clearRateLimit } = await import("@/server/shared/rate-limit");
  for (const aktor of [SUPER, "usr-admin", "usr-hakim"]) clearRateLimit("pengaman-aksi", minta("/x"), aktor);
});

afterEach(async () => {
  const { __setelUlangKaitUntukUji } = await import("@/server/modules/keamanan/kait");
  __setelUlangKaitUntukUji();
});

function minta(url: string, o: { method?: string; aktor?: string; badan?: unknown; header?: Record<string, string>; ip?: string } = {}) {
  return new NextRequest(`${ASAL}${url}`, {
    method: o.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": o.ip ?? "192.168.10.31",
      ...(o.aktor ? { "x-aleta-user-id": o.aktor } : {}),
      ...(o.header ?? {}),
    },
    ...(o.badan !== undefined ? { body: JSON.stringify(o.badan) } : {}),
  });
}
const konfirmasi = (sandi: string, ketik: string, kode?: string) => ({
  "x-aleta-pengaman-sandi": sandi,
  "x-aleta-pengaman-ketik": ketik,
  ...(kode ? { "x-aleta-pengaman-kode": kode } : {}),
});

async function nyalakanPengaman(ubah: Record<string, unknown> = {}) {
  const { simpanPengaman } = await import("@/server/modules/keamanan/pengaman-aksi");
  return simpanPengaman(db, { aktif: true, ...ubah }, SUPER);
}
async function auditAksi(aksi: string) {
  return db.queryAll<{ payload_json: string; entity_id: string }>("SELECT payload_json, entity_id FROM audit_logs WHERE action = ?", [aksi]);
}
const batasAda = async () => Number((await db.queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM aleta_batas_perangkat", []))?.n ?? 0);

const kirimBatas = async (header?: Record<string, string>, aktor = SUPER) => {
  const { POST } = await import("@/app/api/admin/batas-perangkat/route");
  return POST(minta("/api/admin/batas-perangkat", { method: "POST", aktor, header, badan: { cakupan: "peran", sasaran: "hakim", maks: 3, perilaku: "tolak" } }));
};

// ─── 1. mati = persis seperti dulu ──────────────────────────────────────────

describe("saklar MATI (bawaan)", () => {
  it("bawaan mati, semua aksi dijaga siap; rute berjalan tanpa header apa pun", async () => {
    const { bacaPengaman, kodeAksiBerdampak } = await import("@/server/modules/keamanan/pengaman-aksi");
    const s = await bacaPengaman(db);
    expect(s).toMatchObject({ aktif: false, batasHapus: 20, langkahKedua: false });
    expect(kodeAksiBerdampak().every((kode) => s.aksi[kode])).toBe(true);

    expect((await kirimBatas()).status).toBe(200);
    expect(await batasAda()).toBe(1);

    const { PATCH } = await import("@/app/api/users/[id]/route");
    const naik = await PATCH(minta("/api/users/usr-ahmad", { method: "PATCH", aktor: SUPER, badan: { roleOverride: "admin" } }), { params: Promise.resolve({ id: "usr-ahmad" }) });
    expect(naik.status).toBe(200);
    await PATCH(minta("/api/users/usr-ahmad", { method: "PATCH", aktor: SUPER, badan: { roleOverride: null } }), { params: Promise.resolve({ id: "usr-ahmad" }) });

    const { POST: arsip } = await import("@/app/api/aleta-ecourt/arsip/route");
    expect((await arsip(minta("/api/aleta-ecourt/arsip", { method: "POST", aktor: SUPER, badan: { aksi: "bersihkan", hapus: true } }))).status).toBe(200);
    expect(k.hapusArsip).toHaveLength(1);
    expect(await auditAksi("SECURITY_CONFIRM_REQUESTED")).toEqual([]);
  });
});

// ─── 2. menyala ─────────────────────────────────────────────────────────────

describe("saklar MENYALA", () => {
  it("batas perangkat: tanpa kiriman 403 + rincian untuk kotak konfirmasi, tanpa mengubah apa pun", async () => {
    await nyalakanPengaman();
    const r = await kirimBatas();
    expect(r.status).toBe(403);
    const isi = await r.json();
    expect(isi.error.details).toMatchObject({
      alasan: "pengaman_aksi",
      kode: "perangkat.ubah-batas",
      kataKonfirmasi: "UBAH BATAS",
      perluKodeKedua: false,
      salah: "",
    });
    expect(isi.error.message).toMatch(/meminta konfirmasi/);
    expect(await batasAda()).toBe(0);
    expect((await auditAksi("SECURITY_CONFIRM_REQUESTED")).map((b) => b.entity_id)).toEqual(["perangkat.ubah-batas"]);
  });

  it("sandi benar + kata konfirmasi (huruf besar/kecil tidak menentukan) meloloskan; tercatat tanpa sandi", async () => {
    await nyalakanPengaman();
    const r = await kirimBatas(konfirmasi(SANDI_SUPER, "ubah batas"));
    expect(r.status).toBe(200);
    expect(await batasAda()).toBe(1);
    const lolos = await auditAksi("SECURITY_CONFIRM_PASSED");
    expect(lolos).toHaveLength(1);
    expect(JSON.stringify(await db.queryAll("SELECT * FROM audit_logs WHERE action LIKE 'SECURITY_CONFIRM%'", []))).not.toContain(SANDI_SUPER);
  });

  it("sandi salah ditolak dengan 'Sandi tidak cocok.' dan dicatat; kata keliru ditolak; tidak ada yang berubah", async () => {
    await nyalakanPengaman();
    const salah = await kirimBatas(konfirmasi("bukan-sandi", "UBAH BATAS"));
    expect(salah.status).toBe(403);
    expect((await salah.json()).error.details).toMatchObject({ alasan: "pengaman_aksi", salah: "Sandi tidak cocok." });
    const kata = await kirimBatas(konfirmasi(SANDI_SUPER, "ya"));
    expect(kata.status).toBe(403);
    expect((await kata.json()).error.details.salah).toMatch(/Kata konfirmasi belum sama/);
    expect(await batasAda()).toBe(0);
    expect((await auditAksi("SECURITY_CONFIRM_FAILED")).map((b) => JSON.parse(b.payload_json).sebab)).toEqual(["sandi", "kata-konfirmasi"]);
  });

  it("sandi keliru berulang kena pembatas laju (429); sandi benar membersihkannya", async () => {
    await nyalakanPengaman();
    for (let i = 0; i < 5; i += 1) expect((await kirimBatas(konfirmasi("salah", "UBAH BATAS"))).status).toBe(403);
    expect((await kirimBatas(konfirmasi(SANDI_SUPER, "UBAH BATAS"))).status).toBe(429);
    const { clearRateLimit } = await import("@/server/shared/rate-limit");
    clearRateLimit("pengaman-aksi", minta("/x"), SUPER);
    expect((await kirimBatas(konfirmasi(SANDI_SUPER, "UBAH BATAS"))).status).toBe(200);
  });

  it("rute lain yang dijaga: hak menu, mengangkat Admin (hanya bila peran BERUBAH), retensi audit, hapus massal, jaringan, kebijakan sandi", async () => {
    await nyalakanPengaman();
    // hak menu
    const { PUT } = await import("@/app/api/settings/module-visibility/route");
    const baris = await db.queryOne<{ role_id: string; module_id: string; enabled: number | boolean }>("SELECT role_id, module_id, enabled FROM module_visibility_settings LIMIT 1", []);
    const badanMenu = { roleId: baris!.role_id, moduleId: baris!.module_id, enabled: !baris!.enabled };
    const menu = await PUT(minta("/api/settings/module-visibility", { method: "PUT", aktor: SUPER, badan: badanMenu }));
    expect(menu.status).toBe(403);
    expect((await menu.json()).error.details.kode).toBe("peran.ubah-hak");
    expect((await PUT(minta("/api/settings/module-visibility", { method: "PUT", aktor: SUPER, badan: badanMenu, header: konfirmasi(SANDI_SUPER, "UBAH HAK") }))).status).toBe(200);
    await PUT(minta("/api/settings/module-visibility", { method: "PUT", aktor: SUPER, badan: { ...badanMenu, enabled: Boolean(baris!.enabled) }, header: konfirmasi(SANDI_SUPER, "UBAH HAK") }));

    // mengangkat Admin
    const { PATCH } = await import("@/app/api/users/[id]/route");
    const ctx = { params: Promise.resolve({ id: "usr-ahmad" }) };
    const angkat = await PATCH(minta("/api/users/usr-ahmad", { method: "PATCH", aktor: SUPER, badan: { roleOverride: "admin" } }), ctx);
    expect(angkat.status).toBe(403);
    expect((await angkat.json()).error.details.kode).toBe("akun.angkat-admin");
    expect((await db.queryOne<{ role_id: string }>("SELECT role_id FROM users WHERE id = 'usr-ahmad'", []))?.role_id).not.toBe("admin");
    expect((await PATCH(minta("/api/users/usr-ahmad", { method: "PATCH", aktor: SUPER, badan: { roleOverride: "admin" }, header: konfirmasi(SANDI_SUPER, "angkat admin") }), ctx)).status).toBe(200);
    // menyimpan ulang akun yang SUDAH Admin tidak ditanyai
    expect((await PATCH(minta("/api/users/usr-ahmad", { method: "PATCH", aktor: SUPER, badan: { roleOverride: "admin", name: "Ahmad Rizki" } }), ctx)).status).toBe(200);
    // peran lain (bukan admin) tidak ditanyai
    expect((await PATCH(minta("/api/users/usr-ahmad", { method: "PATCH", aktor: SUPER, badan: { roleOverride: null }, header: konfirmasi(SANDI_SUPER, "x") }), ctx)).status).toBe(200);

    // retensi audit: hanya bila nilainya berubah
    const { POST: setelan } = await import("@/app/api/admin/jejak-masuk/setelan/route");
    expect((await setelan(minta("/api/admin/jejak-masuk/setelan", { method: "POST", aktor: SUPER, badan: { retensiHari: 365 } }))).status).toBe(200); // sama dengan bawaan
    const retensi = await setelan(minta("/api/admin/jejak-masuk/setelan", { method: "POST", aktor: SUPER, badan: { retensiHari: 90 } }));
    expect(retensi.status).toBe(403);
    expect((await retensi.json()).error.details.kode).toBe("audit.ubah-retensi");
    expect((await setelan(minta("/api/admin/jejak-masuk/setelan", { method: "POST", aktor: SUPER, badan: { retensiHari: 90 }, header: konfirmasi(SANDI_SUPER, "UBAH AUDIT") }))).status).toBe(200);

    // hapus massal arsip: laporan "akan dihapus" bebas, penghapusan sungguhan dijaga
    const { POST: arsip } = await import("@/app/api/aleta-ecourt/arsip/route");
    expect((await arsip(minta("/api/aleta-ecourt/arsip", { method: "POST", aktor: SUPER, badan: { aksi: "bersihkan", hapus: false } }))).status).toBe(200);
    const hapus = await arsip(minta("/api/aleta-ecourt/arsip", { method: "POST", aktor: SUPER, badan: { aksi: "bersihkan", hapus: true } }));
    expect(hapus.status).toBe(403);
    expect(k.hapusArsip).toHaveLength(1); // hanya yang laporan
    expect((await arsip(minta("/api/aleta-ecourt/arsip", { method: "POST", aktor: SUPER, badan: { aksi: "bersihkan", hapus: true }, header: konfirmasi(SANDI_SUPER, "hapus massal") }))).status).toBe(200);
    expect(k.hapusArsip).toHaveLength(2);

    // batas jaringan dan kebijakan sandi
    const { POST: jar } = await import("@/app/api/admin/keamanan/jaringan/route");
    const badanJar = { aksi: "tambah-subnet", cidr: "192.168.10.0/24" };
    expect((await jar(minta("/api/admin/keamanan/jaringan", { method: "POST", aktor: SUPER, badan: badanJar }))).status).toBe(403);
    expect((await jar(minta("/api/admin/keamanan/jaringan", { method: "POST", aktor: SUPER, badan: badanJar, header: konfirmasi(SANDI_SUPER, "ubah jaringan") }))).status).toBe(200);
    const { POST: sandi } = await import("@/app/api/admin/keamanan/sandi/route");
    const kp = await sandi(minta("/api/admin/keamanan/sandi", { method: "POST", aktor: SUPER, badan: { panjangMin: 10 } }));
    expect(kp.status).toBe(403);
    expect((await kp.json()).error.details.kode).toBe("sandi.ubah-kebijakan");
  });

  it("mengangkat akun BARU langsung menjadi Admin dijaga; akun biasa tidak", async () => {
    await nyalakanPengaman();
    const { POST } = await import("@/app/api/users/route");
    const baru = (roleOverride: string | null, header?: Record<string, string>, tanda = "a") =>
      POST(
        minta("/api/users", {
          method: "POST",
          aktor: SUPER,
          header,
          badan: {
            username: `uji${tanda}${Date.now() % 100000}`,
            password: "Uji7sandi",
            email: `uji.${tanda}.${Date.now() % 100000}@pa.go.id`,
            whatsappNumber: "628123459999",
            name: "Pegawai Uji",
            nip: "199001012020121001",
            positionId: "pos-staf-umum",
            roleOverride,
          },
        })
      );
    const tolak = await baru("admin");
    expect(tolak.status).toBe(403);
    expect((await tolak.json()).error.details.kode).toBe("akun.angkat-admin");
    expect((await baru("admin", konfirmasi(SANDI_SUPER, "ANGKAT ADMIN"), "b")).status).toBe(201);
    expect((await baru(null, undefined, "c")).status).toBe(201);
  });

  it("dapat diatur per aksi (dimatikan -> tanpa tanya) dan hapus massal punya ambang", async () => {
    const { tegakkanPengaman } = await import("@/server/modules/keamanan/pengaman-aksi");
    const { requireActorUser } = await import("@/server/modules/organization/service");
    await nyalakanPengaman({ aksi: { "perangkat.ubah-batas": false }, batasHapus: 50 });
    expect((await kirimBatas()).status).toBe(200); // aksi ini dimatikan
    const aktor = await requireActorUser(db, SUPER);
    const req = minta("/x");
    await expect(tegakkanPengaman(db, req, aktor, "hapus.massal", { jumlah: 50 })).resolves.toBeUndefined(); // tidak melebihi ambang
    await expect(tegakkanPengaman(db, req, aktor, "hapus.massal", { jumlah: 51 })).rejects.toMatchObject({ status: 403 });
    await expect(tegakkanPengaman(db, req, aktor, "hapus.massal")).rejects.toMatchObject({ status: 403 }); // jumlah tak diketahui = dijaga
  });

  it("yang bukan Admin tidak ditanyai: penjaga hak yang menolak (403 hak, bukan permintaan konfirmasi)", async () => {
    await nyalakanPengaman();
    const r = await kirimBatas(undefined, "usr-hakim");
    expect(r.status).toBe(403);
    expect((await r.json()).error.details?.alasan).not.toBe("pengaman_aksi");
    const { tegakkanPengaman } = await import("@/server/modules/keamanan/pengaman-aksi");
    const { requireActorUser } = await import("@/server/modules/organization/service");
    await expect(tegakkanPengaman(db, minta("/x"), await requireActorUser(db, "usr-hakim"), "peran.ubah-hak")).resolves.toBeUndefined();
  });
});

// ─── 3. langkah kedua lewat kait ────────────────────────────────────────────

describe("langkah kedua (OTP) hanya lewat kait", () => {
  it("tanpa pendaftar kait, saklar langkah kedua diabaikan; dengan pendaftar, kode wajib dan diperiksa kait", async () => {
    await nyalakanPengaman({ langkahKedua: true });
    // tanpa kait: sandi + kata cukup
    expect((await kirimBatas(konfirmasi(SANDI_SUPER, "UBAH BATAS"))).status).toBe(200);

    const kait = await import("@/server/modules/keamanan/kait");
    const diperiksa: string[] = [];
    kait.daftarkanLangkahKedua({
      nama: "uji",
      tersedia: async (_db, aktor) => aktor.id === SUPER,
      periksa: async (_db, _aktor, kode) => {
        diperiksa.push(kode);
        return kode === "246810";
      },
    });
    const tanpaKode = await kirimBatas(konfirmasi(SANDI_SUPER, "UBAH BATAS"));
    expect(tanpaKode.status).toBe(403);
    expect((await tanpaKode.json()).error.details).toMatchObject({ alasan: "pengaman_aksi", perluKodeKedua: true, salah: "Kode belum diisi." });
    const kodeSalah = await kirimBatas(konfirmasi(SANDI_SUPER, "UBAH BATAS", "000000"));
    expect(kodeSalah.status).toBe(403);
    expect((await kodeSalah.json()).error.details.salah).toBe("Kode tidak cocok.");
    expect((await kirimBatas(konfirmasi(SANDI_SUPER, "UBAH BATAS", "246810"))).status).toBe(200);
    expect(diperiksa).toEqual(["000000", "246810"]);
    expect((await auditAksi("SECURITY_CONFIRM_FAILED")).map((b) => JSON.parse(b.payload_json).sebab)).toContain("kode-kedua");
  });
});

// ─── 4. rute pengaturan ─────────────────────────────────────────────────────

describe("rute /api/admin/keamanan/pengaman", () => {
  it("Admin membaca (katalog lengkap, kait belum terpasang), hanya Super Admin mengubah; mematikan saat menyala meminta konfirmasi", async () => {
    const { GET, POST } = await import("@/app/api/admin/keamanan/pengaman/route");
    expect((await GET(minta("/api/admin/keamanan/pengaman", { aktor: "usr-hakim" }))).status).toBe(403);
    const baca = await GET(minta("/api/admin/keamanan/pengaman", { aktor: "usr-admin" }));
    expect(baca.status).toBe(200);
    const d = (await baca.json()).data;
    expect(d.pengaman.aktif).toBe(false);
    expect(d.langkahKeduaTersedia).toBe(false);
    expect(d.katalog.map((a: { kode: string }) => a.kode)).toEqual(
      expect.arrayContaining(["peran.ubah-hak", "akun.angkat-admin", "audit.ubah-retensi", "hapus.massal", "cadangan.pulihkan", "lihat-sebagai", "perangkat.ubah-batas", "jaringan.ubah-batas", "otp.nyalakan"])
    );
    expect(d.katalog.find((a: { kode: string }) => a.kode === "lihat-sebagai").tersambung).toBe(false);

    expect((await POST(minta("/api/admin/keamanan/pengaman", { method: "POST", aktor: "usr-admin", badan: { aktif: true } }))).status).toBe(403);
    // menyalakan: belum menyala, jadi tanpa konfirmasi
    const nyala = await POST(minta("/api/admin/keamanan/pengaman", { method: "POST", aktor: SUPER, badan: { aktif: true, batasHapus: 30 } }));
    expect(nyala.status).toBe(200);
    expect((await nyala.json()).data.pengaman).toMatchObject({ aktif: true, batasHapus: 30 });
    // mematikan: pengaman menjaga dirinya
    const mati = await POST(minta("/api/admin/keamanan/pengaman", { method: "POST", aktor: SUPER, badan: { aktif: false } }));
    expect(mati.status).toBe(403);
    expect((await mati.json()).error.details.kode).toBe("pengaman.ubah");
    expect((await POST(minta("/api/admin/keamanan/pengaman", { method: "POST", aktor: SUPER, badan: { aktif: false }, header: konfirmasi(SANDI_SUPER, "ubah pengaman") }))).status).toBe(200);
    // nilai buruk
    const buruk = await POST(minta("/api/admin/keamanan/pengaman", { method: "POST", aktor: SUPER, badan: { batasHapus: 0 } }));
    expect(buruk.status).toBe(400);
    const asing = await POST(minta("/api/admin/keamanan/pengaman", { method: "POST", aktor: SUPER, badan: { aksi: { "tidak.ada": true } } }));
    expect(asing.status).toBe(400);
    expect((await auditAksi("SECURITY_ACTION_GUARD_UPDATE")).length).toBeGreaterThanOrEqual(2);
  });
});
