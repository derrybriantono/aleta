// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KODE_FITUR_BERKAS_ECOURT, KODE_FITUR_EC_BUKTI, KODE_FITUR_EC_BUKTI_SAKSI, KODE_FITUR_EC_KESIMPULAN } from "@/lib/berkas-ecourt-fitur";
import { KATALOG_FITUR_SATKER } from "@/lib/fitur-satker";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { bacaSetelanBerkas } from "@/server/modules/aleta-ecourt/berkas-otomatis";
import { simpanPengaturanFitur } from "@/server/modules/satker/fitur";

/**
 * Saklar berkas e-Court G2 (bukti, kesimpulan, pemetaan bukti-saksi) dipindah ke Fitur Satker (26 Okt 2026):
 * tetap MATI bawaan, tidak ada fitur yang hilang, kartu di layar Tenggat tidak ada lagi.
 */

describe("katalog Fitur Satker memuat tiga saklar berkas e-Court (bukti menyala bawaan sejak 30 Okt malam)", () => {
  it("tiga butir, bagian portal, bawaan mati, bernama awam", () => {
    for (const kode of KODE_FITUR_BERKAS_ECOURT) {
      const f = KATALOG_FITUR_SATKER.find((x) => x.kode === kode);
      expect(f, kode).toBeTruthy();
      // 30 Okt malam (keputusan pengguna no. 34): bukti e-Court otomatis MENYALA bawaan; dua lainnya tetap mati.
      expect(f?.bawaan).toBe(kode === KODE_FITUR_EC_BUKTI ? "stabil" : "mati");
      expect(f?.nama.length).toBeGreaterThan(10);
      expect(f?.keterangan).toMatch(kode === KODE_FITUR_EC_BUKTI ? /^Menyala \(bawaan/ : /^Mati:/);
    }
  });
});

describe("bacaSetelanBerkas mengikuti Fitur Satker", () => {
  let db: AletaDatabase;
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.close();
  });
  const aktor = { id: "usr-super", name: "Super Admin" };

  it("belum pernah diatur: bukti menyala (keputusan 30 Okt malam), dua lainnya mati", async () => {
    expect(await bacaSetelanBerkas(db)).toMatchObject({ bukti: true, kesimpulan: false, buktiSaksi: false });
  });

  it("bukti yang SENGAJA dimatikan tetap mati (pilihan tersimpan)", async () => {
    await simpanPengaturanFitur(db, aktor, { fitur: { [KODE_FITUR_EC_BUKTI]: "mati" } });
    expect(await bacaSetelanBerkas(db)).toMatchObject({ bukti: false });
  });

  it("dinyalakan satu per satu di Fitur Satker: hanya yang dipilih menyala; dimatikan lagi kembali mati", async () => {
    await simpanPengaturanFitur(db, aktor, { fitur: { [KODE_FITUR_EC_KESIMPULAN]: "stabil", [KODE_FITUR_EC_BUKTI]: "mati" } });
    expect(await bacaSetelanBerkas(db)).toMatchObject({ bukti: false, kesimpulan: true, buktiSaksi: false });
    await simpanPengaturanFitur(db, aktor, { fitur: { [KODE_FITUR_EC_KESIMPULAN]: "stabil", [KODE_FITUR_EC_BUKTI]: "stabil", [KODE_FITUR_EC_BUKTI_SAKSI]: "stabil" } });
    expect(await bacaSetelanBerkas(db)).toMatchObject({ bukti: true, kesimpulan: true, buktiSaksi: true });
    await simpanPengaturanFitur(db, aktor, { fitur: { [KODE_FITUR_EC_BUKTI]: "stabil" } });
    expect(await bacaSetelanBerkas(db)).toMatchObject({ bukti: true, kesimpulan: false, buktiSaksi: false });
  });

  // 30 Okt malam: bukti mengikuti bawaan barunya (menyala, seperti fitur lama); kesimpulan & usulan bukti-saksi tetap mati.
  it("basis data tidak terbaca: kesimpulan dan bukti-saksi mati, bukti mengikuti bawaan (menyala)", async () => {
    const rusak = {
      queryOne: async () => {
        throw new Error("db mati");
      },
      queryAll: async () => {
        throw new Error("db mati");
      },
    } as unknown as AletaDatabase;
    expect(await bacaSetelanBerkas(rusak)).toMatchObject({ bukti: true, kesimpulan: false, buktiSaksi: false });
  });
});

describe("layar Tenggat tidak lagi memuat kartu saklar", () => {
  it("halaman Tenggat tanpa BerkasOtomatisKartu; berkasnya dihapus; rutenya hanya baca", () => {
    const halaman = readFileSync(path.join(process.cwd(), "src/app/(portal)/aleta-ecourt/tenggat/page.tsx"), "utf8");
    expect(halaman).not.toContain("BerkasOtomatisKartu");
    const rute = readFileSync(path.join(process.cwd(), "src/app/api/aleta-ecourt/berkas-otomatis/route.ts"), "utf8");
    expect(rute).not.toContain("POST");
  });
});
