// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DAFTAR_FITUR_EKSTENSI } from "@/lib/daftar-fitur-ekstensi";
import { BLANGKO_RELAAS } from "@/lib/pohon-blangko";
import { bersihkanButir, bawaanPemetaan, normalkanKunci } from "@/lib/pemetaan-blangko";
import { PROFIL_BAWAAN, bersihkanSaklar, normalkanPeranProfil, peranProfil } from "@/lib/profil-saklar";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_PEMETAAN_PROFIL } from "@/server/db/schema";

/**
 * ============================================================================
 * MIGRASI 0054 + KONTRAK K3 (pemetaan blangko) + K4 (profil saklar per peran)
 * ============================================================================
 *
 *   (a) drizzle/0054_aleta_pemetaan_blangko_profil_saklar.sql + _journal.json;
 *   (b) DDL_PEMETAAN_PROFIL di schema.ts (pg-mem dan mode cadangan);
 *   (c) kedua tabel di IN_MEMORY_TABLE_PERSISTENCE_ORDER.
 * Lalu rute sungguhan atas pg-mem berbenih: bentuk jawaban persis kontrak,
 * 401 tanpa sesi, 403 bagi pegawai biasa, jejak audit.
 */

const AKAR = path.resolve(__dirname, "../..");
const TAG = "0054_aleta_pemetaan_blangko_profil_saklar";
const BERKAS_SQL = path.join(AKAR, "drizzle", TAG + ".sql");
const JURNAL = path.join(AKAR, "drizzle", "meta", "_journal.json");

function pernyataan(sql: string): string[] {
  return sql
    .split("\n")
    .map((baris) => baris.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

type Kolom = { table_name: string; column_name: string; data_type: string; is_nullable: string };
const KUERI_KOLOM = `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
  WHERE table_name IN ('aleta_pemetaan_blangko', 'aleta_profil_saklar') ORDER BY table_name, ordinal_position`;

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
const d = () => db as AletaDatabase;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-super";
});
afterEach(async () => {
  await db?.close();
  db = null;
});

describe("0054 - diklaim sekali, tiga tempat pendaftaran sebunyi", () => {
  it("idx 54 bertag 0054_aleta_pemetaan_blangko_profil_saklar tepat sekali, jurnal tanpa lubang", () => {
    const jurnal = JSON.parse(readFileSync(JURNAL, "utf8")) as { entries: { idx: number; tag: string }[] };
    jurnal.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(jurnal.entries.filter((e) => e.idx === 54)).toEqual([expect.objectContaining({ idx: 54, tag: TAG })]);
    expect(jurnal.entries.filter((e) => e.tag.startsWith("0054_"))).toHaveLength(1);
    expect(existsSync(BERKAS_SQL)).toBe(true);
  });

  it("DDL berkas = DDL schema.ts, pernyataan demi pernyataan", () => {
    const dariBerkas = pernyataan(readFileSync(BERKAS_SQL, "utf8"));
    const dariSkema = [...DDL_PEMETAAN_PROFIL.tabel, ...DDL_PEMETAAN_PROFIL.indeks].map((s) => pernyataan(s)[0]);
    expect(dariBerkas).toEqual(dariSkema);
    expect(dariBerkas).toHaveLength(2);
  });

  it("struktur yang terbentuk sama: berkas di pg-mem kosong lawan createAletaDatabase", async () => {
    const kosong = newDb();
    kosong.public.none(readFileSync(BERKAS_SQL, "utf8"));
    const dariBerkas = kosong.public.many(KUERI_KOLOM) as Kolom[];
    expect(await d().queryAll<Kolom>(KUERI_KOLOM)).toEqual(dariBerkas);
  });

  it("kedua tabel ikut cadangan JSON mode Postgres-mati", () => {
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_pemetaan_blangko");
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_profil_saklar");
  });

  it("jenis pemetaan hanya putusan/relaas/pbt; satu baris per (jenis, kunci)", async () => {
    const S =
      "INSERT INTO aleta_pemetaan_blangko (jenis, kunci, nama_berkas, diubah_oleh, diubah_pada) VALUES (?,?,?,?,?)";
    await d().run(S, ["relaas", "panggilan-tergugat", "x.rtf", "u", "2026-09-30"]);
    await expect(d().run(S, ["relaas", "panggilan-tergugat", "y.rtf", "u", "2026-09-30"])).rejects.toThrow();
    await expect(d().run(S, ["bas", "a", "y.rtf", "u", "2026-09-30"])).rejects.toThrow();
  });
});

// ============================================================================
type Hasil = { status: number; isi: { ok: boolean; data: Record<string, any>; error?: { message: string } } };

async function panggil(
  modul: "pemetaan" | "profil" | "tampilan",
  cara: "GET" | "PUT" | "DELETE",
  opsi: { query?: string; badan?: unknown } = {}
): Promise<Hasil> {
  const rute =
    modul === "pemetaan"
      ? await import("@/app/api/aleta-ecourt/pemetaan-blangko/route")
      : modul === "profil"
        ? await import("@/app/api/aleta-ecourt/profil-saklar/route")
        : await import("@/app/api/aleta-ecourt/ekstensi/tampilan/route");
  const req = new NextRequest("http://localhost/api/x" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const fungsi = (rute as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara];
  const jawaban = await fungsi(req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

describe("K3 - /api/aleta-ecourt/pemetaan-blangko", () => {
  it("tanpa sesi 401; pegawai biasa MEMBACA (200) tetapi tidak MENGUBAH (403)", async () => {
    aktor = null;
    expect((await panggil("pemetaan", "GET", { query: "jenis=relaas" })).status).toBe(401);
    aktor = "usr-jurusita";
    expect((await panggil("pemetaan", "GET", { query: "jenis=relaas" })).status).toBe(200);
    const t = await panggil("pemetaan", "PUT", { badan: { jenis: "relaas", butir: [{ kunci: "panggilan-tergugat", namaBerkas: "x.rtf" }] } });
    expect(t.status).toBe(403);
  });

  it("jenis tidak dikenal: 400", async () => {
    // Disesuaikan perbaikan 2 Okt sore (agen P, butir 6): "bas" kini jenis SAH
    // (tab Berita acara sidang). Jenis yang tetap tidak dikenal dipakai di sini;
    // penyimpanan BAS tanpa migrasi dijaga pemetaan-blangko-2okt.test.ts.
    expect((await panggil("pemetaan", "GET", { query: "jenis=sembarang" })).status).toBe(400);
  });

  it("GET relaas: bentuk K3 persis, dengan benih bawaan dari BLANGKO_RELAAS (permintaan agen E)", async () => {
    const r = await panggil("pemetaan", "GET", { query: "jenis=relaas" });
    expect(r.status).toBe(200);
    expect(r.isi.data.jenis).toBe("relaas");
    expect(r.isi.data.diubahPada).toBeNull();
    const butir = r.isi.data.butir as Record<string, unknown>[];
    for (const b of butir) {
      expect(Object.keys(b).sort()).toEqual(["catatan", "diubahOleh", "diubahPada", "kunci", "namaBerkas", "sebutan", "sumber"]);
    }
    const peta = Object.fromEntries(butir.map((b) => [b.kunci, b.namaBerkas]));
    const berkas = (k: string, pihak?: string) =>
      BLANGKO_RELAAS.find((b) => b.keadaan === k && (!pihak || b.pihak === pihak))!.berkas;
    // 6 Okt (butir 10): per pihak; gabungan hanya kunci tanpa pihak.
    expect(peta["panggilan-sidang-pertama"]).toBe(berkas("sidang-pertama", "keduanya"));
    expect(peta["panggilan-sidang-pertama"]).toBe("[JS] 3.b. Relaas Panggilan Sidang P dan T.rtf");
    expect(peta["relaas-panggilan-sidang-pertama-penggugat"]).toBe("[JS] 0. Relaas Panggilan Sidang Pertama P.rtf");
    expect(peta["relaas-panggilan-sidang-pertama-tergugat"]).toBe("[JS] 0. Relaas Panggilan Sidang Pertama T.rtf");
    expect(peta["panggilan-tergugat"]).toBe(berkas("sidang-ditunda", "kedua"));
    expect(peta["panggilan-termohon"]).toBe(berkas("sidang-ditunda", "kedua"));
    expect(peta["panggilan-penggugat"]).toBe(berkas("sidang-ditunda", "pertama"));
    expect(peta["panggilan-ikrar"]).toBe(berkas("ikrar-talak"));
    expect(butir.every((b) => b.sumber === "bawaan")).toBe(true);
  });

  it("GET pbt: per pihak, blangko Relaas Pemberitahuan Putusan", async () => {
    const r = await panggil("pemetaan", "GET", { query: "jenis=pbt" });
    const kunci = (r.isi.data.butir as { kunci: string; namaBerkas: string }[]).map((b) => b.kunci).sort();
    expect(kunci).toEqual(["pbt-pemohon", "pbt-penggugat", "pbt-tergugat", "pbt-termohon"]);
    const peta = Object.fromEntries((r.isi.data.butir as { kunci: string; namaBerkas: string }[]).map((b) => [b.kunci, b.namaBerkas]));
    expect(peta["pbt-penggugat"]).toBe("[JS] 2. Relaas Pemberitahuan Putusan P.rtf");
    expect(peta["pbt-pemohon"]).toBe("[JS] 2. Relaas Pemberitahuan Putusan P.rtf");
    expect(peta["pbt-tergugat"]).toBe("[JS] 2. Relaas Pemberitahuan Putusan T.rtf");
    expect(peta["pbt-termohon"]).toBe("[JS] 2. Relaas Pemberitahuan Putusan T.rtf");
  });

  it("GET putusan: HANYA yang diatur admin (kosong mula-mula) - bawaan ekstensi sebagai saran", async () => {
    const r = await panggil("pemetaan", "GET", { query: "jenis=putusan" });
    expect(r.isi.data.butir).toEqual([]);
    expect((r.isi.data.saran as { kunci: string }[]).map((s) => s.kunci)).toContain("Cerai Gugat");
  });

  it("PUT admin menyimpan, menimpa bawaan, menghapus lewat nama kosong, dan tercatat di audit", async () => {
    aktor = "usr-admin";
    const t = await panggil("pemetaan", "PUT", {
      badan: {
        jenis: "relaas",
        butir: [{ kunci: "Panggilan Tergugat", namaBerkas: "  [JS] Relaas T  khusus.rtf ", catatan: "uji" }],
      },
    });
    expect(t.status).toBe(200);
    const b = (t.isi.data.butir as Record<string, unknown>[]).find((x) => x.kunci === "panggilan-tergugat")!;
    // Spasi DALAM nama tetap (nama blangko ABT memuat spasi tak terlihat), tepinya dirapikan.
    expect(b).toMatchObject({ namaBerkas: "[JS] Relaas T  khusus.rtf", catatan: "uji", sumber: "admin", diubahOleh: "usr-admin" });
    expect(t.isi.data.diubahPada).toBeTruthy();

    const audit = await d().queryAll<{ action: string; entity_id: string }>(
      "SELECT action, entity_id FROM audit_logs WHERE action = 'UPDATE_ECOURT_BLANGKO_MAPPING'"
    );
    expect(audit).toEqual([expect.objectContaining({ entity_id: "relaas" })]);

    const h = await panggil("pemetaan", "PUT", { badan: { jenis: "relaas", butir: [{ kunci: "panggilan-tergugat", namaBerkas: "" }] } });
    const kembali = (h.isi.data.butir as Record<string, unknown>[]).find((x) => x.kunci === "panggilan-tergugat")!;
    expect(kembali.sumber).toBe("bawaan");
  });

  it("aturan murni: kunci relaas dinormalkan, butir bukan daftar ditolak", () => {
    expect(normalkanKunci("relaas", " Panggilan  Tergugat ")).toBe("panggilan-tergugat");
    expect(normalkanKunci("putusan", " Cerai  Gugat ")).toBe("Cerai Gugat");
    expect(() => bersihkanButir("relaas", "x")).toThrow();
    expect(bawaanPemetaan("putusan")).toEqual([]);
  });
});

describe("K4 - profil saklar per peran", () => {
  const K1 = DAFTAR_FITUR_EKSTENSI[0].kode;

  it("peran profil dibaca dari peran DAN posisi (PP & JS berperan 'staf' di data berbenih)", () => {
    expect(peranProfil({ roleId: "staf", positionId: "pos-panitera-pengganti" })).toBe("panitera-pengganti");
    expect(peranProfil({ roleId: "staf", positionId: "pos-jurusita" })).toBe("juru-sita");
    expect(peranProfil({ roleId: "staf", positionId: "pos-jurusita-pengganti" })).toBe("juru-sita");
    expect(peranProfil({ roleId: "hakim", positionId: "pos-hakim" })).toBe("hakim");
    expect(peranProfil({ roleId: "admin" })).toBe("admin");
    expect(peranProfil({ roleId: "panitera", positionId: "pos-panitera" })).toBe("panitera");
    expect(normalkanPeranProfil("jurusita")).toBe("juru-sita");
  });

  it("saklar tak dikenal / bukan boolean ditolak", () => {
    expect(() => bersihkanSaklar({ tandaiHalaman: "ya" })).toThrow();
    expect(() => bersihkanSaklar({ hapusSemua: true })).toThrow();
    expect(bersihkanSaklar({ sisipJadwal: false })).toEqual({ sisipJadwal: false });
  });

  it("GET /ekstensi/tampilan memuat profil persis K4 - hakim berbawaan, bukan admin", async () => {
    aktor = "usr-hakim";
    const r = await panggil("tampilan", "GET");
    expect(r.status).toBe(200);
    expect(r.isi.data.profil).toEqual({
      peran: "hakim",
      saklar: PROFIL_BAWAAN.hakim,
      fitur: null,
      sumber: "bawaan",
      bolehUbahProfil: false,
    });
    aktor = "usr-jurusita";
    expect((await panggil("tampilan", "GET")).isi.data.profil).toMatchObject({ peran: "juru-sita", sumber: "bawaan" });
    aktor = "usr-ppg";
    expect((await panggil("tampilan", "GET")).isi.data.profil).toMatchObject({
      peran: "panitera-pengganti",
      saklar: { cetakTigaBerkas: true },
    });
  });

  it("Super Admin & Admin: bolehUbahProfil true, tanpa saklar bawaan (tidak dibatasi)", async () => {
    for (const u of ["usr-super", "usr-admin"]) {
      aktor = u;
      const p = (await panggil("tampilan", "GET")).isi.data.profil;
      expect(p.bolehUbahProfil).toBe(true);
      expect(p.saklar).toBeNull();
    }
  });

  it("halaman admin: 401 tanpa sesi, 403 pegawai biasa, Admin boleh membaca & mengubah", async () => {
    aktor = null;
    expect((await panggil("profil", "GET")).status).toBe(401);
    aktor = "usr-hakim";
    expect((await panggil("profil", "GET")).status).toBe(403);
    expect((await panggil("profil", "PUT", { badan: { peran: "hakim", saklar: {} } })).status).toBe(403);
    aktor = "usr-admin";
    const r = await panggil("profil", "GET");
    expect(r.status).toBe(200);
    expect((r.isi.data.peran as { peran: string }[]).slice(0, 3).map((p) => p.peran)).toEqual([
      "hakim",
      "panitera-pengganti",
      "juru-sita",
    ]);
  });

  it("PUT profil peran -> ekstensi hakim mengikutinya, versinya bergeser, audit tercatat; DELETE kembali ke bawaan", async () => {
    aktor = "usr-hakim";
    const sebelum = (await panggil("tampilan", "GET")).isi.data.versi;

    aktor = "usr-admin";
    const t = await panggil("profil", "PUT", {
      badan: { peran: "hakim", saklar: { sisipJadwal: false, checklistMilestone: true }, fitur: { [K1]: true, "x-9": true } },
    });
    expect(t.status).toBe(200);
    expect(t.isi.data.fiturDibuang).toEqual(["x-9"]);

    aktor = "usr-hakim";
    const r = await panggil("tampilan", "GET");
    expect(r.isi.data.profil).toEqual({
      peran: "hakim",
      saklar: { sisipJadwal: false, checklistMilestone: true },
      fitur: { [K1]: true },
      sumber: "admin",
      bolehUbahProfil: false,
    });
    expect(r.isi.data.versi).not.toBe(sebelum);

    const audit = await d().queryAll<{ entity_id: string }>(
      "SELECT entity_id FROM audit_logs WHERE action = 'UPDATE_ECOURT_EXTENSION_SWITCH_PROFILE'"
    );
    expect(audit.map((a) => a.entity_id)).toEqual(["hakim"]);

    aktor = "usr-admin";
    expect((await panggil("profil", "DELETE", { query: "peran=hakim" })).status).toBe(200);
    aktor = "usr-hakim";
    expect((await panggil("tampilan", "GET")).isi.data.profil.sumber).toBe("bawaan");
  });

  it("PUT dengan saklar asing: 400, tidak ada yang tersimpan", async () => {
    aktor = "usr-admin";
    expect((await panggil("profil", "PUT", { badan: { peran: "hakim", saklar: { rusak: true } } })).status).toBe(400);
    expect(await d().queryAll("SELECT * FROM aleta_profil_saklar")).toEqual([]);
  });
});
