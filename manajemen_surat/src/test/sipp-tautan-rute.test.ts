// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { kapabilitasPengguna, simpanPengecualianPengguna } from "@/server/modules/aleta-ecourt/akses";
import { susunAlamatSipp } from "@/server/modules/aleta-ecourt/sipp-tautan";

/**
 * ============================================================================
 * GET /api/aleta-ecourt/sipp-tautan - KONTRAK YANG DIBACA TOMBOL STATUS PERKARA
 * ============================================================================
 *
 * Handler GET sungguhan atas pg-mem berbenih, dengan klien gerbang bot yang
 * SUNGGUHAN pula (gatewayFetch) - yang ditiru hanya fetch global, yaitu bot di
 * ujung kabelnya. Dengan begitu "bot tak terjangkau" diuji sebagaimana terjadi:
 * koneksi ditolak, halaman 404 dari bot lama, penolakan berkalimat.
 *
 * Kontraknya: SELALU 200 { ok:true, data:{ alamat, alasan } } - alamat mutlak,
 * atau "" dengan alasan berupa kalimat untuk petugas. Yang bukan 200 hanya
 * galat kewenangan, seperti rute Status Perkara.
 */

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-admin";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

type Permintaan = { url: string; token: string };
let permintaan: Permintaan[] = [];
let jawabBot: (url: string) => Promise<Response> = async () => {
  throw new Error("jawaban bot belum ditentukan");
};

const JSON_BOT = (isi: unknown, status = 200) =>
  new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });

const SEGMEN = "bE9TV0oxaEFKNGZyMjhhUVhPTzJjZz09";
const JAWABAN_SAH = {
  ok: true,
  jalur: `perkara_detil_agama/${SEGMEN}`,
  pintu: "perkara_detil_agama",
  perkaraId: "888",
  nomorPerkara: "53/Pdt.G/2019/PA.Dgl",
};

const ENV_DIJAGA = ["ALETA_SIPP_BASE_URL", "ALETA_BOT_BASE_URL", "ALETA_BOT_INTERNAL_API_TOKEN"] as const;
const envAwal: Record<string, string | undefined> = {};
for (const nama of ENV_DIJAGA) envAwal[nama] = process.env[nama];

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-admin";
  permintaan = [];
  jawabBot = async () => JSON_BOT(JAWABAN_SAH);
  delete process.env.ALETA_SIPP_BASE_URL;
  process.env.ALETA_BOT_BASE_URL = "http://bot-uji:3003";
  process.env.ALETA_BOT_INTERNAL_API_TOKEN = "token-uji";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const kepala = (init?.headers ?? {}) as Record<string, string>;
      permintaan.push({ url: String(url), token: String(kepala["x-aleta-internal-token"] ?? "") });
      return jawabBot(String(url));
    })
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const nama of ENV_DIJAGA) {
    if (envAwal[nama] === undefined) delete process.env[nama];
    else process.env[nama] = envAwal[nama];
  }
  await db?.close();
  db = null;
});

type Isi = { ok: boolean; data: { alamat: string; alasan: string }; error?: unknown };

async function panggil(kueri = "") {
  const { GET } = await import("@/app/api/aleta-ecourt/sipp-tautan/route");
  const jawaban = await GET(new NextRequest(`http://localhost/api/aleta-ecourt/sipp-tautan${kueri}`));
  return { status: jawaban.status, isi: (await jawaban.json()) as Isi };
}

const AWALAN = "Alamat halaman perkara di SIPP belum dapat disusun.";

// ============================================================================
describe("kewenangan - sama dengan Status Perkara", () => {
  it("tanpa sesi: 401, bot tidak dipanggil", async () => {
    aktor = null;
    const r = await panggil("?perkaraId=888");
    expect(r.status).toBe(401);
    expect(r.isi.ok).toBe(false);
    expect(permintaan).toEqual([]);
  });

  it("pengguna tanpa kemampuan 'panel': 403, bot tidak dipanggil", async () => {
    // Pengecualian SUNGGUHAN lewat jalur yang dipakai layar akses.
    await simpanPengecualianPengguna(db as AletaDatabase, {
      actorUserId: "usr-super",
      userId: "usr-panitera",
      kapabilitas: "panel",
      aktif: false,
      alasan: "uji penjagaan tautan SIPP",
    });
    expect(
      (await kapabilitasPengguna(db as AletaDatabase, { id: "usr-panitera", roleId: "panitera", additionalRoleIds: [] })).panel
    ).toBe(false);
    aktor = "usr-panitera";
    const r = await panggil("?perkaraId=888");
    expect(r.status).toBe(403);
    expect(permintaan).toEqual([]);
  });

  it("panitera yang MASIH berkemampuan panel mendapat tautannya", async () => {
    aktor = "usr-panitera";
    const r = await panggil("?perkaraId=888");
    expect(r.status).toBe(200);
    expect(r.isi.data.alamat).not.toBe("");
  });
});

// ============================================================================
describe("alamat tersusun", () => {
  it("bentuk jawaban persis kontrak; permintaan ke bot membawa perkaraId, nomor, dan token", async () => {
    const r = await panggil(`?perkaraId=888&nomor=${encodeURIComponent("53/Pdt.G/2019/PA.Dgl")}`);
    expect(r.status).toBe(200);
    expect(Object.keys(r.isi).sort()).toEqual(["data", "ok"]);
    expect(r.isi.ok).toBe(true);
    expect(Object.keys(r.isi.data).sort()).toEqual(["alamat", "alasan"]);
    // Bawaan ALETA_SIPP_BASE_URL sama dengan alamatSipp di masuk-pejabat.ts.
    expect(r.isi.data).toEqual({ alamat: `http://192.168.10.10/SIPP/perkara_detil_agama/${SEGMEN}`, alasan: "" });

    expect(permintaan).toHaveLength(1);
    const url = new URL(permintaan[0].url);
    expect(`${url.origin}${url.pathname}`).toBe("http://bot-uji:3003/internal/aleta-bot/sipp/tautan-perkara");
    expect(Object.fromEntries(url.searchParams)).toEqual({ perkaraId: "888", nomor: "53/Pdt.G/2019/PA.Dgl" });
    expect(permintaan[0].token).toBe("token-uji");
  });

  it("nomor saja diteruskan tanpa perkaraId; spasi di tepi dibuang", async () => {
    await panggil(`?perkaraId=%20&nomor=${encodeURIComponent("  574/Pdt.G/2026/PA.Dgl ")}`);
    expect(Object.fromEntries(new URL(permintaan[0].url).searchParams)).toEqual({ nomor: "574/Pdt.G/2026/PA.Dgl" });
  });

  it("dasar dari ALETA_SIPP_BASE_URL - lokal lewat index.php", async () => {
    process.env.ALETA_SIPP_BASE_URL = "http://127.0.0.1:8056/index.php";
    const r = await panggil("?perkaraId=888");
    expect(r.isi.data.alamat).toBe(`http://127.0.0.1:8056/index.php/perkara_detil_agama/${SEGMEN}`);
  });

  it("garis miring ganda dibuang, dasar tanpa skema diberi http://, dasar kosong kembali ke bawaan", () => {
    const jalur = `perkara_detil_agama/${SEGMEN}`;
    const kasus: Array<[string | undefined, string]> = [
      ["http://192.168.10.10/SIPP/", "http://192.168.10.10/SIPP"],
      ["http://192.168.10.10/SIPP///", "http://192.168.10.10/SIPP"],
      ["http://192.168.10.10//SIPP", "http://192.168.10.10/SIPP"],
      ["https://sipp.pa-donggala.go.id/SIPP", "https://sipp.pa-donggala.go.id/SIPP"],
      ["192.168.10.10/SIPP", "http://192.168.10.10/SIPP"],
      ["   ", "http://192.168.10.10/SIPP"],
      [undefined, "http://192.168.10.10/SIPP"],
    ];
    for (const [dasar, harapan] of kasus) {
      if (dasar === undefined) delete process.env.ALETA_SIPP_BASE_URL;
      else process.env.ALETA_SIPP_BASE_URL = dasar;
      expect(susunAlamatSipp(jalur), String(dasar)).toBe(`${harapan}/${jalur}`);
      expect(susunAlamatSipp(`/${jalur}`), String(dasar)).toBe(`${harapan}/${jalur}`);
    }
  });
});

// ============================================================================
describe("tanpa alamat: alamat '' dengan kalimat untuk petugas, tetap 200", () => {
  it("perkaraId dan nomor kosong: bot tidak dipanggil", async () => {
    for (const kueri of ["", "?perkaraId=", "?perkaraId=%20&nomor=%20"]) {
      const r = await panggil(kueri);
      expect(r.status).toBe(200);
      expect(r.isi.data).toEqual({ alamat: "", alasan: `${AWALAN} Perkara belum dipilih.` });
    }
    expect(permintaan).toEqual([]);
  });

  it("perkaraId tidak sah atau nomor kepanjangan: bot tidak dipanggil", async () => {
    for (const kueri of ["?perkaraId=abc", "?perkaraId=1%20OR%201%3D1", "?perkaraId=-5", "?perkaraId=12345678901", `?nomor=${"9".repeat(101)}`]) {
      const r = await panggil(kueri);
      expect(r.status, kueri).toBe(200);
      expect(r.isi.data.alamat, kueri).toBe("");
      expect(r.isi.data.alasan.startsWith(AWALAN), kueri).toBe(true);
    }
    expect(permintaan).toEqual([]);
  });

  it("bot tak terjangkau (koneksi ditolak): alasannya menyebut sebab itu", async () => {
    jawabBot = async () => {
      throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    };
    const r = await panggil("?perkaraId=888");
    expect(r.status).toBe(200);
    expect(r.isi.data.alamat).toBe("");
    expect(r.isi.data.alasan).toBe(
      `${AWALAN} aleta_bot tidak dapat dihubungi (koneksi ditolak). Pastikan layanan aleta_bot berjalan.`
    );
  });

  it("bot versi lama tanpa rutenya (halaman 404): alamat '' dan alasannya menyebut 404", async () => {
    jawabBot = async () => new Response("<!DOCTYPE html><title>Error</title><pre>Cannot GET</pre>", { status: 404 });
    const r = await panggil("?perkaraId=888");
    expect(r.isi.data.alamat).toBe("");
    expect(r.isi.data.alasan).toContain("halaman 404");
    expect(r.isi.data.alasan).toContain("/internal/aleta-bot/sipp/tautan-perkara");
  });

  it("bot menolak dengan kalimat: kalimatnya yang sampai, bukan kodenya", async () => {
    // Kalimat kunci_tidak_terbaca bot apa adanya - tanpa jalur berkas, yang
    // hanya ditulis ke log bot (lihat sipp-tautan-bot.test.ts).
    const kalimatBot =
      "Pengaturan tautan SIPP di ALETA belum lengkap. Buka SIPP lalu cari perkaranya dari sana, " +
      "dan minta admin ALETA memeriksa pengaturan tautan SIPP (rinciannya tercatat di log aleta-bot).";
    jawabBot = async () => JSON_BOT({ ok: false, alasan: "kunci_tidak_terbaca", message: kalimatBot }, 503);
    const r = await panggil("?perkaraId=888");
    expect(r.isi.data).toEqual({ alamat: "", alasan: `${AWALAN} ${kalimatBot}` });
  });

  it("jalur dari bot yang bukan pintu masuk detil perkara TIDAK menjadi alamat", async () => {
    const peringatan = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const buruk = [
      "",
      "//situs-lain.example/perkara_detil_agama/QUJD",
      "https://situs-lain.example/x",
      "javascript:alert(1)",
      "../login",
      "perkara_detil_agama/QU/JD",
      "perkara_detil_agama/QUJD+",
      "perkara_detil_agama/",
      "main/perkara_detil_agama/QUJD",
      "perkara_detil_agama/QUJD==\nSet-Cookie: x",
    ];
    for (const jalur of buruk) {
      jawabBot = async () => JSON_BOT({ ...JAWABAN_SAH, jalur });
      const r = await panggil("?perkaraId=888");
      expect(r.isi.data.alamat, JSON.stringify(jalur)).toBe("");
      expect(r.isi.data.alasan, JSON.stringify(jalur)).toContain("tidak dikenali");
    }
    expect(peringatan).toHaveBeenCalled();
  });

  it("keempat pintu masuk SIPP diterima", async () => {
    for (const pintu of ["perkara_detil", "perkara_detil_agama", "perkara_detil_mil", "perkara_detil_tun"]) {
      jawabBot = async () => JSON_BOT({ ...JAWABAN_SAH, jalur: `${pintu}/${SEGMEN}` });
      const r = await panggil("?perkaraId=888");
      expect(r.isi.data.alamat).toBe(`http://192.168.10.10/SIPP/${pintu}/${SEGMEN}`);
    }
  });
});
