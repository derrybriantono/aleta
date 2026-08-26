import { describe, expect, it } from "vitest";

import { APP_VERSION, APP_VERSION_LABEL, PATCH_NOTES } from "@/lib/patch-notes";

/**
 * Uji ini dulu mematok "1.4.15" sebagai versi berjalan, sehingga otomatis
 * pecah setiap kali ada rilis baru - dan itu memang terjadi. Yang benar-benar
 * perlu dijaga bukan angkanya, melainkan aturannya:
 *
 *   - versi kode dan catatan pembaruan paling atas HARUS sama (inilah yang
 *     dulu membuat halaman Pembaruan Sistem menampilkan dua versi berbeda),
 *   - riwayat rilis lama tidak boleh hilang saat menambah entri baru.
 */
describe("patch notes", () => {
  it("menyamakan versi kode dengan catatan pembaruan teratas", () => {
    expect(PATCH_NOTES[0]?.version).toBe(APP_VERSION);
    expect(PATCH_NOTES[0]?.title).toBe(APP_VERSION_LABEL);
    expect(APP_VERSION_LABEL).toContain(APP_VERSION);
  });

  it("tidak memuat versi ganda", () => {
    const versi = PATCH_NOTES.map((note) => note.version);
    expect(new Set(versi).size).toBe(versi.length);
  });

  it("mewajibkan setiap entri punya tanggal dan status", () => {
    for (const note of PATCH_NOTES) {
      expect(note.date, `entri ${note.version}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(note.status.trim(), `entri ${note.version}`).not.toBe("");
      expect(note.summary.trim(), `entri ${note.version}`).not.toBe("");
    }
  });

  it("tetap menyimpan riwayat rilis lama", () => {
    const versi = new Set(PATCH_NOTES.map((note) => note.version));
    for (const lama of [
      "1.4.15",
      "1.4.10",
      "1.4.6",
      "1.4.5",
      "1.4.0",
      "1.3.0",
      "1.2.4",
      "1.2.1",
      "1.1.3",
      "1.1.2",
      "1.1.1",
      "1.1.0",
      "1.0.0",
      "0.1.0-beta.9",
      "0.1.0-beta.8",
      "0.1.0-beta.7",
      "0.1.0-beta.6",
      "0.1.0-beta.5",
    ]) {
      expect(versi.has(lama), `riwayat ${lama} hilang`).toBe(true);
    }
  });

  it("mempertahankan isi catatan rilis 1.4.15 apa adanya", () => {
    const catatan = PATCH_NOTES.find((note) => note.version === "1.4.15");
    expect(catatan?.status).toBe("Staging-Public Readiness");
    expect(catatan?.added).toContain(
      "Preflight kini menampilkan mode runtime database aktif, kebijakan fallback database, dan status target publik/staging-public."
    );
    expect(catatan?.changed).toContain(
      "BETTER_AUTH_SECRET sekarang menjadi syarat eksplisit untuk staging-public/production; secret lokal hanya boleh untuk development."
    );
    expect(catatan?.security).toContain(
      "Query registry aktif dengan status REJECTED_WRITE_QUERY atau UNSAFE_RAW_SQL diperlakukan sebagai error kesiapan."
    );
  });
});
