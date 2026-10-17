// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import zlib from "node:zlib";

import { describe, expect, it } from "vitest";

import { isianMemuatAleta, menyebutAleta as menyebutPortal, pesanTandaAletaSipp, peringatanTandaAleta } from "@/lib/tanda-aleta";
import { periksaKueriVariabel, periksaTemplat } from "@/lib/pengaturan-abt";
import { saranIdentitas, susunRencana, type KeadaanSatkerBot } from "@/server/modules/pengaturan-abt/identitas-satker";

/**
 * ============================================================================
 * PENJAGA BATAS: TIDAK ADA KATA "ALETA" DI SERVER / DATABASE SIPP (17 Okt 2026)
 * ============================================================================
 *
 * Keputusan pengguna: "Jangan ada satupun kalimat atau kata Aleta di server
 * SIPP atau database SIPP. Kalau disimpan proses dan riwayat di aplikasi ALETA
 * boleh ada identifikasi ALETA."
 *
 * Uji ini membuktikan PERILAKU, bukan sekadar teks kode:
 *   A. penjaga bersama (aleta_bot/services/penjagaTandaSipp.js) menahan teks
 *      ketikan manusia dengan kalimat yang menunjuk kolomnya, membersihkan teks
 *      buatan sistem, tidak menghitung data SIPP sendiri, dan memeriksa ISI
 *      berkas (RTF/DOCX/PDF) tanpa mengubah naskahnya;
 *   B. setiap jalur tulis memanggil penjaga - dijalankan sungguhan dengan basis
 *      data tiruan: tidak satu kueri pun lolos sebelum penjaga bicara;
 *   C. portal: peringatan bahwa isian yang memuat kata itu tidak akan bisa
 *      dikirim ke SIPP/ABT (penyimpanan di ALETA tetap boleh);
 *   D. DAFTAR: berkas bot yang menulis ke SIPP tanpa tercantum di
 *      JALUR_TULIS_SIPP / JALUR_DIKECUALIKAN memerahkan uji ini.
 */
const AKAR = path.resolve(process.cwd(), "..");
const req = createRequire(import.meta.url);
const botReq = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Apa = any;
const g: Apa = req(path.join(AKAR, "aleta_bot/services/penjagaTandaSipp.js"));
const tandaBot: Apa = req(path.join(AKAR, "aleta_bot/services/tandaAletaService.js"));

const tidakBolehDipanggil = () => {
  throw new Error("kueri/penulis tidak boleh dipanggil");
};

// ─── pembantu berkas ─────────────────────────────────────────────────────────

const TABEL_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Buffer) {
  let c = 0xffffffff;
  for (const x of b) c = TABEL_CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** ZIP minimal (deflate), disusun terpisah dari penulis ZIP penjaga supaya keduanya saling menguji. */
function buatZip(entri: Record<string, string>): Buffer {
  const bagian: Buffer[] = [];
  const pusat: Buffer[] = [];
  let posisi = 0;
  for (const [nama, isi] of Object.entries(entri)) {
    const mentah = Buffer.from(isi, "utf8");
    const data = zlib.deflateRawSync(mentah);
    const namaB = Buffer.from(nama, "utf8");
    const kepala = Buffer.alloc(30);
    kepala.writeUInt32LE(0x04034b50, 0);
    kepala.writeUInt16LE(20, 4);
    kepala.writeUInt16LE(0, 6);
    kepala.writeUInt16LE(8, 8);
    kepala.writeUInt32LE(crc32(mentah), 14);
    kepala.writeUInt32LE(data.length, 18);
    kepala.writeUInt32LE(mentah.length, 22);
    kepala.writeUInt16LE(namaB.length, 26);
    bagian.push(kepala, namaB, data);
    const rekam = Buffer.alloc(46);
    rekam.writeUInt32LE(0x02014b50, 0);
    rekam.writeUInt16LE(20, 4);
    rekam.writeUInt16LE(20, 6);
    rekam.writeUInt16LE(8, 10);
    rekam.writeUInt32LE(crc32(mentah), 16);
    rekam.writeUInt32LE(data.length, 20);
    rekam.writeUInt32LE(mentah.length, 24);
    rekam.writeUInt16LE(namaB.length, 28);
    rekam.writeUInt32LE(posisi, 42);
    pusat.push(rekam, namaB);
    posisi += 30 + namaB.length + data.length;
  }
  const pusatB = Buffer.concat(pusat);
  const akhir = Buffer.alloc(22);
  akhir.writeUInt32LE(0x06054b50, 0);
  akhir.writeUInt16LE(Object.keys(entri).length, 8);
  akhir.writeUInt16LE(Object.keys(entri).length, 10);
  akhir.writeUInt32LE(pusatB.length, 12);
  akhir.writeUInt32LE(posisi, 16);
  return Buffer.concat([...bagian, pusatB, akhir]);
}

/** Baca ZIP apa adanya (pembaca terpisah dari penjaga): { nama: isiTeks }. */
function bacaZip(isi: Buffer): Record<string, string> {
  let akhir = -1;
  for (let i = isi.length - 22; i >= 0; i -= 1) {
    if (isi.readUInt32LE(i) === 0x06054b50) {
      akhir = i;
      break;
    }
  }
  const n = isi.readUInt16LE(akhir + 10);
  let p = isi.readUInt32LE(akhir + 16);
  const hasil: Record<string, string> = {};
  for (let k = 0; k < n; k += 1) {
    const metode = isi.readUInt16LE(p + 10);
    const crc = isi.readUInt32LE(p + 16);
    const cs = isi.readUInt32LE(p + 20);
    const lNama = isi.readUInt16LE(p + 28);
    const lEks = isi.readUInt16LE(p + 30);
    const lKom = isi.readUInt16LE(p + 32);
    const off = isi.readUInt32LE(p + 42);
    const nama = isi.subarray(p + 46, p + 46 + lNama).toString("utf8");
    const mulai = off + 30 + isi.readUInt16LE(off + 26) + isi.readUInt16LE(off + 28);
    const data = isi.subarray(mulai, mulai + cs);
    const mentah = metode === 8 ? zlib.inflateRawSync(data) : Buffer.from(data);
    expect(crc32(mentah), `CRC ${nama}`).toBe(crc);
    hasil[nama] = mentah.toString("utf8");
    p += 46 + lNama + lEks + lKom;
  }
  return hasil;
}

const BADAN_DOCX = (isi: string) => `<w:document><w:body><w:p><w:r><w:t>${isi}</w:t></w:r></w:p></w:body></w:document>`;
const CORE_ALETA = "<cp:coreProperties><dc:creator>ALETA</dc:creator><cp:lastModifiedBy>Aleta Bot</cp:lastModifiedBy><dc:title>Putusan</dc:title></cp:coreProperties>";

function pdfPolos(opsi: { info?: string; isi?: string; ttd?: boolean }): Buffer {
  const bagian = ["%PDF-1.4", `1 0 obj<<${opsi.info ?? ""}>>endobj`];
  if (opsi.isi !== undefined) bagian.push(`2 0 obj<</Length 50>>stream\nBT /F1 12 Tf (${opsi.isi}) Tj ET\nendstream endobj`);
  if (opsi.ttd) bagian.push("3 0 obj<</Type/Sig/ByteRange [0 10 20 30]>>endobj");
  bagian.push("xref\n%%EOF");
  return Buffer.from(bagian.join("\n"), "latin1");
}

/** PDF ber-glyph heksadesimal (cara LibreOffice) + ToUnicode, aliran dimampatkan. */
function pdfGlyph(kata: string): Buffer {
  const huruf = [...new Set(kata)];
  const kode = (c: string) => String(huruf.indexOf(c) + 1).padStart(4, "0");
  const cmap = `/CIDInit begincmap 1 begincodespacerange <0000> <FFFF> endcodespacerange ${huruf.length} beginbfchar ${huruf
    .map((c) => `<${kode(c)}> <${c.charCodeAt(0).toString(16).padStart(4, "0")}>`)
    .join(" ")} endbfchar endcmap`;
  const isi = `BT /F1 12 Tf <${[...kata].map(kode).join("")}> Tj ET`;
  return Buffer.concat([
    Buffer.from("%PDF-1.4\n1 0 obj<</Producer(LibreOffice 7.4)>>endobj\n4 0 obj<<>>stream\n", "latin1"),
    zlib.deflateSync(Buffer.from(cmap, "latin1")),
    Buffer.from("\nendstream endobj\n5 0 obj<<>>stream\n", "latin1"),
    zlib.deflateSync(Buffer.from(isi, "latin1")),
    Buffer.from("\nendstream endobj\nxref\n%%EOF", "latin1"),
  ]);
}

const rtf = (badan: string, info = "") => Buffer.from(`{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}${info}\\pard ${badan}\\par}`, "latin1");

// ============================================================================
// A. PENJAGA BERSAMA
// ============================================================================

describe("A1 - teks ketikan manusia ditahan dengan kalimat yang menunjuk kolomnya", () => {
  it("kalimatnya awam dan menyebut isiannya", () => {
    const h = g.periksaIsian({ "Alasan ditunda": "menunggu bukti", "Agenda sidang": "Pembuktian lewat Aleta" });
    expect(h).toMatchObject({ ok: false, alasan: "teks_menyebut_aleta", kolom: "Agenda sidang" });
    expect(h.pesan).toBe(`Isian "Agenda sidang" memuat kata 'ALETA'; hapus dulu sebelum disimpan ke SIPP.`);
    expect(g.periksaIsian({ "Alasan ditunda": "menunggu bukti" })).toEqual({ ok: true });
  });

  it("aturan pengenal kata sama di bot, portal, dan penjaga (bentuk renggang, lebar, beraksen, tak tampak)", () => {
    const contoh = ["ALETA", "aleta", "viaALETA", "A L E T A", "A.L.E.T.A", "a-l-e-t-a", "ＡＬＥＴＡ", "Alétà", "Al\u200Beta"];
    for (const t of contoh) {
      expect(g.menyebutAleta(t), t).toBe(true);
      expect(tandaBot.menyebutAleta(t), t).toBe(true);
      expect(menyebutPortal(t), t).toBe(true);
    }
    for (const t of ["kepala letak", "Alat tulis", "", "pelatuk"]) expect(g.menyebutAleta(t), t).toBe(false);
  });

  it("portal dan bot memakai kalimat yang sama", () => {
    expect(pesanTandaAletaSipp("Agenda sidang")).toBe(g.pesanIsian("Agenda sidang"));
  });
});

describe("A2 - teks yang berasal dari data SIPP tidak dihitung (dan bagaimana dibedakan)", () => {
  it("nama pihak 'Aleta' dari SIPP lolos; kemunculan di luarnya tetap ditahan", () => {
    const dariSipp = ["Aleta Sari binti Hasan"];
    expect(g.periksaIsian({ "Amar putusan": "Menghukum Tergugat Aleta Sari binti Hasan membayar nafkah" }, { dariSipp })).toEqual({ ok: true });
    const h = g.periksaIsian({ "Amar putusan": "Menghukum Aleta Sari binti Hasan, lewat ALETA" }, { dariSipp });
    expect(h.ok).toBe(false);
    expect(h.kolom).toBe("Amar putusan");
  });

  it("teks SIPP yang hanya DIRAPIKAN: boleh selama kemunculannya tidak bertambah", () => {
    expect(g.periksaIsian({ Posita: "Penggugat Aleta bekerja.\n2. Bahwa" }, { teksAsal: "Penggugat Aleta bekerja.2. Bahwa" })).toEqual({ ok: true });
    expect(g.periksaIsian({ Posita: "Penggugat Aleta dan ALETA" }, { teksAsal: "Penggugat Aleta" }).ok).toBe(false);
  });

  it("dataSippMemuatAleta membaca nama pihak dari kelima tabel pihak, hanya yang memuat kata itu", async () => {
    const sql: string[] = [];
    const nama = await g.dataSippMemuatAleta(10, async (s: string, p: unknown[]) => {
      sql.push(s);
      expect(p).toEqual([10, 10, 10, 10, 10]);
      return [{ nama: "ALETA SARI" }];
    });
    expect(nama).toEqual(["ALETA SARI"]);
    for (let n = 1; n <= 5; n += 1) expect(sql[0]).toContain(`perkara_pihak${n}`);
    expect(sql[0]).toContain("LIKE '%aleta%'");
    expect(await g.dataSippMemuatAleta(10, async () => Promise.reject(new Error("putus")))).toEqual([]);
  });
});

describe("A3 - teks buatan sistem dibersihkan otomatis", () => {
  it("keterangan, nama berkas, dan user-agent", () => {
    expect(g.bersihkanTeksSistem("dibuat oleh ALETA bot (via A.L.E.T.A)")).toBe("dibuat oleh bot (via)");
    expect(g.bersihkanTeksSistem("tanpa tanda")).toBe("tanpa tanda");
    expect(g.namaBerkasBersih("Putusan_ALETA_2026.pdf")).toBe("Putusan_2026.pdf");
    expect(g.namaBerkasBersih("aleta.rtf")).toBe("berkas.rtf");
    expect(g.namaBerkasBersih("PA.Dgl_2026_Pdt.G_497_bas_2_1.rtf")).toBe("PA.Dgl_2026_Pdt.G_497_bas_2_1.rtf");
    expect(g.agenKlienBersih("ALETA-Bot/1.0 (Windows NT 10.0)")).not.toMatch(/aleta/i);
  });

  it("nama berkas e-Doc yang dibuat layanan tidak memuat kata itu", () => {
    const pu = bot("services/putusanUnggahService.js");
    expect(pu.namaBerkas("497/Pdt.G/2026/PA.Dgl", "putusan")).not.toMatch(/aleta/i);
    const bas = bot("services/basUnggahService.js");
    expect(bas.namaBerkasBas("497/Pdt.G/2026/PA.Dgl", 2, 1792096162, "rtf")).not.toMatch(/aleta/i);
  });
});

describe("A4 - rencana tulis SQL: nilai, perintah, dan catatan audit diperiksa; kolomnya disebut", () => {
  const rencana = (params: unknown[], sql = "INSERT INTO perkara_putusan (perkara_id, amar_putusan, catatan_putusan) VALUES (?,?,?)", tabel = "perkara_putusan") => ({
    ok: true,
    atasNama: { username: "hk1", namaLengkap: "Hakim Satu" },
    perkara: { perkaraId: 1, nomorPerkara: "1/Pdt.G/2026/PA.Dgl" },
    langkah: [{ tabel, aksi: "INSERT", sql, params, keterangan: "ALETA boleh di sini - keterangan langkah hanya untuk jejak ALETA" }],
  });

  it("kolom ditunjuk dari perintah SQL-nya", () => {
    const h = g.periksaRencana(rencana([1, "amar", "catatan dari aleta"]));
    expect(h).toMatchObject({ ok: false, alasan: "teks_menyebut_aleta", kolom: "Catatan putusan", tabel: "perkara_putusan" });
    expect(g.kolomUntukParam("UPDATE perkara SET tanggal_surat = ?, nomor_surat = ?, diperbaharui_oleh = ? WHERE perkara_id = ?", 1)).toBe("nomor_surat");
    expect(g.periksaRencana(rencana([1, "amar", "catatan"]))).toEqual({ ok: true });
  });

  it("keterangan langkah (jejak ALETA) TIDAK diperiksa; akun & nomor perkara dari SIPP tidak dihitung", () => {
    const r = rencana([1, "amar", "catatan"]);
    expect(g.periksaRencana(r)).toEqual({ ok: true });
    const akun = { ...r, atasNama: { username: "aleta.hakim", namaLengkap: "Aleta Hakim" }, langkah: [{ ...r.langkah[0], params: [1, "amar", "aleta.hakim"] }] };
    expect(g.periksaRencana(akun)).toEqual({ ok: true });
  });

  it("deskripsi audit (tabel HTML): kolom di dalamnya ditunjuk", () => {
    const html = '<br><table><tr><th>Nama Kolom</th><th>Nilai</th></tr><tr><td>keterangan</td><td>lewat Aleta</td></tr></table>';
    const h = g.periksaRencana(rencana(["x", html], "INSERT INTO sys_audittrail (title, description) VALUES (?,?)", "sys_audittrail"));
    expect(h).toMatchObject({ ok: false, kolom: "Keterangan", tabel: "sys_audittrail" });
  });

  it("bentuk 'kelompok' (Kasir) dan data SIPP pada rencana ikut dipahami", () => {
    const kasir = { ok: true, langkah: [{ ke: 0, nilai: {}, kelompok: [{ tabel: "perkara_biaya", sql: "INSERT INTO perkara_biaya (uraian, keterangan) VALUES (?,?)", params: ["Biaya Aleta", ""] }] }] };
    expect(g.periksaRencana(kasir)).toMatchObject({ ok: false, kolom: "Uraian" });
    expect(g.periksaRencana({ ...kasir, dataSipp: ["Biaya Aleta"] })).toEqual({ ok: true });
  });
});

describe("A5 - berkas: metadata dibersihkan (sistem), isi diperiksa (manusia), naskah tidak diubah", () => {
  it("RTF: properti {\\author ALETA} dibuang; isi naskah tetap", () => {
    const berkas = rtf("Putusan perkara ini", "{\\info{\\title Putusan}{\\author ALETA}{\\*\\company Aleta Bot}}");
    const h = g.siapkanBerkasSipp(berkas, { nama: "Putusan akhir" });
    expect(h.ok).toBe(true);
    expect(h.dibersihkan).toBe(true);
    expect(h.isi.toString("latin1")).not.toMatch(/aleta/i);
    expect(h.isi.toString("latin1")).toContain("Putusan perkara ini");
  });

  it("RTF: kata itu di ISI naskah menahan unggahan - berkas tidak diubah, pesannya menunjuk berkasnya", () => {
    const berkas = rtf("Tergugat didampingi AL{\\b ETA} hadir");
    const h = g.siapkanBerkasSipp(berkas, { nama: "Putusan akhir" });
    expect(h).toMatchObject({ ok: false, alasan: "isi_berkas_menyebut_aleta", bagian: "isi dokumen" });
    expect(h.pesan).toBe(`Berkas "Putusan akhir" memuat kata 'ALETA' di dalam isinya (isi dokumen); hapus dulu sebelum diunggah ke SIPP.`);
  });

  it("RTF: huruf berkode \\'41 dan \\u65 dibaca sebagai huruf; tujuan teknis (fonttbl/info) tidak menahan", () => {
    expect(g.periksaIsiBerkas(rtf("\\'41LETA hadir"), { nama: "x" }).ok).toBe(false);
    expect(g.periksaIsiBerkas(rtf("\\u65?LETA hadir"), { nama: "x" }).ok).toBe(false);
    expect(g.periksaIsiBerkas(Buffer.from("{\\rtf1{\\fonttbl{\\f0 Aleta;}}\\pard Hadir\\par}", "latin1"), { nama: "x" })).toEqual({ ok: true });
  });

  it("RTF: nama pihak 'Aleta' dari SIPP tidak menahan", () => {
    expect(g.periksaIsiBerkas(rtf("Penggugat ALETA SARI binti Hasan"), { nama: "x", dariSipp: ["ALETA SARI binti Hasan"] })).toEqual({ ok: true });
    expect(g.periksaIsiBerkas(rtf("Penggugat ALETA SARI binti Hasan dan ALETA"), { nama: "x", dariSipp: ["ALETA SARI binti Hasan"] }).ok).toBe(false);
  });

  it("DOCX: docProps dibersihkan, isi naskah byte-per-byte sama, arsip tetap sah (CRC)", () => {
    const body = BADAN_DOCX("Menyatakan perkara dikabulkan");
    const docx = buatZip({ "[Content_Types].xml": "<Types/>", "word/document.xml": body, "docProps/core.xml": CORE_ALETA });
    const h = g.siapkanBerkasSipp(docx, { nama: "Putusan" });
    expect(h).toMatchObject({ ok: true, dibersihkan: true });
    const isi = bacaZip(h.isi);
    expect(isi["word/document.xml"]).toBe(body);
    expect(isi["docProps/core.xml"]).not.toMatch(/aleta/i);
    expect(isi["docProps/core.xml"]).toContain("<dc:title>Putusan</dc:title>");
    expect(isi["[Content_Types].xml"]).toBe("<Types/>");
  });

  it("DOCX: kata itu di isi (juga terpecah antar-run) menahan unggahan", () => {
    const docx = buatZip({ "word/document.xml": BADAN_DOCX("Penggugat AL</w:t></w:r><w:r><w:t>ETA hadir"), "docProps/core.xml": "<c/>" });
    expect(g.siapkanBerkasSipp(docx, { nama: "BAS sidang ke-2" })).toMatchObject({ ok: false, alasan: "isi_berkas_menyebut_aleta", bagian: "isi dokumen" });
    const kaki = buatZip({ "word/document.xml": BADAN_DOCX("bersih"), "word/footer1.xml": "<w:ftr><w:p><w:r><w:t>dicetak oleh Aleta</w:t></w:r></w:p></w:ftr>" });
    expect(g.siapkanBerkasSipp(kaki, { nama: "BAS" })).toMatchObject({ ok: false, bagian: "kepala/kaki halaman" });
  });

  it("PDF: Producer/Author dibersihkan dengan panjang SAMA; teks tak tersentuh", () => {
    const pdf = pdfPolos({ info: "/Producer(LibreOffice 7.4)/Author(ALETA)", isi: "Menyatakan perkara dikabulkan" });
    const h = g.siapkanBerkasSipp(pdf, { nama: "Putusan" });
    expect(h).toMatchObject({ ok: true, dibersihkan: true });
    expect(h.isi.length).toBe(pdf.length);
    expect(h.isi.toString("latin1")).toContain("(Menyatakan perkara dikabulkan) Tj");
    expect(h.isi.toString("latin1")).not.toMatch(/aleta/i);
  });

  it("PDF: teks tampak yang memuat kata itu menahan - juga teks ber-glyph heksadesimal dengan ToUnicode", () => {
    expect(g.siapkanBerkasSipp(pdfPolos({ isi: "Penggugat ALETA hadir" }), { nama: "Putusan" })).toMatchObject({ ok: false, alasan: "isi_berkas_menyebut_aleta" });
    expect(g.siapkanBerkasSipp(pdfGlyph("ALETA"), { nama: "Putusan" })).toMatchObject({ ok: false, alasan: "isi_berkas_menyebut_aleta" });
    expect(g.siapkanBerkasSipp(pdfGlyph("PUTUSAN"), { nama: "Putusan" }).ok).toBe(true);
  });

  it("PDF bertanda tangan elektronik: metadata ber-ALETA TIDAK diubah diam-diam (tanda tangan batal) - ditahan", () => {
    const h = g.siapkanBerkasSipp(pdfPolos({ info: "/Producer(ALETA)", ttd: true }), { nama: "Penetapan PMH" });
    expect(h).toMatchObject({ ok: false, alasan: "isi_berkas_menyebut_aleta" });
    expect(h.pesan).toMatch(/bertanda tangan elektronik/);
    // tanpa kata itu: lolos tanpa perubahan
    const bersih = pdfPolos({ info: "/Producer(LibreOffice)", ttd: true });
    expect(g.siapkanBerkasSipp(bersih, { nama: "x" }).isi).toBe(bersih);
  });

  it("DOC biner lama: kata itu di bagian mana pun (ASCII/UTF-16) menahan", () => {
    const kepala = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(g.siapkanBerkasSipp(Buffer.concat([kepala, Buffer.from("Penggugat Aleta", "latin1")]), { nama: "x" }).ok).toBe(false);
    expect(g.siapkanBerkasSipp(Buffer.concat([kepala, Buffer.from("Aleta", "utf16le")]), { nama: "x" }).ok).toBe(false);
    expect(g.siapkanBerkasSipp(Buffer.concat([kepala, Buffer.from("Penggugat hadir", "latin1")]), { nama: "x" }).ok).toBe(true);
  });
});

describe("A6 - Pengaturan SIPP & ABT (identitas satker, tanya jawab) di sisi bot", () => {
  it("jawaban templat yang memuat kata itu ditahan di rute; isian lama yang tak berubah tidak", () => {
    expect(
      g.periksaPengaturanAbt("/templat/simpan", { kode: "A1", lama: [{ tanya: "Nama?", jawab: "-" }], baru: [{ tanya: "Nama?", jawab: "diisi lewat ALETA" }] })
    ).toMatchObject({ ok: false, kolom: "Tanya jawab A1 - jawaban 1" });
    const lama = [{ tanya: "Sistem Aleta?", jawab: "-" }];
    expect(g.periksaPengaturanAbt("/templat/simpan", { kode: "A1", lama, baru: lama })).toEqual({ ok: true });
  });

  it("identitas satker (kueri 9271-9274) dan variabel", () => {
    expect(g.periksaPengaturanAbt("/satker/simpan", { noVar: "9271", lama: { sql_query: "select 'a'" }, baru: { sql_query: "select 'Jl. Aleta'" } })).toMatchObject({
      ok: false,
      kolom: "Identitas satker (variabel #9271#) - Isian blangko",
    });
    expect(g.periksaPengaturanAbt("/variabel/simpan", { noVar: "0046", lama: { default_data: "" }, baru: { default_data: "Penggugat Aleta" } }).ok).toBe(false);
    expect(g.periksaPengaturanAbt("/menu/simpan", { ubah: [{ id: 3, lama: { nama: "x" }, baru: { nama_alias: "Folder" } }], config: [] })).toEqual({ ok: true });
  });

  it("rute bot menolak sebelum layanan menyentuh basis data (400, kode & kalimat)", () => {
    const rute: Apa = req(path.join(AKAR, "aleta_bot/routes/abtPengaturanRoutes.js"));
    let status = 0;
    let isi: Apa = null;
    let lanjut = 0;
    const res = {
      status(c: number) {
        status = c;
        return this;
      },
      json(j: unknown) {
        isi = j;
      },
    };
    rute.pagarTanda({ method: "POST", path: "/satker/simpan", body: { noVar: "9272", lama: { sql_query: "x" }, baru: { sql_query: "082 ALETA" } } }, res, () => (lanjut += 1));
    expect(lanjut).toBe(0);
    expect(status).toBe(400);
    expect(isi).toMatchObject({ ok: false, kode: "teks_menyebut_aleta", message: expect.stringContaining("hapus dulu sebelum disimpan ke SIPP") });
    rute.pagarTanda({ method: "POST", path: "/satker/simpan", body: { noVar: "9272", lama: { sql_query: "x" }, baru: { sql_query: "082271115021" } } }, res, () => (lanjut += 1));
    expect(lanjut).toBe(1);
    rute.pagarTanda({ method: "GET", path: "/satker", body: {} }, res, () => (lanjut += 1));
    expect(lanjut).toBe(2);
  });
});

describe("A7 - jaring terakhir di kolam SIPP (log, bukan penolakan)", () => {
  it("tulisanBocor: tulisan yang memuat kata itu terdeteksi; baca dan tulisan bersih tidak", () => {
    expect(g.tulisanBocor("UPDATE perkara SET posita = ? WHERE perkara_id = ?", ["lewat ALETA", 1])).toBe(true);
    expect(g.tulisanBocor("SELECT * FROM perkara WHERE nama LIKE ?", ["%aleta%"])).toBe(false);
    expect(g.tulisanBocor("INSERT INTO perkara_proses (keterangan) VALUES (?)", ["biasa"])).toBe(false);
    expect(baca("aleta_bot/db_config.js")).toContain("penjagaTandaSipp.tulisanBocor(sql");
  });
});

// ============================================================================
// B. SETIAP JALUR TULIS MEMANGGIL PENJAGA - DIJALANKAN SUNGGUHAN
// ============================================================================

function bot(berkas: string): Apa {
  return req(path.join(AKAR, "aleta_bot", berkas));
}

/** Muat layanan bot dengan basis data tiruan (pola jam-sipp-semua-penulis). */
function muatDenganDb(berkasLayanan: string[], jawab: (sql: string, p: unknown[]) => unknown) {
  const pasang = (berkas: string, exports: unknown) => {
    const jalur = botReq.resolve(path.join(AKAR, "aleta_bot", berkas));
    botReq.cache[jalur] = { id: jalur, filename: jalur, loaded: true, exports } as unknown as NodeJS.Module;
  };
  const dipanggil: string[] = [];
  pasang("db_config.js", {
    query: (sql: string, p: unknown, cb: (g: unknown, h: unknown) => void) => {
      dipanggil.push(String(sql));
      cb(null, jawab(String(sql), Array.isArray(p) ? p : []));
    },
  });
  const jalurSkema = botReq.resolve(path.join(AKAR, "aleta_bot/services/sippSkemaService.js"));
  delete botReq.cache[jalurSkema];
  const skema = botReq(jalurSkema) as Record<string, unknown>;
  pasang("services/sippSkemaService.js", { ...skema, tabelAda: async () => true, kolomAda: async () => true });
  const hasil: Record<string, Apa> = {};
  for (const b of berkasLayanan) {
    const jalur = botReq.resolve(path.join(AKAR, "aleta_bot", b));
    delete botReq.cache[jalur];
  }
  for (const b of berkasLayanan) hasil[b] = botReq(botReq.resolve(path.join(AKAR, "aleta_bot", b)));
  return { layanan: hasil, dipanggil };
}

describe("B1 - penjalan rencana bersama (penetapan, tunda/putus sidang, putusan, penetapan kembali)", () => {
  const pt = bot("services/penetapanTulisService.js");
  const rencana = (nilai: string) => ({
    ok: true,
    atasNama: { username: "pp1", namaLengkap: "PP Satu" },
    perkara: { perkaraId: 1, nomorPerkara: "1/Pdt.G/2026/PA.Dgl" },
    langkah: [
      { tabel: "perkara_penetapan", aksi: "UPDATE", sql: "UPDATE perkara_penetapan SET penetapan_majelis_hakim = ? WHERE perkara_id = ?", params: [nilai, 1], keterangan: "x" },
    ],
  });

  it("DITAHAN sebelum kueri pertama - juga pada uji kering", async () => {
    const kueri: string[] = [];
    const h = await pt.jalankanRencana(rencana("Majelis diisi lewat A L E T A"), { kering: false, kueri: async (s: string) => kueri.push(s) });
    expect(h).toMatchObject({ ok: false, alasan: "teks_menyebut_aleta", kolom: "Penetapan majelis hakim", kering: false, selesai: [] });
    expect(kueri).toEqual([]);
    expect(await pt.jalankanRencana(rencana("lewat Aleta"), { kering: true })).toMatchObject({ ok: false, alasan: "teks_menyebut_aleta", kering: true });
  });

  it("rencana bersih tetap berjalan", async () => {
    const kueri: string[] = [];
    const h = await pt.jalankanRencana(rencana("Ketua: Dr. Anu"), { kering: false, kueri: async (s: string) => kueri.push(s) && {} });
    expect(h).toMatchObject({ ok: true, kering: false, jumlahLangkah: 1 });
    expect(kueri).toHaveLength(1);
  });

  it("putusan: putusanTulisService memakai penjalan yang sama; tunda sidang & penetapan kembali lewat jalankanRencanaUtuh", () => {
    expect(bot("services/putusanTulisService.js").jalankanRencana).toBe(pt.jalankanRencana);
    expect(bot("services/sidangHasilService.js").jalankanRencana).toBe(bot("services/sidangHasilService.js").jalankanRencanaUtuh);
    expect(baca("aleta_bot/routes/penetapanKembaliRoutes.js")).toContain("sidangHasilService.jalankanRencanaUtuh(rencana");
  });

  it("pesan untuk petugas jalur tunda/putus memakai kalimat penjaga", () => {
    const { pesanHasilSidang } = bot("services/pesanHasilSidang.js");
    const h = { ok: false, alasan: "teks_menyebut_aleta", pesan: g.pesanIsian("Catatan putusan") };
    expect(pesanHasilSidang(h, "putus")).toBe(g.pesanIsian("Catatan putusan"));
    expect(pesanHasilSidang({ ok: false, alasan: "teks_menyebut_aleta" }, "tunda")).toContain("jangan menyebut kata ALETA");
  });
});

describe("B2 - penetapan: sebab majelis & isian Data Umum ditahan di penyusun rencana", () => {
  const jawab = (sql: string, p: unknown[]) => {
    if (/UTC_TIMESTAMP/.test(sql)) return [{ utc: "2026-10-17 01:00:00" }];
    if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ saat: "2026-10-17 09:00:00" }];
    if (/FROM perkara p\b/.test(sql) && /LEFT JOIN perkara_penetapan/.test(sql)) {
      return [{ perkaraId: 10229, nomorPerkara: "660/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 347, tanggalDaftar: "2026-10-13" }];
    }
    if (/FROM sys_users WHERE username = \?/.test(sql)) return String(p[0]) === "meja1g" ? [{ userid: 25, username: "meja1g", fullname: "Tiffany RS", block: 0 }] : [];
    return [];
  };

  it("Data Umum: nomor surat yang memuat kata itu ditahan dengan kolomnya; tidak ada kueri tulis", async () => {
    const { layanan, dipanggil } = muatDenganDb(["services/penetapanTulisService.js"], jawab);
    const l = layanan["services/penetapanTulisService.js"];
    const h = await l.susunRencanaTulis({
      jenis: "dataUmum",
      perkaraId: 10229,
      tanggalPenetapan: "2026-10-17",
      olehUsername: "meja1g",
      operator: "UJI",
      ip: "192.168.9.82",
      dataUmum: { nomorSurat: "01/ALETA/2026" },
    });
    expect(h).toMatchObject({ ok: false, alasan: "teks_menyebut_aleta", kolom: "Data Umum - nomorSurat" });
    expect(dipanggil.filter((s) => /^\s*(INSERT|UPDATE|REPLACE|DELETE)/i.test(s))).toEqual([]);
  });

  it("sebab penetapan majelis yang memuat kata itu ditahan", async () => {
    const { layanan } = muatDenganDb(["services/penetapanTulisService.js"], jawab);
    const h = await layanan["services/penetapanTulisService.js"].susunRencanaTulis({
      jenis: "pmh",
      perkaraId: 10229,
      tanggalPenetapan: "2026-10-17",
      olehUsername: "meja1g",
      hakimId: [1],
      sebabMajelis: "dipilih oleh ALETA",
    });
    expect(h).toMatchObject({ ok: false, alasan: "teks_menyebut_aleta", kolom: "Sebab penetapan majelis" });
  });
});

describe("B3 - putusan akhir: amar, pertimbangan, catatan (ketikan hakim); nama pihak dari SIPP dikecualikan", () => {
  const dasar = { perkaraId: 10, olehUsername: "hk1", tanggalPutusan: "2026-10-16", statusPutusanId: 62, operator: "uji", ip: "10.0.0.1" };
  const jawab = (pihakAleta: string[]) => (sql: string) => {
    if (/UTC_TIMESTAMP/.test(sql)) return [{ utc: "2026-10-17 01:00:00" }];
    if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ saat: "2026-10-17 09:00:00" }];
    if (/AS saat/.test(sql)) return [{ saat: "2026-10-17 09:00:00" }];
    if (/FROM perkara p\s+LEFT JOIN perkara_putusan/.test(sql)) return [{ perkaraId: 10, nomorPerkara: "1/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 347, jenisPerkara: "Cerai Gugat", sudahAda: null, tanggalPutusanLama: null }];
    if (/FROM sys_users WHERE username/.test(sql)) return [{ username: "hk1", fullname: "Hakim Satu" }];
    if (/FROM status_putusan WHERE id/.test(sql)) return [{ id: 62, nama: "Dikabulkan" }];
    if (/perkara_pihak1/.test(sql)) return pihakAleta.map((nama) => ({ nama }));
    return [];
  };

  it("amar/pertimbangan/catatan yang memuat kata itu ditahan, menunjuk kolomnya", async () => {
    const { layanan } = muatDenganDb(["services/penetapanTulisService.js", "services/putusanTulisService.js"], jawab([]));
    const l = layanan["services/putusanTulisService.js"];
    const dasarIsi = { ...dasar, amarPutusan: "MENGADILI: mengabulkan", pertimbanganHukum: "Menimbang bahwa ..." };
    expect(await l.susunRencanaPutus({ ...dasarIsi, amarPutusan: "MENGADILI: ALETA mengabulkan" })).toMatchObject({ ok: false, alasan: "teks_menyebut_aleta", kolom: "Amar putusan" });
    expect(await l.susunRencanaPutus({ ...dasarIsi, pertimbanganHukum: "Menimbang a l e t a" })).toMatchObject({ ok: false, kolom: "Pertimbangan hukum" });
    expect(await l.susunRencanaPutus({ ...dasarIsi, catatanPutusan: "diisi lewat Aleta" })).toMatchObject({ ok: false, kolom: "Catatan putusan" });
    expect((await l.susunRencanaPutus(dasarIsi)).ok).toBe(true);
  });

  it("pihak bernama 'Aleta' (dibaca dari SIPP): amarnya boleh menyebut namanya, dan rencananya lolos penjalan", async () => {
    const { layanan } = muatDenganDb(["services/penetapanTulisService.js", "services/putusanTulisService.js"], jawab(["Aleta Sari binti Hasan"]));
    const l = layanan["services/putusanTulisService.js"];
    const r = await l.susunRencanaPutus({ ...dasar, amarPutusan: "Menghukum Tergugat Aleta Sari binti Hasan", pertimbanganHukum: "Menimbang Aleta Sari binti Hasan" });
    expect(r.ok).toBe(true);
    expect(r.dataSipp).toEqual(["Aleta Sari binti Hasan"]);
    expect(await l.jalankanRencana(r, { kering: true })).toMatchObject({ ok: true, kering: true });
    const dilarang = await l.susunRencanaPutus({ ...dasar, amarPutusan: "Menghukum Aleta Sari binti Hasan lewat ALETA", pertimbanganHukum: "Menimbang" });
    expect(dilarang).toMatchObject({ ok: false, kolom: "Amar putusan" });
  });
});

describe("B4 - mediator, kasir, Court Calendar: entri dan penjalan", () => {
  it("mediator: penjalan menahan sebelum transaksi; kalimat petugas ada di alasan", async () => {
    const med = bot("services/mediatorTulisService.js").buatLayanan({ kueri: tidakBolehDipanggil, transaksi: tidakBolehDipanggil });
    const r = {
      ok: true,
      perkara: { perkaraId: 1, nomorPerkara: "1/Pdt.G/2026/PA.Dgl" },
      langkah: [{ tabel: "perkara_mediasi", aksi: "INSERT", sql: "INSERT INTO perkara_mediasi (nomor_sk_penetapan_mediator) VALUES (?)", params: ["SK ALETA 1"], keterangan: "x" }],
    };
    const h = await med.jalankanRencanaMediator(r, { kering: false });
    expect(h).toMatchObject({ ok: false, kode: "teks_menyebut_aleta", kolom: "No. Penetapan Mediator" });
    expect(h.alasan).toBe(`Isian "No. Penetapan Mediator" memuat kata 'ALETA'; hapus dulu sebelum disimpan ke SIPP.`);
  });

  it("kasir: penjalan menahan uraian sebelum kueri/transaksi apa pun", async () => {
    const kasir = bot("services/kasirJurnalService.js").buatLayanan({ kueri: tidakBolehDipanggil, transaksi: tidakBolehDipanggil });
    const r = {
      ok: true,
      perkara: { perkaraId: 1, nomorPerkara: "1/Pdt.G/2026/PA.Dgl" },
      akunSipp: { username: "pp1", namaLengkap: "PP Satu" },
      langkah: [
        {
          ke: 0,
          nilai: { uraian: "x", jumlah: 1 },
          kelompok: [{ tabel: "perkara_biaya", aksi: "INSERT", keterangan: "x", sql: "INSERT INTO perkara_biaya (uraian, jumlah, keterangan) VALUES (?,?,?)", params: ["Biaya panggilan lewat Aleta", 10, ""] }],
        },
      ],
    };
    const h = await kasir.jalankanRencana(r, { kering: false });
    expect(h).toMatchObject({ ok: false, kode: "teks_menyebut_aleta", kolom: "Uraian", hasil: [] });
    expect(h.alasan).toContain("hapus dulu sebelum disimpan ke SIPP");
  });

  it("Court Calendar: periksaBaris (agenda/keterangan) dan penjalan menahan", async () => {
    const cc = bot("services/courtCalendarTulisService.js");
    const baris = { tanggal: "2026-10-19", jam: "09:00", agenda: "Pembuktian", keterangan: "" };
    expect(cc.periksaBaris({ ...baris, keterangan: "A.L.E.T.A" }, "2026-09-01")).toBe(cc.PESAN.aleta);
    const layanan = cc.buatLayanan({ kueri: tidakBolehDipanggil, transaksi: tidakBolehDipanggil });
    const h = await layanan.jalankanRencana(
      { ok: true, perkara: { perkaraId: 1 }, langkah: [{ jenis: "baru", ke: 0, tabel: "perkara_court_calendar", aksi: "INSERT", sql: "INSERT INTO perkara_court_calendar (rencana_agenda, keterangan) VALUES (?,?)", params: ["Pembuktian", "dari Aleta"], nilai: {} }] },
      { kering: false }
    );
    expect(h).toMatchObject({ ok: false, alasan: "teks_menyebut_aleta", kolom: "Keterangan" });
  });
});

describe("B5 - posita: teks SIPP yang dirapikan lolos selama kemunculan kata itu tidak bertambah", () => {
  it("posita ber-nama 'Aleta' dirapikan dan ditulis (UPDATE dijalankan)", async () => {
    const tulis: string[] = [];
    const jawab = (sql: string) => {
      if (/^\s*SELECT posita/i.test(sql)) return [{ posita: "Bahwa Penggugat Aleta Sari menikah.<br>2. Bahwa  setelah menikah" }];
      if (/^\s*UPDATE perkara SET posita/i.test(sql)) {
        tulis.push(sql);
        return { affectedRows: 1 };
      }
      return [];
    };
    const { layanan } = muatDenganDb(["services/sippPositaService.js"], jawab);
    const p = layanan["services/sippPositaService.js"];
    const h = await p.rapikanPosita(10);
    expect(h.ok, JSON.stringify(h)).toBe(true);
    expect(h.berubah).toBe(true);
    expect(tulis).toHaveLength(1);
  });
});

describe("B6 - berkas yang diunggah ke folder SIPP", () => {
  it("e-Doc BAS: isi ber-ALETA ditahan SEBELUM berkas atau barisnya ditulis; metadata ber-ALETA dibersihkan", async () => {
    const tulis: Buffer[] = [];
    const kueriTulis: string[] = [];
    const deps = {
      kueri: async (sql: string) => {
        if (/FROM perkara_jadwal_sidang js JOIN perkara p/.test(sql)) {
          return [{ id: 5, urutan: 2, tanggal: "2026-10-01", edoc_bas: "", nomor_perkara: "497/Pdt.G/2026/PA.Dgl", tanggal_daftar: "2026-08-03" }];
        }
        if (/perkara_pihak1/.test(sql)) return [];
        if (/^UPDATE perkara_jadwal_sidang/.test(sql)) {
          kueriTulis.push(sql);
          return { affectedRows: 1 };
        }
        return [];
      },
      tabelAda: async () => true,
      kolomAda: async () => true,
      kenaliDokumen: (b: Buffer) => g.kenaliBentuk(b),
      periksaAkar: () => ({ dapatDitulis: true, akar: "D:/uji-sipp" }),
      tulisBerkas: (_p: string, isi: Buffer) => tulis.push(isi),
      pindahBerkas: () => true,
      sekarang: () => new Date("2026-10-17T01:00:00Z"),
      hapusBerkas: () => undefined,
      samakanPemilik: () => undefined,
      akunSipp: async () => ({ username: "pp1", terpetakan: true }),
      catatJejak: async () => true,
      capWaktu: () => 1792096162,
      hariIni: async () => "2026-10-17",
    };
    const layanan = bot("services/basUnggahService.js").buatLayanan(deps);
    const masuk = { perkaraId: 1, sidangId: 5, nomorPerkara: "497/Pdt.G/2026/PA.Dgl", olehUsername: "pp1", operator: "uji", ip: "10.0.0.1" };

    const ditahan = await layanan.unggahBas({ ...masuk, isi: rtf("Hadir: Tergugat dan ALETA") });
    expect(ditahan).toMatchObject({ ok: false, alasan: "isi_berkas_menyebut_aleta" });
    expect(ditahan.pesan).toContain("BAS sidang ke-2");
    expect(tulis).toHaveLength(0);
    expect(kueriTulis).toHaveLength(0);

    const berhasil = await layanan.unggahBas({ ...masuk, isi: rtf("Hadir: Tergugat", "{\\info{\\author ALETA}{\\title BAS}}") });
    expect(berhasil.ok, JSON.stringify(berhasil)).toBe(true);
    expect(tulis).toHaveLength(1);
    expect(tulis[0].toString("latin1")).not.toMatch(/aleta/i);
    expect(tulis[0].toString("latin1")).toContain("Hadir: Tergugat");
    expect(kueriTulis).toHaveLength(1);
  });

  it("e-Doc putusan: unggahSatu menahan isi ber-ALETA sebelum menyentuh folder SIPP (pihak 'Aleta' dari SIPP dikecualikan)", async () => {
    const pu = bot("services/putusanUnggahService.js");
    const masuk = { perkaraId: 1, nomorPerkara: "497/Pdt.G/2026/PA.Dgl", jenis: "putusan", tanggalPutusan: "2026-10-16", olehUsername: "hk1", ip: "", jam: () => new Date("2026-10-17T01:00:00Z") };
    const h = await pu.unggahSatu({ ...masuk, pdf: rtf("Tergugat AL{\\b ETA} dihukum") });
    expect(h).toMatchObject({ jenis: "putusan", ok: false, alasan: "isi_berkas_menyebut_aleta" });
    expect(h.pesan).toContain("Putusan akhir");
    // pihak bernama Aleta: tidak ditahan oleh penjaga (berhenti di langkah berikutnya karena folder SIPP uji tidak ada)
    const lolos = await pu.unggahSatu({ ...masuk, pdf: rtf("Tergugat ALETA SARI dihukum"), dariSipp: ["ALETA SARI"] });
    expect(lolos.alasan).not.toBe("isi_berkas_menyebut_aleta");
  });

  it("e-Doc penetapan (PDF): dokumenPenetapanService.simpanKeSipp menahan isi ber-ALETA sebelum folder/barisnya", async () => {
    const { layanan, dipanggil } = muatDenganDb(["services/dokumenPenetapanService.js"], () => []);
    const d = layanan["services/dokumenPenetapanService.js"];
    const h = await d.simpanKeSipp({ perkaraId: 10, nomorPerkara: "497/Pdt.G/2026/PA.Dgl", jenis: "pmh", pdf: pdfPolos({ isi: "Penetapan Majelis Hakim oleh ALETA" }), olehUsername: "pp1" });
    expect(h).toMatchObject({ ok: false, alasan: "isi_berkas_menyebut_aleta" });
    expect(h.pesan).toContain("Penetapan PMH");
    expect(dipanggil.filter((s) => /^\s*(INSERT|UPDATE)/i.test(s))).toEqual([]);
  });

  it("jalur dan nama berkas e-Doc penetapan tanpa kata itu", () => {
    const d = bot("services/dokumenPenetapanService.js");
    expect(d.jalurDokumen("497/Pdt.G/2026/PA.Dgl", "pmh", new Date("2026-10-17T01:00:00Z"))).not.toMatch(/aleta/i);
  });
});

// ============================================================================
// C. PORTAL: PERINGATAN TIDAK BISA DIKIRIM KE SIPP (penyimpanan di ALETA tetap boleh)
// ============================================================================

describe("C - portal", () => {
  it("peringatan menyebut isiannya dan menegaskan bahwa ALETA boleh menyimpan tetapi SIPP/ABT tidak", () => {
    const w = peringatanTandaAleta(isianMemuatAleta({ alamat: "Jl. Aleta 1", telepon: "0822" }, (k) => (k === "alamat" ? "Alamat kantor" : k)));
    expect(w).toContain('"Alamat kantor"');
    expect(w).toContain("Boleh tersimpan di ALETA");
    expect(w).toContain("TIDAK akan bisa dikirim ke SIPP/ABT");
    expect(peringatanTandaAleta([])).toBe("");
  });

  it("identitas satker: isian ber-ALETA tetap boleh tersimpan tetapi TIDAK dapat diterapkan ke ABT, dengan sebab awam", () => {
    const abt: KeadaanSatkerBot = {
      sipp: { kodePN: "PA.Dgl", namaPN: "PA DONGGALA", namaPT: "PTA PALU", alamatPN: "JL. VATU BALA", zonaWaktu: "WITA" },
      variabel: [{ noVar: "9271", ada: true, nama: "", jenis: "data_sql", sql_query: "x", default_data: "", dikunci: false, bentukSatker: false, nilai: "" }],
      perkaraContoh: null,
    };
    const r = susunRencana({ ...saranIdentitas(abt), alamat: "Jl. Aleta No. 1" }, abt);
    const alamat = r.find((x) => x.kunci === "alamat")!;
    expect(alamat).toMatchObject({ bisa: false, perlu: false });
    expect(alamat.sebab).toBe(`Isian "Alamat kantor" memuat kata 'ALETA'; hapus dulu sebelum disimpan ke SIPP.`);
  });

  it("tanya jawab: baris baru/ubah yang memuat kata itu menahan tombol simpan; baris lama yang tak berubah tidak", () => {
    expect(periksaTemplat([{ tanya: "Nama?", jawab: "diisi oleh ALETA" }])).toEqual([pesanTandaAletaSipp("Jawaban awal 1")]);
    const lama = [{ tanya: "Sistem Aleta?", jawab: "-" }];
    expect(periksaTemplat(lama, lama)).toEqual([]);
    expect(periksaTemplat([{ tanya: "Sistem Aleta?", jawab: "-" }, { tanya: "Baru?", jawab: "ya" }], lama)).toEqual([]);
  });

  it("kueri variabel yang memuat kata itu ditolak sebelum dikirim", () => {
    expect(periksaKueriVariabel("select 'Aleta' as data")).toBe(pesanTandaAletaSipp("Isian blangko (kueri)"));
  });

  it("layar memasang peringatannya (identitas satker, tanya jawab) dan layanan portal memeriksa bawaan", () => {
    expect(baca("manajemen_surat/src/components/portal/identitas-satker-abt.tsx")).toContain("peringatanAletaIdentitas(isian)");
    expect(baca("manajemen_surat/src/components/portal/pengaturan-sipp-abt.tsx")).toContain("periksaTemplat(baris, asal ?? [])");
    expect(baca("manajemen_surat/src/server/modules/pengaturan-abt/service.ts")).toContain('pesanTandaAletaSipp("Isian bawaan")');
  });
});

// ============================================================================
// D. DAFTAR: JALUR TULIS SIPP BARU TANPA PENJAGA MEMERAHKAN UJI
// ============================================================================

function tanpaKomentar(s: string) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((b) => !/^\s*\/\//.test(b))
    .join("\n");
}

function jelajahJs(dir: string, hasil: string[] = []): string[] {
  for (const e of readdirSync(path.join(AKAR, "aleta_bot", dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (["node_modules", "archive_unused", "scripts", "data", "runtime-data", "naskah", "reports", "penyandingan", "kamus-deteksi", "legacy"].includes(e.name)) continue;
      jelajahJs(rel, hasil);
    } else if (e.name.endsWith(".js")) hasil.push(rel);
  }
  return hasil;
}

/** Tabel SIPP yang ditulis berkas ini (bukan aleta_*); "?" = nama tabel dinamis. */
function tulisanSipp(kode: string): string[] {
  const POLA = [
    /\b(?:INSERT\s+(?:IGNORE\s+)?INTO|REPLACE\s+INTO|DELETE\s+FROM)\s+([`\w.${}()]+)/gi,
    /\bUPDATE\s+(?:LOW_PRIORITY\s+)?([`\w.${}()]+)\s+(?:AS\s+\w+\s+)?(?:JOIN\b|SET\b)/gi,
  ];
  const hasil = new Set<string>();
  for (const pola of POLA) {
    for (const m of kode.matchAll(pola)) {
      let tabel = m[1].replace(/`/g, "");
      const dinamis = /^\$\{(\w+)\}$/.exec(tabel);
      if (dinamis) {
        const tetap = new RegExp(`const\\s+${dinamis[1]}\\s*=\\s*["'\`]([^"'\`]+)["'\`]`).exec(kode);
        tabel = tetap ? tetap[1] : "?";
      } else if (tabel.startsWith("${")) tabel = "?";
      if (/^aleta_/i.test(tabel)) continue;
      hasil.add(tabel);
    }
  }
  return [...hasil];
}

describe("D - daftar jalur tulis SIPP", () => {
  const terdaftar = new Set<string>(g.JALUR_TULIS_SIPP.map((x: Apa) => x.berkas));
  const dikecualikan = new Set<string>(Object.keys(g.JALUR_DIKECUALIKAN));

  it("setiap berkas bot yang menulis ke tabel SIPP tercantum - jalur baru tanpa penjaga memerahkan uji", () => {
    const belum: string[] = [];
    for (const berkas of jelajahJs("")) {
      const tabel = tulisanSipp(tanpaKomentar(readFileSync(path.join(AKAR, "aleta_bot", berkas), "utf8")));
      if (tabel.length === 0) continue;
      if (terdaftar.has(berkas) || dikecualikan.has(berkas)) continue;
      belum.push(`${berkas} (menulis: ${tabel.join(", ")})`);
    }
    expect(
      belum,
      "Jalur tulis SIPP baru tanpa penjaga. Pasang penjagaTandaSipp lalu daftarkan di JALUR_TULIS_SIPP, atau kecualikan dengan sebab di JALUR_DIKECUALIKAN (aleta_bot/services/penjagaTandaSipp.js)."
    ).toEqual([]);
  });

  it("setiap berkas yang menulis ke FOLDER berkas SIPP tercantum", () => {
    const belum: string[] = [];
    for (const berkas of jelajahJs("")) {
      const kode = tanpaKomentar(readFileSync(path.join(AKAR, "aleta_bot", berkas), "utf8"));
      if (!/periksaAkarSipp\(|samakanPemilikSipp\(|resources\/file\/(doc|anonimisasi|\$\{)/.test(kode)) continue;
      if (berkas === "services/dokumenPenetapanService.js") continue; // definisi akar & penetapan; terdaftar di bawah
      if (!terdaftar.has(berkas)) belum.push(berkas);
    }
    expect(belum).toEqual([]);
    expect(terdaftar.has("services/dokumenPenetapanService.js")).toBe(true);
  });

  it("berkas terdaftar memang ada, memuat panggilan penjaga yang dijanjikan, dan tidak ada yang yatim", () => {
    for (const j of g.JALUR_TULIS_SIPP as Apa[]) {
      expect(existsSync(path.join(AKAR, "aleta_bot", j.berkas)), j.berkas).toBe(true);
      const kode = tanpaKomentar(readFileSync(path.join(AKAR, "aleta_bot", j.berkas), "utf8"));
      for (const potongan of j.penjaga) expect(kode, `${j.berkas}: ${potongan}`).toContain(potongan);
      for (const d of j.penjagaDi || []) {
        const lain = tanpaKomentar(readFileSync(path.join(AKAR, "aleta_bot", d.berkas), "utf8"));
        expect(lain, `${j.berkas} dijaga di ${d.berkas}: ${d.kode}`).toContain(d.kode);
      }
      expect(j.penjaga.length + (j.penjagaDi || []).length, `${j.berkas} tanpa penjaga`).toBeGreaterThan(0);
      expect(String(j.sasaran || "").length, `${j.berkas} tanpa sasaran`).toBeGreaterThan(10);
    }
    for (const [berkas, sebab] of Object.entries(g.JALUR_DIKECUALIKAN as Record<string, string>)) {
      expect(existsSync(path.join(AKAR, "aleta_bot", berkas)), berkas).toBe(true);
      expect(sebab.length, `${berkas} tanpa sebab`).toBeGreaterThan(15);
      expect(terdaftar.has(berkas), `${berkas} ada di kedua daftar`).toBe(false);
    }
  });

  it("pemindai benar-benar menangkap jalur tulis baru (bukan lulus karena buta)", () => {
    expect(tulisanSipp('const sql = "UPDATE perkara SET posita = ? WHERE perkara_id = ?";')).toEqual(["perkara"]);
    expect(tulisanSipp('x(`INSERT INTO perkara_putusan (a) VALUES (?)`)')).toEqual(["perkara_putusan"]);
    expect(tulisanSipp('const TABEL = "aleta_bot_x"; q(`INSERT INTO ${TABEL} (a) VALUES (?)`)')).toEqual([]);
    expect(tulisanSipp('const TABEL = "perkara_proses"; q(`DELETE FROM ${TABEL} WHERE a = ?`)')).toEqual(["perkara_proses"]);
    expect(tulisanSipp("q(`INSERT INTO ${tabel} (a) VALUES (?)`)")).toEqual(["?"]);
    expect(tulisanSipp("q(`UPDATE sipp_turunan_antrian.antrian_sidang SET disidang = ?`)")).toEqual(["sipp_turunan_antrian.antrian_sidang"]);
    expect(tulisanSipp("q(`UPDATE sipp_turunan_antrian.antrian_sidang AS a JOIN SIPP.perkara AS p ON x SET a.online = 1`)")).toEqual(["sipp_turunan_antrian.antrian_sidang"]);
    expect(tulisanSipp("`ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)`")).toEqual([]);
  });

  it("dari daftar: berkas dalam daftar dikecualikan tidak memuat penulisan teks ke tabel SIPP (hanya angka/waktu)", () => {
    for (const berkas of Object.keys(g.JALUR_DIKECUALIKAN)) {
      const kode = tanpaKomentar(readFileSync(path.join(AKAR, "aleta_bot", berkas), "utf8"));
      // Tidak ada penulisan ke SIPP selain antrian_sidang / sys_data_refresh / antrian (kolom angka & waktu).
      const tabel = tulisanSipp(kode).filter((t) => !/^(sipp_turunan_antrian\.(antrian_sidang|sys_data_refresh)|antrian)$/.test(t) && !/^\$\{f\.kutipNama/.test(t));
      expect(tabel.filter((t) => t !== "?"), berkas).toEqual([]);
    }
  });
});

describe("D2 - ekstensi: penjaga terpasang pada skrip konten SIPP/ABT", () => {
  it("manifest memuat penjaga-tanda.js paling awal (document_start, SIPP & ABT) dan susunan ekstensi mengirimnya", () => {
    const manifest = JSON.parse(baca("ekstensi-sipp/manifest.json")) as { content_scripts: { js?: string[]; run_at?: string; matches: string[] }[] };
    const awal = manifest.content_scripts.find((x) => (x.js || []).includes("penjaga-tanda.js"));
    expect(awal?.js?.[0]).toBe("penjaga-tanda.js");
    expect(awal?.run_at).toBe("document_start");
    expect(awal?.matches).toContain("http://192.168.10.10/SIPP/*");
    expect(awal?.matches).toContain("http://192.168.10.10/aps_badilag/*");
    expect(baca("manajemen_surat/scripts/susun-ekstensi.mjs")).toContain('"penjaga-tanda.js"');
  });

  it("pengisi borang SIPP memanggil penjaga SEBELUM menyentuh kolom", () => {
    const konten = baca("ekstensi-sipp/konten.js");
    const iBorang = konten.indexOf("async function isiBorang(");
    const badan = konten.slice(iBorang, konten.indexOf("\n}\n", iBorang));
    expect(badan.indexOf("AletaPenjagaTanda.periksaTeks(nilai, kolom.medan)")).toBeGreaterThan(-1);
    expect(badan.indexOf("AletaPenjagaTanda.periksaTeks")).toBeLessThan(badan.indexOf("kirimKeJembatan("));
    const m1 = baca("ekstensi-sipp/sipp-ide-m1.js");
    const iSetel = m1.indexOf("function setel(e, nilai) {");
    const badanSetel = m1.slice(iSetel, m1.indexOf("\n  }\n", iSetel));
    expect(badanSetel.indexOf("AletaPenjagaTanda.periksaTeks")).toBeGreaterThan(-1);
    expect(badanSetel.indexOf("AletaPenjagaTanda.periksaTeks")).toBeLessThan(badanSetel.indexOf("e.value = v"));
  });
});
