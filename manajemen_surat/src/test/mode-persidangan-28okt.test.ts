/**
 * 28 Okt 2026 - "persidangan elektronik" / "persidangan hybrid" per pihak (Jadwal Sidang & Status Perkara).
 * Elektronik = persetujuan saluran elektronik e-Court centang hijau DAN ada email; selain itu hybrid; tidak terbaca = tanpa label.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { modePersidangan } from "@/lib/mode-persidangan";

const b = (status: string, email: string, jenis = "pihak") => ({ jenis, email: { nilai: email }, elitigasi: { status } });

describe("aturan mode persidangan", () => {
  it("setuju + email = elektronik (contoh 600/Pdt.G/2026: kedua pihak centang hijau dan beremail)", () => {
    expect(modePersidangan(b("ya", "pihak@contoh.id"))).toMatchObject({ mode: "elektronik", teks: "persidangan elektronik" });
  });

  it("tidak setuju tanpa email = hybrid; kombinasi lain juga hybrid dengan sebabnya", () => {
    expect(modePersidangan(b("tidak", ""))).toMatchObject({ mode: "hybrid", teks: "persidangan hybrid", sebab: expect.stringMatching(/tidak setuju, dan email tidak ada/) });
    expect(modePersidangan(b("ya", ""))!.sebab).toMatch(/email belum ada/);
    expect(modePersidangan(b("tidak", "x@y.id"))!.sebab).toMatch(/walau email ada/);
    expect(modePersidangan(b("belum", ""))).toMatchObject({ mode: "hybrid" });
  });

  it("tidak terbaca, tidak berlaku, dan kuasa = tanpa label (tidak ditebak)", () => {
    expect(modePersidangan(b("tidak-diketahui", "x@y.id"))).toBeNull();
    expect(modePersidangan(b("tidak-berlaku", ""))).toBeNull();
    expect(modePersidangan(b("ya", "x@y.id", "kuasa"))).toBeNull();
  });
});

describe("terpasang di kedua layar", () => {
  const baca = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");
  it("Status Perkara (kartu kontak) dan Identitas Pihak Jadwal Sidang memakai lencana yang sama", () => {
    expect(baca("components/portal/kontak-para-pihak.tsx")).toContain("<LencanaModePersidangan baris={baris} />");
    expect(baca("components/portal/aleta-ecourt-sidang.tsx")).toMatch(/<LencanaModePersidanganPihak nomorPerkara=\{nomorPerkara\} orang=\{\{ nama: orang\.nama, jenis: "pihak", pihakKe: kelompok\.sisi \}\} \/>/);
  });
});
