// @vitest-environment node
import { execFileSync } from "node:child_process";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KATALOG_FITUR_SATKER, keadaanFitur } from "@/lib/fitur-satker";
import { ISIAN_SEKALI_DATA } from "@/lib/isian-sekali-data";
import {
  BATAS_NILAI_SEKALI,
  KODE_FITUR_ISIAN_SEKALI,
  adalahIsianSekali,
  bersihkanMasukanSekali,
  daftarKodeSekali,
  infoIsianSekali,
  kodeSekali,
  urutkanBeban,
} from "@/lib/isian-sekali";
import { KODE_FITUR_JEJAK_ISIAN } from "@/lib/jejak-isian";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { isianPerkara } from "@/server/modules/aleta-ecourt/isian-perkara";
import { catatJejakIsian } from "@/server/modules/aleta-ecourt/jejak-isian";
import { bacaIsianSekali, isianSekaliAktif, laporanBebanSekali, simpanIsianSekali } from "@/server/modules/aleta-ecourt/isian-sekali";
import { KUNCI_FITUR_SATKER } from "@/server/modules/satker/fitur";
import { tulisSetelanSistem } from "@/server/modules/satker/setelan";

/**
 * ============================================================================
 * 25 OKT 2026 - RANTAI D, BUTIR D2: TUTUP ISIAN MANUAL (U11) - ISIAN SEKALI PER PERKARA
 * ============================================================================
 *
 * Daftar isian dibangun dari DAFTAR-CEK.json (penjaga: berkas hasil bangun = berkas di repo). Penyimpanan memakai
 * aleta_isian_perkara (0035) tanpa migrasi baru. pg-mem + rute HTTP sungguhan; data rekaan. Yang dijaga:
 *   1. daftar = isian "tidak" di daftar cek, termasuk contoh U11 (prodeo 0661/0663, fasakh 0227, pidana 8536, eksepsi 9682-9685)
 *   2. aturan murni: pembersih masukan, urutan beban
 *   3. saklar bawaan MATI: tidak menulis, tidak membaca
 *   4. mengingat per perkara: baru, ubah (riwayat), sama (tanpa tulis), kosong; terpisah antar perkara; hanya isian sekali
 *   5. kata ALETA tidak diingat
 *   6. hak per peran di rute; beban hanya admin
 */

const AKAR = path.resolve(process.cwd(), "..");

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-hakim";

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => db,
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

async function nyalakan(d: AletaDatabase, kode: string[] = [KODE_FITUR_ISIAN_SEKALI]) {
  const fitur: Record<string, string> = {};
  for (const k of kode) fitur[k] = "stabil";
  await tulisSetelanSistem(d, KUNCI_FITUR_SATKER, { fitur, diubahOleh: "uji", diubahPada: new Date().toISOString() }, new Date().toISOString());
}

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, any>; error?: { message: string } } };
async function panggil(cara: "GET" | "POST", opsi: { query?: string; badan?: unknown } = {}): Promise<Hasil> {
  const modul = await import("@/app/api/aleta-ecourt/isian-sekali/route");
  const req = new NextRequest("http://localhost/api/aleta-ecourt/isian-sekali" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const jawaban = await (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara](req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

const masukan = (tambah: Record<string, unknown> = {}) => ({ perkaraId: "10018", nomorPerkara: "533/Pdt.G/2026/PA.Dgl", kode: "0661", nilai: "12/Pdt.G/2026/PA.Dgl", ...tambah });

// ─── 1. Daftar ───────────────────────────────────────────────────────────────

describe("daftar isian sekali per perkara", () => {
  it("penjaga: isian-sekali-data.ts sama dengan hasil bangun dari DAFTAR-CEK.json (jalankan skrip bila daftar cek diperbarui)", () => {
    expect(() => execFileSync(process.execPath, [path.join(AKAR, "scripts", "isi-sipp-abt", "bangun-isian-sekali.cjs"), "--periksa"], { stdio: "pipe" })).not.toThrow();
  });

  it("memuat contoh U11 dan hanya isian teks/tanggal tanpa pengisi; kode unik; urut beban", () => {
    for (const k of ["0661", "0663", "0227", "8536", "9682", "9683", "9684", "9685"]) expect(adalahIsianSekali(k), k).toBe(true);
    expect(infoIsianSekali("0663")).toMatchObject({ jenis: "tanggal", keadaan: "prodeo", tanpaSumber: true });
    expect(infoIsianSekali("661")).toMatchObject({ kode: "0661", jenis: "teks" });
    const kode = daftarKodeSekali();
    expect(new Set(kode).size).toBe(kode.length);
    expect(kode.length).toBeGreaterThan(100);
    // sudah punya pengisi otomatis -> bukan isian sekali (nama pihak, tanggal KTP)
    for (const k of ["0046", "0364", "8503", "5197"]) expect(adalahIsianSekali(k), k).toBe(false);
    const beban = ISIAN_SEKALI_DATA.map((i) => i.beban);
    expect([...beban].sort((a, b) => b - a)).toEqual(beban);
  });

  it("saklar katalog Fitur Satker: kode isian-sekali, bawaan MATI", () => {
    expect(KATALOG_FITUR_SATKER.find((f) => f.kode === KODE_FITUR_ISIAN_SEKALI)).toMatchObject({ bawaan: "mati", bagian: "portal" });
    expect(keadaanFitur(KODE_FITUR_ISIAN_SEKALI, {})).toMatchObject({ menyala: false, status: "mati" });
  });
});

// ─── 2. Aturan murni ─────────────────────────────────────────────────────────

describe("aturan murni isian sekali", () => {
  it("kode dirapikan menjadi 4 angka; selain angka dibiarkan", () => {
    expect(kodeSekali("661")).toBe("0661");
    expect(kodeSekali(" 0661 ")).toBe("0661");
    expect(kodeSekali("x-1")).toBe("x-1");
  });

  it("pembersih masukan: kode di luar daftar, perkara kosong, terlalu panjang, tanda sistem ditolak", () => {
    expect(bersihkanMasukanSekali(masukan({ kode: "661" }))).toEqual({ perkaraId: "10018", nomorPerkara: "533/Pdt.G/2026/PA.Dgl", kode: "0661", nilai: "12/Pdt.G/2026/PA.Dgl" });
    expect(bersihkanMasukanSekali(masukan({ kode: "0046" }))).toMatchObject({ ditolak: true });
    expect(bersihkanMasukanSekali(masukan({ perkaraId: "" }))).toMatchObject({ ditolak: true });
    expect(bersihkanMasukanSekali(masukan({ nilai: "x".repeat(BATAS_NILAI_SEKALI + 1), kode: "8536" }))).toMatchObject({ ditolak: true });
    expect(bersihkanMasukanSekali(masukan({ kode: "0663", nilai: "x".repeat(61) }))).toMatchObject({ ditolak: true }); // tanggal pendek
    for (const kata of ["dibuat oleh Aleta", "A L E T A", "a.l.e.t.a"]) expect(bersihkanMasukanSekali(masukan({ nilai: kata })), kata).toMatchObject({ ditolak: true });
    expect(bersihkanMasukanSekali(null)).toMatchObject({ ditolak: true });
    expect(bersihkanMasukanSekali(masukan({ nilai: "  nilai  \r\nbaris dua " }))).toMatchObject({ nilai: "nilai  \nbaris dua" });
  });

  it("urutan beban: ketikan hidup terbanyak dahulu, lalu beban daftar cek, lalu jumlah blangko", () => {
    const u = urutkanBeban({ "0227": 50, "0661": 7 }, { "0661": 2 });
    expect(u[0]).toMatchObject({ kode: "0227", diketikHidup: 50 });
    expect(u[1]).toMatchObject({ kode: "0661", diketikHidup: 7, diingat: 2 });
    // tanpa data hidup: urutan mengikuti BEBAN-MANUAL.json (8132 dengan 30 perkara paling atas)
    expect(urutkanBeban({}, {})[0]).toMatchObject({ kode: "8132", bebanDaftar: 30, diketikHidup: 0 });
    expect(urutkanBeban({}, {})).toHaveLength(ISIAN_SEKALI_DATA.length);
  });
});

// ─── 3-5. Penyimpanan ────────────────────────────────────────────────────────

describe("penyimpanan isian sekali (pg-mem)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-hakim";
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("saklar mati (bawaan): tidak menulis dan tidak membaca", async () => {
    expect(await isianSekaliAktif(db!)).toBe(false);
    expect(await simpanIsianSekali(db!, { id: "usr-hakim", nama: "Hakim" }, masukan())).toEqual({ aktif: false, disimpan: false, sebab: "" });
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_perkara`)).toEqual([]);
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_riwayat`)).toEqual([]);
    // walau baris ada, saklar mati tidak mengembalikan apa pun
    await nyalakan(db!);
    await simpanIsianSekali(db!, { id: "usr-hakim", nama: "Hakim" }, masukan());
    await nyalakan(db!, []);
    expect(await bacaIsianSekali(db!, "10018")).toEqual([]);
  });

  it("menyimpan, mengubah (riwayat), nilai sama tanpa tulis, mengosongkan; terpisah antar perkara", async () => {
    await nyalakan(db!);
    const h = { id: "usr-hakim", nama: "Hakim Satu" };
    expect(await simpanIsianSekali(db!, h, masukan())).toEqual({ aktif: true, disimpan: true, sebab: "" });
    expect(await bacaIsianSekali(db!, "10018")).toEqual([expect.objectContaining({ kode: "0661", nilai: "12/Pdt.G/2026/PA.Dgl", diisiOleh: "Hakim Satu" })]);
    // perkara lain tidak melihatnya
    expect(await bacaIsianSekali(db!, "10019")).toEqual([]);

    // nilai sama: tidak ada tulisan baru
    expect(await simpanIsianSekali(db!, h, masukan())).toMatchObject({ aktif: true, disimpan: false, sebab: "Sudah sama." });
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_riwayat`)).toHaveLength(1);

    // ubah: satu baris tetap, riwayat bertambah
    expect(await simpanIsianSekali(db!, { id: "usr-panitera", nama: "Panitera" }, masukan({ nilai: "13/Pdt.G/2026/PA.Dgl" }))).toMatchObject({ disimpan: true });
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_perkara`)).toHaveLength(1);
    const riwayat = await db!.queryAll<Record<string, unknown>>(`SELECT nilai_lama, nilai_baru, oleh FROM aleta_isian_riwayat ORDER BY pada ASC`);
    expect(riwayat).toHaveLength(2);
    expect(riwayat[1]).toMatchObject({ nilai_lama: "12/Pdt.G/2026/PA.Dgl", nilai_baru: "13/Pdt.G/2026/PA.Dgl", oleh: "Panitera" });
    expect((await bacaIsianSekali(db!, "10018"))[0]).toMatchObject({ nilai: "13/Pdt.G/2026/PA.Dgl", diisiOleh: "Hakim Satu" });

    // dikosongkan petugas: saran lama tidak muncul lagi
    expect(await simpanIsianSekali(db!, h, masukan({ nilai: "" }))).toMatchObject({ disimpan: true });
    expect(await bacaIsianSekali(db!, "10018")).toEqual([]);
    // kosong dan belum pernah diingat: tidak ada baris baru
    expect(await simpanIsianSekali(db!, h, masukan({ perkaraId: "10077", nilai: "" }))).toMatchObject({ disimpan: false });
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_perkara WHERE perkara_id = '10077'`)).toEqual([]);
  });

  it("hanya isian sekali yang diingat dan dibaca; baris lain di tabel yang sama (kelas B) tidak ikut terbaca", async () => {
    await nyalakan(db!);
    expect(await simpanIsianSekali(db!, { id: "usr-hakim", nama: "H" }, masukan({ kode: "0046" }))).toMatchObject({ disimpan: false, sebab: "Bukan isian sekali per perkara." });
    await db!.run(`INSERT INTO aleta_isian_perkara (id, perkara_id, no_var, nilai, diisi_oleh, diisi_at, diubah_oleh, diubah_at) VALUES ('x', '10018', '0046', 'Nama Rekaan', 'u', 't', 'u', 't')`);
    await simpanIsianSekali(db!, { id: "usr-hakim", nama: "H" }, masukan());
    expect((await bacaIsianSekali(db!, "10018")).map((i) => i.kode)).toEqual(["0661"]);
    // peta isian perkara yang dipakai blangko ALETA ikut memuat nilai ini (satu sumber untuk semua blangko perkara itu)
    expect(await isianPerkara(db!, "10018")).toMatchObject({ "0661": "12/Pdt.G/2026/PA.Dgl" });
  });

  it("kata ALETA tidak diingat", async () => {
    await nyalakan(db!);
    expect(await simpanIsianSekali(db!, { id: "usr-hakim", nama: "H" }, masukan({ nilai: "ditulis ALETA" }))).toMatchObject({ disimpan: false });
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_perkara`)).toEqual([]);
  });

  it("aktor tanpa nama dan tanpa id ditolak", async () => {
    await nyalakan(db!);
    expect(await simpanIsianSekali(db!, { id: "", nama: "" }, masukan())).toMatchObject({ aktif: true, disimpan: false });
  });

  it("beban: ketikan hidup dari jejak (cara diketik) dan perkara yang diingat per isian", async () => {
    await nyalakan(db!, [KODE_FITUR_ISIAN_SEKALI, KODE_FITUR_JEJAK_ISIAN]);
    const jejak = (kode: string, id: string, cara = "diketik") => ({
      perkaraId: id, nomorPerkara: "533/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", blangko: "b", kode, nilaiUsulan: "", nilaiSebelum: "", nilaiFinal: `isi ${id}`, cara, jalur: "blangko-derry", pada: "2026-10-20T03:00:00.000Z",
    });
    await catatJejakIsian(db!, { id: "usr-hakim" }, [jejak("0661", "p1"), jejak("0661", "p2"), jejak("0661", "p3", "saran-diterima"), jejak("0227", "p1"), jejak("0046", "p1")]);
    await simpanIsianSekali(db!, { id: "usr-hakim", nama: "H" }, masukan({ perkaraId: "p1" }));
    await simpanIsianSekali(db!, { id: "usr-hakim", nama: "H" }, masukan({ perkaraId: "p2" }));
    await simpanIsianSekali(db!, { id: "usr-hakim", nama: "H" }, masukan({ perkaraId: "p3", nilai: "" }));
    const l = await laporanBebanSekali(db!);
    expect(l).toMatchObject({ aktif: true, jejakMenyala: true, jumlahKode: ISIAN_SEKALI_DATA.length, diingatTotal: 2 });
    expect(l.baris[0]).toMatchObject({ kode: "0661", diketikHidup: 2, diingat: 2 });
    expect(l.baris[1]).toMatchObject({ kode: "0227", diketikHidup: 1 });
    // 0046 bukan isian sekali: tidak muncul
    expect(l.baris.find((b) => b.kode === "0046")).toBeUndefined();
    await nyalakan(db!, []);
    expect(await laporanBebanSekali(db!)).toMatchObject({ aktif: false, baris: [] });
  });
});

// ─── 6. Rute ─────────────────────────────────────────────────────────────────

describe("rute isian-sekali", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-hakim";
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("saklar mati: saklar -> aktif:false tanpa daftar kode; POST tidak menulis; GET perkara kosong", async () => {
    expect((await panggil("GET", { query: "bagian=saklar" })).isi.data).toEqual({ aktif: false, kode: [] });
    expect((await panggil("POST", { badan: masukan() })).isi.data).toMatchObject({ aktif: false, disimpan: false });
    expect((await panggil("GET", { query: "perkaraId=10018" })).isi.data).toEqual({ aktif: false, isian: [] });
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_perkara`)).toEqual([]);
  });

  it("saklar menyala: saklar memberi daftar kode; POST mengingat; GET perkara mengembalikan", async () => {
    await nyalakan(db!);
    const s = await panggil("GET", { query: "bagian=saklar" });
    expect(s.isi.data.aktif).toBe(true);
    expect(s.isi.data.kode).toContain("0661");
    expect(s.isi.data.kode).not.toContain("0046");
    const p = await panggil("POST", { badan: masukan() });
    expect(p.isi.data).toMatchObject({ aktif: true, disimpan: true });
    const g = await panggil("GET", { query: "perkaraId=10018" });
    expect(g.isi.data).toMatchObject({ aktif: true, isian: [expect.objectContaining({ kode: "0661", nilai: "12/Pdt.G/2026/PA.Dgl", diisiOleh: expect.any(String) })] });
    expect((await panggil("POST", { badan: masukan({ kode: "0046" }) })).isi.data).toMatchObject({ disimpan: false });
  });

  it("hak per peran: tanpa 'blangko-abt' ditolak 403; beban hanya Super Admin/Admin; saklar boleh ditanya siapa pun yang masuk; tanpa masuk 401", async () => {
    await nyalakan(db!);
    aktor = "usr-bendahara";
    expect((await panggil("POST", { badan: masukan() })).status).toBe(403);
    expect((await panggil("GET", { query: "perkaraId=10018" })).status).toBe(403);
    expect((await panggil("GET", { query: "bagian=beban" })).status).toBe(403);
    expect((await panggil("GET", { query: "bagian=saklar" })).status).toBe(200);
    aktor = "usr-hakim";
    expect((await panggil("POST", { badan: masukan() })).status).toBe(200);
    expect((await panggil("GET", { query: "perkaraId=10018" })).status).toBe(200);
    expect((await panggil("GET", { query: "bagian=beban" })).status).toBe(403);
    aktor = "usr-admin";
    const b = await panggil("GET", { query: "bagian=beban" });
    expect(b.status).toBe(200);
    expect(b.isi.data).toMatchObject({ aktif: true, jumlahKode: ISIAN_SEKALI_DATA.length });
    aktor = null;
    expect((await panggil("POST", { badan: masukan() })).status).toBe(401);
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_perkara`)).toHaveLength(1);
  });
});
