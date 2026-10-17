// @vitest-environment node
import { describe, expect, it } from "vitest";

import { anonimkanTeks, type EntitasAnonim } from "@/lib/anonimisasi-putusan";

/** Audit 17 Okt 2026 (portal): kasus ini GAGAL atas a2e3618 dan hijau sesudah perbaikannya. */

describe("anonimisasi mandiri - nomor perkara tidak disamarkan (keputusan 17 Okt butir 33)", () => {
  const ENTITAS: EntitasAnonim = {
    sebutan: { satu: "Penggugat", dua: "Tergugat" },
    pihak: [
      { pihakKe: 1, nama: "SITI AMINAH binti LA BADU" },
      { pihakKe: 2, nama: "AHMAD bin UMAR" },
    ],
  };
  it.each([
    "Nomor 45/Pdt.G/2025/PA.Dgl SITI AMINAH binti LA BADU hadir",
    "perkara Nomor 45/Pdt.G/2025/PA.Dgl. Penggugat SITI AMINAH binti LA BADU hadir",
    "Nomor 7/Pdt.P/2026/PA.Dgl\tAHMAD bin UMAR",
  ])("kode satker di nomor perkara utuh: %s", (teks) => {
    const h = anonimkanTeks(teks, ENTITAS);
    expect(h.teks).toMatch(/\d+\/Pdt\.[GP]\/\d{4}\/PA\.Dgl/);
    expect(h.teks).not.toMatch(/SITI|AHMAD/);
  });
});
