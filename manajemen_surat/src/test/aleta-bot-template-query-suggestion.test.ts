import { describe, expect, it } from "vitest";

import { scoreQueryForTemplate } from "@/components/portal/aleta-bot-admin";

describe("scoreQueryForTemplate", () => {
  it("menghitung placeholder yang dipasok kolom output sumber data", () => {
    const result = scoreQueryForTemplate(
      { outputColumns: ["nama_pihak", "telepon", "tanggal_sidang", "agenda"] },
      ["nama_pihak", "tanggal_sidang", "sisa_panjar"]
    );

    expect(result.covered).toEqual(["nama_pihak", "tanggal_sidang"]);
    expect(result.missing).toEqual(["sisa_panjar"]);
    expect(result.score).toBe(2);
  });

  it("menganggap placeholder runtime selalu tersedia walau bukan kolom output", () => {
    // waktu/ringkasan/nomor_perkara selalu disuntikkan runtime bot, jadi tidak
    // boleh dilaporkan sebagai kekurangan sumber data.
    const result = scoreQueryForTemplate({ outputColumns: [] }, ["waktu", "ringkasan", "nomor_perkara"]);

    expect(result.missing).toEqual([]);
    expect(result.score).toBe(3);
  });

  it("memberi skor lebih tinggi pada sumber data yang lebih cocok", () => {
    const placeholders = ["nama_pihak", "tanggal_sidang", "agenda", "ruangan"];
    const cocok = scoreQueryForTemplate(
      { outputColumns: ["nama_pihak", "tanggal_sidang", "agenda", "ruangan", "telepon"] },
      placeholders
    );
    const kurangCocok = scoreQueryForTemplate({ outputColumns: ["nama_pegawai", "judul_notifikasi"] }, placeholders);

    expect(cocok.score).toBeGreaterThan(kurangCocok.score);
    expect(cocok.missing).toEqual([]);
  });

  it("tidak menandai kecocokan apa pun saat isi pesan belum punya placeholder", () => {
    const result = scoreQueryForTemplate({ outputColumns: ["nama_pihak", "telepon"] }, []);

    expect(result.score).toBe(0);
    expect(result.covered).toEqual([]);
    expect(result.missing).toEqual([]);
  });
});
