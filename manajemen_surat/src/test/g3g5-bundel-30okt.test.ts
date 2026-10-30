// @vitest-environment node
/**
 * ============================================================================
 * 5.1 BUNDEL SATU PDF PER PERKARA (30 Okt 2026)
 * ============================================================================
 *
 * Perilaku, bukan teks kode: PDF sungguhan dibuat dengan pdf-lib, dibaca bot dari cakram tiruan, digabung portal, lalu halaman
 * hasilnya dibaca kembali (jumlah halaman dan nomor yang tercetak di tiap halaman). Tidak ada yang ditulis ke SIPP/ABT.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream, type PDFPage } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { susunBundel, titikTampilan } from "@/lib/bundel-berkas";

const AKAR = path.resolve(__dirname, "../../..");
const bot: any = createRequire(import.meta.url)(path.join(AKAR, "aleta_bot/services/berkasPerkaraService.js"));
const TMP = path.join("D:/Aplikasi/aleta/tmp", `g3g5-bundel-${process.pid}`);

async function pdfHalaman(n: number, judul = "x"): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (let i = 0; i < n; i += 1) d.addPage([400, 600]).drawText(`${judul} ${i + 1}`, { x: 20, y: 500 });
  return d.save();
}

/** Teks yang tergambar di satu halaman (hex Tj dari pdf-lib didekode). */
function teksHalaman(h: PDFPage): string {
  const isi = h.node.Contents();
  const aliran: unknown[] = [];
  const ref = (isi as any).asArray ? (isi as any).asArray() : [isi];
  for (const r of ref) aliran.push(h.doc.context.lookup(r));
  let semua = "";
  for (const a of aliran) {
    if (a instanceof PDFRawStream) semua += Buffer.from(decodePDFRawStream(a).decode()).toString("latin1");
    else if (a && typeof (a as any).getContents === "function") semua += Buffer.from((a as any).getContents()).toString("latin1");
  }
  const hasil: string[] = [];
  for (const m of semua.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) hasil.push(Buffer.from(m[1], "hex").toString("latin1"));
  for (const m of semua.matchAll(/\(([^)]*)\)\s*Tj/g)) hasil.push(m[1]);
  return hasil.join(" | ");
}

beforeAll(() => fs.mkdirSync(TMP, { recursive: true }));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

describe("susunBundel: nomor halaman sesuai daftar isi", () => {
  it("sampul dan daftar isi tak bernomor; dokumen bernomor dari 'awal'; dokumen tanpa PDF diganti halaman penanda; selisih halaman dilaporkan", async () => {
    const hasil = await susunBundel({
      sampul: await pdfHalaman(1, "SAMPUL"),
      daftarIsi: await pdfHalaman(1, "DAFTAR"),
      baris: [
        { kunci: "gugatan", nama: "Surat Gugatan Penggugat", awal: 1, akhir: 3, berkas: [await pdfHalaman(3, "GUG")] },
        { kunci: "relaas:1:p", nama: "Relaas Panggilan Penggugat ke 1", awal: 4, akhir: 5, berkas: [], bukanPdf: 1 },
        { kunci: "bas:1", nama: "Berita Acara Sidang Pertama", awal: 6, akhir: 7, berkas: [await pdfHalaman(3, "BAS")] },
        { kunci: "putusan", nama: "Putusan", awal: 8, akhir: 9, berkas: [await pdfHalaman(1, "P1"), await pdfHalaman(1, "P2")] },
      ],
      judul: "Berkas Perkara 5/Pdt.G/2026/PA.Cth",
    });
    // 1 sampul + 1 daftar isi + 3 gugatan + 2 penanda + 3 BAS + 2 putusan
    expect(hasil.halaman).toBe(12);
    expect(hasil.halamanSampul).toBe(1);
    expect(hasil.halamanDaftarIsi).toBe(1);
    const doc = await PDFDocument.load(hasil.pdf);
    const hal = doc.getPages();
    expect(hal).toHaveLength(12);
    const teks = hal.map(teksHalaman);
    expect(teks[0]).not.toMatch(/Hlm\./);
    expect(teks[1]).not.toMatch(/Hlm\./);
    // gugatan 1-3 (halaman 3..5), penanda 4-5, BAS 6-8 (3 halaman walau daftar isi menyebut 2), putusan 8-9
    expect(teks.slice(2, 5).map((t) => /Hlm\. (\d+)/.exec(t)?.[1])).toEqual(["1", "2", "3"]);
    expect(teks.slice(5, 7).map((t) => /Hlm\. (\d+)/.exec(t)?.[1])).toEqual(["4", "5"]);
    expect(teks[5]).toMatch(/DOKUMEN BELUM ADA DALAM BENTUK PDF/);
    expect(teks[5]).toMatch(/Relaas Panggilan Penggugat ke 1/);
    expect(teks.slice(7, 10).map((t) => /Hlm\. (\d+)/.exec(t)?.[1])).toEqual(["6", "7", "8"]);
    expect(teks.slice(10, 12).map((t) => /Hlm\. (\d+)/.exec(t)?.[1])).toEqual(["8", "9"]);
    expect(hasil.peringatan.some((w) => /Berita Acara Sidang Pertama: daftar isi menyebut 2 halaman, berkasnya 3/.test(w))).toBe(true);
    expect(hasil.peringatan.some((w) => /Relaas Panggilan Penggugat ke 1: belum ada PDF-nya/.test(w))).toBe(true);
    expect(hasil.baris.find((b) => b.kunci === "relaas:1:p")).toMatchObject({ penanda: true, halamanAsli: 0 });
    // metadata tanpa nama aplikasi
    expect(doc.getProducer() ?? "").not.toMatch(/aleta/i);
    expect(doc.getCreator() ?? "").not.toMatch(/aleta/i);
  });

  it("PDF rusak tidak menggagalkan bundel: dilaporkan dan baris itu diganti penanda; sampul rusak dilewati", async () => {
    const hasil = await susunBundel({
      sampul: new Uint8Array([1, 2, 3]),
      daftarIsi: null,
      baris: [{ kunci: "bas:1", nama: "BAS 1", awal: 1, akhir: 1, berkas: [new Uint8Array([9, 9, 9])] }],
    });
    expect(hasil.halaman).toBe(1);
    expect(hasil.peringatan.join("\n")).toMatch(/Sampul tidak dapat dibaca/);
    expect(hasil.peringatan.join("\n")).toMatch(/1 berkas PDF rusak/);
    expect(hasil.baris[0].penanda).toBe(true);
  });

  it("halaman terputar (/Rotate) tetap menerima nomor di pojok kanan bawah tampilan", () => {
    // halaman 400x600 diputar 90 derajat: tampilan 600x400; pojok kanan bawah tampilan (600,0) = pojok kanan atas ruang pengguna
    expect(titikTampilan(400, 600, 0, 10, 20)).toEqual({ x: 10, y: 20, derajat: 0 });
    expect(titikTampilan(400, 600, 90, 600, 0)).toEqual({ x: 400, y: 600, derajat: 90 });
    expect(titikTampilan(400, 600, 180, 0, 0)).toEqual({ x: 400, y: 600, derajat: 180 });
    expect(titikTampilan(400, 600, 270, 0, 0)).toEqual({ x: 0, y: 600, derajat: 270 });
  });
});

describe("bot: bahan berkas tiap baris daftar isi", () => {
  const DEPS = (kunciBas: string) => {
    const kueri = async (t: string) => {
      if (/FROM perkara WHERE perkara_id/.test(t)) return [{ perkara_id: 5, nomor_perkara: "5/Pdt.G/2026/PA.Cth", jenis_perkara_id: 347, alur_perkara_id: 15, prodeo: 0, tanggal_pendaftaran: "2026-01-05", tanggal_surat: "2026-01-04", petitum: "", posita: "" }];
      if (/FROM perkara_jadwal_sidang/.test(t)) return [{ id: 1, tanggal_sidang: "2026-02-01", agenda: "Pembacaan gugatan", alasan_ditunda: "", sidang_keliling: "T", dihadiri_oleh: 1, ikrar_talak: "T", verzet: "T", edoc_bas: kunciBas }];
      return [];
    };
    return {
      kueri,
      akarSipp: [path.join(TMP, "sipp")],
      akarEcourt: path.join(TMP, "ecourt"),
      tanpaCache: true,
      penanda: { bahanPenanda: async () => ({ terbaca: {} }), ruasBaris: () => ({ penandaPerkara: {}, penandaPihak: [] }) },
      kumulasi: { kumulasiBanyakPerkara: async () => ({}) },
    };
  };

  it("jalur berkas hanya keluar bila diminta dan tidak pernah bocor ke daftar dokumen; periksa menghitung halaman asli; isi mengembalikan PDF-nya", async () => {
    fs.mkdirSync(path.join(TMP, "sipp/resources/file/doc/2026"), { recursive: true });
    fs.mkdirSync(path.join(TMP, "ecourt/5-Pdt.G-2026-PA.Cth"), { recursive: true });
    fs.writeFileSync(path.join(TMP, "sipp/resources/file/doc/2026/bas1.pdf"), await pdfHalaman(2, "BAS"));
    fs.writeFileSync(path.join(TMP, "ecourt/5-Pdt.G-2026-PA.Cth/Surat Gugatan__ab12cd.pdf"), await pdfHalaman(3, "GUG"));
    const deps = DEPS("resources/file/doc/2026/bas1.pdf");

    const biasa = await bot.fakta({ perkaraId: 5 }, deps);
    expect(biasa.ok).toBe(true);
    expect("jalurPerKunci" in biasa).toBe(false);
    expect(JSON.stringify(biasa)).not.toContain("g3g5-bundel");

    const lengkap = await bot.fakta({ perkaraId: 5, denganJalur: true }, deps);
    expect(Object.keys(lengkap.jalurPerKunci)).toEqual(expect.arrayContaining(["bas:1", "gugatan"]));
    expect(lengkap.jalurPerKunci["bas:1"]).toHaveLength(1);
    expect(lengkap.jalurPerKunci["gugatan"][0]).toMatch(/Surat Gugatan__ab12cd\.pdf$/);
    // baris tanpa berkas tidak punya jalur (phs belum ada)
    expect(lengkap.jalurPerKunci["skum"]).toBeUndefined();

    const periksa = await bot.bundelBahan({ perkaraId: 5, kunci: ["bas:1", "gugatan", "skum", "../etc/passwd"], mode: "periksa" }, deps);
    expect(periksa.ok).toBe(true);
    const per = Object.fromEntries(periksa.dokumen.map((d: any) => [d.kunci, d]));
    expect(per["bas:1"]).toMatchObject({ pdf: 1, bukanPdf: 0, halaman: 2 });
    expect(per["gugatan"]).toMatchObject({ pdf: 1, halaman: 3 });
    expect(per["skum"]).toMatchObject({ berkas: 0, halaman: null });
    expect(per["../etc/passwd"]).toBeUndefined();
    expect(JSON.stringify(periksa)).not.toContain("g3g5-bundel");

    const isi = await bot.bundelBahan({ perkaraId: 5, kunci: ["bas:1"], mode: "isi" }, deps);
    expect(isi.ok).toBe(true);
    expect(isi.berkas).toHaveLength(1);
    const doc = await PDFDocument.load(Buffer.from(isi.berkas[0].base64, "base64"));
    expect(doc.getPageCount()).toBe(2);
  });

  it("berkas bukan PDF (RTF) tidak ikut isi tetapi terhitung sebagai bukanPdf", async () => {
    fs.mkdirSync(path.join(TMP, "sipp/resources/file/doc/2026"), { recursive: true });
    fs.writeFileSync(path.join(TMP, "sipp/resources/file/doc/2026/bas1.rtf"), "{\\rtf1 BAS}");
    const deps = DEPS("resources/file/doc/2026/bas1.rtf");
    const isi = await bot.bundelBahan({ perkaraId: 5, kunci: ["bas:1"], mode: "isi" }, deps);
    expect(isi.berkas).toHaveLength(0);
    expect(isi.bukanPdf["bas:1"]).toBe(1);
    const periksa = await bot.bundelBahan({ perkaraId: 5, kunci: ["bas:1"], mode: "periksa" }, deps);
    expect(periksa.dokumen[0]).toMatchObject({ pdf: 0, bukanPdf: 1, halaman: null });
  });
});

// --- rute portal dengan bot tiruan -------------------------------------------------------------------------------------
const panggilBot = vi.fn();
vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_1" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => ({ id: "usr_1" }) }));
vi.mock("@/server/modules/satker/fitur", () => ({ pastikanFiturMenyala: async () => undefined }));
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({ callAletaBotSippBridge: (...a: unknown[]) => panggilBot(...a) }));

describe("rute /sampul-berkas/bundel", () => {
  const permintaan = (badan: unknown) => ({ json: async () => badan, headers: new Headers(), nextUrl: new URL("http://x/api/aleta-ecourt/sampul-berkas/bundel") }) as any;

  it("periksa meneruskan ke bot dan menyaring kunci; susun menggabung per baris dan memulangkan satu PDF bernomor", async () => {
    const { POST } = await import("@/app/api/aleta-ecourt/sampul-berkas/bundel/route");
    const bas = Buffer.from(await pdfHalaman(2, "BAS")).toString("base64");
    panggilBot.mockReset();
    panggilBot.mockImplementation(async (_op: string, p: any) => {
      if (p.mode === "periksa") return { ok: true, data: { ok: true, dokumen: p.kunci.map((k: string) => ({ kunci: k, berkas: 1, pdf: 1, bukanPdf: 0, halaman: 2, ragu: false })) } };
      return { ok: true, data: { ok: true, berkas: p.kunci[0] === "bas:1" ? [{ kunci: "bas:1", base64: bas }] : [], bukanPdf: {} } };
    });
    const r1 = await POST(permintaan({ perkaraId: "5", aksi: "periksa", kunci: ["bas:1", "../x", "gugatan"] }));
    const j1 = await r1.json();
    expect(panggilBot.mock.calls[0][1].kunci).toEqual(["bas:1", "gugatan"]);
    expect((j1.data ?? j1).dokumen).toHaveLength(2);

    const sampul = Buffer.from(await pdfHalaman(1, "SAMPUL")).toString("base64");
    const daftar = Buffer.from(await pdfHalaman(1, "DAFTAR")).toString("base64");
    const r2 = await POST(
      permintaan({ perkaraId: "5", aksi: "susun", nomor: "5/Pdt.G/2026/PA.Cth", sampulPdfBase64: sampul, daftarIsiPdfBase64: daftar, baris: [{ kunci: "bas:1", nama: "BAS 1", awal: 1, akhir: 2 }, { kunci: "gugatan", nama: "Gugatan", awal: 3, akhir: 4 }, { kunci: "../jahat", nama: "x", awal: 5, akhir: 6 }] })
    );
    const j2 = (await r2.json()) as any;
    const d = j2.data ?? j2;
    expect(d.halaman).toBe(6); // sampul + daftar isi + BAS 2 + penanda gugatan 2 (kunci jahat dibuang)
    expect(d.baris.map((b: any) => b.kunci)).toEqual(["bas:1", "gugatan"]);
    expect(d.baris[1].penanda).toBe(true);
    const doc = await PDFDocument.load(Buffer.from(d.pdfBase64, "base64"));
    expect(doc.getPageCount()).toBe(6);
    // satu panggilan bot per baris (jembatan membawa berkas sebagai teks)
    const isiPanggilan = panggilBot.mock.calls.filter((c) => c[1].mode === "isi");
    expect(isiPanggilan.map((c) => c[1].kunci)).toEqual([["bas:1"], ["gugatan"]]);
  });

  it("tanpa baris sah ditolak; bot gagal dilaporkan, bukan bundel kosong", async () => {
    const { POST } = await import("@/app/api/aleta-ecourt/sampul-berkas/bundel/route");
    const r = await POST(permintaan({ perkaraId: "5", aksi: "susun", baris: [{ kunci: "../x", awal: 1, akhir: 1 }] }));
    expect(r.status).toBe(400);
    panggilBot.mockReset();
    panggilBot.mockResolvedValue({ ok: false, error: "bot mati" });
    const r2 = await POST(permintaan({ perkaraId: "5", aksi: "susun", baris: [{ kunci: "bas:1", nama: "BAS", awal: 1, akhir: 1 }] }));
    expect(r2.status).toBe(502);
    const r3 = await POST(permintaan({ perkaraId: "abc", aksi: "periksa", kunci: [] }));
    expect(r3.status).toBe(400);
  });
});
