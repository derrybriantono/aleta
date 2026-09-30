// @vitest-environment node
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  PERINGATAN_EKSTRAKSI_PDF,
  kenaliBentukNaskah,
  konversiNaskah,
  teksKeRtf,
} from "@/server/modules/aleta-ecourt/konversi-naskah";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * KONTRAK K1 - KONVERSI NASKAH (butir 8 dan 11, 30 September 2026)
 * ============================================================================
 *
 * Portal: bentuk dikenali dari kepala berkas; RTF/DOC/DOCX lewat soffice di
 * bot; PDF lewat ekstraksi teks (PDF sungguhan dibuat pdf-lib di sini) dengan
 * peringatan tata letak. Bot: dokumenKeBentuk dijalankan SUNGGUHAN dengan
 * pengganti soffice (tidak ada LibreOffice di laptop pengembang).
 */

const RTF = new TextEncoder().encode("{\\rtf1\\ansi Menimbang, bahwa ...\\par}");
const DOCX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6]);
const DOC = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);

async function pdfBerteks(baris: string[]) {
  const dok = await PDFDocument.create();
  const huruf = await dok.embedFont(StandardFonts.TimesRoman);
  const hal = dok.addPage([595, 842]);
  baris.forEach((t, i) => hal.drawText(t, { x: 50, y: 780 - i * 20, size: 12, font: huruf }));
  return new Uint8Array(await dok.save());
}

type Panggilan = { berkasBase64: string; ke: string };
function gerbangPalsu(jawab: (p: Panggilan) => Uint8Array | { gagal: string; status: number; kode?: string }) {
  const panggilan: Panggilan[] = [];
  const fungsi = vi.fn(async (p: Panggilan) => {
    panggilan.push(p);
    const h = jawab(p);
    if (h instanceof Uint8Array) {
      return { ok: true as const, data: { ok: true, berkasBase64: Buffer.from(h).toString("base64"), ke: p.ke } };
    }
    return { ok: false as const, error: h.gagal, status: h.status, ...(h.kode ? { kode: h.kode } : {}) };
  });
  return { fungsi, panggilan };
}

describe("K1 portal - konversiNaskah", () => {
  it("bentuk dikenali dari kepala berkas, bukan dari nama", () => {
    expect(kenaliBentukNaskah(RTF)).toBe("rtf");
    expect(kenaliBentukNaskah(DOCX)).toBe("docx");
    expect(kenaliBentukNaskah(DOC)).toBe("doc");
    expect(kenaliBentukNaskah(new TextEncoder().encode("%PDF-1.7"))).toBe("pdf");
    expect(kenaliBentukNaskah(new TextEncoder().encode("hello world"))).toBe("");
  });

  it("DOCX -> RTF lewat bot: bita ASLI dikirim, hasil bentuk tujuan, nama & mime benar", async () => {
    const g = gerbangPalsu(() => RTF);
    const h = await konversiNaskah({ bita: DOCX, namaBerkas: "Putusan 459.docx", ke: "rtf" }, { gerbang: g.fungsi as never });
    expect(g.panggilan).toHaveLength(1);
    expect(g.panggilan[0].ke).toBe("rtf");
    expect(Buffer.from(g.panggilan[0].berkasBase64, "base64")).toEqual(Buffer.from(DOCX));
    expect(h).toMatchObject({ namaBerkas: "Putusan 459.rtf", mime: "application/rtf", bentukAsal: "docx", peringatan: [] });
    expect(Buffer.from(h.berkasBase64, "base64").subarray(0, 5).toString("latin1")).toBe("{\\rtf");
  });

  it("RTF -> DOC dan -> PDF memakai bot dengan ke yang diminta", async () => {
    const g = gerbangPalsu((p) => (p.ke === "doc" ? DOC : new TextEncoder().encode("%PDF-1.4 x")));
    expect((await konversiNaskah({ bita: RTF, namaBerkas: "a.rtf", ke: "doc" }, { gerbang: g.fungsi as never })).mime).toBe(
      "application/msword"
    );
    expect((await konversiNaskah({ bita: RTF, namaBerkas: "a.rtf", ke: "pdf" }, { gerbang: g.fungsi as never })).mime).toBe(
      "application/pdf"
    );
    expect(g.panggilan.map((p) => p.ke)).toEqual(["doc", "pdf"]);
  });

  it("bentuk sama: dikembalikan apa adanya, bot TIDAK dipanggil", async () => {
    const g = gerbangPalsu(() => RTF);
    const h = await konversiNaskah({ bita: RTF, namaBerkas: "x.rtf", ke: "rtf" }, { gerbang: g.fungsi as never });
    expect(g.fungsi).not.toHaveBeenCalled();
    expect(Buffer.from(h.berkasBase64, "base64")).toEqual(Buffer.from(RTF));
  });

  it("PDF -> RTF: ekstraksi teks, TANPA bot, dengan peringatan tata letak", async () => {
    const pdf = await pdfBerteks(["PUTUSAN Nomor 459/Pdt.G/2026/PA.Dgl", "Menimbang, bahwa {Penggugat} ..."]);
    const g = gerbangPalsu(() => RTF);
    const h = await konversiNaskah({ bita: pdf, namaBerkas: "putusan.pdf", ke: "rtf" }, { gerbang: g.fungsi as never });
    expect(g.fungsi).not.toHaveBeenCalled();
    expect(h.bentukAsal).toBe("pdf");
    expect(h.peringatan).toContain(PERINGATAN_EKSTRAKSI_PDF);
    const rtf = Buffer.from(h.berkasBase64, "base64").toString("latin1");
    expect(rtf.startsWith("{\\rtf1")).toBe(true);
    expect(rtf).toContain("459/Pdt.G/2026/PA.Dgl");
    // Kurung kurawal di teks di-escape - RTF-nya tetap sah.
    expect(rtf).toContain("\\{Penggugat\\}");
  });

  it("PDF -> DOCX: ekstraksi teks menjadi RTF, lalu RTF itu yang dikirim ke bot", async () => {
    const pdf = await pdfBerteks(["Menimbang, bahwa ..."]);
    const g = gerbangPalsu(() => DOCX);
    const h = await konversiNaskah({ bita: pdf, namaBerkas: "p.pdf", ke: "docx" }, { gerbang: g.fungsi as never });
    expect(Buffer.from(g.panggilan[0].berkasBase64, "base64").subarray(0, 5).toString("latin1")).toBe("{\\rtf");
    expect(h.namaBerkas).toBe("p.docx");
    expect(h.peringatan).toContain(PERINGATAN_EKSTRAKSI_PDF);
  });

  it("PDF tanpa teks (pindaian) ditolak 422, bukan RTF kosong", async () => {
    const dok = await PDFDocument.create();
    dok.addPage();
    const kosong = new Uint8Array(await dok.save());
    await expect(konversiNaskah({ bita: kosong, namaBerkas: "s.pdf", ke: "rtf" })).rejects.toMatchObject({ status: 422 });
  });

  it("masukan salah: ke tak dikenal 400, isi tak dikenal 400, kosong 400, terlalu besar 413", async () => {
    await expect(konversiNaskah({ bita: RTF, namaBerkas: "a", ke: "odt" })).rejects.toMatchObject({ status: 400 });
    await expect(konversiNaskah({ bita: new TextEncoder().encode("bukan naskah"), namaBerkas: "a.rtf", ke: "pdf" })).rejects.toMatchObject({
      status: 400,
    });
    await expect(konversiNaskah({ bita: new Uint8Array(), namaBerkas: "a", ke: "rtf" })).rejects.toBeInstanceOf(ApiError);
    const besar = new Uint8Array(20 * 1024 * 1024 + 1);
    besar.set(RTF);
    await expect(konversiNaskah({ bita: besar, namaBerkas: "a", ke: "pdf" })).rejects.toMatchObject({ status: 413 });
  });

  it("bot gagal (soffice tidak ada) -> 503 dengan sebabnya; bot memulangkan bentuk salah -> 502", async () => {
    const mati = gerbangPalsu(() => ({ gagal: "soffice tidak ada di dalam container bot.", status: 503, kode: "soffice_tidak_ada" }));
    await expect(konversiNaskah({ bita: RTF, namaBerkas: "a", ke: "pdf" }, { gerbang: mati.fungsi as never })).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("soffice tidak ada"),
    });
    const salah = gerbangPalsu(() => RTF);
    await expect(konversiNaskah({ bita: RTF, namaBerkas: "a", ke: "docx" }, { gerbang: salah.fungsi as never })).rejects.toMatchObject({
      status: 502,
    });
  });

  it("teksKeRtf: huruf di luar ASCII sebagai \\uN?, garis miring terbalik di-escape", () => {
    const rtf = teksKeRtf(["Ma'ruf é \\ tab\there"]);
    expect(rtf).toContain("\\u233?");
    expect(rtf).toContain("\\\\");
    expect(rtf).toContain("\\tab ");
    expect(rtf.endsWith("}")).toBe(true);
  });
});

// ============================================================================
// RUTE - handler sungguhan
// ============================================================================
let db: AletaDatabase | null = null;
let aktor: string | null = "usr-ppg";
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

describe("K1 rute POST /api/aleta-ecourt/putusan/konversi-naskah", () => {
  // Satu basis data berbenih untuk ketiga uji - membuatnya berat, dan rute ini
  // tidak menulis apa pun ke ALETA.
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  }, 600_000);
  beforeEach(() => {
    aktor = "usr-ppg";
  });
  afterAll(async () => {
    await db?.close();
    db = null;
  });

  async function kirim(bita: Uint8Array | null, ke: string) {
    const { POST } = await import("@/app/api/aleta-ecourt/putusan/konversi-naskah/route");
    const f = new FormData();
    if (bita) f.set("berkas", new File([Buffer.from(bita)], "naskah.rtf"));
    f.set("ke", ke);
    const res = await POST(new NextRequest("http://localhost/api/x", { method: "POST", body: f }));
    return { status: res.status, isi: (await res.json()) as { ok: boolean; data?: Record<string, unknown>; error?: { message: string } } };
  }

  it("tanpa sesi: 401", async () => {
    aktor = null;
    expect((await kirim(RTF, "rtf")).status).toBe(401);
  });

  it("pegawai biasa yang masuk: 200 dengan bentuk data K1 persis", async () => {
    const r = await kirim(RTF, "rtf");
    expect(r.status).toBe(200);
    expect(Object.keys(r.isi.data!).sort()).toEqual(["bentukAsal", "berkasBase64", "mime", "namaBerkas", "peringatan"]);
  });

  it("tanpa berkas: 400 berpesan jelas", async () => {
    const r = await kirim(null, "rtf");
    expect(r.status).toBe(400);
    expect(r.isi.error?.message).toContain("Berkasnya belum dipilih");
  });
});

// ============================================================================
// BOT - dokumenKeBentuk dengan pengganti soffice
// ============================================================================
const AKAR_BOT = path.resolve(__dirname, "../../../aleta_bot");
const muatBot = createRequire(path.join(AKAR_BOT, "package.json"));
type Cetak = {
  dokumenKeBentuk: (isi: Buffer, ke: string, opsi?: Record<string, unknown>) => Promise<Record<string, any>>;
  argumenKonversi: (ke: string, asal: string, folder: string) => string[];
};
const cetak = () => muatBot("./services/abtCetakService.js") as Cetak;
const mesinAda = async () => ({ ada: true, versi: "LibreOffice uji" });

/** Pengganti soffice: menulis berkas hasil sesuai argumen --convert-to. */
function sofficePalsu(isiHasil: Buffer) {
  const argumen: string[][] = [];
  const jalankan = async (_perintah: string, arg: string[]) => {
    argumen.push(arg);
    const i = arg.indexOf("--convert-to");
    const ke = arg[i + 1].split(":")[0];
    const folder = arg[arg.indexOf("--outdir") + 1];
    await writeFile(path.join(folder, `naskah.${ke}`), isiHasil);
    return { keluaran: "", galatKeluaran: "" };
  };
  return { jalankan, argumen };
}

describe("K1 bot - abtCetakService.dokumenKeBentuk", () => {
  it("filter soffice per bentuk tujuan", () => {
    const a = cetak().argumenKonversi("docx", "/t/naskah.rtf", "/t");
    expect(a).toContain("docx:MS Word 2007 XML");
    expect(a.slice(0, 2)).toEqual(["--headless", "--norestore"]);
    expect(cetak().argumenKonversi("rtf", "/t/n.docx", "/t")).toContain("rtf:Rich Text Format");
    expect(cetak().argumenKonversi("doc", "/t/n.rtf", "/t")).toContain("doc:MS Word 97");
  });

  it("RTF -> DOCX: soffice dijalankan, hasilnya diperiksa dari kepala berkas", async () => {
    const s = sofficePalsu(Buffer.from(DOCX));
    const h = await cetak().dokumenKeBentuk(Buffer.from(RTF), "docx", { jalankan: s.jalankan, periksaMesin: mesinAda });
    expect(h.ok).toBe(true);
    expect(h.bentukAsal).toBe("rtf");
    expect(Buffer.from(h.berkas).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(s.argumen[0]).toContain("docx:MS Word 2007 XML");
  });

  it("hasil yang bukan bentuk tujuan ditolak, walau soffice 'selesai'", async () => {
    const s = sofficePalsu(Buffer.from("kosong"));
    const h = await cetak().dokumenKeBentuk(Buffer.from(RTF), "docx", { jalankan: s.jalankan, periksaMesin: mesinAda });
    expect(h).toMatchObject({ ok: false, kode: "hasil_bukan_bentuk_tujuan" });
  });

  it("PDF sebagai asal tidak dibuka soffice; bentuk sama dikembalikan apa adanya; tujuan asing ditolak", async () => {
    const s = sofficePalsu(Buffer.from(DOCX));
    expect(
      await cetak().dokumenKeBentuk(Buffer.from("%PDF-1.4 x"), "rtf", { jalankan: s.jalankan, periksaMesin: mesinAda })
    ).toMatchObject({ ok: false, kode: "pdf_perlu_ekstraksi" });
    const sama = await cetak().dokumenKeBentuk(Buffer.from(RTF), "rtf", { jalankan: s.jalankan, periksaMesin: mesinAda });
    expect(sama.ok).toBe(true);
    expect(s.argumen).toHaveLength(0);
    expect((await cetak().dokumenKeBentuk(Buffer.from(RTF), "odt")).kode).toBe("bentuk_tujuan_tidak_dikenal");
  });

  it("soffice tidak ada: kode soffice_tidak_ada (gerbang menjawab 503)", async () => {
    const h = await cetak().dokumenKeBentuk(Buffer.from(RTF), "pdf", {
      periksaMesin: async () => ({ ada: false, sebab: "soffice tidak ada di dalam container bot." }),
    });
    expect(h).toMatchObject({ ok: false, kode: "soffice_tidak_ada" });
  });

  it("gerbang: rute /naskah/konversi ada, bertoken internal, dan berbatas JSON 28 MB", async () => {
    const { readFileSync } = await import("node:fs");
    const gerbang = readFileSync(path.join(AKAR_BOT, "routes/internalGatewayRoutes.js"), "utf8");
    expect(gerbang).toContain('router.post("/naskah/konversi", requireInternalToken');
    const app = readFileSync(path.join(AKAR_BOT, "app.js"), "utf8");
    expect(app).toContain('app.use("/internal/aleta-bot/naskah/konversi", express.json({ limit: "28mb" }));');
    // Pengurai berbatas besar harus dipasang SEBELUM pengurai umum 1 MB.
    expect(app.indexOf("/internal/aleta-bot/naskah/konversi")).toBeLessThan(app.indexOf('app.use(express.json({ limit: "1mb" }));'));
  });
});
