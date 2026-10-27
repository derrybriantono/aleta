/**
 * ============================================================================
 * PDF SALINAN PUTUSAN (14 Okt 2026)
 * ============================================================================
 *
 * Diukur atas blangko ABT [01] [Kabul Verstek] Cerai (Format Lengkap) perkara
 * 573/Pdt.G/2026 (RTF asli, dikonversi LibreOffice container bot):
 *
 *   - "SALINAN" dan blok "Untuk Salinan / Pengadilan Agama Donggala /
 *     Panitera, / <nama>" berwarna PUTIH (\cf16) di bingkai bertepatan -
 *     tidak tampak di putusan asli; LibreOffice MENGABAIKAN \tposx bingkai,
 *     sehingga bingkai jatuh di tepi kiri (SALINAN) dan di tengah rincian
 *     biaya (Untuk Salinan);
 *   - "ttd" 0 kemunculan; salinan buatan tangan 395/Pdt.G/2026 memuat 4.
 *
 * RTF di bawah adalah TIRUAN berstruktur sama (tanpa data perkara sungguhan).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const salinan = muat("./services/salinanPutusanService.js") as {
  teksTampak: (r: string) => string;
  susunSalinan: (
    r: string,
    o: { ttd: { jenis: string; isi: Buffer } | null }
  ) => { rtf: string; laporan: Record<string, unknown> };
  namaPaniteraSalinan: (r: string) => string;
};
const baca = (j: string) => readFileSync(path.join(AKAR, j), "utf8").replace(/\r\n/g, "\n");

const P = "\\pard \\plain \\qj \\sl360 \\slmult1 \\tqc \\tx1400 \\tqc \\tx4200 \\tqc \\tx7000 \\itap0 \\fs20 ";
const par = (isi: string) => `${P}{\\fs24 \\f4 ${isi}}{\\fs24 \\f4 \\par }`;
const kosongPar = `${P}{\\fs24 \\f4 \\par }`;
const BINGKAI_SALINAN =
  "\\trowd \\trql \\trgaph0 \\trleft0 \\cellx3472 \\pard \\plain \\qc \\phmrg \\pvpara \\posx1488 \\posy1083 \\intbl \\itap1 \\fs20 " +
  "{\\b1 \\fs24 \\f4 \\cf16 SALINAN}{\\b1 \\fs24 \\f4 \\cell }\\pard \\plain \\qr \\intbl \\itap1 \\fs20 " +
  "{\\trowd \\trql \\trgaph0 \\trrh402 \\trleft-108 \\tpvpg \\tphpg \\tposx1488 \\tposy1083 \\tabsnoovrlp1 \\clwWidth3580 \\cellx3472 \\row }";
const FB = "\\pard \\plain \\qc \\sa80 \\phpg \\pvpara \\posx7899 \\posy35 \\intbl \\itap1 \\fs20 ";
const BINGKAI_UNTUK =
  "\\trowd \\trql \\trgaph0 \\trrh2037 \\trleft-108 \\tpvpara \\tphpg \\tposx7899 \\tposy35 \\cellx3472 " +
  `${FB}{\\fs24 \\f4 \\cf16 Untuk Salinan}{\\fs24 \\f4 \\cf16 \\par }` +
  `${FB}{\\fs24 \\f4 \\cf16 Pengadilan Agama Donggala }{\\fs24 \\f4 \\cf16 \\par }` +
  `${FB}{\\fs24 \\f4 \\cf16 Panitera,}{\\fs28 \\f5 \\cf16 \\par }` +
  `${FB}{\\fs32 \\f5 \\cf16 \\par }` +
  `${FB}{\\b1 \\fs24 \\f4 \\cf16 Nama Panitera Tiruan, S.H.}{\\b1 \\fs24 \\f5 \\cf16 \\cell }` +
  "\\pard \\plain \\qr \\intbl \\itap1 \\fs20 {\\trowd \\trql \\trgaph0 \\trrh2037 \\trleft-108 \\tpvpara \\tphpg \\tposx7899 \\tposy35 \\cellx3472 \\row }";

function rtfTiruan(): string {
  const badan = [
    BINGKAI_SALINAN,
    par("PUTUSAN"),
    par("Nomor 1/Pdt.G/2026/PA.Dgl"),
    // Teks putih di badan (daftar bukti pada blangko asli) - TIDAK boleh disentuh.
    `${P}{\\fs24 \\f4 \\cf16 Fotokopi bukti tersembunyi}{\\fs24 \\f4 \\par }`,
    ...Array.from({ length: 40 }, (_, i) => par(`Menimbang paragraf ${i + 1} sebagai Ketua Majelis, yang panjang isinya.`)),
    par("\\tab  \\tab Ketua Majelis,"),
    kosongPar,
    kosongPar,
    par("\\tab  \\tab {\\b1 Ketua Tiruan, S.H.I.}"),
    par("\\tab Hakim Anggota, \\tab  \\tab Hakim Anggota,"),
    kosongPar,
    kosongPar,
    par("\\tab {\\b1 Anggota Satu} \\tab  \\tab {\\b1 Anggota Dua}"),
    par("\\tab  \\tab Panitera Sidang,"),
    kosongPar,
    par("\\tab  \\tab {\\b1 Panitera Sidang Tiruan}"),
    par("Rincian Biaya Perkara:"),
    par("1. PNBP :"),
    BINGKAI_UNTUK,
    par("- Biaya Pendaftaran : Rp 30.000,00"),
    par("J u m l a h : Rp 199.000,00"),
  ].join("");
  return `{\\rtf1\\ansi{\\colortbl;\\red0\\green0\\blue0;${"\\red0\\green0\\blue255;".repeat(14)}\\red255\\green255\\blue255;}\\paperw12240\\margl2268\\margr1239\\pgwsxn11907\\margrsxn1239 ${badan}}`;
}

// PNG 4x2 (sah) sebagai tiruan tanda tangan.
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000004000000020806000000" + "7fa87d630000001049444154789c63f8cfc0f01f0518000038ff07f9cf5e2a4d0000000049454e44ae426082",
  "hex"
);

describe("salinanPutusanService - RTF salinan", () => {
  const asli = rtfTiruan();
  const { rtf, laporan } = salinan.susunSalinan(asli, { ttd: { jenis: "png", isi: PNG } });

  it("a. SALINAN di KIRI atas: posisi bingkai dibuang, baris (\\trql) & paragraf (\\ql) rata kiri, warnanya dihitamkan", () => {
    const i = rtf.indexOf("SALINAN}");
    const wilayah = rtf.slice(rtf.lastIndexOf("\\trowd", i), rtf.indexOf("\\row", i));
    expect(laporan.salinan).toBe("bingkai");
    expect(wilayah).not.toMatch(/\\t?posx|\\tposy|\\posy/);
    // Baris rata kiri; tidak ada kendali rata kanan/tengah pada baris maupun paragrafnya.
    expect(wilayah).toContain("\\trql");
    expect(wilayah).not.toMatch(/\\trq[rc](?![a-z])/);
    expect(wilayah).toContain("\\cf0 SALINAN");
    const paragraf = wilayah.slice(wilayah.lastIndexOf("\\pard", wilayah.indexOf("SALINAN")), wilayah.indexOf("SALINAN"));
    expect(paragraf).toMatch(/^\\pard \\plain \\ql/);
    expect(paragraf).not.toMatch(/\\q[rcj](?![a-z])/);
    // Tanpa bingkai dan tanpa SALINAN sama sekali: paragraf rata kiri disisipkan sebelum PUTUSAN.
    const tanpa = salinan.susunSalinan("{\\rtf1\\ansi{\\colortbl;}\\pard \\plain \\qc PUTUSAN\\par \\pard \\plain \\qj isi isi isi isi isi isi isi isi isi isi isi isi\\par }", { ttd: null });
    expect(tanpa.laporan.salinan).toBe("disisipkan");
    expect(tanpa.rtf).toMatch(/\\pard\\plain\\ql\{\\b\\fs24 SALINAN\\par\}\\pard/);
    // Paragraf biasa (tanpa bingkai) yang rata tengah/kanan juga menjadi rata kiri.
    const biasa = salinan.susunSalinan("{\\rtf1\\ansi{\\colortbl;}\\pard \\plain \\qr SALINAN\\par \\pard \\plain \\qc PUTUSAN\\par \\pard \\plain \\qj isi isi isi isi isi isi isi isi isi isi isi isi isi isi\\par }", { ttd: null });
    expect(biasa.laporan.salinan).toBe("paragraf");
    expect(biasa.rtf).toContain("\\pard \\plain \\ql SALINAN");
    // Masih di halaman pertama, sebelum PUTUSAN.
    expect(salinan.teksTampak(rtf).indexOf("SALINAN")).toBeLessThan(salinan.teksTampak(rtf).indexOf("PUTUSAN"));
  });

  it("b. 'ttd' di bawah tiap label pejabat (4 tempat), sejajar kolomnya; tidak dobel bila diulang", () => {
    expect(laporan.ttdDitambah).toBe(4);
    const t = salinan.teksTampak(rtf);
    expect(t).toMatch(/Ketua Majelis,\s*\t \tttd/);
    expect(t).toMatch(/\tttd \t \tttd/);
    expect(t).toMatch(/Panitera Sidang,\s*\t \tttd/);
    // "sebagai Ketua Majelis," di badan TIDAK dianggap label.
    expect(t.match(/ttd/g)).toHaveLength(4);
    const kedua = salinan.susunSalinan(rtf, { ttd: null }).laporan;
    expect(kedua.ttdDitambah).toBe(0);
    expect(kedua.ttdSudahAda).toBe(4);
  });

  it("c. gambar TTD Panitera di blok Untuk Salinan, DI ATAS namanya; blok tampak & dipindah ke akhir", () => {
    expect(laporan.namaPanitera).toBe("Nama Panitera Tiruan, S.H.");
    expect(laporan.gambarTtdPanitera).toBe(true);
    const pict = rtf.indexOf("{\\pict\\pngblip");
    expect(pict).toBeGreaterThan(rtf.indexOf("Panitera,}", rtf.indexOf("Untuk Salinan")));
    expect(pict).toBeLessThan(rtf.indexOf("Nama Panitera Tiruan"));
    expect(rtf.slice(pict, pict + 80 + PNG.length * 2)).toContain(PNG.toString("hex"));
    // 20 Okt: TTD Panitera MENGAMBANG (bentuk, bukan sebaris) 64 mm menimpa nama; perbandingan gambar 4:2 -> 3628 x 1814 twip.
    // Cap dan hak lainnya dijaga ttd-cap-sisa-20okt.test.ts.
    expect(rtf).toContain("\\shpbypara");
    expect(rtf).toContain("\\picwgoal3628\\pichgoal1814");
    const t = salinan.teksTampak(rtf);
    expect(t.indexOf("Untuk Salinan")).toBeGreaterThan(t.indexOf("J u m l a h"));
    const blok = rtf.slice(rtf.lastIndexOf("\\trowd", rtf.indexOf("Untuk Salinan")));
    expect(blok).not.toMatch(/\\cf16(?![0-9])/);
    expect(blok).not.toMatch(/\\t?posx/);
    expect(blok).toContain("\\trqr");
  });

  it("teks putih lain di badan putusan TIDAK disentuh; kurung kurawal tetap seimbang", () => {
    expect(rtf).toContain("\\cf16 Fotokopi bukti tersembunyi");
    let n = 0;
    for (let i = 0; i < rtf.length; i += 1) {
      if (rtf[i] === "\\") i += 1;
      else if (rtf[i] === "{") n += 1;
      else if (rtf[i] === "}") n -= 1;
    }
    expect(n).toBe(0);
  });

  it("tanpa TTD terdaftar: PDF tetap disusun, sebabnya dilaporkan", () => {
    const h = salinan.susunSalinan(asli, { ttd: null });
    expect(h.laporan.gambarTtdPanitera).toBe(false);
    expect(h.laporan.alasanTanpaGambar).toBe("ttd_tidak_ada");
    expect(h.rtf).not.toContain("\\pict");
    expect(salinan.teksTampak(h.rtf)).toContain("Untuk Salinan");
  });
});

describe("jalur PDF salinan: bot -> portal -> ekstensi", () => {
  const rute = baca("aleta_bot/routes/internalGatewayRoutes.js");
  const abt = baca("ekstensi-sipp/abt.js");
  const latar = baca("ekstensi-sipp/latar.js");

  it("bot memakai tanda tangan Panitera yang DISAHKAN, dicocokkan nama di blok Untuk Salinan", () => {
    const i = rute.indexOf('router.post("/abt/pdf"');
    const f = rute.slice(i, i + 2500);
    expect(f).toContain("req.body.salinan === true");
    expect(f).toContain("salinanPutusanService.namaPaniteraSalinan(teks)");
    expect(f).toContain("tandaTanganService.untukPejabat(namaPanitera)");
    expect(baca("aleta_bot/services/tandaTanganService.js")).toMatch(/async function untukPejabat[\s\S]{0,300}WHERE disahkan = 1/);
  });

  it("portal meneruskan { salinan } dan memulangkan keterangannya", () => {
    const r = baca("manajemen_surat/src/app/api/aleta-bot/abt/pdf/route.ts");
    expect(r).toContain("getGatewayAbtPdf(rtfBase64, salinanOpsi ?? { salinan })"); // 20 Okt: + ukuran TTD/cap dan cap Panitera
    expect(r).toContain("keteranganSalinan = hasil.data?.salinan ?? null");
    expect(r).toContain("salinan: keteranganSalinan");
  });

  it("ekstensi: sesudah PDF putusan (cetak tiga berkas & Kerjakan perkara ini) salinan langsung ditampilkan", () => {
    expect(abt).toMatch(/if \(hasil\.pdf === "tersimpan"\)[\s\S]{0,200}tampilkanPdfSalinan\(isiRtf/);
    expect(abt).toMatch(/siap\.dokumen\.pdf === "ok"[\s\S]{0,200}tampilkanPdfSalinan\(siap\.isiRtf/);
    expect(abt).toContain('jenis: "tampilkan-pdf"');
    expect(abt).toContain("BELUM terdaftar/disahkan");
    expect(latar).toContain('if (pesan.jenis === "tampilkan-pdf")');
    expect(latar).toContain("chrome.runtime.getURL(`salinan.html#${id}`)");
    // Nama PDF salinan = pola baku blangko + " - SALINAN".
    expect(abt).toContain("tampilkanPdfSalinan(isiRtf, namaPdfSalinan(nomor, namaBlangkoAbt)");
    expect(abt).toContain("tampilkanPdfSalinan(siap.isiRtf, namaPdfSalinan(butir.nomor, peta && peta.berkas)");
    const susun = baca("manajemen_surat/scripts/susun-ekstensi.mjs");
    expect(susun).toContain('"salinan.html"');
    expect(susun).toContain('"salinan.js"');
  });
});
