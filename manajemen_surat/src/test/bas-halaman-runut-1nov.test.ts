// @vitest-environment node
/**
 * ============================================================================
 * 1 NOV 2026 - KEPUTUSAN PENGGUNA 71: NOMOR HALAMAN BAS RUNUT
 * ============================================================================
 *
 * BAS sidang pertama mulai halaman 1; tiap BAS berikutnya (sampai BAS putus) mulai dari halaman terakhir BAS sebelumnya + 1, termasuk
 * lompatan halaman bukti sesudah Z cross (keputusan 59: halaman Z + jumlah halaman bukti + 1). Urutan BAS = urutan sidang (bukan urutan
 * cetak); BAS sebelumnya yang belum tercatat -> dihitung dari yang ada + peringatan.
 *
 *   A  aturan murni (runut.ts)
 *   B  naskah: nomor awal RTF / DOCX (naskah.ts) - bagian pertama mulai N, nomor tetap di bagian lain jadi bersambung
 *   C  tiga BAS berurutan lewat jalur SUNGGUHAN (pasangRunut -> sesuaikanZcross -> catatRunut, basis data pg-mem, mesin PDF palsu
 *      berhalaman diketahui): tanpa Z, dengan Z (3 bukti), tanpa Z dengan nomor tetap di tengah; cetak tidak urut; BAS hilang
 *   D  paket ABT bas-halaman-1nov (isi paket, md5, potongan hanya kaki halaman)
 *   E  migrasi 0123 = cermin schema.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_BAS_HALAMAN } from "@/server/db/schema";
import { bacaCatatanHalaman, bacaKonteksBas, catatRunut, pasangRunut, type DepsRunut } from "@/server/modules/aleta-ecourt/bas-halaman/layanan";
import { pasangNomorAwal, pasangNomorAwalDocx } from "@/server/modules/aleta-ecourt/bas-halaman/naskah";
import { halamanAkhirBas, hitungHalamanAwal, konteksDariNaskah, periksaSesudah, pilihSidangDariTanggal, type SidangBas } from "@/server/modules/aleta-ecourt/bas-halaman/runut";
import { sesuaikanZcross, type Mesin } from "@/server/modules/aleta-ecourt/zcross";
import { bukaDocx } from "@/server/modules/aleta-ecourt/zcross/docx";
import { uraiRtf } from "@/server/modules/aleta-ecourt/zcross/rtf";
import { bacaZip, entriBaru, isiEntri, tulisZip } from "@/server/modules/aleta-ecourt/zcross/zip";

import { buatBasRtf } from "./fixtures/zcross-fixture";

const lat1 = (b: Uint8Array) => Buffer.from(b).toString("latin1");
const bita = (s: string) => new Uint8Array(Buffer.from(s, "latin1"));

const SIDANG: SidangBas[] = [
  { id: "301", tanggal: "2026-08-03", urutan: 1 },
  { id: "305", tanggal: "2026-08-10", urutan: 2 },
  { id: "309", tanggal: "2026-08-17", urutan: 3 },
  { id: "311", tanggal: "2026-08-24", urutan: 4, ikrar: true },
];

// ----------------------------------------------------------------------------
// A. Aturan murni
// ----------------------------------------------------------------------------
describe("A. aturan halaman runut", () => {
  it("sidang pertama = 1; berikutnya = akhir BAS sebelumnya + 1; urutan sidang, bukan urutan cetak; ikrar tidak ikut", () => {
    expect(hitungHalamanAwal({ sidang: SIDANG, sasaran: { sidangId: "301" }, catatan: [] })).toMatchObject({ awal: 1, ke: 1, dasar: "pertama", peringatan: [] });
    const catatan = [
      { sidangId: "305", tanggal: "2026-08-10", awal: 4, akhir: 12 }, // dicetak lebih dulu dari BAS 1
      { sidangId: "301", tanggal: "2026-08-03", awal: 1, akhir: 3 },
    ];
    expect(hitungHalamanAwal({ sidang: [...SIDANG].reverse(), sasaran: { sidangId: "309" }, catatan })).toMatchObject({ awal: 13, ke: 3, dasar: "catatan", peringatan: [] });
    expect(hitungHalamanAwal({ sidang: SIDANG, sasaran: { sidangId: "305" }, catatan })).toMatchObject({ awal: 4, ke: 2 });
    // sidang ikrar talak bukan BAS runut
    expect(hitungHalamanAwal({ sidang: SIDANG, sasaran: { sidangId: "311" }, catatan }).dasar).toBe("tanpa-jadwal");
  });

  it("BAS sebelumnya belum tercatat -> dihitung dari yang ada + peringatan; e-Doc SIPP terbaca -> halamannya dipakai", () => {
    const h = hitungHalamanAwal({ sidang: SIDANG, sasaran: { sidangId: "309" }, catatan: [{ sidangId: "301", tanggal: "2026-08-03", awal: 1, akhir: 3 }] });
    expect(h).toMatchObject({ awal: 4, dasar: "sebagian", hilang: ["2026-08-10"] });
    expect(h.peringatan[0]).toMatch(/BAS sidang 10 Agustus 2026 belum pernah dicetak, diunduh, atau diunggah.*mulai 4/);
    const e = hitungHalamanAwal({ sidang: SIDANG.map((s) => (s.id === "305" ? { ...s, halamanEdoc: 6 } : s)), sasaran: { sidangId: "309" }, catatan: [{ sidangId: "301", tanggal: "2026-08-03", awal: 1, akhir: 3 }] });
    expect(e).toMatchObject({ awal: 10, dasar: "edoc", hilang: [] });
    expect(e.peringatan[0]).toMatch(/10 Agustus 2026 \(6 halaman\).*PDF e-Doc/);
    // tidak ada catatan sama sekali: mulai 1 + peringatan menyebut kedua sidang
    const k = hitungHalamanAwal({ sidang: SIDANG, sasaran: { sidangId: "309" }, catatan: [] });
    expect(k.awal).toBe(1);
    expect(k.peringatan[0]).toMatch(/3 Agustus 2026, 10 Agustus 2026/);
  });

  it("halaman akhir: tanpa Z = awal + fisik - 1; Z berbagian = nomor sesudah bukti + sisa; Z di ujung = sampai halaman bukti", () => {
    expect(halamanAkhirBas({ awal: 4, fisik: 3 })).toBe(6);
    // Z di halaman fisik 2 (tampil 5), 3 halaman bukti (6-8), bagian sesudahnya mulai 9 dan 1 halaman fisik
    expect(halamanAkhirBas({ awal: 4, fisik: 3, z: { diubah: true, seksi: "dipakai", halamanFisikZ: 2, nomorBagianBerikut: 9, halamanBuktiSampai: 8 } })).toBe(9);
    expect(halamanAkhirBas({ awal: 4, fisik: 2, z: { diubah: true, seksi: "tanpa-bagian-berikut", halamanFisikZ: 2, nomorBagianBerikut: null, halamanBuktiSampai: 8 } })).toBe(8);
    expect(periksaSesudah({ sidang: SIDANG, sasaran: { sidangId: "305" }, akhir: 14, catatan: [{ sidangId: "309", tanggal: "2026-08-17", awal: 13, akhir: 15 }] })[0]).toMatch(
      /BAS sidang 17 Agustus 2026 sudah dicetak mulai halaman 13.*mulai halaman 15/
    );
  });

  it("perkara & sidang dikenali dari naskah unggahan (nomor perkara + tanggal sidang pertama yang ada di jadwal)", () => {
    const k = konteksDariNaskah(["BERITA ACARA SIDANG", "Nomor 12/Pdt.G/2026/PA. Dgl", "Gugatan tanggal 1 Juli 2026; persidangan hari Senin tanggal 10 Agustus 2026"]);
    expect(k).toEqual({ nomorPerkara: "12/Pdt.G/2026/PA.Dgl", tanggal: ["2026-07-01", "2026-08-10"] });
    expect(pilihSidangDariTanggal(SIDANG, k.tanggal)?.id).toBe("305");
    expect(bacaKonteksBas({ perkaraId: "x1", nomorPerkara: "" })).toBeNull();
    expect(bacaKonteksBas({ perkaraId: "77", sidangId: "305", tanggalSidang: "2026-08-10", sidang: JSON.stringify([{ sidangId: "301", tanggal: "2026-08-03" }]) })).toMatchObject({
      perkaraId: "77",
      sidangId: "305",
      sidang: [{ id: "301", tanggal: "2026-08-03" }],
    });
  });
});

// ----------------------------------------------------------------------------
// B. Naskah
// ----------------------------------------------------------------------------
describe("B. nomor awal di naskah", () => {
  it("RTF: bagian pertama mulai N (blangko bernomor tetap 5 diganti), bagian lain bernomor tetap jadi bersambung; isi lain utuh", () => {
    const asal = buatBasRtf({ bukti: 2, templatZ: true, nomorAwal: 5 });
    const h = pasangNomorAwal(bita(asal), "rtf", 7);
    const s = lat1(h.bita);
    expect(h).toMatchObject({ dipasang: true, bagianDisambung: 1 });
    const seksi = uraiRtf(s).kejadian.filter((k) => k.jenis === "sectd").map((k) => s.slice(k.pos, k.akhirKontrol));
    expect(seksi[0]).toMatch(/^\\sectd\\pgnrestart\\pgnstarts7 \\sbkpage/);
    expect(seksi[0]).not.toMatch(/pgnstarts5/);
    expect(seksi[1]).toMatch(/\\pgncont/);
    expect(seksi[1]).not.toMatch(/pgnrestart|pgnstarts/);
    // teks tampak sama persis
    expect(uraiRtf(s).paragraf.map((p) => p.teks)).toEqual(uraiRtf(asal).paragraf.map((p) => p.teks));
    // dipasang lagi = sama (cetak ulang tidak menumpuk)
    expect(lat1(pasangNomorAwal(h.bita, "rtf", 7).bita)).toBe(s);
  });

  it("DOCX: w:pgNumType w:start bagian pertama = N; w:start bagian lain dicabut (format angka dipertahankan); DOC = apa adanya + alasan", () => {
    const xml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
      `<w:p><w:r><w:t>BERITA ACARA SIDANG</w:t></w:r></w:p>` +
      `<w:p><w:pPr><w:sectPr><w:pgSz w:w="12191" w:h="16840"/><w:pgNumType w:fmt="decimal" w:start="5"/><w:cols w:space="708"/></w:sectPr></w:pPr><w:r><w:t>Bukti-bukti tersebut sebagai berikut:</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>Selanjutnya</w:t></w:r></w:p>` +
      `<w:sectPr><w:pgSz w:w="12191" w:h="16840"/><w:pgNumType w:start="15"/><w:cols w:space="708"/></w:sectPr></w:body></w:document>`;
    const ct = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`;
    const dasar = tulisZip([entriBaru("[Content_Types].xml", new TextEncoder().encode(ct)), entriBaru("word/document.xml", new TextEncoder().encode(xml))]);
    const h = pasangNomorAwalDocx(dasar, 13);
    expect(h).toMatchObject({ dipasang: true, bagianDisambung: 1 });
    const x = bukaDocx(h.bita).xml;
    expect(x).toContain(`<w:pgNumType w:start="13" w:fmt="decimal"/>`);
    expect(x).toContain(`<w:pgNumType/>`);
    expect(x).not.toContain(`w:start="15"`);
    expect(new TextDecoder().decode(isiEntri(bacaZip(h.bita).find((e) => e.nama === "[Content_Types].xml")!))).toBe(ct);
    expect(pasangNomorAwal(new Uint8Array([0xd0, 0xcf]), "doc", 3)).toMatchObject({ dipasang: false, alasan: expect.stringMatching(/DOC lama/) });
  });
});

// ----------------------------------------------------------------------------
// C. Tiga BAS berurutan lewat jalur sungguhan
// ----------------------------------------------------------------------------
/** Mesin palsu: PDF pdf-lib dari teks paragraf RTF (pemisah bagian = halaman baru), koordinat dan jumlah halaman diketahui. */
function mesinPalsu(): Mesin {
  return {
    nama: "uji",
    async ubah(isi, dari, ke) {
      if (ke !== "pdf") return isi;
      if (dari !== "rtf") throw new Error("mesin palsu hanya RTF");
      const u = uraiRtf(lat1(isi));
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      let hal = pdf.addPage([609.5, 842]);
      let y = 842 - 85;
      const lebar = 609.5 - 113.4 - 56.7;
      for (const p of u.paragraf) {
        const kata = p.teks.split(/\s+/).filter(Boolean);
        let baris = "";
        const tulis = (t: string) => {
          if (y < 85) {
            hal = pdf.addPage([609.5, 842]);
            y = 842 - 85;
          }
          hal.drawText(t, { x: 113.4, y, size: 12, font });
          y -= 16;
        };
        for (const k of kata) {
          const coba = baris ? `${baris} ${k}` : k;
          if (font.widthOfTextAtSize(coba, 12) > lebar && baris) {
            tulis(baris);
            baris = k;
          } else baris = coba;
        }
        if (baris) tulis(baris);
        if (p.penutup === "sect") {
          hal = pdf.addPage([609.5, 842]);
          y = 842 - 85;
        }
      }
      return new Uint8Array(await pdf.save());
    },
  };
}

async function halamanPdf(b: Uint8Array) {
  return (await PDFDocument.load(b)).getPageCount();
}

describe("C. tiga BAS berurutan (dengan / tanpa Z), nomor bersambung", () => {
  let db: AletaDatabase | null = null;
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });
  const mesin = mesinPalsu();
  const deps: DepsRunut = { jadwal: async () => ({ perkaraId: "9001", nomorPerkara: "12/Pdt.G/2026/PA.Dgl", sidang: SIDANG }) };

  /** Satu cetak BAS seperti rute PDF: pasang nomor awal -> Z (hanya naskah bertanda "SC Z") -> PDF -> catat. */
  async function cetak(rtf: string, sidangId: string, jumlahBukti?: number) {
    const r = await pasangRunut(db!, bita(rtf), "rtf", { perkaraId: "9001", sidangId }, deps);
    expect(r.rencana).not.toBeNull();
    const z = await sesuaikanZcross(r.bita, "rtf", { mesin, hanyaBentuk: true, ...(jumlahBukti != null ? { jumlahBukti } : {}) });
    const pdf = await mesin.ubah(z.bita, "rtf", "pdf");
    const c = await catatRunut(db!, r.rencana!, { pdf, z: z.laporan, sumber: "cetak", olehId: "u1" });
    return { r, z, pdf, c: c!, rtf: lat1(z.bita) };
  }

  const BAS1 = () => buatBasRtf({ bukti: 0, tanpaJangkar: true, bagianBerikut: false, isi: 70, penanda: "Sidang pertama" });
  const BAS2 = () => buatBasRtf({ bukti: 3, templatZ: true, isi: 30, nomorAwal: 5, penanda: "Pembuktian" });
  const BAS3 = () => buatBasRtf({ bukti: 0, tanpaJangkar: true, isi: 20, penanda: "Kesimpulan" }); // memuat \pgnstarts15 di tengah tanpa Z

  it("BAS 1 tanpa Z -> 1..n; BAS 2 dengan Z dan 3 bukti -> mulai n+1, sesudah bukti melompat 3; BAS 3 -> sesudah halaman terakhir BAS 2", async () => {
    const b1 = await cetak(BAS1(), "301");
    const f1 = await halamanPdf(b1.pdf);
    expect(f1).toBeGreaterThanOrEqual(2);
    expect(b1.c).toMatchObject({ awal: 1, akhir: f1, peringatan: [] });
    expect(b1.rtf).toMatch(/\\sectd\\pgnrestart\\pgnstarts1 /);

    const b2 = await cetak(BAS2(), "305", 3);
    expect(b2.r.rencana!.awal).toBe(f1 + 1);
    expect(b2.z.laporan.diubah).toBe(true);
    const zTampil = b2.z.laporan.halamanTampilZ!;
    expect(zTampil).toBe(f1 + b2.z.laporan.halamanFisikZ!); // nomor halaman Z dihitung dari halaman awal BAS ini
    expect(b2.z.laporan.nomorBagianBerikut).toBe(zTampil + 3 + 1);
    expect(b2.rtf).toMatch(new RegExp(`\\\\pgnstarts${f1 + 1} `));
    expect(b2.rtf).toMatch(new RegExp(`\\\\pgnrestart \\\\pgnstarts${zTampil + 4} `));
    expect(b2.rtf).not.toMatch(/pgnstarts(5|15)\b/);
    const f2 = await halamanPdf(b2.pdf);
    expect(b2.c.akhir).toBe(zTampil + 4 + (f2 - b2.z.laporan.halamanFisikZ!) - 1);

    const b3 = await cetak(BAS3(), "309");
    expect(b3.r.rencana!.awal).toBe(b2.c.akhir + 1);
    expect(b3.rtf).not.toMatch(/pgnstarts15/); // nomor tetap di tengah BAS dijadikan bersambung (tanpa Z = tanpa lompatan)
    expect(b3.rtf).toMatch(/\\pgncont/);
    const f3 = await halamanPdf(b3.pdf);
    expect(b3.c.akhir).toBe(b2.c.akhir + f3);

    const catatan = await bacaCatatanHalaman(db!, "9001");
    expect(catatan.map((c) => [c.sidangId, c.awal, c.akhir]).sort()).toEqual(
      [
        ["301", 1, f1],
        ["305", f1 + 1, b2.c.akhir],
        ["309", b2.c.akhir + 1, b3.c.akhir],
      ].sort()
    );
  });

  it("cetak tidak urut + cetak ulang: BAS 3 lebih dulu (peringatan BAS hilang), lalu BAS 1 & 2 -> BAS 3 diingatkan untuk dicetak ulang", async () => {
    const b3 = await cetak(BAS3(), "309");
    expect(b3.r.rencana!.awal).toBe(1);
    expect(b3.r.peringatan.join(" ")).toMatch(/BAS sidang 3 Agustus 2026, 10 Agustus 2026 belum pernah dicetak/);
    const b1 = await cetak(BAS1(), "301");
    expect(b1.c.peringatan).toEqual([]); // BAS sesudahnya (2) belum tercatat
    const b2 = await cetak(BAS2(), "305", 3);
    expect(b2.r.rencana!.awal).toBe(b1.c.akhir + 1);
    expect(b2.r.peringatan).toEqual([]);
    expect(b2.c.peringatan[0]).toMatch(new RegExp(`BAS sidang 17 Agustus 2026 sudah dicetak mulai halaman 1, .*mulai halaman ${b2.c.akhir + 1}`));
    const ulang = await cetak(BAS3(), "309");
    expect(ulang.r.rencana!.awal).toBe(b2.c.akhir + 1);
    expect(ulang.r.peringatan).toEqual([]);
  });

  it("BAS sebelumnya hilang -> dihitung dari yang ada + peringatan di panel; perkara tidak terbaca -> naskah apa adanya + alasan", async () => {
    await cetak(BAS1(), "301");
    const b3 = await cetak(BAS3(), "309");
    expect(b3.r.peringatan.join(" ")).toMatch(/BAS sidang 10 Agustus 2026 belum pernah dicetak.*Cetak BAS sidang itu lebih dulu/);
    const tanpa = await pasangRunut(db!, bita(BAS1()), "rtf", { perkaraId: "9001", sidangId: "301" }, { jadwal: async () => null });
    expect(tanpa.rencana).toBeNull();
    expect(lat1(tanpa.bita)).toBe(BAS1());
    expect(tanpa.peringatan[0]).toMatch(/Jadwal sidang SIPP belum dapat dibaca/);
    // unggahan tanpa konteks: perkara & sidang dari naskah (Nomor 12/Pdt.G/2026/PA.Dgl, "tanggal 29 Oktober 2026" bukan tanggal sidang -> tidak dikenali)
    const naskah = await pasangRunut(db!, bita(BAS1()), "rtf", {}, deps);
    expect(naskah.rencana).toBeNull();
    expect(naskah.peringatan[0]).toMatch(/Sidang BAS ini tidak ditemukan/);
    const cocok = await pasangRunut(db!, bita(BAS1().replace("29 Oktober 2026", "10 Agustus 2026")), "rtf", {}, deps);
    expect(cocok.rencana).toMatchObject({ perkaraId: "9001", sasaran: { id: "305" }, awal: (await bacaCatatanHalaman(db!, "9001")).find((c) => c.sidangId === "301")!.akhir + 1 });
  });
});

// ----------------------------------------------------------------------------
// D. Paket ABT bas-halaman-1nov
// ----------------------------------------------------------------------------
describe("D. paket ABT bas-halaman-1nov", () => {
  const AKAR = path.resolve(process.cwd(), "../abt-paket/bas-halaman-1nov/paket-satker");
  const ada = existsSync(AKAR);
  it.skipIf(!ada)("MD5SUMS cocok; tiap potongan HANYA menambah field PAGE di kaki halaman (rata kanan), tidak ada kata nama aplikasi", () => {
    for (const baris of readFileSync(path.join(AKAR, "MD5SUMS.txt"), "utf8").trim().split(/\r?\n/)) {
      const [md5, nama] = baris.split(/\s+\*?/);
      expect(createHash("md5").update(readFileSync(path.join(AKAR, nama))).digest("hex"), nama).toBe(md5);
    }
    const daftar = readFileSync(path.join(AKAR, "daftar-tambal.tsv"), "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
    const potong = readFileSync(path.join(AKAR, "tambal.tsv"), "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
    expect(daftar.length).toBeGreaterThan(500);
    expect(new Set(daftar.map((d) => d[0])).size).toBe(daftar.length);
    for (const d of daftar) {
      expect(d[1]).toMatch(/^derry_briantono\/[^/]+ - BAS\/[^/]+\.rtf$/);
      expect(d[1]).not.toMatch(/98b Berkas Perkara|98c Court Calendar|terhapus/);
      expect(d[2]).not.toBe(d[3]);
    }
    expect(potong.reduce((n, p) => n + 1, 0)).toBe(daftar.reduce((n, d) => n + Number(d[4]), 0));
    for (const [, , lama, baru] of potong) {
      const a = Buffer.from(lama, "base64").toString("latin1");
      const z = Buffer.from(baru, "base64").toString("latin1");
      expect(["\\par", "\\pard", "}"]).toContain(a);
      expect(z.endsWith(a)).toBe(true);
      const tambah = z.slice(0, z.length - a.length);
      expect(tambah).toMatch(/\{\\field\{\\\*\\fldinst \{ PAGE \\\\\* Arabic \}\}\{\\fldrslt \{1\}\}\}/);
      expect(tambah).toMatch(/\\qr/);
      expect(tambah).not.toMatch(/aleta/i);
      if (a === "\\pard") expect(tambah).toMatch(/^\{\\footer /);
    }
    for (const sh of ["pasang-satker.sh", "pulih-satker.sh"]) expect(readFileSync(path.join(AKAR, sh), "utf8")).not.toMatch(/\r\n/);
  });
});

// ----------------------------------------------------------------------------
// F. Bot: jadwal BAS dari SIPP (baca saja)
// ----------------------------------------------------------------------------
describe("F. bot berkas.jadwalBas", () => {
  it("urut tanggal_sidang, id; ikrar ditandai; perkara dari nomor; hanya SELECT; halaman e-Doc dari berkas", async () => {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const svc = req(path.resolve(process.cwd(), "../aleta_bot/services/berkasPerkaraService.js")) as {
      jadwalBas: (p: Record<string, unknown>, d: Record<string, unknown>) => Promise<{ ok: boolean; perkaraId?: string; nomorPerkara?: string; sidang?: Array<Record<string, unknown>> }>;
    };
    const sql: string[] = [];
    const kueri = async (q: string, p: unknown[]) => {
      sql.push(q);
      if (/FROM perkara WHERE nomor_perkara/.test(q)) return p[0] === "12/Pdt.G/2026/PA.Dgl" ? [{ perkara_id: 9001, nomor_perkara: "12/Pdt.G/2026/PA.Dgl" }] : [];
      if (/FROM perkara_jadwal_sidang/.test(q))
        return [
          { id: 301, urutan: 1, tanggal_sidang: new Date(2026, 7, 3), ikrar_talak: "T", edoc_bas: "resources/x/bas1.pdf" },
          { id: 305, urutan: 2, tanggal_sidang: "2026-08-10", ikrar_talak: null, edoc_bas: "" },
          { id: 311, urutan: 3, tanggal_sidang: "2026-08-24", ikrar_talak: "Y", edoc_bas: "resources/x/ikrar.pdf" },
        ];
      return [];
    };
    const r = await svc.jadwalBas({ nomorPerkara: "12/Pdt.G/2026/PA.Dgl", denganHalaman: false }, { kueri });
    expect(r).toMatchObject({ ok: true, perkaraId: "9001", nomorPerkara: "12/Pdt.G/2026/PA.Dgl" });
    expect(r.sidang).toEqual([
      { id: "301", urutan: 1, tanggal: "2026-08-03", ikrar: false, edoc: true, halamanEdoc: null },
      { id: "305", urutan: 2, tanggal: "2026-08-10", ikrar: false, edoc: false, halamanEdoc: null },
      { id: "311", urutan: 3, tanggal: "2026-08-24", ikrar: true, edoc: true, halamanEdoc: null },
    ]);
    expect(sql.every((q) => /^\s*SELECT\b/i.test(q))).toBe(true);
    expect(await svc.jadwalBas({ nomorPerkara: "tidak/ada" }, { kueri })).toMatchObject({ ok: false });
  });
});

// ----------------------------------------------------------------------------
// G. Render SUNGGUHAN (hanya bila BAS_RUNUT_RENDER = folder keluaran render159.py): dua BAS ABT berurutan -> jalur portal -> Word
// ----------------------------------------------------------------------------
const DIR_RENDER = process.env.BAS_RUNUT_RENDER || "";
describe.skipIf(!DIR_RENDER || !existsSync(path.join(DIR_RENDER, "tugas.json")))("G. render dua BAS berurutan (Word)", () => {
  it("BAS kedua mulai dari halaman terakhir BAS pertama + 1 (termasuk lompatan bukti Z); hasil RTF + PDF disimpan", async () => {
    const { writeFileSync } = await import("node:fs");
    const { mesinWord } = await import("@/server/modules/aleta-ecourt/zcross/mesin");
    const mesin = mesinWord();
    const db = await createAletaDatabase({ useInMemory: true, seed: true });
    const jadwal = JSON.parse(readFileSync(path.join(DIR_RENDER, "jadwal.json"), "utf8")) as { perkaraId: string; sidang: SidangBas[] };
    const tugas = JSON.parse(readFileSync(path.join(DIR_RENDER, "tugas.json"), "utf8")) as Array<{ berkas: string; sidangId: string; tanggal: string }>;
    const deps: DepsRunut = { jadwal: async () => ({ perkaraId: jadwal.perkaraId, nomorPerkara: "", sidang: jadwal.sidang }) };
    const ringkas: string[] = [];
    let akhirSebelum = 0;
    for (const t of tugas) {
      const asal = new Uint8Array(readFileSync(t.berkas));
      const r = await pasangRunut(db, asal, "rtf", { perkaraId: jadwal.perkaraId, sidangId: t.sidangId }, deps);
      expect(r.rencana, t.berkas).not.toBeNull();
      if (akhirSebelum) expect(r.rencana!.awal).toBe(akhirSebelum + 1);
      const z = await sesuaikanZcross(r.bita, "rtf", { mesin, hanyaBentuk: true });
      const pdf = await mesin.ubah(z.bita, "rtf", "pdf");
      const c = (await catatRunut(db, r.rencana!, { pdf, z: z.laporan, sumber: "cetak", olehId: "render" }))!;
      const dasar = t.berkas.replace(/\.rtf$/, "");
      writeFileSync(`${dasar}.runut.rtf`, z.bita);
      writeFileSync(`${dasar}.runut.pdf`, pdf);
      ringkas.push(
        `${path.basename(dasar)}\tsidang ${t.sidangId} ${t.tanggal}\thalaman ${c.awal}-${c.akhir}\tfisik ${c.fisik}\tZ ${z.laporan.diubah ? `hal ${z.laporan.halamanTampilZ} (fisik ${z.laporan.halamanFisikZ}), bukti ${z.laporan.jumlahHalamanBukti} hal, sesudahnya ${z.laporan.nomorBagianBerikut}` : `tidak (${z.laporan.alasan})`}\tperingatan ${[...r.peringatan, ...c.peringatan].join(" | ") || "-"}`
      );
      akhirSebelum = c.akhir;
    }
    writeFileSync(path.join(DIR_RENDER, "ringkas.txt"), ringkas.join("\n") + "\n");
    await db.close();
  }, 600_000);
});

// ----------------------------------------------------------------------------
// E. Migrasi
// ----------------------------------------------------------------------------
describe("E. migrasi 0123", () => {
  it("DDL 0123 = cermin schema.ts; terdaftar di jurnal (idx 107, unik) dan urutan simpan pg-mem", () => {
    const AKAR = path.resolve(process.cwd());
    const sql = readFileSync(path.join(AKAR, "drizzle/0123_aleta_bas_halaman.sql"), "utf8");
    const rapat = (t: string) => t.replace(/--.*$/gm, "").replace(/;/g, " ").replace(/\s+/g, " ").trim();
    expect(rapat(sql)).toBe(rapat([...DDL_BAS_HALAMAN.tabel, ...DDL_BAS_HALAMAN.indeks].join(" ")));
    const jurnal = JSON.parse(readFileSync(path.join(AKAR, "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string }> };
    expect(jurnal.entries.filter((e) => e.tag === "0123_aleta_bas_halaman").map((e) => e.idx)).toEqual([107]);
    expect(new Set(jurnal.entries.map((e) => e.idx)).size).toBe(jurnal.entries.length);
    expect(readFileSync(path.join(AKAR, "src/server/db/client.ts"), "utf8")).toContain('"aleta_bas_halaman"');
  });
});
