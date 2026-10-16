// @vitest-environment jsdom
import { writeFileSync } from "node:fs";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BagianDrafH7, LencanaDrafH7, PanelDrafH7 } from "@/components/portal/draf-h7";
import {
  golongkanIsian,
  nilaiKesiapanH7,
  pilihBlangkoH7,
  ringkasDrafH7,
  susunRingkasan,
  teksLaporanH7,
  untukChecklistH7,
  type DrafH7,
} from "@/lib/agen-h7-putusan";
import type { ButirIsian } from "@/app/api/aleta-ecourt/blangko-derry/susun";

/**
 * Draf H-7 agen ALETA di Jadwal Sidang dan checklist konseptor (F4.2):
 * lencana kesiapan, panel rincian (laporan, isian perlu manusia, ringkasan
 * berlabel sumber), dan bagian di checklist. Bahasa awam - tanpa kode
 * variabel di layar.
 */

const isian = (kode: string, nama: string, lain: Partial<ButirIsian> = {}): ButirIsian => ({
  kode, nama, namaAsli: nama, jenis: "teks", pemicu: "", wajib: true, langsung: true, bawaan: "", pilihan: [], saran: "",
  dipakaiOleh: [], khusus: "", pihak: "", keadaan: "", tingkat: "penting", opsi: [], tj: null, ...lain,
});

const BARIS = {
  perkaraId: "512", nomorPerkara: "512/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalSidang: "2026-10-24", agenda: "Musyawarah Majelis",
  urutanSidang: 4, panggilan: { tergugatPernahHadir: false }, majelisNama: "Hakim A", paniteraNama: "PP B",
};
const NILAI = {
  "1214": { status: "terisi", teks: "P-1 Fotokopi KTP<br>P-2 Fotokopi Kutipan Akta Nikah" },
  "5125": { status: "terisi", teks: "Bahwa Penggugat dan Tergugat menikah pada 2015;<br>Bahwa sejak 2023 sering bertengkar;" },
};
const ISIAN = golongkanIsian({
  susunan: { isian: [isian("0222", "Awal perselisihan"), isian("8503", "Alasan perceraian"), isian("1214", "Alat bukti surat Penggugat", { khusus: "bukti" }), isian("8436", "Kesimpulan Penggugat")] },
  nilai: NILAI,
  usulan: [
    { jalur: "saksi", usulan: { kode: "0222", nilai: "bulan Maret 2024", tingkat: "pasti" } },
    { jalur: "sipp", usulan: { kode: "8503", nilai: "F · terus-menerus berselisih", keyakinan: "pasti" } },
  ],
  perkara: null,
});
const DRAF: DrafH7 = {
  perkaraId: "512", nomorPerkara: BARIS.nomorPerkara, jenisPerkara: BARIS.jenisPerkara, tanggalSidang: BARIS.tanggalSidang, agenda: BARIS.agenda,
  alasan: "putusan", majelis: "Hakim A", panitera: "PP B",
  blangko: pilihBlangkoH7(BARIS, "putusan"),
  isian: ISIAN,
  otomatis: { jumlah: 30, terisi: 30, kosong: [] },
  ringkasan: susunRingkasan({ nilai: NILAI, riwayat: [{ urutan: 3, tanggalSidang: "2026-10-10", agenda: "Pembuktian", dihadiriOleh: 2 }], saksi: [{ pihak: "P", tanyaJawab: [{}] }], dokumen: [], namaSaksi: { P: ["Saksi Satu", "Saksi Dua"], T: [] }, sebutan: { P: "Penggugat", T: "Tergugat" } }),
  kesiapan: nilaiKesiapanH7(ISIAN, { jumlah: 30, terisi: 30, kosong: [] }, true),
  kendala: [],
  dibuatPada: "2026-10-16T22:00:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("draf H-7 di layar", () => {
  it("lencana: persen dan jumlah yang perlu diisi; kosong tanpa draf", () => {
    const { container, rerender } = render(<LencanaDrafH7 />);
    expect(container.textContent).toBe("");
    rerender(<LencanaDrafH7 ringkas={ringkasDrafH7(DRAF)} />);
    const l = screen.getByText("Draf H-7 50% - 2 perlu diisi");
    expect(l.getAttribute("data-draf-h7")).toBe("hampir");
    expect(l.getAttribute("title")).toContain("Alasan perceraian");
  });

  it("panel: dibuka memuat draf lengkap - laporan, perlu manusia, disiapkan agen, ringkasan bersumber", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { peta: { "512": { ...DRAF, laporan: teksLaporanH7(DRAF) } } } }), { status: 200 })));
    const { container } = render(<PanelDrafH7 perkaraId="512" ringkas={ringkasDrafH7(DRAF)} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    const teks = container.textContent || "";
    expect(teks).toContain("Hari Putusan 24 Oktober 2026 (Musyawarah Majelis).");
    expect(teks).toContain("Blangko yang disiapkan: [01] [Kabul Verstek] Cerai (Format Lengkap)");
    expect(teks).toContain("Perlu manusia (2)");
    expect(teks).toContain("Alasan perceraian - usulan agen - perlu diperiksa");
    expect(teks).toContain("Disiapkan agen (1): Awal perselisihan.");
    expect(teks).toContain("Duduk perkara - sumber: Posita gugatan/permohonan di SIPP");
    expect(teks).toContain("belum disimpan ke ABT maupun SIPP");
    // Bahasa awam: tidak ada kode variabel #NNNN# atau kode empat angka telanjang di layar.
    expect(teks).not.toMatch(/#\d{4}#|\b(0222|8503|1214|8436)\b/);
    if (process.env.PRATINJAU_H7) {
      const html = `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com/3.4.1"></script>
<style>:root{--muted-foreground:#64748b}.text-muted-foreground{color:#64748b}.bg-card{background:#fff}.border-border{border-color:#e2e8f0}</style></head>
<body class="bg-slate-50 p-6"><div class="max-w-md space-y-2"><div class="flex flex-wrap gap-1"><span class="rounded bg-amber-700 px-1.5 py-0.5 text-xs font-medium text-amber-50">Hari Putusan</span>${render(<LencanaDrafH7 ringkas={ringkasDrafH7(DRAF)} />).container.innerHTML}</div>${container.innerHTML}<div class="rounded-lg border bg-white p-2 text-[11px]">${render(<BagianDrafH7 h7={untukChecklistH7(DRAF)} />).container.innerHTML}</div></div></body></html>`;
      writeFileSync(process.env.PRATINJAU_H7, html);
    }
  });

  it("bagian di checklist konseptor: lencana + laporan singkat", () => {
    const { container } = render(<BagianDrafH7 h7={untukChecklistH7(DRAF)} />);
    expect(container.textContent).toContain("Draf H-7 50% - 2 perlu diisi");
    expect(container.textContent).toContain("2 dari 4 isian siap");
    render(<BagianDrafH7 h7={null} />);
  });
});
