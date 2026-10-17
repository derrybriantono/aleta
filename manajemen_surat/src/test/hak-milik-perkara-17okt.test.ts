// @vitest-environment node
/**
 * ============================================================================
 * AUDIT ABT A4 (17 Okt 2026) - UNGGAH e-DOC HANYA PERKARA MILIK AKUN
 * ============================================================================
 *
 * Sebelumnya rute unggah-sipp (putusan) hanya memeriksa PERAN: hakim mana pun
 * dapat mengunggah putusan perkara hakim lain. Rute BAS: PP mana pun (juga
 * ganti=1) dapat mengunggah BAS perkara PP lain. Kini nama akun dicocokkan
 * dengan majelis / PP perkara itu (namaCocokSatu, sama dengan layar Unggah
 * massal); Super Admin/Admin/Ketua/Wakil (putusan) dan Admin/Panitera/Panmud/
 * Analis (BAS) mengawasi dan tetap boleh. Jaringan dan basis data tiruan.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { nilaiMilikPerkara, PESAN_BUKAN_MAJELIS, PESAN_BUKAN_PP, PESAN_PETUGAS_TAK_TERBACA } from "@/server/modules/aleta-ecourt/hak-milik-perkara";

const AKAR = path.resolve(process.cwd(), "..");
const req = createRequire(import.meta.url);

const rute = vi.hoisted(() => ({
  aktor: null as unknown,
  peran: "hakim",
  petugas: { ok: true, data: { ok: true, majelis: ["Hakim Satu, S.H."], panitera: ["Andini Puspita Sari, S.Sy."] } } as Record<string, unknown>,
  panggilCek: 0,
  unggahPutusan: [] as Array<Record<string, unknown>>,
  unggahBas: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({ queryAll: async () => [] }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => rute.aktor }));
vi.mock("@/server/modules/aleta-ecourt/hak-putusan", () => ({
  pastikanBolehUnggahPutusan: async () => ({ actor: rute.aktor, peran: rute.peran }),
  peranUnggahPutusan: (u: { roleId?: string } | null) => (u && ["hakim", "ketua", "wakil-ketua", "admin", "super-admin"].includes(String(u.roleId)) ? String(u.roleId) : null),
  bolehUnggahPutusan: () => true,
}));
vi.mock("@/app/api/aleta-ecourt/putusan/perkara-dari-id", () => ({
  selaraskanPerkaraDariId: async (p: { perkaraId: string; nomorPerkara: string }) => ({ ok: true, perkaraId: p.perkaraId || "9851", nomorPerkara: p.nomorPerkara }),
}));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayStatusPerkara: async () => ({ ok: true, data: { identitas: { perkaraId: "9851" } } }),
  getGatewaySippKonteks: async () => ({ ok: true, data: { nomorPihak: [{ nama: "Wulandari binti Kartasasmita", jenis: "pihak" }, { nama: "Hendrawan bin Sulaiman", jenis: "pihak" }] } }),
  getGatewayUnggahMassalCek: async () => {
    rute.panggilCek += 1;
    return rute.petugas;
  },
  gatewayUnggahPutusanSipp: async (m: Record<string, unknown>) => {
    rute.unggahPutusan.push(m);
    return { ok: true, data: { ok: true } };
  },
  gatewayUnggahBasSipp: async (m: Record<string, unknown>) => {
    rute.unggahBas.push(m);
    return { ok: true, data: { ok: true, jalur: "resources/file/doc/2026/09/x.rtf", nama: "x.rtf", urutan: 2, bentuk: "rtf", diganti: false, jalurLama: "" } };
  },
}));

const AKTOR = {
  hakimSatu: { id: "usr_h1", name: "Hakim Satu", roleId: "hakim", additionalRoleIds: [] },
  hakimDua: { id: "usr_h2", name: "Hakim Dua", roleId: "hakim", additionalRoleIds: [] },
  ketua: { id: "usr_k", name: "Ketua Lain", roleId: "ketua", additionalRoleIds: [] },
  admin: { id: "usr_a", name: "Admin", roleId: "admin", additionalRoleIds: [] },
  pp: { id: "usr_p", name: "Andini Puspita Sari", roleId: "panitera-pengganti", additionalRoleIds: [] },
  ppLain: { id: "usr_p2", name: "Budi Santoso", roleId: "panitera-pengganti", additionalRoleIds: [] },
  panitera: { id: "usr_pn", name: "Panitera Satu", roleId: "panitera", additionalRoleIds: [] },
} as const;

const NOMOR = "348/Pdt.G/2026/PA.Dgl";
const rtfBita = (baris: string[]) => `{\\rtf1\\ansi ${baris.join("\\par ")}}`;
const PUTUSAN = rtfBita([
  "SALINAN",
  "PUTUSAN",
  `Nomor ${NOMOR}`,
  "DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA",
  "PENGADILAN AGAMA DONGGALA",
  "Memeriksa dan mengadili perkara tertentu pada tingkat pertama telah menjatuhkan putusan dalam perkara Cerai Gugat antara:",
  "Wulandari binti Kartasasmita, sebagai Penggugat;",
  "melawan",
  "Hendrawan bin Sulaiman, sebagai Tergugat;",
  "DUDUK PERKARA",
  `Bahwa Penggugat dengan surat gugatannya yang terdaftar dalam register Nomor ${NOMOR} mengemukakan hal-hal berikut;`,
  "PERTIMBANGAN HUKUM",
  "Menimbang, bahwa maksud dan tujuan gugatan Penggugat adalah sebagaimana diuraikan di atas;",
  "MENGADILI:",
  "1. Mengabulkan gugatan Penggugat secara verstek;",
  "Demikian diputuskan dalam rapat musyawarah Majelis Hakim pada hari Selasa tanggal 1 September 2026;",
  `Putusan Nomor ${NOMOR}`,
]);
const BAS_RTF = "{\\rtf1 BERITA ACARA SIDANG Nomor 582/Pdt.G/2026/PA.Dgl}";

beforeEach(() => {
  rute.petugas = { ok: true, data: { ok: true, majelis: ["Hakim Satu, S.H."], panitera: ["Andini Puspita Sari, S.Sy."] } };
  rute.panggilCek = 0;
  rute.unggahPutusan = [];
  rute.unggahBas = [];
});

async function unggahPutusan(aktor: unknown, peran: string) {
  rute.aktor = aktor;
  rute.peran = peran;
  const mod = await import("@/app/api/aleta-ecourt/putusan/unggah-sipp/route");
  const f = new FormData();
  f.set("perkaraId", "9851");
  f.set("nomorPerkara", NOMOR);
  f.set("putusan", new Blob([Buffer.from(PUTUSAN, "latin1")], { type: "application/rtf" }), "putusan.rtf");
  try {
    const r = await mod.POST(new NextRequest("http://uji.local/aleta/api/aleta-ecourt/putusan/unggah-sipp", { method: "POST", body: f }));
    return { status: r.status, isi: await r.json() };
  } catch (galat) {
    const g = galat as { status?: number; message?: string };
    return { status: g.status ?? 500, isi: { error: { message: g.message } } };
  }
}

async function unggahBas(aktor: unknown, tambah: Record<string, string> = {}) {
  rute.aktor = aktor;
  const mod = await import("@/app/api/aleta-ecourt/bas/unggah-sipp/route");
  const f = new FormData();
  f.set("perkaraId", "10134");
  f.set("sidangId", "501");
  f.set("nomorPerkara", "582/Pdt.G/2026/PA.Dgl");
  f.set("bas", new Blob([Buffer.from(BAS_RTF, "latin1")], { type: "application/rtf" }), "bas.rtf");
  for (const [k, v] of Object.entries(tambah)) f.set(k, v);
  const r = await mod.POST(new NextRequest("http://uji.local/aleta/api/aleta-ecourt/bas/unggah-sipp", { method: "POST", body: f }));
  return { status: r.status, isi: await r.json() };
}

describe("A4 - nilaiMilikPerkara (murni)", () => {
  it("cocok = ok; tidak cocok = 403 dengan kalimat awam; tidak terbaca = 502; pengawas selalu ok", () => {
    expect(nilaiMilikPerkara({ jenis: "putusan", namaAkun: "Hakim Satu", pengawas: false, petugas: ["Hakim Satu, S.H.", "Lain Lagi"] })).toEqual({ ok: true });
    expect(nilaiMilikPerkara({ jenis: "putusan", namaAkun: "Hakim Dua", pengawas: false, petugas: ["Hakim Satu, S.H."] })).toEqual({ ok: false, status: 403, pesan: PESAN_BUKAN_MAJELIS });
    expect(nilaiMilikPerkara({ jenis: "bas", namaAkun: "Budi Santoso", pengawas: false, petugas: ["Andini Puspita Sari, S.Sy."] })).toEqual({ ok: false, status: 403, pesan: PESAN_BUKAN_PP });
    expect(nilaiMilikPerkara({ jenis: "bas", namaAkun: "Budi", pengawas: false, petugas: null })).toMatchObject({ ok: false, status: 502, pesan: PESAN_PETUGAS_TAK_TERBACA });
    expect(nilaiMilikPerkara({ jenis: "bas", namaAkun: "", pengawas: false, petugas: ["Andini"] })).toMatchObject({ ok: false, status: 403 });
    expect(nilaiMilikPerkara({ jenis: "putusan", namaAkun: "Siapa Saja", pengawas: true, petugas: null })).toEqual({ ok: true });
  });
});

describe("A4 - rute unggah putusan: hakim hanya perkara majelisnya", () => {
  it("hakim yang bukan majelis -> 403 dan gerbang tidak dipanggil", async () => {
    const r = await unggahPutusan(AKTOR.hakimDua, "hakim");
    expect(r.status).toBe(403);
    expect(r.isi.error.message).toBe(PESAN_BUKAN_MAJELIS);
    expect(rute.unggahPutusan).toHaveLength(0);
  });

  it("hakim majelis perkara itu diteruskan", async () => {
    const r = await unggahPutusan(AKTOR.hakimSatu, "hakim");
    expect(r.status).toBe(200);
    expect(rute.unggahPutusan).toHaveLength(1);
    expect(rute.panggilCek).toBe(1);
  });

  it("Ketua, Admin: pengawas, tanpa perjalanan ke bot untuk petugas", async () => {
    expect((await unggahPutusan(AKTOR.ketua, "ketua")).status).toBe(200);
    expect((await unggahPutusan(AKTOR.admin, "admin")).status).toBe(200);
    expect(rute.panggilCek).toBe(0);
    expect(rute.unggahPutusan).toHaveLength(2);
  });

  it("majelis tidak terbaca -> ditolak (bukan diloloskan)", async () => {
    rute.petugas = { ok: false, error: "bot mati" };
    const r = await unggahPutusan(AKTOR.hakimSatu, "hakim");
    expect(r.status).toBe(502);
    expect(rute.unggahPutusan).toHaveLength(0);
  });
});

describe("A4 - rute unggah BAS: PP hanya perkaranya (juga ganti=1)", () => {
  it("PP lain -> 403, termasuk ganti=1; bot tidak dipanggil", async () => {
    const a = await unggahBas(AKTOR.ppLain);
    expect(a.status).toBe(403);
    expect(a.isi.error.message).toBe(PESAN_BUKAN_PP);
    const b = await unggahBas(AKTOR.ppLain, { ganti: "1" });
    expect(b.status).toBe(403);
    expect(rute.unggahBas).toHaveLength(0);
  });

  it("PP perkara itu diteruskan dengan milikPerkara=true", async () => {
    const r = await unggahBas(AKTOR.pp);
    expect(r.status).toBe(200);
    expect(rute.unggahBas[0]).toMatchObject({ peranPenekan: "pp", milikPerkara: true });
  });

  it("Panitera dan Admin mengawasi: boleh tanpa cek petugas", async () => {
    expect((await unggahBas(AKTOR.panitera)).status).toBe(200);
    expect((await unggahBas(AKTOR.admin)).status).toBe(200);
    expect(rute.panggilCek).toBe(0);
  });

  it("PP: PP perkara tidak terbaca -> 502", async () => {
    rute.petugas = { ok: true, data: { ok: true, panitera: null } };
    expect((await unggahBas(AKTOR.pp)).status).toBe(502);
    expect(rute.unggahBas).toHaveLength(0);
  });
});

describe("A4 - bot: lapis kedua dan petugas perkara", () => {
  const bas = req(path.join(AKAR, "aleta_bot/services/basUnggahService.js"));
  const massal = req(path.join(AKAR, "aleta_bot/services/unggahMassalService.js"));

  it("periksaHakUnggahBas: pp tanpa milikPerkara ditolak; dengan milikPerkara, atau golongan pengawas, diterima", () => {
    expect(bas.periksaHakUnggahBas({ peranPenekan: "pp" })).toMatchObject({ ok: false, status: 403, alasan: "pp_bukan_petugas_perkara" });
    expect(bas.periksaHakUnggahBas({ peranPenekan: "pp", milikPerkara: true }).ok).toBe(true);
    expect(bas.periksaHakUnggahBas({ peranPenekan: "panitera" }).ok).toBe(true);
    expect(bas.periksaHakUnggahBas({ peranPenekan: "admin" }).ok).toBe(true);
  });

  it("cek memulangkan majelis (pemeriksaan) dan PP aktif, dipecah '|'", async () => {
    const sql: string[] = [];
    const l = massal.buatLayanan({
      kueriSipp: async (s: string) => {
        sql.push(s);
        if (/perkara_hakim_pn/.test(s)) return [{ majelis: "Hakim Satu, S.H.|Hakim Dua", panitera: "Andini Puspita Sari, S.Sy." }];
        if (/perkara_putusan/.test(s)) return [{ tanggal_putusan: "2026-07-09", amar_putusan_dok: "a/b.rtf", amar_putusan_anonimisasi_dok: null }];
        return [{ urutan: 2, tanggal: "2026-10-15", edoc_bas: "" }];
      },
    });
    expect(await l.cek({ jenis: "putusan", perkaraId: "9851" })).toMatchObject({ ok: true, majelis: ["Hakim Satu, S.H.", "Hakim Dua"], panitera: ["Andini Puspita Sari, S.Sy."] });
    expect(await l.cek({ jenis: "bas", perkaraId: "10134", sidangId: "501" })).toMatchObject({ ok: true, panitera: ["Andini Puspita Sari, S.Sy."] });
    expect(sql.every((s) => /^\s*SELECT/i.test(s))).toBe(true);
  });

  it("cek: petugas gagal dibaca -> null (portal menolak), cek dobel tetap jalan", async () => {
    const l = massal.buatLayanan({
      kueriSipp: async (s: string) => {
        if (/perkara_hakim_pn/.test(s)) throw new Error("ER_X");
        return [{ urutan: 2, tanggal: "2026-10-15", edoc_bas: "" }];
      },
    });
    expect(await l.cek({ jenis: "bas", perkaraId: "10134", sidangId: "501" })).toMatchObject({ ok: true, adaBas: false, majelis: null, panitera: null });
  });
});
