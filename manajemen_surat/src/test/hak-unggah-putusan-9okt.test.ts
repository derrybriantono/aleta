// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * HAK UNGGAH PUTUSAN = PERAN (keputusan pengguna 9 Okt 2026)
 * ============================================================================
 *
 * "untuk putusan itu hanya bisa dilakukan oleh superadmin, admin dan hakim,
 * yang lain tidak boleh upload putusan ke sipp".
 *
 * Dijaga dengan MENJALANKAN rute portalnya: tiap peran dicoba pada tiap rute
 * yang menulis putusan (unggah-sipp, upload e-Court, sidang-putus jalur hakim)
 * atau menyiapkan isian borang putusan (isian-sipp GET/POST, unggah-naskah).
 * Hakim/Ketua/Wakil/Admin/Super Admin LEWAT gerbang (gerbang bot dipanggil
 * beserta peranPenekan); PP, panitera, juru sita, operator, analis, staf
 * DITOLAK 403 SEBELUM apa pun dibaca atau dikirim. Gerbang bot diuji lapis
 * keduanya - hakUnggahPutusanService - langsung.
 *
 * Yang TIDAK berubah ikut dijaga: jalur "sidang" sidang-putus (panitera
 * sidang mencatat fakta diputus di Jadwal Sidang) tetap untuk semua yang
 * berkemampuan panel.
 */

const keadaan = vi.hoisted(() => ({
  aktor: null as Record<string, unknown> | null,
  gerbang: [] as Array<{ jalur: string; muatan: Record<string, unknown> }>,
  bot: [] as Array<{ jalur: string; body: Record<string, unknown> }>,
  naskah: 0,
  /** Majelis AKTIF perkara 450 menurut bot (audit 17 Okt); null = bot tidak menjawab. */
  majelis: ["Uji hakim", "Hakim Anggota Lain"] as string[] | null,
}));

vi.mock("@/server/db/client", () => ({
  getDatabase: async () => ({ queryOne: async () => null }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/organization/service", () => ({
  requireActorUser: async () => {
    if (!keadaan.aktor) throw new Error("tanpa aktor");
    return keadaan.aktor;
  },
}));
// Kemampuan ekstensi (panel, data-umum) dianggap ada - yang diuji di sini
// hak PERAN yang berdiri di atasnya.
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => keadaan.aktor,
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});
vi.mock("@/app/api/aleta-ecourt/putusan/perkara-dari-id", () => ({
  selaraskanPerkaraDariId: async (x: { perkaraId: string; nomorPerkara: string }) => ({ ok: true, perkaraId: x.perkaraId, nomorPerkara: x.nomorPerkara }),
}));
vi.mock("@/server/modules/aleta-ecourt/court-calendar-akun", () => ({ akunSippPengguna: async () => null }));
vi.mock("@/server/modules/aleta-ecourt/ecourt-akun-pengguna", () => ({
  periksaAkunSippTerbuka: async () => ({ ok: true, usernameSipp: "", alasan: "" }),
}));
vi.mock("@/server/modules/aleta-ecourt/ecourt-aksi", () => ({
  BATAS_PERAMBAN_MS: 1000,
  bersihkanNomor: (x: unknown) => String(x ?? "").trim(),
  catatJejakAksi: async () => undefined,
  kalimatAlasan: (x: unknown) => String(x ?? ""),
  panggilBot: async (jalur: string, o: { body?: Record<string, unknown> }) => {
    keadaan.bot.push({ jalur, body: o.body ?? {} });
    return { ok: true, data: { ok: true, akun: null, salinan: null } };
  },
}));
vi.mock("@/server/modules/aleta-ecourt/unggah-naskah-putusan", async (asli) => ({
  ...(await asli<typeof import("@/server/modules/aleta-ecourt/unggah-naskah-putusan")>()),
  unggahNaskahPutusan: async () => {
    keadaan.naskah += 1;
    return { ok: true };
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => {
  const catat = (jalur: string) => async (muatan: Record<string, unknown>) => {
    keadaan.gerbang.push({ jalur, muatan });
    return { ok: true, data: { ok: true } };
  };
  return {
    gatewayUnggahPutusanSipp: catat("unggah-sipp"),
    postGatewayTulisPutusan: catat("sidang/putus"),
    postGatewayPutusSidang: catat("sidang/putus-sidang"),
    getGatewayStatusPutusan: async () => ({ ok: true, data: {} }),
    // 17 Okt: SATU penjaga majelis (hak-milik-perkara) - sumbernya cek unggah massal; null = bot tidak menjawab.
    getGatewayUnggahMassalCek: async () =>
      keadaan.majelis === null ? { ok: false, error: "ALETA Bot tidak menjawab." } : { ok: true, data: { ok: true, majelis: keadaan.majelis } },
    getGatewayStatusPerkara: async () => ({ ok: true, data: { identitas: { perkaraId: "450" } } }),
    getGatewaySippKonteks: async () => ({ ok: false, error: "tidak dibaca dalam uji" }),
  };
});

const NOMOR = "450/Pdt.G/2026/PA.Dgl";

const PERAN_BOLEH = ["super-admin", "admin", "hakim", "ketua", "wakil-ketua"];
const PERAN_TOLAK = ["panitera-pengganti", "panitera", "panitera-muda", "jurusita", "operator", "analis-perkara", "staf", "pranata-komputer"];

function aktor(roleId: string, tambahan: string[] = []) {
  return { id: `usr-${roleId}`, name: `Uji ${roleId}`, email: `${roleId}@uji`, roleId, additionalRoleIds: tambahan };
}

function berkasPdf() {
  return new File([new TextEncoder().encode("%PDF-1.4 uji")], "putusan.pdf", { type: "application/pdf" });
}

const MODUL: Record<string, () => Promise<any>> = {
  "putusan/unggah-sipp": () => import("@/app/api/aleta-ecourt/putusan/unggah-sipp/route"),
  "putusan/isian-sipp": () => import("@/app/api/aleta-ecourt/putusan/isian-sipp/route"),
  "putusan/unggah-naskah": () => import("@/app/api/aleta-ecourt/putusan/unggah-naskah/route"),
  "ecourt-putusan/unggah": () => import("@/app/api/aleta-ecourt/ecourt-putusan/unggah/route"),
  "sidang-putus": () => import("@/app/api/aleta-ecourt/sidang-putus/route"),
};

async function panggil(rute: string, cara: "GET" | "POST", isi?: FormData | Record<string, unknown>, cari = "") {
  const alamat = `http://localhost/api/aleta-ecourt/${rute}${cari}`;
  const init: { method: string; body?: BodyInit; headers?: Record<string, string> } = { method: cara };
  if (isi instanceof FormData) init.body = isi;
  else if (isi) {
    init.body = JSON.stringify(isi);
    init.headers = { "content-type": "application/json" };
  }
  const req = new NextRequest(alamat, init);
  const modul: Record<string, (r: NextRequest) => Promise<Response>> = await MODUL[rute]();
  const res: Response = await modul[cara](req);
  let badan: any = null;
  try {
    badan = await res.json();
  } catch {
    badan = null;
  }
  return { status: res.status, badan };
}

const RUTE: Array<{ nama: string; jalan: () => Promise<{ status: number; badan: any }>; lewat: () => boolean }> = [
  {
    nama: "POST putusan/unggah-sipp (e-Doc putusan + anonimisasi)",
    jalan: () => {
      const f = new FormData();
      f.set("nomorPerkara", NOMOR);
      f.set("putusan", berkasPdf());
      return panggil("putusan/unggah-sipp", "POST", f);
    },
    lewat: () => keadaan.gerbang.some((g) => g.jalur === "unggah-sipp"),
  },
  {
    nama: "POST ecourt-putusan/unggah (upload salinan putusan ke e-Court)",
    jalan: () => {
      const f = new FormData();
      f.set("nomor", NOMOR);
      f.set("berkas", berkasPdf());
      return panggil("ecourt-putusan/unggah", "POST", f);
    },
    lewat: () => keadaan.bot.some((b) => b.jalur === "/ecourt-putusan/unggah"),
  },
  {
    nama: "GET putusan/isian-sipp (usulan isian borang Putusan Akhir)",
    jalan: () => panggil("putusan/isian-sipp", "GET", undefined, `?nomorPerkara=${encodeURIComponent(NOMOR)}`),
    lewat: () => true,
  },
  {
    nama: "POST putusan/isian-sipp (usulan medan pilihan borang putusan)",
    jalan: () => panggil("putusan/isian-sipp", "POST", { nomorPerkara: NOMOR, medan: [] }),
    lewat: () => true,
  },
  {
    nama: "POST putusan/unggah-naskah (naskah untuk putusan otomatis/massal)",
    jalan: () => {
      const f = new FormData();
      f.set("nomorPerkara", NOMOR);
      f.set("berkas", new File(["{\\rtf1 PUTUSAN}"], "putusan.rtf", { type: "application/rtf" }));
      return panggil("putusan/unggah-naskah", "POST", f);
    },
    lewat: () => keadaan.naskah > 0,
  },
  {
    nama: "POST sidang-putus jalur hakim (tulis putusan ke SIPP)",
    jalan: () =>
      panggil("sidang-putus", "POST", { perkaraId: "450", olehUsername: "hakim.uji", amarPutusan: "Mengabulkan", kering: true }),
    lewat: () => keadaan.gerbang.some((g) => g.jalur === "sidang/putus"),
  },
];

beforeEach(() => {
  keadaan.aktor = null;
  keadaan.gerbang.length = 0;
  keadaan.bot.length = 0;
  keadaan.naskah = 0;
  keadaan.majelis = ["Uji hakim", "Hakim Anggota Lain"];
});

describe("hak-putusan.ts: peran yang boleh unggah putusan", () => {
  it("Super Admin, Admin, Hakim, Ketua, Wakil Ketua boleh; PP, panitera, juru sita, operator, analis, staf tidak", async () => {
    const { bolehUnggahPutusan, peranUnggahPutusan } = await import("@/server/modules/aleta-ecourt/hak-putusan");
    for (const r of PERAN_BOLEH) expect(bolehUnggahPutusan(aktor(r) as never), r).toBe(true);
    for (const r of PERAN_TOLAK) expect(bolehUnggahPutusan(aktor(r) as never), r).toBe(false);
    expect(peranUnggahPutusan(aktor("hakim") as never)).toBe("hakim");
    expect(peranUnggahPutusan(aktor("super-admin") as never)).toBe("super-admin");
  });

  it("peran TAMBAHAN tidak memberi hak - PP yang diberi peran tambahan hakim/admin tetap ditolak", async () => {
    const { bolehUnggahPutusan } = await import("@/server/modules/aleta-ecourt/hak-putusan");
    expect(bolehUnggahPutusan(aktor("panitera-pengganti", ["hakim"]) as never)).toBe(false);
    expect(bolehUnggahPutusan(aktor("operator", ["super-admin", "admin"]) as never)).toBe(false);
  });

  it("tidak bergantung pada kemampuan papan penunjukan (akses.ts tidak diimpor)", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const sumber = readFileSync(path.resolve(process.cwd(), "src/server/modules/aleta-ecourt/hak-putusan.ts"), "utf8");
    expect(sumber).not.toMatch(/aleta-ecourt\/akses/);
    expect(sumber).not.toMatch(/pastikanKapabilitas\(|kapabilitasPengguna\(/);
  });
});

describe.each(RUTE)("rute $nama", ({ jalan, lewat }) => {
  it.each(PERAN_TOLAK)("%s DITOLAK 403 dengan kalimat yang jelas, tanpa memanggil gerbang", async (roleId) => {
    keadaan.aktor = aktor(roleId);
    const { status, badan } = await jalan();
    expect(status).toBe(403);
    expect(JSON.stringify(badan)).toContain("hanya untuk Hakim, Admin, dan Super Admin");
    expect(keadaan.gerbang).toEqual([]);
    expect(keadaan.bot).toEqual([]);
    expect(keadaan.naskah).toBe(0);
  });

  it.each(PERAN_BOLEH)("%s LEWAT gerbang hak putusan", async (roleId) => {
    keadaan.aktor = aktor(roleId);
    const { status } = await jalan();
    expect(status).not.toBe(403);
    expect(lewat()).toBe(true);
  });
});

describe("peranPenekan diteruskan ke gerbang bot (lapis kedua)", () => {
  it("unggah-sipp, sidang/putus, dan e-Court membawa peran yang memberi hak", async () => {
    keadaan.aktor = aktor("hakim");
    for (const r of RUTE) await r.jalan();
    expect(keadaan.gerbang.find((g) => g.jalur === "unggah-sipp")?.muatan.peranPenekan).toBe("hakim");
    expect(keadaan.gerbang.find((g) => g.jalur === "sidang/putus")?.muatan.peranPenekan).toBe("hakim");
    expect(keadaan.bot.find((b) => b.jalur === "/ecourt-putusan/unggah")?.body.peranPenekan).toBe("hakim");
  });
});

describe("yang TIDAK berubah", () => {
  it("sidang-putus jalur 'sidang' (fakta diputus di Jadwal Sidang) tetap untuk PP", async () => {
    keadaan.aktor = aktor("panitera-pengganti");
    const { status } = await panggil("sidang-putus", "POST", { jalur: "sidang", jadwalId: 1, perkaraId: "450", statusPutusanId: 62, kering: true });
    expect(status).toBe(200);
    expect(keadaan.gerbang.map((g) => g.jalur)).toEqual(["sidang/putus-sidang"]);
  });
});

describe("gerbang bot: hakUnggahPutusanService", () => {
  it("menolak 403 tanpa peranPenekan atau dengan peran di luar daftar; meloloskan hakim/admin/super-admin/ketua/wakil", async () => {
    const { createRequire } = await import("node:module");
    const path = await import("node:path");
    const butuh = createRequire(import.meta.url);
    const layanan = butuh(path.resolve(process.cwd(), "../aleta_bot/services/hakUnggahPutusanService.js"));
    expect(layanan.periksaHakUnggahPutusan({})).toMatchObject({ ok: false, status: 403, alasan: "peran_penekan_tidak_disebut" });
    for (const r of PERAN_TOLAK) {
      expect(layanan.periksaHakUnggahPutusan({ peranPenekan: r }), r).toMatchObject({ ok: false, status: 403, alasan: "peran_tidak_boleh_unggah_putusan" });
    }
    for (const r of PERAN_BOLEH) expect(layanan.periksaHakUnggahPutusan({ peranPenekan: r }), r).toMatchObject({ ok: true, peran: r });
  });

  it("ketiga rute bot yang menulis putusan memeriksanya SEBELUM layanan dipanggil", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const bot = (b: string) => readFileSync(path.resolve(process.cwd(), "../aleta_bot/routes", b), "utf8").replace(/\r\n/g, "\n");
    const gerbang = bot("internalGatewayRoutes.js");
    const aksi = bot("ecourtAksiRoutes.js");
    const potong = (teks: string, awal: string, layanan: string) => {
      const i = teks.indexOf(awal);
      expect(i, awal).toBeGreaterThan(0);
      const sisa = teks.slice(i);
      const periksa = sisa.indexOf("periksaHakUnggahPutusan(");
      const panggilLayanan = sisa.indexOf(layanan);
      expect(periksa, `${awal} memeriksa hak`).toBeGreaterThan(0);
      expect(periksa, `${awal}: periksa sebelum ${layanan}`).toBeLessThan(panggilLayanan);
    };
    potong(gerbang, 'router.post("/sipp/putusan-unggah"', "putusanUnggahService.unggahPutusan(");
    potong(gerbang, 'router.post("/sidang/putus"', "putusanTulisService.susunRencanaPutus(");
    potong(aksi, 'router.post("/ecourt-putusan/unggah"', "aksi.unggahSalinan(");
  });
});

describe("audit 17 Okt: hakim hanya putusan perkara MAJELISNYA (keputusan 16 Okt) - rute tulis SIPP", () => {
  const TULIS_SIPP = RUTE.filter((r) => /unggah-sipp|sidang-putus/.test(r.nama));
  it.each(TULIS_SIPP.map((r) => [r.nama, r] as const))("%s: hakim di luar majelis 403, gerbang tidak dipanggil", async (_n, r) => {
    keadaan.aktor = aktor("hakim");
    keadaan.majelis = ["Hakim Lain Sekali"];
    const { status, badan } = await r.jalan();
    expect(status).toBe(403);
    expect(JSON.stringify(badan)).toContain("bukan perkara majelis Anda");
    expect(keadaan.gerbang).toEqual([]);
  });
  it.each(TULIS_SIPP.map((r) => [r.nama, r] as const))("%s: majelis tak terbaca - hakim ditolak dengan kalimat jujur", async (_n, r) => {
    keadaan.aktor = aktor("hakim");
    keadaan.majelis = null;
    const { status, badan } = await r.jalan();
    expect(status).toBe(502);
    expect(JSON.stringify(badan)).toContain("belum dapat dibaca");
    expect(keadaan.gerbang).toEqual([]);
  });
  it.each(TULIS_SIPP.map((r) => [r.nama, r] as const))("%s: Ketua/Wakil/Admin tidak dibatasi majelis", async (_n, r) => {
    for (const roleId of ["ketua", "wakil-ketua", "admin", "super-admin"]) {
      keadaan.gerbang.length = 0;
      keadaan.aktor = aktor(roleId);
      keadaan.majelis = ["Hakim Lain Sekali"];
      const { status } = await r.jalan();
      expect(status, roleId).not.toBe(403);
      expect(r.lewat(), roleId).toBe(true);
    }
  });
});
