/**
 * ============================================================================
 * 16 OKT 2026 - RUTE BACA SAJA "PERKARA SAYA" (TAHAP D BLANGKO ABT BY DERRY BRIANTONO)
 * ============================================================================
 *
 * A. susun.ts (murni): perkara milik akun menurut majelis / panitera
 *    pengganti / juru sita, gagal-TERTUTUP, admin melihat semua dan dapat
 *    melihat sebagai satu akun, rentang tanggal dan pemecahan per minggu
 * B. GET /aleta-ecourt/perkara-saya: jadwal LANGSUNG dari bot (tanpa efek
 *    samping rute /sidang), kewenangan "panel", 400 untuk masukan salah,
 *    502 bila satu potongan gagal, tanda terpotong
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HARI_DEPAN_SEMUA,
  HARI_LALU_SEMUA,
  indeksSidangAcuan,
  potongRentang,
  sebagaiApa,
  susunPerkaraSaya,
  tentukanRentang,
  type BarisSidangSaya,
} from "@/app/api/aleta-ecourt/perkara-saya/susun";

const HARI_INI = "2026-10-15";
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

describe("A. susunPerkaraSaya", () => {
  const SEMUA = [
    baris("581", "2026-10-01", { alasanDitunda: "Panggil Tergugat", urutanSidang: 1 }),
    baris("581", "2026-10-15", { alasanDitunda: "0", urutanSidang: 2, sudahPutus: true, tanggalPutusan: "2026-10-15T00:00:00.000Z", adaBerkasPutusan: false, adaBas: true }),
    baris("512", "2026-10-15", { majelisNama: "Budi Santoso, S.H.", paniteraNama: "Siti Aminah", jurusitaNama: "Mohammad Syukri, S.H." }),
    baris("540", "2026-10-19", { majelisNama: "Mazidah", paniteraNama: "Siti Aminah", jurusitaNama: "Ali" }),
  ];

  it("hakim: hanya perkara yang majelisnya memuat namanya (gelar dibuang), satu baris per perkara dengan seluruh sidangnya", () => {
    const h = susunPerkaraSaya(SEMUA, { hariIni: HARI_INI, nama: "Mazidah", lihatSemua: false });
    expect(h.perkara.map((p) => p.nomorPerkara)).toEqual(["540/Pdt.G/2026/PA.Dgl", "581/Pdt.G/2026/PA.Dgl"]);
    expect(h.perkara.every((p) => p.sebagai.join() === "hakim")).toBe(true);
    const p581 = h.perkara[1];
    expect(p581.sidang.map((s) => s.tanggal)).toEqual(["2026-10-01", "2026-10-15"]);
    // "0" di alasan_ditunda = tidak ada keterangan; tanggal putusan dipangkas ke tanggal.
    expect(p581.sidang.map((s) => s.ket)).toEqual(["Panggil Tergugat", ""]);
    expect(p581).toMatchObject({ sudahPutus: true, tanggalPutusan: "2026-10-15", adaBerkasPutusan: false });
    expect(h.jumlahSemua).toBe(3);
    expect(h.adaYangCocok).toBe(true);
    expect(h.akun).toBeNull();
  });

  it("panitera pengganti dan juru sita dicocokkan pada ruasnya sendiri", () => {
    expect(susunPerkaraSaya(SEMUA, { hariIni: HARI_INI, nama: "Siti Aminah", lihatSemua: false }).perkara.map((p) => p.nomorPerkara.slice(0, 3))).toEqual(["512", "540"]);
    const js = susunPerkaraSaya(SEMUA, { hariIni: HARI_INI, nama: "Mohammad Syukri", lihatSemua: false });
    expect(js.perkara.map((p) => p.nomorPerkara.slice(0, 3))).toEqual(["512", "581"]);
    expect(js.perkara.every((p) => p.sebagai.join() === "js")).toBe(true);
  });

  it("gagal-TERTUTUP: nama yang tidak ketemu = daftar kosong dengan adaYangCocok salah (bukan seluruh satker)", () => {
    const h = susunPerkaraSaya(SEMUA, { hariIni: HARI_INI, nama: "Orang Lain Sekali", lihatSemua: false });
    expect(h.perkara).toEqual([]);
    expect(h.adaYangCocok).toBe(false);
    expect(h.jumlahSemua).toBe(3);
    // Nama kosong juga tidak mencocoki siapa pun.
    expect(susunPerkaraSaya(SEMUA, { hariIni: HARI_INI, nama: "", lihatSemua: false }).perkara).toEqual([]);
  });

  it("dua orang berbeda dengan potongan nama mirip tidak saling terbawa (M. Tang vs Sudarmin H.I.M. Tang)", () => {
    const b = [baris("1", "2026-10-15", { majelisNama: "Sudarmin H.I.M. Tang, S.H.I., M.H." }), baris("2", "2026-10-15", { majelisNama: "M. Tang" })];
    const h = susunPerkaraSaya(b, { hariIni: HARI_INI, nama: "M. Tang", lihatSemua: false });
    expect(h.perkara.map((p) => p.nomorPerkara.slice(0, 1))).toEqual(["2"]);
  });

  it("admin: semua perkara, bertanda semua peran, dengan daftar akun untuk 'Lihat sebagai akun'", () => {
    const h = susunPerkaraSaya(SEMUA, { hariIni: HARI_INI, nama: "Super Admin", lihatSemua: true });
    expect(h.perkara.length).toBe(3);
    expect(h.perkara[0].sebagai).toEqual(["hakim", "pp", "js"]);
    expect(h.akun!.hakim).toEqual(expect.arrayContaining(["Budi Santoso, S.H.", "Mazidah, S.Ag., M.H."]));
    expect(h.akun!.pp).toEqual(["Siti Aminah", "Sri Susilowati, S.H."]);
    // Mohammad Syukri ditulis dua ejaan di data ("Mohammad Syukri" dan "Mohammad Syukri, S.H."): sejak 20 Okt 2026 satu orang
    // satu entri bernama lengkap (lib/orang-unik); pencarian lewat nama tetap mendapat perkara kedua ejaan.
    expect(h.akun!.js).toEqual(["Ali", "Mohammad Syukri, S.H."]);
    expect(h.adaYangCocok).toBe(true);
  });

  it("admin melihat sebagai satu akun pada satu peran: hanya ruas peran itu yang dicocokkan", () => {
    const sebagaiPP = susunPerkaraSaya(SEMUA, { hariIni: HARI_INI, nama: "Super Admin", lihatSemua: true, sebagaiNama: "Siti Aminah", sebagaiPeran: "pp" });
    expect(sebagaiPP.perkara.map((p) => p.nomorPerkara.slice(0, 3))).toEqual(["512", "540"]);
    expect(sebagaiPP.perkara[0].sebagai).toEqual(["pp"]);
    // Nama hakim dipilih tetapi diminta sebagai juru sita: tidak cocok.
    expect(susunPerkaraSaya(SEMUA, { hariIni: HARI_INI, nama: "Super Admin", lihatSemua: true, sebagaiNama: "Mazidah", sebagaiPeran: "js" }).perkara).toEqual([]);
    // Daftar akun tetap lengkap walau sedang menyempit.
    expect(sebagaiPP.akun!.hakim.length).toBeGreaterThan(1);
  });

  it("'sebagai' diabaikan bagi bukan admin", () => {
    const h = susunPerkaraSaya(SEMUA, { hariIni: HARI_INI, nama: "Mazidah", lihatSemua: false, sebagaiNama: "Siti Aminah", sebagaiPeran: "pp" });
    expect(h.perkara.every((p) => p.sebagai.join() === "hakim")).toBe(true);
    expect(h.akun).toBeNull();
  });

  it("perkara tingkat ruas dibaca dari sidang TERAKHIR (majelis diganti di tengah jalan)", () => {
    const b = [
      baris("9", "2026-09-01", { majelisNama: "Hakim Lama" }),
      baris("9", "2026-10-10", { majelisNama: "Hakim Baru" }),
    ];
    expect(susunPerkaraSaya(b, { hariIni: HARI_INI, nama: "Hakim Baru", lihatSemua: false }).perkara.length).toBe(1);
    expect(susunPerkaraSaya(b, { hariIni: HARI_INI, nama: "Hakim Lama", lihatSemua: false }).perkara.length).toBe(0);
  });

  it("baris kembar dibuang; ruas yang tidak dikirim bot lama menjadi null, bukan false", () => {
    const b = [baris("7", "2026-10-15"), baris("7", "2026-10-15")];
    const h = susunPerkaraSaya(b, { hariIni: HARI_INI, nama: "Mazidah", lihatSemua: false });
    expect(h.perkara[0].sidang.length).toBe(1);
    expect(h.perkara[0]).toMatchObject({ adaBerkasPutusan: null, lewatEcourt: null });
    expect(h.perkara[0].sidang[0].adaBas).toBeNull();
  });

  it("sebagaiApa dan indeksSidangAcuan", () => {
    expect(sebagaiApa(baris("1", "2026-10-15"), "Mazidah")).toEqual(["hakim"]);
    expect(sebagaiApa(baris("1", "2026-10-15"), "Mazidah", "pp")).toEqual([]);
    expect(indeksSidangAcuan([{ tanggal: "2026-10-01" }, { tanggal: "2026-10-15" }, { tanggal: "2026-10-22" }], HARI_INI)).toBe(1);
    expect(indeksSidangAcuan([{ tanggal: "2026-10-19" }], HARI_INI)).toBe(0);
    expect(indeksSidangAcuan([], HARI_INI)).toBe(-1);
  });
});

describe("A. rentang tanggal", () => {
  it("hari = hari ini; semua = 90 hari lalu s.d. 45 hari ke depan", () => {
    expect(tentukanRentang({ mode: "hari" }, HARI_INI)).toEqual({ ok: true, mode: "hari", dari: HARI_INI, sampai: HARI_INI });
    const semua = tentukanRentang({ mode: "semua" }, HARI_INI);
    expect(semua).toEqual({ ok: true, mode: "semua", dari: "2026-07-17", sampai: "2026-11-29" });
    expect(HARI_LALU_SEMUA).toBe(90);
    expect(HARI_DEPAN_SEMUA).toBe(45);
    expect(tentukanRentang({}, HARI_INI)).toMatchObject({ mode: "hari" });
  });

  it("rentang: format, urutan, dan paling lama 62 hari", () => {
    expect(tentukanRentang({ mode: "rentang", dari: "2026-10-12", sampai: "2026-10-16" }, HARI_INI)).toMatchObject({ ok: true, dari: "2026-10-12", sampai: "2026-10-16" });
    expect(tentukanRentang({ mode: "rentang", dari: "2026-10-12" }, HARI_INI)).toMatchObject({ ok: true, sampai: "2026-10-12" });
    expect(tentukanRentang({ mode: "rentang", dari: "12-10-2026", sampai: "2026-10-16" }, HARI_INI)).toMatchObject({ ok: false });
    expect(tentukanRentang({ mode: "rentang", dari: "2026-10-16", sampai: "2026-10-12" }, HARI_INI)).toMatchObject({ ok: false });
    expect(tentukanRentang({ mode: "rentang", dari: "2026-01-01", sampai: "2026-06-30" }, HARI_INI)).toMatchObject({ ok: false });
    expect(tentukanRentang({ mode: "rentang", dari: "2026-09-01", sampai: "2026-11-01" }, HARI_INI)).toMatchObject({ ok: true }); // 62 hari
    expect(tentukanRentang({ mode: "aneh" }, HARI_INI)).toMatchObject({ ok: false });
  });

  it("dipecah per minggu tanpa celah dan tanpa tumpang tindih", () => {
    const p = potongRentang("2026-07-17", "2026-11-29");
    expect(p[0]).toEqual({ dari: "2026-07-17", sampai: "2026-07-23" });
    expect(p[p.length - 1].sampai).toBe("2026-11-29");
    for (let i = 1; i < p.length; i++) {
      const sebelum = new Date(`${p[i - 1].sampai}T00:00:00Z`).getTime();
      expect(new Date(`${p[i].dari}T00:00:00Z`).getTime() - sebelum).toBe(86_400_000);
    }
    expect(potongRentang("2026-10-15", "2026-10-15")).toEqual([{ dari: "2026-10-15", sampai: "2026-10-15" }]);
  });
});

// ============================================================================
// B. RUTE
// ============================================================================
const rute = vi.hoisted(() => ({
  aktor: { name: "Mazidah", roleId: "hakim" } as Record<string, unknown>,
  diminta: [] as Array<{ dari: string; sampai: string; cari: string; batas: number }>,
  jawab: ((p: { dari: string }) => ({ ok: true, data: { sidang: [] as unknown[] } })) as (p: { dari: string; sampai: string }) => { ok: boolean; data?: { sidang: unknown[] }; error?: string },
  kapabilitas: [] as string[],
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async (_db: unknown, _id: unknown, k: string) => {
    rute.kapabilitas.push(k);
    return rute.aktor;
  },
}));
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
  getGatewayJadwalSidang: async (p: { dari: string; sampai: string; cari: string; batas: number }) => {
    rute.diminta.push(p);
    return rute.jawab(p);
  },
}));

async function jalankan(kueri = "") {
  const mod = await import("@/app/api/aleta-ecourt/perkara-saya/route");
  const r = await mod.GET({ nextUrl: new URL(`http://uji.local/api/aleta-ecourt/perkara-saya${kueri}`) } as unknown as Parameters<typeof mod.GET>[0]);
  return { status: r.status, isi: (await r.json()) as { ok: boolean; alasan?: string; data?: any } };
}

describe("B. rute GET perkara-saya", () => {
  beforeEach(() => {
    rute.aktor = { name: "Mazidah", roleId: "hakim" };
    rute.diminta = [];
    rute.kapabilitas = [];
    rute.jawab = () => ({ ok: true, data: { sidang: [baris("581", "2026-10-15"), baris("512", "2026-10-15", { majelisNama: "Budi" })] } });
  });

  it("bawaan sidang hari ini; kewenangan 'panel'; jadwal langsung dari bot; hanya perkara milik akun", async () => {
    const r = await jalankan();
    expect(r.status).toBe(200);
    expect(rute.kapabilitas).toEqual(["panel"]);
    expect(rute.diminta).toEqual([{ dari: "2026-10-15", sampai: "2026-10-15", cari: "", batas: 500 }]);
    expect(r.isi.data).toMatchObject({ hariIni: "2026-10-15", mode: "hari", lihatSemua: false, adaYangCocok: true, terpotong: false, nama: "Mazidah" });
    expect(r.isi.data.perkara.map((p: any) => p.nomorPerkara)).toEqual(["581/Pdt.G/2026/PA.Dgl"]);
    expect(r.isi.data.akun).toBeNull();
  });

  it("masukan salah dijawab 400 dan bot tidak dipanggil", async () => {
    for (const q of ["?mode=rentang&dari=besok", "?mode=rentang&dari=2026-10-16&sampai=2026-10-12", "?mode=semuanya"]) {
      const r = await jalankan(q);
      expect(r.status, q).toBe(400);
      expect(r.isi.ok).toBe(false);
    }
    expect(rute.diminta).toEqual([]);
  });

  it("'semua' dipecah per minggu, dibaca serentak terbatas, dan digabung", async () => {
    rute.jawab = ({ dari }) => ({ ok: true, data: { sidang: [baris("581", dari)] } });
    const r = await jalankan("?mode=semua");
    expect(r.status).toBe(200);
    expect(rute.diminta.length).toBe(20);
    expect(rute.diminta[0].dari).toBe("2026-07-17");
    expect(rute.diminta[rute.diminta.length - 1].sampai).toBe("2026-11-29");
    // Satu perkara dengan 20 sidang (satu per potongan).
    expect(r.isi.data.perkara.length).toBe(1);
    expect(r.isi.data.perkara[0].sidang.length).toBe(20);
  });

  it("satu potongan gagal = 502 beserta sebabnya, bukan daftar separuh", async () => {
    rute.jawab = ({ dari }) => (dari === "2026-08-07" ? { ok: false, error: "ALETA Bot tidak terjangkau" } : { ok: true, data: { sidang: [] } });
    const r = await jalankan("?mode=semua");
    expect(r.status).toBe(502);
    expect(r.isi.alasan).toBe("ALETA Bot tidak terjangkau");
  });

  it("potongan yang penuh (500 baris) ditandai terpotong", async () => {
    rute.jawab = () => ({ ok: true, data: { sidang: Array.from({ length: 500 }, (_, i) => baris(String(1000 + i), "2026-10-15")) } });
    const r = await jalankan();
    expect(r.isi.data.terpotong).toBe(true);
  });

  it("nama akun tidak ketemu: daftar kosong + adaYangCocok salah (gagal-tertutup)", async () => {
    rute.aktor = { name: "Nama Yang Tidak Ada", roleId: "hakim" };
    const r = await jalankan();
    expect(r.isi.data.perkara).toEqual([]);
    expect(r.isi.data.adaYangCocok).toBe(false);
    expect(r.isi.data.jumlahSemua).toBe(2);
  });

  it("admin: semua perkara + daftar akun; 'sebagai' menyempit ke satu akun dan satu peran", async () => {
    rute.aktor = { name: "Super Admin", roleId: "super-admin" };
    const semua = await jalankan();
    expect(semua.isi.data).toMatchObject({ lihatSemua: true, adaYangCocok: true });
    expect(semua.isi.data.perkara.length).toBe(2);
    expect(semua.isi.data.akun.pp).toEqual(["Sri Susilowati, S.H."]);
    const sebagai = await jalankan("?sebagai=Budi&peranSebagai=hakim");
    expect(sebagai.isi.data.perkara.map((p: any) => p.nomorPerkara.slice(0, 3))).toEqual(["512"]);
    expect(sebagai.isi.data).toMatchObject({ sebagaiNama: "Budi", sebagaiPeran: "hakim" });
  });

  it("bukan admin: 'sebagai' diabaikan", async () => {
    const r = await jalankan("?sebagai=Budi&peranSebagai=hakim");
    expect(r.isi.data.perkara.map((p: any) => p.nomorPerkara.slice(0, 3))).toEqual(["581"]);
    expect(r.isi.data.sebagaiNama).toBe("");
  });

  it("rute tidak menulis apa pun: tidak mengimpor rekam antrian, tidak ada metode selain GET", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const sumber = readFileSync(path.resolve(process.cwd(), "src/app/api/aleta-ecourt/perkara-saya/route.ts"), "utf8");
    expect(sumber).not.toMatch(/rekamAntrian|export async function (POST|PUT|PATCH|DELETE)/);
    expect(sumber).toContain("getGatewayJadwalSidang");
  });
});
