// @vitest-environment node
/**
 * ============================================================================
 * 27 OKT 2026 - TANDA TANGAN DI PDF: POSISI DARI KOORDINAT BARIS NAMA
 * ============================================================================
 *
 * Keluhan: di PDF SALINAN gambar tanda tangan hakim tertempel di posisi acak (menimpa nama, melayang di tepi kanan, di atas nama PP).
 * Sebab: gambar disisipkan di RTF sebagai bentuk mengambang dengan posisi DITEBAK dari rata paragraf; nama yang berada di sel tabel
 * atau blok dirata kanan meleset. Kini:
 *   - PDF SALINAN: majelis dan panitera sidang HANYA bertulis "ttd" (disusun bot, RTF); satu-satunya gambar = Panitera pengesah di
 *     blok "Untuk Salinan", dibubuhkan portal DI PDF di atas namanya;
 *   - PDF biasa + "Tambah tanda tangan": tiap gambar dibubuhkan portal DI PDF di atas nama pemiliknya.
 * Posisi dihitung dari koordinat baris nama yang dibaca pdfjs (uji murni + PDF contoh buatan pdf-lib).
 * soffice tidak terpasang di mesin pengembangan: PDF contoh BUATAN (tata letak mirip blok tanda tangan putusan), bukan hasil LibreOffice.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { PDFDocument, PDFName, PDFRawStream, StandardFonts, rgb } from "pdf-lib";
// @ts-expect-error pngjs tidak punya berkas tipe (hanya dipakai membuat gambar contoh)
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import {
  PT_PER_MM,
  bacaItemPdf,
  bubuhkanTtdPdf,
  cariNamaDiBaris,
  hitungLetakTtd,
  padatkan,
  susunBaris,
  type ItemTeks,
  type TemuanNama,
} from "@/server/modules/aleta-ecourt/pdf-bubuh-ttd";

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const salinanBot = muat("./services/salinanPutusanService.js") as {
  susunSalinan: (r: string, o: { ttd: { jenis: string; isi: Buffer } | null; ttdDiPdf?: boolean; atur?: Record<string, number> }) => { rtf: string; laporan: Record<string, unknown> };
  teksTampak: (r: string) => string;
};

function pngContoh(w = 200, h = 100, merah = false): Buffer {
  const p = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (w * y + x) << 2;
      const garis = Math.abs(y - (h / 2 + (h / 3) * Math.sin(x / 14))) < 3;
      p.data[i] = merah ? 200 : 20;
      p.data[i + 1] = merah ? 20 : 20;
      p.data[i + 2] = merah ? 20 : 120;
      p.data[i + 3] = garis ? 255 : 0;
    }
  }
  return PNG.sync.write(p);
}

type Teks = { t: string; tengah?: number; x?: number; y: number; ukuran?: number; putih?: boolean; hal?: number };
/** PDF contoh dua halaman: blok tanda tangan putusan (Ketua, dua Hakim Anggota sekolom, PP) dan blok "Untuk Salinan" di kanan. */
async function pdfContoh(opsi: { untukSalinanTampak?: boolean; labelRapat?: boolean } = {}): Promise<Uint8Array> {
  const dok = await PDFDocument.create();
  const huruf = await dok.embedFont(StandardFonts.TimesRoman);
  const tebal = await dok.embedFont(StandardFonts.TimesRomanBold);
  const h1 = dok.addPage([595.28, 841.89]);
  const h2 = dok.addPage([595.28, 841.89]);
  const gambar = (x: Teks) => {
    const halaman = x.hal === 2 ? h2 : h1;
    const ukuran = x.ukuran ?? 12;
    const f = x.t.includes("S.H") ? tebal : huruf;
    const lebar = f.widthOfTextAtSize(x.t, ukuran);
    const kiri = x.tengah !== undefined ? x.tengah - lebar / 2 : (x.x ?? 70);
    halaman.drawText(x.t, { x: kiri, y: x.y, size: ukuran, font: f, color: x.putih ? rgb(1, 1, 1) : rgb(0, 0, 0) });
  };
  const rapat = opsi.labelRapat ? 14 : 62; // jarak label -> nama
  const daftar: Teks[] = [
    { t: "PUTUSAN", tengah: 297, y: 780 },
    { t: "Menimbang, bahwa Hakim Derry Briantono, S.H. sebagai Hakim Anggota memeriksa perkara ini;", x: 70, y: 740 },
    { t: "Ketua Majelis,", tengah: 420, y: 520 },
    { t: "ttd", tengah: 420, y: 520 - 24 },
    { t: "Idris, S.H.I., M.H.", tengah: 420, y: 520 - rapat },
    { t: "Hakim Anggota,", tengah: 150, y: 430 },
    { t: "Hakim Anggota,", tengah: 420, y: 430 },
    { t: "Derry Briantono, S.H.", tengah: 150, y: 430 - rapat },
    { t: "Qadariyah, S.H.", tengah: 420, y: 430 - rapat },
    { t: "Panitera Pengganti,", tengah: 420, y: 330 },
    { t: "Sri Wahyuni, S.H.", tengah: 420, y: 330 - rapat },
    // Halaman 2: blok Untuk Salinan, dirata kanan, di bawah rincian biaya.
    { t: "Rincian Biaya Perkara", x: 70, y: 780, hal: 2 },
    { t: "Untuk Salinan", tengah: 470, y: 700, hal: 2, putih: !opsi.untukSalinanTampak },
    { t: "Pengadilan Agama Donggala", tengah: 470, y: 684, hal: 2, putih: !opsi.untukSalinanTampak },
    { t: "Panitera,", tengah: 470, y: 668, hal: 2, putih: !opsi.untukSalinanTampak },
    { t: "Sri Susilowati, S.H.", tengah: 505, y: 560, hal: 2, putih: !opsi.untukSalinanTampak },
  ];
  daftar.forEach(gambar);
  return await dok.save();
}

/** Jumlah gambar (XObject Image) di seluruh PDF; topeng transparansi (SMask) PNG tidak dihitung. */
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

const item = (str: string, x: number, y: number, lebar: number, tinggi = 12, halaman = 1): ItemTeks => ({ str, x, y, lebar, tinggi, halaman });
const APA = { lebarTtdMm: 64, ttdTurunMm: 3, tinggiTtdMaksMm: 35, lebarCapMm: 36, capGeserKiriMm: 13, capGeserAtasMm: 4, opasitasCap: 0.88 };

describe("susunBaris / cariNamaDiBaris (murni)", () => {
  it("dua nama sekolom pada satu garis dasar: tiap nama punya rentang mendatarnya sendiri", () => {
    const baris = susunBaris([item("Derry Briantono, S.H.", 100, 300, 110), item("Qadariyah, S.H.", 360, 300, 80), item("Hakim Anggota,", 120, 360, 70), item("Hakim Anggota,", 360, 360, 70)]);
    expect(baris).toHaveLength(2);
    const a = cariNamaDiBaris(baris, "Derry Briantono, S.H.")!;
    const b = cariNamaDiBaris(baris, "Qadariyah, S.H.")!;
    expect(a.xMin).toBeCloseTo(100, 0);
    expect(a.xMax).toBeCloseTo(210, 0);
    expect(b.xMin).toBeCloseTo(360, 0);
    expect(b.xMax).toBeCloseTo(440, 0);
    expect(a.y).toBe(300);
  });
  it("nama terpecah menjadi beberapa potongan tetap ditemukan; tanda baca dan spasi tidak menghalangi", () => {
    const baris = susunBaris([item("Idris,", 100, 300, 30), item("S.H.I.,", 134, 300, 40), item("M.H.", 178, 300, 30)]);
    const t = cariNamaDiBaris(baris, "IDRIS S.H.I. M.H.")!;
    expect(t.xMin).toBeCloseTo(100, 0);
    expect(t.xMax).toBeCloseTo(208, 0);
  });
  it("kemunculan TERAKHIR yang dipakai; PDF biasa tidak membubuhi nama di blok 'Untuk Salinan'; salinan hanya sesudah penanda", () => {
    const baris = susunBaris([
      item("Menimbang Sri Wahyuni, S.H. sebagai PP", 70, 700, 220),
      item("Sri Wahyuni, S.H.", 300, 300, 90),
      item("Untuk Salinan", 400, 200, 70),
      item("Sri Wahyuni, S.H.", 400, 100, 90),
    ]);
    expect(cariNamaDiBaris(baris, "Sri Wahyuni, S.H.")!.y).toBe(100);
    expect(cariNamaDiBaris(baris, "Sri Wahyuni, S.H.", { sebelumPenanda: true })!.y).toBe(300);
    expect(cariNamaDiBaris(baris, "Sri Wahyuni, S.H.", { sesudahPenanda: true })!.y).toBe(100);
    expect(cariNamaDiBaris(baris, "Tidak Ada Orang, S.H.")).toBeNull();
    expect(padatkan("Idris, S.H.I.")).toBe("idrissh" + "i");
  });
});

describe("hitungLetakTtd (murni)", () => {
  const halaman = { lebar: 595.28, tinggi: 841.89 };
  const nama = (xMin: number, xMax: number, y = 300): TemuanNama => ({ indeks: 0, halaman: 1, xMin, xMax, y, tinggi: 12, cara: "utuh" });

  it("rata tengah dengan nama, tepi bawah tepat di atas puncak huruf nama (tumpang tindih kecil), tidak keluar halaman", () => {
    const l = hitungLetakTtd({ nama: nama(300, 400), halaman, rasio: 0.5, atur: APA, sekitar: [] });
    expect(l.kiri + l.lebar / 2).toBeCloseTo(350, 3);
    const puncak = 300 + 0.72 * 12;
    expect(l.bawah).toBeLessThanOrEqual(puncak);
    expect(l.bawah).toBeGreaterThan(puncak - 12 / 3 - 0.01);
    expect(l.lebar).toBeCloseTo(64 * PT_PER_MM, 3);
    expect(l.tinggi).toBeCloseTo(l.lebar * 0.5, 3);
  });
  it("nama di dekat margin kanan: gambar DIKECILKAN dengan tengah tetap di tengah nama (tidak digeser), tepi kanan <= lebar halaman - margin", () => {
    const margin = 8 * PT_PER_MM;
    const penuh = hitungLetakTtd({ nama: nama(300, 400), halaman, rasio: 0.5, atur: APA, sekitar: [] });
    const l = hitungLetakTtd({ nama: nama(470, 560), halaman, rasio: 0.5, atur: APA, sekitar: [] });
    expect(l.kiri + l.lebar / 2).toBeCloseTo(515, 3); // tengah nama
    expect(l.kiri + l.lebar).toBeLessThanOrEqual(halaman.lebar - margin + 0.01);
    expect(l.kiri).toBeGreaterThanOrEqual(margin - 0.01);
    expect(l.lebar).toBeLessThan(penuh.lebar);
    expect(l.lebar).toBeGreaterThanOrEqual(penuh.lebar * 0.5 - 0.01); // paling kecil separuh
    expect(l.tinggi / l.lebar).toBeCloseTo(0.5, 5); // rasio tetap
    expect(l.dikecilkan).toBeGreaterThan(0);
  });
  it("nama di dekat margin kiri: sama, diperkecil dengan tengah di tengah nama", () => {
    const margin = 8 * PT_PER_MM;
    const l = hitungLetakTtd({ nama: nama(40, 130), halaman, rasio: 0.5, atur: APA, sekitar: [] });
    expect(l.kiri + l.lebar / 2).toBeCloseTo(85, 3);
    expect(l.kiri).toBeGreaterThanOrEqual(margin - 0.01);
  });
  it("nama begitu dekat tepi sehingga ukuran separuh pun tak muat: baru digeser seminimal mungkin ke dalam margin", () => {
    const margin = 8 * PT_PER_MM;
    const penuh = hitungLetakTtd({ nama: nama(300, 400), halaman, rasio: 0.5, atur: APA, sekitar: [] });
    const l = hitungLetakTtd({ nama: nama(540, 585), halaman, rasio: 0.5, atur: APA, sekitar: [] });
    expect(l.lebar).toBeCloseTo(penuh.lebar * 0.5, 3);
    expect(l.kiri + l.lebar).toBeCloseTo(halaman.lebar - margin, 3);
  });
  it("tinggi dibatasi tinggiTtdMaksMm (gambar tinggi diperkecil lebarnya)", () => {
    const l = hitungLetakTtd({ nama: nama(300, 400), halaman, rasio: 2, atur: APA, sekitar: [] });
    expect(l.tinggi).toBeLessThanOrEqual(35 * PT_PER_MM + 0.01);
  });
  it("label di atas nama terlalu dekat: gambar dikecilkan sampai tidak menutupi label (titik tengah dan tepi bawah tetap)", () => {
    const label = item("Hakim Anggota,", 310, 300 + 12 + 40, 70, 12);
    const bebas = hitungLetakTtd({ nama: nama(300, 400), halaman, rasio: 0.5, atur: APA, sekitar: [] });
    const l = hitungLetakTtd({ nama: nama(300, 400), halaman, rasio: 0.5, atur: APA, sekitar: [label] });
    expect(l.tinggi).toBeLessThan(bebas.tinggi);
    expect(l.bawah).toBeCloseTo(bebas.bawah, 6);
    expect(l.kiri + l.lebar / 2).toBeCloseTo(350, 3);
    expect(l.dikecilkan).toBeGreaterThan(0);
    if (!l.terhimpit) expect(l.bawah + l.tinggi).toBeLessThanOrEqual(label.y - 0.22 * 12 + 0.6);
  });
  it("tulisan yang tidak bertumpuk mendatar (kolom lain) tidak membatasi", () => {
    const labelLain = item("Hakim Anggota,", 100, 300 + 12 + 20, 70, 12);
    const l = hitungLetakTtd({ nama: nama(360, 440), halaman, rasio: 0.5, atur: APA, sekitar: [labelLain] });
    expect(l.dikecilkan).toBe(0);
  });
});

describe("bubuhkanTtdPdf - PDF contoh", () => {
  it("PDF biasa: tiap gambar di atas nama pemiliknya (rata tengah), nama sekolom tidak tertukar, teks PDF tidak berubah, nama di blok Untuk Salinan tak dibubuhi", async () => {
    const asal = await pdfContoh();
    const sebelum = await bacaItemPdf(asal);
    const png = new Uint8Array(pngContoh());
    const h = await bubuhkanTtdPdf(
      asal,
      [
        { nama: "Idris, S.H.I., M.H.", gambar: png },
        { nama: "Derry Briantono, S.H.", gambar: png },
        { nama: "Qadariyah, S.H.", gambar: png },
        { nama: "Sri Susilowati, S.H.", gambar: png },
        { nama: "Orang Tak Ada, S.H.", gambar: png },
      ],
      { atur: APA, sebelumPenanda: true }
    );
    // Nama pertama yang ada di blok "Untuk Salinan" (putih) TIDAK dibubuhi di PDF biasa; nama yang tak ada dilaporkan.
    expect(h.dipasang).toEqual(["Idris, S.H.I., M.H.", "Derry Briantono, S.H.", "Qadariyah, S.H."]);
    expect(h.tidakDitemukan).toEqual(["Sri Susilowati, S.H.", "Orang Tak Ada, S.H."]);
    const peta = new Map(h.geometri.map((g) => [g.nama, g.ttd]));
    expect(peta.get("Idris, S.H.I., M.H.")!.kiri + peta.get("Idris, S.H.I., M.H.")!.lebar / 2).toBeCloseTo(420, 0);
    expect(peta.get("Derry Briantono, S.H.")!.kiri + peta.get("Derry Briantono, S.H.")!.lebar / 2).toBeCloseTo(150, 0);
    expect(peta.get("Qadariyah, S.H.")!.kiri + peta.get("Qadariyah, S.H.")!.lebar / 2).toBeCloseTo(420, 0);
    // Tepat di atas nama: tepi bawah di sekitar puncak huruf nama (y nama = 520 - 62).
    expect(peta.get("Idris, S.H.I., M.H.")!.bawah).toBeGreaterThan(458 + 4);
    expect(peta.get("Idris, S.H.I., M.H.")!.bawah).toBeLessThan(458 + 12);
    // Teks tidak berubah dan gambar bertambah sebanyak yang dipasang.
    const sesudah = await bacaItemPdf(h.pdf);
    expect(sesudah.item.map((i) => i.str)).toEqual(sebelum.item.map((i) => i.str));
    expect(jumlahGambar(await PDFDocument.load(h.pdf))).toBe(3);
    expect(jumlahGambar(await PDFDocument.load(asal))).toBe(0);
  });

  it("PDF SALINAN: satu-satunya gambar = Panitera di blok Untuk Salinan, di atas namanya, rata tengah dengan nama, tidak terpotong di tepi kanan", async () => {
    const asal = await pdfContoh({ untukSalinanTampak: true });
    const h = await bubuhkanTtdPdf(asal, [{ nama: "Sri Susilowati, S.H.", gambar: new Uint8Array(pngContoh()), cap: new Uint8Array(pngContoh(80, 80, true)) }], { atur: APA, sesudahPenanda: true });
    expect(h.dipasang).toEqual(["Sri Susilowati, S.H."]);
    const g = h.geometri[0];
    expect(g.halaman).toBe(2);
    // Nama di tengah x=505 dengan lebar ~100 pt -> tepi kanan nama ~555; gambar 64 mm (181 pt) harus digeser ke dalam margin kanan.
    expect(g.ttd.kiri + g.ttd.lebar).toBeLessThanOrEqual(595.28 - 8 * PT_PER_MM + 0.01);
    expect(g.ttd.kiri + g.ttd.lebar / 2).toBeCloseTo(505, 0); // rata tengah dengan nama (tidak digeser)
    expect(g.ttd.bawah).toBeGreaterThan(560 + 4);
    expect(g.ttd.bawah).toBeLessThan(560 + 12);
    expect(g.cap).not.toBeNull();
    expect(jumlahGambar(await PDFDocument.load(h.pdf))).toBe(2); // tanda tangan + cap
  });

  it("label rapat di atas nama: gambar mengecil dan tidak menutupi label 'Panitera,'", async () => {
    const asal = await pdfContoh({ labelRapat: true });
    const sebelum = await bacaItemPdf(asal);
    const h = await bubuhkanTtdPdf(asal, [{ nama: "Sri Wahyuni, S.H.", gambar: new Uint8Array(pngContoh()) }], { atur: APA, sebelumPenanda: true });
    expect(h.dipasang).toEqual(["Sri Wahyuni, S.H."]);
    const g = h.geometri[0].ttd;
    const label = sebelum.item.find((i) => i.str === "Panitera Pengganti,")!;
    expect(g.dikecilkan).toBeGreaterThan(0);
    if (!g.terhimpit) expect(g.bawah + g.tinggi).toBeLessThanOrEqual(label.y - 0.22 * label.tinggi + 0.6);
  });

  it("tanpa daftar atau PDF rusak: PDF dikembalikan apa adanya dan semua nama dilaporkan", async () => {
    const asal = await pdfContoh();
    expect((await bubuhkanTtdPdf(asal, [])).pdf).toBe(asal);
    const rusak = new Uint8Array([1, 2, 3, 4]);
    const h = await bubuhkanTtdPdf(rusak, [{ nama: "Idris, S.H.I., M.H.", gambar: new Uint8Array(pngContoh()) }]);
    expect(h.pdf).toBe(rusak);
    expect(h.dipasang).toEqual([]);
    expect(h.tidakDitemukan).toEqual(["Idris, S.H.I., M.H."]);
    expect(h.galat).not.toBe("");
  });
});

describe("contoh keluaran (hanya bila SIMPAN_CONTOH_PDF diisi folder)", () => {
  it.skipIf(!process.env.SIMPAN_CONTOH_PDF)("menyimpan PDF contoh sebelum/sesudah untuk diperiksa mata", async () => {
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const folder = String(process.env.SIMPAN_CONTOH_PDF);
    mkdirSync(folder, { recursive: true });
    const png = new Uint8Array(pngContoh());
    const cap = new Uint8Array(pngContoh(80, 80, true));
    const salinan = await pdfContoh({ untukSalinanTampak: true });
    writeFileSync(path.join(folder, "salinan-ttd-sebelum.pdf"), salinan);
    const h = await bubuhkanTtdPdf(salinan, [{ nama: "Sri Susilowati, S.H.", gambar: png, cap }], { atur: APA, sesudahPenanda: true });
    writeFileSync(path.join(folder, "salinan-ttd-sesudah.pdf"), h.pdf);
    const biasa = await pdfContoh();
    writeFileSync(path.join(folder, "biasa-ttd-sebelum.pdf"), biasa);
    const b2 = await bubuhkanTtdPdf(biasa, [{ nama: "Idris, S.H.I., M.H.", gambar: png }, { nama: "Derry Briantono, S.H.", gambar: png }, { nama: "Qadariyah, S.H.", gambar: png }, { nama: "Sri Wahyuni, S.H.", gambar: png }], { atur: APA, sebelumPenanda: true });
    writeFileSync(path.join(folder, "biasa-ttd-sesudah.pdf"), b2.pdf);
    expect(b2.dipasang).toHaveLength(4);
  });
});

describe("salinanPutusanService - ttdDiPdf (RTF tanpa gambar, 'ttd' per penanda tangan)", () => {
  const P = "\\pard \\plain \\qj \\sl360 \\slmult1 \\tqc \\tx1400 \\tqc \\tx4200 \\tqc \\tx7000 \\itap0 \\fs20 ";
  const par = (isi: string) => `${P}{\\fs24 \\f4 ${isi}}{\\fs24 \\f4 \\par }`;
  const kosong = `${P}{\\fs24 \\f4 \\par }`;
  const FB = "\\pard \\plain \\qc \\sa80 \\phpg \\pvpara \\posx7899 \\posy35 \\intbl \\itap1 \\fs20 ";
  const BINGKAI_UNTUK =
    "\\trowd \\trql \\trgaph0 \\trrh2037 \\trleft-108 \\tpvpara \\tphpg \\tposx7899 \\tposy35 \\cellx3472 " +
    `${FB}{\\fs24 \\f4 \\cf16 Untuk Salinan}{\\fs24 \\f4 \\cf16 \\par }` +
    `${FB}{\\fs24 \\f4 \\cf16 Pengadilan Agama Donggala }{\\fs24 \\f4 \\cf16 \\par }` +
    `${FB}{\\fs24 \\f4 \\cf16 Panitera,}{\\fs28 \\f5 \\cf16 \\par }` +
    `${FB}{\\b1 \\fs24 \\f4 \\cf16 Sri Susilowati, S.H.}{\\b1 \\fs24 \\f5 \\cf16 \\cell }` +
    "\\pard \\plain \\qr \\intbl \\itap1 \\fs20 {\\trowd \\trql \\trgaph0 \\trrh2037 \\trleft-108 \\tpvpara \\tphpg \\tposx7899 \\tposy35 \\cellx3472 \\row }";
  const rtf =
    `{\\rtf1\\ansi{\\colortbl;\\red0\\green0\\blue0;${"\\red0\\green0\\blue255;".repeat(14)}\\red255\\green255\\blue255;}\\paperw12240\\margl2268\\margr1239 ` +
    [
      par("PUTUSAN"),
      ...Array.from({ length: 30 }, (_, i) => par(`Menimbang paragraf ${i + 1}, panjang isinya.`)),
      par("\\tab  \\tab Ketua Majelis,"),
      kosong,
      par("\\tab  \\tab {\\b1 Idris, S.H.I., M.H.}"),
      par("\\tab Hakim Anggota, \\tab  \\tab Hakim Anggota,"),
      kosong,
      par("\\tab {\\b1 Derry Briantono, S.H.} \\tab  \\tab {\\b1 Qadariyah, S.H.}"),
      par("\\tab  \\tab Panitera Sidang,"),
      kosong,
      par("\\tab  \\tab {\\b1 Sri Wahyuni, S.H.}"),
      par("Rincian Biaya Perkara:"),
      BINGKAI_UNTUK,
      par("J u m l a h : Rp 199.000,00"),
    ].join("") +
    "}";
  const png = Buffer.from(pngContoh());

  it("tidak ada gambar di RTF (majelis dan panitera sidang hanya 'ttd'); bot hanya menyediakan ruang untuk Panitera", () => {
    const { rtf: hasil, laporan } = salinanBot.susunSalinan(rtf, { ttd: { jenis: "png", isi: png }, ttdDiPdf: true });
    expect(hasil).not.toContain("\\pict");
    expect(hasil).not.toContain("\\shp");
    expect(laporan.ttdDiPdf).toBe(true);
    expect(laporan.ttdDitambah).toBe(4);
    expect(laporan.namaPanitera).toBe("Sri Susilowati, S.H.");
    expect(laporan.gambarTtdPanitera).toBe(true);
    const t = salinanBot.teksTampak(hasil);
    expect(t.match(/ttd/g)).toHaveLength(4); // Ketua, dua Hakim Anggota, Panitera Sidang - masing-masing satu
    expect(t).toMatch(/Ketua Majelis,\s*\t \tttd/);
    expect(t).toMatch(/\tttd \t \tttd/);
    expect(t).toMatch(/Panitera Sidang,\s*\t \tttd/);
    // Ruang di atas nama Panitera disediakan (baris kosong tambahan) agar gambar tidak menutupi 'Panitera,'.
    const lama = salinanBot.susunSalinan(rtf, { ttd: null, ttdDiPdf: true }).rtf;
    expect(hasil.length).toBeGreaterThanOrEqual(lama.length);
  });
  it("cara lama (tanpa ttdDiPdf) tidak berubah: gambar Panitera mengambang di RTF", () => {
    const { rtf: hasil, laporan } = salinanBot.susunSalinan(rtf, { ttd: { jenis: "png", isi: png } });
    expect(hasil).toContain("\\shpbypara");
    expect(laporan.ttdDiPdf).toBe(false);
  });
});
