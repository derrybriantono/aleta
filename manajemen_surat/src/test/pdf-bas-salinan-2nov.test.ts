// @vitest-environment node
/**
 * ============================================================================
 * PDF BAS & PUTUSAN (2 Nov 2026) - Z terbalik, nomor halaman, Z sampai area teks, salinan BAS bertanda tangan asli, "ttd" salinan
 * putusan, dan ruang kosong "Untuk Salinan" di PDF putusan
 * ============================================================================
 *
 * Diukur dengan LibreOffice 24.2 atas blangko BAS ALUR 38 (verstek, pembuktian dan putusan) yang ada di repo (blangko berisi variabel
 * #nnnn#, tanpa data perkara):
 *   1. Z lama = grup tiga garis penghubung; diagonalnya bertanda fRelFlipH=1 yang DIABAIKAN LibreOffice -> diagonal terbalik di PDF;
 *   2. nomor halaman di kotak teks 2x2 inci rata kanan (posh=3) + fFitShapeToText -> LibreOffice tidak mengecilkan kotak: angka di
 *      +-2/3 lebar halaman dan naik ke area teks;
 *   3. Z otomatis tidak membuang grup Z lama (kotak "SC Z" di paragraf lain) -> dua Z bertumpuk; garis bawah kini sampai batas area teks.
 * Salinan & putusan memakai RTF TIRUAN berstruktur sama dengan blangko (nama rekaan).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { sesuaikanZcross } from "@/server/modules/aleta-ecourt/zcross";
import { mesinSoffice } from "@/server/modules/aleta-ecourt/zcross/mesin";
import { bacaKataPdf } from "@/server/modules/aleta-ecourt/zcross/pdf-letak";
import { bersihkanZRtf, uraiRtf } from "@/server/modules/aleta-ecourt/zcross/rtf";

import { bacaGarisPdf } from "./fixtures/zcross-garis-pdf";

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const rapi = muat("./services/rtfSofficeRapi.js") as {
  rapikanUntukSoffice: (b: Buffer) => { isi: Buffer; laporan: { cermin: number; nomorHalaman: number } };
  rapikanBentukCermin: (s: string) => { rtf: string; diubah: number };
  rapikanKotakNomorHalaman: (s: string) => { rtf: string; diubah: number };
};
const salinan = muat("./services/salinanPutusanService.js") as {
  teksTampak: (r: string) => string;
  susunSalinan: (r: string, o: { ttd: null }) => { rtf: string; laporan: Record<string, unknown> };
  tambahTtdPejabat: (r: string) => { rtf: string; ditambah: number; sudahAda: number };
  buangUntukSalinanTersembunyi: (r: string) => { rtf: string; dibuang: boolean };
  pejabatPenandatangan: (r: string) => Array<{ label: string; nama: string }>;
  jenisNaskahSalinan: (r: string) => "bas" | "putusan";
};

const ALUR38 = path.join(
  AKAR,
  "abt-paket/w2b-keluarga-lain/paket-satker/timpa/derry_briantono/6a Hak Asuh Anak (Hadhanah) - BAS/BAS ALUR 38 Hak Asuh - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek.rtf"
);
const adaAlur38 = existsSync(ALUR38);
const adaSoffice = (() => {
  try {
    execFileSync(process.env.ALETA_SOFFICE || "soffice", ["--version"], { stdio: "ignore", timeout: 20000 });
    return true;
  } catch {
    return false;
  }
})();

// ----------------------------------------------------------------------------
// Fixture kecil: grup Z (dua garis mendatar + diagonal bercermin) dan kaki halaman berkotak nomor
// ----------------------------------------------------------------------------
const sp = (n: string, v: string | number) => `{\\sp{\\sn ${n}}{\\sv ${v}}}`;
const anak = (lid: number, l: number, t: number, r: number, b: number, flipH: 0 | 1) =>
  `{\\shp{\\*\\shpinst\\shplid${lid}${sp("relLeft", l)}${sp("relTop", t)}${sp("relRight", r)}${sp("relBottom", b)}${sp("shapeType", 32)}${sp("fRelFlipH", flipH)}${sp("fRelFlipV", 0)}${sp("fLine", 1)}}{\\shprslt {\\pict }}}`;
const GRUP_Z =
  `{\\shpgrp{\\*\\shpinst\\shpleft12\\shptop285\\shpright8772\\shpbottom1980\\shpfhdr0\\shpbxcolumn\\shpbxignore\\shpbypara\\shpbyignore\\shpwr3\\shpwrk0\\shpfblwtxt0\\shpz1\\shplid1026` +
  `${sp("groupLeft", 2280)}${sp("groupTop", 4470)}${sp("groupRight", 11040)}${sp("groupBottom", 6165)}${sp("wzName", "Group 2")}` +
  anak(1027, 6225, 4470, 11010, 4470, 0) +
  anak(1028, 2280, 6165, 11025, 6165, 0) +
  anak(1029, 2280, 4470, 11040, 6165, 1) +
  `}{\\shprslt {\\pict }}}`;
const KAKI_KOTAK =
  `{\\footer \\pard \\plain \\ql {\\shp {\\*\\shpinst \\shpleft0 \\shptop0 \\shpright2880 \\shpbottom2880 \\shpfhdr0 \\shpbxmargin \\shpbxignore \\shpbypara \\shpbyignore \\shpwr3 \\shpwrk0 \\shpfblwtxt0 \\shpz1 \\shplid2049 ` +
  `${sp("shapeType", 202)}${sp("WrapText", 2)}${sp("fFitShapeToText", 1)}${sp("fLine", 0)}${sp("wzName", "Text Box 3")}${sp("posh", 3)}${sp("posrelh", 0)}` +
  `{\\shptxt \\pard \\plain \\ql {\\field{\\*\\fldinst { PAGE  \\\\* MERGEFORMAT }}{\\fldrslt {1}}}\\par }}}\\par }`;

describe("1-2. RTF dirapikan sebelum LibreOffice (bot)", () => {
  it("diagonal anggota grup bercermin -> bentuk bebas dua titik kanan-atas ke kiri-bawah; garis tak bercermin dan grup tidak disentuh", () => {
    const rtf = `{\\rtf1\\ansi \\pard \\plain Bukti-bukti tersebut sebagai berikut: ${GRUP_Z}\\par }`;
    const h = rapi.rapikanBentukCermin(rtf);
    expect(h.diubah).toBe(1);
    expect(h.rtf).not.toMatch(/fRelFlipH\}\{\\sv 1/);
    // anggota ke-3: (8760,0) -> (0,1695) dalam kotaknya sendiri
    expect(h.rtf).toContain("{\\sp{\\sn pVerticies}{\\sv 8;2;(8760,0);(0,1695)}}");
    expect(h.rtf).toContain("{\\sp{\\sn geoRight}{\\sv 8760}}");
    // dua garis lain tetap penghubung lurus; properti grup tetap
    expect((h.rtf.match(/shapeType\}\{\\sv 32\}/g) ?? []).length).toBe(2);
    expect(h.rtf).toContain("groupLeft");
    // tanpa cermin: tidak berubah sama sekali
    const polos = rtf.replace("fRelFlipH}{\\sv 1", "fRelFlipH}{\\sv 0");
    expect(rapi.rapikanBentukCermin(polos)).toEqual({ rtf: polos, diubah: 0 });
  });

  it("kotak nomor halaman (PAGE + fFitShapeToText, posh=3) di kaki: dikecilkan 2 cm x 1 baris, tepi kanan tetap, paragrafnya rata kanan", () => {
    const rtf = `{\\rtf1\\ansi ${KAKI_KOTAK}\\pard \\plain isi\\par }`;
    const h = rapi.rapikanKotakNomorHalaman(rtf);
    expect(h.diubah).toBe(1);
    expect(h.rtf).toContain("\\shpleft1746\\shptop0\\shpright2880\\shpbottom360");
    const txt = h.rtf.slice(h.rtf.indexOf("{\\shptxt"));
    expect(txt).toMatch(/^\{\\shptxt \\pard\\qr \\plain/);
    expect(txt).not.toMatch(/\\ql(?![a-z])/);
    // badan dokumen (di luar kaki) tidak disentuh
    expect(h.rtf.endsWith("\\pard \\plain isi\\par }")).toBe(true);
    // kotak tanpa fFitShapeToText atau tanpa PAGE: dibiarkan
    const tanpaPas = rtf.replace(sp("fFitShapeToText", 1), "");
    expect(rapi.rapikanKotakNomorHalaman(tanpaPas).diubah).toBe(0);
    const tanpaPage = rtf.replace("PAGE", "DATE");
    expect(rapi.rapikanKotakNomorHalaman(tanpaPage).diubah).toBe(0);
    // bukan RTF / data biner mentah -> apa adanya
    const bukan = Buffer.from("%PDF-1.4");
    expect(rapi.rapikanUntukSoffice(bukan).isi).toBe(bukan);
  });

  it.skipIf(!adaAlur38 || !adaSoffice)("BAS ALUR 38 sungguhan di LibreOffice: diagonal kanan-atas -> kiri-bawah dan nomor halaman di kanan bawah", async () => {
    const asli = readFileSync(ALUR38);
    const r = rapi.rapikanUntukSoffice(asli);
    // barisTtd (3 Nov): blangko bervariabel (#6034#, #4004#) belum berlabel pejabat - baris tanda tangannya belum dikenali
    expect(r.laporan).toEqual({ cermin: 1, nomorHalaman: 2, barisTtd: 0 });
    const pdf = await mesinSoffice().ubah(new Uint8Array(r.isi), "rtf", "pdf");
    const kata = await bacaKataPdf(pdf);
    // jangkar Z = "berikut:" terakhir SEBELUM kotak "SC Z" (ada "sebagai berikut" lain di halaman saksi)
    const iSc = kata.kata.findIndex((x) => x.t === "SC" && kata.kata[kata.kata.indexOf(x) + 1]?.t === "Z");
    expect(iSc).toBeGreaterThan(0);
    const berikut = kata.kata.slice(0, iSc).reverse().find((x) => x.norm === "berikut");
    expect(berikut).toBeTruthy();
    // Garis dari grup digambar sebagai jalur yang tidak dibaca bacaGarisPdf: arahnya diperiksa dari piksel halaman (pdftoppm, abu-abu).
    const hz = berikut!.halaman;
    const sc = kata.kata[iSc];
    expect(sc).toBeTruthy();
    const dpi = 72;
    const pgm = execFileSync("pdftoppm", ["-f", String(hz), "-l", String(hz), "-r", String(dpi), "-gray", "-"], { input: Buffer.from(pdf), maxBuffer: 64 * 1024 * 1024 });
    const kepalaPgm = /^P5\s+(\d+)\s+(\d+)\s+255\s/.exec(pgm.subarray(0, 40).toString("latin1"))!;
    const [lebarPx, mulaiData] = [Number(kepalaPgm[1]), kepalaPgm[0].length];
    const gelap = (x: number, y: number) => pgm[mulaiData + Math.round(y) * lebarPx + Math.round(x)] < 128;
    // baris seperempat jalan dari "berikut:" ke garis bawah: titik diagonal harus di separuh KANAN area teks
    const yUji = berikut!.yDasar + (sc!.yDasar - 14 - berikut!.yDasar) * 0.25;
    const xGelap: number[] = [];
    for (let x = 100; x < lebarPx - 60; x += 1) if (gelap(x, yUji)) xGelap.push(x);
    expect(xGelap.length, "diagonal tidak terlihat").toBeGreaterThan(0);
    const tengahTeks = (2268 / 20 + (kata.halaman[hz - 1].lebar - 1134 / 20)) / 2;
    expect(Math.min(...xGelap)).toBeGreaterThan(tengahTeks);
    // nomor halaman: angka tunggal di dasar halaman 1, ujung kanannya dekat batas kanan teks (margin kanan 1134 twip)
    const hal1 = kata.halaman[0];
    const nomor = kata.kata.filter((x) => x.halaman === 1 && /^\d{1,3}$/.test(x.t) && x.yDasar > hal1.tinggi - 72);
    expect(nomor.length).toBe(1);
    expect(nomor[0].x2).toBeGreaterThan(hal1.lebar - 1134 / 20 - 12);
    expect(nomor[0].yDasar).toBeGreaterThan(hal1.tinggi - 1701 / 20);
  }, 120_000);
});

describe("3. Z otomatis: grup Z lama dibuang, garis bawah sampai area teks", () => {
  it.skipIf(!adaAlur38)("grup garis Z di paragraf '...berikut:' ikut dibuang walau kotak 'SC Z' di paragraf lain; kotak tanggal dipakai ulang", () => {
    const s = readFileSync(ALUR38, "latin1");
    expect(s).toContain("{\\shpgrp");
    const b = bersihkanZRtf(s);
    expect(b.jumlahBentukDibuang).toBe(2); // grup Z + kotak "SC Z"
    expect(b.rtf).not.toContain("{\\shpgrp");
    expect(b.kotakTanggal).toMatch(/SC Z 1x/);
    // teks naskah tidak berubah
    expect(uraiRtf(b.rtf).paragraf.map((p) => p.teks)).toEqual(uraiRtf(s).paragraf.map((p) => p.teks));
  });

  it.skipIf(!adaAlur38 || !adaSoffice)("BAS ALUR 38: satu Z (tanpa sisa grup), garis bawah di batas area teks dikurangi ruang tanggal", async () => {
    const h = await sesuaikanZcross(new Uint8Array(readFileSync(ALUR38)), "rtf", { mesin: mesinSoffice(), hanyaBentuk: true });
    expect(h.laporan.diubah).toBe(true);
    const rtf = Buffer.from(h.bita).toString("latin1");
    expect(rtf).not.toContain("{\\shpgrp");
    expect((rtf.match(/zcross-garis/g) ?? []).length).toBe(1);
    expect((rtf.match(/SC Z 1x/g) ?? []).length).toBe(1);
    const pdf = await mesinSoffice().ubah(new Uint8Array(rapi.rapikanUntukSoffice(Buffer.from(h.bita)).isi), "rtf", "pdf");
    const kata = await bacaKataPdf(pdf);
    const hz = h.laporan.halamanFisikZ!;
    const tinggi = kata.halaman[hz - 1].tinggi;
    const garis = (await bacaGarisPdf(pdf)).filter((g) => g.halaman === hz && Math.abs(g.y1 - g.y2) < 0.5 && Math.abs(g.x2 - g.x1) > 200);
    const bawah = garis.sort((a, b) => b.y1 - a.y1)[0];
    // margin bawah blangko 1701 twip (3 cm): garis bawah 34 pt di atas batas area teks
    expect(bawah.y1).toBeCloseTo(tinggi - 1701 / 20 - 34, 0);
    // tanggal (#0033#) di bawah garis, masih di atas batas area teks
    const tgl = kata.kata.find((x) => x.halaman === hz && x.t.includes("#0033#"));
    expect(tgl!.yDasar).toBeGreaterThan(bawah.y1);
    expect(tgl!.yDasar).toBeLessThan(tinggi - 1701 / 20 + 1);
  }, 180_000);
});

// ----------------------------------------------------------------------------
// Salinan & putusan (RTF tiruan)
// ----------------------------------------------------------------------------
const P = "\\pard \\plain \\qj \\sl360 \\slmult1 \\tqc \\tx1400 \\tqc \\tx4200 \\tqc \\tx7000 \\fs20 ";
const par = (isi: string) => `${P}{\\fs24 \\f4 ${isi}}{\\fs24 \\f4 \\par }`;
const kosongPar = `${P}{\\fs24 \\f4 \\par }`;
const FB = "\\pard \\plain \\qc \\sa80 \\phpg \\pvpara \\posx7899 \\posy35 \\intbl \\fs20 ";
const untukSalinan = (cf: string) =>
  "\\trowd \\trql \\trgaph0 \\trrh2037 \\trleft-108 \\tpvpara \\tphpg \\tposx7899 \\tposy35 \\cellx3472 " +
  `${FB}{\\fs24 \\f4 ${cf} Untuk Salinan}{\\fs24 \\f4 ${cf} \\par }` +
  `${FB}{\\fs24 \\f4 ${cf} Pengadilan Agama Donggala }{\\fs24 \\f4 ${cf} \\par }` +
  `${FB}{\\fs24 \\f4 ${cf} Panitera,}{\\fs28 \\f5 ${cf} \\par }` +
  `${FB}{\\fs32 \\f5 ${cf} \\par }` +
  `${FB}{\\b1 \\fs24 \\f4 ${cf} Nama Panitera Tiruan, S.H.}{\\b1 \\fs24 \\f5 ${cf} \\cell }` +
  "\\pard \\plain \\qr \\intbl \\fs20 {\\trowd \\trql \\trgaph0 \\trrh2037 \\trleft-108 \\tpvpara \\tphpg \\tposx7899 \\tposy35 \\cellx3472 \\row }";
const kepala = `{\\rtf1\\ansi{\\colortbl;\\red0\\green0\\blue0;${"\\red0\\green0\\blue255;".repeat(14)}\\red255\\green255\\blue255;}\\paperw12240 `;
const putusan = (cf: string) =>
  kepala +
  [
    par("PUTUSAN"),
    ...Array.from({ length: 30 }, (_, i) => par(`Menimbang paragraf ${i + 1} yang panjang isinya.`)),
    par("\\tab  \\tab Ketua Majelis,"),
    kosongPar,
    par("\\tab  \\tab {\\b1 Ketua Tiruan, S.H.I.}"),
    par("Rincian Biaya Perkara:"),
    par("1. PNBP :"),
    untukSalinan(cf),
    par("- Biaya Pendaftaran : Rp 30.000,00"),
  ].join("") +
  "}";

describe("4. salinan BAS: penanda tangan asli, tanpa 'ttd'", () => {
  const bas =
    kepala +
    [
      par("BERITA ACARA SIDANG"),
      par("Nomor 9/Pdt.G/2026/PA.Dgl"),
      ...Array.from({ length: 30 }, (_, i) => par(`Atas pertanyaan Ketua Majelis, saksi menerangkan hal ke-${i + 1}.`)),
      par("Demikian Berita Acara Sidang ini dibuat."),
      par("\\tab Panitera Sidang,\\tab \\tab Ketua Majelis,"),
      kosongPar,
      kosongPar,
      par("\\tab {\\b1 Panitera Rekaan, S.H.}\\tab \\tab {\\b1 Hakim Rekaan, S.H.I., M.H.}"),
    ].join("") +
    "}";

  it("BAS dikenali sebagai BAS; putusan (ber-blok Untuk Salinan) sebagai putusan", () => {
    expect(salinan.jenisNaskahSalinan(bas)).toBe("bas");
    expect(salinan.jenisNaskahSalinan(putusan("\\cf16"))).toBe("putusan");
  });

  it("nama penanda tangan dipasangkan per kolom (label -> nama di bawahnya)", () => {
    expect(salinan.pejabatPenandatangan(bas)).toEqual([
      { label: "Panitera Sidang", nama: "Panitera Rekaan, S.H." },
      { label: "Ketua Majelis", nama: "Hakim Rekaan, S.H.I., M.H." },
    ]);
    // "Ketua Majelis," di tengah kalimat bukan label
    expect(salinan.pejabatPenandatangan(bas).length).toBe(2);
  });

  it("baris tanda tangan dalam sel tabel juga terbaca", () => {
    const sel = (t: string) => `\\pard \\plain \\intbl {\\fs24 ${t}}\\cell `;
    const tabel =
      kepala +
      Array.from({ length: 20 }, (_, i) => par(`isi ${i}`)).join("") +
      `\\trowd \\cellx4000\\cellx8000 ${sel("Panitera Sidang,")}${sel("Ketua Majelis,")}\\row ` +
      `\\trowd \\cellx4000\\cellx8000 ${sel("")}${sel("")}\\row ` +
      `\\trowd \\cellx4000\\cellx8000 ${sel("Nama Satu, S.H.")}${sel("Nama Dua, S.Ag.")}\\row }`;
    expect(salinan.pejabatPenandatangan(tabel).map((p) => p.nama)).toEqual(["Nama Satu, S.H.", "Nama Dua, S.Ag."]);
  });
});

describe("5. salinan putusan: 'ttd' tetap tertulis pada susunan blangko yang berbeda", () => {
  it("tanpa paragraf kosong di antara label dan nama: baris 'ttd' disisipkan sesudah label", () => {
    const rtf = kepala + [...Array.from({ length: 30 }, (_, i) => par(`isi ${i}`)), par("\\tab  \\tab Ketua Majelis,"), par("\\tab  \\tab {\\b1 Ketua Tiruan}")].join("") + "}";
    const h = salinan.tambahTtdPejabat(rtf);
    expect(h.ditambah).toBe(1);
    expect(salinan.teksTampak(h.rtf)).toMatch(/Ketua Majelis,\s*\t \tttd\s*\t \tKetua Tiruan/);
    expect(salinan.tambahTtdPejabat(h.rtf)).toMatchObject({ ditambah: 0, sudahAda: 1 });
  });

  it("label dan nama dalam satu paragraf dipisah pindah baris: 'ttd' di baris kosong pertama", () => {
    const rtf = kepala + [...Array.from({ length: 30 }, (_, i) => par(`isi ${i}`)), par("Hakim Anggota,\\line \\line \\line {\\b1 Anggota Tiruan}")].join("") + "}";
    const h = salinan.tambahTtdPejabat(rtf);
    expect(h.ditambah).toBe(1);
    expect(salinan.teksTampak(h.rtf)).toMatch(/Hakim Anggota,\n ?ttd\n\nAnggota Tiruan/);
    expect(salinan.tambahTtdPejabat(h.rtf)).toMatchObject({ ditambah: 0, sudahAda: 1 });
  });
});

describe("6. PDF putusan biasa: blok 'Untuk Salinan' tersembunyi dibuang", () => {
  it("blok putih dalam bingkai dibuang -> tidak ada ruang kosong di antara '1. PNBP :' dan rincian", () => {
    const asli = putusan("\\cf16");
    const h = salinan.buangUntukSalinanTersembunyi(asli);
    expect(h.dibuang).toBe(true);
    const t = salinan.teksTampak(h.rtf);
    expect(t).not.toContain("Untuk Salinan");
    expect(t).not.toContain("Nama Panitera Tiruan");
    expect(t).toMatch(/1\. PNBP :\s*- Biaya Pendaftaran/);
    // kurung tetap seimbang
    let d = 0;
    for (let i = 0; i < h.rtf.length; i += 1) {
      if (h.rtf[i] === "\\") i += 1;
      else if (h.rtf[i] === "{") d += 1;
      else if (h.rtf[i] === "}") d -= 1;
    }
    expect(d).toBe(0);
    // salinan tetap menampakkan blok itu dari naskah ASLI
    expect(salinan.teksTampak(salinan.susunSalinan(asli, { ttd: null }).rtf)).toContain("Untuk Salinan");
  });

  it("blok yang TAMPAK (tidak putih) tidak dibuang", () => {
    expect(salinan.buangUntukSalinanTersembunyi(putusan("\\cf1")).dibuang).toBe(false);
    expect(salinan.buangUntukSalinanTersembunyi(putusan("")).dibuang).toBe(false);
  });
});
