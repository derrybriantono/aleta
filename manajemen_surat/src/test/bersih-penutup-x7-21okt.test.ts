// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

/**
 * 21 Okt 2026 (x7) - pembersihan isian TERSIMPAN kalimat penutup keterangan saksi, hanya perkara BELUM minutasi.
 * Uji statis atas paket abt-paket/x7-bersih-penutup-21okt (siklus pasang-ulang-pulih dijalankan di ABT laptop oleh sumber/uji_lokal.sh).
 */
const require_ = createRequire(import.meta.url);
const dir = path.resolve(process.cwd(), "../abt-paket/x7-bersih-penutup-21okt");
const baca = (f: string) => readFileSync(path.join(dir, "paket-satker", f), "utf8");
const bangun = require_(path.join(dir, "sumber/bangun_paket.js")) as Record<string, () => string> & { N: string };
const N = bangun.N;

describe("x7 - paket bersih penutup tersimpan", () => {
  it("berkas paket di repo sama persis dengan hasil bangun dari sumber (tidak basi)", () => {
    expect(baca(`${N}-PRASYARAT.sql`)).toBe(bangun.prasyaratSql());
    expect(baca(`${N}-HITUNG.sql`)).toBe(bangun.hitungSql());
    expect(baca(`${N}-DAFTAR.sql`)).toBe(bangun.daftarSql());
    expect(baca(`${N}-PERKARA.sql`)).toBe(bangun.perkaraSql());
    expect(baca(`${N}-HAPUS.sql`)).toBe(bangun.hapusSql());
    expect(baca(`${N}-FUNGSI.sql`)).toBe(bangun.fungsiSql());
    expect(baca(`${N}-PERIKSA.sql`)).toBe(bangun.periksaSql());
  });

  it("hanya perkara BELUM minutasi: proses_terakhir_id < 220 DAN tanpa perkara_proses 220, di semua kueri sasaran", () => {
    for (const f of ["HITUNG", "DAFTAR", "HAPUS", "PERKARA"]) {
      const s = baca(`${N}-${f}.sql`);
      expect(s).toContain("p.proses_terakhir_id < 220");
      expect(s).toContain("NOT EXISTS (SELECT 1 FROM __SIPP__.perkara_proses pp WHERE pp.perkara_id = k.perkara_id AND pp.proses_id = 220)");
    }
  });

  it("yang dihapus hanya jawaban SELURUHNYA penutup menurut isian_rtf_penutup (x6) dengan kolom pertanyaan; tidak ada hapus massal", () => {
    const hapus = baca(`${N}-HAPUS.sql`);
    expect(hapus).toContain("aps_badilag.isian_rtf_penutup(CONVERT(CAST(k.jawaban AS BINARY) USING latin1), IFNULL(CONVERT(CAST(k.pertanyaan AS BINARY) USING latin1), '')) = 1");
    expect(hapus).toContain("k.id IN (__IDS__)");
    expect(hapus.match(/DELETE/g)?.length).toBe(1);
    for (const f of ["FUNGSI", "PERIKSA", "HITUNG", "DAFTAR", "PERKARA", "PRASYARAT"]) expect(baca(`${N}-${f}.sql`)).not.toMatch(/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);
  });

  it("pasang mencadangkan baris lengkap sebelum menghapus dan pulih memakai INSERT IGNORE (tidak menimpa)", () => {
    const pasang = baca("pasang-satker.sh");
    expect(pasang.indexOf("--insert-ignore")).toBeGreaterThan(0);
    expect(pasang.indexOf("baris-dihapus.sql")).toBeLessThan(pasang.indexOf(`$N-HAPUS.sql`));
    expect(pasang).toContain("--where=\"id IN ($IDS)\"");
    expect(pasang).toMatch(/\[ "\$NCAD" = "\$NID" \]/);
    expect(pasang).toMatch(/\[ "\$DIH" = "\$NID" \]/);
    expect(pasang).toContain("PRASYARAT (");
    const pulih = baca("pulih-satker.sh");
    expect(pulih).toContain("baris-dihapus.sql");
    expect(pulih).toContain("PULIH COCOK");
  });

  it("jawaban lisan (isian_rtf_keterangan) memakai penyaring x6 dan selebihnya versi I3", () => {
    const f = baca(`${N}-FUNGSI.sql`);
    expect(f).toContain("isian_rtf_penutup(CONVERT(CAST(j AS BINARY) USING latin1)");
    expect(f).toContain("SELECT jawaban, pertanyaan FROM aps_badilag.abt_keterangan_terdakwa");
    expect(f).toContain("FETCH cur INTO j, jq;");
  });

  it("ASCII, tanpa kata merek, tanpa nomor variabel baru", () => {
    for (const f of [`${N}-PRASYARAT.sql`, `${N}-HITUNG.sql`, `${N}-DAFTAR.sql`, `${N}-PERKARA.sql`, `${N}-HAPUS.sql`, `${N}-FUNGSI.sql`, `${N}-PERIKSA.sql`, "fungsi-lama.sql", "pasang-satker.sh", "pulih-satker.sh"]) {
      const s = baca(f);
      expect(s).not.toMatch(/[^\x09\x0a\x20-\x7e]/);
      // skrip pasang hanya menyebut wadah "aleta-bot" untuk membaca sandi/nama basis; tidak ada kata merek yang tertulis ke DB
      expect(s.toLowerCase().replace(/aleta[-_]bot\w*/g, "")).not.toContain("aleta");
      expect(s).not.toMatch(/INSERT INTO abt_variabel|UPDATE abt_variabel/);
    }
  });
});
