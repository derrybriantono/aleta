// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * RUTE CETAK ALETA ABT (5 Nov 2026, Tahap 5): SUPER ADMIN + (TANDA EKSTENSI ATAU HAK HP), DIJAGA DI SERVER
 * ============================================================================
 * Keputusan 206: tanda berumur pendek BUKAN kunci keamanan; pengaman utama tetap akun. Yang diuji: peran lain 403 di SETIAP
 * bagian dan tindakan (layanan tidak tersentuh), Super Admin tanpa tanda dan tanpa hak HP 403, tanda sah atau hak HP lolos,
 * tanda akun lain / kedaluwarsa / rusak ditolak, isian kosong menahan cetak final, PDF lewat rute PDF yang sudah ada, dan
 * penyunting (simpan/kembalikan/terbitkan) memakai penjaga yang sama. Data rekaan.
 */

const keadaan = vi.hoisted(() => ({
  aktor: null as unknown,
  hp: true,
  panggil: [] as string[],
  naskah: null as unknown,
  audit: [] as Array<{ action: string; entityId: string; payload: Record<string, unknown> }>,
  pdfDipanggil: [] as Array<{ salinan: boolean; cookie: string | null }>,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({ marker: "db" }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/organization/service", () => ({
  requireActorUser: async () => {
    if (!keadaan.aktor) throw Object.assign(new Error("tanpa aktor"), { status: 401, name: "ApiError" });
    return keadaan.aktor;
  },
}));
vi.mock("@/server/modules/aleta-abt/hak-hp", () => ({
  hakAbtHpUntuk: async () => ({ terbuka: keadaan.hp, sumber: "bawaan" }),
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});
vi.mock("@/server/shared/audit", () => ({
  appendAuditLog: async (_db: unknown, e: { action: string; entityId: string; payload: Record<string, unknown> }) => {
    keadaan.audit.push({ action: e.action, entityId: e.entityId, payload: e.payload });
  },
}));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt-uji" }));
vi.mock("@/server/modules/aleta-abt-cetak/naskah", async () => {
  const asli = await vi.importActual<typeof import("@/server/modules/aleta-abt-cetak/naskah")>("@/server/modules/aleta-abt-cetak/naskah");
  return {
    ...asli,
    susunNaskah: async () => {
      keadaan.panggil.push("susun");
      return keadaan.naskah;
    },
  };
});
vi.mock("@/server/modules/aleta-abt-cetak/pdf-ringkas", () => ({
  ringkasPdf: async (b: Uint8Array) => ({ jumlahHalaman: b.length, letakTandaTangan: { halaman: b.length, dariAtasMm: 100 } }),
}));
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: async () => {
    keadaan.panggil.push("cari");
    return { ok: true, data: { ok: true, perkara: [{ nomorPerkara: "1/Pdt.G/2026/PA.Uji", perkaraId: "1", jenisPerkara: "Cerai Gugat" }] } };
  },
}));
vi.mock("@/server/modules/aleta-abt-penyunting/service", () => {
  const catat = (nama: string, hasil: unknown) => async () => {
    keadaan.panggil.push(nama);
    return hasil;
  };
  return {
    daftarBlangko: catat("daftar", { folder: [] }),
    daftarIsian: catat("isian", []),
    bukaBlangko: catat("buka", { versi: { nomor: 3, md5: "abc" } }),
    riwayatVersi: catat("riwayat", { versi: [] }),
    bedaAntarVersi: catat("beda", { baris: [] }),
    cobaBlangko: catat("coba", { versi: 3, paragraf: [] }),
    simpanSuntingan: catat("simpan", { nomor: 4, md5: "m", ukuran: 10, ringkas: "1 paragraf diubah" }),
    pulihkanVersi: catat("pulih", { nomor: 5, dariNomor: 1, md5: "m" }),
    terbitkanVersi: catat("terbit", { nomor: 5, md5: "m" }),
  };
});
vi.mock("@/app/api/aleta-bot/abt/pdf/route", () => ({
  POST: async (r: Request) => {
    const b = (await r.json()) as { rtfBase64: string; salinan: boolean };
    keadaan.pdfDipanggil.push({ salinan: b.salinan === true, cookie: r.headers.get("cookie") });
    return Response.json({ ok: true, data: { available: true, pdfBase64: Buffer.from("%PDF-uji").toString("base64"), byte: 8, versiMesin: "uji", ...(b.salinan ? { salinan: { jenis: "uji" } } : {}) } });
  },
}));

import { GET, POST } from "@/app/api/aleta-abt/cetak/route";
import { GET as GET_TANDA } from "@/app/api/aleta-abt/tanda/route";
import { GET as GET_PENYUNTING, POST as POST_PENYUNTING } from "@/app/api/aleta-abt/penyunting/route";
import type { UserPersona } from "@/lib/types";
import { UMUR_TANDA_MS, buatTanda, periksaTanda } from "@/server/modules/aleta-abt-cetak/tanda";

function akun(roleId: string, positionId = "", additionalRoleIds: string[] = []): UserPersona {
  return {
    id: "usr_uji",
    username: roleId,
    password: "",
    name: `Uji ${roleId}`,
    email: `${roleId}@uji.lokal`,
    roleId,
    positionId,
    additionalRoleIds,
    isActive: true,
  } as unknown as UserPersona;
}

const SUPER = akun("super-admin");
const BUKAN_SUPER_ADMIN = {
  admin: akun("admin", "pos-pranata-komputer"),
  ketua: akun("ketua", "pos-ketua"),
  hakim: akun("hakim", "pos-hakim"),
  panitera: akun("panitera", "pos-panitera"),
  pp: akun("panitera-pengganti", "pos-panitera-pengganti"),
  kasir: akun("pelaksana", "pos-staf-umum", ["kasir"]),
  analis: akun("analis-perkara", "pos-analis-perkara"),
};

const NASKAH_JADI = {
  ok: true,
  nama: "Blangko Uji.rtf",
  rtf: Buffer.from("{\\rtf1\\paperw11906\\paperh16838 Isi naskah uji\\par}", "latin1"),
  kertas: { nama: "A4", lebarMm: 210, tinggiMm: 297 },
  jumlahTerisi: 3,
  kosong: [],
  lolosCetak: true,
  mesinGalat: "",
  ringkasanKeyakinan: { pasti: 3 },
  jumlahKueri: 5,
  waktu: { botMs: 40, totalMs: 60 },
};

const url = (cari = "") => `http://localhost/api/aleta-abt/cetak${cari}`;
const get = (cari = "", kepala: Record<string, string> = {}) => new NextRequest(url(cari), { headers: kepala });
const post = (badan: unknown, kepala: Record<string, string> = {}) =>
  new NextRequest(url(), { method: "POST", headers: { "content-type": "application/json", ...kepala }, body: JSON.stringify(badan) });
const PILIHAN = { berkasId: "berkas-uji", perkaraId: "123", sidangKe: 2 };

function tandaSah(versi = "1.205.76") {
  return { "x-aleta-abt-tanda": buatTanda("usr_uji", versi).tanda };
}

beforeEach(() => {
  keadaan.aktor = SUPER;
  keadaan.hp = true;
  keadaan.panggil = [];
  keadaan.naskah = NASKAH_JADI;
  keadaan.audit = [];
  keadaan.pdfDipanggil = [];
});

describe("tanda berumur pendek", () => {
  it("sah untuk akun yang sama dalam 10 menit, gagal untuk akun lain, kedaluwarsa, atau diubah", () => {
    const t = buatTanda("u1", "1.205.76", 1_000_000);
    expect(periksaTanda(t.tanda, "u1", 1_000_000 + UMUR_TANDA_MS - 1)).toMatchObject({ sah: true, versiEkstensi: "1.205.76" });
    expect(periksaTanda(t.tanda, "u1", 1_000_000 + UMUR_TANDA_MS + 1)).toMatchObject({ sah: false, sebab: "kedaluwarsa" });
    expect(periksaTanda(t.tanda, "u2", 1_000_001)).toMatchObject({ sah: false, sebab: "akun-lain" });
    const rusak = t.tanda.slice(0, -3) + (t.tanda.endsWith("AAA") ? "BBB" : "AAA");
    expect(periksaTanda(rusak, "u1", 1_000_001)).toMatchObject({ sah: false, sebab: "rusak" });
    expect(periksaTanda("", "u1")).toMatchObject({ sah: false, sebab: "kosong" });
    expect(periksaTanda("bukan-tanda", "u1")).toMatchObject({ sah: false, sebab: "rusak" });
  });

  it("versi ekstensi yang tidak berbentuk versi tidak mendapat tanda", () => {
    expect(() => buatTanda("u1", "")).toThrow();
    expect(() => buatTanda("u1", "<script>")).toThrow();
  });

  it("rute tanda: hanya Super Admin, tercatat di audit", async () => {
    for (const [nama, a] of Object.entries(BUKAN_SUPER_ADMIN)) {
      keadaan.aktor = a;
      const r = await GET_TANDA(new NextRequest("http://localhost/api/aleta-abt/tanda?ekstensi=1.2.3"));
      expect(r.status, nama).toBe(403);
    }
    keadaan.aktor = SUPER;
    const r = await GET_TANDA(new NextRequest("http://localhost/api/aleta-abt/tanda?ekstensi=1.205.76"));
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: { tanda: string } }).data.tanda).toContain(".");
    expect(keadaan.audit.map((a) => a.action)).toContain("ALETA_ABT_TANDA_DITERBITKAN");
    expect((await GET_TANDA(new NextRequest("http://localhost/api/aleta-abt/tanda"))).status).toBe(400);
  });
});

describe("penjaga: peran lain ditolak di setiap bagian dan tindakan", () => {
  for (const [nama, a] of Object.entries(BUKAN_SUPER_ADMIN)) {
    it(`${nama}: 403 tanpa menyentuh layanan, bahkan dengan tanda sah`, async () => {
      keadaan.aktor = a;
      keadaan.hp = true;
      const kepala = tandaSah();
      for (const cari of ["?bagian=hak", "?bagian=daftar", "?bagian=perkara&nomor=123", ""]) {
        expect((await GET(get(cari, kepala))).status, `${nama} GET ${cari}`).toBe(403);
      }
      for (const tindakan of ["pratinjau", "rtf", "pdf", "salinan", "banding", "banding-pdf"]) {
        expect((await POST(post({ tindakan, ...PILIHAN }, kepala))).status, `${nama} POST ${tindakan}`).toBe(403);
      }
      expect(keadaan.panggil).toEqual([]);
      expect(keadaan.pdfDipanggil).toEqual([]);
    });
  }
});

describe("penjaga: Super Admin harus membawa tanda atau punya hak HP", () => {
  it("tanpa tanda dan hak HP mati -> 403 di GET dan POST, layanan tidak tersentuh", async () => {
    keadaan.hp = false;
    expect((await GET(get("?bagian=daftar"))).status).toBe(403);
    expect((await POST(post({ tindakan: "pratinjau", ...PILIHAN }))).status).toBe(403);
    expect((await POST(post({ tindakan: "pdf", ...PILIHAN }, { "x-aleta-abt-tanda": "palsu.palsu" }))).status).toBe(403);
    expect(keadaan.panggil).toEqual([]);
  });

  it("bagian=hak menjawab boleh/tidak tanpa melempar", async () => {
    keadaan.hp = false;
    const tutup = (await (await GET(get("?bagian=hak"))).json()) as { data: { boleh: boolean; sebab: string } };
    expect(tutup.data.boleh).toBe(false);
    expect(tutup.data.sebab).toMatch(/ekstensi/i);
    const buka = (await (await GET(get("?bagian=hak", tandaSah()))).json()) as { data: { boleh: boolean; lewat: string } };
    expect(buka.data).toMatchObject({ boleh: true, lewat: "ekstensi" });
    keadaan.hp = true;
    expect(((await (await GET(get("?bagian=hak"))).json()) as { data: { lewat: string } }).data.lewat).toBe("hp");
  });

  it("tanda sah lolos walau hak HP mati; hak HP lolos tanpa tanda", async () => {
    keadaan.hp = false;
    expect((await POST(post({ tindakan: "pratinjau", ...PILIHAN }, tandaSah()))).status).toBe(200);
    keadaan.hp = true;
    expect((await POST(post({ tindakan: "pratinjau", ...PILIHAN }))).status).toBe(200);
  });

  it("tanda milik akun lain tidak berlaku", async () => {
    keadaan.hp = false;
    const t = buatTanda("usr_lain", "1.205.76").tanda;
    expect((await POST(post({ tindakan: "pratinjau", ...PILIHAN }, { "x-aleta-abt-tanda": t }))).status).toBe(403);
  });
});

describe("cetak", () => {
  it("pratinjau mengembalikan paragraf dan waktu, tanpa mencatat audit isi", async () => {
    const r = await POST(post({ tindakan: "pratinjau", ...PILIHAN }));
    const j = (await r.json()) as { data: { paragraf: Array<{ teks: string }>; kertas: { nama: string }; waktu: { totalMs: number }; lolosCetak: boolean } };
    expect(r.status).toBe(200);
    expect(j.data.paragraf.map((p) => p.teks)).toContain("Isi naskah uji");
    expect(j.data.kertas.nama).toBe("A4");
    expect(j.data.waktu.totalMs).toBe(60);
  });

  it("masukan tidak sah ditolak sebelum menyusun", async () => {
    expect((await POST(post({ tindakan: "pratinjau", berkasId: "../x", perkaraId: "1" }))).status).toBe(400);
    expect((await POST(post({ tindakan: "pratinjau", berkasId: "b", perkaraId: "abc" }))).status).toBe(400);
    expect((await POST(post({ tindakan: "aneh", ...PILIHAN }))).status).toBe(400);
    expect(keadaan.panggil).toEqual([]);
  });

  it("isian kosong menahan RTF, PDF, dan PDF SALINAN: tidak ada naskah yang keluar", async () => {
    keadaan.naskah = { ok: false, status: 409, ditahan: true, kosong: [{ nama: "Pekerjaan Pemohon", sebab: "", status: "kosong" }], alasan: "Cetak final ditahan: 1 isian masih kosong." };
    for (const tindakan of ["rtf", "pdf", "salinan"]) {
      const r = await POST(post({ tindakan, ...PILIHAN }));
      const j = (await r.json()) as Record<string, unknown>;
      expect(r.status, tindakan).toBe(409);
      expect(j.ditahan).toBe(true);
      expect(JSON.stringify(j)).not.toContain("rtfBase64");
      expect(JSON.stringify(j)).not.toContain("pdfBase64");
    }
    expect(keadaan.pdfDipanggil).toEqual([]);
    expect(keadaan.audit.filter((a) => /CETAK_(RTF|PDF)/.test(a.action))).toEqual([]);
  });

  it("rtf: berkas keluar dan audit tanpa isi naskah", async () => {
    const r = await POST(post({ tindakan: "rtf", ...PILIHAN }, tandaSah()));
    const j = (await r.json()) as { data: { rtfBase64: string; byte: number } };
    expect(Buffer.from(j.data.rtfBase64, "base64").toString("latin1")).toContain("Isi naskah uji");
    const a = keadaan.audit.find((x) => x.action === "ALETA_ABT_CETAK_RTF");
    expect(a?.payload).toMatchObject({ perkaraId: "123", lewat: "ekstensi" });
    expect(JSON.stringify(keadaan.audit)).not.toContain("Isi naskah uji");
  });

  it("pdf dan salinan memanggil rute PDF yang sudah ada dengan sesi yang sama", async () => {
    const pdf = (await (await POST(post({ tindakan: "pdf", ...PILIHAN }, { cookie: "sesi=abc" }))).json()) as { data: { pdfBase64: string } };
    expect(Buffer.from(pdf.data.pdfBase64, "base64").toString()).toBe("%PDF-uji");
    const sal = (await (await POST(post({ tindakan: "salinan", ...PILIHAN }, { cookie: "sesi=abc" }))).json()) as { data: { salinan?: unknown } };
    expect(sal.data.salinan).toBeTruthy();
    expect(keadaan.pdfDipanggil).toEqual([
      { salinan: false, cookie: "sesi=abc" },
      { salinan: true, cookie: "sesi=abc" },
    ]);
    expect(keadaan.audit.map((a) => a.action)).toEqual(expect.arrayContaining(["ALETA_ABT_CETAK_PDF", "ALETA_ABT_CETAK_PDF_SALINAN"]));
  });

  it("banding RTF dengan cetakan ABT menghitung alinea identik", async () => {
    const abt = "{\\rtf1\\paperw11906\\paperh16838 Isi naskah uji\\par Alinea lain\\par}";
    const r = await POST(post({ tindakan: "banding", ...PILIHAN, rtfAbtBase64: Buffer.from(abt, "latin1").toString("base64") }));
    const j = (await r.json()) as { data: { alinea: { identik: number; total: number }; kertas: { abt: { nama: string } } } };
    expect(j.data.alinea).toMatchObject({ identik: 1, total: 2 });
    expect(j.data.kertas.abt.nama).toBe("A4");
  });

  it("banding PDF membandingkan jumlah halaman dan letak tanda tangan", async () => {
    const b = (n: number) => Buffer.alloc(n).toString("base64");
    const r = await POST(post({ tindakan: "banding-pdf", pdfAbtBase64: b(5), pdfAletaBase64: b(5) }));
    const j = (await r.json()) as { data: { banding: { jumlahHalaman: { sama: boolean }; letakTandaTangan: { sama: boolean } } } };
    expect(j.data.banding.jumlahHalaman.sama).toBe(true);
    expect(j.data.banding.letakTandaTangan.sama).toBe(true);
  });

  it("cari perkara: tiga karakter minimal", async () => {
    expect((await GET(get("?bagian=perkara&nomor=12"))).status).toBe(400);
    const r = await GET(get("?bagian=perkara&nomor=123"));
    expect(r.status).toBe(200);
  });
});

describe("penyunting memakai penjaga yang sama untuk simpan, kembalikan, dan terbitkan", () => {
  it("Super Admin tanpa tanda dan hak HP mati: tulis ditolak, layanan tidak tersentuh; baca tetap sebagaimana Tahap 3", async () => {
    keadaan.hp = false;
    for (const badan of [
      { tindakan: "simpan", id: "b", dasarNomor: 1, suntingan: [{ i: 1, teks: "x" }] },
      { tindakan: "pulihkan", id: "b", nomor: 1 },
      { tindakan: "terbitkan", id: "b", nomor: 1 },
    ]) {
      const r = await POST_PENYUNTING(new NextRequest("http://localhost/api/aleta-abt/penyunting", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) }));
      expect(r.status, badan.tindakan).toBe(403);
    }
    expect(keadaan.panggil).toEqual([]);
    expect((await GET_PENYUNTING(new NextRequest("http://localhost/api/aleta-abt/penyunting"))).status).toBe(200);
  });

  it("dengan tanda sah, simpan lolos", async () => {
    keadaan.hp = false;
    const r = await POST_PENYUNTING(
      new NextRequest("http://localhost/api/aleta-abt/penyunting", {
        method: "POST",
        headers: { "content-type": "application/json", ...tandaSah() },
        body: JSON.stringify({ tindakan: "simpan", id: "b", dasarNomor: 1, suntingan: [{ i: 1, teks: "x" }] }),
      })
    );
    expect(r.status).toBe(200);
    expect(keadaan.panggil).toEqual(["simpan"]);
  });
});
