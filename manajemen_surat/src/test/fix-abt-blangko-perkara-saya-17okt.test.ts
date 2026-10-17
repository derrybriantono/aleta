// @vitest-environment node
/**
 * Perbaikan temuan audit ABT (17 Okt 2026), rute perkara-saya:
 *   C2  Ketua/Wakil Ketua: SEMUA perkara satker (putusan), bukan hanya perkara majelisnya; "Lihat sebagai" tetap hanya admin
 *   C3  PTSP: pencarian nomor perkara satker (baca saja, tanpa peran tulis putusan/BAS/relaas) supaya folder "99 PTSP" terjangkau
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { susunPerkaraSaya, type BarisSidangSaya } from "@/app/api/aleta-ecourt/perkara-saya/susun";

const baris = (nomor: string, tanggal: string, extra: Partial<BarisSidangSaya> = {}): BarisSidangSaya => ({
  sidangId: `${nomor}-${tanggal}`,
  perkaraId: `id${nomor}`,
  nomorPerkara: `${nomor}/Pdt.G/2026/PA.Dgl`,
  jenisPerkara: "Cerai Gugat",
  alurPerkaraId: 15,
  tanggalSidang: tanggal,
  jamSidang: "09:00:00",
  agenda: "Sidang Pertama",
  majelisNama: "Drs. H. Fulan Bin Alan, S.H., M.H., Mazidah, S.Ag., M.H.",
  paniteraNama: "Sri Susilowati, S.H.",
  jurusitaNama: "Mohammad Syukri",
  ...extra,
});

const rute = vi.hoisted(() => ({
  aktor: { name: "Mazidah", roleId: "hakim" } as Record<string, unknown>,
  jawab: null as null | (() => unknown),
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => rute.aktor }));
vi.mock("@/lib/permissions", () => ({
  isPrivilegedAdmin: (u: { roleId?: string } | null) => u?.roleId === "admin" || u?.roleId === "super-admin",
}));
vi.mock("@/lib/waktu-pengadilan", () => ({ waktuPengadilan: () => ({ tanggal: "2026-10-15", jam: "09:00:00" }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayJadwalSidang: async () => ({
    ok: true,
    data: { sidang: [baris("581", "2026-10-15"), baris("512", "2026-10-15", { majelisNama: "Budi Santoso, S.H.", paniteraNama: "Siti Aminah" })] },
  }),
}));

async function jalankan(kueri = "") {
  const mod = await import("@/app/api/aleta-ecourt/perkara-saya/route");
  const r = await mod.GET({ nextUrl: new URL(`http://uji.local/api/aleta-ecourt/perkara-saya${kueri}`) } as unknown as Parameters<typeof mod.GET>[0]);
  return { status: r.status, isi: (await r.json()) as { ok: boolean; data?: any } };
}
const nomor3 = (r: { isi: { data?: any } }) => r.isi.data.perkara.map((p: any) => p.nomorPerkara.slice(0, 3)).sort();

describe("C2. Ketua / Wakil Ketua melihat semua perkara satker (putusan)", () => {
  beforeEach(() => {
    rute.aktor = { name: "Ketua PA", roleId: "ketua" };
  });

  it("Ketua: dua perkara walau namanya tidak di majelis; peran dokumen hanya hakim (putusan); tanpa daftar akun", async () => {
    const r = await jalankan();
    expect(r.status).toBe(200);
    expect(r.isi.data.lihatSemua).toBe(true);
    expect(nomor3(r)).toEqual(["512", "581"]);
    for (const p of r.isi.data.perkara) expect(p.sebagai).toEqual(["hakim"]);
    expect(r.isi.data.akun).toBeNull();
  });

  it("Wakil Ketua sama; 'Lihat sebagai' tetap hanya untuk admin (diabaikan bagi Ketua/Wakil)", async () => {
    rute.aktor = { name: "Wakil PA", roleId: "wakil-ketua" };
    const r = await jalankan("?sebagai=Budi&peranSebagai=hakim");
    expect(nomor3(r)).toEqual(["512", "581"]);
    expect(r.isi.data.sebagaiNama).toBe("");
    expect(r.isi.data.sebagaiPeran).toBeNull();
  });

  it("hakim biasa tetap hanya perkara majelisnya; admin tetap semua peran + daftar akun", async () => {
    rute.aktor = { name: "Mazidah", roleId: "hakim" };
    expect(nomor3(await jalankan())).toEqual(["512", "581"].filter((n) => n === "581"));
    rute.aktor = { name: "Super Admin", roleId: "super-admin" };
    const a = await jalankan();
    expect(a.isi.data.perkara[0].sebagai).toEqual(["hakim", "pp", "js"]);
    expect(a.isi.data.akun).not.toBeNull();
  });
});

describe("C3. PTSP mencari nomor perkara satker (baca saja)", () => {
  beforeEach(() => {
    rute.aktor = { name: "Petugas PTSP", roleId: "pelaksana", positionId: "pos-ptsp" };
  });

  it("tanpa nomor: daftar kosong, ptspCari menyala, bukan pesan 'nama tidak ditemukan'", async () => {
    const r = await jalankan("?mode=semua");
    expect(r.isi.data.perkara).toEqual([]);
    expect(r.isi.data.ptspCari).toBe(true);
    expect(r.isi.data.adaYangCocok).toBe(true);
  });

  it("dengan nomor: perkara satker yang cocok, tanpa peran tulis (sebagai kosong)", async () => {
    const r = await jalankan("?mode=semua&nomor=581");
    expect(nomor3(r)).toEqual(["581"]);
    expect(r.isi.data.perkara[0].sebagai).toEqual([]);
    expect(r.isi.data.lihatSemua).toBe(false);
    expect(r.isi.data.akun).toBeNull();
  });

  it("bukan PTSP (hakim) yang mengirim nomor: diabaikan, tetap perkara majelisnya", async () => {
    rute.aktor = { name: "Mazidah", roleId: "hakim" };
    const r = await jalankan("?nomor=512");
    expect(nomor3(r)).toEqual(["581"]);
    expect(r.isi.data.ptspCari).toBe(false);
  });
});

describe("C3. susun murni: cariNomorSatker", () => {
  const sumber = [baris("581", "2026-10-15"), baris("512", "2026-10-15")];
  it("hanya yang nomornya memuat kata kunci; sebagai kosong bila bukan majelis/PP/juru sita akun itu", () => {
    const h = susunPerkaraSaya(sumber, { hariIni: "2026-10-15", nama: "Petugas PTSP", lihatSemua: false, cariNomorSatker: true, cariNomor: "512" });
    expect(h.perkara.map((p) => p.nomorPerkara.slice(0, 3))).toEqual(["512"]);
    expect(h.perkara[0].sebagai).toEqual([]);
    expect(h.adaYangCocok).toBe(true);
  });
});
