// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { newDb } from "pg-mem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { masukLewatSipp } from "@/lib/masuk-sipp-klien";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER } from "@/server/db/client";
import { DDL_MASUK_JEJAK } from "@/server/db/schema";
import {
  BATAS_SIPP,
  kosongkanBatasMasukSipp,
  putuskanMasukSipp,
  type BarisJejakMasuk,
  type DepsMasukSipp,
  type JawabanVerifikasiSipp,
} from "@/server/modules/portal/masuk-sipp";
import { catatJejakMasuk, samarkanIdentitas } from "@/server/modules/portal/masuk-sipp-plugin";

import { ASAL, Dunia, jawaban, minta, nyalakan } from "./dunia-latar";

/**
 * ============================================================================
 * MASUK ALETA DENGAN AKUN SIPP + ISI OTOMATIS SIPP & ABT (7 Okt 2026)
 * ============================================================================
 *
 * Rencana: D:/aleta-dev/kerja/masuk-satu-akun-sipp/RENCANA.md. Yang dijaga:
 *
 *   1. sidik password SIPP = arr2md5() PHP SIPP (vektor dari PHP sungguhan);
 *   2. keputusan masuk: SIPP cocok / password ALETA / akun SIPP nonaktif /
 *      akun tanpa SIPP tetap jalur lama / bot mati / batas percobaan;
 *   3. password tidak pernah muncul di jejak, audit, jawaban, maupun log;
 *   4. migrasi 0058: diklaim sekali, DDL berkas = DDL schema.ts;
 *   5. ekstensi: titipan HANYA di chrome.storage.session, hanya diberikan ke
 *      halaman masuk SIPP/ABT yang dikenal, tidak berputar;
 *   6. isi otomatis di halaman: hanya pada blangko masuk SIPP/ABT, tidak di
 *      halaman yang memperlihatkan penolakan.
 *
 * Seluruh password di sini PALSU - tidak ada sandi siapa pun yang dipakai.
 */

const SANDI = "Sandi-Palsu-Uji-7Okt!";
const SANDI_ALETA = "Aleta-Palsu-Uji-123";
const AKAR_REPO = path.resolve(process.cwd(), "..");
const AKAR_EKSTENSI = path.join(AKAR_REPO, "ekstensi-sipp");
const baca = (berkas: string) => readFileSync(berkas, "utf8").replace(/\r\n/g, "\n");

// ============================================================================
// 1. SIDIK PASSWORD SIPP
// ============================================================================
describe("sidik password SIPP sama dengan arr2md5() PHP SIPP", () => {
  const muat = createRequire(import.meta.url);
  const sidik = muat(path.join(AKAR_REPO, "aleta_bot", "utils", "sidikSandiSipp.js")) as {
    sidikSandiSipp: (kode: unknown, sandi: unknown) => string;
    akunSippDiblokir: (nilai: unknown) => boolean;
    akunSippKedaluwarsa: (nilai: unknown, sekarang?: number) => boolean;
  };

  // [kode_aktivasi, password, keluaran PHP]. Empat pertama dari PHP 5.6 di server
  // (aleta_bot/scripts/verify-sidik-sandi.js); yang terakhir dari PHP XAMPP
  // setempat atas fungsi arr2md5 yang disalin dari validation_user.php
  // (berkas server dan setempat identik menurut md5sum, 7 Okt 2026).
  const VEKTOR: Array<[string | null, string, string]> = [
    ["KODEAKTIF123", "rahasia", "2810c67ab2b67f4e9d351010f1014f3a"],
    ["", "sandi-tanpa-kode", "fff873524d7cd3a64ea771d71e03de1f"],
    [null, "sandi-tanpa-kode", "fff873524d7cd3a64ea771d71e03de1f"],
    ["9f8e7d6c5b4a3928", "P@ssw0rd!#$%", "c817605a77c0e2cb7a1d9a7ad3fdbd5e"],
    ["Kode-Uji-ALETA", "Sandi Palsu 123", "f7014fe9275b1f91bf0d968a61a13fca"],
  ];

  it.each(VEKTOR)("kode %s", (kode, sandi, php) => {
    expect(sidik.sidikSandiSipp(kode, sandi)).toBe(php);
  });

  it("password yang beda satu huruf menghasilkan sidik lain (tidak cocok)", () => {
    expect(sidik.sidikSandiSipp("KODEAKTIF123", "rahasiA")).not.toBe("2810c67ab2b67f4e9d351010f1014f3a");
    expect(sidik.sidikSandiSipp("KODEAKTIF124", "rahasia")).not.toBe("2810c67ab2b67f4e9d351010f1014f3a");
  });

  it("block dan user_expired dibaca seperti SIPP", () => {
    expect(sidik.akunSippDiblokir(0)).toBe(false);
    expect(sidik.akunSippDiblokir("0")).toBe(false);
    expect(sidik.akunSippDiblokir(null)).toBe(false);
    expect(sidik.akunSippDiblokir(1)).toBe(true);
    expect(sidik.akunSippDiblokir("1")).toBe(true);
    const kini = Date.parse("2026-10-07T08:00:00");
    expect(sidik.akunSippKedaluwarsa(null, kini)).toBe(false);
    expect(sidik.akunSippKedaluwarsa("", kini)).toBe(false);
    expect(sidik.akunSippKedaluwarsa("2026-10-06 23:59:59", kini)).toBe(true);
    expect(sidik.akunSippKedaluwarsa("2027-01-01 00:00:00", kini)).toBe(false);
    expect(sidik.akunSippKedaluwarsa(new Date("2020-01-01T00:00:00"), kini)).toBe(true);
    expect(sidik.akunSippKedaluwarsa("0000-00-00 00:00:00", kini)).toBe(true);
  });

  it("operasi jembatan bot memakai sidik itu dan ikut membaca user_expired, tanpa memulangkan sidik", () => {
    const layanan = baca(path.join(AKAR_REPO, "aleta_bot", "services", "sippReadOnlyBridgeService.js"));
    expect(layanan).toContain('require("../utils/sidikSandiSipp")');
    expect(layanan).toContain('columnExpr("u", cols, ["user_expired"], "NULL")');
    const fungsi = layanan.slice(layanan.indexOf("async function verifikasiSandiPengguna"));
    const kembali = fungsi.slice(fungsi.indexOf("return {\n    ditemukan: true,"), fungsi.indexOf("\n}\n"));
    expect(kembali).toContain("kedaluwarsa,");
    expect(kembali).not.toMatch(/sandi_tersimpan|kode_aktivasi|tersimpan,/);
  });
});

// ============================================================================
// 2-3. KEPUTUSAN MASUK
// ============================================================================

type Panggilan = { verifikasiSipp: number; verifikasiSandiAleta: number };

function siapkan(
  opsi: {
    pengguna?: { id: string; roleId: string } | null;
    milik?: string[];
    sipp?: JawabanVerifikasiSipp;
    sandiAletaBenar?: string;
  } = {}
) {
  const jejak: BarisJejakMasuk[] = [];
  const panggilan: Panggilan = { verifikasiSipp: 0, verifikasiSandiAleta: 0 };
  const deps: DepsMasukSipp = {
    cariPengguna: async () => (opsi.pengguna === undefined ? { id: "usr-pp", roleId: "panitera-pengganti" } : opsi.pengguna),
    akunSippMilik: async () => opsi.milik ?? ["pp.budi"],
    verifikasiSipp: async (_u, sandi) => {
      panggilan.verifikasiSipp += 1;
      if (opsi.sipp) return opsi.sipp;
      return { ok: true, data: { ditemukan: true, cocok: sandi === SANDI, diblokir: false, kedaluwarsa: false, sippUserId: "77" } };
    },
    verifikasiSandiAleta: async (_id, sandi) => {
      panggilan.verifikasiSandiAleta += 1;
      return sandi === (opsi.sandiAletaBenar ?? SANDI_ALETA);
    },
    catatJejak: async (b) => {
      jejak.push(JSON.parse(JSON.stringify(b)));
    },
  };
  return { deps, jejak, panggilan };
}

let nomorIp = 0;
const konteksBaru = () => {
  nomorIp += 1;
  return { headers: new Headers({ "x-forwarded-for": `10.77.${Math.floor(nomorIp / 250)}.${nomorIp % 250}`, "user-agent": "Uji" }) };
};
let nomorIdentitas = 0;
const identitasBaru = () => `petugas${(nomorIdentitas += 1)}`;
const ENV_NYALA = {} as Record<string, string | undefined>;

describe("keputusan masuk ALETA dengan akun SIPP", () => {
  let catatanKonsol: string[] = [];
  beforeEach(() => {
    kosongkanBatasMasukSipp();
    catatanKonsol = [];
    for (const nama of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, nama).mockImplementation((...a: unknown[]) => {
        catatanKonsol.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
      });
    }
  });
  afterEach(() => {
    vi.restoreAllMocks();
    // Password tidak pernah masuk log, apa pun hasilnya.
    expect(catatanKonsol.join("\n")).not.toContain(SANDI);
    expect(catatanKonsol.join("\n")).not.toContain(SANDI_ALETA);
  });

  it("password SIPP cocok: masuk lewat SIPP, jejak berhasil tanpa password", async () => {
    const { deps, jejak, panggilan } = siapkan();
    const hasil = await putuskanMasukSipp(deps, { identitas: identitasBaru(), sandi: `  ${SANDI}  ` }, konteksBaru(), ENV_NYALA);
    expect(hasil).toEqual({ jenis: "masuk", userId: "usr-pp", lewat: "sipp", usernameSipp: "pp.budi", catatan: "" });
    expect(panggilan.verifikasiSandiAleta).toBe(0);
    expect(jejak).toHaveLength(1);
    expect(jejak[0]).toMatchObject({ aletaUserId: "usr-pp", usernameSipp: "pp.budi", sippUserId: "77", lewat: "sipp", hasil: "berhasil" });
    expect(JSON.stringify(jejak)).not.toContain(SANDI);
    expect(JSON.stringify(hasil)).not.toContain(SANDI);
  });

  it("password SIPP salah tetapi password ALETA benar: tetap masuk (fitur lama), lewat ALETA", async () => {
    const { deps, jejak } = siapkan();
    const hasil = await putuskanMasukSipp(deps, { identitas: identitasBaru(), sandi: SANDI_ALETA }, konteksBaru(), ENV_NYALA);
    expect(hasil).toMatchObject({ jenis: "masuk", lewat: "aleta" });
    expect(jejak[0]).toMatchObject({ lewat: "aleta", hasil: "berhasil", alasan: "sandi_aleta" });
    expect(JSON.stringify(jejak)).not.toContain(SANDI_ALETA);
  });

  it("keduanya salah: ditolak 401, jejak ditolak", async () => {
    const { deps, jejak } = siapkan();
    const hasil = await putuskanMasukSipp(deps, { identitas: identitasBaru(), sandi: "bukan-keduanya" }, konteksBaru(), ENV_NYALA);
    expect(hasil).toMatchObject({ jenis: "tolak", status: 401, kode: "SANDI_SALAH" });
    expect(jejak[0]).toMatchObject({ hasil: "ditolak", alasan: "sandi_salah", lewat: "" });
    expect(JSON.stringify(jejak)).not.toContain("bukan-keduanya");
  });

  it("akun SIPP diblokir: ditolak 403 walaupun password SIPP maupun ALETA benar", async () => {
    for (const sandi of [SANDI, SANDI_ALETA]) {
      const { deps, jejak } = siapkan({
        sipp: { ok: true, data: { ditemukan: true, cocok: sandi === SANDI, diblokir: true, kedaluwarsa: false, sippUserId: "77" } },
      });
      const hasil = await putuskanMasukSipp(deps, { identitas: identitasBaru(), sandi }, konteksBaru(), ENV_NYALA);
      expect(hasil).toMatchObject({ jenis: "tolak", status: 403, kode: "SIPP_NONAKTIF" });
      expect((hasil as { pesan: string }).pesan).toContain("diblokir");
      expect(jejak[0]).toMatchObject({ hasil: "ditolak", alasan: "sipp_diblokir" });
    }
  });

  it("akun SIPP kedaluwarsa: ditolak 403", async () => {
    const { deps } = siapkan({
      sipp: { ok: true, data: { ditemukan: true, cocok: true, diblokir: false, kedaluwarsa: true } },
    });
    const hasil = await putuskanMasukSipp(deps, { identitas: identitasBaru(), sandi: SANDI }, konteksBaru(), ENV_NYALA);
    expect(hasil).toMatchObject({ jenis: "tolak", status: 403 });
    expect((hasil as { pesan: string }).pesan).toContain("Masa berlaku");
  });

  it("Super Admin dengan akun SIPP nonaktif tetap dapat masuk dengan password ALETA (tidak terkunci)", async () => {
    const { deps, jejak } = siapkan({
      pengguna: { id: "usr-super", roleId: "super-admin" },
      sipp: { ok: true, data: { ditemukan: true, cocok: false, diblokir: true } },
    });
    const hasil = await putuskanMasukSipp(deps, { identitas: identitasBaru(), sandi: SANDI_ALETA }, konteksBaru(), ENV_NYALA);
    expect(hasil).toMatchObject({ jenis: "masuk", lewat: "aleta", userId: "usr-super" });
    expect(jejak[0].alasan).toBe("sipp_diblokir_super_admin");
  });

  it("akun ALETA tanpa tautan SIPP: bukan-sipp, tidak ada password yang diperiksa (jalur lama berlaku)", async () => {
    const { deps, jejak, panggilan } = siapkan({ milik: [] });
    const hasil = await putuskanMasukSipp(deps, { identitas: identitasBaru(), sandi: SANDI }, konteksBaru(), ENV_NYALA);
    expect(hasil).toEqual({ jenis: "bukan-sipp", sebab: "tanpa-tautan" });
    expect(panggilan).toEqual({ verifikasiSipp: 0, verifikasiSandiAleta: 0 });
    expect(jejak).toEqual([]);
  });

  it("identitas tidak dikenal: bukan-sipp (jalur lama yang menyebut tidak ditemukan)", async () => {
    const { deps, panggilan } = siapkan({ pengguna: null });
    expect(await putuskanMasukSipp(deps, { identitas: identitasBaru(), sandi: SANDI }, konteksBaru(), ENV_NYALA)).toEqual({
      jenis: "bukan-sipp",
      sebab: "tidak-ditemukan",
    });
    expect(panggilan.verifikasiSipp).toBe(0);
  });

  it("dimatikan lewat ALETA_MASUK_SIPP=0: bukan-sipp untuk semua akun", async () => {
    const { deps, panggilan } = siapkan();
    const hasil = await putuskanMasukSipp(deps, { identitas: identitasBaru(), sandi: SANDI }, konteksBaru(), { ALETA_MASUK_SIPP: "0" });
    expect(hasil).toEqual({ jenis: "bukan-sipp", sebab: "dimatikan" });
    expect(panggilan.verifikasiSipp).toBe(0);
  });

  it("bot/SIPP tidak terjangkau: password ALETA tetap berlaku; password lain ditolak tanpa menuduh SIPP", async () => {
    const mati: JawabanVerifikasiSipp = { ok: false, error: "ALETA Bot bridge tidak merespons." };
    const a = siapkan({ sipp: mati });
    expect(await putuskanMasukSipp(a.deps, { identitas: identitasBaru(), sandi: SANDI_ALETA }, konteksBaru(), ENV_NYALA)).toMatchObject({
      jenis: "masuk",
      lewat: "aleta",
    });
    expect(a.jejak[0].alasan).toBe("sipp_tak_terjangkau");
    const b = siapkan({ sipp: mati });
    const tolak = await putuskanMasukSipp(b.deps, { identitas: identitasBaru(), sandi: SANDI }, konteksBaru(), ENV_NYALA);
    expect(tolak).toMatchObject({ jenis: "tolak", status: 401 });
    expect((tolak as { pesan: string }).pesan).toContain("SIPP belum dapat dihubungi");
  });

  it("batas percobaan per alamat+identitas: percobaan ke-6 ditolak 429 TANPA bertanya ke SIPP", async () => {
    const { deps, panggilan, jejak } = siapkan();
    const identitas = identitasBaru();
    const konteks = konteksBaru();
    for (let i = 0; i < 5; i += 1) {
      expect(await putuskanMasukSipp(deps, { identitas, sandi: `salah-${i}` }, konteks, ENV_NYALA)).toMatchObject({ status: 401 });
    }
    const sebelum = panggilan.verifikasiSipp;
    expect(await putuskanMasukSipp(deps, { identitas, sandi: SANDI }, konteks, ENV_NYALA)).toMatchObject({ jenis: "tolak", status: 429 });
    expect(panggilan.verifikasiSipp).toBe(sebelum);
    expect(jejak.at(-1)).toMatchObject({ hasil: "dibatasi" });
  });

  it(`batas per username SIPP dari alamat mana pun: sesudah ${BATAS_SIPP.maksGagal} salah, berhenti bertanya ke SIPP`, async () => {
    const { deps, panggilan } = siapkan();
    for (let i = 0; i < BATAS_SIPP.maksGagal; i += 1) {
      await putuskanMasukSipp(deps, { identitas: identitasBaru(), sandi: `salah-${i}` }, konteksBaru(), ENV_NYALA);
    }
    const sebelum = panggilan.verifikasiSipp;
    const hasil = await putuskanMasukSipp(deps, { identitas: identitasBaru(), sandi: SANDI }, konteksBaru(), ENV_NYALA);
    expect(hasil).toMatchObject({ jenis: "tolak", status: 429 });
    expect(panggilan.verifikasiSipp).toBe(sebelum);
  });

  it("masuk yang berhasil menghapus hitungan salah sebelumnya", async () => {
    const { deps } = siapkan();
    const identitas = identitasBaru();
    const konteks = konteksBaru();
    for (let i = 0; i < 4; i += 1) await putuskanMasukSipp(deps, { identitas, sandi: "x" }, konteks, ENV_NYALA);
    expect(await putuskanMasukSipp(deps, { identitas, sandi: SANDI }, konteks, ENV_NYALA)).toMatchObject({ jenis: "masuk" });
    for (let i = 0; i < 4; i += 1) {
      expect(await putuskanMasukSipp(deps, { identitas, sandi: "x" }, konteks, ENV_NYALA)).toMatchObject({ status: 401 });
    }
  });
});

// ============================================================================
// 3b. JEJAK DI BASIS DATA - aleta_masuk_jejak dan audit_logs, tanpa password
// ============================================================================
describe("jejak masuk tertulis ke aleta_masuk_jejak dan audit_logs tanpa password", () => {
  function dbPgMem() {
    const pg = newDb();
    pg.public.none(readFileSync(path.join(process.cwd(), "drizzle", "0058_aleta_masuk_jejak.sql"), "utf8"));
    pg.public.none(
      "CREATE TABLE audit_logs (id TEXT PRIMARY KEY, actor_user_id TEXT, action TEXT, entity_type TEXT, entity_id TEXT, payload_json TEXT, created_at TEXT)"
    );
    const literal = (v: unknown) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
    const db = {
      prepare: (sql: string) => ({
        run: async (...nilai: unknown[]) => {
          let i = 0;
          pg.public.none(sql.replace(/\?/g, () => literal(nilai[i++])));
        },
      }),
    };
    return { pg, db: db as never };
  }

  it("baris berhasil + baris ditolak; identitas disamarkan; tidak ada password di tabel mana pun", async () => {
    const { pg, db } = dbPgMem();
    const dasar = { identitas: "pp.budi.santoso", usernameSipp: "pp.budi", sippUserId: "77", alamatIp: "10.0.0.5", agenPeramban: "Uji" };
    await catatJejakMasuk(db, { ...dasar, aletaUserId: "usr-pp", lewat: "sipp", hasil: "berhasil", alasan: "sandi_sipp_cocok" });
    await catatJejakMasuk(db, { ...dasar, aletaUserId: "usr-pp", lewat: "", hasil: "ditolak", alasan: "sandi_salah" });
    const jejak = pg.public.many("SELECT * FROM aleta_masuk_jejak ORDER BY hasil");
    expect(jejak).toHaveLength(2);
    expect(jejak.map((b) => b.identitas)).toEqual(["pp***", "pp***"]);
    const audit = pg.public.many("SELECT action, payload_json FROM audit_logs ORDER BY action");
    expect(audit.map((a) => a.action)).toEqual(["LOGIN_FAILED", "LOGIN_SUCCESS"]);
    const semua = JSON.stringify([jejak, audit]);
    expect(semua).not.toContain(SANDI);
    expect(Object.keys(jejak[0]).some((k) => /sandi|password|hash/i.test(k))).toBe(false);
    expect(samarkanIdentitas("")).toBe("");
  });

  it("CHECK menolak hasil di luar berhasil/ditolak/dibatasi", () => {
    const { pg } = dbPgMem();
    expect(() =>
      pg.public.none("INSERT INTO aleta_masuk_jejak (id, hasil, dibuat_pada) VALUES ('x', 'menebak', '2026-10-07')")
    ).toThrow();
  });
});

// ============================================================================
// 4. MIGRASI 0058
// ============================================================================
describe("0058 - jejak masuk: diklaim sekali, tiga tempat pendaftaran", () => {
  const TAG = "0058_aleta_masuk_jejak";
  const SQL = path.join(process.cwd(), "drizzle", `${TAG}.sql`);
  const pernyataan = (sql: string) =>
    sql
      .split("\n")
      .map((b) => b.replace(/--.*$/, ""))
      .join("\n")
      .split(";")
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);

  it("tag 0058 tepat sekali di jurnal, jurnal tanpa lubang, berkasnya ada", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0058_"))).toEqual([expect.objectContaining({ tag: TAG })]);
    // "when" naik: drizzle melewati migrasi yang lebih tua dari yang terakhir dijalankan.
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
    expect(existsSync(SQL)).toBe(true);
  });

  it("DDL berkas = DDL schema.ts; tabel ikut cadangan; pg-mem kosong membangunnya", () => {
    const dariBerkas = pernyataan(readFileSync(SQL, "utf8"));
    const dariSkema = [...DDL_MASUK_JEJAK.tabel, ...DDL_MASUK_JEJAK.indeks].map((s) => pernyataan(s)[0]);
    expect(dariBerkas).toEqual(dariSkema);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_masuk_jejak");
    const kosong = newDb();
    kosong.public.none(readFileSync(SQL, "utf8"));
    expect(kosong.public.many("SELECT * FROM aleta_masuk_jejak")).toEqual([]);
  });
});

// ============================================================================
// 2b. SISI PERAMBAN - masukLewatSipp tidak pernah mengurangi jalur lama
// ============================================================================
describe("layar masuk: jalur SIPP dulu, jalur lama bila bukan akun SIPP", () => {
  const jawab = (status: number, isi: unknown) =>
    (async () => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

  it("masuk lewat SIPP", async () => {
    expect(
      await masukLewatSipp("a", "b", true, jawab(200, { ok: true, jenis: "masuk", lewat: "sipp", usernameSipp: "pp.budi", catatan: "" }))
    ).toEqual({ jenis: "masuk", lewat: "sipp", usernameSipp: "pp.budi", catatan: "" });
  });

  it("bukan-sipp, server lama (404), gangguan (5xx), jaringan putus = jalur lama", async () => {
    expect(await masukLewatSipp("a", "b", true, jawab(200, { ok: true, jenis: "bukan-sipp" }))).toEqual({ jenis: "bukan-sipp" });
    expect(await masukLewatSipp("a", "b", true, jawab(404, { message: "Not Found" }))).toEqual({ jenis: "bukan-sipp" });
    expect(await masukLewatSipp("a", "b", true, jawab(500, { message: "x" }))).toEqual({ jenis: "bukan-sipp" });
    const putus = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await masukLewatSipp("a", "b", true, putus)).toEqual({ jenis: "bukan-sipp" });
  });

  it("penolakan 401/403/429 disampaikan dengan kalimat server", async () => {
    expect(await masukLewatSipp("a", "b", true, jawab(403, { message: "Akun SIPP Anda sedang diblokir", code: "SIPP_NONAKTIF" }))).toEqual({
      jenis: "tolak",
      status: 403,
      pesan: "Akun SIPP Anda sedang diblokir",
    });
  });

  it("layar masuk: password dititipkan HANYA bila lewat SIPP, dan jalur lama tetap utuh", () => {
    const layar = baca(path.join(process.cwd(), "src", "app", "login", "page.tsx"));
    expect(layar).toContain('sipp.jenis === "masuk" && sipp.lewat === "sipp" && isiOtomatisSipp');
    expect(layar).toContain('if (sipp.jenis === "bukan-sipp") {');
    expect(layar).toContain("authClient.signIn.email({");
    expect(layar).toContain("/api/users/lookup?identifier=");
    // Tidak ada penyimpanan password di peramban oleh portal.
    expect(layar).not.toMatch(/localStorage\.setItem\([^)]*(password|sandi)/i);
    const klien = baca(path.join(process.cwd(), "src", "lib", "masuk-sipp-klien.ts"));
    expect(klien).not.toMatch(/(localStorage|sessionStorage)\.setItem\([^)]*sandi/);
  });
});

// ============================================================================
// 5. PEKERJA LATAR - titipan hanya di chrome.storage.session
// ============================================================================
describe("latar.js: titipan password hanya di chrome.storage.session", () => {
  const PORTAL = { url: `${ASAL}/aleta/login`, origin: ASAL, id: undefined, frameId: 0 };
  const SIPP_MASUK = { url: `${ASAL}/SIPP/index.php/login`, origin: ASAL, frameId: 0 };
  const ABT_MASUK = { url: `${ASAL}/aps_badilag/login`, origin: ASAL, frameId: 0 };
  const buatDunia = () => new Dunia(() => jawaban(404, "", ""));

  async function titip(dunia: Dunia, pekerja: ReturnType<typeof nyalakan>) {
    return minta(dunia, pekerja, { jenis: "masuk-titip", username: "pp.budi", sandi: SANDI }, PORTAL);
  }

  it("titip dari portal: tersimpan di session, TIDAK di local, jawabannya tanpa password", async () => {
    const dunia = buatDunia();
    const pekerja = nyalakan(dunia);
    const j = await titip(dunia, pekerja);
    expect(j).toEqual({ ok: true });
    expect(dunia.sesi.aletaMasukSipp).toMatchObject({ username: "pp.budi", sandi: SANDI, asal: ASAL });
    expect(JSON.stringify(dunia.lokal)).not.toContain(SANDI);
  });

  it("tanpa chrome.storage.session titipan DITOLAK, bukan jatuh ke local", async () => {
    const dunia = buatDunia();
    const pekerja = nyalakan(dunia);
    delete pekerja.konteks.chrome.storage.session;
    const j = await titip(dunia, pekerja);
    expect(j.ok).toBe(false);
    expect(JSON.stringify(dunia.lokal)).not.toContain(SANDI);
  });

  it("selamat dari matinya pekerja: pekerja baru tetap memberikannya ke halaman masuk SIPP", async () => {
    const dunia = buatDunia();
    await titip(dunia, nyalakan(dunia));
    for (const p of [...dunia.pekerjaHidup]) dunia.pekerjaHidup.delete(p);
    const baru = nyalakan(dunia);
    expect(await minta(dunia, baru, { jenis: "masuk-minta", halaman: "sipp" }, SIPP_MASUK)).toEqual({
      ok: true,
      username: "pp.budi",
      sandi: SANDI,
    });
  });

  it("hanya halaman masuk SIPP/ABT yang dikenal, pada asal portal penitip, dengan jenis yang sesuai", async () => {
    const dunia = buatDunia();
    const pekerja = nyalakan(dunia);
    await titip(dunia, pekerja);
    const tolak = [
      [{ halaman: "sipp" }, { url: `${ASAL}/aleta/portal`, frameId: 0 }],
      [{ halaman: "sipp" }, { url: `${ASAL}/lain/index.php/login`, frameId: 0 }],
      [{ halaman: "sipp" }, { url: "http://192.168.99.9/SIPP/index.php/login", frameId: 0 }],
      [{ halaman: "abt" }, SIPP_MASUK],
      [{ halaman: "sipp" }, { ...SIPP_MASUK, frameId: 3 }],
    ] as const;
    for (const [isi, pengirim] of tolak) {
      const j = await minta(dunia, pekerja, { jenis: "masuk-minta", ...isi }, pengirim);
      expect(j.ok, JSON.stringify(pengirim)).toBe(false);
      expect(JSON.stringify(j)).not.toContain(SANDI);
    }
    expect(await minta(dunia, pekerja, { jenis: "masuk-minta", halaman: "abt" }, ABT_MASUK)).toMatchObject({ ok: true, sandi: SANDI });
  });

  it("halaman SIPP tidak boleh menitipkan atau menghapus titipan", async () => {
    const dunia = buatDunia();
    const pekerja = nyalakan(dunia);
    expect((await minta(dunia, pekerja, { jenis: "masuk-titip", username: "x", sandi: "y" }, SIPP_MASUK)).ok).toBe(false);
    expect(dunia.sesi.aletaMasukSipp).toBeUndefined();
  });

  it("tidak berputar: satu isi per menit per jenis, dan penolakan menahannya sampai titipan baru", async () => {
    const dunia = buatDunia();
    const pekerja = nyalakan(dunia);
    await titip(dunia, pekerja);
    expect((await minta(dunia, pekerja, { jenis: "masuk-minta", halaman: "sipp" }, SIPP_MASUK)).ok).toBe(true);
    expect(await minta(dunia, pekerja, { jenis: "masuk-minta", halaman: "sipp" }, SIPP_MASUK)).toEqual({ ok: false, sebab: "jeda" });
    dunia.jam += 61_000;
    expect((await minta(dunia, pekerja, { jenis: "masuk-minta", halaman: "sipp" }, SIPP_MASUK)).ok).toBe(true);
    dunia.jam += 61_000;
    await minta(dunia, pekerja, { jenis: "masuk-gagal", halaman: "sipp" }, { ...SIPP_MASUK, url: `${ASAL}/SIPP/index.php/login/index/ERR` });
    expect(await minta(dunia, pekerja, { jenis: "masuk-minta", halaman: "sipp" }, SIPP_MASUK)).toEqual({
      ok: false,
      sebab: "ditahan sesudah penolakan",
    });
    // ABT tidak ikut tertahan oleh penolakan SIPP.
    expect((await minta(dunia, pekerja, { jenis: "masuk-minta", halaman: "abt" }, ABT_MASUK)).ok).toBe(true);
    // Masuk ALETA lagi = titipan baru = penahanan dicabut.
    await titip(dunia, pekerja);
    expect((await minta(dunia, pekerja, { jenis: "masuk-minta", halaman: "sipp" }, SIPP_MASUK)).ok).toBe(true);
  });

  it("kedaluwarsa sesudah 12 jam, dan keluar ALETA menghapusnya", async () => {
    const dunia = buatDunia();
    const pekerja = nyalakan(dunia);
    await titip(dunia, pekerja);
    dunia.jam += 12 * 60 * 60 * 1000 + 1;
    expect(await minta(dunia, pekerja, { jenis: "masuk-minta", halaman: "sipp" }, SIPP_MASUK)).toEqual({
      ok: false,
      sebab: "titipan kedaluwarsa",
    });
    expect(dunia.sesi.aletaMasukSipp).toBeUndefined();
    await titip(dunia, pekerja);
    expect(await minta(dunia, pekerja, { jenis: "masuk-lupakan" }, PORTAL)).toEqual({ ok: true });
    expect(dunia.sesi.aletaMasukSipp).toBeUndefined();
  });

  // Kode saja - komentarnya memang menyebut storage.local untuk melarangnya.
  function tanpaKomentar(teks: string) {
    return teks
      .split("\n")
      .filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b))
      .map((b) => b.replace(/\/\/.*$/, ""))
      .join("\n");
  }
  const PENANDA_PERAN = "/* === POPUP-PERAN 12 Okt === */";

  it("kode latar.js: tidak ada jalan titipan ke chrome.storage.local", () => {
    const latar = baca(path.join(AKAR_EKSTENSI, "latar.js"));
    // Dari KUNCI_MASUK_TITIPAN sampai awal blok POPUP-PERAN 12 Okt. Blok itu (setelan per
    // akun, catatan pembaruan) memang memakai storage.local, tidak menyentuh titipan, dan
    // dijaga sendiri pada uji berikutnya - jadi bukan lagi "sisa berkas" yang disisir di sini.
    const awal = latar.indexOf("const KUNCI_MASUK_TITIPAN");
    const akhir = latar.indexOf(PENANDA_PERAN);
    expect(awal).toBeGreaterThan(-1);
    expect(akhir).toBeGreaterThan(awal);
    const kode = tanpaKomentar(latar.slice(awal, akhir));
    expect(kode).toContain("chrome.storage.session");
    expect(kode).not.toContain("storage.local");
  });

  it("latar.js blok POPUP-PERAN 12 Okt: storage.local hanya memuat setelan, identitas tanpa sandi, dan catatan pembaruan", () => {
    const latar = baca(path.join(AKAR_EKSTENSI, "latar.js"));
    const awal = latar.indexOf(PENANDA_PERAN);
    const akhir = latar.indexOf("/* === AKHIR POPUP-PERAN === */");
    expect(awal).toBeGreaterThan(-1);
    expect(akhir).toBeGreaterThan(awal);
    const kode = tanpaKomentar(latar.slice(awal, akhir));
    // Tidak menyebut kunci titipan, username/sandi, ataupun kuki.
    expect(kode).not.toMatch(/KUNCI_MASUK|aletaMasukSipp|titipan|sandi|password|\bcookie|\.cookies\b/i);
    // Setiap tulisan storage.local hanya ke kunci yang dikenal.
    const tulisan = kode.match(/chrome\.storage\.local\.set\([^;]*\);/g) || [];
    expect(tulisan.length).toBeGreaterThan(0);
    for (const t of tulisan) {
      expect(t).toMatch(/\[k\]|KUNCI_PEMBARUAN_OTOMATIS|KUNCI_PEMBARU\b|KUNCI_MENUNGGU_LATAR|KUNCI_PERALIHAN_LATAR/); // KUNCI_PEMBARU = catatan pembaru otomatis (23 Okt 2026), bukan setelan
    }
    // Daftar kunci setelan per akun tertutup dan tanpa kunci rahasia.
    const mulaiDaftar = kode.indexOf("const KUNCI_SETELAN_AKUN");
    const daftar = kode.slice(mulaiDaftar, kode.indexOf("];", mulaiDaftar));
    expect(daftar.length).toBeGreaterThan(50);
    expect(daftar).not.toMatch(/sandi|password|token|kuki|rahasia|titip/i);
  });
});

// ============================================================================
// 5b. JEMBATAN aleta.js - password tidak pernah pulang ke halaman
// ============================================================================
describe("jembatan aleta.js meneruskan titipan, jawabannya tanpa password", () => {
  const SUMBER_ALETA = readFileSync(path.join(AKAR_EKSTENSI, "aleta.js"), "utf8");
  const terbuka: JSDOM[] = [];
  afterEach(() => {
    while (terbuka.length) terbuka.pop()!.window.close();
  });

  function buka(jawabLatar: (pesan: any) => unknown) {
    const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
      url: `${ASAL}/aleta/login`,
      runScripts: "outside-only",
    });
    terbuka.push(dom);
    const w = dom.window as any;
    const kiriman: any[] = [];
    w.postMessage = (data: unknown) => kiriman.push(data);
    const diteruskan: any[] = [];
    w.chrome = {
      runtime: {
        id: "aleta-uji",
        lastError: undefined,
        getManifest: () => ({ version: "9.9.9" }),
        getURL: (p: string) => `chrome-extension://aleta-uji/${p}`,
        sendMessage: (pesan: any, balik: (x?: unknown) => void) => {
          diteruskan.push(JSON.parse(JSON.stringify(pesan)));
          balik(jawabLatar(pesan));
        },
      },
      storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener: () => {} } },
    };
    w.alatCatatAsalPortal = () => {};
    w.alatAmbil = async () => ({ status: 401, ok: false, json: async () => ({}) });
    w.alatHalamanPublikPortal = () => false;
    w.eval(SUMBER_ALETA);
    const kirim = (data: unknown) => w.dispatchEvent(new w.MessageEvent("message", { data, origin: ASAL, source: w }));
    return { w, kiriman, diteruskan, kirim };
  }

  it("menandai <html> dan meneruskan username + password apa adanya ke latar", () => {
    const { w, kiriman, diteruskan, kirim } = buka(() => ({ ok: true, sandi: SANDI, username: "bocor" }));
    expect(w.document.documentElement.dataset.aletaMasukSipp).toBe("1");
    kirim({ sumber: "aleta-portal", jenis: "masuk-titip", idPesan: "m1", muatan: { username: "pp.budi", sandi: SANDI, lain: "x" } });
    expect(diteruskan).toEqual([{ sumber: "aleta-panel", jenis: "masuk-titip", username: "pp.budi", sandi: SANDI }]);
    const balasan = kiriman.filter((k) => k && k.balasan === "m1");
    expect(balasan).toHaveLength(1);
    // Latar (seandainya) memulangkan password - jembatan memerasnya.
    expect(JSON.stringify(balasan)).not.toContain(SANDI);
    expect(balasan[0].jawaban.ok).toBe(true);
  });

  it("muatan yang tidak sah tidak diteruskan", () => {
    const { diteruskan, kirim } = buka(() => ({ ok: true }));
    kirim({ sumber: "aleta-portal", jenis: "masuk-titip", idPesan: "m2", muatan: { username: "", sandi: SANDI } });
    kirim({ sumber: "aleta-portal", jenis: "masuk-titip", idPesan: "m3", muatan: { username: "a", sandi: "x".repeat(201) } });
    kirim({ sumber: "aleta-portal", jenis: "masuk-minta", idPesan: "m4", muatan: {} });
    expect(diteruskan).toEqual([]);
  });
});

// ============================================================================
// 6. ISI OTOMATIS DI HALAMAN - panel-alat.js sungguhan di jsdom
// ============================================================================
describe("panel-alat.js mengisi halaman masuk SIPP/ABT yang dikenal saja", () => {
  const SUMBER_ALAT = readFileSync(path.join(AKAR_EKSTENSI, "panel-alat.js"), "utf8");
  const terbuka: JSDOM[] = [];
  afterEach(() => {
    while (terbuka.length) terbuka.pop()!.window.close();
  });

  const BLANGKO_SIPP =
    `<form name="login" id="login_frm" method="post" action="${ASAL}/SIPP/index.php/login/validation_credential">` +
    `<input class="login" name="username"><input type="password" class="login" name="password">` +
    `<input type="submit" class="tombol7" value="Login"></form>`;
  const BLANGKO_ABT =
    `<form action="${ASAL}/aps_badilag/login/signin" method="post">` +
    `<input type="text" name="userName" required><input type="password" name="password" required>` +
    `<button class="btn btn-primary submit-btn btn-block">Login</button></form>`;

  async function buka(alamat: string, badan: string, jawabLatar: (p: any) => unknown = () => ({ ok: true, username: "pp.budi", sandi: SANDI })) {
    const dom = new JSDOM(`<!doctype html><html><head></head><body>${badan}</body></html>`, {
      url: alamat,
      runScripts: "outside-only",
      pretendToBeVisual: true,
    } as ConstructorParameters<typeof JSDOM>[1]);
    terbuka.push(dom);
    const w = dom.window as any;
    const pesan: any[] = [];
    const dikirim: Array<Record<string, string>> = [];
    const dikirimId: string[] = [];
    w.document.addEventListener("submit", (e: any) => {
      e.preventDefault();
      dikirim.push(Object.fromEntries(new w.FormData(e.target)));
      dikirimId.push(String(e.target.id || ""));
    });
    w.chrome = {
      runtime: {
        id: "aleta-uji",
        lastError: undefined,
        getManifest: () => ({ version: "9.9.9" }),
        getURL: (p: string) => `chrome-extension://aleta-uji/${p}`,
        sendMessage: (p: any, balik?: (x: unknown) => void) => {
          pesan.push(JSON.parse(JSON.stringify(p)));
          const j = p && typeof p.jenis === "string" && p.jenis.startsWith("masuk-") ? jawabLatar(p) : { ok: true };
          if (balik) setTimeout(() => balik(j), 0);
        },
      },
      storage: {
        local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined },
        session: { get: async () => ({}), set: async () => undefined },
        onChanged: { addListener: () => {} },
      },
    };
    w.fetch = async () => new Response("{}", { status: 404 });
    w.console.warn = () => {};
    w.eval(SUMBER_ALAT);
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
    const masuk = pesan.filter((p) => String(p.jenis).startsWith("masuk-"));
    return { w, masuk, dikirim, dikirimId };
  }

  it("SIPP: blangko masuk diisi dan dikirim", async () => {
    const { masuk, dikirim } = await buka(`${ASAL}/SIPP/index.php/login`, BLANGKO_SIPP);
    expect(masuk).toEqual([{ sumber: "aleta-panel", jenis: "masuk-minta", halaman: "sipp" }]);
    expect(dikirim).toEqual([{ username: "pp.budi", password: SANDI }]);
  });

  it("ABT: blangko masuk diisi dan dikirim", async () => {
    const { masuk, dikirim } = await buka(`${ASAL}/aps_badilag/login`, BLANGKO_ABT);
    expect(masuk).toEqual([{ sumber: "aleta-panel", jenis: "masuk-minta", halaman: "abt" }]);
    expect(dikirim).toEqual([{ userName: "pp.budi", password: SANDI }]);
  });

  it("halaman masuk yang memperlihatkan penolakan TIDAK diisi; latar diminta menahan", async () => {
    const sipp = await buka(`${ASAL}/SIPP/index.php/login/index/ERR`, BLANGKO_SIPP);
    expect(sipp.masuk).toEqual([{ sumber: "aleta-panel", jenis: "masuk-gagal", halaman: "sipp" }]);
    expect(sipp.dikirim).toEqual([]);
    const abt = await buka(`${ASAL}/aps_badilag/login/signin`, BLANGKO_ABT);
    expect(abt.masuk).toEqual([{ sumber: "aleta-panel", jenis: "masuk-gagal", halaman: "abt" }]);
    expect(abt.dikirim).toEqual([]);
  });

  it("halaman lain (bukan blangko masuk) tidak meminta apa pun", async () => {
    const lain = await buka(
      `${ASAL}/SIPP/index.php/perkara`,
      `<form action="${ASAL}/SIPP/index.php/perkara/simpan"><input name="username"><input name="password"></form>`
    );
    expect(lain.masuk).toEqual([]);
    const portal = await buka(`${ASAL}/aleta/login`, `<form><input name="username"><input type="password" name="password"></form>`);
    expect(portal.masuk).toEqual([]);
  });

  it("ABT tidak diisi untuk username 'supervisor' (ABT meneruskan passwordnya ke server Badilag)", async () => {
    const { dikirim } = await buka(`${ASAL}/aps_badilag/login`, BLANGKO_ABT, () => ({ ok: true, username: "supervisor", sandi: SANDI }));
    expect(dikirim).toEqual([]);
  });

  // Uji rilis U2 (9 Okt 2026): halaman masuk SIPP SUNGGUHAN (diambil dari
  // http://192.168.10.10/SIPP/login, views/Login/login.php) membuka <form>
  // DI DALAM <tbody>. Parser HTML menutup form seperti itu seketika: form-nya
  // kosong, dan medan username/password berada di <tr> sesudahnya - pemiliknya
  // tetap login_frm (form element pointer), tetapi BUKAN keturunannya. Blangko
  // tiruan di atas membungkus medannya di dalam form, sehingga cacat ini lolos.
  const BLANGKO_SIPP_ASLI =
    `<div id="kotakLogin"><table width='100%'><tbody>` +
    `<tr><td align="center"><img src="${ASAL}/SIPP/resources/img/logo-login.png"></td></tr>` +
    `<tr><td colspan="4" align="center"><strong>Sistem Informasi Penelusuran Perkara</strong></td></tr>` +
    `<form action="${ASAL}/SIPP/login/validation_credential" method="post" accept-charset="utf-8" name="login" id="login_frm">` +
    `<tr><td><small>Username</small><input type="text" name="username" value="" class="login" autofocus="autofocus"  /></td></tr>` +
    `<tr><td><small>Password</small><input type="password" name="password" value="" class="login"  /><br>` +
    `<input type="submit" name="" value="Login" class="tombol7"  /></td></tr></tbody></table></div>`;

  it("SIPP asli (form di dalam tbody): medan tetap ditemukan, diisi, dan dikirim", async () => {
    const { masuk, w, dikirimForm } = await bukaAsli(`${ASAL}/SIPP/login`, BLANGKO_SIPP_ASLI);
    // Bukti bentuknya memang begitu setelah diurai: form kosong.
    expect(w.document.querySelector("#login_frm input")).toBeNull();
    expect(masuk).toEqual([{ sumber: "aleta-panel", jenis: "masuk-minta", halaman: "sipp" }]);
    expect(w.document.querySelector('input[name="username"]').value).toBe("pp.budi");
    expect(w.document.querySelector('input[name="password"]').value).toBe(SANDI);
    expect(dikirimForm).toEqual(["login_frm"]);
  });

  it("SIPP asli: halaman ERR tetap dikenali sebagai penolakan", async () => {
    const { masuk, dikirimForm } = await bukaAsli(`${ASAL}/SIPP/login/index/ERR`, BLANGKO_SIPP_ASLI);
    expect(masuk).toEqual([{ sumber: "aleta-panel", jenis: "masuk-gagal", halaman: "sipp" }]);
    expect(dikirimForm).toEqual([]);
  });

  /** Seperti buka(), tetapi mencatat form MANA yang dikirim (FormData jsdom tidak mengenal pemilik non-keturunan). */
  async function bukaAsli(alamat: string, badan: string) {
    const hasil = await buka(alamat, badan);
    return { ...hasil, dikirimForm: hasil.dikirimId };
  }

  it("tanpa titipan: tidak ada yang diisi atau dikirim", async () => {
    const { dikirim, w } = await buka(`${ASAL}/SIPP/index.php/login`, BLANGKO_SIPP, () => ({ ok: false, sebab: "belum ada titipan" }));
    expect(dikirim).toEqual([]);
    expect(w.document.querySelector('input[name="password"]').value).toBe("");
  });
});
