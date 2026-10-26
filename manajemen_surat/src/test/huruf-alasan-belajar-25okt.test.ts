// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KATALOG_FITUR_SATKER, keadaanFitur } from "@/lib/fitur-satker";
import {
  KODE_FITUR_HURUF_BELAJAR,
  MIN_HAKIM,
  MIN_POLA,
  RASIO_HAKIM,
  RASIO_POLA,
  TANDA_PERLU_VERIFIKASI,
  bentukBarisHuruf,
  himpunanHuruf,
  ringkasPerPola,
  statistikPola,
  susunBelajar,
  susunDasarHukum,
  type BarisHuruf,
} from "@/lib/huruf-alasan-belajar";
import { KODE_FITUR_JEJAK_ISIAN } from "@/lib/jejak-isian";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { bacaBelajar, bacaBarisHuruf, hurufBelajarAktif, ringkasHurufBelajar } from "@/server/modules/aleta-ecourt/huruf-alasan-belajar";
import { catatJejakIsian } from "@/server/modules/aleta-ecourt/jejak-isian";
import { KUNCI_FITUR_SATKER } from "@/server/modules/satker/fitur";
import { tulisSetelanSistem } from "@/server/modules/satker/setelan";

/**
 * ============================================================================
 * 25 OKT 2026 - RANTAI D, BUTIR D4: HURUF ALASAN YANG BELAJAR DARI HAKIM (U14)
 * ============================================================================
 *
 * pg-mem + rute HTTP sungguhan; data rekaan. Yang dijaga:
 *   1. saklar bawaan MATI (katalog Fitur Satker); tanpa migrasi baru
 *   2. aturan murni: huruf dibaca seperti ABT, kecocokan per pola, pertimbangan hakim/majelis/pola dengan ambang tertulis
 *   3. TETAP USULAN: keluaran hanya kalimat + huruf; kebiasaan hakim hanya untuk hakim itu, majelis lain TANPA nama
 *   4. dasar hukum per huruf dari pustaka pertimbangan; [PERLU VERIFIKASI] bila belum disahkan atau belum terbukti
 *   5. saklar mati: tidak ada pertimbangan, tidak ada dasar hukum
 *   6. hak per peran di rute; ringkasan Admin tanpa nama hakim
 */

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-hakim";

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => db,
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

async function nyalakan(d: AletaDatabase, kode: string[] = [KODE_FITUR_HURUF_BELAJAR, KODE_FITUR_JEJAK_ISIAN]) {
  const fitur: Record<string, string> = {};
  for (const k of kode) fitur[k] = "stabil";
  await tulisSetelanSistem(d, KUNCI_FITUR_SATKER, { fitur, diubahOleh: "uji", diubahPada: new Date().toISOString() }, new Date().toISOString());
}

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, any>; error?: { message: string } } };
async function panggil(cara: "GET" | "POST", opsi: { query?: string; badan?: unknown } = {}): Promise<Hasil> {
  const modul = await import("@/app/api/aleta-ecourt/huruf-alasan/route");
  const req = new NextRequest("http://localhost/api/aleta-ecourt/huruf-alasan" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const jawaban = await (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara](req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

// ─── bahan murni ─────────────────────────────────────────────────────────────

const baris = (n: number, tambah: Partial<BarisHuruf>): BarisHuruf[] =>
  Array.from({ length: n }, (_, i) => ({ jenis: "347", usulan: "F", akhir: "F", oleh: "h1", olehNama: "Hakim Satu, S.H.", pada: `2026-10-${String(10 + (i % 15)).padStart(2, "0")}T01:00:00.000Z`, ...tambah }));

describe("saklar dan huruf", () => {
  it("saklar katalog Fitur Satker: kode huruf-alasan-belajar, bawaan MATI; ambang tertulis", () => {
    expect(KATALOG_FITUR_SATKER.find((f) => f.kode === KODE_FITUR_HURUF_BELAJAR)).toMatchObject({ bawaan: "mati", bagian: "portal" });
    expect(keadaanFitur(KODE_FITUR_HURUF_BELAJAR, {})).toMatchObject({ menyala: false, status: "mati" });
    expect([MIN_POLA, RASIO_POLA, MIN_HAKIM, RASIO_HAKIM]).toEqual([10, 0.6, 5, 0.6]);
  });

  it("huruf dibaca seperti ABT: pilihan 'F · uraian', 'F dan B', 'Murtad', teks bebas tidak dikenal", () => {
    expect(himpunanHuruf("F")).toBe("F");
    expect(himpunanHuruf("F · perselisihan terus-menerus")).toBe("F");
    expect(himpunanHuruf("F dan B")).toBe("BF");
    expect(himpunanHuruf("bf")).toBe("BF");
    expect(himpunanHuruf("Murtad")).toBe("H");
    expect(himpunanHuruf("huruf F")).toBe("");
    expect(himpunanHuruf("")).toBe("");
    expect(bentukBarisHuruf({ jenis_perkara: "Cerai Gugat", nilai_usulan: "F · x", nilai_final: "BF", pengguna_id: "h1", pengguna_nama: "H", pada: "2026-10-20" })).toMatchObject({ jenis: "347", usulan: "F", akhir: "BF" });
    expect(bentukBarisHuruf({ nilai_final: "teks bebas" })).toBeNull();
  });
});

describe("aturan murni: kecocokan per pola dan pertimbangan", () => {
  it("kecocokan per pola: usulan mesin F -> berapa persen berakhir F, dan sebaran huruf akhirnya", () => {
    const b = [...baris(6, {}), ...baris(3, { akhir: "BF" }), ...baris(1, { akhir: "ABF" }), ...baris(4, { usulan: "B", akhir: "B" })];
    const p = statistikPola(b, "347", "F");
    expect(p).toMatchObject({ n: 10, cocok: 6, persenCocok: 60 });
    expect(p.sebaran).toEqual([
      { huruf: "F", n: 6, persen: 60 },
      { huruf: "BF", n: 3, persen: 30 },
      { huruf: "ABF", n: 1, persen: 10 },
    ]);
    expect(statistikPola(b, "347", "").n).toBe(0); // tanpa usulan mesin tidak ada pola
    expect(statistikPola(b, "346", "F").persenCocok).toBeNull(); // jenis lain
    expect(ringkasPerPola(b).map((x) => [x.jenis, x.usulan, x.n])).toEqual([["347", "F", 10], ["347", "B", 4]]);
  });

  it("pola: majelis akhirnya memilih huruf lain pada >= 60% dari >= 10 perkara -> pertimbangan dan usulan-beda; kurang dari 10 tidak", () => {
    const banyak = [...baris(7, { akhir: "BF", oleh: "h2", olehNama: "Hakim Dua, M.H." }), ...baris(3, {})];
    const h = susunBelajar({ baris: banyak, jenis: "347", hurufMesin: "F", hakimId: "hx", majelis: [] });
    expect(h.pertimbangan).toEqual([expect.objectContaining({ sumber: "pola", huruf: "BF", n: 7, dari: 10, persen: 70, sejalan: false })]);
    expect(h.pertimbangan[0].kalimat).toContain("majelis akhirnya memilih huruf BF pada 7 perkara (70%)");
    expect(h.usulanBeda).toMatchObject({ huruf: "BF", sumber: "pola" });
    // 9 perkara saja: belum cukup
    expect(susunBelajar({ baris: banyak.slice(0, 9), jenis: "347", hurufMesin: "F", hakimId: "hx", majelis: [] }).pertimbangan).toEqual([]);
    // 59%: tidak ada puncak yang cukup
    const sebaran = [...baris(6, { akhir: "BF" }), ...baris(4, {})];
    expect(susunBelajar({ baris: sebaran, jenis: "347", hurufMesin: "F", hakimId: "hx", majelis: [] }).pertimbangan[0]).toMatchObject({ n: 6, persen: 60 }); // tepat 60% termasuk
    expect(susunBelajar({ baris: [...baris(5, { akhir: "BF" }), ...baris(5, {})], jenis: "347", hurufMesin: "F", hakimId: "hx", majelis: [] }).pertimbangan).toEqual([]);
  });

  it("pola sejalan: majelis biasanya memilih huruf yang sama dengan mesin -> pertimbangan sejalan, tanpa usulan-beda", () => {
    const h = susunBelajar({ baris: baris(10, {}), jenis: "347", hurufMesin: "F", hakimId: "hx", majelis: [] });
    expect(h.pertimbangan).toEqual([expect.objectContaining({ sumber: "pola", huruf: "F", sejalan: true })]);
    expect(h.usulanBeda).toBeNull();
  });

  it("hakim: kebiasaan SENDIRI pada jenis yang sama (>= 5, >= 60%); hakim lain tidak terhitung; tidak ada untuk hakim yang belum punya riwayat", () => {
    const b = [...baris(6, { akhir: "BF", oleh: "h1" }), ...baris(1, { akhir: "F", oleh: "h1" }), ...baris(20, { akhir: "F", oleh: "h2", olehNama: "Hakim Dua, M.H." })];
    const h = susunBelajar({ baris: b, jenis: "347", hurufMesin: "F", hakimId: "h1", majelis: [] });
    const hk = h.pertimbangan.find((p) => p.sumber === "hakim")!;
    expect(hk).toMatchObject({ huruf: "BF", n: 6, dari: 7, sejalan: false });
    expect(hk.kalimat).toContain("Anda memilih huruf BF pada 6 dari 7 perkara");
    expect(h.usulanBeda).toMatchObject({ huruf: "BF", sumber: "hakim" }); // hakim didahulukan atas pola
    expect(susunBelajar({ baris: b, jenis: "347", hurufMesin: "F", hakimId: "hz", majelis: [] }).pertimbangan.find((p) => p.sumber === "hakim")).toBeUndefined();
    // jenis perkara lain: riwayat tidak dipakai
    expect(susunBelajar({ baris: b, jenis: "346", hurufMesin: "F", hakimId: "h1", majelis: [] }).pertimbangan).toEqual([]);
  });

  it("majelis: anggota lain dikenali dari teks susunan majelis; kalimat TANPA nama", () => {
    const b = baris(6, { akhir: "B", oleh: "h2", olehNama: "Hakim Dua, M.H." });
    const h = susunBelajar({ baris: b, jenis: "347", hurufMesin: "F", hakimId: "h1", majelis: ["Hakim Satu, S.H., Hakim Dua, M.H., Hakim Tiga, S.H.I."] });
    const m = h.pertimbangan.find((p) => p.sumber === "majelis")!;
    expect(m).toMatchObject({ huruf: "B", n: 6, dari: 6 });
    expect(m.kalimat).toContain("Anggota majelis lain memilih huruf B");
    expect(m.kalimat).not.toMatch(/Hakim Dua/);
    // bukan anggota majelis perkara ini -> tidak dihitung
    expect(susunBelajar({ baris: b, jenis: "347", hurufMesin: "F", hakimId: "h1", majelis: ["Hakim Lain, S.H."] }).pertimbangan.find((p) => p.sumber === "majelis")).toBeUndefined();
    // nama pendek (< 4 huruf) tidak dipakai mencocokkan
    expect(susunBelajar({ baris: baris(6, { akhir: "B", oleh: "h3", olehNama: "Ab" }), jenis: "347", hurufMesin: "F", hakimId: "h1", majelis: ["Ab Cd"] }).pertimbangan).toEqual([]);
  });

  it("tanpa usulan mesin: hanya kebiasaan hakim (semua usulan) yang berbicara; pola kosong", () => {
    const h = susunBelajar({ baris: baris(8, { akhir: "BF", usulan: "", oleh: "h1" }), jenis: "347", hurufMesin: "", hakimId: "h1", majelis: [] });
    expect(h.pola.n).toBe(0);
    expect(h.pertimbangan).toEqual([expect.objectContaining({ sumber: "hakim", huruf: "BF", dari: 8 })]);
    expect(h.pertimbangan[0].kalimat).toContain("sebelumnya");
  });
});

describe("dasar hukum per huruf", () => {
  const rujukan = (tertulis: string, huruf: string, terbukti: boolean) => ({ tertulis, pasal: "116", ayat: "", huruf, peraturan: "KHI", terbukti });

  it("rujukan dari butir yang DISAHKAN dan TERBUKTI lolos tanpa tanda; selainnya bertanda [PERLU VERIFIKASI]", () => {
    const d = susunDasarHukum("F", [
      { id: "b1", keadaan: "disahkan", jumlahPemakaian: 30, rujukan: [rujukan("Pasal 116 huruf f Kompilasi Hukum Islam", "f", true), rujukan("Pasal 19 huruf f PP 9 Tahun 1975", "f", false)] },
      { id: "b2", keadaan: "usulan", jumlahPemakaian: 80, rujukan: [rujukan("Pasal 116 huruf f Kompilasi Hukum Islam", "f", true)] },
      { id: "b3", keadaan: "disahkan", jumlahPemakaian: 5, rujukan: [{ tertulis: "", pasal: "39", ayat: "2", huruf: "", peraturan: "UU 1 Tahun 1974", terbukti: true }] },
    ]);
    // KHI 116: dirujuk dua butir, salah satunya masih usulan -> bertanda; PP 19: tidak terbukti -> bertanda; UU 39: aman
    expect(d.map((x) => x.teks)).toEqual([
      `Pasal 116 huruf f Kompilasi Hukum Islam ${TANDA_PERLU_VERIFIKASI}`,
      `Pasal 19 huruf f PP 9 Tahun 1975 ${TANDA_PERLU_VERIFIKASI}`,
      "Pasal 39 ayat (2) UU 1 Tahun 1974",
    ]);
    expect(d[0]).toMatchObject({ perluVerifikasi: true, butir: 2, pemakaian: 110 });
    expect(d[2]).toMatchObject({ perluVerifikasi: false, butir: 1 });
  });

  it("rujukan yang menunjuk huruf yang sama didahulukan; maksimal 3; kosong bila tidak ada butir", () => {
    const butir = [{ id: "b1", keadaan: "disahkan", jumlahPemakaian: 1, rujukan: [rujukan("Pasal 1 A", "", true), rujukan("Pasal 2 B", "", true), rujukan("Pasal 3 C", "", true), rujukan("Pasal 116 huruf f KHI", "f", true)] }];
    const d = susunDasarHukum("F", butir);
    expect(d).toHaveLength(3);
    expect(d[0].teks).toBe("Pasal 116 huruf f KHI");
    expect(susunDasarHukum("F", [])).toEqual([]);
  });
});

// ─── penyimpanan ─────────────────────────────────────────────────────────────

const jejak8503 = (perkaraId: string, usulan: string, akhir: string, tambah: Record<string, unknown> = {}) => ({
  perkaraId, nomorPerkara: `${perkaraId}/Pdt.G/2026/PA.Dgl`, jenisPerkara: "Cerai Gugat", blangko: "b", kode: "8503", namaVariabel: "ALASAN PERCERAIAN", nilaiUsulan: usulan, asalUsulan: "isi-sipp", nilaiSebelum: "", nilaiFinal: akhir, cara: usulan ? (usulan === akhir ? "saran-diterima" : "diubah") : "diketik", jalur: "blangko-derry", pada: "2026-10-20T03:00:00.000Z", ...tambah,
});

async function isiPustaka(d: AletaDatabase) {
  const kini = "2026-10-01T00:00:00.000Z";
  const butir = async (id: string, keadaan: string, pemakaian: number, label: string) =>
    d.run(`INSERT INTO aleta_pertimbangan_butir (id, sidik, teks, keadaan, jumlah_pemakaian, label_alasan, dibuat_at, diubah_at) VALUES (?, ?, 'teks', ?, ?, ?, ?, ?)`, [id, id, keadaan, pemakaian, label, kini, kini]);
  const ruj = async (id: string, butirId: string, tertulis: string, huruf: string, terbukti: number) =>
    d.run(`INSERT INTO aleta_pertimbangan_rujukan (id, butir_id, tertulis, pasal, huruf, peraturan, terbukti) VALUES (?, ?, ?, '116', ?, 'KHI', ?)`, [id, butirId, tertulis, huruf, terbukti]);
  await butir("b1", "disahkan", 40, '["F"]');
  await butir("b2", "usulan", 10, '["F","B"]');
  await butir("b3", "ditolak", 99, '["F"]'); // ditolak: tidak dipakai
  await butir("b4", "disahkan", 5, '["A"]'); // huruf lain
  await ruj("r1", "b1", "Pasal 116 huruf f Kompilasi Hukum Islam", "f", 1);
  await ruj("r2", "b2", "Pasal 19 huruf f PP 9 Tahun 1975", "f", 0);
  await ruj("r3", "b3", "Pasal 999 yang ditolak", "f", 1);
  await ruj("r4", "b4", "Pasal 116 huruf a Kompilasi Hukum Islam", "a", 1);
}

describe("penyimpanan (pg-mem)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-hakim";
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("saklar mati (bawaan): tidak ada pertimbangan dan tidak ada dasar hukum", async () => {
    expect(await hurufBelajarAktif(db!)).toBe(false);
    await isiPustaka(db!);
    expect(await bacaBelajar(db!, { hakimId: "usr-hakim", jenisPerkara: "Cerai Gugat", hurufMesin: "F", majelis: [] })).toEqual({ aktif: false, belajar: null, dasarHukum: [] });
    expect(await ringkasHurufBelajar(db!)).toEqual({ aktif: false, jumlah: 0, perPola: [] });
  });

  it("belajar dari jejak: pola, kebiasaan hakim sendiri, majelis tanpa nama, dan dasar hukum dari pustaka; yang diurungkan tidak dihitung", async () => {
    await nyalakan(db!);
    await isiPustaka(db!);
    // 10 perkara: mesin mengusulkan F; hakim usr-hakim 6x memilih BF dan 1x F; usr-admin 3x F. Satu catatan diurungkan.
    const entri = [
      ...Array.from({ length: 6 }, (_, i) => jejak8503(`a${i}`, "F", "BF")),
      jejak8503("a6", "F", "F"),
      ...Array.from({ length: 3 }, (_, i) => jejak8503(`b${i}`, "F · perselisihan", "F")),
    ];
    await catatJejakIsian(db!, { id: "usr-hakim", nama: "Hakim Satu, S.H." }, entri.slice(0, 7));
    await catatJejakIsian(db!, { id: "usr-admin", nama: "Admin Dua, M.H." }, entri.slice(7));
    await catatJejakIsian(db!, { id: "usr-hakim", nama: "Hakim Satu, S.H." }, [jejak8503("u1", "F", "A", { cara: "diurungkan" })]);
    const b = await bacaBarisHuruf(db!);
    expect(b).toHaveLength(10);

    const j = await bacaBelajar(db!, { hakimId: "usr-hakim", jenisPerkara: "Cerai Gugat", hurufMesin: "F · uraian", majelis: ["Hakim Satu, S.H., Admin Dua, M.H."] });
    expect(j.aktif).toBe(true);
    expect(j.belajar!.hurufMesin).toBe("F");
    expect(j.belajar!.pola).toMatchObject({ n: 10, cocok: 4, persenCocok: 40 });
    const sumber = j.belajar!.pertimbangan.map((p) => p.sumber);
    expect(sumber).toContain("hakim");
    expect(j.belajar!.pertimbangan.find((p) => p.sumber === "hakim")).toMatchObject({ huruf: "BF", n: 6, dari: 7 });
    expect(j.belajar!.usulanBeda).toMatchObject({ huruf: "BF", sumber: "hakim" });
    // dasar hukum: huruf F (mesin) dan B + F (usulan beda); butir ditolak tidak dipakai; yang belum disahkan bertanda
    const dasarF = j.dasarHukum.find((d) => d.huruf === "F")!.daftar.map((x) => x.teks);
    expect([...dasarF].sort()).toEqual(["Pasal 116 huruf f Kompilasi Hukum Islam", `Pasal 19 huruf f PP 9 Tahun 1975 ${TANDA_PERLU_VERIFIKASI}`].sort());
    expect(dasarF.join()).not.toContain("999");
    expect(j.dasarHukum.some((d) => d.huruf === "A")).toBe(false);

    // hakim lain (usr-admin) hanya melihat kebiasaan SENDIRI (3 perkara = di bawah ambang), bukan milik usr-hakim
    const k = await bacaBelajar(db!, { hakimId: "usr-admin", jenisPerkara: "Cerai Gugat", hurufMesin: "F", majelis: [] });
    expect(k.belajar!.pertimbangan.find((p) => p.sumber === "hakim")).toBeUndefined();
    // tidak ada nama hakim di keluaran
    expect(JSON.stringify(j)).not.toMatch(/Hakim Satu|Admin Dua/);
  });

  it("ringkasan Admin: kecocokan per pola tanpa nama hakim", async () => {
    await nyalakan(db!);
    await catatJejakIsian(db!, { id: "usr-hakim", nama: "Hakim Satu, S.H." }, [jejak8503("a1", "F", "F"), jejak8503("a2", "F", "BF"), jejak8503("a3", "B", "B")]);
    const r = await ringkasHurufBelajar(db!);
    expect(r).toMatchObject({ aktif: true, jumlah: 3 });
    expect(r.perPola.map((p) => [p.usulan, p.n, p.persenCocok])).toEqual([["F", 2, 50], ["B", 1, 100]]);
    expect(JSON.stringify(r)).not.toMatch(/Hakim Satu|usr-hakim/);
  });
});

// ─── rute ────────────────────────────────────────────────────────────────────

describe("rute huruf-alasan", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-hakim";
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("saklar mati: saklar -> aktif:false; POST kosong; ringkasan kosong", async () => {
    expect((await panggil("GET", { query: "bagian=saklar" })).isi.data).toEqual({ aktif: false });
    expect((await panggil("POST", { badan: { jenisPerkara: "Cerai Gugat", hurufMesin: "F", majelis: [] } })).isi.data).toEqual({ aktif: false, belajar: null, dasarHukum: [] });
    aktor = "usr-admin";
    expect((await panggil("GET", { query: "bagian=ringkasan" })).isi.data).toMatchObject({ aktif: false, perPola: [] });
  });

  it("saklar menyala: POST memberi pertimbangan atas nama pemanggil; majelis dibaca dari badan", async () => {
    await nyalakan(db!);
    await catatJejakIsian(db!, { id: "usr-hakim", nama: "Hakim Satu, S.H." }, Array.from({ length: 6 }, (_, i) => jejak8503(`a${i}`, "F", "BF")));
    const r = await panggil("POST", { badan: { jenisPerkara: "Cerai Gugat", hurufMesin: "F", majelis: ["Hakim Satu, S.H."] } });
    expect(r.status).toBe(200);
    expect(r.isi.data.belajar.pertimbangan.find((p: any) => p.sumber === "hakim")).toMatchObject({ huruf: "BF", n: 6 });
    expect(r.isi.data.belajar.usulanBeda).toMatchObject({ huruf: "BF" });
  });

  it("hak per peran: tanpa 'blangko-abt' ditolak 403; ringkasan hanya Super Admin/Admin; saklar boleh ditanya siapa pun; tanpa masuk 401", async () => {
    await nyalakan(db!);
    aktor = "usr-bendahara";
    expect((await panggil("POST", { badan: { jenisPerkara: "Cerai Gugat" } })).status).toBe(403);
    expect((await panggil("GET", { query: "bagian=ringkasan" })).status).toBe(403);
    expect((await panggil("GET", { query: "bagian=saklar" })).status).toBe(200);
    aktor = "usr-hakim";
    expect((await panggil("POST", { badan: { jenisPerkara: "Cerai Gugat" } })).status).toBe(200);
    expect((await panggil("GET", { query: "bagian=ringkasan" })).status).toBe(403);
    aktor = "usr-admin";
    expect((await panggil("GET", { query: "bagian=ringkasan" })).status).toBe(200);
    aktor = null;
    expect((await panggil("POST", { badan: { jenisPerkara: "Cerai Gugat" } })).status).toBe(401);
  });
});
