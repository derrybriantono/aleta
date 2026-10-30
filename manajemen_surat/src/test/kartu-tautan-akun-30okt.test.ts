// @vitest-environment node
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { folderPribadi, namaEcourtCocok, susunKartuTautan, type PegawaiKartu } from "@/lib/kartu-tautan-akun";
import type { PratinjauTautan } from "@/lib/tautan-akun-sipp";
import { AKSI, bolehAksi } from "@/lib/matriks-peran";
import { bacaKartuTautan, hapusEcourtPegawai, isiEcourtPegawai, type DepsKartuTautan } from "@/server/modules/portal/kartu-tautan-akun";
import { getUsersFromDb } from "@/server/modules/organization/service";

/**
 * G4 4.1 (30 Okt 2026) - kartu tautan akun pegawai ALETA <-> SIPP <-> ABT <-> e-Court.
 * Perilaku yang dijaga:
 *   - tautan SIPP yang PASTI ditautkan sendiri saat kartu dibuka; yang ragu tidak (menunggu pilihan admin);
 *   - Super Admin/Admin mengisi akun e-Court pegawai: bot menerima penggunaId PEGAWAI (bukan admin) dan
 *     "diisi oleh <admin>"; sandi tidak ada di jawaban, audit, atau berkas polos; Admin tidak mengisi Super Admin;
 *   - selain Super Admin/Admin ditolak (403);
 *   - folder blangko ABT pribadi dikenali menurut nama, kelompok umum tidak.
 */

const AKAR = path.resolve(process.cwd(), "..");
const SEMENTARA = path.resolve("D:/Aplikasi/aleta/tmp", `uji-kartu-tautan-${process.pid}`);
mkdirSync(SEMENTARA, { recursive: true });
process.env.ALETA_ECOURT_SESSION_DIR = SEMENTARA;
process.env.ALETA_ECOURT_KREDENSIAL_DIR = SEMENTARA;
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const akunBot = require_(path.join(AKAR, "aleta_bot/services/ecourtAkunPenggunaService.js")) as Record<string, any>;

afterAll(() => rmSync(SEMENTARA, { recursive: true, force: true }));

const SANDI = "SandiPegawai-Uji-7x!";
const SUREL = "pp.taufik@uji.test";

const GRUP = [
  { id: 1, nama: "Gugatan & Permohonan", direktori: "gugatan_permohonan" },
  { id: 10, nama: "Blangko Lainnya", direktori: "blangko_lainnya" },
  { id: 99, nama: "Blangko Derry (Daftar s.d. Produk)", direktori: "derry_briantono" },
  { id: 700, nama: "Blangko Fikrianto", direktori: "Fikrianto" },
  { id: 701, nama: "Blangko Jurusita Donggala", direktori: "BLANGKO_JURUSITA_DONGGALA" },
];

describe("aturan murni kartu", () => {
  it("folder blangko pribadi menurut nama; kelompok umum tidak", () => {
    expect(folderPribadi("Derry Briantono, S.H.", GRUP).map((f) => f.direktori)).toEqual(["derry_briantono"]);
    expect(folderPribadi("Fikrianto, S.H.", GRUP).map((f) => f.direktori)).toEqual(["Fikrianto"]);
    expect(folderPribadi("Muh. Iqbal", GRUP)).toEqual([]);
    expect(folderPribadi("Hj. Nur Aisyah", GRUP)).toEqual([]);
  });

  it("nama akun e-Court dibandingkan dengan nama pegawai", () => {
    expect(namaEcourtCocok("Muhammad Taufik, S.H.", "MUHAMMAD TAUFIK")).toBe(true);
    expect(namaEcourtCocok("Muhammad Taufik", "Siti Rahma")).toBe(false);
    expect(namaEcourtCocok("Muhammad Taufik", "")).toBeNull();
  });

  it("keadaan e-Court: kosong, belum diuji, cocok, ditolak = tidak cocok, nama lain = tidak cocok", () => {
    const pegawai: PegawaiKartu[] = [{ id: "u1", name: "Muhammad Taufik", username: "pp", roleId: "panitera-pengganti", positionId: "pos-panitera-pengganti" }];
    const pratinjau = { baris: [], sippTanpaAkun: [], sippAkunLain: [], namaGandaSipp: [], namaGandaAleta: [], ringkasan: {} } as unknown as PratinjauTautan;
    const kartu = (akun: any[], sesi: any[] = []) =>
      susunKartuTautan({ pegawai, pratinjau, akunEcourt: akun, sesiEcourt: sesi, grupAbt: [], peranDiharapkan: () => ["panitera-pengganti"] })[0].ecourt[0];
    expect(kartu([]).keadaan).toBe("kosong");
    const a = { penggunaId: "u1", peran: "panitera-pengganti", email: SUREL, adaSandi: true };
    expect(kartu([a]).keadaan).toBe("belum-diuji");
    expect(kartu([{ ...a, hasilUji: "berhasil" }]).keadaan).toBe("cocok");
    expect(kartu([{ ...a, hasilUji: "ditolak" }]).keadaan).toBe("tidak-cocok");
    expect(kartu([{ ...a, hasilUji: "berhasil" }], [{ penggunaId: "u1", peran: "panitera-pengganti", keadaan: "tersambung", namaAkunEcourt: "Siti Rahma" }]).keadaan).toBe("tidak-cocok");
    expect(kartu([{ ...a, diisiOleh: "Dian Saputra" }]).diisiOleh).toBe("Dian Saputra");
  });
});

describe("bot: akun e-Court diisi admin", () => {
  it("menyimpan nama pengisi, tanpa sandi di daftar; disimpan pemilik sendiri = tanda pengisi hilang", () => {
    expect(akunBot.simpan({ penggunaId: "usr-ppg", peran: "panitera-pengganti", email: SUREL, sandi: SANDI, olehSiapa: "admin:usr-admin", diisiOleh: "Dian Saputra" }).ok).toBe(true);
    const baris = akunBot.daftarSemua().find((b: any) => b.penggunaId === "usr-ppg");
    expect(baris).toMatchObject({ email: SUREL, adaSandi: true, diisiOleh: "Dian Saputra" });
    expect(JSON.stringify(akunBot.daftarSemua())).not.toContain(SANDI);
    expect(readFileSync(akunBot.jalurSimpanan(), "latin1")).not.toContain(SANDI);
    expect(akunBot.ambil("usr-ppg", "panitera-pengganti")).toEqual({ email: SUREL, sandi: SANDI });
    expect(akunBot.simpan({ penggunaId: "usr-ppg", peran: "panitera-pengganti", email: SUREL, sandi: "", olehSiapa: "pengguna:usr-ppg" }).ok).toBe(true);
    expect(akunBot.daftarMilik("usr-ppg")[0].diisiOleh).toBe("");
    akunBot.hapus({ penggunaId: "usr-ppg", peran: "panitera-pengganti" });
  });
});

// ============================================================================
// Server atas pg-mem berbenih; bot dan SIPP ditiru lewat deps.
// ============================================================================
let db: AletaDatabase | null = null;
const d = () => db as AletaDatabase;

function sipp(username: string, namaLengkap: string, lain: Partial<{ diblokir: boolean }> = {}) {
  return { sippUserId: username, username, namaLengkap, pejabat: [], diblokir: lain.diblokir === true, kedaluwarsa: false, grup: [] };
}

type Panggilan = { jalur: string; badan: any };
function buatDeps(daftar: ReturnType<typeof sipp>[], catatan: Panggilan[]): DepsKartuTautan {
  return {
    daftarSipp: async () => ({ ok: true, data: { pengguna: daftar } }),
    rekapEcourt: async () => ({ ok: true, data: { akun: [], sesi: [] } }),
    grupAbt: async () => ({ ok: true, data: { grup: GRUP } }),
    simpanEcourt: async (badan) => {
      catatan.push({ jalur: "simpan", badan: { ...badan } });
      return { ok: true, data: { ok: true, alasan: "" } };
    },
    hapusEcourt: async (badan) => {
      catatan.push({ jalur: "hapus", badan: { ...badan } });
      return { ok: true, data: { ok: true } };
    },
    pengguna: async (x) => (await getUsersFromDb(x)).map((u) => ({ id: u.id, name: u.name, username: u.username, nip: u.nip, roleId: u.roleId, positionId: u.positionId, additionalRoleIds: u.additionalRoleIds ?? [], isActive: u.isActive !== false })),
  };
}

const ADMIN = { id: "usr-admin", roleId: "admin", name: "Dian Saputra" };
const SUPER = { id: "usr-super", roleId: "super-admin", name: "SUPER ADMIN DERRY" };

async function tautanSipp(userId: string) {
  return d().queryOne<{ external_username: string; tautan_sumber: string; is_enabled: number }>(
    "SELECT external_username, tautan_sumber, is_enabled FROM external_app_credentials WHERE user_id = ? AND app_id = 'sipp'",
    [userId]
  );
}

describe("server kartu tautan", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    await d().run("DELETE FROM external_app_credentials WHERE app_id = 'sipp'");
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("yang pasti ditautkan sendiri saat kartu dibuka; yang mirip saja tidak", async () => {
    const daftar = [sipp("taufik", "Muhammad Taufik"), sipp("ridwan.m", "M. Ridwan Saleh")];
    const h = await bacaKartuTautan(d(), ADMIN, buatDeps(daftar, []));
    expect(h.otomatis.ditautkan).toContainEqual({ userId: "usr-ppg", usernameSipp: "taufik" });
    expect(await tautanSipp("usr-ppg")).toMatchObject({ external_username: "taufik", tautan_sumber: "admin-massal" });
    const ppg = h.baris.find((b) => b.userId === "usr-ppg")!;
    expect(ppg.sipp).toMatchObject({ keadaan: "cocok", username: "taufik", otomatisBaru: true });
    expect(ppg.abt).toMatchObject({ keadaan: "cocok", username: "taufik" });
    expect(ppg.ecourt.map((e) => [e.peran, e.keadaan])).toEqual([["panitera-pengganti", "kosong"]]);
    // M. Ridwan vs "M. Ridwan Saleh": mirip, bukan sama -> tidak ditautkan, ditawarkan.
    expect(await tautanSipp("usr-panitera")).toBeFalsy();
    const pan = h.baris.find((b) => b.userId === "usr-panitera")!;
    expect(pan.sipp.keadaan).toBe("perlu-dipilih");
    expect(pan.sipp.saran.map((s) => s.username)).toContain("ridwan.m");
    const audit = JSON.stringify(await d().queryAll("SELECT action, entity_id, payload_json FROM audit_logs WHERE action = 'LINK_SIPP_ACCOUNT_BULK'"));
    expect(audit).toContain("usr-ppg");
    expect(audit).not.toContain("usr-panitera");
    // Dibuka kedua kali: tidak ada yang ditautkan ulang.
    expect((await bacaKartuTautan(d(), ADMIN, buatDeps(daftar, []))).otomatis.ditautkan).toEqual([]);
  });

  it("cocok lewat nama saja tetapi ada akun SIPP lain bernama mirip = TIDAK otomatis, ditawarkan semua calon", async () => {
    // Pola data satker 30 Okt: "Tiffany Rachmawati Suranto" = akun kasir, meja1p/meja1g bernama "Tiffany RS".
    const daftar = [sipp("taufik.kasir", "Muhammad Taufik"), sipp("meja1p", "M. Taufik")];
    const h = await bacaKartuTautan(d(), ADMIN, buatDeps(daftar, []));
    expect(h.otomatis.ditautkan).toEqual([]);
    expect(await tautanSipp("usr-ppg")).toBeFalsy();
    const ppg = h.baris.find((b) => b.userId === "usr-ppg")!;
    expect(ppg.sipp.keadaan).toBe("perlu-dipilih");
    expect(ppg.sipp.sebab).toContain("meja1p");
    expect(ppg.sipp.saran.map((s) => s.username)).toEqual(["taufik.kasir", "meja1p"]);
  });

  it("akun SIPP diblokir = tidak cocok; ABT ikut tertutup", async () => {
    const h = await bacaKartuTautan(d(), ADMIN, buatDeps([sipp("taufik", "Muhammad Taufik", { diblokir: true })], []));
    const ppg = h.baris.find((b) => b.userId === "usr-ppg")!;
    expect(ppg.sipp.keadaan).toBe("tidak-cocok");
    expect(await tautanSipp("usr-ppg")).toBeFalsy();
  });

  it("selain Super Admin/Admin ditolak", async () => {
    await expect(bacaKartuTautan(d(), { id: "usr-hakim", roleId: "hakim", name: "Hj. Nur Aisyah" }, buatDeps([], []))).rejects.toMatchObject({ status: 403 });
    await expect(
      isiEcourtPegawai(d(), { id: "usr-hakim", roleId: "hakim", name: "x" }, { penggunaId: "usr-ppg", peran: "panitera-pengganti", email: SUREL, sandi: SANDI }, buatDeps([], []))
    ).rejects.toMatchObject({ status: 403 });
  });

  it("isi akun e-Court pegawai: bot menerima pegawai + pengisi; audit tanpa surel dan sandi", async () => {
    const catatan: Panggilan[] = [];
    const masukan = { penggunaId: "usr-ppg", peran: "panitera-pengganti", email: SUREL, sandi: SANDI, alamatIp: "10.0.0.5" };
    const h = await isiEcourtPegawai(d(), ADMIN, masukan, buatDeps([], catatan));
    expect(h).toMatchObject({ ok: true });
    expect(JSON.stringify(h)).not.toContain(SANDI);
    expect(catatan[0].badan).toMatchObject({ penggunaId: "usr-ppg", peran: "panitera-pengganti", namaPengguna: "Muhammad Taufik", email: SUREL, sandi: SANDI, diisiOleh: "Dian Saputra", olehSiapa: "admin:usr-admin" });
    expect(masukan.sandi).toBe("");
    const audit = await d().queryAll<{ action: string; actor_user_id: string; entity_id: string; payload_json: string }>(
      "SELECT action, actor_user_id, entity_id, payload_json FROM audit_logs WHERE action = 'ECOURT_AKUN_PRIBADI_DIISI_ADMIN'"
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor_user_id: "usr-admin", entity_id: "usr-ppg:panitera-pengganti" });
    expect(audit[0].payload_json).toContain("diisi oleh Dian Saputra untuk Muhammad Taufik");
    expect(audit[0].payload_json).not.toContain(SANDI);
    expect(audit[0].payload_json).not.toContain(SUREL);
  });

  it("Admin tidak mengisi akun Super Admin; Super Admin boleh; peran tak dikenal ditolak", async () => {
    const catatan: Panggilan[] = [];
    await expect(isiEcourtPegawai(d(), ADMIN, { penggunaId: "usr-super", peran: "hakim", email: SUREL, sandi: SANDI }, buatDeps([], catatan))).rejects.toMatchObject({ status: 403 });
    expect(catatan).toHaveLength(0);
    expect((await isiEcourtPegawai(d(), SUPER, { penggunaId: "usr-super", peran: "hakim", email: SUREL, sandi: SANDI }, buatDeps([], catatan))).ok).toBe(true);
    await expect(isiEcourtPegawai(d(), SUPER, { penggunaId: "usr-ppg", peran: "dewa", email: SUREL, sandi: SANDI }, buatDeps([], catatan))).rejects.toMatchObject({ status: 400 });
    expect((await hapusEcourtPegawai(d(), ADMIN, { penggunaId: "usr-ppg", peran: "panitera-pengganti" }, buatDeps([], catatan))).ok).toBe(true);
    expect(catatan.at(-1)).toMatchObject({ jalur: "hapus", badan: { penggunaId: "usr-ppg", olehSiapa: "admin:usr-admin" } });
  });
});

describe("matriks peran dan rute", () => {
  let dbRute: AletaDatabase | null = null;
  let aktor: string | null = "usr-hakim";
  beforeEach(async () => {
    dbRute = await createAletaDatabase({ useInMemory: true, seed: true });
    vi.doMock("@/server/db/client", async (asli) => ({ ...(await asli<typeof import("@/server/db/client")>()), getDatabase: async () => dbRute }));
    vi.doMock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.doUnmock("@/server/db/client");
    vi.doUnmock("@/server/shared/auth");
    vi.resetModules();
    await dbRute?.close();
    dbRute = null;
  });

  it("aksi tautan-akun.atur hanya Super Admin dan Admin", async () => {
    expect(AKSI["tautan-akun.atur"].golongan).toEqual([]);
    const akun = async (id: string) => (await getUsersFromDb(dbRute as AletaDatabase)).find((u) => u.id === id)!;
    expect(bolehAksi(await akun("usr-admin"), "tautan-akun.atur")).toBe(true);
    expect(bolehAksi(await akun("usr-super"), "tautan-akun.atur")).toBe(true);
    expect(bolehAksi(await akun("usr-ppg"), "tautan-akun.atur")).toBe(false);
  });

  it("rute: hakim 403; admin isi-ecourt - jawaban tanpa sandi, bot menerima pegawai", async () => {
    const kiriman: Array<{ url: string; badan: any }> = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      kiriman.push({ url: String(url), badan: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(JSON.stringify({ ok: false, alasan: `ditolak ${SANDI}` }), { status: 400, headers: { "content-type": "application/json" } });
    });
    const r = (await import("@/app/api/admin/tautan-akun/route")) as unknown as Record<string, (q: NextRequest) => Promise<Response>>;
    const minta = (badan: unknown) =>
      new NextRequest("http://localhost/api/admin/tautan-akun", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) });
    aktor = "usr-hakim";
    expect((await r.POST(minta({ aksi: "isi-ecourt", penggunaId: "usr-ppg", peran: "panitera-pengganti", email: SUREL, sandi: SANDI }))).status).toBe(403);
    expect(kiriman).toHaveLength(0);
    aktor = "usr-admin";
    const j = await r.POST(minta({ aksi: "isi-ecourt", penggunaId: "usr-ppg", peran: "panitera-pengganti", email: SUREL, sandi: SANDI }));
    const teks = await j.text();
    expect(teks).not.toContain(SANDI);
    expect(JSON.parse(teks).data).toMatchObject({ ok: false });
    expect(kiriman[0].url).toContain("/internal/aleta-bot/ecourt-pengguna/akun/simpan");
    expect(kiriman[0].badan).toMatchObject({ penggunaId: "usr-ppg", diisiOleh: "Dian Saputra" });
  });

  it("bot: rute grup-blangko dan diisiOleh terdaftar; tidak ada rute yang membuka sandi", () => {
    const abt = readFileSync(path.join(AKAR, "aleta_bot/routes/abtPengaturanRoutes.js"), "utf8");
    expect(abt).toMatch(/router\.get\("\/grup-blangko"/);
    const ec = readFileSync(path.join(AKAR, "aleta_bot/routes/ecourtAksiRoutes.js"), "utf8");
    expect(ec).toMatch(/diisiOleh: String\(req\.body\?\.diisiOleh/);
    expect(ec).not.toMatch(/akunPengguna\.ambil\s*\(/);
  });
});
