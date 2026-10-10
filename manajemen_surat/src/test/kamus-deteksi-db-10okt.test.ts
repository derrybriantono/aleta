// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_KAMUS_DETEKSI, DDL_PUSTAKA_LABEL } from "@/server/db/schema";
import {
  bacaLapisDb,
  catatKoreksi,
  lapisUntukBot,
  selaraskanLapisBot,
  tetapkanHasilKoreksi,
  usulCalonDariKoreksi,
  type BarisKoreksi,
} from "@/server/modules/aleta-ecourt/kamus-deteksi";
import { cariButir } from "@/server/modules/aleta-ecourt/pustaka-pertimbangan";

/**
 * ============================================================================
 * KAMUS DETEKSI - LAPIS DATABASE (P9), JEJAK KOREKSI (D2), CALON (P8), LABEL
 * PUSTAKA (D3) - 10 Okt 2026
 * ============================================================================
 *
 * Perilaku yang dijaga (bukan teks kode):
 *   - migrasi 0060/0061 tercatat sekali, DDL berkas = schema.ts, jalan di pg-mem;
 *   - rute Admin hanya Super Admin/Admin; draf TIDAK dikirim ke bot; nonaktif
 *     atas pola benih menyalin barisnya lalu mematikannya; kembalikan ke benih;
 *   - "pasti" tanpa ukur dan contoh salah yang cocok ditolak untuk pola aktif;
 *   - abt-riwayat mencatat jejak koreksi hanya bila ekstensi melampirkannya,
 *     hasilnya dihitung portal dari usulan vs nilai akhir;
 *   - koreksi berulang menjadi calon yang tidak pernah aktif sendiri;
 *   - pemuat lapis di bot: tersimpan ke berkas, dipakai polaKelompok, bertahan
 *     saat bot hidup ulang, baris rusak dibuang, tanpa berkas = benih murni;
 *   - rute bot menuntut token; uji sampel membersihkan HTML SIPP.
 */

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot", "package.json"));
const FIXTURE = JSON.parse(readFileSync(path.join(process.cwd(), "src/test/fixtures/kamus-deteksi/contoh.json"), "utf8")) as {
  pola: Array<Record<string, unknown>>;
  templat: Array<Record<string, unknown>>;
};

// ─── Migrasi ─────────────────────────────────────────────────────────────────

const pernyataan = (sql: string) =>
  sql
    .split("\n")
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

describe("migrasi 0060/0061 - diklaim sekali, DDL berkas = schema.ts", () => {
  const SQL60 = path.join(process.cwd(), "drizzle", "0060_aleta_kamus_deteksi.sql");
  const SQL61 = path.join(process.cwd(), "drizzle", "0061_aleta_pustaka_label_kalimat.sql");

  it("jurnal: 0060 di idx 59, 0061 di idx 60, masing-masing sekali, tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0060_"))).toEqual([expect.objectContaining({ idx: 59, tag: "0060_aleta_kamus_deteksi" })]);
    expect(j.entries.filter((e) => e.tag.startsWith("0061_"))).toEqual([expect.objectContaining({ idx: 60, tag: "0061_aleta_pustaka_label_kalimat" })]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
    expect(existsSync(SQL60) && existsSync(SQL61)).toBe(true);
  });

  it("pernyataan berkas = DDL_KAMUS_DETEKSI / DDL_PUSTAKA_LABEL dan berjalan di pg-mem", () => {
    expect(pernyataan(readFileSync(SQL60, "utf8"))).toEqual([...DDL_KAMUS_DETEKSI.tabel, ...DDL_KAMUS_DETEKSI.indeks].map((s) => pernyataan(s)[0]));
    expect(pernyataan(readFileSync(SQL61, "utf8"))).toEqual([...DDL_PUSTAKA_LABEL.kolom, ...DDL_PUSTAKA_LABEL.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    // Sekali saja: pg-mem menolak CREATE TABLE IF NOT EXISTS atas tabel yang sudah ada
    // (batas pg-mem, bukan Postgres); ALTER ... IF NOT EXISTS 0061 diuji dua kali.
    kosong.public.none(readFileSync(SQL60, "utf8"));
    kosong.public.none(readFileSync(path.join(process.cwd(), "drizzle/0026_aleta_pustaka_pertimbangan.sql"), "utf8"));
    kosong.public.none(readFileSync(SQL61, "utf8"));
    kosong.public.none(readFileSync(SQL61, "utf8"));
    expect(kosong.public.many("SELECT kode FROM aleta_kamus_deteksi_pola")).toEqual([]);
    expect(kosong.public.many("SELECT bagian, label_alasan FROM aleta_pertimbangan_butir")).toEqual([]);
  });

  it("keempat tabel ikut cadangan mode ingatan", () => {
    for (const t of ["aleta_kamus_deteksi_pola", "aleta_kamus_deteksi_templat", "aleta_jejak_koreksi", "aleta_kamus_deteksi_calon"])
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
  });
});

// ─── Rute portal ─────────────────────────────────────────────────────────────

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
type PanggilanBot = { jalur: string; method: string; body: unknown };
const panggilanBot: PanggilanBot[] = [];
let botHidup = true;
let lapisBot: { sidik: string } = { sidik: "" };

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
vi.mock("@/server/modules/aleta-ecourt/kamus-deteksi-gateway", () => ({
  panggilBotKamus: async (jalur: string, pilihan: { method?: string; body?: unknown } = {}) => {
    panggilanBot.push({ jalur, method: pilihan.method ?? "GET", body: pilihan.body });
    if (!botHidup) return { ok: false, error: "ALETA Bot belum dapat dihubungi." };
    if (jalur === "" && (pilihan.method ?? "GET") === "GET")
      return { ok: true, data: { ok: true, benih: { contoh: { pola: FIXTURE.pola, templat: FIXTURE.templat } }, lapis: { jumlahPola: 0, jumlahTemplat: 0, sidik: lapisBot.sidik } } };
    if (jalur === "/lapis") {
      lapisBot = { sidik: String((pilihan.body as { sidik?: string }).sidik ?? "") };
      return { ok: true, data: { ok: true } };
    }
    if (jalur === "/uji") return { ok: true, data: { ok: true, sumber: "saksi", diperiksa: 40, cocok: 7, contoh: [{ rujukan: "perkara 1", cuplikan: "«tidak memberi nafkah»" }], contohTidak: [] } };
    return { ok: false, error: "jalur tidak dikenal" };
  },
}));

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, unknown>; error?: { message: string } } };

async function panggil(
  rute: "kamus-deteksi" | "abt-riwayat" | "pustaka",
  cara: "GET" | "POST",
  opsi: { query?: string; badan?: unknown } = {}
): Promise<Hasil> {
  const modul =
    rute === "kamus-deteksi"
      ? await import("@/app/api/aleta-ecourt/kamus-deteksi/route")
      : rute === "abt-riwayat"
        ? await import("@/app/api/aleta-ecourt/abt-riwayat/route")
        : await import("@/app/api/aleta-ecourt/pustaka/pertimbangan/route");
  const req = new NextRequest("http://localhost/api/x" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const fungsi = (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara];
  const jawaban = await fungsi(req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

type Kelompok = { kelompok: string; pola: Array<Record<string, unknown>>; templat: Array<Record<string, unknown>> };
const polaDari = (d: Record<string, unknown>, kode: string) =>
  (d.kelompok as Kelompok[]).flatMap((k) => k.pola).find((p) => p.kode === kode) as Record<string, unknown> | undefined;
const dorongTerakhir = () => [...panggilanBot].reverse().find((p) => p.jalur === "/lapis")?.body as { pola: Array<Record<string, unknown>>; sidik: string } | undefined;

describe("rute kamus deteksi (pg-mem berbenih, bot tiruan)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    panggilanBot.length = 0;
    botHidup = true;
    lapisBot = { sidik: "" };
  });

  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("hanya Super Admin/Admin - peran lain ditolak membaca maupun mengubah", async () => {
    aktor = "usr-ppg";
    expect((await panggil("kamus-deteksi", "GET")).status).toBe(403);
    expect((await panggil("kamus-deteksi", "POST", { badan: { tindakan: "kirim-ke-bot" } })).status).toBe(403);
    aktor = "usr-admin";
    expect((await panggil("kamus-deteksi", "GET")).status).toBe(200);
  });

  it("GET: benih dari bot bertanda asal benih, beserta angka ukur dan keselarasan", async () => {
    const r = await panggil("kamus-deteksi", "GET");
    expect(r.status).toBe(200);
    const d = r.isi.data;
    expect(d.benih).toMatchObject({ asal: "bot", jumlahKelompok: 1, galat: [] });
    const p = polaDari(d, "contoh-nafkah-tidak-memberi")!;
    expect(p).toMatchObject({ asal: "benih", status: "aktif", yakin: "pasti", adaBenih: true });
    expect(p.ketepatan).toBeCloseTo(0.98);
    // Lapis portal kosong, bot belum menerima apa pun: sidik keduanya beda -> belum selaras.
    expect(d.selaras).toBe(false);
  });

  it("pola baru = draf, tersimpan tetapi TIDAK dikirim ke bot; diaktifkan baru dikirim", async () => {
    const baru = {
      tindakan: "simpan-pola",
      kode: "alasan-f-mabuk",
      kelompok: "alasan",
      label: "Pemabuk",
      kunci: "B",
      regex: "(suka|sering)\\s+mabuk",
      flags: "i",
      contohBenar: ["Tergugat sering mabuk-mabukan"],
      contohSalah: ["Tergugat tidak pernah mabuk"],
    };
    const s = await panggil("kamus-deteksi", "POST", { badan: baru });
    expect(s.status).toBe(200);
    expect(s.isi.data.hasil).toMatchObject({ kode: "alasan-f-mabuk", status: "draf" });
    expect(dorongTerakhir()!.pola).toEqual([]);

    const a = await panggil("kamus-deteksi", "POST", { badan: { tindakan: "status", jenis: "pola", kode: "alasan-f-mabuk", status: "aktif" } });
    expect(a.status).toBe(200);
    expect(dorongTerakhir()!.pola).toEqual([expect.objectContaining({ kode: "alasan-f-mabuk", kelompok: "alasan", status: "aktif" })]);
    const g = (await panggil("kamus-deteksi", "GET")).isi.data;
    expect(polaDari(g, "alasan-f-mabuk")).toMatchObject({ asal: "database", status: "aktif" });
    // Sidik yang dikirim = sidik yang disimpan bot -> selaras.
    expect(g.selaras).toBe(true);
  });

  it("pola aktif dengan contoh salah yang ikut cocok, atau 'pasti' tanpa ukur, ditolak 400", async () => {
    const r1 = await panggil("kamus-deteksi", "POST", {
      badan: { tindakan: "simpan-pola", kode: "uji-salah", kelompok: "alasan", regex: "mabuk", status: "aktif", contohBenar: ["mabuk"], contohSalah: ["tidak pernah mabuk"] },
    });
    expect(r1.status).toBe(400);
    expect(r1.isi.error?.message).toMatch(/contohSalah ikut cocok/);
    const r2 = await panggil("kamus-deteksi", "POST", {
      badan: { tindakan: "simpan-pola", kode: "uji-pasti", kelompok: "alasan", regex: "mabuk", yakin: "pasti", contohBenar: ["mabuk"] },
    });
    expect(r2.status).toBe(400);
    expect(r2.isi.error?.message).toMatch(/"pasti" wajib punya ukur.n > 0/);
    const r3 = await panggil("kamus-deteksi", "POST", { badan: { tindakan: "simpan-pola", kode: "uji-rusak", kelompok: "alasan", regex: "(mabuk" } });
    expect(r3.status).toBe(400);
    // Draf boleh menyimpan contoh salah yang masih cocok (bahan kerja), tetapi tidak dapat diaktifkan.
    const r4 = await panggil("kamus-deteksi", "POST", {
      badan: { tindakan: "simpan-pola", kode: "uji-draf", kelompok: "alasan", regex: "mabuk", contohSalah: ["tidak pernah mabuk"] },
    });
    expect(r4.status).toBe(200);
    expect((await panggil("kamus-deteksi", "POST", { badan: { tindakan: "status", jenis: "pola", kode: "uji-draf", status: "aktif" } })).status).toBe(400);
  });

  it("menonaktifkan pola BENIH: baris disalin ke database (menimpa benih), dikirim nonaktif; kembalikan memulihkan benih", async () => {
    const r = await panggil("kamus-deteksi", "POST", { badan: { tindakan: "status", jenis: "pola", kode: "contoh-pisah-rumah", status: "nonaktif" } });
    expect(r.status).toBe(200);
    expect(r.isi.data.hasil).toMatchObject({ disalinDariBenih: true, status: "nonaktif" });
    expect(dorongTerakhir()!.pola).toEqual([expect.objectContaining({ kode: "contoh-pisah-rumah", kelompok: "contoh", status: "nonaktif" })]);
    let g = (await panggil("kamus-deteksi", "GET")).isi.data;
    expect(polaDari(g, "contoh-pisah-rumah")).toMatchObject({ asal: "database-menimpa", status: "nonaktif" });

    expect((await panggil("kamus-deteksi", "POST", { badan: { tindakan: "kembalikan", jenis: "pola", kode: "contoh-pisah-rumah" } })).status).toBe(200);
    g = (await panggil("kamus-deteksi", "GET")).isi.data;
    expect(polaDari(g, "contoh-pisah-rumah")).toMatchObject({ asal: "benih", status: "aktif" });
    expect(dorongTerakhir()!.pola).toEqual([]);
    // Kode tanpa benih tidak dapat "dikembalikan".
    await panggil("kamus-deteksi", "POST", { badan: { tindakan: "simpan-pola", kode: "tanpa-benih", kelompok: "alasan", regex: "x" } });
    expect((await panggil("kamus-deteksi", "POST", { badan: { tindakan: "kembalikan", jenis: "pola", kode: "tanpa-benih" } })).status).toBe(400);
  });

  it("templat: simpan, aktifkan, dikirim; kurung kurawal pincang ditolak", async () => {
    const ok = await panggil("kamus-deteksi", "POST", {
      badan: { tindakan: "simpan-templat", kode: "saksi-ringkas", kelompok: "kalimat-saksi", teks: "Saksi {nama} menerangkan:", status: "aktif" },
    });
    expect(ok.status).toBe(200);
    expect((dorongTerakhir() as unknown as { templat: unknown[] }).templat).toEqual([expect.objectContaining({ kode: "saksi-ringkas", status: "aktif" })]);
    const rusak = await panggil("kamus-deteksi", "POST", { badan: { tindakan: "simpan-templat", kode: "rusak", kelompok: "kalimat-saksi", teks: "Saksi {nama" } });
    expect(rusak.status).toBe(400);
  });

  it("uji pola atas contoh diketik, dan atas sampel data nyata lewat bot (persen dihitung portal)", async () => {
    const u = await panggil("kamus-deteksi", "POST", {
      badan: { tindakan: "uji", regex: "tidak\\s+memberi\\s+nafkah", contoh: ["Tergugat tidak memberi nafkah lahir", "Tergugat rajin bekerja"] },
    });
    expect(u.status).toBe(200);
    expect(u.isi.data).toMatchObject({ ok: true, cocok: 1 });
    expect((u.isi.data.hasil as Array<{ potongan: string }>)[0].potongan).toContain("«tidak memberi nafkah»");
    expect((await panggil("kamus-deteksi", "POST", { badan: { tindakan: "uji", regex: "(rusak", contoh: ["x"] } })).status).toBe(400);

    const s = await panggil("kamus-deteksi", "POST", { badan: { tindakan: "uji-sampel", regex: "nafkah", sumber: "saksi", batas: 500 } });
    expect(s.status).toBe(200);
    expect(s.isi.data).toMatchObject({ ok: true, diperiksa: 40, cocok: 7, persen: 17.5 });
    expect(panggilanBot.find((p) => p.jalur === "/uji")!.body).toMatchObject({ regex: "nafkah", flags: "i", sumber: "saksi", batas: 500 });
    expect((await panggil("kamus-deteksi", "POST", { badan: { tindakan: "uji-sampel", regex: "x", sumber: "ngawur" } })).status).toBe(400);
    // Uji tidak mengubah apa pun, jadi tidak mendorong.
    expect(panggilanBot.some((p) => p.jalur === "/lapis")).toBe(false);
  });

  it("bot mati: simpan tetap berhasil, dorongnya dilaporkan gagal; selaraskan berkala mendorong saat bot kembali", async () => {
    botHidup = false;
    const s = await panggil("kamus-deteksi", "POST", {
      badan: { tindakan: "simpan-pola", kode: "alasan-z", kelompok: "alasan", regex: "judi", status: "aktif", contohBenar: ["suka berjudi"] },
    });
    expect(s.status).toBe(200);
    expect(s.isi.data.dorong).toMatchObject({ ok: false, jumlahPola: 1 });
    botHidup = true;
    expect(await selaraskanLapisBot(db!)).toEqual({ didorong: true, sebab: "didorong" });
    expect(await selaraskanLapisBot(db!)).toEqual({ didorong: false, sebab: "sudah selaras" });
  });
});

// ─── D2: jejak koreksi lewat abt-riwayat ─────────────────────────────────────

describe("D2 jejak koreksi dari Input ke ABT", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    panggilanBot.length = 0;
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("catatan berlampiran koreksi -> aleta_jejak_koreksi; hasil dihitung dari usulan vs nilai akhir; tanpa lampiran tidak dicatat", async () => {
    const r = await panggil("abt-riwayat", "POST", {
      badan: {
        daftar: [
          {
            perkaraId: "10018",
            nomorPerkara: "533/Pdt.G/2026/PA.Dgl",
            kode: "0222",
            nama: "Sejak kapan perselisihan",
            sebelum: "",
            sesudah: "sejak tahun 2019",
            cara: "usulan dari keterangan saksi (pasti), disunting petugas sebelum disimpan",
            pada: "2026-10-10T03:00:00.000Z",
            koreksi: { usulan: "sejak tahun 2018", sumber: "usulan dari keterangan saksi (pasti)", kodePola: "waktu-sejak-tahun", keyakinan: "pasti", kalimatSumber: "Bahwa sejak tahun 2018 ...", hasil: "", jalur: "Input ke ABT" },
          },
          { perkaraId: "10018", kode: "0246", nama: "x", sebelum: "", sesudah: "y", cara: "diketik", pada: "2026-10-10T03:00:01.000Z" },
          {
            perkaraId: "10018",
            kode: "1268",
            nama: "upaya damai",
            sebelum: "",
            sesudah: "belum pernah ada upaya damai",
            cara: "bunyi dipilih",
            pada: "2026-10-10T03:00:02.000Z",
            koreksi: { usulan: "", hasil: "dipilih", jalur: "Input semua yang pasti" },
          },
        ],
      },
    });
    expect(r.status).toBe(200);
    expect(r.isi.data).toMatchObject({ tercatat: 3, koreksi: 2 });
    const baris = await db!.queryAll<Record<string, unknown>>(`SELECT * FROM aleta_jejak_koreksi ORDER BY pada`);
    expect(baris).toHaveLength(2);
    expect(baris[0]).toMatchObject({
      perkara_id: "10018",
      nomor_perkara: "533/Pdt.G/2026/PA.Dgl",
      variabel: "0222",
      nilai_usulan: "sejak tahun 2018",
      nilai_akhir: "sejak tahun 2019",
      hasil: "disunting",
      kode_pola: "waktu-sejak-tahun",
      jalur: "Input ke ABT",
      petugas_id: "usr-super",
    });
    expect(String(baris[0].petugas_nama)).not.toBe("");
    expect(baris[1]).toMatchObject({ variabel: "1268", hasil: "dipilih", jalur: "Input semua yang pasti" });
    // Riwayat ABT sendiri tetap tercatat utuh (tiga baris).
    expect(await db!.queryAll(`SELECT id FROM aleta_abt_riwayat`)).toHaveLength(3);
  });

  it("tetapkanHasilKoreksi: kosong=diketik, sama longgar=diterima, beda=disunting, dipilih dipercaya", () => {
    expect(tetapkanHasilKoreksi("", "apa saja")).toBe("diketik");
    expect(tetapkanHasilKoreksi("Sejak  tahun “2018”", "sejak tahun \"2018\"")).toBe("diterima");
    expect(tetapkanHasilKoreksi("2018", "2019", "diterima")).toBe("disunting");
    expect(tetapkanHasilKoreksi("", "x", "dipilih")).toBe("dipilih");
  });
});

// ─── P8: calon dari koreksi berulang ─────────────────────────────────────────

describe("P8 calon dari koreksi berulang", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    panggilanBot.length = 0;
    botHidup = true;
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  async function koreksi(perkaraId: string, variabel: string, usulan: string, akhir: string, kodePola = "", kalimat = "") {
    await catatKoreksi(db!, "usr-super", { perkaraId, variabel, nilaiUsulan: usulan, nilaiAkhir: akhir, kodePola, kalimatSumber: kalimat, jalur: "Input ke ABT" });
  }

  it("isian sama (angka berbeda) 3x di 2 perkara -> calon templat; pola disunting >=20% -> calon pola; diterima jadi DRAF dan tidak dikirim", async () => {
    await koreksi("1", "9944", "", "sudah berpisah selama 8 bulan");
    await koreksi("2", "9944", "", "sudah berpisah selama 3 bulan");
    await koreksi("2", "9944", "1 tahun", "sudah berpisah selama 14 bulan");
    await koreksi("3", "9944", "", "lain sama sekali");
    // Pola contoh-pisah-rumah: 3 disunting dari 4 pemakaian, di 3 perkara.
    await koreksi("4", "0222", "sejak 2018", "sejak 2019", "contoh-pisah-rumah", "pisah ranjang tetapi masih serumah");
    await koreksi("5", "0222", "sejak 2017", "mulai tahun 2016", "contoh-pisah-rumah", "pisah rumah sementara karena bekerja");
    await koreksi("6", "0222", "sejak 2020", "kira-kira pada 2021", "contoh-pisah-rumah", "pisah tempat tinggal hanya seminggu");
    await koreksi("7", "0222", "sejak 2015", "sejak 2015", "contoh-pisah-rumah", "sudah pisah tempat tinggal sejak 2015");

    const r = await panggil("kamus-deteksi", "GET", { query: "bagian=calon" });
    expect(r.status).toBe(200);
    expect(r.isi.data.susun).toMatchObject({ baru: 2 });
    const calon = r.isi.data.calon as Array<Record<string, unknown>>;
    const templat = calon.find((c) => c.jenis === "templat")!;
    expect(templat).toMatchObject({ variabel: "9944", jumlahKoreksi: 3, jumlahPerkara: 2, usulTeks: "sudah berpisah selama 14 bulan", keadaan: "menunggu" });
    const pola = calon.find((c) => c.jenis === "pola")!;
    expect(pola).toMatchObject({ kodePolaAsal: "contoh-pisah-rumah", kelompok: "contoh", jumlahKoreksi: 3, jumlahDipakai: 4 });
    expect(pola.usulRegex).toBe(FIXTURE.pola[1].regex);
    expect(pola.contohSalah).toHaveLength(3);
    expect(pola.contohBenar).toEqual(["sudah pisah tempat tinggal sejak 2015"]);

    // Disusun ulang tidak menggandakan.
    expect((await panggil("kamus-deteksi", "GET", { query: "bagian=calon" })).isi.data.susun).toMatchObject({ baru: 0, diperbarui: 2 });

    // Terima calon pola sebagai draf: baris database lahir (menimpa benih HANYA bila aktif) - draf tidak dikirim.
    const t = await panggil("kamus-deteksi", "POST", { badan: { tindakan: "terima-calon", id: pola.id, status: "draf" } });
    expect(t.status).toBe(200);
    expect(t.isi.data.hasil).toMatchObject({ jenis: "pola", hasilKode: "contoh-pisah-rumah", status: "draf" });
    expect(dorongTerakhir()!.pola).toEqual([]);
    const lapis = await bacaLapisDb(db!);
    expect(lapis.pola[0]).toMatchObject({ kode: "contoh-pisah-rumah", status: "draf", yakin: "ragu", asalCalon: pola.id });
    expect(lapis.pola[0].contohSalah).toHaveLength(3);
    // Draf yang contoh salahnya masih cocok tidak dapat diaktifkan sebelum regexnya diperbaiki.
    expect((await panggil("kamus-deteksi", "POST", { badan: { tindakan: "status", jenis: "pola", kode: "contoh-pisah-rumah", status: "aktif" } })).status).toBe(400);

    // Tolak wajib beralasan; sesudah ditolak tidak hidup lagi.
    expect((await panggil("kamus-deteksi", "POST", { badan: { tindakan: "tolak-calon", id: templat.id, alasan: "" } })).status).toBe(400);
    expect((await panggil("kamus-deteksi", "POST", { badan: { tindakan: "tolak-calon", id: templat.id, alasan: "isian khusus perkara" } })).status).toBe(200);
    const ulang = await panggil("kamus-deteksi", "GET", { query: "bagian=calon" });
    expect(ulang.isi.data.calon).toEqual([]);
    expect(((await panggil("kamus-deteksi", "GET", { query: "bagian=calon&keadaan=ditolak" })).isi.data.calon as unknown[]).length).toBe(1);
  });

  it("di bawah ambang tidak ada calon (2 koreksi, atau 1 perkara saja)", () => {
    const b = (i: number, perkaraId: string): BarisKoreksi => ({
      id: String(i),
      perkaraId,
      nomorPerkara: "",
      variabel: "0001",
      namaVariabel: "",
      nilaiUsulan: "",
      sumber: "",
      kodePola: "",
      keyakinan: "",
      kalimatSumber: "",
      nilaiAkhir: "isian yang sama",
      hasil: "diketik",
      jalur: "",
      petugasNama: "",
      pada: `2026-10-10T0${i}:00:00Z`,
    });
    expect(usulCalonDariKoreksi([b(1, "a"), b(2, "b")])).toEqual([]);
    expect(usulCalonDariKoreksi([b(1, "a"), b(2, "a"), b(3, "a")])).toEqual([]);
    expect(usulCalonDariKoreksi([b(1, "a"), b(2, "a"), b(3, "b")])).toHaveLength(1);
  });

  it("jejak koreksi terbaca layar Admin, beserta ringkasan per variabel", async () => {
    await koreksi("1", "0222", "a", "a");
    await koreksi("1", "0246", "a", "b");
    const r = await panggil("kamus-deteksi", "GET", { query: "bagian=jejak&koreksi=1" });
    expect(r.status).toBe(200);
    expect((r.isi.data.jejak as Array<{ variabel: string }>).map((x) => x.variabel)).toEqual(["0246"]);
    expect((r.isi.data.ringkas as { perHasil: Record<string, number> }).perHasil).toMatchObject({ diterima: 1, disunting: 1 });
  });
});

// ─── D3: label pustaka kalimat ───────────────────────────────────────────────

describe("D3 pustaka kalimat berlabel (memperluas pustaka pertimbangan)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    botHidup = true;
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("tambah kalimat keterangan saksi berlabel, saring per label, usulan label dari kamus, sunting label", async () => {
    const kalimat = "Bahwa saksi mengetahui Tergugat tidak pernah memberi nafkah sejak tahun 2023 dan keduanya sudah pisah rumah.";
    const t = await panggil("pustaka", "POST", { badan: { tindakan: "tambah", teks: kalimat, bagian: "keterangan-saksi", labelAlasan: "b, x", labelKeadaan: "Pisah Rumah" } });
    expect(t.status).toBe(200);
    expect(t.isi.data).toMatchObject({ ok: true, baru: true });
    const id = String(t.isi.data.butirId);

    const cari = await cariButir(db!, { keadaan: "usulan", bagian: "keterangan-saksi", labelAlasan: "B" });
    expect(cari.map((b) => b.id)).toEqual([id]);
    expect(cari[0]).toMatchObject({ bagian: "keterangan-saksi", labelAlasan: ["B"], labelKeadaan: ["pisah-rumah"], labelOleh: "usr-super" });
    expect(await cariButir(db!, { keadaan: "usulan", labelAlasan: "F" })).toEqual([]);
    // Lewat rute GET juga.
    const g = await panggil("pustaka", "GET", { query: "keadaan=usulan&labelKeadaan=pisah-rumah" });
    expect((g.isi.data.butir as Array<{ id: string }>).map((b) => b.id)).toEqual([id]);

    // Usulan label dari pola kamus (benih fixture lewat bot tiruan): alasan B + keadaan contoh:pisah-rumah.
    const u = await panggil("pustaka", "POST", { badan: { tindakan: "usul-label", butirId: id } });
    expect(u.isi.data).toMatchObject({ ok: true, labelAlasan: [], labelKeadaan: ["contoh:B", "contoh:pisah-rumah"] });

    const l = await panggil("pustaka", "POST", { badan: { tindakan: "label", butirId: id, bagian: "pertimbangan", labelAlasan: ["F", "A"], labelKeadaan: [] } });
    expect(l.isi.data).toMatchObject({ ok: true });
    expect((l.isi.data.butir as Record<string, unknown>)).toMatchObject({ bagian: "pertimbangan", labelAlasan: ["A", "F"], labelKeadaan: [] });

    // Kalimat yang sama tidak digandakan.
    const lagi = await panggil("pustaka", "POST", { badan: { tindakan: "tambah", teks: kalimat, bagian: "posita" } });
    expect(lagi.isi.data).toMatchObject({ ok: true, baru: false, butirId: id });
    // Non-admin tidak dapat mengubah pustaka.
    aktor = "usr-ppg";
    expect((await panggil("pustaka", "POST", { badan: { tindakan: "label", butirId: id, bagian: "amar" } })).status).toBe(403);
  });
});

// ─── Bot: pemuat lapis, rute bertoken, uji sampel ────────────────────────────

type KamusBot = {
  lupakan: () => void;
  polaKelompok: (k: string) => Array<{ kode: string; status: string; re: RegExp; asal: string }>;
  templatKelompok: (k: string) => Array<{ kode: string }>;
};
type LapisBotModul = {
  terimaLapis: (isi: unknown) => { ok: boolean; diterima: { pola: number; templat: number }; ditolak: string[]; galatSimpan: string };
  muatLapisTersimpan: (o?: { paksa?: boolean }) => { dimuat: boolean; sebab?: string; pola?: number };
  keadaanLapis: () => { jumlahPola: number; sidik: string; berkas: string };
  _setel: () => void;
};

describe("bot: pemuat lapis database kamus deteksi", () => {
  const folder = mkdtempSync(path.join(process.env.TMP || os.tmpdir(), "kamus-lapis-"));
  const berkas = path.join(folder, "kamus-deteksi-lapis.json");
  const kamus = require_(path.join(akar, "aleta_bot/services/kamusDeteksi.js")) as KamusBot;
  const lapis = require_(path.join(akar, "aleta_bot/services/kamusDeteksiLapis.js")) as LapisBotModul;

  beforeEach(() => {
    process.env.ALETA_KAMUS_DETEKSI_LAPIS_PATH = berkas;
    rmSync(berkas, { force: true });
    kamus.lupakan();
    lapis._setel();
  });
  afterAll(() => {
    delete process.env.ALETA_KAMUS_DETEKSI_LAPIS_PATH;
    kamus.lupakan();
    lapis._setel();
    rmSync(folder, { recursive: true, force: true });
  });

  it("tanpa berkas: tidak melempar, lapis kosong (perilaku benih murni)", () => {
    expect(lapis.muatLapisTersimpan({ paksa: true })).toMatchObject({ dimuat: false });
    expect(kamus.polaKelompok("uji-lapis")).toEqual([]);
  });

  it("lapis dari portal dipakai polaKelompok, disimpan ke berkas, dan bertahan saat bot hidup ulang; baris rusak dibuang", async () => {
    // Bentuk persis yang dikirim portal (lapisUntukBot) - draf tidak ikut.
    const kirim = lapisUntukBot({
      pola: [
        { kode: "alasan-z", kelompok: "uji-lapis", label: "", kunci: "B", regex: "judi", flags: "i", status: "aktif", yakin: "ragu", contohBenar: [], contohSalah: [], ukur: { n: 0, tepat: 0, salahTangkap: 0 }, catatan: "", asalCalon: "", diubahOleh: "", diubahAt: "" },
        { kode: "alasan-mati", kelompok: "uji-lapis", label: "", kunci: "", regex: "x", flags: "i", status: "nonaktif", yakin: "ragu", contohBenar: [], contohSalah: [], ukur: { n: 0, tepat: 0, salahTangkap: 0 }, catatan: "", asalCalon: "", diubahOleh: "", diubahAt: "" },
        { kode: "alasan-draf", kelompok: "uji-lapis", label: "", kunci: "", regex: "y", flags: "i", status: "draf", yakin: "ragu", contohBenar: [], contohSalah: [], ukur: { n: 0, tepat: 0, salahTangkap: 0 }, catatan: "", asalCalon: "", diubahOleh: "", diubahAt: "" },
      ],
      templat: [{ kode: "t-1", kelompok: "uji-lapis-kalimat", label: "", gaya: "", teks: "Saksi {nama}", syarat: {}, status: "aktif", catatan: "", asalCalon: "", diubahOleh: "", diubahAt: "" }],
    });
    expect(kirim.pola.map((p) => p.kode)).toEqual(["alasan-z", "alasan-mati"]);
    const hasil = lapis.terimaLapis({ ...kirim, pola: [...kirim.pola, { kode: "rusak", kelompok: "uji-lapis", regex: "(judi" }] });
    expect(hasil).toMatchObject({ ok: true, diterima: { pola: 2, templat: 1 }, galatSimpan: "" });
    expect(hasil.ditolak.join(" ")).toMatch(/rusak: regex tidak terkompilasi/);
    expect(existsSync(berkas)).toBe(true);
    expect(kamus.polaKelompok("uji-lapis").map((p) => p.kode)).toEqual(["alasan-z"]);
    expect(kamus.polaKelompok("uji-lapis")[0]).toMatchObject({ asal: "database" });
    expect(kamus.polaKelompok("uji-lapis")[0].re.test("suka berjudi")).toBe(true);
    expect(kamus.templatKelompok("uji-lapis-kalimat").map((t) => t.kode)).toEqual(["t-1"]);
    expect(lapis.keadaanLapis()).toMatchObject({ jumlahPola: 2, sidik: kirim.sidik });

    // "Bot hidup ulang": ingatan dikosongkan, berkas dibaca lagi.
    kamus.lupakan();
    lapis._setel();
    expect(kamus.polaKelompok("uji-lapis")).toEqual([]);
    expect(lapis.muatLapisTersimpan({ paksa: true })).toMatchObject({ dimuat: true, pola: 2 });
    expect(kamus.polaKelompok("uji-lapis").map((p) => p.kode)).toEqual(["alasan-z"]);
    // Baca berkala: berkas tidak berubah -> tidak dimuat ulang.
    expect(lapis.muatLapisTersimpan()).toMatchObject({ dimuat: false, sebab: "tidak berubah" });
  });

  it("rute bot menuntut token internal; PUT /lapis bertoken memasang lapis", async () => {
    // express milik aleta_bot; portal tidak memasang tipenya.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const express = require_("express") as any;
    const lama = process.env.ALETA_BOT_INTERNAL_TOKEN;
    process.env.ALETA_BOT_INTERNAL_TOKEN = "token-uji-kamus";
    const app = express();
    app.use(express.json());
    app.use("/k", require_(path.join(akar, "aleta_bot/routes/kamusDeteksiRoutes.js")));
    const server = app.listen(0);
    try {
      const port = (server.address() as AddressInfo).port;
      const badan = JSON.stringify({ sidik: "abc", pola: [{ kode: "alasan-q", kelompok: "uji-lapis", regex: "selingkuh", status: "aktif" }], templat: [] });
      const tanpa = await fetch(`http://127.0.0.1:${port}/k/lapis`, { method: "PUT", headers: { "content-type": "application/json" }, body: badan });
      expect(tanpa.status).toBe(401);
      const dengan = await fetch(`http://127.0.0.1:${port}/k/lapis`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-aleta-internal-token": "token-uji-kamus" },
        body: badan,
      });
      expect(dengan.status).toBe(200);
      expect(kamus.polaKelompok("uji-lapis").map((p) => p.kode)).toEqual(["alasan-q"]);
      const g = await fetch(`http://127.0.0.1:${port}/k`, { headers: { "x-aleta-internal-token": "token-uji-kamus" } });
      const isi = (await g.json()) as { ok: boolean; benih: Record<string, unknown>; lapis: { sidik: string; jumlahPola: number } };
      expect(isi).toMatchObject({ ok: true, lapis: { sidik: "abc", jumlahPola: 1 } });
      expect(typeof isi.benih).toBe("object");
    } finally {
      server.close();
      if (lama === undefined) delete process.env.ALETA_BOT_INTERNAL_TOKEN;
      else process.env.ALETA_BOT_INTERNAL_TOKEN = lama;
    }
  });
});

describe("bot: uji pola atas sampel data nyata (baca-saja, kueri disuntik)", () => {
  const sampel = require_(path.join(akar, "aleta_bot/services/kamusDeteksiSampel.js")) as {
    ujiSampel: (m: Record<string, unknown>, alat: { kueri: (k: string, sql: string, p: unknown[]) => Promise<unknown[]> }) => Promise<Record<string, unknown>>;
  };

  it("posita HTML dibersihkan, cocok dihitung, kueri hanya SELECT ke koneksi yang benar", async () => {
    const kueri: Array<{ k: string; sql: string; p: unknown[] }> = [];
    const h = await sampel.ujiSampel(
      { regex: "tidak\\s+memberi\\s+nafkah", sumber: "posita", batas: 100 },
      {
        kueri: async (k, sql, p) => {
          kueri.push({ k, sql, p });
          return [
            { id: 1, nomor: "1/Pdt.G/2026/PA.Dgl", teks: "<p>Bahwa Tergugat <b>tidak</b>&nbsp;memberi nafkah</p>" },
            { id: 2, nomor: "2/Pdt.G/2026/PA.Dgl", teks: "<p>Bahwa rumah tangga rukun</p>" },
            { id: 3, nomor: "3/Pdt.G/2026/PA.Dgl", teks: "" },
          ];
        },
      }
    );
    expect(h).toMatchObject({ ok: true, diperiksa: 2, cocok: 1 });
    expect((h.contoh as Array<{ rujukan: string; cuplikan: string }>)[0]).toMatchObject({ rujukan: "1/Pdt.G/2026/PA.Dgl" });
    expect((h.contoh as Array<{ cuplikan: string }>)[0].cuplikan).toContain("«tidak memberi nafkah»");
    expect(kueri[0].k).toBe("sipp_primary");
    expect(kueri[0].sql.trim()).toMatch(/^SELECT /);
    expect(kueri[0].p).toEqual([100]);

    const isian = await sampel.ujiSampel({ regex: "x", sumber: "isian", noVar: "02a22" }, { kueri: async (k, sql, p) => (kueri.push({ k, sql, p }), []) });
    expect(isian).toMatchObject({ ok: true, diperiksa: 0 });
    expect(kueri[1]).toMatchObject({ k: "aps_badilag", p: ["0222", 2000] });
    expect(await sampel.ujiSampel({ regex: "(x", sumber: "saksi" }, { kueri: async () => [] })).toMatchObject({ ok: false });
    expect(await sampel.ujiSampel({ regex: "x", flags: "g", sumber: "saksi" }, { kueri: async () => [] })).toMatchObject({ ok: false });
  });
});
