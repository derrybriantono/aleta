// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { amarDariDokumen, cocokkanPutusan, nominalRupiah, tanggalDariDokumen } from "@/lib/cocok-putusan";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_COCOK_PUTUSAN } from "@/server/db/schema";
import { daftarBedaPutusan, periksaCocokPutusan, type DepsCocokPutusan } from "@/server/modules/aleta-ecourt/cocok-putusan";
import { periksaPutusanDokumen } from "@/server/modules/kesehatan/pemeriksa";

/**
 * G4 4.3 (30 Okt 2026) - putusan SIPP vs dokumen putusan yang diunggah. Hanya membaca SIPP.
 * Diukur dahulu atas 5 putusan sungguhan yang diunggah lewat Putusan Terjadwal (cadangan 28 Okt) terhadap
 * sipp_2810: 5/5 cocok (liputan 1), 0 peringatan palsu; 2 draf JLF yang variabelnya masih kosong = beda (benar).
 * Uji ini memakai teks sintetis berbentuk sama (tanpa nama pihak sungguhan).
 */

const AMAR_SIPP = `<p>1. Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir;</p>

<p>2. Mengabulkan gugatan Penggugat secara verstek;</p>

<p>3. Menjatuhkan talak satu ba&#39;in shughra Tergugat (Fulan bin Fulan) terhadap Penggugat (Fulanah binti Fulan);</p>

<p>4. Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp258.500,00 (dua ratus lima puluh delapan ribu lima ratus rupiah).</p>`;

function dokumen(o: { tanggal?: string; biaya?: string; butir3?: string; mengadili?: string } = {}) {
  return [
    "P U T U S A N",
    "Nomor 601/Pdt.G/2026/PA.Dgl",
    "DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA",
    "Menimbang, bahwa berdasarkan pertimbangan di atas gugatan Penggugat patut dikabulkan;",
    o.mengadili ?? "M E N G A D I L I",
    "Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir;",
    "Mengabulkan gugatan Penggugat secara verstek;",
    o.butir3 ?? "Menjatuhkan talak satu ba'in sughra Tergugat (Fulan bin Fulan) terhadap Penggugat (Fulanah binti Fulan);",
    `Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah ${o.biaya ?? "Rp258.500,00"} (dua ratus lima puluh delapan ribu lima ratus rupiah).`,
    `Demikian diputuskan dalam rapat permusyawaratan Majelis Hakim pada hari Selasa tanggal ${o.tanggal ?? "27 Oktober 2026"} Masehi, bertepatan dengan tanggal 5 Jumadil Awal 1448 Hijriah,`,
    "Rincian Biaya Perkara:",
    "1. PNBP : Rp30.000,00",
  ].join("\n");
}

describe("aturan pencocokan (murni)", () => {
  it("bentuk sungguhan: cocok walau ejaan shughra/sughra, penomoran, entitas HTML, judul berspasi berbeda", () => {
    const h = cocokkanPutusan({ tanggalPutusanSipp: "2026-10-27", amarSippHtml: AMAR_SIPP, teksDokumen: dokumen() });
    expect(h).toMatchObject({ keadaan: "cocok", beda: [] });
    expect(h.liputan).toBeGreaterThanOrEqual(0.95);
  });

  it("tanggal putusan berbeda", () => {
    const h = cocokkanPutusan({ tanggalPutusanSipp: "2026-10-27", amarSippHtml: AMAR_SIPP, teksDokumen: dokumen({ tanggal: "28 Oktober 2026" }) });
    expect(h.keadaan).toBe("beda");
    expect(h.beda).toEqual([expect.objectContaining({ bagian: "tanggal", sipp: "27 Oktober 2026", dokumen: "28 Oktober 2026" })]);
  });

  it("nominal biaya berbeda; angka rincian biaya sesudah amar tidak ikut", () => {
    const h = cocokkanPutusan({ tanggalPutusanSipp: "2026-10-27", amarSippHtml: AMAR_SIPP, teksDokumen: dokumen({ biaya: "Rp285.500,00" }) });
    expect(h.beda.map((b) => b.bagian)).toEqual(["nominal"]);
    expect(h.beda[0]).toMatchObject({ sipp: "Rp258.500,00", dokumen: "Rp285.500,00" });
    expect(nominalRupiah(amarDariDokumen(dokumen()))).toEqual([258500]);
  });

  it("isi amar berbeda (butir hilang/diganti)", () => {
    const h = cocokkanPutusan({ tanggalPutusanSipp: "2026-10-27", amarSippHtml: AMAR_SIPP, teksDokumen: dokumen({ butir3: "Menolak gugatan Penggugat untuk selebihnya serta menyatakan perkawinan putus karena perceraian dengan segala akibatnya;" }) });
    expect(h.beda.map((b) => b.bagian)).toEqual(["amar"]);
    expect(h.beda[0].sipp).toContain("talak");
  });

  it("MENGADILI terakhir (putusan sela di depan); tanpa MENGADILI / tanpa penutup = tidak terbaca, bukan beda", () => {
    const sela = `MENGADILI\nMenangguhkan pembebanan biaya perkara hingga putusan akhir;\n${dokumen({ mengadili: "MENGADILI" })}`;
    expect(cocokkanPutusan({ tanggalPutusanSipp: "2026-10-27", amarSippHtml: AMAR_SIPP, teksDokumen: sela }).keadaan).toBe("cocok");
    expect(cocokkanPutusan({ tanggalPutusanSipp: "2026-10-27", amarSippHtml: AMAR_SIPP, teksDokumen: "putusan tanpa bagian amar" }).keadaan).toBe("tidak-terbaca");
    expect(amarDariDokumen("MENGADILI\nMengabulkan gugatan")).toBe("");
    expect(cocokkanPutusan({ tanggalPutusanSipp: "", amarSippHtml: AMAR_SIPP, teksDokumen: dokumen() }).keadaan).toBe("belum-putus");
    expect(cocokkanPutusan({ tanggalPutusanSipp: "2026-10-27", amarSippHtml: AMAR_SIPP, teksDokumen: null }).keadaan).toBe("tanpa-dokumen");
    expect(tanggalDariDokumen(dokumen())).toBe("2026-10-27");
  });

  it("amar SIPP kosong = beda", () => {
    expect(cocokkanPutusan({ tanggalPutusanSipp: "2026-10-27", amarSippHtml: "", teksDokumen: dokumen() }).beda[0]).toMatchObject({ bagian: "amar", sipp: "(kosong)" });
  });
});

async function pdfDari(teks: string) {
  const pdf = await PDFDocument.create();
  const huruf = await pdf.embedFont(StandardFonts.Helvetica);
  const hal = pdf.addPage([595, 842]);
  teks.split("\n").forEach((baris, i) => hal.drawText(baris.replace(/'/g, "'").slice(0, 110), { x: 30, y: 800 - i * 16, size: 8, font: huruf }));
  return new Uint8Array(await pdf.save());
}

describe("server: dokumen e-Doc PDF/RTF, singgah, Pusat Kesehatan", () => {
  let db: AletaDatabase | null = null;
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  function deps(o: { amar?: string; tanggal?: string; bita?: Uint8Array | null; nama?: string }, hitung: { berkas: number }): DepsCocokPutusan {
    return {
      bahan: async () => ({ ok: true, data: { ok: true, perkaraId: 10154, nomorPerkara: "601/Pdt.G/2026/PA.Dgl", tanggalPutusan: o.tanggal ?? "2026-10-27", amarPutusan: o.amar ?? AMAR_SIPP, namaBerkas: o.nama ?? "PA.Dgl_2026_Pdt.G_601_putusan_akhir.pdf", adaBerkas: o.bita !== null } }),
      berkas: async () => {
        hitung.berkas += 1;
        return o.bita ?? null;
      },
    };
  }

  it("PDF e-Doc dibaca (pdfjs), hasil disimpan, pembukaan berikut dari singgah; amar berubah = diperiksa ulang", async () => {
    const hitung = { berkas: 0 };
    const bita = await pdfDari(dokumen({ biaya: "Rp285.500,00" }));
    const a = await periksaCocokPutusan(db!, "10154", deps({ bita }, hitung));
    expect(a).toMatchObject({ keadaan: "beda", dariSinggah: false, nomorPerkara: "601/Pdt.G/2026/PA.Dgl" });
    expect(a.beda.map((b) => b.bagian)).toEqual(["nominal"]);
    const b = await periksaCocokPutusan(db!, "10154", deps({ bita }, hitung));
    expect(b).toMatchObject({ keadaan: "beda", dariSinggah: true });
    const c = await periksaCocokPutusan(db!, "10154", deps({ bita, amar: AMAR_SIPP.replace("Rp258.500,00", "Rp285.500,00") }, hitung));
    expect(c).toMatchObject({ keadaan: "cocok", dariSinggah: false });
    const baris = await db!.queryAll<{ keadaan: string }>("SELECT keadaan FROM aleta_cocok_putusan WHERE perkara_id = '10154'");
    expect(baris).toEqual([{ keadaan: "cocok" }]);
  });

  it("RTF e-Doc; belum ada dokumen; Pusat Kesehatan menyebut yang beda", async () => {
    const rtf = `{\\rtf1\\ansi ${dokumen({ tanggal: "28 Oktober 2026" }).split("\n").join("\\par ")}}`;
    const hitung = { berkas: 0 };
    const h = await periksaCocokPutusan(db!, "10154", deps({ bita: new TextEncoder().encode(rtf), nama: "x.rtf" }, hitung));
    expect(h.beda.map((b) => b.bagian)).toEqual(["tanggal"]);
    const tanpa = await periksaCocokPutusan(db!, "999", { ...deps({ bita: null }, hitung), bahan: async () => ({ ok: true, data: { ok: true, nomorPerkara: "1/Pdt.G/2026/PA.Dgl", tanggalPutusan: "2026-10-27", amarPutusan: AMAR_SIPP, adaBerkas: false } }) });
    expect(tanpa.keadaan).toBe("tanpa-dokumen");
    const daftar = await daftarBedaPutusan(db!);
    expect(daftar.map((d) => d.nomor_perkara)).toEqual(["601/Pdt.G/2026/PA.Dgl"]);
    const k = periksaPutusanDokumen(daftar, new Date());
    expect(k.warna).toBe("kuning");
    expect(k.rincian[0]).toMatchObject({ label: "601/Pdt.G/2026/PA.Dgl" });
    expect(periksaPutusanDokumen([], new Date()).warna).toBe("kelabu");
  });

  it("DDL 0117 = cermin schema.ts; terdaftar di jurnal dan urutan simpan pg-mem", () => {
    const AKAR = path.resolve(process.cwd());
    const sql = readFileSync(path.join(AKAR, "drizzle/0117_aleta_cocok_putusan.sql"), "utf8");
    const rapat = (t: string) => t.replace(/--.*$/gm, "").replace(/;/g, " ").replace(/\s+/g, " ").trim();
    expect(rapat(sql)).toBe(rapat([...DDL_COCOK_PUTUSAN.tabel, ...DDL_COCOK_PUTUSAN.indeks].join(" ")));
    const jurnal = JSON.parse(readFileSync(path.join(AKAR, "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string }> };
    expect(jurnal.entries.filter((e) => e.tag === "0117_aleta_cocok_putusan").map((e) => e.idx)).toEqual([103]);
    expect(new Set(jurnal.entries.map((e) => e.idx)).size).toBe(jurnal.entries.length);
    expect(readFileSync(path.join(AKAR, "src/server/db/client.ts"), "utf8")).toContain('"aleta_cocok_putusan"');
  });
});
