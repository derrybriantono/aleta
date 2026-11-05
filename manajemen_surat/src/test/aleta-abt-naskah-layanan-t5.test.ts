// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { PustakaMesin } from "@/lib/aleta-abt-pustaka";
import { bandingkanRtf, paragrafPratinjau, susunNaskah } from "@/server/modules/aleta-abt-cetak/naskah";

/**
 * TAHAP 5 - layanan naskah dari pustaka dan jembatan bot `blangko.isiPustaka` (5 Nov 2026). Data rekaan.
 * Dijaga: blangko diambil dari pustaka ALETA (bukan cakram bot), cetak final menahan isian kosong, jembatan baru menolak masukan
 * rusak, dan jalur lama `blangko.isi` (panel Blangko Derry, BAS massal) tidak disentuh.
 */

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(__dirname, "../../..");
const jembatan = require_(path.join(AKAR, "aleta_bot/services/sippReadOnlyBridgeService.js")) as {
  handleBridgeOperation: (op: string, p: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const RTF = "{\\rtf1\\ansi\\paperw12191\\paperh18709\\deff0{\\fonttbl{\\f0 Times New Roman;}}\n\\pard\\qc PUTUSAN\\par\n\\pard Nama #0046#\\par\n}";
const pustaka: PustakaMesin = { sidik: "s1", pustaka: { AA0001: { nama: "PIHAK I" } } as never, alias: {} as never } as unknown as PustakaMesin;

function dbBerkas(baris: Record<string, unknown> | null) {
  return { queryOne: async () => baris } as never;
}
const BERKAS = { id: "b1", folder: "f", nama: "Uji.rtf", isi: RTF, pengkodean: "latin1", arsip: 0, status: "aktif" };

describe("susunNaskah", () => {
  it("mengirim isi blangko pustaka (bukan nama berkas di cakram) dan pustaka rumus ke jembatan baru", async () => {
    let terkirim: { op: string; p: Record<string, unknown> } | null = null;
    const h = await susunNaskah(
      dbBerkas(BERKAS),
      { berkasId: "b1", perkaraId: "9", sidangKe: 3, cetakFinal: false },
      {
        pustaka,
        panggil: (async (op: string, p: Record<string, unknown>) => {
          if (op !== "blangko.isiPustaka") return { ok: false, error: "tidak dipakai di uji ini" };
          terkirim = { op, p };
          return { ok: true, data: { ok: true, jumlahTerisi: 1, kosong: [], lolosCetak: true, rtfBase64: Buffer.from(RTF.replace("#0046#", "Siti Rekaan"), "latin1").toString("base64"), waktuMs: 33, jumlahKueri: 2 } };
        }) as never,
      }
    );
    expect(terkirim!.op).toBe("blangko.isiPustaka");
    expect(Buffer.from(String(terkirim!.p.rtfBase64), "base64").toString("latin1")).toBe(RTF);
    expect(terkirim!.p).toMatchObject({ perkaraId: "9", sidangKe: 3, nama: "Uji.rtf" });
    expect(terkirim!.p).not.toHaveProperty("folder");
    expect(terkirim!.p).not.toHaveProperty("cetakFinal");
    expect((terkirim!.p.jalurAleta as { sidik: string }).sidik).toBe("s1");
    expect(h.ok).toBe(true);
    if (h.ok) {
      expect(h.kertas.nama).toBe("F4");
      expect(h.waktu.botMs).toBe(33);
      expect(paragrafPratinjau(h.rtf).paragraf.map((p) => p.teks)).toEqual(["PUTUSAN", "Nama Siti Rekaan"]);
    }
  });

  it("cetak final: katalog tidak terbaca berarti semua isian kosong menahan dan naskah tidak ikut, bahkan bila bot mengirimnya", async () => {
    const h = await susunNaskah(
      dbBerkas(BERKAS),
      { berkasId: "b1", perkaraId: "9", sidangKe: 0, cetakFinal: true },
      {
        pustaka,
        panggil: (async (op: string, p: Record<string, unknown>) => {
          if (op !== "blangko.isiPustaka") return { ok: false, error: "katalog tidak terbaca" };
          expect(p.tanpaSorotKosong).toBe(true);
          expect(p).not.toHaveProperty("cetakFinal");
          return { ok: true, data: { ok: true, lolosCetak: false, kosong: [{ noVar: "0046", nama: "PIHAK I", sebab: "", status: "kosong" }], rtfBase64: Buffer.from(RTF).toString("base64") } };
        }) as never,
      }
    );
    expect(h).toMatchObject({ ok: false, status: 409, ditahan: true });
    expect(JSON.stringify(h)).not.toContain("PUTUSAN");
  });

  it("blangko tidak ada, bukan RTF, atau sudah hilang di ABT -> galat jelas", async () => {
    await expect(susunNaskah(dbBerkas(null), { berkasId: "x", perkaraId: "1", sidangKe: 0, cetakFinal: false }, { pustaka })).rejects.toMatchObject({ status: 404 });
    await expect(susunNaskah(dbBerkas({ ...BERKAS, nama: "Uji.docx" }), { berkasId: "b1", perkaraId: "1", sidangKe: 0, cetakFinal: false }, { pustaka })).rejects.toMatchObject({ status: 422 });
    await expect(susunNaskah(dbBerkas({ ...BERKAS, status: "hilang" }), { berkasId: "b1", perkaraId: "1", sidangKe: 0, cetakFinal: false }, { pustaka })).rejects.toMatchObject({ status: 422 });
  });

  it("bot tidak terjangkau -> 502 dengan sebab, bukan naskah kosong", async () => {
    const h = await susunNaskah(dbBerkas(BERKAS), { berkasId: "b1", perkaraId: "9", sidangKe: 0, cetakFinal: false }, { pustaka, panggil: (async () => ({ ok: false, error: "bot mati" })) as never });
    expect(h).toMatchObject({ ok: false, status: 502, alasan: "bot mati" });
  });
});

describe("bandingkanRtf", () => {
  it("naskah yang sama dari dua sisi identik penuh walau kode RTF-nya berbeda", () => {
    const a = Buffer.from("{\\rtf1\\ansi\\paperw11906\\paperh16838 {\\b Nama} Siti\\par Alamat Palu\\par}", "latin1");
    const b = Buffer.from("{\\rtf1\\ansi\\paperw11906\\paperh16838 \\b Nama\\b0  Siti\\par Alamat  Palu\\par}", "latin1");
    const h = bandingkanRtf(a, b);
    expect(h.alinea).toMatchObject({ identik: 2, total: 2, persen: 100 });
  });
});

describe("jembatan bot blangko.isiPustaka", () => {
  const p = (o: Record<string, unknown> = {}) => jembatan.handleBridgeOperation("blangko.isiPustaka", o);
  it("menolak masukan rusak tanpa menyentuh basis data", async () => {
    expect(await p()).toMatchObject({ ok: false, sebab: "Pustaka ALETA ABT tidak dikirim." });
    expect(await p({ jalurAleta: { pustaka: {} } })).toMatchObject({ ok: false, sebab: "Perkara tidak disebut." });
    expect(await p({ jalurAleta: { pustaka: {} }, perkaraId: "5" })).toMatchObject({ ok: false });
    expect(await p({ jalurAleta: { pustaka: {} }, perkaraId: "5", rtfBase64: Buffer.from("bukan rtf").toString("base64") })).toMatchObject({ ok: false, sebab: "Blangko ini bukan RTF." });
  });

  it("jalur lama blangko.isi tetap terpasang pada fungsi yang sama dan tidak memuat pustaka baru", () => {
    const sumber = readFileSync(path.join(AKAR, "aleta_bot/services/sippReadOnlyBridgeService.js"), "latin1");
    expect(sumber).toContain('"blangko.isi": isiBlangko,');
    const awal = sumber.indexOf("async function isiBlangko(params = {})");
    const akhir = sumber.indexOf("async function isiBlangkoPustaka(");
    expect(awal).toBeGreaterThan(0);
    expect(akhir).toBeGreaterThan(awal);
    const badan = sumber.slice(awal, akhir);
    expect(badan).not.toContain("params.rtfBase64");
    expect(badan).not.toContain("isiBlangkoPustaka");
  });
});
