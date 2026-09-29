// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bagianSah, kunciLembar, kunciSaksiAbt, normalkanNomorPerkara, sebutanBagian } from "@/lib/bas-komentar";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { simpanLembar } from "@/server/modules/aleta-ecourt/bas-lembar";

/**
 * ============================================================================
 * KOMENTAR HAKIM ATAS BAS (KONTRAK TAHAP 6-7 BAGIAN 1)
 * ============================================================================
 *
 * Yang dijaga:
 *   - bentuk jawaban persis kontrak (medan dan jenisnya);
 *   - kewenangan: tanpa sesi 401; menulis hanya hakim/Ketua/Wakil/Admin/Super
 *     Admin; menandai selesai hanya panitera pengganti (dikenali dari POSISI
 *     juga), Admin, Super Admin, dan penulisnya;
 *   - komentar tidak menahan apa pun: lembar BAS tetap dapat disimpan
 *     sesudah dikomentari, dan tidak ada acc yang tersentuh;
 *   - alur BAS menampilkan lembar ALETA dan rekaman ABT berdampingan, dengan
 *     kunci bagian yang tidak bertabrakan, dan menyebut halangan bila ABT
 *     tidak terbaca - bukan diam.
 */

describe("aturan murni", () => {
  it("nomor dinormalkan: spasi dan titik di ujung dibuang", () => {
    expect(normalkanNomorPerkara(" 214/Pdt.G/2026/PA.Dgl. ")).toBe("214/Pdt.G/2026/PA.Dgl");
    expect(normalkanNomorPerkara("214 / Pdt.G/2026/PA.Dgl")).toBe("214/Pdt.G/2026/PA.Dgl");
  });

  it("kunci bagian tidak bertabrakan antarsumber dan terbaca orang", () => {
    expect(kunciSaksiAbt(1, 3)).toBe("saksi-1:3");
    // Letak diketahui: huruf pihak dan urutan dalam pihaknya.
    expect(kunciSaksiAbt(3, 2, { pihak: "T", ke: 1 })).toBe("saksi-t1:2");
    expect(kunciSaksiAbt(1, 3, { pihak: "P", ke: 1 })).toBe("saksi-p1:3");
    expect(sebutanBagian("saksi-t1:2")).toBe("Saksi Tergugat ke-1 (ABT), pertanyaan 2");
    expect(kunciLembar("P", 1, 3)).toBe("lembar-P1:3");
    expect(kunciLembar("T", 1, 3)).not.toBe(kunciLembar("P", 1, 3));
    expect(sebutanBagian("saksi-2:4")).toContain("Saksi ke-2");
    expect(sebutanBagian("alasan:f")).toBe("Alasan perceraian huruf f");
    expect(sebutanBagian("umum")).toBe("Umum");
  });

  it("bagian: bentuk aman saja", () => {
    for (const b of ["umum", "saksi-1:3", "lembar-T2:10", "alasan:k", "bukti.p1"]) expect(bagianSah(b)).toBe(true);
    for (const b of ["", " ", "a b", "<script>", "x".repeat(81), "saksi;1", null, 3]) expect(bagianSah(b)).toBe(false);
  });
});

// ============================================================================
// RUTE - handler sungguhan atas pg-mem berbenih, bot ditiru
// ============================================================================

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-hakim";
let jawabanBot: (operasi: string, params: Record<string, unknown>) => { ok: boolean; data?: unknown; error?: string } = () => ({
  ok: false,
  error: "bot tidak dipasang",
});

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", async (asli) => {
  const modul = await asli<typeof import("@/server/modules/aleta-sipp/aleta-sipp-datasource")>();
  return {
    ...modul,
    callAletaBotSippBridge: async (operasi: string, params: Record<string, unknown>) => jawabanBot(operasi, params),
  };
});

const d = () => db as AletaDatabase;

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, unknown>; error?: { message: string } } };

async function panggil(
  cara: "GET" | "POST" | "PATCH",
  opsi: { query?: string; badan?: unknown; alur?: boolean } = {}
): Promise<Hasil> {
  const rute = opsi.alur
    ? await import("@/app/api/aleta-ecourt/bas-komentar/alur/route")
    : await import("@/app/api/aleta-ecourt/bas-komentar/route");
  const req = new NextRequest("http://localhost/api/x" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const fungsi = (rute as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara];
  const jawaban = await fungsi(req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

const NOMOR = "214/Pdt.G/2026/PA.Dgl";

describe("rute bas-komentar (pg-mem berbenih)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-hakim";
    jawabanBot = () => ({ ok: false, error: "bot tidak dipasang" });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db?.close();
    db = null;
  });

  it("tanpa sesi: 401 untuk GET, POST, PATCH", async () => {
    aktor = null;
    expect((await panggil("GET", { query: "nomor=" + encodeURIComponent(NOMOR) })).status).toBe(401);
    expect((await panggil("POST", { badan: { nomor: NOMOR, bagian: "umum", kutipan: "", isi: "x" } })).status).toBe(401);
    expect((await panggil("PATCH", { badan: { id: "x", selesai: true } })).status).toBe(401);
  });

  it("hakim menulis; bentuk jawaban persis kontrak; GET mengembalikannya", async () => {
    const t = await panggil("POST", {
      badan: {
        nomor: NOMOR + ".",
        perkaraId: "9648",
        sidangKe: 3,
        bagian: "saksi-1:3",
        kutipan: "Saksi melihat pertengkaran tahun 2024",
        isi: "Saksi menyebut 2023, bukan 2024.",
      },
    });
    expect(t.status).toBe(200);
    const k = t.isi.data.komentar as Record<string, unknown>;
    expect(Object.keys(k).sort()).toEqual(
      [
        "bagian", "dibuatPada", "diselesaikanOleh", "diselesaikanPada", "id", "isi", "kutipan", "nomor",
        "penulis", "perkaraId", "selesai", "sidangKe",
      ].sort()
    );
    expect(k).toMatchObject({
      nomor: NOMOR,
      perkaraId: "9648",
      sidangKe: 3,
      bagian: "saksi-1:3",
      selesai: false,
      diselesaikanOleh: null,
      diselesaikanPada: null,
      penulis: { id: "usr-hakim", nama: "Hj. Nur Aisyah" },
    });
    expect(new Date(String(k.dibuatPada)).toISOString()).toBe(k.dibuatPada);

    // Dibaca lewat nomor berekor titik maupun tidak - satu kunci.
    aktor = "usr-ppg";
    const g = await panggil("GET", { query: "nomor=" + encodeURIComponent(NOMOR + ".") });
    expect(g.status).toBe(200);
    expect((g.isi.data.komentar as unknown[]).length).toBe(1);
    expect(g.isi.data.saya).toMatchObject({ id: "usr-ppg", bolehMenulis: false, bolehMenyelesaikanSemua: true });
  });

  it("perkaraId dan sidangKe boleh kosong -> null", async () => {
    const t = await panggil("POST", { badan: { nomor: NOMOR, bagian: "umum", kutipan: "", isi: "Periksa ulang." } });
    expect(t.isi.data.komentar).toMatchObject({ perkaraId: null, sidangKe: null, bagian: "umum" });
  });

  it("Ketua, Wakil, Admin, Super Admin boleh menulis; panitera pengganti, panitera, jurusita tidak", async () => {
    for (const id of ["usr-ketua", "usr-wakil", "usr-admin", "usr-super"]) {
      aktor = id;
      expect((await panggil("POST", { badan: { nomor: NOMOR, bagian: "umum", isi: "ok " + id } })).status, id).toBe(200);
    }
    for (const id of ["usr-ppg", "usr-panitera", "usr-jurusita"]) {
      aktor = id;
      expect((await panggil("POST", { badan: { nomor: NOMOR, bagian: "umum", isi: "tidak" } })).status, id).toBe(403);
    }
  });

  it("batas panjang ditolak, tidak dipotong; bagian tidak sah ditolak", async () => {
    expect((await panggil("POST", { badan: { nomor: NOMOR, bagian: "umum", kutipan: "k".repeat(501), isi: "x" } })).status).toBe(400);
    expect((await panggil("POST", { badan: { nomor: NOMOR, bagian: "umum", isi: "x".repeat(2001) } })).status).toBe(400);
    expect((await panggil("POST", { badan: { nomor: NOMOR, bagian: "a b", isi: "x" } })).status).toBe(400);
    expect((await panggil("POST", { badan: { nomor: "", bagian: "umum", isi: "x" } })).status).toBe(400);
    expect((await panggil("POST", { badan: { nomor: NOMOR, bagian: "umum", isi: "   " } })).status).toBe(400);
    // Tepat di batas lolos.
    expect((await panggil("POST", { badan: { nomor: NOMOR, bagian: "umum", kutipan: "k".repeat(500), isi: "x".repeat(2000) } })).status).toBe(200);
  });

  it("PATCH selesai: panitera pengganti (dari posisi), penulis, Admin boleh; hakim lain dan jurusita tidak", async () => {
    const buat = await panggil("POST", { badan: { nomor: NOMOR, bagian: "umum", isi: "Perbaiki." } });
    const id = (buat.isi.data.komentar as { id: string }).id;

    aktor = "usr-jurusita";
    expect((await panggil("PATCH", { badan: { id, selesai: true } })).status).toBe(403);
    aktor = "usr-ketua"; // hakim, tetapi bukan penulisnya
    expect((await panggil("PATCH", { badan: { id, selesai: true } })).status).toBe(403);

    // usr-ppg berperan "staf" dengan posisi pos-panitera-pengganti.
    aktor = "usr-ppg";
    const s = await panggil("PATCH", { badan: { id, selesai: true } });
    expect(s.status).toBe(200);
    expect(s.isi.data.komentar).toMatchObject({
      selesai: true,
      diselesaikanOleh: { id: "usr-ppg", nama: "Muhammad Taufik" },
    });
    expect(typeof (s.isi.data.komentar as { diselesaikanPada: string }).diselesaikanPada).toBe("string");

    aktor = "usr-hakim"; // penulis membuka lagi
    const b = await panggil("PATCH", { badan: { id, selesai: false } });
    expect(b.isi.data.komentar).toMatchObject({ selesai: false, diselesaikanOleh: null, diselesaikanPada: null });

    aktor = "usr-admin";
    expect((await panggil("PATCH", { badan: { id, selesai: true } })).status).toBe(200);

    expect((await panggil("PATCH", { badan: { id, selesai: "ya" } })).status).toBe(400);
    expect((await panggil("PATCH", { badan: { id: "bkm-tidak-ada", selesai: true } })).status).toBe(404);
  });

  it("komentar tidak menahan apa pun: lembar tetap tersimpan dan acc tidak tersentuh", async () => {
    const lembar = await simpanLembar(d(), "usr-ppg", {
      perkaraId: "9648",
      nomorPerkara: NOMOR,
      kode: "A1a",
      namaKumpulan: "Pertanyaan Saksi P CG",
      saksiKe: 1,
      saksi: { nama: "Saksi Satu" },
      keadaan: "draf",
      baris: [{ urutan: 1, pertanyaan: "Kenal?", jawaban: "Kenal" }],
    });
    await panggil("POST", { badan: { nomor: NOMOR, perkaraId: "9648", bagian: kunciLembar("P", 1, 1), isi: "Salah." } });

    const lagi = await simpanLembar(d(), "usr-ppg", {
      perkaraId: "9648",
      nomorPerkara: NOMOR,
      kode: "A1a",
      saksiKe: 1,
      keadaan: "selesai",
      baris: [{ urutan: 1, pertanyaan: "Kenal?", jawaban: "Kenal sejak kecil" }],
    });
    expect(lagi.id).toBe(lembar.id);
    expect(lagi.keadaan).toBe("selesai");
    expect(lagi.acc).toBe("menunggu-acc");
  });

  describe("alur BAS", () => {
    it("lembar ALETA dan rekaman ABT berdampingan, kunci berbeda, nomor dari lembar", async () => {
      await simpanLembar(d(), "usr-ppg", {
        perkaraId: "9648",
        nomorPerkara: NOMOR,
        kode: "A2a",
        namaKumpulan: "Pertanyaan Saksi T CG",
        saksiKe: 1,
        saksi: { nama: "Saksi Tergugat" },
        baris: [
          { urutan: 2, pertanyaan: "Sejak kapan?", jawaban: "2020" },
          { urutan: 1, pertanyaan: "Kenal?", jawaban: "Ya" },
        ],
      });
      const operasi: string[] = [];
      jawabanBot = (op, params) => {
        operasi.push(op + ":" + String(params.perkaraId));
        return {
          ok: true,
          data: {
            ada: true,
            saksi: [
              {
                saksiId: "17346",
                saksiKe: 1,
                sidangId: "55",
                tanyaJawab: [{ urutan: 3, penanya: "Hakim", pertanyaan: "Bertengkar?", jawaban: "Sering" }],
              },
            ],
          },
        };
      };

      const r = await panggil("GET", { alur: true, query: "perkaraId=9648" });
      expect(r.status).toBe(200);
      const alur = r.isi.data.alur as {
        nomorPerkara: string;
        saksi: Array<{ sumber: string; kunci: string; baris: Array<{ bagian: string; urutan: number }> }>;
        batas: string[];
        halangan: string[];
      };
      expect(operasi).toEqual(["case.pemeriksaanSaksi:9648"]);
      expect(alur.nomorPerkara).toBe(NOMOR);
      expect(alur.halangan).toEqual([]);
      const aleta = alur.saksi.find((s) => s.sumber === "ALETA");
      const abt = alur.saksi.find((s) => s.sumber === "ABT");
      expect(aleta?.kunci).toBe("lembar-T1");
      expect(aleta?.baris.map((b) => b.bagian)).toEqual(["lembar-T1:1", "lembar-T1:2"]);
      // Saksi ABT ke-1 tanpa pihak dari jembatan = saksi Penggugat ke-1 (letakSaksiAbt):
      // kuncinya membawa huruf pihak, bentuk yang dicocokkan panel ABT ekstensi.
      expect(abt?.baris.map((b) => b.bagian)).toEqual(["saksi-p1:3"]);
      expect(alur.batas.join(" ")).toMatch(/versi terakhir yang disimpan/);
      expect(alur.batas.join(" ")).toMatch(/tidak menahan/);
    });

    it("ABT tidak terbaca: disebut di halangan, lembar ALETA tetap tampil", async () => {
      await simpanLembar(d(), "usr-ppg", {
        perkaraId: "9648",
        nomorPerkara: NOMOR,
        kode: "A1a",
        saksiKe: 2,
        baris: [{ urutan: 1, pertanyaan: "Kenal?", jawaban: "Ya" }],
      });
      jawabanBot = () => ({ ok: false, error: "ECONNREFUSED" });
      const r = await panggil("GET", { alur: true, query: "perkaraId=9648" });
      const alur = r.isi.data.alur as { saksi: unknown[]; halangan: string[] };
      expect(alur.saksi).toHaveLength(1);
      expect(alur.halangan.join(" ")).toMatch(/abt_keterangan_saksi tidak terbaca: ECONNREFUSED/);
    });

    it("nomor yang cocok banyak perkara: daftar pilihan, kecuali satu yang persis sama", async () => {
      jawabanBot = (op) =>
        op === "case.searchByNumber"
          ? {
              ok: true,
              data: [
                { perkaraId: "1", nomorPerkara: "214/Pdt.G/2025/PA.Dgl" },
                { perkaraId: "2", nomorPerkara: "1214/Pdt.G/2026/PA.Dgl" },
              ],
            }
          : { ok: true, data: { ada: false, saksi: [] } };
      const banyak = await panggil("GET", { alur: true, query: "nomor=214" });
      expect(banyak.isi.data).toMatchObject({ ada: false, perluDipilih: true });

      jawabanBot = (op) =>
        op === "case.searchByNumber"
          ? {
              ok: true,
              data: [
                { perkaraId: "9648", nomorPerkara: NOMOR + "." },
                { perkaraId: "2", nomorPerkara: "1" + NOMOR },
              ],
            }
          : { ok: true, data: { ada: false, saksi: [] } };
      const persis = await panggil("GET", { alur: true, query: "nomor=" + encodeURIComponent(NOMOR) });
      expect(persis.isi.data.ada).toBe(true);
      expect((persis.isi.data.alur as { perkaraId: string }).perkaraId).toBe("9648");
    });

    it("tanpa sesi 401", async () => {
      aktor = null;
      expect((await panggil("GET", { alur: true, query: "perkaraId=1" })).status).toBe(401);
    });
  });
});
