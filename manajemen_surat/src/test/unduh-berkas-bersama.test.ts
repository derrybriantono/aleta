// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { tanganiUnduhan, type PemicuUnduhan } from "@/lib/unduh-berkas";

/**
 * ============================================================================
 * BUTIR 31 (30 Sep 2026) - "Berkasnya kosong di server." PADAHAL TERUNDUH
 * ============================================================================
 *
 * Jadwal Sidang > Rincian 574/Pdt.G/2026/PA.Dgl > Relaas baris Tergugat:
 * berkasnya terunduh, tetapi tulisan merah tetap muncul. Rute berkas-sipp
 * mengirim Content-Length yang benar; badan jawaban dikosongkan pengelola
 * unduhan peramban yang mengambil alih unduhannya.
 *
 *   berhasil (badan berisi)                    -> tanpa pesan, satu berkas
 *   diambil alih (0 bita, Content-Length > 0)  -> tanpa pesan, TANPA berkas kembar
 *   sungguh kosong (Content-Length: 0)         -> pesan tetap ada
 *   404 / JSON galat                           -> pesan server tetap ada
 */

function pemicu() {
  const simpan = vi.fn();
  const navigasi = vi.fn();
  return { simpan, navigasi, p: { simpanBlob: simpan, navigasi } satisfies PemicuUnduhan };
}

const RTF = new TextEncoder().encode("{\\rtf1 relaas}");

describe("tanganiUnduhan - satu aturan untuk semua tombol unduh", () => {
  it("unduhan berhasil: disimpan sekali, TANPA pesan kosong, nama dari Content-Disposition", async () => {
    const t = pemicu();
    const h = await tanganiUnduhan(
      new Response(RTF, {
        headers: {
          "content-type": "application/rtf",
          "content-disposition": 'attachment; filename="relaas_574.rtf"',
          "content-length": String(RTF.byteLength),
        },
      }),
      { namaCadangan: "relaas.pdf", alamat: "/api/x", pemicu: t.p }
    );
    expect(h).toEqual({ ok: true, nama: "relaas_574.rtf", cara: "blob" });
    expect(t.simpan).toHaveBeenCalledTimes(1);
    expect(t.navigasi).not.toHaveBeenCalled();
  });

  it("badan 0 bita tetapi Content-Length berisi (diambil pengelola unduhan): BERHASIL, tanpa berkas kembar", async () => {
    const t = pemicu();
    const h = await tanganiUnduhan(
      new Response(null, { headers: { "content-type": "application/rtf", "content-length": "48213" } }),
      { namaCadangan: "relaas.pdf", alamat: "/api/x", pemicu: t.p }
    );
    expect(h.ok).toBe(true);
    expect(h).toMatchObject({ cara: "diambil-alih" });
    expect(t.simpan).not.toHaveBeenCalled();
  });

  it("sungguh kosong (Content-Length: 0): pesan kosong TETAP ada", async () => {
    const t = pemicu();
    const h = await tanganiUnduhan(new Response(null, { headers: { "content-length": "0" } }), {
      namaCadangan: "relaas.pdf",
      pemicu: t.p,
    });
    expect(h).toEqual({ ok: false, pesan: "Berkasnya kosong di server." });
    const zip = await tanganiUnduhan(new Response(null, { headers: { "content-length": "0" } }), {
      namaCadangan: "x.zip",
      pesanKosong: "ZIP-nya kosong.",
      pemicu: t.p,
    });
    expect(zip).toEqual({ ok: false, pesan: "ZIP-nya kosong." });
  });

  it("0 bita tanpa Content-Length: diserahkan ke navigasi unduhan biasa, tanpa pesan merah", async () => {
    const t = pemicu();
    const h = await tanganiUnduhan(new Response(null), { namaCadangan: "a.pdf", alamat: "/aleta/api/x?id=1", pemicu: t.p });
    expect(h).toMatchObject({ ok: true, cara: "navigasi" });
    expect(t.navigasi).toHaveBeenCalledWith("/aleta/api/x?id=1");
  });

  it("404 / JSON galat: pesan server tetap ada, tidak ada berkas", async () => {
    const t = pemicu();
    const h = await tanganiUnduhan(
      new Response(JSON.stringify({ ok: false, error: { message: "Relaas tidak ditemukan di SIPP." } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
      { namaCadangan: "a.pdf", pemicu: t.p }
    );
    expect(h).toEqual({ ok: false, pesan: "Relaas tidak ditemukan di SIPP." });
    expect(t.simpan).not.toHaveBeenCalled();
  });
});

describe("tombol-tombol unduh portal memakai penanganan bersama", () => {
  const baca = (f: string) => readFileSync(path.resolve(__dirname, "../components/portal", f), "utf8");

  it.each([
    ["aleta-ecourt-sidang.tsx", "Relaas/Resi/BAS/berkas e-Court di Jadwal Sidang"],
    // tombol-unduh-zip.tsx keluar dari daftar ini sejak butir 25 (6 Okt 2026):
    // ZIP perkara yang besar tidak lagi lewat fetch + blob, melainkan unduhan
    // biasa peramban - dijaga di unduh-seluruh-berkas-alir.test.ts.
    ["aleta-ecourt-arsip-berkas.tsx", "PDF/Word arsip berkas e-Court"],
    ["eviden-skp-menu.tsx", "Eviden SKP"],
  ])("%s (%s)", (berkas) => {
    const isi = baca(berkas);
    expect(isi).toContain('import { tanganiUnduhan } from "@/lib/unduh-berkas";');
    expect(isi).toContain("await tanganiUnduhan(");
    // Aturan lama yang menyebut kosong atas blob 0 bita tidak ada lagi.
    expect(isi).not.toMatch(/blob\.size === 0\)\s*\{\s*set(Galat|Catatan)\(/);
  });
});
