// @vitest-environment node
/**
 * ============================================================================
 * SELESAIKAN BERKAS (5 Nov 2026, Tahap 6) - SEMUA KERJA NYATA DIGANTI TIRUAN, DATA REKAAN
 * ============================================================================
 *   1. langkah yang menulis ke SIPP/e-Court TIDAK PERNAH dipanggil bila saklar mati (bawaan), atau bila saklarnya gagal dibaca;
 *   2. saklar menyala: tiap unggahan dipanggil tepat satu kali; PDF dibuat sekali per putaran;
 *   3. yang gagal saja yang diulang; yang selesai tidak dijalankan lagi;
 *   4. selain putusan tidak punya jalur unggah, walau saklar menyala;
 *   5. peringatan garis Z menahan unggahan; keadaan tersimpan hanya status dan pesan (tanpa PDF);
 *   6. penyimpanan (pg-mem), kunci "sedang berjalan", saklar bawaan mati dan pematian lewat lingkungan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  ID_LANGKAH,
  PESAN_DIMATIKAN,
  hitungStatus,
  jalankanSelesai,
  keadaanAwal,
  keadaanDariJson,
  type DepsSelesai,
  type HasilPdfSelesai,
  type IdLangkah,
  type JenisBerkasSelesai,
} from "@/lib/aleta-abt-selesai";
import { bacaKeadaanSelesai, bacaSaklarTulis, jalankanSelesaikanBerkas, simpanSaklarTulis } from "@/server/modules/aleta-abt-selesai/service";

const M = process.cwd();
const SQL_0133 = readFileSync(path.join(M, "drizzle/0133_aleta_abt_pustaka.sql"), "utf8");
const SQL_0137 = readFileSync(path.join(M, "drizzle/0137_aleta_abt_alur_berdampingan.sql"), "utf8");

function tiruan(opsi: { jenis?: JenisBerkasSelesai; saklar?: Partial<Record<"edoc-sipp" | "ecourt", boolean>> | "galat"; pdf?: Partial<HasilPdfSelesai> | "galat"; edoc?: "ok" | "tolak" | "galat"; ecourt?: "ok" | "tolak" | "galat" } = {}) {
  const panggil = { pdf: 0, edoc: 0, ecourt: 0, catat: 0, saklar: [] as string[] };
  const deps: DepsSelesai = {
    jenis: opsi.jenis ?? "putusan",
    bangunPdf: async () => {
      panggil.pdf += 1;
      if (opsi.pdf === "galat") throw new Error("LibreOffice tidak menjawab.");
      return { pdfBase64: "UERGLXJla2Fhbg==", ...(opsi.pdf ?? {}) };
    },
    unggahEdoc: async () => {
      panggil.edoc += 1;
      if (opsi.edoc === "galat") throw new Error("SIPP tidak terjangkau.");
      return opsi.edoc === "tolak" ? { ok: false, pesan: "Nomor perkara tidak cocok." } : { ok: true, pesan: "Terunggah ke e-Doc SIPP." };
    },
    unggahEcourt: async () => {
      panggil.ecourt += 1;
      if (opsi.ecourt === "galat") throw new Error("e-Court menolak sesi.");
      return opsi.ecourt === "tolak" ? { ok: false, pesan: "Sesi pribadi tidak ada." } : { ok: true, pesan: "Terunggah ke e-Court." };
    },
    catatStatus: async () => {
      panggil.catat += 1;
      return { ok: true, pesan: "Dicatat." };
    },
    saklar: async (l) => {
      panggil.saklar.push(l);
      if (opsi.saklar === "galat") throw new Error("saklar tak terbaca");
      return opsi.saklar?.[l] === true;
    },
    kini: () => "2026-11-05T10:00:00.000Z",
  };
  return { deps, panggil };
}

const status = (k: ReturnType<typeof keadaanAwal>) => Object.fromEntries(ID_LANGKAH.map((i) => [i, k.langkah[i].status]));

describe("saklar tulis ke luar mati (bawaan)", () => {
  it("PDF dan garis Z berjalan; e-Doc dan e-Court dimatikan dan TIDAK dipanggil; catatan menunggu", async () => {
    const { deps, panggil } = tiruan();
    const k = await jalankanSelesai(keadaanAwal(), deps);
    expect(status(k)).toEqual({ "pdf-salinan": "selesai", "garis-z-nomor": "tidak-berlaku", "edoc-sipp": "dimatikan", ecourt: "dimatikan", "status-perkara": "menunggu" });
    expect(panggil.edoc).toBe(0);
    expect(panggil.ecourt).toBe(0);
    expect(panggil.catat).toBe(0);
    expect(k.langkah["edoc-sipp"].pesan).toBe(PESAN_DIMATIKAN["edoc-sipp"]);
    expect(k.langkah.ecourt.pesan).toBe(PESAN_DIMATIKAN.ecourt);
    expect(k.status).toBe("sebagian");
  });
  it("saklar yang gagal dibaca dianggap mati, bukan menyala", async () => {
    const { deps, panggil } = tiruan({ saklar: "galat" });
    const k = await jalankanSelesai(keadaanAwal(), deps);
    expect(panggil.edoc + panggil.ecourt).toBe(0);
    expect(k.langkah["edoc-sipp"].status).toBe("dimatikan");
  });
  it("hanya satu saklar menyala: hanya langkah itu yang jalan", async () => {
    const { deps, panggil } = tiruan({ saklar: { ecourt: true } });
    const k = await jalankanSelesai(keadaanAwal(), deps);
    expect(panggil).toMatchObject({ edoc: 0, ecourt: 1 });
    expect(k.langkah["edoc-sipp"].status).toBe("dimatikan");
    expect(k.langkah.ecourt.status).toBe("selesai");
    expect(k.langkah["status-perkara"].status).toBe("menunggu");
  });
});

describe("saklar menyala (uji dengan tiruan)", () => {
  it("semua langkah selesai; tiap unggahan satu kali; PDF dibuat satu kali dalam satu putaran", async () => {
    const { deps, panggil } = tiruan({ saklar: { "edoc-sipp": true, ecourt: true } });
    const k = await jalankanSelesai(keadaanAwal(), deps);
    expect(k.status).toBe("selesai");
    expect(panggil).toMatchObject({ pdf: 1, edoc: 1, ecourt: 1, catat: 1 });
  });
  it("jalankan ulang sesudah selesai tidak memanggil apa pun lagi", async () => {
    const { deps, panggil } = tiruan({ saklar: { "edoc-sipp": true, ecourt: true } });
    const k = await jalankanSelesai(keadaanAwal(), deps);
    const n = JSON.stringify(panggil);
    const k2 = await jalankanSelesai(k, deps);
    expect(JSON.stringify(panggil)).toBe(n);
    expect(k2.status).toBe("selesai");
  });
});

describe("yang gagal saja yang diulang", () => {
  it("e-Court gagal: langkah sesudahnya menunggu; ulangi memanggil e-Court saja (e-Doc tidak diunggah dua kali)", async () => {
    const a = tiruan({ saklar: { "edoc-sipp": true, ecourt: true }, ecourt: "galat" });
    const k = await jalankanSelesai(keadaanAwal(), a.deps);
    expect(status(k)).toMatchObject({ "edoc-sipp": "selesai", ecourt: "gagal", "status-perkara": "menunggu" });
    expect(k.langkah.ecourt.pesan).toContain("e-Court menolak sesi");
    expect(k.status).toBe("gagal");
    expect(a.panggil.catat).toBe(0);

    const b = tiruan({ saklar: { "edoc-sipp": true, ecourt: true } });
    const k2 = await jalankanSelesai(k, b.deps);
    expect(b.panggil).toMatchObject({ edoc: 0, ecourt: 1, catat: 1 });
    expect(b.panggil.pdf).toBe(1); // dibuat ulang untuk unggahan; langkah 1 tidak diubah
    expect(k2.status).toBe("selesai");
    expect(k2.langkah["pdf-salinan"].percobaan).toBe(1);
    expect(k2.langkah.ecourt.percobaan).toBe(2);
  });
  it("ulangi satu langkah yang sudah selesai mengosongkannya dan menjalankannya lagi", async () => {
    const a = tiruan({ saklar: { "edoc-sipp": true, ecourt: true } });
    const k = await jalankanSelesai(keadaanAwal(), a.deps);
    const b = tiruan({ saklar: { "edoc-sipp": true, ecourt: true } });
    await jalankanSelesai(k, b.deps, { ulangi: ["edoc-sipp"] });
    expect(b.panggil).toMatchObject({ edoc: 1, ecourt: 0 });
  });
  it("ditolak (bukan galat jaringan) juga dicatat gagal dengan alasannya", async () => {
    const { deps } = tiruan({ saklar: { "edoc-sipp": true, ecourt: true }, edoc: "tolak" });
    const k = await jalankanSelesai(keadaanAwal(), deps);
    expect(k.langkah["edoc-sipp"]).toMatchObject({ status: "gagal", pesan: "Nomor perkara tidak cocok." });
    expect(k.langkah.ecourt.status).toBe("menunggu");
  });
});

describe("jenis selain putusan", () => {
  it("tidak punya jalur unggah: dimatikan dengan alasan walau saklar menyala; unggahan tidak dipanggil", async () => {
    for (const jenis of ["bas", "penetapan", "relaas"] as const) {
      const { deps, panggil } = tiruan({ jenis, saklar: { "edoc-sipp": true, ecourt: true } });
      const k = await jalankanSelesai(keadaanAwal(), deps);
      expect(panggil.edoc + panggil.ecourt, jenis).toBe(0);
      expect(k.langkah["edoc-sipp"]).toMatchObject({ status: "dimatikan", pesan: "Belum ada jalur unggah untuk jenis berkas ini." });
    }
  });
  it("BAS dengan garis Z terpasang: langkah garis Z selesai dan menyebut halamannya", async () => {
    const { deps } = tiruan({ jenis: "bas", pdf: { zcross: { diubah: true, halamanZ: 3, peringatan: [] } } });
    const k = await jalankanSelesai(keadaanAwal(), deps);
    expect(k.langkah["garis-z-nomor"]).toMatchObject({ status: "selesai" });
    expect(k.langkah["garis-z-nomor"].pesan).toContain("halaman 3");
  });
});

describe("kegagalan lebih awal menahan yang berikutnya", () => {
  it("peringatan garis Z: langkah gagal, unggahan tidak dipanggil", async () => {
    const { deps, panggil } = tiruan({ jenis: "bas", saklar: { "edoc-sipp": true, ecourt: true }, pdf: { zcross: { diubah: true, peringatan: ["Garis Z tidak muat di halaman terakhir."] } } });
    const k = await jalankanSelesai(keadaanAwal(), deps);
    expect(k.langkah["garis-z-nomor"].status).toBe("gagal");
    expect(k.langkah["garis-z-nomor"].pesan).toContain("Garis Z tidak muat");
    expect(panggil.edoc + panggil.ecourt).toBe(0);
    expect(k.langkah["edoc-sipp"].status).toBe("menunggu");
  });
  it("PDF gagal dibuat: semua langkah lain menunggu dan tak ada yang ditulis ke luar", async () => {
    const { deps, panggil } = tiruan({ saklar: { "edoc-sipp": true, ecourt: true }, pdf: "galat" });
    const k = await jalankanSelesai(keadaanAwal(), deps);
    expect(status(k)).toEqual({ "pdf-salinan": "gagal", "garis-z-nomor": "menunggu", "edoc-sipp": "menunggu", ecourt: "menunggu", "status-perkara": "menunggu" });
    expect(panggil.edoc + panggil.ecourt + panggil.catat).toBe(0);
    expect(panggil.saklar).toEqual([]);
  });
});

describe("keadaan tersimpan", () => {
  it("hanya status dan pesan: tidak memuat PDF", async () => {
    const { deps } = tiruan({ saklar: { "edoc-sipp": true, ecourt: true } });
    const tersimpan: string[] = [];
    await jalankanSelesai(keadaanAwal(), { ...deps, simpan: async (k) => void tersimpan.push(JSON.stringify(k)) });
    expect(tersimpan.length).toBeGreaterThan(5);
    for (const t of tersimpan) expect(t).not.toContain("UERGLXJla2Fhbg");
  });
  it("JSON rusak atau kurang dilengkapi dengan menunggu; status dihitung ulang", () => {
    expect(keadaanDariJson("bukan json")).toEqual(keadaanAwal());
    const k = keadaanDariJson({ langkah: { "pdf-salinan": { status: "selesai", pesan: "x".repeat(999) }, ecourt: { status: "ngawur" } } });
    expect(k.langkah["pdf-salinan"].status).toBe("selesai");
    expect(k.langkah["pdf-salinan"].pesan.length).toBe(240);
    expect(k.langkah.ecourt.status).toBe("menunggu");
    expect(k.status).toBe("sebagian");
    expect(hitungStatus(keadaanAwal())).toBe("menunggu");
  });
});

// ─── layanan + pg-mem ───────────────────────────────────────────────────────────────────────────────────────────
async function siapkan() {
  const mem = newDb();
  mem.public.none(SQL_0133);
  mem.public.none(SQL_0137);
  mem.public.none("CREATE TABLE IF NOT EXISTS aleta_ekstensi_setelan (pengguna_id TEXT NOT NULL, kunci TEXT NOT NULL, nilai TEXT NOT NULL, diubah_pada TEXT NOT NULL, PRIMARY KEY (pengguna_id, kunci))");
  const { Client } = mem.adapters.createPg();
  const c = new Client();
  await c.connect();
  const ubah = (q: string) => {
    let n = 0;
    return q.replace(/\?/g, () => `$${++n}`);
  };
  const db = {
    queryAll: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows,
    queryOne: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows[0] ?? null,
    run: async (q: string, p: unknown[] = []) => {
      await c.query(ubah(q), p);
    },
  };
  return { db: db as never, dbUji: db, baca: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows as Array<Record<string, unknown>> };
}

const PERMINTAAN = { perkaraId: "123", berkasId: "abt-b1", jenis: "putusan" as const, nomorPerkara: "1/Pdt.G/2026/PA.Uji", sidangKe: 0, ulangi: [] as IdLangkah[] };
const req = () => new NextRequest("http://localhost/api/aleta-abt/selesai", { method: "POST" });

describe("layanan", () => {
  it("saklar bawaan mati dan dapat dimatikan paksa lewat lingkungan", async () => {
    const { db } = await siapkan();
    expect(await bacaSaklarTulis(db, {})).toMatchObject({ "edoc-sipp": false, ecourt: false });
    await simpanSaklarTulis(db, { id: "u1", name: "Derry" }, { "edoc-sipp": true, ecourt: true });
    expect(await bacaSaklarTulis(db, {})).toMatchObject({ "edoc-sipp": true, ecourt: true, diubahOleh: "Derry" });
    expect(await bacaSaklarTulis(db, { ALETA_ABT_SELESAI_TULIS: "0" })).toMatchObject({ "edoc-sipp": false, ecourt: false });
  });

  it("jalan dengan saklar bawaan: kabel unggahan tidak dipakai, keadaan tersimpan tanpa PDF", async () => {
    const { db, baca } = await siapkan();
    const kabel = { edoc: 0, ecourt: 0 };
    const h = await jalankanSelesaikanBerkas(db, req(), PERMINTAAN, "Derry", {
      bangunPdf: async () => ({ pdfBase64: "UERGLXJla2Fhbg==" }),
      unggahEdoc: async () => (kabel.edoc++, { ok: true, pesan: "" }),
      unggahEcourt: async () => (kabel.ecourt++, { ok: true, pesan: "" }),
    });
    expect(kabel).toEqual({ edoc: 0, ecourt: 0 });
    expect(h.keadaan.langkah["edoc-sipp"].status).toBe("dimatikan");
    const baris = await baca("SELECT * FROM aleta_abt_selesai");
    expect(baris).toHaveLength(1);
    expect(String(baris[0].langkah)).not.toContain("UERGLXJla2Fhbg");
    expect(baris[0]).toMatchObject({ perkara_id: "123", berkas_id: "abt-b1", status: "sebagian", oleh: "Derry" });
    const k = await bacaKeadaanSelesai(db, "123", "abt-b1");
    expect(k.ada).toBe(true);
    expect(k.keadaan.langkah["pdf-salinan"].status).toBe("selesai");
  });

  it("dua kali jalan: baris tetap satu, yang selesai tidak diulang", async () => {
    const { db, baca } = await siapkan();
    let pdf = 0;
    const kabel = { bangunPdf: async () => (pdf++, { pdfBase64: "x" }), saklar: async () => false };
    await jalankanSelesaikanBerkas(db, req(), PERMINTAAN, "Derry", kabel);
    expect(pdf).toBe(1);
    await jalankanSelesaikanBerkas(db, req(), PERMINTAAN, "Derry", kabel);
    expect(pdf).toBe(1); // PDF tidak dibuat ulang: langkah 1-2 tuntas, e-Doc/e-Court dimatikan sebelum membutuhkannya
    expect(await baca("SELECT id FROM aleta_abt_selesai")).toHaveLength(1);
  });

  it("yang tampak sedang berjalan (kurang dari sepuluh menit) ditolak 409; yang macet dilanjutkan", async () => {
    const { db, dbUji } = await siapkan();
    const jalan = keadaanAwal();
    jalan.langkah["pdf-salinan"] = { status: "jalan", pesan: "", percobaan: 1, mulai: "2026-11-05T09:58:00.000Z", selesai: "" };
    await dbUji.run(
      "INSERT INTO aleta_abt_selesai (id, perkara_id, berkas_id, jenis_berkas, langkah, status, oleh, dibuat_at, diubah_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["123|abt-b1", "123", "abt-b1", "putusan", JSON.stringify(jalan), "jalan", "x", "t", "t"]
    );
    const kabel = { bangunPdf: async () => ({ pdfBase64: "x" }), saklar: async () => false, kini: () => "2026-11-05T10:00:00.000Z" };
    await expect(jalankanSelesaikanBerkas(db, req(), PERMINTAAN, "Derry", kabel)).rejects.toMatchObject({ status: 409 });
    const h = await jalankanSelesaikanBerkas(db, req(), PERMINTAAN, "Derry", { ...kabel, kini: () => "2026-11-05T10:30:00.000Z" });
    expect(h.keadaan.langkah["pdf-salinan"].status).toBe("selesai");
  });
});
