// @vitest-environment node
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { kalimatAlasan } from "@/server/modules/aleta-ecourt/ecourt-aksi";
import { peranEcourtDiharapkan, susunRekap } from "@/server/modules/aleta-ecourt/ecourt-akun-pengguna";

/**
 * ============================================================================
 * BUTIR 20 (5 Okt 2026) - AKUN e-COURT MILIK TIAP PENGGUNA
 * ============================================================================
 *
 * Diuji dengan TIRUAN e-Court (pengemudi peramban palsu); tidak ada peramban,
 * jaringan, atau kredensial sungguhan. Yang dijaga:
 *
 *   - akun e-Court disimpan PER PENGGUNA per peran, surel dan sandi tersandi;
 *     sandi tidak pernah ada di berkas polos, jawaban rute, jejak, atau audit;
 *   - "Uji masuk" memakai akun MILIK pengguna yang meminta - A memakai akun A,
 *     tidak pernah akun B; tanpa akun tersimpan = ditolak dengan petunjuk;
 *   - aksi tulis tanpa sesi berhenti dengan alasan yang menyebut cara
 *     mengisinya, tanpa menyentuh e-Court dan tanpa beralih ke akun lain;
 *   - juru sita ikut boleh mengunggah dengan akunnya sendiri;
 *   - akun SIPP yang terbuka milik pengguna ALETA lain = unggah ditolak;
 *   - admin hanya melihat rekap (tanpa sandi), tidak dapat mengubah akun orang.
 */

const AKAR = path.resolve(process.cwd(), "..");
const SEMENTARA = path.resolve("D:/Aplikasi/aleta/tmp", `uji-akun-ecourt-${process.pid}`);
mkdirSync(SEMENTARA, { recursive: true });
// WAJIB sebelum modul bot dimuat: kunci dan simpanan tidak boleh jatuh ke C:.
process.env.ALETA_ECOURT_SESSION_DIR = SEMENTARA;
process.env.ALETA_ECOURT_KREDENSIAL_DIR = SEMENTARA;

const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const muatBot = <T,>(rel: string) => require_(path.join(AKAR, "aleta_bot", rel)) as T;

const sesi = muatBot<Record<string, any>>("services/ecourtSesiPenggunaService.js");
const akun = muatBot<Record<string, any>>("services/ecourtAkunPenggunaService.js");
const aksiModul = muatBot<{ buatLayanan: (d: Record<string, unknown>) => Record<string, any> }>("services/ecourtAksiService.js");

const SANDI_A = "SandiMilikA-Uji-4q!";
const SANDI_B = "SandiMilikB-Uji-8z#";
const SURE_A = "hakim.a@uji.test";
const SURE_B = "pp.b@uji.test";
const COOKIE = (siapa: string) => `ci_session_${siapa}_rahasia`;

function isiSemuaBerkas(dir = SEMENTARA): string {
  if (!existsSync(dir)) return "";
  let teks = "";
  for (const nama of readdirSync(dir)) {
    const j = path.join(dir, nama);
    teks += statSync(j).isDirectory() ? isiSemuaBerkas(j) : readFileSync(j).toString("latin1");
  }
  return teks;
}

/** Tiruan e-Court: login diterima hanya untuk pasangan surel+sandi yang benar. */
function tiruanEcourt(over: Record<string, any> = {}) {
  const panggilan: Array<{ fungsi: string; arg: any }> = [];
  const catat = (fungsi: string, arg: any) => panggilan.push({ fungsi, arg });
  const benar: Record<string, string> = { [SURE_A]: SANDI_A, [SURE_B]: SANDI_B };
  return {
    panggilan,
    mulaiLogin: async () => (catat("mulaiLogin", null), { ok: true, token: "tok", captcha: "data:image/png;base64,AAA" }),
    kirimLogin: async (token: string, arg: any) => {
      catat("kirimLogin", { token, ...arg });
      if (benar[arg.email] !== arg.sandi) return { ok: false, alasan: "login_ditolak_ecourt" };
      const siapa = arg.email === SURE_A ? "A" : "B";
      return { ok: true, namaAkun: `Akun ${siapa}`, cookies: [{ name: "ci_session", value: COOKIE(siapa), domain: "ecourt.mahkamahagung.go.id" }] };
    },
    batalLogin: (token: string) => catat("batalLogin", token),
    unggahSalinan: async (arg: any) => (catat("unggahSalinan", arg), { ok: true, cookies: arg.cookies, putusanEcourt: { adaBaris: true } }),
    tteSalinan: async (arg: any) => (catat("tteSalinan", arg), { ok: true, cookies: arg.cookies }),
    verifikasi: async (arg: any) => (catat("verifikasi", arg), { ok: true, cookies: arg.cookies }),
    ...over,
  };
}

function depsUji(pengemudi: any) {
  return {
    pengemudi,
    sesi,
    rincianArsip: async () => ({ dokumen: [] }),
    putusan: {
      keadaanBanyak: async () => ({}),
      catatanBanyak: async () => ({}),
      simpan: async () => undefined,
    },
    identifikasiHakim: () => null,
    cekMajelis: async () => ({ anggota: false }),
    catatKeputusan: async () => undefined,
    dokumenSatu: async () => null,
    alamatPerkara: async () => "https://ecourt.mahkamahagung.go.id/view_detil_pendaftaran/xyz",
    tanggalPutusanSipp: async () => ({}),
    catat: () => undefined,
    folderSementara: () => path.join(SEMENTARA, "pengguna-tmp"),
  };
}

const PDF = Buffer.from("%PDF-1.7\n%uji\n");
const NOMOR = "3/Pdt.G/2026/PA.Dgl";

async function ujiMasukTersimpan(penggunaId: string, peran: string, e = tiruanEcourt()) {
  await sesi.mulaiSambung({ penggunaId, peran }, { pengemudi: e });
  const h = await sesi.kirimSambung({ penggunaId, peran, namaPengguna: penggunaId, captcha: "x1y2", pakaiTersimpan: true }, { pengemudi: e });
  return { h, e };
}

afterAll(() => {
  rmSync(SEMENTARA, { recursive: true, force: true });
});

// ============================================================================
describe("bot - simpanan akun e-Court per pengguna", () => {
  beforeEach(() => rmSync(path.join(SEMENTARA, "pengguna"), { recursive: true, force: true }));

  it("surel dan sandi tersimpan TERSANDI; layar hanya menerima surel dan tanda adaSandi", () => {
    expect(akun.simpan({ penggunaId: "usr-hakim", peran: "hakim", email: SURE_A, sandi: SANDI_A })).toEqual({ ok: true, alasan: "" });
    const berkas = isiSemuaBerkas();
    expect(berkas).not.toContain(SANDI_A);
    expect(berkas).not.toContain(SURE_A);
    const layar = akun.daftarMilik("usr-hakim");
    expect(layar).toEqual([expect.objectContaining({ peran: "hakim", email: SURE_A, adaSandi: true })]);
    expect(JSON.stringify(layar)).not.toContain(SANDI_A);
    expect(JSON.stringify(akun.daftarSemua())).not.toContain(SANDI_A);
    // Hanya pemiliknya: pengguna lain tidak melihat apa pun.
    expect(akun.daftarMilik("usr-ppg")).toEqual([]);
    expect(akun.ambil("usr-ppg", "hakim")).toBeNull();
    expect(akun.ambil("usr-hakim", "panitera")).toBeNull();
    expect(akun.ambil("usr-hakim", "hakim")).toEqual({ email: SURE_A, sandi: SANDI_A });
  });

  it("sandi kosong hanya boleh bila surelnya sama; peran dan pengguna tidak sah ditolak", () => {
    expect(akun.simpan({ penggunaId: "usr-hakim", peran: "hakim", email: SURE_A, sandi: "" }).alasan).toBe("sandi_kosong");
    akun.simpan({ penggunaId: "usr-hakim", peran: "hakim", email: SURE_A, sandi: SANDI_A });
    expect(akun.simpan({ penggunaId: "usr-hakim", peran: "hakim", email: SURE_A, sandi: "" }).ok).toBe(true);
    expect(akun.ambil("usr-hakim", "hakim")?.sandi).toBe(SANDI_A);
    // Surel baru dengan sandi lama = mengetik sandi akun A ke akun lain.
    expect(akun.simpan({ penggunaId: "usr-hakim", peran: "hakim", email: SURE_B, sandi: "" }).alasan).toBe("surel_berganti_sandi_wajib");
    expect(akun.simpan({ penggunaId: "usr-hakim", peran: "dewa", email: SURE_A, sandi: SANDI_A }).ok).toBe(false);
    expect(akun.simpan({ penggunaId: "../etc", peran: "hakim", email: SURE_A, sandi: SANDI_A }).ok).toBe(false);
    expect(akun.hapus({ penggunaId: "usr-hakim", peran: "hakim" }).ok).toBe(true);
    expect(akun.daftarMilik("usr-hakim")).toEqual([]);
  });
});

// ============================================================================
describe("bot - Uji masuk memakai akun milik pengguna yang meminta", () => {
  beforeEach(() => rmSync(path.join(SEMENTARA, "pengguna"), { recursive: true, force: true }));

  it("A memakai akun A dan B memakai akun B - tidak pernah tertukar", async () => {
    akun.simpan({ penggunaId: "usr-hakim", peran: "hakim", email: SURE_A, sandi: SANDI_A });
    akun.simpan({ penggunaId: "usr-ppg", peran: "panitera-pengganti", email: SURE_B, sandi: SANDI_B });
    const a = await ujiMasukTersimpan("usr-hakim", "hakim");
    expect(a.h).toMatchObject({ ok: true, namaAkunEcourt: "Akun A", dariSimpanan: true });
    expect(a.e.panggilan.find((p) => p.fungsi === "kirimLogin")?.arg).toMatchObject({ email: SURE_A, sandi: SANDI_A, captcha: "x1y2" });
    const b = await ujiMasukTersimpan("usr-ppg", "panitera-pengganti");
    expect(b.e.panggilan.find((p) => p.fungsi === "kirimLogin")?.arg).toMatchObject({ email: SURE_B, sandi: SANDI_B });
    expect(sesi.ambilCookies("usr-hakim", "hakim")?.[0].value).toBe(COOKIE("A"));
    expect(sesi.ambilCookies("usr-ppg", "panitera-pengganti")?.[0].value).toBe(COOKIE("B"));
    expect(akun.daftarMilik("usr-hakim")[0]).toMatchObject({ hasilUji: "berhasil" });
    expect(JSON.stringify([a.h, b.h])).not.toMatch(/SandiMilik/);
  });

  it("tanpa akun tersimpan: ditolak akun_ecourt_belum_diisi, formulir dibatalkan, sandi tidak dikirim ke e-Court", async () => {
    akun.simpan({ penggunaId: "usr-ppg", peran: "panitera-pengganti", email: SURE_B, sandi: SANDI_B });
    const { h, e } = await ujiMasukTersimpan("usr-jurusita", "juru-sita");
    expect(h).toMatchObject({ ok: false, alasan: "akun_ecourt_belum_diisi" });
    expect(e.panggilan.map((p) => p.fungsi)).toEqual(["mulaiLogin", "batalLogin"]);
  });

  it("sandi tersimpan yang ditolak e-Court dicatat 'ditolak' dan tidak membuat sesi", async () => {
    akun.simpan({ penggunaId: "usr-hakim", peran: "hakim", email: SURE_A, sandi: "sandi-keliru" });
    const { h } = await ujiMasukTersimpan("usr-hakim", "hakim");
    expect(h).toMatchObject({ ok: false, alasan: "login_ditolak_ecourt" });
    expect(akun.daftarMilik("usr-hakim")[0]).toMatchObject({ hasilUji: "ditolak" });
    expect(sesi.ambilCookies("usr-hakim", "hakim")).toBeNull();
  });

  it("'simpan akun ini' saat masuk manual: disimpan HANYA bila e-Court menerima login", async () => {
    const e = tiruanEcourt();
    await sesi.mulaiSambung({ penggunaId: "usr-hakim", peran: "hakim" }, { pengemudi: e });
    const gagal = await sesi.kirimSambung(
      { penggunaId: "usr-hakim", peran: "hakim", email: SURE_A, sandi: "salah", captcha: "c", simpanAkun: true },
      { pengemudi: e }
    );
    expect(gagal.ok).toBe(false);
    expect(akun.daftarMilik("usr-hakim")).toEqual([]);
    await sesi.mulaiSambung({ penggunaId: "usr-hakim", peran: "hakim" }, { pengemudi: e });
    const ok = await sesi.kirimSambung(
      { penggunaId: "usr-hakim", peran: "hakim", email: SURE_A, sandi: SANDI_A, captcha: "c", simpanAkun: true },
      { pengemudi: e }
    );
    expect(ok).toMatchObject({ ok: true, akunDisimpan: true });
    expect(akun.ambil("usr-hakim", "hakim")).toEqual({ email: SURE_A, sandi: SANDI_A });
    expect(isiSemuaBerkas()).not.toContain(SANDI_A);
  });
});

// ============================================================================
describe("bot - aksi tulis memakai akun pengguna yang meminta", () => {
  beforeEach(() => rmSync(path.join(SEMENTARA, "pengguna"), { recursive: true, force: true }));

  it("unggah oleh A memakai cookie A walau B juga tersambung", async () => {
    akun.simpan({ penggunaId: "usr-hakim", peran: "hakim", email: SURE_A, sandi: SANDI_A });
    akun.simpan({ penggunaId: "usr-ppg", peran: "panitera-pengganti", email: SURE_B, sandi: SANDI_B });
    await ujiMasukTersimpan("usr-hakim", "hakim");
    await ujiMasukTersimpan("usr-ppg", "panitera-pengganti");
    const e = tiruanEcourt();
    const l = aksiModul.buatLayanan(depsUji(e));
    const hb = await l.unggahSalinan({ penggunaId: "usr-ppg", nama: "PP B", nomorPerkara: NOMOR, isi: PDF, konfirmasi: true });
    expect(hb).toMatchObject({ ok: true, akun: { nama: "Akun B", peran: "Panitera Pengganti" } });
    expect(e.panggilan.find((p) => p.fungsi === "unggahSalinan")?.arg.cookies[0].value).toBe(COOKIE("B"));
  });

  it("tanpa akun dan tanpa sesi: berhenti dengan petunjuk mengisi akun sendiri, e-Court tidak disentuh", async () => {
    // Orang lain punya sesi yang cocok - tetap tidak dipakai.
    akun.simpan({ penggunaId: "usr-ppg", peran: "panitera-pengganti", email: SURE_B, sandi: SANDI_B });
    await ujiMasukTersimpan("usr-ppg", "panitera-pengganti");
    const e = tiruanEcourt();
    const l = aksiModul.buatLayanan(depsUji(e));
    const h = await l.unggahSalinan({ penggunaId: "usr-hakim", nama: "Hakim", nomorPerkara: NOMOR, isi: PDF, konfirmasi: true });
    expect(h).toMatchObject({ ok: false, alasan: "akun_ecourt_belum_diisi" });
    expect(h.peranDiperlukan).toEqual(["Hakim", "Panitera Pengganti", "Panitera", "Juru Sita"]);
    expect(e.panggilan).toHaveLength(0);
    expect(kalimatAlasan(h.alasan)).toContain("Akun e-Court saya");
    expect(kalimatAlasan(h.alasan)).toContain("tidak memakai akun e-Court orang lain");
    const t = await l.tte({ penggunaId: "usr-hakim", nama: "Hakim", nomorPerkara: NOMOR, passphrase: "pp", konfirmasi: true });
    expect(t).toMatchObject({ ok: false, alasan: "akun_ecourt_belum_diisi", peranDiperlukan: ["Panitera"] });
  });

  it("akun tersimpan tetapi sesi habis: 'sesi_habis_akun_tersimpan' (cukup Uji masuk)", async () => {
    akun.simpan({ penggunaId: "usr-hakim", peran: "hakim", email: SURE_A, sandi: SANDI_A });
    await ujiMasukTersimpan("usr-hakim", "hakim");
    sesi.tandaiKedaluwarsa("usr-hakim", "hakim");
    const l = aksiModul.buatLayanan(depsUji(tiruanEcourt()));
    const h = await l.akunPutusan({ penggunaId: "usr-hakim", nomorPerkara: NOMOR });
    expect(h).toMatchObject({ akun: null, alasan: "sesi_habis_akun_tersimpan" });
    expect(kalimatAlasan(h.alasan)).toContain("cukup ketik captcha");
  });

  it("juru sita dengan akunnya sendiri boleh mengunggah (dulu ditolak: peran tidak terdaftar untuk unggah)", async () => {
    akun.simpan({ penggunaId: "usr-jurusita", peran: "juru-sita", email: SURE_B, sandi: SANDI_B });
    await ujiMasukTersimpan("usr-jurusita", "juru-sita");
    const e = tiruanEcourt();
    const h = await aksiModul
      .buatLayanan(depsUji(e))
      .unggahSalinan({ penggunaId: "usr-jurusita", nama: "JS", nomorPerkara: NOMOR, isi: PDF, konfirmasi: true });
    expect(h).toMatchObject({ ok: true, akun: { peran: "Juru Sita" } });
    expect(e.panggilan.find((p) => p.fungsi === "unggahSalinan")?.arg.cookies[0].value).toBe(COOKIE("B"));
  });
});

// ============================================================================
describe("rute bot - akun e-Court pengguna", () => {
  beforeEach(() => rmSync(path.join(SEMENTARA, "pengguna"), { recursive: true, force: true }));

  it("simpan/daftar/rekap tanpa sandi di jawaban; tidak ada rute yang membuka sandi", async () => {
    process.env.ALETA_BOT_INTERNAL_API_TOKEN = "token-uji-20";
    const express = require_("express") as any;
    const app = express();
    app.use(express.json());
    app.use("/internal/aleta-bot", muatBot("routes/ecourtAksiRoutes.js"));
    const server = await new Promise<any>((ok) => {
      const s = app.listen(0, "127.0.0.1", () => ok(s));
    });
    const kepala = { "content-type": "application/json", "x-aleta-internal-token": "token-uji-20" };
    try {
      const alamat = `http://127.0.0.1:${server.address().port}/internal/aleta-bot`;
      expect((await fetch(`${alamat}/ecourt-pengguna/rekap`)).status).toBe(401);
      const s = await fetch(`${alamat}/ecourt-pengguna/akun/simpan`, {
        method: "POST",
        headers: kepala,
        body: JSON.stringify({ penggunaId: "usr-hakim", peran: "hakim", email: SURE_A, sandi: SANDI_A }),
      });
      const teksSimpan = await s.text();
      expect(JSON.parse(teksSimpan)).toEqual({ ok: true, alasan: "" });
      const teks = [
        teksSimpan,
        await (await fetch(`${alamat}/ecourt-pengguna/akun?penggunaId=usr-hakim`, { headers: kepala })).text(),
        await (await fetch(`${alamat}/ecourt-pengguna/sesi?penggunaId=usr-hakim`, { headers: kepala })).text(),
        await (await fetch(`${alamat}/ecourt-pengguna/rekap`, { headers: kepala })).text(),
      ].join("\n");
      expect(teks).toContain(SURE_A);
      expect(teks).not.toContain(SANDI_A);
      expect(JSON.parse(teks.split("\n")[3]).akun).toEqual([expect.objectContaining({ penggunaId: "usr-hakim", adaSandi: true })]);
    } finally {
      server.close();
      delete process.env.ALETA_BOT_INTERNAL_API_TOKEN;
    }
    const router = readFileSync(path.join(AKAR, "aleta_bot/routes/ecourtAksiRoutes.js"), "utf8");
    expect(router).not.toMatch(/akunPengguna\.ambil\s*\(/);
  });
});

// ============================================================================
// Rute portal atas pg-mem berbenih; bot ditiru lewat fetch.
// ============================================================================
let db: AletaDatabase | null = null;
let aktor: string | null = "usr-hakim";
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
const d = () => db as AletaDatabase;

type Kiriman = { url: string; badan: any };
let kiriman: Kiriman[] = [];
function tiruBot(jawab: (url: string, badan: any) => { status?: number; json?: unknown }) {
  kiriman = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const badan = init?.body ? JSON.parse(String(init.body)) : null;
    kiriman.push({ url: String(url), badan });
    const j = jawab(String(url), badan);
    return new Response(JSON.stringify(j.json ?? {}), { status: j.status ?? 200, headers: { "content-type": "application/json" } });
  });
}

async function rute(modul: string, cara: "GET" | "POST", opsi: { query?: string; badan?: unknown; form?: FormData } = {}) {
  const r = (await import(`@/app/api/aleta-ecourt/${modul}/route`)) as Record<string, (q: NextRequest) => Promise<Response>>;
  const req = new NextRequest("http://localhost/api/x" + (opsi.query ? `?${opsi.query}` : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : {},
    body: opsi.form ?? (opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined),
  });
  const j = await r[cara](req);
  return { status: j.status, isi: (await j.json()) as any };
}

async function semuaJejakDanAudit() {
  const a = await d().queryAll<Record<string, unknown>>("SELECT * FROM aleta_ecourt_aksi_jejak");
  const b = await d().queryAll<Record<string, unknown>>("SELECT * FROM audit_logs");
  return JSON.stringify(a) + JSON.stringify(b);
}

async function kredensialSipp(userId: string, username: string) {
  const kini = new Date().toISOString();
  await d().prepare("DELETE FROM external_app_credentials WHERE user_id = ? AND app_id = 'sipp'").run(userId);
  await d()
    .prepare(
      "INSERT INTO external_app_credentials (id, user_id, app_id, external_username, is_enabled, last_verified_status, created_at, updated_at) VALUES (?, ?, 'sipp', ?, 1, 'success', ?, ?)"
    )
    .run(`eac-uji-${userId}`, userId, username, kini, kini);
}

describe("rute portal - akun e-Court milik sendiri, rekap admin, penjaga akun SIPP", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-hakim";
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db?.close();
    db = null;
  });

  it("simpan-akun: penggunaId dari akun yang login (bukan badan), sandi tidak ada di jawaban/jejak/audit", async () => {
    tiruBot(() => ({ status: 400, json: { ok: false, alasan: `gagal ${SANDI_A}` } }));
    const gagal = await rute("ecourt-sesi", "POST", {
      badan: { aksi: "simpan-akun", peran: "hakim", email: SURE_A, sandi: SANDI_A, penggunaId: "usr-super" },
    });
    expect(kiriman[0].url).toContain("/internal/aleta-bot/ecourt-pengguna/akun/simpan");
    expect(kiriman[0].badan).toMatchObject({ penggunaId: "usr-hakim", peran: "hakim", email: SURE_A, sandi: SANDI_A });
    expect(JSON.stringify(gagal.isi)).not.toContain(SANDI_A);
    tiruBot(() => ({ json: { ok: true, alasan: "" } }));
    const h = await rute("ecourt-sesi", "POST", { badan: { aksi: "simpan-akun", peran: "hakim", email: SURE_A, sandi: SANDI_A } });
    expect(h.isi.data).toMatchObject({ ok: true });
    const tersimpan = await semuaJejakDanAudit();
    expect(tersimpan).toContain("ECOURT_AKUN_PRIBADI_DISIMPAN");
    expect(tersimpan).not.toContain(SANDI_A);
    expect(tersimpan).not.toContain(SURE_A);
  });

  it("Uji masuk (pakaiTersimpan): portal TIDAK meneruskan surel/sandi dari badan - bot mengambil milik penggunaId", async () => {
    tiruBot(() => ({ json: { ok: true, namaAkunEcourt: "Akun A" } }));
    await rute("ecourt-sesi", "POST", {
      badan: { aksi: "kirim", peran: "hakim", captcha: "c", pakaiTersimpan: true, email: SURE_B, sandi: SANDI_B },
    });
    expect(kiriman[0].badan).toMatchObject({ penggunaId: "usr-hakim", pakaiTersimpan: true, email: "", sandi: "", simpanAkun: false });
  });

  it("rekap: hanya admin; berisi jabatan hakim/panitera/PP/juru sita, tanpa sandi", async () => {
    tiruBot(() => ({
      json: {
        ok: true,
        akun: [{ penggunaId: "usr-hakim", peran: "hakim", email: SURE_A, adaSandi: true, diperbaruiPada: "", diujiPada: "", hasilUji: "berhasil" }],
        sesi: [{ penggunaId: "usr-hakim", peran: "hakim", keadaan: "tersambung", namaAkunEcourt: "Akun A", terakhirDipakai: "" }],
      },
    }));
    expect((await rute("ecourt-sesi/rekap", "GET")).status).toBe(403);
    expect(kiriman).toHaveLength(0);
    aktor = "usr-admin";
    const h = await rute("ecourt-sesi/rekap", "GET");
    expect(h.status).toBe(200);
    const baris = h.isi.data.baris as Array<any>;
    const per = (id: string) => baris.find((b) => b.penggunaId === id);
    expect(per("usr-hakim")).toMatchObject({ keadaan: "sudah" });
    expect(per("usr-hakim").akun[0]).toMatchObject({ peran: "hakim", email: SURE_A, sesi: "tersambung" });
    expect(per("usr-jurusita")).toMatchObject({ keadaan: "belum", peranDiharapkan: ["juru-sita"] });
    expect(per("usr-ppg")).toMatchObject({ keadaan: "belum", peranDiharapkan: ["panitera-pengganti"] });
    expect(per("usr-panitera")).toMatchObject({ peranDiharapkan: ["panitera"] });
    expect(per("usr-dina")).toBeUndefined();
    expect(JSON.stringify(h.isi)).not.toMatch(/"sandi"/i);
  });

  it("unggah: akun SIPP yang terbuka milik pengguna ALETA lain = ditolak tanpa memanggil bot", async () => {
    await kredensialSipp("usr-ppg", "pp.lain.uji");
    await kredensialSipp("usr-hakim", "hakim.sendiri.uji");
    tiruBot(() => ({ json: { ok: true, akun: { nama: "Akun A", peran: "Hakim" }, salinan: null } }));
    const form = (olehUsername: string) => {
      const f = new FormData();
      f.set("nomor", NOMOR);
      f.set("berkas", new Blob(["%PDF-1.7 isi"], { type: "application/pdf" }), "salinan.pdf");
      f.set("olehUsername", olehUsername);
      return f;
    };
    const tolak = await rute("ecourt-putusan/unggah", "POST", { form: form("pp.lain.uji") });
    expect(tolak.isi.data).toMatchObject({ ok: false, alasan: "akun_sipp_milik_pengguna_lain" });
    expect(kiriman).toHaveLength(0);
    expect(await semuaJejakDanAudit()).toContain("akun_sipp_milik_pengguna_lain");
    // Akun SIPP sendiri, atau yang belum tersimpan di ALETA: diteruskan atas nama yang login.
    expect((await rute("ecourt-putusan/unggah", "POST", { form: form("hakim.sendiri.uji") })).isi.data.ok).toBe(true);
    expect((await rute("ecourt-putusan/unggah", "POST", { form: form("tak.dikenal") })).isi.data.ok).toBe(true);
    expect(kiriman.map((k) => k.badan.penggunaId)).toEqual(["usr-hakim", "usr-hakim"]);
    // GET akun pun menyebutnya sebelum tombol ditekan.
    kiriman = [];
    const akunGet = await rute("ecourt-putusan/akun", "GET", { query: `nomor=${encodeURIComponent(NOMOR)}&olehUsername=pp.lain.uji` });
    expect(akunGet.isi.data).toMatchObject({ akun: null, alasan: "akun_sipp_milik_pengguna_lain" });
    expect(kiriman).toHaveLength(0);
  });

  it("jalur portal yang baru terdaftar di router bot", () => {
    const router = readFileSync(path.join(AKAR, "aleta_bot/routes/ecourtAksiRoutes.js"), "utf8");
    const terdaftar = new Set([...router.matchAll(/router\.(?:get|post)\(\s*"([^"]+)"/g)].map((m) => m[1]));
    for (const j of ["/ecourt-pengguna/akun", "/ecourt-pengguna/akun/simpan", "/ecourt-pengguna/akun/hapus", "/ecourt-pengguna/rekap"]) {
      expect(terdaftar.has(j), j).toBe(true);
    }
  });
});

describe("peran e-Court menurut jabatan ALETA", () => {
  it("hakim/ketua, panitera/panmud, PP, juru sita (pengganti) dikenali; jabatan lain tidak", () => {
    expect(peranEcourtDiharapkan({ roleId: "ketua", positionId: "pos-ketua" })).toEqual(["hakim"]);
    expect(peranEcourtDiharapkan({ roleId: "staf", positionId: "pos-jurusita-pengganti" })).toEqual(["juru-sita"]);
    expect(peranEcourtDiharapkan({ roleId: "staf", positionId: "pos-panitera-pengganti" })).toEqual(["panitera-pengganti"]);
    expect(peranEcourtDiharapkan({ roleId: "pejabat-struktural", positionId: "pos-panitera-muda-hukum" })).toEqual(["panitera"]);
    expect(peranEcourtDiharapkan({ roleId: "staf", positionId: "pos-ptsp" })).toEqual([]);
    const r = susunRekap(
      [{ id: "u1", name: "Staf", roleId: "staf", positionId: "pos-ptsp" }],
      [{ penggunaId: "u1", peran: "lainnya", email: "x@y", adaSandi: true, diperbaruiPada: "", diujiPada: "", hasilUji: "" }],
      []
    );
    expect(r).toEqual([expect.objectContaining({ penggunaId: "u1", keadaan: "sudah" })]);
  });
});
