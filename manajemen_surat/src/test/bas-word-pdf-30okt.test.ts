// @vitest-environment node
/**
 * ============================================================================
 * 30 OKT 2026 - BAS DARI WORD KE PDF BERTANDA TANGAN SCAN
 * ============================================================================
 *
 * Keluhan: jendela e-Doc BAS di SIPP menolak berkas yang bukan PDF, padahal BAS disunting di Word (RTF/DOCX/DOC).
 * Kini ekstensi (ekstensi-sipp/bas-word-pdf.js) mencegat pilihan berkas Word, meminta rute bas/word-ke-pdf mengubahnya ke PDF
 * dengan tanda tangan scan Panitera Pengganti dan Ketua Majelis, lalu menaruh PDF itu di kotak berkas SIPP.
 *
 *   1  inti server (modules/aleta-ecourt/bas-word-pdf.ts) atas PDF contoh BUATAN pdf-lib (soffice tidak terpasang di mesin ini):
 *      pengenal berkas dari isi, nama .pdf tanpa kata Aleta, blok tanda tangan dua kolom / bertingkat / kalimat penutup yang
 *      mirip label, gambar jatuh DI ATAS nama masing-masing (koordinat dibaca balik dari PDF hasil), hak per akun, yang belum
 *      punya tanda tangan dilaporkan, metadata bebas tanda Aleta;
 *   2  ekstensi (jsdom, kode sungguhan): pilihan berkas Word diganti PDF di kotak berkas SIPP; PDF biasa tidak disentuh; kegagalan
 *      terang-terangan; Simpan menunggu ubahan selesai; sisa blangko tetap menahan; tidak ada kata Aleta ke SIPP.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { PDFDocument, PDFName, PDFRawStream, StandardFonts, rgb } from "pdf-lib";
// @ts-expect-error pngjs tidak punya berkas tipe (hanya dipakai membuat gambar contoh)
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import { pasangRintisanPeramban } from "@/server/modules/aleta-ecourt/baca-pdf";
import {
  bacaBlokTtdBas,
  cocokkanBarisTtd,
  kenaliBerkasWord,
  namaPdfDariWord,
  pdfTanpaTandaAleta,
  wordKePdfBas,
  type DepsWordPdf,
} from "@/server/modules/aleta-ecourt/bas-word-pdf";
import { bacaItemPdf, susunBaris } from "@/server/modules/aleta-ecourt/pdf-bubuh-ttd";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const bacaEks = (b: string) => readFileSync(path.join(EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");

// ----------------------------------------------------------------------------
// Bahan: berkas contoh
// ----------------------------------------------------------------------------
const enc = (s: string) => new TextEncoder().encode(s);
const RTF = enc("{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Times New Roman;}}\\f0 BERITA ACARA SIDANG\\par}");
const gabung = (...p: Uint8Array[]) => {
  const h = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let i = 0;
  for (const x of p) {
    h.set(x, i);
    i += x.length;
  }
  return h;
};
const DOCX = gabung(new Uint8Array([0x50, 0x4b, 3, 4]), enc("\0\0[Content_Types].xml...word/document.xml..."), new Uint8Array(200));
const XLSX = gabung(new Uint8Array([0x50, 0x4b, 3, 4]), enc("\0\0[Content_Types].xml...xl/workbook.xml..."), new Uint8Array(200));
const ODT = gabung(new Uint8Array([0x50, 0x4b, 3, 4]), enc("\0\0\0\0\0\0mimetypeapplication/vnd.oasis.opendocument.text"), new Uint8Array(200));
const utf16 = (s: string) => new Uint8Array(Array.from(s, (c) => [c.charCodeAt(0), 0]).flat());
const OLE = (isi: string) => gabung(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), new Uint8Array(512), utf16(isi), new Uint8Array(300));
const DOC = OLE("WordDocument");
const XLS = OLE("Workbook");
const PDF_KECIL = enc("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

function pngContoh(w = 200, h = 100, merah = false): Buffer {
  const p = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (w * y + x) << 2;
      const garis = Math.abs(y - (h / 2 + (h / 3) * Math.sin(x / 14))) < 3 || (merah && y < 6);
      p.data[i] = merah ? 200 : 20;
      p.data[i + 1] = merah ? 20 : 20;
      p.data[i + 2] = merah ? 20 : 120;
      p.data[i + 3] = garis ? 255 : 0;
    }
  }
  return PNG.sync.write(p);
}

type Teks = { t: string; tengah?: number; x?: number; y: number; ukuran?: number; hal?: number };
type Tata = "dua-kolom" | "bertingkat" | "kalimat-tersisa" | "hakim-tunggal" | "tanpa-blok" | "spasi";
const PP = "Sri Wahyuni, S.H.";
const KETUA = "Idris, S.H.I., M.H.";

/** BAS contoh: badan beberapa paragraf lalu blok tanda tangan menurut `tata`. */
async function pdfBas(tata: Tata = "dua-kolom", opsi: { judul?: string; pengarang?: string; nama?: [string, string] } = {}): Promise<Uint8Array> {
  const dok = await PDFDocument.create();
  if (opsi.judul) dok.setTitle(opsi.judul);
  if (opsi.pengarang) dok.setAuthor(opsi.pengarang);
  const huruf = await dok.embedFont(StandardFonts.TimesRoman);
  const hal = dok.addPage([595.28, 841.89]);
  const [namaPp, namaKetua] = opsi.nama ?? [PP, KETUA];
  const gambar = (x: Teks) => {
    const ukuran = x.ukuran ?? 12;
    const lebar = huruf.widthOfTextAtSize(x.t, ukuran);
    const kiri = x.tengah !== undefined ? x.tengah - lebar / 2 : (x.x ?? 70);
    hal.drawText(x.t, { x: kiri, y: x.y, size: ukuran, font: huruf, color: rgb(0, 0, 0) });
  };
  const daftar: Teks[] = [
    { t: "BERITA ACARA SIDANG", tengah: 297, y: 790, ukuran: 14 },
    { t: `Perkara Nomor 12/Pdt.G/2026/PA.Dgl - Majelis dipimpin ${namaKetua} dibantu ${namaPp}.`, x: 70, y: 750 },
    { t: "Pemohon datang menghadap sendiri; Termohon tidak datang.", x: 70, y: 730 },
  ];
  if (tata === "kalimat-tersisa") {
    daftar.push({ t: "Demikian berita acara sidang ini dibuat yang ditanda tangani oleh Ketua Majelis dan", x: 70, y: 600 });
    daftar.push({ t: "Panitera Pengganti.", x: 70, y: 586 });
    daftar.push({ t: "Panitera Pengganti,", tengah: 150, y: 520 });
    daftar.push({ t: "Ketua Majelis,", tengah: 420, y: 520 });
    daftar.push({ t: namaPp, tengah: 150, y: 470 });
    daftar.push({ t: namaKetua, tengah: 420, y: 470 });
  } else if (tata === "dua-kolom") {
    daftar.push({ t: "Demikian berita acara sidang ini dibuat yang ditanda tangani oleh Ketua Majelis dan Panitera Pengganti.", x: 70, y: 600 });
    daftar.push({ t: "Panitera Pengganti,", tengah: 150, y: 520 });
    daftar.push({ t: "Ketua Majelis,", tengah: 420, y: 520 });
    daftar.push({ t: namaPp, tengah: 150, y: 470 });
    daftar.push({ t: namaKetua, tengah: 420, y: 470 });
  } else if (tata === "spasi") {
    // kolom disusun dengan SPASI (RTF "  Panitera Pengganti  Ketua Majelis"): satu potongan teks per baris
    daftar.push({ t: "Demikian berita acara sidang ini dibuat.", x: 70, y: 600 });
    daftar.push({ t: `Panitera Pengganti,${" ".repeat(30)}Ketua Majelis,`, x: 90, y: 520 });
    daftar.push({ t: `${namaPp}${" ".repeat(26)}${namaKetua}`, x: 90, y: 470 });
  } else if (tata === "bertingkat") {
    daftar.push({ t: "Demikian berita acara sidang ini dibuat.", x: 70, y: 600 });
    daftar.push({ t: "Ketua Majelis,", tengah: 420, y: 540 });
    daftar.push({ t: "ttd", tengah: 420, y: 515 });
    daftar.push({ t: namaKetua, tengah: 420, y: 480 });
    daftar.push({ t: "Panitera Pengganti,", tengah: 420, y: 430 });
    daftar.push({ t: "ttd", tengah: 420, y: 405 });
    daftar.push({ t: namaPp, tengah: 420, y: 370 });
  } else if (tata === "hakim-tunggal") {
    daftar.push({ t: "Demikian berita acara sidang ini dibuat.", x: 70, y: 600 });
    daftar.push({ t: "Panitera Pengganti,", tengah: 150, y: 520 });
    daftar.push({ t: "Hakim Tunggal,", tengah: 420, y: 520 });
    daftar.push({ t: namaPp, tengah: 150, y: 470 });
    daftar.push({ t: namaKetua, tengah: 420, y: 470 });
  } else {
    daftar.push({ t: "Demikian berita acara sidang ini dibuat yang ditanda tangani oleh Ketua Majelis dan Panitera Pengganti.", x: 70, y: 600 });
  }
  daftar.forEach(gambar);
  return await dok.save();
}

// ----------------------------------------------------------------------------
// Alat baca PDF hasil: letak gambar (pt, asal kiri-bawah) dari operator pdfjs
// ----------------------------------------------------------------------------
type Kotak = { kiri: number; bawah: number; kanan: number; atas: number };
async function letakGambar(pdf: Uint8Array): Promise<Kotak[]> {
  pasangRintisanPeramban();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const dok = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true, isEvalSupported: false }).promise;
  const hasil: Kotak[] = [];
  try {
    for (let n = 1; n <= dok.numPages; n += 1) {
      const h = await dok.getPage(n);
      const ops = await h.getOperatorList();
      const OPS = pdfjs.OPS as Record<string, number>;
      const tumpuk: number[][] = [];
      let m = [1, 0, 0, 1, 0, 0];
      const kali = (a: number[], b: number[]) => [
        a[0] * b[0] + a[1] * b[2],
        a[0] * b[1] + a[1] * b[3],
        a[2] * b[0] + a[3] * b[2],
        a[2] * b[1] + a[3] * b[3],
        a[4] * b[0] + a[5] * b[2] + b[4],
        a[4] * b[1] + a[5] * b[3] + b[5],
      ];
      ops.fnArray.forEach((fn: number, i: number) => {
        const arg = ops.argsArray[i];
        if (fn === OPS.save) tumpuk.push(m);
        else if (fn === OPS.restore) m = tumpuk.pop() ?? [1, 0, 0, 1, 0, 0];
        else if (fn === OPS.transform) m = kali(arg as number[], m);
        else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
          const xs = [m[4], m[4] + m[0], m[4] + m[2], m[4] + m[0] + m[2]];
          const ys = [m[5], m[5] + m[1], m[5] + m[3], m[5] + m[1] + m[3]];
          hasil.push({ kiri: Math.min(...xs), kanan: Math.max(...xs), bawah: Math.min(...ys), atas: Math.max(...ys) });
        }
      });
    }
  } finally {
    await dok.destroy();
  }
  return hasil;
}
function jumlahGambar(dok: PDFDocument): number {
  const topeng = new Set<string>();
  const gambar: string[] = [];
  for (const [ref, obj] of dok.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    if (String(obj.dict.get(PDFName.of("Subtype"))) !== "/Image") continue;
    gambar.push(String(ref));
    const sm = obj.dict.get(PDFName.of("SMask"));
    if (sm) topeng.add(String(sm));
  }
  return gambar.filter((r) => !topeng.has(r)).length;
}
async function barisPdf(pdf: Uint8Array) {
  return susunBaris((await bacaItemPdf(pdf)).item);
}
/** Posisi nama di PDF hasil (kemunculan terakhir): rentang mendatar dan puncak huruf. */
async function posisiNama(pdf: Uint8Array, nama: string) {
  const baris = (await barisPdf(pdf)).filter((b) => b.teks.includes(nama));
  const b = baris[baris.length - 1];
  const awal = b.teks.lastIndexOf(nama);
  return { xMin: b.xAwal[awal], xMax: b.xAkhir[awal + nama.length - 1], y: b.y, tinggi: b.tinggi };
}

// ----------------------------------------------------------------------------
// Penyambung tiruan
// ----------------------------------------------------------------------------
type Baris = { id: number; namaPejabat: string; disahkan?: boolean; penggunaId?: string; disahkanPada?: string };
const SAH: Baris[] = [
  { id: 11, namaPejabat: "Sri Wahyuni, S.H.", disahkan: true, penggunaId: "u-pp" },
  { id: 12, namaPejabat: "Idris, S.H.I., M.H.", disahkan: true, penggunaId: "u-hakim" },
];
function deps(pdf: Uint8Array, baris: Baris[] = SAH, catat: { dipanggil: string[] } = { dipanggil: [] }): DepsWordPdf {
  return {
    ubahKePdf: async (_bita, bentuk) => {
      catat.dipanggil.push(`ubah:${bentuk}`);
      return pdf;
    },
    daftarTtdSah: async () => baris.map((b) => ({ ...b })),
    gambarTtd: async (id) => {
      catat.dipanggil.push(`gambar:${id}`);
      return new Uint8Array(pngContoh(200, 100, id === 12));
    },
    atur: { lebarTtdMm: 50, ttdTurunMm: 3, tinggiTtdMaksMm: 25 },
  };
}
const admin = { akun: { id: "u-admin", nama: "Derry Briantono, S.H." }, bolehSemuaTtd: true };

// ============================================================================
describe("mengenali berkas Word dari ISINYA", () => {
  it("RTF, DOCX, DOC, dan ODT dikenali; PDF dikenali sebagai PDF", () => {
    expect(kenaliBerkasWord(RTF)).toBe("rtf");
    expect(kenaliBerkasWord(DOCX)).toBe("docx");
    expect(kenaliBerkasWord(ODT)).toBe("docx");
    expect(kenaliBerkasWord(DOC)).toBe("doc");
    expect(kenaliBerkasWord(PDF_KECIL)).toBe("pdf");
  });
  it("zip lain (xlsx), OLE lain (xls), dan acak BUKAN Word - tidak dibelokkan", () => {
    expect(kenaliBerkasWord(XLSX)).toBe("");
    expect(kenaliBerkasWord(XLS)).toBe("");
    expect(kenaliBerkasWord(enc("bukan apa-apa"))).toBe("");
    expect(kenaliBerkasWord(new Uint8Array(0))).toBe("");
  });
});

describe("nama berkas hasil", () => {
  it("berakhiran .pdf, ekstensi Word dibuang, tanpa jalur dan tanpa kata Aleta", () => {
    expect(namaPdfDariWord("BAS 12.docx")).toBe("BAS 12.pdf");
    expect(namaPdfDariWord("C:\\Users\\x\\BAS sidang 2.RTF")).toBe("BAS sidang 2.pdf");
    expect(namaPdfDariWord("BAS ALETA 12.doc")).toBe("BAS 12.pdf");
    expect(namaPdfDariWord("BAS_a.l.e.t.a_3.dotx")).toBe("BAS__3.pdf");
    expect(namaPdfDariWord("aleta.rtf")).toBe("BAS.pdf");
    expect(namaPdfDariWord("")).toBe("BAS.pdf");
    for (const n of ["BAS Aleta.docx", "ALETA-BAS.rtf", "x aLeTa y.doc"]) expect(namaPdfDariWord(n)).not.toMatch(/aleta/i);
  });
});

describe("blok tanda tangan dibaca dari PDF", () => {
  it("dua kolom: Panitera Pengganti di kiri, Ketua Majelis di kanan, masing-masing dengan namanya", async () => {
    const b = bacaBlokTtdBas(await barisPdf(await pdfBas("dua-kolom")));
    expect(b.map((x) => [x.peran, x.jabatan, x.nama])).toEqual([
      ["pp", "Panitera Pengganti", PP],
      ["ketua", "Ketua Majelis", KETUA],
    ]);
  });
  it("kalimat penutup yang membungkus ('... Ketua Majelis dan / Panitera Pengganti.') BUKAN label", async () => {
    const b = bacaBlokTtdBas(await barisPdf(await pdfBas("kalimat-tersisa")));
    expect(b.map((x) => x.nama)).toEqual([PP, KETUA]);
  });
  it("bertingkat satu kolom dengan baris 'ttd': nama dipasangkan ke label di atasnya, 'ttd' tidak dianggap nama", async () => {
    const b = bacaBlokTtdBas(await barisPdf(await pdfBas("bertingkat")));
    expect(b.map((x) => [x.peran, x.nama]).sort()).toEqual([["ketua", KETUA], ["pp", PP]].sort());
  });
  it("kolom yang disusun dengan SPASI (satu potongan teks per baris) tetap dipecah per kolom", async () => {
    const b = bacaBlokTtdBas(await barisPdf(await pdfBas("spasi")));
    expect(b.map((x) => [x.peran, x.nama])).toEqual([["pp", PP], ["ketua", KETUA]]);
  });
  it("Hakim Tunggal dibaca sebagai penanda tangan majelis", async () => {
    const b = bacaBlokTtdBas(await barisPdf(await pdfBas("hakim-tunggal")));
    expect(b.find((x) => x.nama === KETUA)).toMatchObject({ peran: "ketua", jabatan: "Hakim Tunggal" });
  });
  it("tanpa blok tanda tangan -> kosong (tidak menebak dari kalimat penutup)", async () => {
    expect(bacaBlokTtdBas(await barisPdf(await pdfBas("tanpa-blok")))).toEqual([]);
    expect(bacaBlokTtdBas([])).toEqual([]);
  });
  it("penanda isian yang belum terisi (#0015#) tidak dianggap nama", async () => {
    const dok = await pdfBas("dua-kolom", { nama: ["#0015#", "#0012#"] });
    expect(bacaBlokTtdBas(await barisPdf(dok))).toEqual([]);
  });
});

describe("mencocokkan nama di PDF dengan tanda tangan SAH", () => {
  const daftar = SAH.map((b) => ({ ...b }));
  it("nama penuh, lalu nama inti tanpa gelar yang menunjuk satu orang", () => {
    expect(cocokkanBarisTtd("Sri Wahyuni, S.H.", daftar)?.id).toBe(11);
    expect(cocokkanBarisTtd("Sri Wahyuni, S.H., M.H.", daftar)?.id).toBe(11);
    expect(cocokkanBarisTtd("Orang Lain, S.H.", daftar)).toBeNull();
  });
  it("dua orang berbeda dengan nama inti sama -> tidak ditebak", () => {
    const dua = [
      { id: 1, namaPejabat: "Sri Wahyuni, S.H.", disahkan: true },
      { id: 2, namaPejabat: "Sri Wahyuni, S.Ag.", disahkan: true },
    ];
    expect(cocokkanBarisTtd("Sri Wahyuni, M.H.", dua)).toBeNull();
  });
});

describe("Word -> PDF bertanda tangan (inti server)", () => {
  it("RTF: PDF jadi, kedua tanda tangan jatuh DI ATAS nama masing-masing (koordinat dibaca balik), nama .pdf", async () => {
    const pdf = await pdfBas("dua-kolom");
    const catat = { dipanggil: [] as string[] };
    const h = await wordKePdfBas({ bita: RTF, namaBerkas: "BAS 12.rtf", denganTtd: true, ...admin }, deps(pdf, SAH, catat));
    expect(catat.dipanggil).toContain("ubah:rtf");
    expect(h.namaBerkas).toBe("BAS 12.pdf");
    expect(h.bentukAsal).toBe("rtf");
    expect(h.blokTtd).toBe("ditemukan");
    expect(h.penandatangan.map((p) => [p.jabatan, p.nama, p.status])).toEqual([
      ["Panitera Pengganti", PP, "terpasang"],
      ["Ketua Majelis", KETUA, "terpasang"],
    ]);
    expect(String.fromCharCode(...h.pdf.slice(0, 5))).toBe("%PDF-");
    expect(jumlahGambar(await PDFDocument.load(h.pdf))).toBe(2);
    // letak: tiap gambar rata tengah terhadap nama, tepi bawahnya di sekitar puncak huruf nama, tidak menimpa label di atasnya
    const kotak = (await letakGambar(h.pdf)).sort((a, b) => a.kiri - b.kiri);
    expect(kotak).toHaveLength(2);
    for (const [k, nama] of [[kotak[0], PP], [kotak[1], KETUA]] as const) {
      const n = await posisiNama(h.pdf, nama);
      expect((k.kiri + k.kanan) / 2).toBeCloseTo((n.xMin + n.xMax) / 2, 0);
      expect(k.bawah).toBeGreaterThan(n.y); // di atas garis dasar nama
      expect(k.bawah).toBeLessThan(n.y + n.tinggi); // tepat di atas nama, bukan melayang jauh
      expect(k.atas).toBeLessThanOrEqual(520 + 1); // tidak menutupi label jabatan (y=520)
    }
    expect(h.peringatan).toEqual([]);
  });

  it("tata letak lain (kolom dengan spasi, bertingkat): tiap gambar tetap tepat di atas nama pemiliknya", async () => {
    for (const tata of ["spasi", "bertingkat", "kalimat-tersisa"] as const) {
      const h = await wordKePdfBas({ bita: RTF, namaBerkas: "BAS.rtf", denganTtd: true, ...admin }, deps(await pdfBas(tata)));
      expect(h.penandatangan.map((p) => p.status), tata).toEqual(["terpasang", "terpasang"]);
      const kotak = await letakGambar(h.pdf);
      expect(kotak, tata).toHaveLength(2);
      for (const nama of [PP, KETUA]) {
        const n = await posisiNama(h.pdf, nama);
        const dekat = kotak.filter((k) => Math.abs((k.kiri + k.kanan) / 2 - (n.xMin + n.xMax) / 2) < 1 && k.bawah > n.y && k.bawah < n.y + n.tinggi);
        expect(dekat, `${tata} ${nama}`).toHaveLength(1);
      }
    }
  });

  it("DOCX dan DOC lewat jalur yang sama; peringatan tata letak muncul untuk non-RTF", async () => {
    for (const [bita, bentuk] of [[DOCX, "docx"], [DOC, "doc"]] as const) {
      const catat = { dipanggil: [] as string[] };
      const h = await wordKePdfBas({ bita, namaBerkas: `BAS.${bentuk}`, denganTtd: true, ...admin }, deps(await pdfBas("dua-kolom"), SAH, catat));
      expect(catat.dipanggil[0]).toBe(`ubah:${bentuk}`);
      expect(h.bentukAsal).toBe(bentuk);
      expect(h.namaBerkas).toBe("BAS.pdf");
      expect(h.penandatangan.every((p) => p.status === "terpasang")).toBe(true);
      expect(h.peringatan.join(" ")).toMatch(/tata letak/);
    }
  });

  it("yang belum punya tanda tangan tersahkan DILAPORKAN, PDF tetap jadi dan yang lain tetap terpasang", async () => {
    const hanyaPp = SAH.filter((b) => b.id === 11);
    const h = await wordKePdfBas({ bita: RTF, namaBerkas: "BAS.rtf", denganTtd: true, ...admin }, deps(await pdfBas("dua-kolom"), hanyaPp));
    expect(h.penandatangan.map((p) => p.status)).toEqual(["terpasang", "belum-ada"]);
    expect(h.penandatangan[1].keterangan).toMatch(/belum punya tanda tangan tersahkan/);
    expect(jumlahGambar(await PDFDocument.load(h.pdf))).toBe(1);
    const tanpaSatuPun = await wordKePdfBas({ bita: RTF, namaBerkas: "BAS.rtf", denganTtd: true, ...admin }, deps(await pdfBas("dua-kolom"), []));
    expect(tanpaSatuPun.penandatangan.map((p) => p.status)).toEqual(["belum-ada", "belum-ada"]);
    expect(jumlahGambar(await PDFDocument.load(tanpaSatuPun.pdf))).toBe(0);
  });

  it("akun biasa hanya memasang tanda tangan MILIKNYA; milik orang lain 'bukan-hak' dan gambarnya tidak pernah diambil", async () => {
    const catat = { dipanggil: [] as string[] };
    const pp = { akun: { id: "u-pp", nama: "Sri Wahyuni, S.H." }, bolehSemuaTtd: false };
    const h = await wordKePdfBas({ bita: RTF, namaBerkas: "BAS.rtf", denganTtd: true, ...pp }, deps(await pdfBas("dua-kolom"), SAH, catat));
    expect(h.penandatangan.map((p) => p.status)).toEqual(["terpasang", "bukan-hak"]);
    expect(catat.dipanggil.filter((x) => x.startsWith("gambar:"))).toEqual(["gambar:11"]);
    expect(jumlahGambar(await PDFDocument.load(h.pdf))).toBe(1);
  });

  it("tanpa tanda tangan (dimatikan petugas): tidak ada gambar, tidak ada panggilan gambar", async () => {
    const catat = { dipanggil: [] as string[] };
    const h = await wordKePdfBas({ bita: RTF, namaBerkas: "BAS.rtf", denganTtd: false, ...admin }, deps(await pdfBas("dua-kolom"), SAH, catat));
    expect(h.blokTtd).toBe("dimatikan");
    expect(h.penandatangan).toEqual([]);
    expect(catat.dipanggil.filter((x) => x.startsWith("gambar:"))).toEqual([]);
    expect(jumlahGambar(await PDFDocument.load(h.pdf))).toBe(0);
  });

  it("blok tanda tangan tidak terbaca: PDF tetap jadi tanpa tanda tangan DAN petugas diberi tahu", async () => {
    const h = await wordKePdfBas({ bita: RTF, namaBerkas: "BAS.rtf", denganTtd: true, ...admin }, deps(await pdfBas("tanpa-blok")));
    expect(h.blokTtd).toBe("tidak-dikenali");
    expect(h.peringatan.join(" ")).toMatch(/tidak terbaca di PDF/);
    expect(jumlahGambar(await PDFDocument.load(h.pdf))).toBe(0);
  });

  it("daftar tanda tangan gagal dibaca: PDF tetap jadi dan petugas diberi tahu (tidak gagal diam-diam)", async () => {
    const d = deps(await pdfBas("dua-kolom"));
    d.daftarTtdSah = async () => {
      throw new Error("bot mati");
    };
    const h = await wordKePdfBas({ bita: RTF, namaBerkas: "BAS.rtf", denganTtd: true, ...admin }, d);
    expect(h.penandatangan.every((p) => p.status === "tidak-terpasang")).toBe(true);
    expect(h.peringatan.join(" ")).toMatch(/Daftar tanda tangan belum dapat dibaca/);
  });

  it("gambar tidak terambil: tidak terpasang, dilaporkan", async () => {
    const d = deps(await pdfBas("dua-kolom"));
    d.gambarTtd = async () => null;
    const h = await wordKePdfBas({ bita: RTF, namaBerkas: "BAS.rtf", denganTtd: true, ...admin }, d);
    expect(h.penandatangan.map((p) => p.status)).toEqual(["tidak-terpasang", "tidak-terpasang"]);
  });

  it("PDF dan berkas non-Word ditolak dengan kalimat jelas; berkas kosong dan terlalu besar juga", async () => {
    const d = deps(await pdfBas("dua-kolom"));
    await expect(wordKePdfBas({ bita: PDF_KECIL, namaBerkas: "x.pdf", denganTtd: true, ...admin }, d)).rejects.toThrow(/sudah PDF/);
    await expect(wordKePdfBas({ bita: XLSX, namaBerkas: "x.xlsx", denganTtd: true, ...admin }, d)).rejects.toThrow(/bukan berkas Word/);
    await expect(wordKePdfBas({ bita: new Uint8Array(0), namaBerkas: "x.rtf", denganTtd: true, ...admin }, d)).rejects.toThrow(/kosong/);
    await expect(wordKePdfBas({ bita: new Uint8Array(21 * 1024 * 1024), namaBerkas: "x.rtf", denganTtd: true, ...admin }, d)).rejects.toThrow(/melampaui/);
  });

  it("hasil ubahan yang bukan PDF ditolak (502), bukan diteruskan", async () => {
    const d = deps(await pdfBas("dua-kolom"));
    d.ubahKePdf = async () => enc("bukan pdf");
    await expect(wordKePdfBas({ bita: RTF, namaBerkas: "x.rtf", denganTtd: true, ...admin }, d)).rejects.toThrow(/bukan PDF/);
  });

  it("grup tersembunyi RTF dibuang sebelum diubah (sama dengan unggah BAS biasa)", async () => {
    const bertanda = enc("{\\rtf1 isi {\\*\\isianasal rahasia ALETA} akhir}");
    let diterima = "";
    const d = deps(await pdfBas("dua-kolom"));
    d.ubahKePdf = async (bita) => {
      diterima = new TextDecoder().decode(bita);
      return await pdfBas("dua-kolom");
    };
    await wordKePdfBas({ bita: bertanda, namaBerkas: "x.rtf", denganTtd: false, ...admin }, d);
    expect(diterima).not.toMatch(/isianasal|rahasia/i);
  });
});

describe("PDF tanpa tanda Aleta", () => {
  it("Title/Author yang menyebut Aleta dibersihkan, isi dan halaman tetap; PDF bersih dikembalikan apa adanya", async () => {
    const kotor = await pdfBas("dua-kolom", { judul: "BAS - ALETA 12", pengarang: "a.l.e.t.a" });
    const h = await wordKePdfBas({ bita: RTF, namaBerkas: "x.rtf", denganTtd: false, ...admin }, deps(kotor));
    const dok = await PDFDocument.load(h.pdf);
    expect(dok.getTitle() ?? "").not.toMatch(/aleta/i);
    expect(dok.getAuthor() ?? "").not.toMatch(/a\W*l\W*e\W*t\W*a/i);
    expect(dok.getPageCount()).toBe(1);
    expect(new TextDecoder("latin1").decode(h.pdf).match(/\/(?:Title|Author|Subject|Keywords|Creator|Producer)\s*\([^)]*\)/g)?.join(" ") ?? "").not.toMatch(/aleta/i);
    const bersih = await pdfBas("dua-kolom", { judul: "BAS 12" });
    expect(await pdfTanpaTandaAleta(bersih)).toBe(bersih);
  });

  it("hasil lengkap (dengan tanda tangan) tidak membawa kata Aleta di metadata, nama berkas, maupun keterangan", async () => {
    const h = await wordKePdfBas({ bita: RTF, namaBerkas: "BAS Aleta.rtf", denganTtd: true, ...admin }, deps(await pdfBas("dua-kolom", { judul: "ALETA" })));
    const dok = await PDFDocument.load(h.pdf);
    for (const v of [dok.getTitle(), dok.getAuthor(), dok.getSubject(), dok.getCreator(), dok.getProducer(), h.namaBerkas, JSON.stringify(h.penandatangan), JSON.stringify(h.peringatan)]) {
      expect(String(v ?? "")).not.toMatch(/aleta/i);
    }
  });
});

// ============================================================================
// Ekstensi (jsdom, kode sungguhan) - dengan pemeriksa berkas SIPP 7.0.4 yang ditiru dari fileupload_v.php
// ============================================================================
const ASAL = "http://192.168.10.10";
const FORM_BAS = (dari = "bas") => `
  <div id="konten"><form id="frm_upload_file" method="post" enctype="multipart/form-data" action="${ASAL}/SIPP/fileupload_c/dummy">
    <table><tr><td id="sel"><input type="file" name="fileform" id="fileform" accept=".pdf,application/pdf"></td></tr></table>
    <input type="hidden" name="enc" id="enc" value="x"><input type="hidden" name="enc1" id="enc1" value="y">
    <input type="hidden" name="from" id="from" value="${dari}"><input type="hidden" name="urutan" id="urutan" value="1">
    <input type="button" id="kembali" value="Kembali"><input type="submit" id="simpan" value="Simpan" style="display:none">
  </form></div>`;

type Panggilan = { alamat: string; metode: string; ttd: string | null; nama: string | null; byte: number };
type KunciJawab = { ok?: boolean; status?: number; data?: Record<string, unknown>; pesan?: string; tunda?: Promise<void> };

async function bukaEkstensi(opsi: { dari?: string; jawab?: (n: number) => KunciJawab; tinjau?: (nama: string) => { lanjut: boolean }; adaTinjau?: boolean } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${FORM_BAS(opsi.dari)}</body></html>`, { url: `${ASAL}/SIPP/main`, runScripts: "outside-only" });
  const w = dom.window as unknown as Record<string, any>;
  const doc = dom.window.document;
  const panggilan: Panggilan[] = [];
  const diKirim: string[] = []; // semua kiriman fetch langsung ke SIPP (harus kosong)
  let n = 0;
  w.fetch = async (u: string) => {
    diKirim.push(String(u));
    throw new Error("tidak boleh fetch langsung");
  };
  w.alatPemilihMilikAleta = () => false;
  w.alatAmbil = async (alamat: string, init: { method?: string; body?: FormData }) => {
    n += 1;
    const f = init.body as FormData;
    const berkas = f.get("berkas") as File;
    panggilan.push({ alamat, metode: init.method || "GET", ttd: String(f.get("ttd")), nama: berkas?.name ?? null, byte: berkas?.size ?? 0 });
    const j = (opsi.jawab ? opsi.jawab(n) : {}) as KunciJawab;
    if (j.tunda) await j.tunda;
    const status = j.status ?? 200;
    const isi = j.ok === false ? { ok: false, error: { message: j.pesan || "gagal" } } : { ok: true, data: j.data };
    return { ok: status < 400, status, json: async () => isi };
  };
  if (opsi.adaTinjau !== false) {
    const sisa = createRequire(import.meta.url)(path.join(EKSTENSI, "deteksi-sisa-blangko.js"));
    w.aletaDeteksiSisa = { ...sisa, tinjau: async (_b: unknown, o: { nama: string }) => (opsi.tinjau ? opsi.tinjau(o.nama) : { lanjut: true, periksa: true, temuan: [] }) };
  }
  // Pemeriksa SIPP 7.0.4 (fileupload_v.php, from=bas): bukan .pdf -> alert dan pilihan dikosongkan; selain itu tombol Simpan muncul.
  const masuk = doc.getElementById("fileform") as HTMLInputElement;
  const sipp = { dilihat: [] as string[], ditolak: [] as string[], lolos: [] as string[] };
  masuk.addEventListener("change", () => {
    const f = masuk.files && masuk.files[0];
    if (!f) return;
    sipp.dilihat.push(f.name);
    if (f.name.split(".").pop()!.toLowerCase() !== "pdf") {
      sipp.ditolak.push(f.name);
      Object.defineProperty(masuk, "files", { value: [], configurable: true });
      return;
    }
    sipp.lolos.push(f.name);
    (doc.getElementById("simpan") as HTMLElement).style.display = "";
  });
  w.eval(bacaEks("bas-word-pdf.js"));
  return { dom, w, doc, panggilan, diKirim, sipp };
}
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai(periksa: () => unknown, ket: string, batas = 4000) {
  const mulai = Date.now();
  for (;;) {
    let h: unknown;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(5);
  }
}
function pilihBerkas(w: Record<string, any>, doc: Document, bita: Uint8Array, nama: string, tipe = "") {
  const masuk = doc.getElementById("fileform") as HTMLInputElement;
  const berkas = new w.File([bita], nama, { type: tipe });
  Object.defineProperty(masuk, "files", { value: [berkas], configurable: true });
  masuk.dispatchEvent(new w.Event("change", { bubbles: true }));
  return masuk;
}
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
const teksPanel = (doc: Document) => doc.querySelector(".aleta-bwp")?.textContent ?? "";
const jawabPdf = (pdf: Uint8Array, lebih: Record<string, unknown> = {}) => () => ({
  data: { pdfBase64: b64(pdf), namaBerkas: "BAS 12.pdf", bentukAsal: "rtf", blokTtd: "ditemukan", penandatangan: [], peringatan: [], ...lebih },
});

describe("ekstensi: pilihan berkas Word di jendela e-Doc BAS SIPP", () => {
  it("terpasang di manifest SIPP saja, sesudah penyedia alatAmbil dan pemeriksa sisa blangko", () => {
    const manifest = JSON.parse(bacaEks("manifest.json"));
    const sipp = manifest.content_scripts.filter((c: any) => c.js.includes("deteksi-sisa-blangko.js") && c.js.includes("konten.js"));
    expect(sipp).toHaveLength(1);
    const js = sipp[0].js as string[];
    expect(js).toContain("bas-word-pdf.js");
    expect(js.indexOf("bas-word-pdf.js")).toBeGreaterThan(js.indexOf("panel-alat.js"));
    expect(js.indexOf("bas-word-pdf.js")).toBeGreaterThan(js.indexOf("deteksi-sisa-blangko.js"));
    for (const c of manifest.content_scripts) if (!c.matches.some((m: string) => /SIPP|index\.php/.test(m))) expect(c.js).not.toContain("bas-word-pdf.js");
    // ikut dikemas ke ZIP/CRX
    expect(readFileSync(path.join(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8")).toContain('"bas-word-pdf.js"');
  });

  it("RTF dipilih: pemeriksa SIPP TIDAK melihat berkas Word (tak ada alert), hanya PDF hasil; Simpan SIPP muncul; PDF bernama .pdf berisi PDF server; status memuat tanda tangan", async () => {
    const pdf = await pdfBas("dua-kolom");
    const e = await bukaEkstensi({
      jawab: jawabPdf(pdf, {
        penandatangan: [
          { peran: "pp", jabatan: "Panitera Pengganti", nama: PP, status: "terpasang", keterangan: "tanda tangan terpasang" },
          { peran: "ketua", jabatan: "Ketua Majelis", nama: KETUA, status: "belum-ada", keterangan: "belum punya tanda tangan tersahkan - kolom tanda tangan dibiarkan kosong" },
        ],
      }),
    });
    const masuk = pilihBerkas(e.w, e.doc, RTF, "BAS 12.rtf", "application/rtf");
    await sampai(() => e.sipp.lolos.length === 1, "SIPP meloloskan PDF");
    expect(e.sipp.dilihat).toEqual(["BAS 12.pdf"]);
    expect(e.sipp.ditolak).toEqual([]);
    expect((e.doc.getElementById("simpan") as HTMLElement).style.display).toBe("");
    const f = masuk.files![0];
    expect(f.name).toBe("BAS 12.pdf");
    expect(f.type).toBe("application/pdf");
    const isi = await new Promise<Uint8Array>((selesai) => {
      const r = new e.w.FileReader();
      r.onload = () => selesai(new Uint8Array(r.result as ArrayBuffer));
      r.readAsArrayBuffer(f);
    });
    expect(Buffer.from(isi).equals(Buffer.from(pdf))).toBe(true);
    expect(e.panggilan).toHaveLength(1);
    expect(e.panggilan[0]).toMatchObject({ alamat: "/aleta/api/aleta-ecourt/bas/word-ke-pdf", metode: "POST", ttd: "1", nama: "BAS 12.rtf" });
    const status = teksPanel(e.doc);
    expect(status).toMatch(/Siap diunggah sebagai PDF: BAS 12\.pdf/);
    expect(status).toContain(PP);
    expect(status).toMatch(/Panitera Pengganti Sri Wahyuni, S\.H\.: tanda tangan terpasang/);
    expect(status).toMatch(/Ketua Majelis Idris, S\.H\.I\., M\.H\.: belum punya tanda tangan tersahkan/);
    expect(e.diKirim).toEqual([]); // tidak ada kiriman langsung ke SIPP: SIPP sendiri yang mengunggah
  });

  it("DOCX, DOC, dan ODT (akhiran Word apa pun) mengambil jalur yang sama", async () => {
    const pdf = await pdfBas("dua-kolom");
    for (const [bita, nama] of [[DOCX, "BAS.docx"], [DOC, "BAS.DOC"], [ODT, "BAS.odt"], [DOCX, "BAS.dotx"]] as const) {
      const e = await bukaEkstensi({ jawab: jawabPdf(pdf) });
      pilihBerkas(e.w, e.doc, bita, nama);
      await sampai(() => e.sipp.lolos.length === 1, `lolos ${nama}`);
      expect(e.sipp.ditolak, nama).toEqual([]);
      expect(e.panggilan[0].nama).toBe(nama);
    }
  });

  it("PDF biasa dan berkas yang bukan Word TIDAK disentuh: pemeriksa SIPP menjawab seperti biasa, tanpa panggilan ke server", async () => {
    const e = await bukaEkstensi();
    pilihBerkas(e.w, e.doc, PDF_KECIL, "BAS.pdf");
    await tunggu(30);
    expect(e.sipp.lolos).toEqual(["BAS.pdf"]);
    for (const [bita, nama] of [[XLSX, "rekap.xlsx"], [enc("zip?"), "arsip.zip"], [XLS, "rekap.xls"]] as const) pilihBerkas(e.w, e.doc, bita, nama);
    await tunggu(30);
    expect(e.sipp.ditolak).toEqual(["rekap.xlsx", "arsip.zip", "rekap.xls"]); // ditolak SIPP sendiri
    expect(e.doc.querySelector(".aleta-bwp")).toBeNull();
    expect(e.panggilan).toEqual([]);
  });

  it("jendela e-Doc yang bukan BAS (relaas, putusan, putusan sela) tidak disentuh: SIPP menolak Word seperti biasa", async () => {
    for (const dari of ["relaas", "put", "putsela"]) {
      const e = await bukaEkstensi({ dari });
      pilihBerkas(e.w, e.doc, RTF, "x.rtf");
      await tunggu(30);
      expect(e.sipp.dilihat).toEqual(["x.rtf"]);
      expect(e.panggilan).toEqual([]);
    }
  });

  it("berakhiran Word tetapi isinya BUKAN Word atau PDF: dijelaskan dan dikosongkan, tanpa panggilan ke server", async () => {
    const e = await bukaEkstensi();
    const masuk = pilihBerkas(e.w, e.doc, enc("ini teks biasa"), "palsu.docx");
    await sampai(() => /bukan berkas Word/.test(teksPanel(e.doc)), "pesan");
    expect(masuk.files!.length).toBe(0);
    expect(e.panggilan).toEqual([]);
    expect(e.sipp.dilihat).toEqual([]);
  });

  it("lebih dari 20 MB: ditolak dengan alasan sebelum berkas dibaca, tanpa panggilan ke server", async () => {
    const e = await bukaEkstensi();
    const besar = new Uint8Array(21 * 1024 * 1024);
    besar.set(RTF);
    const masuk = pilihBerkas(e.w, e.doc, besar, "BAS-besar.rtf");
    await sampai(() => /lebih dari 20 MB/.test(teksPanel(e.doc)), "pesan ukuran");
    expect(masuk.files!.length).toBe(0);
    expect(e.panggilan).toEqual([]);
    expect(e.sipp.dilihat).toEqual([]);
  });

  it("berakhiran Word tetapi isinya PDF: dipakai sebagai .pdf tanpa panggilan ke server", async () => {
    const e = await bukaEkstensi();
    const masuk = pilihBerkas(e.w, e.doc, PDF_KECIL, "BAS Aleta.docx");
    await sampai(() => e.sipp.lolos.length === 1, "lolos");
    expect(masuk.files![0].name).toBe("BAS.pdf");
    expect(e.panggilan).toEqual([]);
  });

  it("kegagalan server TERLIHAT jelas dengan sebabnya, pilihan dikosongkan (seperti penolakan SIPP), Simpan tetap tersembunyi", async () => {
    const e = await bukaEkstensi({ jawab: () => ({ ok: false, status: 503, pesan: "Konversi di server gagal: soffice belum tersedia" }) });
    const masuk = pilihBerkas(e.w, e.doc, RTF, "BAS.rtf");
    await sampai(() => /tidak dapat diubah ke PDF/i.test(teksPanel(e.doc)), "pesan gagal");
    expect(teksPanel(e.doc)).toMatch(/soffice belum tersedia/);
    expect(masuk.files!.length).toBe(0);
    expect((e.doc.getElementById("simpan") as HTMLElement).style.display).toBe("none");
    expect(e.sipp.dilihat).toEqual([]); // SIPP tidak pernah melihat berkas Word -> tidak ada alert dobel
  });

  it("jawaban rusak (bukan PDF) tidak pernah dipasang", async () => {
    const e = await bukaEkstensi({ jawab: () => ({ data: { pdfBase64: b64(enc("bukan pdf")), namaBerkas: "x.pdf", penandatangan: [], peringatan: [] } }) });
    const masuk = pilihBerkas(e.w, e.doc, RTF, "BAS.rtf");
    await sampai(() => /bukan PDF/i.test(teksPanel(e.doc)), "pesan");
    expect(masuk.files!.length).toBe(0);
    expect(e.sipp.lolos).toEqual([]);
  });

  it("sisa blangko tetap berlaku: petugas membatalkan -> tidak ada panggilan ubah, pilihan dikosongkan, SIPP tidak melihat apa pun", async () => {
    const e = await bukaEkstensi({ tinjau: () => ({ lanjut: false }) });
    const masuk = pilihBerkas(e.w, e.doc, RTF, "BAS.rtf");
    await sampai(() => /Dibatalkan/.test(teksPanel(e.doc)), "dibatalkan");
    expect(e.panggilan).toEqual([]);
    expect(masuk.files!.length).toBe(0);
    expect(e.sipp.dilihat).toEqual([]);
  });

  it("sisa blangko: petugas melanjutkan -> berkas tetap diubah", async () => {
    const e = await bukaEkstensi({ tinjau: () => ({ lanjut: true }), jawab: jawabPdf(await pdfBas("dua-kolom")) });
    pilihBerkas(e.w, e.doc, RTF, "BAS.rtf");
    await sampai(() => e.sipp.lolos.length === 1, "diganti");
    expect(e.panggilan).toHaveLength(1);
  });

  it("dialog pilih berkas SIPP dilebarkan: accept memuat .rtf/.doc/.docx selain .pdf, saat diklik", async () => {
    const e = await bukaEkstensi();
    const masuk = e.doc.getElementById("fileform") as HTMLInputElement;
    expect(masuk.getAttribute("accept")).toBe(".pdf,application/pdf");
    masuk.dispatchEvent(new e.w.MouseEvent("click", { bubbles: true, cancelable: true }));
    const accept = masuk.getAttribute("accept")!;
    for (const x of [".pdf", "application/pdf", ".rtf", ".doc", ".docx"]) expect(accept.split(",")).toContain(x);
    // jendela e-Doc lain tidak dilebarkan
    const lain = await bukaEkstensi({ dari: "relaas" });
    const m2 = lain.doc.getElementById("fileform") as HTMLInputElement;
    m2.dispatchEvent(new lain.w.MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(m2.getAttribute("accept")).toBe(".pdf,application/pdf");
  });

  it("Simpan yang ditekan SELAGI mengubah ditahan sampai PDF terpasang, lalu terkirim sekali dengan berkas PDF", async () => {
    const pdf = await pdfBas("dua-kolom");
    let lepas!: () => void;
    const tunda = new Promise<void>((r) => (lepas = r));
    const e = await bukaEkstensi({ jawab: () => ({ tunda, data: { pdfBase64: b64(pdf), namaBerkas: "BAS.pdf", penandatangan: [], peringatan: [] } }) });
    const masuk = pilihBerkas(e.w, e.doc, RTF, "BAS.rtf");
    await sampai(() => e.panggilan.length === 1, "mulai mengubah");
    const dikirim: string[] = [];
    const form = e.doc.getElementById("frm_upload_file") as HTMLFormElement;
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      dikirim.push(`${masuk.files![0].name}|${masuk.files![0].type}`);
    });
    (e.doc.getElementById("simpan") as HTMLInputElement).click();
    await tunggu(30);
    expect(dikirim).toEqual([]); // masih ditahan
    lepas();
    await sampai(() => dikirim.length === 1, "terkirim sesudah selesai");
    await tunggu(60);
    expect(dikirim).toEqual(["BAS.pdf|application/pdf"]);
  });

  it("Simpan yang ditahan lalu pengubahan GAGAL: tidak ada yang terkirim", async () => {
    let lepas!: () => void;
    const tunda = new Promise<void>((r) => (lepas = r));
    const e = await bukaEkstensi({ jawab: () => ({ tunda, ok: false, status: 500, pesan: "rusak" }) });
    pilihBerkas(e.w, e.doc, RTF, "BAS.rtf");
    await sampai(() => e.panggilan.length === 1, "mulai");
    let dikirim = 0;
    (e.doc.getElementById("frm_upload_file") as HTMLFormElement).addEventListener("submit", (ev) => {
      ev.preventDefault();
      dikirim += 1;
    });
    (e.doc.getElementById("simpan") as HTMLInputElement).click();
    lepas();
    await sampai(() => /tidak dapat diubah/.test(teksPanel(e.doc)), "gagal");
    await tunggu(80);
    expect(dikirim).toBe(0);
  });

  it("kotak 'tanda tangan' dimatikan -> server diminta ttd=0, dari berkas ASLI; kotak tanpa atribut name", async () => {
    const pdf = await pdfBas("dua-kolom");
    const e = await bukaEkstensi({ jawab: jawabPdf(pdf) });
    pilihBerkas(e.w, e.doc, RTF, "BAS.rtf");
    await sampai(() => e.sipp.lolos.length === 1, "ubah pertama");
    const kotak = e.doc.querySelector(".aleta-bwp input[type=checkbox]") as HTMLInputElement;
    expect(kotak.checked).toBe(true);
    expect(kotak.hasAttribute("name")).toBe(false); // tidak ikut terkirim ke SIPP
    kotak.checked = false;
    kotak.dispatchEvent(new e.w.Event("change", { bubbles: true }));
    await sampai(() => e.panggilan.length === 2 && e.sipp.lolos.length === 2, "ubah ulang tanpa tanda tangan");
    expect(e.panggilan[1].ttd).toBe("0");
    expect(e.panggilan[1].nama).toBe("BAS.rtf"); // dari berkas ASLI, bukan dari PDF
    expect(teksPanel(e.doc)).toMatch(/Tanpa tanda tangan scan/);
  });

  it("pilihan baru membatalkan yang lama: hasil pengubahan pertama yang datang terlambat tidak menimpa", async () => {
    const pdf = await pdfBas("dua-kolom");
    let lepas1!: () => void;
    const tunda1 = new Promise<void>((r) => (lepas1 = r));
    const e = await bukaEkstensi({ jawab: (n) => (n === 1 ? { tunda: tunda1, data: { pdfBase64: b64(pdf), namaBerkas: "LAMA.pdf", penandatangan: [], peringatan: [] } } : { data: { pdfBase64: b64(pdf), namaBerkas: "BARU.pdf", penandatangan: [], peringatan: [] } }) });
    const masuk = pilihBerkas(e.w, e.doc, RTF, "LAMA.rtf");
    await sampai(() => e.panggilan.length === 1, "pertama");
    pilihBerkas(e.w, e.doc, RTF, "BARU.rtf");
    await sampai(() => masuk.files![0]?.name === "BARU.pdf", "kedua");
    lepas1();
    await tunggu(60);
    expect(masuk.files![0].name).toBe("BARU.pdf");
    expect(e.sipp.lolos).toEqual(["BARU.pdf"]);
  });

  it("tak satu kata Aleta pada yang terkirim ke SIPP (nama berkas, kolom form) dan tidak ada isian bernama baru", async () => {
    const e = await bukaEkstensi({ jawab: jawabPdf(await pdfBas("dua-kolom"), { namaBerkas: "BAS Aleta.pdf" }) });
    const masuk = pilihBerkas(e.w, e.doc, RTF, "BAS Aleta.rtf");
    await sampai(() => e.sipp.lolos.length === 1, "diganti");
    expect(masuk.files![0].name).not.toMatch(/aleta/i);
    const form = e.doc.getElementById("frm_upload_file") as HTMLFormElement;
    const bernama = Array.from(form.querySelectorAll("[name]")).map((x) => x.getAttribute("name"));
    expect(bernama.sort()).toEqual(["enc", "enc1", "fileform", "from", "urutan"].sort());
  });
});

describe("penjaga berkas ekstensi", () => {
  const js = bacaEks("bas-word-pdf.js");
  it("tanpa angka empat digit telanjang pada teks yang tampil (pakai konstanta)", () => {
    const teks = Array.from(js.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)).map((m) => m[2]);
    for (const t of teks.map((x) => x.replace(/\$\{[^}]*\}/g, ""))) expect(t, t).not.toMatch(/(?<![\w.#/-])\d{4}(?![\w.-])/);
  });
  it("tidak menulis ke SIPP sendiri (tanpa fetch/XHR langsung) dan tidak membawa sandi/kunci", () => {
    expect(js).not.toMatch(/XMLHttpRequest/);
    expect(js).not.toMatch(/\bfetch\s*\(/);
    expect(js).not.toMatch(/password|sandi|api[_-]?key/i);
  });
  it("rute baru terdaftar sebagai 'hanya menghitung' di mode coba dan latihan", () => {
    const alat = bacaEks("panel-alat.js");
    const pola = /\/aleta\\\/api\\\/aleta-ecourt\\\/bas\\\/word-ke-pdf\(\?:\[\?#\]\|\$\)\//g;
    expect((alat.match(pola) ?? []).length).toBe(2);
  });
});
