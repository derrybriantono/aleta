// @vitest-environment node
import { generateKeyPairSync } from "node:crypto";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bersihkanAlamatPusat, bandingkanVersi, bersihkanManifestPusat, hitungPembaruan, isiBertandatangan, type ManifestPusat } from "@/lib/kanal-pembaruan";
import { AKSI_AKSES_GLOBAL, adalahSuperAdminGlobal, daftarPenandaGlobal } from "@/lib/super-admin-global";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { catatAksesBilaSuperAdminGlobal, daftarAksesTerbaru, kosongkanSinggahAksesGlobal } from "@/server/modules/satker/akses-global";
import { bacaSatkerAktif, pastikanInstalasiId } from "@/server/modules/satker/identitas";
import { bacaIzinPusat, bacaKanal, bacaSaluranEfektif, cekPembaruanPusat, simpanKanal } from "@/server/modules/satker/kanal";
import { fiturMenyala } from "@/server/modules/satker/fitur";
import { periksaTiketMasuk, isiTiket, type TiketMasukPusat } from "@/server/modules/satker/tiket-masuk";
import { getTaskSourcesForUser } from "@/server/modules/tasks/service";
import { kanonik, periksaTandatangan, tandatangani } from "@/server/shared/pusat-tanda-tangan";

/**
 * Banyak satker, Tahap 0 - super admin global, kanal pembaruan, tiket Pusat.
 *   A. penanda (murni);  B. jejak akses + pemberitahuan (pg-mem);
 *   C. gagal ke sisi tertutup;  D. kait resolveActorUserId;
 *   E. tanda tangan Pusat, kanal, cek pembaruan;  F. tiket masuk.
 */

const ENV = "ALETA_SUPER_ADMIN_GLOBAL";
const pasangan = generateKeyPairSync("ed25519");
const PEM_PRIBADI = pasangan.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const PEM_PUBLIK = pasangan.publicKey.export({ type: "spki", format: "pem" }).toString();
const lainnya = generateKeyPairSync("ed25519");
const PEM_PRIBADI_LAIN = lainnya.privateKey.export({ type: "pkcs8", format: "pem" }).toString();

beforeEach(() => {
  kosongkanSinggahAksesGlobal();
  delete process.env[ENV];
});
afterEach(() => {
  delete process.env[ENV];
  delete process.env.ALETA_KODE_SATKER;
});

describe("A - penanda super admin global (murni)", () => {
  it("env diurai: huruf kecil, unik, karakter aneh dibuang", () => {
    expect(daftarPenandaGlobal(" Derry, derry;usr-1 ,'x;drop'")).toEqual(["derry", "usr-1"]);
    expect(daftarPenandaGlobal("Derry, derry, usr-1")).toEqual(["derry", "usr-1"]);
    expect(daftarPenandaGlobal("")).toEqual([]);
    expect(daftarPenandaGlobal(undefined)).toEqual([]);
  });
  it("hanya akun ditandai + berperan super-admin + aktif", () => {
    const p = ["derry"];
    expect(adalahSuperAdminGlobal(p, { id: "u1", username: "Derry", roleId: "super-admin", isActive: 1 })).toBe(true);
    expect(adalahSuperAdminGlobal(p, { id: "derry", username: "x", roleId: "super-admin" })).toBe(true);
    expect(adalahSuperAdminGlobal(p, { id: "u1", username: "derry", roleId: "admin" })).toBe(false);
    expect(adalahSuperAdminGlobal(p, { id: "u1", username: "derry", roleId: "super-admin", isActive: 0 })).toBe(false);
    expect(adalahSuperAdminGlobal(p, { id: "u2", username: "lain", roleId: "super-admin" })).toBe(false);
    expect(adalahSuperAdminGlobal([], { id: "u1", username: "derry", roleId: "super-admin" })).toBe(false);
    expect(adalahSuperAdminGlobal(p, null)).toBe(false);
  });
});

describe("B - jejak akses dan pemberitahuan admin (pg-mem)", () => {
  let db: AletaDatabase;
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  });
  afterEach(async () => {
    await db.close();
  });
  const masukan = (userId: string, sessionId: string) => ({ userId, sessionId, alamatIp: "192.168.10.20", agenPengguna: "UjiPeramban/1.0" });
  const jumlahJejak = async () => (await db.queryAll("SELECT id FROM audit_logs WHERE action = ?", [AKSI_AKSES_GLOBAL])).length;

  it("tanpa penanda di env: tidak ada yang dicatat dan basis data tidak disentuh", async () => {
    const mati = new Proxy({}, { get: () => () => { throw new Error("tidak boleh disentuh"); } }) as unknown as AletaDatabase;
    expect(await catatAksesBilaSuperAdminGlobal(mati, masukan("usr-super", "s1"))).toEqual({ dicatat: false });
  });

  it("akun global: satu jejak per sesi (tidak dobel walau singgahan dikosongkan), sesi baru = jejak baru", async () => {
    process.env.ALETA_KODE_SATKER = "PA.Dgl";
    process.env[ENV] = "superadmin";
    expect(await catatAksesBilaSuperAdminGlobal(db, masukan("usr-super", "sesi-1"))).toEqual({ dicatat: true });
    expect(await catatAksesBilaSuperAdminGlobal(db, masukan("usr-super", "sesi-1"))).toEqual({ dicatat: false });
    kosongkanSinggahAksesGlobal();
    await catatAksesBilaSuperAdminGlobal(db, masukan("usr-super", "sesi-1"));
    expect(await jumlahJejak()).toBe(1);
    await catatAksesBilaSuperAdminGlobal(db, masukan("usr-super", "sesi-2"));
    expect(await jumlahJejak()).toBe(2);

    const baris = await db.queryOne<{ actor_user_id: string; entity_type: string; entity_id: string; payload_json: string }>(
      "SELECT actor_user_id, entity_type, entity_id, payload_json FROM audit_logs WHERE action = ? ORDER BY created_at ASC LIMIT 1",
      [AKSI_AKSES_GLOBAL]
    );
    expect(baris).toMatchObject({ actor_user_id: "usr-super", entity_type: "super_admin_global" });
    expect(baris!.entity_id).not.toContain("sesi-1"); // id sesi tidak disimpan mentah
    const p = JSON.parse(baris!.payload_json);
    expect(p).toMatchObject({ username: "superadmin", kodeSatker: "PA.Dgl", cara: "sesi-langsung", alamatIp: "192.168.10.20", pemberitahuan: "admin-satker" });
  });

  it("akun lain (termasuk Admin biasa dan super admin lokal yang tidak ditandai) tidak dicatat", async () => {
    process.env[ENV] = "superadmin";
    expect((await catatAksesBilaSuperAdminGlobal(db, masukan("usr-admin", "s9"))).dicatat).toBe(false);
    expect((await catatAksesBilaSuperAdminGlobal(db, masukan("usr-tidak-ada", "s9"))).dicatat).toBe(false);
    process.env[ENV] = "adminit"; // ditandai tetapi bukan super-admin -> tidak berlaku
    kosongkanSinggahAksesGlobal();
    expect((await catatAksesBilaSuperAdminGlobal(db, masukan("usr-admin", "s9"))).dicatat).toBe(false);
    expect(await jumlahJejak()).toBe(0);
  });

  it("pemberitahuan: admin satker melihat tugas 'Super admin global masuk'; bukan-admin tidak", async () => {
    process.env[ENV] = "superadmin";
    await catatAksesBilaSuperAdminGlobal(db, masukan("usr-super", "sesi-n"));
    const admin = await getTaskSourcesForUser(db, "usr-admin");
    const tugas = admin.sources.flatMap((s) => s.tasks).filter((t) => t.entityId.startsWith("akses_global_"));
    expect(tugas).toHaveLength(1);
    expect(tugas[0]).toMatchObject({ entityType: "system_task", title: "Super admin global masuk ke ALETA satker ini", priority: "high", seen: false });
    expect(tugas[0].description).toContain("192.168.10.20");
    const biasa = await getTaskSourcesForUser(db, "usr-ketua");
    expect(biasa.sources.flatMap((s) => s.tasks).filter((t) => t.entityId.startsWith("akses_global_"))).toHaveLength(0);
    expect((await daftarAksesTerbaru(db))).toHaveLength(1);
    expect((await daftarAksesTerbaru(db, { hari: 1, sekarang: new Date(Date.now() + 3 * 86_400_000) }))).toHaveLength(0);
  });

  it("tanpa akses tercatat, tidak ada pemberitahuan palsu - juga dari sumber data tiruan yang mengembalikan baris sembarang", async () => {
    const admin = await getTaskSourcesForUser(db, "usr-admin");
    expect(admin.sources.flatMap((s) => s.tasks).filter((t) => t.entityId.startsWith("akses_global_"))).toHaveLength(0);
    const tiruan = {
      queryAll: async () => [{ id: "x1", actor_user_id: null, payload_json: null, created_at: "2026-10-18T00:00:00Z" }, { id: "x2", payload_json: "{}", created_at: "2026-10-18T00:00:00Z" }],
    } as unknown as AletaDatabase;
    expect(await daftarAksesTerbaru(tiruan)).toEqual([]);
  });
});

describe("C - gagal ke sisi tertutup", () => {
  it("jejak tidak dapat ditulis: akun global ditolak (melempar); akun biasa tidak terpengaruh", async () => {
    const db = await createAletaDatabase({ useInMemory: true, seed: true });
    try {
      process.env[ENV] = "superadmin";
      const asli = db.prepare.bind(db);
      const rusak = new Proxy(db, {
        get(target, prop) {
          if (prop === "prepare") {
            return (sql: string) => {
              if (/INSERT INTO audit_logs/i.test(sql)) throw new Error("disk penuh");
              return asli(sql);
            };
          }
          const nilai = Reflect.get(target, prop) as unknown;
          return typeof nilai === "function" ? (nilai as (...a: unknown[]) => unknown).bind(target) : nilai;
        },
      }) as AletaDatabase;
      await expect(catatAksesBilaSuperAdminGlobal(rusak, { userId: "usr-super", sessionId: "s", alamatIp: "1.1.1.1", agenPengguna: "x" })).rejects.toThrow(/disk penuh/);
      expect((await catatAksesBilaSuperAdminGlobal(rusak, { userId: "usr-admin", sessionId: "s", alamatIp: "1.1.1.1", agenPengguna: "x" })).dicatat).toBe(false);
    } finally {
      await db.close();
    }
  });
});

describe("D - kait resolveActorUserId", () => {
  let db: AletaDatabase;
  let insertGagal = false;
  beforeEach(async () => {
    vi.resetModules();
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    insertGagal = false;
    const asli = db.prepare.bind(db);
    (db as unknown as { prepare: (s: string) => unknown }).prepare = (sql: string) => {
      if (insertGagal && /INSERT INTO audit_logs/i.test(sql)) throw new Error("disk penuh");
      return asli(sql);
    };
    vi.doMock("@/server/db/client", async (a) => ({ ...(await a<typeof import("@/server/db/client")>()), getDatabase: async () => db }));
    vi.doMock("@/lib/auth", () => ({
      getAuth: async () => ({ api: { getSession: async () => ({ user: { id: "usr-super" }, session: { id: "sesi-kait", createdAt: new Date() } }) } }),
    }));
    vi.doMock("@/server/modules/portal/sesi-portal", () => ({ periksaSesi: async () => ({ berlaku: true, diingat: true }), hapusSesi: async () => undefined }));
  });
  afterEach(async () => {
    vi.doUnmock("@/server/db/client");
    vi.doUnmock("@/lib/auth");
    vi.doUnmock("@/server/modules/portal/sesi-portal");
    await db.close();
  });
  const permintaan = () => new NextRequest("http://localhost/api/x", { headers: { "x-forwarded-for": "10.0.0.7", "user-agent": "Uji/2" } });

  it("akun global ber-sesi: lolos DAN tercatat; tanpa env tidak ada jejak", async () => {
    const { resolveActorUserId } = await import("@/server/shared/auth");
    expect(await resolveActorUserId(permintaan())).toBe("usr-super");
    expect(await db.queryAll("SELECT id FROM audit_logs WHERE action = ?", [AKSI_AKSES_GLOBAL])).toHaveLength(0);
    process.env[ENV] = "superadmin";
    expect(await resolveActorUserId(permintaan())).toBe("usr-super");
    expect(await resolveActorUserId(permintaan())).toBe("usr-super");
    const baris = await db.queryAll<{ payload_json: string }>("SELECT payload_json FROM audit_logs WHERE action = ?", [AKSI_AKSES_GLOBAL]);
    expect(baris).toHaveLength(1);
    expect(JSON.parse(baris[0].payload_json)).toMatchObject({ alamatIp: "10.0.0.7", agenPengguna: "Uji/2" });
  });

  it("jejak gagal ditulis: sesi tidak diterima (tidak ada akses tanpa jejak)", async () => {
    const { resolveActorUserId } = await import("@/server/shared/auth");
    process.env[ENV] = "superadmin";
    insertGagal = true;
    const galat = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await resolveActorUserId(permintaan())).toBe("");
    expect(galat).toHaveBeenCalled();
    galat.mockRestore();
  });
});

describe("E - tanda tangan Pusat, kanal, dan cek pembaruan", () => {
  it("kanonik baku; tanda tangan hanya sah untuk isi dan kunci yang sama", () => {
    expect(kanonik({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe('{"a":[2,{"d":1}],"b":1}');
    const sig = tandatangani({ x: 1 }, PEM_PRIBADI);
    expect(periksaTandatangan({ x: 1 }, sig, PEM_PUBLIK)).toBe(true);
    expect(periksaTandatangan({ x: 2 }, sig, PEM_PUBLIK)).toBe(false);
    expect(periksaTandatangan({ x: 1 }, tandatangani({ x: 1 }, PEM_PRIBADI_LAIN), PEM_PUBLIK)).toBe(false);
    expect(periksaTandatangan({ x: 1 }, "", PEM_PUBLIK)).toBe(false);
    expect(periksaTandatangan({ x: 1 }, sig, "bukan kunci")).toBe(false);
  });

  it("alamat Pusat: kosong boleh, http/https saja, tanpa sandi/kueri", () => {
    expect(bersihkanAlamatPusat("")).toBe("");
    expect(bersihkanAlamatPusat(" http://pusat.contoh.id/ ")).toBe("http://pusat.contoh.id");
    expect(bersihkanAlamatPusat("https://pusat.contoh.id/aleta/")).toBe("https://pusat.contoh.id/aleta");
    for (const buruk of ["ftp://x", "bukan url", "http://u:p@x.id", "http://x.id/?a=1", "http://x.id/#a"]) expect(() => bersihkanAlamatPusat(buruk), buruk).toThrow();
  });

  it("hitungPembaruan: per saluran, hanya yang lebih baru; manifest tanpa SHA-256 tidak menawarkan unduhan", () => {
    expect(bandingkanVersi("1.205.1", "1.205.0")).toBeGreaterThan(0);
    expect(bandingkanVersi("2.40.1", "2.40.1")).toBe(0);
    const manifest = bersihkanManifestPusat({
      skema: 1,
      diterbitkan: "2026-10-18T00:00:00Z",
      saluran: {
        stabil: { portal: { versi: "2.40.2", unduh: { alamat: "http://x/p.tar.gz", sha256: "a".repeat(64) } }, ekstensi: { versi: "1.205.1" } },
        "uji-coba": { portal: { versi: "2.41.0", minimalVersi: "2.40.5", unduh: { alamat: "http://x/q.tar.gz", sha256: "pendek" } } },
      },
    }) as ManifestPusat;
    expect(manifest.saluran["uji-coba"].portal?.unduh).toBeUndefined();
    const stabil = hitungPembaruan(manifest, "stabil", { portal: "2.40.1", ekstensi: "1.205.1" });
    expect(stabil.map((k) => [k.komponen, k.adaPembaruan])).toEqual([["portal", true], ["ekstensi", false]]);
    const uji = hitungPembaruan(manifest, "uji-coba", { portal: "2.40.1" });
    expect(uji[0]).toMatchObject({ adaPembaruan: true, langsungDapat: false });
    expect(bersihkanManifestPusat({ skema: 99 })).toBeNull();
  });

  describe("cek pembaruan (pg-mem, fetch tiruan)", () => {
    let db: AletaDatabase;
    beforeEach(async () => {
      db = await createAletaDatabase({ useInMemory: true, seed: true });
    });
    afterEach(async () => {
      await db.close();
    });
    const aktor = { id: "usr-super", name: "Super Admin" };
    const manifest = {
      skema: 1,
      diterbitkan: "2026-10-18T00:00:00Z",
      saluran: { stabil: { portal: { versi: "2.99.0" } }, "uji-coba": {} },
    };
    const jawab = (kunci: string, tambah: Record<string, unknown> = {}) => {
      const isi = { skema: 1, manifest, izin: { fitur: { "bot-ai": "mati" } }, saluranDipaksa: null, pesan: "Halo satker", ...tambah };
      return async () => new Response(JSON.stringify({ ...isi, tandatangan: tandatangani(isiBertandatangan(isi), kunci) }), { status: 200 });
    };

    it("alamat kosong: belum diatur; identitas dan ID instalasi stabil", async () => {
      expect((await cekPembaruanPusat(db, aktor)).status).toBe("belum-diatur");
      process.env.ALETA_KODE_SATKER = "PA.Uji";
      expect((await bacaSatkerAktif(db)).kodeSatker).toBe("PA.Uji");
      const id = await pastikanInstalasiId(db);
      expect(id).toMatch(/^[\w-]{8,80}$/);
      expect(await pastikanInstalasiId(db)).toBe(id);
    });

    it("tanpa kunci publik terpasang atau tanda tangan salah: ditolak, tidak ada yang tersimpan", async () => {
      await simpanKanal(db, aktor, { alamatPusat: "http://pusat.contoh.id" });
      expect((await cekPembaruanPusat(db, aktor, { kunciPublik: "", fetch: jawab(PEM_PRIBADI) })).status).toBe("galat");
      const salah = await cekPembaruanPusat(db, aktor, { kunciPublik: PEM_PUBLIK, fetch: jawab(PEM_PRIBADI_LAIN), versi: { portal: "2.40.1" } });
      expect(salah.status).toBe("tanda-tangan-ditolak");
      expect(await bacaIzinPusat(db)).toBeNull();
      expect(await fiturMenyala(db, "bot-ai")).toBe(true);
    });

    it("jawaban sah: pembaruan dihitung, plafon fitur tersimpan, saluran dipaksa berlaku, dicatat di audit", async () => {
      await simpanKanal(db, aktor, { alamatPusat: "http://pusat.contoh.id", saluran: "stabil" });
      const hasil = await cekPembaruanPusat(db, aktor, { kunciPublik: PEM_PUBLIK, fetch: jawab(PEM_PRIBADI, { saluranDipaksa: "uji-coba" }), versi: { portal: "2.40.1" }, kunciSatker: "rahasia-uji" });
      expect(hasil).toMatchObject({ status: "ok", saluran: "uji-coba", pesan: "Halo satker" });
      if (hasil.status === "ok") expect(hasil.pembaruan[0]).toMatchObject({ komponen: "portal", adaPembaruan: false });
      expect((await bacaIzinPusat(db))?.fitur).toEqual({ "bot-ai": "mati" });
      expect(await bacaSaluranEfektif(db)).toBe("uji-coba");
      expect((await bacaKanal(db)).saluran).toBe("stabil"); // pilihan satker tidak ditimpa
      expect(await fiturMenyala(db, "bot-ai")).toBe(false); // plafon Pusat
      expect(await db.queryAll("SELECT id FROM audit_logs WHERE action = 'CEK_PEMBARUAN_PUSAT'")).toHaveLength(1);
    });

    it("permintaan ke Pusat tanpa data perkara/pegawai; kunci satker lewat header, bukan badan", async () => {
      await simpanKanal(db, aktor, { alamatPusat: "http://pusat.contoh.id" });
      process.env.ALETA_KODE_SATKER = "PA.Uji";
      let dikirim: { url: string; init: RequestInit } | null = null;
      await cekPembaruanPusat(db, aktor, {
        kunciPublik: PEM_PUBLIK,
        kunciSatker: "rahasia-uji",
        versi: { portal: "2.40.1", ekstensi: "1.205.1" },
        fetch: async (url, init) => {
          dikirim = { url, init };
          return new Response("{}", { status: 500 });
        },
      });
      expect(dikirim!.url).toBe("http://pusat.contoh.id/api/pusat/v1/cek");
      expect((dikirim!.init.headers as Record<string, string>)["x-aleta-satker-kunci"]).toBe("rahasia-uji");
      const badan = JSON.parse(String(dikirim!.init.body));
      expect(Object.keys(badan).sort()).toEqual(["saluran", "satker", "skema", "versi", "waktu"]);
      expect(badan.satker.kode).toBe("PA.Uji");
      expect(JSON.stringify(badan)).not.toContain("rahasia-uji");
    });
  });
});

describe("F - tiket masuk dari Pusat", () => {
  const sekarang = new Date("2026-10-18T10:00:00Z");
  const buat = (ubah: Partial<TiketMasukPusat> = {}, kunci = PEM_PRIBADI): TiketMasukPusat => {
    const dasar = {
      skema: 1 as const,
      jenis: "masuk-super-admin-global" as const,
      satker: "PA.Dgl",
      sub: "derry",
      jti: "tiket-0123456789abcdef",
      terbit: "2026-10-18T09:59:00Z",
      kedaluwarsa: "2026-10-18T10:04:00Z",
      alasan: "pemeliharaan",
      ...ubah,
    };
    return { ...dasar, tandatangan: tandatangani(isiTiket(dasar), kunci) };
  };
  const konteks = { kodeSatker: "PA.Dgl", kunciPublik: PEM_PUBLIK, penanda: ["derry"], sekarang };

  it("tiket sah diterima", () => {
    expect(periksaTiketMasuk(buat(), konteks)).toMatchObject({ ok: true });
  });
  it("ditolak: satker lain, kedaluwarsa, umur >10 menit, masa depan, kunci lain, isi diubah, akun tak ditandai, tanpa kunci/kode", () => {
    const sebab = (t: unknown, k = konteks) => {
      const h = periksaTiketMasuk(t, k);
      return h.ok ? "DITERIMA" : h.sebab;
    };
    expect(sebab(buat({ satker: "PA.Lain" }))).toMatch(/satker lain/);
    expect(sebab(buat({ terbit: "2026-10-18T09:00:00Z", kedaluwarsa: "2026-10-18T09:05:00Z" }))).toMatch(/kedaluwarsa/);
    expect(sebab(buat({ terbit: "2026-10-18T09:50:00Z", kedaluwarsa: "2026-10-18T10:20:00Z" }))).toMatch(/10 menit/);
    expect(sebab(buat({ terbit: "2026-10-18T10:30:00Z", kedaluwarsa: "2026-10-18T10:35:00Z" }))).toMatch(/masa depan/);
    expect(sebab(buat({}, PEM_PRIBADI_LAIN))).toMatch(/Tanda tangan/);
    expect(sebab({ ...buat(), alasan: "diubah penyerang" })).toMatch(/Tanda tangan/);
    expect(sebab(buat({ sub: "orang-lain" }))).toMatch(/tidak ditandai/);
    expect(sebab(buat(), { ...konteks, kunciPublik: "" })).toMatch(/Kunci publik/);
    expect(sebab(buat(), { ...konteks, kodeSatker: "" })).toMatch(/Kode satker/);
    expect(sebab(buat({ jti: "pendek" }))).toMatch(/penanda unik/);
    expect(sebab("bukan objek")).toMatch(/berbentuk/);
  });
});
