/**
 * Butir 4 (5 Okt 2026): kode majelis lebih besar dan tebal, dan sel Antrian /
 * Jam Jadwal Sidang ikut menampilkan kode majelis APLIKASI ANTRIAN ("C1|C2|C3").
 * Dirender, bukan disisir teksnya.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SelAntrianJam } from "@/components/portal/aleta-ecourt-sidang";
import { KELAS_KODE_MAJELIS, KELAS_LENCANA_KODE_MAJELIS } from "@/lib/kode-majelis";

type PropsSel = Parameters<typeof SelAntrianJam>[0];
type AntrianSel = NonNullable<PropsSel["antrian"]>;

const antrian = (sebagian: Partial<AntrianSel>): AntrianSel => ({
  nomor: 3,
  tanggalSidang: "2026-10-05",
  waktuAmbil: "08:12",
  online: false,
  pihak1: "08:12",
  pihak2: "",
  saksi: "",
  keadaan: "menunggu",
  menitMenunggu: null,
  jamPanggil: "",
  noRuang: 1,
  ruanganId: 1,
  namaPetugas: "",
  majelisKode: "",
  ...sebagian,
});

const baris = { perkaraId: "609", nomorPerkara: "609/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-10-05", jamSidang: "09:00" } as unknown as PropsSel["baris"];

const sel = (a: AntrianSel) =>
  renderToStaticMarkup(createElement(SelAntrianJam, { baris, antrian: a, tanggalTampil: "2026-10-05", sidangSelesai: false }));

/** Teks di dalam span yang kelasnya memuat semua kelas yang diminta. */
function teksBerkelas(html: string, kelas: string[]): string[] {
  const hasil: string[] = [];
  for (const m of html.matchAll(/<span class="([^"]*)">([^<]*)<\/span>/g)) {
    const punya = m[1].split(/\s+/);
    if (kelas.every((k) => punya.includes(k))) hasil.push(m[2]);
  }
  return hasil;
}

describe("kode majelis di sel Antrian / Jam", () => {
  it("6 Okt 2026 (butir 6): TIDAK lagi tampil di sel Antrian / Jam - sudah ada di kolom Majelis & Petugas", () => {
    const html = sel(antrian({ majelisKode: "C1|C2|C3" }));
    expect(html).not.toContain("C1|C2|C3");
    expect(teksBerkelas(html, ["font-bold", "font-mono", "whitespace-nowrap"])).toEqual([]);
  });

  it("tanpa kode majelis tidak ada sisa kosong", () => {
    const html = sel(antrian({ majelisKode: "" }));
    expect(html).not.toContain("Kode majelis di aplikasi antrian");
  });
});

describe("kelas kode majelis", () => {
  it("lebih besar dan tebal daripada sebelumnya (text-xs font-semibold)", () => {
    expect(KELAS_LENCANA_KODE_MAJELIS.split(" ")).toEqual(expect.arrayContaining(["text-sm", "font-bold", "whitespace-nowrap"]));
    expect(KELAS_LENCANA_KODE_MAJELIS).not.toMatch(/\btext-xs\b|\bfont-semibold\b/);
    expect(KELAS_KODE_MAJELIS.split(" ")).toEqual(expect.arrayContaining(["font-bold", "whitespace-nowrap"]));
  });
});
