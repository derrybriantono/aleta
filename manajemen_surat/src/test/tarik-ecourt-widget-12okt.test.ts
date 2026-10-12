// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AKSI, bolehAksi } from "@/lib/matriks-peran";
import {
  pengaturanDenganAktif,
  ringkasTarikEcourt,
  sebabPerhatianTarik,
  type JadwalTarikEcourt,
} from "@/lib/tarik-ecourt-status";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * BUTIR 12 (12 Okt 2026): "Tarik data e-Court" di popup ekstensi
 * ============================================================================
 *   1. logika murni: empat keadaan berwarna, pengaturan lengkap hanya `aktif` berganti;
 *   2. rute /ekstensi/tarik-ecourt atas pg-mem berbenih: hanya Super Admin & Admin
 *      (GET dan POST), saklar tersimpan lewat bot dan DIBACA ULANG, jejak ALETA
 *      mencatat siapa, bot mati = tidak ada yang berubah;
 *   3. popup.html + popup.js dijalankan sungguhan di JSDOM: baris hanya bagi
 *      Super Admin/Admin, berwarna menurut keadaan, klik -> konfirmasi -> POST,
 *      dan peran lain tidak memanggil rutenya sama sekali.
 */

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => (globalThis as { __dbTarik?: AletaDatabase }).__dbTarik };
});
vi.mock("@/server/shared/auth", () => ({
  resolveActorUserId: async () => (globalThis as { __aktorTarik?: string | null }).__aktorTarik ?? null,
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayEcourtJadwal: async () => {
    const b = (globalThis as { __botTarik?: unknown }).__botTarik;
    return b ? { ok: true, data: { ok: true, jadwal: b } } : { ok: false, error: "gateway_tidak_terjangkau" };
  },
  saveGatewayEcourtJadwal: async (payload: Record<string, unknown>) => {
    const g = globalThis as { __botTarik?: { pengaturan: Record<string, unknown> } | null; __simpanTarik?: Array<Record<string, unknown>>; __tolakTarik?: boolean };
    g.__simpanTarik?.push(payload);
    if (g.__tolakTarik) return { ok: true, data: { ok: false, alasan: "jam_selesai_harus_setelah_jam_mulai" } };
    if (g.__botTarik) {
      g.__botTarik.pengaturan = {
        aktif: payload.aktif,
        jarakJam: payload.jarakJam,
        jamMulai: payload.jamMulai,
        jamSelesai: payload.jamSelesai,
        maksPerkara: payload.maksPerkara,
      };
    }
    return { ok: true, data: { ok: true } };
  },
}));

// ── data uji ────────────────────────────────────────────────────────────────

function jadwal(sebagian: Partial<JadwalTarikEcourt> & { aktif?: boolean } = {}): JadwalTarikEcourt {
  const { aktif, ...sisa } = sebagian;
  return {
    pengaturan: { aktif: aktif ?? true, jarakJam: 2, jamMulai: 7, jamSelesai: 17, maksPerkara: 25 },
    sedangJalan: false,
    dalamJamKerja: true,
    terakhirSelesai: "2026-10-12T02:10:00.000Z",
    terakhirKode: 0,
    terakhirCatatan: "Selesai.",
    ...sisa,
  };
}

// ════════════════════════════════════════════════════════════════════════════
describe("1. logika murni: keadaan berwarna", () => {
  it("menyala dan putaran terakhir baik = aktif; sedang jalan dan di luar jam kerja disebut", () => {
    const r = ringkasTarikEcourt(jadwal());
    expect(r).toMatchObject({ keadaan: "aktif", aktif: true, label: "Aktif", sedangJalan: false });
    expect(r.keterangan).toMatch(/tiap 2 jam, jam 07\.00-17\.00/);
    expect(r.terakhirSelesai).toBe("2026-10-12T02:10:00.000Z");
    expect(ringkasTarikEcourt(jadwal({ sedangJalan: true })).keterangan).toMatch(/Sedang menarik/);
    expect(ringkasTarikEcourt(jadwal({ dalamJamKerja: false })).keterangan).toMatch(/Menunggu jam kerja/);
    // Belum pernah berjalan sejak bot menyala tetap aktif (bukan perhatian).
    expect(ringkasTarikEcourt(jadwal({ terakhirKode: null, terakhirSelesai: null })).keadaan).toBe("aktif");
  });

  it("menyala tetapi putaran terakhir berhenti = perhatian, dengan sebabnya", () => {
    const sesi = ringkasTarikEcourt(jadwal({ terakhirKode: 2 }));
    expect(sesi).toMatchObject({ keadaan: "perhatian", aktif: true });
    expect(sesi.keterangan).toMatch(/Sesi e-Court habis/);
    expect(ringkasTarikEcourt(jadwal({ terakhirKode: 3 })).keterangan).toMatch(/disk/);
    expect(ringkasTarikEcourt(jadwal({ terakhirKode: 1 })).keadaan).toBe("perhatian");
    expect(ringkasTarikEcourt(jadwal({ terakhirKode: -1 })).keadaan).toBe("perhatian");
    // Putaran baru sedang berjalan: kode lama tidak lagi relevan.
    expect(ringkasTarikEcourt(jadwal({ terakhirKode: 2, sedangJalan: true })).keadaan).toBe("aktif");
    expect(sebabPerhatianTarik(0)).toBe("");
    expect(sebabPerhatianTarik(null)).toBe("");
  });

  it("dimatikan = mati (aktif:false), apa pun kode terakhirnya", () => {
    const r = ringkasTarikEcourt(jadwal({ aktif: false, terakhirKode: 2 }));
    expect(r).toMatchObject({ keadaan: "mati", aktif: false, label: "Tidak aktif" });
    expect(r.keterangan).toMatch(/Klik status untuk mengaktifkan/);
  });

  it("bot tidak menjawab / bentuk rusak = tidak-terjangkau (aktif null, bukan mati)", () => {
    for (const x of [null, undefined, {} as unknown as JadwalTarikEcourt]) {
      expect(ringkasTarikEcourt(x)).toMatchObject({ keadaan: "tidak-terjangkau", aktif: null });
    }
  });

  it("terakhirSelesai yang bukan tanggal dibuang", () => {
    expect(ringkasTarikEcourt(jadwal({ terakhirSelesai: "bukan-tanggal" })).terakhirSelesai).toBeNull();
  });

  it("pengaturanDenganAktif: hanya aktif yang berganti, ruas lain dari keadaan sekarang", () => {
    const j = jadwal({ aktif: false });
    j.pengaturan = { aktif: false, jarakJam: 3, jamMulai: 8, jamSelesai: 16, maksPerkara: 40 };
    expect(pengaturanDenganAktif(j, true)).toEqual({ aktif: true, jarakJam: 3, jamMulai: 8, jamSelesai: 16, maksPerkara: 40 });
    expect(pengaturanDenganAktif(null, true)).toBeNull();
    j.pengaturan.jarakJam = Number.NaN;
    expect(pengaturanDenganAktif(j, true)).toBeNull();
  });

  it("matriks peran: aksi ecourt.tarik-data hanya Admin & Super Admin", () => {
    expect(AKSI["ecourt.tarik-data"].golongan).toEqual([]);
    expect(AKSI["ecourt.tarik-data"].rute.join(" ")).toContain("/api/aleta-ecourt/ekstensi/tarik-ecourt");
    const akun = (roleId: string) => ({ id: roleId, roleId, additionalRoleIds: [], positionId: "" }) as never;
    expect(bolehAksi(akun("super-admin"), "ecourt.tarik-data")).toBe(true);
    expect(bolehAksi(akun("admin"), "ecourt.tarik-data")).toBe(true);
    for (const r of ["hakim", "panitera", "ketua", "jurusita", "sekretaris"]) expect(bolehAksi(akun(r), "ecourt.tarik-data"), r).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("2. rute /api/aleta-ecourt/ekstensi/tarik-ecourt", () => {
  let db: AletaDatabase | null = null;
  let aktor: string | null = "usr-admin";
  /** Penjadwal bot tiruan; null = bot tidak terjangkau. */
  let bot: JadwalTarikEcourt | null = jadwal({ aktif: false });
  const simpanan: Array<Record<string, unknown>> = [];
  let tolakSimpan = false;

  function sinkron() {
    const g = globalThis as Record<string, unknown>;
    g.__dbTarik = db;
    g.__aktorTarik = aktor;
    g.__botTarik = bot;
    g.__simpanTarik = simpanan;
    g.__tolakTarik = tolakSimpan;
  }

  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-admin";
    bot = jadwal({ aktif: false });
    simpanan.length = 0;
    tolakSimpan = false;
    sinkron();
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  async function GET() {
    sinkron();
    const { GET: g } = await import("@/app/api/aleta-ecourt/ekstensi/tarik-ecourt/route");
    const r = await g(new NextRequest("http://localhost/api/aleta-ecourt/ekstensi/tarik-ecourt"));
    return { status: r.status, isi: (await r.json()) as { data?: Record<string, any>; error?: { message?: string } } };
  }
  async function POST(badan: unknown) {
    sinkron();
    const { POST: p } = await import("@/app/api/aleta-ecourt/ekstensi/tarik-ecourt/route");
    const r = await p(
      new NextRequest("http://localhost/api/aleta-ecourt/ekstensi/tarik-ecourt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: typeof badan === "string" ? badan : JSON.stringify(badan),
      })
    );
    return { status: r.status, isi: (await r.json()) as { data?: Record<string, any>; error?: { message?: string } } };
  }
  const jejak = async () =>
    (await (db as AletaDatabase).queryAll<{ action: string; actor_user_id: string; payload_json: string; created_at: string }>(
      `SELECT action, actor_user_id, payload_json, created_at FROM audit_logs WHERE entity_type = 'ecourt_penjadwal' ORDER BY created_at`
    )) ?? [];

  it("GET: Admin dan Super Admin membaca keadaan berwarna", async () => {
    for (const siapa of ["usr-admin", "usr-super"]) {
      aktor = siapa;
      const r = await GET();
      expect(r.status, siapa).toBe(200);
      expect(r.isi.data?.tersedia).toBe(true);
      expect(r.isi.data?.ringkas).toMatchObject({ keadaan: "mati", aktif: false, label: "Tidak aktif" });
    }
    bot = jadwal({ aktif: true });
    expect((await GET()).isi.data?.ringkas).toMatchObject({ keadaan: "aktif", aktif: true });
  });

  it("GET dan POST: peran lain 403 (hakim, panitera, ketua) dan bot TIDAK disentuh", async () => {
    for (const siapa of ["usr-hakim", "usr-panitera", "usr-ketua"]) {
      aktor = siapa;
      const g = await GET();
      expect(g.status, `GET ${siapa}`).toBe(403);
      const p = await POST({ aktif: true });
      expect(p.status, `POST ${siapa}`).toBe(403);
      expect(p.isi.error?.message).toMatch(/matriks peran/);
    }
    expect(simpanan).toHaveLength(0);
    expect(bot?.pengaturan.aktif).toBe(false);
    expect(await jejak()).toHaveLength(0);
  });

  it("tanpa sesi = 401", async () => {
    aktor = null;
    expect((await GET()).status).toBe(401);
    expect((await POST({ aktif: true })).status).toBe(401);
  });

  it("POST aktif:true menyimpan lewat bot (ruas lain dipertahankan), membaca ulang, dan mencatat jejak", async () => {
    bot = jadwal({ aktif: false });
    bot.pengaturan = { aktif: false, jarakJam: 3, jamMulai: 8, jamSelesai: 16, maksPerkara: 40 };
    aktor = "usr-admin";
    const r = await POST({ aktif: true });
    expect(r.status).toBe(200);
    expect(r.isi.data).toMatchObject({ berhasil: true, pesan: "Penarikan e-Court diaktifkan." });
    expect(r.isi.data?.ringkas).toMatchObject({ keadaan: "aktif", aktif: true });
    expect(simpanan).toHaveLength(1);
    expect(simpanan[0]).toMatchObject({ aktif: true, jarakJam: 3, jamMulai: 8, jamSelesai: 16, maksPerkara: 40 });
    expect(String(simpanan[0].olehSiapa)).not.toBe("");

    const baris = await jejak();
    expect(baris).toHaveLength(1);
    expect(baris[0].action).toBe("AKTIFKAN_ECOURT_TARIK_DATA");
    expect(baris[0].actor_user_id).toBe("usr-admin");
    expect(JSON.parse(baris[0].payload_json)).toMatchObject({ aktif: true, sebelumnya: false, lewat: "widget-ekstensi" });
    expect(Number.isNaN(Date.parse(baris[0].created_at))).toBe(false);
  });

  it("POST aktif:false mematikan dan mencatat MATIKAN atas nama Super Admin", async () => {
    bot = jadwal({ aktif: true });
    aktor = "usr-super";
    const r = await POST({ aktif: false });
    expect(r.isi.data).toMatchObject({ berhasil: true, pesan: "Penarikan e-Court dimatikan." });
    expect(r.isi.data?.ringkas).toMatchObject({ keadaan: "mati", aktif: false });
    const baris = await jejak();
    expect(baris.map((b) => b.action)).toEqual(["MATIKAN_ECOURT_TARIK_DATA"]);
    expect(baris[0].actor_user_id).toBe("usr-super");
  });

  it("sudah sesuai: tidak menulis ke bot dan tidak ada jejak palsu", async () => {
    bot = jadwal({ aktif: true });
    const r = await POST({ aktif: true });
    expect(r.isi.data?.berhasil).toBe(true);
    expect(simpanan).toHaveLength(0);
    expect(await jejak()).toHaveLength(0);
  });

  it("badan bukan {aktif:boolean} = 400, tanpa menyentuh bot", async () => {
    for (const badan of [{}, { aktif: "ya" }, { aktif: 1 }, "bukan json{"]) {
      const r = await POST(badan);
      expect(r.status, JSON.stringify(badan)).toBe(400);
    }
    expect(simpanan).toHaveLength(0);
  });

  it("bot tidak terjangkau: GET tersedia:false, POST berhasil:false, tidak ada jejak", async () => {
    bot = null;
    const g = await GET();
    expect(g.isi.data).toMatchObject({ tersedia: false });
    expect(g.isi.data?.ringkas).toMatchObject({ keadaan: "tidak-terjangkau" });
    const p = await POST({ aktif: true });
    expect(p.isi.data).toMatchObject({ berhasil: false });
    expect(p.isi.data?.ringkas.keadaan).toBe("tidak-terjangkau");
    expect(await jejak()).toHaveLength(0);
  });

  it("bot menolak simpan: berhasil:false dengan alasan, keadaan lama tetap, tanpa jejak", async () => {
    bot = jadwal({ aktif: false });
    tolakSimpan = true;
    const p = await POST({ aktif: true });
    expect(p.isi.data?.berhasil).toBe(false);
    expect(String(p.isi.data?.pesan)).toContain("jam_selesai_harus_setelah_jam_mulai");
    expect(p.isi.data?.ringkas).toMatchObject({ keadaan: "mati" });
    expect(await jejak()).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("3. popup ekstensi: baris Tarik data e-Court (JSDOM sungguhan)", () => {
  const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
  const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
  const popupHtml = baca("popup.html");
  const popupJs = baca("popup.js");
  const daftarFiturJs = baca("daftar-fitur.js");
  const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const terbuka: JSDOM[] = [];
  afterEach(() => {
    while (terbuka.length) terbuka.pop()!.window.close();
  });

  type Tiruan = {
    peran: string;
    /** Jawaban GET rute; fungsi supaya bisa berubah di tengah uji. */
    get: () => { status: number; data?: unknown } | "lempar";
    post?: (badan: { aktif: boolean }) => { status: number; data?: unknown };
  };

  function bukaPopup(t: Tiruan) {
    const html = popupHtml.replace(/<script[\s\S]*?<\/script>/g, "");
    const dom = new JSDOM(html, { url: "chrome-extension://aleta/popup.html", runScripts: "outside-only" });
    terbuka.push(dom);
    const w = dom.window as any;
    const simpanan: Record<string, unknown> = { asalPortal: "http://192.168.10.10/aleta" };
    const salin = (x: unknown) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
    const panggilan: Array<{ alamat: string; cara: string; badan?: string }> = [];
    w.chrome = {
      runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.196.0", host_permissions: ["http://192.168.10.10/*", "http://127.0.0.1/*"] }), sendMessage: async () => ({}) },
      storage: {
        local: {
          get: async (kunci?: string | string[] | null) => {
            const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
            const hasil: Record<string, unknown> = {};
            for (const x of daftar) if (x in simpanan) hasil[x] = salin(simpanan[x]);
            return hasil;
          },
          set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, salin(isi)),
          remove: async (kunci: string | string[]) => {
            for (const k of [kunci].flat()) delete simpanan[k];
          },
        },
        session: { get: async () => ({}), set: async () => undefined },
        onChanged: { addListener() {} },
      },
    };
    w.fetch = async (alamat: string, init?: { method?: string; body?: string }) => {
      const a = String(alamat);
      const cara = String((init && init.method) || "GET").toUpperCase();
      panggilan.push({ alamat: a, cara, badan: init?.body });
      if (a.includes("info=siapa")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, data: { pengguna: { nama: "Uji", peran: t.peran }, versi: "1.196.0" } }) };
      }
      if (a.includes("/ekstensi/tarik-ecourt")) {
        const j = cara === "POST" ? (t.post ? t.post(JSON.parse(String(init?.body))) : { status: 500 }) : t.get();
        if (j === "lempar") throw new w.TypeError("Failed to fetch");
        return { ok: j.status >= 200 && j.status < 300, status: j.status, json: async () => ({ ok: j.status < 300, data: j.data }) };
      }
      return { ok: true, status: 200, url: a, json: async () => ({}) };
    };
    const ctx = (dom as unknown as { getInternalVMContext: () => vm.Context }).getInternalVMContext();
    vm.runInContext(daftarFiturJs, ctx, { filename: "daftar-fitur.js" });
    vm.runInContext(popupJs, ctx, { filename: "popup.js" });
    const d = w.document as Document;
    return { w, d, panggilan, simpanan, bagian: () => d.getElementById("bagianTarikEcourt") as HTMLElement };
  }

  async function sampai(syarat: () => boolean, apa: string) {
    const mulai = Date.now();
    while (!syarat()) {
      if (Date.now() - mulai > 2500) throw new Error(`tidak kunjung: ${apa}`);
      await tunggu(10);
    }
  }
  const siap = (p: ReturnType<typeof bukaPopup>) =>
    sampai(() => !/memuat/.test(p.d.getElementById("akunAleta")!.textContent || ""), "portal terbaca");

  const ringkas = (keadaan: string, label: string, aktif: boolean | null, keterangan = "ket", ekstra: Record<string, unknown> = {}) => ({
    keadaan,
    aktif,
    label,
    keterangan,
    sedangJalan: false,
    terakhirSelesai: null,
    ...ekstra,
  });

  it("markup: tersembunyi dari awal, status adalah tombol, ada konfirmasi tersembunyi", () => {
    const dom = new JSDOM(popupHtml.replace(/<script[\s\S]*?<\/script>/g, ""));
    terbuka.push(dom);
    const d = dom.window.document;
    expect((d.getElementById("bagianTarikEcourt") as HTMLElement).hidden).toBe(true);
    expect(d.getElementById("tarikEcourtStatus")!.tagName).toBe("BUTTON");
    expect((d.getElementById("tarikEcourtYakin") as HTMLElement).hidden).toBe(true);
  });

  it("peran lain (Hakim): baris tersembunyi dan rutenya TIDAK dipanggil", async () => {
    const p = bukaPopup({ peran: "Hakim", get: () => ({ status: 403 }) });
    await siap(p);
    await tunggu(80);
    expect(p.bagian().hidden).toBe(true);
    expect(p.panggilan.some((x) => x.alamat.includes("tarik-ecourt"))).toBe(false);
  });

  it("Super Admin, penjadwal mati: kelabu 'Tidak aktif'; klik -> tanya -> Ya -> POST {aktif:true} -> hijau", async () => {
    let aktif = false;
    const p = bukaPopup({
      peran: "Super Admin",
      get: () => ({ status: 200, data: { tersedia: true, ringkas: ringkas("mati", "Tidak aktif", false, "Penarikan berkala berkas e-Court mati. Klik status untuk mengaktifkan.") } }),
      post: (b) => {
        aktif = b.aktif;
        return {
          status: 200,
          data: { berhasil: true, pesan: "Penarikan e-Court diaktifkan.", ringkas: ringkas("aktif", "Aktif", true, "Menarik tiap 2 jam.", { terakhirSelesai: new Date().toISOString() }) },
        };
      },
    });
    await siap(p);
    await sampai(() => p.bagian().getAttribute("data-keadaan") === "mati", "keadaan mati tergambar");
    const tombol = p.d.getElementById("tarikEcourtStatus") as HTMLButtonElement;
    expect(p.bagian().hidden).toBe(false);
    expect(tombol.textContent).toBe("Tidak aktif");
    expect(tombol.disabled).toBe(false);
    expect(p.d.getElementById("tarikEcourtKet")!.textContent).toMatch(/Klik status untuk mengaktifkan/);
    expect((p.d.getElementById("tarikEcourtYakin") as HTMLElement).hidden).toBe(true);

    tombol.click();
    expect((p.d.getElementById("tarikEcourtYakin") as HTMLElement).hidden).toBe(false);
    expect(p.d.getElementById("tarikEcourtTanya")!.textContent).toMatch(/Aktifkan penarikan/);
    // Belum ada POST sebelum dikonfirmasi.
    expect(p.panggilan.some((x) => x.cara === "POST")).toBe(false);

    (p.d.getElementById("tarikEcourtYa") as HTMLButtonElement).click();
    await sampai(() => p.bagian().getAttribute("data-keadaan") === "aktif", "berganti hijau");
    expect(aktif).toBe(true);
    const kirim = p.panggilan.filter((x) => x.cara === "POST");
    expect(kirim).toHaveLength(1);
    expect(JSON.parse(String(kirim[0].badan))).toEqual({ aktif: true });
    expect(tombol.textContent).toBe("Aktif");
    expect(p.d.getElementById("tarikEcourtKet")!.textContent).toMatch(/diaktifkan/);
    expect((p.d.getElementById("tarikEcourtYakin") as HTMLElement).hidden).toBe(true);
    // Tidak disimpan di penyimpanan peramban.
    expect(Object.keys(p.simpanan).some((k) => /tarik/i.test(k))).toBe(false);
  });

  it("Admin, aktif: hijau dengan waktu tarikan terakhir; Batal tidak mengirim apa pun", async () => {
    const p = bukaPopup({
      peran: "Admin",
      get: () => ({
        status: 200,
        data: { tersedia: true, ringkas: ringkas("aktif", "Aktif", true, "Menarik tiap 2 jam.", { terakhirSelesai: new Date().toISOString() }) },
      }),
    });
    await siap(p);
    await sampai(() => p.bagian().getAttribute("data-keadaan") === "aktif", "hijau");
    expect(p.d.getElementById("tarikEcourtKet")!.textContent).toMatch(/Tarikan terakhir: hari ini \d/);
    (p.d.getElementById("tarikEcourtStatus") as HTMLButtonElement).click();
    expect(p.d.getElementById("tarikEcourtTanya")!.textContent).toMatch(/Matikan penarikan/);
    (p.d.getElementById("tarikEcourtBatal") as HTMLButtonElement).click();
    expect((p.d.getElementById("tarikEcourtYakin") as HTMLElement).hidden).toBe(true);
    expect(p.panggilan.some((x) => x.cara === "POST")).toBe(false);
    expect(p.bagian().getAttribute("data-keadaan")).toBe("aktif");
  });

  it("aktif tetapi perlu perhatian: kuning, sebab tampil, masih bisa dimatikan", async () => {
    const p = bukaPopup({
      peran: "Admin",
      get: () => ({ status: 200, data: { tersedia: true, ringkas: ringkas("perhatian", "Aktif, perlu perhatian", true, "Sesi e-Court habis - perlu login ulang dari portal ALETA.") } }),
      post: (b) => ({
        status: 200,
        data: { berhasil: true, pesan: "Penarikan e-Court dimatikan.", ringkas: ringkas("mati", "Tidak aktif", b.aktif) },
      }),
    });
    await siap(p);
    await sampai(() => p.bagian().getAttribute("data-keadaan") === "perhatian", "kuning");
    expect(p.d.getElementById("tarikEcourtKet")!.textContent).toMatch(/Sesi e-Court habis/);
    const tombol = p.d.getElementById("tarikEcourtStatus") as HTMLButtonElement;
    expect(tombol.disabled).toBe(false);
    tombol.click();
    expect(p.d.getElementById("tarikEcourtTanya")!.textContent).toMatch(/Matikan/);
    (p.d.getElementById("tarikEcourtYa") as HTMLButtonElement).click();
    await sampai(() => p.bagian().getAttribute("data-keadaan") === "mati", "kelabu");
    expect(JSON.parse(String(p.panggilan.find((x) => x.cara === "POST")!.badan))).toEqual({ aktif: false });
  });

  it("gagal menyimpan: keadaan lama tetap dan alasannya disebut", async () => {
    const p = bukaPopup({
      peran: "Super Admin",
      get: () => ({ status: 200, data: { tersedia: true, ringkas: ringkas("mati", "Tidak aktif", false) } }),
      post: () => ({ status: 200, data: { berhasil: false, pesan: "ALETA Bot tidak menjawab - saklar tidak diubah.", ringkas: ringkas("mati", "Tidak aktif", false) } }),
    });
    await siap(p);
    await sampai(() => p.bagian().getAttribute("data-keadaan") === "mati", "kelabu");
    (p.d.getElementById("tarikEcourtStatus") as HTMLButtonElement).click();
    (p.d.getElementById("tarikEcourtYa") as HTMLButtonElement).click();
    await sampai(() => /tidak menjawab/.test(p.d.getElementById("tarikEcourtKet")!.textContent || ""), "alasan tampil");
    expect(p.bagian().getAttribute("data-keadaan")).toBe("mati");
  });

  it("server mati / bot tidak terjangkau: merah dan tombol tidak bisa diklik", async () => {
    const mati = bukaPopup({ peran: "Super Admin", get: () => "lempar" });
    await siap(mati);
    await sampai(() => mati.bagian().getAttribute("data-keadaan") === "tidak-terjangkau", "merah (server)");
    expect((mati.d.getElementById("tarikEcourtStatus") as HTMLButtonElement).disabled).toBe(true);

    const bot = bukaPopup({
      peran: "Admin",
      get: () => ({ status: 200, data: { tersedia: false, pesan: "gateway_tidak_terjangkau", ringkas: ringkas("tidak-terjangkau", "Tidak terjangkau", null, "ALETA Bot tidak menjawab.") } }),
    });
    await siap(bot);
    await sampai(() => bot.bagian().getAttribute("data-keadaan") === "tidak-terjangkau", "merah (bot)");
    (bot.d.getElementById("tarikEcourtStatus") as HTMLButtonElement).click();
    expect((bot.d.getElementById("tarikEcourtYakin") as HTMLElement).hidden).toBe(true);
  });

  it("server menjawab 403 (peran dikira admin padahal bukan): baris disembunyikan lagi", async () => {
    const p = bukaPopup({ peran: "Super Admin", get: () => ({ status: 403 }) });
    await siap(p);
    await sampai(() => p.panggilan.some((x) => x.alamat.includes("tarik-ecourt")), "rute dipanggil");
    await tunggu(60);
    expect(p.bagian().hidden).toBe(true);
  });
});
