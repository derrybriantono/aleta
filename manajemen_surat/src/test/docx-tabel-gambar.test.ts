// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buatDocx, type AlineaDocx, type BlokDocx } from "@/lib/docx";

import { bacaZip, uraiXml } from "./eviden-skp-baca";

/**
 * ============================================================================
 * lib/docx.ts 2.40.0 - TABEL, GAMBAR, HALAMAN MENDATAR, KAKI HALAMAN
 * ============================================================================
 *
 * Dua hal diuji di sini:
 *
 *   1. PEMAKAI LAMA TIDAK BERUBAH. Blangko penetapan memanggil
 *      buatDocx({ alinea }) - keluarannya dipin di sini byte demi byte kecuali
 *      satu perubahan yang disengaja (urutan <w:pPr> mengikuti skema: spacing,
 *      ind, lalu jc). Tanpa tabel/gambar/kaki, tidak ada ruang nama, bagian
 *      ZIP, atau relasi baru.
 *   2. Kemampuan baru yang dipakai eviden SKP benar-benar tertulis sah: setiap
 *      XML diurai pengurai ketat yang menolak awalan ruang nama tak terikat.
 */

const LOGO = readFileSync(path.join(process.cwd(), "public", "mahkamah-agung-logo.png"));

const entri = (b: Buffer) => {
  const isi = bacaZip(b);
  return new Map([...isi].map(([k, v]) => [k, k.endsWith(".png") ? v.toString("base64") : v.toString("utf8")]));
};

describe("pemakai lama - buatDocx({ alinea }) tetap seperti sebelumnya", () => {
  const NASKAH: AlineaDocx[] = [
    { teks: "PENETAPAN", rata: "tengah", tebal: true },
    { teks: "Mengabulkan permohonan;", nomor: 1, jorok: 1, jarakSesudah: 0 },
  ];

  it("document.xml dipin: hanya ruang nama w, kertas F4 tegak, tanpa kaki", () => {
    const dok = entri(buatDocx({ alinea: NASKAH })).get("word/document.xml");
    expect(dok).toBe(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
        '<w:p><w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>' +
        '<w:r><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">PENETAPAN</w:t></w:r></w:p>' +
        '<w:p><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/><w:ind w:left="567"/><w:jc w:val="both"/></w:pPr>' +
        '<w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">1. Mengabulkan permohonan;</w:t></w:r></w:p>' +
        '<w:sectPr><w:pgSz w:w="12189" w:h="18709"/>' +
        '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1701" w:header="720" w:footer="720" w:gutter="0"/>' +
        "</w:sectPr></w:body></w:document>"
    );
  });

  it("bagian ZIP, jenis isi, dan relasinya sama dengan sebelumnya", () => {
    const isi = entri(buatDocx({ alinea: NASKAH }));
    expect([...isi.keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "word/document.xml",
      "word/_rels/document.xml.rels",
      "word/styles.xml",
    ]);
    expect(isi.get("[Content_Types].xml")).toBe(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        "</Types>"
    );
    expect(isi.get("word/_rels/document.xml.rels")).toBe(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        "</Relationships>"
    );
  });
});

describe("alinea - tambahan opsional, urutan menurut skema", () => {
  it("miring, garis bawah, warna, ukuran, spasi, jarak sebelum, garis ganda, tetap bersama", () => {
    const dok = entri(
      buatDocx({
        blok: [
          {
            teks: "Nama Ketua",
            rata: "tengah",
            tebal: true,
            miring: true,
            garisBawah: true,
            warna: "#555555",
            ukuran: 10,
            spasi: 1,
            jarakSebelum: 3,
            jarakSesudah: 0,
            garisAlinea: "ganda",
            tetapBersama: true,
          },
        ],
      })
    ).get("word/document.xml")!;
    expect(dok).toContain(
      '<w:p><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="double" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>' +
        '<w:spacing w:before="60" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/>' +
        '<w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>' +
        '<w:r><w:rPr><w:b/><w:i/><w:color w:val="555555"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:u w:val="single"/></w:rPr>' +
        '<w:t xml:space="preserve">Nama Ketua</w:t></w:r></w:p>'
    );
  });

  it("warna yang tidak sah dibuang, bukan ditulis - Word menolak berkas karenanya", () => {
    const dok = entri(buatDocx({ blok: [{ teks: "x", warna: "merah" }] })).get("word/document.xml")!;
    expect(dok).not.toContain("w:color");
  });
});

describe("tabel", () => {
  const TABEL: BlokDocx = {
    jenis: "tabel",
    lebarKolom: [2, 3, 5],
    ukuran: 8,
    baris: [
      { kepala: true, sel: [{ isi: "No", tebal: true, latar: "DCE6F0", rataTegak: "tengah" }, { isi: "Nomor" }, { isi: "Pihak" }] },
      { tidakTerpecah: true, sel: [{ isi: "1" }, { isi: "1/Pdt.G/2026/PA.Dgl" }, { isi: "Siti & Andi\nmelawan\nBudi <PT>" }] },
      { sel: [{ isi: "Gabung dua kolom", gabung: 2, rata: "tengah" }, { isi: "" }] },
    ],
  };

  it("lebar tetap dalam twip, kepala diulang, baris tak terbelah, gabung, latar", () => {
    const dok = entri(buatDocx({ blok: [TABEL] })).get("word/document.xml")!;
    expect(() => uraiXml(dok)).not.toThrow();
    expect(dok).toContain('<w:tblW w:w="5670" w:type="dxa"/>');
    expect(dok).toContain('<w:tblLayout w:type="fixed"/>');
    expect(dok).toContain('<w:tblGrid><w:gridCol w:w="1134"/><w:gridCol w:w="1701"/><w:gridCol w:w="2835"/></w:tblGrid>');
    expect(dok).toContain("<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>");
    expect(dok.match(/<w:tblHeader\/>/g)?.length).toBe(1);
    expect(dok).toContain('<w:tcW w:w="2835" w:type="dxa"/><w:gridSpan w:val="2"/>');
    expect(dok).toContain('<w:shd w:val="clear" w:color="auto" w:fill="DCE6F0"/><w:vAlign w:val="center"/>');
    expect(dok).toContain('<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>');
  });

  it("teks sel: pindah baris menjadi alinea baru, & dan < tersandikan", () => {
    const dok = entri(buatDocx({ blok: [TABEL] })).get("word/document.xml")!;
    expect(dok).toContain(">Siti &amp; Andi</w:t>");
    expect(dok).toContain(">melawan</w:t>");
    expect(dok).toContain(">Budi &lt;PT&gt;</w:t>");
  });

  it("sel kosong tetap memuat satu alinea - Word menolak sel tanpa alinea", () => {
    const dok = entri(buatDocx({ blok: [{ jenis: "tabel", lebarKolom: [2], baris: [{ sel: [{ isi: [] }] }] }] })).get("word/document.xml")!;
    expect(dok).toMatch(/<\/w:tcPr><w:p>/);
  });

  it("garis 'tanpa' menulis nil; dua tabel bersebelahan dipisah alinea supaya tidak dilebur Word", () => {
    const dok = entri(
      buatDocx({
        blok: [
          { jenis: "tabel", garis: "tanpa", lebarKolom: [3], baris: [{ sel: [{ isi: "A" }] }] },
          { jenis: "tabel", lebarKolom: [3], baris: [{ sel: [{ isi: "B" }] }] },
        ],
      })
    ).get("word/document.xml")!;
    expect(dok).toContain('<w:top w:val="nil"/>');
    expect(dok).toMatch(/<\/w:tbl><w:p>[\s\S]*?<\/w:p><w:tbl>/);
    // Badan tidak berakhir dengan tabel.
    expect(dok).toMatch(/<\/w:tbl><w:p>[\s\S]*?<\/w:p><w:sectPr>/);
  });
});

describe("gambar, kertas mendatar, kaki halaman", () => {
  const berkas = () =>
    buatDocx({
      blok: [
        { jenis: "gambar", data: LOGO, lebar: 1.6, tinggi: 2.05, keterangan: "Logo & lambang" },
        { jenis: "tabel", lebarKolom: [2, 2], garis: "tanpa", baris: [{ sel: [{ isi: [{ jenis: "gambar", data: LOGO, lebar: 1, tinggi: 1.3 }] }, { isi: "Kop" }] }] },
      ],
      kertas: "A4",
      mendatar: true,
      kaki: { teks: "Eviden & SKP", nomorHalaman: true },
    });

  it("setiap XML sah, gambar yang sama disimpan SEKALI, pengenal gambar unik", () => {
    const isi = entri(berkas());
    for (const [nama, teks] of isi) if (/\.(xml|rels)$/.test(nama)) expect(() => uraiXml(teks), nama).not.toThrow();
    expect([...isi.keys()].filter((k) => k.startsWith("word/media/"))).toEqual(["word/media/gambar1.png"]);
    expect(isi.get("word/media/gambar1.png")).toBe(LOGO.toString("base64"));
    const dok = isi.get("word/document.xml")!;
    const id = [...dok.matchAll(/<wp:docPr id="(\d+)"/g)].map((m) => m[1]);
    expect(id).toEqual(["1", "2"]);
    expect(dok).toContain('<wp:extent cx="576000" cy="738000"/>');
    expect(dok).toContain('descr="Logo &amp; lambang"');
    expect(isi.get("[Content_Types].xml")).toContain('<Default Extension="png" ContentType="image/png"/>');
    expect(isi.get("word/_rels/document.xml.rels")).toContain('Id="rIdGbr1"');
  });

  it("A4 mendatar: lebar dan tinggi ditukar, orient landscape", () => {
    const dok = entri(berkas()).get("word/document.xml")!;
    expect(dok).toContain('<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>');
  });

  it("kaki halaman: teks kiri dan Halaman PAGE dari NUMPAGES, dirujuk dari sectPr", () => {
    const isi = entri(berkas());
    const kaki = isi.get("word/footer1.xml")!;
    expect(kaki).toContain(">Eviden &amp; SKP</w:t>");
    expect(kaki).toContain('<w:instrText xml:space="preserve"> PAGE </w:instrText>');
    expect(kaki).toContain('<w:instrText xml:space="preserve"> NUMPAGES </w:instrText>');
    expect(isi.get("word/document.xml")).toContain('<w:sectPr><w:footerReference w:type="default" r:id="rIdKaki"/>');
    expect(isi.get("[Content_Types].xml")).toContain('PartName="/word/footer1.xml"');
    expect(isi.get("word/_rels/document.xml.rels")).toContain('Id="rIdKaki"');
  });

  it("bukan PNG/JPEG ditolak dengan kalimat yang jelas", () => {
    expect(() => buatDocx({ blok: [{ jenis: "gambar", data: Buffer.from("GIF89a....."), lebar: 1, tinggi: 1 }] })).toThrow(
      /PNG atau JPEG/
    );
  });

  it("dua penerbitan atas susunan yang sama menghasilkan berkas yang sama persis", () => {
    expect(berkas().equals(berkas())).toBe(true);
  });
});
