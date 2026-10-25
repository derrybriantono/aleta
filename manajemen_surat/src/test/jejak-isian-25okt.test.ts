// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KATALOG_FITUR_SATKER, keadaanFitur } from "@/lib/fitur-satker";
import {
  BATAS_KIRIM,
  BATAS_NILAI,
  KODE_FITUR_JEJAK_ISIAN,
  RETENSI_HARI,
  alurDariNomor,
  batasRetensi,
  bersihkanMasukanButir,
  bersihkanMasukanIsian,
  kelompokkanButir,
  kelompokkanIsian,
  kemiripan,
  penandaAsal,
  persenDiterimaButir,
  samaLonggar,
  tetapkanHasilButir,
  tetapkanHasilIsian,
} from "@/lib/jejak-isian";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_JEJAK_ISIAN } from "@/server/db/schema";
import {
  bacaButirPerkara,
  bacaJejakPerkara,
  bersihkanJejakLawas,
  catatButirSaksi,
  catatJejakIsian,
  jejakIsianAktif,
  laporanButirSaksi,
  lupakanPembersihanTerakhir,
  ringkasJejakIsian,
} from "@/server/modules/aleta-ecourt/jejak-isian";
import { susunCalon, usulCalonDariKoreksi, type BarisKoreksi } from "@/server/modules/aleta-ecourt/kamus-deteksi";
import { KUNCI_FITUR_SATKER } from "@/server/modules/satker/fitur";
import { tulisSetelanSistem } from "@/server/modules/satker/setelan";

/**
 * ============================================================================
 * 25 OKT 2026 - RANTAI C, BUTIR C1: JEJAK ISIAN DAN BUTIR SAKSI (U1 + U2 + U6)
 * ============================================================================
 *
 * pg-mem + rute HTTP sungguhan; data rekaan. Yang dijaga:
 *   1. migrasi 0091 = DDL schema.ts, jurnal idx 81 (tanpa lubang), ikut cadangan
 *   2. saklar bawaan MATI: tidak satu baris pun ditulis, rute menjawab aktif:false
 *   3. aturan murni: hasil, kemiripan, pembersih, angka lapangan
 *   4. isian: jejak, nilai sebelum utuh, bisaDiurungkan, Urungkan menandai asalnya, koreksi tanpa ganda
 *   5. butir saksi: hasil, kemiripan, laporan "% diterima", koreksi per pola (bukan calon templat)
 *   6. retensi 2 tahun
 *   7. hak per peran di rute
 *   8. rute abt-riwayat menyimpan salinan LENGKAP bila saklar menyala
 */

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => db,
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

async function nyalakan(d: AletaDatabase) {
  await tulisSetelanSistem(d, KUNCI_FITUR_SATKER, { fitur: { [KODE_FITUR_JEJAK_ISIAN]: "stabil" }, diubahOleh: "uji", diubahPada: new Date().toISOString() }, new Date().toISOString());
}

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, any>; error?: { message: string } } };
async function panggil(rute: "jejak-isian" | "saksi-butir" | "abt-riwayat", cara: "GET" | "POST", opsi: { query?: string; badan?: unknown } = {}): Promise<Hasil> {
  const modul =
    rute === "jejak-isian"
      ? await import("@/app/api/aleta-ecourt/jejak-isian/route")
      : rute === "saksi-butir"
        ? await import("@/app/api/aleta-ecourt/saksi-butir/route")
        : await import("@/app/api/aleta-ecourt/abt-riwayat/route");
  const req = new NextRequest("http://localhost/api/x" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const fungsi = (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara];
  const jawaban = await fungsi(req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

const isian = (tambah: Record<string, unknown> = {}) => ({
  perkaraId: "10018",
  nomorPerkara: "533/Pdt.G/2026/PA.Dgl",
  jenisPerkara: "Cerai Gugat",
  blangko: "[01] [Kabul Verstek] Cerai (Format Lengkap)",
  jenisBlangko: "put",
  kode: "0222",
  namaVariabel: "Awal perselisihan",
  nilaiUsulan: "",
  asalUsulan: "",
  nilaiSebelum: "",
  nilaiFinal: "sejak tahun 2019",
  cara: "diketik",
  terverifikasi: "ya",
  jalur: "blangko-derry",
  pada: "2026-10-25T03:00:00.000Z",
  ...tambah,
});

const butir = (tambah: Record<string, unknown> = {}) => ({
  perkaraId: "10018",
  nomorPerkara: "533/Pdt.G/2026/PA.Dgl",
  sidang: "2",
  saksiKe: 1,
  pihak: "P",
  jalur: "katalog",
  variabel: "5058",
  katalog: "cerai-gugat",
  jenisPerkara: "Cerai Gugat",
  butir: "q-kenal",
  varian: "v2",
  jenisKeterangan: "melihat",
  nomorButir: 1,
  pertanyaan: "Apakah saudara kenal Penggugat?",
  usulan: "Kenal, saya tetangganya.",
  teksFinal: "Kenal, saya tetangganya.",
  sumberFakta: "gugatan",
  keyakinan: "yakin",
  kodePola: "cerai-gugat/q-kenal",
  pada: "2026-10-25T03:00:00.000Z",
  ...tambah,
});

// ─── 1. Migrasi ──────────────────────────────────────────────────────────────

describe("migrasi 0091 - berkas = DDL schema.ts, jurnal idx 81, ikut cadangan", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0091_aleta_jejak_isian.sql");

  it("jurnal: 0091 sekali di idx 81 (sesudah 0088), tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0091_"))).toEqual([expect.objectContaining({ idx: 81, tag: "0091_aleta_jejak_isian" })]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i]?.when).toBeGreaterThan(j.entries[i - 1]?.when ?? 0);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_JEJAK_ISIAN, berjalan di pg-mem, kolom bawaan benar; kedua tabel ikut cadangan", () => {
    const isiSql = readFileSync(SQL, "utf8");
    expect(pernyataan(isiSql)).toEqual([...DDL_JEJAK_ISIAN.tabel, ...DDL_JEJAK_ISIAN.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(isiSql);
    expect(kosong.public.many(`SELECT * FROM aleta_saksi_butir`)).toEqual([]);
    expect(kosong.public.many(`SELECT * FROM aleta_isian_jejak`)).toEqual([]);
    kosong.public.none(`INSERT INTO aleta_isian_jejak (id, pada, dibuat_at) VALUES ('a', 'x', 'y')`);
    expect(kosong.public.one(`SELECT sebelum_dipotong, final_dipotong, cara, diurungkan_at FROM aleta_isian_jejak`)).toEqual({ sebelum_dipotong: 0, final_dipotong: 0, cara: "", diurungkan_at: "" });
    for (const t of ["aleta_saksi_butir", "aleta_isian_jejak"]) expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
  });

  it("saklar katalog Fitur Satker: kode jejak-isian, bawaan MATI, mati sebagai keadaan", () => {
    const butirKatalog = KATALOG_FITUR_SATKER.find((f) => f.kode === KODE_FITUR_JEJAK_ISIAN);
    expect(butirKatalog).toMatchObject({ bawaan: "mati", bagian: "portal" });
    expect(keadaanFitur(KODE_FITUR_JEJAK_ISIAN, {})).toMatchObject({ menyala: false, status: "mati" });
    expect(keadaanFitur(KODE_FITUR_JEJAK_ISIAN, { pengaturan: { fitur: { [KODE_FITUR_JEJAK_ISIAN]: "stabil" }, diubahOleh: "", diubahPada: "" } }).menyala).toBe(true);
  });
});

// ─── 3. Aturan murni ─────────────────────────────────────────────────────────

describe("aturan murni jejak isian", () => {
  it("retensi dua tahun", () => {
    expect(RETENSI_HARI).toBe(730);
    expect(batasRetensi(new Date("2026-10-25T00:00:00.000Z"))).toBe("2024-10-25T00:00:00.000Z");
  });

  it("hasil isian: otomatis, diterima, disunting, diketik, diurungkan", () => {
    expect(tetapkanHasilIsian("otomatis", "A", "A")).toBe("otomatis");
    expect(tetapkanHasilIsian("saran-diterima", "Sejak  tahun “2018”", 'sejak tahun "2018"')).toBe("diterima");
    expect(tetapkanHasilIsian("diubah", "2018", "2019")).toBe("disunting");
    expect(tetapkanHasilIsian("diketik", "", "bebas")).toBe("diketik");
    expect(tetapkanHasilIsian("diubah", "  ", "bebas")).toBe("diketik");
    expect(tetapkanHasilIsian("diurungkan", "x", "y")).toBe("diurungkan");
    expect(samaLonggar("A  B", "a b")).toBe(true);
  });

  it("hasil butir: diterima, disunting, diketik, dibuang", () => {
    expect(tetapkanHasilButir("Kenal.", "kenal.")).toBe("diterima");
    expect(tetapkanHasilButir("Kenal.", "Kenal sekali.")).toBe("disunting");
    expect(tetapkanHasilButir("", "Tambahan petugas.")).toBe("diketik");
    expect(tetapkanHasilButir("Kenal.", "")).toBe("dibuang");
    expect(tetapkanHasilButir("", "")).toBe("dibuang");
  });

  it("kemiripan Dice atas kata: 1 sama, 0 satu kosong, sebagian di antaranya", () => {
    expect(kemiripan("Saya kenal Penggugat", "saya  kenal penggugat")).toBe(1);
    expect(kemiripan("", "x")).toBe(0);
    expect(kemiripan("", "")).toBe(1);
    const sebagian = kemiripan("Saya kenal Penggugat sebagai tetangga", "Saya kenal Penggugat sebagai kakak");
    expect(sebagian).toBeGreaterThan(0.6);
    expect(sebagian).toBeLessThan(1);
  });

  it("pembersih isian: kode/perkara wajib, nilai dipotong dengan penanda, cara dan jalur tak dikenal jatuh ke bawaan, alur dari nomor", () => {
    expect(bersihkanMasukanIsian({ kode: "0222" })).toBeNull();
    expect(bersihkanMasukanIsian({ perkaraId: "1" })).toBeNull();
    expect(bersihkanMasukanIsian(null)).toBeNull();
    const m = bersihkanMasukanIsian({ perkaraId: "1", kode: "02 22<script>", nilaiSebelum: "x".repeat(BATAS_NILAI + 5), cara: "asal", jalur: "asal", nomorPerkara: "533/Pdt.G/2026/PA.Dgl" })!;
    expect(m.kode).toBe("0222script".slice(0, 20));
    expect(m.nilaiSebelum).toHaveLength(BATAS_NILAI);
    expect(m.sebelumDipotong).toBe(true);
    expect(m.cara).toBe("diketik");
    expect(bersihkanMasukanIsian({ perkaraId: "1", kode: "1", asalUsulan: "Isi SIPP (Bukti)!" })!.asalUsulan).toBe("isi-sipp-bukti");
    expect(penandaAsal("  Draf H-7 ")).toBe("draf-h-7");
    expect(penandaAsal(null)).toBe("");
    expect(m.jalur).toBe("blangko-derry");
    expect(m.jenisPerkara).toBe("alur:Pdt.G");
    expect(alurDariNomor("12/Pdt.P/2026/PA.Dgl")).toBe("Pdt.P");
    expect(bersihkanMasukanIsian({ perkaraId: "1", kode: "1", cara: "diurungkan" })!.jalur).toBe("urungkan");
  });

  it("pembersih butir: perkara wajib, pihak P/T, batas saksi dan nomor", () => {
    expect(bersihkanMasukanButir({})).toBeNull();
    const b = bersihkanMasukanButir({ perkaraId: "1", pihak: "t", saksiKe: 99, nomorButir: 9999, jalur: "aneh" })!;
    expect(b).toMatchObject({ pihak: "T", saksiKe: 20, nomorButir: 500, jalur: "katalog" });
    expect(bersihkanMasukanButir({ perkaraId: "1", pihak: "x" })!.pihak).toBe("");
  });

  it("angka butir: % diterima hanya atas butir BERUSULAN; kemiripan rata-rata pada yang disunting", () => {
    const k = kelompokkanButir([
      { kunci: "a", hasil: "diterima", kemiripan: 1 },
      { kunci: "a", hasil: "diterima", kemiripan: 1 },
      { kunci: "a", hasil: "disunting", kemiripan: 0.5 },
      { kunci: "a", hasil: "disunting", kemiripan: 0.7 },
      { kunci: "a", hasil: "diketik", kemiripan: 0 },
      { kunci: "b", hasil: "diketik", kemiripan: 0 },
    ]);
    expect(k[0]).toMatchObject({ kunci: "a", jumlah: 5, diterima: 2, disunting: 2, diketik: 1, persenDiterima: 50, kemiripanSunting: 0.6 });
    expect(k[1]).toMatchObject({ kunci: "b", persenDiterima: null, kemiripanSunting: null });
    expect(persenDiterimaButir({ diterima: 1, disunting: 1, dibuang: 1 })).toBe(33.3);
  });

  it("angka isian: usulan otomatis yang kemudian disunting TIDAK bertahan; saran diterima bertahan; diketik tak ikut usulan", () => {
    const k = kelompokkanIsian([
      { kode: "0222", asalUsulan: "isi-sipp", hasil: "otomatis", cara: "otomatis" },
      { kode: "0222", asalUsulan: "isi-sipp", hasil: "otomatis", cara: "otomatis" },
      { kode: "0222", asalUsulan: "isi-sipp", hasil: "disunting", cara: "diubah-otomatis" }, // satu otomatis disunting petugas
      { kode: "0222", asalUsulan: "saran", hasil: "diterima", cara: "saran-diterima" },
      { kode: "0222", asalUsulan: "saran", hasil: "disunting", cara: "diubah" },
      { kode: "0222", asalUsulan: "", hasil: "diketik", cara: "diketik" },
    ]);
    const oto = k.find((x) => x.asalUsulan === "isi-sipp")!;
    expect(oto).toMatchObject({ otomatis: 2, disuntingDariOtomatis: 1, usulan: 2, bertahan: 1, presisi: 0.5 });
    const saran = k.find((x) => x.asalUsulan === "saran")!;
    expect(saran).toMatchObject({ diterima: 1, disunting: 1, usulan: 2, bertahan: 1, presisi: 0.5 });
    const tanpa = k.find((x) => x.asalUsulan === "")!;
    expect(tanpa).toMatchObject({ diketik: 1, usulan: 0, presisi: null });
  });
});

// ─── 2, 4, 5, 6. Penyimpanan ─────────────────────────────────────────────────

describe("penyimpanan jejak (pg-mem)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    lupakanPembersihanTerakhir();
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("saklar bawaan MATI: tidak satu baris pun ditulis, ke tabel mana pun", async () => {
    expect(await jejakIsianAktif(db!)).toBe(false);
    const a = await catatJejakIsian(db!, { id: "usr-super" }, [isian()]);
    const b = await catatButirSaksi(db!, { id: "usr-super" }, [butir()]);
    expect(a).toMatchObject({ aktif: false, dicatat: 0 });
    expect(b).toMatchObject({ aktif: false, dicatat: 0 });
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_jejak`)).toEqual([]);
    expect(await db!.queryAll(`SELECT id FROM aleta_saksi_butir`)).toEqual([]);
    expect(await db!.queryAll(`SELECT id FROM aleta_jejak_koreksi`)).toEqual([]);
  });

  it("saklar menyala: jejak isian tercatat dengan hasil yang DIHITUNG server, bukan dipercaya dari ekstensi", async () => {
    await nyalakan(db!);
    expect(await jejakIsianAktif(db!)).toBe(true);
    const r = await catatJejakIsian(db!, { id: "usr-super" }, [
      isian({ kode: "0222", cara: "saran-diterima", nilaiUsulan: "sejak tahun 2019", nilaiFinal: "Sejak  tahun 2019", asalUsulan: "saran", hasil: "disunting" }),
      isian({ kode: "0246", cara: "diubah-otomatis", nilaiUsulan: "A", nilaiFinal: "B", asalUsulan: "isi-sipp" }),
      isian({ kode: "0300", cara: "diketik", nilaiFinal: "ketikan" }),
      isian({ kode: "0400", cara: "otomatis", nilaiUsulan: "dari SIPP", nilaiFinal: "dari SIPP", asalUsulan: "isi-sipp" }),
      { kode: "tanpa-perkara" },
    ]);
    expect(r).toMatchObject({ aktif: true, dicatat: 4, ditolak: 1 });
    const baris = await db!.queryAll<Record<string, unknown>>(`SELECT kode, hasil, cara, pengguna_id, pengguna_nama FROM aleta_isian_jejak ORDER BY kode`);
    expect(baris.map((b) => `${b.kode}:${b.hasil}`)).toEqual(["0222:diterima", "0246:disunting", "0300:diketik", "0400:otomatis"]);
    expect(baris[0]).toMatchObject({ pengguna_id: "usr-super" });
    expect(String(baris[0].pengguna_nama)).not.toBe("");
  });

  it("koreksi: diterima/disunting masuk aleta_jejak_koreksi SEKALI; diketik dan otomatis tidak", async () => {
    await nyalakan(db!);
    const r = await catatJejakIsian(db!, { id: "usr-super" }, [
      isian({ kode: "0222", cara: "saran-diterima", nilaiUsulan: "sejak 2019", nilaiFinal: "sejak 2019", asalUsulan: "saran" }),
      isian({ kode: "0246", cara: "diubah-otomatis", nilaiUsulan: "A", nilaiFinal: "B", asalUsulan: "isi-sipp", kodePola: "pola-x" }),
      isian({ kode: "0300", cara: "diketik", nilaiFinal: "ketikan" }),
      isian({ kode: "0400", cara: "otomatis", nilaiUsulan: "dari SIPP", nilaiFinal: "dari SIPP", asalUsulan: "isi-sipp" }),
    ]);
    expect(r.koreksi).toBe(2);
    const k = await db!.queryAll<Record<string, unknown>>(`SELECT variabel, hasil, kode_pola, jalur FROM aleta_jejak_koreksi ORDER BY variabel`);
    expect(k).toEqual([
      expect.objectContaining({ variabel: "0222", hasil: "diterima" }),
      expect.objectContaining({ variabel: "0246", hasil: "disunting", kode_pola: "pola-x", jalur: "blangko-derry" }),
    ]);
  });

  it("nilai sebelum UTUH (30.000 huruf) dan Urungkan dapat dijalankan dari PC lain: hanya baris terbaru per kode, belum diurungkan, tidak terpotong", async () => {
    await nyalakan(db!);
    const panjang = "p".repeat(12000);
    await catatJejakIsian(db!, { id: "usr-super" }, [
      isian({ kode: "5125", cara: "diubah", nilaiUsulan: "x", nilaiSebelum: panjang, nilaiFinal: "baru satu", pada: "2026-10-25T03:00:00.000Z" }),
      isian({ kode: "5125", cara: "diubah", nilaiUsulan: "x", nilaiSebelum: "baru satu", nilaiFinal: "baru dua", pada: "2026-10-25T03:05:00.000Z" }),
      isian({ kode: "0222", cara: "diketik", nilaiSebelum: "x".repeat(BATAS_NILAI + 10), nilaiFinal: "y", pada: "2026-10-25T03:10:00.000Z" }),
      isian({ kode: "0300", cara: "diketik", nilaiSebelum: "sama", nilaiFinal: "sama", pada: "2026-10-25T03:11:00.000Z" }),
    ]);
    const daftar = await bacaJejakPerkara(db!, "10018");
    expect(daftar).toHaveLength(4);
    const dua = daftar.find((b) => b.nilaiFinal === "baru dua")!;
    const satu = daftar.find((b) => b.nilaiFinal === "baru satu")!;
    expect(dua.bisaDiurungkan).toBe(true);
    expect(satu.bisaDiurungkan).toBe(false); // sudah ada suntingan yang lebih baru untuk kode yang sama
    expect(satu.nilaiSebelum).toBe(panjang); // utuh, tidak dipotong 4000 seperti aleta_abt_riwayat
    const terpotong = daftar.find((b) => b.kode === "0222")!;
    expect(terpotong.sebelumDipotong).toBe(true);
    expect(terpotong.bisaDiurungkan).toBe(false);
    expect(daftar.find((b) => b.kode === "0300")!.bisaDiurungkan).toBe(false); // tidak ada yang berubah
  });

  it("Urungkan dicatat sebagai baris baru dan menandai asalnya; sesudahnya asal tak lagi dapat diurungkan", async () => {
    await nyalakan(db!);
    await catatJejakIsian(db!, { id: "usr-super" }, [isian({ kode: "0222", cara: "diubah", nilaiUsulan: "x", nilaiSebelum: "lama", nilaiFinal: "baru" })]);
    const asal = (await bacaJejakPerkara(db!, "10018"))[0];
    expect(asal.bisaDiurungkan).toBe(true);
    await catatJejakIsian(db!, { id: "usr-hakim" }, [
      isian({ kode: "0222", cara: "diurungkan", jalur: "urungkan", nilaiSebelum: "baru", nilaiFinal: "lama", urungkanDari: asal.id, pada: "2026-10-25T04:00:00.000Z" }),
    ]);
    const daftar = await bacaJejakPerkara(db!, "10018");
    expect(daftar[0]).toMatchObject({ cara: "diurungkan", hasil: "diurungkan", urungkanDari: asal.id, bisaDiurungkan: false });
    const lama = daftar.find((b) => b.id === asal.id)!;
    expect(lama.diurungkanAt).not.toBe("");
    expect(lama.diurungkanOleh).toBe("usr-hakim");
    expect(lama.bisaDiurungkan).toBe(false);
    // Urungkan tidak masuk lingkar koreksi
    expect(await db!.queryAll(`SELECT id FROM aleta_jejak_koreksi WHERE hasil = 'diurungkan'`)).toEqual([]);
  });

  it("terverifikasi 'beda' tercatat dengan nilai terbaca; ringkasan menghitungnya", async () => {
    await nyalakan(db!);
    await catatJejakIsian(db!, { id: "usr-super" }, [
      isian({ kode: "0222", cara: "diketik", terverifikasi: "beda", nilaiTerbaca: "yang terbaca ABT" }),
      isian({ kode: "0246", cara: "diketik", terverifikasi: "ya" }),
    ]);
    const baris = await db!.queryOne<Record<string, unknown>>(`SELECT terverifikasi, nilai_terbaca FROM aleta_isian_jejak WHERE kode = '0222'`);
    expect(baris).toMatchObject({ terverifikasi: "beda", nilai_terbaca: "yang terbaca ABT" });
    const ring = await ringkasJejakIsian(db!);
    expect(ring).toMatchObject({ jumlah: 2, terverifikasiBeda: 1 });
    expect(ring.perHasil).toEqual({ diketik: 2 });
  });

  it("sekali kirim paling banyak BATAS_KIRIM entri", async () => {
    await nyalakan(db!);
    const banyak = Array.from({ length: BATAS_KIRIM + 15 }, (_, i) => isian({ kode: String(1000 + i) }));
    const r = await catatJejakIsian(db!, { id: "usr-super" }, banyak);
    expect(r.dicatat).toBe(BATAS_KIRIM);
  });

  it("butir saksi: hasil, kemiripan, kode pola; butir tanpa usulan dan tanpa teks ditolak", async () => {
    await nyalakan(db!);
    const r = await catatButirSaksi(db!, { id: "usr-super" }, [
      butir({ nomorButir: 1 }),
      butir({ nomorButir: 2, butir: "q-lihat", usulan: "Saya melihat mereka bertengkar.", teksFinal: "Saya melihat sendiri mereka bertengkar hebat." }),
      butir({ nomorButir: 3, butir: "q-tambah", usulan: "", teksFinal: "Tambahan dari petugas." }),
      butir({ nomorButir: 4, butir: "q-buang", usulan: "Jawaban dibuang.", teksFinal: "" }),
      butir({ nomorButir: 5, usulan: "", teksFinal: "" }),
      { pihak: "P" },
    ]);
    expect(r).toMatchObject({ aktif: true, dicatat: 4, ditolak: 2 });
    const baris = await db!.queryAll<Record<string, unknown>>(`SELECT nomor_butir, hasil, kemiripan, kode_pola, variabel FROM aleta_saksi_butir ORDER BY nomor_butir`);
    expect(baris.map((b) => b.hasil)).toEqual(["diterima", "disunting", "diketik", "dibuang"]);
    expect(Number(baris[0].kemiripan)).toBe(1);
    expect(Number(baris[1].kemiripan)).toBeGreaterThan(0.5);
    expect(Number(baris[1].kemiripan)).toBeLessThan(1);
    expect(baris[0]).toMatchObject({ kode_pola: "cerai-gugat/q-kenal", variabel: "5058" });
    const daftar = await bacaButirPerkara(db!, "10018");
    expect(daftar).toHaveLength(4);
  });

  it("laporan: % diterima tanpa diubah per katalog, varian, dan jenis perkara", async () => {
    await nyalakan(db!);
    await catatButirSaksi(db!, { id: "usr-super" }, [
      butir({ katalog: "cerai-gugat", butir: "q1", varian: "v1" }),
      butir({ katalog: "cerai-gugat", butir: "q1", varian: "v1", teksFinal: "Berbeda sama sekali." }),
      butir({ katalog: "cerai-gugat", butir: "q2", varian: "v1" }),
      butir({ katalog: "itsbat-nikah", jenisPerkara: "Itsbat Nikah", butir: "q1", varian: "v1" }),
      butir({ katalog: "itsbat-nikah", jenisPerkara: "Itsbat Nikah", butir: "q1", varian: "v1" }),
    ]);
    const lap = await laporanButirSaksi(db!);
    expect(lap.jumlah).toBe(5);
    expect(lap.persenDiterima).toBe(80);
    expect(lap.perKatalog.find((k) => k.kunci === "cerai-gugat")).toMatchObject({ jumlah: 3, diterima: 2, disunting: 1, persenDiterima: 66.7 });
    expect(lap.perKatalog.find((k) => k.kunci === "itsbat-nikah")).toMatchObject({ persenDiterima: 100 });
    expect(lap.perVarian.find((k) => k.kunci === "cerai-gugat/q1#v1")).toMatchObject({ jumlah: 2, persenDiterima: 50 });
    expect(lap.perJenisPerkara.map((k) => k.kunci).sort()).toEqual(["Cerai Gugat", "Itsbat Nikah"]);
    expect(lap.perPola.length).toBeGreaterThan(0);
    // "sejak" menyaring
    expect((await laporanButirSaksi(db!, "2030-01-01T00:00:00.000Z")).jumlah).toBe(0);
  });

  it("koreksi butir saksi masuk per pola dengan variabel 'saksi-...': diterima dan disunting; tanpa pola tidak", async () => {
    await nyalakan(db!);
    await catatButirSaksi(db!, { id: "usr-super" }, [
      butir({ teksFinal: "Kenal, saya tetangganya." }),
      butir({ nomorButir: 2, butir: "q2", kodePola: "cerai-gugat/q2", teksFinal: "Jawaban lain." }),
      butir({ nomorButir: 3, butir: "q3", kodePola: "", teksFinal: "Jawaban lain lagi." }),
    ]);
    const k = await db!.queryAll<Record<string, unknown>>(`SELECT variabel, hasil, kode_pola, kalimat_sumber, jalur FROM aleta_jejak_koreksi ORDER BY kode_pola`);
    expect(k).toHaveLength(2);
    expect(k[0]).toMatchObject({ variabel: "saksi-5058", hasil: "diterima", kode_pola: "cerai-gugat/q-kenal", jalur: "saksi-katalog" });
    expect(k[1]).toMatchObject({ hasil: "disunting", kode_pola: "cerai-gugat/q2" });
    expect(String(k[1].kalimat_sumber)).toContain("Apakah saudara kenal");
  });

  it("teks keterangan saksi TIDAK pernah menjadi calon templat, walau disunting tiga kali di dua perkara; calon POLA tetap dapat muncul", async () => {
    const mk = (id: string, perkaraId: string, hasil: string, variabel: string, kodePola = ""): BarisKoreksi => ({
      id,
      perkaraId,
      nomorPerkara: "",
      variabel,
      namaVariabel: "",
      nilaiUsulan: "usulan",
      sumber: "",
      kodePola,
      keyakinan: "",
      kalimatSumber: "pertanyaan",
      nilaiAkhir: "Saksi Budi Santoso mendengar sendiri pertengkaran itu.",
      hasil: hasil as BarisKoreksi["hasil"],
      jalur: "",
      petugasNama: "",
      pada: "2026-10-25T03:00:00.000Z",
    });
    const baris = [mk("1", "p1", "disunting", "saksi-5058"), mk("2", "p1", "disunting", "saksi-5058"), mk("3", "p2", "disunting", "saksi-5058")];
    expect(usulCalonDariKoreksi(baris).filter((c) => c.jenis === "templat")).toEqual([]);
    // pembanding: variabel biasa dengan perilaku yang sama MASIH menghasilkan calon templat (aturan lama tidak berubah)
    const biasa = baris.map((b, i) => ({ ...b, id: `b${i}`, variabel: "0222" }));
    expect(usulCalonDariKoreksi(biasa).filter((c) => c.jenis === "templat")).toHaveLength(1);
    // calon pola dari koreksi saksi tetap tersusun
    const pola = ["1", "2", "3"].map((n, i) => mk(`p${n}`, i === 2 ? "p2" : "p1", "disunting", "saksi-5058", "cerai-gugat/q2"));
    expect(usulCalonDariKoreksi(pola).filter((c) => c.jenis === "pola")).toHaveLength(1);
    expect(typeof susunCalon).toBe("function");
  });

  it("retensi 2 tahun: baris lebih tua dihapus, yang baru tetap; penyimpanan sendiri ikut membersihkan sesekali", async () => {
    await nyalakan(db!);
    const sekarang = new Date("2026-10-25T00:00:00.000Z");
    const masukkan = async (id: string, kode: string, pada: string) =>
      db!.run(`INSERT INTO aleta_isian_jejak (id, perkara_id, kode, pada, dibuat_at) VALUES (?, '10018', ?, ?, ?)`, [id, kode, pada, pada]);
    await masukkan("a", "1111", "2024-10-24T00:00:00.000Z");
    await masukkan("b", "2222", "2024-10-26T00:00:00.000Z");
    await db!.run(`INSERT INTO aleta_saksi_butir (id, perkara_id, pada, dibuat_at) VALUES ('x', '10018', '2024-01-01T00:00:00.000Z', 'z')`);
    await db!.run(`INSERT INTO aleta_saksi_butir (id, perkara_id, pada, dibuat_at) VALUES ('y', '10018', '2026-10-01T00:00:00.000Z', 'z')`);
    const r = await bersihkanJejakLawas(db!, sekarang);
    expect(r).toMatchObject({ isian: 1, butir: 1, batas: "2024-10-25T00:00:00.000Z" });
    expect((await db!.queryAll<Record<string, unknown>>(`SELECT kode FROM aleta_isian_jejak`)).map((b) => b.kode)).toEqual(["2222"]);
    expect((await db!.queryAll<Record<string, unknown>>(`SELECT id FROM aleta_saksi_butir`)).map((b) => b.id)).toEqual(["y"]);

    // Penyimpanan membersihkan baris basi sendiri (paling sering sekali tiap beberapa jam) tanpa menggagalkan pencatatan.
    await masukkan("c", "3333", "2020-01-01T00:00:00.000Z");
    lupakanPembersihanTerakhir();
    const hasil = await catatJejakIsian(db!, { id: "usr-super" }, [isian({ kode: "4444" })]);
    expect(hasil.dicatat).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await db!.queryAll<Record<string, unknown>>(`SELECT kode FROM aleta_isian_jejak ORDER BY kode`)).map((b) => b.kode)).toEqual(["2222", "4444"]);
  });
});

// ─── 7. Rute dan hak per peran ───────────────────────────────────────────────

describe("rute jejak-isian dan saksi-butir", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    lupakanPembersihanTerakhir();
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("saklar mati: GET saklar -> aktif:false; POST tidak menulis; GET perkara kosong", async () => {
    expect((await panggil("jejak-isian", "GET", { query: "bagian=saklar" })).isi.data).toEqual({ aktif: false });
    const p = await panggil("jejak-isian", "POST", { badan: { daftar: [isian()] } });
    expect(p.status).toBe(200);
    expect(p.isi.data).toMatchObject({ aktif: false, dicatat: 0 });
    const b = await panggil("saksi-butir", "POST", { badan: { daftar: [butir()] } });
    expect(b.isi.data).toMatchObject({ aktif: false, dicatat: 0 });
    expect((await panggil("jejak-isian", "GET", { query: "perkaraId=10018" })).isi.data).toMatchObject({ aktif: false, daftar: [] });
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_jejak`)).toEqual([]);
  });

  it("saklar menyala: POST mencatat, GET perkara memulangkan jejak lengkap, GET ringkasan untuk admin", async () => {
    await nyalakan(db!);
    expect((await panggil("jejak-isian", "GET", { query: "bagian=saklar" })).isi.data).toEqual({ aktif: true });
    const p = await panggil("jejak-isian", "POST", { badan: { daftar: [isian({ cara: "diubah", nilaiUsulan: "a", nilaiSebelum: "lama", nilaiFinal: "baru" })] } });
    expect(p.isi.data).toMatchObject({ aktif: true, dicatat: 1 });
    const g = await panggil("jejak-isian", "GET", { query: "perkaraId=10018" });
    expect(g.isi.data).toMatchObject({ aktif: true, ada: true });
    expect(g.isi.data.daftar[0]).toMatchObject({ kode: "0222", nilaiSebelum: "lama", nilaiFinal: "baru", bisaDiurungkan: true, hasil: "disunting" });
    const r = await panggil("jejak-isian", "GET", { query: "bagian=ringkasan" });
    expect(r.isi.data.ringkasan.jumlah).toBe(1);
    const b = await panggil("saksi-butir", "POST", { badan: { daftar: [butir(), butir({ nomorButir: 2, teksFinal: "Lain." })] } });
    expect(b.isi.data).toMatchObject({ aktif: true, dicatat: 2 });
    const lap = await panggil("saksi-butir", "GET", { query: "bagian=laporan" });
    expect(lap.isi.data.laporan).toMatchObject({ jumlah: 2, persenDiterima: 50 });
    const daftar = await panggil("saksi-butir", "GET", { query: "perkaraId=10018" });
    expect(daftar.isi.data.daftar).toHaveLength(2);
  });

  it("hak per peran: peran tanpa 'blangko-abt' ditolak 403 untuk POST dan GET perkara; ringkasan dan laporan hanya admin", async () => {
    await nyalakan(db!);
    aktor = "usr-bendahara";
    expect((await panggil("jejak-isian", "POST", { badan: { daftar: [isian()] } })).status).toBe(403);
    expect((await panggil("saksi-butir", "POST", { badan: { daftar: [butir()] } })).status).toBe(403);
    expect((await panggil("jejak-isian", "GET", { query: "perkaraId=10018" })).status).toBe(403);
    expect((await panggil("jejak-isian", "GET", { query: "bagian=ringkasan" })).status).toBe(403);
    // saklar boleh ditanya siapa pun yang masuk
    expect((await panggil("jejak-isian", "GET", { query: "bagian=saklar" })).status).toBe(200);
    // hakim: boleh mencatat, tetapi bukan angka/laporan/teks saksi
    aktor = "usr-hakim";
    expect((await panggil("jejak-isian", "POST", { badan: { daftar: [isian()] } })).status).toBe(200);
    expect((await panggil("saksi-butir", "POST", { badan: { daftar: [butir()] } })).status).toBe(200);
    expect((await panggil("jejak-isian", "GET", { query: "bagian=ringkasan" })).status).toBe(403);
    expect((await panggil("saksi-butir", "GET", { query: "bagian=laporan" })).status).toBe(403);
    expect((await panggil("saksi-butir", "GET", { query: "perkaraId=10018" })).status).toBe(403);
    // tanpa masuk
    aktor = null;
    expect((await panggil("jejak-isian", "POST", { badan: { daftar: [isian()] } })).status).toBe(401);
  });

  it("abt-riwayat: dengan saklar menyala menyimpan salinan LENGKAP (riwayat dipotong 4000), tanpa koreksi ganda; saklar mati tidak menulis jejak", async () => {
    const panjang = "q".repeat(9000);
    const catatan = [
      { perkaraId: "10018", nomorPerkara: "533/Pdt.G/2026/PA.Dgl", kode: "5125", nama: "Posita", sebelum: panjang, sesudah: "pendek", cara: "sunting tangan", pada: "2026-10-25T03:00:00.000Z" },
      {
        perkaraId: "10018",
        kode: "0222",
        nama: "Awal",
        sebelum: "",
        sesudah: "sejak 2019",
        cara: "usulan, disunting",
        pada: "2026-10-25T03:01:00.000Z",
        koreksi: { usulan: "sejak 2018", sumber: "usulan", kodePola: "waktu-sejak", keyakinan: "pasti", hasil: "", jalur: "Input ke ABT" },
      },
      { perkaraId: "10018", kode: "0246", nama: "x", sebelum: "y", sesudah: "", cara: "dikembalikan", pada: "2026-10-25T03:02:00.000Z" },
    ];
    // saklar mati
    const mati = await panggil("abt-riwayat", "POST", { badan: { daftar: catatan } });
    expect(mati.isi.data).toMatchObject({ tercatat: 3, koreksi: 1 });
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_jejak`)).toEqual([]);
    await db!.run(`DELETE FROM aleta_abt_riwayat`);
    await db!.run(`DELETE FROM aleta_jejak_koreksi`);

    await nyalakan(db!);
    const hidup = await panggil("abt-riwayat", "POST", { badan: { daftar: catatan } });
    expect(hidup.isi.data).toMatchObject({ tercatat: 3, koreksi: 1 });
    // riwayat lama tetap dipotong; jejak baru utuh
    expect((await db!.queryOne<Record<string, unknown>>(`SELECT sebelum, dipotong FROM aleta_abt_riwayat WHERE kode = '5125'`))!.sebelum).toHaveLength(4000);
    const jejak = await bacaJejakPerkara(db!, "10018");
    expect(jejak).toHaveLength(3);
    expect(jejak.find((b) => b.kode === "5125")).toMatchObject({ nilaiSebelum: panjang, sebelumDipotong: false, cara: "sunting-panel", jalur: "panel-abt", bisaDiurungkan: true });
    expect(jejak.find((b) => b.kode === "0222")).toMatchObject({ cara: "diubah", hasil: "disunting", nilaiUsulan: "sejak 2018", asalUsulan: "panel" });
    expect(jejak.find((b) => b.kode === "0246")).toMatchObject({ cara: "diurungkan", hasil: "diurungkan" });
    // koreksi tepat satu (dari rute lama), tidak digandakan oleh jejak
    expect(await db!.queryAll(`SELECT id FROM aleta_jejak_koreksi`)).toHaveLength(1);
  });
});
