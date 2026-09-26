// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  IN_MEMORY_TABLE_PERSISTENCE_ORDER,
  TABEL_TANPA_CADANGAN_INGATAN,
  createAletaDatabase,
  type AletaDatabase,
} from "@/server/db/client";

/**
 * ============================================================================
 * SETIAP TABEL IKUT CADANGAN JSON - ATAU TERTULIS ALASANNYA
 * ============================================================================
 *
 * Saat Postgres mati, portal berjalan di pg-mem dan menulis cetakan JSON
 * (data/dev-fallback-db.json) - tetapi HANYA untuk tabel yang tercantum di
 * IN_MEMORY_TABLE_PERSISTENCE_ORDER. Baris tabel lain lenyap pada mulai ulang
 * berikutnya, tanpa satu pun pesan. Terukur 25 September 2026: 47 tabel tidak
 * ikut, lima di antaranya tabel ALETA terbaru, dan aleta_keterangan_perkara
 * tersisa 0 baris sesudah mulai ulang.
 *
 * Penjaga ini menanyai pg-mem SUNGGUHAN - tabel yang benar-benar dibuat
 * ensureAletaSchema - bukan membaca teks schema.ts. Setiap tabel harus
 * terdaftar, atau tercantum di TABEL_TANPA_CADANGAN_INGATAN beserta alasannya
 * yang dapat dibaca peninjau.
 */

let db: AletaDatabase | null = null;
let tabelNyata: string[] = [];

beforeAll(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: false });
  const baris = await db.queryAll<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
  );
  tabelNyata = baris.map((b) => b.table_name).sort();
});

afterAll(async () => {
  await db?.close();
  db = null;
});

describe("cadangan JSON mode Postgres-mati", () => {
  it("pg-mem sungguh menjawab daftar tabel (penjaga ini tidak kosong)", () => {
    expect(tabelNyata.length).toBeGreaterThan(200);
    expect(tabelNyata).toContain("aleta_tipe_keluaran");
  });

  it("setiap tabel yang dibuat ensureAletaSchema terdaftar, atau dikecualikan dengan alasan", () => {
    const terdaftar = new Set<string>(IN_MEMORY_TABLE_PERSISTENCE_ORDER);
    const tanpaTempat = tabelNyata.filter((t) => !terdaftar.has(t) && !(t in TABEL_TANPA_CADANGAN_INGATAN));
    expect(tanpaTempat, "tabel baru harus didaftarkan di IN_MEMORY_TABLE_PERSISTENCE_ORDER (client.ts)").toEqual([]);
  });

  it("tabel tipe keluaran dan lima tabel yang terukur hilang kini terdaftar", () => {
    for (const t of [
      "aleta_tipe_keluaran",
      "aleta_tipe_keluaran_riwayat",
      "aleta_abt_riwayat",
      "aleta_antrian_publik",
      "aleta_keterangan_perkara",
      "aleta_konseptor_sementara",
      "aleta_rekam_antrian",
    ]) {
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER, t).toContain(t);
    }
  });

  it("aleta_antrian_publik berdiri SESUDAH users - pemulihan menyisipkan baris menurut urutan ini", () => {
    const urutan = IN_MEMORY_TABLE_PERSISTENCE_ORDER as readonly string[];
    expect(urutan.indexOf("aleta_antrian_publik")).toBeGreaterThan(urutan.indexOf("users"));
  });

  it("pengecualian tidak berbohong: tiap alasan tertulis, tidak ada tabel yang terdaftar sekaligus dikecualikan, dan tidak ada nama basi", () => {
    for (const [tabel, alasan] of Object.entries(TABEL_TANPA_CADANGAN_INGATAN)) {
      expect(alasan.trim().length, tabel).toBeGreaterThan(30);
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER as readonly string[], tabel).not.toContain(tabel);
      expect(tabelNyata, `pengecualian ${tabel} menunjuk tabel yang tidak ada`).toContain(tabel);
    }
  });

  it("daftar cadangan tidak memuat nama ganda atau tabel yang tidak ada", () => {
    const urutan = IN_MEMORY_TABLE_PERSISTENCE_ORDER as readonly string[];
    expect(new Set(urutan).size).toBe(urutan.length);
    // Tabel yang dibuat MALAS oleh modulnya sendiri - bukan oleh
    // ensureAletaSchema - sah terdaftar; cadangan melewatinya selama belum ada.
    const DIBUAT_MALAS: Record<string, string> = {
      ai_module_settings:
        "dibuat ensureAIModuleSettingsTable (modules/ai/service.ts) saat konfigurasi AI pertama dibaca",
    };
    expect(urutan.filter((t) => !tabelNyata.includes(t) && !(t in DIBUAT_MALAS))).toEqual([]);
    // Pengecualian ini tidak boleh menyembunyikan apa pun: begitu tabelnya
    // dibuat skema, ia harus keluar dari sini.
    expect(Object.keys(DIBUAT_MALAS).filter((t) => tabelNyata.includes(t))).toEqual([]);
  });
});
