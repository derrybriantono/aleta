// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { newDb } from "pg-mem";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { bolehAksi } from "@/lib/matriks-peran";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_KESEHATAN_GALAT } from "@/server/db/schema";
import {
  bersihkanTeksGalat,
  catatGalat,
  daftarGalat,
  lokasiRuteDariStack,
  pangkasGalat,
  rincianGalat,
  ringkasGalat,
  setelUlangPencatatGalat,
  sidikGalat,
  tandaiGalat,
  teksUntukPengembang,
} from "@/server/modules/kesehatan/galat";
import {
  KOMPONEN_PENENTU,
  bacaPengaturanKesehatan,
  detakKesehatan,
  imporUjiBeban,
  jalankanPemeriksaan,
  pemberitahuanKesehatan,
  perbaruiStatus,
  riwayatKesehatan,
  simpanPengaturanKesehatan,
  ujiBebanTerakhir,
  type DepsKesehatan,
  type PengaturanKesehatan,
} from "@/server/modules/kesehatan/layanan";
import {
  periksaBot,
  periksaCadangan,
  periksaEcourt,
  periksaEkstensi,
  periksaSambungan,
  periksaServer,
  periksaUjiBeban,
  periksaWhatsapp,
  warnaTerburuk,
  type HasilKesehatan,
} from "@/server/modules/kesehatan/pemeriksa";
import { utama as ujiBebanUtama } from "../../scripts/uji-beban.mjs";

/**
 * ============================================================================
 * PUSAT KESEHATAN + CATATAN GALAT + IMPOR UJI BEBAN (E2, 25 Okt 2026)
 * ============================================================================
 *
 *   1. migrasi 0094 = DDL schema.ts, jurnal, ikut cadangan
 *   2. catatan galat: pembersihan rahasia, pengelompokan, kambuh, pembatasan, retensi
 *   3. pemeriksa: warna tiap komponen dari jawaban tiruan (kelabu bukan bahaya)
 *   4. layanan: satu pemeriksaan penuh, saklar mati bawaan, peringatan WhatsApp
 *      (dua merah berturut-turut, tanpa pengulangan, kabar pulih), lonceng
 *   5. impor uji beban: hasil skrip K9 sungguhan diterima, bukan-kembaran ditolak
 *   6. bot: bacaan kesehatan dari pemutus arus dan uji sambung
 *   7. rute: hak per peran, penampung galat peramban/ekstensi
 *
 * Tanpa jaringan: bot, WhatsApp, dan sinkron adalah jawaban tiruan.
 */

// Peringatan WhatsApp digabung dengan jendela tahan (26 Okt 2026); uji ini memeriksa pengiriman langsung (jendela 0). Penggabungan diuji di peringatan-gabungan-26okt.
process.env.ALETA_PERINGATAN_GABUNG_MENIT = "0";

const ctx = vi.hoisted(() => ({ db: null as unknown, aktor: null as string | null }));

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => ctx.db,
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => ctx.aktor }));

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const KINI = new Date("2026-10-25T03:00:00.000Z");
const iso = (menitLalu: number, dari = KINI) => new Date(dari.getTime() - menitLalu * 60_000).toISOString();

async function dbBaru(): Promise<AletaDatabase> {
  return createAletaDatabase({ useInMemory: true, seed: false });
}

// ─── 1. Migrasi ──────────────────────────────────────────────────────────────

describe("migrasi 0094 - berkas = DDL schema.ts, jurnal, ikut cadangan", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0094_aleta_kesehatan_galat.sql");

  it("jurnal: 0094 tepat sekali, idx = urutan, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0094_"))).toEqual([expect.objectContaining({ tag: "0094_aleta_kesehatan_galat" })]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i]?.when).toBeGreaterThan(j.entries[i - 1]?.when ?? 0);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_KESEHATAN_GALAT, berjalan di pg-mem di atas tabel perangkat, dan semua tabelnya ikut cadangan", () => {
    const isiSql = readFileSync(SQL, "utf8");
    expect(pernyataan(isiSql)).toEqual([...DDL_KESEHATAN_GALAT.tabel, ...DDL_KESEHATAN_GALAT.indeks, ...DDL_KESEHATAN_GALAT.kolom].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(readFileSync(path.join(process.cwd(), "drizzle", "0085_aleta_jejak_masuk_perangkat.sql"), "utf8"));
    kosong.public.none(isiSql);
    for (const t of ["aleta_catatan_galat", "aleta_catatan_galat_kejadian", "aleta_uji_beban_hasil", "aleta_kesehatan_status", "aleta_kesehatan_riwayat"]) {
      expect(kosong.public.many(`SELECT * FROM ${t}`)).toEqual([]);
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
    }
    expect(kosong.public.many(`SELECT versi_ekstensi FROM aleta_perangkat`)).toEqual([]);
  });
});

// ─── 2. Catatan galat ────────────────────────────────────────────────────────

describe("catatan galat", () => {
  let db: AletaDatabase;
  beforeAll(async () => {
    db = await dbBaru();
  }, 120000);
  afterAll(async () => db?.close());
  beforeEach(async () => {
    setelUlangPencatatGalat();
    await db.run("DELETE FROM aleta_catatan_galat_kejadian");
    await db.run("DELETE FROM aleta_catatan_galat");
  });

  it("rahasia dibuang SEBELUM disimpan: sandi, token, surel, nomor 16 digit, telepon, kueri alamat", () => {
    const bersih = bersihkanTeksGalat(
      "Gagal masuk password=Rahasia123 Authorization: Bearer abcdefghij0123456789 surel budi@pa-rekaan.test NIK 7201010101010001 telepon 081234567890 di https://x.test/aleta/jadwal?tiket=ABC123&nomor=1%2FPdt.G#frag"
    );
    expect(bersih).not.toMatch(/Rahasia123|abcdefghij0123456789|budi@|7201010101010001|081234567890|tiket=|ABC123|frag/);
    expect(bersih).toContain("https://x.test/aleta/jadwal");
    expect(bersih).toContain("[surel]");
  });

  it("kejadian serupa (angka dan id berbeda) satu kelompok; jenis atau sumber berbeda kelompok lain", async () => {
    const a = await catatGalat(db, { sumber: "server", jenis: "TypeError", pesan: "Perkara 123 tidak ditemukan", lokasi: "/api/x/456" }, KINI);
    const b = await catatGalat(db, { sumber: "server", jenis: "TypeError", pesan: "Perkara 987 tidak ditemukan", lokasi: "/api/x/789" }, KINI);
    const c = await catatGalat(db, { sumber: "peramban", jenis: "TypeError", pesan: "Perkara 123 tidak ditemukan", lokasi: "/api/x/456" }, KINI);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    const daftar = await daftarGalat(db);
    expect(daftar.map((g) => [g.sumber, g.jumlah]).sort()).toEqual([["peramban", 1], ["server", 2]]);
    expect(sidikGalat({ sumber: "server", jenis: "E", pesan: "x 1", lokasi: "/a" })).toBe(sidikGalat({ sumber: "server", jenis: "E", pesan: "x 99", lokasi: "/a" }));
  });

  it("kejadian membawa halaman tanpa kueri, akun, peramban, versi, dan stack dipotong; teks pengembang tanpa nama akun", async () => {
    const id = (await catatGalat(
      db,
      {
        sumber: "peramban",
        jenis: "Error",
        pesan: "Boom",
        halaman: "/aleta/aleta-ecourt/sidang?nomor=1%2FPdt.G%2F2026",
        stack: Array.from({ length: 20 }, (_, i) => `at fungsi${i} (https://x.test/_next/static/chunk.js?v=1:${i}:1)`).join("\n"),
        akunId: "u-1",
        akunNama: "Budi Rekaan",
        peramban: "Mozilla/5.0 (Windows NT 10.0) Chrome/130",
        versi: "1.205.39",
      },
      KINI
    ))!;
    const r = (await rincianGalat(db, id))!;
    expect(r.kejadian).toHaveLength(1);
    expect(r.kejadian[0]).toMatchObject({ halaman: "/aleta/aleta-ecourt/sidang", akunId: "u-1", versi: "1.205.39" });
    expect(r.kejadian[0]!.potonganStack.split("\n")).toHaveLength(8);
    expect(r.kejadian[0]!.potonganStack).not.toContain("?v=1");
    const teks = teksUntukPengembang(r.kelompok, r.kejadian);
    expect(teks).toContain("Versi: 1.205.39");
    expect(teks).not.toContain("Budi Rekaan");
  });

  it("kambuh sesudah ditandai ditangani membuka kembali kelompoknya", async () => {
    const id = (await catatGalat(db, { sumber: "server", pesan: "Gagal tulis" }, KINI))!;
    expect(await tandaiGalat(db, id, { id: "u-sa", nama: "Super Rekaan" }, true, "sudah diperbaiki", KINI)).toBe(true);
    expect((await daftarGalat(db, { status: "ditangani" }))[0]).toMatchObject({ id, tanganiOleh: "Super Rekaan" });
    await catatGalat(db, { sumber: "server", pesan: "Gagal tulis" }, new Date(KINI.getTime() + 60_000));
    const sesudah = (await daftarGalat(db))[0]!;
    expect(sesudah.status).toBe("baru");
    expect(sesudah.jumlah).toBe(2);
    expect(await tandaiGalat(db, "galat-tidak-ada", { id: "x", nama: "x" }, true)).toBe(false);
  });

  it("banjir: rincian paling banyak 50 per kelompok per jam, jumlahnya tetap naik; di atas 120 per menit ditolak", async () => {
    for (let i = 0; i < 70; i += 1) await catatGalat(db, { sumber: "server", pesan: "Banjir yang sama" }, KINI);
    const g = (await daftarGalat(db))[0]!;
    expect(g.jumlah).toBe(70);
    expect((await rincianGalat(db, g.id))!.kejadian).toHaveLength(50);
    const jam = new Date(KINI.getTime() + 3_600_000);
    await catatGalat(db, { sumber: "server", pesan: "Banjir yang sama" }, jam);
    // jam berikutnya: rincian boleh bertambah lagi (51 baris tersimpan; rincianGalat menampilkan 50 terbaru)
    const semua = await db.queryOne<{ n: number | string }>("SELECT COUNT(*) AS n FROM aleta_catatan_galat_kejadian WHERE galat_id = ?", [g.id]);
    expect(Number(semua?.n)).toBe(51);

    setelUlangPencatatGalat();
    let ditolak = 0;
    for (let i = 0; i < 150; i += 1) {
      if ((await catatGalat(db, { sumber: "server", pesan: `Pesan beda ${"abcdefghij"[i % 10]}${"klmnopqrst"[Math.floor(i / 10) % 10]}x` }, KINI)) === null) ditolak += 1;
    }
    expect(ditolak).toBe(30);
  });

  it("sumber tidak sah, pesan kosong, dan basis data rusak tidak melempar", async () => {
    expect(await catatGalat(db, { sumber: "lain" as never, pesan: "x" }, KINI)).toBeNull();
    expect(await catatGalat(db, { sumber: "server", pesan: "   " }, KINI)).toBeNull();
    const rusak = { queryOne: async () => { throw new Error("mati"); }, queryAll: async () => [], run: async () => { throw new Error("mati"); } } as unknown as AletaDatabase;
    expect(await catatGalat(rusak, { sumber: "server", pesan: "x" }, KINI)).toBeNull();
  });

  it("retensi 90 hari: kejadian dan kelompok yang lebih tua dibuang, yang baru tetap", async () => {
    const lama = new Date(KINI.getTime() - 100 * 86_400_000);
    await catatGalat(db, { sumber: "server", pesan: "Galat lama" }, lama);
    setelUlangPencatatGalat();
    await catatGalat(db, { sumber: "server", pesan: "Galat baru" }, KINI);
    await pangkasGalat(db, KINI);
    expect((await daftarGalat(db)).map((g) => g.pesan)).toEqual(["Galat baru"]);
    const sisa = await db.queryOne<{ n: number | string }>("SELECT COUNT(*) AS n FROM aleta_catatan_galat_kejadian");
    expect(Number(sisa?.n)).toBe(1);
  });

  it("ringkasan 24 jam hanya menghitung yang baru; lokasi rute dibaca dari tumpukan", async () => {
    await catatGalat(db, { sumber: "server", pesan: "Galat hari ini" }, new Date(KINI.getTime() - 3_600_000));
    setelUlangPencatatGalat();
    await catatGalat(db, { sumber: "server", pesan: "Galat kemarin" }, new Date(KINI.getTime() - 30 * 3_600_000));
    const r = await ringkasGalat(db, KINI);
    expect(r.kelompokBaru).toBe(1);
    expect(r.kejadian24Jam).toBe(1);
    expect(r.teratas[0]?.pesan).toBe("Galat hari ini");
    expect(lokasiRuteDariStack("Error: x\n    at GET (D:\\app\\.next\\server\\app\\api\\aleta-ecourt\\sidang\\route.js:1:1)")).toBe("/api/aleta-ecourt/sidang");
    expect(lokasiRuteDariStack("tanpa rute")).toBe("");
  });
});

// ─── 3. Pemeriksa ────────────────────────────────────────────────────────────

describe("pemeriksa: warna dari jawaban tiruan", () => {
  it("warna terburuk: kelabu tidak menurunkan, semua kelabu -> kelabu", () => {
    expect(warnaTerburuk(["hijau", "kelabu", "kuning"])).toBe("kuning");
    expect(warnaTerburuk(["hijau", "merah", "kuning"])).toBe("merah");
    expect(warnaTerburuk(["kelabu", "kelabu"])).toBe("kelabu");
    expect(warnaTerburuk([])).toBe("kelabu");
  });

  it("bot: menjawab = hijau; tidak menjawab = merah", () => {
    expect(periksaBot({ ok: true, data: { bot: { botEnabled: true } } }).warna).toBe("hijau");
    expect(periksaBot({ ok: false, error: "habis waktu" }).warna).toBe("merah");
  });

  it("WhatsApp: tersambung hijau, qr/menyambung kuning, terputus merah, bot dimatikan kelabu (bukan bahaya), bot mati kelabu", () => {
    const wa = (status: string, botEnabled = true) => periksaWhatsapp({ ok: true, data: { whatsapp: { status }, bot: { botEnabled } } }, KINI).warna;
    expect(wa("connected")).toBe("hijau");
    expect(wa("ready")).toBe("hijau");
    expect(wa("qr_needed")).toBe("kuning");
    expect(wa("reconnecting")).toBe("kuning");
    expect(wa("disconnected")).toBe("merah");
    expect(wa("auth_failure")).toBe("merah");
    expect(wa("unknown")).toBe("kelabu");
    expect(wa("disconnected", false)).toBe("kelabu");
    expect(periksaWhatsapp({ ok: false, error: "x" }, KINI).warna).toBe("kelabu");
  });

  const sambungan = (circuit: string | null, ping: string, durasiMs = 20, gagalBerturut = 0) => ({
    ok: true as const,
    data: {
      sambungan: [
        {
          kunci: "sipp_primary",
          nama: "SIPP",
          circuit: circuit ? { keadaan: circuit, gagalBerturut, gagalTerakhir: null, berhasilTerakhir: iso(5), pesanTerakhir: "" } : null,
          ping: { status: ping, durasiMs, galat: ping === "gagal" ? "ETIMEDOUT" : "" },
        },
      ],
    },
  });

  it("SIPP: pemutus arus terbuka atau uji sambung gagal = merah; setengah terbuka/baru gagal = kuning; sehat = hijau; lambat = kuning; tanpa data = kelabu", () => {
    expect(periksaSambungan("sipp_primary", sambungan("terbuka", "dilewati", 0, 5), KINI).warna).toBe("merah");
    expect(periksaSambungan("sipp_primary", sambungan("tertutup", "gagal"), KINI).warna).toBe("merah");
    expect(periksaSambungan("sipp_primary", sambungan("setengah_terbuka", "berhasil"), KINI).warna).toBe("kuning");
    expect(periksaSambungan("sipp_primary", sambungan("tertutup", "berhasil", 30, 2), KINI).warna).toBe("kuning");
    expect(periksaSambungan("sipp_primary", sambungan("tertutup", "berhasil", 30), KINI).warna).toBe("hijau");
    expect(periksaSambungan("sipp_primary", sambungan("tertutup", "berhasil", 1800), KINI).warna).toBe("kuning");
    expect(periksaSambungan("sipp_primary", sambungan("tertutup", "dilewati"), KINI).warna).toBe("hijau");
    expect(periksaSambungan("sipp_primary", sambungan(null, "dilewati"), KINI).warna).toBe("kelabu");
    expect(periksaSambungan("aps_badilag", sambungan("tertutup", "berhasil"), KINI).warna).toBe("kelabu");
    // bot lama tanpa rute /kesehatan: kelabu, bukan merah
    expect(periksaSambungan("sipp_primary", { ok: false, error: "ALETA Bot belum punya rute ini" }, KINI).warna).toBe("kelabu");
  });

  it("e-Court: dimatikan kelabu; berjalan hijau; galat kuning; macet kuning", () => {
    const j = (o: Record<string, unknown>) => periksaEcourt({ ok: true, data: { jadwal: { pengaturan: { aktif: true, jarakJam: 6 }, ...o } } }, KINI).warna;
    expect(periksaEcourt({ ok: true, data: { jadwal: { pengaturan: { aktif: false } } } }, KINI).warna).toBe("kelabu");
    expect(j({ sedangJalan: true })).toBe("hijau");
    expect(j({ terakhirSelesai: iso(120) })).toBe("hijau");
    expect(j({ terakhirSelesai: iso(120), terakhirGalat: "login gagal" })).toBe("kuning");
    expect(j({ terakhirSelesai: iso(60 * 40) })).toBe("kuning");
  });

  it("cadangan: gagal merah; >72 jam merah; >36 jam kuning; segar hijau; belum pernah kelabu", () => {
    const c = (selesai: string, berhasil = true) => periksaCadangan({ ok: true, data: { terakhir: { cadangan: { mulai: selesai, selesai, berhasil } } } }, KINI).warna;
    expect(c(iso(60 * 5))).toBe("hijau");
    expect(c(iso(60 * 40))).toBe("kuning");
    expect(c(iso(60 * 80))).toBe("merah");
    expect(c(iso(60), false)).toBe("merah");
    expect(periksaCadangan({ ok: true, data: { terakhir: {} } }, KINI).warna).toBe("kelabu");
  });

  it("server: warna terburuk dari prosesor/memori/disk; tanpa data kelabu", () => {
    const k = (cpu: string, ram: string, disk: string) =>
      periksaServer({ ok: true, data: { ringkas: { server: { cpu: { persen: 10, warna: cpu as never }, ram: { persen: 50, warna: ram as never }, disk: { persen: 60, warna: disk as never } } } } }).warna;
    expect(k("hijau", "hijau", "hijau")).toBe("hijau");
    expect(k("hijau", "kuning", "hijau")).toBe("kuning");
    expect(k("hijau", "hijau", "merah")).toBe("merah");
    expect(periksaServer({ ok: false, error: "x" }).warna).toBe("kelabu");
  });

  it("ekstensi: PC dengan versi lama = kuning (tidak pernah merah); semua terbaru hijau; belum melapor kelabu", () => {
    const pc = (versi: string, nama = "PC-1") => ({ nama, akun: "Budi Rekaan", versi, terakhirDilihat: iso(60) });
    expect(periksaEkstensi([pc("1.205.39"), pc("1.205.39", "PC-2")], "1.205.39", KINI).warna).toBe("hijau");
    const lama = periksaEkstensi([pc("1.205.39"), pc("1.200.0", "PC-LAMA")], "1.205.39", KINI);
    expect(lama.warna).toBe("kuning");
    expect(lama.rincian.some((r) => r.label.includes("PC-LAMA"))).toBe(true);
    expect(periksaEkstensi([pc("")], "1.205.39", KINI).warna).toBe("kelabu");
    expect(periksaEkstensi([], "1.205.39", KINI).warna).toBe("kelabu");
    // PC yang tidak terlihat 30 hari tidak dihitung
    expect(periksaEkstensi([{ ...pc("1.0.0"), terakhirDilihat: iso(60 * 24 * 40) }], "1.205.39", KINI).warna).toBe("kelabu");
  });

  it("uji beban: informasi saja (tidak pernah merah)", () => {
    const u = (p95Ms: number, galatPersen: number) => ({ id: "x", dibuatAt: iso(60), perangkat: 100, profil: "campuran", durasiDetik: 60, p95Ms, galatPersen, kueriSippPerMenit: null, sambunganSippMaks: null, cpuMesinMaks: null, ramMesinMaksPersen: null });
    expect(periksaUjiBeban(null, KINI).warna).toBe("kelabu");
    expect(periksaUjiBeban(u(400, 0), KINI).warna).toBe("hijau");
    expect(periksaUjiBeban(u(9000, 20), KINI).warna).toBe("kuning");
  });
});

// ─── 4. Layanan ──────────────────────────────────────────────────────────────

function depsTiruan(ubah: Partial<DepsKesehatan> = {}): DepsKesehatan {
  return {
    kini: () => KINI,
    proses: { uptime: () => 7200, memoryUsage: () => ({ rss: 300 * 1048576, heapUsed: 1 }) },
    versiPortal: "2.41.0",
    versiEkstensiTerbaru: "1.205.39",
    botStatus: async () => ({ ok: true, data: { bot: { botEnabled: true }, whatsapp: { status: "connected", lastConnectedAt: iso(30) } } }),
    botKesehatan: async () => ({
      ok: true,
      data: {
        sambungan: [
          { kunci: "sipp_primary", nama: "SIPP", circuit: { keadaan: "tertutup", gagalBerturut: 0, gagalTerakhir: null, berhasilTerakhir: iso(1), pesanTerakhir: "" }, ping: { status: "berhasil", durasiMs: 12, galat: "" } },
          { kunci: "aps_badilag", nama: "ABT", circuit: null, ping: { status: "berhasil", durasiMs: 20, galat: "" } },
          { kunci: "antrian_sidang", nama: "Antrian sidang", circuit: null, ping: { status: "berhasil", durasiMs: 15, galat: "" } },
        ],
      },
    }),
    sumberDaya: async () => ({ ok: true, data: { ringkas: { server: { cpu: { persen: 20, warna: "hijau" }, ram: { persen: 55, warna: "hijau" }, disk: { persen: 61, warna: "hijau" } } } } }),
    jadwalEcourt: async () => ({ ok: true, data: { jadwal: { pengaturan: { aktif: true, jarakJam: 6 }, sedangJalan: false, terakhirSelesai: iso(90) } } }),
    keadaanCadangan: async () => ({ ok: true, data: { terakhir: { cadangan: { mulai: iso(400), selesai: iso(399), berhasil: true } } } }),
    ukuranDatabase: async () => 52_428_800,
    ...ubah,
  };
}

describe("layanan Pusat kesehatan", () => {
  let db: AletaDatabase;
  beforeAll(async () => {
    db = await dbBaru();
    const kini = KINI.toISOString();
    for (const r of ["hakim", "admin", "super-admin"]) await db.run(`INSERT INTO roles (id, name, description) VALUES (?, ?, '')`, [r, r]);
    await db.run(`INSERT INTO positions (id, name, unit_kerja, level_hierarchy, created_at, updated_at) VALUES ('pos-uji', 'Uji', 'Uji', 1, ?, ?)`, [kini, kini]);
    for (const [id, peran, wa] of [
      ["u-hakim", "hakim", "081200000001"],
      ["u-admin", "admin", "081200000002"],
      ["u-sa", "super-admin", "081200000003"],
      ["u-sa2", "super-admin", ""],
    ]) {
      await db.run(
        `INSERT INTO users (id, username, password_hash, name, email, whatsapp_number, role_id, position_id, created_at, updated_at) VALUES (?, ?, 'x', ?, ?, ?, ?, 'pos-uji', ?, ?)`,
        [id, id, `Nama ${id}`, `${id}@rekaan.test`, wa, peran, kini, kini]
      );
    }
    await db.run(
      `INSERT INTO aleta_perangkat (id, perangkat_id, user_id, nama_komputer, versi_ekstensi, pertama_dilihat, terakhir_dilihat, data_ekstensi_pada) VALUES ('p1', 'dev-1', 'u-hakim', 'PC-HAKIM', '1.200.0', ?, ?, ?)`,
      [iso(500), iso(5), iso(5)]
    );
    await db.run(
      `INSERT INTO aleta_perangkat (id, perangkat_id, user_id, nama_komputer, versi_ekstensi, pertama_dilihat, terakhir_dilihat, data_ekstensi_pada) VALUES ('p2', 'dev-2', 'u-admin', 'PC-ADMIN', '1.205.39', ?, ?, ?)`,
      [iso(500), iso(5), iso(5)]
    );
  }, 180000);
  afterAll(async () => db?.close());

  it("satu pemeriksaan penuh: 15 komponen, warna masuk akal, PC dengan ekstensi lama terdaftar kuning", async () => {
    const hasil = await jalankanPemeriksaan(db, { ping: true, deps: depsTiruan() });
    expect(hasil.komponen.map((k) => k.kunci)).toEqual(["portal", "basis-data", "bot", "whatsapp", "sipp", "abt", "antrian", "ecourt", "cadangan", "server", "kapasitas", "ekstensi", "galat", "uji-beban", "integritas", "putusan-dokumen"]);
    const w = Object.fromEntries(hasil.komponen.map((k) => [k.kunci, k.warna]));
    expect(w).toMatchObject({ portal: "hijau", "basis-data": "hijau", bot: "hijau", whatsapp: "hijau", sipp: "hijau", abt: "hijau", antrian: "hijau", ecourt: "hijau", cadangan: "hijau", server: "hijau", kapasitas: "kelabu", ekstensi: "kuning", galat: "hijau", "uji-beban": "kelabu", integritas: "kelabu" });
    // ekstensi kuning dan uji beban kelabu TIDAK menentukan warna keseluruhan
    expect(hasil.warna).toBe("hijau");
    expect(KOMPONEN_PENENTU.has("ekstensi")).toBe(false);
    expect(hasil.komponen.find((k) => k.kunci === "ekstensi")!.rincian.some((r) => r.label.includes("PC-HAKIM"))).toBe(true);
    expect(JSON.stringify(hasil)).not.toMatch(/password|token/i);
  });

  it("kapasitas penyimpanan merah (30 Okt): komponen merah dan warna keseluruhan ikut merah; dep yang macet = kelabu", async () => {
    const merah = await jalankanPemeriksaan(db, {
      deps: depsTiruan({ kapasitas: async () => ({ ok: true, data: { warna: "merah", ringkas: "Partisi /home terisi 95% (batas merah 90%).", rincian: [{ label: "Partisi data Docker", nilai: "95% (/home)" }] } }) }),
    });
    const k = merah.komponen.find((x) => x.kunci === "kapasitas")!;
    expect(k).toMatchObject({ warna: "merah", kelompok: "server" });
    expect(k.ringkas).toContain("/home");
    expect(merah.warna).toBe("merah");
    const macet = await jalankanPemeriksaan(db, { deps: depsTiruan({ kapasitas: () => new Promise(() => {}) }) });
    expect(macet.komponen.find((x) => x.kunci === "kapasitas")!.warna).toBe("kelabu");
    expect(macet.warna).toBe("hijau");
  }, 20000);

  it("komponen yang macet tidak menahan yang lain: bot mati = merah, WhatsApp/SIPP kelabu, keseluruhan merah", async () => {
    const hasil = await jalankanPemeriksaan(db, {
      deps: depsTiruan({
        botStatus: async () => ({ ok: false, error: "ECONNREFUSED" }),
        botKesehatan: async () => ({ ok: false, error: "ECONNREFUSED" }),
        jadwalEcourt: async () => ({ ok: false, error: "x" }),
        // tidak pernah selesai: harus dibatasi waktu
        sumberDaya: () => new Promise(() => {}),
      }),
    });
    const w = Object.fromEntries(hasil.komponen.map((k) => [k.kunci, k.warna]));
    expect(w).toMatchObject({ bot: "merah", whatsapp: "kelabu", sipp: "kelabu", ecourt: "kelabu", server: "kelabu", portal: "hijau", "basis-data": "hijau" });
    expect(hasil.warna).toBe("merah");
  }, 20000);

  it("saklar pemeriksaan berkala dan WhatsApp MATI bawaan; simpan dibersihkan; detak tanpa saklar tidak memeriksa apa pun", async () => {
    expect(await bacaPengaturanKesehatan(db)).toEqual({ berkala: false, wa: false, penerima: "admin", ulangJam: 6 });
    const botDipanggil = vi.fn();
    expect(await detakKesehatan(db, { deps: depsTiruan({ botStatus: async () => { botDipanggil(); return { ok: true, data: {} }; } }) })).toBeNull();
    expect(botDipanggil).not.toHaveBeenCalled();
    const baru = await simpanPengaturanKesehatan(db, { berkala: true, ulangJam: 999, penerima: "entah" });
    expect(baru).toEqual({ berkala: true, wa: false, penerima: "admin", ulangJam: 24 });
    await expect(simpanPengaturanKesehatan(db, "bukan objek")).rejects.toThrow();
    await simpanPengaturanKesehatan(db, { berkala: false });
    expect((await bacaPengaturanKesehatan(db)).berkala).toBe(false);
  });

  const hasilManual = (peta: Record<string, "hijau" | "kuning" | "merah" | "kelabu">): HasilKesehatan => ({
    diukurPada: KINI.toISOString(),
    warna: warnaTerburuk(Object.values(peta)),
    galat: null,
    ujiBeban: null,
    komponen: Object.entries(peta).map(([kunci, warna]) => ({ kunci, nama: `Komponen ${kunci}`, kelompok: "layanan" as const, warna, ringkas: `ringkas ${kunci}`, rincian: [], diukurPada: KINI.toISOString(), durasiMs: 1 })),
  });
  const pengaturanWa: PengaturanKesehatan = { berkala: true, wa: true, penerima: "admin", ulangJam: 6 };

  it("peringatan WhatsApp: baru MERAH pertama belum mengirim; kedua berturut-turut mengirim ke admin+super admin ber-nomor; berikutnya tidak berulang sebelum ulangJam; pulih sekali", async () => {
    await db.run("DELETE FROM aleta_kesehatan_status");
    const kirim = vi.fn(async (penerima: unknown[]) => ({ terkirim: penerima.length, gagal: 0 }));
    const jalan = (peta: Record<string, "hijau" | "kuning" | "merah" | "kelabu">, menit: number, pengaturan = pengaturanWa) =>
      perbaruiStatus(db, hasilManual(peta), { pengaturan, kirim, kini: new Date(KINI.getTime() + menit * 60_000) });

    let h = await jalan({ sipp: "merah", bot: "hijau" }, 0);
    expect(h.peringatan).toEqual([]);
    expect(kirim).not.toHaveBeenCalled();

    h = await jalan({ sipp: "merah", bot: "hijau" }, 1);
    expect(h.peringatan).toEqual(["sipp"]);
    expect(kirim).toHaveBeenCalledTimes(1);
    const [penerima, pesan] = kirim.mock.calls[0] as unknown as [Array<{ id: string }>, string];
    expect(penerima.map((p) => p.id).sort()).toEqual(["u-admin", "u-sa"]); // hakim bukan admin; u-sa2 tanpa nomor
    expect(pesan).toContain("MERAH: Komponen sipp");
    expect(pesan).not.toContain("bot");

    h = await jalan({ sipp: "merah", bot: "hijau" }, 5);
    expect(h.peringatan).toEqual([]);
    expect(kirim).toHaveBeenCalledTimes(1);

    h = await jalan({ sipp: "merah", bot: "hijau" }, 6 * 60 + 2);
    expect(h.peringatan).toEqual(["sipp"]);
    expect(kirim).toHaveBeenCalledTimes(2);

    h = await jalan({ sipp: "hijau", bot: "hijau" }, 6 * 60 + 3);
    expect(h.pulih).toEqual(["sipp"]);
    expect(kirim).toHaveBeenCalledTimes(3);
    h = await jalan({ sipp: "hijau", bot: "hijau" }, 6 * 60 + 4);
    expect(h.pulih).toEqual([]);
    expect(kirim).toHaveBeenCalledTimes(3);
  });

  it("kuning dan kelabu tidak pernah memperingatkan; komponen bukan penentu (ekstensi, uji beban) diabaikan; penerima super-admin saja", async () => {
    await db.run("DELETE FROM aleta_kesehatan_status");
    const kirim = vi.fn(async (penerima: unknown[]) => ({ terkirim: penerima.length, gagal: 0 }));
    for (let i = 0; i < 4; i += 1) {
      const h = await perbaruiStatus(db, hasilManual({ sipp: "kuning", whatsapp: "kelabu", ekstensi: "merah", "uji-beban": "merah" }), { pengaturan: pengaturanWa, kirim, kini: new Date(KINI.getTime() + i * 60_000) });
      expect(h.peringatan).toEqual([]);
    }
    expect(kirim).not.toHaveBeenCalled();

    for (let i = 0; i < 2; i += 1) {
      await perbaruiStatus(db, hasilManual({ cadangan: "merah" }), { pengaturan: { ...pengaturanWa, penerima: "super-admin" }, kirim, kini: new Date(KINI.getTime() + (10 + i) * 60_000) });
    }
    expect((kirim.mock.calls[0] as unknown as [Array<{ id: string }>])[0].map((p) => p.id)).toEqual(["u-sa"]);
  });

  it("saklar wa mati: status tetap diperbarui dan lonceng muncul, tetapi tidak ada pesan terkirim", async () => {
    await db.run("DELETE FROM aleta_kesehatan_status");
    const kirim = vi.fn();
    for (let i = 0; i < 3; i += 1) {
      const h = await perbaruiStatus(db, hasilManual({ abt: "merah" }), { pengaturan: { ...pengaturanWa, wa: false }, kirim, kini: new Date(KINI.getTime() + i * 60_000) });
      if (i >= 1) expect(h.dikirim).toBeNull();
    }
    expect(kirim).not.toHaveBeenCalled();
    const lonceng = await pemberitahuanKesehatan(db);
    expect(lonceng).toHaveLength(1);
    expect(lonceng[0]).toMatchObject({ id: "kesehatan:abt", judul: "Pusat kesehatan: ABT merah" });
    await perbaruiStatus(db, hasilManual({ abt: "hijau" }), { pengaturan: pengaturanWa, kirim, kini: new Date(KINI.getTime() + 10 * 60_000) });
    expect(await pemberitahuanKesehatan(db)).toEqual([]);
  });

  it("detak dengan saklar berkala menyala: memeriksa, mencatat riwayat, dan memperbarui status", async () => {
    await db.run("DELETE FROM aleta_kesehatan_status");
    await db.run("DELETE FROM aleta_kesehatan_riwayat");
    await simpanPengaturanKesehatan(db, { berkala: true, wa: false });
    const d = await detakKesehatan(db, { deps: depsTiruan({ botStatus: async () => ({ ok: false, error: "mati" }) }), kini: KINI });
    expect(d?.hasil.warna).toBe("merah");
    const r = await db.queryAll<{ warna: string }>("SELECT warna FROM aleta_kesehatan_riwayat");
    expect(r).toEqual([{ warna: "merah" }]);
    const st = await db.queryOne<{ warna: string; merah_berturut: number | string }>("SELECT warna, merah_berturut FROM aleta_kesehatan_status WHERE kunci = 'bot'");
    expect(st).toMatchObject({ warna: "merah" });
    expect(Number(st?.merah_berturut)).toBe(1);
    expect((await riwayatKesehatan(db, 24 * 365 * 10)).length).toBe(1);
    await simpanPengaturanKesehatan(db, { berkala: false });
  });
});

// ─── 5. Impor uji beban ──────────────────────────────────────────────────────

describe("impor hasil uji beban (E1 -> E2)", () => {
  let db: AletaDatabase;
  beforeAll(async () => {
    db = await dbBaru();
  }, 120000);
  afterAll(async () => db?.close());

  const sah = (ubah: Record<string, unknown> = {}) => ({
    versi: 1,
    dibuat: KINI.toISOString(),
    sasaran: "http://localhost:3000/aleta",
    profil: "campuran",
    perangkat: 100,
    durasiDetik: 120,
    total: { p95: 840.5, persenGalat: 0.4 },
    sumberDaya: { cpuMesinMaks: 71.2, ramMesinMaksPersen: 64 },
    sipp: { tersedia: true, kueriPerMenit: 3200, sambunganMaks: 9 },
    ...ubah,
  });

  it("hasil sah diterima, tampil sebagai yang terakhir, dan memberi ringkasan angka", async () => {
    const r = await imporUjiBeban(db, sah(), "Super Rekaan", KINI);
    expect(r).toMatchObject({ perangkat: 100, p95Ms: 840.5, galatPersen: 0.4, kueriSippPerMenit: 3200, sambunganSippMaks: 9, cpuMesinMaks: 71.2 });
    expect(await ujiBebanTerakhir(db)).toMatchObject({ id: r.id, perangkat: 100 });
  });

  it("sasaran bukan kembaran (server kantor, alamat produksi) ditolak; bentuk salah ditolak", async () => {
    await expect(imporUjiBeban(db, sah({ sasaran: "http://192.168.10.10/aleta" }), "x", KINI)).rejects.toThrow(/kembaran laptop/);
    await expect(imporUjiBeban(db, sah({ sasaran: "https://aleta.pa-rekaan.go.id" }), "x", KINI)).rejects.toThrow(/kembaran laptop/);
    await expect(imporUjiBeban(db, sah({ versi: 2 }), "x", KINI)).rejects.toThrow(/bukan hasil skrip/);
    await expect(imporUjiBeban(db, { acak: true }, "x", KINI)).rejects.toThrow(/bukan hasil skrip/);
    await expect(imporUjiBeban(db, null, "x", KINI)).rejects.toThrow(/bukan hasil skrip/);
    await expect(imporUjiBeban(db, sah({ perangkat: 0 }), "x", KINI)).rejects.toThrow();
  });

  it("tanpa data SIPP kembaran, kolom kueri/sambungan kosong (bukan 0)", async () => {
    const r = await imporUjiBeban(db, sah({ sipp: { tersedia: false } }), "x", new Date(KINI.getTime() + 1000));
    expect(r.kueriSippPerMenit).toBeNull();
    expect(r.sambunganSippMaks).toBeNull();
  });

  it("berkas keluaran skrip uji beban SUNGGUHAN (peladen tiruan 127.0.0.1) dapat diimpor", async () => {
    const http = await import("node:http");
    const peladen = http.createServer((_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, data: { available: true } }));
    });
    await new Promise<void>((selesai) => peladen.listen(0, "127.0.0.1", selesai));
    const port = (peladen.address() as { port: number }).port;
    const folder = mkdtempSync(path.join(os.tmpdir(), "uji-beban-impor-"));
    try {
      const kode = await ujiBebanUtama(
        ["--sasaran", `http://127.0.0.1:${port}/aleta`, "--perangkat", "8", "--durasi", "1", "--pemanasan", "0", "--skala-waktu", "0.01", "--keluaran", folder],
        { ALETA_UJI_KUKI: "sesi=rekaan" },
        { keluar: () => {} }
      );
      expect(kode).toBe(0);
      const berkas = readdirSync(folder).find((b) => b.endsWith(".json"))!;
      const hasil = JSON.parse(readFileSync(path.join(folder, berkas), "utf8"));
      const r = await imporUjiBeban(db, hasil, "Super Rekaan", new Date(KINI.getTime() + 2000));
      expect(r.perangkat).toBe(8);
      expect(r.p95Ms).toBeGreaterThanOrEqual(0);
    } finally {
      await new Promise<void>((selesai) => peladen.close(() => selesai()));
      rmSync(folder, { recursive: true, force: true });
    }
  }, 30000);
});

// ─── 6. Bot ──────────────────────────────────────────────────────────────────

describe("bot: kesehatanService", () => {
  const akar = path.resolve(process.cwd(), "..");
  const require_ = createRequire(path.join(akar, "aleta_bot/package.json"));
  const { susunKesehatan } = require_(path.join(akar, "aleta_bot/services/kesehatanService.js")) as {
    susunKesehatan: (o: Record<string, unknown>) => Promise<{ ok: boolean; bot: { uptimeDetik: number; memoriMB: number }; sambungan: Array<{ kunci: string; circuit: { keadaan: string; gagalBerturut: number } | null; ping: { status: string; galat: string } }> }>;
  };

  const breaker = {
    getStatus: () => ({
      circuits: [{ key: "sipp_primary", state: "terbuka", consecutiveFailures: 5, openedAt: iso(1), lastFailureAt: iso(1), lastSuccessAt: iso(10), lastErrorMessage: "ETIMEDOUT contoh", totalOpened: 1, totalRejected: 3 }],
    }),
  };
  const proses = { uptime: () => 3600.4, memoryUsage: () => ({ rss: 200 * 1048576 }), version: "v20.15.1" };

  it("tanpa ?ping: hanya membaca pemutus arus, tidak menyentuh basis data mana pun", async () => {
    const testConnection = vi.fn();
    const h = await susunKesehatan({ ping: false, deps: { externalDbService: { testConnection }, sippCircuitBreaker: breaker, proses, sekarang: () => KINI } });
    expect(testConnection).not.toHaveBeenCalled();
    expect(h.ok).toBe(true);
    expect(h.bot).toMatchObject({ uptimeDetik: 3600, memoriMB: 200 });
    expect(h.sambungan.map((s) => s.kunci)).toEqual(["sipp_primary", "aps_badilag", "antrian_sidang"]);
    expect(h.sambungan[0]).toMatchObject({ circuit: { keadaan: "terbuka", gagalBerturut: 5 }, ping: { status: "dilewati" } });
    expect(h.sambungan[1]!.circuit).toBeNull();
  });

  it("dengan ?ping: SELECT 1 per sambungan; yang gagal atau terlalu lama dilaporkan gagal tanpa menjatuhkan bacaan; tidak ada nama basis data/alamat", async () => {
    const testConnection = vi.fn(async (kunci: string) => {
      if (kunci === "aps_badilag") return { status: "failed", error: "ECONNREFUSED 10.1.1.1:3306 user=root", durationMs: 3 };
      if (kunci === "antrian_sidang") throw new Error("meledak");
      return { status: "success", durationMs: 9 };
    });
    const h = await susunKesehatan({ ping: true, deps: { externalDbService: { testConnection }, sippCircuitBreaker: breaker, proses, sekarang: () => KINI } });
    expect(testConnection).toHaveBeenCalledTimes(3);
    expect(h.sambungan.map((s) => s.ping.status)).toEqual(["berhasil", "gagal", "gagal"]);
    expect(h.sambungan[1]!.ping.galat.length).toBeLessThanOrEqual(160);
  });

  it("rute /kesehatan terpasang di internalGatewayRoutes (hanya GET, wajib token)", () => {
    const rute = readFileSync(path.join(akar, "aleta_bot/routes/internalGatewayRoutes.js"), "utf8");
    expect(rute).toMatch(/router\.get\("\/kesehatan", requireInternalToken/);
    expect(rute).not.toMatch(/router\.post\("\/kesehatan"/);
  });
});

// ─── 7. Rute ─────────────────────────────────────────────────────────────────

describe("rute: hak per peran dan penampung galat", () => {
  let db: AletaDatabase;
  const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(`http://localhost${url}`, init);
  const jawab = async (r: Response) => ({ status: r.status, isi: (await r.json().catch(() => null)) as { ok?: boolean; data?: Record<string, unknown>; error?: { message: string } } | null });

  beforeAll(async () => {
    db = await dbBaru();
    ctx.db = db;
    const kini = KINI.toISOString();
    for (const r of ["hakim", "admin", "super-admin"]) await db.run(`INSERT INTO roles (id, name, description) VALUES (?, ?, '')`, [r, r]);
    await db.run(`INSERT INTO positions (id, name, unit_kerja, level_hierarchy, created_at, updated_at) VALUES ('pos-uji', 'Uji', 'Uji', 1, ?, ?)`, [kini, kini]);
    for (const [id, peran] of [
      ["u-hakim", "hakim"],
      ["u-admin", "admin"],
      ["u-sa", "super-admin"],
    ]) {
      await db.run(
        `INSERT INTO users (id, username, password_hash, name, email, whatsapp_number, role_id, position_id, created_at, updated_at) VALUES (?, ?, 'x', ?, ?, '0', ?, 'pos-uji', ?, ?)`,
        [id, id, `Nama ${id}`, `${id}@rekaan.test`, peran, kini, kini]
      );
    }
    setelUlangPencatatGalat();
  }, 180000);
  afterAll(async () => {
    ctx.db = null;
    await db?.close();
  });

  it("matriks peran: lihat & kelola galat = Admin+Super Admin; atur & impor = Super Admin saja", () => {
    const persona = (roleId: string) => ({ id: roleId, roleId, additionalRoleIds: [], positionId: "pos-uji" }) as never;
    expect([bolehAksi(persona("hakim"), "kesehatan.lihat"), bolehAksi(persona("admin"), "kesehatan.lihat"), bolehAksi(persona("super-admin"), "kesehatan.lihat")]).toEqual([false, true, true]);
    expect([bolehAksi(persona("hakim"), "galat.kelola"), bolehAksi(persona("admin"), "galat.kelola"), bolehAksi(persona("super-admin"), "galat.kelola")]).toEqual([false, true, true]);
    expect([bolehAksi(persona("hakim"), "kesehatan.atur"), bolehAksi(persona("admin"), "kesehatan.atur"), bolehAksi(persona("super-admin"), "kesehatan.atur")]).toEqual([false, false, true]);
  });

  it("tanpa sesi 401; hakim 403 di semua rute admin", async () => {
    const { GET: kesehatan } = await import("@/app/api/admin/kesehatan/route");
    const { GET: galat } = await import("@/app/api/admin/catatan-galat/route");
    const { GET: uji } = await import("@/app/api/admin/uji-beban/route");
    for (const aktor of [null, "u-hakim"]) {
      ctx.aktor = aktor;
      const harap = aktor ? 403 : 401;
      expect((await kesehatan(req("/api/admin/kesehatan"))).status).toBe(harap);
      expect((await galat(req("/api/admin/catatan-galat"))).status).toBe(harap);
      expect((await uji(req("/api/admin/uji-beban"))).status).toBe(harap);
    }
  });

  it("admin boleh melihat dan menandai galat, tetapi tidak boleh mengatur saklar atau mengimpor uji beban; super admin boleh", async () => {
    const { POST: aturPost } = await import("@/app/api/admin/kesehatan/route");
    const { POST: imporPost } = await import("@/app/api/admin/uji-beban/route");
    const { GET: galatGet, POST: galatPost } = await import("@/app/api/admin/catatan-galat/route");
    const id = (await catatGalat(db, { sumber: "server", pesan: "Galat untuk rute" }, KINI))!;

    ctx.aktor = "u-admin";
    const lihat = await jawab(await galatGet(req("/api/admin/catatan-galat")));
    expect(lihat.status).toBe(200);
    expect((lihat.isi?.data?.galat as unknown[]).length).toBe(1);
    const rinci = await jawab(await galatGet(req(`/api/admin/catatan-galat?id=${id}`)));
    expect(rinci.isi?.data?.teks).toContain("Galat untuk rute");
    expect((await galatPost(req("/api/admin/catatan-galat", { method: "POST", body: JSON.stringify({ id, ditangani: true }) }))).status).toBe(200);
    expect((await daftarGalat(db))[0]!.status).toBe("ditangani");
    expect((await aturPost(req("/api/admin/kesehatan", { method: "POST", body: JSON.stringify({ berkala: true }) }))).status).toBe(403);
    expect((await imporPost(req("/api/admin/uji-beban", { method: "POST", body: JSON.stringify({}) }))).status).toBe(403);
    expect((await bacaPengaturanKesehatan(db)).berkala).toBe(false);

    ctx.aktor = "u-sa";
    const atur = await jawab(await aturPost(req("/api/admin/kesehatan", { method: "POST", body: JSON.stringify({ berkala: true, wa: false }) })));
    expect(atur.status).toBe(200);
    expect((await bacaPengaturanKesehatan(db)).berkala).toBe(true);
    const buruk = await jawab(await imporPost(req("/api/admin/uji-beban", { method: "POST", body: JSON.stringify({ versi: 1, sasaran: "http://192.168.10.10" }) })));
    expect(buruk.status).toBe(400);
    const audit = await db.queryAll<{ action: string }>("SELECT action FROM audit_logs WHERE action IN ('UPDATE_PENGATURAN_KESEHATAN', 'TANDAI_GALAT_DITANGANI')");
    expect(audit.map((a) => a.action).sort()).toEqual(["TANDAI_GALAT_DITANGANI", "UPDATE_PENGATURAN_KESEHATAN"]);
    await simpanPengaturanKesehatan(db, { berkala: false });
  });

  it("penampung galat peramban/ekstensi: butuh sesi, membersihkan isi, mengabaikan sumber 'server' dari klien, dan membatasi 20 per menit", async () => {
    const { POST } = await import("@/app/api/portal/galat/route");
    ctx.aktor = null;
    expect((await POST(req("/api/portal/galat", { method: "POST", body: JSON.stringify({ pesan: "x" }) }))).status).toBe(401);

    ctx.aktor = "u-hakim";
    setelUlangPencatatGalat();
    const kirim = (b: Record<string, unknown>) => POST(req("/api/portal/galat", { method: "POST", headers: { "user-agent": "Mozilla/5.0 Chrome/130" }, body: JSON.stringify(b) }));
    expect((await jawab(await kirim({ sumber: "server", pesan: "Klien menyamar sebagai server password=abc123", lokasi: "/aleta/x?token=zzz", halaman: "/aleta/x?token=zzz" }))).isi?.data).toEqual({ dicatat: true });
    const g = (await daftarGalat(db, { sumber: "peramban" })).find((x) => x.pesan.startsWith("Klien menyamar"))!;
    expect(g).toBeTruthy();
    expect(g.pesan).not.toContain("abc123");
    expect(g.lokasi).toBe("/aleta/x");
    expect((await daftarGalat(db, { sumber: "server" })).some((x) => x.pesan.startsWith("Klien menyamar"))).toBe(false);

    await kirim({ sumber: "ekstensi", jenis: "TypeError", pesan: "Latar ekstensi gagal", versi: "1.205.39" });
    expect((await daftarGalat(db, { sumber: "ekstensi" }))[0]).toMatchObject({ pesan: "Latar ekstensi gagal" });
    let tidakDicatat = 0;
    for (let i = 0; i < 30; i += 1) {
      const j = await jawab(await kirim({ pesan: `Banjir klien ${"abcdefghij"[i % 10]}${"klmnopqrst"[Math.floor(i / 10)]}` }));
      if (j.isi?.data?.dicatat === false) tidakDicatat += 1;
    }
    expect(tidakDicatat).toBeGreaterThanOrEqual(10);
  });

  it("GET kesehatan memberi hasil, pengaturan, dan tanda bolehAtur sesuai peran", async () => {
    vi.resetModules();
    const { GET } = await import("@/app/api/admin/kesehatan/route");
    ctx.aktor = "u-admin";
    const admin = await jawab(await GET(req("/api/admin/kesehatan?segarkan=1")));
    expect(admin.status).toBe(200);
    expect(admin.isi?.data?.bolehAtur).toBe(false);
    expect(Array.isArray((admin.isi?.data?.hasil as { komponen: unknown[] }).komponen)).toBe(true);
    ctx.aktor = "u-sa";
    const sa = await jawab(await GET(req("/api/admin/kesehatan?segarkan=1")));
    expect(sa.isi?.data?.bolehAtur).toBe(true);
    expect(sa.isi?.data?.pengaturan).toMatchObject({ berkala: false, wa: false });
  }, 60000);
});
