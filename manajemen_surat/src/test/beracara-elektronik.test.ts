/**
 * Beracara elektronik per perkara (arahan Derry 3 Nov 2026, keputusan 144).
 * Tabel kasus ada di fixtures/beracara-elektronik-kasus.json - dipakai juga ekstensi.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  LABEL_BERACARA,
  tentukanBeracaraElektronik,
  tergugatPernahHadirDariSandi,
  type MasukanBeracara,
} from "@/lib/beracara-elektronik";

const BERKAS = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "src/test/fixtures/beracara-elektronik-kasus.json"), "utf8")
) as {
  label: Record<string, string>;
  kasus: Array<{ nama: string; masukan: MasukanBeracara; jenis: string | null; alasanMemuat?: string[] }>;
  sandiKehadiran: Array<{ nama: string; sandi: Array<number | null>; verstek: boolean; pernahHadir: boolean | null }>;
};

describe("tentukanBeracaraElektronik - tabel kasus", () => {
  for (const k of BERKAS.kasus) {
    it(k.nama, () => {
      const hasil = tentukanBeracaraElektronik(k.masukan);
      expect(hasil?.jenis ?? null).toBe(k.jenis);
      if (hasil) {
        expect(hasil.label).toBe(BERKAS.label[hasil.jenis]);
        expect(hasil.alasan.length).toBeGreaterThan(5);
      }
      for (const kalimat of k.alasanMemuat ?? []) expect(hasil?.alasan).toContain(kalimat);
    });
  }

  it("label di berkas kasus sama dengan label di kode", () => {
    expect(BERKAS.label).toEqual(LABEL_BERACARA);
  });

  it("e-litigasi hanya bila SEMUA Tergugat memenuhi; perPihak menyebut siapa yang kurang", () => {
    const hasil = tentukanBeracaraElektronik({
      eCourt: true,
      tergugatPernahHadir: true,
      tergugat: [
        { nama: "A", email: "a@x", wa: "1", setujuElektronik: true },
        { nama: "B", email: "", wa: "1", setujuElektronik: true },
      ],
    });
    expect(hasil?.jenis).toBe("hybrid");
    expect(hasil?.perPihak.map((p) => p.memenuhi)).toEqual([true, false]);
  });
});

describe("tergugatPernahHadirDariSandi", () => {
  for (const k of BERKAS.sandiKehadiran) {
    it(k.nama, () => {
      expect(tergugatPernahHadirDariSandi(k.sandi, k.verstek)).toBe(k.pernahHadir);
    });
  }
});
